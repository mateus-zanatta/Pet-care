/**
 * Espera a gravação ser confirmada pelo servidor. Se o servidor não responder a tempo (sem internet, emulador
 * inacessível), segue em frente como "pending": o Firestore guarda localmente e sincroniza depois.
 * Se a gravação for RECUSADA (regras, validação), o erro continua sendo lançado — nunca fica escondido.
 */
export async function settleOrOffline(write: Promise<unknown>, timeoutMs = 10_000): Promise<'committed' | 'pending'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'pending'>((resolve) => {
    timer = setTimeout(() => resolve('pending'), timeoutMs);
  });
  try {
    return await Promise.race([write.then(() => 'committed' as const), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
