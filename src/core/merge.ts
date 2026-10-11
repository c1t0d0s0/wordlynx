import { normalizeStamps } from './rewards';
import type { DailyStats, OwnedCard, Progress, Settings, Snapshot } from './snapshot';

// 2 か所にある記録 (たとえば、この端末と Firestore) を 1 つに合わせる。
// どの関数も、同じものを 2 回合わせても変わらず、a と b を入れかえても同じ結果になる。
// そのため、何回やっても・どの順でやっても、記録がこわれたり二重にふえたりしない。

/** 決め手がないときに、いつも同じほうをえらぶための比べ方 */
const pickStable = <T>(a: T, b: T): T => (JSON.stringify(a) <= JSON.stringify(b) ? a : b);

const filled = (p: Progress) => p.cells.filter((c) => c !== '').length;
const hintsOf = (p: Progress) => p.hints ?? p.revealed.length;

/**
 * 途中経過: クリア済みを優先。どちらも途中なら、字が多く入っているほう。
 * ヒントの回数は大きいほう (やりなおしても回数はもどさない、という決まりを守る)。
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const base = ((): Progress => {
    // 問題そのものが作り直されているときは、新しく保存されたほう
    if (a.sig !== b.sig) return (a.at ?? 0) !== (b.at ?? 0) ? ((a.at ?? 0) > (b.at ?? 0) ? a : b) : pickStable(a, b);
    if (a.done !== b.done) return a.done ? a : b;
    if (filled(a) !== filled(b)) return filled(a) > filled(b) ? a : b;
    if (a.revealed.length !== b.revealed.length) return a.revealed.length > b.revealed.length ? a : b;
    if ((a.at ?? 0) !== (b.at ?? 0)) return (a.at ?? 0) > (b.at ?? 0) ? a : b;
    return pickStable(a, b);
  })();
  const merged: Progress = { ...base };
  if (a.sig === b.sig) {
    merged.hints = Math.max(hintsOf(a), hintsOf(b));
    const at = Math.max(a.at ?? 0, b.at ?? 0);
    if (at > 0) merged.at = at;
  }
  return merged;
}

/** カード: 両方を合わせる。同じカードは、払った額の小さいほう */
export function mergeCards(a: readonly OwnedCard[], b: readonly OwnedCard[]): OwnedCard[] {
  const paid = new Map<string, number>();
  for (const c of [...a, ...b]) paid.set(c.id, Math.min(c.paid, paid.get(c.id) ?? Infinity));
  return [...paid].map(([id, p]) => ({ id, paid: p })).sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

/** 使ったポイント: パズルごとに、大きいほう */
export function mergeSpent(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) out[key] = Math.max(a[key] ?? 0, b[key] ?? 0);
  return out;
}

/** 今日のパズルの連続日数: 新しい日付のほう。同じ日なら長いほう */
function mergeStats(a: DailyStats | null, b: DailyStats | null): DailyStats | null {
  if (!a || !b) return a ?? b;
  if (a.lastDate !== b.lastDate) return a.lastDate > b.lastDate ? a : b;
  return a.streak >= b.streak ? a : b;
}

/** モードと音: あとから変えたほう */
function mergeSettings(a: Settings, b: Settings): Settings {
  const [newer, older] =
    a.at !== b.at
      ? a.at > b.at
        ? [a, b]
        : [b, a]
      : JSON.stringify([a.mode, a.sound]) <= JSON.stringify([b.mode, b.sound])
        ? [a, b]
        : [b, a];
  return {
    // まだえらんでいない項目 (null) は、もう一方の値でおぎなう
    mode: newer.mode ?? older.mode,
    sound: newer.sound ?? older.sound,
    at: Math.max(a.at, b.at),
    daily: mergeStats(a.daily, b.daily),
    dailyEasy: mergeStats(a.dailyEasy, b.dailyEasy),
  };
}

export function mergeSnapshots(a: Snapshot, b: Snapshot): Snapshot {
  const progress: Record<string, Progress> = {};
  for (const id of [...new Set([...Object.keys(a.progress), ...Object.keys(b.progress)])].sort()) {
    const pa = a.progress[id];
    const pb = b.progress[id];
    progress[id] = pa && pb ? mergeProgress(pa, pb) : (pa ?? pb);
  }
  return {
    stamps: normalizeStamps([...a.stamps, ...b.stamps]),
    clears: [...new Set([...a.clears, ...b.clears])].sort(),
    cards: mergeCards(a.cards, b.cards),
    spent: mergeSpent(a.spent, b.spent),
    settings: mergeSettings(a.settings, b.settings),
    progress,
  };
}

/** 記録の中身が同じか (ならび順のちがいは気にしない) */
export function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

export function sameSummary(a: Snapshot, b: Snapshot): boolean {
  return JSON.stringify({ ...canonical(a), progress: null }) === JSON.stringify({ ...canonical(b), progress: null });
}

function canonical(s: Snapshot): Snapshot {
  return mergeSnapshots(s, s);
}
