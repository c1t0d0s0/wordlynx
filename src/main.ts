import './styles.css';
import { generateDaily } from './core/generator';
import { jstDate } from './core/puzzle';
import { WORDS } from './data/words';
import { renderGame } from './ui/game';
import { renderHome, stageByNumber } from './ui/home';

const app = document.getElementById('app')!;
let cleanup: (() => void) | null = null;

function route(): void {
  cleanup?.();
  cleanup = null;
  document.querySelectorAll('dialog').forEach((d) => d.remove());

  const path = location.hash.replace(/^#\/?/, '');
  const stage = path.match(/^stage\/(\d+)$/);
  const puzzle = stage ? stageByNumber(Number(stage[1])) : undefined;
  if (path === 'daily') {
    const today = jstDate();
    cleanup = renderGame(app, generateDaily(WORDS, today), '今日のパズル', today);
  } else if (stage && puzzle) {
    const num = Number(stage[1]);
    cleanup = renderGame(app, puzzle, num > 8 ? `チャレンジ ${num}` : `ステージ ${num}`);
  } else {
    renderHome(app);
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
