import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Dessin, cercle, segment, type Trait } from '../src/renderer/dessin';
import { format } from '../src/renderer/formats';
import '../src/renderer/fonctions-construction';
import { Collage, CopieSelection, entiteJointe, lirePressePapiers, PlacementMacro } from '../src/renderer/fonctions-menus';
import { calculer, designationMacro, executerMacro, lireMacro } from '../src/renderer/gmac';
import { nomenclatureDe } from '../src/renderer/groupes';
import { ecrireIges, lireIges } from '../src/renderer/iges';
import { svgFeuille } from '../src/renderer/svg';

const P = (x: number, y: number) => ({ x, y });
const proche = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const at = { niveau: 1, trait: 'continu-fort' as Trait };
const ctx = (d = new Dessin()) => ({ dessin: d, attributs: () => at, memoire: new Map<string, number>(), rayon: () => 1, dire: () => {} });

// localStorage de Node : un simple dictionnaire pour le presse-papiers.
const memoire = new Map<string, string>();
(globalThis as unknown as { localStorage: object }).localStorage = {
  getItem: (k: string) => memoire.get(k) ?? null,
  setItem: (k: string, v: string) => memoire.set(k, v),
};

test('IGES : lignes, cercles et arcs écrits en 80 colonnes, puis relus', () => {
  const d = new Dessin();
  d.ajouter(segment(P(0, 0), P(50, 20), 1, 'continu-fort'));
  d.ajouter(cercle(P(10, 10), 5, at));
  d.ajouter({ genre: 'arc', primitives: [{ type: 'arc', c: P(30, 0), r: 8, debut: 0, fin: 90 }], extras: [], niveau: 1, trait: 'continu-fort' });
  const t = ecrireIges(d.toutes);
  for (const l of t.trim().split(/\r\n/)) assert.equal(l.length, 80, l);
  const { primitives } = lireIges(t);
  assert.deepEqual(
    primitives.map((p) => p.type),
    ['segment', 'cercle', 'arc'],
  );
  const a = primitives[2] as { r: number; debut: number; fin: number };
  proche(a.r, 8), proche(a.debut, 0), proche(a.fin, 90);
});

const PLAQUE = `# Plaque percée
designation "Plaque $L x $H"
parametre L "Longueur" 80
parametre H "Hauteur" 50
parametre D "Diamètre du trou" 10
case C10
point 0 0
point $L $H
case D4
point $L/2 $H/2
valeur $D
`;

test('macros (Gmac) : expressions, erreurs avec leur ligne, exécution des cases', () => {
  assert.equal(calculer('($L - 2*3) / 2', { L: 20 }), 7);
  assert.equal(calculer('-4 + 2,5', {}), -1.5);
  assert.throws(() => calculer('$X + 1', {}), /paramètre inconnu/);
  assert.throws(() => lireMacro('case C10\nfaire 1 2'), /ligne 2/);
  const m = lireMacro(PLAQUE);
  assert.equal(m.parametres.length, 3);
  const es = executerMacro(m, { L: 100, H: 40, D: 12 });
  assert.deepEqual(
    es.map((e) => e.genre),
    ['rectangle', 'cercle'],
  );
  const c = es[1].primitives[0] as { c: { x: number; y: number }; r: number };
  proche(c.c.x, 50), proche(c.c.y, 20), proche(c.r, 6);
  assert.equal(designationMacro(m, { L: 100, H: 40, D: 12 }), 'Plaque 100 x 40');
  assert.throws(() => executerMacro(lireMacro('case Z99'), {}), /ligne 1 : case Z99 inconnue/);
});

test('Gmac > Exécuter : paramètres, point de référence, orientation ; groupe désigné', () => {
  const d = new Dessin();
  const f = new PlacementMacro(ctx(d), lireMacro(PLAQUE), 'plaque');
  f.valeur(60);
  f.valeur(30);
  f.valeur(8);
  f.point(P(100, 100));
  f.parDefaut();
  assert.equal(d.toutes.length, 1);
  assert.equal(nomenclatureDe(d.toutes[0])?.designation, 'Plaque 60 x 30');
});

test('Edition > Copier puis Coller : origine de la copie, R pour tourner de 15°, point d’implantation', () => {
  const d = new Dessin();
  d.ajouter(segment(P(10, 10), P(30, 10), 1, 'continu-fort'));
  d.ajouter(segment(P(100, 100), P(120, 100), 2, 'continu-fort'));
  const c = new CopieSelection(ctx(d));
  c.point(P(0, 0)); // loin de tout : premier coin de la fenêtre
  c.point(P(50, 50));
  c.point(P(10, 10)); // origine de la copie
  c.valeur('*');
  const pp = lirePressePapiers()!;
  assert.equal(pp.entites.length, 1);
  const k = new Collage(ctx(d), pp);
  for (let i = 0; i < 6; i++) k.touche('R'); // 90°
  k.point(P(200, 0));
  const s = d.toutes.at(-1)!.primitives[0] as { a: { x: number; y: number }; b: { x: number; y: number } };
  proche(s.a.x, 200), proche(s.a.y, 0), proche(s.b.x, 200), proche(s.b.y, 20);
});

test('pièce jointe : repère à l’écran seulement, jamais imprimé', () => {
  const svg = svgFeuille([entiteJointe('/tmp/notice.pdf', P(10, 10), 1)], format('A4H'));
  assert.ok(!svg.includes('<path'));
});
