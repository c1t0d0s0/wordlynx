import { addDays, puzzleSignature, type Mode, type Puzzle } from './puzzle';
import { clearPoints, earnedPoints, normalizeStamps, rewardFor, type StampReward } from './rewards';

const PREFIX = 'wordlynx:v1:';

export interface Progress {
  sig: string;
  cells: string[];
  revealed: number[];
  done: boolean;
  /** このパズルでヒントを使った回数。やりなおしても 0 にもどさない */
  hints?: number;
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

/** えらんでいるモード。はじめて開いた人は初級から始まる */
export function getMode(): Mode {
  return read<Mode>('mode') === 'standard' ? 'standard' : 'easy';
}

/**
 * はじめて開いたときに、モードを決めて保存する。
 * - まったくはじめての人は初級
 * - 「はじめは初級」に変える前から遊んでいて、モードをえらんだことがない人は上級のまま
 *   (前は上級がはじめの状態で、えらんでいない人には何も保存していなかった)
 * アプリを開いたとき、ほかの記録を書く前によぶ。
 */
export function migrateMode(): void {
  if (read<Mode>('mode') !== null) return;
  let played = false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i)?.startsWith(PREFIX)) played = true;
    }
  } catch {
    /* 無視 */
  }
  // ここで保存しておかないと、このあと書かれる記録のせいで、次に開いたとき「前から遊んでいた人」に見えてしまう
  write('mode', played ? 'standard' : 'easy');
}

export function setMode(mode: Mode): void {
  write('mode', mode);
}

/** 効果音を鳴らすかどうか。何もえらんでいなければ鳴らす */
export function getSound(): boolean {
  return read<boolean>('sound') !== false;
}

export function setSound(on: boolean): void {
  write('sound', on);
}

// 連続日数はモードごとに数える
const statsKey = (mode: Mode) => (mode === 'easy' ? 'daily-easy' : 'daily');

export function recordDailyClear(date: string, mode: Mode): void {
  const stats = read<DailyStats>(statsKey(mode));
  if (stats?.lastDate === date) return;
  const streak = stats?.lastDate === addDays(date, -1) ? stats.streak + 1 : 1;
  write(statsKey(mode), { lastDate: date, streak });
}

/** 今日か昨日にクリアしていれば、連続日数が続いている */
export function currentStreak(today: string, mode: Mode): number {
  const stats = read<DailyStats>(statsKey(mode));
  if (!stats) return 0;
  return stats.lastDate === today || stats.lastDate === addDays(today, -1) ? stats.streak : 0;
}

/** 古いデイリーの途中経過を消す */
export function pruneOldDaily(today: string): void {
  try {
    const keep = [`${PREFIX}progress:daily-${today}`, `${PREFIX}progress:daily-easy-${today}`];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${PREFIX}progress:daily-`) && !keep.includes(key)) localStorage.removeItem(key);
    }
  } catch {
    /* 無視 */
  }
}

// ---- スタンプ・ポイント・カード (初級と上級で共通) ----

export interface OwnedCard {
  id: string;
  /** 交換したときに使ったポイント。あとで値段を変えても残高がずれないように残す */
  paid: number;
}

/** スタンプが押された日の一覧 */
export function getStamps(): string[] {
  const saved = read<string[]>('stamps');
  return Array.isArray(saved) ? normalizeStamps(saved) : [];
}

/** その日のスタンプを押す。1 日に何回よんでも 1 個だけ */
export function addStamp(date: string): StampReward {
  const before = getStamps();
  const reward = rewardFor(before, date);
  if (reward.added) write('stamps', normalizeStamps([...before, date]));
  return reward;
}

export function getCards(): OwnedCard[] {
  const saved = read<OwnedCard[]>('cards');
  return Array.isArray(saved) ? saved.filter((c) => typeof c?.id === 'string' && c.paid >= 0) : [];
}

/**
 * クリアのポイントをもらったパズルの id。同じパズルをやりなおしても、もらえるのは 1 回だけ。
 * 今日のパズルの途中経過は次の日に消すので、もらったかどうかはここに別に残しておく。
 */
export function getClears(): string[] {
  const saved = read<string[]>('clears');
  return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : [];
}

/**
 * スタンプやクリアのポイントができる前から遊んでいた人の記録を引きつぐ。
 * アプリを開いたときに 1 回だけよぶ (2 回目からは何もしない)。
 * クリアした瞬間にやると、そのクリアまで「前からあった分」に入ってしまうので、かならず最初にすませる。
 */
export function migrateRewards(): void {
  if (!Array.isArray(read<string[]>('stamps'))) {
    // それまでの連続クリアの日数分を、スタンプにする
    const carried: string[] = [];
    for (const mode of ['standard', 'easy'] as const) {
      const stats = read<DailyStats>(statsKey(mode));
      if (!stats || !(stats.streak > 0)) continue;
      for (let i = 0; i < stats.streak; i++) carried.push(addDays(stats.lastDate, -i));
    }
    write('stamps', normalizeStamps(carried));
  }
  if (!Array.isArray(read<string[]>('clears'))) {
    const carried = new Set<string>();
    try {
      // クリアずみのステージと、今日のパズル
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(`${PREFIX}progress:`)) continue;
        const id = key.slice(`${PREFIX}progress:`.length);
        if (read<Progress>(`progress:${id}`)?.done) carried.add(id);
      }
    } catch {
      /* 無視 */
    }
    // 前の日までの今日のパズルは、スタンプのある日を 1 回ずつクリアしたものとして数える
    // (どちらのモードだったかは残っていない)
    const dailyDates = new Set([...carried].map((id) => id.match(/^daily-(?:easy-)?(\d{4}-\d{2}-\d{2})$/)?.[1]));
    for (const date of getStamps()) if (!dailyDates.has(date)) carried.add(`daily-${date}`);
    write('clears', [...carried].sort());
  }
}

/** パズルをクリアしたことを記録する。もどり値は、今回もらえたポイント (2 回目からは 0) */
export function addClear(puzzleId: string): number {
  const clears = getClears();
  if (clears.includes(puzzleId)) return 0;
  write('clears', [...clears, puzzleId]);
  return clearPoints(puzzleId);
}

/** 今つかえるポイント = クリアとスタンプでもらった分 − カードやヒントに使った分 */
export function balance(): number {
  return (
    getClears().reduce((sum, id) => sum + clearPoints(id), 0) +
    earnedPoints(getStamps()).total -
    getCards().reduce((sum, c) => sum + c.paid, 0) -
    spentOnHints()
  );
}

function spentOnHints(): number {
  const spent = read<number>('spent');
  return typeof spent === 'number' && spent > 0 ? spent : 0;
}

/** ヒントのためにポイントを使う。足りないときは何もせず false */
export function spendPoints(points: number): boolean {
  if (points <= 0 || balance() < points) return false;
  write('spent', spentOnHints() + points);
  return true;
}

/** ポイントとカードを交換する。ポイントが足りないときや、もう持っているときは何もしない */
export function buyCard(card: { id: string; price: number }): boolean {
  const owned = getCards();
  if (owned.some((c) => c.id === card.id) || balance() < card.price) return false;
  write('cards', [...owned, { id: card.id, paid: card.price }]);
  return true;
}
