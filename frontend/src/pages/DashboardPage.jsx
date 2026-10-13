import { useEffect, useState } from 'react';
import { reportsAPI, ticketsAPI, assetsAPI } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import Header from '../components/Header';
import { StatusBadge, PriorityBadge } from '../components/Badge';
import {
  Ticket, Laptop, Users, AlertTriangle,
  CheckCircle, Clock, TrendingUp, Activity
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';

const toLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr);
  const normalized = str.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(str) ? str : `${str}Z`;
  return new Date(normalized);
};

const COLORS = ['#eab308', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '8px 14px' }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ fontSize: 14, color: p.fill || 'var(--accent)', fontWeight: 600 }}>{p.value}</p>)}
    </div>
  );
};

export default function DashboardPage() {
  const { user, isAdminOrSupport } = useAuth();
  const { connected, messages, lastEvent } = useWebSocket();
  const [reports, setReports] = useState({ tickets: null, assets: null, sla: null });
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [tRes, aRes] = await Promise.all([
          ticketsAPI.list(),
          assetsAPI.list(),
        ]);
        setTickets(tRes.data);

        if (isAdminOrSupport) {
          const [rTickets, rAssets, rSla] = await Promise.all([
            reportsAPI.tickets(),
            reportsAPI.assets(),
            reportsAPI.sla(),
          ]);
          setReports({ tickets: rTickets.data, assets: rAssets.data, sla: rSla.data });
        }
        if (user?.role === 'ADMIN') {
          const wRes = await reportsAPI.supportWorkload();
          setWorkload(wRes.data);
        }
      } catch (_) {}
      setLoading(false);
    };
    load();
  }, [isAdminOrSupport]);

  const openTickets = tickets.filter(t => t.status === 'OPEN').length;
  const inProgressTickets = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const criticalTickets = tickets.filter(t => t.priority === 'CRITICAL').length;
  const breachedTickets = tickets.filter(t => t.is_sla_breached).length;

  const [myAssets, setMyAssets] = useState([]);
  const [workload, setWorkload] = useState([]);
  useEffect(() => {
    if (user) {
      assetsAPI.list().then(r => setMyAssets(r.data.filter(a => a.assigned_to_id === user.id))).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (lastEvent) {
      ticketsAPI.list().then(r => setTickets(r.data)).catch(() => {});
    }
  }, [lastEvent]);

  const recentTickets = [...tickets]
    .sort((a, b) => {
      const dateA = toLocalDate(a.created_at)?.getTime() || 0;
      const dateB = toLocalDate(b.created_at)?.getTime() || 0;
      return dateB - dateA;
    })
    .slice(0, 5);

  const byStatusData = reports.tickets
    ? Object.entries(reports.tickets.by_status).map(([k, v]) => ({ name: k, value: v }))
    : [];
  const byPriorityData = reports.tickets
    ? Object.entries(reports.tickets.by_priority).map(([k, v]) => ({ name: k, value: v }))
    : [];

  if (loading) return <><Header title="Dashboard" subtitle="Loading..." wsConnected={connected} /><div className="page-content"><div className="loading"><div className="spinner" /><span>Loading dashboard...</span></div></div></>;

  return (
    <>
      <Header title="Dashboard" subtitle={`Welcome back, ${user?.name}`} wsConnected={connected} />
      <div className="page-content">

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card indigo">
            <div className="stat-icon indigo"><Ticket size={20} /></div>
            <div className="stat-value">{tickets.length}</div>
            <div className="stat-label">Total Tickets</div>
          </div>
          <div className="stat-card amber">
            <div className="stat-icon amber"><Clock size={20} /></div>
            <div className="stat-value">{openTickets}</div>
            <div className="stat-label">Open Tickets</div>
          </div>
          <div className="stat-card rose">
            <div className="stat-icon rose"><AlertTriangle size={20} /></div>
            <div className="stat-value">{criticalTickets}</div>
            <div className="stat-label">Critical Priority</div>
          </div>
          <div className="stat-card emerald">
            <div className="stat-icon emerald"><CheckCircle size={20} /></div>
            <div className="stat-value">{reports.sla?.compliance_rate_percent?.toFixed(1) ?? '—'}%</div>
            <div className="stat-label">SLA Compliance</div>
          </div>
          {isAdminOrSupport && reports.assets && (
            <>
              <div className="stat-card violet">
                <div className="stat-icon violet"><Laptop size={20} /></div>
                <div className="stat-value">{reports.assets.total_assets}</div>
                <div className="stat-label">Total Assets</div>
              </div>
              <div className="stat-card sky">
                <div className="stat-icon sky"><TrendingUp size={20} /></div>
                <div className="stat-value">{reports.sla?.avg_resolution_time_hours?.toFixed(1) ?? '—'}h</div>
                <div className="stat-label">Avg Resolution Time</div>
              </div>
            </>
          )}
        </div>

        <div className="dashboard-grid">
          {/* Recent Tickets */}
          <div className="card grid-full">
            <div className="card-header">
              <div>
                <div className="card-title">Recent Tickets</div>
                <div className="card-subtitle">Latest {Math.min(recentTickets.length, 5)} tickets</div>
              </div>
            </div>
            <div className="card-body">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Ticket #</th><th>Title</th><th>Priority</th><th>Status</th><th>SLA</th><th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTickets.map(t => (
                      <tr key={t.id}>
                        <td><span style={{ color: 'var(--accent)', fontFamily: 'monospace', fontWeight: 600 }}>{t.ticket_number}</span></td>
                        <td className="td-primary">{t.title}</td>
                        <td><PriorityBadge priority={t.priority} /></td>
                        <td><StatusBadge status={t.status} /></td>
                        <td>
                          {t.is_sla_breached
                            ? <span className="badge badge-closed">Breached</span>
                            : <span className="badge badge-resolved">Active</span>}
                        </td>
                        <td className="text-muted">
                          {t.created_at ? formatDistanceToNow(toLocalDate(t.created_at), { addSuffix: true }) : '—'}
                        </td>
                      </tr>
                    ))}
                    {recentTickets.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No tickets found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* My Assets */}
          <div className="card grid-full">
              <div className="card-header">
                <div>
                  <div className="card-title">My Assigned Assets</div>
                  <div className="card-subtitle">Hardware currently assigned to you</div>
                </div>
              </div>
              <div className="card-body">
                <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>Type</th><th>Brand & Model</th><th>Serial #</th><th>Asset Tag</th></tr>
                    </thead>
                    <tbody>
                      {myAssets.map(a => (
                        <tr key={a.id}>
                          <td>{a.asset_type}</td>
                          <td className="td-primary">{a.brand} {a.model}</td>
                          <td style={{ fontFamily: 'monospace' }}>{a.serial_number}</td>
                          <td style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{a.asset_tag}</td>
                        </tr>
                      ))}
                      {myAssets.length === 0 && (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No assets assigned</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          {/* Charts — admin/support only */}
          {isAdminOrSupport && byStatusData.length > 0 && (
            <>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Tickets by Status</div>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={byStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {byStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">Tickets by Priority</div>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byPriorityData}>
                      <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {byPriorityData.map((entry, i) => {
                          const c = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444', CRITICAL: '#dc2626' };
                          return <Cell key={i} fill={c[entry.name] || COLORS[i]} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* Support Workload - Admin Only */}
          {user?.role === 'ADMIN' && workload.length > 0 && (
            <div className="card grid-full">
              <div className="card-header">
                <div>
                  <div className="card-title">Support Team Workload</div>
                  <div className="card-subtitle">Current task distribution</div>
                </div>
              </div>
              <div className="card-body">
                <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>Agent Name</th><th>Code</th><th>Total Assigned</th><th>Completed</th><th>Pending</th><th>Processing</th></tr>
                    </thead>
                    <tbody>
                      {workload.map(w => (
                        <tr key={w.id}>
                          <td className="td-primary">{w.name}</td>
                          <td style={{ fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}>{w.user_code}</td>
                          <td>{w.total_assigned}</td>
                          <td style={{ color: 'var(--success)', fontWeight: 600 }}>{w.completed}</td>
                          <td style={{ color: 'var(--warning)', fontWeight: 600 }}>{w.pending}</td>
                          <td style={{ color: 'var(--info)', fontWeight: 600 }}>{w.processing}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
