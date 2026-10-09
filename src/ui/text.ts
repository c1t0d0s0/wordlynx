import type { Dir, Mode, Pos } from '../core/puzzle';

/** 画面の文言。低学年モードは、漢字を使わずひらがなで書く */
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
  lead: 'ことばを つないで あそぼう。',
  daily: 'きょうの パズル',
  dateLabel: (m, d, w) => `${m}がつ${d}にち（${['にち', 'げつ', 'か', 'すい', 'もく', 'きん', 'ど'][w]}）`,
  dailyNote: (done, streak) =>
    done
      ? streak > 1
        ? `クリアしたよ。${streak}にち つづいているね。`
        : 'クリアしたよ。あしたも あたらしい もんだいが でるよ。'
      : streak > 0
        ? `${streak}にち つづけて クリアちゅう。きょうも やってみよう。`
        : 'まいにち ひとつ、あたらしい もんだいが でるよ。',
  start: 'はじめる',
  resume: 'つづきから',
  review: 'もういちど みる',
  stages: 'ステージ',
  challenge: 'チャレンジ',
  challengeNote: 'たて20マス、よこ20マスの おおきな パズル。じかんの ある ときに どうぞ。',
  playing: 'とちゅう',
  cleared: 'クリア',
  words: (n) => `${n}こ`,
  howto: 'あそびかた',
  howtoItems: [
    'マスを えらんで、ヒントに あう ことばを ひらがなで いれます。',
    'おなじ マスを もういちど おすと、たてと よこが かわります。',
    '「゛」「゜」は、じを いれた あとに おします。',
    'わからない ときは「こたえあわせ」や「ヒント」を つかえます。',
  ],
  stageTitle: (n) => `ステージ ${n}`,
  challengeTitle: (n) => `チャレンジ ${n}`,
  dir: { across: 'よこ', down: 'たて' },
  cluesTitle: { across: 'よこの ヒント', down: 'たての ヒント' },
  len: (n) => `${n}もじ`,
  meta: (_pos, n) => `${n}もじ`,
  example: 'れい）',
  showPos: false,
  check: 'こたえあわせ',
  hint: 'ヒント',
  showWords: 'ことばを みる',
  restart: 'やりなおす',
  restartConfirm: 'いれた じを ぜんぶ けして、さいしょから やりなおしますか？',
  statusEmpty: 'まだ じが はいって いません。',
  statusWrong: (n) => `ちがう じが ${n}マス あります。あかい マスを みなおそう。`,
  statusOk: (left) => `ここまでは ぜんぶ あっています。あと ${left}マス。`,
  hintAlready: 'この マスは もう あっています。ほかの マスを えらんでね。',
  resultDone: 'よくできました',
  resultReview: 'ことばの ふりかえり',
  resultSub: (words, streak) =>
    streak && streak > 1
      ? `${streak}にち つづけて クリア。${words}この ことばを おさらいしよう。`
      : `でてきた ${words}この ことばを おさらいしよう。`,
  seeBoard: 'パズルを みる',
  goHome: 'ホームに もどる',
};

export const TEXT: Record<Mode, Text> = { standard, easy };
