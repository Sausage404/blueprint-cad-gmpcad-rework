// Icônes de la palette MECA, dessinées à partir des fonctions de tracé elles-mêmes (le symbole de la case
// est celui qu'elle dessine), ramenées dans un carré de 24 x 24 (y vers le bas).
import type { Primitive } from './primitives';
import { surCercle } from './primitives';
import { etatSurface, surfaceReference, symboleTolerance, trouLisse, trouTaraude, trouTaraudeDessus } from './meca-symboles';
import { SYMBOLES_CASES } from './fonctions-meca';
import { cartouche, PIECES } from './bibliotheque';
import { valeursParDefaut } from './fonctions-bibliotheque';
import type { Pt } from './geometrie';

/** SVG (corps) d'une liste de primitives, cadrée dans 24 x 24 avec une marge. */
export function iconeDePrimitives(prims: Primitive[], marge = 2.5, cadre?: { min: Pt; max: Pt }): string {
  const pts = prims.flatMap((p): Pt[] =>
    p.type === 'segment' || p.type === 'droite' || p.type === 'demi-droite' ? [p.a, p.b] : p.type === 'cercle' || p.type === 'arc' ? [{ x: p.c.x - p.r, y: p.c.y - p.r }, { x: p.c.x + p.r, y: p.c.y + p.r }] : [p.p],
  );
  if (pts.length === 0) return '';
  const min = cadre?.min ?? { x: Math.min(...pts.map((p) => p.x)), y: Math.min(...pts.map((p) => p.y)) };
  const max = cadre?.max ?? { x: Math.max(...pts.map((p) => p.x)), y: Math.max(...pts.map((p) => p.y)) };
  const k = (24 - 2 * marge) / Math.max(max.x - min.x, max.y - min.y, 1e-9);
  const ox = (24 - (max.x - min.x) * k) / 2;
  const oy = (24 - (max.y - min.y) * k) / 2;
  const X = (x: number) => +(ox + (x - min.x) * k).toFixed(2);
  const Y = (y: number) => +(24 - oy - (y - min.y) * k).toFixed(2);
  return prims
    .map((p) => {
      switch (p.type) {
        case 'segment':
        case 'droite':
        case 'demi-droite':
          return `<path d="M${X(p.a.x)} ${Y(p.a.y)}L${X(p.b.x)} ${Y(p.b.y)}"/>`;
        case 'cercle':
          return `<circle cx="${X(p.c.x)}" cy="${Y(p.c.y)}" r="${+(p.r * k).toFixed(2)}"/>`;
        case 'arc': {
          const a = surCercle(p.c, p.r, p.debut);
          const b = surCercle(p.c, p.r, p.fin);
          const o = (((p.fin - p.debut) % 360) + 360) % 360 || 360;
          return `<path d="M${X(a.x)} ${Y(a.y)}A${+(p.r * k).toFixed(2)} ${+(p.r * k).toFixed(2)} 0 ${o > 180 ? 1 : 0} 0 ${X(b.x)} ${Y(b.y)}"/>`;
        }
        case 'texte':
          return `<text x="${X(p.p.x)}" y="${Y(p.p.y)}" font-size="${Math.max(5, +(p.h * k).toFixed(1))}" font-family="Arial, sans-serif" font-weight="700" fill="currentColor" stroke="none" text-anchor="middle" dominant-baseline="middle">${p.texte}</text>`;
        case 'point':
          return '';
      }
    })
    .join('');
}

const T = (x: number, y: number, s: string, taille = 7) =>
  `<text x="${x}" y="${y}" font-size="${taille}" font-family="Arial, sans-serif" font-weight="700" fill="currentColor" stroke="none" text-anchor="middle">${s}</text>`;
const fleche = (x1: number, y1: number, x2: number, y2: number) => {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d: number) => `${(x2 - 3 * Math.cos(a + d)).toFixed(1)} ${(y2 - 3 * Math.sin(a + d)).toFixed(1)}`;
  return `<path d="M${x1} ${y1}L${x2} ${y2}M${p(0.4)}L${x2} ${y2}L${p(-0.4)}"/>`;
};
const P = (x: number, y: number): Pt => ({ x, y });

export const ICONES_MECA: Record<string, string> = {
  ...Object.fromEntries(Object.entries(SYMBOLES_CASES).map(([code, sym]) => [code, iconeDePrimitives(symboleTolerance(sym, P(0, 0), 24), 3)])),
  G09: `<circle cx="8" cy="8" r="5"/>${T(8, 10.5, 'P', 7)}<circle cx="16" cy="16" r="5"/>${T(16, 18.5, 'E', 7)}`,
  G10: `<path d="M3 21V4M3 21h18"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="16" cy="14" r="1.2" fill="currentColor"/><path d="M9 9h-6M16 14h-13M9 9v12M16 14v7" stroke-dasharray="1.5 1.5"/>`,
  G11: iconeDePrimitives(trouTaraude(P(0, 0), P(1, 0), 10, 15, 20, false).map((t) => t.prim)),
  G12: iconeDePrimitives(trouTaraude(P(0, 0), P(1, 0), 10, 22, 22, true).map((t) => t.prim)),
  G13: `${fleche(4, 19, 4, 4)}${fleche(7, 20, 21, 20)}<path d="M9 16L20 5"/>`,
  G14: `<path d="M4 4v6M20 4v6M4 17v4M12 13v8M20 17v4"/>${fleche(4, 7, 20, 7)}${fleche(4, 15, 12, 15)}${fleche(12, 19, 20, 19)}`,
  G15: `${fleche(4, 15, 13, 15)}${fleche(13, 19, 20, 19)}<path d="M6 9a6 6 0 0 1 11-3"/>${fleche(15.5, 4, 17.5, 6.5)}`,
  H07: iconeDePrimitives(surfaceReference(P(0, 0), P(1, 0), P(0, 8), 'A', 3)),
  H08: iconeDePrimitives(etatSurface(P(0, 0), P(1, 0), P(0, 5), 2, '', 3).concat([{ type: 'segment', a: P(-6, 0), b: P(10, 0) }])),
  H09: `<rect x="5" y="7" width="14" height="9"/>${T(12, 14, '12', 7)}<path d="M2 20h20M2 18v4M22 18v4" stroke-width="0.8"/>`,
  H10: `${T(9, 10, 'H8', 7.5)}${T(15, 20, 'g6', 7.5)}`,
  H11: iconeDePrimitives(trouTaraudeDessus(P(0, 0), 10).map((t) => t.prim)),
  H12: iconeDePrimitives(trouLisse(P(0, 0), P(1, 0), 10, 18).map((t) => t.prim)),
  H13: `<path d="M4 4v16M20 4v16"/>${fleche(4, 12, 20, 12)}<path d="M4 13.5h14"/>${T(12, 9, 'a', 7)}`,
  H14: `${T(12, 10, 'A=±', 7.5)}${fleche(3, 17, 21, 17)}<path d="M3 18.5h16"/>`,
  H15: `${T(12, 10, 'a=?', 7.5)}<path d="M3 14v6M21 14v6"/>${fleche(3, 17, 21, 17)}`,
};

/**
 * Pièce en deux demi-coupes séparées par l'alésage (roulements, joints, bagues) : l'icône ne garde que la moitié
 * du dessus, plus lisible à cette taille.
 */
function pourIcone(prims: Primitive[]): Primitive[] {
  const ys = (p: Primitive): number[] => {
    if (p.type === 'arc') {
      const o = (((p.fin - p.debut) % 360) + 360) % 360 || 360;
      return [0, 0.5, 1].map((k) => surCercle(p.c, p.r, p.debut + o * k).y);
    }
    return p.type === 'segment' || p.type === 'droite' || p.type === 'demi-droite' ? [p.a.y, p.b.y] : p.type === 'cercle' ? [p.c.y - p.r, p.c.y + p.r] : [p.p.y, p.p.y];
  };
  const max = Math.max(...prims.flatMap(ys).map(Math.abs));
  const separe = prims.every((p) => ys(p).every((y) => Math.abs(y) > 0.12 * max && Math.sign(y) === Math.sign(ys(p)[0])));
  return separe ? prims.filter((p) => ys(p)[0] > 0) : prims;
}

/** Icônes de la bibliothèque : chaque pièce dessinée avec ses dimensions par défaut. */
export const ICONES_BIBLIOTHEQUE: Record<string, string> = {
  ...Object.fromEntries(PIECES.map((p) => [p.code, iconeDePrimitives(pourIcone(p.dessin(valeursParDefaut(p)).filter((t) => t.s !== 'h' && t.s !== 'a').map((t) => t.p).filter((x) => x.type !== 'texte')), 2)])),
  T14: iconeDePrimitives(cartouche({}).map((t) => t.p).filter((x) => x.type !== 'texte'), 1.5),
  T15: iconeDePrimitives(cartouche({}, [{ rep: '', nb: '', designation: '', reference: '' }]).map((t) => t.p).filter((x) => x.type !== 'texte'), 1.5),
};
