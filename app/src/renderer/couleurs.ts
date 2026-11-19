// Couleurs : palette des niveaux de l'original et couleurs « ACI » du DXF (index 1 à 255).

/**
 * Couleur de chaque niveau dans GMPCAD : vert, rouge, bleu, jaune, magenta, cyan, blanc, puis on recommence
 * (relevé dans la table des calques des DXF convertis par DESDXF : niveau 1 = 3, 2 = 1, 3 = 5…).
 */
const CYCLE_NIVEAUX = [3, 1, 5, 2, 6, 4, 7];

export function aciNiveau(niveau: number): number {
  return CYCLE_NIVEAUX[(((niveau - 1) % 7) + 7) % 7];
}

/**
 * Couleur à l'écran d'un index ACI. Le 7 est « blanc ou noir » selon le fond, comme dans les logiciels de DAO :
 * on passe la couleur du cadre (blanc sur fond gris ou noir, noir sur fond crème).
 */
export function aciVersRvb(aci: number, couleur7: string): string {
  if (aci === 7 || aci <= 0 || aci > 255) return couleur7;
  const fixes: Record<number, string> = { 1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff', 5: '#0000ff', 6: '#ff00ff', 8: '#808080', 9: '#c0c0c0' };
  if (fixes[aci]) return fixes[aci];
  if (aci >= 250) {
    const g = Math.round(51 + ((aci - 250) * (255 - 51)) / 5);
    return hex(g, g, g);
  }
  // 10 à 249 : 24 teintes de 15°, 10 nuances par teinte (pleine ou pastel, de plus en plus sombre).
  const teinte = Math.floor((aci - 10) / 10) * 15;
  const k = (aci - 10) % 10;
  const valeur = [1, 1, 0.8, 0.8, 0.6, 0.6, 0.5, 0.5, 0.3, 0.3][k];
  const saturation = k % 2 === 0 ? 1 : 0.5;
  return hsv(teinte, saturation, valeur);
}

/** Index ACI le plus proche d'une couleur (pour écrire le DXF). */
export function rvbVersAci(couleur: string): number {
  const cible = rvb(couleur);
  let meilleur = 7;
  let ecart = Infinity;
  for (let i = 1; i <= 255; i++) {
    const c = rvb(aciVersRvb(i, '#ffffff'));
    const e = (c[0] - cible[0]) ** 2 + (c[1] - cible[1]) ** 2 + (c[2] - cible[2]) ** 2;
    if (e < ecart) {
      ecart = e;
      meilleur = i;
    }
  }
  return meilleur;
}

function hsv(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return hex(Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255));
}

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

function rvb(c: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [255, 255, 255];
}
