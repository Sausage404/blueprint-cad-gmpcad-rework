// Ligne 5 de la palette (gestion) : nomenclature des niveaux (F3), fenêtres nommées (F9), couleur des
// niveaux (F19), échelle d'un niveau (F20). Questions reprises de l'aide d'origine. Ces fonctions
// s'exécutent sans quitter la fonction en cours (« non exclusives »), comme le zoom.
import type { Entite, FenetreNommee } from './dessin';
import { entiteProche, homothetie, lireNiveaux, transformerEntite, translation } from './edition';
import { enregistrerFonctions, visibles, type Contexte, type Fonction, type Question } from './fonctions';
import { dist, nombre, type Pt } from './geometrie';
import { LONGUEUR_DESIGNATION, LONGUEUR_REFERENCE } from './groupes';
import type { Primitive } from './primitives';

/** Les 7 couleurs de l'original (0 à 6) et leur index ACI. */
export const COULEURS = [
  { nom: 'blanc', aci: 7 },
  { nom: 'vert', aci: 3 },
  { nom: 'rouge', aci: 1 },
  { nom: 'bleu', aci: 5 },
  { nom: 'jaune', aci: 2 },
  { nom: 'magenta', aci: 6 },
  { nom: 'cyan', aci: 4 },
];
const nomCouleur = (aci: number) => COULEURS.find((c) => c.aci === aci)?.nom ?? `couleur ${aci}`;

const rectangle = (a: Pt, b: Pt): Primitive[] => {
  const p = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
  return p.map((q, i) => ({ type: 'segment' as const, a: q, b: p[(i + 1) % 4] }));
};
const num = (v: number | string, defaut: number) => (typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.')) || defaut);

/** Réponse « ? » aux listes de niveaux : les niveaux utilisés, avec échelle, couleur, désignation, référence. */
export function descriptionNiveaux(ctx: Contexte): string {
  const d = ctx.dessin;
  const liste = d.niveauxOccupes.map((n) => {
    const i = d.infos.niveaux[String(n)];
    const morceaux = [nomCouleur(d.couleurNiveau(n)), `éch. ${nombre(d.echelleNiveau(n))}`];
    if (i?.designation) morceaux.push(`« ${i.designation} »`);
    if (i?.reference) morceaux.push(i.reference);
    return `${n} (${morceaux.join(', ')})`;
  });
  return liste.length ? `Niveaux utilisés : ${liste.join(' ; ')}.` : 'Aucun niveau utilisé.';
}

/** Liste de niveaux tapée (« tt », « * », « 1+3 »…), ou null si elle est illisible. « * » : les niveaux occupés. */
function niveauxDe(ctx: Contexte, v: number | string): number[] | null {
  const t = String(v).trim() || 'tt';
  const lus = lireNiveaux(t, ctx.attributs().niveau);
  if (!lus) return null;
  let liste = [...lus].filter((n) => n >= 1 && n <= 99).sort((a, b) => a - b);
  if (t.replace(/\s/g, '').startsWith('*')) {
    const occupes = new Set(ctx.dessin.niveauxOccupes);
    liste = liste.filter((n) => occupes.has(n));
  }
  return liste;
}

/** Base des fonctions de gestion : non exclusives, terminées quand `fini` passe à vrai. */
abstract class Gestion implements Fonction {
  abstract readonly nom: string;
  abstract readonly code: string;
  readonly ponctuelle = true;
  protected fini = false;
  constructor(protected ctx: Contexte) {}
  termine() {
    return this.fini;
  }
  abstract question(): Question | null;
  abstract valeur(v: number | string): void;
  invite(): string {
    return '';
  }
  dernierPoint(): Pt | null {
    return null;
  }
  point(_p: Pt): void {}
  abandon(): boolean {
    return true;
  }
  elastique(_r: Pt): Primitive[] {
    return [];
  }
}

// ======================================================================= F3 — Nomenclature des niveaux

/** F3 — Désignation (40 caractères) et référence (20) de chaque niveau de la liste, pour la nomenclature. */
export class NomenclatureNiveaux extends Gestion {
  readonly nom = 'Nomenclature';
  readonly code = 'F3';
  private liste: number[] | null = null;
  private reponses: string[] = [];
  question(): Question | null {
    if (!this.liste) return { texte: 'Nomenclature. Niveau(x) à commenter [*] [.] [?]', defaut: 'tt', type: 'texte' };
    const n = this.liste[Math.floor(this.reponses.length / 2)];
    if (n === undefined) return null;
    const i = this.ctx.dessin.infos.niveaux[String(n)];
    return this.reponses.length % 2 === 0
      ? { texte: `Niveau ${n}. Désignation [${LONGUEUR_DESIGNATION}c]`, defaut: i?.designation ?? '', type: 'texte' }
      : { texte: `Niveau ${n}. Référence [${LONGUEUR_REFERENCE}c]`, defaut: i?.reference ?? '', type: 'texte' };
  }
  valeur(v: number | string) {
    if (!this.liste) {
      if (String(v).trim() === '?') return this.ctx.dire(descriptionNiveaux(this.ctx));
      const demandes = niveauxDe(this.ctx, v);
      if (!demandes) return this.ctx.dire('Liste de niveaux illisible.');
      const occupes = new Set(this.ctx.dessin.niveauxOccupes);
      const vides = demandes.filter((n) => !occupes.has(n));
      if (vides.length) return this.ctx.dire(`La liste ne peut pas contenir de niveau vide (${vides.join(', ')}).`);
      if (demandes.length === 0) return this.ctx.dire('Aucun niveau occupé.');
      this.liste = demandes;
      return;
    }
    this.reponses.push(String(v).trim());
    if (this.reponses.length < this.liste.length * 2) return;
    const liste = this.liste;
    const reponses = this.reponses;
    this.ctx.dessin.changerInfos((infos) => {
      liste.forEach((n, k) => {
        const cle = String(n);
        const designation = reponses[2 * k].slice(0, LONGUEUR_DESIGNATION);
        const reference = reponses[2 * k + 1].slice(0, LONGUEUR_REFERENCE);
        infos.niveaux[cle] = { ...infos.niveaux[cle], designation, reference };
      });
    });
    this.ctx.dire('Nomenclature modifiée.');
    this.fini = true;
  }
}

// ======================================================================= F9 — Fenêtres nommées

const MAX_FENETRES = 8;

/**
 * F9 — Affichage d'une fenêtre mémorisée : huit fenêtres nommées (6 caractères), chacune avec sa liste de
 * niveaux. « nom/ » en élimine une, « * / » toutes ; X : toutes les entités ; R, P : dimension réelle, papier.
 */
export class FenetreMemorisee extends Gestion {
  readonly nom = "Affichage d'une fenêtre mémorisée";
  readonly code = 'F9';
  private nomFenetre: string | null = null;
  private pts: Pt[] = [];
  private fenetre: { a: Pt; b: Pt } | null = null;
  private get existante(): FenetreNommee | null {
    return this.nomFenetre ? (this.ctx.dessin.infos.fenetres[this.nomFenetre] ?? null) : null;
  }
  question(): Question | null {
    if (this.nomFenetre === null) {
      const noms = Object.keys(this.ctx.dessin.infos.fenetres);
      const defaut = (this.ctx.memoire.get('fenetre') !== undefined && noms[this.ctx.memoire.get('fenetre')!]) || noms[0] || '1';
      return { texte: `${noms.length ? `Fenêtres : ${noms.join(' ')}. ` : ''}Affichage fenêtre. Nom de la fenêtre [*/] [nom/] [X] [R] [P]`, defaut, type: 'texte' };
    }
    if (this.fenetre) return { texte: 'Niveaux à représenter [*] [.] [?]', defaut: this.existante?.niveaux ?? '*', type: 'texte' };
    return null;
  }
  invite(): string {
    if (this.fenetre) return '';
    if (this.pts.length === 1) return 'Affichage fenêtre. Désigner le deuxième point de la diagonale.';
    return this.existante ? 'Affichage fenêtre. Définir la fenêtre par 2 points (déf, la même).' : 'Affichage fenêtre. Définir la fenêtre par 2 points.';
  }
  valeur(v: number | string) {
    if (this.nomFenetre === null) return this.choisirNom(String(v).trim());
    if (!this.fenetre) return;
    const t = String(v).trim() || '*';
    if (t === '?') return this.ctx.dire(descriptionNiveaux(this.ctx));
    const lus = t.replace(/\s/g, '').replace(/\.$/, '') === '*' ? null : lireNiveaux(t, this.ctx.attributs().niveau);
    if (t.replace(/\s/g, '').replace(/\.$/, '') !== '*' && !lus) return this.ctx.dire('Liste de niveaux illisible.');
    const nom = this.nomFenetre;
    const f = this.fenetre;
    const avant = this.existante;
    if (!avant || dist(avant.a, f.a) > 1e-9 || dist(avant.b, f.b) > 1e-9 || avant.niveaux !== t) {
      this.ctx.dessin.changerInfos((infos) => {
        infos.fenetres[nom] = { a: f.a, b: f.b, niveaux: t };
      });
    }
    this.ctx.memoire.set('fenetre', Object.keys(this.ctx.dessin.infos.fenetres).indexOf(nom));
    this.ctx.actions?.afficher?.(f.a, f.b, lus);
    this.ctx.dire(`Fenêtre ${nom}.`);
    this.fini = true;
  }
  private choisirNom(t: string) {
    const T = t.toUpperCase();
    if (T === 'X' || T === 'R' || T === 'P') {
      this.ctx.actions?.vueSpeciale?.(T);
      this.fini = true;
      return;
    }
    if (t.replace(/\s/g, '') === '*/') {
      this.ctx.dessin.changerInfos((infos) => (infos.fenetres = {}));
      this.ctx.dire('Toutes les fenêtres sont éliminées.');
      this.fini = true;
      return;
    }
    if (t.endsWith('/')) {
      const nom = t.slice(0, -1).trim().toUpperCase();
      if (!this.ctx.dessin.infos.fenetres[nom]) return this.ctx.dire(`Pas de fenêtre ${nom}.`);
      this.ctx.dessin.changerInfos((infos) => delete infos.fenetres[nom]);
      this.ctx.dire(`Fenêtre ${nom} éliminée.`);
      this.fini = true;
      return;
    }
    const nom = T.slice(0, 6);
    if (!nom) return;
    if (!this.ctx.dessin.infos.fenetres[nom] && Object.keys(this.ctx.dessin.infos.fenetres).length >= MAX_FENETRES) {
      return this.ctx.dire(`${MAX_FENETRES} fenêtres au plus : en éliminer une (nom/).`);
    }
    this.nomFenetre = nom;
  }
  parDefaut() {
    const f = this.existante;
    if (this.nomFenetre !== null && !this.fenetre && this.pts.length === 0 && f) this.fenetre = { a: f.a, b: f.b };
  }
  dernierPoint() {
    return null;
  }
  point(p: Pt) {
    if (this.nomFenetre === null || this.fenetre) return;
    this.pts.push(p);
    if (this.pts.length < 2) return;
    const [a, b] = this.pts;
    this.pts = [];
    const f = this.existante;
    if (dist(a, b) < this.ctx.rayon()) {
      // Deux fois le même point : la fenêtre se déplace, ce point devient son centre.
      if (!f) return this.ctx.dire('Fenêtre vide.');
      const dx = b.x - (f.a.x + f.b.x) / 2;
      const dy = b.y - (f.a.y + f.b.y) / 2;
      this.fenetre = { a: { x: f.a.x + dx, y: f.a.y + dy }, b: { x: f.b.x + dx, y: f.b.y + dy } };
      return;
    }
    this.fenetre = { a: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) }, b: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) } };
  }
  traitElastique() {
    return 'continu-fin' as const;
  }
  elastique(r: Pt): Primitive[] {
    if (this.pts.length === 1) return rectangle(this.pts[0], r);
    const f = this.existante;
    return f && !this.fenetre ? rectangle(f.a, f.b) : [];
  }
  abandon() {
    return true;
  }
}

// ======================================================================= F19 — Couleur des niveaux

/** F19 — Couleur des niveaux : 0 blanc, 1 vert, 2 rouge, 3 bleu, 4 jaune, 5 magenta, 6 cyan. */
export class CouleurNiveaux extends Gestion {
  readonly nom = 'Changement de la couleur des niveaux';
  readonly code = 'F19';
  private liste: number[] | null = null;
  question(): Question {
    if (!this.liste) return { texte: 'Changement de couleur. Niveaux à changer [*] [.] [?]', defaut: 'tt', type: 'texte' };
    const actuelle = COULEURS.findIndex((c) => c.aci === this.ctx.dessin.couleurNiveau(this.ctx.attributs().niveau));
    return { texte: 'Nouvelle couleur [0 - 6] (0 blanc, 1 vert, 2 rouge, 3 bleu, 4 jaune, 5 magenta, 6 cyan)', defaut: Math.max(0, actuelle), entier: true };
  }
  /** Désigner un trait d'un niveau choisit ce niveau (au lieu de taper son numéro). */
  attente(): 'entite' {
    return 'entite';
  }
  point(p: Pt) {
    if (this.liste) return;
    const e = entiteProche(visibles(this.ctx), p, this.ctx.rayon());
    if (e) this.liste = [e.niveau];
  }
  valeur(v: number | string) {
    if (!this.liste) {
      if (String(v).trim() === '?') return this.ctx.dire(descriptionNiveaux(this.ctx));
      const l = niveauxDe(this.ctx, v);
      if (!l || l.length === 0) return this.ctx.dire('Liste de niveaux illisible.');
      this.liste = l;
      return;
    }
    const i = Math.round(num(v, -1));
    if (i < 0 || i > 6) return this.ctx.dire('Couleur de 0 à 6.');
    const aci = COULEURS[i].aci;
    // La couleur du cycle d'origine n'a pas besoin d'être forcée : on la retire de la table.
    this.ctx.dessin.changerCouleurNiveaux(this.liste, aci);
    this.ctx.dire(`Niveau${this.liste.length > 1 ? 'x' : ''} ${this.liste.join(' ')} en ${COULEURS[i].nom}.`);
    this.fini = true;
  }
}

// ======================================================================= F20 — Échelle d'un niveau

/**
 * F20 — Échelle d'une liste de niveaux : les entités sont agrandies ou réduites autour d'un point, que l'on
 * peut ensuite déplacer (vue de détail placée par rapport à la vue principale). Les cotes faites ensuite sur
 * ces niveaux affichent la dimension réelle (longueur divisée par l'échelle).
 */
export class EchelleNiveau extends Gestion {
  readonly nom = "Changement de l'échelle d'un niveau";
  readonly code = 'F20';
  private liste: number[] | null = null;
  private echelle: number | null = null;
  private pts: Pt[] = [];
  question(): Question | null {
    if (!this.liste) return { texte: "Changement d'échelle. Niveau(x) à modifier [*] [.] [?]", defaut: 'tt', type: 'texte' };
    if (this.echelle === null) return { texte: 'Echelle', defaut: this.ctx.dessin.echelleNiveau(this.liste[0]) };
    return null;
  }
  invite(): string {
    return this.pts.length === 0 ? "Changement d'échelle. Désigner un point du niveau (déf, l'origine)." : "Changement d'échelle. Désigner la nouvelle position de ce point (déf, la même).";
  }
  valeur(v: number | string) {
    if (!this.liste) {
      if (String(v).trim() === '?') return this.ctx.dire(descriptionNiveaux(this.ctx));
      const l = niveauxDe(this.ctx, v);
      if (!l || l.length === 0) return this.ctx.dire('Liste de niveaux illisible.');
      this.liste = l;
      return;
    }
    const k = num(v, 0);
    if (!(k > 0)) return this.ctx.dire("L'échelle doit être positive.");
    this.echelle = k;
  }
  parDefaut() {
    if (!this.liste || this.echelle === null) return;
    this.point(this.pts.length === 0 ? (this.ctx.actions?.origine?.() ?? { x: 0, y: 0 }) : this.pts[0]);
  }
  dernierPoint() {
    return this.pts[0] ?? null;
  }
  point(p: Pt) {
    if (!this.liste || this.echelle === null) return;
    this.pts.push(p);
    if (this.pts.length < 2) return;
    this.appliquer();
  }
  private appliquer() {
    const [p, q] = this.pts;
    const liste = this.liste!;
    const nouvelle = this.echelle!;
    const d = this.ctx.dessin;
    const paires: [Entite, Entite][] = [];
    for (const n of liste) {
      const k = nouvelle / d.echelleNiveau(n);
      for (const e of d.toutes.filter((x) => x.niveau === n)) {
        let t = Math.abs(k - 1) > 1e-12 ? transformerEntite(e, homothetie(p, k)) : e;
        if (dist(p, q) > 1e-12) t = transformerEntite(t, translation(q.x - p.x, q.y - p.y));
        if (t !== e) paires.push([e, t]);
      }
    }
    if (paires.length) d.remplacerPlusieurs(paires);
    d.changerInfos((infos) => {
      for (const n of liste) infos.niveaux[String(n)] = { ...infos.niveaux[String(n)], echelle: nouvelle };
    });
    this.ctx.dire(`Niveau${liste.length > 1 ? 'x' : ''} ${liste.join(' ')} à l'échelle ${nombre(nouvelle)}.`);
    this.fini = true;
  }
  elastique(r: Pt): Primitive[] {
    return this.pts.length === 1 ? [{ type: 'segment', a: this.pts[0], b: r }] : [];
  }
}

enregistrerFonctions({
  F3: NomenclatureNiveaux,
  F9: FenetreMemorisee,
  F19: CouleurNiveaux,
  F20: EchelleNiveau,
});
