import type { Pos, Word } from '../core/puzzle';
import adverbs from './vocab/adverbs';
import adjectives from './vocab/adjectives';
import verbs from './vocab/verbs';
import naAdjectives from './vocab/na-adjectives';
import nouns from './vocab/nouns';
import yoji from './vocab/yoji';
import easyNouns from './vocab-easy/nouns';
import easyVerbs from './vocab-easy/verbs';
import easyAdjectives from './vocab-easy/adjectives';
import easyOthers from './vocab-easy/others';

/**
 * 1 行 1 語。「よみ|漢字まじりの書き方|カギ|例文|例文|例文…」の順に書く。
 * - 漢字まじりの書き方がない語は 2 つめを空にする
 * - カギでふりがなを付けたいときは 漢字(かんじ) と半角かっこで書く。注記は全角かっこ（）を使う
 * - 例文の答えが入るところは 〇〇
 * - 例文はいくつ書いてもよい。同じ言葉がまた出たときに、ちがう例文になるようにするため
 */
function parse(pos: Pos, text: string): Word[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const [reading, kanji, clue, ...examples] = line.split('|');
      return { reading, kanji, pos, clue, example: examples[0], examples };
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

/**
 * 初級モードの言葉。答えに小さい「っゃゅょ」をふくむ言葉は入れず、
 * カギと例文は 3 年生までに習う漢字だけを使い、分かち書きで書く。
 */
export const EASY_WORDS: Word[] = [
  ...parse('名詞', easyNouns),
  ...parse('動詞', easyVerbs),
  ...parse('形容詞', easyAdjectives),
  ...parse('副詞', easyOthers),
];
