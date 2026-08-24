import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import db, { getFullProfile } from './db';

dotenv.config({ path: path.join(__dirname, '../.env') });

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import profileRoutes from './routes/profile';
import uploadRoutes from './routes/upload';
import reportRoutes from './routes/reports';
import adminRoutes from './routes/admin';
import feedbackRoutes from './routes/feedback';
import notificationRoutes from './routes/notifications';
import siteRoutes from './routes/site';
import sitebuildRoutes, { publicRouter as sitebuildPublic } from './routes/sitebuilder';
import dmRoutes from './routes/dm';
import slotsRoutes from './routes/slots';

const app = express();
const PORT = parseInt(process.env.PORT || '3012');

const ALLOWED_ORIGINS = new Set([
  'https://arc360hub.com',
  'https://www.arc360hub.com',
  'https://pronouns.sbs',
  'https://www.pronouns.sbs',
]);

app.use(cors({
  origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.has(origin)),
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/site', siteRoutes);
app.use('/api/sitebuilder', sitebuildRoutes);
app.use('/sites', sitebuildPublic);
app.use('/api/dm', dmRoutes);
app.use('/api/profile/slots', slotsRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// --- Bot / embed middleware ---
const BOT_UA_PATTERNS = ['discordbot', 'twitterbot', 'facebookexternalhit', 'slackbot', 'telegrambot', 'whatsapp', 'linkedinbot', 'mastodon', 'iframely', 'embedly', 'bingbot', 'googlebot', 'applebot', 'pinterest'];

function isBot(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BOT_UA_PATTERNS.some(p => lower.includes(p));
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1').replace(/\[(.+?)\]\(.+?\)/g, '$1').replace(/^[-*]\s/gm, '')
    .replace(/\n+/g, ' ').trim();
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function botHtml(title: string, desc: string, image: string | null, url: string): string {
  const t = esc(title), d = esc(desc.slice(0, 200)), u = esc(url);
  const img = image ? `\n  <meta property="og:image" content="${esc(image)}" />\n  <meta name="twitter:card" content="summary" />\n  <meta name="twitter:image" content="${esc(image)}" />` : '\n  <meta name="twitter:card" content="summary" />';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>${t}</title><meta name="description" content="${d}" /><meta property="og:site_name" content="pronouns" /><meta property="og:type" content="website" /><meta property="og:title" content="${t}" /><meta property="og:description" content="${d}" /><meta property="og:url" content="${u}" /><meta name="twitter:title" content="${t}" /><meta name="twitter:description" content="${d}" />${img}</head><body></body></html>`;
}

app.use((req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  if (!isBot(ua)) return next();

  const SITE = (process.env.SITE_URL || 'https://pronouns.sbs').replace(/\/$/, '');
  const profileMatch = req.path.match(/^\/@?([A-Za-z0-9_]+)$/);

  if (profileMatch) {
    const username = profileMatch[1];
    const row = db.prepare('SELECT id, is_banned FROM users WHERE username = ? COLLATE NOCASE').get(username) as { id: number; is_banned: number } | undefined;
    if (!row || row.is_banned) return next();

    const profile = getFullProfile(row.id) as unknown as { username: string; display_name: string | null; bio: string | null; profile_picture: string | null };
    const name = profile.display_name || `@${profile.username}`;
    const desc = profile.bio ? stripMarkdown(profile.bio) : `${name}'s pronouns profile`;
    const pic = profile.profile_picture
      ? (profile.profile_picture.startsWith('http') ? profile.profile_picture : `${SITE}${profile.profile_picture}`)
      : null;

    return res.send(botHtml(`${name} — pronouns`, desc, pic, `${SITE}/@${profile.username}`));
  }

  // Generic embed for non-profile pages
  return res.send(botHtml('pronouns', 'Your new favorite pronouns sharing app!', null, `${SITE}${req.path}`));
});

const clientBuildDir = path.join(__dirname, '../../client/build');
if (fs.existsSync(clientBuildDir)) {
  app.use(express.static(clientBuildDir));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/uploads/')) {
      res.sendFile(path.join(clientBuildDir, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

export default app;
