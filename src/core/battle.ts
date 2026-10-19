// たいせん (同じパズルを何人かで同時に解いて、タイムを競う) の決まりごと。
// 通信や画面には依存しない純粋な関数だけを置く。
import { DAILY_SIZE, DAILY_WORDS, generate } from './generator';
import type { Mode, Puzzle, Word } from './puzzle';
import { hashString } from './rng';

/** 1 つの部屋に入れる人数 */
export const MAX_PLAYERS = 8;
/** ヒント 1 回ごとに、タイムに足す時間 */
export const HINT_PENALTY_MS = 30_000;
/** 名前の長さ (文字数) */
export const NAME_MAX = 10;
/** スタートを押してから、盤面が出るまで */
export const COUNTDOWN_MS = 3500;
/** 作ってからこれだけたった部屋は、だれが消してもよい (Realtime Database のルールと同じ値) */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export type BattleStatus = 'waiting' | 'playing' | 'finished';

/**
 * battles/{code}/players/{seat}。seat は 0〜7 の席の番号
 * (Realtime Database のルールでは人数を数えられないので、席を 8 つだけ用意して人数をおさえる)
 */
export interface BattlePlayer {
  uid: string;
  name: string;
  joinedAt: number;
  online: boolean;
  /** この記録が、何回目の対戦のものか */
  round: number;
  filled: number;
  total: number;
  hints: number;
  finishedAt?: number;
  retired?: boolean;
}

/** battles/{code} */
export interface BattleRoom {
  app: 'wordlynx';
  hostUid: string;
  createdAt: number;
  mode: Mode;
  /** 語彙の指紋。同じ seed から同じ盤面を作れるか (公開をはさんで語彙が変わっていないか) を確かめる */
  vocab: string;
  round: number;
  seed: string;
  status: BattleStatus;
  /** 盤面が出る時刻 (サーバーの時計、ミリ秒) */
  startAt?: number;
  players?: Record<string, BattlePlayer>;
}

/** 空いている席の番号。満席なら null */
export function freeSeat(room: Pick<BattleRoom, 'players'>): string | null {
  for (let i = 0; i < MAX_PLAYERS; i++) if (!room.players?.[i]) return String(i);
  return null;
}

/** その人がすわっている席の番号 */
export function seatOf(room: Pick<BattleRoom, 'players'>, uid: string): string | null {
  const found = Object.entries(room.players ?? {}).find(([, p]) => p.uid === uid);
  return found ? found[0] : null;
}

/** 対戦コード: 数字 5 けた (スマホの数字キーで打ちやすいように。0 から始まる番号は使わない) */
export function makeCode(random: () => number = Math.random): string {
  return String(10000 + Math.floor(random() * 90000));
}

export function isCode(s: string): boolean {
  return /^[1-9]\d{4}$/.test(s);
}

/** 打ちこまれたコードを整える (全角数字・空白・ハイフンを許す) */
export function parseCode(input: string): string | null {
  const s = input.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)).replace(/[\s-ー－]/g, '');
  return isCode(s) ? s : null;
}

/** 対戦ごとの乱数の種 */
export function makeSeed(random: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 10; i++) s += Math.floor(random() * 36).toString(36);
  return s;
}

/** 語彙の指紋。語・カギ・例文のどれかが変わると変わる */
export function vocabPrint(words: readonly Word[]): string {
  const text = words.map((w) => [w.reading, w.kanji, w.clue, ...(w.examples ?? [w.example])].join('|')).join('\n');
  return `${words.length.toString(36)}-${hashString(text).toString(36)}`;
}

/** 対戦用のパズル。同じ seed・同じ語彙なら、どの端末でも同じ盤面になる */
export function battlePuzzle(words: readonly Word[], mode: Mode, code: string, round: number, seed: string): Puzzle {
  return generate(words, {
    id: `battle-${code}-${round}`,
    seed: `wordlynx-battle-${seed}`,
    size: DAILY_SIZE,
    targetWords: DAILY_WORDS[mode],
  });
}

/** 名前を整える。前後の空白と制御文字を消し、続く空白は 1 つにして、NAME_MAX 文字までにする */
export function cleanName(input: string): string {
  const s = input.replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, '').replace(/\s+/g, ' ').trim();
  return [...s].slice(0, NAME_MAX).join('');
}

export type StandingStatus = 'done' | 'playing' | 'retired' | 'left';

export interface Standing {
  uid: string;
  name: string;
  status: StandingStatus;
  /** 解き終わった人の順位 (同じタイムは同じ順位)。終わっていない人は null */
  rank: number | null;
  /** 解くのにかかった時間 (ヒントの分を足す前) */
  solveMs: number | null;
  hints: number;
  /** 競うタイム = solveMs + ヒント × 30 秒 */
  timeMs: number | null;
  filled: number;
  total: number;
  online: boolean;
}

/**
 * 今の回の順位表。解き終わった人はタイムの速い順、まだ解いている人はうまったマスの多い順、
 * そのあとにリタイアした人、対戦のとちゅうでぬけた人。
 */
export function standings(room: Pick<BattleRoom, 'players' | 'round' | 'startAt'>): Standing[] {
  const rows: Standing[] = Object.values(room.players ?? {}).map((p) => {
    const current = p.round === room.round;
    const hints = current ? p.hints || 0 : 0;
    let status: StandingStatus = 'playing';
    let solveMs: number | null = null;
    if (current && typeof p.finishedAt === 'number' && typeof room.startAt === 'number') {
      status = 'done';
      solveMs = Math.max(0, p.finishedAt - room.startAt);
    } else if (current && p.retired) status = 'retired';
    else if (!p.online) status = 'left';
    return {
      uid: p.uid,
      name: p.name,
      status,
      rank: null,
      solveMs,
      hints,
      timeMs: solveMs === null ? null : solveMs + hints * HINT_PENALTY_MS,
      filled: current ? p.filled || 0 : 0,
      total: current ? p.total || 0 : 0,
      online: p.online,
    };
  });
  const order: Record<StandingStatus, number> = { done: 0, playing: 1, retired: 2, left: 3 };
  rows.sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      (a.timeMs ?? 0) - (b.timeMs ?? 0) ||
      b.filled - a.filled ||
      a.name.localeCompare(b.name, 'ja'),
  );
  let prev: Standing | null = null;
  rows.forEach((r, i) => {
    if (r.status !== 'done') return;
    r.rank = prev && prev.timeMs === r.timeMs ? prev.rank : i + 1;
    prev = r;
  });
  return rows;
}

/** まだ解いている人がいないか (全員が、解き終わったか・リタイアしたか・ぬけた) */
export function everyoneDone(room: Pick<BattleRoom, 'players' | 'round' | 'startAt'>): boolean {
  return standings(room).every((s) => s.status !== 'playing');
}

/** 1:05 や 12:30 の形。1 時間をこえたら 1:02:03 */
export function formatTime(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
