import { BADGES, currentStreak, dailyMinutes, dueReviews, levelInfo, levelTitle } from '../game/progress';
import { persist, progress, todayChallenge } from '../game/store';
import { INSTRUMENTS, type InstrumentId } from '../songs/instruments';
import { LIBRARY, STYLES } from '../songs/library';
import type { Song } from '../songs/alphatex';
import { prefs, savePrefs } from '../state/prefs';
import { fetchEntry, loadVault, lock, prepareAddition, unlock, type VaultState } from '../vault/vault-client';
import { WrongPasswordError } from '../vault/crypto';
import { deleteImport, listImports, saveImport } from './imports-store';
import { download, esc, LEVEL_LABEL, on, ring, starsHtml, STYLE_LOOK } from './dom';
import type { Source } from './player';
import { toast } from './results';

const UPLOAD_URL = 'https://github.com/nikehatzfeld/string-coach/upload/main/public/vault';

interface Filters {
  style: string | null;
  level: number | null;
  search: string;
  /** Seulement les morceaux complets. */
  full: boolean;
}
const filters: Filters = { style: null, level: null, search: '', full: false };

export type OpenFn = (s: Source, mode?: 'live' | 'step' | 'game') => void;

export async function renderHome(app: HTMLElement, open: OpenFn, onCourse: () => void = () => {}): Promise<void> {
  const [imports, vault] = await Promise.all([listImports(), loadVault()]);
  const lvl = levelInfo(progress.xp);
  const streak = currentStreak(progress);
  const minutes = dailyMinutes(progress);
  const goal = progress.daily.goal;
  const challenge = todayChallenge();
  const chSong = challenge ? LIBRARY.find((s) => s.id === challenge.songId) : undefined;
  const chDone = challenge && progress.challengeDoneDay === challenge.day;
  const recent = Object.entries(progress.songs)
    .sort((a, b) => b[1].lastPlayed - a[1].lastPlayed)
    .map(([id]) => LIBRARY.find((s) => s.id === id))
    .filter((s): s is Song => !!s)
    .slice(0, 4);

  const reviews = dueReviews(progress)
    .map((id) => LIBRARY.find((s) => s.id === id))
    .filter((s): s is Song => !!s)
    .slice(0, 8);
  const songs = LIBRARY.filter(
    (s) =>
      (!filters.style || s.style === filters.style) &&
      (!filters.level || s.level === filters.level) &&
      (!filters.full || !!s.source) &&
      (!filters.search || `${s.title} ${s.composer}`.toLowerCase().includes(filters.search.toLowerCase())),
  );
  const earned = BADGES.filter((b) => progress.badges[b.id]).length;

  app.innerHTML = `
    <header class="top home-top">
      <div class="brand"><span class="logo">🎻</span><h1>String Coach</h1></div>
      <button id="toCourse" class="primary">🎓 Cours</button>
      <div class="seg" role="group" aria-label="Instrument">
        ${(['violin', 'guitar'] as InstrumentId[]).map((id) => `<button data-inst="${id}" aria-pressed="${prefs.instrument === id}">${id === 'violin' ? '🎻' : '🎸'} ${INSTRUMENTS[id].label}</button>`).join('')}
      </div>
    </header>
    <main class="home">
      <section class="dash">
        <div class="tile level-tile">
          ${ring(lvl.into / lvl.needed, String(lvl.level), 'lvl')}
          <div><span class="tile-label">Niveau ${lvl.level}</span><strong>${levelTitle(lvl.level)}</strong>
          <span class="tile-sub">${lvl.into} / ${lvl.needed} XP</span></div>
        </div>
        <div class="tile streak-tile ${streak ? 'hot' : ''}">
          <span class="flame">${streak ? '🔥' : '🌱'}</span>
          <div><span class="tile-label">Série</span><strong>${streak} jour${streak > 1 ? 's' : ''}</strong>
          <span class="tile-sub">Record ${progress.streak.best}</span></div>
        </div>
        <div class="tile goal-tile">
          ${ring(minutes / goal, `${minutes}′`, minutes >= goal ? 'done' : 'goal')}
          <div><span class="tile-label">Objectif du jour</span><strong>${minutes >= goal ? 'Atteint ✔' : `${goal - minutes} min restantes`}</strong>
          <span class="tile-sub goal-edit"><button data-goal="-5" aria-label="Réduire l’objectif">−</button> ${goal} min <button data-goal="5" aria-label="Augmenter l’objectif">+</button></span></div>
        </div>
        ${
          chSong
            ? `<button class="tile challenge-tile ${chDone ? 'done' : ''}" data-challenge="${chSong.id}">
            <span class="tile-label">🎯 Défi du jour ${chDone ? '· réussi' : '· +100 XP'}</span>
            <strong>${esc(chSong.title)}</strong>
            <span class="tile-sub">${chDone ? 'Reviens demain pour un nouveau défi' : `Obtiens ${'★'.repeat(challenge!.stars)} en pas à pas ou en jeu`}</span>
          </button>`
            : ''
        }
      </section>

      <section class="badges-strip" aria-label="Badges">
        <h2>Badges <span class="muted">${earned} / ${BADGES.length}</span></h2>
        <div class="badges">
          ${BADGES.map((b) => `<span class="badge ${progress.badges[b.id] ? 'on' : ''}" title="${esc(b.name)} : ${esc(b.description)}" tabindex="0"><span class="bicon">${b.icon}</span><span class="bname">${esc(b.name)}</span></span>`).join('')}
        </div>
      </section>

      ${reviews.length ? `<section><h2>🔁 À réviser aujourd'hui <span class="muted">révisions espacées : J+1, J+3, J+7, J+14, puis tous les mois</span></h2><div class="grid">${reviews.map((s) => songCard(s)).join('')}</div></section>` : ''}
      ${recent.length ? `<section><h2>Reprendre</h2><div class="grid">${recent.map((s) => songCard(s)).join('')}</div></section>` : ''}

      <section>
        <h2>Bibliothèque</h2>
        <div class="filters">
          <input id="search" type="search" placeholder="🔎 Rechercher un morceau" value="${esc(filters.search)}" />
        </div>
        <div class="filters chips">
          <button class="chip" data-style="" aria-pressed="${!filters.style}">Tous</button>
          ${STYLES.map((s) => `<button class="chip" data-style="${esc(s)}" aria-pressed="${filters.style === s}">${STYLE_LOOK[s]?.icon ?? ''} ${esc(s)}</button>`).join('')}
        </div>
        <div class="filters chips levels">
          ${[0, 1, 2, 3].map((l) => `<button class="chip" data-level="${l}" aria-pressed="${(filters.level ?? 0) === l}">${l ? LEVEL_LABEL[l] : 'Tous niveaux'}</button>`).join('')}
          <button class="chip" data-full aria-pressed="${filters.full}">📜 Morceaux complets</button>
          <span class="count">${songs.length} morceau${songs.length > 1 ? 'x' : ''}</span>
        </div>
        <div class="grid">${songs.map((s) => songCard(s)).join('')}</div>
      </section>

      <section id="vault" class="vault">${vaultHtml(vault)}</section>

      <section>
        <h2>📁 Mes fichiers <span class="muted">sur cet appareil</span></h2>
        <p class="hint">Guitar Pro (.gp, .gp5, .gpx), MusicXML (.xml, .musicxml, .mxl) ou alphaTex. Ils restent sur cet appareil.</p>
        <label class="drop" tabindex="0">
          <input id="file" type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx,.xml,.musicxml,.mxl,.tex,.txt" multiple hidden />
          Glisser des fichiers ici ou choisir…
        </label>
        <div class="grid">
          ${imports
            .map(
              (i) => `<div class="card imported" style="--hue:${STYLE_LOOK.Import.hue}">
              <button class="open" data-import="${esc(i.id)}"><span class="cicon">📁</span><strong>${esc(i.name)}</strong><span class="meta">Importé</span></button>
              <button class="del" data-del="${esc(i.id)}" aria-label="Supprimer ${esc(i.name)}">✕</button></div>`,
            )
            .join('')}
        </div>
      </section>
    </main>`;

  const rerender = () => renderHome(app, open, onCourse);
  app.querySelector('#toCourse')!.addEventListener('click', onCourse);

  on(app, '[data-inst]', 'click', (b) => {
    prefs.instrument = b.dataset.inst as InstrumentId;
    savePrefs();
    rerender();
  });
  on(app, '[data-goal]', 'click', (b) => {
    progress.daily.goal = Math.max(5, Math.min(120, progress.daily.goal + Number(b.dataset.goal)));
    persist();
    rerender();
  });
  on(app, '[data-style]', 'click', (b) => {
    filters.style = b.dataset.style || null;
    rerender();
  });
  on(app, '[data-full]', 'click', () => {
    filters.full = !filters.full;
    rerender();
  });
  on(app, '[data-level]', 'click', (b) => {
    filters.level = Number(b.dataset.level) || null;
    rerender();
  });
  const searchEl = app.querySelector<HTMLInputElement>('#search')!;
  searchEl.addEventListener('change', () => {
    filters.search = searchEl.value;
    rerender();
  });
  on(app, '[data-song]', 'click', (b) => {
    const song = LIBRARY.find((s) => s.id === b.dataset.song)!;
    open({ kind: 'library', song });
  });
  on(app, '[data-challenge]', 'click', (b) => {
    const song = LIBRARY.find((s) => s.id === b.dataset.challenge)!;
    open({ kind: 'library', song }, 'step');
  });
  on(app, '[data-import]', 'click', (b) => {
    const imp = imports.find((i) => i.id === b.dataset.import)!;
    open({ kind: 'file', id: imp.id, name: imp.name, data: imp.data, origin: 'import' });
  });
  on(app, '[data-del]', 'click', async (b) => {
    await deleteImport(b.dataset.del!);
    rerender();
  });

  // Import local
  const fileEl = app.querySelector<HTMLInputElement>('#file')!;
  const drop = app.querySelector<HTMLLabelElement>('.drop')!;
  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    let last = null;
    for (const f of files) last = await saveImport(f);
    if (files.length === 1 && last) open({ kind: 'file', id: last.id, name: last.name, data: last.data, origin: 'import' });
    else rerender();
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

  bindVault(app, vault, open, rerender);
}

function songCard(s: Song): string {
  const rec = progress.songs[s.id];
  const look = STYLE_LOOK[s.style] ?? { icon: '🎵', hue: 220 };
  return `<button class="card" data-song="${s.id}" style="--hue:${look.hue}">
    <span class="cicon">${look.icon}</span>
    <span class="style">${esc(s.style)}</span>
    <strong>${esc(s.title)}</strong>
    <span class="meta">${esc(s.composer)}</span>
    ${s.source ? '<span class="full-badge">Complet</span>' : ''}
    <span class="card-foot"><span class="lvl l${s.level}">${LEVEL_LABEL[s.level]}</span>${rec ? starsHtml(rec.stars) : '<span class="new">Nouveau</span>'}</span>
  </button>`;
}

// ---------- Coffre ----------
function vaultHtml(v: VaultState): string {
  const head = `<h2>🔒 Mon coffre <span class="muted">chansons protégées, chiffrées</span></h2>`;
  const addTool = (label: string) => `
    <details class="vault-add">
      <summary>${label}</summary>
      <p class="hint">Choisis tes fichiers (Guitar Pro, MusicXML). Ils sont chiffrés ici, dans ton navigateur : rien n'est envoyé. Tu télécharges ensuite les fichiers chiffrés et tu les déposes sur GitHub, dans <code>public/vault/</code>.</p>
      ${v.status === 'empty' ? `<input id="vNew1" type="password" placeholder="Nouveau mot de passe (12 caractères min.)" autocomplete="new-password" />
      <input id="vNew2" type="password" placeholder="Confirme le mot de passe" autocomplete="new-password" />` : ''}
      <input id="vFiles" type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx,.xml,.musicxml,.mxl" multiple />
      <button id="vPrepare" class="primary">Chiffrer et télécharger</button>
      <p id="vAddMsg" class="hint"></p>
    </details>`;
  switch (v.status) {
    case 'empty':
      return `${head}<p class="hint">Ton coffre est vide. Ajoute tes chansons achetées (Songsterr, MuseScore…) : elles seront publiées chiffrées, illisibles sans ton mot de passe. <a href="https://github.com/nikehatzfeld/string-coach/blob/main/docs/pop-a-importer.md" target="_blank" rel="noopener">Idées de chansons</a></p>${addTool('➕ Créer le coffre')}`;
    case 'error':
      return `${head}<p class="hint">${esc(v.message)}</p>`;
    case 'locked':
      return `${head}
        <form id="vUnlock" class="vault-unlock">
          <input id="vPass" type="password" placeholder="Mot de passe du coffre" autocomplete="current-password" required />
          <label class="check"><input id="vRemember" type="checkbox" /> Rester déverrouillé sur cet appareil</label>
          <button class="primary" type="submit">🔓 Déverrouiller</button>
          <span id="vMsg" class="hint"></span>
        </form>`;
    case 'unlocked':
      return `${head}
        <div class="vault-bar"><span class="muted">${v.entries.length} chanson${v.entries.length > 1 ? 's' : ''}</span><button id="vLock">🔒 Verrouiller</button></div>
        <div class="grid">${v.entries
          .map((e) => `<button class="card" data-vault="${e.id}" style="--hue:${STYLE_LOOK.Coffre.hue}"><span class="cicon">🔐</span><span class="style">Coffre</span><strong>${esc(e.name)}</strong>
          <span class="card-foot">${progress.songs[`vault:${e.id}`] ? starsHtml(progress.songs[`vault:${e.id}`].stars) : '<span class="new">Nouveau</span>'}</span></button>`)
          .join('')}</div>
        ${addTool('➕ Ajouter des chansons')}`;
  }
}

function bindVault(app: HTMLElement, v: VaultState, open: OpenFn, rerender: () => void): void {
  const form = app.querySelector<HTMLFormElement>('#vUnlock');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = app.querySelector<HTMLElement>('#vMsg')!;
    msg.textContent = 'Déverrouillage…';
    try {
      await unlock(app.querySelector<HTMLInputElement>('#vPass')!.value, app.querySelector<HTMLInputElement>('#vRemember')!.checked);
      rerender();
    } catch (err) {
      msg.textContent = err instanceof WrongPasswordError ? 'Mot de passe incorrect.' : 'Impossible d’ouvrir le coffre.';
    }
  });
  app.querySelector('#vLock')?.addEventListener('click', () => {
    lock();
    rerender();
  });
  if (v.status === 'unlocked') {
    on(app, '[data-vault]', 'click', async (b) => {
      const entry = v.entries.find((e) => e.id === b.dataset.vault)!;
      b.classList.add('loading');
      try {
        const data = await fetchEntry(entry);
        open({ kind: 'file', id: entry.id, name: entry.name, data, origin: 'vault' });
      } catch (err) {
        b.classList.remove('loading');
        toast(`Impossible d’ouvrir « ${esc(entry.name)} » : ${esc((err as Error).message)}`);
      }
    });
  }
  app.querySelector('#vPrepare')?.addEventListener('click', async () => {
    const msg = app.querySelector<HTMLElement>('#vAddMsg')!;
    const files = [...(app.querySelector<HTMLInputElement>('#vFiles')!.files ?? [])];
    if (!files.length) return void (msg.textContent = 'Choisis au moins un fichier.');
    let pw: string | undefined;
    if (v.status === 'empty') {
      pw = app.querySelector<HTMLInputElement>('#vNew1')!.value;
      if (pw.length < 12) return void (msg.textContent = 'Mot de passe trop court (12 caractères minimum).');
      if (pw !== app.querySelector<HTMLInputElement>('#vNew2')!.value) return void (msg.textContent = 'Les mots de passe ne correspondent pas.');
    }
    msg.textContent = 'Chiffrement…';
    try {
      const res = await prepareAddition(files, pw);
      for (const f of res.files) download(f.path, f.data);
      msg.innerHTML = `${res.files.length} fichier(s) téléchargé(s). Dépose-les tous sur <a href="${UPLOAD_URL}" target="_blank" rel="noopener">GitHub › public/vault</a> (remplace <code>vault.json</code>), puis valide. Ton coffre contiendra ${res.count} chanson(s) après la mise à jour du site (1 à 2 min).`;
    } catch (err) {
      msg.textContent = (err as Error).message;
    }
  });
}
