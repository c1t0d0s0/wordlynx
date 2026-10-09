// cards.html: いまあるカードのデザインを全部ならべて確認するためのページ。
// 開発サーバー (npm run dev) でだけ見られ、公開ビルドには入らない。
// 遊ぶ人の記録 (スタンプ・ポイント・持っているカード) は読みも書きもしない。
import './styles.css';
import { CARDS } from './data/cards';
import { h } from './ui/dom';
import { cardSvg } from './ui/lynx';

const pt = (n: number) => `${n.toLocaleString('ja-JP')}pt`;

const face = (svg: string) => {
  const el = h('div', { class: 'card-face' });
  el.innerHTML = svg;
  return el;
};

document.getElementById('app')!.replaceChildren(
  h(
    'main',
    { class: 'cards-main cards-preview' },
    h('h1', {}, 'カードのデザイン一覧'),
    h(
      'p',
      { class: 'cards-lead' },
      `確認用のページです。全 ${CARDS.length} 種類、合計 ${pt(CARDS.reduce((sum, c) => sum + c.price, 0))}。`,
    ),
    h(
      'ul',
      { class: 'card-grid' },
      ...CARDS.map((card) =>
        h(
          'li',
          { class: 'card is-owned' },
          face(cardSvg(card)),
          h('p', { class: 'card-name' }, card.name),
          h('p', { class: 'card-meta' }, `${card.id}・${pt(card.price)}・わく ${card.frame}・背景 ${card.bg}`),
        ),
      ),
      h(
        'li',
        { class: 'card is-back' },
        h('div', { class: 'card-back' }, h('span', { class: 'card-price' }, pt(1000))),
        h('p', { class: 'card-name' }, '裏面 (全カード共通)'),
        h('p', { class: 'card-meta' }, '持っていないカードの表示'),
      ),
    ),
  ),
);
