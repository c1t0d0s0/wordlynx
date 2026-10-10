import { describe, expect, it } from 'vitest';
import { generate, generateDaily } from '../src/core/generator';
import { addDays, entryCells, solutionGrid, type Puzzle } from '../src/core/puzzle';
import { EASY_WORDS, WORDS } from '../src/data/words';
import presets from '../src/data/presets.json';
import presetsEasy from '../src/data/presets-easy.json';

/** 2 文字以上つながるマスの列が、すべて置いた言葉と一致することを確かめる */
function assertValid(p: Puzzle): void {
  const grid = solutionGrid(p);
  const n = p.size;
  const answers = new Map(p.entries.map((e) => [`${e.dir}:${e.row}:${e.col}`, e.answer]));
  expect(new Set(p.entries.map((e) => e.answer)).size).toBe(p.entries.length);
  for (const e of p.entries) {
    expect(e.row).toBeGreaterThanOrEqual(0);
    expect(e.col).toBeGreaterThanOrEqual(0);
    expect(e.dir === 'across' ? e.col + e.answer.length : e.row + e.answer.length).toBeLessThanOrEqual(n);
  }
  let runs = 0;
  for (const dir of ['across', 'down'] as const) {
    for (let a = 0; a < n; a++) {
      let run = '';
      let start = 0;
      for (let b = 0; b <= n; b++) {
        const ch = b < n ? grid[dir === 'across' ? a * n + b : b * n + a] : null;
        if (ch !== null) {
          if (run === '') start = b;
          run += ch;
          continue;
        }
        if (run.length >= 2) {
          const key = dir === 'across' ? `across:${a}:${start}` : `down:${start}:${a}`;
          expect(answers.get(key), `${key} ${run}`).toBe(run);
          runs++;
        }
        run = '';
      }
    }
  }
  expect(runs).toBe(p.entries.length);
  // 番号は左上から順で、同じマスから始まる言葉は同じ番号
  const starts = p.entries.map((e) => [e.row * n + e.col, e.num] as const).sort((x, y) => x[0] - y[0]);
  for (let i = 1; i < starts.length; i++) {
    if (starts[i][0] === starts[i - 1][0]) expect(starts[i][1]).toBe(starts[i - 1][1]);
    else expect(starts[i][1]).toBe(starts[i - 1][1] + 1);
  }
  // 盤面全体がひとつながり
  const filled = grid.map((c) => c !== null);
  const seen = new Set<number>(entryCells(p.entries[0], n).slice(0, 1));
  const queue = [...seen];
  while (queue.length) {
    const c = queue.pop()!;
    const r = Math.floor(c / n);
    const col = c % n;
    for (const [nr, nc] of [[r - 1, col], [r + 1, col], [r, col - 1], [r, col + 1]]) {
      if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
      const idx = nr * n + nc;
      if (filled[idx] && !seen.has(idx)) {
        seen.add(idx);
        queue.push(idx);
      }
    }
  }
  expect(seen.size).toBe(filled.filter(Boolean).length);
}

describe('生成', () => {
  it('同じ日付なら同じ問題、ちがう日付ならちがう問題', () => {
    const a = generateDaily(WORDS, '2026-10-09');
    const b = generateDaily(WORDS, '2026-10-09');
    const c = generateDaily(WORDS, '2026-10-10');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it('例文は、その言葉の例文の中から 1 つがえらばれ、同じ日なら同じものになる', () => {
    const byReading = new Map(WORDS.map((w) => [w.reading, w]));
    const picked = new Map<string, Set<string>>();
    let date = '2026-01-01';
    for (let i = 0; i < 200; i++) {
      const p = generateDaily(WORDS, date);
      for (const e of p.entries) {
        const word = byReading.get(e.word.reading)!;
        expect(word.examples).toContain(e.word.example);
        expect('examples' in e.word).toBe(false); // 問題の中には、えらんだ 1 つだけを入れる
        if (!picked.has(word.reading)) picked.set(word.reading, new Set());
        picked.get(word.reading)!.add(e.word.example);
      }
      expect(JSON.stringify(generateDaily(WORDS, date))).toBe(JSON.stringify(p));
      date = addDays(date, 1);
    }
    // 何度も出た言葉では、ちがう例文が使われている
    const repeated = [...picked.values()].filter((set) => set.size > 1).length;
    expect(repeated).toBeGreaterThan(50);
  }, 120_000);

  it('1 年分のデイリーがすべて正しく作れる', () => {
    let date = '2026-01-01';
    for (let i = 0; i < 365; i++) {
      const p = generateDaily(WORDS, date);
      expect(p.size).toBe(10);
      expect(p.entries.length, date).toBeGreaterThanOrEqual(10);
      assertValid(p);
      date = addDays(date, 1);
    }
  }, 120_000);

  it('20×20 も作れる', () => {
    const p = generate(WORDS, { id: 't', seed: 'big', size: 20, targetWords: 45, attempts: 10 });
    expect(p.entries.length).toBeGreaterThanOrEqual(40);
    assertValid(p);
  });
});

describe('初級モード', () => {
  it('ふつうのモードとは別の問題になり、やさしい言葉だけが出る', () => {
    const easy = generateDaily(EASY_WORDS, '2026-10-09', 'easy');
    expect(easy.id).toBe('daily-easy-2026-10-09');
    expect(easy.id).not.toBe(generateDaily(WORDS, '2026-10-09').id);
    expect(JSON.stringify(easy)).toBe(JSON.stringify(generateDaily(EASY_WORDS, '2026-10-09', 'easy')));
    const allowed = new Set(EASY_WORDS.map((w) => w.reading));
    for (const e of easy.entries) expect(allowed.has(e.word.reading)).toBe(true);
  });

  it('1 年分のデイリーがすべて正しく作れる', () => {
    let date = '2026-01-01';
    for (let i = 0; i < 365; i++) {
      const p = generateDaily(EASY_WORDS, date, 'easy');
      expect(p.entries.length, date).toBeGreaterThanOrEqual(8);
      assertValid(p);
      date = addDays(date, 1);
    }
  }, 120_000);

  const stages = presetsEasy as Puzzle[];
  it('ステージは 10×10 が 8 個、20×20 が 2 個', () => {
    expect(stages.map((s) => s.size)).toEqual([10, 10, 10, 10, 10, 10, 10, 10, 20, 20]);
    expect(stages.map((s) => s.id)).toEqual(stages.map((_, i) => `easy-stage-${i + 1}`));
  });
  it.each(stages.map((s) => [s.id, s] as const))('%s は正しい盤面で、やさしい言葉だけ', (_id, s) => {
    assertValid(s);
    const allowed = new Set(EASY_WORDS.map((w) => w.reading));
    for (const e of s.entries) expect(allowed.has(e.word.reading)).toBe(true);
  });
});

describe('プリセット', () => {
  const stages = presets as Puzzle[];
  it('10×10 が 8 個、20×20 が 2 個', () => {
    expect(stages.map((s) => s.size)).toEqual([10, 10, 10, 10, 10, 10, 10, 10, 20, 20]);
    expect(stages.map((s) => s.id)).toEqual(stages.map((_, i) => `stage-${i + 1}`));
  });
  it.each(stages.map((s) => [s.id, s] as const))('%s は正しい盤面', (_id, s) => {
    assertValid(s);
  });
});
