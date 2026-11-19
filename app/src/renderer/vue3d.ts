// Vue 3D (nouveauté) : le volume des contours désignés dans le plan, par extrusion (une épaisseur) ou
// par révolution autour d'un trait d'axe. Rendu three.js ; on tourne autour à la souris.
//
//   Glisser .................... tourner autour de la pièce
//   Clic droit ou Maj + glisser  déplacer
//   Molette .................... zoom
import {
  AmbientLight,
  Box3,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  GridHelper,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Path,
  PerspectiveCamera,
  Scene,
  Shape,
  Sphere,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Axe, Contour } from './contours';
import { profilsRevolution } from './contours';
import type { Primitive } from './primitives';

export type Mode3D = 'extrusion' | 'revolution';
export type Vue = 'perspective' | 'face' | 'dessus' | 'cote';

export interface Modele3D {
  mode: Mode3D;
  pieces: Contour[];
  /** Révolution : axe de chaque pièce. */
  axes: Axe[];
  /** Révolution : traits cachés (pointillés) de la désignation, pour les perçages et alésages. */
  caches?: Primitive[];
  epaisseur: number;
}

/**
 * Volume de révolution d'un profil (r, z) autour de l'axe Y : une bande par côté du profil, lisse autour
 * de l'axe mais avec des arêtes vives d'un côté à l'autre (épaulements, chanfreins, fonds d'alésage).
 */
function tourner(profil: { r: number; z: number }[], n: number): BufferGeometry {
  const positions: number[] = [];
  const normales: number[] = [];
  const index: number[] = [];
  let aire = 0;
  profil.forEach((p, i) => {
    const q = profil[(i + 1) % profil.length];
    aire += p.r * q.z - q.r * p.z;
  });
  const sens = aire > 0 ? 1 : -1; // normale vers l'extérieur de la matière
  profil.forEach((p, i) => {
    const q = profil[(i + 1) % profil.length];
    const dr = q.r - p.r;
    const dz = q.z - p.z;
    const l = Math.hypot(dr, dz);
    if (l < 1e-9) return;
    const nr = (sens * dz) / l;
    const nz = (-sens * dr) / l;
    const base = positions.length / 3;
    for (let k = 0; k <= n; k++) {
      const phi = (2 * Math.PI * k) / n;
      const sin = Math.sin(phi);
      const cos = Math.cos(phi);
      for (const m of [p, q]) {
        positions.push(m.r * sin, m.z, m.r * cos);
        normales.push(nr * sin, nz, nr * cos);
      }
    }
    for (let k = 0; k < n; k++) {
      const a = base + 2 * k;
      // Triangles tournés vers la normale.
      if (sens > 0) index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      else index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normales, 3));
  g.setIndex(index);
  return g;
}

/** Empreinte d'un profil tourné (axe, aire, centre) : deux profils identiques donnent le même volume. */
function empreinte(axe: Axe, profil: { r: number; z: number }[]): string {
  let a = 0;
  let cr = 0;
  let cz = 0;
  for (let i = 0; i < profil.length; i++) {
    const p = profil[i];
    const q = profil[(i + 1) % profil.length];
    const x = p.z * q.r - q.z * p.r;
    a += x;
    cz += (p.z + q.z) * x;
    cr += (p.r + q.r) * x;
  }
  const k = (v: number) => Math.round(v * 100) / 100;
  // L'axe est rangé dans un sens fixe : le même trait désigné dans l'autre sens donne la même empreinte.
  const [p, q] = axe.a.x < axe.b.x || (axe.a.x === axe.b.x && axe.a.y < axe.b.y) ? [axe.a, axe.b] : [axe.b, axe.a];
  return [p.x, p.y, q.x, q.y, a / 2, a ? cr / (3 * a) : 0, a ? cz / (3 * a) : 0].map(k).join(',');
}

export interface ActionsVue3D {
  mode(m: Mode3D): void;
  epaisseur(mm: number): void;
  designer(): void;
  choisirAxe(): void;
  fermer(): void;
}

const VUES: Record<Vue, { dir: [number, number, number]; haut: [number, number, number] }> = {
  perspective: { dir: [0.55, -0.7, 0.85], haut: [0, 0, 1] },
  face: { dir: [0, 0, 1], haut: [0, 1, 0] },
  dessus: { dir: [0, 1, 0], haut: [0, 0, -1] },
  cote: { dir: [1, 0, 0], haut: [0, 1, 0] },
};

export class Vue3D {
  readonly el: HTMLElement;
  private zone: HTMLDivElement;
  private message: HTMLDivElement;
  private info: HTMLDivElement;
  private renderer: WebGLRenderer | null = null;
  private scene = new Scene();
  private camera = new PerspectiveCamera(35, 1, 1, 10000);
  private controls: OrbitControls | null = null;
  private groupe = new Group();
  private grille: GridHelper | null = null;
  private demande = 0;
  private boutons: Record<string, HTMLButtonElement> = {};
  private champEpaisseur: HTMLInputElement;
  private dernierMode: Mode3D | null = null;
  private vue: Vue = 'perspective';

  constructor(el: HTMLElement, private actions: ActionsVue3D) {
    this.el = el;
    el.innerHTML = '';
    const barre = document.createElement('div');
    barre.className = 'barre-3d';
    const titre = document.createElement('span');
    titre.className = 'titre-3d';
    titre.textContent = 'Vue 3D';
    const bouton = (cle: string, texte: string, aide: string, action: () => void) => {
      const b = document.createElement('button');
      b.textContent = texte;
      b.title = aide;
      b.addEventListener('click', action);
      this.boutons[cle] = b;
      return b;
    };
    const groupe = (...bs: HTMLElement[]) => {
      const g = document.createElement('span');
      g.className = 'groupe-3d';
      g.append(...bs);
      return g;
    };
    this.champEpaisseur = document.createElement('input');
    this.champEpaisseur.type = 'number';
    this.champEpaisseur.min = '0.1';
    this.champEpaisseur.step = '1';
    this.champEpaisseur.title = 'Épaisseur de l\'extrusion, en mm';
    this.champEpaisseur.addEventListener('change', () => {
      const v = Number(this.champEpaisseur.value.replace(',', '.'));
      if (v > 0) this.actions.epaisseur(v);
    });
    const etiquette = document.createElement('label');
    etiquette.className = 'epaisseur-3d';
    etiquette.append('Épaisseur ', this.champEpaisseur, ' mm');
    barre.append(
      titre,
      groupe(
        bouton('extrusion', 'Extrusion', 'Le contour prend une épaisseur', () => this.actions.mode('extrusion')),
        bouton('revolution', 'Révolution', 'Le profil tourne autour de son trait d\'axe (trait mixte)', () => this.actions.mode('revolution')),
      ),
      etiquette,
      bouton('axe', 'Axe...', 'Désigner dans le plan l\'axe de révolution', () => this.actions.choisirAxe()),
      bouton('designer', 'Désigner...', 'Désigner dans le plan un autre contour, ou une fenêtre', () => this.actions.designer()),
      groupe(
        bouton('perspective', 'Perspective', 'Vue en perspective', () => this.orienter('perspective')),
        bouton('face', 'Face', 'Vue de face (comme le plan)', () => this.orienter('face')),
        bouton('dessus', 'Dessus', 'Vue de dessus', () => this.orienter('dessus')),
        bouton('cote', 'Côté', 'Vue de côté', () => this.orienter('cote')),
      ),
      bouton('plein', 'Plein écran', 'Vue 3D en plein écran (Échap pour revenir)', () => this.basculerPleinEcran()),
      bouton('fermer', '×', 'Fermer la vue 3D', () => this.actions.fermer()),
    );
    this.boutons.fermer.classList.add('fermer-3d');
    this.zone = document.createElement('div');
    this.zone.className = 'zone-3d';
    this.message = document.createElement('div');
    this.message.className = 'message-3d';
    this.info = document.createElement('div');
    this.info.className = 'info-3d';
    this.zone.append(this.message, this.info);
    el.append(barre, this.zone);

    this.scene.add(this.groupe);
    this.scene.add(this.camera);
    this.scene.add(new HemisphereLight(0xffffff, 0x50555c, 1.6));
    this.scene.add(new AmbientLight(0xffffff, 0.25));
    // Lumière attachée à la caméra : la pièce reste éclairée de face quand on tourne autour.
    const lampe = new DirectionalLight(0xffffff, 2.2);
    lampe.position.set(0.4, 0.8, 1);
    this.camera.add(lampe);
    const contre = new DirectionalLight(0xffffff, 0.6);
    contre.position.set(-1, -0.5, -0.6);
    this.camera.add(contre);

    new ResizeObserver(() => this.redimensionner()).observe(this.zone);
    document.addEventListener('fullscreenchange', () => {
      const plein = document.fullscreenElement === this.el;
      this.boutons.plein.textContent = plein ? 'Quitter le plein écran' : 'Plein écran';
      this.el.classList.toggle('plein', plein);
    });
  }

  /** Crée le rendu WebGL la première fois que la vue s'ouvre. */
  private preparer(): boolean {
    if (this.renderer) return true;
    try {
      this.renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      this.dire('La 3D n\'est pas disponible sur cet ordinateur (WebGL indisponible).');
      return false;
    }
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.domElement.className = 'canvas-3d';
    this.zone.prepend(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.addEventListener('change', () => this.rendre());
    this.controls.zoomToCursor = true;
    this.redimensionner();
    return true;
  }

  private dire(texte: string): void {
    this.message.textContent = texte;
    this.message.hidden = !texte;
  }

  /** Couleur de fond : celle de la zone de dessin. */
  fond(couleur: string): void {
    this.scene.background = new Color(couleur);
    const sombre = this.scene.background.getHSL({ h: 0, s: 0, l: 0 }).l < 0.5;
    this.el.dataset.sombre = String(sombre);
    this.rendre();
  }

  get ouverte(): boolean {
    return !this.el.hidden;
  }

  /** Construit le volume. `nouveau` : la sélection a changé, on recadre. */
  afficher(m: Modele3D, nouveau: boolean): void {
    if (!this.preparer()) return;
    this.boutons.extrusion.classList.toggle('actif', m.mode === 'extrusion');
    this.boutons.revolution.classList.toggle('actif', m.mode === 'revolution');
    (this.champEpaisseur.parentElement as HTMLElement).hidden = m.mode !== 'extrusion';
    this.boutons.axe.hidden = m.mode !== 'revolution';
    if (document.activeElement !== this.champEpaisseur) this.champEpaisseur.value = String(m.epaisseur);

    vider(this.groupe);
    const matiere = new MeshStandardMaterial({ color: 0xb7c0ca, metalness: 0.25, roughness: 0.5, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const aretes = new LineBasicMaterial({ color: 0x1e2329 });
    const deja = new Set<string>();
    m.pieces.forEach((piece, i) => {
      let geo: BufferGeometry | null = null;
      const objet = new Group();
      if (m.mode === 'extrusion') {
        const forme = new Shape(piece.points.map((p) => new Vector2(p.x, p.y)));
        for (const t of piece.trous) forme.holes.push(new Path(t.points.map((p) => new Vector2(p.x, p.y))));
        geo = new ExtrudeGeometry(forme, { depth: m.epaisseur, bevelEnabled: false, curveSegments: 1 });
      } else {
        const axe = m.axes[i];
        // Une coupe complète donne deux pièces, de part et d'autre de l'axe : le même volume, gardé une fois.
        const profils = profilsRevolution(piece.points, m.caches ?? [], axe).filter((profil) => {
          const k = empreinte(axe, profil);
          if (deja.has(k)) return false;
          deja.add(k);
          return true;
        });
        for (const profil of profils) {
          const tour = tourner(profil, 96);
          objet.add(new Mesh(tour, matiere));
          objet.add(new LineSegments(new EdgesGeometry(tour, 28), aretes));
        }
        if (profils.length) {
          // Le tour se fait autour de l'axe Y : on l'aligne sur l'axe du plan, en le gardant dans le plan.
          const angle = Math.atan2(axe.b.y - axe.a.y, axe.b.x - axe.a.x);
          objet.rotation.z = angle - Math.PI / 2;
          objet.position.set(axe.a.x, axe.a.y, 0);
          this.groupe.add(objet);
        }
        return;
      }
      if (!geo) return;
      objet.add(new Mesh(geo, matiere));
      objet.add(new LineSegments(new EdgesGeometry(geo, 28), aretes));
      this.groupe.add(objet);
    });

    const n = this.groupe.children.length;
    this.dire(n ? '' : 'Aucun contour fermé ici. Désignez un contour du plan fait de traits continus forts (bouton « Désigner... »).');
    this.info.textContent = n
      ? m.mode === 'extrusion'
        ? `${n} contour${n > 1 ? 's' : ''} en volume, épaisseur ${m.epaisseur} mm`
        : `${n} pièce${n > 1 ? 's' : ''} de révolution autour de leur trait d'axe`
      : '';
    this.majGrille();
    if (nouveau || m.mode !== this.dernierMode) this.orienter(this.vue);
    this.dernierMode = m.mode;
    this.rendre();
  }

  /** Grille discrète sous la pièce, comme une planche à dessin. */
  private majGrille(): void {
    if (this.grille) {
      this.scene.remove(this.grille);
      this.grille.geometry.dispose();
      (this.grille.material as Material).dispose();
      this.grille = null;
    }
    const b = new Box3().setFromObject(this.groupe);
    if (b.isEmpty()) return;
    const taille = b.getSize(new Vector3());
    const cote = Math.max(taille.x, taille.y) * 1.6;
    const pas = Math.pow(10, Math.floor(Math.log10(cote / 4)));
    const n = Math.max(2, Math.round(cote / pas));
    const sombre = this.el.dataset.sombre === 'true';
    this.grille = new GridHelper(n * pas, n, sombre ? 0x5a6069 : 0x9aa0a8, sombre ? 0x353a41 : 0xc9cdd3);
    this.grille.rotation.x = Math.PI / 2; // dans le plan du dessin
    const c = b.getCenter(new Vector3());
    this.grille.position.set(c.x, c.y, b.min.z - taille.z * 0.02 - 0.01);
    this.scene.add(this.grille);
  }

  /** Place la caméra pour voir toute la pièce depuis la direction demandée. */
  orienter(v: Vue): void {
    this.vue = v;
    for (const k of Object.keys(VUES)) this.boutons[k]?.classList.toggle('actif', k === v);
    if (!this.controls) return;
    const b = new Box3().setFromObject(this.groupe);
    if (b.isEmpty()) {
      this.rendre();
      return;
    }
    const s = b.getBoundingSphere(new Sphere());
    // L'angle de vue le plus étroit (vertical, ou horizontal si le panneau est plus haut que large).
    const demiV = ((this.camera.fov / 2) * Math.PI) / 180;
    const demi = Math.min(demiV, Math.atan(Math.tan(demiV) * this.camera.aspect));
    const d = (s.radius / Math.sin(demi)) * 1.05;
    const { dir, haut } = VUES[v];
    const u = new Vector3(...dir).normalize();
    this.camera.up.set(...haut);
    this.camera.position.copy(s.center).addScaledVector(u, d);
    this.camera.near = d / 100;
    this.camera.far = d * 100;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(s.center);
    this.controls.update();
    this.rendre();
  }

  basculerPleinEcran(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void this.el.requestFullscreen();
  }

  private redimensionner(): void {
    if (!this.renderer) return;
    const r = this.zone.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
    this.rendre();
  }

  rendre(): void {
    if (!this.renderer || this.demande) return;
    this.demande = requestAnimationFrame(() => {
      this.demande = 0;
      this.renderer?.render(this.scene, this.camera);
    });
  }
}

/** Retire et libère les objets d'un groupe. */
function vider(g: Group): void {
  for (const enfant of [...g.children]) {
    g.remove(enfant);
    enfant.traverse((o: Object3D) => {
      const m = o as Mesh;
      m.geometry?.dispose();
      const mat = m.material as Material | Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}
