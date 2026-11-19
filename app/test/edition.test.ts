import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Dessin, cercle, rectangle, segment, type Trait } from '../src/renderer/dessin';
import { dansFenetre, deplacerPoint, lireNiveaux, retirerDemi, retirerEntre, retirerPartie, rotation, symetrie, transformerEntite } from '../src/renderer/edition';
import { creerFonction } from '../src/renderer/fonctions';
import '../src/renderer/fonctions-modif';
import type { Primitive } from '../src/renderer/primitives';

const at = { niveau: 1, trait: 'continu-fort' as Trait };
const proche = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const seg = (ax: number, ay: number, bx: number, by: number): Primitive => ({ type: 'segment', a: { x: ax, y: ay }, b: { x: bx, y: by } });
const ctx = (d = new Dessin()) => ({ dessin: d, attributs: () => at, memoire: new Map<string, number>(), rayon: () => 1, dire: () => {} });

test('listes de niveaux de l’original : *, tt, + et -', () => {
  assert.deepEqual([...lireNiveaux('tt', 3)!], [3]);
  assert.equal(lireNiveaux('*', 1)!.size, 99);
  assert.deepEqual([...lireNiveaux('*-2-3', 1)!].slice(0, 3), [1, 4, 5]);
  assert.deepEqual([...lireNiveaux('1+4', 1)!], [1, 4]);
  assert.equal(lireNiveaux('abc', 1), null);
});

test('fenêtre : seules les entités entièrement dedans', () => {
  const es = [segment({ x: 1, y: 1 }, { x: 2, y: 2 }, 1, 'continu-fort'), segment({ x: 1, y: 1 }, { x: 20, y: 2 }, 1, 'continu-fort')];
  assert.equal(dansFenetre(es, { x: 0, y: 0 }, { x: 10, y: 10 }).length, 1);
});

test('rotation et symétrie d’un rectangle', () => {
  const r = rectangle({ x: 0, y: 0 }, { x: 10, y: 5 }, at);
  const t = transformerEntite(r, rotation({ x: 0, y: 0 }, 90));
  const s0 = t.primitives[0];
  assert.ok(s0.type === 'segment' && proche(s0.b.x, 0) && proche(s0.b.y, 10));
  const m = transformerEntite(r, symetrie({ x: 0, y: 0 }, { x: 0, y: 1 }));
  assert.ok(m.extras[0] && proche(m.extras[0].p.x, -5)); // le milieu suit
});

test('effacement partiel par deux points : il reste les deux bouts', () => {
  const reste = retirerEntre(seg(0, 0, 10, 0), { x: 3, y: 0 }, { x: 7, y: 0 });
  assert.equal(reste.length, 2);
  assert.ok(reste[0].type === 'segment' && proche(reste[0].b.x, 3));
  assert.ok(reste[1].type === 'segment' && proche(reste[1].a.x, 7));
  const arc = retirerEntre({ type: 'cercle', c: { x: 0, y: 0 }, r: 5 }, { x: 5, y: 0 }, { x: 0, y: 5 });
  assert.ok(arc[0].type === 'arc' && proche(arc[0].debut, 90) && proche(arc[0].fin, 0)); // le quart retiré
});

test('effacement d’une partie : entre les deux intersections qui encadrent le point', () => {
  const p = seg(0, 0, 10, 0);
  const autres = [seg(3, -1, 3, 1), seg(7, -1, 7, 1)];
  const reste = retirerPartie(p, { x: 5, y: 0 }, autres);
  assert.equal(reste.length, 2);
  assert.equal(retirerPartie(p, { x: 5, y: 0 }, []).length, 0); // pas d'intersection : tout part
  const bout = retirerPartie(p, { x: 1, y: 0 }, autres);
  assert.equal(bout.length, 1);
  assert.ok(bout[0].type === 'segment' && proche(bout[0].a.x, 3));
});

test('effacement d’une demi-entité : le côté du point désigné disparaît', () => {
  const reste = retirerDemi(seg(0, 0, 10, 0), { x: 8, y: 0 }, [seg(4, -1, 4, 1)])!;
  assert.ok(reste[0].type === 'segment' && proche(reste[0].a.x, 0) && proche(reste[0].b.x, 4));
  assert.equal(retirerDemi(seg(0, 0, 10, 0), { x: 8, y: 0 }, [seg(40, -1, 40, 1)]), null);
});

test('déplacement d’un point : les segments qui y aboutissent suivent', () => {
  const e = segment({ x: 0, y: 0 }, { x: 10, y: 0 }, 1, 'continu-fort');
  const n = deplacerPoint(e, { x: 10, y: 0 }, { x: 10, y: 5 })!;
  const p = n.primitives[0];
  assert.ok(p.type === 'segment' && proche(p.b.y, 5));
  assert.equal(deplacerPoint(e, { x: 50, y: 0 }, { x: 1, y: 1 }), null);
});

test('translation avec duplications, puis annulation par fenêtre restituable', () => {
  const d = new Dessin();
  d.ajouter(cercle({ x: 0, y: 0 }, 2, at));
  const f = creerFonction('E14', ctx(d))!;
  f.point({ x: 2, y: 0 }); // désigne le cercle
  f.point({ x: 0, y: 0 });
  f.point({ x: 10, y: 0 });
  assert.equal(f.question()?.texte, 'Nombre de duplications');
  f.valeur(3);
  assert.equal(d.toutes.length, 4);
  const e6 = creerFonction('E6', ctx(d))!;
  e6.parDefaut!(); // (déf, tout)
  assert.match(e6.question()?.texte ?? '', /Niveaux des entités à annuler/);
  e6.valeur('tt');
  assert.equal(d.toutes.length, 0);
  d.restituer();
  assert.equal(d.toutes.length, 4); // les 4 cercles reviennent ensemble
});

test('symétrie : par défaut une copie, « O » remplace l’original', () => {
  const d = new Dessin();
  d.ajouter(segment({ x: 1, y: 0 }, { x: 2, y: 0 }, 1, 'continu-fort'));
  const f = creerFonction('E16', ctx(d))!;
  f.point({ x: 1.5, y: 0 });
  f.point({ x: 0, y: 0 });
  f.point({ x: 0, y: 1 });
  f.valeur('N');
  assert.equal(d.toutes.length, 2);
});
