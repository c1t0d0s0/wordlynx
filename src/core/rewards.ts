import { addDays } from './puzzle';

/** 7 日連続するたびにもらえるポイント */
export const WEEK_POINTS = 1000;
/** その月の 1 日から末日まで、すべてスタンプがそろうともらえるポイント */
export const MONTH_POINTS = 5000;
export const WEEK_LENGTH = 7;
/** ステージや今日のパズルを 1 つクリアするともらえるポイント (同じパズルでは 1 回だけ) */
export const CLEAR_POINTS = 20;
/** むずかしいチャレンジ (ステージ 9・10。初級も上級も) をクリアするともらえるポイント */
export const CHALLENGE_POINTS = 200;

/** そのパズルをクリアするともらえるポイント。ステージの id は stage-2026-10-9 の形 (前の固定ステージは stage-9) */
export function clearPoints(puzzleId: string): number {
  // 自分たちで作ったパズルでは、ポイントはもらえない
  if (puzzleId.startsWith('custom-')) return 0;
  return /^(easy-)?stage-(?:\d{4}-\d{2}-)?(9|10)$/.test(puzzleId) ? CHALLENGE_POINTS : CLEAR_POINTS;
}

/** 1 つのパズルで、ポイントなしで使えるヒントの回数 */
export const FREE_HINTS = 5;
/** それより多くヒントを使うときに、1 回ごとにいるポイント */
export const HINT_COST = 10;

export interface Earned {
  /** 7 日連続を達成した回数 */
  weeks: number;
  /** スタンプがすべてそろった月 (YYYY-MM) */
  months: string[];
  total: number;
}

/** 重複をのぞいて日付順にならべる */
export function normalizeStamps(stamps: readonly string[]): string[] {
  return [...new Set(stamps.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
}

/** 連続する日のかたまりごとの日数 */
export function runLengths(stamps: readonly string[]): number[] {
  const days = normalizeStamps(stamps);
  const runs: number[] = [];
  days.forEach((day, i) => {
    if (i > 0 && addDays(days[i - 1], 1) === day) runs[runs.length - 1]++;
    else runs.push(1);
  });
  return runs;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * スタンプの日付から、これまでにもらったポイントを計算する。
 * 合計を保存せずに毎回ここで計算するので、二重にもらったり取りこぼしたりしない。
 */
export function earnedPoints(stamps: readonly string[]): Earned {
  const days = normalizeStamps(stamps);
  const weeks = runLengths(days).reduce((sum, len) => sum + Math.floor(len / WEEK_LENGTH), 0);
  const perMonth = new Map<string, number>();
  for (const day of days) perMonth.set(day.slice(0, 7), (perMonth.get(day.slice(0, 7)) ?? 0) + 1);
  const months = [...perMonth].filter(([month, count]) => count === daysInMonth(month)).map(([month]) => month);
  return { weeks, months, total: weeks * WEEK_POINTS + months.length * MONTH_POINTS };
}

/** date の日まで何日つづいているか (date にスタンプがなければ 0) */
export function runEndingAt(stamps: readonly string[], date: string): number {
  const set = new Set(stamps);
  let n = 0;
  for (let d = date; set.has(d); d = addDays(d, -1)) n++;
  return n;
}

/** 今つづいている日数。今日がまだでも、きのうまで続いていれば数える */
export function currentRun(stamps: readonly string[], today: string): number {
  return runEndingAt(stamps, today) || runEndingAt(stamps, addDays(today, -1));
}

/** その月の 1 日から順に、スタンプがあるかどうか */
export function monthView(stamps: readonly string[], month: string): boolean[] {
  const set = new Set(stamps);
  return Array.from({ length: daysInMonth(month) }, (_, i) => set.has(`${month}-${String(i + 1).padStart(2, '0')}`));
}

export interface StampReward {
  /** 新しくスタンプが押されたか (同じ日の 2 回目は false) */
  added: boolean;
  /** この日まで何日つづいているか */
  run: number;
  weekPoints: number;
  monthPoints: number;
  /** 称号が上がったら、新しい称号 */
  promoted: string | null;
}

/** date にスタンプを足したとき、新しくもらえるポイント */
export function rewardFor(before: readonly string[], date: string): StampReward {
  const added = !before.includes(date);
  const after = added ? [...before, date] : before;
  const a = earnedPoints(before);
  const b = earnedPoints(after);
  return {
    added,
    run: runEndingAt(after, date),
    weekPoints: (b.weeks - a.weeks) * WEEK_POINTS,
    monthPoints: (b.months.length - a.months.length) * MONTH_POINTS,
    promoted: promotedBy(before, date),
  };
}

// ---- 称号 (今日のパズルを解きつづけると上がる) ----

/** 十級から始まり、一級の次は初段、十段の次は師範 (いちばん上) */
export const TITLES: readonly string[] = [
  ...['十', '九', '八', '七', '六', '五', '四', '三', '二', '一'].map((n) => `${n}級`),
  ...['初', '二', '三', '四', '五', '六', '七', '八', '九', '十'].map((n) => `${n}段`),
  '師範',
];
/** この日数つづけて解くと、1 つ上がる */
export const TITLE_RUN = 7;
/** つづけなくても、この日数解くと、1 つ上がる */
export const TITLE_DAYS = 10;

export interface TitleState {
  /** 0 (十級) 〜 TITLES.length - 1 (師範) */
  level: number;
  title: string;
  /** 次の称号。師範なら null */
  next: string | null;
  /** 次の称号まで、あと何日。師範なら 0 */
  left: number;
}

/**
 * スタンプの日付から、今の称号を計算する。前に上がった日のあとで、TITLE_RUN 日つづけるか、
 * TITLE_DAYS 日解くと 1 つ上がる (上がった日までの日数と連続は、次には持ちこさない)。
 */
export function titleOf(stamps: readonly string[], today: string): TitleState {
  const top = TITLES.length - 1;
  let level = 0;
  let days = 0;
  let run = 0;
  let last = '';
  for (const day of normalizeStamps(stamps)) {
    if (level === top) break;
    run = run > 0 && addDays(last, 1) === day ? run + 1 : 1;
    days++;
    last = day;
    if (run >= TITLE_RUN || days >= TITLE_DAYS) {
      level++;
      days = 0;
      run = 0;
    }
  }
  if (level === top) return { level, title: TITLES[level], next: null, left: 0 };
  // 連続は、今日かきのうまで続いていて、まだのばせるときだけ数える
  const alive = run > 0 && (last === today || last === addDays(today, -1));
  const left = Math.min(TITLE_DAYS - days, alive ? TITLE_RUN - run : TITLE_RUN);
  return { level, title: TITLES[level], next: TITLES[level + 1], left };
}

/** date にスタンプを足すと称号が上がるなら、新しい称号。上がらなければ null */
export function promotedBy(before: readonly string[], date: string): string | null {
  if (before.includes(date)) return null;
  const a = titleOf(before, date);
  const b = titleOf([...before, date], date);
  return b.level > a.level ? b.title : null;
}
