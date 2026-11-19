// Habillage des anciens dessins (.des) : cotes, flèches, repères, symboles, hachures. Le fichier ne garde que
// leur définition (GMPCAD les dessinait à l'affichage) ; on les redessine ici, comme dans les conversions
// DXF d'exemple (aucun programme d'origine n'a été décompilé).
//
// Chaque élément : des points (déjà sur la feuille, en mm), des valeurs, et les chaînes qui le suivent
// (préfixe, suffixe…). Pour les cotes, les valeurs commencent par l'inclinaison, puis une paire
// (position, longueur) par chaîne, puis ce qui est propre à chaque sorte de cote :
//   21 linéaire ............ points : écriture, 1er point, 2e point ; inclinaison de la mesure
//   23 angle ............... points : écriture (sur l'arc), sommet ; inclinaison = bissectrice, puis la valeur
//   24 diamètre, 25 rayon .. points : écriture, centre ; puis 0, le rayon, la direction de la flèche
// Autres : 3 flèche (pointe, queue), 7 arc d'ellipse, 12 rectangle, 16 taraudage vu en bout, 18 taraudage
// en coupe, 26 flèche de section-coupe, 27 état de surface, 30 hachures (points intérieurs ; écartement,
// motif, angle), 31 repère de nomenclature (emplacement, pièce).
import { cotation, extremiteCote } from './cotation';
import { fleche } from './cotes';
import type { Entite, Genre, Trait } from './dessin';
import { dist, nombre, type Pt } from './geometrie';
import { MOTIFS, type Motif } from './hachures';
import { norm, surCercle, type Primitive } from './primitives';

const H = 3; // hauteur des écritures de cotes de GMPCAD (mm)
const LARGEUR = 0.62; // largeur moyenne d'un caractère, en hauteurs
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
const dir = (deg: number): Pt => surCercle({ x: 0, y: 0 }, 1, deg);
const seg = (a: Pt, b: Pt): Primitive => ({ type: 'segment', a, b });

/** Texte lisible (jamais à l'envers) pour une inclinaison donnée. */
function lisible(a: number): number {
  const b = norm(a);
  return b > 90 && b <= 270 ? norm(b - 180) : b > 270 ? b - 360 : b;
}

/** Écriture d'une valeur cotée : préfixe, valeur, suffixe ; la valeur est gardée pour changer de système. */
function ecriture(p: Pt, angle: number, avant: string, valeur: number, apres: string, aligne?: number): Primitive {
  const t = nombre(valeur, 3);
  return { type: 'texte', p, h: H, angle, texte: `${avant}${t}${apres}`, alignH: 'centre', alignV: 'ligne', mesure: { v: valeur, t, ...(aligne !== undefined ? { a: aligne } : {}) } };
}

export interface ElementDes {
  type: number;
  niveau: number;
  /** Points sur la feuille (mm). */
  pts: Pt[];
  v: number[];
  chaines: string[];
  /** Échelle du niveau : longueur sur la feuille d'une unité du fichier. */
  echelle: number;
  /** Longueur réelle d'un mm de la feuille (1 pour un niveau à l'échelle 1). */
  reel: number;
}

const attributs = (e: ElementDes, t: Trait) => ({ niveau: Math.min(e.niveau, 99), trait: t, ...(e.niveau > 99 ? { calque: String(e.niveau) } : {}) });

function entite(e: ElementDes, genre: Genre, prims: Primitive[], t: Trait, styles?: Trait[], params?: Record<string, unknown>): Entite {
  return { genre, primitives: prims, extras: [], ...attributs(e, t), ...(styles ? { styles: styles.map((trait) => ({ trait })) } : {}), ...(params ? { params } : {}) };
}

/** Les chaînes d'une cote et la suite de ses valeurs (après l'inclinaison et les paires position-longueur). */
function lireCote(e: ElementDes): { avant: string; apres: string; reste: number[] } {
  const n = e.chaines.length;
  return { avant: e.chaines[0] ?? '', apres: e.chaines[1] ?? '', reste: e.v.slice(1 + 2 * n) };
}

/** Ligne de rappel d'une écriture : du coude jusqu'au bout de l'écriture, du côté opposé au coude. */
function sousEcriture(coude: Pt, ecr: Pt, texte: string): Primitive {
  const demi = (LARGEUR * H * texte.length) / 2 + 1;
  const bout = coude.x <= ecr.x ? ecr.x + demi : ecr.x - demi;
  return seg(coude, { x: bout, y: ecr.y });
}

/** Coude d'une ligne de rappel partie de `p` dans la direction `w` : là où elle atteint la ligne sous l'écriture. */
function coude(p: Pt, w: Pt, y: number, apres = 0): Pt {
  if (Math.abs(w.y) < 1e-6) return p;
  const t = (y - p.y) / w.y;
  return t > apres ? add(p, mul(w, t)) : p;
}

export function cote(e: ElementDes): Entite | null {
  const { avant, apres, reste } = lireCote(e);
  const prims: Primitive[] = [];
  switch (e.type) {
    case 21: {
      const [T, p1, p2] = e.pts;
      if (!p2) return null;
      const u = dir(e.v[0] ?? 0);
      const n = { x: -u.y, y: u.x };
      const a = add(p1, mul(n, dot(sub(T, p1), n)));
      const b = add(p2, mul(n, dot(sub(T, p2), n)));
      const l = dist(a, b);
      if (l < 1e-9) return null;
      for (const [p, q] of [
        [p1, a],
        [p2, b],
      ] as const) {
        const h = dot(sub(q, p), n);
        if (Math.abs(h) > 1e-6) prims.push(seg(p, add(q, mul(n, 3 * Math.sign(h)))));
      }
      const w = mul(sub(b, a), 1 / l);
      // L'écriture peut être hors de la cote : la ligne de cote va jusqu'à elle.
      const texte = `${avant}${nombre(l * e.reel, 3)}${apres}`;
      const t = dot(sub(T, a), w);
      const demi = (LARGEUR * H * texte.length) / 2;
      const debut = Math.min(0, t - demi);
      const fin = Math.max(l, t + demi);
      const exterieur = l < 8;
      prims.push(seg(add(a, mul(w, exterieur ? Math.min(debut, -6) : debut)), add(a, mul(w, exterieur ? Math.max(fin, l + 6) : fin))));
      if (exterieur) prims.push(...extremiteCote(a, sub(a, w)), ...extremiteCote(b, add(b, w)));
      else prims.push(...extremiteCote(a, b), ...extremiteCote(b, a));
      const angle = lisible((Math.atan2(w.y, w.x) * 180) / Math.PI);
      const surLigne = add(a, mul(w, t));
      const haut = (e.chaines[2] ?? '').trim();
      const p = add(surLigne, dir(angle + 90));
      if (!haut) prims.push(ecriture(p, angleTexte(angle), avant, l * e.reel, apres, angle));
      else {
        // Tolérance : écart inférieur (2e chaîne) sur la ligne d'écriture, écart supérieur (3e) au-dessus, plus petits.
        const principal = ecriture(p, angleTexte(angle), avant, l * e.reel, '', angle);
        const at = angleTexte(angle);
        const fin = add(p, mul(dir(at), (LARGEUR * H * (principal as { texte: string }).texte.length) / 2 + 0.6));
        const petit = (decale: number, texte: string): Primitive => ({ type: 'texte', p: add(fin, mul(dir(at + 90), decale)), h: 0.75 * H, angle: at, texte, alignH: 'gauche', alignV: 'ligne' });
        prims.push(principal, petit(0, apres.trim()), petit(H, haut));
      }
      break;
    }
    case 23: {
      const [T, V] = e.pts;
      if (!V) return null;
      const R = dist(T, V);
      const valeur = reste[0] ?? 0;
      const milieu = e.v[0] ?? 0;
      if (R < 1e-9 || !(Math.abs(valeur) > 1e-9)) return null;
      const [a1, a2] = valeur > 0 ? [milieu - valeur / 2, milieu + valeur / 2] : [milieu + valeur / 2, milieu - valeur / 2];
      const ouverture = Math.abs(valeur);
      prims.push(seg(surCercle(V, R + 3, a1), V), seg(V, surCercle(V, R + 3, a2)), { type: 'arc', c: V, r: R, debut: norm(a1), fin: norm(a2) });
      const pas = Math.min(5, ouverture / 2);
      prims.push(...extremiteCote(surCercle(V, R, a1), surCercle(V, R, a1 + pas)), ...extremiteCote(surCercle(V, R, a2), surCercle(V, R, a2 - pas)));
      prims.push({ type: 'texte', p: surCercle(V, R + 1, milieu), h: H, angle: lisible(milieu - 90), texte: `${avant}${nombre(ouverture, 3)}°${apres}`, alignH: 'centre', alignV: 'ligne' });
      break;
    }
    case 24:
    case 25: {
      const [T, c] = e.pts;
      const r = (reste[1] ?? 0) * e.echelle;
      if (!c || !(r > 0)) return null;
      const a = reste[2] ?? 0;
      const u = dir(a);
      const P = add(c, mul(u, r));
      const diametre = e.type === 24;
      const texte = `${avant}${nombre((diametre ? 2 : 1) * r * e.reel, 3)}${apres}`;
      let k: Pt;
      if (diametre) {
        // Flèches à l'extérieur du cercle, tournées vers le centre ; la ligne continue vers l'écriture.
        const O = sub(c, mul(u, r));
        k = coude(P, u, T.y);
        prims.push(seg(O, P), ...extremiteCote(O, sub(O, u)), ...extremiteCote(P, add(P, u)));
      } else {
        // Flèche sur le cercle, venant du centre ; la ligne de rappel passe par le centre si l'écriture y est.
        const w = mul(u, -1);
        k = coude(P, w, T.y);
        prims.push(...extremiteCote(P, c));
        if (dist(k, P) < 1e-9) prims.push(seg(P, c));
      }
      if (dist(k, P) > 1e-9) prims.push(seg(P, k));
      prims.push(sousEcriture(k, T, texte), ecriture({ x: T.x, y: T.y + 1 }, 0, avant, (diametre ? 2 : 1) * r * e.reel, apres));
      break;
    }
    default:
      return null;
  }
  return entite(e, 'cote', prims, 'continu-fin');
}

const angleTexte = (a: number) => ((cotation.systeme === 'ISO' || cotation.systeme === 'ANSI') && cotation.unidirectionnelle ? 0 : a);

/** Flèche (3) : de la queue vers la pointe. */
export function flecheDes(e: ElementDes): Entite | null {
  const [pointe, queue] = e.pts;
  if (!queue || dist(pointe, queue) < 1e-9) return null;
  return entite(e, 'fleche', [seg(queue, pointe), ...fleche(pointe, queue, 3)], 'continu-fin');
}

/** Repère de nomenclature (31) : numéro sur un trait horizontal, ligne de rappel vers la pièce. */
export function repereDes(e: ElementDes): Entite | null {
  const [E, piece] = e.pts;
  if (!piece) return null;
  const numero = e.chaines.join('').trim();
  const demi = Math.max(5.5, (LARGEUR * 5 * numero.length) / 2 + 1);
  const g = { x: E.x - demi, y: E.y };
  const d = { x: E.x + demi, y: E.y };
  const prims: Primitive[] = [seg(piece, piece.x <= E.x ? g : d), seg(g, d)];
  if (numero) prims.push({ type: 'texte', p: { x: E.x, y: E.y + 1 }, h: 5, angle: 0, texte: numero, alignH: 'centre', alignV: 'ligne' });
  return entite(e, 'repere', prims, 'continu-fin');
}

/** Flèche de section-coupe (26) : la pointe sur la trace du plan, la lettre près de la flèche. */
export function flecheCoupeDes(e: ElementDes): Entite | null {
  const T = e.pts[0];
  const u = dir(e.v[0] ?? 0);
  const n = { x: -u.y, y: u.x };
  const lettre = e.chaines.join('').trim();
  const prims: Primitive[] = [seg(add(T, mul(n, 5)), sub(T, mul(n, 5))), seg(T, add(T, mul(u, 12))), ...fleche(T, add(T, u), 5)];
  if (lettre) prims.push({ type: 'texte', p: add(add(T, mul(u, 6)), mul(n, 3)), h: 5, angle: 0, texte: lettre, alignH: 'gauche', alignV: 'ligne' });
  return entite(e, 'fleche', prims, 'continu-fort', [ 'continu-fort', 'continu-fin', ...prims.slice(2).map(() => 'continu-fin' as Trait)], { lettre });
}

/** État de surface (27) : symbole posé sur la surface, valeur de la rugosité ; ligne de rappel éventuelle. */
export function rugositeDes(e: ElementDes): Entite | null {
  const [B, rappel] = e.pts;
  const rot = (e.v[0] ?? 90) - 90;
  const q = (x: number, y: number): Pt => add(B, surCercle({ x: 0, y: 0 }, Math.hypot(x, y), (Math.atan2(y, x) * 180) / Math.PI + rot));
  const prims: Primitive[] = [seg(q(-2.3, 4), B), seg(B, q(5.8, 10)), seg(q(5.8, 10), q(15.8, 10))];
  const valeur = e.chaines[0]?.trim();
  if (valeur) prims.push({ type: 'texte', p: q(-5.4 - LARGEUR * H * (valeur.length - 3), 10), h: H, angle: rot, texte: valeur, alignH: 'gauche', alignV: 'ligne' });
  if (rappel && dist(rappel, B) > 1e-9) {
    // Le long de la surface, du point de rappel jusqu'au-delà du symbole.
    const s = dir(rot);
    const cote = Math.sign(dot(sub(rappel, B), s)) || -1;
    const loin = Math.max(...[q(-2.3, 4), q(5.8, 10), q(15.8, 10)].map((p) => -cote * dot(sub(p, B), s)), 0) + 1;
    prims.push(seg(rappel, sub(B, mul(s, cote * loin))));
  }
  return entite(e, 'cote', prims, 'continu-fin');
}

/** Taraudage vu en bout (16) : perçage (0,8 d) et trois quarts de cercle du diamètre nominal. */
export function taraudageBoutDes(e: ElementDes): Entite | null {
  const c = e.pts[0];
  const d = (e.v[1] ?? 0) * e.echelle;
  if (!(d > 0)) return null;
  const a = e.v[0] ?? 0;
  const cache = Math.round(e.v[2] ?? 1) === 2;
  const prims: Primitive[] = [
    { type: 'cercle', c, r: 0.4 * d },
    { type: 'arc', c, r: d / 2, debut: norm(a - 105), fin: norm(a + 165) },
  ];
  return entite(e, 'groupe', prims, cache ? 'pointille-fin' : 'continu-fort', cache ? ['pointille-fin', 'pointille-fin'] : ['continu-fort', 'continu-fin']);
}

/** Taraudage en coupe (18) : perçage avec sa pointe à 120°, filet jusqu'à la profondeur de taraudage. */
export function taraudageCoupeDes(e: ElementDes): Entite | null {
  const E = e.pts[0];
  const [a, d0, t0, p0, type] = e.v;
  const d = (d0 ?? 0) * e.echelle;
  const T = (t0 ?? 0) * e.echelle;
  const P = (p0 ?? 0) * e.echelle;
  if (!(d > 0 && P > 0)) return null;
  const u = dir(a ?? 0);
  const n = { x: -u.y, y: u.x };
  const L = (x: number, y: number) => add(E, add(mul(u, x), mul(n, y)));
  const r1 = 0.4 * d;
  const r2 = d / 2;
  const cone = r1 / Math.sqrt(3);
  const cache = Math.round(type ?? 1) === 2;
  const perçage: Primitive[] = [seg(L(0, r1), L(P - cone, r1)), seg(L(P - cone, r1), L(P, 0)), seg(L(P, 0), L(P - cone, -r1)), seg(L(P - cone, -r1), L(0, -r1)), seg(L(P - cone, r1), L(P - cone, -r1))];
  const filet: Primitive[] = T > 0 ? [seg(L(0, r2), L(T, r2)), seg(L(0, -r2), L(T, -r2)), seg(L(T, r2), L(T, -r2))] : [];
  const fort: Trait = cache ? 'pointille-fin' : 'continu-fort';
  const fin: Trait = cache ? 'pointille-fin' : 'continu-fin';
  return entite(e, 'groupe', [...perçage, ...filet], fort, [...perçage.map(() => fort), ...filet.map(() => fin)]);
}

/** Rectangle (12) : deux coins opposés. */
export function rectangleDes(e: ElementDes, trait: Trait): Entite | null {
  const [a, b] = e.pts;
  if (!b || Math.abs(a.x - b.x) < 1e-9 || Math.abs(a.y - b.y) < 1e-9) return null;
  const p = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
  return entite(e, 'rectangle', p.map((q, i) => seg(q, p[(i + 1) % 4])), trait);
}

/** Arc d'ellipse (7) : centre ; inclinaison, demi-axes, angle de départ et ouverture (sur le cercle de base). */
export function arcEllipseDes(e: ElementDes, trait: Trait): Entite | null {
  const c = e.pts[0];
  const [rot, A0, B0, depart, ouverture] = e.v;
  const A = (A0 ?? 0) * e.echelle;
  const B = (B0 ?? 0) * e.echelle;
  if (!(A > 0 && B > 0) || !ouverture) return null;
  const r = ((rot ?? 0) * Math.PI) / 180;
  const n = Math.max(4, Math.ceil(Math.abs(ouverture) / 3));
  const pts = Array.from({ length: n + 1 }, (_, k) => {
    const t = (((depart ?? 0) + (ouverture * k) / n) * Math.PI) / 180;
    const x = A * Math.cos(t);
    const y = B * Math.sin(t);
    return { x: c.x + x * Math.cos(r) - y * Math.sin(r), y: c.y + x * Math.sin(r) + y * Math.cos(r) };
  });
  return entite(
    e,
    'ellipse',
    pts.slice(1).map((b, k) => ({ type: 'segment', a: pts[k], b, courbe: true })),
    trait,
  );
}

/** Réglage d'un hachurage (30) : écartement (mm sur la feuille), motif (rang dans la liste de l'original), angle. */
export function reglageHachuresDes(e: ElementDes): { motif: Motif; distance: number; angle: number } {
  const motif = MOTIFS[Math.round(e.v[2] ?? 1) - 1]?.cle ?? 'tout';
  return { motif, distance: Math.max(0.1, e.v[1] || 4), angle: e.v[3] ?? 45 };
}
