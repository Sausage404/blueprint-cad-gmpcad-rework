# Installer et tester BluePrint CAD

Logiciel de dessin technique 2D qui reprend la façon de travailler de GMPCAD 2007 : mêmes menus, même palette ouverte par la barre d'espace, mêmes gestes de souris. C'est une **version de test**. Tout retour est utile.

## 1. Installer

### Sur Mac
1. Télécharger le bon fichier `.dmg`. Pour savoir lequel, menu  > « À propos de ce Mac » :
   - la ligne **« Puce : Apple M1, M2… »** → prendre le fichier qui finit par **`-arm64.dmg`** ;
   - la ligne **« Processeur : … Intel … »** → prendre le fichier qui finit par **`-x64.dmg`**.

   Il faut **macOS 13 (Ventura) ou plus récent**. Sur un Mac Intel, cela veut dire en gros un Mac de **2017 ou
   plus récent** (MacBook Pro et iMac 2017, MacBook Air et Mac mini 2018, Mac Pro 2019…). Un Mac plus ancien
   qui ne peut pas passer à Ventura ne pourra pas lancer BluePrint CAD.
2. Ouvrir le `.dmg` et glisser **BluePrint CAD** dans le dossier **Applications**.
3. Au premier lancement, macOS bloque l'appli parce qu'elle n'est pas signée par Apple. Pour l'autoriser, **une seule fois** :
   - double-cliquer sur l'appli, puis fermer le message ;
   - ouvrir **Réglages Système > Confidentialité et sécurité** ;
   - en bas, à côté de « BluePrint CAD a été bloquée », cliquer sur **Ouvrir quand même** et confirmer.
4. Une fois l'appli ouverte une première fois, le **Finder montre les plans** : vignettes des fichiers `.dxf` et `.des`, et aperçu complet en appuyant sur la **barre d'espace** quand un fichier est sélectionné (Coup d'œil). Si les vignettes n'apparaissent pas tout de suite, fermer et rouvrir la fenêtre du Finder. En présentation **par galerie**, le grand aperçu du haut reste vide pour l'instant (les vignettes du bas, elles, s'affichent) : utiliser la barre d'espace.

### Sur Windows
1. Télécharger le fichier `.exe` et le lancer.
2. Si Windows affiche « Windows a protégé votre ordinateur », cliquer sur **Informations complémentaires** puis **Exécuter quand même**. L'installeur n'est pas encore signé.

## 2. Les gestes à connaître
| Geste | Action |
|---|---|
| Clic gauche | Prélever un point |
| **Ctrl** (sans cliquer) | Repérer : le réticule saute sur le point existant le plus proche ; le clic gauche suivant le prend |
| Clic droit | Mesurer (coordonnées par rapport au losange rouge, l'origine de mesure) |
| Ctrl + clic droit | Changer l'origine de mesure |
| Maj + clic gauche | Annuler la dernière entité, ou la remettre |
| Maj + clic droit | Activer ou couper le calage à 15° |
| Barre d'espace | Ouvrir la palette des fonctions |
| Échap | Une fois : reprendre la fonction à son début ; deux fois : revenir au tracé de segments |
| Molette | Zoom autour du réticule |
| Option (Alt) + glisser | Déplacer la vue |
| Taper un nombre | Donner un point au clavier (X=, puis Y=) |
| Entrée sur une question | Prendre la valeur proposée `(déf, …)` |

Raccourcis de l'original : **Ctrl+E = Enregistrer**, **Ctrl+S = Enregistrer sous**, **Ctrl+A = Refaire**. Sur Mac, ⌘ marche aussi.

## 3. Les anciens dessins GMPCAD (.des)
BluePrint CAD **ouvre directement les `.des`** : Fichier > Ouvrir, glisser le fichier sur la fenêtre, ou double-clic. Les segments, cercles, arcs, ellipses, textes, le cartouche et les groupes sont repris, avec les couleurs de niveaux de GMPCAD. Les **cotes, hachures, repères, flèches, flèches de coupe, états de surface et taraudages**, que GMPCAD calculait à l'affichage, sont redessinés : sur les 5 dessins d'exemple, les cotes donnent les mêmes valeurs que le convertisseur d'origine et presque toutes les hachures les mêmes traits. Si un élément ne peut pas être repris (un contour de hachures pas fermé, par exemple), le message en bas de l'écran le dit.

Le dessin s'enregistre ensuite en **DXF**, un format ouvert que d'autres logiciels savent modifier (LibreCAD, QCAD, AutoCAD…).

## 4. Les nouveautés (absentes de l'original)
Elles ne changent ni la place des fonctions, ni les gestes, ni les raccourcis d'origine.

| Nouveauté | Comment |
|---|---|
| **Vue 3D** | Bouton **3D** dans la barre de gauche, **Fenêtres > Vue 3D** ou **⌘3** (Ctrl+3). La fenêtre se coupe en deux : le plan à gauche, la pièce en volume à droite. On désigne le contour (un trait du contour, une fenêtre, ou Entrée pour tout). **Extrusion** : le contour prend une épaisseur. **Révolution** : le profil tourne autour de son trait d'axe (trait mixte), ou d'un axe désigné avec « Axe... ». Seuls les **traits continus forts** forment les contours ; un contour à l'intérieur d'un autre fait un trou. Le volume suit les modifications du plan. Glisser pour tourner autour, clic droit pour déplacer, molette pour zoomer. Bouton **Plein écran**. |
| **Annulation illimitée** | **Edition > Annuler** (⌘Z / Ctrl+Z) remonte toutes les actions une par une ; **Refaire** (⌘A / Ctrl+A, ou ⌘⇧Z / Ctrl+Y). Maj + clic gauche et F9 gardent le comportement d'origine (dernière entité seulement). |
| **Reprise après plantage** | Le dessin non enregistré est recopié toutes les quelques secondes. Si le logiciel se ferme mal, il propose de le reprendre au lancement suivant. |
| **Recherche de fonction** | **⌘K** (Ctrl+K) ou **Aide > Rechercher une fonction** : taper « cercle », « chanfrein », « miroir », « congé »… puis Entrée. |
| **Aides au tracé** | Longueur et angle affichés près du réticule pendant un tracé ; petit carré orange sur le point que **Ctrl** prendrait. À couper dans **Préférences > Aides au tracé**. |
| **Aperçu avant impression** | **Fichier > Aperçu plein écran** ou le bouton imprimante de la barre de gauche : la feuille telle qu'elle sortira, avec Imprimer, Exporter et Partager. |
| **Exporter** | **Fichier > Exporter** : PDF à l'échelle exacte, image PNG ou image SVG (selon l'extension choisie). |
| **Partager** | **Fichier > Partager** : le dessin en PDF par Mail, Messages ou AirDrop (sous Windows : le PDF est montré dans l'Explorateur). |
| **Thème Moderne** | C'est le thème du premier lancement : même écran que l'original, plus net. **Préférences > Thème** : clair, sombre, ou comme le système (réglage du Mac ou de Windows, par défaut). Le thème **Classique** (au plus près de l'original) est dans le même menu. |
| **Signaler un problème** | **Aide > Signaler un problème** (ou le bouton en bas de l'aide, F1). Décrire ce qui s'est passé ; une capture de l'écran est jointe si la case reste cochée, et on voit tout ce qui sera envoyé. Puis **Sur GitHub** (il faut un compte GitHub), **Par e-mail** ou **Copier le rapport**. Après un plantage, le logiciel propose de lui-même de le signaler. Le dessin n'est jamais envoyé. |
| **Aperçu dans le Finder et l'Explorateur** | Vignettes et aperçu des `.dxf` et `.des` sans ouvrir le logiciel : sur Mac, barre d'espace dans le Finder ; sous Windows, grandes icônes et volet de visualisation de l'Explorateur (Alt+P). |

## 5. Ce qui marche, ce qui manque
**Toutes les cases des palettes ont leur fonction**, et toutes les entrées des menus sont branchées :
- **Menu de Base** (barre d'espace) : tracés, ellipses, courbes, hachures, toutes les cotes, textes, images, construction (raccordements, cercle tri-tangent, contour parallèle…), modifications (groupes, affinité, placement des niveaux…), gestion (options, nomenclature, fenêtres nommées, traits spéciaux, couleur et échelle des niveaux) ;
- **CALCULS** (bouton de la barre de gauche) : périmètre, surface, volumes, centre de gravité, moments ;
- **MECA** (bouton de la barre de gauche) : cotation mécanique (tolérances géométriques, rugosité, ajustements H7/g6, trous taraudés, cotation fonctionnelle) et bibliothèque de pièces (vis, écrous, roulements, joints, profilés… et cartouches) ;
- **menus** : plusieurs sessions (Fichier > Nouveau), copier-coller, pièces jointes, macros (Gmac), conversion des anciens `.des` en DXF par lots (Outils), IGES, aide (F1) et panneau « Vite ! ».

Pour retrouver une fonction : **⌘K** (Ctrl+K), ou **Aide > Index** : chaque case y a sa fiche (ce que la ligne de dialogue demande).

**À regarder de près** (choix faits sans pouvoir comparer avec l'original : liste complète dans la section 9 quater du cahier des charges) : les motifs de hachures, les cotes étagées et superposées, la cotation fonctionnelle, le dessin des pièces de la bibliothèque, le repérage limité au niveau de travail pour les fonctions de modification.

Les quatre systèmes de cotation de l'original sont là (**F4** : AFNOR, ISO, ANSI en pouces, ARCHI) ; changer de système transforme les cotes déjà faites. En 3D, les **perçages et alésages** dessinés en traits cachés (pointillés) sont creusés dans les pièces de révolution.

## 6. Signaler un problème
Ouvrir un ticket (« Issue ») sur la page GitHub du projet, avec :
- ce que vous faisiez (quelle fonction, quels clics) ;
- ce que vous attendiez, et ce qui s'est passé ;
- si possible, une capture d'écran et le fichier `.dxf`.

Pour ceux qui ont connu GMPCAD : dites-nous surtout ce qui **ne se comporte pas comme dans l'original**.
