import { normalizeKana } from './kana';
import type { Dir, Entry, Mode, Puzzle, Word } from './puzzle';
import { type Rng, hashString, rngFromString, shuffle } from './rng';

interface Placed {
  word: Word;
  answer: string;
  row: number;
  col: number;
  dir: Dir;
}

interface Board {
  size: number;
  cells: (string | null)[];
  hasAcross: boolean[];
  hasDown: boolean[];
  placed: Placed[];
  crossings: number;
}

function newBoard(size: number): Board {
  const n = size * size;
  return {
    size,
    cells: new Array(n).fill(null),
    hasAcross: new Array(n).fill(false),
    hasDown: new Array(n).fill(false),
    placed: [],
    crossings: 0,
  };
}

const at = (b: Board, r: number, c: number): string | null =>
  r < 0 || c < 0 || r >= b.size || c >= b.size ? null : b.cells[r * b.size + c];

/**
 * 置けるなら交差するマスの数を、置けないなら -1 を返す。
 * 2 文字以上つながるマスの列が、かならず置いた言葉そのものになるように調べる。
 */
function countCrossings(b: Board, answer: string, row: number, col: number, dir: Dir): number {
  const dr = dir === 'down' ? 1 : 0;
  const dc = dir === 'across' ? 1 : 0;
  const len = answer.length;
  const endR = row + dr * (len - 1);
  const endC = col + dc * (len - 1);
  if (row < 0 || col < 0 || endR >= b.size || endC >= b.size) return -1;
  if (at(b, row - dr, col - dc) !== null) return -1;
  if (at(b, endR + dr, endC + dc) !== null) return -1;

  let crossings = 0;
  for (let i = 0; i < len; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const idx = r * b.size + c;
    const existing = b.cells[idx];
    if (existing !== null) {
      if (existing !== answer[i]) return -1;
      if (dir === 'across' ? b.hasAcross[idx] : b.hasDown[idx]) return -1;
      crossings++;
    } else if (at(b, r - dc, c - dr) !== null || at(b, r + dc, c + dr) !== null) {
      return -1; // となりの言葉とくっついて、意図しない並びができてしまう
    }
  }
  return crossings;
}

function place(b: Board, p: Placed, crossings: number): void {
  const flags = p.dir === 'across' ? b.hasAcross : b.hasDown;
  for (let i = 0; i < p.answer.length; i++) {
    const idx =
      p.dir === 'across' ? p.row * b.size + p.col + i : (p.row + i) * b.size + p.col;
    b.cells[idx] = p.answer[i];
    flags[idx] = true;
  }
  b.placed.push(p);
  b.crossings += crossings;
}

function bestPlacement(b: Board, word: Word, answer: string, rng: Rng): [Placed, number] | null {
  const mid = (b.size - 1) / 2;
  let best: Placed | null = null;
  let bestCross = 0;
  let bestScore = -Infinity;
  for (let idx = 0; idx < b.cells.length; idx++) {
    const ch = b.cells[idx];
    if (ch === null) continue;
    const r = Math.floor(idx / b.size);
    const c = idx % b.size;
    for (let i = 0; i < answer.length; i++) {
      if (answer[i] !== ch) continue;
      for (const dir of ['across', 'down'] as const) {
        const row = dir === 'down' ? r - i : r;
        const col = dir === 'across' ? c - i : c;
        const crossings = countCrossings(b, answer, row, col, dir);
        if (crossings < 1) continue;
        const centerR = row + (dir === 'down' ? (answer.length - 1) / 2 : 0);
        const centerC = col + (dir === 'across' ? (answer.length - 1) / 2 : 0);
        const dist = Math.abs(centerR - mid) + Math.abs(centerC - mid);
        const score = crossings * 10 - dist + rng() * 3;
        if (score > bestScore) {
          bestScore = score;
          bestCross = crossings;
          best = { word, answer, row, col, dir };
        }
      }
    }
  }
  return best ? [best, bestCross] : null;
}

function attempt(pool: { word: Word; answer: string }[], size: number, target: number, rng: Rng): Board {
  const b = newBoard(size);
  const order = shuffle(pool, rng);
  const maxFirst = Math.min(size - 2, 8);
  const firstIdx = order.findIndex((w) => w.answer.length >= 5 && w.answer.length <= maxFirst);
  const first = order.splice(Math.max(firstIdx, 0), 1)[0];
  const mid = Math.floor(size / 2);
  place(
    b,
    {
      ...first,
      row: mid - 1 + Math.floor(rng() * 2),
      col: Math.floor((size - first.answer.length) / 2),
      dir: 'across',
    },
    0,
  );

  let remaining = order;
  for (let pass = 0; pass < 3 && b.placed.length < target; pass++) {
    const skipped: typeof remaining = [];
    for (const w of remaining) {
      if (b.placed.length >= target) break;
      const found = bestPlacement(b, w.word, w.answer, rng);
      if (found) place(b, found[0], found[1]);
      else skipped.push(w);
    }
    remaining = skipped;
  }
  return b;
}

/** 盤面を 4 つに分けたとき、いちばん字の少ない区画の字数。かたよりの少なさの目安 */
function balance(b: Board): number {
  const half = b.size / 2;
  const quads = [0, 0, 0, 0];
  b.cells.forEach((ch, idx) => {
    if (ch === null) return;
    const r = Math.floor(idx / b.size);
    const c = idx % b.size;
    quads[(r < half ? 0 : 2) + (c < half ? 0 : 1)]++;
  });
  return Math.min(...quads);
}

/**
 * 問題に入れる言葉。例文がいくつかあるときは、問題ごとに 1 つをえらぶ。
 * 盤面の形を決める乱数とは別に、「問題の種 + 言葉」だけで決めるので、例文を足しても盤面は変わらない。
 */
function wordFor(word: Word, seed: string): Word {
  const { examples, ...rest } = word;
  if (!examples || examples.length < 2) return rest;
  return { ...rest, example: examples[hashString(`${seed}:${word.reading}`) % examples.length] };
}

function toPuzzle(id: string, b: Board, seed: string): Puzzle {
  const starts = new Map<number, number>();
  const sorted = b.placed
    .slice()
    .sort((x, y) => x.row * b.size + x.col - (y.row * b.size + y.col) || (x.dir === 'across' ? -1 : 1));
  let next = 1;
  const entries: Entry[] = sorted.map((p) => {
    const idx = p.row * b.size + p.col;
    if (!starts.has(idx)) starts.set(idx, next++);
    return { num: starts.get(idx)!, dir: p.dir, row: p.row, col: p.col, answer: p.answer, word: wordFor(p.word, seed) };
  });
  return { id, size: b.size, entries };
}

export interface GenerateOptions {
  id: string;
  seed: string;
  size: number;
  targetWords: number;
  attempts?: number;
}

/** 同じ seed・同じ語彙なら、いつどこで実行しても同じ問題になる */
export function generate(words: readonly Word[], opts: GenerateOptions): Puzzle {
  const { id, seed, size, targetWords, attempts = 40 } = opts;
  const pool = words
    .map((word) => ({ word, answer: normalizeKana(word.reading) }))
    .filter((w) => w.answer.length >= 2 && w.answer.length <= size);
  let best: Board | null = null;
  let bestScore = -1;
  for (let i = 0; i < attempts; i++) {
    const b = attempt(pool, size, targetWords, rngFromString(`${seed}#${i}`));
    const score = b.placed.length * 1000 + balance(b) * 20 + b.crossings * 5;
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return toPuzzle(id, best!, seed);
}

export const DAILY_SIZE = 10;
export const DAILY_WORDS: Record<Mode, number> = { standard: 12, easy: 10 };

export function dailyId(date: string, mode: Mode): string {
  return mode === 'easy' ? `daily-easy-${date}` : `daily-${date}`;
}

/** words には、そのモードの語彙をわたす */
export function generateDaily(words: readonly Word[], date: string, mode: Mode = 'standard'): Puzzle {
  return generate(words, {
    id: dailyId(date, mode),
    seed: mode === 'easy' ? `wordlynx-daily-easy-${date}` : `wordlynx-daily-${date}`,
    size: DAILY_SIZE,
    targetWords: DAILY_WORDS[mode],
  });
}

// ---- ステージ (月ごとに作り直す) ----

/** ステージの数。1〜8 は 10×10、9・10 は 20×20 のチャレンジ */
export const STAGE_COUNT = 10;

/** ステージ n (1〜10) の大きさと語数 */
export function stageSpec(n: number, mode: Mode): { size: number; words: number; attempts: number } {
  if (n > 8) return { size: 20, words: mode === 'easy' ? 40 : 48, attempts: 300 };
  return { size: DAILY_SIZE, words: DAILY_WORDS[mode], attempts: 80 };
}

/** ステージは日本時間の月ごとに変わる。'2026-10' の形 */
export function stageMonth(today: string): string {
  return today.slice(0, 7);
}

export function stageId(month: string, n: number, mode: Mode): string {
  return mode === 'easy' ? `easy-stage-${month}-${n}` : `stage-${month}-${n}`;
}

/**
 * ステージ n で使う言葉の組。月ごとに語彙をまぜて、ステージどうしで重ならないように分ける
 * (1〜8 は 1/32 ずつ、9・10 は残りを半分ずつ)。組が別なので、開いたステージだけを作ればよい。
 */
function stagePool(words: readonly Word[], month: string, n: number, mode: Mode): Word[] {
  const mixed = shuffle(words, rngFromString(`wordlynx-stage-pool-${mode}-${month}`));
  const small = Math.floor(mixed.length / 32);
  const big = Math.floor((mixed.length - small * 8) / 2);
  return n <= 8 ? mixed.slice((n - 1) * small, n * small) : mixed.slice(small * 8 + (n - 9) * big, small * 8 + (n - 8) * big);
}

/** 作ったステージを、語彙ごとに覚えておく (タイトル画面にもどってまた開いても、作り直さない) */
const stageCache = new WeakMap<readonly Word[], Map<string, Puzzle>>();

/** その月のステージ n。words には、そのモードの語彙をわたす。同じ月・同じ語彙なら、いつも同じ盤面になる */
export function generateStage(words: readonly Word[], month: string, n: number, mode: Mode): Puzzle {
  const id = stageId(month, n, mode);
  let cache = stageCache.get(words);
  if (!cache) stageCache.set(words, (cache = new Map()));
  const cached = cache.get(id);
  if (cached) return cached;
  const spec = stageSpec(n, mode);
  const puzzle = generate(stagePool(words, month, n, mode), {
    id,
    seed: mode === 'easy' ? `wordlynx-easy-stage-${month}-${n}` : `wordlynx-stage-${month}-${n}`,
    size: spec.size,
    targetWords: spec.words,
    attempts: spec.attempts,
  });
  cache.set(id, puzzle);
  return puzzle;
}
