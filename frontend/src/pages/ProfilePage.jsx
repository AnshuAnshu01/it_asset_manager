import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import Header from '../components/Header';
import { RoleBadge } from '../components/Badge';
import { User, Mail, Building, Shield, Calendar, Hash } from 'lucide-react';
import { format } from 'date-fns';

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--glass-border)' }}>
      <div style={{ width: 36, height: 36, background: 'rgba(99,102,241,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} color="var(--accent)" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{value || '—'}</div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const wsHook = useWebSocket();
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <>
      <Header title="My Profile" subtitle="Account information" wsConnected={wsHook.connected} />
      <div className="page-content" style={{ maxWidth: 700, margin: '0 auto' }}>
        <div className="card">
          {/* Profile Header */}
          <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 24, borderBottom: '1px solid var(--glass-border)' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 800,
              boxShadow: '0 0 32px var(--accent-glow)',
              flexShrink: 0,
            }}>{initials}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{user?.name}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <RoleBadge role={user?.role} />
                {user?.is_active
                  ? <span className="badge badge-resolved">Active</span>
                  : <span className="badge badge-closed">Inactive</span>}
              </div>
            </div>
          </div>

          {/* Info Rows */}
          <div style={{ padding: '0 32px 24px' }}>
            <InfoRow icon={Hash} label="User Code" value={user?.user_code} />
            <InfoRow icon={User} label="Full Name" value={user?.name} />
            <InfoRow icon={Mail} label="Email" value={user?.email} />
            <InfoRow icon={Building} label="Department" value={user?.department} />
            <InfoRow icon={Shield} label="Role" value={user?.role} />
            <InfoRow icon={Calendar} label="Account Created"
              value={user?.created_at ? format(new Date(user.created_at), 'MMMM d, yyyy') : '—'} />
          </div>
        </div>

        {/* Quick Link Card to Asset Requests */}
        <div className="card" style={{ marginTop: 28, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Need Equipment or Hardware?</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {user?.role === 'ADMIN'
                ? 'Review and fulfill hardware requests submitted by staff members.'
                : 'Submit an asset request for a laptop, monitor, or peripherals to the administrator.'}
            </div>
          </div>
          <Link to="/asset-requests" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
            {user?.role === 'ADMIN' ? 'Manage Asset Requests' : 'Request IT Asset'}
          </Link>
        </div>


      </div>
    </>
  );
}
