import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { ProtectedRoute, GuestRoute } from './components/ProtectedRoute';
import BackgroundVideo from './components/BackgroundVideo';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AssetsPage from './pages/AssetsPage';
import TicketsPage from './pages/TicketsPage';
import UsersPage from './pages/UsersPage';
import ReportsPage from './pages/ReportsPage';
import ProfilePage from './pages/ProfilePage';
import AssetRequestsPage from './pages/AssetRequestsPage';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WebSocketProvider>
          <BackgroundVideo />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route element={<GuestRoute />}>
                <Route path="/login" element={<LoginPage />} />
              </Route>

              {/* Protected routes — any authenticated user */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/tickets" element={<TicketsPage />} />
                  <Route path="/asset-requests" element={<AssetRequestsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />

                  {/* Admin + Support only */}
                  <Route element={<ProtectedRoute requiredRoles={['ADMIN', 'SUPPORT']} />}>
                    <Route path="/reports" element={<ReportsPage />} />
                  </Route>

                  {/* Admin only */}
                  <Route element={<ProtectedRoute requiredRoles={['ADMIN']} />}>
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/assets" element={<AssetsPage />} />
                  </Route>
                </Route>
              </Route>

              {/* Catch all → redirect */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>

          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--glass-border)',
                borderRadius: '10px',
                fontSize: '14px',
                boxShadow: 'var(--shadow)',
              },
              success: { iconTheme: { primary: '#eab308', secondary: '#ffffff' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#ffffff' } },
            }}
          />
        </WebSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
