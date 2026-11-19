import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXEMPLES, sansExemples } from './exemples';
import { aireSignee, axePour, contours, pieceEn, profilRevolution } from '../src/renderer/contours';
import type { Pt } from '../src/renderer/geometrie';
import type { Primitive } from '../src/renderer/primitives';

const seg = (ax: number, ay: number, bx: number, by: number): Primitive => ({ type: 'segment', a: { x: ax, y: ay }, b: { x: bx, y: by } });
const rect = (x0: number, y0: number, x1: number, y1: number): Primitive[] => [seg(x0, y0, x1, y0), seg(x1, y0, x1, y1), seg(x1, y1, x0, y1), seg(x0, y1, x0, y0)];
const proche = (a: number, b: number, tol = 0.5) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test('contours : plaque percée, trait intérieur et ligne de rappel ignorés', () => {
  const r = contours([
    ...rect(0, 0, 100, 50),
    seg(30, 0, 30, 50), // arête intérieure : ne change pas le contour extérieur
    seg(100, 25, 140, 25), // ligne qui ne ferme rien
    { type: 'cercle', c: { x: 70, y: 25 }, r: 10 },
  ]);
  assert.equal(r.pieces.length, 1);
  const p = r.pieces[0];
  proche(p.aire, 5000);
  assert.ok(aireSignee(p.points) > 0); // sens trigonométrique
  assert.equal(p.trous.length, 1);
  proche(p.trous[0].aire, Math.PI * 100, 3);
});

test('contours : deux rectangles qui se chevauchent donnent leur contour commun', () => {
  const r = contours([...rect(0, 0, 40, 40), ...rect(20, 20, 60, 60)]);
  assert.equal(r.pieces.length, 1);
  proche(r.pieces[0].aire, 1600 + 1600 - 400);
});

test('contours : arc et segments raccordés (oblong), île dans un trou', () => {
  const r = contours([
    seg(0, 0, 50, 0),
    { type: 'arc', c: { x: 50, y: 10 }, r: 10, debut: 270, fin: 90 },
    seg(50, 20, 0, 20),
    { type: 'arc', c: { x: 0, y: 10 }, r: 10, debut: 90, fin: 270 },
    ...rect(200, 0, 300, 100),
    ...rect(220, 20, 280, 80),
    ...rect(240, 40, 260, 60),
  ]);
  assert.equal(r.pieces.length, 3); // l'oblong, le grand carré (avec son trou), l'île
  const oblong = r.pieces.find((c) => c.points[0].x < 100)!;
  proche(oblong.aire, 50 * 20 + Math.PI * 100, 2);
  const carre = r.pieces.find((c) => Math.abs(c.aire - 10000) < 1)!;
  assert.equal(carre.trous.length, 1);
  assert.equal(pieceEn(r, { x: 250, y: 50 }, 1), r.pieces.find((c) => Math.abs(c.aire - 400) < 1));
  assert.equal(pieceEn(r, { x: 230, y: 30 }, 1), null); // dans le trou : rien
  assert.equal(pieceEn(r, { x: 200.5, y: 50 }, 1), carre); // sur le bord
});

test('révolution : axe le long de la pièce, demi-profil du plus grand côté', () => {
  const contour: Pt[] = [
    { x: 0, y: -10 },
    { x: 100, y: -10 },
    { x: 100, y: 10 },
    { x: 0, y: 10 },
  ];
  const axe = axePour(contour, [seg(-5, 0, 105, 0), seg(50, -15, 50, 15)]);
  assert.deepEqual(axe, { a: { x: -5, y: 0 }, b: { x: 105, y: 0 } });
  const profil = profilRevolution(contour, axe);
  proche(Math.abs(aireSignee(profil.map((p) => ({ x: p.z, y: p.r })))), 1000);
  assert.ok(profil.every((p) => p.r >= 0 && p.r <= 10 + 1e-9));
  // Sans trait d'axe : l'horizontale qui passe par le milieu.
  assert.deepEqual(axePour(contour, []), { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } });
});

test('contours sur les dessins d’exemple : rapide, et des pièces trouvées', { skip: sansExemples }, async () => {
  const { readFileSync } = await import('node:fs');
  const { lireDxf } = await import('../src/renderer/dxf');
  const { aretes } = await import('../src/renderer/contours');
  for (const nom of ['BROCHE.DXF', 'RIDOIR.DXF', 'AJAX.DXF']) {
    const d = lireDxf(readFileSync(`${EXEMPLES}/${nom}`, 'latin1'));
    const debut = performance.now();
    const r = contours(aretes(d.entites).map((a) => a.prim));
    const duree = performance.now() - debut;
    console.log(`${nom} : ${aretes(d.entites).length} arêtes, ${r.pieces.length} pièces, ${r.tous.length} contours, ${duree.toFixed(0)} ms`);
    assert.ok(r.pieces.length > 0);
    assert.ok(duree < 3000);
  }
});

test('révolution : alésage étagé borgne vu en pointillés, perçage radial sans effet', async () => {
  const { profilsRevolution } = await import('../src/renderer/contours');
  // Arbre Ø40 x 50, axe y = 0 ; alésage Ø20 sur 20 puis Ø10 jusqu'à 35 (traits cachés), perçage radial à 42.
  const contour = [
    { x: 0, y: -20 },
    { x: 50, y: -20 },
    { x: 50, y: 20 },
    { x: 0, y: 20 },
  ];
  const caches = [seg(0, 10, 20, 10), seg(20, 10, 20, 5), seg(20, 5, 35, 5), seg(35, 5, 35, -5), seg(35, -5, 20, -5), seg(20, -5, 20, -10), seg(20, -10, 0, -10), seg(40, -20, 40, 20), seg(44, -20, 44, 20)];
  const axe = { a: { x: -5, y: 0 }, b: { x: 55, y: 0 } };
  const profils = profilsRevolution(contour, caches, axe);
  assert.equal(profils.length, 1);
  // Aire du profil : 50 x 20 moins l'alésage (20 x 10 + 15 x 5).
  proche(Math.abs(aireSignee(profils[0].map((p) => ({ x: p.z, y: p.r })))), 1000 - 200 - 75);
  // Sans traits cachés : le profil plein.
  const plein = profilsRevolution(contour, [], axe);
  proche(Math.abs(aireSignee(plein[0].map((p) => ({ x: p.z, y: p.r })))), 1000);
  // Coupe complète d'une bague (deux pièces de part et d'autre de l'axe) : chacune donne le même profil.
  const haut = profilsRevolution([{ x: 0, y: 10 }, { x: 30, y: 10 }, { x: 30, y: 20 }, { x: 0, y: 20 }], [], axe);
  const bas = profilsRevolution([{ x: 0, y: -20 }, { x: 30, y: -20 }, { x: 30, y: -10 }, { x: 0, y: -10 }], [], axe);
  proche(Math.abs(aireSignee(haut[0].map((p) => ({ x: p.z, y: p.r })))), 300);
  assert.deepEqual(
    haut[0].map((p) => p.r).sort(),
    bas[0].map((p) => p.r).sort(),
  );
});
