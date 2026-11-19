// Types de trait : les quatre traits des cases F11 à F14, et les six traits « spéciaux » de la case F15
// (aide d'origine, « Trait spécial » : mixte fort, mixte 2 tirets, mixte 3 tirets, limite de coupe,
// pointillé long, invisible). Tout ce qui dépend du trait est ici : écran, papier, DXF, nom affiché.
import type { Trait } from './dessin';

export interface DefinitionTrait {
  /** Trait fort (épais) ou fin. */
  fort: boolean;
  /** Motif à l'écran, en pixels (tiret, espace…). */
  ecran: number[];
  /** Motif sur le papier, en mm (SVG stroke-dasharray), vide : continu. */
  papier: string;
  /** Type de ligne DXF. */
  ligne: string;
  /** Nom court du tableau de bord. */
  court: string;
  /** Nom dans les messages. */
  nom: string;
}

export const TRAITS: Record<Trait, DefinitionTrait> = {
  'continu-fort': { fort: true, ecran: [], papier: '', ligne: 'CONTINUOUS', court: 'Cont. fort', nom: 'continu fort' },
  'pointille-fin': { fort: false, ecran: [6, 4], papier: '3 1.5', ligne: 'DASHED', court: 'Point. fin', nom: 'pointillé fin' },
  'mixte-fin': { fort: false, ecran: [14, 3, 2, 3], papier: '8 1.5 1 1.5', ligne: 'CENTER', court: 'Mixte fin', nom: 'mixte fin' },
  'continu-fin': { fort: false, ecran: [], papier: '', ligne: 'CONTINUOUS', court: 'Cont. fin', nom: 'continu fin' },
  'mixte-fort': { fort: true, ecran: [14, 3, 2, 3], papier: '8 1.5 1 1.5', ligne: 'CENTER', court: 'Mixte fort', nom: 'mixte fort' },
  'mixte-fin-2': { fort: false, ecran: [14, 3, 2, 3, 2, 3], papier: '8 1.5 1 1.5 1 1.5', ligne: 'PHANTOM', court: 'Mixte 2 tr', nom: 'mixte fin 2 tirets' },
  'mixte-fin-3': { fort: false, ecran: [14, 3, 2, 3, 2, 3, 2, 3], papier: '8 1.5 1 1.5 1 1.5 1 1.5', ligne: 'MIXTE3', court: 'Mixte 3 tr', nom: 'mixte fin 3 tirets' },
  'limite-coupe': { fort: false, ecran: [], papier: '', ligne: 'CONTINUOUS', court: 'Lim. coupe', nom: 'limite de coupe' },
  'pointille-long': { fort: false, ecran: [12, 4], papier: '6 2', ligne: 'DASHED2X', court: 'Ptllé long', nom: 'pointillé long' },
  invisible: { fort: false, ecran: [1, 4], papier: '', ligne: 'CONTINUOUS', court: 'Invisible', nom: 'invisible' },
};

export const LISTE_TRAITS = Object.keys(TRAITS) as Trait[];

/** Ordre de la case F15 : chaque appui passe au suivant. */
export const TRAITS_SPECIAUX: Trait[] = ['mixte-fort', 'mixte-fin-2', 'mixte-fin-3', 'limite-coupe', 'pointille-long', 'invisible'];

/** Trait spécial suivant : le premier appui reprend le dernier choisi (mixte fort au début de la session). */
export function traitSpecialSuivant(courant: Trait, dernier: Trait | null): Trait {
  const i = TRAITS_SPECIAUX.indexOf(courant);
  if (i < 0) return dernier && TRAITS_SPECIAUX.includes(dernier) ? dernier : TRAITS_SPECIAUX[0];
  return TRAITS_SPECIAUX[(i + 1) % TRAITS_SPECIAUX.length];
}

/**
 * Traits pris en compte pour reconnaître un contour (hachures, calculs) : d'après l'aide d'origine, les traits
 * forts, les traits invisibles et les limites de coupe (pas les traits interrompus des arêtes cachées).
 */
export const TRAITS_CONTOUR: Trait[] = ['continu-fort', 'limite-coupe', 'invisible'];
