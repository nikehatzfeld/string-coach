import type { Song } from '../songs/alphatex';
import { matchChord } from './chord-detector';

/**
 * Transcription audio → partition (Basic Pitch de Spotify, licence Apache-2.0), entièrement dans
 * le navigateur. Le résultat est un morceau personnel, gardé sur l'appareil.
 */

export interface TNote {
  start: number; // secondes
  dur: number;
  midi: number;
  amp: number;
}

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const DUR: [number, string][] = [
  [16, '1'],
  [12, '2.'],
  [8, '2'],
  [6, '4.'],
  [4, '4'],
  [3, '8.'],
  [2, '8'],
  [1, '16'],
];

/** Tempo le plus probable (BPM) : celui qui aligne le mieux les attaques sur la grille des doubles croches. */
export function estimateTempo(notes: TNote[], lo = 60, hi = 160): number {
  const onsets = notes.map((n) => n.start);
  if (onsets.length < 4) return 90;
  let best = 90;
  let bestScore = -Infinity;
  for (let bpm = lo; bpm <= hi; bpm++) {
    const beat = 60 / bpm;
    let score = 0;
    for (const t of onsets) {
      const ph = (t / beat) % 1;
      score += Math.cos(2 * Math.PI * ph) * 1.0 + Math.cos(4 * Math.PI * ph) * 0.5;
    }
    // Légère préférence pour les tempos moyens.
    score -= Math.abs(bpm - 100) * 0.01 * onsets.length;
    if (score > bestScore) {
      bestScore = score;
      best = bpm;
    }
  }
  return best;
}

/** Mélodie : à chaque attaque, la note la plus haute assez forte (la « ligne de chant »). */
export function melodyLine(notes: TNote[]): TNote[] {
  const sorted = [...notes].sort((a, b) => a.start - b.start || b.midi - a.midi);
  const maxAmp = Math.max(...notes.map((n) => n.amp), 0.01);
  const out: TNote[] = [];
  for (const n of sorted) {
    if (n.amp < maxAmp * 0.25) continue;
    const last = out[out.length - 1];
    if (last && Math.abs(n.start - last.start) < 0.06) {
      if (n.midi > last.midi) out[out.length - 1] = n;
      continue;
    }
    out.push(n);
  }
  return out;
}

/** Notation compacte (notation.ts) quantifiée à la double croche, accords par mesure si demandé. */
export function notesToNotation(all: TNote[], bpm: number, ts: [number, number] = [4, 4], withChords = true): string {
  const mel = melodyLine(all);
  if (!mel.length) return '';
  const six = 60 / bpm / 4; // durée d'une double croche
  const barLen = (ts[0] * 16) / ts[1];
  const t0 = mel[0].start;
  const q = (t: number) => Math.max(0, Math.round((t - t0) / six));
  const ev = mel.map((n, i) => {
    const s = q(n.start);
    const nextS = i + 1 < mel.length ? q(mel[i + 1].start) : s + Math.max(1, Math.round(n.dur / six));
    return { s, e: Math.max(s + 1, Math.min(nextS, s + Math.max(1, Math.round(n.dur / six)))), midi: n.midi };
  });
  // Notes à la même position après quantification : on garde la première.
  const uniq = ev.filter((x, i) => i === 0 || x.s > ev[i - 1].s);
  const total = uniq[uniq.length - 1].e;
  const nBars = Math.ceil(total / barLen);
  const chords: (string | null)[] = [];
  if (withChords) {
    for (let b = 0; b < nBars; b++) {
      const chroma = new Array(12).fill(0);
      const from = t0 + b * barLen * six;
      const to = from + barLen * six;
      for (const n of all) {
        const ov = Math.min(n.start + n.dur, to) - Math.max(n.start, from);
        if (ov > 0) chroma[n.midi % 12] += ov * n.amp;
      }
      const top = Math.max(...chroma);
      // Une seule ligne mélodique (aucune note simultanée) : pas d'accord inventé.
      const inBar = all.filter((n) => n.start < to && n.start + n.dur > from);
      const poly = inBar.some((a) => inBar.some((b) => b !== a && b.midi % 12 !== a.midi % 12 && b.start < a.start + a.dur * 0.8 && a.start < b.start + b.dur * 0.8));
      if (top <= 0 || !poly) {
        chords.push(null);
        continue;
      }
      const norm = chroma.map((c) => c / top);
      const m = matchChord(norm, 'C');
      chords.push(m.bestScore > 0.6 ? m.best : null);
    }
  }
  const bars: string[] = [];
  let k = 0;
  let lastChord: string | null = null;
  for (let b = 0; b < nBars; b++) {
    const b0 = b * barLen;
    const b1 = b0 + barLen;
    const toks: string[] = [];
    let t = b0;
    let first = true;
    const push = (name: string, len: number, chordable: boolean) => {
      let left = len;
      let firstPiece = true;
      while (left > 0) {
        const [v, d] = DUR.find(([v]) => v <= left)!;
        const tok = `${firstPiece ? name : name === 'r' ? 'r' : '-'}:${d}`;
        const ch = first && chordable && withChords && chords[b] && chords[b] !== lastChord ? `@${chords[b]}` : '';
        if (ch) lastChord = chords[b];
        toks.push(tok + ch);
        first = false;
        firstPiece = false;
        left -= v;
      }
    };
    while (t < b1) {
      while (k < uniq.length && uniq[k].e <= t) k++;
      const n = uniq[k];
      if (n && n.s <= t) {
        const end = Math.min(n.e, b1);
        const name = t === n.s ? `${NAMES[n.midi % 12]}${Math.floor(n.midi / 12) - 1}` : '-';
        push(name, end - t, true);
        t = end;
      } else {
        const end = Math.min(n ? n.s : b1, b1);
        push('r', end - t, true);
        t = end;
      }
    }
    bars.push(toks.join(' '));
  }
  return bars.join(' | ');
}

export function notesToSong(notes: TNote[], title: string, bpm: number, ts: [number, number] = [4, 4], withChords = true): Song {
  return {
    id: `user-${Date.now()}`,
    title,
    composer: 'Ma transcription',
    style: 'Mes morceaux',
    level: 3,
    tempo: bpm,
    timeSignature: ts,
    notation: notesToNotation(notes, bpm, ts, withChords),
  };
}

/** Décode un fichier audio (ou vidéo) et le ramène en mono 22 050 Hz, comme l'attend Basic Pitch. */
async function decodeTo22k(file: File): Promise<Float32Array> {
  const buf = await file.arrayBuffer();
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const audio = await ctx.decodeAudioData(buf);
  await ctx.close();
  const off = new OfflineAudioContext(1, Math.ceil(audio.duration * 22050), 22050);
  const src = off.createBufferSource();
  src.buffer = audio;
  src.connect(off.destination);
  src.start();
  const out = await off.startRendering();
  return out.getChannelData(0);
}

export async function transcribeFile(file: File, onProgress: (p: number, msg: string) => void, maxSeconds = 240): Promise<TNote[]> {
  onProgress(0, 'Lecture du fichier…');
  let data = await decodeTo22k(file);
  if (data.length > maxSeconds * 22050) data = data.subarray(0, maxSeconds * 22050);
  onProgress(0.05, 'Chargement du modèle…');
  const bp = await import('@spotify/basic-pitch');
  const model = new bp.BasicPitch(`${import.meta.env.BASE_URL}basic-pitch/model.json`);
  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];
  await model.evaluateModel(
    data,
    (f, o, c) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    (p) => onProgress(0.05 + p * 0.9, `Analyse : ${Math.round(p * 100)} %`),
  );
  onProgress(0.97, 'Notes…');
  const ev = bp.noteFramesToTime(bp.addPitchBendsToNoteEvents(contours, bp.outputToNotesPoly(frames, onsets, 0.5, 0.3, 8)));
  onProgress(1, 'Terminé');
  return ev.map((n) => ({ start: n.startTimeSeconds, dur: n.durationSeconds, midi: n.pitchMidi, amp: n.amplitude }));
}
