// Images : insertion (B1) et plan d'affichage (B2). La liste des images (B4) et leur affichage (B3) sont
// dans l'interface (renderer.ts). Textes repris de l'aide d'origine (« Insertion d'une image », « Plan
// d'affichage d'une image »).
import type { Entite } from './dessin';
import { entiteProche } from './edition';
import { designables, enregistrerFonctions, horsNiveau, type Contexte, type Fonction, type Question } from './fonctions';
import type { Pt } from './geometrie';
import { entiteImage, imageEn, planDe, PLANS, type ImageStockee, type Plan } from './images';
import type { Primitive } from './primitives';

/** B1 — Insertion d'une image lue : chaque point désigné en place une (coin supérieur droit). */
export class InsertionImage implements Fonction {
  readonly nom = "Insertion d'une image";
  readonly code = 'B1';
  constructor(
    private ctx: Contexte,
    private id: string,
    private image: ImageStockee,
    private largeur: number,
    private hauteur: number,
    private nomFichier: string,
  ) {}
  invite() {
    return `Insertion d'une image (${this.nomFichier}). Désigner le point de référence (coin supérieur droit).`;
  }
  question(): Question | null {
    return null;
  }
  valeur() {}
  attente(): 'point' {
    return 'point';
  }
  dernierPoint() {
    return null;
  }
  point(p: Pt) {
    if (!this.ctx.dessin.images.has(this.id)) this.ctx.dessin.images.set(this.id, this.image);
    this.ctx.dessin.ajouter(entiteImage(this.id, p, this.largeur, this.hauteur, 'general', this.ctx.attributs().niveau, this.nomFichier));
    this.ctx.dire(`Image ${this.nomFichier} insérée.`);
  }
  traitElastique() {
    return 'continu-fin' as const;
  }
  elastique(r: Pt): Primitive[] {
    const bg = { x: r.x - this.largeur, y: r.y - this.hauteur };
    const c = [bg, { x: r.x, y: bg.y }, r, { x: bg.x, y: r.y }];
    return [...c.map((q, i) => ({ type: 'segment' as const, a: q, b: c[(i + 1) % 4] })), { type: 'segment', a: bg, b: r }];
  }
  abandon() {
    return true;
  }
}

/** Image désignée : celle sous le réticule, sinon celle dont un bord est proche. */
export function designerImage(ctx: Contexte, p: Pt): Entite | null {
  const images = designables(ctx).filter((e) => e.genre === 'image');
  return imageEn(images, p) ?? entiteProche(images, p, ctx.rayon());
}

/** B2 — Plan d'affichage d'une image : arrière-plan (fond de plan), plan général, premier plan (masque). */
export class PlanImage implements Fonction {
  readonly nom = "Plan d'affichage d'une image";
  readonly code = 'B2';
  readonly reperage = 'travail' as const;
  private image: Entite | null = null;
  constructor(private ctx: Contexte) {}
  invite() {
    return "Modification du plan d'affichage d'une image. Désigner une image.";
  }
  attente(): 'entite' {
    return 'entite';
  }
  question(): Question | null {
    if (!this.image) return null;
    const actuel = PLANS.findIndex((p) => p.cle === planDe(this.image!));
    return { texte: "Plan d'affichage [A] arrière-plan [G] plan général [P] premier plan", defaut: 'AGP'[actuel] ?? 'G', type: 'texte' };
  }
  valeur(v: number | string) {
    const e = this.image;
    this.image = null;
    if (!e) return;
    const t = String(v).trim().toUpperCase()[0];
    const plan: Plan | null = t === 'A' ? 'arriere' : t === 'G' ? 'general' : t === 'P' ? 'premier' : null;
    if (!plan) return this.ctx.dire('Répondre A, G ou P.');
    this.ctx.dessin.remplacerPlusieurs([[e, { ...e, params: { ...e.params, plan } }]]);
    this.ctx.dire(`Image au ${PLANS.find((p) => p.cle === plan)!.nom}.`);
  }
  dernierPoint() {
    return null;
  }
  point(p: Pt) {
    const e = designerImage(this.ctx, p);
    if (!e) return this.ctx.dire(horsNiveau(this.ctx, p, (es) => imageEn(es.filter((x) => x.genre === 'image'), p)).replace("Pas d'entité", "Pas d'image"));
    this.image = e;
  }
  abandon() {
    const auDebut = !this.image;
    this.image = null;
    return auDebut;
  }
  elastique() {
    return [];
  }
}

enregistrerFonctions({ B2: PlanImage });
