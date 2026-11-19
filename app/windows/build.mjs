// Fabrique l'extension de l'Explorateur de Windows dans windows/build/ :
//   apercu.js            : le lecteur DXF / .des du logiciel, pour le moteur JavaScript de Windows (Chakra) ;
//   BluePrintApercu.dll  : vignettes et volet de visualisation (C#, avec apercu.js en ressource).
// La DLL est compilée par csc.exe, le compilateur C# fourni avec Windows (.NET Framework 4) : rien à
// installer. Sur un autre système, seul apercu.js est fait.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const sortie = join(ici, 'build');
rmSync(sortie, { recursive: true, force: true });
mkdirSync(sortie, { recursive: true });

// Chakra en est à ES2017 : syntaxe abaissée par esbuild, fonctions récentes ajoutées par polyfills.js.
await build({
  entryPoints: [join(ici, '..', 'src', 'quicklook', 'apercu.ts')],
  outfile: join(sortie, 'apercu.js'),
  bundle: true,
  format: 'iife',
  target: 'es2017',
  banner: { js: readFileSync(join(ici, 'polyfills.js'), 'utf-8') },
  logLevel: 'warning',
});

if (process.platform !== 'win32') {
  console.log('windows : apercu.js fait ; la DLL se compile sous Windows.');
  process.exit(0);
}
const csc = join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
if (!existsSync(csc)) throw new Error(`compilateur C# introuvable : ${csc}`);
execFileSync(
  csc,
  [
    '/nologo',
    '/target:library',
    '/optimize+',
    '/platform:anycpu',
    `/out:${join(sortie, 'BluePrintApercu.dll')}`,
    `/resource:${join(sortie, 'apercu.js')},apercu.js`,
    '/reference:System.Drawing.dll',
    '/reference:System.Windows.Forms.dll',
    join(ici, 'BluePrintApercu.cs'),
  ],
  { stdio: 'inherit' },
);
console.log('windows : BluePrintApercu.dll');
