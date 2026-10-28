// Kinh tế ngoài giờ làm: ca trực có giờ giấc, chi tiêu gia đình, cửa hàng nâng cấp, thanh tra nội bộ, báo sáng.
import { chance, pick } from './util.js';

// ---------------- Ca trực ----------------
export const SHIFT_START = 8 * 60; // 08:00
export const SHIFT_END = 17 * 60; // 17:00
export const GAME_MIN_PER_SEC = 1.5; // 9 tiếng ca ≈ 6 phút thật
export const COFFEE_MINUTES = 60;

export const fmtClock = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

// ---------------- Gia đình ----------------
export const EXPENSES = [
  { key: 'rent', label: 'Tiền nhà', price: 100, required: true, note: 'Bắt buộc — không trả là bị đuổi khỏi nhà' },
  { key: 'food', label: 'Thức ăn', price: 50, note: 'Nhịn 2 đêm liền là có người ốm' },
  { key: 'heat', label: 'Sưởi ấm', price: 30, note: 'Trời lạnh — không sưởi thì một người sẽ cảm' },
  { key: 'medicine', label: 'Thuốc men', price: 60, note: 'Chữa khỏi mọi người đang ốm', onlyIfSick: true },
];

export function newFamily() {
  return [
    { name: 'Mẹ già', icon: '👵', hunger: 0, sick: 0, alive: true },
    { name: 'Bạn đời', icon: '🧑', hunger: 0, sick: 0, alive: true },
    { name: 'Bé Na', icon: '👧', hunger: 0, sick: 0, alive: true },
  ];
}

export const familySick = (family) => family.some((m) => m.alive && m.sick > 0);

export function familyStatus(m) {
  if (!m.alive) return 'Đã mất';
  if (m.sick >= 2) return 'Ốm nặng';
  if (m.sick === 1) return 'Bị ốm';
  if (m.hunger > 0) return 'Đói';
  return 'Khỏe';
}

/** Các khoản chi của đêm nay theo hoàn cảnh nhà: tiền nhà thay đổi theo sự kiện, nhà ấm thì không cần sưởi. */
export function expensesFor(g) {
  return EXPENSES.filter((x) => !(x.key === 'heat' && g.warmHome)).map((x) => (x.key === 'rent' ? { ...x, price: g.rent } : x));
}

/**
 * Áp dụng chi tiêu đêm nay vào gia đình, trả về danh sách sự kiện (tin nhà).
 * home = { warmHome, blessing } — phúc lành từ chùa chặn được một lần ngã bệnh rồi hết.
 */
export function applyNight(family, paid, home = {}) {
  const events = [];
  const alive = family.filter((m) => m.alive);
  const makeSick = (m, msg) => {
    if (home.blessing) {
      home.blessing = false;
      events.push(`🙏 Nhờ phúc lành từ chùa, ${m.name} tai qua nạn khỏi.`);
      return;
    }
    m.sick = 1;
    events.push(msg);
  };
  if (home.warmHome) paid = { ...paid, heat: true };

  if (paid.medicine) {
    for (const m of alive) if (m.sick) { m.sick = 0; events.push(`${m.name} đã khỏi bệnh nhờ có thuốc.`); }
  } else {
    for (const m of alive) {
      if (!m.sick) continue;
      m.sick++;
      if (m.sick >= 3) {
        m.alive = false;
        events.push(`💀 ${m.name} đã qua đời vì bệnh không được chữa.`);
      } else events.push(`${m.name} ốm nặng hơn. Cần mua thuốc ngay.`);
    }
  }

  if (paid.food) for (const m of alive) m.hunger = 0;
  else {
    for (const m of alive.filter((x) => x.alive)) {
      m.hunger++;
      if (m.hunger >= 2 && !m.sick) makeSick(m, `${m.name} ngã bệnh vì đói.`);
    }
    events.push('Cả nhà đi ngủ với cái bụng đói.');
  }

  if (!paid.heat) {
    // người yếu nhất còn khỏe sẽ bị cảm
    const victim = [family[2], family[0], family[1]].find((m) => m.alive && !m.sick);
    if (victim) makeSick(victim, `Nhà lạnh buốt — ${victim.name} bị cảm.`);
  }
  if (!events.length) events.push('Cả nhà ấm no, mọi người đều khỏe.');
  return events;
}

// ---------------- Cửa hàng ----------------
export const SHOP = [
  { key: 'scan', label: 'Máy soi đời mới', desc: '+1 lượt soi X-quang mỗi ngày', price: 80, max: 2 },
  { key: 'question', label: 'Sổ tay thẩm vấn', desc: '+1 câu hỏi cho mỗi khách', price: 60, max: 1 },
  { key: 'polygraph', label: 'Máy phát hiện nói dối', desc: 'Đo nhịp tim sau mỗi câu trả lời', price: 120, max: 1 },
  { key: 'fingerprint', label: 'Đầu đọc vân tay thứ hai', desc: '+1 lượt tra vân tay mỗi ngày', price: 70, max: 2 },
  { key: 'comparator', label: 'Máy đối chiếu giấy tờ', desc: 'Tự tô đỏ ô thông tin lệch nhau / hết hạn', price: 150, max: 1 },
  { key: 'coffee', label: 'Máy pha cà phê', desc: `Ca làm dài thêm ${COFFEE_MINUTES} phút`, price: 70, max: 1 },
  { key: 'lawyer', label: 'Thuê luật sư', desc: 'Xóa 1 cảnh cáo (dùng ngay)', price: 100, consumable: true },
];

export const newUpgrades = () => ({ scan: 0, question: 0, comparator: 0, coffee: 0, polygraph: 0, fingerprint: 0 });

// ---------------- Hối lộ & thanh tra nội bộ ----------------
export const AUDIT_CHANCE = 0.3;

/** Mỗi phong bì đã nhận có `p` (mặc định 30%) bị phát hiện: phạt gấp đôi + 1 cảnh cáo. */
export function audit(rng, bribes, p = AUDIT_CHANCE) {
  return bribes.map((b) => ({ ...b, caught: chance(rng, p) }));
}

// ---------------- Báo sáng ----------------
const RULE_NEWS = {
  BAN_CATEGORY: {
    'Hóa chất/Sinh học': 'Rò rỉ hóa chất tại cảng Hiệp Phước — Bộ siết hàng hóa chất, sinh học',
    'Điện tử': 'Virus máy tính lây qua thiết bị nhập lậu — tạm cấm hàng điện tử',
    'Thực phẩm': 'Dịch tả lợn bùng phát — cấm mang thực phẩm qua cửa khẩu',
    'Dược phẩm': 'Thuốc giả tràn lan — Bộ Y tế cấm dược phẩm xách tay',
    'Vũ khí': 'Xả súng ở Quận 4 Ngầm — cấm tuyệt đối vũ khí',
  },
  TOURISM_MAX: (r) => `Lao động chui đội lốt du khách — thời hạn du lịch rút còn ${r.max} ngày`,
  WORK_PERMIT: () => 'Bộ Lao động mở đợt truy quét lao động không phép',
  BAN_ORIGIN: (r) => `Dịch cúm lạ bùng phát tại ${r.region} — tạm đóng cửa với khu vực này`,
  CASH_LIMIT: (r) => `Đường dây rửa tiền bị triệt phá — giới hạn tiền mặt còn $${r.limit}`,
};

export function ruleHeadline(r) {
  const n = RULE_NEWS[r.type];
  return typeof n === 'function' ? n(r) : n[r.category];
}

/** Tít báo về hậu quả các quyết định hôm qua. */
export function consequenceHeadlines(results, rng) {
  const out = [];
  for (const r of results) {
    const npc = r.npc;
    const name = npc.documents.passport.name;
    const custom = npc.news?.[r.decision];
    if (custom) { out.push({ text: custom, weight: 3 }); continue; }
    if (npc.crime && r.decision === 'ALLOW') {
      const text = {
        CONTRABAND: `Hàng lậu tuồn qua cửa khẩu — ${npc.crime_detail.toLowerCase()} bị phát hiện ở chợ đen`,
        FORGERY: `Kẻ dùng giấy tờ giả "${name}" lọt qua cửa khẩu, Bộ An ninh truy tìm`,
        WANTED: `Đối tượng truy nã lọt lưới, gây án mới trong thành phố`,
      }[npc.crime];
      out.push({ text, weight: 2 });
    } else if (r.decision === 'ARREST' && r.result.expected === 'ARREST') {
      out.push({ text: `Cửa khẩu bắt giữ ${name} — ${(npc.crime_detail || 'giấy tờ giả').toLowerCase()}`, weight: 1 });
    } else if (r.decision === 'ARREST' && !r.result.correct) {
      out.push({ text: `Dư luận phẫn nộ: ${name} bị bắt oan tại cửa khẩu`, weight: 2 });
    }
  }
  out.sort((a, b) => b.weight - a.weight);
  const fillers = [
    'Lễ hội ánh sáng Neo-Saigon thu hút hàng vạn du khách',
    'Giá gạo tăng 12% sau đợt xâm nhập mặn ở miền Tây',
    'Tàu điện ngầm tuyến 3 tiếp tục chậm tiến độ',
    'Tập đoàn Rồng Lửa ra mắt chip thần kinh thế hệ mới',
  ];
  if (out.length < 2) out.push({ text: pick(rng, fillers) });
  return out.slice(0, 3).map((x) => x.text);
}
