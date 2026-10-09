import { jstDate, type Puzzle } from '../core/puzzle';
import { currentStreak, pruneOldDaily, statusOf, type Status } from '../core/storage';
import presets from '../data/presets.json';
import { h, hanamaru } from './dom';

const STAGES = presets as Puzzle[];
const WEEKDAYS = '日月火水木金土';

function dateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${WEEKDAYS[d.getUTCDay()]}）`;
}

const STATUS_TEXT: Record<Status, string> = { new: '', playing: 'とちゅう', done: 'クリア' };

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

function stageTile(stage: Puzzle, index: number): HTMLElement {
  const status = statusOf(stage.id);
  return h(
    'a',
    { class: `tile tile-${status}`, href: `#/stage/${index + 1}` },
    h('span', { class: 'tile-num' }, String(index + 1)),
    h('span', { class: 'tile-meta' }, `${stage.entries.length}語`),
    status === 'done' ? hanamaru('hanamaru hanamaru-small') : null,
    status !== 'new' && h('span', { class: 'tile-status' }, STATUS_TEXT[status]),
  );
}

export function renderHome(root: HTMLElement): void {
  const today = jstDate();
  pruneOldDaily(today);
  const dailyStatus = statusOf(`daily-${today}`);
  const streak = currentStreak(today);
  const dailyAction = { new: 'はじめる', playing: 'つづきから', done: 'もういちど見る' }[dailyStatus];

  root.replaceChildren(
    h(
      'main',
      { class: 'home' },
      h(
        'header',
        { class: 'hero' },
        crest(),
        h(
          'div',
          {},
          h('h1', { class: 'brand' }, 'Wordlynx'),
          h('p', { class: 'lead' }, '入試によく出る言葉を、クロスワードでおぼえよう。'),
        ),
      ),
      h(
        'section',
        { class: 'daily', 'aria-labelledby': 'daily-title' },
        h(
          'div',
          { class: 'daily-text' },
          h('h2', { id: 'daily-title' }, '今日のパズル'),
          h('p', { class: 'daily-date' }, dateLabel(today)),
          h(
            'p',
            { class: 'daily-note' },
            dailyStatus === 'done'
              ? streak > 1
                ? `クリアずみ。${streak}日つづいているよ。`
                : 'クリアずみ。あしたも新しい問題が出るよ。'
              : streak > 0
                ? `${streak}日つづけてクリア中。今日もやってみよう。`
                : '毎日ひとつ、みんなに同じ問題が出るよ。',
          ),
        ),
        dailyStatus === 'done' ? hanamaru('hanamaru hanamaru-daily') : null,
        h('a', { class: 'btn btn-primary', href: '#/daily' }, dailyAction),
      ),
      h(
        'section',
        { 'aria-labelledby': 'stage-title' },
        h('h2', { id: 'stage-title' }, 'ステージ'),
        h('div', { class: 'tiles' }, ...STAGES.slice(0, 8).map((s, i) => stageTile(s, i))),
      ),
      h(
        'section',
        { 'aria-labelledby': 'challenge-title' },
        h('h2', { id: 'challenge-title' }, 'チャレンジ'),
        h('p', { class: 'section-note' }, 'たて20マス、よこ20マスの大きな盤面。時間のあるときにどうぞ。'),
        h('div', { class: 'tiles tiles-big' }, ...STAGES.slice(8).map((s, i) => stageTile(s, i + 8))),
      ),
      h(
        'details',
        { class: 'howto' },
        h('summary', {}, 'あそびかた'),
        h(
          'ul',
          {},
          h('li', {}, 'マスをえらんで、カギ（言葉の意味）に合う言葉をひらがなで入れます。'),
          h('li', {}, '同じマスをもういちどおすと、タテとヨコが切りかわります。'),
          h('li', {}, '小さい「っ・ゃ・ゅ・ょ」は大きい字で入れます。「ちゃっかり」は「ちやつかり」です。'),
          h('li', {}, '「゛」「゜」は、字を入れたあとにおします。'),
          h('li', {}, 'パソコンでは、半角のローマ字で入力できます。矢印キーで動き、スペースキーでタテとヨコを切りかえます。'),
          h('li', {}, 'まよったら「こたえあわせ」や「ヒント」を使えます。'),
        ),
      ),
    ),
  );
}

export function stageByNumber(n: number): Puzzle | undefined {
  return STAGES[n - 1];
}
