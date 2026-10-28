// Giọng đọc lời thoại bằng Web Speech API của trình duyệt (miễn phí, chạy trên máy).
// Chỉ đọc khi máy có giọng tiếng Việt — không dùng giọng tiếng Anh đọc tiếng Việt.
import { store } from './util.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let viVoice = null;
let enabled = store('hq_voice') !== 0; // mặc định bật

function pickVoice() {
  const voices = synth?.getVoices() || [];
  // ưu tiên giọng online (Google/Microsoft) vì tự nhiên hơn giọng offline
  viVoice = voices.filter((v) => /^vi/i.test(v.lang)).sort((a, b) => Number(a.localService) - Number(b.localService))[0] || null;
}
if (synth) {
  pickVoice();
  synth.onvoiceschanged = pickVoice;
}

export const voiceAvailable = () => !!viVoice;
export const isVoiceOn = () => enabled;

export function setVoice(on) {
  enabled = on;
  store('hq_voice', on ? null : 0);
  if (!on) stopSpeaking();
}

export function stopSpeaking() {
  try {
    synth?.cancel();
  } catch {
    /* trình duyệt không hỗ trợ */
  }
}

/** Đọc một câu; câu mới cắt ngang câu cũ. */
export function speak(text, { pitch = 1, rate = 1 } = {}) {
  if (!enabled || !viVoice || !text) return;
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/[*_~"“”]/g, ''));
    u.voice = viVoice;
    u.lang = viVoice.lang;
    u.pitch = Math.max(0.1, Math.min(2, pitch));
    u.rate = Math.max(0.5, Math.min(1.6, rate));
    synth.speak(u);
  } catch {
    /* bỏ qua */
  }
}

/** Mỗi nhân vật một giọng: nữ cao, nam trầm, người già chậm; cảm xúc đổi nhịp. */
export function voiceFor(npc, emotion = 'calm') {
  const p = npc?.documents?.passport || {};
  const year = Number(String(p.dob || '').slice(0, 4));
  let pitch = p.sex === 'Nữ' ? 1.3 : 0.85;
  let rate = 1.05;
  if (year && year < 1960) {
    rate = 0.85;
    pitch -= 0.1;
  }
  if (emotion === 'nervous') rate += 0.15;
  if (emotion === 'angry') {
    rate += 0.1;
    pitch -= 0.1;
  }
  if (emotion === 'pleading') pitch += 0.1;
  // lệch nhẹ theo từng người để hai khách cùng giới không giống hệt nhau
  const jitter = ([...String(npc?.id || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 10) / 50;
  return { pitch: pitch + jitter, rate };
}
export const INSPECTOR_VOICE = { pitch: 0.7, rate: 0.95 };

/** iOS chỉ cho đọc sau một thao tác của người dùng — gọi trong một cú chạm để "mở khóa". */
export function primeVoice() {
  try {
    if (enabled && viVoice && synth && !synth.speaking) synth.speak(new SpeechSynthesisUtterance(''));
  } catch {
    /* bỏ qua */
  }
}
