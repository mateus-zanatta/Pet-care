/**
 * Diagnóstico de rede para o desenvolvimento com os emuladores: o celular precisa alcançar
 * o computador. Qualquer resposta HTTP (até 404) prova que a porta está acessível;
 * erro/tempo esgotado indica IP errado, Firewall do Windows ou emulador desligado.
 */
/**
 * Portas dos emuladores (devem bater com firebase.json e firebase.lan.json).
 * O Firestore usa 8085 (e não a 8080 padrão) porque a 8080 costuma estar ocupada no Windows.
 */
export const EMULATOR_PORT = { auth: 9099, firestore: 8085, storage: 9199, functions: 5001 } as const;

export const EMULATOR_PORTS = [
  { name: 'Auth (login)', port: EMULATOR_PORT.auth },
  { name: 'Firestore (banco)', port: EMULATOR_PORT.firestore },
  { name: 'Storage (fotos)', port: EMULATOR_PORT.storage },
  { name: 'Functions (exclusão)', port: EMULATOR_PORT.functions },
] as const;

export type PingResult = { name: string; port: number; ok: boolean; detail: string };

export async function pingEmulators(
  host: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 3000,
): Promise<PingResult[]> {
  return Promise.all(
    EMULATOR_PORTS.map(async ({ name, port }): Promise<PingResult> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`http://${host}:${port}/`, { signal: controller.signal });
        return { name, port, ok: true, detail: `respondeu (HTTP ${response.status})` };
      } catch (error) {
        const aborted = controller.signal.aborted;
        const message = aborted ? `sem resposta em ${timeoutMs / 1000}s` : String((error as Error)?.message ?? error);
        return { name, port, ok: false, detail: message };
      } finally {
        clearTimeout(timer);
      }
    }),
  );
}

/* -------------------------------------------------------------------------- */
/*  Sonda do Firestore (o canal das gravações)                                 */
/* -------------------------------------------------------------------------- */

/** Rejeita se `promise` não terminar em `ms` (o resultado original é ignorado depois). */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operação'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: sem resposta em ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export type FirestoreProbeResult = { reached: boolean; detail: string };

/**
 * Interpreta o resultado de uma leitura de teste feita DIRETO NO SERVIDOR do Firestore.
 * O ping HTTP não prova que as gravações chegam (elas usam outro protocolo, o gRPC): esta leitura prova.
 * - Sem erro, ou "permission-denied": o servidor RESPONDEU (recusar por regras também é resposta).
 * - "unavailable" ou tempo esgotado: o celular não alcançou o Firestore.
 */
export function classifyFirestoreProbe(error: unknown): FirestoreProbeResult {
  if (error === null || error === undefined) return { reached: true, detail: 'o servidor respondeu' };
  const code = (error as { code?: string })?.code ?? '';
  const message = String((error as Error)?.message ?? error);
  if (code === 'firestore/permission-denied') {
    return { reached: true, detail: 'o servidor respondeu (recusou a leitura de teste pelas regras, o esperado)' };
  }
  if (code === 'firestore/unavailable' || /sem resposta/.test(message)) {
    return { reached: false, detail: `o celular NÃO alcançou o Firestore (${code || message})` };
  }
  return { reached: false, detail: `erro inesperado (${code || message})` };
}

/* -------------------------------------------------------------------------- */
/*  Configuração automática dos emuladores                                     */
/* -------------------------------------------------------------------------- */

export type EmulatorSettings =
  | { enabled: false; reason: string }
  | { enabled: true; host: string; reason: string; hostSource: 'env' | 'metro' | 'default' };

export type EmulatorInputs = {
  /** EXPO_PUBLIC_USE_EMULATORS */
  flag?: string;
  /** EXPO_PUBLIC_EMULATOR_HOST (opcional: sobrescreve a descoberta automática) */
  explicitHost?: string;
  /** Endereço do Metro, ex.: "192.168.0.10:8081" (o mesmo computador dos emuladores) */
  metroHostUri?: string;
  /** projectId do Firebase embutido no app (arquivo google-services.json) */
  projectId?: string;
};

/** Extrai só o host de "192.168.0.10:8081" ou "http://192.168.0.10:8081/index.bundle?...". */
export function hostFromUri(uri?: string): string | undefined {
  if (!uri) return undefined;
  const match = /^(?:[a-z]+:\/\/)?([^/:?#]+)/i.exec(uri.trim());
  const host = match?.[1];
  return host || undefined;
}

/**
 * Decide se o app usa os emuladores e em qual endereço.
 * - Projeto "demo-*" (arquivos Firebase falsos do perfil development-emulators): SEMPRE emuladores.
 * - Qualquer outro projeto: só se EXPO_PUBLIC_USE_EMULATORS=true.
 * - Endereço: EXPO_PUBLIC_EMULATOR_HOST > endereço do Metro (mesmo computador) > 10.0.2.2.
 */
export function resolveEmulatorSettings(input: EmulatorInputs): EmulatorSettings {
  const demoProject = (input.projectId ?? '').startsWith('demo-');
  if (!demoProject && input.flag !== 'true') {
    return { enabled: false, reason: 'EXPO_PUBLIC_USE_EMULATORS não é "true" e o app usa um projeto Firebase real' };
  }
  const reason = demoProject
    ? `projeto de demonstração "${input.projectId}" (build sem Firebase real)`
    : 'EXPO_PUBLIC_USE_EMULATORS=true';

  if (input.explicitHost) return { enabled: true, host: input.explicitHost, reason, hostSource: 'env' };
  const metroHost = hostFromUri(input.metroHostUri);
  if (metroHost) return { enabled: true, host: metroHost, reason, hostSource: 'metro' };
  return { enabled: true, host: '10.0.2.2', reason, hostSource: 'default' };
}
