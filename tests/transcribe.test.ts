import { describe, expect, it } from 'vitest';
import { estimateTempo, notesToNotation, type TNote } from '../src/practice/transcribe';
import { barBeats, parseNotation } from '../src/songs/notation';

// Au clair de la lune à 90 BPM (noires), avec un accompagnement plus grave.
const melody = [60, 60, 60, 62, 64, 62, 60, 64, 62, 62, 60];
const beat = 60 / 90;
const notes: TNote[] = [
  ...melody.map((m, i) => ({ start: 0.5 + i * beat + (i % 3) * 0.01, dur: beat * 0.9, midi: m + 12, amp: 0.8 })),
  ...[0, 4].map((b) => ({ start: 0.5 + b * beat, dur: beat * 4, midi: 48, amp: 0.5 })),
];

describe('transcription', () => {
  it('tempo estimé', () => {
    const t = estimateTempo(notes);
    expect([45, 90, 180].some((x) => Math.abs(t - x) <= 3)).toBe(true);
  });
  it('notation valide, mesures complètes, mélodie retrouvée', () => {
    const n = notesToNotation(notes, 90);
    const bars = parseNotation(n);
    for (const b of bars) expect(barBeats(b)).toBeCloseTo(4);
    const midis = bars.flat().filter((e) => e.kind === 'note').map((e) => e.midi);
    expect(midis.slice(0, 5)).toEqual([72, 72, 72, 74, 76]);
  });
});
