// たいせんの画面: 入口 → 待ち画面 (コード・QR・URL) → カウントダウン → 対戦 → けっか
import {
  HINT_PENALTY_MS,
  battlePuzzle,
  cleanName,
  everyoneDone,
  formatTime,
  parseCode,
  seatOf,
  standings,
  vocabPrint,
  type BattleRoom,
  type Standing,
} from '../core/battle';
import { entryCells, type Mode, type Word } from '../core/puzzle';
import { getMode } from '../core/storage';
import { EASY_WORDS, WORDS } from '../data/words';
import type { BattleNet } from '../cloud/battle-net';
import { battleAvailable } from '../cloud/config';
import { h, homeButton, withRuby } from './dom';
import { renderGame } from './game';
import { BATTLE as B } from './text';

const HINT_SEC = HINT_PENALTY_MS / 1000;
const NAME_KEY = 'wordlynx:battle-name';

let netPromise: Promise<BattleNet> | null = null;

/** Firebase (Realtime Database) のコードは、たいせんの画面を開いたときにはじめて読みこむ */
function connect(): Promise<BattleNet> {
  netPromise ??= import('../cloud/battle-net')
    .then((m) => m.connectBattle())
    .catch((err) => {
      netPromise = null;
      throw err;
    });
  return netPromise;
}

/** 入口で「はいる」を押したときの名前。部屋のページに着いたら、名前をもう一度聞かずに入る */
let autoJoin: { code: string; name: string } | null = null;

function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // 保存できなくても遊べる
  }
}

const wordsOf = (mode: Mode): readonly Word[] => (mode === 'easy' ? EASY_WORDS : WORDS);
const modeName = (mode: Mode) => (mode === 'easy' ? '初級(しょきゅう)' : '上級(じょうきゅう)');
const roomHash = (code: string) => `#/battle/${code}`;
const inviteUrl = (code: string) => `${location.href.split('#')[0]}${roomHash(code)}`;

/** たいせんの画面を作る。code がなければ入口。もどり値は、画面をはなれるときの後かたづけ */
export function renderBattle(root: HTMLElement, code?: string): () => void {
  let disposed = false;
  let net: BattleNet | null = null;
  /** すわっている部屋。画面をはなれるときに、この部屋を出る */
  let joined: string | null = null;
  const stops: (() => void)[] = [];

  const main = h('main', { class: 'battle-main' });
  const page = h(
    'div',
    { class: 'battle-page' },
    h('header', { class: 'bar' }, homeButton(B.goHome), h('h1', {}, B.title), h('span', {})),
    main,
  );
  const showPage = (...nodes: (Node | null)[]) => {
    stopGame();
    main.replaceChildren(...nodes.filter((x): x is Node => x !== null));
    if (!page.isConnected) root.replaceChildren(page);
  };

  // ---- 対戦中の盤面 ----
  let stopGameFn: (() => void) | null = null;
  let countdownTimer: ReturnType<typeof setInterval> | null = null;
  let clockTimer: ReturnType<typeof setInterval> | null = null;
  function stopGame(): void {
    stopGameFn?.();
    stopGameFn = null;
    if (countdownTimer) clearInterval(countdownTimer);
    if (clockTimer) clearInterval(clockTimer);
    countdownTimer = clockTimer = null;
  }

  // 対戦中にホームのボタンをおしたら、本当に出るかどうかを聞く
  const onLinkClick = (ev: MouseEvent) => {
    const a = (ev.target as HTMLElement).closest('a.home-btn, a[href="#/"]');
    if (!a || !joined) return;
    if (!confirm(B.leaveConfirm)) ev.preventDefault();
  };
  root.addEventListener('click', onLinkClick, true);

  const message = (text: string, ...extra: (Node | null)[]) =>
    h('section', { class: 'battle-card battle-message', role: 'status' }, h('p', {}, text), ...extra);
  const homeLink = () => h('a', { class: 'btn', href: '#/' }, B.goHome);

  showPage(message(B.connecting));
  if (!battleAvailable) showPage(message(B.connectFailed, homeLink()));
  else
    connect().then(
      (n) => {
        if (disposed) return;
        net = n;
        if (code) openRoom(n, code);
        else showEntry(n);
      },
      () => {
        if (!disposed) showPage(message(B.connectFailed, homeLink()));
      },
    );

  // ---- 名前の入力 ----
  function nameField(): { el: HTMLElement; read: () => string | null } {
    const input = h('input', {
      type: 'text',
      class: 'battle-input',
      id: 'battle-name',
      maxlength: 20,
      autocomplete: 'nickname',
      placeholder: B.namePlaceholder,
      value: savedName(),
    });
    const err = h('p', { class: 'battle-error', role: 'alert' });
    const el = h(
      'div',
      { class: 'battle-field' },
      h('label', { for: 'battle-name' }, B.nameLabel),
      input,
      h('p', { class: 'battle-note' }, B.nameNote),
      err,
    );
    return {
      el,
      read: () => {
        const name = cleanName(input.value);
        input.value = name;
        err.textContent = name ? '' : B.nameEmpty;
        if (!name) input.focus();
        else saveName(name);
        return name || null;
      },
    };
  }

  // ---- 入口 (#/battle) ----
  function showEntry(n: BattleNet): void {
    const name = nameField();
    let mode: Mode = getMode();
    const modeBtn = (m: Mode) => {
      const btn = h('button', {
        type: 'button',
        class: 'battle-mode',
        'aria-pressed': String(m === mode),
        onclick: () => {
          mode = m;
          modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        },
      });
      btn.append(...withRuby('span', '', modeName(m)).childNodes);
      return btn;
    };
    const modeBtns = [modeBtn('easy'), modeBtn('standard')];
    const createErr = h('p', { class: 'battle-error', role: 'alert' });
    const createBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: create }, B.create);

    const codeInput = h('input', {
      type: 'text',
      class: 'battle-input battle-code-input',
      id: 'battle-code',
      inputmode: 'numeric',
      maxlength: 7,
      autocomplete: 'off',
      placeholder: '12345',
    });
    const joinErr = h('p', { class: 'battle-error', role: 'alert' });
    const joinBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: join }, B.enter);
    codeInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') join();
    });

    async function create(): Promise<void> {
      const nm = name.read();
      if (!nm) return;
      createBtn.disabled = true;
      createErr.textContent = '';
      try {
        const c = await n.create(mode, vocabPrint(wordsOf(mode)), nm);
        joined = c; // 部屋のページにうつっても、部屋を出ないように
        location.hash = roomHash(c);
      } catch {
        createErr.textContent = B.connectFailed;
        createBtn.disabled = false;
      }
    }

    function join(): void {
      const c = parseCode(codeInput.value);
      joinErr.textContent = c ? '' : B.codeBad;
      if (!c) return codeInput.focus();
      const nm = name.read();
      if (!nm) return;
      autoJoin = { code: c, name: nm };
      location.hash = roomHash(c);
    }

    showPage(
      h('p', { class: 'battle-lead' }, B.lead),
      h('section', { class: 'battle-card' }, name.el),
      h(
        'div',
        { class: 'battle-choices' },
        h(
          'section',
          { class: 'battle-card', 'aria-labelledby': 'battle-create' },
          h('h2', { id: 'battle-create' }, B.create),
          h('p', { class: 'battle-note' }, B.createNote),
          h('p', { class: 'battle-label' }, B.modeLabel),
          h('div', { class: 'battle-modes', role: 'group', 'aria-label': B.modeLabel }, ...modeBtns),
          createBtn,
          createErr,
        ),
        h(
          'section',
          { class: 'battle-card', 'aria-labelledby': 'battle-join' },
          h('h2', { id: 'battle-join' }, B.join),
          h('p', { class: 'battle-note' }, B.joinNote),
          h('label', { class: 'battle-label', for: 'battle-code' }, B.codeLabel),
          h('div', { class: 'battle-code-row' }, codeInput, joinBtn),
          joinErr,
        ),
      ),
    );
  }

  // ---- 部屋 (#/battle/12345) ----
  function openRoom(n: BattleNet, code: string): void {
    let seen = false;
    let joining = false;
    let room: BattleRoom | null = null;
    /** 今の画面: 待ち画面・対戦・けっか */
    let view: 'none' | 'join' | 'lobby' | 'game' | 'result' = 'none';
    let gameRound = 0;
    let lobby: { list: HTMLElement; start: HTMLButtonElement | null; note: HTMLElement } | null = null;
    let top: { clock: HTMLElement; chips: HTMLElement; side: HTMLElement } | null = null;
    let myDone = false;

    stops.push(n.watch(code, (r) => update(r)));

    function update(r: BattleRoom | null): void {
      if (disposed) return;
      room = r;
      if (!r) {
        joined = null;
        view = 'none';
        showPage(message(seen ? B.gone : B.missing, homeLink()));
        return;
      }
      seen = true;
      if (r.vocab !== vocabPrint(wordsOf(r.mode))) {
        view = 'none';
        showPage(message(B.vocab, h('button', { type: 'button', class: 'btn btn-primary', onclick: () => location.reload() }, B.reload)));
        return;
      }
      const seat = seatOf(r, n.uid);
      if (!seat) {
        if (joined === code) {
          // 自分の席がなくなった (待っている間に、ほかの画面で部屋を出たなど)
          joined = null;
        }
        if (joining) return;
        if (autoJoin?.code === code) {
          const name = autoJoin.name;
          autoJoin = null;
          void doJoin(name);
        } else if (r.status !== 'waiting') showPage(message(B.started, homeLink()));
        else if (view !== 'join') showJoin(r);
        return;
      }
      joined = code;
      const me = r.players![seat];
      if (r.status === 'waiting') {
        if (me.round !== r.round) void n.resetForRound(code, r);
        showLobby(r);
      } else if (r.status === 'finished' || (r.status === 'playing' && everyoneDone(r) && gameRound === r.round)) {
        showResult(r);
      } else if (r.status === 'playing' && r.startAt) {
        if (me.round !== r.round) {
          // 待ち画面で記録をもどす前に始まった
          void n.resetForRound(code, r);
          return;
        }
        if (view !== 'game' || gameRound !== r.round) startGame(r);
        else paintTop(r);
      }
    }

    async function doJoin(name: string): Promise<void> {
      joining = true;
      showPage(message(B.connecting));
      const result = await n.join(code, name).catch(() => 'error' as const);
      joining = false;
      if (disposed) return;
      if (result === 'ok') {
        joined = code;
        view = 'none';
        if (room) update(room);
        return;
      }
      view = 'none';
      const text = { missing: B.missing, started: B.started, full: B.full, error: B.connectFailed }[result];
      showPage(message(text, homeLink()));
    }

    function showJoin(r: BattleRoom): void {
      view = 'join';
      const name = nameField();
      const btn = h(
        'button',
        {
          type: 'button',
          class: 'btn btn-primary',
          onclick: () => {
            const nm = name.read();
            if (nm) void doJoin(nm);
          },
        },
        B.enter,
      );
      showPage(
        h(
          'section',
          { class: 'battle-card' },
          withRuby('p', 'battle-lead', B.joinRoom(modeName(r.mode))),
          h('p', { class: 'battle-label' }, B.codeLabel),
          h('p', { class: 'battle-code' }, code),
          name.el,
          btn,
        ),
      );
    }

    // ---- 待ち画面 ----
    function showLobby(r: BattleRoom): void {
      const host = r.hostUid === n.uid;
      if (view !== 'lobby' || !lobby) {
        view = 'lobby';
        gameRound = 0;
        myDone = false;
        const url = inviteUrl(code);
        const canvas = h('canvas', { class: 'battle-qr', width: 168, height: 168, 'aria-label': 'QRコード' });
        void import('./qr').then((m) => m.renderInviteQr(canvas, url)).catch(() => canvas.remove());
        const urlInput = h('input', { type: 'text', class: 'battle-input battle-url', readonly: true, value: url, 'aria-label': 'URL' });
        const copyBtn = h('button', { type: 'button', class: 'btn' }, B.copyUrl);
        copyBtn.addEventListener('click', () => {
          const done = () => {
            copyBtn.textContent = B.copied;
            setTimeout(() => (copyBtn.textContent = B.copyUrl), 2000);
          };
          if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => urlInput.select());
          else urlInput.select();
        });
        const shareBtn =
          typeof navigator.share === 'function'
            ? h('button', { type: 'button', class: 'btn', onclick: () => void navigator.share({ title: 'Wordlynx', text: B.shareText, url }).catch(() => {}) }, B.share)
            : null;
        const list = h('ul', { class: 'battle-players' });
        const note = h('p', { class: 'battle-note' });
        const start = host
          ? h('button', { type: 'button', class: 'btn btn-primary battle-start', onclick: () => void n.start(code) }, B.start)
          : null;
        lobby = { list, start, note };
        showPage(
          h(
            'div',
            { class: 'battle-lobby' },
            h(
              'section',
              { class: 'battle-card battle-invite', 'aria-labelledby': 'battle-code-title' },
              h('h2', { id: 'battle-code-title' }, B.waitingTitle),
              h('p', { class: 'battle-code' }, code),
              withRuby('p', 'battle-note', `${B.modeLabel}：${modeName(r.mode)}`),
              canvas,
              h('p', { class: 'battle-note' }, B.shareNote),
              h('div', { class: 'battle-url-row' }, urlInput, copyBtn, shareBtn),
            ),
            h(
              'section',
              { class: 'battle-card', 'aria-labelledby': 'battle-players-title' },
              h('h2', { id: 'battle-players-title' }),
              list,
              start,
              note,
              h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => void leave() }, B.leave),
            ),
          ),
        );
      }
      const players = Object.values(r.players ?? {}).sort((a, b) => a.joinedAt - b.joinedAt);
      document.getElementById('battle-players-title')!.textContent = B.players(players.length);
      lobby.list.replaceChildren(
        ...players.map((p) =>
          h(
            'li',
            { class: p.online ? '' : 'is-offline' },
            h('span', { class: 'battle-player-name' }, p.name),
            p.uid === n.uid && h('span', { class: 'battle-tag is-you' }, B.you),
            p.uid === r.hostUid && h('span', { class: 'battle-tag' }, B.host),
            !p.online && h('span', { class: 'battle-tag is-off' }, B.offline),
          ),
        ),
      );
      const ready = players.filter((p) => p.online).length >= 2;
      if (lobby.start) lobby.start.disabled = !ready;
      lobby.note.textContent = host ? (ready ? '' : B.startNeeds) : B.waitHost;
    }

    async function leave(): Promise<void> {
      const host = room?.hostUid === n.uid;
      if (!confirm(host ? B.leaveHostConfirm : B.leaveConfirm)) return;
      joined = null;
      await n.leave(code);
      location.hash = '#/';
    }

    // ---- カウントダウンと対戦 ----
    function startGame(r: BattleRoom): void {
      view = 'game';
      gameRound = r.round;
      myDone = false;
      const startAt = r.startAt!;
      const num = h('p', { class: 'battle-count', 'aria-live': 'assertive' });
      showPage(h('section', { class: 'battle-card battle-countdown' }, h('p', {}, B.title), num));
      view = 'game';
      const tick = () => {
        const left = startAt - n.serverNow();
        if (left > 0) {
          num.textContent = String(Math.min(3, Math.ceil(left / 1000)));
          return;
        }
        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = null;
        play(room ?? r);
      };
      countdownTimer = setInterval(tick, 100);
      tick();
    }

    function play(r: BattleRoom): void {
      const mode = r.mode;
      const puzzle = battlePuzzle(wordsOf(mode), mode, code, r.round, r.seed);
      const clock = h('p', { class: 'battle-clock', 'aria-label': B.time });
      const chips = h('ol', { class: 'battle-chips' });
      const side = h('div', { class: 'battle-top-side' });
      top = { clock, chips, side };
      // せまい画面でも盤面とキーボードが入るよう、タイマー・みんなの進み具合・ボタンを 1 行にならべる
      const topEl = h('div', { class: 'battle-top' }, clock, chips, side);
      stopGameFn = renderGame(root, puzzle, B.title, mode, undefined, {
        top: topEl,
        hintLabel: B.hint(HINT_SEC),
        hintNote: (k) => B.hintNote(k, HINT_SEC),
        retireLabel: B.retire,
        retireConfirm: B.retireConfirm,
        onProgress: (filled, total, hints) => n.progress(code, filled, total, hints),
        onFinish: (filled, total, hints) => {
          myDone = true;
          void n.finish(code, filled, total, hints);
          if (room) paintTop(room);
        },
        onRetire: () => {
          myDone = true;
          void n.retire(code);
          if (room) paintTop(room);
        },
      });
      root.querySelector('.game')?.classList.add('battle-game');
      clockTimer = setInterval(() => room && paintClock(room), 250);
      paintTop(r);
      // はじめの進み具合 (0 マス) を送って、ほかの人のバーに全部のマスの数を出す
      const total = new Set(puzzle.entries.flatMap((e) => entryCells(e, puzzle.size))).size;
      n.progress(code, 0, total, 0);
    }

    function paintClock(r: BattleRoom): void {
      if (!top || !r.startAt) return;
      const mine = standings(r).find((s) => s.uid === n.uid);
      if (mine?.status === 'done' && mine.timeMs !== null) top.clock.textContent = `${B.goal} ${formatTime(mine.timeMs)}`;
      else if (mine?.status === 'retired') top.clock.textContent = B.retired;
      else {
        const penalty = (mine?.hints ?? 0) * HINT_PENALTY_MS;
        top.clock.textContent = formatTime(n.serverNow() - r.startAt + penalty);
      }
    }

    function paintTop(r: BattleRoom): void {
      if (!top) return;
      paintClock(r);
      top.chips.replaceChildren(...standings(r).map((s) => chip(s, s.uid === n.uid)));
      const host = r.hostUid === n.uid;
      top.side.replaceChildren(
        myDone ? h('span', { class: 'battle-wait', role: 'status' }, B.goalWait) : '',
        host ? h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => confirm(B.endConfirm) && void n.end(code) }, B.end) : '',
      );
    }

    // ---- けっか ----
    function showResult(r: BattleRoom): void {
      view = 'result';
      top = null;
      const host = r.hostUid === n.uid;
      const rows = standings(r);
      showPage(
        h(
          'section',
          { class: 'battle-card battle-result', 'aria-labelledby': 'battle-result-title' },
          h('h2', { id: 'battle-result-title' }, B.resultTitle),
          h(
            'ol',
            { class: 'battle-ranking' },
            ...rows.map((s) =>
              h(
                'li',
                { class: [s.uid === n.uid && 'is-you', s.rank === 1 && 'is-top'].filter(Boolean).join(' ') },
                h('span', { class: 'battle-rank' }, s.rank !== null ? B.rank(s.rank) : '—'),
                h('span', { class: 'battle-player-name' }, s.name),
                h(
                  'span',
                  { class: 'battle-result-time' },
                  s.status === 'done' && s.timeMs !== null
                    ? h('b', {}, formatTime(s.timeMs))
                    : h('span', { class: 'battle-muted' }, statusLabel(s)),
                  s.status === 'done' && s.solveMs !== null && s.hints > 0
                    ? h('small', {}, B.breakdown(formatTime(s.solveMs), s.hints, HINT_SEC))
                    : '',
                ),
              ),
            ),
          ),
          host
            ? h('button', { type: 'button', class: 'btn btn-primary', onclick: () => void n.rematch(code, r.round) }, B.again)
            : h('p', { class: 'battle-note' }, B.againWait),
          h('div', { class: 'battle-result-foot' }, h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => void leave() }, B.leave)),
        ),
      );
      lobby = null;
    }
  }

  return () => {
    disposed = true;
    stopGame();
    stops.forEach((s) => s());
    root.removeEventListener('click', onLinkClick, true);
    // 部屋を作ってすぐの、部屋のページへのうつりかわりでは出ない
    if (net && joined && location.hash !== roomHash(joined)) void net.leave(joined);
  };
}

function statusLabel(s: Standing): string {
  return { done: B.goal, playing: B.playing, retired: B.retired, left: B.left }[s.status];
}

/** 対戦中の、ひとりぶんの進み具合 */
function chip(s: Standing, you: boolean): HTMLElement {
  const ratio = s.status === 'done' ? 1 : s.total > 0 ? s.filled / s.total : 0;
  const label =
    s.status === 'done' && s.timeMs !== null ? formatTime(s.timeMs) : s.status === 'playing' ? `${s.filled}/${s.total || '-'}` : statusLabel(s);
  return h(
    'li',
    { class: `battle-chip is-${s.status}${you ? ' is-you' : ''}` },
    h('span', { class: 'battle-chip-name' }, you ? `${s.name} (${B.you})` : s.name),
    h('span', { class: 'battle-chip-bar', 'aria-hidden': 'true' }, h('span', { style: `width:${Math.round(ratio * 100)}%` })),
    h('span', { class: 'battle-chip-label' }, label),
  );
}
