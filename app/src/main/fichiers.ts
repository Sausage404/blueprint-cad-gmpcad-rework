// Fichiers : ouvrir, enregistrer, backup. Les DXF sont lus et écrits ici (accès disque), le reste
// (lecture et écriture du format) se fait dans l'interface.
import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const FILTRES = [
  { name: 'Dessins (DXF, GMPCAD .des)', extensions: ['dxf', 'DXF', 'des', 'DES'] },
  { name: 'Tous les fichiers', extensions: ['*'] },
];
const FILTRES_ENREGISTRER = [{ name: 'Dessins DXF', extensions: ['dxf'] }];

/**
 * Un DXF jusqu'à R2004 est écrit dans la page de code du système (Latin-1 / Windows-1252 en France) ;
 * à partir de R2007 (AC1021), en UTF-8.
 */
export function decoderDxf(octets: Buffer): string {
  const debut = octets.subarray(0, 4000).toString('latin1');
  const m = /\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*AC(\d{4})/.exec(debut);
  return m && Number(m[1]) >= 1021 ? octets.toString('utf8') : octets.toString('latin1');
}

const backup = () => join(app.getPath('userData'), 'backup.dxf');

/** Dossier proposé pour les groupes (menu Groupe) : Documents/BluePrint CAD/Groupes. */
function dossierGroupes(): string {
  const d = join(app.getPath('documents'), 'BluePrint CAD', 'Groupes');
  try {
    mkdirSync(d, { recursive: true });
  } catch {
    return app.getPath('documents');
  }
  return d;
}
const FILTRES_GROUPES = [{ name: 'Groupes (DXF)', extensions: ['dxf', 'DXF'] }];

// Images (cases B1 à B4) : formats que l'écran sait afficher.
const TYPES_IMAGES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};
const TAILLE_MAX_IMAGE = 25 * 1024 * 1024;

/** Un fichier texte (macro) : UTF-8, ou à défaut Latin-1. */
function lireTexte(chemin: string): { chemin: string; nom: string; contenu: string } | null {
  try {
    const octets = readFileSync(chemin);
    const utf8 = octets.toString('utf8');
    return { chemin, nom: basename(chemin).replace(/\.(gmac|txt)$/i, ''), contenu: utf8.includes('\uFFFD') ? octets.toString('latin1') : utf8 };
  } catch {
    return null;
  }
}

/** Contenu d'une image en « data URL », avec la date et la taille du fichier ; null si illisible. */
function lireImage(chemin: string): { chemin: string; nom: string; donnees: string; date: number; taille: number } | null {
  const type = TYPES_IMAGES[extname(chemin).toLowerCase()];
  if (!type) return null;
  try {
    const st = statSync(chemin);
    if (!st.isFile() || st.size > TAILLE_MAX_IMAGE) return null;
    return { chemin, nom: basename(chemin), donnees: `data:${type};base64,${readFileSync(chemin).toString('base64')}`, date: st.mtimeMs, taille: st.size };
  } catch {
    return null;
  }
}

// Reprise après plantage : le dessin non enregistré est recopié ici quelques secondes après chaque
// changement, et effacé dès qu'il est enregistré ou que l'on quitte normalement.
// Une copie par session (fenêtre) : la session 1 garde les noms d'avant.
const recuperation = (n = 1) => join(app.getPath('userData'), n === 1 ? 'recuperation.dxf' : `recuperation-${n}.dxf`);
const recuperationInfos = (n = 1) => join(app.getPath('userData'), n === 1 ? 'recuperation.json' : `recuperation-${n}.json`);

export function effacerRecuperation(n = 1): void {
  rmSync(recuperation(n), { force: true });
  rmSync(recuperationInfos(n), { force: true });
}

/** Numéros des sessions qui ont laissé un dessin à reprendre (plantage). */
export function sessionsAReprendre(): number[] {
  return [1, 2, 3, 4, 5, 6, 7, 8].filter((n) => existsSync(recuperation(n)) && existsSync(recuperationInfos(n)));
}

/** Écrit d'abord dans un fichier temporaire : une coupure pendant l'écriture ne laisse pas un fichier abîmé. */
function ecrireSur(chemin: string, donnees: Buffer | string): void {
  writeFileSync(`${chemin}.tmp`, donnees);
  renameSync(`${chemin}.tmp`, chemin);
}

export function enregistrerFichiers(fenetre: () => BrowserWindow | null, recent: (chemin: string) => void, session: (wc: Electron.WebContents) => number): void {
  ipcMain.handle('fichier:ouvrir', async (_e, titre: string) => {
    const w = fenetre();
    if (!w) return null;
    const r = await dialog.showOpenDialog(w, { title: titre, filters: FILTRES, properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return null;
    return lire(r.filePaths[0], recent);
  });

  ipcMain.handle('fichier:lire', (_e, chemin: string) => lire(chemin, recent));

  ipcMain.handle('fichier:enregistrer', (_e, chemin: string, contenu: string) => {
    writeFileSync(chemin, Buffer.from(contenu, 'latin1'));
    recent(chemin);
    return chemin;
  });

  ipcMain.handle('fichier:enregistrer-sous', async (_e, nom: string, contenu: string) => {
    const w = fenetre();
    if (!w) return null;
    const r = await dialog.showSaveDialog(w, { title: 'Enregistrer sous', defaultPath: nom, filters: FILTRES_ENREGISTRER });
    if (r.canceled || !r.filePath) return null;
    const chemin = /\.dxf$/i.test(r.filePath) ? r.filePath : `${r.filePath}.dxf`;
    writeFileSync(chemin, Buffer.from(contenu, 'latin1'));
    recent(chemin);
    return chemin;
  });

  // Menu Groupe : un groupe est un petit dessin DXF qui ne contient que lui (pas ajouté aux fichiers récents).
  ipcMain.handle('groupe:ouvrir', async () => {
    const w = fenetre();
    if (!w) return null;
    const r = await dialog.showOpenDialog(w, { title: 'Placer un groupe', defaultPath: dossierGroupes(), filters: FILTRES_GROUPES, properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const chemin = r.filePaths[0];
    return { chemin, nom: basename(chemin).replace(/\.dxf$/i, ''), contenu: decoderDxf(readFileSync(chemin)) };
  });

  // Fichier d'un groupe ou d'une macro affecté à une case de la bibliothèque : relu par son chemin.
  ipcMain.handle('groupe:lire', (_e, chemin: string) => {
    try {
      return { chemin, nom: basename(chemin).replace(/\.dxf$/i, ''), contenu: decoderDxf(readFileSync(chemin)) };
    } catch {
      return null;
    }
  });
  ipcMain.handle('gmac:ouvrir', async () => {
    const w = fenetre();
    if (!w) return null;
    const r = await dialog.showOpenDialog(w, { title: 'Macro (Gmac)', defaultPath: dossierGroupes().replace(/Groupes$/, 'Macros'), filters: [{ name: 'Macros', extensions: ['gmac', 'txt'] }], properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return null;
    return lireTexte(r.filePaths[0]);
  });
  ipcMain.handle('gmac:lire', (_e, chemin: string) => lireTexte(chemin));

  // Menu Outils : IGES (texte), conversion par lots des anciens dessins .des en DXF.
  ipcMain.handle('texte:ouvrir', async (_e, titre: string, extensions: string[]) => {
    const w = fenetre();
    if (!w) return null;
    const r = await dialog.showOpenDialog(w, { title: titre, filters: [{ name: titre, extensions }], properties: ['openFile'] });
    return r.canceled || !r.filePaths[0] ? null : lireTexte(r.filePaths[0]);
  });
  ipcMain.handle('texte:enregistrer', async (_e, titre: string, nom: string, extension: string, contenu: string) => {
    const w = fenetre();
    if (!w) return null;
    const r = await dialog.showSaveDialog(w, { title: titre, defaultPath: nom, filters: [{ name: titre, extensions: [extension] }] });
    if (r.canceled || !r.filePath) return null;
    const chemin = r.filePath.toLowerCase().endsWith(`.${extension}`) ? r.filePath : `${r.filePath}.${extension}`;
    ecrireSur(chemin, contenu);
    return chemin;
  });
  ipcMain.handle('des:choisir', async () => {
    const w = fenetre();
    if (!w) return [];
    const r = await dialog.showOpenDialog(w, { title: 'Conversion dessin vers DXF', filters: [{ name: 'Dessins GMPCAD (.des)', extensions: ['des', 'DES'] }], properties: ['openFile', 'multiSelections'] });
    if (r.canceled) return [];
    return r.filePaths.map((chemin) => ({ chemin, nom: basename(chemin), contenu: readFileSync(chemin).toString('latin1') }));
  });
  /** Écrit le DXF à côté du dessin d'origine (nom.dxf, ou « nom (2).dxf » s'il existe déjà). */
  ipcMain.handle('dxf:ecrire-a-cote', (_e, chemin: string, contenu: string) => {
    const base = chemin.replace(/\.[^.\\/]*$/, '');
    let cible = `${base}.dxf`;
    for (let i = 2; existsSync(cible); i++) cible = `${base} (${i}).dxf`;
    ecrireSur(cible, Buffer.from(contenu, 'latin1'));
    return cible;
  });

  ipcMain.handle('groupe:enregistrer', async (_e, nom: string, contenu: string) => {
    const w = fenetre();
    if (!w) return null;
    const propre = nom.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'groupe';
    const r = await dialog.showSaveDialog(w, { title: 'Enregistrer le groupe', defaultPath: join(dossierGroupes(), `${propre}.dxf`), filters: FILTRES_GROUPES });
    if (r.canceled || !r.filePath) return null;
    const chemin = /\.dxf$/i.test(r.filePath) ? r.filePath : `${r.filePath}.dxf`;
    ecrireSur(chemin, Buffer.from(contenu, 'latin1'));
    return chemin;
  });

  ipcMain.handle('image:ouvrir', async () => {
    const w = fenetre();
    if (!w) return null;
    const r = await dialog.showOpenDialog(w, {
      title: "Insertion d'une image",
      filters: [{ name: 'Images', extensions: Object.keys(TYPES_IMAGES).map((e) => e.slice(1)) }],
      properties: ['openFile'],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    return lireImage(r.filePaths[0]);
  });

  ipcMain.handle('image:lire', (_e, chemin: string) => lireImage(chemin));

  // Pièces jointes : n'importe quel fichier ; il s'ouvre ensuite dans le logiciel associé du système.
  ipcMain.handle('fichier:choisir', async (_e, titre: string) => {
    const w = fenetre();
    if (!w) return null;
    const r = await dialog.showOpenDialog(w, { title: titre, properties: ['openFile'] });
    return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
  });

  // Bouton « calculatrice » de la barre de gauche : la calculatrice du système (comme l'original sous Windows).
  ipcMain.handle('outil:calculatrice', async () => {
    if (process.platform === 'darwin') return shell.openPath('/System/Applications/Calculator.app');
    const commande = process.platform === 'win32' ? 'calc.exe' : 'gnome-calculator';
    try {
      spawn(commande, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
      return '';
    } catch (e) {
      return String(e);
    }
  });

  /** État du lien : le fichier existe-t-il, avec quelle date ? Sinon, un fichier de même nom à côté du dessin. */
  ipcMain.handle('image:etat', (_e, chemin: string, dossierDessin: string | null) => {
    const etat = (c: string) => {
      try {
        const st = statSync(c);
        return st.isFile() ? { chemin: c, existe: true, date: st.mtimeMs, taille: st.size } : null;
      } catch {
        return null;
      }
    };
    const direct = chemin ? etat(chemin) : null;
    if (direct) return direct;
    const voisin = dossierDessin && chemin ? etat(join(dossierDessin, basename(chemin.replace(/\\/g, '/')))) : null;
    return voisin ? { ...voisin, voisin: true } : { chemin, existe: false, date: 0, taille: 0 };
  });

  /** Modifier l'image avec le logiciel associé du système (Aperçu, Paint…). */
  ipcMain.handle('image:editer', (_e, chemin: string) => shell.openPath(chemin));

  ipcMain.handle('fichier:backup', (_e, contenu: string) => {
    writeFileSync(backup(), Buffer.from(contenu, 'latin1'));
    return true;
  });

  ipcMain.handle('fichier:relire-backup', () => (existsSync(backup()) ? { chemin: null, nom: 'backup', contenu: decoderDxf(readFileSync(backup())) } : null));

  // Fichier-texte (B6) : UTF-8, ou à défaut la page de code Windows / DOS (Latin-1).
  ipcMain.handle('fichier:ouvrir-texte', async () => {
    const w = fenetre();
    if (!w) return null;
    const r = await dialog.showOpenDialog(w, { title: 'Fichier-texte', filters: [{ name: 'Textes', extensions: ['txt', 'TXT'] }, { name: 'Tous les fichiers', extensions: ['*'] }], properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const octets = readFileSync(r.filePaths[0]);
    const utf8 = octets.toString('utf8');
    return utf8.includes('\uFFFD') ? octets.toString('latin1') : utf8;
  });

  ipcMain.handle('recuperation:ecrire', (e, contenu: string, nom: string, chemin: string | null) => {
    const n = session(e.sender);
    ecrireSur(recuperation(n), Buffer.from(contenu, 'latin1'));
    ecrireSur(recuperationInfos(n), JSON.stringify({ nom, chemin, date: Date.now() }));
  });

  ipcMain.handle('recuperation:lire', (e) => {
    const n = session(e.sender);
    try {
      const infos = JSON.parse(readFileSync(recuperationInfos(n), 'utf-8')) as { nom: string; chemin: string | null; date: number };
      return { ...infos, contenu: decoderDxf(readFileSync(recuperation(n))) };
    } catch {
      return null;
    }
  });

  ipcMain.handle('recuperation:effacer', (e) => effacerRecuperation(session(e.sender)));

  ipcMain.handle('question', async (_e, message: string, detail: string, boutons: string[]) => {
    const w = fenetre();
    if (!w) return boutons.length - 1;
    const r = await dialog.showMessageBox(w, { type: 'question', message, detail, buttons: boutons, defaultId: 0, cancelId: boutons.length - 1 });
    return r.response;
  });
}

function lire(chemin: string, recent: (chemin: string) => void) {
  if (!existsSync(chemin)) return null;
  recent(chemin);
  const octets = readFileSync(chemin);
  // Un .des est binaire : on le passe octet pour octet (Latin-1), l'interface le décode.
  const des = /\.des$/i.test(chemin);
  return { chemin, nom: basename(chemin).replace(/\.(dxf|des)$/i, ''), contenu: des ? octets.toString('latin1') : decoderDxf(octets), des };
}
