import { describe, expect, it } from 'vitest';
import { RomajiInput, normalizeKana, toggleMark } from '../src/core/kana';

const type = (s: string) => {
  const r = new RomajiInput();
  return [...s].map((k) => r.feed(k)).join('');
};

describe('kana', () => {
  it('小さい字とカタカナをそろえる', () => {
    expect(normalizeKana('ちゃっかり')).toBe('ちやつかり');
    expect(normalizeKana('ショセン')).toBe('しよせん');
    expect(normalizeKana('ぶっきらぼう')).toBe('ぶつきらぼう');
  });

  it('濁点・半濁点を付け外しする', () => {
    expect(toggleMark('か', '゛')).toBe('が');
    expect(toggleMark('が', '゛')).toBe('か');
    expect(toggleMark('は', '゜')).toBe('ぱ');
    expect(toggleMark('ば', '゜')).toBe('ぱ');
    expect(toggleMark('ぱ', '゛')).toBe('ば');
    expect(toggleMark('か', '゜')).toBeNull();
    expect(toggleMark('あ', '゛')).toBeNull();
  });

  it('ローマ字をかなにする', () => {
    expect(type('kumanaku')).toBe('くまなく');
    expect(type('chakkari')).toBe('ちやつかり');
    expect(type('shosenn')).toBe('しよせん');
    expect(type('tannnenn')).toBe('たんねん');
    expect(type('sunnnari')).toBe('すんなり');
    expect(type('kanbashii')).toBe('かんばしい');
    expect(type('zyu')).toBe('じゆ');
    expect(type('qka')).toBe('か');
  });
});
