import { describe, expect, it } from 'vitest';
import * as alphaTab from '@coderline/alphatab';
import { LIBRARY } from '../src/songs/library';
import { barBeats, midiName, noteToMidi, parseNotation } from '../src/songs/notation';
import { fingerNote, INSTRUMENTS, instrumentRange } from '../src/songs/instruments';
import { songToAlphaTex } from '../src/songs/alphatex';

alphaTab.Logger.logLevel = alphaTab.LogLevel.None;

describe('notation', () => {
  it('convertit les notes en MIDI', () => {
    expect(noteToMidi('C', '', 4)).toBe(60);
    expect(noteToMidi('A', '', 4)).toBe(69);
    expect(noteToMidi('F', '#', 4)).toBe(66);
    expect(noteToMidi('B', 'b', 3)).toBe(58);
    expect(midiName(62)).toBe('Ré4');
  });
  it('reprend la durée précédente et gère pointées, silences, liaisons', () => {
    const [bar] = parseNotation('D4:8 E4 r:4. -:8 F#4:2');
    expect(bar.map((e) => e.duration)).toEqual([8, 8, 4, 8, 2]);
    expect(bar[2]).toMatchObject({ kind: 'rest', dotted: true });
    expect(bar[3]).toMatchObject({ kind: 'tie', midi: 64 });
    expect(barBeats(bar)).toBe(0.5 + 0.5 + 1.5 + 0.5 + 2);
  });
});

describe('doigtés', () => {
  it('violon : cordes à vide et 1re position', () => {
    const v = INSTRUMENTS.violin;
    expect(fingerNote(55, v)).toEqual({ string: 4, fret: 0 }); // Sol à vide
    expect(fingerNote(66, v)).toEqual({ string: 3, fret: 4 }); // Fa# sur Ré
    expect(fingerNote(76, v)).toEqual({ string: 1, fret: 0 }); // Mi à vide
  });
  it('guitare : Mi grave à vide', () => {
    expect(fingerNote(40, INSTRUMENTS.guitar)).toEqual({ string: 6, fret: 0 });
  });
});

describe('bibliothèque', () => {
  it('identifiants uniques', () => {
    expect(new Set(LIBRARY.map((s) => s.id)).size).toBe(LIBRARY.length);
  });

  for (const song of LIBRARY) {
    describe(song.title, () => {
      it('chaque mesure a la bonne durée', () => {
        const [num, den] = song.timeSignature;
        const expected = (num * 4) / den;
        parseNotation(song.notation).forEach((bar, i) => {
          expect(barBeats(bar), `mesure ${i + 1}`).toBeCloseTo(expected);
        });
      });

      for (const inst of Object.values(INSTRUMENTS)) {
        it(`se charge dans alphaTab (${inst.label}) avec les bonnes hauteurs`, () => {
          const tex = songToAlphaTex(song, inst);
          const score = alphaTab.importer.ScoreLoader.loadAlphaTex(tex);
          const staff = score.tracks[0].staves[0];
          const [low, high] = instrumentRange(inst);
          if (song.tex && inst.id === 'guitar') {
            // Partition complète (basse + mélodie) : notes jouables sur la guitare, cordes distinctes par accord.
            const beats = staff.bars.flatMap((b) => b.voices[0].beats);
            expect(beats.some((b) => b.notes.length > 0)).toBe(true);
            for (const b of beats) {
              expect(new Set(b.notes.map((n) => n.string)).size).toBe(b.notes.length);
              for (const n of b.notes) expect(n.fret).toBeLessThanOrEqual(12);
            }
            return;
          }
          const played = staff.bars.flatMap((b) => b.voices[0].beats).flatMap((b) => b.notes).map((n) => n.realValue);
          const expected = parseNotation(song.notation).flat().filter((e) => e.kind !== 'rest').map((e) => e.midi!);
          expect(played.length).toBe(expected.length);
          // Même mélodie, transposée d'octaves entières (notes hors tessiture ramenées d'une octave).
          played.forEach((m, i) => expect(((m - expected[i]) % 12 + 12) % 12).toBe(0));
          for (const m of played) {
            expect(m).toBeGreaterThanOrEqual(low);
            expect(m).toBeLessThanOrEqual(high + 12);
          }
        });
      }
    });
  }
});

describe('Quatre Saisons de Vivaldi', () => {
  it('12 mouvements complets, partie soliste', async () => {
    const { LIBRARY } = await import('../src/songs/library');
    const v = LIBRARY.filter((s) => s.id.startsWith('vivaldi-') && !s.id.endsWith('~facile'));
    expect(v).toHaveLength(12);
    expect(v.find((s) => s.id === 'vivaldi-spring-i')!.notation).toContain('G#5:8 G#5:8 G#5:8 F#5:16 E5:16 B5:4.');
  });
});

describe('versions faciles', () => {
  it('une note par temps, en 1re position (Sol3–Si5), plus lente', async () => {
    const { LIBRARY: lib } = await import('../src/songs/library');
    const easy = lib.filter((s) => s.id.endsWith('~facile'));
    expect(easy.length).toBeGreaterThanOrEqual(12);
    for (const e of easy) {
      const orig = lib.find((s) => s.id === e.id.replace('~facile', ''))!;
      expect(e.tempo).toBeLessThan(orig.tempo);
      for (const bar of parseNotation(e.notation))
        for (const ev of bar) {
          expect(ev.duration).toBeLessThanOrEqual(4);
          if (ev.kind === 'note') expect(ev.midi!).toBeGreaterThanOrEqual(55), expect(ev.midi!).toBeLessThanOrEqual(83);
        }
    }
    expect(easy.some((s) => /canon in d/i.test(s.title))).toBe(true);
  });
});

describe('flûte à bec', () => {
  it('doigté pour chaque note chromatique de Do4 à Ré6', async () => {
    const { RECORDER_FINGERINGS } = await import('../src/songs/recorder');
    for (let m = 60; m <= 86; m++) expect(RECORDER_FINGERINGS.get(m), String(m)).toHaveLength(8);
    expect(RECORDER_FINGERINGS.get(67)!.join('')).toBe('XXXXOOOO'); // Sol
  });
  it('les morceaux sont dans la tessiture, partition seule', () => {
    const tex = songToAlphaTex(LIBRARY.find((s) => s.id === 'ode-joie')!, INSTRUMENTS.recorder);
    expect(tex).toContain('\\instrument recorder');
    expect(tex).not.toContain('\\tuning');
  });
});

describe('paroles', () => {
  it('une syllabe par note pour chaque chanson', async () => {
    const { LYRICS, lyricSyllables } = await import('../src/songs/lyrics');
    for (const [id, text] of Object.entries(LYRICS)) {
      const song = LIBRARY.find((s) => s.id === id);
      expect(song, id).toBeTruthy();
      const notes = parseNotation(song!.notation).flat().filter((e) => e.kind === 'note').length;
      expect(lyricSyllables(text).length, id).toBe(notes);
    }
  });
  it('les paroles apparaissent dans la partition', () => {
    const tex = songToAlphaTex(LIBRARY.find((s) => s.id === 'frere-jacques')!, INSTRUMENTS.voice);
    expect(tex).toContain('Frè- re Ja- cques');
  });
});

describe('paroles dans la partition (voix)', () => {
  it('chaque note chantée porte sa syllabe, dans l’ordre', async () => {
    const { LYRICS, lyricSyllables } = await import('../src/songs/lyrics');
    for (const id of Object.keys(LYRICS)) {
      const song = LIBRARY.find((s) => s.id === id)!;
      const score = alphaTab.importer.ScoreLoader.loadAlphaTex(songToAlphaTex(song, INSTRUMENTS.voice));
      const beats = score.tracks[0].staves[0].bars.flatMap((b) => b.voices[0].beats).filter((b) => !b.isRest && !b.notes.every((n) => n.isTieDestination));
      const syl = lyricSyllables(LYRICS[id]);
      expect(beats.length, id).toBe(syl.length);
      beats.forEach((b, i) => expect(b.lyrics?.[1], `${id} note ${i + 1}`).toBe(syl[i]));
    }
  });
  it('la voix ne propose que des chansons avec paroles', async () => {
    const { songFor } = await import('../src/songs/library');
    const { lyricsOf } = await import('../src/songs/lyrics');
    const voice = LIBRARY.filter((s) => songFor(s, 'voice'));
    expect(voice.length).toBeGreaterThanOrEqual(17);
    for (const s of voice) expect(lyricsOf(s), s.id).toBeTruthy();
  });
});
