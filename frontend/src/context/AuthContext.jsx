import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/endpoints';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Attempt session verification via HttpOnly cookie or token
    authAPI.me()
      .then(res => {
        setUser(res.data);
        localStorage.setItem('user', JSON.stringify(res.data));
      })
      .catch(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const res = await authAPI.login(username, password);
    // Maintain localStorage as dual-storage fallback while HttpOnly cookie manages session
    if (res.data.access_token) {
      localStorage.setItem('access_token', res.data.access_token);
    }
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  const isAdmin = user?.role === 'ADMIN';
  const isSupport = user?.role === 'SUPPORT';
  const isEmployee = user?.role === 'EMPLOYEE';
  const isAdminOrSupport = isAdmin || isSupport;

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin, isSupport, isEmployee, isAdminOrSupport }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
