import assert from 'node:assert/strict';
import { test } from 'node:test';
import { angleTexteCote, cotation, COTATION_DEFAUT, suivreEchelle, texteCote } from '../src/renderer/cotation';
import { aciNiveau } from '../src/renderer/couleurs';
import { Dessin, segment, type Trait } from '../src/renderer/dessin';
import { ecrireDxf, lireDxf } from '../src/renderer/dxf';
import { format } from '../src/renderer/formats';
import { CouleurNiveaux, EchelleNiveau, FenetreMemorisee, NomenclatureNiveaux } from '../src/renderer/fonctions-gestion';
import { AnnulationEntite } from '../src/renderer/fonctions-modif';
import { svgFeuille } from '../src/renderer/svg';
import { traitSpecialSuivant, TRAITS_SPECIAUX } from '../src/renderer/traits';

const P = (x: number, y: number) => ({ x, y });
const proche = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

function ctx(d: Dessin, niveau = 1) {
  const at = { niveau, trait: 'continu-fort' as Trait };
  const messages: string[] = [];
  const affiche: { niveaux: Set<number> | null }[] = [];
  return {
    messages,
    affiche,
    dessin: d,
    attributs: () => at,
    memoire: new Map<string, number>(),
    rayon: () => 1,
    dire: (t: string) => messages.push(t),
    actions: {
      niveau: (n: number) => (at.niveau = n),
      afficher: (_a: unknown, _b: unknown, niveaux: Set<number> | null) => affiche.push({ niveaux }),
      origine: () => P(0, 0),
    } as never,
  };
}

test('F15 : traits spéciaux en boucle, invisible jamais imprimé, traits relus depuis le DXF', () => {
  assert.equal(traitSpecialSuivant('continu-fort', null), 'mixte-fort');
  assert.equal(traitSpecialSuivant('mixte-fort', 'mixte-fort'), 'mixte-fin-2');
  assert.equal(traitSpecialSuivant('invisible', 'invisible'), 'mixte-fort');
  assert.equal(traitSpecialSuivant('continu-fin', 'limite-coupe'), 'limite-coupe'); // reprend le dernier choisi
  assert.equal(TRAITS_SPECIAUX.length, 6);
  const d = new Dessin();
  d.ajouter(segment(P(0, 0), P(10, 0), 1, 'invisible'));
  d.ajouter(segment(P(0, 5), P(10, 5), 1, 'mixte-fin-2'));
  const svg = svgFeuille(d.toutes, format('A4H'));
  assert.equal((svg.match(/<path/g) ?? []).length, 1);
  const lu = lireDxf(ecrireDxf(d.toutes, d.calques, format('A4H'), aciNiveau)).entites;
  assert.deepEqual(
    lu.map((e) => e.trait),
    ['invisible', 'mixte-fin-2'],
  );
});

test('renseignements du dessin : paramètres, nomenclature, échelles, fenêtres et couleurs relus depuis le DXF', () => {
  const d = new Dessin();
  d.ajouter(segment(P(0, 0), P(10, 0), 1, 'continu-fort'));
  d.changerInfos((i) => {
    i.plan = { societe: 'Atelier', designation: 'Broche' };
    i.niveaux['1'] = { designation: 'Corps', reference: 'C-1', echelle: 2 };
    i.fenetres.VUE1 = { a: P(0, 0), b: P(50, 40), niveaux: '1' };
  });
  d.changerCouleurNiveaux([1, 4], 7);
  const r = lireDxf(ecrireDxf(d.toutes, d.calques, format('A4H'), aciNiveau, d.infos));
  assert.equal(r.infos?.plan.designation, 'Broche');
  assert.equal(r.infos?.niveaux['1'].reference, 'C-1');
  assert.deepEqual(r.infos?.fenetres.VUE1.b, P(50, 40));
  const d2 = new Dessin();
  d2.remplacer(r.entites, r.calques, r.infos ?? undefined);
  assert.equal(d2.couleurNiveau(1), 7);
  assert.equal(d2.couleurNiveau(4), 7); // niveau vide : sa couleur forcée est gardée aussi
  assert.equal(d2.echelleNiveau(1), 2);
  // Annuler revient aussi sur les renseignements.
  d.annulerAction();
  assert.equal(d.couleurNiveau(1), aciNiveau(1));
});

test('F3 : nomenclature des niveaux occupés, refus d’un niveau vide', () => {
  const d = new Dessin();
  d.ajouter(segment(P(0, 0), P(10, 0), 1, 'continu-fort'));
  d.ajouter(segment(P(0, 0), P(10, 0), 3, 'continu-fort'));
  const c = ctx(d);
  const f = new NomenclatureNiveaux(c);
  f.valeur('1+2');
  assert.match(c.messages.at(-1)!, /niveau vide \(2\)/);
  f.valeur('*');
  assert.match(f.question()!.texte, /Niveau 1\. Désignation/);
  f.valeur('Corps');
  f.valeur('C-1');
  assert.match(f.question()!.texte, /Niveau 3\. Désignation/);
  f.valeur('Couvercle');
  f.valeur('');
  assert.ok(f.termine());
  assert.equal(d.infos.niveaux['3'].designation, 'Couvercle');
});

test('F19 : couleur des niveaux, F20 : échelle d’un niveau et cotes en dimension réelle', () => {
  const d = new Dessin();
  d.ajouter(segment(P(10, 0), P(20, 0), 2, 'continu-fort'));
  const c = ctx(d, 2);
  const f = new CouleurNiveaux(c);
  f.valeur('tt');
  f.valeur(0);
  assert.equal(d.couleurNiveau(2), 7);
  assert.ok(f.termine());

  const e = new EchelleNiveau(c);
  e.valeur('tt');
  e.valeur(2);
  e.parDefaut(); // l'origine
  e.parDefaut(); // même position
  const s = d.toutes[0].primitives[0] as { a: { x: number }; b: { x: number } };
  proche(s.a.x, 20), proche(s.b.x, 40);
  assert.equal(d.echelleNiveau(2), 2);
  suivreEchelle(() => d.echelleNiveau(2));
  assert.equal(texteCote(20), '10');
  suivreEchelle(() => 1);
});

test('F9 : fenêtre nommée avec ses niveaux, puis éliminée', () => {
  const d = new Dessin();
  const c = ctx(d);
  const f = new FenetreMemorisee(c);
  f.valeur('vue1');
  f.point(P(0, 0));
  f.point(P(100, 50));
  assert.match(f.question()!.texte, /Niveaux à représenter/);
  f.valeur('1+3');
  assert.ok(f.termine());
  assert.deepEqual([...c.affiche[0].niveaux!], [1, 3]);
  assert.ok(d.infos.fenetres.VUE1);
  const g = new FenetreMemorisee(c);
  g.valeur('VUE1/');
  assert.equal(Object.keys(d.infos.fenetres).length, 0);
});

test('repérage limité au niveau de travail ( ), étendu avec (*)', () => {
  const d = new Dessin();
  d.ajouter(segment(P(0, 0), P(10, 0), 2, 'continu-fort'));
  let tous = false;
  const c = { ...ctx(d, 1), designables: () => (tous ? d.toutes : d.toutes.filter((e) => e.niveau === 1)) };
  const f = new AnnulationEntite(c);
  assert.equal(f.reperage, 'travail');
  f.point(P(5, 0));
  assert.equal(d.toutes.length, 1);
  assert.match(c.messages.at(-1)!, /niveau 2/);
  tous = true;
  f.point(P(5, 0));
  assert.equal(d.toutes.length, 0);
});

test('options de cotation : unité, décimales, cotation unidirectionnelle ISO', () => {
  Object.assign(cotation, { systeme: 'ISO', unidirectionnelle: true, unite: 'cm', decimales: 1 });
  assert.equal(angleTexteCote(90), 0);
  assert.equal(texteCote(25), '2.5');
  assert.equal(texteCote(12.34), '1.2');
  Object.assign(cotation, COTATION_DEFAUT);
  assert.equal(angleTexteCote(90), 90);
});
