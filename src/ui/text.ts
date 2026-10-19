import type { Dir, Mode, Pos } from '../core/puzzle';
import { CHALLENGE_POINTS, CLEAR_POINTS, FREE_HINTS, HINT_COST, MONTH_POINTS, WEEK_LENGTH, WEEK_POINTS } from '../core/rewards';

/** 画面の文言。初級モードは、3 年生までに習う漢字だけを使い、分かち書きにする */
export interface Text {
  lead: string;
  daily: string;
  dateLabel: (month: number, day: number, weekday: number) => string;
  dailyNote: (done: boolean, streak: number) => string;
  start: string;
  resume: string;
  review: string;
  stages: (month: number) => string;
  stagesNote: string;
  challenge: (month: number) => string;
  challengeNote: string;
  /** 20×20 の盤面を作っている間に出す */
  making: string;
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
  hintFree: (left: number) => string;
  hintPaid: string;
  hintSpent: (balance: number) => string;
  hintShort: (balance: number) => string;
  resultDone: string;
  resultReview: string;
  resultSub: (words: number, streak?: number) => string;
  seeBoard: string;
  goHome: string;
  // スタンプカード・ポイント・ヤマネコカード (初級でも読めるよう、漢字は 3 年生まで)
  stampTitle: string;
  stampMonth: (month: number) => string;
  stampDayLabel: (day: number, stamped: boolean) => string;
  stampRun: (run: number, left: number) => string;
  stampRule: string;
  stampDone: string;
  rewardClear: (points: number) => string;
  rewardWeek: (run: number) => string;
  rewardMonth: (month: number) => string;
  points: (n: number) => string;
  pointsLabel: string;
  seeCards: string;
  seeStamps: string;
  rewardLinks: string;
  soundOn: string;
  soundOff: string;
  // ログインと記録の保存 (ログインは保護者がすることも多いが、文は子どもにも読める表記にする)
  accountTitle: string;
  accountNote: string;
  signIn: string;
  signedIn: string;
  signOut: string;
  syncLoading: string;
  syncSaving: string;
  syncSaved: string;
  syncOffline: string;
  askMigrate: string;
  signOutUnsynced: string;
  signInFailed: string;
  cardsTitle: string;
  cardsLead: string;
  cardsOwned: (n: number, total: number) => string;
  cardGet: string;
  cardShort: (n: number) => string;
  cardConfirm: (price: number) => string;
  cardBackLabel: (price: number) => string;
}

const standard: Text = {
  lead: 'クロスワードパズル',
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
  stages: (month) => `${month}月のステージ`,
  stagesNote: '毎月1日に、新しいステージになるよ。',
  challenge: (month) => `${month}月のチャレンジ`,
  challengeNote: `たて20マス、よこ20マスの大きな盤面。クリアすると${CHALLENGE_POINTS}pt。時間のあるときにどうぞ。`,
  making: 'パズルを作っています…',
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
    `ヒントは1つのパズルで${FREE_HINTS}回まで。それより多く使うときは、1回${HINT_COST}ptいります。`,
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
  hintFree: (left) => `ヒント（あと${left}回）`,
  hintPaid: `ヒント（${HINT_COST}pt）`,
  hintSpent: (balance) => `${HINT_COST}pt使ったよ。持っているポイントは${balance.toLocaleString('ja-JP')}pt。`,
  hintShort: (balance) =>
    `ヒントは${FREE_HINTS}回まで。それより多く使うには${HINT_COST}ptいるよ（持っているポイントは${balance.toLocaleString('ja-JP')}pt）。`,
  resultDone: 'よくできました',
  resultReview: 'ことばのふりかえり',
  resultSub: (words, streak) =>
    streak && streak > 1
      ? `${streak}日つづけてクリア。${words}この言葉をおさらいしよう。`
      : `出てきた${words}この言葉をおさらいしよう。`,
  seeBoard: '盤面を見る',
  goHome: 'ホームにもどる',
  stampTitle: 'スタンプカード',
  stampMonth: (month) => `${month}月`,
  stampDayLabel: (day, stamped) => `${day}日${stamped ? ' スタンプあり' : ''}`,
  stampRun: (run, left) =>
    run > 0
      ? `${run}日つづいているよ。あと${left}日で${WEEK_POINTS}pt。`
      : '今日のパズルをクリアすると、スタンプを1こおせるよ。',
  stampRule: `パズルを1つクリアすると${CLEAR_POINTS}pt（チャレンジは${CHALLENGE_POINTS}pt）。今日のパズルを${WEEK_LENGTH}日つづけるたびに${WEEK_POINTS}pt、1日から月のさいごの日まで全部そろうと、さらに${MONTH_POINTS}pt。`,
  stampDone: 'スタンプをおしたよ',
  rewardClear: (points) => `クリア！ +${points}pt`,
  rewardWeek: (run) => `${run}日つづいた！ +${WEEK_POINTS}pt`,
  rewardMonth: (month) => `${month}月のスタンプが全部そろった！ +${MONTH_POINTS}pt`,
  points: (n) => `${n.toLocaleString('ja-JP')}pt`,
  pointsLabel: '持っているポイント',
  seeCards: 'カードを見る',
  seeStamps: 'スタンプカードを見る',
  rewardLinks: 'スタンプカードとヤマネコカード',
  soundOn: '音：オン',
  soundOff: '音：オフ',
  accountTitle: 'きろくの ほぞん',
  accountNote: 'Googleで ログインすると、ほかの ブラウザや たんまつでも 同じ きろくで 遊べます。ログインしなくても 遊べます。',
  signIn: 'Googleで ログイン',
  signedIn: 'ログイン中',
  signOut: 'ログアウト',
  syncLoading: 'たしかめています…',
  syncSaving: 'ほぞん中…',
  syncSaved: 'ほぞんずみ',
  syncOffline: 'まだ ほぞんできていません。つながったら ほぞんします。',
  askMigrate:
    'この たんまつの きろくを アカウントに うつしますか？\n\n「OK」… うつす (アカウントの きろくと 合わせます)\n「キャンセル」… うつさない (たんまつの きろくは そのまま のこります)',
  signOutUnsynced: 'まだ ほぞんできていない きろくが あります。今 ログアウトすると、その分は なくなります。ログアウトしますか？',
  signInFailed: 'ログインできませんでした。もういちど ためしてください。',
  cardsTitle: 'ヤマネコカード',
  cardsLead: 'ポイントをためて、ヤマネコのカードを集めよう。',
  cardsOwned: (n, total) => `${n} / ${total}まい`,
  cardGet: 'ゲットする',
  cardShort: (n) => `あと${n.toLocaleString('ja-JP')}pt`,
  cardConfirm: (price) => `${price.toLocaleString('ja-JP')}ptを使って、このカードをゲットしますか？`,
  cardBackLabel: (price) => `まだ持っていないカード。${price.toLocaleString('ja-JP')}ptでゲットできる`,
};

// 「今日のパズル」のらん (見出し・日付・ひとこと・ボタン) は、上級と同じ文言を使う
const easy: Text = {
  ...standard,
  lead: 'クロスワードパズル',
  stages: (month) => `${month}月の ステージ`,
  stagesNote: 'まいつき 1日に、新しい ステージに なるよ。',
  challenge: (month) => `${month}月の チャレンジ`,
  making: 'パズルを 作って いるよ…',
  challengeNote: `たて20マス、よこ20マスの 大きな パズル。クリアすると ${CHALLENGE_POINTS}pt。時間の ある ときに どうぞ。`,
  words: (n) => `${n}こ`,
  howtoItems: [
    'マスを えらんで、ヒントに 合う 言葉を ひらがなで 入れます。',
    '同じ マスを もういちど おすと、たてと よこが かわります。',
    '「゛」「゜」は、字を 入れた あとに おします。',
    '分からない ときは「こたえあわせ」や「ヒント」を 使えます。',
    `ヒントは 1つの パズルで ${FREE_HINTS}回まで。それより 多く 使う ときは、1回 ${HINT_COST}pt いります。`,
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

/**
 * たいせんの文言。入口は初級・上級で共通なので、初級でも読めるよう 3 年生までの漢字と分かち書きで書く
 */
export const BATTLE = {
  title: '対戦',
  homeNote: '友だちと同じパズルを同時に解いて、タイムを競おう。',
  homeButton: '対戦する',
  lead: '同じパズルを同時に解いて、早くゴールした人の勝ち。',
  nameLabel: 'あなたの名前 (ニックネーム)',
  nameNote: '本名は入れないでください。',
  namePlaceholder: '例）ヤマネコ',
  nameEmpty: '名前を入れてください。',
  create: '部屋を作る',
  createNote: '作った部屋のコードを友だちに教えよう。',
  modeLabel: '言葉のレベル',
  join: 'コードで入る',
  joinNote: '友だちに教えてもらった5けたの数字を入れてください。',
  codeLabel: '対戦コード',
  codeBad: 'コードは5けたの数字です。',
  enter: '入る',
  joinRoom: (mode: string) => `${mode}の対戦に招待されています。`,
  connecting: '接続しています…',
  connectFailed: '接続できませんでした。インターネットにつながっているか確認して、もう一度試してください。',
  missing: 'そのコードの部屋はありません。コードを確認してください。',
  started: 'この部屋の対戦はもう始まっています。終わるまで待ってから入ってください。',
  full: 'この部屋は満員です (8人まで)。',
  vocab: 'パズルの言葉が新しくなっています。ページを読み込み直してください。',
  reload: '読み込み直す',
  gone: '部屋がなくなりました。',
  waitingTitle: '対戦コード',
  shareNote: 'コードかQRコードを友だちに見せてください。',
  copyUrl: 'URLをコピー',
  copied: 'コピーしました',
  share: '送る',
  shareText: 'Wordlynxで対戦しよう！',
  players: (n: number) => `参加者 (${n}人)`,
  you: 'あなた',
  host: 'ホスト',
  offline: '接続が切れています',
  start: 'スタート',
  startNeeds: '2人そろったらスタートできます。',
  waitHost: 'ホストがスタートするのを待っています…',
  leave: '部屋を出る',
  leaveConfirm: '部屋を出ますか？',
  leaveHostConfirm: '部屋を出ると、部屋がなくなります。出ますか？',
  hint: (sec: number) => `ヒント (+${sec}秒)`,
  hintNote: (n: number, sec: number) => `ヒントを${n}回使いました。タイムに${n * sec}秒足されます。`,
  retire: 'リタイア',
  retireConfirm: 'リタイアしますか？ この対戦では順位がつかなくなります。',
  end: '終了する',
  endConfirm: 'まだ解いている人がいても、ここで終了しますか？',
  goal: 'ゴール！',
  goalWait: 'ほかの人が終わるのを待っています…',
  retired: 'リタイア',
  left: '退出',
  playing: '解答中',
  resultTitle: '結果',
  rank: (n: number) => `${n}位`,
  time: 'タイム',
  breakdown: (solve: string, hints: number, sec: number) => (hints > 0 ? `${solve} ＋ ヒント${hints}回 (${hints * sec}秒)` : solve),
  again: 'もう一度',
  againWait: 'ホストが次の対戦を始めるのを待っています…',
  goHome: 'ホームにもどる',
};

