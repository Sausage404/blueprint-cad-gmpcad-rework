// Impression et export PDF à l'échelle exacte. L'interface fournit une image SVG de la feuille en millimètres ;
// on l'imprime dans une fenêtre cachée dont la page a exactement la taille du format, sans marges.
import { app, BrowserWindow, dialog, ipcMain, ShareMenu, shell } from 'electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Page {
  svg: string;
  largeur: number; // mm
  hauteur: number; // mm
  nom: string;
}

function html(p: Page): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    `@page { size: ${p.largeur}mm ${p.hauteur}mm; margin: 0 }` +
    'html, body { margin: 0; padding: 0; background: #fff }' +
    `svg { display: block; width: ${p.largeur}mm; height: ${p.hauteur}mm }` +
    `</style></head><body>${p.svg}</body></html>`
  );
}

async function fenetreDePage(p: Page): Promise<BrowserWindow> {
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  await w.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html(p))}`);
  return w;
}

async function pdf(p: Page): Promise<Buffer> {
  const w = await fenetreDePage(p);
  try {
    return await w.webContents.printToPDF({ preferCSSPageSize: true, printBackground: false, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  } finally {
    w.destroy();
  }
}

const EXPORTS = [
  { name: 'Document PDF (à l\'échelle exacte)', extensions: ['pdf'] },
  { name: 'Image PNG', extensions: ['png'] },
  { name: 'Image SVG (vectorielle)', extensions: ['svg'] },
];

export function enregistrerImpression(fenetre: () => BrowserWindow | null): void {
  // Fichier > Exporter : PDF, PNG ou SVG, selon l'extension choisie.
  ipcMain.handle('exporter:chemin', async (_e, nom: string) => {
    const parent = fenetre();
    if (!parent) return null;
    const r = await dialog.showSaveDialog(parent, { title: 'Exporter', defaultPath: `${nom}.pdf`, filters: EXPORTS });
    if (r.canceled || !r.filePath) return null;
    return /\.(pdf|png|svg)$/i.test(r.filePath) ? r.filePath : `${r.filePath}.pdf`;
  });
  ipcMain.handle('exporter:pdf', async (_e, p: Page, chemin: string) => writeFileSync(chemin, await pdf(p)));
  ipcMain.handle('exporter:ecrire', (_e, chemin: string, donnees: Uint8Array | string) => writeFileSync(chemin, donnees));

  // Partager (nouveauté) : le dessin en PDF, par le menu de partage du Mac (Mail, Messages, AirDrop…).
  // Sous Windows, le PDF est montré dans l'Explorateur, prêt à être joint à un message.
  ipcMain.handle('partager', async (_e, p: Page) => {
    const dossier = join(app.getPath('temp'), 'BluePrint CAD');
    mkdirSync(dossier, { recursive: true });
    const chemin = join(dossier, `${p.nom.replace(/[\\/:*?"<>|]/g, '_')}.pdf`);
    writeFileSync(chemin, await pdf(p));
    const parent = fenetre();
    if (process.platform === 'darwin' && parent) {
      new ShareMenu({ filePaths: [chemin] }).popup({ window: parent });
      return 'menu';
    }
    shell.showItemInFolder(chemin);
    return 'dossier';
  });

  ipcMain.handle('imprimer', async (_e, p: Page) => {
    const w = await fenetreDePage(p);
    return new Promise<string | null>((resolve) => {
      w.webContents.print(
        {
          silent: false,
          printBackground: false,
          margins: { marginType: 'none' },
          landscape: p.largeur > p.hauteur,
          pageSize: { width: Math.round(Math.min(p.largeur, p.hauteur) * 1000), height: Math.round(Math.max(p.largeur, p.hauteur) * 1000) },
        },
        (ok, raison) => {
          w.destroy();
          resolve(ok ? null : raison || null);
        },
      );
    });
  });

  ipcMain.handle('exporter-pdf', async (_e, p: Page) => {
    const parent = fenetre();
    if (!parent) return null;
    const r = await dialog.showSaveDialog(parent, {
      title: 'Exporter en PDF',
      defaultPath: `${p.nom}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (r.canceled || !r.filePath) return null;
    const chemin = /\.pdf$/i.test(r.filePath) ? r.filePath : `${r.filePath}.pdf`;
    writeFileSync(chemin, await pdf(p));
    return chemin;
  });
}
