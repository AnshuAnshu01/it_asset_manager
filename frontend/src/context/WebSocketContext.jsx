import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { API_BASE } from '../api/client';

const WS_URL = API_BASE.replace('http', 'ws') + '/ws';
const WebSocketContext = createContext({ connected: false, messages: [], lastEvent: null });

export function WebSocketProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [lastEvent, setLastEvent] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;

    function connect() {
      if (isCancelled) return;
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      try {
        const socket = new WebSocket(WS_URL);
        wsRef.current = socket;

        socket.onopen = () => {
          if (isCancelled) {
            socket.close();
            return;
          }
          setConnected(true);

          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: 'PING' }));
            }
          }, 30000);
        };

        socket.onmessage = (e) => {
          if (isCancelled) return;
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'PONG') return;
            setMessages((prev) => [data, ...prev].slice(0, 50));
            setLastEvent(data);
          } catch (_) {}
        };

        socket.onclose = () => {
          if (isCancelled) return;
          setConnected(false);
          clearInterval(pingIntervalRef.current);
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        };

        socket.onerror = () => {
          socket.close();
        };
      } catch (_) {
        if (!isCancelled) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        }
      }
    }

    connect();

    return () => {
      isCancelled = true;
      clearInterval(pingIntervalRef.current);
      clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ connected, messages, lastEvent }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export const useWebSocket = () => useContext(WebSocketContext);
