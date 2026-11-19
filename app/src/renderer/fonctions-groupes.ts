// Groupes : éclatement (E8), création par fenêtre (E9), désignation (E10), et le menu Groupe
// (Placer, Enregistrer sous). Textes repris de l'aide d'origine (« Groupe par fenêtre », « Éclatement »,
// « Modification de nomenclature », « Placer », « Groupe - Enregistrer sous »).
import type { Entite, Trait } from './dessin';
import { dansFenetre, eclater, entiteProche, transformerEntite, translation, rotation } from './edition';
import { designables, enregistrerFonctions, horsNiveau, visibles, type Contexte, type Fonction, type Question } from './fonctions';
import { dist, type Pt } from './geometrie';
import {
  creerGroupe,
  estVide,
  groupeEn,
  groupeVide,
  LONGUEUR_DESIGNATION,
  LONGUEUR_REFERENCE,
  membresDe,
  modeleAEnregistrer,
  nomenclatureDe,
  placerGroupe,
  pointReference,
  semblables,
  type Nomenclature,
} from './groupes';
import { angleDe, type Primitive } from './primitives';

const oui = (v: number | string | undefined, defaut = 'N') => String(v ?? defaut).trim().toUpperCase().startsWith('O');
const rectangle = (a: Pt, b: Pt): Primitive[] => {
  const p = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
  return p.map((q, i) => ({ type: 'segment' as const, a: q, b: p[(i + 1) % 4] }));
};
/** Aperçu léger d'une entité (les très gros groupes ne sont montrés qu'en partie pendant le déplacement). */
const apercu = (e: Entite): Primitive[] => e.primitives.slice(0, 600);

/** Un groupe désigné : par son point de référence, sinon par l'un de ses traits. */
function designerGroupe(ctx: Contexte, p: Pt, videsAussi: boolean): Entite | null {
  const toutes = designables(ctx).filter((e) => e.genre === 'groupe' && (videsAussi || !estVide(e)));
  return groupeEn(toutes, p, ctx.rayon()) ?? entiteProche(toutes, p, ctx.rayon());
}

// ======================================================================= E8 — Éclatement

/** E8 — Éclatement : une entité composée devient des entités simples ; un groupe rend ses membres d'origine. */
export class Eclatement implements Fonction {
  readonly nom = 'Éclatement';
  readonly code = 'E8';
  readonly reperage = 'travail' as const;
  private groupe: Entite | null = null;
  constructor(private ctx: Contexte) {}
  invite() {
    return "Eclatement. Désigner l'élément.";
  }
  attente(): 'entite' {
    return 'entite';
  }
  question(): Question | null {
    return this.groupe ? { texte: 'Conservation de la désignation du groupe [O/N]', defaut: 'N', type: 'texte' } : null;
  }
  valeur(v: number | string) {
    const g = this.groupe;
    this.groupe = null;
    if (!g) return;
    const nom = nomenclatureDe(g);
    const ref = pointReference(g);
    const garder = oui(v) && nom && ref ? [groupeVide(ref, g.niveau, nom)] : [];
    this.ctx.dessin.remplacerEntite(g, [...(membresDe(g) ?? eclater(g)), ...garder]);
  }
  dernierPoint() {
    return null;
  }
  point(p: Pt) {
    const e = designerGroupe(this.ctx, p, false) ?? entiteProche(designables(this.ctx), p, this.ctx.rayon());
    if (!e) return this.ctx.dire(horsNiveau(this.ctx, p, (es) => entiteProche(es, p, this.ctx.rayon())));
    if (e.genre === 'groupe' && !estVide(e)) {
      const nom = nomenclatureDe(e);
      if (nom && (nom.designation || nom.reference)) {
        this.groupe = e; // la question de la désignation suit
        return;
      }
      this.ctx.dessin.remplacerEntite(e, membresDe(e) ?? eclater(e));
      return;
    }
    if (e.primitives.length < 2) return this.ctx.dire("Cette entité n'est pas composée.");
    this.ctx.dessin.remplacerEntite(e, eclater(e));
  }
  abandon() {
    const auDebut = !this.groupe;
    this.groupe = null;
    return auDebut;
  }
  elastique() {
    return [];
  }
}

// ======================================================================= E9 — Création de groupe par fenêtre

export class GroupeFenetre implements Fonction {
  readonly nom = 'Création de groupe par fenêtre';
  readonly code = 'E9';
  private coin: Pt | null = null;
  private fenetre: Entite[] | null = null;
  private membres: Entite[] | null = null;
  private ref: Pt | null = null;
  private vide: Entite | null = null;
  constructor(private ctx: Contexte) {}

  invite() {
    if (!this.fenetre) return this.coin ? 'Création de groupe. Désigner le deuxième point de la diagonale.' : 'Création de groupe. Définir la fenêtre par 2 points (déf, tout).';
    return 'Création de groupe. Désigner le point origine.';
  }
  attente(): 'point' {
    return 'point';
  }
  traitElastique(): Trait | null {
    return this.coin ? 'mixte-fin' : null;
  }
  elastique(r: Pt): Primitive[] {
    return this.coin ? rectangle(this.coin, r) : [];
  }
  parDefaut() {
    if (!this.fenetre && !this.coin) this.choisir([...visibles(this.ctx)]);
  }
  question(): Question | null {
    if (this.fenetre && !this.membres) return { texte: 'Niveau contenant le groupe [?]', defaut: 'tt', type: 'texte' };
    if (this.vide) return { texte: `Désignation : "${nomenclatureDe(this.vide)?.designation ?? ''}" [O/N]`, defaut: 'O', type: 'texte' };
    return null;
  }
  valeur(v: number | string) {
    if (this.fenetre && !this.membres) {
      const t = String(v).trim().toLowerCase();
      const n = t === '' || t === 'tt' ? this.ctx.attributs().niveau : Math.round(Number(t.replace(',', '.')));
      if (!(n >= 1 && n <= 99)) return this.ctx.dire('Niveau incorrect (1 à 99).');
      const surNiveau = this.fenetre.filter((e) => e.niveau === n);
      const membres = surNiveau.filter((e) => e.genre !== 'groupe');
      if (membres.length === 0) {
        this.ctx.dire(surNiveau.length ? "Un groupe ne peut pas contenir d'autre groupe." : 'Aucune entité de ce niveau dans la fenêtre.');
        this.recommencer();
        return;
      }
      if (membres.length < surNiveau.length) this.ctx.dire(`${surNiveau.length - membres.length} groupe(s) laissé(s) hors du nouveau groupe.`);
      this.membres = membres;
      return;
    }
    if (this.vide) {
      const vide = this.vide;
      this.creer(oui(v, 'O') ? nomenclatureDe(vide) : null, vide);
    }
  }
  dernierPoint() {
    return null;
  }
  point(p: Pt) {
    if (!this.fenetre) {
      if (!this.coin) {
        this.coin = p;
        return;
      }
      const a = this.coin;
      this.coin = null;
      this.choisir(dansFenetre(visibles(this.ctx), a, p));
      return;
    }
    if (!this.membres) return;
    this.ref = p;
    // Point origine sur un symbole N : la désignation d'un groupe éclaté peut être reprise.
    this.vide = groupeEn(visibles(this.ctx).filter(estVide), p, this.ctx.rayon());
    if (!this.vide) this.creer(null, null);
  }
  private choisir(entites: Entite[]) {
    const pleines = entites.filter((e) => !estVide(e));
    if (pleines.length === 0) return this.ctx.dire('Aucune entité dans la fenêtre.');
    this.fenetre = pleines;
  }
  private creer(nom: Nomenclature | null, vide: Entite | null) {
    const membres = this.membres ?? [];
    const g = creerGroupe(membres, this.ref ?? { x: 0, y: 0 }, this.ctx.attributs().niveau, nom);
    this.ctx.dessin.remplacerEnsemble(vide ? [...membres, vide] : membres, [g]);
    this.ctx.dire(`Groupe créé : ${membres.length} entité${membres.length > 1 ? 's' : ''}.`);
    this.recommencer();
  }
  private recommencer() {
    this.coin = null;
    this.fenetre = null;
    this.membres = null;
    this.ref = null;
    this.vide = null;
  }
  abandon() {
    const auDebut = !this.coin && !this.fenetre;
    this.recommencer();
    return auDebut;
  }
}

// ======================================================================= E10 — Désignation d'un groupe

export class DesignationGroupe implements Fonction {
  readonly nom = "Modification de la désignation d'un groupe";
  readonly code = 'E10';
  readonly reperage = 'travail' as const;
  private groupe: Entite | null = null;
  private reponses: string[] = [];
  constructor(private ctx: Contexte) {}
  invite() {
    return 'Modification de la nomenclature. Désigner un groupe.';
  }
  attente(): 'entite' {
    return 'entite';
  }
  question(): Question | null {
    if (!this.groupe) return null;
    const nom = nomenclatureDe(this.groupe);
    if (this.reponses.length === 0) return { texte: `Désignation du groupe [${LONGUEUR_DESIGNATION}c]`, defaut: nom?.designation ?? '', type: 'texte' };
    return { texte: `Référence [${LONGUEUR_REFERENCE}c]`, defaut: nom?.reference ?? '', type: 'texte' };
  }
  valeur(v: number | string) {
    this.reponses.push(String(v));
    if (this.reponses.length < 2 || !this.groupe) return;
    const g = this.groupe;
    const [designation, reference] = this.reponses;
    this.groupe = null;
    this.reponses = [];
    const params = { ...(g.params ?? {}), designation: designation.trim().slice(0, LONGUEUR_DESIGNATION), reference: reference.trim().slice(0, LONGUEUR_REFERENCE) };
    this.ctx.dessin.remplacerPlusieurs([[g, { ...g, params }]]);
    this.ctx.dire('Nomenclature du groupe modifiée.');
  }
  dernierPoint() {
    return null;
  }
  point(p: Pt) {
    const g = designerGroupe(this.ctx, p, true);
    if (!g) return this.ctx.dire('Désigner un groupe (son point de référence [] ou un de ses traits).');
    this.groupe = g;
    this.reponses = [];
  }
  abandon() {
    const auDebut = !this.groupe;
    this.groupe = null;
    this.reponses = [];
    return auDebut;
  }
  elastique() {
    return [];
  }
}

// ======================================================================= Menu Groupe > Enregistrer sous

export class EnregistrementGroupe implements Fonction {
  readonly nom = 'Enregistrer un groupe';
  readonly code = 'groupe.enregistrer-sous';
  private groupe: Entite | null = null;
  private reponses: string[] = [];
  constructor(private ctx: Contexte) {}
  invite() {
    return 'Sauvegarde de groupe. Désigner le groupe (son point de référence).';
  }
  attente(): 'entite' {
    return 'entite';
  }
  question(): Question | null {
    if (!this.groupe) return null;
    const nom = nomenclatureDe(this.groupe);
    if (this.reponses.length === 0) return { texte: `Désignation [${LONGUEUR_DESIGNATION}c]`, defaut: nom?.designation ?? '', type: 'texte' };
    return { texte: `Référence [${LONGUEUR_REFERENCE}c]`, defaut: nom?.reference ?? '', type: 'texte' };
  }
  valeur(v: number | string) {
    const t = String(v).trim();
    if (this.reponses.length === 0 && !t) return this.ctx.dire('La désignation est obligatoire.');
    this.reponses.push(t);
    if (this.reponses.length < 2 || !this.groupe) return;
    const g = this.groupe;
    const nom = { designation: this.reponses[0], reference: this.reponses[1] };
    this.groupe = null;
    this.reponses = [];
    const enregistrer = this.ctx.actions?.enregistrerGroupe;
    if (!enregistrer) return;
    void enregistrer(modeleAEnregistrer(g, nom), nom.designation).then((fichier) => {
      if (!fichier) return this.ctx.dire('Enregistrement du groupe abandonné.');
      // Le groupe du dessin prend la désignation et le nom du fichier (pour les mises à jour par Placer).
      const actuel = this.ctx.dessin.toutes.includes(g) ? g : null;
      if (actuel) this.ctx.dessin.remplacerPlusieurs([[actuel, { ...actuel, params: { ...(actuel.params ?? {}), ...nom, fichier } }]]);
      this.ctx.dire(`Groupe enregistré : ${fichier}`);
      this.ctx.actions?.redessiner?.();
    });
  }
  dernierPoint() {
    return null;
  }
  point(p: Pt) {
    const g = designerGroupe(this.ctx, p, false);
    if (!g) return this.ctx.dire('Désigner un groupe (son point de référence [] ou un de ses traits).');
    this.groupe = g;
    this.reponses = [];
  }
  abandon() {
    const auDebut = !this.groupe;
    this.groupe = null;
    this.reponses = [];
    return auDebut;
  }
  elastique() {
    return [];
  }
}

// ======================================================================= Menu Groupe > Placer

/**
 * Placement d'un groupe lu dans un fichier : point de référence, orientation par un point (près de l'origine :
 * orientation d'origine), facteur d'homothétie. Désigner le point de référence [] d'un groupe déjà placé
 * permet de le prendre comme origine, ou de remplacer tous les groupes semblables (mise à jour).
 */
export class PlacementGroupe implements Fonction {
  readonly nom = 'Placer un groupe';
  readonly code = 'groupe.placer';
  private origine: Pt | null = null;
  private angle: number | null = null;
  private cible: Entite | null = null;
  constructor(
    private ctx: Contexte,
    private modele: Entite,
    private fichier: string,
  ) {}
  private get titre() {
    return nomenclatureDe(this.modele)?.designation || this.fichier;
  }
  invite() {
    if (!this.origine) return `Groupe : ${this.titre}. Désigner le point de référence.`;
    return "Placer un groupe. Définir l'orientation par un point.";
  }
  attente(): 'point' {
    return 'point';
  }
  question(): Question | null {
    if (this.cible) return { texte: 'Remplacer tous les groupes semblables [O/N]', defaut: 'N', type: 'texte' };
    if (this.origine && this.angle !== null) return { texte: "Facteur d'homothétie", defaut: this.ctx.memoire.get('echelleGroupe') ?? 1 };
    return null;
  }
  valeur(v: number | string) {
    if (this.cible) {
      const cible = this.cible;
      this.cible = null;
      if (oui(v)) return this.remplacerSemblables(cible);
      this.origine = pointReference(cible); // le nouveau groupe se place sur l'ancien
      return;
    }
    if (!this.origine || this.angle === null) return;
    const k = typeof v === 'number' ? v : Number(String(v).replace(',', '.')) || 1;
    if (!(k > 0)) return this.ctx.dire('Le facteur doit être positif.');
    this.ctx.memoire.set('echelleGroupe', k);
    this.ctx.dessin.ajouter(placerGroupe(this.modele, this.origine, this.angle, k, this.fichier, this.ctx.attributs().niveau));
    this.origine = null;
    this.angle = null;
  }
  private remplacerSemblables(cible: Entite) {
    const liste = semblables(this.ctx.dessin.toutes, cible);
    const paires = liste.flatMap((g): [Entite, Entite][] => {
      const r = pointReference(g);
      if (!r) return [];
      const angle = Number(g.params?.angle ?? 0) || 0;
      const k = Number(g.params?.echelle ?? 1) || 1;
      return [[g, placerGroupe(this.modele, r, angle, k, this.fichier, g.niveau)]];
    });
    this.ctx.dessin.remplacerPlusieurs(paires);
    this.ctx.dire(`${paires.length} groupe(s) mis à jour.`);
  }
  dernierPoint() {
    return this.origine;
  }
  point(p: Pt) {
    if (!this.origine) {
      const existant = groupeEn(
        this.ctx.dessin.toutes.filter((e) => e.genre === 'groupe' && !estVide(e)),
        p,
        this.ctx.rayon(),
      );
      if (existant) this.cible = existant;
      else this.origine = p;
      return;
    }
    // Point confondu avec l'origine (moins de quelques pixels) : orientation de la création du groupe.
    this.angle = dist(p, this.origine) < this.ctx.rayon() ? 0 : angleDe(this.origine, p);
  }
  elastique(r: Pt): Primitive[] {
    const ref = pointReference(this.modele) ?? { x: 0, y: 0 };
    if (!this.origine) return apercu(transformerEntite(this.modele, translation(r.x - ref.x, r.y - ref.y)));
    if (this.angle !== null) return [];
    const a = dist(r, this.origine) < this.ctx.rayon() ? 0 : angleDe(this.origine, r);
    const place = transformerEntite(transformerEntite(this.modele, translation(this.origine.x - ref.x, this.origine.y - ref.y)), rotation(this.origine, a));
    return [{ type: 'segment', a: this.origine, b: r }, ...apercu(place)];
  }
  abandon() {
    const auDebut = !this.origine && !this.cible;
    this.origine = null;
    this.angle = null;
    this.cible = null;
    return auDebut;
  }
}

enregistrerFonctions({
  E8: Eclatement,
  E9: GroupeFenetre,
  E10: DesignationGroupe,
});
