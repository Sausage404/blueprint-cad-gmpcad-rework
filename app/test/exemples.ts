// Dessins d'exemple de l'original (convertis par DESDXF), utilisés par plusieurs tests. Ils appartiennent à
// leurs auteurs et ne sont pas publiés avec le logiciel : sans eux, les tests qui en ont besoin sont sautés.
import { existsSync } from 'node:fs';

export const EXEMPLES = '../docs/reference-gmpcad/conversion_des_vers_dxf/exemples';
export const sansExemples: string | false = existsSync(EXEMPLES) ? false : "dessins d'exemple de l'original absents (non publiés)";
