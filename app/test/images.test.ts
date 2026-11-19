import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aciNiveau } from '../src/renderer/couleurs';
import { Dessin, type Trait } from '../src/renderer/dessin';
import { ecrireDxf, lireDxf } from '../src/renderer/dxf';
import { affinite, homothetie, rotation, transformerEntite } from '../src/renderer/edition';
import { format } from '../src/renderer/formats';
import { PlanImage } from '../src/renderer/fonctions-images';
import { coinsImage, dimensionsPapier, entiteImage, etatLien, identifiantImage, imageEn, type ImageStockee } from '../src/renderer/images';
import { svgFeuille } from '../src/renderer/svg';

const P = (x: number, y: number) => ({ x, y });
const proche = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test('image : reste droite ; rotation et affinité ne bougent que la position, l’homothétie change la taille', () => {
  const e = entiteImage('I1', P(100, 80), 40, 20, 'general', 1);
  assert.deepEqual(coinsImage(e), { bg: P(60, 60), hd: P(100, 80) });
  const r = transformerEntite(e, rotation(P(0, 0), 90));
  const c = coinsImage(r)!;
  proche(c.hd.x, -80), proche(c.hd.y, 100);
  proche(c.hd.x - c.bg.x, 40), proche(c.hd.y - c.bg.y, 20); // toujours 40 x 20, droite
  const h = coinsImage(transformerEntite(e, homothetie(P(0, 0), 0.5)))!;
  proche(h.hd.x - h.bg.x, 20);
  const a = coinsImage(transformerEntite(e, affinite(P(0, 0), P(1, 0), 2)))!;
  proche(a.hd.y, 160), proche(a.hd.x - a.bg.x, 40);
  assert.equal(imageEn([e], P(70, 70)), e);
  assert.equal(imageEn([e], P(10, 10)), null);
});

test('image : gardée dans le DXF en morceaux de moins de 16 Ko par entité, et relue à l’identique', () => {
  const donnees = 'data:image/png;base64,' + 'iVBORw0KGgo'.repeat(5000);
  const id = identifiantImage(donnees);
  const img: ImageStockee = { donnees, fichier: '/tmp/plan.png', date: 1700000000000, taille: 41000, px: [800, 600] };
  const d = new Dessin();
  d.images.set(id, img);
  d.ajouter(entiteImage(id, P(100, 80), 40, 30, 'arriere', 1, 'plan.png'));
  const texte = ecrireDxf(d.toutes, d.calques, format('A4H'), aciNiveau, d.infos, d.images);
  // Données étendues de chaque entité du bloc des images : moins de 16 Ko.
  const bloc = texte.slice(texte.indexOf('BLUEPRINT_IMAGES'), texte.indexOf('ENDBLK', texte.indexOf('BLUEPRINT_IMAGES')));
  const parPoint = bloc.split(/\r\nPOINT\r\n/).slice(1);
  assert.ok(parPoint.length >= 4);
  for (const p of parPoint) assert.ok(p.length < 16000, `${p.length}`);
  const r = lireDxf(texte);
  assert.equal(r.images.get(id)?.donnees, donnees);
  assert.equal(r.images.get(id)?.fichier, '/tmp/plan.png');
  assert.equal(r.entites[0].genre, 'image');
  assert.equal(r.entites[0].params?.plan, 'arriere');
  assert.deepEqual(coinsImage(r.entites[0]), { bg: P(60, 50), hd: P(100, 80) });
});

test('image : imprimée sous les tracés, ou par-dessus au premier plan ; jamais son cadre', () => {
  const e1 = entiteImage('A', P(50, 50), 10, 10, 'arriere', 1);
  const e2 = entiteImage('B', P(80, 50), 10, 10, 'premier', 1);
  const svg = svgFeuille([e1, e2, { genre: 'segment', primitives: [{ type: 'segment', a: P(0, 0), b: P(1, 1) }], extras: [], niveau: 1, trait: 'continu-fort' }], format('A4H'), (id) => `data:${id}`);
  const iA = svg.indexOf('href="data:A"');
  const iB = svg.indexOf('href="data:B"');
  const iTrait = svg.indexOf('<path');
  assert.ok(iA > 0 && iA < iTrait && iB > iTrait);
  assert.equal((svg.match(/<path/g) ?? []).length, 1);
});

test('image : dimensions papier, état du lien, plan d’affichage (B2)', () => {
  const [l, h] = dimensionsPapier([480, 240], { largeur: 297, hauteur: 210 });
  proche(l, 127), proche(h, 63.5); // 96 pixels par pouce
  const [l2] = dimensionsPapier([4000, 3000], { largeur: 297, hauteur: 210 });
  assert.ok(l2 <= 0.75 * 297 + 1e-9);
  const img: ImageStockee = { donnees: '', fichier: 'a.png', date: 1000, taille: 1, px: [1, 1] };
  assert.equal(etatLien(img, { existe: false, date: 0 }), 'absent');
  assert.equal(etatLien(img, { existe: true, date: 900 }), 'ok');
  assert.equal(etatLien(img, { existe: true, date: 5000 }), 'mise-a-jour');

  const d = new Dessin();
  d.ajouter(entiteImage('I', P(100, 80), 40, 30, 'general', 1));
  const at = { niveau: 1, trait: 'continu-fort' as Trait };
  const f = new PlanImage({ dessin: d, attributs: () => at, memoire: new Map(), rayon: () => 1, dire: () => {} });
  f.point(P(80, 60)); // dans l'image
  assert.match(f.question()!.texte, /Plan d'affichage/);
  f.valeur('P');
  assert.equal(d.toutes[0].params?.plan, 'premier');
});
