import './style.css';
import type * as alphaTab from '@coderline/alphatab';
import { songToAlphaTex, type Song } from './songs/alphatex';
import { fingerNote, INSTRUMENTS, type InstrumentId } from './songs/instruments';
import { Fingerboard, type BoardNote } from './ui/fingerboard';
import { LIBRARY, STYLES } from './songs/library';
import { midiName } from './songs/notation';
import { MicPitchDetector } from './practice/pitch-detector';
import { StepTrainer, type StepTarget, type TrainerUpdate } from './practice/step-trainer';
import { ScoreView, type ViewMode } from './ui/score-view';
import { installSpatialNav } from './ui/spatial-nav';
import { deleteImport, listImports, saveImport, type ImportedSong } from './ui/imports-store';

// ---------- Préférences (par appareil) ----------
interface Prefs {
  instrument: InstrumentId;
  view: ViewMode;
  tolerance: number;
  speed: number;
  showNeck: boolean;
}
const PREFS_KEY = 'string-coach:prefs';
function loadPrefs(): Prefs {
  const base: Prefs = { instrument: 'violin', view: 'score-tab', tolerance: 35, speed: 1, showNeck: true };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return base;
  }
}
const prefs = loadPrefs();
function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

const app = document.getElementById('app')!;
installSpatialNav();

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const LEVEL = ['', 'Débutant', 'Intermédiaire', 'Avancé'];

// ---------- Bibliothèque ----------
let styleFilter: string | null = null;
let search = '';

async function renderLibrary() {
  cleanupPlayer();
  const imports = await listImports();
  const songs = LIBRARY.filter(
    (s) =>
      (!styleFilter || s.style === styleFilter) &&
      (!search || `${s.title} ${s.composer}`.toLowerCase().includes(search.toLowerCase())),
  );
  app.innerHTML = `
    <header class="top">
      <h1>String Coach</h1>
      <div class="seg" role="group" aria-label="Instrument">
        ${(['violin', 'guitar'] as InstrumentId[])
          .map(
            (id) =>
              `<button data-inst="${id}" aria-pressed="${prefs.instrument === id}">${INSTRUMENTS[id].label}</button>`,
          )
          .join('')}
      </div>
    </header>
    <main class="library">
      <div class="filters">
        <input id="search" type="text" placeholder="Rechercher un morceau" value="${esc(search)}" />
        <button class="chip" data-style="" aria-pressed="${!styleFilter}">Tous</button>
        ${STYLES.map((s) => `<button class="chip" data-style="${esc(s)}" aria-pressed="${styleFilter === s}">${esc(s)}</button>`).join('')}
      </div>
      <section class="grid">
        ${songs
          .map(
            (s) => `
          <button class="card" data-song="${s.id}">
            <span class="style">${esc(s.style)}</span>
            <strong>${esc(s.title)}</strong>
            <span class="meta">${esc(s.composer)} · ${LEVEL[s.level]} · ${s.tempo} bpm</span>
          </button>`,
          )
          .join('')}
      </section>
      <h2>Mes fichiers</h2>
      <p class="hint">Importe des fichiers Guitar Pro (.gp, .gp5, .gpx), MusicXML (.xml, .musicxml, .mxl) ou alphaTex (.tex). Ils restent sur cet appareil.</p>
      <label class="drop" tabindex="0">
        <input id="file" type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx,.xml,.musicxml,.mxl,.tex,.txt" multiple hidden />
        Glisser des fichiers ici ou choisir…
      </label>
      <section class="grid">
        ${imports
          .map(
            (i) => `
          <div class="card imported">
            <button class="open" data-import="${esc(i.id)}"><strong>${esc(i.name)}</strong><span class="meta">Importé</span></button>
            <button class="del" data-del="${esc(i.id)}" aria-label="Supprimer ${esc(i.name)}">✕</button>
          </div>`,
          )
          .join('')}
      </section>
    </main>`;

  app.querySelectorAll<HTMLButtonElement>('[data-inst]').forEach((b) =>
    b.addEventListener('click', () => {
      prefs.instrument = b.dataset.inst as InstrumentId;
      savePrefs();
      renderLibrary();
    }),
  );
  app.querySelectorAll<HTMLButtonElement>('[data-style]').forEach((b) =>
    b.addEventListener('click', () => {
      styleFilter = b.dataset.style || null;
      renderLibrary();
    }),
  );
  const searchEl = app.querySelector<HTMLInputElement>('#search')!;
  searchEl.addEventListener('change', () => {
    search = searchEl.value;
    renderLibrary();
  });
  app.querySelectorAll<HTMLButtonElement>('[data-song]').forEach((b) =>
    b.addEventListener('click', () => {
      const song = LIBRARY.find((s) => s.id === b.dataset.song)!;
      openPlayer({ kind: 'library', song });
    }),
  );
  app.querySelectorAll<HTMLButtonElement>('[data-import]').forEach((b) =>
    b.addEventListener('click', () => {
      const imp = imports.find((i) => i.id === b.dataset.import)!;
      openPlayer({ kind: 'import', imp });
    }),
  );
  app.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      await deleteImport(b.dataset.del!);
      renderLibrary();
    }),
  );

  const fileEl = app.querySelector<HTMLInputElement>('#file')!;
  const drop = app.querySelector<HTMLLabelElement>('.drop')!;
  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    let last: ImportedSong | null = null;
    for (const f of files) last = await saveImport(f);
    if (files.length === 1 && last) openPlayer({ kind: 'import', imp: last });
    else renderLibrary();
  };
  fileEl.addEventListener('change', () => handleFiles(fileEl.files));
  drop.addEventListener('keydown', (e) => e.key === 'Enter' && fileEl.click());
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    handleFiles(e.dataTransfer?.files ?? null);
  });
}

// ---------- Lecteur ----------
type Source = { kind: 'library'; song: Song } | { kind: 'import'; imp: ImportedSong };

let view: ScoreView | null = null;
let mic: MicPitchDetector | null = null;
let trainer: StepTrainer | null = null;
let keyHandler: ((e: KeyboardEvent) => void) | null = null;

function cleanupPlayer() {
  mic?.stop();
  mic = null;
  trainer = null;
  view?.destroy();
  view = null;
  if (keyHandler) document.removeEventListener('keydown', keyHandler);
  keyHandler = null;
}

function openPlayer(source: Source) {
  cleanupPlayer();
  const inst = INSTRUMENTS[prefs.instrument];
  const title = source.kind === 'library' ? source.song.title : source.imp.name;
  let mode: 'live' | 'step' = 'live';

  app.innerHTML = `
    <header class="top player-top">
      <button id="back" aria-label="Retour à la bibliothèque">← Bibliothèque</button>
      <h1>${esc(title)}</h1>
      <div class="seg" role="group" aria-label="Mode">
        <button data-mode="live" aria-pressed="true">Écoute</button>
        <button data-mode="step" aria-pressed="false">Pas à pas</button>
      </div>
    </header>
    <div class="toolbar">
      <button id="play" class="primary" disabled>▶ Lecture</button>
      <button id="stop" disabled>■</button>
      <label>Tempo <input id="speed" type="range" min="0.25" max="1.5" step="0.05" value="${prefs.speed}" /> <output id="speedOut">${Math.round(prefs.speed * 100)} %</output></label>
      <button id="loop" aria-pressed="false">Boucle</button>
      <button id="metro" aria-pressed="false">Métronome</button>
      <button id="countin" aria-pressed="false">Décompte</button>
      <select id="viewMode" aria-label="Affichage">
        <option value="score-tab">Partition + tablature</option>
        <option value="tab">Tablature</option>
        <option value="score">Partition</option>
      </select>
      <select id="track" aria-label="Piste" hidden></select>
      <button id="neckBtn" aria-pressed="${prefs.showNeck}">Manche</button>
      <button id="zoomOut" aria-label="Dézoomer">A−</button>
      <button id="zoomIn" aria-label="Zoomer">A+</button>
    </div>
    <section id="neck" class="neck" ${prefs.showNeck ? '' : 'hidden'}></section>
    <section id="step" class="step" hidden>
      <div class="target">
        <span class="label">Note à jouer</span>
        <strong id="tNote">–</strong>
        <span id="tPos" class="pos"></span>
      </div>
      <div class="tuner" aria-live="polite">
        <div class="scale"><span>−50</span><span>0</span><span>+50</span></div>
        <div class="bar"><div class="zone"></div><div id="needle" class="needle" hidden></div></div>
        <span id="verdict" class="verdict">Active le micro pour commencer</span>
      </div>
      <div class="step-actions">
        <button id="micBtn" class="primary">🎤 Activer le micro</button>
        <button id="hear">🔊 Écouter la note</button>
        <button id="prev">◀ Précédente</button>
        <button id="skip">Suivante ▶</button>
        <button id="restart">Recommencer</button>
        <label>Tolérance <input id="tol" type="range" min="10" max="60" step="5" value="${prefs.tolerance}" /> <output id="tolOut">±${prefs.tolerance} cents</output></label>
        <span id="progress" class="progress"></span>
      </div>
    </section>
    <div id="scroll" class="score-scroll"><div id="score"></div></div>
    <p id="status" class="status">Chargement…</p>`;

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const scoreEl = $('score');
  view = new ScoreView(scoreEl, $('scroll'));
  const api = view.api;
  const v = view;

  const playBtn = $<HTMLButtonElement>('play');
  const stopBtn = $<HTMLButtonElement>('stop');
  const viewSel = $<HTMLSelectElement>('viewMode');
  const trackSel = $<HTMLSelectElement>('track');
  viewSel.value = prefs.view;

  api.playerReady.on(() => {
    playBtn.disabled = false;
    stopBtn.disabled = false;
    $('status').textContent = '';
  });
  api.playerStateChanged.on((e) => {
    playBtn.textContent = e.state === 1 ? '❚❚ Pause' : '▶ Lecture';
  });
  api.playbackSpeed = prefs.speed;
  let firstRender = true;
  api.renderFinished.on(() => {
    if (firstRender) {
      firstRender = false;
      if (prefs.view !== 'score-tab') v.setViewMode(prefs.view);
    }
  });
  api.scoreLoaded.on((score) => {
    if (score.tracks.length > 1) {
      trackSel.hidden = false;
      trackSel.innerHTML = score.tracks.map((t, i) => `<option value="${i}">${esc(t.name || `Piste ${i + 1}`)}</option>`).join('');
    }
    if (mode === 'step') setupTrainer();
  });

  if (source.kind === 'library') {
    v.loadTex(songToAlphaTex(source.song, inst));
  } else if (source.imp.name.endsWith('.tex') || isText(source.imp.data)) {
    v.loadTex(new TextDecoder().decode(source.imp.data));
  } else if (!v.loadFile(source.imp.data)) {
    $('status').textContent = 'Format non reconnu.';
  }
  api.error.on((e) => ($('status').textContent = `Erreur : ${e.message}`));

  // Commandes de lecture
  playBtn.addEventListener('click', () => api.playPause());
  stopBtn.addEventListener('click', () => api.stop());
  const speed = $<HTMLInputElement>('speed');
  speed.addEventListener('input', () => {
    prefs.speed = Number(speed.value);
    api.playbackSpeed = prefs.speed;
    $('speedOut').textContent = `${Math.round(prefs.speed * 100)} %`;
    savePrefs();
  });
  const toggle = (id: string, apply: (on: boolean) => void) => {
    const b = $<HTMLButtonElement>(id);
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      apply(on);
    });
  };
  toggle('loop', (on) => (api.isLooping = on));
  toggle('metro', (on) => (api.metronomeVolume = on ? 1 : 0));
  toggle('countin', (on) => (api.countInVolume = on ? 1 : 0));
  viewSel.addEventListener('change', () => {
    prefs.view = viewSel.value as ViewMode;
    savePrefs();
    v.setViewMode(prefs.view);
  });
  trackSel.addEventListener('change', () => {
    v.selectTrack(Number(trackSel.value));
    if (mode === 'step') setupTrainer();
  });
  let zoom = 1.1;
  $('zoomIn').addEventListener('click', () => v.setZoom((zoom = Math.min(2.5, zoom + 0.15))));
  $('zoomOut').addEventListener('click', () => v.setZoom((zoom = Math.max(0.6, zoom - 0.15))));
  $('back').addEventListener('click', () => renderLibrary());

  // Modes
  app.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      mode = b.dataset.mode as 'live' | 'step';
      app.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('step').hidden = mode !== 'step';
      if (mode === 'step') {
        api.stop();
        setupTrainer();
      } else {
        mic?.stop();
        mic = null;
        $('micBtn').textContent = '🎤 Activer le micro';
        api.clearPlaybackRangeHighlight();
      }
    }),
  );

  // ---------- Pas à pas ----------
  let beatsByTarget: alphaTab.model.Beat[] = [];
  function setupTrainer() {
    const beats = v.trackBeats;
    const targets: StepTarget[] = [];
    beatsByTarget = [];
    beats.forEach((beat, i) => {
      if (beat.isRest || beat.notes.length === 0) return;
      if (beat.notes.every((n) => n.isTieDestination)) return;
      const top = Math.max(...beat.notes.map((n) => n.realValue));
      targets.push({ midi: top, beatIndex: i });
      beatsByTarget.push(beat);
    });
    trainer = new StepTrainer(targets, { toleranceCents: prefs.tolerance });
    showTarget();
  }

  /** Corde (1 = la plus aiguë) et position de chaque note d'un beat, pour l'instrument choisi. */
  function beatFingerings(beat: alphaTab.model.Beat | undefined): BoardNote[] {
    if (!beat || beat.isRest) return [];
    const tuning = beat.voice.bar.staff.stringTuning.tunings;
    return beat.notes
      .filter((n) => !n.isTieDestination || beat.notes.length === 1)
      .map((n) => {
        if (tuning.length === inst.tuning.length && n.fret >= 0 && n.string > 0) {
          // Dans le modèle alphaTab, la corde 1 est la plus grave.
          return { midi: n.realValue, string: tuning.length - n.string + 1, fret: n.fret };
        }
        try {
          return { midi: n.realValue, ...fingerNote(n.realValue, inst) };
        } catch {
          return null;
        }
      })
      .filter((x): x is BoardNote => x !== null);
  }

  function stringLabel(beat: alphaTab.model.Beat): string {
    const f = beatFingerings(beat).reduce<BoardNote | null>((a, b) => (!a || b.midi > a.midi ? b : a), null);
    if (!f) return '';
    const sName = `corde de ${inst.stringNamesFr[f.string - 1]}`;
    if (f.fret === 0) return `${sName}, à vide`;
    return inst.id === 'violin' ? `${sName}, +${f.fret} demi-ton${f.fret > 1 ? 's' : ''}` : `${sName}, case ${f.fret}`;
  }

  // Manche
  const board = new Fingerboard($('neck'), inst);
  $('neckBtn').addEventListener('click', () => {
    prefs.showNeck = !prefs.showNeck;
    savePrefs();
    $('neckBtn').setAttribute('aria-pressed', String(prefs.showNeck));
    $('neck').hidden = !prefs.showNeck;
  });
  const nextSounding = (beat: alphaTab.model.Beat) => {
    const beats = v.trackBeats;
    for (let i = beats.indexOf(beat) + 1; i < beats.length; i++) if (!beats[i].isRest) return beats[i];
    return undefined;
  };
  api.playedBeatChanged.on((beat) => {
    if (mode === 'live') board.show(beatFingerings(beat), beatFingerings(nextSounding(beat)));
  });
  api.playerStateChanged.on((e) => {
    if (e.stopped && mode === 'live') board.show([]);
  });

  function showTarget() {
    if (!trainer) return;
    const t = trainer.current;
    $('progress').textContent = `${Math.min(trainer.index + 1, trainer.targets.length)} / ${trainer.targets.length}`;
    if (!t) {
      $('tNote').textContent = 'Bravo !';
      $('tPos').textContent = 'Morceau terminé';
      setVerdict('Morceau terminé 🎉', 'ok');
      board.show([]);
      return;
    }
    const beat = beatsByTarget[trainer.index];
    $('tNote').textContent = midiName(t.midi, 'fr');
    $('tPos').textContent = `${midiName(t.midi, 'en')} · ${stringLabel(beat)}`;
    v.focusBeat(beat);
    board.show(beatFingerings(beat), beatFingerings(beatsByTarget[trainer.index + 1]));
  }

  function setVerdict(text: string, cls: string) {
    const el = $('verdict');
    el.textContent = text;
    el.className = `verdict ${cls}`;
  }

  function onUpdate(u: TrainerUpdate) {
    const needle = $('needle');
    if (u.cents !== null) {
      const c = Math.max(-50, Math.min(50, u.cents));
      needle.style.left = `${50 + c}%`;
      needle.hidden = false;
    } else needle.hidden = true;
    const heard = u.heardMidi !== null ? midiName(Math.round(u.heardMidi), 'fr') : '';
    switch (u.verdict) {
      case 'silence':
        setVerdict('À toi de jouer…', '');
        break;
      case 'listening':
        setVerdict('Relâche puis rejoue la note', '');
        break;
      case 'too-low':
        setVerdict(`Trop bas (${heard}, ${Math.round(u.cents!)} cents)`, 'bad');
        break;
      case 'too-high':
        setVerdict(`Trop haut (${heard}, +${Math.round(u.cents!)} cents)`, 'bad');
        break;
      case 'holding':
        setVerdict('Juste, tiens la note…', 'near');
        break;
      case 'validated':
        setVerdict('✔ Juste !', 'ok');
        showTarget();
        break;
    }
  }

  $('micBtn').addEventListener('click', async () => {
    if (mic) {
      await mic.stop();
      mic = null;
      $('micBtn').textContent = '🎤 Activer le micro';
      return;
    }
    if (!trainer) setupTrainer();
    mic = new MicPitchDetector();
    try {
      await mic.start((r) => trainer && onUpdate(trainer.update(r.freq, r.time)));
      $('micBtn').textContent = '⏹ Couper le micro';
    } catch {
      mic = null;
      setVerdict('Micro refusé ou indisponible : utilise « Suivante ▶ ».', 'bad');
    }
  });
  $('hear').addEventListener('click', () => {
    const beat = trainer && beatsByTarget[trainer.index];
    if (beat) api.playBeat(beat);
  });
  $('skip').addEventListener('click', () => {
    trainer?.skip();
    showTarget();
  });
  $('prev').addEventListener('click', () => {
    trainer?.back();
    showTarget();
  });
  $('restart').addEventListener('click', () => {
    trainer?.reset();
    showTarget();
  });
  const tol = $<HTMLInputElement>('tol');
  tol.addEventListener('input', () => {
    prefs.tolerance = Number(tol.value);
    savePrefs();
    $('tolOut').textContent = `±${prefs.tolerance} cents`;
    if (trainer) trainer.options.toleranceCents = prefs.tolerance;
  });

  // Raccourcis clavier / télécommande
  keyHandler = (e: KeyboardEvent) => {
    const tag = (document.activeElement as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT') return;
    if (e.key === ' ' || e.key === 'MediaPlayPause') {
      e.preventDefault();
      if (mode === 'live') api.playPause();
    } else if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'BrowserBack') {
      e.preventDefault();
      renderLibrary();
    } else if (mode === 'step' && (e.key === 'n' || e.key === 'MediaTrackNext')) {
      trainer?.skip();
      showTarget();
    } else if (mode === 'step' && (e.key === 'p' || e.key === 'MediaTrackPrevious')) {
      trainer?.back();
      showTarget();
    }
  };
  document.addEventListener('keydown', keyHandler);
  playBtn.focus();
}

function isText(buf: ArrayBuffer): boolean {
  const head = new Uint8Array(buf.slice(0, 64));
  return head.length > 0 && head.every((b) => b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127) || b >= 0xc2) && head[0] === 0x5c; // commence par « \ »
}

renderLibrary();
