// Aperçu avant impression (Fichier > Aperçu plein écran, ou le bouton Traceur) : la feuille telle qu'elle
// sortira de l'imprimante, traits noirs sur papier blanc, avec Imprimer, Exporter et Partager.
import type { PageImprimee } from '../shared/types';

export interface ActionsApercu {
  imprimer(): void;
  exporter(): void;
  partager(): void;
}

const ORIENTATION = (l: number, h: number) => (l >= h ? 'paysage' : 'portrait');

export class Apercu {
  private el = document.createElement('div');
  private titre = document.createElement('span');
  private feuille = document.createElement('div');
  private page: PageImprimee | null = null;

  constructor(private actions: ActionsApercu) {
    this.el.id = 'apercu';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Aperçu avant impression');
    const barre = document.createElement('div');
    barre.className = 'apercu-barre';
    this.titre.className = 'apercu-titre';
    const bouton = (texte: string, action: () => void, principal = false) => {
      const b = document.createElement('button');
      b.textContent = texte;
      if (principal) b.className = 'principal';
      b.addEventListener('click', action);
      return b;
    };
    barre.append(
      this.titre,
      bouton('Imprimer...', () => this.puis(this.actions.imprimer), true),
      bouton('Exporter (PDF, image)...', () => this.puis(this.actions.exporter)),
      bouton('Partager...', () => this.actions.partager()),
      bouton('Fermer', () => this.fermer()),
    );
    this.feuille.className = 'apercu-feuille';
    this.el.append(barre, this.feuille);
    document.body.append(this.el);

    // Échap ferme l'aperçu sans toucher à la fonction en cours.
    document.addEventListener(
      'keydown',
      (e) => {
        if (this.el.hidden) return;
        e.stopImmediatePropagation();
        if (e.key === 'Escape') this.fermer();
      },
      true,
    );
    new ResizeObserver(() => this.ajuster()).observe(this.feuille);
  }

  get ouvert(): boolean {
    return !this.el.hidden;
  }

  ouvrir(page: PageImprimee, format: string): void {
    this.page = page;
    const nom = format.replace(/[HV]$/, '');
    this.titre.textContent = `${page.nom} : ${nom} ${ORIENTATION(page.largeur, page.hauteur)} (${page.largeur} × ${page.hauteur} mm), à l'échelle exacte`;
    this.feuille.innerHTML = `<div class="papier">${page.svg}</div>`;
    this.el.hidden = false;
    this.ajuster();
  }

  fermer(): void {
    this.el.hidden = true;
    this.feuille.replaceChildren();
  }

  private puis(action: () => void): void {
    this.fermer();
    action();
  }

  /** La feuille entière dans la fenêtre, proportions gardées. */
  private ajuster(): void {
    const p = this.page;
    const papier = this.feuille.querySelector('.papier') as HTMLElement | null;
    const svg = papier?.querySelector('svg');
    if (!p || !papier || !svg) return;
    const r = this.feuille.getBoundingClientRect();
    const k = Math.min((r.width - 48) / p.largeur, (r.height - 48) / p.hauteur);
    if (k <= 0) return;
    papier.style.width = `${Math.round(p.largeur * k)}px`;
    papier.style.height = `${Math.round(p.hauteur * k)}px`;
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
  }
}
