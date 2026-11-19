// Réglage de la cotation (case F4, Options > Cotation) : système, unité, décimales, hauteurs d'écriture,
// et l'échelle du niveau de travail (case F20) par laquelle les longueurs mesurées sont divisées.
// Un seul réglage pour tout le poste, lu au moment où une cote est créée.
//
// Les quatre systèmes de l'original (aide, « Option : cotation ») :
// - AFNOR : écriture alignée sur la ligne de cote, unité au choix (mm par défaut) ;
// - ISO : comme AFNOR, avec en plus l'écriture horizontale (cotation unidirectionnelle) ;
// - ANSI : en pouces, décimal (.492) ou fractionnaire (3 1/4) ; les longueurs tapées au clavier sont en
//   pouces (suffixe M pour des millimètres : 34.5M) ;
// - ARCHI : à partir d'un mètre, en m avec 2 décimales ; en dessous, en cm avec une décimale au plus,
//   écrite en exposant (45⁵) ; extrémités en traits obliques au lieu de flèches.
// Changer de système transforme les cotes déjà faites (voir convertirCotes).
import type { Entite } from './dessin';
import { nombre, type Pt } from './geometrie';
import { angleDe, surCercle, type Primitive } from './primitives';

export type SystemeCotation = 'AFNOR' | 'ISO' | 'ANSI' | 'ARCHI';
export type UniteCotation = 'mm' | 'cm' | 'm';

export interface ReglageCotation {
  systeme: SystemeCotation;
  unite: UniteCotation;
  /** Nombre de décimales au plus. */
  decimales: number;
  /** Hauteur des écritures de cotes (mm). */
  hauteur: number;
  /** Hauteur des écritures des repères (mm). */
  hauteurRepere: number;
  /** ISO et ANSI : les textes de cote restent horizontaux (en AFNOR et ARCHI : alignés sur la ligne de cote). */
  unidirectionnelle: boolean;
  /** ANSI : valeurs en fractions de pouce (au 1/64). */
  fractionnaire: boolean;
}

export const COTATION_DEFAUT: ReglageCotation = { systeme: 'AFNOR', unite: 'mm', decimales: 3, hauteur: 3, hauteurRepere: 5, unidirectionnelle: false, fractionnaire: false };

/** Le réglage en cours (modifié par la case F4). */
export const cotation: ReglageCotation = { ...COTATION_DEFAUT };

/** Échelle du niveau de travail, fournie par le poste (1 sans poste : tests). */
let echelleCourante: () => number = () => 1;
export function suivreEchelle(f: () => number): void {
  echelleCourante = f;
}

const DIVISEUR: Record<UniteCotation, number> = { mm: 1, cm: 10, m: 1000 };
export const POUCE = 25.4;
const EXPOSANTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** Fraction de pouce au 1/64, réduite : 3.25 → « 3 1/4 », 0.5 → « 1/2 ». */
export function fractionPouce(p: number): string {
  let entier = Math.floor(p);
  let n = Math.round((p - entier) * 64);
  if (n === 64) (entier++, (n = 0));
  if (n === 0) return String(entier);
  let d = 64;
  while (n % 2 === 0) (n /= 2), (d /= 2);
  return entier ? `${entier} ${n}/${d}` : `${n}/${d}`;
}

/** Texte d'une longueur (en mm, échelle déjà appliquée) selon un réglage de cotation. */
export function formaterMesure(v: number, r: ReglageCotation = cotation): string {
  const dec = Math.max(0, Math.min(6, Math.round(r.decimales)));
  const a = Math.abs(v);
  switch (r.systeme) {
    case 'ANSI': {
      const p = a / POUCE;
      if (r.fractionnaire) return fractionPouce(p);
      // Pouces décimaux : pas de zéro avant la virgule (ASME Y14.5).
      return nombre(p, dec).replace(/^0\./, '.');
    }
    case 'ARCHI': {
      const cm = Math.round(a) / 10; // une décimale de cm : au mm près
      if (cm >= 100) return (a / 1000).toFixed(2);
      const entier = Math.floor(cm + 1e-9);
      const dixiemes = Math.round((cm - entier) * 10);
      return dixiemes ? `${entier}${EXPOSANTS[dixiemes]}` : String(entier);
    }
    default:
      return nombre(a / DIVISEUR[r.unite], dec);
  }
}

/** La longueur affichée par une cote : divisée par l'échelle du niveau de travail. */
export const valeurMesuree = (longueur: number) => longueur / (echelleCourante() || 1);

/** Texte d'une longueur cotée : divisée par l'échelle du niveau, dans le système et l'unité choisis. */
export function texteCote(longueur: number): string {
  return formaterMesure(valeurMesuree(longueur));
}

/** Valeur gardée dans l'écriture d'une cote, pour la refaire dans un autre système (F4). */
export interface Mesure {
  /** Longueur en mm (échelle appliquée). */
  v: number;
  /** Partie du texte qui l'affiche. */
  t: string;
  /** Inclinaison de la ligne de cote (lisible), pour passer en écriture horizontale ou alignée. */
  a?: number;
}

/**
 * Écriture d'une longueur cotée, à étaler dans une primitive texte : son texte et sa mesure.
 * `angle` : inclinaison de la ligne de cote ; l'angle du texte suit le système (angleTexteCote).
 */
export function ecritureCote(longueur: number, avant = '', apres = '', angle?: number): { texte: string; mesure: Mesure } {
  const v = valeurMesuree(longueur);
  const t = formaterMesure(v);
  return { texte: `${avant}${t}${apres}`, mesure: { v, t, ...(angle !== undefined ? { a: angle } : {}) } };
}

/** Inclinaison du texte d'une cote : horizontale en cotation unidirectionnelle (ISO, ANSI), sinon celle donnée. */
export function angleTexteCote(angle: number, r: ReglageCotation = cotation): number {
  return (r.systeme === 'ISO' || r.systeme === 'ANSI') && r.unidirectionnelle ? 0 : angle;
}

const FLECHE = 2.5;
const DEMI_OUVERTURE = 10;
const DEMI_OBLIQUE = 1.5;

/**
 * Extrémité d'une ligne de cote en `pointe` (la ligne part vers `vers`) : deux traits de flèche, ou en ARCHI un
 * trait oblique à 45°. Chaque trait garde sa pointe et sa direction (champ `bout`) pour changer de système.
 */
export function extremiteCote(pointe: Pt, vers: Pt, r: ReglageCotation = cotation): Primitive[] {
  const a = angleDe(pointe, vers);
  const bout: [Pt, Pt] = [pointe, vers];
  if (r.systeme === 'ARCHI') return [{ type: 'segment', a: surCercle(pointe, DEMI_OBLIQUE, a + 225), b: surCercle(pointe, DEMI_OBLIQUE, a + 45), bout }];
  return [-DEMI_OUVERTURE, DEMI_OUVERTURE].map((d) => ({ type: 'segment' as const, a: pointe, b: surCercle(pointe, FLECHE, a + d), bout }));
}

/** Pas de grille proposé pour un système (aide d'origine) : 1 mm, 1/32" ou 1/100" en ANSI, 1 cm en ARCHI. */
export function pasGrilleSysteme(r: ReglageCotation): number {
  if (r.systeme === 'ANSI') return r.fractionnaire ? POUCE / 32 : POUCE / 100;
  if (r.systeme === 'ARCHI') return 10;
  return 1;
}

/** Longueur tapée au clavier en ANSI : 3"1/4, 3 1/4, 3-1/4, 3+1/4, 13/4, 3.95 (pouces) ou 34.5M (mm). Null sinon. */
export function lirePouces(texte: string): number | null {
  const t = texte.trim().replace(/,/g, '.');
  const mm = /^([+-]?(?:\d+\.?\d*|\.\d+))\s*[mM]$/.exec(t);
  if (mm) return Number(mm[1]);
  const signe = t.startsWith('-') && !/^-\d+\/\d+$/.test(t) ? -1 : 1;
  const s = t.replace(/^[+-]/, '');
  let m = /^(\d+)\s*(?:"|\s|-|\+)\s*(\d+)\/(\d+)"?$/.exec(s);
  if (m && Number(m[3])) return signe * POUCE * (Number(m[1]) + Number(m[2]) / Number(m[3]));
  m = /^(\d+)\/(\d+)"?$/.exec(s);
  if (m && Number(m[2])) return (t.startsWith('-') ? -1 : 1) * POUCE * (Number(m[1]) / Number(m[2]));
  m = /^(\d+\.?\d*|\.\d+)"?$/.exec(s);
  if (m) return signe * POUCE * Number(m[1]);
  return null;
}

/**
 * Question qui demande une longueur (en pouces en ANSI) : rayon, diamètre, longueur, distance… Pas les
 * nombres, angles, échelles, niveaux ni rugosités.
 */
export function questionDeLongueur(texte: string): boolean {
  const t = texte.toLowerCase();
  if (/nombre|angle|inclinaison|échelle|echelle|niveau|rugosit|masse|type|couleur|précision|classe|degr|\[o\/n\]/.test(t)) return false;
  return /longueur|largeur|hauteur|épaisseur|rayon|diam|distance|profondeur|pas |pas$|écart|cote|décalage|dimension|côté/.test(t);
}

/**
 * Refait les cotes d'un ensemble d'entités dans le réglage `r` : valeurs écrites (gardées en mm), sens de
 * l'écriture et extrémités (flèches ou traits obliques). Renvoie les entités changées (avant, après).
 */
export function convertirCotes(entites: readonly Entite[], r: ReglageCotation = cotation): { avant: Entite; apres: Entite }[] {
  const changees: { avant: Entite; apres: Entite }[] = [];
  for (const e of entites) {
    if (!e.primitives.some((p) => (p.type === 'texte' && p.mesure) || (p.type === 'segment' && p.bout))) continue;
    const prims: Primitive[] = [];
    const styles: NonNullable<Entite['styles']> = [];
    const emises = e.primitives.map(() => 0); // nombre de nouvelles primitives pour chaque ancienne
    const pousser = (q: Primitive, i: number) => {
      prims.push(q);
      emises[i]++;
      if (e.styles) styles.push(e.styles[i]);
    };
    let base = typeof e.params?.base === 'string' ? (e.params.base as string) : undefined;
    let change = false;
    for (let i = 0; i < e.primitives.length; i++) {
      const p = e.primitives[i];
      if (p.type === 'texte' && p.mesure) {
        const t = formaterMesure(p.mesure.v, r);
        const angle = p.mesure.a !== undefined ? angleTexteCote(p.mesure.a, r) : p.angle;
        if (base !== undefined) base = base.replace(p.mesure.t, t);
        pousser({ ...p, texte: p.texte.replace(p.mesure.t, t), angle, mesure: { ...p.mesure, t } }, i);
        change ||= t !== p.mesure.t || angle !== p.angle;
        continue;
      }
      if (p.type === 'segment' && p.bout) {
        // Les traits d'une même extrémité se suivent et ont la même pointe.
        const [pointe, vers] = p.bout;
        let j = i + 1;
        while (j < e.primitives.length) {
          const q = e.primitives[j];
          if (q.type !== 'segment' || !q.bout || Math.hypot(q.bout[0].x - pointe.x, q.bout[0].y - pointe.y) > 1e-9) break;
          j++;
        }
        const nouveaux = extremiteCote(pointe, vers, r);
        for (const n of nouveaux) pousser(n, i);
        change ||= (j - i === 1) !== (nouveaux.length === 1);
        i = j - 1;
        continue;
      }
      pousser(p, i);
    }
    if (!change) continue;
    // Membres d'un groupe : le nombre de primitives par membre suit (une flèche a deux traits, un trait oblique un).
    let params = e.params;
    if (Array.isArray(params?.membres)) {
      let k = 0;
      params = {
        ...params,
        membres: (params.membres as { n: number }[]).map((m) => {
          const n = emises.slice(k, k + m.n).reduce((s, x) => s + x, 0);
          k += m.n;
          return { ...m, n };
        }),
      };
    }
    if (base !== undefined) params = { ...params, base };
    changees.push({ avant: e, apres: { ...e, primitives: prims, ...(e.styles ? { styles } : {}), ...(params ? { params } : {}) } });
  }
  return changees;
}
