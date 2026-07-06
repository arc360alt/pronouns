import { Router } from 'express';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();
const COOLDOWN_SECONDS = 300; // 5 minutes

function getCooldownRemaining(userId: number): number {
  const row = db.prepare(
    'SELECT created_at FROM feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(userId) as { created_at: string } | undefined;
  if (!row) return 0;
  const elapsed = (Date.now() - new Date(row.created_at + 'Z').getTime()) / 1000;
  return Math.max(0, Math.ceil(COOLDOWN_SECONDS - elapsed));
}

router.get('/cooldown', requireAuth, (req, res) => {
  return res.json({ remaining: getCooldownRemaining(req.user!.id) });
});

router.post('/', requireAuth, (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || !message.trim())
    return res.status(400).json({ error: 'Message is required' });
  if (message.trim().length > 2000)
    return res.status(400).json({ error: 'Message must be 2000 characters or fewer' });

  const remaining = getCooldownRemaining(req.user!.id);
  if (remaining > 0)
    return res.status(429).json({ error: `Please wait ${remaining} seconds before sending another message.` });

  db.prepare('INSERT INTO feedback (user_id, message) VALUES (?, ?)').run(req.user!.id, message.trim());
  return res.json({ message: 'Feedback submitted' });
});

export default router;
