import type { Dir, Mode, Pos } from '../core/puzzle';

/** 画面の文言。低学年モードは、3 年生までに習う漢字だけを使い、分かち書きにする */
export interface Text {
  lead: string;
  daily: string;
  dateLabel: (month: number, day: number, weekday: number) => string;
  dailyNote: (done: boolean, streak: number) => string;
  start: string;
  resume: string;
  review: string;
  stages: string;
  challenge: string;
  challengeNote: string;
  playing: string;
  cleared: string;
  words: (n: number) => string;
  howto: string;
  howtoItems: string[];
  stageTitle: (n: number) => string;
  challengeTitle: (n: number) => string;
  dir: Record<Dir, string>;
  cluesTitle: Record<Dir, string>;
  len: (n: number) => string;
  meta: (pos: Pos, n: number) => string;
  example: string;
  showPos: boolean;
  check: string;
  hint: string;
  showWords: string;
  restart: string;
  restartConfirm: string;
  statusEmpty: string;
  statusWrong: (n: number) => string;
  statusOk: (left: number) => string;
  hintAlready: string;
  resultDone: string;
  resultReview: string;
  resultSub: (words: number, streak?: number) => string;
  seeBoard: string;
  goHome: string;
}

const standard: Text = {
  lead: '入試によく出る言葉を、クロスワードでおぼえよう。',
  daily: '今日のパズル',
  dateLabel: (m, d, w) => `${m}月${d}日（${'日月火水木金土'[w]}）`,
  dailyNote: (done, streak) =>
    done
      ? streak > 1
        ? `クリアずみ。${streak}日つづいているよ。`
        : 'クリアずみ。あしたも新しい問題が出るよ。'
      : streak > 0
        ? `${streak}日つづけてクリア中。今日もやってみよう。`
        : '毎日ひとつ、みんなに同じ問題が出るよ。',
  start: 'はじめる',
  resume: 'つづきから',
  review: 'もういちど見る',
  stages: 'ステージ',
  challenge: 'チャレンジ',
  challengeNote: 'たて20マス、よこ20マスの大きな盤面。時間のあるときにどうぞ。',
  playing: 'とちゅう',
  cleared: 'クリア',
  words: (n) => `${n}語`,
  howto: 'あそびかた',
  howtoItems: [
    'マスをえらんで、カギ（言葉の意味）に合う言葉をひらがなで入れます。',
    '同じマスをもういちどおすと、タテとヨコが切りかわります。',
    '小さい「っ・ゃ・ゅ・ょ」は大きい字で入れます。「ちゃっかり」は「ちやつかり」です。',
    '「゛」「゜」は、字を入れたあとにおします。',
    'パソコンでは、半角のローマ字で入力できます。矢印キーで動き、スペースキーでタテとヨコを切りかえます。',
    'まよったら「こたえあわせ」や「ヒント」を使えます。',
  ],
  stageTitle: (n) => `ステージ ${n}`,
  challengeTitle: (n) => `チャレンジ ${n}`,
  dir: { across: 'ヨコ', down: 'タテ' },
  cluesTitle: { across: 'ヨコのカギ', down: 'タテのカギ' },
  len: (n) => `${n}文字`,
  meta: (pos, n) => `${pos}・${n}文字`,
  example: '例）',
  showPos: true,
  check: 'こたえあわせ',
  hint: 'ヒント',
  showWords: 'ことばを見る',
  restart: 'やりなおす',
  restartConfirm: '入れた字をすべて消して、さいしょからやりなおしますか？',
  statusEmpty: 'まだ字が入っていません。',
  statusWrong: (n) => `ちがう字が${n}マスあります。赤いマスを見直そう。`,
  statusOk: (left) => `ここまでは全部あっています。あと${left}マス。`,
  hintAlready: 'このマスはもうあっています。ほかのマスをえらんでね。',
  resultDone: 'よくできました',
  resultReview: 'ことばのふりかえり',
  resultSub: (words, streak) =>
    streak && streak > 1
      ? `${streak}日つづけてクリア。${words}この言葉をおさらいしよう。`
      : `出てきた${words}この言葉をおさらいしよう。`,
  seeBoard: '盤面を見る',
  goHome: 'ホームにもどる',
};

const easy: Text = {
  ...standard,
  lead: '言葉を つないで 遊ぼう。',
  daily: '今日の パズル',
  dailyNote: (done, streak) =>
    done
      ? streak > 1
        ? `クリアしたよ。${streak}日 つづいているね。`
        : 'クリアしたよ。明日も 新しい 問題が 出るよ。'
      : streak > 0
        ? `${streak}日 つづけて クリア中。今日も やってみよう。`
        : '毎日 ひとつ、新しい 問題が 出るよ。',
  review: 'もういちど 見る',
  challengeNote: 'たて20マス、よこ20マスの 大きな パズル。時間の ある ときに どうぞ。',
  words: (n) => `${n}こ`,
  howtoItems: [
    'マスを えらんで、ヒントに 合う 言葉を ひらがなで 入れます。',
    '同じ マスを もういちど おすと、たてと よこが かわります。',
    '「゛」「゜」は、字を 入れた あとに おします。',
    '分からない ときは「こたえあわせ」や「ヒント」を 使えます。',
  ],
  dir: { across: 'よこ', down: 'たて' },
  cluesTitle: { across: 'よこの ヒント', down: 'たての ヒント' },
  meta: (_pos, n) => `${n}文字`,
  example: 'れい）',
  showPos: false,
  showWords: '言葉を 見る',
  restartConfirm: '入れた 字を 全部 消して、さいしょから やりなおしますか？',
  statusEmpty: 'まだ 字が 入って いません。',
  statusWrong: (n) => `ちがう 字が ${n}マス あります。赤い マスを 見直そう。`,
  statusOk: (left) => `ここまでは 全部 合っています。あと ${left}マス。`,
  hintAlready: 'この マスは もう 合っています。ほかの マスを えらんでね。',
  resultReview: '言葉の ふりかえり',
  resultSub: (words, streak) =>
    streak && streak > 1
      ? `${streak}日 つづけて クリア。${words}この 言葉を おさらいしよう。`
      : `出てきた ${words}この 言葉を おさらいしよう。`,
  seeBoard: 'パズルを 見る',
  goHome: 'ホームに もどる',
};

export const TEXT: Record<Mode, Text> = { standard, easy };
