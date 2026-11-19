// Ellipses et courbes (ligne 2 de la palette), sans DOM (testé dans test/courbes.test.ts).
// Les tracés sont faits de petits segments marqués « courbe » : leurs extrémités ne sont pas des points
// repérables (seuls les points caractéristiques de l'entité le sont, comme dans l'original).
import { dist, type Pt } from './geometrie';
import type { Primitive } from './primitives';

const PAS_ELLIPSE = 72; // segments pour une ellipse complète
const PAS_TRONCON = 12; // segments par tronçon de courbe

const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const croix = (a: Pt, b: Pt) => a.x * b.y - a.y * b.x;

export const segCourbe = (a: Pt, b: Pt): Primitive => ({ type: 'segment', a, b, courbe: true });

/** Polyligne reliant des points (fermée ou non), en segments de courbe. */
export function relier(pts: Pt[], fermee = false, marque = true): Primitive[] {
  const out: Primitive[] = [];
  for (let i = 1; i < pts.length; i++) if (dist(pts[i - 1], pts[i]) > 1e-9) out.push(marque ? segCourbe(pts[i - 1], pts[i]) : { type: 'segment', a: pts[i - 1], b: pts[i] });
  if (fermee && pts.length > 2 && dist(pts[pts.length - 1], pts[0]) > 1e-9) out.push(marque ? segCourbe(pts[pts.length - 1], pts[0]) : { type: 'segment', a: pts[pts.length - 1], b: pts[0] });
  return out;
}

// ---------------------------------------------------------------- Ellipses

/** Arc d'ellipse de centre c et de demi-diamètres conjugués u, v : P(t) = c + u cos t + v sin t, t de t0 à t1 (radians). */
export function arcEllipse(c: Pt, u: Pt, v: Pt, t0 = 0, t1 = 2 * Math.PI): Pt[] {
  const n = Math.max(4, Math.ceil((PAS_ELLIPSE * Math.abs(t1 - t0)) / (2 * Math.PI)));
  return Array.from({ length: n + 1 }, (_, k) => {
    const t = t0 + ((t1 - t0) * k) / n;
    return add(c, add(mul(u, Math.cos(t)), mul(v, Math.sin(t))));
  });
}

export type ResultatEllipse = { c: Pt; u: Pt; v: Pt; t0: number; t1: number } | { erreur: string };

const ALIGNES = 'Les trois points sont alignés. Procédure abandonnée.';
const CONFONDUS = 'Points confondus. Procédure abandonnée.';

/** C1 — Centre, direction du grand axe, diamètre du cercle projeté et angle du plan de projection (degrés). */
export function ellipseProjection(c: Pt, direction: Pt, diametre: number, angle: number): ResultatEllipse {
  const l = dist(c, direction);
  if (l < 1e-9 || diametre <= 0) return { erreur: CONFONDUS };
  const d = mul(sub(direction, c), 1 / l);
  const a = diametre / 2;
  const b = a * Math.abs(Math.cos((angle * Math.PI) / 180));
  return { c, u: mul(d, a), v: mul({ x: -d.y, y: d.x }, b), t0: 0, t1: 2 * Math.PI };
}

/** C2 — Centre et extrémités des axes principaux (le troisième point est projeté sur la perpendiculaire au premier axe). */
export function ellipseAxes(c: Pt, p2: Pt, p3: Pt): ResultatEllipse {
  const u = sub(p2, c);
  const l = Math.hypot(u.x, u.y);
  if (l < 1e-9) return { erreur: CONFONDUS };
  const n = { x: -u.y / l, y: u.x / l };
  const h = (p3.x - c.x) * n.x + (p3.y - c.y) * n.y;
  if (Math.abs(h) < 1e-9) return { erreur: ALIGNES };
  return { c, u, v: mul(n, h), t0: 0, t1: 2 * Math.PI };
}

/** C3 — Deux diamètres conjugués : un diamètre (p1, p2) et une extrémité du diamètre conjugué (p3). */
export function ellipseConjugues(p1: Pt, p2: Pt, p3: Pt): ResultatEllipse {
  if (dist(p1, p2) < 1e-9) return { erreur: CONFONDUS };
  const c = mul(add(p1, p2), 0.5);
  const u = sub(p1, c);
  const v = sub(p3, c);
  if (Math.abs(croix(u, v)) < 1e-9) return { erreur: ALIGNES };
  return { c, u, v, t0: 0, t1: 2 * Math.PI };
}

/** C4 — Quart d'ellipse : origine, intersection des tangentes aux extrémités, extrémité. */
export function quartEllipse(p1: Pt, p2: Pt, p3: Pt): ResultatEllipse {
  if (dist(p1, p2) < 1e-9 || dist(p2, p3) < 1e-9 || dist(p1, p3) < 1e-9) return { erreur: CONFONDUS };
  if (Math.abs(croix(sub(p2, p1), sub(p3, p1))) < 1e-9) return { erreur: ALIGNES };
  const c = sub(add(p1, p3), p2); // quatrième sommet du parallélogramme
  return { c, u: sub(p1, c), v: sub(p3, c), t0: 0, t1: Math.PI / 2 };
}

/** C5 — Demi-ellipse : un diamètre (p1, p2) et une extrémité du diamètre conjugué (p3). */
export function demiEllipse(p1: Pt, p2: Pt, p3: Pt): ResultatEllipse {
  if (dist(p1, p2) < 1e-9 || dist(p1, p3) < 1e-9 || dist(p2, p3) < 1e-9) return { erreur: CONFONDUS };
  const c = mul(add(p1, p2), 0.5);
  const u = sub(p1, c);
  const v = sub(p3, c);
  if (Math.abs(croix(u, v)) < 1e-9) return { erreur: ALIGNES };
  return { c, u, v, t0: 0, t1: Math.PI };
}

// ---------------------------------------------------------------- Courbes

/**
 * Lissage : la courbe part du premier point, finit au dernier, et y est tangente aux segments extrêmes
 * de la ligne polygonale ; entre les deux, elle s'approche des points sans y passer (B-spline quadratique,
 * des arcs de parabole proches des arcs d'ellipses de l'original). Fermée : courbe périodique.
 */
export function lissage(pts: Pt[], fermee: boolean): Pt[] {
  const n = pts.length;
  if (n < 3) return [...pts];
  const out: Pt[] = [];
  const troncon = (a: Pt, b: Pt, c: Pt, premier: boolean) => {
    // Arc de parabole de a à c, contrôlé par b.
    for (let k = premier ? 0 : 1; k <= PAS_TRONCON; k++) {
      const t = k / PAS_TRONCON;
      out.push(add(add(mul(a, (1 - t) * (1 - t)), mul(b, 2 * t * (1 - t))), mul(c, t * t)));
    }
  };
  const milieu = (a: Pt, b: Pt) => mul(add(a, b), 0.5);
  if (fermee) {
    for (let i = 0; i < n; i++) troncon(milieu(pts[(i - 1 + n) % n], pts[i]), pts[i], milieu(pts[i], pts[(i + 1) % n]), i === 0);
    return out;
  }
  // Ouverte : premier tronçon du premier point au milieu suivant, dernier tronçon jusqu'au dernier point.
  troncon(pts[0], pts[1], n === 3 ? pts[2] : milieu(pts[1], pts[2]), true);
  for (let i = 2; i < n - 2; i++) troncon(milieu(pts[i - 1], pts[i]), pts[i], milieu(pts[i], pts[i + 1]), false);
  if (n > 3) troncon(milieu(pts[n - 3], pts[n - 2]), pts[n - 2], pts[n - 1], false);
  return out;
}

/**
 * Interpolation : la courbe passe par tous les points (spline cubique d'Hermite, tangentes de
 * Catmull-Rom). Courbe ouverte : les tangentes aux extrémités peuvent être imposées par un point
 * (direction et « poids » donnés par leur longueur) ; sinon la courbe part dans la direction du point suivant.
 */
export function interpolation(pts: Pt[], fermee: boolean, tangenteDebut?: Pt | null, tangenteFin?: Pt | null): Pt[] {
  const n = pts.length;
  if (n < 2) return [...pts];
  const P = (i: number) => (fermee ? pts[(i + n) % n] : pts[Math.min(n - 1, Math.max(0, i))]);
  const T = (i: number): Pt => {
    if (!fermee && i === 0) return tangenteDebut && dist(tangenteDebut, pts[0]) > 1e-9 ? mul(sub(tangenteDebut, pts[0]), 3) : sub(pts[1], pts[0]);
    if (!fermee && i === n - 1) return tangenteFin && dist(tangenteFin, pts[n - 1]) > 1e-9 ? mul(sub(pts[n - 1], tangenteFin), 3) : sub(pts[n - 1], pts[n - 2]);
    return mul(sub(P(i + 1), P(i - 1)), 0.5);
  };
  const out: Pt[] = [pts[0]];
  const fin = fermee ? n : n - 1;
  for (let i = 0; i < fin; i++) {
    const p0 = P(i);
    const p1 = P(i + 1);
    const t0 = T(i);
    const t1 = T((i + 1) % n === 0 && fermee ? 0 : i + 1);
    for (let k = 1; k <= PAS_TRONCON; k++) {
      const s = k / PAS_TRONCON;
      const h00 = 2 * s ** 3 - 3 * s ** 2 + 1;
      const h10 = s ** 3 - 2 * s ** 2 + s;
      const h01 = -2 * s ** 3 + 3 * s ** 2;
      const h11 = s ** 3 - s ** 2;
      out.push(add(add(mul(p0, h00), mul(t0, h10)), add(mul(p1, h01), mul(t1, h11))));
    }
  }
  return out;
}

/** Traits d'axes perpendiculaires (C15) : deux traits de même longueur qui se croisent au centre. */
export function traitsAxes(c: Pt, extremite: Pt): Primitive[] {
  const u = sub(extremite, c);
  if (Math.hypot(u.x, u.y) < 1e-9) return [];
  const v = { x: -u.y, y: u.x };
  return [
    { type: 'segment', a: sub(c, u), b: add(c, u) },
    { type: 'segment', a: sub(c, v), b: add(c, v) },
  ];
}
