import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { EXEMPLES, sansExemples } from './exemples';
import { runInNewContext } from 'node:vm';
import { buildSync } from 'esbuild';


test('aperçu Windows : le lecteur tourne sans les fonctions JavaScript récentes (moteur Chakra)', { skip: sansExemples }, () => {
  // Le même paquet que windows/build.mjs : ES2017 et les compléments de polyfills.js.
  const js = buildSync({
    entryPoints: ['src/quicklook/apercu.ts'],
    bundle: true,
    format: 'iife',
    target: 'es2017',
    write: false,
    banner: { js: readFileSync('windows/polyfills.js', 'utf-8') },
  }).outputFiles[0].text;
  const ctx: Record<string, unknown> = {};
  runInNewContext('delete Array.prototype.flat; delete Array.prototype.flatMap; delete Array.prototype.at; delete Object.fromEntries; delete String.prototype.matchAll; delete String.prototype.replaceAll;', ctx);
  runInNewContext(js, ctx);
  const apercu = ctx.apercuTexte as (contenu: string, des: boolean) => string;
  const lignes = apercu(readFileSync(`${EXEMPLES}/BROCHE.DES`, 'latin1'), true).split('\n');
  assert.equal(lignes[0], 'P\t840\t594');
  assert.ok(lignes.filter((l) => l.startsWith('F\t')).length > 1000);
  assert.ok(lignes.some((l) => l.startsWith('T\t') && l.endsWith('\tØ 55')));
  assert.ok(apercu(readFileSync(`${EXEMPLES}/RIDOIR.DXF`, 'latin1'), false).startsWith('P\t594\t420'));
  assert.ok(apercu('pas un dessin', false).startsWith('E\t') || apercu('pas un dessin', false).startsWith('P\t'));
});
