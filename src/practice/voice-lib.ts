import type { Song } from '../songs/alphatex';
import { beatsOf, parseNotation } from '../songs/notation';

/** Note d'une mélodie dans le temps (en temps = noires). */
export interface TimedNote {
  start: number;
  dur: number;
  midi: number;
}

/** Mélodie d'un morceau, liaisons fusionnées, ramenée dans une tessiture vocale. */
export function melodyTimeline(song: Song, range: [number, number] = [55, 76]): TimedNote[] {
  const out: TimedNote[] = [];
  let t = 0;
  for (const bar of parseNotation(song.notation)) {
    for (const ev of bar) {
      const d = beatsOf(ev);
      if (ev.kind === 'note') out.push({ start: t, dur: d, midi: ev.midi as number });
      else if (ev.kind === 'tie' && out.length) out[out.length - 1].dur += d;
      t += d;
    }
  }
  if (!out.length) return out;
  const ms = out.map((n) => n.midi);
  const fit = (s: number) => ms.filter((m) => m + s >= range[0] && m + s <= range[1]).length;
  const shift = [0, -12, 12, -24, 24].reduce((b, s) => (fit(s) > fit(b) ? s : b), 0);
  return out.map((n) => {
    let m = n.midi + shift;
    while (m > range[1]) m -= 12;
    while (m < range[0]) m += 12;
    return { ...n, midi: m };
  });
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];

/** Tonalité majeure la plus probable (tonique 0..11) d'après les notes jouées. */
export function bestMajorKey(midis: number[]): number {
  let best = 0;
  let bestScore = -1;
  for (let k = 0; k < 12; k++) {
    const set = new Set(MAJOR.map((s) => (k + s) % 12));
    // Bonus pour une mélodie qui finit sur la tonique.
    const score = midis.filter((m) => set.has(m % 12)).length + (midis.length && midis[midis.length - 1] % 12 === k ? 2 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = k;
    }
  }
  return best;
}

/** Note de la gamme située `steps` degrés plus haut (négatif = plus bas). */
export function diatonicStep(midi: number, tonic: number, steps: number): number {
  const scale: number[] = [];
  for (let o = -2; o <= 9; o++) for (const s of MAJOR) scale.push(tonic + s + o * 12);
  // Note la plus proche dans la gamme (une note étrangère est rapprochée de son voisin le plus proche).
  let i = 0;
  let bestD = 99;
  scale.forEach((m, k) => {
    const d = Math.abs(m - midi);
    if (d < bestD) {
      bestD = d;
      i = k;
    }
  });
  return (scale[i + steps] ?? midi) + (midi - scale[i]);
}

/** Deuxième voix en tierces parallèles (au-dessous par défaut), dans la gamme du morceau. */
export function harmonyLine(mel: TimedNote[], interval: 'third-below' | 'third-above' | 'sixth-below' = 'third-below'): TimedNote[] {
  const tonic = bestMajorKey(mel.map((n) => n.midi));
  const steps = interval === 'third-below' ? -2 : interval === 'third-above' ? 2 : -5;
  return mel.map((n) => ({ ...n, midi: diatonicStep(n.midi, tonic, steps) }));
}

/** Note qui sonne à l'instant t (en temps), ou null. */
export function noteAt(line: TimedNote[], t: number): TimedNote | null {
  for (const n of line) if (t >= n.start && t < n.start + n.dur) return n;
  return null;
}

/** Type de voix indicatif d'après la tessiture chantée confortablement. */
export function voiceType(low: number, high: number): string {
  const mid = (low + high) / 2;
  if (mid < 55) return 'basse';
  if (mid < 59) return 'baryton';
  if (mid < 63) return 'ténor';
  if (mid < 66) return 'alto (ou contralto)';
  if (mid < 70) return 'mezzo-soprano';
  return 'soprano';
}

/** Pente d'une courbe de parole (demi-tons par seconde) sur la dernière partie : question ↗ ou affirmation ↘. */
export function contourSlope(points: { t: number; m: number }[], lastFraction = 0.4): number {
  if (points.length < 4) return 0;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const from = t1 - (t1 - t0) * lastFraction;
  const pts = points.filter((p) => p.t >= from);
  if (pts.length < 3) return 0;
  const n = pts.length;
  const mt = pts.reduce((a, p) => a + p.t, 0) / n;
  const mm = pts.reduce((a, p) => a + p.m, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    num += (p.t - mt) * (p.m - mm);
    den += (p.t - mt) ** 2;
  }
  return den ? (num / den) * 1000 : 0;
}

/** Étendue (demi-tons) d'une courbe : 0–2 = monotone (robot), > 8 = très expressif. */
export function contourRange(points: { m: number }[]): number {
  if (points.length < 2) return 0;
  const ms = points.map((p) => p.m).sort((a, b) => a - b);
  // Ignore les extrêmes (erreurs de détection).
  const lo = ms[Math.floor(ms.length * 0.1)];
  const hi = ms[Math.floor(ms.length * 0.9)];
  return hi - lo;
}
