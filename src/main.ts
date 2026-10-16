import './styles.css';
import { generateDaily } from './core/generator';
import { restoreStore, startCloud } from './cloud';
import { jstDate, type Mode } from './core/puzzle';
import { applyGrade, getMode, migrateCardPrices, migrateMode, migrateRewards } from './core/storage';
import { CARDS } from './data/cards';
import { EASY_WORDS, WORDS } from './data/words';
import { renderCards } from './ui/cards';
import { renderGame } from './ui/game';
import { renderHome, stageByNumber } from './ui/home';
import { renderStamps } from './ui/stamps';
import { TEXT } from './ui/text';

// 前にログインしていた人がいれば、通信を待たずに、この端末に残っているその人の写しで画面を出す
restoreStore();

// 前から遊んでいた人の記録を、スタンプとポイントに引きつぐ (最初の 1 回だけ)
migrateMode(); // migrateRewards が記録を書く前に、前から遊んでいた人かどうかを見る
applyGrade(location.search); // ?grade=3 などが付いていたら、その学年向けのモードにする
migrateRewards();
migrateCardPrices(CARDS); // 値下げ前にカードを交換していた人に、差額を返す

const app = document.getElementById('app')!;
let cleanup: (() => void) | null = null;

function route(): void {
  cleanup?.();
  cleanup = null;
  document.querySelectorAll('dialog, .fx').forEach((d) => d.remove());

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
  } else if (location.hash === '#/stamps') {
    renderStamps(app);
  } else {
    renderHome(app);
  }
  document.documentElement.dataset.mode = match ? mode : '';
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();

// 最初の画面を出してから、ログインと Firestore の準備をする (Firebase の設定がないビルドでは何もしない)
void startCloud({
  // ログインやほぞんの状態が変わった。状態を出しているのはタイトル画面だけ
  onStatus: () => {
    if (app.querySelector('.home')) renderHome(app);
  },
  // Firestore から取りこんで、手元の記録が変わった。今の画面をかき直す
  onData: () => {
    migrateCardPrices(CARDS); // ほかの端末で、値下げ前の値段で交換した記録が入ってくることがある
    route();
  },
  askMigrate: () => confirm(TEXT[getMode()].askMigrate),
});
