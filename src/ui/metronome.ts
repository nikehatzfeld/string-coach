/**
 * Métronome indépendant, accessible partout (bouton flottant). Sons générés en Web Audio,
 * programmés à l'avance pour une régularité parfaite même si l'interface est occupée.
 */

interface MetroState {
  bpm: number;
  beats: number;
  accent: boolean;
  volume: number;
}

const KEY = 'string-coach:metronome';
const state: MetroState = (() => {
  try {
    return { bpm: 80, beats: 4, accent: true, volume: 0.7, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { bpm: 80, beats: 4, accent: true, volume: 0.7 };
  }
})();
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
};

let ctx: AudioContext | null = null;
let timer = 0;
let nextTime = 0;
let beat = 0;
let running = false;
let onBeat: (b: number) => void = () => {};
/** Tempo proposé par la page courante (morceau ouvert). */
let suggested: (() => number | null) | null = null;

export function setSuggestedTempo(fn: (() => number | null) | null): void {
  suggested = fn;
  renderSync();
}

function click(time: number, strong: boolean) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = strong ? 1600 : 1000;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(state.volume, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.07);
}

function scheduler() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.12) {
    const b = beat;
    click(nextTime, state.accent && b === 0);
    const delay = Math.max(0, (nextTime - ctx.currentTime) * 1000);
    setTimeout(() => onBeat(b), delay);
    nextTime += 60 / state.bpm;
    beat = (beat + 1) % state.beats;
  }
}

export function startMetronome(): void {
  if (running) return;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx ??= new Ctx();
  ctx.resume().catch(() => {});
  running = true;
  beat = 0;
  nextTime = ctx.currentTime + 0.06;
  timer = window.setInterval(scheduler, 25);
  scheduler();
  render();
}

export function stopMetronome(): void {
  running = false;
  clearInterval(timer);
  render();
}

export function isMetronomeRunning(): boolean {
  return running;
}

// ---------- Interface ----------
let root: HTMLElement | null = null;
let taps: number[] = [];

export function mountMetronome(): void {
  if (root) return;
  root = document.createElement('div');
  root.className = 'metro';
  root.innerHTML = `
    <button class="metro-fab" aria-expanded="false" aria-label="Métronome" title="Métronome">
      <span class="metro-icon">♩</span><small class="fab-label">Métronome</small><span class="metro-fab-bpm"></span>
    </button>
    <div class="metro-panel" hidden role="dialog" aria-label="Métronome">
      <div class="metro-beats"></div>
      <div class="metro-row">
        <button data-m="-5" aria-label="−5 BPM">−5</button>
        <button data-m="-1" aria-label="−1 BPM">−1</button>
        <input class="metro-bpm" type="number" min="20" max="300" inputmode="numeric" aria-label="BPM" />
        <button data-m="1" aria-label="+1 BPM">+1</button>
        <button data-m="5" aria-label="+5 BPM">+5</button>
      </div>
      <input class="metro-range" type="range" min="20" max="240" step="1" aria-label="Tempo" />
      <div class="metro-row">
        <label>Mesure <select class="metro-sig">${[2, 3, 4, 5, 6, 7, 9, 12].map((n) => `<option value="${n}">${n} temps</option>`).join('')}</select></label>
        <label class="check"><input class="metro-accent" type="checkbox" /> Accent</label>
      </div>
      <div class="metro-row">
        <label>Volume <input class="metro-vol" type="range" min="0.05" max="1" step="0.05" /></label>
        <button class="metro-tap">Taper le tempo</button>
      </div>
      <div class="metro-row">
        <button class="metro-sync" hidden></button>
        <button class="metro-toggle primary">▶ Démarrer</button>
      </div>
    </div>`;
  document.body.appendChild(root);
  const $ = <T extends HTMLElement>(sel: string) => root!.querySelector<T>(sel)!;
  const panel = $('.metro-panel');
  $('.metro-fab').addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    $('.metro-fab').setAttribute('aria-expanded', String(!panel.hidden));
    renderSync();
  });
  const setBpm = (v: number) => {
    state.bpm = Math.round(Math.max(20, Math.min(300, v || state.bpm)));
    save();
    render();
  };
  root.querySelectorAll<HTMLButtonElement>('[data-m]').forEach((b) => b.addEventListener('click', () => setBpm(state.bpm + Number(b.dataset.m))));
  $<HTMLInputElement>('.metro-bpm').addEventListener('change', (e) => setBpm(Number((e.target as HTMLInputElement).value)));
  $<HTMLInputElement>('.metro-range').addEventListener('input', (e) => setBpm(Number((e.target as HTMLInputElement).value)));
  $<HTMLSelectElement>('.metro-sig').addEventListener('change', (e) => {
    state.beats = Number((e.target as HTMLSelectElement).value);
    beat = 0;
    save();
    render();
  });
  $<HTMLInputElement>('.metro-accent').addEventListener('change', (e) => {
    state.accent = (e.target as HTMLInputElement).checked;
    save();
  });
  $<HTMLInputElement>('.metro-vol').addEventListener('input', (e) => {
    state.volume = Number((e.target as HTMLInputElement).value);
    save();
  });
  $('.metro-tap').addEventListener('click', () => {
    const now = performance.now();
    taps = [...taps.filter((t) => now - t < 2500), now];
    if (taps.length >= 3) {
      const gaps = taps.slice(1).map((t, i) => t - taps[i]);
      setBpm(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length));
    }
  });
  $('.metro-toggle').addEventListener('click', () => (running ? stopMetronome() : startMetronome()));
  $('.metro-sync').addEventListener('click', () => {
    const t = suggested?.();
    if (t) setBpm(t);
  });
  onBeat = (b) => {
    const dots = root!.querySelectorAll<HTMLElement>('.metro-beats span');
    dots.forEach((d, i) => d.classList.toggle('on', i === b));
    $('.metro-fab').classList.remove('tick');
    void $('.metro-fab').offsetWidth;
    $('.metro-fab').classList.add('tick');
  };
  // Raccourci clavier : M
  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === 'm' || e.key === 'M') running ? stopMetronome() : startMetronome();
  });
  render();
}

function renderSync() {
  if (!root) return;
  const b = root.querySelector<HTMLButtonElement>('.metro-sync')!;
  const t = suggested?.();
  b.hidden = !t;
  if (t) b.textContent = `↔ Tempo du morceau (${t})`;
}

function render() {
  if (!root) return;
  const q = <T extends HTMLElement>(sel: string) => root!.querySelector<T>(sel)!;
  q<HTMLInputElement>('.metro-bpm').value = String(state.bpm);
  q<HTMLInputElement>('.metro-range').value = String(state.bpm);
  q<HTMLSelectElement>('.metro-sig').value = String(state.beats);
  q<HTMLInputElement>('.metro-accent').checked = state.accent;
  q<HTMLInputElement>('.metro-vol').value = String(state.volume);
  q('.metro-toggle').textContent = running ? '■ Arrêter' : '▶ Démarrer';
  q('.metro-fab-bpm').textContent = running ? String(state.bpm) : '';
  q('.metro-fab').classList.toggle('running', running);
  q('.metro-beats').innerHTML = Array.from({ length: state.beats }, (_, i) => `<span class="${i === 0 && state.accent ? 'strong' : ''}"></span>`).join('');
  renderSync();
}
