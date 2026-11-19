// Cotation fonctionnelle (palette MECA, cases G13 à G15 et H13 à H15), sans DOM (testé dans test/meca.test.ts).
// Chaque pièce est sur son niveau. Une « condition » (jeu, dépassement…) relie deux surfaces ; la chaîne de
// cotes part de la première surface, traverse les pièces en contact (une cote par pièce : de la surface
// d'entrée à la surface de sortie) et arrive à la seconde. Les surfaces sont les traits forts perpendiculaires
// à la direction des chaînes (chaînes horizontales : traits verticaux).
import type { Entite } from './dessin';
import type { Pt } from './geometrie';

export type Sens = 'h' | 'v';

/** Une surface : sa position le long de la direction des chaînes, son étendue en travers, sa pièce (niveau). */
export interface Surface {
  c: number;
  min: number;
  max: number;
  niveau: number;
}

/** Une cote de la chaîne : dans la pièce `niveau`, de la surface `de` à la surface `a` (positions). */
export interface Composante {
  niveau: number;
  de: number;
  a: number;
}

export const TOL_SURFACE = 1e-3;
/** Nombre de cotes au plus dans une chaîne (au-delà : « recherche trop complexe »). */
export const MAX_COMPOSANTES = 12;

/** Les surfaces des pièces : traits continus forts perpendiculaires à la direction des chaînes. */
export function surfaces(entites: readonly Entite[], sens: Sens): Surface[] {
  const out: Surface[] = [];
  for (const e of entites) {
    if (e.genre === 'cote' || e.genre === 'texte' || e.genre === 'hachure' || e.genre === 'image') continue;
    e.primitives.forEach((p, i) => {
      if (p.type !== 'segment' || (e.styles?.[i]?.trait ?? e.trait) !== 'continu-fort') return;
      const dx = Math.abs(p.b.x - p.a.x);
      const dy = Math.abs(p.b.y - p.a.y);
      if (sens === 'h' && dx < TOL_SURFACE && dy > TOL_SURFACE) out.push({ c: p.a.x, min: Math.min(p.a.y, p.b.y), max: Math.max(p.a.y, p.b.y), niveau: e.niveau });
      if (sens === 'v' && dy < TOL_SURFACE && dx > TOL_SURFACE) out.push({ c: p.a.y, min: Math.min(p.a.x, p.b.x), max: Math.max(p.a.x, p.b.x), niveau: e.niveau });
    });
  }
  return out;
}

/** La surface la plus proche d'un point désigné (à moins de `rayon`), ou null. */
export function surfaceEn(liste: Surface[], p: Pt, sens: Sens, rayon: number): Surface | null {
  const [c, t] = sens === 'h' ? [p.x, p.y] : [p.y, p.x];
  let meilleure: Surface | null = null;
  let d0 = rayon;
  for (const s of liste) {
    const dc = Math.abs(s.c - c);
    const dt = t < s.min ? s.min - t : t > s.max ? t - s.max : 0;
    const d = Math.hypot(dc, dt);
    if (d <= d0) {
      d0 = d;
      meilleure = s;
    }
  }
  return meilleure;
}

const memePosition = (a: number, b: number) => Math.abs(a - b) < TOL_SURFACE;
const recouvre = (a: Surface, b: Surface) => Math.min(a.max, b.max) - Math.max(a.min, b.min) > -TOL_SURFACE;

/**
 * Les chaînes de cotes les plus courtes entre la surface `depart` et la surface `arrivee` (une cote par pièce
 * traversée, jamais deux fois la même pièce). Liste vide : pas de chaîne (« chaîne de cote non fermée »).
 */
export function chercherChaines(liste: Surface[], depart: { c: number; niveau: number }, arrivee: { c: number; niveau: number }, max = 20): Composante[][] {
  const parPiece = new Map<number, number[]>();
  for (const s of liste) {
    const l = parPiece.get(s.niveau) ?? [];
    if (!l.some((c) => memePosition(c, s.c))) l.push(s.c);
    parPiece.set(s.niveau, l);
  }
  /** Pièces en contact avec la pièce `n` par sa surface en `c` (mêmes positions, étendues qui se recouvrent). */
  const contacts = (n: number, c: number): number[] => {
    const miennes = liste.filter((s) => s.niveau === n && memePosition(s.c, c));
    const autres = new Set<number>();
    for (const s of liste) if (s.niveau !== n && memePosition(s.c, c) && miennes.some((m) => recouvre(m, s))) autres.add(s.niveau);
    return [...autres];
  };
  type Etat = { niveau: number; c: number; chaine: Composante[]; vues: Set<number> };
  let front: Etat[] = [{ niveau: depart.niveau, c: depart.c, chaine: [], vues: new Set([depart.niveau]) }];
  for (let longueur = 1; longueur <= MAX_COMPOSANTES && front.length; longueur++) {
    const trouvees: Composante[][] = [];
    const suivant: Etat[] = [];
    for (const e of front) {
      for (const c2 of parPiece.get(e.niveau) ?? []) {
        if (memePosition(c2, e.c)) continue;
        const chaine = [...e.chaine, { niveau: e.niveau, de: e.c, a: c2 }];
        if (e.niveau === arrivee.niveau && memePosition(c2, arrivee.c)) {
          trouvees.push(chaine);
          continue;
        }
        for (const n of contacts(e.niveau, c2)) {
          if (e.vues.has(n)) continue;
          suivant.push({ niveau: n, c: c2, chaine, vues: new Set([...e.vues, n]) });
        }
      }
    }
    if (trouvees.length) return trouvees.slice(0, max);
    front = suivant.slice(0, 5000);
  }
  return [];
}

// ======================================================================= Résolution

export interface Tolerance {
  nominal: number;
  es: number;
  ei: number;
  /** Fixée par l'utilisateur (== dans le tableau) ; sinon calculée (*=). */
  fixe: boolean;
}

export interface Resolution {
  condition: Tolerance;
  composantes: Tolerance[];
  /** Message d'erreur (IT trop petit, résultante non fixée…). */
  erreur?: string;
}

const arrondir = (v: number, precision: number) => Math.round(v / precision) * precision;

/**
 * Résolution « au pire des cas » d'une chaîne : la condition vaut Σ signe x composante.
 * - Toutes les composantes fixées : la condition est calculée.
 * - Condition fixée, des composantes inconnues : l'IT qui reste est partagé également entre elles, et leurs
 *   cotes moyennes sont décalées pour centrer la condition.
 */
export function resoudre(condition: Partial<Tolerance> & { nominal: number }, composantes: (Partial<Tolerance> & { nominal: number; signe: 1 | -1 })[], precision: number): Resolution {
  const connues = composantes.filter((c) => c.fixe);
  const inconnues = composantes.filter((c) => !c.fixe);
  const t = (c: Partial<Tolerance> & { nominal: number }, fixe: boolean): Tolerance => ({ nominal: c.nominal, es: c.es ?? 0, ei: c.ei ?? 0, fixe });
  if (inconnues.length === 0) {
    let max = 0;
    let min = 0;
    for (const c of composantes) {
      const es = c.es ?? 0;
      const ei = c.ei ?? 0;
      if (c.signe > 0) (max += c.nominal + es), (min += c.nominal + ei);
      else (max -= c.nominal + ei), (min -= c.nominal + es);
    }
    const nominal = composantes.reduce((s, c) => s + c.signe * c.nominal, 0);
    const calculee: Tolerance = { nominal, es: max - nominal, ei: min - nominal, fixe: false };
    const res: Resolution = { condition: calculee, composantes: composantes.map((c) => t(c, true)) };
    if (condition.fixe) {
      const cmax = condition.nominal + (condition.es ?? 0);
      const cmin = condition.nominal + (condition.ei ?? 0);
      if (max > cmax + 1e-9 || min < cmin - 1e-9) res.erreur = `Erreur sur les IT de la chaîne : la résultante varie de ${min.toFixed(3)} à ${max.toFixed(3)}. Modifier certaines tolérances.`;
      res.condition = t(condition, true);
    }
    return res;
  }
  if (!condition.fixe) return { condition: t(condition, false), composantes: composantes.map((c) => t(c, !!c.fixe)), erreur: 'Tolérances de la résultante non fixées.' };
  const itCondition = (condition.es ?? 0) - (condition.ei ?? 0);
  const itConnu = connues.reduce((s, c) => s + ((c.es ?? 0) - (c.ei ?? 0)), 0);
  const reste = itCondition - itConnu;
  const part = Math.floor(reste / inconnues.length / precision + 1e-9) * precision;
  if (part <= 0) return { condition: t(condition, true), composantes: composantes.map((c) => t(c, !!c.fixe)), erreur: 'Erreur sur les IT de la chaîne : IT de la résultante trop petit. Modifier certaines tolérances.' };
  // Centrage : Σ signe x cote moyenne = cote moyenne de la condition.
  const moyenneCondition = condition.nominal + ((condition.es ?? 0) + (condition.ei ?? 0)) / 2;
  const moyennesConnues = connues.reduce((s, c) => s + c.signe * (c.nominal + ((c.es ?? 0) + (c.ei ?? 0)) / 2), 0);
  const nominauxInconnus = inconnues.reduce((s, c) => s + c.signe * c.nominal, 0);
  const D = moyenneCondition - moyennesConnues - nominauxInconnus;
  return {
    condition: t(condition, true),
    composantes: composantes.map((c) => {
      if (c.fixe) return t(c, true);
      const delta = (c.signe * D) / inconnues.length;
      // Arrondis vers l'intérieur : l'IT obtenu ne dépasse jamais la part calculée.
      const es = Math.floor((delta + part / 2) / precision + 1e-9) * precision;
      const ei = Math.ceil((delta - part / 2) / precision - 1e-9) * precision;
      return { nominal: c.nominal, es: arrondir(es, precision), ei: arrondir(ei, precision), fixe: false };
    }),
  };
}

/** Texte d'une cote tolérancée : « a1 = 25 ±0.05 », « a = 0.5 +0.3/+0.1 ». */
export function texteTolerance(nom: string, t: { nominal: number; es?: number; ei?: number } | null, decimales = 3): string {
  if (!t) return nom;
  const n = (v: number) => (Math.round(v * 10 ** decimales) / 10 ** decimales).toString();
  const s = (v: number) => (Math.abs(v) < 5e-7 ? '0' : v > 0 ? `+${n(v)}` : n(v));
  const es = t.es ?? 0;
  const ei = t.ei ?? 0;
  if (Math.abs(es) < 5e-7 && Math.abs(ei) < 5e-7) return `${nom} = ${n(t.nominal)}`;
  if (Math.abs(es + ei) < 5e-7) return `${nom} = ${n(t.nominal)} ±${n(es)}`;
  return `${nom} = ${n(t.nominal)} ${s(es)}/${s(ei)}`;
}
