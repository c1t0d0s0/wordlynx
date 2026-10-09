import type { Background, Card, Item, Look } from '../data/cards';
import { h, hanamaruPoints } from './dom';

// 目や輪郭は、画面の明暗に関係なくこの色にする (文字色に合わせると暗い画面で白目になる)
const LINE = '#1c2a4a';
const RED = '#e8546a';
const YELLOW = '#ffd23f';

/** 色の指定があればその色、なければ CSS のクラス (暗い画面で少し色を落とす) を使う */
const paint = (color: string | undefined, cls: string) => (color ? `fill="${color}"` : `class="${cls}"`);

const sparkle = (cx: number, cy: number, r: number, fill = YELLOW) =>
  `<path fill="${fill}" d="M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z"/>`;

const EYE_Y = 69;
const EYE_X = [42, 78];

function eyes(look: Look): string {
  const open = (x: number) =>
    look.eyeColor
      ? `<ellipse cx="${x}" cy="${EYE_Y}" rx="7.5" ry="8.5" fill="${look.eyeColor}" stroke="${LINE}" stroke-width="1.6"/>` +
        `<ellipse cx="${x}" cy="${EYE_Y}" rx="3.3" ry="6.4" fill="${LINE}"/>` +
        `<circle cx="${x + 2.6}" cy="${EYE_Y - 3.6}" r="2" fill="#fff"/>`
      : `<ellipse cx="${x}" cy="${EYE_Y}" rx="7.5" ry="8.5" fill="${LINE}"/>` +
        `<circle cx="${x + 2.6}" cy="${EYE_Y - 3.6}" r="3.1" fill="#fff"/>` +
        `<circle cx="${x - 2.6}" cy="${EYE_Y + 3.6}" r="1.5" fill="#fff"/>`;
  const arc = (x: number, up: boolean) =>
    `<path fill="none" stroke="${LINE}" stroke-width="2.8" stroke-linecap="round" d="M${x - 7} ${EYE_Y + (up ? 2 : -1)}Q${x} ${EYE_Y + (up ? -8 : 7)} ${x + 7} ${EYE_Y + (up ? 2 : -1)}"/>`;
  const [l, r] = EYE_X;
  switch (look.eyes ?? 'open') {
    case 'wink':
      return open(l) + arc(r, true);
    case 'sleep':
      return arc(l, false) + arc(r, false);
    case 'happy':
      return arc(l, true) + arc(r, true);
    case 'sparkle':
      return open(l) + open(r) + sparkle(l - 11, EYE_Y - 12, 4.5) + sparkle(r + 11, EYE_Y - 12, 4.5);
    case 'brave':
      return (
        open(l) +
        open(r) +
        `<path fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round" d="M33 56L50 60.5M87 56L70 60.5"/>`
      );
    default:
      return open(l) + open(r);
  }
}

function mouth(look: Look): string {
  const nose = `<path class="lynx-nose" d="M56.2 79.4Q60 77.6 63.8 79.4Q62.4 83.4 60 84Q57.6 83.4 56.2 79.4Z"/>`;
  const lines = `<path fill="none" stroke="${LINE}" stroke-width="2" stroke-linecap="round" d="M60 84V86M60 86C58 90 53 90 51.5 87M60 86C62 90 67 90 68.5 87"/>`;
  switch (look.mouth ?? 'tongue') {
    case 'smile':
      return nose + lines;
    case 'open':
      return (
        `<path fill="#8a3b3b" stroke="${LINE}" stroke-width="2" stroke-linejoin="round" d="M52.5 87.5Q60 100 67.5 87.5Z"/>` +
        `<ellipse class="lynx-tongue" cx="60" cy="93.2" rx="3.6" ry="2.4"/>` +
        nose +
        `<path fill="none" stroke="${LINE}" stroke-width="2" stroke-linecap="round" d="M60 84V87"/>`
      );
    default:
      return `<path class="lynx-tongue" d="M56.8 88.5Q60 95.5 63.2 88.5Z"/>` + nose + lines;
  }
}

// 頭の上にかぶるもの。これがあるときは、ひたいのもようをかかない
const HEADWEAR: Item[] = ['hat', 'headband', 'cap', 'wizard', 'crown'];

const ITEMS: Record<Item, string> = {
  ribbon:
    `<g transform="translate(87 31) rotate(18)" stroke="${LINE}" stroke-width="2" stroke-linejoin="round" fill="${RED}">` +
    `<path d="M0 0L-14 -8.5V8.5Z"/><path d="M0 0L14 -8.5V8.5Z"/><circle r="4"/></g>`,
  glasses:
    `<g fill="rgba(255,255,255,0.3)" stroke="${LINE}" stroke-width="2.6">` +
    `<circle cx="42" cy="69" r="11.5"/><circle cx="78" cy="69" r="11.5"/>` +
    `<path fill="none" stroke-linecap="round" d="M53.5 67.5Q60 63.5 66.5 67.5M30.5 67L21 63M89.5 67L99 63"/></g>`,
  pencil:
    `<g transform="rotate(30 97 34)" stroke="${LINE}" stroke-width="2" stroke-linejoin="round">` +
    `<rect x="93" y="12" width="8" height="6" fill="#f7a3b0"/><rect x="93" y="18" width="8" height="26" fill="${YELLOW}"/>` +
    `<path fill="#f6e0b5" d="M93 44H101L97 54Z"/><path fill="${LINE}" stroke="none" d="M95.4 50H98.6L97 54Z"/></g>`,
  hat:
    `<g stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round">` +
    `<ellipse cx="60" cy="31" rx="43" ry="7.5" fill="#f0d27a"/>` +
    `<path fill="#f5dc8e" d="M37 30C37 6 83 6 83 30Q60 36 37 30Z"/>` +
    `<path fill="${RED}" d="M37.2 24Q60 19 82.8 24L83 30Q60 36 37 30Z"/></g>`,
  scarf:
    `<g fill="${RED}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round">` +
    `<path d="M73 110L79 129L90 125L85 107Z"/><path d="M25 97Q60 113 95 97L97 107Q60 125 23 107Z"/></g>` +
    `<path fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.8" d="M38 107Q60 115 82 107"/>`,
  flower:
    `<g transform="translate(88 31)" stroke="${LINE}" stroke-width="1.6">` +
    [0, 72, 144, 216, 288].map((a) => `<circle r="5.4" cx="0" cy="-6.6" fill="#ff9fb5" transform="rotate(${a})"/>`).join('') +
    `<circle r="4" fill="${YELLOW}"/></g>`,
  book:
    `<g stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round">` +
    `<path fill="#fff" d="M32 100Q46 93 60 100Q74 93 88 100V120Q74 113 60 120Q46 113 32 120Z"/>` +
    `<path fill="none" d="M60 100V120"/></g>` +
    `<path fill="none" stroke="#9aa6b8" stroke-width="1.4" stroke-linecap="round" d="M38 104Q46 101 54 104M38 109Q46 106 54 109M66 104Q74 101 82 104M66 109Q74 106 82 109"/>`,
  headband:
    `<g stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round" fill="#fff">` +
    `<path d="M97 52L112 44L110 53L114 60L98 58Z"/><path d="M21 50Q60 33 99 50L99.5 59Q60 42 20.5 59Z"/></g>` +
    `<circle cx="60" cy="44.5" r="4.4" fill="#d63c2c"/>`,
  headphones:
    `<path fill="none" stroke="${LINE}" stroke-width="8" stroke-linecap="round" d="M19 62C19 12 101 12 101 62"/>` +
    `<path fill="none" stroke="#5b79d6" stroke-width="4.5" stroke-linecap="round" d="M19 62C19 12 101 12 101 62"/>` +
    `<g fill="${RED}" stroke="${LINE}" stroke-width="2.2"><rect x="9" y="55" width="14" height="27" rx="6.5"/><rect x="97" y="55" width="14" height="27" rx="6.5"/></g>`,
  cap:
    `<g stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round">` +
    `<path fill="#2f55a8" d="M38 33C24 33 11 37 6 44C24 45 46 41 62 35Z"/>` +
    `<path fill="#3f6fd1" d="M35 34C35 8 85 8 85 34Q60 28 35 34Z"/></g>` +
    `<circle cx="60" cy="13.5" r="2.6" fill="#fff" stroke="${LINE}" stroke-width="1.5"/>` +
    `<path fill="none" stroke="#fff" stroke-width="1.6" opacity="0.7" d="M60 16V30"/>`,
  wizard:
    `<g stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round">` +
    `<path fill="#5b3fa8" d="M34 33Q50 10 70 -12Q72 12 86 33Q60 39 34 33Z"/>` +
    `<ellipse cx="60" cy="33" rx="37" ry="6.5" fill="#4a3290"/></g>` +
    sparkle(57, 20, 5) +
    sparkle(69, 8, 3.2) +
    sparkle(72, 25, 2.6),
  crown:
    `<path fill="${YELLOW}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round" d="M38 32L35 8L49 20L60 2L71 20L85 8L82 32Q60 26 38 32Z"/>` +
    `<circle cx="60" cy="21" r="3.6" fill="#d63c2c" stroke="${LINE}" stroke-width="1.4"/>` +
    `<circle cx="45.5" cy="24" r="2.6" fill="#4a90e2" stroke="${LINE}" stroke-width="1.2"/>` +
    `<circle cx="74.5" cy="24" r="2.6" fill="#3fb37f" stroke="${LINE}" stroke-width="1.2"/>`,
  zzz:
    `<g fill="#fff" font-family="sans-serif" font-weight="700">` +
    `<text x="90" y="34" font-size="13">z</text><text x="99" y="22" font-size="16">z</text><text x="110" y="8" font-size="19">z</text></g>`,
};

/** ヤマネコの顔 (たて 110 × よこ 120 の中にかく)。耳の先のふさ毛と、ほおの長い毛が目じるし */
export function lynxFace(look: Look = {}): string {
  const items = look.items ?? [];
  const marks = items.some((i) => HEADWEAR.includes(i)) ? 'none' : (look.marks ?? 'stripes');
  return (
    `<g stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">` +
    `<path ${paint(look.fur, 'lynx-fur')} d="M27 52C21 38 21 24 25 13C36 19 47 27 53 36ZM93 52C99 38 99 24 95 13C84 19 73 27 67 36Z"/>` +
    `<path ${paint(look.fur, 'lynx-fur')} d="M60 28C36 28 19 44 19 67C19 73 15 79 8 85C18 86 25 89 31 95C39 103 50 106 60 106C70 106 81 103 89 95C95 89 102 86 112 85C105 79 101 73 101 67C101 44 84 28 60 28Z"/></g>` +
    `<path ${paint(look.pink, 'lynx-pink')} d="M30 43C28 35 28 28 30 22C36 26 41 31 45 36ZM90 43C92 35 92 28 90 22C84 26 79 31 75 36Z"/>` +
    `<path ${look.fur ? `fill="${LINE}"` : 'class="lynx-tuft"'} d="M24 15C22 10 20 6 19 1C24 4 28 8 31 12ZM96 15C98 10 100 6 101 1C96 4 92 8 89 12Z"/>` +
    `<ellipse ${paint(look.light, 'lynx-light')} cx="60" cy="86" rx="15" ry="11"/>` +
    `<ellipse ${paint(look.pink, 'lynx-pink')} cx="28" cy="82" rx="6.5" ry="4" opacity="0.75"/>` +
    `<ellipse ${paint(look.pink, 'lynx-pink')} cx="92" cy="82" rx="6.5" ry="4" opacity="0.75"/>` +
    (marks === 'stripes'
      ? `<path fill="none" stroke="${LINE}" stroke-width="2.5" stroke-linecap="round" d="M53 39L54 45M60 37V44M67 39L66 45"/>`
      : marks === 'spots'
        ? `<g fill="${LINE}"><circle cx="52" cy="42" r="2.2"/><circle cx="60" cy="38" r="2.2"/><circle cx="68" cy="42" r="2.2"/></g>`
        : '') +
    eyes(look) +
    mouth(look) +
    `<path fill="none" stroke="${LINE}" stroke-width="1.4" stroke-linecap="round" d="M45 87L33 89M45.5 90.5L35 96M75 87L87 89M74.5 90.5L85 96"/>` +
    items.map((item) => ITEMS[item]).join('')
  );
}

/** タイトル画面のヤマネコ */
export function lynx(): HTMLElement {
  const el = h('div', { class: 'lynx' });
  el.innerHTML = `<svg viewBox="0 0 120 110" role="img" aria-label="ヤマネコのキャラクター">${lynxFace()}</svg>`;
  return el;
}

// ---- カードの絵柄 (たて 156 × よこ 120) ----

const W = 120;
const H = 156;
const circles = (points: number[][], fill: string) =>
  points.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');
const fillRect = (fill: string) => `<rect width="${W}" height="${H}" fill="${fill}"/>`;

function background(bg: Background): string {
  switch (bg) {
    case 'dots': {
      const dots: number[][] = [];
      for (let y = 0; y < 11; y++) for (let x = 0; x < 9; x++) dots.push([x * 15 + (y % 2) * 7.5, y * 15 + 6, 3.2]);
      return fillRect('#fff5c2') + circles(dots, '#ffe36e');
    }
    case 'grid': {
      let d = '';
      for (let x = 12; x < W; x += 12) d += `M${x} 0V${H}`;
      for (let y = 12; y < H; y += 12) d += `M0 ${y}H${W}`;
      return fillRect('#f3faf6') + `<path d="${d}" stroke="#b9dccf" stroke-width="1" fill="none"/>`;
    }
    case 'night':
      return (
        fillRect('#27305a') +
        `<circle cx="24" cy="24" r="11" fill="#ffe58a"/><circle cx="29" cy="20.5" r="10" fill="#27305a"/>` +
        circles([[52, 14, 1.4], [76, 26, 1.1], [14, 60, 1.2], [108, 52, 1.5], [100, 140, 1.3], [16, 132, 1.5], [62, 148, 1.1]], '#fff') +
        sparkle(90, 16, 4, '#ffe58a') +
        sparkle(106, 100, 3, '#ffe58a')
      );
    case 'pink':
      return fillRect('#ffe4ea') + circles([[18, 22, 13], [102, 34, 9], [96, 132, 16], [14, 120, 8], [60, 10, 6]], '#ffd0da');
    case 'sky':
      return (
        fillRect('#cdeaf8') +
        `<circle cx="98" cy="22" r="11" fill="${YELLOW}"/>` +
        `<g fill="#fff"><ellipse cx="26" cy="22" rx="15" ry="6.5"/><ellipse cx="34" cy="17" rx="9" ry="6"/>` +
        `<ellipse cx="92" cy="142" rx="17" ry="6.5"/><ellipse cx="20" cy="136" rx="12" ry="5"/></g>`
      );
    case 'snow':
      return (
        fillRect('#dcecf5') +
        `<ellipse cx="60" cy="160" rx="90" ry="22" fill="#fff"/>` +
        circles([[16, 16, 2.6], [44, 10, 1.8], [78, 20, 2.4], [104, 12, 1.9], [10, 58, 2], [110, 66, 2.6], [20, 104, 1.8], [102, 112, 2.2], [60, 24, 1.6]], '#fff')
      );
    case 'sakura': {
      const petals = [[16, 18, 20], [42, 10, -30], [86, 16, 50], [106, 34, -10], [10, 70, 70], [112, 86, 30], [18, 128, -40], [98, 138, 15], [58, 146, -60], [70, 28, 80]];
      return (
        fillRect('#fdeaf0') +
        petals.map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="3" fill="#f7a8bd" transform="rotate(${a} ${x} ${y})"/>`).join('')
      );
    }
    case 'notes': {
      const notes = [[12, 28, 18], [94, 22, 15], [104, 70, 13], [8, 96, 14], [92, 146, 18], [24, 148, 13]];
      return (
        fillRect('#e9f1ff') +
        `<g fill="#7d94d6" font-family="sans-serif">` +
        notes.map(([x, y, s]) => `<text x="${x}" y="${y}" font-size="${s}">♪</text>`).join('') +
        `</g>`
      );
    }
    case 'hanamaru':
      return (
        fillRect('#fdfdfa') +
        `<polyline points="${hanamaruPoints()}" fill="none" stroke="#d63c2c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.38" transform="translate(-10 4) scale(1.4)"/>`
      );
    case 'stars':
      return (
        fillRect('#33285c') +
        [[16, 18, 6], [100, 14, 4.5], [108, 70, 5], [10, 84, 4], [20, 140, 5], [98, 140, 6.5], [60, 12, 3]].map(([x, y, r]) => sparkle(x, y, r)).join('') +
        circles([[40, 20, 1.2], [84, 30, 1], [112, 112, 1.3], [8, 116, 1.1]], '#fff')
      );
    case 'rainbow':
      return (
        fillRect('#eaf6ff') +
        ['#f2666c', '#f7a23b', '#ffd93b', '#69c56e', '#4aa3e8', '#8b6fd6']
          .map((c, i) => `<circle cx="60" cy="150" r="${112 - i * 9}" fill="none" stroke="${c}" stroke-width="9"/>`)
          .join('') +
        `<circle cx="60" cy="150" r="53.5" fill="#eaf6ff"/>`
      );
    case 'gold': {
      let rays = '';
      for (let i = 0; i < 12; i++) rays += `<path d="M60 84L${60 - 14} -40L${60 + 14} -40Z" fill="#f2d56a" transform="rotate(${i * 30} 60 84)"/>`;
      return fillRect('#f8e9ad') + rays + sparkle(16, 20, 6, '#fff') + sparkle(104, 28, 4.5, '#fff') + sparkle(102, 136, 6, '#fff') + sparkle(18, 132, 4, '#fff');
    }
    default:
      return fillRect('#fdfdfa') + `<rect x="8" y="8" width="104" height="140" rx="4" fill="none" stroke="#c5ddd3" stroke-width="1.2"/>`;
  }
}

const FRAMES = {
  plain: `<rect x="1.5" y="1.5" width="117" height="153" rx="7" fill="none" stroke="#6aa893" stroke-width="3"/>`,
  silver:
    `<rect x="2.5" y="2.5" width="115" height="151" rx="6.5" fill="none" stroke="#aeb8c4" stroke-width="5"/>` +
    `<rect x="5.5" y="5.5" width="109" height="145" rx="4.5" fill="none" stroke="#f1f4f7" stroke-width="1.2"/>`,
  gold:
    `<rect x="2.5" y="2.5" width="115" height="151" rx="6.5" fill="none" stroke="#d9a520" stroke-width="5"/>` +
    `<rect x="5.5" y="5.5" width="109" height="145" rx="4.5" fill="none" stroke="#fff3c4" stroke-width="1.2"/>`,
};

let clipSeq = 0;

/** 表向きのカードの絵 */
export function cardSvg(card: Card): string {
  const clip = `card-clip-${clipSeq++}`;
  return (
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${card.name}">` +
    `<clipPath id="${clip}"><rect width="${W}" height="${H}" rx="8"/></clipPath>` +
    `<g clip-path="url(#${clip})">${background(card.bg)}` +
    `<g transform="translate(9 37) scale(0.85)">${lynxFace({ fur: '#e9bd72', light: '#fff6e1', pink: '#f7b3a6', ...card.look })}</g>` +
    `</g>${FRAMES[card.frame]}</svg>`
  );
}
