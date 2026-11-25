import { describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });

describe('génération avec Grok', () => {
  it('importe, puis fait corriger les morceaux refusés', async () => {
    const { generateWithGrok, setGrokKey } = await import('../src/practice/grok');
    setGrokKey('xai-test');
    const answers = [
      '```json\n{"format":"string-coach-library","version":1,"songs":[{"title":"A","chords":"G | D"},{"title":"B","notation":"C4:4 | D4:4 E4:4 | F4:4 G4:4 A4:4 B4:4"}]}\n```',
      '{"songs":[{"title":"B","notation":"C4:1 | D4:1 | E4:1"}]}',
    ];
    const calls: unknown[] = [];
    vi.stubGlobal('fetch', async (url: string, init: { body: string; headers: Record<string, string> }) => {
      calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
      return { ok: true, json: async () => ({ choices: [{ message: { content: answers.shift() } }] }) };
    });
    const r = await generateWithGrok('2 morceaux', () => {});
    expect(r.songs.map((s) => s.title).sort()).toEqual(['A', 'B']);
    expect(r.errors).toEqual([]);
    expect(calls).toHaveLength(2);
    expect((calls[0] as { auth: string }).auth).toBe('Bearer xai-test');
    expect((calls[0] as { url: string }).url).toBe('https://api.x.ai/v1/chat/completions');
  });
});
