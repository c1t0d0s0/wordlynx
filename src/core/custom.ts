// 自分で作るパズルの決まりごと: 入れた言葉の確かめ、盤面への自動配置、シェア用の URL との行き来。
// 通信や画面には依存しない純粋な関数だけを置く。
import { generate, numberEntries } from './generator';
import { isGridKana, normalizeKana } from './kana';
import { cleanText, type Entry, type Puzzle, type Word } from './puzzle';
import { hashString } from './rng';

export const CUSTOM_SIZE = 10;
/** 入れる言葉の数 */
export const CUSTOM_MIN_WORDS = 3;
export const CUSTOM_MAX_WORDS = 16;
/** よみの長さ (盤面に入る字数) */
export const READING_MIN = 2;
export const READING_MAX = 8;
export const TITLE_MAX = 20;
export const CLUE_MAX = 40;
export const EXAMPLE_MAX = 40;
/** URL に入れる文字列の長さの上限 */
export const PAYLOAD_MAX = 6000;
/** 展開したあとの JSON の大きさ (バイト) の上限 */
export const JSON_MAX = 16000;

export interface CustomWord {
  /** よみ (ひらがな。小さい字はそのまま) */
  reading: string;
  clue: string;
  /** 例文。なくてもよい */
  example: string;
}

export interface CustomDraft {
  title: string;
  words: CustomWord[];
}

export type RowError = 'reading-empty' | 'reading-chars' | 'reading-length' | 'reading-dup' | 'clue-empty';

export interface DraftCheck {
  title: string;
  /** 整えたあとの言葉 (何も書いていない行はのぞく) */
  words: CustomWord[];
  /** まちがいのある行。row は、わたされた draft.words の中での位置 */
  errors: { row: number; error: RowError }[];
  /** 言葉の数が少なすぎる・多すぎる */
  count: 'few' | 'many' | null;
}

/** カタカナをひらがなにする (小さい字はそのまま) */
function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/** 盤面に入れられるよみか (ひらがなと「ー」だけ) */
function isReading(reading: string): boolean {
  return /^[ぁ-んー]+$/.test(reading) && [...normalizeKana(reading)].every(isGridKana);
}

/** 保存してあった下書きを読む。形がちがうところは空にする */
export function parseDraft(saved: unknown): CustomDraft {
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const obj = saved && typeof saved === 'object' ? (saved as { title?: unknown; words?: unknown }) : {};
  const words = Array.isArray(obj.words) ? obj.words.slice(0, CUSTOM_MAX_WORDS) : [];
  return {
    title: str(obj.title),
    words: words.map((w: { reading?: unknown; clue?: unknown; example?: unknown } | null) => ({
      reading: str(w?.reading),
      clue: str(w?.clue),
      example: str(w?.example),
    })),
  };
}

/** 入れた言葉を整えて、まちがいをさがす */
export function validateDraft(draft: CustomDraft): DraftCheck {
  const words: CustomWord[] = [];
  const errors: DraftCheck['errors'] = [];
  const seen = new Set<string>();
  draft.words.forEach((w, row) => {
    const reading = toHiragana(cleanText(w.reading, 40).replace(/\s/g, ''));
    const clue = cleanText(w.clue, CLUE_MAX);
    const example = cleanText(w.example, EXAMPLE_MAX);
    if (reading === '' && clue === '' && example === '') return; // 何も書いていない行
    const answer = normalizeKana(reading);
    let error: RowError | null = null;
    if (reading === '') error = 'reading-empty';
    else if (!isReading(reading)) error = 'reading-chars';
    else if (answer.length < READING_MIN || answer.length > READING_MAX) error = 'reading-length';
    else if (seen.has(answer)) error = 'reading-dup';
    else if (clue === '') error = 'clue-empty';
    if (error) errors.push({ row, error });
    else {
      seen.add(answer);
      words.push({ reading, clue, example });
    }
  });
  const total = words.length + errors.length;
  return {
    title: cleanText(draft.title, TITLE_MAX),
    words,
    errors,
    count: total < CUSTOM_MIN_WORDS ? 'few' : total > CUSTOM_MAX_WORDS ? 'many' : null,
  };
}

const toWord = (w: CustomWord): Word => ({ reading: w.reading, kanji: '', pos: '', clue: w.clue, example: w.example });

/**
 * 言葉を盤面にならべる。words には validateDraft を通ったものをわたす。
 * 同じ字がなくてつながらない言葉は入らないので、unplaced で返す。tryNo を変えると、別のならび方になる
 */
export function buildCustom(words: readonly CustomWord[], tryNo = 0): { puzzle: Puzzle; unplaced: CustomWord[] } {
  const puzzle = generate(words.map(toWord), {
    id: 'custom-preview',
    seed: `wordlynx-custom-${tryNo}`,
    size: CUSTOM_SIZE,
    targetWords: words.length,
    // はじめは、たくさんためして、いちばん多く入るならび方をえらぶ。「ならべなおす」では、ためす数をへらして、
    // いろいろなならび方が出るようにする (たくさんためすと、いつも同じ「いちばんよい形」に落ちつくため)
    attempts: tryNo === 0 ? 200 : 30,
  });
  const placed = new Set(puzzle.entries.map((e) => e.word.reading));
  return { puzzle, unplaced: words.filter((w) => !placed.has(w.reading)) };
}

// ---- シェア用の URL ----
// #/play/<payload>
//   payload = "1" + base64url(deflate-raw(JSON))  …ふつうはこちら
//           = "0" + base64url(JSON)               …圧縮が使えないブラウザで作ったとき
//   JSON    = { v: 1, t: 題名, w: [[よみ, カギ, 例文, 行, 列, 0 (ヨコ) | 1 (タテ)], …] }

type WireWord = [string, string, string, number, number, 0 | 1];
interface Wire {
  v: 1;
  t: string;
  w: WireWord[];
}

function toWire(title: string, entries: readonly Entry[]): Wire {
  return {
    v: 1,
    t: title,
    w: entries.map((e) => [e.word.reading, e.word.clue, e.word.example, e.row, e.col, e.dir === 'across' ? 0 : 1]),
  };
}

const isText = (v: unknown, min: number, max: number): v is string =>
  typeof v === 'string' && v === cleanText(v, max) && [...v].length >= min;
const isCell = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < CUSTOM_SIZE;

/**
 * URL から来たデータをパズルにする。だれが作ったか分からないデータなので、全部を確かめて、
 * 1 つでもおかしければ null を返す (よみは画面に HTML として入るところがあるので、ひらがな以外は通さない)
 */
function fromWire(data: unknown): { title: string; puzzle: Puzzle } | null {
  if (!data || typeof data !== 'object') return null;
  const { v, t, w } = data as { v?: unknown; t?: unknown; w?: unknown };
  if (v !== 1 || !isText(t, 0, TITLE_MAX) || !Array.isArray(w) || w.length < 1 || w.length > CUSTOM_MAX_WORDS) return null;

  const size = CUSTOM_SIZE;
  const cells: (string | null)[] = new Array(size * size).fill(null);
  const used = { across: new Array<boolean>(size * size).fill(false), down: new Array<boolean>(size * size).fill(false) };
  const placed: Omit<Entry, 'num'>[] = [];
  for (const item of w as unknown[]) {
    if (!Array.isArray(item) || item.length !== 6) return null;
    const [reading, clue, example, row, col, d] = item as unknown[];
    if (typeof reading !== 'string' || reading.length > READING_MAX || !isReading(reading)) return null;
    if (!isText(clue, 1, CLUE_MAX) || !isText(example, 0, EXAMPLE_MAX)) return null;
    if (!isCell(row) || !isCell(col) || (d !== 0 && d !== 1)) return null;
    const answer = normalizeKana(reading);
    if (answer.length < READING_MIN) return null;
    const dir = d === 0 ? 'across' : 'down';
    for (let i = 0; i < answer.length; i++) {
      const r: number = dir === 'down' ? row + i : row;
      const c: number = dir === 'across' ? col + i : col;
      if (r >= size || c >= size) return null; // 盤面からはみ出す
      const idx = r * size + c;
      if (cells[idx] !== null && cells[idx] !== answer[i]) return null; // 交わるマスの字がちがう
      if (used[dir][idx]) return null; // 同じ向きの言葉が重なっている
      cells[idx] = answer[i];
      used[dir][idx] = true;
    }
    placed.push({ dir, row, col, answer, word: toWord({ reading, clue, example }) });
  }
  const entries = numberEntries(placed, size);
  // 同じ中身なら同じ id になるようにして、途中経過を続きから出せるようにする
  const canon = JSON.stringify(toWire(t, entries));
  const id = `custom-${hashString(canon).toString(36)}${hashString(`${canon.length}:${canon}`).toString(36)}`;
  return { title: t, puzzle: { id, size, entries } };
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
}

/** 圧縮・展開の流れに通す。出てきた大きさが max をこえたら、そこでやめて null (こわれたデータでも null) */
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, max: number): Promise<Uint8Array | null> {
  const writer = stream.writable.getWriter();
  // 書きこみの失敗は、読むほうでも失敗として分かる
  writer.write(bytes as BufferSource).catch(() => {});
  writer.close().catch(() => {});
  const reader = stream.readable.getReader();
  const out = new Uint8Array(max);
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value as Uint8Array;
      if (total + chunk.length > max) {
        await reader.cancel().catch(() => {});
        return null;
      }
      out.set(chunk, total);
      total += chunk.length;
    }
  } catch {
    return null;
  }
  return out.subarray(0, total);
}

/** パズルを、URL に入れる文字列にする。compress = false は、圧縮が使えないブラウザと同じ形にする (テスト用) */
export async function encodeCustom(title: string, puzzle: Puzzle, compress = true): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(toWire(cleanText(title, TITLE_MAX), puzzle.entries)));
  if (compress && typeof CompressionStream !== 'undefined') {
    const packed = await pipe(bytes, new CompressionStream('deflate-raw'), JSON_MAX);
    if (packed) return `1${toBase64Url(packed)}`;
  }
  return `0${toBase64Url(bytes)}`;
}

/** URL に入っていた文字列を、パズルにもどす。読めないもの・決まりに合わないものは null */
export async function decodeCustom(payload: string): Promise<{ title: string; puzzle: Puzzle } | null> {
  if (payload.length > PAYLOAD_MAX || !/^[01][\w-]+$/.test(payload)) return null;
  let bytes = fromBase64Url(payload.slice(1));
  if (!bytes) return null;
  if (payload[0] === '1') {
    if (typeof DecompressionStream === 'undefined') return null;
    bytes = await pipe(bytes, new DecompressionStream('deflate-raw'), JSON_MAX);
    if (!bytes) return null;
  } else if (bytes.length > JSON_MAX) return null;
  try {
    return fromWire(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch {
    return null;
  }
}
