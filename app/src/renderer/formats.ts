// Formats de plan (cahier des charges, section 8). L'original affiche « A1H (840x594) ».
import { dansArc, surCercle, type Primitive } from './primitives';

export interface Format {
  nom: string; // ex. « A4H »
  largeur: number; // mm
  hauteur: number; // mm
  marge: number; // distance du cadre intérieur au bord de la feuille, en mm
}

// Cadre intérieur mesuré sur les captures : 5 mm en A4H (capture 01), environ 10 mm en A1H (capture 02a).
// A0, A2 et A3 : à vérifier dans l'original.
const BASE: [string, number, number, number][] = [
  ['A0', 1189, 841, 10],
  ['A1', 840, 594, 10],
  ['A2', 594, 420, 5],
  ['A3', 420, 297, 5],
  ['A4', 297, 210, 5],
];

export const FORMATS: Format[] = BASE.flatMap(([n, l, h, m]) => [
  { nom: `${n}H`, largeur: l, hauteur: h, marge: m },
  { nom: `${n}V`, largeur: h, hauteur: l, marge: m },
]);

export function format(nom: string): Format {
  const f = FORMATS.find((x) => x.nom === nom);
  if (!f) throw new Error(`Format inconnu : ${nom}`);
  return f;
}

type Zone = { min: { x: number; y: number }; max: { x: number; y: number } };

/**
 * Étendue réelle des entités : bouts des segments, arcs au plus juste, cercles, points d'insertion des textes.
 * Les droites infinies ne comptent pas. Null pour un dessin vide.
 */
export function etendueEntites(entites: readonly { primitives: readonly Primitive[] }[]): Zone | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const ajouter = (p: { x: number; y: number }) => {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    x0 = Math.min(x0, p.x), y0 = Math.min(y0, p.y), x1 = Math.max(x1, p.x), y1 = Math.max(y1, p.y);
  };
  for (const e of entites)
    for (const p of e.primitives) {
      if (p.type === 'segment') ajouter(p.a), ajouter(p.b);
      else if (p.type === 'cercle') for (const a of [0, 90, 180, 270]) ajouter(surCercle(p.c, p.r, a));
      else if (p.type === 'arc') {
        ajouter(surCercle(p.c, p.r, p.debut)), ajouter(surCercle(p.c, p.r, p.fin));
        for (const a of [0, 90, 180, 270]) if (dansArc(a, p.debut, p.fin)) ajouter(surCercle(p.c, p.r, a));
      } else if (p.type === 'texte' || p.type === 'point') ajouter(p.p);
    }
  return x0 <= x1 ? { min: { x: x0, y: y0 }, max: { x: x1, y: y1 } } : null;
}

/**
 * Format d'un dessin lu : celui des limites du DXF s'il correspond à un format connu (à 2 mm près),
 * sinon le plus petit format qui contient le dessin (son étendue réelle), sinon A4H.
 */
export function formatPour(limites: { min: { x: number; y: number }; max: { x: number; y: number } } | null, etendue: typeof limites): Format {
  if (limites) {
    const l = limites.max.x - limites.min.x;
    const h = limites.max.y - limites.min.y;
    const f = FORMATS.find((x) => Math.abs(x.largeur - l) <= 2 && Math.abs(x.hauteur - h) <= 2);
    if (f) return f;
  }
  const zone = etendue ?? limites;
  if (zone) {
    const l = zone.max.x;
    const h = zone.max.y;
    const candidats = FORMATS.filter((x) => x.largeur >= l && x.hauteur >= h && (l >= h) === x.nom.endsWith('H'));
    candidats.sort((a, b) => a.largeur * a.hauteur - b.largeur * b.hauteur);
    if (candidats[0]) return candidats[0];
  }
  return format('A4H');
}
