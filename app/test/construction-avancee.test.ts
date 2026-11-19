import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cercleTriTangent, chaineContour, contourParallele, coteDe, raccordGeneral, symbolePoint } from '../src/renderer/construction-avancee';
import { dist } from '../src/renderer/geometrie';
import type { Primitive } from '../src/renderer/primitives';

const proche = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const seg = (ax: number, ay: number, bx: number, by: number): Primitive => ({ type: 'segment', a: { x: ax, y: ay }, b: { x: bx, y: by } });

test('cercle tri-tangent : cercle inscrit d’un triangle, et cercle passant par un point', () => {
  // Triangle rectangle 3-4-5 : rayon inscrit 1, centre (1, 1).
  const k = cercleTriTangent(
    [{ type: 'droite', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }, { type: 'droite', a: { x: 0, y: 0 }, b: { x: 0, y: 3 } }, { type: 'droite', a: { x: 4, y: 0 }, b: { x: 0, y: 3 } }],
    [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1.6, y: 1.8 }],
  )!;
  proche(k.r, 1, 1e-6), proche(k.c.x, 1, 1e-6), proche(k.c.y, 1, 1e-6);
  // Tangent à deux droites parallèles et passant par un point.
  const m = cercleTriTangent(
    [{ type: 'droite', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } }, { type: 'droite', a: { x: 0, y: 10 }, b: { x: 10, y: 10 } }, { type: 'point', p: { x: 5, y: 5 } }],
    [{ x: 5, y: 0 }, { x: 5, y: 10 }, { x: 5, y: 5 }],
  )!;
  proche(m.r, 5, 1e-6);
});

test('raccordement d’un cercle et d’une droite par un arc, et arc complémentaire', () => {
  // Cercle de rayon 10 en (0, 0), droite y = -12 juste en dessous, rayon 5 : centre (√176, -7).
  const cercle = { type: 'cercle' as const, c: { x: 0, y: 0 }, r: 10 };
  const droite = { type: 'droite' as const, a: { x: -50, y: -12 }, b: { x: 50, y: -12 } };
  const r = raccordGeneral(cercle, { x: 9, y: -4 }, droite, { x: 14, y: -12 }, 5)!;
  proche(dist(r.arc.c, { x: 0, y: 0 }), 15, 1e-6); // tangent extérieurement au cercle
  proche(r.arc.c.y, -7, 1e-6); // à 5 mm de la droite
  proche(r.arc.c.x, Math.sqrt(176), 1e-6);
  proche(r.t2.y, -12, 1e-6);
  const comp = raccordGeneral(cercle, { x: 9, y: -4 }, droite, { x: 14, y: -12 }, -5)!;
  const ouverture = (a: { debut: number; fin: number }) => (((a.fin - a.debut) % 360) + 360) % 360;
  assert.ok(ouverture(r.arc) < 180 && ouverture(comp.arc) > 180);
  proche(ouverture(r.arc) + ouverture(comp.arc), 360, 1e-6);
});

test('contour parallèle : rectangle fermé décalé vers l’extérieur, avec ou sans contournement des angles', () => {
  const rect = [seg(0, 0, 40, 0), seg(40, 0, 40, 20), seg(40, 20, 0, 20), seg(0, 20, 0, 0)];
  const chaine = chaineContour(rect, { x: 0, y: 0 }, { x: 0, y: 0 }, rect[0]);
  assert.equal(chaine.length, 4);
  const cote = coteDe(chaine, { x: 20, y: -5 }); // à l'extérieur (sous le premier côté)
  const vif = contourParallele(chaine, cote, 5, false);
  assert.equal(vif.length, 4);
  const xs = vif.flatMap((p) => (p.type === 'segment' ? [p.a.x, p.b.x] : []));
  proche(Math.min(...xs), -5), proche(Math.max(...xs), 45);
  const arrondi = contourParallele(chaine, cote, 5, true);
  assert.equal(arrondi.filter((p) => p.type === 'arc').length, 4);
  const dedans = contourParallele(chaine, -cote, 5, true);
  assert.equal(dedans.filter((p) => p.type === 'arc').length, 0); // angles intérieurs : jamais contournés
});

test('symboles de points : 9 types', () => {
  assert.equal(symbolePoint({ x: 0, y: 0 }, 1, 4).length, 1);
  assert.equal(symbolePoint({ x: 0, y: 0 }, 2, 4).length, 2);
  assert.ok(symbolePoint({ x: 0, y: 0 }, 5, 4).some((p) => p.type === 'cercle'));
});
