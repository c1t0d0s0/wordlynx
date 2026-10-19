import './styles.css';
import { DAILY_SIZE, STAGE_COUNT, generateDaily, stageSpec } from './core/generator';
import { restoreStore, startCloud } from './cloud';
import { jstDate, type Mode } from './core/puzzle';
import { applyGrade, getMode, migrateCardPrices, migrateMode, migrateRewards } from './core/storage';
import { CARDS } from './data/cards';
import { EASY_WORDS, WORDS } from './data/words';
import { renderBattle } from './ui/battle';
import { renderCards } from './ui/cards';
import { renderGame } from './ui/game';
import { h } from './ui/dom';
import { renderHome, stageFor } from './ui/home';
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
  const stage = num >= 1 && num <= STAGE_COUNT;
  // #/battle は、たいせんの入口。#/battle/12345 は、その対戦コードの部屋
  const battle = location.hash.match(/^#\/battle(?:\/(\d{5}))?$/);
  if (match?.[2] === 'daily') {
    const today = jstDate();
    const words = mode === 'easy' ? EASY_WORDS : WORDS;
    cleanup = renderGame(app, generateDaily(words, today, mode), t.daily, mode, today);
  } else if (stage) {
    // ステージは今月のもの。開くときに作る
    const today = jstDate();
    const open = () => renderGame(app, stageFor(mode, num, today), num > 8 ? t.challengeTitle(num) : t.stageTitle(num), mode);
    if (stageSpec(num, mode).size <= DAILY_SIZE) {
      cleanup = open();
    } else {
      // 20×20 は作るのに時間がかかるので、先に「作っています」を出して、画面が止まって見えないようにする
      // (requestAnimationFrame のあとの setTimeout なら、「作っています」がかならず一度描かれてから作りはじめる)
      app.replaceChildren(h('main', { class: 'making' }, h('p', {}, t.making)));
      let timer: ReturnType<typeof setTimeout> | undefined;
      const frame = requestAnimationFrame(() => (timer = setTimeout(() => (cleanup = open()))));
      cleanup = () => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
      };
    }
  } else if (battle) {
    cleanup = renderBattle(app, battle[1]);
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
