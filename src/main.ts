import './style.css';
import { onAfterSave, onPracticeBadges } from './game/store';
import { initCloud, schedulePush } from './cloud/sync';
import { renderHome } from './ui/home';
import { consumeMarkDone, renderCourse } from './ui/course';
import { renderExercises } from './ui/exercises';
import { renderAcademy } from './ui/academy';
import { renderHarmony } from './ui/harmony';
import { renderChords } from './ui/chords';
import { closeVoiceStudio, renderVoiceStudio } from './ui/voice-studio';
import { closeChordPlay, renderChordPlay } from './ui/chord-play';
import type { ChordChart } from './courses/chords-content';
import { closeImprov, renderImprov, type ImprovPreset } from './ui/improv';
import { closePlayer, openPlayer, type Source } from './ui/player';
import { installSpatialNav } from './ui/spatial-nav';
import { esc } from './ui/dom';
import { toast } from './ui/results';
import { mountMetronome } from './ui/metronome';
import { mountTuner } from './ui/tuner';

// Après une mise à jour du site, une page restée ouverte peut demander des fichiers qui n'existent plus :
// on recharge une fois pour prendre la nouvelle version (au lieu d'une erreur « Failed to fetch module »).
addEventListener('vite:preloadError', (e) => {
  try {
    if (sessionStorage.getItem('string-coach:reloaded')) return;
    sessionStorage.setItem('string-coach:reloaded', '1');
  } catch {
    /* ignore */
  }
  e.preventDefault();
  location.reload();
});
setTimeout(() => {
  try {
    sessionStorage.removeItem('string-coach:reloaded');
  } catch {
    /* ignore */
  }
}, 30000);

// iPhone : jouer le son même quand le bouton silencieux est activé (Safari 16.4+).
try {
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (nav.audioSession) nav.audioSession.type = 'playback';
} catch {
  /* non pris en charge */
}

const app = document.getElementById('app')!;
installSpatialNav();
mountMetronome();
mountTuner();

onPracticeBadges((badges) => {
  for (const b of badges) toast(`<span class="bicon">${b.icon}</span> Badge débloqué : <strong>${esc(b.name)}</strong>`);
});

let returnTo: 'home' | 'course' | 'exercises' | 'harmony' | 'chords' | 'academy' = 'home';

function home(): void {
  closePlayer();
  closeChordPlay();
  closeVoiceStudio();
  returnTo = 'home';
  closeImprov();
  renderHome(app, play, course, exercises, harmony, chords, voiceStudio, academyView);
  window.scrollTo({ top: 0 });
}

function course(): void {
  closePlayer();
  returnTo = 'course';
  consumeMarkDone();
  renderCourse(app, play, home);
  window.scrollTo({ top: 0 });
}

function harmony(): void {
  closePlayer();
  closeImprov();
  returnTo = 'harmony';
  renderHarmony(app, home, improv);
  window.scrollTo({ top: 0 });
}

function chords(tab: 'dict' | 'course' | 'prog' | 'changes' | 'songs' = 'dict'): void {
  closePlayer();
  closeChordPlay();
  returnTo = 'chords';
  renderChords(app, home, (c) => chordPlay(c, () => chords(tab === 'dict' ? 'songs' : tab)), tab);
  window.scrollTo({ top: 0 });
}

function voiceStudio(): void {
  closePlayer();
  renderVoiceStudio(app, home);
  window.scrollTo({ top: 0 });
}

function chordPlay(c: ChordChart, back: () => void): void {
  closePlayer();
  renderChordPlay(app, c, back);
  window.scrollTo({ top: 0 });
}
// Depuis le lecteur : « 🎸 Accords » d'un morceau.
addEventListener('open-chords', (e) => {
  const c = (e as CustomEvent<ChordChart>).detail;
  chordPlay(c, () => home());
});

function improv(preset: ImprovPreset): void {
  closePlayer();
  renderImprov(app, harmony, preset);
  window.scrollTo({ top: 0 });
}

function academyView(): void {
  closePlayer();
  returnTo = 'academy';
  renderAcademy(app, play, home);
  window.scrollTo({ top: 0 });
}

function exercises(): void {
  closePlayer();
  returnTo = 'exercises';
  renderExercises(app, play, home);
  window.scrollTo({ top: 0 });
}

function play(source: Source, mode: 'live' | 'step' | 'game' = 'live'): void {
  openPlayer(app, source, () => (returnTo === 'course' ? course() : returnTo === 'exercises' ? exercises() : returnTo === 'academy' ? academyView() : home()), mode);
  window.scrollTo({ top: 0 });
}

onAfterSave(schedulePush);
addEventListener('user-songs-changed', schedulePush);
// Après fusion avec le compte : réaffiche l'écran courant (hors lecteur).
addEventListener('cloud-merged', () => {
  if (document.querySelector('.player')) return;
  if (returnTo === 'course') course();
  else if (returnTo === 'exercises') exercises();
  else if (returnTo === 'academy') academyView();
  else home();
});
initCloud().catch(() => {});

home();
