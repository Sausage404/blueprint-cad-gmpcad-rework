import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADRESSE_SIGNALEMENT, DEPOT_GITHUB, codeErreur, lienGithub, lienMail, MAX_MAIL, nettoyer, texteRapport, titreSignalement, type Incident } from '../src/shared/signalement';

const SYSTEME = { version: '0.1.0', electron: '45.3.4', chrome: '156.0', systeme: 'macOS 27.2.1 (arm64)', langue: 'fr-FR' };

test("code d'erreur : stable malgré les chemins, numéros de ligne et nombres ; différent pour une autre erreur", () => {
  const pileMac = "TypeError: x\n    at Poste.choisir (file:///Applications/BluePrint CAD.app/Contents/Resources/app.asar/dist/renderer.js:12:345)\n    at async clic (file:///Applications/BluePrint CAD.app/r.js:1:2)";
  const pileWin = 'TypeError: x\n    at Poste.choisir (C:\\Users\\Paul\\AppData\\Local\\Programs\\BluePrint CAD\\renderer.js:99:1)\n    at async clic (C:\\x\\r.js:7:7)';
  const a = codeErreur("Cannot read properties of undefined (reading 'x') à l'entité 12", pileMac);
  const b = codeErreur("Cannot read properties of undefined (reading 'x') à l'entité 4071", pileWin);
  assert.match(a, /^BP-[0-9A-F]{6}$/);
  assert.equal(a, b);
  assert.notEqual(a, codeErreur('Une autre erreur', pileMac));
});

test('nettoyer : retire le dossier personnel (toutes écritures) et le nom d’utilisateur', () => {
  const mac = nettoyer('Erreur dans /Users/jeanne/Documents/plan.dxf (file:///Users/jeanne/x) par jeanne', '/Users/jeanne', 'jeanne');
  assert.equal(mac, 'Erreur dans ~/Documents/plan.dxf (file://~/x) par <utilisateur>');
  const win = nettoyer('C:\\Users\\Jeanne\\Bureau\\a.des et file:///C:/Users/Jeanne/b.dxf', 'C:\\Users\\Jeanne', 'Jeanne');
  assert.equal(win, '~\\Bureau\\a.des et file:///~/b.dxf');
  // Le nom n'est remplacé que comme mot entier.
  assert.equal(nettoyer('maximum de max', '/Users/max', 'max'), 'maximum de <utilisateur>');
});

test('rapport : code, description, erreur, système et travail en cours', () => {
  const incident: Incident = { message: 'Boum', pile: 'Error: Boum\n    at f (a.js:1:1)', origine: 'interface', date: Date.UTC(2026, 10, 19, 8) };
  const t = texteRapport('Je traçais un cercle', SYSTEME, { theme: 'moderne', dessin: 'A4H, 3 éléments', fonction: 'Cercle', messages: ['Centre du cercle'] }, incident);
  assert.ok(t.startsWith(`Signalement BluePrint CAD — ${codeErreur('Boum', incident.pile)}`));
  for (const morceau of ['Je traçais un cercle', 'Boum', 'at f (a.js:1:1)', 'BluePrint CAD 0.1.0', 'macOS 27.2.1 (arm64)', 'A4H, 3 éléments', 'Fonction en cours : Cercle', 'Centre du cercle'])
    assert.ok(t.includes(morceau), morceau);
  assert.ok(texteRapport('', SYSTEME, {}).includes('(non décrit)'));
  assert.match(titreSignalement('', incident), /^\[BP-[0-9A-F]{6}\] Boum$/);
  assert.equal(titreSignalement('Le zoom saute\ndétails'), 'Problème : Le zoom saute');
});

test('liens : adresses fixes, texte encodé, rapport raccourci au-delà de la limite', () => {
  const g = lienGithub('Titre & co', 'Ligne 1\nLigne 2 <b>');
  assert.ok(g.startsWith(`https://github.com/${DEPOT_GITHUB}/issues/new?`));
  const q = new URL(g).searchParams;
  assert.equal(q.get('title'), 'Titre & co');
  assert.equal(q.get('body'), 'Ligne 1\nLigne 2 <b>');
  assert.equal(q.get('labels'), 'bug');
  // Un titre piégé ne peut pas changer l'adresse.
  assert.ok(new URL(lienGithub('x&title=y#z', 'c')).pathname.endsWith('/issues/new'));

  const m = lienMail('Sujet é', 'a\nb');
  assert.ok(m.startsWith(`mailto:${ADRESSE_SIGNALEMENT}?subject=`));
  assert.ok(m.includes('body=a%0D%0Ab'));
  assert.ok(m.includes('Sujet%20%C3%A9'));
  const long = lienMail('s', 'x'.repeat(MAX_MAIL * 3));
  assert.ok(decodeURIComponent(long).includes('rapport raccourci'));
  assert.ok(long.length < MAX_MAIL * 3);
});
