import * as alphaTab from '@coderline/alphatab';

export type ViewMode = 'score-tab' | 'score' | 'tab';

const PROFILE: Record<ViewMode, alphaTab.StaveProfile> = {
  'score-tab': alphaTab.StaveProfile.ScoreTab,
  score: alphaTab.StaveProfile.Score,
  tab: alphaTab.StaveProfile.Tab,
};

/** Enveloppe autour d'alphaTab : rendu partition + tablature et lecture synchronisée. */
export class ScoreView {
  readonly api: alphaTab.AlphaTabApi;
  private beats: alphaTab.model.Beat[] = [];

  constructor(container: HTMLElement, scrollElement: HTMLElement) {
    this.api = new alphaTab.AlphaTabApi(container, {
      core: { logLevel: 'warning', fontDirectory: `${import.meta.env.BASE_URL}font/` },
      display: { staveProfile: alphaTab.StaveProfile.ScoreTab, scale: 1.1 },
      player: {
        playerMode: alphaTab.PlayerMode.EnabledSynthesizer,
        soundFont: `${import.meta.env.BASE_URL}soundfont/string-coach.sf3`,
        enableCursor: true,
        enableAnimatedBeatCursor: true,
        enableElementHighlighting: true,
        enableUserInteraction: true,
        scrollElement,
        scrollOffsetY: -40,
      },
    });
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) (window as unknown as { __at: unknown }).__at = this.api;
    this.api.scoreLoaded.on((score) => {
      this.beats = [];
      const staff = score.tracks[0]?.staves[0];
      if (!staff) return;
      for (const bar of staff.bars) for (const beat of bar.voices[0].beats) this.beats.push(beat);
    });
  }

  /** Charge un morceau alphaTex ; seules les pistes indiquées sont affichées (toutes sont jouées). */
  loadTex(tex: string, tracks: number[] | 'all' = 'all'): void {
    this.api.tex(tex, tracks);
  }

  loadFile(data: ArrayBuffer): boolean {
    return this.api.load(new Uint8Array(data));
  }

  /** Beats de la première voix de la piste affichée, dans l'ordre. */
  get trackBeats(): alphaTab.model.Beat[] {
    return this.beats;
  }

  selectTrack(index: number): void {
    const score = this.api.score;
    if (!score || !score.tracks[index]) return;
    const track = score.tracks[index];
    this.beats = [];
    for (const bar of track.staves[0].bars) for (const beat of bar.voices[0].beats) this.beats.push(beat);
    this.api.renderTracks([track]);
  }

  setViewMode(mode: ViewMode): void {
    this.api.settings.display.staveProfile = PROFILE[mode];
    this.api.updateSettings();
    this.api.render();
  }

  setZoom(scale: number): void {
    this.api.settings.display.scale = scale;
    this.api.updateSettings();
    this.api.render();
  }

  /** Place le curseur sur un beat (mode pas à pas). */
  focusBeat(beat: alphaTab.model.Beat): void {
    this.api.tickPosition = beat.absolutePlaybackStart;
    this.api.highlightPlaybackRange(beat, beat);
    this.api.scrollToCursor();
  }

  destroy(): void {
    this.api.destroy();
  }
}
