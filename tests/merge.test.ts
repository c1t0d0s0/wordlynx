import { describe, expect, it } from 'vitest';
import { mergeCards, mergeProgress, mergeSnapshots, mergeSpent, sameSnapshot } from '../src/core/merge';
import { clearPoints, earnedPoints } from '../src/core/rewards';
import {
  emptySnapshot,
  fromAppDoc,
  fromProgressDoc,
  hasRecords,
  toAppDoc,
  toProgressDoc,
  type Progress,
  type Snapshot,
} from '../src/core/snapshot';

const snap = (part: Partial<Snapshot>): Snapshot => ({ ...emptySnapshot(), ...part });
const prog = (cells: string, part: Partial<Progress> = {}): Progress => ({ sig: 's', cells: [...cells].map((c) => (c === '_' ? '' : c)), revealed: [], done: false, ...part });
/** 残高の計算 (storage.ts の balance と同じ式) */
const balance = (s: Snapshot) =>
  s.clears.reduce((sum, id) => sum + clearPoints(id), 0) +
  earnedPoints(s.stamps).total -
  s.cards.reduce((sum, c) => sum + c.paid, 0) -
  Object.values(s.spent).reduce((a, b) => a + b, 0);

describe('2 か所の記録を合わせる', () => {
  it('スタンプとクリアは、両方を合わせた集合になる', () => {
    const a = snap({ stamps: ['2026-10-01', '2026-10-02'], clears: ['stage-1', 'daily-2026-10-01'] });
    const b = snap({ stamps: ['2026-10-02', '2026-10-03'], clears: ['stage-2', 'stage-1'] });
    const m = mergeSnapshots(a, b);
    expect(m.stamps).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(m.clears).toEqual(['daily-2026-10-01', 'stage-1', 'stage-2']);
  });

  it('カードは両方を合わせ、同じカードは払った額の小さいほう', () => {
    expect(mergeCards([{ id: 'c01', paid: 100 }, { id: 'c03', paid: 300 }], [{ id: 'c01', paid: 40 }, { id: 'c02', paid: 80 }])).toEqual([
      { id: 'c01', paid: 40 },
      { id: 'c02', paid: 80 },
      { id: 'c03', paid: 300 },
    ]);
  });

  it('使ったポイントは、パズルごとに大きいほう (二重に数えない)', () => {
    expect(mergeSpent({ 'stage-1': 20, 'stage-2': 10 }, { 'stage-1': 30, 'stage-3': 10 })).toEqual({ 'stage-1': 30, 'stage-2': 10, 'stage-3': 10 });
  });

  it('途中経過は、クリア済みを優先する', () => {
    const done = prog('あいう', { done: true, at: 1 });
    const playing = prog('あい_', { at: 9 });
    expect(mergeProgress(done, playing).done).toBe(true);
    expect(mergeProgress(playing, done).cells).toEqual(['あ', 'い', 'う']);
  });

  it('どちらも途中なら、字が多く入っているほう', () => {
    const more = prog('あい_', { at: 1 });
    const less = prog('あ__', { at: 9 });
    expect(mergeProgress(more, less).cells).toEqual(['あ', 'い', '']);
    expect(mergeProgress(less, more).cells).toEqual(['あ', 'い', '']);
  });

  it('ヒントの回数は大きいほう (やりなおして字が消えていても、回数はもどらない)', () => {
    const restarted = prog('___', { hints: 6, at: 9 });
    const before = prog('あい_', { hints: 2, revealed: [0, 1], at: 1 });
    expect(mergeProgress(restarted, before).hints).toBe(6);
    expect(mergeProgress(before, restarted).hints).toBe(6);
    // 回数を記録する前の途中経過は、開けたマスの数で数える
    expect(mergeProgress(prog('あ__', { revealed: [0, 1, 2] }), prog('あ__', {})).hints).toBe(3);
  });

  it('問題が作り直されていたら、新しく保存されたほう', () => {
    const old = prog('あいう', { sig: 'old', done: true, at: 1 });
    const fresh = prog('か__', { sig: 'new', at: 5 });
    expect(mergeProgress(old, fresh).sig).toBe('new');
    expect(mergeProgress(fresh, old).sig).toBe('new');
  });

  it('モードと音は、あとから変えたほう。まだえらんでいない項目はおぎなう', () => {
    const a = snap({ settings: { mode: 'easy', sound: null, at: 100, daily: null, dailyEasy: null } });
    const b = snap({ settings: { mode: 'standard', sound: false, at: 50, daily: null, dailyEasy: null } });
    expect(mergeSnapshots(a, b).settings).toMatchObject({ mode: 'easy', sound: false, at: 100 });
    expect(mergeSnapshots(b, a).settings).toMatchObject({ mode: 'easy', sound: false, at: 100 });
  });

  it('今日のパズルの連続日数は、新しい日付のほう', () => {
    const a = snap({ settings: { ...emptySnapshot().settings, daily: { lastDate: '2026-10-05', streak: 3 }, dailyEasy: { lastDate: '2026-10-01', streak: 9 } } });
    const b = snap({ settings: { ...emptySnapshot().settings, daily: { lastDate: '2026-10-03', streak: 8 }, dailyEasy: null } });
    const m = mergeSnapshots(a, b).settings;
    expect(m.daily).toEqual({ lastDate: '2026-10-05', streak: 3 });
    expect(m.dailyEasy).toEqual({ lastDate: '2026-10-01', streak: 9 });
  });
});

describe('合わせる処理の性質', () => {
  // 2 台で別々に遊んだ、少しずつちがう記録
  const a = snap({
    stamps: ['2026-10-01', '2026-10-02', '2026-10-03'],
    clears: ['stage-1', 'daily-2026-10-01'],
    cards: [{ id: 'c01', paid: 40 }],
    spent: { 'stage-1': 10 },
    settings: { mode: 'easy', sound: true, at: 10, daily: { lastDate: '2026-10-03', streak: 3 }, dailyEasy: null },
    progress: { 'stage-1': prog('あいう', { done: true, at: 3 }), 'stage-2': prog('か__', { at: 4 }) },
  });
  const b = snap({
    stamps: ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'],
    clears: ['stage-1', 'stage-9'],
    cards: [{ id: 'c01', paid: 40 }, { id: 'c02', paid: 80 }],
    spent: { 'stage-1': 20, 'stage-2': 10 },
    settings: { mode: 'standard', sound: false, at: 20, daily: null, dailyEasy: { lastDate: '2026-10-07', streak: 5 } },
    progress: { 'stage-2': prog('かき_', { at: 2, hints: 1 }), 'stage-3': prog('さ__', { at: 5 }) },
  });
  const c = snap({ stamps: ['2026-09-30'], clears: ['easy-stage-1'], spent: { 'stage-2': 30 }, progress: { 'stage-3': prog('さしす', { done: true, at: 1 }) } });

  it('同じものを 2 回合わせても変わらない', () => {
    const once = mergeSnapshots(a, b);
    expect(sameSnapshot(mergeSnapshots(once, b), once)).toBe(true);
    expect(sameSnapshot(mergeSnapshots(once, a), once)).toBe(true);
    expect(sameSnapshot(mergeSnapshots(a, a), a)).toBe(true);
  });

  it('入れかえても、合わせる順を変えても、同じ結果になる', () => {
    expect(sameSnapshot(mergeSnapshots(a, b), mergeSnapshots(b, a))).toBe(true);
    const x = mergeSnapshots(mergeSnapshots(a, b), c);
    const y = mergeSnapshots(a, mergeSnapshots(b, c));
    const z = mergeSnapshots(mergeSnapshots(c, a), b);
    expect(sameSnapshot(x, y)).toBe(true);
    expect(sameSnapshot(x, z)).toBe(true);
  });

  it('合わせたあとの残高は、二重にふえない', () => {
    const m = mergeSnapshots(a, b);
    // スタンプは 10/1〜10/7 の 7 日連続で 1000pt。クリアは stage-1 (20)、今日のパズル (20)、stage-9 (200)
    expect(earnedPoints(m.stamps).total).toBe(1000);
    expect(balance(m)).toBe(1000 + 20 + 20 + 200 - (40 + 80) - (20 + 10));
    // 何回合わせても同じ
    expect(balance(mergeSnapshots(mergeSnapshots(m, a), b))).toBe(balance(m));
  });

  it('空の記録と合わせても変わらない', () => {
    expect(sameSnapshot(mergeSnapshots(a, emptySnapshot()), a)).toBe(true);
    expect(hasRecords(emptySnapshot())).toBe(false);
    expect(hasRecords(snap({ settings: { mode: 'easy', sound: true, at: 5, daily: null, dailyEasy: null } }))).toBe(false); // 設定だけ
    expect(hasRecords(snap({ progress: { x: prog('___') } }))).toBe(false); // 何も入れていない途中経過
    expect(hasRecords(snap({ progress: { x: prog('あ__') } }))).toBe(true);
    expect(hasRecords(a)).toBe(true);
  });
});

describe('Firestore の形との変換', () => {
  const s = snap({
    stamps: ['2026-10-01'],
    clears: ['stage-1'],
    cards: [{ id: 'c01', paid: 40 }],
    spent: { 'stage-1': 10 },
    settings: { mode: 'standard', sound: false, at: 7, daily: { lastDate: '2026-10-01', streak: 1 }, dailyEasy: null },
  });

  it('学習アプリ共通の名前で保存する', () => {
    const doc = toAppDoc(s, 1234);
    expect(doc).toEqual({
      schema: 1,
      updatedAt: 1234,
      activeDays: ['2026-10-01'],
      completed: ['stage-1'],
      inventory: { c01: { paid: 40 } },
      spent: { 'stage-1': 10 },
      settings: { mode: 'standard', sound: false, at: 7, daily: { lastDate: '2026-10-01', streak: 1 }, dailyEasy: null },
    });
    // 名前やメールアドレスにあたる項目はない
    expect(JSON.stringify(doc)).not.toMatch(/email|name|photo/i);
  });

  it('保存して読みもどすと、元の記録になる', () => {
    expect(sameSnapshot(fromAppDoc(toAppDoc(s, 1)), s)).toBe(true);
    const p = prog('あい_', { revealed: [1], hints: 3, at: 99 });
    const doc = toProgressDoc(p, 1);
    expect(doc).toMatchObject({ schema: 1, status: 'playing', updatedAt: 99 });
    expect(fromProgressDoc(doc)).toEqual(p);
    expect(toProgressDoc(prog('あいう', { done: true }), 5)).toMatchObject({ status: 'done', updatedAt: 5 });
  });

  it('形がくずれたデータを読んでも、こわれない', () => {
    expect(sameSnapshot(fromAppDoc(null), emptySnapshot())).toBe(true);
    const broken = fromAppDoc({ activeDays: 'x', completed: [1, 'stage-1'], inventory: { c01: { paid: -5 }, c02: null }, spent: { a: 'b' }, settings: { mode: 'hard' } } as never);
    expect(broken.stamps).toEqual([]);
    expect(broken.clears).toEqual(['stage-1']);
    expect(broken.cards).toEqual([]);
    expect(broken.spent).toEqual({});
    expect(broken.settings.mode).toBeNull();
    expect(fromProgressDoc({ status: 'done' })).toBeNull();
    expect(fromProgressDoc({ data: { sig: 1 } } as never)).toBeNull();
  });
});
