export type Pos = '副詞' | '形容詞' | '動詞' | '形容動詞' | '名詞' | '四字熟語';
/** standard = 上級むけ、easy = 初級むけ */
export type Mode = 'standard' | 'easy';
export type Dir = 'across' | 'down'; // across = ヨコ, down = タテ

export interface Word {
  /** 読み (ひらがな。小さい字をふくむ本来の形) */
  reading: string;
  /** 漢字まじりの書き方。ひらがなだけの語は空文字 */
  kanji: string;
  pos: Pos;
  /** カギ (意味)。「漢字(かんじ)」と書くとふりがなになる */
  clue: string;
  /** 例文。答えが入るところは 〇〇。例文がいくつかある言葉は、問題を作るときにその中から 1 つをえらんで入れる */
  example: string;
  /** その言葉の例文すべて (語彙データにだけある。作った問題の中には入れない) */
  examples?: string[];
}

export interface Entry {
  num: number;
  dir: Dir;
  row: number;
  col: number;
  /** 盤面に入る字 (小さい字は大きい字にそろえてある) */
  answer: string;
  word: Word;
}

export interface Puzzle {
  id: string;
  size: number;
  entries: Entry[];
}

export function entryCells(e: Entry, size: number): number[] {
  const cells: number[] = [];
  for (let i = 0; i < e.answer.length; i++) {
    cells.push(e.dir === 'across' ? e.row * size + e.col + i : (e.row + i) * size + e.col);
  }
  return cells;
}

/** 正解の盤面。字の入らないマスは null */
export function solutionGrid(p: Puzzle): (string | null)[] {
  const grid: (string | null)[] = new Array(p.size * p.size).fill(null);
  for (const e of p.entries) {
    entryCells(e, p.size).forEach((c, i) => (grid[c] = e.answer[i]));
  }
  return grid;
}

/** 保存した途中経過が、今の問題のものかを見分けるための印 */
export function puzzleSignature(p: Puzzle): string {
  return p.entries.map((e) => `${e.dir[0]}${e.row}.${e.col}${e.answer}`).join('|');
}

/** 日本時間での今日の日付 (YYYY-MM-DD) */
export function jstDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
