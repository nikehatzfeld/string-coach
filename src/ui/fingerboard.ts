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
}

const SVG_NS = 'http://www.w3.org/2000/svg';

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

  constructor(
    host: HTMLElement,
    private readonly inst: Instrument,
  ) {
    this.gap = inst.tuning.length === 4 ? 30 : 24;
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
    const needed = Math.max(0, ...this.current.map((n) => n.fret), ...this.next.map((n) => n.fret));
    const base = this.compact ? 7 : 12;
    return needed > 12 ? 24 : needed > base ? 12 : base;
  }

  /** Notes en cours (pleines) et suivantes (contour). */
  show(current: BoardNote[], next: BoardNote[] = []): void {
    this.current = current;
    this.next = next;
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
      this.el('line', { x1: this.left, x2: xEnd, y1: y, y2: y, class: 'fb-string', 'stroke-width': 1 + (s - 1) * 0.45 });
      this.el('text', { x: this.left - 48, y: y + 5, class: 'fb-label' }, this.inst.stringNamesFr[s - 1]);
    }

    // Notes
    for (const note of this.next) this.drawNote(note, false);
    for (const note of this.current) this.drawNote(note, true);

    const desc = this.current.map((c) => `${midiName(c.midi)} corde ${this.inst.stringNamesFr[c.string - 1]} ${c.fret === 0 ? 'à vide' : `position ${c.fret}`}`);
    this.svg.setAttribute('aria-label', desc.length ? `Manche : ${desc.join(', ')}` : 'Manche');
  }

  private drawNote(note: BoardNote, current: boolean): void {
    const cx = this.fingerX(note.fret);
    const cy = this.y(note.string);
    const finger = suggestedFinger(note.fret, this.inst);
    this.el('circle', { cx, cy, r: current ? 13 : 11, class: current ? 'fb-dot' : 'fb-next' });
    if (current) {
      const label = finger === null ? String(note.fret) : finger === 0 ? '0' : String(finger);
      this.el('text', { x: cx, y: cy + 5, class: 'fb-finger' }, label);
      this.el('text', { x: cx, y: cy - 18, class: 'fb-note' }, midiName(note.midi));
    }
  }
}
