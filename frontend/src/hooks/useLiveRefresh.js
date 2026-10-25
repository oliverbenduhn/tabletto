import { useEffect, useRef, useState } from 'react';

/** Refreshes visible data after tab/network return and once a minute; pauses for edits. */
export default function useLiveRefresh(refresh, paused = false) {
  const callback = useRef(refresh);
  callback.current = refresh;
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    let running = false;
    const run = async () => {
      setOnline(navigator.onLine);
      if (paused || running || document.visibilityState !== 'visible' || !navigator.onLine) return;
      running = true;
      try { await callback.current(); } finally { running = false; }
    };
    const network = () => { setOnline(navigator.onLine); run(); };
    const timer = setInterval(run, 60000);
    window.addEventListener('focus', run);
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    document.addEventListener('visibilitychange', run);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', run);
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
      document.removeEventListener('visibilitychange', run);
    };
  }, [paused]);
  return online;
}
