import { describe, expect, it } from 'vitest';
import { addToVault, createVault, decryptBytes, exportKey, importKey, openVault, removeFromVault, unlockVault, WrongPasswordError } from '../src/vault/crypto';

const IT = 1000; // itérations réduites pour la vitesse des tests

describe('coffre chiffré', () => {
  it('chiffre, déverrouille et déchiffre', async () => {
    const { vault, key } = await createVault('un mot de passe solide', IT);
    const data = new TextEncoder().encode('contenu Guitar Pro factice');
    const res = await addToVault(vault, key, [], [{ fileName: 'Ma chanson.gp5', data }]);
    expect(res.entries).toHaveLength(1);
    expect(res.entries[0].name).toBe('Ma chanson');
    // Le nom n'apparaît pas en clair dans le fichier publié.
    expect(JSON.stringify(res.vault)).not.toContain('Ma chanson');
    expect(new TextDecoder().decode(res.blobs[0].data)).not.toContain('Guitar Pro');

    const { key: k2, entries } = await unlockVault(res.vault, 'un mot de passe solide');
    expect(entries.map((e) => e.name)).toEqual(['Ma chanson']);
    const plain = await decryptBytes(k2, res.blobs[0].data);
    expect(new TextDecoder().decode(plain)).toBe('contenu Guitar Pro factice');
  });

  it('refuse un mauvais mot de passe', async () => {
    const { vault } = await createVault('bon mot de passe', IT);
    await expect(unlockVault(vault, 'mauvais mot de passe')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('clé mémorisée et suppression', async () => {
    const { vault, key } = await createVault('bon mot de passe', IT);
    const a = await addToVault(vault, key, [], [
      { fileName: 'B.gp', data: new Uint8Array([1]) },
      { fileName: 'A.xml', data: new Uint8Array([2]) },
    ]);
    expect(a.entries.map((e) => e.name)).toEqual(['A', 'B']);
    const restored = await importKey(await exportKey(key));
    expect((await openVault(a.vault, restored)).length).toBe(2);
    const r = await removeFromVault(a.vault, key, a.entries, a.entries[0].id);
    expect((await openVault(r.vault, key)).map((e) => e.name)).toEqual(['B']);
  });
});
