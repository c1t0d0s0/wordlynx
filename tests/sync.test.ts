import { beforeEach, describe, expect, it } from 'vitest';
import { Sync, type AuthPort, type Remote, type SyncHooks } from '../src/cloud/sync';
import { mergeSnapshots } from '../src/core/merge';
import { addDays, jstDate } from '../src/core/puzzle';
import { emptySnapshot, type Snapshot } from '../src/core/snapshot';
import {
  addClear,
  addStamp,
  balance,
  buyCard,
  currentUid,
  exportSnapshot,
  getCards,
  getClears,
  getMode,
  getStamps,
  onStorageChange,
  rememberedUid,
  saveProgress,
  setMode,
  spendPoints,
  statusOf,
  useStore,
} from '../src/core/storage';
import { CARDS } from '../src/data/cards';

// ---- 代用品 ----

/** 端末ごとの localStorage。current を入れかえると、別の端末になる */
let current = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => current.get(k) ?? null,
    setItem: (k: string, v: string) => void current.set(k, v),
    removeItem: (k: string) => void current.delete(k),
    key: (i: number) => [...current.keys()][i] ?? null,
    get length() {
      return current.size;
    },
  },
});

/** メモリ上の Firestore。fail を true にすると、通信できない状態になる */
class FakeCloud implements Remote {
  data = new Map<string, Snapshot>();
  fail = false;
  writes = 0;
  reads = 0;
  private check() {
    if (this.fail) throw new Error('offline');
  }
  private copy<T>(v: T): T {
    return JSON.parse(JSON.stringify(v)) as T;
  }
  async loadAll(uid: string) {
    this.check();
    this.reads++;
    const s = this.data.get(uid);
    return s ? this.copy(s) : null;
  }
  async loadSummary(uid: string) {
    this.check();
    this.reads++;
    const s = this.data.get(uid);
    return s ? { ...this.copy(s), progress: {} } : null;
  }
  async saveSummary(uid: string, snapshot: Snapshot) {
    this.check();
    this.writes++;
    const old = this.data.get(uid);
    this.data.set(uid, { ...this.copy(snapshot), progress: old?.progress ?? {} });
  }
  async saveProgress(uid: string, id: string, progress: Snapshot['progress'][string]) {
    this.check();
    this.writes++;
    const s = this.data.get(uid) ?? emptySnapshot();
    s.progress[id] = this.copy(progress);
    this.data.set(uid, s);
  }
  async deleteProgress(uid: string, id: string) {
    this.check();
    this.writes++;
    delete this.data.get(uid)?.progress[id];
  }
}

class FakeAuth implements AuthPort {
  private cb: (uid: string | null) => void = () => {};
  nextUid = 'alice';
  onUser(cb: (uid: string | null) => void) {
    this.cb = cb;
  }
  /** ページを開いたときに、ログインの状態が分かる */
  resolve(uid: string | null) {
    this.cb(uid);
  }
  async signIn() {
    this.cb(this.nextUid);
  }
  async signOut() {
    this.cb(null);
  }
}

interface Device {
  storage: Map<string, string>;
  auth: FakeAuth;
  sync: Sync;
  asked: number;
  dataChanged: number;
  answer: boolean;
}

function makeDevice(cloud: FakeCloud): Device {
  const d = { storage: new Map<string, string>(), auth: new FakeAuth(), asked: 0, dataChanged: 0, answer: true } as Device;
  const hooks: SyncHooks = {
    onStatus: () => {},
    onData: () => void d.dataChanged++,
    askMigrate: () => {
      d.asked++;
      return d.answer;
    },
  };
  d.sync = new Sync(cloud, d.auth, hooks, { debounceMs: 60_000, retryMs: 60_000 });
  return d;
}

/** その端末を手に取る (localStorage と、記録の場所と、書きかえの知らせ先を切りかえる) */
function use(d: Device): void {
  current = d.storage;
  useStore(d.sync.uid);
  d.sync.attach();
}

const done = { sig: 's', cells: ['あ', 'い'], revealed: [], done: true };
const playing = { sig: 's', cells: ['あ', ''], revealed: [], done: false };
const today = jstDate();
const daysBefore = (n: number) => Array.from({ length: n }, (_, i) => addDays(today, -i));

let cloud: FakeCloud;
let a: Device;

beforeEach(() => {
  cloud = new FakeCloud();
  a = makeDevice(cloud);
  onStorageChange(null);
  use(a);
  a.sync.start();
});

describe('ログインしない人', () => {
  it('今までどおり、この端末だけに記録される (Firestore には何も送らない)', async () => {
    a.auth.resolve(null);
    await a.sync.flush();
    expect(a.sync.status).toBe('signed-out');
    addStamp(today);
    addClear('stage-1');
    saveProgress('stage-1', done);
    await a.sync.flush();
    expect(cloud.writes).toBe(0);
    expect(cloud.reads).toBe(0);
    expect(a.sync.hasPending()).toBe(false);
    expect(currentUid()).toBeNull();
    expect(a.storage.has('wordlynx:v1:stamps')).toBe(true);
    expect(balance()).toBe(20);
  });
});

describe('ログインして記録をうつす', () => {
  beforeEach(async () => {
    a.auth.resolve(null);
    await a.sync.flush();
    // ログインなしで遊んだ記録
    for (const d of daysBefore(7)) addStamp(d);
    addClear('stage-1');
    addClear('stage-9');
    saveProgress('stage-1', done);
    saveProgress('stage-2', playing);
    expect(balance()).toBe(1220);
    expect(buyCard(CARDS[0])).toBe(true); // 40pt
  });

  it('「うつす」をえらぶと、Firestore に入り、端末のログインなしの記録は消える', async () => {
    await a.sync.signIn();
    await a.sync.flush();
    expect(a.asked).toBe(1);
    expect(a.sync.status).toBe('synced');
    expect(a.sync.uid).toBe('alice');

    const remote = cloud.data.get('alice')!;
    expect(remote.stamps).toHaveLength(7);
    expect(remote.clears).toEqual(['stage-1', 'stage-9']);
    expect(remote.cards).toEqual([{ id: 'c01', paid: 40 }]);
    expect(remote.progress['stage-1'].done).toBe(true);
    expect(remote.progress['stage-2'].cells).toEqual(['あ', '']);

    // 画面は、その人の記録を見ている
    expect(currentUid()).toBe('alice');
    expect(balance()).toBe(1180);
    expect(statusOf('stage-1')).toBe('done');
    expect(statusOf('stage-2')).toBe('playing');
    // ログインなしの記録は残っていない (もう一度ログインしても、二重にうつらない)
    expect([...a.storage.keys()].filter((k) => k.startsWith('wordlynx:v1:'))).toEqual([]);
    expect(rememberedUid()).toBe('alice');
  });

  it('「うつさない」をえらぶと、端末の記録はそのままで、アカウントの記録だけになる', async () => {
    a.answer = false;
    await a.sync.signIn();
    await a.sync.flush();
    expect(a.asked).toBe(1);
    expect(currentUid()).toBe('alice');
    expect(getStamps()).toEqual([]);
    expect(balance()).toBe(0);
    expect(cloud.data.get('alice')?.stamps ?? []).toEqual([]);
    // ログアウトすると、ログインなしの記録にもどる
    expect(await a.sync.signOut()).toBe('ok');
    await a.sync.flush();
    expect(currentUid()).toBeNull();
    expect(getStamps()).toHaveLength(7);
    expect(balance()).toBe(1180);
  });

  it('アカウントにすでに記録があるときは、両方を合わせる', async () => {
    cloud.data.set('alice', { ...emptySnapshot(), stamps: [addDays(today, -7), addDays(today, -8)], clears: ['stage-1', 'stage-3'], cards: [{ id: 'c02', paid: 80 }] });
    await a.sync.signIn();
    await a.sync.flush();
    expect(getStamps()).toHaveLength(9);
    expect(getClears().sort()).toEqual(['stage-1', 'stage-3', 'stage-9']);
    expect(getCards().map((c) => c.id).sort()).toEqual(['c01', 'c02']);
    // 9 日連続で 1000pt、クリアは 20 + 20 + 200、カードに 40 + 80
    expect(balance()).toBe(1000 + 240 - 120);
    expect(cloud.data.get('alice')!.stamps).toHaveLength(9);
  });

  it('ページを開き直したとき (ログインが続いているとき) は、うつすかどうかを聞かない', async () => {
    a.answer = false;
    await a.sync.signIn();
    await a.sync.flush();
    expect(a.asked).toBe(1);
    // 同じ端末でページを開き直す: ログインの状態が、ボタンをおさずに分かる
    const again = makeDevice(cloud);
    again.storage = a.storage;
    use(again);
    useStore(rememberedUid()); // main.ts の restoreStore と同じ
    again.sync.start();
    again.auth.resolve('alice');
    await again.sync.flush();
    expect(again.asked).toBe(0);
    expect(again.sync.status).toBe('synced');
    // 写しがそのまま使われるので、画面のかき直しは起きない
    expect(again.dataChanged).toBe(0);
  });
});

describe('ブラウザを変えても記録が続く', () => {
  it('端末 A で遊んだ記録が、端末 B でログインすると出てくる', async () => {
    await a.sync.signIn();
    await a.sync.flush();
    for (const d of daysBefore(7)) addStamp(d);
    addClear(`daily-${today}`);
    saveProgress('stage-3', playing);
    setMode('standard');
    expect(buyCard(CARDS[1])).toBe(true); // 80pt
    expect(a.sync.status).toBe('syncing');
    await a.sync.flush();
    expect(a.sync.status).toBe('synced');
    const onA = balance();

    const b = makeDevice(cloud);
    use(b);
    b.sync.start();
    b.auth.resolve(null);
    await b.sync.flush();
    expect(getStamps()).toEqual([]);
    await b.sync.signIn();
    await b.sync.flush();
    expect(b.asked).toBe(0); // B にはログインなしの記録がないので、聞かれない
    expect(getStamps()).toHaveLength(7);
    expect(balance()).toBe(onA);
    expect(getCards()).toEqual([{ id: 'c02', paid: 80 }]);
    expect(statusOf('stage-3')).toBe('playing');
    expect(getMode()).toBe('standard');
    expect(b.dataChanged).toBeGreaterThan(0);
  });

  it('2 台で別々に遊んでも、どちらの記録も残る', async () => {
    await a.sync.signIn();
    await a.sync.flush();
    const b = makeDevice(cloud);
    use(b);
    b.sync.start();
    await b.sync.signIn();
    await b.sync.flush();

    // B でステージ 2 をクリアし、ヒントに 10pt 使う
    addClear('stage-2');
    addClear('stage-9');
    saveProgress('stage-2', done);
    expect(spendPoints(10, 'stage-2')).toBe(true);
    // その間に、A でステージ 1 をクリアし、スタンプを押す (まだ B の変更を知らない)
    use(a);
    addClear('stage-1');
    addStamp(today);
    saveProgress('stage-1', done);
    await a.sync.flush();
    use(b);
    await b.sync.flush();

    // B は、送るときに A の分を取りこんでいる
    expect(getClears().sort()).toEqual(['stage-1', 'stage-2', 'stage-9']);
    expect(getStamps()).toEqual([today]);
    expect(balance()).toBe(20 + 20 + 200 - 10);
    const remote = cloud.data.get('alice')!;
    expect(remote.clears).toEqual(['stage-1', 'stage-2', 'stage-9']);
    expect(remote.spent).toEqual({ 'stage-2': 10 });
    expect(Object.keys(remote.progress).sort()).toEqual(['stage-1', 'stage-2']);

    // A は、次に何かを送ったときに B の分を取りこむ
    use(a);
    expect(getClears().sort()).toEqual(['stage-1']);
    setMode('easy');
    await a.sync.flush();
    expect(getClears().sort()).toEqual(['stage-1', 'stage-2', 'stage-9']);
    expect(balance()).toBe(20 + 20 + 200 - 10);
  });

  it('前の日までの今日のパズルの途中経過は、取りこまずに Firestore からも消す', async () => {
    const old = `daily-${addDays(today, -1)}`;
    cloud.data.set('alice', { ...emptySnapshot(), progress: { [old]: done, [`daily-${today}`]: playing, 'stage-1': done } });
    await a.sync.signIn();
    await a.sync.flush();
    expect(Object.keys(exportSnapshot().progress).sort()).toEqual([`daily-${today}`, 'stage-1']);
    expect(Object.keys(cloud.data.get('alice')!.progress).sort()).toEqual([`daily-${today}`, 'stage-1']);
  });
});

describe('通信できないとき', () => {
  it('手元の写しで遊べて、つながったら送る', async () => {
    await a.sync.signIn();
    await a.sync.flush();
    cloud.fail = true;
    addStamp(today);
    addClear('stage-1');
    saveProgress('stage-1', done);
    await a.sync.flush();
    expect(a.sync.status).toBe('offline');
    expect(a.sync.hasPending()).toBe(true);
    expect(balance()).toBe(20); // 手元では進んでいる
    expect(cloud.data.get('alice')?.clears ?? []).toEqual([]);

    cloud.fail = false;
    await a.sync.flush();
    expect(a.sync.status).toBe('synced');
    expect(a.sync.hasPending()).toBe(false);
    expect(cloud.data.get('alice')!.clears).toEqual(['stage-1']);
    expect(cloud.data.get('alice')!.progress['stage-1'].done).toBe(true);
  });

  it('ログインした直後に通信できなくても、あとで記録がうつる (うつす前に、端末の記録は消さない)', async () => {
    a.auth.resolve(null);
    await a.sync.flush();
    addClear('stage-1');
    addClear('stage-2');
    cloud.fail = true;
    await a.sync.signIn();
    await a.sync.flush();
    expect(a.sync.status).toBe('offline');
    expect(a.storage.has('wordlynx:v1:clears')).toBe(true); // まだ消していない
    cloud.fail = false;
    await a.sync.flush();
    expect(a.sync.status).toBe('synced');
    expect(cloud.data.get('alice')!.clears).toEqual(['stage-1', 'stage-2']);
    expect(getClears().sort()).toEqual(['stage-1', 'stage-2']);
    expect(a.storage.has('wordlynx:v1:clears')).toBe(false);
  });
});

describe('ログアウト', () => {
  it('この端末から、その人の写しが消える', async () => {
    await a.sync.signIn();
    await a.sync.flush();
    addClear('stage-1');
    saveProgress('stage-1', done);
    expect(await a.sync.signOut()).toBe('ok');
    await a.sync.flush();
    expect(a.sync.status).toBe('signed-out');
    expect(currentUid()).toBeNull();
    expect(rememberedUid()).toBeNull();
    expect([...a.storage.keys()].filter((k) => k.startsWith('wordlynx:u:'))).toEqual([]);
    expect(getClears()).toEqual([]);
    // 送ってからログアウトしているので、Firestore には残っている
    expect(cloud.data.get('alice')!.clears).toEqual(['stage-1']);
  });

  it('送れていない変更があるときは、たしかめてからでないとログアウトしない', async () => {
    await a.sync.signIn();
    await a.sync.flush();
    cloud.fail = true;
    addClear('stage-1');
    expect(await a.sync.signOut()).toBe('unsynced');
    expect(a.sync.uid).toBe('alice');
    expect(getClears()).toEqual(['stage-1']); // まだ手元にある
    expect(await a.sync.signOut(true)).toBe('ok');
    await a.sync.flush();
    expect(currentUid()).toBeNull();
  });

  it('別の人がログインしても、前の人の記録は見えない', async () => {
    await a.sync.signIn();
    await a.sync.flush();
    addClear('stage-1');
    await a.sync.signOut();
    await a.sync.flush();
    a.auth.nextUid = 'bob';
    await a.sync.signIn();
    await a.sync.flush();
    expect(currentUid()).toBe('bob');
    expect(getClears()).toEqual([]);
    expect(cloud.data.get('alice')!.clears).toEqual(['stage-1']);
    expect(cloud.data.get('bob')?.clears ?? []).toEqual([]);
  });
});

it('代用品の合わせ方が、本物の決まりと同じであること', () => {
  // FakeCloud は「書かれたものをそのまま持つ」だけで、合わせる処理は Sync の側にある
  const x = { ...emptySnapshot(), clears: ['a'] };
  const y = { ...emptySnapshot(), clears: ['b'] };
  expect(mergeSnapshots(x, y).clears).toEqual(['a', 'b']);
});
