import bcrypt from 'bcryptjs';
import { db, migrate } from './db.js';

migrate();

const passwordHash = await bcrypt.hash('password123', 12);

const reset = db.transaction(() => {
  db.exec(`
    DELETE FROM tasks;
    DELETE FROM project_members;
    DELETE FROM projects;
    DELETE FROM users;
    DELETE FROM sqlite_sequence WHERE name IN ('users', 'projects', 'tasks');
  `);

  const addUser = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
  const admin = addUser.run('Aarav Sharma', 'admin@taskflow.test', passwordHash).lastInsertRowid;
  const maya = addUser.run('Maya Singh', 'maya@taskflow.test', passwordHash).lastInsertRowid;
  const dev = addUser.run('Dev Mehta', 'dev@taskflow.test', passwordHash).lastInsertRowid;
  const nina = addUser.run('Nina Rao', 'nina@taskflow.test', passwordHash).lastInsertRowid;

  const projectStmt = db.prepare('INSERT INTO projects (name, description, created_by) VALUES (?, ?, ?)');
  const sprint = projectStmt.run('Product Launch Sprint', 'Coordinate roadmap, release, QA, and customer-facing launch tasks.', admin).lastInsertRowid;
  const growth = projectStmt.run('Growth Experiments', 'Prioritize marketing experiments and landing-page work for the next cycle.', admin).lastInsertRowid;

  const memberStmt = db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)');
  for (const uid of [admin, maya, dev, nina]) memberStmt.run(sprint, uid, uid === admin ? 'Admin' : 'Member');
  for (const uid of [admin, maya, dev]) memberStmt.run(growth, uid, uid === admin ? 'Admin' : 'Member');

  const taskStmt = db.prepare(`
    INSERT INTO tasks (project_id, title, description, due_date, priority, status, assigned_to, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  taskStmt.run(sprint, 'Finalize onboarding flow', 'Polish signup states and empty dashboards.', '2026-05-08', 'High', 'In Progress', maya, admin);
  taskStmt.run(sprint, 'Prepare release QA checklist', 'Cover auth, role checks, task filters, and dashboard numbers.', '2026-05-04', 'Critical', 'To Do', dev, admin);
  taskStmt.run(sprint, 'Write launch notes', 'Summarize value proposition and rollout details for internal teams.', '2026-04-28', 'Medium', 'To Do', nina, admin);
  taskStmt.run(sprint, 'Ship project member controls', 'Add member invite and remove flows with clear permissions.', '2026-05-10', 'High', 'Done', admin, admin);
  taskStmt.run(growth, 'Draft A/B test backlog', 'Collect candidate experiments and expected outcomes.', '2026-05-12', 'Medium', 'To Do', maya, admin);
  taskStmt.run(growth, 'Instrument conversion dashboard', 'Add funnel events and baseline reporting.', '2026-04-25', 'High', 'In Progress', dev, admin);
});

reset();
console.log('Seeded demo data.');
