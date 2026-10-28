// Gói "giữa các ngày": cấp bậc & kỹ năng, ngày đặc biệt, sự kiện ban đêm có lựa chọn.
import { chance, pick, shuffle } from './util.js';

// ---------------- Cấp bậc & uy tín ----------------
export const RANKS = [
  { name: 'Thanh tra tập sự', rep: 0, pay: 50 },
  { name: 'Thanh tra', rep: 6, pay: 55 },
  { name: 'Thanh tra chính', rep: 14, pay: 60 },
  { name: 'Thanh tra trưởng', rep: 24, pay: 70 },
];
export const REP = { correct: 1, arrest: 1, wrong: -2 }; // bắt giữ đúng = correct + arrest

export const rankOf = (rep) => RANKS.reduce((best, r, i) => (rep >= r.rep ? i : best), 0);
export const nextRank = (rank) => RANKS[rank + 1] || null;

// ---------------- Kỹ năng (chọn 1 trong 3 mỗi lần thăng cấp) ----------------
export const SKILLS = [
  { key: 'eagle', icon: '🦅', name: 'Mắt diều hâu', desc: 'Tab giấy tờ có vấn đề hiện dấu "!" (hàng lậu giấu kín thì không)' },
  { key: 'silver', icon: '🗡️', name: 'Lưỡi sắc', desc: 'Kẻ gian dễ lỡ lời và gãy nhanh hơn khi bị hỏi vặn' },
  { key: 'steel', icon: '🧊', name: 'Thần kinh thép', desc: 'Đồng hồ ca trực chạy chậm 25%' },
  { key: 'connections', icon: '🤝', name: 'Quan hệ rộng', desc: 'Thanh tra nội bộ chỉ còn 10% phát hiện phong bì' },
  { key: 'k9', icon: '🐕', name: 'Chó nghiệp vụ K9', desc: 'Chó sủa khi đánh hơi thấy hàng lậu (thỉnh thoảng sủa nhầm)' },
  { key: 'face', icon: '📸', name: 'Camera nhận diện', desc: 'Tự báo động khi khuôn mặt khớp lệnh truy nã' },
  { key: 'interrogator', icon: '🎙️', name: 'Thẩm vấn viên', desc: '+1 câu hỏi cho mỗi khách' },
  { key: 'momentum', icon: '🔥', name: 'Phong độ', desc: 'Thưởng chuỗi đúng tăng gấp đôi' },
];
export const skillByKey = Object.fromEntries(SKILLS.map((s) => [s.key, s]));
export const skillChoices = (rng, owned) => shuffle(rng, SKILLS.filter((s) => !owned.includes(s.key))).slice(0, 3);

// ---------------- Ngày đặc biệt ----------------
export const DAY_MODS = {
  inspection: { icon: '🕴️', name: 'Thanh tra cấp trên giám sát', desc: 'Quyết định đúng được trả gấp đôi — sai cũng bị phạt gấp đôi.', payMult: 2, fineMult: 2 },
  festival: { icon: '🎆', name: 'Lễ hội ánh sáng', desc: 'Hàng chờ đông gấp bội (+3 khách), lương ×1.5.', payMult: 1.5, extraVisitors: 3 },
  storm: { icon: '🌪️', name: 'Bão nhiệt đới', desc: 'Ca trực chỉ đến 13:00. Máy soi X-quang bị hỏng.', shiftEnd: 13 * 60, noScan: true },
  terror: { icon: '🚨', name: 'Báo động khủng bố', desc: 'Soi X-quang không giới hạn — nhưng CHO QUA khách chưa soi là vi phạm lệnh.', unlimitedScan: true, mustScan: true },
  blackout: { icon: '🔌', name: 'Mất điện toàn trạm', desc: 'Không máy soi, vân tay, máy đối chiếu, máy nói dối. Phụ cấp lương ×1.5.', payMult: 1.5, noScan: true, noPrint: true, noGadgets: true },
};

// Ngày cuối chương 2 — không ngẫu nhiên
export const BOSS_DAY = { key: 'bossday', icon: '🐉', name: 'Ngày của Hắc Long', desc: 'Tin mật: trùm Hắc Long sẽ qua quầy 7 hôm nay dưới danh tính giả. Đối chiếu bảng ghim manh mối để nhận ra hắn — bắt được trùm thưởng $500.' };
export const BOSS_BOUNTY = 500;

/**
 * Lên lịch ngày đặc biệt cho một chương (ngày 1 luôn bình thường, mỗi loại tối đa 1 lần).
 * Chương cuối dành ngày cuối cho Hắc Long. Trả về mảng key theo ngày: out[day - 1].
 */
export function planDayMods(rng, totalDays, chapter = 1, lastChapter = 2) {
  const pool = shuffle(rng, Object.keys(DAY_MODS));
  const out = [null];
  for (let d = 2; d <= totalDays; d++) out.push(chance(rng, 0.7) && pool.length ? pool.pop() : null);
  if (chapter === lastChapter) out[totalDays - 1] = 'bossday';
  return out;
}

export const dayModFor = (key) => (key === 'bossday' ? BOSS_DAY : key ? { key, ...DAY_MODS[key] } : null);

// ---------------- Sự kiện ban đêm ----------------
// Hiệu ứng của một lựa chọn: money, rep, mistakes, rent, warmHome, blessing, sick (tên người thân), gamble {p, win, lose}
export const EVENTS = [
  {
    key: 'stranger', title: 'Người lạ gõ cửa', photo: 'npc_201', maxDay: 4,
    text: 'Nửa đêm, một gã đội mũ trùm dúi vào tay bạn $400 cùng tấm ảnh: "Ngày mai người này sẽ qua quầy 7. Cho hắn qua."',
    choices: [
      { key: 'take', label: 'Nhận tiền', money: 400, result: 'Bạn cất tiền. Tấm ảnh nằm trên bàn ăn suốt đêm. (Nếu mai không cho hắn qua, bọn chúng sẽ quay lại.)' },
      { key: 'refuse', label: 'Đuổi đi', result: 'Gã nhổ nước bọt rồi biến vào bóng tối.' },
      { key: 'report', label: 'Báo công an', rep: 2, result: 'Bộ An ninh cảm ơn. Người trong ảnh sẽ có tên trên lệnh truy nã sáng mai.' },
    ],
  },
  {
    key: 'tuition', title: 'Học phí của bé Na',
    text: 'Cô giáo nhắn: bé Na còn nợ học phí $80. Không đóng trước thứ Hai thì bé phải nghỉ học.',
    choices: [
      { key: 'pay', label: 'Đóng học phí ($80)', money: -80, result: 'Bé Na ôm cổ bạn, cười tít mắt.' },
      { key: 'skip', label: 'Để sau', result: 'Bé Na lặng lẽ cất cặp sách vào gầm giường.' },
    ],
  },
  {
    key: 'neighbor', title: 'Chiếc hộp của hàng xóm',
    text: 'Anh hàng xóm bị còng tay dẫn đi, kịp dúi cho bạn một chiếc hộp kín: "Giữ giùm, tôi sẽ hậu tạ."',
    choices: [
      {
        key: 'keep', label: 'Giữ hộ',
        gamble: {
          p: 0.5,
          win: { money: 150, result: 'Vợ anh ta tới nhận lại hộp, gửi $150 tiền cảm ơn.' },
          lose: { money: -100, mistakes: 1, result: 'Công an khám nhà, tìm thấy chiếc hộp. Bạn bị phạt $100 và 1 cảnh cáo.' },
        },
      },
      { key: 'refuse', label: 'Từ chối', result: 'Bạn đóng cửa. Chiếc hộp nằm lại trước hiên nhà ai đó.' },
      { key: 'report', label: 'Nộp công an', rep: 2, result: 'Trong hộp là sổ ghi nợ của băng "Rắn". Bạn được ghi nhận công trạng (+2 uy tín).' },
    ],
  },
  {
    key: 'colleague', title: 'Lời rủ rê của quầy 6',
    text: 'Đồng nghiệp quầy 6 thì thầm: "Phong bì chia đôi, tao che thanh tra nội bộ cho mày."',
    choices: [
      { key: 'join', label: 'Bắt tay', result: 'Từ mai, phong bì chỉ còn một nửa — nhưng thanh tra nội bộ sẽ không sờ tới bạn.' },
      { key: 'refuse', label: 'Lắc đầu', result: 'Anh ta nhún vai: "Tùy mày."' },
      { key: 'report', label: 'Tố cáo', rep: 3, money: 50, result: 'Quầy 6 bị đình chỉ. Bạn được thưởng $50 và +3 uy tín.' },
    ],
  },
  {
    key: 'temple', title: 'Mẹ muốn đi chùa',
    text: 'Mẹ muốn lên chùa cầu an cho cả nhà, tiền nhang đèn và xe cộ hết $40.',
    choices: [
      { key: 'go', label: 'Cho mẹ đi ($40)', money: -40, blessing: true, result: 'Mẹ về, vui hẳn. Lần ốm tới của cả nhà sẽ được tai qua nạn khỏi.' },
      { key: 'no', label: 'Để dịp khác', result: 'Mẹ không nói gì, chỉ thắp một nén nhang trước bàn thờ.' },
    ],
  },
  {
    key: 'landlord', title: 'Chủ nhà tăng giá',
    when: (g) => !g.warmHome,
    text: 'Chủ nhà gõ cửa: "Từ đêm nay tiền nhà tăng từ $100 lên $130. Không ở thì dọn đi."',
    choices: [
      { key: 'accept', label: 'Chấp nhận', rent: 130, result: 'Từ đêm nay tiền nhà là $130.' },
      {
        key: 'haggle', label: 'Mặc cả',
        gamble: { p: 0.5, win: { result: 'Chủ nhà xuống nước: giữ nguyên $100.' }, lose: { rent: 150, result: 'Chủ nhà nổi giận: tiền nhà vọt lên $150!' } },
      },
      { key: 'move', label: 'Chuyển nhà ($120)', money: -120, rent: 90, warmHome: true, result: 'Nhà mới nhỏ nhưng kín gió: tiền nhà $90 và không cần sưởi nữa.' },
    ],
  },
  {
    key: 'fever', title: 'Bé Na sốt cao',
    text: 'Nửa đêm bé Na sốt 40 độ, người nóng ran, mê man.',
    when: (g) => g.family[2].alive && !g.family[2].sick,
    choices: [
      { key: 'hospital', label: 'Đưa đi viện ($90)', money: -90, result: 'Bác sĩ hạ sốt kịp thời. Bé Na ngủ yên.' },
      { key: 'wait', label: 'Chờ đến sáng', sick: 'Bé Na', result: 'Sáng ra bé Na vẫn sốt — bé đã đổ bệnh.' },
    ],
  },
  {
    key: 'cards', title: 'Chiếu bạc của quầy 6',
    text: 'Tan ca, mấy đồng nghiệp rủ đánh bài, tiền cược $50.',
    choices: [
      {
        key: 'play', label: 'Chơi ($50)',
        gamble: { p: 0.4, win: { money: 100, result: 'Bạn thắng ván lớn: +$100!' }, lose: { money: -50, result: 'Bạn thua sạch $50.' } },
      },
      { key: 'no', label: 'Về nhà ngủ', result: 'Bạn về sớm. Bé Na vẫn còn thức chờ.' },
    ],
  },
];

/** Chọn sự kiện cho đêm nay (mỗi sự kiện tối đa 1 lần/ván). Không có sự kiện sau ngày cuối. */
export function pickEvent(rng, g, totalDays) {
  if (g.day >= totalDays) return null;
  const pool = EVENTS.filter((e) => !g.eventsSeen.includes(e.key) && (!e.maxDay || g.day <= e.maxDay) && (!e.when || e.when(g)));
  return pool.length ? pick(rng, pool) : null;
}

/** Số tiền tối thiểu cần có để chọn được lựa chọn này (chỉ tính khoản chi chắc chắn). */
export const choiceCost = (c) => Math.max(0, -(c.money || 0), -(c.gamble?.lose?.money || 0));

/** Áp dụng lựa chọn vào trạng thái game; trả về câu kết quả. */
export function applyChoice(g, event, choice, rng) {
  let eff = choice;
  if (choice.gamble) eff = { ...choice, ...(chance(rng, choice.gamble.p) ? choice.gamble.win : choice.gamble.lose) };
  if (eff.money) g.money += eff.money;
  if (eff.rep) g.rep = Math.max(0, g.rep + eff.rep);
  if (eff.mistakes) g.mistakes += eff.mistakes;
  if (eff.rent) g.rent = eff.rent;
  if (eff.warmHome) g.warmHome = true;
  if (eff.blessing) g.blessing = true;
  if (eff.sick) {
    const m = g.family.find((x) => x.name === eff.sick && x.alive);
    if (m && !m.sick) m.sick = 1;
  }
  g.flags[event.key] = { choice: choice.key, day: g.absDay ?? g.day }; // ngày tuyệt đối, để khách quen vắt qua chương
  g.eventsSeen.push(event.key);
  return eff.result;
}
