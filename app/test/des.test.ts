import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { EXEMPLES, sansExemples } from './exemples';
import { enregistrementsFortran, lireDes } from '../src/renderer/des';
import { lireDxf } from '../src/renderer/dxf';
import { formatPour } from '../src/renderer/formats';
import type { Primitive } from '../src/renderer/primitives';

const FORMATS: Record<string, [number, number]> = {
  BROCHE: [840, 594],
  RIDOIR: [594, 420],
  CAR: [594, 420],
  AJAX: [1188, 840],
  CERCE00: [1188, 840],
};

test('enregistrements MS-FORTRAN : blocs de 128 octets recollés', () => {
  // 'K', un enregistrement de 3 octets, un de 130 (128 + 2), puis la fin.
  const bloc = [0x81, ...new Array(128).fill(7), 0x81, 0x02, 8, 9, 0x02];
  const r = enregistrementsFortran(new Uint8Array([0x4b, 0x03, 1, 2, 3, 0x03, ...bloc, 0x82]));
  assert.equal(r.length, 2);
  assert.deepEqual([...r[0]], [1, 2, 3]);
  assert.equal(r[1].length, 130);
});

for (const nom of Object.keys(FORMATS)) {
  test(`lit ${nom}.DES directement : format, et mêmes segments et cercles que la conversion DXF`, { skip: sansExemples }, () => {
    const des = lireDes(new Uint8Array(readFileSync(`${EXEMPLES}/${nom}.DES`)));
    assert.deepEqual(des.limites?.max, { x: FORMATS[nom][0], y: FORMATS[nom][1] });
    const prims = des.entites.flatMap((e) => e.primitives);
    const segments = prims.filter((p) => p.type === 'segment');
    assert.ok(segments.length > 300, `${segments.length} segments`);

    // Chaque segment et chaque cercle lus doivent exister dans le DXF fait par DESDXF.
    const dxf = lireDxf(readFileSync(`${EXEMPLES}/${nom}.DXF`, 'latin1'));
    const cle = (x: number, y: number) => `${Math.round(x * 10)}:${Math.round(y * 10)}`;
    const points = new Set<string>();
    for (const p of dxf.entites.flatMap((e) => e.primitives)) {
      if (p.type === 'segment') points.add(cle(p.a.x, p.a.y)), points.add(cle(p.b.x, p.b.y));
      if (p.type === 'cercle' || p.type === 'arc') points.add(cle(p.c.x, p.c.y));
    }
    const trouve = (p: Primitive) =>
      p.type === 'segment' ? points.has(cle(p.a.x, p.a.y)) && points.has(cle(p.b.x, p.b.y)) : p.type === 'cercle' || p.type === 'arc' ? points.has(cle(p.c.x, p.c.y)) : true;
    // Segments, cercles et arcs « simples » (les courbes lissées et les repères sont redessinés autrement par DESDXF).
    const geom = des.entites
      .filter((e) => e.genre === 'segment' || e.genre === 'cercle' || e.genre === 'arc')
      .flatMap((e) => e.primitives);
    const ok = geom.filter(trouve).length;
    assert.ok(ok / geom.length > 0.97, `${ok} / ${geom.length} retrouvés dans le DXF`);
  });
}

test('BROCHE : le cartouche est un groupe placé au coin du cadre (830, 10)', { skip: sansExemples }, () => {
  const des = lireDes(new Uint8Array(readFileSync(`${EXEMPLES}/BROCHE.DES`)));
  const groupes = des.entites.filter((e) => e.genre === 'groupe' && e.extras.length);
  assert.ok(groupes.some((g) => Math.abs(g.extras[0].p.x - 830) < 1e-3 && Math.abs(g.extras[0].p.y - 10) < 1e-3));
  const textes = des.entites.flatMap((e) => e.primitives).flatMap((p) => (p.type === 'texte' ? [p.texte] : []));
  assert.ok(textes.some((t) => t.startsWith('Désignation')), 'accents du cartouche');
  assert.ok(textes.some((t) => t.includes('Ø150')), 'symbole diamètre');
});

test('RIDOIR : textes accentués et en-tête', { skip: sansExemples }, () => {
  const des = lireDes(new Uint8Array(readFileSync(`${EXEMPLES}/RIDOIR.DES`)));
  assert.ok(des.entete.includes('Ridoir hydraulique.'));
  const textes = des.entites.flatMap((e) => e.primitives).flatMap((p) => (p.type === 'texte' ? [p.texte] : []));
  assert.ok(textes.includes('Vue A-A'));
  assert.ok(textes.includes('Deplacements  des  cliquets'));
});

const lire = (nom: string) => lireDes(new Uint8Array(readFileSync(`${EXEMPLES}/${nom}.DES`)));
const textesDe = (e: { primitives: Primitive[] }) => e.primitives.flatMap((p) => (p.type === 'texte' ? [p.texte] : []));
const longueur = (e: { primitives: Primitive[] }) => e.primitives.reduce((s, p) => s + (p.type === 'segment' ? Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y) : 0), 0);

test('cotes des .des : mêmes écritures que la conversion DXF (linéaires, Ø, R, angles, tolérances)', { skip: sansExemples }, () => {
  for (const nom of ['BROCHE', 'CERCE00', 'AJAX']) {
    const des = lire(nom);
    const dxf = lireDxf(readFileSync(`${EXEMPLES}/${nom}.DXF`, 'latin1'));
    // Cotes du DXF (les états de surface du .des sont aussi des cotes : on ne garde que les mêmes sortes).
    const ecrit = (e: { primitives: Primitive[] }) => textesDe(e).join('').replace(/\s/g, '');
    const attendues = dxf.entites.filter((e) => e.genre === 'cote').map(ecrit);
    const lues = des.entites.filter((e) => e.genre === 'cote' && e.primitives.some((p) => p.type === 'texte' && (p.mesure || p.texte.includes('°')))).map(ecrit);
    assert.deepEqual(lues, attendues);
  }
  // La valeur est gardée : une cote lue se refait dans un autre système (F4).
  const c = lire('BROCHE').entites.find((e) => e.genre === 'cote')!;
  assert.ok(c.primitives.some((p) => p.type === 'texte' && Math.abs((p.mesure?.v ?? 0) - 36) < 1e-3));
});

test('habillage des .des : flèches, repères, flèches de coupe, états de surface, taraudages, arcs d’ellipse', { skip: sansExemples }, () => {
  const genres = (nom: string) => lire(nom).entites.reduce((m, e) => ((m[e.genre] = (m[e.genre] ?? 0) + 1), m), {} as Record<string, number>);
  assert.equal(genres('BROCHE').fleche, 31);
  const ridoir = lire('RIDOIR');
  const reperes = ridoir.entites.filter((e) => e.genre === 'repere');
  assert.equal(reperes.length, 23);
  assert.ok(reperes.some((r) => textesDe(r).includes('14')));
  assert.equal(ridoir.entites.filter((e) => e.genre === 'fleche' && e.params?.lettre === 'A').length, 2);
  assert.equal(ridoir.entites.filter((e) => e.genre === 'ellipse').length, 7);
  const cerce = lire('CERCE00');
  assert.equal(cerce.entites.filter((e) => e.genre === 'cote' && textesDe(e).includes('3.2')).length, 7);
  assert.equal(lire('AJAX').entites.filter((e) => e.genre === 'groupe' && e.primitives.some((p) => p.type === 'cercle')).length >= 8, true);
  assert.equal(lire('CAR').entites.filter((e) => e.genre === 'rectangle').length, 5);
  assert.deepEqual(lire('BROCHE').ignores, {});
});

test('hachures des .des : contour rencontré vers l’Est, motifs de l’original, comme la conversion DXF', { skip: sansExemples }, () => {
  // Longueur totale des traits de chaque hachurage, comparée à celle de la conversion DXF (bloc *X).
  const comparer = (nom: string) => {
    const des = lire(nom).entites.filter((e) => e.genre === 'hachure');
    const dxf = lireDxf(readFileSync(`${EXEMPLES}/${nom}.DXF`, 'latin1')).entites.filter((e) => e.calque === 'HACHURES' && e.genre === 'groupe');
    let proches = 0;
    for (const h of des) {
      const p = h.extras[0].p;
      // Le hachurage DXF qui passe le plus près du point de référence.
      const g = dxf.reduce((m, x) => {
        const d = Math.min(...x.primitives.flatMap((q) => (q.type === 'segment' ? [Math.hypot(q.a.x - p.x, q.a.y - p.y), Math.hypot(q.b.x - p.x, q.b.y - p.y)] : [Infinity])));
        return d < m.d ? { d, x } : m;
      }, { d: Infinity, x: dxf[0] }).x;
      if (Math.abs(longueur(h) - longueur(g)) <= 0.05 * longueur(g) + 2) proches++;
    }
    return { proches, total: des.length };
  };
  const ajax = comparer('AJAX'); // alliages légers : lignes doublées
  assert.ok(ajax.proches >= 10, `${ajax.proches} / ${ajax.total}`);
  const broche = comparer('BROCHE');
  assert.equal(broche.total, 29);
  assert.ok(broche.proches >= 24, `${broche.proches} / ${broche.total}`);
  const ridoir = comparer('RIDOIR');
  assert.ok(ridoir.proches >= 18, `${ridoir.proches} / ${ridoir.total}`);
});

test('les conversions DXF (DESDXF) prennent le format de leur .des, même avec un en-tête faux (CAR : 29,7 x 21)', { skip: sansExemples }, () => {
  for (const [nom, [l, h]] of Object.entries(FORMATS)) {
    const r = lireDxf(readFileSync(`${EXEMPLES}/${nom}.DXF`, 'latin1'));
    const f = formatPour(r.limites, r.etendue);
    assert.ok(Math.abs(f.largeur - l) <= 2 && Math.abs(f.hauteur - h) <= 2, `${nom} : ${f.nom}`);
  }
});
