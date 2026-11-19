// Placement des pièces de la bibliothèque MECA (cases I01 à T15) : dimensions au clavier, puis point de
// référence et orientation, comme un groupe (aide d'origine, « Placer »). Chaque pièce posée est un groupe
// avec sa désignation, qui entre dans la nomenclature.
import { cartouche, grilleBibliotheque, PIECES, type ChampsCartouche, type Piece, type Style, type Tr } from './bibliotheque';
import type { Entite, Trait } from './dessin';
import { rotation, transformerEntite, translation } from './edition';
import { enregistrerFonctions, type Contexte, type Fonction, type Question } from './fonctions';
import { format as formatNomme } from './formats';
import { dist, type Pt } from './geometrie';
import { creerGroupe, estVide, nomenclatureDe } from './groupes';
import { angleDe, type Primitive } from './primitives';

const TRAIT: Record<Style, Trait> = { f: 'continu-fort', n: 'continu-fin', a: 'mixte-fin', c: 'pointille-fin', h: 'continu-fin' };

/** La pièce dessinée, en entité « pièce » (un trait par primitive), dans son repère. */
export function entitePiece(traits: Tr[], niveau: number): Entite {
  return { genre: 'piece', primitives: traits.map((t) => t.p), styles: traits.map((t) => ({ trait: TRAIT[t.s] })), extras: [{ p: { x: 0, y: 0 }, type: 'extremite' }], niveau, trait: 'continu-fort' };
}

/** Pièce placée : tournée de `angle` autour de son origine, amenée en `p`. */
function placee(e: Entite, p: Pt, angle: number): Entite {
  const t = Math.abs(angle) > 1e-12 ? transformerEntite(e, rotation({ x: 0, y: 0 }, angle)) : e;
  return transformerEntite(t, translation(p.x, p.y));
}

/** Valeurs proposées des questions d'une pièce (chacune peut dépendre des précédentes). */
export function valeursParDefaut(piece: Piece): number[] {
  const v: number[] = [];
  for (const q of piece.questions) v.push(q.defaut(v));
  return v;
}

class PlacementPiece implements Fonction {
  readonly nom: string;
  readonly code: string;
  private valeurs: number[] = [];
  private origine: Pt | null = null;
  constructor(
    private ctx: Contexte,
    private piece: Piece,
  ) {
    this.nom = piece.libelle.replace(/\.$/, '');
    this.code = piece.code;
  }
  private get dimensionne() {
    return this.valeurs.length >= this.piece.questions.length;
  }
  question(): Question | null {
    if (this.dimensionne) return null;
    const i = this.valeurs.length;
    const q = this.piece.questions[i];
    const memo = i === 0 ? this.ctx.memoire.get(`piece-${this.code}`) : undefined;
    return { texte: `${this.nom}. ${q.texte}`, defaut: Math.round((memo ?? q.defaut(this.valeurs)) * 1000) / 1000 };
  }
  valeur(v: number | string) {
    const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
    if (!(n > 0)) return this.ctx.dire('Valeur positive attendue.');
    if (this.valeurs.length === 0) this.ctx.memoire.set(`piece-${this.code}`, n);
    this.valeurs.push(n);
  }
  invite() {
    if (!this.dimensionne) return '';
    return this.origine ? `${this.nom}. Définir l'orientation par un point (Entrée : horizontale).` : `${this.nom}. Désigner le point de référence.`;
  }
  attente(): 'point' {
    return 'point';
  }
  dernierPoint() {
    return this.origine;
  }
  parDefaut() {
    if (this.origine) this.poser(0);
  }
  point(p: Pt) {
    if (!this.dimensionne) return;
    if (!this.origine) {
      this.origine = p;
      return;
    }
    this.poser(dist(p, this.origine) < this.ctx.rayon() ? 0 : angleDe(this.origine, p));
  }
  private dessinee(): Entite {
    return entitePiece(this.piece.dessin(this.valeurs), this.ctx.attributs().niveau);
  }
  private poser(angle: number) {
    const o = this.origine!;
    const niveau = this.ctx.attributs().niveau;
    const designation = this.piece.designation(this.valeurs);
    this.ctx.dessin.ajouter(creerGroupe([placee(this.dessinee(), o, angle)], o, niveau, { designation, reference: '' }));
    this.ctx.dire(`${designation} placé.`);
    this.origine = null;
  }
  elastique(r: Pt): Primitive[] {
    if (!this.dimensionne) return [];
    if (!this.origine) return placee(this.dessinee(), r, 0).primitives;
    const a = dist(r, this.origine) < this.ctx.rayon() ? 0 : angleDe(this.origine, r);
    return [{ type: 'segment', a: this.origine, b: r }, ...placee(this.dessinee(), this.origine, a).primitives];
  }
  /** Échap : pendant le placement, on revient aux dimensions ; au début, on sort. */
  abandon() {
    if (this.origine) {
      this.origine = null;
      return false;
    }
    const auDebut = this.valeurs.length === 0;
    this.valeurs = [];
    return auDebut;
  }
}

/** Nomenclature du dessin : niveaux renseignés (case F3), puis groupes désignés, comptés par désignation. */
export function lignesNomenclature(entites: readonly Entite[], niveaux: Record<string, { designation?: string; reference?: string }>): { rep: string; nb: string; designation: string; reference: string }[] {
  const lignes: { designation: string; reference: string; nb: number }[] = [];
  for (const [, n] of Object.entries(niveaux).sort((a, b) => Number(a[0]) - Number(b[0]))) if (n.designation) lignes.push({ designation: n.designation, reference: n.reference ?? '', nb: 1 });
  for (const e of entites) {
    if (e.genre !== 'groupe' || estVide(e)) continue;
    const nom = nomenclatureDe(e);
    if (!nom?.designation) continue;
    const deja = lignes.find((l) => l.designation === nom.designation && l.reference === nom.reference);
    if (deja) deja.nb++;
    else lignes.push({ designation: nom.designation, reference: nom.reference, nb: 1 });
  }
  return lignes.map((l, i) => ({ rep: String(i + 1), nb: String(l.nb), designation: l.designation, reference: l.reference }));
}

/** T14, T15 — Cartouche (avec la nomenclature pour T15), rempli avec les paramètres du plan (case F1). */
class Cartouche implements Fonction {
  readonly nom: string;
  constructor(
    private ctx: Contexte,
    readonly code: string,
    private avecNomenclature: boolean,
  ) {
    this.nom = avecNomenclature ? 'Cartouche avec nomenclature' : 'Cartouche';
  }
  invite() {
    return `${this.nom}. Désigner le coin inférieur droit (déf, coin du cadre).`;
  }
  question() {
    return null;
  }
  valeur() {}
  dernierPoint() {
    return null;
  }
  private coin(): Pt {
    try {
      const f = formatNomme(this.ctx.actions?.format() ?? 'A4H');
      return { x: f.largeur - f.marge, y: f.marge };
    } catch {
      return { x: 0, y: 0 };
    }
  }
  private traits(): Tr[] {
    const plan = this.ctx.dessin.infos.plan;
    const champs: ChampsCartouche = {
      ...plan,
      date: new Date().toLocaleDateString('fr-FR'),
      echelle: '1:1',
      format: this.ctx.actions?.format() ?? '',
    };
    return cartouche(champs, this.avecNomenclature ? lignesNomenclature(this.ctx.dessin.toutes, this.ctx.dessin.infos.niveaux) : undefined);
  }
  parDefaut() {
    this.point(this.coin());
  }
  point(p: Pt) {
    const e = transformerEntite(entitePiece(this.traits(), this.ctx.attributs().niveau), translation(p.x, p.y));
    this.ctx.dessin.ajouter({ ...e, genre: 'groupe', params: { cartouche: true } });
    this.ctx.dire(`${this.nom} placé.${this.ctx.dessin.infos.plan.designation ? '' : ' (Les champs viennent des paramètres du plan, case F1.)'}`);
  }
  elastique(r: Pt): Primitive[] {
    return transformerEntite(entitePiece(this.traits(), 1), translation(r.x, r.y)).primitives;
  }
  abandon() {
    return true;
  }
}

/** Cases de la bibliothèque, pour la palette : code, infobulle, pièce (null : case vide). */
export const CASES_BIBLIOTHEQUE = grilleBibliotheque().map((c, i) =>
  c ? { code: c.code, libelle: c.libelle } : { code: `${'IJKLMNOPQRST'[Math.floor(i / 15)]}${String((i % 15) + 1).padStart(2, '0')}`, libelle: 'Case libre (Groupe ou Gmac > Insérer dans le menu).', vide: true },
);

enregistrerFonctions({
  ...Object.fromEntries(
    PIECES.map((p) => [
      p.code,
      class extends PlacementPiece {
        constructor(ctx: Contexte) {
          super(ctx, p);
        }
      },
    ]),
  ),
  T14: class extends Cartouche {
    constructor(ctx: Contexte) {
      super(ctx, 'T14', false);
    }
  },
  T15: class extends Cartouche {
    constructor(ctx: Contexte) {
      super(ctx, 'T15', true);
    }
  },
});

