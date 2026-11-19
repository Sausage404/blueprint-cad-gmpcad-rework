// Groupes (E8 à E10, menu Groupe), sans DOM (testé dans test/groupes.test.ts).
// Un groupe est une seule entité : les primitives de ses membres mises bout à bout, leurs styles, leurs
// points repérables, et dans `params.membres` de quoi restituer chaque membre tel qu'il était à la création
// (une polyligne reste une polyligne). Son point de référence est le premier de ses `extras`.
import type { Entite, Genre, Trait } from './dessin';
import { homothetie, rotation, transformerEntite, translation } from './edition';
import { dist, type PointCaracteristique, type Pt } from './geometrie';
import type { Primitive } from './primitives';

/** Un membre du groupe : genre, nombre de primitives et de points repérables, trait, couleur, calque, réglages. */
interface Membre {
  g: Genre;
  n: number;
  x: number;
  tr: Trait;
  c?: number;
  cq?: string;
  s?: 1;
  t?: Record<string, unknown>;
}

export interface Nomenclature {
  designation: string;
  reference: string;
}

/** Longueurs de l'original : désignation 40 caractères, référence 20. */
export const LONGUEUR_DESIGNATION = 40;
export const LONGUEUR_REFERENCE = 20;

export const estGroupe = (e: Entite) => e.genre === 'groupe';
/** « Groupe vide » : désignation et référence gardées à l'éclatement (symbole N à l'écran). */
export const estVide = (e: Entite) => e.genre === 'groupe' && e.params?.vide === true;

/** Point de référence d'un groupe (symbole [] à l'écran) : le premier point repérable, sinon le premier point. */
export function pointReference(e: Entite): Pt | null {
  if (e.genre !== 'groupe') return null;
  if (e.extras[0]) return e.extras[0].p;
  const p = e.primitives[0];
  if (!p) return null;
  return p.type === 'cercle' || p.type === 'arc' ? p.c : p.type === 'texte' || p.type === 'point' ? p.p : p.a;
}

export function nomenclatureDe(e: Entite): Nomenclature | null {
  const p = e.params;
  if (e.genre !== 'groupe' || !p || (typeof p.designation !== 'string' && typeof p.reference !== 'string')) return null;
  return { designation: String(p.designation ?? ''), reference: String(p.reference ?? '') };
}

const nettoyer = (n: Nomenclature | null | undefined): Partial<Nomenclature> => {
  if (!n) return {};
  const designation = n.designation.trim().slice(0, LONGUEUR_DESIGNATION);
  const reference = n.reference.trim().slice(0, LONGUEUR_REFERENCE);
  return designation || reference ? { designation, reference } : {};
};

/** Crée un groupe à partir de ses membres (qui ne sont pas des groupes), sur le niveau donné. */
export function creerGroupe(membres: readonly Entite[], ref: Pt, niveau: number, nom?: Nomenclature | null): Entite {
  const primitives: Primitive[] = [];
  const styles: NonNullable<Entite['styles']> = [];
  const extras: PointCaracteristique[] = [{ p: { ...ref }, type: 'milieu' }];
  const desc: Membre[] = [];
  for (const e of membres) {
    e.primitives.forEach((p, i) => {
      primitives.push(p);
      const couleur = e.styles?.[i]?.couleur ?? e.couleur;
      styles.push({ trait: e.styles?.[i]?.trait ?? e.trait, ...(couleur !== undefined ? { couleur } : {}) });
    });
    extras.push(...e.extras);
    desc.push({
      g: e.genre,
      n: e.primitives.length,
      x: e.extras.length,
      tr: e.trait,
      ...(e.couleur !== undefined ? { c: e.couleur } : {}),
      ...(e.calque ? { cq: e.calque } : {}),
      ...(e.styles ? { s: 1 as const } : {}),
      ...(e.params ? { t: e.params } : {}),
    });
  }
  return { genre: 'groupe', primitives, styles, extras, niveau, trait: 'continu-fort', params: { membres: desc, ...nettoyer(nom) } };
}

/** Groupe vide : seulement la désignation et la référence, au point de référence de l'ancien groupe. */
export function groupeVide(ref: Pt, niveau: number, nom: Nomenclature): Entite {
  return {
    genre: 'groupe',
    primitives: [{ type: 'point', p: { ...ref } }],
    extras: [{ p: { ...ref }, type: 'milieu' }],
    niveau,
    trait: 'continu-fin',
    params: { vide: true, ...nettoyer(nom) },
  };
}

/** Les membres d'un groupe, tels qu'à sa création ; null si le groupe ne les décrit pas (groupe importé). */
export function membresDe(e: Entite): Entite[] | null {
  const desc = e.params?.membres;
  if (e.genre !== 'groupe' || !Array.isArray(desc)) return null;
  const membres = desc as Membre[];
  const n = membres.reduce((s, m) => s + m.n, 0);
  const x = membres.reduce((s, m) => s + m.x, 0);
  if (n !== e.primitives.length || x + 1 !== e.extras.length) return null; // primitives perdues en route
  const out: Entite[] = [];
  let ip = 0;
  let ix = 1;
  for (const m of membres) {
    out.push({
      genre: m.g,
      primitives: e.primitives.slice(ip, ip + m.n),
      extras: e.extras.slice(ix, ix + m.x),
      niveau: e.niveau,
      trait: m.tr,
      ...(m.c !== undefined ? { couleur: m.c } : {}),
      ...(m.cq ? { calque: m.cq } : {}),
      ...(m.s && e.styles ? { styles: e.styles.slice(ip, ip + m.n) } : {}),
      ...(m.t ? { params: m.t } : {}),
    });
    ip += m.n;
    ix += m.x;
  }
  return out;
}

/**
 * Groupe placé (menu Groupe > Placer) : le modèle, mis à l'échelle et tourné autour de son point de
 * référence, puis amené au point `p`. Le fichier, l'inclinaison et le rapport sont gardés pour les mises à jour.
 */
export function placerGroupe(modele: Entite, p: Pt, angle: number, k: number, fichier: string | null, niveau: number): Entite {
  const r = pointReference(modele) ?? { x: 0, y: 0 };
  let e = modele;
  if (Math.abs(k - 1) > 1e-12) e = transformerEntite(e, homothetie(r, k));
  if (Math.abs(angle) > 1e-12) e = transformerEntite(e, rotation(r, angle));
  e = transformerEntite(e, translation(p.x - r.x, p.y - r.y));
  const params: Record<string, unknown> = { ...(e.params ?? {}), angle, echelle: k };
  if (fichier) params.fichier = fichier;
  return { ...e, niveau, params };
}

/** Le groupe enregistré dans un fichier : sans position d'origine (inclinaison et rapport repartent de 0 et 1). */
export function modeleAEnregistrer(e: Entite, nom: Nomenclature): Entite {
  const { angle: _a, echelle: _k, fichier: _f, ...reste } = e.params ?? {};
  return { ...e, niveau: 1, params: { ...reste, ...nettoyer(nom) } };
}

/** Groupes semblables à `g` : même fichier d'origine, sinon même désignation. */
export function semblables(entites: readonly Entite[], g: Entite): Entite[] {
  const f = g.params?.fichier;
  const d = nomenclatureDe(g)?.designation;
  return entites.filter((e) => {
    if (e.genre !== 'groupe' || estVide(e)) return false;
    if (e === g) return true;
    if (typeof f === 'string') return e.params?.fichier === f;
    return !!d && nomenclatureDe(e)?.designation === d;
  });
}

/** Le groupe dont le point de référence est en `p` (à `tol` près). */
export function groupeEn(entites: readonly Entite[], p: Pt, tol: number): Entite | null {
  let meilleur: Entite | null = null;
  let d0 = tol;
  for (const e of entites) {
    const r = pointReference(e);
    if (!r) continue;
    const d = dist(r, p);
    if (d <= d0) {
      d0 = d;
      meilleur = e;
    }
  }
  return meilleur;
}

/** Groupe tiré d'un fichier : le premier groupe du dessin, sinon tout le dessin regroupé à l'origine. */
export function groupeDuFichier(entites: readonly Entite[]): Entite | null {
  const g = entites.find((e) => e.genre === 'groupe' && !estVide(e));
  if (g) return g;
  const autres = entites.filter((e) => e.genre !== 'groupe');
  return autres.length ? creerGroupe(autres, { x: 0, y: 0 }, 1) : null;
}
