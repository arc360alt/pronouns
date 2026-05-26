import { Router } from 'express';
import db from '../db';
import { requireAdmin } from '../middleware/auth';

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
  const { banned } = req.body;
  if (parseInt(req.params.id) === req.user!.id)
    return res.status(400).json({ error: 'Cannot ban yourself' });

  const result = db.prepare('UPDATE users SET is_banned = ? WHERE id = ?').run(banned ? 1 : 0, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
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

export default router;
