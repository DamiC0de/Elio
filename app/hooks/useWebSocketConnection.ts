/**
 * useWebSocketConnection — WebSocket connection management with auto-reconnect.
 * Handles connection, reconnection with backoff, ping/pong keepalive, and message sending.
 */
import { useState, useCallback, useRef, useEffect } from 'react';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://72.60.155.227:3001';
const WS_URL = API_URL.replace('http', 'ws');

// Ping interval for keep-alive (every 10s)
const PING_INTERVAL_MS = 10000;
// Initial reconnect delay
const INITIAL_RECONNECT_DELAY_MS = 1000;
// Max reconnect delay
const MAX_RECONNECT_DELAY_MS = 10000;

export interface WebSocketConnectionReturn {
  /** Whether WebSocket is connected */
  isConnected: boolean;
  /** Send a message through WebSocket */
  send: (message: object) => boolean;
  /** Manually connect */
  connect: () => void;
  /** Manually disconnect */
  disconnect: () => void;
  /** WebSocket ref for external message handling */
  wsRef: React.MutableRefObject<WebSocket | null>;
}

interface WebSocketConnectionOptions {
  /** Auth token for connection */
  token: string | null;
  /** Called when connection opens */
  onOpen?: () => void;
  /** Called when connection closes */
  onClose?: () => void;
  /** Called when a message is received */
  onMessage?: (event: MessageEvent) => void;
  /** Called on connection error */
  onError?: (error: Event) => void;
}

export function useWebSocketConnection(options: WebSocketConnectionOptions): WebSocketConnectionReturn {
  const { token, onOpen, onClose, onMessage, onError } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY_MS);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Store callbacks in refs
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  
  onOpenRef.current = onOpen;
  onCloseRef.current = onClose;
  onMessageRef.current = onMessage;
  onErrorRef.current = onError;

  const clearPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!token) return;
    
    intentionalCloseRef.current = false;
    
    const ws = new WebSocket(`${WS_URL}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS;
      
      // Keep-alive pings
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
          console.log('[WS] Ping sent');
        }
      }, PING_INTERVAL_MS);
      
      // Send first ping immediately
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
          console.log('[WS] Initial ping sent');
        }
      }, 1000);
      
      onOpenRef.current?.();
    };

    ws.onmessage = (event) => {
      onMessageRef.current?.(event);
    };

    ws.onclose = () => {
      clearPingInterval();
      setIsConnected(false);
      onCloseRef.current?.();

      // Auto-reconnect unless intentionally closed
      if (!intentionalCloseRef.current) {
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(delay * 1.5, MAX_RECONNECT_DELAY_MS);
        console.log(`[WS] Disconnected, reconnecting in ${delay}ms...`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!intentionalCloseRef.current) {
            connect();
          }
        }, delay);
      }
    };

    ws.onerror = (error) => {
      onErrorRef.current?.(error);
      // onclose will fire after onerror, reconnect handled there
    };
  }, [token, clearPingInterval]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearPingInterval();
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, [clearPingInterval]);

  const send = useCallback((message: object): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Auto-connect when token is available
  useEffect(() => {
    if (token) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  return {
    isConnected,
    send,
    connect,
    disconnect,
    wsRef,
  };
}
