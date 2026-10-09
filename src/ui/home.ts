import { dailyId } from '../core/generator';
import { jstDate, type Mode, type Puzzle } from '../core/puzzle';
import { currentStreak, getMode, pruneOldDaily, setMode, statusOf } from '../core/storage';
import presetsEasy from '../data/presets-easy.json';
import presets from '../data/presets.json';
import { h, hanamaru } from './dom';
import { lynx } from './lynx';
import { stampCard } from './stamps';
import { TEXT, type Text } from './text';

const STAGES: Record<Mode, Puzzle[]> = {
  standard: presets as Puzzle[],
  easy: presetsEasy as Puzzle[],
};

/** モードごとの URL。上級むけは #/daily、初級むけは #/easy/daily */
const link = (mode: Mode, path: string) => (mode === 'easy' ? `#/easy/${path}` : `#/${path}`);

/** 「くまなく」と「こよなく」が「な」で交わる、タイトルのかざり */
function crest(): HTMLElement {
  const el = h('div', { class: 'crest', 'aria-hidden': 'true' });
  const across = 'くまなく';
  const down = 'こよなく';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const ch = r === 2 ? across[c] : c === 2 ? down[r] : '';
      el.append(ch ? h('span', { class: r === 2 && c === 2 ? 'crest-cell crest-cross' : 'crest-cell' }, ch) : h('span'));
    }
  }
  return el;
}

function modeSwitch(root: HTMLElement, current: Mode): HTMLElement {
  const option = (mode: Mode, label: string, note: string) => {
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'mode-option',
        'aria-pressed': String(mode === current),
        onclick: () => {
          if (mode === current) return;
          setMode(mode);
          renderHome(root);
        },
      },
      h('span', { class: 'mode-label' }),
      h('span', { class: 'mode-note' }, note),
    );
    btn.firstElementChild!.innerHTML = label;
    return btn;
  };
  return h(
    'div',
    { class: 'mode', role: 'group', 'aria-label': 'モードの切りかえ' },
    option('easy', '<ruby>初級<rt>しょきゅう</rt></ruby>', 'やさしい 言葉'),
    option('standard', '<ruby>上級<rt>じょうきゅう</rt></ruby>', 'むずかしい 言葉'),
  );
}

function stageTile(stage: Puzzle, index: number, mode: Mode, t: Text): HTMLElement {
  const status = statusOf(stage.id);
  return h(
    'a',
    { class: `tile tile-${status}`, href: link(mode, `stage/${index + 1}`) },
    h('span', { class: 'tile-num' }, String(index + 1)),
    h('span', { class: 'tile-meta' }, t.words(stage.entries.length)),
    status === 'done' ? hanamaru('hanamaru hanamaru-small') : null,
    status !== 'new' && h('span', { class: 'tile-status' }, status === 'done' ? t.cleared : t.playing),
  );
}

export function renderHome(root: HTMLElement): void {
  const mode = getMode();
  const t = TEXT[mode];
  const stages = STAGES[mode];
  const today = jstDate();
  pruneOldDaily(today);
  const dailyStatus = statusOf(dailyId(today, mode));
  const streak = currentStreak(today, mode);
  const dailyAction = { new: t.start, playing: t.resume, done: t.review }[dailyStatus];
  const d = new Date(`${today}T00:00:00Z`);

  root.replaceChildren(
    h(
      'main',
      { class: 'home' },
      h(
        'header',
        { class: 'hero' },
        crest(),
        h('div', { class: 'hero-text' }, h('h1', { class: 'brand' }, 'Wordlynx'), h('p', { class: 'lead' }, t.lead)),
        lynx(),
      ),
      modeSwitch(root, mode),
      h(
        'section',
        { class: 'daily', 'aria-labelledby': 'daily-title' },
        h(
          'div',
          { class: 'daily-text' },
          h('h2', { id: 'daily-title' }, t.daily),
          h('p', { class: 'daily-date' }, t.dateLabel(d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCDay())),
          h('p', { class: 'daily-note' }, t.dailyNote(dailyStatus === 'done', streak)),
        ),
        dailyStatus === 'done' ? hanamaru('hanamaru hanamaru-daily') : null,
        h('a', { class: 'btn btn-primary', href: link(mode, 'daily') }, dailyAction),
      ),
      stampCard(t),
      h(
        'section',
        { 'aria-labelledby': 'stage-title' },
        h('h2', { id: 'stage-title' }, t.stages),
        h('div', { class: 'tiles' }, ...stages.slice(0, 8).map((s, i) => stageTile(s, i, mode, t))),
      ),
      h(
        'section',
        { 'aria-labelledby': 'challenge-title' },
        h('h2', { id: 'challenge-title' }, t.challenge),
        h('p', { class: 'section-note' }, t.challengeNote),
        h('div', { class: 'tiles tiles-big' }, ...stages.slice(8).map((s, i) => stageTile(s, i + 8, mode, t))),
      ),
      h(
        'details',
        { class: 'howto' },
        h('summary', {}, t.howto),
        h('ul', {}, ...t.howtoItems.map((item) => h('li', {}, item))),
      ),
    ),
  );
}

export function stageByNumber(mode: Mode, n: number): Puzzle | undefined {
  return STAGES[mode][n - 1];
}
