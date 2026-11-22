import './style.css';
import { onAfterSave, onPracticeBadges } from './game/store';
import { initCloud, schedulePush } from './cloud/sync';
import { renderHome } from './ui/home';
import { consumeMarkDone, renderCourse } from './ui/course';
import { renderExercises } from './ui/exercises';
import { closePlayer, openPlayer, type Source } from './ui/player';
import { installSpatialNav } from './ui/spatial-nav';
import { esc } from './ui/dom';
import { toast } from './ui/results';
import { mountMetronome } from './ui/metronome';

const app = document.getElementById('app')!;
installSpatialNav();
mountMetronome();

onPracticeBadges((badges) => {
  for (const b of badges) toast(`<span class="bicon">${b.icon}</span> Badge débloqué : <strong>${esc(b.name)}</strong>`);
});

let returnTo: 'home' | 'course' | 'exercises' = 'home';

function home(): void {
  closePlayer();
  returnTo = 'home';
  renderHome(app, play, course, exercises);
  window.scrollTo({ top: 0 });
}

function course(): void {
  closePlayer();
  returnTo = 'course';
  consumeMarkDone();
  renderCourse(app, play, home);
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
