// Palette MECA, cotation (cases G01 à G15 et H01 à H15 de l'original) : tolérances géométriques, cote projetée
// ou enveloppe, cotation par coordonnées, trous taraudés et lisses, surface de référence, état de surface,
// cote encadrée, ajustements ISO, cotation fonctionnelle (liens, chaînes de cotes, résolution).
// Messages repris de l'original quand ils sont connus (CTF.MSE pour la cotation fonctionnelle).
import { cotation, texteCote } from './cotation';
import {
  chercherChaines,
  resoudre,
  surfaceEn,
  surfaces,
  texteTolerance,
  type Sens,
  type Tolerance,
} from './cotation-fonctionnelle';
import { fleche, symboles } from './cotes';
import type { Entite, Trait } from './dessin';
import { entiteProche, primitiveProche } from './edition';
import { enregistrerFonctions, visibles, type Contexte, type Fonction, type Question } from './fonctions';
import { dist, nombre, type Pt } from './geometrie';
import { ecartsISO, lireClasse, texteEcart } from './iso286';
import {
  cadreTexte,
  cadreTolerance,
  etatSurface,
  filetage,
  largeurTexte,
  lettreCerclee,
  SANS_REFERENCE,
  surfaceReference,
  trouLisse,
  trouTaraude,
  trouTaraudeDessus,
  type SymboleTolerance,
  type TraitTrou,
  type TypeRugosite,
} from './meca-symboles';
import { surCercle, type Primitive } from './primitives';

const P = (x: number, y: number): Pt => ({ x, y });
const seg = (a: Pt, b: Pt): Primitive => ({ type: 'segment', a, b });
const num = (v: number | string | undefined, d: number) => (typeof v === 'number' ? v : Number(String(v ?? '').trim().replace(',', '.')) || d);
const h = () => cotation.hauteur;

/** Une entité d'habillage (trait fin) sur le niveau de travail. */
function habillage(ctx: Contexte, prims: Primitive[], params: Record<string, unknown>, extras: Pt[] = []): Entite {
  return { genre: 'cote', primitives: prims, extras: extras.map((p) => ({ p, type: 'extremite' })), niveau: ctx.attributs().niveau, trait: 'continu-fin', params };
}

/** Point de l'entité désignée le plus proche du point désigné (pour poser une flèche sur l'élément). */
function surEntite(ctx: Contexte, p: Pt): { p: Pt; u: Pt; e: Entite } | null {
  const e = entiteProche(visibles(ctx), p, ctx.rayon());
  if (!e) return null;
  const q = e.primitives[primitiveProche(e, p)];
  if (q.type === 'segment' || q.type === 'droite' || q.type === 'demi-droite') {
    const u = { x: q.b.x - q.a.x, y: q.b.y - q.a.y };
    const l2 = u.x * u.x + u.y * u.y || 1;
    let t = ((p.x - q.a.x) * u.x + (p.y - q.a.y) * u.y) / l2;
    if (q.type === 'segment') t = Math.max(0, Math.min(1, t));
    return { p: P(q.a.x + u.x * t, q.a.y + u.y * t), u, e };
  }
  if (q.type === 'cercle' || q.type === 'arc') {
    const a = Math.atan2(p.y - q.c.y, p.x - q.c.x);
    return { p: P(q.c.x + q.r * Math.cos(a), q.c.y + q.r * Math.sin(a)), u: { x: -Math.sin(a), y: Math.cos(a) }, e };
  }
  return { p, u: { x: 1, y: 0 }, e };
}

/** La cote désignée (près de son écriture) et son premier texte. */
function coteEn(ctx: Contexte, p: Pt): { e: Entite; i: number } | null {
  const e = entiteProche(
    visibles(ctx).filter((x) => x.genre === 'cote'),
    p,
    ctx.rayon() * 3,
  );
  if (!e) return null;
  const i = e.primitives.findIndex((q) => q.type === 'texte');
  return i >= 0 ? { e, i } : null;
}

/** Fin d'un texte (côté droit, dans sa direction), pour y accrocher un symbole. */
function finTexte(t: Extract<Primitive, { type: 'texte' }>): Pt {
  const l = largeurTexte(t.texte, t.h);
  const debut = t.alignH === 'centre' ? -l / 2 : t.alignH === 'droite' ? -l : 0;
  const milieuV = t.alignV === 'milieu' ? 0 : t.alignV === 'haut' ? -t.h / 2 : t.h / 2;
  return surCercle(surCercle(t.p, debut + l, t.angle), milieuV, t.angle + 90);
}

/** Base : des points à désigner (étapes), puis des questions, puis le tracé. */
abstract class Meca implements Fonction {
  abstract readonly nom: string;
  abstract readonly code: string;
  protected pts: Pt[] = [];
  protected reponses: (number | string)[] = [];
  constructor(protected ctx: Contexte) {}
  protected abstract etapes(): string[];
  /** Étapes qui désignent une entité (petit réticule). */
  protected entites(): boolean[] {
    return [];
  }
  protected questions(): Question[] {
    return [];
  }
  protected verifier(_i: number, _p: Pt): string | null {
    return null;
  }
  protected abstract appliquer(): void;
  protected apercu(_r: Pt): Primitive[] {
    return [];
  }
  invite() {
    return this.etapes()[this.pts.length] ?? '';
  }
  attente(): 'point' | 'entite' {
    return this.entites()[this.pts.length] ? 'entite' : 'point';
  }
  question(): Question | null {
    if (this.pts.length < this.etapes().length) return null;
    return this.questions()[this.reponses.length] ?? null;
  }
  valeur(v: number | string) {
    this.reponses.push(v);
    if (this.reponses.length >= this.questions().length) this.terminer();
  }
  dernierPoint() {
    return this.pts[this.pts.length - 1] ?? null;
  }
  point(p: Pt) {
    const err = this.verifier(this.pts.length, p);
    if (err) return this.ctx.dire(err);
    this.pts.push(p);
    if (this.pts.length >= this.etapes().length && this.questions().length === 0) this.terminer();
  }
  protected terminer() {
    this.appliquer();
    this.pts = [];
    this.reponses = [];
  }
  abandon() {
    const auDebut = this.pts.length === 0;
    this.pts = [];
    this.reponses = [];
    return auDebut;
  }
  elastique(r: Pt): Primitive[] {
    return this.apercu(r);
  }
}

// ======================================================================= Tolérances géométriques (G01–G08, H01–H06)

function tolerance(code: string, sym: SymboleTolerance, nom: string) {
  return class extends Meca {
    readonly nom = nom;
    readonly code = code;
    protected etapes() {
      return [`${nom}. Désigner l'élément tolérancé.`, `${nom}. Désigner la position du cadre de tolérance.`];
    }
    protected entites() {
      return [true, false];
    }
    protected verifier(i: number, p: Pt) {
      return i === 0 && !surEntite(this.ctx, p) ? "Désigner l'élément tolérancé (un trait du dessin)." : null;
    }
    protected questions(): Question[] {
      const q: Question[] = [{ texte: 'Tolérance ($ = Ø)', defaut: '0.02', type: 'texte' }];
      if (!SANS_REFERENCE.includes(sym)) q.push({ texte: 'Référence(s) (ex. A ou A-B)', defaut: 'A', type: 'texte' });
      return q;
    }
    protected appliquer() {
      const el = surEntite(this.ctx, this.pts[0]);
      if (!el) return;
      const tol = symboles(String(this.reponses[0]).trim()) || '0.02';
      const refs = SANS_REFERENCE.includes(sym)
        ? []
        : String(this.reponses[1] ?? '')
            .split(/\s*[,;/|]\s*|\s+/)
            .map((r) => r.trim())
            .filter(Boolean);
      this.ctx.dessin.ajouter(habillage(this.ctx, cadreTolerance(sym, tol, refs, el.p, this.pts[1], h()), { tolerance: sym, valeur: tol, references: refs }, [this.pts[1], el.p]));
    }
    protected apercu(r: Pt) {
      const el = this.pts.length === 1 ? surEntite(this.ctx, this.pts[0]) : null;
      return el ? cadreTolerance(sym, '0.02', SANS_REFERENCE.includes(sym) ? [] : ['A'], el.p, r, h()) : [];
    }
  };
}

// ======================================================================= G09, H09, H10 : sur une cote existante

/** G09 — Cote projetée (Ⓟ) ou exigence de l'enveloppe (Ⓔ) : lettre cerclée après le texte de la cote. */
class CoteProjetee extends Meca {
  readonly nom = "Cote projetée ou exigence de l'enveloppe";
  readonly code = 'G09';
  protected etapes() {
    return ['Cote projetée ou enveloppe. Désigner la cote.'];
  }
  protected entites() {
    return [true];
  }
  protected verifier(_i: number, p: Pt) {
    return coteEn(this.ctx, p) ? null : 'Désigner une cote (près de son écriture).';
  }
  protected questions(): Question[] {
    return [{ texte: "[P] zone de tolérance projetée, [E] exigence de l'enveloppe", defaut: 'E', type: 'texte' }];
  }
  protected appliquer() {
    const c = coteEn(this.ctx, this.pts[0]);
    if (!c) return;
    const lettre = String(this.reponses[0]).trim().toUpperCase().startsWith('P') ? 'P' : 'E';
    const t = c.e.primitives[c.i] as Extract<Primitive, { type: 'texte' }>;
    this.ctx.dessin.remplacerPlusieurs([[c.e, { ...c.e, primitives: [...c.e.primitives, ...lettreCerclee(finTexte(t), t.angle, lettre, t.h)] }]]);
  }
}

/** H09 — Encadrement d'une cote absolue (cote théoriquement exacte) : cadre autour de son texte. */
class Encadrement extends Meca {
  readonly nom = "Encadrement d'une cote absolue";
  readonly code = 'H09';
  protected etapes() {
    return ["Encadrement d'une cote. Désigner la cote."];
  }
  protected entites() {
    return [true];
  }
  protected verifier(_i: number, p: Pt) {
    return coteEn(this.ctx, p) ? null : 'Désigner une cote (près de son écriture).';
  }
  protected appliquer() {
    const c = coteEn(this.ctx, this.pts[0]);
    if (!c) return;
    const t = c.e.primitives[c.i] as Extract<Primitive, { type: 'texte' }>;
    // Le cadre est centré sur le texte quelle que soit sa justification.
    this.ctx.dessin.remplacerPlusieurs([[c.e, { ...c.e, primitives: [...c.e.primitives, ...cadreTexte(t.p, t.texte, t.h, t.angle, t.alignH, t.alignV)] }]]);
  }
}

/** H10 — Visualisation des IT ISO (H7, g6…) : écarts et cote moyenne, écrits sur la cote si on le demande. */
class AjustementISO extends Meca {
  readonly nom = 'Visualisation des IT ISO';
  readonly code = 'H10';
  protected etapes() {
    return ['IT ISO. Désigner une cote.'];
  }
  protected entites() {
    return [true];
  }
  protected verifier(_i: number, p: Pt) {
    return coteEn(this.ctx, p) ? null : 'Désigner une cote (près de son écriture).';
  }
  private lue(): { d: number; classe: string } | null {
    const c = this.pts[0] ? coteEn(this.ctx, this.pts[0]) : null;
    return c ? lireClasse((c.e.primitives[c.i] as Extract<Primitive, { type: 'texte' }>).texte) : null;
  }
  protected questions(): Question[] {
    const q: Question[] = [];
    if (!this.lue()) q.push({ texte: 'Classe de tolérance ISO (ex. H7, g6)', defaut: 'H7', type: 'texte' });
    q.push({ texte: 'Écrire les écarts sur la cote [O/N]', defaut: 'N', type: 'texte' });
    return q;
  }
  valeur(v: number | string) {
    super.valeur(v);
    // Après la classe : le résultat s'affiche avant la dernière question.
    if (this.reponses.length === this.questions().length - 1 && this.pts.length) this.ctx.dire(this.resultat()?.message ?? '');
  }
  private resultat(): { message: string; es: number; ei: number; t: Extract<Primitive, { type: 'texte' }>; e: Entite } | null {
    const c = coteEn(this.ctx, this.pts[0]);
    if (!c) return null;
    const t = c.e.primitives[c.i] as Extract<Primitive, { type: 'texte' }>;
    const lue = this.lue();
    const d = lue?.d ?? Number(String(c.e.params?.valeur ?? '').replace(',', '.')) ?? 0;
    const classe = lue?.classe ?? String(this.reponses[0]).trim();
    const r = ecartsISO(d, classe);
    if (!r) return { message: `Pas d'I.T. normalisé sur cette cote (${classe} pour ${nombre(d)}).`, es: 0, ei: 0, t, e: c.e };
    const moyenne = d + (r.es + r.ei) / 2;
    return { message: `I.T. ISO : ${nombre(d)} ${classe} = ${texteEcart(r.es)} / ${texteEcart(r.ei)} (IT ${nombre(r.it * 1000)} µm).  Cote moy : ${nombre(moyenne, 4)}`, es: r.es, ei: r.ei, t, e: c.e };
  }
  protected appliquer() {
    const r = this.resultat();
    if (!r) return;
    this.ctx.dire(r.message);
    if (!String(this.reponses[this.reponses.length - 1]).trim().toUpperCase().startsWith('O') || r.message.startsWith('Pas')) return;
    const fin = finTexte(r.t);
    const p = surCercle(fin, r.t.h * 0.3, r.t.angle);
    const hh = r.t.h * 0.6;
    const ecarts: Primitive[] = [
      { type: 'texte', p: surCercle(p, hh * 0.15, r.t.angle + 90), h: hh, angle: r.t.angle, texte: texteEcart(r.es), alignH: 'gauche', alignV: 'bas' },
      { type: 'texte', p: surCercle(p, hh * 0.15, r.t.angle - 90), h: hh, angle: r.t.angle, texte: texteEcart(r.ei), alignH: 'gauche', alignV: 'haut' },
    ];
    this.ctx.dessin.remplacerPlusieurs([[r.e, { ...r.e, primitives: [...r.e.primitives, ...ecarts] }]]);
  }
}

// ======================================================================= G10 : cotation par coordonnées

/** G10 — Cotation par coordonnées : origine, points numérotés, puis tableau des coordonnées (N°, X, Y). */
class CotationCoordonnees implements Fonction {
  readonly nom = 'Cotation par coordonnées';
  readonly code = 'G10';
  private origine: Pt | null = null;
  private points: Pt[] = [];
  private placerTableau = false;
  constructor(private ctx: Contexte) {}
  invite() {
    if (!this.origine) return 'Cotation par coordonnées. Désigner l\'origine des coordonnées.';
    if (this.placerTableau) return 'Cotation par coordonnées. Désigner le coin supérieur gauche du tableau.';
    return `Cotation par coordonnées. Désigner le point ${this.points.length + 1} (Entrée : placer le tableau).`;
  }
  question(): Question | null {
    return null;
  }
  valeur() {}
  dernierPoint() {
    return this.origine;
  }
  parDefaut() {
    if (this.origine && this.points.length && !this.placerTableau) this.placerTableau = true;
  }
  point(p: Pt) {
    if (!this.origine) {
      this.origine = p;
      return;
    }
    if (!this.placerTableau) {
      this.points.push(p);
      return;
    }
    this.tableau(p);
    this.origine = null;
    this.points = [];
    this.placerTableau = false;
  }
  private reperes(): Primitive[] {
    const hh = h();
    return this.points.flatMap((q, i) => [
      { type: 'segment' as const, a: q, b: P(q.x + hh * 0.8, q.y + hh * 0.8) },
      { type: 'texte' as const, p: P(q.x + hh, q.y + hh), h: hh, angle: 0, texte: String(i + 1), alignH: 'gauche' as const, alignV: 'ligne' as const },
    ]);
  }
  private tableau(coin: Pt) {
    const o = this.origine!;
    const hh = h();
    const lignes = [['N°', 'X', 'Y'], ...this.points.map((q, i) => [String(i + 1), texteCote(q.x - o.x), texteCote(q.y - o.y)])];
    const prims = [...this.reperes(), ...grille(coin, lignes, hh), ...croixOrigine(o, hh)];
    this.ctx.dessin.ajouter(habillage(this.ctx, prims, { coordonnees: this.points.length }, [o, coin]));
    this.ctx.dire(`Cotation par coordonnées : ${this.points.length} point${this.points.length > 1 ? 's' : ''}.`);
  }
  elastique(r: Pt): Primitive[] {
    return [...this.reperes(), ...(this.origine ? croixOrigine(this.origine, h()) : []), ...(this.placerTableau ? [seg(r, P(r.x + 30, r.y)), seg(r, P(r.x, r.y - 10))] : [])];
  }
  abandon() {
    const auDebut = !this.origine;
    this.origine = null;
    this.points = [];
    this.placerTableau = false;
    return auDebut;
  }
}

const croixOrigine = (o: Pt, hh: number): Primitive[] => [seg(P(o.x - hh, o.y), P(o.x + hh, o.y)), seg(P(o.x, o.y - hh), P(o.x, o.y + hh)), { type: 'cercle', c: o, r: hh * 0.4 }];

/** Tableau de textes : coin supérieur gauche, une ligne par entrée, colonnes à la largeur du plus long texte. */
function grille(coin: Pt, lignes: string[][], hh: number): Primitive[] {
  const nc = Math.max(...lignes.map((l) => l.length));
  const largeurs = Array.from({ length: nc }, (_, j) => Math.max(...lignes.map((l) => largeurTexte(l[j] ?? '', hh))) + hh);
  const pas = 2 * hh;
  const total = largeurs.reduce((a, b) => a + b, 0);
  const out: Primitive[] = [];
  for (let i = 0; i <= lignes.length; i++) out.push(seg(P(coin.x, coin.y - i * pas), P(coin.x + total, coin.y - i * pas)));
  let x = coin.x;
  out.push(seg(P(x, coin.y), P(x, coin.y - lignes.length * pas)));
  largeurs.forEach((l, j) => {
    lignes.forEach((ligne, i) => out.push({ type: 'texte', p: P(x + l / 2, coin.y - i * pas - pas / 2), h: hh, angle: 0, texte: ligne[j] ?? '', alignH: 'centre', alignV: 'milieu' }));
    x += l;
    out.push(seg(P(x, coin.y), P(x, coin.y - lignes.length * pas)));
  });
  return out;
}

// ======================================================================= Trous (G11, G12, H11, H12)

function entiteTrou(ctx: Contexte, traits: TraitTrou[], params: Record<string, unknown>, extras: Pt[]): Entite {
  const style = (t: TraitTrou): Trait => (t.axe ? 'mixte-fin' : t.fort ? 'continu-fort' : 'continu-fin');
  return {
    genre: 'piece',
    primitives: traits.map((t) => t.prim),
    styles: traits.map((t) => ({ trait: style(t) })),
    extras: extras.map((p) => ({ p, type: 'extremite' })),
    niveau: ctx.attributs().niveau,
    trait: 'continu-fort',
    params,
  };
}

/** G11, G12 — Trou taraudé de profil (borgne ou débouchant). */
function trouProfil(code: string, debouchant: boolean) {
  const nom = debouchant ? 'Trou taraudé débouchant' : 'Trou taraudé borgne';
  return class extends Meca {
    readonly nom = nom;
    readonly code = code;
    protected etapes() {
      return [`${nom}. Désigner le centre de l'entrée du trou.`, `${nom}. Désigner un point de l'axe (direction du trou).`];
    }
    protected verifier(i: number, p: Pt) {
      return i === 1 && dist(p, this.pts[0]) < 1e-6 ? 'Point confondu avec l\'entrée du trou.' : null;
    }
    protected questions(): Question[] {
      const d = num(this.reponses[0], this.ctx.memoire.get('taraudage') ?? 10);
      const q: Question[] = [{ texte: 'Diamètre nominal (M)', defaut: this.ctx.memoire.get('taraudage') ?? 10 }];
      if (debouchant) q.push({ texte: 'Longueur du taraudage (épaisseur)', defaut: 2 * d });
      else {
        const t = num(this.reponses[1], 1.5 * d);
        q.push({ texte: 'Profondeur du taraudage', defaut: 1.5 * d }, { texte: 'Profondeur du perçage', defaut: Math.round((t + 0.5 * d) * 10) / 10 });
      }
      return q;
    }
    protected appliquer() {
      const d = num(this.reponses[0], 10);
      this.ctx.memoire.set('taraudage', d);
      const t = num(this.reponses[1], debouchant ? 2 * d : 1.5 * d);
      const p = debouchant ? t : Math.max(t, num(this.reponses[2], t + 0.5 * d));
      const traits = trouTaraude(this.pts[0], this.pts[1], d, t, p, debouchant);
      this.ctx.dessin.ajouter(entiteTrou(this.ctx, traits, { taraudage: `M${nombre(d)}`, pas: filetage(d).pas, profondeur: t }, [this.pts[0]]));
      this.ctx.dire(`Taraudage M${nombre(d)} x ${nombre(filetage(d).pas)}, perçage Ø${nombre(filetage(d).percage)}.`);
    }
    protected apercu(r: Pt) {
      if (this.pts.length !== 1 || dist(r, this.pts[0]) < 1e-6) return [];
      const d = this.ctx.memoire.get('taraudage') ?? 10;
      return trouTaraude(this.pts[0], r, d, 1.5 * d, 2 * d, debouchant).map((t) => t.prim);
    }
  };
}

/** H11 — Trou taraudé vu de dessus. */
class TrouDessus extends Meca {
  readonly nom = 'Trou taraudé vu de dessus';
  readonly code = 'H11';
  protected etapes() {
    return ['Trou taraudé vu de dessus. Désigner le centre du trou.'];
  }
  protected questions(): Question[] {
    return [{ texte: 'Diamètre nominal (M)', defaut: this.ctx.memoire.get('taraudage') ?? 10 }];
  }
  protected appliquer() {
    const d = num(this.reponses[0], 10);
    this.ctx.memoire.set('taraudage', d);
    this.ctx.dessin.ajouter(entiteTrou(this.ctx, trouTaraudeDessus(this.pts[0], d), { taraudage: `M${nombre(d)}` }, [this.pts[0]]));
  }
}

/** H12 — Trou borgne lisse. */
class TrouBorgneLisse extends Meca {
  readonly nom = 'Trou borgne lisse';
  readonly code = 'H12';
  protected etapes() {
    return ["Trou borgne lisse. Désigner le centre de l'entrée du trou.", "Trou borgne lisse. Désigner un point de l'axe (direction du trou)."];
  }
  protected verifier(i: number, p: Pt) {
    return i === 1 && dist(p, this.pts[0]) < 1e-6 ? "Point confondu avec l'entrée du trou." : null;
  }
  protected questions(): Question[] {
    const D = num(this.reponses[0], this.ctx.memoire.get('percage') ?? 10);
    return [
      { texte: 'Diamètre du perçage', defaut: this.ctx.memoire.get('percage') ?? 10 },
      { texte: 'Profondeur', defaut: 2 * D },
    ];
  }
  protected appliquer() {
    const D = num(this.reponses[0], 10);
    this.ctx.memoire.set('percage', D);
    this.ctx.dessin.ajouter(entiteTrou(this.ctx, trouLisse(this.pts[0], this.pts[1], D, num(this.reponses[1], 2 * D)), { percage: D }, [this.pts[0]]));
  }
  protected apercu(r: Pt) {
    if (this.pts.length !== 1 || dist(r, this.pts[0]) < 1e-6) return [];
    const D = this.ctx.memoire.get('percage') ?? 10;
    return trouLisse(this.pts[0], r, D, 2 * D).map((t) => t.prim);
  }
}

// ======================================================================= H07, H08 : référence et rugosité

/** Prochaine lettre de référence libre (A, B, C… ; I, O et Q sont évités). */
function lettreLibre(ctx: Contexte): string {
  const prises = new Set(ctx.dessin.toutes.map((e) => String(e.params?.reference ?? '')));
  for (const l of 'ABCDEFGHJKLMNPRSTUVWXYZ') if (!prises.has(l)) return l;
  return 'A';
}

/** H07 — Surface de référence : triangle noirci sur la surface, lettre encadrée. */
class SurfaceReference extends Meca {
  readonly nom = 'Surface de référence';
  readonly code = 'H07';
  protected etapes() {
    return ['Surface de référence. Désigner la surface.', 'Surface de référence. Désigner la position de la lettre.'];
  }
  protected entites() {
    return [true, false];
  }
  protected verifier(i: number, p: Pt) {
    return i === 0 && !surEntite(this.ctx, p) ? 'Désigner la surface (un trait du dessin).' : null;
  }
  protected questions(): Question[] {
    return [{ texte: 'Lettre de la référence', defaut: lettreLibre(this.ctx), type: 'texte' }];
  }
  protected appliquer() {
    const s = surEntite(this.ctx, this.pts[0]);
    if (!s) return;
    const lettre = String(this.reponses[0]).trim().toUpperCase().slice(0, 2) || lettreLibre(this.ctx);
    this.ctx.dessin.ajouter(habillage(this.ctx, surfaceReference(s.p, s.u, this.pts[1], lettre, h()), { reference: lettre }, [s.p, this.pts[1]]));
  }
  protected apercu(r: Pt) {
    const s = this.pts.length === 1 ? surEntite(this.ctx, this.pts[0]) : null;
    return s ? surfaceReference(s.p, s.u, r, lettreLibre(this.ctx), h()) : [];
  }
}

/** H08 — État de surface : symbole de rugosité posé sur la surface, valeur Ra. */
class EtatSurface extends Meca {
  readonly nom = 'État de surface';
  readonly code = 'H08';
  protected etapes() {
    return ['État de surface. Désigner la surface.', 'État de surface. Désigner le côté du symbole.'];
  }
  protected entites() {
    return [true, false];
  }
  protected verifier(i: number, p: Pt) {
    return i === 0 && !surEntite(this.ctx, p) ? 'Désigner la surface (un trait du dessin).' : null;
  }
  protected questions(): Question[] {
    return [
      { texte: 'Type [1 tout procédé, 2 enlèvement de matière, 3 sans enlèvement]', defaut: this.ctx.memoire.get('rugositeType') ?? 2, entier: true },
      { texte: 'Rugosité Ra (µm)', defaut: '3.2', type: 'texte' },
    ];
  }
  protected appliquer() {
    const s = surEntite(this.ctx, this.pts[0]);
    if (!s) return;
    const type = Math.min(3, Math.max(1, Math.round(num(this.reponses[0], 2)))) as TypeRugosite;
    this.ctx.memoire.set('rugositeType', type);
    const ra = String(this.reponses[1] ?? '').trim();
    this.ctx.dessin.ajouter(habillage(this.ctx, etatSurface(s.p, s.u, this.pts[1], type, ra ? `Ra ${ra}` : '', h()), { rugosite: ra, type }, [s.p]));
  }
  protected apercu(r: Pt) {
    const s = this.pts.length === 1 ? surEntite(this.ctx, this.pts[0]) : null;
    return s ? etatSurface(s.p, s.u, r, 2, 'Ra 3.2', h()) : [];
  }
}

// ======================================================================= Cotation fonctionnelle (G13–G15, H13–H15)

const sensCourant = (ctx: Contexte): Sens => (ctx.memoire.get('sensChaines') === 1 ? 'v' : 'h');
type ParamsCF = {
  cf: 'condition' | 'composante';
  nom: string;
  sens: Sens;
  pos: number;
  tol?: Tolerance;
  // condition
  c1?: number;
  n1?: number;
  c2?: number;
  n2?: number;
  // composante
  condition?: string;
  rang?: number;
  niveau?: number;
  de?: number;
  a?: number;
  signe?: 1 | -1;
};
const cf = (e: Entite): ParamsCF | null => (e.params?.cf ? (e.params as unknown as ParamsCF) : null);

/** Vecteur de cotation fonctionnelle : de `de` à `a` (positions le long des chaînes), à la hauteur `pos`. */
function vecteur(sens: Sens, de: number, a: number, pos: number, double: boolean, texte: string): Primitive[] {
  const Q = (c: number, t: number): Pt => (sens === 'h' ? P(c, t) : P(t, c));
  const hh = h();
  const out: Primitive[] = [seg(Q(de, pos), Q(a, pos)), { type: 'cercle', c: Q(de, pos), r: 0.5 }];
  if (Math.abs(a - de) > 1e-9) out.push(...fleche(Q(a, pos), Q(de, pos), 2.5));
  if (double) out.push(seg(Q(de, pos + 0.7), Q(a, pos + 0.7)));
  // Petites lignes d'attache aux surfaces.
  out.push(seg(Q(de, pos - 1), Q(de, pos + 1.5)), seg(Q(a, pos - 1), Q(a, pos + 1.5)));
  out.push({ type: 'texte', p: Q((de + a) / 2, pos + (double ? 1.4 : 0.8)), h: hh * 0.8, angle: sens === 'h' ? 0 : 90, texte, alignH: 'centre', alignV: 'ligne' });
  return out;
}

function dessinerCF(p: ParamsCF): Primitive[] {
  const nominal = p.cf === 'condition' ? Math.abs((p.c2 ?? 0) - (p.c1 ?? 0)) : Math.abs((p.a ?? 0) - (p.de ?? 0));
  const texte = p.tol ? texteTolerance(p.nom, p.tol) : `${p.nom} = ${nombre(nominal)}`;
  return p.cf === 'condition' ? vecteur(p.sens, p.c1 ?? 0, p.c2 ?? 0, p.pos, true, texte) : vecteur(p.sens, p.de ?? 0, p.a ?? 0, p.pos, false, texte);
}

function entiteCF(ctx: Contexte, p: ParamsCF): Entite {
  return { genre: 'cote', primitives: dessinerCF(p), extras: [], niveau: ctx.attributs().niveau, trait: 'continu-fin', params: p as unknown as Record<string, unknown> };
}

/** Nom libre pour une nouvelle condition : a, b, c… */
function nomLibre(ctx: Contexte): string {
  const pris = new Set(ctx.dessin.toutes.map((e) => cf(e)?.nom).filter(Boolean));
  for (const l of 'abcdefghijklmnopqrstuvwxyz') if (!pris.has(l)) return l;
  return `c${pris.size + 1}`;
}

/** Trace (ou retrace) la chaîne d'une condition ; renvoie le message de compte rendu. */
function tracerChaine(ctx: Contexte, condition: Entite, verifierSurfaces: boolean): string {
  const c = cf(condition)!;
  const surfs = surfaces(visibles(ctx), c.sens);
  if (verifierSurfaces) {
    const existe = (pos: number, n: number) => surfs.some((s) => s.niveau === n && Math.abs(s.c - pos) < 1e-3);
    if (!existe(c.c1!, c.n1!) || !existe(c.c2!, c.n2!)) return `La condition "${c.nom}" n'est plus crédible.`;
  }
  const chaines = chercherChaines(surfs, { c: c.c1!, niveau: c.n1! }, { c: c.c2!, niveau: c.n2! });
  const anciennes = ctx.dessin.toutes.filter((e) => cf(e)?.cf === 'composante' && cf(e)!.condition === c.nom && cf(e)!.sens === c.sens);
  if (chaines.length === 0) {
    if (anciennes.length) ctx.dessin.retirer(...anciennes);
    return `Chaîne ${c.nom} : chaîne de cote non fermée.`;
  }
  const chaine = chaines[0];
  const sensCondition = c.c2! >= c.c1! ? 1 : -1;
  const pas = 2.5 * h();
  const nouvelles = chaine.map((k, i): Entite => {
    const ancienne = anciennes.map(cf).find((a) => a!.niveau === k.niveau && Math.abs(a!.de! - k.de) < 1e-3 && Math.abs(a!.a! - k.a) < 1e-3);
    const p: ParamsCF = {
      cf: 'composante',
      nom: `${c.nom}${i + 1}`,
      sens: c.sens,
      pos: c.pos - (i + 1) * pas,
      condition: c.nom,
      rang: i + 1,
      niveau: k.niveau,
      de: k.de,
      a: k.a,
      signe: (Math.sign(k.a - k.de) * sensCondition >= 0 ? 1 : -1) as 1 | -1,
      ...(ancienne?.tol ? { tol: ancienne.tol } : {}),
    };
    return entiteCF(ctx, p);
  });
  ctx.dessin.remplacerEnsemble(anciennes, nouvelles);
  const formule = nouvelles.map((e) => `${cf(e)!.signe! > 0 ? '+' : '-'}${cf(e)!.nom}`).join(' ');
  return `Chaîne ${c.nom} = ${formule}${chaines.length > 1 ? ` (${chaines.length} chaînes de même longueur : la première est gardée)` : ''}.`;
}

/** Fonction sans points ni questions : elle agit dès qu'elle est choisie, sans quitter la fonction en cours. */
abstract class Immediate implements Fonction {
  abstract readonly nom: string;
  abstract readonly code: string;
  readonly ponctuelle = true;
  constructor(protected ctx: Contexte) {
    queueMicrotask(() => this.agir());
  }
  protected abstract agir(): void;
  termine() {
    return true;
  }
  invite() {
    return '';
  }
  question() {
    return null;
  }
  valeur() {}
  dernierPoint() {
    return null;
  }
  point() {}
  abandon() {
    return true;
  }
  elastique() {
    return [];
  }
}

/** G13 — Bascule chaînes horizontales / verticales. */
class BasculeChaines extends Immediate {
  readonly nom = 'Cotation fonctionnelle : bascule horizontale / verticale';
  readonly code = 'G13';
  protected agir() {
    const v = sensCourant(this.ctx) === 'h';
    this.ctx.memoire.set('sensChaines', v ? 1 : 0);
    this.ctx.dire(v ? 'Chaînes VERTICALES.' : 'Chaînes HORIZONTALES.');
  }
}

/** G14 — Tracé des chaînes de cotes de toutes les conditions (direction en cours). */
class TraceChaines extends Immediate {
  readonly nom = 'Cotation fonctionnelle : tracé des chaînes';
  readonly code = 'G14';
  protected agir() {
    const sens = sensCourant(this.ctx);
    const conditions = this.ctx.dessin.toutes.filter((e) => cf(e)?.cf === 'condition' && cf(e)!.sens === sens);
    if (conditions.length === 0) return this.ctx.dire(`Pas de chaînes de cotes ${sens === 'h' ? 'horizontales' : 'verticales'} : créer d'abord une condition (lien).`);
    this.ctx.dire(conditions.map((c) => tracerChaine(this.ctx, c, false)).join('  '));
  }
}

/** G15 — Régénération des chaînes après des modifications du dessin. */
class RegenerationChaines extends Immediate {
  readonly nom = 'Cotation fonctionnelle : régénération des chaînes';
  readonly code = 'G15';
  protected agir() {
    const sens = sensCourant(this.ctx);
    const conditions = this.ctx.dessin.toutes.filter((e) => cf(e)?.cf === 'condition' && cf(e)!.sens === sens);
    if (conditions.length === 0) return this.ctx.dire('Pas de chaînes de cotes.');
    this.ctx.dire(`Régénération des chaînes. ${conditions.map((c) => tracerChaine(this.ctx, c, true)).join('  ')}`);
  }
}

/** H13 — Création d'un lien (condition fonctionnelle) entre deux surfaces. */
class CreationLien extends Meca {
  readonly nom = 'Cotation fonctionnelle : création de lien';
  readonly code = 'H13';
  private surf(p: Pt) {
    return surfaceEn(surfaces(visibles(this.ctx), sensCourant(this.ctx)), p, sensCourant(this.ctx), this.ctx.rayon() * 1.5);
  }
  protected etapes() {
    return ['Désigner la surface de référence.', 'Désigner la deuxième surface.', 'Désigner la position de la condition.'];
  }
  protected entites() {
    return [true, true, false];
  }
  protected verifier(i: number, p: Pt) {
    const perpendiculaire = sensCourant(this.ctx) === 'h' ? 'verticale' : 'horizontale';
    if (i < 2 && !this.surf(p)) return `Désigner une surface (trait fort ${perpendiculaire}).`;
    if (i === 1) {
      const a = this.surf(this.pts[0])!;
      const b = this.surf(p)!;
      if (a.niveau === b.niveau && Math.abs(a.c - b.c) < 1e-3) return "Surfaces de départ et d'arrivée identiques.";
      const existe = this.ctx.dessin.toutes.some((e) => {
        const c = cf(e);
        return c?.cf === 'condition' && c.sens === sensCourant(this.ctx) && c.n1 === a.niveau && c.n2 === b.niveau && Math.abs(c.c1! - a.c) < 1e-3 && Math.abs(c.c2! - b.c) < 1e-3;
      });
      if (existe) return 'Condition déjà existante.';
    }
    return null;
  }
  protected questions(): Question[] {
    return [{ texte: 'Désignation', defaut: nomLibre(this.ctx), type: 'texte' }];
  }
  protected appliquer() {
    const sens = sensCourant(this.ctx);
    const a = this.surf(this.pts[0]);
    const b = this.surf(this.pts[1]);
    if (!a || !b) return;
    const nom = String(this.reponses[0]).trim() || nomLibre(this.ctx);
    const pos = sens === 'h' ? this.pts[2].y : this.pts[2].x;
    this.ctx.dessin.ajouter(entiteCF(this.ctx, { cf: 'condition', nom, sens, pos, c1: a.c, n1: a.niveau, c2: b.c, n2: b.niveau }));
    this.ctx.dire(`Condition ${nom} créée (${nombre(Math.abs(b.c - a.c))}).`);
  }
  protected apercu(r: Pt) {
    if (this.pts.length !== 2) return [];
    const a = this.surf(this.pts[0]);
    const b = this.surf(this.pts[1]);
    const sens = sensCourant(this.ctx);
    return a && b ? vecteur(sens, a.c, b.c, sens === 'h' ? r.y : r.x, true, nomLibre(this.ctx)) : [];
  }
}

/** H14 — Saisie des résultantes et composantes : cote nominale et écarts d'une condition ou d'une cote de chaîne. */
class SaisieTolerances extends Meca {
  readonly nom = 'Cotation fonctionnelle : saisie des résultantes et composantes';
  readonly code = 'H14';
  private cible(): Entite | null {
    const p = this.pts[0];
    return p ? entiteProche(visibles(this.ctx).filter((e) => cf(e)), p, this.ctx.rayon() * 2) : null;
  }
  protected etapes() {
    return ['Fixation des tolérances. Désigner la cote.'];
  }
  protected entites() {
    return [true];
  }
  protected verifier(_i: number, p: Pt) {
    return entiteProche(visibles(this.ctx).filter((e) => cf(e)), p, this.ctx.rayon() * 2) ? null : 'Désigner une condition ou une cote de chaîne.';
  }
  protected questions(): Question[] {
    const e = this.cible();
    const c = e ? cf(e) : null;
    const nominal = c ? (c.cf === 'condition' ? Math.abs(c.c2! - c.c1!) : Math.abs(c.a! - c.de!)) : 0;
    return [
      { texte: `${c?.nom ?? ''} : cote nominale`, defaut: c?.tol?.nominal ?? Math.round(nominal * 1000) / 1000 },
      { texte: 'Écart supérieur', defaut: c?.tol?.es ?? 0 },
      { texte: 'Écart inférieur', defaut: c?.tol?.ei ?? 0 },
    ];
  }
  protected appliquer() {
    const e = this.cible();
    if (!e) return;
    const c = cf(e)!;
    const tol: Tolerance = { nominal: num(this.reponses[0], 0), es: num(this.reponses[1], 0), ei: num(this.reponses[2], 0), fixe: true };
    if (tol.ei > tol.es) [tol.es, tol.ei] = [tol.ei, tol.es];
    const p = { ...c, tol };
    this.ctx.dessin.remplacerPlusieurs([[e, { ...e, params: p as unknown as Record<string, unknown>, primitives: dessinerCF(p) }]]);
    this.ctx.dire(`${texteTolerance(c.nom, tol)} (fixée).`);
  }
}

/** H15 — Résolution des chaînes de cotes (au pire des cas), puis écriture : tableau ou tolérances sur les cotes. */
class ResolutionChaines implements Fonction {
  readonly nom = 'Cotation fonctionnelle : résolution des chaînes';
  readonly code = 'H15';
  private reponses: (number | string)[] = [];
  private tableau: string[][] | null = null;
  constructor(private ctx: Contexte) {}
  invite() {
    return this.tableau ? 'Désigner le point supérieur droit du tableau.' : '';
  }
  question(): Question | null {
    if (this.reponses.length === 0) return { texte: 'Précision de la résolution [0.1/0.01/0.001]', defaut: this.ctx.memoire.get('precisionCF') ?? 0.01 };
    if (this.reponses.length === 1) return { texte: 'Écriture [1 création d’un tableau, 2 traduction des tolérances]', defaut: 2, entier: true };
    return null;
  }
  valeur(v: number | string) {
    this.reponses.push(v);
    if (this.reponses.length === 2) this.resoudre();
  }
  private resoudre() {
    const precision = [0.1, 0.01, 0.001].reduce((m, p) => (Math.abs(p - num(this.reponses[0], 0.01)) < Math.abs(m - num(this.reponses[0], 0.01)) ? p : m), 0.01);
    this.ctx.memoire.set('precisionCF', precision);
    const sens = sensCourant(this.ctx);
    const d = this.ctx.dessin;
    const conditions = d.toutes.filter((e) => cf(e)?.cf === 'condition' && cf(e)!.sens === sens);
    if (conditions.length === 0) return this.ctx.dire('Pas de chaînes de cotes.');
    const paires: [Entite, Entite][] = [];
    const lignes: string[][] = [['Cote', 'Cote nom.', 'Ecart sup.', 'Ecart inf.', 'Val. moy.', 'IT']];
    const messages: string[] = [];
    const ligne = (nom: string, t: Tolerance) => [
      `${t.fixe ? '==' : '*='} ${nom}`,
      nombre(t.nominal, 3),
      texteEcart(t.es),
      texteEcart(t.ei),
      nombre(t.nominal + (t.es + t.ei) / 2, 4),
      nombre(t.es - t.ei, 3),
    ];
    for (const ce of conditions) {
      const c = cf(ce)!;
      const comps = d.toutes.filter((e) => cf(e)?.cf === 'composante' && cf(e)!.condition === c.nom && cf(e)!.sens === sens).sort((a, b) => cf(a)!.rang! - cf(b)!.rang!);
      if (comps.length === 0) {
        messages.push(`Chaîne ${c.nom} : à tracer d'abord (G14).`);
        continue;
      }
      const nominalCondition = Math.abs(c.c2! - c.c1!);
      const r = resoudre(
        c.tol ?? { nominal: nominalCondition },
        comps.map((e) => {
          const k = cf(e)!;
          return { nominal: Math.abs(k.a! - k.de!), signe: k.signe ?? 1, ...(k.tol ?? {}) };
        }),
        precision,
      );
      if (r.erreur) messages.push(`${c.nom} : ${r.erreur}`);
      const majC = { ...c, tol: r.condition };
      paires.push([ce, { ...ce, params: majC as unknown as Record<string, unknown>, primitives: dessinerCF(majC) }]);
      lignes.push(ligne(c.nom, r.condition));
      comps.forEach((e, i) => {
        const k = { ...cf(e)!, tol: r.composantes[i] };
        paires.push([e, { ...e, params: k as unknown as Record<string, unknown>, primitives: dessinerCF(k) }]);
        lignes.push(ligne(k.nom, r.composantes[i]));
      });
    }
    if (paires.length) d.remplacerPlusieurs(paires);
    this.ctx.dire(`Résolution des chaînes de cotes. ${messages.join('  ') || 'Terminée.'}  == valeurs fixées, *= résultantes recalculées.`);
    if (Math.round(num(this.reponses[1], 2)) === 1) this.tableau = lignes;
    else this.reponses = [];
  }
  dernierPoint() {
    return null;
  }
  point(p: Pt) {
    if (!this.tableau) return;
    const hh = h() * 0.8;
    const prims = grille(P(p.x - this.largeur(hh), p.y), this.tableau, hh);
    this.ctx.dessin.ajouter(habillage(this.ctx, prims, { tableauCF: true }, [p]));
    this.tableau = null;
    this.reponses = [];
  }
  private largeur(hh: number): number {
    const t = this.tableau!;
    return Array.from({ length: t[0].length }, (_, j) => Math.max(...t.map((l) => largeurTexte(l[j] ?? '', hh))) + hh).reduce((a, b) => a + b, 0);
  }
  elastique(r: Pt): Primitive[] {
    return this.tableau ? [seg(r, P(r.x - this.largeur(h() * 0.8), r.y))] : [];
  }
  abandon() {
    const auDebut = this.reponses.length === 0 && !this.tableau;
    this.reponses = [];
    this.tableau = null;
    return auDebut;
  }
}

/** Cases de la palette MECA de cotation (2 lignes de 15), avec leur infobulle d'origine. */
export const CASES_MECA_COTATION: { code: string; libelle: string }[] = [
  { code: 'G01', libelle: 'Cotation de forme et position: parallélisme.' },
  { code: 'G02', libelle: 'Cotation de forme et position: perpendicularité.' },
  { code: 'G03', libelle: 'Cotation de forme et position: localisation.' },
  { code: 'G04', libelle: 'Cotation de forme et position: coaxialité/concentricité.' },
  { code: 'G05', libelle: 'Cotation de forme et position: symétrie.' },
  { code: 'G06', libelle: 'Cotation de forme et position: inclinaison.' },
  { code: 'G07', libelle: 'Cotation de forme et position: battement simple.' },
  { code: 'G08', libelle: 'Cotation de forme et position: battement double.' },
  { code: 'G09', libelle: "Cote projetée ou exigence de l'enveloppe." },
  { code: 'G10', libelle: 'Cotation par coordonnées.' },
  { code: 'G11', libelle: 'Trou taraudé borgne (de profil).' },
  { code: 'G12', libelle: 'Trou taraudé débouchant (de profil).' },
  { code: 'G13', libelle: 'Cotation fonctionnelle: bascule chaines horiz./vertic.' },
  { code: 'G14', libelle: 'Cotation fonctionnelle: tracé des chaines.' },
  { code: 'G15', libelle: 'Cotation fonctionnelle: régénération des chaines.' },
  { code: 'H01', libelle: 'Cotation de forme et position: planéité.' },
  { code: 'H02', libelle: 'Cotation de forme et position: rectitude.' },
  { code: 'H03', libelle: 'Cotation de forme et position: cylindricité.' },
  { code: 'H04', libelle: 'Cotation de forme et position: circularité.' },
  { code: 'H05', libelle: 'Cotation de forme et position: surface quelconque.' },
  { code: 'H06', libelle: 'Cotation de forme et position: ligne quelconque.' },
  { code: 'H07', libelle: 'Surface de référence.' },
  { code: 'H08', libelle: 'État de surface (rugosité).' },
  { code: 'H09', libelle: "Encadrement d'une cote absolue." },
  { code: 'H10', libelle: 'Visualisation des IT ISO du type H8, g6 etc.' },
  { code: 'H11', libelle: 'Trou taraudé vu de dessus.' },
  { code: 'H12', libelle: 'Trou borgne lisse.' },
  { code: 'H13', libelle: 'Cotation fonctionnelle: création de lien.' },
  { code: 'H14', libelle: 'Cotation fonct.: saisie des résultantes et composantes.' },
  { code: 'H15', libelle: 'Cotation fonctionnelle: résolution des chaines de cotes.' },
];

/** Symbole de chaque case de tolérance géométrique (aussi pour les icônes). */
export const SYMBOLES_CASES: Record<string, SymboleTolerance> = {
  G01: 'parallelisme',
  G02: 'perpendicularite',
  G03: 'localisation',
  G04: 'coaxialite',
  G05: 'symetrie',
  G06: 'inclinaison',
  G07: 'battement',
  G08: 'battementTotal',
  H01: 'planeite',
  H02: 'rectitude',
  H03: 'cylindricite',
  H04: 'circularite',
  H05: 'surface',
  H06: 'ligne',
};

const tolerances = Object.fromEntries(
  Object.entries(SYMBOLES_CASES).map(([code, sym]) => [code, tolerance(code, sym, CASES_MECA_COTATION.find((c) => c.code === code)!.libelle.replace(/^Cotation de forme et position: /, 'Tolérance de ').replace(/\.$/, ''))]),
);

enregistrerFonctions({
  ...tolerances,
  G09: CoteProjetee,
  G10: CotationCoordonnees,
  G11: trouProfil('G11', false),
  G12: trouProfil('G12', true),
  G13: BasculeChaines,
  G14: TraceChaines,
  G15: RegenerationChaines,
  H07: SurfaceReference,
  H08: EtatSurface,
  H09: Encadrement,
  H10: AjustementISO,
  H11: TrouDessus,
  H12: TrouBorgneLisse,
  H13: CreationLien,
  H14: SaisieTolerances,
  H15: ResolutionChaines,
});
