/**
 * Commandes vocales en français (Web Speech API) pour jouer les mains libres.
 * Disponible dans Chrome, Edge et Safari ; la reconnaissance passe par le service du navigateur.
 */

export type VoiceAction =
  | 'start'
  | 'stop'
  | 'pause'
  | 'next'
  | 'prev'
  | 'restart'
  | 'faster'
  | 'slower'
  | 'metronome'
  | 'loop'
  | 'mic'
  | 'hear'
  | 'mode-live'
  | 'mode-step'
  | 'mode-game'
  | 'whole';

export interface VoiceCommand {
  action: VoiceAction;
  /** Tempo demandé (« tempo 90 ») ou numéro de partie (« partie 2 »). */
  value?: number;
  kind?: 'bpm' | 'section';
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const RULES: [RegExp, VoiceAction][] = [
  [/\b(mode jeu|jeu)\b/, 'mode-game'],
  [/\b(pas a pas)\b/, 'mode-step'],
  [/\b(mode ecoute)\b/, 'mode-live'],
  [/\b(morceau entier|tout le morceau)\b/, 'whole'],
  [/\b(plus vite|accelere|accelerer|plus rapide)\b/, 'faster'],
  [/\b(moins vite|ralentis|ralentir|plus lent|doucement)\b/, 'slower'],
  [/\b(recommence|recommencer|reprends|reprendre|du debut|encore)\b/, 'restart'],
  [/\b(suivant|suivante|passe|passer|next)\b/, 'next'],
  [/\b(precedent|precedente|recule|reculer|retour)\b/, 'prev'],
  [/\b(metronome)\b/, 'metronome'],
  [/\b(boucle|en boucle|repete|repeter)\b/, 'loop'],
  [/\b(micro|microphone)\b/, 'mic'],
  [/\b(ecoute la note|ecouter la note|la note|ecoute)\b/, 'hear'],
  [/\b(pause)\b/, 'pause'],
  [/\b(stop|arrete|arreter|stoppe|termine)\b/, 'stop'],
  [/\b(lecture|joue|jouer|demarre|demarrer|commence|commencer|go|play|lance|lancer|c est parti)\b/, 'start'],
];

const NUMBERS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  soixante: 60, septante: 70, quatrevingt: 80, quatrevingts: 80, nonante: 90, cent: 100,
};

/** Traduit une phrase en commande (testable sans micro). */
export function parseVoice(phrase: string): VoiceCommand | null {
  const p = norm(phrase);
  const tempo = /\b(?:tempo|bpm|vitesse)\s*(\d{2,3})\b|\b(\d{2,3})\s*bpm\b/.exec(p);
  if (tempo) return { action: 'start', value: Number(tempo[1] ?? tempo[2]), kind: 'bpm' };
  const part = /\bpartie\s*(\d{1,2}|\w+)\b/.exec(p);
  if (part) {
    const n = Number(part[1]) || NUMBERS[part[1]];
    if (n) return { action: 'start', value: n, kind: 'section' };
  }
  for (const [rx, action] of RULES) if (rx.test(p)) return { action };
  return null;
}

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

export function voiceSupported(): boolean {
  return !!((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition);
}

let rec: Recognition | null = null;
let enabled = false;

export function startVoice(onCommand: (c: VoiceCommand, heard: string) => void, onStatus: (msg: string, ok: boolean) => void): void {
  const Ctor = ((window as unknown as Record<string, unknown>).SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => Recognition) | undefined;
  if (!Ctor) {
    onStatus('Commandes vocales non disponibles dans ce navigateur (essaie Chrome ou Edge).', false);
    return;
  }
  stopVoice();
  enabled = true;
  rec = new Ctor();
  rec.lang = 'fr-FR';
  rec.continuous = true;
  rec.interimResults = false;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (!r.isFinal) continue;
      const heard = r[0].transcript;
      const cmd = parseVoice(heard);
      if (cmd) onCommand(cmd, heard);
      else onStatus(`« ${heard.trim()} » : commande inconnue`, false);
    }
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      enabled = false;
      onStatus('Micro refusé pour les commandes vocales.', false);
    }
  };
  // La reconnaissance s'arrête d'elle-même après un silence : on la relance.
  rec.onend = () => {
    if (enabled) setTimeout(() => enabled && rec?.start(), 250);
  };
  try {
    rec.start();
    onStatus('🗣 À l’écoute : « joue », « stop », « suivant », « recommence », « plus vite », « tempo 80 », « métronome »…', true);
  } catch {
    onStatus('Impossible de démarrer les commandes vocales.', false);
  }
}

export function stopVoice(): void {
  enabled = false;
  try {
    rec?.stop();
  } catch {
    /* ignore */
  }
  rec = null;
}

export function voiceActive(): boolean {
  return enabled;
}
