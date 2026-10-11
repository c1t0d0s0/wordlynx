import type { Mode } from './puzzle';

// ---- 手元の記録の形 ----

export interface Progress {
  sig: string;
  cells: string[];
  revealed: number[];
  done: boolean;
  /** このパズルでヒントを使った回数。やりなおしても 0 にもどさない */
  hints?: number;
  /** さいごに保存した時刻 (ミリ秒)。2 か所の記録を合わせるときに使う */
  at?: number;
}

export interface DailyStats {
  lastDate: string;
  streak: number;
}

export interface OwnedCard {
  id: string;
  /** 交換したときに使ったポイント。あとで値段を変えても残高がずれないように残す */
  paid: number;
}

export interface Settings {
  mode: Mode | null;
  sound: boolean | null;
  /** モードや音をさいごに変えた時刻 (ミリ秒) */
  at: number;
  daily: DailyStats | null;
  dailyEasy: DailyStats | null;
}

/** 1 人分の記録の全部。ログインなしの記録も、ログイン中の人の記録も、この形であつかう */
export interface Snapshot {
  stamps: string[];
  clears: string[];
  cards: OwnedCard[];
  /** ヒントに使ったポイント。パズルの id ごとに記録する (合わせるときに二重に数えないため) */
  spent: Record<string, number>;
  settings: Settings;
  progress: Record<string, Progress>;
}

export function emptySnapshot(): Snapshot {
  return {
    stamps: [],
    clears: [],
    cards: [],
    spent: {},
    settings: { mode: null, sound: null, at: 0, daily: null, dailyEasy: null },
    progress: {},
  };
}

/** 記録が 1 つでもあるか (設定だけのときは「ない」とみなす) */
export function hasRecords(s: Snapshot): boolean {
  return (
    s.stamps.length > 0 ||
    s.clears.length > 0 ||
    s.cards.length > 0 ||
    Object.keys(s.spent).length > 0 ||
    Object.values(s.progress).some((p) => p.done || p.cells.some((c) => c !== ''))
  );
}

// ---- Firestore に保存する形 (小学生向けの学習アプリで共通) ----
//
//   users/{uid}                                その人の情報 (全アプリ共通)。名前やメールアドレスは入れない
//   users/{uid}/apps/{appId}                   アプリごとの記録のまとめ (AppDoc)
//   users/{uid}/apps/{appId}/progress/{itemId} 教材 1 つごとの途中経過 (ProgressDoc)
//
// Wordlynx の appId は "wordlynx"。ほかのアプリは、別の appId で同じ形を使う。

export const SCHEMA = 1;
export const APP_ID = 'wordlynx';

export interface UserDoc {
  schema: number;
  createdAt: number;
  updatedAt: number;
}

export interface AppDoc {
  schema: number;
  updatedAt: number;
  /** その日の目標を達成した日 (YYYY-MM-DD)。Wordlynx ではスタンプ */
  activeDays: string[];
  /** やりとげた教材の id。Wordlynx ではクリアしたパズル */
  completed: string[];
  /** 手に入れたごほうび。Wordlynx ではヤマネコカード */
  inventory: Record<string, { paid: number }>;
  /** 使ったポイント。キーはアプリが決める (Wordlynx ではパズルの id ごとのヒント代) */
  spent: Record<string, number>;
  /** アプリごとの設定。中身はアプリが決める */
  settings: Record<string, unknown>;
}

export interface ProgressDoc {
  schema: number;
  updatedAt: number;
  status: 'playing' | 'done';
  /** 途中経過の中身。アプリが決める */
  data: Record<string, unknown>;
}

export function toAppDoc(s: Snapshot, now: number): AppDoc {
  return {
    schema: SCHEMA,
    updatedAt: now,
    activeDays: s.stamps,
    completed: s.clears,
    inventory: Object.fromEntries(s.cards.map((c) => [c.id, { paid: c.paid }])),
    spent: s.spent,
    settings: {
      mode: s.settings.mode,
      sound: s.settings.sound,
      at: s.settings.at,
      daily: s.settings.daily,
      dailyEasy: s.settings.dailyEasy,
    },
  };
}

const isStats = (v: unknown): v is DailyStats =>
  typeof v === 'object' && v !== null && typeof (v as DailyStats).lastDate === 'string' && typeof (v as DailyStats).streak === 'number';
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Firestore から読んだものは形がくずれているかもしれないので、1 つずつ確かめながらもどす */
export function fromAppDoc(doc: Partial<AppDoc> | null | undefined): Snapshot {
  const s = emptySnapshot();
  if (!doc) return s;
  s.stamps = strings(doc.activeDays);
  s.clears = strings(doc.completed);
  for (const [id, item] of Object.entries(doc.inventory ?? {})) {
    if (typeof item?.paid === 'number' && item.paid >= 0) s.cards.push({ id, paid: item.paid });
  }
  for (const [key, points] of Object.entries(doc.spent ?? {})) {
    if (typeof points === 'number' && points > 0) s.spent[key] = points;
  }
  const st = doc.settings ?? {};
  s.settings = {
    mode: st.mode === 'easy' || st.mode === 'standard' ? st.mode : null,
    sound: typeof st.sound === 'boolean' ? st.sound : null,
    at: typeof st.at === 'number' ? st.at : 0,
    daily: isStats(st.daily) ? st.daily : null,
    dailyEasy: isStats(st.dailyEasy) ? st.dailyEasy : null,
  };
  return s;
}

export function toProgressDoc(p: Progress, now: number): ProgressDoc {
  return {
    schema: SCHEMA,
    updatedAt: p.at ?? now,
    status: p.done ? 'done' : 'playing',
    data: { sig: p.sig, cells: p.cells, revealed: p.revealed, hints: p.hints ?? p.revealed.length },
  };
}

export function fromProgressDoc(doc: Partial<ProgressDoc> | null | undefined): Progress | null {
  const d = doc?.data;
  if (!d || typeof d.sig !== 'string' || !Array.isArray(d.cells)) return null;
  return {
    sig: d.sig,
    cells: d.cells.map((c) => (typeof c === 'string' ? c : '')),
    revealed: Array.isArray(d.revealed) ? d.revealed.filter((n): n is number => typeof n === 'number') : [],
    done: doc?.status === 'done',
    hints: typeof d.hints === 'number' ? d.hints : undefined,
    at: typeof doc?.updatedAt === 'number' ? doc.updatedAt : undefined,
  };
}
