/**
 * Libera as portas dos emuladores do Firebase quando um emulador "órfão" ficou rodando (janela fechada,
 * PC em suspensão, Ctrl+C que não terminou o Java). Roda com:  npm run emulators:free
 *
 * SEGURANÇA: só encerra processos Java ou Node (os emuladores). Se outra coisa estiver usando a porta,
 * apenas avisa quem é, para você decidir.
 */
import { execFileSync } from 'node:child_process';

/** Portas usadas pelos emuladores (firebase.json / firebase.lan.json + as reservadas pela interface). */
export const EMULATOR_PORTS = [4000, 4400, 4500, 5001, 8085, 9099, 9150, 9151, 9199, 9299, 9499] as const;

/** Programas que podem ser encerrados (o emulador do Firestore é Java; os demais são Node). */
export const KILLABLE = new Set(['java', 'java.exe', 'javaw.exe', 'node', 'node.exe']);

/**
 * Lê a saída de `netstat -ano` do Windows e devolve os PIDs que ESCUTAM a porta.
 * Não depende da palavra "LISTENING" (traduzida em alguns idiomas): um socket que escuta tem o
 * endereço remoto zerado (0.0.0.0:0 ou [::]:0).
 */
export function parseWindowsNetstat(output: string, port: number): number[] {
  const pids = new Set<number>();
  for (const line of output.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5 || !/^TCP/i.test(parts[0] ?? '')) continue;
    const [, local = '', remote = '', , pid = ''] = parts;
    const listening = /(?:0\.0\.0\.0|\[::\]|\*):0$/.test(remote);
    if (listening && local.endsWith(`:${port}`) && /^\d+$/.test(pid)) pids.add(Number(pid));
  }
  return [...pids];
}

/** Primeira coluna (nome do programa) da saída de `tasklist /FO CSV /NH`. */
export function parseTasklistName(csv: string): string | null {
  const match = /^"([^"]+)"/.exec(csv.trim().split(/\r?\n/)[0] ?? '');
  return match?.[1]?.toLowerCase() ?? null;
}

/** PIDs da saída de `lsof -t` (macOS/Linux). */
export function parseLsofPids(output: string): number[] {
  return output
    .split(/\s+/)
    .filter((t) => /^\d+$/.test(t))
    .map(Number);
}

const run = (command: string, args: string[]): string => {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
};

type Owner = { port: number; pid: number; name: string };

function findOwnersWindows(): Owner[] {
  const netstat = `${run('netstat', ['-ano', '-p', 'tcp'])}\n${run('netstat', ['-ano', '-p', 'tcpv6'])}`;
  const owners = new Map<number, Owner>();
  for (const port of EMULATOR_PORTS) {
    for (const pid of parseWindowsNetstat(netstat, port)) {
      const name = parseTasklistName(run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'])) ?? 'desconhecido';
      if (!owners.has(pid)) owners.set(pid, { port, pid, name });
    }
  }
  return [...owners.values()];
}

function findOwnersUnix(): Owner[] {
  const owners = new Map<number, Owner>();
  for (const port of EMULATOR_PORTS) {
    for (const pid of parseLsofPids(run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']))) {
      const name = run('ps', ['-p', String(pid), '-o', 'comm=']).trim().split('/').pop() ?? 'desconhecido';
      if (!owners.has(pid)) owners.set(pid, { port, pid, name: name.toLowerCase() });
    }
  }
  return [...owners.values()];
}

function kill(pid: number): void {
  if (process.platform === 'win32') run('taskkill', ['/PID', String(pid), '/F', '/T']);
  else process.kill(pid, 'SIGKILL');
}

export function freeEmulatorPorts(): number {
  const owners = process.platform === 'win32' ? findOwnersWindows() : findOwnersUnix();
  if (owners.length === 0) {
    console.log('Portas dos emuladores livres: nada a fazer.');
    return 0;
  }
  let blocked = 0;
  for (const { port, pid, name } of owners) {
    if (KILLABLE.has(name)) {
      kill(pid);
      console.log(`Encerrado emulador antigo: ${name} (PID ${pid}) que usava a porta ${port}.`);
    } else {
      blocked += 1;
      console.log(`A porta ${port} está em uso por "${name}" (PID ${pid}), que não é um emulador. Feche esse programa manualmente.`);
    }
  }
  return blocked;
}

// Execução direta (pelo script scripts/free-ports.mjs).
if (process.argv.includes('--run-free-ports')) process.exitCode = freeEmulatorPorts() > 0 ? 1 : 0;
