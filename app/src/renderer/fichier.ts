// Menu Fichier : nouveau, ouvrir, enregistrer (Ctrl+E), enregistrer sous (Ctrl+S), fusionner, revenir à la
// dernière version, backup, imprimer, exporter. Le format d'enregistrement est le DXF.
import { APP_NAME, type FichierLu } from '../shared/types';
import { aciNiveau } from './couleurs';
import { lireDes } from './des';
import { ecrireDxf, lireDxf } from './dxf';
import type { Entite } from './dessin';
import { format, formatPour } from './formats';
import { PlacementGroupe } from './fonctions-groupes';
import { Collage } from './fonctions-menus';
import { groupeDuFichier } from './groupes';
import { etatLien } from './images';
import { ecrireIges, lireIges } from './iges';
import type { Poste } from './poste';
import { svgFeuille } from './svg';

export class GestionFichier {
  chemin: string | null = null;
  nom = '(sans nom)';
  /** Ouverture du dessin en cours (Aide > Temps de travail). */
  ouvertLe = Date.now();

  constructor(
    private poste: Poste,
    private dire: (texte: string) => void,
    private direRepos: () => void,
  ) {}

  /** Titre de la fenêtre et état « modifié », transmis au processus principal. */
  majEtat(): void {
    window.dao.etatDessin(`${APP_NAME} - ${this.nom}`, this.poste.dessin.modifie, this.chemin);
  }

  /** Menu Groupe > Enregistrer sous : le groupe seul, dans un petit DXF. Renvoie le nom du fichier (sans .dxf). */
  async enregistrerGroupe(g: Entite, nom: string): Promise<string | null> {
    const chemin = await window.dao.enregistrerGroupe(nom, ecrireDxf([g], this.poste.dessin.calques, this.poste.format, aciNiveau, undefined, this.poste.dessin.images));
    return chemin ? (chemin.split(/[\\/]/).pop() ?? chemin).replace(/\.dxf$/i, '') : null;
  }

  /** Menu Groupe > Placer : lit le fichier d'un groupe, puis le placement commence. */
  async placerGroupe(chemin?: string): Promise<void> {
    const f = chemin ? await window.dao.lireGroupe(chemin) : await window.dao.ouvrirGroupe();
    if (chemin && !f) {
      this.dire(`Groupe introuvable : ${chemin}`);
      return;
    }
    if (!f) return;
    let modele: Entite | null = null;
    try {
      const r = lireDxf(f.contenu);
      for (const [id, img] of r.images) if (!this.poste.dessin.images.has(id)) this.poste.dessin.images.set(id, img);
      modele = groupeDuFichier(r.entites);
    } catch (err) {
      this.dire(`Lecture impossible de ${f.nom} : ${(err as Error).message}`);
      return;
    }
    if (!modele) {
      this.dire(`${f.nom} ne contient aucun groupe.`);
      return;
    }
    this.poste.choisir(new PlacementGroupe(this.poste.contexte, modele, f.nom));
  }

  // ---- Menu Outils

  /** Conversion dessin vers DXF : des anciens dessins .des, chacun écrit en DXF à côté de lui. */
  async convertirDes(): Promise<void> {
    const fichiers = await window.dao.choisirDes();
    if (fichiers.length === 0) return;
    const faits: string[] = [];
    const ratés: string[] = [];
    for (const f of fichiers) {
      try {
        const r = lireDes(Uint8Array.from(f.contenu, (c) => c.charCodeAt(0)));
        faits.push(await window.dao.ecrireDxfACote(f.chemin!, ecrireDxf(r.entites, r.calques, formatPour(r.limites, r.etendue), aciNiveau)));
      } catch {
        ratés.push(f.nom);
      }
    }
    this.dire(`${faits.length} dessin${faits.length > 1 ? 's' : ''} converti${faits.length > 1 ? 's' : ''} en DXF${faits.length ? ` (${faits.map((c) => c.split(/[\\/]/).pop()).join(', ')})` : ''}.${ratés.length ? ` Illisibles : ${ratés.join(', ')}.` : ''}`);
  }

  /** Conversion IGES vers dessin : lignes, arcs, cercles et points d'un fichier IGES, dans un nouveau dessin. */
  async importerIges(): Promise<void> {
    if (!(await this.confirmerAbandon())) return;
    const f = await window.dao.ouvrirTexteType('Fichier IGES', ['igs', 'iges', 'IGS', 'IGES']);
    if (!f) return;
    const { primitives, ignores } = lireIges(f.contenu);
    const entites: Entite[] = primitives.map((p) => ({ genre: p.type === 'texte' ? 'texte' : p.type, primitives: [p], extras: [], niveau: 1, trait: 'continu-fort' }));
    const pts = primitives.flatMap((p) => (p.type === 'segment' ? [p.a, p.b] : p.type === 'cercle' || p.type === 'arc' ? [p.c] : p.type === 'point' ? [p.p] : []));
    const etendue = pts.length ? { min: { x: Math.min(...pts.map((p) => p.x)), y: Math.min(...pts.map((p) => p.y)) }, max: { x: Math.max(...pts.map((p) => p.x)), y: Math.max(...pts.map((p) => p.y)) } } : null;
    this.poste.charger(entites, new Map(), formatPour(null, etendue));
    this.chemin = null;
    this.nom = f.nom.replace(/\.(igs|iges)$/i, '');
    this.majEtat();
    const non = Object.entries(ignores);
    this.dire(`IGES ${f.nom} : ${entites.length} entités lues.${non.length ? ` Non lues : ${non.map(([t, n]) => `${n} ${t}`).join(', ')}.` : ''}`);
  }

  /** Conversion dessin vers IGES. */
  async exporterIges(): Promise<void> {
    const nom = `${this.nom === '(sans nom)' ? 'dessin' : this.nom}.igs`;
    const chemin = await window.dao.enregistrerTexte('Fichier IGES', nom, 'igs', ecrireIges(this.poste.dessin.toutes, nom));
    if (chemin) this.dire(`Dessin exporté en IGES : ${chemin}`);
  }

  /** Fichier > Enregistrer une sélection : les entités choisies, dans un nouveau dessin DXF (même format). */
  async enregistrerSelection(entites: Entite[]): Promise<void> {
    const d = this.poste.dessin;
    const contenu = ecrireDxf(entites, d.calques, this.poste.format, aciNiveau, undefined, d.images);
    const chemin = await window.dao.enregistrerSous('selection.dxf', contenu);
    if (chemin) this.dire(`Sélection enregistrée (${entites.length} entités) : ${chemin}`);
  }

  /** Mise à jour des images dont le fichier a changé (case F4) : automatique, avec confirmation, ou manuelle (case B4). */
  miseAJourImages: 'automatique' | 'confirmation' | 'manuelle' = 'automatique';

  /**
   * À la lecture d'un dessin : une image dont le fichier est plus récent est mise à jour (selon l'option) ;
   * un lien rompu est réparé, sur confirmation, par un fichier de même nom dans le dossier du dessin.
   */
  async verifierImages(cheminDessin: string | null): Promise<void> {
    const dossier = cheminDessin ? cheminDessin.replace(/[\\/][^\\/]*$/, '') : null;
    for (const [id, img] of [...this.poste.dessin.images]) {
      const etat = await window.dao.etatImage(img.fichier, dossier);
      const nom = img.fichier.split(/[\\/]/).pop() || id;
      if (etat.existe && etat.voisin) {
        const r = await window.dao.question(`L'image « ${nom} » n'est plus à son emplacement.`, `Un fichier de même nom est dans le dossier du dessin :\n${etat.chemin}\n\nRéparer le lien avec ce fichier ?`, ['Réparer', 'Ignorer']);
        if (r === 0) await this.relireImage(id, etat.chemin);
        continue;
      }
      if (etatLien(img, etat) !== 'mise-a-jour' || this.miseAJourImages === 'manuelle') continue;
      if (this.miseAJourImages === 'confirmation') {
        const r = await window.dao.question(`L'image « ${nom} » a été modifiée.`, 'Utiliser la nouvelle version du fichier ?', ['Mettre à jour', 'Garder la version du dessin']);
        if (r !== 0) continue;
      }
      await this.relireImage(id, img.fichier);
    }
  }

  /** Relit le fichier d'une image : le nouveau contenu remplace l'ancien (mise à jour, réparation d'un lien). */
  async relireImage(id: string, chemin: string): Promise<boolean> {
    const lu = await window.dao.lireImage(chemin);
    if (!lu) return false;
    const px = await dimensionsPx(lu.donnees);
    this.poste.dessin.images.set(id, { donnees: lu.donnees, fichier: lu.chemin, date: lu.date, taille: lu.taille, px });
    this.poste.oublierImage(id);
    this.poste.dessin.modifie = true;
    this.poste.dessin.version++;
    this.poste.vue.redessiner();
    this.majEtat();
    return true;
  }

  contenu(): string {
    const d = this.poste.dessin;
    return ecrireDxf(d.toutes, d.calques, this.poste.format, aciNiveau, d.infos, d.images);
  }

  /** Si le dessin a été modifié : propose de l'enregistrer. Renvoie false si l'utilisateur annule. */
  async confirmerAbandon(): Promise<boolean> {
    if (!this.poste.dessin.modifie) return true;
    const r = await window.dao.question(
      `Le dessin « ${this.nom} » a été modifié.`,
      'Voulez-vous enregistrer les modifications ?',
      ['Enregistrer', 'Ne pas enregistrer', 'Annuler'],
    );
    if (r === 2) return false;
    if (r === 0) return this.enregistrer();
    return true;
  }

  /** Fichier > Nouveau : « Nouvelle session » (une autre fenêtre), ou un dessin vierge dans celle-ci. */
  async nouveauOuSession(): Promise<void> {
    const r = await window.dao.question('Nouvelle session', 'Oui : un dessin vierge dans une nouvelle fenêtre. Non : un dessin vierge dans cette fenêtre.', ['Oui', 'Non', 'Annuler']);
    if (r === 0) {
      if (!(await window.dao.nouvelleSession())) this.dire('Huit sessions au plus.');
    } else if (r === 1) await this.nouveau();
  }

  async nouveau(): Promise<void> {
    if (!(await this.confirmerAbandon())) return;
    this.poste.charger([], new Map(), format('A4H'));
    this.ouvertLe = Date.now();
    this.chemin = null;
    this.nom = '(sans nom)';
    this.majEtat();
    this.direRepos();
  }

  async ouvrir(chemin?: string): Promise<void> {
    if (!(await this.confirmerAbandon())) return;
    const f = chemin ? await window.dao.lire(chemin) : await window.dao.ouvrir('Ouvrir un dessin');
    if (!f) {
      if (chemin) this.dire(`Fichier introuvable : ${chemin}`);
      return;
    }
    this.charger(f, false);
  }

  async fusionner(chemin?: string): Promise<void> {
    const f = chemin ? await window.dao.lire(chemin) : await window.dao.ouvrir('Fusionner avec un dessin');
    if (f) this.charger(f, true);
  }

  private charger(f: FichierLu, fusion: boolean): void {
    let r;
    try {
      r = f.des ? lireDes(Uint8Array.from(f.contenu, (c) => c.charCodeAt(0))) : lireDxf(f.contenu);
    } catch (err) {
      this.dire(`Lecture impossible de ${f.nom} : ${(err as Error).message}`);
      return;
    }
    if (fusion) {
      // Fusionner : le dessin lu se pose au point d'implantation désigné (R, X, Y avant de le poser).
      for (const [k, v] of r.calques) if (!this.poste.dessin.calques.has(k)) this.poste.dessin.calques.set(k, v);
      this.poste.choisir(new Collage(this.poste.contexte, { entites: r.entites, images: Object.fromEntries(r.images) }, `Fusionner ${f.nom}.`, true));
    } else {
      this.poste.charger(r.entites, r.calques, formatPour(r.limites, r.etendue), r.infos, r.images);
      this.ouvertLe = Date.now();
      if (r.images.size) void this.verifierImages(f.chemin);
      // Un ancien dessin .des est enregistré ensuite en DXF : « Enregistrer » demandera où.
      this.chemin = f.des ? null : f.chemin;
      this.nom = f.nom;
      this.direRepos();
    }
    const ignores = Object.entries(r.ignores);
    if (ignores.length) this.dire(`${f.nom} : éléments non lus (${ignores.map(([t, k]) => `${k} ${t}`).join(', ')}).`);
    this.majEtat();
  }

  /** Ctrl+E dans l'original. */
  async enregistrer(): Promise<boolean> {
    if (!this.chemin) return this.enregistrerSous();
    await window.dao.enregistrer(this.chemin, this.contenu());
    this.poste.dessin.modifie = false;
    this.dire(`Dessin enregistré : ${this.chemin}`);
    this.majEtat();
    return true;
  }

  /** Ctrl+S dans l'original. */
  async enregistrerSous(): Promise<boolean> {
    const chemin = await window.dao.enregistrerSous(this.chemin ?? `${this.nom === '(sans nom)' ? 'dessin' : this.nom}.dxf`, this.contenu());
    if (!chemin) return false;
    this.chemin = chemin;
    this.nom = chemin.replace(/^.*[\\/]/, '').replace(/\.dxf$/i, '');
    this.poste.dessin.modifie = false;
    this.dire(`Dessin enregistré : ${chemin}`);
    this.majEtat();
    return true;
  }

  async revenir(): Promise<void> {
    if (!this.chemin) {
      this.dire("Ce dessin n'a pas encore été enregistré.");
      return;
    }
    const r = await window.dao.question('Revenir à la dernière version enregistrée ?', 'Les modifications faites depuis seront perdues.', ['Revenir', 'Annuler']);
    if (r !== 0) return;
    const f = await window.dao.lire(this.chemin);
    if (f) this.charger(f, false);
  }

  async backup(silencieux = false): Promise<void> {
    await window.dao.backup(this.contenu());
    if (!silencieux) this.dire('Backup du dessin effectué.');
  }

  async relireBackup(): Promise<void> {
    if (!(await this.confirmerAbandon())) return;
    const f = await window.dao.relireBackup();
    if (!f) {
      this.dire('Aucun backup.');
      return;
    }
    this.charger({ ...f, nom: this.nom }, false);
    this.poste.dessin.modifie = true;
    this.majEtat();
  }

  page() {
    const f = this.poste.format;
    return { svg: svgFeuille(this.poste.dessin.toutes, f, (id) => this.poste.dessin.images.get(id)?.donnees), largeur: f.largeur, hauteur: f.hauteur, nom: this.nom === '(sans nom)' ? 'dessin' : this.nom };
  }

  async imprimer(): Promise<void> {
    const erreur = await window.dao.imprimer(this.page());
    if (erreur && erreur !== 'cancelled') this.dire(`Impression impossible : ${erreur}`);
  }

  async exporterPdf(): Promise<void> {
    const chemin = await window.dao.exporterPdf(this.page());
    if (chemin) this.dire(`PDF enregistré à l'échelle 1 : ${chemin}`);
  }

  /**
   * Reprise après plantage : si le logiciel s'est fermé sans que le dessin soit enregistré, propose
   * de le reprendre là où on en était.
   */
  async reprendre(): Promise<void> {
    const r = await window.dao.lireRecuperation();
    if (!r) return;
    const quand = new Date(r.date).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
    const choix = await window.dao.question(
      `Le dessin « ${r.nom} » n'avait pas été enregistré.`,
      `${APP_NAME} s'est fermé le ${quand} sans que ce dessin soit enregistré. Voulez-vous le reprendre là où vous en étiez ?`,
      ['Reprendre le dessin', 'Ne pas le reprendre'],
    );
    if (choix !== 0) {
      await window.dao.effacerRecuperation();
      return;
    }
    this.charger({ ...r, des: false }, false);
    this.chemin = r.chemin;
    this.nom = r.nom;
    this.poste.dessin.modifie = true;
    this.majEtat();
    this.dire(`Dessin « ${r.nom} » repris. Pensez à l'enregistrer (Ctrl+E).`);
  }

  /** Fichier > Exporter : PDF à l'échelle exacte, image PNG (300 ppp au plus) ou SVG, selon l'extension choisie. */
  async exporter(): Promise<void> {
    const p = this.page();
    const chemin = await window.dao.cheminExport(p.nom);
    if (!chemin) return;
    try {
      if (/\.svg$/i.test(chemin)) await window.dao.ecrireFichier(chemin, svgAvecFond(p.svg));
      else if (/\.png$/i.test(chemin)) await window.dao.ecrireFichier(chemin, await png(p.svg, p.largeur, p.hauteur));
      else await window.dao.ecrirePdf(p, chemin);
      this.dire(`Dessin exporté : ${chemin}`);
    } catch (err) {
      this.dire(`Export impossible : ${(err as Error).message}`);
    }
  }

  /** Fichier > Partager (nouveauté) : le dessin en PDF, par Mail, Messages, AirDrop… */
  async partager(): Promise<void> {
    const r = await window.dao.partager(this.page());
    if (r === 'dossier') this.dire('Le dessin est prêt en PDF dans le dossier ouvert : vous pouvez le joindre à un message.');
  }

  /** Quitter la session : propose d'enregistrer, puis ferme. */
  async quitter(): Promise<void> {
    if (await this.confirmerAbandon()) window.dao.fermer();
  }
}

/** SVG exporté seul : avec un fond blanc, pour être lisible dans tous les logiciels. */
export function svgAvecFond(svg: string): string {
  return svg.replace(/(<svg[^>]*>)/, '$1<rect width="100%" height="100%" fill="#fff"/>');
}

/** Image PNG de la feuille : 300 points par pouce, ou moins pour les grands formats (8000 pixels au plus). */
async function png(svg: string, largeurMm: number, hauteurMm: number): Promise<Uint8Array> {
  const ppp = Math.min(300, (8000 * 25.4) / Math.max(largeurMm, hauteurMm));
  const l = Math.round((largeurMm / 25.4) * ppp);
  const h = Math.round((hauteurMm / 25.4) * ppp);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = l;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, l, h);
  ctx.drawImage(img, 0, 0, l, h);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  if (!blob) throw new Error('image trop grande');
  return new Uint8Array(await blob.arrayBuffer());
}

/** Dimensions en pixels d'une image (data URL). */
export function dimensionsPx(donnees: string): Promise<[number, number]> {
  return new Promise((resolve) => {
    const el = new Image();
    el.onload = () => resolve([el.naturalWidth || 100, el.naturalHeight || 100]);
    el.onerror = () => resolve([100, 100]);
    el.src = donnees;
  });
}
