import type { Song } from '../songs/alphatex';
import { songToAlphaTex } from '../songs/alphatex';
import { INSTRUMENTS } from '../songs/instruments';
import { freqToMidiFloat } from '../songs/notation';
import { MicPitchDetector } from '../practice/pitch-detector';
import { setPracticeActive } from '../game/store';
import { prefs } from '../state/prefs';
import { chordPcs, NoteCircle, noteName, SCALES } from './circle';
import { esc } from './dom';
import { degreeToChord, LETTERS, PROGRESSIONS, type ImprovPreset } from '../courses/harmony-content';
export type { ImprovPreset };
import { ScoreView } from './score-view';
import { setSuggestedTempo } from './metronome';

let cleanup: (() => void) | null = null;
export function closeImprov(): void {
  cleanup?.();
  cleanup = null;
}

export function renderImprov(app: HTMLElement, back: () => void, preset: ImprovPreset = { tonic: 2, scale: 'major', progression: 'I-IV-V-I', bpm: 80 }): void {
  closeImprov();
  const st = { ...preset, bpm: preset.bpm ?? 80 };
  app.innerHTML = `
    <div class="improv">
    <header class="top">
      <button id="iBack" class="ghost" aria-label="Retour">←</button>
      <div class="ptitle"><h1>🎼 Atelier d'improvisation</h1><span class="pbest">Joue librement : le cercle colore chaque note jouée</span></div>
    </header>
    <div class="toolbar">
      <label>Tonalité <select id="iKey">${LETTERS.map((_, i) => `<option value="${i}" ${i === st.tonic ? 'selected' : ''}>${noteName(i, [1, 3, 5, 8, 10].includes(i))}</option>`).join('')}</select></label>
      <label>Gamme <select id="iScale">${Object.entries(SCALES)
        .filter(([k]) => k !== 'chromatic')
        .map(([k, v]) => `<option value="${k}" ${k === st.scale ? 'selected' : ''}>${v.label}</option>`)
        .join('')}</select></label>
      <label>Grille <select id="iProg">${Object.entries(PROGRESSIONS).map(([k, v]) => `<option value="${k}" ${k === st.progression ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></label>
      <label>♩ <input id="iBpm" type="number" min="40" max="200" value="${st.bpm}" /> BPM</label>
      <button id="iPlay" class="primary">▶ Accompagnement</button>
      <button id="iDrone" aria-pressed="false">🎵 Bourdon</button>
      <button id="iMic" aria-pressed="false">🎤 Micro</button>
    </div>
    <main class="improv-main">
      <div class="improv-circle" id="iCircle"></div>
      <div class="improv-side">
        <div id="iChart" class="chord-chart"></div>
        <div class="improv-stats">
          <div><strong id="sChord">0 %</strong><span>notes de l'accord</span></div>
          <div><strong id="sScale">0 %</strong><span>dans la gamme</span></div>
          <div><strong id="sOut">0 %</strong><span>hors gamme</span></div>
        </div>
        <p id="iHeard" class="heard-big">Joue une note…</p>
        <p class="hint">Jaune = note de l'accord en cours (la plus « sûre » sur le temps fort), vert = dans la gamme, rouge = hors gamme (à utiliser comme note de passage). Clic sur le cercle : chromatique ↔ quintes.</p>
      </div>
    </main>
    <div id="iScore" class="offscreen"></div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string) => app.querySelector<T>(`#${id}`)!;
  const circle = new NoteCircle($('iCircle'));
  const view = new ScoreView($('iScore'), $('iScore'));
  const api = view.api;
  let chords: string[] = [];
  let currentBar = -1;
  let mic: MicPitchDetector | null = null;
  let droneNodes: { ctx: AudioContext; stop: () => void } | null = null;
  const counts = { chord: 0, scale: 0, out: 0 };
  let lastPc: number | null = null;
  let since = 0;
  let counted = false;

  const scaleSteps = () => SCALES[st.scale].steps;
  const flat = () => [1, 3, 5, 8, 10].includes(st.tonic) || st.tonic === 5;

  function build() {
    const prog = PROGRESSIONS[st.progression];
    chords = prog.bars.map((d) => degreeToChord(d, st.tonic));
    const loopBars = chords.length ? Array.from({ length: Math.max(1, Math.ceil(16 / chords.length)) }, () => chords).flat() : [];
    $('iChart').innerHTML = chords.length
      ? chords.map((c, i) => `<span class="cc-bar" data-bar="${i}"><b>${esc(prog.bars[i])}</b>${esc(c.replace('#', '♯').replace('b', '♭'))}</span>`).join('')
      : `<span class="cc-bar on"><b>Bourdon</b>${noteName(st.tonic, flat())}</span>`;
    circle.set({ tonic: st.tonic, scale: scaleSteps(), flat: flat(), chord: chords[0] ? chordPcs(chords[0]) : [0, 7].map((x) => (st.tonic + x) % 12) });
    if (!loopBars.length) return;
    const song: Song = {
      id: 'improv',
      title: 'Atelier',
      composer: '',
      style: 'Exercices',
      level: 1,
      tempo: st.bpm,
      timeSignature: [4, 4],
      notation: loopBars.map((c) => `r:1@${c}`).join(' | '),
      backing: prog.style,
    };
    view.loadTex(songToAlphaTex(song, INSTRUMENTS[prefs.instrument], { keySignature: false }), [0]);
  }

  api.playerReady.on(() => (api.isLooping = true));
  api.playerPositionChanged.on((e) => {
    if (!chords.length) return;
    const bar = Math.floor(e.currentTick / 3840) % chords.length;
    if (bar !== currentBar) {
      currentBar = bar;
      app.querySelectorAll('.cc-bar').forEach((x) => x.classList.toggle('on', Number((x as HTMLElement).dataset.bar) === bar));
      circle.set({ chord: chordPcs(chords[bar]) });
    }
  });
  api.playerStateChanged.on((e) => {
    $('iPlay').textContent = e.state === 1 ? '■ Arrêter' : '▶ Accompagnement';
    setPracticeActive(e.state === 1 || !!mic);
  });

  function classify(pc: number): 'chord' | 'scale' | 'out' {
    const chord = chords.length ? chordPcs(chords[Math.max(0, currentBar)]) : [st.tonic, (st.tonic + 7) % 12];
    if (chord.includes(pc)) return 'chord';
    return scaleSteps().some((s) => (st.tonic + s) % 12 === pc) ? 'scale' : 'out';
  }
  function updateStats() {
    const total = counts.chord + counts.scale + counts.out || 1;
    $('sChord').textContent = `${Math.round((counts.chord / total) * 100)} %`;
    $('sScale').textContent = `${Math.round(((counts.chord + counts.scale) / total) * 100)} %`;
    $('sOut').textContent = `${Math.round((counts.out / total) * 100)} %`;
  }

  $('iPlay').addEventListener('click', () => {
    if (!chords.length) return;
    api.playPause();
  });
  $('iDrone').addEventListener('click', () => {
    if (droneNodes) {
      droneNodes.stop();
      droneNodes = null;
      $('iDrone').setAttribute('aria-pressed', 'false');
      return;
    }
    droneNodes = startDrone(st.tonic);
    $('iDrone').setAttribute('aria-pressed', 'true');
  });
  $('iMic').addEventListener('click', async () => {
    if (mic) {
      mic.stop();
      mic = null;
      $('iMic').setAttribute('aria-pressed', 'false');
      return;
    }
    mic = new MicPitchDetector();
    try {
      await mic.start((r) => {
        const pc = r.freq ? ((Math.round(freqToMidiFloat(r.freq)) % 12) + 12) % 12 : null;
        if (pc !== lastPc) {
          lastPc = pc;
          since = r.time;
          counted = false;
          circle.set({ heard: pc });
        }
        if (pc !== null && !counted && r.time - since > 120) {
          counted = true;
          const k = classify(pc);
          counts[k]++;
          updateStats();
          const label = k === 'chord' ? 'note de l’accord ✨' : k === 'scale' ? 'dans la gamme ✔' : 'hors gamme';
          $('iHeard').innerHTML = `<span class="hb-${k}">${noteName(pc, flat())}</span> · ${label}`;
        }
      });
      $('iMic').setAttribute('aria-pressed', 'true');
      setPracticeActive(true);
    } catch {
      mic = null;
      $('iHeard').textContent = 'Micro indisponible : autorise l’accès dans le navigateur.';
    }
  });
  const onChange = () => {
    st.tonic = Number($<HTMLSelectElement>('iKey').value);
    st.scale = $<HTMLSelectElement>('iScale').value as keyof typeof SCALES;
    st.progression = $<HTMLSelectElement>('iProg').value as keyof typeof PROGRESSIONS;
    st.bpm = Number($<HTMLInputElement>('iBpm').value) || 80;
    api.stop();
    if (droneNodes) {
      droneNodes.stop();
      droneNodes = startDrone(st.tonic);
    }
    build();
  };
  ['iKey', 'iScale', 'iProg', 'iBpm'].forEach((id) => $(id).addEventListener('change', onChange));
  $('iBack').addEventListener('click', () => {
    closeImprov();
    back();
  });
  setSuggestedTempo(() => st.bpm);
  cleanup = () => {
    setSuggestedTempo(null);
    mic?.stop();
    droneNodes?.stop();
    view.destroy();
    setPracticeActive(false);
  };
  build();
}

/** Bourdon : tonique et quinte, son doux. */
function startDrone(tonic: number): { ctx: AudioContext; stop: () => void } {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.6);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  filter.connect(gain).connect(ctx.destination);
  const base = 55 * Math.pow(2, (tonic + 3) / 12); // autour de La2–Sol♯3
  const oscs = [base, base * 1.5, base * 2].map((f, i) => {
    const o = ctx.createOscillator();
    o.type = i === 1 ? 'triangle' : 'sawtooth';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = i === 0 ? 0.5 : 0.25;
    o.connect(g).connect(filter);
    o.start();
    return o;
  });
  return {
    ctx,
    stop: () => {
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      setTimeout(() => {
        oscs.forEach((o) => o.stop());
        ctx.close();
      }, 350);
    },
  };
}
