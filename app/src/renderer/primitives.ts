// Primitives géométriques du dessin (segments, droites, demi-droites, cercles, arcs) et calculs
// de repérage associés. Angles en degrés, sens trigonométrique. Sans DOM (testé).
import { dist, type PointCaracteristique, type Pt } from './geometrie';

export type Primitive =
  | {
      type: 'segment';
      a: Pt;
      b: Pt;
      /** Petit segment d'une ellipse ou d'une courbe : ses bouts ne sont pas repérables. */
      courbe?: true;
      /** Trait d'une extrémité de cote (flèche ou trait oblique) : sa pointe et la direction de la ligne de cote. */
      bout?: [Pt, Pt];
    }
  | { type: 'droite'; a: Pt; b: Pt } // passe par a et b, infinie
  | { type: 'demi-droite'; a: Pt; b: Pt } // part de a, passe par b
  | { type: 'cercle'; c: Pt; r: number }
  | { type: 'arc'; c: Pt; r: number; debut: number; fin: number } // de `debut` à `fin`, sens trigonométrique
  | {
      type: 'texte';
      p: Pt;
      h: number;
      angle: number;
      texte: string;
      alignH: AlignH;
      alignV: AlignV;
      /** Écriture d'une cote : la longueur affichée, pour la refaire dans un autre système de cotation. */
      mesure?: { v: number; t: string; a?: number };
    }
  | { type: 'point'; p: Pt };

export type AlignH = 'gauche' | 'centre' | 'droite';
export type AlignV = 'ligne' | 'bas' | 'milieu' | 'haut'; // « ligne » : ligne de base du texte

const EPS = 1e-9;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export const angleDe = (c: Pt, p: Pt): number => norm(deg(Math.atan2(p.y - c.y, p.x - c.x)));
export const norm = (a: number): number => ((a % 360) + 360) % 360;
export const surCercle = (c: Pt, r: number, a: number): Pt => ({ x: c.x + r * Math.cos(rad(a)), y: c.y + r * Math.sin(rad(a)) });

/** L'angle `a` est-il dans l'arc (de `debut` à `fin`, sens trigonométrique) ? */
export function dansArc(a: number, debut: number, fin: number): boolean {
  const ouverture = norm(fin - debut) || 360;
  return norm(a - debut) <= ouverture + 1e-7;
}

/** Arc passant par trois points, parcouru de p1 vers p3 en passant par p2. Null si les points sont alignés. */
export function arcTroisPoints(p1: Pt, p2: Pt, p3: Pt): { c: Pt; r: number; debut: number; fin: number } | null {
  const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
  if (Math.abs(d) < EPS) return null;
  const s1 = p1.x * p1.x + p1.y * p1.y;
  const s2 = p2.x * p2.x + p2.y * p2.y;
  const s3 = p3.x * p3.x + p3.y * p3.y;
  const c = {
    x: (s1 * (p2.y - p3.y) + s2 * (p3.y - p1.y) + s3 * (p1.y - p2.y)) / d,
    y: (s1 * (p3.x - p2.x) + s2 * (p1.x - p3.x) + s3 * (p2.x - p1.x)) / d,
  };
  const r = dist(c, p1);
  const a1 = angleDe(c, p1);
  const a2 = angleDe(c, p2);
  const a3 = angleDe(c, p3);
  // Sens trigonométrique si p2 est rencontré entre p1 et p3 en tournant dans ce sens ; sinon on inverse.
  return dansArc(a2, a1, a3) ? { c, r, debut: a1, fin: a3 } : { c, r, debut: a3, fin: a1 };
}

// ---------------------------------------------------------------- Distances

/** Paramètres admissibles le long d'une ligne (t de a vers b). */
function bornes(p: Primitive): [number, number] {
  if (p.type === 'segment') return [0, 1];
  if (p.type === 'demi-droite') return [0, Infinity];
  return [-Infinity, Infinity];
}

export function distance(q: Pt, p: Primitive): number {
  if (p.type === 'texte' || p.type === 'point') return dist(q, p.p);
  if (p.type === 'cercle') return Math.abs(dist(q, p.c) - p.r);
  if (p.type === 'arc') {
    if (dansArc(angleDe(p.c, q), p.debut, p.fin)) return Math.abs(dist(q, p.c) - p.r);
    return Math.min(dist(q, surCercle(p.c, p.r, p.debut)), dist(q, surCercle(p.c, p.r, p.fin)));
  }
  const dx = p.b.x - p.a.x;
  const dy = p.b.y - p.a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < EPS) return dist(q, p.a);
  const [t0, t1] = bornes(p);
  const t = Math.max(t0, Math.min(t1, ((q.x - p.a.x) * dx + (q.y - p.a.y) * dy) / l2));
  return dist(q, { x: p.a.x + t * dx, y: p.a.y + t * dy });
}

// ---------------------------------------------------------------- Intersections

function surLigne(p: Primitive, t: number): boolean {
  const [t0, t1] = bornes(p);
  return t >= t0 - 1e-9 && t <= t1 + 1e-9;
}

function ligneLigne(p: Extract<Primitive, { a: Pt; b: Pt }>, q: Extract<Primitive, { a: Pt; b: Pt }>): Pt[] {
  const d1x = p.b.x - p.a.x;
  const d1y = p.b.y - p.a.y;
  const d2x = q.b.x - q.a.x;
  const d2y = q.b.y - q.a.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < EPS) return [];
  const t = ((q.a.x - p.a.x) * d2y - (q.a.y - p.a.y) * d2x) / den;
  const u = ((q.a.x - p.a.x) * d1y - (q.a.y - p.a.y) * d1x) / den;
  if (!surLigne(p, t) || !surLigne(q, u)) return [];
  return [{ x: p.a.x + t * d1x, y: p.a.y + t * d1y }];
}

function ligneCercle(p: Extract<Primitive, { a: Pt; b: Pt }>, c: Pt, r: number): Pt[] {
  const dx = p.b.x - p.a.x;
  const dy = p.b.y - p.a.y;
  const fx = p.a.x - c.x;
  const fy = p.a.y - c.y;
  const A = dx * dx + dy * dy;
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - r * r;
  const disc = B * B - 4 * A * C;
  if (A < EPS || disc < -EPS) return [];
  const s = Math.sqrt(Math.max(0, disc));
  const ts = disc < EPS ? [-B / (2 * A)] : [(-B - s) / (2 * A), (-B + s) / (2 * A)];
  return ts.filter((t) => surLigne(p, t)).map((t) => ({ x: p.a.x + t * dx, y: p.a.y + t * dy }));
}

function cercleCercle(c1: Pt, r1: number, c2: Pt, r2: number): Pt[] {
  const d = dist(c1, c2);
  if (d < EPS || d > r1 + r2 + 1e-9 || d < Math.abs(r1 - r2) - 1e-9) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const m = { x: c1.x + (a * (c2.x - c1.x)) / d, y: c1.y + (a * (c2.y - c1.y)) / d };
  if (h < 1e-9) return [m];
  const ox = (h * (c2.y - c1.y)) / d;
  const oy = (h * (c2.x - c1.x)) / d;
  return [
    { x: m.x + ox, y: m.y - oy },
    { x: m.x - ox, y: m.y + oy },
  ];
}

const estCourbe = (p: Primitive): p is Extract<Primitive, { c: Pt }> => p.type === 'cercle' || p.type === 'arc';
const estLigne = (p: Primitive): p is Extract<Primitive, { a: Pt; b: Pt }> =>
  p.type === 'segment' || p.type === 'droite' || p.type === 'demi-droite';
// Les intersections avec un texte ou un point n'existent pas : filtrées plus haut.
const garderSurArc = (p: Primitive, pts: Pt[]) =>
  p.type === 'arc' ? pts.filter((x) => dansArc(angleDe(p.c, x), p.debut, p.fin)) : pts;

export function intersections(p: Primitive, q: Primitive): Pt[] {
  if (!(estLigne(p) || estCourbe(p)) || !(estLigne(q) || estCourbe(q))) return [];
  let pts: Pt[];
  if (estLigne(p) && estLigne(q)) pts = ligneLigne(p, q);
  else if (estLigne(p) && estCourbe(q)) pts = ligneCercle(p, q.c, q.r);
  else if (estCourbe(p) && estLigne(q)) pts = ligneCercle(q, p.c, p.r);
  else pts = cercleCercle((p as { c: Pt }).c, (p as { r: number }).r, (q as { c: Pt }).c, (q as { r: number }).r);
  return garderSurArc(q, garderSurArc(p, pts));
}

/** Pied de la perpendiculaire abaissée de `q` sur une ligne (null s'il tombe hors de la ligne). */
export function pied(q: Pt, p: Primitive): Pt | null {
  if (!estLigne(p)) return null;
  const dx = p.b.x - p.a.x;
  const dy = p.b.y - p.a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < EPS) return null;
  const t = ((q.x - p.a.x) * dx + (q.y - p.a.y) * dy) / l2;
  return surLigne(p, t) ? { x: p.a.x + t * dx, y: p.a.y + t * dy } : null;
}

// ---------------------------------------------------------------- Points repérables

/** Points propres à une primitive : extrémités, milieux, centres. */
export function pointsPropres(p: Primitive): PointCaracteristique[] {
  switch (p.type) {
    case 'segment':
      if (p.courbe) return [];
      return [
        { p: p.a, type: 'extremite' },
        { p: p.b, type: 'extremite' },
        { p: { x: (p.a.x + p.b.x) / 2, y: (p.a.y + p.b.y) / 2 }, type: 'milieu' },
      ];
    case 'demi-droite':
      return [{ p: p.a, type: 'extremite' }];
    case 'droite':
      return [];
    case 'texte':
    case 'point':
      return [{ p: p.p, type: 'extremite' }];
    case 'cercle':
      return [{ p: p.c, type: 'extremite' }];
    case 'arc': {
      const milieu = p.debut + (norm(p.fin - p.debut) || 360) / 2;
      return [
        { p: surCercle(p.c, p.r, p.debut), type: 'extremite' },
        { p: surCercle(p.c, p.r, p.fin), type: 'extremite' },
        { p: surCercle(p.c, p.r, milieu), type: 'milieu' },
        { p: p.c, type: 'extremite' },
      ];
    }
  }
}

/**
 * Points repérables près de `cible` : points propres des primitives proches, points caractéristiques
 * supplémentaires des entités (ex. milieu d'un rectangle), intersections et pieds de perpendiculaire
 * depuis le dernier point prélevé.
 */
export function candidats(
  prims: Primitive[],
  extras: PointCaracteristique[],
  cible: Pt,
  rayon: number,
  dernier: Pt | null,
): PointCaracteristique[] {
  const proches = prims.filter((p) => distance(cible, p) <= rayon || pointsPropres(p).some((x) => dist(x.p, cible) <= rayon));
  const out: PointCaracteristique[] = extras.filter((x) => dist(x.p, cible) <= rayon);
  for (const p of proches) {
    out.push(...pointsPropres(p));
    if (dernier) {
      const f = pied(dernier, p);
      if (f && dist(f, dernier) > EPS) out.push({ p: f, type: 'perpendiculaire' });
    }
  }
  for (let i = 0; i < proches.length; i++) {
    for (let j = i + 1; j < proches.length; j++) {
      for (const x of intersections(proches[i], proches[j])) out.push({ p: x, type: 'intersection' });
    }
  }
  return out;
}
