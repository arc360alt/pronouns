import { Router } from 'express';
import db, { BADGE_DEFS } from '../db';
import { requireAdmin } from '../middleware/auth';
import { createNotification } from './notifications';

const router = Router();

router.get('/reports', requireAdmin, (req, res) => {
  const reports = db.prepare(`
    SELECT r.*,
      ru.username as reported_username,
      rep.username as reporter_username
    FROM reports r
    LEFT JOIN users ru ON r.reported_user_id = ru.id
    LEFT JOIN users rep ON r.reporter_id = rep.id
    ORDER BY
      CASE r.status WHEN 'pending' THEN 0 ELSE 1 END,
      r.created_at DESC
  `).all();
  return res.json(reports);
});

router.put('/reports/:id', requireAdmin, (req, res) => {
  const { status, admin_note } = req.body;
  if (!['pending', 'resolved', 'dismissed'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  const result = db.prepare(
    'UPDATE reports SET status = ?, admin_note = ? WHERE id = ?'
  ).run(status, admin_note || null, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Report not found' });
  return res.json({ message: 'Report updated' });
});

router.get('/users', requireAdmin, (req, res) => {
  const users = db.prepare(
    'SELECT id, username, email, is_admin, is_banned, created_at FROM users ORDER BY created_at DESC'
  ).all();
  return res.json(users);
});

router.put('/users/:id/ban', requireAdmin, (req, res) => {
  const { banned, reason } = req.body;
  if (parseInt(req.params.id) === req.user!.id)
    return res.status(400).json({ error: 'Cannot ban yourself' });

  const result = db.prepare('UPDATE users SET is_banned = ? WHERE id = ?').run(banned ? 1 : 0, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'User not found' });

  const userId = parseInt(req.params.id);
  if (banned) {
    createNotification(userId, 'system',
      'Your account has been banned',
      reason?.trim() || 'Your account has been banned by an administrator. If you believe this is a mistake, please contact support.'
    );
  } else {
    createNotification(userId, 'system',
      'Your account ban has been lifted',
      'Your account has been reinstated. Please review our community guidelines to avoid future issues.'
    );
  }

  return res.json({ message: banned ? 'User banned' : 'User unbanned' });
});

router.put('/users/:id/admin', requireAdmin, (req, res) => {
  const { is_admin } = req.body;
  if (parseInt(req.params.id) === req.user!.id)
    return res.status(400).json({ error: 'Cannot change your own admin status' });

  const result = db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(is_admin ? 1 : 0, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
  return res.json({ message: is_admin ? 'Admin granted' : 'Admin revoked' });
});

router.delete('/users/:id/ai-usage', requireAdmin, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  db.prepare('DELETE FROM ai_usage WHERE user_id = ? AND date = ?').run(req.params.id, today);
  return res.json({ ok: true });
});

router.get('/banner', requireAdmin, (req, res) => {
  const get = (key: string) =>
    (db.prepare('SELECT value FROM site_settings WHERE key = ?').get(key) as { value: string } | undefined)?.value ?? null;
  return res.json({
    active:   get('banner_active') === '1',
    text:     get('banner_text') || '',
    color:    get('banner_color') || '#e07a27',
    btn_text: get('banner_btn_text') || '',
    btn_url:  get('banner_btn_url') || '',
  });
});

router.put('/banner', requireAdmin, (req, res) => {
  const { active, text, color, btn_text, btn_url } = req.body;
  const set = db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)');
  set.run('banner_active',   active ? '1' : '0');
  set.run('banner_text',     text || '');
  set.run('banner_color',    color || '#e07a27');
  set.run('banner_btn_text', btn_text || '');
  set.run('banner_btn_url',  btn_url || '');
  return res.json({ message: 'Banner updated' });
});

router.get('/badges', requireAdmin, (_req, res) => {
  return res.json(BADGE_DEFS);
});

router.post('/users/:id/badges/:badgeId', requireAdmin, (req, res) => {
  const { id, badgeId } = req.params;
  if (!BADGE_DEFS.some(d => d.id === badgeId)) return res.status(404).json({ error: 'Unknown badge' });
  db.prepare(`
    INSERT INTO user_badges (user_id, badge_id, awarded_by, visible, sort_order)
    VALUES (?, ?, ?, 1, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM user_badges WHERE user_id = ?))
    ON CONFLICT(user_id, badge_id) DO UPDATE SET awarded_by = excluded.awarded_by
  `).run(id, badgeId, req.user!.id, id);
  return res.json({ ok: true });
});

router.delete('/users/:id/badges/:badgeId', requireAdmin, (req, res) => {
  const { id, badgeId } = req.params;
  db.prepare('DELETE FROM user_badges WHERE user_id = ? AND badge_id = ? AND awarded_by IS NOT NULL')
    .run(id, badgeId);
  return res.json({ ok: true });
});

router.post('/notify/:userId', requireAdmin, (req, res) => {
  const { title, body } = req.body;
  if (!title?.trim() || !body?.trim())
    return res.status(400).json({ error: 'Title and body are required' });

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  createNotification(parseInt(req.params.userId), 'message', title.trim(), body.trim());
  return res.json({ ok: true });
});

router.post('/feedback/:id/reply', requireAdmin, (req, res) => {
  const { reply } = req.body;
  if (!reply?.trim()) return res.status(400).json({ error: 'Reply text is required' });

  const row = db.prepare('SELECT * FROM feedback WHERE id = ?').get(req.params.id) as { user_id: number; message: string } | undefined;
  if (!row) return res.status(404).json({ error: 'Feedback not found' });

  db.prepare('UPDATE feedback SET status = ? WHERE id = ?').run('resolved', req.params.id);
  createNotification(row.user_id, 'feedback_reply',
    'Response to your feedback',
    reply.trim()
  );

  return res.json({ ok: true });
});

router.get('/feedback', requireAdmin, (_req, res) => {
  const items = db.prepare(`
    SELECT f.*, u.username
    FROM feedback f
    LEFT JOIN users u ON f.user_id = u.id
    ORDER BY
      CASE f.status WHEN 'unread' THEN 0 ELSE 1 END,
      f.created_at DESC
  `).all();
  return res.json(items);
});

router.put('/feedback/:id', requireAdmin, (req, res) => {
  const { status, admin_note } = req.body;
  if (!['unread', 'read', 'resolved'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  const result = db.prepare(
    'UPDATE feedback SET status = ?, admin_note = ? WHERE id = ?'
  ).run(status, admin_note || null, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Feedback not found' });
  return res.json({ message: 'Feedback updated' });
});

export default router;
