import { Router, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth';

const router = Router();

const UPLOADS_DIR = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const USER_STORAGE_LIMIT = 50 * 1024 * 1024; // 50 MB per user

/** Sum of all file sizes directly inside a user's upload folder. */
function getUserFolderSize(userId: number): number {
  const dir = path.join(UPLOADS_DIR, String(userId));
  if (!fs.existsSync(dir)) return 0;
  try {
    return fs.readdirSync(dir).reduce((total, name) => {
      try { return total + fs.statSync(path.join(dir, name)).size; }
      catch { return total; }
    }, 0);
  } catch { return 0; }
}

// Per-user subdirectory storage — existing flat uploads still served by express.static
const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const userId = req.user?.id;
    if (!userId) { cb(new Error('Not authenticated'), ''); return; }
    const userDir = path.join(UPLOADS_DIR, String(userId));
    try {
      if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
      cb(null, userDir);
    } catch (err) { cb(err as Error, ''); }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: USER_STORAGE_LIMIT },
  fileFilter: (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    const okExts  = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4'];
    const okMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'];
    if (okExts.includes(ext) && okMimes.includes(mime)) cb(null, true);
    else cb(new Error('Only images (jpg, png, gif, webp) and MP4 videos are allowed'));
  },
});

/** Returns how many bytes the current user has used out of their 50 MB quota. */
router.get('/usage', requireAuth, (req, res) => {
  const used = getUserFolderSize(req.user!.id);
  return res.json({ used, limit: USER_STORAGE_LIMIT, remaining: Math.max(0, USER_STORAGE_LIMIT - used) });
});

router.post('/', requireAuth, (req, res) => {
  const userId = req.user!.id;

  // Reject immediately if already at the storage cap
  const usedBefore = getUserFolderSize(userId);
  if (usedBefore >= USER_STORAGE_LIMIT) {
    return res.status(413).json({ error: 'Storage limit reached (50 MB). Delete some uploads to free up space.' });
  }

  // Run multer inline so we can handle its errors cleanly
  upload.single('file')(req, res, (err) => {
    if (err) {
      const code = (err as NodeJS.ErrnoException & { code?: string }).code;
      if (code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'This upload would exceed your 50 MB storage limit.' });
      }
      return res.status(400).json({ error: (err as Error).message || 'Upload failed' });
    }

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Verify the upload didn't push them over the quota
    const usedAfter = getUserFolderSize(userId);
    if (usedAfter > USER_STORAGE_LIMIT) {
      fs.unlinkSync(req.file.path);
      return res.status(413).json({ error: 'This upload would exceed your 50 MB storage limit.' });
    }

    return res.json({ url: `/uploads/${userId}/${req.file.filename}` });
  });
});

export default router;
