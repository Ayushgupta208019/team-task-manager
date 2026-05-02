# Team Task Manager

Team Task Manager is a full-stack collaborative task management web application. It allows users to create projects, manage project members, assign tasks, update task progress, and view dashboard analytics.

The project is built as a simplified professional dashboard inspired by tools like Trello, Asana, and Jira.

## Live Demo

 Deployment:

```text
https://team-task-manager-hg5w.onrender.com/
```

Demo admin account:

```text
Email: admin@taskflow.test
Password: password123
```

Demo member account:

```text
Email: maya@taskflow.test
Password: password123
```

## Features

- User signup and login
- JWT-based authentication
- Secure password hashing with bcrypt
- Create and view projects
- Project creator automatically becomes Admin
- Admin can add members from registered users list
- Admin can remove project members
- Admin can create, edit, assign, and delete tasks
- Members can view and update assigned tasks
- Role-based access control for Admin and Member users
- Task status tracking: To Do, In Progress, Done
- Task priority tracking: Low, Medium, High, Critical
- Dashboard analytics:
  - Total tasks
  - Tasks by status
  - Tasks per user
  - Overdue tasks
- Responsive professional dashboard UI
- RESTful API backend
- SQLite database with proper relationships
- Demo data auto-seeding when the database is empty

## Tech Stack

Frontend:

- React
- Vite
- CSS
- Lucide React icons

Backend:

- Node.js
- Express.js
- SQLite
- better-sqlite3
- JWT
- bcryptjs

Deployment:

- Render or Railway

## Project Structure

```text
team-task-manager/
  server/
    auth.js
    db.js
    demoData.js
    index.js
    seed.js
  src/
    main.jsx
    styles.css
  .env.example
  index.html
  package.json
  vite.config.js
  README.md
```

## Run Locally

Install dependencies:

```bash
npm install
```

Seed demo data:

```bash
npm run seed
```

Start the full-stack development app:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

If port `5173` is already busy, Vite may start on another port such as:

```text
http://127.0.0.1:5174/
```

## Environment Variables

Create a `.env` file for local production-style runs:

```env
PORT=4200
JWT_SECRET=change-this-secret-before-deployment
CLIENT_ORIGIN=http://127.0.0.1:5173
```

For deployment, set:

```env
JWT_SECRET=your_secure_secret_key
CLIENT_ORIGIN=https://your-deployed-url.com
```

Do not set `PORT` on Render or Railway. The platform provides it automatically.

## Build

Create a production build:

```bash
npm run build
```

Start production server:

```bash
npm start
```

The Express server serves both:

- React frontend from `dist/`
- Backend API from `/api`

## API Endpoints

Authentication:

```text
POST /api/auth/signup
POST /api/auth/login
GET  /api/me
```

Users:

```text
GET /api/users
```

Projects:

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
POST   /api/projects/:projectId/members
DELETE /api/projects/:projectId/members/:userId
```

Tasks:

```text
GET    /api/projects/:projectId/tasks
POST   /api/projects/:projectId/tasks
PATCH  /api/tasks/:taskId
DELETE /api/tasks/:taskId
```

Dashboard:

```text
GET /api/dashboard
```

Health check:

```text
GET /api/health
```

## Database Design

Main tables:

- `users`
- `projects`
- `project_members`
- `tasks`

Relationships:

- One user can create many projects
- One project can have many members
- One user can belong to many projects
- One project can have many tasks
- One task can be assigned to one user
- Project members have a role: Admin or Member

## Role-Based Access

Admin can:

- Create tasks
- Edit tasks
- Delete tasks
- Assign tasks
- Add members
- Remove members
- View all project tasks

Member can:

- View assigned project tasks
- Update status of assigned tasks

## Render Deployment

Create a new Render Web Service from GitHub.

Use these settings:

```text
Build Command: npm install && npm run build
Start Command: npm start
```

Environment variables:

```env
JWT_SECRET=your_secure_secret_key
CLIENT_ORIGIN=https://your-render-url.onrender.com
```

After deploy, test:

```text
https://your-render-url.onrender.com/api/health
```

Expected response:

```json
{
  "ok": true
}
```

## Railway Deployment

Use these settings:

```text
Build Command: npm install && npm run build
Start Command: npm start
```

Environment variables:

```env
JWT_SECRET=your_secure_secret_key
CLIENT_ORIGIN=https://your-generated-railway-domain.up.railway.app
```

Use the generated Railway service domain from Public Networking.

## Notes

- SQLite is suitable for this assignment/demo project.
- For a production application, PostgreSQL with persistent hosting is recommended.
- Demo data is automatically inserted only when the database is empty.
- Existing deployed data is not deleted by auto-seeding.
