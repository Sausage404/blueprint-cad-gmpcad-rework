# Convertir les dessins GMPCAD (.des) en DXF

> **BluePrint CAD lit directement les `.des`** (Fichier > Ouvrir) et les convertit par lots en DXF (**Outils > Conversion dessin vers DXF**) : le convertisseur d'origine n'est plus nécessaire. Ce mode d'emploi reste pour mémoire. Le dossier `DXF/` (convertisseur d'origine) et les dessins d'`exemples/` appartiennent aux auteurs de GMPCAD : **ils ne sont pas publiés** dans ce dépôt.

Le dossier `DXF/` contient le convertisseur **d'origine** fourni sur le CD de GMPCAD 2007 : `DESDXF.EXE` et ses fichiers. C'est un programme **DOS**. Il ne se lance plus directement sur un Windows récent, mais il marche très bien dans **DOSBox**, un émulateur DOS gratuit. L'éditeur prévoyait d'ailleurs déjà DOSBox (voir `DXF/ddxfdb.bat`).

Il a été testé sur 5 dessins d'exemple (dossier `exemples/`) : lignes, arcs, cercles, textes, cotes, blocs, hachures et cartouche sont conservés.

## Le plus simple
Ouvrir le `.des` dans BluePrint CAD (Fichier > Ouvrir), ou convertir tout un dossier avec **Outils > Conversion dessin vers DXF** : chaque DXF est écrit à côté de son `.des`.

## Le faire soi-même sous Windows
1. Installer **DOSBox** (dosbox.com).
2. Créer un dossier, par exemple `C:\conversion\`, et y copier :
   - le dossier `DXF\` de ce paquet ;
   - les fichiers `.des` à convertir (noms courts de 8 caractères maximum, sans espaces ni accents : DOS ne gère que ça).
3. Dans `C:\conversion\`, créer un fichier `convertir.conf` avec ce contenu (une ligne `DESDXF` par dessin) :

```
[cpu]
cycles=max
[autoexec]
mount c C:\conversion
c:
cd \DXF
DESDXF.EXE C:\BROCHE.DES > NUL
DESDXF.EXE C:\MONPLAN.DES > NUL
exit
```

4. Lancer DOSBox avec ce fichier : `"C:\Program Files (x86)\DOSBox-0.74-3\DOSBox.exe" -conf C:\conversion\convertir.conf -noconsole`
5. Chaque `XXX.DXF` est créé à côté de son `XXX.DES`.

## Le faire soi-même sous macOS
1. Installer **DOSBox Staging** (dosbox-staging.github.io, ou `brew install dosbox-staging`) ou DOSBox (dosbox.com).
2. Créer un dossier `conversion` dans ton dossier personnel, par exemple `/Users/ton_nom/conversion`, et y copier le dossier `DXF` de ce paquet et les fichiers `.des` (mêmes règles de noms courts).
3. Créer `convertir.conf` dans ce dossier, avec le même contenu que pour Windows, sauf la ligne `mount`, qui devient :
   `mount c /Users/ton_nom/conversion`
4. Dans le Terminal : `dosbox -conf /Users/ton_nom/conversion/convertir.conf`
5. Les fichiers `.DXF` apparaissent dans le dossier `conversion`.

Si macOS bloque DOSBox au premier lancement, fais clic droit sur l'appli puis **Ouvrir**.

## Bon à savoir
- Format produit : DXF de version **AC1004 (R9)**, d'après l'en-tête des 5 exemples, très proche du R12. AutoCAD, LibreCAD, DraftSight, FreeCAD, QCAD et la bibliothèque Python `ezdxf` savent le lire.
- **Accents** : ils sont écrits `%%130` (é), `%%138` (è), etc. Le nombre est le code du caractère dans la page de code DOS 850. Un import propre doit les décoder.
- Réglages du convertisseur : `DXF\desdxf.ins` (traduction des hachures, du cadre, correspondance des types de trait). Le chemin `C:\GMPCAD\APP\` qu'on y trouve n'a pas d'incidence quand on donne le chemin complet du fichier.
- Le chemin inverse existe aussi (`DXFDES.EXE`, DXF vers .des), mais il n'a pas été testé.
