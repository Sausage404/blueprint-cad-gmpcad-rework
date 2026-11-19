// Géométrie de construction (ligne 3) et d'habillage (ligne 1) : chanfrein, raccordement, tangentes,
// perpendiculaires, parallèles, cotes. Sans DOM (testé dans test/construction.test.ts).
import { angleTexteCote, ecritureCote, extremiteCote } from './cotation';
import { dist, nombre, type Pt } from './geometrie';
import { angleDe, norm, surCercle, type Primitive } from './primitives';

type Seg = { a: Pt; b: Pt };
const sous = (p: Pt, q: Pt) => ({ x: p.x - q.x, y: p.y - q.y });
const plus = (p: Pt, v: Pt, k = 1) => ({ x: p.x + v.x * k, y: p.y + v.y * k });
const unitaire = (v: Pt) => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};
const scal = (u: Pt, v: Pt) => u.x * v.x + u.y * v.y;

/** Intersection des droites portant deux segments (null si parallèles). */
export function intersectionDroites(s1: Seg, s2: Seg): Pt | null {
  const d1 = sous(s1.b, s1.a);
  const d2 = sous(s2.b, s2.a);
  const den = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((s2.a.x - s1.a.x) * d2.y - (s2.a.y - s1.a.y) * d2.x) / den;
  return plus(s1.a, d1, t);
}

/** Direction, depuis le sommet I, du côté du segment où se trouve le point désigné. */
function cote(s: Seg, I: Pt, designe: Pt): Pt {
  const u = unitaire(sous(s.b, s.a));
  return scal(sous(designe, I), u) >= 0 ? u : { x: -u.x, y: -u.y };
}

/** Extrémité du segment la plus éloignée du sommet, du côté `u`. */
function bout(s: Seg, I: Pt, u: Pt): Pt {
  return scal(sous(s.a, I), u) >= scal(sous(s.b, I), u) ? s.a : s.b;
}

export interface Coin {
  s1: Seg; // segments raccourcis ou prolongés
  s2: Seg;
  ajout: Primitive | null; // chanfrein ou arc de raccordement
}

/**
 * Chanfrein entre deux segments. Longueur 0 : les segments sont prolongés ou coupés jusqu'à leur intersection.
 * `angle` : angle du chanfrein avec le premier segment (45° : chanfrein symétrique sur un angle droit).
 */
export function chanfrein(s1: Seg, p1: Pt, s2: Seg, p2: Pt, longueur: number, angle: number): Coin | null {
  const I = intersectionDroites(s1, s2);
  if (!I) return null;
  const u1 = cote(s1, I, p1);
  const u2 = cote(s2, I, p2);
  const b1 = bout(s1, I, u1);
  const b2 = bout(s2, I, u2);
  if (longueur <= 1e-9) return { s1: { a: b1, b: I }, s2: { a: b2, b: I }, ajout: null };
  const theta = Math.acos(Math.max(-1, Math.min(1, scal(u1, u2))));
  const alpha = (angle * Math.PI) / 180;
  const d2 = (longueur * Math.sin(alpha)) / Math.sin(Math.PI - alpha - theta);
  if (!(d2 > 0) || longueur > dist(I, b1) + 1e-9 || d2 > dist(I, b2) + 1e-9) return null;
  const c1 = plus(I, u1, longueur);
  const c2 = plus(I, u2, d2);
  return { s1: { a: b1, b: c1 }, s2: { a: b2, b: c2 }, ajout: { type: 'segment', a: c1, b: c2 } };
}

/** Raccordement de deux segments par un arc de rayon r (r = 0 : simple coin). */
export function raccordement(s1: Seg, p1: Pt, s2: Seg, p2: Pt, r: number): Coin | null {
  const I = intersectionDroites(s1, s2);
  if (!I) return null;
  const u1 = cote(s1, I, p1);
  const u2 = cote(s2, I, p2);
  const b1 = bout(s1, I, u1);
  const b2 = bout(s2, I, u2);
  if (r <= 1e-9) return { s1: { a: b1, b: I }, s2: { a: b2, b: I }, ajout: null };
  const phi = Math.acos(Math.max(-1, Math.min(1, scal(u1, u2)))) / 2;
  if (phi < 1e-6 || phi > Math.PI / 2 - 1e-6) return null;
  const t = r / Math.tan(phi);
  if (t > dist(I, b1) + 1e-9 || t > dist(I, b2) + 1e-9) return null;
  const T1 = plus(I, u1, t);
  const T2 = plus(I, u2, t);
  const c = plus(I, unitaire({ x: u1.x + u2.x, y: u1.y + u2.y }), r / Math.sin(phi));
  const a1 = angleDe(c, T1);
  const a2 = angleDe(c, T2);
  const arc: Primitive = norm(a2 - a1) <= 180 ? { type: 'arc', c, r, debut: a1, fin: a2 } : { type: 'arc', c, r, debut: a2, fin: a1 };
  return { s1: { a: b1, b: T1 }, s2: { a: b2, b: T2 }, ajout: arc };
}

/** Cercle ou point (rayon 0). */
export type Rond = { c: Pt; r: number };

/**
 * Tangente à deux cercles ou points : parmi les tangentes possibles (extérieures et intérieures), celle dont
 * les points de contact sont les plus proches des points désignés.
 */
export function tangente(k1: Rond, p1: Pt, k2: Rond, p2: Pt): Seg | null {
  const d = dist(k1.c, k2.c);
  if (d < 1e-9) return null;
  const v = unitaire(sous(k2.c, k1.c));
  const candidats: Seg[] = [];
  for (const sgn of [1, -1]) {
    // sgn = 1 : tangentes extérieures ; -1 : intérieures.
    const c = (k1.r - sgn * k2.r) / d;
    if (c * c > 1) continue;
    const h = Math.sqrt(Math.max(0, 1 - c * c));
    for (const s of [1, -1]) {
      const n = { x: v.x * c - s * h * v.y, y: v.y * c + s * h * v.x };
      candidats.push({ a: plus(k1.c, n, k1.r), b: plus(k2.c, n, sgn * k2.r) });
    }
  }
  if (candidats.length === 0) return null;
  candidats.sort((x, y) => dist(x.a, p1) + dist(x.b, p2) - (dist(y.a, p1) + dist(y.b, p2)));
  return dist(candidats[0].a, candidats[0].b) > 1e-9 ? candidats[0] : null;
}

/** Pied de la perpendiculaire à la droite (s) passant par q. */
export function pied(s: Seg, q: Pt): Pt {
  const u = unitaire(sous(s.b, s.a));
  return plus(s.a, u, scal(sous(q, s.a), u));
}

/** Perpendiculaire à un segment passant par un point, ou tangente à un cercle (côté du point désigné). */
export function perpendiculaire(s: Seg, k: Rond, designe: Pt): Seg | null {
  const u = unitaire(sous(s.b, s.a));
  let depart = k.c;
  if (k.r > 0) {
    // Les deux tangentes perpendiculaires touchent le cercle aux points c ± r·u.
    const t1 = plus(k.c, u, k.r);
    const t2 = plus(k.c, u, -k.r);
    depart = dist(t1, designe) <= dist(t2, designe) ? t1 : t2;
  }
  const f = pied(s, depart);
  return dist(f, depart) > 1e-9 ? { a: depart, b: f } : null;
}

/** Parallèle au segment, à une distance donnée, du côté du point désigné. */
export function parallele(s: Seg, cotePoint: Pt, distance: number): Seg {
  const u = unitaire(sous(s.b, s.a));
  let n = { x: -u.y, y: u.x };
  if (scal(sous(cotePoint, s.a), n) < 0) n = { x: -n.x, y: -n.y };
  return { a: plus(s.a, n, distance), b: plus(s.b, n, distance) };
}

/** Distance (sans signe) d'un point à la droite portant le segment. */
export function distanceDroite(s: Seg, q: Pt): number {
  return dist(q, pied(s, q));
}

/** Parallèle au segment, passant par un point ou tangente à un cercle (côté du point désigné). */
export function paralleleTangente(s: Seg, k: Rond, designe: Pt): Seg {
  const u = unitaire(sous(s.b, s.a));
  let n = { x: -u.y, y: u.x };
  if (scal(sous(designe, k.c), n) < 0) n = { x: -n.x, y: -n.y };
  const contact = plus(k.c, n, k.r);
  const d = scal(sous(contact, s.a), { x: -u.y, y: u.x });
  const m = { x: -u.y, y: u.x };
  return { a: plus(s.a, m, d), b: plus(s.b, m, d) };
}

/** Points équidistants : n points entre les extrémités d'un segment ou d'un arc ; sur un cercle, à partir d'un rayon origine. */
export function pointsEquidistants(p: Primitive, n: number, origine?: Pt): Pt[] {
  if (n < 1) return [];
  if (p.type === 'segment') return Array.from({ length: n }, (_, i) => plus(p.a, sous(p.b, p.a), (i + 1) / (n + 1)));
  if (p.type === 'arc') {
    const o = norm(p.fin - p.debut) || 360;
    return Array.from({ length: n }, (_, i) => surCercle(p.c, p.r, p.debut + (o * (i + 1)) / (n + 1)));
  }
  if (p.type === 'cercle') {
    const a0 = origine ? angleDe(p.c, origine) : 0;
    return Array.from({ length: n }, (_, i) => surCercle(p.c, p.r, a0 + (360 * i) / n));
  }
  return [];
}

// ======================================================================= Cotes (système de la case F4)

export { texteCote } from './cotation';

/**
 * Cote linéaire horizontale ou verticale entre deux points ; le troisième point place la ligne de cote.
 * Si ce point est plus haut ou plus bas que les deux points, la cote est horizontale ; sinon verticale.
 */
export function coteLineaire(p1: Pt, p2: Pt, position: Pt, hauteurTexte: number): Primitive[] {
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const horizontale = position.y > maxY || position.y < minY ? true : !(position.x > maxX || position.x < minX) || Math.abs(p2.x - p1.x) >= Math.abs(p2.y - p1.y);
  const depasse = 2; // les lignes d'attache dépassent la ligne de cote de 2 mm
  if (horizontale) {
    const y = position.y;
    const s = Math.sign(y - (p1.y + p2.y) / 2) || 1;
    const a = { x: p1.x, y };
    const b = { x: p2.x, y };
    const valeur = Math.abs(p2.x - p1.x);
    return [
      { type: 'segment', a: p1, b: { x: p1.x, y: y + s * depasse } },
      { type: 'segment', a: p2, b: { x: p2.x, y: y + s * depasse } },
      { type: 'segment', a, b },
      ...extremiteCote(a, b),
      ...extremiteCote(b, a),
      { type: 'texte', p: { x: (a.x + b.x) / 2, y: y + 1 }, h: hauteurTexte, angle: 0, ...ecritureCote(valeur, '', '', 0), alignH: 'centre', alignV: 'ligne' },
    ];
  }
  const x = position.x;
  const s = Math.sign(x - (p1.x + p2.x) / 2) || 1;
  const a = { x, y: p1.y };
  const b = { x, y: p2.y };
  const valeur = Math.abs(p2.y - p1.y);
  return [
    { type: 'segment', a: p1, b: { x: x + s * depasse, y: p1.y } },
    { type: 'segment', a: p2, b: { x: x + s * depasse, y: p2.y } },
    { type: 'segment', a, b },
    ...extremiteCote(a, b),
    ...extremiteCote(b, a),
    { type: 'texte', p: { x: x - 1, y: (a.y + b.y) / 2 }, h: hauteurTexte, angle: angleTexteCote(90), ...ecritureCote(valeur, '', '', 90), alignH: 'centre', alignV: 'ligne' },
  ];
}

/** Cote de diamètre : ligne passant par le centre et le point désigné, deux flèches, texte « Ø… ». */
export function coteDiametre(k: Rond, designe: Pt, position: Pt, hauteurTexte: number): Primitive[] {
  const a = angleDe(k.c, designe);
  const p1 = surCercle(k.c, k.r, a);
  const p2 = surCercle(k.c, k.r, a + 180);
  const angleTexte = ((a % 180) + 180) % 180;
  const lisible = angleTexte > 90 ? angleTexte - 180 : angleTexte;
  return [
    { type: 'segment', a: p1, b: p2 },
    ...extremiteCote(p1, p2),
    ...extremiteCote(p2, p1),
    { type: 'texte', p: position, h: hauteurTexte, angle: angleTexteCote(lisible), ...ecritureCote(2 * k.r, 'Ø', '', lisible), alignH: 'centre', alignV: 'ligne' },
  ];
}

/** Cote de rayon : du centre au point désigné, une flèche, texte « R… ». */
export function coteRayon(k: Rond, designe: Pt, position: Pt, hauteurTexte: number): Primitive[] {
  const p = surCercle(k.c, k.r, angleDe(k.c, designe));
  return [
    { type: 'segment', a: k.c, b: p },
    ...extremiteCote(p, k.c),
    { type: 'texte', p: position, h: hauteurTexte, angle: 0, ...ecritureCote(k.r, 'R'), alignH: 'centre', alignV: 'ligne' },
  ];
}
