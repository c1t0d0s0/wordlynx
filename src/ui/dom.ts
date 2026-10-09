type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | EventListener> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'function') el.addEventListener(key.replace(/^on/, ''), value);
    else if (value === true) el.setAttribute(key, '');
    else if (value !== false) el.setAttribute(key, String(value));
  }
  for (const child of children) if (child) el.append(child);
  return el;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** 「漢字(かんじ)」をふりがな付きの HTML にする */
export function rubyHtml(text: string): string {
  return escapeHtml(text).replace(/([一-龠々]+)\(([ぁ-ん]+)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
}

export function withRuby<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text: string) {
  const el = h(tag, { class: cls });
  el.innerHTML = rubyHtml(text);
  return el;
}

/** 先生が赤ペンでかく「はなまる」の線 (100 × 100 の中にかく) */
export function hanamaruPoints(): string {
  const pts: string[] = [];
  const turns = 3;
  const steps = 140;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2 - Math.PI / 2;
    const r = 3 + t * 24;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  for (let i = 1; i <= 120; i++) {
    const t = i / 120;
    const a = t * Math.PI * 2 - Math.PI / 2;
    const r = 27 + 13 * Math.abs(Math.sin(t * Math.PI * 6));
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

export function hanamaru(cls = 'hanamaru'): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'polyline');
  path.setAttribute('points', hanamaruPoints());
  path.setAttribute('pathLength', '1');
  svg.append(path);
  return svg;
}
