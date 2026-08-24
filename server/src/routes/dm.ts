import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { createNotification } from './notifications';

const router = Router();

function dmsEnabledValue() {
  const row = db.prepare("SELECT value FROM site_settings WHERE key = 'dms_enabled'").get() as { value: string } | undefined;
  return row?.value === '1';
}

// Public: let clients check if DMs are enabled without auth
router.get('/status', (_req, res) => {
  return res.json({ enabled: dmsEnabledValue() });
});

// Block all non-admin DM routes when DMs are disabled
router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/admin')) return next();
  if (!dmsEnabledValue()) return res.status(503).json({ error: 'Direct messaging is currently disabled by administrators.' });
  next();
});

// --- Settings ---

router.get('/settings', requireAuth, (req, res) => {
  const row = db.prepare('SELECT dm_requests_enabled FROM users WHERE id = ?').get(req.user!.id) as { dm_requests_enabled: number } | undefined;
  return res.json({ dm_requests_enabled: row?.dm_requests_enabled ?? 0 });
});

router.put('/settings', requireAuth, (req, res) => {
  const { dm_requests_enabled } = req.body;
  db.prepare('UPDATE users SET dm_requests_enabled = ? WHERE id = ?').run(dm_requests_enabled ? 1 : 0, req.user!.id);
  return res.json({ ok: true });
});

// --- Requests ---

router.post('/requests', requireAuth, (req, res) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string') return res.status(400).json({ error: 'Username required' });

  const cleanUsername = username.trim().replace(/^@/, '');
  const target = db.prepare('SELECT id, username, dm_requests_enabled FROM users WHERE username = ? AND is_banned = 0').get(cleanUsername) as { id: number; username: string; dm_requests_enabled: number } | undefined;
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user!.id) return res.status(400).json({ error: 'Cannot message yourself' });
  if (!target.dm_requests_enabled) return res.status(403).json({ error: 'This user has DM requests turned off' });

  // Already have a conversation?
  const existing = db.prepare(
    'SELECT id FROM dm_conversations WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)'
  ).get(req.user!.id, target.id, target.id, req.user!.id);
  if (existing) return res.status(409).json({ error: 'You already have a conversation with this user' });

  // Already sent a request?
  const pending = db.prepare('SELECT id, status FROM dm_requests WHERE from_user_id = ? AND to_user_id = ?').get(req.user!.id, target.id) as { id: number; status: string } | undefined;
  if (pending) {
    if (pending.status === 'pending') return res.status(409).json({ error: 'Request already sent' });
    if (pending.status === 'denied') return res.status(403).json({ error: 'Your request was denied by this user' });
  }

  db.prepare('INSERT OR REPLACE INTO dm_requests (from_user_id, to_user_id, status) VALUES (?, ?, \'pending\')').run(req.user!.id, target.id);
  createNotification(target.id, 'message', 'New DM Request', `@${req.user!.username} wants to send you a direct message.`);
  return res.json({ ok: true });
});

router.get('/requests', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT r.id, r.from_user_id, r.created_at, u.username as from_username
    FROM dm_requests r
    JOIN users u ON u.id = r.from_user_id
    WHERE r.to_user_id = ? AND r.status = 'pending'
    ORDER BY r.created_at DESC
  `).all(req.user!.id);
  return res.json(rows);
});

router.post('/requests/:id/accept', requireAuth, (req, res) => {
  const req_row = db.prepare('SELECT * FROM dm_requests WHERE id = ? AND to_user_id = ? AND status = \'pending\'').get(req.params.id, req.user!.id) as { id: number; from_user_id: number; to_user_id: number } | undefined;
  if (!req_row) return res.status(404).json({ error: 'Request not found' });

  db.prepare('UPDATE dm_requests SET status = \'accepted\' WHERE id = ?').run(req_row.id);
  const conv = db.prepare('INSERT INTO dm_conversations (user1_id, user2_id) VALUES (?, ?)').run(req_row.from_user_id, req_row.to_user_id);
  createNotification(req_row.from_user_id, 'message', 'DM Request Accepted', `@${req.user!.username} accepted your DM request. You can now message each other.`);
  return res.json({ ok: true, conversation_id: conv.lastInsertRowid });
});

router.post('/requests/:id/deny', requireAuth, (req, res) => {
  const req_row = db.prepare('SELECT * FROM dm_requests WHERE id = ? AND to_user_id = ? AND status = \'pending\'').get(req.params.id, req.user!.id) as { id: number; from_user_id: number } | undefined;
  if (!req_row) return res.status(404).json({ error: 'Request not found' });

  db.prepare('UPDATE dm_requests SET status = \'denied\' WHERE id = ?').run(req_row.id);
  createNotification(req_row.from_user_id, 'message', 'DM Request Denied', `@${req.user!.username} declined your DM request.`);
  return res.json({ ok: true });
});

// --- Conversations ---

router.get('/conversations', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.user1_id, c.user2_id, c.created_at,
      u1.username as user1_username, u2.username as user2_username,
      (SELECT content FROM dm_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM dm_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
      (SELECT COUNT(*) FROM dm_messages WHERE conversation_id = c.id AND sender_id != ? AND created_at > COALESCE((SELECT last_read FROM dm_reads WHERE conv_id = c.id AND user_id = ?), '1970-01-01')) as unread_count
    FROM dm_conversations c
    JOIN users u1 ON u1.id = c.user1_id
    JOIN users u2 ON u2.id = c.user2_id
    WHERE c.user1_id = ? OR c.user2_id = ?
    ORDER BY COALESCE(last_message_at, c.created_at) DESC
  `).all(req.user!.id, req.user!.id, req.user!.id, req.user!.id);
  return res.json(rows);
});

router.get('/conversations/:id/messages', requireAuth, (req, res) => {
  const conv = db.prepare('SELECT * FROM dm_conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)').get(req.params.id, req.user!.id, req.user!.id) as { id: number } | undefined;
  if (!conv) return res.status(403).json({ error: 'Not part of this conversation' });

  // Mark as read
  db.prepare('INSERT OR REPLACE INTO dm_reads (conv_id, user_id, last_read) VALUES (?, ?, datetime(\'now\'))').run(req.params.id, req.user!.id);

  const messages = db.prepare(`
    SELECT m.id, m.sender_id, m.content, m.created_at, u.username as sender_username
    FROM dm_messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
  `).all(req.params.id);
  return res.json(messages);
});

router.post('/conversations/:id/messages', requireAuth, (req, res) => {
  const conv = db.prepare('SELECT * FROM dm_conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)').get(req.params.id, req.user!.id, req.user!.id) as { id: number; user1_id: number; user2_id: number } | undefined;
  if (!conv) return res.status(403).json({ error: 'Not part of this conversation' });

  const { content } = req.body;
  if (!content || typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: 'Message cannot be empty' });
  if (content.length > 2000) return res.status(400).json({ error: 'Message too long (max 2000 chars)' });

  const result = db.prepare('INSERT INTO dm_messages (conversation_id, sender_id, content) VALUES (?, ?, ?)').run(req.params.id, req.user!.id, content.trim());
  const other_id = conv.user1_id === req.user!.id ? conv.user2_id : conv.user1_id;

  // Notify other user (throttle: only if they haven't gotten one in the last minute)
  const recent = db.prepare(`SELECT id FROM notifications WHERE user_id = ? AND type = 'message' AND title = ? AND created_at > datetime('now', '-1 minute')`).get(other_id, `New message from @${req.user!.username}`);
  if (!recent) {
    createNotification(other_id, 'message', `New message from @${req.user!.username}`, content.trim().slice(0, 80) + (content.length > 80 ? '…' : ''));
  }

  return res.json({ id: result.lastInsertRowid, ok: true });
});

// --- Reports ---

router.post('/conversations/:id/report', requireAuth, (req, res) => {
  const conv = db.prepare('SELECT * FROM dm_conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)').get(req.params.id, req.user!.id, req.user!.id);
  if (!conv) return res.status(403).json({ error: 'Not part of this conversation' });

  const existing = db.prepare('SELECT id FROM dm_reports WHERE conversation_id = ? AND reporter_id = ? AND status = \'pending\'').get(req.params.id, req.user!.id);
  if (existing) return res.status(409).json({ error: 'You already reported this conversation' });

  db.prepare('INSERT INTO dm_reports (conversation_id, reporter_id) VALUES (?, ?)').run(req.params.id, req.user!.id);
  return res.json({ ok: true });
});

// --- Admin ---

router.get('/admin/reports', requireAdmin, (_req, res) => {
  const rows = db.prepare(`
    SELECT dr.id, dr.conversation_id, dr.reporter_id, dr.status, dr.created_at,
      u1.username as reporter_username,
      u2.username as user1_username, u3.username as user2_username
    FROM dm_reports dr
    JOIN users u1 ON u1.id = dr.reporter_id
    JOIN dm_conversations c ON c.id = dr.conversation_id
    JOIN users u2 ON u2.id = c.user1_id
    JOIN users u3 ON u3.id = c.user2_id
    ORDER BY dr.created_at DESC
  `).all();
  return res.json(rows);
});

router.get('/admin/reports/:id/messages', requireAdmin, (req, res) => {
  const report = db.prepare('SELECT * FROM dm_reports WHERE id = ?').get(req.params.id) as { conversation_id: number } | undefined;
  if (!report) return res.status(404).json({ error: 'Report not found' });

  const messages = db.prepare(`
    SELECT m.id, m.sender_id, m.content, m.created_at, u.username as sender_username
    FROM dm_messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
  `).all(report.conversation_id);
  return res.json(messages);
});

router.put('/admin/reports/:id', requireAdmin, (req, res) => {
  const { status } = req.body;
  if (!['pending', 'resolved', 'dismissed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE dm_reports SET status = ? WHERE id = ?').run(status, req.params.id);
  return res.json({ ok: true });
});

export default router;
