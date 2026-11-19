// Case B4 — Liste des images du dessin : fichier lié, dimensions, taille, plan, état du lien (à jour,
// mise à jour disponible, fichier absent), avec mise à jour, réparation, modification et suppression.

export interface LigneImage {
  id: string;
  chemin: string;
  dimensions: string;
  taille: string;
  plan: string;
  etat: 'ok' | 'mise-a-jour' | 'absent';
  apercu: string;
  /** Lien réparé ou mis à jour pendant cette ouverture de la liste (écrit en gras). */
  modifie?: boolean;
}

export interface ActionsImages {
  lire(): Promise<LigneImage[]>;
  mettreAJour(id: string): Promise<void>;
  reparer(id: string): Promise<void>;
  editer(id: string): void;
  supprimer(id: string): void;
}

const ETATS: Record<LigneImage['etat'], string> = { ok: 'Ok', 'mise-a-jour': 'Mise à jour disponible', absent: 'Fichier absent' };

export async function ouvrirListeImages(actions: ActionsImages): Promise<void> {
  let lignes = await actions.lire();
  const modifies = new Set<string>();
  let choisie: string | null = lignes[0]?.id ?? null;

  const fond = document.createElement('div');
  fond.className = 'dialogue-fond';
  const boite = document.createElement('div');
  boite.className = 'dialogue liste-images';
  boite.setAttribute('role', 'dialog');
  boite.setAttribute('aria-label', 'Liste des images');
  const titre = document.createElement('div');
  titre.className = 'dialogue-titre';
  titre.textContent = 'Liste des images';
  const table = document.createElement('table');
  const apercu = document.createElement('img');
  apercu.className = 'apercu-image';
  apercu.alt = '';
  const voir = document.createElement('label');
  const caseVoir = document.createElement('input');
  caseVoir.type = 'checkbox';
  voir.append(caseVoir, document.createTextNode(" Afficher l'image"));
  const boutons = document.createElement('div');
  boutons.className = 'dialogue-boutons';
  const bouton = (texte: string, action: () => void | Promise<void>) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = texte;
    b.addEventListener('click', async () => {
      await action();
      await rafraichir();
    });
    return b;
  };
  const bMaj = bouton('Mettre à jour', async () => {
    if (!choisie) return;
    await actions.mettreAJour(choisie);
    modifies.add(choisie);
  });
  const bReparer = bouton('Réparer...', async () => {
    if (!choisie) return;
    await actions.reparer(choisie);
    modifies.add(choisie);
  });
  const bEditer = bouton("Modifier l'image", () => {
    if (choisie) actions.editer(choisie);
  });
  const bSupprimer = bouton('Supprimer', () => {
    if (choisie) actions.supprimer(choisie);
  });
  const fermer = document.createElement('button');
  fermer.type = 'button';
  fermer.className = 'principal';
  fermer.textContent = 'Fermer';
  fermer.addEventListener('click', () => fond.remove());
  boutons.append(voir, bMaj, bReparer, bEditer, bSupprimer, fermer);

  const rafraichir = async () => {
    lignes = await actions.lire();
    if (!lignes.some((l) => l.id === choisie)) choisie = lignes[0]?.id ?? null;
    table.innerHTML = '<thead><tr><th>Fichier</th><th>Dimensions (mm)</th><th>Taille</th><th>Plan</th><th>État</th></tr></thead>';
    const corps = document.createElement('tbody');
    for (const l of lignes) {
      const tr = document.createElement('tr');
      tr.className = `etat-${l.etat}${l.id === choisie ? ' choisie' : ''}${modifies.has(l.id) ? ' modifie' : ''}`;
      [l.chemin, l.dimensions, l.taille, l.plan, ETATS[l.etat]].forEach((v, i) => {
        const td = document.createElement('td');
        // Le chemin est coupé au début (« …/dossier/image.png ») : texte isolé pour garder son sens de lecture.
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
      corps.append(tr);
    }
    if (lignes.length === 0) corps.innerHTML = '<tr><td colspan="5">Aucune image dans le dessin.</td></tr>';
    table.append(corps);
    const l = lignes.find((x) => x.id === choisie);
    bMaj.disabled = l?.etat !== 'mise-a-jour';
    bReparer.disabled = l?.etat !== 'absent';
    bEditer.disabled = !l || l.etat === 'absent';
    bSupprimer.disabled = !l;
    apercu.hidden = !caseVoir.checked || !l;
    if (l && caseVoir.checked) apercu.src = l.apercu;
  };
  caseVoir.addEventListener('change', () => void rafraichir());
  boite.append(titre, table, apercu, boutons);
  boite.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape' || e.key === 'Enter') fond.remove();
  });
  fond.append(boite);
  document.body.append(fond);
  await rafraichir();
  fermer.focus();
}
