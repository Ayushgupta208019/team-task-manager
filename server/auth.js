import jwt from 'jsonwebtoken';
import { db } from './db.js';

const secret = process.env.JWT_SECRET || 'dev-secret-change-me';

export function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '7d' });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, secret);
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(payload.id);

    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

export function getMembership(projectId, userId) {
  return db.prepare(`
    SELECT project_id AS projectId, user_id AS userId, role
    FROM project_members
    WHERE project_id = ? AND user_id = ?
  `).get(projectId, userId);
}

export function requireProjectMember(req, res, next) {
  const projectId = Number(req.params.projectId);
  const membership = getMembership(projectId, req.user.id);

  if (!membership) {
    return res.status(403).json({ message: 'You are not a member of this project.' });
  }

  req.projectId = projectId;
  req.membership = membership;
  next();
}

export function requireProjectAdmin(req, res, next) {
  const projectId = Number(req.params.projectId);
  const membership = getMembership(projectId, req.user.id);

  if (!membership || membership.role !== 'Admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }

  req.projectId = projectId;
  req.membership = membership;
  next();
}
