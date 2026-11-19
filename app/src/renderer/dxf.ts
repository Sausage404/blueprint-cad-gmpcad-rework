// Lecture et écriture du DXF, le format d'enregistrement du logiciel (cahier des charges, section 8 bis).
//
// Lecture : DXF de R9 (AC1004, sortie de DESDXF) à R2018 : LINE, CIRCLE, ARC, POINT, TEXT, MTEXT, ATTRIB,
// POLYLINE/VERTEX, LWPOLYLINE, INSERT (blocs imbriqués), DIMENSION (bloc de la cote), ELLIPSE, SOLID, TRACE.
// Les accents des anciens dessins (%%130 = é…) sont décodés selon la page de code DOS 850.
//
// Écriture : DXF R12 (AC1009), le plus largement lu et modifiable. Les informations propres au logiciel
// (genre d'entité, type de trait, niveau) vont dans des données d'application « BLUEPRINT » (XDATA) qu'un
// autre logiciel peut ignorer sans abîmer le dessin.
import { donneeImageValide, type ImageStockee } from './images';
import { LISTE_TRAITS, TRAITS } from './traits';
import { etendueEntites } from './formats';
import { infosVides, type Calque, type Entite, type Genre, type InfosDessin, type Trait } from './dessin';
import { dist, type PointCaracteristique, type Pt } from './geometrie';
import { angleDe, arcTroisPoints, norm, surCercle, type AlignH, type AlignV, type Primitive } from './primitives';

// ======================================================================= Lecture

type Paire = [number, string];

interface Brut {
  type: string;
  paires: Paire[];
  enfants: Brut[]; // VERTEX d'une POLYLINE, ATTRIB d'un INSERT
}

interface Bloc {
  base: Pt;
  entites: Brut[];
}

export interface ResultatDxf {
  entites: Entite[];
  calques: Map<string, Calque>;
  limites: { min: Pt; max: Pt } | null;
  etendue: { min: Pt; max: Pt } | null;
  version: string;
  ignores: Record<string, number>; // types d'entités non lus
  /** Paramètres du plan, renseignements des niveaux, fenêtres nommées (dessins écrits par ce logiciel). */
  infos: InfosDessin | null;
  /** Images gardées dans le dessin (cases B1 à B4). */
  images: Map<string, ImageStockee>;
}

/** Bloc jamais inséré qui porte le contenu des images, en morceaux de moins de 16 Ko par entité. */
const BLOC_IMAGES = 'BLUEPRINT_IMAGES';

/** Plus grand nombre de traits produits par une entité composée (blocs imbriqués) : au-delà, on s'arrête. */
const PLAFOND_PRIMITIVES = 500_000;
const MORCEAUX_PAR_POINT = 70; // 70 x 200 caractères : sous la limite de 16 Ko de données étendues par entité

/** Identifiants des images utilisées par des entités (aussi dans les groupes). */
function imagesUtilisees(entites: readonly Entite[]): Set<string> {
  const ids = new Set<string>();
  const voir = (p: Record<string, unknown> | undefined) => {
    if (!p) return;
    if (typeof p.image === 'string') ids.add(p.image);
    if (Array.isArray(p.membres)) for (const m of p.membres as { t?: Record<string, unknown> }[]) voir(m.t);
  };
  for (const e of entites) voir(e.params);
  return ids;
}

/** Bloc jamais inséré qui porte les renseignements du dessin : les autres logiciels l'ignorent. */
const BLOC_INFOS = 'BLUEPRINT_INFOS';

const val = (b: Brut, code: number): string | undefined => b.paires.find((p) => p[0] === code)?.[1];
const num = (b: Brut, code: number, defaut = 0): number => {
  const v = val(b, code);
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : defaut;
};

function paires(texte: string): Paire[] {
  const lignes = texte.split(/\r\n|\n|\r/);
  const out: Paire[] = [];
  for (let i = 0; i + 1 < lignes.length; i += 2) {
    const code = parseInt(lignes[i].trim(), 10);
    if (Number.isNaN(code)) {
      i--; // ligne parasite : on se recale
      continue;
    }
    const v = lignes[i + 1];
    out.push([code, code === 1 || code === 3 ? v.replace(/\s+$/, '') : v.trim()]);
  }
  return out;
}

/** Regroupe les paires en entités (chacune commence par un code 0). */
function entitesBrutes(ps: Paire[]): Brut[] {
  const out: Brut[] = [];
  let cur: Brut | null = null;
  for (const p of ps) {
    if (p[0] === 0) {
      cur = { type: p[1], paires: [], enfants: [] };
      out.push(cur);
    } else cur?.paires.push(p);
  }
  // Rattache VERTEX et ATTRIB à leur POLYLINE ou INSERT, jusqu'au SEQEND.
  const res: Brut[] = [];
  let parent: Brut | null = null;
  for (const b of out) {
    if (parent && (b.type === 'VERTEX' || b.type === 'ATTRIB')) parent.enfants.push(b);
    else if (parent && b.type === 'SEQEND') parent = null;
    else {
      parent = b.type === 'POLYLINE' || (b.type === 'INSERT' && num(b, 66) === 1) ? b : null;
      res.push(b);
    }
  }
  return res;
}

export function lireDxf(texte: string): ResultatDxf {
  const ps = paires(texte);
  const sections = new Map<string, Paire[]>();
  for (let i = 0; i < ps.length; i++) {
    if (ps[i][0] === 0 && ps[i][1] === 'SECTION' && ps[i + 1]?.[0] === 2) {
      const nom = ps[i + 1][1];
      let j = i + 2;
      while (j < ps.length && !(ps[j][0] === 0 && ps[j][1] === 'ENDSEC')) j++;
      sections.set(nom, ps.slice(i + 2, j));
      i = j;
    }
  }

  // En-tête
  const entete = sections.get('HEADER') ?? [];
  const variable = (nom: string): Paire[] => {
    const i = entete.findIndex((p) => p[0] === 9 && p[1] === nom);
    if (i < 0) return [];
    const out: Paire[] = [];
    for (let j = i + 1; j < entete.length && entete[j][0] !== 9; j++) out.push(entete[j]);
    return out;
  };
  const point = (nom: string): Pt | null => {
    const v = variable(nom);
    const x = v.find((p) => p[0] === 10);
    const y = v.find((p) => p[0] === 20);
    return x && y ? { x: Number(x[1]), y: Number(y[1]) } : null;
  };
  const version = variable('$ACADVER').find((p) => p[0] === 1)?.[1] ?? 'inconnue';
  const lmin = point('$LIMMIN');
  const lmax = point('$LIMMAX');
  const emin = point('$EXTMIN');
  const emax = point('$EXTMAX');

  // Calques
  const calques = new Map<string, Calque & { typeLigne: string }>();
  for (const b of entitesBrutes(sections.get('TABLES') ?? [])) {
    if (b.type !== 'LAYER') continue;
    const nom = val(b, 2);
    if (nom) calques.set(nom, { couleur: Math.abs(num(b, 62, 7)) || 7, typeLigne: (val(b, 6) ?? '').toUpperCase() });
  }

  // Blocs
  const blocs = new Map<string, Bloc>();
  let blocCourant: Bloc | null = null;
  for (const b of entitesBrutes(sections.get('BLOCKS') ?? [])) {
    if (b.type === 'BLOCK') {
      blocCourant = { base: { x: num(b, 10), y: num(b, 20) }, entites: [] };
      blocs.set(val(b, 2) ?? '', blocCourant);
    } else if (b.type === 'ENDBLK') blocCourant = null;
    else blocCourant?.entites.push(b);
  }

  const ignores: Record<string, number> = {};
  const lecteur = new Lecteur(calques, blocs, ignores);
  const entites: Entite[] = [];
  for (const b of entitesBrutes(sections.get('ENTITIES') ?? [])) {
    const e = lecteur.entite(b);
    if (e) entites.push(e);
  }

  const calquesSimples = new Map<string, Calque>();
  for (const [k, v] of calques) calquesSimples.set(k, { couleur: v.couleur });
  const images = new Map<string, ImageStockee>();
  for (const b of blocs.get(BLOC_IMAGES)?.entites ?? []) {
    const x = xdata(b);
    const id = x.image;
    if (!id) continue;
    const meta = lireJson(x['infos+']) as Partial<ImageStockee> | null;
    const actuelle = images.get(id) ?? { donnees: '', fichier: '', date: 0, taille: 0, px: [0, 0] as [number, number] };
    if (meta) Object.assign(actuelle, { fichier: String(meta.fichier ?? ''), date: Number(meta.date) || 0, taille: Number(meta.taille) || 0, px: Array.isArray(meta.px) ? meta.px : [0, 0] });
    if (x['donnees+']) actuelle.donnees += x['donnees+'];
    images.set(id, actuelle);
  }
  // Sécurité : on ne garde que les données d'image qui sont bien une « data URL » base64 (un dessin falsifié
  // pourrait sinon faire ressortir du balisage dans l'aperçu). Une image au contenu refusé est laissée vide.
  for (const img of images.values()) if (img.donnees && !donneeImageValide(img.donnees)) img.donnees = '';
  const brutInfos = blocs.get(BLOC_INFOS)?.entites[0];
  const lus = brutInfos ? lireJson(xdata(brutInfos)['infos+']) : null;
  const infos = lus && typeof lus === 'object' ? ({ ...infosVides(), ...(lus as object) } as InfosDessin) : null;
  return {
    infos,
    images,
    entites,
    calques: calquesSimples,
    limites: lmin && lmax && lmax.x > lmin.x && lmax.y > lmin.y ? { min: lmin, max: lmax } : null,
    // Étendue mesurée sur les entités : celle de l'en-tête peut être fausse (DESDXF l'écrit parfois en cm,
    // 29,7 x 21 pour un plan A2 en mm, voir CAR.DXF).
    etendue: etendueEntites(entites) ?? (emin && emax && emax.x > emin.x ? { min: emin, max: emax } : null),
    version,
    ignores,
  };
}

// ---- Transformations des blocs

interface Transfo {
  ins: Pt;
  base: Pt;
  sx: number;
  sy: number;
  rot: number; // degrés
  parent: Transfo | null;
}

function appliquer(t: Transfo | null, p: Pt): Pt {
  if (!t) return p;
  const x = (p.x - t.base.x) * t.sx;
  const y = (p.y - t.base.y) * t.sy;
  const a = (t.rot * Math.PI) / 180;
  const q = { x: t.ins.x + x * Math.cos(a) - y * Math.sin(a), y: t.ins.y + x * Math.sin(a) + y * Math.cos(a) };
  return appliquer(t.parent, q);
}

function echelle(t: Transfo | null): number {
  let s = 1;
  for (let c = t; c; c = c.parent) s *= (Math.abs(c.sx) + Math.abs(c.sy)) / 2;
  return s;
}

function rotation(t: Transfo | null): number {
  let r = 0;
  for (let c = t; c; c = c.parent) r += c.rot;
  return r;
}

function transformer(t: Transfo | null, p: Primitive): Primitive | null {
  if (!t) return p;
  switch (p.type) {
    case 'segment':
    case 'droite':
    case 'demi-droite':
      return { ...p, a: appliquer(t, p.a), b: appliquer(t, p.b) };
    case 'cercle':
      return { ...p, c: appliquer(t, p.c), r: p.r * echelle(t) };
    case 'arc': {
      // Trois points de l'arc, transformés, puis l'arc qui passe par eux (marche aussi avec une symétrie).
      const milieu = p.debut + (norm(p.fin - p.debut) || 360) / 2;
      const a = arcTroisPoints(
        appliquer(t, surCercle(p.c, p.r, p.debut)),
        appliquer(t, surCercle(p.c, p.r, milieu)),
        appliquer(t, surCercle(p.c, p.r, p.fin)),
      );
      return a ? { type: 'arc', ...a } : null;
    }
    case 'texte':
      return { ...p, p: appliquer(t, p.p), h: p.h * echelle(t), angle: p.angle + rotation(t) };
    case 'point':
      return { ...p, p: appliquer(t, p.p) };
  }
}

// ---- Accents et caractères spéciaux

/** Page de code DOS 850, caractères 128 à 255. */
const CP850 =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ';

export function decoderTexte(s: string): string {
  return s
    .replace(/%%(\d{3})/g, (_m, n: string) => {
      const c = Number(n);
      return c >= 128 && c <= 255 ? CP850[c - 128] : String.fromCharCode(c);
    })
    .replace(/%%[cC]/g, 'Ø')
    .replace(/%%[dD]/g, '°')
    .replace(/%%[pP]/g, '±')
    .replace(/%%[uUoOkK]/g, '')
    .replace(/%%%/g, '%')
    .replace(/\\U\+([0-9a-fA-F]{4})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\P/g, ' ');
}

// ---- Entités


/** Type de trait d'après le nom du type de ligne, ou à défaut celui du calque (convention de DESDXF). */
function traitDe(typeLigne: string, calque: string): Trait {
  const t = typeLigne.toUpperCase();
  if (/POINT|DASH|HIDDEN|CACHE|TIRET/.test(t)) return 'pointille-fin';
  if (/AXE|CENTER|CENTRE|MIXTE|DASHDOT|PHANTOM|DIVIDE/.test(t)) return 'mixte-fin';
  const c = calque.toUpperCase();
  if (c === 'AXES') return 'mixte-fin';
  if (c === 'CACHE') return 'pointille-fin';
  if (c === 'FIN' || c === 'COTATION' || c === 'HACHURES') return 'continu-fin';
  return 'continu-fort';
}

interface Style {
  calque: string;
  couleur: number;
  trait: Trait;
}

class Lecteur {
  constructor(
    private calques: Map<string, Calque & { typeLigne: string }>,
    private blocs: Map<string, Bloc>,
    private ignores: Record<string, number>,
  ) {}

  /** Style d'une entité : couleur et type de ligne propres, ou ceux du calque, ou ceux du bloc (BYBLOCK). */
  private style(b: Brut, parent: Style | null): Style {
    let calque = val(b, 8) ?? '0';
    if (calque === '0' && parent) calque = parent.calque;
    const c = this.calques.get(calque);
    const code = num(b, 62, 256);
    const couleur = code === 0 ? (parent?.couleur ?? 7) : code >= 1 && code <= 255 ? code : (c?.couleur ?? 7);
    const lt = (val(b, 6) ?? 'BYLAYER').toUpperCase();
    const typeLigne = lt === 'BYLAYER' ? (c?.typeLigne ?? '') : lt === 'BYBLOCK' ? '' : lt;
    const trait = lt === 'BYBLOCK' && parent ? parent.trait : traitDe(typeLigne, calque);
    return { calque, couleur, trait };
  }

  /** Une entité de premier niveau du dessin. */
  entite(b: Brut): Entite | null {
    const st = this.style(b, null);
    const xd = xdata(b);
    const prims: { prim: Primitive; st: Style }[] = [];
    this.primitives(b, null, st, prims, 0);
    if (prims.length === 0) return null;
    const genre: Genre = (xd.genre as Genre) ?? genreDe(b, prims.map((p) => p.prim));
    const trait = (LISTE_TRAITS as string[]).includes(xd.trait ?? '') ? (xd.trait as Trait) : st.trait;
    const niveauCalque = /^\d+$/.test(st.calque) ? Number(st.calque) : 1;
    const niveau = xd.niveau ? Number(xd.niveau) : niveauCalque;
    const proprePropre = xd.niveau !== undefined; // écrit par ce logiciel : couleur du niveau
    const uniforme = prims.every((p) => p.st.couleur === st.couleur && p.st.trait === st.trait);
    const reglages = lireJson(xd['params+']);
    const pointsCaracteristiques = lireJson(xd['extras+']);
    const lisse = GENRES_COURBES.includes(genre);
    const e: Entite = {
      genre,
      primitives: prims.map((p) => (lisse && p.prim.type === 'segment' ? { ...p.prim, courbe: true as const } : p.prim)),
      extras: Array.isArray(pointsCaracteristiques)
        ? (pointsCaracteristiques as [string, string, PointCaracteristique['type']][]).map(([x, y, type]) => ({ p: { x: Number(x), y: Number(y) }, type }))
        : extrasDe(genre, prims.map((p) => p.prim)),
      ...(reglages && typeof reglages === 'object' ? { params: reglages as Record<string, unknown> } : {}),
      niveau: Math.min(99, Math.max(1, niveau)),
      trait,
      calque: st.calque === String(niveau) ? undefined : st.calque,
      couleur: proprePropre ? undefined : st.couleur,
    };
    if (!uniforme) e.styles = prims.map((p) => ({ couleur: p.st.couleur, trait: p.st.trait }));
    const notes = lireJson(xd['notes+']);
    if (Array.isArray(notes)) {
      for (const n of notes as unknown[][]) {
        const p = e.primitives[Number(n[0])];
        if (n[1] === 'm' && p?.type === 'texte') p.mesure = { v: Number(n[2]), t: String(n[3]), ...(n[4] !== undefined ? { a: Number(n[4]) } : {}) };
        if (n[1] === 'b' && p?.type === 'segment')
          p.bout = [
            { x: Number(n[2]), y: Number(n[3]) },
            { x: Number(n[4]), y: Number(n[5]) },
          ];
      }
    }
    return e;
  }

  private primitives(b: Brut, t: Transfo | null, parent: Style, out: { prim: Primitive; st: Style }[], profondeur: number): void {
    // Sécurité : des blocs qui s'imbriquent (chacun inséré plusieurs fois) peuvent faire exploser le nombre de
    // traits (12 par niveau sur 12 niveaux = des milliards) et bloquer le logiciel. On s'arrête à ce plafond.
    if (out.length > PLAFOND_PRIMITIVES) return;
    const st = profondeur === 0 ? parent : this.style(b, parent);
    const ajouter = (p: Primitive | null) => {
      const q = p && transformer(t, p);
      if (q) out.push({ prim: q, st });
    };
    const P = (cx: number, cy: number) => ({ x: num(b, cx), y: num(b, cy) });
    switch (b.type) {
      case 'LINE':
        ajouter({ type: 'segment', a: P(10, 20), b: P(11, 21) });
        break;
      case 'CIRCLE':
        ajouter({ type: 'cercle', c: P(10, 20), r: num(b, 40) });
        break;
      case 'ARC':
        ajouter({ type: 'arc', c: P(10, 20), r: num(b, 40), debut: norm(num(b, 50)), fin: norm(num(b, 51)) });
        break;
      case 'POINT':
        ajouter({ type: 'point', p: P(10, 20) });
        break;
      case 'TEXT':
      case 'ATTRIB':
        ajouter(texte(b));
        break;
      case 'MTEXT': {
        const corps = b.paires.filter((p) => p[0] === 3 || p[0] === 1).map((p) => p[1]).join('');
        const attache = num(b, 71, 1); // 1 à 9 : haut/milieu/bas x gauche/centre/droite
        const alignH: AlignH = ['gauche', 'centre', 'droite'][(attache - 1) % 3] as AlignH;
        const alignV: AlignV = ['haut', 'milieu', 'bas'][Math.floor((attache - 1) / 3)] as AlignV;
        const texteLu = decoderTexte(corps.replace(/\{\\[^;]*;|[{}]|\\[A-Za-z][^;\\]*;/g, ''));
        ajouter({ type: 'texte', p: P(10, 20), h: num(b, 40, 2.5), angle: num(b, 50), texte: texteLu, alignH, alignV });
        break;
      }
      case 'POLYLINE':
        for (const p of polyligne(b.enfants.map((v) => ({ p: { x: num(v, 10), y: num(v, 20) }, bulge: num(v, 42) })), (num(b, 70) & 1) === 1))
          ajouter(p);
        break;
      case 'LWPOLYLINE': {
        const sommets: { p: Pt; bulge: number }[] = [];
        for (const [code, v] of b.paires) {
          if (code === 10) sommets.push({ p: { x: Number(v), y: 0 }, bulge: 0 });
          else if (code === 20 && sommets.length) sommets[sommets.length - 1].p.y = Number(v);
          else if (code === 42 && sommets.length) sommets[sommets.length - 1].bulge = Number(v);
        }
        for (const p of polyligne(sommets, (num(b, 70) & 1) === 1)) ajouter(p);
        break;
      }
      case 'SOLID':
      case 'TRACE': {
        const c = [P(10, 20), P(11, 21), P(13, 23), P(12, 22)];
        for (let i = 0; i < 4; i++) if (dist(c[i], c[(i + 1) % 4]) > 1e-9) ajouter({ type: 'segment', a: c[i], b: c[(i + 1) % 4] });
        break;
      }
      case 'ELLIPSE': {
        const c = P(10, 20);
        const m = P(11, 21);
        const ratio = num(b, 40, 1);
        const t0 = num(b, 41, 0);
        let t1 = num(b, 42, 2 * Math.PI);
        if (t1 <= t0) t1 += 2 * Math.PI;
        const ang = Math.atan2(m.y, m.x);
        const a = Math.hypot(m.x, m.y);
        const n = 48;
        let prec: Pt | null = null;
        for (let i = 0; i <= n; i++) {
          const t = t0 + ((t1 - t0) * i) / n;
          const x = a * Math.cos(t);
          const y = a * ratio * Math.sin(t);
          const q = { x: c.x + x * Math.cos(ang) - y * Math.sin(ang), y: c.y + x * Math.sin(ang) + y * Math.cos(ang) };
          if (prec) ajouter({ type: 'segment', a: prec, b: q });
          prec = q;
        }
        break;
      }
      case 'INSERT':
      case 'DIMENSION': {
        if (profondeur > 12) break;
        const bloc = this.blocs.get(val(b, 2) ?? '');
        if (!bloc) break;
        const tf: Transfo | null =
          b.type === 'DIMENSION'
            ? t
            : { ins: P(10, 20), base: bloc.base, sx: num(b, 41, 1) || 1, sy: num(b, 42, 1) || 1, rot: num(b, 50), parent: t };
        for (const e of bloc.entites) this.primitives(e, tf, st, out, profondeur + 1);
        for (const a of b.enfants) this.primitives(a, t, st, out, profondeur + 1); // attributs (déjà placés)
        break;
      }
      default:
        this.ignores[b.type] = (this.ignores[b.type] ?? 0) + 1;
    }
  }
}

function texte(b: Brut): Primitive | null {
  const brut = val(b, 1);
  if (!brut) return null;
  const h72 = num(b, 72);
  const v73 = num(b, 73, num(b, 74));
  const aligne = h72 !== 0 || v73 !== 0;
  const p = aligne && val(b, 11) !== undefined ? { x: num(b, 11), y: num(b, 21) } : { x: num(b, 10), y: num(b, 20) };
  const alignH: AlignH = h72 === 1 || h72 === 3 || h72 === 4 || h72 === 5 ? 'centre' : h72 === 2 ? 'droite' : 'gauche';
  const alignV: AlignV = h72 === 4 ? 'milieu' : (['ligne', 'bas', 'milieu', 'haut'][v73] as AlignV) ?? 'ligne';
  return { type: 'texte', p, h: num(b, 40, 2.5), angle: num(b, 50), texte: decoderTexte(brut), alignH, alignV };
}

/** Sommets d'une polyligne (avec « bulge » pour les arcs) -> segments et arcs. */
export function polyligne(sommets: { p: Pt; bulge: number }[], fermee: boolean): Primitive[] {
  const out: Primitive[] = [];
  const n = sommets.length;
  for (let i = 0; i < (fermee ? n : n - 1); i++) {
    const s = sommets[i];
    const e = sommets[(i + 1) % n].p;
    const d = dist(s.p, e);
    if (d < 1e-9) continue;
    if (Math.abs(s.bulge) < 1e-9) {
      out.push({ type: 'segment', a: s.p, b: e });
      continue;
    }
    const theta = 4 * Math.atan(s.bulge);
    const u = { x: (e.x - s.p.x) / d, y: (e.y - s.p.y) / d };
    const nrm = { x: -u.y, y: u.x };
    const h = d / 2 / Math.tan(theta / 2);
    const c = { x: (s.p.x + e.x) / 2 + nrm.x * h, y: (s.p.y + e.y) / 2 + nrm.y * h };
    const r = Math.abs(d / (2 * Math.sin(theta / 2)));
    out.push(
      s.bulge > 0 ? { type: 'arc', c, r, debut: angleDe(c, s.p), fin: angleDe(c, e) } : { type: 'arc', c, r, debut: angleDe(c, e), fin: angleDe(c, s.p) },
    );
  }
  return out;
}

function xdata(b: Brut): Record<string, string> {
  const out: Record<string, string> = {};
  let dansNotre = false;
  for (const [code, v] of b.paires) {
    if (code === 1001) dansNotre = APPID_ANCIENS.includes(v);
    else if (dansNotre && code === 1000) {
      const i = v.indexOf('=');
      if (i <= 0) continue;
      const cle = v.slice(0, i);
      // Les clés en « + » sont écrites en plusieurs morceaux, à mettre bout à bout.
      out[cle] = cle.endsWith('+') ? (out[cle] ?? '') + v.slice(i + 1) : v.slice(i + 1);
    }
  }
  return out;
}

/** Entités tracées en petits segments (ellipses, courbes) : leurs bouts ne sont pas repérables. */
const GENRES_COURBES: Genre[] = ['ellipse', 'courbe'];

function lireJson(texte: string | undefined): unknown {
  if (!texte) return null;
  try {
    return JSON.parse(decoderTexte(texte));
  } catch {
    return null;
  }
}

function genreDe(b: Brut, prims: Primitive[]): Genre {
  if (b.type === 'DIMENSION') return 'cote';
  if (b.type === 'INSERT') return 'groupe';
  if (b.type === 'POLYLINE' || b.type === 'LWPOLYLINE') return 'polyligne';
  if (prims.length === 1) {
    const t = prims[0].type;
    return t === 'segment' || t === 'droite' || t === 'demi-droite' || t === 'cercle' || t === 'arc' || t === 'texte' || t === 'point' ? t : 'groupe';
  }
  return 'groupe';
}

/** Points repérables des entités composées (milieu d'un rectangle, centre d'un polygone). */
export function extrasDe(genre: Genre, prims: Primitive[]): PointCaracteristique[] {
  if (genre !== 'rectangle' && genre !== 'polygone') return [];
  const pts = prims.flatMap((p) => (p.type === 'segment' ? [p.a] : []));
  if (pts.length === 0) return [];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return [{ p: { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }, type: 'milieu' }];
}

// ======================================================================= Écriture (R12)

const APPID = 'BLUEPRINT';
/** Entités écrites en POLYLINE quand leurs morceaux se suivent. */
const CHAINABLES: Genre[] = ['rectangle', 'polygone', 'oblong', 'polyligne', 'ellipse', 'courbe'];
const APPID_ANCIENS = [APPID, 'DAO2D']; // « DAO2D » : nom provisoire des premières versions

export interface Feuille {
  largeur: number;
  hauteur: number;
}

const f = (v: number) => {
  const r = Math.round(v * 1e6) / 1e6;
  return (Object.is(r, -0) ? 0 : r).toString();
};
const typeLigne = (t: Trait) => TRAITS[t]?.ligne ?? 'CONTINUOUS';

/** Encode un texte pour un DXF R12 en page de code ANSI_1252 (les caractères hors Latin-1 en \U+xxxx). */
function encoderTexte(s: string): string {
  return [...s].map((c) => (c.charCodeAt(0) > 255 ? `\\U+${c.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()}` : c)).join('');
}

export function ecrireDxf(
  entites: readonly Entite[],
  calques: Map<string, Calque>,
  feuille: Feuille,
  aciNiveau: (n: number) => number,
  infos?: InfosDessin,
  images?: ReadonlyMap<string, ImageStockee>,
): string {
  const L: (string | number)[] = [];
  const g = (code: number, v: string | number) => L.push(code, v);

  // Calques utilisés : un par niveau, plus ceux des dessins importés.
  const noms = new Map<string, number>();
  for (const e of entites) {
    const nom = e.calque ?? String(e.niveau);
    if (!noms.has(nom)) noms.set(nom, calques.get(nom)?.couleur ?? aciNiveau(e.niveau));
  }
  // Couleurs forcées (F19) des niveaux encore vides : gardées aussi.
  for (const [nom, c] of calques) if (/^\d+$/.test(nom) && !noms.has(nom) && c.couleur !== aciNiveau(Number(nom))) noms.set(nom, c.couleur);
  if (noms.size === 0) noms.set('1', aciNiveau(1));

  // Étendue
  const pts = entites.flatMap((e) => e.primitives.flatMap((p) => ('a' in p ? [p.a, p.b] : 'c' in p ? [p.c] : [p.p])));
  const min = pts.length ? { x: Math.min(...pts.map((p) => p.x)), y: Math.min(...pts.map((p) => p.y)) } : { x: 0, y: 0 };
  const max = pts.length ? { x: Math.max(...pts.map((p) => p.x)), y: Math.max(...pts.map((p) => p.y)) } : { x: feuille.largeur, y: feuille.hauteur };

  g(0, 'SECTION'), g(2, 'HEADER');
  g(9, '$ACADVER'), g(1, 'AC1009');
  g(9, '$DWGCODEPAGE'), g(3, 'ANSI_1252');
  g(9, '$INSBASE'), g(10, 0), g(20, 0), g(30, 0);
  g(9, '$EXTMIN'), g(10, f(min.x)), g(20, f(min.y)), g(30, 0);
  g(9, '$EXTMAX'), g(10, f(max.x)), g(20, f(max.y)), g(30, 0);
  g(9, '$LIMMIN'), g(10, 0), g(20, 0);
  g(9, '$LIMMAX'), g(10, f(feuille.largeur)), g(20, f(feuille.hauteur));
  g(9, '$LTSCALE'), g(40, 1);
  g(9, '$TEXTSIZE'), g(40, 3);
  g(0, 'ENDSEC');

  g(0, 'SECTION'), g(2, 'TABLES');
  g(0, 'TABLE'), g(2, 'LTYPE'), g(70, 6);
  g(0, 'LTYPE'), g(2, 'CONTINUOUS'), g(70, 0), g(3, 'Solid line'), g(72, 65), g(73, 0), g(40, 0);
  g(0, 'LTYPE'), g(2, 'DASHED'), g(70, 0), g(3, '__ __ __'), g(72, 65), g(73, 2), g(40, 6), g(49, 4), g(49, -2);
  g(0, 'LTYPE'), g(2, 'CENTER'), g(70, 0), g(3, '____ _ ____'), g(72, 65), g(73, 4), g(40, 20), g(49, 12), g(49, -3), g(49, 2), g(49, -3);
  g(0, 'LTYPE'), g(2, 'PHANTOM'), g(70, 0), g(3, '____ _ _ ____'), g(72, 65), g(73, 6), g(40, 25), g(49, 12), g(49, -3), g(49, 2), g(49, -3), g(49, 2), g(49, -3);
  g(0, 'LTYPE'), g(2, 'MIXTE3'), g(70, 0), g(3, '____ _ _ _ ____'), g(72, 65), g(73, 8), g(40, 30), g(49, 12), g(49, -3), g(49, 2), g(49, -3), g(49, 2), g(49, -3), g(49, 2), g(49, -3);
  g(0, 'LTYPE'), g(2, 'DASHED2X'), g(70, 0), g(3, '____  ____  ____'), g(72, 65), g(73, 2), g(40, 16), g(49, 12), g(49, -4);
  g(0, 'ENDTAB');
  g(0, 'TABLE'), g(2, 'LAYER'), g(70, noms.size);
  for (const [nom, aci] of noms) g(0, 'LAYER'), g(2, nom), g(70, 0), g(62, aci), g(6, 'CONTINUOUS');
  g(0, 'ENDTAB');
  g(0, 'TABLE'), g(2, 'STYLE'), g(70, 1);
  g(0, 'STYLE'), g(2, 'STANDARD'), g(70, 0), g(40, 0), g(41, 1), g(50, 0), g(71, 0), g(42, 2.5), g(3, 'txt'), g(4, '');
  g(0, 'ENDTAB');
  g(0, 'TABLE'), g(2, 'APPID'), g(70, 1);
  g(0, 'APPID'), g(2, APPID), g(70, 0);
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');

  // Groupes, cotes et autres entités de plusieurs morceaux qui ne se mettent pas bout à bout (axes,
  // hachures, pièces…) : écrits en blocs, pour rester une seule entité.
  const blocs: { nom: string; e: Entite }[] = [];
  entites.forEach((e) => {
    const composee = e.primitives.length > 1 && !(CHAINABLES.includes(e.genre) && chainer(e.primitives));
    if (e.genre === 'groupe' || e.genre === 'cote' || composee) blocs.push({ nom: `G${blocs.length + 1}`, e });
  });
  g(0, 'SECTION'), g(2, 'BLOCKS');
  const infosUtiles = infos && (Object.keys(infos.plan).length || Object.keys(infos.niveaux).length || Object.keys(infos.fenetres).length);
  if (infosUtiles) {
    g(0, 'BLOCK'), g(8, '0'), g(2, BLOC_INFOS), g(70, 0), g(10, 0), g(20, 0), g(30, 0), g(3, BLOC_INFOS);
    g(0, 'POINT'), g(8, '0'), g(10, 0), g(20, 0), g(30, 0);
    g(1001, APPID);
    morceaux('infos+', JSON.stringify(infos));
    g(0, 'ENDBLK'), g(8, '0');
  }
  const ids = [...imagesUtilisees(entites)].filter((id) => images?.has(id));
  if (ids.length) {
    g(0, 'BLOCK'), g(8, '0'), g(2, BLOC_IMAGES), g(70, 0), g(10, 0), g(20, 0), g(30, 0), g(3, BLOC_IMAGES);
    for (const id of ids) {
      const img = images!.get(id)!;
      g(0, 'POINT'), g(8, '0'), g(10, 0), g(20, 0), g(30, 0);
      g(1001, APPID), g(1000, `image=${id}`);
      morceaux('infos+', JSON.stringify({ fichier: img.fichier, date: img.date, taille: img.taille, px: img.px }));
      for (let i = 0; i < img.donnees.length; i += 200 * MORCEAUX_PAR_POINT) {
        g(0, 'POINT'), g(8, '0'), g(10, 0), g(20, 0), g(30, 0);
        g(1001, APPID), g(1000, `image=${id}`);
        morceaux('donnees+', img.donnees.slice(i, i + 200 * MORCEAUX_PAR_POINT));
      }
    }
    g(0, 'ENDBLK'), g(8, '0');
  }
  for (const { nom, e } of blocs) {
    g(0, 'BLOCK'), g(8, '0'), g(2, nom), g(70, 0), g(10, 0), g(20, 0), g(30, 0), g(3, nom);
    e.primitives.forEach((p, i) => primitive(p, e, e.styles?.[i]));
    g(0, 'ENDBLK'), g(8, '0');
  }
  g(0, 'ENDSEC');

  g(0, 'SECTION'), g(2, 'ENTITIES');
  for (const e of entites) {
    const bloc = blocs.find((b) => b.e === e);
    if (bloc) {
      g(0, 'INSERT'), commun(e), g(2, bloc.nom), g(10, 0), g(20, 0), g(30, 0);
      donnees(e);
      continue;
    }
    const chaine = CHAINABLES.includes(e.genre) ? chainer(e.primitives) : null;
    if (chaine) {
      g(0, 'POLYLINE'), commun(e), g(66, 1), g(10, 0), g(20, 0), g(30, 0), g(70, chaine.fermee ? 1 : 0);
      donnees(e);
      for (const s of chaine.sommets) {
        g(0, 'VERTEX'), g(8, e.calque ?? String(e.niveau)), g(10, f(s.p.x)), g(20, f(s.p.y)), g(30, 0);
        if (Math.abs(s.bulge) > 1e-12) g(42, f(s.bulge));
      }
      g(0, 'SEQEND'), g(8, e.calque ?? String(e.niveau));
      continue;
    }
    for (const p of e.primitives) {
      if (primitive(p, e)) donnees(e);
    }
  }
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return L.join('\r\n') + '\r\n';

  function commun(e: Entite, st?: { couleur?: number; trait?: Trait }) {
    g(8, e.calque ?? String(e.niveau));
    g(6, typeLigne(st?.trait ?? e.trait));
    const c = st?.couleur ?? e.couleur;
    if (c !== undefined) g(62, c);
  }

  function donnees(e: Entite) {
    g(1001, APPID);
    g(1000, `genre=${e.genre}`);
    g(1000, `trait=${e.trait}`);
    g(1000, `niveau=${e.niveau}`);
    // Ce qui permet de recalculer l'entité (courbes, hachures, cotes…), en morceaux de 200 caractères.
    if (e.params) morceaux('params+', JSON.stringify(e.params));
    if (e.extras.length && e.genre !== 'rectangle' && e.genre !== 'polygone') morceaux('extras+', JSON.stringify(e.extras.map((x) => [f(x.p.x), f(x.p.y), x.type])));
    // Écritures et extrémités des cotes : pour les refaire dans un autre système de cotation.
    const notes: unknown[] = [];
    e.primitives.forEach((p, i) => {
      if (p.type === 'texte' && p.mesure) notes.push([i, 'm', p.mesure.v, p.mesure.t, ...(p.mesure.a !== undefined ? [p.mesure.a] : [])]);
      if (p.type === 'segment' && p.bout) notes.push([i, 'b', f(p.bout[0].x), f(p.bout[0].y), f(p.bout[1].x), f(p.bout[1].y)]);
    });
    if (notes.length) morceaux('notes+', JSON.stringify(notes));
  }

  function morceaux(cle: string, texte: string) {
    for (let i = 0; i < texte.length; i += 200) g(1000, `${cle}=${encoderTexte(texte.slice(i, i + 200))}`);
  }

  function primitive(p: Primitive, e: Entite, st?: { couleur?: number; trait?: Trait }): boolean {
    switch (p.type) {
      case 'segment':
      case 'droite':
      case 'demi-droite':
        g(0, 'LINE'), commun(e, st), g(10, f(p.a.x)), g(20, f(p.a.y)), g(30, 0), g(11, f(p.b.x)), g(21, f(p.b.y)), g(31, 0);
        return true;
      case 'cercle':
        g(0, 'CIRCLE'), commun(e, st), g(10, f(p.c.x)), g(20, f(p.c.y)), g(30, 0), g(40, f(p.r));
        return true;
      case 'arc':
        g(0, 'ARC'), commun(e, st), g(10, f(p.c.x)), g(20, f(p.c.y)), g(30, 0), g(40, f(p.r)), g(50, f(p.debut)), g(51, f(p.fin));
        return true;
      case 'point':
        g(0, 'POINT'), commun(e, st), g(10, f(p.p.x)), g(20, f(p.p.y)), g(30, 0);
        return true;
      case 'texte': {
        g(0, 'TEXT'), commun(e, st), g(10, f(p.p.x)), g(20, f(p.p.y)), g(30, 0), g(40, f(p.h)), g(1, encoderTexte(p.texte));
        if (p.angle) g(50, f(p.angle));
        const h = p.alignH === 'centre' ? 1 : p.alignH === 'droite' ? 2 : 0;
        const v = { ligne: 0, bas: 1, milieu: 2, haut: 3 }[p.alignV];
        if (h || v) {
          if (h) g(72, h);
          g(11, f(p.p.x)), g(21, f(p.p.y)), g(31, 0);
          if (v) g(73, v);
        }
        return true;
      }
    }
  }
}

/** Met bout à bout les segments et arcs d'une entité composée, pour l'écrire en polyligne. Null si impossible. */
export function chainer(prims: Primitive[]): { sommets: { p: Pt; bulge: number }[]; fermee: boolean } | null {
  type Morceau = { debut: Pt; fin: Pt; bulge: number };
  const morceaux: Morceau[] = [];
  for (const p of prims) {
    if (p.type === 'segment') morceaux.push({ debut: p.a, fin: p.b, bulge: 0 });
    else if (p.type === 'arc') {
      const theta = ((norm(p.fin - p.debut) || 360) * Math.PI) / 180;
      morceaux.push({ debut: surCercle(p.c, p.r, p.debut), fin: surCercle(p.c, p.r, p.fin), bulge: Math.tan(theta / 4) });
    } else return null;
  }
  if (morceaux.length === 0) return null;
  const tol = 1e-6;
  const ordre: Morceau[] = [morceaux.shift()!];
  while (morceaux.length) {
    const fin = ordre[ordre.length - 1].fin;
    const i = morceaux.findIndex((m) => dist(m.debut, fin) < tol || dist(m.fin, fin) < tol);
    if (i < 0) return null;
    const m = morceaux.splice(i, 1)[0];
    ordre.push(dist(m.debut, fin) < tol ? m : { debut: m.fin, fin: m.debut, bulge: -m.bulge });
  }
  const fermee = dist(ordre[0].debut, ordre[ordre.length - 1].fin) < tol;
  const sommets = ordre.map((m) => ({ p: m.debut, bulge: m.bulge }));
  if (!fermee) sommets.push({ p: ordre[ordre.length - 1].fin, bulge: 0 });
  return { sommets, fermee };
}
