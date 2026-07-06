import { Router } from 'express';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/', requireAuth, (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || !message.trim())
    return res.status(400).json({ error: 'Message is required' });
  if (message.trim().length > 2000)
    return res.status(400).json({ error: 'Message must be 2000 characters or fewer' });

  db.prepare('INSERT INTO feedback (user_id, message) VALUES (?, ?)').run(req.user!.id, message.trim());
  return res.json({ message: 'Feedback submitted' });
});

export default router;
