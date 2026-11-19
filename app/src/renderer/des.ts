// Lecture directe des dessins GMPCAD (.des), sans le convertisseur d'origine.
//
// Format compris en comparant les 5 dessins d'exemple avec leur conversion DXF (aucun programme d'origine
// n'a été décompilé) :
// - fichier « séquentiel non formaté » de Microsoft FORTRAN : octet 0x4B au début, enregistrements découpés
//   en blocs de 128 octets au plus, chacun encadré par son octet de longueur (0x81 = bloc de 128 octets suivi
//   d'un autre bloc du même enregistrement), 0x82 à la fin ;
// - chaque élément : un enregistrement de 4 octets [type, niveau, nombre de points, nombre de valeurs],
//   puis un enregistrement de flottants 32 bits (les points x, y, puis les valeurs) ;
// - en-tête : format du plan (largeur, hauteur) et unité ; coordonnées depuis le centre de la feuille ;
// - textes en page de code DOS 850, chaînes terminées par « # » dans l'en-tête.
//
// Lus : segments, points, cercles et arcs, arcs d'ellipse, rectangles, traits d'axe, polylignes, textes,
// groupes (cartouche, éléments de bibliothèque) avec leur placement ; et l'habillage que GMPCAD calculait à
// l'affichage, redessiné (des-habillage.ts) : cotes, flèches, repères, flèches de coupe, états de surface,
// taraudages, hachures.
import type { Entite, Genre, Trait } from './dessin';
import type { ResultatDxf } from './dxf';
import { dist, type Pt } from './geometrie';

import { contourVersEst } from './contours';
import { arcEllipseDes, cote, flecheCoupeDes, flecheDes, rectangleDes, repereDes, reglageHachuresDes, rugositeDes, taraudageBoutDes, taraudageCoupeDes, type ElementDes } from './des-habillage';
import { transformerEntite } from './edition';
import { entiteHachures } from './hachures';
import { norm, type Primitive } from './primitives';
import { TRAITS_CONTOUR } from './traits';

const CP850 =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ';

/**
 * Les textes du dessin utilisent l'ancien codage français 7 bits (comme les messages de GMPCAD) :
 * { é, } è, @ à, \\ ç, | ù, ^ ê, ~ °, et $ pour le Ø de la police de GMPCAD.
 */
const FRANCAIS: Record<string, string> = { '{': 'é', '}': 'è', '@': 'à', '\\': 'ç', '|': 'ù', '^': 'ê', '~': '°', $: 'Ø' };
const texteDessin = (o: Uint8Array) => texte850(o).replace(/[{}@\\|^~$]/g, (c) => FRANCAIS[c] ?? c);

const texte850 = (o: Uint8Array) =>
  Array.from(o, (c) => (c >= 128 ? CP850[c - 128] : String.fromCharCode(c)))
    .join('')
    .replace(/#$/, '');

/**
 * Codes de trait de GMPCAD : 1 à 4 les traits des cases F11 à F14, 5 à 10 les traits spéciaux dans l'ordre de
 * la case F15 (relevé sur les conversions DXF : 8 donne la couche CACHE en type LIMIT_COUP, 10 la couche
 * HACHURES en pointillé, celle des traits invisibles qui ferment les contours de hachures).
 */
const TRAITS: Record<number, Trait> = {
  1: 'continu-fort',
  2: 'pointille-fin',
  3: 'mixte-fin',
  4: 'continu-fin',
  5: 'mixte-fort',
  6: 'mixte-fin-2',
  7: 'mixte-fin-3',
  8: 'limite-coupe',
  9: 'pointille-long',
  10: 'invisible',
};
const trait = (code: number | undefined): Trait => TRAITS[Math.round(code ?? 4)] ?? 'continu-fin';

/** Découpe un fichier MS-FORTRAN séquentiel non formaté en enregistrements. */
export function enregistrementsFortran(o: Uint8Array): Uint8Array[] {
  if (o[0] !== 0x4b) throw new Error("ce n'est pas un dessin GMPCAD (.des)");
  const out: Uint8Array[] = [];
  let morceaux: Uint8Array[] = [];
  let i = 1;
  while (i < o.length) {
    const L = o[i];
    if (L === 0x82) break;
    const n = L === 0x81 ? 128 : L;
    if (i + 1 + n >= o.length || o[i + 1 + n] !== L) throw new Error(`fichier .des abîmé (position ${i})`);
    morceaux.push(o.subarray(i + 1, i + 1 + n));
    i += n + 2;
    if (L !== 0x81) {
      const total = morceaux.reduce((s, m) => s + m.length, 0);
      const r = new Uint8Array(total);
      let p = 0;
      for (const m of morceaux) {
        r.set(m, p);
        p += m.length;
      }
      out.push(r);
      morceaux = [];
    }
  }
  return out;
}

const flottants = (r: Uint8Array): number[] => {
  const v = new DataView(r.buffer, r.byteOffset, r.byteLength);
  return Array.from({ length: Math.floor(r.length / 4) }, (_, k) => v.getFloat32(4 * k, true));
};

export interface ResultatDes extends ResultatDxf {
  /** Textes de l'en-tête (société, département, service, dessinateur, désignation, date…). */
  entete: string[];
}

export function lireDes(octets: Uint8Array): ResultatDes {
  const recs = enregistrementsFortran(octets);
  if (recs.length < 3 || recs[0].length !== 4) throw new Error('en-tête .des inconnu');
  // En-tête : n points (le cadre), puis code, largeur, hauteur, unité, et l'échelle de chacun des 100 niveaux.
  const n = recs[0][2];
  const h = flottants(recs[1]);
  const arrondi = (v: number) => Math.round(v * 1e6) / 1e6; // les flottants 32 bits : 0.05 lu 0.0500000007
  const unite = arrondi(h[2 * n + 3] || 1);
  // Échelles des niveaux 1 à 100 : 100 flottants à partir de la position 2n + 12.
  const echelles = Array.from({ length: 101 }, (_, niv) => (niv === 0 ? unite : arrondi(h[2 * n + 11 + niv] || unite)));
  // Le format est en unités du fichier (ex. 11880 x 8400 au 1/20 de mm).
  const largeur = Math.round(h[2 * n + 1] * unite * 100) / 100;
  const hauteur = Math.round(h[2 * n + 2] * unite * 100) / 100;
  if (!(largeur > 0 && hauteur > 0)) throw new Error('format du plan illisible');

  const entete: string[] = [];
  const ignores: Record<string, number> = {};
  const compter = (nom: string) => (ignores[nom] = (ignores[nom] ?? 0) + 1);

  // 1er passage : les éléments bruts, dans l'ordre du fichier (coordonnées en unités du fichier).
  interface Brut {
    type: number;
    niveau: number;
    pts: Pt[];
    v: number[];
    chaines: string[];
  }
  const bruts: Brut[] = [];
  let k = 2;
  while (k < recs.length) {
    const r = recs[k];
    const suivant = recs[k + 1];
    const estElement = r.length === 4 && suivant !== undefined && suivant.length === r[2] * 8 + r[3] * 4 && r[0] > 0 && r[0] < 64;
    if (!estElement) {
      if (r[r.length - 1] === 0x23) entete.push(texte850(r)); // chaîne de l'en-tête, terminée par #
      k++;
      continue;
    }
    const [type, niveau, np] = r;
    const f = flottants(suivant);
    k += 2;
    // Chaînes qui suivent un texte ou un repère.
    const chaines: string[] = [];
    if (type === 20 || (type >= 21 && type <= 27) || type === 31) {
      while (k < recs.length && !(recs[k].length === 4 && recs[k + 1] && recs[k + 1].length === recs[k][2] * 8 + recs[k][3] * 4)) {
        chaines.push(texteDessin(recs[k]));
        k++;
      }
    }
    bruts.push({ type, niveau: Math.max(1, niveau), pts: Array.from({ length: np }, (_, i) => ({ x: f[2 * i], y: f[2 * i + 1] })), v: f.slice(2 * np), chaines });
  }

  // Groupes (vignettes, cartouche, éléments de bibliothèque) : une définition (type 39) donne le nombre
  // d'éléments qui la suivent, en coordonnées locales ; son numéro est v[7] - 1. Un placement (type 38)
  // donne le point d'insertion, la rotation v[0], l'échelle v[1] et le numéro du groupe v[3].
  const groupes = new Map<number, Brut[]>();
  const dansGroupe = new Set<number>();
  bruts.forEach((b, i) => {
    if (b.type !== 39) return;
    const nb = Math.max(0, Math.round(b.v[8] ?? 0));
    groupes.set(Math.round(b.v[7] ?? 0) - 1, bruts.slice(i + 1, i + 1 + nb));
    for (let j = i + 1; j <= i + nb && j < bruts.length; j++) dansGroupe.add(j);
  });

  const ech = (niveau: number) => echelles[Math.min(niveau, 100)] || unite;
  const surFeuille = (p: Pt, e: number): Pt => ({ x: p.x * e + largeur / 2, y: p.y * e + hauteur / 2 });

  const entites: Entite[] = [];
  const hachures: { niveau: number; pts: Pt[]; v: number[] }[] = [];
  bruts.forEach((b, i) => {
    if (dansGroupe.has(i) || b.type === 39 || b.type === 4) return;
    if (b.type === 38) {
      const contenu = groupes.get(Math.round(b.v[3] ?? -1));
      const e = contenu && placerGroupe(contenu, b, surFeuille(b.pts[0], ech(b.niveau)), ech);
      if (e) entites.push(e);
      else compter('groupes');
      return;
    }
    if (b.type === 30) {
      hachures.push({ niveau: b.niveau, pts: b.pts.map((p) => surFeuille(p, ech(b.niveau))), v: b.v });
      return;
    }
    const e = element(b.type, b.niveau, b.pts.map((p) => surFeuille(p, ech(b.niveau))), b.v, b.chaines, ech(b.niveau), unite);
    if (e) entites.push(e);
    else compter(nomType(b.type));
  });

  // Hachures : refaites dans les contours fermés autour de leurs points intérieurs, quand tout est lu.
  for (const h of hachures) {
    const e = hachuresDes(h, entites);
    if (e) entites.push(e);
    else compter('hachures (contour non fermé)');
  }

  /** Un groupe placé : ses éléments, tournés, mis à l'échelle et déplacés au point d'insertion. */
  function placerGroupe(contenu: Brut[], placement: Brut, ins: Pt, echelle: (n: number) => number): Entite | null {
    const angle = placement.v[0] ?? 0;
    const k = placement.v[1] || 1;
    const a = (angle * Math.PI) / 180;
    const t = {
      m: (p: Pt) => ({ x: ins.x + k * (p.x * Math.cos(a) - p.y * Math.sin(a)), y: ins.y + k * (p.x * Math.sin(a) + p.y * Math.cos(a)) }),
      k,
      rot: angle,
      miroir: null,
    };
    const prims: Primitive[] = [];
    const styles: NonNullable<Entite['styles']> = [];
    for (const c of contenu) {
      // Coordonnées locales en mm, à l'échelle du niveau des définitions (le niveau 100).
      const e = element(c.type, c.niveau, c.pts.map((p) => ({ x: p.x * echelle(c.niveau), y: p.y * echelle(c.niveau) })), c.v, c.chaines, echelle(c.niveau), unite);
      if (!e) continue;
      const placee = transformerEntite(e, t);
      for (const p of placee.primitives) {
        prims.push(p);
        styles.push({ trait: placee.trait });
      }
    }
    if (prims.length === 0) return null;
    return { genre: 'groupe', primitives: prims, extras: [{ p: ins, type: 'milieu' }], niveau: Math.min(placement.niveau, 99), trait: 'continu-fort', styles };
  }

  return {
    entites,
    calques: new Map(),
    infos: null,
    images: new Map(),
    limites: { min: { x: 0, y: 0 }, max: { x: largeur, y: hauteur } },
    etendue: null,
    version: 'GMPCAD .des',
    ignores,
    entete,
  };
}

function nomType(t: number): string {
  if (t >= 21 && t <= 25) return 'cotes';
  return `éléments de type ${t}`;
}

/**
 * Un hachurage : pour chaque point désigné, le contour rencontré en premier vers l'Est, sur le niveau du
 * hachurage (règle de l'original) ; les contours se combinent en pair-impair (évidements).
 */
function hachuresDes(h: { niveau: number; pts: Pt[]; v: number[] }, entites: readonly Entite[]): Entite | null {
  const niveau = Math.min(h.niveau, 99);
  const prims = entites
    .filter((e) => e.niveau === niveau && e.genre !== 'hachure' && e.genre !== 'texte' && e.genre !== 'cote' && e.genre !== 'repere' && e.genre !== 'fleche')
    .flatMap((e) => e.primitives.filter((p, i) => p.type !== 'texte' && TRAITS_CONTOUR.includes(e.styles?.[i]?.trait ?? e.trait)));
  const contours = h.pts.map((p) => contourVersEst(prims, p)).filter((c): c is Pt[] => !!c);
  if (contours.length === 0) return null;
  const r = reglageHachuresDes({ type: 30, niveau: h.niveau, pts: h.pts, v: h.v, chaines: [], echelle: 1, reel: 1 });
  return entiteHachures(contours, h.pts, r, niveau);
}

function element(type: number, niveau: number, pts: Pt[], v: number[], chaines: string[], unite: number, uniteFichier = unite): Entite | null {
  const el: ElementDes = { type, niveau, pts, v, chaines, echelle: unite, reel: uniteFichier / (unite || 1) };
  const at = (t: Trait) => ({ niveau: Math.min(niveau, 99), trait: t, calque: niveau > 99 ? String(niveau) : undefined });
  const entite = (genre: Genre, prims: Primitive[], t: Trait): Entite => ({ genre, primitives: prims, extras: [], ...at(t) });
  switch (type) {
    case 1: // segment : 2 points, trait
      return entite('segment', [{ type: 'segment', a: pts[0], b: pts[1] }], trait(v[0]));
    case 2: // point
      return entite('point', [{ type: 'point', p: pts[0] }], 'continu-fin');
    case 6: {
      // cercle : centre + [angle de départ, rayon, ouverture, trait] ; arc : centre, départ, arrivée + idem
      const r = v[1] * unite;
      if (!(r > 0)) return null;
      const t = trait(v[3]);
      if (Math.abs(Math.abs(v[2]) - 360) < 1e-3) return entite('cercle', [{ type: 'cercle', c: pts[0], r }], t);
      const [debut, fin] = v[2] >= 0 ? [v[0], v[0] + v[2]] : [v[0] + v[2], v[0]];
      return entite('arc', [{ type: 'arc', c: pts[0], r, debut: norm(debut), fin: norm(fin) }], t);
    }
    case 11: {
      // traits d'axe perpendiculaires : centre, puis les 4 extrémités (droite, haut, bas, gauche)
      if (pts.length < 5) return null;
      const t = trait(v[1] ?? 3);
      return entite(
        'groupe',
        [
          { type: 'segment', a: pts[4], b: pts[1] },
          { type: 'segment', a: pts[3], b: pts[2] },
        ],
        t,
      );
    }
    case 13: {
      // polyligne ou courbe : n points, le dernier nombre est le trait. Pour une courbe lissée, le fichier ne
      // garde que les points de construction : on les relie par des segments (approximation).
      if (pts.length < 2) return null;
      const prims: Primitive[] = [];
      for (let i = 0; i + 1 < pts.length; i++) if (dist(pts[i], pts[i + 1]) > 1e-9) prims.push({ type: 'segment', a: pts[i], b: pts[i + 1] });
      return prims.length ? entite('polyligne', prims, trait(v[v.length - 1])) : null;
    }
    case 20: {
      // texte : point de départ + [angle, rang, longueur, hauteur, …], la chaîne suit
      const texte = chaines.join('').slice(0, Math.max(0, Math.round(v[2])) || undefined);
      if (!texte.trim()) return null;
      return entite('texte', [{ type: 'texte', p: pts[0], h: (v[3] || 3) * unite, angle: v[0] || 0, texte, alignH: 'gauche', alignV: 'ligne' }], 'continu-fort');
    }
    case 3:
      return flecheDes(el);
    case 7:
      return arcEllipseDes(el, trait(v[5] ?? 1));
    case 12:
      return rectangleDes(el, trait(v[2]));
    case 16:
      return taraudageBoutDes(el);
    case 18:
      return taraudageCoupeDes(el);
    case 21:
    case 23:
    case 24:
    case 25:
      return cote(el);
    case 26:
      return flecheCoupeDes(el);
    case 27:
      return rugositeDes(el);
    case 31:
      return repereDes(el);
    default:
      return null;
  }
}
