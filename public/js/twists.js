// Hai cơ chế mới của chiến dịch 7 ngày: Phòng thẩm vấn và màn "đổi vai" vượt cửa khẩu.
import { normalize, pick, shuffle, randInt } from './util.js';
import { CLUES, NA_LOCATION } from './rules.js';
import { detectIntent } from './ai.js';

// ---------------- Phòng thẩm vấn ----------------
export const INTERRO_QUESTIONS = 3;
export const INTERRO_CHIPS = ['Ai thuê mày?', 'Bé Na đang ở đâu?', 'Khai thật đi, không thì ngồi tù mãn kiếp!'];

const TOPICS = {
  boss: /(hac long|trum|ong chu|sep|cap tren|ai thue|ai sai|dung sau|giao cho ai|lam cho ai|to chuc|duong day|ho chieu|van tay|cong ty|bao ve)/,
  na: /(be na|dua be|con gai|con toi|con be|bat coc|giam|nhot|o dau|cho nao|dia diem|kho|thang be|con nho|dua nho)/,
};

/** Bí mật người bị bắt đang giữ: người của đường dây biết về trùm; gã khăn đỏ biết nơi giam bé Na. */
export function secretsFor(npc, g) {
  const out = [];
  if (npc.holdsNa && !g.naLocation) out.push({ key: 'na', topic: 'na', pressure: 0 });
  if (npc.network && g.clues < CLUES.length) out.push({ key: 'clue', topic: 'boss', pressure: 0 });
  return out;
}

/**
 * Câu hỏi có chạm vào bí mật nào không. Hỏi trúng chủ đề lần đầu → nghi phạm dao động (partial);
 * trúng lần hai, hoặc trúng kèm lời đe dọa → gục ngã và khai (reveal).
 */
export function probe(secrets, question) {
  const q = ' ' + normalize(question) + ' ';
  const threat = detectIntent(question) === 'threat';
  for (const s of secrets) {
    if (s.revealed || !TOPICS[s.topic].test(q)) continue;
    s.pressure++;
    if (s.pressure >= 2 || threat) {
      s.revealed = true;
      return { secret: s, reveal: true };
    }
    return { secret: s, reveal: false };
  }
  return { secret: null, reveal: false };
}

export const secretText = (s, g) => (s.key === 'na' ? NA_LOCATION : CLUES[g.clues]);

// ---------------- Đổi vai: vượt cửa khẩu Cầu Phú Mỹ ----------------
const COVER = {
  sur: ['Lê', 'Trịnh', 'Vương', 'Mạc', 'Kiều', 'Lâm'],
  given: ['Hoàng An', 'Gia Bình', 'Minh Khánh', 'Thanh Phúc', 'Ngọc Hải'],
  child: ['Mai', 'Thảo', 'Vy', 'Hân'],
  dest: [['Đà Lạt Cao Nguyên', ['da lat']], ['Hải Cảng Vũng Tàu', ['vung tau']], ['Liên khu Mê Kông', ['me kong', 'mekong', 'mien tay']]],
  rel: [['dì Tư', ['di tu']], ['bà ngoại', ['ngoai']], ['chú Bảy', ['chu bay']]],
  job: [['giáo viên', ['giao vien', 'day hoc']], ['thợ may', ['tho may']], ['kế toán', ['ke toan']]],
  days: [10, 14, 21],
};
const NUM_WORDS = { 10: ['muoi'], 14: ['muoi bon'], 21: ['hai muoi mot', 'hai mot'] };

/** Danh tính mới cho cả nhà (cố định theo seed của ván). */
export function makeCover(rng) {
  const [dest, destTok] = pick(rng, COVER.dest);
  const [rel, relTok] = pick(rng, COVER.rel);
  const [job, jobTok] = pick(rng, COVER.job);
  const days = pick(rng, COVER.days);
  const year = randInt(rng, 1986, 1993);
  const name = `${pick(rng, COVER.sur)} ${pick(rng, COVER.given)}`;
  const child = pick(rng, COVER.child);
  const id = `DL-${randInt(rng, 10000, 99999)}`;
  const passport = { name, sex: '—', dob: `${year}-0${randInt(rng, 1, 9)}-1${randInt(rng, 0, 9)}`, id_number: id, expiry_date: '2031-01-01', origin: `Phường 3, ${dest}` };
  const story = { dest, rel, job, days, child, year };
  const all = [
    { key: 'dest', ask: 'Anh/chị đi đâu, giờ này?', expect: destTok },
    { key: 'rel', ask: 'Lên đó thăm ai?', expect: relTok },
    { key: 'job', ask: 'Làm nghề gì?', expect: jobTok },
    { key: 'days', ask: 'Định ở lại bao nhiêu ngày?', expect: [String(days), ...NUM_WORDS[days]] },
    { key: 'year', ask: 'Sinh năm bao nhiêu?', expect: [String(year)] },
  ];
  // luôn hỏi tên đứa bé (cái bẫy lớn nhất: lỡ miệng gọi "Na") + 2 câu ngẫu nhiên
  const questions = [{ key: 'child', ask: 'Đứa bé đi cùng tên gì?', expect: [normalize(child)] }, ...shuffle(rng, all).slice(0, 2)];
  return { passport, story, questions: shuffle(rng, questions) };
}

// Lỡ miệng: nhắc tên thật của con, nghề cũ, hay Hắc Long → đáng ngờ hơn cả trả lời sai
const SLIPS = [/\bna\b/, /thanh tra/, /hai quan/, /quay 7/, /kiem soat/, /hac long/];

/** Chấm một câu trả lời: 'ok' | 'wrong' | 'slip'. */
export function judgeAnswer(q, answer) {
  const a = ' ' + normalize(answer).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  if (SLIPS.some((re) => re.test(a))) return 'slip';
  return q.expect.some((tok) => a.includes(tok)) ? 'ok' : 'wrong';
}
export const SUSPICION = { ok: 0, wrong: 1, slip: 2 };
export const CAUGHT_AT = 2;

/** Mô tả hồ sơ khai báo để gửi cho AI đóng vai thanh tra biên phòng. */
export const coverSummary = (c) =>
  `Họ tên ${c.passport.name}, sinh năm ${c.story.year}, nghề ${c.story.job}; đi ${c.story.dest} thăm ${c.story.rel} ${c.story.days} ngày, cùng vợ/chồng và con gái tên ${c.story.child}.`;
