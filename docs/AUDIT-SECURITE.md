# Audit de sécurité de BluePrint CAD

Revue du logiciel « comme un attaquant », le 19/11/2026, sur la version installée (dépôt à `bed153d`).
BluePrint CAD est un logiciel de dessin **local** : il n'a pas de serveur, pas de compte, pas de connexion
réseau. La principale porte d'entrée d'un attaquant est donc **un fichier de dessin (DXF ou .des) ou une
macro piégés**, qu'une victime ouvrirait ou simplement survolerait dans le Finder.

## Ce qui est déjà solide

L'ossature Electron est bien verrouillée, ce qui écarte d'emblée les attaques les plus graves (exécution de
code par une page) :

- **Pas d'intégration Node dans l'interface** (`nodeIntegration: false`), **isolation du contexte**
  (`contextIsolation: true`) et **bac à sable** (`sandbox: true`) : une page ne peut pas toucher au système.
- **Navigation bloquée** (`will-navigate` refusé) et **aucune nouvelle fenêtre** (`setWindowOpenHandler` →
  `deny`) : un dessin ne peut pas faire naviguer l'appli vers un site.
- **Content-Security-Policy** dans l'interface (`script-src 'self'`) : pas de script en ligne.
- **Ouverture de liens externes verrouillée** : `shell.openExternal`, le vecteur le plus dangereux d'Electron,
  n'est utilisé que par « Signaler un problème » (ajouté après l'audit, le 19/11/2026), et seulement vers deux
  adresses **fixées dans le programme principal** : la page « nouveau ticket » du dépôt GitHub et
  `mailto:contact@b404.fr`. L'interface ne transmet que le titre et le texte, encodés dans le lien ; elle ne
  peut pas choisir l'adresse (testé : un titre piégé ne change pas la page ouverte, un mode inconnu est refusé).
  Le logiciel ne contient **aucune clé GitHub** : c'est la personne qui relit et envoie le ticket ou le message.
  Les rapports de plantage (Crashpad) restent **sur le disque, jamais envoyés** ; on signale seulement qu'il y en
  a eu un. Le dossier personnel et le nom d'utilisateur sont retirés des rapports.
- **Pont `preload` minimal** : l'interface ne reçoit que des fonctions précises, pas d'accès disque arbitraire.
- **Fenêtre d'impression** isolée, **sans JavaScript** (`javascript: false`).
- Le seul lancement de programme (`spawn`) est la **calculatrice** du système, avec des commandes **fixes**
  (`calc.exe`, `gnome-calculator`, Calculator.app) sans aucune entrée de l'utilisateur : pas d'injection.
- Les **textes** des dessins sont échappés avant d'entrer dans le SVG.

## Points corrigés dans cet audit

| # | Gravité | Point | Correction |
|---|---------|-------|-----------|
| 1 | **Moyen** | **Injection par les données d'image.** Un DXF falsifié pouvait stocker, à la place d'une image, du balisage (`<foreignObject>`, `<script>`). Ce balisage ressortait dans l'aperçu « Coup d'œil » du Finder, qui affiche du HTML dans un WebView **sans CSP** → du script pouvait s'exécuter. L'impact restait **borné** (l'extension tourne en **bac à sable**, sans accès réseau ni aux autres fichiers), mais c'est une exécution de code à partir d'un simple survol de fichier. | À la lecture d'un DXF, on n'accepte plus que des « data URL » base64 d'un **type d'image connu** ; tout le reste est vidé. |
| 2 | **Moyen** | **Aperçu Coup d'œil sans CSP.** La page HTML de l'aperçu macOS n'avait aucune politique de sécurité. | Ajout d'une **CSP** `default-src 'none'` (images `data:` et styles en ligne seulement) : plus aucun script ni accès réseau, même si du balisage passait. |
| 3 | **Faible** | **« Bombe » de blocs.** Un DXF peut définir des blocs qui s'insèrent les uns dans les autres ; 12 insertions sur 12 niveaux = des milliards de traits. La lecture pouvait bloquer le logiciel (déni de service). Le plafond existant ne portait que sur la **profondeur**, pas sur le **total**. | **Plafond du nombre de traits** produits à la lecture (500 000). |
| 4 | **Faible** | **Href d'image non échappé** dans le SVG exporté. | Le `href` est désormais **échappé** (défense en profondeur, en plus du point 1). |
| 5 | **Faible** | **Pièces jointes.** Une pièce jointe ouvre un fichier dans le logiciel du système ; son chemin vient du dessin. Un dessin falsifié pouvait pointer vers un **programme** (`.exe`, `.app`, script), ouvert sans avertissement. Vecteur d'ingénierie sociale (la victime doit « consulter » la pièce jointe). | L'ouverture **demande confirmation** en affichant le **chemin réel**. |

Tous ces correctifs sont couverts par des tests (`app/test/securite.test.ts`), et les 126 tests passent.

## Points restants (durcissement, non bloquants)

- **Signature de l'application.** L'appli n'est **pas signée** par un certificat Apple/Microsoft (signature
  ad hoc). C'est connu et documenté pour les testeurs (« Ouvrir quand même »), mais pour une diffusion large
  il faudra une signature et une **notarisation** Apple, sinon macOS avertit à chaque téléchargement.
- **Fusibles Electron (« fuses »).** Les options comme `RunAsNode` restent par défaut. Un attaquant qui a
  **déjà** un accès local pourrait lancer le binaire comme interpréteur Node (`ELECTRON_RUN_AS_NODE`). Risque
  faible (il faut déjà exécuter du code sur la machine), mais désactiver ces fusibles est un durcissement utile.
- **Dépendances.** Electron 45, Three.js 0.187. À tenir **à jour** : les correctifs de sécurité d'Electron
  (moteur Chromium) sont la principale raison de mettre à jour régulièrement.
- **Taille des images intégrées.** Une image lue depuis un fichier est plafonnée à 25 Mo, mais une image déjà
  **intégrée** dans un DXF n'a pas de plafond de taille à la lecture. Sans gravité (au pire, mémoire utilisée).

## Côté Windows

L'aperçu dans l'Explorateur de Windows est un mécanisme **complètement différent** de celui du Finder : ce
n'est pas Electron, mais une DLL .NET (`BluePrintApercu.dll`) chargée par l'Explorateur, qui exécute le
lecteur de dessins avec le moteur JavaScript de Windows (Chakra), puis **dessine les traits et les textes
directement avec GDI+** (dessin natif). Conséquences pour la sécurité :

- **Les injections #1 et #2 ne concernent pas Windows.** L'aperçu Windows ne produit **jamais** de HTML ni de
  SVG : il reçoit une liste de traits et de textes et les trace lui‑même. Les **images intégrées ne sont même
  pas transmises** à l'aperçu Windows. Il n'y a donc pas de page web, pas de WebView, pas de balisage à
  injecter. Les textes sont tracés **littéralement** (jamais interprétés) et les nombres sont lus en culture
  invariante (pas de souci avec le séparateur décimal français).
- **La « bombe » de blocs (#3) est couverte** : l'aperçu Windows passe par le même lecteur DXF, donc le
  plafond de traits s'applique — **une fois les installeurs refaits** (le moteur embarqué dans la DLL doit être
  recompilé).
- **La confirmation des pièces jointes (#5) protège surtout Windows** : c'est le logiciel lui‑même (commun aux
  deux systèmes) qui ouvre la pièce jointe, et sous Windows ouvrir un `.exe` ou un `.lnk` **l'exécute**
  directement. La confirmation avec le chemin réel est donc encore plus utile ici.
- **Robustesse** : la DLL lit le flux du fichier avec un **plafond de 64 Mo**, et un fichier illisible ou
  fabriqué est **attrapé** (l'aperçu affiche « Aperçu impossible » au lieu de planter l'Explorateur).
- **Pas d'exécution de code par un fichier** : le moteur Chakra n'exécute que **notre** lecteur ; le contenu du
  dessin n'est que de la donnée passée à ce lecteur, jamais du code.

Points d'attention propres à Windows (durcissement, non exploitables) :

- **`DisableLowILProcessIsolation = 1`** : pour que le dessin s'affiche, l'aperçu tourne au niveau d'intégrité
  normal de l'utilisateur au lieu du processus isolé « basse intégrité » que l'Explorateur met d'habitude
  autour de l'aperçu d'un fichier inconnu. C'est un compromis nécessaire au rendu ; le risque reste limité
  parce que notre aperçu ne fait que **lire et dessiner** (flux plafonné, erreurs attrapées, pas d'exécution).
- **Inscription par utilisateur (HKCU), sans droits administrateur** : bon point, l'installation ne touche pas
  tout le système et se **désinstalle proprement** (vérifié dans la VM).
- **Moteur Chakra** (`chakra.dll`) : composant hérité de Windows, qui ne reçoit plus de mises à jour. Nous ne
  lui faisons exécuter que notre propre code, donc le risque est faible, mais c'est une brique non maintenue.
- **Installeur non signé** → avertissement SmartScreen au premier lancement (déjà documenté pour les testeurs).

En résumé, **Windows n'ajoute aucune faille nouvelle** : il échappe par conception aux deux points les plus
sérieux (il ne fait pas de HTML), et il profite des mêmes correctifs pour le reste. Le seul geste nécessaire
est de **refaire les installeurs** pour que le plafond de traits soit embarqué dans la DLL.

## Conclusion

Aucune faille permettant une **prise de contrôle de la machine** à distance ou par un simple fichier n'a été
trouvée : l'ossature Electron est bien fermée. Les points traités concernaient surtout l'**aperçu dans le
Finder** et la **robustesse** face à des fichiers fabriqués exprès. Les durcissements restants (signature,
fusibles, mises à jour) relèvent de la préparation à une diffusion publique, pas d'un défaut exploitable
aujourd'hui.
