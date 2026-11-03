import { describe, expect, it } from 'vitest';
import { KILLABLE, parseLsofPids, parseTasklistName, parseWindowsNetstat } from './freePorts';

const ENGLISH = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1040
  TCP    0.0.0.0:8085           0.0.0.0:0              LISTENING       12345
  TCP    0.0.0.0:9099           0.0.0.0:0              LISTENING       777
  TCP    127.0.0.1:8085         127.0.0.1:50321        ESTABLISHED     12345
  TCP    192.168.8.12:50111     192.168.8.20:9099      ESTABLISHED     4242
`;

const PORTUGUESE = `
Conexões ativas

  Proto  Endereço local         Endereço externo       Estado          PID
  TCP    0.0.0.0:8085           0.0.0.0:0              OUVINDO         9876
  TCP    [::]:5001              [::]:0                 OUVINDO         555
`;

describe('parseWindowsNetstat', () => {
  it('acha o PID que escuta a porta', () => {
    expect(parseWindowsNetstat(ENGLISH, 8085)).toEqual([12345]);
    expect(parseWindowsNetstat(ENGLISH, 9099)).toEqual([777]);
  });
  it('ignora conexões já estabelecidas (que usam a porta como destino) e portas livres', () => {
    expect(parseWindowsNetstat(ENGLISH, 50111)).toEqual([]);
    expect(parseWindowsNetstat(ENGLISH, 5001)).toEqual([]);
    expect(parseWindowsNetstat(ENGLISH, 135)).toEqual([1040]);
  });
  it('funciona com o Windows em português (estado "OUVINDO") e com IPv6', () => {
    expect(parseWindowsNetstat(PORTUGUESE, 8085)).toEqual([9876]);
    expect(parseWindowsNetstat(PORTUGUESE, 5001)).toEqual([555]);
  });
  it('não confunde portas parecidas (808 x 8085)', () => {
    expect(parseWindowsNetstat(ENGLISH, 808)).toEqual([]);
  });
});

describe('parseTasklistName', () => {
  it('lê o nome do programa', () => {
    expect(parseTasklistName('"java.exe","12345","Console","1","310.220 K"\r\n')).toBe('java.exe');
    expect(parseTasklistName('"Node.exe","4","Console","1","90 K"')).toBe('node.exe');
  });
  it('devolve null quando o processo não existe mais', () => {
    expect(parseTasklistName('INFO: No tasks are running which match the specified criteria.')).toBeNull();
    expect(parseTasklistName('')).toBeNull();
  });
});

describe('parseLsofPids', () => {
  it('lê os PIDs (macOS/Linux)', () => {
    expect(parseLsofPids('123\n456\n')).toEqual([123, 456]);
    expect(parseLsofPids('')).toEqual([]);
  });
});

describe('segurança', () => {
  it('só encerra Java e Node (os emuladores), nunca outros programas', () => {
    expect(KILLABLE.has('java.exe')).toBe(true);
    expect(KILLABLE.has('node.exe')).toBe(true);
    for (const other of ['chrome.exe', 'svchost.exe', 'docker.exe', 'system', 'idea64.exe']) expect(KILLABLE.has(other)).toBe(false);
  });
});
