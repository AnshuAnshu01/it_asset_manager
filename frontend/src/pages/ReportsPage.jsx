import { useEffect, useState } from 'react';
import { reportsAPI } from '../api/endpoints';
import { useWebSocket } from '../hooks/useWebSocket';
import Header from '../components/Header';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import { TrendingUp, AlertTriangle, CheckCircle, BarChart3 } from 'lucide-react';

const PALETTE = ['#eab308', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const STATUS_COLORS = { OPEN: '#eab308', ASSIGNED: '#f59e0b', IN_PROGRESS: '#3b82f6', RESOLVED: '#10b981', CLOSED: '#94a3b8' };
const PRIORITY_COLORS = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444', CRITICAL: '#dc2626' };
const ASSET_COLORS = { AVAILABLE: '#10b981', ASSIGNED: '#eab308', UNDER_REPAIR: '#f59e0b', RETIRED: '#94a3b8', LOST: '#ef4444' };

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '10px 14px' }}>
      {label && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</p>}
      {payload.map(p => (
        <p key={p.name} style={{ fontSize: 14, color: p.fill || p.color || 'var(--accent)', fontWeight: 600 }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const wsHook = useWebSocket();
  const [data, setData] = useState({ tickets: null, assets: null, sla: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([reportsAPI.tickets(), reportsAPI.assets(), reportsAPI.sla()])
      .then(([t, a, s]) => setData({ tickets: t.data, assets: a.data, sla: s.data }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <>
      <Header title="Reports & Analytics" wsConnected={wsHook.connected} />
      <div className="page-content"><div className="loading"><div className="spinner" /><span>Loading reports...</span></div></div>
    </>
  );

  const { tickets, assets, sla } = data;

  const statusData = tickets ? Object.entries(tickets.by_status).map(([k, v]) => ({ name: k, value: v, fill: STATUS_COLORS[k] || '#6366f1' })) : [];
  const priorityData = tickets ? Object.entries(tickets.by_priority).map(([k, v]) => ({ name: k, value: v, fill: PRIORITY_COLORS[k] })) : [];
  const categoryData = tickets ? Object.entries(tickets.by_category).map(([k, v]) => ({ name: k, value: v })) : [];
  const assetStatusData = assets ? Object.entries(assets.by_status).map(([k, v]) => ({ name: k, value: v, fill: ASSET_COLORS[k] || '#6366f1' })) : [];
  const assetTypeData = assets ? Object.entries(assets.by_type).map(([k, v]) => ({ name: k, value: v })) : [];

  const slaColor = sla?.compliance_rate_percent >= 80 ? 'var(--success)'
    : sla?.compliance_rate_percent >= 60 ? 'var(--warning)' : 'var(--danger)';

  return (
    <>
      <Header title="Reports & Analytics" subtitle="System-wide metrics and insights" wsConnected={wsHook.connected} />
      <div className="page-content">
        {/* Top KPI Stats */}
        <div className="stats-grid">
          <div className="stat-card indigo">
            <div className="stat-icon indigo"><BarChart3 size={18} /></div>
            <div className="stat-value">{tickets?.total_tickets ?? '—'}</div>
            <div className="stat-label">Total Tickets</div>
          </div>
          <div className="stat-card emerald">
            <div className="stat-icon emerald"><CheckCircle size={18} /></div>
            <div className="stat-value" style={{ color: slaColor }}>
              {sla?.compliance_rate_percent?.toFixed(1) ?? '—'}%
            </div>
            <div className="stat-label">SLA Compliance</div>
          </div>
          <div className="stat-card rose">
            <div className="stat-icon rose"><AlertTriangle size={18} /></div>
            <div className="stat-value">{sla?.breached_tickets ?? '—'}</div>
            <div className="stat-label">SLA Breaches</div>
          </div>
          <div className="stat-card amber">
            <div className="stat-icon amber"><TrendingUp size={18} /></div>
            <div className="stat-value">{sla?.avg_resolution_time_hours?.toFixed(1) ?? '—'}h</div>
            <div className="stat-label">Avg Resolution Time</div>
          </div>
          <div className="stat-card violet">
            <div className="stat-icon violet">🖥️</div>
            <div className="stat-value">{assets?.total_assets ?? '—'}</div>
            <div className="stat-label">Total Assets</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Ticket Status Pie */}
          <div className="card">
            <div className="card-header"><div className="card-title">🎫 Tickets by Status</div></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value">
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip content={<Tip />} />
                  <Legend formatter={(v) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Priority Bar */}
          <div className="card">
            <div className="card-header"><div className="card-title">⚡ Tickets by Priority</div></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={priorityData}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {priorityData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Bar */}
          <div className="card">
            <div className="card-header"><div className="card-title">📂 Tickets by Category</div></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={categoryData} layout="vertical">
                  <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {categoryData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Asset Status Pie */}
          <div className="card">
            <div className="card-header"><div className="card-title">🖥️ Assets by Status</div></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={assetStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value">
                    {assetStatusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip content={<Tip />} />
                  <Legend formatter={(v) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Asset Types */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header"><div className="card-title">💻 Asset Distribution by Type</div></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={assetTypeData}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {assetTypeData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SLA Summary Table */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header"><div className="card-title">⏱ SLA Summary</div></div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                {[
                  { label: 'Total Tickets', value: sla?.total_tickets ?? '—' },
                  { label: 'SLA Breached', value: sla?.breached_tickets ?? '—', color: 'var(--danger)' },
                  { label: 'Compliance Rate', value: `${sla?.compliance_rate_percent?.toFixed(2) ?? '—'}%`, color: slaColor },
                  { label: 'Avg Resolution', value: `${sla?.avg_resolution_time_hours?.toFixed(2) ?? '—'}h` },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: 'center', padding: 20, background: 'var(--glass)', borderRadius: 'var(--radius)', border: '1px solid var(--glass-border)' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: item.color || 'var(--text-primary)', marginBottom: 6 }}>{item.value}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
