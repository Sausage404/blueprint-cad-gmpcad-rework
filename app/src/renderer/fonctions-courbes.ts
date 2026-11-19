// Ligne 2 de la palette : ellipses (C1 à C5), polyligne (C6), courbes lissée et interpolée (C7, C8),
// insertion et suppression de points (C9), traits d'axes perpendiculaires (C15).
// Ordre des questions et textes repris de l'aide d'origine (rubriques ELLIPSE, LISSAGE, INTERPOLATION…).
import {
  arcEllipse,
  demiEllipse,
  ellipseAxes,
  ellipseConjugues,
  ellipseProjection,
  interpolation,
  lissage,
  quartEllipse,
  relier,
  traitsAxes,
  type ResultatEllipse,
} from './courbes';
import type { Entite, Genre, Trait } from './dessin';
import { Base, enregistrerFonctions, type Question, visibles } from './fonctions';
import { dist, type PointCaracteristique, type Pt } from './geometrie';
import type { Primitive } from './primitives';

const MAX_POINTS = 50;
const oui = (v: number | string) => String(v).trim().toUpperCase().startsWith('O');

function entite(genre: Genre, primitives: Primitive[], extras: PointCaracteristique[], at: { niveau: number; trait: Trait }, params?: Record<string, unknown>): Entite {
  return { genre, primitives, extras, niveau: at.niveau, trait: at.trait, ...(params ? { params } : {}) };
}

/** L'entité d'une ellipse ou d'un arc d'ellipse : centre repérable, et extrémités pour un arc. */
function entiteEllipse(r: Extract<ResultatEllipse, { c: Pt }>, at: { niveau: number; trait: Trait }): Entite {
  const pts = arcEllipse(r.c, r.u, r.v, r.t0, r.t1);
  const complete = Math.abs(r.t1 - r.t0 - 2 * Math.PI) < 1e-9;
  const extras: PointCaracteristique[] = [{ p: r.c, type: 'milieu' }];
  if (!complete) extras.push({ p: pts[0], type: 'extremite' }, { p: pts[pts.length - 1], type: 'extremite' });
  return entite('ellipse', relier(pts, complete), extras, at);
}

// ======================================================================= Ellipses

/** Fonction à trois points qui construit une ellipse (C2 à C5). */
abstract class EllipseTroisPoints extends Base {
  protected abstract textes: string[];
  protected abstract calcul(p1: Pt, p2: Pt, p3: Pt): ResultatEllipse;
  protected abstract titre: string;
  invite() {
    return `${this.titre}. ${this.textes[this.pts.length]}`;
  }
  dernierPoint() {
    return this.pts[this.pts.length - 1] ?? null;
  }
  point(p: Pt) {
    this.pts.push(p);
    if (this.pts.length < 3) return;
    const r = this.calcul(this.pts[0], this.pts[1], this.pts[2]);
    this.pts = [];
    if ('erreur' in r) this.ctx.dire(r.erreur);
    else this.ajouter(entiteEllipse(r, this.at));
  }
  elastique(r: Pt): Primitive[] {
    if (this.pts.length === 1) return [{ type: 'segment', a: this.pts[0], b: r }];
    if (this.pts.length === 2) {
      const e = this.calcul(this.pts[0], this.pts[1], r);
      return 'erreur' in e ? [{ type: 'segment', a: this.pts[0], b: this.pts[1] }] : relier(arcEllipse(e.c, e.u, e.v, e.t0, e.t1), false);
    }
    return [];
  }
}

/** C1 — Ellipse par son centre, la direction du grand axe, le diamètre du cercle projeté et l'angle de projection. */
export class EllipseProjection extends Base {
  readonly nom = 'Ellipse (centre, diamètre, angle)';
  readonly code = 'C1';
  private diametre: number | null = null;
  invite() {
    return this.pts.length === 0 ? 'Ellipse. Désigner le centre.' : 'Ellipse. Désigner la direction du grand axe par un point.';
  }
  dernierPoint() {
    return this.pts[0] ?? null;
  }
  question(): Question | null {
    if (this.pts.length < 2) return null;
    if (this.diametre === null) return { texte: 'Diamètre du cercle projeté', defaut: this.memoire('ellipse-diametre', 0) };
    return { texte: 'Angle de projection', defaut: this.memoire('ellipse-angle', 0) };
  }
  valeur(v: number | string) {
    const n = Number(v);
    if (this.diametre === null) {
      if (!(n > 0)) return;
      this.diametre = n;
      this.ctx.memoire.set('ellipse-diametre', n);
      return;
    }
    this.ctx.memoire.set('ellipse-angle', n);
    const r = ellipseProjection(this.pts[0], this.pts[1], this.diametre, n);
    this.pts = [];
    this.diametre = null;
    if ('erreur' in r) this.ctx.dire(r.erreur);
    else this.ajouter(entiteEllipse(r, this.at));
  }
  point(p: Pt) {
    if (this.pts.length === 1 && dist(this.pts[0], p) < 1e-9) return;
    this.pts.push(p);
  }
  abandon() {
    this.diametre = null;
    return super.abandon();
  }
  elastique(r: Pt): Primitive[] {
    return this.pts.length === 1 ? [{ type: 'segment', a: this.pts[0], b: r }] : [];
  }
}

/** C2 — Ellipse par son centre et les extrémités des axes principaux. */
export class EllipseAxes extends EllipseTroisPoints {
  readonly nom = 'Ellipse (centre, axes principaux)';
  readonly code = 'C2';
  protected titre = 'Ellipse';
  protected textes = ['Désigner le centre.', "Désigner l'extrémité du premier axe.", 'Désigner un point définissant une extrémité du second axe.'];
  protected calcul = ellipseAxes;
  dernierPoint() {
    return this.pts[0] ?? null; // les deux extrémités sont calées par rapport au centre
  }
}

/** C3 — Ellipse par deux diamètres conjugués. */
export class EllipseConjugues extends EllipseTroisPoints {
  readonly nom = 'Ellipse (diamètres conjugués)';
  readonly code = 'C3';
  protected titre = 'Ellipse';
  protected textes = ["Désigner un diamètre par deux points. Désigner l'origine d'un diamètre.", "Désigner l'extrémité du diamètre.", 'Désigner une extrémité du diamètre conjugué.'];
  protected calcul = ellipseConjugues;
  dernierPoint() {
    if (this.pts.length === 2) return { x: (this.pts[0].x + this.pts[1].x) / 2, y: (this.pts[0].y + this.pts[1].y) / 2 };
    return this.pts[0] ?? null;
  }
}

/** C4 — Quart d'ellipse : origine, intersection des tangentes, extrémité. */
export class QuartEllipse extends EllipseTroisPoints {
  readonly nom = "Quart d'ellipse";
  readonly code = 'C4';
  protected titre = "Quart d'ellipse";
  protected textes = ["Désigner l'origine de l'arc.", "Désigner l'intersection des tangentes aux extrémités.", "Désigner l'extrémité de l'arc d'ellipse."];
  protected calcul = quartEllipse;
}

/** C5 — Demi-ellipse : un diamètre et une extrémité du diamètre conjugué. */
export class DemiEllipse extends EllipseTroisPoints {
  readonly nom = 'Demi-ellipse';
  readonly code = 'C5';
  protected titre = 'Demi-ellipse';
  protected textes = ["Désigner un diamètre par deux points. Désigner l'origine du diamètre.", "Désigner l'extrémité du diamètre.", 'Désigner une extrémité du diamètre conjugué.'];
  protected calcul = demiEllipse;
  dernierPoint() {
    if (this.pts.length === 2) return { x: (this.pts[0].x + this.pts[1].x) / 2, y: (this.pts[0].y + this.pts[1].y) / 2 };
    return this.pts[0] ?? null;
  }
}

// ======================================================================= Polyligne et courbes

/** Saisie d'une série de points, terminée par Entrée (« RETURN pour tracer »), 50 points au plus. */
abstract class SuitePoints extends Base {
  protected abstract titre: string;
  protected minimum = 2;
  protected fini = false;
  invite() {
    if (this.pts.length >= MAX_POINTS) return `${MAX_POINTS} points maxi (RETURN pour tracer)`;
    return this.pts.length === 0 ? `${this.titre}. Désigner le point 1.` : `${this.titre}. Désigner le point ${this.pts.length + 1} (RETURN pour tracer).`;
  }
  dernierPoint() {
    return this.fini ? null : (this.pts[this.pts.length - 1] ?? null);
  }
  point(p: Pt) {
    if (this.fini || this.pts.length >= MAX_POINTS) return;
    this.pts.push(p);
  }
  parDefaut() {
    if (this.fini) return;
    if (this.pts.length < this.minimum) {
      this.ctx.dire(`${this.titre} : il faut au moins ${this.minimum} points.`);
      return;
    }
    this.fini = true;
    this.apresSaisie();
  }
  protected abstract apresSaisie(): void;
  protected recommencer() {
    this.pts = [];
    this.fini = false;
  }
  abandon() {
    const auDebut = this.pts.length === 0;
    this.recommencer();
    return auDebut;
  }
  elastique(r: Pt): Primitive[] {
    if (this.fini) return relier(this.pts, false);
    return this.pts.length ? relier([...this.pts, r], false) : [];
  }
}

/** C6 — Polyligne. */
export class Polyligne extends SuitePoints {
  readonly nom = 'Polyligne';
  readonly code = 'C6';
  protected titre = 'Polyligne';
  protected apresSaisie() {
    const pts = this.pts;
    this.ajouter(entite('polyligne', relier(pts, false, false), pts.map((p) => ({ p, type: 'extremite' as const })), this.at));
    this.recommencer();
  }
}

/** Points d'une courbe, avec ses réglages, en entité. */
export function entiteCourbe(points: Pt[], methode: 'lissage' | 'interpolation', fermee: boolean, tangentes: [Pt | null, Pt | null], at: { niveau: number; trait: Trait }): Entite {
  const trace = methode === 'lissage' ? lissage(points, fermee) : interpolation(points, fermee, tangentes[0], tangentes[1]);
  const extras: PointCaracteristique[] = points.map((p) => ({ p, type: 'extremite' }));
  if (tangentes[0] && tangentes[1]) extras.push({ p: tangentes[0], type: 'extremite' }, { p: tangentes[1], type: 'extremite' });
  return entite('courbe', relier(trace, fermee && methode === 'interpolation'), extras, at, {
    methode,
    fermee,
    points: points.length,
    tangentes: !!(tangentes[0] && tangentes[1]),
  });
}

/** Les points de définition d'une courbe (et ses tangentes), relus depuis l'entité. */
export function definitionCourbe(e: Entite): { points: Pt[]; methode: 'lissage' | 'interpolation'; fermee: boolean; tangentes: [Pt | null, Pt | null] } | null {
  const p = e.params;
  if (e.genre !== 'courbe' || !p) return null;
  const n = Number(p.points);
  const points = e.extras.slice(0, n).map((x) => x.p);
  const t = p.tangentes ? [e.extras[n]?.p ?? null, e.extras[n + 1]?.p ?? null] : [null, null];
  return { points, methode: p.methode === 'interpolation' ? 'interpolation' : 'lissage', fermee: !!p.fermee, tangentes: t as [Pt | null, Pt | null] };
}

/** C7 — Courbe par lissage. */
export class CourbeLissee extends SuitePoints {
  readonly nom = 'Courbe lissée';
  readonly code = 'C7';
  protected titre = 'Courbe lissée';
  protected minimum = 3;
  question(): Question | null {
    return this.fini ? { texte: 'Courbe fermée [O/N]', defaut: 'N', type: 'texte' } : null;
  }
  protected apresSaisie() {}
  valeur(v: number | string) {
    this.ajouter(entiteCourbe(this.pts, 'lissage', oui(v), [null, null], this.at));
    this.recommencer();
  }
  elastique(r: Pt): Primitive[] {
    const pts = this.fini ? this.pts : [...this.pts, r];
    return pts.length >= 3 ? [...relier(pts, false), ...relier(lissage(pts, false))] : relier(pts, false);
  }
}

/** C8 — Courbe par interpolation (au moins 4 points) ; ouverte, tangentes aux extrémités imposées ou non. */
export class CourbeInterpolee extends SuitePoints {
  readonly nom = 'Courbe interpolée';
  readonly code = 'C8';
  protected titre = 'Courbe interpolée';
  protected minimum = 4;
  private fermee: boolean | null = null;
  private tangentes: (Pt | null)[] = [];
  invite() {
    if (this.fini && this.fermee === false) {
      return this.tangentes.length === 0
        ? "Courbe interpolée. Désigner l'extrémité de la tangente à l'origine de la courbe."
        : "Courbe interpolée. Désigner l'extrémité de la tangente à l'extrémité de la courbe.";
    }
    return super.invite();
  }
  question(): Question | null {
    return this.fini && this.fermee === null ? { texte: 'Courbe fermée [O/N]', defaut: 'N', type: 'texte' } : null;
  }
  protected apresSaisie() {}
  valeur(v: number | string) {
    this.fermee = oui(v);
    if (this.fermee) this.terminer();
  }
  dernierPoint() {
    if (this.fini && this.fermee === false) return this.tangentes.length === 0 ? this.pts[0] : this.pts[this.pts.length - 1];
    return super.dernierPoint();
  }
  point(p: Pt) {
    if (!this.fini) return super.point(p);
    if (this.fermee !== false) return;
    // Un point à moins de quelques millimètres écran de l'extrémité : pas de tangente imposée.
    const origine = this.tangentes.length === 0 ? this.pts[0] : this.pts[this.pts.length - 1];
    this.tangentes.push(dist(p, origine) <= this.ctx.rayon() ? null : p);
    if (this.tangentes.length === 2) this.terminer();
  }
  private terminer() {
    const t: [Pt | null, Pt | null] = this.fermee ? [null, null] : [this.tangentes[0] ?? null, this.tangentes[1] ?? null];
    // Une seule tangente imposée : l'autre prend la direction naturelle (sur son propre point).
    const tangentes: [Pt | null, Pt | null] = t[0] || t[1] ? [t[0] ?? this.pts[0], t[1] ?? this.pts[this.pts.length - 1]] : [null, null];
    this.ajouter(entiteCourbe(this.pts, 'interpolation', !!this.fermee, tangentes, this.at));
    this.fermee = null;
    this.tangentes = [];
    this.recommencer();
  }
  abandon() {
    this.fermee = null;
    this.tangentes = [];
    return super.abandon();
  }
  elastique(r: Pt): Primitive[] {
    if (this.fini && this.fermee === false) {
      const o = this.tangentes.length === 0 ? this.pts[0] : this.pts[this.pts.length - 1];
      return [...relier(interpolation(this.pts, false, this.tangentes[0] ?? null, this.tangentes.length ? r : null)), { type: 'segment', a: o, b: r }];
    }
    const pts = this.fini ? this.pts : [...this.pts, r];
    return pts.length >= 2 ? [...relier(pts, false), ...relier(interpolation(pts, false))] : [];
  }
}

/** C9 — Insertion ou suppression d'un point d'une courbe lissée ou interpolée (sur le niveau de travail). */
export class PointCourbe extends Base {
  readonly nom = "Courbe : insertion ou suppression d'un point";
  readonly code = 'C9';
  private mode: '+' | '-' | null = null;
  private cible: { e: Entite; i: number } | null = null;
  question(): Question | null {
    return this.mode === null ? { texte: "Insertion ou suppression d'un point [+/-]", defaut: '+', type: 'texte' } : null;
  }
  valeur(v: number | string) {
    this.mode = String(v).trim().startsWith('-') ? '-' : '+';
  }
  attente(): 'point' | 'entite' {
    return this.cible ? 'point' : 'entite';
  }
  invite() {
    if (this.mode === '-') return 'Courbe. Désigner le point de la courbe à supprimer.';
    return this.cible ? 'Courbe. Désigner le nouveau point.' : 'Courbe. Désigner le point de la courbe précédant celui à insérer.';
  }
  dernierPoint() {
    return this.cible ? (definitionCourbe(this.cible.e)?.points[this.cible.i] ?? null) : null;
  }
  /** Le point de définition d'une courbe du niveau de travail le plus proche. */
  private trouver(p: Pt): { e: Entite; i: number } | null {
    let meilleur: { e: Entite; i: number; d: number } | null = null;
    for (const e of visibles(this.ctx)) {
      if (e.niveau !== this.at.niveau) continue;
      const d = definitionCourbe(e);
      d?.points.forEach((q, i) => {
        const x = dist(p, q);
        if (x <= this.ctx.rayon() * 1.5 && (!meilleur || x < meilleur.d)) meilleur = { e, i, d: x };
      });
    }
    return meilleur ? { e: (meilleur as { e: Entite }).e, i: (meilleur as { i: number }).i } : null;
  }
  point(p: Pt) {
    if (this.mode === null) return;
    if (this.cible) {
      this.modifier(this.cible.e, (pts) => [...pts.slice(0, this.cible!.i + 1), p, ...pts.slice(this.cible!.i + 1)], 'insertion');
      this.cible = null;
      return;
    }
    const t = this.trouver(p);
    if (!t) {
      this.ctx.dire("Pas de point de courbe à cet endroit (sur le niveau de travail).");
      return;
    }
    const d = definitionCourbe(t.e)!;
    if (this.mode === '+') {
      if (t.i === d.points.length - 1 && !d.fermee) return this.ctx.dire('Impossible d\'insérer après le dernier point.');
      if (d.points.length >= MAX_POINTS) return this.ctx.dire(`${MAX_POINTS} points maxi.`);
      this.cible = t;
      return;
    }
    if (d.points.length <= 3) return this.ctx.dire('La courbe doit garder au moins trois points.');
    if (!d.fermee && (t.i === 0 || t.i === d.points.length - 1)) return this.ctx.dire('Impossible de supprimer le premier ou le dernier point.');
    this.modifier(t.e, (pts) => pts.filter((_, i) => i !== t.i), 'suppression');
  }
  private modifier(e: Entite, f: (pts: Pt[]) => Pt[], quoi: string) {
    const d = definitionCourbe(e)!;
    const nouvelle = entiteCourbe(f(d.points), d.methode, d.fermee, d.tangentes, { niveau: e.niveau, trait: e.trait });
    this.ctx.dessin.remplacerEntite(e, [{ ...nouvelle, couleur: e.couleur, calque: e.calque }]);
    this.ctx.dire(`Courbe recalculée après ${quoi} d'un point.`);
  }
  abandon() {
    if (this.cible) {
      this.cible = null;
      return false;
    }
    this.mode = null;
    return true;
  }
}

/** C15 — Traits d'axes perpendiculaires (toujours en trait mixte fin). */
export class TraitsAxes extends Base {
  readonly nom = "Traits d'axes perpendiculaires";
  readonly code = 'C15';
  invite() {
    return this.pts.length === 0 ? "Traits d'axes perpendiculaires. Désigner le centre." : "Traits d'axes perpendiculaires. Désigner l'extrémité d'un axe.";
  }
  dernierPoint() {
    return this.pts[0] ?? null;
  }
  traitElastique(): Trait {
    return 'mixte-fin';
  }
  point(p: Pt) {
    if (this.pts.length === 0) {
      this.pts = [p];
      return;
    }
    const prims = traitsAxes(this.pts[0], p);
    if (prims.length) this.ajouter(entite('axes', prims, [{ p: this.pts[0], type: 'intersection' }], { niveau: this.at.niveau, trait: 'mixte-fin' }));
    this.pts = [];
  }
  elastique(r: Pt): Primitive[] {
    return this.pts[0] ? traitsAxes(this.pts[0], r) : [];
  }
}

enregistrerFonctions({
  C1: EllipseProjection,
  C2: EllipseAxes,
  C3: EllipseConjugues,
  C4: QuartEllipse,
  C5: DemiEllipse,
  C6: Polyligne,
  C7: CourbeLissee,
  C8: CourbeInterpolee,
  C9: PointCourbe,
  C15: TraitsAxes,
});
