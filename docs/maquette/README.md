# Maquette de l'interface modernisée

Maquette en ligne : https://claude.ai/artifact/Uw4MoF6vogbdQEYuaCDorA

Elle compare l'original (GMPCAD 2007) et la version modernisée de l'écran principal et de la palette « Menu de Base ».

## Contenu
- `icons.py` : **les 100 icônes de la palette « Menu de Base », redessinées** en SVG 24 × 24 (traits `currentColor`, 1,6 px). Il y a aussi les icônes de la barre de gauche (`LEFT`) et du tableau de bord (`UI`). `BASE[ligne][colonne]` suit exactement l'ordre de la palette d'origine (voir `docs/reference-gmpcad/listes/palette_menu_de_base.tsv`). Les points à désigner (`D(...)`) prennent la couleur de la famille via la variable CSS `--fam`.
- `gen_main.py`, `gen_palette.py` : génèrent les planches de la maquette.
- `*.dc.html`, `canvas.json` : les planches telles que publiées.
- `assets/` : le plan d'exemple BROCHE rendu depuis le DXF converti, en version fond sombre et fond clair.

Ces icônes sont des dessins originaux (pas des copies de l'original). Elles peuvent servir de base au vrai logiciel.

## Couleurs des familles (thème moderne)
| Famille | Lignes de la palette | Trait | Texte |
|---|---|---|---|
| Habillage | 1 | `#0e9fb3` | `#0b6f7d` |
| Création | 2 et 3 | `#1f9d55` | `#1b7a43` |
| Modification | 4 | `#d4a200` | `#7d5c00` |
| Gestion | 5 | `#e5484d` | `#b5232a` |
