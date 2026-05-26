import { Router } from 'express';
import db from '../db';

const router = Router();

router.get('/banner', (req, res) => {
  const get = (key: string) =>
    (db.prepare('SELECT value FROM site_settings WHERE key = ?').get(key) as { value: string } | undefined)?.value ?? null;
  const active = get('banner_active');
  if (active !== '1') return res.json(null);
  return res.json({
    text:     get('banner_text') || '',
    color:    get('banner_color') || '#e07a27',
    btn_text: get('banner_btn_text') || null,
    btn_url:  get('banner_btn_url') || null,
  });
});

router.get('/stats', (req, res) => {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_banned = 0').get() as { count: number };
  return res.json({ member_count: count });
});

export default router;
