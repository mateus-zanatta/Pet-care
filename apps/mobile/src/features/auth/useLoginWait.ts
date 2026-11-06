import { useCallback, useEffect, useState } from 'react';

const clock = () => Date.now();

/** Contagem regressiva da espera entre tentativas de login (atualiza 1x por segundo, só enquanto há espera). */
export function useLoginWait() {
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(clock);

  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => {
      const t = clock();
      setNow(t);
      if (t >= until) {
        setUntil(null);
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);

  const start = useCallback((ms: number) => {
    const t = clock();
    setNow(t);
    setUntil(t + ms);
  }, []);

  return { seconds: until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0, start };
}
