import { Router } from 'express';
import db from '../db';
import { optionalAuth } from '../middleware/auth';

const router = Router();

router.post('/', optionalAuth, (req, res) => {
  const { reported_username, reason } = req.body;
  if (!reported_username || !reason?.trim())
    return res.status(400).json({ error: 'Username and reason are required' });

  const reported = db.prepare(
    'SELECT id FROM users WHERE username = ? COLLATE NOCASE'
  ).get(reported_username) as { id: number } | undefined;

  if (!reported) return res.status(404).json({ error: 'User not found' });
  if (req.user && req.user.id === reported.id)
    return res.status(400).json({ error: 'Cannot report yourself' });

  db.prepare(
    'INSERT INTO reports (reporter_id, reported_user_id, reason) VALUES (?, ?, ?)'
  ).run(req.user?.id ?? null, reported.id, reason.trim());

  return res.status(201).json({ message: 'Report submitted' });
});

export default router;
