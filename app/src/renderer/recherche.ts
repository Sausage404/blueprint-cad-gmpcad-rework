// Recherche de fonction (nouveauté, absente de l'original) : ⌘K sur Mac, Ctrl+K sur Windows, ou
// Aide > Rechercher une fonction. On tape « cercle », « chanfrein », « miroir »… et on lance la fonction
// sans connaître sa case dans la palette. Les mots d'aujourd'hui (congé, offset, calque…) sont compris.
import { BASE_ICONS, BASE_LABELS, LEFT_ICONS, UI_ICONS, svg } from './icons';
import { FAMILLES } from './theme';

export interface Entree {
  /** Code de la case (« D1 »), ou vide pour une commande des menus. */
  code: string;
  libelle: string;
  icone: string;
  /** Couleur de la famille (soulignement). */
  famille: string;
  disponible: boolean;
  motsCles: string;
  choisir(): void;
}

/** Autres mots pour trouver une case (vocabulaire courant ou des logiciels de CAO d'aujourd'hui). */
const SYNONYMES: Record<string, string> = {
  B5: 'texte écrire écriture annotation inscription',
  B9: 'cote cotation dimension mesure longueur',
  B10: 'cote cotation dimension chaîne',
  B11: 'cote cotation dimension',
  B12: 'cote cotation dimension',
  B13: 'cote cotation dimension diamètre',
  B14: 'cote cotation dimension diamètre',
  B15: 'cote cotation dimension rayon',
  B16: 'cote cotation dimension angle',
  C6: 'polyligne lignes',
  C7: 'courbe spline',
  C8: 'courbe spline',
  C10: 'rectangle carré boîte',
  C11: 'rectangle arrondi angles arrondis',
  C12: 'rectangle incliné',
  C13: 'oblong rainure trou oblong lumière',
  C14: 'polygone hexagone octogone écrou',
  C15: 'axe trait axe centre croix',
  C16: 'hachure remplissage coupe',
  D1: 'ligne trait segment droit',
  D2: 'demi-droite rayon ligne',
  D3: 'droite construction ligne infinie',
  D4: 'cercle rond trou',
  D5: 'cercle rond',
  D6: 'cercle tangent rond',
  D7: 'arc',
  D8: 'arc',
  D9: 'arc trois points',
  D10: 'chanfrein biseau',
  D11: 'congé arrondi raccord raccordement fillet',
  D12: 'tangente',
  D13: 'perpendiculaire équerre',
  D14: 'parallèle décalage offset',
  D15: 'parallèle décalage offset distance',
  D16: 'contour parallèle offset décalage',
  D18: 'point',
  D19: 'points équidistants diviser division',
  D20: 'point intersection',
  E2: 'effacer gommer couper ajuster trim',
  E3: 'effacer gommer couper ajuster trim',
  E4: 'effacer gommer couper moitié',
  E5: 'supprimer effacer enlever gommer',
  E6: 'supprimer effacer enlever sélection fenêtre',
  E8: 'éclater décomposer groupe bloc',
  E9: 'groupe bloc grouper',
  E10: 'nomenclature désignation référence groupe renommer',
  E11: 'déplacer niveau calque placer placement',
  E12: 'tourner pivoter niveau calque placement',
  E13: 'déplacer bouger étirer point',
  E14: 'déplacer bouger translation copier',
  E15: 'tourner pivoter rotation',
  E16: 'miroir symétrie retourner',
  E17: 'échelle agrandir réduire mise à l échelle',
  E18: 'affinité étirer écraser déformer ellipse',
  E19: 'calque niveau couche copier dupliquer',
  E20: 'type de trait pointillé épaisseur',
  F2: 'format papier feuille a4 a3 a2 a1 a0 échelle',
  F5: 'propriétés informations examiner mesurer',
  F8: 'tout voir zoom étendu plein format',
  F10: 'zoom loupe agrandir fenêtre',
  F11: 'trait fort continu épais',
  F12: 'pointillé caché trait',
  F13: 'mixte axe trait',
  F14: 'trait fin continu',
  F16: 'calage angle accrochage 15',
  F17: 'calque niveau couche',
  F18: 'grille magnétisme pas',
};

const LIGNES = 'BCDEF';

/** Les 100 cases de la palette « Menu de Base ». */
export function entreesPalette(disponible: (code: string) => boolean, choisir: (code: string, libelle: string) => void): Entree[] {
  const out: Entree[] = [];
  for (let l = 0; l < 5; l++) {
    for (let c = 0; c < 20; c++) {
      const code = `${LIGNES[l]}${c + 1}`;
      const libelle = BASE_LABELS[l][c].replace(/\s*\(pas d'infobulle.*\)$/, '').replace(/\.$/, '');
      out.push({
        code,
        libelle,
        icone: BASE_ICONS[l][c],
        famille: FAMILLES[l].point,
        disponible: disponible(code),
        motsCles: SYNONYMES[code] ?? '',
        choisir: () => choisir(code, libelle),
      });
    }
  }
  return out;
}

const ICONES_COMMANDES: Record<string, string> = {
  nouveau: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  ouvrir: '<path d="M3 6h6l2 2h10v11H3z"/>',
  annuler: '<path d="M9 5 4 10l5 5"/><path d="M4 10h10a5 5 0 0 1 0 10h-4"/>',
  refaire: '<path d="m15 5 5 5-5 5"/><path d="M20 10H10a5 5 0 0 0 0 10h4"/>',
  exporter: '<path d="M6 3h8l4 4v14H6z"/><path d="M12 10v7M9 14l3 3 3-3"/>',
  partager: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H4v10h16V11h-2"/>',
  apercu: '<rect x="4" y="3" width="16" height="18"/><circle cx="11" cy="11" r="3"/><path d="m13 13 4 4"/>',
  cube: '<path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
};

/** Commandes des menus, trouvables aussi par la recherche. */
export function entreesCommandes(commande: (id: string, libelle: string) => void): Entree[] {
  const c = (id: string, libelle: string, icone: string, motsCles: string): Entree => ({
    code: '',
    libelle,
    icone,
    famille: '#555555',
    disponible: true,
    motsCles,
    choisir: () => commande(id, libelle),
  });
  return [
    c('fichier.nouveau', 'Nouveau dessin', ICONES_COMMANDES.nouveau, 'fichier créer vierge'),
    c('fichier.ouvrir', 'Ouvrir un dessin', ICONES_COMMANDES.ouvrir, 'fichier charger dxf des'),
    c('fichier.enregistrer', 'Enregistrer', UI_ICONS.disk, 'fichier sauver sauvegarder'),
    c('fichier.enregistrer-sous', 'Enregistrer sous', UI_ICONS.disk, 'fichier sauver sauvegarder copie'),
    c('fichier.imprimer', 'Imprimer', LEFT_ICONS.traceur, 'impression imprimante papier'),
    c('fichier.apercu', 'Aperçu avant impression', ICONES_COMMANDES.apercu, 'impression imprimer voir'),
    c('fichier.exporter', 'Exporter (PDF, image PNG ou SVG)', ICONES_COMMANDES.exporter, 'pdf png svg image export'),
    c('fichier.partager', 'Partager le dessin (Mail, Messages, AirDrop)', ICONES_COMMANDES.partager, 'envoyer mail courriel email pdf'),
    c('edition.annuler', 'Annuler la dernière action', ICONES_COMMANDES.annuler, 'retour arrière défaire undo'),
    c('edition.refaire', 'Refaire', ICONES_COMMANDES.refaire, 'rétablir redo'),
    c('vue.3d', 'Vue 3D : mettre un contour en volume', ICONES_COMMANDES.cube, 'trois dimensions volume modèle extrusion révolution'),
  ];
}

const normaliser = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ø]+/g, ' ')
    .trim();

/**
 * Entrées qui correspondent à `texte` : chaque mot tapé doit commencer un mot du libellé, des mots-clés
 * ou être le code de la case. Les fonctions disponibles et les correspondances dans le libellé d'abord.
 */
export function chercher(entrees: Entree[], texte: string, max = 12): Entree[] {
  const mots = normaliser(texte).split(' ').filter(Boolean);
  if (mots.length === 0) return entrees.filter((e) => e.disponible && e.code).slice(0, max);
  const notes: { e: Entree; note: number; rang: number }[] = [];
  entrees.forEach((e, rang) => {
    const libelle = normaliser(e.libelle).split(' ');
    const cles = normaliser(e.motsCles).split(' ');
    let note = 0;
    for (const m of mots) {
      if (e.code && normaliser(e.code) === m) note += 10;
      else if (libelle.some((w) => w.startsWith(m))) note += 3;
      else if (cles.some((w) => w.startsWith(m))) note += 2;
      else return;
    }
    if (e.disponible) note += 1;
    notes.push({ e, note, rang });
  });
  notes.sort((a, b) => b.note - a.note || a.rang - b.rang);
  return notes.slice(0, max).map((n) => n.e);
}

/** La fenêtre de recherche, au-dessus de la zone de dessin. */
export class Recherche {
  private el = document.createElement('div');
  private champ = document.createElement('input');
  private liste = document.createElement('ul');
  private resultats: Entree[] = [];
  private choix = 0;

  constructor(
    private entrees: () => Entree[],
    private zone: () => DOMRect,
  ) {
    this.el.id = 'recherche';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Rechercher une fonction');
    this.champ.type = 'text';
    this.champ.placeholder = 'Rechercher une fonction : cercle, chanfrein, miroir, texte…';
    this.champ.spellcheck = false;
    this.champ.setAttribute('aria-controls', 'recherche-liste');
    this.liste.id = 'recherche-liste';
    this.liste.setAttribute('role', 'listbox');
    const aide = document.createElement('div');
    aide.className = 'recherche-aide';
    aide.textContent = '↑ ↓ pour choisir, Entrée pour lancer, Échap pour fermer';
    this.el.append(this.champ, this.liste, aide);
    document.body.append(this.el);

    this.champ.addEventListener('input', () => this.filtrer());
    this.champ.addEventListener('keydown', (e) => this.touche(e));
    this.champ.addEventListener('blur', () => this.fermer());
  }

  get ouverte(): boolean {
    return !this.el.hidden;
  }

  ouvrir(): void {
    const z = this.zone();
    this.el.hidden = false;
    this.el.style.left = `${Math.round(z.left + z.width / 2 - this.el.offsetWidth / 2)}px`;
    this.el.style.top = `${Math.round(z.top + 48)}px`;
    this.champ.value = '';
    this.filtrer();
    this.champ.focus();
  }

  fermer(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.champ.blur();
  }

  private filtrer(): void {
    this.resultats = chercher(this.entrees(), this.champ.value);
    this.choix = Math.max(0, this.resultats.findIndex((e) => e.disponible));
    this.afficher();
  }

  private afficher(): void {
    this.liste.replaceChildren(
      ...this.resultats.map((e, i) => {
        const li = document.createElement('li');
        li.className = `resultat${e.disponible ? '' : ' indispo'}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(i === this.choix));
        li.style.setProperty('--fam', e.famille);
        li.innerHTML =
          `<span class="icone">${svg(e.icone, 22, 1.4)}</span><span class="nom"></span>` +
          (e.code ? `<span class="code">${e.code}</span>` : '') +
          (e.disponible ? '' : '<span class="bientot">pas encore</span>');
        (li.querySelector('.nom') as HTMLElement).textContent = e.libelle;
        // mousedown plutôt que click : le champ ne doit pas perdre le focus (et fermer la fenêtre) avant.
        li.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          this.choix = i;
          this.lancer();
        });
        return li;
      }),
    );
    if (this.resultats.length === 0) {
      const li = document.createElement('li');
      li.className = 'aucun';
      li.textContent = 'Aucune fonction ne correspond.';
      this.liste.append(li);
    }
  }

  private touche(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.fermer();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = this.resultats.length;
      if (n === 0) return;
      this.choix = (this.choix + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
      this.afficher();
      this.liste.children[this.choix]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.lancer();
    }
  }

  private lancer(): void {
    const e = this.resultats[this.choix];
    if (!e) return;
    this.fermer();
    e.choisir();
  }
}
