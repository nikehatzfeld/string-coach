import type { Song } from '../songs/alphatex';
import { estimateTempo, notesToSong, transcribeSong, type TranscribeResult } from '../practice/transcribe';
import { deleteAudio, saveAudio } from '../state/audio-store';
import { alignLyrics, syllabifyLyrics } from '../practice/karaoke';
import { recognizeWords, wordsToText, wordsToTimedSyllables, type AsrLang, type Word } from '../practice/lyrics-asr';
import { deleteUserSong, saveUserSong, userSongs } from '../state/user-songs';
import { esc } from './dom';
import { prefs } from '../state/prefs';

/** Fenêtre de transcription : fichier audio/vidéo → partition personnelle (gardée sur l'appareil). */
export function openTranscriber(onOpen: (song: Song) => void, onChange: () => void): void {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  const list = () =>
    userSongs()
      .map((s) => `<li><button class="ghost" data-open="${esc(s.id)}">▶ ${esc(s.title)}</button> <span><button class="ghost" data-lyr="${esc(s.id)}" title="Ajouter ou modifier les paroles">✏️ Paroles</button><button class="ghost" data-del="${esc(s.id)}" aria-label="Supprimer">🗑</button></span></li>`)
      .join('');
  back.innerHTML = `
    <div class="modal tr-modal" role="dialog" aria-label="Transcrire un enregistrement">
      <h2>🎧 Transcrire un morceau</h2>
      <p class="hint">Charge un morceau que tu possèdes (mp3, m4a, wav, mp4…). L'app retire la voix pour en faire une <strong>instru</strong> et transcrit la <strong>mélodie chantée</strong> : tu chantes ensuite sur l'instru originale, avec la courbe et le score. Tout se passe dans ton navigateur et reste sur cet appareil.</p>
      <label class="tr-row">Morceau complet <input id="trFile" type="file" accept="audio/*,video/*" /></label>
      <details class="tr-adv"><summary>Meilleure qualité : j'ai déjà les pistes séparées (voix / instru)</summary>
        <p class="hint">Sépare d'abord le morceau avec un outil dédié (vocalremover.org, lalal.ai, Moises, ou Demucs sur ton PC), puis charge les deux pistes ici.</p>
        <label class="tr-row">Voix seule <input id="trVoice" type="file" accept="audio/*" /></label>
        <label class="tr-row">Instru seule <input id="trInstru" type="file" accept="audio/*" /></label>
      </details>
      <label class="tr-row">Titre <input id="trTitle" placeholder="Mon morceau" /></label>
      <label class="tr-row"><input id="trAsr" type="checkbox" checked /> Reconnaître les paroles automatiquement <select id="trLang"><option value="fr">français</option><option value="en">anglais</option><option value="auto">auto</option></select></label>
      <label class="tr-col">Paroles : reconnues automatiquement après l'analyse (à corriger si besoin), ou colle-les ici, une ligne par vers <textarea id="trLyrics" rows="5" placeholder="Les paroles apparaîtront ici…"></textarea></label>
      <label class="tr-row"><input id="trChords" type="checkbox" checked /> Ajouter les accords (accompagnement, guitare)</label>
      <div class="mic-meter big"><span class="lvl" id="trBar"></span></div>
      <p id="trMsg" class="muted">Les 4 premières minutes sont analysées. Le meilleur résultat : un instrument ou une voix bien en avant.</p>
      <div id="trResult" hidden>
        <label class="tr-row">Tempo détecté <input id="trBpm" type="number" min="40" max="220" /> BPM</label>
        <label class="tr-row">Mesure <select id="trTs"><option value="4,4">4/4</option><option value="3,4">3/4</option><option value="6,8">6/8</option><option value="2,4">2/4</option></select></label>
      </div>
      <div class="modal-actions"><button id="trGo" class="primary" disabled>Analyser</button><button id="trSave" hidden>💾 Enregistrer et ouvrir</button><button id="trClose" class="ghost">Fermer</button></div>
      <h3>Mes transcriptions</h3><ul id="trList" class="tr-list">${list() || '<li class="muted">aucune</li>'}</ul>
    </div>`;
  document.body.appendChild(back);
  const q = <T extends HTMLElement>(id: string) => back.querySelector<T>(`#${id}`)!;
  let res: TranscribeResult | null = null;
  let words: Word[] = [];
  let recognized = '';
  let asrError = '';
  const pick = (id: string) => q<HTMLInputElement>(id).files?.[0];
  const refresh = () => {
    const f = pick('trFile') ?? pick('trVoice');
    q<HTMLButtonElement>('trGo').disabled = !f;
    if (f && !q<HTMLInputElement>('trTitle').value) q<HTMLInputElement>('trTitle').value = f.name.replace(/\.[^.]+$/, '');
  };
  ['trFile', 'trVoice', 'trInstru'].forEach((id) => q(id).addEventListener('change', refresh));
  q('trGo').addEventListener('click', async () => {
    const files = { mix: pick('trFile'), voice: pick('trVoice'), instru: pick('trInstru') };
    if (!files.mix && !files.voice) return;
    q<HTMLButtonElement>('trGo').disabled = true;
    try {
      res = await transcribeSong(files, (p, msg) => {
        q('trBar').style.width = `${Math.round(p * 100)}%`;
        q('trMsg').textContent = msg;
      });
      if (!res.notes.length) throw new Error('aucune note');
      // Paroles : reconnues dans la voix si rien n'a été collé.
      if (q<HTMLInputElement>('trAsr').checked && !q<HTMLTextAreaElement>('trLyrics').value.trim()) {
        try {
          words = await recognizeWords(res.voice16k, q<HTMLSelectElement>('trLang').value as AsrLang, (p, msg) => {
            q('trBar').style.width = `${Math.round(p * 100)}%`;
            q('trMsg').textContent = msg;
          });
          recognized = wordsToText(words);
          q<HTMLTextAreaElement>('trLyrics').value = recognized;
        } catch (e) {
          words = [];
          asrError = (e as Error).message || String(e);
          console.error('Reconnaissance des paroles', e);
        }
      }
      q<HTMLInputElement>('trBpm').value = String(estimateTempo(res.notes));
      q('trResult').hidden = false;
      q('trSave').hidden = false;
      const instruMsg = res.instru
        ? res.computedInstru
          ? ' Instru créée en retirant la voix (il peut rester un peu de voix : pour mieux, utilise des pistes séparées).'
          : ' Instru chargée.'
        : res.mono
          ? ' Fichier mono : impossible de retirer la voix, pas d’instru.'
          : '';
      const lyrMsg = q<HTMLInputElement>('trAsr').checked ? (asrError ? ` Paroles non reconnues (${asrError}) : colle-les à la main.` : words.length ? ` ${words.length} mots de paroles reconnus (relis-les et corrige si besoin).` : ' Aucune parole reconnue.') : '';
      q('trMsg').textContent = `${res.notes.length} notes trouvées.${instruMsg}${lyrMsg} Vérifie le tempo (il peut être détecté au double ou à la moitié), puis enregistre.`;
    } catch (e) {
      const msg = String((e as Error).message || e);
      q('trMsg').textContent = /dynamically imported module|Importing a module script failed/i.test(msg)
        ? 'L’app a été mise à jour pendant que la page était ouverte : recharge la page (Ctrl+Maj+R) puis relance l’analyse.'
        : `Analyse impossible : ${msg}. Essaie un autre fichier (mp3, wav, m4a).`;
    } finally {
      q<HTMLButtonElement>('trGo').disabled = false;
    }
  });
  q('trSave').addEventListener('click', async () => {
    if (!res) return;
    const ts = q<HTMLSelectElement>('trTs').value.split(',').map(Number) as [number, number];
    const audioId = res.instru ? `audio-${Date.now()}` : undefined;
    const song = notesToSong(res.notes, q<HTMLInputElement>('trTitle').value || 'Ma transcription', Number(q<HTMLInputElement>('trBpm').value) || 90, ts, q<HTMLInputElement>('trChords').checked, audioId);
    if (!song.notation) return void (q('trMsg').textContent = 'Pas de mélodie exploitable.');
    // Une transcription sert d'abord à chanter ; elle reste aussi disponible pour l'instrument en cours.
    song.instruments = [...new Set(['voice' as const, prefs.instrument])];
    // Temps de la partition = temps de l'audio − instant de la 1re note.
    const offset = song.audio?.offset ?? (res.notes.length ? Math.min(...res.notes.map((n) => n.start)) : 0);
    song.voiceSegments = res.segments.map(([a, b]) => [Math.max(0, a - offset), b - offset] as [number, number]).filter(([, b]) => b > 0);
    const text = q<HTMLTextAreaElement>('trLyrics').value.trim();
    // Paroles reconnues et non modifiées : instant exact de chaque mot ; sinon calage sur les passages chantés.
    if (text && words.length && text === recognized.trim()) song.timedLyrics = wordsToTimedSyllables(words, offset);
    else if (text) song.timedLyrics = alignLyrics(syllabifyLyrics(text), song.voiceSegments);
    try {
      if (audioId && res.instru) await saveAudio(audioId, res.instru);
      saveUserSong(song);
    } catch {
      return void (q('trMsg').textContent = 'Stockage plein : supprime une ancienne transcription.');
    }
    back.remove();
    onOpen(song);
  });
  back.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === back || t.id === 'trClose') return void back.remove();
    const open = t.closest<HTMLElement>('[data-open]')?.dataset.open;
    const del = t.closest<HTMLElement>('[data-del]')?.dataset.del;
    const lyr = t.closest<HTMLElement>('[data-lyr]')?.dataset.lyr;
    if (lyr) {
      const s = userSongs().find((x) => x.id === lyr);
      if (!s) return;
      const box = document.createElement('div');
      box.className = 'tr-lyr-edit';
      box.innerHTML = `<p class="hint">Paroles de « ${esc(s.title)} » : colle-les telles quelles, une ligne par vers. Elles seront calées automatiquement sur la voix.</p><textarea rows="8">${esc((s.timedLyrics ?? []).map((x, i) => `${x.line && i ? '\n' : ''}${x.s.endsWith('-') ? x.s.slice(0, -1) : `${x.s} `}`).join('').trim())}</textarea><div class="modal-actions"><button class="primary" data-lyr-save>💾 Caler et enregistrer</button></div>`;
      t.closest('li')!.after(box);
      box.querySelector('[data-lyr-save]')!.addEventListener('click', () => {
        const text = box.querySelector('textarea')!.value.trim();
        const segs = s.voiceSegments?.length ? s.voiceSegments : [[0, (s.notation.split('|').length * s.timeSignature[0] * 60) / s.tempo] as [number, number]];
        s.timedLyrics = text ? alignLyrics(syllabifyLyrics(text), segs) : undefined;
        saveUserSong(s);
        box.innerHTML = `<p class="muted">✅ ${s.timedLyrics?.length ?? 0} syllabes calées.</p>`;
      });
      return;
    }
    if (open) {
      const s = userSongs().find((x) => x.id === open);
      back.remove();
      if (s) onOpen(s);
    }
    if (del) {
      const s = userSongs().find((x) => x.id === del);
      if (s?.audio) void deleteAudio(s.audio.id).catch(() => {});
      deleteUserSong(del);
      q('trList').innerHTML = list() || '<li class="muted">aucune</li>';
      onChange();
    }
  });
}
