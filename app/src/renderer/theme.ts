// Couleurs du thème « Classique », relevées pixel par pixel sur les captures de l'original
// (01 fond gris, 02b fond noir, 02c fond blanc).
import type { Fond, Prefs } from '../shared/types';

export interface CouleursDessin {
  fond: string;
  bordure: string; // bordure de la zone de dessin (session active)
  cadre: string; // double trait du format
  ombre: string; // ombre du cadre, en bas et à droite
  reticule: string;
}

// Thème « Moderne » (maquette, docs/maquette) : fonds Graphite, Gris et Clair, réticule magenta.
const PAR_FOND_MODERNE: Record<Fond, CouleursDessin> = {
  gris: { fond: '#6b7079', bordure: '', cadre: '#ffffff', ombre: '#4f535a', reticule: '#f2b8ff' },
  noir: { fond: '#1d2126', bordure: '', cadre: '#e6e8eb', ombre: '#000000', reticule: '#e040fb' },
  blanc: { fond: '#f4f4f1', bordure: '', cadre: '#1d1f23', ombre: '#c3c7ce', reticule: '#b026c8' },
};

const PAR_FOND: Record<Fond, CouleursDessin> = {
  gris: { fond: '#808080', bordure: '#00ff00', cadre: '#ffffff', ombre: '#c0c0c0', reticule: '#bfbfbf' },
  noir: { fond: '#000000', bordure: '#00ff00', cadre: '#ffffff', ombre: '#808080', reticule: '#808080' },
  blanc: { fond: '#ffffe8', bordure: '#00c000', cadre: '#000000', ombre: '#808080', reticule: '#808097' },
};

const RETICULE: Record<Exclude<Prefs['reticule'], 'standard'>, string> = {
  magenta: '#ff00ff',
  cyan: '#00c0c0',
  jaune: '#e0c000',
};

export function couleursDessin(prefs: Prefs): CouleursDessin {
  const c = { ...(prefs.theme === 'moderne' ? PAR_FOND_MODERNE : PAR_FOND)[prefs.fond] };
  if (prefs.reticule !== 'standard') c.reticule = RETICULE[prefs.reticule];
  return c;
}

/** Familles de la palette « Menu de Base » : soulignement de chaque ligne (capture 03). */
export const FAMILLES = [
  { nom: 'Habillage', souligne: '#00ffff', point: '#008080' },
  { nom: 'Création', souligne: '#00ff00', point: '#00a000' },
  { nom: 'Création', souligne: '#00ff00', point: '#00a000' },
  { nom: 'Modification', souligne: '#ffff00', point: '#a08000' },
  { nom: 'Gestion', souligne: '#ff0000', point: '#c00000' },
];

/** Familles dans le thème « Moderne » (maquette) : `souligne` = barre de couleur, `point` = texte et points. */
export const FAMILLES_MODERNES = [
  { nom: 'Habillage', souligne: '#0e9fb3', point: '#0b6f7d' },
  { nom: 'Création', souligne: '#1f9d55', point: '#1b7a43' },
  { nom: 'Création', souligne: '#1f9d55', point: '#1b7a43' },
  { nom: 'Modification', souligne: '#d4a200', point: '#7d5c00' },
  { nom: 'Gestion', souligne: '#e5484d', point: '#b5232a' },
];

export function familles(theme: Prefs['theme']): typeof FAMILLES {
  return theme === 'moderne' ? FAMILLES_MODERNES : FAMILLES;
}
