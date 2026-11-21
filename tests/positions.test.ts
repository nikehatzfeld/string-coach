import { describe, expect, it } from 'vitest';
import * as alphaTab from '@coderline/alphatab';
import { INSTRUMENTS } from '../src/songs/instruments';
import { fingerFor, placeMelody, solfege } from '../src/songs/positions';
import { songToAlphaTex } from '../src/songs/alphatex';
import { LIBRARY } from '../src/songs/library';

alphaTab.Logger.logLevel = alphaTab.LogLevel.None;
const V = INSTRUMENTS.violin;
const G = INSTRUMENTS.guitar;

describe('doigtés du violon', () => {
  it('1re position : vrais doigts, jamais de « 5 »', () => {
    // La, Si, Do#, Ré, Mi sur la corde de La puis Mi à vide
    const p = placeMelody([69, 71, 73, 74, 76], V);
    expect(p.map((x) => x.finger)).toEqual([0, 1, 2, 3, 0]);
    expect(p.every((x) => x.position === 1)).toBe(true);
    // Do naturel sur la corde de La = 2e doigt bas
    expect(fingerFor(3, 1, V)).toBe(2);
  });
  it('monte en position seulement quand il le faut, une seule fois, puis redescend', () => {
    // Si5, Do6, Ré6 (hors 1re position), puis Ré4 (à vide) et Mi4
    const p = placeMelody([83, 84, 86, 62, 64], V);
    expect(p[1].position).toBeGreaterThan(1);
    expect(p[2].position).toBe(p[1].position);
    expect(p[4]).toMatchObject({ position: 1, finger: 1 });
    const fingered = p.filter((x) => x.finger > 0).map((x) => x.position);
    const shifts = fingered.filter((pos, i) => i > 0 && pos !== fingered[i - 1]).length;
    expect(shifts).toBeLessThanOrEqual(2);
    for (const x of p) expect(x.finger).toBeLessThanOrEqual(4);
  });
});

describe('doigtés de la guitare', () => {
  it('doigt = case − position + 1', () => {
    const p = placeMelody([64, 67, 69, 72, 76], G);
    for (const x of p) if (x.fret > 0) expect(x.finger).toBe(Math.min(4, x.fret - x.position + 1));
  });
  it('mélodie simple : octave choisie pour rester en 1re position', async () => {
    const { bestOctaveShift } = await import('../src/songs/positions');
    // Ode à la joie (Fa#4 à La4) : une octave plus bas à la guitare
    expect(bestOctaveShift([66, 64, 62, 67, 69], G)).toBe(-12);
    expect(bestOctaveShift([66, 64, 62, 67, 69], V)).toBe(0);
  });
});

describe('affichage', () => {
  it('noms des notes avec ♯ ou ♭', () => {
    expect(solfege(66, false)).toBe('Fa♯');
    expect(solfege(70, true)).toBe('Si♭');
  });
  it('chaque morceau : doigts 0 à 4, un nom par note, positions marquées', () => {
    for (const song of LIBRARY) {
      for (const inst of [V, G]) {
        const score = alphaTab.importer.ScoreLoader.loadAlphaTex(songToAlphaTex(song, inst));
        const beats = score.tracks[0].staves[0].bars.flatMap((b) => b.voices[0].beats);
        for (const b of beats) {
          if (b.isRest) continue;
          expect(b.lyrics?.length, `${song.id} : nom de note`).toBeTruthy();
          for (const n of b.notes) {
            if (n.isTieDestination) continue;
            if (n.fret === 0) expect(n.leftHandFinger).toBeLessThan(1);
            else expect([1, 2, 3, 4], `${song.id} ${inst.id}`).toContain(n.leftHandFinger);
          }
        }
      }
    }
  });
});
