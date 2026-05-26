import { Router } from 'express';
import db, { getFullProfile } from '../db';
import { optionalAuth } from '../middleware/auth';

const router = Router();

router.get('/:username', optionalAuth, (req, res) => {
  let username = req.params.username;
  if (username.startsWith('@')) username = username.slice(1);

  const user = db.prepare(
    'SELECT id, is_banned FROM users WHERE username = ? COLLATE NOCASE'
  ).get(username) as { id: number; is_banned: number } | undefined;

  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.is_banned && !req.user?.is_admin)
    return res.status(403).json({ error: 'This account has been suspended' });

  const profile = getFullProfile(user.id);
  return res.json({ user_id: user.id, is_banned: user.is_banned === 1, ...profile });
});

export default router;
