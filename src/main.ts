import './style.css';
import { onAfterSave, onPracticeBadges } from './game/store';
import { initCloud, schedulePush } from './cloud/sync';
import { renderHome } from './ui/home';
import { consumeMarkDone, renderCourse } from './ui/course';
import { renderExercises } from './ui/exercises';
import { renderHarmony } from './ui/harmony';
import { renderChords } from './ui/chords';
import { closeChordPlay, renderChordPlay } from './ui/chord-play';
import type { ChordChart } from './courses/chords-content';
import { closeImprov, renderImprov, type ImprovPreset } from './ui/improv';
import { closePlayer, openPlayer, type Source } from './ui/player';
import { installSpatialNav } from './ui/spatial-nav';
import { esc } from './ui/dom';
import { toast } from './ui/results';
import { mountMetronome } from './ui/metronome';
import { mountTuner } from './ui/tuner';

const app = document.getElementById('app')!;
installSpatialNav();
mountMetronome();
mountTuner();

onPracticeBadges((badges) => {
  for (const b of badges) toast(`<span class="bicon">${b.icon}</span> Badge débloqué : <strong>${esc(b.name)}</strong>`);
});

let returnTo: 'home' | 'course' | 'exercises' | 'harmony' | 'chords' = 'home';

function home(): void {
  closePlayer();
  closeChordPlay();
  returnTo = 'home';
  closeImprov();
  renderHome(app, play, course, exercises, harmony, chords);
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

function chords(tab: 'dict' | 'course' | 'changes' | 'songs' = 'dict'): void {
  closePlayer();
  closeChordPlay();
  returnTo = 'chords';
  renderChords(app, home, (c) => chordPlay(c, () => chords(tab === 'dict' ? 'songs' : tab)), tab);
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

function exercises(): void {
  closePlayer();
  returnTo = 'exercises';
  renderExercises(app, play, home);
  window.scrollTo({ top: 0 });
}

function play(source: Source, mode: 'live' | 'step' | 'game' = 'live'): void {
  openPlayer(app, source, () => (returnTo === 'course' ? course() : returnTo === 'exercises' ? exercises() : home()), mode);
  window.scrollTo({ top: 0 });
}

onAfterSave(schedulePush);
// Après fusion avec le compte : réaffiche l'écran courant (hors lecteur).
addEventListener('cloud-merged', () => {
  if (document.querySelector('.player')) return;
  if (returnTo === 'course') course();
  else if (returnTo === 'exercises') exercises();
  else home();
});
initCloud().catch(() => {});

home();
