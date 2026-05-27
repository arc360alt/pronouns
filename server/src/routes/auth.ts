import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();
const JWT_SECRET = () => process.env.JWT_SECRET || 'fallback-secret';
const GOOGLE_CLIENT_ID = () => process.env.GOOGLE_CLIENT_ID;

function signToken(user: { id: number; username: string; is_admin: number }) {
  return jwt.sign(
    { id: user.id, username: user.username, is_admin: user.is_admin === 1 },
    JWT_SECRET(),
    { expiresIn: '30d' }
  );
}

function userResponse(user: Record<string, unknown>) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    is_admin: user.is_admin === 1,
    is_banned: user.is_banned === 1,
    google_id: user.google_id || null,
    has_password: !!user.password_hash,
    username_changed_at: user.username_changed_at || null,
    created_at: user.created_at,
  };
}

// --- Turnstile ---

async function verifyCaptcha(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true;
  try {
    const params = new URLSearchParams({ secret, response: token });
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    const data = await res.json() as { success: boolean };
    return data.success;
  } catch {
    return false;
  }
}

// --- Google token verification ---

interface GooglePayload {
  sub: string;
  email: string;
  email_verified: string | boolean;
  name?: string;
  picture?: string;
  aud: string;
  iss: string;
}

async function verifyGoogleToken(idToken: string): Promise<GooglePayload | null> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    if (!res.ok) return null;
    const data = await res.json() as GooglePayload;
    const cid = GOOGLE_CLIENT_ID();
    if (!cid || data.aud !== cid) return null;
    if (data.iss !== 'https://accounts.google.com' && data.iss !== 'accounts.google.com') return null;
    if (data.email_verified !== 'true' && data.email_verified !== true) return null;
    return data;
  } catch {
    return null;
  }
}

function generateUsername(base: string): string {
  let name = base.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase().slice(0, 25);
  if (name.length < 3) name = 'user' + name;
  const existing = db.prepare('SELECT username FROM users WHERE username = ?').get(name);
  if (!existing) return name;
  for (let i = 1; i < 1000; i++) {
    const candidate = `${name}${i}`.slice(0, 30);
    if (!db.prepare('SELECT username FROM users WHERE username = ?').get(candidate)) return candidate;
  }
  return `user${Date.now()}`.slice(0, 30);
}

// --- Password registration ---

router.post('/register', async (req, res) => {
  const { username, email, password, captchaToken } = req.body;

  if (!(await verifyCaptcha(captchaToken)))
    return res.status(400).json({ error: 'Captcha verification failed. Please try again.' });

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

    const token = signToken({ id: result.lastInsertRowid as number, username, is_admin: isAdmin });

    return res.status(201).json({
      token,
      user: { id: result.lastInsertRowid, username, email: email.toLowerCase(), is_admin: isAdmin === 1, is_banned: false, google_id: null, has_password: true, username_changed_at: null }
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

// --- Password login ---

router.post('/login', async (req, res) => {
  const { login, password, captchaToken } = req.body;
  if (!login || !password)
    return res.status(400).json({ error: 'Username/email and password required' });

  if (!(await verifyCaptcha(captchaToken)))
    return res.status(400).json({ error: 'Captcha verification failed. Please try again.' });

  try {
    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? OR email = ?'
    ).get(login, login.toLowerCase()) as Record<string, unknown> | undefined;

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.is_banned) return res.status(403).json({ error: 'Account suspended' });

    if (!user.password_hash) return res.status(401).json({ error: 'This account uses Google sign-in. Please sign in with Google.' });

    const valid = await bcrypt.compare(password as string, user.password_hash as string);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ id: user.id as number, username: user.username as string, is_admin: user.is_admin as number });

    return res.json({ token, user: userResponse(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// --- Google sign-in / sign-up ---

router.post('/google', async (req, res) => {
  const { credential, captchaToken } = req.body;

  if (!credential) return res.status(400).json({ error: 'Google credential required' });

  if (!(await verifyCaptcha(captchaToken)))
    return res.status(400).json({ error: 'Captcha verification failed. Please try again.' });

  const payload = await verifyGoogleToken(credential);
  if (!payload) return res.status(401).json({ error: 'Invalid Google credential' });

  const email = payload.email.toLowerCase();

  try {
    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(payload.sub) as Record<string, unknown> | undefined;

    if (user) {
      if (user.is_banned) return res.status(403).json({ error: 'Account suspended' });
      const token = signToken({ id: user.id as number, username: user.username as string, is_admin: user.is_admin as number });
      return res.json({ token, user: userResponse(user) });
    }

    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined;

    if (user) {
      db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(payload.sub, user.id);
      if (user.is_banned) return res.status(403).json({ error: 'Account suspended' });
      const token = signToken({ id: user.id as number, username: user.username as string, is_admin: user.is_admin as number });
      return res.json({ token, user: userResponse({ ...user, google_id: payload.sub }) });
    }

    const username = generateUsername(email.split('@')[0]);
    const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const isAdmin = count === 0 ? 1 : 0;

    const result = db.prepare(
      'INSERT INTO users (username, email, google_id, is_admin) VALUES (?, ?, ?, ?)'
    ).run(username, email, payload.sub, isAdmin);

    db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(result.lastInsertRowid);

    const token = signToken({ id: result.lastInsertRowid as number, username, is_admin: isAdmin });

    return res.status(201).json({
      token,
      user: { id: result.lastInsertRowid, username, email, is_admin: isAdmin === 1, is_banned: false, google_id: payload.sub, has_password: false, username_changed_at: null }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE constraint')) {
      if (msg.includes('users.username')) return res.status(409).json({ error: 'Username already taken' });
      if (msg.includes('users.email')) return res.status(409).json({ error: 'Email already registered' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// --- Link Google account to existing user ---

router.post('/google/link', requireAuth, async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Google credential required' });

  const payload = await verifyGoogleToken(credential);
  if (!payload) return res.status(401).json({ error: 'Invalid Google credential' });

  const linked = db.prepare('SELECT id FROM users WHERE google_id = ?').get(payload.sub) as { id: number } | undefined;
  if (linked) return res.status(409).json({ error: 'This Google account is already linked to another user' });

  db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(payload.sub, req.user!.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as Record<string, unknown>;

  return res.json({ message: 'Google account linked', user: userResponse(user) });
});

// --- Change username (7-day cooldown) ---

router.put('/username', requireAuth, async (req, res) => {
  const { username } = req.body;

  if (!username || typeof username !== 'string')
    return res.status(400).json({ error: 'Username is required' });
  if (username.length < 3 || username.length > 30)
    return res.status(400).json({ error: 'Username must be 3–30 characters' });
  if (!/^[a-zA-Z0-9_-]+$/.test(username))
    return res.status(400).json({ error: 'Username can only contain letters, numbers, _ and -' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as Record<string, unknown>;

  const lastChanged = user.username_changed_at as string | null;
  if (lastChanged) {
    const daysSinceChange = (Date.now() - new Date(lastChanged).getTime()) / 86400000;
    if (daysSinceChange < 7) {
      const daysRemaining = Math.ceil(7 - daysSinceChange);
      return res.status(429).json({ error: `You can change your username again in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}` });
    }
  }

  try {
    db.prepare(
      'UPDATE users SET username = ?, username_changed_at = datetime(\'now\') WHERE id = ?'
    ).run(username, req.user!.id);

    const token = signToken({ id: user.id as number, username, is_admin: user.is_admin as number });

    return res.json({ token, username, username_changed_at: new Date().toISOString() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE constraint')) return res.status(409).json({ error: 'Username already taken' });
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// --- Public config ---

router.get('/config', (_req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID() || null });
});

// --- Get current user ---

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, email, is_admin, is_banned, created_at, google_id, password_hash, username_changed_at FROM users WHERE id = ?'
  ).get(req.user!.id) as Record<string, unknown> | undefined;

  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json(userResponse(user));
});

// --- Update account (email/password) ---

router.put('/account', requireAuth, async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as Record<string, unknown>;

  if (user.password_hash) {
    const valid = await bcrypt.compare(currentPassword as string, user.password_hash as string);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
  }

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
