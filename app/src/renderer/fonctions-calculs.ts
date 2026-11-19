// Palette CALCULS (cases R16 à R20, S16 à S20 de l'original) : périmètre, surface, volumes, centre de gravité,
// moments quadratiques, moment d'inertie, distance maxi. Les contours se désignent comme pour le hachurage ;
// une fois choisis, Entrée les reprend pour le calcul suivant (aide d'origine, « Menu Calculs »).
import { basculerContour, distanceMaxi, ellipseCentrale, momentAxe, momentPolaire, momentsPrincipaux, proprietes, revolution, type Proprietes } from './calculs';
import { faceAutour } from './contours';
import { arcEllipse, relier } from './courbes';
import type { Entite } from './dessin';
import { enregistrerFonctions, visibles, type Contexte, type Fonction, type Question } from './fonctions';
import { dist, nombre, type Pt } from './geometrie';
import { definitionHachures } from './hachures';
import type { Primitive } from './primitives';
import { TRAITS_CONTOUR } from './traits';

/** Contours de la dernière sélection, repris par Entrée dans la fonction de calcul suivante. */
let derniereSelection: Pt[][] | null = null;
export const oublierSelection = () => (derniereSelection = null);

const n2 = (v: number) => nombre(v, 2);

/** Traits qui ferment un contour sur le niveau de travail (comme pour le hachurage). */
function traitsContour(ctx: Contexte): Primitive[] {
  const niveau = ctx.attributs().niveau;
  return visibles(ctx)
    .filter((e) => e.niveau === niveau && e.genre !== 'hachure' && e.genre !== 'texte' && e.genre !== 'cote' && e.genre !== 'image')
    .flatMap((e) => e.primitives.filter((_, i) => TRAITS_CONTOUR.includes(e.styles?.[i]?.trait ?? e.trait)));
}

/** Zone déjà hachurée : un de ses points désignés (point caractéristique) donne ses contours. */
function hachureEn(ctx: Contexte, p: Pt): Entite | null {
  for (const e of visibles(ctx)) {
    if (e.genre === 'hachure' && e.extras.some((x) => dist(x.p, p) <= ctx.rayon() * 1.5)) return e;
  }
  return null;
}

abstract class Calcul implements Fonction {
  abstract readonly nom: string;
  abstract readonly code: string;
  /** Début des messages, ex. « Périmètre ». */
  protected abstract readonly titre: string;
  private contours: Pt[][] = [];
  private choisis: Pt[][] | null = null;
  protected pts: Pt[] = [];
  protected reponses: (number | string)[] = [];
  constructor(protected ctx: Contexte) {}

  /** Points à désigner après les contours (axe, pôle, origine). */
  protected etapes(): string[] {
    return [];
  }
  /** Point par défaut (Entrée) d'une étape, s'il y en a un. */
  protected defautPoint(_i: number): Pt | null {
    return null;
  }
  protected questions(): Question[] {
    return [];
  }
  /** Le calcul : le message du résultat et la valeur principale (copiée pour être collée ailleurs). */
  protected abstract calculer(pr: Proprietes, contours: Pt[][]): { message: string; valeur: number } | null;

  invite(): string {
    if (this.choisis) return `${this.titre}. ${this.etapes()[this.pts.length] ?? ''}`;
    if (this.contours.length) return `${this.titre}. Choisir un autre contour (Entrée pour calculer).`;
    return `${this.titre}. Désigner un point à l'intérieur du contour.${derniereSelection ? ' (Entrée : les mêmes contours)' : ''}`;
  }
  attente(): 'point' | 'entite' {
    return this.choisis ? 'point' : 'entite';
  }
  question(): Question | null {
    if (!this.choisis || this.pts.length < this.etapes().length) return null;
    return this.questions()[this.reponses.length] ?? null;
  }
  valeur(v: number | string) {
    this.reponses.push(v);
    if (this.reponses.length >= this.questions().length) this.terminer();
  }
  dernierPoint(): Pt | null {
    return this.choisis ? (this.pts[this.pts.length - 1] ?? null) : null;
  }
  point(p: Pt) {
    if (this.choisis) {
      this.pts.push(p);
      this.suite();
      return;
    }
    const h = hachureEn(this.ctx, p);
    if (h) {
      for (const c of definitionHachures(h)?.contours ?? []) this.contours = basculerContour(this.contours, c);
      return;
    }
    const prims = traitsContour(this.ctx);
    if (prims.length === 0) return this.ctx.dire(`Le niveau ${this.ctx.attributs().niveau} ne contient ni segment, ni arc en trait fort.`);
    const c = faceAutour(prims, p);
    if (!c) return this.ctx.dire(`${this.titre}. Pas de contour fermé autour de ce point.`);
    this.contours = basculerContour(this.contours, c);
  }
  parDefaut() {
    if (!this.choisis) {
      const liste = this.contours.length ? this.contours : derniereSelection;
      if (!liste?.length) return this.ctx.dire(`${this.titre}. Désigner d'abord un point à l'intérieur du contour.`);
      derniereSelection = liste;
      this.choisis = liste;
      this.suite();
      return;
    }
    const d = this.defautPoint(this.pts.length);
    if (d && this.pts.length < this.etapes().length) {
      this.pts.push(d);
      this.suite();
    }
  }
  private suite() {
    if (this.pts.length >= this.etapes().length && this.questions().length === 0) this.terminer();
  }
  private terminer() {
    const contours = this.choisis ?? [];
    const pr = proprietes(contours);
    const r = pr ? this.calculer(pr, contours) : null;
    if (r) {
      this.ctx.dire(`${r.message}  Choisir un contour ou une autre fonction.`);
      this.ctx.actions?.copier?.(n2(r.valeur));
    } else this.ctx.dire('Calcul impossible.');
    this.contours = [];
    this.choisis = null;
    this.pts = [];
    this.reponses = [];
  }
  abandon(): boolean {
    const auDebut = !this.choisis && this.contours.length === 0;
    this.contours = [];
    this.choisis = null;
    this.pts = [];
    this.reponses = [];
    return auDebut;
  }
  elastique(r: Pt): Primitive[] {
    const z: Primitive[] = this.contours.flatMap((c) => relier(c, true, false));
    if (this.choisis && this.pts.length === 1 && this.etapes().length >= 2) z.push({ type: 'droite', a: this.pts[0], b: r });
    return z;
  }
  traitElastique() {
    return 'mixte-fin' as const;
  }
}

const axe = ["Définir l'axe par 2 points. Désigner le premier point.", "Désigner un deuxième point de l'axe."];
const surface = (a: number) => `${n2(a)} mm² (${n2(a / 100)} cm²)`;
const volume = (v: number) => `${n2(v)} mm³ (${n2(v / 1000)} cm³)`;
const moment4 = (i: number) => `${n2(i)} mm⁴ (${n2(i / 1e4)} cm⁴)`;

/** R16 — Périmètre (somme des contours). */
class Perimetre extends Calcul {
  readonly nom = 'Périmètre';
  readonly code = 'R16';
  protected readonly titre = 'Périmètre';
  protected calculer(pr: Proprietes) {
    return { message: `Périmètre : ${n2(pr.perimetre)} mm.`, valeur: pr.perimetre };
  }
}

/** R17 — Surface (un contour intérieur à un autre est un évidement). */
class Surface extends Calcul {
  readonly nom = 'Surface';
  readonly code = 'R17';
  protected readonly titre = 'Surface';
  protected calculer(pr: Proprietes) {
    return { message: `Surface : ${surface(Math.abs(pr.aire))}.`, valeur: Math.abs(pr.aire) };
  }
}

/** R18 — Volume d'une plaque : surface x épaisseur. */
class VolumePlaque extends Calcul {
  readonly nom = "Volume d'une plaque";
  readonly code = 'R18';
  protected readonly titre = "Volume d'une plaque";
  protected questions(): Question[] {
    return [{ texte: 'Épaisseur en mm', defaut: this.ctx.memoire.get('epaisseurPlaque') ?? 1 }];
  }
  protected calculer(pr: Proprietes) {
    const e = Number(this.reponses[0]) || 0;
    if (!(e > 0)) return null;
    this.ctx.memoire.set('epaisseurPlaque', e);
    const v = Math.abs(pr.aire) * e;
    return { message: `Volume d'une plaque : ${volume(v)}.`, valeur: v };
  }
}

/** R19 — Volume d'un solide de révolution (théorème de Guldin). */
class VolumeRevolution extends Calcul {
  readonly nom = "Volume d'un solide de révolution";
  readonly code = 'R19';
  protected readonly titre = "Volume d'un solide de révolution";
  protected etapes() {
    return axe;
  }
  protected calculer(_pr: Proprietes, contours: Pt[][]) {
    const [a, b] = this.pts;
    if (dist(a, b) < 1e-9) return null;
    const r = revolution(contours, a, b);
    const v = 2 * Math.PI * r.m1;
    return { message: `Volume de révolution : ${volume(v)}${r.deuxCotes ? " (profil des deux côtés de l'axe : un côté compté)" : ''}.`, valeur: v };
  }
}

/** R20 — Centre de gravité, mesuré depuis une origine (par défaut : celle de la grille). */
class CentreGravite extends Calcul {
  readonly nom = 'Centre de gravité';
  readonly code = 'R20';
  protected readonly titre = 'Centre de gravité';
  protected etapes() {
    return ["Désigner l'origine de mesure (déf, origine du plan)."];
  }
  protected defautPoint() {
    return this.ctx.actions?.origine?.() ?? { x: 0, y: 0 };
  }
  protected calculer(pr: Proprietes) {
    const o = this.pts[0];
    return { message: `Centre de gravité : XG = ${n2(pr.g.x - o.x)} mm,  YG = ${n2(pr.g.y - o.y)} mm.`, valeur: pr.g.x - o.x };
  }
}

/** S16 — Moment quadratique par rapport à un axe. */
class MomentQuadratique extends Calcul {
  readonly nom = 'Moment quadratique';
  readonly code = 'S16';
  protected readonly titre = 'Moment quadratique';
  protected etapes() {
    return axe;
  }
  protected calculer(pr: Proprietes) {
    const [a, b] = this.pts;
    if (dist(a, b) < 1e-9) return null;
    const i = Math.abs(momentAxe(pr, a, b));
    return { message: `Moment quadratique : ${moment4(i)}.`, valeur: i };
  }
}

/** S17 — Moment quadratique polaire (pôle par défaut : le centre de gravité). */
class MomentPolaire extends Calcul {
  readonly nom = 'Moment quadratique polaire';
  readonly code = 'S17';
  protected readonly titre = 'Moment quadratique polaire';
  protected etapes() {
    return ['Désigner le pôle de calcul (déf, C. de G.).'];
  }
  protected defautPoint() {
    // Le centre de gravité n'est connu qu'au calcul : un point repère, remplacé ensuite.
    return { x: Number.NaN, y: Number.NaN };
  }
  protected calculer(pr: Proprietes) {
    const o = Number.isNaN(this.pts[0].x) ? pr.g : this.pts[0];
    const i = Math.abs(momentPolaire(pr, o));
    return { message: `Moment quadratique polaire : ${moment4(i)}.`, valeur: i };
  }
}

/** S18 — Moments quadratiques principaux, et l'ellipse centrale d'inertie dessinée au centre de gravité. */
class MomentsPrincipaux extends Calcul {
  readonly nom = 'Moments quadratiques principaux';
  readonly code = 'S18';
  protected readonly titre = 'Moments quadratiques principaux';
  protected calculer(pr: Proprietes) {
    const m = momentsPrincipaux(pr);
    const el = ellipseCentrale(pr);
    const at = this.ctx.attributs();
    const pts = arcEllipse(el.c, el.u, el.v);
    const l = Math.max(Math.hypot(el.u.x, el.u.y), Math.hypot(el.v.x, el.v.y)) * 1.3;
    const t = (m.angle * Math.PI) / 180;
    const axes: Primitive[] = [
      { type: 'segment', a: { x: el.c.x - Math.cos(t) * l, y: el.c.y - Math.sin(t) * l }, b: { x: el.c.x + Math.cos(t) * l, y: el.c.y + Math.sin(t) * l } },
      { type: 'segment', a: { x: el.c.x + Math.sin(t) * l, y: el.c.y - Math.cos(t) * l }, b: { x: el.c.x - Math.sin(t) * l, y: el.c.y + Math.cos(t) * l } },
    ];
    this.ctx.dessin.ajouterPlusieurs([
      { genre: 'ellipse', primitives: relier(pts.slice(0, -1), true), extras: [{ p: el.c, type: 'milieu' }], niveau: at.niveau, trait: 'continu-fin' },
      { genre: 'axes', primitives: axes, extras: [], niveau: at.niveau, trait: 'mixte-fin' },
    ]);
    return {
      message: `Moments quadratiques principaux : 1 : ${n2(m.i1 / 1e4)} cm⁴, 2 : ${n2(m.i2 / 1e4)} cm⁴ (axe 1 incliné de ${n2(((m.angle % 180) + 180) % 180)}°).`,
      valeur: m.i1 / 1e4,
    };
  }
}

/** S19 — Moment d'inertie d'un solide de révolution autour de son axe. */
class MomentInertie extends Calcul {
  readonly nom = "Moment d'inertie";
  readonly code = 'S19';
  protected readonly titre = "Moment d'inertie";
  protected etapes() {
    return axe;
  }
  protected questions(): Question[] {
    return [{ texte: 'Masse volumique en kg/m3', defaut: this.ctx.memoire.get('masseVolumique') ?? 7900 }];
  }
  protected calculer(_pr: Proprietes, contours: Pt[][]) {
    const [a, b] = this.pts;
    const rho = Number(this.reponses[0]) || 0;
    if (dist(a, b) < 1e-9 || !(rho > 0)) return null;
    this.ctx.memoire.set('masseVolumique', rho);
    const r = revolution(contours, a, b);
    const kgParMm3 = rho * 1e-9;
    const j = 2 * Math.PI * kgParMm3 * r.m3; // kg·mm²
    const masse = 2 * Math.PI * kgParMm3 * r.m1;
    return { message: `Moment d'inertie : ${n2(j)} kg·mm² (${nombre(j * 1e-6, 6)} kg·m²), masse ${nombre(masse, 3)} kg.`, valeur: j };
  }
}

/** S20 — Distance maxi du centre de gravité au contour. */
class DistanceMaxi extends Calcul {
  readonly nom = 'Distance maxi au centre de gravité';
  readonly code = 'S20';
  protected readonly titre = 'Distance maxi au centre de gravité';
  protected calculer(pr: Proprietes, contours: Pt[][]) {
    const r = distanceMaxi(contours, pr.g);
    return { message: `R max : ${n2(r)} mm.`, valeur: r };
  }
}

/** Cases de la palette CALCULS, dans l'ordre (2 lignes de 5). */
export const CASES_CALCULS: { code: string; libelle: string }[] = [
  { code: 'R16', libelle: 'Périmètre.' },
  { code: 'R17', libelle: 'Surface.' },
  { code: 'R18', libelle: "Volume d'une plaque." },
  { code: 'R19', libelle: "Volume d'un solide de révolution." },
  { code: 'R20', libelle: 'Centre de gravité.' },
  { code: 'S16', libelle: 'Moment quadratique.' },
  { code: 'S17', libelle: 'Moment quadratique polaire.' },
  { code: 'S18', libelle: 'Moments quadratiques principaux.' },
  { code: 'S19', libelle: "Moment d'inertie." },
  { code: 'S20', libelle: 'Distance maxi au centre de gravité.' },
];

enregistrerFonctions({
  R16: Perimetre,
  R17: Surface,
  R18: VolumePlaque,
  R19: VolumeRevolution,
  R20: CentreGravite,
  S16: MomentQuadratique,
  S17: MomentPolaire,
  S18: MomentsPrincipaux,
  S19: MomentInertie,
  S20: DistanceMaxi,
});
