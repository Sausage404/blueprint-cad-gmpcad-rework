// Icônes redessinées (source : docs/maquette/icons.py, exportées par `npm run icons`).
import data from './icons.json';

export const BASE_ICONS: string[][] = data.base;
export const BASE_LABELS: string[][] = data.baseLabels;
export const LEFT_ICONS: Record<string, string> = data.left;
export const UI_ICONS: Record<string, string> = data.ui;

/** SVG 24 x 24 en traits `currentColor`. Les points à désigner prennent la couleur `--fam`. */
export function svg(body: string, size: number, strokeWidth = 1.6): string {
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
  );
}
