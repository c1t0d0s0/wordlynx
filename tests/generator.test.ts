import { describe, expect, it } from 'vitest';
import { STAGE_COUNT, generate, generateDaily, generateStage, stageId, stageMonth, stageSpec } from '../src/core/generator';
import { addDays, entryCells, solutionGrid, type Puzzle } from '../src/core/puzzle';
import { EASY_WORDS, WORDS } from '../src/data/words';

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
});

describe('毎月のステージ', () => {
  // 2026 年 10 月から 2 年分
  const months = Array.from({ length: 24 }, (_, i) => {
    const m = 9 + i;
    return `${2026 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
  });

  it('月は日本時間の日付から決まり、id に入る', () => {
    expect(stageMonth('2026-10-31')).toBe('2026-10');
    expect(stageId('2026-11', 3, 'standard')).toBe('stage-2026-11-3');
    expect(stageId('2026-11', 10, 'easy')).toBe('easy-stage-2026-11-10');
    expect([1, 8, 9, 10].map((n) => stageSpec(n, 'easy').size)).toEqual([10, 10, 20, 20]);
  });

  it.each(months.flatMap((month) => (['easy', 'standard'] as const).map((mode) => [month, mode] as const)))(
    '%s %s: 10 個とも正しい盤面で、決めた語数がそろい、同じ言葉は出ない',
    (month, mode) => {
      const words = mode === 'easy' ? EASY_WORDS : WORDS;
      const allowed = new Set(words.map((w) => w.reading));
      const seen = new Set<string>();
      for (let n = 1; n <= STAGE_COUNT; n++) {
        const s = generateStage(words, month, n, mode);
        const label = `${month} ${mode} ${n}`;
        expect(s.id, label).toBe(stageId(month, n, mode));
        expect(s.size, label).toBe(stageSpec(n, mode).size);
        // タイトル画面は盤面を作らずに stageSpec の語数を出すので、ちょうど同じでないといけない
        expect(s.entries.length, label).toBe(stageSpec(n, mode).words);
        assertValid(s);
        for (const e of s.entries) {
          expect(allowed.has(e.word.reading), `${label} ${e.word.reading}`).toBe(true);
          expect(seen.has(e.word.reading), `${label} ${e.word.reading}`).toBe(false);
          seen.add(e.word.reading);
        }
      }
    },
    60_000,
  );

  it('同じ月ならいつも同じ盤面、月がちがうと別の盤面', () => {
    const a = generateStage(WORDS, '2026-10', 1, 'standard');
    // 覚えておいた盤面ではなく、作り直しても同じになるか (語彙の配列を別にすると作り直す)
    expect(JSON.stringify(generateStage([...WORDS], '2026-10', 1, 'standard'))).toBe(JSON.stringify(a));
    const b = generateStage(WORDS, '2026-11', 1, 'standard');
    expect(b.entries.map((e) => e.answer)).not.toEqual(a.entries.map((e) => e.answer));
    const easy = generateStage(EASY_WORDS, '2026-10', 1, 'easy');
    expect(easy.entries.map((e) => e.answer)).not.toEqual(a.entries.map((e) => e.answer));
  });
});
