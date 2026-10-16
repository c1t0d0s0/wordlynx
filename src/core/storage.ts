import { addDays, puzzleSignature, type Mode, type Puzzle } from './puzzle';
import { clearPoints, earnedPoints, normalizeStamps, rewardFor, type StampReward } from './rewards';

import { emptySnapshot, type DailyStats, type OwnedCard, type Progress, type Snapshot } from './snapshot';

export type { OwnedCard, Progress } from './snapshot';

// 記録を置く場所。ログインしていない人の記録は今までどおり GUEST_PREFIX の下。
// ログイン中の人の記録 (Firestore の写し) は、人ごとに別の場所に置き、ログアウトしたら消す。
const GUEST_PREFIX = 'wordlynx:v1:';
const userPrefix = (uid: string) => `wordlynx:u:${uid}:`;
const ACTIVE_UID_KEY = 'wordlynx:auth-uid';
/** ヒント代を 1 つの数字で持っていたころの分を入れておくキー */
const SPENT_BEFORE = '(before)';

let prefix = GUEST_PREFIX;
let listener: ((key: string) => void) | null = null;
let muted = false;

/** 読み書きする記録を切りかえる。uid が null ならログインなしの記録 */
export function useStore(uid: string | null): void {
  prefix = uid ? userPrefix(uid) : GUEST_PREFIX;
}

/** 今、読み書きしているのがだれの記録か。ログインなしの記録なら null */
export function currentUid(): string | null {
  return prefix === GUEST_PREFIX ? null : prefix.slice('wordlynx:u:'.length, -1);
}

/** この端末で、さいごにログインしていた人。次に開いたとき、通信を待たずにその人の写しを出すために使う */
export function rememberedUid(): string | null {
  try {
    return localStorage.getItem(ACTIVE_UID_KEY);
  } catch {
    return null;
  }
}

export function rememberUid(uid: string | null): void {
  try {
    if (uid) localStorage.setItem(ACTIVE_UID_KEY, uid);
    else localStorage.removeItem(ACTIVE_UID_KEY);
  } catch {
    /* 無視 */
  }
}

/** 記録が書きかわったら知らせてもらう (Firestore に送るため)。key は「stamps」「progress:stage-1」など */
export function onStorageChange(cb: ((key: string) => void) | null): void {
  listener = cb;
}

// localStorage が使えない環境 (プライベートブラウズなど) でも遊べるよう、失敗は無視する
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(prefix + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(prefix + key, JSON.stringify(value));
  } catch {
    /* 保存できなくても続行 */
  }
  if (!muted) listener?.(key);
}

/** 今の場所にあるキーの一覧 (prefix をのぞいた形) */
function keys(at: string = prefix): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(at)) out.push(key.slice(at.length));
    }
  } catch {
    /* 無視 */
  }
  return out;
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
  write(`progress:${id}`, { ...progress, at: Date.now() });
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
  const played = keys().length > 0;
  // ここで保存しておかないと、このあと書かれる記録のせいで、次に開いたとき「前から遊んでいた人」に見えてしまう
  write('mode', played ? 'standard' : 'easy');
}

export function setMode(mode: Mode): void {
  write('settings-at', Date.now()); // 2 か所の記録を合わせるとき、あとから変えたほうを使う
  write('mode', mode);
}

/** クエリパラメータ (?grade=3 など) から学年を読みとり、1〜3 年生なら初級、4〜6 年生なら上級を返す */
export function modeFromGrade(search: string): Mode | null {
  const g = new URLSearchParams(search).get('grade');
  if (g === '1' || g === '2' || g === '3') return 'easy';
  if (g === '4' || g === '5' || g === '6') return 'standard';
  return null;
}

/** URL に ?grade=1〜6 が付いていたら、その学年向けのモードに切りかえて保存する */
export function applyGrade(search: string): void {
  const mode = modeFromGrade(search);
  if (mode) setMode(mode);
}

/** 効果音を鳴らすかどうか。何もえらんでいなければ鳴らす */
export function getSound(): boolean {
  return read<boolean>('sound') !== false;
}

export function setSound(on: boolean): void {
  write('settings-at', Date.now());
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
  const keep = [`progress:daily-${today}`, `progress:daily-easy-${today}`];
  for (const key of keys()) {
    if (key.startsWith('progress:daily-') && !keep.includes(key)) removeKey(prefix + key);
  }
}

function removeKey(fullKey: string): void {
  try {
    localStorage.removeItem(fullKey);
  } catch {
    /* 無視 */
  }
}

/** 今日のパズルの途中経過のうち、今日のものかどうか (前の日のものは消してよい) */
export function isStaleDaily(progressId: string, today: string): boolean {
  return progressId.startsWith('daily-') && progressId !== `daily-${today}` && progressId !== `daily-easy-${today}`;
}

// ---- スタンプ・ポイント・カード (初級と上級で共通) ----

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
    // クリアずみのステージと、今日のパズル
    for (const key of keys()) {
      if (key.startsWith('progress:') && read<Progress>(key)?.done) carried.add(key.slice('progress:'.length));
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

/**
 * カードを値下げしたとき、前の高い値段で交換していた人に差額を返す。
 * 持っているカードの「払った額」を、今の値段まで下げる (上げることはしない)。何回よんでも結果は同じ。
 */
export function migrateCardPrices(cards: readonly { id: string; price: number }[]): void {
  const price = new Map(cards.map((c) => [c.id, c.price]));
  const owned = getCards();
  const adjusted = owned.map((c) => ({ ...c, paid: Math.min(c.paid, price.get(c.id) ?? c.paid) }));
  if (adjusted.some((c, i) => c.paid !== owned[i].paid)) write('cards', adjusted);
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

/** ヒントに使ったポイント。パズルの id ごとに記録する */
function getSpent(): Record<string, number> {
  const saved = read<number | Record<string, number>>('spent');
  // 前は 1 つの数字で持っていた。その分は 1 つのキーにまとめて引きつぐ
  if (typeof saved === 'number') return saved > 0 ? { [SPENT_BEFORE]: saved } : {};
  const out: Record<string, number> = {};
  for (const [key, points] of Object.entries(saved ?? {})) if (typeof points === 'number' && points > 0) out[key] = points;
  return out;
}

function spentOnHints(): number {
  return Object.values(getSpent()).reduce((sum, points) => sum + points, 0);
}

/**
 * ヒントのためにポイントを使う。足りないときは何もせず false。
 * puzzleId ごとに記録するのは、2 か所の記録を合わせるときに二重に数えないため。
 */
export function spendPoints(points: number, puzzleId = '(other)'): boolean {
  if (points <= 0 || balance() < points) return false;
  const spent = getSpent();
  write('spent', { ...spent, [puzzleId]: (spent[puzzleId] ?? 0) + points });
  return true;
}

/** ポイントとカードを交換する。ポイントが足りないときや、もう持っているときは何もしない */
export function buyCard(card: { id: string; price: number }): boolean {
  const owned = getCards();
  if (owned.some((c) => c.id === card.id) || balance() < card.price) return false;
  write('cards', [...owned, { id: card.id, paid: card.price }]);
  return true;
}

// ---- 記録をまるごと出し入れする (ログイン・Firestore との同期で使う) ----

/** 今の場所にある記録を、まるごと取り出す */
export function exportSnapshot(): Snapshot {
  const s = emptySnapshot();
  s.stamps = getStamps();
  s.clears = getClears().slice().sort();
  s.cards = getCards();
  s.spent = getSpent();
  const mode = read<Mode>('mode');
  const sound = read<boolean>('sound');
  const at = read<number>('settings-at');
  s.settings = {
    mode: mode === 'easy' || mode === 'standard' ? mode : null,
    sound: typeof sound === 'boolean' ? sound : null,
    at: typeof at === 'number' ? at : 0,
    daily: read<DailyStats>(statsKey('standard')),
    dailyEasy: read<DailyStats>(statsKey('easy')),
  };
  for (const key of keys()) {
    if (!key.startsWith('progress:')) continue;
    const p = read<Progress>(key);
    if (p && typeof p.sig === 'string' && Array.isArray(p.cells)) s.progress[key.slice('progress:'.length)] = p;
  }
  return s;
}

/**
 * 今の場所の記録を、わたされた内容に入れかえる。
 * Firestore から取りこんだ結果を書くためのものなので、「書きかわった」という知らせは出さない。
 * keepProgress が true のときは、パズルの途中経過にはさわらない。
 */
export function importSnapshot(s: Snapshot, opts: { keepProgress?: boolean } = {}): void {
  muted = true;
  try {
    write('stamps', s.stamps);
    write('clears', s.clears);
    write('cards', s.cards);
    write('spent', s.spent);
    if (s.settings.mode) write('mode', s.settings.mode);
    if (s.settings.sound !== null) write('sound', s.settings.sound);
    write('settings-at', s.settings.at);
    if (s.settings.daily) write(statsKey('standard'), s.settings.daily);
    if (s.settings.dailyEasy) write(statsKey('easy'), s.settings.dailyEasy);
    if (!opts.keepProgress) {
      for (const key of keys()) {
        if (key.startsWith('progress:') && !(key.slice('progress:'.length) in s.progress)) removeKey(prefix + key);
      }
      for (const [id, p] of Object.entries(s.progress)) write(`progress:${id}`, p);
    }
  } finally {
    muted = false;
  }
}

/** その人の記録 (uid が null ならログインなしの記録) を、この端末から消す */
export function clearStore(uid: string | null): void {
  const at = uid ? userPrefix(uid) : GUEST_PREFIX;
  for (const key of keys(at)) removeKey(at + key);
}
