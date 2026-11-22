import { describe, expect, it } from 'vitest';
import { pluck, stringsForStep } from '../src/audio/strum';
import { chromaFromSpectrum, matchChord } from '../src/practice/chord-detector';
import { shapeFor } from '../src/songs/chords';

const SR = 48000;
const N = 8192;

function fftMag(x: Float32Array): Float32Array {
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j], im[i], im[j]] = [re[j], re[i], im[j], im[i]];
  }
  for (let len = 2; len <= N; len <<= 1) {
    const a = (-2 * Math.PI) / len;
    for (let i = 0; i < N; i += len)
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(a * k), wi = Math.sin(a * k);
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
      }
  }
  const m = new Float32Array(N / 2);
  for (let i = 0; i < N / 2; i++) m[i] = Math.hypot(re[i], im[i]);
  return m;
}

function strum(chord: string): Float32Array {
  const shape = shapeFor(chord)!;
  const tuning = [40, 45, 50, 55, 59, 64];
  const out = new Float32Array(N + 4000);
  for (const s of stringsForStep('D', shape.frets)) {
    const p = pluck(tuning[s] + shape.frets[s], SR, 0.5);
    for (let i = 0; i < out.length; i++) out[i] += p[i] ?? 0;
  }
  return out.subarray(2000, 2000 + N);
}

describe('reconnaissance d’accords', () => {
  const chords = ['C', 'G', 'D', 'Am', 'Em', 'E', 'A', 'F', 'Dm', 'Bm'];
  it.each(chords)('%s grattée est reconnue', (c) => {
    const chroma = chromaFromSpectrum(fftMag(strum(c)), SR, N);
    expect(matchChord(chroma, c).ok).toBe(true);
  });
  it('un autre accord n’est pas accepté', () => {
    let wrong = 0;
    for (const c of chords) {
      const chroma = chromaFromSpectrum(fftMag(strum(c)), SR, N);
      for (const other of chords) if (other !== c && matchChord(chroma, other).ok) wrong++;
    }
    // Quelques confusions entre accords voisins (Am/C, Em/G) restent possibles.
    expect(wrong).toBeLessThanOrEqual(6);
  });
});
