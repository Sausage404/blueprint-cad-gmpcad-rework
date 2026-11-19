// Hachures (C16 à C20), sans DOM (testé dans test/hachures.test.ts).
// Les lignes sont calculées par balayage : pour chaque droite, on garde les morceaux à l'intérieur des
// contours (règle pair-impair : un contour désigné à l'intérieur d'un autre fait un évidement).
import type { Entite, Trait } from './dessin';
import type { PointCaracteristique, Pt } from './geometrie';
import type { Primitive } from './primitives';

/** Types de hachures de l'original (aide, « Choix hachurage »), en conventions de dessin industriel. */
export const MOTIFS = [
  { cle: 'tout', nom: 'Tout matériau' },
  { cle: 'legers', nom: 'Alliages légers' },
  { cle: 'synthetiques', nom: 'Matières synthétiques' },
  { cle: 'cuivreux', nom: 'Alliages cuivreux' },
  { cle: 'souples', nom: 'Matériaux souples' },
  { cle: 'mousse', nom: 'Mousse de remplissage' },
] as const;
export type Motif = (typeof MOTIFS)[number]['cle'];

export interface ReglageHachures {
  motif: Motif;
  distance: number; // mm entre deux lignes
  angle: number; // degrés
}

export const nomMotif = (m: string) => MOTIFS.find((x) => x.cle === m)?.nom ?? m;

/** Morceaux de la droite y = h (repère tourné) à l'intérieur des contours (pair-impair). */
function balayer(polys: Pt[][], h: number): [number, number][] {
  const xs: number[] = [];
  for (const p of polys) {
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      if (a.y > h !== b.y > h) xs.push(a.x + ((h - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
  }
  xs.sort((u, v) => u - v);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 1e-9) out.push([xs[i], xs[i + 1]]);
  return out;
}

/**
 * Une famille de lignes parallèles d'inclinaison `angle` et d'écartement `distance`, calée sur l'origine du
 * dessin (deux zones voisines hachurées pareil se raccordent). `decalage` : en fraction d'écartement.
 * `filtre(k)` choisit les lignes gardées (k = rang de la ligne).
 */
function famille(polys: Pt[][], angle: number, distance: number, decalage = 0, filtre: (k: number) => boolean = () => true): { a: Pt; b: Pt; k: number }[] {
  const t = (angle * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  // Repère tourné : les lignes deviennent horizontales.
  const vers = (p: Pt): Pt => ({ x: p.x * c + p.y * s, y: -p.x * s + p.y * c });
  const depuis = (p: Pt): Pt => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c });
  const tournes = polys.map((p) => p.map(vers));
  const ys = tournes.flat().map((p) => p.y);
  if (ys.length === 0) return [];
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const out: { a: Pt; b: Pt; k: number }[] = [];
  const kmin = Math.ceil(y0 / distance - decalage);
  const kmax = Math.floor(y1 / distance - decalage);
  if (kmax - kmin > 20000) return []; // écartement absurde pour la taille de la zone
  for (let k = kmin; k <= kmax; k++) {
    if (!filtre(k)) continue;
    const h = (k + decalage) * distance;
    if (h <= y0 + 1e-9 || h >= y1 - 1e-9) continue; // une ligne confondue avec un bord n'est pas une hachure
    for (const [xa, xb] of balayer(tournes, h)) out.push({ a: depuis({ x: xa, y: h }), b: depuis({ x: xb, y: h }), k });
  }
  return out;
}

/** Les traits d'un hachurage, avec le type de trait de chacun. */
export function traitsHachures(polys: Pt[][], r: ReglageHachures): { prim: Primitive; trait: Trait }[] {
  const d = Math.max(0.05, r.distance);
  const plein = (l: { a: Pt; b: Pt }) => ({ prim: { type: 'segment' as const, a: l.a, b: l.b }, trait: 'continu-fin' as Trait });
  const interrompu = (l: { a: Pt; b: Pt }) => ({ prim: { type: 'segment' as const, a: l.a, b: l.b }, trait: 'pointille-fin' as Trait });
  // Motifs relevés sur les conversions DXF de l'original : alliages légers en lignes doublées (à un quart de
  // l'écartement), matières synthétiques avec une deuxième famille à 45° ; alliages cuivreux : une ligne sur
  // deux en trait interrompu (convention du dessin industriel, la conversion ne montre pas les tirets).
  switch (r.motif) {
    case 'legers':
      return [...famille(polys, r.angle, d), ...famille(polys, r.angle, d, 0.25)].map(plein);
    case 'synthetiques':
      return [...famille(polys, r.angle, d), ...famille(polys, r.angle + 45, d)].map(plein);
    case 'cuivreux':
      return famille(polys, r.angle, d).map((l) => (l.k % 2 === 0 ? plein(l) : interrompu(l)));
    case 'souples': // losanges
      return [...famille(polys, r.angle, d), ...famille(polys, -r.angle, d)].map(plein);
    case 'mousse': // quadrillage en traits interrompus
      return [...famille(polys, r.angle, d), ...famille(polys, r.angle + 90, d)].map(interrompu);
    default:
      return famille(polys, r.angle, d).map(plein);
  }
}

/** L'entité d'un hachurage : ses traits, ses contours et ses points désignés (le premier est le point de référence). */
export function entiteHachures(contours: Pt[][], designes: Pt[], r: ReglageHachures, niveau: number): Entite {
  const traits = traitsHachures(contours, r);
  const extras: PointCaracteristique[] = designes.map((p) => ({ p, type: 'extremite' }));
  return {
    genre: 'hachure',
    primitives: traits.map((t) => t.prim),
    styles: traits.map((t) => ({ trait: t.trait })),
    extras,
    niveau,
    trait: 'continu-fin',
    params: { motif: r.motif, distance: r.distance, angle: r.angle, contours: contours.map((c) => c.map((p) => [round(p.x), round(p.y)])) },
  };
}

const round = (v: number) => Math.round(v * 1e4) / 1e4;

/** Réglages et contours d'un hachurage existant. */
export function definitionHachures(e: Entite): { contours: Pt[][]; designes: Pt[]; reglage: ReglageHachures } | null {
  const p = e.params;
  if (e.genre !== 'hachure' || !p || !Array.isArray(p.contours)) return null;
  const contours = (p.contours as [number, number][][]).map((c) => c.map(([x, y]) => ({ x, y })));
  return {
    contours,
    designes: e.extras.map((x) => x.p),
    reglage: { motif: (MOTIFS.some((m) => m.cle === p.motif) ? p.motif : 'tout') as Motif, distance: Number(p.distance) || 4, angle: Number(p.angle) || 0 },
  };
}
