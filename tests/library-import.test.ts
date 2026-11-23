import { describe, expect, it } from 'vitest';
import { importLibrary } from '../src/songs/library-import';

describe('import de bibliothèque', () => {
  it('morceau complet : mélodie, paroles, accords', () => {
    const r = importLibrary({
      format: 'string-coach-library',
      version: 1,
      songs: [
        { title: 'Frère Jacques', artist: 'Traditionnel', instruments: ['voice', 'violin'], style: 'Comptines', level: 1, tempo: 100, timeSignature: [4, 4],
          notation: 'D4:4@D E4:4 F#4:4 D4:4 | D4:4 E4:4 F#4:4 D4:4', lyrics: 'Frè- re Ja- cques, Frè- re Ja- cques' },
      ],
    });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.songs[0]).toMatchObject({ title: 'Frère Jacques', style: 'Comptines', instruments: ['voice', 'violin'] });
  });
  it('grille d’accords seule → accompagnement', () => {
    const r = importLibrary({ songs: [{ title: 'Grille', chords: 'G | D | Em C | C', tempo: 80, style: 'Années 90' }] });
    expect(r.errors).toEqual([]);
    expect(r.songs[0].notation).toBe('r:1@G | r:1@D | r:2@Em r:2@C | r:1@C');
  });
  it('erreurs détectées', () => {
    const r = importLibrary({ songs: [{ title: 'X', notation: 'C4:4 D4:4 | E4:4 | F4:4 G4:4 A4:4 B4:4' }, { title: 'Y', chords: 'G | Hm' }, { title: '' }] });
    expect(r.songs).toHaveLength(0);
    expect(r.errors).toHaveLength(3);
  });
});

describe('styles importés', () => {
  it('alias courants rangés dans le bon genre', async () => {
    const { normalizeStyle } = await import('../src/songs/library-import');
    expect(normalizeStyle('Hip-hop')).toBe('Rap US');
    expect(normalizeStyle('Rap FR')).toBe('Rap français');
    expect(normalizeStyle('rap français')).toBe('Rap français');
    expect(normalizeStyle('R&B')).toBe('R&B & soul');
    expect(normalizeStyle('Rock')).toBe('Pop & rock');
    expect(normalizeStyle('Années 90')).toBe('Années 90');
    expect(normalizeStyle('inconnu')).toBe('Mes morceaux');
  });
});
