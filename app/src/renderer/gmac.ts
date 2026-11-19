// Macros (menu Gmac) : un fichier texte qui rejoue des cases de la palette avec des points et des valeurs,
// en fonction de paramètres demandés à l'utilisateur. Le dessin obtenu se place comme un groupe (point de
// référence, orientation), comme les éléments paramétrés de l'original (« Gmac - Exécuter »).
// Les fichiers GMAC compilés de l'original (.PCD) ne sont pas lisibles : ce format les remplace.
//
// Exemple (plaque.gmac) :
//   # Plaque percée
//   designation "Plaque $L x $H"
//   parametre L "Longueur" 80
//   parametre H "Hauteur" 50
//   parametre D "Diamètre du trou" 10
//   case C10                 # rectangle par deux sommets
//   point 0 0
//   point $L $H
//   case D4                  # cercle : centre, puis diamètre
//   point $L/2 $H/2
//   valeur $D
//
// Instructions : case CODE, point X Y, valeur V (ou « valeur texte … »), entree, echap,
// parametre NOM "question" défaut, designation "texte". Les nombres acceptent + - * / ( ) et $NOM.
import { Dessin, type Entite, type Trait } from './dessin';
import { creerFonction, type Contexte } from './fonctions';
import type { Pt } from './geometrie';

export interface Parametre {
  nom: string;
  question: string;
  defaut: number;
}

export type Instruction =
  | { op: 'case'; code: string; ligne: number }
  | { op: 'point'; x: string; y: string; ligne: number }
  | { op: 'valeur'; v: string; texte: boolean; ligne: number }
  | { op: 'entree'; ligne: number }
  | { op: 'echap'; ligne: number };

export interface Macro {
  parametres: Parametre[];
  designation: string;
  instructions: Instruction[];
}

/** Découpe une ligne en mots ; un texte entre guillemets est un seul mot. */
function mots(ligne: string): string[] {
  return [...ligne.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]);
}

/** Lit le texte d'une macro ; lève une erreur « ligne n : … » si une instruction est inconnue. */
export function lireMacro(texte: string): Macro {
  const m: Macro = { parametres: [], designation: '', instructions: [] };
  texte.split(/\r?\n/).forEach((brute, i) => {
    const ligne = i + 1;
    const l = brute.replace(/#.*/, '').trim();
    if (!l) return;
    const [op, ...args] = mots(l);
    switch (op.toLowerCase()) {
      case 'parametre':
      case 'paramètre':
        if (!args[0]) throw new Error(`ligne ${ligne} : nom du paramètre manquant`);
        m.parametres.push({ nom: args[0], question: args[1] ?? args[0], defaut: Number(args[2] ?? 0) || 0 });
        return;
      case 'designation':
      case 'désignation':
        m.designation = args.join(' ');
        return;
      case 'case':
        if (!args[0]) throw new Error(`ligne ${ligne} : code de case manquant`);
        m.instructions.push({ op: 'case', code: args[0].toUpperCase(), ligne });
        return;
      case 'point':
        if (args.length < 2) throw new Error(`ligne ${ligne} : point X Y attendu`);
        m.instructions.push({ op: 'point', x: args[0], y: args[1], ligne });
        return;
      case 'valeur':
        if (args[0]?.toLowerCase() === 'texte') m.instructions.push({ op: 'valeur', v: args.slice(1).join(' '), texte: true, ligne });
        else m.instructions.push({ op: 'valeur', v: args.join(''), texte: false, ligne });
        return;
      case 'entree':
      case 'entrée':
        m.instructions.push({ op: 'entree', ligne });
        return;
      case 'echap':
      case 'échap':
        m.instructions.push({ op: 'echap', ligne });
        return;
      default:
        throw new Error(`ligne ${ligne} : instruction inconnue « ${op} »`);
    }
  });
  return m;
}

/** Expression numérique : nombres, $NOM, + - * / et parenthèses (sans `eval`). */
export function calculer(expr: string, valeurs: Record<string, number>): number {
  const t = expr.replace(/\$([A-Za-z_]\w*)/g, (_, n: string) => {
    if (!(n in valeurs)) throw new Error(`paramètre inconnu $${n}`);
    return `(${valeurs[n]})`;
  });
  let i = 0;
  const espace = () => {
    while (t[i] === ' ') i++;
  };
  const primaire = (): number => {
    espace();
    if (t[i] === '(') {
      i++;
      const v = somme();
      espace();
      if (t[i++] !== ')') throw new Error(`parenthèse manquante dans « ${expr} »`);
      return v;
    }
    if (t[i] === '-') {
      i++;
      return -primaire();
    }
    const m = /^\d+(?:[.,]\d+)?/.exec(t.slice(i));
    if (!m) throw new Error(`nombre attendu dans « ${expr} »`);
    i += m[0].length;
    return Number(m[0].replace(',', '.'));
  };
  const produit = (): number => {
    let v = primaire();
    for (;;) {
      espace();
      if (t[i] === '*') (i++, (v *= primaire()));
      else if (t[i] === '/') (i++, (v /= primaire()));
      else return v;
    }
  };
  const somme = (): number => {
    let v = produit();
    for (;;) {
      espace();
      if (t[i] === '+') (i++, (v += produit()));
      else if (t[i] === '-') (i++, (v -= produit()));
      else return v;
    }
  };
  const v = somme();
  espace();
  if (i < t.length) throw new Error(`expression illisible « ${expr} »`);
  return v;
}

/** Désignation avec les paramètres remplacés par leur valeur. */
export const designationMacro = (m: Macro, valeurs: Record<string, number>) =>
  m.designation.replace(/\$([A-Za-z_]\w*)/g, (t, n: string) => (n in valeurs ? String(Math.round(valeurs[n] * 1000) / 1000) : t));

/**
 * Exécute la macro dans un dessin à part (origine (0, 0), niveau 1, trait continu fort) et renvoie les entités
 * obtenues. Les fonctions sont celles des cases de la palette, appelées comme par l'utilisateur.
 */
export function executerMacro(m: Macro, valeurs: Record<string, number>, reglages?: Contexte['reglages']): Entite[] {
  const dessin = new Dessin();
  const at = { niveau: 1, trait: 'continu-fort' as Trait };
  const ctx: Contexte = { dessin, attributs: () => at, memoire: new Map(), rayon: () => 0.5, dire: () => {}, reglages: reglages ? { ...reglages } : undefined, actions: {
      // Pas d'affichage : les réglages d'écran sont sans effet dans une macro.
      zoomFenetre: () => {},
      derniereFenetre: () => null,
      niveau: (n: number) => {
        at.niveau = n;
      },
      pasGrille: () => 1,
      grille: () => {},
      format: () => 'A4H',
      changerFormat: () => {},
    },
  };
  let f = creerFonction('D1', ctx)!;
  for (const ins of m.instructions) {
    try {
      switch (ins.op) {
        case 'case': {
          if (ins.code in TRAITS_CASES) {
            at.trait = TRAITS_CASES[ins.code];
            break;
          }
          const g = creerFonction(ins.code, ctx);
          if (!g) throw new Error(`case ${ins.code} inconnue`);
          f = g;
          break;
        }
        case 'point': {
          const p: Pt = { x: calculer(ins.x, valeurs), y: calculer(ins.y, valeurs) };
          f.point(p);
          break;
        }
        case 'valeur':
          f.valeur(ins.texte ? ins.v : calculer(ins.v, valeurs));
          break;
        case 'entree':
          f.parDefaut?.();
          break;
        case 'echap':
          f.abandon();
          break;
      }
    } catch (e) {
      throw new Error(`ligne ${ins.ligne} : ${(e as Error).message}`);
    }
  }
  return [...dessin.toutes];
}

/** Cases des types de trait (F11 à F14), utilisables dans une macro. */
const TRAITS_CASES: Record<string, Trait> = { F11: 'continu-fort', F12: 'pointille-fin', F13: 'mixte-fin', F14: 'continu-fin' };
