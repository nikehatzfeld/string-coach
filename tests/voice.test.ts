import { describe, expect, it } from 'vitest';
import { parseVoice } from '../src/ui/voice';

describe('commandes vocales', () => {
  it.each([
    ['Joue', 'start'],
    ['démarre', 'start'],
    ['stop', 'stop'],
    ['arrête', 'stop'],
    ['suivant', 'next'],
    ['précédent', 'prev'],
    ['recommence', 'restart'],
    ['plus vite', 'faster'],
    ['moins vite', 'slower'],
    ['métronome', 'metronome'],
    ['en boucle', 'loop'],
    ['mode jeu', 'mode-game'],
    ['pas à pas', 'mode-step'],
    ['écoute la note', 'hear'],
  ])('« %s » → %s', (phrase, action) => {
    expect(parseVoice(phrase)?.action).toBe(action);
  });
  it('tempo et partie', () => {
    expect(parseVoice('tempo 90')).toMatchObject({ kind: 'bpm', value: 90 });
    expect(parseVoice('100 bpm')).toMatchObject({ kind: 'bpm', value: 100 });
    expect(parseVoice('partie deux')).toMatchObject({ kind: 'section', value: 2 });
    expect(parseVoice('bonjour')).toBeNull();
  });
});
