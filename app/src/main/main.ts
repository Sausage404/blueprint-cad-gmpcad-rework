import { app, BrowserWindow, crashReporter, ipcMain, Menu, nativeTheme, screen, type WebContents } from 'electron';
import { join } from 'node:path';
import { APP_NAME, type Prefs } from '../shared/types';
import { capturer } from './capture';
import { effacerRecuperation, enregistrerFichiers, sessionsAReprendre } from './fichiers';
import { enregistrerImpression } from './impression';
import { buildMenu } from './menu';
import { avecPref, loadPrefs, savePrefs } from './prefs';
import { enregistrerSignalement, noterIncident } from './signalement';

app.setName(APP_NAME);
// Vérification automatique : dossier de réglages à part, pour ne pas toucher aux vrais réglages ni
// laisser de dessin « à reprendre ».
if (process.env.DAO_CAPTURE) app.setPath('userData', join(app.getPath('temp'), 'blueprint-cad-verification'));

// Plantages complets : Crashpad en garde la trace sur le disque, sans rien envoyer (uploadToServer: false).
// Au lancement suivant, le logiciel propose de signaler le plantage (Aide > Signaler un problème).
crashReporter.start({ uploadToServer: false });
// Erreur dans le processus principal : gardée, puis la fenêtre active propose de la signaler.
process.on('uncaughtException', (e) => {
  console.error(e);
  noterIncident({ message: e?.message ?? String(e), pile: e?.stack, origine: 'principal', date: Date.now() });
  const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (w && !w.isDestroyed() && !w.webContents.isLoading()) w.webContents.send('menu', 'aide.signaler', 'Signaler un problème...');
});

/** Une session de travail = une fenêtre et son dessin (8 au plus, comme dans l'original). */
interface Session {
  win: BrowserWindow;
  numero: number;
  titre: string;
  modifie: boolean;
  fermetureAutorisee: boolean;
}
const MAX_SESSIONS = 8;
const sessions: Session[] = [];
let derniere: BrowserWindow | null = null;
let prefs: Prefs;
/** Dessin à ouvrir au démarrage (double-clic sur un .dxf, ou glissé sur l'icône de l'appli). */
let aOuvrir: string | null = process.argv.slice(app.isPackaged ? 1 : 2).find((a) => /\.(dxf|des)$/i.test(a)) ?? null;

/** La fenêtre active : celle qui a le focus, sinon la dernière qui l'a eu. */
function active(): BrowserWindow | null {
  const f = BrowserWindow.getFocusedWindow();
  if (f && sessions.some((s) => s.win === f)) return f;
  return derniere && !derniere.isDestroyed() ? derniere : (sessions[0]?.win ?? null);
}
const sessionDe = (wc: WebContents) => sessions.find((s) => s.win.webContents === wc);

function ouvrirFichier(chemin: string): void {
  const w = active();
  if (w && !w.webContents.isLoading()) w.webContents.send('menu', `fichier.recent:${chemin}`, chemin);
  else aOuvrir = chemin;
}

// macOS : double-clic sur un .dxf associé à l'appli.
app.on('open-file', (event, chemin) => {
  event.preventDefault();
  ouvrirFichier(chemin);
});

/** Ajoute un fichier en tête des 4 derniers fichiers (menu Fichier). */
function fichierRecent(chemin: string): void {
  prefs = { ...prefs, recents: [chemin, ...prefs.recents.filter((c) => c !== chemin)].slice(0, 4) };
  savePrefs(prefs);
  refreshMenu();
}

/** Menu Fenêtres : mosaïques et cascade dans l'écran de la fenêtre active. */
function ranger(mode: 'h' | 'v' | 'cascade'): void {
  const ws = sessions.map((s) => s.win).filter((w) => !w.isDestroyed());
  if (ws.length === 0) return;
  const zone = screen.getDisplayMatching(active()?.getBounds() ?? ws[0].getBounds()).workArea;
  ws.forEach((w, i) => {
    if (w.isMaximized()) w.unmaximize();
    if (w.isFullScreen()) w.setFullScreen(false);
    if (mode === 'h') {
      const h = Math.floor(zone.height / ws.length);
      w.setBounds({ x: zone.x, y: zone.y + i * h, width: zone.width, height: h });
    } else if (mode === 'v') {
      const l = Math.floor(zone.width / ws.length);
      w.setBounds({ x: zone.x + i * l, y: zone.y, width: l, height: zone.height });
    } else {
      const pas = 32;
      w.setBounds({ x: zone.x + i * pas, y: zone.y + i * pas, width: Math.round(zone.width * 0.75), height: Math.round(zone.height * 0.75) });
    }
  });
}

/**
 * Clair ou sombre : le thème Moderne suit le choix de Préférences > Thème (ou le système) ; le Classique,
 * qui garde l'aspect de l'original, laisse faire le système (barre de titre, menus, boîtes de dialogue).
 */
function appliquerApparence(): void {
  const a = prefs.theme === 'moderne' ? prefs.apparence : 'systeme';
  nativeTheme.themeSource = a === 'clair' ? 'light' : a === 'sombre' ? 'dark' : 'system';
}

/** Une préférence changée : gardée, appliquée, envoyée à toutes les sessions. */
function changerPref<K extends keyof Prefs>(cle: K, valeur: Prefs[K]): void {
  prefs = avecPref(prefs, cle, valeur);
  savePrefs(prefs);
  if (cle === 'theme' || cle === 'apparence') {
    appliquerApparence();
    refreshMenu(); // le choix clair / sombre n'est actif qu'en thème Moderne
  }
  for (const s of sessions) s.win.webContents.send('prefs', prefs);
}

function refreshMenu(): void {
  const actif = active();
  Menu.setApplicationMenu(
    buildMenu(
      prefs,
      {
        command: (id, label) => {
          if (id === 'fenetres.mosaique-h') return ranger('h');
          if (id === 'fenetres.mosaique-v') return ranger('v');
          if (id === 'fenetres.cascade') return ranger('cascade');
          if (id === 'preferences.fenetre-memoriser' || id === 'preferences.fenetre-defaut') {
            const w = active();
            prefs = { ...prefs, fenetre: id === 'preferences.fenetre-defaut' || !w ? null : w.getBounds() };
            savePrefs(prefs);
            if (!prefs.fenetre) w?.maximize();
            return;
          }
          if (id === 'fichier.quitter-tout') {
            // Chaque session demande s'il faut enregistrer son dessin.
            for (const s of [...sessions]) s.win.webContents.send('menu', 'fichier.quitter-session', 'Quitter la session');
            return;
          }
          active()?.webContents.send('menu', id, label);
        },
        setPref: (key, value) => changerPref(key, value),
        toggleDevTools: () => active()?.webContents.toggleDevTools(),
      },
      sessions.map((s) => ({ numero: s.numero, titre: s.titre.replace(`${APP_NAME} - `, ''), active: s.win === actif, choisir: () => s.win.focus() })),
    ),
  );
}

function numeroLibre(): number {
  for (let n = 1; n <= MAX_SESSIONS; n++) if (!sessions.some((s) => s.numero === n)) return n;
  return 0;
}

function createWindow(numero = numeroLibre()): BrowserWindow | null {
  if (!numero) return null;
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    // Assez petit pour un écran de 800 x 600 (la palette se réduit alors pour tenir).
    minWidth: 760,
    minHeight: 520,
    show: false,
    title: `${APP_NAME} - (sans nom)`,
    backgroundColor: '#f5f5f5',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const session: Session = { win, numero, titre: `${APP_NAME} - (sans nom)`, modifie: false, fermetureAutorisee: false };
  sessions.push(session);
  sessions.sort((a, b) => a.numero - b.numero);
  derniere = win;

  // Le titre de la fenêtre est géré ici, pas par la balise <title> de la page.
  win.on('page-title-updated', (event) => event.preventDefault());
  win.on('focus', () => {
    derniere = win;
    refreshMenu();
  });
  win.webContents.once('did-finish-load', () => {
    if (aOuvrir && numero === 1) {
      const chemin = aOuvrir;
      aOuvrir = null;
      setTimeout(() => ouvrirFichier(chemin), 300);
    }
  });
  win.once('ready-to-show', () => {
    if (process.env.DAO_CAPTURE && numero === 1) {
      // Même surface que les captures de l'original, sans la barre de menus ; DAO_TAILLE=800x600 pour un petit écran.
      const [l, h] = (process.env.DAO_TAILLE ?? '1280x975').split('x').map(Number);
      win.setContentSize(l, h);
      win.show();
      void capturer(win, process.env.DAO_CAPTURE);
    } else if (sessions.length === 1) {
      // Position mémorisée (Préférences > Positions des fenêtres), si elle est encore sur un écran.
      const f = prefs.fenetre;
      const visible = f && screen.getAllDisplays().some((d) => f.x < d.workArea.x + d.workArea.width && f.x + f.width > d.workArea.x && f.y < d.workArea.y + d.workArea.height && f.y + f.height > d.workArea.y);
      if (f && visible) win.setBounds(f);
      else win.maximize();
      win.show();
    } else {
      // Nouvelle session : décalée de la précédente.
      const b = sessions.find((s) => s.win !== win)?.win.getBounds();
      if (b) win.setBounds({ x: b.x + 32, y: b.y + 32, width: Math.min(b.width, 1280), height: Math.min(b.height, 900) });
      win.show();
    }
  });
  // Dessin modifié : l'interface demande s'il faut enregistrer avant de fermer.
  win.on('close', (event) => {
    if (session.modifie && !session.fermetureAutorisee) {
      event.preventDefault();
      win.webContents.send('menu', 'fichier.quitter-session', 'Quitter la session');
    } else effacerRecuperation(numero);
  });
  win.on('closed', () => {
    sessions.splice(sessions.indexOf(session), 1);
    if (derniere === win) derniere = sessions[0]?.win ?? null;
    refreshMenu();
  });
  // Plantage de l'interface : on la relance (une fois par minute au plus) ; elle propose alors de
  // reprendre le dessin en cours.
  let dernierRedemarrage = 0;
  win.webContents.on('render-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit' || win.isDestroyed()) return;
    // Gardé pour être proposé au signalement quand l'interface redémarre.
    noterIncident({ message: `L’interface s’est arrêtée (${details.reason}, code ${details.exitCode}).`, origine: 'plantage', date: Date.now() });
    if (Date.now() - dernierRedemarrage < 60_000) return;
    dernierRedemarrage = Date.now();
    win.reload();
  });

  // Aucune navigation ni fenêtre externe depuis l'interface.
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.loadFile(join(__dirname, 'index.html'), process.env.DAO_CAPTURE ? { hash: 'capture' } : {});
  refreshMenu();
  return win;
}

app.whenReady().then(() => {
  prefs = loadPrefs();
  appliquerApparence();
  ipcMain.handle('get-prefs', () => prefs);
  // Une préférence réglée depuis l'interface (backup automatique…) : gardée, et envoyée à toutes les sessions.
  ipcMain.on('pref', (_e, cle: keyof Prefs, valeur: unknown) => {
    if (!(cle in prefs)) return;
    changerPref(cle, valeur as Prefs[typeof cle]);
  });
  ipcMain.on('etat-dessin', (e, titre: string, modifie: boolean, chemin: string | null) => {
    const s = sessionDe(e.sender);
    if (!s) return;
    s.modifie = modifie;
    s.win.setTitle(titre);
    s.win.setDocumentEdited(modifie);
    s.win.setRepresentedFilename(chemin ?? '');
    if (s.titre !== titre) {
      s.titre = titre;
      refreshMenu();
    }
  });
  ipcMain.on('fermer', (e) => {
    // Fermeture normale (dessin enregistré ou abandonné volontairement) : rien à reprendre.
    const s = sessionDe(e.sender);
    if (!s) return;
    effacerRecuperation(s.numero);
    s.fermetureAutorisee = true;
    s.win.close();
  });
  // Fichier > Nouveau > « Nouvelle session » : une autre fenêtre avec un dessin vierge.
  ipcMain.handle('session:nouvelle', () => !!createWindow());
  enregistrerFichiers(active, fichierRecent, (wc) => sessionDe(wc)?.numero ?? 1);
  enregistrerImpression(active);
  enregistrerSignalement();
  createWindow(1);
  // Sessions qui avaient un dessin non enregistré au moment d'un plantage : chacune le propose à nouveau.
  if (!process.env.DAO_CAPTURE) for (const n of sessionsAReprendre()) if (n !== 1) createWindow(n);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
