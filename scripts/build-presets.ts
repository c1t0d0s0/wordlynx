// プリセットのステージを作り直す
//   npm run presets -- easy       低学年モード (src/data/presets-easy.json)
//   npm run presets -- standard   高学年モード (src/data/presets.json)
// 語彙を変えたあとに実行すると盤面も変わり、遊んでいる人の途中経過が消える。
import { writeFileSync } from 'node:fs';
import { generate } from '../src/core/generator';
import { EASY_WORDS, WORDS } from '../src/data/words';

const mode = process.argv[2];
if (mode !== 'easy' && mode !== 'standard') {
  console.error('使い方: npm run presets -- easy|standard');
  process.exit(1);
}
const easy = mode === 'easy';
const words = easy ? EASY_WORDS : WORDS;

// ステージどうしで同じ言葉が出ないよう、使った言葉は次のステージの候補から外す
const taken = new Set<string>();
const stages = Array.from({ length: 10 }, (_, i) => {
  const big = i >= 8;
  const puzzle = generate(words.filter((w) => !taken.has(w.reading)), {
    id: easy ? `easy-stage-${i + 1}` : `stage-${i + 1}`,
    seed: easy ? `wordlynx-easy-stage-${i + 1}` : `wordlynx-stage-${i + 1}`,
    size: big ? 20 : 10,
    targetWords: big ? (easy ? 40 : 48) : easy ? 10 : 12,
    attempts: big ? 300 : 80,
  });
  for (const e of puzzle.entries) taken.add(e.word.reading);
  return puzzle;
});

for (const s of stages) {
  const grid: string[] = new Array(s.size * s.size).fill('・');
  for (const e of s.entries) {
    [...e.answer].forEach((ch, i) => {
      grid[e.dir === 'across' ? e.row * s.size + e.col + i : (e.row + i) * s.size + e.col] = ch;
    });
  }
  console.log(`\n${s.id}: ${s.entries.length} 語`);
  for (let r = 0; r < s.size; r++) console.log(grid.slice(r * s.size, (r + 1) * s.size).join(''));
}
console.log(`\n使った言葉: ${taken.size} 種類`);

const file = easy ? '../src/data/presets-easy.json' : '../src/data/presets.json';
writeFileSync(new URL(file, import.meta.url), JSON.stringify(stages) + '\n');
