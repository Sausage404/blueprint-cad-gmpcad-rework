import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aciNiveau } from '../src/renderer/couleurs';
import { cercle, Dessin, rectangle, type Trait } from '../src/renderer/dessin';
import { ecrireDxf, lireDxf } from '../src/renderer/dxf';
import { translation, transformerEntite } from '../src/renderer/edition';
import { format } from '../src/renderer/formats';
import { AffichageHachures, ContourHachures, Hachurage } from '../src/renderer/fonctions-hachures';
import { definitionHachures, traitsHachures } from '../src/renderer/hachures';

const at = { niveau: 1, trait: 'continu-fort' as Trait };
const ctx = (d = new Dessin()) => ({ dessin: d, attributs: () => at, memoire: new Map<string, number>(), rayon: () => 1, dire: () => {} });
const longueur = (prims: { a: { x: number; y: number }; b: { x: number; y: number } }[]) => prims.reduce((s, p) => s + Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y), 0);

test('hachures : lignes à 45° calées sur l’origine, coupées par les contours, trou pair-impair', () => {
  const carre = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }];
  const plein = traitsHachures([carre], { motif: 'tout', distance: 4, angle: 0 });
  assert.equal(plein.length, 9); // y = 4, 8 … 36
  assert.ok(plein.every((t) => t.prim.type === 'segment' && Math.abs(t.prim.b.x - t.prim.a.x - 40) < 1e-9));
  const trou = [{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 30, y: 30 }, { x: 10, y: 30 }];
  const perce = traitsHachures([carre, trou], { motif: 'tout', distance: 4, angle: 0 });
  // y = 12 … 28 (5 lignes) coupées par le trou : 20 mm de moins chacune.
  proche(longueur(perce.map((t) => t.prim) as never) , 9 * 40 - 5 * 20);
  // Motifs de l'original : alliages légers en lignes doublées, alliages cuivreux une ligne sur deux interrompue.
  const legers = traitsHachures([carre], { motif: 'legers', distance: 4, angle: 0 });
  assert.equal(legers.length, 19); // y = 1, 4, 5, 8, 9 … 36, 37
  assert.ok(legers.every((t) => t.trait === 'continu-fin'));
  const cuivreux = traitsHachures([carre], { motif: 'cuivreux', distance: 4, angle: 45 });
  assert.ok(cuivreux.some((t) => t.trait === 'pointille-fin') && cuivreux.some((t) => t.trait === 'continu-fin'));
});

function proche(a: number, b: number, tol = 1e-6) {
  assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
}

test('C16 : hachurage d’une plaque percée, puis C19 retire le trou, C20 bascule l’affichage', () => {
  const d = new Dessin();
  d.ajouter(rectangle({ x: 0, y: 0 }, { x: 60, y: 40 }, at));
  d.ajouter(cercle({ x: 30, y: 20 }, 10, at));
  const c = ctx(d);
  const f = new Hachurage(c);
  f.point({ x: 5, y: 5 }); // dans la plaque
  f.point({ x: 30, y: 20 }); // dans le trou : évidement
  f.parDefaut();
  assert.equal(f.question()?.texte, 'Distance entre les hachures');
  f.valeur(5);
  f.valeur(45);
  const h = d.toutes.find((e) => e.genre === 'hachure')!;
  const def = definitionHachures(h)!;
  assert.equal(def.contours.length, 2);
  const avecTrou = longueur(h.primitives as never);
  // C19 « - » sur le point désigné dans le trou : le trou est rempli.
  const g = new ContourHachures(c);
  g.valeur('-');
  g.point({ x: 30, y: 20 });
  const h2 = d.toutes.find((e) => e.genre === 'hachure')!;
  assert.equal(definitionHachures(h2)!.contours.length, 1);
  assert.ok(longueur(h2.primitives as never) > avecTrou);
  new AffichageHachures(c);
  assert.equal((c as { reglages?: { afficherHachures: boolean } }).reglages?.afficherHachures, false);
});

test('hachures : suivent une translation et se relisent depuis le DXF', () => {
  const d = new Dessin();
  d.ajouter(rectangle({ x: 0, y: 0 }, { x: 20, y: 20 }, at));
  const c = ctx(d);
  const f = new Hachurage(c);
  f.point({ x: 5, y: 5 });
  f.parDefaut();
  f.valeur(2);
  f.valeur(30);
  const h = d.toutes.find((e) => e.genre === 'hachure')!;
  const t = transformerEntite(h, translation(100, 0));
  proche(definitionHachures(t)!.contours[0][0].x - definitionHachures(h)!.contours[0][0].x, 100);
  const r = lireDxf(ecrireDxf(d.toutes, d.calques, format('A4H'), aciNiveau));
  const lu = r.entites.find((e) => e.genre === 'hachure')!;
  assert.ok(lu, 'hachures relues');
  assert.equal(lu.primitives.length, h.primitives.length);
  assert.equal(definitionHachures(lu)!.reglage.angle, 30);
});
