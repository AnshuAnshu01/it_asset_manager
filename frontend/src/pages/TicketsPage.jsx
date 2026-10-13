import { useEffect, useState } from 'react';
import { ticketsAPI, usersAPI, assetsAPI } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { StatusBadge, PriorityBadge } from '../components/Badge';
import { Plus, Search, Ticket, CheckCircle, XCircle, UserCheck, RefreshCw, Clock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';

const toLocalDate = (dateStr) => {
  if (!dateStr) return null;
  // If the string does not end in Z or timezone offset, append Z so the browser treats it as UTC
  const str = String(dateStr);
  const normalized = str.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(str) ? str : `${str}Z`;
  return new Date(normalized);
};

const CATEGORIES = ['Hardware', 'Software', 'Network', 'Access', 'Other'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ESCALATED'];

function TicketForm({ onSave, onClose, loading, userAssets = [] }) {
  const [form, setForm] = useState({ title: '', description: '', category: '', priority: '', asset_id: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }}>
      <div className="form-group">
        <label className="form-label">Title <span className="req">*</span></label>
        <input className="form-control" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Brief description of the issue" required minLength={3} />
      </div>
      <div className="form-group">
        <label className="form-label">Description <span className="req">*</span></label>
        <textarea className="form-control" rows={4} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Provide full details of the issue..." required minLength={5} />
      </div>
      {userAssets.length > 0 && (
        <div className="form-group">
          <label className="form-label">Related Asset</label>
          <select className="form-control" value={form.asset_id} onChange={e => set('asset_id', e.target.value)}>
            <option value="">— Not specific to an asset —</option>
            {userAssets.map(a => <option key={a.id} value={a.id}>{a.brand} {a.model} ({a.asset_tag})</option>)}
          </select>
        </div>
      )}
      <div className="form-hint" style={{ marginBottom: 12 }}>💡 Leave Category & Priority blank for automatic classification</div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Category</label>
          <select className="form-control" value={form.category} onChange={e => set('category', e.target.value)}>
            <option value="">Auto-detect</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Priority</label>
          <select className="form-control" value={form.priority} onChange={e => set('priority', e.target.value)}>
            <option value="">Auto-detect</option>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div className="modal-footer" style={{ padding: 0, marginTop: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create Ticket'}</button>
      </div>
    </form>
  );
}

function AssignModal({ ticket, onClose, onDone }) {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    usersAPI.list().then(r => setUsers(r.data.filter(u => u.role === 'SUPPORT' && u.is_active)));
  }, []);

  const handleAssign = async () => {
    if (!userId) return toast.error('Select a support agent');
    setLoading(true);
    try {
      await ticketsAPI.assign(ticket.id, { assigned_to_id: parseInt(userId) });
      toast.success('Ticket assigned!');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <Modal title={`Assign: ${ticket.ticket_number}`} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleAssign} disabled={loading}>{loading ? 'Assigning...' : 'Assign'}</button>
      </>}>
      <div className="form-group">
        <label className="form-label">Assign To Support Agent <span className="req">*</span></label>
        <select className="form-control" value={userId} onChange={e => setUserId(e.target.value)}>
          <option value="">— Select Agent —</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.user_code})</option>)}
        </select>
        {users.length === 0 && <div className="form-hint">No support agents available</div>}
      </div>
    </Modal>
  );
}

function ResolveModal({ ticket, onClose, onDone }) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResolve = async () => {
    setLoading(true);
    try {
      await ticketsAPI.resolve(ticket.id, { resolution: comment || 'Issue resolved' });
      toast.success('Ticket resolved!');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <Modal title={`Resolve: ${ticket.ticket_number}`} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-success" onClick={handleResolve} disabled={loading}>{loading ? 'Resolving...' : 'Mark Resolved'}</button>
      </>}>
      <div className="form-group">
        <label className="form-label">Resolution Comment</label>
        <textarea className="form-control" rows={4} value={comment} onChange={e => setComment(e.target.value)} placeholder="Describe how the issue was resolved..." />
      </div>
    </Modal>
  );
}

function EscalateModal({ ticket, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEscalate = async () => {
    if (!reason) return toast.error('Please provide a reason');
    setLoading(true);
    try {
      await ticketsAPI.escalate(ticket.id, { reason });
      toast.success('Ticket escalated to Admin');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <Modal title={`Escalate: ${ticket.ticket_number}`} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleEscalate} disabled={loading}>{loading ? 'Escalating...' : 'Escalate'}</button>
      </>}>
      <div className="form-group">
        <label className="form-label">Reason for Escalation <span className="req">*</span></label>
        <textarea className="form-control" rows={4} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why you cannot resolve this ticket..." required />
      </div>
    </Modal>
  );
}

function TicketDetailModal({ ticket, onClose, onAction, auth }) {
  return (
    <Modal title={ticket.ticket_number} onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          {auth.isAdmin && ['OPEN', 'ESCALATED'].includes(ticket.status) && (
            <button className="btn btn-primary btn-sm" onClick={() => { onClose(); onAction('assign', ticket); }}>
              <UserCheck size={12} /> Assign
            </button>
          )}
          {auth.isSupport && ['ASSIGNED', 'IN_PROGRESS'].includes(ticket.status) && (
            <button className="btn btn-primary btn-sm" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => { onClose(); onAction('escalate', ticket); }}>
              <AlertTriangle size={12} /> Escalate
            </button>
          )}
          {auth.isAdminOrSupport && ['OPEN', 'ASSIGNED'].includes(ticket.status) && (
            <button className="btn btn-primary btn-sm" style={{ background: 'var(--info)' }} onClick={() => { onClose(); onAction('process', ticket); }}>
              <Clock size={12} /> Start Processing
            </button>
          )}
          {auth.isAdminOrSupport && ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(ticket.status) && (
            <button className="btn btn-success btn-sm" onClick={() => { onClose(); onAction('resolve', ticket); }}>
              <CheckCircle size={12} /> Resolve
            </button>
          )}
          {auth.isAdminOrSupport && ticket.status === 'RESOLVED' && (
            <button className="btn btn-secondary btn-sm" onClick={async () => {
              await ticketsAPI.close(ticket.id);
              toast.success('Ticket closed');
              onClose();
              onAction('refresh');
            }}>
              <XCircle size={12} /> Close
            </button>
          )}
        </div>
      }>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{ticket.title}</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{ticket.description}</div>
        </div>
        <div className="divider" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Status', value: <StatusBadge status={ticket.status} /> },
            { label: 'Priority', value: <PriorityBadge priority={ticket.priority} /> },
            { label: 'Category', value: ticket.category },
            { label: 'Creator', value: ticket.creator_name ? `${ticket.creator_name} (ID: ${ticket.created_by_id})` : `User ${ticket.created_by_id}` },
            { label: 'Asset', value: ticket.asset_name || 'None' },
            { label: 'Assigned To', value: ticket.assigned_to_name || 'Unassigned' },
            { label: 'SLA', value: ticket.is_sla_breached ? <span className="badge badge-closed">Breached</span> : <span className="badge badge-resolved">Active</span> },
            { label: 'Created', value: ticket.created_at ? format(toLocalDate(ticket.created_at), 'MMM d, yyyy HH:mm') : '—' },
            { label: 'SLA Deadline', value: ticket.sla_deadline ? format(toLocalDate(ticket.sla_deadline), 'MMM d, yyyy HH:mm') : '—' },
          ].map(row => (
            <div key={row.label}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{row.label}</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{row.value}</div>
            </div>
          ))}
        </div>
        {ticket.resolution_comment && (
          <>
            <div className="divider" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)', marginBottom: 6, textTransform: 'uppercase' }}>✅ Resolution</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'rgba(16,185,129,0.05)', padding: 12, borderRadius: 8, border: '1px solid rgba(16,185,129,0.15)' }}>
                {ticket.resolution_comment}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function TicketsPage() {
  const auth = useAuth();
  const wsHook = useWebSocket();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [assignTicket, setAssignTicket] = useState(null);
  const [resolveTicket, setResolveTicket] = useState(null);
  const [escalateTicket, setEscalateTicket] = useState(null);
  const [userAssets, setUserAssets] = useState([]);

  useEffect(() => {
    if (!auth.isAdminOrSupport && auth.user) {
      assetsAPI.list().then(r => setUserAssets(r.data.filter(a => a.assigned_to_id === auth.user.id))).catch(() => {});
    }
  }, [auth.isAdminOrSupport, auth.user]);

  const load = () => {
    setLoading(true);
    ticketsAPI.list().then(r => setTickets(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = tickets.filter(t => {
    const q = search.toLowerCase();
    const matchQ = !q || t.ticket_number?.toLowerCase().includes(q) || t.title?.toLowerCase().includes(q);
    const matchS = !statusFilter || t.status === statusFilter;
    const matchP = !priorityFilter || t.priority === priorityFilter;
    return matchQ && matchS && matchP;
  });

  const handleCreate = async (form) => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.category) delete payload.category;
      if (!payload.priority) delete payload.priority;
      if (!payload.asset_id) delete payload.asset_id;
      else payload.asset_id = parseInt(payload.asset_id);
      
      const res = await ticketsAPI.create(payload);
      toast.success(`Ticket ${res.data.ticket_number} created! Auto-classified as ${res.data.category} / ${res.data.priority}`);
      setShowCreate(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create ticket');
    } finally { setSaving(false); }
  };

  const handleAction = async (action, ticket) => {
    if (action === 'assign') setAssignTicket(ticket);
    else if (action === 'resolve') setResolveTicket(ticket);
    else if (action === 'escalate') setEscalateTicket(ticket);
    else if (action === 'refresh') load();
    else if (action === 'process') {
      try {
        await ticketsAPI.process(ticket.id);
        toast.success('Ticket is now Processing');
        load();
      } catch (err) { toast.error('Failed to update status'); }
    }
  };

  const getSLAInfo = (ticket) => {
    if (!ticket.sla_deadline) return null;
    const deadline = new Date(ticket.sla_deadline);
    const now = new Date();
    const remaining = deadline - now;
    const pct = Math.max(0, Math.min(100, (remaining / (4 * 60 * 60 * 1000)) * 100));
    return { remaining, pct, breached: ticket.is_sla_breached };
  };

  return (
    <>
      <Header title="Tickets" subtitle="Support ticket management" wsConnected={wsHook.connected} />
      <div className="page-content">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Support Tickets</div>
              <div className="card-subtitle">{filtered.length} tickets</div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={14} /></button>
              {(auth.isEmployee || auth.isAdmin) && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                  <Plus size={14} /> New Ticket
                </button>
              )}
            </div>
          </div>
          <div className="card-body">
            <div className="toolbar">
              <div className="search-box">
                <Search size={14} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ticket # or title..." />
              </div>
              <select className="form-control" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
              <select className="form-control" style={{ width: 'auto' }} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
                <option value="">All Priorities</option>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>

            {loading ? (
              <div className="loading"><div className="spinner" /><span>Loading tickets...</span></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Ticket #</th><th>Title</th><th>Category</th>
                      <th>Priority</th><th>Status</th><th>SLA</th><th>Created</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => {
                      const sla = getSLAInfo(t);
                      return (
                        <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(t)}>
                          <td className="td-primary" style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{t.ticket_number}</td>
                          <td className="td-primary" style={{ maxWidth: 240 }}>
                            <div className="truncate">{t.title}</div>
                          </td>
                          <td className="text-muted">{t.category}</td>
                          <td><PriorityBadge priority={t.priority} /></td>
                          <td><StatusBadge status={t.status} /></td>
                          <td>
                            {sla ? (
                              t.is_sla_breached
                                ? <span style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 600 }}>⚠ Breached</span>
                                : <span style={{ color: 'var(--success)', fontSize: 12 }}>
                                    <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                    {formatDistanceToNow(toLocalDate(t.sla_deadline))}
                                  </span>
                            ) : '—'}
                          </td>
                          <td className="text-muted">
                            {t.created_at ? formatDistanceToNow(toLocalDate(t.created_at), { addSuffix: true }) : '—'}
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <div className="flex gap-2">
                              {auth.isAdmin && ['OPEN', 'ESCALATED'].includes(t.status) && (
                                <button className="btn btn-sm btn-secondary" title="Assign" onClick={() => setAssignTicket(t)}>
                                  <UserCheck size={12} />
                                </button>
                              )}
                              {auth.isSupport && ['ASSIGNED', 'IN_PROGRESS'].includes(t.status) && (
                                <button className="btn btn-sm btn-danger" style={{ background: 'var(--danger)', borderColor: 'var(--danger)', color: 'white' }} title="Escalate" onClick={() => handleAction('escalate', t)}>
                                  <AlertTriangle size={12} />
                                </button>
                              )}
                              {auth.isAdminOrSupport && ['OPEN', 'ASSIGNED'].includes(t.status) && (
                                <button className="btn btn-sm btn-primary" style={{ background: 'var(--info)', borderColor: 'var(--info)' }} title="Start Processing" onClick={() => handleAction('process', t)}>
                                  <Clock size={12} />
                                </button>
                              )}
                              {auth.isAdminOrSupport && ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status) && (
                                <button className="btn btn-sm btn-success" title="Resolve" onClick={() => setResolveTicket(t)}>
                                  <CheckCircle size={12} />
                                </button>
                              )}
                              {auth.isAdminOrSupport && t.status === 'RESOLVED' && (
                                <button className="btn btn-sm btn-secondary" title="Close" onClick={async () => {
                                  try {
                                    await ticketsAPI.close(t.id);
                                    toast.success('Ticket closed');
                                    load();
                                  } catch (err) {
                                    toast.error(err.response?.data?.detail || 'Failed');
                                  }
                                }}>
                                  <XCircle size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && !loading && (
                      <tr><td colSpan={8}>
                        <div className="empty-state"><Ticket size={32} /><h3>No tickets found</h3><p>Create a new ticket or adjust your filters</p></div>
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
        <Modal title="Create New Ticket" onClose={() => setShowCreate(false)}>
          <TicketForm onSave={handleCreate} onClose={() => setShowCreate(false)} loading={saving} userAssets={userAssets} />
        </Modal>
      )}
      {detail && <TicketDetailModal ticket={detail} onClose={() => setDetail(null)} onAction={handleAction} auth={auth} />}
      {assignTicket && <AssignModal ticket={assignTicket} onClose={() => setAssignTicket(null)} onDone={() => { setAssignTicket(null); load(); }} />}
      {resolveTicket && <ResolveModal ticket={resolveTicket} onClose={() => setResolveTicket(null)} onDone={() => { setResolveTicket(null); load(); }} />}
      {escalateTicket && <EscalateModal ticket={escalateTicket} onClose={() => setEscalateTicket(null)} onDone={() => { setEscalateTicket(null); load(); }} />}
    </>
  );
}
