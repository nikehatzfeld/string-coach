import { describe, expect, it } from 'vitest';
import { wordsToText, wordsToTimedSyllables } from '../src/practice/lyrics-asr';

const words = [
  { text: 'Allons', start: 1.0, end: 1.6 },
  { text: 'enfants', start: 1.6, end: 2.4 },
  { text: 'de', start: 4.0, end: 4.2 },
  { text: 'la', start: 4.2, end: 4.4 },
  { text: 'patrie', start: 4.4, end: 5.2 },
];

describe('paroles reconnues', () => {
  it('syllabes horodatées, lignes après un silence', () => {
    const s = wordsToTimedSyllables(words, 0.5);
    expect(s.map((x) => x.s)).toEqual(['Al-', 'lons', 'en-', 'fants', 'de', 'la', 'pa-', 'trie']);
    expect(s[0]).toMatchObject({ t: 0.5, line: true });
    expect(s[4]).toMatchObject({ t: 3.5, line: true });
  });
  it('texte relisible', () => {
    expect(wordsToText(words)).toBe('Allons enfants\nde la patrie');
  });
});
