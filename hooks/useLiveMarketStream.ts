'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface LiveTick {
  securityId: number;
  ltp: number;
  prevClose: number;
  netChange: number;
  percentChange: number;
  companyName: string;
  symbol: string;
  open: number;
  high: number;
  low: number;
  volume: number;
}

export function useLiveMarketStream() {
  const [liveTicks, setLiveTicks] = useState<Map<string, LiveTick>>(new Map());
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) return;

    const es = new EventSource('/api/market/stream');
    esRef.current = es;

    es.addEventListener('status', (event) => {
      const data = JSON.parse(event.data);
      setConnected(data.connected);
    });

    es.addEventListener('snapshot', (event) => {
      const quotes: LiveTick[] = JSON.parse(event.data);
      setLiveTicks((prev) => {
        const next = new Map(prev);
        for (const q of quotes) {
          next.set(q.companyName, q);
        }
        return next;
      });
      setConnected(true);
    });

    es.addEventListener('update', (event) => {
      const quotes: LiveTick[] = JSON.parse(event.data);
      setLiveTicks((prev) => {
        const next = new Map(prev);
        for (const q of quotes) {
          next.set(q.companyName, q);
        }
        return next;
      });
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;
      // Reconnect after 3 seconds
      setTimeout(connect, 3000);
    };
  }, []);

  const disconnect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return { liveTicks, connected };
}
