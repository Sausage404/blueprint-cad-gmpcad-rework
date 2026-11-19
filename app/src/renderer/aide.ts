// Menu Aide : index des fonctions, utilisation (souris et clavier), menus, module 2D, nouveautés, temps de
// travail, et le panneau « Vite ! » (5 pages, comme celui de l'original). Textes écrits pour ce logiciel :
// rien n'est repris de l'aide d'origine. La description d'une case est tirée de la fonction elle-même (ses
// premières questions dans la ligne de dialogue).
import { APP_NAME } from '../shared/types';
import { Dessin, type Trait } from './dessin';
import { creerFonction, existeFonction } from './fonctions';
import { BASE_LABELS } from './icons';
import { familles } from './theme';

export interface EntreeAide {
  code: string;
  libelle: string;
  famille: string;
}

const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Ce que la fonction demande d'abord (invite, puis question), lu en la créant sur un dessin vide. */
export function deroulement(code: string): string[] {
  if (!existeFonction(code)) return [];
  const at = { niveau: 1, trait: 'continu-fort' as Trait };
  try {
    const f = creerFonction(code, { dessin: new Dessin(), attributs: () => at, memoire: new Map(), rayon: () => 1, dire: () => {} });
    if (!f) return [];
    const q = f.question();
    const out: string[] = [];
    if (q) out.push(`${q.texte} (déf, ${q.defaut || '…'}) :`);
    const i = f.invite();
    if (i) out.push(i);
    return out;
  } catch {
    return [];
  }
}

/** Toutes les cases : Menu de Base (5 familles), puis les palettes CALCULS et MECA. */
export function entreesAide(autres: { titre: string; cases: { code: string; libelle: string }[] }[]): EntreeAide[] {
  const fams = familles('classique');
  const base: EntreeAide[] = [];
  BASE_LABELS.forEach((ligne, l) =>
    ligne.forEach((libelle, c) => {
      const propre = libelle.replace(/\s*\(pas d'infobulle.*\)$/, '');
      if (propre) base.push({ code: `${'BCDEF'[l]}${c + 1}`, libelle: propre, famille: `Menu de Base — ${fams[l]?.nom ?? ''}` });
    }),
  );
  return [...base, ...autres.flatMap((a) => a.cases.filter((c) => c.libelle && !/^Case libre/.test(c.libelle)).map((c) => ({ ...c, famille: a.titre })))];
}

const UTILISATION = `
<h3>La souris</h3>
<table>
<tr><td>Clic gauche</td><td>Prélever : le point est donné à la fonction en cours.</td></tr>
<tr><td>Touche Ctrl seule</td><td>Repérer : le réticule saute sur le point le plus proche (extrémité, milieu, intersection…). Appuyer encore : le point suivant.</td></tr>
<tr><td>Clic droit</td><td>Mesurer : la position du réticule s'affiche (X, Y depuis l'origine de mesure).</td></tr>
<tr><td>Ctrl + clic droit</td><td>Changer l'origine de mesure (losange rouge).</td></tr>
<tr><td>Maj + clic gauche</td><td>Annuler la dernière entité, puis la récupérer (bascule).</td></tr>
<tr><td>Maj + clic droit</td><td>Calage angulaire à 15° : actif ou non.</td></tr>
<tr><td>Molette</td><td>Zoom autour du réticule. Glisser avec la molette enfoncée : déplacer la vue.</td></tr>
</table>
<h3>Le clavier</h3>
<table>
<tr><td>Barre d'espace</td><td>Ouvrir ou fermer la palette « Menu de Base ».</td></tr>
<tr><td>Échap</td><td>Abandonner la saisie, puis la fonction en cours (retour au tracé de segments).</td></tr>
<tr><td>Entrée</td><td>Réponse par défaut (« déf, … ») ou fin d'une suite de points.</td></tr>
<tr><td>Chiffres</td><td>Taper des coordonnées X Y au lieu de désigner un point.</td></tr>
<tr><td>Flèches</td><td>Déplacer le réticule d'un pas (Maj : 5, Ctrl : 10).</td></tr>
<tr><td>F3</td><td>Repérage sur tous les niveaux pour la fonction en cours.</td></tr>
<tr><td>F5</td><td>Affichage plein format. F9 : annuler la dernière entité.</td></tr>
<tr><td>Ctrl+E</td><td>Enregistrer. Ctrl+S : enregistrer sous. Ctrl+O : ouvrir. Ctrl+P : imprimer.</td></tr>
<tr><td>Ctrl+Z / Ctrl+A</td><td>Annuler / refaire (autant de fois qu'on veut).</td></tr>
<tr><td>⌘K / Ctrl+K</td><td>Rechercher une fonction par son nom.</td></tr>
</table>
<h3>La ligne de dialogue</h3>
<p>Elle dit toujours ce que la fonction attend. Une valeur proposée s'écrit « (déf, 10) » : Entrée la prend.
Pendant une saisie : ↑ reprend la valeur proposée, ↓ efface la ligne, ⌘V / Ctrl+V colle un nombre copié.</p>`;

const MENUS = `
<table>
<tr><td>Fichier</td><td>Nouveau (dans cette fenêtre ou une nouvelle session), ouvrir un DXF ou un ancien dessin .des, enregistrer en DXF, fusionner un autre dessin, enregistrer une sélection, backup, pièces jointes, exporter (PDF, PNG, SVG), imprimer, aperçu, partager.</td></tr>
<tr><td>Edition</td><td>Annuler, refaire, copier une sélection, coller (R, X, Y pour la tourner ou la retourner).</td></tr>
<tr><td>Gmac</td><td>Exécuter une macro (fichier texte qui rejoue des cases avec des paramètres), l'affecter à une case de la bibliothèque.</td></tr>
<tr><td>Groupe</td><td>Placer un groupe enregistré, enregistrer un groupe, l'affecter à une case de la bibliothèque.</td></tr>
<tr><td>Métier</td><td>Le menu métier MECA : informations, cases affectées ou désactivées.</td></tr>
<tr><td>Outils</td><td>Conversion des anciens dessins .des en DXF (par lots), import et export IGES.</td></tr>
<tr><td>Préférences</td><td>Couleur du fond, trait fort, réticule, sons, backup automatique, thème, aides au tracé, position de la fenêtre.</td></tr>
<tr><td>Fenêtres</td><td>Les sessions ouvertes (8 au plus), mosaïques, cascade, vue 3D.</td></tr>
<tr><td>Aide</td><td>Cette aide, le panneau Vite !, le temps de travail.</td></tr>
</table>`;

const MODULE_2D = `
<p>La palette « Menu de Base » (barre d'espace) a 5 lignes de 20 cases, une famille par ligne :</p>
<table>
<tr><td>Habillage</td><td>Images, textes, cotes, repères, flèches.</td></tr>
<tr><td>Construction</td><td>Ellipses, courbes, polylignes, rectangles, polygones, hachures, axes.</td></tr>
<tr><td>Tracé</td><td>Segments, droites, cercles, arcs, raccordements, tangentes, parallèles, points.</td></tr>
<tr><td>Modification</td><td>Effacements, annulations, groupes, déplacements, rotations, symétries, affinité, niveaux, traits.</td></tr>
<tr><td>Gestion</td><td>Paramètres, format, nomenclature, options, zoom, fenêtres, traits, calage, niveaux, grille.</td></tr>
</table>
<p>Les palettes CALCULS (bouton CALCULS) et MECA (bouton MECA : cotation mécanique et bibliothèque de pièces)
s'ouvrent depuis la barre de gauche. Clic droit sur une case : son code et son nom.</p>
<p>Chaque dessin a 99 niveaux. Une entité est sur un niveau, avec un type de trait : continu fort ou fin,
pointillé, mixte, et les traits spéciaux (case F15).</p>`;

const NOUVEAUTES = `
<p>Ajouts par rapport au logiciel d'origine (chacun peut être ignoré : rien ne change dans les gestes ni les cases) :</p>
<ul>
<li>Annuler et refaire sans limite (Edition, Ctrl+Z / Ctrl+A).</li>
<li>Reprise du dessin après une coupure ou un plantage.</li>
<li>Longueur et angle près du réticule, point repérable montré au survol (Préférences > Aides au tracé).</li>
<li>Rechercher une fonction par son nom (⌘K / Ctrl+K).</li>
<li>Aperçu avant impression, export PDF, PNG, SVG, partage.</li>
<li>Thème Moderne, plus net, clair, sombre ou comme le système (Préférences > Thème, où se trouve aussi le thème Classique, au plus près de l'original).</li>
<li>Vue 3D du plan : extrusion ou révolution (Fenêtres > Vue 3D, ⌘3 / Ctrl+3).</li>
<li>Aperçu des plans hors du logiciel : dans le Finder du Mac (barre d'espace sur un fichier .dxf ou .des) et dans l'Explorateur de Windows (grandes icônes, volet de visualisation Alt+P).</li>
<li>Enregistrement en DXF, lisible par les autres logiciels de dessin.</li>
<li>Signaler un problème (Aide > Signaler un problème, ou bouton en bas de cette aide) : un rapport avec une capture de l'écran, envoyé sur GitHub, par e-mail, ou copié. Après une erreur ou un plantage, le logiciel le propose de lui-même. Le dessin n'est jamais envoyé.</li>
</ul>`;

/** Fenêtre d'aide (une page à la fois, sommaire à gauche). */
export class Aide {
  private fond: HTMLDivElement | null = null;
  private debutSession = Date.now();
  constructor(
    private entrees: () => EntreeAide[],
    private choisir: (code: string, libelle: string) => void,
    private tempsDessin: () => { depuis: number; actions: number },
    private signaler?: () => void,
  ) {}

  ouvrir(page: 'index' | 'utilisation' | 'menus' | 'module2d' | 'nouveautes' | 'temps' | 'mise-a-jour', recherche = ''): void {
    this.fermer();
    const fond = document.createElement('div');
    fond.className = 'dialogue-fond';
    const boite = document.createElement('div');
    boite.className = 'dialogue aide';
    boite.setAttribute('role', 'dialog');
    boite.setAttribute('aria-label', 'Aide');
    const sommaire = document.createElement('nav');
    const contenu = document.createElement('div');
    contenu.className = 'aide-contenu';
    const pages: [typeof page, string][] = [
      ['index', 'Index des fonctions'],
      ['utilisation', 'Utilisation'],
      ['menus', 'Menus'],
      ['module2d', 'Module 2D'],
      ['nouveautes', 'Nouveautés'],
      ['temps', 'Temps de travail'],
      ['mise-a-jour', `À propos`],
    ];
    const montrer = (p: typeof page) => {
      sommaire.querySelectorAll('button').forEach((b) => b.classList.toggle('actif', b.dataset.page === p));
      contenu.replaceChildren();
      if (p === 'index') this.index(contenu, recherche);
      else contenu.innerHTML = this.page(p);
    };
    for (const [p, t] of pages) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = t;
      b.dataset.page = p;
      b.addEventListener('click', () => montrer(p));
      sommaire.append(b);
    }
    if (this.signaler) {
      const s = document.createElement('button');
      s.type = 'button';
      s.className = 'signaler-aide';
      s.textContent = 'Signaler un problème…';
      s.addEventListener('click', () => {
        this.fermer();
        this.signaler!();
      });
      sommaire.append(s);
    }
    const fermer = document.createElement('button');
    fermer.type = 'button';
    fermer.className = 'principal fermer-aide';
    fermer.textContent = 'Fermer';
    fermer.addEventListener('click', () => this.fermer());
    sommaire.append(fermer);
    boite.append(sommaire, contenu);
    boite.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') this.fermer();
    });
    fond.append(boite);
    document.body.append(fond);
    this.fond = fond;
    montrer(page);
  }

  fermer(): void {
    this.fond?.remove();
    this.fond = null;
  }

  private page(p: string): string {
    switch (p) {
      case 'utilisation':
        return `<h2>Utilisation</h2>${UTILISATION}`;
      case 'menus':
        return `<h2>Les menus</h2>${MENUS}`;
      case 'module2d':
        return `<h2>Module 2D</h2>${MODULE_2D}`;
      case 'nouveautes':
        return `<h2>Nouveautés</h2>${NOUVEAUTES}`;
      case 'temps': {
        const t = this.tempsDessin();
        const duree = (ms: number) => {
          const m = Math.floor(ms / 60_000);
          return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
        };
        return `<h2>Temps de travail</h2><table><tr><td>Session ouverte depuis</td><td>${duree(Date.now() - this.debutSession)}</td></tr><tr><td>Dessin en cours depuis</td><td>${duree(Date.now() - t.depuis)}</td></tr><tr><td>Modifications du dessin</td><td>${t.actions}</td></tr></table>`;
      }
      default:
        return `<h2>${APP_NAME}</h2><p>Version 0.1. Logiciel libre sous licence GNU GPL v3 : vous pouvez l'utiliser, le modifier et le redistribuer, sans garantie.</p><p>Les nouvelles versions sont publiées avec leurs installeurs sur la page du projet.</p>`;
    }
  }

  private index(contenu: HTMLElement, recherche: string): void {
    const champ = document.createElement('input');
    champ.type = 'search';
    champ.placeholder = 'Chercher une fonction (nom ou code de case)';
    champ.value = recherche;
    const liste = document.createElement('div');
    liste.className = 'aide-liste';
    const fiche = document.createElement('div');
    fiche.className = 'aide-fiche';
    const toutes = this.entrees();
    const sansAccent = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const afficher = () => {
      const q = sansAccent(champ.value.trim());
      liste.replaceChildren();
      let famille = '';
      for (const e of toutes) {
        if (q && !sansAccent(`${e.code} ${e.libelle}`).includes(q)) continue;
        if (e.famille !== famille) {
          famille = e.famille;
          const h = document.createElement('h4');
          h.textContent = famille;
          liste.append(h);
        }
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = `<span class="code">${e.code}</span> ${echapper(e.libelle)}`;
        b.addEventListener('click', () => this.ficheDe(fiche, e));
        liste.append(b);
      }
    };
    champ.addEventListener('input', afficher);
    contenu.append(champ, liste, fiche);
    afficher();
    const premier = recherche ? toutes.find((e) => e.code === recherche) : null;
    if (premier) this.ficheDe(fiche, premier);
    champ.focus();
  }

  /** Fiche d'une case : nom, code, famille, et ce que la fonction demande. */
  ficheDe(fiche: HTMLElement, e: EntreeAide): void {
    const d = deroulement(e.code);
    fiche.innerHTML = `<h3>${echapper(e.libelle)}</h3><p class="code">Case ${e.code} — ${echapper(e.famille)}</p>${
      d.length ? `<p>La ligne de dialogue demande :</p><ul>${d.map((x) => `<li><code>${echapper(x)}</code></li>`).join('')}</ul>` : '<p>Fonction immédiate (sans question), ou choisie depuis la palette.</p>'
    }`;
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Utiliser cette fonction';
    b.addEventListener('click', () => {
      this.fermer();
      this.choisir(e.code, e.libelle);
    });
    fiche.append(b);
  }
}

// ======================================================================= Panneau « Vite ! »

const PAGES_VITE: { titre: string; lignes: [string, string][] }[] = [
  {
    titre: 'Pointage',
    lignes: [
      ['Prélever un point', 'Clic gauche'],
      ['Repérer un point existant', 'Touche Ctrl'],
      ['Mesurer (position du réticule)', 'Clic droit'],
      ["Changer l'origine de mesure", 'Ctrl + clic droit'],
    ],
  },
  {
    titre: 'Raccourcis',
    lignes: [
      ['Annuler / récupérer la dernière entité', 'Maj + clic gauche'],
      ['Calage angulaire (15°)', 'Maj + clic droit'],
      ['Abandon', 'Échap'],
      ['Menu de Base', "Barre d'espace"],
    ],
  },
  {
    titre: 'Mouches',
    lignes: [
      ['Origine de mesure', 'losange rouge'],
      ['Point repéré', 'carré rouge'],
      ['Point prélevé', 'croix rouge'],
      ['Contour ouvert (hachures, calculs)', 'message dans la ligne de dialogue'],
    ],
  },
  {
    titre: 'Logos des contraintes',
    lignes: [
      ['Réticule sur la grille', 'grille'],
      ['Réticule hors grille (point repéré)', 'grille barrée'],
      ['Réticule calé à 15°', 'angle'],
      ['Réticule non calé', 'angle barré'],
    ],
  },
  {
    titre: 'Logos du repérage',
    lignes: [
      ["Point d'intersection", 'croix cyan'],
      ['Pied de perpendiculaire', 'T magenta'],
      ['Point milieu', 'carré rouge sur un trait'],
      ['Intersection avec le calage', 'angle'],
    ],
  },
];

export const CLE_VITE = 'vite-au-demarrage';

/** Le panneau « Vite ! » : cinq pages courtes, la case « afficher au démarrage » est gardée. */
export function ouvrirVite(afficherAuDemarrage: boolean, changer: (oui: boolean) => void): void {
  let page = 0;
  const fond = document.createElement('div');
  fond.className = 'dialogue-fond';
  const boite = document.createElement('div');
  boite.className = 'dialogue vite';
  boite.setAttribute('role', 'dialog');
  boite.setAttribute('aria-label', `${APP_NAME} Vite !`);
  const corps = document.createElement('div');
  const pied = document.createElement('div');
  pied.className = 'dialogue-boutons';
  const caseDemarrage = document.createElement('label');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = afficherAuDemarrage;
  cb.addEventListener('change', () => changer(cb.checked));
  caseDemarrage.append(cb, document.createTextNode(' Afficher au démarrage'));
  const prec = document.createElement('button');
  prec.type = 'button';
  prec.textContent = '<<';
  const suiv = document.createElement('button');
  suiv.type = 'button';
  suiv.textContent = '>>';
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'principal';
  ok.textContent = 'OK';
  const montrer = () => {
    const p = PAGES_VITE[page];
    corps.innerHTML = `<div class="dialogue-titre">${p.titre} <span class="vite-marque">${APP_NAME} Vite !</span></div><table>${p.lignes.map(([a, b]) => `<tr><td>${a}…</td><td>${b}</td></tr>`).join('')}</table><p class="vite-pied">Pour aller plus loin : Aide > Utilisation (page ${page + 1} sur ${PAGES_VITE.length}).</p>`;
    prec.disabled = page === 0;
    suiv.disabled = page === PAGES_VITE.length - 1;
  };
  prec.addEventListener('click', () => (page--, montrer()));
  suiv.addEventListener('click', () => (page++, montrer()));
  ok.addEventListener('click', () => fond.remove());
  pied.append(caseDemarrage, prec, suiv, ok);
  boite.append(corps, pied);
  boite.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape' || e.key === 'Enter') fond.remove();
  });
  fond.append(boite);
  document.body.append(fond);
  montrer();
  ok.focus();
}
