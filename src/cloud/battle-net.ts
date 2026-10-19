// たいせんの通信 (Firebase Realtime Database)。Firebase を使うのは、たいせんではこのファイルだけ。
// たいせんの画面を開いたときにだけ読みこむ。
import { signInAnonymously } from 'firebase/auth';
import {
  connectDatabaseEmulator,
  get,
  getDatabase,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
  type Database,
  type OnDisconnect,
} from 'firebase/database';
import {
  COUNTDOWN_MS,
  ROOM_TTL_MS,
  freeSeat,
  makeCode,
  makeSeed,
  seatOf,
  type BattlePlayer,
  type BattleRoom,
} from '../core/battle';
import type { Mode } from '../core/puzzle';
import { firebaseApp, firebaseAuth } from './app';
import { useEmulator } from './config';

export type JoinResult = 'ok' | 'missing' | 'started' | 'full';

/** たいせんの画面から使う通信の窓口 */
export interface BattleNet {
  readonly uid: string;
  /** サーバーの時計で今の時刻 (ミリ秒) */
  serverNow(): number;
  /** 部屋を作って、自分も席にすわる。もどり値は対戦コード */
  create(mode: Mode, vocab: string, name: string): Promise<string>;
  /** 部屋に入る (すでにすわっていれば、その席にもどる) */
  join(code: string, name: string): Promise<JoinResult>;
  /** 部屋のようすを見つづける。部屋がなくなると null が来る */
  watch(code: string, cb: (room: BattleRoom | null) => void): () => void;
  /** 次の回になっていたら、自分の記録をその回のはじめの形にもどす */
  resetForRound(code: string, room: BattleRoom): Promise<void>;
  progress(code: string, filled: number, total: number, hints: number): void;
  finish(code: string, filled: number, total: number, hints: number): Promise<void>;
  retire(code: string): Promise<void>;
  /** ホストだけ: 新しい盤面の種を決めて、カウントダウンを始める */
  start(code: string): Promise<void>;
  /** ホストだけ: まだ解いている人がいても、この回を終わりにする */
  end(code: string): Promise<void>;
  /** ホストだけ: 同じ部屋で、次の回の待ち画面にもどる */
  rematch(code: string, round: number): Promise<void>;
  /** 部屋を出る。ホストなら部屋ごと消す */
  leave(code: string): Promise<void>;
}

let db: Database | null = null;

function database(): Database {
  if (db) return db;
  db = getDatabase(firebaseApp());
  if (useEmulator) connectDatabaseEmulator(db, '127.0.0.1', 9000);
  return db;
}

/** 席の番号 (0〜7) は数字なので、Realtime Database から配列で返ってくることがある。いつも { 席: 記録 } の形にそろえる */
function normalize(val: unknown): BattleRoom | null {
  if (!val || typeof val !== 'object') return null;
  const room = val as BattleRoom;
  const players: Record<string, BattlePlayer> = {};
  Object.entries((room.players ?? {}) as Record<string, BattlePlayer | null>).forEach(([seat, p]) => {
    if (p) players[seat] = p;
  });
  return { ...room, players };
}

/** ログインしていなければ匿名でログインして、たいせんの通信を始める */
export async function connectBattle(): Promise<BattleNet> {
  const auth = firebaseAuth();
  await auth.authStateReady();
  if (!auth.currentUser) await signInAnonymously(auth);
  const uid = auth.currentUser!.uid;
  const d = database();
  const roomRef = (code: string) => ref(d, `battles/${code}`);
  const seatRef = (code: string, seat: string) => ref(d, `battles/${code}/players/${seat}`);

  let offset = 0;
  onValue(ref(d, '.info/serverTimeOffset'), (snap) => (offset = Number(snap.val()) || 0));
  const serverNow = () => Date.now() + offset;

  // 自分の席 (部屋ごと)。つながり直したときに online をもどし、切れたときの予約をかけ直す
  const mySeat = new Map<string, string>();
  const disconnects = new Map<string, OnDisconnect>();
  onValue(ref(d, '.info/connected'), (snap) => {
    if (snap.val() !== true) return;
    mySeat.forEach((seat, code) => void markOnline(code, seat));
  });

  async function markOnline(code: string, seat: string): Promise<void> {
    const r = ref(d, `battles/${code}/players/${seat}/online`);
    const od = onDisconnect(r);
    disconnects.set(code, od);
    await od.set(false);
    await set(r, true).catch(() => {});
  }

  function freshPlayer(name: string, round: number): BattlePlayer {
    return { uid, name, joinedAt: serverNow(), online: true, round, filled: 0, total: 0, hints: 0 };
  }

  async function sit(code: string, seat: string, player: BattlePlayer): Promise<void> {
    await set(seatRef(code, seat), player);
    mySeat.set(code, seat);
    await markOnline(code, seat);
  }

  // 進み具合は、マスを入れるたびではなく、少し間をあけて送る
  const pending = new Map<string, { filled: number; total: number; hints: number }>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  function sendProgress(code: string): void {
    timers.delete(code);
    const p = pending.get(code);
    const seat = mySeat.get(code);
    pending.delete(code);
    if (p && seat) void update(seatRef(code, seat), p).catch(() => {});
  }

  return {
    uid,
    serverNow,

    async create(mode, vocab, name) {
      for (let tries = 0; tries < 20; tries++) {
        const code = makeCode();
        const room: Omit<BattleRoom, 'createdAt'> & { createdAt: object } = {
          app: 'wordlynx',
          hostUid: uid,
          createdAt: serverTimestamp(),
          mode,
          vocab,
          round: 1,
          seed: '',
          status: 'waiting',
          players: { 0: freshPlayer(name, 1) },
        };
        // 使われていない番号 (または 1 日以上前の古い部屋) のときだけ作る
        const now = serverNow();
        const result = await runTransaction(
          roomRef(code),
          (current: BattleRoom | null) => (current && current.createdAt >= now - ROOM_TTL_MS ? undefined : room),
          { applyLocally: false },
        );
        if (!result.committed) continue;
        mySeat.set(code, '0');
        await markOnline(code, '0');
        return code;
      }
      throw new Error('対戦コードを作れませんでした');
    },

    async join(code, name) {
      for (let tries = 0; tries < 10; tries++) {
        const room = normalize((await get(roomRef(code))).val());
        if (!room) return 'missing';
        const mine = seatOf(room, uid);
        if (mine) {
          // 前にすわっていた席にもどる (ページを読みこみ直したときなど)
          mySeat.set(code, mine);
          await update(seatRef(code, mine), { name });
          await markOnline(code, mine);
          return 'ok';
        }
        if (room.status !== 'waiting') return 'started';
        const seat = freeSeat(room);
        if (!seat) return 'full';
        try {
          await sit(code, seat, freshPlayer(name, room.round));
          return 'ok';
        } catch {
          // ほぼ同時に、ほかの人が同じ席にすわった。もういちど空いている席をさがす
        }
      }
      return 'full';
    },

    watch(code, cb) {
      return onValue(
        roomRef(code),
        (snap) => cb(normalize(snap.val())),
        () => cb(null),
      );
    },

    async resetForRound(code, room) {
      const seat = mySeat.get(code);
      const me = seat ? room.players?.[seat] : undefined;
      if (!seat || !me || me.round === room.round) return;
      await set(seatRef(code, seat), { ...freshPlayer(me.name, room.round), joinedAt: me.joinedAt });
    },

    progress(code, filled, total, hints) {
      pending.set(code, { filled, total, hints });
      if (!timers.has(code)) timers.set(code, setTimeout(() => sendProgress(code), 600));
    },

    async finish(code, filled, total, hints) {
      clearTimeout(timers.get(code));
      timers.delete(code);
      pending.delete(code);
      const seat = mySeat.get(code);
      if (seat) await update(seatRef(code, seat), { filled, total, hints, finishedAt: serverTimestamp() });
    },

    async retire(code) {
      const seat = mySeat.get(code);
      if (seat) await update(seatRef(code, seat), { retired: true });
    },

    async start(code) {
      await update(roomRef(code), { seed: makeSeed(), status: 'playing', startAt: serverNow() + COUNTDOWN_MS });
    },

    async end(code) {
      await set(ref(d, `battles/${code}/status`), 'finished');
    },

    async rematch(code, round) {
      await update(roomRef(code), { round: round + 1, status: 'waiting', seed: '' });
    },

    async leave(code) {
      clearTimeout(timers.get(code));
      timers.delete(code);
      const seat = mySeat.get(code);
      mySeat.delete(code);
      await disconnects.get(code)?.cancel().catch(() => {});
      disconnects.delete(code);
      const room = normalize((await get(roomRef(code)).catch(() => null))?.val());
      if (!room) return;
      if (room.hostUid === uid) {
        await remove(roomRef(code)).catch(() => {});
      } else if (seat && room.players?.[seat]?.uid === uid) {
        // 待っている間なら席をあける。対戦のとちゅうなら、リタイアとして記録をのこす
        if (room.status === 'waiting') await remove(seatRef(code, seat)).catch(() => {});
        else await update(seatRef(code, seat), { online: false, retired: true }).catch(() => {});
      }
    },
  };
}
