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
  const ex = findExercise(a.id);
  recordAttempt(academy(), a, ex);
  saveAcademy();
}
