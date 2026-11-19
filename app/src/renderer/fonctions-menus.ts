// Fonctions lancées par les menus : Édition > Copier / Coller, Fichier > Enregistrer une sélection,
// Fichier > Fusionner (point d'implantation), Fichier > Pièces jointes. Messages repris de l'aide d'origine
// (« Copier - Coller », « Enregistrer une sélection », « Fusionner », « Pièces jointes »).
import type { Entite } from './dessin';
import { entiteProche, rotation, symetrie, transformerEntite, translation } from './edition';
import { designables, type Contexte, type Fonction, type Question } from './fonctions';
import { AvecSelection } from './fonctions-modif';
import type { Pt } from './geometrie';
import type { ImageStockee } from './images';
import { designationMacro, executerMacro, type Macro } from './gmac';
import { creerGroupe } from './groupes';
import type { Primitive } from './primitives';

const PAS_ROTATION = 15;

/** Presse-papiers du logiciel : des entités autour d'une origine (0, 0), et les images qu'elles utilisent. */
export interface PressePapiers {
  entites: Entite[];
  images: Record<string, ImageStockee>;
}

const CLE = 'blueprint-presse-papiers';

/** Gardé d'une session à l'autre (comme l'original, dans les fichiers temporaires). */
export function lirePressePapiers(): PressePapiers | null {
  try {
    const t = localStorage.getItem(CLE);
    return t ? (JSON.parse(t) as PressePapiers) : null;
  } catch {
    return null;
  }
}
function ecrirePressePapiers(p: PressePapiers): boolean {
  try {
    localStorage.setItem(CLE, JSON.stringify(p));
    return true;
  } catch {
    // Trop gros (images) : sans les images.
    try {
      localStorage.setItem(CLE, JSON.stringify({ ...p, images: {} }));
      return true;
    } catch {
      return false;
    }
  }
}

/** Images utilisées par des entités (et leurs groupes). */
function imagesDe(entites: readonly Entite[], ctx: Contexte): Record<string, ImageStockee> {
  const out: Record<string, ImageStockee> = {};
  const voir = (p?: Record<string, unknown>) => {
    if (!p) return;
    if (typeof p.image === 'string' && ctx.dessin.images.has(p.image)) out[p.image] = ctx.dessin.images.get(p.image)!;
    if (Array.isArray(p.membres)) for (const m of p.membres as { t?: Record<string, unknown> }[]) voir(m.t);
  };
  for (const e of entites) voir(e.params);
  return out;
}

/** Édition > Copier : une entité ou une fenêtre (déf, tout), l'origine de la copie, les niveaux. */
export class CopieSelection extends AvecSelection {
  readonly nom = 'Copier une sélection';
  readonly code = 'edition.copier';
  protected readonly titre = 'COPIER une sélection.';
  protected etapes() {
    return ["Désigner par un point l'origine de la copie."];
  }
  protected questions(): Question[] {
    return this.questionNiveaux('Niveaux à COPIER', '*');
  }
  protected appliquer() {
    const entites = this.retenues(this.selection?.parFenetre ? this.reponses[0] : undefined);
    if (entites.length === 0) return this.ctx.dire('Aucune entité sur ces niveaux.');
    const o = this.pts[0];
    const p: PressePapiers = { entites: entites.map((e) => transformerEntite(e, translation(-o.x, -o.y))), images: imagesDe(entites, this.ctx) };
    this.ctx.dire(ecrirePressePapiers(p) ? `Copie enregistrée (${entites.length} entité${entites.length > 1 ? 's' : ''}).` : 'Copie impossible : sélection trop grande.');
  }
}

/** Fichier > Enregistrer une sélection : une fenêtre (déf, tout) et ses niveaux, écrits dans un autre dessin. */
export class EnregistrementSelection extends AvecSelection {
  readonly nom = 'Enregistrer une sélection';
  readonly code = 'fichier.enregistrer-selection';
  protected readonly titre = 'Enregistrer une sélection.';
  constructor(
    ctx: Contexte,
    private enregistrer: (entites: Entite[]) => void,
  ) {
    super(ctx);
  }
  protected etapes() {
    return [];
  }
  protected questions(): Question[] {
    return this.questionNiveaux('Niveaux à SAUVEGARDER', '*');
  }
  protected appliquer() {
    const entites = this.retenues(this.selection?.parFenetre ? this.reponses[0] : undefined);
    if (entites.length === 0) return this.ctx.dire('Aucune entité sur ces niveaux.');
    this.enregistrer(entites);
  }
}

/**
 * Coller (et fusionner) : les entités, posées par leur origine au point d'implantation (Entrée : l'origine
 * du dessin) ; R les tourne de 15°, X et Y les retournent, avant de les poser.
 */
export class Collage implements Fonction {
  readonly nom: string;
  readonly code: string;
  private entites: Entite[];
  constructor(
    private ctx: Contexte,
    p: PressePapiers,
    private titre = 'COLLER.',
    private uneFois = false,
  ) {
    this.nom = titre.replace(/\.$/, '');
    this.code = 'edition.coller';
    this.entites = p.entites;
    for (const [id, img] of Object.entries(p.images ?? {})) if (!ctx.dessin.images.has(id)) ctx.dessin.images.set(id, img);
  }
  private fini = false;
  invite() {
    return this.fini ? '' : `${this.titre} Désigner le point d'implantation [R] [X] [Y] (déf, origine).`;
  }
  question() {
    return null;
  }
  valeur() {}
  attente(): 'point' {
    return 'point';
  }
  dernierPoint() {
    return null;
  }
  touche(cle: string): boolean {
    const o = { x: 0, y: 0 };
    const t = cle === 'R' ? rotation(o, PAS_ROTATION) : cle === 'X' ? symetrie(o, { x: 1, y: 0 }) : cle === 'Y' ? symetrie(o, { x: 0, y: 1 }) : null;
    if (!t) return false;
    this.entites = this.entites.map((e) => transformerEntite(e, t));
    return true;
  }
  parDefaut() {
    this.point({ x: 0, y: 0 });
  }
  point(p: Pt) {
    if (this.fini) return;
    this.ctx.dessin.ajouterPlusieurs(this.entites.map((e) => transformerEntite(e, translation(p.x, p.y))));
    this.ctx.dire(this.uneFois ? `${this.nom} : ${this.entites.length} entités ajoutées.` : 'Sélection collée.');
    if (this.uneFois) this.fini = true;
  }
  elastique(r: Pt): Primitive[] {
    if (this.fini) return [];
    return this.entites.slice(0, 400).flatMap((e) => transformerEntite(e, translation(r.x, r.y)).primitives);
  }
  abandon() {
    return true;
  }
}

// ======================================================================= Pièces jointes

/** Une pièce jointe : un point repère (symbole à l'écran seulement), lié à un fichier quelconque. */
export function entiteJointe(fichier: string, p: Pt, niveau: number): Entite {
  return { genre: 'jointe', primitives: [{ type: 'point', p: { ...p } }], extras: [{ p: { ...p }, type: 'extremite' }], niveau, trait: 'continu-fin', params: { fichier } };
}

/** Fichier > Pièces jointes > Ajouter : le fichier choisi, puis la position de son symbole. */
export class AjoutPieceJointe implements Fonction {
  readonly nom = 'Ajouter une pièce jointe';
  readonly code = 'fichier.joindre';
  private fait = false;
  constructor(
    private ctx: Contexte,
    private fichier: string,
  ) {}
  invite() {
    const nom = this.fichier.split(/[\\/]/).pop();
    return this.fait ? '' : `Pièce jointe « ${nom} ». Désigner la position du symbole.`;
  }
  question() {
    return null;
  }
  valeur() {}
  dernierPoint() {
    return null;
  }
  point(p: Pt) {
    if (this.fait) return;
    this.ctx.dessin.ajouter(entiteJointe(this.fichier, p, this.ctx.attributs().niveau));
    this.ctx.dire('Pièce jointe ajoutée.');
    this.fait = true;
  }
  elastique() {
    return [];
  }
  abandon() {
    return true;
  }
}

/** Fichier > Pièces jointes > Consulter : désigner le symbole ; le fichier s'ouvre dans son logiciel. */
export class ConsultationPieceJointe implements Fonction {
  readonly nom = 'Consulter une pièce jointe';
  readonly code = 'fichier.joint-consulter';
  constructor(
    private ctx: Contexte,
    private ouvrir: (chemin: string) => void,
  ) {}
  invite() {
    return 'Consulter une pièce jointe. Désigner la pièce jointe.';
  }
  attente(): 'entite' {
    return 'entite';
  }
  question() {
    return null;
  }
  valeur() {}
  dernierPoint() {
    return null;
  }
  point(p: Pt) {
    const e = entiteProche(
      designables(this.ctx).filter((x) => x.genre === 'jointe'),
      p,
      this.ctx.rayon() * 3,
    );
    if (!e) return this.ctx.dire("Pas de pièce jointe à cet endroit.");
    this.ouvrir(String(e.params?.fichier ?? ''));
  }
  elastique() {
    return [];
  }
  abandon() {
    return true;
  }
}

// ======================================================================= Gmac > Exécuter

/**
 * Exécution d'une macro : ses paramètres au clavier, puis le point de référence et l'orientation ; le dessin
 * produit est posé comme un groupe (désignation de la macro), et chaque point désigné en pose un autre.
 */
export class PlacementMacro implements Fonction {
  readonly nom: string;
  readonly code = 'gmac.executer';
  private valeurs: number[] = [];
  private origine: Pt | null = null;
  private dessin: Entite[] | null = null;
  constructor(
    private ctx: Contexte,
    private macro: Macro,
    private nomFichier: string,
  ) {
    this.nom = `Macro ${nomFichier}`;
    if (macro.parametres.length === 0) this.executer();
  }
  private get parametres(): Record<string, number> {
    return Object.fromEntries(this.macro.parametres.map((p, i) => [p.nom, this.valeurs[i] ?? p.defaut]));
  }
  question(): Question | null {
    const p = this.macro.parametres[this.valeurs.length];
    return p ? { texte: `${this.nomFichier}. ${p.question}`, defaut: this.ctx.memoire.get(`gmac-${this.nomFichier}-${p.nom}`) ?? p.defaut } : null;
  }
  valeur(v: number | string) {
    const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n)) return this.ctx.dire('Nombre attendu.');
    const p = this.macro.parametres[this.valeurs.length];
    if (p) this.ctx.memoire.set(`gmac-${this.nomFichier}-${p.nom}`, n);
    this.valeurs.push(n);
    if (this.valeurs.length >= this.macro.parametres.length) this.executer();
  }
  /** Le dessin de la macro avec les paramètres donnés (une fois pour toutes les poses). */
  executer(): void {
    try {
      this.dessin = executerMacro(this.macro, this.parametres, this.ctx.reglages);
      if (this.dessin.length === 0) this.ctx.dire(`${this.nomFichier} : la macro ne dessine rien.`);
    } catch (e) {
      this.dessin = [];
      this.ctx.dire(`Erreur d'interprétation de ${this.nomFichier}, ${(e as Error).message}.`);
    }
  }
  invite() {
    if (!this.dessin) return '';
    return this.origine ? `${this.nom}. Définir l'orientation par un point (Entrée : horizontale).` : `${this.nom}. Désigner le point de référence.`;
  }
  attente(): 'point' {
    return 'point';
  }
  dernierPoint() {
    return this.origine;
  }
  parDefaut() {
    if (this.origine) this.poser(0);
  }
  point(p: Pt) {
    if (!this.dessin?.length) return;
    if (!this.origine) {
      this.origine = p;
      return;
    }
    this.poser(Math.hypot(p.x - this.origine.x, p.y - this.origine.y) < this.ctx.rayon() ? 0 : (Math.atan2(p.y - this.origine.y, p.x - this.origine.x) * 180) / Math.PI);
  }
  private place(o: Pt, angle: number): Entite[] {
    return (this.dessin ?? []).map((e) => transformerEntite(transformerEntite(e, rotation({ x: 0, y: 0 }, angle)), translation(o.x, o.y)));
  }
  private poser(angle: number) {
    const o = this.origine!;
    const niveau = this.ctx.attributs().niveau;
    const membres = this.place(o, angle).map((e) => ({ ...e, niveau }));
    const designation = designationMacro(this.macro, this.parametres) || this.nomFichier;
    this.ctx.dessin.ajouter(creerGroupe(membres, o, niveau, { designation, reference: '' }));
    this.ctx.dire(`${designation} placé.`);
    this.origine = null;
  }
  elastique(r: Pt): Primitive[] {
    if (!this.dessin) return [];
    if (!this.origine) return this.place(r, 0).flatMap((e) => e.primitives);
    const a = (Math.atan2(r.y - this.origine.y, r.x - this.origine.x) * 180) / Math.PI;
    return [{ type: 'segment', a: this.origine, b: r }, ...this.place(this.origine, a).flatMap((e) => e.primitives)];
  }
  abandon() {
    if (this.origine) {
      this.origine = null;
      return false;
    }
    return true;
  }
}
