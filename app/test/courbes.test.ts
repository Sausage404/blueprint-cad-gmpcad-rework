import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arcEllipse, demiEllipse, ellipseAxes, ellipseConjugues, ellipseProjection, interpolation, lissage, quartEllipse, traitsAxes } from '../src/renderer/courbes';
import { Dessin } from '../src/renderer/dessin';
import { lireDxf, ecrireDxf } from '../src/renderer/dxf';
import { format } from '../src/renderer/formats';
import { aciNiveau } from '../src/renderer/couleurs';
import { definitionCourbe, entiteCourbe } from '../src/renderer/fonctions-courbes';
import { dist } from '../src/renderer/geometrie';

const proche = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const at = { niveau: 1, trait: 'continu-fort' as const };

test('ellipses : centre et axes, projection d’un cercle, diamètres conjugués, quart et demi', () => {
  const e = ellipseAxes({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 3, y: 4 });
  assert.ok(!('erreur' in e));
  if ('erreur' in e) return;
  proche(e.v.y, 4); // le troisième point est projeté sur la perpendiculaire au premier axe
  const pts = arcEllipse(e.c, e.u, e.v);
  for (const p of pts) proche((p.x / 10) ** 2 + (p.y / 4) ** 2, 1, 1e-9);
  const pr = ellipseProjection({ x: 0, y: 0 }, { x: 0, y: 5 }, 20, 60);
  if ('erreur' in pr) assert.fail();
  else {
    proche(Math.hypot(pr.u.x, pr.u.y), 10);
    proche(Math.hypot(pr.v.x, pr.v.y), 5); // cos 60° = 0,5
  }
  assert.deepEqual(ellipseConjugues({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 8, y: 0 }), { erreur: 'Les trois points sont alignés. Procédure abandonnée.' });
  const q = quartEllipse({ x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 });
  if ('erreur' in q) assert.fail();
  else {
    const arc = arcEllipse(q.c, q.u, q.v, q.t0, q.t1);
    proche(arc[0].x, 10), proche(arc[0].y, 0);
    proche(arc[arc.length - 1].x, 0), proche(arc[arc.length - 1].y, 5);
  }
  const d = demiEllipse({ x: -5, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 3 });
  if ('erreur' in d) assert.fail();
  else proche(d.t1 - d.t0, Math.PI);
});

test('courbes : le lissage part et finit sur les points extrêmes, l’interpolation passe par tous les points', () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }, { x: 30, y: 10 }, { x: 40, y: 0 }];
  const l = lissage(pts, false);
  assert.ok(dist(l[0], pts[0]) < 1e-9 && dist(l[l.length - 1], pts[4]) < 1e-9);
  // Tangente au premier segment de la ligne polygonale.
  const t = { x: l[1].x - l[0].x, y: l[1].y - l[0].y };
  proche(Math.atan2(t.y, t.x), Math.PI / 4, 0.05); // corde du premier petit segment
  const i = interpolation(pts, false);
  for (const p of pts) assert.ok(i.some((q) => dist(p, q) < 1e-9));
  const fermee = interpolation(pts, true);
  assert.ok(dist(fermee[0], fermee[fermee.length - 1]) < 1e-9);
  assert.equal(traitsAxes({ x: 0, y: 0 }, { x: 5, y: 0 }).length, 2);
});

test('courbe enregistrée en DXF : relue avec ses points et ses réglages, segments non repérables', () => {
  const pts = [{ x: 10, y: 10 }, { x: 30, y: 40 }, { x: 60, y: 20 }, { x: 90, y: 50 }];
  const c = entiteCourbe(pts, 'interpolation', false, [{ x: 0, y: 20 }, { x: 100, y: 60 }], at);
  const d = new Dessin();
  d.ajouter(c);
  const r = lireDxf(ecrireDxf(d.toutes, d.calques, format('A4H'), aciNiveau));
  assert.equal(r.entites.length, 1);
  const lu = r.entites[0];
  assert.equal(lu.genre, 'courbe');
  const def = definitionCourbe(lu)!;
  assert.equal(def.methode, 'interpolation');
  assert.equal(def.points.length, 4);
  proche(def.points[1].y, 40);
  proche(def.tangentes[1]!.x, 100);
  assert.ok(lu.primitives.every((p) => p.type === 'segment' && p.courbe));
});
