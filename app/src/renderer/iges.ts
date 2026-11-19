// IGES (menu Outils) : échange 2D avec d'autres logiciels de CAO. Sont écrits et lus : lignes (type 110),
// arcs et cercles (100), points (116). Les textes, cotes et hachures sont écrits en lignes et arcs ; les
// textes ne sont pas transmis. Sans DOM (testé dans test/menus.test.ts).
import type { Entite } from './dessin';
import type { Pt } from './geometrie';
import { surCercle, type Primitive } from './primitives';

const f = (v: number) => {
  const t = (Math.round(v * 1e6) / 1e6).toString();
  return t.includes('.') || t.includes('e') ? t : `${t}.`;
};
const champ = (v: string | number, l = 8) => String(v).padStart(l, ' ').slice(-l);
const ligne = (donnees: string, section: string, n: number) => `${donnees.padEnd(72, ' ').slice(0, 72)}${section}${String(n).padStart(7, ' ')}`;

/** Chaîne au format Hollerith (« 4Htexte »). */
const h = (s: string) => `${s.length}H${s}`;

/** Fichier IGES (version 5.3, millimètres) des primitives du dessin. */
export function ecrireIges(entites: readonly Entite[], nomFichier = 'dessin.igs'): string {
  const params: { type: number; p: (string | number)[] }[] = [];
  for (const e of entites) {
    for (const p of e.primitives) {
      if (p.type === 'segment' || p.type === 'droite' || p.type === 'demi-droite') params.push({ type: 110, p: [110, f(p.a.x), f(p.a.y), f(0), f(p.b.x), f(p.b.y), f(0)] });
      else if (p.type === 'cercle') {
        const a = { x: p.c.x + p.r, y: p.c.y };
        params.push({ type: 100, p: [100, f(0), f(p.c.x), f(p.c.y), f(a.x), f(a.y), f(a.x), f(a.y)] });
      } else if (p.type === 'arc') {
        const a = surCercle(p.c, p.r, p.debut);
        const b = surCercle(p.c, p.r, p.fin);
        params.push({ type: 100, p: [100, f(0), f(p.c.x), f(p.c.y), f(a.x), f(a.y), f(b.x), f(b.y)] });
      } else if (p.type === 'point') params.push({ type: 116, p: [116, f(p.p.x), f(p.p.y), f(0), 0] });
    }
  }
  const S = [ligne('BluePrint CAD : dessin 2D exporté en IGES.', 'S', 1)];
  const date = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13).replace(/^(\d{8})(\d{4,6}).*/, '$1.$2');
  const globaux = [
    '1H,',
    '1H;',
    h('BluePrint CAD'),
    h(nomFichier),
    h('BluePrint CAD'),
    h('BluePrint CAD 0.1'),
    32,
    38,
    6,
    308,
    15,
    h('BluePrint CAD'),
    f(1),
    2, // unités : millimètres
    h('MM'),
    1,
    f(0.5),
    h(date),
    f(0.001),
    f(10000),
    h(''),
    h(''),
    11, // IGES 5.3
    0,
  ].join(',') + ';';
  const G: string[] = [];
  for (let i = 0; i < globaux.length; i += 72) G.push(ligne(globaux.slice(i, i + 72), 'G', G.length + 1));
  const D: string[] = [];
  const P: string[] = [];
  params.forEach((e, i) => {
    const de = 2 * i + 1;
    const texte = e.p.join(',') + ';';
    const morceaux: string[] = [];
    let reste = texte;
    while (reste.length) {
      let coupe = Math.min(64, reste.length);
      if (coupe < reste.length) coupe = reste.lastIndexOf(',', 64) + 1 || 64;
      morceaux.push(reste.slice(0, coupe));
      reste = reste.slice(coupe);
    }
    const debutP = P.length + 1;
    for (const m of morceaux) P.push(`${m.padEnd(64, ' ')}${champ(de)}P${String(P.length + 1).padStart(7, ' ')}`);
    D.push(ligne([e.type, debutP, 0, 0, 0, 0, 0, 0, '00000000'].map((v) => champ(v)).join(''), 'D', de));
    D.push(ligne([e.type, 0, 0, morceaux.length, 0, '', '', '', 0].map((v) => champ(v)).join(''), 'D', de + 1));
  });
  const T = [ligne(`S${champ(S.length, 7)}G${champ(G.length, 7)}D${champ(D.length, 7)}P${champ(P.length, 7)}`, 'T', 1)];
  return [...S, ...G, ...D, ...P, ...T].join('\r\n') + '\r\n';
}

/** Primitives d'un fichier IGES : lignes (110), arcs et cercles (100), points (116), polylignes (106). */
export function lireIges(texte: string): { primitives: Primitive[]; ignores: Record<string, number> } {
  const lignes = texte.split(/\r?\n/).filter((l) => l.length >= 73);
  const D = lignes.filter((l) => l[72] === 'D');
  const P = lignes.filter((l) => l[72] === 'P');
  const prims: Primitive[] = [];
  const ignores: Record<string, number> = {};
  const numero = (l: string) => Number(l.slice(73).trim());
  const parSeq = new Map(P.map((l) => [numero(l), l]));
  for (let i = 0; i + 1 < D.length; i += 2) {
    const type = Number(D[i].slice(0, 8));
    const debut = Number(D[i].slice(8, 16));
    const nb = Number(D[i + 1].slice(24, 32)) || 1;
    const forme = Number(D[i + 1].slice(32, 40)) || 0;
    let t = '';
    for (let k = 0; k < nb; k++) t += (parSeq.get(debut + k) ?? '').slice(0, 64);
    const v = t.split(';')[0].split(',').map((x) => Number(x.replace(/[dD]/, 'e')));
    const P2 = (x: number, y: number): Pt => ({ x, y });
    if (type === 110) prims.push({ type: 'segment', a: P2(v[1], v[2]), b: P2(v[4], v[5]) });
    else if (type === 100) {
      const c = P2(v[2], v[3]);
      const a = P2(v[4], v[5]);
      const b = P2(v[6], v[7]);
      const r = Math.hypot(a.x - c.x, a.y - c.y);
      if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-9) prims.push({ type: 'cercle', c, r });
      else prims.push({ type: 'arc', c, r, debut: (Math.atan2(a.y - c.y, a.x - c.x) * 180) / Math.PI, fin: (Math.atan2(b.y - c.y, b.x - c.x) * 180) / Math.PI });
    } else if (type === 116) prims.push({ type: 'point', p: P2(v[1], v[2]) });
    else if (type === 106 && (forme === 11 || forme === 12 || forme === 1 || forme === 2)) {
      // Polyligne (données copieuses) : IP, N, puis les points (2D si IP = 1 ou forme 11).
      const ip = v[1];
      const n = v[2];
      const pts: Pt[] = [];
      const pas = ip === 1 ? 2 : 3;
      const debutPts = ip === 1 ? 4 : 3;
      for (let k = 0; k < n; k++) pts.push(P2(v[debutPts + k * pas], v[debutPts + k * pas + 1]));
      for (let k = 1; k < pts.length; k++) prims.push({ type: 'segment', a: pts[k - 1], b: pts[k] });
    } else if (type !== 124 && type !== 0) ignores[`type ${type}`] = (ignores[`type ${type}`] ?? 0) + 1;
  }
  return { primitives: prims.filter((p) => !Object.values(p).some((x) => typeof x === 'number' && !Number.isFinite(x))), ignores };
}
