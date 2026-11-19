// Modifications du dessin (ligne 4 de la palette) : transformations et effacements partiels.
// Sans DOM (testé dans test/edition.test.ts).
import { definitionHachures, entiteHachures } from './hachures';
import { refaireImage } from './images';
import type { Entite } from './dessin';
import { dist, type PointCaracteristique, type Pt } from './geometrie';
import { angleDe, arcTroisPoints, dansArc, distance, intersections, norm, surCercle, type Primitive } from './primitives';

// ======================================================================= Désignation

/** Entité la plus proche du point, à moins de `rayon` (null : aucune, on définit alors une fenêtre). */
export function entiteProche(entites: readonly Entite[], p: Pt, rayon: number): Entite | null {
  let meilleure: Entite | null = null;
  let d = rayon;
  for (const e of entites) {
    for (const prim of e.primitives) {
      const x = distance(p, prim);
      if (x <= d) {
        d = x;
        meilleure = e;
      }
    }
  }
  return meilleure;
}

/** Primitive la plus proche dans une entité. */
export function primitiveProche(e: Entite, p: Pt): number {
  let i0 = 0;
  let d = Infinity;
  e.primitives.forEach((prim, i) => {
    const x = distance(p, prim);
    if (x < d) {
      d = x;
      i0 = i;
    }
  });
  return i0;
}

/** Points d'une primitive, pour savoir si elle est entièrement dans une fenêtre. */
function pointsDe(p: Primitive): Pt[] {
  switch (p.type) {
    case 'segment':
    case 'droite':
    case 'demi-droite':
      return [p.a, p.b];
    case 'cercle':
      return [0, 90, 180, 270].map((a) => surCercle(p.c, p.r, a));
    case 'arc': {
      const o = norm(p.fin - p.debut) || 360;
      return [0, 0.25, 0.5, 0.75, 1].map((k) => surCercle(p.c, p.r, p.debut + o * k));
    }
    case 'texte':
    case 'point':
      return [p.p];
  }
}

/** Entités entièrement contenues dans la fenêtre (a, b). Droites et demi-droites : par leurs deux points. */
export function dansFenetre(entites: readonly Entite[], a: Pt, b: Pt): Entite[] {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  const dedans = (p: Pt) => p.x >= x0 - 1e-9 && p.x <= x1 + 1e-9 && p.y >= y0 - 1e-9 && p.y <= y1 + 1e-9;
  return entites.filter((e) => e.primitives.every((p) => pointsDe(p).every(dedans)));
}

/**
 * Liste de niveaux tapée au clavier, comme dans l'original : « * » tous, « tt » le niveau de travail,
 * des numéros séparés par + ou - (ex. « *-2-3 » : tous sauf 2 et 3). Null si la liste est illisible.
 */
export function lireNiveaux(texte: string, travail: number): Set<number> | null {
  const t = texte.replace(/\s/g, '').toLowerCase();
  if (!t) return null;
  const res = new Set<number>();
  const morceaux = t.match(/[+-]?[^+-]+/g) ?? [];
  for (const m of morceaux) {
    const retirer = m.startsWith('-');
    const v = m.replace(/^[+-]/, '').replace(/\.$/, '');
    const niveaux = v === '*' ? Array.from({ length: 99 }, (_, i) => i + 1) : v === 'tt' ? [travail] : /^\d+$/.test(v) ? [Number(v)] : null;
    if (!niveaux) return null;
    for (const n of niveaux) {
      if (retirer) res.delete(n);
      else res.add(n);
    }
  }
  return res;
}

// ======================================================================= Transformations

export interface Affine {
  m: (p: Pt) => Pt;
  k: number; // rapport des longueurs
  rot: number; // rotation (degrés) — pour les textes
  miroir: number | null; // angle de l'axe de symétrie (degrés), ou null
  /** Transformation qui ne garde pas les formes (affinité) : les cercles et arcs deviennent des ellipses. */
  deforme?: boolean;
}

/** Cercle ou arc découpé en petits segments (repérables seulement aux extrémités de l'arc). */
function enSegments(c: Pt, r: number, debut: number, ouverture: number, t: Affine): Primitive[] {
  const n = Math.max(4, Math.ceil(ouverture / 5));
  const pts = Array.from({ length: n + 1 }, (_, i) => t.m(surCercle(c, r, debut + (ouverture * i) / n)));
  const plein = ouverture >= 360 - 1e-9;
  return pts.slice(1).map((b, i) => ({ type: 'segment' as const, a: pts[i], b, ...(plein || (i > 0 && i < n - 1) ? { courbe: true as const } : {}) }));
}

function transformer(p: Primitive, t: Affine): Primitive | Primitive[] | null {
  if (t.deforme && p.type === 'cercle') return enSegments(p.c, p.r, 0, 360, t);
  if (t.deforme && p.type === 'arc') return enSegments(p.c, p.r, p.debut, norm(p.fin - p.debut) || 360, t);
  if (t.deforme && p.type === 'texte') {
    // Le texte suit son point d'insertion et la direction de sa ligne ; sa hauteur ne change pas.
    const q = t.m(p.p);
    const u = t.m(surCercle(p.p, 1, p.angle));
    return { ...p, p: q, angle: angleDe(q, u) };
  }
  switch (p.type) {
    case 'segment':
    case 'droite':
    case 'demi-droite':
      return { ...p, a: t.m(p.a), b: t.m(p.b), ...(p.type === 'segment' && p.bout ? { bout: [t.m(p.bout[0]), t.m(p.bout[1])] as [Pt, Pt] } : {}) };
    case 'cercle':
      return { ...p, c: t.m(p.c), r: p.r * Math.abs(t.k) };
    case 'arc': {
      const o = norm(p.fin - p.debut) || 360;
      const a = arcTroisPoints(t.m(surCercle(p.c, p.r, p.debut)), t.m(surCercle(p.c, p.r, p.debut + o / 2)), t.m(surCercle(p.c, p.r, p.fin)));
      return a ? { type: 'arc', ...a } : null;
    }
    case 'texte':
      return {
        ...p,
        p: t.m(p.p),
        h: p.h * Math.abs(t.k),
        angle: t.miroir === null ? p.angle + t.rot : norm(2 * t.miroir - p.angle),
        ...(p.mesure?.a !== undefined ? { mesure: { ...p.mesure, a: t.miroir === null ? p.mesure.a + t.rot : norm(2 * t.miroir - p.mesure.a) } } : {}),
      };
    case 'point':
      return { ...p, p: t.m(p.p) };
  }
}

export function transformerEntite(e: Entite, t: Affine): Entite {
  // Une image reste droite : seule sa position suit (et sa taille, pour une homothétie).
  if (e.genre === 'image' && e.extras[0]) return refaireImage(e, t.m(e.extras[0].p), t.deforme ? 1 : t.k);
  if (t.deforme && e.genre === 'hachure') {
    // Une hachure déformée est refaite dans ses nouveaux contours, avec le même écartement et la même inclinaison.
    const def = definitionHachures({ ...e, extras: e.extras.map((x) => ({ ...x, p: t.m(x.p) })), params: transformerReglages(e, t) });
    if (def) {
      const h = entiteHachures(def.contours, def.designes, def.reglage, e.niveau);
      return { ...h, ...(e.couleur !== undefined ? { couleur: e.couleur } : {}), ...(e.calque ? { calque: e.calque } : {}) };
    }
  }
  const prims: Primitive[] = [];
  const styles: NonNullable<Entite['styles']> = [];
  let nombres: number[] | null = null; // primitives par membre d'un groupe, si une affinité en change le nombre
  const membres = Array.isArray(e.params?.membres) ? (e.params.membres as { n: number }[]) : null;
  const bornes = membres ? membres.map((m, i) => membres.slice(0, i + 1).reduce((s, x) => s + x.n, 0)) : [];
  if (membres) nombres = membres.map(() => 0);
  e.primitives.forEach((p, i) => {
    const r = transformer(p, t);
    const qs = r === null ? [] : Array.isArray(r) ? r : [r];
    for (const q of qs) {
      prims.push(q);
      if (e.styles) styles.push(e.styles[i]);
    }
    if (nombres) nombres[bornes.findIndex((b) => i < b)] += qs.length;
  });
  const extras: PointCaracteristique[] = e.extras.map((x) => ({ ...x, p: t.m(x.p) }));
  // Une affinité fait d'un cercle ou d'un arc une ellipse.
  const genre = t.deforme && (e.genre === 'cercle' || e.genre === 'arc') ? 'ellipse' : t.deforme && e.genre === 'oblong' ? 'polyligne' : e.genre;
  const params = e.params ? transformerReglages(e, t, nombres) : undefined;
  return { ...e, genre, primitives: prims, extras, ...(e.styles ? { styles } : {}), ...(params ? { params } : {}) };
}

/** Les réglages qui contiennent de la géométrie suivent la transformation (contours et inclinaison des hachures). */
function transformerReglages(e: Pick<Entite, 'genre' | 'params'>, t: Affine, nombres: number[] | null = null): Record<string, unknown> {
  const p = { ...e.params };
  // Membres d'un groupe : leurs réglages suivent aussi (hachures), et leur nombre de primitives (affinité).
  if (Array.isArray(p.membres)) {
    p.membres = (p.membres as { g: Entite['genre']; n: number; t?: Record<string, unknown> }[]).map((m, i) => {
      const g = t.deforme && (m.g === 'cercle' || m.g === 'arc') ? 'ellipse' : t.deforme && m.g === 'oblong' ? 'polyligne' : m.g;
      return { ...m, g, ...(nombres ? { n: nombres[i] } : {}), ...(m.t ? { t: transformerReglages({ genre: m.g, params: m.t }, t) } : {}) };
    });
  }
  if (Array.isArray(p.contours)) {
    p.contours = (p.contours as [number, number][][]).map((c) =>
      c.map(([x, y]) => {
        const q = t.m({ x, y });
        return [q.x, q.y];
      }),
    );
  }
  if (e.genre === 'hachure') {
    if (typeof p.angle === 'number') p.angle = t.miroir === null ? p.angle + t.rot : 2 * t.miroir - p.angle;
    if (typeof p.distance === 'number' && !t.deforme) p.distance = p.distance * Math.abs(t.k);
  }
  return p;
}

export const translation = (dx: number, dy: number): Affine => ({ m: (p) => ({ x: p.x + dx, y: p.y + dy }), k: 1, rot: 0, miroir: null });

export function rotation(c: Pt, angle: number): Affine {
  const a = (angle * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { m: (p) => ({ x: c.x + (p.x - c.x) * cos - (p.y - c.y) * sin, y: c.y + (p.x - c.x) * sin + (p.y - c.y) * cos }), k: 1, rot: angle, miroir: null };
}

export function symetrie(a: Pt, b: Pt): Affine {
  const l = dist(a, b) || 1;
  const ux = (b.x - a.x) / l;
  const uy = (b.y - a.y) / l;
  return {
    m: (p) => {
      const t = (p.x - a.x) * ux + (p.y - a.y) * uy;
      const h = { x: a.x + t * ux, y: a.y + t * uy };
      return { x: 2 * h.x - p.x, y: 2 * h.y - p.y };
    },
    k: 1,
    rot: 0,
    miroir: angleDe(a, b),
  };
}

/**
 * Affinité d'axe (a, b) et de rapport k : chaque point s'éloigne de l'axe perpendiculairement, ses distances
 * à l'axe multipliées par k.
 */
export function affinite(a: Pt, b: Pt, k: number): Affine {
  const l = dist(a, b) || 1;
  const ux = (b.x - a.x) / l;
  const uy = (b.y - a.y) / l;
  return {
    m: (p) => {
      const t = (p.x - a.x) * ux + (p.y - a.y) * uy;
      const h = { x: a.x + t * ux, y: a.y + t * uy };
      return { x: h.x + (p.x - h.x) * k, y: h.y + (p.y - h.y) * k };
    },
    k: Math.sqrt(Math.abs(k)),
    rot: 0,
    miroir: null,
    deforme: Math.abs(k - 1) > 1e-12,
  };
}

export function homothetie(c: Pt, k: number): Affine {
  return { m: (p) => ({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k }), k, rot: 0, miroir: null };
}

/** Déplacement d'un point : chaque extrémité, centre ou point qui coïncide avec `de` va en `vers`. */
export function deplacerPoint(e: Entite, de: Pt, vers: Pt): Entite | null {
  // Un rectangle, un polygone… désigné par son point milieu : toute l'entité suit.
  if (e.extras.some((x) => dist(x.p, de) < 1e-6)) return transformerEntite(e, translation(vers.x - de.x, vers.y - de.y));
  let touche = false;
  const bouge = (p: Pt) => {
    if (dist(p, de) < 1e-6) {
      touche = true;
      return { ...vers };
    }
    return p;
  };
  const prims = e.primitives.map((p): Primitive => {
    switch (p.type) {
      case 'segment':
      case 'droite':
      case 'demi-droite':
        return { ...p, a: bouge(p.a), b: bouge(p.b) };
      case 'cercle':
        return { ...p, c: bouge(p.c) };
      case 'arc': {
        const debut = surCercle(p.c, p.r, p.debut);
        const fin = surCercle(p.c, p.r, p.fin);
        if (dist(p.c, de) < 1e-6) return { ...p, c: bouge(p.c) };
        if (dist(debut, de) < 1e-6 || dist(fin, de) < 1e-6) {
          // L'extrémité bouge, l'autre reste, le milieu de l'arc aussi : nouvel arc par trois points.
          const milieu = surCercle(p.c, p.r, p.debut + (norm(p.fin - p.debut) || 360) / 2);
          const a = arcTroisPoints(bouge(debut), milieu, bouge(fin));
          return a ? { type: 'arc', ...a } : p;
        }
        return p;
      }
      case 'texte':
      case 'point':
        return { ...p, p: bouge(p.p) };
    }
  });
  return touche ? { ...e, primitives: prims } : null;
}

/** Éclatement : une entité composée devient une entité par primitive. */
export function eclater(e: Entite): Entite[] {
  return e.primitives.map((p, i) => ({
    genre: p.type === 'segment' || p.type === 'droite' || p.type === 'demi-droite' || p.type === 'cercle' || p.type === 'arc' || p.type === 'texte' || p.type === 'point' ? p.type : 'groupe',
    primitives: [p],
    extras: [],
    niveau: e.niveau,
    trait: e.styles?.[i]?.trait ?? e.trait,
    calque: e.calque,
    couleur: e.styles?.[i]?.couleur ?? e.couleur,
  }));
}

// ======================================================================= Effacements

/** Position d'un point le long d'une primitive : t ∈ [0, 1] pour une ligne, angle (degrés) pour un cercle ou un arc. */
function position(p: Primitive, q: Pt): number {
  if (p.type === 'segment' || p.type === 'droite' || p.type === 'demi-droite') {
    const dx = p.b.x - p.a.x;
    const dy = p.b.y - p.a.y;
    return ((q.x - p.a.x) * dx + (q.y - p.a.y) * dy) / (dx * dx + dy * dy || 1);
  }
  if (p.type === 'cercle' || p.type === 'arc') return angleDe(p.c, q);
  return 0;
}

/** Morceau de ligne entre t0 et t1. */
function morceauLigne(p: Extract<Primitive, { a: Pt }>, t0: number, t1: number): Primitive | null {
  if (t1 - t0 < 1e-9) return null;
  const P = (t: number) => ({ x: p.a.x + (p.b.x - p.a.x) * t, y: p.a.y + (p.b.y - p.a.y) * t });
  if (p.type === 'droite' && !Number.isFinite(t0) && !Number.isFinite(t1)) return p;
  if (!Number.isFinite(t0) && !Number.isFinite(t1)) return p;
  if (!Number.isFinite(t0)) return { type: 'demi-droite', a: P(t1), b: P(t1 - 1) };
  if (!Number.isFinite(t1)) return { type: 'demi-droite', a: P(t0), b: P(t0 + 1) };
  return { type: 'segment', a: P(t0), b: P(t1) };
}

/** Bornes d'une ligne selon son type. */
function bornesLigne(p: Primitive): [number, number] {
  return p.type === 'segment' ? [0, 1] : p.type === 'demi-droite' ? [0, Infinity] : [-Infinity, Infinity];
}

/**
 * Retire d'une primitive la partie comprise entre les positions u0 et u1 (dans l'ordre de parcours).
 * Renvoie ce qui reste (0, 1 ou 2 morceaux).
 */
export function retirerEntre(p: Primitive, q0: Pt, q1: Pt): Primitive[] {
  if (p.type === 'segment' || p.type === 'droite' || p.type === 'demi-droite') {
    const [b0, b1] = bornesLigne(p);
    let u0 = Math.max(b0, position(p, q0));
    let u1 = Math.min(b1, position(p, q1));
    if (u0 > u1) [u0, u1] = [u1, u0];
    return [morceauLigne(p, b0, u0), morceauLigne(p, u1, b1)].filter((x): x is Primitive => x !== null);
  }
  if (p.type === 'cercle') {
    // Sur un cercle : la partie retirée va du premier point au second, dans le sens trigonométrique.
    const a0 = position(p, q0);
    const a1 = position(p, q1);
    return Math.abs(norm(a1 - a0)) < 1e-9 ? [] : [{ type: 'arc', c: p.c, r: p.r, debut: a1, fin: a0 }];
  }
  if (p.type === 'arc') {
    let a0 = position(p, q0);
    let a1 = position(p, q1);
    if (!dansArc(a0, p.debut, p.fin)) a0 = p.debut;
    if (!dansArc(a1, p.debut, p.fin)) a1 = p.fin;
    if (norm(a0 - p.debut) > norm(a1 - p.debut)) [a0, a1] = [a1, a0];
    const out: Primitive[] = [];
    if (norm(a0 - p.debut) > 1e-7) out.push({ type: 'arc', c: p.c, r: p.r, debut: p.debut, fin: a0 });
    if (norm(p.fin - a1) > 1e-7) out.push({ type: 'arc', c: p.c, r: p.r, debut: a1, fin: p.fin });
    return out;
  }
  return [];
}

/**
 * Effacement d'une partie : la portion de la primitive comprise entre les deux intersections (avec les autres
 * primitives) qui encadrent le point désigné. Sans intersection, toute la primitive disparaît.
 */
export function retirerPartie(p: Primitive, q: Pt, autres: Primitive[]): Primitive[] {
  const xs = autres.flatMap((o) => intersections(p, o));
  if (p.type === 'segment' || p.type === 'droite' || p.type === 'demi-droite') {
    const [b0, b1] = bornesLigne(p);
    const u = position(p, q);
    const us = xs.map((x) => position(p, x)).filter((t) => t > b0 + 1e-9 && t < b1 - 1e-9);
    const avant = Math.max(b0, ...us.filter((t) => t < u));
    const apres = Math.min(b1, ...us.filter((t) => t > u));
    return [morceauLigne(p, b0, avant), morceauLigne(p, apres, b1)].filter((x): x is Primitive => x !== null);
  }
  if (p.type === 'cercle' || p.type === 'arc') {
    const debut = p.type === 'arc' ? p.debut : 0;
    const ouverture = p.type === 'arc' ? norm(p.fin - p.debut) || 360 : 360;
    const rel = (a: number) => norm(a - debut);
    const u = rel(position(p, q));
    const us = xs.map((x) => rel(angleDe(p.c, x))).filter((t) => t > 1e-7 && t < ouverture - 1e-7);
    if (p.type === 'cercle') {
      if (us.length < 2) return [];
      const avant = us.filter((t) => t < u);
      const apres = us.filter((t) => t > u);
      const a0 = avant.length ? Math.max(...avant) : Math.max(...us) - 360;
      const a1 = apres.length ? Math.min(...apres) : Math.min(...us) + 360;
      return [{ type: 'arc', c: p.c, r: p.r, debut: norm(debut + a1), fin: norm(debut + a0) }];
    }
    const avant = Math.max(0, ...us.filter((t) => t < u));
    const apres = Math.min(ouverture, ...us.filter((t) => t > u));
    const out: Primitive[] = [];
    if (avant > 1e-7) out.push({ type: 'arc', c: p.c, r: p.r, debut, fin: norm(debut + avant) });
    if (ouverture - apres > 1e-7) out.push({ type: 'arc', c: p.c, r: p.r, debut: norm(debut + apres), fin: norm(debut + ouverture) });
    return out;
  }
  return [];
}

/**
 * Effacement d'une demi-entité : la primitive est coupée par l'entité limite ; la partie du côté du point
 * de désignation est retirée.
 */
export function retirerDemi(p: Primitive, q: Pt, limite: Primitive[]): Primitive[] | null {
  const xs = limite.flatMap((o) => intersections(p, o));
  if (xs.length === 0) return null;
  if (p.type === 'segment' || p.type === 'droite' || p.type === 'demi-droite') {
    const [b0, b1] = bornesLigne(p);
    const u = position(p, q);
    const coupe = xs.map((x) => position(p, x)).sort((a, b) => Math.abs(a - u) - Math.abs(b - u))[0];
    return [u > coupe ? morceauLigne(p, b0, coupe) : morceauLigne(p, coupe, b1)].filter((x): x is Primitive => x !== null);
  }
  if (p.type === 'arc') {
    const rel = (a: number) => norm(a - p.debut);
    const u = rel(position(p, q));
    const coupe = xs.map((x) => rel(angleDe(p.c, x))).sort((a, b) => Math.abs(a - u) - Math.abs(b - u))[0];
    const fin = p.debut + coupe;
    return [u > coupe ? { type: 'arc', c: p.c, r: p.r, debut: p.debut, fin: norm(fin) } : { type: 'arc', c: p.c, r: p.r, debut: norm(fin), fin: p.fin }];
  }
  return null;
}
