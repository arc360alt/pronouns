import { Router } from 'express';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Fields captured in a style slot (no personal info)
const STYLE_FIELDS = [
  'custom_color','custom_color_2','custom_color_dir',
  'profile_bg','profile_bg_type','profile_bg_brightness',
  'hide_banner_with_bg','forced_theme',
  'section_blur','section_blur_amount','section_bg_color','section_bg_opacity',
  'section_labels','content_align','section_order',
  'banner','banner_position','banner_height',
  'profile_picture','avatar_size',
  'show_friends','show_site',
];

function captureSlotData(userId: number): object {
  const p = db.prepare(`SELECT ${STYLE_FIELDS.join(',')} FROM profiles WHERE user_id = ?`).get(userId) as Record<string, unknown> | undefined;
  if (!p) throw new Error('Profile not found');

  const flags = db.prepare('SELECT flag_name, flag_image, sort_order FROM profile_flags WHERE user_id = ? ORDER BY sort_order').all(userId);
  const links = db.prepare('SELECT link_label, link_url, link_icon, link_icon_mode, link_icon_size, sort_order FROM profile_links WHERE user_id = ? ORDER BY sort_order').all(userId);
  const images = db.prepare('SELECT image_url, caption, sort_order FROM profile_images WHERE user_id = ? ORDER BY sort_order').all(userId);
  const rawFields = db.prepare('SELECT id, field_name, sort_order FROM custom_fields WHERE user_id = ? ORDER BY sort_order').all(userId) as { id: number; field_name: string; sort_order: number }[];
  const custom_fields = rawFields.map(f => ({
    field_name: f.field_name,
    sort_order: f.sort_order,
    entries: db.prepare('SELECT value, entry_status, preference, sort_order FROM custom_field_entries WHERE field_id = ? ORDER BY sort_order').all(f.id),
  }));

  return { version: 1, ...p, flags, links, images, custom_fields };
}

function applySlotData(userId: number, data: Record<string, unknown>) {
  // Update profile style fields
  const allowed = STYLE_FIELDS.filter(f => f in data);
  if (allowed.length) {
    const sets = allowed.map(f => `${f} = ?`).join(', ');
    const values = allowed.map(f => data[f] ?? null);
    db.prepare(`UPDATE profiles SET ${sets} WHERE user_id = ?`).run(...values, userId);
  }

  // Replace flags
  if (Array.isArray(data.flags)) {
    db.prepare('DELETE FROM profile_flags WHERE user_id = ?').run(userId);
    const insertFlag = db.prepare('INSERT INTO profile_flags (user_id, flag_name, flag_image, sort_order) VALUES (?, ?, ?, ?)');
    for (const f of data.flags as { flag_name: string; flag_image: string; sort_order: number }[]) {
      insertFlag.run(userId, f.flag_name, f.flag_image, f.sort_order ?? 0);
    }
  }

  // Replace links
  if (Array.isArray(data.links)) {
    db.prepare('DELETE FROM profile_links WHERE user_id = ?').run(userId);
    const insertLink = db.prepare('INSERT INTO profile_links (user_id, link_label, link_url, link_icon, link_icon_mode, link_icon_size, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const l of data.links as { link_label: string; link_url: string; link_icon?: string; link_icon_mode?: string; link_icon_size?: number; sort_order: number }[]) {
      insertLink.run(userId, l.link_label, l.link_url, l.link_icon ?? null, l.link_icon_mode ?? 'text', l.link_icon_size ?? 1.5, l.sort_order ?? 0);
    }
  }

  // Replace images
  if (Array.isArray(data.images)) {
    db.prepare('DELETE FROM profile_images WHERE user_id = ?').run(userId);
    const insertImg = db.prepare('INSERT INTO profile_images (user_id, image_url, caption, sort_order) VALUES (?, ?, ?, ?)');
    for (const img of data.images as { image_url: string; caption?: string; sort_order: number }[]) {
      insertImg.run(userId, img.image_url, img.caption ?? null, img.sort_order ?? 0);
    }
  }

  // Replace custom fields
  if (Array.isArray(data.custom_fields)) {
    const existingFields = db.prepare('SELECT id FROM custom_fields WHERE user_id = ?').all(userId) as { id: number }[];
    for (const f of existingFields) {
      db.prepare('DELETE FROM custom_field_entries WHERE field_id = ?').run(f.id);
    }
    db.prepare('DELETE FROM custom_fields WHERE user_id = ?').run(userId);
    const insertField = db.prepare('INSERT INTO custom_fields (user_id, field_name, sort_order) VALUES (?, ?, ?)');
    const insertEntry = db.prepare('INSERT INTO custom_field_entries (field_id, user_id, value, entry_status, preference, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    for (const cf of data.custom_fields as { field_name: string; sort_order: number; entries: { value: string; entry_status?: string; preference?: string; sort_order: number }[] }[]) {
      const res = insertField.run(userId, cf.field_name, cf.sort_order ?? 0);
      for (const e of (cf.entries ?? [])) {
        insertEntry.run(res.lastInsertRowid, userId, e.value, e.entry_status ?? null, e.preference ?? null, e.sort_order ?? 0);
      }
    }
  }
}

// GET all slots
router.get('/', requireAuth, (_req, res) => {
  const slots = db.prepare('SELECT slot_num, name, updated_at FROM profile_slots WHERE user_id = ?').all(_req.user!.id);
  return res.json(slots);
});

// GET single slot data (for export)
router.get('/:slot', requireAuth, (req, res) => {
  const slot = parseInt(req.params.slot);
  if (![1,2,3].includes(slot)) return res.status(400).json({ error: 'Slot must be 1, 2, or 3' });
  const row = db.prepare('SELECT data FROM profile_slots WHERE user_id = ? AND slot_num = ?').get(req.user!.id, slot) as { data: string } | undefined;
  if (!row) return res.status(404).json({ error: 'Slot is empty' });
  const data = JSON.parse(row.data);
  return res.json(data);
});

// POST — save current profile to slot
router.post('/:slot', requireAuth, (req, res) => {
  const slot = parseInt(req.params.slot);
  if (![1,2,3].includes(slot)) return res.status(400).json({ error: 'Slot must be 1, 2, or 3' });
  const name = (req.body.name as string)?.trim().slice(0, 64) || 'Untitled';

  try {
    const data = captureSlotData(req.user!.id);
    db.prepare(`
      INSERT INTO profile_slots (user_id, slot_num, name, data, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, slot_num) DO UPDATE SET name = excluded.name, data = excluded.data, updated_at = excluded.updated_at
    `).run(req.user!.id, slot, name, JSON.stringify(data));
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// POST /:slot/load — apply slot to current profile
router.post('/:slot/load', requireAuth, (req, res) => {
  const slot = parseInt(req.params.slot);
  if (![1,2,3].includes(slot)) return res.status(400).json({ error: 'Slot must be 1, 2, or 3' });
  const row = db.prepare('SELECT data FROM profile_slots WHERE user_id = ? AND slot_num = ?').get(req.user!.id, slot) as { data: string } | undefined;
  if (!row) return res.status(404).json({ error: 'Slot is empty' });

  try {
    applySlotData(req.user!.id, JSON.parse(row.data));
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// POST /import/apply — validate and apply imported JSON directly to profile
router.post('/import/apply', requireAuth, (req, res) => {
  const data = req.body;
  if (!data || data.version !== 1) return res.status(400).json({ error: 'Invalid profile export file' });
  try {
    applySlotData(req.user!.id, data);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// POST /import/slot/:slot — import JSON into a specific slot
router.post('/import/slot/:slot', requireAuth, (req, res) => {
  const slot = parseInt(req.params.slot);
  if (![1,2,3].includes(slot)) return res.status(400).json({ error: 'Slot must be 1, 2, or 3' });
  const data = req.body;
  if (!data || data.version !== 1) return res.status(400).json({ error: 'Invalid profile export file' });
  const name = (data._name as string)?.trim().slice(0, 64) || 'Imported';
  db.prepare(`
    INSERT INTO profile_slots (user_id, slot_num, name, data, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, slot_num) DO UPDATE SET name = excluded.name, data = excluded.data, updated_at = excluded.updated_at
  `).run(req.user!.id, slot, name, JSON.stringify(data));
  return res.json({ ok: true });
});

// DELETE /:slot — clear a slot
router.delete('/:slot', requireAuth, (req, res) => {
  const slot = parseInt(req.params.slot);
  if (![1,2,3].includes(slot)) return res.status(400).json({ error: 'Slot must be 1, 2, or 3' });
  db.prepare('DELETE FROM profile_slots WHERE user_id = ? AND slot_num = ?').run(req.user!.id, slot);
  return res.json({ ok: true });
});

export default router;
