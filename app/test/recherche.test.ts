import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chercher, entreesCommandes, entreesPalette } from '../src/renderer/recherche';

const entrees = [...entreesPalette((code) => code !== 'D6', () => {}), ...entreesCommandes(() => {})];
const codes = (texte: string) => chercher(entrees, texte).map((e) => e.code || e.libelle);

test('recherche de fonction : libellés, accents, mots d’aujourd’hui et codes de case', () => {
  assert.equal(codes('chanfrein')[0], 'D10');
  assert.equal(codes('congé')[0], 'D11'); // mot d'aujourd'hui pour « raccordement »
  assert.equal(codes('conge')[0], 'D11'); // sans accent
  assert.equal(codes('miroir')[0], 'E16');
  assert.equal(codes('d10')[0], 'D10'); // code de la case
  assert.deepEqual(codes('cercle').slice(0, 2), ['D4', 'D5']);
  assert.ok(codes('cercle').indexOf('D6') > 1); // pas encore disponible : après
  assert.equal(codes('enregistrer')[0], 'Enregistrer');
  assert.deepEqual(codes('zzz'), []);
  assert.equal(codes('').length, 12);
});
