// Petites fenêtres de saisie (fichier-texte…), au-dessus de l'écran, fermées par Échap ou Annuler.

/** Saisie d'un texte de plusieurs lignes, avec un bouton pour lire un fichier .txt. Renvoie null si abandon. */
export function demanderTexte(titre: string, initial: string, ouvrirFichier: () => Promise<string | null>): Promise<string | null> {
  return new Promise((resolve) => {
    const fond = document.createElement('div');
    fond.className = 'dialogue-fond';
    const boite = document.createElement('div');
    boite.className = 'dialogue';
    boite.setAttribute('role', 'dialog');
    boite.setAttribute('aria-label', titre);
    const h = document.createElement('div');
    h.className = 'dialogue-titre';
    h.textContent = titre;
    const zone = document.createElement('textarea');
    zone.value = initial;
    zone.rows = 12;
    zone.spellcheck = false;
    zone.placeholder = 'Taper le texte ($ = Ø, ; = ±, ~ = °), ou lire un fichier .txt';
    const pied = document.createElement('div');
    pied.className = 'dialogue-boutons';
    const bouton = (texte: string, action: () => void, principal = false) => {
      const b = document.createElement('button');
      b.textContent = texte;
      if (principal) b.className = 'principal';
      b.addEventListener('click', action);
      return b;
    };
    const fermer = (r: string | null) => {
      fond.remove();
      resolve(r);
    };
    pied.append(
      bouton('Lire un fichier .txt...', async () => {
        const t = await ouvrirFichier();
        if (t !== null) zone.value = t;
        zone.focus();
      }),
      bouton('Annuler', () => fermer(null)),
      bouton('Écrire', () => fermer(zone.value), true),
    );
    boite.append(h, zone, pied);
    fond.append(boite);
    document.body.append(fond);
    boite.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') fermer(null);
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) fermer(zone.value);
    });
    zone.focus();
  });
}

// ======================================================================= Boîte de réglages (cases F1, F4)

export type Champ =
  | { cle: string; libelle: string; type: 'texte'; valeur: string; max?: number }
  | { cle: string; libelle: string; type: 'nombre'; valeur: number; min?: number; max?: number; pas?: number }
  | { cle: string; libelle: string; type: 'case'; valeur: boolean; inactif?: boolean }
  | { cle: string; libelle: string; type: 'choix'; valeur: string; options: { valeur: string; libelle: string }[] };

export interface Rubrique {
  titre: string;
  champs: Champ[];
}

export type Reponses = Record<string, string | number | boolean>;

/** Boîte de réglages en rubriques (OK : Entrée, Annuler : Échap). Renvoie les valeurs, ou null si abandon. */
export function demanderReglages(titre: string, rubriques: Rubrique[]): Promise<Reponses | null> {
  return new Promise((resolve) => {
    const fond = document.createElement('div');
    fond.className = 'dialogue-fond';
    const boite = document.createElement('form');
    boite.className = 'dialogue reglages';
    boite.setAttribute('role', 'dialog');
    boite.setAttribute('aria-label', titre);
    const h = document.createElement('div');
    h.className = 'dialogue-titre';
    h.textContent = titre;
    boite.append(h);
    const lecteurs: (() => [string, string | number | boolean])[] = [];
    for (const r of rubriques) {
      const fs = document.createElement('fieldset');
      const lg = document.createElement('legend');
      lg.textContent = r.titre;
      fs.append(lg);
      for (const c of r.champs) {
        const ligne = document.createElement('label');
        ligne.className = `champ-${c.type}`;
        const texte = document.createElement('span');
        texte.textContent = c.libelle;
        if (c.type === 'choix') {
          const s = document.createElement('select');
          for (const o of c.options) {
            const opt = document.createElement('option');
            opt.value = o.valeur;
            opt.textContent = o.libelle;
            s.append(opt);
          }
          s.value = c.valeur;
          ligne.append(texte, s);
          lecteurs.push(() => [c.cle, s.value]);
        } else if (c.type === 'case') {
          const i = document.createElement('input');
          i.type = 'checkbox';
          i.checked = c.valeur;
          i.disabled = !!c.inactif;
          ligne.append(i, texte);
          lecteurs.push(() => [c.cle, i.checked]);
        } else {
          const i = document.createElement('input');
          i.type = c.type === 'nombre' ? 'number' : 'text';
          i.value = String(c.valeur);
          if (c.type === 'texte' && c.max) i.maxLength = c.max;
          if (c.type === 'nombre') {
            if (c.min !== undefined) i.min = String(c.min);
            if (c.max !== undefined) i.max = String(c.max);
            i.step = String(c.pas ?? 'any');
          }
          i.spellcheck = false;
          ligne.append(texte, i);
          lecteurs.push(() => [c.cle, c.type === 'nombre' ? Number(i.value.replace(',', '.')) : i.value]);
        }
        fs.append(ligne);
      }
      boite.append(fs);
    }
    const pied = document.createElement('div');
    pied.className = 'dialogue-boutons';
    const fermer = (ok: boolean) => {
      fond.remove();
      resolve(ok ? Object.fromEntries(lecteurs.map((l) => l())) : null);
    };
    const annuler = document.createElement('button');
    annuler.type = 'button';
    annuler.textContent = 'Annuler';
    annuler.addEventListener('click', () => fermer(false));
    const ok = document.createElement('button');
    ok.type = 'submit';
    ok.className = 'principal';
    ok.textContent = 'OK';
    pied.append(annuler, ok);
    boite.append(pied);
    boite.addEventListener('submit', (e) => {
      e.preventDefault();
      fermer(true);
    });
    boite.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') fermer(false);
    });
    fond.append(boite);
    document.body.append(fond);
    (boite.querySelector('input, select') as HTMLElement | null)?.focus();
  });
}

// ======================================================================= Liste avec actions (pièces jointes…)

export interface LigneListe {
  id: string;
  cellules: string[];
  /** Ligne en rouge (fichier absent…). */
  alerte?: boolean;
}

/** Liste en tableau : une ligne se choisit d'un clic, les boutons agissent sur elle. */
export async function ouvrirListe(
  titre: string,
  colonnes: string[],
  lire: () => Promise<LigneListe[]>,
  boutons: { texte: string; action: (id: string) => void | Promise<void>; actif?: (l: LigneListe) => boolean }[],
): Promise<void> {
  let lignes = await lire();
  let choisie: string | null = lignes[0]?.id ?? null;
  const fond = document.createElement('div');
  fond.className = 'dialogue-fond';
  const boite = document.createElement('div');
  boite.className = 'dialogue liste-images';
  boite.setAttribute('role', 'dialog');
  boite.setAttribute('aria-label', titre);
  const h = document.createElement('div');
  h.className = 'dialogue-titre';
  h.textContent = titre;
  const table = document.createElement('table');
  const pied = document.createElement('div');
  pied.className = 'dialogue-boutons';
  const els = boutons.map((b) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = b.texte;
    el.addEventListener('click', async () => {
      if (!choisie) return;
      await b.action(choisie);
      await rafraichir();
    });
    pied.append(el);
    return el;
  });
  const fermer = document.createElement('button');
  fermer.type = 'button';
  fermer.className = 'principal';
  fermer.textContent = 'Fermer';
  fermer.addEventListener('click', () => fond.remove());
  pied.append(fermer);
  const rafraichir = async () => {
    lignes = await lire();
    if (!lignes.some((l) => l.id === choisie)) choisie = lignes[0]?.id ?? null;
    table.replaceChildren();
    const tete = document.createElement('tr');
    for (const c of colonnes) {
      const th = document.createElement('th');
      th.textContent = c;
      tete.append(th);
    }
    table.append(tete);
    for (const l of lignes) {
      const tr = document.createElement('tr');
      tr.className = `${l.alerte ? 'etat-absent' : ''}${l.id === choisie ? ' choisie' : ''}`;
      l.cellules.forEach((v, i) => {
        const td = document.createElement('td');
        if (i === 0) {
          const bdi = document.createElement('bdi');
          bdi.textContent = v;
          td.title = v;
          td.append(bdi);
        } else td.textContent = v;
        tr.append(td);
      });
      tr.addEventListener('click', () => {
        choisie = l.id;
        void rafraichir();
      });
      table.append(tr);
    }
    if (lignes.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="${colonnes.length}">(vide)</td>`;
      table.append(tr);
    }
    const l = lignes.find((x) => x.id === choisie);
    boutons.forEach((b, i) => (els[i].disabled = !l || (b.actif ? !b.actif(l) : false)));
  };
  boite.append(h, table, pied);
  boite.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape' || e.key === 'Enter') fond.remove();
  });
  fond.append(boite);
  document.body.append(fond);
  await rafraichir();
  fermer.focus();
}
