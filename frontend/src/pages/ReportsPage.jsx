import { useEffect, useState } from 'react';
import { reportsAPI } from '../api/endpoints';
import { useWebSocket } from '../hooks/useWebSocket';
import Header from '../components/Header';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  TrendingUp, AlertTriangle, CheckCircle, BarChart3,
  Download, RefreshCw, Users, Clock, Wrench, Laptop,
  Activity, Check, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const PALETTE = ['#eab308', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const STATUS_COLORS = {
  OPEN: '#eab308',
  ASSIGNED: '#f59e0b',
  IN_PROGRESS: '#3b82f6',
  RESOLVED: '#10b981',
  CLOSED: '#64748b',
  ESCALATED: '#ef4444',
};
const PRIORITY_COLORS = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};
const ASSET_COLORS = {
  AVAILABLE: '#10b981',
  ASSIGNED: '#3b82f6',
  UNDER_REPAIR: '#f59e0b',
  RETIRED: '#64748b',
  LOST: '#ef4444',
};

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
      {label && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</p>}
      {payload.map(p => (
        <p key={p.name} style={{ fontSize: 14, color: p.fill || p.color || 'var(--accent)', fontWeight: 600, margin: '2px 0' }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const wsHook = useWebSocket();
  const [data, setData] = useState({
    tickets: null,
    assets: null,
    sla: null,
    workload: [],
    activityLogs: [],
  });
  const [loading, setLoading] = useState(true);
  const [exportingTickets, setExportingTickets] = useState(false);
  const [exportingAssets, setExportingAssets] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [tRes, aRes, sRes, wRes, lRes] = await Promise.all([
        reportsAPI.tickets(),
        reportsAPI.assets(),
        reportsAPI.sla(),
        reportsAPI.supportWorkload().catch(() => ({ data: [] })),
        reportsAPI.activityLogs({ limit: 15 }).catch(() => ({ data: [] })),
      ]);
      setData({
        tickets: tRes.data,
        assets: aRes.data,
        sla: sRes.data,
        workload: wRes.data || [],
        activityLogs: lRes.data || [],
      });
    } catch (err) {
      toast.error('Failed to load report metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleExportTickets = async () => {
    setExportingTickets(true);
    try {
      const res = await reportsAPI.exportTicketsCSV();
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `tickets_report_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Tickets CSV exported successfully!');
    } catch (err) {
      toast.error('Failed to export tickets CSV');
    } finally {
      setExportingTickets(false);
    }
  };

  const handleExportAssets = async () => {
    setExportingAssets(true);
    try {
      const res = await reportsAPI.exportAssetsCSV();
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `asset_inventory_report_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Asset Inventory CSV exported successfully!');
    } catch (err) {
      toast.error('Failed to export assets CSV');
    } finally {
      setExportingAssets(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header title="Reports & Analytics" wsConnected={wsHook.connected} />
        <div className="page-content">
          <div className="loading">
            <div className="spinner" />
            <span>Loading comprehensive report records...</span>
          </div>
        </div>
      </>
    );
  }

  const { tickets, assets, sla, workload, activityLogs } = data;

  const statusData = tickets?.by_status
    ? Object.entries(tickets.by_status).map(([k, v]) => ({
        name: k.replace('_', ' '),
        rawStatus: k,
        value: v,
        fill: STATUS_COLORS[k] || '#6366f1',
      }))
    : [];

  const priorityData = tickets?.by_priority
    ? Object.entries(tickets.by_priority).map(([k, v]) => ({
        name: k,
        value: v,
        fill: PRIORITY_COLORS[k] || '#6366f1',
      }))
    : [];

  const categoryData = tickets?.by_category
    ? Object.entries(tickets.by_category).map(([k, v]) => ({
        name: k,
        value: v,
      }))
    : [];

  const assetStatusData = assets?.by_status
    ? Object.entries(assets.by_status).map(([k, v]) => ({
        name: k.replace('_', ' '),
        rawStatus: k,
        value: v,
        fill: ASSET_COLORS[k] || '#6366f1',
      }))
    : [];

  const assetTypeData = assets?.by_type
    ? Object.entries(assets.by_type).map(([k, v]) => ({
        name: k,
        value: v,
      }))
    : [];

  const slaColor =
    sla?.compliance_rate_percent >= 80
      ? 'var(--success)'
      : sla?.compliance_rate_percent >= 50
      ? 'var(--warning)'
      : 'var(--danger)';

  const availableAssetsCount = assets?.by_status?.AVAILABLE ?? 0;
  const underRepairAssetsCount = assets?.by_status?.UNDER_REPAIR ?? 0;

  return (
    <>
      <Header
        title="Reports & Analytics"
        subtitle="System-wide metrics, SLA analytics, asset tracking, and audit records"
        wsConnected={wsHook.connected}
      />
      <div className="page-content">
        {/* Actions Bar: CSV Exports & Refresh */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Executive Performance Summary
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Real-time records from PostgreSQL database
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={fetchReports}
              title="Refresh all metrics"
            >
              <RefreshCw size={14} /> Refresh Records
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleExportTickets}
              disabled={exportingTickets}
              title="Download memory-efficient CSV of all support tickets"
            >
              <Download size={14} /> {exportingTickets ? 'Exporting...' : 'Export Tickets CSV'}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleExportAssets}
              disabled={exportingAssets}
              title="Download memory-efficient CSV of full asset inventory"
            >
              <Download size={14} /> {exportingAssets ? 'Exporting...' : 'Export Asset Inventory CSV'}
            </button>
          </div>
        </div>

        {/* Top KPI Stats Grid */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card indigo">
            <div className="stat-icon indigo"><BarChart3 size={18} /></div>
            <div className="stat-value">{tickets?.total_tickets ?? '—'}</div>
            <div className="stat-label">Total Tickets</div>
          </div>

          <div className="stat-card emerald">
            <div className="stat-icon emerald"><CheckCircle size={18} /></div>
            <div className="stat-value" style={{ color: slaColor }}>
              {sla?.compliance_rate_percent !== undefined ? `${sla.compliance_rate_percent.toFixed(1)}%` : '—'}
            </div>
            <div className="stat-label">SLA Compliance Rate</div>
          </div>

          <div className="stat-card rose">
            <div className="stat-icon rose"><AlertTriangle size={18} /></div>
            <div className="stat-value">{sla?.breached_tickets ?? '—'}</div>
            <div className="stat-label">SLA Breaches</div>
          </div>

          <div className="stat-card amber">
            <div className="stat-icon amber"><TrendingUp size={18} /></div>
            <div className="stat-value">
              {sla?.avg_resolution_time_hours !== undefined ? `${sla.avg_resolution_time_hours.toFixed(1)}h` : '—'}
            </div>
            <div className="stat-label">Avg Resolution Time</div>
          </div>

          <div className="stat-card violet">
            <div className="stat-icon violet"><Laptop size={18} /></div>
            <div className="stat-value">{assets?.total_assets ?? '—'}</div>
            <div className="stat-label">Total Assets</div>
          </div>

          <div className="stat-card emerald">
            <div className="stat-icon emerald"><Check size={18} /></div>
            <div className="stat-value">{availableAssetsCount}</div>
            <div className="stat-label">Available in Inventory</div>
          </div>

          <div className="stat-card amber">
            <div className="stat-icon amber"><Wrench size={18} /></div>
            <div className="stat-value">{underRepairAssetsCount}</div>
            <div className="stat-label">Under Repair Assets</div>
          </div>
        </div>

        {/* Visual Analytics Charts Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 24, marginBottom: 28 }}>
          {/* Ticket Status Breakdown */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">🎫 Tickets by Accurate Status</div>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<Tip />} />
                  <Legend
                    formatter={(v) => (
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{v}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Asset Status Breakdown */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">🖥️ Assets by Status (Inventory & Repairs)</div>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={assetStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {assetStatusData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<Tip />} />
                  <Legend
                    formatter={(v) => (
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{v}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Priority Distribution */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">⚡ Tickets by Priority Level</div>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={priorityData}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {priorityData.map((e, i) => (
                      <Cell key={i} fill={e.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Distribution */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">📂 Tickets by Category</div>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={categoryData} layout="vertical">
                  <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Asset Types Distribution */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <div className="card-title">💻 Asset Inventory Distribution by Hardware Type</div>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={assetTypeData}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {assetTypeData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Detailed Data Tables */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* Support Team Workload Table */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} style={{ color: 'var(--accent)' }} />
                  Support Team Workload & Performance
                </div>
                <div className="card-subtitle">
                  Workload allocation and ticket resolution rates per support agent
                </div>
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Agent Name</th>
                      <th>User Code</th>
                      <th>Role</th>
                      <th style={{ textAlign: 'center' }}>Total Assigned</th>
                      <th style={{ textAlign: 'center' }}>In Progress</th>
                      <th style={{ textAlign: 'center' }}>Pending / Open</th>
                      <th style={{ textAlign: 'center' }}>Completed</th>
                      <th style={{ textAlign: 'center' }}>Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workload.map(su => {
                      const rate =
                        su.total_assigned > 0
                          ? Math.round((su.completed / su.total_assigned) * 100)
                          : 0;
                      return (
                        <tr key={su.id}>
                          <td className="td-primary">
                            <strong>{su.name}</strong>
                          </td>
                          <td style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>
                            {su.user_code}
                          </td>
                          <td>
                            <span className="badge badge-indigo">{su.role || 'SUPPORT'}</span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {su.total_assigned}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--info)', fontWeight: 600 }}>
                            {su.processing}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--warning)', fontWeight: 600 }}>
                            {su.pending}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 600 }}>
                            {su.completed}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                              <div
                                style={{
                                  width: 60,
                                  height: 6,
                                  background: 'var(--bg-secondary)',
                                  borderRadius: 3,
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${rate}%`,
                                    height: '100%',
                                    background: rate >= 70 ? 'var(--success)' : rate >= 40 ? 'var(--warning)' : 'var(--danger)',
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{rate}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {workload.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                          No support agents found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SLA Performance Summary */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} style={{ color: 'var(--accent)' }} />
                SLA Performance & Reliability Metrics
              </div>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                {[
                  { label: 'Total Tracked Tickets', value: sla?.total_tickets ?? '—' },
                  { label: 'SLA Breached Tickets', value: sla?.breached_tickets ?? '—', color: 'var(--danger)' },
                  { label: 'Active Non-Breached', value: (sla?.total_tickets ?? 0) - (sla?.breached_tickets ?? 0), color: 'var(--success)' },
                  { label: 'SLA Compliance Percentage', value: `${sla?.compliance_rate_percent?.toFixed(2) ?? '—'}%`, color: slaColor },
                  { label: 'Average Resolution Time', value: `${sla?.avg_resolution_time_hours?.toFixed(2) ?? '—'} hours` },
                ].map(item => (
                  <div
                    key={item.label}
                    style={{
                      textAlign: 'center',
                      padding: 18,
                      background: 'var(--glass)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--glass-border)',
                    }}
                  >
                    <div style={{ fontSize: 24, fontWeight: 800, color: item.color || 'var(--text-primary)', marginBottom: 6 }}>
                      {item.value}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity & Audit Logs */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Activity size={16} style={{ color: 'var(--accent)' }} />
                  Recent System Activity & Audit Trail
                </div>
                <div className="card-subtitle">
                  Audit log records of actions performed across assets, tickets, and accounts
                </div>
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Details</th>
                      <th>Ticket #</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs.map(log => (
                      <tr key={log.id}>
                        <td>
                          <span className="badge badge-indigo" style={{ fontFamily: 'monospace' }}>
                            {log.action}
                          </span>
                        </td>
                        <td className="td-primary" style={{ fontSize: 13 }}>
                          {log.details || '—'}
                        </td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--accent)', fontSize: 12 }}>
                          {log.ticket_id ? `#${log.ticket_id}` : '—'}
                        </td>
                        <td className="text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          {log.created_at ? format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss') : '—'}
                        </td>
                      </tr>
                    ))}
                    {activityLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                          No recent activity logs available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
