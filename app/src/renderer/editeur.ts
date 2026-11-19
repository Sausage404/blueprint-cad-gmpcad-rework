// Éditeur de ligne de la zone de dialogue (aide d'origine, « Éditeur ligne ») :
// insertion par défaut, validation quelle que soit la position du curseur.

export type Resultat = 'valide' | 'abandon' | 'continue' | 'ignore';

export class EditeurLigne {
  texte = '';
  curseur = 0;

  constructor(
    private defaut = '',
    initial = '',
  ) {
    this.texte = initial;
    this.curseur = initial.length;
  }

  /** Coller : le texte est inséré au curseur (chiffres, signes, lettres ; pas de retour à la ligne). */
  inserer(t: string): void {
    const propre = t.replace(/[\r\n\t]+/g, ' ').trim();
    this.texte = this.texte.slice(0, this.curseur) + propre + this.texte.slice(this.curseur);
    this.curseur += propre.length;
  }

  touche(e: KeyboardEvent): Resultat {
    const ctrl = e.ctrlKey && !e.metaKey && !e.altKey;
    const k = e.key;
    if (k === 'Enter') return 'valide';
    if (k === 'Escape') return 'abandon';
    if (k === 'Backspace' || (ctrl && k.toLowerCase() === 'h')) {
      if (this.curseur > 0) {
        this.texte = this.texte.slice(0, this.curseur - 1) + this.texte.slice(this.curseur);
        this.curseur--;
      }
      return 'continue';
    }
    if (k === 'Delete' || (ctrl && k.toLowerCase() === 'k')) {
      this.texte = this.texte.slice(0, this.curseur) + this.texte.slice(this.curseur + 1);
      return 'continue';
    }
    if (k === 'ArrowDown' || (ctrl && k.toLowerCase() === 'x')) {
      this.texte = '';
      this.curseur = 0;
      return 'continue';
    }
    if (k === 'ArrowUp' || (ctrl && k.toLowerCase() === 'e')) {
      this.texte = this.defaut;
      this.curseur = this.texte.length;
      return 'continue';
    }
    if (k === 'ArrowLeft') {
      this.curseur = Math.max(0, this.curseur - 1);
      return 'continue';
    }
    if (k === 'ArrowRight' || (ctrl && k.toLowerCase() === 'd')) {
      this.curseur = Math.min(this.texte.length, this.curseur + 1);
      return 'continue';
    }
    if (k === 'Home') {
      this.curseur = 0;
      return 'continue';
    }
    if (k === 'End') {
      this.curseur = this.texte.length;
      return 'continue';
    }
    if (k.length === 1 && !e.ctrlKey && !e.metaKey) {
      this.texte = this.texte.slice(0, this.curseur) + k + this.texte.slice(this.curseur);
      this.curseur++;
      return 'continue';
    }
    return 'ignore';
  }
}
