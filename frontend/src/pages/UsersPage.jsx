import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usersAPI } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { RoleBadge } from '../components/Badge';
import { Plus, Search, Users, Edit2, Trash2, RefreshCw, CheckCircle, XCircle, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const ROLES = ['ADMIN', 'SUPPORT', 'EMPLOYEE'];
const DEPARTMENTS = ['IT Administration', 'IT Support', 'Marketing', 'Finance', 'Operations', 'HR', 'Engineering', 'Sales'];

function UserForm({ initial = {}, onSave, onClose, loading, isEdit }) {
  const [form, setForm] = useState({
    name: '', email: '', department: 'General', role: 'EMPLOYEE', password: '',
    ...initial,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Full Name <span className="req">*</span></label>
          <input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Doe" required minLength={2} />
        </div>
        <div className="form-group">
          <label className="form-label">Email <span className="req">*</span></label>
          <input className="form-control" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@company.com" required disabled={isEdit} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Role <span className="req">*</span></label>
          <select className="form-control" value={form.role} onChange={e => set('role', e.target.value)}>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Department</label>
          <input className="form-control" value={form.department} onChange={e => set('department', e.target.value)} placeholder="IT Administration" list="dept-list" />
          <datalist id="dept-list">{DEPARTMENTS.map(d => <option key={d} value={d} />)}</datalist>
        </div>
      </div>
      {!isEdit && (
        <div className="form-group">
          <label className="form-label">Password <span className="req">*</span></label>
          <input className="form-control" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 6 characters" required={!isEdit} minLength={6} />
        </div>
      )}
      <div className="modal-footer" style={{ padding: 0, marginTop: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}</button>
      </div>
    </form>
  );
}

export default function UsersPage() {
  const auth = useAuth();
  const wsHook = useWebSocket();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    usersAPI.list().then(r => setUsers(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.user_code?.toLowerCase().includes(q);
    const matchR = !roleFilter || u.role === roleFilter;
    return matchQ && matchR;
  });

  const handleCreate = async (form) => {
    setSaving(true);
    try {
      await usersAPI.create(form);
      toast.success('User created!');
      setShowCreate(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create user');
    } finally { setSaving(false); }
  };

  const handleUpdate = async (form) => {
    setSaving(true);
    try {
      const { name, department, role, is_active } = form;
      await usersAPI.update(editUser.id, { name, department, role });
      toast.success('User updated!');
      setEditUser(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update user');
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (user) => {
    if (!window.confirm(`Deactivate ${user.name}?`)) return;
    try {
      await usersAPI.delete(user.id);
      toast.success('User deactivated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    setSaving(true);
    try {
      await usersAPI.resetPassword(resetUser.id, newPassword);
      toast.success(`Password reset successfully for ${resetUser.name}`);
      setResetUser(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset password');
    } finally { setSaving(false); }
  };

  const roleCounts = { ADMIN: 0, SUPPORT: 0, EMPLOYEE: 0 };
  users.forEach(u => { if (roleCounts[u.role] !== undefined) roleCounts[u.role]++; });

  return (
    <>
      <Header title="User Management" subtitle="Manage system users and roles" wsConnected={wsHook.connected} />
      <div className="page-content">
        {/* Stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 28 }}>
          <div className="stat-card indigo">
            <div className="stat-icon indigo"><Users size={18} /></div>
            <div className="stat-value">{users.length}</div>
            <div className="stat-label">Total Users</div>
          </div>
          {Object.entries(roleCounts).map(([role, count], i) => (
            <div className={`stat-card ${['violet', 'sky', 'emerald'][i]}`} key={role}>
              <div className={`stat-icon ${['violet', 'sky', 'emerald'][i]}`}>{['👑', '🛠', '👤'][i]}</div>
              <div className="stat-value">{count}</div>
              <div className="stat-label">{role}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">System Users</div>
              <div className="card-subtitle">{filtered.length} users</div>
            </div>
            <div className="flex gap-2">
              <Link to="/asset-requests" className="btn btn-secondary btn-sm" title="View & Fulfill Asset Requests">
                <ClipboardList size={14} /> Asset Requests
              </Link>
              <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={14} /></button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                <Plus size={14} /> Add User
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="toolbar">
              <div className="search-box">
                <Search size={14} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or user code..." />
              </div>
              <select className="form-control" style={{ width: 'auto' }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                <option value="">All Roles</option>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>

            {loading ? (
              <div className="loading"><div className="spinner" /><span>Loading users...</span></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>User Code</th><th>Name</th><th>Email</th><th>Role</th>
                      <th>Department</th><th>Status</th><th>Created</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}>{u.user_code}</td>
                        <td className="td-primary">{u.name}</td>
                        <td className="text-muted">{u.email}</td>
                        <td><RoleBadge role={u.role} /></td>
                        <td className="text-muted">{u.department || '—'}</td>
                        <td>
                          {u.is_active
                            ? <span className="badge badge-resolved">Active</span>
                            : <span className="badge badge-closed">Inactive</span>}
                        </td>
                        <td className="text-muted">{u.created_at ? format(new Date(u.created_at), 'MMM d, yyyy') : '—'}</td>
                        <td>
                          <div className="flex gap-2">
                            <button className="btn btn-sm btn-secondary" title="Reset Password" onClick={() => setResetUser(u)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
                            </button>
                            <button className="btn btn-sm btn-secondary" title="Edit" onClick={() => setEditUser(u)}>
                              <Edit2 size={12} />
                            </button>
                            {u.is_active && u.id !== auth.user?.id && (
                              <button className="btn btn-sm btn-danger" title="Deactivate" onClick={() => handleDeactivate(u)}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && !loading && (
                      <tr><td colSpan={8}>
                        <div className="empty-state"><Users size={32} /><h3>No users found</h3></div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <Modal title="Create New User" onClose={() => setShowCreate(false)}>
          <UserForm onSave={handleCreate} onClose={() => setShowCreate(false)} loading={saving} />
        </Modal>
      )}
      {editUser && (
        <Modal title={`Edit: ${editUser.name}`} onClose={() => setEditUser(null)}>
          <UserForm initial={editUser} onSave={handleUpdate} onClose={() => setEditUser(null)} loading={saving} isEdit />
        </Modal>
      )}
      {resetUser && (
        <Modal title={`Reset Password: ${resetUser.name}`} onClose={() => { setResetUser(null); setNewPassword(''); }}>
          <form onSubmit={handleResetPassword}>
            <div className="form-group">
              <label className="form-label">New Password <span className="req">*</span></label>
              <input
                className="form-control"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 chars)"
                required
                minLength={6}
              />
            </div>
            <div className="modal-footer" style={{ padding: 0, marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setResetUser(null); setNewPassword(''); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Resetting...' : 'Reset Password'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
