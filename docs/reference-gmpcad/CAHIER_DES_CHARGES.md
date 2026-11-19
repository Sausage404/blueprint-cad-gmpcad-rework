# Refaire GMPCAD — dossier de référence pour la session Claude Code

> **Objectif :** recréer un logiciel de DAO 2D dont l'interface, les menus et la façon de travailler sont **les mêmes que GMPCAD 2007**, pour qu'un utilisateur habitué (le grand-père de l'auteur, ancien dessinateur) ne soit pas perdu.
> Ce dossier décrit l'original tel qu'il a été observé en le faisant tourner. Ce n'est **pas** du code à reprendre : le nouveau logiciel doit être écrit de zéro.

---

## 0. Comment ce dossier a été produit

- Source : l'installeur officiel **GMPCAD Version 2007 révision F** (24 mars 2008), fourni par l'auteur.
- L'installeur 16 bits (MS-Setup) ne marche pas sous Wine. Les fichiers ont donc été décompressés et posés **selon le script d'installation d'origine**. Ensuite, le programme officiel `SETUP.EXE` a installé la **licence DEMO** (sans dongle). C'est le mode prévu par l'éditeur, et le LISEZMOI dit que la copie du CD et l'utilisation en mode démo sont libres.
- GMPCAD (exécutable Win32) tourne alors sous Wine, en mode « Démonstration » : tout fonctionne sauf l'enregistrement.
- Les captures viennent de cet environnement. Les listes de fonctions viennent des **infobulles réelles** du logiciel, lues par OCR puis corrigées à la main. Il peut rester de petites erreurs, signalées par « (?) ».
- **Aucune décompilation** n'a été faite. On a seulement fait tourner le logiciel et lu ses fichiers texte (aide, LISEZMOI, fichiers de config).

### Règles pour le nouveau logiciel
- **Ne pas** s'appeler GMPCAD : c'est une marque déposée par l'IUT de Cachan. Il faut un autre nom.
- **Redessiner** toutes les icônes. Les captures servent de modèle pour l'emplacement, la taille, la couleur et l'idée de chaque icône, mais aucun fichier image d'origine ne doit être réutilisé.
- Garder **la disposition, l'ordre, les couleurs de familles, les raccourcis et les comportements souris** : c'est là que se trouvent les réflexes de l'utilisateur.
- **Fonctionner sur macOS et sur Windows.** Le grand-père est passé sous **macOS** depuis quelques mois, c'est donc la plateforme principale. Voir la section 9 bis.
- **Proposer deux thèmes** avec exactement le même agencement : « Classique », au plus près de l'original, et « Moderne », plus net et plus lisible. Voir la maquette et la section 9 ter.

---

## 1. Vue d'ensemble de l'écran

Voir `captures/01_ecran_principal_vierge.png` et `captures/02a…02c`.

| Zone | Description |
|---|---|
| **Barre de menus** | Fichier · Edition · Gmac · Groupe · Métier · Outils · Préférences · Fenêtres … et **Aide** calé tout à droite. |
| **Barre d'outils verticale à gauche** | Gros boutons empilés, avec une étiquette sous les trois premiers : **BASE**, **MECA**, **CALCULS**. Viennent ensuite : Traceur (impression), Calculatrice, Saisie en cartésiennes (axes X/Y), Saisie en polaires (R/θ). Un bouton isolé (flèches haut/bas sur un empilement) se trouve plus bas : c'est **Annulation/Restitution** de la dernière entité, en bascule, comme Maj + clic gauche. Pendant les placements (Fusionner, Copier-coller), ce bouton devient « rotation rapide ». Le rôle des 8 boutons est confirmé par l'aide d'origine (rubrique « Menu icônes »). Voir `captures/11a_barre_outils_gauche.png`. |
| **Zone de dessin** | Elle remplit la fenêtre et a une **bordure verte** (session ou fenêtre active). Le **cadre du format** (ex. A4H) est affiché en double trait blanc : le bord de la feuille (avec une petite ombre grise en bas et à droite) et un cadre intérieur. Mesuré sur les captures : cadre intérieur à 5 mm du bord en A4H (capture 01), environ 10 mm en A1H (capture 02a). A2, A3 et A0 restent à vérifier. Un **réticule** de lignes fines suit la souris sur toute la largeur et toute la hauteur. Il y a des ascenseurs horizontal et vertical. |
| **Ligne de dialogue** | Sous la zone de dessin, en police à chasse fixe (Courier New 9 pt par défaut). Elle affiche l'invite de la fonction en cours, par ex. `Segment de droite. Désigner un point.` Au repos, elle affiche `Application : BROCHE. Format A1H (840x594). Echelle du plan : 1`. |
| **Icône de fonction en cours** | Carré en bas à gauche (sous la barre d'outils). Il montre l'icône de la fonction active. Son infobulle est « Icone de la fonction en cours. » |
| **Tableau de bord (barre d'état)** | De gauche à droite : type de trait courant (`— Cont. fort`) · calage angulaire (`calé 15°`) · niveau de travail (`Niv 1`, avec un carré de la couleur du niveau) · zoom (`Zoom 1.06`) · pas de grille (`Pas 1 mm`) · taille estimée du fichier (`1 Ko`, icône disquette) · système de cotation (`AFNOR`) · un indicateur `(*)` (astérisque entre parenthèses), grisé au repos. D'après l'aide, **les parenthèses apparaissent quand la fonction en cours peut agir sur d'autres niveaux que le niveau de travail**. La case `(*)` (5.7) ou la touche F3 autorise ou interdit alors l'accès à ces niveaux. Le zoom affiché est le rapport « dimension à l'écran / dimension réelle ». Voir `captures/11b_…`. |

**Couleur de fond** : Blanc (crème), Gris ou Noir (menu Préférences). L'installation par défaut met **Gris**. Les trois rendus sont dans `captures/02a/02b/02c`. Il faut demander au grand-père lequel il utilisait.

**Couleurs des traits** : chaque **niveau** a sa couleur (vert, jaune, bleu, magenta, rouge, cyan…). Les traits forts sont affichés plus lumineux, ou sur 2 pixels selon l'option « Représentation du trait fort ».

---

## 2. Le modèle d'interaction (le plus important)

Il est décrit dans le panneau **« GMPCAD Vite ! »**, affiché au démarrage (`captures/04_panneau_gmpcad_vite_5_pages.png`) :

### Pointage (souris)
| Action | Geste |
|---|---|
| **Prélever** (prendre un point libre) | **Clic gauche** |
| **Repérer** (s'accrocher à un point existant) | **Touche Ctrl seule, sans clic** (capture 04 ; aide d'origine, « Système de pointage »). Appuyer sur Ctrl place le réticule sur le point existant le plus proche et désactive, pour ce point, la grille et le calage. **Ctrl ne valide pas le point** : l'aide répète « repérer **puis** prélever » et « le point doit être repéré (action R) **avant** le prélèvement ». C'est le **clic gauche** qui le donne à la fonction. Loin de toute entité, Ctrl libère le réticule de la grille, ce qui permet de prélever un point hors grille. Voir la section 2 bis. |
| **Mesurer** | **Clic droit** |
| **Changer l'origine de mesure** | **Ctrl + clic droit** |

### Raccourcis
| Action | Geste |
|---|---|
| Annuler / Récupérer | **Maj + clic gauche** |
| Calage angulaire | **Maj + clic droit** |
| Abandon de la fonction | **Échap** |
| Afficher les menus (palette) | **Barre d'espace** |

### Autres comportements observés ou documentés
- La palette **« Menu de Base »** s'ouvre avec **Espace** à l'endroit où elle a été rangée, et **se referme dès que la souris en sort**. C'est un menu « pop-up » en grande grille d'icônes, pas une barre d'outils fixe.
- **Fonction par défaut** : segment de droite. Au démarrage la ligne de dialogue affiche `Segment de droite. Désigner un point.` C'est la case 3.1, « Création de segments enchaînés » (confirmé par l'aide, rubrique « Tracé de segment »).
- **Taper un nombre** (`. + - 0…9`) pendant une demande de point lance automatiquement la **saisie en cartésiennes**.
- **Flèches du clavier** : elles déplacent finement le curseur et le réticule. Avec Maj ou Ctrl, le pas change (voir la section 2 bis).
- **Molette** : zoom +/- centré sur le réticule. Dans la fonction Zoom, la touche **P** revient à la fenêtre précédente.
- **Codes des cases** : la ligne 1 de la palette correspond à la lettre B, la ligne 5 à la lettre F (ex. `D15` = « Parallèle à une distance donnée », ligne 3, colonne 15). La lettre A et les colonnes 16 à 20 des lignes I à T sont des cases internes (boutons de la barre de gauche, fonctions de fichier) : voir `MENUS.MSE`.
- **Tracés élastiques** : on voit l'entité suivre la souris pendant toute sa définition (segments, cercles, cotes…).
- **Entités sélectionnées** : affichées en **pointillés rouges et blancs**.
- **Copier/Coller et Placement** : aperçu avant de poser. **r** fait pivoter de 15°, **Maj+R** de 45°. **X** et **Y** donnent une symétrie horizontale ou verticale. Les flèches font un déplacement lent, et une touche de modification + flèches un déplacement rapide (voir `sources/NOUVEAUTES_2001_2007.txt`).
- Un « point milieu » est repérable sur les rectangles, polygones et flèches, et sert à déplacer toute l'entité (« Déplacement d'un point »).
- **Touches F1 à F9** : voir la section 2 bis.
- **Repérage** : les coordonnées du point repéré ne s'affichent que si on **maintient Ctrl environ 0,3 s**.
- **Aide d'une case** : une infobulle jaune apparaît après **0,8 s** de survol d'une case. Un **clic droit sur une case** d'un menu (base, calculs, métier) affiche l'aide **et le code de la case** (ex. `B12`, `D3`).
- **Alt + clic gauche glissé** : déplacement panoramique de la vue.
- **Glisser-déposer** d'un `.des` sur la fenêtre : ouvre le dessin. Avec **Maj** enfoncé, il le **fusionne** avec le dessin en cours (comme Fichier > Fusionner).
- **Taille des icônes** : petites (30 × 30 px) ou grandes (45 × 45 px) dans l'original. Les menus métiers restent en petites icônes.

### 2 bis. Ce que dit l'aide d'origine (GMPFRA.HLP, lue le 18/11/2026)
L'aide en ligne de la version 2007 F a été extraite de l'installeur (voir `outils/README.md`). Le texte complet est dans `original/aide/GMPFRA.txt`, hors du dépôt. Ce qui suit la résume. Quand le nom d'une touche était une image dans l'aide, on l'indique par « touche non lisible ».

**Pointage**
- **Clic gauche** : désigne ou valide un point, une entité ou une case. Un **second clic gauche** sur la case de la fonction ou dans la zone de dialogue **accepte la réponse proposée par défaut** (« déf, … »).
- **Ctrl** : repère le point existant le plus proche et y place le réticule. Le clic gauche qui suit le prélève (voir le tableau ci-dessus). Le point repéré est entouré d'une mouche, avec un logo pour les points particuliers (intersection, pied de perpendiculaire, milieu, intersection avec la direction calée). **Ctrl maintenu** affiche les coordonnées du point par rapport à l'origine de mesure (1 s d'après l'aide, 0,3 s d'après le LISEZMOI 2007). **Un nouvel appui sans bouger** repère un autre point proche.
- **Clic droit** : affiche, près du réticule, les coordonnées du réticule par rapport à l'origine de mesure. Bouton maintenu, l'affichage suit le réticule.
- **Ctrl + clic droit** : change l'origine de mesure. On repère le point avec Ctrl, puis on clique à droite. Un losange marque la nouvelle origine.
- **Maj + clic gauche** : annule la dernière entité créée, ou la restitue (bascule).
- **Maj + clic droit** : active ou coupe le calage angulaire (bascule).
- **Molette** : chaque cran fait un zoom avant ou arrière **centré sur le réticule**.
- **Alt + clic gauche** : déplacement panoramique.
- **Flèches** : un appui déplace le curseur d'**un pixel**. Avec une touche de modification, le pas passe à 5 ou 10 pixels, et à 50 pixels avec deux touches. Les touches sont non lisibles dans l'aide : sans doute Maj et Ctrl, **à vérifier**.
- **Réticule** : le grand réticule (plein écran) sert quand on demande un point précis. Un **petit réticule en forme de viseur** sert quand on désigne une entité approximativement, par exemple pour l'effacer.

**Grille et calage (valeurs au démarrage)**
- **Grille** : active, pas de 1 mm (ISO/AFNOR), origine au **centre du plan**. L'origine de mesure absolue est celle de la grille. Le pas est divisé automatiquement (par 2, 5, 10…) quand moins de 20 pas tiennent à l'écran, et le tableau de bord l'affiche. Une brève pression sur une touche (non lisible) supprime la grille pour le prochain point seulement.
- **Calage** : actif, à 15°, par rapport au dernier point prélevé. Avec la grille, le calage passe en priorité.

**Abandon (Échap)**
- **Un appui** reprend la fonction en cours à son début. Pendant un tracé de segments, il « lève le crayon » et coupe le segment élastique.
- **Deux appuis** reviennent à la fonction par défaut, **« Tracé de segments »** (case 3.1).
- Pendant un affichage long ou une transformation, Échap l'interrompt et affiche « Interruption de la procédure. ».

**Barre d'espace et menus**
- Chaque appui fait passer au premier plan, à tour de rôle, les menus ouverts (Menu de Base, Menu métier, Menu calculs) et la fenêtre de dessin.
- Le Menu de Base s'affiche aussi quand le réticule **sort par le haut de l'écran**. Ouvert par son bouton, il s'affiche en haut à gauche.

**Touches de fonction (par défaut, modifiables dans `KBDMEN.PMS`)**

| Touche | Fonction |
|---|---|
| F1 | Aide en ligne |
| F2 | Documentation sur une case du menu |
| F3 | Accès à tous les niveaux pour la fonction en cours (comme la case `(*)` 5.7) |
| F4 | Backup rapide |
| F5 | Affichage plein format |
| F6 | Affichage d'une fenêtre mémorisée |
| F7 | Zoom sur une fenêtre fugitive |
| F8 | Changement du niveau de travail |
| F9 | Annulation du dernier tracé |

**Saisie au clavier**
- **Coordonnées d'un point** : quand un point est demandé, la case « cartésiennes » demande `X=` puis `Y=`, et la case « polaires » demande `R=` puis `A=` (en degrés, sens trigonométrique). Les valeurs se comptent depuis l'origine de mesure. On peut aussi taper directement les chiffres.
- **Éditeur de ligne** (toute saisie au clavier) : il est en mode insertion et la ligne se valide quelle que soit la position du curseur. Raccourcis : Ctrl+H ou Retour arrière efface à gauche, Ctrl+K ou Suppr efface à droite, ↓ ou Ctrl+X efface la ligne, ↑ ou Ctrl+E rappelle la valeur par défaut, → ou Ctrl+D avance d'un caractère.
- **Niveaux** : il y en a 99. Une liste se donne par numéros, ou en désignant un trait du niveau. `*` veut dire tous les niveaux, et `+` ou `-` ajoutent ou retirent un niveau (ex. `*-2-3`). Un `?` affiche les niveaux utilisés.

**Sons** : un bip simple attend un point, un double bip attend une valeur ou un texte, un bip grave signale une erreur ou un abandon.

**Textes exacts de la ligne de dialogue** : ils sont dans les fichiers `GM1.MSE`, `GM2.MSE` et `MENUS.MSE` de l'original, numérotés, en français et en anglais (ex. `0311 Segment de droite. Désigner un point.`). Ils serviront de référence pour l'étape 3.

**Valeurs choisies à l'étape 2, à vérifier avec le grand-père ou dans l'original**
- Zoom de **1,25** par cran de molette. Sur un trackpad ou une Magic Mouse, les petits mouvements sont cumulés et la cadence est limitée, pour que le zoom ne parte pas tout seul.
- Rayon de recherche du repérage : **12 pixels** autour du réticule.
- Flèches : **Maj** = 5 pixels, **Ctrl ou Option** = 10, **Maj + Ctrl** (ou Maj + Option) = 50. Option remplace Ctrl parce que Ctrl + flèches est pris par macOS.
- Ctrl maintenu **0,3 s** affiche les coordonnées du point repéré (valeur du LISEZMOI 2007).
- **Ctrl + clic gauche sur Mac** : traité comme un clic gauche (prélever le point repéré), jamais comme un clic droit. À tester avec une vraie souris.
- Barre d'espace : elle ouvre ou ferme le Menu de Base. Elle fera défiler les menus ouverts quand les menus Métier et Calculs existeront.
- Petit réticule « viseur » : il viendra avec les fonctions qui désignent une entité (étape 3).

**Choix faits à l'étape 3a**
- **Rectangle incliné (C12)** : l'aide lui fait demander un rayon en premier. C'est sans doute une erreur de copie dans l'aide, et on ne le demande pas. À vérifier.
- **Rectangle à bouts ronds (C13)** : les deux points désignés sont les extrémités de la rainure, sur son axe. La largeur ne peut pas dépasser la longueur.
- **Arc par trois points (D9)** : il est parcouru dans l'ordre des points. Deux points confondus donnent un cercle dont le diamètre joint les deux points distincts (aide d'origine).

### Mouches (marqueurs à l'écran)
| Marqueur | Signification |
|---|---|
| Losange rouge avec un + | Origine de mesure |
| Petit carré rouge | Point repéré |
| Petite croix rouge | Point prélevé |
| Cercle rouge | Contour ouvert |

### Logos de contraintes (sur le réticule)
Réticule sur la grille · Réticule hors grille · Réticule calé modulo 15° · Réticule non calé.

### Logos de repérage
Point d'intersection (croix cyan) · Pied de perpendiculaire (T magenta) · Point milieu (petit carré rouge sur un trait) · Intersection avec le calage.

---

## 3. Menus déroulants

Les captures sont dans `captures/05_menus/`.

**Fichier** : Nouveau… · Ouvrir… `Ctrl+O` · Enregistrer `Ctrl+E` · Enregistrer sous… `Ctrl+S` · — · Fusionner… · Enregistrer une sélection · Revenir à la dernière version · — · Backup `Ctrl+B` · Relire le backup · — · Pièces jointes ▸ · — · Exporter… · — · Imprimer… `Ctrl+P` · Aperçu plein écran… · — · Quitter la session `Ctrl+Q` · Quitter toutes les sessions · + liste des **4 derniers fichiers**.
> Attention : **Ctrl+E = Enregistrer**, **Ctrl+S = Enregistrer sous**. C'est l'inverse des habitudes actuelles, et il faut le garder.

**Edition** : Annuler `Ctrl+Z` · Refaire `Ctrl+A` · — · Copier `Ctrl+C` · Coller `Ctrl+V`.
> Attention : **Ctrl+A = Refaire**, et non « tout sélectionner ».

**Gmac** (macro-langage) : Exécuter… `Ctrl+R` · Insérer dans le menu…

**Groupe** (bibliothèque de blocs, fichiers `.vig`) : Placer… `Ctrl+G` · Enregistrer sous… · Insérer dans le menu…

**Métier** : Changer… · Informations… · Annuler case… · — · liste des menus métiers récents (ex. `C:\GMPCAD\MECA.MEN`).

**Outils** : Conversion DXF vers GMPcad · Conversion GMPcad vers DXF · (Conversion IGES vers GMPcad · Conversion GMPcad vers IGES, grisés).

**Préférences** : Positions des fenêtres ▸ · Couleur du fond ▸ (Blanc / Gris / Noir) · Représentation du trait fort ▸ · Couleur du réticule ▸ · Messages sonores ▸ · Backup automatique…

**Fenêtres** : Mosaïque horizontale · Mosaïque verticale · Cascade · — · liste des sessions ouvertes.

**Aide** : Index… `F1` · Utilisation… · Menu principal… · Module 2D… · — · GMPCAD Vite ! … `Ctrl+I` · — · une entrée ▸ sans libellé visible sous Wine (probablement « Nouveautés… ») · — · Temps de travail… · — · Mise à jour de GMPCAD… · A propos de GMPCAD…

---

## 4. Palette « Menu de Base » (5 lignes × 20 icônes)

Voir `captures/03_palette_menu_de_base.png`. La liste complète, case par case, est dans `listes/palette_menu_de_base.tsv`.

Chaque ligne est **soulignée d'une couleur de famille**. L'aide d'origine regroupe les fonctions de la même façon (`captures/10_aide/aide_sommaire_module_2D.png`) :

| Ligne | Couleur du soulignement | Famille (dans l'aide) | Contenu |
|---|---|---|---|
| 1 | **cyan** | HABILLAGE | Images (insertion, priorité, visibilité, liste) · Textes (ligne, import, reprise et modification des caractéristiques) · **Cotation** (linéaire, en série, superposée, étagée, Ø, diamètre, rayon, angle, tolérances) · Repère de nomenclature · Flèche de coupe · Flèche de désignation |
| 2 | **vert** | CRÉATION | Ellipses (4 méthodes + demi-ellipse) · Polyligne · Courbes (lissage, interpolation, édition des points) · Rectangles (2 points, angles arrondis, 3 points, oblong) · Polygone régulier · Traits d'axe · **Hachures** (zone, reprise, motif, contour, activation) |
| 3 | **vert** | CRÉATION | Segments enchaînés · Demi-droite · Droite · Cercles (centre+Ø, 2 points, tangent) · Arcs (origine+centre+angle, centre+2 points, 3 points) · Chanfrein · Raccordement · Tangente à 2 arcs · Perpendiculaire · Parallèles (tangente à un arc, à distance donnée) · Contour parallèle · Points (type, désignation, équidistants, intersection) |
| 4 | **jaune** | MODIFICATION | Annulation dernière entité · Effacements (partiel 2 points, partie, demi-entité, entité, fenêtre) · Récupération · Éclatement et création de groupe · Désignation de groupe · Placement d'un niveau (translation, rotation) · Déplacement d'un point · Translation · Rotation · Symétrie · Homothétie · Affinité · Changement de niveau/duplication · Modification du type de trait |
| 5 | **rouge** | GESTION | Paramètres de l'application · **Format et échelle du plan** · Nomenclature · Options · Examen d'une entité · Documentation d'une case du menu · `(*)` Repérage sur tous niveaux (sans infobulle dans l'original, nom tiré de l'aide) · Affichage plein format · Fenêtre mémorisée · Zoom · **Types de trait** (continu fort, pointillé fin, mixte fin, continu fin, trait spécial par permutation) · Calage angulaire · Niveau de travail · Grille et origine · Couleur des niveaux · Échelle d'un niveau |

Les icônes font environ 45 × 45 px, sur fond gris clair, avec relief Windows classique et un trait de couleur sous chaque case. Les petits points verts dans les icônes de création montrent les points que l'utilisateur doit désigner.

---

## 5. Menu métier « Mécanique » (bouton MECA)

C'est une palette flottante à deux zones. Voir `captures/06a_palette_mecanique_x3.png` et `captures/06b_bibliotheque_mecanique_defilement.png`.

- **Zone haute (2 × 15) : cotation mécanique.** Tolérances géométriques (parallélisme, perpendicularité, localisation, coaxialité, symétrie, inclinaison, battements, planéité, rectitude, cylindricité, circularité, surface ou ligne quelconque) · surface de référence · état de surface · cote encadrée · ajustements ISO (H8/g6) · cotation par coordonnées · trous taraudés et borgnes · **cotation fonctionnelle** (chaînes de cotes : tracé, régénération, résolution…). Liste : `listes/palette_mecanique_cotation.tsv`.
- **Zone basse défilante (12 lignes × 15) : bibliothèque d'éléments normalisés.** Vis (H, CHc, C, CL, FB90, à bouts divers), goujons, goupilles, écrous (H, Nylstop, à créneaux, à embase, KM), rondelles, anneaux élastiques, **roulements** (billes, contact oblique, rouleaux, aiguilles, butées…), coussinets, joints (à lèvres, toriques, V-RING…), bouts d'arbre, cannelures, clavettes, profilés (rond, carré, hexagonal, plat, tube), engrenages, poutrelles (UAP, UPN, IPE, IPN, HEA/HEB/HEM), cornières, profils T, C, Oméga. Liste : `listes/palette_mecanique_bibliotheque.tsv`.
- Ces éléments sont **paramétriques** : fichiers `.pcd` (macros GMAC) dans `MECA/`. Il faut regarder dans l'original quelles questions chaque élément pose (dimensions, vue…).

Autres menus métiers fournis dans l'installeur (sans doute moins utiles) : CAO Mécanique, F.A.O., Schématique électronique / électrique, Hydro-pneumatique, Habillement (matériaux souples) et Sections, Soudure, NORELEM.

## 6. Palette « Calculs » (bouton CALCULS)

2 × 5 icônes soulignées de **magenta** (`captures/07_palette_calculs_x3.png`) : Périmètre · Surface · Volume d'une plaque · Volume d'un solide de révolution · Centre de gravité · Moment quadratique · Moment quadratique polaire · Moments quadratiques principaux · Moment d'inertie · Distance maxi au centre de gravité.

---

## 7. Dialogues

- **Ouvrir** (`captures/08_dialogues/ouvrir_avec_apercu.png`) : sélecteur Windows standard, avec à droite un panneau **« Caractéristiques du fichier »** qui montre un **aperçu** du dessin, sa **Désignation** et sa **Référence**. Il y a aussi un bouton **Liste**.
- **Nouveau** : la question « Nouvelle session ? » (Oui / Non / Annuler) choisit entre ouvrir une nouvelle fenêtre et réutiliser l'actuelle. Vient ensuite **Paramètres du plan** (`parametres_du_plan.png`) avec le nom d'application, l'éditeur (Société, Département, Service, Dessinateur) et le plan (Désignation, Référence, Révision).
- **Configuration** (programme SETUP séparé, `captures/09_configuration/`) :
  - *Réglage de l'affichage* : mire carré + cercle pour calibrer le rapport hauteur/largeur de l'écran, avec la largeur du côté en mm.
  - *Sélection du menu métier*.
  - *Chemins des fichiers* : applications, GMAC, vignettes, « DocPerso ».
  - *En-têtes de nomenclature* : Société, Département, Service, Dessinateur.
  - *Options* : grille, hachures, images, pièces jointes, points de référence · pas de grille · origine de mesure flottante ou fixe · mise à jour des images · **cotation** : système **AFNOR**, unité mm, cotation unidirectionnelle, fractionnaire, 3 décimales max, hauteur des cotes 3, hauteur des repères 5, police « Gmpcad » · vecteurs de gradation X/Y ou module/angle.
  - *Préférences* : fond Blanc/Gris/Noir · trait fort par luminosité ou 2 pixels · couleur du réticule (Magenta par défaut) · messages sonores · petites ou grandes icônes · police de la zone de dialogue · backup automatique (délai, confirmation) · restrictions.
- La configuration est stockée dans `C:\Windows\GMPCAD.INI` : voir `sources/GMPCAD.INI_apres_configuration.txt`.

---

## 8. Formats, données, sorties

- **Formats de plan** : A4 à A0, horizontal ou vertical (A4H = 297×210, A2H = 594×420, A1H = 840×594…), avec une **échelle du plan**, plus un **cartouche** et une **nomenclature**.
- **Niveaux** : chaque niveau a sa couleur et peut avoir sa propre échelle (palette Gestion). Dans le DXF converti, les entités sont rangées par **catégorie de trait** (calques `AXES`, `FIN`, `MOYEN`, `CACHE`, `COTATION`, `HACHURES`, `TEXTEGROS`), et des calques numérotés (les niveaux GMPCAD) sont aussi déclarés. La correspondance exacte niveau ↔ calque reste **à vérifier**.
- **Types de trait** : continu fort, continu fin, pointillé (caché), mixte fin (axes), trait spécial (fantôme, limite de coupe…). La correspondance avec le DXF est dans `conversion_des_vers_dxf/DXF/desdxf.ins`.
- **Limites de l'original** : 32 752 entités, 96 000 points par dessin.
- **Fichiers** : `.des` = dessin (binaire, nombres flottants 32 bits little-endian) · `.vig` = vignette ou groupe · `.pcd` = macro GMAC · `.men` = définition de menu métier (texte) · `.par` = paramètres.
- **Exports** : HPGL, WMF, PostScript, BMP, DXF (via Outils). Impression par le programme **Traceur** (impression par parcelles, repères de rognage, jeux de couleurs).
- **Backup** manuel (`Ctrl+B`) et automatique.

### 8 bis. Format d'enregistrement : DXF (décidé le 18/11/2026)
L'auteur veut un **format ouvert**, que n'importe quel logiciel puisse ouvrir et modifier. Le logiciel enregistre donc directement en **DXF**, sans format maison.
- Version visée : **DXF R2000 (AC1015)**. Elle est lue et écrite par AutoCAD, LibreCAD, QCAD, DraftSight, FreeCAD et ezdxf. Elle connaît les vraies hachures (entité `HATCH`), les polylignes légères et les blocs avec attributs. La version exacte est à confirmer à l'étape 4, en vérifiant que LibreCAD et QCAD rouvrent les fichiers.
- Correspondances prévues : niveau = calque (avec sa couleur), type de trait = type de ligne, cartouche et nomenclature = blocs avec attributs. Ce qui n'a pas d'équivalent DXF (échelle d'un niveau, paramètres du plan…) va dans des données d'application (XDATA ou dictionnaire) sous un nom propre au logiciel. Un autre logiciel peut ignorer ces données sans casser le dessin.
- **Import** : accepter toutes les versions de **R9 (AC1004)** à R2018, puisque les dessins convertis par DESDXF sont en AC1004.

### Lecture directe des .des ✅ (18/11/2026)
BluePrint CAD lit maintenant les `.des` lui-même (`app/src/renderer/des.ts`), sans DESDXF. Le format a été compris en comparant les 5 dessins d'exemple à leur conversion DXF, sans décompiler aucun programme :
- **Le fichier** est un fichier séquentiel non formaté de Microsoft FORTRAN : octet `K` au début, blocs de 128 octets encadrés par leur longueur (`0x81` = bloc suivi d'un autre), `0x82` à la fin.
- **L'en-tête** contient le cadre, le format (largeur et hauteur), l'unité, l'échelle des 100 niveaux et les textes de l'application (société, désignation, date).
- **Chaque élément** est un enregistrement `[type, niveau, nombre de points, nombre de valeurs]`, suivi des points (x, y) et des valeurs en flottants 32 bits. Les coordonnées partent du centre de la feuille.
- **Les types compris** : 1 segment (valeur = trait : 1 fort, 2 pointillé, 3 mixte, 4 fin), 2 point, 6 cercle ou arc (centre, départ, arrivée + angle, rayon, ouverture, trait), 11 traits d'axe en croix, 13 polyligne ou courbe, 20 texte (la chaîne suit), 30 repère, 39 définition de groupe (éléments locaux qui suivent), 38 placement d'un groupe (point, rotation, échelle, numéro).
- **Les textes** sont en codage français 7 bits : `{` é, `}` è, `@` à, `\` ç, `|` ù, `^` ê, `~` °, `$` Ø.
- **Pas encore compris** : les cotes (types 21 à 27) et les hachures, calculées par GMPCAD à l'affichage, ainsi que le lissage exact des courbes.

### Relire les anciens dessins du grand-père ✅ solution testée
Le convertisseur d'origine **DESDXF.EXE** (programme DOS fourni sur le CD) tourne dans **DOSBox** et transforme un `.des` en **DXF**. Les 5 exemples déclarent la version **AC1004 (R9)** dans leur en-tête, et non R12 comme on le pensait. La structure est très proche de R12, mais certaines bibliothèques refusent les versions antérieures à R12 : l'import doit l'accepter. Les hachures arrivent **découpées en simples traits** sur le calque `HACHURES` (le DXF de cette époque n'a pas d'entité hachure). Une fois importées, elles ne sont donc pas modifiables comme des hachures. C'est testé sur 5 dessins. Le résultat est fidèle : lignes, arcs, cercles, textes, cotes, blocs, hachures et cartouche y sont (comparer `exemples/BROCHE_rendu_du_DXF.png` avec `captures/02b`).
- Il suffit donc que le nouveau logiciel sache **importer le DXF**. Pas besoin de comprendre le format `.des` pour commencer.
- Les accents sont codés `%%130` (é), `%%138` (è)… selon la page de code **DOS 850**. Il faut les décoder à l'import.
- Les paires `.DES` / `.DXF` d'exemple pourront servir plus tard à écrire un lecteur `.des` natif et à le tester.
- Le mode d'emploi est dans `conversion_des_vers_dxf/LISEZMOI.md`.

---

## 9. Proposition de découpage (à valider avec le grand-père)

L'original est très riche, et il ne faut **pas tout refaire d'un coup**. Ordre conseillé :

1. **Squelette de l'interface, à l'identique** : menus, barre gauche, zone de dessin avec cadre de format, ligne de dialogue, tableau de bord, fond et couleurs, réticule plein écran.
2. **Modèle souris et clavier** (section 2) : prélever, repérer, mesurer, origine, Échap, Espace, Maj+clic, saisie numérique, flèches, molette.
3. **Palette de Base**, en commençant par les fonctions qu'il utilise vraiment : segments, cercles, arcs, rectangles, parallèles, raccordements, effacements, cotation linéaire, textes, types de trait, niveaux, zoom.
4. **Ouvrir / enregistrer** en **DXF**, le format natif du logiciel (voir section 8 bis), ce qui couvre aussi l'import de ses anciens dessins convertis.
5. **Impression** à l'échelle (A4/A3) avec cartouche.
6. Ensuite seulement : hachures, cotation mécanique, bibliothèque MECA, calculs, groupes.

**Choix technique (décidé le 18/11/2026)** : **Electron + TypeScript**, dessin en **Canvas 2D**.
- Electron embarque le même moteur (Chromium) sur macOS et sur Windows, donc le comportement est le même sur les deux. Tauri, lui, utilise WebKit sur Mac et WebView2 sur Windows.
- Les icônes redessinées de la maquette (`docs/maquette/icons.py`) sont en SVG et se réutilisent telles quelles.
- L'appli pèse environ 100 Mo, ce qui n'a pas d'importance ici.
- Tests Windows : dans une machine virtuelle sur le Mac de l'auteur. **macOS passe en premier**, Windows est un plus pour une éventuelle diffusion publique.

**État (18/11/2026)** : les étapes 1 à 6 sont faites. Toutes les cases des trois palettes (Base, CALCULS, MECA) ont leur fonction, et toutes les entrées des menus sont branchées. Les choix incertains sont listés en section 9 quater.

---

## 9 bis. Compatibilité macOS et Windows

**Plateforme principale : macOS** (le grand-père y est passé il y a quelques mois). **Windows 10/11** doit aussi être pris en charge. Le comportement doit être identique sur les deux.

### Exigences
- Une appli **native et installable** sur les deux systèmes : `.dmg` ou `.app` pour macOS (Apple Silicon **et** Intel), installeur `.exe`/`.msi` pour Windows. Aucune dépendance à installer à la main.
- **macOS** : sans signature ni notarisation Apple, le système bloque l'appli au premier lancement. Depuis macOS 15, la manipulation « clic droit > Ouvrir » ne suffit plus : il faut aller dans **Réglages Système > Confidentialité et sécurité** et cliquer sur **« Ouvrir quand même »**, une seule fois. L'autre solution est un compte développeur Apple (99 $ par an). **Choix retenu pour l'instant : pas de signature.** L'auteur fait la manipulation une fois sur le Mac du grand-père. À revoir en cas de diffusion publique.
- **Écrans Retina / haute résolution** : traits, icônes et texte doivent rester nets à 100 %, 150 % et 200 %.
- **Polices** : embarquer les polices dans l'appli. Ne pas dépendre de polices installées uniquement sous Windows.
- **Impression** : passer par la boîte d'impression du système, et proposer l'**export PDF** (macOS le fait nativement, Windows via « Microsoft Print to PDF »). L'échelle doit être exacte sur papier dans les deux cas.
- **Fichiers** : mêmes fichiers et même format sur les deux systèmes, pour qu'un dessin fait sur le Mac s'ouvre sur un PC et inversement.
- **Tests** : vérifier chaque fonction sur les deux systèmes avant de la livrer.

### Points de vigilance propres au Mac (importants pour garder les réflexes)
- **Ctrl + clic = clic droit sur Mac.** Le conflit est moins grave qu'on le pensait : **repérer se fait avec la touche Ctrl seule**, sans clic, et aucun geste d'origine n'utilise Ctrl + clic gauche. **Ctrl + clic droit** (changer l'origine) fonctionne normalement sur Mac. L'appli doit quand même lire elle-même le bouton réellement pressé, bloquer le menu contextuel du système sur la zone de dessin, et **ne jamais faire apparaître de menu contextuel** sur un Ctrl + clic gauche. Il faut le tester en priorité.
- **Ctrl + flèches** : sur macOS, ces touches changent de bureau ou ouvrent Mission Control. Le déplacement rapide « Ctrl + flèches » de l'original ne marchera donc pas tel quel. Solution : accepter aussi **Maj + flèches** et **Option + flèches**, ou désactiver ces raccourcis dans Réglages Système > Clavier > Raccourcis > Mission Control.
- **⌘Q, ⌘H, ⌘M** restent aux fonctions du Mac (quitter l'appli, masquer, réduire), même si ⌘ double les raccourcis Ctrl. Ctrl+Q garde le sens d'origine (« Quitter la session »).
- **Souris** : conseiller une **vraie souris à deux boutons avec molette**. Sur une Magic Mouse ou un trackpad, le clic droit et la molette se comportent différemment : clic à deux doigts, défilement inertiel. Le zoom à la molette doit rester contrôlable et ne pas partir tout seul.
- **Raccourcis clavier** : sous Windows, ses réflexes sont Ctrl+O, Ctrl+E, Ctrl+S, Ctrl+Z… Sur Mac, l'usage veut ⌘. **Proposition : sur macOS, accepter les deux** (Ctrl+E **et** ⌘E enregistrent). Il faut lui demander ce qu'il utilise maintenant.
- **Touches F1, F2, F3** : sur les claviers Mac, il faut souvent appuyer sur `fn`. Prévoir une autre façon d'y accéder (menu ou bouton).
- **Barre de menus** : sur macOS, les menus s'affichent normalement en haut de l'écran, pas dans la fenêtre. Garder **les mêmes menus, dans le même ordre et avec les mêmes libellés**, à l'endroit habituel du Mac. Il s'y est déjà fait depuis quelques mois.
- **Touche Échap et barre d'espace** : rien de particulier, elles fonctionnent pareil.

### Anciens dessins
Le convertisseur `.des` → DXF tourne aussi dans DOSBox sur Mac. Voir `conversion_des_vers_dxf/LISEZMOI.md`.

## 9 ter. Thème « Classique » et thème « Moderne »

La maquette compare l'original et une version modernisée de l'écran principal et de la palette « Menu de Base » : https://claude.ai/artifact/Uw4MoF6vogbdQEYuaCDorA (réglages dans « Tweaks » : fond Graphite/Gris/Clair, grandes icônes, couleur du réticule, libellés des familles). Le principe :

**On peut changer :** le rendu (traits lissés, zoom fluide, écrans Retina), le dessin des icônes (redessinées de toute façon), les polices, l'aération des fenêtres et des boîtes de dialogue, la fusion du programme SETUP dans une fenêtre Préférences, l'ajout de l'export PDF, de l'aperçu avant impression, d'une annulation illimitée et d'une sauvegarde automatique fiable.

**On ne change pas :** la place de chaque fonction dans la palette, les 4 couleurs de familles, l'ouverture de la palette par la barre d'espace (et sa fermeture quand la souris en sort), les gestes de souris, les raccourcis, la ligne de dialogue en bas, le tableau de bord, et l'ordre des étapes dans chaque fonction.

On passe d'un thème à l'autre dans les Préférences, sans redémarrer. Au premier lancement, le thème « Moderne » est actif (choix de l'auteur du 18/11/2026) ; « Classique » reste dans Préférences > Thème. Le thème Moderne est clair, sombre, ou comme le système (par défaut), au choix dans le même menu ; le Classique garde l'aspect de l'original.

### Nouveautés ajoutées (18/11/2026, choisies par l'auteur)
Aucune ne change la place d'une fonction, un geste ou un raccourci d'origine ; les entrées de menu ajoutées sont en fin de groupe.
- **Annulation illimitée** : Edition > Annuler / Refaire (Ctrl+Z, Ctrl+A ; aussi ⌘⇧Z / Ctrl+Y). Maj + clic gauche, F9, E1 et E7 gardent le comportement d'origine (dernière entité).
- **Reprise après plantage** : copie du dessin non enregistré quelques secondes après chaque changement, proposée au lancement suivant. Le backup d'origine (toutes les 10 minutes, Fichier > Backup) reste.
- **Aides au tracé** (Préférences > Aides au tracé, coupables) : longueur et angle près du réticule ; carré orange sur le point que Ctrl prendrait. Le clic gauche ne s'y accroche pas : seul Ctrl repère, comme dans l'original.
- **Recherche de fonction** : ⌘K / Ctrl+K, Aide > Rechercher une fonction.
- **Aperçu avant impression** (Fichier > Aperçu plein écran, bouton Traceur), **Exporter** (PDF, PNG, SVG), **Partager** (Fichier > Partager, menu de partage du Mac).
- **Thème Moderne** (Préférences > Thème), clair ou sombre selon le système.
- **Vue 3D** (bouton 3D, Fenêtres > Vue 3D, ⌘3 / Ctrl+3) : extrusion ou révolution des contours fermés en traits continus forts ; axe de révolution = le trait mixte qui court le plus le long de la pièce, ou un axe désigné. Une reconstruction automatique d'une pièce à partir de ses vues n'est pas fiable : on désigne ce qu'on veut mettre en volume.
- **Aperçu dans le Finder** (macOS) : extensions Coup d'œil (aperçu et vignettes) dans l'appli, qui utilisent le même lecteur DXF / .des. **Windows (Explorateur)** : vignettes et volet de visualisation, par une DLL C# installée avec le logiciel, qui exécute le même lecteur dans le moteur JavaScript de Windows ; vérifié dans une machine virtuelle Windows 11.
- **Signaler un problème** (19/11/2026, Aide > Signaler un problème, en fin de menu ; bouton en bas du panneau d'aide) : la personne décrit le problème, choisit de joindre ou non une capture de l'écran et voit tout le rapport avant l'envoi (version, système, thème, format et nombre d'éléments du dessin, fonction en cours, derniers messages, erreur et code BP-xxxxxx). Envoi : page « nouveau ticket » GitHub pré-remplie (il faut un compte GitHub), message pré-rempli à contact@b404.fr, ou copie du rapport. Le rapport et la capture sont gardés dans Documents > BluePrint CAD > Signalements, pour être glissés dans la page ou joints au message. Le dossier personnel et le nom d'utilisateur sont retirés du rapport ; le dessin n'est jamais envoyé ; le logiciel ne contient aucune clé GitHub (c'est la personne qui envoie). Une erreur dans l'interface est annoncée dans la ligne de dialogue avec son code ; un plantage (interface relancée, erreur du programme principal, ou fermeture brutale repérée au lancement suivant grâce aux rapports de plantage gardés sur le disque, jamais envoyés) ouvre de lui-même la fenêtre de signalement.

---

## 9 quater. Choix à faire vérifier par le grand-père (18/11/2026)

Faits sans pouvoir comparer avec l'original en marche. À lui montrer en priorité.

**Construction et modification**
- D11 : un rayon négatif donne l'arc complémentaire ; avec des arcs ou des points, l'arc de raccordement est ajouté sans couper les entités.
- E11 (placement d'un niveau par translation) : R tourne de 15°, X et Y retournent ; pas de Maj + clic gauche (c'est « annuler »), ni de Maj + R à 45°.
- E18 (affinité) : les cercles et arcs deviennent des ellipses (en petits segments) ; une hachure est refaite dans son contour déformé, avec le même écartement.
- Groupes : repère [] à l'écran au point de référence ; « N » pour un groupe éclaté qui a gardé sa désignation. Ils s'enregistrent en DXF dans Documents/BluePrint CAD/Groupes (pas en .VIG).
- Hachures : le contour hachuré est le premier rencontré vers l'Est depuis le point désigné, sur le niveau de travail (règle de l'aide d'origine) ; seuls les traits forts, invisibles et limites de coupe ferment un contour (plus les pointillés). Motifs relevés sur les conversions de l'original : alliages légers en lignes doublées, matières synthétiques avec une deuxième famille à 45° ; alliages cuivreux (une ligne sur deux interrompue), matériaux souples et mousse restent des conventions du dessin industriel, à comparer.
- B11 « superposées » et B12 « étagées » : correspondance avec l'original à confirmer.

**Gestion**
- F7 / touche F3 : les fonctions de modification (ligne 4) ne désignent que sur le niveau de travail « ( ) » ; les autres sur tous les niveaux affichés. À vérifier fonction par fonction.
- F8 affiche tous les niveaux sans demander la liste. F9 : R et P donnent la même vue (pas d'échelle générale du plan) ; les fenêtres nommées sont enregistrées avec le dessin.
- F4 (options) : AFNOR, ISO, ANSI et ARCHI ; changer de système transforme les cotes déjà faites (valeurs, sens d'écriture, flèches ou traits obliques). Pas de choix de police ; options gardées d'une session à l'autre.
- ANSI : pouces décimaux sans zéro devant (.492) ou fractionnaires au 1/64 (3 1/4), sans signe ″ ; les longueurs tapées sont en pouces (3"1/4, 3 1/4, 13/4, 3.95, ou 34.5M pour des mm) quand la question demande une longueur ; hauteurs d'écriture toujours en mm. ARCHI : traits obliques à 45° aux extrémités des cotes. Un changement de système propose le pas de grille de l'aide (1 mm, 1/32", 1/100", 1 cm).
- F20 : les cotes faites ensuite affichent la longueur divisée par l'échelle du niveau ; l'échelle générale du plan (F2) n'est pas faite.
- F15 : la limite de coupe est un trait continu fin ; le trait invisible ne s'imprime jamais (montré en points avec l'option « points de référence »).

**Images (B1 à B4)**
- PNG, JPEG, GIF, BMP, WebP, ICO, SVG (pas TIFF ni WMF) ; taille à l'insertion : 96 pixels par pouce, réduite pour tenir dans les 3/4 du format.
- Plan général : l'image passe sous tous les tracés. La liste (B4) agit tout de suite (Édition > Annuler pour revenir).

**CALCULS**
- Le résultat est copié (⌘V / Ctrl+V le colle dans la ligne de dialogue) au lieu d'aller dans la mémoire de la calculette ; la calculatrice est celle du système.
- Révolution : un profil dessiné des deux côtés de l'axe compte une seule fois. S18 dessine l'ellipse centrale d'inertie (convention de Culmann) et ses axes.
- La barre d'espace n'ouvre que le Menu de Base (l'original passait d'un menu à l'autre).

**MECA**
- Ajustements ISO 286 (H7, g6…) : tables jusqu'à 500 mm ; écarts au dixième de micromètre.
- Trous taraudés : profondeur de taraudage 1,5 d, de perçage + 0,5 d par défaut.
- Cotation fonctionnelle : chaque pièce sur son niveau ; chaîne la plus courte (une cote par pièce) ; s'il y en a plusieurs, la première est gardée. Résolution au pire des cas ; l'IT restant est partagé également entre les cotes inconnues.
- Bibliothèque : représentations simplifiées, dimensions des normes pour les tailles courantes (vis, écrous, rondelles, roulements 60/62/63, profilés). À regarder pièce par pièce, surtout les joints, butées et rotules.

**Anciens dessins .des**
- Cotes, hachures, repères, flèches, flèches de coupe, états de surface, taraudages et arcs d'ellipse redessinés d'après leur définition (comparés aux conversions DXF d'exemple : mêmes valeurs de cotes, hachures presque toutes identiques). La disposition (flèches, écritures, symboles) suit nos conventions, proches mais pas identiques à celles de GMPCAD.
- Codes de trait 5 à 10 : les traits spéciaux de la case F15, dans l'ordre (relevé : 8 = limite de coupe, 10 = invisible).
- Rugosité : symbole et valeur ; état de surface orienté par l'angle du fichier. Taraudages : perçage 0,8 d et filet d, pointe à 120°.

**3D**
- Révolution : les traits cachés (pointillés) à l'intérieur de la pièce découpent le profil ; une zone est de la matière si l'on croise un nombre impair de traits en s'éloignant de l'axe. Un perçage radial (traits perpendiculaires à l'axe seulement) est ignoré.

**Menus**
- Gmac : les fichiers GMAC compilés de l'original (.PCD) ne sont pas lisibles ; ils sont remplacés par des macros en texte qui rejouent les cases (format dans l'Aide et dans `app/src/renderer/gmac.ts`).
- Cases de bibliothèque affectées (groupe ou macro) et cases désactivées : gardées dans les réglages de l'ordinateur, pas dans un fichier .MEN. Un seul menu métier : MECA.
- Outils : .des → DXF par lots (le DXF est écrit à côté de chaque fichier) ; IGES : lignes, arcs, cercles et points, pas les textes.
- Pièces jointes : symbole trombone à l'écran, jamais imprimé, ouvert avec le logiciel associé du système.
- Aide : textes écrits pour ce logiciel ; la fiche d'une case montre ce que la fonction demande. Le panneau « Vite ! » s'ouvre au démarrage tant que sa case reste cochée.

---

## 10. Questions à poser au grand-père

1. Quelles fonctions utilisait-il **tous les jours** ? (lui montrer `captures/03_palette_menu_de_base.png` et cocher)
2. Fond **noir, gris ou blanc** ? Petites ou grandes icônes ?
3. Utilisait-il le menu **MECA** (roulements, vis…) et la **cotation fonctionnelle** ?
4. Format de papier et imprimante habituels ?
5. A-t-il encore ses fichiers **.des** ? (on peut les convertir en DXF tout de suite)
6. Des habitudes particulières : touches, ordre des clics, macros GMAC perso ?
7. Sur son **Mac** : souris ou trackpad ? Quel modèle de Mac (puce Apple ou Intel) et quelle version de macOS ? Utilise-t-il déjà **⌘** pour les raccourcis, ou encore **Ctrl** ?
8. Thème **Moderne** (par défaut depuis le 18/11/2026) ou **Classique** ? (lui montrer les deux ; Préférences > Thème)
9. Idéalement : **le filmer** en train de faire un petit dessin (écran + mains), c'est le meilleur cahier des charges.

---

## Contenu du dossier

```
CAHIER_DES_CHARGES.md          ← ce fichier
captures/                      ← 38 captures de l'original (écran, palettes, menus, dialogues, configuration, aide) — local, non publié
listes/                        ← fonctions de chaque palette, case par case (TSV)
conversion_des_vers_dxf/       ← mode d'emploi ; convertisseur d'origine et 5 exemples .DES/.DXF — local, non publiés
sources/                       ← LISEZMOI d'origine (historique des versions), Nouveautés 2001-2007, GMPCAD.INI — local, non publié
```
