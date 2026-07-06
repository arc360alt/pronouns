import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

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
