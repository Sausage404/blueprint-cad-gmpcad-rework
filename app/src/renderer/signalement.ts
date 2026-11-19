// Boîte « Signaler un problème » : Aide > Signaler un problème, ou proposée après une erreur ou un plantage.
// La personne décrit ce qui s'est passé, choisit de joindre ou non une capture de l'écran, voit exactement ce
// qui sera transmis, puis l'envoie : ticket GitHub (page pré-remplie dans le navigateur), e-mail (message
// pré-rempli), ou copie du rapport. Le dessin lui-même n'est jamais transmis.
import { codeErreur, texteRapport, titreSignalement, type Incident, type InfosTravail } from '../shared/signalement';

export interface OptionsSignalement {
  /** L'erreur ou le plantage à signaler, s'il y en a un. */
  incident?: Incident;
  travail: InfosTravail;
  /** Message dans la ligne de dialogue, une fois le signalement préparé. */
  dire: (texte: string) => void;
}

let ouverte = false;

function element<K extends keyof HTMLElementTagNameMap>(nom: K, classe = '', texte = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(nom);
  if (classe) e.className = classe;
  if (texte) e.textContent = texte;
  return e;
}

export async function ouvrirSignalement(o: OptionsSignalement): Promise<void> {
  if (ouverte) return;
  ouverte = true;
  // La capture est prise avant que la boîte ne s'ouvre : elle montre l'écran tel qu'il était. On laisse
  // d'abord passer deux images, pour qu'une fenêtre qui vient de se fermer (le panneau d'aide) n'y soit plus.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30))));
  const [capture, systeme] = await Promise.all([window.dao.signalementCapture(), window.dao.signalementInfos()]);
  const explorateur = window.dao.platform === 'darwin' ? 'le Finder' : "l'Explorateur";

  const fond = element('div', 'dialogue-fond');
  const boite = element('div', 'dialogue signalement');
  boite.setAttribute('role', 'dialog');
  const titre = o.incident ? 'BluePrint CAD a rencontré un problème' : 'Signaler un problème';
  boite.setAttribute('aria-label', titre);
  const intro = element(
    'p',
    'signalement-intro',
    o.incident
      ? `Une erreur s'est produite (code ${codeErreur(o.incident.message, o.incident.pile)}). Vous pouvez la signaler pour qu'elle soit corrigée : dites en quelques mots ce que vous faisiez.`
      : "Décrivez ce qui ne va pas : ce que vous faisiez, ce qui s'est passé, ce que vous attendiez.",
  );
  const prive = element('p', 'signalement-note', "Votre dessin n'est pas envoyé : seulement le texte ci-dessous et, si vous le voulez, une capture de l'écran.");
  const zone = element('textarea');
  zone.rows = 5;
  zone.placeholder = "Ce que vous faisiez, ce qui s'est passé…";

  let caseCapture: HTMLInputElement | null = null;
  const blocCapture = element('div', 'signalement-capture');
  if (capture) {
    const etiquette = element('label');
    caseCapture = element('input');
    caseCapture.type = 'checkbox';
    caseCapture.checked = true;
    etiquette.append(caseCapture, document.createTextNode(" Joindre une capture de l'écran"));
    const image = element('img');
    image.src = capture;
    image.alt = "Capture de l'écran";
    caseCapture.addEventListener('change', () => image.classList.toggle('retiree', !caseCapture!.checked));
    blocCapture.append(etiquette, image);
  }

  const details = element('details', 'signalement-details');
  const resume = element('summary', '', 'Informations jointes au signalement');
  const pre = element('pre');
  const rapport = () => texteRapport(zone.value, systeme, o.travail, o.incident);
  const majApercu = () => (pre.textContent = rapport());
  majApercu();
  zone.addEventListener('input', majApercu);
  details.append(resume, pre);

  const note = element('p', 'signalement-note', 'GitHub demande un compte. Sans compte : « Par e-mail » ou « Copier le rapport ».');
  const pied = element('div', 'dialogue-boutons');
  const fermer = () => {
    fond.remove();
    ouverte = false;
  };
  const occupe = (oui: boolean) => pied.querySelectorAll('button').forEach((b) => (b.disabled = oui));

  /** Enregistre le rapport et la capture choisie dans Documents > BluePrint CAD > Signalements. */
  const preparer = () => window.dao.signalementEnregistrer(rapport(), caseCapture?.checked ? capture : null);

  const envoyer = async (mode: 'github' | 'mail') => {
    occupe(true);
    try {
      const r = await preparer();
      if (!r) return;
      await window.dao.signalementEnvoyer(mode, titreSignalement(zone.value, o.incident), r.texte, r.fichierImage ?? r.fichierTexte);
      fermer();
      const joindre = r.fichierImage ? `la capture est montrée dans ${explorateur} : ` : '';
      o.dire(
        mode === 'github'
          ? `Signalement : la page GitHub est ouverte dans le navigateur ; ${joindre ? `${joindre}glissez-la dans la page, puis ` : ''}cliquez sur « Submit new issue ».`
          : `Signalement : le message est prêt dans votre messagerie ; ${joindre ? `${joindre}joignez-la au message, puis ` : ''}envoyez-le.`,
      );
    } finally {
      occupe(false);
    }
  };

  const bouton = (texte: string, action: () => void, principal = false) => {
    const b = element('button', principal ? 'principal' : '', texte);
    b.type = 'button';
    b.addEventListener('click', action);
    return b;
  };
  pied.append(
    bouton('Copier le rapport', async () => {
      occupe(true);
      try {
        const r = await preparer();
        if (!r) return;
        await window.dao.signalementCopier(r.texte);
        fermer();
        o.dire(`Rapport copié : collez-le dans un message.${r.fichierImage ? " La capture est dans Documents > BluePrint CAD > Signalements." : ''}`);
      } finally {
        occupe(false);
      }
    }),
    bouton('Annuler', fermer),
    bouton('Par e-mail', () => void envoyer('mail')),
    bouton('Sur GitHub', () => void envoyer('github'), true),
  );

  boite.append(element('div', 'dialogue-titre', titre), intro, prive, zone, blocCapture, details, note, pied);
  fond.append(boite);
  document.body.append(fond);
  boite.addEventListener('keydown', (e) => {
    e.stopPropagation(); // les raccourcis du logiciel ne doivent pas agir pendant la saisie
    if (e.key === 'Escape') fermer();
  });
  zone.focus();
}
