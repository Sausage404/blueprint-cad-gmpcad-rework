// Signalement d'un problème, côté système : capture de la fenêtre, enregistrement du rapport (dossier
// Documents/BluePrint CAD/Signalements), ouverture du ticket GitHub ou de la messagerie, copie, et mémoire des
// erreurs et plantages pour les proposer au lancement suivant.
//
// Rien n'est envoyé par le logiciel lui-même : il prépare le rapport et ouvre la page ou le message, la
// personne relit et envoie. Les liens sont fabriqués ici, à partir d'adresses fixes (voir shared/signalement).
import { app, clipboard, ipcMain, shell } from 'electron';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, release, userInfo } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { lienGithub, lienMail, nettoyer, type Incident, type InfosSysteme } from '../shared/signalement';

const verification = !!process.env.DAO_CAPTURE;
const MAX_TEXTE = 50_000;
const MAX_IMAGE = 30 * 1024 * 1024;

const utilisateur = (() => {
  try {
    return userInfo().username;
  } catch {
    return '';
  }
})();
const propre = (t: string) => nettoyer(t, homedir(), utilisateur);

/** Dossier des rapports ; à part pendant les vérifications automatiques (pas dans les vrais Documents). */
function dossierSignalements(): string {
  return verification ? join(app.getPath('userData'), 'Signalements') : join(app.getPath('documents'), 'BluePrint CAD', 'Signalements');
}

function infosSysteme(): InfosSysteme {
  const nom = process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows' : 'Linux';
  const version = process.platform === 'linux' ? release() : process.getSystemVersion();
  return { version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, systeme: `${nom} ${version} (${process.arch})`, langue: app.getLocale() };
}

// ---- Erreurs et plantages en attente de signalement

const fichierIncidents = () => join(app.getPath('userData'), 'incidents.json');
const fichierPlantagesVus = () => join(app.getPath('userData'), 'plantages-vus.json');

function lireIncidents(): Incident[] {
  try {
    const l = JSON.parse(readFileSync(fichierIncidents(), 'utf8')) as Incident[];
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}

/** Garde une erreur pour la proposer au signalement (les 5 dernières). */
export function noterIncident(incident: Incident): void {
  try {
    writeFileSync(fichierIncidents(), JSON.stringify([...lireIncidents(), { ...incident, message: propre(incident.message), pile: incident.pile && propre(incident.pile) }].slice(-5)));
  } catch {
    // Disque plein ou dossier illisible : tant pis pour ce signalement.
  }
}

/** Rapports de plantage (minidumps) écrits par Crashpad dans le dossier du logiciel. */
function minidumps(dossier: string, profondeur = 0): string[] {
  if (profondeur > 3) return [];
  try {
    return readdirSync(dossier, { withFileTypes: true }).flatMap((f) =>
      f.isDirectory() ? minidumps(join(dossier, f.name), profondeur + 1) : f.name.endsWith('.dmp') ? [join(dossier, f.name)] : [],
    );
  } catch {
    return [];
  }
}

/**
 * Plantages complets du logiciel depuis la dernière vérification. Le contenu des rapports de plantage n'est
 * ni lu ni envoyé (il peut contenir des morceaux de dessin) : on signale seulement qu'il y en a eu un.
 */
function nouveauxPlantages(): Incident[] {
  const maintenant = Date.now();
  let vu: number | null = null;
  try {
    vu = Number(JSON.parse(readFileSync(fichierPlantagesVus(), 'utf8')).vu) || null;
  } catch {
    vu = null;
  }
  try {
    writeFileSync(fichierPlantagesVus(), JSON.stringify({ vu: maintenant }));
  } catch {
    return [];
  }
  if (vu === null) return []; // première fois : on ne remonte pas les anciens plantages
  const dates = minidumps(app.getPath('crashDumps'))
    .map((f) => statSync(f).mtimeMs)
    .filter((d) => d > vu);
  if (dates.length === 0) return [];
  return [{ message: 'Le logiciel s’est fermé brutalement (plantage du programme).', origine: 'plantage', date: Math.max(...dates) }];
}

/** Erreurs et plantages à signaler ; la liste est vidée (chaque incident n'est proposé qu'une fois). */
function incidentsEnAttente(): Incident[] {
  const l = [...lireIncidents(), ...nouveauxPlantages()];
  rmSync(fichierIncidents(), { force: true });
  return l;
}

/** Date et heure locales pour le nom des fichiers : signalement-2026-11-19-07h24-25. */
const horodatage = () => {
  const d = new Date();
  const x = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${x(d.getMonth() + 1)}-${x(d.getDate())}-${x(d.getHours())}h${x(d.getMinutes())}-${x(d.getSeconds())}`;
};

export function enregistrerSignalement(): void {
  /** Image de la fenêtre qui demande (avant l'ouverture de la boîte de signalement). */
  ipcMain.handle('signalement:capture', async (e) => {
    try {
      const image = await e.sender.capturePage();
      return image.isEmpty() ? null : image.toDataURL();
    } catch {
      return null;
    }
  });

  ipcMain.handle('signalement:infos', () => infosSysteme());

  ipcMain.handle('signalement:incidents', () => (verification ? [] : incidentsEnAttente()));

  /** Enregistre le rapport (texte nettoyé) et la capture choisie ; renvoie les fichiers écrits. */
  ipcMain.handle('signalement:enregistrer', (_e, texte: unknown, image: unknown) => {
    if (typeof texte !== 'string') return null;
    const t = propre(texte.slice(0, MAX_TEXTE));
    const d = dossierSignalements();
    mkdirSync(d, { recursive: true });
    const base = join(d, `signalement-${horodatage()}`);
    writeFileSync(`${base}.txt`, t, 'utf8');
    let fichierImage: string | null = null;
    if (typeof image === 'string' && image.startsWith('data:image/png;base64,') && image.length < MAX_IMAGE) {
      fichierImage = `${base}.png`;
      writeFileSync(fichierImage, Buffer.from(image.slice('data:image/png;base64,'.length), 'base64'));
    }
    return { texte: t, fichierTexte: `${base}.txt`, fichierImage };
  });

  /**
   * Ouvre la page « nouveau ticket » de GitHub ou la messagerie, pré-remplies, puis montre le fichier enregistré
   * (la capture, à glisser dans la page ou à joindre au message). Seuls le titre et le texte viennent de
   * l'interface ; l'adresse est fabriquée ici. Pendant une vérification automatique, rien ne s'ouvre.
   */
  ipcMain.handle('signalement:envoyer', async (_e, mode: unknown, titre: unknown, corps: unknown, fichier: unknown) => {
    if ((mode !== 'github' && mode !== 'mail') || typeof titre !== 'string' || typeof corps !== 'string') return null;
    const t = propre(titre.slice(0, 200));
    const c = propre(corps.slice(0, MAX_TEXTE));
    const url = mode === 'github' ? lienGithub(t, c) : lienMail(t, c);
    if (verification) return url;
    await shell.openExternal(url);
    const dossier = resolve(dossierSignalements());
    if (typeof fichier === 'string' && resolve(fichier).startsWith(dossier + sep) && existsSync(fichier)) shell.showItemInFolder(fichier);
    return url;
  });

  ipcMain.handle('signalement:copier', (_e, texte: unknown) => {
    if (typeof texte === 'string') clipboard.writeText(propre(texte.slice(0, MAX_TEXTE)));
  });
}
