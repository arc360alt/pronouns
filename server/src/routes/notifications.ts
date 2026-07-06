import { Router } from 'express';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.user!.id);
  return res.json(rows);
});

router.get('/unread-count', requireAuth, (req, res) => {
  const row = db.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
  ).get(req.user!.id) as { count: number };
  return res.json({ count: row.count });
});

router.put('/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user!.id);
  return res.json({ ok: true });
});

router.put('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user!.id);
  return res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user!.id);
  return res.json({ ok: true });
});

export function createNotification(userId: number, type: string, title: string, body: string) {
  db.prepare('INSERT INTO notifications (user_id, type, title, body) VALUES (?, ?, ?, ?)')
    .run(userId, type, title, body);
}

export default router;
