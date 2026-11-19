# BluePrint CAD

**BluePrint CAD** est un logiciel libre de DAO 2D (dessin technique) sur le modèle de **GMPCAD 2007**, avec la même interface et la même façon de travailler, pour macOS et Windows.

> [!WARNING]
> Je ne prétends pas être développeur. J'ai simplement voulu remettre un vieux logiciel au goût du jour, en me faisant aider par une IA.

- Point de départ : [`docs/reference-gmpcad/README.md`](docs/reference-gmpcad/README.md)
- Cahier des charges : [`docs/reference-gmpcad/CAHIER_DES_CHARGES.md`](docs/reference-gmpcad/CAHIER_DES_CHARGES.md)
- Maquette : [`docs/maquette/`](docs/maquette/README.md) et https://claude.ai/artifact/Uw4MoF6vogbdQEYuaCDorA

- Le logiciel : [`app/`](app/README.md) (Electron + TypeScript). Étapes 1 à 5 du cahier des charges faites : interface, souris et clavier, fonctions principales de la palette, DXF, impression.
- **Télécharger** : page [Releases](https://github.com/Sausage404/blueprint-cad-gmpcad-rework/releases) (Mac à puce Apple `-arm64.dmg`, Mac Intel `-x64.dmg`, Windows `.exe`).
- **Installer et tester** : [`docs/TESTER.md`](docs/TESTER.md). Les installeurs sont fabriqués par GitHub (onglet Actions, « Installeurs ») ou localement avec `npm run dist:mac` dans `app/`.
- **Signaler un problème** : dans le logiciel, **Aide > Signaler un problème**, ou directement dans l'onglet [Issues](https://github.com/Sausage404/blueprint-cad-gmpcad-rework/issues).

## Licence
BluePrint CAD est un **logiciel libre** distribué sous la licence **GNU GPL version 3 ou ultérieure** (voir [`LICENSE`](LICENSE)). Chacun peut l'utiliser, l'étudier, le modifier et le redistribuer. Toute version modifiée et diffusée doit rester sous la même licence, avec son code source : BluePrint CAD ne peut pas devenir un logiciel fermé et payant. Il est fourni **sans aucune garantie**.

Le dossier `docs/reference-gmpcad/` contient la description de l'original (cahier des charges, listes des palettes, outils). Les fichiers de l'original lui-même (captures d'écran, textes et programmes du CD de GMPCAD 2007, dessins d'exemple) ont servi de référence mais **ne sont pas publiés ici** : ils appartiennent à leurs auteurs. GMPCAD est une marque déposée de l'IUT de Cachan. BluePrint CAD n'a aucun lien avec ses auteurs ; il ne reprend aucun fichier ni aucun code de l'original.
