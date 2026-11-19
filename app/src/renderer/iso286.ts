// Tolérances ISO 286 (ajustements du type H7, g6) : intervalles de tolérance IT et écarts fondamentaux,
// pour les dimensions jusqu'à 500 mm. Valeurs en micromètres, d'après les tables de la norme.
// Sans DOM (testé dans test/meca.test.ts).

/** Bornes supérieures des paliers de dimensions (mm) : jusqu'à 3, de 3 à 6, … de 400 à 500. */
const PALIERS = [3, 6, 10, 18, 30, 50, 80, 120, 180, 250, 315, 400, 500];

const IT: Record<number, number[]> = {
  1: [0.8, 1, 1, 1.2, 1.5, 1.5, 2, 2.5, 3.5, 4.5, 6, 7, 8],
  2: [1.2, 1.5, 1.5, 2, 2.5, 2.5, 3, 4, 5, 7, 8, 9, 10],
  3: [2, 2.5, 2.5, 3, 4, 4, 5, 6, 8, 10, 12, 13, 15],
  4: [3, 4, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20],
  5: [4, 5, 6, 8, 9, 11, 13, 15, 18, 20, 23, 25, 27],
  6: [6, 8, 9, 11, 13, 16, 19, 22, 25, 29, 32, 36, 40],
  7: [10, 12, 15, 18, 21, 25, 30, 35, 40, 46, 52, 57, 63],
  8: [14, 18, 22, 27, 33, 39, 46, 54, 63, 72, 81, 89, 97],
  9: [25, 30, 36, 43, 52, 62, 74, 87, 100, 115, 130, 140, 155],
  10: [40, 48, 58, 70, 84, 100, 120, 140, 160, 185, 210, 230, 250],
  11: [60, 75, 90, 110, 130, 160, 190, 220, 250, 290, 320, 360, 400],
  12: [100, 120, 150, 180, 210, 250, 300, 350, 400, 460, 520, 570, 630],
  13: [140, 180, 220, 270, 330, 390, 460, 540, 630, 720, 810, 890, 970],
  14: [250, 300, 360, 430, 520, 620, 740, 870, 1000, 1150, 1300, 1400, 1550],
  15: [400, 480, 580, 700, 840, 1000, 1200, 1400, 1600, 1850, 2100, 2300, 2500],
  16: [600, 750, 900, 1100, 1300, 1600, 1900, 2200, 2500, 2900, 3200, 3600, 4000],
};

/** Écart supérieur es des arbres a… h (négatif). */
const ES_ARBRES: Record<string, number[]> = {
  c: [-60, -70, -80, -95, -110, -120, -140, -170, -200, -240, -300, -360, -440],
  d: [-20, -30, -40, -50, -65, -80, -100, -120, -145, -170, -190, -210, -230],
  e: [-14, -20, -25, -32, -40, -50, -60, -72, -85, -100, -110, -125, -135],
  f: [-6, -10, -13, -16, -20, -25, -30, -36, -43, -50, -56, -62, -68],
  g: [-2, -4, -5, -6, -7, -9, -10, -12, -14, -15, -17, -18, -20],
  h: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

/** Écart inférieur ei des arbres k… s (positif). k : pour les qualités 4 à 7 (0 sinon). */
const EI_ARBRES: Record<string, number[]> = {
  k: [0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4, 5],
  m: [2, 4, 6, 7, 8, 9, 11, 13, 15, 17, 20, 21, 23],
  n: [4, 8, 10, 12, 15, 17, 20, 23, 27, 31, 34, 37, 40],
  p: [6, 12, 15, 18, 22, 26, 32, 37, 43, 50, 56, 62, 68],
};

/** r et s : paliers plus fins au-delà de 50 mm (bornes supérieures et valeurs). */
const FINS: Record<'r' | 's', [number, number][]> = {
  r: [[3, 10], [6, 15], [10, 19], [18, 23], [30, 28], [50, 34], [65, 41], [80, 43], [100, 51], [120, 54], [140, 63], [160, 65], [180, 68], [200, 77], [225, 80], [250, 84], [280, 94], [315, 98], [355, 108], [400, 114], [450, 126], [500, 132]],
  s: [[3, 14], [6, 19], [10, 23], [18, 28], [30, 35], [50, 43], [65, 53], [80, 59], [100, 71], [120, 79], [140, 92], [160, 100], [180, 108], [200, 122], [225, 130], [250, 140], [280, 158], [315, 170], [355, 190], [400, 208], [450, 232], [500, 252]],
};

function palier(d: number): number {
  return PALIERS.findIndex((b) => d <= b);
}

/** Intervalle de tolérance (µm) de la qualité `q` pour la dimension `d` (mm), ou null hors des tables. */
export function intervalleIT(d: number, q: number): number | null {
  const i = palier(d);
  if (d <= 0 || i < 0 || !IT[q]) return null;
  return IT[q][i];
}

function ecartFondamentalArbre(lettre: string, d: number, q: number): { es?: number; ei?: number } | null {
  const i = palier(d);
  if (ES_ARBRES[lettre]) return { es: ES_ARBRES[lettre][i] };
  if (lettre === 'k') return { ei: q >= 4 && q <= 7 ? EI_ARBRES.k[i] : 0 };
  if (EI_ARBRES[lettre]) return { ei: EI_ARBRES[lettre][i] };
  if (lettre === 'r' || lettre === 's') {
    const v = FINS[lettre].find(([b]) => d <= b);
    return v ? { ei: v[1] } : null;
  }
  return null;
}

/** Écarts (mm) d'une dimension tolérancée « H7 », « g6 », « js6 »… ; null si la désignation n'est pas dans les tables. */
export function ecartsISO(d: number, classe: string): { es: number; ei: number; it: number } | null {
  const m = /^([A-Za-z]{1,2})(\d{1,2})$/.exec(classe.trim());
  if (!m) return null;
  const lettre = m[1];
  const q = Number(m[2]);
  const it = intervalleIT(d, q);
  if (it === null) return null;
  const mm = (v: number) => v / 1000;
  const alesage = lettre[0] === lettre[0].toUpperCase();
  const l = lettre.toLowerCase();
  if (l === 'js') return { es: mm(it / 2), ei: mm(-it / 2), it: mm(it) };
  const f = ecartFondamentalArbre(l, d, q);
  if (!f) return null;
  if (!alesage) {
    if (f.es !== undefined) return { es: mm(f.es), ei: mm(f.es - it), it: mm(it) };
    return { es: mm(f.ei! + it), ei: mm(f.ei!), it: mm(it) };
  }
  // Alésages : symétriques des arbres (EI = -es pour A à H)…
  if (f.es !== undefined) return { es: mm(-f.es + it), ei: mm(-f.es), it: mm(it) };
  // … et pour K, M, N (qualités jusqu'à 8) et P à ZC (jusqu'à 7) : ES = -ei + Δ, Δ = IT(q) - IT(q-1).
  const avecDelta = (l === 'k' || l === 'm' || l === 'n' ? q <= 8 : q <= 7) && d > 3;
  const delta = avecDelta ? it - (intervalleIT(d, q - 1) ?? it) : 0;
  const eiArbre = l === 'k' ? (q <= 8 ? EI_ARBRES.k[palier(d)] : 0) : f.ei!;
  // N au-delà de la qualité 8 : ES = 0.
  const es = l === 'n' && q > 8 ? 0 : -eiArbre + delta;
  return { es: mm(es), ei: mm(es - it), it: mm(it) };
}

/** Écart écrit avec son signe, en mm (« +0.021 », « 0 », « -0.007 »). */
export function texteEcart(v: number): string {
  if (Math.abs(v) < 5e-7) return '0';
  // Au dixième de micromètre (js6 sur 25 : ±0,0065), arrondi symétrique.
  const t = ((Math.sign(v) * Math.round(Math.abs(v) * 10000)) / 10000).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return v > 0 ? `+${t}` : t;
}

/** Classe ISO écrite dans un texte de cote (« Ø25 H7 », « 40g6 ») : la dimension et la classe. */
export function lireClasse(texte: string): { d: number; classe: string } | null {
  const m = /(\d+(?:[.,]\d+)?)\s*([A-Za-z]{1,2}\d{1,2})\b/.exec(texte);
  return m ? { d: Number(m[1].replace(',', '.')), classe: m[2] } : null;
}
