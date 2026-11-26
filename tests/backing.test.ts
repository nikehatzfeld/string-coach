import { describe, expect, it } from 'vitest';
import * as alphaTab from '@coderline/alphatab';
import { parseChord, splitDuration } from '../src/songs/backing';
import { songHasBacking, songToAlphaTex } from '../src/songs/alphatex';
import { INSTRUMENTS } from '../src/songs/instruments';
import { LIBRARY } from '../src/songs/library';

alphaTab.Logger.logLevel = alphaTab.LogLevel.None;

describe('accompagnement', () => {
  it('lit les accords', () => {
    expect(parseChord('Am')).toEqual({ root: 9, intervals: [0, 3, 7] });
    expect(parseChord('F#m')?.root).toBe(6);
    expect(parseChord('E7')).toEqual({ root: 4, intervals: [0, 4, 7, 10] });
    expect(parseChord('Bb')?.root).toBe(10);
  });
  it('découpe les durées', () => {
    expect(splitDuration(3)).toEqual(['2{d}']);
    expect(splitDuration(4.5)).toEqual(['1', '8']);
  });

  const withBacking = LIBRARY.filter(songHasBacking);
  it('une bonne partie de la bibliothèque a un accompagnement', () => {
    expect(withBacking.length).toBeGreaterThan(30);
  });
  for (const song of withBacking) {
    it(`${song.title} : pistes alignées sur la mélodie`, () => {
      const score = alphaTab.importer.ScoreLoader.loadAlphaTex(songToAlphaTex(song, INSTRUMENTS.violin));
      expect(score.tracks.length).toBeGreaterThanOrEqual(3);
      const bars = score.tracks[0].staves[0].bars.length;
      const programs = score.tracks.slice(1).map((t) => (t.isPercussion ? 'drums' : t.playbackInfo.program));
      // Basse (acoustique ou électrique) et accords (cordes, guitare ou nappe de chœur pour le rap).
      expect(programs.some((p) => p === 32 || p === 33 || p === 38)).toBe(true);
      expect(programs.some((p) => p === 48 || p === 24 || p === 52 || p === 4)).toBe(true);
      const [num, den] = song.timeSignature;
      const barTicks = (num * 4 * 960) / den;
      for (const t of score.tracks.slice(1)) {
        expect(t.staves[0].bars.length).toBe(bars);
        for (const bar of t.staves[0].bars) {
          const total = bar.voices[0].beats.reduce((s, b) => s + b.playbackDuration, 0);
          expect(total).toBe(barTicks);
        }
      }
    });
  }
});

describe('parties', async () => {
  const { sectionsFor } = await import('../src/songs/alphatex');
  it('découpe en tranches de 4 mesures, dernière tranche courte fusionnée', () => {
    expect(sectionsFor(8)).toEqual([]);
    expect(sectionsFor(16).map((s) => [s.first, s.last])).toEqual([[0, 3], [4, 7], [8, 11], [12, 15]]);
    expect(sectionsFor(17).map((s) => [s.first, s.last]).at(-1)).toEqual([12, 16]);
    expect(sectionsFor(10, [['Couplet', 1, 4], ['Refrain', 5, 10]]).map((s) => s.name)).toEqual(['Couplet', 'Refrain']);
  });
});

describe('beat hip-hop', () => {
  it('rap : batterie, basse et nappe, mesures complètes', async () => {
    const { importLibrary } = await import('../src/songs/library-import');
    const { songToAlphaTex } = await import('../src/songs/alphatex');
    const { INSTRUMENTS } = await import('../src/songs/instruments');
    const alphaTab = await import('@coderline/alphatab');
    const r = importLibrary({ songs: [{ title: 'Rap test', style: 'Rap français', tempo: 88, chords: 'Am | F | C | G' }] });
    const tex = songToAlphaTex(r.songs[0], INSTRUMENTS.voice);
    const score = alphaTab.importer.ScoreLoader.loadAlphaTex(tex);
    expect(score.tracks.map((t) => t.name)).toEqual(['Voix', 'Rhodes', 'Nappe', 'Basse', 'Batterie']);
    for (const t of score.tracks.slice(1)) for (const b of t.staves[0].bars) expect(b.voices[0].beats.reduce((a, x) => a + x.playbackDuration, 0)).toBe(3840);
  });
});
