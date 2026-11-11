import { describe, expect, it } from 'vitest';
import {
  CLUE_MAX,
  CUSTOM_MAX_WORDS,
  CUSTOM_SIZE,
  EXAMPLE_MAX,
  JSON_MAX,
  PAYLOAD_MAX,
  buildCustom,
  decodeCustom,
  encodeCustom,
  parseDraft,
  validateDraft,
  type CustomWord,
} from '../src/core/custom';
import { entryCells, solutionGrid } from '../src/core/puzzle';

const word = (reading: string, clue = 'カギ', example = ''): CustomWord => ({ reading, clue, example });
const draft = (...words: CustomWord[]) => ({ title: 'どうぶつ', words });

const ANIMALS = [
  word('らいおん', '百獣(ひゃくじゅう)の王', '〇〇がほえる。'),
  word('りす', 'どんぐりがすき'),
  word('すいか', '夏のくだもの'),
  word('かめ', 'こうらがある'),
  word('めだか', '小さな魚'),
  word('いるか', '海でジャンプする'),
];

/** JSON を、圧縮なしの形 ("0" + base64url) の payload にする */
const raw = (data: unknown) => `0${Buffer.from(JSON.stringify(data), 'utf8').toString('base64url')}`;
/** JSON を、圧縮した形 ("1" + base64url) の payload にする */
async function packed(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return `1${Buffer.from(await new Response(stream).arrayBuffer()).toString('base64url')}`;
}
const wire = (w: unknown[], t = '') => ({ v: 1, t, w });

describe('入れた言葉の確かめ', () => {
  it('カタカナはひらがなにし、空白を取り、何も書いていない行はとばす', () => {
    const check = validateDraft(draft(word(' ライオン '), word('', '', ''), word('しゃしん'), word('りす')));
    expect(check.errors).toEqual([]);
    expect(check.count).toBeNull();
    expect(check.words.map((w) => w.reading)).toEqual(['らいおん', 'しゃしん', 'りす']);
  });

  it('ひらがな・カタカナ以外の字、長さ、重複、カギなしを見つける', () => {
    const check = validateDraft(
      draft(word('漢字'), word('abc'), word('あ'), word('あいうえおかきくけ'), word('りす'), word('リス'), word('かめ', ' '), word('', 'カギだけ'), word('<b>')),
    );
    expect(check.errors).toEqual([
      { row: 0, error: 'reading-chars' },
      { row: 1, error: 'reading-chars' },
      { row: 2, error: 'reading-length' },
      { row: 3, error: 'reading-length' },
      { row: 5, error: 'reading-dup' },
      { row: 6, error: 'clue-empty' },
      { row: 7, error: 'reading-empty' },
      { row: 8, error: 'reading-chars' },
    ]);
  });

  it('小さい字は大きい字と同じ言葉として数える (盤面では同じになるので)', () => {
    expect(validateDraft(draft(word('きょう'), word('きよう'), word('りす'))).errors).toEqual([{ row: 1, error: 'reading-dup' }]);
  });

  it('言葉の数', () => {
    expect(validateDraft(draft(word('りす'), word('かめ'))).count).toBe('few');
    const many = Array.from({ length: CUSTOM_MAX_WORDS + 1 }, (_, i) => word(`あ${'かきくけこさしすせそたちつてとなに'[i]}い`));
    expect(validateDraft(draft(...many)).count).toBe('many');
  });

  it('カギと題名は、制御文字を消して長さを切る', () => {
    const check = validateDraft({ title: `た\u0000${'い'.repeat(50)}`, words: [word('りす', `か\n${'ぎ'.repeat(80)}`), word('かめ'), word('すいか')] });
    expect([...check.title]).toHaveLength(20);
    expect(check.words[0].clue).toBe(`か${'ぎ'.repeat(CLUE_MAX - 1)}`);
  });

  it('保存してあった下書きは、形がちがっていても読める', () => {
    expect(parseDraft(null)).toEqual({ title: '', words: [] });
    expect(parseDraft({ title: 3, words: [null, { reading: 'りす', clue: 5 }, 'x'] })).toEqual({
      title: '',
      words: [word('', ''), word('りす', ''), word('', '')],
    });
    expect(parseDraft({ words: new Array(100).fill(word('りす')) }).words).toHaveLength(CUSTOM_MAX_WORDS);
  });
});

describe('盤面への自動配置', () => {
  it('入った言葉と入らなかった言葉を合わせると、入れた言葉になる。交わるマスの字は同じ', () => {
    const words = [...ANIMALS, word('ぴぽ', 'どこにもつながらない')];
    const { puzzle, unplaced } = buildCustom(words);
    expect(puzzle.size).toBe(CUSTOM_SIZE);
    expect(unplaced.map((w) => w.reading)).toEqual(['ぴぽ']);
    expect(puzzle.entries.map((e) => e.word.reading).sort()).toEqual(ANIMALS.map((w) => w.reading).sort());
    const grid = solutionGrid(puzzle);
    for (const e of puzzle.entries) {
      entryCells(e, puzzle.size).forEach((c, i) => expect(grid[c]).toBe(e.answer[i]));
      expect(e.word.pos).toBe('');
    }
  });

  it('同じ言葉・同じ回数なら同じならび。回数を変えると、ちがうならびも出る', () => {
    const layout = (tryNo: number) => buildCustom(ANIMALS, tryNo).puzzle.entries.map((e) => `${e.word.reading}${e.dir[0]}${e.row}.${e.col}`).join('|');
    expect(layout(0)).toBe(layout(0));
    expect(new Set([0, 1, 2, 3, 4, 5].map(layout)).size).toBeGreaterThan(1);
  });

  it('小さい字のある言葉は、盤面では大きい字で入る', () => {
    const { puzzle } = buildCustom([word('しゃしん'), word('しか'), word('やま')]);
    const e = puzzle.entries.find((x) => x.word.reading === 'しゃしん')!;
    expect(e.answer).toBe('しやしん');
  });
});

describe('シェア用の URL', () => {
  it('URL にして、もどすと、同じパズルになる', async () => {
    const { puzzle } = buildCustom(ANIMALS);
    const payload = await encodeCustom('どうぶつ', puzzle);
    expect(payload).toMatch(/^1[\w-]+$/);
    const back = await decodeCustom(payload);
    expect(back?.title).toBe('どうぶつ');
    expect(back?.puzzle.entries).toEqual(puzzle.entries);
    expect(back?.puzzle.id).toMatch(/^custom-[0-9a-z]+$/);
    // 同じ中身なら、何回開いても同じ id (途中経過が続きから出る)
    expect((await decodeCustom(payload))?.puzzle.id).toBe(back?.puzzle.id);
  });

  it('圧縮していない形も読めて、同じ id になる。中身がちがえば id もちがう', async () => {
    const { puzzle } = buildCustom(ANIMALS);
    const a = await decodeCustom(await encodeCustom('どうぶつ', puzzle));
    const b = await decodeCustom(await encodeCustom('どうぶつ', puzzle, false));
    const c = await decodeCustom(await encodeCustom('べつの名前', puzzle));
    expect((await encodeCustom('どうぶつ', puzzle, false))[0]).toBe('0');
    expect(b).toEqual(a);
    expect(c?.puzzle.id).not.toBe(a?.puzzle.id);
  });

  it('言葉とカギをいっぱいまで入れても、URL に入る', async () => {
    const kana = 'あいうえおかきくけこさしすせそたちつてと';
    const words = Array.from({ length: CUSTOM_MAX_WORDS }, (_, i) =>
      word([...kana].map((_, j) => kana[(i * 3 + j * 7) % kana.length]).slice(0, 8).join(''), kana[i].repeat(CLUE_MAX), `${kana[i + 1]}`.repeat(EXAMPLE_MAX)),
    );
    // ならべ方によらず、いちばん大きくなる形 (16 語ぜんぶ) を、じかに URL にする
    const entries = words.map((w, i) => ({ num: i + 1, dir: 'across' as const, row: i % 10, col: 0, answer: w.reading, word: { ...w, kanji: '', pos: '' as const } }));
    const payload = await encodeCustom('あ'.repeat(20), { id: 'x', size: CUSTOM_SIZE, entries });
    expect(payload.length).toBeLessThanOrEqual(PAYLOAD_MAX);
    expect((await encodeCustom('あ'.repeat(20), { id: 'x', size: CUSTOM_SIZE, entries }, false)).length).toBeGreaterThan(payload.length);
  });

  it('正しい形のデータは読める (下のこわれたデータとのくらべ用)', async () => {
    const ok = wire([['りす', 'カギ', '', 0, 0, 0], ['すいか', 'カギ', '〇〇を食べる。', 0, 1, 1]], '名前');
    const found = await decodeCustom(raw(ok));
    expect(found?.puzzle.entries.map((e) => [e.num, e.dir, e.answer])).toEqual([[1, 'across', 'りす'], [2, 'down', 'すいか']]);
    expect(await decodeCustom(await packed(JSON.stringify(ok)))).toEqual(found);
  });

  it('こわれたデータ・決まりに合わないデータは null', async () => {
    const good = ['りす', 'カギ', '', 0, 0, 0];
    const bad: unknown[] = [
      null,
      [],
      { v: 2, t: '', w: [good] },
      { v: 1, t: 5, w: [good] },
      { v: 1, t: 'あ'.repeat(21), w: [good] },
      wire([]),
      wire(new Array(CUSTOM_MAX_WORDS + 1).fill(good)),
      wire([good.slice(0, 5)]),
      wire([[...good, 0]]),
      wire([['<img src=x onerror=alert(1)>', 'カギ', '', 0, 0, 0]]),
      wire([['リス', 'カギ', '', 0, 0, 0]]), // カタカナのままは通さない
      wire([['り', 'カギ', '', 0, 0, 0]]),
      wire([['あいうえおかきくけ', 'カギ', '', 0, 0, 0]]),
      wire([['りす', '', '', 0, 0, 0]]),
      wire([['りす', 'あ'.repeat(CLUE_MAX + 1), '', 0, 0, 0]]),
      wire([['りす', 'カギ', 'あ'.repeat(EXAMPLE_MAX + 1), 0, 0, 0]]),
      wire([['りす', 'カ\u0000ギ', '', 0, 0, 0]]), // 制御文字
      wire([['りす', 'カギ', '', -1, 0, 0]]),
      wire([['りす', 'カギ', '', 0, 1.5, 0]]),
      wire([['りす', 'カギ', '', '0', 0, 0]]),
      wire([['りす', 'カギ', '', 0, 0, 2]]),
      wire([['りす', 'カギ', '', 0, 9, 0]]), // 盤面からはみ出す
      wire([['りす', 'カギ', '', 9, 0, 1]]),
      wire([['りす', 'カギ', '', 0, 0, 0], ['かめ', 'カギ', '', 0, 0, 1]]), // 交わるマスの字がちがう
      wire([['りす', 'カギ', '', 0, 0, 0], ['すいか', 'カギ', '', 0, 1, 0]]), // 同じ向きで重なる
    ];
    for (const data of bad) expect(await decodeCustom(raw(data)), JSON.stringify(data)).toBeNull();
  });

  it('文字列として読めないもの、長すぎるもの、展開すると大きすぎるものは null', async () => {
    expect(await decodeCustom('')).toBeNull();
    expect(await decodeCustom('1')).toBeNull();
    expect(await decodeCustom('2abc')).toBeNull();
    expect(await decodeCustom('0!!!')).toBeNull();
    expect(await decodeCustom('0abc')).toBeNull(); // JSON ではない
    expect(await decodeCustom('1abcdefgh')).toBeNull(); // 圧縮したデータではない
    expect(await decodeCustom(`0${'a'.repeat(PAYLOAD_MAX)}`)).toBeNull();
    // 小さい payload が、展開すると上限をこえる (展開ばくだん)
    const bomb = await packed(JSON.stringify(wire([['りす', 'カギ', '', 0, 0, 0]], ' '.repeat(JSON_MAX * 20))));
    expect(bomb.length).toBeLessThan(PAYLOAD_MAX);
    expect(await decodeCustom(bomb)).toBeNull();
  });
});
