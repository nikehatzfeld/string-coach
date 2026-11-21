import type * as alphaTab from '@coderline/alphatab';
import { songToAlphaTex, type Song } from '../songs/alphatex';
import { fingerNote, INSTRUMENTS } from '../songs/instruments';
import { freqToMidiFloat, midiName } from '../songs/notation';
import { MicPitchDetector } from '../practice/pitch-detector';
import { StepTrainer, type StepTarget, type TrainerUpdate } from '../practice/step-trainer';
import { GameJudge, type GameNote } from '../game/judge';
import { Highway } from '../game/highway';
import { recordResult } from '../game/progress';
import { ScoreKeeper, type Judgment } from '../game/scoring';
import { persist, progress, setPracticeActive, todayChallenge } from '../game/store';
import { prefs, savePrefs } from '../state/prefs';
import { Fingerboard, suggestedFinger, type BoardNote } from './fingerboard';
import { ScoreView, type ViewMode } from './score-view';
import { byId as $, esc } from './dom';
import { showResults } from './results';

export type Source =
  | { kind: 'library'; song: Song }
  | { kind: 'file'; id: string; name: string; data: ArrayBuffer | Uint8Array; origin: 'import' | 'vault' };

type Mode = 'live' | 'step' | 'game';

export function sourceId(s: Source): string {
  return s.kind === 'library' ? s.song.id : `${s.origin}:${s.id}`;
}

let cleanup: (() => void) | null = null;

export function closePlayer(): void {
  cleanup?.();
  cleanup = null;
}

export function openPlayer(app: HTMLElement, source: Source, onExit: () => void, initialMode: Mode = 'live'): void {
  closePlayer();
  const inst = INSTRUMENTS[prefs.instrument];
  const title = source.kind === 'library' ? source.song.title : source.name;
  const songId = sourceId(source);
  const best = progress.songs[songId];
  let mode: Mode = initialMode;
  let mic: MicPitchDetector | null = null;

  app.innerHTML = `
    <div class="player mode-${mode}">
    <header class="top player-top">
      <button id="back" class="ghost" aria-label="Retour">←</button>
      <div class="ptitle"><h1>${esc(title)}</h1>${best ? `<span class="pbest">Record ${best.best.toLocaleString('fr-FR')} · ${'★'.repeat(best.stars)}${'☆'.repeat(3 - best.stars)}</span>` : ''}</div>
      <div class="seg modes" role="group" aria-label="Mode">
        <button data-mode="live">🎧 Écoute</button>
        <button data-mode="step">🎯 Pas à pas</button>
        <button data-mode="game">🎮 Jeu</button>
      </div>
    </header>
    <div class="toolbar">
      <button id="play" class="primary only-live" disabled>▶ Lecture</button>
      <button id="stop" class="only-live" disabled aria-label="Stop">■</button>
      <label>Tempo <input id="speed" type="range" min="0.25" max="1.5" step="0.05" value="${prefs.speed}" /> <output id="speedOut">${Math.round(prefs.speed * 100)} %</output></label>
      <button id="loop" class="only-live" aria-pressed="false">Boucle</button>
      <button id="metro" class="only-live" aria-pressed="false">Métronome</button>
      <button id="countin" class="only-live" aria-pressed="false">Décompte</button>
      <select id="viewMode" class="no-game" aria-label="Affichage">
        <option value="score-tab">Partition + tablature</option>
        <option value="tab">Tablature</option>
        <option value="score">Partition</option>
      </select>
      <select id="track" aria-label="Piste" hidden></select>
      <button id="neckBtn" class="no-game" aria-pressed="${prefs.showNeck}">Manche</button>
      <button id="zoomOut" class="no-game" aria-label="Dézoomer">A−</button>
      <button id="zoomIn" class="no-game" aria-label="Zoomer">A+</button>
    </div>
    <section id="neck" class="neck no-game" ${prefs.showNeck ? '' : 'hidden'}></section>
    <section id="step" class="step only-step">
      <div class="target">
        <span class="label">Note à jouer</span>
        <strong id="tNote">–</strong>
        <span id="tPos" class="pos"></span>
      </div>
      <div class="tuner" aria-live="polite">
        <div class="hud-mini"><span id="sScore">0 pt</span><span id="sCombo"></span><span id="progress"></span></div>
        <div class="scale"><span>−50</span><span>0</span><span>+50</span></div>
        <div class="bar"><div class="zone"></div><div id="needle" class="needle" hidden></div></div>
        <span id="verdict" class="verdict">Active le micro pour commencer</span>
      </div>
      <div class="step-actions">
        <button id="micBtn" class="primary">🎤 Activer le micro</button>
        <button id="hear">🔊 Écouter la note</button>
        <button id="prev">◀</button>
        <button id="skip">Passer ▶</button>
        <button id="restart">↻ Recommencer</button>
        <label>Tolérance <input id="tol" type="range" min="10" max="60" step="5" value="${prefs.tolerance}" /> <output id="tolOut">±${prefs.tolerance} cents</output></label>
      </div>
    </section>
    <section id="game" class="game only-game">
      <div class="hud">
        <div><span class="hud-label">Score</span><strong id="gScore">0</strong></div>
        <div><span class="hud-label">Combo</span><strong id="gCombo">0</strong><span id="gMult" class="mult">×1</span></div>
        <div><span class="hud-label">Justesse</span><strong id="gAcc">–</strong></div>
      </div>
      <canvas id="highway" class="highway"></canvas>
      <div id="countdown" class="countdown" hidden></div>
      <div class="game-actions">
        <button id="gStart" class="primary big">▶ Jouer</button>
        <button id="gStop" hidden>■ Arrêter</button>
        <button id="gGuide" aria-pressed="${prefs.guide}" title="Joue la mélodie pendant que tu joues. Coupe-le avec des haut-parleurs : le micro l'entendrait.">🎵 Guide audio</button>
        <label title="Retard du micro à compenser">Latence <input id="gLat" type="range" min="0" max="250" step="10" value="${prefs.latencyMs}" /> <output id="gLatOut">${prefs.latencyMs} ms</output></label>
      </div>
      <p class="hint game-hint">🎧 Avec un casque, garde le guide audio. Avec des haut-parleurs, coupe-le : le micro l'entendrait.</p>
    </section>
    <div id="scroll" class="score-scroll no-game"><div id="score"></div></div>
    <p id="status" class="status">Chargement…</p>
    </div>`;

  const root = app.querySelector<HTMLElement>('.player')!;
  const v = new ScoreView($('score'), $('scroll'));
  const api = v.api;
  const playBtn = $<HTMLButtonElement>('play');
  const stopBtn = $<HTMLButtonElement>('stop');
  const viewSel = $<HTMLSelectElement>('viewMode');
  const trackSel = $<HTMLSelectElement>('track');
  viewSel.value = prefs.view;

  // ---------- Chargement ----------
  api.playerReady.on(() => {
    playBtn.disabled = false;
    stopBtn.disabled = false;
    $('status').textContent = '';
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
    setTimeout(() => setMode(mode), 0);
  });
  api.error.on((e) => ($('status').textContent = `Erreur : ${e.message}`));

  if (source.kind === 'library') {
    v.loadTex(songToAlphaTex(source.song, inst));
  } else {
    const bytes = source.data instanceof Uint8Array ? source.data : new Uint8Array(source.data);
    if (source.name.endsWith('.tex') || looksLikeAlphaTex(bytes)) v.loadTex(new TextDecoder().decode(bytes));
    else if (!v.loadFile(bytes.slice().buffer)) $('status').textContent = 'Format non reconnu.';
  }

  // ---------- Barre d'outils ----------
  playBtn.addEventListener('click', () => api.playPause());
  stopBtn.addEventListener('click', () => api.stop());
  api.playerStateChanged.on((e) => {
    const playing = e.state === 1;
    playBtn.textContent = playing ? '❚❚ Pause' : '▶ Lecture';
    setPracticeActive(playing || !!mic);
  });
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
    setMode(mode);
  });
  let zoom = 1.1;
  $('zoomIn').addEventListener('click', () => v.setZoom((zoom = Math.min(2.5, zoom + 0.15))));
  $('zoomOut').addEventListener('click', () => v.setZoom((zoom = Math.max(0.6, zoom - 0.15))));
  $('back').addEventListener('click', () => exit());

  // ---------- Doigtés et manche ----------
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
  const topFingering = (beat: alphaTab.model.Beat) =>
    beatFingerings(beat).reduce<BoardNote | null>((a, b) => (!a || b.midi > a.midi ? b : a), null);

  function stringLabel(beat: alphaTab.model.Beat): string {
    const f = topFingering(beat);
    if (!f) return '';
    const sName = `corde de ${inst.stringNamesFr[f.string - 1]}`;
    if (f.fret === 0) return `${sName}, à vide`;
    return inst.id === 'violin' ? `${sName}, +${f.fret} demi-ton${f.fret > 1 ? 's' : ''}` : `${sName}, case ${f.fret}`;
  }

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

  // ---------- Modes ----------
  function setMode(m: Mode) {
    stopGame(false);
    stopMic();
    if (m !== 'live') api.stop();
    mode = m;
    root.className = `player mode-${m}`;
    app.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String((x as HTMLElement).dataset.mode === m)));
    api.clearPlaybackRangeHighlight();
    if (m === 'step') setupTrainer();
    if (m === 'game') setupGame();
    if (m === 'live') board.show([]);
  }
  app.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode as Mode)));

  async function startMic(onReading: (freq: number | null, time: number) => void): Promise<boolean> {
    stopMic();
    mic = new MicPitchDetector();
    try {
      await mic.start((r) => onReading(r.freq, r.time));
      setPracticeActive(true);
      return true;
    } catch {
      mic = null;
      return false;
    }
  }
  function stopMic() {
    if (!mic) return;
    mic.stop();
    mic = null;
    setPracticeActive(false);
    const btn = document.getElementById('micBtn');
    if (btn) btn.textContent = '🎤 Activer le micro';
  }

  // ---------- Pas à pas (noté) ----------
  let trainer: StepTrainer | null = null;
  let beatsByTarget: alphaTab.model.Beat[] = [];
  let keeper = new ScoreKeeper(0);
  let errorSince: number | null = null;
  let hadError = false;
  let stepAssisted = false;

  function setupTrainer() {
    const targets: StepTarget[] = [];
    beatsByTarget = [];
    v.trackBeats.forEach((beat, i) => {
      if (beat.isRest || beat.notes.length === 0) return;
      if (beat.notes.every((n) => n.isTieDestination)) return;
      targets.push({ midi: Math.max(...beat.notes.map((n) => n.realValue)), beatIndex: i });
      beatsByTarget.push(beat);
    });
    trainer = new StepTrainer(targets, { toleranceCents: prefs.tolerance });
    keeper = new ScoreKeeper(targets.length);
    hadError = false;
    errorSince = null;
    stepAssisted = false;
    updateStepHud();
    showTarget();
  }

  function updateStepHud() {
    $('sScore').textContent = `${keeper.score.toLocaleString('fr-FR')} pt`;
    $('sCombo').textContent = keeper.combo >= 3 ? `🔥 ${keeper.combo} ×${keeper.multiplier}` : '';
    if (trainer) $('progress').textContent = `${Math.min(trainer.index + 1, trainer.targets.length)} / ${trainer.targets.length}`;
  }

  function showTarget() {
    if (!trainer) return;
    updateStepHud();
    if (!trainer.targets.length) {
      $('tNote').textContent = '–';
      return;
    }
    const t = trainer.current;
    if (!t) {
      $('tNote').textContent = 'Bravo !';
      $('tPos').textContent = 'Morceau terminé';
      setVerdict('Morceau terminé 🎉', 'ok');
      board.show([]);
      stopMic();
      finish('step', keeper, stepAssisted);
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

  function onUpdate(u: TrainerUpdate, now: number) {
    const needle = $('needle');
    if (u.cents !== null) {
      needle.style.left = `${50 + Math.max(-50, Math.min(50, u.cents))}%`;
      needle.hidden = false;
    } else needle.hidden = true;
    const heard = u.heardMidi !== null ? midiName(Math.round(u.heardMidi), 'fr') : '';
    if (u.verdict === 'too-low' || u.verdict === 'too-high') {
      if (errorSince === null) errorSince = now;
      if (now - errorSince >= 150) hadError = true;
    } else errorSince = null;
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
      case 'validated': {
        const j: Judgment = hadError ? 'ok' : 'perfect';
        keeper.register(j);
        hadError = false;
        setVerdict(j === 'perfect' ? '✔ Parfait !' : '✔ Juste', 'ok');
        pulse($('tNote'));
        showTarget();
        break;
      }
    }
  }

  $('micBtn').addEventListener('click', async () => {
    if (mic) return stopMic();
    if (!trainer) setupTrainer();
    const ok = await startMic((freq, time) => trainer && onUpdate(trainer.update(freq, time), time));
    if (ok) $('micBtn').textContent = '⏹ Couper le micro';
    else setVerdict('Micro refusé ou indisponible : utilise « Passer ▶ ».', 'bad');
  });
  $('hear').addEventListener('click', () => {
    const beat = trainer && beatsByTarget[trainer.index];
    if (beat) api.playBeat(beat);
  });
  const skip = () => {
    if (!trainer || trainer.finished) return;
    keeper.register('miss');
    hadError = false;
    trainer.skip();
    showTarget();
  };
  const back = () => {
    stepAssisted = true;
    trainer?.back();
    showTarget();
  };
  $('skip').addEventListener('click', skip);
  $('prev').addEventListener('click', back);
  $('restart').addEventListener('click', () => setupTrainer());
  const tol = $<HTMLInputElement>('tol');
  tol.addEventListener('input', () => {
    prefs.tolerance = Number(tol.value);
    savePrefs();
    $('tolOut').textContent = `±${prefs.tolerance} cents`;
    if (trainer) trainer.options.toleranceCents = prefs.tolerance;
  });

  // ---------- Mode jeu ----------
  let highway: Highway | null = null;
  let judge: GameJudge | null = null;
  let gameKeeper = new ScoreKeeper(0);
  let gameRunning = false;
  let lastTick = 0;
  let ticksPerMs = 1.6;

  function buildGameNotes(): GameNote[] {
    const notes: GameNote[] = [];
    for (const beat of v.trackBeats) {
      if (beat.isRest || beat.notes.length === 0) continue;
      const f = topFingering(beat);
      if (!f) continue;
      if (beat.notes.every((n) => n.isTieDestination)) {
        const prev = notes[notes.length - 1];
        if (prev) prev.duration += beat.playbackDuration;
        continue;
      }
      const finger = suggestedFinger(f.fret, inst);
      notes.push({
        tick: beat.absolutePlaybackStart,
        duration: beat.playbackDuration,
        midi: f.midi,
        lane: inst.tuning.length - f.string,
        label: inst.id === 'violin' ? String(finger ?? f.fret) : String(f.fret),
      });
    }
    return notes;
  }

  function setupGame() {
    highway?.destroy();
    const notes = buildGameNotes();
    judge = new GameJudge(notes, { latencyMs: prefs.latencyMs, toleranceCents: Math.max(40, prefs.tolerance + 10) });
    const lanes = [...inst.stringNamesFr].reverse();
    highway = new Highway($<HTMLCanvasElement>('highway'), notes, lanes);
    highway.sync(notes[0] ? notes[0].tick - 960 * 2 : 0, ticksPerMs, false);
    gameKeeper = new ScoreKeeper(notes.length);
    updateGameHud();
  }

  function updateGameHud() {
    $('gScore').textContent = gameKeeper.score.toLocaleString('fr-FR');
    $('gCombo').textContent = String(gameKeeper.combo);
    $('gMult').textContent = `×${gameKeeper.multiplier}`;
    $('gMult').className = `mult m${gameKeeper.multiplier}`;
    $('gAcc').textContent = gameKeeper.played ? `${Math.round(gameKeeper.accuracy * 100)} %` : '–';
  }

  api.playerPositionChanged.on((e) => {
    if (e.modifiedTempo > 0) ticksPerMs = (e.modifiedTempo * 960) / 60000;
    lastTick = e.currentTick;
    if (mode === 'game' && highway) highway.sync(e.currentTick, ticksPerMs, gameRunning && api.playerState === 1);
  });
  api.playerStateChanged.on((e) => {
    if (mode === 'game' && highway) highway.sync(lastTick, ticksPerMs, gameRunning && e.state === 1);
  });

  async function startGame() {
    if (!judge || !highway) setupGame();
    if (!judge?.notes.length) return;
    judge.reset();
    gameKeeper = new ScoreKeeper(judge.notes.length);
    judge.opts.latencyMs = prefs.latencyMs;
    updateGameHud();
    const ok = await startMic((freq) => {
      if (!gameRunning || !judge || !highway) return;
      const heard = freq ? freqToMidiFloat(freq) : null;
      for (const ev of judge.update(heard, highway.tick, highway.speed)) {
        gameKeeper.register(ev.judgment);
        highway.feedback(ev.note, ev.judgment);
        if (gameKeeper.combo > 0 && gameKeeper.combo % 10 === 0) pulse($('gMult'));
      }
      updateGameHud();
    });
    if (!ok) {
      $('status').textContent = 'Micro refusé ou indisponible : le mode jeu en a besoin.';
      return;
    }
    $('gStart').hidden = true;
    $('gStop').hidden = false;
    api.stop();
    const track = api.score?.tracks[Number(trackSel.value) || 0];
    if (track) api.changeTrackMute([track], !prefs.guide);
    api.metronomeVolume = prefs.guide ? 0 : 0.8;
    await countdown();
    gameRunning = true;
    api.play();
  }

  function stopGame(withResults: boolean) {
    if (!gameRunning) return;
    gameRunning = false;
    api.stop();
    api.metronomeVolume = 0;
    const track = api.score?.tracks[Number(trackSel.value) || 0];
    if (track) api.changeTrackMute([track], false);
    stopMic();
    const start = document.getElementById('gStart');
    const stop = document.getElementById('gStop');
    if (start) start.hidden = false;
    if (stop) stop.hidden = true;
    if (withResults && judge && highway) {
      for (const ev of judge.update(null, lastTick + 1e9, ticksPerMs)) gameKeeper.register(ev.judgment);
      updateGameHud();
      finish('game', gameKeeper, false);
    }
  }

  api.playerFinished.on(() => {
    if (mode === 'game' && gameRunning) stopGame(true);
  });
  $('gStart').addEventListener('click', () => startGame());
  $('gStop').addEventListener('click', () => {
    stopGame(false);
    setupGame();
  });
  toggle('gGuide', (on) => {
    prefs.guide = on;
    savePrefs();
  });
  const lat = $<HTMLInputElement>('gLat');
  lat.addEventListener('input', () => {
    prefs.latencyMs = Number(lat.value);
    savePrefs();
    $('gLatOut').textContent = `${prefs.latencyMs} ms`;
    if (judge) judge.opts.latencyMs = prefs.latencyMs;
  });

  function countdown(): Promise<void> {
    const el = $('countdown');
    el.hidden = false;
    return new Promise((resolve) => {
      let n = 3;
      const step = () => {
        if (n === 0) {
          el.hidden = true;
          resolve();
          return;
        }
        el.textContent = String(n);
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
        n--;
        setTimeout(step, 700);
      };
      step();
    });
  }

  // ---------- Fin de morceau ----------
  async function finish(m: 'step' | 'game', k: ScoreKeeper, assisted: boolean) {
    const accuracy = k.finalAccuracy();
    const stars = assisted ? Math.min(1, k.stars()) as 0 | 1 : k.stars();
    const outcome = recordResult(
      progress,
      {
        songId,
        style: source.kind === 'library' ? source.song.style : undefined,
        mode: m,
        score: k.score,
        stars,
        notes: k.total,
        perfect: k.counts.perfect,
        accuracy,
        maxCombo: k.maxCombo,
      },
      todayChallenge(),
    );
    persist();
    const act = await showResults({
      title,
      mode: m,
      score: k.score,
      stars,
      accuracy,
      maxCombo: k.maxCombo,
      counts: k.counts,
      outcome,
      xpTotal: progress.xp,
    });
    if (act === 'replay') setMode(m);
    else exit();
  }

  // ---------- Clavier / télécommande ----------
  const keyHandler = (e: KeyboardEvent) => {
    if (document.querySelector('.modal-backdrop')) return;
    const tag = (document.activeElement as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT') return;
    if (e.key === ' ' || e.key === 'MediaPlayPause') {
      e.preventDefault();
      if (mode === 'live') api.playPause();
      else if (mode === 'game') gameRunning ? stopGame(false) : startGame();
    } else if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'BrowserBack') {
      e.preventDefault();
      exit();
    } else if (mode === 'step' && (e.key === 'n' || e.key === 'MediaTrackNext')) skip();
    else if (mode === 'step' && (e.key === 'p' || e.key === 'MediaTrackPrevious')) back();
  };
  document.addEventListener('keydown', keyHandler);

  function exit() {
    closePlayer();
    onExit();
  }

  cleanup = () => {
    gameRunning = false;
    stopMic();
    highway?.destroy();
    v.destroy();
    setPracticeActive(false);
    document.removeEventListener('keydown', keyHandler);
  };

  setMode(mode);
  playBtn.focus();
}

function pulse(el: HTMLElement) {
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
}

function looksLikeAlphaTex(bytes: Uint8Array): boolean {
  return bytes.length > 0 && bytes[0] === 0x5c; // commence par « \ »
}
