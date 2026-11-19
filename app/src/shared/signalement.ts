// Signalement d'un problème (Aide > Signaler un problème, ou après une erreur) : le texte du rapport, son
// code, le retrait des informations personnelles et les liens d'envoi (ticket GitHub, e-mail).
// Sans Electron ni DOM : utilisé par le processus principal et par l'interface, et testé.
//
// Sécurité : le logiciel ne contient aucune clé d'accès à GitHub. Il ouvre seulement la page « nouveau
// ticket » pré-remplie, ou la messagerie ; c'est la personne qui envoie. Les deux adresses sont fixes
// (DEPOT_GITHUB, ADRESSE_SIGNALEMENT) : l'interface ne fournit que le titre et le texte.

export const DEPOT_GITHUB = 'Sausage404/blueprint-cad-gmpcad-rework';
export const ADRESSE_SIGNALEMENT = 'contact@b404.fr';

/** Une erreur ou un plantage, gardé pour être signalé. */
export interface Incident {
  /** Ce qui s'est passé (message de l'erreur). */
  message: string;
  /** Pile d'appels, s'il y en a une. */
  pile?: string;
  /** Où : l'interface, le processus principal, ou un plantage complet du logiciel. */
  origine: 'interface' | 'principal' | 'plantage';
  /** Date (ms depuis 1970). */
  date: number;
}

/** Informations sur le système, données par le processus principal. */
export interface InfosSysteme {
  version: string;
  electron: string;
  chrome: string;
  /** Ex. « macOS 27.2.1 (arm64) ». */
  systeme: string;
  langue: string;
}

/** Informations sur le travail en cours, données par l'interface (jamais le contenu du dessin). */
export interface InfosTravail {
  theme?: string;
  /** Ex. « A1H, 1195 éléments ». */
  dessin?: string;
  fonction?: string;
  /** Derniers messages de la ligne de dialogue. */
  messages?: string[];
}

/** FNV-1a sur 32 bits. */
function empreinte(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Code court et stable d'une erreur (« BP-1A2B3C ») : la même erreur donne le même code, où que soit installé
 * le logiciel, pour regrouper les signalements. On ne garde du message que ses mots (pas les nombres) et, de
 * la pile, le nom des trois premières fonctions (pas les chemins ni les numéros de ligne).
 */
export function codeErreur(message: string, pile = ''): string {
  const fonctions = pile
    .split('\n')
    .map((l) => /^\s*at\s+(?:async\s+)?([^\s(]+)\s*\(/.exec(l)?.[1])
    .filter((f): f is string => !!f)
    .slice(0, 3);
  const cle = `${message.replace(/\d+/g, '#').trim()}|${fonctions.join('>')}`;
  return `BP-${empreinte(cle).toString(16).toUpperCase().padStart(8, '0').slice(0, 6)}`;
}

const echapperRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Retire du texte ce qui identifie la personne : son dossier personnel (remplacé par « ~ », sous toutes ses
 * écritures : barres obliques, file:///) et son nom d'utilisateur (mot entier, au moins 3 lettres).
 */
export function nettoyer(texte: string, dossierPerso: string, utilisateur: string): string {
  let t = texte;
  if (dossierPerso && dossierPerso.length > 1) {
    const variantes = new Set([dossierPerso, dossierPerso.replace(/\\/g, '/'), dossierPerso.replace(/\//g, '\\')]);
    for (const v of variantes) t = t.replace(new RegExp(echapperRegex(v), 'gi'), '~');
  }
  if (utilisateur && utilisateur.length >= 3) {
    t = t.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${echapperRegex(utilisateur)}(?![\\p{L}\\p{N}_])`, 'giu'), '<utilisateur>');
  }
  return t;
}

const deux = (n: number) => String(n).padStart(2, '0');
const dateLisible = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())} ${deux(d.getHours())}:${deux(d.getMinutes())}`;
};

const ORIGINES: Record<Incident['origine'], string> = {
  interface: "erreur dans l'interface",
  principal: 'erreur dans le programme principal',
  plantage: 'le logiciel s’est fermé brutalement',
};

/** Le rapport complet, en texte : pour la copie, le fichier enregistré, le ticket et l'e-mail. */
export function texteRapport(description: string, systeme: InfosSysteme, travail: InfosTravail, incident?: Incident, date = Date.now()): string {
  const l: string[] = [];
  l.push(`Signalement BluePrint CAD${incident ? ` — ${codeErreur(incident.message, incident.pile)}` : ''}`);
  l.push(`Date : ${dateLisible(date)}`);
  l.push('');
  l.push('Ce qui s’est passé :');
  l.push(description.trim() || '(non décrit)');
  if (incident) {
    l.push('');
    l.push(`Erreur (${ORIGINES[incident.origine]}, ${dateLisible(incident.date)}) :`);
    l.push(incident.message);
    if (incident.pile) {
      l.push('Pile :');
      for (const p of incident.pile.split('\n').slice(0, 15)) if (p.trim()) l.push(`  ${p.trim()}`);
    }
  }
  l.push('');
  l.push(`Logiciel : BluePrint CAD ${systeme.version} (Electron ${systeme.electron}, Chrome ${systeme.chrome})`);
  l.push(`Système : ${systeme.systeme}, langue ${systeme.langue}`);
  if (travail.theme) l.push(`Thème : ${travail.theme}`);
  if (travail.dessin) l.push(`Dessin : ${travail.dessin}`);
  if (travail.fonction) l.push(`Fonction en cours : ${travail.fonction}`);
  if (travail.messages?.length) {
    l.push('Derniers messages :');
    for (const m of travail.messages) l.push(`  ${m}`);
  }
  return l.join('\n');
}

/** Titre du ticket ou de l'e-mail. */
export function titreSignalement(description: string, incident?: Incident): string {
  if (incident) return `[${codeErreur(incident.message, incident.pile)}] ${incident.message.split('\n')[0]}`.slice(0, 120);
  const premiere = description.trim().split('\n')[0];
  return (premiere ? `Problème : ${premiere}` : 'Problème signalé depuis le logiciel').slice(0, 120);
}

// Longueurs au-delà desquelles un lien devient trop long pour le navigateur ou la messagerie.
export const MAX_GITHUB = 6000;
export const MAX_MAIL = 1800;
const NOTE_TRONQUE = '\n\n[… rapport raccourci : le rapport complet est dans le fichier enregistré, dossier Signalements]';

function raccourcir(texte: string, max: number): string {
  return texte.length <= max ? texte : texte.slice(0, max) + NOTE_TRONQUE;
}

/** Page « nouveau ticket » du dépôt, pré-remplie. */
export function lienGithub(titre: string, corps: string): string {
  const q = new URLSearchParams({ title: titre, body: raccourcir(corps, MAX_GITHUB), labels: 'bug' });
  return `https://github.com/${DEPOT_GITHUB}/issues/new?${q.toString()}`;
}

/** Message pré-rempli dans la messagerie (sauts de ligne CRLF, encodés selon RFC 6068). */
export function lienMail(sujet: string, corps: string): string {
  const enc = (s: string) => encodeURIComponent(s.replace(/\r?\n/g, '\r\n'));
  return `mailto:${ADRESSE_SIGNALEMENT}?subject=${enc(sujet)}&body=${enc(raccourcir(corps, MAX_MAIL))}`;
}
