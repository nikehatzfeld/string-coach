import type { Song } from '../songs/alphatex';
import { matchChord } from './chord-detector';
import { voiceSegments } from './karaoke';

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
export function notesToNotation(all: TNote[], bpm: number, ts: [number, number] = [4, 4], withChords = true, opts: { t0?: number; melody?: TNote[] } = {}): string {
  const mel = opts.melody ? melodyLine(opts.melody) : melodyLine(all);
  if (!mel.length) return '';
  const six = 60 / bpm / 4; // durée d'une double croche
  const barLen = (ts[0] * 16) / ts[1];
  const t0 = opts.t0 ?? mel[0].start;
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

export function notesToSong(notes: TNote[], title: string, bpm: number, ts: [number, number] = [4, 4], withChords = true, audioId?: string): Song {
  const first = melodyLine(notes)[0];
  return {
    ...(audioId && first ? { audio: { id: audioId, offset: first.start } } : {}),
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

async function decode(file: Blob): Promise<AudioBuffer> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    return await ctx.decodeAudioData(await file.arrayBuffer());
  } finally {
    void ctx.close();
  }
}

/**
 * Rendu hors ligne d'un graphe sur un fichier stéréo.
 * - « voix » : canal central (L+R), bande 100–4 000 Hz : là où la voix domine ;
 * - « instru » : côté stéréo (L−R) qui annule ce qui est au centre (la voix), plus les graves du centre
 *   (basse, grosse caisse) pour garder le groove. Technique classique du karaoké.
 */
async function render(audio: AudioBuffer, mode: 'voice' | 'instru', rate: number, maxSeconds: number): Promise<Float32Array> {
  const len = Math.min(audio.length, Math.floor(audio.sampleRate * maxSeconds));
  const off = new OfflineAudioContext(1, Math.ceil((len / audio.sampleRate) * rate), rate);
  const src = off.createBufferSource();
  src.buffer = audio;
  const split = off.createChannelSplitter(2);
  src.connect(split);
  const L = off.createGain();
  const R = off.createGain();
  split.connect(L, 0);
  split.connect(R, audio.numberOfChannels > 1 ? 1 : 0);
  const filt = (type: BiquadFilterType, f: number) => {
    const b = off.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    return b;
  };
  if (mode === 'voice') {
    L.gain.value = 0.5;
    R.gain.value = 0.5;
    const hp = filt('highpass', 100);
    const lp = filt('lowpass', 4000);
    L.connect(hp);
    R.connect(hp);
    hp.connect(lp).connect(off.destination);
  } else {
    // Côté : L − R (la voix, au centre, s'annule).
    L.gain.value = 0.9;
    R.gain.value = -0.9;
    const hp = filt('highpass', 140);
    L.connect(hp);
    R.connect(hp);
    hp.connect(off.destination);
    // Graves du centre : basse et grosse caisse.
    const mL = off.createGain();
    const mR = off.createGain();
    mL.gain.value = 0.5;
    mR.gain.value = 0.5;
    split.connect(mL, 0);
    split.connect(mR, audio.numberOfChannels > 1 ? 1 : 0);
    const lp = filt('lowpass', 140);
    mL.connect(lp);
    mR.connect(lp);
    lp.connect(off.destination);
  }
  src.start();
  return (await off.startRendering()).getChannelData(0);
}

/** Mono 16 bits WAV (pour stocker l'instru calculée). */
export function toWav(data: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + data.length * 2);
  const v = new DataView(buf);
  const w = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + data.length * 2, true);
  w(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, data.length * 2, true);
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  const k = peak > 0.99 ? 0.99 / peak : 1;
  for (let i = 0; i < data.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i] * k)) * 32767, true);
  return new Blob([buf], { type: 'audio/wav' });
}

async function pitchNotes(data: Float32Array, onProgress: (p: number, msg: string) => void): Promise<TNote[]> {
  onProgress(0.15, 'Chargement du modèle…');
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
    (p) => onProgress(0.15 + p * 0.8, `Analyse des notes : ${Math.round(p * 100)} %`),
  );
  const ev = bp.noteFramesToTime(bp.addPitchBendsToNoteEvents(contours, bp.outputToNotesPoly(frames, onsets, 0.5, 0.3, 8)));
  return ev.map((n) => ({ start: n.startTimeSeconds, dur: n.durationSeconds, midi: n.pitchMidi, amp: n.amplitude }));
}

export interface TranscribeResult {
  notes: TNote[];
  /** Instru (voix retirée ou piste fournie), à jouer en play-along. */
  instru: Blob | null;
  /** La voix a été retirée par calcul (moins propre qu'une piste séparée). */
  computedInstru: boolean;
  /** Fichier mono : impossible de retirer la voix. */
  mono: boolean;
  /** Passages où la voix est présente (s, dans l'audio). */
  segments: [number, number][];
  /** Voix isolée en mono 16 kHz (pour la reconnaissance des paroles). */
  voice16k: Float32Array;
}

/**
 * Morceau complet → mélodie chantée + instru (voix retirée).
 * Avec des pistes déjà séparées (voix et/ou instru), on les utilise telles quelles : meilleure qualité.
 */
export async function transcribeSong(
  files: { mix?: File; voice?: File; instru?: File },
  onProgress: (p: number, msg: string) => void,
  maxSeconds = 300,
): Promise<TranscribeResult> {
  onProgress(0, 'Lecture du fichier…');
  const mixBuf = files.mix ? await decode(files.mix) : null;
  const voiceBuf = files.voice ? await decode(files.voice) : null;
  if (!mixBuf && !voiceBuf) throw new Error('aucun fichier');
  onProgress(0.05, 'Isolation de la voix…');
  const voiceData = voiceBuf ? await render(voiceBuf, 'voice', 22050, maxSeconds) : await render(mixBuf!, 'voice', 22050, maxSeconds);
  let instru: Blob | null = files.instru ?? null;
  let computed = false;
  const mono = !!mixBuf && mixBuf.numberOfChannels < 2;
  if (!instru && mixBuf && !mono) {
    onProgress(0.1, 'Création de l’instru (voix retirée)…');
    instru = toWav(await render(mixBuf, 'instru', 32000, maxSeconds), 32000);
    computed = true;
  }
  const notes = await pitchNotes(voiceData, onProgress);
  const segments = voiceSegments(voiceData, 22050);
  const voice16k = voiceBuf ? await render(voiceBuf, 'voice', 16000, maxSeconds) : await render(mixBuf!, 'voice', 16000, maxSeconds);
  onProgress(1, 'Terminé');
  return { notes, instru, computedInstru: computed, mono, segments, voice16k };
}

export async function transcribeFile(file: File, onProgress: (p: number, msg: string) => void, maxSeconds = 240): Promise<TNote[]> {
  return (await transcribeSong({ voice: file }, onProgress, maxSeconds)).notes;
}
