import { addDays, puzzleSignature, type Puzzle } from './puzzle';

const PREFIX = 'wordlynx:v1:';

export interface Progress {
  sig: string;
  cells: string[];
  revealed: number[];
  done: boolean;
}

interface DailyStats {
  lastDate: string;
  streak: number;
}

// localStorage が使えない環境 (プライベートブラウズなど) でも遊べるよう、失敗は無視する
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* 保存できなくても続行 */
  }
}

export function freshProgress(p: Puzzle): Progress {
  return { sig: puzzleSignature(p), cells: new Array(p.size * p.size).fill(''), revealed: [], done: false };
}

export function loadProgress(p: Puzzle): Progress {
  const saved = read<Progress>(`progress:${p.id}`);
  if (saved && saved.sig === puzzleSignature(p) && saved.cells?.length === p.size * p.size) return saved;
  return freshProgress(p);
}

export function saveProgress(id: string, progress: Progress): void {
  write(`progress:${id}`, progress);
}

export type Status = 'new' | 'playing' | 'done';

export function statusOf(id: string): Status {
  const saved = read<Progress>(`progress:${id}`);
  if (!saved) return 'new';
  if (saved.done) return 'done';
  return saved.cells?.some((c) => c !== '') ? 'playing' : 'new';
}

export function recordDailyClear(date: string): void {
  const stats = read<DailyStats>('daily');
  if (stats?.lastDate === date) return;
  const streak = stats?.lastDate === addDays(date, -1) ? stats.streak + 1 : 1;
  write('daily', { lastDate: date, streak });
}

/** 今日か昨日にクリアしていれば、連続日数が続いている */
export function currentStreak(today: string): number {
  const stats = read<DailyStats>('daily');
  if (!stats) return 0;
  return stats.lastDate === today || stats.lastDate === addDays(today, -1) ? stats.streak : 0;
}

/** 古いデイリーの途中経過を消す */
export function pruneOldDaily(today: string): void {
  try {
    const keep = `${PREFIX}progress:daily-${today}`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${PREFIX}progress:daily-`) && key !== keep) localStorage.removeItem(key);
    }
  } catch {
    /* 無視 */
  }
}
