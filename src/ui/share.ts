// URL を人に送るための部品 (たいせんの招待と、作ったパズルのシェアで使う)
import { h } from './dom';

export interface ShareLabels {
  copy: string;
  copied: string;
  share: string;
  /** 「送る」でいっしょに送る文 */
  shareText: string;
}

/** URL の入力欄と「コピー」「送る」のボタン。「送る」は、端末にその機能があるときだけ出す */
export function shareRow(url: string, labels: ShareLabels): HTMLElement {
  const urlInput = h('input', { type: 'text', class: 'battle-input battle-url', readonly: true, value: url, 'aria-label': 'URL' });
  const copyBtn = h('button', { type: 'button', class: 'btn' }, labels.copy);
  copyBtn.addEventListener('click', () => {
    const done = () => {
      copyBtn.textContent = labels.copied;
      setTimeout(() => (copyBtn.textContent = labels.copy), 2000);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => urlInput.select());
    else urlInput.select();
  });
  const shareBtn =
    typeof navigator.share === 'function'
      ? h(
          'button',
          { type: 'button', class: 'btn', onclick: () => void navigator.share({ title: 'Wordlynx', text: labels.shareText, url }).catch(() => {}) },
          labels.share,
        )
      : null;
  return h('div', { class: 'battle-url-row' }, urlInput, copyBtn, shareBtn);
}

/** URL の QR コード。QR コードにできなかったとき (URL が長すぎるなど) は、画面から消える */
export function qrCanvas(url: string, opts: { size?: number; level?: 'L' | 'M' } = {}): HTMLCanvasElement {
  const size = opts.size ?? 168;
  const canvas = h('canvas', { class: 'battle-qr', width: size, height: size, style: `width:${size}px;height:${size}px`, 'aria-label': 'QRコード' });
  void import('./qr').then((m) => m.renderInviteQr(canvas, url, size, opts.level)).catch(() => canvas.remove());
  return canvas;
}
