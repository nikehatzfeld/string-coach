/**
 * Voix de rap : chaque vers est dit par la synthèse vocale du navigateur, au début de sa mesure,
 * avec un débit ajusté pour tenir dans la mesure (au tempo de lecture).
 * Le rap étant parlé, c'est bien plus proche du vrai que des notes « ooh » de banque de sons.
 */
export interface SpokenLine {
  /** Mesure de départ (0 = intro). */
  bar: number;
  /** Nombre de mesures occupées. */
  bars: number;
  text: string;
  /** Syllabes (pour le débit). */
  syl: number;
}
export interface Spoken {
  lang: string;
  lines: SpokenLine[];
}

const BAR_TICKS = 3840; // 4/4, 960 ticks par noire
/** Débit naturel d'une voix de synthèse à rate = 1 (syllabes par seconde). */
const SYL_PER_S = 5.2;

export const speechSupported = (): boolean => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';

/** Voix disponibles pour une langue, les plus naturelles d'abord. */
export function voicesFor(lang: string): SpeechSynthesisVoice[] {
  if (!speechSupported()) return [];
  const short = lang.slice(0, 2);
  const score = (v: SpeechSynthesisVoice) => (/natural|neural|online/i.test(v.name) ? 0 : /google/i.test(v.name) ? 1 : 2) + (v.lang.replace('_', '-') === lang ? 0 : 0.5);
  return speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith(short))
    .sort((a, b) => score(a) - score(b));
}

/** Débit (rate) pour dire `syl` syllabes en `seconds` secondes. */
export function rateFor(syl: number, seconds: number): number {
  return Math.max(0.7, Math.min(2.2, syl / SYL_PER_S / Math.max(0.3, seconds * 0.9)));
}

export class RapVoice {
  private next = 0;
  private lastBar = -1;
  voiceName = '';
  constructor(
    private spoken: Spoken,
    private tempo: number,
  ) {}

  stop(): void {
    this.lastBar = -1;
    if (speechSupported()) speechSynthesis.cancel();
  }

  /** À appeler à chaque avancée de la lecture. */
  update(tick: number, playing: boolean, speed: number): void {
    if (!playing) {
      if (this.lastBar >= 0) this.stop();
      return;
    }
    const secPerBar = (4 * 60) / (this.tempo * (speed || 1));
    // Démarre un peu en avance : la synthèse met ~0,1 s à parler.
    const bar = tick / BAR_TICKS + 0.12 / secPerBar;
    const lines = this.spoken.lines;
    if (this.lastBar < 0 || bar < this.lastBar - 0.05 || bar > this.lastBar + 1.5) {
      // Départ ou saut (boucle, clic dans la partition) : on repart du vers courant.
      if (speechSupported()) speechSynthesis.cancel();
      this.next = lines.findIndex((l) => l.bar + 0.25 >= bar);
      if (this.next < 0) this.next = lines.length;
    }
    this.lastBar = bar;
    while (this.next < lines.length && lines[this.next].bar <= bar) {
      const l = lines[this.next++];
      if (bar - l.bar < 0.4) this.say(l, l.bars * secPerBar);
    }
  }

  private say(l: SpokenLine, seconds: number): void {
    if (!speechSupported()) return;
    const u = new SpeechSynthesisUtterance(l.text);
    u.lang = this.spoken.lang;
    const v = voicesFor(this.spoken.lang);
    const chosen = v.find((x) => x.name === this.voiceName) ?? v[0];
    if (chosen) u.voice = chosen;
    u.rate = rateFor(l.syl, seconds);
    u.volume = 1;
    // Le vers précédent est coupé s'il déborde : le flow reste calé sur le beat.
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
}
