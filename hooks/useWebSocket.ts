// hooks/useWebSocket.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthService } from '@/services/auth.service';
import type { WebSocketMessage, WsEventType } from '@/types/chat';

const DEFAULT_WS_URL = 'ws://localhost:8000/ws';

export type WsCallback = (type: WsEventType, payload: any, raw: WebSocketMessage) => void;

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [k: string]: JsonValue };

interface UseWebSocketOptions {
  pingIntervalMs?: number;
  maxReconnectAttempts?: number;
  initialReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  debug?: boolean;
}

export function useWebSocket(onEvent: WsCallback, opts: UseWebSocketOptions = {}) {
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? DEFAULT_WS_URL;

  const {
    pingIntervalMs = 10_000,
    maxReconnectAttempts = 5,
    initialReconnectDelayMs = 1_000,
    maxReconnectDelayMs = 30_000,
    debug = false,
  } = opts;

  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reconnectAttemptsRef = useRef(0);
  const closedByClientRef = useRef(false);

  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const log = useCallback(
    (...args: any[]) => {
      if (debug) console.log('[ws]', ...args);
    },
    [debug]
  );

  const clearTimers = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    closedByClientRef.current = true;
    clearTimers();

    const ws = wsRef.current;
    wsRef.current = null;

    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
    setIsConnected(false);
  }, [clearTimers]);

  const connectRef = useRef<(() => void) | null>(null);

  const connect = useCallback(() => {
    closedByClientRef.current = false;

    const token = AuthService.getToken();
    if (!token) {
      console.error('No token found, cannot connect to WebSocket');
      return;
    }

    // закрываем старый коннект перед новым
    disconnect();

    try {
      const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        log('connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        clearTimers();
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping', payload: {} }));
          }
        }, pingIntervalMs);
      };

      ws.onmessage = (event) => {
        let data: WebSocketMessage;
        try {
          data = JSON.parse(event.data);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
          return;
        }

        if (!data || typeof data.type !== 'string') return;

        if (data.type === 'pong') {
          log('pong');
          return;
        }

        onEventRef.current(data.type, data.payload, data);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        setIsConnected(false);
        clearTimers();

        if (closedByClientRef.current) return;

        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error('Max reconnection attempts reached');
          return;
        }

        reconnectAttemptsRef.current += 1;
        const expDelay = initialReconnectDelayMs * Math.pow(2, reconnectAttemptsRef.current);
        const delay = Math.min(expDelay, maxReconnectDelayMs);

        reconnectTimeoutRef.current = setTimeout(() => {
          connectRef.current?.();
        }, delay);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [
    WS_URL,
    clearTimers,
    disconnect,
    initialReconnectDelayMs,
    maxReconnectAttempts,
    maxReconnectDelayMs,
    pingIntervalMs,
    log,
  ]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = useCallback(
    (type: WsEventType, payload: Record<string, JsonValue> | JsonValue = {}) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket is not connected');
      }
      const msg: WebSocketMessage = { type, payload };
      ws.send(JSON.stringify(msg));
      log('sent', msg);
    },
    [log]
  );

  return { isConnected, sendMessage, disconnect, reconnect: connect };
}
