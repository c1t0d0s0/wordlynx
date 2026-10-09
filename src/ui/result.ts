import { normalizeKana } from '../core/kana';
import type { Mode, Puzzle, Word } from '../core/puzzle';
import type { StampReward } from '../core/rewards';
import { balance } from '../core/storage';
import { h, hanamaru, rubyHtml, withRuby } from './dom';
import { TEXT } from './text';

function wordCard(w: Word, showPos: boolean): HTMLElement {
  const example = h('p', { class: 'word-example' });
  example.innerHTML = rubyHtml(w.example).replace('〇〇', `<b>${w.reading}</b>`);
  return h(
    'li',
    { class: 'word' },
    h(
      'p',
      { class: 'word-head' },
      h('span', { class: 'word-reading' }, w.reading),
      w.kanji && h('span', { class: 'word-kanji' }, `【${w.kanji}】`),
      showPos && h('span', { class: 'pos' }, w.pos),
    ),
    withRuby('p', 'word-clue', w.clue),
    example,
  );
}

/** クリアしたあとに、出てきた言葉をふりかえる画面 */
export function openResult(puzzle: Puzzle, opts: { celebrate: boolean; mode: Mode; streak?: number; stamp?: StampReward; month?: number; clearPoints?: number },
): void {
  const t = TEXT[opts.mode];
  const words = puzzle.entries
    .map((e) => e.word)
    .sort((a, b) => normalizeKana(a.reading).localeCompare(normalizeKana(b.reading), 'ja'));

  // はじめてクリアしたときにもらえたポイントと、今日のパズルのスタンプを知らせる
  const stamp = opts.stamp?.added ? opts.stamp : undefined;
  const clearPoints = opts.clearPoints ?? 0;
  const gained = clearPoints + (stamp ? stamp.weekPoints + stamp.monthPoints : 0);
  const rewardBox =
    gained > 0 || stamp
      ? h(
          'div',
          { class: 'result-stamp' },
          clearPoints > 0 && h('p', { class: 'result-reward' }, t.rewardClear(clearPoints)),
          stamp && h('p', { class: 'result-stamp-title' }, t.stampDone),
          stamp && stamp.weekPoints > 0 && h('p', { class: 'result-reward' }, t.rewardWeek(stamp.run)),
          stamp && stamp.monthPoints > 0 && h('p', { class: 'result-reward' }, t.rewardMonth(opts.month ?? 0)),
          gained > 0 && h('p', { class: 'result-balance' }, `${t.pointsLabel} ${t.points(balance())}`),
          gained > 0 && h('a', { class: 'btn', href: '#/cards' }, t.seeCards),
        )
      : null;

  const dialog = h('dialog', { class: 'result', 'aria-labelledby': 'result-title' });
  const close = () => dialog.close();
  dialog.append(
    h(
      'div',
      { class: 'result-head' },
      opts.celebrate && hanamaru(),
      h(
        'div',
        {},
        h('h2', { id: 'result-title' }, opts.celebrate ? t.resultDone : t.resultReview),
        h(
          'p',
          { class: 'result-sub' },
          t.resultSub(words.length, opts.streak),
        ),
      ),
    ),
    ...(rewardBox ? [rewardBox] : []),
    h('ul', { class: 'word-list' }, ...words.map((w) => wordCard(w, t.showPos))),
    h(
      'div',
      { class: 'result-actions' },
      h('button', { type: 'button', class: 'btn', onclick: close }, t.seeBoard),
      h('a', { class: 'btn btn-primary', href: '#/' }, t.goHome),
    ),
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  dialog.scrollTop = 0;
}
