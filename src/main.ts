import './style.css';
import { onPracticeBadges } from './game/store';
import { renderHome } from './ui/home';
import { closePlayer, openPlayer, type Source } from './ui/player';
import { installSpatialNav } from './ui/spatial-nav';
import { esc } from './ui/dom';
import { toast } from './ui/results';

const app = document.getElementById('app')!;
installSpatialNav();

onPracticeBadges((badges) => {
  for (const b of badges) toast(`<span class="bicon">${b.icon}</span> Badge débloqué : <strong>${esc(b.name)}</strong>`);
});

function home(): void {
  closePlayer();
  renderHome(app, play);
  window.scrollTo({ top: 0 });
}

function play(source: Source, mode: 'live' | 'step' | 'game' = 'live'): void {
  openPlayer(app, source, home, mode);
  window.scrollTo({ top: 0 });
}

home();
