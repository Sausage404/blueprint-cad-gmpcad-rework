// Cotes et habillage (ligne 1 de la palette), sans DOM (testé dans test/cotes.test.ts).
// Système AFNOR : valeurs en mm, flèches fermées de 2,5 mm, texte de 3 mm au-dessus de la ligne de cote.
import { angleTexteCote, cotation, ecritureCote, extremiteCote } from './cotation';
import { dist, nombre, type Pt } from './geometrie';
import { angleDe, norm, surCercle, type Primitive } from './primitives';

/** Hauteur des écritures de cotes (3 mm au départ, case F4). */
export const hauteurCote = () => cotation.hauteur;
const FLECHE = 2.5;
const DEMI_OUVERTURE = 10;
const DEPASSE = 2; // les lignes d'attache dépassent la ligne de cote de 2 mm

const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;

export function fleche(pointe: Pt, vers: Pt, longueur = FLECHE): Primitive[] {
  const a = angleDe(pointe, vers);
  return [-DEMI_OUVERTURE, DEMI_OUVERTURE].map((d) => ({ type: 'segment' as const, a: pointe, b: surCercle(pointe, longueur, a + d) }));
}

/** Texte lisible (jamais à l'envers) pour une direction donnée. */
function angleLisible(a: number): number {
  const b = norm(a);
  return b > 90 && b <= 270 ? norm(b - 180) : b > 270 ? b - 360 : b;
}

/** Symboles tapés comme dans l'original : $ = Ø, ; = ±, ~ = °. */
export function symboles(t: string): string {
  return t.replace(/\$/g, 'Ø').replace(/;/g, '±').replace(/~/g, '°');
}

/**
 * Direction d'une cote linéaire entre p1 et p2 placée en `position` : horizontale si le point de position
 * est au-dessus ou au-dessous des deux points, verticale s'il est à gauche ou à droite (comme B9).
 */
export function directionCote(p1: Pt, p2: Pt, position: Pt): Pt {
  const dedansX = position.x >= Math.min(p1.x, p2.x) && position.x <= Math.max(p1.x, p2.x);
  const dedansY = position.y >= Math.min(p1.y, p2.y) && position.y <= Math.max(p1.y, p2.y);
  if (!dedansY) return { x: 1, y: 0 };
  if (!dedansX) return { x: 0, y: 1 };
  return Math.abs(p2.x - p1.x) >= Math.abs(p2.y - p1.y) ? { x: 1, y: 0 } : { x: 0, y: 1 };
}

export interface Cote {
  primitives: Primitive[];
  valeur: number;
  /** Point de référence : sur la ligne de cote, centré sous l'écriture. */
  reference: Pt;
}

/**
 * Cote de la distance entre p1 et p2 mesurée selon `dir` (vecteur unitaire), ligne de cote passant par
 * `position`. `cumul` remplace la longueur affichée (cotes étagées).
 */
export function coteSelon(p1: Pt, p2: Pt, dir: Pt, position: Pt, h = cotation.hauteur, cumul?: number): Cote {
  const n = { x: -dir.y, y: dir.x };
  const hauteur = dot(sub(position, p1), n);
  const a = add(p1, mul(n, hauteur));
  const b = add(a, mul(dir, dot(sub(p2, p1), dir)));
  const s = Math.sign(hauteur) || 1;
  const valeur = dist(a, b);
  const milieu = mul(add(a, b), 0.5);
  const angle = angleLisible((Math.atan2(dir.y, dir.x) * 180) / Math.PI);
  const haut = surCercle(milieu, 1, angle + 90);
  const prims: Primitive[] = [];
  // Lignes d'attache, sauf si le point est déjà sur la ligne de cote.
  if (dist(p1, a) > 1e-9) prims.push({ type: 'segment', a: p1, b: add(a, mul(n, s * DEPASSE)) });
  if (dist(p2, b) > 1e-9) prims.push({ type: 'segment', a: p2, b: add(b, mul(n, s * DEPASSE)) });
  // Cote trop courte pour loger les flèches (moins de 8 mm) : flèches à l'extérieur.
  const exterieur = valeur < 8;
  if (exterieur && valeur > 1e-9) {
    const u = mul(sub(b, a), 1 / valeur);
    prims.push({ type: 'segment', a: sub(a, mul(u, 2 * FLECHE)), b: add(b, mul(u, 2 * FLECHE)) });
    prims.push(...extremiteCote(a, sub(a, u)), ...extremiteCote(b, add(b, u)));
  } else {
    prims.push({ type: 'segment', a, b }, ...extremiteCote(a, b), ...extremiteCote(b, a));
  }
  prims.push({ type: 'texte', p: haut, h, angle: angleTexteCote(angle), ...ecritureCote(cumul ?? valeur, '', '', angle), alignH: 'centre', alignV: 'ligne' });
  return { primitives: prims, valeur, reference: milieu };
}

/** Cote de demi-diamètre (B13) : de l'axe au point, flèche côté point, texte « Ø » + deux fois la distance. */
export function coteDemiDiametre(axeA: Pt, axeB: Pt, point: Pt, position: Pt, h = cotation.hauteur): Cote | null {
  const l = dist(axeA, axeB);
  if (l < 1e-9) return null;
  const u = mul(sub(axeB, axeA), 1 / l); // direction de l'axe
  const n = { x: -u.y, y: u.x };
  const r = dot(sub(point, axeA), n); // distance signée du point à l'axe
  if (Math.abs(r) < 1e-9) return null;
  // La ligne de cote est perpendiculaire à l'axe, à l'abscisse de `position` le long de l'axe.
  const t = dot(sub(position, axeA), u);
  const surAxe = add(axeA, mul(u, t));
  const bout = add(surAxe, mul(n, r));
  const prims: Primitive[] = [];
  const tp = dot(sub(point, axeA), u);
  if (Math.abs(tp - t) > 1e-9) prims.push({ type: 'segment', a: point, b: add(bout, mul(u, Math.sign(t - tp) * DEPASSE)) });
  prims.push({ type: 'segment', a: surAxe, b: bout }, ...extremiteCote(bout, surAxe));
  const angle = angleLisible((Math.atan2(n.y, n.x) * 180) / Math.PI);
  const milieu = mul(add(surAxe, bout), 0.5);
  prims.push({ type: 'texte', p: surCercle(milieu, 1, angle + 90), h, angle: angleTexteCote(angle), ...ecritureCote(2 * Math.abs(r), 'Ø', '', angle), alignH: 'centre', alignV: 'ligne' });
  return { primitives: prims, valeur: 2 * Math.abs(r), reference: milieu };
}

/**
 * Cote d'angle (B16) entre deux segments : arc centré à leur intersection, du segment origine au segment
 * extrémité dans le sens trigonométrique, au rayon du point de position. Les segments sont prolongés en
 * traits fins jusqu'à l'arc.
 */
export function coteAngle(s1: { a: Pt; b: Pt }, d1: Pt, s2: { a: Pt; b: Pt }, d2: Pt, position: Pt, h = cotation.hauteur): Cote | null {
  const r1 = sub(s1.b, s1.a);
  const r2 = sub(s2.b, s2.a);
  const den = r1.x * r2.y - r1.y * r2.x;
  if (Math.abs(den) < 1e-12) return null; // parallèles
  const t = ((s2.a.x - s1.a.x) * r2.y - (s2.a.y - s1.a.y) * r2.x) / den;
  const I = add(s1.a, mul(r1, t));
  // Côté de chaque segment : celui où il a été désigné.
  const a1 = angleDe(I, dot(sub(d1, I), r1) >= 0 ? add(I, r1) : sub(I, r1));
  const a2 = angleDe(I, dot(sub(d2, I), r2) >= 0 ? add(I, r2) : sub(I, r2));
  const R = dist(I, position);
  if (R < 1e-9) return null;
  const ouverture = norm(a2 - a1);
  const prims: Primitive[] = [{ type: 'arc', c: I, r: R, debut: a1, fin: a2 }];
  const p1 = surCercle(I, R, a1);
  const p2 = surCercle(I, R, a2);
  // Flèches tangentes à l'arc, tournées vers l'intérieur.
  prims.push(...extremiteCote(p1, surCercle(I, R, a1 + Math.min(5, ouverture / 2))), ...extremiteCote(p2, surCercle(I, R, a2 - Math.min(5, ouverture / 2))));
  // Prolongement des segments jusqu'à l'arc s'il le faut.
  for (const [s, a, p] of [[s1, a1, p1], [s2, a2, p2]] as const) {
    const u = surCercle({ x: 0, y: 0 }, 1, a);
    const loin = Math.max(dot(sub(s.a, I), u), dot(sub(s.b, I), u));
    if (loin < R) prims.push({ type: 'segment', a: add(I, mul(u, Math.max(0, loin))), b: add(p, mul(u, DEPASSE)) });
  }
  const milieu = surCercle(I, R, a1 + ouverture / 2);
  const angleTexte = angleLisible(a1 + ouverture / 2 - 90);
  prims.push({ type: 'texte', p: surCercle(I, R + 1, a1 + ouverture / 2), h, angle: angleTexte, texte: `${nombre(ouverture)}°`, alignH: 'centre', alignV: 'ligne' });
  return { primitives: prims, valeur: ouverture, reference: milieu };
}

/** Flèche simple (B20) : de l'origine vers l'extrémité, pointe à l'extrémité. */
export function flecheSimple(extremite: Pt, origine: Pt): Primitive[] {
  if (dist(extremite, origine) < 1e-9) return [];
  return [{ type: 'segment', a: origine, b: extremite }, ...fleche(extremite, origine, 3)];
}

/**
 * Flèche de section-coupe (B19, NF E 04-520) : trait fort court sur la trace du plan, flèche qui indique le
 * sens d'observation, lettre repère au bout de la flèche.
 */
export function flecheCoupe(plan: { a: Pt; b: Pt }, pres: Pt, emplacement: Pt, lettre: string, h = cotation.hauteurRepere): Primitive[] {
  const l = dist(plan.a, plan.b);
  if (l < 1e-9) return [];
  const u = mul(sub(plan.b, plan.a), 1 / l);
  // Pied sur la trace du plan, près du point désigné.
  const pied = add(plan.a, mul(u, Math.max(0, Math.min(l, dot(sub(pres, plan.a), u)))));
  const n0 = { x: -u.y, y: u.x };
  const cote = Math.sign(dot(sub(emplacement, pied), n0)) || 1;
  const n = mul(n0, cote);
  const debut = add(pied, mul(n, 2));
  const fin = add(pied, mul(n, 12));
  return [
    { type: 'segment', a: sub(pied, mul(u, 3)), b: add(pied, mul(u, 3)) },
    { type: 'segment', a: fin, b: debut },
    ...fleche(debut, fin, 3.5),
    { type: 'texte', p: add(fin, mul(n, 2)), h, angle: 0, texte: lettre, alignH: 'centre', alignV: n.y < -0.5 ? 'haut' : n.y > 0.5 ? 'ligne' : 'milieu' },
  ];
}

/**
 * Repère de nomenclature (B18) : ligne de repère du tracé (2 mm au-delà) vers l'emplacement, trait
 * horizontal sous le numéro.
 */
export function repere(trace: Pt, emplacement: Pt, texte: string, h = cotation.hauteurRepere): Primitive[] {
  if (dist(trace, emplacement) < 1e-9) return [];
  const u = mul(sub(trace, emplacement), 1 / dist(trace, emplacement));
  const bout = add(trace, mul(u, 2));
  const largeur = Math.max(h, texte.length * h * 0.75);
  const versDroite = emplacement.x >= trace.x;
  const fin = { x: emplacement.x + (versDroite ? largeur : -largeur), y: emplacement.y };
  return [
    { type: 'segment', a: bout, b: emplacement },
    { type: 'segment', a: emplacement, b: fin },
    { type: 'texte', p: { x: (emplacement.x + fin.x) / 2, y: emplacement.y + 1 }, h, angle: 0, texte, alignH: 'centre', alignV: 'ligne' },
  ];
}

/** Lignes d'un texte sur plusieurs lignes (B6) : interligne de 1,6 fois la hauteur. */
export function lignesTexte(p: Pt, lignes: string[], h: number, angle: number, alignH: 'gauche' | 'centre' | 'droite'): Primitive[] {
  const pas = surCercle({ x: 0, y: 0 }, 1.6 * h, angle - 90);
  return lignes.map((t, i) => ({ type: 'texte' as const, p: add(p, mul(pas, i)), h, angle, texte: t, alignH, alignV: 'ligne' as const }));
}
