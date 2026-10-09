import { balance, buyCard, getCards, getMode } from '../core/storage';
import { CARDS, type Card } from '../data/cards';
import { h } from './dom';
import { cardSvg } from './lynx';
import { TEXT } from './text';

/** ヤマネコカードの画面。ためたポイントとカードを交換し、集めたカードをながめる */
export function renderCards(root: HTMLElement, justGot?: string): void {
  const t = TEXT[getMode()];
  const points = balance();
  const owned = new Set(getCards().map((c) => c.id));

  const tile = (card: Card): HTMLElement => {
    if (owned.has(card.id)) {
      const face = h('div', { class: 'card-face' });
      face.innerHTML = cardSvg(card);
      return h(
        'li',
        { class: card.id === justGot ? 'card is-owned is-new' : 'card is-owned' },
        face,
        h('p', { class: 'card-name' }, card.name),
      );
    }
    // まだ持っていないカードは裏向き。絵柄も名前も出さず、必要なポイントだけを見せる
    const short = card.price - points;
    return h(
      'li',
      { class: 'card is-back' },
      h('div', { class: 'card-back', role: 'img', 'aria-label': t.cardBackLabel(card.price) }, h('span', { class: 'card-price' }, t.points(card.price))),
      short > 0
        ? h('p', { class: 'card-short' }, t.cardShort(short))
        : h(
            'button',
            {
              type: 'button',
              class: 'btn btn-primary card-get',
              onclick: () => {
                if (!confirm(t.cardConfirm(card.price))) return;
                if (buyCard(card)) renderCards(root, card.id);
              },
            },
            t.cardGet,
          ),
    );
  };

  root.replaceChildren(
    h(
      'div',
      { class: 'cards-page' },
      h(
        'header',
        { class: 'bar' },
        h('a', { class: 'back', href: '#/' }, '‹ ホーム'),
        h('h1', {}, t.cardsTitle),
        h('span', { class: 'bar-meta' }, t.cardsOwned(owned.size, CARDS.length)),
      ),
      h(
        'main',
        { class: 'cards-main' },
        h('p', { class: 'cards-lead' }, t.cardsLead),
        h('p', { class: 'points points-big' }, h('span', { class: 'points-label' }, t.pointsLabel), h('b', { class: 'points-num' }, t.points(points))),
        h('ul', { class: 'card-grid' }, ...CARDS.map(tile)),
        h('p', { class: 'stamp-rule' }, t.stampRule),
      ),
    ),
  );
  if (justGot) root.querySelector('.card.is-new')?.scrollIntoView({ block: 'nearest' });
}
