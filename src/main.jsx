import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  LogOut,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  UserPlus,
  Users
} from 'lucide-react';
import './styles.css';

const API = import.meta.env.VITE_API_URL || '/api';
const statuses = ['To Do', 'In Progress', 'Done'];
const priorities = ['Low', 'Medium', 'High', 'Critical'];

function useApi() {
  const [token, setToken] = useState(localStorage.getItem('taskflow-token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('taskflow-user') || 'null'));

  const request = async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Request failed');
    return data;
  };

  const setSession = (session) => {
    setToken(session.token);
    setUser(session.user);
    localStorage.setItem('taskflow-token', session.token);
    localStorage.setItem('taskflow-user', JSON.stringify(session.user));
  };

  const logout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('taskflow-token');
    localStorage.removeItem('taskflow-user');
  };

  return { token, user, request, setSession, logout };
}

function AuthScreen({ api }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: 'admin@taskflow.test', password: 'password123' });
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : form;
      const session = await api.request(`/auth/${mode === 'login' ? 'login' : 'signup'}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      api.setSession(session);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-mark"><ClipboardList size={28} /> TaskFlow</div>
        <h1>Run every team project from one polished command center.</h1>
        <p>Plan work, assign ownership, monitor overdue tasks, and keep project roles crisp.</p>
        <div className="auth-stats">
          <span><Shield size={18} /> JWT auth</span>
          <span><BarChart3 size={18} /> Live dashboard</span>
          <span><Users size={18} /> Role access</span>
        </div>
      </section>

      <form className="login-card" onSubmit={submit}>
        <div>
          <p className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Create account'}</p>
          <h2>{mode === 'login' ? 'Sign in to your workspace' : 'Start a new workspace'}</h2>
        </div>

        {mode === 'signup' && (
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        )}
        <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {error && <div className="error">{error}</div>}
        <button className="primary-btn" type="submit">{mode === 'login' ? 'Login' : 'Signup'} <ChevronRight size={18} /></button>
        <button className="ghost-btn" type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Need an account?' : 'Already registered?'}
        </button>
      </form>
    </main>
  );
}

function StatCard({ icon, label, value, tone }) {
  return <article className={`stat-card ${tone || ''}`}>{icon}<span>{label}</span><strong>{value || 0}</strong></article>;
}

function ProjectModal({ api, onClose, onDone }) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    try {
      await api.request('/projects', { method: 'POST', body: JSON.stringify(form) });
      onDone();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <h3>Create project</h3>
        <label>Project name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="ghost-btn" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-btn" type="submit">Create</button>
        </div>
      </form>
    </div>
  );
}

function TaskModal({ api, project, members = [], task, onClose, onDone }) {
  const [form, setForm] = useState(task || {
    title: '',
    description: '',
    dueDate: new Date().toISOString().slice(0, 10),
    priority: 'Medium',
    status: 'To Do',
    assignedTo: members.find((m) => m.role === 'Member')?.id || members[0]?.id || ''
  });
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const path = task ? `/tasks/${task.id}` : `/projects/${project.id}/tasks`;
      await api.request(path, { method: task ? 'PATCH' : 'POST', body: JSON.stringify(form) });
      onDone();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-backdrop">
      <form className="modal wide" onSubmit={submit}>
        <h3>{task ? 'Edit task' : 'Create task'}</h3>
        <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <div className="form-grid">
          <label>Due date<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
          <label>Priority<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{priorities.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label>Assignee<select value={form.assignedTo || ''} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="ghost-btn" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-btn" type="submit">Save task</button>
        </div>
      </form>
    </div>
  );
}

function AppShell() {
  const api = useApi();
  const [dashboard, setDashboard] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [details, setDetails] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');

  const projectList = Array.isArray(projects) ? projects : [];
  const activeProject = projectList.find((project) => project.id === activeId);
  const isAdmin = details?.role === 'Admin';

  const refresh = async () => {
    const [dashData, projectData] = await Promise.all([api.request('/dashboard'), api.request('/projects')]);
    const nextProjects = Array.isArray(projectData.projects) ? projectData.projects : [];
    setProjects(nextProjects);
    if (!activeId && nextProjects[0]) setActiveId(nextProjects[0].id);
    if (!activeId && projectData.projects[0]) setActiveId(projectData.projects[0].id);
  };

  const loadProject = async (projectId) => {
    if (!projectId) return;
    const [detailData, taskData] = await Promise.all([
      api.request(`/projects/${projectId}`),
      api.request(`/projects/${projectId}/tasks`)
    ]);
    setDetails(detailData);
    setTasks(taskData.tasks);
  };

  useEffect(() => {
    if (api.token) refresh().catch((err) => setToast(err.message));
  }, [api.token]);

  useEffect(() => {
    if (activeId) loadProject(activeId).catch((err) => setToast(err.message));
  }, [activeId]);

  const filteredTasks = useMemo(() => {
    const needle = query.toLowerCase();
    return tasks.filter((task) => `${task.title} ${task.description} ${task.assigneeName}`.toLowerCase().includes(needle));
  }, [tasks, query]);

  const updateTaskStatus = async (task, status) => {
    try {
      await api.request(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await Promise.all([loadProject(activeId), refresh()]);
    } catch (err) {
      setToast(err.message);
    }
  };

  const deleteTask = async (task) => {
    try {
      await api.request(`/tasks/${task.id}`, { method: 'DELETE' });
      await Promise.all([loadProject(activeId), refresh()]);
    } catch (err) {
      setToast(err.message);
    }
  };

  const addMember = async (event) => {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get('email');
    try {
      await api.request(`/projects/${activeId}/members`, { method: 'POST', body: JSON.stringify({ email }) });
      event.currentTarget.reset();
      await loadProject(activeId);
    } catch (err) {
      setToast(err.message);
    }
  };

  const removeMember = async (member) => {
    try {
      await api.request(`/projects/${activeId}/members/${member.id}`, { method: 'DELETE' });
      await Promise.all([loadProject(activeId), refresh()]);
    } catch (err) {
      setToast(err.message);
    }
  };

  if (!api.token) return <AuthScreen api={api} />;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark"><ClipboardList size={26} /> TaskFlow</div>
        <button className="create-btn" onClick={() => setModal('project')}><Plus size={18} /> New project</button>
        <nav className="project-list">
          {projectList.map((project) => (
            <button className={project.id === activeId ? 'active' : ''} key={project.id} onClick={() => setActiveId(project.id)}>
              <span>{project.name}</span>
              <small>{project.memberCount} members</small>
            </button>
          ))}
        </nav>
        <button className="logout" onClick={api.logout}><LogOut size={18} /> Logout</button>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Hello, {api.user?.name}</p>
            <h1>{activeProject?.name || 'Team dashboard'}</h1>
          </div>
          <div className="search"><Search size={18} /><input placeholder="Search tasks" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        </header>

        <section className="stats-grid">
          <StatCard icon={<ClipboardList />} label="Total tasks" value={dashboard?.totals?.totalTasks} />
          <StatCard icon={<CalendarClock />} label="To do" value={dashboard?.totals?.todo} />
          <StatCard icon={<Sparkles />} label="In progress" value={dashboard?.totals?.inProgress} />
          <StatCard icon={<CheckCircle2 />} label="Done" value={dashboard?.totals?.done} tone="success" />
          <StatCard icon={<AlertTriangle />} label="Overdue" value={dashboard?.totals?.overdue} tone="danger" />
        </section>

        <section className="workspace-grid">
          <div className="board-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{details?.role || 'Member'} view</p>
                <h2>Task board</h2>
              </div>
              {isAdmin && <button className="primary-btn compact" onClick={() => setModal('task')}><Plus size={18} /> Task</button>}
            </div>

            <div className="kanban">
              {statuses.map((status) => (
                <div className="lane" key={status}>
                  <div className="lane-title"><span>{status}</span><b>{filteredTasks.filter((task) => task.status === status).length}</b></div>
                  {filteredTasks.filter((task) => task.status === status).map((task) => (
                    <article className="task-card" key={task.id}>
                      <div className="task-meta">
                        <span className={`pill ${task.priority.toLowerCase()}`}>{task.priority}</span>
                        <span>{task.dueDate}</span>
                      </div>
                      <h3>{task.title}</h3>
                      <p>{task.description}</p>
                      <footer>
                        <span>{task.assigneeName || 'Unassigned'}</span>
                        <select value={task.status} onChange={(e) => updateTaskStatus(task, e.target.value)}>
                          {statuses.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </footer>
                      {isAdmin && (
                        <div className="task-actions">
                          <button onClick={() => setModal({ type: 'task', task })}>Edit</button>
                          <button aria-label="Delete task" onClick={() => deleteTask(task)}><Trash2 size={16} /></button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <aside className="side-panels">
            <section className="panel">
              <div className="panel-heading slim"><h2>Team</h2><Users size={20} /></div>
              {isAdmin && (
                <form className="member-form" onSubmit={addMember}>
                  <input name="email" placeholder="user@email.com" />
                  <button aria-label="Add member"><UserPlus size={18} /></button>
                </form>
              )}
              <div className="member-list">
                {details?.members?.map((member) => (
                  <div className="member-row" key={member.id}>
                    <span>{member.name}<small>{member.email}</small></span>
                    <b>{member.role}</b>
                    {isAdmin && member.id !== api.user.id && <button aria-label="Remove member" onClick={() => removeMember(member)}><Trash2 size={15} /></button>}
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading slim"><h2>Tasks per user</h2><BarChart3 size={20} /></div>
              <div className="bar-list">
                {dashboard?.perUser?.map((item) => (
                  <div key={item.name}>
                    <span>{item.name}<b>{item.count}</b></span>
                    <div><i style={{ width: `${Math.min(100, item.count * 22)}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading slim"><h2>Overdue</h2><AlertTriangle size={20} /></div>
              <div className="overdue-list">
                {dashboard?.overdueTasks?.length ? dashboard.overdueTasks.map((task) => (
                  <span key={task.id}>{task.title}<small>{task.projectName} · {task.dueDate}</small></span>
                )) : <p className="muted">No overdue tasks in your view.</p>}
              </div>
            </section>
          </aside>
        </section>
      </section>

      {toast && <button className="toast" onClick={() => setToast('')}>{toast}</button>}
      {modal === 'project' && <ProjectModal api={api} onClose={() => setModal(null)} onDone={refresh} />}
       {activeProject && (modal === 'task' || modal?.type === 'task') && (
        <TaskModal
          api={api}
          project={activeProject}
          members={details?.members || []}
          task={modal.task}
          onClose={() => setModal(null)}
          onDone={() => Promise.all([loadProject(activeId), refresh()])}
        />
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<AppShell />);
