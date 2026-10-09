import { jstDate } from '../core/puzzle';
import { WEEK_LENGTH, currentRun, monthView } from '../core/rewards';
import { balance, getStamps } from '../core/storage';
import { h, hanamaru } from './dom';
import type { Text } from './text';

const WEEKDAYS = '日月火水木金土';

/** タイトル画面のスタンプカード。今月のカレンダーに、クリアした日のスタンプをならべる */
export function stampCard(t: Text): HTMLElement {
  const today = jstDate();
  const month = today.slice(0, 7);
  const todayNum = Number(today.slice(8));
  const stamps = getStamps();
  const view = monthView(stamps, month);
  const firstWeekday = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const run = currentRun(stamps, today);

  const grid = h('div', { class: 'stamp-grid', role: 'list' });
  for (const w of WEEKDAYS) grid.append(h('span', { class: 'stamp-weekday', 'aria-hidden': 'true' }, w));
  for (let i = 0; i < firstWeekday; i++) grid.append(h('span', { 'aria-hidden': 'true' }));
  view.forEach((stamped, i) => {
    const day = i + 1;
    const cls = ['stamp-day', stamped && 'is-stamped', day === todayNum && 'is-today', day > todayNum && 'is-future']
      .filter(Boolean)
      .join(' ');
    grid.append(
      h(
        'span',
        { class: cls, role: 'listitem', 'aria-label': t.stampDayLabel(day, stamped) },
        h('span', { class: 'stamp-num', 'aria-hidden': 'true' }, String(day)),
        stamped ? hanamaru('hanamaru stamp-mark') : null,
      ),
    );
  });

  return h(
    'section',
    { class: 'stamp', 'aria-labelledby': 'stamp-title' },
    h(
      'div',
      { class: 'stamp-head' },
      h('h2', { id: 'stamp-title' }, t.stampTitle),
      h('span', { class: 'stamp-month' }, t.stampMonth(Number(month.slice(5)))),
    ),
    grid,
    h('p', { class: 'stamp-run' }, t.stampRun(run, WEEK_LENGTH - (run % WEEK_LENGTH))),
    h('p', { class: 'stamp-rule' }, t.stampRule),
    h(
      'div',
      { class: 'stamp-foot' },
      h('p', { class: 'points' }, h('span', { class: 'points-label' }, t.pointsLabel), h('b', { class: 'points-num' }, t.points(balance()))),
      h('a', { class: 'btn', href: '#/cards' }, t.seeCards),
    ),
  );
}
