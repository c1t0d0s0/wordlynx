import type { Pos, Word } from '../core/puzzle';
import adverbs from './vocab/adverbs';
import adjectives from './vocab/adjectives';
import verbs from './vocab/verbs';
import naAdjectives from './vocab/na-adjectives';
import nouns from './vocab/nouns';
import yoji from './vocab/yoji';

/**
 * 1 行 1 語。「よみ|漢字まじりの書き方|カギ|例文」の順に書く。
 * - 漢字まじりの書き方がない語は 2 つめを空にする
 * - カギでふりがなを付けたいときは 漢字(かんじ) と半角かっこで書く。注記は全角かっこ（）を使う
 * - 例文の答えが入るところは 〇〇
 */
function parse(pos: Pos, text: string): Word[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const [reading, kanji, clue, example] = line.split('|');
      return { reading, kanji, pos, clue, example };
    });
}

export const WORDS: Word[] = [
  ...parse('副詞', adverbs),
  ...parse('形容詞', adjectives),
  ...parse('動詞', verbs),
  ...parse('形容動詞', naAdjectives),
  ...parse('名詞', nouns),
  ...parse('四字熟語', yoji),
];
