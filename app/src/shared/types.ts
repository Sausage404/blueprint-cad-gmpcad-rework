// Types partagés entre le processus principal (menus, préférences) et l'interface.

export const APP_NAME = 'BluePrint CAD'; // nom choisi par l'auteur le 18/11/2026 (jamais « GMPCAD », marque déposée)

export type Fond = 'blanc' | 'gris' | 'noir';
export type TraitFort = 'luminosite' | '2px';
export type CouleurReticule = 'standard' | 'magenta' | 'cyan' | 'jaune';
/** « Moderne » (par défaut) : même agencement, plus net ; « Classique » : au plus près de l'original (cahier, section 9 ter). */
export type Theme = 'classique' | 'moderne';
/** Thème « Moderne » : clair, sombre, ou comme le système (Mac ou Windows). */
export type Apparence = 'systeme' | 'clair' | 'sombre';

export interface Prefs {
  theme: Theme;
  /** Le thème a été choisi dans Préférences > Thème (sinon, le thème par défaut s'applique). */
  themeChoisi?: boolean;
  /** Préférences > Thème : thème Moderne clair, sombre ou comme le système. */
  apparence: Apparence;
  fond: Fond;
  traitFort: TraitFort;
  reticule: CouleurReticule;
  sonSaisie: boolean;
  sonAvertissement: boolean;
  grandesIcones: boolean;
  /** Nouveauté : longueur et angle affichés près du réticule pendant un tracé. */
  mesuresCurseur: boolean;
  /** Nouveauté : au survol, repère du point sur lequel Ctrl va sauter. */
  accrochageVisible: boolean;
  /** Les 4 derniers fichiers ouverts ou enregistrés. */
  recents: string[];
  /** Préférences > Positions des fenêtres : position mémorisée de la fenêtre principale (null : plein écran). */
  fenetre: { x: number; y: number; width: number; height: number } | null;
  /** Préférences > Backup automatique : intervalle en minutes (0 : pas de backup automatique). */
  backupMinutes: number;
}

// Valeurs de l'installation d'origine : fond gris, grandes icônes (LargeIcons=1).
export const DEFAULT_PREFS: Prefs = {
  theme: 'moderne', // au premier lancement, choix de l'auteur du 18/11/2026 ; « Classique » reste dans Préférences > Thème
  apparence: 'systeme',
  fond: 'gris',
  traitFort: 'luminosite',
  reticule: 'standard',
  sonSaisie: false,
  sonAvertissement: false,
  grandesIcones: true,
  mesuresCurseur: true,
  accrochageVisible: true,
  recents: [],
  fenetre: null,
  backupMinutes: 0,
};

export interface FichierLu {
  chemin: string | null;
  nom: string;
  contenu: string;
  /** Dessin GMPCAD binaire (.des) : `contenu` contient ses octets en Latin-1. */
  des?: boolean;
}

export interface PageImprimee {
  svg: string;
  largeur: number;
  hauteur: number;
  nom: string;
}

/** Ce que le preload expose à l'interface (window.dao). */
export interface DaoApi {
  platform: string;
  getPrefs(): Promise<Prefs>;
  onPrefs(cb: (prefs: Prefs) => void): void;
  onMenu(cb: (command: string, label: string) => void): void;
  ouvrir(titre: string): Promise<FichierLu | null>;
  lire(chemin: string): Promise<FichierLu | null>;
  enregistrer(chemin: string, contenu: string): Promise<string>;
  enregistrerSous(nom: string, contenu: string): Promise<string | null>;
  backup(contenu: string): Promise<boolean>;
  relireBackup(): Promise<FichierLu | null>;
  /** Boîte de question du système ; renvoie l'index du bouton choisi (le dernier = Annuler). */
  question(message: string, detail: string, boutons: string[]): Promise<number>;
  imprimer(page: PageImprimee): Promise<string | null>;
  exporterPdf(page: PageImprimee): Promise<string | null>;
  /** Titre de la fenêtre, état « modifié » et chemin du fichier. */
  etatDessin(titre: string, modifie: boolean, chemin: string | null): void;
  /** Ferme la fenêtre sans plus rien demander. */
  fermer(): void;
  /** Chemin d'un fichier déposé sur la fenêtre (glisser-déposer). */
  cheminDe(fichier: File): string;
  /** Fichier > Exporter : chemin choisi (PDF, PNG ou SVG), puis écriture. */
  cheminExport(nom: string): Promise<string | null>;
  ecrirePdf(page: PageImprimee, chemin: string): Promise<void>;
  ecrireFichier(chemin: string, donnees: Uint8Array | string): Promise<void>;
  /** Partager le dessin en PDF : « menu » (Mac) ou « dossier » (Windows : PDF montré dans l'Explorateur). */
  partager(page: PageImprimee): Promise<'menu' | 'dossier'>;
  /** Lit un fichier texte (.txt) choisi par l'utilisateur ; null si abandon. */
  ouvrirTexte(): Promise<string | null>;
  /** Fichier d'un groupe relu par son chemin (case de bibliothèque affectée). */
  lireGroupe(chemin: string): Promise<FichierLu | null>;
  /** Menu Gmac : une macro (texte) choisie, ou relue par son chemin. */
  ouvrirMacro(): Promise<{ chemin: string; nom: string; contenu: string } | null>;
  lireMacro(chemin: string): Promise<{ chemin: string; nom: string; contenu: string } | null>;
  /** Menu Outils : un fichier texte d'un type donné (IGES…), lu ou écrit. */
  ouvrirTexteType(titre: string, extensions: string[]): Promise<{ chemin: string; nom: string; contenu: string } | null>;
  enregistrerTexte(titre: string, nom: string, extension: string, contenu: string): Promise<string | null>;
  /** Conversion par lots : des dessins .des choisis (octets en Latin-1), et le DXF écrit à côté de chacun. */
  choisirDes(): Promise<FichierLu[]>;
  ecrireDxfACote(chemin: string, contenu: string): Promise<string>;
  /** Pièces jointes : chemin d'un fichier quelconque choisi par l'utilisateur. */
  choisirFichier(titre: string): Promise<string | null>;
  /** Règle une préférence (gardée et envoyée à toutes les sessions). */
  reglerPref<K extends keyof Prefs>(cle: K, valeur: Prefs[K]): void;
  /** Fichier > Nouveau > Nouvelle session : une autre fenêtre ; false si 8 sessions sont déjà ouvertes. */
  nouvelleSession(): Promise<boolean>;
  /** Ouvre la calculatrice du système ; renvoie un message d'erreur (vide si tout va bien). */
  calculatrice(): Promise<string>;
  /** Case B1 : une image choisie par l'utilisateur, en « data URL ». */
  ouvrirImage(): Promise<ImageLue | null>;
  /** Relit une image (mise à jour, réparation d'un lien). */
  lireImage(chemin: string): Promise<ImageLue | null>;
  /** État du lien d'une image ; à défaut, un fichier de même nom dans le dossier du dessin (`voisin`). */
  etatImage(chemin: string, dossierDessin: string | null): Promise<{ chemin: string; existe: boolean; date: number; taille: number; voisin?: boolean }>;
  /** Ouvre l'image dans le logiciel associé du système. */
  editerImage(chemin: string): Promise<string>;
  /** Menu Groupe > Placer : le fichier d'un groupe (DXF), choisi par l'utilisateur. */
  ouvrirGroupe(): Promise<FichierLu | null>;
  /** Menu Groupe > Enregistrer sous : chemin du fichier écrit, null si abandon. */
  enregistrerGroupe(nom: string, contenu: string): Promise<string | null>;
  /** Reprise après plantage : copie du dessin non enregistré, relue au lancement suivant. */
  ecrireRecuperation(contenu: string, nom: string, chemin: string | null): Promise<void>;
  lireRecuperation(): Promise<Recuperation | null>;
  effacerRecuperation(): Promise<void>;
  // Aide > Signaler un problème (voir shared/signalement)
  signalementCapture(): Promise<string | null>;
  signalementInfos(): Promise<import('./signalement').InfosSysteme>;
  signalementIncidents(): Promise<import('./signalement').Incident[]>;
  signalementEnregistrer(texte: string, image: string | null): Promise<{ texte: string; fichierTexte: string; fichierImage: string | null } | null>;
  signalementEnvoyer(mode: 'github' | 'mail', titre: string, corps: string, fichier: string | null): Promise<string | null>;
  signalementCopier(texte: string): Promise<void>;
}

export interface ImageLue {
  chemin: string;
  nom: string;
  /** « data URL » (data:image/png;base64,…). */
  donnees: string;
  /** Date de modification (ms). */
  date: number;
  taille: number;
}

export interface Recuperation extends FichierLu {
  /** Date de la dernière copie (ms depuis 1970). */
  date: number;
}
