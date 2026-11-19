import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { EXEMPLES, sansExemples } from './exemples';
import { aciNiveau } from '../src/renderer/couleurs';
import { cercle, polygone, rectangleArrondi, segment, type Entite, type Trait } from '../src/renderer/dessin';
import { chainer, decoderTexte, ecrireDxf, lireDxf, polyligne } from '../src/renderer/dxf';

const lire = (nom: string) => readFileSync(`${EXEMPLES}/${nom}`, 'latin1');
const at = { niveau: 2, trait: 'continu-fort' as Trait };

test('accents des anciens dessins (page de code DOS 850)', () => {
  assert.equal(decoderTexte('D%%130signation'), 'Désignation');
  assert.equal(decoderTexte('Rep%%138res'), 'Repères');
  assert.equal(decoderTexte('%%c20 %%p0.1 45%%d'), 'Ø20 ±0.1 45°');
});

for (const nom of ['BROCHE.DXF', 'AJAX.DXF', 'CAR.DXF', 'CERCE00.DXF', 'RIDOIR.DXF']) {
  test(`relit l'exemple ${nom} converti par DESDXF`, { skip: sansExemples }, () => {
    const r = lireDxf(lire(nom));
    const prims = r.entites.reduce((s, e) => s + e.primitives.length, 0);
    assert.ok(r.entites.length > 50, `${r.entites.length} entités`);
    assert.ok(prims > 500, `${prims} primitives`);
    assert.deepEqual(Object.keys(r.ignores), [], `types non lus : ${JSON.stringify(r.ignores)}`);
  });
}

test('BROCHE : format A1H, cotes et textes accentués', { skip: sansExemples }, () => {
  const r = lireDxf(lire('BROCHE.DXF'));
  assert.equal(r.version, 'AC1004');
  assert.deepEqual(r.limites, { min: { x: 0, y: 0 }, max: { x: 840, y: 594 } });
  assert.ok(r.entites.some((e) => e.genre === 'cote'));
  const textes = r.entites.flatMap((e) => e.primitives).filter((p) => p.type === 'texte').map((p) => (p.type === 'texte' ? p.texte : ''));
  assert.ok(textes.some((t) => t.startsWith('Désignation')), 'texte « Désignation » décodé');
  assert.ok(!textes.some((t) => t.includes('%%1')), 'plus de codes %%nnn');
});

test('polyligne avec arcs (bulge) puis remise en chaîne', () => {
  const prims = polyligne(
    [
      { p: { x: 0, y: 0 }, bulge: 0 },
      { p: { x: 10, y: 0 }, bulge: 1 }, // demi-cercle vers (10, 10)
      { p: { x: 10, y: 10 }, bulge: 0 },
      { p: { x: 0, y: 10 }, bulge: 0 },
    ],
    true,
  );
  assert.equal(prims.length, 4);
  const arc = prims[1];
  assert.ok(arc.type === 'arc' && Math.abs(arc.r - 5) < 1e-9 && Math.abs(arc.c.x - 10) < 1e-9 && Math.abs(arc.c.y - 5) < 1e-9);
  const c = chainer(prims)!;
  assert.equal(c.fermee, true);
  assert.equal(c.sommets.length, 4);
  assert.ok(Math.abs(c.sommets[1].bulge - 1) < 1e-9);
});

test('écrire puis relire un dessin : mêmes entités, mêmes genres, mêmes niveaux', () => {
  const entites: Entite[] = [
    segment({ x: 0, y: 0 }, { x: 50, y: 20 }, 1, 'continu-fort'),
    cercle({ x: 30, y: 30 }, 12.5, { niveau: 3, trait: 'mixte-fin' }),
    rectangleArrondi({ x: 100, y: 0 }, { x: 160, y: 40 }, 5, at),
    polygone({ x: 200, y: 50 }, { x: 200, y: 70 }, 6, at)!,
    { genre: 'texte', primitives: [{ type: 'texte', p: { x: 10, y: 100 }, h: 5, angle: 0, texte: 'Désignation Ø20 ±0,1', alignH: 'centre', alignV: 'ligne' }], extras: [], ...at },
  ];
  const dxf = ecrireDxf(entites, new Map(), { largeur: 297, hauteur: 210 }, aciNiveau);
  assert.match(dxf, /AC1009/);
  const r = lireDxf(dxf);
  assert.deepEqual(r.entites.map((e) => e.genre), ['segment', 'cercle', 'rectangle', 'polygone', 'texte']);
  assert.deepEqual(r.entites.map((e) => e.niveau), [1, 3, 2, 2, 2]);
  assert.equal(r.entites[1].trait, 'mixte-fin');
  assert.equal(r.entites[2].primitives.length, 8); // 4 côtés + 4 arcs
  assert.equal(r.entites[3].extras.length, 1); // le centre du polygone reste repérable
  const t = r.entites[4].primitives[0];
  assert.ok(t.type === 'texte' && t.texte === 'Désignation Ø20 ±0,1' && t.alignH === 'centre');
  assert.deepEqual(r.limites, { min: { x: 0, y: 0 }, max: { x: 297, y: 210 } });
});

test('un groupe importé (bloc) est réécrit en bloc et reste une seule entité', { skip: sansExemples }, () => {
  const r = lireDxf(lire('CAR.DXF'));
  const groupes = r.entites.filter((e) => e.genre === 'groupe' || e.genre === 'cote').length;
  const r2 = lireDxf(ecrireDxf(r.entites, r.calques, { largeur: 297, hauteur: 210 }, aciNiveau));
  assert.equal(r2.entites.length, r.entites.length);
  assert.equal(r2.entites.filter((e) => e.genre === 'groupe' || e.genre === 'cote').length, groupes);
});
