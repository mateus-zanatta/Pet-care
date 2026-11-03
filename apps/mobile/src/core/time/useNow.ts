import { useEffect, useState } from 'react';

/** A hora atual, atualizada a cada `everyMs` (padrão: 1 minuto). Faz as doses "vencerem" na hora certa na tela. */
export function useNow(everyMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}
