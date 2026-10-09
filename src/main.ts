import './styles.css';
import { generateDaily } from './core/generator';
import { jstDate, type Mode } from './core/puzzle';
import { migrateRewards } from './core/storage';
import { EASY_WORDS, WORDS } from './data/words';
import { renderCards } from './ui/cards';
import { renderGame } from './ui/game';
import { renderHome, stageByNumber } from './ui/home';
import { TEXT } from './ui/text';

// 前から遊んでいた人の記録を、スタンプとポイントに引きつぐ (最初の 1 回だけ)
migrateRewards();

const app = document.getElementById('app')!;
let cleanup: (() => void) | null = null;

function route(): void {
  cleanup?.();
  cleanup = null;
  document.querySelectorAll('dialog').forEach((d) => d.remove());

  // #/daily, #/stage/3 は上級むけ。#/easy/daily, #/easy/stage/3 は初級むけ
  const match = location.hash.match(/^#\/(easy\/)?(daily|stage\/(\d+))$/);
  const mode: Mode = match?.[1] ? 'easy' : 'standard';
  const t = TEXT[mode];
  const num = Number(match?.[3]);
  const stage = match?.[3] ? stageByNumber(mode, num) : undefined;
  if (match?.[2] === 'daily') {
    const today = jstDate();
    const words = mode === 'easy' ? EASY_WORDS : WORDS;
    cleanup = renderGame(app, generateDaily(words, today, mode), t.daily, mode, today);
  } else if (stage) {
    cleanup = renderGame(app, stage, num > 8 ? t.challengeTitle(num) : t.stageTitle(num), mode);
  } else if (location.hash === '#/cards') {
    renderCards(app);
  } else {
    renderHome(app);
  }
  document.documentElement.dataset.mode = match ? mode : '';
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
