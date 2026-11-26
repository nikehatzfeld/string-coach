import type * as alphaTab from '@coderline/alphatab';
import { synth } from '@coderline/alphatab';
import { sectionsFor, songToAlphaTex, type Section, type Song } from '../songs/alphatex';
import { fingerNote, INSTRUMENTS } from '../songs/instruments';
import { centsToNearestOctave, freqToMidiFloat, midiName } from '../songs/notation';
import { centsStats, summarize, type NoteLog } from '../academy/metrics';
import { logAttempt } from '../academy/store';
import { playHook } from '../academy/hook';
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
import { openMicTest } from './mic-test';
import { RecorderBoard } from './recorder-board';
import { isRap } from '../songs/rap-originals';
import { RapVoice, speechSupported, voicesFor } from '../audio/rap-voice';
import { loadAudio } from '../state/audio-store';
import { SingJudge } from '../game/sing';
import { SingLane } from '../game/sing-lane';
import { LyricsStrip } from './lyrics-strip';
import { lyricsOf, lyricSyllables } from '../songs/lyrics';
import { PitchTrace } from './voice-board';
import { recorderTip } from '../songs/recorder';
import { chartFromSong } from '../courses/chords-content';
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

const ATTACK: Record<string, string> = { violin: 'nouveau coup d’archet', guitar: 'repince la corde', recorder: 'nouveau coup de langue « tu »', voice: 'nouvelle syllabe' };

let cleanup: (() => void) | null = null;

export function closePlayer(): void {
  cleanup?.();
  cleanup = null;
}

export function openPlayer(app: HTMLElement, source: Source, onExit: () => void, initialMode: Mode = 'live'): void {
  closePlayer();
  const inst = INSTRUMENTS[prefs.instrument];
  // Rap : le chant est jugé sur le placement (flow), pas sur la justesse.
  const rapFlow = inst.kind === 'voice' && source.kind === 'library' && isRap(source.song.style);
  // Rap : les vers sont dits par une vraie voix (synthèse vocale) à la place des notes « ooh ».
  const spoken = rapFlow && source.kind === 'library' ? source.song.spoken : undefined;
  const rapVoice = spoken && source.kind === 'library' && speechSupported() ? new RapVoice(spoken, source.song.tempo) : null;
  if (rapVoice) rapVoice.voiceName = prefs.rapVoice;
  const tolerance = () => (rapFlow ? 1200 : inst.kind === 'voice' ? prefs.voiceTolerance : prefs.tolerance);
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
      <span id="rangeBox" class="range-box" hidden>mes. <input id="rFrom" type="number" min="1" inputmode="numeric" aria-label="Première mesure" /> à <input id="rTo" type="number" min="1" inputmode="numeric" aria-label="Dernière mesure" /> <button id="rOk" class="primary" title="Travailler ces mesures en boucle">🔁</button></span>
 ${inst.id === 'guitar' && source.kind === 'library' && chartFromSong(source.song) ? '<button id="chordsBtn" title="Jouer les accords du morceau (grattage, capo, micro)">🎸 Accords</button>' : ''}
      <button id="voiceBtn" aria-pressed="false" title="Commandes vocales (mains libres)">🗣 Voix</button>
      <button id="moreBtn" class="ghost more-btn" aria-expanded="false" aria-label="Plus de réglages">⚙</button>
      <button id="loop" class="only-live more" aria-pressed="false">Boucle</button>
      <button id="metro" class="only-live more" aria-pressed="false">Métronome</button>
      <button id="countin" class="only-live more" aria-pressed="false">Décompte</button>
      <button id="backing" class="more" aria-pressed="${prefs.backing}" hidden title="Fond musical : accords, basse et batterie">🎶 Accompagnement</button>
      ${rapVoice ? '<select id="rapVoiceSel" title="Voix du rappeur (synthèse vocale de ton appareil)" aria-label="Voix du rappeur"></select>' : ''}
      <select id="viewMode" class="no-game more" aria-label="Affichage" ${inst.kind !== 'strings' ? 'hidden' : ''}>
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
      ${rapFlow ? '<span class="muted" title="Pour le rap, le jeu et le pas à pas jugent le placement des syllabes, pas la hauteur">🎤 Rap : seul le placement compte</span>' : ''}
      <label class="no-live ${inst.kind === 'voice' ? '' : 'more'}" ${rapFlow ? 'style="display:none"' : ''} title="Justesse demandée">Justesse <input id="tol" type="range" min="10" max="100" step="5" value="${inst.kind === 'voice' ? prefs.voiceTolerance : prefs.tolerance}" /> <output id="tolOut">±${inst.kind === 'voice' ? prefs.voiceTolerance : prefs.tolerance} cents</output></label>
      <button id="stepHold" class="only-step more" aria-pressed="${prefs.stepHold}" title="Tenir chaque note sa durée écrite (au tempo choisi)">⏱ Tenir la durée</button>
      <button id="stepDetache" class="only-step more" aria-pressed="${prefs.stepDetache}" title="Chaque note doit être attaquée : ${inst.id === 'violin' ? 'coup d’archet' : inst.id === 'guitar' ? 'nouveau coup de médiator ou de doigt' : inst.id === 'recorder' ? 'coup de langue « tu »' : 'nouvelle syllabe'} ou petit silence entre deux notes">✂ Détaché</button>
      <button id="restart" class="only-step more">↻ Recommencer</button>
      <button id="micTest" class="more">🎤 Test micro</button>
      <label class="more" title="Si le son est étouffé ou absent, essaie l’autre banque de sons">🔈 Sons <select id="sfSel"><option value="musescore" ${prefs.soundfont === 'musescore' ? 'selected' : ''}>Qualité</option><option value="sonivox" ${prefs.soundfont === 'sonivox' ? 'selected' : ''}>Compatible</option></select></label>
      <label class="no-live more" title="Fréquence du La : 440 Hz standard, ou celle de ton accordage">La = <input id="a4" type="number" min="415" max="466" step="0.5" value="${prefs.a4}" /> Hz</label>
      <label class="no-live more">🎤 <select id="micSel" aria-label="Micro"><option value="">Micro par défaut</option></select></label>
    </div>
    <div id="micHelp" class="mic-help" role="status" hidden></div>
    <div id="voiceMsg" class="voice-msg" role="status" hidden></div>
    <div id="lyrics"></div>
    <div class="viz">
      <section id="neck" class="neck no-game" ${prefs.showNeck ? '' : 'hidden'}></section>
      <div id="circleBox" class="circle-box no-game" ${prefs.showCircle ? '' : 'hidden'}></div>
    </div>
    <section id="step" class="step only-step">
      <div class="target">
        <strong id="tNote">–</strong>
        <span id="tPos" class="pos"></span>
      </div>
      <div class="tuner" aria-live="polite">
        <div class="bar"><div class="zone"></div><div id="needle" class="needle" hidden></div></div>
        <div class="tuner-line"><span id="verdict" class="verdict">Clique ▶ Commencer</span><span id="progress" class="muted"></span><span id="sCombo"></span><span id="sScore" class="muted">0 pt</span></div>
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
  /** Clé de progression d'une partie (prédéfinie : n°, choisie : plage de mesures). */
  const sectionKey = () => {
    if (!section) return '';
    const i = sections.indexOf(section);
    return i >= 0 ? `#${i + 1}` : `#m${section.first + 1}-${section.last + 1}`;
  };
  let barCount = 0;
  function fillSections() {
    sectionSel.hidden = barCount < 2;
    const custom = section && !sections.includes(section) ? section : null;
    sectionSel.innerHTML =
      `<option value="">Morceau entier</option>` +
      sections.map((s, i) => `<option value="${i}">${esc(s.name)} · mes. ${s.first + 1}-${s.last + 1}</option>`).join('') +
      (custom ? `<option value="c">🔁 ${esc(custom.name)}</option>` : '') +
      `<option value="line">📏 Ligne en cours (en boucle)</option><option value="pick">✂ Choisir des mesures…</option>`;
    sectionSel.value = custom ? 'c' : section ? String(sections.indexOf(section)) : '';
  }
  api.scoreLoaded.on((score) => {
    barCount = score.masterBars.length;
    sections = sectionsFor(barCount, source.kind === 'library' ? source.song.sections : undefined);
    section = null;
    fillSections();
  });
  /** Mesure où se trouve le curseur (lecture ou note à jouer). */
  function cursorBar(): number {
    const mbs = api.score?.masterBars ?? [];
    const tick = api.tickPosition;
    let bar = 0;
    for (let i = 0; i < mbs.length; i++) if (mbs[i].start <= tick) bar = i;
    return bar;
  }
  /** Mesures de la ligne affichée qui contient la mesure donnée. */
  function lineOf(bar: number): [number, number] {
    for (const sys of api.renderer.boundsLookup?.staffSystems ?? []) {
      const idx = sys.bars.map((b) => b.index);
      if (idx.includes(bar)) return [Math.min(...idx), Math.max(...idx)];
    }
    return [bar, Math.min(barCount - 1, bar + 3)];
  }
  /** Travaille une plage de mesures en boucle, dans tous les modes. */
  function loopBars(first: number, last: number) {
    first = Math.max(0, Math.min(barCount - 1, first));
    last = Math.max(first, Math.min(barCount - 1, last));
    section = { name: `Mesures ${first + 1}-${last + 1}`, first, last };
    fillSections();
    $('rangeBox').hidden = true;
    if (!api.isLooping) $('loop').click();
    const rep = $<HTMLSelectElement>('repeat');
    if (rep.value !== '0') {
      rep.value = '0';
      rep.dispatchEvent(new Event('change'));
    }
    applySection();
    setMode(mode);
  }
  sectionSel.addEventListener('change', () => {
    const v = sectionSel.value;
    if (v === 'line') return loopBars(...lineOf(cursorBar()));
    if (v === 'pick') {
      const [a, b] = section ? [section.first, section.last] : lineOf(cursorBar());
      $<HTMLInputElement>('rFrom').value = String(a + 1);
      $<HTMLInputElement>('rTo').value = String(b + 1);
      $<HTMLInputElement>('rFrom').max = $<HTMLInputElement>('rTo').max = String(barCount);
      $('rangeBox').hidden = false;
      $<HTMLInputElement>('rFrom').focus();
      return;
    }
    if (v === 'c') return;
    $('rangeBox').hidden = true;
    section = v === '' ? null : sections[Number(v)];
    applySection();
    setMode(mode);
  });
  $('rOk').addEventListener('click', () => loopBars(Number($<HTMLInputElement>('rFrom').value) - 1, Number($<HTMLInputElement>('rTo').value) - 1));
  ['rFrom', 'rTo'].forEach((id) => $(id).addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Enter' && $('rOk').click()));

  const backingTracks = () => (source.kind === 'library' ? (api.score?.tracks.slice(1) ?? []) : []);
  /** Volume relatif de l'accompagnement : la mélodie reste devant. */
  const BACKING_VOLUME = 0.3;
  // ---------- Instru originale (piste audio personnelle) ----------
  const songAudio = source.kind === 'library' ? source.song.audio : undefined;
  let instru: HTMLAudioElement | null = null;
  let instruUrl = '';
  if (songAudio) {
    void loadAudio(songAudio.id)
      .then((blob) => {
        if (!blob) return;
        instruUrl = URL.createObjectURL(blob);
        instru = new Audio(instruUrl);
        (instru as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
        instru.muted = !prefs.backing;
        if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __instru: unknown }).__instru = instru;
        $('backing').hidden = false;
        $('backing').textContent = '🎶 Instru originale';
        applyBacking();
      })
      .catch(() => {});
  }
  // iPhone / Safari : un son ne peut démarrer que pendant un toucher. On « débloque » l'instru au premier toucher.
  let instruBlocked = false;
  let instruUnlocked = false;
  app.addEventListener(
    'pointerdown',
    () => {
      if (!instru || instruUnlocked) return;
      instruUnlocked = true;
      const a = instru;
      const was = a.muted;
      a.muted = true;
      void a
        .play()
        .then(() => {
          a.pause();
          a.muted = was;
        })
        .catch(() => (a.muted = was));
    },
    { capture: true },
  );
  /** Seconde de l'instru qui correspond à un tick de la partition (tempo d'origine du morceau). */
  const instruTime = (tick: number) => (songAudio ? songAudio.offset + (tick / 960) * (60 / (source.kind === 'library' ? source.song.tempo : 120)) : 0);
  const syncInstru = (tick: number, playing: boolean) => {
    if (!instru) return;
    instru.playbackRate = Math.max(0.5, Math.min(2, api.playbackSpeed || 1));
    if (!playing) {
      if (!instru.paused) instru.pause();
      return;
    }
    const want = instruTime(tick);
    if (Math.abs(instru.currentTime - want) > 0.25) instru.currentTime = Math.max(0, want);
    if (instru.paused)
      void instru.play().catch(() => {
        // Lecture refusée par le navigateur : on revient à l'accompagnement synthétique pour avoir du son.
        if (!instruBlocked) {
          instruBlocked = true;
          applyBacking();
          $('status').textContent = '🔇 Le navigateur bloque l’instru : accompagnement généré à la place. Touche l’écran puis relance la lecture pour l’instru originale.';
        }
      });
    else if (instruBlocked) {
      instruBlocked = false;
      applyBacking();
    }
  };
  api.playerPositionChanged.on((e) => syncInstru(e.currentTick, api.playerState === 1));
  const rapVoiceOn = () => mode === 'live' || (mode === 'game' && gameRunning && prefs.guide);
  if (rapVoice) {
    api.playerPositionChanged.on((e) => rapVoice.update(e.currentTick, api.playerState === 1 && rapVoiceOn(), api.playbackSpeed));
    api.playerStateChanged.on((e) => e.state !== 1 && rapVoice.stop());
    const sel = document.getElementById('rapVoiceSel') as HTMLSelectElement | null;
    const fill = () => {
      if (!sel) return;
      const vs = voicesFor(spoken!.lang);
      sel.hidden = !vs.length;
      sel.innerHTML = vs.map((v) => `<option value="${esc(v.name)}" ${v.name === rapVoice.voiceName ? 'selected' : ''}>🗣 ${esc(v.name.replace(/^(Microsoft|Google)\s*/, '').replace(/\s*\(.*\)$/, '').slice(0, 28))}</option>`).join('');
      if (!rapVoice.voiceName && vs[0]) rapVoice.voiceName = vs[0].name;
    };
    fill();
    speechSynthesis.addEventListener('voiceschanged', fill);
    sel?.addEventListener('change', () => {
      rapVoice.voiceName = prefs.rapVoice = sel.value;
      savePrefs();
    });
  }
  api.playerStateChanged.on((e) => syncInstru(api.tickPosition, e.state === 1));

  /** Rap avec voix parlée : la piste « Voix » (notes ooh) se tait. */
  const muteRapMelody = () => {
    if (rapVoice && api.score?.tracks[0]) api.changeTrackMute([api.score.tracks[0]], true);
  };
  const applyBacking = () => {
    muteRapMelody();
    const t = backingTracks();
    if (instru && !instruBlocked) {
      // Avec l'instru originale, l'accompagnement synthétique se tait.
      instru.muted = !prefs.backing;
      if (t.length) api.changeTrackMute(t, true);
      return;
    }
    if (!t.length) return;
    // Plus fort quand rien d'autre ne joue (rap, ou jeu sans guide) : c'est la musique qu'on accompagne.
    api.changeTrackVolume(t, rapVoice || (mode === 'game' && !prefs.guide) ? 0.6 : BACKING_VOLUME);
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
  let trainer: StepTrainer | null = null;
  let trace: PitchTrace | null = null;
  function setBpm(bpm: number, save = true) {
    const v2 = Math.round(Math.max(30, Math.min(240, bpm || originalBpm)));
    bpmInput.value = String(v2);
    bpmRange.value = String(v2);
    api.playbackSpeed = v2 / originalBpm;
    applyHold();
    if (save) {
      if (v2 === originalBpm) delete prefs.bpmBySong[songId];
      else prefs.bpmBySong[songId] = v2;
      savePrefs();
    }
  }
  api.scoreLoaded.on((score) => {
    originalBpm = Math.round(score.tempo) || originalBpm;
    setBpm(prefs.bpmBySong[songId] ?? (inst.kind === 'voice' ? Math.min(originalBpm, 92) : originalBpm), false);
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
    if (inst.kind !== 'strings') return beat.notes.filter((n) => !n.isTieDestination || beat.notes.length === 1).map((n) => ({ midi: n.realValue, string: 0, fret: 0 }));
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
    if (source.kind !== 'library' || inst.kind !== 'strings') return;
    const beats = v.trackBeats.filter((b) => !b.isRest && b.notes.length && !b.notes.every((n) => n.isTieDestination));
    const midis = beats.map((b) => Math.max(...b.notes.map((n) => n.realValue)));
    try {
      placeMelody(midis, inst, { onlyString: source.song.string, position: source.song.position }).forEach((p, i) => placements.set(beats[i], p));
    } catch {
      /* note hors tessiture : on garde les doigts de la partition */
    }
  }
  api.scoreLoaded.on(() => setTimeout(computePlacements, 0));

  // ---------- Paroles (karaoké) ----------
  const lyrics = new LyricsStrip($('lyrics'));
  const lyricIndex = new Map<alphaTab.model.Beat, number>();
  function computeLyrics() {
    lyricIndex.clear();
    const text = source.kind === 'library' ? lyricsOf(source.song) : undefined;
    if (source.kind === 'library' && source.song.timedLyrics?.length) {
      // Paroles calées dans le temps : chaque note reçoit la syllabe qui se chante à son instant.
      const tl = source.song.timedLyrics;
      const spq = 60 / source.song.tempo;
      for (const b of v.trackBeats) {
        if (b.isRest || !b.notes.length || b.notes.every((n) => n.isTieDestination)) continue;
        const sec = (b.absolutePlaybackStart / 960) * spq;
        let k = -1;
        for (let i = 0; i < tl.length && tl[i].t <= sec + 0.2; i++) k = i;
        if (k >= 0) lyricIndex.set(b, k);
      }
      return lyrics.setLines(tl);
    }
    const hasMelody = v.trackBeats.some((b) => !b.isRest && b.notes.length);
    if (!hasMelody && source.kind === 'library')
      return lyrics.setMessage(
        '🎤 <strong>Instru seule</strong> : ce morceau n’a ni mélodie ni paroles (grille d’accords). Appuie sur ▶ Lecture et chante ou rappe librement. Pour le karaoké : ajoute les paroles et la mélodie dans le fichier d’import, ou utilise <strong>🎧 Transcrire</strong> avec ton mp3 pour avoir l’instru originale.',
      );
    if (!text) return lyrics.setSyllables([]);
    const syl = lyricSyllables(text);
    let k = 0;
    for (const b of v.trackBeats) if (!b.isRest && b.notes.length && !b.notes.every((n) => n.isTieDestination)) lyricIndex.set(b, k++);
    lyrics.setSyllables(syl);
  }
  api.scoreLoaded.on(() => setTimeout(computeLyrics, 0));
  // Karaoké calé dans le temps : syllabe en cours d'après la position de lecture.
  const timed = source.kind === 'library' ? source.song.timedLyrics : undefined;
  if (timed?.length) {
    const spq = 60 / (source.kind === 'library' ? source.song.tempo : 120);
    api.playerPositionChanged.on((e) => {
      const sec = (e.currentTick / 960) * spq;
      let k = -1;
      for (let i = 0; i < timed.length && timed[i].t <= sec + 0.05; i++) k = i;
      lyrics.setIndex(k);
    });
  }
  // Voix : échelle verticale fixe = tessiture du morceau.
  api.scoreLoaded.on(() =>
    setTimeout(() => {
      if (!trace) return;
      const ms = v.trackBeats.filter((b) => !b.isRest).flatMap((b) => b.notes.map((n) => n.realValue));
      if (ms.length) trace.setRange(Math.min(...ms), Math.max(...ms));
      trace.toleranceCents = rapFlow ? 150 : tolerance();
    }, 0),
  );

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
    if (inst.kind === 'wind') return recorderTip(f.midi) || 'doigté ci-dessus';
    if (inst.kind === 'voice') return 'chante la note (ou une octave plus bas)';
    const sName = `corde de ${inst.stringNamesFr[f.string - 1]}`;
    if (f.fret === 0) return `${sName}, à vide`;
    const finger = f.finger ?? suggestedFinger(f.fret, inst);
    const p = placements.get(beat);
    const variant = p ? fingerVariant(p, inst) : '';
    const doigt = finger ? `, doigt ${finger}${variant ? ` ${variant}` : ''}` : '';
    const pos = p ? ` · ${positionLabel(p.position, inst)}` : '';
    return inst.id === 'violin' ? `${sName}${doigt}${pos}` : `${sName}, case ${f.fret}${doigt}${pos}`;
  }

  const board: { show(c: BoardNote[], n?: BoardNote[], l?: BoardNote[]): void } =
    inst.kind === 'wind' ? new RecorderBoard($('neck')) : inst.kind === 'voice' ? (trace = new PitchTrace($('neck'), 'ta voix')) : new Fingerboard($('neck'), inst);
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
    if (mode !== 'step' && lyricIndex.has(beat) && !timed?.length) lyrics.setIndex(lyricIndex.get(beat)!);
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
    trace?.feed(r.freq ? freqToMidiFloat(r.freq, prefs.a4) : null, r.time);
    circleHeard(r.freq);
    const lvl = document.getElementById(mode === 'game' ? 'gLvl' : 'sLvl');
    const heard = document.getElementById(mode === 'game' ? 'gHeard' : 'sHeard');
    if (lvl) lvl.style.width = `${Math.round(r.level * 100)}%`;
    if (!heard) return;
    if (r.rawFreq > 0) {
      const m = freqToMidiFloat(r.rawFreq, prefs.a4);
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
    const m = new MicPitchDetector({ deviceId: prefs.micId });
    mic = m;
    try {
      let pitched = 0;
      let loud = 0;
      const t0 = performance.now();
      let warned = false;
      await m.start((r) => {
        if (r.level > 0.2) loud++;
        if (r.freq) pitched++;
        // Du son mais jamais de hauteur nette après 8 s : un filtre « voix » efface probablement l'instrument.
        if (!warned && pitched < 10 && loud > 60 && performance.now() - t0 > 8000) {
          warned = true;
          micHelp(noPitchHelp(m.info));
        }
        if (pitched === 10 && warned) micHelp(null);
        showMic(r);
        onReading(r);
      });
      pending = false;
      clearTimeout(slow);
      const info = m.info;
      micHelp(info.filtered.length ? noPitchHelp(info) : null);
      const heardEl = document.getElementById('sHeard');
      if (heardEl) heardEl.title = `Micro : ${info.label || 'par défaut'}`;
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
  let beatsByTarget: alphaTab.model.Beat[] = [];
  let keeper = new ScoreKeeper(0);
  let errorSince: number | null = null;
  let hadError = false;
  // Mesures fines (justesse, stabilité, placement) note par note, pour le coach violon.
  let noteLog: NoteLog[] = [];
  let holdCents: number[] = [];
  let targetSince = 0;
  const fingerInfo = (beat: alphaTab.model.Beat | undefined) => {
    const p = beat ? placements.get(beat) : undefined;
    return p ? { finger: p.finger, string: p.string } : {};
  };
  let stepAssisted = false;

  function setupTrainer() {
    const targets: StepTarget[] = [];
    beatsByTarget = [];
    v.trackBeats.forEach((beat, i) => {
      if (beat.isRest || beat.notes.length === 0 || !inSection(beat)) return;
      if (beat.notes.every((n) => n.isTieDestination)) return;
      // Durée écrite, liaisons comprises (en ticks : 960 par noire).
      let ticks = beat.playbackDuration;
      const all = v.trackBeats;
      for (let k = i + 1; k < all.length && all[k].notes.length && all[k].notes.every((n) => n.isTieDestination); k++) ticks += all[k].playbackDuration;
      targets.push({ midi: Math.max(...beat.notes.map((n) => n.realValue)), beatIndex: i, ticks } as StepTarget & { ticks: number });
      beatsByTarget.push(beat);
    });
    // Voix : pas d'exigence de détaché (le chant lié ne baisse pas forcément le volume entre deux syllabes).
    trainer = new StepTrainer(targets, { toleranceCents: tolerance(), a4: prefs.a4, detache: prefs.stepDetache && inst.kind !== 'voice' });
    applyHold();
    keeper = new ScoreKeeper(targets.length);
    noteLog = [];
    holdCents = [];
    hadError = false;
    errorSince = null;
    stepAssisted = false;
    updateStepHud();
    showTarget();
  }

  /** Tenue demandée : 70 % de la durée écrite au tempo choisi (min. 80 ms, max. 4 s). */
  function applyHold() {
    if (!trainer) return;
    const bpm = Number(bpmInput.value) || originalBpm;
    for (const t of trainer.targets as (StepTarget & { ticks?: number })[])
      t.holdMs = prefs.stepHold && t.ticks ? Math.min(4000, Math.max(80, ((t.ticks / 960) * 60000 * 0.7) / bpm)) : undefined;
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
    holdCents = [];
    targetSince = performance.now();
    const name = beatName(beat, t.midi);
    const octave = Math.floor(t.midi / 12) - 1;
    $('tNote').innerHTML = `${name}<small>${octave}</small>`;
    $('tPos').textContent = `${/♯/.test(name) ? 'dièse · ' : /♭/.test(name) ? 'bémol · ' : ''}${midiName(t.midi, 'en')} · ${stringLabel(beat)}`;
    v.focusBeat(beat);
    lyrics.setIndex(lyricIndex.get(beat) ?? -1);
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
        setVerdict(prefs.stepDetache ? `Détache : ${ATTACK[inst.id]} pour cette note` : 'Relâche puis rejoue la note', '');
        break;
      case 'too-low':
        setVerdict(`Trop bas (${heard}, ${Math.round(u.cents!)} cents)`, 'bad');
        break;
      case 'too-high':
        setVerdict(`Trop haut (${heard}, +${Math.round(u.cents!)} cents)`, 'bad');
        break;
      case 'holding':
        if (u.cents !== null) holdCents.push(u.cents);
        setVerdict(prefs.stepHold && u.hold !== undefined ? `Juste, tiens la note… ${'▮'.repeat(Math.round(u.hold * 8))}${'▯'.repeat(8 - Math.round(u.hold * 8))}` : 'Juste, tiens la note…', 'near');
        break;
      case 'validated': {
        if (u.cents !== null) holdCents.push(u.cents);
        const st = centsStats(holdCents);
        const tg = trainer?.targets[u.index];
        if (tg) noteLog.push({ midi: tg.midi, cents: st?.mean ?? null, spread: st?.spread, findMs: Math.round(performance.now() - targetSince), ...fingerInfo(beatsByTarget[u.index]) });
        holdCents = [];
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
    if (ok) setVerdict('À toi de jouer…', '');
    else setVerdict('Micro indisponible (voir le message ci-dessus)', 'bad');
  });
  $('hear').addEventListener('click', () => {
    const beat = trainer && beatsByTarget[trainer.index];
    if (beat) api.playBeat(beat);
  });
  const skip = () => {
    if (!trainer || trainer.finished) return;
    if (trainer.current) noteLog.push({ midi: trainer.current.midi, cents: null, miss: true });
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
  // Choix du micro (utile si le micro par défaut est un casque ou un micro virtuel qui filtre l'instrument).
  const micSel = $<HTMLSelectElement>('micSel');
  async function fillMics() {
    const devs = (await navigator.mediaDevices?.enumerateDevices().catch(() => [])) ?? [];
    const ins = devs.filter((d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications');
    micSel.innerHTML = '<option value="">Micro par défaut</option>' + ins.map((d, i) => `<option value="${esc(d.deviceId)}" ${d.deviceId === prefs.micId ? 'selected' : ''}>${esc(d.label || `Micro ${i + 1}`)}</option>`).join('');
  }
  void fillMics();
  navigator.mediaDevices?.addEventListener?.('devicechange', () => void fillMics());
  micSel.addEventListener('focus', () => void fillMics());
  micSel.addEventListener('change', () => {
    prefs.micId = micSel.value;
    savePrefs();
    if (mic) $('micBtn').click(); // arrête : le prochain ▶ utilisera le nouveau micro
  });
  $('a4').addEventListener('change', () => {
    const v = Number($<HTMLInputElement>('a4').value);
    prefs.a4 = v >= 415 && v <= 466 ? v : 440;
    $<HTMLInputElement>('a4').value = String(prefs.a4);
    savePrefs();
    if (trainer) trainer.options.a4 = prefs.a4;
  });
  app.querySelector('#chordsBtn')?.addEventListener('click', () => {
    if (source.kind !== 'library') return;
    const c = chartFromSong(source.song);
    if (c) dispatchEvent(new CustomEvent('open-chords', { detail: c }));
  });
  $('sfSel').addEventListener('change', () => {
    prefs.soundfont = $<HTMLSelectElement>('sfSel').value as 'musescore' | 'sonivox';
    savePrefs();
    // Nouvelle banque : on recharge le lecteur.
    location.reload();
  });
  $('micTest').addEventListener('click', () => {
    stopMic();
    openMicTest();
  });
  const tol = $<HTMLInputElement>('tol');
  tol.addEventListener('input', () => {
    if (inst.kind === 'voice') prefs.voiceTolerance = Number(tol.value);
    else prefs.tolerance = Number(tol.value);
    savePrefs();
    $('tolOut').textContent = `±${tolerance()} cents`;
    if (trainer) trainer.options.toleranceCents = tolerance();
    if (trace) trace.toleranceCents = rapFlow ? 150 : tolerance();
  });

  // ---------- Mode jeu ----------
  let highway: Highway | SingLane | null = null;
  let judge: GameJudge | SingJudge | null = null;
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
      if (inst.kind !== 'strings') {
        // Flûte, voix : une piste par nom de note (Do à Si) ; la voix affiche la syllabe à chanter.
        const lt = source.kind === 'library' ? lyricsOf(source.song) : undefined;
        const tl = source.kind === 'library' ? source.song.timedLyrics : undefined;
        const li = lyricIndex.get(beat);
        const syl = li === undefined ? undefined : lt ? lyricSyllables(lt)[li] : tl?.[li]?.s;
        notes.push({
          tick: beat.absolutePlaybackStart,
          duration: beat.playbackDuration,
          midi: f.midi,
          lane: [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][f.midi % 12],
          label: inst.kind === 'voice' && syl ? syl.replace(/[-,.;:!?]+$/, '') : beatName(beat, f.midi).replace(/♯|♭/, ''),
          name: f.name ?? beatName(beat, f.midi),
        });
        continue;
      }
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
    if (inst.kind === 'voice') {
      // Voix : piste de chant (barres à tenir + paroles), marge de timing avant / après chaque note.
      judge = new SingJudge(notes, { latencyMs: prefs.latencyMs, toleranceCents: tolerance() });
      const lane = new SingLane($<HTMLCanvasElement>('highway'), notes);
      lane.toleranceCents = rapFlow ? 50 : tolerance();
      highway = lane;
      highway.sync(notes[0] ? notes[0].tick - 960 * 2 : 0, ticksPerMs, false);
      gameKeeper = new ScoreKeeper(notes.length);
      updateGameHud();
      return;
    }
    judge = new GameJudge(notes, { latencyMs: prefs.latencyMs, toleranceCents: Math.max(40, prefs.tolerance + 10) });
    const lanes = inst.kind === 'strings' ? [...inst.stringNamesFr].reverse() : ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
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
    noteLog = [];
    judge.opts.latencyMs = prefs.latencyMs;
    updateGameHud();
    const ok = await startMic((r) => {
      if (!gameRunning || !judge || !highway) return;
      const heard = r.freq ? freqToMidiFloat(r.freq, prefs.a4) : null;
      if (highway instanceof SingLane) highway.heard = heard;
      for (const ev of judge.update(heard, highway.tick, highway.speed, r.rms)) {
        const lane = ev.note.lane;
        noteLog.push(
          ev.judgment === 'miss'
            ? { midi: ev.note.midi, cents: null, miss: true }
            : {
                midi: ev.note.midi,
                cents: heard !== null ? Math.round(centsToNearestOctave((heard - ev.note.midi) * 100)) : null,
                deltaMs: Math.round(ev.deltaMs),
                ...(inst.id === 'violin' ? { string: inst.tuning.length - lane, finger: Number.parseInt(ev.note.label, 10) || 0 } : {}),
              },
        );
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
    applyBacking();
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
    applyBacking();
    rapVoice?.stop();
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
    // Coach violon : chaque passage nourrit le niveau par domaine et le diagnostic.
    const playedAt = Number(bpmInput.value);
    const result = { songId, mode: m, accuracy, stars, bpm: playedAt, log: noteLog };
    if (inst.id === 'violin' && source.kind === 'library' && !songId.startsWith('assess-') && !assisted) {
      const sm = summarize(noteLog);
      logAttempt({ id: songId, t: Date.now(), bpm: playedAt, acc: accuracy, stars, mode: m, m: { intonation: sm.intonation, bias: sm.bias, stability: sm.stability, timing: sm.timing, rush: sm.rush, find: sm.find, byFinger: sm.byFinger, byString: sm.byString } });
    }
    const hook = playHook();
    if (hook && (await hook(result))) return;
    const outcome = recordResult(
      progress,
      {
        songId: section ? `${songId}${sectionKey()}` : songId,
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
      const streak = progress.songs[section ? `${songId}${sectionKey()}` : songId]?.cleanStreak ?? 0;
      if (streak > 0) tempoNote = `Passages propres : ${streak} / 3 avant de monter le tempo`;
    }
    // Exercice : validé avec 3 étoiles au tempo cible ou plus vite.
    const ex = source.kind === 'library' ? (source.song as Partial<Exercise>) : null;
    if (ex?.targetBpm && /^(ex|tx|vn)-/.test(songId) && !section) {
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
  const circle = new NoteCircle($('circleBox'), true);
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
    const pc = freq ? ((Math.round(freqToMidiFloat(freq, prefs.a4)) % 12) + 12) % 12 : null;
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
  $('stepHold').addEventListener('click', () => {
    prefs.stepHold = !prefs.stepHold;
    savePrefs();
    $('stepHold').setAttribute('aria-pressed', String(prefs.stepHold));
    applyHold();
  });
  $('stepDetache').addEventListener('click', () => {
    prefs.stepDetache = !prefs.stepDetache;
    savePrefs();
    $('stepDetache').setAttribute('aria-pressed', String(prefs.stepDetache));
    if (trainer) trainer.options.detache = prefs.stepDetache;
  });
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
      case 'line':
        loopBars(...lineOf(cursorBar()));
        voiceMsg('🔁 Ligne en boucle', true);
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
  // Les commandes vocales ouvrent le micro : Windows baisse alors le son des autres applications
  // (« atténuation des communications »). Elles ne se relancent donc plus toutes seules : un clic sur 🗣 Voix.
  if (prefs.voice) {
    prefs.voice = false;
    savePrefs();
  }

  setSuggestedTempo(() => Number(bpmInput.value) || null);
  cleanup = () => {
    rapVoice?.stop();
    instru?.pause();
    if (instruUrl) URL.revokeObjectURL(instruUrl);
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
function noPitchHelp(info: { label: string; filtered: string[] }): string {
  const f = info.filtered.length ? ` Filtres actifs : <strong>${info.filtered.join(', ')}</strong>.` : '';
  return `🎻 Le micro <strong>${info.label || 'par défaut'}</strong> capte du son mais aucune note nette.${f} Un filtre « voix » efface sans doute l'instrument :
    <br>• Mac : Centre de contrôle › <strong>Mode micro › Standard</strong> (pas « Isolement de la voix »).
    <br>• Windows : Paramètres › Son › micro › désactive <strong>Effets audio / Effets de studio / Voice Focus</strong>.
    <br>• Casque Bluetooth / AirPods : utilise plutôt le micro de l'ordinateur.
    <br>• Coupe 🗣 Voix pour tester. Puis ⚙ › <strong>🎤 Test micro</strong>.`;
}

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
