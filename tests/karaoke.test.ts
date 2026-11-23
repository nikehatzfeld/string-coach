import { describe, expect, it } from 'vitest';
import { alignLyrics, syllabifyLyrics, syllabifyWord, voiceSegments } from '../src/practice/karaoke';

describe('karaoké automatique', () => {
  it('syllabes françaises', () => {
    expect(syllabifyWord('chanson')).toEqual(['chan', 'son']);
    expect(syllabifyWord('patrie')).toEqual(['pa', 'trie']);
    expect(syllabifyWord('mot')).toEqual(['mot']);
    expect(syllabifyWord('liberté')).toEqual(['li', 'ber', 'té']);
  });
  it('paroles brutes → syllabes par ligne, crochets ignorés', () => {
    const s = syllabifyLyrics('[Couplet 1]\nAllons enfants\nde la patrie');
    expect(s.map((x) => x.s)).toEqual(['Al-', 'lons', 'en-', 'fants', 'de', 'la', 'pa-', 'trie']);
    expect(s.filter((x) => x.line).length).toBe(2);
  });
  it('activité vocale et calage', () => {
    const rate = 1000;
    const d = new Float32Array(rate * 6);
    for (let i = 0; i < d.length; i++) {
      const t = i / rate;
      d[i] = (t > 1 && t < 2.5) || (t > 3.5 && t < 5) ? Math.sin(i) * 0.5 : 0.001;
    }
    const segs = voiceSegments(d, rate);
    expect(segs.length).toBe(2);
    const al = alignLyrics(syllabifyLyrics('un deux trois\nquatre cinq six'), segs);
    expect(al.map((x) => x.s)).toEqual(['un', 'deux', 'trois', 'qua-', 'tre', 'cinq', 'six']);
    expect(al[0].t).toBeCloseTo(1, 0);
    expect(al[3].t).toBeGreaterThanOrEqual(3.4); // 2e ligne dans le 2e passage
  });
});
