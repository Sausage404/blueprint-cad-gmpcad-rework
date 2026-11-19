// Géométrie du pointage : grille, calage angulaire, choix du point repéré (les primitives et leurs
// points repérables sont dans primitives.ts).
// Unités : mm, axe Y vers le haut. Aucune dépendance au DOM (testé dans test/geometrie.test.ts).

export interface Pt {
  x: number;
  y: number;
}

export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
const EPS = 1e-9;

// ---------------------------------------------------------------- Grille

export interface Grille {
  origine: Pt;
  pas: number; // pas effectif, en mm
}

const arrondi = (v: number, origine: number, pas: number) => origine + Math.round((v - origine) / pas) * pas;

export function surGrille(p: Pt, g: Grille): Pt {
  return { x: arrondi(p.x, g.origine.x, g.pas), y: arrondi(p.y, g.origine.y, g.pas) };
}

/**
 * Pas effectif : le pas demandé, divisé automatiquement (2, 5, 10, 20, 50…) tant que moins de
 * 20 pas tiennent dans la largeur visible (aide d'origine, « Changement de grille », particularité 5).
 */
export function pasEffectif(pas: number, largeurVisibleMm: number): number {
  const diviseurs = [1, 2, 5];
  for (let puissance = 1; puissance <= 1e6; puissance *= 10) {
    for (const d of diviseurs) {
      const p = pas / (d * puissance);
      if (largeurVisibleMm / p >= 20) return p;
    }
  }
  return pas / 1e6;
}

// ---------------------------------------------------------------- Calage angulaire

export type LogoGrille = 'intersection' | 'horizontale' | 'verticale' | 'libre';

export interface Contrainte {
  p: Pt;
  grille: LogoGrille;
  cale: boolean; // le réticule est sur une direction calée
  angle: number | null; // direction calée, en degrés
}

/**
 * Position contrainte du réticule.
 * - Grille seule : intersection de grille la plus proche.
 * - Calage (s'il y a un dernier point) : projection sur la direction multiple de `pasAngle` la plus proche.
 * - Les deux : le calage l'emporte ; sous 45° le réticule reste sur une ligne verticale de la grille,
 *   au-delà sur une ligne horizontale (aide d'origine, « Calage angulaire - Grille »).
 */
export function contraindre(brut: Pt, opts: { grille: Grille | null; dernier: Pt | null; pasAngle: number | null }): Contrainte {
  const { grille, dernier, pasAngle } = opts;
  if (dernier && pasAngle && dist(brut, dernier) > EPS) {
    const brutAngle = (Math.atan2(brut.y - dernier.y, brut.x - dernier.x) * 180) / Math.PI;
    const angle = Math.round(brutAngle / pasAngle) * pasAngle;
    const rad = (angle * Math.PI) / 180;
    const ux = Math.cos(rad);
    const uy = Math.sin(rad);
    const t = (brut.x - dernier.x) * ux + (brut.y - dernier.y) * uy;
    let p = { x: dernier.x + t * ux, y: dernier.y + t * uy };
    let logo: LogoGrille = 'libre';
    if (grille) {
      const pente = Math.abs(((angle % 180) + 180) % 180); // 0..180
      const proche = pente < 45 || pente > 135; // plutôt horizontale
      if (proche && Math.abs(ux) > EPS) {
        const x = arrondi(p.x, grille.origine.x, grille.pas);
        p = { x, y: dernier.y + ((x - dernier.x) / ux) * uy };
        logo = 'verticale';
      } else if (Math.abs(uy) > EPS) {
        const y = arrondi(p.y, grille.origine.y, grille.pas);
        p = { x: dernier.x + ((y - dernier.y) / uy) * ux, y };
        logo = 'horizontale';
      }
    }
    return { p: nettoyer(p), grille: logo, cale: true, angle: ((angle % 360) + 360) % 360 };
  }
  if (grille) return { p: surGrille(brut, grille), grille: 'intersection', cale: false, angle: null };
  return { p: brut, grille: 'libre', cale: false, angle: null };
}

/** Supprime les erreurs d'arrondi (ex. 9.999999999 -> 10) à 1e-9 mm près. */
function nettoyer(p: Pt): Pt {
  const n = (v: number) => {
    const r = Math.round(v * 1e6) / 1e6;
    return Math.abs(r - v) < 1e-9 ? r : v;
  };
  return { x: n(p.x), y: n(p.y) };
}

// ---------------------------------------------------------------- Repérage

export type TypePoint = 'extremite' | 'milieu' | 'intersection' | 'perpendiculaire';

export interface PointCaracteristique {
  p: Pt;
  type: TypePoint;
}

/**
 * Point repéré : le plus proche de `cible` dans le rayon. `rang` > 0 donne le suivant
 * (nouvel appui sur Ctrl sans bouger le réticule). Les doublons sont fusionnés,
 * en gardant le type le plus parlant (intersection > perpendiculaire > milieu > extrémité).
 */
export function reperer(candidats: PointCaracteristique[], cible: Pt, rayon: number, rang = 0): PointCaracteristique | null {
  const priorite: Record<TypePoint, number> = { intersection: 0, perpendiculaire: 1, milieu: 2, extremite: 3 };
  const uniques: PointCaracteristique[] = [];
  for (const c of candidats) {
    if (dist(c.p, cible) > rayon) continue;
    const dejà = uniques.findIndex((u) => dist(u.p, c.p) < 1e-6);
    if (dejà < 0) uniques.push(c);
    else if (priorite[c.type] < priorite[uniques[dejà].type]) uniques[dejà] = c;
  }
  if (uniques.length === 0) return null;
  uniques.sort((u, v) => dist(u.p, cible) - dist(v.p, cible) || priorite[u.type] - priorite[v.type]);
  return uniques[rang % uniques.length];
}

// ---------------------------------------------------------------- Affichage des nombres

/** Nombre avec au plus `decimales` décimales, sans zéros inutiles (réglage d'origine : 3 décimales max). */
export function nombre(v: number, decimales = 3): string {
  const r = Number(v.toFixed(decimales));
  return (Object.is(r, -0) ? 0 : r).toString();
}

/** Lit un nombre tapé au clavier (virgule ou point). Renvoie null si ce n'est pas un nombre. */
export function lireNombre(texte: string): number | null {
  const t = texte.trim().replace(',', '.');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  return Number(t);
}
