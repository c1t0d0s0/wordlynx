import { RomajiInput, isGridKana, normalizeKana, toggleMark } from '../core/kana';
import { entryCells, solutionGrid, type Dir, type Entry, type Mode, type Puzzle } from '../core/puzzle';
import { FREE_HINTS, HINT_COST } from '../core/rewards';
import {
  addClear,
  addStamp,
  balance,
  currentStreak,
  freshProgress,
  loadProgress,
  recordDailyClear,
  saveProgress,
  spendPoints,
} from '../core/storage';
import { playClear } from './celebrate';
import { h, homeButton, withRuby } from './dom';
import { KEY_DELETE, renderKeyboard } from './keyboard';
import { openResult } from './result';
import { TEXT } from './text';

const other = (dir: Dir): Dir => (dir === 'across' ? 'down' : 'across');

/** 盤面の画面を作る。もどり値は、画面をはなれるときの後かたづけ */
export function renderGame(
  root: HTMLElement,
  puzzle: Puzzle,
  title: string,
  mode: Mode,
  dailyDate?: string,
): () => void {
  const t = TEXT[mode];
  const n = puzzle.size;
  const solution = solutionGrid(puzzle);
  let progress = loadProgress(puzzle);
  const revealed = new Set(progress.revealed);
  const wrong = new Set<number>();
  const romaji = new RomajiInput();

  // 読みやすいよう、カギはヨコ→タテの順、番号順にならべる
  const entries = puzzle.entries
    .slice()
    .sort((a, b) => (a.dir === b.dir ? a.num - b.num : a.dir === 'across' ? -1 : 1));
  const cellsOf = entries.map((e) => entryCells(e, n));
  const entryAt: Record<Dir, number[]> = {
    across: new Array(n * n).fill(-1),
    down: new Array(n * n).fill(-1),
  };
  entries.forEach((e, i) => cellsOf[i].forEach((c) => (entryAt[e.dir][c] = i)));

  const first = entries[0];
  let sel = { idx: first.row * n + first.col, dir: first.dir };
  let lastTyped: number | null = null;

  // ---- 盤面 ----
  const cellEls: (HTMLButtonElement | null)[] = [];
  const charEls: (HTMLElement | null)[] = [];
  const board = h('div', { class: 'board', style: `--n:${n}` });
  const numberAt = new Map(puzzle.entries.map((e) => [e.row * n + e.col, e.num]));
  for (let idx = 0; idx < n * n; idx++) {
    if (solution[idx] === null) {
      cellEls.push(null);
      charEls.push(null);
      board.append(h('span', { class: 'gap' }));
      continue;
    }
    const ch = h('span', { class: 'ch' });
    const num = numberAt.get(idx);
    const cell = h(
      'button',
      {
        type: 'button',
        class: 'cell',
        'aria-label': `${Math.floor(idx / n) + 1}行 ${(idx % n) + 1}列`,
        onclick: () => select(idx),
      },
      num !== undefined && h('span', { class: 'num' }, String(num)),
      ch,
    );
    cellEls.push(cell);
    charEls.push(ch);
    board.append(cell);
  }

  // ---- カギの一覧 ----
  const clueEls: HTMLElement[] = [];
  const clueList = (dir: Dir) =>
    h(
      'ol',
      { class: 'clue-list' },
      ...entries.map((e, i) => {
        if (e.dir !== dir) return null;
        const btn = h(
          'button',
          { type: 'button', class: 'clue', onclick: () => select(cellsOf[i][0], e.dir) },
          h('span', { class: 'clue-num' }, String(e.num)),
          withRuby('span', 'clue-text', e.word.clue),
          h('span', { class: 'clue-len' }, t.len(e.answer.length)),
        );
        clueEls[i] = btn;
        return h('li', {}, btn);
      }),
    );
  const clues = h(
    'section',
    { class: 'clues', 'aria-label': 'カギの一覧' },
    h('h2', {}, t.cluesTitle.across),
    clueList('across'),
    h('h2', {}, t.cluesTitle.down),
    clueList('down'),
  );

  // ---- 今えらんでいるカギ ----
  const nowTag = h('span', { class: 'now-tag' });
  const nowPos = h('span', { class: 'pos' });
  const nowClue = h('p', { class: 'now-clue' });
  const nowExample = h('p', { class: 'now-example' });
  const now = h(
    'div',
    { class: 'now' },
    h('button', { type: 'button', class: 'step', 'aria-label': '前のカギ', onclick: () => stepEntry(-1) }, '‹'),
    h('div', { class: 'now-body', 'aria-live': 'polite' }, h('p', { class: 'now-head' }, nowTag, nowPos), nowClue, nowExample),
    h('button', { type: 'button', class: 'step', 'aria-label': '次のカギ', onclick: () => stepEntry(1) }, '›'),
  );

  const status = h('p', { class: 'status', role: 'status' });
  const reviewBtn = h('button', { type: 'button', class: 'btn only-done', onclick: () => openResult(puzzle, { celebrate: false, mode }) }, t.showWords);
  const hintBtn = h('button', { type: 'button', class: 'btn only-playing', onclick: hint });
  // ヒントに使えるポイントを、ヒントのボタンのそばに出す
  const pointsNum = h('b', {});
  const pointsBox = h('p', { class: 'tools-points' }, t.pointsLabel, pointsNum);
  const tools = h(
    'div',
    { class: 'tools' },
    h('button', { type: 'button', class: 'btn only-playing', onclick: check }, t.check),
    hintBtn,
    reviewBtn,
    // ヒントのボタンのすぐあとに置く。せまい画面では次の行の左、広い画面ではヒントの右にならぶ
    pointsBox,
    h('button', { type: 'button', class: 'btn btn-quiet', onclick: restart }, t.restart),
    status,
  );

  const page = h(
    'div',
    { class: n > 10 ? 'game game-big' : 'game' },
    h(
      'header',
      { class: 'bar' },
      homeButton(t.goHome),
      h('h1', {}, title),
      h('span', { class: 'bar-meta' }, t.words(entries.length)),
    ),
    h('div', { class: 'play' }, h('div', { class: 'board-scroll' }, board), clues),
    h('div', { class: 'dock' }, now, tools, renderKeyboard(onScreenKey)),
  );
  root.replaceChildren(page);

  // ---- 表示の更新 ----
  function paintCell(idx: number): void {
    const cell = cellEls[idx]!;
    charEls[idx]!.textContent = progress.cells[idx];
    cell.classList.toggle('is-revealed', revealed.has(idx));
    cell.classList.toggle('is-wrong', wrong.has(idx));
  }

  function paintSelection(scroll = true): void {
    const active = entryAt[sel.dir][sel.idx];
    const inWord = new Set(cellsOf[active]);
    cellEls.forEach((cell, idx) => {
      if (!cell) return;
      cell.classList.toggle('in-word', inWord.has(idx));
      cell.classList.toggle('is-active', idx === sel.idx);
      if (idx === sel.idx) cell.dataset.pending = romaji.pending;
      else delete cell.dataset.pending;
    });
    clueEls.forEach((el, i) => {
      el.classList.toggle('is-active', i === active);
      el.classList.toggle('is-filled', cellsOf[i].every((c) => progress.cells[c] !== ''));
    });
    const e: Entry = entries[active];
    nowTag.textContent = `${t.dir[e.dir]} ${e.num}`;
    nowPos.textContent = t.meta(e.word.pos, e.answer.length);
    nowClue.replaceChildren(...withRuby('span', '', e.word.clue).childNodes);
    nowExample.replaceChildren(...withRuby('span', '', `${t.example}${e.word.example}`).childNodes);
    if (scroll) {
      cellEls[sel.idx]!.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      // カギの一覧が横にならぶ広い画面でだけ、一覧も追いかける
      if (getComputedStyle(clues).overflowY === 'auto') clueEls[active].scrollIntoView({ block: 'nearest' });
    }
  }

  function select(idx: number, dir?: Dir): void {
    let next = dir ?? sel.dir;
    if (dir === undefined && idx === sel.idx && entryAt[other(sel.dir)][idx] >= 0) next = other(sel.dir);
    if (entryAt[next][idx] < 0) next = other(next);
    sel = { idx, dir: next };
    lastTyped = null;
    romaji.reset();
    paintSelection();
  }

  function stepEntry(delta: number): void {
    const i = (entryAt[sel.dir][sel.idx] + delta + entries.length) % entries.length;
    // まだ空いているマスがあれば、そこから始める
    const start = cellsOf[i].find((c) => progress.cells[c] === '') ?? cellsOf[i][0];
    select(start, entries[i].dir);
  }

  function moveInWord(delta: number): boolean {
    const cells = cellsOf[entryAt[sel.dir][sel.idx]];
    const next = cells[cells.indexOf(sel.idx) + delta];
    if (next === undefined) return false;
    sel = { idx: next, dir: sel.dir };
    return true;
  }

  function moveByArrow(dr: number, dc: number): void {
    let r = Math.floor(sel.idx / n) + dr;
    let c = (sel.idx % n) + dc;
    while (r >= 0 && c >= 0 && r < n && c < n) {
      if (solution[r * n + c] !== null) {
        select(r * n + c, dc !== 0 ? 'across' : 'down');
        return;
      }
      r += dr;
      c += dc;
    }
  }

  // ---- 入力 ----
  function setCell(idx: number, ch: string): void {
    if (revealed.has(idx) || progress.done) return;
    progress.cells[idx] = ch;
    wrong.delete(idx);
    paintCell(idx);
  }

  function afterEdit(): void {
    status.textContent = '';
    saveProgress(puzzle.id, progress);
    paintSelection();
    if (!progress.done && progress.cells.every((c, i) => solution[i] === null || c === solution[i])) finish();
  }

  function typeKana(ch: string): void {
    setCell(sel.idx, ch);
    lastTyped = revealed.has(sel.idx) ? null : sel.idx;
    moveInWord(1);
    afterEdit();
  }

  function erase(): void {
    romaji.reset();
    lastTyped = null;
    if (progress.cells[sel.idx] === '' || revealed.has(sel.idx)) moveInWord(-1);
    setCell(sel.idx, '');
    afterEdit();
  }

  function addMark(mark: '゛' | '゜'): void {
    // 字を入れるとカーソルが先へ進むので、いま入れたばかりの字に付ける
    const target = lastTyped ?? sel.idx;
    const marked = toggleMark(progress.cells[target], mark);
    if (marked === null || revealed.has(target)) return;
    setCell(target, marked);
    afterEdit();
  }

  function onScreenKey(key: string): void {
    romaji.reset();
    if (key === KEY_DELETE) erase();
    else if (key === '゛' || key === '゜') addMark(key);
    else typeKana(key);
  }

  function onKeyDown(ev: KeyboardEvent): void {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || document.querySelector('dialog[open], .fx')) return;
    const target = ev.target as HTMLElement;
    const onControl = target.closest('button, a, summary') !== null;
    const arrows: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (arrows[ev.key]) {
      ev.preventDefault();
      moveByArrow(...arrows[ev.key]);
    } else if (ev.key === 'Backspace' || ev.key === 'Delete') {
      ev.preventDefault();
      erase();
    } else if (ev.key === ' ' && (!onControl || target.classList.contains('cell'))) {
      ev.preventDefault();
      select(sel.idx);
    } else if (/^[a-zA-Z-]$/.test(ev.key)) {
      ev.preventDefault();
      for (const ch of romaji.feed(ev.key)) typeKana(ch);
      paintSelection(false);
    } else if (ev.key.length === 1 && isGridKana(normalizeKana(ev.key))) {
      // かな入力のキーボード
      ev.preventDefault();
      romaji.reset();
      typeKana(normalizeKana(ev.key));
    } else if (ev.key === '゛' || ev.key === '゜') {
      ev.preventDefault();
      addMark(ev.key);
    }
  }

  // ---- こたえあわせ・ヒント ----
  function check(): void {
    wrong.clear();
    let filled = 0;
    let total = 0;
    progress.cells.forEach((c, i) => {
      if (solution[i] === null) return;
      total++;
      if (c === '') return;
      filled++;
      if (c !== solution[i]) wrong.add(i);
    });
    cellEls.forEach((cell, i) => cell && paintCell(i));
    if (filled === 0) status.textContent = t.statusEmpty;
    else if (wrong.size > 0) status.textContent = t.statusWrong(wrong.size);
    else if (filled < total) status.textContent = t.statusOk(total - filled);
  }

  function hint(): void {
    if (progress.done) return;
    const idx = sel.idx;
    if (progress.cells[idx] === solution[idx]) {
      status.textContent = t.hintAlready;
      return;
    }
    // 無料の回数を使い切ったら、1 回ごとにポイントがいる
    const paid = hintsUsed() >= FREE_HINTS;
    if (paid && !spendPoints(HINT_COST)) {
      status.textContent = t.hintShort(balance());
      return;
    }
    progress.hints = hintsUsed() + 1;
    progress.cells[idx] = solution[idx]!;
    revealed.add(idx);
    progress.revealed = [...revealed];
    wrong.delete(idx);
    paintCell(idx);
    lastTyped = null;
    romaji.reset();
    moveInWord(1);
    afterEdit();
    paintHintButton();
    if (paid && !progress.done) status.textContent = t.hintSpent(balance());
  }

  /** このパズルでヒントを使った回数 (回数を記録する前の途中経過は、開けたマスの数で数える) */
  function hintsUsed(): number {
    return progress.hints ?? progress.revealed.length;
  }

  function paintHintButton(): void {
    const left = FREE_HINTS - hintsUsed();
    hintBtn.textContent = left > 0 ? t.hintFree(left) : t.hintPaid;
    pointsNum.textContent = t.points(balance());
  }

  function finish(): void {
    progress.done = true;
    saveProgress(puzzle.id, progress);
    if (dailyDate) recordDailyClear(dailyDate, mode);
    // スタンプは初級・上級で共通。同じ日に両方クリアしても 1 個
    const stamp = dailyDate ? addStamp(dailyDate) : undefined;
    const clearPoints = addClear(puzzle.id);
    page.classList.add('is-done');
    // 記録をすませてから演出を出す。出てきた言葉が 1 つずつ大きくなって、ばくはつする
    void playClear(entries.map((e) => e.word.reading)).then(() => {
      if (!page.isConnected) return; // 演出のとちゅうで、ほかの画面にうつった
      openResult(puzzle, {
        celebrate: true,
        mode,
        clearPoints,
        streak: dailyDate ? currentStreak(dailyDate, mode) : undefined,
        stamp,
        month: dailyDate ? Number(dailyDate.slice(5, 7)) : undefined,
      });
    });
  }

  function restart(): void {
    if (!confirm(t.restartConfirm)) return;
    // ヒントの回数は、やりなおしてももどさない
    const used = hintsUsed();
    progress = freshProgress(puzzle);
    progress.hints = used;
    revealed.clear();
    wrong.clear();
    saveProgress(puzzle.id, progress);
    page.classList.remove('is-done');
    status.textContent = '';
    cellEls.forEach((cell, i) => cell && paintCell(i));
    select(first.row * n + first.col, first.dir);
  }

  cellEls.forEach((cell, i) => cell && paintCell(i));
  paintHintButton();
  page.classList.toggle('is-done', progress.done);
  paintSelection(false);
  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
}
