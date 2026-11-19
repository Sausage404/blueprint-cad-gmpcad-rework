// Tests de sécurité : un dessin DXF falsifié ne doit pas pouvoir injecter de balisage dans l'aperçu, ni
// faire exploser le nombre de traits avec des blocs imbriqués (déni de service).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aciNiveau } from '../src/renderer/couleurs';
import { Dessin } from '../src/renderer/dessin';
import { ecrireDxf, lireDxf } from '../src/renderer/dxf';
import { format } from '../src/renderer/formats';
import { donneeImageValide, entiteImage, identifiantImage, type ImageStockee } from '../src/renderer/images';
import { svgFeuille } from '../src/renderer/svg';

const P = (x: number, y: number) => ({ x, y });

test('donneeImageValide : accepte une data URL base64, refuse tout balisage', () => {
  assert.ok(donneeImageValide('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA='));
  assert.ok(donneeImageValide('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='));
  assert.ok(!donneeImageValide('data:image/png;base64,AAA"/><script>alert(1)</script>'));
  assert.ok(!donneeImageValide('data:text/html,<script>alert(1)</script>'));
  assert.ok(!donneeImageValide('<svg onload="alert(1)">'));
  assert.ok(!donneeImageValide('javascript:alert(1)'));
});

test("une image au contenu falsifié est rejetée à la lecture du DXF, et ne ressort pas dans l'aperçu SVG", () => {
  // Données d'image fabriquées pour sortir de l'attribut href et injecter du balisage puis un script.
  const charge = 'data:image/png;base64,AAAA"/><foreignObject><body xmlns="http://www.w3.org/1999/xhtml">X</body></foreignObject><script>alert(1)</script><image href="';
  const id = identifiantImage(charge);
  const images = new Map<string, ImageStockee>([[id, { donnees: charge, fichier: '', date: 0, taille: 0, px: [4, 4] }]]);
  const d = new Dessin();
  d.ajouter(entiteImage(id, P(60, 60), 20, 20, 'general', 1));

  const relu = lireDxf(ecrireDxf(d.toutes, d.calques, format('A4H'), aciNiveau, undefined, images));
  assert.equal(relu.images.get(id)?.donnees, ''); // le contenu dangereux a été vidé

  const svg = svgFeuille(relu.entites, format('A4H'), (i) => relu.images.get(i)?.donnees);
  assert.ok(!svg.includes('<script'), 'pas de script dans le SVG');
  assert.ok(!svg.includes('<foreignObject'), 'pas de foreignObject dans le SVG');

  // Même si une donnée non validée atteignait svgFeuille, les guillemets et chevrons seraient échappés.
  const svgDirect = svgFeuille(d.toutes, format('A4H'), () => charge);
  assert.ok(!svgDirect.includes('"/><foreignObject'), 'le href est échappé');
  assert.ok(!svgDirect.includes('<script>alert'), 'pas de script exécutable');
});

test('blocs imbriqués (bombe de décompression) : la lecture reste bornée au lieu de tout faire exploser', () => {
  const L: string[] = [];
  const g = (c: number, v: string | number) => L.push(String(c), String(v));
  g(0, 'SECTION'), g(2, 'HEADER'), g(9, '$ACADVER'), g(1, 'AC1015'), g(0, 'ENDSEC');
  g(0, 'SECTION'), g(2, 'BLOCKS');
  // 10 niveaux ; chaque bloc insère 10 fois le bloc suivant → 10^10 traits sans plafond.
  for (let n = 0; n <= 10; n++) {
    g(0, 'BLOCK'), g(8, '0'), g(2, `B${n}`), g(70, 0), g(10, 0), g(20, 0), g(30, 0);
    if (n === 10) (g(0, 'LINE'), g(8, '0'), g(10, 0), g(20, 0), g(30, 0), g(11, 1), g(21, 1), g(31, 0));
    else for (let i = 0; i < 10; i++) (g(0, 'INSERT'), g(8, '0'), g(2, `B${n + 1}`), g(10, i), g(20, 0), g(30, 0));
    g(0, 'ENDBLK'), g(8, '0');
  }
  g(0, 'ENDSEC'), g(0, 'SECTION'), g(2, 'ENTITIES'), g(0, 'INSERT'), g(8, '0'), g(2, 'B0'), g(10, 0), g(20, 0), g(30, 0), g(0, 'ENDSEC'), g(0, 'EOF');

  const debut = Date.now();
  const r = lireDxf(L.join('\r\n') + '\r\n');
  assert.ok(Date.now() - debut < 10000, 'la lecture ne doit pas se bloquer');
  const traits = r.entites.reduce((s, e) => s + e.primitives.length, 0);
  assert.ok(traits <= 600_000, `nombre de traits borné (${traits})`);
});
