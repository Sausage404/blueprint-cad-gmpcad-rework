// Fabrique les deux extensions « Coup d'œil » (Quick Look) du Mac dans quicklook/build/ :
//   BluePrintApercu.appex   : aperçu d'un DXF ou d'un .des avec la barre d'espace dans le Finder ;
//   BluePrintVignette.appex : vignettes des dessins dans le Finder.
// Elles sont ajoutées à l'appli et signées par apres-empaquetage.cjs (electron-builder, afterPack).
// Il faut les outils de Xcode (swiftc). Sur un autre système, rien n'est fait.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const sortie = join(ici, 'build');
if (process.platform !== 'darwin') {
  console.log('quicklook : seulement sur macOS, rien à faire.');
  process.exit(0);
}
const { version } = JSON.parse(readFileSync(join(ici, '..', 'package.json'), 'utf-8'));
const UTI = ['com.autodesk.dxf', 'fr.blueprint.cad.des'];
const MACOS_MIN = '12.0';

rmSync(sortie, { recursive: true, force: true });
mkdirSync(sortie, { recursive: true });

// 1. Le lecteur DXF / .des du logiciel, pour JavaScriptCore.
await build({ entryPoints: [join(ici, '..', 'src', 'quicklook', 'apercu.ts')], outfile: join(sortie, 'apercu.js'), bundle: true, format: 'iife', target: 'es2020', logLevel: 'warning' });

const plist = (o) => {
  const val = (v, n) => {
    const t = '\t'.repeat(n);
    if (typeof v === 'boolean') return `${t}<${v}/>`;
    if (typeof v === 'number') return `${t}<integer>${v}</integer>`;
    if (Array.isArray(v)) return `${t}<array>\n${v.map((x) => val(x, n + 1)).join('\n')}\n${t}</array>`;
    if (typeof v === 'object') return `${t}<dict>\n${Object.entries(v).map(([k, x]) => `${t}\t<key>${k}</key>\n${val(x, n + 1)}`).join('\n')}\n${t}</dict>`;
    return `${t}<string>${String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</string>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n${val(o, 0)}\n</plist>\n`;
};

const sdk = execFileSync('xcrun', ['--sdk', 'macosx', '--show-sdk-path']).toString().trim();

function extension({ nom, fichier, module, identifiant, point, classe, sources, frameworks, attributs }) {
  const appex = join(sortie, `${fichier}.appex`);
  const contents = join(appex, 'Contents');
  mkdirSync(join(contents, 'MacOS'), { recursive: true });
  mkdirSync(join(contents, 'Resources'), { recursive: true });
  // Binaire universel (puces Apple et Intel), comme les deux versions de l'appli.
  const binaires = ['arm64', 'x86_64'].map((arch) => {
    const out = join(sortie, `${module}-${arch}`);
    execFileSync('xcrun', [
      'swiftc', '-O', '-module-name', module, '-target', `${arch}-apple-macos${MACOS_MIN}`, '-sdk', sdk,
      '-application-extension', '-parse-as-library', '-Xlinker', '-e', '-Xlinker', '_NSExtensionMain',
      ...frameworks.flatMap((f) => ['-framework', f]), ...sources.map((s) => join(ici, s)), '-o', out,
    ], { stdio: 'inherit' });
    return out;
  });
  execFileSync('lipo', ['-create', ...binaires, '-output', join(contents, 'MacOS', module)]);
  binaires.forEach((b) => rmSync(b));
  cpSync(join(sortie, 'apercu.js'), join(contents, 'Resources', 'apercu.js'));
  writeFileSync(join(contents, 'Info.plist'), plist({
    CFBundleDevelopmentRegion: 'fr',
    CFBundleDisplayName: nom,
    CFBundleExecutable: module,
    CFBundleIdentifier: identifiant,
    CFBundleInfoDictionaryVersion: '6.0',
    CFBundleName: nom,
    CFBundlePackageType: 'XPC!',
    CFBundleShortVersionString: version,
    CFBundleVersion: version,
    LSMinimumSystemVersion: MACOS_MIN,
    NSHumanReadableCopyright: 'BluePrint CAD — logiciel libre sous licence GNU GPL v3',
    NSExtension: { NSExtensionPointIdentifier: point, NSExtensionPrincipalClass: classe, NSExtensionAttributes: { QLSupportedContentTypes: UTI, ...attributs } },
  }));
  console.log(`quicklook : ${fichier}.appex`);
}

extension({
  nom: 'BluePrint CAD Aperçu',
  fichier: 'BluePrintApercu',
  module: 'BluePrintApercu',
  identifiant: 'fr.blueprint.cad.apercu',
  point: 'com.apple.quicklook.preview',
  classe: 'PreviewProvider',
  sources: ['Moteur.swift', 'Apercu.swift'],
  frameworks: ['QuickLookUI', 'JavaScriptCore', 'Cocoa'],
  attributs: { QLIsDataBasedPreview: true, QLSupportsSearchableItems: false },
});
extension({
  nom: 'BluePrint CAD Vignette',
  fichier: 'BluePrintVignette',
  module: 'BluePrintVignette',
  identifiant: 'fr.blueprint.cad.vignette',
  point: 'com.apple.quicklook.thumbnail',
  classe: 'ThumbnailProvider',
  sources: ['Moteur.swift', 'Vignette.swift'],
  frameworks: ['QuickLookThumbnailing', 'JavaScriptCore', 'AppKit'],
  attributs: { QLThumbnailMinimumDimension: 0 },
});
