import { h } from './dom';
import { playBoom, playFinale, playRise, primeSound } from './sound';

const COLORS = ['#d63c2c', '#ffd23f', '#6aa893', '#4a90e2', '#f28f86', '#8b6fd6'];
const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** 全部の言葉を見せるのにかける時間のめやす。言葉が多いステージでは 1 語あたりを短くする */
const TOTAL_MS = 5500;
const WORD_MS_MIN = 120;
const WORD_MS_MAX = 600;
/** ふくらみきったときの大きさ (もとの何倍か) */
const GROW = 1.45;
/** 演出が始まってから、飛ばす操作を受けつけるまでの時間 */
const SKIP_GUARD_MS = 500;

/**
 * クリアしたときの演出。出てきた言葉が 1 つずつ大きくふくらんで、ばくはつする。
 * 画面をおすかキーをおすと、とちゅうで飛ばせる。動きをへらす設定の人には出さない。
 * もどり値は、演出が終わったら (飛ばしたときも) 解決する。
 */
export function playClear(words: string[]): Promise<void> {
  if (words.length === 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();

  primeSound();
  return new Promise((resolve) => {
    const overlay = h('div', { class: 'fx', role: 'presentation' });
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve();
    };
    // 最後の字を入れたいきおいでおしたキーやタップで、すぐ飛ばしてしまわないよう、はじめの少しの間は受けつけない
    const armedAt = performance.now() + SKIP_GUARD_MS;
    const skip = () => {
      if (performance.now() >= armedAt) finish();
    };
    const onKey = (ev: KeyboardEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      skip();
    };
    overlay.addEventListener('pointerdown', skip);
    document.addEventListener('keydown', onKey, true);
    document.body.append(overlay);

    const wordMs = Math.min(WORD_MS_MAX, Math.max(WORD_MS_MIN, TOTAL_MS / words.length));
    const growMs = wordMs * 0.62;
    const boomMs = Math.max(420, wordMs * 0.9);
    const many = words.length > 20;

    /** 色つきのかけらを、まん中から四方に飛ばす */
    const burst = (count: number, reach: number, ms: number) => {
      for (let i = 0; i < count; i++) {
        const bit = h('span', { class: Math.random() < 0.35 ? 'fx-bit fx-star' : 'fx-bit' });
        const size = rand(0.7, 1.9);
        bit.style.width = bit.style.height = `${size}rem`;
        bit.style.background = COLORS[i % COLORS.length];
        overlay.append(bit);
        const angle = rand(0, Math.PI * 2);
        const dist = rand(0.35, 1) * reach;
        bit
          .animate(
            [
              { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 1 },
              {
                transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist + reach * 0.25}px)) scale(1) rotate(${rand(-540, 540)}deg)`,
                opacity: 0,
              },
            ],
            { duration: ms * rand(0.8, 1.3), easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)', fill: 'forwards' },
          )
          .finished.then(() => bit.remove(), () => {});
      }
    };

    const showWord = async (word: string): Promise<void> => {
      const reach = Math.max(innerWidth, innerHeight) * 0.55;
      const el = h('div', { class: 'fx-word' });
      // 長い言葉でも、ふくらみきったときに画面のはばに入る大きさにする
      el.style.fontSize = `min(8rem, ${92 / GROW / Math.max(word.length, 2)}vw, 24vh)`;
      const chars = [...word].map((ch) => h('span', { class: 'fx-char' }, ch));
      el.append(...chars);
      overlay.append(el);

      // 小さく出てきて、ぐんと大きくなる
      // (言葉が多いステージでは音が重なりすぎるので、ふくらむ音は出さず、ばくはつの音も小さめにする)
      if (!many) playRise(growMs);
      await el
        .animate(
          [
            { transform: 'translate(-50%, -50%) scale(0.15) rotate(-8deg)', opacity: 0 },
            { transform: 'translate(-50%, -50%) scale(0.9) rotate(3deg)', opacity: 1, offset: 0.45 },
            { transform: `translate(-50%, -50%) scale(${GROW}) rotate(0deg)`, opacity: 1 },
          ],
          { duration: growMs, easing: 'cubic-bezier(0.3, 1.4, 0.5, 1)', fill: 'forwards' },
        )
        .finished.catch(() => {});
      if (finished) return;

      // ばくはつ: 輪が広がり、字がばらばらに飛びちる
      // (画面全体を光らせたり暗くしたりはしない。ちかちかして気分が悪くなるため)
      const ring = h('span', { class: 'fx-ring' });
      overlay.append(ring);
      ring
        .animate(
          [
            { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0.9 },
            { transform: 'translate(-50%, -50%) scale(7)', opacity: 0 },
          ],
          { duration: boomMs, easing: 'ease-out', fill: 'forwards' },
        )
        .finished.then(() => ring.remove(), () => {});
      playBoom(many ? 0.45 : 0.9);
      burst(many ? 14 : 34, reach, boomMs * 1.4);

      el.style.transform = `translate(-50%, -50%) scale(${GROW})`;
      const mid = (chars.length - 1) / 2;
      chars.forEach((ch, i) => {
        const angle = chars.length === 1 ? rand(0, Math.PI * 2) : Math.atan2(rand(-1, 1), i - mid + rand(-0.4, 0.4));
        const dist = rand(0.5, 1) * reach;
        ch.animate(
          [
            { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
            {
              transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(${rand(1.4, 2.6)}) rotate(${rand(-360, 360)}deg)`,
              opacity: 0,
            },
          ],
          { duration: boomMs, easing: 'cubic-bezier(0.15, 0.6, 0.3, 1)', fill: 'forwards' },
        );
      });
      setTimeout(() => el.remove(), boomMs);
    };

    void (async () => {
      // 次の言葉は、前の言葉がふくらみきるころに出す。
      // 前のアニメーションが終わるのを待つと、言葉が多いステージで少しずつおくれて長くなるので、時間で区切る
      for (const word of words) {
        if (finished) return;
        void showWord(word);
        await new Promise((r) => setTimeout(r, growMs));
      }
      await new Promise((r) => setTimeout(r, 120));
      if (finished) return;
      // さいごに、いちばん大きな花火
      playFinale();
      burst(90, Math.max(innerWidth, innerHeight) * 0.8, 1100);
      setTimeout(finish, 800);
    })();
  });
}
