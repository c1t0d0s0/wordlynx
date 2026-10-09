import { h } from './dom';

// 耳の先のふさ毛と、ほおの長い毛がヤマネコ (lynx) の目じるし
const SVG = `
<svg viewBox="0 0 120 110" role="img" aria-label="ヤマネコのキャラクター">
  <g stroke="var(--lynx-line)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
    <path class="lynx-fur" d="M27 52 C21 38 21 24 25 13 C36 19 47 27 53 36 Z M93 52 C99 38 99 24 95 13 C84 19 73 27 67 36 Z" />
    <path class="lynx-fur" d="M60 28 C36 28 19 44 19 67 C19 73 15 79 8 85 C18 86 25 89 31 95 C39 103 50 106 60 106 C70 106 81 103 89 95 C95 89 102 86 112 85 C105 79 101 73 101 67 C101 44 84 28 60 28 Z" />
  </g>
  <path class="lynx-pink" d="M30 43 C28 35 28 28 30 22 C36 26 41 31 45 36 Z M90 43 C92 35 92 28 90 22 C84 26 79 31 75 36 Z" />
  <path class="lynx-tuft" d="M24 15 C22 10 20 6 19 1 C24 4 28 8 31 12 Z M96 15 C98 10 100 6 101 1 C96 4 92 8 89 12 Z" />
  <ellipse class="lynx-light" cx="60" cy="86" rx="15" ry="11" />
  <ellipse class="lynx-pink" cx="28" cy="82" rx="6.5" ry="4" opacity="0.75" />
  <ellipse class="lynx-pink" cx="92" cy="82" rx="6.5" ry="4" opacity="0.75" />
  <g fill="var(--lynx-line)">
    <ellipse cx="42" cy="69" rx="7.5" ry="8.5" />
    <ellipse cx="78" cy="69" rx="7.5" ry="8.5" />
  </g>
  <g fill="#fff">
    <circle cx="44.6" cy="65.4" r="3.1" /><circle cx="39.4" cy="72.6" r="1.5" />
    <circle cx="80.6" cy="65.4" r="3.1" /><circle cx="75.4" cy="72.6" r="1.5" />
  </g>
  <path class="lynx-tongue" d="M56.8 88.5 Q60 95.5 63.2 88.5 Z" />
  <path class="lynx-nose" d="M56.2 79.4 Q60 77.6 63.8 79.4 Q62.4 83.4 60 84 Q57.6 83.4 56.2 79.4 Z" />
  <g fill="none" stroke="var(--lynx-line)" stroke-linecap="round">
    <path stroke-width="2" d="M60 84 V86 M60 86 C58 90 53 90 51.5 87 M60 86 C62 90 67 90 68.5 87" />
    <path stroke-width="2.5" d="M53 39 L54 45 M60 37 V44 M67 39 L66 45" />
    <path stroke-width="1.4" d="M45 87 L33 89 M45.5 90.5 L35 96 M75 87 L87 89 M74.5 90.5 L85 96" />
  </g>
</svg>`;

export function lynx(): HTMLElement {
  const el = h('div', { class: 'lynx' });
  el.innerHTML = SVG;
  return el;
}
