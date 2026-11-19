// Palette « Menu de Base » : 5 lignes x 20 cases, ouverte par la barre d'espace (ou le bouton BASE)
// à l'endroit où elle est rangée, refermée dès que la souris en sort (cahier des charges, sections 2 et 4).
import { BASE_ICONS, BASE_LABELS, svg } from './icons';
import { cacherInfobulle, infobulle, montrerInfobulle } from './infobulle';
import { familles } from './theme';

// Codes de l'original (MENUS.MSE) : ligne 1 = B ... ligne 5 = F ; la ligne A est interne.
const LIGNES = 'BCDEF';

export interface CaseChoisie {
  ligne: number; // 1 à 5
  colonne: number; // 1 à 20
  code: string; // ex. « D1 » (lettre de ligne + numéro de colonne, comme dans l'aide d'origine)
  libelle: string;
}

/** Libellé affichable, sans les remarques entre parenthèses ajoutées dans la liste
 * (la case 5.7 « (*) » n'a pas d'infobulle dans l'original ; son nom vient de l'aide). */
function libelle(l: number, c: number): string {
  return BASE_LABELS[l][c].replace(/\s*\(pas d'infobulle.*\)$/, '');
}

export class Palette {
  private el = document.getElementById('palette') as HTMLDivElement;
  private entree = false; // la souris est-elle déjà entrée dans la palette ?
  private position: { x: number; y: number } | null = null;

  constructor(
    private onChoix: (c: CaseChoisie) => void,
    private onFermeture: () => void,
  ) {
    this.el.addEventListener('pointerenter', () => (this.entree = true));
    this.el.addEventListener('pointerleave', () => {
      if (this.entree) this.fermer();
    });
  }

  get ouverte(): boolean {
    return !this.el.hidden;
  }

  construire(grandesIcones: boolean, moderne = false): void {
    // Classique : tailles de l'original. Moderne : cases espacées et nom des familles à gauche (maquette).
    const taille = moderne ? (grandesIcones ? 50 : 42) : grandesIcones ? 45 : 30;
    const icone = moderne ? (grandesIcones ? 28 : 24) : grandesIcones ? 34 : 24;
    this.el.style.gridTemplateColumns = `${moderne ? 'auto ' : ''}repeat(20, ${taille}px)`;
    this.el.style.gridTemplateRows = `repeat(5, ${taille}px)`;
    this.el.replaceChildren();
    const fams = familles(moderne ? 'moderne' : 'classique');

    for (let l = 0; l < 5; l++) {
      const fam = fams[l];
      if (moderne) {
        const nom = document.createElement('div');
        nom.className = 'famille';
        nom.style.setProperty('--souligne', fam.souligne);
        nom.style.setProperty('--fam', fam.point);
        nom.textContent = fam.nom;
        this.el.append(nom);
      }
      for (let c = 0; c < 20; c++) {
        const b = document.createElement('button');
        b.className = 'case';
        b.style.setProperty('--souligne', fam.souligne);
        b.style.setProperty('--fam', fam.point);
        const code = `${LIGNES[l]}${c + 1}`;
        const texte = libelle(l, c);
        b.setAttribute('aria-label', texte);
        b.innerHTML = svg(BASE_ICONS[l][c], icone, 1.15);
        infobulle(b, () => texte);
        b.addEventListener('click', () => {
          this.fermer();
          this.onChoix({ ligne: l + 1, colonne: c + 1, code, libelle: texte });
        });
        // Clic droit sur une case : l'aide et le code de la case.
        b.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          montrerInfobulle(`${code} : ${texte}`, e.clientX + 8, e.clientY + 20);
        });
        this.el.append(b);
      }
    }
  }

  ouvrir(zone: DOMRect): void {
    this.el.hidden = false;
    this.entree = false;
    this.el.style.transform = '';
    const r = this.el.getBoundingClientRect();
    // Fenêtre trop petite pour la palette entière (petit écran, 800 x 600) : on la réduit pour qu'elle tienne.
    const k = Math.min(1, (window.innerWidth - 8) / r.width, (window.innerHeight - 8) / r.height);
    this.el.style.transformOrigin = '0 0';
    this.el.style.transform = k < 1 ? `scale(${k})` : '';
    const l = r.width * k;
    const h = r.height * k;
    // Position par défaut : centrée en bas de la zone de dessin. Ensuite, là où elle a été rangée.
    const pos = this.position ?? { x: zone.left + (zone.width - l) / 2, y: zone.bottom - h - 40 };
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
