import { describe, expect, it } from 'vitest';
import { normalizeKana } from '../src/core/kana';
import { WORDS } from '../src/data/words';

describe('語彙データ', () => {
  it('十分な数がある', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(2300);
  });

  it.each(WORDS.map((w) => [w.reading, w] as const))('%s', (_reading, w) => {
    expect(w.reading).toMatch(/^[ぁ-んー]+$/);
    const answer = normalizeKana(w.reading);
    expect(answer.length).toBeGreaterThanOrEqual(2);
    expect(answer.length).toBeLessThanOrEqual(8);
    expect(w.clue).toBeTruthy();
    expect(w.clue).not.toContain(w.reading);
    if (w.kanji) expect(w.clue).not.toContain(w.kanji);
    expect(w.example.split('〇〇').length).toBe(2);
    expect(w.example).not.toContain(w.reading);
    if (w.kanji) expect(w.example).not.toContain(w.kanji);
  });

  it('盤面に入る形が重複しない', () => {
    const seen = new Set<string>();
    for (const w of WORDS) {
      const a = normalizeKana(w.reading);
      expect(seen.has(a), a).toBe(false);
      seen.add(a);
    }
  });
});
