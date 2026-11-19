// Le dessin en mémoire : des entités faites de primitives (segments, droites, cercles, arcs).
// Un rectangle, un polygone ou un oblong est une seule entité (aide d'origine : « ce tracé est
// considéré comme une entité »), même s'il est fait de plusieurs primitives.
import { aciNiveau } from './couleurs';
import type { ImageStockee } from './images';
import { dist, type PointCaracteristique, type Pt } from './geometrie';
import { angleDe, arcTroisPoints, norm, surCercle, type Primitive } from './primitives';

export type Trait =
  | 'continu-fort'
  | 'pointille-fin'
  | 'mixte-fin'
  | 'continu-fin'
  // Traits spéciaux (case F15)
  | 'mixte-fort'
  | 'mixte-fin-2'
  | 'mixte-fin-3'
  | 'limite-coupe'
  | 'pointille-long'
  | 'invisible';

export type Genre =
  | 'segment'
  | 'droite'
  | 'demi-droite'
  | 'cercle'
  | 'arc'
  | 'rectangle'
  | 'polygone'
  | 'oblong'
  | 'polyligne'
  | 'texte'
  | 'point'
  | 'cote'
  | 'groupe'
  | 'ellipse'
  | 'courbe'
  | 'axes'
  | 'hachure'
  | 'repere'
  | 'fleche'
  | 'image'
  | 'piece'
  | 'jointe';

export interface Entite {
  genre: Genre;
  primitives: Primitive[];
  /** Points repérables propres à l'entité, en plus de ceux de ses primitives (ex. milieu d'un rectangle). */
  extras: PointCaracteristique[];
  niveau: number;
  trait: Trait;
  /** Couleur imposée (index ACI d'un DXF importé). Sinon : la couleur du niveau. */
  couleur?: number;
  /** Calque DXF d'origine (dessins importés). Sinon : le numéro du niveau. */
  calque?: string;
  /** Style propre à chaque primitive, quand ils diffèrent (blocs importés : cotes, cartouche…). */
  styles?: { couleur?: number; trait?: Trait }[];
  /**
   * Réglages qui permettent de recalculer l'entité (courbe fermée, motif de hachures, texte d'une cote…).
   * Les points, eux, sont dans `extras`, pour suivre les transformations. Enregistrés dans le DXF.
   */
  params?: Record<string, unknown>;
}

export interface Calque {
  couleur: number; // index ACI
}

/** Renseignements d'un niveau (case F3 « Nomenclature », case F20 « Échelle d'un niveau »). */
export interface InfosNiveau {
  designation?: string;
  reference?: string;
  /** Échelle du niveau (1 par défaut) : une cote faite sur ce niveau affiche la longueur divisée par l'échelle. */
  echelle?: number;
}

/** Paramètres du plan (case F1) : fichier d'application, éditeur, plan. */
export interface InfosPlan {
  fichier?: string;
  societe?: string;
  departement?: string;
  service?: string;
  dessinateur?: string;
  designation?: string;
  reference?: string;
  revision?: string;
}

/** Fenêtre nommée (case F9) : diagonale et liste des niveaux à représenter. */
export interface FenetreNommee {
  a: Pt;
  b: Pt;
  niveaux: string;
}

/** Ce qui est enregistré avec le dessin en plus des entités. */
export interface InfosDessin {
  plan: InfosPlan;
  niveaux: Record<string, InfosNiveau>;
  fenetres: Record<string, FenetreNommee>;
}

export const infosVides = (): InfosDessin => ({ plan: {}, niveaux: {}, fenetres: {} });

/** Un état du dessin, pour l'annulation illimitée (les entités ne sont jamais modifiées sur place). */
interface Etat {
  entites: Entite[];
  annulee: Entite[] | null;
  calques: [string, Calque][];
  infos: InfosDessin;
}

/** Nombre d'actions gardées pour Edition > Annuler (« illimitée » en pratique). */
const LIMITE_HISTORIQUE = 2000;

export class Dessin {
  private entites: Entite[] = [];
  /** Dernières entités annulées, restituables tant qu'aucune entité n'a été créée depuis. */
  private annulee: Entite[] | null = null;
  /** Calques des DXF importés (nom -> couleur), réécrits à l'enregistrement ; aussi la couleur forcée d'un niveau (F19). */
  readonly calques = new Map<string, Calque>();
  private _infos: InfosDessin = infosVides();
  /** Images gardées avec le dessin (cases B1 à B4), par identifiant ; leur contenu ne change jamais. */
  readonly images = new Map<string, ImageStockee>();
  /** Modifié depuis le dernier enregistrement ? */
  modifie = false;
  /** Compteur de changements (pour savoir quand redessiner ou recalculer). */
  version = 0;
  /** Historique pour Edition > Annuler / Refaire (nouveauté : l'original n'annulait que la dernière entité). */
  private passe: Etat[] = [];
  private futur: Etat[] = [];
  private actionOuverte = false;

  private change(): void {
    this.modifie = true;
    this.version++;
  }

  private etat(): Etat {
    return { entites: [...this.entites], annulee: this.annulee, calques: [...this.calques], infos: this._infos };
  }

  private restaurer(e: Etat): void {
    this.entites = [...e.entites];
    this.annulee = e.annulee;
    this.calques.clear();
    for (const [k, v] of e.calques) this.calques.set(k, v);
    this._infos = e.infos;
  }

  /** Paramètres du plan, renseignements des niveaux, fenêtres nommées (jamais modifiés sur place). */
  get infos(): InfosDessin {
    return this._infos;
  }

  /** Modifie les renseignements du dessin (une étape d'annulation). */
  changerInfos(f: (infos: InfosDessin) => void): void {
    this.memoriser();
    const copie = structuredClone(this._infos);
    f(copie);
    this._infos = copie;
    this.change();
  }

  /** Couleur (index ACI) d'un niveau : celle forcée par la case F19, sinon celle du cycle de l'original. */
  couleurNiveau(n: number): number {
    return this.calques.get(String(n))?.couleur ?? aciNiveau(n);
  }

  /** Case F19 : couleur forcée des niveaux. */
  changerCouleurNiveaux(niveaux: Iterable<number>, aci: number): void {
    this.memoriser();
    // La couleur du cycle d'origine n'a pas besoin d'être forcée : le niveau la reprend.
    for (const n of niveaux) {
      if (aci === aciNiveau(n)) this.calques.delete(String(n));
      else this.calques.set(String(n), { couleur: aci });
    }
    this.change();
  }

  /** Échelle d'un niveau (case F20), 1 par défaut. */
  echelleNiveau(n: number): number {
    const e = this._infos.niveaux[String(n)]?.echelle;
    return typeof e === 'number' && e > 0 ? e : 1;
  }

  /** Niveaux qui ont au moins une entité, dans l'ordre. */
  get niveauxOccupes(): number[] {
    return [...new Set(this.entites.map((e) => e.niveau))].sort((a, b) => a - b);
  }

  /**
   * Mémorise l'état avant un changement. Tous les changements faits pendant une même action de
   * l'utilisateur (un clic, une touche) forment une seule étape d'annulation.
   */
  private memoriser(): void {
    if (this.actionOuverte) return;
    this.passe.push(this.etat());
    if (this.passe.length > LIMITE_HISTORIQUE) this.passe.shift();
    this.futur = [];
    this.actionOuverte = true;
    queueMicrotask(() => (this.actionOuverte = false));
  }

  get peutAnnuler(): boolean {
    return this.passe.length > 0;
  }

  get peutRefaire(): boolean {
    return this.futur.length > 0;
  }

  /** Edition > Annuler : revient à l'état d'avant la dernière action, aussi loin qu'on veut. */
  annulerAction(): boolean {
    const e = this.passe.pop();
    if (!e) return false;
    this.futur.push(this.etat());
    this.restaurer(e);
    this.change();
    return true;
  }

  /** Edition > Refaire : rétablit l'action annulée. */
  refaireAction(): boolean {
    const e = this.futur.pop();
    if (!e) return false;
    this.passe.push(this.etat());
    this.restaurer(e);
    this.change();
    return true;
  }

  /** Remplace tout le dessin (Nouveau, Ouvrir). */
  remplacer(entites: Entite[], calques: Map<string, Calque> = new Map(), infos: InfosDessin = infosVides(), images: Map<string, ImageStockee> = new Map()): void {
    this._infos = infos;
    this.images.clear();
    for (const [k, v] of images) this.images.set(k, v);
    this.entites = [...entites];
    this.annulee = null;
    this.passe = [];
    this.futur = [];
    this.calques.clear();
    for (const [k, v] of calques) this.calques.set(k, v);
    this.modifie = false;
    this.version++;
  }

  /** Ajoute des entités d'un autre dessin (Fusionner). */
  fusionner(entites: Entite[], calques: Map<string, Calque>): void {
    this.memoriser();
    this.entites.push(...entites);
    for (const [k, v] of calques) if (!this.calques.has(k)) this.calques.set(k, v);
    this.change();
  }

  /** Retire des entités précises (annulation d'une entité, par fenêtre) ; elles restent restituables. */
  retirer(...es: Entite[]): number {
    const retirees = es.filter((e) => this.entites.includes(e));
    if (retirees.length === 0) return 0;
    this.memoriser();
    this.entites = this.entites.filter((e) => !retirees.includes(e));
    this.annulee = retirees;
    this.change();
    return retirees.length;
  }

  /** Ajoute plusieurs entités d'un coup (duplications). */
  ajouterPlusieurs(es: Entite[]): void {
    if (es.length === 0) return;
    this.memoriser();
    this.entites.push(...es);
    this.annulee = null;
    this.change();
  }

  /** Remplace plusieurs entités par leurs nouvelles versions (transformations). */
  remplacerPlusieurs(paires: [Entite, Entite][]): void {
    this.memoriser();
    for (const [ancienne, nouvelle] of paires) {
      const i = this.entites.indexOf(ancienne);
      if (i >= 0) this.entites[i] = nouvelle;
    }
    this.annulee = null;
    this.change();
  }

  /** Remplace une entité par d'autres (effacement partiel, modification). */
  remplacerEntite(e: Entite, par: Entite[]): void {
    const i = this.entites.indexOf(e);
    if (i < 0) return;
    this.memoriser();
    this.entites.splice(i, 1, ...par);
    this.annulee = null;
    this.change();
  }

  /** Remplace un ensemble d'entités par d'autres, à la place de la première (création d'un groupe, mise à jour). */
  remplacerEnsemble(anciennes: readonly Entite[], nouvelles: Entite[]): void {
    const indices = anciennes.map((e) => this.entites.indexOf(e)).filter((i) => i >= 0);
    if (indices.length === 0 && nouvelles.length === 0) return;
    this.memoriser();
    const i = indices.length ? Math.min(...indices) : this.entites.length;
    const reste = this.entites.filter((e, j) => j < i && !anciennes.includes(e));
    const apres = this.entites.filter((e, j) => j >= i && !anciennes.includes(e));
    this.entites = [...reste, ...nouvelles, ...apres];
    this.annulee = null;
    this.change();
  }

  /** Remplace chaque entité par une autre, à sa place (une seule annulation pour l'ensemble). */
  remplacerChaque(paires: readonly { avant: Entite; apres: Entite }[]): void {
    const par = new Map(paires.map((p) => [p.avant, p.apres]));
    if (!this.entites.some((e) => par.has(e))) return;
    this.memoriser();
    this.entites = this.entites.map((e) => par.get(e) ?? e);
    this.annulee = null;
    this.change();
  }

  get toutes(): readonly Entite[] {
    return this.entites;
  }

  private cache: { version: number; primitives: Primitive[]; extras: PointCaracteristique[] } | null = null;

  /** Toutes les primitives (gardées en mémoire jusqu'au changement suivant : l'accrochage visible les lit à chaque mouvement). */
  get primitives(): Primitive[] {
    return this.listes().primitives;
  }

  get extras(): PointCaracteristique[] {
    return this.listes().extras;
  }

  private listes() {
    if (this.cache?.version !== this.version) {
      this.cache = { version: this.version, primitives: this.entites.flatMap((e) => e.primitives), extras: this.entites.flatMap((e) => e.extras) };
    }
    return this.cache;
  }

  ajouter(e: Entite): void {
    this.memoriser();
    this.entites.push(e);
    this.annulee = null;
    this.change();
  }

  /** Annule la dernière entité créée. */
  annulerDerniere(): Entite | null {
    if (this.entites.length) this.memoriser();
    const e = this.entites.pop() ?? null;
    if (e) {
      this.annulee = [e];
      this.change();
    }
    return e;
  }

  /** Restitue la dernière entité annulée. */
  restituer(): Entite | null {
    const es = this.annulee;
    if (es) {
      this.memoriser();
      this.entites.push(...es);
      this.annulee = null;
      this.change();
    }
    return es?.[0] ?? null;
  }

  /** Maj + clic gauche, case « Annulation / Restitution » : fonctionnement en bascule. */
  basculer(): 'annulee' | 'restituee' | null {
    if (this.annulee) return this.restituer() ? 'restituee' : null;
    return this.annulerDerniere() ? 'annulee' : null;
  }

  /** Taille approximative du fichier, pour le tableau de bord (en Ko, au moins 1). */
  get tailleKo(): number {
    const n = this.entites.reduce((s, e) => s + e.primitives.length, 0);
    return Math.max(1, Math.ceil((n * 48) / 1024));
  }
}

// ---------------------------------------------------------------- Constructeurs d'entités

type Attributs = { niveau: number; trait: Trait };
const entite = (genre: Genre, primitives: Primitive[], extras: PointCaracteristique[], at: Attributs): Entite => ({
  genre,
  primitives,
  extras,
  ...at,
});
const seg = (a: Pt, b: Pt): Primitive => ({ type: 'segment', a: { ...a }, b: { ...b } });
const milieu = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function segment(a: Pt, b: Pt, niveau: number, trait: Trait): Entite {
  return entite('segment', [seg(a, b)], [], { niveau, trait });
}

export function droite(a: Pt, b: Pt, at: Attributs): Entite {
  return entite('droite', [{ type: 'droite', a: { ...a }, b: { ...b } }], [], at);
}

export function demiDroite(a: Pt, b: Pt, at: Attributs): Entite {
  return entite('demi-droite', [{ type: 'demi-droite', a: { ...a }, b: { ...b } }], [], at);
}

export function cercle(c: Pt, r: number, at: Attributs): Entite {
  return entite('cercle', [{ type: 'cercle', c: { ...c }, r }], [], at);
}

export function arc(c: Pt, r: number, debut: number, fin: number, at: Attributs): Entite {
  return entite('arc', [{ type: 'arc', c: { ...c }, r, debut: norm(debut), fin: norm(fin) }], [], at);
}

export function arc3Points(p1: Pt, p2: Pt, p3: Pt, at: Attributs): Entite | null {
  const a = arcTroisPoints(p1, p2, p3);
  return a ? arc(a.c, a.r, a.debut, a.fin, at) : null;
}

/** Rectangle aux côtés horizontaux et verticaux, défini par une diagonale. Repérable en son milieu. */
export function rectangle(a: Pt, b: Pt, at: Attributs): Entite {
  const p = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
  return entite('rectangle', p.map((q, i) => seg(q, p[(i + 1) % 4])), [{ p: milieu(a, b), type: 'milieu' }], at);
}

/** Rectangle à angles arrondis : rayon maximal = moitié du plus petit côté. */
export function rayonMaxArrondi(a: Pt, b: Pt): number {
  return Math.min(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / 2;
}

export function rectangleArrondi(a: Pt, b: Pt, r: number, at: Attributs): Entite {
  if (r <= 1e-9) return rectangle(a, b, at);
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  const prims: Primitive[] = [];
  const cote = (p: Pt, q: Pt) => dist(p, q) > 1e-9 && prims.push(seg(p, q));
  cote({ x: x0 + r, y: y0 }, { x: x1 - r, y: y0 });
  cote({ x: x1, y: y0 + r }, { x: x1, y: y1 - r });
  cote({ x: x1 - r, y: y1 }, { x: x0 + r, y: y1 });
  cote({ x: x0, y: y1 - r }, { x: x0, y: y0 + r });
  prims.push(
    { type: 'arc', c: { x: x1 - r, y: y0 + r }, r, debut: 270, fin: 0 },
    { type: 'arc', c: { x: x1 - r, y: y1 - r }, r, debut: 0, fin: 90 },
    { type: 'arc', c: { x: x0 + r, y: y1 - r }, r, debut: 90, fin: 180 },
    { type: 'arc', c: { x: x0 + r, y: y0 + r }, r, debut: 180, fin: 270 },
  );
  return entite('rectangle', prims, [{ p: milieu(a, b), type: 'milieu' }], at);
}

/** Rectangle incliné : une médiane (m1, m2) et un point `p` sur un côté parallèle à cette médiane. */
export function rectangleIncline(m1: Pt, m2: Pt, p: Pt, at: Attributs): Entite | null {
  const l = dist(m1, m2);
  if (l < 1e-9) return null;
  const n = { x: -(m2.y - m1.y) / l, y: (m2.x - m1.x) / l };
  const w = Math.abs((p.x - m1.x) * n.x + (p.y - m1.y) * n.y);
  if (w < 1e-9) return null;
  const c = [
    { x: m1.x + n.x * w, y: m1.y + n.y * w },
    { x: m2.x + n.x * w, y: m2.y + n.y * w },
    { x: m2.x - n.x * w, y: m2.y - n.y * w },
    { x: m1.x - n.x * w, y: m1.y - n.y * w },
  ];
  return entite('rectangle', c.map((q, i) => seg(q, c[(i + 1) % 4])), [{ p: milieu(m1, m2), type: 'milieu' }], at);
}

/** Rectangle à bouts ronds : `a` et `b` sont les points extrêmes sur l'axe, `largeur` ≤ longueur. */
export function oblong(a: Pt, b: Pt, largeur: number, at: Attributs): Entite | null {
  const l = dist(a, b);
  const r = largeur / 2;
  if (l < 1e-9 || r <= 1e-9 || largeur > l + 1e-9) return null;
  const u = { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
  const n = { x: -u.y, y: u.x };
  const ca = { x: a.x + u.x * r, y: a.y + u.y * r };
  const cb = { x: b.x - u.x * r, y: b.y - u.y * r };
  const t = angleDe(a, b);
  const prims: Primitive[] = [];
  if (dist(ca, cb) > 1e-9) {
    prims.push(
      seg({ x: ca.x + n.x * r, y: ca.y + n.y * r }, { x: cb.x + n.x * r, y: cb.y + n.y * r }),
      seg({ x: ca.x - n.x * r, y: ca.y - n.y * r }, { x: cb.x - n.x * r, y: cb.y - n.y * r }),
    );
  }
  prims.push({ type: 'arc', c: ca, r, debut: norm(t + 90), fin: norm(t + 270) }, { type: 'arc', c: cb, r, debut: norm(t - 90), fin: norm(t + 90) });
  return entite('oblong', prims, [], at);
}

/** Polygone régulier : centre, milieu d'un côté et nombre de sommets (3 à 40). */
export function polygone(c: Pt, milieuCote: Pt, n: number, at: Attributs): Entite | null {
  const apotheme = dist(c, milieuCote);
  if (apotheme < 1e-9 || n < 3) return null;
  const R = apotheme / Math.cos(Math.PI / n);
  const t = angleDe(c, milieuCote);
  const sommets = Array.from({ length: n }, (_, k) => surCercle(c, R, t - 180 / n + (k * 360) / n));
  return entite('polygone', sommets.map((q, i) => seg(q, sommets[(i + 1) % n])), [{ p: { ...c }, type: 'milieu' }], at);
}
