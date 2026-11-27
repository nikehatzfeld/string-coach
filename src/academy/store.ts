import { progress, persist } from '../game/store';
import { emptyAcademy, recordAttempt, type AcademyState, type Attempt } from './coach';
import { findExercise } from './curriculum';

/** État du parcours violon du profil actif (rangé dans sa progression, donc synchronisé). */
export function academy(): AcademyState {
  if (!progress.academy) progress.academy = emptyAcademy();
  return progress.academy;
}

export function saveAcademy(): void {
  persist();
}

/** Enregistre un passage (exercice du parcours ou morceau de violon). */
export function logAttempt(a: Attempt): void {
  // Versions 1re / 3e position : comptées pour le morceau d'origine.
  a = { ...a, id: a.id.replace(/~pos\d$/, '') };
  const ex = findExercise(a.id);
  recordAttempt(academy(), a, ex);
  saveAcademy();
}

/** Ajoute ou retire un morceau de la liste « je travaille ce morceau ». */
export function togglePiece(id: string): boolean {
  const st = academy();
  const has = st.pieces.includes(id);
  st.pieces = has ? st.pieces.filter((p) => p !== id) : [id, ...st.pieces].slice(0, 12);
  st.updatedAt = Date.now();
  saveAcademy();
  return !has;
}
