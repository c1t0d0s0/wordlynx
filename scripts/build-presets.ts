// プリセットのステージを作り直す: npm run presets
// 語彙を変えると盤面も変わるので、公開後はむやみに実行しないこと。
import { writeFileSync } from 'node:fs';
import { generate } from '../src/core/generator';
import { WORDS } from '../src/data/words';

// ステージどうしで同じ言葉が出ないよう、使った言葉は次のステージの候補から外す
const taken = new Set<string>();
const stages = Array.from({ length: 10 }, (_, i) => {
  const big = i >= 8;
  const puzzle = generate(WORDS.filter((w) => !taken.has(w.reading)), {
    id: `stage-${i + 1}`,
    seed: `wordlynx-stage-${i + 1}`,
    size: big ? 20 : 10,
    targetWords: big ? 48 : 12,
    attempts: big ? 300 : 80,
  });
  for (const e of puzzle.entries) taken.add(e.word.reading);
  return puzzle;
});

const used = new Set<string>();
for (const s of stages) {
  const grid: string[] = new Array(s.size * s.size).fill('・');
  for (const e of s.entries) {
    used.add(e.answer);
    [...e.answer].forEach((ch, i) => {
      grid[e.dir === 'across' ? e.row * s.size + e.col + i : (e.row + i) * s.size + e.col] = ch;
    });
  }
  console.log(`\n${s.id}: ${s.entries.length} 語`);
  for (let r = 0; r < s.size; r++) console.log(grid.slice(r * s.size, (r + 1) * s.size).join(''));
}
console.log(`\n使った言葉: ${used.size} 種類`);

writeFileSync(new URL('../src/data/presets.json', import.meta.url), JSON.stringify(stages) + '\n');
