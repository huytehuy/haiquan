// Âm thanh tổng hợp bằng WebAudio — không cần file asset.
import { store } from './util.js';

let ctx = null;
let muted = !!store('hq_muted');

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ type = 'square', freq = 440, to, dur = 0.1, vol = 0.15, delay = 0 }) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.15, vol = 0.4, delay = 0, filter = 800 }) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filter;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
}

export const sfx = {
  /** Tiếng đóng dấu "cộp cộp". */
  stamp() {
    noise({ dur: 0.12, vol: 0.7, filter: 1400 });
    tone({ type: 'sine', freq: 150, to: 45, dur: 0.18, vol: 0.8 });
    noise({ dur: 0.1, vol: 0.5, filter: 900, delay: 0.16 });
    tone({ type: 'sine', freq: 130, to: 40, dur: 0.16, vol: 0.6, delay: 0.16 });
  },
  /** Còi báo động khi bắt giữ. */
  alarm() {
    for (let i = 0; i < 4; i++) {
      tone({ type: 'sawtooth', freq: 620, to: 920, dur: 0.32, vol: 0.09, delay: i * 0.4 });
      tone({ type: 'sawtooth', freq: 920, to: 620, dur: 0.08, vol: 0.05, delay: i * 0.4 + 0.32 });
    }
  },
  coin() {
    tone({ freq: 988, dur: 0.08, vol: 0.1 });
    tone({ freq: 1319, dur: 0.3, vol: 0.1, delay: 0.08 });
  },
  error() {
    tone({ type: 'sawtooth', freq: 160, dur: 0.3, vol: 0.18 });
    tone({ type: 'sawtooth', freq: 110, dur: 0.45, vol: 0.18, delay: 0.18 });
  },
  blip() {
    tone({ freq: 420 + Math.random() * 260, dur: 0.03, vol: 0.025 });
  },
  scan() {
    tone({ type: 'sine', freq: 180, to: 1400, dur: 0.7, vol: 0.08 });
    tone({ type: 'square', freq: 60, dur: 0.7, vol: 0.03 });
  },
  door() {
    noise({ dur: 0.35, vol: 0.18, filter: 380 });
    tone({ type: 'sine', freq: 660, dur: 0.12, vol: 0.05, delay: 0.05 });
    tone({ type: 'sine', freq: 880, dur: 0.18, vol: 0.05, delay: 0.17 });
  },
  /** Máy phát hiện nói dối báo động. */
  beep() {
    tone({ type: 'square', freq: 1760, dur: 0.07, vol: 0.05 });
    tone({ type: 'square', freq: 1760, dur: 0.07, vol: 0.05, delay: 0.12 });
  },
  /** Chuông hết giờ. */
  bell() {
    for (let i = 0; i < 3; i++) {
      tone({ type: 'triangle', freq: 1046, dur: 0.5, vol: 0.12, delay: i * 0.35 });
      tone({ type: 'sine', freq: 2093, dur: 0.3, vol: 0.04, delay: i * 0.35 });
    }
  },
  paper() {
    noise({ dur: 0.07, vol: 0.12, filter: 4000 });
  },
  click() {
    tone({ type: 'square', freq: 1200, dur: 0.02, vol: 0.03 });
  },
};

export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  store('hq_muted', muted ? 1 : null);
  return muted;
}
/** Gọi trong một thao tác của người dùng để mở khóa AudioContext trên mobile. */
export const unlockAudio = () => ac();
