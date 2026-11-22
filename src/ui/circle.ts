/**
 * Cercle des 12 notes (ordre chromatique ou par quintes) : gamme, degrés, accord en cours,
 * note à jouer et note entendue. Aide visuelle pour comprendre gammes, arpèges et harmonie.
 */

const SHARP_FR = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
const FLAT_FR = ['Do', 'Ré♭', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Sol♭', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
const DEGREES = ['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'];

export const SCALES: Record<string, { label: string; steps: number[] }> = {
  major: { label: 'majeur', steps: [0, 2, 4, 5, 7, 9, 11] },
  minor: { label: 'mineur naturel', steps: [0, 2, 3, 5, 7, 8, 10] },
  harmonic: { label: 'mineur harmonique', steps: [0, 2, 3, 5, 7, 8, 11] },
  pentaMajor: { label: 'pentatonique majeure', steps: [0, 2, 4, 7, 9] },
  pentaMinor: { label: 'pentatonique mineure', steps: [0, 3, 5, 7, 10] },
  blues: { label: 'blues', steps: [0, 3, 5, 6, 7, 10] },
  dorian: { label: 'dorien', steps: [0, 2, 3, 5, 7, 9, 10] },
  mixolydian: { label: 'mixolydien', steps: [0, 2, 4, 5, 7, 9, 10] },
  chromatic: { label: 'chromatique', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
};

export function noteName(pc: number, flat = false): string {
  return (flat ? FLAT_FR : SHARP_FR)[((pc % 12) + 12) % 12];
}

export interface CircleState {
  tonic: number; // classe de hauteur 0..11
  scale: number[]; // demi-tons depuis la tonique
  flat?: boolean;
  chord?: number[]; // classes de hauteur de l'accord en cours
  target?: number | null; // note à jouer
  heard?: number | null; // note entendue
}

const NS = 'http://www.w3.org/2000/svg';

export class NoteCircle {
  private readonly svg: SVGSVGElement;
  order: 'chromatic' | 'fifths' = 'chromatic';
  private state: CircleState = { tonic: 0, scale: SCALES.major.steps };

  /** compact : cadrage serré, sans légendes (à côté du manche). */
  constructor(host: HTMLElement, private readonly compact = false) {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('viewBox', compact ? '14 14 272 272' : '0 0 300 300');
    this.svg.setAttribute('class', compact ? 'note-circle compact' : 'note-circle');
    this.svg.setAttribute('role', 'img');
    host.appendChild(this.svg);
    this.svg.addEventListener('click', () => {
      this.order = this.order === 'chromatic' ? 'fifths' : 'chromatic';
      this.render();
    });
    this.render();
  }

  set(s: Partial<CircleState>): void {
    this.state = { ...this.state, ...s };
    this.render();
  }

  private pos(pc: number, r: number): [number, number] {
    const idx = this.order === 'chromatic' ? pc : (pc * 7) % 12;
    const a = (idx / 12) * Math.PI * 2 - Math.PI / 2;
    return [150 + r * Math.cos(a), 150 + r * Math.sin(a)];
  }

  private el(tag: string, attrs: Record<string, string | number>, text?: string) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    if (text !== undefined) e.textContent = text;
    this.svg.appendChild(e);
    return e;
  }

  private render(): void {
    const { tonic, scale, flat, chord, target, heard } = this.state;
    this.svg.replaceChildren();
    const inScale = new Set(scale.map((s) => (tonic + s) % 12));
    this.el('circle', { cx: 150, cy: 150, r: 112, class: 'nc-ring' });
    // Polygone de la gamme et de l'accord
    const poly = (pcs: number[], cls: string) => {
      const pts = [...pcs]
        .map((pc) => ((pc % 12) + 12) % 12)
        .sort((a, b) => (this.order === 'chromatic' ? a - b : ((a * 7) % 12) - ((b * 7) % 12)))
        .map((pc) => this.pos(pc, 112).join(','))
        .join(' ');
      this.el('polygon', { points: pts, class: cls });
    };
    poly([...inScale], 'nc-scale-poly');
    if (chord?.length) poly(chord, 'nc-chord-poly');
    for (let pc = 0; pc < 12; pc++) {
      const [x, y] = this.pos(pc, 112);
      const isScale = inScale.has(pc);
      const isTonic = pc === tonic % 12;
      const isChord = chord?.some((c) => ((c % 12) + 12) % 12 === pc);
      const cls = ['nc-node', isScale ? 'in' : 'out', isTonic ? 'tonic' : '', isChord ? 'chord' : '', target === pc ? 'target' : '', heard === pc ? (isChord ? 'heard-chord' : isScale ? 'heard-in' : 'heard-out') : '']
        .filter(Boolean)
        .join(' ');
      this.el('circle', { cx: x, cy: y, r: (target === pc ? 22 : 18) + (this.compact ? 2 : 0), class: cls });
      this.el('text', { x, y: y + 4, class: `nc-label ${isScale ? 'in' : 'out'}` }, noteName(pc, flat));
      if (isScale) {
        const [dx, dy] = this.pos(pc, 80);
        this.el('text', { x: dx, y: dy + 4, class: 'nc-degree' }, DEGREES[(pc - tonic + 12) % 12]);
      }
    }
    this.el('text', { x: 150, y: this.compact ? 152 : 146, class: 'nc-center' }, noteName(tonic, flat));
    if (this.compact) {
      this.el('text', { x: 150, y: 176, class: 'nc-center-sub' }, this.order === 'chromatic' ? 'chromatique' : 'quintes');
      return;
    }
    this.el('text', { x: 150, y: 164, class: 'nc-center-sub' }, this.order === 'chromatic' ? 'cercle chromatique' : 'cercle des quintes');
    this.el('text', { x: 150, y: 296, class: 'nc-hint' }, 'clic : chromatique ↔ quintes');
  }
}

/** Classes de hauteur d'un accord nommé (« Am », « D7 », « F#m »…). */
export function chordPcs(name: string): number[] {
  const m = /^([A-G])([#b]?)(.*)$/.exec(name);
  if (!m) return [];
  const L: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const root = (L[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  const q = m[3];
  let iv = [0, 4, 7];
  if (/^m(?!aj)/.test(q)) iv = [0, 3, 7];
  if (/dim|°/.test(q)) iv = [0, 3, 6];
  if (/maj7/.test(q)) iv = [...iv, 11];
  else if (/7/.test(q)) iv = [...iv, 10];
  return iv.map((i) => (root + i) % 12);
}

/** Tonique et gamme à partir d'une armure alphaTex (« G », « eminor »…). */
export function scaleFromKey(key: string | undefined): { tonic: number; scale: number[]; flat: boolean } | null {
  if (!key) return null;
  const minor = key.endsWith('minor');
  const name = minor ? key.replace('minor', '') : key;
  const L: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  const t = L[name[0].toLowerCase()];
  if (t === undefined) return null;
  const tonic = (t + (name.includes('#') ? 1 : name.slice(1).includes('b') ? -1 : 0) + 12) % 12;
  const flat = name.slice(1).includes('b') || (!minor && name === 'F') || (minor && ['d', 'g', 'c', 'f'].includes(name.toLowerCase()));
  return { tonic, scale: minor ? SCALES.minor.steps : SCALES.major.steps, flat };
}
