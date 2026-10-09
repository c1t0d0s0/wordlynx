/** ヤマネコの絵柄の指定。指定しない項目は、タイトル画面のヤマネコと同じになる */
export interface Look {
  fur?: string;
  light?: string;
  pink?: string;
  /** 目に色をつける (夜のヤマネコなど) */
  eyeColor?: string;
  eyes?: 'open' | 'wink' | 'sleep' | 'happy' | 'sparkle' | 'brave';
  mouth?: 'tongue' | 'smile' | 'open';
  marks?: 'stripes' | 'spots' | 'none';
  items?: Item[];
}

export type Item =
  | 'ribbon'
  | 'glasses'
  | 'pencil'
  | 'hat'
  | 'scarf'
  | 'flower'
  | 'book'
  | 'headband'
  | 'headphones'
  | 'cap'
  | 'wizard'
  | 'crown'
  | 'zzz';

export type Background =
  | 'paper'
  | 'dots'
  | 'grid'
  | 'night'
  | 'pink'
  | 'sky'
  | 'snow'
  | 'sakura'
  | 'notes'
  | 'hanamaru'
  | 'stars'
  | 'rainbow'
  | 'gold';

export interface Card {
  id: string;
  /** 初級でも読めるよう、漢字は 3 年生までに習うものだけ */
  name: string;
  price: number;
  look: Look;
  bg: Background;
  frame: 'plain' | 'silver' | 'gold';
}

/** 値段の安い順。100pt は 1 枚だけで、あとは 1000pt から 10000pt まで 500pt きざみ */
export const CARDS: Card[] = [
  { id: 'c01', name: 'ヤマネコ', price: 100, look: {}, bg: 'paper', frame: 'plain' },
  { id: 'c02', name: 'ウインク ヤマネコ', price: 1000, look: { eyes: 'wink', mouth: 'smile' }, bg: 'dots', frame: 'plain' },
  { id: 'c03', name: 'ねむねむ ヤマネコ', price: 1500, look: { eyes: 'sleep', mouth: 'smile', items: ['zzz'] }, bg: 'night', frame: 'plain' },
  { id: 'c04', name: 'にこにこ ヤマネコ', price: 2000, look: { eyes: 'happy', mouth: 'open' }, bg: 'pink', frame: 'plain' },
  { id: 'c05', name: 'リボンの ヤマネコ', price: 2500, look: { items: ['ribbon'], fur: '#f1cf93' }, bg: 'dots', frame: 'plain' },
  { id: 'c06', name: 'めがねの ヤマネコ', price: 3000, look: { items: ['glasses'], mouth: 'smile' }, bg: 'grid', frame: 'plain' },
  { id: 'c07', name: 'えんぴつ ヤマネコ', price: 3500, look: { items: ['pencil'], eyes: 'brave', mouth: 'smile' }, bg: 'grid', frame: 'plain' },
  { id: 'c08', name: 'ぼうしの ヤマネコ', price: 4000, look: { items: ['hat'], mouth: 'open', eyes: 'happy' }, bg: 'sky', frame: 'plain' },
  { id: 'c09', name: 'マフラーの ヤマネコ', price: 4500, look: { items: ['scarf'], fur: '#d9a55b' }, bg: 'snow', frame: 'plain' },
  { id: 'c10', name: '花の ヤマネコ', price: 5000, look: { items: ['flower'], eyes: 'wink', fur: '#f3c98b' }, bg: 'sakura', frame: 'plain' },
  { id: 'c11', name: '本を 読む ヤマネコ', price: 5500, look: { items: ['glasses', 'book'], mouth: 'smile' }, bg: 'paper', frame: 'silver' },
  { id: 'c12', name: 'はちまき ヤマネコ', price: 6000, look: { items: ['headband'], eyes: 'brave', mouth: 'open' }, bg: 'hanamaru', frame: 'silver' },
  { id: 'c13', name: '雪の ヤマネコ', price: 6500, look: { fur: '#f3f1ea', light: '#ffffff', pink: '#f9c9c0', marks: 'spots', items: ['scarf'] }, bg: 'snow', frame: 'silver' },
  { id: 'c14', name: '夜の ヤマネコ', price: 7000, look: { fur: '#6a6f96', light: '#d9dcf0', pink: '#b99bc4', eyeColor: '#ffd94a', marks: 'spots', mouth: 'smile' }, bg: 'night', frame: 'silver' },
  { id: 'c15', name: '音楽の ヤマネコ', price: 7500, look: { items: ['headphones'], eyes: 'happy', mouth: 'open' }, bg: 'notes', frame: 'silver' },
  { id: 'c16', name: 'やきゅう ヤマネコ', price: 8000, look: { items: ['cap'], eyes: 'brave', mouth: 'smile', fur: '#dba862' }, bg: 'sky', frame: 'silver' },
  { id: 'c17', name: 'はなまる ヤマネコ', price: 8500, look: { eyes: 'sparkle', mouth: 'open', items: ['pencil'] }, bg: 'hanamaru', frame: 'gold' },
  { id: 'c18', name: 'まほうの ヤマネコ', price: 9000, look: { items: ['wizard'], eyes: 'sparkle', mouth: 'smile', fur: '#cdb7ee', light: '#f6f0ff', pink: '#f3b6dc' }, bg: 'stars', frame: 'gold' },
  { id: 'c19', name: 'にじの ヤマネコ', price: 9500, look: { eyes: 'sparkle', mouth: 'open', fur: '#fbe3a6', items: ['flower'] }, bg: 'rainbow', frame: 'gold' },
  { id: 'c20', name: '王様の ヤマネコ', price: 10000, look: { items: ['crown'], eyes: 'sparkle', mouth: 'smile', fur: '#f0c260' }, bg: 'gold', frame: 'gold' },
];
