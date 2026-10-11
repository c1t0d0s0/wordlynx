# Wordlynx

中学受験によく出る言葉を、クロスワードで遊びながらおぼえる Web アプリです。
サーバーは不要で、ビルドした静的ファイルを置くだけで動きます。

- モードは 2 つ。上級モード (約 2,400 語) と、やさしい言葉だけの初級モード (約 1,350 語)。タイトル画面で切りかえ
- 今日のパズル: 日本時間の日付から毎日 1 問を自動生成。同じ日はだれが開いても同じ問題
- ステージ 1〜8 (10×10) と、チャレンジ 9・10 (20×20)
- 入力はひらがな。画面の五十音キーボードか、パソコンのローマ字入力
- スタンプカード: 今日のパズルをクリアするとスタンプが 1 個。続けるとポイントがたまり、ヤマネコのカード (20 種類) と交換できる
- クリアすると、出てきた言葉が 1 つずつ大きくなって爆発する演出と効果音 (音はタイトル画面の「音：オン／オフ」で切りかえ)
- 記録はブラウザ (localStorage) に保存。Google でログインすると Firestore に保存され、ほかのブラウザや端末でも同じ記録で遊べる (ログインは任意)

## 使い方

```sh
npm install
npm run dev      # 開発サーバー
npm test         # テスト
npm run build    # dist/ に静的ファイルを出力
npm run preview  # ビルド結果の確認
```

## スタンプ・ポイント・ヤマネコカード

- ステージや今日のパズルを 1 つクリアすると 20pt。チャレンジ (ステージ 9・10) は 200pt (同じパズルでは 1 回だけ。やりなおしてクリアしても増えない)
- スタンプは初級・上級で共通で、1 日 1 個。どちらかの「今日のパズル」をクリアすると押される
- 7 日連続するたびに 1000pt (とぎれたら数え直し)
- その月の 1 日から末日まで全部そろうと、さらに 5000pt (月ごとに数える)
- ヒントは 1 つのパズルで 5 回まで無料。6 回目からは 1 回 10pt (やりなおしても回数はもどらない)
- カードは 40pt から 3000pt までの 20 枚で、合計 28,420pt。持っていないカードは裏向きで、必要な pt だけが見える
  - 初級の今日のパズルを毎日クリアすると、はじめの 5 枚は 2 週間以内 (2・6・7・7・14 日目) に手に入る
  - そのあとは 1 枚ごとに少しずつ時間がかかり、全部集めるには少なくとも 3 か月の連続プレイがいる
  - 値段を変えるときは、`tests/rewards.test.ts` の「カードの値段のバランス」が通ることを確かめる

ポイントは合計を保存せず、スタンプの日付から毎回計算します (`src/core/rewards.ts`)。
カードの種類と値段は `src/data/cards.ts`、絵柄の部品は `src/ui/lynx.ts` にあります。

### カードのデザインを確認するページ

`npm run dev` を実行して `http://localhost:5173/cards.html` を開くと、全部のカードの表と裏面を一覧できます。
このページは開発用で、`npm run build` の出力には入りません (公開サイトでは見られません)。
遊ぶ人の記録は読みも書きもしません。

記録は端末のブラウザごとに保存されます。ブラウザのデータを消すと、スタンプもカードも消えます。
日付は端末の時計 (日本時間に換算) で決まるので、時計を変えれば先の日のスタンプも押せてしまいます。

## 公開 (GitHub Pages)

`main` ブランチに push すると、GitHub Actions (`.github/workflows/deploy.yml`) がテストとビルドを行い、
GitHub Pages に公開します。テストが失敗したときは公開されません。

はじめに一度だけ、GitHub のリポジトリで Settings → Pages → Build and deployment の
Source を「GitHub Actions」にしておきます。

## ログインと記録の保存 (Firebase)

Google でログインした人の記録は Firebase の Firestore に保存し、どのブラウザでも同じ記録で遊べます。
ログインしない人は、今までどおりそのブラウザの localStorage だけに保存します。
**Firebase の設定を入れていないビルドでは、ログインの入り口は出ず、Firebase のコードも読みこまれません。**

### 仕組み

- 画面はいつも手元 (localStorage) の記録を読み書きする (`src/core/storage.ts`)
- ログイン中は、手元の記録を「Firestore の写し」としてあつかい、書きかわった分を少しまとめてから Firestore に送る (`src/cloud/sync.ts`)
- ログインしたとき・ページを開いたときは、Firestore の記録と手元の写しを**合わせて**、両方に書く
- 合わせ方は `src/core/merge.ts` に 1 つにまとめてある。何回合わせても同じ結果になるので、2 台で別々に遊んでも、
  通信に失敗してやり直しても、記録が消えたり二重にふえたりしない

  | 記録 | 合わせ方 |
  |---|---|
  | スタンプの日付、クリアしたパズル | 両方を合わせた集合 |
  | 持っているカード | 両方を合わせる (同じカードは払った額の小さいほう) |
  | ヒントに使ったポイント | パズルごとに、大きいほう |
  | パズルの途中経過 | クリア済みを優先。どちらも途中なら字が多いほう。ヒントの回数は大きいほう |
  | モード・音、今日のパズルの連続日数 | 新しいほう |

- 手元の記録は人ごとに分ける。ログインなしの記録は `wordlynx:v1:…`、ログイン中の人の写しは `wordlynx:u:<uid>:…`。
  **ログアウトすると、その人の写しは端末から消す** (きょうだいで 1 台を使っても、記録がまざらない)
- ログインしたとき、その端末にログインなしの記録があれば、アカウントにうつすかどうかを聞く。
  うつした記録は端末のログインなしの場所から消す (二重にうつらないように)
- 通信できないときも手元の写しで遊べ、つながったときに送る。送れていない変更があるままログアウトしようとすると、たしかめる

### Firestore の形 (小学生向けの学習アプリで共通)

Wordlynx 専用の形にはせず、ほかの学習アプリも同じ形で保存できるようにしてあります。
記録そのものはアプリごとに分けます (Wordlynx の `appId` は `wordlynx`)。型は `src/core/snapshot.ts` にあります。

```
users/{uid}                                   その人の情報 (全アプリ共通)
  schema: 1, createdAt, updatedAt             ※ 名前・メールアドレス・写真は保存しない

users/{uid}/apps/{appId}                      アプリごとの記録のまとめ
  schema: 1, updatedAt
  activeDays: string[]                        その日の目標を達成した日 (Wordlynx ではスタンプ)
  completed:  string[]                        やりとげた教材の id (Wordlynx ではクリアしたパズル)
  inventory:  { [itemId]: { paid: number } }  手に入れたごほうび (Wordlynx ではヤマネコカード)
  spent:      { [key]: number }               使ったポイント (Wordlynx ではパズルごとのヒント代)
  settings:   { … }                           アプリごとの設定 (中身はアプリが決める)

users/{uid}/apps/{appId}/progress/{itemId}    教材 1 つごとの途中経過
  schema: 1, updatedAt
  status: "playing" | "done"
  data: { … }                                 途中経過の中身 (アプリが決める。Wordlynx では入れた字など)
```

ポイントの残高は保存しません (スタンプとクリアから毎回計算します)。
読み書きできるのはログインしている本人だけです (`firestore.rules`)。

### Firebase の準備

1. [Firebase コンソール](https://console.firebase.google.com/) でプロジェクトを作り、ウェブアプリを登録する
2. Authentication → ログイン方法 で **Google** を有効にする。設定 → 承認済みドメイン に、公開先のドメインを足す
3. Firestore Database を作り、ルールに `firestore.rules` の内容を設定する
4. ウェブアプリの設定値のうち 4 つを入れる
   - 手元: `config.js` に書く

     ```js
     const FIREBASE_API_KEY = '…';
     const FIREBASE_AUTH_DOMAIN = '….firebaseapp.com';
     const FIREBASE_PROJECT_ID = '…';
     const FIREBASE_APP_ID = '…';
     ```

   - GitHub Pages: リポジトリの Settings → Secrets and variables → Actions → Variables に、同じ 4 つの名前で登録する

   環境変数があればそれを使い、なければ `config.js` の値を使います。4 つのうち一部だけを入れると、ビルドがエラーになります。
   これらの値は公開されてもよいものです (記録を守るのはルールのほうです)。

### ログインできないとき

ログインに失敗すると、ボタンの下に「ログインできませんでした。(auth/…)」と、Firebase のエラーの名前が出ます。

| エラーの名前 (コンソールの表示) | 原因 | 直し方 |
|---|---|---|
| `auth/configuration-not-found` (`CONFIGURATION_NOT_FOUND`) | そのプロジェクトで Authentication がまだ始まっていない | Firebase コンソール → Authentication → 「始める」をおし、ログイン方法で Google を有効にする |
| `auth/operation-not-allowed` | Google でのログインが有効になっていない | Authentication → ログイン方法 → Google を有効にして保存する |
| `auth/unauthorized-domain` | 開いているサイトのドメインが登録されていない | Authentication → 設定 → 承認済みドメイン に、公開先のドメイン (手元なら `localhost`) を足す |
| `auth/popup-blocked` | ブラウザがログインの画面 (ポップアップ) を止めた | ブラウザでこのサイトのポップアップをゆるす |
| `auth/invalid-api-key`, `auth/api-key-not-valid…` | 設定値がまちがっている | `FIREBASE_API_KEY` などの 4 つの値を、コンソールの「ウェブアプリの設定」からコピーし直す |

ログインはできるのに「まだ ほぞんできていません」のままのときは、Firestore Database がまだ作られていないか、
ルールが `firestore.rules` の内容になっていません。

### 知っておくこと

- 13 歳未満の子どもの Google アカウントは、保護者の管理 (ファミリー リンク) が前提です。保護者のアカウントでログインして使うこともできます
- 通信ができないままログインが切れた場合など、送れていなかった変更は失われることがあります
- 2 台で同じパズルを同時に進めた場合は、字が多く入っているほうが残ります (マスごとには合わせません)

### エミュレーターで動かす (開発用)

本物の Firebase を使わずに、手元でログインと保存をためせます (Java が必要)。

```sh
npx firebase-tools emulators:start --only auth,firestore --project demo-wordlynx
FIREBASE_API_KEY=x FIREBASE_AUTH_DOMAIN=localhost FIREBASE_PROJECT_ID=demo-wordlynx FIREBASE_APP_ID=x FIREBASE_EMULATOR=1 npm run dev
```

## アクセス解析 (Google のタグ)

ID を設定したときだけ、Google のタグをページに埋め込みます。設定しなければ何も埋め込みません。
ID が `GTM-…` なら Google タグ マネージャー、`G-…` なら Google アナリティクス (gtag.js) のタグになります。

- 手元: プロジェクト直下の `config.js` に `const GTM_ID = 'G-XXXXXXXXXX';` のように書く
- GitHub Pages: リポジトリの Settings → Secrets and variables → Actions → Variables に `GTM_ID` を登録する

環境変数 `GTM_ID` (デプロイ時は `vars.GTM_ID`) があればそれを使い、なければ `config.js` の値を使います。

## 言葉を追加する

`src/data/vocab/` の品詞ごとのファイル (副詞・形容詞・動詞・形容動詞・名詞・四字熟語) に、1 行 1 語で追加します。

```
よみ|漢字まじりの書き方|カギ|例文|例文|例文
くまなく||すみずみまで、のこらず|部屋の中を〇〇さがす。|町じゅうを〇〇歩き回る。|かばんの中を〇〇調べる。
おもむく|赴く|ある場所へ向かって行く|仕事で外国に〇〇。|ひさい地に〇〇医者。|心の〇〇ままに歩く。
```

- 読みは 2〜8 文字。小さい「っゃゅょ」は盤面では大きい字になります
- カギに答えそのものを書かない。例文は答えの入るところを `〇〇` にする
- 例文は 1 語につき 3 つ以上書く。問題を作るたびにその中から 1 つがえらばれるので、
  同じ言葉がまた出ても、ちがう例文になりやすい (同じ日はだれが開いても同じ例文)
- 動詞や形容詞の例文は、`〇〇` に辞書の形 (「おもむく」「いぶかしい」) がそのまま入る文にする
- カギでふりがなを付けるときは `漢字(かんじ)` と半角かっこで書く
- `npm test` が形式と重複を検査します

言葉を追加・変更すると、その日以降の「今日のパズル」の内容が変わります
(同じ版を見ている人どうしでは、同じ日は同じ問題のままです)。

### 初級モードの言葉

`src/data/vocab-easy/` に、同じ書式で追加します。次の点がちがいます。

- 答えは 2〜6 文字で、小さい「っゃゅょ」や「ー」をふくむ言葉は入れない
- カギと例文は分かち書きにし、漢字は 3 年生までに習うものだけを使う (数字は算用数字)

## ステージを作り直す

ステージは言葉ごと JSON に保存してあるので、語彙を変えても変わりません。
作り直すときだけ、次のどちらかを実行します (遊んでいる人の途中経過は消えます)。

```sh
npm run presets -- standard   # 上級モード → src/data/presets.json
npm run presets -- easy       # 初級モード   → src/data/presets-easy.json
```

## 構成

- `src/core/generator.ts` 盤面の生成 (種が同じなら結果も同じ)
- `src/core/kana.ts` かなの正規化、濁点、ローマ字変換
- `src/ui/` ホーム、盤面、キーボード、クリア画面
- `src/core/merge.ts`, `src/core/snapshot.ts` 記録を合わせる決まりと、Firestore に保存する形
- `src/cloud/` ログインと Firestore との同期 (Firebase に依存するのは `firebase.ts` だけ)
- `tests/` 生成結果の正しさ、1 年分のデイリー、語彙データの検査
