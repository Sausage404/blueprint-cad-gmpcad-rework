import assert from 'node:assert/strict';
import { test } from 'node:test';
import { grilleBibliotheque, PIECES, roulementNormalise } from '../src/renderer/bibliotheque';
import { Dessin, type Trait } from '../src/renderer/dessin';
import { creerFonction } from '../src/renderer/fonctions';
import { lignesNomenclature, valeursParDefaut } from '../src/renderer/fonctions-bibliotheque';
import { membresDe, nomenclatureDe } from '../src/renderer/groupes';
import type { Primitive } from '../src/renderer/primitives';

const P = (x: number, y: number) => ({ x, y });
const nombres = (p: Primitive): number[] =>
  p.type === 'segment' || p.type === 'droite' || p.type === 'demi-droite' ? [p.a.x, p.a.y, p.b.x, p.b.y] : p.type === 'cercle' ? [p.c.x, p.c.y, p.r] : p.type === 'arc' ? [p.c.x, p.c.y, p.r, p.debut, p.fin] : [p.p.x, p.p.y];

test('bibliothèque : toutes les pièces se dessinent avec leurs dimensions par défaut', () => {
  assert.ok(PIECES.length >= 100, `${PIECES.length} pièces`);
  for (const p of PIECES) {
    const t = p.dessin(valeursParDefaut(p));
    assert.ok(t.length > 0, p.code);
    for (const x of t) assert.ok(nombres(x.p).every(Number.isFinite), `${p.code} : coordonnée invalide`);
    assert.ok(t.some((x) => x.s === 'f'), `${p.code} : pas de trait fort`);
    assert.ok(p.designation(valeursParDefaut(p)).length > 3, p.code);
  }
  const grille = grilleBibliotheque();
  assert.equal(grille.length, 12 * 15);
  assert.equal(grille.filter(Boolean).length, PIECES.length + 2); // + les deux cartouches
});

test('bibliothèque : roulements normalisés 60, 62, 63 lus par leur numéro', () => {
  assert.deepEqual(roulementNormalise(6204), { d: 20, D: 47, B: 14 });
  assert.deepEqual(roulementNormalise(6305), { d: 25, D: 62, B: 17 });
  assert.deepEqual(roulementNormalise(6000), { d: 10, D: 26, B: 8 });
  assert.equal(roulementNormalise(1234), null);
});

test('placement d’une pièce : dimensions, point, orientation ; groupe désigné pour la nomenclature', () => {
  const d = new Dessin();
  const at = { niveau: 2, trait: 'continu-fort' as Trait };
  const ctx = { dessin: d, attributs: () => at, memoire: new Map<string, number>(), rayon: () => 1, dire: () => {}, actions: { format: () => 'A4H' } as never };
  const f = creerFonction('M01', ctx)!;
  f.valeur(6204);
  assert.equal(f.question()?.defaut, 47);
  f.valeur(47);
  f.valeur(14);
  f.point(P(100, 100));
  f.parDefaut!();
  const g = d.toutes[0];
  assert.equal(g.genre, 'groupe');
  assert.equal(g.niveau, 2);
  assert.equal(nomenclatureDe(g)?.designation, 'Roulement rigide à billes 6204');
  assert.equal(membresDe(g)![0].genre, 'piece');
  // Une deuxième, tournée de 90° : même désignation, comptée deux fois dans la nomenclature.
  f.point(P(200, 100));
  f.point(P(200, 150));
  const vis = creerFonction('I01', ctx)!;
  vis.valeur(10);
  vis.valeur(40);
  vis.point(P(50, 50));
  vis.parDefaut!();
  const lignes = lignesNomenclature(d.toutes, { '1': { designation: 'Carter', reference: 'C-01' } });
  assert.deepEqual(
    lignes.map((l) => [l.rep, l.nb, l.designation]),
    [['1', '1', 'Carter'], ['2', '2', 'Roulement rigide à billes 6204'], ['3', '1', 'Vis H M10-40']],
  );
  // Cartouche avec nomenclature (T15) au coin du cadre.
  d.changerInfos((i) => (i.plan = { designation: 'Broche', societe: 'Atelier' }));
  const c = creerFonction('T15', ctx)!;
  c.parDefaut!();
  const textes = d.toutes.at(-1)!.primitives.flatMap((p) => (p.type === 'texte' ? [p.texte] : []));
  assert.ok(textes.includes('Broche') && textes.includes('Vis H M10-40'));
});
