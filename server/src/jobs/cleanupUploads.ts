import path from 'path';
import fs from 'fs';
import db from '../db';

// Periodically deletes uploaded files that nothing in the database points at
// any more (removed avatars, banners, backgrounds, flags, gallery images...).
// A user's storage quota is the size of their upload folder, so deleting
// orphans frees their quota too.
//
// "Referenced" is decided by scanning every text column of every table for
// /uploads/... URLs. That covers live profile fields, flags, gallery images,
// save-slot snapshots (JSON), bios, site-builder files, DMs and anything added
// later, without needing this job to know each feature's schema.

const UPLOADS_DIR = path.join(__dirname, '../../../uploads');

// Read lazily: index.ts loads .env after its imports have run
const minutes = (name: string, fallback: number) => (Number(process.env[name]) || fallback) * 60_000;
const intervalMs = () => minutes('UPLOAD_CLEANUP_INTERVAL_MINUTES', 10);
// Uploads happen before the profile is saved, so fresh files are left alone
// for a while to avoid deleting something the user is still editing.
const graceMs = () => minutes('UPLOAD_CLEANUP_GRACE_MINUTES', 60);
const isDryRun = () => process.env.UPLOAD_CLEANUP_DRY_RUN === '1';

// Matches /uploads/<file> (legacy flat files) and /uploads/<userId>/<file>
const UPLOAD_REF = /\/uploads\/((?:\d+\/)?[A-Za-z0-9._-]+)/g;
const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

const quote = (ident: string) => `"${ident.replace(/"/g, '""')}"`;

/** Every upload path (relative to UPLOADS_DIR) mentioned anywhere in the DB. */
function collectReferences(): Set<string> {
  const refs = new Set<string>();
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
  ).all() as { name: string }[];

  for (const { name: table } of tables) {
    const cols = db.prepare(`PRAGMA table_info(${quote(table)})`).all() as { name: string }[];
    for (const { name: col } of cols) {
      const rows = db.prepare(
        `SELECT ${quote(col)} AS v FROM ${quote(table)} WHERE CAST(${quote(col)} AS TEXT) LIKE '%/uploads/%'`
      ).all() as { v: unknown }[];
      for (const { v } of rows) {
        if (typeof v !== 'string') continue;
        for (const m of v.matchAll(UPLOAD_REF)) refs.add(m[1]);
      }
    }
  }
  return refs;
}

/** Upload files on disk: legacy root files plus one level of per-user folders. */
function listUploadFiles(): string[] {
  if (!fs.existsSync(UPLOADS_DIR)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(UPLOADS_DIR, { withFileTypes: true })) {
    if (entry.isFile() && SAFE_NAME.test(entry.name)) {
      files.push(entry.name);
    } else if (entry.isDirectory() && /^\d+$/.test(entry.name)) {
      for (const sub of fs.readdirSync(path.join(UPLOADS_DIR, entry.name), { withFileTypes: true })) {
        if (sub.isFile() && SAFE_NAME.test(sub.name)) files.push(`${entry.name}/${sub.name}`);
      }
    }
  }
  return files;
}

let running = false;

export function cleanupUnusedUploads(): { deleted: number; freedBytes: number } {
  const result = { deleted: 0, freedBytes: 0 };
  if (running) return result;
  running = true;
  try {
    // If the scan fails for any reason, bail out rather than treat everything as unused
    const refs = collectReferences();
    const now = Date.now();
    const GRACE_MS = graceMs();
    const DRY_RUN = isDryRun();

    for (const rel of listUploadFiles()) {
      if (refs.has(rel)) continue;
      const full = path.join(UPLOADS_DIR, rel);
      let stat: fs.Stats;
      try { stat = fs.statSync(full); } catch { continue; }
      if (now - stat.mtimeMs < GRACE_MS) continue;

      if (DRY_RUN) {
        console.log(`[upload-cleanup] would delete ${rel} (${stat.size} bytes)`);
      } else {
        try { fs.unlinkSync(full); } catch (err) {
          console.error(`[upload-cleanup] failed to delete ${rel}:`, err);
          continue;
        }
      }
      result.deleted++;
      result.freedBytes += stat.size;
    }

    if (result.deleted > 0) {
      const mb = (result.freedBytes / 1024 / 1024).toFixed(2);
      console.log(`[upload-cleanup] ${DRY_RUN ? 'dry run: would remove' : 'removed'} ${result.deleted} unused file(s), ${mb} MB`);
    }
  } catch (err) {
    console.error('[upload-cleanup] run aborted:', err);
  } finally {
    running = false;
  }
  return result;
}

export function startUploadCleanupJob() {
  // First pass shortly after boot, then on the interval
  setTimeout(cleanupUnusedUploads, 60_000).unref();
  setInterval(cleanupUnusedUploads, intervalMs()).unref();
}
