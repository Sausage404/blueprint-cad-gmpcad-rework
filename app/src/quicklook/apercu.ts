// Moteur de l'aperçu des plans hors du logiciel : le même lecteur DXF et .des, exécuté par JavaScriptCore
// dans les extensions Coup d'œil du Mac (app/quicklook), et par le moteur JavaScript de Windows dans
// l'extension de l'Explorateur (app/windows). Trois fonctions globales :
//   apercuSvg(contenu, des)    -> JSON { svg, largeur, hauteur } : la feuille en SVG (aperçu, barre d'espace)
//   apercuTraits(contenu, des) -> JSON { largeur, hauteur, forts, fins } : les traits (vignettes)
//   apercuTexte(contenu, des)  -> lignes de texte simples (Windows), voir plus bas
// `contenu` : les octets du fichier, un caractère par octet (Latin-1).
import { enSegments } from '../renderer/contours';
import { lireDes } from '../renderer/des';
import { lireDxf } from '../renderer/dxf';
import { formatPour } from '../renderer/formats';
import { svgFeuille } from '../renderer/svg';

/** Un DXF R2007 ou plus récent est en UTF-8, les plus anciens dans la page de code du système. */
function texteDxf(octets: string): string {
  const m = /\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*AC(\d{4})/.exec(octets.slice(0, 4000));
  if (!m || Number(m[1]) < 1021) return octets;
  try {
    return decodeURIComponent(escape(octets));
  } catch {
    return octets;
  }
}

function lire(contenu: string, des: boolean) {
  const r = des ? lireDes(Uint8Array.from(contenu, (c) => c.charCodeAt(0))) : lireDxf(texteDxf(contenu));
  return { entites: r.entites, format: formatPour(r.limites, r.etendue), images: r.images };
}

const arrondi = (v: number) => Math.round(v * 100) / 100;

function apercuSvg(contenu: string, des: boolean): string {
  try {
    const { entites, format, images } = lire(contenu, des);
    return JSON.stringify({ svg: svgFeuille(entites, format, (id) => images.get(id)?.donnees), largeur: format.largeur, hauteur: format.hauteur });
  } catch (e) {
    return JSON.stringify({ erreur: String(e) });
  }
}

function apercuTraits(contenu: string, des: boolean): string {
  try {
    const { entites, format } = lire(contenu, des);
    const forts: number[] = [];
    const fins: number[] = [];
    for (const e of entites) {
      e.primitives.forEach((p, i) => {
        const liste = (e.styles?.[i]?.trait ?? e.trait) === 'continu-fort' ? forts : fins;
        for (const [a, b] of enSegments(p)) liste.push(arrondi(a.x), arrondi(a.y), arrondi(b.x), arrondi(b.y));
      });
    }
    return JSON.stringify({ largeur: format.largeur, hauteur: format.hauteur, forts, fins });
  } catch (e) {
    return JSON.stringify({ erreur: String(e) });
  }
}

/**
 * Pour l'Explorateur de Windows, sans JSON à décoder : une ligne par élément, valeurs séparées par des
 * tabulations. « P largeur hauteur » (la feuille, en premier), « F x1 y1 x2 y2 » (trait fort),
 * « f x1 y1 x2 y2 » (trait fin), « T x y hauteur angle alignement texte » (alignement : g, c ou d).
 * En cas d'erreur : « E message ».
 */
function apercuTexte(contenu: string, des: boolean): string {
  try {
    const { entites, format } = lire(contenu, des);
    const l: string[] = [`P\t${arrondi(format.largeur)}\t${arrondi(format.hauteur)}`];
    for (const e of entites) {
      if ((e.genre === 'groupe' && e.params?.vide) || e.genre === 'jointe' || e.genre === 'image') continue;
      e.primitives.forEach((p, i) => {
        const trait = e.styles?.[i]?.trait ?? e.trait;
        if (trait === 'invisible') return;
        if (p.type === 'texte') {
          const texte = p.texte.replace(/[\t\r\n]/g, ' ');
          if (texte.trim()) l.push(`T\t${arrondi(p.p.x)}\t${arrondi(p.p.y)}\t${arrondi(p.h)}\t${arrondi(p.angle)}\t${p.alignH[0]}${p.alignV[0]}\t${texte}`);
          return;
        }
        const t = trait === 'continu-fort' || trait === 'mixte-fort' ? 'F' : 'f';
        for (const [a, b] of enSegments(p)) l.push(`${t}\t${arrondi(a.x)}\t${arrondi(a.y)}\t${arrondi(b.x)}\t${arrondi(b.y)}`);
      });
    }
    return l.join('\n');
  } catch (e) {
    return `E\t${String(e)}`;
  }
}

Object.assign(globalThis, { apercuSvg, apercuTraits, apercuTexte });
