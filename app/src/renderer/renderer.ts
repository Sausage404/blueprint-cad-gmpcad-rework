// Interface principale : écran à l'identique de l'original (étape 1) et modèle souris / clavier (étape 2).
import { APP_NAME, DEFAULT_PREFS, type DaoApi, type Prefs } from '../shared/types';
import type { Trait } from './dessin';
import { Apercu } from './apercu';
import { format } from './formats';
import { dimensionsPx, GestionFichier } from './fichier';
import { svgFeuille } from './svg';
import { ouvrirSignalement } from './signalement';
import { codeErreur, type Incident, type InfosTravail } from '../shared/signalement';
import { creerFonction, existeFonction } from './fonctions';
import './fonctions-construction';
import './fonctions-courbes';
import './fonctions-hachures';
import './fonctions-habillage';
import { demanderReglages, demanderTexte, ouvrirListe } from './dialogues';
import { Aide, CLE_VITE, entreesAide, ouvrirVite } from './aide';
import { convertirCotes, cotation, COTATION_DEFAUT, pasGrilleSysteme, type ReglageCotation } from './cotation';
import './fonctions-modif';
import { EnregistrementGroupe } from './fonctions-groupes';
import { lireMacro as lireMacroTexte } from './gmac';
import { AjoutPieceJointe, Collage, PlacementMacro, ConsultationPieceJointe, CopieSelection, EnregistrementSelection, lirePressePapiers } from './fonctions-menus';
import { InsertionImage } from './fonctions-images';
import { dimensionsPapier, etatLien, identifiantImage, PLANS, planDe } from './images';
import { ouvrirListeImages } from './liste-images';
import './fonctions-gestion';
import { CASES_CALCULS } from './fonctions-calculs';
import { CASES_MECA_COTATION } from './fonctions-meca';
import { ICONES_BIBLIOTHEQUE, ICONES_MECA } from './icones-meca';
import { CASES_BIBLIOTHEQUE } from './fonctions-bibliotheque';
import { ICONES_CALCULS, PaletteGrille } from './palette-grille';
import { nombre } from './geometrie';
import { TRAITS as TRAITS_DEF, traitSpecialSuivant } from './traits';
import { BASE_ICONS, LEFT_ICONS, UI_ICONS, svg } from './icons';
import { infobulle } from './infobulle';
import { Palette, type CaseChoisie } from './palette';
import { Module3D } from './module3d';
import { Poste } from './poste';
import { entreesCommandes, entreesPalette, Recherche } from './recherche';
import { couleursDessin, familles } from './theme';

declare global {
  interface Window {
    dao: DaoApi;
  }
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---- Valeurs d'un dessin vierge (capture 01)
const etat = {
  echelle: 1,
  cotation: 'AFNOR',
};
let prefs: Prefs = DEFAULT_PREFS;

// ---- Ligne de dialogue
const derniersMessages: string[] = [];
const ligne = $<HTMLDivElement>('ligne-dialogue');
const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Écrit dans la ligne de dialogue ; `curseur` affiche le curseur de saisie à cette position. */
function dire(texte: string, curseur?: number): void {
  if (curseur === undefined) {
    ligne.textContent = texte;
    // Les derniers messages accompagnent un signalement de problème (Aide > Signaler un problème).
    if (texte.trim() && derniersMessages.at(-1) !== texte) derniersMessages.push(texte), derniersMessages.splice(0, derniersMessages.length - 6);
    return;
  }
  const car = texte.slice(curseur, curseur + 1) || ' ';
  ligne.innerHTML = `${echapper(texte.slice(0, curseur))}<span class="curseur-saisie">${echapper(car)}</span>${echapper(texte.slice(curseur + 1))}`;
}
function direRepos(): void {
  const f = poste.format;
  // Texte exact de l'original, double espace compris.
  dire(`Application : ${poste.dessin.infos.plan.fichier || fichier.nom}. Format ${f.nom} (${f.largeur}x${f.hauteur}).  Echelle du plan : ${etat.echelle}`);
}
function pasEncore(nom: string): void {
  dire(`${nom.replace(/\.\.\.$|…$/, '').replace(/\.$/, '')} : pas encore disponible.`);
}

// Pas de menu contextuel du système, nulle part (sur Mac, Ctrl + clic en ouvrirait un).
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---- Poste de travail : zone de dessin, pointage, fonction en cours
const canvas = $<HTMLCanvasElement>('canvas');
const dessin = $<HTMLDivElement>('dessin');
let pret = false;
const poste = new Poste(canvas, format('A4H'), () => couleursDessin(prefs), {
  dire,
  etat: () => {
    if (!pret) return;
    majTableau();
    majAscenseurs();
    fichier.majEtat();
  },
  fonction: (f) => {
    majFonction(f.code);
    if (pret) majTableau(); // repérage ( ) ou (*) selon la fonction
  },
});
const fichier = new GestionFichier(poste, (t) => dire(t), () => direRepos());
// Fichier-texte (B6) : une fenêtre de saisie de plusieurs lignes, qui peut lire un fichier .txt.
poste.contexte.actions!.texteLong = (initial) => demanderTexte('Fichier-texte', initial, () => window.dao.ouvrirTexte());
poste.contexte.actions!.enregistrerGroupe = (g, nom) => fichier.enregistrerGroupe(g, nom);

// Glisser-déposer d'un DXF sur la fenêtre : ouvre le dessin ; avec Maj, le fusionne au dessin en cours.
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer?.files[0];
  if (!f) return;
  const chemin = window.dao.cheminDe(f);
  if (e.shiftKey) void fichier.fusionner(chemin);
  else void fichier.ouvrir(chemin);
});

// Backup automatique toutes les 10 minutes si le dessin a changé (réglage d'origine : Delay=10).
let versionSauvee = -1;
setInterval(() => {
  if (poste.dessin.modifie && poste.dessin.version !== versionSauvee) {
    versionSauvee = poste.dessin.version;
    void fichier.backup(true);
  }
}, 10 * 60 * 1000);

// Reprise après plantage (nouveauté) : quelques secondes après chaque changement, le dessin non
// enregistré est recopié à part ; la copie est effacée dès qu'il est enregistré.
let versionRecuperation = -1;
setInterval(() => {
  const d = poste.dessin;
  if (d.modifie && d.version !== versionRecuperation) {
    versionRecuperation = d.version;
    void window.dao.ecrireRecuperation(fichier.contenu(), fichier.nom, fichier.chemin);
  } else if (!d.modifie && versionRecuperation !== -1) {
    versionRecuperation = -1;
    void window.dao.effacerRecuperation();
  }
}, 4000);

// Un clic dans la ligne de dialogue valide la réponse en cours (prise de la valeur par défaut).
ligne.addEventListener('click', () => poste.clicDialogue());

// ---- Palette « Menu de Base »
const TRAITS: Record<string, Trait> = { F11: 'continu-fort', F12: 'pointille-fin', F13: 'mixte-fin', F14: 'continu-fin' };
/** Cases de gestion qui agissent sans fonction (voir choisirCase). */
const NON_EXCLUSIVES = new Set([...Object.keys(TRAITS), 'B3', 'B4', 'F1', 'F4', 'F6', 'F7', 'F8', 'F15', 'F16', 'E1', 'E7']);
/** Case F6 : la case pointée ensuite est décrite au lieu d'être exécutée. */
let aideCase = false;
function choisirCase(c: CaseChoisie): void {
  // Menus Groupe / Gmac > Insérer dans le menu, Métier > Annuler case : la case pointée est modifiée.
  if (modeCase && /^[I-T]\d\d$/.test(c.code)) return void traiterCase(c.code);
  if (modeCase) {
    modeCase = null;
    dire('Seules les cases de la bibliothèque MECA peuvent être modifiées.');
    return;
  }
  const perso = lireCases()[c.code];
  if (perso) return void utiliserCasePerso(perso);
  if (lireDesactivees().includes(c.code)) return dire(`Case ${c.code} désactivée (Métier > Annuler case pour la réactiver).`);
  if (CASES_BIBLIOTHEQUE.some((x) => x.code === c.code && 'vide' in x)) return dire(`Case ${c.code} libre : Groupe > Insérer dans le menu pour lui affecter un groupe.`);
  if (aideCase && c.code !== 'F6') {
    aideCase = false;
    dire(`AIDE> ${c.libelle.replace(/\.$/, '')} (case ${c.code}).`);
    aide.ouvrir('index', c.code);
    return;
  }
  const f = creerFonction(c.code, poste.contexte);
  if (f) {
    poste.choisir(f);
    return;
  }
  // Fonctions de gestion « non exclusives » : elles agissent sans quitter la fonction en cours.
  if (TRAITS[c.code]) {
    poste.trait = TRAITS[c.code];
    majTableau();
    poste.vue.redessiner();
  } else if (c.code === 'F15') {
    // Trait spécial : chaque appui passe au suivant (mixte fort, mixte 2 tirets, 3 tirets, limite de coupe…).
    poste.trait = traitSpecialSuivant(poste.trait, poste.dernierSpecial);
    poste.dernierSpecial = poste.trait;
    majTableau();
    poste.vue.redessiner();
  } else if (c.code === 'F7') {
    if (!poste.basculerTousNiveaux()) dire(`${poste.fonction.invite()} (repérage sur tous niveaux sans objet pour cette fonction)`);
    majTableau();
  } else if (c.code === 'F6') {
    aideCase = !aideCase;
    dire(aideCase ? 'Help. Désigner la case.' : poste.fonction.invite());
  } else if (c.code === 'B1') void insererImage();
  else if (c.code === 'B3') {
    poste.options.images = !poste.options.images;
    dire(poste.options.images ? "Activation de l'affichage des images." : "Désactivation de l'affichage des images.");
    poste.vue.redessiner();
  } else if (c.code === 'B4') void listeImages();
  else if (c.code === 'F1') void parametresPlan();
  else if (c.code === 'F4') void reglerOptions();
  else if (c.code === 'F8') poste.pleinFormat();
  else if (c.code === 'F16') poste.basculerCalage();
  else if (c.code === 'E1') poste.annulerDerniere();
  else if (c.code === 'E7') poste.restituer();
  else pasEncore(c.libelle);
}
const palette = new Palette(choisirCase, () => boutonBase.classList.remove('enfonce'));
// Palette CALCULS (2 lignes de 5, bande magenta), ouverte par le bouton CALCULS de la barre de gauche.
const paletteCalculs = new PaletteGrille(
  'palette-calculs',
  5,
  CASES_CALCULS.map((c) => ({ ...c, icone: ICONES_CALCULS[c.code] })),
  '#d000d0',
  (c) => choisirCase({ code: c.code, ligne: 0, colonne: 0, libelle: c.libelle }),
  () => boutonCalculs.classList.remove('enfonce'),
);
// Palette MECA (menu métier) : cotation mécanique, 2 lignes de 15.
const paletteMeca = new PaletteGrille(
  'palette-meca',
  15,
  CASES_MECA_COTATION.map((c) => ({ ...c, icone: ICONES_MECA[c.code] })),
  'transparent',
  (c) => choisirCase({ code: c.code, ligne: 0, colonne: 0, libelle: c.libelle }),
  () => boutonMeca.classList.remove('enfonce'),
  { cases: casesBibliotheque(), colonnes: 15, lignesVisibles: 2 },
);
// Vérification automatique (DAO_CAPTURE) : permet de choisir une case sans ouvrir la palette.
if (location.hash === '#capture') {
  (window as unknown as { daoCapture: object }).daoCapture = {
    choisir: (code: string) => choisirCase({ code, ligne: 0, colonne: 0, libelle: code }),
    signaler: () => signaler(),
    /** Une commande de menu (ex. « aide.index »), comme si elle avait été choisie. */
    commande: (id: string) => commande(id, id),
    ouvrir: (chemin: string) => fichier.ouvrir(chemin),
    svg: () => svgFeuille(poste.dessin.toutes, poste.format),
    poste,
    fichier,
    get module3d() {
      return module3d;
    },
  };
}

// ---- Barre d'outils verticale à gauche (capture 11a ; rôles confirmés par l'aide, rubrique « Menu icônes »).
const barre = $<HTMLElement>('barre-gauche');
/** Icônes des nouveautés (les autres viennent du jeu redessiné). */
const ICONES_NOUVELLES: Record<string, string> = {
  cube: '<path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
};
function outil(cle: string, etiquette: string, aide: string, action: () => void, classe = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = `outil ${classe}`.trim();
  b.setAttribute('aria-label', aide);
  b.innerHTML = svg(LEFT_ICONS[cle] ?? ICONES_NOUVELLES[cle], etiquette ? 26 : 30, 1.4) + (etiquette ? `<span class="etiquette">${etiquette}</span>` : '');
  b.addEventListener('click', action);
  infobulle(b, () => aide);
  barre.append(b);
  return b;
}
const boutonBase = outil('base', 'BASE', 'Menu de Base (barre d\'espace)', () => basculerPalette());
boutonBase.style.setProperty('--fam', '#00a000');
const boutonMeca = outil('meca', 'MECA', 'Menu métier Mécanique : cotation et bibliothèque', () => {
  paletteMeca.basculer(dessin.getBoundingClientRect());
  boutonMeca.classList.toggle('enfonce', paletteMeca.ouverte);
});
const boutonCalculs = outil('calculs', 'CALCULS', 'Menu Calculs : périmètre, surface, volumes, centre de gravité, moments', () => {
  paletteCalculs.basculer(dessin.getBoundingClientRect());
  boutonCalculs.classList.toggle('enfonce', paletteCalculs.ouverte);
});
outil('traceur', '', 'Traceur : aperçu avant impression', () => commande('fichier.apercu', 'Aperçu'));
outil('calc', '', 'Calculatrice du système (coller ensuite le résultat avec ⌘V / Ctrl+V)', () => void window.dao.calculatrice());
outil('xy', '', 'Saisie en coordonnées cartésiennes', () => poste.commencerSaisie('cartesiennes'));
outil('polar', '', 'Saisie en coordonnées polaires', () => poste.commencerSaisie('polaires'));
const bouton3d = outil('cube', '3D', 'Vue 3D : le plan à gauche, le volume à droite (⌘3 / Ctrl+3)', () => module3d.basculer());
outil('niveaux', '', 'Annulation / Restitution de la dernière entité', () => poste.basculerEntite(), 'isole');

// ---- Aperçu avant impression (Fichier > Aperçu plein écran, bouton Traceur)
const apercu = new Apercu({
  imprimer: () => void fichier.imprimer(),
  exporter: () => void fichier.exporter(),
  partager: () => void fichier.partager(),
});

// ---- Vue 3D (nouveauté) : la fenêtre se coupe en deux ; le séparateur se déplace à la souris.
const app = $<HTMLDivElement>('app');
const separateur = $<HTMLDivElement>('separateur-3d');
const module3d = new Module3D(poste, $<HTMLElement>('panneau-3d'), (ouvert) => {
  app.classList.toggle('avec-3d', ouvert);
  separateur.hidden = !ouvert;
  bouton3d.classList.toggle('enfonce', ouvert);
});
separateur.addEventListener('pointerdown', (e) => {
  separateur.setPointerCapture(e.pointerId);
  const bouger = (ev: PointerEvent) => {
    const r = app.getBoundingClientRect();
    const largeur = Math.min(Math.max(r.right - ev.clientX - 3, 260), r.width - 360);
    app.style.setProperty('--largeur-3d', `${Math.round(largeur)}px`);
  };
  const lacher = () => {
    separateur.removeEventListener('pointermove', bouger);
    separateur.removeEventListener('pointerup', lacher);
  };
  separateur.addEventListener('pointermove', bouger);
  separateur.addEventListener('pointerup', lacher);
});

// ---- Recherche de fonction (nouveauté) : ⌘K / Ctrl+K, ou Aide > Rechercher une fonction
const recherche = new Recherche(
  () => [
    ...entreesPalette(
      (code) => existeFonction(code) || NON_EXCLUSIVES.has(code),
      (code, libelle) => choisirCase({ code, ligne: 'BCDEF'.indexOf(code[0]) + 1, colonne: Number(code.slice(1)), libelle }),
    ),
    ...entreesCommandes((id, libelle) => commande(id, libelle)),
  ],
  () => dessin.getBoundingClientRect(),
);

function basculerPalette(): void {
  palette.basculer(dessin.getBoundingClientRect());
  boutonBase.classList.toggle('enfonce', palette.ouverte);
}

// ---- Icône de la fonction en cours : l'icône de sa case, soulignée de la couleur de sa famille
const caseFonction = $<HTMLDivElement>('fonction-courante');
infobulle(caseFonction, () => 'Icone de la fonction en cours.');
let codeFonction = 'D1';
function majFonction(code: string): void {
  codeFonction = code;
  const ligneCase = 'BCDEF'.indexOf(code[0]);
  const colonne = Number(code.slice(1)) - 1;
  const fams = familles(prefs.theme);
  const calcul = ICONES_CALCULS[code] ?? ICONES_MECA[code] ?? ICONES_BIBLIOTHEQUE[code];
  const fam = ICONES_CALCULS[code] ? { point: '#d000d0', souligne: '#d000d0' } : calcul ? { point: '#555b64', souligne: '#8a9099' } : (fams[ligneCase] ?? { point: '#555b64', souligne: '#8a9099' });
  caseFonction.style.setProperty('--fam', fam.point);
  caseFonction.style.borderBottomColor = fam.souligne;
  const icone = code === '3D' ? ICONES_NOUVELLES.cube : (calcul ?? BASE_ICONS[ligneCase]?.[colonne] ?? UI_ICONS.segment);
  caseFonction.innerHTML = svg(icone, 32, 1.3);
}
majFonction('D1');

// ---- Tableau de bord (capture 11b) : largeurs des champs relevées sur la capture
const tableau = $<HTMLDivElement>('tableau-de-bord');
interface Champ {
  largeur: number;
  aide: string;
  contenu: () => string;
  grise?: () => boolean;
}
const ico = (k: string) => svg(UI_ICONS[k], 18, 1.5);
const champs: Champ[] = [
  { largeur: 127, aide: 'Type de trait courant', contenu: () => `${ico('trait')}<span>${TRAITS_DEF[poste.trait].court}</span>` },
  {
    largeur: 84,
    aide: 'Calage angulaire (Maj + clic droit)',
    contenu: () => `${ico('cale')}<span>${poste.calage.actif ? `calé ${poste.calage.pas}°` : 'non calé'}</span>`,
  },
  {
    largeur: 63,
    aide: 'Niveau de travail',
    contenu: () => `<span class="pastille" style="background:${poste.couleurNiveau}"></span><span>Niv ${poste.niveau}</span>`,
  },
  { largeur: 98, aide: 'Zoom (molette)', contenu: () => `${ico('zoom')}<span>Zoom ${poste.vue.zoom.toFixed(3)}</span>` },
  { largeur: 84, aide: 'Pas de la grille', contenu: () => `${ico('grille')}<span>Pas ${nombre(poste.pasGrille)} mm</span>` },
  { largeur: 56, aide: 'Taille estimée du fichier', contenu: () => `${ico('disk')}<span>${poste.dessin.tailleKo} Ko</span>` },
  { largeur: 63, aide: 'Système de cotation', contenu: () => `${ico('cote')}<span>${etat.cotation}</span>` },
  {
    largeur: 37,
    aide: 'Repérage sur tous les niveaux : (*) étendu, ( ) limité au niveau de travail (case (*) ou touche F3)',
    contenu: () => `<span>${poste.tousNiveaux || !poste.fonction.reperage ? '(*)' : '( )'}</span>`,
    grise: () => !poste.fonction.reperage,
  },
];
const elementsChamps = champs.map((c) => {
  const el = document.createElement('div');
  el.className = 'champ';
  // Largeur de l'original au minimum. Le champ s'élargit si le texte ne tient pas
  // (l'original tronquait « calé 15° » ou « Zoom 1.066 »).
  el.style.minWidth = `${c.largeur}px`;
  infobulle(el, () => c.aide);
  tableau.append(el);
  return el;
});
function majTableau(): void {
  champs.forEach((c, i) => {
    elementsChamps[i].innerHTML = c.contenu();
    elementsChamps[i].classList.toggle('grise', !!c.grise?.());
  });
}

// ---- Ascenseurs
function ascenseur(id: string, vertical: boolean): () => void {
  const racine = $<HTMLDivElement>(id);
  const piste = racine.querySelector('.piste') as HTMLDivElement;
  const curseur = racine.querySelector('.curseur') as HTMLDivElement;
  const [moins, plus] = Array.from(racine.querySelectorAll('.fleche')) as HTMLButtonElement[];

  const mesures = () => {
    const { vue: v, tout } = poste.vue.etendue;
    return vertical
      ? { debut: tout.y1 - v.y1, taille: v.y1 - v.y0, total: tout.y1 - tout.y0 }
      : { debut: v.x0 - tout.x0, taille: v.x1 - v.x0, total: tout.x1 - tout.x0 };
  };
  const pas = (sens: number) => {
    const d = sens * mesures().taille * 0.1;
    if (vertical) poste.vue.deplacer(0, -d);
    else poste.vue.deplacer(d, 0);
  };
  moins.addEventListener('click', () => pas(-1));
  plus.addEventListener('click', () => pas(1));

  curseur.addEventListener('pointerdown', (e) => {
    curseur.setPointerCapture(e.pointerId);
    const longueur = vertical ? piste.clientHeight : piste.clientWidth;
    const total = mesures().total;
    let dernier = vertical ? e.clientY : e.clientX;
    const bouger = (ev: PointerEvent) => {
      const pos = vertical ? ev.clientY : ev.clientX;
      const d = ((pos - dernier) / longueur) * total;
      dernier = pos;
      if (vertical) poste.vue.deplacer(0, -d);
      else poste.vue.deplacer(d, 0);
    };
    const lacher = () => {
      curseur.removeEventListener('pointermove', bouger);
      curseur.removeEventListener('pointerup', lacher);
    };
    curseur.addEventListener('pointermove', bouger);
    curseur.addEventListener('pointerup', lacher);
  });

  return () => {
    const m = mesures();
    const longueur = vertical ? piste.clientHeight : piste.clientWidth;
    const taille = Math.max(14, (m.taille / m.total) * longueur);
    const debut = Math.min(longueur - taille, (m.debut / m.total) * longueur);
    if (vertical) {
      curseur.style.top = `${debut}px`;
      curseur.style.height = `${taille}px`;
    } else {
      curseur.style.left = `${debut}px`;
      curseur.style.width = `${taille}px`;
    }
  };
}
const majV = ascenseur('ascenseur-v', true);
const majH = ascenseur('ascenseur-h', false);
function majAscenseurs(): void {
  majV();
  majH();
}

// ---- Clavier
const mac = window.dao.platform === 'darwin';
document.addEventListener('keydown', (e) => {
  const champ = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
  if (champ) return;
  if ((mac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k' && !poste.enSaisie) {
    e.preventDefault();
    palette.fermer();
    recherche.ouvrir();
    return;
  }
  if (e.code === 'Space' && !poste.enSaisie) {
    e.preventDefault();
    if (!e.repeat) basculerPalette();
    return;
  }
  if (e.key === 'Escape' && (palette.ouverte || paletteCalculs.ouverte || paletteMeca.ouverte)) {
    palette.fermer();
    paletteCalculs.fermer();
    paletteMeca.fermer();
    return;
  }
  poste.clavier(e);
});
document.addEventListener('keyup', (e) => poste.clavierRelache(e));
// Coller dans la ligne de dialogue (un résultat de calcul, une cote…).
document.addEventListener('paste', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  const t = e.clipboardData?.getData('text/plain');
  if (t) {
    e.preventDefault();
    poste.coller(t);
  }
});

// ---- Menus
window.dao.onMenu((id, libelle) => commande(id, libelle));
function commande(id: string, libelle: string): void {
  if (id.startsWith('fichier.recent:')) {
    void fichier.ouvrir(id.slice('fichier.recent:'.length));
    return;
  }
  switch (id) {
    case 'fichier.nouveau':
      void fichier.nouveauOuSession();
      break;
    case 'fichier.ouvrir':
      void fichier.ouvrir();
      break;
    case 'fichier.enregistrer':
      void fichier.enregistrer();
      break;
    case 'fichier.enregistrer-sous':
      void fichier.enregistrerSous();
      break;
    case 'fichier.fusionner':
      void fichier.fusionner();
      break;
    case 'fichier.revenir':
      void fichier.revenir();
      break;
    case 'fichier.backup':
      void fichier.backup();
      break;
    case 'fichier.relire-backup':
      void fichier.relireBackup();
      break;
    case 'fichier.imprimer':
      void fichier.imprimer();
      break;
    case 'fichier.exporter':
      void fichier.exporter();
      break;
    case 'fichier.apercu':
      apercu.ouvrir(fichier.page(), poste.format.nom);
      break;
    case 'fichier.partager':
      void fichier.partager();
      break;
    case 'fichier.quitter-session':
      void fichier.quitter();
      break;
    case 'edition.annuler':
      poste.annulerAction();
      break;
    case 'edition.refaire':
      poste.refaireAction();
      break;
    case 'vue.3d':
      if (libelle === 'Vue 3D') module3d.basculer();
      else module3d.ouvrir();
      break;
    case 'groupe.placer':
      void fichier.placerGroupe();
      break;
    case 'groupe.enregistrer-sous':
      poste.choisir(new EnregistrementGroupe(poste.contexte));
      break;
    case 'edition.copier':
      poste.choisir(new CopieSelection(poste.contexte));
      break;
    case 'edition.coller': {
      // Pendant une saisie : le texte copié (résultat d'un calcul…) va dans la ligne de dialogue.
      if (poste.enSaisie || poste.fonction.question()) {
        void navigator.clipboard.readText().then((t) => t && poste.coller(t));
        break;
      }
      const pp = lirePressePapiers();
      if (pp?.entites.length) poste.choisir(new Collage(poste.contexte, pp));
      else dire('Coller : le presse-papiers est vide (Edition > Copier).');
      break;
    }
    case 'fichier.enregistrer-selection':
      poste.choisir(new EnregistrementSelection(poste.contexte, (es) => void fichier.enregistrerSelection(es)));
      break;
    case 'fichier.joindre':
      void window.dao.choisirFichier('Ajouter une pièce jointe').then((c) => c && poste.choisir(new AjoutPieceJointe(poste.contexte, c)));
      break;
    case 'fichier.joint-consulter':
      poste.choisir(new ConsultationPieceJointe(poste.contexte, (c) => void ouvrirJointe(c)));
      break;
    case 'fichier.joints-liste':
      void listeJointes();
      break;
    case 'gmac.executer':
      void window.dao.ouvrirMacro().then((m) => m && lancerMacro(m));
      break;
    case 'gmac.inserer':
      void insererDansMenu('gmac');
      break;
    case 'groupe.inserer':
      void insererDansMenu('groupe');
      break;
    case 'metier.annuler-case':
      modeCase = { type: 'annuler' };
      dire("Annulation d'une case menu. Désigner une case de la bibliothèque MECA.");
      paletteMeca.ouvrir(dessin.getBoundingClientRect());
      boutonMeca.classList.add('enfonce');
      break;
    case 'metier.changer':
      dire('Menu métier : MECA (seul menu métier installé avec BluePrint CAD).');
      break;
    case 'metier.informations': {
      const perso = Object.keys(lireCases()).length;
      dire(`Menu métier MECA : 30 cases de cotation, ${CASES_BIBLIOTHEQUE.filter((c) => !('vide' in c)).length} pièces de bibliothèque, ${perso} case(s) affectée(s), ${lireDesactivees().length} désactivée(s).`);
      break;
    }
    case 'metier.recent.meca':
      paletteMeca.ouvrir(dessin.getBoundingClientRect());
      boutonMeca.classList.add('enfonce');
      break;
    case 'outils.dessin-vers-dxf':
      void fichier.convertirDes();
      break;
    case 'outils.dxf-vers-dessin':
      dire("Le DXF est le format de BluePrint CAD : un DXF (versions R9 à R2018) s'ouvre directement.");
      void fichier.ouvrir();
      break;
    case 'outils.iges-vers-dessin':
      void fichier.importerIges();
      break;
    case 'outils.dessin-vers-iges':
      void fichier.exporterIges();
      break;
    case 'preferences.backup-auto':
      void reglerBackup();
      break;
    case 'aide.rechercher':
      recherche.ouvrir();
      break;
    case 'aide.a-propos':
    case 'aide.mise-a-jour':
      aide.ouvrir('mise-a-jour');
      break;
    case 'aide.index':
      aide.ouvrir('index');
      break;
    case 'aide.utilisation':
      aide.ouvrir('utilisation');
      break;
    case 'aide.menu-principal':
      aide.ouvrir('menus');
      break;
    case 'aide.module-2d':
      aide.ouvrir('module2d');
      break;
    case 'aide.nouveautes':
      aide.ouvrir('nouveautes');
      break;
    case 'aide.temps':
      aide.ouvrir('temps');
      break;
    case 'aide.signaler':
      void signaler();
      break;
    case 'aide.vite':
      ouvrirVite(lireStockage(CLE_VITE, { oui: true }).oui, (oui) => ecrireStockage(CLE_VITE, { oui }));
      break;
    default:
      pasEncore(libelle);
  }
}

// ---- Signaler un problème (Aide > Signaler un problème ; erreurs ; plantages)

/** Erreur survenue dans l'interface pendant cette séance, pas encore signalée. */
let derniereErreur: Incident | null = null;
/** Messages d'erreur sans gravité, à ne pas signaler. */
const ERREURS_BENIGNES = /ResizeObserver loop/;

function travailEnCours(): InfosTravail {
  return {
    theme: prefs.theme === 'moderne' ? `moderne (${prefs.apparence === 'systeme' ? 'comme le système' : prefs.apparence})` : prefs.theme,
    dessin: `${poste.format.nom}, ${poste.dessin.toutes.length} éléments`,
    fonction: poste.fonction?.nom,
    messages: [...derniersMessages],
  };
}

async function signaler(incident?: Incident): Promise<void> {
  const enAttente = incident ? [] : await window.dao.signalementIncidents();
  const choisi = incident ?? enAttente.at(-1) ?? derniereErreur ?? undefined;
  if (choisi === derniereErreur) derniereErreur = null;
  await ouvrirSignalement({ incident: choisi, travail: travailEnCours(), dire });
}

/** Au démarrage : une erreur ou un plantage de la dernière utilisation est proposé au signalement. */
async function proposerIncidents(): Promise<void> {
  const l = await window.dao.signalementIncidents();
  if (l.length) await signaler(l.at(-1));
}

/**
 * Erreur dans l'interface : le logiciel continue ; la ligne de dialogue donne son code et dit comment la
 * signaler (une fenêtre à chaque petite erreur serait pénible). Un vrai plantage, lui, ouvre la boîte de
 * signalement (au redémarrage de l'interface, ou au lancement suivant).
 */
function noterErreur(e: unknown): void {
  const message = e instanceof Error ? e.message : String(e ?? '');
  if (!message || ERREURS_BENIGNES.test(message)) return;
  derniereErreur = { message, pile: e instanceof Error ? e.stack : undefined, origine: 'interface', date: Date.now() };
  console.error(e);
  dire(`Une erreur s'est produite (${codeErreur(message, derniereErreur.pile)}). Pour la signaler : Aide > Signaler un problème.`);
}
window.addEventListener('error', (ev) => noterErreur(ev.error ?? ev.message));
window.addEventListener('unhandledrejection', (ev) => noterErreur(ev.reason));

// ---- Préférences
function appliquerPrefs(p: Prefs): void {
  if (p.backupMinutes !== prefs.backupMinutes || !minuterieBackupLancee) {
    minuterieBackupLancee = true;
    demarrerBackup(p.backupMinutes ?? 0);
  }
  const grandes = prefs.grandesIcones !== p.grandesIcones || prefs.theme !== p.theme;
  prefs = p;
  const c = couleursDessin(p);
  // Thème « Classique » ou « Moderne » : même agencement, styles différents (styles.css).
  document.documentElement.dataset.theme = p.theme;
  if (c.bordure) document.documentElement.style.setProperty('--bordure-dessin', c.bordure);
  else document.documentElement.style.removeProperty('--bordure-dessin');
  majFonction(codeFonction);
  poste.traitFort2px = p.traitFort === '2px';
  poste.aides = { mesures: p.mesuresCurseur, accrochage: p.accrochageVisible };
  poste.vue.redessiner();
  module3d.vue.fond(c.fond);
  if (grandes) {
    palette.construire(p.grandesIcones, p.theme === 'moderne');
    paletteCalculs.construire(p.grandesIcones, p.theme === 'moderne');
    paletteMeca.construire(p.grandesIcones, p.theme === 'moderne');
  }
}
window.dao.onPrefs(appliquerPrefs);

// ---- Démarrage
pret = true;
palette.construire(prefs.grandesIcones);
direRepos();
majTableau();
majAscenseurs();
window.dao.getPrefs().then((p) => {
  prefs = { ...p, grandesIcones: !p.grandesIcones }; // force la construction de la palette
  appliquerPrefs(p);
});
if (location.hash !== '#capture') void fichier.reprendre();
// Une erreur ou un plantage lors de la dernière utilisation : proposé au signalement.
if (location.hash !== '#capture') setTimeout(() => void proposerIncidents(), 1500);

// ---- Case F1 : paramètres du plan (fichier d'application, éditeur, plan), enregistrés avec le dessin.
// Les champs « Éditeur » d'un nouveau dessin reprennent les derniers saisis.
const EDITEUR = ['societe', 'departement', 'service', 'dessinateur'] as const;
function lireStockage<T>(cle: string, defaut: T): T {
  try {
    const v = localStorage.getItem(cle);
    return v ? { ...defaut, ...(JSON.parse(v) as object) } : defaut;
  } catch {
    return defaut;
  }
}
function ecrireStockage(cle: string, v: unknown): void {
  try {
    localStorage.setItem(cle, JSON.stringify(v));
  } catch {
    // stockage indisponible : le réglage vaut pour la session
  }
}
async function parametresPlan(): Promise<void> {
  const p = poste.dessin.infos.plan;
  const dernier = lireStockage<Record<string, string>>('editeur', {});
  const texte = (cle: keyof typeof p, libelle: string) => ({ cle, libelle, type: 'texte' as const, valeur: p[cle] ?? ((EDITEUR as readonly string[]).includes(cle) ? (dernier[cle] ?? '') : ''), max: 40 });
  const r = await demanderReglages('Paramètres du plan', [
    { titre: 'Application', champs: [{ cle: 'fichier', libelle: 'Fichiers application', type: 'texte', valeur: p.fichier ?? '', max: 40 }] },
    { titre: 'Éditeur', champs: [texte('societe', 'Société'), texte('departement', 'Département'), texte('service', 'Service'), texte('dessinateur', 'Dessinateur')] },
    { titre: 'Plan', champs: [texte('designation', 'Désignation'), texte('reference', 'Référence'), texte('revision', 'Révision')] },
  ]);
  if (!r) return;
  const plan = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v).trim().slice(0, 40)]).filter(([, v]) => v !== ''));
  poste.dessin.changerInfos((i) => (i.plan = plan));
  ecrireStockage('editeur', Object.fromEntries(EDITEUR.map((k) => [k, plan[k] ?? ''])));
  dire('Paramètres du plan modifiés.');
  direRepos();
}

// ---- Case F4 : options (affichage, grille, origine de mesure, cotation), gardées d'une session à l'autre.
interface Options {
  miseAJourImages: 'automatique' | 'confirmation' | 'manuelle';
  piecesJointes: boolean;
  grille: boolean;
  hachures: boolean;
  images: boolean;
  pointsReference: boolean;
  origineFixe: boolean;
  cotation: ReglageCotation;
}
const OPTIONS_DEFAUT: Options = { miseAJourImages: 'automatique', piecesJointes: true, grille: false, hachures: true, images: true, pointsReference: true, origineFixe: true, cotation: { ...COTATION_DEFAUT } };
function appliquerOptions(o: Options): void {
  poste.options = { grille: o.grille, pointsReference: o.pointsReference, origineFixe: o.origineFixe, images: o.images, piecesJointes: o.piecesJointes ?? true };
  fichier.miseAJourImages = o.miseAJourImages;
  if (poste.contexte.reglages) poste.contexte.reglages.afficherHachures = o.hachures;
  Object.assign(cotation, o.cotation);
  etat.cotation = cotation.systeme;
  majTableau();
  poste.vue.redessiner();
}
appliquerOptions(lireStockage('options', OPTIONS_DEFAUT));
async function reglerOptions(): Promise<void> {
  const o: Options = { ...poste.options, miseAJourImages: fichier.miseAJourImages, hachures: poste.contexte.reglages?.afficherHachures ?? true, cotation: { ...cotation } };
  const r = await demanderReglages('Options', [
    {
      titre: 'Affichage',
      champs: [
        { cle: 'grille', libelle: 'Grille', type: 'case', valeur: o.grille },
        { cle: 'hachures', libelle: 'Hachures', type: 'case', valeur: o.hachures },
        { cle: 'images', libelle: 'Images', type: 'case', valeur: o.images },
        { cle: 'piecesJointes', libelle: 'Pièces jointes', type: 'case', valeur: o.piecesJointes },
        { cle: 'pointsReference', libelle: 'Points de référence (et traits invisibles)', type: 'case', valeur: o.pointsReference },
      ],
    },
    {
      titre: 'Grille et mesure',
      champs: [
        { cle: 'pas', libelle: 'Pas de la grille (mm)', type: 'nombre', valeur: poste.grille.pas, min: 0.01, pas: 0.5 },
        { cle: 'origine', libelle: 'Origine de mesure', type: 'choix', valeur: o.origineFixe ? 'fixe' : 'flottante', options: [{ valeur: 'fixe', libelle: 'Fixe' }, { valeur: 'flottante', libelle: 'Flottante (dernier point)' }] },
      ],
    },
    {
      titre: 'Mise à jour des images',
      champs: [
        {
          cle: 'miseAJourImages',
          libelle: 'Quand le fichier a changé',
          type: 'choix',
          valeur: o.miseAJourImages,
          options: [
            { valeur: 'automatique', libelle: 'Automatique' },
            { valeur: 'confirmation', libelle: 'Automatique, avec confirmation' },
            { valeur: 'manuelle', libelle: 'Manuelle (liste des images)' },
          ],
        },
      ],
    },
    {
      titre: 'Cotation',
      champs: [
        {
          cle: 'systeme',
          libelle: 'Système de cotation',
          type: 'choix',
          valeur: o.cotation.systeme,
          options: [
            { valeur: 'AFNOR', libelle: 'AFNOR' },
            { valeur: 'ISO', libelle: 'ISO' },
            { valeur: 'ANSI', libelle: 'ANSI (pouces)' },
            { valeur: 'ARCHI', libelle: 'ARCHI (architecture)' },
          ],
        },
        { cle: 'unite', libelle: 'Unité de mesure (AFNOR, ISO)', type: 'choix', valeur: o.cotation.unite, options: [{ valeur: 'mm', libelle: 'mm' }, { valeur: 'cm', libelle: 'cm' }, { valeur: 'm', libelle: 'm' }] },
        { cle: 'unidirectionnelle', libelle: 'Cotation unidirectionnelle (ISO, ANSI)', type: 'case', valeur: o.cotation.unidirectionnelle },
        { cle: 'fractionnaire', libelle: 'Cotation fractionnaire (ANSI)', type: 'case', valeur: o.cotation.fractionnaire },
        { cle: 'decimales', libelle: 'Nombre de décimales maximum', type: 'nombre', valeur: o.cotation.decimales, min: 0, max: 6, pas: 1 },
        { cle: 'hauteur', libelle: 'Hauteur des écritures de cotes (mm)', type: 'nombre', valeur: o.cotation.hauteur, min: 0.5, pas: 0.5 },
        { cle: 'hauteurRepere', libelle: 'Hauteur des écritures des repères (mm)', type: 'nombre', valeur: o.cotation.hauteurRepere, min: 0.5, pas: 0.5 },
      ],
    },
  ]);
  if (!r) return;
  const positif = (v: unknown, d: number) => (typeof v === 'number' && v > 0 ? v : d);
  const nouvelles: Options = {
    miseAJourImages: r.miseAJourImages === 'confirmation' || r.miseAJourImages === 'manuelle' ? r.miseAJourImages : 'automatique',
    piecesJointes: !!r.piecesJointes,
    grille: !!r.grille,
    hachures: !!r.hachures,
    images: !!r.images,
    pointsReference: !!r.pointsReference,
    origineFixe: r.origine !== 'flottante',
    cotation: {
      systeme: r.systeme === 'ISO' || r.systeme === 'ANSI' || r.systeme === 'ARCHI' ? r.systeme : 'AFNOR',
      unite: r.unite === 'cm' || r.unite === 'm' ? r.unite : 'mm',
      unidirectionnelle: !!r.unidirectionnelle,
      fractionnaire: !!r.fractionnaire,
      decimales: Math.max(0, Math.min(6, Math.round(Number(r.decimales) || 0))),
      hauteur: positif(r.hauteur, 3),
      hauteurRepere: positif(r.hauteurRepere, 5),
    },
  };
  const avant = { ...cotation };
  const n = nouvelles.cotation;
  const autreSysteme = n.systeme !== avant.systeme || (n.systeme === 'ANSI' && n.fractionnaire !== avant.fractionnaire);
  // Un changement de système propose son pas de grille (1 mm, 1/32" ou 1/100", 1 cm), sauf pas tapé à la main.
  poste.grille.pas = autreSysteme && r.pas === poste.grille.pas ? pasGrilleSysteme(n) : positif(r.pas, poste.grille.pas);
  appliquerOptions(nouvelles);
  ecrireStockage('options', nouvelles);
  // Les cotes déjà faites passent dans le nouveau réglage (valeurs, sens d'écriture, extrémités).
  const changees = convertirCotes(poste.dessin.toutes, cotation);
  if (changees.length) poste.dessin.remplacerChaque(changees);
  dire(changees.length ? `Options modifiées. ${changees.length} cote(s) transformée(s) en ${cotation.systeme}.` : 'Options modifiées.');
}

// ---- Images : insertion (B1) et liste (B4)
async function insererImage(): Promise<void> {
  const lu = await window.dao.ouvrirImage();
  if (!lu) return dire("Insertion d'une image : fichier non lu (formats : PNG, JPEG, GIF, BMP, WebP, ICO, SVG ; 25 Mo au plus).");
  const px = await dimensionsPx(lu.donnees);
  const [l, h] = dimensionsPapier(px, poste.format);
  const id = identifiantImage(lu.donnees);
  poste.choisir(new InsertionImage(poste.contexte, id, { donnees: lu.donnees, fichier: lu.chemin, date: lu.date, taille: lu.taille, px }, l, h, lu.nom));
}

async function listeImages(): Promise<void> {
  const d = poste.dessin;
  const dossier = fichier.chemin ? fichier.chemin.replace(/[\\/][^\\/]*$/, '') : null;
  const ko = (o: number) => (o >= 1024 * 1024 ? `${nombre(o / 1024 / 1024, 1)} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`);
  await ouvrirListeImages({
    lire: async () => {
      const ids = [...new Set(d.toutes.filter((e) => e.genre === 'image').map((e) => String(e.params?.image)))];
      return Promise.all(
        ids.flatMap((id) => {
          const img = d.images.get(id);
          const e = d.toutes.find((x) => x.genre === 'image' && x.params?.image === id)!;
          if (!img) return [];
          return [
            window.dao.etatImage(img.fichier, null).then((etat) => ({
              id,
              chemin: img.fichier,
              dimensions: `${nombre(Number(e.params?.largeur), 1)} x ${nombre(Number(e.params?.hauteur), 1)}`,
              taille: ko(img.taille),
              plan: PLANS.find((p) => p.cle === planDe(e))!.nom,
              etat: etatLien(img, etat),
              apercu: img.donnees,
            })),
          ];
        }),
      );
    },
    mettreAJour: async (id) => {
      const img = d.images.get(id);
      if (img) await fichier.relireImage(id, img.fichier);
    },
    reparer: async (id) => {
      const img = d.images.get(id);
      const voisin = img && dossier ? await window.dao.etatImage(img.fichier, dossier) : null;
      if (voisin?.existe) return void (await fichier.relireImage(id, voisin.chemin));
      const lu = await window.dao.ouvrirImage();
      if (lu) await fichier.relireImage(id, lu.chemin);
    },
    editer: (id) => {
      const img = d.images.get(id);
      if (img) void window.dao.editerImage(img.fichier);
    },
    supprimer: (id) => {
      d.retirer(...d.toutes.filter((e) => e.genre === 'image' && e.params?.image === id));
      poste.vue.redessiner();
    },
  });
}

// ---- Pièces jointes : consultation (logiciel associé du système) et liste
async function ouvrirJointe(chemin: string): Promise<void> {
  const etat = await window.dao.etatImage(chemin, null);
  if (!etat.existe) return dire(`Pièce jointe : lien rompu, fichier absent (${chemin}).`);
  // Sécurité : la pièce jointe s'ouvre dans le logiciel du système ; son chemin vient du dessin, qui peut
  // avoir été fabriqué pour viser un programme. On montre le chemin réel et on demande confirmation.
  const ouvrir = await window.dao.question('Ouvrir cette pièce jointe ?', `Le fichier suivant va s'ouvrir dans le logiciel associé du système :\n\n${chemin}\n\nN'ouvrez une pièce jointe que si vous connaissez la provenance du dessin.`, ['Ouvrir', 'Annuler']);
  if (ouvrir !== 0) return dire('Ouverture de la pièce jointe annulée.');
  const err = await window.dao.editerImage(chemin);
  dire(err ? `Pièce jointe : ${err}` : `Pièce jointe ouverte : ${chemin}`);
}

async function listeJointes(): Promise<void> {
  const d = poste.dessin;
  await ouvrirListe(
    'Pièces jointes',
    ['Fichier', 'Niveau', 'État'],
    async () =>
      Promise.all(
        d.toutes
          .map((e, i) => ({ e, i }))
          .filter(({ e }) => e.genre === 'jointe')
          .map(async ({ e, i }) => {
            const chemin = String(e.params?.fichier ?? '');
            const etat = await window.dao.etatImage(chemin, null);
            return { id: String(i), cellules: [chemin, String(e.niveau), etat.existe ? 'Ok' : 'Fichier absent'], alerte: !etat.existe };
          }),
      ),
    [
      { texte: 'Consulter', action: (id) => ouvrirJointe(String(d.toutes[Number(id)]?.params?.fichier ?? '')), actif: (l) => !l.alerte },
      { texte: 'Remplacer...', action: async (id) => {
        const e = d.toutes[Number(id)];
        const c = await window.dao.choisirFichier('Nouveau fichier de la pièce jointe');
        if (e && c) d.remplacerPlusieurs([[e, { ...e, params: { ...e.params, fichier: c } }]]);
      } },
      { texte: 'Supprimer', action: (id) => {
        const e = d.toutes[Number(id)];
        if (e) d.retirer(e);
        poste.vue.redessiner();
      } },
    ],
  );
}

// ---- Cases de la bibliothèque MECA : affectation d'un groupe ou d'une macro (Groupe / Gmac > Insérer dans
// le menu), désactivation (Métier > Annuler case). Gardées d'une session à l'autre.
interface CasePerso {
  type: 'groupe' | 'gmac';
  chemin: string;
  nom: string;
}
// Déclarées en fonctions : la palette MECA les lit dès sa création, plus haut dans ce fichier.
function lireCases(): Record<string, CasePerso> {
  return lireStockage<Record<string, CasePerso>>('casesBibliotheque', {});
}
function lireDesactivees(): string[] {
  return lireStockage<{ codes: string[] }>('casesDesactivees', { codes: [] }).codes;
}
let modeCase: { type: 'affecter'; fichier: CasePerso } | { type: 'annuler' } | null = null;

function casesBibliotheque() {
  const perso = lireCases();
  const desactivees = lireDesactivees();
  return CASES_BIBLIOTHEQUE.map((c) => {
    const p = perso[c.code];
    if (p) return { code: c.code, libelle: `${p.type === 'gmac' ? 'Macro' : 'Groupe'} ${p.nom} (${p.chemin})`, texte: p.nom };
    return { ...c, icone: 'vide' in c ? undefined : ICONES_BIBLIOTHEQUE[c.code], desactivee: desactivees.includes(c.code) };
  });
}

async function traiterCase(code: string): Promise<void> {
  const mode = modeCase!;
  modeCase = null;
  const cases = lireCases();
  const piece = CASES_BIBLIOTHEQUE.find((c) => c.code === code);
  if (mode.type === 'affecter') {
    if (piece && !('vide' in piece) && !cases[code]) return dire(`Case ${code} : seules les cases libres peuvent recevoir un fichier.`);
    if (cases[code]) {
      const r = await window.dao.question(`La case ${code} est déjà affectée à ${cases[code].nom}.`, 'Remplacer son affectation ?', ['Remplacer', 'Annuler']);
      if (r !== 0) return;
    }
    cases[code] = mode.fichier;
    ecrireStockage('casesBibliotheque', cases);
    dire(`Case ${code} : ${mode.fichier.nom}.`);
  } else {
    if (cases[code]) {
      const r = await window.dao.question(`Case ${code} : ${cases[code].nom}.`, "Supprimer l'affectation de cette case ?", ['Supprimer', 'Annuler']);
      if (r !== 0) return;
      delete cases[code];
      ecrireStockage('casesBibliotheque', cases);
      dire(`Case ${code} libérée.`);
    } else if (piece && !('vide' in piece)) {
      const codes = lireDesactivees();
      const active = !codes.includes(code);
      const r = await window.dao.question(`Case ${code} : ${piece.libelle}`, active ? 'Désactiver cette case ?' : 'Réactiver cette case ?', [active ? 'Désactiver' : 'Réactiver', 'Annuler']);
      if (r !== 0) return;
      ecrireStockage('casesDesactivees', { codes: active ? [...codes, code] : codes.filter((x) => x !== code) });
      dire(`Case ${code} ${active ? 'désactivée' : 'réactivée'}.`);
    } else return dire(`Case ${code} : déjà libre.`);
  }
  paletteMeca.majBibliotheque(casesBibliotheque());
}

async function utiliserCasePerso(p: CasePerso): Promise<void> {
  if (p.type === 'groupe') return fichier.placerGroupe(p.chemin);
  const m = await window.dao.lireMacro(p.chemin);
  if (!m) return dire(`Macro introuvable : ${p.chemin}`);
  lancerMacro(m);
}

function lancerMacro(m: { nom: string; contenu: string }): void {
  try {
    poste.choisir(new PlacementMacro(poste.contexte, lireMacroTexte(m.contenu), m.nom));
  } catch (e) {
    dire(`Erreur d'interprétation du fichier ${m.nom}, ${(e as Error).message}.`);
  }
}

/** Groupe / Gmac > Insérer dans le menu : le fichier, puis la case (palette MECA ouverte). */
async function insererDansMenu(type: 'groupe' | 'gmac'): Promise<void> {
  const f = type === 'gmac' ? await window.dao.ouvrirMacro() : await window.dao.ouvrirGroupe();
  if (!f || !f.chemin) return;
  modeCase = { type: 'affecter', fichier: { type, chemin: f.chemin, nom: f.nom } };
  dire(`Affectation de ${f.nom} à une case menu. Désigner une case libre de la bibliothèque MECA.`);
  paletteMeca.ouvrir(dessin.getBoundingClientRect());
  boutonMeca.classList.add('enfonce');
}

// ---- Préférences > Backup automatique : le dessin est recopié dans le backup toutes les N minutes.
let minuterieBackup = 0;
let minuterieBackupLancee = false;
function demarrerBackup(minutes: number): void {
  clearInterval(minuterieBackup);
  if (minutes > 0) minuterieBackup = window.setInterval(() => void (poste.dessin.modifie && fichier.backup(true)), minutes * 60_000);
}
async function reglerBackup(): Promise<void> {
  const r = await demanderReglages('Backup automatique', [
    { titre: 'Backup automatique', champs: [{ cle: 'minutes', libelle: 'Toutes les (minutes, 0 : jamais)', type: 'nombre', valeur: prefs.backupMinutes ?? 0, min: 0, max: 120, pas: 1 }] },
  ]);
  if (!r) return;
  const minutes = Math.max(0, Math.min(120, Math.round(Number(r.minutes) || 0)));
  window.dao.reglerPref('backupMinutes', minutes);
  dire(minutes ? `Backup automatique toutes les ${minutes} minute${minutes > 1 ? 's' : ''}.` : 'Backup automatique désactivé.');
}

// ---- Aide : index des fonctions (fiche de chaque case), utilisation, menus, panneau « Vite ! »
const aide = new Aide(
  () =>
    entreesAide([
      { titre: 'Palette CALCULS', cases: CASES_CALCULS },
      { titre: 'MECA — cotation', cases: CASES_MECA_COTATION },
      { titre: 'MECA — bibliothèque', cases: CASES_BIBLIOTHEQUE },
    ]),
  (code, libelle) => choisirCase({ code, ligne: 0, colonne: 0, libelle }),
  () => ({ depuis: fichier.ouvertLe, actions: poste.dessin.version }),
  () => void signaler(),
);
// Le panneau « Vite ! » s'ouvre au démarrage, tant que sa case reste cochée (comme l'original).
if (location.hash !== '#capture' && lireStockage(CLE_VITE, { oui: true }).oui) {
  setTimeout(() => ouvrirVite(true, (oui) => ecrireStockage(CLE_VITE, { oui })), 600);
}
