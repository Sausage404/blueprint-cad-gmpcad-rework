# BluePrint CAD, le logiciel

Electron + TypeScript, dessin en Canvas 2D. Voir la section 9 du cahier des charges pour l'ordre des étapes.

## Lancer
Il faut Node.js (`brew install node` sur Mac). Ensuite, depuis ce dossier :

```bash
npm install
```

```bash
npm start
```

## Commandes
| Commande | Rôle |
|---|---|
| `npm start` | Compile puis lance l'appli. |
| `npm run typecheck` | Vérifie les types TypeScript. |
| `npm test` | Lance les tests (112 : pointage, primitives, fonctions de chaque palette, DXF, calculs, cotation, bibliothèque, menus). |
| `npm run dist:mac` / `dist:win` | Fabrique l'installeur macOS ou Windows dans `release/`. |
| `npm run icons` | Réexporte les icônes et les infobulles de la palette (`docs/maquette/icons.py` et `docs/reference-gmpcad/listes/palette_menu_de_base.tsv`) vers `src/renderer/icons.json`. |

Pour vérifier l'écran sans le regarder : `DAO_CAPTURE=/chemin/image.png npm start` enregistre une image de la fenêtre puis quitte. Des scénarios simulent des gestes avant la capture :
- `DAO_SCENARIO=palette` ouvre la palette ;
- `DAO_SCENARIO=segments` trace deux segments. On peut y ajouter `DAO_SCENARIO_FIN=reperage`, `saisie` (coordonnées au clavier et molette), `bascules` (Maj + clics, Échap, panoramique) ou `formes` (toutes les formes de l'étape 3a).
- `DAO_OUVRIR=/chemin/dessin.dxf` ouvre un dessin ; `DAO_SOURIS=x,y` place la souris ;
- `DAO_JS='…'` exécute un script dans l'interface (`window.daoCapture` donne le poste, le fichier et la vue 3D) et écrit son résultat en JSON dans `DAO_JS_SORTIE`.

La vérification utilise son propre dossier de réglages (dans le dossier temporaire), sans toucher aux vrais réglages.

## Organisation
- `src/main/` : processus principal (fenêtre, menus, préférences).
- `src/preload/` : passerelle entre le processus principal et l'interface.
- `src/renderer/` : l'interface.
  - `poste.ts` : le modèle souris / clavier (prélever, repérer, mesurer, origine, bascules, molette, flèches, Échap, saisie au clavier).
  - `geometrie.ts` : grille, calage angulaire, repérage des points (sans DOM, testé).
  - `vue.ts` : le dessin à l'écran (feuille, traits, mouches, réticule, logos).
  - `fonctions.ts` : les fonctions de dessin et le catalogue des cases (code → fonction).
  - `primitives.ts` : segments, droites, cercles, arcs, et leurs intersections (sans DOM, testé).
  - `dessin.ts`, `editeur.ts`, `palette.ts`, `renderer.ts` : le dessin en mémoire, l'éditeur de ligne, la palette, l'assemblage de l'écran.
  - `contours.ts` : contours fermés et profils de révolution pour la vue 3D (sans DOM, testé) ; `vue3d.ts`, `module3d.ts` : la vue 3D (three.js).
  - `recherche.ts`, `apercu.ts` : recherche de fonction (⌘K) et aperçu avant impression.
  - Les fonctions, par palette : `fonctions-construction.ts` (tracé, construction, habillage simple, gestion), `fonctions-courbes.ts`, `fonctions-hachures.ts`, `fonctions-habillage.ts`, `fonctions-modif.ts`, `fonctions-groupes.ts`, `fonctions-gestion.ts`, `fonctions-images.ts`, `fonctions-calculs.ts`, `fonctions-meca.ts` (cotation mécanique), `fonctions-bibliotheque.ts` (pièces normalisées), `fonctions-menus.ts` (copier-coller, pièces jointes, macros).
  - Les calculs sans DOM (testés) : `construction-avancee.ts`, `courbes.ts`, `hachures.ts`, `cotes.ts`, `cotation.ts`, `groupes.ts`, `images.ts`, `calculs.ts`, `iso286.ts`, `meca-symboles.ts`, `cotation-fonctionnelle.ts`, `bibliotheque.ts`, `gmac.ts`, `iges.ts`, `traits.ts`.
  - `palette-grille.ts`, `icones-meca.ts` : palettes CALCULS et MECA ; `aide.ts` : menu Aide et panneau « Vite ! » ; `dialogues.ts`, `liste-images.ts` : boîtes de dialogue.
- `src/quicklook/apercu.ts` et `quicklook/` : aperçu des plans dans le Finder ; `windows/` : dans l'Explorateur de Windows (voir « Installeurs »).
  - `des.ts`, `des-habillage.ts` : lecture des anciens `.des`, avec leurs cotes, hachures, repères et symboles redessinés (sans DOM, testé).
- `src/shared/` : types communs.
- `test/` : tests (`npm test`).

## État
**Étape 1, squelette de l'interface (thème « Classique »)** :
- les menus de l'original, avec leurs raccourcis (⌘ ou Ctrl sur Mac) ;
- la barre de gauche ;
- la zone de dessin avec sa bordure verte, la feuille A4H en double trait, le réticule plein écran et les ascenseurs ;
- la ligne de dialogue et le tableau de bord ;
- la palette « Menu de Base » (barre d'espace ou bouton BASE), avec ses infobulles après 0,8 s et le code de la case au clic droit ;
- le fond Blanc, Gris ou Noir et la couleur du réticule (menu Préférences), mémorisés.

**Étape 2, modèle souris et clavier** (cahier des charges, sections 2 et 2 bis) :
- la fonction par défaut, « Tracé de segments » (case D1), avec son tracé élastique ;
- clic gauche pour prélever ; Ctrl seul pour repérer le point le plus proche (extrémité, milieu, intersection, pied de perpendiculaire), puis clic gauche pour le prélever ; un nouvel appui sur Ctrl passe au point suivant ; Ctrl maintenu affiche ses coordonnées ;
- clic droit pour mesurer, Ctrl + clic droit pour changer l'origine de mesure ;
- Maj + clic gauche pour annuler ou restituer la dernière entité ; Maj + clic droit pour le calage ;
- grille de 1 mm (origine au centre du plan, pas réduit automatiquement au zoom) et calage à 15°, avec leurs logos au bout du réticule ;
- molette (zoom centré sur le réticule), Alt + glisser (panoramique), flèches (1, 5, 10 ou 50 pixels) ;
- Échap (un appui : lever le crayon ; deux : fonction par défaut), F5 (plein format), F9 (annuler le dernier tracé) ;
- saisie des coordonnées au clavier (`X=`, `Y=` en tapant un chiffre ou avec le bouton, `R=`, `A=` avec le bouton polaires) et éditeur de ligne de l'original ;
- mouches rouges (point prélevé, point repéré, origine de mesure), effacées à chaque nouvel affichage.

**Étape 3a, tracés de la palette** (ordre des clics, questions et textes repris de l'aide d'origine) :
- ligne 3 : demi-droite (D2), droite (D3), cercle centre + diamètre (D4), cercle centre + point (D5), arcs origine-centre-angle (D7), centre et deux points (D8), par trois points (D9) ;
- ligne 2 : rectangle (C10), rectangle à angles arrondis (C11), rectangle incliné (C12), rectangle à bouts ronds (C13), polygone régulier (C14) ;
- questions au clavier dans la ligne de dialogue, avec la valeur par défaut de l'original (`(déf, …)`) ; Entrée sur une ligne vide ou un clic sur la ligne de dialogue la prend ; la dernière valeur tapée est proposée la fois suivante ;
- « Rayon trop grand » et « Largeur trop grande pour la longueur » reposent la question avec la valeur maximale ;
- types de trait (F11 à F14) : continu fort, pointillé fin, mixte fin, continu fin ; plein format (F8), calage (F16), annulation (E1) et récupération (E7) ;
- repérage étendu aux cercles et arcs (centres, extrémités, milieux, intersections) et au milieu des rectangles et polygones ;
- l'icône en bas à gauche montre la fonction en cours.

**Étape 3c, modifications (ligne 4)** : effacements (partiel par deux points, d'une partie, d'une demi-entité), annulation d'une entité et par fenêtre, éclatement, déplacement d'un point, translation et rotation (avec duplications), symétrie, homothétie, changement de niveau et de type de trait. Sélection « entité ou fenêtre (déf, tout) » et listes de niveaux de l'original (`*`, `tt`, `+`, `-`).

**Étapes 3b, 3d, 3e** :
- construction : chanfrein, raccordement de segments, tangente à deux cercles ou points, perpendiculaire, parallèles, points ;
- habillage : texte et ses caractéristiques, cotes linéaire, de diamètre et de rayon ;
- réglages sans quitter la fonction en cours : examen d'une entité, zoom sur fenêtre, niveau de travail, grille, format du plan.

**Étape 4, DXF** : ouvrir, enregistrer (Ctrl+E), enregistrer sous (Ctrl+S), fusionner, revenir à la dernière version, backup (manuel et toutes les 10 minutes), 4 derniers fichiers, glisser-déposer, double-clic sur un `.dxf`. Les 5 dessins d'exemple convertis par DESDXF se relisent entièrement (cotes, blocs, hachures, accents).

**Étape 5, impression** : impression et PDF à l'échelle exacte du format (Fichier > Imprimer, Exporter).

**Nouveautés** (absentes de l'original, voir `docs/TESTER.md`) : vue 3D (extrusion, révolution, plein écran), annulation illimitée, reprise après plantage, recherche de fonction, aides au tracé, aperçu avant impression, export PDF / PNG / SVG, partage, thème « Moderne », aperçu dans le Finder.

**Étapes 6 à 12 (18/11/2026)** : toutes les cases des palettes ont leur fonction, et toutes les entrées de menu sont branchées :
- palette de Base complète : ellipses, courbes, hachures, toutes les cotes et l'habillage, construction (cercle tri-tangent, raccordement d'arcs, contour parallèle, points), groupes, placement de niveaux, affinité, images, gestion (paramètres, nomenclature, options, fenêtres nommées, traits spéciaux, couleur et échelle des niveaux, repérage sur tous niveaux) ;
- palette CALCULS (10 cases) ; palette MECA : cotation mécanique (30 cases) et bibliothèque (106 pièces, 2 cartouches) ;
- menus : sessions multiples, copier-coller, sélection, pièces jointes, macros, cases de bibliothèque, conversions .des → DXF et IGES, backup automatique, aide.

Les choix incertains, à faire vérifier, sont dans la section 9 quater du cahier des charges.

**Compléments (18/11/2026, après-midi)** :
- cotation ANSI (pouces décimaux ou fractionnaires, saisie en pouces) et ARCHI (m, cm avec décimale en exposant, traits obliques) ; changer de système (F4) transforme les cotes déjà faites ;
- vue 3D : perçages et alésages des pièces de révolution (traits cachés), coupe complète tournée une seule fois, arêtes vives ;
- anciens `.des` : cotes, hachures, flèches, repères, flèches de coupe, états de surface, taraudages, arcs d'ellipse et traits spéciaux, comparés aux conversions DXF d'exemple ;
- aperçu des plans dans l'Explorateur de Windows (vignettes et volet de visualisation).

## Installeurs
- `npm run dist:mac` : `.dmg` pour Mac (puces Apple et Intel), dans `release/`. Il n'est pas signé par Apple (voir `docs/TESTER.md`), mais il est signé « ad hoc » en entier par `quicklook/apres-empaquetage.cjs`, sans quoi macOS pourrait le dire « endommagé ».
- L'appli Mac contient deux extensions Coup d'œil (`quicklook/`, en Swift) : l'aperçu (barre d'espace) et les vignettes des `.dxf` et `.des` dans le Finder. Elles exécutent le lecteur DXF / .des du logiciel (`src/quicklook/apercu.ts`) avec JavaScriptCore. `node quicklook/build.mjs` les fabrique (il faut Xcode) ; `dist:mac` le fait tout seul. Pour les essayer sans installer : `qlmanage -t -x -o /tmp fichier.dxf` après avoir ouvert une fois l'appli fabriquée.
- `npm run dist:win` : installeur Windows, à lancer sur Windows ou par GitHub.
- L'installeur Windows ajoute l'aperçu des `.dxf` et `.des` dans l'Explorateur (vignettes et volet de visualisation, Alt+P) : `windows/BluePrintApercu.dll`, en C#, compilée par le `csc.exe` fourni avec Windows (.NET Framework 4, rien à installer). Elle exécute le même lecteur (`src/quicklook/apercu.ts`, abaissé en ES2017 avec `windows/polyfills.js`) dans le moteur JavaScript de Windows (Chakra) et dessine avec GDI+. `node windows/build.mjs` la fabrique (sous Windows ; ailleurs, seul le script est fait) ; `build/installer.nsh` l'enregistre et la retire à la désinstallation. Pour l'essayer sans installeur : `powershell -ExecutionPolicy Bypass -File windows\enregistrer.ps1` (et `-Retirer`). En cas de problème, les erreurs sont notées dans `%LOCALAPPDATA%Low\BluePrint CAD\apercu.txt`.
- Sur GitHub, le flux « Installeurs » (`.github/workflows/installeurs.yml`) lance les tests et fabrique les deux installeurs. Une étiquette `v0.2.0` poussée crée une version de test avec les installeurs.
