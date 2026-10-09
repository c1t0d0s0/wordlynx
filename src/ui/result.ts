import { normalizeKana } from '../core/kana';
import type { Puzzle, Word } from '../core/puzzle';
import { h, hanamaru, rubyHtml, withRuby } from './dom';

function wordCard(w: Word): HTMLElement {
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
      h('span', { class: 'pos' }, w.pos),
    ),
    withRuby('p', 'word-clue', w.clue),
    example,
  );
}

/** クリアしたあとに、出てきた言葉をふりかえる画面 */
export function openResult(puzzle: Puzzle, opts: { celebrate: boolean; streak?: number }): void {
  const words = puzzle.entries
    .map((e) => e.word)
    .sort((a, b) => normalizeKana(a.reading).localeCompare(normalizeKana(b.reading), 'ja'));

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
        h('h2', { id: 'result-title' }, opts.celebrate ? 'よくできました' : 'ことばのふりかえり'),
        h(
          'p',
          { class: 'result-sub' },
          opts.streak && opts.streak > 1
            ? `${opts.streak}日つづけてクリア。${words.length}この言葉をおさらいしよう。`
            : `出てきた${words.length}この言葉をおさらいしよう。`,
        ),
      ),
    ),
    h('ul', { class: 'word-list' }, ...words.map(wordCard)),
    h(
      'div',
      { class: 'result-actions' },
      h('button', { type: 'button', class: 'btn', onclick: close }, '盤面を見る'),
      h('a', { class: 'btn btn-primary', href: '#/' }, 'ホームにもどる'),
    ),
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  dialog.scrollTop = 0;
}
