import { Router } from 'express';
import db, { getFullProfile } from '../db';
import { optionalAuth, requireAuth } from '../middleware/auth';

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

router.get('/:username/likes', optionalAuth, (req, res) => {
  let username = req.params.username;
  if (username.startsWith('@')) username = username.slice(1);
  const user = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username) as { id: number } | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { count } = db.prepare('SELECT COUNT(*) as count FROM profile_likes WHERE profile_user_id = ?').get(user.id) as { count: number };
  const liked_by_me = req.user
    ? !!(db.prepare('SELECT 1 FROM profile_likes WHERE profile_user_id = ? AND liker_user_id = ?').get(user.id, req.user.id))
    : false;
  return res.json({ count, liked_by_me });
});

router.post('/:username/like', requireAuth, (req, res) => {
  let username = req.params.username;
  if (username.startsWith('@')) username = username.slice(1);
  const user = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username) as { id: number } | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.id === req.user!.id) return res.status(400).json({ error: 'You cannot like your own profile' });
  const existing = db.prepare('SELECT 1 FROM profile_likes WHERE profile_user_id = ? AND liker_user_id = ?').get(user.id, req.user!.id);
  if (existing) {
    db.prepare('DELETE FROM profile_likes WHERE profile_user_id = ? AND liker_user_id = ?').run(user.id, req.user!.id);
  } else {
    db.prepare('INSERT INTO profile_likes (profile_user_id, liker_user_id) VALUES (?, ?)').run(user.id, req.user!.id);
  }
  const { count } = db.prepare('SELECT COUNT(*) as count FROM profile_likes WHERE profile_user_id = ?').get(user.id) as { count: number };
  return res.json({ liked: !existing, count });
});

export default router;
