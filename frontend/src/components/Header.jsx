import { Bell, Wifi, WifiOff } from 'lucide-react';

export default function Header({ title, subtitle, wsConnected }) {
  return (
    <header className="header">
      <div className="header-left">
        <div>
          <div className="header-title">{title}</div>
          {subtitle && <div className="header-subtitle">{subtitle}</div>}
        </div>
      </div>
      <div className="header-right">
        <div className={`ws-badge ${wsConnected ? 'connected' : 'disconnected'}`}>
          <span className="ws-dot" />
          {wsConnected ? 'Live' : 'Reconnecting...'}
        </div>
      </div>
    </header>
  );
}
