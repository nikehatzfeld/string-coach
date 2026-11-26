import { Midi } from '@tonejs/midi';
import { notesToNotation, type TNote } from '../practice/transcribe';
import type { Song } from './alphatex';

/**
 * Fichier MIDI personnel → morceau de l'app : mélodie (piste la plus aiguë, ou nommée flûte/violon/chant),
 * accords tirés des autres pistes, tempo et mesure du fichier. Le morceau reste sur l'appareil.
 */
export function midiToSong(buf: ArrayBuffer, name: string): Song {
  const midi = new Midi(buf);
  const bpm = Math.round(midi.header.tempos[0]?.bpm ?? 100);
  const tsRaw = midi.header.timeSignatures[0]?.timeSignature;
  const ts: [number, number] = tsRaw && tsRaw.length === 2 ? [tsRaw[0], tsRaw[1]] : [4, 4];
  const spt = 60 / bpm / midi.header.ppq; // secondes par tick (tempo du début)
  const tracks = midi.tracks.filter((t) => t.notes.length >= 8 && t.channel !== 9);
  if (!tracks.length) throw new Error('aucune piste mélodique dans ce fichier');
  // Instrument soliste (violon, voix, vents) prioritaire sur le piano, qui a souvent des notes plus aiguës.
  const score = (t: (typeof tracks)[number]) => {
    const avg = t.notes.reduce((a, n) => a + n.midi, 0) / t.notes.length;
    const prog = t.instrument.number;
    const solo = (prog >= 40 && prog <= 41) || (prog >= 52 && prog <= 54) || (prog >= 56 && prog <= 79) ? 40 : 0;
    const keys = prog <= 7 ? -15 : 0;
    const named = /flute|flûte|violin|violon|melod|solo|voice|voix|chant|lead|recorder/i.test(`${t.name} ${t.instrument.name}`) ? 12 : 0;
    return avg + solo + keys + named;
  };
  const melodyTrack = [...tracks].sort((a, b) => score(b) - score(a))[0];
  const toT = (n: { ticks: number; durationTicks: number; midi: number; velocity: number }): TNote => ({
    start: n.ticks * spt,
    dur: Math.max(n.durationTicks * spt, 0.05),
    midi: n.midi,
    amp: n.velocity || 0.8,
  });
  const all = tracks.flatMap((t) => t.notes.map(toT));
  const melody = melodyTrack.notes.map(toT);
  const notation = notesToNotation(all, bpm, ts, tracks.length > 1, { t0: 0, melody });
  if (!notation) throw new Error('mélodie introuvable');
  return {
    id: `midi-${Date.now()}`,
    title: name,
    composer: 'Import MIDI',
    style: 'Mes morceaux',
    level: 3,
    tempo: bpm,
    timeSignature: ts,
    notation,
    instruments: ['violin', 'recorder', 'guitar'],
  };
}
