import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cotation, COTATION_DEFAUT, convertirCotes, formaterMesure, fractionPouce, lirePouces, pasGrilleSysteme, questionDeLongueur, type ReglageCotation } from '../src/renderer/cotation';
import { coteLineaire } from '../src/renderer/construction';
import { coteSelon } from '../src/renderer/cotes';
import { Dessin, type Entite } from '../src/renderer/dessin';
import { lireDxf, ecrireDxf } from '../src/renderer/dxf';
import { format } from '../src/renderer/formats';
import { rotation, transformerEntite } from '../src/renderer/edition';

const P = (x: number, y: number) => ({ x, y });
const R = (r: Partial<ReglageCotation>): ReglageCotation => ({ ...COTATION_DEFAUT, ...r });
const textes = (e: Entite) => e.primitives.flatMap((p) => (p.type === 'texte' ? [p.texte] : []));

test('ANSI : pouces décimaux sans zéro devant, fractions au 1/64 réduites', () => {
  assert.equal(formaterMesure(12.5, R({ systeme: 'ANSI', decimales: 3 })), '.492');
  assert.equal(formaterMesure(254, R({ systeme: 'ANSI', decimales: 2 })), '10');
  assert.equal(formaterMesure(82.55, R({ systeme: 'ANSI', fractionnaire: true })), '3 1/4');
  assert.equal(fractionPouce(0.5), '1/2');
  assert.equal(fractionPouce(2.999), '3');
  assert.equal(fractionPouce(1 + 3 / 64), '1 3/64');
});

test('ARCHI : en m avec 2 décimales à partir d’un mètre, en cm avec la décimale en exposant', () => {
  const a = R({ systeme: 'ARCHI' });
  assert.equal(formaterMesure(1250, a), '1.25');
  assert.equal(formaterMesure(1000, a), '1.00');
  assert.equal(formaterMesure(455, a), '45⁵');
  assert.equal(formaterMesure(450, a), '45');
  assert.equal(formaterMesure(999.6, a), '1.00');
});

test('saisie en pouces (ANSI) : 3"1/4, 3 1/4, 13/4, 3.95, 34.5M', () => {
  assert.equal(lirePouces('3"1/4'), 82.55);
  assert.equal(lirePouces('3 1/4'), 82.55);
  assert.equal(lirePouces('3-1/4'), 82.55);
  assert.equal(lirePouces('13/4'), 82.55);
  assert.ok(Math.abs(lirePouces('3.95')! - 100.33) < 1e-9);
  assert.equal(lirePouces('34.5M'), 34.5);
  assert.equal(lirePouces('abc'), null);
  assert.ok(questionDeLongueur('Valeur du rayon'));
  assert.ok(!questionDeLongueur('Nombre de duplications'));
  assert.ok(!questionDeLongueur('Angle des hachures'));
  assert.equal(pasGrilleSysteme(R({ systeme: 'ANSI', fractionnaire: true })), 25.4 / 32);
  assert.equal(pasGrilleSysteme(R({ systeme: 'ARCHI' })), 10);
});

test('changer de système transforme les cotes faites : valeur, sens d’écriture, flèches ou traits obliques', () => {
  Object.assign(cotation, COTATION_DEFAUT);
  const d = new Dessin();
  d.ajouter({ genre: 'cote', primitives: coteLineaire(P(0, 0), P(0, 455), P(20, 100), 3), extras: [], niveau: 1, trait: 'continu-fin' });
  d.ajouter({ genre: 'cote', primitives: coteSelon(P(0, 0), P(1250, 0), P(1, 0), P(0, 20)).primitives, extras: [], niveau: 1, trait: 'continu-fin' });
  assert.deepEqual(d.toutes.map(textes), [['455'], ['1250']]);
  const segments = (e: Entite) => e.primitives.filter((p) => p.type === 'segment').length;
  assert.equal(segments(d.toutes[0]), 3 + 4); // attaches, ligne, deux flèches de deux traits

  d.remplacerChaque(convertirCotes(d.toutes, R({ systeme: 'ARCHI' })));
  assert.deepEqual(d.toutes.map(textes), [['45⁵'], ['1.25']]);
  assert.equal(segments(d.toutes[0]), 3 + 2); // un trait oblique par extrémité

  // Puis en ISO unidirectionnelle : retour aux flèches, texte de la cote verticale horizontal.
  d.remplacerChaque(convertirCotes(d.toutes, R({ systeme: 'ISO', unidirectionnelle: true })));
  assert.deepEqual(d.toutes.map(textes), [['455'], ['1250']]);
  assert.equal(segments(d.toutes[0]), 3 + 4);
  const t = d.toutes[0].primitives.find((p) => p.type === 'texte')!;
  assert.equal(t.type === 'texte' && t.angle, 0);
  // Une fois tournée, la cote garde ses extrémités et sa valeur (en mm).
  const tournee = transformerEntite(d.toutes[0], rotation(P(0, 0), 90));
  const [c] = convertirCotes([tournee], R({ systeme: 'ANSI', fractionnaire: true }));
  assert.deepEqual(textes(c.apres), ['17 29/32']);
});

test('les écritures et extrémités des cotes sont gardées dans le DXF', () => {
  Object.assign(cotation, COTATION_DEFAUT);
  const d = new Dessin();
  d.ajouter({ genre: 'cote', primitives: coteLineaire(P(0, 0), P(100, 0), P(50, 20), 3), extras: [], niveau: 1, trait: 'continu-fin' });
  const relu = lireDxf(ecrireDxf(d.toutes, new Map(), format('A4H'), () => 7)).entites;
  const [c] = convertirCotes(relu, R({ systeme: 'ANSI', decimales: 2 }));
  assert.deepEqual(textes(c.apres), ['3.94']);
});
