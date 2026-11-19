// Compile les tests (test/*.test.ts) dans dist-test/ pour le lanceur de tests de Node.
import { build } from 'esbuild';
import { readdirSync, rmSync } from 'node:fs';

rmSync('dist-test', { recursive: true, force: true });
const entryPoints = readdirSync('test').filter((f) => f.endsWith('.test.ts')).map((f) => `test/${f}`);
await build({ entryPoints, outdir: 'dist-test', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, external: ['esbuild'], logLevel: 'warning' });
