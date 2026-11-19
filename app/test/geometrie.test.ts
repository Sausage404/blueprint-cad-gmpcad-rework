import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contraindre, lireNombre, nombre, pasEffectif, reperer, surGrille } from '../src/renderer/geometrie';
import { candidats, intersections, pied, type Primitive } from '../src/renderer/primitives';

const seg = (ax: number, ay: number, bx: number, by: number): Primitive => ({ type: 'segment', a: { x: ax, y: ay }, b: { x: bx, y: by } });

const g = { origine: { x: 148.5, y: 105 }, pas: 1 }; // grille d'un A4H : origine au centre du plan

test('la grille cale sur l’intersection la plus proche, depuis son origine', () => {
  assert.deepEqual(surGrille({ x: 10.2, y: 20.7 }, g), { x: 10.5, y: 21 });
});

test('le pas diminue (÷2, ÷5, ÷10…) quand moins de 20 pas tiennent à l’écran', () => {
  assert.equal(pasEffectif(1, 300), 1);
  assert.equal(pasEffectif(1, 20), 1);
  assert.equal(pasEffectif(1, 15), 0.5);
  assert.equal(pasEffectif(1, 5), 0.2);
  assert.equal(pasEffectif(1, 3), 0.1);
});

test('calage seul : direction multiple de 15° passant par le dernier point', () => {
  const c = contraindre({ x: 10, y: 1 }, { grille: null, dernier: { x: 0, y: 0 }, pasAngle: 15 });
  assert.equal(c.angle, 0);
  assert.deepEqual(c.p, { x: 10, y: 0 });
  const d = contraindre({ x: 10, y: 9 }, { grille: null, dernier: { x: 0, y: 0 }, pasAngle: 15 });
  assert.equal(d.angle, 45);
  assert.ok(Math.abs(d.p.x - d.p.y) < 1e-9);
});

test('calage + grille : sous 45° le réticule reste sur une verticale de la grille', () => {
  const grille = { origine: { x: 0, y: 0 }, pas: 1 };
  const c = contraindre({ x: 10.3, y: 2.6 }, { grille, dernier: { x: 0, y: 0 }, pasAngle: 15 });
  assert.equal(c.angle, 15);
  assert.equal(c.grille, 'verticale');
  assert.equal(c.p.x, 10);
  assert.ok(Math.abs(c.p.y - 10 * Math.tan(Math.PI / 12)) < 1e-9);
});

test('calage + grille : au-delà de 45°, sur une horizontale ; à 90°, x reste celui du dernier point', () => {
  const grille = { origine: { x: 0, y: 0 }, pas: 1 };
  const c = contraindre({ x: 0.4, y: 7.6 }, { grille, dernier: { x: 0, y: 0 }, pasAngle: 15 });
  assert.equal(c.angle, 90);
  assert.equal(c.grille, 'horizontale');
  assert.deepEqual(c.p, { x: 0, y: 8 });
});

test('sans dernier point, pas de calage : seulement la grille', () => {
  const c = contraindre({ x: 3.4, y: 3.6 }, { grille: { origine: { x: 0, y: 0 }, pas: 1 }, dernier: null, pasAngle: 15 });
  assert.equal(c.cale, false);
  assert.deepEqual(c.p, { x: 3, y: 4 });
});

test('intersection et pied de perpendiculaire', () => {
  assert.deepEqual(intersections(seg(0, 0, 10, 10), seg(0, 10, 10, 0)), [{ x: 5, y: 5 }]);
  assert.deepEqual(intersections(seg(0, 0, 1, 0), seg(0, 1, 1, 1)), []);
  assert.deepEqual(pied({ x: 5, y: 7 }, seg(0, 0, 10, 0)), { x: 5, y: 0 });
  assert.equal(pied({ x: 15, y: 7 }, seg(0, 0, 10, 0)), null);
});

test('repérage : le point le plus proche, puis le suivant à chaque nouvel appui', () => {
  const segs = [seg(0, 0, 10, 0), seg(5, -5, 5, 5)];
  const cible = { x: 5.5, y: 0.4 };
  const cands = candidats(segs, [], cible, 6, null);
  const premier = reperer(cands, cible, 6, 0);
  assert.equal(premier?.type, 'intersection'); // (5,0) : milieu des deux segments et intersection
  assert.deepEqual(premier?.p, { x: 5, y: 0 });
  const second = reperer(cands, cible, 6, 1);
  assert.deepEqual(second?.p, { x: 10, y: 0 }); // le plus proche ensuite
  assert.equal(reperer(cands, cible, 3, 1)?.type, 'intersection'); // un seul point dans le rayon : on y reste
  assert.equal(reperer(cands, { x: 50, y: 50 }, 3), null); // loin de toute entité
});

test('nombres affichés et nombres tapés', () => {
  assert.equal(nombre(12.5), '12.5');
  assert.equal(nombre(-0.0001), '0');
  assert.equal(nombre(1 / 3), '0.333');
  assert.equal(lireNombre('12,5'), 12.5);
  assert.equal(lireNombre('-.5'), -0.5);
  assert.equal(lireNombre('abc'), null);
  assert.equal(lireNombre(''), null);
});

test('mesure près du réticule : longueur et angle depuis le dernier point', async () => {
  const { mesureDepuis } = await import('../src/renderer/poste');
  assert.equal(mesureDepuis({ x: 0, y: 0 }, { x: 3, y: 4 }), 'L=5  A=53.13°');
  assert.equal(mesureDepuis({ x: 0, y: 0 }, { x: 0, y: -2 }), 'L=2  A=270°');
  assert.equal(mesureDepuis({ x: 1, y: 1 }, { x: 1, y: 1 }), null);
});
