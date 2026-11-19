import assert from 'node:assert/strict';
import { test } from 'node:test';
import { basculerContour, distanceMaxi, ellipseCentrale, momentAxe, momentPolaire, momentsPrincipaux, proprietes, revolution } from '../src/renderer/calculs';
import { Dessin, rectangle, type Trait } from '../src/renderer/dessin';
import { creerFonction } from '../src/renderer/fonctions';
import '../src/renderer/fonctions-calculs';

const P = (x: number, y: number) => ({ x, y });
const proche = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const rect = (x0: number, y0: number, x1: number, y1: number) => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];

test('calculs : plaque 40 x 20 percée d’un carré de 10 (évidement), moments au centre de gravité', () => {
  const contours = [rect(0, 0, 40, 20), rect(15, 5, 25, 15).reverse()];
  const pr = proprietes(contours)!;
  proche(pr.aire, 700);
  proche(pr.perimetre, 160);
  proche(pr.g.x, 20), proche(pr.g.y, 10);
  proche(pr.ixx, (40 * 20 ** 3) / 12 - 10 ** 4 / 12, 1e-6);
  proche(pr.iyy, (20 * 40 ** 3) / 12 - 10 ** 4 / 12, 1e-6);
  proche(pr.ixy, 0, 1e-6);
  proche(momentAxe(pr, P(0, 0), P(1, 0)), pr.ixx + 700 * 100, 1e-6); // Huygens
  proche(momentPolaire(pr, pr.g), pr.ixx + pr.iyy, 1e-6);
  proche(distanceMaxi(contours, pr.g), Math.hypot(20, 10));
  // Un contour désigné deux fois s'annule.
  assert.equal(basculerContour(basculerContour([], contours[0]), contours[0]).length, 0);
});

test('calculs : moments principaux d’un rectangle incliné de 30°, ellipse centrale', () => {
  const t = Math.PI / 6;
  const tourne = (p: { x: number; y: number }) => P(p.x * Math.cos(t) - p.y * Math.sin(t), p.x * Math.sin(t) + p.y * Math.cos(t));
  const pr = proprietes([rect(-20, -10, 20, 10).map(tourne)])!;
  const m = momentsPrincipaux(pr);
  proche(m.i1, (20 * 40 ** 3) / 12, 1e-6);
  proche(m.i2, (40 * 20 ** 3) / 12, 1e-6);
  // Axe 1 : celui du plus grand moment, perpendiculaire à la grande longueur.
  proche(((m.angle % 180) + 180) % 180, 120, 1e-6);
  const e = ellipseCentrale(pr);
  proche(Math.hypot(e.u.x, e.u.y), 20 / Math.sqrt(12), 1e-6);
  proche(Math.hypot(e.v.x, e.v.y), 40 / Math.sqrt(12), 1e-6);
});

test('calculs : solide de révolution (tube), profil d’un côté ou des deux côtés de l’axe', () => {
  const profil = rect(0, 5, 10, 15); // tube de longueur 10, rayons 5 et 15
  const r = revolution([profil], P(0, 0), P(1, 0));
  proche(2 * Math.PI * r.m1, Math.PI * (15 ** 2 - 5 ** 2) * 10, 1e-6);
  proche(r.m3, (10 * (15 ** 4 - 5 ** 4)) / 4, 1e-6);
  assert.equal(r.deuxCotes, false);
  const deux = revolution([profil, rect(0, -15, 10, -5)], P(0, 0), P(1, 0));
  assert.equal(deux.deuxCotes, true);
  proche(deux.m1, r.m1, 1e-6);
});

test('palette CALCULS : surface d’une plaque, puis périmètre des mêmes contours avec Entrée', () => {
  const d = new Dessin();
  const at = { niveau: 1, trait: 'continu-fort' as Trait };
  d.ajouter(rectangle(P(0, 0), P(40, 20), at));
  const messages: string[] = [];
  const ctx = { dessin: d, attributs: () => at, memoire: new Map<string, number>(), rayon: () => 1, dire: (m: string) => messages.push(m) };
  const s = creerFonction('R17', ctx)!;
  s.point(P(10, 10));
  s.parDefaut!();
  assert.match(messages.at(-1)!, /Surface : 800 mm² \(8 cm²\)/);
  const p = creerFonction('R16', ctx)!;
  p.parDefaut!(); // les mêmes contours
  assert.match(messages.at(-1)!, /Périmètre : 120 mm/);
  const v = creerFonction('R18', ctx)!;
  v.parDefaut!();
  v.valeur(5);
  assert.match(messages.at(-1)!, /4000 mm³ \(4 cm³\)/);
});
