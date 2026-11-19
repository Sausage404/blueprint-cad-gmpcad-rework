// Palettes secondaires (CALCULS, MECA…) : une grille de cases avec icône ou texte, ouverte par un bouton
// de la barre de gauche et refermée dès que la souris en sort, comme la palette « Menu de Base ».
import { svg } from './icons';
import { cacherInfobulle, infobulle, montrerInfobulle } from './infobulle';

export interface CaseGrille {
  code: string;
  libelle: string;
  /** Icône (dessin SVG 24 x 24) ; à défaut, `texte` est écrit dans la case. */
  icone?: string;
  texte?: string;
  /** Case libre de la bibliothèque (on peut lui affecter un groupe ou une macro). */
  vide?: boolean;
  /** Case désactivée (Métier > Annuler case). */
  desactivee?: boolean;
}

export class PaletteGrille {
  private el: HTMLDivElement;
  private entree = false;
  private position: { x: number; y: number } | null = null;

  constructor(
    id: string,
    private colonnes: number,
    private cases: CaseGrille[],
    /** Couleur de la famille : bande en bas de chaque case (magenta pour les calculs). */
    private couleur: string,
    private onChoix: (c: CaseGrille) => void,
    private onFermeture: () => void,
    /** Partie qui défile sous les cases (bibliothèque MECA) : null pour une case vide. */
    private bibliotheque?: { cases: (CaseGrille | null)[]; colonnes: number; lignesVisibles: number },
  ) {
    this.el = document.createElement('div');
    this.el.id = id;
    this.el.className = 'palette-grille';
    this.el.hidden = true;
    document.body.append(this.el);
    this.el.addEventListener('pointerenter', () => (this.entree = true));
    this.el.addEventListener('pointerleave', () => {
      if (this.entree) this.fermer();
    });
  }

  get ouverte(): boolean {
    return !this.el.hidden;
  }

  private dernierReglage: [boolean, boolean] = [true, false];

  /** Nouvelles cases de la bibliothèque (affectations, désactivations) : la palette est refaite. */
  majBibliotheque(cases: (CaseGrille | null)[]): void {
    if (!this.bibliotheque) return;
    this.bibliotheque.cases = cases;
    this.construire(...this.dernierReglage);
  }

  construire(grandesIcones: boolean, moderne = false): void {
    this.dernierReglage = [grandesIcones, moderne];
    const taille = moderne ? (grandesIcones ? 50 : 42) : grandesIcones ? 45 : 30;
    const icone = moderne ? (grandesIcones ? 28 : 24) : grandesIcones ? 34 : 24;
    this.el.replaceChildren();
    const grille = (colonnes: number) => {
      const g = document.createElement('div');
      g.className = 'grille';
      g.style.gridTemplateColumns = `repeat(${colonnes}, ${taille}px)`;
      g.style.gridAutoRows = `${taille}px`;
      return g;
    };
    const principale = grille(this.colonnes);
    this.el.append(principale);
    for (const c of this.cases) principale.append(this.bouton(c, icone));
    if (this.bibliotheque) {
      const zone = document.createElement('div');
      zone.className = 'defilement';
      zone.style.height = `${taille * this.bibliotheque.lignesVisibles}px`;
      const g = grille(this.bibliotheque.colonnes);
      for (const c of this.bibliotheque.cases) {
        if (c) g.append(this.bouton(c, icone, c.vide ? 'vide' : c.desactivee ? 'desactivee' : ''));
        else {
          const vide = document.createElement('div');
          vide.className = 'case vide';
          g.append(vide);
        }
      }
      zone.append(g);
      this.el.append(zone);
    }
  }

  private bouton(c: CaseGrille, icone: number, classe = ''): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = classe ? `case ${classe}` : 'case';
    b.style.setProperty('--souligne', this.couleur);
    b.style.setProperty('--fam', this.couleur);
    b.setAttribute('aria-label', c.libelle);
    if (c.icone) b.innerHTML = svg(c.icone, icone, 1.15);
    else if (!c.vide) {
      const t = document.createElement('span');
      t.className = 'texte-case';
      t.textContent = c.texte ?? c.code;
      b.append(t);
    }
    infobulle(b, () => c.libelle);
    b.addEventListener('click', () => {
      this.fermer();
      this.onChoix(c);
    });
    b.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      montrerInfobulle(`${c.code} : ${c.libelle}`, e.clientX + 8, e.clientY + 20);
    });
    return b;
  }

  /** Ouverte en haut à droite de la zone de dessin (aide d'origine, « Menu Calculs »), ou là où elle a été laissée. */
  ouvrir(zone: DOMRect): void {
    this.el.hidden = false;
    this.entree = false;
    this.el.style.transform = '';
    const r = this.el.getBoundingClientRect();
    const k = Math.min(1, (window.innerWidth - 8) / r.width, (window.innerHeight - 8) / r.height);
    this.el.style.transformOrigin = '0 0';
    this.el.style.transform = k < 1 ? `scale(${k})` : '';
    const l = r.width * k;
    const h = r.height * k;
    const pos = this.position ?? { x: zone.right - l - 24, y: zone.top + 8 };
    this.el.style.left = `${Math.round(Math.min(Math.max(0, pos.x), window.innerWidth - l))}px`;
    this.el.style.top = `${Math.round(Math.min(Math.max(0, pos.y), window.innerHeight - h))}px`;
  }

  fermer(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    cacherInfobulle();
    this.onFermeture();
  }

  basculer(zone: DOMRect): void {
    if (this.ouverte) this.fermer();
    else this.ouvrir(zone);
  }
}

/** Icônes redessinées des cases CALCULS (traits 24 x 24, `currentColor`). */
const T = (x: number, y: number, s: string, taille = 7) =>
  `<text x="${x}" y="${y}" font-size="${taille}" font-family="Arial, sans-serif" font-weight="700" fill="currentColor" stroke="none" text-anchor="middle">${s}</text>`;
/** Hachures à 45° limitées à une forme (identifiant unique dans la page). */
const hachures = (id: string, forme: string) => {
  let d = '';
  for (let k = -24; k <= 24; k += 3) d += `M${k} 24L${k + 24} 0`;
  return `<clipPath id="${id}"><path d="${forme}"/></clipPath><path clip-path="url(#${id})" d="${d}" stroke-width="0.6"/>`;
};
const forme = 'M3 5h11l5 5v9H3v-5h4v-4H3z';

export const ICONES_CALCULS: Record<string, string> = {
  R16: `<path d="${forme}"/>${T(12, 17, 'P', 8)}`,
  R17: `<path d="${forme}"/>${hachures('hach-r17', forme)}${T(12, 17, 'S', 8)}`,
  R18: `<path d="M3 12l5-4h13l-5 4zM3 12v6h13v-6M16 18l5-4V8"/>${T(12, 17, 'V', 7)}`,
  R19: `<ellipse cx="7" cy="12" rx="3" ry="7"/><ellipse cx="18" cy="12" rx="3" ry="7"/><path d="M7 5h11M7 19h11M2 12h20" stroke-dasharray="3 1.5 1 1.5"/>${T(12.5, 15, 'V', 7)}`,
  R20: `<circle cx="10" cy="13" r="7"/><path d="M10 6v14M3 13h14"/><path d="M10 6a7 7 0 0 1 7 7h-7zM10 20a7 7 0 0 1-7-7h7z" fill="currentColor"/>${T(20, 7, 'G', 7)}`,
  S16: `<rect x="3" y="11" width="13" height="6"/>${hachures('hach-s16', 'M3 11h13v6H3z')}<path d="M2 21h20" stroke-dasharray="3 1.5 1 1.5"/>${T(17, 8, 'IΔ', 6.5)}`,
  S17: `<circle cx="10" cy="13" r="7"/><circle cx="10" cy="13" r="3.5"/><path d="M10 4v18M1 13h18" stroke-dasharray="3 1.5 1 1.5"/>${T(19, 7, 'Io', 6.5)}`,
  S18: `<ellipse cx="11" cy="14" rx="8" ry="4" transform="rotate(30 11 14)"/><path d="M4 10l14 8M8 20l6-12" stroke-dasharray="3 1.5 1 1.5"/><circle cx="11" cy="14" r="0.8" fill="currentColor"/>${T(17, 6, 'Ixy', 6)}`,
  S19: `<path d="M3 13l4-3h10l-4 3zM3 13v4h10v-4M13 17l4-3v-4"/>${hachures('hach-s19', 'M3 13l4-3h10l-4 3z')}<path d="M1 21h22" stroke-dasharray="3 1.5 1 1.5"/>${T(19, 7, 'J', 7)}`,
  S20: `<circle cx="6" cy="17" r="3"/><path d="M6 14v6M3 17h6"/><path d="M6 17L19 7M19 7l-4 0.5M19 7l-1.5 3.5"/><path d="M3 9q8-6 18 3" stroke-dasharray="1.5 1.5"/>${T(17, 5, 'Rmax', 5.5)}`,
};
