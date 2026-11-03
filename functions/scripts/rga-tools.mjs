// Executa as ferramentas locais do RG Animal (src/rga/cli.ts) sem precisar compilar nada antes.
import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp = path.resolve('.tmp');
mkdirSync(tmp, { recursive: true });
const outfile = path.join(tmp, 'rga-cli.mjs');

await build({
  entryPoints: ['src/rga/cli.ts'],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  logLevel: 'silent',
  // Dependências com arquivos de dados ou código nativo ficam de fora (são lidas de node_modules).
  external: ['pdfjs-dist', 'pdfjs-dist/*', 'sharp', 'pdf-lib', 'qrcode'],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});

try {
  await import(pathToFileURL(outfile).href);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
