// Menus déroulants : mêmes menus, même ordre, mêmes libellés et mêmes raccourcis que l'original
// (cahier des charges, section 3, et captures/05_menus/).
//
// Raccourcis :
// - Windows : Ctrl comme dans l'original.
// - macOS : le menu affiche ⌘, et Ctrl marche aussi (élément caché qui porte le raccourci Ctrl).
//   Exception : ⌘Q reste « Quitter » du Mac ; « Quitter la session » garde Ctrl+Q.
import { Menu, type MenuItemConstructorOptions } from 'electron';
import { basename } from 'node:path';
import { APP_NAME, type Prefs } from '../shared/types';

const mac = process.platform === 'darwin';

export interface MenuHandlers {
  command(id: string, label: string): void;
  setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void;
  toggleDevTools(): void;
}

type Item = MenuItemConstructorOptions;

export interface SessionMenu {
  numero: number;
  titre: string;
  active: boolean;
  choisir(): void;
}

export function buildMenu(prefs: Prefs, h: MenuHandlers, sessions: SessionMenu[] = []): Menu {
  const sep: Item = { type: 'separator' };

  /** Commande du logiciel. `key` = lettre du raccourci Ctrl d'origine (ou touche F). */
  function cmd(label: string, id: string, key?: string, opts: { enabled?: boolean; ctrlOnly?: boolean } = {}): Item[] {
    const click = () => h.command(id, label);
    const enabled = opts.enabled ?? true;
    if (!key) return [{ label, click, enabled }];
    if (key.startsWith('F')) return [{ label, click, enabled, accelerator: key }];
    if (!mac) return [{ label, click, enabled, accelerator: `Ctrl+${key}` }];
    if (opts.ctrlOnly) return [{ label, click, enabled, accelerator: `Ctrl+${key}` }];
    return [
      { label, click, enabled, accelerator: `Cmd+${key}` },
      { label, click, enabled, accelerator: `Ctrl+${key}`, visible: false, acceleratorWorksWhenHidden: true },
    ];
  }

  function radio<K extends keyof Prefs>(key: K, choices: [string, Prefs[K]][]): Item[] {
    return choices.map(([label, value]) => ({
      label,
      type: 'radio' as const,
      checked: prefs[key] === value,
      click: () => h.setPref(key, value),
    }));
  }

  type CleBooleenne = Exclude<{ [K in keyof Prefs]-?: Prefs[K] extends boolean ? K : never }[keyof Prefs], 'themeChoisi'>;
  function check(label: string, key: CleBooleenne): Item {
    return { label, type: 'checkbox', checked: prefs[key], click: (item) => h.setPref(key, item.checked) };
  }

  const fichier: Item = {
    label: 'Fichier',
    submenu: [
      ...cmd('Nouveau...', 'fichier.nouveau'),
      ...cmd('Ouvrir...', 'fichier.ouvrir', 'O'),
      ...cmd('Enregistrer', 'fichier.enregistrer', 'E'),
      ...cmd('Enregistrer sous...', 'fichier.enregistrer-sous', 'S'),
      sep,
      ...cmd('Fusionner...', 'fichier.fusionner'),
      ...cmd('Enregistrer une sélection', 'fichier.enregistrer-selection'),
      ...cmd('Revenir à la dernière version', 'fichier.revenir'),
      sep,
      ...cmd('Backup', 'fichier.backup', 'B'),
      ...cmd('Relire le backup', 'fichier.relire-backup'),
      sep,
      { label: 'Pièces jointes', submenu: [...cmd('Ajouter...', 'fichier.joindre'), ...cmd('Consulter...', 'fichier.joint-consulter'), ...cmd('Liste...', 'fichier.joints-liste')] },
      sep,
      ...cmd('Exporter...', 'fichier.exporter'),
      ...cmd('Partager...', 'fichier.partager'), // nouveauté : le dessin en PDF par Mail, Messages, AirDrop…
      sep,
      ...cmd('Imprimer...', 'fichier.imprimer', 'P'),
      ...cmd('Aperçu plein écran...', 'fichier.apercu'),
      sep,
      ...cmd('Quitter la session', 'fichier.quitter-session', 'Q', { ctrlOnly: true }),
      ...cmd('Quitter toutes les sessions', 'fichier.quitter-tout', undefined, { enabled: sessions.length > 1 }),
      // Les 4 derniers fichiers, comme dans l'original.
      ...(prefs.recents.length ? [sep] : []),
      ...prefs.recents.map((chemin, i): Item => ({ label: `${i + 1} ${basename(chemin)}`, click: () => h.command(`fichier.recent:${chemin}`, chemin) })),
    ],
  };

  const edition: Item = {
    label: 'Edition',
    submenu: [
      ...cmd('Annuler', 'edition.annuler', 'Z'),
      ...cmd('Refaire', 'edition.refaire', 'A'),
      // Raccourci habituel des logiciels d'aujourd'hui, en plus de celui de l'original.
      { label: 'Refaire', click: () => h.command('edition.refaire', 'Refaire'), accelerator: mac ? 'Cmd+Shift+Z' : 'Ctrl+Y', visible: false, acceleratorWorksWhenHidden: true },
      sep,
      ...cmd('Copier', 'edition.copier', 'C'),
      ...cmd('Coller', 'edition.coller', 'V'),
    ],
  };

  const gmac: Item = {
    label: 'Gmac',
    submenu: [...cmd('Exécuter...', 'gmac.executer', 'R'), ...cmd('Insérer dans le menu...', 'gmac.inserer')],
  };

  const groupe: Item = {
    label: 'Groupe',
    submenu: [
      ...cmd('Placer...', 'groupe.placer', 'G'),
      ...cmd('Enregistrer sous...', 'groupe.enregistrer-sous'),
      ...cmd('Insérer dans le menu...', 'groupe.inserer'),
    ],
  };

  const metier: Item = {
    label: 'Métier',
    submenu: [
      ...cmd('Changer...', 'metier.changer'),
      ...cmd('Informations...', 'metier.informations'),
      ...cmd('Annuler case...', 'metier.annuler-case'),
      sep,
      ...cmd('MECA', 'metier.recent.meca'),
    ],
  };

  // Menu de l'original, à sa place. Le DXF est le format du logiciel : « DXF vers dessin » l'explique ;
  // « dessin vers DXF » convertit par lots les anciens .des ; l'IGES s'importe et s'exporte.
  const outils: Item = {
    label: 'Outils',
    submenu: [
      ...cmd('Conversion DXF vers dessin', 'outils.dxf-vers-dessin'),
      ...cmd('Conversion dessin vers DXF', 'outils.dessin-vers-dxf'),
      ...cmd('Conversion IGES vers dessin', 'outils.iges-vers-dessin'),
      ...cmd('Conversion dessin vers IGES', 'outils.dessin-vers-iges'),
    ],
  };

  const preferences: Item = {
    label: 'Préférences',
    submenu: [
      {
        label: 'Positions des fenêtres',
        submenu: [...cmd('Mémoriser la position actuelle', 'preferences.fenetre-memoriser'), ...cmd('Position par défaut (plein écran)', 'preferences.fenetre-defaut')],
      },
      {
        label: 'Couleur du fond',
        submenu: radio('fond', [
          ['Blanc', 'blanc'],
          ['Gris', 'gris'],
          ['Noir', 'noir'],
        ]),
      },
      {
        label: 'Représentation du trait fort',
        submenu: radio('traitFort', [
          ['Luminosité', 'luminosite'],
          ['2 pixels', '2px'],
        ]),
      },
      {
        // La liste exacte de l'original n'est pas connue (seul « Magenta » apparaît dans SETUP).
        label: 'Couleur du réticule',
        submenu: radio('reticule', [
          ['Standard', 'standard'],
          ['Magenta', 'magenta'],
          ['Cyan', 'cyan'],
          ['Jaune', 'jaune'],
        ]),
      },
      { label: 'Messages sonores', submenu: [check('Saisie', 'sonSaisie'), check('Avertissement', 'sonAvertissement')] },
      ...cmd('Backup automatique...', 'preferences.backup-auto'),
      sep,
      // Nouveautés, absentes de l'original : chacune peut être coupée.
      {
        label: 'Thème',
        submenu: [
          ...radio('theme', [
            ['Moderne', 'moderne'],
            ['Classique (comme l\'original)', 'classique'],
          ]),
          sep,
          // Le thème Classique garde l'aspect de l'original : ce choix ne vaut que pour le Moderne.
          { label: 'Thème Moderne :', enabled: false },
          ...radio('apparence', [
            ['Comme le système', 'systeme'],
            ['Clair', 'clair'],
            ['Sombre', 'sombre'],
          ]).map((item) => ({ ...item, enabled: prefs.theme === 'moderne' })),
        ],
      },
      {
        label: 'Aides au tracé',
        submenu: [check('Longueur et angle près du réticule', 'mesuresCurseur'), check('Montrer le point repérable (Ctrl)', 'accrochageVisible')],
      },
    ],
  };

  const fenetres: Item = {
    label: 'Fenêtres',
    submenu: [
      ...cmd('Mosaïque horizontale', 'fenetres.mosaique-h'),
      ...cmd('Mosaïque verticale', 'fenetres.mosaique-v'),
      ...cmd('Cascade', 'fenetres.cascade'),
      sep,
      ...cmd('Vue 3D', 'vue.3d', '3'), // nouveauté : le plan à gauche, le volume à droite
      sep,
      // Les sessions ouvertes (8 au plus) : la session active est cochée.
      ...(sessions.length ? sessions : [{ numero: 1, titre: '(sans nom)', active: true, choisir: () => {} }]).map(
        (s): Item => ({ label: `${s.numero} ${s.titre}`, type: 'checkbox', checked: s.active, click: () => s.choisir() }),
      ),
      ...(mac ? [sep, { role: 'minimize', label: 'Réduire' } as Item] : []),
    ],
  };

  const aide: Item = {
    label: 'Aide',
    role: mac ? 'help' : undefined,
    submenu: [
      ...cmd('Index...', 'aide.index', 'F1'),
      // Nouveauté. Le raccourci est traité par l'interface (pas pendant une saisie au clavier).
      { label: 'Rechercher une fonction...', click: () => h.command('aide.rechercher', 'Rechercher une fonction...'), accelerator: 'CmdOrCtrl+K', registerAccelerator: false },
      ...cmd('Utilisation...', 'aide.utilisation'),
      ...cmd('Menu principal...', 'aide.menu-principal'),
      ...cmd('Module 2D...', 'aide.module-2d'),
      sep,
      ...cmd(`${APP_NAME} Vite ! ...`, 'aide.vite', 'I'),
      sep,
      { label: 'Nouveautés', submenu: [...cmd('Ce qui a été ajouté...', 'aide.nouveautes')] },
      sep,
      ...cmd('Temps de travail...', 'aide.temps'),
      sep,
      // Nouveauté : rapport de bug (ticket GitHub pré-rempli, e-mail ou copie).
      ...cmd('Signaler un problème...', 'aide.signaler'),
      sep,
      ...cmd(`Mise à jour de ${APP_NAME}...`, 'aide.mise-a-jour'),
      ...cmd(`A propos de ${APP_NAME}...`, 'aide.a-propos'),
      // Outils de développement (caché)
      { label: 'Outils de développement', accelerator: mac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', visible: false, acceleratorWorksWhenHidden: true, click: () => h.toggleDevTools() },
    ],
  };

  const template: Item[] = [fichier, edition, gmac, groupe, metier, outils, preferences, fenetres, aide];

  if (mac) {
    template.unshift({
      label: APP_NAME,
      submenu: [
        { label: `À propos de ${APP_NAME}`, click: () => h.command('aide.a-propos', `A propos de ${APP_NAME}...`) },
        sep,
        { role: 'hide', label: `Masquer ${APP_NAME}` },
        { role: 'hideOthers', label: 'Masquer les autres' },
        { role: 'unhide', label: 'Tout afficher' },
        sep,
        { role: 'quit', label: `Quitter ${APP_NAME}` },
      ],
    });
  }

  return Menu.buildFromTemplate(template);
}
