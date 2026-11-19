// Compile le processus principal, le preload et l'interface dans dist/.
import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';

const common = { bundle: true, sourcemap: true, logLevel: 'warning', target: 'es2022' };

mkdirSync('dist', { recursive: true });

await Promise.all([
  build({ ...common, entryPoints: ['src/main/main.ts'], outfile: 'dist/main.js', platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ ...common, entryPoints: ['src/preload/preload.ts'], outfile: 'dist/preload.js', platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ ...common, entryPoints: ['src/renderer/renderer.ts'], outfile: 'dist/renderer.js', platform: 'browser', format: 'iife' }),
]);

cpSync('src/renderer/index.html', 'dist/index.html');
cpSync('src/renderer/styles.css', 'dist/styles.css');
console.log('build ok');
