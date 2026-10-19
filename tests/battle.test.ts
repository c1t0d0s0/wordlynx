import { describe, expect, it } from 'vitest';
import {
  HINT_PENALTY_MS,
  MAX_PLAYERS,
  NAME_MAX,
  battlePuzzle,
  cleanName,
  everyoneDone,
  formatTime,
  freeSeat,
  isCode,
  makeCode,
  makeSeed,
  parseCode,
  seatOf,
  standings,
  vocabPrint,
  type BattlePlayer,
  type BattleRoom,
} from '../src/core/battle';
import { DAILY_WORDS } from '../src/core/generator';
import { EASY_WORDS, WORDS } from '../src/data/words';
import { BATTLE } from '../src/ui/text';
import { kanjiBeyondGrade3 } from './kanji';

const player = (uid: string, over: Partial<BattlePlayer> = {}): BattlePlayer => ({
  uid,
  name: uid,
  joinedAt: 0,
  online: true,
  round: 1,
  filled: 0,
  total: 40,
  hints: 0,
  ...over,
});

const room = (players: BattlePlayer[], over: Partial<BattleRoom> = {}) => ({
  round: 1,
  startAt: 1_000_000,
  players: Object.fromEntries(players.map((p, i) => [String(i), p])),
  ...over,
});

describe('対戦コード', () => {
  it('数字 5 けたで、0 から始まらない', () => {
    for (let i = 0; i < 2000; i++) expect(isCode(makeCode())).toBe(true);
    expect(makeCode(() => 0)).toBe('10000');
    expect(makeCode(() => 0.999999)).toBe('99999');
    expect(isCode('01234')).toBe(false);
    expect(isCode('1234')).toBe(false);
    expect(isCode('123456')).toBe(false);
  });

  it('打ちこまれたコードの全角数字・空白・ハイフンを許す', () => {
    expect(parseCode(' 12345 ')).toBe('12345');
    expect(parseCode('１２３４５')).toBe('12345');
    expect(parseCode('123-45')).toBe('12345');
    expect(parseCode('12 345')).toBe('12345');
    expect(parseCode('1234a')).toBeNull();
    expect(parseCode('')).toBeNull();
  });
});

describe('対戦用のパズル', () => {
  it('同じ seed なら同じ盤面、ちがう seed なら別の盤面', () => {
    const a = battlePuzzle(WORDS, 'standard', '12345', 1, 'abc');
    const b = battlePuzzle(WORDS, 'standard', '12345', 1, 'abc');
    const c = battlePuzzle(WORDS, 'standard', '12345', 1, 'abd');
    expect(b).toEqual(a);
    expect(c.entries.map((e) => e.answer)).not.toEqual(a.entries.map((e) => e.answer));
    expect(a.size).toBe(10);
    expect(a.entries.length).toBe(DAILY_WORDS.standard);
  });

  it('初級は初級の語彙だけを使う', () => {
    const easy = new Set(EASY_WORDS.map((w) => w.reading));
    for (const seed of ['s1', 's2', 's3', 's4', 's5']) {
      const p = battlePuzzle(EASY_WORDS, 'easy', '12345', 1, seed);
      expect(p.entries.length).toBe(DAILY_WORDS.easy);
      for (const e of p.entries) expect(easy.has(e.word.reading)).toBe(true);
    }
  });

  it('seed はいつも 10 文字の英数字', () => {
    for (let i = 0; i < 100; i++) expect(makeSeed()).toMatch(/^[0-9a-z]{10}$/);
  });
});

describe('語彙の指紋', () => {
  it('語・カギ・例文のどれかが変わると変わる', () => {
    const base = vocabPrint(EASY_WORDS);
    expect(vocabPrint(EASY_WORDS)).toBe(base);
    expect(vocabPrint(EASY_WORDS.slice(1))).not.toBe(base);
    const changed = EASY_WORDS.map((w, i) => (i === 10 ? { ...w, clue: `${w.clue}。` } : w));
    expect(vocabPrint(changed)).not.toBe(base);
    const example = EASY_WORDS.map((w, i) => (i === 20 ? { ...w, examples: [...(w.examples ?? []), '〇〇。'] } : w));
    expect(vocabPrint(example)).not.toBe(base);
    expect(vocabPrint(WORDS)).not.toBe(base);
    expect(base.length).toBeLessThanOrEqual(40);
  });
});

describe('名前', () => {
  it('前後の空白と制御文字を消し、10 文字までにする', () => {
    expect(cleanName('  ヤマネコ  ')).toBe('ヤマネコ');
    expect(cleanName('や\u0000ま\u200bね\nこ')).toBe('やまねこ');
    expect(cleanName('a   b')).toBe('a b');
    expect(cleanName('あいうえおかきくけこさしすせそ')).toBe('あいうえおかきくけこ');
    expect([...cleanName('😀'.repeat(20))].length).toBe(NAME_MAX);
    expect(cleanName('   ')).toBe('');
  });

  it('HTML の記号もそのまま (画面には文字として出す)', () => {
    expect(cleanName('<b>x</b>')).toBe('<b>x</b>');
  });
});

describe('席', () => {
  it('空いている席の番号をさがし、満席なら null', () => {
    expect(freeSeat({ players: {} })).toBe('0');
    expect(freeSeat({ players: { 0: player('a'), 2: player('b') } })).toBe('1');
    const full = Object.fromEntries(Array.from({ length: MAX_PLAYERS }, (_, i) => [String(i), player(`p${i}`)]));
    expect(freeSeat({ players: full })).toBeNull();
    expect(seatOf({ players: { 3: player('x') } }, 'x')).toBe('3');
    expect(seatOf({ players: { 3: player('x') } }, 'y')).toBeNull();
  });
});

describe('タイムと順位', () => {
  it('タイム = 解いた時間 + ヒント × 30 秒', () => {
    const [s] = standings(room([player('a', { finishedAt: 1_000_000 + 95_000, hints: 2 })]));
    expect(s.status).toBe('done');
    expect(s.solveMs).toBe(95_000);
    expect(s.timeMs).toBe(95_000 + 2 * HINT_PENALTY_MS);
    expect(s.rank).toBe(1);
  });

  it('ヒントを使うと、速く解いても順位が下がることがある', () => {
    const rows = standings(
      room([
        player('fast', { finishedAt: 1_000_000 + 60_000, hints: 2 }), // 60 + 60 = 120 秒
        player('slow', { finishedAt: 1_000_000 + 100_000 }), // 100 秒
      ]),
    );
    expect(rows.map((r) => [r.uid, r.rank])).toEqual([
      ['slow', 1],
      ['fast', 2],
    ]);
  });

  it('同じタイムは同じ順位。解いている人はうまったマスの多い順、そのあとリタイア、ぬけた人', () => {
    const rows = standings(
      room([
        player('left', { online: false, filled: 30 }),
        player('retired', { retired: true, filled: 39 }),
        player('few', { filled: 5 }),
        player('b', { finishedAt: 1_000_000 + 50_000 }),
        player('many', { filled: 20 }),
        player('a', { finishedAt: 1_000_000 + 50_000 }),
        player('c', { finishedAt: 1_000_000 + 70_000 }),
      ]),
    );
    expect(rows.map((r) => r.uid)).toEqual(['a', 'b', 'c', 'many', 'few', 'retired', 'left']);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3, null, null, null, null]);
    expect(rows.map((r) => r.status)).toEqual(['done', 'done', 'done', 'playing', 'playing', 'retired', 'left']);
  });

  it('前の回の記録は、今の回では数えない', () => {
    const [s] = standings(room([player('a', { round: 1, finishedAt: 1_000_000 + 10_000, hints: 3, filled: 40 })], { round: 2 }));
    expect(s.status).toBe('playing');
    expect(s.filled).toBe(0);
    expect(s.hints).toBe(0);
    expect(s.timeMs).toBeNull();
  });

  it('解き終わってからぬけた人は、ゴールのまま', () => {
    const [s] = standings(room([player('a', { online: false, finishedAt: 1_000_000 + 10_000 })]));
    expect(s.status).toBe('done');
  });

  it('全員が終わったか', () => {
    expect(everyoneDone(room([player('a', { finishedAt: 1_000_500 }), player('b', { retired: true })]))).toBe(true);
    expect(everyoneDone(room([player('a', { finishedAt: 1_000_500 }), player('b', { online: false })]))).toBe(true);
    expect(everyoneDone(room([player('a', { finishedAt: 1_000_500 }), player('b')]))).toBe(false);
  });
});

describe('タイムの表し方', () => {
  it('分:秒、1 時間をこえたら 時:分:秒', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65_400)).toBe('1:05');
    expect(formatTime(12 * 60_000 + 30_000)).toBe('12:30');
    expect(formatTime(3600_000 + 2 * 60_000 + 3_000)).toBe('1:02:03');
    expect(formatTime(-5)).toBe('0:00');
  });
});

describe('たいせんの文言', () => {
  it('初級の人も読めるよう、3 年生までの漢字だけを使う', () => {
    const texts = Object.values(BATTLE).map((v) => (typeof v === 'function' ? (v as (...a: unknown[]) => string)(3, 2, 30) : v));
    for (const text of texts) expect(kanjiBeyondGrade3(String(text)), String(text)).toEqual([]);
  });
});
