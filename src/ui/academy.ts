import { DOMAINS, STAGES, VIOLIN_PATH, byStage, type Domain, type VExercise } from '../academy/curriculum';
import { currentStage, diagnose, globalLevel, levelOf, pathPosition, planSession, stageStatus, suggestedBpm, type SessionItem } from '../academy/coach';
import { EXPERIENCE, nextProbe, placementSkills, placementStage, probeExercise, totalProbes, PASS, type Placement } from '../academy/assessment';
import { academy, saveAcademy } from '../academy/store';
import { setPlayHook, type PlayResult } from '../academy/hook';
import { LIBRARY, songFor } from '../songs/library';
import { progress } from '../game/store';
import { prefs, savePrefs } from '../state/prefs';
import { activeProfile, addProfile, profiles, removeProfile, switchProfile, updateProfile } from '../state/profiles';
import { esc, on } from './dom';
import { toast } from './results';
import type { OpenFn } from './home';

/**
 * Parcours violon : tableau de bord personnel (niveau par domaine, diagnostic, position dans le parcours),
 * séance du jour adaptée, carte des 12 paliers, évaluation de départ et profils de la famille.
 */
type View = { kind: 'dash' } | { kind: 'stage'; n: number } | { kind: 'assess-intro' } | { kind: 'assess-done'; placement: Placement } | { kind: 'profiles' };
let view: View = { kind: 'dash' };

const dom = (d: Domain) => DOMAINS.find((x) => x.id === d)!;
const validated = () => progress.validated ?? {};

export function renderAcademy(app: HTMLElement, open: OpenFn, back: () => void, v: View = view): void {
  view = v;
  setPlayHook(null);
  const rerender = (nv: View = view) => renderAcademy(app, open, back, nv);
  const p = activeProfile();
  const head = (title: string, onBack: () => void) => {
    app.innerHTML = `
    <header class="top">
      <button id="aBack" class="ghost" aria-label="Retour">←</button>
      <div class="ptitle"><h1>${title}</h1></div>
      <button id="aProfile" class="chip" title="Changer de profil">${esc(p.emoji)} ${esc(p.name)} ▾</button>
    </header>
    <main class="home academy" id="aMain"></main>`;
    app.querySelector('#aBack')!.addEventListener('click', onBack);
    app.querySelector('#aProfile')!.addEventListener('click', () => rerender({ kind: 'profiles' }));
    return app.querySelector<HTMLElement>('#aMain')!;
  };

  if (v.kind === 'profiles') return renderProfiles(head('👪 Profils', () => rerender({ kind: 'dash' })), rerender);
  if (v.kind === 'assess-intro') return renderAssessIntro(head('🧭 Évaluation', () => rerender({ kind: 'dash' })), open, rerender);
  if (v.kind === 'assess-done') return renderAssessDone(head('🧭 Résultats', () => rerender({ kind: 'dash' })), v.placement, rerender);
  if (v.kind === 'stage') return renderStage(head(`Palier ${v.n} · ${STAGES[v.n - 1].name}`, () => rerender({ kind: 'dash' })), v.n, open);

  const main = head('🎻 Mon parcours violon', back);
  const st = academy();
  const val = validated();
  const fresh = !st.placed && st.attempts.length === 0;
  const lvl = globalLevel(st);
  const pos = pathPosition(val, st);
  const plan = planSession(val, st);
  const diag = diagnose(st);
  const cs = currentStage(val, st);

  main.innerHTML = `
    ${
      fresh
        ? `<section class="acad-hero">
        <h2>Bienvenue ${esc(p.name)} 👋</h2>
        <p class="hint">Une courte évaluation (≈ 7 min, 10 à 12 mini-tests au micro) place ton niveau dans chaque domaine : justesse, archet, doigts, gammes, rythme, positions. Le parcours et le tempo s'adaptent ensuite à chaque séance.</p>
        <div class="row"><button id="aAssess" class="primary big">🧭 Faire l'évaluation</button><button id="aSkip" class="ghost">Commencer au palier 1</button></div>
      </section>`
        : `<section class="acad-level">
        <div class="lvl-big"><span class="lvl-n">${lvl.stage}</span><span>Palier<br><strong>${esc(lvl.label)}</strong></span></div>
        <div class="lvl-info">
          <div>Palier en cours : <strong>${cs} · ${esc(STAGES[cs - 1].name)}</strong></div>
          <div class="muted">Exercice clé n° ${pos.rank} sur ${pos.total} · ${pos.done} validés${st.placed ? ` · paliers 1 à ${st.placed - 1} acquis à l'évaluation` : ''}</div>
          <div class="session-bar"><div style="width:${(pos.rank / pos.total) * 100}%"></div></div>
        </div>
      </section>`
    }
    <section>
      <h2>📅 Séance du jour <span class="muted">${plan.reduce((a, x) => a + x.minutes, 0)} min</span>
        <select id="aMin" aria-label="Durée">${[15, 20, 30, 45].map((m) => `<option ${st.minutes === m ? 'selected' : ''}>${m}</option>`).join('')}</select> <span class="muted">min</span></h2>
      <ol class="acad-plan">${plan.map((it, i) => planRow(it, i)).join('')}</ol>
      <button id="aRun" class="primary">▶ Lancer la séance</button>
    </section>
    <section>
      <h2>📊 Mes niveaux</h2>
      <div class="acad-skills">${DOMAINS.map((d) => skillBar(d.id, st.skill[d.id])).join('')}</div>
    </section>
    ${
      diag.strengths.length || diag.weaknesses.length
        ? `<section class="acad-diag">
      <div><h3>💪 Points forts</h3><ul>${diag.strengths.map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="muted">Encore quelques séances pour les repérer</li>'}</ul></div>
      <div><h3>🛠 À travailler</h3><ul>${diag.weaknesses.map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="muted">Rien de marquant pour l’instant</li>'}</ul></div>
      ${diag.tips.length ? `<div class="tips"><h3>💡 Conseils</h3><ul>${diag.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    </section>`
        : ''
    }
    <section>
      <h2>🗺 Le parcours <span class="muted">${VIOLIN_PATH.length} exercices · 12 paliers</span></h2>
      <div class="acad-map">${STAGES.map((s) => stageRow(s.n, cs)).join('')}</div>
    </section>
    <section>
      <h2>🎵 Mes morceaux</h2>
      ${piecesBlock(lvl.stage)}
    </section>
    <p class="row"><button id="aReassess" class="ghost">🧭 Refaire l'évaluation</button></p>`;

  const runItem = (it: SessionItem, list?: SessionItem[], idx = 0) => startExercise(it.ex, it.bpm, it.mode, open, list, idx);
  main.querySelector('#aAssess')?.addEventListener('click', () => rerender({ kind: 'assess-intro' }));
  main.querySelector('#aReassess')?.addEventListener('click', () => rerender({ kind: 'assess-intro' }));
  main.querySelector('#aSkip')?.addEventListener('click', () => {
    st.placed = 1;
    st.placedAt = new Date().toISOString().slice(0, 10);
    st.updatedAt = Date.now();
    saveAcademy();
    rerender();
  });
  main.querySelector<HTMLSelectElement>('#aMin')!.addEventListener('change', (e) => {
    st.minutes = Number((e.target as HTMLSelectElement).value) as 20;
    saveAcademy();
    rerender();
  });
  main.querySelector('#aRun')!.addEventListener('click', () => plan[0] && runItem(plan[0], plan, 0));
  on(main, '[data-plan]', 'click', (b) => runItem(plan[Number(b.dataset.plan)]));
  on(main, '[data-stage]', 'click', (b) => rerender({ kind: 'stage', n: Number(b.dataset.stage) }));
  on(main, '[data-piece]', 'click', (b) => {
    const s = LIBRARY.find((x) => x.id === b.dataset.piece);
    if (s) open({ kind: 'library', song: s }, 'live');
  });
}

function planRow(it: SessionItem, i: number): string {
  const d = dom(it.ex.domain);
  return `<li><button class="acad-item" data-plan="${i}">
    <span class="ai-icon">${d.icon}</span>
    <span class="ai-body"><strong>${esc(it.ex.title)}</strong><span class="muted">${esc(it.why)} · palier ${it.ex.stage} · ${it.mode === 'step' ? '🎯 pas à pas' : '🎮 jeu'} · ♩ ${it.bpm}</span></span>
  </button></li>`;
}

function skillBar(d: Domain, v: number): string {
  const x = dom(d);
  return `<div class="skill"><span class="sk-name">${x.icon} ${esc(x.label)}</span><span class="sk-bar"><span style="width:${(Math.min(12, v) / 12) * 100}%"></span></span><span class="sk-val">${levelOf(v)}</span></div>`;
}

function stageRow(n: number, current: number): string {
  const ss = stageStatus(validated(), academy(), n);
  const state = ss.complete ? 'done' : n === current ? 'current' : n < current ? 'done' : 'locked';
  return `<button class="stage ${state}" data-stage="${n}">
    <span class="st-n">${ss.complete ? '✓' : n}</span>
    <span class="st-body"><strong>${esc(STAGES[n - 1].name)}</strong><span class="muted">${esc(STAGES[n - 1].level)} · clés ${ss.coreDone}/${ss.coreTotal} · ${ss.done}/${ss.total} validés${ss.placed ? ' · acquis' : ''}</span></span>
  </button>`;
}

/** Morceaux travaillés + suggestions au niveau (palier → niveau de morceau 1 à 5). */
function piecesBlock(stage: number): string {
  const st = academy();
  const maxLevel = Math.min(5, Math.max(1, Math.ceil(stage / 2.4)));
  const recs = progress.songs;
  const mine = st.pieces.map((id) => LIBRARY.find((s) => s.id === id)).filter(Boolean);
  const isPiece = (s: (typeof LIBRARY)[number]) => s.style !== 'Exercices' && songFor(s, 'violin');
  const suggest = LIBRARY.filter((s) => isPiece(s) && s.level <= maxLevel && s.level >= maxLevel - 1 && !st.pieces.includes(s.id) && (recs[s.id]?.stars ?? 0) < 3)
    .sort((a, b) => Number(!!b.famous) - Number(!!a.famous) || b.level - a.level)
    .slice(0, 6);
  const card = (s: (typeof LIBRARY)[number]) => `<button class="card" data-piece="${esc(s.id)}" style="--hue:${30 + s.level * 40}"><span class="style">${esc(s.style)}</span><strong>${esc(s.title)}</strong><span class="meta">${esc(s.composer)}</span><span class="card-foot"><span class="muted">${'★'.repeat(recs[s.id]?.stars ?? 0) || '—'}</span></span></button>`;
  return `${mine.length ? `<h3>En cours</h3><div class="grid">${mine.map((s) => card(s!)).join('')}</div>` : ''}
    <h3>Conseillés à ton niveau</h3><div class="grid">${suggest.map(card).join('') || '<p class="muted">Aucun pour l’instant.</p>'}</div>`;
}

/** Lance un exercice (ou une séance entière : chaque fin d'exercice enchaîne le suivant). */
function startExercise(ex: VExercise, bpm: number, mode: 'step' | 'game', open: OpenFn, list?: SessionItem[], idx = 0): void {
  prefs.bpmBySong[ex.id] = bpm;
  savePrefs();
  if (list && idx + 1 < list.length) {
    setPlayHook((r: PlayResult) => {
      const next = list[idx + 1];
      toast(`${r.accuracy >= 0.9 ? '✅' : r.accuracy >= 0.75 ? '👍' : '🔁'} ${Math.round(r.accuracy * 100)} % · suivant : ${esc(next.ex.title)} (${idx + 2}/${list.length})`);
      setTimeout(() => startExercise(next.ex, suggestedBpm(next.ex, academy()), next.mode, open, list, idx + 1), 1200);
      return true;
    });
  } else setPlayHook(null);
  open({ kind: 'library', song: ex }, mode);
}

function renderStage(main: HTMLElement, n: number, open: OpenFn): void {
  const val = validated();
  const st = academy();
  const list = byStage(n);
  main.innerHTML = `<p class="hint">${esc(STAGES[n - 1].level)} · les exercices ⭐ sont les clés du palier (à valider pour passer au suivant). Validation : 3 étoiles au tempo cible.</p>
    ${DOMAINS.filter((d) => list.some((e) => e.domain === d.id))
      .map(
        (d) => `<h2>${d.icon} ${esc(d.label)} <span class="muted">${esc(d.what)}</span></h2>
      <div class="acad-list">${list
        .filter((e) => e.domain === d.id)
        .map(
          (e) => `<button class="acad-item ${val[e.id] ? 'ok' : ''}" data-ex="${e.id}"><span class="ai-icon">${val[e.id] ? '✅' : e.core ? '⭐' : '·'}</span>
          <span class="ai-body"><strong>${esc(e.title)}</strong><span class="muted">${esc(e.how)} · 🎯 ${e.targetBpm}${st.bestBpm[e.id] ? ` · record ${st.bestBpm[e.id]}` : ''}</span></span></button>`,
        )
        .join('')}</div>`,
      )
      .join('')}`;
  on(main, '[data-ex]', 'click', (b) => {
    const ex = list.find((e) => e.id === b.dataset.ex)!;
    startExercise(ex, suggestedBpm(ex, st), st.attempts.some((a) => a.id === ex.id && a.acc >= 0.8) ? 'game' : 'step', open);
  });
}

// ---------- Évaluation ----------
function renderAssessIntro(main: HTMLElement, open: OpenFn, rerender: (v?: View) => void): void {
  main.innerHTML = `<section class="acad-hero">
    <h2>Depuis combien de temps joues-tu du violon ?</h2>
    <p class="hint">Le test commence à ce niveau puis s'ajuste : plus difficile si tu réussis, plus facile sinon. Chaque mini-test dure 4 mesures, en mode jeu (justesse et rythme). Accorde-toi avant, et utilise des écouteurs si possible.</p>
    <div class="acad-list">${EXPERIENCE.map((x, i) => `<button class="acad-item" data-xp="${i}"><span class="ai-icon">${['🌱', '🌿', '🌳', '🎻', '🎼', '🏆'][i]}</span><span class="ai-body"><strong>${esc(x.label)}</strong></span></button>`).join('')}</div>
  </section>`;
  on(main, '[data-xp]', 'click', (b) => runAssessment({ guess: EXPERIENCE[Number(b.dataset.xp)].stage, results: [] }, open, rerender));
}

function runAssessment(pl: Placement, open: OpenFn, rerender: (v?: View) => void): void {
  const nx = nextProbe(pl);
  if (!nx) {
    finishAssessment(pl);
    rerender({ kind: 'assess-done', placement: pl });
    return;
  }
  const ex = probeExercise(nx.domain, nx.stage);
  if (!ex) {
    pl.results.push({ domain: nx.domain, stage: nx.stage, acc: 0, pass: false });
    return runAssessment(pl, open, rerender);
  }
  const n = pl.results.length + 1;
  const probe = { ...ex, title: `Test ${n}/${totalProbes(pl)} · ${dom(nx.domain).label} · ${ex.title}` };
  prefs.bpmBySong[probe.id] = probe.tempo;
  savePrefs();
  setPlayHook((r) => {
    const pass = r.accuracy >= PASS;
    pl.results.push({ domain: nx.domain, stage: nx.stage, acc: r.accuracy, pass });
    toast(`${pass ? '✅ Réussi' : '➖ Pas encore'} (${Math.round(r.accuracy * 100)} %)`);
    setTimeout(() => runAssessment(pl, open, rerender), 900);
    return true;
  });
  open({ kind: 'library', song: probe }, 'game');
}

function finishAssessment(pl: Placement): void {
  const st = academy();
  st.skill = placementSkills(pl);
  st.placed = placementStage(st.skill);
  st.placedAt = new Date().toISOString().slice(0, 10);
  st.updatedAt = Date.now();
  saveAcademy();
}

function renderAssessDone(main: HTMLElement, pl: Placement, rerender: (v?: View) => void): void {
  const st = academy();
  main.innerHTML = `<section class="acad-hero">
    <h2>Ton niveau : palier ${st.placed} · ${esc(STAGES[(st.placed ?? 1) - 1].level)}</h2>
    <p class="hint">Les paliers 1 à ${(st.placed ?? 1) - 1 || 0} sont considérés comme acquis ; tu peux toujours y revenir. Les domaines plus faibles reçoivent plus d'exercices dans tes séances.</p>
    <div class="acad-skills">${DOMAINS.map((d) => skillBar(d.id, st.skill[d.id])).join('')}</div>
    <h3>Détail des tests</h3>
    <ul>${pl.results.map((r) => `<li>${dom(r.domain).icon} ${esc(dom(r.domain).label)} · palier ${r.stage} : ${r.pass ? '✅' : '➖'} ${Math.round(r.acc * 100)} %</li>`).join('')}</ul>
    <button id="aGo" class="primary big">Voir ma séance du jour</button>
  </section>`;
  main.querySelector('#aGo')!.addEventListener('click', () => rerender({ kind: 'dash' }));
}

// ---------- Profils ----------
const EMOJIS = ['🎻', '👩', '👨', '👦', '👧', '🧒', '🦊', '🐼', '🦁', '🌟', '🎸', '🎵'];
function renderProfiles(main: HTMLElement, rerender: (v?: View) => void): void {
  const cur = activeProfile();
  main.innerHTML = `<p class="hint">Chaque profil a sa progression, son parcours et son tableau de bord. Les réglages (micro, son) sont communs à l'appareil ; avec un compte, tous les profils sont synchronisés.</p>
    <div class="acad-list">${profiles()
      .map(
        (p) => `<div class="acad-item ${p.id === cur.id ? 'ok' : ''}"><span class="ai-icon">${esc(p.emoji)}</span>
        <span class="ai-body"><strong>${esc(p.name)}</strong><span class="muted">${p.id === cur.id ? 'Profil actif' : ''}</span></span>
        ${p.id === cur.id ? '' : `<button data-use="${p.id}" class="primary">Utiliser</button>`}
        <button data-ren="${p.id}" class="ghost" title="Renommer">✏️</button>
        ${p.id === 'main' ? '' : `<button data-del="${p.id}" class="ghost" title="Supprimer">🗑</button>`}</div>`,
      )
      .join('')}</div>
    <h2>Ajouter un profil</h2>
    <div class="row"><input id="pName" type="text" placeholder="Prénom" maxlength="24" />
    <select id="pEmoji">${EMOJIS.map((e) => `<option>${e}</option>`).join('')}</select>
    <button id="pAdd" class="primary">Ajouter</button></div>`;
  on(main, '[data-use]', 'click', (b) => switchProfile(b.dataset.use!));
  on(main, '[data-ren]', 'click', (b) => {
    const p = profiles().find((x) => x.id === b.dataset.ren)!;
    const name = prompt('Nouveau nom', p.name);
    if (name?.trim()) updateProfile(p.id, { name: name.trim().slice(0, 24) });
    rerender({ kind: 'profiles' });
  });
  on(main, '[data-del]', 'click', (b) => {
    const p = profiles().find((x) => x.id === b.dataset.del)!;
    if (confirm(`Supprimer le profil « ${p.name} » et toute sa progression sur cet appareil ?`)) removeProfile(p.id);
    rerender({ kind: 'profiles' });
  });
  main.querySelector('#pAdd')!.addEventListener('click', () => {
    const name = main.querySelector<HTMLInputElement>('#pName')!.value;
    if (!name.trim()) return;
    const p = addProfile(name, main.querySelector<HTMLSelectElement>('#pEmoji')!.value);
    if (confirm(`Profil « ${p.name} » créé. L'utiliser maintenant ?`)) switchProfile(p.id);
    else rerender({ kind: 'profiles' });
  });
}

/** Vue courante à la réouverture (après un exercice, on revient là où on était). */
export function resetAcademyView(): void {
  view = { kind: 'dash' };
}
