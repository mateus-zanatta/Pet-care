// Empacota as Functions (e o pacote @petcare/shared) em um único arquivo lib/index.js.
// firebase-admin e firebase-functions ficam de fora: o Firebase os instala no deploy.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['firebase-admin', 'firebase-admin/*', 'firebase-functions', 'firebase-functions/*'],
  logLevel: 'info',
});
