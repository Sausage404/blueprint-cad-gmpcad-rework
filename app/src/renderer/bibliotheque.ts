// Bibliothèque de pièces normalisées du menu MECA (cases I01 à T15 de l'original), sans DOM.
// Chaque pièce est dessinée par une fonction de ses dimensions principales, dans son repère : x le long de
// l'axe, y en travers, origine au point de référence. Représentations simplifiées du dessin industriel
// (demi-coupes, filetages, symboles de roulements) ; dimensions par défaut tirées des normes pour les tailles
// courantes, toujours modifiables. Testé dans test/bibliotheque.test.ts.
import type { Pt } from './geometrie';
import { traitsHachures } from './hachures';
import type { Primitive } from './primitives';

/** Style d'un trait : fort, fin, axe (mixte fin), caché (pointillé fin), hachure (fin, absente des icônes). */
export type Style = 'f' | 'n' | 'a' | 'c' | 'h';
export interface Tr {
  p: Primitive;
  s: Style;
}

export interface QuestionPiece {
  texte: string;
  /** Valeur proposée, selon les réponses précédentes. */
  defaut: (v: number[]) => number;
}

export interface Piece {
  code: string;
  libelle: string;
  questions: QuestionPiece[];
  dessin: (v: number[]) => Tr[];
  /** Désignation pour la nomenclature (ex. « Vis H M10-40 »). */
  designation: (v: number[]) => string;
}

// ======================================================================= Outils de tracé

const P = (x: number, y: number): Pt => ({ x, y });
const L = (x1: number, y1: number, x2: number, y2: number, s: Style = 'f'): Tr => ({ p: { type: 'segment', a: P(x1, y1), b: P(x2, y2) }, s });
const C = (x: number, y: number, r: number, s: Style = 'f'): Tr => ({ p: { type: 'cercle', c: P(x, y), r }, s });
const A = (x: number, y: number, r: number, debut: number, fin: number, s: Style = 'f'): Tr => ({ p: { type: 'arc', c: P(x, y), r, debut, fin }, s });
const R = (x0: number, y0: number, x1: number, y1: number, s: Style = 'f'): Tr[] => [L(x0, y0, x1, y0, s), L(x1, y0, x1, y1, s), L(x1, y1, x0, y1, s), L(x0, y1, x0, y0, s)];
const poly = (pts: [number, number][], s: Style = 'f', ferme = true): Tr[] =>
  pts.slice(0, ferme ? pts.length : pts.length - 1).map((p, i) => L(p[0], p[1], pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1], s));
const axe = (x0: number, x1: number, y = 0): Tr => L(x0, y, x1, y, 'a');
const axeV = (y0: number, y1: number, x = 0): Tr => L(x, y0, x, y1, 'a');

/** Symétrique par rapport à l'axe x (demi-coupe dessinée une fois, recopiée de l'autre côté). */
function miroir(t: Tr[]): Tr[] {
  const flip = (p: Primitive): Primitive => {
    switch (p.type) {
      case 'segment':
        return { ...p, a: P(p.a.x, -p.a.y), b: P(p.b.x, -p.b.y) };
      case 'cercle':
        return { ...p, c: P(p.c.x, -p.c.y) };
      case 'arc':
        return { ...p, c: P(p.c.x, -p.c.y), debut: -p.fin, fin: -p.debut };
      default:
        return p;
    }
  };
  return [...t, ...t.map((x) => ({ p: flip(x.p), s: x.s }))];
}

/** Hachures fines (coupe) dans un contour. */
function hach(contours: [number, number][][], distance = 1.5, angle = 45): Tr[] {
  return traitsHachures(
    contours.map((c) => c.map(([x, y]) => P(x, y))),
    { motif: 'tout', distance, angle },
  ).map((t) => ({ p: t.prim, s: 'h' }));
}

/** Section hachurée (contour fort et hachures). */
const coupe = (pts: [number, number][], distance = 1.5): Tr[] => [...poly(pts), ...hach([pts], distance)];

/** Valeur de la table pour le diamètre le plus proche. */
function table(d: number, diametres: number[], valeurs: number[]): number {
  let i = 0;
  diametres.forEach((x, j) => {
    if (Math.abs(x - d) < Math.abs(diametres[i] - d)) i = j;
  });
  return Math.abs(diametres[i] - d) < 1e-9 ? valeurs[i] : (valeurs[i] * d) / diametres[i];
}

const nb = (v: number) => (Math.round(v * 100) / 100).toString();

// ======================================================================= Visserie (normes ISO)

const M = [3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24];
const PAS = [0.5, 0.7, 0.8, 1, 1.25, 1.5, 1.75, 2, 2, 2.5, 3];
const S_H = [5.5, 7, 8, 10, 13, 16, 18, 21, 24, 30, 36]; // ISO 4017 / 4032 : surplats
const K_H = [2, 2.8, 3.5, 4, 5.3, 6.4, 7.5, 8.8, 10, 12.5, 15]; // ISO 4017 : hauteur de tête
const M_ECROU = [2.4, 3.2, 4.7, 5.2, 6.8, 8.4, 10.8, 12.8, 14.8, 18, 21.5]; // ISO 4032 : hauteur d'écrou
const DK_CHC = [5.5, 7, 8.5, 10, 13, 16, 18, 21, 24, 30, 36]; // ISO 4762
const S_CHC = [2.5, 3, 4, 5, 6, 8, 10, 12, 14, 17, 19]; // six pans creux
const H_RONDELLE = [0.5, 0.8, 1, 1.6, 1.6, 2, 2.5, 2.5, 3, 3, 4]; // ISO 7089

const pas = (d: number) => table(d, M, PAS);
const sH = (d: number) => table(d, M, S_H);

/**
 * Tige filetée vue de l'extérieur, de x0 à x1 (diamètre d) ; filets sur les portées `filets` : diamètre nominal
 * en trait fort, fond de filet en trait fin, limites de filetage en trait fort, chanfrein en bout (x1).
 */
function tige(x0: number, x1: number, d: number, filets: [number, number][], chanfreinDebut = false): Tr[] {
  const p = pas(d);
  const r = d / 2;
  const rf = r - 0.6 * p;
  const c = Math.min(p, (x1 - x0) / 4);
  const e = 1e-9;
  const haut: Tr[] = [L(x0 + (chanfreinDebut ? c : 0), r, x1 - c, r), L(x1 - c, r, x1, r - c)];
  if (chanfreinDebut) haut.push(L(x0, r - c, x0 + c, r));
  for (const [f0, f1] of filets) if (f1 > f0) haut.push(L(Math.max(f0, x0 + (chanfreinDebut ? c / 2 : 0)), rf, f1 - (Math.abs(f1 - x1) < e ? c / 2 : 0), rf, 'n'));
  const out = miroir(haut);
  out.push(L(x1, r - c, x1, -(r - c)));
  if (chanfreinDebut) out.push(L(x0, r - c, x0, -(r - c)));
  for (const [f0, f1] of filets) {
    if (f0 > x0 + e) out.push(L(f0, r, f0, -r));
    if (f1 < x1 - e) out.push(L(f1, r, f1, -r));
  }
  return out;
}

/** Longueur filetée d'une vis (ISO 4014 : 2d + 6 jusqu'à 125 mm), toute la longueur si la vis est courte. */
const filetVis = (d: number, l: number) => Math.min(l, 2 * d + 6);

type Tete = 'H' | 'Q' | 'CHc' | 'C' | 'CL' | 'Fhc' | 'FB90';

/** Vis vue de profil : tête à gauche (x < 0 ; vis fraisées : tête comprise dans la longueur), tige jusqu'à x = l. */
function vis(tete: Tete, d: number, l: number): Tr[] {
  const out: Tr[] = [];
  const fraisee = tete === 'Fhc' || tete === 'FB90';
  const dk = tete === 'Fhc' ? 2 * d : tete === 'FB90' ? 1.85 * d : 0;
  const hk = fraisee ? (dk - d) / 2 : 0; // tête fraisée à 90° : sa hauteur
  out.push(...tige(fraisee ? hk : 0, l, d, [[l - filetVis(d, l - hk), l]]));
  switch (tete) {
    case 'H': {
      const s = sH(d);
      const e = s / Math.cos(Math.PI / 6);
      const k = table(d, M, K_H);
      out.push(...R(-k, -e / 2, 0, e / 2), L(-k, e / 4, 0, e / 4), L(-k, -e / 4, 0, -e / 4));
      break;
    }
    case 'Q': {
      const s = sH(d);
      const k = 0.7 * d;
      out.push(...R(-k, -s / 2, 0, s / 2), L(-k, 0, 0, 0, 'n'));
      break;
    }
    case 'CHc': {
      const k = d;
      const D = table(d, M, DK_CHC);
      const s = table(d, M, S_CHC);
      out.push(...R(-k, -D / 2, 0, D / 2), L(-k, s / 2, -k + 0.5 * k, s / 2, 'c'), L(-k, -s / 2, -k + 0.5 * k, -s / 2, 'c'), L(-k + 0.5 * k, s / 2, -k + 0.6 * k, 0, 'c'), L(-k + 0.5 * k, -s / 2, -k + 0.6 * k, 0, 'c'));
      break;
    }
    case 'C': {
      const D = 1.6 * d + 0.8;
      const k = 0.65 * d;
      const n = 0.16 * d + 0.3;
      out.push(L(0, D / 2, -k, D / 2), L(0, -D / 2, -k, -D / 2), L(0, D / 2, 0, -D / 2), L(-k, D / 2, -k, n / 2), L(-k, -D / 2, -k, -n / 2));
      out.push(L(-k, n / 2, -k / 2, n / 2), L(-k / 2, n / 2, -k / 2, -n / 2), L(-k / 2, -n / 2, -k, -n / 2));
      break;
    }
    case 'CL': {
      const D = 2 * d;
      const k = 0.6 * d;
      const n = 0.16 * d + 0.3;
      // Tête cylindrique large à dessus bombé.
      out.push(L(0, D / 2, 0, -D / 2), L(0, D / 2, -0.6 * k, D / 2), L(0, -D / 2, -0.6 * k, -D / 2));
      const rr = (D * D) / 4 / (0.8 * k) / 2 + (0.4 * k) / 2;
      const cx = -0.6 * k + rr - 0.4 * k;
      const a = (Math.asin(D / 2 / rr) * 180) / Math.PI;
      out.push(A(cx, 0, rr, 180 - a, 180 + a));
      out.push(L(-k, n / 2, -0.5 * k, n / 2), L(-0.5 * k, n / 2, -0.5 * k, -n / 2), L(-0.5 * k, -n / 2, -k, -n / 2));
      break;
    }
    case 'Fhc':
    case 'FB90': {
      out.push(L(0, dk / 2, hk, d / 2), L(0, -dk / 2, hk, -d / 2), L(0, dk / 2, 0, -dk / 2));
      if (tete === 'FB90') {
        const f = 0.25 * d;
        const rr = (dk * dk) / 4 / f / 2 + f / 2;
        const a = (Math.asin(dk / 2 / rr) * 180) / Math.PI;
        out.push(A(rr - f, 0, rr, 180 - a, 180 + a));
        const n = 0.16 * d + 0.3;
        out.push(L(-f, n / 2, 0.4 * hk, n / 2), L(0.4 * hk, n / 2, 0.4 * hk, -n / 2), L(0.4 * hk, -n / 2, -f, -n / 2));
      } else {
        const s = table(d, M, S_CHC);
        out.push(L(0, s / 2, 0.6 * d, s / 2, 'c'), L(0, -s / 2, 0.6 * d, -s / 2, 'c'));
      }
      break;
    }
  }
  const debut = fraisee ? -3 : tete === 'H' ? -table(d, M, K_H) - 2 : -d - 2;
  out.push(axe(debut, l + 2));
  return out;
}

/** Hexagone de surplat s, centré en (0, 0), deux sommets sur l'axe x. */
const hexagone = (s: number, styl: Style = 'f'): Tr[] => {
  const r = s / Math.sqrt(3);
  const pts: [number, number][] = Array.from({ length: 6 }, (_, i) => [r * Math.cos((i * Math.PI) / 3), r * Math.sin((i * Math.PI) / 3)]);
  return poly(pts, styl);
};
const croix = (r: number): Tr[] => [axe(-r, r), axeV(-r, r)];

/** Filetage vu de dessus (taraudage) : perçage en trait fort, 3/4 de cercle du filet en trait fin. */
const taraudageDessus = (d: number): Tr[] => [C(0, 0, (d - pas(d)) / 2), A(0, 0, d / 2, 100, 10, 'n')];
/** Filetage d'une vis vue de dessus (bout) : 3/4 de cercle du fond de filet en trait fin. */
const tigeDessus = (d: number): Tr[] => [C(0, 0, d / 2), A(0, 0, (d - 1.2 * pas(d)) / 2, 100, 10, 'n')];

function teteDessus(tete: 'H' | 'Q' | 'CHc' | 'C' | 'CL', d: number): Tr[] {
  switch (tete) {
    case 'H':
      return [...hexagone(sH(d)), C(0, 0, sH(d) * 0.475, 'n'), ...croix(sH(d) * 0.7)];
    case 'Q': {
      const s = sH(d);
      return [...R(-s / 2, -s / 2, s / 2, s / 2), ...croix(s * 0.8)];
    }
    case 'CHc':
      return [C(0, 0, table(d, M, DK_CHC) / 2), ...hexagone(table(d, M, S_CHC)), ...croix(table(d, M, DK_CHC) * 0.65)];
    case 'C':
    case 'CL': {
      const D = tete === 'C' ? 1.6 * d + 0.8 : 2 * d;
      const n = 0.16 * d + 0.3;
      const x = Math.sqrt((D / 2) ** 2 - (n / 2) ** 2);
      return [A(0, 0, D / 2, 0, 360), L(-x, n / 2, x, n / 2), L(-x, -n / 2, x, -n / 2), ...croix(D * 0.65)];
    }
  }
}

/** Vis sans tête (vis de pression à six pans creux) : bout plat, pointu, à cuvette, à téton long ou court. */
function visPression(bout: 'plat' | 'pointu' | 'cuvette' | 'tetonLong' | 'tetonCourt', d: number, l: number): Tr[] {
  const out: Tr[] = [];
  const r = d / 2;
  const p = pas(d);
  const rf = r - 0.6 * p;
  const z = bout === 'tetonLong' ? 0.5 * d + 0.5 * d : bout === 'tetonCourt' ? 0.5 * d : 0;
  const lf = l - z;
  const haut: Tr[] = [L(p, r, lf - (z ? 0 : p), r), L(0, r - p, p, r), L(p, rf, lf - (z ? 0 : p), rf, 'n')];
  if (bout === 'plat') haut.push(L(lf - p, r, lf, r - p), L(lf, r - p, lf, 0));
  if (bout === 'pointu') haut.push(L(lf - p, r, l - 0, 0));
  if (bout === 'cuvette') haut.push(L(lf - p, r, lf, r - p), L(lf, r - p, lf - 0.3 * d, 0));
  if (z) {
    const rt = 0.3 * d;
    haut.push(L(lf, r, lf, rt), L(lf, rt, l - 0.1 * d, rt), L(l - 0.1 * d, rt, l, rt - 0.1 * d), L(l, rt - 0.1 * d, l, 0));
  }
  out.push(...miroir(haut), L(0, r - p, 0, -(r - p)));
  const s = table(d, M, S_CHC);
  out.push(L(0, s / 2, 0.6 * d, s / 2, 'c'), L(0, -s / 2, 0.6 * d, -s / 2, 'c'));
  out.push(axe(-2, l + 2));
  return out;
}

// ======================================================================= Écrous et rondelles

function ecrouProfil(type: 'H3' | 'H2' | 'nylstop' | 'creneaux' | 'borgne' | 'embase', d: number): Tr[] {
  const s = sH(d);
  const e = s / Math.cos(Math.PI / 6);
  const m = table(d, M, M_ECROU);
  const out: Tr[] = [];
  const corps = (x0: number, x1: number, deuxPans: boolean) => {
    const w = deuxPans ? s : e;
    out.push(...R(x0, -w / 2, x1, w / 2));
    if (deuxPans) out.push(L(x0, 0, x1, 0, 'n'));
    else out.push(L(x0, e / 4, x1, e / 4), L(x0, -e / 4, x1, -e / 4));
  };
  switch (type) {
    case 'H3':
    case 'H2':
      corps(0, m, type === 'H2');
      break;
    case 'nylstop': {
      corps(0, m, false);
      const h = 0.45 * m;
      out.push(...R(m, -0.85 * s / 2, m + h, 0.85 * s / 2), L(m + h * 0.4, -0.85 * s / 2, m + h * 0.4, 0.85 * s / 2, 'n'));
      break;
    }
    case 'creneaux': {
      corps(0, m, false);
      const h = 0.45 * m;
      const w = 0.9 * s;
      const n = 0.25 * d + 0.5;
      out.push(L(m, w / 2, m + h, w / 2), L(m, -w / 2, m + h, -w / 2), L(m + h, w / 2, m + h, n / 2), L(m + h, -w / 2, m + h, -n / 2));
      out.push(L(m + h, n / 2, m + h * 0.3, n / 2), L(m + h * 0.3, n / 2, m + h * 0.3, -n / 2), L(m + h * 0.3, -n / 2, m + h, -n / 2));
      break;
    }
    case 'borgne': {
      corps(0, m, false);
      out.push(A(m, 0, s / 2, -90, 90));
      break;
    }
    case 'embase': {
      const df = 2.2 * d;
      const c = 0.2 * d;
      out.push(...R(0, -df / 2, c, df / 2));
      corps(c, c + m, false);
      break;
    }
  }
  out.push(L(0, d / 2, m, d / 2, 'c'), L(0, -d / 2, m, -d / 2, 'c'), axe(-2, m + (type === 'borgne' ? s / 2 : type === 'nylstop' || type === 'creneaux' ? 0.45 * m : 0) + 2));
  return out;
}

function ecrouDessus(type: 'H' | 'nylstop' | 'creneaux' | 'embase', d: number): Tr[] {
  const s = sH(d);
  const out: Tr[] = [...hexagone(s), C(0, 0, s * 0.475, 'n'), ...taraudageDessus(d), ...croix(s * 0.7)];
  if (type === 'nylstop') out.push(C(0, 0, 0.85 * s / 2, 'n'));
  if (type === 'creneaux') {
    const n = 0.25 * d + 0.5;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + Math.PI / 6;
      const u = P(Math.cos(a), Math.sin(a));
      const v = P(-u.y, u.x);
      const r0 = d / 2;
      const r1 = 0.9 * s / 2;
      for (const k of [-1, 1]) out.push(L(u.x * r0 + (v.x * k * n) / 2, u.y * r0 + (v.y * k * n) / 2, u.x * r1 + (v.x * k * n) / 2, u.y * r1 + (v.y * k * n) / 2, 'n'));
    }
  }
  if (type === 'embase') out.push(C(0, 0, 1.1 * d));
  return out;
}

/** Écrou à encoches KM (et rondelle frein MB) : vue de profil ou de dessus. */
function ecrouKM(d: number, dessus: boolean): Tr[] {
  const D = 1.6 * d + 4;
  const B = 0.3 * d + 4;
  const encoche = 0.12 * D;
  if (!dessus) {
    const out: Tr[] = [...R(0, -D / 2, B, D / 2), L(0, D / 2 - encoche, B, D / 2 - encoche, 'n')];
    // Rondelle frein MB : mince, avec sa languette.
    out.push(...R(-1, -(D / 2 - 1), 0, D / 2 - 1), L(-1, D / 2 - 1, -1 - encoche, D / 2 - 1 + 0.5), L(-1 - encoche, D / 2 - 1 + 0.5, -1 - encoche, D / 2 - encoche));
    out.push(L(0, d / 2, B, d / 2, 'c'), L(0, -d / 2, B, -d / 2, 'c'), axe(-3, B + 2));
    return out;
  }
  const out: Tr[] = [...taraudageDessus(d), ...croix(D * 0.65)];
  const pts: Tr[] = [];
  const n = 4;
  for (let i = 0; i < n; i++) {
    const a0 = (i * 360) / n + 8;
    const a1 = ((i + 1) * 360) / n - 8;
    pts.push(A(0, 0, D / 2, a0, a1));
    const rad = (x: number) => (x * Math.PI) / 180;
    const e0 = P((D / 2) * Math.cos(rad(a1)), (D / 2) * Math.sin(rad(a1)));
    const e1 = P((D / 2 - encoche) * Math.cos(rad(a1)), (D / 2 - encoche) * Math.sin(rad(a1)));
    const f0 = P((D / 2 - encoche) * Math.cos(rad(a1 + 16)), (D / 2 - encoche) * Math.sin(rad(a1 + 16)));
    const f1 = P((D / 2) * Math.cos(rad(a1 + 16)), (D / 2) * Math.sin(rad(a1 + 16)));
    pts.push(L(e0.x, e0.y, e1.x, e1.y), A(0, 0, D / 2 - encoche, a1, a1 + 16), L(f0.x, f0.y, f1.x, f1.y));
  }
  return [...out, ...pts];
}

/** Rondelles de profil (coupe) : plate (ISO 7089), Grower, éventail. */
function rondelle(type: 'plate' | 'grower' | 'eventail', d: number): Tr[] {
  const d1 = d + (type === 'grower' ? 0.2 : 0.4 + 0.02 * d);
  const d2 = type === 'grower' ? d + 0.5 * d + 1 : 2 * d;
  const h = type === 'grower' ? 0.25 * d : type === 'eventail' ? 0.06 * d + 0.2 : table(d, M, H_RONDELLE);
  if (type === 'grower') {
    const haut: [number, number][] = [[0, d1 / 2], [h, d1 / 2 + 0.15 * h], [h, d2 / 2 + 0.15 * h], [0, d2 / 2]];
    const bas: [number, number][] = [[0, -d1 / 2 - 0.15 * h], [h, -d1 / 2], [h, -d2 / 2], [0, -d2 / 2 - 0.15 * h]];
    return [...coupe(haut, 0.6), ...coupe(bas, 0.6), axe(-2, h + 2)];
  }
  if (type === 'eventail') {
    const out: Tr[] = [axe(-2, h + 3)];
    for (const sg of [1, -1]) {
      const pts: [number, number][] = [];
      const n = 4;
      for (let i = 0; i <= n; i++) pts.push([i % 2 ? h * 2 : 0, sg * (d1 / 2 + ((d2 - d1) / 2) * (i / n))]);
      out.push(...poly(pts, 'f', false));
    }
    return out;
  }
  return [...coupe([[0, d1 / 2], [h, d1 / 2], [h, d2 / 2], [0, d2 / 2]], 0.6), ...coupe([[0, -d1 / 2], [h, -d1 / 2], [h, -d2 / 2], [0, -d2 / 2]], 0.6), axe(-2, h + 2)];
}

/** Anneaux élastiques (DIN 471 / 472) et segments d'arrêt : coupe sur l'arbre ou dans l'alésage. */
function anneau(arbre: boolean, d: number, segment = false): Tr[] {
  const s = d <= 10 ? 1 : d <= 22 ? 1.2 : d <= 38 ? 1.5 : d <= 50 ? 1.75 : d <= 80 ? 2.5 : 3;
  const p = arbre ? Math.max(0.3, 0.025 * d + 0.2) : Math.max(0.3, 0.025 * d + 0.2);
  const b = segment ? 0.6 * s + 0.5 : 0.08 * d + 1.5;
  const r = d / 2;
  const fond = arbre ? r - p : r + p;
  const ext = arbre ? fond + b : fond - b;
  const out: Tr[] = [];
  for (const sg of [1, -1]) {
    const y0 = sg * fond;
    const y1 = sg * ext;
    out.push(...coupe([[0, y0], [s, y0], [s, y1], [0, y1]], 0.4));
    // Gorge et cylindre (arbre ou alésage) en trait fin autour de l'anneau.
    out.push(L(-3, sg * r, 0, sg * r, 'n'), L(s, sg * r, s + 3, sg * r, 'n'));
  }
  out.push(axe(-4, s + 4));
  return out;
}

/** Goupilles : élastique, cylindriques A, B, C (chanfreins ou bouts bombés), conique (1/50). */
function goupille(type: 'elastique' | 'A' | 'B' | 'C' | 'conique', d: number, l: number): Tr[] {
  const r = d / 2;
  const c = Math.min(0.15 * d + 0.2, l / 6);
  if (type === 'conique') {
    const r2 = r + l / 100;
    return [...poly([[0, r], [l, r2], [l, -r2], [0, -r]]), A(c, 0, r / Math.sin((70 * Math.PI) / 180), 160, 200, 'f'), axe(-2, l + 2)];
  }
  const out: Tr[] = [];
  const haut: Tr[] = [L(c, r, l - c, r), L(0, r - c, c, r), L(l - c, r, l, r - c)];
  if (type === 'B') haut.push(L(l - c, r, l, r - c));
  out.push(...miroir(haut), L(0, r - c, 0, -(r - c)), L(l, r - c, l, -(r - c)));
  if (type === 'elastique') out.push(L(c, 0.35 * d, l - c, 0.35 * d, 'c'), L(c, -0.35 * d, l - c, -0.35 * d, 'c'), L(c, 0.05 * d, l - c, 0.05 * d, 'n'));
  if (type === 'C') out.push(A(l - c - r, 0, r * 1.15, -60, 60, 'n'));
  out.push(axe(-2, l + 2));
  return out;
}

// ======================================================================= Roulements, butées, paliers

/** Dimensions des séries 60, 62, 63 (d, D, B) d'après le numéro du roulement. */
const SERIES: Record<string, [number, number, number][]> = {
  '60': [[10, 26, 8], [12, 28, 8], [15, 32, 9], [17, 35, 10], [20, 42, 12], [25, 47, 12], [30, 55, 13], [35, 62, 14], [40, 68, 15], [45, 75, 16], [50, 80, 16], [55, 90, 18], [60, 95, 18]],
  '62': [[10, 30, 9], [12, 32, 10], [15, 35, 11], [17, 40, 12], [20, 47, 14], [25, 52, 15], [30, 62, 16], [35, 72, 17], [40, 80, 18], [45, 85, 19], [50, 90, 20], [55, 100, 21], [60, 110, 22]],
  '63': [[10, 35, 11], [12, 37, 12], [15, 42, 13], [17, 47, 14], [20, 52, 15], [25, 62, 17], [30, 72, 19], [35, 80, 21], [40, 90, 23], [45, 100, 25], [50, 110, 27], [55, 120, 29], [60, 130, 31]],
};

/** D et B d'un roulement de la série 62 pour l'alésage d (le plus proche), pour les valeurs proposées. */
function serie62(d: number): { D: number; B: number } {
  let m = SERIES['62'][0];
  for (const x of SERIES['62']) if (Math.abs(x[0] - d) < Math.abs(m[0] - d)) m = x;
  const k = d / m[0];
  return { D: Math.round(m[1] * k), B: Math.round(m[2] * k) };
}

/** Lecture d'une désignation 6204, 6305… : (d, D, B) ou null. */
export function roulementNormalise(n: number): { d: number; D: number; B: number } | null {
  const t = String(Math.round(n));
  const m = /^6([023])(\d\d)$/.exec(t);
  if (!m) return null;
  const i = Number(m[2]);
  const ligne = SERIES[`6${m[1]}`][i];
  return ligne ? { d: ligne[0], D: ligne[1], B: ligne[2] } : null;
}

type ElementRoulant = 'bille' | 'rouleau' | 'aiguille' | 'conique' | 'tonnelet';

/**
 * Roulement en demi-coupe (dessinée au-dessus de l'axe et recopiée dessous) : bague extérieure, bague
 * intérieure, éléments roulants. `x` = 0 sur la face gauche ; `variante` règle les épaulements et les lignes
 * de contact.
 */
function roulement(d: number, D: number, B: number, el: ElementRoulant, variante: { rangs?: number; contact?: number; quatrePoints?: boolean; epaulementsExt?: number; epaulementsInt?: number; spherique?: boolean; rainure?: boolean; bagueLarge?: number } = {}): Tr[] {
  const r = d / 2;
  const R0 = D / 2;
  const e = (R0 - r) * 0.28; // épaisseur des bagues
  const ym = (R0 + r) / 2;
  const ext: Tr[] = [];
  const largeurInt = variante.bagueLarge ?? B;
  const xi0 = (B - largeurInt) / 2;
  const coupeBague = (x0: number, x1: number, y0: number, y1: number): Tr[] => coupe([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], Math.max(0.8, (y1 - y0) / 3));
  ext.push(...coupeBague(0, B, R0 - e, R0), ...coupeBague(xi0, xi0 + largeurInt, r, r + e));
  const rangs = variante.rangs ?? 1;
  const taille = (R0 - r - 2 * e) * 0.9;
  for (let k = 0; k < rangs; k++) {
    const xc = (B * (k + 0.5)) / rangs;
    if (el === 'bille') ext.push(C(xc, ym, Math.min(taille, (B / rangs) * 0.8) / 2));
    if (el === 'rouleau' || el === 'aiguille') {
      const h = el === 'aiguille' ? Math.min(taille, 3) : taille;
      const w = (B / rangs) * (el === 'aiguille' ? 0.85 : 0.7);
      ext.push(...R(xc - w / 2, ym - h / 2, xc + w / 2, ym + h / 2), L(xc - w / 2, ym, xc + w / 2, ym, 'a'));
    }
    if (el === 'tonnelet') {
      const w = (B / rangs) * 0.7;
      ext.push(A(xc, ym - taille * 1.2, taille * 1.7, 90 - 18, 90 + 18), A(xc, ym + taille * 1.2, taille * 1.7, 270 - 18, 270 + 18), L(xc - w / 2, ym - taille / 2, xc - w / 2, ym + taille / 2), L(xc + w / 2, ym - taille / 2, xc + w / 2, ym + taille / 2));
    }
    if (el === 'conique') {
      const w = (B / rangs) * 0.7;
      const h0 = taille * 0.7;
      const h1 = taille;
      const sg = k % 2 ? -1 : 1;
      ext.push(...poly([[xc - w / 2, ym - (sg > 0 ? h0 : h1) / 2 + 0.15 * w * sg], [xc + w / 2, ym - (sg > 0 ? h1 : h0) / 2 - 0.15 * w * sg], [xc + w / 2, ym + (sg > 0 ? h1 : h0) / 2 - 0.15 * w * sg], [xc - w / 2, ym + (sg > 0 ? h0 : h1) / 2 + 0.15 * w * sg]]));
    }
    if (variante.contact !== undefined) {
      const a = ((variante.contact * Math.PI) / 180) * (k % 2 ? -1 : 1);
      const l = (R0 - r) / 2;
      ext.push(L(xc - Math.sin(a) * l, ym - Math.cos(a) * l, xc + Math.sin(a) * l, ym + Math.cos(a) * l, 'n'));
      if (variante.quatrePoints) ext.push(L(xc + Math.sin(a) * l, ym - Math.cos(a) * l, xc - Math.sin(a) * l, ym + Math.cos(a) * l, 'n'));
    }
  }
  if (variante.spherique) ext.push(A(B / 2, 0, R0 - e, 90 - ((B / 2) / (R0 - e)) * 57.3, 90 + ((B / 2) / (R0 - e)) * 57.3, 'n'));
  // Épaulements (rouleaux cylindriques) : petits rebords sur les bagues.
  const ep = (taille - (R0 - r - 2 * e)) / 2 + 0.6;
  for (let i = 0; i < (variante.epaulementsExt ?? 0); i++) {
    const x = i === 0 ? 0 : B - B * 0.12;
    ext.push(...R(x, R0 - e - ep, x + B * 0.12, R0 - e, 'f'));
  }
  for (let i = 0; i < (variante.epaulementsInt ?? 0); i++) {
    const x = i === 0 ? xi0 : xi0 + largeurInt - B * 0.12;
    ext.push(...R(x, r + e, x + B * 0.12, r + e + ep, 'f'));
  }
  if (variante.rainure) ext.push(...R(B * 0.15, R0, B * 0.3, R0 + 0.8, 'f'));
  return [...miroir(ext), axe(-3, B + 3)];
}

/** Cage à aiguilles seule (sans bagues) : les aiguilles entre l'arbre (d) et l'alésage (D), cage en trait fin. */
function cageAiguilles(d: number, D: number, B: number): Tr[] {
  const half: Tr[] = [...R(B * 0.05, d / 2, B * 0.95, D / 2), L(B * 0.05, (d + D) / 4, B * 0.95, (d + D) / 4, 'a'), ...R(0, d / 2 + 0.15 * (D - d), B, D / 2 - 0.15 * (D - d), 'n')];
  return [...miroir(half), axe(-3, B + 3)];
}

/** Butée (éléments roulants entre deux rondelles perpendiculaires à l'axe) : x le long de l'axe. */
function butee(d: number, D: number, H: number, el: 'bille' | 'aiguille' | 'rouleau' | 'tonnelet', options: { double?: boolean; spherique?: boolean; centreArbre?: boolean } = {}): Tr[] {
  const r = d / 2;
  const R0 = D / 2;
  const n = options.double ? 3 : 2;
  const t = options.double ? H / 5 : H / 3.2; // épaisseur des rondelles
  const ym = (r + R0) / 2;
  const half: Tr[] = [];
  const xs = options.double ? [0, H / 2 - t / 2, H - t] : [0, H - t];
  xs.slice(0, n).forEach((x, i) => {
    const decal = (options.centreArbre ? i % 2 === 0 : i % 2 === 1) ? 0.15 * (R0 - r) : 0;
    half.push(...coupe([[x, r + decal], [x + t, r + decal], [x + t, R0 - (0.15 * (R0 - r) - decal)], [x, R0 - (0.15 * (R0 - r) - decal)]], 0.8));
  });
  const gaps = options.double ? [[t, H / 2 - t / 2], [H / 2 + t / 2, H - t]] : [[t, H - t]];
  for (const [g0, g1] of gaps) {
    const w = g1 - g0;
    const xc = (g0 + g1) / 2;
    if (el === 'bille') half.push(C(xc, ym, w / 2 * 0.95));
    else if (el === 'tonnelet') half.push(A(xc, ym, w * 0.9, 60, 120), A(xc, ym, w * 0.9, 240, 300), L(xc - w * 0.45, ym - w * 0.75, xc - w * 0.45, ym + w * 0.75), L(xc + w * 0.45, ym - w * 0.75, xc + w * 0.45, ym + w * 0.75));
    else {
      const h = el === 'aiguille' ? (R0 - r) * 0.7 : (R0 - r) * 0.5;
      half.push(...R(xc - w * 0.45, ym - h / 2, xc + w * 0.45, ym + h / 2), L(xc, ym - h / 2, xc, ym + h / 2, 'a'));
    }
  }
  if (options.spherique) half.push(A(-R0 * 1.2 + H, 0, R0 * 1.2, -25, 25));
  return [...miroir(half), axe(-3, H + 3)];
}

/** Bague lisse (coussinet, rotule frittée, douille) en coupe : alésage d, extérieur D, longueur B. */
function bague(d: number, D: number, B: number, options: { collerette?: { D: number; e: number }; spherique?: boolean; oblique?: boolean; axiale?: boolean } = {}): Tr[] {
  const r = d / 2;
  const R0 = D / 2;
  const half: Tr[] = [];
  if (options.spherique) {
    // Rotule : extérieur sphérique (arc), alésage cylindrique.
    const h = R0 * 0.9;
    half.push(L(0, r, B, r), L(0, r, 0, h), L(B, r, B, h), A(B / 2, 0, Math.hypot(B / 2, h), 90 - (Math.atan2(B / 2, h) * 180) / Math.PI, 90 + (Math.atan2(B / 2, h) * 180) / Math.PI));
    half.push(...hach([[[0, r], [B, r], [B, h], [0, h]]], 0.9));
    if (options.oblique) half.push(L(B * 0.2, r, B * 0.8, h, 'n'));
    if (options.axiale) half.push(L(B / 2, r, B / 2, h, 'n'));
  } else {
    half.push(...coupe([[0, r], [B, r], [B, R0], [0, R0]], 0.9));
    if (options.collerette) half.push(...coupe([[-options.collerette.e, r], [0, r], [0, options.collerette.D / 2], [-options.collerette.e, options.collerette.D / 2]], 0.9));
  }
  return [...miroir(half), axe(-3 - (options.collerette?.e ?? 0), B + 3)];
}

// ======================================================================= Joints, bouts d'arbres, entretoises

/** Joint à lèvres (coupe) : armature et lèvre ; IELR / IEL / IE : avec ressort, lèvre anti-poussière. */
function jointLevres(d: number, D: number, B: number, ressort: boolean, antiPoussiere: boolean): Tr[] {
  const r = d / 2;
  const R0 = D / 2;
  const half: Tr[] = [
    ...coupe([[0, R0 - 0.25 * (R0 - r)], [B, R0 - 0.25 * (R0 - r)], [B, R0], [0, R0]], 0.6),
    ...poly([[B * 0.15, R0 - 0.25 * (R0 - r)], [B * 0.55, r + 0.1 * (R0 - r)], [B * 0.75, r], [B, r + 0.25 * (R0 - r)], [B, R0 - 0.25 * (R0 - r)]], 'f', false),
  ];
  if (ressort) half.push(C(B * 0.6, r + 0.32 * (R0 - r), 0.12 * (R0 - r)));
  if (antiPoussiere) half.push(L(B * 0.15, R0 - 0.25 * (R0 - r), 0, r + 0.15 * (R0 - r)), L(0, r + 0.15 * (R0 - r), B * 0.1, r));
  return [...miroir(half), axe(-3, B + 3)];
}

/** Joint torique (section ronde de diamètre w) dans sa gorge (largeur 1,3 w, profondeur 0,8 w), sur un arbre d. */
function jointTorique(d: number, w: number, gorge: boolean, joint: boolean, statique = false): Tr[] {
  const r = d / 2;
  const g = 1.35 * w;
  const p = (statique ? 0.72 : 0.82) * w;
  const half: Tr[] = [];
  if (gorge) half.push(L(-g, r, 0, r), L(0, r, 0, r - p), L(0, r - p, g, r - p), L(g, r - p, g, r), L(g, r, 2 * g, r));
  if (joint) half.push(C(g / 2, r - p + w / 2, w / 2), ...hach([Array.from({ length: 16 }, (_, i) => [g / 2 + (w / 2) * Math.cos((i * Math.PI) / 8), r - p + w / 2 + (w / 2) * Math.sin((i * Math.PI) / 8)] as [number, number])], 0.35));
  return [...miroir(half), axe(-g - 3, 2 * g + 3)];
}

/** Bout d'arbre conique 1/10 (NF E 22-051) : fileté (écrou) ou taraudé (vis). */
function boutConique(d: number, l: number, filete: boolean): Tr[] {
  const r = d / 2;
  const r2 = r - l / 20;
  const half: Tr[] = [L(0, r, l, r2)];
  const out: Tr[] = [...miroir(half), L(0, r, 0, -r)];
  if (filete) {
    const dt = Math.round(0.6 * d);
    out.push(...tige(l, l + 0.8 * d, dt, [[l, l + 0.8 * d]]), L(l, r2, l, dt / 2), L(l, -r2, l, -dt / 2));
  } else {
    const dt = Math.round(0.4 * d);
    out.push(L(l, r2, l, -r2), L(l, dt / 2, l - d, dt / 2, 'c'), L(l, -dt / 2, l - d, -dt / 2, 'c'), L(l, (dt - pas(dt)) / 2, l - 0.8 * d, (dt - pas(dt)) / 2, 'c'));
  }
  out.push(axe(-3, l + (filete ? 0.8 * d : 0) + 3));
  return out;
}

/** Arbre cannelé, vu en bout : n cannelures droites (petit diamètre d, grand D, largeur b). */
function cannelures(d: number, D: number, n: number, b: number): Tr[] {
  const out: Tr[] = [];
  const step = 360 / n;
  const rad = (a: number) => (a * Math.PI) / 180;
  const demiB = (r: number) => (Math.asin(Math.min(1, b / 2 / r)) * 180) / Math.PI;
  for (let i = 0; i < n; i++) {
    const a = i * step;
    const aD = demiB(D / 2);
    const ad = demiB(d / 2);
    out.push(A(0, 0, D / 2, a - aD, a + aD));
    out.push(A(0, 0, d / 2, a + ad, a + step - ad));
    for (const s of [-1, 1]) {
      const u = P(Math.cos(rad(a)), Math.sin(rad(a)));
      const v = P(-u.y, u.x);
      const y = (s * b) / 2;
      const x0 = Math.sqrt(Math.max(0, (d / 2) ** 2 - y * y));
      const x1 = Math.sqrt(Math.max(0, (D / 2) ** 2 - y * y));
      out.push(L(u.x * x0 + v.x * y, u.y * x0 + v.y * y, u.x * x1 + v.x * y, u.y * x1 + v.y * y));
    }
  }
  return [...out, ...croix(D * 0.65)];
}

/** Clavette parallèle forme A (bouts ronds), vue de dessus : largeur b, longueur l. */
const clavette = (b: number, l: number): Tr[] => [L(b / 2, b / 2, l - b / 2, b / 2), L(b / 2, -b / 2, l - b / 2, -b / 2), A(b / 2, 0, b / 2, 90, 270), A(l - b / 2, 0, b / 2, -90, 90), axe(-2, l + 2)];

// ======================================================================= Profilés et poutrelles

/** Profil en I ou H (IPE, IPN, HEA…) : hauteur h, largeur b, âme tw, ailes tf ; centré. */
const profilI = (h: number, b: number, tw: number, tf: number): Tr[] =>
  poly([
    [-b / 2, -h / 2], [b / 2, -h / 2], [b / 2, -h / 2 + tf], [tw / 2, -h / 2 + tf], [tw / 2, h / 2 - tf], [b / 2, h / 2 - tf], [b / 2, h / 2],
    [-b / 2, h / 2], [-b / 2, h / 2 - tf], [-tw / 2, h / 2 - tf], [-tw / 2, -h / 2 + tf], [-b / 2, -h / 2 + tf],
  ]);
/** Profil en U (UPN, UAP), dos à gauche. */
const profilU = (h: number, b: number, tw: number, tf: number): Tr[] => poly([[0, -h / 2], [b, -h / 2], [b, -h / 2 + tf], [tw, -h / 2 + tf], [tw, h / 2 - tf], [b, h / 2 - tf], [b, h / 2], [0, h / 2]]);
const corniere = (a: number, b: number, e: number): Tr[] => poly([[0, 0], [b, 0], [b, e], [e, e], [e, a], [0, a]]);
const profilT = (h: number, b: number, e: number): Tr[] => poly([[-b / 2, h], [b / 2, h], [b / 2, h - e], [e / 2, h - e], [e / 2, 0], [-e / 2, 0], [-e / 2, h - e], [-b / 2, h - e]]);

/** Tables des profilés : désignation (hauteur nominale) → dimensions. */
const IPE: Record<number, number[]> = { 80: [80, 46, 3.8, 5.2], 100: [100, 55, 4.1, 5.7], 120: [120, 64, 4.4, 6.3], 140: [140, 73, 4.7, 6.9], 160: [160, 82, 5, 7.4], 180: [180, 91, 5.3, 8], 200: [200, 100, 5.6, 8.5], 220: [220, 110, 5.9, 9.2], 240: [240, 120, 6.2, 9.8], 270: [270, 135, 6.6, 10.2], 300: [300, 150, 7.1, 10.7] };
const IPN: Record<number, number[]> = { 80: [80, 42, 3.9, 5.9], 100: [100, 50, 4.5, 6.8], 120: [120, 58, 5.1, 7.7], 140: [140, 66, 5.7, 8.6], 160: [160, 74, 6.3, 9.5], 180: [180, 82, 6.9, 10.4], 200: [200, 90, 7.5, 11.3], 220: [220, 98, 8.1, 12.2], 240: [240, 106, 8.7, 13.1] };
const HEA: Record<number, number[]> = { 100: [96, 100, 5, 8], 120: [114, 120, 5, 8], 140: [133, 140, 5.5, 8.5], 160: [152, 160, 6, 9], 180: [171, 180, 6, 9.5], 200: [190, 200, 6.5, 10], 220: [210, 220, 7, 11], 240: [230, 240, 7.5, 12], 260: [250, 260, 7.5, 12.5], 280: [270, 280, 8, 13], 300: [290, 300, 8.5, 14] };
const UPN: Record<number, number[]> = { 80: [80, 45, 6, 8], 100: [100, 50, 6, 8.5], 120: [120, 55, 7, 9], 140: [140, 60, 7, 10], 160: [160, 65, 7.5, 10.5], 180: [180, 70, 8, 11], 200: [200, 75, 8.5, 11.5], 220: [220, 80, 9, 12.5], 240: [240, 85, 9.5, 13], 260: [260, 90, 10, 14], 300: [300, 100, 10, 16] };
const UAP: Record<number, number[]> = { 80: [80, 45, 5, 8], 100: [100, 50, 5.5, 8.5], 130: [130, 55, 6, 9.5], 150: [150, 65, 7, 10.25], 175: [175, 70, 7.5, 10.75], 200: [200, 75, 8, 11.5], 220: [220, 80, 8, 12.5], 250: [250, 85, 9, 13.5], 300: [300, 100, 9.5, 16] };

/** Dimensions de la table pour la désignation la plus proche. */
function profil(t: Record<number, number[]>, n: number): number[] {
  const cles = Object.keys(t).map(Number);
  const k = cles.reduce((m, c) => (Math.abs(c - n) < Math.abs(m - n) ? c : m), cles[0]);
  return t[k];
}
const cleProfil = (t: Record<number, number[]>, n: number) => Object.keys(t).map(Number).reduce((m, c) => (Math.abs(c - n) < Math.abs(m - n) ? c : m), Number(Object.keys(t)[0]));

// ======================================================================= Divers : ressort, rondelles coniques, engrenages

function ressort(fil: number, Dm: number, L0: number, n: number): Tr[] {
  const out: Tr[] = [];
  const p = (L0 - fil) / n;
  for (let i = 0; i <= n; i++) {
    const x = fil / 2 + i * p;
    out.push(C(x, Dm / 2, fil / 2), C(x + p / 2, -Dm / 2, fil / 2));
    if (i < n) out.push(L(x, Dm / 2 + fil / 2, x + p / 2, -Dm / 2 + fil / 2, 'f'), L(x + p / 2, -Dm / 2 - fil / 2, x + p, Dm / 2 - fil / 2, 'c'));
  }
  out.push(axe(-3, L0 + 3));
  return out;
}

function rondellesConiques(De: number, Di: number, t: number, h0: number, n: number): Tr[] {
  const out: Tr[] = [];
  for (let i = 0; i < n; i++) {
    const x = i * h0;
    const sens = i % 2 === 0 ? 1 : -1;
    for (const sg of [1, -1]) {
      const xa = sens > 0 ? x : x + h0;
      const xb = sens > 0 ? x + h0 - t : x + t;
      out.push(...coupe([[xa, sg * Di / 2], [xa + (sens > 0 ? t : -t), sg * Di / 2], [xb + (sens > 0 ? t : -t), sg * De / 2], [xb, sg * De / 2]], 0.5));
    }
  }
  out.push(axe(-3, n * h0 + 3));
  return out;
}

/** Engrenage droit en coupe : module m, z dents, largeur b ; cercles de tête et de pied, cercle primitif en mixte. */
function engrenage(m: number, z: number, b: number, alesage: number): Tr[] {
  const ra = (m * (z + 2)) / 2;
  const rp = (m * z) / 2;
  const rf = (m * (z - 2.5)) / 2;
  const half: Tr[] = [...coupe([[0, alesage / 2], [b, alesage / 2], [b, ra], [0, ra]], 2), L(0, rf, b, rf), L(-2, rp, b + 2, rp, 'a')];
  return [...miroir(half), axe(-3, b + 3)];
}

function engrenageConique(m: number, z: number, b: number, alesage: number): Tr[] {
  const rp = (m * z) / 2;
  const half: Tr[] = [...coupe([[0, alesage / 2], [b * 1.6, alesage / 2], [b * 1.6, rp * 0.55], [b, rp - b * 0.6], [0, rp + m]], 2), L(-2, rp, b * 0.8, rp - b * 0.6, 'a')];
  return [...miroir(half), axe(-3, b * 1.6 + 3)];
}

// ======================================================================= Cartouche

/** Champs d'un cartouche (paramètres du plan, case F1). */
export interface ChampsCartouche {
  societe?: string;
  designation?: string;
  reference?: string;
  dessinateur?: string;
  date?: string;
  echelle?: string;
  format?: string;
  revision?: string;
}

/**
 * Cartouche : coin inférieur droit au point de référence (origine), largeur 180 mm (NF E 04-503 simplifiée).
 * Avec `nomenclature`, un tableau Rep / Nb / Désignation / Référence posé dessus.
 */
export function cartouche(c: ChampsCartouche, nomenclature?: { rep: string; nb: string; designation: string; reference: string }[]): Tr[] {
  const l = 180;
  const hh = 36;
  const x0 = -l;
  const out: Tr[] = [...R(x0, 0, 0, hh)];
  const col = [x0, x0 + 50, x0 + 130, 0];
  out.push(L(col[1], 0, col[1], hh), L(col[2], 0, col[2], hh), L(x0, 12, 0, 12), L(col[1], 24, col[2], 24), L(col[2], 24, 0, 24));
  const t = (x: number, y: number, texte: string, h = 2.5): Tr => ({ p: { type: 'texte', p: P(x, y), h, angle: 0, texte, alignH: 'gauche', alignV: 'ligne' }, s: 'n' });
  out.push(t(x0 + 2, hh - 6, c.societe ?? '', 3.5));
  out.push(t(x0 + 2, 4, `Dessiné par : ${c.dessinateur ?? ''}`));
  out.push(t(col[1] + 2, 28, c.designation ?? '', 5));
  out.push(t(col[1] + 2, 16, `Échelle : ${c.echelle ?? '1:1'}`), t(col[1] + 2, 4, `Format : ${c.format ?? ''}`));
  out.push(t(col[2] + 2, 28, `Réf. ${c.reference ?? ''}`, 3.5), t(col[2] + 2, 16, `Date : ${c.date ?? ''}`), t(col[2] + 2, 4, `Indice : ${c.revision ?? ''}`));
  if (nomenclature) {
    const pas = 7;
    const lignes = [{ rep: 'Rep', nb: 'Nb', designation: 'Désignation', reference: 'Référence' }, ...nomenclature];
    const xs = [x0, x0 + 15, x0 + 30, x0 + 130, 0];
    lignes.forEach((r, i) => {
      const y = hh + i * pas;
      out.push(...R(x0, y, 0, y + pas));
      [r.rep, r.nb, r.designation, r.reference].forEach((v, j) => out.push(t(xs[j] + 1.5, y + 2, v)));
      for (let j = 1; j < 4; j++) out.push(L(xs[j], y, xs[j], y + pas));
    });
  }
  return out;
}

// ======================================================================= Le catalogue

const q = (texte: string, defaut: number | ((v: number[]) => number)): QuestionPiece => ({ texte, defaut: typeof defaut === 'number' ? () => defaut : defaut });
const qd = (defaut = 10) => q('Diamètre nominal (M)', defaut);
const ql = (f = (v: number[]) => Math.max(10, Math.round((2.5 * v[0]) / 5) * 5)) => q('Longueur', f);
const qRoulement = (d = 20) => [q('Alésage d (ou désignation 6204…)', d), q('Diamètre extérieur D', (v) => roulementNormalise(v[0])?.D ?? serie62(v[0]).D), q('Largeur B', (v) => roulementNormalise(v[0])?.B ?? serie62(v[0]).B)];
/** Alésage, D, B : la désignation d'un roulement normalisé (6204) donne ses dimensions. */
const dims = (v: number[]) => {
  const n = roulementNormalise(v[0]);
  return n ? { d: n.d, D: v[1], B: v[2], nom: String(Math.round(v[0])) } : { d: v[0], D: v[1], B: v[2], nom: `${nb(v[0])}x${nb(v[1])}x${nb(v[2])}` };
};
const roul = (code: string, libelle: string, f: (d: number, D: number, B: number) => Tr[], d = 20): Piece => ({
  code,
  libelle,
  questions: qRoulement(d),
  dessin: (v) => {
    const x = dims(v);
    return f(x.d, x.D, x.B);
  },
  designation: (v) => `${libelle.replace(/\.$/, '')} ${dims(v).nom}`,
});

export const PIECES: Piece[] = [
  // Ligne I : vis de profil, goujon, tige, ressort, rondelles coniques
  ...(
    [
      ['I01', 'Vis H.', 'H'],
      ['I02', 'Vis Q.', 'Q'],
      ['I03', 'Vis Chc.', 'CHc'],
      ['I04', 'Vis C.', 'C'],
      ['I05', 'Vis CL.', 'CL'],
      ['I06', 'Vis Fhc.', 'Fhc'],
      ['I07', 'Vis FB90.', 'FB90'],
    ] as [string, string, Tete][]
  ).map(([code, libelle, t]): Piece => ({
    code,
    libelle,
    questions: [qd(), ql()],
    dessin: (v) => vis(t, v[0], v[1]),
    designation: (v) => `${libelle.replace(/\.$/, '')} M${nb(v[0])}-${nb(v[1])}`,
  })),
  {
    code: 'I08',
    libelle: 'Goujon.',
    questions: [qd(), ql((v) => 4 * v[0])],
    dessin: ([d, l]) => [...tige(0, l, d, [[0, 1.25 * d], [l - filetVis(d, l / 2), l]], true), axe(-2, l + 2)],
    designation: ([d, l]) => `Goujon M${nb(d)}-${nb(l)}`,
  },
  { code: 'I09', libelle: 'Tige filetée.', questions: [qd(), ql((v) => 10 * v[0])], dessin: ([d, l]) => [...tige(0, l, d, [[0, l]], true), axe(-2, l + 2)], designation: ([d, l]) => `Tige filetée M${nb(d)}-${nb(l)}` },
  {
    code: 'I11',
    libelle: 'Ressort hélicoïdal de compression.',
    questions: [q('Diamètre du fil', 2), q('Diamètre moyen', (v) => 8 * v[0]), q('Longueur libre', (v) => 3 * v[1]), q('Nombre de spires utiles', 6)],
    dessin: ([f, D, L0, n]) => ressort(f, D, L0, Math.max(1, Math.round(n))),
    designation: ([f, D, L0]) => `Ressort de compression ${nb(f)}x${nb(D)}x${nb(L0)}`,
  },
  {
    code: 'I14',
    libelle: 'Empilage de rondelles coniques.',
    questions: [q('Diamètre extérieur', 40), q('Diamètre intérieur', (v) => Math.round(v[0] * 0.51)), q('Épaisseur', (v) => Math.round(v[0] * 0.05 * 10) / 10), q('Hauteur d\'une rondelle', (v) => Math.round(v[2] * 1.4 * 10) / 10), q('Nombre de rondelles', 4)],
    dessin: ([De, Di, t, h0, n]) => rondellesConiques(De, Di, t, h0, Math.max(1, Math.round(n))),
    designation: ([De, Di, t]) => `Rondelles coniques ${nb(De)}x${nb(Di)}x${nb(t)}`,
  },
  // Ligne J : vis vues de dessus, vis de pression, goupilles
  ...(
    [
      ['J01', 'Vis H (vue de dessus).', 'H'],
      ['J02', 'Vis Q (vue de dessus).', 'Q'],
      ['J03', 'Vis Chc (vue de dessus).', 'CHc'],
      ['J04', 'Vis C (vue de dessus).', 'C'],
      ['J05', 'Vis CL (vue de dessus).', 'CL'],
    ] as [string, string, 'H' | 'Q' | 'CHc' | 'C' | 'CL'][]
  ).map(([code, libelle, t]): Piece => ({ code, libelle, questions: [qd()], dessin: ([d]) => teteDessus(t, d), designation: ([d]) => `${libelle.replace(/ \(vue de dessus\)\.$/, '')} M${nb(d)}` })),
  ...(
    [
      ['J06', 'Vis à bout plat.', 'plat'],
      ['J07', 'Vis à bout pointu.', 'pointu'],
      ['J08', 'Vis à bout à cuvette.', 'cuvette'],
      ['J09', 'Vis à téton long.', 'tetonLong'],
      ['J10', 'Vis à téton court.', 'tetonCourt'],
    ] as [string, string, 'plat' | 'pointu' | 'cuvette' | 'tetonLong' | 'tetonCourt'][]
  ).map(([code, libelle, b]): Piece => ({ code, libelle, questions: [qd(8), ql((v) => 2 * v[0])], dessin: ([d, l]) => visPression(b, d, l), designation: ([d, l]) => `${libelle.replace(/\.$/, '')} M${nb(d)}-${nb(l)}` })),
  ...(
    [
      ['J11', 'Goupille élastique (Mecanindus).', 'elastique'],
      ['J12', 'Goupille type A.', 'A'],
      ['J13', 'Goupille type B.', 'B'],
      ['J14', 'Goupille type C.', 'C'],
      ['J15', 'Goupille conique.', 'conique'],
    ] as [string, string, 'elastique' | 'A' | 'B' | 'C' | 'conique'][]
  ).map(([code, libelle, t]): Piece => ({ code, libelle, questions: [q('Diamètre', 5), ql((v) => 5 * v[0])], dessin: ([d, l]) => goupille(t, d, l), designation: ([d, l]) => `${libelle.replace(/\.$/, '')} ${nb(d)}x${nb(l)}` })),
  // Ligne K : écrous de profil
  ...(
    [
      ['K01', 'Ecrou H vu sur 3 pans.', 'H3'],
      ['K02', 'Ecrou freiné (Nylstop).', 'nylstop'],
      ['K03', 'Ecrou à créneaux.', 'creneaux'],
      ['K04', 'Ecrou borgne.', 'borgne'],
      ['K06', 'Ecrou à embase.', 'embase'],
      ['K07', 'Ecrou H vu sur 2 pans.', 'H2'],
    ] as [string, string, 'H3' | 'H2' | 'nylstop' | 'creneaux' | 'borgne' | 'embase'][]
  ).map(([code, libelle, t]): Piece => ({ code, libelle, questions: [qd()], dessin: ([d]) => ecrouProfil(t, d), designation: ([d]) => `${libelle.replace(/ vu sur \d pans\.$|\.$/, '')} M${nb(d)}` })),
  { code: 'K09', libelle: 'Ecrou à encoches KM et rondelle frein MB.', questions: [q('Diamètre (filetage)', 20)], dessin: ([d]) => ecrouKM(d, false), designation: ([d]) => `Ecrou KM et rondelle MB pour arbre de ${nb(d)}` },
  // Ligne L : écrous de dessus, rondelles, anneaux
  ...(
    [
      ['L01', 'Ecrou H (vue de dessus).', 'H'],
      ['L02', 'Ecrou freiné Nylstop (vue de dessus).', 'nylstop'],
      ['L03', 'Ecrou à créneaux (vue de dessus).', 'creneaux'],
      ['L04', 'Ecrou à embase (vue de dessus).', 'embase'],
    ] as [string, string, 'H' | 'nylstop' | 'creneaux' | 'embase'][]
  ).map(([code, libelle, t]): Piece => ({ code, libelle, questions: [qd()], dessin: ([d]) => ecrouDessus(t, d), designation: ([d]) => `${libelle.replace(/ \(vue de dessus\)\.$/, '')} M${nb(d)}` })),
  ...(
    [
      ['L06', 'Rondelle plate.', 'plate'],
      ['L07', 'Rondelle Grower.', 'grower'],
      ['L08', 'Rondelle éventail.', 'eventail'],
    ] as [string, string, 'plate' | 'grower' | 'eventail'][]
  ).map(([code, libelle, t]): Piece => ({ code, libelle, questions: [q('Pour vis de diamètre', 10)], dessin: ([d]) => rondelle(t, d), designation: ([d]) => `${libelle.replace(/\.$/, '')} M${nb(d)}` })),
  { code: 'L09', libelle: 'Ecrou à encoches KM et frein (vue de dessus).', questions: [q('Diamètre (filetage)', 20)], dessin: ([d]) => ecrouKM(d, true), designation: ([d]) => `Ecrou KM pour arbre de ${nb(d)}` },
  { code: 'L11', libelle: 'Anneau élastique pour arbre.', questions: [q("Diamètre de l'arbre", 20)], dessin: ([d]) => anneau(true, d), designation: ([d]) => `Anneau élastique pour arbre ${nb(d)}` },
  { code: 'L12', libelle: 'Anneau élastique pour alésage.', questions: [q("Diamètre de l'alésage", 40)], dessin: ([d]) => anneau(false, d), designation: ([d]) => `Anneau élastique pour alésage ${nb(d)}` },
  { code: 'L13', libelle: "Segment d'arrêt pour arbre INA.", questions: [q("Diamètre de l'arbre", 20)], dessin: ([d]) => anneau(true, d, true), designation: ([d]) => `Segment d'arrêt pour arbre ${nb(d)}` },
  { code: 'L14', libelle: "Segment d'arrêt pour alésage INA.", questions: [q("Diamètre de l'alésage", 40)], dessin: ([d]) => anneau(false, d, true), designation: ([d]) => `Segment d'arrêt pour alésage ${nb(d)}` },
  // Ligne M : roulements à billes
  roul('M01', 'Roulement rigide à billes.', (d, D, B) => roulement(d, D, B, 'bille')),
  roul('M02', 'Roulement rigide à billes à rainure.', (d, D, B) => roulement(d, D, B, 'bille', { rainure: true })),
  roul('M03', 'Roulement à contact oblique.', (d, D, B) => roulement(d, D, B, 'bille', { contact: 40 })),
  roul('M04', 'Roulement à contact oblique pour broche.', (d, D, B) => roulement(d, D, B, 'bille', { contact: 15 })),
  roul('M05', 'Roulement double à contact oblique.', (d, D, B) => roulement(d, D, B, 'bille', { rangs: 2, contact: 30 })),
  roul('M06', 'Roulement à 4 points de contact.', (d, D, B) => roulement(d, D, B, 'bille', { contact: 35, quatrePoints: true })),
  roul('M07', 'Roulement sphérique à billes.', (d, D, B) => roulement(d, D, B, 'bille', { rangs: 2, spherique: true })),
  roul('M08', 'Roulement sphérique à billes (bague élargie).', (d, D, B) => roulement(d, D, B, 'bille', { rangs: 2, spherique: true, bagueLarge: B * 1.6 })),
  roul('M09', 'Roulement sphérique à 1 rangée de tonnelets.', (d, D, B) => roulement(d, D, B, 'tonnelet', { spherique: true })),
  roul('M10', 'Roulement sphérique à 2 rangées de galets.', (d, D, B) => roulement(d, D, B, 'tonnelet', { rangs: 2, spherique: true })),
  {
    code: 'M11',
    libelle: 'Douille à billes INA.',
    questions: [q('Diamètre de l\'arbre', 20), q('Diamètre extérieur', (v) => Math.round(v[0] * 1.4)), q('Longueur', (v) => Math.round(v[0] * 2.2))],
    dessin: ([d, D, l]) => roulement(d, D, l, 'bille', { rangs: Math.max(3, Math.round(l / ((D - d) / 2))) }),
    designation: ([d]) => `Douille à billes pour arbre ${nb(d)}`,
  },
  // Ligne N : roulements à rouleaux
  roul('N01', 'Roulement cylindrique NU.', (d, D, B) => roulement(d, D, B, 'rouleau', { epaulementsExt: 2 })),
  roul('N02', 'Roulement cylindrique NJ.', (d, D, B) => roulement(d, D, B, 'rouleau', { epaulementsExt: 2, epaulementsInt: 1 })),
  roul('N03', 'Roulement cylindrique NUP.', (d, D, B) => roulement(d, D, B, 'rouleau', { epaulementsExt: 2, epaulementsInt: 2 })),
  roul('N04', 'Roulement cylindrique N.', (d, D, B) => roulement(d, D, B, 'rouleau', { epaulementsInt: 2 })),
  roul('N06', 'Roulement cylindrique NNU.', (d, D, B) => roulement(d, D, B, 'rouleau', { rangs: 2, epaulementsExt: 2 })),
  roul('N08', 'Roulement à galets coniques.', (d, D, B) => roulement(d, D, B, 'conique')),
  roul('N10', 'Roulement à galets coniques double.', (d, D, B) => roulement(d, D, 2 * B, 'conique', { rangs: 2 })),
  // Ligne O : aiguilles, galets, rotules
  roul('O01', 'Roulement à aiguilles.', (d, D, B) => roulement(d, D, B, 'aiguille', { epaulementsExt: 2 }), 25),
  roul('O02', 'Douille à aiguilles.', (d, D, B) => roulement(d, D, B, 'aiguille'), 25),
  roul('O03', 'Douille à aiguilles avec fond.', (d, D, B) => [...roulement(d, D, B, 'aiguille'), L(B, D / 2, B, -D / 2)], 25),
  roul('O04', 'Cage à aiguilles.', (d, D, B) => cageAiguilles(d, D, B), 25),
  roul('O05', "Roulement à deux rangées d'aiguilles.", (d, D, B) => roulement(d, D, B, 'aiguille', { rangs: 2, epaulementsExt: 2 }), 25),
  roul('O09', "Galet d'appui à rouleaux.", (d, D, B) => roulement(d, D, B, 'rouleau', { epaulementsExt: 2 }), 15),
  {
    code: 'O10',
    libelle: 'Galet de came avec axe INA.',
    questions: [q("Diamètre de l'axe", 10), q('Diamètre extérieur', (v) => Math.round(v[0] * 2.6)), q('Largeur', (v) => Math.round(v[0] * 1.2))],
    dessin: ([d, D, B]) => [...roulement(d, D, B, 'aiguille'), ...tige(B, B + 2.2 * d, d, [[B + 1.2 * d, B + 2.2 * d]]), ...R(-0.15 * B, -d * 0.75, 0, d * 0.75)],
    designation: ([d, D]) => `Galet de came ${nb(D)} axe ${nb(d)}`,
  },
  { code: 'O11', libelle: 'Rotule lisse frittée.', questions: [q('Alésage', 10), q('Diamètre extérieur', (v) => 2 * v[0]), q('Largeur', (v) => v[0])], dessin: ([d, D, B]) => bague(d, D, B, { spherique: true }), designation: ([d]) => `Rotule lisse frittée ${nb(d)}` },
  { code: 'O12', libelle: 'Rotule lisse frittée à contact oblique.', questions: [q('Alésage', 10), q('Diamètre extérieur', (v) => 2 * v[0]), q('Largeur', (v) => v[0])], dessin: ([d, D, B]) => bague(d, D, B, { spherique: true, oblique: true }), designation: ([d]) => `Rotule frittée à contact oblique ${nb(d)}` },
  { code: 'O13', libelle: 'Rotule lisse frittée axiale.', questions: [q('Alésage', 10), q('Diamètre extérieur', (v) => 2 * v[0]), q('Largeur', (v) => v[0])], dessin: ([d, D, B]) => bague(d, D, B, { spherique: true, axiale: true }), designation: ([d]) => `Rotule frittée axiale ${nb(d)}` },
  // Ligne P : butées et paliers lisses
  ...(
    [
      ['P01', 'Butée à aiguilles avec cage en tôle.', 'aiguille', {}],
      ['P02', 'Butée à aiguilles.', 'aiguille', {}],
      ['P03', 'Butée double effet centrée sur alésage.', 'bille', { double: true }],
      ['P04', 'Butée double effet centrée sur arbre.', 'bille', { double: true, centreArbre: true }],
      ['P05', 'Butée à billes simple effet.', 'bille', {}],
      ['P06', 'Butée à billes simple effet, appui sphérique.', 'bille', { spherique: true }],
      ['P07', 'Butée à billes double effet.', 'bille', { double: true }],
      ['P08', 'Butée à billes double effet, appuis sphériques.', 'bille', { double: true, spherique: true }],
      ['P09', 'Butée à galets cylindriques.', 'rouleau', {}],
      ['P10', 'Butée à rotule sur rouleaux.', 'tonnelet', { spherique: true }],
    ] as [string, string, 'bille' | 'aiguille' | 'rouleau' | 'tonnelet', { double?: boolean; spherique?: boolean; centreArbre?: boolean }][]
  ).map(([code, libelle, el, o]): Piece => ({
    code,
    libelle,
    questions: [q('Alésage d', 20), q('Diamètre extérieur D', (v) => Math.round(v[0] * 1.8)), q('Hauteur H', (v) => Math.round(v[0] * (o.double ? 0.7 : 0.45)))],
    dessin: ([d, D, H]) => butee(d, D, H, el, o),
    designation: ([d, D, H]) => `${libelle.replace(/\.$/, '')} ${nb(d)}x${nb(D)}x${nb(H)}`,
  })),
  {
    code: 'P11',
    libelle: 'Coussinet cylindrique à collerette.',
    questions: [q('Alésage', 20), q('Diamètre extérieur', (v) => Math.round(v[0] * 1.15 + 2)), q('Longueur', (v) => v[0]), q('Diamètre de la collerette', (v) => Math.round(v[1] * 1.3))],
    dessin: ([d, D, l, Dc]) => bague(d, D, l, { collerette: { D: Dc, e: Math.max(1, 0.1 * d) } }),
    designation: ([d, D, l]) => `Coussinet à collerette ${nb(d)}x${nb(D)}x${nb(l)}`,
  },
  { code: 'P12', libelle: 'Coussinet cylindrique.', questions: [q('Alésage', 20), q('Diamètre extérieur', (v) => Math.round(v[0] * 1.15 + 2)), q('Longueur', (v) => v[0])], dessin: ([d, D, l]) => bague(d, D, l), designation: ([d, D, l]) => `Coussinet ${nb(d)}x${nb(D)}x${nb(l)}` },
  { code: 'P13', libelle: 'Palier lisse fritté sphérique.', questions: [q('Alésage', 12), q('Diamètre extérieur', (v) => 2 * v[0]), q('Largeur', (v) => v[0])], dessin: ([d, D, B]) => bague(d, D, B, { spherique: true }), designation: ([d]) => `Palier fritté sphérique ${nb(d)}` },
  // Ligne Q : joints à lèvres, bouts d'arbres, cannelures, clavette
  ...(
    [
      ['Q01', 'Joint à lèvres type II.', false, false],
      ['Q02', 'Joint à lèvres type IELR.', true, true],
      ['Q03', 'Joint à lèvres type IEL.', true, false],
      ['Q04', 'Joint à lèvres type IE.', false, true],
    ] as [string, string, boolean, boolean][]
  ).map(([code, libelle, ressortJ, poussiere]): Piece => ({
    code,
    libelle,
    questions: [q("Diamètre de l'arbre", 30), q('Diamètre extérieur', (v) => Math.round(v[0] + 12 + 0.1 * v[0])), q('Largeur', (v) => (v[0] < 50 ? 7 : 10))],
    dessin: ([d, D, B]) => jointLevres(d, D, B, ressortJ, poussiere),
    designation: ([d, D, B]) => `${libelle.replace(/\.$/, '')} ${nb(d)}x${nb(D)}x${nb(B)}`,
  })),
  {
    code: 'Q06',
    libelle: 'Joint V-RING type A ou S.',
    questions: [q("Diamètre de l'arbre", 30)],
    dessin: ([d]) => {
      const r = d / 2;
      const b = 0.15 * d + 2;
      const half = poly([[0, r], [b * 0.6, r], [b * 0.6, r + b * 0.6], [b * 1.5, r + b * 1.4], [b * 1.35, r + b * 1.5], [b * 0.4, r + b * 0.8], [0, r + b * 0.8]]);
      return [...miroir(half), axe(-3, b * 1.5 + 3)];
    },
    designation: ([d]) => `Joint V-ring ${nb(d)}`,
  },
  { code: 'Q11', libelle: "Bout d'arbre conique fileté.", questions: [q("Diamètre de l'arbre", 30), q('Longueur du cône', (v) => 1.6 * v[0])], dessin: ([d, l]) => boutConique(d, l, true), designation: ([d]) => `Bout d'arbre conique fileté ${nb(d)}` },
  { code: 'Q12', libelle: "Bout d'arbre conique taraudé.", questions: [q("Diamètre de l'arbre", 30), q('Longueur du cône', (v) => 1.6 * v[0])], dessin: ([d, l]) => boutConique(d, l, false), designation: ([d]) => `Bout d'arbre conique taraudé ${nb(d)}` },
  {
    code: 'Q13',
    libelle: 'Cannelures droites.',
    questions: [q('Petit diamètre d', 26), q('Grand diamètre D', (v) => Math.round(v[0] * 1.15)), q('Nombre de cannelures', 6), q('Largeur des cannelures', (v) => Math.round(v[0] * 0.23))],
    dessin: ([d, D, n, b]) => cannelures(d, D, Math.max(3, Math.round(n)), b),
    designation: ([d, D, n]) => `Cannelures ${Math.round(n)}x${nb(d)}x${nb(D)}`,
  },
  { code: 'Q14', libelle: 'Clavette longitudinale.', questions: [q('Largeur b', 8), q('Longueur', 40)], dessin: ([b, l]) => clavette(b, l), designation: ([b, l]) => `Clavette parallèle forme A ${nb(b)}x${nb(Math.round(b * 0.875))}x${nb(l)}` },
  // Ligne R : joints toriques et divers
  { code: 'R01', libelle: 'Gorge pour joint torique.', questions: [q("Diamètre de l'arbre", 30), q('Diamètre du tore', 3)], dessin: ([d, w]) => jointTorique(d, w, true, false), designation: ([d, w]) => `Gorge pour joint torique ${nb(d)}x${nb(w)}` },
  { code: 'R02', libelle: 'Joint torique dynamique.', questions: [q("Diamètre de l'arbre", 30), q('Diamètre du tore', 3)], dessin: ([d, w]) => jointTorique(d, w, true, true), designation: ([d, w]) => `Joint torique ${nb(d - 2 * 0.82 * w)}x${nb(w)}` },
  { code: 'R03', libelle: 'Joint torique statique.', questions: [q("Diamètre de l'arbre", 30), q('Diamètre du tore', 3)], dessin: ([d, w]) => jointTorique(d, w, true, true, true), designation: ([d, w]) => `Joint torique ${nb(d - 2 * 0.72 * w)}x${nb(w)}` },
  {
    code: 'R04',
    libelle: 'Joint de translation BAL SEAL.',
    questions: [q('Diamètre de la tige', 20), q('Largeur', 5)],
    dessin: ([d, b]) => {
      const r = d / 2;
      const h = 0.8 * b;
      const half = [...poly([[0, r], [b, r], [b, r + h], [0.7 * b, r + h], [0.7 * b, r + 0.35 * h], [0.3 * b, r + 0.35 * h], [0.3 * b, r + h], [0, r + h]]), C(0.5 * b, r + 0.62 * h, 0.18 * b)];
      return [...miroir(half), axe(-3, b + 3)];
    },
    designation: ([d]) => `Joint BAL SEAL pour tige ${nb(d)}`,
  },
  {
    code: 'R05',
    libelle: 'Joint composite LUBRORING.',
    questions: [q('Diamètre de la tige', 20), q('Largeur', 4)],
    dessin: ([d, b]) => {
      const r = d / 2;
      const half = [...R(0, r, b, r + 0.5 * b), C(b / 2, r + 0.5 * b + 0.3 * b, 0.3 * b)];
      return [...miroir(half), axe(-3, b + 3)];
    },
    designation: ([d]) => `Joint composite pour tige ${nb(d)}`,
  },
  {
    code: 'R06',
    libelle: 'Joint racleur de tige.',
    questions: [q('Diamètre de la tige', 20), q('Largeur', 6)],
    dessin: ([d, b]) => {
      const r = d / 2;
      const half = poly([[0, r + 0.3 * b], [0.25 * b, r], [0.45 * b, r + 0.25 * b], [0.45 * b, r + 0.15 * b], [b, r + 0.15 * b], [b, r + b], [0, r + b]]);
      return [...miroir(half), axe(-3, b + 3)];
    },
    designation: ([d]) => `Racleur pour tige ${nb(d)}`,
  },
  {
    code: 'R07',
    libelle: 'Membrane Bellofram.',
    questions: [q('Diamètre du piston', 40), q('Course', 20)],
    dessin: ([d, c]) => {
      const r = d / 2;
      const half = [...R(0, 0, c, r, 'n'), A(c, r + 2, 2, -90, 90), L(c, r + 4, -2, r + 4), L(-2, r + 4, -2, r + 8)];
      return [...miroir(half), axe(-5, c + 5)];
    },
    designation: ([d]) => `Membrane ${nb(d)}`,
  },
  {
    code: 'R11',
    libelle: 'Entretoise.',
    questions: [q('Alésage', 20), q('Diamètre extérieur', (v) => Math.round(v[0] * 1.4)), q('Longueur', 10)],
    dessin: ([d, D, l]) => bague(d, D, l),
    designation: ([d, D, l]) => `Entretoise ${nb(d)}x${nb(D)}x${nb(l)}`,
  },
  // Ligne S : profils, tubes, engrenages
  { code: 'S01', libelle: 'Profil rond, NF A 45-003/411.', questions: [q('Diamètre', 20)], dessin: ([d]) => [C(0, 0, d / 2), ...hach([Array.from({ length: 32 }, (_, i) => [(d / 2) * Math.cos((i * Math.PI) / 16), (d / 2) * Math.sin((i * Math.PI) / 16)] as [number, number])], Math.max(1, d / 12)), ...croix(d * 0.7)], designation: ([d]) => `Rond Ø${nb(d)}` },
  { code: 'S02', libelle: 'Profil hexagonal, NF A 45-005/413.', questions: [q('Sur plats', 20)], dessin: ([s]) => [...hexagone(s), ...hach([Array.from({ length: 6 }, (_, i) => [(s / Math.sqrt(3)) * Math.cos((i * Math.PI) / 3), (s / Math.sqrt(3)) * Math.sin((i * Math.PI) / 3)] as [number, number])], Math.max(1, s / 12)), ...croix(s * 0.7)], designation: ([s]) => `Hexagone ${nb(s)}` },
  { code: 'S03', libelle: 'Profil carré, NF A 45-004/412.', questions: [q('Côté', 20)], dessin: ([a]) => [...coupe([[-a / 2, -a / 2], [a / 2, -a / 2], [a / 2, a / 2], [-a / 2, a / 2]], Math.max(1, a / 12)), ...croix(a * 0.7)], designation: ([a]) => `Carré ${nb(a)}` },
  { code: 'S04', libelle: 'Profil plat, NF A 45-005.', questions: [q('Largeur', 40), q('Épaisseur', 8)], dessin: ([b, e]) => coupe([[-b / 2, -e / 2], [b / 2, -e / 2], [b / 2, e / 2], [-b / 2, e / 2]], Math.max(1, e / 4)), designation: ([b, e]) => `Plat ${nb(b)}x${nb(e)}` },
  {
    code: 'S05',
    libelle: 'Tube mécanique, NF A 49-310/311.',
    questions: [q('Diamètre extérieur', 40), q('Épaisseur', 4)],
    dessin: ([D, e]) => {
      const cercle = (r: number) => Array.from({ length: 32 }, (_, i) => [r * Math.cos((i * Math.PI) / 16), r * Math.sin((i * Math.PI) / 16)] as [number, number]);
      return [C(0, 0, D / 2), C(0, 0, D / 2 - e), ...hach([cercle(D / 2), cercle(D / 2 - e)], Math.max(1, D / 20)), ...croix(D * 0.7)];
    },
    designation: ([D, e]) => `Tube Ø${nb(D)}x${nb(e)}`,
  },
  { code: 'S11', libelle: 'Engrenage parallèle droit.', questions: [q('Module', 2), q('Nombre de dents', 30), q('Largeur', (v) => 10 * v[0]), q('Alésage', (v) => Math.round(v[0] * v[1] * 0.3))], dessin: ([m, z, b, a]) => engrenage(m, Math.round(z), b, a), designation: ([m, z]) => `Roue dentée m${nb(m)} Z${Math.round(z)}` },
  { code: 'S12', libelle: 'Engrenage conique droit.', questions: [q('Module', 2), q('Nombre de dents', 25), q('Largeur de denture', (v) => 8 * v[0]), q('Alésage', (v) => Math.round(v[0] * v[1] * 0.3))], dessin: ([m, z, b, a]) => engrenageConique(m, Math.round(z), b, a), designation: ([m, z]) => `Roue conique m${nb(m)} Z${Math.round(z)}` },
  // Ligne T : poutrelles et profilés, cartouches
  { code: 'T01', libelle: 'Poutrelle UAP NF A 45-255.', questions: [q('Hauteur (UAP 80 à 300)', 100)], dessin: ([n]) => profilU(...(profil(UAP, n) as [number, number, number, number])), designation: ([n]) => `UAP ${cleProfil(UAP, n)}` },
  { code: 'T02', libelle: 'Poutrelle UPN NF A 45-007.', questions: [q('Hauteur (UPN 80 à 300)', 100)], dessin: ([n]) => profilU(...(profil(UPN, n) as [number, number, number, number])), designation: ([n]) => `UPN ${cleProfil(UPN, n)}` },
  { code: 'T03', libelle: 'Poutrelle IPE.', questions: [q('Hauteur (IPE 80 à 300)', 200)], dessin: ([n]) => profilI(...(profil(IPE, n) as [number, number, number, number])), designation: ([n]) => `IPE ${cleProfil(IPE, n)}` },
  { code: 'T04', libelle: 'Poutrelle IPN.', questions: [q('Hauteur (IPN 80 à 240)', 200)], dessin: ([n]) => profilI(...(profil(IPN, n) as [number, number, number, number])), designation: ([n]) => `IPN ${cleProfil(IPN, n)}` },
  { code: 'T05', libelle: 'Poutrelle HEA HEB,HEM.', questions: [q('Désignation (HEA 100 à 300)', 200)], dessin: ([n]) => profilI(...(profil(HEA, n) as [number, number, number, number])), designation: ([n]) => `HEA ${cleProfil(HEA, n)}` },
  { code: 'T06', libelle: 'Cornière à ailes égales, NF A 45-009.', questions: [q('Aile', 40), q('Épaisseur', (v) => Math.round(v[0] / 10))], dessin: ([a, e]) => corniere(a, a, e), designation: ([a, e]) => `Cornière ${nb(a)}x${nb(a)}x${nb(e)}` },
  { code: 'T07', libelle: 'Cornière à ailes inégales, NF A 45-010.', questions: [q('Grande aile', 60), q('Petite aile', 40), q('Épaisseur', 5)], dessin: ([a, b, e]) => corniere(a, b, e), designation: ([a, b, e]) => `Cornière ${nb(a)}x${nb(b)}x${nb(e)}` },
  { code: 'T08', libelle: 'Profil en T, NF A 45-008.', questions: [q('Hauteur', 40), q('Largeur', (v) => v[0]), q('Épaisseur', (v) => Math.round(v[0] / 8))], dessin: ([h, b, e]) => profilT(h, b, e), designation: ([h, b, e]) => `T ${nb(h)}x${nb(b)}x${nb(e)}` },
  {
    code: 'T10',
    libelle: 'Profil en C, (Aciérie de la Seine).',
    questions: [q('Hauteur', 100), q('Largeur', 50), q('Retour', 15), q('Épaisseur', 2)],
    dessin: ([h, b, c, e]) => poly([[0, -h / 2], [b, -h / 2], [b, -h / 2 + c], [b - e, -h / 2 + c], [b - e, -h / 2 + e], [e, -h / 2 + e], [e, h / 2 - e], [b - e, h / 2 - e], [b - e, h / 2 - c], [b, h / 2 - c], [b, h / 2], [0, h / 2]]),
    designation: ([h, b, c, e]) => `Profil C ${nb(h)}x${nb(b)}x${nb(c)}x${nb(e)}`,
  },
  {
    code: 'T11',
    libelle: 'Profil en OMEGA, (Aciérie de la Seine).',
    questions: [q('Hauteur', 40), q('Largeur du dessus', 40), q('Largeur des ailes', 20), q('Épaisseur', 2)],
    dessin: ([h, b, a, e]) =>
      poly([[-b / 2 - a, 0], [-b / 2, 0], [-b / 2, h - e], [b / 2, h - e], [b / 2, 0], [b / 2 + a, 0], [b / 2 + a, e], [b / 2 + e, e], [b / 2 + e, h], [-b / 2 - e, h], [-b / 2 - e, e], [-b / 2 - a, e]]),
    designation: ([h, b]) => `Profil oméga ${nb(h)}x${nb(b)}`,
  },
  {
    code: 'T12',
    libelle: 'Profil chemin de roulement, (Aciérie de la Seine).',
    questions: [q('Hauteur', 60), q('Largeur', 50), q('Épaisseur', 3)],
    dessin: ([h, b, e]) => poly([[0, 0], [b, 0], [b, h * 0.3], [b - e, h * 0.3], [b - e, e], [b / 2 + e, e], [b / 2 + e, h], [b / 2 - e, h], [b / 2 - e, e], [e, e], [e, h * 0.3], [0, h * 0.3]]),
    designation: ([h, b]) => `Chemin de roulement ${nb(h)}x${nb(b)}`,
  },
];

/** Cases de la bibliothèque : 12 lignes (I à T) de 15 colonnes ; null : case vide. */
export function grilleBibliotheque(): (Piece | { code: string; libelle: string; cartouche: boolean } | null)[] {
  const out: (Piece | { code: string; libelle: string; cartouche: boolean } | null)[] = [];
  for (const ligne of 'IJKLMNOPQRST') {
    for (let c = 1; c <= 15; c++) {
      const code = `${ligne}${String(c).padStart(2, '0')}`;
      if (code === 'T14') out.push({ code, libelle: 'Cartouche.', cartouche: false });
      else if (code === 'T15') out.push({ code, libelle: 'Cartouche avec nomenclature.', cartouche: true });
      else out.push(PIECES.find((p) => p.code === code) ?? null);
    }
  }
  return out;
}
