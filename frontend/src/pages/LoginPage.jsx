import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Mail, Lock, Sun, Moon, ShieldCheck, Zap, Activity } from 'lucide-react';
import logoImg from '../assets/logo.png';
import loginVideo from '../assets/login.mp4';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
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
      {/* Background glowing ambient orbs */}
      <div className="login-ambient-orb orb-1" />
      <div className="login-ambient-orb orb-2" />

      {/* Top Bar with Theme Switcher */}
      <div className="login-top-bar">
        <div className="login-brand-mini">
          <div className="login-brand-icon">
            <img src={logoImg} alt="Sahana Logo" className="brand-logo-img-mini" />
          </div>
          <span className="login-brand-name brand-title-yellow">Sahana IT Support System</span>
        </div>

        {/* Theme Mode Toggle (White Mode / Dark Mode) */}
        <div className="login-theme-switch-wrapper">
          <span className="theme-toggle-caption">T</span>
          <button
            type="button"
            className={`theme-mode-pill ${!isDark ? 'active-white' : ''}`}
            onClick={() => isDark && toggleTheme()}
            title="Switch to White / Light Mode"
            id="theme-white-btn"
          >
            <Sun size={15} />
            <span>White Mode</span>
          </button>
          <button
            type="button"
            className={`theme-mode-pill ${isDark ? 'active-dark' : ''}`}
            onClick={() => !isDark && toggleTheme()}
            title="Switch to Dark Mode"
            id="theme-dark-btn"
          >
            <Moon size={15} />
            <span>Dark Mode</span>
          </button>
        </div>
      </div>

      <div className="login-container">
        {/* Left Side: Login Card */}
        <div className="login-form-side">
          <div className="login-box">
            <div className="login-box-header">
              <div className="login-box-logo">
                <img src={logoImg} alt="Sahana Logo" className="brand-logo-img-card" />
              </div>
              <h2 className="brand-title-yellow">Sahana IT Support System</h2>
              <p>User Login</p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="input-with-icon">
                <Mail className="input-icon" />
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Username or Email address"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="input-with-icon">
                <Lock className="input-icon" />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="login-helpers">
                <a
                  href="#forgot"
                  className="forgot-password"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.error('Please contact your administrator to reset your credentials.', {
                      style: { background: '#ef4444', color: '#ffffff', fontWeight: 600 }
                    });
                  }}
                >
                  Forgot Password?
                </a>
              </div>

              <button className="login-btn-pill" type="submit" disabled={loading} id="login-submit-btn">
                {loading ? 'Authenticating...' : 'Sign In to Portal'}
              </button>
            </form>

            <div className="login-footer">
              <span>Powered by <strong>Sahana System Pvt. Ltd.</strong></span>
            </div>
          </div>
        </div>

        {/* Right Side: Showcase Login Image with Animation */}
        <div className="login-showcase-side">
          <div className="showcase-visual-wrapper">
            {/* Ambient Glowing Halo */}
            <div className="showcase-glow-halo" />

            {/* Floating Hero Card Container with Looping Silent Video */}
            <div className="showcase-image-container" onContextMenu={(e) => e.preventDefault()}>
              <video
                src={loginVideo}
                autoPlay
                loop
                muted
                defaultMuted
                playsInline
                disablePictureInPicture
                disableRemotePlayback
                controlsList="nodownload nofullscreen noremoteplayback"
                ref={(el) => { if (el) el.muted = true; }}
                className="showcase-hero-image showcase-hero-video"
              />

              {/* Floating Dynamic Badges */}
              <div className="floating-badge badge-top">
                <span className="badge-pulse-dot" />
                <span>⚡ Real-Time Asset Tracking</span>
              </div>

              <div className="floating-badge badge-bottom">
                <span className="badge-icon-shield">🛡️</span>
                <span>Protected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
