// electron-builder, « afterPack » (macOS) : ajoute les extensions Coup d'œil (quicklook/build) dans
// Contents/PlugIns, puis signe toute l'appli « ad hoc » (sans certificat Apple payant).
//
// Sans cette signature complète, seul le programme principal porte une signature partielle : sur un autre
// Mac, macOS peut alors dire que l'appli « est endommagée » au lieu de proposer « Ouvrir quand même ».
// Les extensions, elles, doivent être signées avec leur bac à sable pour que le Finder les charge.
const { execFileSync } = require('node:child_process');
const { cpSync, existsSync, mkdirSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

exports.default = async function apresEmpaquetage(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const build = join(__dirname, 'build');
  const extensions = existsSync(build) ? readdirSync(build).filter((f) => f.endsWith('.appex')) : [];
  if (extensions.length === 0) console.warn('  • quicklook : extensions absentes (lancer « node quicklook/build.mjs ») : pas d\'aperçu dans le Finder.');
  const plugins = join(app, 'Contents', 'PlugIns');
  mkdirSync(plugins, { recursive: true });
  for (const e of extensions) cpSync(join(build, e), join(plugins, e), { recursive: true });

  const signer = (...args) => execFileSync('codesign', ['--force', '--sign', '-', ...args], { stdio: 'inherit' });
  // 1. Tout le contenu (Electron, ses aides, ses bibliothèques) ;
  signer('--deep', app);
  // 2. les extensions, avec leur bac à sable ;
  for (const e of extensions) signer('--entitlements', join(__dirname, 'extension.entitlements'), join(plugins, e));
  // 3. l'appli elle-même, pour sceller les extensions signées.
  signer(app);
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
  console.log(`  • quicklook : ${extensions.length} extension(s) ajoutée(s), appli signée ad hoc`);
};
