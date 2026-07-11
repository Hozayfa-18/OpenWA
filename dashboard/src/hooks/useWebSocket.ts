import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SessionStatusEvent {
  sessionId: string;
  status: string;
  timestamp: string;
}

interface QRCodeEvent {
  sessionId: string;
  qrCode: string;
  timestamp: string;
}

interface MessageEvent {
  sessionId: string;
  message: Record<string, unknown>;
  timestamp: string;
}

interface WebSocketEvents {
  onSessionStatus?: (event: SessionStatusEvent) => void;
  onQRCode?: (event: QRCodeEvent) => void;
  onMessage?: (event: MessageEvent) => void;
}

// The server wraps every room event in a single `message` socket event using
// this envelope. There are no per-event socket names (`session:status` etc.).
interface WSEventEnvelope {
  type: string;
  payload?: { event: string; sessionId: string; data: Record<string, unknown> };
  timestamp?: string;
}

// Use current origin for WebSocket (goes through nginx proxy in Docker)
// Falls back to env var or localhost for development
const SOCKET_URL = import.meta.env.VITE_WS_URL || window.location.origin;

export function useWebSocket(events: WebSocketEvents = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Keep the latest callbacks in a ref so the single `message` listener always
  // dispatches to current handlers without having to re-bind the socket.
  const handlersRef = useRef(events);
  handlersRef.current = events;

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(`${SOCKET_URL}/events`, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      // Clerk session token, fetched fresh on each (re)connect handshake.
      auth: (cb: (data: { token: string | null }) => void) => {
        void getAuthToken().then(token => cb({ token }));
      },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      setIsConnected(true);
      // Session/QR events are emitted to per-session rooms. Subscribe with the
      // `*` wildcard so we receive them for every session in the tenant; without
      // this the client only sits in the bare tenant room and never sees them.
      socket.emit('message', {
        type: 'subscribe',
        sessionId: '*',
        events: ['session.status', 'session.qr', 'message.received'],
      });
    });

    socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', error => {
      console.warn('[WebSocket] Connection error:', error.message);
    });

    // All room events arrive on the `message` channel wrapped in an envelope;
    // unwrap and route by the inner event name.
    socket.on('message', (msg: WSEventEnvelope) => {
      if (msg?.type !== 'event' || !msg.payload) return;
      const { event, sessionId, data } = msg.payload;
      const timestamp = msg.timestamp ?? new Date().toISOString();
      const handlers = handlersRef.current;

      switch (event) {
        case 'session.status':
          handlers.onSessionStatus?.({ sessionId, status: String(data.status), timestamp });
          break;
        case 'session.qr':
          handlers.onQRCode?.({ sessionId, qrCode: String(data.qrCode), timestamp });
          break;
        case 'message.received':
          handlers.onMessage?.({ sessionId, message: data, timestamp });
          break;
      }
    });
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect]);

  return { isConnected };
}
