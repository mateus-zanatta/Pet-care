// Libera as portas dos emuladores do Firebase (veja src/devtools/freePorts.ts).
import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp = path.resolve('.tmp');
mkdirSync(tmp, { recursive: true });
const outfile = path.join(tmp, 'free-ports.mjs');

await build({
  entryPoints: ['src/devtools/freePorts.ts'],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  logLevel: 'silent',
});

process.argv.push('--run-free-ports');
try {
  await import(pathToFileURL(outfile).href);
} finally {
  // O módulo ajusta process.exitCode; só limpamos o arquivo temporário.
  rmSync(tmp, { recursive: true, force: true });
}
