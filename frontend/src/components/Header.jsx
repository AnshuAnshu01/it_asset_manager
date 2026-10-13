import { Bell, Wifi, WifiOff, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Header({ title, subtitle, wsConnected }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="header">
      <div className="header-left">
        <div>
          <div className="header-title">{title}</div>
          {subtitle && <div className="header-subtitle">{subtitle}</div>}
        </div>
      </div>
      <div className="header-right">
        <button
          type="button"
          className="theme-header-toggle"
          onClick={toggleTheme}
          title={isDark ? "Switch to White Mode" : "Switch to Dark Mode"}
          aria-label="Toggle theme"
        >
          {isDark ? (
            <>
              <Sun size={16} className="theme-toggle-icon sun-icon" />
              <span className="theme-toggle-label">White Mode</span>
            </>
          ) : (
            <>
              <Moon size={16} className="theme-toggle-icon moon-icon" />
              <span className="theme-toggle-label">Dark Mode</span>
            </>
          )}
        </button>

        <div className={`ws-badge ${wsConnected ? 'connected' : 'disconnected'}`}>
          <span className="ws-dot" />
          {wsConnected ? 'Live' : 'Reconnecting...'}
        </div>
      </div>
    </header>
  );
}
