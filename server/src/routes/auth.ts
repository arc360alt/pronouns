import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();
const JWT_SECRET = () => process.env.JWT_SECRET || 'fallback-secret';

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields are required' });
  if (username.length < 3 || username.length > 30)
    return res.status(400).json({ error: 'Username must be 3–30 characters' });
  if (!/^[a-zA-Z0-9_-]+$/.test(username))
    return res.status(400).json({ error: 'Username can only contain letters, numbers, _ and -' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const isAdmin = count === 0 ? 1 : 0;

    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)'
    ).run(username, email.toLowerCase(), passwordHash, isAdmin);

    db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(result.lastInsertRowid);

    const token = jwt.sign(
      { id: result.lastInsertRowid, username, is_admin: isAdmin === 1 },
      JWT_SECRET(),
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      token,
      user: { id: result.lastInsertRowid, username, email: email.toLowerCase(), is_admin: isAdmin === 1, is_banned: false }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE constraint failed')) {
      if (msg.includes('users.username')) return res.status(409).json({ error: 'Username already taken' });
      if (msg.includes('users.email')) return res.status(409).json({ error: 'Email already registered' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password)
    return res.status(400).json({ error: 'Username/email and password required' });

  try {
    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? OR email = ?'
    ).get(login, login.toLowerCase()) as Record<string, unknown> | undefined;

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.is_banned) return res.status(403).json({ error: 'Account suspended' });

    const valid = await bcrypt.compare(password as string, user.password_hash as string);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, username: user.username, is_admin: user.is_admin === 1 },
      JWT_SECRET(),
      { expiresIn: '30d' }
    );

    return res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin === 1, is_banned: false }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, email, is_admin, is_banned, created_at FROM users WHERE id = ?'
  ).get(req.user!.id) as Record<string, unknown> | undefined;

  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json({ ...user, is_admin: user.is_admin === 1, is_banned: user.is_banned === 1 });
});

router.put('/account', requireAuth, async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as Record<string, unknown>;

  const valid = await bcrypt.compare(currentPassword as string, user.password_hash as string);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const updates: Record<string, string> = {};
  if (email && email !== user.email) updates.email = (email as string).toLowerCase();
  if (newPassword) {
    if ((newPassword as string).length < 8)
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    updates.password_hash = await bcrypt.hash(newPassword as string, 12);
  }

  if (Object.keys(updates).length === 0) return res.json({ message: 'No changes made' });

  try {
    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(...Object.values(updates), req.user!.id);
    return res.json({ message: 'Account updated' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE constraint')) return res.status(409).json({ error: 'Email already in use' });
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
