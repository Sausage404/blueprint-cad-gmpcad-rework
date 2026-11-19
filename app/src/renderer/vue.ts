// Zone de dessin : feuille au format, entités, tracé élastique, mouches, réticule plein écran et logos.
// Coordonnées du dessin en mm, axe Y vers le haut (convention DAO). Dessin en pixels physiques
// pour des traits nets (écrans Retina compris).
import { TRAITS } from './traits';
import type { Trait } from './dessin';
import type { Format } from './formats';
import type { LogoGrille, Pt, TypePoint } from './geometrie';
import type { Primitive } from './primitives';
import type { CouleursDessin } from './theme';

const PX_PAR_MM_ZOOM_1 = 96 / 25.4; // « Zoom 1 » = taille réelle sur un écran à 96 ppp (réglage écran : plus tard)
const ROUGE = '#ff0000';
const ORANGE = '#ff9a00';

export interface Ecran {
  x: number; // px CSS dans la zone de dessin
  y: number;
}

export interface TraitScene {
  prim: Primitive;
  couleur: string; // couleur du niveau
  trait: Trait;
}

export interface Scene {
  couleurs: CouleursDessin;
  format: Format;
  traits: TraitScene[];
  traitFort2px: boolean; // Préférences > Représentation du trait fort : 2 pixels (sinon : luminosité)
  elastique: TraitScene[];
  mouches: { p: Pt; type: 'preleve' | 'repere' }[];
  origine: Pt;
  reticule: {
    p: Pt;
    grille: LogoGrille;
    calage: 'cale' | 'non-cale' | null; // null : pas de dernier point, pas de logo de calage
    repere: TypePoint | null;
    /** Petit réticule « viseur » : désignation approximative d'une entité. */
    viseur?: boolean;
  } | null;
  mesure: string | null;
  /** Nouveauté : point sur lequel Ctrl sauterait (montré au survol). */
  apercuRepere?: { p: Pt; type: TypePoint } | null;
  /** Nouveauté : longueur et angle depuis le dernier point, près du réticule. */
  mesureDynamique?: string | null;
  /** Images (cases B1 à B4), par plan d'affichage, et leur contenu prêt à dessiner (null : pas encore chargé). */
  images?: { bg: Pt; hd: Pt; plan: 'arriere' | 'general' | 'premier'; source: CanvasImageSource | null }[];
  /** Grille de travail affichée en points (option de la case F4). */
  grille?: { origine: Pt; pas: number } | null;
  /** Repères à l'écran seulement (jamais imprimés) : point de référence d'un groupe [], groupe vide N. */
  marques?: { p: Pt; type: 'reference' | 'vide' | 'jointe'; couleur: string }[];
}

export class Vue {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private largeur = 0; // px CSS
  private hauteur = 0;
  private echelle = 1; // px CSS par mm
  private centre: Pt = { x: 0, y: 0 };
  private format: Format | null = null;
  private demande = 0;
  /** L'utilisateur a zoomé ou déplacé la vue depuis le dernier « plein format ». */
  private vueChoisie = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private scene: () => Scene,
    private onChange: () => void,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
    new ResizeObserver(() => this.redimensionner()).observe(canvas);
  }

  // ---------------------------------------------------------------- Transformations

  versEcran(p: Pt): Ecran {
    return { x: this.largeur / 2 + (p.x - this.centre.x) * this.echelle, y: this.hauteur / 2 - (p.y - this.centre.y) * this.echelle };
  }

  versMonde(e: Ecran): Pt {
    return { x: this.centre.x + (e.x - this.largeur / 2) / this.echelle, y: this.centre.y - (e.y - this.hauteur / 2) / this.echelle };
  }

  /** Nombre de mm pour `px` pixels CSS. */
  mm(px: number): number {
    return px / this.echelle;
  }

  /** Zoom tel que l'affiche le tableau de bord (dimension à l'écran / dimension réelle). */
  get zoom(): number {
    return this.echelle / PX_PAR_MM_ZOOM_1;
  }

  get largeurVisibleMm(): number {
    return this.largeur / this.echelle;
  }

  /** Vue visible et étendue totale, en mm, pour les ascenseurs. */
  get etendue() {
    const demiL = this.largeur / 2 / this.echelle;
    const demiH = this.hauteur / 2 / this.echelle;
    const vue = { x0: this.centre.x - demiL, x1: this.centre.x + demiL, y0: this.centre.y - demiH, y1: this.centre.y + demiH };
    // Dans l'original, le curseur des ascenseurs est un petit carré au milieu (capture 01) :
    // l'espace de travail s'étend bien au-delà de la feuille. On prend 20 fois sa taille de chaque côté.
    const f = this.format ?? { largeur: 297, hauteur: 210 };
    const m = 20 * Math.max(f.largeur, f.hauteur);
    const tout = {
      x0: Math.min(vue.x0, -m),
      x1: Math.max(vue.x1, f.largeur + m),
      y0: Math.min(vue.y0, -m),
      y1: Math.max(vue.y1, f.hauteur + m),
    };
    return { vue, tout };
  }

  // ---------------------------------------------------------------- Changements de vue

  setFormat(f: Format): void {
    this.format = f;
    this.pleinFormat();
  }

  /** « Affichage plein format » : la feuille entière, avec une petite marge (capture 01). */
  pleinFormat(): void {
    const marge = 8;
    const f = this.format;
    if (!f || this.largeur <= marge || this.hauteur <= marge) return;
    this.echelle = Math.min((this.largeur - marge) / f.largeur, (this.hauteur - marge) / f.hauteur);
    this.centre = { x: f.largeur / 2, y: f.hauteur / 2 };
    this.vueChoisie = false;
    this.change();
  }

  /** Zoom de `facteur` en gardant fixe le point du dessin sous `e` (molette : centré sur le réticule). */
  zoomAutour(e: Ecran, facteur: number): void {
    const nouvelle = Math.min(Math.max(this.echelle * facteur, PX_PAR_MM_ZOOM_1 * 0.005), PX_PAR_MM_ZOOM_1 * 2000);
    const p = this.versMonde(e);
    this.echelle = nouvelle;
    this.centre = { x: p.x - (e.x - this.largeur / 2) / nouvelle, y: p.y + (e.y - this.hauteur / 2) / nouvelle };
    this.vueChoisie = true;
    this.change();
  }

  /** Zoom sur une fenêtre du dessin (fonction Zoom). */
  zoomFenetre(a: Pt, b: Pt): void {
    const l = Math.abs(b.x - a.x);
    const h = Math.abs(b.y - a.y);
    if (l < 1e-9 && h < 1e-9) return;
    const e = Math.min(l > 1e-9 ? this.largeur / l : Infinity, h > 1e-9 ? this.hauteur / h : Infinity) * 0.97;
    this.echelle = Math.min(Math.max(e, PX_PAR_MM_ZOOM_1 * 0.005), PX_PAR_MM_ZOOM_1 * 2000);
    this.centre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.vueChoisie = true;
    this.change();
  }

  /** Zoom 1 (dimension réelle à l'écran), centré sur le milieu actuel de la vue (case F9, options R et P). */
  dimensionReelle(): void {
    this.echelle = PX_PAR_MM_ZOOM_1;
    this.vueChoisie = true;
    this.change();
  }

  /** Déplace le dessin de (dx, dy) pixels à l'écran (panoramique). */
  glisser(dx: number, dy: number): void {
    this.centre = { x: this.centre.x - dx / this.echelle, y: this.centre.y + dy / this.echelle };
    this.vueChoisie = true;
    this.change();
  }

  /** Déplace la vue de (dx, dy) mm (ascenseurs). */
  deplacer(dxMm: number, dyMm: number): void {
    this.centre = { x: this.centre.x + dxMm, y: this.centre.y + dyMm };
    this.vueChoisie = true;
    this.change();
  }

  private change(): void {
    this.redessiner();
    this.onChange();
  }

  private redimensionner(): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.largeur = r.width;
    this.hauteur = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    // Tant que l'utilisateur n'a pas zoomé, la feuille entière reste visible ; sinon on garde sa vue.
    if (this.vueChoisie) this.change();
    else this.pleinFormat();
  }

  redessiner(): void {
    if (this.demande) return;
    this.demande = requestAnimationFrame(() => {
      this.demande = 0;
      this.dessiner();
    });
  }

  // ---------------------------------------------------------------- Dessin

  /** Position en pixels physiques. */
  private px(p: Pt): [number, number] {
    const e = this.versEcran(p);
    return [e.x * this.dpr, e.y * this.dpr];
  }

  /** Arrondit au centre d'un pixel physique pour un trait de `ep` px. */
  private net(v: number, ep: number): number {
    return ep % 2 === 1 ? Math.round(v - 0.5) + 0.5 : Math.round(v);
  }

  private dessiner(): void {
    const s = this.scene();
    const c = this.ctx;
    const ep = Math.max(1, Math.round(this.dpr)); // 1 px CSS
    const { fond, cadre, ombre, reticule } = s.couleurs;
    this.format = s.format;

    c.fillStyle = fond;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.lineCap = 'butt';

    // Feuille : bord en trait simple avec une ombre de 2 px en bas et à droite, puis cadre intérieur.
    const f = s.format;
    const [gx, hy] = this.px({ x: 0, y: f.hauteur });
    const [dx, by] = this.px({ x: f.largeur, y: 0 });
    const g = this.net(gx, ep);
    const h = this.net(hy, ep);
    const d = this.net(dx, ep);
    const b = this.net(by, ep);
    c.strokeStyle = ombre;
    c.lineWidth = 2 * ep;
    c.beginPath();
    c.moveTo(g + 2 * ep, b + 1.5 * ep);
    c.lineTo(d + 1.5 * ep, b + 1.5 * ep);
    c.lineTo(d + 1.5 * ep, h + 2 * ep);
    c.stroke();
    c.strokeStyle = cadre;
    c.lineWidth = ep;
    c.strokeRect(g, h, d - g, b - h);
    const [ix, iy] = this.px({ x: f.marge, y: f.hauteur - f.marge });
    const [jx, jy] = this.px({ x: f.largeur - f.marge, y: f.marge });
    c.strokeRect(this.net(ix, ep), this.net(iy, ep), Math.round(jx - ix), Math.round(jy - iy));

    // Réticule : deux traits fins sur toute la largeur et toute la hauteur. Il passe sous les traits
    // du dessin pour ne pas les masquer quand il est posé dessus.
    let rx = 0;
    let ry = 0;
    if (s.reticule) {
      [rx, ry] = this.px(s.reticule.p);
      rx = this.net(rx, ep);
      ry = this.net(ry, ep);
      c.strokeStyle = reticule;
      c.lineWidth = ep;
      c.beginPath();
      if (s.reticule.viseur) {
        // Petit réticule : une croix courte et un carré de visée (aide d'origine, « Aspect du réticule »).
        const t = 12 * ep;
        c.moveTo(rx - 2 * t, ry), c.lineTo(rx + 2 * t, ry);
        c.moveTo(rx, ry - 2 * t), c.lineTo(rx, ry + 2 * t);
        c.rect(rx - t / 2, ry - t / 2, t, t);
      } else {
        c.moveTo(rx, 0);
        c.lineTo(rx, this.canvas.height);
        c.moveTo(0, ry);
        c.lineTo(this.canvas.width, ry);
      }
      c.stroke();
    }

    // Grille : des points, au plus 50 sur la largeur (un point sur 2, 5, 10… sinon).
    if (s.grille && s.grille.pas > 0) this.grillePoints(s.grille.origine, s.grille.pas, reticule, ep);

    // Images d'arrière-plan et du plan général sous les tracés, celles du premier plan par-dessus.
    for (const im of s.images ?? []) if (im.plan !== 'premier') this.image(im);
    // Entités, puis tracé élastique
    for (const t of s.traits) this.primitive(t, s.traitFort2px, ep);
    for (const im of s.images ?? []) if (im.plan === 'premier') this.image(im);
    for (const t of s.elastique) this.primitive(t, s.traitFort2px, ep);

    // Repères des groupes : [] au point de référence, N pour un groupe vide (désignation gardée).
    for (const m of s.marques ?? []) {
      const [x, y] = this.px(m.p);
      if (m.type === 'jointe') {
        // Trombone : symbole d'écran d'une pièce jointe (jamais imprimé).
        c.strokeStyle = m.couleur;
        c.lineWidth = 1.5 * ep;
        c.beginPath();
        const k = 2 * ep;
        c.moveTo(x - 2 * k, y + 3 * k);
        c.lineTo(x - 2 * k, y - 4 * k);
        c.arc(x - 0.5 * k, y - 4 * k, 1.5 * k, Math.PI, 0);
        c.lineTo(x + k, y + 2 * k);
        c.arc(x, y + 2 * k, k, 0, Math.PI);
        c.lineTo(x - k, y - 3 * k);
        c.stroke();
      } else if (m.type === 'reference') {
        c.strokeStyle = m.couleur;
        c.lineWidth = ep;
        c.strokeRect(this.net(x, ep) - 3 * ep, this.net(y, ep) - 3 * ep, 6 * ep, 6 * ep);
      } else {
        c.font = `bold ${11 * ep}px "Courier New", Cousine, monospace`;
        c.fillStyle = m.couleur;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('N', x, y);
        c.textAlign = 'start';
      }
    }

    // Mouches et origine de mesure
    for (const m of s.mouches) {
      const [x, y] = this.px(m.p);
      if (m.type === 'preleve') this.croix(x, y, 3 * ep, ROUGE, ep);
      else this.carre(x, y, 3 * ep, ROUGE, ep);
    }
    this.losange(...this.px(s.origine), 5 * ep, ROUGE, ep);

    // Point repérable sous le réticule (Ctrl le prendrait) : carré orangé, et le logo de son type.
    if (s.apercuRepere) {
      const [x, y] = this.px(s.apercuRepere.p);
      this.carre(x, y, 4 * ep, ORANGE, ep);
      this.logoRepere(x + 6 * ep, y - 15 * ep, s.apercuRepere.type, ep);
    }

    // Logos au bout du réticule, et mesure.
    if (s.reticule) {
      const x = rx;
      const y = ry;
      if (!s.reticule.viseur) this.logoGrille(x - 17 * ep, y + 8 * ep, s.reticule.grille, reticule, ep);
      if (s.reticule.calage) this.logoCalage(x - 31 * ep, y + 8 * ep, s.reticule.calage === 'cale', reticule, ep);
      if (s.reticule.repere) this.logoRepere(x + 6 * ep, y + 6 * ep, s.reticule.repere, ep);
      if (s.mesure) {
        c.font = `${12 * ep}px "Courier New", Cousine, monospace`;
        c.fillStyle = cadre;
        c.textBaseline = 'bottom';
        const largeurTexte = c.measureText(s.mesure).width;
        const tx = x + 8 * ep + largeurTexte > this.canvas.width ? x - 8 * ep - largeurTexte : x + 8 * ep;
        c.fillText(s.mesure, tx, y - 4 * ep);
      }
      if (s.mesureDynamique) {
        // Sous le réticule, à droite, sur un fond pour rester lisible par-dessus le dessin.
        c.font = `${11 * ep}px -apple-system, "Segoe UI", Arial, sans-serif`;
        c.textBaseline = 'top';
        const l = c.measureText(s.mesureDynamique).width;
        let tx = x + 20 * ep;
        if (tx + l + 6 * ep > this.canvas.width) tx = x - 20 * ep - l;
        const ty = y + 22 * ep;
        c.globalAlpha = 0.85;
        c.fillStyle = fond;
        c.fillRect(tx - 3 * ep, ty - 2 * ep, l + 6 * ep, 15 * ep);
        c.globalAlpha = 1;
        c.fillStyle = cadre;
        c.fillText(s.mesureDynamique, tx, ty);
      }
    }
  }

  private image(im: NonNullable<Scene['images']>[number]): void {
    if (!im.source) return;
    const [x0, y0] = this.px({ x: im.bg.x, y: im.hd.y });
    const [x1, y1] = this.px({ x: im.hd.x, y: im.bg.y });
    if (x1 < 0 || y1 < 0 || x0 > this.canvas.width || y0 > this.canvas.height) return;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(im.source, x0, y0, x1 - x0, y1 - y0);
  }

  private grillePoints(o: Pt, pas: number, couleur: string, ep: number): void {
    const largeur = this.largeurVisibleMm;
    let p = pas;
    for (const k of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]) {
      p = pas * k;
      if (largeur / p <= 50) break;
    }
    if (largeur / p > 50) return;
    const [x0, y0] = [0, this.canvas.height];
    const a = this.versMonde({ x: x0 / this.dpr, y: y0 / this.dpr });
    const b = this.versMonde({ x: this.canvas.width / this.dpr, y: 0 });
    const c = this.ctx;
    c.fillStyle = couleur;
    const i0 = Math.ceil((a.x - o.x) / p);
    const i1 = Math.floor((b.x - o.x) / p);
    const j0 = Math.ceil((a.y - o.y) / p);
    const j1 = Math.floor((b.y - o.y) / p);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 20000) return;
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const [x, y] = this.px({ x: o.x + i * p, y: o.y + j * p });
        c.fillRect(Math.round(x), Math.round(y), ep, ep);
      }
    }
  }

  /**
   * Une primitive avec son type de trait. Trait fort : couleur pleine (ou 2 pixels selon la préférence) ;
   * traits fins : couleur atténuée (mode « luminosité »). Pointillés et mixtes : motifs fixes à l'écran.
   */
  private primitive(t: TraitScene, fort2px: boolean, ep: number): void {
    const c = this.ctx;
    const def = TRAITS[t.trait] ?? TRAITS['continu-fort'];
    const fort = def.fort;
    const couleur = fort || fort2px ? t.couleur : attenuer(t.couleur);
    const epaisseur = fort && fort2px ? 2 * ep : ep;
    const motif = def.ecran;
    c.setLineDash(motif.map((v) => v * ep));
    const p = t.prim;
    if (p.type === 'segment') this.trait(p.a, p.b, couleur, epaisseur);
    else if (p.type === 'droite' || p.type === 'demi-droite') {
      const [ax, ay] = this.px(p.a);
      const [bx, by] = this.px(p.b);
      const l = Math.hypot(bx - ax, by - ay);
      if (l > 0) {
        // Prolongée bien au-delà de la zone visible.
        const k = (this.canvas.width + this.canvas.height + Math.hypot(ax, ay)) * 2;
        const ux = (bx - ax) / l;
        const uy = (by - ay) / l;
        const debut = p.type === 'droite' ? { x: ax - ux * k, y: ay - uy * k } : { x: ax, y: ay };
        c.strokeStyle = couleur;
        c.lineWidth = epaisseur;
        c.beginPath();
        c.moveTo(debut.x, debut.y);
        c.lineTo(ax + ux * k, ay + uy * k);
        c.stroke();
      }
    } else if (p.type === 'point') {
      c.setLineDash([]);
      const [x, y] = this.px(p.p);
      this.croix(x, y, 2 * ep, couleur, ep);
    } else if (p.type === 'texte') {
      const [x, y] = this.px(p.p);
      const taille = (p.h / 0.716) * this.echelle * this.dpr; // h = hauteur des majuscules
      if (taille < 2) {
        // Trop petit pour être lu : un trait gris à la place, comme un « texte rapide ».
        return;
      }
      c.save();
      c.translate(x, y);
      c.rotate((-p.angle * Math.PI) / 180);
      c.fillStyle = couleur;
      c.font = `${taille}px Arial, Helvetica, sans-serif`;
      c.textAlign = p.alignH === 'centre' ? 'center' : p.alignH === 'droite' ? 'right' : 'left';
      c.textBaseline = p.alignV === 'haut' ? 'top' : p.alignV === 'milieu' ? 'middle' : p.alignV === 'bas' ? 'bottom' : 'alphabetic';
      c.fillText(p.texte, 0, 0);
      c.restore();
    } else {
      const [cx, cy] = this.px(p.c);
      const r = p.r * this.echelle * this.dpr;
      c.strokeStyle = couleur;
      c.lineWidth = epaisseur;
      c.beginPath();
      // Axe Y inversé à l'écran : le sens trigonométrique devient le sens des aiguilles d'une montre.
      if (p.type === 'cercle') c.arc(cx, cy, r, 0, 2 * Math.PI);
      else c.arc(cx, cy, r, (-p.debut * Math.PI) / 180, (-p.fin * Math.PI) / 180, true);
      c.stroke();
    }
    c.setLineDash([]);
  }

  private trait(a: Pt, b: Pt, couleur: string, ep: number): void {
    const c = this.ctx;
    const [ax, ay] = this.px(a);
    const [bx, by] = this.px(b);
    c.strokeStyle = couleur;
    c.lineWidth = ep;
    c.beginPath();
    // Traits horizontaux ou verticaux : alignés sur les pixels pour rester nets.
    if (Math.abs(ax - bx) < 0.01) c.moveTo(this.net(ax, ep), ay), c.lineTo(this.net(bx, ep), by);
    else if (Math.abs(ay - by) < 0.01) c.moveTo(ax, this.net(ay, ep)), c.lineTo(bx, this.net(by, ep));
    else c.moveTo(ax, ay), c.lineTo(bx, by);
    c.stroke();
  }

  private croix(x: number, y: number, r: number, couleur: string, ep: number): void {
    const c = this.ctx;
    const cx = this.net(x, ep);
    const cy = this.net(y, ep);
    c.strokeStyle = couleur;
    c.lineWidth = ep;
    c.beginPath();
    c.moveTo(cx - r, cy);
    c.lineTo(cx + r + ep, cy);
    c.moveTo(cx, cy - r);
    c.lineTo(cx, cy + r + ep);
    c.stroke();
  }

  private carre(x: number, y: number, r: number, couleur: string, ep: number): void {
    const c = this.ctx;
    c.strokeStyle = couleur;
    c.lineWidth = ep;
    c.strokeRect(this.net(x - r, ep), this.net(y - r, ep), 2 * r, 2 * r);
  }

  private losange(x: number, y: number, r: number, couleur: string, ep: number): void {
    const c = this.ctx;
    const cx = this.net(x, ep);
    const cy = this.net(y, ep);
    c.strokeStyle = couleur;
    c.lineWidth = ep;
    c.beginPath();
    c.moveTo(cx, cy - r);
    c.lineTo(cx + r, cy);
    c.lineTo(cx, cy + r);
    c.lineTo(cx - r, cy);
    c.closePath();
    c.moveTo(cx - r / 2, cy);
    c.lineTo(cx + r / 2, cy);
    c.moveTo(cx, cy - r / 2);
    c.lineTo(cx, cy + r / 2);
    c.stroke();
  }

  /** Logos de contrainte de la grille (aide d'origine, « Système de pointage »). */
  private logoGrille(x: number, y: number, type: LogoGrille, couleur: string, ep: number): void {
    const c = this.ctx;
    c.strokeStyle = couleur;
    c.lineWidth = ep;
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      const k = i * 3 * ep;
      if (type !== 'horizontale') c.moveTo(x + k, y), c.lineTo(x + k, y + 10 * ep);
      if (type !== 'verticale') c.moveTo(x - ep, y + ep + k), c.lineTo(x + 10 * ep, y + ep + k);
    }
    c.stroke();
    if (type === 'libre') this.barre(x - ep, y, 11 * ep, ep);
  }

  /** Logos de calage angulaire : direction calée (angle) ou non calée (angle barré). */
  private logoCalage(x: number, y: number, cale: boolean, couleur: string, ep: number): void {
    const c = this.ctx;
    c.strokeStyle = couleur;
    c.lineWidth = ep;
    c.beginPath();
    c.moveTo(x, y + 10 * ep);
    c.lineTo(x + 11 * ep, y + 10 * ep);
    c.moveTo(x, y + 10 * ep);
    c.lineTo(x + 10 * ep, y + 2 * ep);
    c.stroke();
    if (!cale) this.barre(x - ep, y, 11 * ep, ep);
  }

  private barre(x: number, y: number, t: number, ep: number): void {
    const c = this.ctx;
    c.strokeStyle = ROUGE;
    c.lineWidth = ep;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + t, y + t);
    c.moveTo(x + t, y);
    c.lineTo(x, y + t);
    c.stroke();
  }

  /** Logos de repérage : intersection (croix cyan), pied de perpendiculaire (T magenta), milieu (carré rouge). */
  private logoRepere(x: number, y: number, type: TypePoint, ep: number): void {
    const c = this.ctx;
    c.lineWidth = ep;
    c.beginPath();
    if (type === 'intersection') {
      c.strokeStyle = '#00ffff';
      c.moveTo(x, y), c.lineTo(x + 9 * ep, y + 9 * ep);
      c.moveTo(x + 9 * ep, y), c.lineTo(x, y + 9 * ep);
    } else if (type === 'perpendiculaire') {
      c.strokeStyle = '#ff00ff';
      c.moveTo(x + 4.5 * ep, y), c.lineTo(x + 4.5 * ep, y + 9 * ep);
      c.moveTo(x, y + 9 * ep), c.lineTo(x + 9 * ep, y + 9 * ep);
    } else if (type === 'milieu') {
      c.strokeStyle = '#000000';
      c.moveTo(x, y + 5 * ep), c.lineTo(x + 10 * ep, y + 5 * ep);
      c.stroke();
      c.fillStyle = ROUGE;
      c.fillRect(x + 3 * ep, y + 3 * ep, 4 * ep, 4 * ep);
      return;
    } else {
      return;
    }
    c.stroke();
  }
}

/** Couleur d'un trait fin : la couleur du niveau, moins lumineuse. */
function attenuer(couleur: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(couleur);
  if (!m) return couleur;
  const f = (h: string) => Math.round(parseInt(h, 16) * 0.62).toString(16).padStart(2, '0');
  return `#${f(m[1])}${f(m[2])}${f(m[3])}`;
}
