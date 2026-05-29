import { Router, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth';

const router = Router();

const UPLOADS_DIR = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req: Request, file: Express.Multer.File, cb: (err: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    const okExts  = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4'];
    const okMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'];
    if (okExts.includes(ext) && okMimes.includes(mime)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (jpg, png, gif, webp) and MP4 videos are allowed'));
    }
  }
});

const TYPE_LIMITS: Record<string, number> = {
  pfp:    2   * 1024 * 1024,  // 2 MB (cropped output is always tiny; generous headroom)
  banner: 3   * 1024 * 1024,  // 3 MB
};

router.post('/', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const type = (req.query.type as string) ?? '';
  const limit = TYPE_LIMITS[type];
  if (limit && req.file.size > limit) {
    fs.unlinkSync(req.file.path);
    const mb = (limit / 1024 / 1024).toFixed(1);
    return res.status(413).json({ error: `File too large. Maximum size for ${type} uploads is ${mb} MB.` });
  }

  return res.json({ url: `/uploads/${req.file.filename}` });
});

export default router;
