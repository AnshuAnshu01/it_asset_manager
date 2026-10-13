import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return toast.error('Please fill in all fields');
    setLoading(true);
    try {
      const user = await login(username, password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Login failed. Check your credentials.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-form-side">
        <div className="login-box">
          <div className="login-box-logo">
            <div style={{ fontSize: 40, color: '#0b3d91', marginBottom: 12 }}>🏢</div>
          </div>
          <h2>Asset Management System</h2>
          <p>User Login</p>

          <form onSubmit={handleSubmit}>
            <div className="input-with-icon">
              <Mail />
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="User Email"
                autoComplete="username"
              />
            </div>

            <div className="input-with-icon">
              <Lock />
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
              />
            </div>

            <a href="#" className="forgot-password" onClick={(e) => { 
              e.preventDefault(); 
              toast.error('Please contact the admin if you have forgotten your password or need any changes.', {
                style: { background: '#ef4444', color: '#ffffff', fontWeight: 600 }
              }); 
            }}>Forgot Password?</a>

            <button className="login-btn-pill" type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="login-footer">
            Powered By: Sahana System Pvt. Ltd.
          </div>
        </div>
      </div>

      <div className="login-image-side" />
    </div>
  );
}
