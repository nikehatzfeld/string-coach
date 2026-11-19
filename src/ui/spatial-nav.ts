/**
 * Navigation aux flèches pour télécommande TV et clavier :
 * déplace le focus vers l'élément focusable le plus proche dans la direction demandée.
 */
const FOCUSABLE = 'button:not([disabled]), [href], input, select, [tabindex]:not([tabindex="-1"])';

type Dir = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

function center(r: DOMRect) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function installSpatialNav(root: HTMLElement = document.body): void {
  root.addEventListener('keydown', (e) => {
    const dir = e.key as Dir;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(dir)) return;
    const active = document.activeElement as HTMLElement | null;
    // Les curseurs (input range) gardent gauche/droite pour leur valeur.
    if (active instanceof HTMLInputElement && active.type === 'range' && (dir === 'ArrowLeft' || dir === 'ArrowRight')) return;
    if (active instanceof HTMLInputElement && active.type === 'text') return;
    if (active instanceof HTMLSelectElement) return;

    const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!active || !items.includes(active)) {
      items[0]?.focus();
      e.preventDefault();
      return;
    }
    const from = center(active.getBoundingClientRect());
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const el of items) {
      if (el === active) continue;
      const to = center(el.getBoundingClientRect());
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const ok =
        (dir === 'ArrowRight' && dx > 4) ||
        (dir === 'ArrowLeft' && dx < -4) ||
        (dir === 'ArrowDown' && dy > 4) ||
        (dir === 'ArrowUp' && dy < -4);
      if (!ok) continue;
      const main = dir === 'ArrowLeft' || dir === 'ArrowRight' ? Math.abs(dx) : Math.abs(dy);
      const cross = dir === 'ArrowLeft' || dir === 'ArrowRight' ? Math.abs(dy) : Math.abs(dx);
      const score = main + cross * 2;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best) {
      best.focus();
      best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      e.preventDefault();
    }
  });
}
