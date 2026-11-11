import QRCode from 'qrcode';

/**
 * 招待の URL を QR コードにして canvas にかく。スマホのカメラが読みとりやすいよう、
 * 白地に濃い色でかく (白と黒を入れかえると、読めないカメラが多い)
 */
export async function renderInviteQr(canvas: HTMLCanvasElement, url: string, size = 168, level: 'L' | 'M' = 'M'): Promise<void> {
  await QRCode.toCanvas(canvas, url, {
    width: size,
    margin: 1,
    // 長い URL は、誤り訂正を弱くして (L) 目をあらくする
    errorCorrectionLevel: level,
    color: { dark: '#1d2a44', light: '#ffffff' },
  });
}
