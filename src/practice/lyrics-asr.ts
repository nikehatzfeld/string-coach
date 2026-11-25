import { syllabifyWord, type TimedSyllable } from './karaoke';

/**
 * Reconnaissance des paroles dans la voix d'un enregistrement personnel (Whisper, dans le navigateur,
 * via transformers.js). Le modèle (~80 Mo) est téléchargé une seule fois puis gardé en cache par le
 * navigateur ; l'audio ne quitte pas l'appareil.
 */
export interface Word {
  text: string;
  start: number;
  end: number;
}

export type AsrLang = 'fr' | 'en' | 'auto';

const MODEL = 'onnx-community/whisper-base_timestamped';

export async function recognizeWords(audio16k: Float32Array, lang: AsrLang, onProgress: (p: number, msg: string) => void): Promise<Word[]> {
  onProgress(0, 'Chargement de la reconnaissance des paroles (une seule fois, ~80 Mo)…');
  const { pipeline } = await import('@huggingface/transformers');
  const files = new Map<string, number>();
  let loaded = false;
  const progress_callback = (e: { status?: string; file?: string; progress?: number }) => {
    if (loaded || e.status !== 'progress' || !e.file) return;
    files.set(e.file, e.progress ?? 0);
    const avg = [...files.values()].reduce((a, b) => a + b, 0) / files.size;
    onProgress(avg / 200, `Téléchargement du modèle de paroles : ${Math.round(avg)} %`);
  };
  // WebGPU seulement s'il est vraiment disponible ; sinon calcul sur le processeur (WASM).
  const nav = navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } };
  let gpu = false;
  try {
    gpu = !!(await nav.gpu?.requestAdapter());
  } catch {
    gpu = false;
  }
  const make = (device: 'webgpu' | 'wasm') =>
    pipeline('automatic-speech-recognition', MODEL, { dtype: 'q8', device, progress_callback } as Record<string, unknown>);
  let asr;
  try {
    asr = await make(gpu ? 'webgpu' : 'wasm');
  } catch (e) {
    if (!gpu) throw e;
    asr = await make('wasm');
  }
  loaded = true;
  onProgress(0.5, 'Écoute des paroles…');
  const out = (await asr(audio16k, {
    ...(lang === 'auto' ? {} : { language: lang === 'fr' ? 'french' : 'english' }),
    task: 'transcribe',
    return_timestamps: 'word',
    chunk_length_s: 30,
    stride_length_s: 5,
  } as Record<string, unknown>)) as { chunks?: { text: string; timestamp: [number, number | null] }[] };
  onProgress(1, 'Paroles reconnues');
  return (out.chunks ?? [])
    .map((c) => ({ text: c.text.trim(), start: c.timestamp[0], end: c.timestamp[1] ?? c.timestamp[0] + 0.3 }))
    .filter((w) => w.text && Number.isFinite(w.start));
}

/** Début de ligne pour chaque mot : après un silence, une ponctuation finale, ou 12 mots. */
function lineStarts(words: Word[]): boolean[] {
  let len = 0;
  return words.map((w, i) => {
    const prev = words[i - 1];
    const nl = !prev || w.start - prev.end > 0.7 || /[.!?]$/.test(prev.text) || len >= 12;
    len = nl ? 1 : len + 1;
    return nl;
  });
}

/** Mots horodatés → syllabes horodatées (temps de la partition = temps de l'audio − offset). */
export function wordsToTimedSyllables(words: Word[], offset = 0): TimedSyllable[] {
  const starts = lineStarts(words);
  const out: TimedSyllable[] = [];
  words.forEach((w, i) => {
    const core = w.text.replace(/^[^\p{L}\p{N}]+/u, '');
    const syl = /^\p{N}+$/u.test(core) || !core ? [w.text] : syllabifyWord(core);
    const dur = Math.max(0.05, w.end - w.start) / syl.length;
    syl.forEach((s, k) => {
      out.push({ t: Math.round((w.start + k * dur - offset) * 100) / 100, s: k < syl.length - 1 ? `${s}-` : s, ...(starts[i] && k === 0 ? { line: true } : {}) });
    });
  });
  return out;
}

/** Texte des paroles reconnues, une ligne par phrase (pour relecture et correction). */
export function wordsToText(words: Word[]): string {
  const starts = lineStarts(words);
  // « aujourd » + « 'hui » : pas d'espace avant une apostrophe ou un trait d'union.
  return words.map((w, i) => `${i === 0 ? '' : starts[i] ? '\n' : /^['’-]/.test(w.text) ? '' : ' '}${w.text}`).join('');
}
