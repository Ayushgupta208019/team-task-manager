import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, migrate } from './db.js';
import { requireAuth, requireProjectAdmin, requireProjectMember, signToken, getMembership } from './auth.js';

migrate();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '..', 'dist');

const app = express();
const port = process.env.PORT || 4200;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173' }));
app.use(express.json());

const okStatuses = ['To Do', 'In Progress', 'Done'];
const okPriorities = ['Low', 'Medium', 'High', 'Critical'];

function cleanString(value) {
  return String(value || '').trim();
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function validateTask(body, partial = false) {
  const errors = [];
  const title = cleanString(body.title);
  const dueDate = cleanString(body.dueDate);
  const priority = cleanString(body.priority);
  const status = cleanString(body.status);

  if (!partial || title) {
    if (title.length < 3) errors.push('Task title must be at least 3 characters.');
  }
  if (!partial || dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) errors.push('Due date must use YYYY-MM-DD.');
  }
  if (!partial || priority) {
    if (!okPriorities.includes(priority)) errors.push('Priority is invalid.');
  }
  if (status && !okStatuses.includes(status)) errors.push('Status is invalid.');

  return errors;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/signup', async (req, res) => {
  const name = cleanString(req.body.name);
  const email = cleanString(req.body.email).toLowerCase();
  const password = String(req.body.password || '');

  if (name.length < 2 || !email.includes('@') || password.length < 8) {
    return res.status(400).json({ message: 'Name, valid email, and 8+ character password are required.' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ message: 'Email is already registered.' });

  const passwordHash = await bcrypt.hash(password, 12);
  const info = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, passwordHash);
  const user = { id: info.lastInsertRowid, name, email };

  res.status(201).json({ user, token: signToken(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const email = cleanString(req.body.email).toLowerCase();
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  res.json({ user: publicUser(user), token: signToken(user) });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/users', requireAuth, (req, res) => {
  const users = db.prepare('SELECT id, name, email FROM users ORDER BY name').all();
  res.json({ users });
});

app.get('/api/projects', requireAuth, (req, res) => {
  const projects = db.prepare(`
    SELECT p.id, p.name, p.description, pm.role,
      COUNT(DISTINCT m.user_id) AS memberCount,
      COUNT(DISTINCT t.id) AS taskCount,
      SUM(CASE WHEN t.status = 'Done' THEN 1 ELSE 0 END) AS doneCount
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
    LEFT JOIN project_members m ON m.project_id = p.id
    LEFT JOIN tasks t ON t.project_id = p.id
    GROUP BY p.id, pm.role
    ORDER BY p.created_at DESC
  `).all(req.user.id);

  res.json({ projects });
});

app.post('/api/projects', requireAuth, (req, res) => {
  const name = cleanString(req.body.name);
  const description = cleanString(req.body.description);

  if (name.length < 3) {
    return res.status(400).json({ message: 'Project name must be at least 3 characters.' });
  }

  const createProject = db.transaction(() => {
    const info = db.prepare('INSERT INTO projects (name, description, created_by) VALUES (?, ?, ?)').run(name, description, req.user.id);
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(info.lastInsertRowid, req.user.id, 'Admin');
    return info.lastInsertRowid;
  });

  res.status(201).json({ projectId: createProject() });
});

app.get('/api/projects/:projectId', requireAuth, requireProjectMember, (req, res) => {
  const project = db.prepare('SELECT id, name, description, created_by AS createdBy FROM projects WHERE id = ?').get(req.projectId);
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, pm.role
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ?
    ORDER BY pm.role, u.name
  `).all(req.projectId);

  res.json({ project, members, role: req.membership.role });
});

app.post('/api/projects/:projectId/members', requireAuth, requireProjectAdmin, (req, res) => {
  const email = cleanString(req.body.email).toLowerCase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

  if (!user) return res.status(404).json({ message: 'No user found with that email.' });

  db.prepare(`
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (?, ?, 'Member')
    ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role
  `).run(req.projectId, user.id);

  res.status(201).json({ message: 'Member added.' });
});

app.delete('/api/projects/:projectId/members/:userId', requireAuth, requireProjectAdmin, (req, res) => {
  const userId = Number(req.params.userId);

  if (userId === req.user.id) {
    return res.status(400).json({ message: 'Admins cannot remove themselves.' });
  }

  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(req.projectId, userId);
  db.prepare('UPDATE tasks SET assigned_to = NULL WHERE project_id = ? AND assigned_to = ?').run(req.projectId, userId);
  res.json({ message: 'Member removed.' });
});

app.get('/api/projects/:projectId/tasks', requireAuth, requireProjectMember, (req, res) => {
  const where = req.membership.role === 'Admin' ? 't.project_id = ?' : 't.project_id = ? AND t.assigned_to = ?';
  const params = req.membership.role === 'Admin' ? [req.projectId] : [req.projectId, req.user.id];
  const tasks = db.prepare(`
    SELECT t.id, t.project_id AS projectId, t.title, t.description, t.due_date AS dueDate,
      t.priority, t.status, t.assigned_to AS assignedTo, u.name AS assigneeName
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE ${where}
    ORDER BY t.due_date ASC, t.priority DESC
  `).all(...params);

  res.json({ tasks });
});

app.post('/api/projects/:projectId/tasks', requireAuth, requireProjectAdmin, (req, res) => {
  const errors = validateTask(req.body);
  if (errors.length) return res.status(400).json({ message: errors[0] });

  const assignedTo = req.body.assignedTo ? Number(req.body.assignedTo) : null;
  if (assignedTo && !getMembership(req.projectId, assignedTo)) {
    return res.status(400).json({ message: 'Assignee must be a project member.' });
  }

  const info = db.prepare(`
    INSERT INTO tasks (project_id, title, description, due_date, priority, status, assigned_to, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.projectId,
    cleanString(req.body.title),
    cleanString(req.body.description),
    cleanString(req.body.dueDate),
    cleanString(req.body.priority),
    cleanString(req.body.status) || 'To Do',
    assignedTo,
    req.user.id
  );

  res.status(201).json({ taskId: info.lastInsertRowid });
});

app.patch('/api/tasks/:taskId', requireAuth, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(req.params.taskId));
  if (!task) return res.status(404).json({ message: 'Task not found.' });

  const membership = getMembership(task.project_id, req.user.id);
  if (!membership) return res.status(403).json({ message: 'You are not a project member.' });

  if (membership.role !== 'Admin' && task.assigned_to !== req.user.id) {
    return res.status(403).json({ message: 'Members can only update assigned tasks.' });
  }

  if (membership.role !== 'Admin') {
    const status = cleanString(req.body.status);
    if (!okStatuses.includes(status)) return res.status(400).json({ message: 'Members may only update status.' });
    db.prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, task.id);
    return res.json({ message: 'Task updated.' });
  }

  const errors = validateTask({ ...task, ...req.body }, true);
  if (errors.length) return res.status(400).json({ message: errors[0] });

  const next = {
    title: req.body.title !== undefined ? cleanString(req.body.title) : task.title,
    description: req.body.description !== undefined ? cleanString(req.body.description) : task.description,
    dueDate: req.body.dueDate !== undefined ? cleanString(req.body.dueDate) : task.due_date,
    priority: req.body.priority !== undefined ? cleanString(req.body.priority) : task.priority,
    status: req.body.status !== undefined ? cleanString(req.body.status) : task.status,
    assignedTo: req.body.assignedTo !== undefined ? Number(req.body.assignedTo) || null : task.assigned_to
  };

  if (next.assignedTo && !getMembership(task.project_id, next.assignedTo)) {
    return res.status(400).json({ message: 'Assignee must be a project member.' });
  }

  db.prepare(`
    UPDATE tasks
    SET title = ?, description = ?, due_date = ?, priority = ?, status = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(next.title, next.description, next.dueDate, next.priority, next.status, next.assignedTo, task.id);

  res.json({ message: 'Task updated.' });
});

app.delete('/api/tasks/:taskId', requireAuth, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(req.params.taskId));
  if (!task) return res.status(404).json({ message: 'Task not found.' });

  const membership = getMembership(task.project_id, req.user.id);
  if (!membership || membership.role !== 'Admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
  res.json({ message: 'Task deleted.' });
});

app.get('/api/dashboard', requireAuth, (req, res) => {
  const visibilityJoin = `
    JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = @userId
  `;
  const visibilityWhere = `
    AND (pm.role = 'Admin' OR t.assigned_to = @userId)
  `;

  const totals = db.prepare(`
    SELECT
      COUNT(*) AS totalTasks,
      SUM(CASE WHEN t.status = 'To Do' THEN 1 ELSE 0 END) AS todo,
      SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END) AS inProgress,
      SUM(CASE WHEN t.status = 'Done' THEN 1 ELSE 0 END) AS done,
      SUM(CASE WHEN date(t.due_date) < date('now') AND t.status != 'Done' THEN 1 ELSE 0 END) AS overdue
    FROM tasks t
    ${visibilityJoin}
    WHERE 1 = 1 ${visibilityWhere}
  `).get({ userId: req.user.id });

  const perUser = db.prepare(`
    SELECT COALESCE(u.name, 'Unassigned') AS name, COUNT(*) AS count
    FROM tasks t
    ${visibilityJoin}
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE 1 = 1 ${visibilityWhere}
    GROUP BY COALESCE(u.name, 'Unassigned')
    ORDER BY count DESC
  `).all({ userId: req.user.id });

  const overdueTasks = db.prepare(`
    SELECT t.id, t.title, t.due_date AS dueDate, t.priority, p.name AS projectName, u.name AS assigneeName
    FROM tasks t
    ${visibilityJoin}
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE date(t.due_date) < date('now') AND t.status != 'Done' ${visibilityWhere}
    ORDER BY date(t.due_date) ASC
    LIMIT 8
  `).all({ userId: req.user.id });

  res.json({ totals, perUser, overdueTasks });
});
app.use(express.static(clientDist));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong.' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`API listening on port ${port}`);
});
