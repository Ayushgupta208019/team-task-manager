# Team Task Manager

A full-stack team task management web application with authentication, projects, role-based access, assigned tasks, status tracking, and dashboard analytics.

## Tech Stack

- React + Vite frontend
- Express REST API
- SQLite database
- JWT authentication
- bcrypt password hashing

## Run Locally

```bash
npm install
npm run seed
npm run dev
```

Open `http://127.0.0.1:5173`.

Demo login:

- Admin: `admin@taskflow.test` / `password123`
- Member: `maya@taskflow.test` / `password123`

## API Overview

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/projects`
- `POST /api/projects`
- `POST /api/projects/:projectId/members`
- `DELETE /api/projects/:projectId/members/:userId`
- `GET /api/projects/:projectId/tasks`
- `POST /api/projects/:projectId/tasks`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`
- `GET /api/dashboard`
