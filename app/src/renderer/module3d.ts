// Vue 3D (nouveauté) : la fenêtre se coupe en deux, le plan à gauche, le volume à droite. Le volume suit
// les modifications du plan. On désigne le contour (ou une fenêtre) comme dans les autres fonctions.
import type { Entite, Trait } from './dessin';
import { aretes, axePour, contours, pieceEn, type Axe, type Contour } from './contours';
import { dansFenetre, entiteProche } from './edition';
import type { Contexte, Fonction, Question } from './fonctions';
import type { Pt } from './geometrie';
import type { Poste } from './poste';
import type { Primitive } from './primitives';
import { Vue3D, type Mode3D } from './vue3d';

export type Source3D = { type: 'tout' } | { type: 'point'; p: Pt; rayon: number } | { type: 'fenetre'; a: Pt; b: Pt };

const rectangle = (a: Pt, b: Pt): Primitive[] => {
  const p = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
  return p.map((q, i) => ({ type: 'segment' as const, a: q, b: p[(i + 1) % 4] }));
};

/** Désignation du contour à mettre en volume : une entité du contour, une fenêtre, ou tout (Entrée). */
class Designation3D implements Fonction {
  readonly nom = 'Vue 3D';
  readonly code = '3D';
  readonly ponctuelle = true;
  private coin: Pt | null = null;
  private fini = false;
  constructor(
    private ctx: Contexte,
    private choisi: (s: Source3D) => void,
  ) {}
  invite() {
    return this.coin ? 'Vue 3D. Désigner le deuxième point de la diagonale.' : 'Vue 3D. Désigner le contour à mettre en volume ou définir une fenêtre (déf, tout).';
  }
  question(): Question | null {
    return null;
  }
  valeur() {}
  attente(): 'point' | 'entite' {
    return this.coin ? 'point' : 'entite';
  }
  parDefaut() {
    if (!this.coin) this.finir({ type: 'tout' });
  }
  dernierPoint() {
    return null;
  }
  point(p: Pt) {
    if (this.coin) {
      const a = this.coin;
      this.coin = null;
      this.finir({ type: 'fenetre', a, b: p });
      return;
    }
    if (entiteProche(this.ctx.dessin.toutes, p, this.ctx.rayon())) this.finir({ type: 'point', p, rayon: this.ctx.rayon() });
    else this.coin = p; // loin de toute entité : premier coin d'une fenêtre
  }
  private finir(s: Source3D) {
    this.fini = true;
    this.choisi(s);
  }
  termine() {
    return this.fini;
  }
  abandon() {
    const auDebut = !this.coin;
    this.coin = null;
    return auDebut;
  }
  traitElastique(): Trait | null {
    return this.coin ? 'mixte-fin' : null;
  }
  elastique(r: Pt): Primitive[] {
    return this.coin ? rectangle(this.coin, r) : [];
  }
}

/** Désignation de l'axe de révolution : un trait droit du plan. */
class DesignationAxe implements Fonction {
  readonly nom = 'Axe de révolution';
  readonly code = '3D';
  readonly ponctuelle = true;
  private fini = false;
  constructor(
    private ctx: Contexte,
    private choisi: (a: Axe) => void,
  ) {}
  invite() {
    return "Vue 3D. Désigner l'axe de révolution (un trait droit, de préférence un trait d'axe mixte).";
  }
  question(): Question | null {
    return null;
  }
  valeur() {}
  attente(): 'point' | 'entite' {
    return 'entite';
  }
  dernierPoint() {
    return null;
  }
  point(p: Pt) {
    const e = entiteProche(this.ctx.dessin.toutes, p, this.ctx.rayon());
    const droit = e?.primitives.find((q) => q.type === 'segment' || q.type === 'droite' || q.type === 'demi-droite');
    if (!droit || !('a' in droit) || !('b' in droit)) {
      this.ctx.dire("Désigner un trait droit (segment, droite ou trait d'axe).");
      return;
    }
    this.fini = true;
    this.choisi({ a: droit.a, b: droit.b });
  }
  termine() {
    return this.fini;
  }
  abandon() {
    return true;
  }
  elastique(): Primitive[] {
    return [];
  }
}

/** Les traits d'axe du dessin (traits mixtes droits) : candidats pour l'axe de révolution. */
function traitsAxe(entites: readonly Entite[]): Primitive[] {
  return entites.flatMap((e) => e.primitives.filter((p, i) => (e.styles?.[i]?.trait ?? e.trait) === 'mixte-fin' && (p.type === 'segment' || p.type === 'droite' || p.type === 'demi-droite')));
}

export class Module3D {
  readonly vue: Vue3D;
  private source: Source3D | null = null;
  private mode: Mode3D = 'extrusion';
  private epaisseur = 10;
  private axeChoisi: Axe | null = null;
  private version = -1;
  private minuterie = 0;

  constructor(
    private poste: Poste,
    private panneau: HTMLElement,
    /** La disposition de la fenêtre change (ouverture ou fermeture du panneau). */
    private disposition: (ouvert: boolean) => void,
  ) {
    this.vue = new Vue3D(panneau, {
      mode: (m) => {
        this.mode = m;
        this.construire(false);
      },
      epaisseur: (mm) => {
        this.epaisseur = mm;
        this.construire(false);
      },
      designer: () => this.designer(),
      choisirAxe: () => this.poste.choisir(new DesignationAxe(this.poste.contexte, (a) => {
        this.axeChoisi = a;
        this.mode = 'revolution';
        this.construire(false);
      })),
      fermer: () => this.fermer(),
    });
    // Le volume suit le plan : on le reconstruit peu après chaque changement.
    setInterval(() => {
      if (this.ouvert && this.source && this.poste.dessin.version !== this.version) {
        clearTimeout(this.minuterie);
        this.minuterie = window.setTimeout(() => this.construire(false), 250);
        this.version = this.poste.dessin.version;
      }
    }, 300);
  }

  get ouvert(): boolean {
    return !this.panneau.hidden;
  }

  /** Bouton 3D, menu ou recherche : ouvre le panneau et demande le contour. */
  ouvrir(): void {
    if (!this.ouvert) {
      this.panneau.hidden = false;
      this.disposition(true);
    }
    this.designer();
    if (!this.source) this.vue.afficher({ mode: this.mode, pieces: [], axes: [], epaisseur: this.epaisseur }, true);
  }

  basculer(): void {
    if (this.ouvert) this.fermer();
    else this.ouvrir();
  }

  fermer(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    this.panneau.hidden = true;
    this.disposition(false);
  }

  private designer(): void {
    this.poste.choisir(
      new Designation3D(this.poste.contexte, (s) => {
        this.source = s;
        this.axeChoisi = null;
        this.construire(true);
      }),
    );
  }

  /** Les pièces de la source désignée, recalculées sur le dessin actuel. */
  private pieces(): Contour[] {
    const s = this.source;
    if (!s) return [];
    const toutes = this.poste.dessin.toutes;
    if (s.type === 'fenetre') return contours(aretes(dansFenetre(toutes, s.a, s.b)).map((a) => a.prim)).pieces;
    const r = contours(aretes(toutes).map((a) => a.prim));
    if (s.type === 'tout') return r.pieces;
    const p = pieceEn(r, s.p, s.rayon);
    return p ? [p] : [];
  }

  /** Les traits cachés (pointillés) de la source : perçages et alésages des pièces de révolution. */
  private caches(): Primitive[] {
    const s = this.source;
    if (!s) return [];
    const toutes = this.poste.dessin.toutes;
    return aretes(s.type === 'fenetre' ? dansFenetre(toutes, s.a, s.b) : toutes, 'pointille-fin').map((a) => a.prim);
  }

  private construire(nouveau: boolean): void {
    if (!this.ouvert) return;
    this.version = this.poste.dessin.version;
    const pieces = this.pieces();
    const candidats = traitsAxe(this.poste.dessin.toutes);
    const axes = pieces.map((p) => this.axeChoisi ?? axePour(p.points, candidats));
    this.vue.afficher({ mode: this.mode, pieces, axes, epaisseur: this.epaisseur, caches: this.caches() }, nouveau);
    if (nouveau && this.source) {
      this.poste.contexte.dire(
        pieces.length
          ? `Vue 3D : ${pieces.length} contour${pieces.length > 1 ? 's' : ''} fermé${pieces.length > 1 ? 's' : ''} mis en volume.`
          : "Vue 3D : pas de contour fermé à cet endroit (seuls les traits continus forts comptent).",
      );
    }
  }
}
