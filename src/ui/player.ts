import type * as alphaTab from '@coderline/alphatab';
import { synth } from '@coderline/alphatab';
import { sectionsFor, songToAlphaTex, type Section, type Song } from '../songs/alphatex';
import { fingerNote, INSTRUMENTS } from '../songs/instruments';
import { freqToMidiFloat, midiName } from '../songs/notation';
import { fingerLabel, fingerVariant, placeMelody, positionLabel, solfege, type Placed } from '../songs/positions';
import { MicPitchDetector, type PitchReading } from '../practice/pitch-detector';
import { StepTrainer, type StepTarget, type TrainerUpdate } from '../practice/step-trainer';
import { GameJudge, type GameNote } from '../game/judge';
import { Highway } from '../game/highway';
import { checkBadges, recordResult } from '../game/progress';
import type { Exercise } from '../songs/exercise-bank';
import { ScoreKeeper, type Judgment } from '../game/scoring';
import { persist, progress, setPracticeActive, todayChallenge } from '../game/store';
import { prefs, savePrefs } from '../state/prefs';
import { Fingerboard, suggestedFinger, type BoardNote } from './fingerboard';
import { ScoreView, type ViewMode } from './score-view';
import { byId as $, esc } from './dom';
import { showResults, toast } from './results';
import { NoteCircle, scaleFromKey } from './circle';
import { isMetronomeRunning, setSuggestedTempo, startMetronome, stopMetronome } from './metronome';
import { startVoice, stopVoice, type VoiceCommand } from './voice';

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
        <button data-mode="game">🎮 Jeu & play-along</button>
      </div>
    </header>
    <div class="toolbar">
      <button id="play" class="primary only-live" disabled>▶ Lecture</button>
      <button id="stop" class="only-live" disabled aria-label="Stop">■</button>
      <div class="bpm" role="group" aria-label="Tempo">
        <button id="bpmDown" aria-label="Ralentir de 5 BPM">−</button>
        <label>♩ = <input id="bpm" type="number" min="30" max="240" step="1" inputmode="numeric" aria-label="Tempo en BPM" /> BPM</label>
        <button id="bpmUp" aria-label="Accélérer de 5 BPM">+</button>
        <input id="bpmRange" type="range" min="30" max="240" step="1" aria-label="Tempo" />
        <button id="bpmReset" class="ghost" title="Tempo d'origine">↺</button>
      </div>
      <select id="section" aria-label="Partie à travailler" hidden></select>
      <button id="voiceBtn" aria-pressed="false" title="Commandes vocales (mains libres)">🗣 Voix</button>
      <button id="moreBtn" class="ghost more-btn" aria-expanded="false" aria-label="Plus de réglages">⚙</button>
      <button id="loop" class="only-live more" aria-pressed="false">Boucle</button>
      <button id="metro" class="only-live more" aria-pressed="false">Métronome</button>
      <button id="countin" class="only-live more" aria-pressed="false">Décompte</button>
      <button id="backing" class="more" aria-pressed="${prefs.backing}" hidden title="Fond musical : accords, basse et batterie">🎶 Accompagnement</button>
      <select id="viewMode" class="no-game more" aria-label="Affichage">
        <option value="score">${inst.id === 'violin' ? 'Partition + doigtés' : 'Partition'}</option>
        <option value="score-tab">Partition + tablature${inst.id === 'violin' ? ' (demi-tons)' : ''}</option>
        <option value="tab">Tablature${inst.id === 'violin' ? ' (demi-tons)' : ''}</option>
      </select>
      <select id="track" class="more" aria-label="Piste" hidden></select>
      <button id="circleBtn" class="no-game" aria-pressed="${prefs.showCircle}" title="Cercle des notes : gamme, degrés, note à jouer">◯ Cercle</button>
      <button id="neckBtn" class="no-game more" aria-pressed="${prefs.showNeck}">Manche</button>
      <button id="zoomOut" class="no-game" aria-label="Dézoomer">A−</button>
      <button id="zoomIn" class="no-game" aria-label="Zoomer">A+</button>
      <select id="repeat" class="no-live" aria-label="Répétitions" title="Répéter l'exercice">
        ${[1, 3, 5, 10, 0].map((r) => `<option value="${r}" ${prefs.repeat === r ? 'selected' : ''}>${r === 0 ? '🔁 ∞' : r === 1 ? '🔁 1 fois' : `🔁 ${r} fois`}</option>`).join('')}
      </select>
      <button id="ksBtn" class="more" aria-pressed="${prefs.keySignatures}" title="Armure à la clé, ou dièses et bémols écrits devant chaque note">Armure</button>
      <label class="only-step more">Tolérance <input id="tol" type="range" min="10" max="60" step="5" value="${prefs.tolerance}" /> <output id="tolOut">±${prefs.tolerance} cents</output></label>
      <button id="restart" class="only-step more">↻ Recommencer</button>
    </div>
    <div id="micHelp" class="mic-help" role="status" hidden></div>
    <div id="voiceMsg" class="voice-msg" role="status" hidden></div>
    <div class="viz">
      <section id="neck" class="neck no-game" ${prefs.showNeck ? '' : 'hidden'}></section>
      <div id="circleBox" class="circle-box no-game" ${prefs.showCircle ? '' : 'hidden'}></div>
    </div>
    <div id="stepGuide" class="step-guide only-step">🎯 <strong>Pas à pas</strong> : clique sur <strong>▶ Commencer</strong> (ou dis « joue »), puis joue la note en orange sur le manche. L'app attend qu'elle soit juste avant de passer à la suivante. Pas de tempo : prends ton temps. 🔊 pour entendre la note, ▶ pour la passer. Pour jouer en rythme avec l'accompagnement, passe en <strong>🎮 Jeu & play-along</strong>.</div>
    <section id="step" class="step only-step">
      <div class="target">
        <strong id="tNote">–</strong>
        <span id="tPos" class="pos"></span>
      </div>
      <div class="tuner" aria-live="polite">
        <div class="bar"><div class="zone"></div><div id="needle" class="needle" hidden></div></div>
        <div class="tuner-line"><span id="verdict" class="verdict">Active le micro</span><span id="progress" class="muted"></span><span id="sCombo"></span><span id="sScore" class="muted">0 pt</span></div>
      </div>
      <div class="step-actions">
        <button id="micBtn" class="primary">▶ Commencer</button>
        <button id="autoHear" aria-pressed="${prefs.autoHear}" title="Jouer chaque nouvelle note automatiquement">🔊 auto</button>
        <div class="mic-meter" title="Niveau du micro"><span class="lvl" id="sLvl"></span></div>
        <span id="sHeard" class="heard muted">—</span>
        <button id="hear" aria-label="Écouter la note">🔊</button>
        <button id="prev" aria-label="Note précédente">◀</button>
        <button id="skip" aria-label="Passer la note">▶</button>
      </div>
    </section>
    <section id="game" class="game only-game">
      <div class="game-views seg" role="group" aria-label="Affichage du jeu">
        <button data-gview="highway" aria-pressed="${prefs.gameView === 'highway'}">🎮 Piste</button>
        <button data-gview="score" aria-pressed="${prefs.gameView === 'score'}">🎼 Partition (play-along)</button>
      </div>
      <div id="gFlash" class="g-flash"></div>
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
        <div class="mic-meter" title="Niveau du micro"><span class="lvl" id="gLvl"></span></div>
        <span id="gHeard" class="heard muted">—</span>
        <label title="Retard du micro à compenser">Latence <input id="gLat" type="range" min="0" max="250" step="10" value="${prefs.latencyMs}" /> <output id="gLatOut">${prefs.latencyMs} ms</output></label>
      </div>
      <p class="hint game-hint">🎧 Avec un casque, garde le guide audio. Avec des haut-parleurs, coupe-le : le micro l'entendrait.</p>
    </section>
    <div id="scroll" class="score-scroll no-game"><div id="score"></div></div>
    <p id="status" class="status">Chargement…</p>
    ${source.kind === 'library' && source.song.source ? `<p class="credit">Partition : <a href="${esc(source.song.source.url)}" target="_blank" rel="noopener">Mutopia Project</a> · ${esc(source.song.source.license)} · mélodie extraite automatiquement</p>` : ''}
    </div>`;

  const root = app.querySelector<HTMLElement>('.player')!;
  const v = new ScoreView($('score'), $('scroll'));
  const api = v.api;
  const playBtn = $<HTMLButtonElement>('play');
  const stopBtn = $<HTMLButtonElement>('stop');
  const viewSel = $<HTMLSelectElement>('viewMode');
  const trackSel = $<HTMLSelectElement>('track');
  viewSel.value = prefs.views[inst.id];

  // ---------- Chargement ----------
  api.playerReady.on(() => {
    playBtn.disabled = false;
    stopBtn.disabled = false;
    $('status').textContent = '';
  });
  let firstRender = true;
  api.renderFinished.on(() => {
    if (firstRender) {
      firstRender = false;
      if (prefs.views[inst.id] !== 'score-tab') v.setViewMode(prefs.views[inst.id]);
    }
  });
  // ---------- Parties ----------
  let sections: Section[] = [];
  let section: Section | null = null;
  const sectionSel = $<HTMLSelectElement>('section');
  const inSection = (beat: alphaTab.model.Beat) => !section || (beat.voice.bar.index >= section.first && beat.voice.bar.index <= section.last);
  function sectionRange(): { start: number; end: number } | null {
    const mbs = api.score?.masterBars;
    if (!section || !mbs) return null;
    const last = mbs[section.last];
    return { start: mbs[section.first].start, end: last.start + last.calculateDuration() };
  }
  function applySection() {
    const r = sectionRange();
    if (r) {
      const range = new synth.PlaybackRange();
      range.startTick = r.start;
      range.endTick = r.end;
      api.playbackRange = range;
    } else api.playbackRange = null;
    api.tickPosition = r ? r.start : 0;
  }
  api.scoreLoaded.on((score) => {
    sections = sectionsFor(score.masterBars.length, source.kind === 'library' ? source.song.sections : undefined);
    sectionSel.hidden = sections.length === 0;
    sectionSel.innerHTML =
      `<option value="">Morceau entier</option>` +
      sections.map((s, i) => `<option value="${i}">${esc(s.name)} · mes. ${s.first + 1}-${s.last + 1}</option>`).join('');
  });
  sectionSel.addEventListener('change', () => {
    section = sectionSel.value === '' ? null : sections[Number(sectionSel.value)];
    applySection();
    setMode(mode);
  });

  const backingTracks = () => (source.kind === 'library' ? (api.score?.tracks.slice(1) ?? []) : []);
  /** Volume relatif de l'accompagnement : la mélodie reste devant. */
  const BACKING_VOLUME = 0.3;
  const applyBacking = () => {
    const t = backingTracks();
    if (!t.length) return;
    api.changeTrackVolume(t, BACKING_VOLUME);
    api.changeTrackMute(t, !prefs.backing);
  };
  api.playerReady.on(applyBacking);
  api.scoreLoaded.on((score) => {
    if (source.kind === 'library' && score.tracks.length > 1) $('backing').hidden = false;
    if (source.kind === 'file' && score.tracks.length > 1) {
      trackSel.hidden = false;
      trackSel.innerHTML = score.tracks.map((t, i) => `<option value="${i}">${esc(t.name || `Piste ${i + 1}`)}</option>`).join('');
    }
    setTimeout(() => setMode(mode), 0);
  });
  api.error.on((e) => ($('status').textContent = `Erreur : ${e.message}`));

  if (source.kind === 'library') {
    v.loadTex(songToAlphaTex(source.song, inst, { keySignature: prefs.keySignatures }), [0]);
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
  // ---------- Tempo en BPM ----------
  let originalBpm = source.kind === 'library' ? source.song.tempo : 120;
  const bpmInput = $<HTMLInputElement>('bpm');
  const bpmRange = $<HTMLInputElement>('bpmRange');
  function setBpm(bpm: number, save = true) {
    const v2 = Math.round(Math.max(30, Math.min(240, bpm || originalBpm)));
    bpmInput.value = String(v2);
    bpmRange.value = String(v2);
    api.playbackSpeed = v2 / originalBpm;
    if (save) {
      if (v2 === originalBpm) delete prefs.bpmBySong[songId];
      else prefs.bpmBySong[songId] = v2;
      savePrefs();
    }
  }
  api.scoreLoaded.on((score) => {
    originalBpm = Math.round(score.tempo) || originalBpm;
    setBpm(prefs.bpmBySong[songId] ?? originalBpm, false);
  });
  setBpm(prefs.bpmBySong[songId] ?? originalBpm, false);
  bpmInput.addEventListener('change', () => setBpm(Number(bpmInput.value)));
  bpmRange.addEventListener('input', () => setBpm(Number(bpmRange.value)));
  $('bpmDown').addEventListener('click', () => setBpm(Number(bpmInput.value) - 5));
  $('bpmUp').addEventListener('click', () => setBpm(Number(bpmInput.value) + 5));
  $('bpmReset').addEventListener('click', () => setBpm(originalBpm));
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
  toggle('backing', (on) => {
    prefs.backing = on;
    savePrefs();
    applyBacking();
  });
  viewSel.addEventListener('change', () => {
    prefs.views[inst.id] = viewSel.value as ViewMode;
    savePrefs();
    v.setViewMode(prefs.views[inst.id]);
  });
  trackSel.addEventListener('change', () => {
    v.selectTrack(Number(trackSel.value));
    setMode(mode);
  });
  let zoom = prefs.zoom;
  if (zoom !== 1.1) v.setZoom(zoom);
  $('zoomIn').addEventListener('click', () => {
    v.setZoom((zoom = Math.min(3, zoom + 0.15)));
    prefs.zoom = zoom;
    savePrefs();
  });
  $('zoomOut').addEventListener('click', () => {
    v.setZoom((zoom = Math.max(0.6, zoom - 0.15)));
    prefs.zoom = zoom;
    savePrefs();
  });
  $<HTMLSelectElement>('repeat').addEventListener('change', (e) => {
    prefs.repeat = Number((e.target as HTMLSelectElement).value);
    savePrefs();
  });
  $('ksBtn').addEventListener('click', () => {
    prefs.keySignatures = !prefs.keySignatures;
    savePrefs();
    if (source.kind === 'library') v.loadTex(songToAlphaTex(source.song, inst, { keySignature: prefs.keySignatures }), [0]);
    $('ksBtn').setAttribute('aria-pressed', String(prefs.keySignatures));
  });
  $('back').addEventListener('click', () => exit());
  const toolbar = app.querySelector<HTMLElement>('.toolbar')!;
  $('moreBtn').addEventListener('click', () => {
    const open = !toolbar.classList.contains('open');
    toolbar.classList.toggle('open', open);
    $('moreBtn').setAttribute('aria-expanded', String(open));
  });

  // ---------- Doigtés et manche ----------
  function beatFingerings(beat: alphaTab.model.Beat | undefined): BoardNote[] {
    if (!beat || beat.isRest) return [];
    const tuning = beat.voice.bar.staff.stringTuning.tunings;
    return beat.notes
      .filter((n) => !n.isTieDestination || beat.notes.length === 1)
      .map((n) => {
        if (tuning.length === inst.tuning.length && n.fret >= 0 && n.string > 0) {
          // Dans le modèle alphaTab, la corde 1 est la plus grave ; doigt : 1 = index … 4 = auriculaire.
          const finger = n.fret === 0 ? 0 : n.leftHandFinger >= 1 && n.leftHandFinger <= 4 ? n.leftHandFinger : undefined;
          return { midi: n.realValue, string: tuning.length - n.string + 1, fret: n.fret, finger };
        }
        try {
          return { midi: n.realValue, ...fingerNote(n.realValue, inst) };
        } catch {
          return null;
        }
      })
      .filter((x): x is BoardNote => x !== null);
  }
  /** Nom de la note du beat : celui écrit sous la portée, sinon déduit de l'armure (bémols si armure en bémols). */
  function beatName(beat: alphaTab.model.Beat, midi: number): string {
    const written = beat.lyrics?.[0];
    if (written && written !== '_') return written;
    return solfege(midi, beat.voice.bar.masterBar.keySignature < 0);
  }
  /** Placement calculé (position, doigt bas/haut) de chaque note de la mélodie, pour les morceaux de la bibliothèque. */
  const placements = new Map<alphaTab.model.Beat, Placed>();
  function computePlacements() {
    placements.clear();
    if (source.kind !== 'library') return;
    const beats = v.trackBeats.filter((b) => !b.isRest && b.notes.length && !b.notes.every((n) => n.isTieDestination));
    const midis = beats.map((b) => Math.max(...b.notes.map((n) => n.realValue)));
    try {
      placeMelody(midis, inst, { onlyString: source.song.string, position: source.song.position }).forEach((p, i) => placements.set(beats[i], p));
    } catch {
      /* note hors tessiture : on garde les doigts de la partition */
    }
  }
  api.scoreLoaded.on(() => setTimeout(computePlacements, 0));

  const topFingering = (beat: alphaTab.model.Beat) => {
    const top = beatFingerings(beat).reduce<BoardNote | null>((a, b) => (!a || b.midi > a.midi ? b : a), null);
    if (!top) return null;
    const p = placements.get(beat);
    const extra = p && p.fret === top.fret && p.string === top.string ? { label: fingerLabel(p, inst), position: p.position } : {};
    return { ...top, name: beatName(beat, top.midi), ...extra };
  };

  function stringLabel(beat: alphaTab.model.Beat): string {
    const f = topFingering(beat);
    if (!f) return '';
    const sName = `corde de ${inst.stringNamesFr[f.string - 1]}`;
    if (f.fret === 0) return `${sName}, à vide`;
    const finger = f.finger ?? suggestedFinger(f.fret, inst);
    const p = placements.get(beat);
    const variant = p ? fingerVariant(p, inst) : '';
    const doigt = finger ? `, doigt ${finger}${variant ? ` ${variant}` : ''}` : '';
    const pos = p ? ` · ${positionLabel(p.position, inst)}` : '';
    return inst.id === 'violin' ? `${sName}${doigt}${pos}` : `${sName}, case ${f.fret}${doigt}${pos}`;
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
    if (mode !== 'live' && !(mode === 'game' && prefs.gameView === 'score')) return;
    const named = (b: alphaTab.model.Beat | undefined) => (b ? beatFingerings(b).map((f) => ({ ...f, name: beatName(b, f.midi) })) : []);
    const n1 = nextSounding(beat);
    board.show(named(beat), named(n1), named(n1 ? nextSounding(n1) : undefined));
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

  /** Indicateur micro : niveau et note entendue. */
  function showMic(r: PitchReading) {
    circleHeard(r.freq);
    const lvl = document.getElementById(mode === 'game' ? 'gLvl' : 'sLvl');
    const heard = document.getElementById(mode === 'game' ? 'gHeard' : 'sHeard');
    if (lvl) lvl.style.width = `${Math.round(r.level * 100)}%`;
    if (!heard) return;
    if (r.rawFreq > 0) {
      const m = freqToMidiFloat(r.rawFreq);
      const near = Math.round(m);
      const c = Math.round((m - near) * 100);
      heard.textContent = `j'entends ${solfege(near, false)}${Math.floor(near / 12) - 1} ${c >= 0 ? '+' : ''}${c}`;
      heard.classList.toggle('weak', !r.freq);
    } else heard.textContent = r.level > 0.15 ? 'son sans hauteur nette' : 'silence';
  }

  /** Message d'aide affiché tant que le micro n'est pas opérationnel. */
  function micHelp(html: string | null) {
    const el = document.getElementById('micHelp');
    if (!el) return;
    el.hidden = !html;
    el.innerHTML = html ?? '';
  }

  async function startMic(onReading: (r: PitchReading) => void): Promise<boolean> {
    stopMic();
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      micHelp(`🔒 Le micro n'est disponible que sur une page sécurisée (adresse en <strong>https://</strong>) et dans un vrai navigateur (Chrome, Edge, Firefox, Safari). Ouvre <a href="https://nikehatzfeld.github.io/string-coach/" target="_blank" rel="noopener">l'app dans ton navigateur</a>.`);
      return false;
    }
    micHelp('🎤 <strong>Autorise le micro</strong> dans la petite fenêtre du navigateur, en haut près de la barre d’adresse (« Autoriser »).');
    let pending = true;
    const slow = setTimeout(() => {
      if (pending) micHelp('⏳ Toujours en attente du micro : regarde en haut de l’écran, le navigateur te demande l’autorisation. Si rien n’apparaît, clique sur l’icône 🔒 ou 🎤 à gauche de l’adresse › Micro › Autoriser, puis recharge la page.');
    }, 5000);
    const m = new MicPitchDetector();
    mic = m;
    try {
      let heardSomething = false;
      await m.start((r) => {
        if (!heardSomething && r.level > 0.2) {
          heardSomething = true;
          micHelp(null);
        }
        showMic(r);
        onReading(r);
      });
      pending = false;
      clearTimeout(slow);
      micHelp('✅ Micro activé. Joue une note : la barre verte doit bouger. Si elle reste vide, vérifie le micro choisi dans les réglages son de ton ordinateur.');
      setPracticeActive(true);
      return true;
    } catch (err) {
      pending = false;
      clearTimeout(slow);
      if (mic === m) mic = null;
      micHelp(micErrorText(err));
      return false;
    }
  }
  function stopMic() {
    if (!mic) return;
    mic.stop();
    mic = null;
    setPracticeActive(false);
    const btn = document.getElementById('micBtn');
    if (btn) btn.textContent = '▶ Commencer';
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
      if (beat.isRest || beat.notes.length === 0 || !inSection(beat)) return;
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
      if (!stepAssisted && nextRound('step', keeper)) {
        // Nouveau tour : on garde le micro allumé.
        setTimeout(() => setupTrainer(), 600);
        return;
      }
      stopMic();
      finish('step', keeper, stepAssisted);
      return;
    }
    const beat = beatsByTarget[trainer.index];
    const name = beatName(beat, t.midi);
    const octave = Math.floor(t.midi / 12) - 1;
    $('tNote').innerHTML = `${name}<small>${octave}</small>`;
    $('tPos').textContent = `${/♯/.test(name) ? 'dièse · ' : /♭/.test(name) ? 'bémol · ' : ''}${midiName(t.midi, 'en')} · ${stringLabel(beat)}`;
    v.focusBeat(beat);
    if (prefs.autoHear) api.playBeat(beat);
    circle.set({ target: ((t.midi % 12) + 12) % 12 });
    const cur = topFingering(beat);
    const at = (k: number) => {
      const b = beatsByTarget[trainer!.index + k];
      const f = b ? topFingering(b) : null;
      return f ? [f] : [];
    };
    board.show(cur ? [cur] : [], at(1), at(2));
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
    $('micBtn').textContent = '⏳ Micro';
    setVerdict('Autorise le micro…', '');
    const ok = await startMic((r) => trainer && onUpdate(trainer.update(r.freq, r.time, r.rms), r.time));
    $('micBtn').textContent = ok ? '⏹ Arrêter' : '▶ Commencer';
    if (ok) $('stepGuide').hidden = true;
    if (ok) setVerdict('À toi de jouer…', '');
    else setVerdict('Micro indisponible (voir le message ci-dessus)', 'bad');
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
      if (beat.isRest || beat.notes.length === 0 || !inSection(beat)) continue;
      const f = topFingering(beat);
      if (!f) continue;
      if (beat.notes.every((n) => n.isTieDestination)) {
        const prev = notes[notes.length - 1];
        if (prev) prev.duration += beat.playbackDuration;
        continue;
      }
      const finger = f.finger ?? suggestedFinger(f.fret, inst);
      notes.push({
        tick: beat.absolutePlaybackStart,
        duration: beat.playbackDuration,
        midi: f.midi,
        lane: inst.tuning.length - f.string,
        // Violon : doigt ; guitare : case (comme sur la tablature).
        label: inst.id === 'violin' ? (f.label ?? String(finger ?? f.fret)) : String(f.fret),
        name: f.name,
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
    // Fin de la partie travaillée en mode jeu.
    const r = sectionRange();
    if (mode === 'game' && gameRunning && r && e.currentTick >= r.end - 1) setTimeout(() => stopGame(true), 400);
    if (e.modifiedTempo > 0) ticksPerMs = (e.modifiedTempo * 960) / 60000;
    lastTick = e.currentTick;
    if (mode === 'game' && highway) highway.sync(e.currentTick, ticksPerMs, gameRunning && api.playerState === 1);
  });
  api.playerStateChanged.on((e) => {
    if (mode === 'game' && highway) highway.sync(lastTick, ticksPerMs, gameRunning && e.state === 1);
  });

  async function startGame() {
    // Débloque l'audio du lecteur pendant le clic (Safari / Android refusent de démarrer le son plus tard).
    try {
      api.play();
      api.pause();
    } catch {
      /* lecteur pas encore prêt */
    }
    if (!judge || !highway) setupGame();
    if (!judge?.notes.length) return;
    judge.reset();
    gameKeeper = new ScoreKeeper(judge.notes.length);
    judge.opts.latencyMs = prefs.latencyMs;
    updateGameHud();
    const ok = await startMic((r) => {
      if (!gameRunning || !judge || !highway) return;
      const heard = r.freq ? freqToMidiFloat(r.freq) : null;
      for (const ev of judge.update(heard, highway.tick, highway.speed, r.rms)) {
        gameKeeper.register(ev.judgment);
        highway.feedback(ev.note, ev.judgment);
        flash(ev.judgment, ev.note.name);
        if (gameKeeper.combo > 0 && gameKeeper.combo % 10 === 0) pulse($('gMult'));
      }
      updateGameHud();
    });
    if (!ok) {
      return;
    }
    $('gStart').hidden = true;
    $('gStop').hidden = false;
    api.stop();
    const track = api.score?.tracks[Number(trackSel.value) || 0];
    if (track) api.changeTrackMute([track], !prefs.guide);
    // Métronome seulement s'il n'y a ni mélodie guide ni accompagnement pour donner le tempo.
    api.metronomeVolume = prefs.guide || (prefs.backing && backingTracks().length) ? 0 : 0.8;
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
      if (nextRound('game', gameKeeper)) {
        setupGame();
        setTimeout(() => startGame(), 1200);
        return;
      }
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
        songId: section ? `${songId}#${sections.indexOf(section) + 1}` : songId,
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
    // Règle de progression du tempo (seulement sur le morceau entier ou la partie travaillée, pas en mode assisté).
    let tempoNote: string | undefined;
    if (outcome.tempoChange && !assisted) {
      const before = Number(bpmInput.value);
      setBpm(before + outcome.tempoChange);
      tempoNote =
        outcome.tempoChange > 0
          ? `🚀 3 passages propres : tempo monté à ${bpmInput.value} BPM (+${outcome.tempoChange})`
          : `🐢 Tempo baissé à ${bpmInput.value} BPM (−${-outcome.tempoChange}) pour consolider`;
    } else {
      const streak = progress.songs[section ? `${songId}#${sections.indexOf(section) + 1}` : songId]?.cleanStreak ?? 0;
      if (streak > 0) tempoNote = `Passages propres : ${streak} / 3 avant de monter le tempo`;
    }
    // Exercice : validé avec 3 étoiles au tempo cible ou plus vite.
    const ex = source.kind === 'library' ? (source.song as Partial<Exercise>) : null;
    if (ex?.targetBpm && songId.startsWith('ex-') && !section) {
      const playedBpm = Number(bpmInput.value) - (outcome.tempoChange > 0 ? outcome.tempoChange : 0);
      if (stars === 3 && playedBpm >= ex.targetBpm && !progress.validated?.[songId]) {
        progress.validated = { ...(progress.validated ?? {}), [songId]: new Date().toISOString().slice(0, 10) };
        outcome.newBadges.push(...checkBadges(progress, null));
        persist();
        tempoNote = `✅ Exercice validé à ${playedBpm} BPM !`;
      } else if (!progress.validated?.[songId]) {
        tempoNote = `${tempoNote ? `${tempoNote} · ` : ''}Objectif de validation : 3 étoiles à ${ex.targetBpm} BPM (joué à ${playedBpm})`;
      }
    }
    const act = await showResults({
      tempoNote,
      title: section ? `${title} · ${section.name}` : title,
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

  // ---------- Répétitions ----------
  let round = 0;
  /** Faut-il enchaîner un nouveau tour sans afficher les résultats ? */
  function nextRound(m: 'step' | 'game', k: ScoreKeeper): boolean {
    const total = prefs.repeat;
    if (total === 1 || (total > 1 && round >= total - 1)) {
      round = 0;
      return false;
    }
    round++;
    const pct = Math.round(k.finalAccuracy() * 100);
    toast(`🔁 Tour ${round}${total ? ` / ${total}` : ''} : ${pct} % · ${k.stars()} ★ — on enchaîne`, 2500);
    recordResult(progress, { songId, mode: m, score: k.score, stars: k.stars(), notes: k.total, perfect: k.counts.perfect, accuracy: k.finalAccuracy(), maxCombo: k.maxCombo }, todayChallenge());
    persist();
    return true;
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
    } else if (mode === 'step' && (e.key === 'n' || e.key === 'MediaTrackNext' || e.key === 'PageDown')) {
      e.preventDefault();
      skip();
    } else if (mode === 'step' && (e.key === 'p' || e.key === 'MediaTrackPrevious' || e.key === 'PageUp')) {
      e.preventDefault();
      back();
    } else if (e.key === 'PageDown' && mode === 'live') {
      e.preventDefault();
      api.playPause();
    } else if (e.key === 'PageDown' && mode === 'game') {
      e.preventDefault();
      gameRunning ? stopGame(false) : startGame();
    }
  };
  document.addEventListener('keydown', keyHandler);

  function exit() {
    closePlayer();
    onExit();
  }

  // ---------- Cercle des notes ----------
  const circle = new NoteCircle($('circleBox'));
  const sc = source.kind === 'library' ? scaleFromKey(source.song.key) : null;
  circle.set(sc ? { tonic: sc.tonic, scale: sc.scale, flat: sc.flat } : { tonic: 0, scale: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] });
  $('circleBtn').addEventListener('click', () => {
    prefs.showCircle = !prefs.showCircle;
    savePrefs();
    $('circleBtn').setAttribute('aria-pressed', String(prefs.showCircle));
    $('circleBox').hidden = !prefs.showCircle;
  });
  let lastHeard: number | null = null;
  const circleHeard = (freq: number | null) => {
    const pc = freq ? ((Math.round(freqToMidiFloat(freq)) % 12) + 12) % 12 : null;
    if (pc !== lastHeard) {
      lastHeard = pc;
      circle.set({ heard: pc });
    }
  };

  // ---------- Vue du jeu et retours visuels ----------
  const applyGameView = () => {
    root.classList.toggle('gview-score', prefs.gameView === 'score');
    app.querySelectorAll('[data-gview]').forEach((x) => x.setAttribute('aria-pressed', String((x as HTMLElement).dataset.gview === prefs.gameView)));
    if (prefs.gameView === 'score' && mode === 'game') $('neck').hidden = !prefs.showNeck;
  };
  app.querySelectorAll<HTMLButtonElement>('[data-gview]').forEach((b) =>
    b.addEventListener('click', () => {
      prefs.gameView = b.dataset.gview as 'highway' | 'score';
      savePrefs();
      applyGameView();
    }),
  );
  applyGameView();
  let flashTimer = 0;
  function flash(j: Judgment, name?: string) {
    const el = document.getElementById('gFlash');
    if (!el || prefs.gameView !== 'score') return;
    el.textContent = j === 'perfect' ? `Parfait ! ${name ?? ''}` : j === 'good' ? `Bien ${name ?? ''}` : j === 'miss' ? `Raté ${name ?? ''}` : '';
    el.className = `g-flash show ${j}`;
    clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => (el.className = 'g-flash'), 600);
  }
  $('autoHear').addEventListener('click', () => {
    prefs.autoHear = !prefs.autoHear;
    savePrefs();
    $('autoHear').setAttribute('aria-pressed', String(prefs.autoHear));
  });

  // ---------- Commandes vocales ----------
  const voiceMsg = (msg: string, ok: boolean) => {
    const el = document.getElementById('voiceMsg');
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
    el.classList.toggle('bad', !ok);
  };
  function onVoice(c: VoiceCommand, heard: string) {
    voiceMsg(`🗣 « ${heard.trim()} »`, true);
    if (c.kind === 'bpm' && c.value) return setBpm(c.value);
    if (c.kind === 'section' && c.value) {
      const opt = sections[c.value - 1];
      if (opt) {
        sectionSel.value = String(c.value - 1);
        sectionSel.dispatchEvent(new Event('change'));
      }
      return;
    }
    switch (c.action) {
      case 'start':
        if (mode === 'live') api.play();
        else if (mode === 'step') !mic && $('micBtn').click();
        else if (!gameRunning) startGame();
        break;
      case 'stop':
        if (mode === 'live') api.stop();
        else if (mode === 'step') stopMic();
        else stopGame(false);
        break;
      case 'pause':
        api.pause();
        break;
      case 'next':
        if (mode === 'step') skip();
        break;
      case 'prev':
        if (mode === 'step') back();
        break;
      case 'restart':
        if (mode === 'live') {
          api.stop();
          api.play();
        } else if (mode === 'step') setupTrainer();
        else {
          stopGame(false);
          setupGame();
          startGame();
        }
        break;
      case 'faster':
        setBpm(Number(bpmInput.value) + 5);
        break;
      case 'slower':
        setBpm(Number(bpmInput.value) - 5);
        break;
      case 'metronome':
        isMetronomeRunning() ? stopMetronome() : startMetronome();
        break;
      case 'loop':
        if (mode === 'live') $('loop').click();
        else {
          prefs.repeat = prefs.repeat === 0 ? 1 : 0;
          savePrefs();
          $<HTMLSelectElement>('repeat').value = String(prefs.repeat);
          voiceMsg(prefs.repeat === 0 ? '🔁 Répétition à l’infini' : '🔁 Une seule fois', true);
        }
        break;
      case 'mic':
        $('micBtn').click();
        break;
      case 'hear':
        $('hear').click();
        break;
      case 'mode-live':
      case 'mode-step':
      case 'mode-game':
        setMode(c.action.slice(5) as Mode);
        break;
      case 'whole':
        sectionSel.value = '';
        sectionSel.dispatchEvent(new Event('change'));
        break;
    }
  }
  const setVoice = (on: boolean) => {
    prefs.voice = on;
    savePrefs();
    $('voiceBtn').setAttribute('aria-pressed', String(on));
    if (on) startVoice(onVoice, voiceMsg);
    else {
      stopVoice();
      const el = document.getElementById('voiceMsg');
      if (el) el.hidden = true;
    }
  };
  $('voiceBtn').addEventListener('click', () => setVoice(!prefs.voice));
  if (prefs.voice) setVoice(true);

  setSuggestedTempo(() => Number(bpmInput.value) || null);
  cleanup = () => {
    stopVoice();
    setSuggestedTempo(null);
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

/** Explication claire d'un échec d'accès au micro. */
function micErrorText(err: unknown): string {
  const name = (err as DOMException)?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return '🚫 <strong>Accès au micro bloqué.</strong> Clique sur l’icône 🔒 (ou 🎤 barrée) à gauche de l’adresse › Micro › <strong>Autoriser</strong>, puis recharge la page. Sur Mac : Réglages Système › Confidentialité et sécurité › Microphone › autorise ton navigateur. Sur Windows : Paramètres › Confidentialité › Microphone.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return '🔌 <strong>Aucun micro trouvé.</strong> Branche ou active un micro, vérifie qu’il est choisi comme entrée dans les réglages son de ton ordinateur, puis réessaie.';
    case 'NotReadableError':
    case 'AbortError':
      return '🔇 <strong>Le micro est occupé ou bloqué par le système.</strong> Ferme les autres applications qui l’utilisent (Zoom, Teams, Discord…), vérifie les autorisations du système, puis réessaie.';
    default:
      return `⚠️ Le micro n’a pas pu démarrer (${name || (err as Error)?.message || 'erreur inconnue'}). Essaie de recharger la page ou un autre navigateur (Chrome, Edge, Firefox).`;
  }
}

function pulse(el: HTMLElement) {
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
}

function looksLikeAlphaTex(bytes: Uint8Array): boolean {
  return bytes.length > 0 && bytes[0] === 0x5c; // commence par « \ »
}
