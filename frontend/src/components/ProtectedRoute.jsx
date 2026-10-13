import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ requiredRoles }) {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="loading" style={{ height: '100vh' }}>
      <div className="spinner" />
      <span>Authenticating...</span>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;
  if (requiredRoles && !requiredRoles.includes(user.role)) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}

export function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
