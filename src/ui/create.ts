// 自分でパズルを作る画面: 言葉とカギを入れる → 盤面を自動で組む → URL・QR コードでシェア
import {
  CLUE_MAX,
  CUSTOM_MAX_WORDS,
  CUSTOM_MIN_WORDS,
  EXAMPLE_MAX,
  READING_MAX,
  READING_MIN,
  TITLE_MAX,
  buildCustom,
  encodeCustom,
  parseDraft,
  validateDraft,
  type CustomDraft,
  type CustomWord,
  type RowError,
} from '../core/custom';
import { solutionGrid, type Puzzle } from '../core/puzzle';
import { loadDraft, saveDraft } from '../core/storage';
import { h, homeButton } from './dom';
import { qrCanvas, shareRow } from './share';
import { CUSTOM as C } from './text';

/** はじめに出しておく行の数 */
const START_ROWS = 5;
/** これより長い URL は、QR コードの目が細かくなりすぎて読めないので出さない */
const QR_URL_MAX = 1200;

const playUrl = (payload: string) => `${location.href.split('#')[0]}#/play/${payload}`;

function errorText(error: RowError): string {
  return error === 'reading-length' ? C.errors[error](READING_MIN, READING_MAX) : C.errors[error];
}

/** 答えの入った盤面 (見るだけ) */
function previewBoard(puzzle: Puzzle): HTMLElement {
  const n = puzzle.size;
  const solution = solutionGrid(puzzle);
  const numberAt = new Map(puzzle.entries.map((e) => [e.row * n + e.col, e.num]));
  const board = h('div', { class: 'board create-board', style: `--n:${n}`, role: 'img', 'aria-label': C.previewTitle });
  solution.forEach((ch, idx) => {
    const num = numberAt.get(idx);
    board.append(
      ch === null
        ? h('span', { class: 'gap' })
        : h('span', { class: 'cell' }, num !== undefined && h('span', { class: 'num' }, String(num)), h('span', { class: 'ch' }, ch)),
    );
  });
  return board;
}

/** パズルを作る画面。もどり値は、画面をはなれるときの後かたづけ */
export function renderCreate(root: HTMLElement): () => void {
  let disposed = false;
  /** 「ならべなおす」をおした回数 */
  let tryNo = 0;
  /** 作り直すたびにふやす。前の回の URL 作りがあとから終わっても、画面に出さない */
  let buildNo = 0;

  const draft: CustomDraft = parseDraft(loadDraft());
  while (draft.words.length < START_ROWS) draft.words.push({ reading: '', clue: '', example: '' });

  const result = h('div', { class: 'create-result' });
  const formError = h('p', { class: 'battle-error', role: 'alert' });
  const rows = h('ol', { class: 'create-rows' });
  const addBtn = h('button', { type: 'button', class: 'btn', onclick: addRow }, C.addWord);
  let rowErrors: HTMLElement[] = [];

  /** 書きかえたら下書きを保存し、前に作ったパズルは (中身が合わなくなるので) かくす */
  function changed(): void {
    saveDraft(draft);
    buildNo++;
    result.replaceChildren();
    formError.textContent = '';
  }

  const titleInput = h('input', {
    type: 'text',
    class: 'battle-input',
    id: 'create-title',
    maxlength: TITLE_MAX,
    placeholder: C.titlePlaceholder,
    value: draft.title,
    oninput: () => {
      draft.title = titleInput.value;
      changed();
    },
  });

  function field(word: CustomWord, key: keyof CustomWord, label: string, placeholder: string, max: number, no: number): HTMLElement {
    const input = h('input', {
      type: 'text',
      class: `battle-input create-${key}`,
      maxlength: max,
      placeholder,
      value: word[key],
      'aria-label': `${C.wordNo(no)} ${label}`,
      autocomplete: 'off',
      oninput: () => {
        word[key] = input.value;
        rowErrors[no - 1].textContent = '';
        changed();
      },
    });
    return h('label', { class: 'create-field' }, h('span', { class: 'create-field-label' }, label), input);
  }

  function paintRows(): void {
    rowErrors = [];
    rows.replaceChildren(
      ...draft.words.map((word, i) => {
        const error = h('p', { class: 'battle-error', role: 'alert' });
        rowErrors.push(error);
        return h(
          'li',
          { class: 'create-row' },
          h('span', { class: 'create-no', 'aria-hidden': 'true' }, String(i + 1)),
          h(
            'div',
            { class: 'create-fields' },
            // よみは、小さい字やカタカナを入れても READING_MAX 文字をこえないことを、作るときに確かめる
            field(word, 'reading', C.reading, C.readingPlaceholder, READING_MAX + 4, i + 1),
            field(word, 'clue', C.clue, C.cluePlaceholder, CLUE_MAX, i + 1),
            field(word, 'example', C.example, C.examplePlaceholder, EXAMPLE_MAX, i + 1),
            error,
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-quiet create-remove',
              'aria-label': `${C.wordNo(i + 1)}: ${C.remove}`,
              title: C.remove,
              onclick: () => {
                draft.words.splice(i, 1);
                if (draft.words.length === 0) draft.words.push({ reading: '', clue: '', example: '' });
                changed();
                paintRows();
              },
            },
            '×',
          ),
        );
      }),
    );
    addBtn.hidden = draft.words.length >= CUSTOM_MAX_WORDS;
  }

  function addRow(): void {
    if (draft.words.length >= CUSTOM_MAX_WORDS) return;
    draft.words.push({ reading: '', clue: '', example: '' });
    saveDraft(draft);
    paintRows();
    rows.querySelector<HTMLInputElement>('li:last-child input')?.focus();
  }

  function build(): void {
    const check = validateDraft(draft);
    rowErrors.forEach((el) => (el.textContent = ''));
    check.errors.forEach(({ row, error }) => (rowErrors[row].textContent = errorText(error)));
    result.replaceChildren();
    const my = ++buildNo;
    if (check.errors.length > 0) {
      formError.textContent = C.fix;
      rowErrors[check.errors[0].row].scrollIntoView({ block: 'center' });
      return;
    }
    if (check.count) {
      formError.textContent = check.count === 'few' ? C.few(CUSTOM_MIN_WORDS) : C.many(CUSTOM_MAX_WORDS);
      return;
    }
    formError.textContent = '';

    const { puzzle, unplaced } = buildCustom(check.words, tryNo);
    const enough = puzzle.entries.length >= 2;
    const share = h('div', { class: 'create-share' });
    const preview = h(
      'section',
      { class: 'battle-card create-preview', 'aria-labelledby': 'create-preview-title' },
      h('h2', { id: 'create-preview-title' }, C.previewTitle),
      enough ? h('p', { class: 'battle-note' }, C.previewNote(puzzle.entries.length)) : h('p', { class: 'battle-error' }, C.tooFew),
      enough && previewBoard(puzzle),
      unplaced.length > 0 &&
        h(
          'div',
          { class: 'create-unplaced' },
          h('p', { class: 'battle-label' }, C.unplaced),
          h('ul', {}, ...unplaced.map((w) => h('li', {}, w.reading))),
          h('p', { class: 'battle-note' }, C.unplacedNote),
        ),
      h(
        'button',
        {
          type: 'button',
          class: 'btn',
          onclick: () => {
            tryNo++;
            build();
          },
        },
        C.shuffle,
      ),
      share,
    );
    result.replaceChildren(preview);
    preview.scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (!enough) return;

    void encodeCustom(check.title, puzzle).then((payload) => {
      if (disposed || my !== buildNo) return;
      const url = playUrl(payload);
      share.replaceChildren(
        h('h3', {}, C.shareTitle),
        h('p', { class: 'battle-note' }, C.shareNote),
        url.length <= QR_URL_MAX ? qrCanvas(url, { size: 232, level: 'L' }) : h('p', { class: 'battle-note' }, C.qrTooLong),
        shareRow(url, { copy: C.copyUrl, copied: C.copied, share: C.share, shareText: C.shareText(check.title) }),
        h('a', { class: 'btn btn-primary', href: `#/play/${payload}` }, C.tryIt),
      );
    });
  }

  paintRows();
  root.replaceChildren(
    h(
      'div',
      { class: 'battle-page create-page' },
      h('header', { class: 'bar' }, homeButton(C.goHome), h('h1', {}, C.title), h('span', {})),
      h(
        'main',
        { class: 'battle-main' },
        h(
          'section',
          { class: 'battle-card create-form' },
          h('p', { class: 'battle-lead' }, C.lead),
          h('p', { class: 'battle-note' }, C.privacy),
          h('div', { class: 'battle-field' }, h('label', { for: 'create-title' }, C.titleLabel), titleInput),
          h('p', { class: 'battle-label' }, C.wordsLabel(CUSTOM_MIN_WORDS, CUSTOM_MAX_WORDS)),
          rows,
          addBtn,
          formError,
          h('button', { type: 'button', class: 'btn btn-primary create-build', onclick: build }, C.build),
        ),
        result,
      ),
    ),
  );

  return () => {
    disposed = true;
  };
}
