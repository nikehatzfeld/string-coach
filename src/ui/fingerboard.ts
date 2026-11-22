import type { Fingering, Instrument } from '../songs/instruments';
import { midiName } from '../songs/notation';

/** Distance au sillet (fraction de la longueur vibrante) d'un demi-ton donné. */
export function fretPosition(fret: number): number {
  return 1 - Math.pow(2, -fret / 12);
}

/** Doigt conseillé en 1re position (0 = corde à vide, null = hors 1re position). */
export function suggestedFinger(fret: number, inst: Instrument): number | null {
  if (fret === 0) return 0;
  if (inst.id === 'violin') {
    if (fret <= 2) return 1;
    if (fret <= 4) return 2;
    if (fret === 5) return 3;
    if (fret <= 7) return 4;
    return null;
  }
  return fret <= 4 ? fret : null;
}

export interface BoardNote extends Fingering {
  midi: number;
  /** Doigt indiqué par la partition (0 = corde à vide) ; à défaut, doigt de 1re position. */
  finger?: number;
  /** Nom affiché (avec ♯ ou ♭). */
  name?: string;
  /** Doigt affiché avec sa variante (« 2↓ » = doigt bas, « 3↑ » = doigt haut). */
  label?: string;
  /** Position de la main gauche. */
  position?: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Une couleur par corde (de la plus aiguë à la plus grave), reprise partout : cordes, notes, étiquettes. */
export const STRING_COLORS: Record<string, string[]> = {
  violin: ['#5aa9ff', '#4fd1a5', '#ffb547', '#ff6b6b'], // Mi bleu, La vert, Ré orange, Sol rouge
  guitar: ['#b48cff', '#5aa9ff', '#4fd1a5', '#ffd166', '#ffa04d', '#ff6b6b'],
};
export const stringColor = (instId: string, string: number): string => (STRING_COLORS[instId] ?? STRING_COLORS.guitar)[string - 1] ?? '#ffb547';

/**
 * Schéma du manche, vu de dessus : sillet à gauche, corde la plus aiguë en haut
 * (même orientation que la tablature). Les positions des notes suivent la vraie
 * géométrie de la corde, comme les LEDs du futur manche DIY.
 */
export class Fingerboard {
  private readonly svg: SVGSVGElement;
  private width = 1000;
  private readonly height: number;
  private left = 100;
  private readonly right = 20;
  private readonly top = 22;
  private readonly gap: number;
  private maxFret = 12;
  private compact = false;
  private current: BoardNote[] = [];
  private next: BoardNote[] = [];
  private later: BoardNote[] = [];

  constructor(
    host: HTMLElement,
    private readonly inst: Instrument,
  ) {
    this.gap = inst.tuning.length === 4 ? 46 : 34;
    this.height = this.top * 2 + this.gap * (inst.tuning.length - 1) + 16;
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    this.svg.setAttribute('class', `fingerboard ${inst.id}`);
    this.svg.setAttribute('role', 'img');
    host.replaceChildren(this.svg);
    this.layout(host);
    new ResizeObserver(() => this.layout(host)).observe(host);
  }

  /** Petit écran : manche plus court (1re position) pour garder des repères lisibles. */
  private layout(host: HTMLElement): void {
    const compact = host.clientWidth > 0 && host.clientWidth < 640;
    if (compact === this.compact && this.svg.childNodes.length) return;
    this.compact = compact;
    this.width = compact ? 560 : 1000;
    this.left = this.inst.id === 'guitar' ? (compact ? 120 : 130) : compact ? 80 : 100;
    this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    this.maxFret = this.neededMax();
    this.render();
  }

  private neededMax(): number {
    const needed = Math.max(0, ...[...this.current, ...this.next, ...this.later].map((n) => n.fret));
    const base = this.compact ? 7 : this.inst.id === 'violin' ? 9 : 12;
    return needed > 12 ? 24 : needed > base ? 12 : base;
  }

  /** Notes en cours (pleines) et suivantes (contour). */
  /** Note en cours (pleine), suivante (anneau vert) et celle d'après (petit anneau discret). */
  show(current: BoardNote[], next: BoardNote[] = [], later: BoardNote[] = []): void {
    this.current = current;
    this.next = next;
    this.later = later;
    this.maxFret = this.neededMax();
    this.render();
  }

  private x(fret: number): number {
    const span = this.width - this.left - this.right;
    return this.left + (span * fretPosition(fret)) / fretPosition(this.maxFret);
  }

  /** Abscisse du point où poser le doigt (milieu de case à la guitare, sur la corde au violon). */
  private fingerX(fret: number): number {
    if (fret === 0) return this.left - 24;
    if (this.inst.id === 'guitar') return (this.x(fret - 1) + this.x(fret)) / 2;
    return this.x(fret);
  }

  private y(string: number): number {
    return this.top + 8 + (string - 1) * this.gap;
  }

  private el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text?: string) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    if (text !== undefined) e.textContent = text;
    this.svg.appendChild(e);
    return e;
  }

  private render(): void {
    this.svg.replaceChildren();
    const n = this.inst.tuning.length;
    const yTop = this.y(1) - 14;
    const yBot = this.y(n) + 14;
    const xEnd = this.x(this.maxFret);

    // Touche
    if (this.inst.id === 'violin') {
      this.el('path', {
        d: `M${this.left} ${yTop + 6} L${xEnd} ${yTop - 6} L${xEnd} ${yBot + 6} L${this.left} ${yBot - 6} Z`,
        class: 'fb-wood',
      });
      // Repères type « rubans » de débutant : doigts 1, 2, 3 et 4 en 1re position.
      for (const f of [2, 4, 5, 7]) {
        this.el('line', { x1: this.x(f), x2: this.x(f), y1: yTop, y2: yBot, class: 'fb-tape' });
      }
      for (let f = 1; f <= this.maxFret; f++) {
        if ([2, 4, 5, 7].includes(f)) continue;
        this.el('line', { x1: this.x(f), x2: this.x(f), y1: yTop + 4, y2: yTop + 10, class: 'fb-tick' });
      }
    } else {
      this.el('rect', { x: this.left, y: yTop, width: xEnd - this.left, height: yBot - yTop, class: 'fb-wood' });
      for (const f of [3, 5, 7, 9, 15, 17, 19, 21]) {
        if (f <= this.maxFret) this.el('circle', { cx: this.fingerX(f), cy: (yTop + yBot) / 2, r: 6, class: 'fb-inlay' });
      }
      for (const f of [12, 24]) {
        if (f > this.maxFret) continue;
        this.el('circle', { cx: this.fingerX(f), cy: yTop + (yBot - yTop) * 0.3, r: 6, class: 'fb-inlay' });
        this.el('circle', { cx: this.fingerX(f), cy: yTop + (yBot - yTop) * 0.7, r: 6, class: 'fb-inlay' });
      }
      for (let f = 1; f <= this.maxFret; f++) {
        this.el('line', { x1: this.x(f), x2: this.x(f), y1: yTop, y2: yBot, class: 'fb-fret' });
      }
    }
    // Numéros de case / demi-ton
    for (const f of this.inst.id === 'violin' ? [2, 4, 5, 7, 12, 24] : [1, 3, 5, 7, 9, 12, 15, 17, 19, 21, 24]) {
      if (f <= this.maxFret) this.el('text', { x: this.fingerX(f), y: yBot + 14, class: 'fb-num' }, String(f));
    }
    // Sillet
    this.el('rect', { x: this.left - 5, y: yTop, width: 6, height: yBot - yTop, class: 'fb-nut' });

    // Cordes
    for (let s = 1; s <= n; s++) {
      const y = this.y(s);
      const col = stringColor(this.inst.id, s);
      this.el('line', { x1: this.left, x2: this.width, y1: y, y2: y, class: 'fb-string', stroke: col, 'stroke-opacity': 0.55, 'stroke-width': 1.5 + (s - 1) * 0.6 });
      this.el('rect', { x: 4, y: y - 13, width: this.left - 62, height: 26, rx: 8, class: 'fb-chip', fill: col });
      this.el('text', { x: 4 + (this.left - 62) / 2, y: y + 6, class: 'fb-label' }, this.inst.stringNamesFr[s - 1]);
    }

    // Notes
    // Position en cours et légende des doigts bas / haut.
    const cur = this.current[0];
    if (cur?.position && this.inst.id === 'violin') {
      const txt = cur.position === 1 ? '1re position' : `${cur.position}e position`;
      this.el('text', { x: this.width - this.right, y: 14, class: 'fb-pos' }, `${txt}  ·  ↓ doigt bas  ↑ doigt haut`);
    }
    // Longueur de corde qui vibre : du doigt (ou du sillet) jusqu'au chevalet, hors de l'image à droite.
    for (const note of this.next) this.drawVibe(note, false);
    for (const note of this.current) this.drawVibe(note, true);
    for (const note of this.later) this.drawNote(note, 'later');
    for (const note of this.next) this.drawNote(note, 'next');
    for (const note of this.current) this.drawNote(note, 'current');

    const desc = this.current.map((c) => `${midiName(c.midi)} corde ${this.inst.stringNamesFr[c.string - 1]} ${c.fret === 0 ? 'à vide' : `position ${c.fret}`}`);
    this.svg.setAttribute('aria-label', desc.length ? `Manche : ${desc.join(', ')}` : 'Manche');
  }

  private drawVibe(note: BoardNote, current: boolean): void {
    const y = this.y(note.string);
    const x0 = note.fret === 0 ? this.left : this.x(note.fret);
    const col = stringColor(this.inst.id, note.string);
    if (!current) {
      this.el('line', { x1: x0, x2: this.width, y1: y, y2: y, stroke: col, 'stroke-width': 3, 'stroke-dasharray': '3 6', 'stroke-opacity': 0.6 });
      return;
    }
    // Ondulation : un fuseau qui bat (plus large au milieu), comme une vraie corde.
    const x1 = this.width;
    const mid = (x0 + x1) / 2;
    const a = 7;
    const g = this.el('g', { class: 'fb-vibe' });
    for (const sgn of [1, -1]) {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', `M${x0} ${y} Q${mid} ${y + sgn * a * 2} ${x1} ${y}`);
      p.setAttribute('stroke', col);
      p.setAttribute('class', 'fb-vibe-path');
      g.appendChild(p);
    }
    const glow = document.createElementNS(SVG_NS, 'line');
    for (const [k, v] of Object.entries({ x1: x0, x2: x1, y1: y, y2: y, stroke: col, class: 'fb-vibe-core' })) glow.setAttribute(k, String(v));
    g.appendChild(glow);
    if (note.fret === 0) {
      // Corde à vide : toute la corde vibre, étiquette nette au sillet.
      this.el('rect', { x: this.left - 52, y: y - 15, width: 46, height: 30, rx: 15, class: 'fb-open-chip', fill: col });
      this.el('text', { x: this.left - 29, y: y + 6, class: 'fb-open-text' }, 'à vide');
    }
  }

  private drawNote(note: BoardNote, kind: 'current' | 'next' | 'later'): void {
    const cx = this.fingerX(note.fret);
    const cy = this.y(note.string);
    const finger = note.finger ?? suggestedFinger(note.fret, this.inst);
    const label = note.label ?? (finger === null ? String(note.fret) : String(finger));
    const name = note.name ?? midiName(note.midi);
    if (kind === 'current') {
      if (note.fret === 0) {
        this.el('text', { x: this.left + 40, y: cy - 16, class: 'fb-note' }, name);
        return;
      }
      this.el('circle', { cx, cy, r: 18, class: 'fb-dot', fill: stringColor(this.inst.id, note.string) });
      this.el('text', { x: cx, y: cy + 5, class: 'fb-finger' }, label);
      this.el('text', { x: cx, y: cy - 19, class: 'fb-note' }, name);
    } else if (kind === 'next') {
      this.el('circle', { cx, cy, r: 15, class: 'fb-next' });
      this.el('text', { x: cx, y: cy + 5, class: 'fb-next-finger' }, label);
      this.el('text', { x: cx, y: cy + 27, class: 'fb-next-note' }, `puis ${name}`);
    } else {
      this.el('circle', { cx, cy, r: 9, class: 'fb-later' });
      this.el('text', { x: cx, y: cy + 4, class: 'fb-later-finger' }, label);
    }
  }
}
