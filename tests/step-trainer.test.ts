import { describe, expect, it } from 'vitest';
import { StepTrainer } from '../src/practice/step-trainer';
import { midiToFreq } from '../src/songs/notation';

const cents = (midi: number, c: number) => midiToFreq(midi + c / 100);

describe('StepTrainer', () => {
  it('valide une note juste tenue assez longtemps', () => {
    const t = new StepTrainer([{ midi: 69, beatIndex: 0 }, { midi: 71, beatIndex: 1 }]);
    expect(t.update(440, 0).verdict).toBe('holding');
    expect(t.update(440, 50).verdict).toBe('holding');
    expect(t.update(440, 90).verdict).toBe('validated');
    expect(t.index).toBe(1);
  });

  it('signale trop bas / trop haut et remet à zéro la tenue', () => {
    const t = new StepTrainer([{ midi: 69, beatIndex: 0 }]);
    expect(t.update(cents(69, -60), 0).verdict).toBe('too-low');
    expect(t.update(cents(69, 60), 10).verdict).toBe('too-high');
    expect(t.update(cents(69, 10), 20).verdict).toBe('holding');
    expect(t.update(cents(69, 80), 70).verdict).toBe('too-high');
    expect(t.update(cents(69, 0), 120).verdict).toBe('holding');
  });

  it('exige un relâchement entre deux notes identiques', () => {
    const t = new StepTrainer([{ midi: 69, beatIndex: 0 }, { midi: 69, beatIndex: 1 }]);
    t.update(440, 0);
    expect(t.update(440, 100).verdict).toBe('validated');
    expect(t.update(440, 300).verdict).toBe('listening');
    t.update(null, 310);
    t.update(null, 380);
    expect(t.update(440, 400).verdict).toBe('holding');
    expect(t.update(440, 500).verdict).toBe('validated');
    expect(t.finished).toBe(true);
    expect(t.update(440, 600).verdict).toBe('finished');
  });

  it('passer et revenir', () => {
    const t = new StepTrainer([{ midi: 60, beatIndex: 0 }, { midi: 62, beatIndex: 1 }]);
    t.skip();
    expect(t.current?.midi).toBe(62);
    t.back();
    expect(t.current?.midi).toBe(60);
  });
});

describe('tolérance d’octave', () => {
  it('accepte la bonne note détectée une octave plus haut ou plus bas', () => {
    const t = new StepTrainer([{ midi: 69, beatIndex: 0 }]);
    t.update(880, 0);
    expect(t.update(880, 100).verdict).toBe('validated');
    const strict = new StepTrainer([{ midi: 69, beatIndex: 0 }], { anyOctave: false });
    expect(strict.update(880, 0).verdict).toBe('too-high');
  });
});

describe('nouvelle attaque par baisse de volume', () => {
  it('deux notes identiques liées par un changement d’archet', () => {
    const t = new StepTrainer([{ midi: 69, beatIndex: 0 }, { midi: 69, beatIndex: 1 }]);
    t.update(440, 0, 0.2);
    expect(t.update(440, 100, 0.2).verdict).toBe('validated');
    expect(t.update(440, 150, 0.2).verdict).toBe('listening');
    t.update(440, 170, 0.08); // creux du changement d'archet, sans silence
    t.update(440, 200, 0.2);
    expect(t.update(440, 300, 0.2).verdict).toBe('validated');
  });
});
