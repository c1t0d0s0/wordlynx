const SMALL_TO_LARGE: Record<string, string> = {
  ぁ: 'あ', ぃ: 'い', ぅ: 'う', ぇ: 'え', ぉ: 'お',
  っ: 'つ', ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', ゎ: 'わ',
};

/** カタカナをひらがなにし、小さい字を大きい字にそろえる (盤面に入る形) */
export function normalizeKana(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    const hira = code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : ch;
    out += SMALL_TO_LARGE[hira] ?? hira;
  }
  return out;
}

export function isGridKana(ch: string): boolean {
  return /^[あ-んー]$/.test(ch) && !(ch in SMALL_TO_LARGE);
}

const DAKUTEN_PAIRS = 'かがきぎくぐけげこごさざしじすずせぜそぞただちぢつづてでとどはばひびふぶへべほぼ';
const HANDAKUTEN_PAIRS = 'はぱひぴふぷへぺほぽ';

function buildToggle(pairs: string): Record<string, string> {
  const m: Record<string, string> = {};
  for (let i = 0; i < pairs.length; i += 2) {
    m[pairs[i]] = pairs[i + 1];
    m[pairs[i + 1]] = pairs[i];
  }
  return m;
}
const DAKUTEN = buildToggle(DAKUTEN_PAIRS);
const HANDAKUTEN = buildToggle(HANDAKUTEN_PAIRS);
// ば ⇔ ぱ の付け替えもできるようにする
const BASE: Record<string, string> = {};
for (let i = 0; i < DAKUTEN_PAIRS.length; i += 2) BASE[DAKUTEN_PAIRS[i + 1]] = DAKUTEN_PAIRS[i];
for (let i = 0; i < HANDAKUTEN_PAIRS.length; i += 2) BASE[HANDAKUTEN_PAIRS[i + 1]] = HANDAKUTEN_PAIRS[i];

/** ゛ または ゜ を付け外しする。付けられない字なら null */
export function toggleMark(ch: string, mark: '゛' | '゜'): string | null {
  const table = mark === '゛' ? DAKUTEN : HANDAKUTEN;
  if (table[ch] && BASE[ch] === undefined) return table[ch]; // 清音 → 付ける
  const base = BASE[ch];
  if (base === undefined) return null;
  const marked = table[base];
  if (marked === undefined) return null;
  return marked === ch ? base : marked;
}

const ROMAJI: Record<string, string> = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  sa: 'さ', si: 'し', shi: 'し', su: 'す', se: 'せ', so: 'そ',
  ta: 'た', ti: 'ち', chi: 'ち', tu: 'つ', tsu: 'つ', te: 'て', to: 'と',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', hu: 'ふ', fu: 'ふ', he: 'へ', ho: 'ほ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  wa: 'わ', wo: 'を', nn: 'ん',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  za: 'ざ', zi: 'じ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  ja: 'じや', ju: 'じゆ', jo: 'じよ',
  sha: 'しや', shu: 'しゆ', sho: 'しよ',
  cha: 'ちや', chu: 'ちゆ', cho: 'ちよ',
  xtu: 'つ', ltu: 'つ', xya: 'や', xyu: 'ゆ', xyo: 'よ', lya: 'や', lyu: 'ゆ', lyo: 'よ',
  '-': 'ー',
};
// きゃ・ぎゅ などの拗音は、盤面では「き」「や」の 2 マスになる
for (const [c, k] of Object.entries({
  k: 'き', s: 'し', t: 'ち', n: 'に', h: 'ひ', m: 'み', r: 'り',
  g: 'ぎ', z: 'じ', d: 'ぢ', b: 'び', p: 'ぴ', j: 'じ',
})) {
  ROMAJI[`${c}ya`] = `${k}や`;
  ROMAJI[`${c}yu`] = `${k}ゆ`;
  ROMAJI[`${c}yo`] = `${k}よ`;
}
const ROMAJI_KEYS = Object.keys(ROMAJI);
const isPrefix = (buf: string) => ROMAJI_KEYS.some((k) => k.startsWith(buf));

/** ローマ字を 1 打鍵ずつ受け取り、確定したかなを返す */
export class RomajiInput {
  private buf = '';

  get pending(): string {
    return this.buf;
  }

  reset(): void {
    this.buf = '';
  }

  feed(key: string): string {
    this.buf += key.toLowerCase();
    let out = '';
    for (;;) {
      const b = this.buf;
      if (b === '') break;
      if (ROMAJI[b]) {
        out += ROMAJI[b];
        this.buf = '';
        break;
      }
      if (b.length >= 2 && b[0] === 'n' && !'aiueoyn'.includes(b[1])) {
        out += 'ん';
        this.buf = b.slice(1);
        continue;
      }
      if (b.length >= 2 && b[0] === b[1] && !'aiueon-'.includes(b[0])) {
        out += 'つ';
        this.buf = b.slice(1);
        continue;
      }
      if (isPrefix(b)) break;
      this.buf = b.slice(1); // つながらない打鍵は捨てる
    }
    return out;
  }
}
