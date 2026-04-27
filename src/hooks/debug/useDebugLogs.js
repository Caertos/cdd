import { useState, useEffect } from 'react';
import { logger } from '../../helpers/logger.js';

export function useDebugLogs() {
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);

  useEffect(() => {
    const unsubscribe = logger.subscribe((entry) => {
      setDebugLogs((prev) => {
        const extras = (entry.args || [])
          .map((arg) => {
            if (typeof arg === 'string') return arg;
            if (typeof arg === 'number' || typeof arg === 'boolean')
              return String(arg);
            try {
              return JSON.stringify(arg);
            } catch (err) {
              return '[unserializable]';
            }
          })
          .filter(Boolean);
        const line = extras.length
          ? `${entry.formatted} ${extras.join(' ')}`
          : entry.formatted;
        const next = [...prev, line];
        return next.slice(-200);
      });
    });
    return unsubscribe;
  }, []);

  return { showDebugLogs, setShowDebugLogs, debugLogs };
}
