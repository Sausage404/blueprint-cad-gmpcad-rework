import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Dessin, oblong, polygone, rectangleArrondi, rectangleIncline, type Trait } from '../src/renderer/dessin';
import { ArcOrigineCentreAngle, ArcTroisPoints, CercleDiametre, Oblong, Polygone, RectangleArrondi, creerFonction } from '../src/renderer/fonctions';
import { dist } from '../src/renderer/geometrie';
import { arcTroisPoints, candidats, dansArc, distance, intersections, type Primitive } from '../src/renderer/primitives';

const at = { niveau: 1, trait: 'continu-fort' as Trait };
const ctx = () => ({ dessin: new Dessin(), attributs: () => at, memoire: new Map<string, number>(), rayon: () => 1, dire: () => {} });
const proche = (a: number, b: number) => Math.abs(a - b) < 1e-6;

test('arc par trois points : centre, rayon et sens de parcours', () => {
  const a = arcTroisPoints({ x: 10, y: 0 }, { x: 0, y: 10 }, { x: -10, y: 0 })!;
  assert.ok(proche(a.c.x, 0) && proche(a.c.y, 0) && proche(a.r, 10));
  assert.ok(proche(a.debut, 0) && proche(a.fin, 180)); // passe par le haut : sens trigonométrique
  const b = arcTroisPoints({ x: 10, y: 0 }, { x: 0, y: -10 }, { x: -10, y: 0 })!;
  assert.ok(proche(b.debut, 180) && proche(b.fin, 0)); // passe par le bas : arc inverse
  assert.equal(arcTroisPoints({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }), null);
});

test('angles d’un arc, y compris à cheval sur 0°', () => {
  assert.ok(dansArc(10, 350, 20));
  assert.ok(!dansArc(180, 350, 20));
  assert.ok(dansArc(90, 0, 180));
});

test('intersections : droite / cercle, cercle / cercle, demi-droite bornée', () => {
  const cercle: Primitive = { type: 'cercle', c: { x: 0, y: 0 }, r: 5 };
  const droite: Primitive = { type: 'droite', a: { x: -1, y: 0 }, b: { x: 1, y: 0 } };
  assert.equal(intersections(droite, cercle).length, 2);
  const demi: Primitive = { type: 'demi-droite', a: { x: 0, y: 0 }, b: { x: 1, y: 0 } };
  const pts = intersections(demi, cercle);
  assert.equal(pts.length, 1);
  assert.ok(proche(pts[0].x, 5));
  const c2: Primitive = { type: 'cercle', c: { x: 8, y: 0 }, r: 5 };
  assert.equal(intersections(cercle, c2).length, 2);
  const arcHaut: Primitive = { type: 'arc', c: { x: 0, y: 0 }, r: 5, debut: 0, fin: 180 };
  assert.equal(intersections(arcHaut, c2).length, 1); // seul le point du haut est sur l'arc
  assert.ok(proche(distance({ x: 0, y: 7 }, cercle), 2));
});

test('repérage sur un cercle : son centre est repérable quand on vise le cercle', () => {
  const c: Primitive = { type: 'cercle', c: { x: 0, y: 0 }, r: 5 };
  const liste = candidats([c], [], { x: 5.2, y: 0 }, 1, null);
  assert.ok(liste.some((x) => dist(x.p, { x: 0, y: 0 }) < 1e-9));
});

test('rectangle à angles arrondis, rectangle incliné, oblong, polygone', () => {
  const ra = rectangleArrondi({ x: 0, y: 0 }, { x: 20, y: 10 }, 2, at);
  assert.equal(ra.primitives.filter((p) => p.type === 'arc').length, 4);
  assert.equal(ra.primitives.filter((p) => p.type === 'segment').length, 4);
  const ri = rectangleIncline({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 5 }, at)!;
  assert.equal(ri.primitives.length, 4);
  const ob = oblong({ x: 0, y: 0 }, { x: 30, y: 0 }, 10, at)!;
  const arcs = ob.primitives.filter((p) => p.type === 'arc');
  assert.equal(arcs.length, 2);
  assert.ok(arcs.every((p) => p.type === 'arc' && proche(p.r, 5)));
  assert.equal(oblong({ x: 0, y: 0 }, { x: 5, y: 0 }, 10, at), null); // largeur > longueur
  const hex = polygone({ x: 0, y: 0 }, { x: 0, y: 10 }, 6, at)!;
  assert.equal(hex.primitives.length, 6);
  const s = hex.primitives[0];
  assert.ok(s.type === 'segment' && proche(dist(s.a, s.b), (2 * 10) / Math.sqrt(3))); // côté d'un hexagone d'apothème 10
});

test('Cercle (centre, diamètre) : le diamètre est demandé et le dernier est proposé ensuite', () => {
  const c = ctx();
  const f = new CercleDiametre(c);
  assert.equal(f.question(), null);
  f.point({ x: 0, y: 0 });
  assert.equal(f.question()?.defaut, 0);
  f.valeur(20);
  assert.equal(c.dessin.toutes.length, 1);
  f.point({ x: 50, y: 0 });
  assert.equal(f.question()?.defaut, 20);
});

test('Arc (origine, centre, angle) : 90° par défaut, sens trigonométrique', () => {
  const c = ctx();
  const f = new ArcOrigineCentreAngle(c);
  f.point({ x: 10, y: 0 });
  f.point({ x: 0, y: 0 });
  assert.equal(f.question()?.defaut, 90);
  f.valeur(90);
  const p = c.dessin.toutes[0].primitives[0];
  assert.ok(p.type === 'arc' && proche(p.debut, 0) && proche(p.fin, 90) && proche(p.r, 10));
});

test('Arc par trois points : deux points confondus donnent un cercle de diamètre', () => {
  const c = ctx();
  const f = new ArcTroisPoints(c);
  f.point({ x: 0, y: 0 });
  f.point({ x: 0, y: 0 });
  f.point({ x: 10, y: 0 });
  const p = c.dessin.toutes[0].primitives[0];
  assert.ok(p.type === 'cercle' && proche(p.r, 5));
});

test('Rectangle à angles arrondis : « Rayon trop grand » repose la question avec le maximum', () => {
  const c = ctx();
  const f = new RectangleArrondi(c);
  assert.equal(f.question()?.texte, 'Valeur du rayon'); // la question vient en premier
  f.valeur(8);
  f.point({ x: 0, y: 0 });
  f.point({ x: 20, y: 10 });
  assert.equal(f.question()?.texte, 'Rayon trop grand. Valeur du rayon');
  assert.equal(f.question()?.defaut, 5);
  f.valeur(5);
  assert.equal(c.dessin.toutes.length, 1);
  assert.equal(f.abandon(), false); // reprend au départ : la question du rayon
  assert.equal(f.question()?.texte, 'Valeur du rayon');
  assert.equal(f.abandon(), true);
});

test('Rectangle à bouts ronds et polygone : la valeur d’abord', () => {
  const c = ctx();
  const o = new Oblong(c);
  o.valeur(10);
  o.point({ x: 0, y: 0 });
  o.point({ x: 6, y: 0 });
  assert.match(o.question()?.texte ?? '', /trop grande/);
  const p = new Polygone(c);
  assert.equal(p.question()?.defaut, 6);
  p.valeur(99);
  assert.equal(c.memoire.get('sommets'), 40); // au-delà de 40 : 40
});

test('catalogue : les cases de l’étape 3a ouvrent leur fonction', () => {
  for (const code of ['D1', 'D2', 'D3', 'D4', 'D5', 'D7', 'D8', 'D9', 'C10', 'C11', 'C12', 'C13', 'C14']) {
    assert.equal(creerFonction(code, ctx())?.code, code);
  }
  assert.equal(creerFonction('B9', ctx()), null);
});
