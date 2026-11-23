/**
 * Karaoké automatique : paroles collées telles quelles → syllabes → instants dans l'audio.
 * Les syllabes sont réparties sur les passages où la voix est présente (détection d'activité vocale),
 * en faisant commencer chaque ligne au début d'un passage chanté quand c'est possible.
 * Approximation volontaire : ça marche « à peu près », y compris pour le rap.
 */

export interface TimedSyllable {
  /** Début (s) dans l'audio du morceau. */
  t: number;
  /** Syllabe telle qu'affichée (tiret final = le mot continue). */
  s: string;
  /** Première syllabe d'une ligne. */
  line?: boolean;
}

const VOWELS = 'aeiouyàâäéèêëîïôöùûüœæ';
const isV = (c: string) => VOWELS.includes(c.toLowerCase());

/** Découpe un mot en syllabes (règles simples du français, correctes aussi pour beaucoup de mots anglais). */
export function syllabifyWord(word: string): string[] {
  const letters = [...word];
  if (letters.filter(isV).length <= 1) return [word];
  // Groupes de voyelles = noyaux ; on coupe entre les consonnes qui les séparent.
  const parts: string[] = [];
  let cur = '';
  let i = 0;
  while (i < letters.length) {
    cur += letters[i];
    if (isV(letters[i]) && !isV(letters[i + 1] ?? 'a')) {
      // Consonnes jusqu'à la prochaine voyelle
      let j = i + 1;
      while (j < letters.length && !isV(letters[j])) j++;
      if (j >= letters.length) {
        cur += letters.slice(i + 1).join('');
        break;
      }
      const cons = letters.slice(i + 1, j).join('');
      const keepTogether = /^(bl|br|cl|cr|dr|fl|fr|gl|gr|pl|pr|tr|vr|ch|ph|th|gn|qu|gu)$/i;
      let cut = cons.length <= 1 ? 0 : keepTogether.test(cons.slice(-2)) ? cons.length - 2 : cons.length - 1;
      // « e » muet final : « mon-de » reste une syllabe de plus en chant, on le garde.
      if (cons.length === 0) cut = 0;
      cur += cons.slice(0, cut);
      parts.push(cur);
      cur = cons.slice(cut);
      i = j;
      continue;
    }
    i++;
  }
  if (cur) parts.push(cur);
  return parts.filter(Boolean);
}

/** Paroles brutes → syllabes, ligne par ligne (tiret = le mot continue). */
export function syllabifyLyrics(text: string): { s: string; line: boolean }[] {
  const out: { s: string; line: boolean }[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\[.*?\]|\(.*?\)/g, ' ').trim(); // [Refrain], (x2)…
    if (!line) continue;
    let first = true;
    for (const w of line.split(/\s+/)) {
      if (!/[\p{L}\p{N}]/u.test(w)) continue;
      // Élisions et mots composés : chaque morceau est un mot.
      const pieces = w.split(/(?<=['’-])/).filter(Boolean);
      for (const p of pieces) {
        const core = p.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’-]+$/gu, '');
        if (!core) continue;
        const syl = /^\p{N}+$/u.test(core) ? [core] : syllabifyWord(core);
        syl.forEach((s, k) => {
          out.push({ s: k < syl.length - 1 ? `${s}-` : s, line: first });
          first = false;
        });
      }
    }
  }
  return out;
}

/** Passages où la voix est présente : [début, fin] en secondes, à partir d'un signal mono. */
export function voiceSegments(data: Float32Array, rate: number): [number, number][] {
  const hop = Math.round(rate * 0.02);
  const rms: number[] = [];
  for (let i = 0; i + hop <= data.length; i += hop) {
    let s = 0;
    for (let k = i; k < i + hop; k++) s += data[k] * data[k];
    rms.push(Math.sqrt(s / hop));
  }
  if (!rms.length) return [];
  const sorted = [...rms].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.2)];
  const loud = sorted[Math.floor(sorted.length * 0.9)];
  const thr = floor + (loud - floor) * 0.25;
  const segs: [number, number][] = [];
  let start = -1;
  rms.forEach((v, i) => {
    if (v >= thr && start < 0) start = i;
    if ((v < thr || i === rms.length - 1) && start >= 0) {
      segs.push([start * 0.02, i * 0.02]);
      start = -1;
    }
  });
  // Petits trous fusionnés, passages trop courts écartés.
  const merged: [number, number][] = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && s[0] - last[1] < 0.18) last[1] = s[1];
    else merged.push([...s]);
  }
  return merged.filter(([a, b]) => b - a >= 0.12);
}

/** Répartit les syllabes sur les passages chantés ; une ligne démarre de préférence au début d'un passage. */
export function alignLyrics(syl: { s: string; line: boolean }[], segs: [number, number][]): TimedSyllable[] {
  if (!syl.length || !segs.length) return [];
  const total = segs.reduce((a, [x, y]) => a + (y - x), 0);
  const per = total / syl.length;
  const out: TimedSyllable[] = [];
  let si = 0;
  let t = segs[0][0];
  for (const x of syl) {
    // Nouvelle ligne : si on est au milieu d'un passage dont il reste peu, on saute au suivant.
    if (x.line && out.length && si + 1 < segs.length) {
      const left = segs[si][1] - t;
      const used = t - segs[si][0];
      if (left < per * 2 && used > per) {
        si++;
        t = segs[si][0];
      }
    }
    while (si < segs.length && t >= segs[si][1] - 1e-6) {
      si++;
      if (si < segs.length) t = Math.max(t, segs[si][0]);
    }
    out.push({ t: Math.round(t * 100) / 100, s: x.s, ...(x.line ? { line: true } : {}) });
    t += per;
  }
  return out;
}
