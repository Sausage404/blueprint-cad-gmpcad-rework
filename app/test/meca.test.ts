import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chercherChaines, resoudre, surfaces, texteTolerance } from '../src/renderer/cotation-fonctionnelle';
import { Dessin, rectangle, segment, type Trait } from '../src/renderer/dessin';
import { creerFonction } from '../src/renderer/fonctions';
import '../src/renderer/fonctions-meca';
import { ecartsISO, intervalleIT, lireClasse, texteEcart } from '../src/renderer/iso286';
import { cadreTolerance, filetage, trouTaraude } from '../src/renderer/meca-symboles';

const P = (x: number, y: number) => ({ x, y });
const proche = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const ecarts = (d: number, c: string) => {
  const r = ecartsISO(d, c)!;
  return `${texteEcart(r.es)}/${texteEcart(r.ei)}`;
};

test('ISO 286 : intervalles et écarts des ajustements courants (valeurs de la norme)', () => {
  assert.equal(intervalleIT(25, 7), 21);
  assert.equal(ecarts(25, 'H7'), '+0.021/0');
  assert.equal(ecarts(25, 'g6'), '-0.007/-0.02');
  assert.equal(ecarts(25, 'p6'), '+0.035/+0.022');
  assert.equal(ecarts(25, 'N7'), '-0.007/-0.028');
  assert.equal(ecarts(25, 'K7'), '+0.006/-0.015');
  assert.equal(ecarts(25, 'M7'), '0/-0.021');
  assert.equal(ecarts(25, 'F7'), '+0.041/+0.02');
  assert.equal(ecarts(25, 'js6'), '+0.0065/-0.0065'); // ±6,5 µm
  assert.equal(ecarts(100, 'H8'), '+0.054/0');
  assert.equal(ecarts(50, 'f7'), '-0.025/-0.05');
  assert.equal(ecarts(60, 'r6'), '+0.06/+0.041');
  assert.equal(ecarts(10, 'h9'), '0/-0.036');
  assert.equal(ecartsISO(25, 'Z7'), null);
  assert.deepEqual(lireClasse('Ø25 H7'), { d: 25, classe: 'H7' });
});

test('cadre de tolérance : symbole, tolérance et références, flèche sur l’élément', () => {
  const p = cadreTolerance('parallelisme', '0.02', ['A'], P(0, 0), P(20, 10), 3);
  const textes = p.filter((x) => x.type === 'texte').map((x) => (x as { texte: string }).texte);
  assert.deepEqual(textes, ['0.02', 'A']);
  assert.ok(p.some((x) => x.type === 'segment' && Math.abs(x.b.x) < 1e-9 && Math.abs(x.b.y) < 1e-9)); // jusqu'à l'élément
  assert.deepEqual(filetage(10), { pas: 1.5, percage: 8.5 });
  const t = trouTaraude(P(0, 0), P(1, 0), 10, 15, 20, false);
  assert.equal(t.filter((x) => x.axe).length, 1);
  assert.equal(t.filter((x) => !x.fort && !x.axe).length, 2); // fond de filet en trait fin
});

/** Un carter (niveau 1) et deux pièces en appui (niveaux 2 et 3) : jeu de 2 mm entre la pièce 3 et le carter. */
function montage(): Dessin {
  const d = new Dessin();
  const fort = (n: number) => ({ niveau: n, trait: 'continu-fort' as Trait });
  d.ajouterPlusieurs([segment(P(0, -5), P(0, 25), 1, 'continu-fort'), segment(P(100, -5), P(100, 25), 1, 'continu-fort'), segment(P(0, -5), P(100, -5), 1, 'continu-fort')]);
  d.ajouter(rectangle(P(0, 5), P(40, 15), fort(2)));
  d.ajouter(rectangle(P(40, 5), P(98, 15), fort(3)));
  return d;
}

test('cotation fonctionnelle : chaîne trouvée à travers les pièces en contact, puis résolue', () => {
  const s = surfaces(montage().toutes, 'h');
  const chaines = chercherChaines(s, { c: 98, niveau: 3 }, { c: 100, niveau: 1 });
  assert.equal(chaines.length, 1);
  assert.deepEqual(chaines[0], [
    { niveau: 3, de: 98, a: 40 },
    { niveau: 2, de: 40, a: 0 },
    { niveau: 1, de: 0, a: 100 },
  ]);
  // Jeu 2 ±0,3 ; carter 100 ±0,1 fixé ; les deux autres cotes partagent l'IT qui reste.
  const r = resoudre({ nominal: 2, es: 0.3, ei: -0.3, fixe: true }, [
    { nominal: 58, signe: -1 },
    { nominal: 40, signe: -1 },
    { nominal: 100, signe: 1, es: 0.1, ei: -0.1, fixe: true },
  ], 0.01);
  assert.equal(r.erreur, undefined);
  proche(r.composantes[0].es, 0.1, 1e-9), proche(r.composantes[0].ei, -0.1, 1e-9);
  // Vérification au pire des cas : toutes fixées, la condition calculée reste dans 2 ±0,3.
  const v = resoudre({ nominal: 2 }, r.composantes.map((c, i) => ({ ...c, fixe: true, signe: ([-1, -1, 1] as const)[i] })), 0.01);
  proche(v.condition.es, 0.3, 1e-9), proche(v.condition.ei, -0.3, 1e-9);
  assert.equal(texteTolerance('a', { nominal: 2, es: 0.3, ei: -0.3 }), 'a = 2 ±0.3');
  // IT trop petit : erreur.
  assert.match(resoudre({ nominal: 2, es: 0.1, ei: -0.1, fixe: true }, [{ nominal: 100, signe: 1, es: 0.2, ei: -0.2, fixe: true }, { nominal: 98, signe: -1 }], 0.01).erreur!, /IT/);
});

test('cotation fonctionnelle par les cases : lien (H13), tracé (G14), tolérances (H14), résolution (H15)', async () => {
  const d = montage();
  const at = { niveau: 4, trait: 'continu-fort' as Trait };
  const messages: string[] = [];
  const ctx = { dessin: d, attributs: () => at, memoire: new Map<string, number>(), rayon: () => 1, dire: (m: string) => messages.push(m) };
  const lien = creerFonction('H13', ctx)!;
  lien.point(P(98, 10)); // face droite de la pièce 3
  lien.point(P(100, 20)); // face du carter
  lien.point(P(99, 40)); // position de la condition
  lien.valeur('a');
  creerFonction('G14', ctx);
  await new Promise((r) => setTimeout(r, 0));
  assert.match(messages.at(-1)!, /Chaîne a = -a1 -a2 \+a3/);
  const tol = creerFonction('H14', ctx)!;
  tol.point(P(99, 40));
  tol.valeur(2);
  tol.valeur(0.3);
  tol.valeur(-0.3);
  const t3 = creerFonction('H14', ctx)!;
  const a3 = d.toutes.find((e) => e.params?.nom === 'a3')!;
  const p3 = a3.primitives[0] as { a: { x: number; y: number } };
  t3.point(P(50, p3.a.y));
  t3.valeur(100);
  t3.valeur(0.1);
  t3.valeur(-0.1);
  const res = creerFonction('H15', ctx)!;
  res.valeur(0.01);
  res.valeur(2);
  const a1 = d.toutes.find((e) => e.params?.nom === 'a1')!;
  assert.deepEqual({ es: (a1.params!.tol as { es: number }).es, ei: (a1.params!.tol as { ei: number }).ei }, { es: 0.1, ei: -0.1 });
});

test('tolérance géométrique (G01) : cadre posé et relié à l’élément', () => {
  const d = new Dessin();
  d.ajouter(segment(P(0, 0), P(50, 0), 1, 'continu-fort'));
  const at = { niveau: 1, trait: 'continu-fort' as Trait };
  const f = creerFonction('G01', { dessin: d, attributs: () => at, memoire: new Map(), rayon: () => 1, dire: () => {} })!;
  f.point(P(20, 0.3));
  f.point(P(40, 20));
  f.valeur('0.05');
  f.valeur('A');
  const e = d.toutes.at(-1)!;
  assert.equal(e.genre, 'cote');
  assert.equal(e.params?.tolerance, 'parallelisme');
  assert.deepEqual(e.params?.references, ['A']);
});
