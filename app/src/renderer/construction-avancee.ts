// Construction (ligne 3) : cercle tri-tangent (D6), raccordement de segments, arcs et points (D11),
// contour parallèle (D16), symboles de points (D17). Sans DOM (testé dans test/construction-avancee.test.ts).
import { dist, type Pt } from './geometrie';
import { angleDe, intersections, norm, surCercle, type Primitive } from './primitives';

const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
const croix = (a: Pt, b: Pt) => a.x * b.y - a.y * b.x;
const unit = (v: Pt): Pt => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

/** Une entité à laquelle un cercle peut être tangent : droite (segment prolongé), cercle (ou arc), point. */
export type Objet = { type: 'droite'; a: Pt; b: Pt } | { type: 'cercle'; c: Pt; r: number } | { type: 'point'; p: Pt };

export function objetDe(p: Primitive): Objet | null {
  if (p.type === 'segment' || p.type === 'droite' || p.type === 'demi-droite') return dist(p.a, p.b) > 1e-9 ? { type: 'droite', a: p.a, b: p.b } : null;
  if (p.type === 'cercle' || p.type === 'arc') return { type: 'cercle', c: p.c, r: p.r };
  if (p.type === 'point') return { type: 'point', p: p.p };
  return null;
}

/** Point de contact d'un cercle de centre c avec l'objet. */
function contact(o: Objet, c: Pt): Pt {
  if (o.type === 'point') return o.p;
  if (o.type === 'droite') {
    const u = unit(sub(o.b, o.a));
    return add(o.a, mul(u, dot(sub(c, o.a), u)));
  }
  const d = dist(c, o.c);
  return d < 1e-12 ? add(o.c, { x: o.r, y: 0 }) : add(o.c, mul(sub(c, o.c), o.r / d));
}

/** Équations « le cercle (c, r) touche l'objet », une par cas (côté de la droite, contact extérieur ou intérieur). */
function equations(o: Objet): ((c: Pt, r: number) => number)[] {
  if (o.type === 'point') return [(c, r) => dist(c, o.p) - r];
  if (o.type === 'droite') {
    const u = unit(sub(o.b, o.a));
    const n = { x: -u.y, y: u.x };
    return [(c, r) => dot(sub(c, o.a), n) - r, (c, r) => -dot(sub(c, o.a), n) - r];
  }
  return [(c, r) => dist(c, o.c) - (o.r + r), (c, r) => dist(c, o.c) - (o.r - r), (c, r) => dist(c, o.c) - (r - o.r)];
}

/** Résout F(x) = 0 (3 inconnues) par la méthode de Newton, jacobien numérique. */
function newton(f: (x: number[]) => number[], x0: number[], echelle: number): number[] | null {
  let x = [...x0];
  for (let it = 0; it < 60; it++) {
    const F = f(x);
    if (F.every((v) => Math.abs(v) < 1e-9 * echelle)) return x;
    const h = 1e-7 * echelle;
    const J = [0, 1, 2].map((j) => {
      const xh = [...x];
      xh[j] += h;
      const Fh = f(xh);
      return Fh.map((v, i) => (v - F[i]) / h);
    }); // J[j][i] = dFi/dxj
    const m = [0, 1, 2].map((i) => [J[0][i], J[1][i], J[2][i]]);
    const det = (a: number[][]) => a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
    const D = det(m);
    if (Math.abs(D) < 1e-18) return null;
    const delta = [0, 1, 2].map((k) => det(m.map((row, i) => row.map((v, j) => (j === k ? F[i] : v)))) / D);
    x = x.map((v, i) => v - delta[i]);
    if (!x.every(Number.isFinite)) return null;
  }
  return null;
}

/**
 * D6 — Cercle tangent à trois entités (segments, cercles ou arcs, points). Parmi toutes les solutions,
 * celle dont les points de contact sont les plus proches des points désignés.
 */
export function cercleTriTangent(objets: [Objet, Objet, Objet], designes: [Pt, Pt, Pt]): { c: Pt; r: number } | null {
  const g = mul(add(add(designes[0], designes[1]), designes[2]), 1 / 3);
  const echelle = Math.max(1, ...designes.map((d) => dist(d, g)));
  const departs: Pt[] = [g, add(g, { x: echelle * 0.3, y: 0 }), add(g, { x: 0, y: -echelle * 0.3 }), ...designes.map((d) => add(mul(g, 0.6), mul(d, 0.4)))];
  const eqs = objets.map(equations);
  let meilleur: { c: Pt; r: number; note: number } | null = null;
  for (const e0 of eqs[0])
    for (const e1 of eqs[1])
      for (const e2 of eqs[2]) {
        const F = ([x, y, r]: number[]) => [e0({ x, y }, r), e1({ x, y }, r), e2({ x, y }, r)];
        for (const c0 of departs) {
          const r0 = objets.reduce((s, o) => s + dist(c0, contact(o, c0)), 0) / 3 || echelle / 2;
          const x = newton(F, [c0.x, c0.y, r0], echelle);
          if (!x || x[2] <= 1e-6 * echelle) continue;
          const c = { x: x[0], y: x[1] };
          const note = objets.reduce((s, o, i) => s + dist(contact(o, c), designes[i]), 0);
          if (!meilleur || note < meilleur.note - 1e-9) meilleur = { c, r: x[2], note };
        }
      }
  return meilleur ? { c: meilleur.c, r: meilleur.r } : null;
}

/** Courbes parallèles à un objet, à la distance r (lieux possibles du centre d'un congé de rayon r). */
function decalages(o: Objet, r: number): Primitive[] {
  if (o.type === 'point') return [{ type: 'cercle', c: o.p, r }];
  if (o.type === 'droite') {
    const u = unit(sub(o.b, o.a));
    const n = { x: -u.y * r, y: u.x * r };
    return [
      { type: 'droite', a: add(o.a, n), b: add(o.b, n) },
      { type: 'droite', a: sub(o.a, n), b: sub(o.b, n) },
    ];
  }
  const out: Primitive[] = [{ type: 'cercle', c: o.c, r: o.r + r }];
  if (Math.abs(o.r - r) > 1e-9) out.push({ type: 'cercle', c: o.c, r: Math.abs(o.r - r) });
  return out;
}

/**
 * D11 — Raccordement de deux entités (segment, arc, point) par un arc de rayon |r| : l'arc dont les points
 * de contact sont les plus proches des points désignés. r < 0 : l'arc complémentaire (plus de 180°).
 */
export function raccordGeneral(o1: Objet, p1: Pt, o2: Objet, p2: Pt, r: number): { arc: Extract<Primitive, { type: 'arc' }>; t1: Pt; t2: Pt } | null {
  const R = Math.abs(r);
  if (R < 1e-9) return null;
  let meilleur: { c: Pt; t1: Pt; t2: Pt; note: number } | null = null;
  for (const d1 of decalages(o1, R))
    for (const d2 of decalages(o2, R))
      for (const c of intersections(d1, d2)) {
        const t1 = contact(o1, c);
        const t2 = contact(o2, c);
        if (Math.abs(dist(c, t1) - R) > 1e-6 * Math.max(1, R) || Math.abs(dist(c, t2) - R) > 1e-6 * Math.max(1, R)) continue;
        const note = dist(t1, p1) + dist(t2, p2);
        if (!meilleur || note < meilleur.note) meilleur = { c, t1, t2, note };
      }
  if (!meilleur) return null;
  const { c, t1, t2 } = meilleur;
  const a1 = angleDe(c, t1);
  const a2 = angleDe(c, t2);
  const petit = norm(a2 - a1) <= 180;
  // Le petit arc (congé), ou son complément si le rayon est négatif.
  const [debut, fin] = petit === r > 0 ? [a1, a2] : [a2, a1];
  return { arc: { type: 'arc', c, r: R, debut, fin }, t1, t2 };
}

// ======================================================================= Contour parallèle

/** Élément orienté d'un contour : segment de a vers b, ou arc de centre c parcouru dans un sens. */
type Element = { type: 'segment'; a: Pt; b: Pt } | { type: 'arc'; c: Pt; r: number; de: number; a: number; sens: 1 | -1 };

const debutDe = (e: Element): Pt => (e.type === 'segment' ? e.a : surCercle(e.c, e.r, e.de));
const finDe = (e: Element): Pt => (e.type === 'segment' ? e.b : surCercle(e.c, e.r, e.a));
/** Tangente unitaire au début ou à la fin, dans le sens de parcours. */
function tangente(e: Element, aLaFin: boolean): Pt {
  if (e.type === 'segment') return unit(sub(e.b, e.a));
  const ang = ((aLaFin ? e.a : e.de) * Math.PI) / 180;
  return { x: -Math.sin(ang) * e.sens, y: Math.cos(ang) * e.sens };
}

/** Éléments orientés depuis les primitives (segments, arcs) touchant un point. */
function orienter(p: Primitive, depuis: Pt, tol: number): Element | null {
  if (p.type === 'segment') {
    if (dist(p.a, depuis) < tol) return { type: 'segment', a: p.a, b: p.b };
    if (dist(p.b, depuis) < tol) return { type: 'segment', a: p.b, b: p.a };
    return null;
  }
  if (p.type === 'arc') {
    if (dist(surCercle(p.c, p.r, p.debut), depuis) < tol) return { type: 'arc', c: p.c, r: p.r, de: p.debut, a: p.debut + (norm(p.fin - p.debut) || 360), sens: 1 };
    if (dist(surCercle(p.c, p.r, p.fin), depuis) < tol) return { type: 'arc', c: p.c, r: p.r, de: p.fin, a: p.fin - (norm(p.fin - p.debut) || 360), sens: -1 };
  }
  return null;
}

/**
 * Le contour de base : du point de début au point de fin, en partant de la première entité et en suivant les
 * éléments qui se touchent. S'arrête dès qu'une extrémité ne touche plus rien. Fermé si début = fin.
 */
export function chaineContour(prims: readonly Primitive[], debut: Pt, fin: Pt, premiere: Primitive, tol = 1e-4): Element[] {
  const first = orienter(premiere, debut, tol);
  if (!first) return [];
  const utilises = new Set<Primitive>([premiere]);
  const chaine: Element[] = [first];
  for (let garde = 0; garde < 2000; garde++) {
    const bout = finDe(chaine[chaine.length - 1]);
    if (dist(bout, fin) < tol) break;
    const t = tangente(chaine[chaine.length - 1], true);
    let suivant: { e: Element; p: Primitive; virage: number } | null = null;
    for (const p of prims) {
      if (utilises.has(p)) continue;
      const e = orienter(p, bout, tol);
      if (!e) continue;
      const virage = Math.abs(Math.atan2(croix(t, tangente(e, false)), dot(t, tangente(e, false))));
      if (!suivant || virage < suivant.virage) suivant = { e, p, virage };
    }
    if (!suivant) break;
    utilises.add(suivant.p);
    chaine.push(suivant.e);
  }
  return chaine;
}

/** Décale un élément vers sa gauche (côté +1) ou sa droite (côté -1). Null s'il disparaît (rayon négatif). */
function decaler(e: Element, cote: number, d: number): Element | null {
  if (e.type === 'segment') {
    const u = unit(sub(e.b, e.a));
    const n = mul({ x: -u.y, y: u.x }, cote * d);
    return { type: 'segment', a: add(e.a, n), b: add(e.b, n) };
  }
  // Gauche d'un arc parcouru dans le sens trigonométrique : vers le centre.
  const r = e.r - cote * e.sens * d;
  return r > 1e-9 ? { ...e, r } : null;
}

const support = (e: Element): Primitive => (e.type === 'segment' ? { type: 'droite', a: e.a, b: e.b } : { type: 'cercle', c: e.c, r: e.r });

/** Coupe ou prolonge un élément pour qu'il finisse (ou commence) en `p`. */
function ajuster(e: Element, p: Pt, aLaFin: boolean): Element {
  if (e.type === 'segment') return aLaFin ? { ...e, b: p } : { ...e, a: p };
  // Angle de p, ramené près de l'angle actuel (l'arc garde son sens).
  const ref = aLaFin ? e.a : e.de;
  let ang = angleDe(e.c, p);
  while (ang - ref > 180) ang -= 360;
  while (ref - ang > 180) ang += 360;
  return aLaFin ? { ...e, a: ang } : { ...e, de: ang };
}

/**
 * D16 — Contour parallèle à `chaine`, du côté `cote` (+1 à gauche du sens de parcours), à la distance d.
 * `contourner` : angles extérieurs contournés par un arc de rayon d ; sinon les éléments sont prolongés
 * jusqu'à leur intersection.
 */
export function contourParallele(chaine: Element[], cote: number, d: number, contourner: boolean): Primitive[] {
  if (chaine.length === 0 || d <= 0) return [];
  const ferme = chaine.length > 1 && dist(finDe(chaine[chaine.length - 1]), debutDe(chaine[0])) < 1e-4;
  const sommets = chaine.map((e) => finDe(e)); // sommet entre l'élément i et le suivant
  const dec = chaine.map((e) => decaler(e, cote, d));
  const garde: { e: Element; i: number }[] = [];
  dec.forEach((e, i) => e && garde.push({ e, i }));
  const out: (Element | null)[] = garde.map((g) => g.e);
  const ajouts: Primitive[] = [];
  const n = garde.length;
  const joints = ferme ? n : n - 1;
  for (let k = 0; k < joints; k++) {
    const A = out[k]!;
    const B = out[(k + 1) % n]!;
    const V = sommets[garde[k].i];
    const fa = finDe(A);
    const db = debutDe(B);
    if (dist(fa, db) < 1e-6) continue;
    const virage = croix(tangente(chaine[garde[k].i], true), tangente(chaine[garde[(k + 1) % n].i], false));
    const exterieur = cote * virage < 0;
    const xs = intersections(support(A), support(B)).sort((p, q) => dist(p, V) - dist(q, V));
    if (exterieur && contourner) {
      const a1 = angleDe(V, fa);
      const a2 = angleDe(V, db);
      ajouts.push(norm(a2 - a1) <= 180 ? { type: 'arc', c: V, r: d, debut: a1, fin: a2 } : { type: 'arc', c: V, r: d, debut: a2, fin: a1 });
      continue;
    }
    if (xs.length) {
      out[k] = ajuster(A, xs[0], true);
      out[(k + 1) % n] = ajuster(out[(k + 1) % n]!, xs[0], false);
    } else {
      // Pas d'intersection (arcs qui ne se coupent plus) : on relie par un arc autour du sommet.
      const a1 = angleDe(V, fa);
      const a2 = angleDe(V, db);
      ajouts.push(norm(a2 - a1) <= 180 ? { type: 'arc', c: V, r: d, debut: a1, fin: a2 } : { type: 'arc', c: V, r: d, debut: a2, fin: a1 });
    }
  }
  const prims: Primitive[] = out.flatMap((e): Primitive[] => {
    if (!e) return [];
    if (e.type === 'segment') return dist(e.a, e.b) > 1e-9 ? [{ type: 'segment', a: e.a, b: e.b }] : [];
    if (Math.abs(e.a - e.de) < 1e-9) return [];
    return e.sens === 1 ? [{ type: 'arc', c: e.c, r: e.r, debut: norm(e.de), fin: norm(e.a) }] : [{ type: 'arc', c: e.c, r: e.r, debut: norm(e.a), fin: norm(e.de) }];
  });
  return [...prims, ...ajouts];
}

/** Côté d'un point par rapport au premier élément d'un contour (+1 à gauche du sens de parcours). */
export function coteDe(chaine: Element[], p: Pt): number {
  const e = chaine[0];
  if (!e) return 1;
  if (e.type === 'segment') return Math.sign(croix(sub(e.b, e.a), sub(p, e.a))) || 1;
  const dedans = dist(p, e.c) < e.r;
  return (dedans ? 1 : -1) * e.sens;
}

// ======================================================================= Points

/** D17 — Symboles de points : 1 point simple, 2 croix, 3 croix oblique, 4 cercle, 5 cercle et croix, 6 carré, 7 carré et croix, 8 triangle, 9 losange. */
export function symbolePoint(p: Pt, type: number, taille: number): Primitive[] {
  const t = taille / 2;
  const seg = (a: Pt, b: Pt): Primitive => ({ type: 'segment', a: add(p, a), b: add(p, b) });
  const croixDroite = [seg({ x: -t, y: 0 }, { x: t, y: 0 }), seg({ x: 0, y: -t }, { x: 0, y: t })];
  const croixOblique = [seg({ x: -t, y: -t }, { x: t, y: t }), seg({ x: -t, y: t }, { x: t, y: -t })];
  const poly = (pts: Pt[]) => pts.map((a, i) => seg(a, pts[(i + 1) % pts.length]));
  switch (type) {
    case 2:
      return croixDroite;
    case 3:
      return croixOblique;
    case 4:
      return [{ type: 'cercle', c: p, r: t }, { type: 'point', p }];
    case 5:
      return [{ type: 'cercle', c: p, r: t }, ...croixDroite];
    case 6:
      return [...poly([{ x: -t, y: -t }, { x: t, y: -t }, { x: t, y: t }, { x: -t, y: t }]), { type: 'point', p }];
    case 7:
      return [...poly([{ x: -t, y: -t }, { x: t, y: -t }, { x: t, y: t }, { x: -t, y: t }]), ...croixOblique];
    case 8:
      return [...poly([0, 120, 240].map((a) => surCercle({ x: 0, y: 0 }, t, 90 + a))), { type: 'point', p }];
    case 9:
      return [...poly([{ x: 0, y: -t }, { x: t, y: 0 }, { x: 0, y: t }, { x: -t, y: 0 }]), { type: 'point', p }];
    default:
      return [{ type: 'point', p }];
  }
}
