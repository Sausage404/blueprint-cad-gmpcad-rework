// Symboles de cotation mécanique (palette MECA, cases G01 à H12), sans DOM (testé dans test/meca.test.ts) :
// cadres de tolérance géométrique, surface de référence, état de surface, encadrement, lettre cerclée,
// trous taraudés et lisses. Dessinés en traits (pas de police spéciale) pour s'imprimer partout.
import { fleche } from './cotes';
import { dist, type Pt } from './geometrie';
import { angleDe, surCercle, type Primitive } from './primitives';

const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const seg = (a: Pt, b: Pt): Primitive => ({ type: 'segment', a, b });
const P = (x: number, y: number): Pt => ({ x, y });

/** Largeur estimée d'un texte (police des cotes : environ 0,75 fois la hauteur par caractère). */
export const largeurTexte = (t: string, h: number) => Math.max(h * 0.6, [...t].length * h * 0.75);

export type SymboleTolerance =
  | 'parallelisme'
  | 'perpendicularite'
  | 'localisation'
  | 'coaxialite'
  | 'symetrie'
  | 'inclinaison'
  | 'battement'
  | 'battementTotal'
  | 'planeite'
  | 'rectitude'
  | 'cylindricite'
  | 'circularite'
  | 'surface'
  | 'ligne';

/** Les tolérances de forme n'ont pas de référence ; les autres en demandent une. */
export const SANS_REFERENCE: SymboleTolerance[] = ['planeite', 'rectitude', 'cylindricite', 'circularite'];

/** Le symbole dans une case carrée de côté `s` centrée en `c`. */
export function symboleTolerance(sym: SymboleTolerance, c: Pt, s: number): Primitive[] {
  const k = s * 0.32; // demi-taille du dessin
  const Q = (x: number, y: number) => P(c.x + x * k, c.y + y * k);
  switch (sym) {
    case 'parallelisme':
      return [seg(Q(-0.9, -0.9), Q(-0.1, 0.9)), seg(Q(0.1, -0.9), Q(0.9, 0.9))];
    case 'perpendicularite':
      return [seg(Q(-1, -0.9), Q(1, -0.9)), seg(Q(0, -0.9), Q(0, 1))];
    case 'localisation':
      return [{ type: 'cercle', c, r: k * 0.65 }, seg(Q(-1, 0), Q(1, 0)), seg(Q(0, -1), Q(0, 1))];
    case 'coaxialite':
      return [
        { type: 'cercle', c, r: k * 0.95 },
        { type: 'cercle', c, r: k * 0.45 },
      ];
    case 'symetrie':
      return [seg(Q(-0.6, 0.6), Q(0.6, 0.6)), seg(Q(-1, 0), Q(1, 0)), seg(Q(-0.6, -0.6), Q(0.6, -0.6))];
    case 'inclinaison':
      return [seg(Q(-1, -0.8), Q(1, -0.8)), seg(Q(-1, -0.8), Q(0.8, 0.8))];
    case 'battement':
      return [seg(Q(-0.9, -0.9), Q(0.8, 0.8)), ...fleche(Q(0.8, 0.8), Q(-0.9, -0.9), k * 0.7)];
    case 'battementTotal':
      return [
        seg(Q(-1, -0.6), Q(0.2, 0.6)),
        ...fleche(Q(0.2, 0.6), Q(-1, -0.6), k * 0.6),
        seg(Q(-0.2, -0.6), Q(1, 0.6)),
        ...fleche(Q(1, 0.6), Q(-0.2, -0.6), k * 0.6),
        seg(Q(-1, -0.6), Q(-0.2, -0.6)),
      ];
    case 'planeite':
      return [seg(Q(-1, -0.6), Q(0.4, -0.6)), seg(Q(0.4, -0.6), Q(1, 0.6)), seg(Q(1, 0.6), Q(-0.4, 0.6)), seg(Q(-0.4, 0.6), Q(-1, -0.6))];
    case 'rectitude':
      return [seg(Q(-1, 0), Q(1, 0))];
    case 'cylindricite':
      return [{ type: 'cercle', c, r: k * 0.6 }, seg(Q(-1, -0.9), Q(-0.3, 0.9)), seg(Q(0.3, -0.9), Q(1, 0.9))];
    case 'circularite':
      return [{ type: 'cercle', c, r: k * 0.8 }];
    case 'surface':
      return [{ type: 'arc', c: Q(0, -0.5), r: k * 0.9, debut: 0, fin: 180 }, seg(Q(-0.9, -0.5), Q(0.9, -0.5))];
    case 'ligne':
      return [{ type: 'arc', c: Q(0, -0.5), r: k * 0.9, debut: 0, fin: 180 }];
  }
}

/**
 * Cadre de tolérance : cases (symbole | tolérance | références…) de hauteur `2h`, à gauche en `position`,
 * et ligne de repère fléchée vers l'élément tolérancé.
 */
export function cadreTolerance(sym: SymboleTolerance, tolerance: string, references: string[], element: Pt, position: Pt, h: number): Primitive[] {
  const H = 2 * h;
  const largeurs = [H, largeurTexte(tolerance, h) + h, ...references.map((r) => largeurTexte(r, h) + h)];
  const total = largeurs.reduce((a, b) => a + b, 0);
  // Le cadre s'étend du côté opposé à l'élément.
  const gauche = element.x <= position.x ? position.x : position.x - total;
  const bas = position.y - H / 2;
  const out: Primitive[] = [];
  out.push(seg(P(gauche, bas), P(gauche + total, bas)), seg(P(gauche, bas + H), P(gauche + total, bas + H)));
  let x = gauche;
  out.push(seg(P(x, bas), P(x, bas + H)));
  largeurs.forEach((l, i) => {
    x += l;
    out.push(seg(P(x, bas), P(x, bas + H)));
    const milieu = P(x - l / 2, bas + H / 2);
    if (i === 0) out.push(...symboleTolerance(sym, milieu, H));
    else out.push({ type: 'texte', p: P(milieu.x, bas + H / 2), h, angle: 0, texte: i === 1 ? tolerance : references[i - 2], alignH: 'centre', alignV: 'milieu' });
  });
  // Ligne de repère : du milieu du petit côté du cadre, horizontale puis vers l'élément, flèche sur l'élément.
  const depart = P(element.x <= position.x ? gauche : gauche + total, position.y);
  const coude = P(depart.x + (element.x <= position.x ? -h : h), position.y);
  if (dist(coude, element) > 1e-9) out.push(seg(depart, coude), seg(coude, element), ...fleche(element, coude, 2.5));
  return out;
}

/** Hachures serrées qui « remplissent » un triangle (le triangle noirci d'une référence). */
function triangleNoirci(a: Pt, b: Pt, c: Pt): Primitive[] {
  const out: Primitive[] = [seg(a, b), seg(b, c), seg(c, a)];
  const n = 8;
  for (let i = 1; i < n; i++) out.push(seg(add(a, mul(sub(c, a), i / n)), add(b, mul(sub(c, b), i / n))));
  return out;
}

/**
 * Surface de référence (H07) : triangle noirci posé sur la surface (point `pied`, direction de la surface
 * `u`), trait vers une case carrée qui porte la lettre, en `position`.
 */
export function surfaceReference(pied: Pt, u: Pt, position: Pt, lettre: string, h: number): Primitive[] {
  const H = 2 * h;
  const l = Math.hypot(u.x, u.y) || 1;
  const t = mul(u, 1 / l);
  const nBrut = { x: -t.y, y: t.x };
  const n = (position.x - pied.x) * nBrut.x + (position.y - pied.y) * nBrut.y >= 0 ? nBrut : mul(nBrut, -1);
  const demi = h * 0.6;
  const sommet = add(pied, mul(n, demi * 1.7));
  const out = triangleNoirci(add(pied, mul(t, -demi)), add(pied, mul(t, demi)), sommet);
  // Case de la lettre : centrée en `position`, reliée au sommet du triangle.
  const c = position;
  const bord = Math.abs(c.y - sommet.y) >= Math.abs(c.x - sommet.x) ? P(c.x, c.y + (sommet.y < c.y ? -H / 2 : H / 2)) : P(c.x + (sommet.x < c.x ? -H / 2 : H / 2), c.y);
  out.push(seg(sommet, bord));
  out.push(seg(P(c.x - H / 2, c.y - H / 2), P(c.x + H / 2, c.y - H / 2)), seg(P(c.x + H / 2, c.y - H / 2), P(c.x + H / 2, c.y + H / 2)));
  out.push(seg(P(c.x + H / 2, c.y + H / 2), P(c.x - H / 2, c.y + H / 2)), seg(P(c.x - H / 2, c.y + H / 2), P(c.x - H / 2, c.y - H / 2)));
  out.push({ type: 'texte', p: c, h, angle: 0, texte: lettre, alignH: 'centre', alignV: 'milieu' });
  return out;
}

export type TypeRugosite = 1 | 2 | 3; // 1 : tout procédé ; 2 : enlèvement de matière exigé ; 3 : interdit

/**
 * État de surface (H08) : le symbole « racine » posé sur la surface (pointe en `pied`), ouvert du côté de
 * `cote`, avec la valeur de rugosité Ra sur la barre.
 */
export function etatSurface(pied: Pt, u: Pt, cote: Pt, type: TypeRugosite, ra: string, h: number): Primitive[] {
  const l = Math.hypot(u.x, u.y) || 1;
  const t = mul(u, 1 / l);
  const nBrut = { x: -t.y, y: t.x };
  const n = (cote.x - pied.x) * nBrut.x + (cote.y - pied.y) * nBrut.y >= 0 ? nBrut : mul(nBrut, -1);
  // Repère local : n vers l'extérieur ; t orienté pour lire de gauche à droite autant que possible.
  const tt = t.x < -1e-9 || (Math.abs(t.x) < 1e-9 && t.y < 0) ? mul(t, -1) : t;
  const H1 = 1.4 * h;
  const H2 = 3 * h;
  const Q = (a: number, b: number) => add(pied, add(mul(tt, a), mul(n, b)));
  const k = Math.tan((30 * Math.PI) / 180);
  const out: Primitive[] = [seg(Q(-H1 * k, H1), Q(0, 0)), seg(Q(0, 0), Q(H2 * k, H2)), seg(Q(H2 * k, H2), Q(H2 * k + 2.5 * h, H2))];
  if (type === 2) out.push(seg(Q(-H1 * k, H1), Q(H1 * k, H1)));
  if (type === 3) out.push({ type: 'cercle', c: Q(0, H1 * 0.62), r: H1 * 0.38 });
  if (ra) {
    const angle = angleDe(P(0, 0), tt);
    out.push({ type: 'texte', p: Q(H2 * k + 1.25 * h, H2 + 0.6), h, angle, texte: ra, alignH: 'centre', alignV: 'ligne' });
  }
  return out;
}

/** Cadre autour d'un texte (H09, cote encadrée) : rectangle avec une marge d'un tiers de la hauteur. */
export function cadreTexte(p: Pt, texte: string, h: number, angle: number, alignH: 'gauche' | 'centre' | 'droite', alignV: string): Primitive[] {
  const l = largeurTexte(texte, h);
  const m = h / 3;
  const dx = alignH === 'centre' ? -l / 2 : alignH === 'droite' ? -l : 0;
  const dy = alignV === 'milieu' ? -h / 2 : alignV === 'haut' ? -h : 0;
  const coins = [P(dx - m, dy - m), P(dx + l + m, dy - m), P(dx + l + m, dy + h + m), P(dx - m, dy + h + m)];
  const a = (angle * Math.PI) / 180;
  const vers = (q: Pt) => P(p.x + q.x * Math.cos(a) - q.y * Math.sin(a), p.y + q.x * Math.sin(a) + q.y * Math.cos(a));
  const c = coins.map(vers);
  return c.map((q, i) => seg(q, c[(i + 1) % 4]));
}

/** Lettre cerclée (H09 : Ⓟ zone projetée, Ⓔ exigence de l'enveloppe) après la fin d'un texte. */
export function lettreCerclee(apres: Pt, angle: number, lettre: string, h: number): Primitive[] {
  const r = h * 0.62;
  const c = surCercle(apres, r + h * 0.35, angle);
  return [
    { type: 'cercle', c, r },
    { type: 'texte', p: c, h: h * 0.75, angle, texte: lettre, alignH: 'centre', alignV: 'milieu' },
  ];
}

// ======================================================================= Trous

/** Filetage métrique ISO à pas gros : pas (mm) selon le diamètre nominal. */
const PAS_GROS: [number, number][] = [
  [1.6, 0.35], [2, 0.4], [2.5, 0.45], [3, 0.5], [4, 0.7], [5, 0.8], [6, 1], [8, 1.25], [10, 1.5], [12, 1.75], [14, 2], [16, 2],
  [18, 2.5], [20, 2.5], [22, 2.5], [24, 3], [27, 3], [30, 3.5], [33, 3.5], [36, 4], [39, 4], [42, 4.5], [45, 4.5], [48, 5], [52, 5], [56, 5.5], [64, 6],
];

/** Pas gros d'un filetage M`d` (le plus proche dans la table) et diamètre de perçage (d - pas). */
export function filetage(d: number): { pas: number; percage: number } {
  let meilleur = PAS_GROS[0];
  for (const x of PAS_GROS) if (Math.abs(x[0] - d) < Math.abs(meilleur[0] - d)) meilleur = x;
  const pas = Math.abs(meilleur[0] - d) < 1e-9 ? meilleur[1] : Math.max(0.25, Math.round(d * 0.15 * 100) / 100);
  return { pas, percage: Math.round((d - pas) * 100) / 100 };
}

export interface TraitTrou {
  prim: Primitive;
  fort: boolean;
  axe?: boolean;
}

/** Repère du trou : origine au centre de l'entrée, x le long de l'axe (vers le fond), y en travers. */
function repereTrou(entree: Pt, vers: Pt) {
  const l = dist(entree, vers) || 1;
  const u = mul(sub(vers, entree), 1 / l);
  const v = { x: -u.y, y: u.x };
  return (x: number, y: number) => add(entree, add(mul(u, x), mul(v, y)));
}

/** Cône de pointe de foret (118°, dessiné à 120°) au fond d'un perçage de diamètre `dp` à la profondeur `p`. */
function cone(Q: (x: number, y: number) => Pt, p: number, dp: number): Primitive[] {
  const fond = p + (dp / 2) * Math.tan((30 * Math.PI) / 180);
  return [seg(Q(p, dp / 2), Q(fond, 0)), seg(Q(p, -dp / 2), Q(fond, 0))];
}

/**
 * Trou taraudé vu de profil, en coupe (G11 borgne, G12 débouchant) : perçage en trait fort, fond de filet
 * en trait fin, limite du filetage en trait fort, cône de foret au fond, axe en trait mixte.
 */
export function trouTaraude(entree: Pt, vers: Pt, d: number, profTaraudage: number, profPercage: number, debouchant: boolean): TraitTrou[] {
  const Q = repereTrou(entree, vers);
  const { percage: dp } = filetage(d);
  const out: TraitTrou[] = [];
  const p = debouchant ? profTaraudage : profPercage;
  out.push({ prim: seg(Q(0, dp / 2), Q(p, dp / 2)), fort: true }, { prim: seg(Q(0, -dp / 2), Q(p, -dp / 2)), fort: true });
  out.push({ prim: seg(Q(0, d / 2), Q(profTaraudage, d / 2)), fort: false }, { prim: seg(Q(0, -d / 2), Q(profTaraudage, -d / 2)), fort: false });
  if (!debouchant) {
    out.push({ prim: seg(Q(profTaraudage, d / 2), Q(profTaraudage, -d / 2)), fort: true });
    for (const c of cone(Q, profPercage, dp)) out.push({ prim: c, fort: true });
  }
  const bout = debouchant ? profTaraudage + 3 : profPercage + (dp / 2) * Math.tan(Math.PI / 6) + 3;
  out.push({ prim: seg(Q(-3, 0), Q(bout, 0)), fort: false, axe: true });
  return out;
}

/** Trou borgne lisse (H12) : perçage de diamètre `D` et de profondeur `p`, cône de foret, axe. */
export function trouLisse(entree: Pt, vers: Pt, D: number, p: number): TraitTrou[] {
  const Q = repereTrou(entree, vers);
  return [
    { prim: seg(Q(0, D / 2), Q(p, D / 2)), fort: true },
    { prim: seg(Q(0, -D / 2), Q(p, -D / 2)), fort: true },
    ...cone(Q, p, D).map((prim) => ({ prim, fort: true })),
    { prim: seg(Q(-3, 0), Q(p + (D / 2) * Math.tan(Math.PI / 6) + 3, 0)), fort: false, axe: true },
  ];
}

/** Trou taraudé vu de dessus (H11) : perçage en trait fort, trois quarts de cercle du filet en trait fin, axes. */
export function trouTaraudeDessus(c: Pt, d: number): TraitTrou[] {
  const { percage: dp } = filetage(d);
  const l = d / 2 + 3;
  return [
    { prim: { type: 'cercle', c, r: dp / 2 }, fort: true },
    { prim: { type: 'arc', c, r: d / 2, debut: 100, fin: 10 }, fort: false },
    { prim: seg(P(c.x - l, c.y), P(c.x + l, c.y)), fort: false, axe: true },
    { prim: seg(P(c.x, c.y - l), P(c.x, c.y + l)), fort: false, axe: true },
  ];
}
