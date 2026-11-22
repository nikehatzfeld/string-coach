import { describe, expect, it } from 'vitest';
import * as alphaTab from '@coderline/alphatab';
import { degreeToChord, lessons, mdToHtml, PROGRESSIONS } from '../src/courses/harmony-content';
import { chordPcs, scaleFromKey } from '../src/ui/circle';
import { songToAlphaTex } from '../src/songs/alphatex';
import { INSTRUMENTS } from '../src/songs/instruments';

alphaTab.Logger.logLevel = alphaTab.LogLevel.None;

describe('cours d’harmonie', () => {
  it('16 leçons avec un préréglage', () => {
    const ls = lessons();
    expect(ls.length).toBe(16);
    for (const l of ls) {
      expect(l.body.length).toBeGreaterThan(200);
      expect(mdToHtml(l.body)).toContain('<');
    }
  });
  it('degrés → accords', () => {
    expect(degreeToChord('V7', 2)).toBe('A7');
    expect(degreeToChord('vi', 2)).toBe('Bm');
    expect(degreeToChord('bVII', 2)).toBe('C');
    expect(degreeToChord('ii7', 7)).toBe('Am7');
    expect(chordPcs('A7')).toEqual([9, 1, 4, 7]);
    expect(scaleFromKey('eminor')).toMatchObject({ tonic: 4 });
  });
  it('chaque grille produit un accompagnement lisible par alphaTab', () => {
    for (const [k, p] of Object.entries(PROGRESSIONS)) {
      if (!p.bars.length) continue;
      const chords = p.bars.map((d) => degreeToChord(d, 2));
      const tex = songToAlphaTex(
        { id: k, title: k, composer: '', style: 'Exercices', level: 1, tempo: 80, timeSignature: [4, 4], notation: chords.map((c) => `r:1@${c}`).join(' | '), backing: p.style },
        INSTRUMENTS.violin,
        { keySignature: false },
      );
      const score = alphaTab.importer.ScoreLoader.loadAlphaTex(tex);
      expect(score.tracks.length, k).toBeGreaterThanOrEqual(3);
    }
  });
});
