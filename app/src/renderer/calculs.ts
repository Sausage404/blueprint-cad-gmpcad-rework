// Calculs sur des contours (palette CALCULS), sans DOM (testé dans test/calculs.test.ts).
// Les contours désignés forment une surface selon la règle pair-impair : un contour contenu dans un autre
// est un évidement. Les intégrales sont celles des polygones (les arcs sont découpés en petits segments,
// comme dans l'original : « l'imprécision est liée à l'approximation des arcs par des polygones »).
import { dansPolygone } from './contours';
import { dist, type Pt } from './geometrie';

export interface Proprietes {
  perimetre: number;
  aire: number;
  /** Centre de gravité. */
  g: Pt;
  /** Moments quadratiques au centre de gravité : ∫y² dA, ∫x² dA, ∫xy dA (axes x, y du dessin). */
  ixx: number;
  iyy: number;
  ixy: number;
}

const cross = (a: Pt, b: Pt) => a.x * b.y - b.x * a.y;

/** Polygone dans le sens trigonométrique. */
function direct(p: Pt[]): Pt[] {
  let s = 0;
  for (let i = 0; i < p.length; i++) s += cross(p[i], p[(i + 1) % p.length]);
  return s >= 0 ? p : [...p].reverse();
}

/** Signe de chaque contour : +1 au premier niveau, -1 pour un évidement (contenu dans un nombre impair d'autres). */
function signes(contours: Pt[][]): number[] {
  return contours.map((c, i) => {
    const n = contours.filter((d, j) => j !== i && dansPolygone(c[0], d)).length;
    return n % 2 === 0 ? 1 : -1;
  });
}

/** Contours désignés deux fois : ils s'annulent (aide d'origine). */
export function basculerContour(liste: Pt[][], c: Pt[]): Pt[][] {
  const meme = (a: Pt[], b: Pt[]) => a.length === b.length && Math.abs(aire(a) - aire(b)) < 1e-9 && dansPolygone(a[0], b) === dansPolygone(b[0], a) && dist(centre(a), centre(b)) < 1e-6;
  const i = liste.findIndex((d) => meme(d, c));
  return i >= 0 ? liste.filter((_, j) => j !== i) : [...liste, c];
}

function aire(p: Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) s += cross(p[i], p[(i + 1) % p.length]);
  return Math.abs(s / 2);
}
function centre(p: Pt[]): Pt {
  return { x: p.reduce((s, q) => s + q.x, 0) / p.length, y: p.reduce((s, q) => s + q.y, 0) / p.length };
}

/** Périmètre, aire, centre de gravité et moments quadratiques de la surface délimitée par les contours. */
export function proprietes(contours: Pt[][]): Proprietes | null {
  if (contours.length === 0) return null;
  // Calculs autour d'une origine proche (meilleure précision loin de l'origine du dessin).
  const o = centre(contours[0]);
  const s = signes(contours);
  let perimetre = 0;
  let a = 0;
  let sx = 0;
  let sy = 0;
  let ixx = 0;
  let iyy = 0;
  let ixy = 0;
  contours.forEach((brut, k) => {
    const p = direct(brut).map((q) => ({ x: q.x - o.x, y: q.y - o.y }));
    for (let i = 0; i < p.length; i++) {
      const u = p[i];
      const v = p[(i + 1) % p.length];
      perimetre += dist(u, v);
      const c = cross(u, v) * s[k];
      a += c / 2;
      sx += ((u.x + v.x) * c) / 6;
      sy += ((u.y + v.y) * c) / 6;
      ixx += ((u.y * u.y + u.y * v.y + v.y * v.y) * c) / 12;
      iyy += ((u.x * u.x + u.x * v.x + v.x * v.x) * c) / 12;
      ixy += ((u.x * v.y + 2 * u.x * u.y + 2 * v.x * v.y + v.x * u.y) * c) / 24;
    }
  });
  if (Math.abs(a) < 1e-12) return null;
  const gx = sx / a;
  const gy = sy / a;
  // Théorème de Huygens : moments au centre de gravité.
  return {
    perimetre,
    aire: a,
    g: { x: gx + o.x, y: gy + o.y },
    ixx: ixx - a * gy * gy,
    iyy: iyy - a * gx * gx,
    ixy: ixy - a * gx * gy,
  };
}

/** Moment quadratique par rapport à l'axe (a, b) : ∫ d² dA. */
export function momentAxe(pr: Proprietes, a: Pt, b: Pt): number {
  const l = dist(a, b) || 1;
  const ux = (b.x - a.x) / l;
  const uy = (b.y - a.y) / l;
  const iG = uy * uy * pr.iyy + ux * ux * pr.ixx - 2 * ux * uy * pr.ixy;
  const d = (pr.g.x - a.x) * uy - (pr.g.y - a.y) * ux;
  return iG + pr.aire * d * d;
}

/** Moment quadratique polaire par rapport au pôle o : ∫ r² dA. */
export function momentPolaire(pr: Proprietes, o: Pt): number {
  const d = dist(pr.g, o);
  return pr.ixx + pr.iyy + pr.aire * d * d;
}

/** Moments quadratiques principaux (I1 ≥ I2) et inclinaison (degrés) de l'axe principal 1. */
export function momentsPrincipaux(pr: Proprietes): { i1: number; i2: number; angle: number } {
  const m = (pr.ixx + pr.iyy) / 2;
  const r = Math.hypot((pr.ixx - pr.iyy) / 2, pr.ixy);
  // Moment autour de l'axe d'inclinaison t : Ixx cos² t + Iyy sin² t - 2 Ixy sin t cos t ; extrême pour :
  const t = 0.5 * Math.atan2(-2 * pr.ixy, pr.ixx - pr.iyy);
  const it = pr.ixx * Math.cos(t) ** 2 + pr.iyy * Math.sin(t) ** 2 - 2 * pr.ixy * Math.sin(t) * Math.cos(t);
  const angle = (t * 180) / Math.PI;
  return it >= m ? { i1: m + r, i2: m - r, angle } : { i1: m + r, i2: m - r, angle: angle + 90 };
}

/**
 * Ellipse centrale d'inertie : centrée au centre de gravité, ses demi-axes sont les rayons de giration
 * (le long de l'axe principal 1 : rayon de giration autour de l'axe 2, et inversement).
 */
export function ellipseCentrale(pr: Proprietes): { c: Pt; u: Pt; v: Pt } {
  const { i1, i2, angle } = momentsPrincipaux(pr);
  const t = (angle * Math.PI) / 180;
  const r1 = Math.sqrt(Math.max(0, i2) / Math.abs(pr.aire));
  const r2 = Math.sqrt(Math.max(0, i1) / Math.abs(pr.aire));
  return { c: pr.g, u: { x: Math.cos(t) * r1, y: Math.sin(t) * r1 }, v: { x: -Math.sin(t) * r2, y: Math.cos(t) * r2 } };
}

/** Distance maxi du centre de gravité au contour. */
export function distanceMaxi(contours: Pt[][], g: Pt): number {
  return Math.max(...contours.flat().map((p) => dist(p, g)));
}

/** Moitié d'un polygone d'un côté d'un axe (repère où l'axe est l'axe des x : y ≥ 0 si `cote` = 1). */
function couperDemi(p: Pt[], cote: 1 | -1): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < p.length; i++) {
    const u = p[i];
    const v = p[(i + 1) % p.length];
    const du = u.y * cote;
    const dv = v.y * cote;
    if (du >= 0) out.push(u);
    if (du * dv < 0) {
      const t = u.y / (u.y - v.y);
      out.push({ x: u.x + (v.x - u.x) * t, y: 0 });
    }
  }
  return out;
}

/**
 * Révolution autour de l'axe (a, b) : ∫ |d| dA (volume = 2π fois) et ∫ |d|³ dA (moment d'inertie = 2πρ fois).
 * Un profil dessiné des deux côtés de l'axe (coupe entière) compte une seule fois : on garde le côté le plus
 * grand. `deuxCotes` le signale.
 */
export function revolution(contours: Pt[][], a: Pt, b: Pt): { m1: number; m3: number; deuxCotes: boolean } {
  const l = dist(a, b) || 1;
  const ux = (b.x - a.x) / l;
  const uy = (b.y - a.y) / l;
  // Repère de l'axe : x le long de l'axe, y la distance (signée) à l'axe.
  const repere = (p: Pt): Pt => ({ x: (p.x - a.x) * ux + (p.y - a.y) * uy, y: -(p.x - a.x) * uy + (p.y - a.y) * ux });
  const s = signes(contours);
  const cotes = ([1, -1] as const).map((cote) => {
    let m1 = 0;
    let m3 = 0;
    contours.forEach((brut, k) => {
      const p = couperDemi(direct(brut.map(repere)), cote);
      for (let i = 0; i < p.length; i++) {
        const u = p[i];
        const v = p[(i + 1) % p.length];
        const c = cross(u, v) * s[k];
        m1 += ((u.y + v.y) * c) / 6;
        m3 += ((u.y ** 3 + u.y * u.y * v.y + u.y * v.y * v.y + v.y ** 3) * c) / 20;
      }
    });
    return { m1: Math.abs(m1), m3: Math.abs(m3) };
  });
  const [haut, bas] = cotes;
  const deuxCotes = haut.m1 > 1e-9 && bas.m1 > 1e-9;
  const garde = haut.m1 >= bas.m1 ? haut : bas;
  return { ...garde, deuxCotes };
}
