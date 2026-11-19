// Ligne 4 de la palette : modification (effacements, transformations, niveaux, types de trait).
// Ordre des questions et textes repris de l'aide d'origine (rubriques « Utilisation détaillée des
// fonctions de modification »).
import type { Entite, Trait } from './dessin';
import {
  affinite,
  dansFenetre,
  eclater,
  deplacerPoint,
  entiteProche,
  homothetie,
  lireNiveaux,
  primitiveProche,
  retirerDemi,
  retirerEntre,
  retirerPartie,
  rotation,
  symetrie,
  transformerEntite,
  translation,
} from './edition';
import { designables, enregistrerFonctions, horsNiveau, visibles, type Contexte, type Fonction, type Question } from './fonctions';
import { dist, type Pt } from './geometrie';
import { angleDe, type Primitive } from './primitives';
import { TRAITS } from './traits';



const rectangle = (a: Pt, b: Pt): Primitive[] => {
  const p = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
  return p.map((q, i) => ({ type: 'segment' as const, a: q, b: p[(i + 1) % 4] }));
};

/** Entité découpée : ses autres primitives restent, en entités séparées si elle était composée. */
function decouper(ctx: Contexte, e: Entite, i: number, reste: Primitive[]): void {
  const morceaux = e.primitives.length > 1 ? eclater(e) : [e];
  const cible = morceaux[i];
  const nouvelles = reste.map((p) => ({ ...cible, genre: p.type === 'arc' ? ('arc' as const) : p.type === 'demi-droite' ? ('demi-droite' as const) : ('segment' as const), primitives: [p], extras: [] }));
  ctx.dessin.remplacerEntite(e, [...morceaux.filter((m) => m !== cible), ...nouvelles]);
}

// ======================================================================= Désignations simples

abstract class Simple implements Fonction {
  abstract readonly nom: string;
  abstract readonly code: string;
  constructor(protected ctx: Contexte) {}
  abstract invite(): string;
  question(): Question | null {
    return null;
  }
  valeur(): void {}
  dernierPoint(): Pt | null {
    return null;
  }
  attente(): 'point' | 'entite' {
    return 'entite';
  }
  abstract point(p: Pt): void;
  abandon(): boolean {
    return true;
  }
  elastique(_r: Pt): Primitive[] {
    return [];
  }
  readonly reperage = 'travail' as const;
  protected designer(p: Pt): Entite | null {
    const e = entiteProche(designables(this.ctx), p, this.ctx.rayon());
    if (!e) this.ctx.dire(horsNiveau(this.ctx, p, (es) => entiteProche(es, p, this.ctx.rayon())));
    return e;
  }
}

/** E5 — Annulation d'une entité (restituable par E7 ou Maj + clic gauche). */
export class AnnulationEntite extends Simple {
  readonly nom = "Annulation d'une entité";
  readonly code = 'E5';
  invite() {
    return "Annulation d'une entité. Désigner l'entité.";
  }
  point(p: Pt) {
    const e = this.designer(p);
    if (e) this.ctx.dessin.retirer(e);
  }
}

/** E3 — Effacement d'une partie d'entité : entre les deux intersections qui encadrent le point désigné. */
export class EffacementPartie extends Simple {
  readonly nom = "Effacement d'une partie d'entité";
  readonly code = 'E3';
  invite() {
    return "Effacement d'une partie d'entité. Désigner la partie à supprimer.";
  }
  point(p: Pt) {
    const e = this.designer(p);
    if (!e) return;
    const i = primitiveProche(e, p);
    const autres = this.ctx.dessin.primitives.filter((q) => q !== e.primitives[i]);
    decouper(this.ctx, e, i, retirerPartie(e.primitives[i], p, autres));
  }
}

/** E4 — Effacement d'une demi-entité : l'entité limite, puis l'entité à couper (côté du point désigné). */
export class EffacementDemi extends Simple {
  readonly nom = "Effacement d'une demi-entité";
  readonly code = 'E4';
  private limite: Entite | null = null;
  invite() {
    return this.limite ? "Effacement d'une demi-entité. Désigner l'entité à couper." : "Effacement d'une demi-entité. Désigner l'entité limite.";
  }
  point(p: Pt) {
    const e = this.designer(p);
    if (!e) return;
    if (!this.limite) {
      this.limite = e;
      return;
    }
    const i = primitiveProche(e, p);
    const reste = retirerDemi(e.primitives[i], p, this.limite.primitives);
    if (reste) decouper(this.ctx, e, i, reste);
    else this.ctx.dire("L'entité ne coupe pas l'entité limite.");
  }
  abandon() {
    const auDebut = !this.limite;
    this.limite = null;
    return auDebut;
  }
}

/** E2 — Effacement partiel par deux points pris sur une même entité. */
export class EffacementDeuxPoints extends Simple {
  readonly nom = 'Effacement partiel par deux points';
  readonly code = 'E2';
  private premier: { p: Pt; e: Entite } | null = null;
  attente(): 'point' {
    return 'point';
  }
  invite() {
    return this.premier ? 'Effacement partiel par deux points. Désigner le deuxième point.' : 'Effacement partiel par deux points. Désigner le premier point.';
  }
  point(p: Pt) {
    if (!this.premier) {
      const e = this.designer(p);
      if (e) this.premier = { p, e };
      return;
    }
    const { e, p: p1 } = this.premier;
    this.premier = null;
    const i = primitiveProche(e, p1);
    decouper(this.ctx, e, i, retirerEntre(e.primitives[i], p1, p));
  }
  abandon() {
    const auDebut = !this.premier;
    this.premier = null;
    return auDebut;
  }
}

/** E13 — Déplacement d'un point : un point existant (à repérer avec Ctrl), puis sa nouvelle position. */
export class DeplacementPoint extends Simple {
  readonly nom = "Déplacement d'un point";
  readonly code = 'E13';
  private de: Pt | null = null;
  attente(): 'point' {
    return 'point';
  }
  invite() {
    return this.de ? "Déplacement d'un point. Désigner la nouvelle position du point." : "Déplacement d'un point. Désigner le point à déplacer.";
  }
  dernierPoint() {
    return this.de;
  }
  point(p: Pt) {
    if (!this.de) {
      this.de = p;
      return;
    }
    const de = this.de;
    this.de = null;
    const paires: [Entite, Entite][] = [];
    for (const e of visibles(this.ctx)) {
      const n = deplacerPoint(e, de, p);
      if (n) paires.push([e, n]);
    }
    if (paires.length) this.ctx.dessin.remplacerPlusieurs(paires);
    else this.ctx.dire('Aucun point du dessin à cet endroit : repérer le point avec Ctrl avant de le désigner.');
  }
  elastique(r: Pt): Primitive[] {
    return this.de ? [{ type: 'segment', a: this.de, b: r }] : [];
  }
  abandon() {
    const auDebut = !this.de;
    this.de = null;
    return auDebut;
  }
}

// ======================================================================= Sélection « entité ou fenêtre (déf, tout) »

type Selection = { entites: Entite[]; parFenetre: boolean };

export abstract class AvecSelection implements Fonction {
  abstract readonly nom: string;
  abstract readonly code: string;
  readonly reperage = 'travail' as const;
  /** Début de l'invite, ex. « Translation. ». */
  protected abstract readonly titre: string;
  protected selection: Selection | null = null;
  private coin: Pt | null = null;
  protected pts: Pt[] = [];
  protected reponses: (number | string)[] = [];

  constructor(protected ctx: Contexte) {}

  /** Points à désigner après la sélection (invite de chacun). */
  protected abstract etapes(): string[];
  /** Questions au clavier après les points. */
  protected abstract questions(): Question[];
  /** Applique la fonction quand tout est connu. */
  protected abstract appliquer(): void;
  /** Point de référence du calage pour le point suivant. */
  protected reference(): Pt | null {
    return this.pts[this.pts.length - 1] ?? null;
  }

  invite(): string {
    if (!this.selection) {
      return this.coin ? `${this.titre} Désigner le deuxième point de la diagonale.` : `${this.titre} Désigner une entité ou définir une fenêtre (déf, tout).`;
    }
    return `${this.titre} ${this.etapes()[this.pts.length]}`;
  }

  attente(): 'point' | 'entite' {
    return !this.selection && !this.coin ? 'entite' : 'point';
  }

  question(): Question | null {
    if (!this.selection || this.pts.length < this.etapes().length) return null;
    return this.questions()[this.reponses.length] ?? null;
  }

  valeur(v: number | string): void {
    this.reponses.push(v);
    if (this.reponses.length >= this.questions().length) this.terminer();
  }

  parDefaut(): void {
    if (this.selection || this.coin) return;
    this.choisir({ entites: [...visibles(this.ctx)], parFenetre: true });
  }

  dernierPoint(): Pt | null {
    return this.selection && this.pts.length > 0 ? this.reference() : null;
  }

  point(p: Pt): void {
    if (!this.selection) {
      if (this.coin) {
        const a = this.coin;
        this.coin = null;
        this.choisir({ entites: dansFenetre(visibles(this.ctx), a, p), parFenetre: true });
        return;
      }
      const e = entiteProche(designables(this.ctx), p, this.ctx.rayon());
      if (e) this.choisir({ entites: [e], parFenetre: false });
      else this.coin = p; // loin de toute entité : premier coin d'une fenêtre
      return;
    }
    this.pts.push(p);
    if (this.pts.length >= this.etapes().length && this.questions().length === 0) this.terminer();
  }

  private choisir(s: Selection): void {
    if (s.entites.length === 0) {
      this.ctx.dire('Aucune entité dans la fenêtre.');
      return;
    }
    this.selection = s;
    if (this.etapes().length === 0 && this.questions().length === 0) this.terminer();
  }

  /** Entités retenues : par fenêtre, filtrées par la liste de niveaux répondue (s'il y en a une). */
  protected retenues(listeNiveaux?: string | number): Entite[] {
    const s = this.selection;
    if (!s) return [];
    if (!s.parFenetre || listeNiveaux === undefined) return s.entites;
    const niveaux = lireNiveaux(String(listeNiveaux), this.ctx.attributs().niveau);
    return niveaux ? s.entites.filter((e) => niveaux.has(e.niveau)) : s.entites;
  }

  /** Question des niveaux, seulement pour une sélection par fenêtre. */
  protected questionNiveaux(texte: string, defaut = 'tt'): Question[] {
    return this.selection?.parFenetre ? [{ texte: `${texte} [*] [.] [?]`, defaut, type: 'texte' }] : [];
  }

  private terminer(): void {
    this.appliquer();
    this.selection = null;
    this.pts = [];
    this.reponses = [];
  }

  abandon(): boolean {
    const auDebut = !this.selection && !this.coin;
    this.selection = null;
    this.coin = null;
    this.pts = [];
    this.reponses = [];
    return auDebut;
  }

  traitElastique(): Trait | null {
    return !this.selection && this.coin ? 'mixte-fin' : null;
  }

  elastique(r: Pt): Primitive[] {
    if (this.coin) return rectangle(this.coin, r);
    return this.apercu(r);
  }

  protected apercu(_r: Pt): Primitive[] {
    return [];
  }

  /** Les entités transformées par `t`, en remplacement ou en copies. */
  protected appliquerTransfo(entites: Entite[], copies: Entite[][], remplacer: boolean): void {
    if (entites.length === 0) {
      this.ctx.dire('Aucune entité sur ces niveaux.');
      return;
    }
    if (remplacer) {
      this.ctx.dessin.remplacerPlusieurs(entites.map((e, i) => [e, copies[0][i]]));
      this.ctx.dessin.ajouterPlusieurs(copies.slice(1).flat());
    } else this.ctx.dessin.ajouterPlusieurs(copies.flat());
  }
}

const oui = (v: number | string | undefined) => String(v ?? 'N').trim().toUpperCase().startsWith('O');
const nombre = (v: number | string | undefined, defaut = 0) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.')) || defaut);

/** E6 — Annulation par fenêtre (déf, tout), sur les niveaux demandés. */
export class AnnulationFenetre extends AvecSelection {
  readonly nom = 'Annulation par fenêtre';
  readonly code = 'E6';
  protected readonly titre = 'Annulation par fenêtre.';
  invite(): string {
    return this.selection ? '' : super.invite().replace('Désigner une entité ou définir une fenêtre', 'Définir la fenêtre par 2 points');
  }
  attente(): 'point' {
    return 'point';
  }
  protected etapes() {
    return [];
  }
  protected questions() {
    return this.questionNiveaux('Niveaux des entités à annuler');
  }
  protected appliquer() {
    const n = this.ctx.dessin.retirer(...this.retenues(this.reponses[0]));
    this.ctx.dire(`${n} entité(s) annulée(s).`);
  }
}

/** E14 — Translation : vecteur par deux points, niveaux, nombre de duplications (0 : déplacement). */
export class Translation extends AvecSelection {
  readonly nom = 'Translation';
  readonly code = 'E14';
  protected readonly titre = 'Translation.';
  protected etapes() {
    return ["Désigner l'origine du vecteur translation.", "Désigner l'extrémité du vecteur translation."];
  }
  protected questions(): Question[] {
    return [...this.questionNiveaux('Niveaux soumis à la translation'), { texte: 'Nombre de duplications', defaut: 0, entier: true }];
  }
  protected appliquer() {
    const [a, b] = this.pts;
    const entites = this.retenues(this.selection?.parFenetre ? this.reponses[0] : undefined);
    const n = Math.max(0, Math.round(nombre(this.reponses[this.reponses.length - 1])));
    const fois = Math.max(1, n);
    const copies = Array.from({ length: fois }, (_, k) => entites.map((e) => transformerEntite(e, translation((b.x - a.x) * (k + 1), (b.y - a.y) * (k + 1)))));
    this.appliquerTransfo(entites, copies, n === 0);
  }
  protected apercu(r: Pt): Primitive[] {
    if (this.pts.length !== 1) return [];
    const t = translation(r.x - this.pts[0].x, r.y - this.pts[0].y);
    return [{ type: 'segment', a: this.pts[0], b: r }, ...(this.selection?.entites ?? []).slice(0, 200).flatMap((e) => transformerEntite(e, t).primitives)];
  }
}

/** E15 — Rotation : centre, angle par deux points, niveaux, nombre de duplications. */
export class Rotation extends AvecSelection {
  readonly nom = 'Rotation';
  readonly code = 'E15';
  protected readonly titre = 'Rotation.';
  protected etapes() {
    return ['Désigner le centre de la rotation.', "Définir l'angle de la rotation par deux points.", 'Désigner le deuxième point.'];
  }
  protected reference() {
    return this.pts[0] ?? null; // les points de l'angle sont calés par rapport au centre
  }
  protected questions(): Question[] {
    return [...this.questionNiveaux('Niveaux soumis à la rotation'), { texte: 'Nombre de duplications', defaut: 0, entier: true }];
  }
  private angle(p1: Pt, p2: Pt): number {
    return angleDe(this.pts[0], p2) - angleDe(this.pts[0], p1);
  }
  protected appliquer() {
    const [c, p1, p2] = this.pts;
    const entites = this.retenues(this.selection?.parFenetre ? this.reponses[0] : undefined);
    const n = Math.max(0, Math.round(nombre(this.reponses[this.reponses.length - 1])));
    const a = this.angle(p1, p2);
    const copies = Array.from({ length: Math.max(1, n) }, (_, k) => entites.map((e) => transformerEntite(e, rotation(c, a * (k + 1)))));
    this.appliquerTransfo(entites, copies, n === 0);
  }
  protected apercu(r: Pt): Primitive[] {
    const [c, p1] = this.pts;
    if (this.pts.length === 1) return [{ type: 'segment', a: c, b: r }];
    if (this.pts.length === 2 && dist(c, r) > 1e-9) {
      const t = rotation(c, this.angle(p1, r));
      return [{ type: 'segment', a: c, b: p1 }, { type: 'segment', a: c, b: r }, ...(this.selection?.entites ?? []).slice(0, 200).flatMap((e) => transformerEntite(e, t).primitives)];
    }
    return [];
  }
}

/** E16 — Symétrie : axe par deux points, niveaux, « remplacer l'original » (déf, N : une copie). */
export class Symetrie extends AvecSelection {
  readonly nom = 'Symétrie';
  readonly code = 'E16';
  protected readonly titre = 'Symétrie.';
  protected etapes() {
    return ["Désigner ou définir l'axe de symétrie.", "Désigner un deuxième point de l'axe."];
  }
  protected questions(): Question[] {
    return [...this.questionNiveaux('Niveaux soumis à la symétrie'), { texte: "Le symétrique doit-il remplacer l'original [O/N]", defaut: 'N', type: 'texte' }];
  }
  protected appliquer() {
    const [a, b] = this.pts;
    if (dist(a, b) < 1e-9) return;
    const entites = this.retenues(this.selection?.parFenetre ? this.reponses[0] : undefined);
    this.appliquerTransfo(entites, [entites.map((e) => transformerEntite(e, symetrie(a, b)))], oui(this.reponses[this.reponses.length - 1]));
  }
  protected apercu(r: Pt): Primitive[] {
    if (this.pts.length !== 1 || dist(this.pts[0], r) < 1e-9) return [];
    const t = symetrie(this.pts[0], r);
    return [{ type: 'droite', a: this.pts[0], b: r }, ...(this.selection?.entites ?? []).slice(0, 200).flatMap((e) => transformerEntite(e, t).primitives)];
  }
}

/** E17 — Homothétie : centre, rapport (déf, 1), niveaux, « remplacer l'original » (déf, N). */
export class Homothetie extends AvecSelection {
  readonly nom = 'Homothétie';
  readonly code = 'E17';
  protected readonly titre = 'Homothétie.';
  protected etapes() {
    return ["Désigner le centre de l'homothétie."];
  }
  protected questions(): Question[] {
    return [
      { texte: "Rapport d'homothétie", defaut: 1 },
      ...this.questionNiveaux("Niveaux soumis à l'homothétie"),
      { texte: "L'homothétique doit-il remplacer l'original [O/N]", defaut: 'N', type: 'texte' },
    ];
  }
  protected appliquer() {
    const k = nombre(this.reponses[0], 1);
    const entites = this.retenues(this.selection?.parFenetre ? this.reponses[1] : undefined);
    this.appliquerTransfo(entites, [entites.map((e) => transformerEntite(e, homothetie(this.pts[0], k)))], oui(this.reponses[this.reponses.length - 1]));
  }
}

/** E18 — Affinité : axe par deux points, rapport (déf, 1), niveaux, « remplacer l'original » (déf, N). */
export class Affinite extends AvecSelection {
  readonly nom = 'Affinité';
  readonly code = 'E18';
  protected readonly titre = 'Affinité.';
  protected etapes() {
    return ["Définir l'axe d'affinité par deux points. Désigner le premier point.", "Désigner l'extrémité de l'axe de l'affinité."];
  }
  protected questions(): Question[] {
    return [
      { texte: "Rapport d'affinité", defaut: 1 },
      ...this.questionNiveaux("Niveaux soumis à l'affinité"),
      { texte: "L'affine doit-il remplacer l'original [O/N]", defaut: 'N', type: 'texte' },
    ];
  }
  protected appliquer() {
    const [a, b] = this.pts;
    if (dist(a, b) < 1e-9) return this.ctx.dire("Axe d'affinité nul.");
    const k = nombre(this.reponses[0], 1);
    const entites = this.retenues(this.selection?.parFenetre ? this.reponses[1] : undefined);
    this.appliquerTransfo(entites, [entites.map((e) => transformerEntite(e, affinite(a, b, k)))], oui(this.reponses[this.reponses.length - 1]));
  }
  protected apercu(r: Pt): Primitive[] {
    return this.pts.length === 1 && dist(this.pts[0], r) > 1e-9 ? [{ type: 'droite', a: this.pts[0], b: r }] : [];
  }
}

// ======================================================================= Placement d'un niveau (E11, E12)

/** Niveaux 91 à 99 : réservés (cartouche, fond de plan…), le placement n'y est pas actif. */
const NIVEAU_RESERVE = 91;
const PAS_ROTATION = 15; // degrés, à chaque appui sur R (360 / 24 dans l'original)

abstract class PlacementNiveau implements Fonction {
  abstract readonly nom: string;
  abstract readonly code: string;
  protected abstract readonly titre: string;
  protected niveau: number | null = null;
  /** Le point désigné sur le niveau : origine du déplacement, ou centre de la rotation. */
  protected origine: Pt | null = null;
  private readonly niveauAvant: number;
  constructor(protected ctx: Contexte) {
    this.niveauAvant = ctx.attributs().niveau;
  }
  question(): Question | null {
    return null;
  }
  valeur(): void {}
  attente(): 'point' | 'entite' {
    return this.niveau === null ? 'entite' : 'point';
  }
  dernierPoint(): Pt | null {
    return this.origine;
  }
  /** Désignation d'une entité : son niveau devient le niveau de travail. */
  protected designer(p: Pt): boolean {
    const e = entiteProche(visibles(this.ctx), p, this.ctx.rayon());
    if (!e) {
      this.ctx.dire("Pas d'entité à cet endroit.");
      return false;
    }
    if (e.niveau >= NIVEAU_RESERVE) {
      this.ctx.dire(`${this.titre} Fonction non active sur les niveaux ${NIVEAU_RESERVE} à 99.`);
      return false;
    }
    this.niveau = e.niveau;
    this.origine = p;
    this.ctx.actions?.niveau(e.niveau);
    return true;
  }
  protected entitesDuNiveau(): Entite[] {
    return this.ctx.dessin.toutes.filter((e) => e.niveau === this.niveau);
  }
  protected transformerNiveau(t: Parameters<typeof transformerEntite>[1]): void {
    const es = this.entitesDuNiveau();
    if (es.length) this.ctx.dessin.remplacerPlusieurs(es.map((e) => [e, transformerEntite(e, t)]));
  }
  protected apercuNiveau(t: Parameters<typeof transformerEntite>[1]): Primitive[] {
    return this.entitesDuNiveau()
      .slice(0, 300)
      .flatMap((e) => transformerEntite(e, t).primitives);
  }
  abstract invite(): string;
  abstract point(p: Pt): void;
  abstract elastique(r: Pt): Primitive[];
  /** Échap : on lâche le niveau pour en désigner un autre ; au début, on sort. */
  abandon(): boolean {
    const auDebut = this.niveau === null;
    this.niveau = null;
    this.origine = null;
    return auDebut;
  }
  /** En quittant la fonction, le niveau de travail d'avant est rétabli. */
  quitter(): void {
    if (this.ctx.attributs().niveau !== this.niveauAvant) this.ctx.actions?.niveau(this.niveauAvant);
  }
}

/**
 * E11 — Placement d'un niveau par translation : le niveau suit chaque point désigné (translations
 * successives) ; R le tourne de 15° autour du point, X et Y le retournent (symétrie horizontale, verticale).
 */
export class TranslationNiveau extends PlacementNiveau {
  readonly nom = "Translation d'un niveau";
  readonly code = 'E11';
  protected readonly titre = "Translation d'un niveau.";
  invite() {
    return this.niveau === null ? `${this.titre} Désigner une entité du niveau.` : `${this.titre} Désigner l'extrémité du vecteur translation [R] [X] [Y].`;
  }
  point(p: Pt) {
    if (this.niveau === null) {
      this.designer(p);
      return;
    }
    const o = this.origine!;
    this.transformerNiveau(translation(p.x - o.x, p.y - o.y));
    this.origine = p;
  }
  touche(cle: string): boolean {
    const o = this.origine;
    if (this.niveau === null || !o) return false;
    if (cle === 'R') this.transformerNiveau(rotation(o, PAS_ROTATION));
    else if (cle === 'X') this.transformerNiveau(symetrie(o, { x: o.x + 1, y: o.y }));
    else if (cle === 'Y') this.transformerNiveau(symetrie(o, { x: o.x, y: o.y + 1 }));
    else return false;
    return true;
  }
  elastique(r: Pt): Primitive[] {
    const o = this.origine;
    if (this.niveau === null || !o) return [];
    return [{ type: 'segment', a: o, b: r }, ...this.apercuNiveau(translation(r.x - o.x, r.y - o.y))];
  }
}

/**
 * E12 — Placement d'un niveau par rotation : le point désigné est le centre ; l'angle est donné par deux
 * points, puis chaque nouveau point tourne encore le niveau depuis la position précédente.
 */
export class RotationNiveau extends PlacementNiveau {
  readonly nom = "Rotation d'un niveau";
  readonly code = 'E12';
  protected readonly titre = "Rotation d'un niveau.";
  private depart: Pt | null = null;
  invite() {
    if (this.niveau === null) return `${this.titre} Désigner une entité du niveau.`;
    return this.depart ? `${this.titre} Désigner le deuxième point.` : `${this.titre} Définir l'angle de la rotation par deux points.`;
  }
  point(p: Pt) {
    if (this.niveau === null) {
      this.designer(p);
      return;
    }
    const c = this.origine!;
    if (dist(p, c) < 1e-9) return;
    if (!this.depart) {
      this.depart = p;
      return;
    }
    this.transformerNiveau(rotation(c, angleDe(c, p) - angleDe(c, this.depart)));
    this.depart = p; // la position suivante se prend depuis celle-ci
  }
  elastique(r: Pt): Primitive[] {
    const c = this.origine;
    if (this.niveau === null || !c) return [];
    if (!this.depart || dist(r, c) < 1e-9) return [{ type: 'segment', a: c, b: r }];
    return [
      { type: 'segment', a: c, b: this.depart },
      { type: 'segment', a: c, b: r },
      ...this.apercuNiveau(rotation(c, angleDe(c, r) - angleDe(c, this.depart))),
    ];
  }
  abandon(): boolean {
    this.depart = null;
    return super.abandon();
  }
}

/** E19 — Changement de niveau ou duplication sur un autre niveau. */
export class ChangementNiveau extends AvecSelection {
  readonly nom = 'Changement de niveau, duplication';
  readonly code = 'E19';
  protected readonly titre = 'Changement de niveau.';
  protected etapes() {
    return [];
  }
  protected questions(): Question[] {
    return [
      ...this.questionNiveaux('Niveaux à changer'),
      { texte: "Niveau d'arrivée [?]", defaut: 'tt', type: 'texte' },
      { texte: 'Duplication [O/N]', defaut: 'N', type: 'texte' },
    ];
  }
  protected appliquer() {
    const fenetre = this.selection?.parFenetre ?? false;
    const entites = this.retenues(fenetre ? this.reponses[0] : undefined);
    const arrivee = String(this.reponses[fenetre ? 1 : 0]).trim().toLowerCase();
    const niveau = arrivee === 'tt' || arrivee === '' ? this.ctx.attributs().niveau : Math.round(nombre(arrivee, 0));
    if (niveau < 1 || niveau > 99) {
      this.ctx.dire('Niveau incorrect (1 à 99).');
      return;
    }
    const copies = entites.map((e) => ({ ...e, niveau, calque: undefined, couleur: undefined, styles: undefined }));
    this.appliquerTransfo(entites, [copies], !oui(this.reponses[this.reponses.length - 1]));
  }
}

/** E20 — Changement du type de trait : une entité désignée prend le trait en cours ; une fenêtre demande confirmation. */
export class ChangementTrait extends AvecSelection {
  readonly nom = 'Changement de type de trait';
  readonly code = 'E20';
  protected readonly titre = 'Changt de type de trait.';
  protected etapes() {
    return [];
  }
  protected questions(): Question[] {
    const t = TRAITS[this.ctx.attributs().trait].nom;
    return this.selection?.parFenetre ? [{ texte: `Changement des entités de la fenêtre en trait ${t} [O/N]`, defaut: 'N', type: 'texte' }] : [];
  }
  protected appliquer() {
    if (this.selection?.parFenetre && !oui(this.reponses[0])) return;
    const trait = this.ctx.attributs().trait;
    const entites = this.selection?.entites ?? [];
    this.ctx.dessin.remplacerPlusieurs(entites.map((e) => [e, { ...e, trait, styles: e.styles?.map((s) => ({ ...s, trait })) }]));
  }
}

enregistrerFonctions({
  E2: EffacementDeuxPoints,
  E3: EffacementPartie,
  E4: EffacementDemi,
  E5: AnnulationEntite,
  E6: AnnulationFenetre,
  E13: DeplacementPoint,
  E14: Translation,
  E15: Rotation,
  E16: Symetrie,
  E17: Homothetie,
  E18: Affinite,
  E11: TranslationNiveau,
  E12: RotationNiveau,
  E19: ChangementNiveau,
  E20: ChangementTrait,
});
