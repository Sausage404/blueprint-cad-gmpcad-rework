// Infobulle jaune : apparaît après 0,8 s de survol (cahier des charges, section 2).
const DELAI_MS = 800;

const bulle = document.getElementById('infobulle') as HTMLDivElement;
let minuterie = 0;

export function montrerInfobulle(texte: string, x: number, y: number): void {
  bulle.textContent = texte;
  bulle.hidden = false;
  // Rester dans la fenêtre.
  const r = bulle.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - r.width - 4);
  const top = y + r.height + 4 > window.innerHeight ? y - r.height - 24 : y;
  bulle.style.left = `${Math.max(4, left)}px`;
  bulle.style.top = `${top}px`;
}

export function cacherInfobulle(): void {
  clearTimeout(minuterie);
  bulle.hidden = true;
}

/** Attache une infobulle à un élément. `texte` peut être recalculé à chaque survol. */
export function infobulle(el: HTMLElement, texte: () => string | null): void {
  el.addEventListener('pointerenter', (e) => {
    clearTimeout(minuterie);
    const t = texte();
    if (!t) return;
    const x = e.clientX + 8;
    const y = e.clientY + 20;
    minuterie = window.setTimeout(() => montrerInfobulle(t, x, y), DELAI_MS);
  });
  el.addEventListener('pointerleave', cacherInfobulle);
  el.addEventListener('pointerdown', cacherInfobulle);
}
