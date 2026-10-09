import { h } from './dom';

export const KEY_DELETE = '⌫';

// 五十音表のならび。左から あ行・か行…、上から あ段・い段…
const ROWS = [
  'あかさたなはまやらわ',
  'いきしちにひみ゛りを',
  'うくすつぬふむゆるん',
  'えけせてねへめ゜れー',
  `おこそとのほもよろ${KEY_DELETE}`,
];

const LABELS: Record<string, string> = {
  '゛': 'てんてんを付ける',
  '゜': 'まるを付ける',
  [KEY_DELETE]: '1 文字消す',
};

export function renderKeyboard(onKey: (key: string) => void): HTMLElement {
  const kbd = h('div', { class: 'kbd', role: 'group', 'aria-label': 'ひらがなキーボード' });
  for (const row of ROWS) {
    for (const key of row) {
      const special = key in LABELS;
      kbd.append(
        h(
          'button',
          {
            type: 'button',
            class: special ? 'key key-special' : 'key',
            tabindex: -1,
            'aria-label': LABELS[key] ?? key,
            onclick: () => onKey(key),
          },
          key,
        ),
      );
    }
  }
  return kbd;
}
