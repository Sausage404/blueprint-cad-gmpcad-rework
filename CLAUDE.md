# gmpcad-rework

Logiciel de DAO 2D qui reprend l'interface et la façon de travailler de **GMPCAD 2007**, pour un utilisateur habitué à l'original : le grand-père de l'auteur, ancien dessinateur. Le projet est en français, et l'interface du logiciel aussi.

## À lire avant tout travail
1. `docs/reference-gmpcad/README.md` : le point de départ et les décisions prises.
2. `docs/reference-gmpcad/CAHIER_DES_CHARGES.md` : la spécification complète. La section 2 décrit le modèle souris/clavier, la section 9 bis la compatibilité macOS/Windows.
3. `docs/reference-gmpcad/captures/` : les captures de l'original (dossier local, non publié). Il faut les regarder avant de dessiner un écran.
4. `docs/reference-gmpcad/listes/*.tsv` : chaque palette, case par case.
5. La section **2 bis** du cahier des charges résume l'aide d'origine (pointage, Échap, grille, touches F1 à F9…). Le texte complet de l'aide et les messages de la ligne de dialogue (`GM1.MSE`, `GM2.MSE`, `MENUS.MSE`) sont dans `original/`, un dossier local ignoré par git, extrait de l'installeur avec `docs/reference-gmpcad/outils/`. Rien de ce dossier ne doit entrer dans le dépôt.

## Règles du projet
- Le logiciel s'appelle **BluePrint CAD** (choisi par l'auteur le 18/11/2026). Jamais « GMPCAD » (marque déposée).
- **Licence : GNU GPL v3 ou ultérieure** (`LICENSE`), pour qu'il ne puisse pas devenir un logiciel fermé et payant. Le dossier `docs/reference-gmpcad/` contient des éléments de l'original qui ne sont pas sous cette licence.
- On ne reprend **aucun fichier de l'original** (icônes, images, code) et on ne le décompile pas. Les icônes à utiliser sont celles redessinées dans `docs/maquette/icons.py`, ou de nouvelles.
- On garde **à l'identique** : la place de chaque fonction dans les palettes, les 4 couleurs de familles, la palette ouverte par la barre d'espace, les gestes de souris (touche Ctrl seule = repérer, clic gauche = prélever, clic droit = mesurer, Ctrl + clic droit = origine, Maj + clic gauche = annuler, Maj + clic droit = calage), les raccourcis d'origine (Ctrl+E = Enregistrer, Ctrl+A = Refaire…), la ligne de dialogue et le tableau de bord.
- **macOS en priorité**, Windows en plus (testé dans une machine virtuelle), avec une seule base de code. Sur Mac, bloquer le menu contextuel du système sur la zone de dessin, et garder ⌘Q/⌘H/⌘M pour le système (voir section 9 bis).
- **Technique** : Electron + TypeScript, dessin en Canvas 2D, compilation avec esbuild. Le code est dans `app/`.
- **Format d'enregistrement : DXF** (format ouvert, R2000 visé), pas de format maison. Import de R9 (AC1004, sortie de DESDXF) à R2018. Voir section 8 bis.
- Deux thèmes avec le même agencement : « Moderne » (par défaut, choix de l'auteur du 18/11/2026) et « Classique » (au plus près de l'original, dans Préférences > Thème).
- Les anciens dessins arrivent en **DXF AC1004 (R9)**, convertis avec `docs/reference-gmpcad/conversion_des_vers_dxf/`. Les accents y sont codés `%%nnn` (page de code DOS 850).
- Avancer dans l'ordre de la section 9 du cahier des charges, **sans demander de validation entre les étapes** (l'auteur, 18/11/2026) : enchaîner, committer au fur et à mesure, noter les choix incertains dans la doc pour que le grand-père les vérifie, puis faire un bilan. Le dépôt sera rendu public pour que d'autres testent.
