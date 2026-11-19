// Images (cases B1 à B4), sans DOM (testé dans test/images.test.ts).
// Une image est une entité : un cadre (trait invisible, jamais imprimé) qui sert à la désigner et à la
// transformer, son point de référence (coin supérieur droit, aide d'origine) et le coin inférieur gauche.
// Ses octets sont gardés avec le dessin (comme l'original depuis 2006), avec le lien au fichier lu.
import type { Entite } from './dessin';
import type { Pt } from './geometrie';
import type { Primitive } from './primitives';

/** Plans d'affichage : arrière-plan (fond de plan), plan général (avec les tracés), premier plan (masque). */
export const PLANS = [
  { cle: 'arriere', nom: 'arrière-plan' },
  { cle: 'general', nom: 'plan général' },
  { cle: 'premier', nom: 'premier plan' },
] as const;
export type Plan = (typeof PLANS)[number]['cle'];

/** Une image gardée avec le dessin. */
export interface ImageStockee {
  /** Contenu, en « data URL » (data:image/png;base64,…). */
  donnees: string;
  /** Chemin du fichier lu (le lien, pour les mises à jour). */
  fichier: string;
  /** Date de modification du fichier lu (ms depuis 1970). */
  date: number;
  /** Taille du fichier (octets). */
  taille: number;
  /** Dimensions en pixels. */
  px: [number, number];
}

/**
 * Une image gardée dans un dessin doit être une « data URL » base64 d'un type d'image connu, et rien d'autre :
 * un dessin falsifié pourrait sinon y glisser du balisage (SVG, HTML) qui ressortirait dans l'aperçu. On rejette
 * tout ce qui n'est pas exactement `data:image/<type>;base64,<base64>` (sécurité : voir svgFeuille et l'aperçu).
 */
export function donneeImageValide(s: string): boolean {
  return /^data:image\/(png|jpe?g|gif|bmp|webp|x-icon|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/.test(s);
}

/** Résolution supposée d'une image sans indication (pixels par pouce). */
export const PPP = 96;

/** Dimensions « papier » d'une image : 96 pixels par pouce, réduite pour tenir dans les 3/4 du format. */
export function dimensionsPapier(px: [number, number], format: { largeur: number; hauteur: number }): [number, number] {
  let l = (px[0] * 25.4) / PPP;
  let h = (px[1] * 25.4) / PPP;
  const k = Math.min(1, (0.75 * format.largeur) / l, (0.75 * format.hauteur) / h);
  l *= k;
  h *= k;
  return [l, h];
}

const cadre = (bg: Pt, hd: Pt): Primitive[] => {
  const p = [bg, { x: hd.x, y: bg.y }, hd, { x: bg.x, y: hd.y }];
  return p.map((q, i) => ({ type: 'segment' as const, a: q, b: p[(i + 1) % 4] }));
};

/** L'entité d'une image : référence = coin supérieur droit ; largeur et hauteur en mm. */
export function entiteImage(id: string, ref: Pt, largeur: number, hauteur: number, plan: Plan, niveau: number, nom = ''): Entite {
  const bg = { x: ref.x - largeur, y: ref.y - hauteur };
  return {
    genre: 'image',
    primitives: cadre(bg, ref),
    extras: [
      { p: { ...ref }, type: 'extremite' },
      { p: bg, type: 'extremite' },
    ],
    niveau,
    trait: 'invisible',
    params: { image: id, largeur, hauteur, plan, ...(nom ? { nom } : {}) },
  };
}

/** Coins d'une image : bas gauche et haut droit. */
export function coinsImage(e: Entite): { bg: Pt; hd: Pt } | null {
  if (e.genre !== 'image' || !e.extras[0]) return null;
  const l = Number(e.params?.largeur) || 0;
  const h = Number(e.params?.hauteur) || 0;
  const hd = e.extras[0].p;
  return { bg: { x: hd.x - l, y: hd.y - h }, hd };
}

/**
 * Image après une transformation : elle reste droite (angle 0, aide d'origine) ; seule sa position suit
 * (le point de référence transformé), et sa taille suit le rapport d'une homothétie.
 */
export function refaireImage(e: Entite, ref: Pt, k: number): Entite {
  const l = (Number(e.params?.largeur) || 0) * Math.abs(k);
  const h = (Number(e.params?.hauteur) || 0) * Math.abs(k);
  const n = entiteImage(String(e.params?.image ?? ''), ref, l, h, planDe(e), e.niveau, String(e.params?.nom ?? ''));
  return { ...n, ...(e.couleur !== undefined ? { couleur: e.couleur } : {}), ...(e.calque ? { calque: e.calque } : {}) };
}

export const planDe = (e: Entite): Plan => (PLANS.some((p) => p.cle === e.params?.plan) ? (e.params!.plan as Plan) : 'general');

/** L'image dont le cadre contient le point (la dernière posée d'abord). */
export function imageEn(entites: readonly Entite[], p: Pt): Entite | null {
  for (let i = entites.length - 1; i >= 0; i--) {
    const c = coinsImage(entites[i]);
    if (c && p.x >= c.bg.x && p.x <= c.hd.x && p.y >= c.bg.y && p.y <= c.hd.y) return entites[i];
  }
  return null;
}

/** Identifiant d'une image : court, tiré du contenu (la même image lue deux fois n'est gardée qu'une fois). */
export function identifiantImage(donnees: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < donnees.length; i++) {
    const c = donnees.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 + c, 2246822519) ^ (h2 >>> 13);
  }
  return `I${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}

/** Type MIME d'après l'extension du fichier. */
export function typeImage(nom: string): string | null {
  const ext = nom.toLowerCase().split('.').pop() ?? '';
  const types: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    ico: 'image/x-icon',
    svg: 'image/svg+xml',
  };
  return types[ext] ?? null;
}

/** État du lien au fichier : à jour, mise à jour disponible (fichier plus récent), fichier absent. */
export function etatLien(img: ImageStockee, fichier: { existe: boolean; date: number } | null): 'ok' | 'mise-a-jour' | 'absent' {
  if (!fichier?.existe) return 'absent';
  return fichier.date > img.date + 1000 ? 'mise-a-jour' : 'ok';
}
