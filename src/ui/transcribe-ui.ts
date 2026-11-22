import type { Song } from '../songs/alphatex';
import { estimateTempo, notesToSong, transcribeFile, type TNote } from '../practice/transcribe';
import { deleteUserSong, saveUserSong, userSongs } from '../state/user-songs';
import { esc } from './dom';

/** Fenêtre de transcription : fichier audio/vidéo → partition personnelle (gardée sur l'appareil). */
export function openTranscriber(onOpen: (song: Song) => void, onChange: () => void): void {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  const list = () =>
    userSongs()
      .map((s) => `<li><button class="ghost" data-open="${esc(s.id)}">▶ ${esc(s.title)}</button> <button class="ghost" data-del="${esc(s.id)}" aria-label="Supprimer">🗑</button></li>`)
      .join('');
  back.innerHTML = `
    <div class="modal tr-modal" role="dialog" aria-label="Transcrire un enregistrement">
      <h2>🎧 Transcrire un enregistrement</h2>
      <p class="hint">Charge un fichier audio ou vidéo que tu possèdes (mp3, m4a, wav, mp4…). L'app en tire la mélodie et les accords. Tout se passe dans ton navigateur : le fichier et la partition restent sur cet appareil.</p>
      <input id="trFile" type="file" accept="audio/*,video/*" />
      <label class="tr-row">Titre <input id="trTitle" placeholder="Mon morceau" /></label>
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
  let notes: TNote[] | null = null;
  q('trFile').addEventListener('change', () => {
    const f = q<HTMLInputElement>('trFile').files?.[0];
    q<HTMLButtonElement>('trGo').disabled = !f;
    if (f && !q<HTMLInputElement>('trTitle').value) q<HTMLInputElement>('trTitle').value = f.name.replace(/\.[^.]+$/, '');
  });
  q('trGo').addEventListener('click', async () => {
    const f = q<HTMLInputElement>('trFile').files?.[0];
    if (!f) return;
    q<HTMLButtonElement>('trGo').disabled = true;
    try {
      notes = await transcribeFile(f, (p, msg) => {
        q('trBar').style.width = `${Math.round(p * 100)}%`;
        q('trMsg').textContent = msg;
      });
      if (!notes.length) throw new Error('aucune note');
      q<HTMLInputElement>('trBpm').value = String(estimateTempo(notes));
      q('trResult').hidden = false;
      q('trSave').hidden = false;
      q('trMsg').textContent = `${notes.length} notes trouvées. Vérifie le tempo (il peut être détecté au double ou à la moitié), puis enregistre.`;
    } catch (e) {
      q('trMsg').textContent = `Analyse impossible : ${(e as Error).message || e}. Essaie un autre fichier (mp3, wav, m4a).`;
    } finally {
      q<HTMLButtonElement>('trGo').disabled = false;
    }
  });
  q('trSave').addEventListener('click', () => {
    if (!notes) return;
    const ts = q<HTMLSelectElement>('trTs').value.split(',').map(Number) as [number, number];
    const song = notesToSong(notes, q<HTMLInputElement>('trTitle').value || 'Ma transcription', Number(q<HTMLInputElement>('trBpm').value) || 90, ts, q<HTMLInputElement>('trChords').checked);
    if (!song.notation) return void (q('trMsg').textContent = 'Pas de mélodie exploitable.');
    try {
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
    if (open) {
      const s = userSongs().find((x) => x.id === open);
      back.remove();
      if (s) onOpen(s);
    }
    if (del) {
      deleteUserSong(del);
      q('trList').innerHTML = list() || '<li class="muted">aucune</li>';
      onChange();
    }
  });
}
