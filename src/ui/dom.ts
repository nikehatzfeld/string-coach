export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Élément #${id} introuvable`);
  return el as T;
}

export function on<K extends keyof HTMLElementEventMap>(
  root: ParentNode,
  selector: string,
  type: K,
  handler: (el: HTMLElement, e: HTMLElementEventMap[K]) => void,
): void {
  root.querySelectorAll<HTMLElement>(selector).forEach((el) => el.addEventListener(type, (e) => handler(el, e)));
}

export const LEVEL_LABEL = ['', 'Débutant', 'Élémentaire', 'Intermédiaire', 'Avancé', 'Virtuose'];

export const STYLE_LOOK: Record<string, { icon: string; hue: number }> = {
  'Mes morceaux': { icon: '🎧', hue: 300 },
  Comptines: { icon: '🧸', hue: 330 },
  'Chanson française': { icon: '🇫🇷', hue: 220 },
  Classique: { icon: '🎻', hue: 265 },
  'Cinéma & TV': { icon: '🎬', hue: 0 },
  'Années 80': { icon: '📼', hue: 310 },
  'Années 90': { icon: '💿', hue: 190 },
  'Pop & rock': { icon: '🎸', hue: 15 },
  'Variété française': { icon: '🥖', hue: 230 },
  'Rap US': { icon: '🎤', hue: 50 },
  'Rap français': { icon: '🗼', hue: 260 },
  Noël: { icon: '🎄', hue: 140 },
  'Folk & monde': { icon: '🌍', hue: 30 },
  'Gospel & jazz': { icon: '🎺', hue: 45 },
  'Chants & cantiques': { icon: '🎶', hue: 195 },
  Blues: { icon: '🎸', hue: 205 },
  Fêtes: { icon: '🎉', hue: 300 },
  'Gammes & arpèges': { icon: '🎼', hue: 180 },
  Exercices: { icon: '💪', hue: 10 },
  Coffre: { icon: '🔒', hue: 0 },
  Import: { icon: '📁', hue: 250 },
};

export function starsHtml(n: number, max = 3): string {
  return `<span class="stars" aria-label="${n} étoile${n > 1 ? 's' : ''} sur ${max}">${'★'.repeat(n)}<span class="off">${'★'.repeat(max - n)}</span></span>`;
}

/** Anneau de progression SVG. */
export function ring(fraction: number, label: string, cls = ''): string {
  const r = 34;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction));
  return `<svg class="ring ${cls}" viewBox="0 0 80 80" aria-hidden="true">
    <circle cx="40" cy="40" r="${r}" class="ring-bg"/>
    <circle cx="40" cy="40" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}"/>
    <text x="40" y="46" class="ring-txt">${label}</text></svg>`;
}

export function download(name: string, data: BlobPart, type = 'application/octet-stream'): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
