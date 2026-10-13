import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Monitor, Ticket, Users, BarChart3,
  LogOut, Settings, Shield, Laptop
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logoImg from '../assets/logo.png';
import toast from 'react-hot-toast';

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  );
}

export default function Sidebar() {
  const { user, logout, isAdmin, isAdminOrSupport } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <img src={logoImg} alt="Sahana Logo" className="brand-logo-img" />
        </div>
        <div className="sidebar-brand-text">
          <h2 className="brand-title-yellow">Sahana IT</h2>
          <span className="brand-subtitle-yellow">Support System</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <span className="nav-section-label">Overview</span>
        <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />

        <span className="nav-section-label">Assets & Tickets</span>
        {isAdmin && (
          <NavItem to="/assets" icon={Laptop} label="Assets" />
        )}
        <NavItem to="/tickets" icon={Ticket} label="Tickets" />

        {isAdminOrSupport && (
          <>
            <span className="nav-section-label">Reports</span>
            <NavItem to="/reports" icon={BarChart3} label="Reports & Analytics" />
          </>
        )}

        {isAdmin && (
          <>
            <span className="nav-section-label">Administration</span>
            <NavItem to="/users" icon={Users} label="User Management" />
          </>
        )}

        <div className="divider" />
        <NavItem to="/profile" icon={Settings} label="My Profile" />
      </nav>

      <div className="sidebar-user">
        <div className="user-avatar">{initials}</div>
        <div className="user-info">
          <div className="name">{user?.name}</div>
          <div className="role">{user?.role}</div>
        </div>
        <button className="btn btn-icon btn-secondary" onClick={handleLogout} title="Logout">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
