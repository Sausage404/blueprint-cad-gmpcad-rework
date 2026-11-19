import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chanfrein, coteLineaire, parallele, perpendiculaire, pointsEquidistants, raccordement, tangente } from '../src/renderer/construction';
import { Dessin, segment, type Trait } from '../src/renderer/dessin';
import { creerFonction } from '../src/renderer/fonctions';
import '../src/renderer/fonctions-construction';
import { dist } from '../src/renderer/geometrie';

const proche = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;
const at = { niveau: 1, trait: 'continu-fort' as Trait };
const ctx = (d = new Dessin()) => ({ dessin: d, attributs: () => at, memoire: new Map<string, number>(), rayon: () => 1, dire: () => {} });
// Un angle droit : s1 horizontal de (0,0) à (10,0), s2 vertical de (10,0) à (10,10).
const s1 = { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } };
const s2 = { a: { x: 10, y: 0 }, b: { x: 10, y: 10 } };

test('chanfrein 2 × 45° dans un angle droit', () => {
  const c = chanfrein(s1, { x: 2, y: 0 }, s2, { x: 10, y: 8 }, 2, 45)!;
  assert.ok(c.ajout?.type === 'segment');
  assert.ok(proche(dist(c.s1.b, { x: 8, y: 0 }), 0));
  assert.ok(proche(dist(c.s2.b, { x: 10, y: 2 }), 0));
  assert.equal(chanfrein(s1, { x: 2, y: 0 }, s2, { x: 10, y: 8 }, 50, 45), null); // trop grand
});

test('raccordement R2 dans un angle droit : arc tangent aux deux segments', () => {
  const c = raccordement(s1, { x: 2, y: 0 }, s2, { x: 10, y: 8 }, 2)!;
  const a = c.ajout!;
  assert.ok(a.type === 'arc' && proche(a.r, 2) && proche(a.c.x, 8) && proche(a.c.y, 2));
  assert.ok(proche(c.s1.b.x, 8) && proche(c.s2.b.y, 2));
  const coin = raccordement(s1, { x: 2, y: 0 }, { a: { x: 12, y: 1 }, b: { x: 12, y: 10 } }, { x: 12, y: 8 }, 0)!;
  assert.ok(proche(coin.s1.b.x, 12)); // rayon 0 : prolongés jusqu'à l'intersection
});

test('tangente extérieure à deux cercles égaux', () => {
  const t = tangente({ c: { x: 0, y: 0 }, r: 2 }, { x: 0, y: 2.5 }, { c: { x: 10, y: 0 }, r: 2 }, { x: 10, y: 2.5 })!;
  assert.ok(proche(t.a.y, 2) && proche(t.b.y, 2));
});

test('perpendiculaire depuis un point, parallèle à distance', () => {
  const p = perpendiculaire(s1, { c: { x: 4, y: 5 }, r: 0 }, { x: 4, y: 5 })!;
  assert.ok(proche(p.b.x, 4) && proche(p.b.y, 0));
  const q = parallele(s1, { x: 3, y: -1 }, 5);
  assert.ok(proche(q.a.y, -5) && proche(q.b.y, -5));
});

test('points équidistants sur un segment et sur un cercle', () => {
  assert.deepEqual(pointsEquidistants({ type: 'segment', a: { x: 0, y: 0 }, b: { x: 9, y: 0 } }, 2), [
    { x: 3, y: 0 },
    { x: 6, y: 0 },
  ]);
  assert.equal(pointsEquidistants({ type: 'cercle', c: { x: 0, y: 0 }, r: 1 }, 4).length, 4);
});

test('cote linéaire horizontale : valeur et texte', () => {
  const prims = coteLineaire({ x: 0, y: 0 }, { x: 25.5, y: 0 }, { x: 10, y: 10 }, 3);
  const t = prims.find((p) => p.type === 'texte');
  assert.ok(t?.type === 'texte' && t.texte === '25.5');
});

test('fonction Chanfrein : deux segments puis longueur 0 = coin vif', () => {
  const d = new Dessin();
  d.ajouter(segment({ x: 0, y: 0 }, { x: 8, y: 0 }, 1, 'continu-fort'));
  d.ajouter(segment({ x: 10, y: 2 }, { x: 10, y: 10 }, 1, 'continu-fort'));
  const f = creerFonction('D10', ctx(d))!;
  f.point({ x: 2, y: 0 });
  f.point({ x: 10, y: 8 });
  assert.equal(f.question()?.texte, 'Longueur du chanfrein');
  f.valeur(0);
  assert.equal(d.toutes.length, 2);
  const p = d.toutes[0].primitives[0];
  assert.ok(p.type === 'segment' && proche(Math.max(p.a.x, p.b.x), 10)); // prolongé jusqu'au coin
});

test('fonction Texte : point puis texte', () => {
  const d = new Dessin();
  const f = creerFonction('B5', ctx(d))!;
  f.point({ x: 5, y: 5 });
  assert.equal(f.question()?.type, 'texte');
  f.valeur('Arbre Ø20');
  const p = d.toutes[0].primitives[0];
  assert.ok(p.type === 'texte' && p.texte === 'Arbre Ø20' && proche(p.h, 3.5));
});
