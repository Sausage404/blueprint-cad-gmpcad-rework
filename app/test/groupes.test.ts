import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aciNiveau } from '../src/renderer/couleurs';
import { cercle, Dessin, rectangle, segment, type Trait } from '../src/renderer/dessin';
import { ecrireDxf, lireDxf } from '../src/renderer/dxf';
import { affinite, transformerEntite, translation } from '../src/renderer/edition';
import { format } from '../src/renderer/formats';
import { DesignationGroupe, Eclatement, GroupeFenetre } from '../src/renderer/fonctions-groupes';
import { Affinite, RotationNiveau, TranslationNiveau } from '../src/renderer/fonctions-modif';
import { creerGroupe, estVide, membresDe, nomenclatureDe, placerGroupe, pointReference, semblables } from '../src/renderer/groupes';

const proche = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const P = (x: number, y: number) => ({ x, y });

function ctx(d = new Dessin(), niveau = 1) {
  const at = { niveau, trait: 'continu-fort' as Trait };
  return {
    dessin: d,
    attributs: () => at,
    memoire: new Map<string, number>(),
    rayon: () => 1,
    dire: () => {},
    actions: {
      niveau: (n: number) => {
        at.niveau = n;
      },
    } as never,
  };
}

const at = { niveau: 1, trait: 'continu-fort' as Trait };

test('groupe : créé à partir de ses membres, éclaté en membres d’origine, et relu depuis le DXF', () => {
  const r = rectangle(P(0, 0), P(40, 20), at);
  const c = { ...cercle(P(20, 10), 5, { niveau: 1, trait: 'continu-fin' }), couleur: 3 };
  const g = creerGroupe([r, c], P(0, 0), 2, { designation: 'Plaque percée', reference: 'PL-01' });
  assert.equal(g.genre, 'groupe');
  assert.equal(g.primitives.length, 5);
  assert.deepEqual(pointReference(g), P(0, 0));
  assert.deepEqual(nomenclatureDe(g), { designation: 'Plaque percée', reference: 'PL-01' });

  const lu = lireDxf(ecrireDxf([g], new Map(), format('A4H'), aciNiveau)).entites;
  assert.equal(lu.length, 1);
  const g2 = lu[0];
  assert.equal(g2.genre, 'groupe');
  assert.deepEqual(nomenclatureDe(g2), { designation: 'Plaque percée', reference: 'PL-01' });
  const membres = membresDe(transformerEntite(g2, translation(100, 0)))!;
  assert.deepEqual(
    membres.map((m) => m.genre),
    ['rectangle', 'cercle'],
  );
  assert.equal(membres[1].trait, 'continu-fin');
  assert.equal(membres[1].couleur, 3);
  proche(membres[0].extras[0].p.x, 120); // le milieu du rectangle a suivi
});

test('E9 : groupe par fenêtre sur un niveau, E10 : désignation, E8 : éclatement avec groupe vide', () => {
  const d = new Dessin();
  d.ajouter(rectangle(P(0, 0), P(40, 20), at));
  d.ajouter(segment(P(0, 30), P(40, 30), 1, 'continu-fort'));
  d.ajouter(segment(P(0, 0), P(40, 20), 2, 'continu-fort'));
  d.ajouter(segment(P(100, 0), P(140, 0), 1, 'continu-fort')); // hors de la fenêtre
  const c = ctx(d);
  const e9 = new GroupeFenetre(c);
  e9.point(P(-5, -5));
  e9.point(P(50, 40));
  assert.match(e9.question()!.texte, /Niveau contenant le groupe/);
  e9.valeur('tt');
  e9.point(P(0, 0)); // point origine
  assert.equal(d.toutes.length, 3);
  const g = d.toutes.find((e) => e.genre === 'groupe')!;
  assert.equal(membresDe(g)!.length, 2);

  const e10 = new DesignationGroupe(c);
  e10.point(P(0, 0));
  e10.valeur('Équerre');
  e10.valeur('EQ-2');
  assert.equal(nomenclatureDe(d.toutes.find((e) => e.genre === 'groupe')!)!.designation, 'Équerre');

  const e8 = new Eclatement(c);
  e8.point(P(0, 0));
  assert.match(e8.question()!.texte, /Conservation de la désignation/);
  e8.valeur('O');
  assert.equal(d.toutes.filter(estVide).length, 1);
  assert.ok(d.toutes.some((e) => e.genre === 'rectangle'));

  // Le groupe refait sur le symbole N reprend la désignation.
  const e9b = new GroupeFenetre(c);
  e9b.parDefaut();
  e9b.valeur(1);
  e9b.point(P(0, 0));
  assert.match(e9b.question()!.texte, /Désignation : "Équerre"/);
  e9b.valeur('O');
  const g2 = d.toutes.find((e) => e.genre === 'groupe')!;
  assert.equal(nomenclatureDe(g2)!.reference, 'EQ-2');
  assert.equal(d.toutes.filter(estVide).length, 0);
});

test('Placer : inclinaison et rapport autour du point de référence, mise à jour des groupes semblables', () => {
  const modele = creerGroupe([segment(P(0, 0), P(10, 0), 1, 'continu-fort')], P(0, 0), 1, { designation: 'Barre', reference: '' });
  const g = placerGroupe(modele, P(50, 50), 90, 2, 'barre', 3);
  const s = g.primitives[0] as { a: { x: number; y: number }; b: { x: number; y: number } };
  proche(s.a.x, 50), proche(s.a.y, 50), proche(s.b.x, 50), proche(s.b.y, 70);
  assert.equal(g.niveau, 3);
  const autre = placerGroupe(modele, P(0, 100), 0, 1, 'barre', 1);
  const etranger = placerGroupe(modele, P(0, 200), 0, 1, 'autre', 1);
  assert.equal(semblables([g, autre, etranger], g).length, 2);
});

test('E18 : affinité d’un cercle (ellipse) et d’un groupe qui en contient un', () => {
  const t = affinite(P(0, 0), P(1, 0), 0.5);
  const e = transformerEntite(cercle(P(0, 0), 10, at), t);
  assert.equal(e.genre, 'ellipse');
  const ys = e.primitives.flatMap((p) => (p.type === 'segment' ? [p.a.y, p.b.y] : []));
  const xs = e.primitives.flatMap((p) => (p.type === 'segment' ? [p.a.x, p.b.x] : []));
  proche(Math.max(...ys), 5), proche(Math.max(...xs), 10);
  const g = creerGroupe([cercle(P(0, 0), 10, at), segment(P(0, 0), P(0, 10), 1, 'continu-fort')], P(0, 0), 1);
  const ga = transformerEntite(g, t);
  const m = membresDe(ga)!;
  assert.deepEqual(
    m.map((x) => x.genre),
    ['ellipse', 'segment'],
  );
  const s = m[1].primitives[0] as { b: { y: number } };
  proche(s.b.y, 5);

  // Par la fonction : désignation, axe, rapport, remplacement.
  const d = new Dessin();
  d.ajouter(cercle(P(0, 0), 10, at));
  const f = new Affinite(ctx(d));
  f.point(P(10, 0)); // sur le cercle
  f.point(P(-20, 0));
  f.point(P(20, 0));
  f.valeur(2);
  f.valeur('O');
  assert.equal(d.toutes.length, 1);
  assert.equal(d.toutes[0].genre, 'ellipse');
});

test('E11 et E12 : placement d’un niveau par translations successives, R, X, puis par rotation', () => {
  const d = new Dessin();
  d.ajouter(segment(P(0, 0), P(10, 0), 4, 'continu-fort'));
  d.ajouter(segment(P(0, 50), P(10, 50), 1, 'continu-fort'));
  const c = ctx(d, 1);
  const f = new TranslationNiveau(c);
  f.point(P(5, 0)); // une entité du niveau 4 : il devient le niveau de travail
  assert.equal(c.attributs().niveau, 4);
  f.point(P(25, 0)); // translation de 20
  f.point(P(25, 10)); // puis de 10 vers le haut
  let s = d.toutes[0].primitives[0] as { a: { x: number; y: number }; b: { x: number; y: number } };
  proche(s.a.x, 20), proche(s.a.y, 10);
  assert.ok(f.touche('R'));
  assert.ok(f.touche('X'));
  s = d.toutes[0].primitives[0] as typeof s;
  // R : 15° autour de (25, 10), puis X : retourné autour de l'horizontale y = 10.
  proche(s.b.x, 25 + 5 * Math.cos(Math.PI / 12)), proche(s.b.y, 10 - 5 * Math.sin(Math.PI / 12));
  const autre = d.toutes[1].primitives[0] as typeof s;
  proche(autre.a.y, 50); // l'autre niveau ne bouge pas
  f.quitter();
  assert.equal(c.attributs().niveau, 1);

  const d2 = new Dessin();
  d2.ajouter(segment(P(0, 0), P(10, 0), 4, 'continu-fort'));
  const r = new RotationNiveau(ctx(d2, 1));
  r.point(P(0, 0)); // centre
  r.point(P(10, 0));
  r.point(P(0, 10)); // 90°
  r.point(P(-10, 0)); // encore 90°
  const q = d2.toutes[0].primitives[0] as typeof s;
  proche(q.b.x, -10), proche(q.b.y, 0);
});
