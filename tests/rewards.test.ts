import { beforeEach, describe, expect, it } from 'vitest';
import { addDays } from '../src/core/puzzle';
import { currentRun, earnedPoints, monthView, rewardFor } from '../src/core/rewards';
import { addClear, addStamp, balance, buyCard, getCards, getClears, getMode, getStamps, migrateMode, migrateRewards, setMode, recordDailyClear, spendPoints } from '../src/core/storage';
import { CARDS } from '../src/data/cards';
import { kanjiBeyondGrade3 } from './kanji';

/** start から n 日ぶんの連続した日付 */
const days = (start: string, n: number) => Array.from({ length: n }, (_, i) => addDays(start, i));

// テスト用の localStorage
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  },
});
beforeEach(() => store.clear());

describe('ポイントの計算', () => {
  it('7 日連続するたびに 1000pt', () => {
    expect(earnedPoints(days('2026-10-05', 6)).total).toBe(0);
    expect(earnedPoints(days('2026-10-05', 7)).total).toBe(1000);
    expect(earnedPoints(days('2026-10-05', 13)).total).toBe(1000);
    expect(earnedPoints(days('2026-10-05', 14)).total).toBe(2000);
  });

  it('とぎれたら数え直す', () => {
    const gap = [...days('2026-10-05', 6), ...days('2026-10-12', 6)]; // 10/11 がぬけている
    expect(earnedPoints(gap).total).toBe(0);
    expect(earnedPoints([...gap, '2026-10-11']).total).toBe(1000); // うめると 13 日連続
    expect(earnedPoints([...days('2026-10-01', 7), ...days('2026-10-10', 7)]).total).toBe(2000);
  });

  it('1 か月すべてそろうと +5000pt (月ごとに数える)', () => {
    const october = days('2026-10-01', 31);
    expect(earnedPoints(october)).toEqual({ weeks: 4, months: ['2026-10'], total: 9000 });
    expect(earnedPoints(october.slice(1)).months).toEqual([]); // 10/1 がない
    expect(earnedPoints(october.slice(0, 30)).months).toEqual([]); // 10/31 がない
    // 10/15 から 31 日つづけても、どの月もそろっていない
    expect(earnedPoints(days('2026-10-15', 31))).toEqual({ weeks: 4, months: [], total: 4000 });
  });

  it('月の長さがちがっても正しい', () => {
    expect(earnedPoints(days('2026-11-01', 30)).months).toEqual(['2026-11']);
    expect(earnedPoints(days('2026-02-01', 28)).months).toEqual(['2026-02']);
    expect(earnedPoints(days('2028-02-01', 28)).months).toEqual([]); // うるう年は 29 日まで
    expect(earnedPoints(days('2028-02-01', 29)).months).toEqual(['2028-02']);
  });

  it('月や年をまたいで続く', () => {
    // 12/1 から 62 日 = 12 月と 1 月がそろい、7 日連続が 8 回
    expect(earnedPoints(days('2026-12-01', 62))).toEqual({ weeks: 8, months: ['2026-12', '2027-01'], total: 18000 });
    expect(earnedPoints(days('2026-12-29', 7)).total).toBe(1000);
  });

  it('同じ日が重なっていても、順番がばらばらでも同じ結果', () => {
    const d = days('2026-10-05', 7);
    expect(earnedPoints([...d, ...d].reverse()).total).toBe(1000);
  });

  it('つづいている日数', () => {
    const d = days('2026-10-05', 3); // 10/5〜10/7
    expect(currentRun(d, '2026-10-07')).toBe(3);
    expect(currentRun(d, '2026-10-08')).toBe(3); // 今日がまだでも、きのうまで続いている
    expect(currentRun(d, '2026-10-09')).toBe(0);
    expect(monthView(d, '2026-10').map((on, i) => (on ? i + 1 : 0)).filter(Boolean)).toEqual([5, 6, 7]);
    expect(monthView(d, '2026-10')).toHaveLength(31);
  });

  it('スタンプを足したときにもらえる分', () => {
    const six = days('2026-10-05', 6);
    expect(rewardFor(six, '2026-10-11')).toEqual({ added: true, run: 7, weekPoints: 1000, monthPoints: 0 });
    expect(rewardFor(six, '2026-10-10')).toEqual({ added: false, run: 6, weekPoints: 0, monthPoints: 0 });
    // 月の最後の日: 31 日目は 7 の倍数ではないので月の分だけ
    expect(rewardFor(days('2026-10-01', 30), '2026-10-31')).toEqual({ added: true, run: 31, weekPoints: 0, monthPoints: 5000 });
    // 2 月 28 日: 28 日目なので週の分と月の分の両方
    expect(rewardFor(days('2026-02-01', 27), '2026-02-28')).toEqual({ added: true, run: 28, weekPoints: 1000, monthPoints: 5000 });
  });
});

describe('スタンプとカードの保存', () => {
  it('同じ日に 2 回クリアしてもスタンプは 1 個', () => {
    expect(addStamp('2026-10-09').added).toBe(true);
    expect(addStamp('2026-10-09').added).toBe(false);
    expect(getStamps()).toEqual(['2026-10-09']);
  });

  it('7 日目のスタンプで 1000pt たまる', () => {
    days('2026-10-03', 6).forEach((d) => addStamp(d));
    expect(balance()).toBe(0);
    expect(addStamp('2026-10-09')).toMatchObject({ added: true, run: 7, weekPoints: 1000 });
    expect(balance()).toBe(1000);
    expect(addStamp('2026-10-09').weekPoints).toBe(0);
    expect(balance()).toBe(1000);
  });

  it('カードと交換するとポイントがへる', () => {
    days('2026-10-03', 7).forEach((d) => addStamp(d));
    const [cheap, next] = CARDS;
    expect(buyCard(next)).toBe(true); // 1000pt
    expect(balance()).toBe(0);
    expect(buyCard(cheap)).toBe(false); // 足りない
    expect(buyCard(next)).toBe(false); // もう持っている
    expect(getCards()).toEqual([{ id: next.id, paid: 1000 }]);
  });

  it('100pt のカードは 1000pt から交換でき、900pt のこる', () => {
    days('2026-10-03', 7).forEach((d) => addStamp(d));
    expect(buyCard(CARDS[0])).toBe(true);
    expect(balance()).toBe(900);
    expect(buyCard(CARDS[0])).toBe(false);
    expect(balance()).toBe(900);
  });

  it('これまでの連続クリアをスタンプとして引きつぐ', () => {
    for (const d of days('2026-10-01', 9)) recordDailyClear(d, 'standard'); // 上級 9 日連続
    for (const d of days('2026-10-08', 3)) recordDailyClear(d, 'easy'); // 初級 10/8〜10/10
    expect(getStamps()).toEqual([]);
    migrateRewards();
    expect(getStamps()).toEqual(days('2026-10-01', 10));
    // 10 日連続で 1000pt と、10 日分のクリアで 200pt
    expect(balance()).toBe(1200);
    // 引きつぎは最初の 1 回だけ
    recordDailyClear('2026-10-11', 'easy');
    migrateRewards();
    expect(getStamps()).toEqual(days('2026-10-01', 10));
    expect(balance()).toBe(1200);
  });
});

describe('クリアのポイント', () => {
  it('パズルを 1 つクリアすると 20pt。同じパズルは 1 回だけ', () => {
    expect(balance()).toBe(0);
    expect(addClear('stage-1')).toBe(20);
    expect(balance()).toBe(20);
    expect(addClear('stage-1')).toBe(0); // やりなおしてもう一度クリアしても増えない
    expect(balance()).toBe(20);
    expect(addClear('easy-stage-1')).toBe(20); // 初級のステージは別のパズル
    expect(addClear('daily-2026-10-09')).toBe(20);
    expect(addClear('daily-easy-2026-10-09')).toBe(20);
    expect(addClear('daily-2026-10-10')).toBe(20); // 次の日の今日のパズル
    expect(balance()).toBe(100);
  });

  it('チャレンジ (ステージ 9・10) は 200pt。初級も上級も同じ', () => {
    expect(addClear('stage-8')).toBe(20);
    expect(addClear('stage-9')).toBe(200);
    expect(addClear('stage-10')).toBe(200);
    expect(addClear('easy-stage-9')).toBe(200);
    expect(addClear('easy-stage-10')).toBe(200);
    expect(addClear('easy-stage-1')).toBe(20);
    expect(addClear('stage-9')).toBe(0); // 2 回目はもらえない
    expect(balance()).toBe(840);
  });

  it('スタンプのポイントと合わせてたまり、カードと交換できる', () => {
    for (const d of days('2026-10-03', 7)) {
      addStamp(d);
      addClear(`daily-${d}`);
    }
    expect(balance()).toBe(1000 + 7 * 20);
    expect(buyCard(CARDS[1])).toBe(true); // 1000pt
    expect(buyCard(CARDS[0])).toBe(true); // 100pt
    expect(balance()).toBe(40);
  });

  it('5 つクリアすれば、スタンプがなくても 100pt のカードと交換できる', () => {
    for (let i = 1; i <= 4; i++) addClear(`stage-${i}`);
    expect(buyCard(CARDS[0])).toBe(false); // 80pt
    addClear('stage-5');
    expect(buyCard(CARDS[0])).toBe(true);
    expect(balance()).toBe(0);
  });

  it('これまでにクリアした分を引きつぐ', () => {
    const done = JSON.stringify({ sig: 'x', cells: ['あ'], revealed: [], done: true });
    const playing = JSON.stringify({ sig: 'x', cells: ['あ'], revealed: [], done: false });
    store.set('wordlynx:v1:progress:stage-1', done);
    store.set('wordlynx:v1:progress:easy-stage-3', done);
    store.set('wordlynx:v1:progress:stage-2', playing);
    store.set('wordlynx:v1:progress:daily-easy-2026-10-09', done); // 今日は初級でクリア
    store.set('wordlynx:v1:stamps', JSON.stringify(['2026-10-07', '2026-10-08', '2026-10-09']));
    expect(getClears()).toEqual([]);
    migrateRewards();
    expect(getClears()).toEqual(['daily-2026-10-07', 'daily-2026-10-08', 'daily-easy-2026-10-09', 'easy-stage-3', 'stage-1']);
    expect(balance()).toBe(100);
    expect(addClear('daily-easy-2026-10-09')).toBe(0); // もうもらっている
    expect(addClear('daily-2026-10-09')).toBe(20); // 今日の上級はまだ
    expect(addClear('stage-2')).toBe(20);
  });
});

describe('ヒントに使うポイント', () => {
  it('持っている分だけ使える', () => {
    expect(spendPoints(10)).toBe(false); // 0pt
    addClear('stage-1'); // 20pt
    expect(spendPoints(10)).toBe(true);
    expect(balance()).toBe(10);
    expect(spendPoints(10)).toBe(true);
    expect(balance()).toBe(0);
    expect(spendPoints(10)).toBe(false);
    expect(balance()).toBe(0);
  });

  it('ヒントに使った分は、カードの交換にも使えない', () => {
    for (let i = 1; i <= 5; i++) addClear(`stage-${i}`); // 100pt
    expect(spendPoints(10)).toBe(true);
    expect(buyCard(CARDS[0])).toBe(false); // 90pt では 100pt のカードに足りない
    addClear('stage-6');
    expect(buyCard(CARDS[0])).toBe(true);
    expect(balance()).toBe(10);
  });
});

describe('はじめて遊ぶ人', () => {
  it('はじめは初級がえらばれている', () => {
    migrateMode();
    migrateRewards();
    expect(getMode()).toBe('easy');
    // 次に開いたときも初級のまま (スタンプなどの記録が書かれたあとでも、上級に変わらない)
    migrateMode();
    migrateRewards();
    expect(getMode()).toBe('easy');
    setMode('standard');
    expect(getMode()).toBe('standard');
    migrateMode();
    expect(getMode()).toBe('standard'); // えらんだあとは変わらない
    setMode('easy');
    expect(getMode()).toBe('easy');
  });

  it('前から遊んでいて、モードをえらんだことがない人は上級のまま', () => {
    store.set('wordlynx:v1:progress:stage-1', JSON.stringify({ sig: 'x', cells: ['あ'], revealed: [], done: false }));
    migrateMode();
    migrateRewards();
    expect(getMode()).toBe('standard');
  });

  it('前から初級をえらんでいた人は初級のまま', () => {
    store.set('wordlynx:v1:mode', JSON.stringify('easy'));
    store.set('wordlynx:v1:progress:easy-stage-1', JSON.stringify({ sig: 'x', cells: ['あ'], revealed: [], done: true }));
    migrateMode();
    expect(getMode()).toBe('easy');
  });

  it('最初のクリアでスタンプと 20pt がその場でもらえる (引きつぎに先取りされない)', () => {
    migrateRewards(); // アプリを開いたとき
    recordDailyClear('2026-10-09', 'standard');
    store.set('wordlynx:v1:progress:daily-2026-10-09', JSON.stringify({ sig: 'x', cells: ['あ'], revealed: [], done: true }));
    expect(addStamp('2026-10-09').added).toBe(true);
    expect(addClear('daily-2026-10-09')).toBe(20);
    expect(balance()).toBe(20);
  });
});

describe('カード', () => {
  it('20 種類で、id と名前が重複しない', () => {
    expect(CARDS).toHaveLength(20);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(20);
    expect(new Set(CARDS.map((c) => c.name)).size).toBe(20);
  });

  it('100pt は 1 枚だけで、だんだん高くなり、いちばん高いのは 10000pt', () => {
    const prices = CARDS.map((c) => c.price);
    expect(prices[0]).toBe(100);
    expect(prices.filter((p) => p === 100)).toHaveLength(1);
    expect(prices[1]).toBe(1000);
    expect(prices[prices.length - 1]).toBe(10000);
    for (let i = 1; i < prices.length; i++) expect(prices[i]).toBeGreaterThan(prices[i - 1]);
  });

  it('見た目がすべてちがう', () => {
    expect(new Set(CARDS.map((c) => JSON.stringify([c.look, c.bg]))).size).toBe(20);
  });

  it('名前の漢字は 3 年生まで', () => {
    for (const c of CARDS) expect(kanjiBeyondGrade3(c.name), c.name).toEqual([]);
  });
});
