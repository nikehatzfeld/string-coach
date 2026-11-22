import { RECORDER_FINGERINGS, recorderTip, type Hole } from '../songs/recorder';
import { solfege } from '../songs/positions';
import { esc } from './dom';

export interface MelodicNote {
  midi: number;
  name?: string;
}

/** Schéma de doigtés de flûte à bec : note en cours (grand), puis les deux suivantes. */
export class RecorderBoard {
  constructor(private readonly host: HTMLElement) {
    host.classList.add('recorder-board');
    this.show([]);
  }

  show(current: MelodicNote[], next: MelodicNote[] = [], later: MelodicNote[] = []): void {
    const c = current[0];
    if (!c) {
      this.host.innerHTML = `<div class="rb-empty">${flute(RECORDER_FINGERINGS.get(67)!, 'lg', true)}<p class="muted">Les doigtés s'affichent ici : ● bouché, ○ ouvert, ◐ à moitié. Le pouce (trou de derrière) est le rond à gauche.</p></div>`;
      return;
    }
    const block = (n: MelodicNote | undefined, size: 'lg' | 'sm', label: string) => {
      if (!n) return '';
      const f = RECORDER_FINGERINGS.get(n.midi);
      const name = n.name ?? solfege(n.midi, false);
      return `<div class="rb-note rb-${size}"><div class="rb-name">${label}${esc(name)}<small>${Math.floor(n.midi / 12) - 1}</small></div>${f ? flute(f, size) : '<p class="muted">hors tessiture</p>'}${size === 'lg' && recorderTip(n.midi) ? `<p class="rb-tip">${esc(recorderTip(n.midi))}</p>` : ''}</div>`;
    };
    this.host.innerHTML = `${block(c, 'lg', '')}${block(next[0], 'sm', 'puis ')}${block(later[0], 'sm', '')}`;
  }
}

/** Flûte vue de face, embouchure à gauche ; pouce dessiné au-dessus (il est derrière l'instrument). */
function flute(holes: Hole[], size: 'lg' | 'sm', ghost = false): string {
  const W = 420;
  const H = 90;
  const xs = [70, 112, 150, 188, 250, 288, 326, 364];
  const hole = (x: number, y: number, h: Hole, r: number, k: number) => {
    const fill = h === 'X' ? 'rb-closed' : h === 'O' ? 'rb-open' : 'rb-half';
    const half = h === 'H' ? `<path d="M${x} ${y - r} A${r} ${r} 0 0 0 ${x} ${y + r} Z" class="rb-closed"/>` : '';
    return `<g><circle cx="${x}" cy="${y}" r="${r}" class="${fill === 'rb-half' ? 'rb-open' : fill}"/>${half}<text x="${x}" y="${y + r + 13}" class="rb-hn">${k === 0 ? 'P' : k}</text></g>`;
  };
  const parts = [
    `<path d="M8 38 Q8 28 30 28 L400 30 Q412 30 412 45 Q412 60 400 60 L30 62 Q8 62 8 52 Z" class="rb-body"/>`,
    `<rect x="12" y="34" width="22" height="22" rx="4" class="rb-mouth"/>`,
    `<line x1="219" y1="22" x2="219" y2="70" class="rb-sep"/>`,
    hole(xs[0], 14, holes[0], 9, 0),
    ...holes.slice(1).map((h, i) => {
      const k = i + 1;
      // 6 et 7 : doubles trous dessinés comme deux petits ronds.
      if (k >= 6) {
        const x = xs[k];
        // Demi-trou : on bouche le gros trou, le petit reste ouvert.
        const a: Hole = h === 'O' ? 'O' : 'X';
        const b: Hole = h === 'X' ? 'X' : 'O';
        return `<g><circle cx="${x - 6}" cy="45" r="6" class="${a === 'X' ? 'rb-closed' : 'rb-open'}"/><circle cx="${x + 7}" cy="47" r="4.5" class="${b === 'X' ? 'rb-closed' : 'rb-open'}"/><text x="${x}" y="${45 + 23}" class="rb-hn">${k}</text></g>`;
      }
      return hole(xs[k], 45, h, 10, k);
    }),
    `<text x="140" y="86" class="rb-hand">main gauche</text><text x="305" y="86" class="rb-hand">main droite</text>`,
  ];
  return `<svg class="rb-svg rb-svg-${size} ${ghost ? "ghost" : ""}" viewBox="0 0 ${W} ${H + 4}" role="img" aria-label="Doigté">${parts.join('')}</svg>`;
}
