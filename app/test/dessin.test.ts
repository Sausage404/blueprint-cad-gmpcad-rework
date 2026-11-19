import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Dessin, segment } from '../src/renderer/dessin';
import { EditeurLigne } from '../src/renderer/editeur';
import { Segments } from '../src/renderer/fonctions';

const touche = (key: string, ctrlKey = false) => ({ key, ctrlKey, metaKey: false, altKey: false }) as KeyboardEvent;

test('Maj + clic gauche : annule puis restitue la dernière entité (bascule)', () => {
  const d = new Dessin();
  d.ajouter(segment({ x: 0, y: 0 }, { x: 1, y: 0 }, 1, 'continu-fort'));
  d.ajouter(segment({ x: 1, y: 0 }, { x: 1, y: 1 }, 1, 'continu-fort'));
  assert.equal(d.basculer(), 'annulee');
  assert.equal(d.toutes.length, 1);
  assert.equal(d.basculer(), 'restituee');
  assert.equal(d.toutes.length, 2);
  assert.equal(d.basculer(), 'annulee');
  d.ajouter(segment({ x: 5, y: 5 }, { x: 6, y: 6 }, 1, 'continu-fort'));
  assert.equal(d.restituer(), null); // une nouvelle entité rend l'ancienne annulation définitive
});

test('Tracé de segments : chaque extrémité devient l’origine du suivant ; Échap lève le crayon', () => {
  const d = new Dessin();
  const f = new Segments({ dessin: d, attributs: () => ({ niveau: 1, trait: 'continu-fort' }), memoire: new Map(), rayon: () => 1, dire: () => {} });
  f.point({ x: 0, y: 0 });
  f.point({ x: 10, y: 0 });
  f.point({ x: 10, y: 10 });
  assert.equal(d.toutes.length, 2);
  assert.deepEqual(f.dernierPoint(), { x: 10, y: 10 });
  assert.equal(f.abandon(), false); // premier Échap : crayon levé
  assert.equal(f.dernierPoint(), null);
  assert.equal(f.abandon(), true); // second Échap : déjà au début
  f.point({ x: 20, y: 20 });
  assert.equal(d.toutes.length, 2); // un seul point : pas encore de segment
});

test('éditeur de ligne : insertion, effacements, rappel du défaut', () => {
  const e = new EditeurLigne('12.5');
  for (const k of ['1', '0']) e.touche(touche(k));
  assert.equal(e.texte, '10');
  e.touche(touche('ArrowLeft'));
  e.touche(touche('5'));
  assert.equal(e.texte, '150'); // insertion au curseur
  e.touche(touche('Backspace'));
  assert.equal(e.texte, '10');
  e.touche(touche('ArrowUp'));
  assert.equal(e.texte, '12.5'); // ↑ rappelle la valeur par défaut
  e.touche(touche('x', true));
  assert.equal(e.texte, ''); // Ctrl+X efface la ligne
  assert.equal(e.touche(touche('Enter')), 'valide');
  assert.equal(e.touche(touche('Escape')), 'abandon');
});

test('Edition > Annuler : annulation illimitée, une étape par action, puis Refaire', async () => {
  const d = new Dessin();
  const action = () => Promise.resolve(); // fin d'une action de l'utilisateur
  const s = (x: number) => segment({ x, y: 0 }, { x: x + 1, y: 0 }, 1, 'continu-fort');
  d.ajouter(s(0));
  await action();
  d.ajouter(s(1));
  await action();
  // Une seule action qui fait plusieurs changements (ex. un effacement partiel) = une seule étape.
  const e = d.toutes[0];
  d.remplacerEntite(e, [s(10), s(11)]);
  d.ajouter(s(12));
  await action();
  assert.equal(d.toutes.length, 4);
  assert.ok(d.annulerAction());
  assert.equal(d.toutes.length, 2);
  assert.ok(d.annulerAction());
  assert.ok(d.annulerAction());
  assert.equal(d.toutes.length, 0);
  assert.equal(d.annulerAction(), false);
  assert.ok(d.refaireAction());
  assert.ok(d.refaireAction());
  assert.equal(d.toutes.length, 2);
  // Une nouvelle action efface ce qui restait à refaire.
  d.ajouter(s(20));
  await action();
  assert.equal(d.refaireAction(), false);
  // Ouvrir un autre dessin vide l'historique.
  d.remplacer([]);
  assert.equal(d.peutAnnuler, false);
});
