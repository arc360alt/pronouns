import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db';

interface JwtPayload {
  id: number;
  username: string;
  is_admin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const JWT_SECRET = () => process.env.JWT_SECRET || 'fallback-secret';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET()) as JwtPayload;
    const user = db.prepare('SELECT is_banned FROM users WHERE id = ?').get(decoded.id) as { is_banned: number } | undefined;
    if (!user || user.is_banned) return res.status(403).json({ error: 'Account suspended or not found' });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin access required' });
    next();
  });
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next();
  try {
    req.user = jwt.verify(token, JWT_SECRET()) as JwtPayload;
  } catch {
    // ignore invalid token for optional auth
  }
  next();
}
