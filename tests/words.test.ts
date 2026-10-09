import { describe, expect, it } from 'vitest';
import { normalizeKana } from '../src/core/kana';
import { EASY_WORDS, WORDS } from '../src/data/words';
import { KANJI_UP_TO_GRADE_3, kanjiBeyondGrade3 } from './kanji';

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

describe('初級モードの語彙', () => {
  it('十分な数がある', () => {
    expect(EASY_WORDS.length).toBeGreaterThanOrEqual(1300);
  });

  it('学年ごとの漢字表に抜けや重複がない', () => {
    expect(KANJI_UP_TO_GRADE_3.size).toBe(80 + 160 + 200);
  });

  it.each(EASY_WORDS.map((w) => [w.reading, w] as const))('%s', (_reading, w) => {
    // 小さい字や長音は、大きい字に直して入れるルールがむずかしいので使わない
    expect(w.reading).toMatch(/^[あ-ん]+$/);
    expect(normalizeKana(w.reading)).toBe(w.reading);
    expect(w.reading.length).toBeGreaterThanOrEqual(2);
    expect(w.reading.length).toBeLessThanOrEqual(6);
    // カギと例文に使う漢字は 3 年生までに習うものだけ
    expect(kanjiBeyondGrade3(w.clue + w.example)).toEqual([]);
    expect(w.clue).toBeTruthy();
    expect(w.clue).not.toContain(w.reading);
    expect(w.example.split('〇〇').length).toBe(2);
    expect(w.example).not.toContain(w.reading);
    if (w.kanji) {
      expect(w.clue).not.toContain(w.kanji);
      expect(w.example).not.toContain(w.kanji);
    }
  });

  it('読みが重複しない', () => {
    expect(new Set(EASY_WORDS.map((w) => w.reading)).size).toBe(EASY_WORDS.length);
  });
});
