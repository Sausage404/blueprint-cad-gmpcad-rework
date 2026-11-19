# Projet « GmpCAD rework » — point de départ

**But :** recréer pour le grand-père de l'auteur (ancien dessinateur) un logiciel de DAO 2D qui reprend **l'interface, les menus et la façon de travailler de GMPCAD 2007**. GMPCAD est un logiciel français de l'IUT de Cachan, distribué par Soft Diffusion et arrêté vers 2009. L'objectif est qu'il ne soit pas perdu.

## Décisions déjà prises
- Un **nouveau logiciel écrit de zéro** : on ne reprend pas de code de GMPCAD et on ne le décompile pas.
- Le logiciel s'appelle **BluePrint CAD** (18/11/2026). Jamais « GMPCAD » (marque déposée).
- **Licence** : GNU GPL v3 (18/11/2026).
- **Toutes les icônes sont redessinées.** On garde leur place, leur idée et la couleur de leur famille.
- On garde **à l'identique** : la place des fonctions, les 4 couleurs de familles, la palette ouverte par la barre d'espace, les gestes de souris, les raccourcis (même Ctrl+E = Enregistrer), la ligne de dialogue et le tableau de bord.
- **macOS en priorité** (le grand-père y est passé), **Windows** aussi, avec une seule base de code.
- **Deux thèmes** avec le même agencement : « Moderne » (actif au premier lancement, choix de l'auteur du 18/11/2026) et « Classique » (proche de l'original, dans Préférences > Thème).
- Les anciens dessins `.des` se convertissent en **DXF** avec le convertisseur d'origine dans DOSBox (testé). Le nouveau logiciel doit donc savoir **importer du DXF**.
- **Technique** (18/11/2026) : Electron + TypeScript, dessin en Canvas 2D. Windows est testé dans une machine virtuelle. On garde Electron : Tauri (Rust) donnerait un installeur plus léger, mais pas un dessin plus rapide, et demanderait de réécrire menus, fichiers et impression. À revoir après les retours du grand-père.
- **Format d'enregistrement** (18/11/2026) : **DXF**, un format ouvert que d'autres logiciels peuvent modifier. Pas de format maison.
- **Signature Apple** : pas pour l'instant. On autorise l'appli une fois dans Réglages Système > Confidentialité et sécurité.

## Documents de ce projet
| Document | Contenu |
|---|---|
| `reference-gmpcad/CAHIER_DES_CHARGES.md` | **Le document principal** : écran, modèle souris/clavier, menus, palettes, dialogues, formats, compatibilité Mac/Windows, thèmes, ordre de développement, questions au grand-père. |
| `reference-gmpcad/listes/palette_menu_de_base.tsv` | Les 100 fonctions de la palette principale, case par case (ligne, colonne, famille). |
| `reference-gmpcad/listes/palette_mecanique_cotation.tsv` | Palette Mécanique, partie cotation (tolérances, cotation fonctionnelle…). |
| `reference-gmpcad/listes/palette_mecanique_bibliotheque.tsv` | Palette Mécanique, bibliothèque de pièces normalisées (vis, roulements, joints, profilés…). |
| `reference-gmpcad/listes/palette_calculs.tsv` | Palette Calculs (périmètre, surface, inerties…). |
| `reference-gmpcad/conversion_des_vers_dxf/LISEZMOI.md` | Convertir les `.des` en DXF avec DOSBox (Windows et macOS). |
| `reference-gmpcad/sources/LISEZMOI_GMPCAD_2007F.txt` | Historique officiel des versions 95 à 2007 : beaucoup de détails de comportement. |
| `reference-gmpcad/sources/NOUVEAUTES_2001_2007.txt` | Nouveautés 2001-2007 (copier/coller, placement, images, hachures…). |
| `reference-gmpcad/sources/GMPCAD.INI_apres_configuration.txt` | Fichier de configuration de l'original, avec ses valeurs par défaut. |

## Maquette
Comparaison original / version modernisée (écran principal et palette « Menu de Base ») : https://claude.ai/artifact/Uw4MoF6vogbdQEYuaCDorA

## Fichiers non textuels (captures, convertisseur, exemples)

> Ces fichiers, ainsi que les textes du dossier `sources/`, viennent de l'original et appartiennent à ses auteurs. **Ils ne sont pas publiés dans le dépôt** (voir `.gitignore`) : l'auteur les garde en local. Les tests qui utilisent les dessins d'exemple sont sautés quand ils sont absents.
Le projet claude.ai ne contient que les documents texte. Le dossier complet est dans le **dépôt GitHub `Sausage404/gmpcad-rework`**, sous `docs/reference-gmpcad/`, et dans l'archive `reference-gmpcad.zip` :
- `captures/` : 38 captures d'écran de l'original (écran, palettes, menus, dialogues, configuration, aide). **Indispensables pour reproduire l'interface.**
- `conversion_des_vers_dxf/DXF/` : le convertisseur d'origine (DESDXF.EXE et ses fichiers).
- `conversion_des_vers_dxf/exemples/` : 5 paires `.DES` / `.DXF` pour les tests d'import.

Les sources de la maquette (dont le jeu de 100 icônes redessinées, en SVG) sont dans le dépôt sous `docs/maquette/`.

## Prochaines étapes
1. Montrer la palette et la maquette au grand-père : quelles fonctions il utilise tous les jours, quel fond, souris ou trackpad, ⌘ ou Ctrl.
2. Récupérer ses fichiers `.des` et les convertir en DXF.
3. Lancer le développement dans l'ordre de la section 9 du cahier des charges.
