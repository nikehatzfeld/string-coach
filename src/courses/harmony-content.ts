import courseMd from '../../docs/cours-harmonie.md?raw';
import { esc } from '../ui/dom';
import type { SCALES } from '../ui/circle';

/** Grilles d'accords en degrés (I = tonique). « m » = mineur, « 7 » = septième. */
export const PROGRESSIONS: Record<string, { label: string; bars: string[]; style: 'band' | 'strings' }> = {
  drone: { label: 'Bourdon seul', bars: [], style: 'strings' },
  'I-IV-V-I': { label: 'I – IV – V – I', bars: ['I', 'IV', 'V', 'I'], style: 'band' },
  'I-IV-V7-I': { label: 'I – IV – V7 – I', bars: ['I', 'IV', 'V7', 'I'], style: 'band' },
  'V7-I': { label: 'V7 → I (tension, résolution)', bars: ['V7', 'V7', 'I', 'I'], style: 'strings' },
  'II7-V7-I': { label: 'Quintes descendantes II7 – V7 – I', bars: ['II7', 'V7', 'I', 'I'], style: 'strings' },
  'I-V-vi-IV': { label: 'I – V – vi – IV (pop)', bars: ['I', 'V', 'vi', 'IV'], style: 'band' },
  'vi-IV-I-V': { label: 'vi – IV – I – V', bars: ['vi', 'IV', 'I', 'V'], style: 'band' },
  'I-vi-IV-V': { label: 'I – vi – IV – V (doo-wop)', bars: ['I', 'vi', 'IV', 'V'], style: 'band' },
  'i-iv-V-i': { label: 'i – iv – V7 – i (mineur)', bars: ['i', 'iv', 'V7', 'i'], style: 'strings' },
  'AA-period': { label: 'Période : I IV V V | I IV V7 I', bars: ['I', 'IV', 'V', 'V', 'I', 'IV', 'V7', 'I'], style: 'band' },
  blues: { label: 'Blues 12 mesures', bars: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'], style: 'band' },
  'ii-V-I': { label: 'ii7 – V7 – Imaj7 (jazz)', bars: ['ii7', 'ii7', 'V7', 'V7', 'Imaj7', 'Imaj7', 'Imaj7', 'Imaj7'], style: 'strings' },
  dorian: { label: 'Vamp dorien i – IV', bars: ['i', 'IV', 'i', 'IV'], style: 'band' },
  mixolydian: { label: 'Vamp mixolydien I – ♭VII', bars: ['I', 'bVII', 'I', 'bVII'], style: 'band' },
};

const DEG: Record<string, number> = { I: 0, II: 2, III: 4, IV: 5, V: 7, VI: 9, VII: 11 };
export const LETTERS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** « V7 » en Ré → « A7 » ; « vi » → « Bm » ; « bVII » → « C ». */
export function degreeToChord(deg: string, tonic: number): string {
  const m = /^(b?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/.exec(deg);
  if (!m) return 'C';
  const flat = m[1] ? -1 : 0;
  const roman = m[2];
  const minor = roman === roman.toLowerCase();
  const root = (tonic + DEG[roman.toUpperCase()] + flat + 12) % 12;
  const suffix = m[3] === 'maj7' ? 'maj7' : m[3];
  return `${LETTERS[root]}${minor ? 'm' : ''}${suffix}`;
}

export interface ImprovPreset {
  tonic: number;
  scale: keyof typeof SCALES;
  progression: keyof typeof PROGRESSIONS;
  bpm?: number;
}


/** Leçon du cours d'harmonie et d'improvisation (texte dans docs/cours-harmonie.md). */
export interface Lesson {
  n: number;
  title: string;
  body: string;
  preset: ImprovPreset;
}

/** Réglage de l'atelier pour chaque leçon (tonalité en demi-tons depuis Do). */
const PRESETS: Record<number, ImprovPreset> = {
  1: { tonic: 2, scale: 'major', progression: 'drone', bpm: 60 },
  2: { tonic: 2, scale: 'major', progression: 'drone', bpm: 60 },
  3: { tonic: 2, scale: 'major', progression: 'drone', bpm: 60 },
  4: { tonic: 2, scale: 'major', progression: 'II7-V7-I', bpm: 72 },
  5: { tonic: 2, scale: 'major', progression: 'drone', bpm: 60 },
  6: { tonic: 7, scale: 'major', progression: 'I-IV-V-I', bpm: 72 },
  7: { tonic: 7, scale: 'major', progression: 'I-IV-V-I', bpm: 80 },
  8: { tonic: 2, scale: 'major', progression: 'V7-I', bpm: 72 },
  9: { tonic: 9, scale: 'harmonic', progression: 'i-iv-V-i', bpm: 72 },
  10: { tonic: 2, scale: 'major', progression: 'I-V-vi-IV', bpm: 84 },
  11: { tonic: 7, scale: 'major', progression: 'AA-period', bpm: 80 },
  12: { tonic: 2, scale: 'pentaMajor', progression: 'I-IV-V-I', bpm: 80 },
  13: { tonic: 9, scale: 'blues', progression: 'blues', bpm: 84 },
  14: { tonic: 2, scale: 'major', progression: 'I-IV-V-I', bpm: 80 },
  15: { tonic: 7, scale: 'major', progression: 'ii-V-I', bpm: 90 },
  16: { tonic: 2, scale: 'dorian', progression: 'dorian', bpm: 84 },
};

export function lessons(): Lesson[] {
  const parts = courseMd.split(/\n(?=## Leçon \d+)/).slice(1);
  return parts.map((p) => {
    const m = /^## Leçon (\d+)\s*[—-]\s*(.+)$/m.exec(p)!;
    const n = Number(m[1]);
    const body = p
      .split('\n')
      .slice(1)
      .join('\n')
      .split(/\n## (?!Leçon)/)[0]
      .replace(/\n---\s*$/m, '')
      .trim();
    return { n, title: m[2].trim(), body, preset: PRESETS[n] ?? PRESETS[1] };
  });
}

/** Markdown minimal (titres, listes, tableaux, gras, citations) vers HTML sûr. */
export function mdToHtml(md: string): string {
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\[S(\d+)\]/g, '<sup class="src">[S$1]</sup>');
  const out: string[] = [];
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*$/.test(l) || /^---\s*$/.test(l)) {
      i++;
      continue;
    }
    const h = /^(#{2,4})\s+(.*)$/.exec(l);
    if (h) {
      out.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`);
      i++;
      continue;
    }
    if (/^\|/.test(l)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        if (!/^\|[\s:|-]+\|?\s*$/.test(lines[i])) rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '');
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) item += ' ' + lines[i++].trim();
        items.push(`<li>${inline(item)}</li>`);
      }
      out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^>/.test(l)) {
      const q: string[] = [];
      while (i < lines.length && /^>/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${mdToHtml(q.join('\n'))}</blockquote>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,4}\s|\||\s*([-*]|\d+\.)\s|>)/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

