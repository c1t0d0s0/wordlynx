import { STAGE_COUNT, dailyId, generateStage, stageId, stageMonth, stageSpec } from '../core/generator';
import { jstDate, type Mode, type Puzzle } from '../core/puzzle';
import { balance, currentStreak, getMode, getSound, pruneOldProgress, setMode, setSound, statusOf } from '../core/storage';
import { EASY_WORDS, WORDS } from '../data/words';
import { battleAvailable } from '../cloud/config';
import { accountBox } from './account';
import { h, hanamaru } from './dom';
import { lynx } from './lynx';
import { BATTLE, TEXT, type Text } from './text';

/** 右の列を出す画面のはば (styles.css の .home と同じ値) */
const WIDE = '(min-width: 64rem)';

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

/** クリアしたときの効果音を鳴らすかどうかの切りかえ */
function soundSwitch(t: Text): HTMLElement {
  const btn = h('button', { type: 'button', class: 'btn sound-switch' });
  const paint = () => {
    const on = getSound();
    btn.textContent = on ? t.soundOn : t.soundOff;
    btn.setAttribute('aria-pressed', String(on));
  };
  btn.addEventListener('click', () => {
    setSound(!getSound());
    paint();
  });
  paint();
  return h('p', { class: 'settings' }, btn);
}

// タイルには状態と語数しか出さないので、タイトル画面では盤面を作らない (20×20 は作るのに時間がかかる)
function stageTile(month: string, n: number, mode: Mode, t: Text): HTMLElement {
  const status = statusOf(stageId(month, n, mode));
  return h(
    'a',
    { class: `tile tile-${status}`, href: link(mode, `stage/${n}`) },
    h('span', { class: 'tile-num' }, String(n)),
    // 横長のタイルは 2 行分しか入らないので、遊んだあとは語数のかわりに「クリア」「とちゅう」を出す
    status === 'new'
      ? h('span', { class: 'tile-meta' }, t.words(stageSpec(n, mode).words))
      : h('span', { class: 'tile-meta tile-status' }, status === 'done' ? t.cleared : t.playing),
    status === 'done' ? hanamaru('hanamaru hanamaru-small') : null,
  );
}

export function renderHome(root: HTMLElement): void {
  const mode = getMode();
  const t = TEXT[mode];
  const today = jstDate();
  const month = stageMonth(today);
  const tiles = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => stageTile(month, from + i, mode, t));
  pruneOldProgress(today);
  const dailyStatus = statusOf(dailyId(today, mode));
  const streak = currentStreak(today, mode);
  const dailyAction = { new: t.start, playing: t.resume, done: t.review }[dailyStatus];
  const d = new Date(`${today}T00:00:00Z`);

  root.replaceChildren(
    h(
      'main',
      { class: 'home' },
      h(
        'div',
        { class: 'home-main' },
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
        // たいせんは、Realtime Database の設定が入っているビルドでだけ出す
        battleAvailable
          ? h(
              'section',
              { class: 'battle-entry', 'aria-labelledby': 'battle-title' },
              h(
                'div',
                { class: 'battle-entry-text' },
                h('h2', { id: 'battle-title' }, BATTLE.title),
                h('p', { class: 'section-note' }, BATTLE.homeNote),
              ),
              h('a', { class: 'btn', href: '#/battle' }, BATTLE.homeButton),
            )
          : null,
        // スタンプカードとヤマネコカードは、それぞれのページで見る
        h(
          'nav',
          { class: 'reward-links', 'aria-label': t.rewardLinks },
          h('p', { class: 'points' }, h('span', { class: 'points-label' }, t.pointsLabel), h('b', { class: 'points-num' }, t.points(balance()))),
          h(
            'div',
            { class: 'reward-buttons' },
            h('a', { class: 'btn', href: '#/stamps' }, t.stampTitle),
            h('a', { class: 'btn', href: '#/cards' }, t.cardsTitle),
          ),
        ),
        h(
          'section',
          { 'aria-labelledby': 'stage-title' },
          h('h2', { id: 'stage-title' }, t.stages(d.getUTCMonth() + 1)),
          h('p', { class: 'section-note' }, t.stagesNote),
          h('div', { class: 'tiles' }, ...tiles(1, 8)),
        ),
        h(
          'section',
          { 'aria-labelledby': 'challenge-title' },
          h('h2', { id: 'challenge-title' }, t.challenge(d.getUTCMonth() + 1)),
          h('p', { class: 'section-note' }, t.challengeNote),
          h('div', { class: 'tiles tiles-big' }, ...tiles(9, STAGE_COUNT)),
        ),
      ),
      // あそびかた・音・記録の保存。広い画面では右の列にならべ、スクロールしなくても見えるようにする
      h(
        'aside',
        { class: 'home-side' },
        accountBox(t),
        h(
          'details',
          // 広い画面では場所があるので、はじめから開いておく
          { class: 'howto', open: matchMedia(WIDE).matches },
          h('summary', {}, t.howto),
          h('ul', {}, ...t.howtoItems.map((item) => h('li', {}, item))),
        ),
        soundSwitch(t),
      ),
    ),
  );
}

/** 今月のステージ n (1〜STAGE_COUNT) */
export function stageFor(mode: Mode, n: number, today: string): Puzzle {
  return generateStage(mode === 'easy' ? EASY_WORDS : WORDS, stageMonth(today), n, mode);
}
