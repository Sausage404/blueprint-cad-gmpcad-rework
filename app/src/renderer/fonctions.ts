// Fonctions de dessin. Chacune demande des points ou des valeurs, dans l'ordre et avec les textes
// de l'original (aide GMPFRA.HLP, rubriques du « Module 2D », et messages GM1.MSE).
import {
  arc,
  arc3Points,
  cercle,
  demiDroite,
  droite,
  oblong,
  polygone,
  rayonMaxArrondi,
  rectangle,
  rectangleArrondi,
  rectangleIncline,
  segment,
  type Dessin,
  type Entite,
  type Trait,
} from './dessin';
import { dist, type Pt } from './geometrie';
import type { Motif } from './hachures';
import { angleDe, arcTroisPoints, type Primitive } from './primitives';

export interface Contexte {
  dessin: Dessin;
  attributs(): { niveau: number; trait: Trait };
  /** Dernières valeurs tapées (diamètre, rayon, largeur…), proposées par défaut la fois suivante. */
  memoire: Map<string, number>;
  /** Distance de désignation d'une entité, en mm (quelques pixels à l'écran). */
  rayon(): number;
  /** Message dans la ligne de dialogue (erreur, compte rendu). */
  dire(texte: string): void;
  /** Entités des niveaux affichés (case F9 : niveaux à représenter). Sinon : toutes. */
  visibles?(): readonly Entite[];
  /**
   * Entités désignables par la fonction en cours : celles du niveau de travail pour une fonction au repérage
   * limité (« ( ) »), celles de tous les niveaux affichés avec la case (*) ou F3.
   */
  designables?(): readonly Entite[];
  /** Réglages en cours du poste (hachures…), modifiés par les fonctions de réglage. */
  reglages?: { motifHachure: Motif; afficherHachures: boolean };
  /** Réglages du poste (fonctions de gestion de la ligne 5). */
  actions?: {
    zoomFenetre(a: Pt, b: Pt): void;
    derniereFenetre(): [Pt, Pt] | null;
    niveau(n: number): void;
    pasGrille(): number;
    grille(pas: number, origine: Pt | null): void;
    format(): string;
    changerFormat(nom: string): void;
    /** Fenêtre de saisie d'un texte de plusieurs lignes (fichier-texte), null si abandon. */
    texteLong?(initial: string): Promise<string | null>;
    /** Réaffiche le dessin après un changement fait hors d'un clic (réponse d'une fenêtre). */
    redessiner?(): void;
    /** Case F9 : affiche une fenêtre avec une liste de niveaux (null : tous). */
    afficher?(a: Pt, b: Pt, niveaux: Set<number> | null): void;
    /** Case F9 : X (toutes les entités, même hors du format), R (dimension réelle), P (dimension papier). */
    vueSpeciale?(mode: 'X' | 'R' | 'P'): void;
    /** Résultat d'un calcul, copié pour être collé dans la ligne de dialogue (⌘V / Ctrl+V). */
    copier?(texte: string): void;
    /** Origine de la grille (point par défaut de la case F20). */
    origine?(): Pt;
    /** Menu Groupe > Enregistrer sous : écrit le groupe dans un fichier ; renvoie son nom, null si abandon. */
    enregistrerGroupe?(groupe: Entite, nom: string): Promise<string | null>;
  };
}

export interface Question {
  texte: string; // sans « (déf, …) : », ajouté par le poste
  defaut: number | string;
  /** « texte » : réponse libre (liste de niveaux, O/N…) ; sinon un nombre. */
  type?: 'nombre' | 'texte';
  entier?: boolean;
}

export interface Fonction {
  readonly nom: string;
  /** Code de la case dans la palette (ex. « D1 »). */
  readonly code: string;
  /** Texte de la ligne de dialogue quand un point est attendu. */
  invite(): string;
  /** Valeur attendue au clavier, s'il y en a une. */
  question(): Question | null;
  valeur(v: number | string): void;
  /**
   * « entite » : la fonction attend la désignation d'une entité (petit réticule, sans grille ni calage) ;
   * sinon un point.
   */
  attente?(): 'point' | 'entite';
  /** Réponse par défaut quand un point est attendu (Entrée ou clic sur la ligne de dialogue), ex. « (déf, tout) ». */
  parDefaut?(): void;
  /** Type de trait du tracé élastique (fenêtre de sélection : mixte fin). */
  traitElastique?(): Trait | null;
  /**
   * Fonction « non exclusive » (réglage) : elle s'exécute sans quitter la fonction en cours, qui reprend
   * dès que `termine()` est vrai.
   */
  readonly ponctuelle?: boolean;
  termine?(): boolean;
  /** Point de référence du calage angulaire (null : pas de calage pour ce point). */
  dernierPoint(): Pt | null;
  point(p: Pt): void;
  /** Échap. Renvoie true si la fonction était déjà à son début (le poste revient alors à la fonction par défaut). */
  abandon(): boolean;
  /** Tracé élastique pour la position du réticule. */
  elastique(reticule: Pt): Primitive[];
  /** Touche lettre propre à la fonction (ex. R, X, Y du placement d'un niveau). Renvoie true si elle est prise. */
  touche?(cle: string): boolean;
  /** La fonction est remplacée par une autre (ex. le niveau de travail d'avant est rétabli). */
  quitter?(): void;
  /** Repérage limité au niveau de travail par défaut (la case (*) ou F3 l'étend à tous les niveaux affichés). */
  readonly reperage?: 'travail';
}

/** Entités des niveaux affichés. */
export const visibles = (ctx: Contexte): readonly Entite[] => ctx.visibles?.() ?? ctx.dessin.toutes;
/** Entités désignables par la fonction en cours (niveau de travail, ou tous les niveaux affichés). */
export const designables = (ctx: Contexte): readonly Entite[] => ctx.designables?.() ?? visibles(ctx);

/** Message quand le point désigné est sur une entité d'un autre niveau que le niveau de travail. */
export function horsNiveau(ctx: Contexte, p: Pt, trouver: (es: readonly Entite[]) => Entite | null): string {
  const e = trouver(visibles(ctx));
  return e && e.niveau !== ctx.attributs().niveau
    ? `Entité du niveau ${e.niveau} : le repérage est limité au niveau de travail (case (*) ou touche F3 pour tous les niveaux).`
    : "Pas d'entité à cet endroit.";
}

const seg = (a: Pt, b: Pt): Primitive => ({ type: 'segment', a, b });
const milieu = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export abstract class Base implements Fonction {
  abstract readonly nom: string;
  abstract readonly code: string;
  protected pts: Pt[] = [];

  constructor(protected ctx: Contexte) {}

  abstract invite(): string;
  question(): Question | null {
    return null;
  }
  valeur(_v: number | string): void {}
  dernierPoint(): Pt | null {
    return null;
  }
  abstract point(p: Pt): void;
  abandon(): boolean {
    const auDebut = this.pts.length === 0;
    this.pts = [];
    return auDebut;
  }
  elastique(_r: Pt): Primitive[] {
    return [];
  }
  protected ajouter(e: Entite | null): void {
    if (e) this.ctx.dessin.ajouter(e);
  }
  protected get at() {
    return this.ctx.attributs();
  }
  protected memoire(cle: string, defaut: number): number {
    return this.ctx.memoire.get(cle) ?? defaut;
  }
}

// ---------------------------------------------------------------- Ligne 3 : droites, cercles, arcs

/** D1 — Tracé de segments enchaînés : chaque extrémité devient l'origine du segment suivant (fonction par défaut). */
export class Segments extends Base {
  readonly nom = 'Tracé de segments';
  readonly code = 'D1';
  invite() {
    return 'Segment de droite. Désigner un point.'; // 0311
  }
  dernierPoint() {
    return this.pts[0] ?? null;
  }
  point(p: Pt) {
    const o = this.pts[0];
    if (o && dist(o, p) > 1e-9) this.ajouter(segment(o, p, this.at.niveau, this.at.trait));
    this.pts = [{ ...p }];
  }
  elastique(r: Pt) {
    return this.pts[0] ? [seg(this.pts[0], r)] : [];
  }
}

/** D2 — Demi-droite : origine, puis un point de la direction. */
export class DemiDroite extends Base {
  readonly nom = 'Tracé de demi-droite';
  readonly code = 'D2';
  invite() {
    return this.pts.length === 0 ? "Demi-droite. Désigner l'origine." : 'Demi-droite. Désigner la direction de la demi-droite.';
  }
  dernierPoint() {
    return this.pts[0] ?? null;
  }
  point(p: Pt) {
    if (this.pts.length === 0) this.pts = [p];
    else if (dist(this.pts[0], p) > 1e-9) {
      this.ajouter(demiDroite(this.pts[0], p, this.at));
      this.pts = [];
    }
  }
  elastique(r: Pt): Primitive[] {
    return this.pts[0] && dist(this.pts[0], r) > 1e-9 ? [{ type: 'demi-droite', a: this.pts[0], b: r }] : [];
  }
}

/** D3 — Droite passant par deux points. */
export class Droite extends Base {
  readonly nom = 'Tracé de droite';
  readonly code = 'D3';
  invite() {
    return this.pts.length === 0 ? 'Droite. Désigner un point.' : 'Droite. Désigner un deuxième point.';
  }
  dernierPoint() {
    return this.pts[0] ?? null;
  }
  point(p: Pt) {
    if (this.pts.length === 0) this.pts = [p];
    else if (dist(this.pts[0], p) > 1e-9) {
      this.ajouter(droite(this.pts[0], p, this.at));
      this.pts = [];
    }
  }
  elastique(r: Pt): Primitive[] {
    return this.pts[0] && dist(this.pts[0], r) > 1e-9 ? [{ type: 'droite', a: this.pts[0], b: r }] : [];
  }
}

/** D4 — Cercle par son centre et son diamètre (tapé au clavier ; le dernier est proposé). */
export class CercleDiametre extends Base {
  readonly nom = 'Cercle (centre, diamètre)';
  readonly code = 'D4';
  invite() {
    return 'Cercle. Désigner le centre.';
  }
  question(): Question | null {
    return this.pts.length === 1 ? { texte: 'Valeur du diamètre', defaut: this.memoire('diametre', 0) } : null;
  }
  valeur(v: number) {
    if (v <= 0) return; // la question est reposée
    this.ctx.memoire.set('diametre', v);
    this.ajouter(cercle(this.pts[0], v / 2, this.at));
    this.pts = [];
  }
  point(p: Pt) {
    this.pts = [p];
  }
}

/** D5 — Cercle par son centre et un point (calé à 15° par rapport au centre). */
export class CerclePoint extends Base {
  readonly nom = 'Cercle (centre, point)';
  readonly code = 'D5';
  invite() {
    return this.pts.length === 0 ? 'Cercle. Désigner le centre.' : 'Cercle. Désigner un point du cercle.';
  }
  dernierPoint() {
    return this.pts[0] ?? null;
  }
  point(p: Pt) {
    if (this.pts.length === 0) this.pts = [p];
    else if (dist(this.pts[0], p) > 1e-9) {
      this.ajouter(cercle(this.pts[0], dist(this.pts[0], p), this.at));
      this.pts = [];
    }
  }
  elastique(r: Pt): Primitive[] {
    return this.pts[0] ? [{ type: 'cercle', c: this.pts[0], r: dist(this.pts[0], r) }] : [];
  }
}

/** D7 — Arc par son origine, son centre et son angle (sens trigonométrique ; 90° par défaut). */
export class ArcOrigineCentreAngle extends Base {
  readonly nom = 'Arc (rayon origine, centre, angle)';
  readonly code = 'D7';
  invite() {
    return this.pts.length === 0 ? "Arc de cercle. Désigner l'origine de l'arc." : 'Arc de cercle. Désigner le centre.';
  }
  question(): Question | null {
    return this.pts.length === 2 ? { texte: "Angle de l'arc", defaut: this.memoire('angleArc', 90) } : null;
  }
  valeur(v: number) {
    if (Math.abs(v) < 1e-9) return;
    this.ctx.memoire.set('angleArc', v);
    const [o, c] = this.pts;
    const a0 = angleDe(c, o);
    const [debut, fin] = v > 0 ? [a0, a0 + v] : [a0 + v, a0];
    this.ajouter(Math.abs(v) >= 360 ? cercle(c, dist(c, o), this.at) : arc(c, dist(c, o), debut, fin, this.at));
    this.pts = [];
  }
  dernierPoint() {
    return this.pts.length === 1 ? this.pts[0] : null;
  }
  point(p: Pt) {
    if (this.pts.length === 0) this.pts = [p];
    else if (this.pts.length === 1 && dist(this.pts[0], p) > 1e-9) this.pts.push(p);
  }
  elastique(r: Pt): Primitive[] {
    if (this.pts.length !== 1) return [];
    const o = this.pts[0];
    const rayon = dist(o, r);
    if (rayon < 1e-9) return [];
    const a0 = angleDe(r, o);
    const v = this.memoire('angleArc', 90);
    return [seg(o, r), { type: 'arc', c: r, r: rayon, debut: v > 0 ? a0 : a0 + v, fin: v > 0 ? a0 + v : a0 }];
  }
}

/** D8 — Arc par son centre, son origine et la direction de son extrémité (sens trigonométrique). */
export class ArcCentreDeuxPoints extends Base {
  readonly nom = 'Arc (centre, rayon origine, direction extrémité)';
  readonly code = 'D8';
  invite() {
    return ['Arc de cercle. Désigner le centre.', "Arc de cercle. Désigner l'origine de l'arc.", "Arc de cercle. Désigner l'extrémité."][
      this.pts.length
    ];
  }
  dernierPoint() {
    return this.pts[0] ?? null; // le 2e et le 3e point sont calés par rapport au centre
  }
  point(p: Pt) {
    const [c, o] = this.pts;
    if (this.pts.length === 0) this.pts = [p];
    else if (this.pts.length === 1 && dist(c, p) > 1e-9) this.pts.push(p);
    else if (this.pts.length === 2 && dist(c, p) > 1e-9) {
      this.ajouter(arc(c, dist(c, o), angleDe(c, o), angleDe(c, p), this.at));
      this.pts = [];
    }
  }
  elastique(r: Pt): Primitive[] {
    const [c, o] = this.pts;
    if (this.pts.length === 1) return [seg(c, r)];
    if (this.pts.length === 2 && dist(c, r) > 1e-9) {
      return [seg(c, r), { type: 'arc', c, r: dist(c, o), debut: angleDe(c, o), fin: angleDe(c, r) }];
    }
    return [];
  }
}

/** D9 — Arc par trois points, parcouru dans l'ordre des points. Deux points confondus : cercle de diamètre. */
export class ArcTroisPoints extends Base {
  readonly nom = 'Arc (par trois points)';
  readonly code = 'D9';
  invite() {
    return ['Arc de cercle. Désigner trois points.', 'Arc de cercle. Désigner le deuxième point.', 'Arc de cercle. Désigner le troisième point.'][
      this.pts.length
    ];
  }
  point(p: Pt) {
    if (this.pts.length < 2) {
      this.pts.push(p);
      return;
    }
    this.ajouter(this.forme(p));
    this.pts = [];
  }
  private forme(p3: Pt): Entite | null {
    const [p1, p2] = this.pts;
    const confondus = (a: Pt, b: Pt) => dist(a, b) < 1e-9;
    // Deux points confondus : cercle dont le diamètre joint les deux points distincts.
    const diam = confondus(p1, p2) || confondus(p2, p3) ? [p1, p3] : confondus(p1, p3) ? [p1, p2] : null;
    if (diam) return dist(diam[0], diam[1]) > 1e-9 ? cercle(milieu(diam[0], diam[1]), dist(diam[0], diam[1]) / 2, this.at) : null;
    return arc3Points(p1, p2, p3, this.at);
  }
  elastique(r: Pt): Primitive[] {
    if (this.pts.length === 1) return [seg(this.pts[0], r)];
    if (this.pts.length === 2) {
      const a = arcTroisPoints(this.pts[0], this.pts[1], r);
      return a ? [{ type: 'arc', ...a }] : [seg(this.pts[0], this.pts[1]), seg(this.pts[1], r)];
    }
    return [];
  }
}

// ---------------------------------------------------------------- Ligne 2 : rectangles, polygone

/** C10 — Rectangle défini par une diagonale (côtés horizontaux et verticaux). */
export class Rectangle extends Base {
  readonly nom = 'Rectangle';
  readonly code = 'C10';
  invite() {
    return this.pts.length === 0 ? 'Rectangle. Définir le rectangle par deux points.' : 'Rectangle. Désigner le deuxième point.';
  }
  point(p: Pt) {
    if (this.pts.length === 0) this.pts = [p];
    else if (Math.abs(p.x - this.pts[0].x) > 1e-9 && Math.abs(p.y - this.pts[0].y) > 1e-9) {
      this.ajouter(rectangle(this.pts[0], p, this.at));
      this.pts = [];
    }
  }
  elastique(r: Pt) {
    return this.pts[0] ? rectangle(this.pts[0], r, this.at).primitives : [];
  }
}

/** C11 — Rectangle à angles arrondis : le rayon d'abord, puis la diagonale. */
export class RectangleArrondi extends Base {
  readonly nom = 'Rectangle à angles arrondis';
  readonly code = 'C11';
  private rayon: number | null = null;
  private tropGrand = false;
  invite() {
    return this.pts.length === 0
      ? 'Rectangle à angles arrondis. Définir le rectangle par deux points.'
      : 'Rectangle à angles arrondis. Désigner le deuxième point.';
  }
  question(): Question | null {
    if (this.rayon === null) return { texte: 'Valeur du rayon', defaut: this.memoire('rayonRectangle', 0) };
    if (this.tropGrand) return { texte: 'Rayon trop grand. Valeur du rayon', defaut: rayonMaxArrondi(this.pts[0], this.pts[1]) };
    return null;
  }
  valeur(v: number) {
    if (v < 0) return;
    this.ctx.memoire.set('rayonRectangle', v);
    this.rayon = v;
    if (this.tropGrand) {
      this.tropGrand = false;
      this.creer();
    }
  }
  point(p: Pt) {
    if (this.pts.length === 0) {
      this.pts = [p];
      return;
    }
    if (Math.abs(p.x - this.pts[0].x) < 1e-9 || Math.abs(p.y - this.pts[0].y) < 1e-9) return;
    this.pts.push(p);
    if ((this.rayon ?? 0) > rayonMaxArrondi(this.pts[0], p) + 1e-9) this.tropGrand = true;
    else this.creer();
  }
  private creer() {
    this.ajouter(rectangleArrondi(this.pts[0], this.pts[1], this.rayon ?? 0, this.at));
    this.pts = [];
  }
  abandon(): boolean {
    const auDebut = this.rayon === null;
    this.pts = [];
    this.rayon = null; // la fonction reprend à son départ : la question du rayon
    this.tropGrand = false;
    return auDebut;
  }
  elastique(r: Pt) {
    if (this.pts.length !== 1 || this.rayon === null) return [];
    const rr = Math.min(this.rayon, rayonMaxArrondi(this.pts[0], r));
    return rectangleArrondi(this.pts[0], r, rr, this.at).primitives;
  }
}

/** C12 — Rectangle incliné : une médiane par deux points, puis un point sur un côté parallèle. */
export class RectangleIncline extends Base {
  readonly nom = 'Rectangle incliné';
  readonly code = 'C12';
  invite() {
    return [
      'Rectangle. Définir une médiane par deux points.',
      'Rectangle. Désigner le deuxième point.',
      'Rectangle. Définir la largeur du rectangle par un point.',
    ][this.pts.length];
  }
  dernierPoint() {
    // Le 2e point est calé par rapport au 1er, le 3e par rapport au milieu de la médiane.
    if (this.pts.length === 1) return this.pts[0];
    if (this.pts.length === 2) return milieu(this.pts[0], this.pts[1]);
    return null;
  }
  point(p: Pt) {
    if (this.pts.length === 0) this.pts = [p];
    else if (this.pts.length === 1 && dist(this.pts[0], p) > 1e-9) this.pts.push(p);
    else if (this.pts.length === 2) {
      const e = rectangleIncline(this.pts[0], this.pts[1], p, this.at);
      if (e) {
        this.ajouter(e);
        this.pts = [];
      }
    }
  }
  elastique(r: Pt): Primitive[] {
    if (this.pts.length === 1) return [seg(this.pts[0], r)];
    if (this.pts.length === 2) return rectangleIncline(this.pts[0], this.pts[1], r, this.at)?.primitives ?? [seg(this.pts[0], this.pts[1])];
    return [];
  }
}

/** C13 — Rectangle à bouts ronds (rainure de clavette) : la largeur d'abord, puis les points extrêmes. */
export class Oblong extends Base {
  readonly nom = 'Rectangle à bouts ronds';
  readonly code = 'C13';
  private largeur: number | null = null;
  private tropGrande = false;
  invite() {
    return this.pts.length === 0 ? 'Rectangle à bouts ronds. Désigner les points extrêmes.' : 'Rectangle à bouts ronds. Désigner le deuxième point.';
  }
  question(): Question | null {
    if (this.largeur === null) return { texte: 'Largeur', defaut: this.memoire('largeurOblong', 0) };
    if (this.tropGrande) return { texte: 'Largeur trop grande pour la longueur. Largeur', defaut: dist(this.pts[0], this.pts[1]) };
    return null;
  }
  valeur(v: number) {
    if (v <= 0) return;
    this.ctx.memoire.set('largeurOblong', v);
    this.largeur = v;
    if (this.tropGrande && v <= dist(this.pts[0], this.pts[1]) + 1e-9) {
      this.tropGrande = false;
      this.creer();
    }
  }
  dernierPoint() {
    return this.pts[0] ?? null;
  }
  point(p: Pt) {
    if (this.pts.length === 0) {
      this.pts = [p];
      return;
    }
    if (dist(this.pts[0], p) < 1e-9) return;
    this.pts.push(p);
    if ((this.largeur ?? 0) > dist(this.pts[0], p) + 1e-9) this.tropGrande = true;
    else this.creer();
  }
  private creer() {
    this.ajouter(oblong(this.pts[0], this.pts[1], this.largeur ?? 0, this.at));
    this.pts = [];
  }
  abandon(): boolean {
    const auDebut = this.largeur === null;
    this.pts = [];
    this.largeur = null;
    this.tropGrande = false;
    return auDebut;
  }
  elastique(r: Pt): Primitive[] {
    if (this.pts.length !== 1 || this.largeur === null) return [];
    const l = dist(this.pts[0], r);
    return oblong(this.pts[0], r, Math.min(this.largeur, l), this.at)?.primitives ?? [seg(this.pts[0], r)];
  }
}

/** C14 — Polygone régulier : le nombre de sommets, puis le centre et le milieu d'un côté. */
export class Polygone extends Base {
  readonly nom = 'Polygone régulier';
  readonly code = 'C14';
  private sommets: number | null = null;
  invite() {
    return this.pts.length === 0 ? 'Polygone régulier. Désigner le centre.' : "Polygone régulier. Désigner le milieu d'un côté.";
  }
  question(): Question | null {
    return this.sommets === null ? { texte: 'Polygone régulier. Nombre de sommets', defaut: this.memoire('sommets', 6), entier: true } : null;
  }
  valeur(v: number) {
    const n = Math.min(40, Math.round(v)); // au-delà de 40, la valeur prise est 40
    if (n < 3) return;
    this.ctx.memoire.set('sommets', n);
    this.sommets = n;
  }
  dernierPoint() {
    return this.pts[0] ?? null;
  }
  point(p: Pt) {
    if (this.pts.length === 0) this.pts = [p];
    else if (dist(this.pts[0], p) > 1e-9) {
      this.ajouter(polygone(this.pts[0], p, this.sommets ?? 6, this.at));
      this.pts = [];
    }
  }
  abandon(): boolean {
    const auDebut = this.sommets === null;
    this.pts = [];
    this.sommets = null;
    return auDebut;
  }
  elastique(r: Pt): Primitive[] {
    return this.pts[0] ? (polygone(this.pts[0], r, this.sommets ?? 6, this.at)?.primitives ?? []) : [];
  }
}

// ---------------------------------------------------------------- Catalogue

// Les fonctions des autres lignes sont ajoutées par leurs modules (enregistrerFonctions), pour éviter
// des dépendances circulaires.
const CATALOGUE: Record<string, new (ctx: Contexte) => Fonction> = {
  D1: Segments,
  D2: DemiDroite,
  D3: Droite,
  D4: CercleDiametre,
  D5: CerclePoint,
  D7: ArcOrigineCentreAngle,
  D8: ArcCentreDeuxPoints,
  D9: ArcTroisPoints,
  C10: Rectangle,
  C11: RectangleArrondi,
  C12: RectangleIncline,
  C13: Oblong,
  C14: Polygone,
};

export function enregistrerFonctions(f: Record<string, new (ctx: Contexte) => Fonction>): void {
  Object.assign(CATALOGUE, f);
}

/** La case a-t-elle une fonction (palette, recherche) ? */
export function existeFonction(code: string): boolean {
  return code in CATALOGUE;
}

/** Crée la fonction d'une case de la palette, ou null si elle n'existe pas encore. */
export function creerFonction(code: string, ctx: Contexte): Fonction | null {
  const F = CATALOGUE[code];
  return F ? new F(ctx) : null;
}

