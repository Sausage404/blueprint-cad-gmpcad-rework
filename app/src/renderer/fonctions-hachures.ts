// Hachures (C16 à C20) : hachurage par désignation d'un point intérieur, reprise des caractéristiques,
// choix du motif, addition ou suppression d'un contour, affichage avec ou sans les hachures.
// Textes repris de l'aide d'origine (rubriques HACHURAGE, CHOIX HACHURAGE…).
import { TRAITS_CONTOUR } from './traits';
import { contourVersEst } from './contours';
import { relier } from './courbes';
import type { Entite } from './dessin';
import { Base, enregistrerFonctions, type Contexte, type Question, visibles } from './fonctions';
import { dist, nombre, type Pt } from './geometrie';
import { definitionHachures, entiteHachures, MOTIFS, nomMotif, type Motif, type ReglageHachures } from './hachures';
import type { Primitive } from './primitives';

const reglages = (ctx: Contexte) => (ctx.reglages ??= { motifHachure: 'tout', afficherHachures: true });

function reglageCourant(ctx: Contexte): ReglageHachures {
  return { motif: reglages(ctx).motifHachure, distance: ctx.memoire.get('hachure-distance') ?? 4, angle: ctx.memoire.get('hachure-angle') ?? 45 };
}

const resume = (r: ReglageHachures) => `${nombre(r.distance)} mm, ${nombre(r.angle)}°, ${nomMotif(r.motif).toLowerCase()}`;

/** Traits qui peuvent fermer un contour : traits forts et traits invisibles du niveau de travail. */
function traitsContour(ctx: Contexte): Primitive[] {
  const niveau = ctx.attributs().niveau;
  return visibles(ctx)
    .filter((e) => e.niveau === niveau && e.genre !== 'hachure' && e.genre !== 'texte' && e.genre !== 'cote')
    .flatMap((e) => e.primitives.filter((_, i) => TRAITS_CONTOUR.includes(e.styles?.[i]?.trait ?? e.trait)));
}

/** Le hachurage dont un point caractéristique (point désigné) est proche de `p`, et le rang de ce point. */
function hachuresEn(ctx: Contexte, p: Pt, niveauDeTravail: boolean): { e: Entite; i: number } | null {
  let meilleur: { e: Entite; i: number; d: number } | null = null;
  for (const e of visibles(ctx)) {
    if (e.genre !== 'hachure' || (niveauDeTravail && e.niveau !== ctx.attributs().niveau)) continue;
    e.extras.forEach((x, i) => {
      const d = dist(x.p, p);
      if (d <= ctx.rayon() * 1.5 && (!meilleur || d < meilleur.d)) meilleur = { e, i, d };
    });
  }
  const m = meilleur as { e: Entite; i: number } | null;
  return m ? { e: m.e, i: m.i } : null;
}

/** C16 — Hachurage. */
export class Hachurage extends Base {
  readonly nom = 'Hachurage';
  readonly code = 'C16';
  private contours: Pt[][] = [];
  private designes: Pt[] = [];
  private aModifier: Entite | null = null;
  private etape: 'contours' | 'distance' | 'angle' = 'contours';
  private distance = 4;
  invite() {
    const r = resume(reglageCourant(this.ctx));
    if (this.aModifier) return `Hachurage. Modification des hachures désignées [${r}] (Entrée pour hachurer).`;
    return this.contours.length === 0
      ? `Hachurage. Désigner un point à l'intérieur d'un contour. [${r}]`
      : `Hachurage. Choisir un autre contour (Entrée pour hachurer). [${r}]`;
  }
  attente(): 'point' | 'entite' {
    return 'entite';
  }
  question(): Question | null {
    if (this.etape === 'distance') return { texte: 'Distance entre les hachures', defaut: this.memoire('hachure-distance', 4) };
    if (this.etape === 'angle') return { texte: 'Angle des hachures', defaut: this.memoire('hachure-angle', 45) };
    return null;
  }
  valeur(v: number | string) {
    const n = Number(v);
    if (this.etape === 'distance') {
      if (!(n > 0)) return;
      this.distance = n;
      this.ctx.memoire.set('hachure-distance', n);
      this.etape = 'angle';
      return;
    }
    this.ctx.memoire.set('hachure-angle', n);
    const r: ReglageHachures = { motif: reglages(this.ctx).motifHachure, distance: this.distance, angle: n };
    if (this.aModifier) {
      const d = definitionHachures(this.aModifier)!;
      this.ctx.dessin.remplacerEntite(this.aModifier, [entiteHachures(d.contours, d.designes, r, this.aModifier.niveau)]);
    } else {
      this.ajouter(entiteHachures(this.contours, this.designes, r, this.at.niveau));
    }
    this.recommencer();
  }
  point(p: Pt) {
    if (this.etape !== 'contours' || this.aModifier) return;
    // Désigner le point caractéristique d'un hachurage existant : il sera refait avec les réglages en cours.
    if (this.contours.length === 0) {
      const h = hachuresEn(this.ctx, p, true);
      if (h) {
        this.aModifier = h.e;
        return;
      }
    }
    const face = contourVersEst(traitsContour(this.ctx), p);
    if (!face) {
      this.ctx.dire('Contour non fermé. Procédure abandonnée.');
      return;
    }
    this.contours.push(face);
    this.designes.push(p);
  }
  parDefaut() {
    if (this.etape !== 'contours' || (this.contours.length === 0 && !this.aModifier)) return;
    this.etape = 'distance';
  }
  private recommencer() {
    this.contours = [];
    this.designes = [];
    this.aModifier = null;
    this.etape = 'contours';
  }
  abandon() {
    const auDebut = this.contours.length === 0 && !this.aModifier && this.etape === 'contours';
    this.recommencer();
    return auDebut;
  }
  elastique(): Primitive[] {
    const contours = this.aModifier ? (definitionHachures(this.aModifier)?.contours ?? []) : this.contours;
    return contours.flatMap((c) => relier(c, true, false));
  }
}

/** Fonction de réglage « non exclusive » : elle s'exécute sans quitter la fonction en cours. */
abstract class Reglage extends Base {
  readonly ponctuelle = true;
  protected fini = false;
  termine() {
    return this.fini;
  }
}

/** C17 — Reprise des caractéristiques d'un hachurage existant. */
export class RepriseHachures extends Reglage {
  readonly nom = 'Reprise des caractéristiques de hachurage';
  readonly code = 'C17';
  invite() {
    return "Reprise des caractéristiques de hachurage. Repérer une hachure : désigner le point caractéristique d'une zone hachurée.";
  }
  attente(): 'point' | 'entite' {
    return 'entite';
  }
  point(p: Pt) {
    const h = hachuresEn(this.ctx, p, false);
    const d = h && definitionHachures(h.e);
    if (!d) {
      this.ctx.dire('Pas de hachures à cet endroit : désigner un point caractéristique (point désigné lors du hachurage).');
      return;
    }
    reglages(this.ctx).motifHachure = d.reglage.motif;
    this.ctx.memoire.set('hachure-distance', d.reglage.distance);
    this.ctx.memoire.set('hachure-angle', d.reglage.angle);
    this.ctx.dire(`Hachures reprises : ${resume(d.reglage)}.`);
    this.fini = true;
  }
}

/** C18 — Choix du type de hachures. */
export class ChoixHachures extends Reglage {
  readonly nom = 'Choix du motif de hachurage';
  readonly code = 'C18';
  invite() {
    return 'Choix du type de hachures.';
  }
  question(): Question | null {
    if (this.fini) return null;
    const liste = MOTIFS.map((m, i) => `${i + 1} ${m.nom.toLowerCase()}`).join(', ');
    const courant = MOTIFS.findIndex((m) => m.cle === reglages(this.ctx).motifHachure) + 1;
    return { texte: `Type de hachures : ${liste}`, defaut: courant || 1, entier: true };
  }
  valeur(v: number | string) {
    const m = MOTIFS[Number(v) - 1];
    if (!m) return;
    reglages(this.ctx).motifHachure = m.cle as Motif;
    this.ctx.dire(`Type de hachures : ${m.nom.toLowerCase()}.`);
    this.fini = true;
  }
  point() {}
}

/** C19 — Addition ou suppression d'un contour à un hachurage existant (niveau de travail). */
export class ContourHachures extends Base {
  readonly nom = "Addition/suppression d'un contour de hachures";
  readonly code = 'C19';
  private mode: '+' | '-' | null = null;
  private cible: Entite | null = null;
  private ajouts: { contour: Pt[]; p: Pt }[] = [];
  question(): Question | null {
    return this.mode === null ? { texte: "Addition ou suppression d'un contour à un hachurage [+/-]", defaut: '+', type: 'texte' } : null;
  }
  valeur(v: number | string) {
    this.mode = String(v).trim().startsWith('-') ? '-' : '+';
  }
  attente(): 'point' | 'entite' {
    return 'entite';
  }
  invite() {
    if (this.mode === '-') return 'Repérer le point caractéristique du contour à supprimer.';
    return this.cible ? 'Complément de hachures. Choisir un autre contour (RETURN pour hachurer).' : 'Repérer un point caractéristique des hachures à compléter.';
  }
  point(p: Pt) {
    if (this.mode === null) return;
    if (this.mode === '+' && this.cible) {
      const face = contourVersEst(traitsContour(this.ctx), p);
      if (!face) return this.ctx.dire('Contour non fermé. Procédure abandonnée.');
      this.ajouts.push({ contour: face, p });
      return;
    }
    const h = hachuresEn(this.ctx, p, true);
    if (!h) return this.ctx.dire("Ce point n'appartient pas à un contour hachuré du niveau de travail.");
    if (this.mode === '+') {
      this.cible = h.e;
      return;
    }
    const d = definitionHachures(h.e)!;
    const contours = d.contours.filter((_, i) => i !== h.i);
    const designes = d.designes.filter((_, i) => i !== h.i);
    if (contours.length === 0) this.ctx.dessin.retirer(h.e);
    else this.ctx.dessin.remplacerEntite(h.e, [entiteHachures(contours, designes, d.reglage, h.e.niveau)]);
    this.ctx.dire('Contour retiré du hachurage.');
  }
  parDefaut() {
    if (this.mode !== '+' || !this.cible || this.ajouts.length === 0) return;
    const d = definitionHachures(this.cible)!;
    this.ctx.dessin.remplacerEntite(this.cible, [
      entiteHachures([...d.contours, ...this.ajouts.map((a) => a.contour)], [...d.designes, ...this.ajouts.map((a) => a.p)], d.reglage, this.cible.niveau),
    ]);
    this.cible = null;
    this.ajouts = [];
  }
  abandon() {
    if (this.cible) {
      this.cible = null;
      this.ajouts = [];
      return false;
    }
    this.mode = null;
    return true;
  }
  elastique(): Primitive[] {
    return this.ajouts.flatMap((a) => relier(a.contour, true, false));
  }
}

/** C20 — Affichage avec ou sans les hachures (bascule). */
export class AffichageHachures extends Reglage {
  readonly nom = 'Activation / désactivation des hachures';
  readonly code = 'C20';
  constructor(ctx: Contexte) {
    super(ctx);
    const r = reglages(ctx);
    r.afficherHachures = !r.afficherHachures;
    ctx.dire(r.afficherHachures ? 'Affichage AVEC les hachures.' : 'Affichage SANS les hachures.');
    this.fini = true;
  }
  invite() {
    return '';
  }
  point() {}
}

enregistrerFonctions({ C16: Hachurage, C17: RepriseHachures, C18: ChoixHachures, C19: ContourHachures, C20: AffichageHachures });
