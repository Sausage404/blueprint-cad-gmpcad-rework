import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coteAngle, coteDemiDiametre, coteSelon, directionCote, symboles } from '../src/renderer/cotes';
import { Dessin, segment, type Trait } from '../src/renderer/dessin';
import { CotesEtagees, CotesSerie, CotesSuperposees, HabillageCote } from '../src/renderer/fonctions-habillage';

const at = { niveau: 1, trait: 'continu-fort' as Trait };
const ctx = (d = new Dessin()) => ({ dessin: d, attributs: () => at, memoire: new Map<string, number>(), rayon: () => 1, dire: () => {} });
const textes = (d: Dessin) => d.toutes.flatMap((e) => e.primitives.filter((p) => p.type === 'texte').map((p) => (p as { texte: string }).texte));

test('cotes : valeur selon la direction, demi-diamètre, angle, symboles de l’original', () => {
  const c = coteSelon({ x: 0, y: 0 }, { x: 30, y: 5 }, directionCote({ x: 0, y: 0 }, { x: 30, y: 5 }, { x: 15, y: 20 }), { x: 15, y: 20 });
  assert.equal(c.valeur, 30);
  const d = coteDemiDiametre({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 40, y: 12.5 }, { x: 60, y: 0 })!;
  assert.equal(d.valeur, 25);
  assert.ok(d.primitives.some((p) => p.type === 'texte' && p.texte === 'Ø25'));
  const a = coteAngle({ a: { x: 0, y: 0 }, b: { x: 10, y: 0 } }, { x: 8, y: 0 }, { a: { x: 0, y: 0 }, b: { x: 10, y: 10 } }, { x: 7, y: 7 }, { x: 20, y: 5 })!;
  assert.ok(Math.abs(a.valeur - 45) < 1e-9);
  assert.equal(symboles('$20 ;0,1 45~'), 'Ø20 ±0,1 45°');
});

test('cotes en série, superposées et étagées : valeurs et lignes de cote', () => {
  const pts = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 50, y: 0 }, { x: 60, y: 0 }];
  const essai = (F: new (c: ReturnType<typeof ctx>) => { point(p: { x: number; y: number }): void }, d: Dessin) => {
    const f = new F(ctx(d));
    f.point(pts[0]);
    f.point(pts[1]);
    f.point({ x: 10, y: 15 }); // position de la première ligne de cote
    f.point(pts[2]);
    f.point(pts[3]);
  };
  const serie = new Dessin();
  essai(CotesSerie as never, serie);
  assert.deepEqual(textes(serie), ['20', '30', '10']);
  const superposees = new Dessin();
  essai(CotesSuperposees as never, superposees);
  assert.deepEqual(textes(superposees), ['20', '50', '60']);
  // Chaque nouvelle ligne de cote est plus haute de 3 fois la hauteur des écritures (9 mm).
  const ys = superposees.toutes.map((e) => (e.primitives.find((p) => p.type === 'texte') as { p: { y: number } }).p.y);
  assert.ok(Math.abs(ys[1] - ys[0] - 9) < 1e-9 && Math.abs(ys[2] - ys[1] - 9) < 1e-9);
  const etagees = new Dessin();
  essai(CotesEtagees as never, etagees);
  assert.deepEqual(textes(etagees), ['20', '50', '60']);
});

test('habillage de cote : préfixe et tolérances, puis modification', () => {
  const d = new Dessin();
  d.ajouter(segment({ x: 0, y: 0 }, { x: 40, y: 0 }, 1, 'continu-fort'));
  const c = ctx(d);
  const f = new CotesSerie(c);
  f.point({ x: 0, y: 0 });
  f.point({ x: 40, y: 0 });
  f.point({ x: 20, y: 10 });
  const cote = d.toutes.find((e) => e.genre === 'cote')!;
  const ref = cote.extras[0].p;
  const h = new HabillageCote(c);
  h.point({ x: ref.x, y: ref.y + 2 });
  h.valeur('$');
  h.valeur('-0,1');
  h.valeur('+0,2');
  assert.deepEqual(textes(d), ['Ø 40', '+0,2', '-0,1']);
  // Nouvel habillage : les anciens postfixes sont remplacés ; « +- » donne une tolérance centrée.
  const g = new HabillageCote(c);
  g.point({ x: ref.x, y: ref.y + 2 });
  g.valeur('');
  g.valeur('+-0,05');
  assert.deepEqual(textes(d), ['40', '±0,05']);
});
