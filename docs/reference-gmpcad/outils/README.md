# Lire les fichiers de l'installeur d'origine

L'installeur de GMPCAD 2007 F (`GMPCADV2007F.zip`) contient des fichiers compressés au format Microsoft **KWAJ** : leur extension se termine par `_` (`GMPFRA.HL_`, `MECA.ME_`…). Ces deux scripts Python permettent de les **lire sans rien exécuter** de l'installeur. On ne fait pas de décompilation : on lit seulement l'aide et les fichiers texte.

| Script | Rôle |
|---|---|
| `kwaj.py` | Décompresse un fichier KWAJ (méthodes 0 à 3, dont « LZ + Huffman »). |
| `hlp.py` | Extrait en texte brut les rubriques d'un fichier d'aide WinHelp (`.HLP`, versions 3.1 et 4). |

## Exemple
```bash
mkdir -p /tmp/gmpcad && cd /tmp/gmpcad && unzip ~/Downloads/GMPCADV2007F.zip
python3 -I kwaj.py GMPFRA.HL_ GMPFRA.HLP
python3 -I hlp.py GMPFRA.HLP GMPFRA.txt
```

## Où sont les fichiers extraits
Ils sont dans le dossier `original/` à la racine du projet, que git ignore. **Ils ne doivent jamais entrer dans le dépôt**, ni être livrés avec le logiciel.
- `original/aide/GMPFRA.txt` : l'aide en ligne française, avec ses 224 rubriques.
- `original/fichiers/` : les menus métiers (`.MEN`), les messages de la ligne de dialogue (`.MSE`), les paramètres (`.PMS`) et les fichiers `.INI`.

## Bon à savoir
- **Messages de la ligne de dialogue** : ils sont dans `GM1.MSE`, `GM2.MSE` et `MENUS.MSE`, en français et en anglais, avec un numéro. Par exemple, `0311/Segment de droite. D{signer un point.#`.
- **Accents de ces fichiers** : ils utilisent un vieux codage où `{` = é, `}` = è, `@` = à, `^` = ê et `\` = ç. Les caractères `|`, `[` et `]` y servent aussi de séparateurs.
- **Images de l'aide** : les icônes et les touches y sont des images (`|bm…`), absentes du texte extrait. Il manque donc parfois le nom d'une touche, signalé dans le cahier des charges par « touche non lisible dans l'aide ».
- **Fichier `GMPUSA.HL_`** (aide anglaise) : il est abîmé dans l'archive (erreur de CRC à la décompression du zip).
