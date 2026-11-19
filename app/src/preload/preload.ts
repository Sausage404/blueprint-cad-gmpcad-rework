import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { DaoApi, Prefs } from '../shared/types';

const api: DaoApi = {
  platform: process.platform,
  getPrefs: () => ipcRenderer.invoke('get-prefs') as Promise<Prefs>,
  onPrefs: (cb) => {
    ipcRenderer.on('prefs', (_event, prefs: Prefs) => cb(prefs));
  },
  onMenu: (cb) => {
    ipcRenderer.on('menu', (_event, command: string, label: string) => cb(command, label));
  },
  ouvrir: (titre) => ipcRenderer.invoke('fichier:ouvrir', titre),
  lire: (chemin) => ipcRenderer.invoke('fichier:lire', chemin),
  enregistrer: (chemin, contenu) => ipcRenderer.invoke('fichier:enregistrer', chemin, contenu),
  enregistrerSous: (nom, contenu) => ipcRenderer.invoke('fichier:enregistrer-sous', nom, contenu),
  backup: (contenu) => ipcRenderer.invoke('fichier:backup', contenu),
  relireBackup: () => ipcRenderer.invoke('fichier:relire-backup'),
  question: (message, detail, boutons) => ipcRenderer.invoke('question', message, detail, boutons),
  imprimer: (page) => ipcRenderer.invoke('imprimer', page),
  exporterPdf: (page) => ipcRenderer.invoke('exporter-pdf', page),
  etatDessin: (titre, modifie, chemin) => ipcRenderer.send('etat-dessin', titre, modifie, chemin),
  fermer: () => ipcRenderer.send('fermer'),
  cheminDe: (fichier) => webUtils.getPathForFile(fichier),
  cheminExport: (nom) => ipcRenderer.invoke('exporter:chemin', nom),
  ecrirePdf: (page, chemin) => ipcRenderer.invoke('exporter:pdf', page, chemin),
  ecrireFichier: (chemin, donnees) => ipcRenderer.invoke('exporter:ecrire', chemin, donnees),
  partager: (page) => ipcRenderer.invoke('partager', page),
  ouvrirTexte: () => ipcRenderer.invoke('fichier:ouvrir-texte'),
  ouvrirGroupe: () => ipcRenderer.invoke('groupe:ouvrir'),
  ouvrirImage: () => ipcRenderer.invoke('image:ouvrir'),
  calculatrice: () => ipcRenderer.invoke('outil:calculatrice'),
  nouvelleSession: () => ipcRenderer.invoke('session:nouvelle'),
  reglerPref: (cle: string, valeur: unknown) => ipcRenderer.send('pref', cle, valeur),
  choisirFichier: (titre: string) => ipcRenderer.invoke('fichier:choisir', titre),
  lireGroupe: (chemin: string) => ipcRenderer.invoke('groupe:lire', chemin),
  ouvrirMacro: () => ipcRenderer.invoke('gmac:ouvrir'),
  lireMacro: (chemin: string) => ipcRenderer.invoke('gmac:lire', chemin),
  ouvrirTexteType: (titre: string, extensions: string[]) => ipcRenderer.invoke('texte:ouvrir', titre, extensions),
  enregistrerTexte: (titre: string, nom: string, extension: string, contenu: string) => ipcRenderer.invoke('texte:enregistrer', titre, nom, extension, contenu),
  choisirDes: () => ipcRenderer.invoke('des:choisir'),
  ecrireDxfACote: (chemin: string, contenu: string) => ipcRenderer.invoke('dxf:ecrire-a-cote', chemin, contenu),
  lireImage: (chemin: string) => ipcRenderer.invoke('image:lire', chemin),
  etatImage: (chemin: string, dossierDessin: string | null) => ipcRenderer.invoke('image:etat', chemin, dossierDessin),
  editerImage: (chemin: string) => ipcRenderer.invoke('image:editer', chemin),
  enregistrerGroupe: (nom: string, contenu: string) => ipcRenderer.invoke('groupe:enregistrer', nom, contenu),
  ecrireRecuperation: (contenu, nom, chemin) => ipcRenderer.invoke('recuperation:ecrire', contenu, nom, chemin),
  lireRecuperation: () => ipcRenderer.invoke('recuperation:lire'),
  effacerRecuperation: () => ipcRenderer.invoke('recuperation:effacer'),
  signalementCapture: () => ipcRenderer.invoke('signalement:capture'),
  signalementInfos: () => ipcRenderer.invoke('signalement:infos'),
  signalementIncidents: () => ipcRenderer.invoke('signalement:incidents'),
  signalementEnregistrer: (texte, image) => ipcRenderer.invoke('signalement:enregistrer', texte, image),
  signalementEnvoyer: (mode, titre, corps, fichier) => ipcRenderer.invoke('signalement:envoyer', mode, titre, corps, fichier),
  signalementCopier: (texte) => ipcRenderer.invoke('signalement:copier', texte),
};

contextBridge.exposeInMainWorld('dao', api);
