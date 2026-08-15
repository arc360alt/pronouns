import { Router } from 'express';
import db, { getFullProfile, BADGE_DEFS } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const profile = getFullProfile(req.user!.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  return res.json({ user_id: req.user!.id, ...profile });
});

router.put('/', requireAuth, (req, res) => {
  const { display_name, bio, gender, pronouns, custom_color, custom_color_2, custom_color_dir,
          show_friends, location, occupation, birthday, website, timezone,
          banner_height, avatar_size, show_site, forced_theme, content_align } = req.body;
  const clamp = (v: unknown, min: number, max: number, def: number) => {
    const n = parseInt(v as string);
    return isNaN(n) ? def : Math.min(max, Math.max(min, n));
  };
  const allowedThemes = ['dark', 'light'];
  const theme = allowedThemes.includes(forced_theme) ? forced_theme : null;
  const align = ['left', 'center', 'default'].includes(content_align) ? content_align : 'default';
  db.prepare(`
    UPDATE profiles SET
      display_name = ?, bio = ?, gender = ?, pronouns = ?,
      custom_color = ?, custom_color_2 = ?, custom_color_dir = ?,
      show_friends = ?,
      location = ?, occupation = ?, birthday = ?, website = ?, timezone = ?,
      banner_height = ?, avatar_size = ?, show_site = ?, forced_theme = ?,
      content_align = ?
    WHERE user_id = ?
  `).run(
    display_name || null, bio || null, gender || null, pronouns || null,
    custom_color || null, custom_color_2 || null, custom_color_dir || '135deg',
    show_friends ? 1 : 0,
    location || null, occupation || null, birthday || null, website || null, timezone || null,
    clamp(banner_height, 100, 400, 240), clamp(avatar_size, 60, 180, 120),
    show_site ? 1 : 0, theme,
    align,
    req.user!.id
  );
  return res.json({ message: 'Profile updated' });
});

router.put('/section-order', requireAuth, (req, res) => {
  const { section_order } = req.body;
  if (typeof section_order !== 'string') return res.status(400).json({ error: 'section_order must be a string' });
  db.prepare('UPDATE profiles SET section_order = ? WHERE user_id = ?').run(section_order, req.user!.id);
  return res.json({ ok: true });
});

router.put('/section-labels', requireAuth, (req, res) => {
  const { section_labels } = req.body;
  if (typeof section_labels !== 'object' || section_labels === null) return res.status(400).json({ error: 'Invalid section_labels' });
  const allowed = ['info', 'bio', 'names', 'flags', 'images', 'links', 'clock', 'friends'];
  const sanitized: Record<string, string> = {};
  for (const key of allowed) {
    if (typeof section_labels[key] === 'string') {
      sanitized[key] = section_labels[key].slice(0, 64).trim();
    }
  }
  db.prepare('UPDATE profiles SET section_labels = ? WHERE user_id = ?').run(JSON.stringify(sanitized), req.user!.id);
  return res.json({ ok: true });
});

router.put('/background', requireAuth, (req, res) => {
  const { profile_bg, profile_bg_type, profile_bg_brightness, hide_banner_with_bg, section_blur, section_blur_amount, section_bg_color, section_bg_opacity } = req.body;
  const allowed = ['none', 'color', 'gradient', 'image', 'video', 'youtube'];
  const type = allowed.includes(profile_bg_type) ? profile_bg_type : 'none';
  const brightness = typeof profile_bg_brightness === 'number'
    ? Math.min(1, Math.max(0, profile_bg_brightness))
    : 0.5;
  const blur = section_blur ? 1 : 0;
  const blurAmount = typeof section_blur_amount === 'number'
    ? Math.min(40, Math.max(0, section_blur_amount))
    : 8;
  const bgColor = typeof section_bg_color === 'string' && /^#[0-9a-fA-F]{6}$/.test(section_bg_color.trim())
    ? section_bg_color.trim()
    : null;
  const bgOpacity = typeof section_bg_opacity === 'number'
    ? Math.min(100, Math.max(0, section_bg_opacity))
    : null;
  db.prepare('UPDATE profiles SET profile_bg = ?, profile_bg_type = ?, profile_bg_brightness = ?, hide_banner_with_bg = ?, section_blur = ?, section_blur_amount = ?, section_bg_color = ?, section_bg_opacity = ? WHERE user_id = ?')
    .run(profile_bg || null, type, brightness, hide_banner_with_bg ? 1 : 0, blur, blurAmount, bgColor, bgOpacity, req.user!.id);
  return res.json({ ok: true });
});

router.put('/picture', requireAuth, (req, res) => {
  const { url } = req.body;
  db.prepare('UPDATE profiles SET profile_picture = ? WHERE user_id = ?').run(url || null, req.user!.id);
  return res.json({ message: 'Profile picture updated' });
});

router.put('/banner', requireAuth, (req, res) => {
  const { url, position } = req.body;
  db.prepare('UPDATE profiles SET banner = ?, banner_position = ? WHERE user_id = ?')
    .run(url || null, position || '50% 50%', req.user!.id);
  return res.json({ message: 'Banner updated' });
});

router.post('/names', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  const row = db.prepare('SELECT MAX(sort_order) as m FROM profile_names WHERE user_id = ?').get(req.user!.id) as { m: number | null };
  const nextOrder = (row.m ?? -1) + 1;
  const result = db.prepare(
    'INSERT INTO profile_names (user_id, name, sort_order) VALUES (?, ?, ?)'
  ).run(req.user!.id, name.trim(), nextOrder);

  return res.status(201).json({ id: result.lastInsertRowid, name: name.trim(), sort_order: nextOrder });
});

router.put('/names/:id', requireAuth, (req, res) => {
  const { preference } = req.body;
  const allowed = [null, 'favorite', 'okay'];
  if (!allowed.includes(preference ?? null)) return res.status(400).json({ error: 'Invalid preference' });
  db.prepare('UPDATE profile_names SET preference = ? WHERE id = ? AND user_id = ?').run(preference ?? null, req.params.id, req.user!.id);
  return res.json({ preference: preference ?? null });
});

router.delete('/names/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM profile_names WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Name not found' });
  return res.json({ message: 'Name removed' });
});

router.post('/flags', requireAuth, (req, res) => {
  const { flag_name, flag_image } = req.body;
  if (!flag_name?.trim() || !flag_image) return res.status(400).json({ error: 'Flag name and image are required' });

  const row = db.prepare('SELECT MAX(sort_order) as m FROM profile_flags WHERE user_id = ?').get(req.user!.id) as { m: number | null };
  const nextOrder = (row.m ?? -1) + 1;
  const result = db.prepare(
    'INSERT INTO profile_flags (user_id, flag_name, flag_image, sort_order) VALUES (?, ?, ?, ?)'
  ).run(req.user!.id, flag_name.trim(), flag_image, nextOrder);

  return res.status(201).json({ id: result.lastInsertRowid, flag_name: flag_name.trim(), flag_image, sort_order: nextOrder });
});

router.delete('/flags/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM profile_flags WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Flag not found' });
  return res.json({ message: 'Flag removed' });
});

router.post('/images', requireAuth, (req, res) => {
  const { image_url, caption } = req.body;
  if (!image_url) return res.status(400).json({ error: 'Image URL is required' });

  const row = db.prepare('SELECT MAX(sort_order) as m FROM profile_images WHERE user_id = ?').get(req.user!.id) as { m: number | null };
  const nextOrder = (row.m ?? -1) + 1;
  const result = db.prepare(
    'INSERT INTO profile_images (user_id, image_url, caption, sort_order) VALUES (?, ?, ?, ?)'
  ).run(req.user!.id, image_url, caption || null, nextOrder);

  return res.status(201).json({ id: result.lastInsertRowid, image_url, caption: caption || null, sort_order: nextOrder });
});

router.delete('/images/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM profile_images WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Image not found' });
  return res.json({ message: 'Image removed' });
});

router.post('/friends', requireAuth, (req, res) => {
  const { friend_username } = req.body;
  if (!friend_username?.trim()) return res.status(400).json({ error: 'Name is required' });
  const friend_username_clean = friend_username.trim().replace(/^@/, '');
  try {
    const result = db.prepare(
      'INSERT INTO friends (user_id, friend_username) VALUES (?, ?)'
    ).run(req.user!.id, friend_username_clean);
    return res.status(201).json({ id: result.lastInsertRowid, friend_username: friend_username_clean });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE constraint')) return res.status(409).json({ error: 'Already in list' });
    return res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/friends/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM friends WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Friend not found' });
  return res.json({ message: 'Friend removed' });
});

// --- Links ---
router.post('/links', requireAuth, (req, res) => {
  const { link_label, link_url, link_icon, link_icon_mode, link_icon_size } = req.body;
  if (!link_label?.trim() || !link_url?.trim()) return res.status(400).json({ error: 'Label and URL are required' });
  const allowedModes = ['text', 'icon', 'both'];
  const mode = allowedModes.includes(link_icon_mode) ? link_icon_mode : 'text';
  const icon = typeof link_icon === 'string' && link_icon.trim() ? link_icon.trim() : null;
  const size = typeof link_icon_size === 'number' && link_icon_size >= 0.5 && link_icon_size <= 6 ? link_icon_size : 1.5;
  const row = db.prepare('SELECT MAX(sort_order) as m FROM profile_links WHERE user_id = ?').get(req.user!.id) as { m: number | null };
  const nextOrder = (row.m ?? -1) + 1;
  const result = db.prepare(
    'INSERT INTO profile_links (user_id, link_label, link_url, sort_order, link_icon, link_icon_mode, link_icon_size) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user!.id, link_label.trim(), link_url.trim(), nextOrder, icon, mode, size);
  return res.status(201).json({ id: result.lastInsertRowid, link_label: link_label.trim(), link_url: link_url.trim(), sort_order: nextOrder, link_icon: icon, link_icon_mode: mode, link_icon_size: size });
});

router.put('/links/:id', requireAuth, (req, res) => {
  const { link_icon, link_icon_mode, link_icon_size } = req.body;
  const allowedModes = ['text', 'icon', 'both'];
  const updates: string[] = [];
  const params: unknown[] = [];
  if (link_icon_mode !== undefined) {
    updates.push('link_icon_mode = ?');
    params.push(allowedModes.includes(link_icon_mode) ? link_icon_mode : 'text');
  }
  if (link_icon !== undefined) {
    updates.push('link_icon = ?');
    params.push(typeof link_icon === 'string' && link_icon.trim() ? link_icon.trim() : null);
  }
  if (link_icon_size !== undefined) {
    updates.push('link_icon_size = ?');
    params.push(typeof link_icon_size === 'number' && link_icon_size >= 0.5 && link_icon_size <= 6 ? link_icon_size : 1.5);
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
  params.push(req.params.id, req.user!.id);
  const result = db.prepare(`UPDATE profile_links SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);
  if (result.changes === 0) return res.status(404).json({ error: 'Link not found' });
  return res.json({ message: 'Updated' });
});

router.delete('/links/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM profile_links WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Link not found' });
  return res.json({ message: 'Link removed' });
});

// --- Custom fields ---
router.post('/fields', requireAuth, (req, res) => {
  const { field_name } = req.body;
  if (!field_name?.trim()) return res.status(400).json({ error: 'Field name is required' });
  const row = db.prepare('SELECT MAX(sort_order) as m FROM custom_fields WHERE user_id = ?').get(req.user!.id) as { m: number | null };
  const nextOrder = (row.m ?? -1) + 1;
  const result = db.prepare(
    'INSERT INTO custom_fields (user_id, field_name, sort_order) VALUES (?, ?, ?)'
  ).run(req.user!.id, field_name.trim(), nextOrder);
  return res.status(201).json({ id: result.lastInsertRowid, field_name: field_name.trim(), sort_order: nextOrder, entries: [] });
});

router.put('/fields/:id', requireAuth, (req, res) => {
  const { field_name } = req.body;
  if (!field_name?.trim()) return res.status(400).json({ error: 'Field name is required' });
  const result = db.prepare('UPDATE custom_fields SET field_name = ? WHERE id = ? AND user_id = ?').run(field_name.trim(), req.params.id, req.user!.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Field not found' });
  return res.json({ message: 'Field renamed' });
});

router.delete('/fields/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM custom_fields WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Field not found' });
  return res.json({ message: 'Field deleted' });
});

router.post('/fields/:fieldId/entries', requireAuth, (req, res) => {
  const { value, entry_status } = req.body;
  if (!value?.trim()) return res.status(400).json({ error: 'Value is required' });
  const field = db.prepare('SELECT id FROM custom_fields WHERE id = ? AND user_id = ?').get(req.params.fieldId, req.user!.id);
  if (!field) return res.status(404).json({ error: 'Field not found' });
  const row = db.prepare('SELECT MAX(sort_order) as m FROM custom_field_entries WHERE field_id = ?').get(req.params.fieldId) as { m: number | null };
  const nextOrder = (row.m ?? -1) + 1;
  const result = db.prepare(
    'INSERT INTO custom_field_entries (field_id, user_id, value, entry_status, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.fieldId, req.user!.id, value.trim(), entry_status?.trim() || null, nextOrder);
  return res.status(201).json({ id: result.lastInsertRowid, value: value.trim(), entry_status: entry_status?.trim() || null, preference: null, sort_order: nextOrder });
});

router.put('/fields/:fieldId/entries/:entryId', requireAuth, (req, res) => {
  const { value, entry_status, preference } = req.body;
  if (value !== undefined) {
    if (!value?.trim()) return res.status(400).json({ error: 'Value is required' });
    const result = db.prepare(
      'UPDATE custom_field_entries SET value = ?, entry_status = ? WHERE id = ? AND user_id = ?'
    ).run(value.trim(), entry_status?.trim() || null, req.params.entryId, req.user!.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Entry not found' });
  }
  if (preference !== undefined) {
    const allowed = [null, 'favorite', 'okay'];
    if (!allowed.includes(preference ?? null)) return res.status(400).json({ error: 'Invalid preference' });
    db.prepare('UPDATE custom_field_entries SET preference = ? WHERE id = ? AND user_id = ?').run(preference ?? null, req.params.entryId, req.user!.id);
  }
  return res.json({ message: 'Entry updated' });
});

router.delete('/fields/:fieldId/entries/:entryId', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM custom_field_entries WHERE id = ? AND user_id = ?').run(req.params.entryId, req.user!.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Entry not found' });
  return res.json({ message: 'Entry removed' });
});

// --- Badges ---
router.put('/badges/:badgeId/visibility', requireAuth, (req, res) => {
  const { badgeId } = req.params;
  const { visible } = req.body;
  if (!BADGE_DEFS.some(d => d.id === badgeId)) return res.status(404).json({ error: 'Badge not found' });
  db.prepare(`
    INSERT INTO user_badges (user_id, badge_id, visible, sort_order)
    VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM user_badges WHERE user_id = ?))
    ON CONFLICT(user_id, badge_id) DO UPDATE SET visible = excluded.visible
  `).run(req.user!.id, badgeId, visible ? 1 : 0, req.user!.id);
  return res.json({ ok: true });
});

router.put('/badges/order', requireAuth, (req, res) => {
  const { order } = req.body as { order: string[] };
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });
  const stmt = db.prepare(`
    INSERT INTO user_badges (user_id, badge_id, sort_order)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, badge_id) DO UPDATE SET sort_order = excluded.sort_order
  `);
  const tx = db.transaction(() => {
    order.forEach((badgeId, i) => {
      if (BADGE_DEFS.some(d => d.id === badgeId)) stmt.run(req.user!.id, badgeId, i);
    });
  });
  tx();
  return res.json({ ok: true });
});

export default router;
