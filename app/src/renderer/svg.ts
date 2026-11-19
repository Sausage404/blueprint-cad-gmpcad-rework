// Image SVG de la feuille, en millimètres réels, pour l'impression et l'export PDF à l'échelle exacte.
// Traits noirs ; épaisseurs ISO : 0,5 mm pour le trait fort, 0,25 mm pour les traits fins.
import type { Entite, Trait } from './dessin';
import type { Format } from './formats';
import { norm, surCercle, type Primitive } from './primitives';
import { TRAITS } from './traits';
import { coinsImage, planDe } from './images';

const EPAISSEUR = (t: Trait) => (TRAITS[t]?.fort ? 0.5 : 0.25);
const TIRETS = (t: Trait) => TRAITS[t]?.papier ?? '';
const n = (v: number) => (Math.round(v * 1000) / 1000).toString();
const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const echapperAttr = (t: string) => echapper(t).replace(/"/g, '&quot;');

/**
 * Image SVG de la feuille. `images` donne le contenu des images (data URL) : elles sont placées sous les
 * tracés (arrière-plan, plan général) ou par-dessus (premier plan).
 */
export function svgFeuille(entites: readonly Entite[], format: Format, images?: (id: string) => string | undefined): string {
  const H = format.hauteur;
  const dessous: string[] = [];
  const dessus: string[] = [];
  // Le dessin a l'axe Y vers le haut, le SVG vers le bas : y écran = H - y.
  const Y = (y: number) => n(H - y);
  const formes: string[] = [];
  const textes: string[] = [];
  for (const e of entites) {
    if ((e.genre === 'groupe' && e.params?.vide) || e.genre === 'jointe') continue; // repères d'écran seulement
    if (e.genre === 'image') {
      const c = coinsImage(e);
      const href = images?.(String(e.params?.image ?? ''));
      if (c && href) {
        const el = `<image href="${echapperAttr(href)}" x="${n(c.bg.x)}" y="${Y(c.hd.y)}" width="${n(c.hd.x - c.bg.x)}" height="${n(c.hd.y - c.bg.y)}" preserveAspectRatio="none"/>`;
        (planDe(e) === 'premier' ? dessus : dessous).push(el);
      }
      continue;
    }
    e.primitives.forEach((p, i) => {
      const trait = e.styles?.[i]?.trait ?? e.trait;
      if (trait === 'invisible') return; // jamais imprimé
      const style = `stroke-width="${EPAISSEUR(trait)}"${TIRETS(trait) ? ` stroke-dasharray="${TIRETS(trait)}"` : ''}`;
      const d = chemin(p, Y, format);
      if (d) formes.push(`<path d="${d}" ${style}/>`);
      if (p.type === 'texte') {
        const ancre = p.alignH === 'centre' ? 'middle' : p.alignH === 'droite' ? 'end' : 'start';
        const base = p.alignV === 'haut' ? 'hanging' : p.alignV === 'milieu' ? 'middle' : p.alignV === 'bas' ? 'text-after-edge' : 'alphabetic';
        textes.push(
          `<text transform="translate(${n(p.p.x)} ${Y(p.p.y)}) rotate(${n(-p.angle)})" font-size="${n(p.h / 0.716)}" ` +
            `text-anchor="${ancre}" dominant-baseline="${base}">${echapper(p.texte)}</text>`,
        );
      }
    });
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${format.largeur}mm" height="${H}mm" viewBox="0 0 ${format.largeur} ${H}">` +
    dessous.join('') +
    `<g fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round">${formes.join('')}</g>` +
    `<g fill="#000" font-family="Arial, Helvetica, sans-serif">${textes.join('')}</g>` +
    dessus.join('') +
    '</svg>'
  );
}

function chemin(p: Primitive, Y: (y: number) => string, f: Format): string | null {
  switch (p.type) {
    case 'segment':
      return `M${n(p.a.x)} ${Y(p.a.y)}L${n(p.b.x)} ${Y(p.b.y)}`;
    case 'droite':
    case 'demi-droite': {
      // Prolongée jusqu'au-delà de la feuille.
      const l = Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y);
      if (l === 0) return null;
      const k = 2 * (f.largeur + f.hauteur);
      const ux = (p.b.x - p.a.x) / l;
      const uy = (p.b.y - p.a.y) / l;
      const debut = p.type === 'droite' ? { x: p.a.x - ux * k, y: p.a.y - uy * k } : p.a;
      return `M${n(debut.x)} ${Y(debut.y)}L${n(p.a.x + ux * k)} ${Y(p.a.y + uy * k)}`;
    }
    case 'cercle':
      return `M${n(p.c.x - p.r)} ${Y(p.c.y)}a${n(p.r)} ${n(p.r)} 0 1 0 ${n(2 * p.r)} 0a${n(p.r)} ${n(p.r)} 0 1 0 ${n(-2 * p.r)} 0`;
    case 'arc': {
      const a = surCercle(p.c, p.r, p.debut);
      const b = surCercle(p.c, p.r, p.fin);
      const ouverture = norm(p.fin - p.debut) || 360;
      // Sens trigonométrique dans le dessin = sens inverse des aiguilles dans le SVG (axe Y retourné) : sweep 0.
      return `M${n(a.x)} ${Y(a.y)}A${n(p.r)} ${n(p.r)} 0 ${ouverture > 180 ? 1 : 0} 0 ${n(b.x)} ${Y(b.y)}`;
    }
    case 'point':
      return `M${n(p.p.x - 0.5)} ${Y(p.p.y)}h1M${n(p.p.x)} ${Y(p.p.y - 0.5)}v-1`;
    case 'texte':
      return null;
  }
}
