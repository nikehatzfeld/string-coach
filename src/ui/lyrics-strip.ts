import { esc } from './dom';

/**
 * Bandeau de paroles façon karaoké : la phrase en cours, la syllabe à chanter surlignée,
 * les syllabes chantées en vert, la phrase suivante en dessous.
 */
export class LyricsStrip {
  private lines: { from: number; syl: string[] }[] = [];
  private index = -1;

  constructor(private readonly host: HTMLElement) {
    host.classList.add('lyrics-strip');
    host.hidden = true;
  }

  /** Syllabes dans l'ordre des notes ; une phrase se termine sur une ponctuation (ou toutes les 10 syllabes). */
  setSyllables(syl: string[]): void {
    this.lines = [];
    let cur: string[] = [];
    let from = 0;
    syl.forEach((s, i) => {
      cur.push(s);
      if (/[,.;:!?]$/.test(s) || cur.length >= 10) {
        this.lines.push({ from, syl: cur });
        cur = [];
        from = i + 1;
      }
    });
    if (cur.length) this.lines.push({ from, syl: cur });
    this.host.hidden = !syl.length;
    this.index = -1;
    this.render();
  }

  /** Syllabe en cours (index de la note chantée), -1 = avant le début. */
  setIndex(i: number): void {
    if (i === this.index) return;
    this.index = i;
    this.render();
  }

  private render(): void {
    if (!this.lines.length) return;
    const li = Math.max(0, this.lines.findIndex((l) => this.index < l.from + l.syl.length));
    const line = this.lines[li === -1 ? this.lines.length - 1 : li];
    const next = this.lines[li + 1];
    const word = (s: string, k: number) => {
      const cls = k < this.index ? 'done' : k === this.index ? 'now' : '';
      // « Frè- » + « re » : pas d'espace après une syllabe qui continue le mot.
      const cont = s.endsWith('-');
      return `<span class="${cls}">${esc(cont ? s.slice(0, -1) : s)}</span>${cont ? '' : ' '}`;
    };
    this.host.innerHTML = `<div class="ly-now">${line.syl.map((s, k) => word(s, line.from + k)).join('')}</div>${
      next ? `<div class="ly-next">${esc(next.syl.map((s) => (s.endsWith('-') ? s.slice(0, -1) : `${s} `)).join(''))}</div>` : ''
    }`;
  }
}
