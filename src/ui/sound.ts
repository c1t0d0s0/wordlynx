import { getSound } from '../core/storage';

// 効果音は音声ファイルを使わず、その場で合成する (Web Audio API)
type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

/**
 * 音を出す準備をする。音がオフのときや、音を出せない環境では null。
 * ブラウザは操作のあとでしか音を出させないので、字を入れた・ボタンをおした流れの中でよぶこと。
 */
function audio(): AudioContext | null {
  if (!getSound()) return null;
  try {
    if (!ctx) {
      const Ctor: AudioCtor | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (!noise) {
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/**
 * 音を出せる状態にしておく。最後の字を入れた操作の中でよぶ。
 * (iPhone などは、操作の中で準備しておかないと、あとから鳴らす音が出ない)
 */
export function primeSound(): void {
  audio();
}

/** 言葉がふくらむときの、かけ上がる音 */
export function playRise(ms: number): void {
  const ac = audio();
  if (!ac || !master) return;
  const t = ac.currentTime;
  const d = ms / 1000;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(260, t);
  osc.frequency.exponentialRampToValueAtTime(1100, t + d);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.16, t + d * 0.8);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.03);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + d + 0.05);
}

/** ばくはつの音。「ドン」という低い音と、「バシャッ」というざらついた音を重ねる */
export function playBoom(strength = 1): void {
  const ac = audio();
  if (!ac || !master) return;
  const t = ac.currentTime;

  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2600, t);
  filter.frequency.exponentialRampToValueAtTime(140, t + 0.4);
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.9 * strength, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  src.connect(filter).connect(noiseGain).connect(master);
  src.start(t);
  src.stop(t + 0.55);

  const thump = ac.createOscillator();
  const thumpGain = ac.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(170, t);
  thump.frequency.exponentialRampToValueAtTime(42, t + 0.3);
  thumpGain.gain.setValueAtTime(1.0 * strength, t);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
  thump.connect(thumpGain).connect(master);
  thump.start(t);
  thump.stop(t + 0.4);
}

/** さいごの大きな花火。大きなばくはつに、きらきらした上がる音を重ねる */
export function playFinale(): void {
  const ac = audio();
  if (!ac || !master) return;
  playBoom(1.3);
  const t = ac.currentTime;
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
    const start = t + 0.06 + i * 0.07;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
    osc.connect(gain).connect(master!);
    osc.start(start);
    osc.stop(start + 0.6);
  });
}
