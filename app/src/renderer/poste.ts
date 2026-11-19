// Poste de travail : le modèle souris / clavier de l'original (cahier des charges, sections 2 et 2 bis).
//
//   Clic gauche ........... prélever (désigner / valider un point)
//   Ctrl (seul) ........... repérer : le réticule saute sur le point existant le plus proche ;
//                           le clic gauche qui suit le prélève. Loin de toute entité : point hors grille.
//   Clic droit ............ mesurer (coordonnées par rapport à l'origine de mesure, près du réticule)
//   Ctrl + clic droit ..... changer l'origine de mesure
//   Maj + clic gauche ..... annuler / restituer la dernière entité (bascule)
//   Maj + clic droit ...... calage angulaire actif / inactif (bascule)
//   Alt + clic gauche ..... déplacement panoramique
//   Molette ............... zoom avant / arrière centré sur le réticule
//   Flèches ............... déplacent le réticule d'un pixel (Maj : 5, Ctrl ou Option : 10, Maj + Ctrl : 50)
//   Échap ................. un appui : reprend la fonction à son début ; deux appuis : fonction par défaut
//   Chiffres, . + - ....... saisie des coordonnées au clavier (X=, Y=)
//   Entrée (ligne vide) ... accepte la valeur proposée par défaut ; un clic sur la ligne de dialogue aussi
import { estVide, pointReference } from './groupes';
import { coinsImage, planDe, type ImageStockee } from './images';
import { aciNiveau, aciVersRvb } from './couleurs';
import { cotation, lirePouces, POUCE, questionDeLongueur, suivreEchelle } from './cotation';
import { Dessin, type Calque, type Entite, type InfosDessin, type Trait } from './dessin';
import { EditeurLigne } from './editeur';
import { format as formatNomme, type Format } from './formats';
import { Segments, type Contexte, type Fonction } from './fonctions';
import { contraindre, dist, lireNombre, nombre, pasEffectif, reperer, type Contrainte, type PointCaracteristique, type Pt, type TypePoint } from './geometrie';
import { candidats, type Primitive } from './primitives';
import type { CouleursDessin } from './theme';
import { Vue, type Ecran, type Scene } from './vue';

const RAYON_REPERAGE_PX = 12; // distance de recherche autour du réticule (à vérifier dans l'original)
const TOLERANCE_PX = 3; // un petit tremblement de la souris ne fait pas perdre le point repéré
const DELAI_COORDONNEES_MS = 300; // Ctrl maintenu : coordonnées du point repéré (LISEZMOI 2007 : 3/10e s)
const FACTEUR_CRAN = 1.25; // zoom par cran de molette (à vérifier dans l'original)
const mac = navigator.userAgent.includes('Mac');

/** « L=42.5  A=30° » : longueur et angle (0 à 360°, sens trigonométrique) du dernier point au réticule. */
export function mesureDepuis(a: Pt, b: Pt): string | null {
  const l = dist(a, b);
  if (l < 1e-9) return null;
  const angle = ((((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) % 360) + 360) % 360;
  return `L=${nombre(l)}  A=${nombre(angle, 2)}°`;
}

interface Saisie {
  mode: 'cartesiennes' | 'polaires' | 'valeur';
  valeurs: number[];
  editeur: EditeurLigne;
}

interface Repere {
  p: Pt;
  type: TypePoint | null; // null : repérage loin de toute entité (point hors grille)
  ancre: Ecran; // position du réticule au moment de l'appui
  rang: number;
}

export interface Retour {
  /** Texte de la ligne de dialogue. `curseur` : position du curseur de saisie, s'il y en a un. */
  dire(texte: string, curseur?: number): void;
  /** Le tableau de bord doit être mis à jour. */
  etat(): void;
  /** La fonction en cours a changé (icône en bas à gauche). */
  fonction(f: Fonction): void;
}

export class Poste {
  readonly dessin = new Dessin();
  readonly vue: Vue;
  fonction: Fonction;
  niveau = 1;
  trait: Trait = 'continu-fort';
  traitFort2px = false;
  /** Aides au tracé (nouveautés, coupables dans Préférences > Aides au tracé). */
  aides = { mesures: true, accrochage: true };
  grille: { active: boolean; pas: number; origine: Pt | null } = { active: true, pas: 1, origine: null };
  calage = { actif: true, pas: 15 };
  origineMesure: Pt;
  /** Niveaux à représenter (case F9) ; null : tous. Le niveau de travail est toujours affiché. */
  niveauxVisibles: Set<number> | null = null;
  /** Case (*) ou F3 : repérage étendu à tous les niveaux affichés, pour la fonction en cours seulement. */
  tousNiveaux = false;
  /** Options (case F4) : grille visible, points de référence, origine de mesure fixe (sinon : flottante). */
  options = { grille: false, pointsReference: true, origineFixe: true, images: true, piecesJointes: true };
  /** Dernier trait spécial choisi (case F15). */
  dernierSpecial: Trait | null = null;
  private cacheVisibles: { version: number; filtre: string; liste: Entite[] } | null = null;

  private souris: Ecran | null = null; // position réelle du pointeur
  private brut: Ecran | null = null; // position du réticule avant contraintes (déplacée par les flèches)
  private repere: Repere | null = null;
  private mouches: Scene['mouches'] = [];
  private mesure: string | null = null;
  private mesureMaintenue = false;
  private saisie: Saisie | null = null;
  private panoramique: Ecran | null = null;
  private minuterieCtrl = 0;
  private cumulMolette = 0;
  /** Fonction reprise après une fonction de réglage (« non exclusive »). */
  private precedente: Fonction | null = null;
  private derniereFenetre: [Pt, Pt] | null = null;
  private dernierCran = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    public format: Format,
    private couleurs: () => CouleursDessin,
    private retour: Retour,
  ) {
    this.origineMesure = this.origineGrille;
    // Les cotes affichent la dimension réelle : longueur divisée par l'échelle du niveau de travail (F20).
    suivreEchelle(() => this.dessin.echelleNiveau(this.niveau));
    this.fonction = this.parDefaut();
    this.vue = new Vue(canvas, () => this.scene(), () => {
      this.mouches = []; // un nouvel affichage efface les mouches, comme une mise au net
      this.retour.etat();
    });
    this.vue.setFormat(format);
    this.ecouter();
  }

  // ---------------------------------------------------------------- État

  /** Couleur d'un index ACI à l'écran (le 7 suit le fond : blanc, ou noir sur fond crème). */
  couleurAci(aci: number): string {
    return aciVersRvb(aci, this.couleurs().cadre);
  }

  /** Couleur du niveau de travail. */
  get couleurNiveau(): string {
    return this.couleurAci(this.dessin.couleurNiveau(this.niveau));
  }

  /** Remplace le dessin (Nouveau, Ouvrir) : plein format, origine au centre, fonction par défaut. */
  charger(entites: Entite[], calques: Map<string, Calque>, format: Format, infos?: InfosDessin | null, images?: Map<string, ImageStockee>): void {
    this.dessin.remplacer(entites, calques, infos ?? undefined, images);
    this.sources.clear();
    this.niveauxVisibles = null;
    this.format = format;
    this.origineMesure = this.origineGrille;
    this.mouches = [];
    this.vue.setFormat(format);
    this.choisir(this.parDefaut());
  }

  /** Origine de la grille : le centre du plan (aide d'origine, « Changement de grille »). */
  get origineGrille(): Pt {
    return this.grille.origine ?? { x: this.format.largeur / 2, y: this.format.hauteur / 2 };
  }

  get pasGrille(): number {
    return pasEffectif(this.grille.pas, this.vue.largeurVisibleMm);
  }

  invite(): void {
    this.retour.dire(this.fonction.invite());
  }

  readonly contexte: Contexte = {
    dessin: this.dessin,
    attributs: () => ({ niveau: this.niveau, trait: this.trait }),
    memoire: new Map(),
    rayon: () => this.vue.mm(RAYON_REPERAGE_PX),
    dire: (texte) => this.retour.dire(texte),
    visibles: () => this.visibles(),
    designables: () => (this.fonction.reperage === 'travail' && !this.tousNiveaux ? this.visibles().filter((e) => e.niveau === this.niveau) : this.visibles()),
    // Au lancement d'une session : hachures « tout matériau », affichées.
    reglages: { motifHachure: 'tout', afficherHachures: true },
    actions: {
      zoomFenetre: (a, b) => {
        this.derniereFenetre = [a, b];
        this.vue.zoomFenetre(a, b);
      },
      derniereFenetre: () => this.derniereFenetre,
      afficher: (a, b, niveaux) => {
        this.niveauxVisibles = niveaux;
        this.derniereFenetre = [a, b];
        this.vue.zoomFenetre(a, b);
      },
      vueSpeciale: (mode) => {
        if (mode !== 'X') return this.vue.dimensionReelle();
        this.niveauxVisibles = null;
        const pts = this.dessin.primitives.flatMap((p) => ('a' in p ? [p.a, p.b] : 'c' in p ? [{ x: p.c.x - p.r, y: p.c.y - p.r }, { x: p.c.x + p.r, y: p.c.y + p.r }] : [p.p]));
        if (pts.length === 0) return this.vue.pleinFormat();
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        this.vue.zoomFenetre({ x: Math.min(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.max(...ys) });
      },
      origine: () => this.origineGrille,
      copier: (texte) => {
        void navigator.clipboard?.writeText(texte).catch(() => {});
      },
      niveau: (n) => {
        this.niveau = n;
        this.retour.etat();
      },
      pasGrille: () => this.grille.pas,
      grille: (pas, origine) => {
        if (pas > 0) this.grille.pas = pas;
        if (origine) this.grille.origine = origine;
        this.retour.etat();
        this.vue.redessiner();
      },
      format: () => this.format.nom,
      redessiner: () => {
        this.retour.etat();
        this.vue.redessiner();
      },
      changerFormat: (nom) => {
        this.format = formatNomme(nom);
        this.grille.origine = null;
        this.vue.setFormat(this.format);
        this.retour.etat();
      },
    },
  };

  private parDefaut(): Fonction {
    return new Segments(this.contexte);
  }

  /** Active une fonction (case de la palette). Elle commence par sa question s'il y en a une. */
  choisir(f: Fonction): void {
    if (f.ponctuelle && !this.fonction.ponctuelle) this.precedente = this.fonction;
    else if (!f.ponctuelle && f !== this.fonction) {
      this.fonction.quitter?.();
      this.tousNiveaux = false; // la sortie de la fonction désactive le repérage sur tous niveaux
    }
    this.fonction = f;
    this.repere = null;
    this.saisie = null;
    this.suite();
    this.retour.fonction(f);
    this.vue.redessiner();
  }

  /** Après chaque point ou valeur : la fonction pose sa question suivante, ou demande un point. */
  private suite(): void {
    if (this.fonction.ponctuelle && this.fonction.termine?.()) {
      // Réglage terminé : la fonction d'avant reprend (le message du réglage reste affiché).
      this.fonction = this.precedente ?? this.parDefaut();
      this.precedente = null;
      this.retour.fonction(this.fonction);
      this.retour.etat();
      return;
    }
    const q = this.fonction.question();
    if (q) {
      const defaut = typeof q.defaut === 'number' ? nombre(q.defaut) : q.defaut;
      this.saisie = { mode: 'valeur', valeurs: [], editeur: new EditeurLigne(defaut) };
      this.afficherSaisie();
    } else {
      this.invite();
    }
  }

  /** La fonction attend-elle la désignation d'une entité (petit réticule, pointage libre) ? */
  private get designation(): boolean {
    return this.fonction.attente?.() === 'entite' && !this.saisie;
  }

  private contrainte(): Contrainte | null {
    if (!this.brut) return null;
    if (this.repere) return { p: this.repere.p, grille: 'libre', cale: false, angle: null };
    const brut = this.vue.versMonde(this.brut);
    if (this.designation) return { p: brut, grille: 'libre', cale: false, angle: null };
    return contraindre(brut, {
      grille: this.grille.active ? { origine: this.origineGrille, pas: this.pasGrille } : null,
      dernier: this.fonction.dernierPoint(),
      pasAngle: this.calage.actif ? this.calage.pas : null,
    });
  }

  private scene(): Scene {
    const r = this.contrainte();
    const dernier = this.fonction.dernierPoint();
    return {
      couleurs: this.couleurs(),
      format: this.format,
      traits: this.visibles().flatMap((e) =>
        // Affichage SANS les hachures (C20) : on ne les trace pas.
        (e.genre === 'hachure' && this.contexte.reglages?.afficherHachures === false ? [] : e.primitives).flatMap((prim, i) => {
          const trait = e.styles?.[i]?.trait ?? e.trait;
          // Trait invisible : montré (pointillé de pixels) seulement avec l'option « points de référence ».
          if (trait === 'invisible' && !this.options.pointsReference) return [];
          return [{ prim, couleur: this.couleurAci(e.styles?.[i]?.couleur ?? e.couleur ?? this.dessin.couleurNiveau(e.niveau)), trait }];
        }),
      ),
      grille: this.options.grille ? { origine: this.origineGrille, pas: this.pasGrille } : null,
      images: this.options.images
        ? this.visibles().flatMap((e) => {
            const c = coinsImage(e);
            return c ? [{ ...c, plan: planDe(e), source: this.sourceImage(String(e.params?.image ?? '')) }] : [];
          })
        : [],
      traitFort2px: this.traitFort2px,
      elastique:
        r && !this.saisie
          ? this.fonction.elastique(r.p).map((prim) => ({ prim, couleur: this.couleurNiveau, trait: this.fonction.traitElastique?.() ?? this.trait }))
          : [],
      mouches: this.mouches,
      origine: this.origineMesure,
      reticule: r
        ? {
            p: r.p,
            grille: r.grille,
            calage: dernier && !this.repere && !this.designation ? (r.cale ? 'cale' : 'non-cale') : null,
            repere: this.repere?.type ?? null,
            viseur: this.designation,
          }
        : null,
      mesure: this.mesure,
      apercuRepere: this.apercuRepere(),
      mesureDynamique: r && dernier && !this.saisie && !this.designation && this.aides.mesures ? mesureDepuis(dernier, r.p) : null,
      marques: this.visibles().flatMap((e): NonNullable<Scene['marques']> => {
        if (e.genre === 'jointe') return this.options.piecesJointes ? [{ p: e.extras[0]?.p ?? { x: 0, y: 0 }, type: 'jointe' as const, couleur: this.couleurAci(this.dessin.couleurNiveau(e.niveau)) }] : [];
        const p = pointReference(e);
        return p && this.options.pointsReference
          ? [{ p, type: estVide(e) ? ('vide' as const) : ('reference' as const), couleur: this.couleurAci(e.couleur ?? this.dessin.couleurNiveau(e.niveau)) }]
          : [];
      }),
    };
  }

  /** Accrochage visible : le point que Ctrl prendrait, s'il y en a un sous le réticule. */
  private apercuRepere(): { p: Pt; type: TypePoint } | null {
    if (!this.aides.accrochage || !this.brut || this.repere || this.saisie || this.panoramique || this.designation) return null;
    const cible = this.vue.versMonde(this.brut);
    const rayon = this.vue.mm(RAYON_REPERAGE_PX);
    const [prims, extras] = this.reperables();
    return reperer(candidats(prims, extras, cible, rayon, this.fonction.dernierPoint()), cible, rayon, 0);
  }

  private sources = new Map<string, HTMLImageElement>();
  /** Le contenu d'une image, décodé une fois ; le dessin est refait quand il est prêt. */
  private sourceImage(id: string): HTMLImageElement | null {
    const deja = this.sources.get(id);
    if (deja) return deja.complete && deja.naturalWidth > 0 ? deja : null;
    const img = this.dessin.images.get(id);
    if (!img) return null;
    const el = new Image();
    el.onload = () => this.vue.redessiner();
    el.src = img.donnees;
    this.sources.set(id, el);
    return null;
  }

  /** Oublie le contenu décodé d'une image (mise à jour du fichier). */
  oublierImage(id: string): void {
    this.sources.delete(id);
  }

  /** Entités des niveaux affichés (toutes si aucune liste n'est demandée). */
  visibles(): Entite[] | readonly Entite[] {
    const vis = this.niveauxVisibles;
    if (!vis) return this.dessin.toutes;
    const filtre = `${[...vis].join(',')}|${this.niveau}`;
    if (this.cacheVisibles?.version !== this.dessin.version || this.cacheVisibles.filtre !== filtre) {
      this.cacheVisibles = { version: this.dessin.version, filtre, liste: this.dessin.toutes.filter((e) => vis.has(e.niveau) || e.niveau === this.niveau) };
    }
    return this.cacheVisibles.liste;
  }

  /** Primitives et points repérables (Ctrl) : ceux des niveaux affichés. */
  private reperables(): [Primitive[], PointCaracteristique[]] {
    if (!this.niveauxVisibles) return [this.dessin.primitives, this.dessin.extras];
    const es = this.visibles();
    return [es.flatMap((e) => e.primitives), es.flatMap((e) => e.extras)];
  }

  /** Case (*) / touche F3 : repérage sur tous les niveaux, pour la fonction en cours. */
  basculerTousNiveaux(): boolean {
    if (!this.fonction.reperage) return false;
    this.tousNiveaux = !this.tousNiveaux;
    this.retour.etat();
    return true;
  }

  private coordonnees(p: Pt): string {
    // Origine fixe (option) : celle de la mesure ; flottante : le dernier point de la fonction.
    const o = this.options.origineFixe ? this.origineMesure : (this.fonction.dernierPoint() ?? this.origineMesure);
    return `X=${nombre(p.x - o.x)}  Y=${nombre(p.y - o.y)}`;
  }

  // ---------------------------------------------------------------- Actions

  /** Prélève un point : il est donné à la fonction en cours. La grille est réactivée ensuite. */
  private prelever(p: Pt): void {
    this.fonction.point(p);
    this.mouches.push({ p, type: 'preleve' });
    this.repere = null;
    this.retour.etat();
    this.suite();
  }

  /** Ctrl : repère le point existant le plus proche du réticule et y place le réticule. */
  private repererPoint(): void {
    if (!this.brut) return;
    const cible = this.vue.versMonde(this.brut);
    const rayon = this.vue.mm(RAYON_REPERAGE_PX);
    const memePlace = this.repere && dist(this.repere.ancre, this.brut) <= TOLERANCE_PX;
    const rang = memePlace ? this.repere!.rang + 1 : 0;
    const [prims, extras] = this.reperables();
    const liste = candidats(prims, extras, cible, rayon, this.fonction.dernierPoint());
    const trouve = reperer(liste, cible, rayon, rang);
    const ancre = memePlace ? this.repere!.ancre : { ...this.brut };
    if (trouve) {
      this.repere = { p: trouve.p, type: trouve.type, ancre, rang };
      this.mouches.push({ p: trouve.p, type: 'repere' });
    } else {
      this.repere = { p: cible, type: null, ancre, rang: 0 }; // loin de toute entité : point hors grille
    }
    this.vue.redessiner();
  }

  basculerEntite(): void {
    const r = this.dessin.basculer();
    if (r === 'annulee') this.retour.dire('Annulation de la dernière entité.'); // MENUS.MSE 0081
    else if (r === 'restituee') this.retour.dire('Récupération de la dernière entité annulée.'); // 0087
    this.retour.etat();
    this.vue.redessiner();
  }

  annulerDerniere(): void {
    if (this.dessin.annulerDerniere()) this.retour.dire('Annulation de la dernière entité.');
    this.retour.etat();
    this.vue.redessiner();
  }

  restituer(): void {
    if (this.dessin.restituer()) this.retour.dire('Récupération de la dernière entité annulée.');
    this.retour.etat();
    this.vue.redessiner();
  }

  /** Edition > Annuler (Ctrl+Z, ⌘Z) : annulation illimitée, action par action (nouveauté). */
  annulerAction(): void {
    if (this.dessin.annulerAction()) this.retour.dire(this.dessin.peutAnnuler ? 'Action annulée.' : 'Action annulée. Le dessin est revenu à son début.');
    else this.retour.dire('Rien à annuler.');
    this.retour.etat();
    this.vue.redessiner();
  }

  /** Edition > Refaire (Ctrl+A, ⌘A ; aussi ⌘⇧Z ou Ctrl+Y) : rétablit l'action annulée. */
  refaireAction(): void {
    this.retour.dire(this.dessin.refaireAction() ? 'Action rétablie.' : 'Rien à refaire.');
    this.retour.etat();
    this.vue.redessiner();
  }

  basculerCalage(): void {
    this.calage.actif = !this.calage.actif;
    this.retour.dire(this.calage.actif ? `Calé ${this.calage.pas}°.` : 'Non calé.');
    this.retour.etat();
    this.vue.redessiner();
  }

  private changerOrigine(): void {
    const r = this.contrainte();
    if (!r) return;
    this.origineMesure = r.p;
    this.repere = null;
    this.vue.redessiner();
  }

  private mesurer(): void {
    const r = this.contrainte();
    this.mesure = r ? this.coordonnees(r.p) : null;
    this.vue.redessiner();
  }

  /** Échap : abandon de la saisie, de la fonction, puis retour à la fonction par défaut. */
  abandon(): void {
    if (this.saisie && this.saisie.mode !== 'valeur') {
      this.saisie = null; // abandon de la saisie des coordonnées seulement
      this.invite();
      return;
    }
    this.saisie = null;
    this.repere = null;
    const auDebut = this.fonction.abandon();
    if (auDebut && this.fonction.ponctuelle) {
      this.fonction = this.precedente ?? this.parDefaut();
      this.precedente = null;
      this.retour.fonction(this.fonction);
      this.invite();
    } else if (auDebut && !(this.fonction instanceof Segments)) this.choisir(this.parDefaut());
    else this.suite();
    this.vue.redessiner();
  }

  /** Affichage plein format (F8, F5) : la feuille entière, tous les niveaux. */
  pleinFormat(): void {
    this.niveauxVisibles = null;
    this.vue.pleinFormat();
  }

  // ---------------------------------------------------------------- Saisie au clavier

  commencerSaisie(mode: Saisie['mode'], initial = ''): void {
    this.saisie = { mode, valeurs: [], editeur: new EditeurLigne('', initial) };
    this.afficherSaisie();
  }

  private afficherSaisie(): void {
    const s = this.saisie;
    if (!s) return;
    if (s.mode === 'valeur') {
      const q = this.fonction.question();
      const pouces = q && typeof q.defaut === 'number' && cotation.systeme === 'ANSI' && !q.entier && questionDeLongueur(q.texte);
      const defaut = q ? (typeof q.defaut === 'number' ? (pouces ? `${nombre(q.defaut / POUCE, 4)}"` : nombre(q.defaut)) : q.defaut) : '';
      const debut = q ? (defaut === '' ? `${q.texte} : ` : `${q.texte} (déf, ${defaut}) : `) : '';
      this.retour.dire(debut + s.editeur.texte, debut.length + s.editeur.curseur);
      return;
    }
    const noms = s.mode === 'cartesiennes' ? ['X=', 'Y='] : ['R=', 'A='];
    const deja = s.valeurs.map((v, i) => `${noms[i]}${nombre(v)}  `).join('');
    const debut = `${this.fonction.invite()} ${deja}${noms[s.valeurs.length]}`;
    this.retour.dire(debut + s.editeur.texte, debut.length + s.editeur.curseur);
  }

  private toucheSaisie(e: KeyboardEvent): boolean {
    const s = this.saisie;
    if (!s) return false;
    const r = s.editeur.touche(e);
    if (r === 'ignore') return false;
    e.preventDefault();
    if (r === 'abandon') {
      this.abandon();
      return true;
    }
    if (r === 'valide') {
      if (s.mode === 'valeur') {
        this.validerValeur();
        return true;
      }
      // En ANSI, les coordonnées (et la longueur en polaires) sont en pouces.
      const longueur = s.mode === 'cartesiennes' || s.valeurs.length === 0;
      const v = cotation.systeme === 'ANSI' && longueur ? lirePouces(s.editeur.texte) : lireNombre(s.editeur.texte);
      if (v === null) return true; // rien de valable : on attend une valeur
      s.valeurs.push(v);
      if (s.valeurs.length < 2) {
        s.editeur = new EditeurLigne('');
      } else {
        const o = this.origineMesure;
        const [a, b] = s.valeurs;
        const p =
          s.mode === 'cartesiennes'
            ? { x: o.x + a, y: o.y + b }
            : { x: o.x + a * Math.cos((b * Math.PI) / 180), y: o.y + a * Math.sin((b * Math.PI) / 180) };
        this.saisie = null;
        this.prelever(p);
        this.vue.redessiner();
        return true;
      }
    }
    this.afficherSaisie();
    return true;
  }

  /** Valide la valeur demandée par la fonction ; ligne vide = valeur proposée par défaut. */
  validerValeur(): void {
    const s = this.saisie;
    const q = this.fonction.question();
    if (!s || s.mode !== 'valeur' || !q) return;
    const texte = s.editeur.texte.trim();
    let v: number | string | null;
    if (q.type === 'texte') v = texte === '' ? q.defaut : texte;
    else if (texte === '') v = q.defaut;
    // En ANSI, une longueur tapée est en pouces (3"1/4, 3.25 ; 34.5M pour des mm).
    else v = cotation.systeme === 'ANSI' && !q.entier && questionDeLongueur(q.texte) ? lirePouces(texte) : lireNombre(texte);
    if (v === null) return;
    this.saisie = null;
    this.fonction.valeur(typeof v === 'number' && q.entier ? Math.round(v) : v);
    this.retour.etat();
    this.suite();
    this.vue.redessiner();
  }

  /** Réponse par défaut d'une demande de point (ex. « (déf, tout) »). */
  private prendreDefaut(): boolean {
    if (this.saisie || !this.fonction.parDefaut) return false;
    this.fonction.parDefaut();
    this.retour.etat();
    this.suite();
    this.vue.redessiner();
    return true;
  }

  /** Clic sur la ligne de dialogue : valide la réponse en cours (prise du défaut). */
  clicDialogue(): void {
    if (this.saisie?.mode === 'valeur') this.validerValeur();
    else this.prendreDefaut();
  }

  // ---------------------------------------------------------------- Événements

  private ecouter(): void {
    const c = this.canvas;
    c.addEventListener('pointermove', (e) => this.bouger(e));
    c.addEventListener('pointerdown', (e) => this.appuyer(e));
    c.addEventListener('pointerup', (e) => this.relacher(e));
    c.addEventListener('pointerleave', () => {
      if (this.panoramique) return;
      this.souris = null;
      this.brut = null;
      this.vue.redessiner();
    });
    c.addEventListener('wheel', (e) => this.molette(e), { passive: false });
    window.addEventListener('blur', () => {
      this.panoramique = null;
      this.mesureMaintenue = false;
      clearTimeout(this.minuterieCtrl);
    });
  }

  private bouger(e: PointerEvent): void {
    const pos = { x: e.offsetX, y: e.offsetY };
    if (this.panoramique) {
      this.vue.glisser(pos.x - this.panoramique.x, pos.y - this.panoramique.y);
      this.panoramique = pos;
    }
    // Un événement sans déplacement réel ne doit pas annuler un déplacement fait aux flèches.
    if (this.souris && pos.x === this.souris.x && pos.y === this.souris.y) return;
    this.souris = pos;
    this.brut = { ...pos };
    if (this.repere && dist(this.repere.ancre, pos) > TOLERANCE_PX) this.repere = null;
    if (this.mesureMaintenue) this.mesurer();
    else this.mesure = null;
    this.vue.redessiner();
  }

  private appuyer(e: PointerEvent): void {
    // Sur Mac, Ctrl + clic gauche peut arriver comme un clic droit : on se fie au bouton réellement enfoncé.
    const gauche = e.button === 0 || (mac && e.ctrlKey && e.button === 2 && (e.buttons & 1) === 1);
    const droit = !gauche && e.button === 2;
    if (!this.brut) this.brut = { x: e.offsetX, y: e.offsetY };
    if (this.souris === null) this.souris = { x: e.offsetX, y: e.offsetY };

    if (gauche && e.altKey) {
      this.panoramique = { x: e.offsetX, y: e.offsetY };
      this.canvas.setPointerCapture(e.pointerId);
    } else if (gauche && e.shiftKey) {
      this.basculerEntite();
    } else if (gauche) {
      if (this.saisie) this.saisie = null; // un clic dans le dessin remplace la saisie au clavier
      const r = this.contrainte();
      if (r) this.prelever(r.p);
      this.vue.redessiner();
    } else if (droit && e.shiftKey) {
      this.basculerCalage();
    } else if (droit && e.ctrlKey) {
      this.changerOrigine();
    } else if (droit) {
      this.mesureMaintenue = true;
      this.canvas.setPointerCapture(e.pointerId);
      this.mesurer();
    }
  }

  private relacher(e: PointerEvent): void {
    if (this.panoramique && e.button === 0) this.panoramique = null;
    if (e.button === 2) this.mesureMaintenue = false;
  }

  private molette(e: WheelEvent): void {
    e.preventDefault();
    const centre = this.contrainte() ? this.vue.versEcran(this.contrainte()!.p) : { x: e.offsetX, y: e.offsetY };
    if (e.ctrlKey) {
      // Pincement sur un trackpad : zoom progressif.
      this.vue.zoomAutour(centre, Math.exp(-e.deltaY * 0.01));
      return;
    }
    // Molette crantée : un cran = un zoom. Trackpad ou Magic Mouse : on cumule et on limite la cadence,
    // pour que le zoom ne parte pas tout seul avec l'inertie.
    const legacy = (e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY ?? 0;
    const crante = legacy !== 0 && legacy % 120 === 0;
    const maintenant = performance.now();
    if (crante) {
      this.vue.zoomAutour(centre, legacy > 0 ? FACTEUR_CRAN : 1 / FACTEUR_CRAN);
      return;
    }
    this.cumulMolette += e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    if (Math.abs(this.cumulMolette) >= 50 && maintenant - this.dernierCran > 80) {
      this.vue.zoomAutour(centre, this.cumulMolette < 0 ? FACTEUR_CRAN : 1 / FACTEUR_CRAN);
      this.cumulMolette = 0;
      this.dernierCran = maintenant;
    }
  }

  /** Touches du clavier. Renvoie true si la touche a été utilisée. */
  clavier(e: KeyboardEvent): boolean {
    if (this.toucheSaisie(e)) return true;
    if (e.key === 'Control' && !e.repeat) {
      this.repererPoint();
      clearTimeout(this.minuterieCtrl);
      this.minuterieCtrl = window.setTimeout(() => {
        if (this.repere) {
          this.mesure = this.coordonnees(this.repere.p);
          this.vue.redessiner();
        }
      }, DELAI_COORDONNEES_MS);
      return true;
    }
    if (e.key.startsWith('Arrow') && this.brut) {
      const pas = e.shiftKey && (e.ctrlKey || e.altKey) ? 50 : e.ctrlKey || e.altKey ? 10 : e.shiftKey ? 5 : 1;
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key] ?? [0, 0];
      this.brut = { x: this.brut.x + d[0] * pas, y: this.brut.y + d[1] * pas };
      this.repere = null;
      e.preventDefault();
      this.vue.redessiner();
      return true;
    }
    if (/^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && !this.fonction.question() && this.fonction.touche?.(e.key.toUpperCase())) {
      e.preventDefault();
      this.retour.etat();
      this.invite();
      this.vue.redessiner();
      return true;
    }
    if (/^[0-9.+-]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && !this.fonction.question()) {
      this.commencerSaisie('cartesiennes', e.key);
      e.preventDefault();
      return true;
    }
    if (e.key === 'Escape') {
      this.abandon();
      return true;
    }
    if (e.key === 'Enter' && this.prendreDefaut()) return true;
    if (e.key === 'F5') {
      this.pleinFormat();
      return true;
    }
    if (e.key === 'F3') {
      if (!this.basculerTousNiveaux()) this.retour.dire(`${this.fonction.invite()} (repérage sur tous niveaux sans objet pour cette fonction)`);
      return true;
    }
    if (e.key === 'F9') {
      this.annulerDerniere();
      return true;
    }
    return false;
  }

  clavierRelache(e: KeyboardEvent): void {
    if (e.key === 'Control') clearTimeout(this.minuterieCtrl);
  }

  /** Le réticule à l'écran (pour placer la palette ou zoomer). */
  get reticuleEcran(): Ecran | null {
    const r = this.contrainte();
    return r ? this.vue.versEcran(r.p) : null;
  }

  get enSaisie(): boolean {
    return this.saisie !== null;
  }

  /** Coller (⌘V / Ctrl+V) dans la ligne de dialogue : une valeur attendue, ou des coordonnées. */
  coller(texte: string): void {
    if (!this.saisie) {
      if (!/^\s*-?[\d.,]/.test(texte)) return;
      this.commencerSaisie('cartesiennes');
    }
    this.saisie!.editeur.inserer(texte);
    this.afficherSaisie();
  }
}
