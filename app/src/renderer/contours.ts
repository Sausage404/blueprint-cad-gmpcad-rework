// Contours fermés d'un dessin, pour la vue 3D (nouveauté). Sans DOM (testé dans test/contours.test.ts).
//
// 1. On prend les traits continus forts (les arêtes vues) : segments, arcs, cercles, découpés en petits
//    segments, puis coupés à chacune de leurs intersections.
// 2. On relie les extrémités communes (graphe plan) et on enlève les traits qui ne ferment rien
//    (lignes de rappel, bouts d'axes…).
// 3. Chaque morceau d'un seul tenant donne son contour extérieur. Un contour à l'intérieur d'un autre est
//    un trou (puis une île dans ce trou, etc.).
import type { Entite, Trait } from './dessin';
import { dist, type Pt } from './geometrie';
import { distance, norm, surCercle, type Primitive } from './primitives';

const PAS_ARC = 5; // degrés au plus par petit segment d'arc
const TOL = 1e-3; // mm : deux extrémités plus proches sont le même point

export interface Contour {
  /** Sommets dans le sens trigonométrique (sans répéter le premier). */
  points: Pt[];
  aire: number;
  /** Trous directs (contours juste à l'intérieur). */
  trous: Contour[];
  /** Profondeur d'imbrication : paire = matière, impaire = trou. */
  profondeur: number;
}

export function aireSignee(p: Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function dansPolygone(q: Pt, p: Pt[]): boolean {
  let dedans = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i];
    const b = p[j];
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) dedans = !dedans;
  }
  return dedans;
}

/** Une primitive en petits segments (les arcs et cercles sont approchés à PAS_ARC degrés près). */
export function enSegments(p: Primitive): [Pt, Pt][] {
  if (p.type === 'segment') return dist(p.a, p.b) > TOL ? [[p.a, p.b]] : [];
  if (p.type !== 'arc' && p.type !== 'cercle') return [];
  const debut = p.type === 'arc' ? p.debut : 0;
  const ouverture = p.type === 'arc' ? norm(p.fin - p.debut) || 360 : 360;
  const n = Math.max(p.type === 'cercle' ? 24 : 2, Math.ceil(ouverture / PAS_ARC));
  const pts = Array.from({ length: n + 1 }, (_, k) => surCercle(p.c, p.r, debut + (ouverture * k) / n));
  if (p.type === 'cercle') pts[n] = pts[0];
  return pts.slice(1).map((b, k) => [pts[k], b]);
}

/** Primitives d'arêtes vues : traits continus forts, sauf textes et points. */
export function aretes(entites: readonly Entite[], trait: Trait = 'continu-fort'): { prim: Primitive; entite: Entite }[] {
  const out: { prim: Primitive; entite: Entite }[] = [];
  for (const e of entites) {
    e.primitives.forEach((prim, i) => {
      if ((e.styles?.[i]?.trait ?? e.trait) === trait && (prim.type === 'segment' || prim.type === 'arc' || prim.type === 'cercle')) out.push({ prim, entite: e });
    });
  }
  return out;
}

// ---------------------------------------------------------------- Découpage aux intersections

/** Coupe chaque segment à ses croisements avec les autres (grille de recherche pour aller vite). */
function couper(segs: [Pt, Pt][]): [Pt, Pt][] {
  const n = segs.length;
  if (n === 0) return [];
  const coupes: number[][] = segs.map(() => []);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [a, b] of segs) {
    x0 = Math.min(x0, a.x, b.x);
    y0 = Math.min(y0, a.y, b.y);
    x1 = Math.max(x1, a.x, b.x);
    y1 = Math.max(y1, a.y, b.y);
  }
  const cotes = Math.max(1, Math.ceil(Math.sqrt(n)));
  const taille = Math.max((x1 - x0) / cotes, (y1 - y0) / cotes, 1e-6);
  const cellule = (v: number, o: number) => Math.floor((v - o) / taille);
  const boites = segs.map(([a, b]) => [cellule(Math.min(a.x, b.x) - TOL, x0), cellule(Math.min(a.y, b.y) - TOL, y0), cellule(Math.max(a.x, b.x) + TOL, x0), cellule(Math.max(a.y, b.y) + TOL, y0)]);
  const grille = new Map<number, number[]>();
  const cle = (i: number, j: number) => i * 1_000_003 + j;
  boites.forEach(([i0, j0, i1, j1], s) => {
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const k = cle(i, j);
        const l = grille.get(k);
        if (l) l.push(s);
        else grille.set(k, [s]);
      }
  });
  for (const [k, liste] of grille) {
    for (let u = 0; u < liste.length; u++) {
      for (let v = u + 1; v < liste.length; v++) {
        const s = liste[u];
        const t = liste[v];
        // Chaque paire n'est testée que dans la première cellule qu'elles partagent.
        const bi = Math.max(boites[s][0], boites[t][0]);
        const bj = Math.max(boites[s][1], boites[t][1]);
        if (cle(bi, bj) !== k) continue;
        croiser(segs[s], segs[t], coupes[s], coupes[t]);
      }
    }
  }
  const out: [Pt, Pt][] = [];
  segs.forEach(([a, b], s) => {
    const ts = [0, ...coupes[s].filter((t) => t > 1e-9 && t < 1 - 1e-9).sort((p, q) => p - q), 1];
    for (let k = 1; k < ts.length; k++) {
      const p = { x: a.x + (b.x - a.x) * ts[k - 1], y: a.y + (b.y - a.y) * ts[k - 1] };
      const q = { x: a.x + (b.x - a.x) * ts[k], y: a.y + (b.y - a.y) * ts[k] };
      if (dist(p, q) > TOL) out.push([p, q]);
    }
  });
  return out;
}

/** Paramètres de coupe de deux segments qui se croisent ou se touchent (extrémité posée sur l'autre). */
function croiser([a, b]: [Pt, Pt], [c, d]: [Pt, Pt], ts: number[], us: number[]): void {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  const lr = Math.hypot(rx, ry);
  const ls = Math.hypot(sx, sy);
  if (Math.abs(den) > 1e-12 * lr * ls) {
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den;
    const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
    const et = TOL / lr;
    const eu = TOL / ls;
    if (t >= -et && t <= 1 + et && u >= -eu && u <= 1 + eu) {
      ts.push(t);
      us.push(u);
    }
    return;
  }
  // Parallèles : une extrémité posée sur l'autre segment (traits superposés).
  const sur = (p: Pt, o: Pt, vx: number, vy: number, l: number, liste: number[]) => {
    const t = ((p.x - o.x) * vx + (p.y - o.y) * vy) / (l * l);
    const q = { x: o.x + vx * t, y: o.y + vy * t };
    if (t > 0 && t < 1 && dist(p, q) < TOL) liste.push(t);
  };
  sur(c, a, rx, ry, lr, ts);
  sur(d, a, rx, ry, lr, ts);
  sur(a, c, sx, sy, ls, us);
  sur(b, c, sx, sy, ls, us);
}

// ---------------------------------------------------------------- Graphe et faces

interface Graphe {
  pts: Pt[];
  voisins: Set<number>[];
}

function graphe(segs: [Pt, Pt][]): Graphe {
  const pts: Pt[] = [];
  const voisins: Set<number>[] = [];
  const index = new Map<string, number[]>();
  const cel = (v: number) => Math.round(v / (TOL * 4));
  const sommet = (p: Pt): number => {
    const ci = cel(p.x);
    const cj = cel(p.y);
    for (let i = ci - 1; i <= ci + 1; i++)
      for (let j = cj - 1; j <= cj + 1; j++) for (const s of index.get(`${i},${j}`) ?? []) if (dist(pts[s], p) <= TOL) return s;
    pts.push({ x: p.x, y: p.y });
    voisins.push(new Set());
    const k = `${ci},${cj}`;
    index.set(k, [...(index.get(k) ?? []), pts.length - 1]);
    return pts.length - 1;
  };
  for (const [a, b] of segs) {
    const i = sommet(a);
    const j = sommet(b);
    if (i === j) continue;
    voisins[i].add(j);
    voisins[j].add(i);
  }
  // Traits qui ne ferment rien : on retire les extrémités libres, de proche en proche.
  const pile = voisins.map((v, i) => i).filter((i) => voisins[i].size === 1);
  while (pile.length) {
    const i = pile.pop()!;
    if (voisins[i].size !== 1) continue;
    const [j] = voisins[i];
    voisins[i].clear();
    voisins[j].delete(i);
    if (voisins[j].size === 1) pile.push(j);
  }
  return { pts, voisins };
}

/**
 * Toutes les faces du graphe, en tournant toujours le plus à gauche : les faces intérieures sont dans le
 * sens trigonométrique (aire positive), la face extérieure de chaque morceau dans l'autre sens.
 */
function faces(g: Graphe): { cycle: number[]; aire: number; morceau: number }[] {
  const { pts, voisins } = g;
  const tries = voisins.map((v, i) =>
    [...v].sort((a, b) => Math.atan2(pts[a].y - pts[i].y, pts[a].x - pts[i].x) - Math.atan2(pts[b].y - pts[i].y, pts[b].x - pts[i].x)),
  );
  const vu = new Set<string>();
  // Morceaux d'un seul tenant (union-find).
  const parent = pts.map((_, i) => i);
  const racine = (i: number): number => (parent[i] === i ? i : (parent[i] = racine(parent[i])));
  voisins.forEach((v, i) => v.forEach((j) => (parent[racine(i)] = racine(j))));
  const out: { cycle: number[]; aire: number; morceau: number }[] = [];
  for (let u = 0; u < pts.length; u++) {
    for (const v0 of tries[u]) {
      if (vu.has(`${u}>${v0}`)) continue;
      const cycle: number[] = [];
      let a = u;
      let b = v0;
      for (let garde = 0; garde < 4 * pts.length + 8; garde++) {
        const k = `${a}>${b}`;
        if (vu.has(k)) break;
        vu.add(k);
        cycle.push(a);
        const l = tries[b];
        const i = l.indexOf(a);
        const c = l[(i - 1 + l.length) % l.length];
        a = b;
        b = c;
      }
      out.push({ cycle, aire: aireSignee(cycle.map((i) => pts[i])), morceau: racine(u) });
    }
  }
  return out;
}

/** Contours extérieurs de chaque morceau d'un seul tenant : sa face extérieure, retournée. */
function contoursExterieurs(g: Graphe): { points: Pt[]; sommets: number[] }[] {
  const exterieur = new Map<number, { aire: number; cycle: number[] }>();
  for (const f of faces(g)) if (f.aire < 0 && f.aire < (exterieur.get(f.morceau)?.aire ?? 0)) exterieur.set(f.morceau, f);
  return [...exterieur.values()].map(({ cycle }) => {
    const sommets = [...cycle].reverse();
    return { points: sommets.map((i) => g.pts[i]), sommets };
  });
}

/**
 * Hachurage : le plus petit contour fermé (une face) qui entoure le point désigné. Null si le point n'est
 * dans aucun contour fermé.
 */
export function faceAutour(prims: readonly Primitive[], p: Pt): Pt[] | null {
  const g = graphe(couper(prims.flatMap(enSegments)));
  let meilleure: { points: Pt[]; aire: number } | null = null;
  for (const f of faces(g)) {
    if (f.aire <= TOL * TOL) continue;
    const points = f.cycle.map((i) => g.pts[i]);
    if ((!meilleure || f.aire < meilleure.aire) && dansPolygone(p, points)) meilleure = { points, aire: f.aire };
  }
  return meilleure?.points ?? null;
}

/**
 * Hachurage (règle de l'original) : le contour fermé rencontré en premier en partant du point vers l'Est.
 * C'est le tour de la zone du côté du point, en suivant les traits reliés au trait rencontré : un îlot à l'Est
 * du point donne son propre contour (pour un évidement), sinon c'est le contour qui entoure le point.
 * Null si aucun contour fermé n'est rencontré.
 */
export function contourVersEst(prims: readonly Primitive[], p: Pt): Pt[] | null {
  const g = graphe(couper(prims.flatMap(enSegments)));
  let meilleur: { x: number; a: number; b: number } | null = null;
  g.voisins.forEach((v, i) =>
    v.forEach((j) => {
      if (j < i) return;
      const a = g.pts[i];
      const b = g.pts[j];
      if (a.y > p.y === b.y > p.y) return;
      const x = a.x + ((p.y - a.y) * (b.x - a.x)) / (b.y - a.y);
      if (x > p.x && (!meilleur || x < meilleur.x)) meilleur = { x, a: i, b: j };
    }),
  );
  const m = meilleur as { x: number; a: number; b: number } | null;
  if (!m) return null;
  // Le sens de parcours qui laisse le point à gauche : la zone du côté du point.
  const [a, b] = [g.pts[m.a], g.pts[m.b]];
  const [u, v] = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) > 0 ? [m.a, m.b] : [m.b, m.a];
  for (const f of faces(g)) {
    const k = f.cycle.findIndex((i, n) => i === u && f.cycle[(n + 1) % f.cycle.length] === v);
    if (k >= 0) return f.cycle.length >= 3 && Math.abs(f.aire) > TOL * TOL ? f.cycle.map((i) => g.pts[i]) : null;
  }
  return null;
}

/** Contours imbriqués : chacun connaît ses trous directs et sa profondeur. */
function imbriquer(polys: Pt[][]): Contour[] {
  const cs: Contour[] = polys
    .map((points) => ({ points, aire: Math.abs(aireSignee(points)), trous: [] as Contour[], profondeur: 0 }))
    .filter((c) => c.aire > TOL * TOL)
    .sort((a, b) => b.aire - a.aire);
  const parents: (Contour | null)[] = cs.map(() => null);
  cs.forEach((c, i) => {
    // Le plus petit contour (plus grand déjà vu) qui le contient.
    for (let j = i - 1; j >= 0; j--) {
      if (dansPolygone(c.points[0], cs[j].points)) {
        parents[i] = cs[j];
        c.profondeur = cs[j].profondeur + 1;
        break;
      }
    }
  });
  cs.forEach((c, i) => {
    const p = parents[i];
    if (p && c.profondeur % 2 === 1) p.trous.push(c);
  });
  return cs;
}

export interface ResultatContours {
  /** Contours de matière (profondeur paire), avec leurs trous. */
  pieces: Contour[];
  /** Tous les contours, pour retrouver celui d'une arête désignée. */
  tous: Contour[];
}

/** Contours fermés formés par des primitives. */
export function contours(prims: readonly Primitive[]): ResultatContours {
  const segs = couper(prims.flatMap(enSegments));
  const g = graphe(segs);
  const tous = imbriquer(contoursExterieurs(g).map((c) => c.points));
  return { pieces: tous.filter((c) => c.profondeur % 2 === 0), tous };
}

/**
 * La pièce désignée par un point : le contour de matière le plus petit qui contient le point, ou dont le
 * bord passe tout près. Null si le point n'est sur aucun contour fermé.
 */
export function pieceEn(r: ResultatContours, p: Pt, rayon: number): Contour | null {
  const bord = (c: Contour) =>
    c.points.some((a, i) => distance(p, { type: 'segment', a, b: c.points[(i + 1) % c.points.length] }) <= rayon);
  // Du plus petit au plus grand : la première pièce touchée ou qui contient le point.
  const pieces = [...r.pieces].sort((a, b) => a.aire - b.aire);
  return pieces.find((c) => bord(c) || c.trous.some(bord)) ?? pieces.find((c) => dansPolygone(p, c.points) && !c.trous.some((t) => dansPolygone(p, t.points))) ?? null;
}

// ---------------------------------------------------------------- Révolution

export interface Axe {
  a: Pt;
  b: Pt;
}

/** Garde la partie d'un polygone du côté v ≥ 0 (Sutherland-Hodgman sur un demi-plan). */
function demiPlan(poly: { u: number; v: number }[]): { u: number; v: number }[] {
  const out: { u: number; v: number }[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const pIn = p.v >= 0;
    const qIn = q.v >= 0;
    if (pIn) out.push(p);
    if (pIn !== qIn) {
      const t = p.v / (p.v - q.v);
      out.push({ u: p.u + (q.u - p.u) * t, v: 0 });
    }
  }
  return out;
}

/**
 * Profil d'une pièce de révolution : la moitié du contour d'un côté de l'axe (la plus grande), en
 * coordonnées (r = distance à l'axe, z = position le long de l'axe depuis `axe.a`).
 */
export function profilRevolution(contour: Pt[], axe: Axe): { r: number; z: number }[] {
  const l = dist(axe.a, axe.b);
  if (l < 1e-9) return [];
  const ux = (axe.b.x - axe.a.x) / l;
  const uy = (axe.b.y - axe.a.y) / l;
  const local = contour.map((p) => ({ u: (p.x - axe.a.x) * ux + (p.y - axe.a.y) * uy, v: (p.y - axe.a.y) * ux - (p.x - axe.a.x) * uy }));
  const dessus = demiPlan(local);
  const dessous = demiPlan(local.map((p) => ({ u: p.u, v: -p.v })));
  const aire = (q: { u: number; v: number }[]) => Math.abs(aireSignee(q.map((p) => ({ x: p.u, y: p.v }))));
  const garde = aire(dessus) >= aire(dessous) ? dessus : dessous;
  return garde.map((p) => ({ r: Math.max(0, p.v), z: p.u }));
}

/** Un point bien à l'intérieur d'un polygone : milieu de la plus large traversée à mi-hauteur. */
function pointInterieur(poly: Pt[]): Pt {
  const ys = poly.map((p) => p.y);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  let meilleur: Pt = poly[0];
  let largeur = -1;
  // Plusieurs hauteurs (pas exactement sur un sommet) : on garde la plus large traversée.
  for (const k of [0.5, 0.37, 0.63, 0.21, 0.79]) {
    const y = y0 + (y1 - y0) * k + 1e-7;
    const xs: number[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      if (xs[i + 1] - xs[i] > largeur) {
        largeur = xs[i + 1] - xs[i];
        meilleur = { x: (xs[i] + xs[i + 1]) / 2, y };
      }
    }
  }
  return meilleur;
}

/**
 * Profils d'une pièce de révolution, perçages et alésages compris, en coordonnées (r, z) comme
 * profilRevolution. Dans le demi-plan gardé, le contour de la pièce et ses traits cachés (pointillés : un
 * alésage, un perçage borgne vus de l'extérieur) découpent des faces ; une face est de la matière si, en
 * s'éloignant de l'axe, on croise un nombre impair de traits. Les faces de matière voisines sont réunies.
 * Les traits cachés perpendiculaires à l'axe seuls (perçage radial) ne changent rien.
 */
export function profilsRevolution(contour: Pt[], caches: readonly Primitive[], axe: Axe): { r: number; z: number }[][] {
  const l = dist(axe.a, axe.b);
  if (l < 1e-9) return [];
  const ux = (axe.b.x - axe.a.x) / l;
  const uy = (axe.b.y - axe.a.y) / l;
  const versLocal = (p: Pt) => ({ u: (p.x - axe.a.x) * ux + (p.y - axe.a.y) * uy, v: (p.y - axe.a.y) * ux - (p.x - axe.a.x) * uy });
  const local = contour.map(versLocal);
  const dessus = demiPlan(local);
  const dessous = demiPlan(local.map((p) => ({ u: p.u, v: -p.v })));
  const aire = (q: { u: number; v: number }[]) => Math.abs(aireSignee(q.map((p) => ({ x: p.u, y: p.v }))));
  const signe = aire(dessus) >= aire(dessous) ? 1 : -1;
  const demi = signe === 1 ? dessus : dessous;
  if (demi.length < 3) return [];
  // En (x = u, y = v) : le contour coupé à l'axe, puis les traits cachés qui sont dans la pièce, coupés à l'axe.
  const poly: Pt[] = demi.map((p) => ({ x: p.u, y: p.v }));
  const segs: [Pt, Pt][] = poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);
  for (const prim of caches) {
    for (const [a0, b0] of enSegments(prim)) {
      const a1 = versLocal(a0);
      const b1 = versLocal(b0);
      let a = { x: a1.u, y: signe * a1.v };
      let b = { x: b1.u, y: signe * b1.v };
      if (a.y < 0 && b.y < 0) continue;
      if (a.y < 0 || b.y < 0) {
        const t = a.y / (a.y - b.y);
        const c = { x: a.x + (b.x - a.x) * t, y: 0 };
        if (a.y < 0) a = c;
        else b = c;
      }
      const milieu = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (dist(a, b) > TOL && dansPolygone(milieu, poly)) segs.push([a, b]);
    }
  }
  const g = graphe(couper(segs));
  // Toutes les arêtes qui bordent une face comptent pour la règle pair-impair.
  const bords: [Pt, Pt][] = [];
  g.voisins.forEach((v, i) => v.forEach((j) => i < j && bords.push([g.pts[i], g.pts[j]])));
  const matiere = (q: Pt) => {
    let n = 0;
    for (const [a, b] of bords) {
      if (a.x > q.x !== b.x > q.x) {
        const y = a.y + ((q.x - a.x) * (b.y - a.y)) / (b.x - a.x);
        if (y > q.y) n++;
      }
    }
    return n % 2 === 1;
  };
  // Arêtes orientées des faces de matière ; une arête commune à deux faces de matière disparaît.
  const orientees = new Map<string, [number, number]>();
  for (const f of faces(g)) {
    if (f.aire <= TOL * TOL) continue;
    const points = f.cycle.map((i) => g.pts[i]);
    const q = pointInterieur(points);
    if (!dansPolygone(q, poly) || !matiere(q)) continue;
    f.cycle.forEach((i, k) => {
      const j = f.cycle[(k + 1) % f.cycle.length];
      if (orientees.has(`${j}>${i}`)) orientees.delete(`${j}>${i}`);
      else orientees.set(`${i}>${j}`, [i, j]);
    });
  }
  // On enchaîne les arêtes restantes en boucles ; on garde celles qui tournent dans le sens trigonométrique.
  const suivantes = new Map<number, number[]>();
  for (const [i, j] of orientees.values()) suivantes.set(i, [...(suivantes.get(i) ?? []), j]);
  const profils: { r: number; z: number }[][] = [];
  for (const [depart] of orientees.values()) {
    if (!suivantes.get(depart)?.length) continue;
    const boucle: number[] = [];
    let i = depart;
    for (let garde = 0; garde < g.pts.length + 2; garde++) {
      const l2 = suivantes.get(i);
      if (!l2?.length) break;
      boucle.push(i);
      i = l2.shift()!;
      if (i === depart) break;
    }
    const pts = boucle.map((k) => g.pts[k]);
    if (pts.length >= 3 && aireSignee(pts) > TOL * TOL) profils.push(pts.map((p) => ({ r: Math.max(0, p.y), z: p.x })));
  }
  return profils;
}

/**
 * Axe de révolution d'un contour : parmi les traits mixtes (traits d'axe), celui qui court le plus
 * longtemps le long de la pièce (la pièce projetée sur le trait) ; à égalité, le plus proche de son milieu.
 * Le trait peut passer à côté de la pièce (moitié d'une coupe complète), sans s'en éloigner de plus que sa
 * taille. Sans trait d'axe : l'horizontale qui passe par le milieu de la pièce.
 */
export function axePour(contour: Pt[], candidats: readonly Primitive[]): Axe {
  const xs = contour.map((p) => p.x);
  const ys = contour.map((p) => p.y);
  const b = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  const centre = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
  const taille = Math.hypot(b.x1 - b.x0, b.y1 - b.y0);
  let meilleur: { axe: Axe; longueur: number; ecart: number } | null = null;
  for (const p of candidats) {
    if (p.type !== 'segment' && p.type !== 'droite' && p.type !== 'demi-droite') continue;
    const l = dist(p.a, p.b);
    if (l < 1e-9) continue;
    const ecart = Math.abs((centre.x - p.a.x) * (p.b.y - p.a.y) - (centre.y - p.a.y) * (p.b.x - p.a.x)) / l;
    if (ecart > taille) continue;
    // La pièce projetée sur le trait, et la partie commune avec le trait.
    const ts = contour.map((q) => ((q.x - p.a.x) * (p.b.x - p.a.x) + (q.y - p.a.y) * (p.b.y - p.a.y)) / (l * l));
    const t0 = Math.max(Math.min(...ts), p.type === 'droite' ? -Infinity : 0);
    const t1 = Math.min(Math.max(...ts), p.type === 'segment' ? 1 : Infinity);
    const longueur = (t1 - t0) * l;
    if (longueur < 1e-6) continue;
    if (!meilleur || longueur > meilleur.longueur * 1.05 || (longueur > meilleur.longueur * 0.95 && ecart < meilleur.ecart)) {
      meilleur = { axe: { a: p.a, b: p.b }, longueur, ecart };
    }
  }
  return meilleur?.axe ?? { a: { x: b.x0, y: centre.y }, b: { x: b.x1, y: centre.y } };
}
