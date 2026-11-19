// Ligne 1 de la palette (habillage) : fichier-texte (B6), reprise des caractéristiques d'un texte (B7),
// cotes en série (B10), superposées (B11), étagées (B12), de demi-diamètre (B13), d'angle (B16),
// habillage des cotes et tolérances (B17), repère (B18), flèche de section-coupe (B19), flèche (B20).
// Textes repris de l'aide d'origine (rubriques COTATION EN SERIE, REPERE, FLECHE…).
import { coteAngle, coteDemiDiametre, coteSelon, directionCote, flecheCoupe, flecheSimple, hauteurCote, lignesTexte, repere, symboles, type Cote } from './cotes';
import type { Entite, Trait } from './dessin';
import { entiteProche, primitiveProche } from './edition';
import { Base, enregistrerFonctions, type Contexte, type Question, visibles } from './fonctions';
import { dist, nombre, type PointCaracteristique, type Pt } from './geometrie';
import type { AlignH, Primitive } from './primitives';

const at = (ctx: Contexte) => ctx.attributs();

function entiteCote(c: Cote, attaches: Pt[], ctx: Contexte): Entite {
  const extras: PointCaracteristique[] = [{ p: c.reference, type: 'extremite' }, ...attaches.map((p) => ({ p, type: 'extremite' as const }))];
  return { genre: 'cote', primitives: c.primitives, extras, niveau: at(ctx).niveau, trait: 'continu-fin', params: { valeur: c.valeur } };
}

/** Le segment désigné près de `p` (dans une entité du dessin), ou null. */
function segmentEn(ctx: Contexte, p: Pt): { a: Pt; b: Pt } | null {
  const e = entiteProche(visibles(ctx), p, ctx.rayon());
  if (!e) return null;
  const prim = e.primitives[primitiveProche(e, p)];
  return prim.type === 'segment' || prim.type === 'droite' || prim.type === 'demi-droite' ? { a: prim.a, b: prim.b } : null;
}

// ======================================================================= Cotes enchaînées

type Mode = 'serie' | 'superposee' | 'etagee';

/** B10, B11, B12 — Une suite de cotes à partir d'une surface de départ. */
abstract class CotesEnchainees extends Base {
  protected abstract mode: Mode;
  protected abstract titre: string;
  private origine: Pt | null = null;
  private precedent: Pt | null = null;
  private position: Pt | null = null;
  private dir: Pt | null = null;
  private rang = 0;
  invite() {
    if (!this.origine) return `${this.titre}. Désigner la surface de départ.`;
    if (this.precedent && !this.position) return `${this.titre}. Désigner par un point la position de la ligne de cote.`;
    return `${this.titre}. Désigner un point ou l'entité suivante.`;
  }
  /** La cote vers `p` et la position de sa ligne. */
  private cote(p: Pt, position: Pt, dir: Pt, rang: number): Cote | null {
    const o = this.origine!;
    const avant = this.precedent ?? o;
    if (this.mode === 'serie') return coteSelon(avant, p, dir, position);
    if (this.mode === 'etagee') {
      const cumul = Math.abs((p.x - o.x) * dir.x + (p.y - o.y) * dir.y);
      return coteSelon(avant, p, dir, position, hauteurCote(), cumul);
    }
    // Superposées : chaque cote part de l'origine, décalée de 3 fois la hauteur des écritures.
    const n = { x: -dir.y, y: dir.x };
    const s = Math.sign((position.x - o.x) * n.x + (position.y - o.y) * n.y) || 1;
    const decale = { x: position.x + n.x * s * 3 * hauteurCote() * rang, y: position.y + n.y * s * 3 * hauteurCote() * rang };
    return coteSelon(o, p, dir, decale);
  }
  point(p: Pt) {
    if (!this.origine) {
      this.origine = p;
      return;
    }
    if (!this.precedent) {
      if (dist(p, this.origine) > 1e-9) this.precedent = p;
      return;
    }
    if (!this.position) {
      // Première cote : de la surface de départ au premier point ; elle fixe la direction et la ligne.
      this.position = p;
      this.dir = directionCote(this.origine, this.precedent, p);
      this.ctx.dessin.ajouter(entiteCote(coteSelon(this.origine, this.precedent, this.dir, p), [this.origine, this.precedent], this.ctx));
      this.rang = 1;
      return;
    }
    const c = this.cote(p, this.position, this.dir!, this.rang);
    if (!c || c.valeur < 1e-9) return this.ctx.dire('Désigner un autre point ou une entité.');
    this.ctx.dessin.ajouter(entiteCote(c, [this.precedent, p], this.ctx));
    this.precedent = p;
    this.rang++;
  }
  abandon() {
    const auDebut = !this.origine;
    this.origine = this.precedent = this.position = this.dir = null;
    this.rang = 0;
    return auDebut;
  }
  elastique(r: Pt): Primitive[] {
    if (!this.origine || !this.precedent) return [];
    if (!this.position) return coteSelon(this.origine, this.precedent, directionCote(this.origine, this.precedent, r), r).primitives;
    return this.cote(r, this.position, this.dir!, this.rang)?.primitives ?? [];
  }
}

export class CotesSerie extends CotesEnchainees {
  readonly nom = 'Cotation en série';
  readonly code = 'B10';
  protected mode: Mode = 'serie';
  protected titre = 'Cotation en série';
}
export class CotesSuperposees extends CotesEnchainees {
  readonly nom = 'Cotation parallèle étagée (cotes superposées)';
  readonly code = 'B11';
  protected mode: Mode = 'superposee';
  protected titre = 'Cotation parallèle';
}
export class CotesEtagees extends CotesEnchainees {
  readonly nom = 'Cotation parallèle colinéaire (cotes étagées)';
  readonly code = 'B12';
  protected mode: Mode = 'etagee';
  protected titre = 'Cotation parallèle colinéaire';
}

// ======================================================================= Demi-diamètre, angle

/** B13 — Cotes de demi-diamètre : l'axe commun, puis pour chaque point la position de la ligne de cote. */
export class CoteDemiDiametre extends Base {
  readonly nom = 'Cotation de demi-diamètre';
  readonly code = 'B13';
  private axe: { a: Pt; b: Pt } | null = null;
  private vise: Pt | null = null;
  attente(): 'point' | 'entite' {
    return this.axe ? 'point' : 'entite';
  }
  invite() {
    if (!this.axe) return "Cotation de demi-diamètre. Désigner l'axe commun.";
    return this.vise ? 'Cotation de demi-diamètre. Désigner par un point la position de la ligne de cote.' : 'Cotation de demi-diamètre. Désigner un point ou un segment.';
  }
  point(p: Pt) {
    if (!this.axe) {
      this.axe = segmentEn(this.ctx, p);
      if (!this.axe) this.ctx.dire("Désigner un segment représentant l'axe de révolution.");
      return;
    }
    if (!this.vise) {
      this.vise = p;
      return;
    }
    const c = coteDemiDiametre(this.axe.a, this.axe.b, this.vise, p);
    if (c) this.ctx.dessin.ajouter(entiteCote(c, [this.vise], this.ctx));
    else this.ctx.dire("Le point est sur l'axe.");
    this.vise = null;
  }
  abandon() {
    const auDebut = !this.axe;
    if (this.vise) this.vise = null;
    else this.axe = null;
    return auDebut;
  }
  elastique(r: Pt): Primitive[] {
    return this.axe && this.vise ? (coteDemiDiametre(this.axe.a, this.axe.b, this.vise, r)?.primitives ?? []) : [];
  }
}

/** B16 — Cotation d'un angle entre deux segments. */
export class CoteAngle extends Base {
  readonly nom = "Cotation d'un angle";
  readonly code = 'B16';
  private segs: { s: { a: Pt; b: Pt }; p: Pt }[] = [];
  attente(): 'point' | 'entite' {
    return this.segs.length < 2 ? 'entite' : 'point';
  }
  invite() {
    return ["Cotation d'un angle. Désigner le premier segment.", "Cotation d'un angle. Désigner le second segment.", "Cotation d'un angle. Désigner la position de la ligne de cote."][this.segs.length];
  }
  point(p: Pt) {
    if (this.segs.length < 2) {
      const s = segmentEn(this.ctx, p);
      if (!s) return this.ctx.dire('Désigner un segment.');
      this.segs.push({ s, p });
      return;
    }
    const [a, b] = this.segs;
    const c = coteAngle(a.s, a.p, b.s, b.p, p);
    if (c) this.ctx.dessin.ajouter(entiteCote(c, [], this.ctx));
    else this.ctx.dire('Les segments sont parallèles.');
    this.segs = [];
  }
  abandon() {
    const auDebut = this.segs.length === 0;
    this.segs = [];
    return auDebut;
  }
  elastique(r: Pt): Primitive[] {
    if (this.segs.length < 2) return [];
    const [a, b] = this.segs;
    return coteAngle(a.s, a.p, b.s, b.p, r)?.primitives ?? [];
  }
}

// ======================================================================= Habillage de cote (tolérances)

const LARGEUR = 0.62; // largeur moyenne d'un caractère, en hauteurs

/** Le texte principal d'une cote : le plus grand. */
function texteCote(e: Entite): number {
  let meilleur = -1;
  e.primitives.forEach((p, i) => {
    if (p.type === 'texte' && (meilleur < 0 || p.h > (e.primitives[meilleur] as { h: number }).h)) meilleur = i;
  });
  return meilleur;
}

/** B17 — Préfixe, postfixe bas et postfixe haut d'une cote existante (habillage de cotation). */
export class HabillageCote extends Base {
  readonly nom = 'Habillage de cotation (tolérances)';
  readonly code = 'B17';
  private cote: Entite | null = null;
  private reponses: string[] = [];
  attente(): 'point' | 'entite' {
    return 'entite';
  }
  invite() {
    return 'Habillage de cotation. Désigner la cote.';
  }
  private get habillage() {
    return (this.cote?.params ?? {}) as { prefixe?: string; bas?: string; haut?: string; base?: string };
  }
  question(): Question | null {
    if (!this.cote) return null;
    const h = this.habillage;
    if (this.reponses.length === 0) return { texte: 'Préfixe', defaut: h.prefixe ?? '', type: 'texte' };
    if (this.reponses.length === 1) return { texte: 'Postfixe bas', defaut: h.bas ?? '', type: 'texte' };
    if (this.reponses.length === 2 && !/^(\+-|±)/.test(this.reponses[1])) return { texte: 'Postfixe haut', defaut: h.haut ?? '', type: 'texte' };
    return null;
  }
  valeur(v: number | string) {
    this.reponses.push(symboles(String(v)));
    if (this.question() === null) this.appliquer();
  }
  point(p: Pt) {
    const e = entiteProche(visibles(this.ctx).filter((x) => x.genre === 'cote'), p, this.ctx.rayon() * 2);
    if (!e || texteCote(e) < 0) return this.ctx.dire('Désigner la cote (près de son écriture).');
    this.cote = e;
    this.reponses = [];
  }
  private appliquer() {
    const e = this.cote!;
    const h = this.habillage;
    const i = texteCote(e);
    const t = e.primitives[i] as Extract<Primitive, { type: 'texte' }>;
    const base = h.base ?? t.texte;
    const [prefixe, bas0, haut] = [this.reponses[0] ?? '', this.reponses[1] ?? '', this.reponses[2] ?? ''];
    const centree = /^(\+-|±)/.test(bas0);
    const bas = centree ? `±${bas0.replace(/^(\+-|±)/, '')}` : bas0;
    // Les postfixes précédents (ajoutés à la fin) sont retirés avant d'en mettre de nouveaux.
    const anciens = Number((e.params as { postfixes?: number } | undefined)?.postfixes ?? 0);
    const prims = e.primitives.slice(0, e.primitives.length - anciens);
    const texte = `${prefixe ? `${prefixe} ` : ''}${base}`;
    prims[i] = { ...t, texte };
    const a = (t.angle * Math.PI) / 180;
    const u = { x: Math.cos(a), y: Math.sin(a) };
    const v = { x: -u.y, y: u.x };
    const demi = (LARGEUR * t.h * texte.length) / 2;
    const fin = { x: t.p.x + u.x * (demi + 0.6), y: t.p.y + u.y * (demi + 0.6) };
    const petit = t.h * 0.7;
    const ajouts: Primitive[] = [];
    const place = (k: number, s: string) => ajouts.push({ type: 'texte', p: { x: fin.x + v.x * k, y: fin.y + v.y * k }, h: petit, angle: t.angle, texte: s, alignH: 'gauche', alignV: 'ligne' });
    if (centree) place(0.15 * t.h, bas);
    else {
      if (haut) place(0.55 * t.h, haut);
      if (bas) place(-0.25 * t.h, bas);
    }
    this.ctx.dessin.remplacerEntite(e, [{ ...e, primitives: [...prims, ...ajouts], params: { ...e.params, prefixe, bas: centree ? bas0 : bas, haut: centree ? '' : haut, base, postfixes: ajouts.length } }]);
    this.cote = null;
    this.reponses = [];
  }
  abandon() {
    const auDebut = !this.cote;
    this.cote = null;
    this.reponses = [];
    return auDebut;
  }
}

// ======================================================================= Repère, flèches

/** B18 — Repère : la pièce, l'emplacement du repère, puis l'identification. */
export class Repere extends Base {
  readonly nom = 'Repère';
  readonly code = 'B18';
  private trace: { p: Pt; niveau: number } | null = null;
  private emplacement: Pt | null = null;
  attente(): 'point' | 'entite' {
    return this.trace ? 'point' : 'entite';
  }
  invite() {
    return this.trace ? "Repère. Désigner l'emplacement du repère." : 'Repère. Désigner la pièce.';
  }
  question(): Question | null {
    return this.emplacement ? { texte: 'Identification', defaut: String(this.trace!.niveau).padStart(2, '0'), type: 'texte' } : null;
  }
  dernierPoint() {
    return this.trace?.p ?? null;
  }
  point(p: Pt) {
    if (!this.trace) {
      const e = entiteProche(visibles(this.ctx), p, this.ctx.rayon());
      if (!e) return this.ctx.dire('Désigner un tracé de la pièce à repérer.');
      this.trace = { p, niveau: e.niveau };
      return;
    }
    this.emplacement = p;
  }
  valeur(v: number | string) {
    const texte = String(v).trim();
    if (texte && this.trace && this.emplacement) {
      const prims = repere(this.trace.p, this.emplacement, texte);
      this.ctx.dessin.ajouter({
        genre: 'repere',
        primitives: prims,
        extras: [{ p: this.emplacement, type: 'extremite' }, { p: (prims[0] as { a: Pt }).a, type: 'extremite' }],
        niveau: at(this.ctx).niveau,
        trait: 'continu-fin',
        params: { texte, niveauPiece: this.trace.niveau },
      });
    }
    this.trace = this.emplacement = null;
  }
  abandon() {
    const auDebut = !this.trace;
    this.trace = this.emplacement = null;
    return auDebut;
  }
  elastique(r: Pt): Primitive[] {
    return this.trace && !this.emplacement ? repere(this.trace.p, r, '..') : [];
  }
}

/** B19 — Flèche de section-coupe (NF E 04-520). */
export class FlecheCoupe extends Base {
  readonly nom = 'Flèche de section-coupe';
  readonly code = 'B19';
  private plan: { s: { a: Pt; b: Pt }; p: Pt } | null = null;
  private emplacement: Pt | null = null;
  attente(): 'point' | 'entite' {
    return this.plan ? 'point' : 'entite';
  }
  invite() {
    return this.plan ? "Flèche de section-coupe. Désigner l'emplacement du symbole." : 'Flèche de section-coupe. Désigner le plan de section.';
  }
  question(): Question | null {
    if (!this.emplacement) return null;
    const derniere = this.ctx.memoire.get('lettre-coupe') ?? 0;
    return { texte: 'Lettre repère de la section', defaut: String.fromCharCode(65 + (derniere % 26)), type: 'texte' };
  }
  point(p: Pt) {
    if (!this.plan) {
      const s = segmentEn(this.ctx, p);
      if (!s) return this.ctx.dire('Désigner un point au voisinage du plan de coupe.');
      this.plan = { s, p };
      return;
    }
    this.emplacement = p;
  }
  valeur(v: number | string) {
    const lettre = String(v).trim().toUpperCase() || 'A';
    const prims = flecheCoupe(this.plan!.s, this.plan!.p, this.emplacement!, lettre);
    this.ctx.memoire.set('lettre-coupe', lettre.charCodeAt(0) - 64);
    this.ctx.dessin.ajouter({ genre: 'fleche', primitives: prims, extras: [{ p: (prims[2] as { a: Pt }).a, type: 'extremite' }], niveau: at(this.ctx).niveau, trait: 'continu-fort', params: { lettre } });
    this.plan = this.emplacement = null;
  }
  abandon() {
    const auDebut = !this.plan;
    this.plan = this.emplacement = null;
    return auDebut;
  }
  elastique(r: Pt): Primitive[] {
    return this.plan && !this.emplacement ? flecheCoupe(this.plan.s, this.plan.p, r, '?') : [];
  }
}

/** B20 — Flèche simple : l'extrémité, puis l'origine. */
export class Fleche extends Base {
  readonly nom = 'Flèche';
  readonly code = 'B20';
  invite() {
    return this.pts.length === 0 ? "Création d'une flèche. Désigner l'extrémité de la flèche." : "Création d'une flèche. Désigner l'origine de la flèche.";
  }
  dernierPoint() {
    return this.pts[0] ?? null;
  }
  point(p: Pt) {
    if (this.pts.length === 0) {
      this.pts = [p];
      return;
    }
    const prims = flecheSimple(this.pts[0], p);
    if (prims.length) this.ajouter({ genre: 'fleche', primitives: prims, extras: [{ p: this.pts[0], type: 'extremite' }, { p, type: 'extremite' }], ...this.at, trait: 'continu-fin' as Trait });
    this.pts = [];
  }
  elastique(r: Pt): Primitive[] {
    return this.pts[0] ? flecheSimple(this.pts[0], r) : [];
  }
}

// ======================================================================= Textes

const JUSTIFICATIONS: AlignH[] = ['gauche', 'centre', 'droite'];

/** B6 — Fichier-texte : plusieurs lignes saisies ou lues dans un fichier .txt. */
export class FichierTexte extends Base {
  readonly nom = 'Écriture : fichier-texte';
  readonly code = 'B6';
  private attend = false;
  invite() {
    const h = this.memoire('hauteurTexte', 3.5);
    return `Fichier-texte. Désigner le point de référence. (hauteur ${nombre(h)}, inclinaison ${nombre(this.memoire('angleTexte', 0))}°)`;
  }
  point(p: Pt) {
    if (this.attend) return;
    const saisir = this.ctx.actions?.texteLong;
    if (!saisir) return this.ctx.dire("La saisie d'un fichier-texte n'est pas disponible ici.");
    this.attend = true;
    void saisir(this.ctx.memoire.get('dernierFichierTexte') ? '' : '').then((texte) => {
      this.attend = false;
      if (!texte?.trim()) return;
      const lignes = symboles(texte).replace(/\r\n?/g, '\n').split('\n').slice(0, 124).map((l) => l.slice(0, 79));
      const h = this.memoire('hauteurTexte', 3.5);
      const prims = lignesTexte(p, lignes, h, this.memoire('angleTexte', 0), JUSTIFICATIONS[this.memoire('justification', 0)]);
      this.ajouter({ genre: 'texte', primitives: prims, extras: [{ p, type: 'extremite' }], ...this.at });
      this.ctx.actions?.redessiner?.();
      this.ctx.dire(`Fichier-texte écrit : ${lignes.length} ligne${lignes.length > 1 ? 's' : ''}.`);
    });
  }
}

/** B7 — Reprise des caractéristiques d'un texte existant (hauteur, inclinaison, justification). */
export class RepriseTexte extends Base {
  readonly nom = "Reprise des caractéristiques d'un texte";
  readonly code = 'B7';
  readonly ponctuelle = true;
  private fini = false;
  attente(): 'point' | 'entite' {
    return 'entite';
  }
  invite() {
    return "Reprise des caractéristiques d'un texte. Désigner le texte.";
  }
  termine() {
    return this.fini;
  }
  point(p: Pt) {
    const e = entiteProche(visibles(this.ctx), p, this.ctx.rayon() * 2);
    const t = e?.primitives.find((x) => x.type === 'texte') as Extract<Primitive, { type: 'texte' }> | undefined;
    if (!t) return this.ctx.dire('Désigner un texte.');
    this.ctx.memoire.set('hauteurTexte', t.h);
    this.ctx.memoire.set('angleTexte', t.angle);
    this.ctx.memoire.set('justification', Math.max(0, JUSTIFICATIONS.indexOf(t.alignH)));
    this.ctx.dire(`Caractéristiques du texte modifiées : hauteur ${nombre(t.h)}, inclinaison ${nombre(t.angle)}°, ${['à gauche', 'centré', 'à droite'][Math.max(0, JUSTIFICATIONS.indexOf(t.alignH))]}.`);
    this.fini = true;
  }
}

enregistrerFonctions({
  B6: FichierTexte,
  B7: RepriseTexte,
  B10: CotesSerie,
  B11: CotesSuperposees,
  B12: CotesEtagees,
  B13: CoteDemiDiametre,
  B16: CoteAngle,
  B17: HabillageCote,
  B18: Repere,
  B19: FlecheCoupe,
  B20: Fleche,
});
