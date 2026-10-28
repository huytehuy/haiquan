// Luật chơi & chấm điểm — chạy thuần bằng code, AI không tham gia chấm.
import { addDays, pick, shuffle } from './util.js';

export const START_DATE = '2026-10-28';
export const TOTAL_DAYS = 5;
export const PAY_CORRECT = 50;
export const ARREST_BONUS = 20;
export const FINE_WRONG = 30;
export const MAX_MISTAKES = 3; // quá 3 lỗi => Game Over
export const SCANS_PER_DAY = 2;
export const PRINTS_PER_DAY = 1; // lượt tra vân tay mỗi ngày
export const QUESTIONS_PER_VISITOR = 2;
export const STREAK_MIN = 3; // từ quyết định đúng thứ 3 liên tiếp trở đi được thưởng chuỗi
export const STREAK_BONUS = 10;

export const CATEGORIES = ['Cá nhân', 'Điện tử', 'Thực phẩm', 'Hóa chất/Sinh học', 'Dược phẩm', 'Vũ khí'];
export const BANNABLE_CATEGORIES = ['Hóa chất/Sinh học', 'Điện tử', 'Thực phẩm', 'Dược phẩm', 'Vũ khí'];
export const DOMESTIC_REGIONS = ['Neo-Saigon', 'Liên khu Mê Kông', 'Đà Lạt Cao Nguyên', 'Hải Cảng Vũng Tàu', 'Hà Nội Tự Trị', 'Đặc khu Phú Quốc'];
export const FOREIGN_REGIONS = ['Thành bang Phnom Penh', 'Tân Bangkok', 'Liên bang Nga', 'Neo-Tokyo', 'Seoul Mới', 'Manila Ngầm', 'Tân Dubai'];
export const WORK_PURPOSES = ['Công tác', 'Lao động'];

export const dayDate = (day) => addDays(START_DATE, day - 1);

const RULE_BUILDERS = {
  BAN_CATEGORY: (rng, used) => {
    const cat = pick(rng, BANNABLE_CATEGORIES.filter((c) => !used.cats.includes(c)));
    used.cats.push(cat);
    return { type: 'BAN_CATEGORY', category: cat };
  },
  TOURISM_MAX: (rng) => ({ type: 'TOURISM_MAX', max: pick(rng, [7, 10, 14]) }),
  WORK_PERMIT: () => ({ type: 'WORK_PERMIT' }),
  BAN_ORIGIN: (rng) => ({ type: 'BAN_ORIGIN', region: pick(rng, [...DOMESTIC_REGIONS.slice(1), ...FOREIGN_REGIONS]) }),
  CASH_LIMIT: (rng) => ({ type: 'CASH_LIMIT', limit: pick(rng, [1000, 2000, 2500]) }),
};

/** Sinh 2–3 quy tắc cho ngày. Ngày 1 & 2 cố định một phần để người chơi làm quen. */
export function makeDayRules(day, rng) {
  const used = { cats: [] };
  if (day === 1) {
    return [
      { type: 'BAN_CATEGORY', category: 'Hóa chất/Sinh học' },
      { type: 'TOURISM_MAX', max: 14 },
    ];
  }
  if (day === 2) {
    const second = pick(rng, ['BAN_CATEGORY', 'TOURISM_MAX', 'CASH_LIMIT']);
    return [{ type: 'WORK_PERMIT' }, RULE_BUILDERS[second](rng, used)];
  }
  const types = shuffle(rng, Object.keys(RULE_BUILDERS)).slice(0, 3);
  return types.map((t) => RULE_BUILDERS[t](rng, used));
}

export function describeRule(r) {
  switch (r.type) {
    case 'BAN_CATEGORY': return `Cấm người mang hành lý có vật phẩm thuộc nhóm "${r.category}".`;
    case 'TOURISM_MAX': return `Nếu mục đích là "Du lịch", thời gian lưu trú không được quá ${r.max} ngày.`;
    case 'WORK_PERMIT': return `Mục đích "Công tác" hoặc "Lao động" bắt buộc có Giấy phép lao động còn hạn.`;
    case 'BAN_ORIGIN': return `Tạm dừng nhập cảnh với người đến từ "${r.region}" (kiểm dịch).`;
    case 'CASH_LIMIT': return `Cấm mang quá $${r.limit} tiền mặt.`;
    default: return '';
  }
}

export function standingRules(date) {
  return [
    `Hộ chiếu phải còn hạn sau ngày ${date}.`,
    'Họ tên, số hộ chiếu, ngày sinh trên mọi giấy tờ phải trùng khớp. Sai lệch = giả mạo → BẮT GIỮ.',
    'Đối tượng trong lệnh truy nã, hoặc phát hiện hàng lậu giấu giếm (qua soi chiếu / lời khai) → BẮT GIỮ.',
    'Vi phạm quy định khác của ngày → TỪ CHỐI. Hợp lệ hoàn toàn → CHO QUA.',
  ];
}

const FIELD_LABEL = { name: 'Họ tên', id_number: 'Số hộ chiếu', dob: 'Ngày sinh' };
const DOC_LABEL = { entry_permit: 'Giấy phép nhập cảnh', work_permit: 'Giấy phép lao động', customs: 'Tờ khai hải quan' };

/**
 * Trả về danh sách vi phạm của một khách: [{ sev: 'DENY'|'ARREST', text, hidden? }].
 * ctx = { date, rules }
 */
export function checkRules(npc, ctx) {
  const d = npc.documents;
  const p = d.passport;
  const v = [];

  // Luật thường trực
  if (p.expiry_date <= ctx.date) v.push({ sev: 'DENY', text: `Hộ chiếu hết hạn (${p.expiry_date})` });

  for (const doc of ['entry_permit', 'work_permit', 'customs']) {
    if (!d[doc]) continue;
    for (const f of ['name', 'id_number', 'dob']) {
      if (d[doc][f] === undefined) continue;
      if (d[doc][f] !== p[f]) {
        v.push({ sev: 'ARREST', text: `Giấy tờ giả: ${FIELD_LABEL[f]} ở ${DOC_LABEL[doc]} (${d[doc][f]}) khác hộ chiếu (${p[f]})` });
      }
    }
  }

  if (npc.crime === 'WANTED') v.push({ sev: 'ARREST', text: npc.crime_detail || 'Đối tượng truy nã' });
  if (npc.crime === 'CONTRABAND') v.push({ sev: 'ARREST', text: `Buôn lậu: ${npc.crime_detail}` });

  // Quy tắc của ngày
  const purpose = d.entry_permit?.purpose;
  for (const r of ctx.rules) {
    if (r.type === 'BAN_CATEGORY') {
      const hit = d.customs.items.filter((i) => i.category === r.category);
      if (hit.length) v.push({ sev: 'DENY', text: `Mang vật phẩm bị cấm nhóm "${r.category}": ${hit.map((i) => i.name).join(', ')}` });
    } else if (r.type === 'TOURISM_MAX') {
      if (purpose === 'Du lịch' && d.entry_permit.duration_days > r.max)
        v.push({ sev: 'DENY', text: `Du lịch ${d.entry_permit.duration_days} ngày, vượt quá ${r.max} ngày` });
    } else if (r.type === 'WORK_PERMIT') {
      if (WORK_PURPOSES.includes(purpose)) {
        if (!d.work_permit) v.push({ sev: 'DENY', text: `Mục đích "${purpose}" nhưng không có Giấy phép lao động` });
        else if (d.work_permit.valid_until <= ctx.date)
          v.push({ sev: 'DENY', text: `Giấy phép lao động hết hạn (${d.work_permit.valid_until})` });
      }
    } else if (r.type === 'BAN_ORIGIN') {
      if (p.origin.includes(r.region)) v.push({ sev: 'DENY', text: `Đến từ khu vực đang tạm dừng nhập cảnh: ${r.region}` });
    } else if (r.type === 'CASH_LIMIT') {
      if (d.customs.cash > r.limit) v.push({ sev: 'DENY', text: `Mang $${d.customs.cash} tiền mặt, vượt mức $${r.limit}` });
    }
  }
  return v;
}

/** Các ô giấy tờ "máy đối chiếu" tô đỏ: thông tin lệch hộ chiếu và giấy tờ hết hạn. Dạng 'doc.field'. */
export function flaggedFields(npc, date) {
  const d = npc.documents;
  const p = d.passport;
  const out = new Set();
  if (p.expiry_date <= date) out.add('passport.expiry_date');
  if (d.work_permit && d.work_permit.valid_until <= date) out.add('work_permit.valid_until');
  for (const doc of ['entry_permit', 'work_permit', 'customs']) {
    if (!d[doc]) continue;
    for (const f of ['name', 'id_number', 'dob']) {
      if (d[doc][f] !== undefined && d[doc][f] !== p[f]) {
        out.add(`${doc}.${f}`);
        out.add(`passport.${f}`);
      }
    }
  }
  return out;
}

export function expectedVerdict(violations) {
  if (violations.some((x) => x.sev === 'ARREST')) return 'ARREST';
  if (violations.length) return 'DENY';
  return 'ALLOW';
}

/**
 * Chấm quyết định của người chơi.
 * - Khách hợp lệ: chỉ CHO QUA là đúng.
 * - Vi phạm hành chính: TỪ CHỐI đúng; CHO QUA = để lọt; BẮT GIỮ = bắt oan.
 * - Tội phạm (giả mạo/buôn lậu/truy nã): BẮT GIỮ đúng (+thưởng); TỪ CHỐI vẫn tính đúng; CHO QUA = để lọt.
 */
export function evaluateDecision(decision, violations) {
  const expected = expectedVerdict(violations);
  const base = { expected, decision, violations, pay: 0, bonus: 0, fine: 0 };

  if (expected === 'ALLOW') {
    if (decision === 'ALLOW') return { ...base, code: 'CORRECT_ALLOW', correct: true, pay: PAY_CORRECT, title: 'Chính xác — giấy tờ hợp lệ' };
    return {
      ...base, code: 'WRONG_PENALTY', correct: false, fine: FINE_WRONG,
      title: decision === 'ARREST' ? 'Bắt nhầm người vô tội!' : 'Từ chối người hợp lệ!',
    };
  }
  if (expected === 'DENY') {
    if (decision === 'DENY') return { ...base, code: 'CORRECT_DENY', correct: true, pay: PAY_CORRECT, title: 'Chính xác — từ chối đúng luật' };
    if (decision === 'ARREST') return { ...base, code: 'WRONG_ARREST', correct: false, fine: FINE_WRONG, title: 'Bắt giữ oan! Chỉ cần từ chối.' };
    return { ...base, code: 'WRONG_ALLOW', correct: false, fine: FINE_WRONG, title: 'Để lọt người vi phạm!' };
  }
  // expected ARREST
  if (decision === 'ARREST') return { ...base, code: 'CORRECT_ARREST', correct: true, pay: PAY_CORRECT, bonus: ARREST_BONUS, title: 'Bắt giữ thành công!' };
  if (decision === 'DENY') return { ...base, code: 'CORRECT_DENY', correct: true, pay: PAY_CORRECT, title: 'Từ chối đúng — nhưng lẽ ra nên bắt giữ' };
  return { ...base, code: 'WRONG_ALLOW', correct: false, fine: FINE_WRONG, title: 'Để lọt tội phạm!' };
}
