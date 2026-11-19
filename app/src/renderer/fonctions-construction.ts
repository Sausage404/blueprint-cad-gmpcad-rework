// Ligne 3 (construction), ligne 1 (textes et cotes) et ligne 5 (réglages) de la palette.
// Ordre des questions et textes repris de l'aide d'origine.
import { cotation } from './cotation';
import { TRAITS } from './traits';
import {
  chanfrein,
  coteDiametre,
  coteLineaire,
  coteRayon,
  distanceDroite,
  parallele,
  paralleleTangente,
  perpendiculaire,
  pointsEquidistants,
  raccordement,
  tangente,
  type Coin,
  type Rond,
} from './construction';
import type { Entite } from './dessin';
import { eclater, entiteProche, primitiveProche } from './edition';
import { chaineContour, cercleTriTangent, contourParallele, coteDe, objetDe, raccordGeneral, symbolePoint, type Objet } from './construction-avancee';
import { symboles } from './cotes';
import { enregistrerFonctions, type Contexte, type Fonction, type Question, visibles } from './fonctions';
import { descriptionNiveaux } from './fonctions-gestion';
import { FORMATS } from './formats';
import { dist, nombre, type Pt } from './geometrie';
import { distance as distancePrimitive, intersections, type AlignH, type Primitive } from './primitives';

type Seg = { a: Pt; b: Pt };

/** Base : une suite de désignations (points ou entités), puis des questions, puis l'action. */
abstract class Suite implements Fonction {
  abstract readonly nom: string;
  abstract readonly code: string;
  protected pts: Pt[] = [];
  protected reponses: (number | string)[] = [];
  constructor(protected ctx: Contexte) {}

  /** Invites des points à désigner, dans l'ordre. */
  protected abstract etapes(): string[];
  protected questions(): Question[] {
    return [];
  }
  /** Les points désignés sont-ils des entités (petit réticule) ? */
  protected entites(): boolean[] {
    return this.etapes().map(() => false);
  }
  /** Contrôle d'un point désigné ; renvoie un message d'erreur pour le refuser. */
  protected verifier(_i: number, _p: Pt): string | null {
    return null;
  }
  protected abstract appliquer(): void;
  /** Questions posées avant les points (ex. rayon de raccordement). */
  protected questionsAvant(): Question[] {
    return [];
  }
  protected avant: (number | string)[] = [];

  invite(): string {
    return this.etapes()[this.pts.length] ?? '';
  }
  question(): Question | null {
    const qa = this.questionsAvant();
    if (this.avant.length < qa.length) return qa[this.avant.length];
    if (this.pts.length < this.etapes().length) return null;
    return this.questions()[this.reponses.length] ?? null;
  }
  valeur(v: number | string): void {
    if (this.avant.length < this.questionsAvant().length) {
      this.avant.push(v);
      return;
    }
    this.reponses.push(v);
    if (this.reponses.length >= this.questions().length) this.terminer();
  }
  attente(): 'point' | 'entite' {
    return this.entites()[this.pts.length] ? 'entite' : 'point';
  }
  dernierPoint(): Pt | null {
    return null;
  }
  point(p: Pt): void {
    const erreur = this.verifier(this.pts.length, p);
    if (erreur) {
      this.ctx.dire(erreur);
      return;
    }
    this.pts.push(p);
    if (this.pts.length >= this.etapes().length && this.questions().length === 0) this.terminer();
  }
  protected terminer(): void {
    this.appliquer();
    this.pts = [];
    this.reponses = [];
  }
  abandon(): boolean {
    const auDebut = this.pts.length === 0 && this.avant.length === 0;
    this.pts = [];
    this.reponses = [];
    this.avant = [];
    return auDebut;
  }
  elastique(_r: Pt): Primitive[] {
    return [];
  }

  // ---- Aides

  protected entite(p: Pt): Entite | null {
    return entiteProche(visibles(this.ctx), p, this.ctx.rayon());
  }
  /** Le segment désigné (et son entité), ou null. */
  protected segment(p: Pt): { e: Entite; i: number; s: Seg } | null {
    const e = this.entite(p);
    if (!e) return null;
    const i = primitiveProche(e, p);
    const prim = e.primitives[i];
    return prim.type === 'segment' ? { e, i, s: prim } : null;
  }
  /** Le cercle ou l'arc désigné, sinon le point lui-même (rayon 0 : « point de passage »). */
  protected rond(p: Pt): Rond {
    const e = this.entite(p);
    if (e) {
      const prim = e.primitives[primitiveProche(e, p)];
      if (prim.type === 'cercle' || prim.type === 'arc') return { c: prim.c, r: prim.r };
      if (prim.type === 'point') return { c: prim.p, r: 0 };
    }
    return { c: p, r: 0 };
  }
  /** L'entité désignée comme objet de tangence (segment, cercle, arc), sinon le point désigné lui-même. */
  protected objet(p: Pt): Objet | null {
    const e = this.entite(p);
    if (!e) return { type: 'point', p };
    return objetDe(e.primitives[primitiveProche(e, p)]);
  }
  protected get at() {
    return this.ctx.attributs();
  }
  protected memoire(cle: string, defaut: number): number {
    return this.ctx.memoire.get(cle) ?? defaut;
  }
  protected nouvelle(prims: Primitive[], genre: Entite['genre'] = 'segment'): Entite {
    return { genre, primitives: prims, extras: [], ...this.at };
  }
}

const num = (v: number | string | undefined, defaut = 0) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.')) || defaut);

/** Remplace deux segments (dans leurs entités) par leurs versions coupées, et ajoute le chanfrein ou l'arc. */
function appliquerCoin(ctx: Contexte, a: { e: Entite; i: number }, b: { e: Entite; i: number }, coin: Coin): void {
  const remplacer = (x: { e: Entite; i: number }, s: Seg) => {
    const morceaux = x.e.primitives.length > 1 ? eclater(x.e) : [x.e];
    const cible = morceaux[x.i];
    ctx.dessin.remplacerEntite(x.e, morceaux.map((m) => (m === cible ? { ...cible, genre: 'segment' as const, primitives: [{ type: 'segment' as const, a: s.a, b: s.b }] } : m)));
  };
  remplacer(a, coin.s1);
  if (b.e === a.e && a.e.primitives.length === 1) return;
  // L'entité b a pu être éclatée par le remplacement de a : on la retrouve par sa primitive.
  const prim = b.e.primitives[b.i];
  const eb = ctx.dessin.toutes.find((e) => e.primitives.includes(prim)) ?? b.e;
  remplacer({ e: eb, i: eb.primitives.indexOf(prim) }, coin.s2);
  if (coin.ajout) ctx.dessin.ajouter({ genre: coin.ajout.type === 'arc' ? 'arc' : 'segment', primitives: [coin.ajout], extras: [], ...ctx.attributs() });
}

// ======================================================================= Ligne 3 : construction

/** D10 — Chanfrein entre deux segments : longueur (0 : prolonger jusqu'à l'intersection), puis angle. */
class Chanfrein extends Suite {
  readonly nom = 'Chanfrein';
  readonly code = 'D10';
  protected etapes() {
    return ['Chanfrein. Désigner les segments.', 'Chanfrein. Désigner le deuxième segment.'];
  }
  protected entites() {
    return [true, true];
  }
  protected verifier(_i: number, p: Pt) {
    return this.segment(p) ? null : 'Désigner un segment.';
  }
  protected questions(): Question[] {
    const q: Question[] = [{ texte: 'Longueur du chanfrein', defaut: this.memoire('chanfrein', 0) }];
    if (this.reponses.length >= 1 && num(this.reponses[0]) <= 0) return q; // longueur nulle : pas d'angle
    return [...q, { texte: 'Angle du chanfrein', defaut: this.memoire('angleChanfrein', 45) }];
  }
  protected appliquer() {
    const a = this.segment(this.pts[0]);
    const b = this.segment(this.pts[1]);
    if (!a || !b || a.s === b.s) return;
    const l = num(this.reponses[0]);
    const ang = num(this.reponses[1], 45);
    this.ctx.memoire.set('chanfrein', l);
    if (l > 0) this.ctx.memoire.set('angleChanfrein', ang);
    const coin = chanfrein(a.s, this.pts[0], b.s, this.pts[1], l, ang);
    if (!coin) this.ctx.dire('Chanfrein trop grand. ');
    else appliquerCoin(this.ctx, a, b, coin);
  }
}

/** D11 — Raccordement de deux segments par un arc (rayon demandé d'abord ; 0 : coin vif). */
class Raccordement extends Suite {
  readonly nom = 'Raccordement';
  readonly code = 'D11';
  protected questionsAvant(): Question[] {
    return [{ texte: 'Rayon de raccordement [-R : complément]', defaut: this.memoire('raccordement', 0) }];
  }
  protected etapes() {
    return ['Raccordement. Désigner la première entité (segment, arc ou point).', 'Raccordement. Désigner la deuxième entité.'];
  }
  protected entites() {
    return [true, true];
  }
  protected appliquer() {
    const r = num(this.avant[0]);
    this.ctx.memoire.set('raccordement', r);
    const a = this.segment(this.pts[0]);
    const b = this.segment(this.pts[1]);
    // Deux segments : les segments sont coupés ou prolongés jusqu'au congé (ou au coin si r = 0).
    if (a && b && r >= 0) {
      if (a.s === b.s) return;
      const coin = raccordement(a.s, this.pts[0], b.s, this.pts[1], r);
      if (!coin) this.ctx.dire('Rayon trop grand. ');
      else appliquerCoin(this.ctx, a, b, coin);
      return;
    }
    // Arcs, points, ou rayon négatif (arc complémentaire) : le congé est ajouté, les entités restent en l'état.
    if (Math.abs(r) < 1e-9) return this.ctx.dire('Rayon nul : seuls deux segments peuvent être prolongés jusqu\'à leur intersection.');
    const o1 = this.objet(this.pts[0]);
    const o2 = this.objet(this.pts[1]);
    const res = o1 && o2 ? raccordGeneral(o1, this.pts[0], o2, this.pts[1], r) : null;
    if (!res) return this.ctx.dire('Rayon trop grand ou raccordement impossible. ');
    this.ctx.dessin.ajouter({ ...this.nouvelle([res.arc], 'arc'), extras: [{ p: res.arc.c, type: 'extremite' }] });
  }
  abandon(): boolean {
    const auDebut = this.avant.length === 0;
    super.abandon();
    return auDebut;
  }
}

/** D12 — Tangente à deux arcs ou points : la position des points désignés choisit la tangente. */
class Tangente extends Suite {
  readonly nom = 'Tangente';
  readonly code = 'D12';
  protected etapes() {
    return ['Tangente. Désigner la première entité (cercle, ellipse ou point).', 'Tangente. Désigner la deuxième entité.'];
  }
  protected appliquer() {
    const t = tangente(this.rond(this.pts[0]), this.pts[0], this.rond(this.pts[1]), this.pts[1]);
    if (t) this.ctx.dessin.ajouter(this.nouvelle([{ type: 'segment', ...t }]));
    else this.ctx.dire('Pas de tangente possible.');
  }
}

/** D13 — Perpendiculaire à un segment, passant par un point ou tangente à un cercle. */
class Perpendiculaire extends Suite {
  readonly nom = 'Perpendiculaire';
  readonly code = 'D13';
  protected etapes() {
    return ['Perpendiculaire. Désigner un segment.', 'Perpendiculaire. Désigner un cercle, une ellipse ou un point.'];
  }
  protected entites() {
    return [true, false];
  }
  protected verifier(i: number, p: Pt) {
    return i === 0 && !this.segment(p) ? 'Désigner un segment.' : null;
  }
  protected appliquer() {
    const s = this.segment(this.pts[0]);
    if (!s) return;
    const p = perpendiculaire(s.s, this.rond(this.pts[1]), this.pts[1]);
    if (p) this.ctx.dessin.ajouter(this.nouvelle([{ type: 'segment', ...p }]));
  }
}

/** D14 — Parallèle à un segment, tangente à un arc ou passant par un point. */
class ParalleleTangente extends Suite {
  readonly nom = 'Parallèle tangente à un arc';
  readonly code = 'D14';
  protected etapes() {
    return ['Parallèle tangente à un arc. Désigner un segment.', 'Parallèle tangente à un arc. Désigner un cercle, une ellipse ou un point.'];
  }
  protected entites() {
    return [true, false];
  }
  protected verifier(i: number, p: Pt) {
    return i === 0 && !this.segment(p) ? 'Désigner un segment.' : null;
  }
  protected appliquer() {
    const s = this.segment(this.pts[0]);
    if (s) this.ctx.dessin.ajouter(this.nouvelle([{ type: 'segment', ...paralleleTangente(s.s, this.rond(this.pts[1]), this.pts[1]) }]));
  }
}

/** D15 — Parallèle à un segment à une distance donnée (par défaut : la distance du point désigné). */
class ParalleleDistance extends Suite {
  readonly nom = 'Parallèle à une distance donnée';
  readonly code = 'D15';
  protected etapes() {
    return ['Parallèle. Désigner un segment.', 'Parallèle. Désigner le demi-plan.'];
  }
  protected entites() {
    return [true, false];
  }
  protected verifier(i: number, p: Pt) {
    return i === 0 && !this.segment(p) ? 'Désigner un segment.' : null;
  }
  protected questions(): Question[] {
    const s = this.segment(this.pts[0]);
    return [{ texte: 'Distance de la parallèle au segment désigné', defaut: s ? Number(nombre(distanceDroite(s.s, this.pts[1]))) : 0 }];
  }
  protected appliquer() {
    const s = this.segment(this.pts[0]);
    const d = num(this.reponses[0]);
    if (s && d > 0) this.ctx.dessin.ajouter(this.nouvelle([{ type: 'segment', ...parallele(s.s, this.pts[1], d) }]));
  }
  elastique(r: Pt): Primitive[] {
    const s = this.pts.length === 1 ? this.segment(this.pts[0]) : null;
    return s ? [{ type: 'segment', ...parallele(s.s, r, distanceDroite(s.s, r)) }] : [];
  }
}

/** D18 — Création d'un point par désignation. */
class PointDesigne extends Suite {
  readonly nom = 'Création de point';
  readonly code = 'D18';
  protected etapes() {
    return ['Création de point. Désigner un point.'];
  }
  protected appliquer() {
    this.ctx.dessin.ajouter(entitePoint(this.ctx, this.pts[0]));
  }
}

/** D19 — Points équidistants sur un segment, un arc ou un cercle. */
class PointsEquidistants extends Suite {
  readonly nom = 'Points équidistants';
  readonly code = 'D19';
  private prim(): Primitive | null {
    const e = this.entite(this.pts[0]);
    return e ? e.primitives[primitiveProche(e, this.pts[0])] : null;
  }
  protected etapes() {
    const p = this.pts.length ? this.prim() : null;
    return p?.type === 'cercle' ? ["Points équidistants. Désigner l'entité.", 'Désigner par un point le rayon origine.'] : ["Points équidistants. Désigner l'entité."];
  }
  protected entites() {
    return [true, false];
  }
  protected verifier(i: number, p: Pt) {
    if (i > 0) return null;
    const e = this.entite(p);
    const prim = e?.primitives[primitiveProche(e, p)];
    return prim && (prim.type === 'segment' || prim.type === 'arc' || prim.type === 'cercle') ? null : 'Désigner un segment, un arc ou un cercle.';
  }
  protected questions(): Question[] {
    return [{ texte: 'Nombre de points de division', defaut: this.prim()?.type === 'cercle' ? 2 : 1, entier: true }];
  }
  protected appliquer() {
    const p = this.prim();
    if (!p) return;
    const pts = pointsEquidistants(p, Math.round(num(this.reponses[0], 1)), this.pts[1]);
    this.ctx.dessin.ajouterPlusieurs(pts.map((q) => entitePoint(this.ctx, q)));
  }
}

/** D20 — Point d'intersection de deux entités (le plus proche du second point désigné). */
class PointIntersection extends Suite {
  readonly nom = "Point d'intersection";
  readonly code = 'D20';
  protected etapes() {
    return ["Point d'intersection. Désigner la première entité.", "Point d'intersection. Désigner la deuxième entité."];
  }
  protected entites() {
    return [true, true];
  }
  protected verifier(_i: number, p: Pt) {
    return this.entite(p) ? null : 'Désigner une entité.';
  }
  protected appliquer() {
    const prim = (p: Pt) => {
      const e = this.entite(p)!;
      return e.primitives[primitiveProche(e, p)];
    };
    const xs = intersections(prim(this.pts[0]), prim(this.pts[1]));
    if (xs.length === 0) {
      this.ctx.dire("Pas de point d'intersection. ");
      return;
    }
    xs.sort((a, b) => dist(a, this.pts[1]) - dist(b, this.pts[1]));
    this.ctx.dessin.ajouter(entitePoint(this.ctx, xs[0]));
  }
}

// ======================================================================= Ligne 1 : textes et cotes

/** B5 — Écriture d'une ligne de texte, avec les caractéristiques en cours (B8 pour les changer). */
class Texte extends Suite {
  readonly nom = "Écriture d'un texte";
  readonly code = 'B5';
  protected etapes() {
    const h = this.memoire('hauteurTexte', 3.5);
    const a = this.memoire('angleTexte', 0);
    const j = ['à gauche', 'centré', 'à droite'][this.memoire('justification', 0)];
    return [`Texte. Désigner le point de référence. (hauteur ${nombre(h)}, inclinaison ${nombre(a)}°, ${j})`];
  }
  protected questions(): Question[] {
    return [{ texte: 'Texte', defaut: '', type: 'texte' }];
  }
  protected appliquer() {
    const t = symboles(String(this.reponses[0] ?? ''));
    if (!t.trim()) return;
    const alignH: AlignH = (['gauche', 'centre', 'droite'] as const)[this.memoire('justification', 0)];
    this.ctx.dessin.ajouter(
      this.nouvelle([{ type: 'texte', p: this.pts[0], h: this.memoire('hauteurTexte', 3.5), angle: this.memoire('angleTexte', 0), texte: t, alignH, alignV: 'ligne' }], 'texte'),
    );
  }
}

/** B8 — Modification des caractéristiques du texte : hauteur, inclinaison, justification. */
class CaracteristiquesTexte extends Suite {
  readonly nom = 'Caractéristiques du texte';
  readonly code = 'B8';
  readonly ponctuelle = true;
  private fini = false;
  protected questionsAvant(): Question[] {
    return [
      { texte: 'Hauteur des caractères (mm)', defaut: this.memoire('hauteurTexte', 3.5) },
      { texte: 'Inclinaison (degrés)', defaut: this.memoire('angleTexte', 0) },
      { texte: 'Justification [G/C/D]', defaut: 'GCD'[this.memoire('justification', 0)], type: 'texte' },
    ];
  }
  protected etapes() {
    return [];
  }
  valeur(v: number | string) {
    super.valeur(v);
    if (this.avant.length === 3) {
      const h = num(this.avant[0], 3.5);
      if (h > 0) this.ctx.memoire.set('hauteurTexte', h);
      this.ctx.memoire.set('angleTexte', num(this.avant[1], 0));
      this.ctx.memoire.set('justification', Math.max(0, 'GCD'.indexOf(String(this.avant[2]).trim().toUpperCase()[0] ?? 'G')));
      this.fini = true;
    }
  }
  termine() {
    return this.fini;
  }
  protected appliquer() {}
}

/** B9 — Cote linéaire : deux points (repérés), puis la position de la ligne de cote. */
class CoteLineaire extends Suite {
  readonly nom = 'Cotation linéaire';
  readonly code = 'B9';
  protected etapes() {
    return ['Cotation linéaire. Désigner une entité ou un point.', 'Cotation linéaire. Désigner une autre entité ou un point.', 'Cotation linéaire. Désigner la position de la ligne de cote.'];
  }
  protected appliquer() {
    const [a, b, p] = this.pts;
    if (dist(a, b) < 1e-9) return;
    this.ctx.dessin.ajouter({ ...this.nouvelle(coteLineaire(a, b, p, cotation.hauteur), 'cote'), trait: 'continu-fin' });
  }
  elastique(r: Pt): Primitive[] {
    return this.pts.length === 2 && dist(this.pts[0], this.pts[1]) > 1e-9 ? coteLineaire(this.pts[0], this.pts[1], r, cotation.hauteur) : [];
  }
}

/** B14 / B15 — Cote d'un diamètre ou d'un rayon : le cercle (point dessus), puis la position du texte. */
class CoteCercle extends Suite {
  constructor(
    ctx: Contexte,
    private diametre: boolean,
  ) {
    super(ctx);
  }
  get nom() {
    return this.diametre ? "Cotation d'un diamètre" : "Cotation d'un rayon";
  }
  get code() {
    return this.diametre ? 'B14' : 'B15';
  }
  protected etapes() {
    const t = this.diametre ? "Cotation d'un diamètre." : "Cotation d'un rayon.";
    return [`${t} Désigner l'arc ou le cercle.`, `${t} Désigner par un point la position de la ligne de cote.`];
  }
  protected entites() {
    return [true, false];
  }
  protected verifier(i: number, p: Pt) {
    return i === 0 && this.rond(p).r === 0 ? "Désigner l'arc ou le cercle." : null;
  }
  private forme(pos: Pt): Primitive[] {
    const k = this.rond(this.pts[0]);
    return this.diametre ? coteDiametre(k, this.pts[0], pos, cotation.hauteur) : coteRayon(k, this.pts[0], pos, cotation.hauteur);
  }
  protected appliquer() {
    this.ctx.dessin.ajouter({ ...this.nouvelle(this.forme(this.pts[1]), 'cote'), trait: 'continu-fin' });
  }
  elastique(r: Pt): Primitive[] {
    return this.pts.length === 1 ? this.forme(r) : [];
  }
}
class CoteDiametre extends CoteCercle {
  constructor(ctx: Contexte) {
    super(ctx, true);
  }
}
class CoteRayon extends CoteCercle {
  constructor(ctx: Contexte) {
    super(ctx, false);
  }
}

// ======================================================================= Ligne 5 : gestion (sans quitter la fonction en cours)

abstract class Reglage extends Suite {
  readonly ponctuelle = true;
  protected fini = false;
  termine() {
    return this.fini;
  }
  protected terminer() {
    super.terminer();
    this.fini = true;
  }
  valeur(v: number | string) {
    super.valeur(v);
    if (this.etapes().length === 0 && this.avant.length >= this.questionsAvant().length && this.questions().length === 0) this.terminer();
  }
}

/** F5 — Examen des caractéristiques d'une entité. */
class Examen extends Reglage {
  readonly nom = "Examen d'une entité";
  readonly code = 'F5';
  protected etapes() {
    return ["Examen d'une entité. Désigner l'entité."];
  }
  protected entites() {
    return [true];
  }
  protected appliquer() {
    const e = this.entite(this.pts[0]);
    if (!e) {
      this.ctx.dire("Pas d'entité à cet endroit.");
      return;
    }
    const rang = this.ctx.dessin.toutes.indexOf(e) + 1;
    if (e.genre === 'jointe') {
      this.ctx.dire(`Pièce jointe. Entité ${rang}, niveau ${e.niveau}. Liée à "${String(e.params?.fichier ?? '')}" (Fichier > Pièces jointes > Consulter).`);
      return;
    }
    // Comme l'original : « Segment l=112.5, Entité 14, niveau 2, trait pointillé fin. »
    const p = e.primitives[primitiveProche(e, this.pts[0])];
    const noms: Record<string, string> = { segment: 'Segment', droite: 'Droite', 'demi-droite': 'Demi-droite', cercle: 'Cercle', arc: 'Arc', texte: 'Texte', point: 'Point' };
    let detail = noms[e.genre] ?? e.genre.charAt(0).toUpperCase() + e.genre.slice(1);
    if (p.type === 'segment') detail += ` l=${nombre(dist(p.a, p.b))}`;
    else if (p.type === 'cercle') detail += ` Ø=${nombre(2 * p.r)}`;
    else if (p.type === 'arc') detail += ` R=${nombre(p.r)}, de ${nombre(p.debut)}° à ${nombre(p.fin)}°`;
    else if (p.type === 'texte') detail += ` « ${p.texte} », h=${nombre(p.h)}`;
    const nom = e.genre === 'groupe' ? (e.params?.designation ? ` « ${String(e.params.designation)} »` : '') : '';
    this.ctx.dire(`${detail}${nom}, Entité ${rang}, niveau ${e.niveau}, trait ${TRAITS[e.trait]?.nom ?? e.trait}.`);
  }
}

/** F10 — Zoom sur une fenêtre définie par deux points. */
class Zoom extends Reglage {
  readonly nom = 'Zoom';
  readonly code = 'F10';
  protected etapes() {
    return ['Zoom. Définir la fenêtre par 2 points (déf, la même).', 'Zoom. Désigner le deuxième point de la diagonale.'];
  }
  parDefaut() {
    const f = this.ctx.actions?.derniereFenetre();
    if (f) {
      this.ctx.actions?.zoomFenetre(f[0], f[1]);
      this.fini = true;
    }
  }
  protected appliquer() {
    if (dist(this.pts[0], this.pts[1]) > 1e-9) this.ctx.actions?.zoomFenetre(this.pts[0], this.pts[1]);
  }
  traitElastique() {
    return 'continu-fin' as const;
  }
  elastique(r: Pt): Primitive[] {
    if (this.pts.length !== 1) return [];
    const a = this.pts[0];
    const c = [a, { x: r.x, y: a.y }, r, { x: a.x, y: r.y }];
    return c.map((q, i) => ({ type: 'segment' as const, a: q, b: c[(i + 1) % 4] }));
  }
}

/** F17 — Changement du niveau de travail (numéro tapé, ou un trait du niveau désigné). */
class NiveauTravail extends Reglage {
  readonly nom = 'Changement du niveau de travail';
  readonly code = 'F17';
  protected questionsAvant(): Question[] {
    return [{ texte: 'Niveau de travail [?]', defaut: 'tt', type: 'texte' }];
  }
  protected etapes() {
    return [];
  }
  attente(): 'entite' {
    return 'entite';
  }
  point(p: Pt) {
    // Désigner un trait du niveau voulu, au lieu de taper son numéro.
    const e = this.entite(p);
    if (e) this.changer(e.niveau);
  }
  valeur(v: number | string) {
    const t = String(v).trim().toLowerCase();
    if (t === '?') return this.ctx.dire(descriptionNiveaux(this.ctx));
    const n = t === 'tt' || t === '' ? this.at.niveau : Math.round(num(t, 0));
    this.changer(n);
  }
  private changer(n: number) {
    if (n < 1 || n > 99) {
      this.ctx.dire('Niveau incorrect (1 à 99).');
      return;
    }
    this.ctx.actions?.niveau(n);
    this.fini = true;
    this.ctx.dire(`Niveau ${n}, échelle ${nombre(this.ctx.dessin.echelleNiveau(n))}`);
  }
  protected appliquer() {}
}

/** F18 — Modification de la grille : pas, puis origine (déf, la même). */
class Grille extends Reglage {
  readonly nom = 'Grille';
  readonly code = 'F18';
  protected questionsAvant(): Question[] {
    return [{ texte: 'Pas de la grille', defaut: this.ctx.actions?.pasGrille() ?? 1 }];
  }
  protected etapes() {
    return [`Pas de ${nombre(num(this.avant[0], 1))}. Désigner le point origine (déf, le même).`];
  }
  parDefaut() {
    this.ctx.actions?.grille(num(this.avant[0], 1), null);
    this.fini = true;
  }
  protected appliquer() {
    this.ctx.actions?.grille(num(this.avant[0], 1), this.pts[0]);
  }
}

/** F2 — Modification du format du plan (A0 à A4, horizontal ou vertical). */
class FormatPlan extends Reglage {
  readonly nom = 'Format et échelle du plan';
  readonly code = 'F2';
  protected questionsAvant(): Question[] {
    return [{ texte: `Format [${FORMATS.map((f) => f.nom).join(' ')}]`, defaut: this.ctx.actions?.format() ?? 'A4H', type: 'texte' }];
  }
  protected etapes() {
    return [];
  }
  valeur(v: number | string) {
    const nom = String(v).trim().toUpperCase();
    if (!FORMATS.some((f) => f.nom === nom)) {
      this.ctx.dire(`Format inconnu : ${nom}.`);
      return;
    }
    this.ctx.actions?.changerFormat(nom);
    this.fini = true;
  }
  protected appliquer() {}
}

/** Un point créé (D18 à D20), avec le symbole et la dimension choisis par D17 ; trait fort ou fin selon le trait en cours. */
function entitePoint(ctx: Contexte, p: Pt): Entite {
  const at = ctx.attributs();
  const type = ctx.memoire.get('typePoint') ?? 1;
  return {
    genre: 'point',
    primitives: symbolePoint(p, type, ctx.memoire.get('taillePoint') ?? 4),
    extras: type === 1 ? [] : [{ p, type: 'extremite' }],
    niveau: at.niveau,
    trait: TRAITS[at.trait].fort ? 'continu-fort' : 'continu-fin',
  };
}

/** D6 — Cercle tri-tangent : trois entités (segment, arc, cercle ou point repéré). */
class CercleTriTangent extends Suite {
  readonly nom = 'Cercle tri-tangent';
  readonly code = 'D6';
  protected etapes() {
    return ['Cercle tri-tangent. Désigner la première entité (segment, arc ou point).', 'Cercle tri-tangent. Désigner la deuxième entité.', 'Cercle tri-tangent. Désigner la troisième entité.'];
  }
  protected entites() {
    return [true, true, true];
  }
  protected appliquer() {
    const objets = this.pts.map((p) => this.objet(p));
    if (objets.some((o) => !o)) return this.ctx.dire('Désigner un segment, un arc, un cercle ou un point.');
    const k = cercleTriTangent(objets as [Objet, Objet, Objet], this.pts as [Pt, Pt, Pt]);
    if (!k) return this.ctx.dire('Cercle tangent impossible.');
    this.ctx.dessin.ajouter(this.nouvelle([{ type: 'cercle', c: k.c, r: k.r }], 'cercle'));
  }
}

/** D16 — Contour parallèle à un contour de segments, arcs, polylignes ou courbes. */
class ContourParallele extends Suite {
  readonly nom = 'Contour parallèle';
  readonly code = 'D16';
  protected etapes() {
    return [
      'Contour parallèle. Désigner le point de début du contour.',
      'Contour parallèle. Désigner le point de la fin du contour.',
      'Contour parallèle. Désigner la première entité du contour.',
      'Contour parallèle. Définir par un point et pour la première entité, le côté à paralléliser.',
    ];
  }
  protected entites() {
    return [false, false, true, false];
  }
  protected verifier(i: number, p: Pt) {
    return i === 2 && !this.entite(p) ? 'Désigner la première entité (segment, arc, polyligne ou courbe).' : null;
  }
  /** Le contour de base reconnu à partir des points désignés. */
  private chaine() {
    const e = this.entite(this.pts[2]);
    if (!e) return [];
    const toutes = visibles(this.ctx).flatMap((x) => x.primitives.filter((q) => q.type === 'segment' || q.type === 'arc'));
    // La première entité : celle de ses primitives qui touche le point de début.
    const premieres = e.primitives.filter((q) => q.type === 'segment' || q.type === 'arc');
    for (const q of premieres) {
      const c = chaineContour(toutes, this.pts[0], this.pts[1], q, Math.max(1e-4, this.ctx.rayon() / 50));
      if (c.length) return c;
    }
    return [];
  }
  protected questions(): Question[] {
    const premiere = this.entite(this.pts[2]);
    const d = premiere ? Math.min(...premiere.primitives.map((q) => distancePrimitive(this.pts[3], q))) : 0;
    return [
      { texte: 'Distance entre les contours', defaut: Number(nombre(d)) },
      { texte: 'Contournement des angles extérieurs [O/N]', defaut: 'N', type: 'texte' },
    ];
  }
  protected appliquer() {
    const chaine = this.chaine();
    if (chaine.length === 0) return this.ctx.dire('Contour non reconnu : le point de début doit être une extrémité de la première entité.');
    const d = num(this.reponses[0]);
    const contourner = String(this.reponses[1] ?? 'N').trim().toUpperCase().startsWith('O');
    const prims = contourParallele(chaine, coteDe(chaine, this.pts[3]), d, contourner);
    this.ctx.dessin.ajouterPlusieurs(prims.map((q) => this.nouvelle([q], q.type === 'arc' ? 'arc' : 'segment')));
    this.ctx.dire(`Contour parallèle : ${prims.length} élément${prims.length > 1 ? 's' : ''}.`);
  }
}

/** D17 — Choix du type de point (1 à 9) et de sa dimension (pas demandée pour le type 1). */
class TypePoint extends Reglage {
  readonly nom = 'Choix du type de point';
  readonly code = 'D17';
  private type(): number {
    return Math.min(9, Math.max(1, Math.round(num(this.avant[0], 1))));
  }
  protected questionsAvant(): Question[] {
    const q: Question[] = [{ texte: 'Type de point [1 - 9]', defaut: this.memoire('typePoint', 1), entier: true }];
    if (this.avant.length === 0 || this.type() !== 1) q.push({ texte: 'Dimension des points', defaut: this.memoire('taillePoint', 4) });
    return q;
  }
  protected etapes() {
    return [];
  }
  protected appliquer() {
    const type = this.type();
    this.ctx.memoire.set('typePoint', type);
    if (type !== 1) this.ctx.memoire.set('taillePoint', Math.min(10, Math.max(0.5, num(this.avant[1], 4))));
    this.ctx.dire('Caractéristiques des points modifiées.');
  }
}

enregistrerFonctions({
  D6: CercleTriTangent,
  D16: ContourParallele,
  D17: TypePoint,
  D10: Chanfrein,
  D11: Raccordement,
  D12: Tangente,
  D13: Perpendiculaire,
  D14: ParalleleTangente,
  D15: ParalleleDistance,
  D18: PointDesigne,
  D19: PointsEquidistants,
  D20: PointIntersection,
  B5: Texte,
  B8: CaracteristiquesTexte,
  B9: CoteLineaire,
  B14: CoteDiametre,
  B15: CoteRayon,
  F5: Examen,
  F10: Zoom,
  F17: NiveauTravail,
  F18: Grille,
  F2: FormatPlan,
});

