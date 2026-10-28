// Sinh danh sách khách mỗi ngày: nhân vật viết tay (npcs.json) + khách ngẫu nhiên.
import { pick, randInt, chance, shuffle, addDays, clone } from './util.js';
import { DOMESTIC_REGIONS, FOREIGN_REGIONS, WORK_PURPOSES } from './rules.js';

const SURNAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const MID = { Nam: ['Văn', 'Hữu', 'Đức', 'Minh', 'Quốc', 'Thành', 'Gia'], Nữ: ['Thị', 'Ngọc', 'Thu', 'Mỹ', 'Bích', 'Thanh', 'Kim'] };
const GIVEN = {
  Nam: ['An', 'Bình', 'Cường', 'Dũng', 'Hải', 'Hùng', 'Khang', 'Long', 'Nam', 'Phong', 'Quân', 'Sơn', 'Tài', 'Vinh', 'Tùng', 'Đạt'],
  Nữ: ['Anh', 'Chi', 'Hà', 'Hạnh', 'Hoa', 'Lan', 'Linh', 'Mai', 'Ngân', 'Nhung', 'Phương', 'Thảo', 'Trang', 'Vy', 'Uyên', 'Xuân'],
};
// [vùng, tên nam, tên nữ, họ, họ đứng trước?]
const FOREIGN = [
  ['Liên bang Nga', ['Ivan', 'Dmitri', 'Sergei', 'Pavel'], ['Olga', 'Natasha', 'Irina', 'Daria'], ['Volkov', 'Sokolov', 'Petrov', 'Orlov'], false],
  ['Tân Bangkok', ['Somchai', 'Anan', 'Kittisak', 'Niran'], ['Nattaya', 'Malee', 'Siriporn', 'Ploy'], ['Wongsa', 'Srisuk', 'Chaiyo', 'Boonmee'], false],
  ['Seoul Mới', ['Min-jun', 'Ji-ho', 'Seo-jun', 'Do-yun'], ['Ji-woo', 'Seo-yeon', 'Ha-eun', 'Su-bin'], ['Lee', 'Park', 'Choi', 'Jung'], true],
  ['Neo-Tokyo', ['Hiro', 'Ren', 'Daiki', 'Sota'], ['Yuki', 'Aoi', 'Hana', 'Mei'], ['Tanaka', 'Sato', 'Suzuki', 'Ito'], true],
  ['Thành bang Phnom Penh', ['Dara', 'Vibol', 'Sokha', 'Rithy'], ['Sophea', 'Chenda', 'Bopha', 'Srey'], ['Sok', 'Chan', 'Kim', 'Heng'], false],
  ['Manila Ngầm', ['Jose', 'Miguel', 'Paolo', 'Rafael'], ['Maria', 'Andrea', 'Bea', 'Carmela'], ['Santos', 'Reyes', 'Cruz', 'Bautista'], false],
  ['Tân Dubai', ['Omar', 'Khalid', 'Yusuf', 'Tariq'], ['Layla', 'Amira', 'Noor', 'Salma'], ['Haddad', 'Nasser', 'Farouk', 'Saleh'], false],
];
const GANGSTERS = ['Hồ Văn Sẹo', 'Lâm "Mắt Lé" Phát', 'Quách Thị Độc', 'Tạ Hùng "Búa"', 'Mã Văn Lửa'];
const DISTRICTS = ['Quận 1', 'Phường 7', 'Khu Cảng', 'Khu Bắc', 'Khu Đông', 'Phố Cổ', 'Khu Tây', 'Ngoại ô Nam'];
const REGION_CODE = {
  'Neo-Saigon': 'NS', 'Liên khu Mê Kông': 'MK', 'Đà Lạt Cao Nguyên': 'DL', 'Hải Cảng Vũng Tàu': 'VT', 'Hà Nội Tự Trị': 'HN',
  'Đặc khu Phú Quốc': 'PQ', 'Thành bang Phnom Penh': 'KH', 'Tân Bangkok': 'TH', 'Liên bang Nga': 'RU', 'Neo-Tokyo': 'JP',
  'Seoul Mới': 'KR', 'Manila Ngầm': 'PH', 'Tân Dubai': 'AE',
};

const ITEMS = {
  'Cá nhân': ['Quần áo', 'Đồ vệ sinh cá nhân', 'Sách cũ', 'Ảnh gia đình', 'Ô gấp', 'Giày thể thao', 'Gối du lịch'],
  'Điện tử': ['Laptop', 'Máy ảnh', 'Tai nghe thần kinh', 'Sạc dự phòng', 'Máy tính bảng', 'Kính thực tế ảo'],
  'Thực phẩm': ['Bánh pía', 'Cà phê rang', 'Trái cây tươi', 'Khô mực', 'Mắm tôm', 'Mì gói'],
  'Hóa chất/Sinh học': ['Dung dịch tẩy rửa công nghiệp', 'Mẫu xét nghiệm sinh học', 'Phân bón hữu cơ', 'Thuốc trừ sâu'],
  'Dược phẩm': ['Thuốc kháng sinh', 'Thuốc bổ thảo dược', 'Insulin', 'Thuốc giảm đau'],
  'Vũ khí': ['Dao găm gấp', 'Súng điện tự vệ', 'Bình xịt hơi cay'],
};
const SCAN_REVEAL = {
  'Cá nhân': 'Đồ dùng cá nhân thông thường', 'Điện tử': 'Thiết bị điện tử thông thường', 'Thực phẩm': 'Thực phẩm',
  'Hóa chất/Sinh học': 'Chất lỏng/hóa chất đóng chai', 'Dược phẩm': 'Thuốc đóng hộp có nhãn', 'Vũ khí': 'Vật thể kim loại sắc nhọn',
};
const CONTRABAND = [
  'Ma túy tổng hợp "Neon Dust"', 'Vi mạch quân sự lậu', 'Ngà voi chạm khắc', 'Linh kiện súng in 3D', 'Thuốc biến đổi gien', 'Tiền giả 50.000 đô',
];
const EMPLOYERS = ['Tập đoàn Rồng Lửa Cybernetics', 'Cảng tự động Hiệp Phước', 'Bệnh viện Chợ Rẫy 2', 'Xưởng chip Thủ Đức', 'Nhà hàng Phở Neon', 'Công ty Xây dựng Mặt Trời'];
const RELATIVES = ['con trai', 'con gái', 'mẹ già', 'em gái', 'anh trai', 'người yêu', 'cháu nội'];
const DESTS = ['Neo-Tokyo', 'Seoul Mới', 'Tân Dubai', 'Sydney Nổi', 'Paris Mới'];
const PERSONALITIES = [
  ['Bình tĩnh, lịch sự, trả lời rõ ràng', 'calm'],
  ['Hay lo lắng, nói lắp khi căng thẳng nhưng thật thà', 'nervous'],
  ['Nóng nảy, khó chịu vì phải xếp hàng lâu', 'angry'],
  ['Nói nhiều, thân thiện, hay kể lể chuyện gia đình', 'calm'],
  ['Mệt mỏi sau chuyến đi dài, trả lời cộc lốc', 'calm'],
  ['Kiêu ngạo, coi thường nhân viên cửa khẩu', 'angry'],
  ['Rụt rè, hay xin lỗi', 'pleading'],
];
const GREETINGS = {
  calm: ['Chào thanh tra. Giấy tờ của tôi đây.', 'Xin chào, mời thanh tra kiểm tra.', 'Chào buổi sáng. Hồ sơ đầy đủ đây ạ.'],
  nervous: ['D-dạ chào thanh tra... giấy tờ đây ạ.', 'Chào... chào anh. Đây, đây ạ.'],
  angry: ['Nhanh lên giùm, tôi đứng nãy giờ mỏi chân rồi!', 'Giấy tờ đây. Đừng bắt tôi chờ lâu.'],
  pleading: ['Dạ, em chào thanh tra, mong thanh tra giúp đỡ ạ.', 'Xin lỗi đã làm phiền, giấy tờ của tôi đây ạ.'],
};

const SKINS = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#d4a373'];
const HAIR_COLORS = ['#1b1b1b', '#3b2a1a', '#6b4423', '#a0a0a0', '#d9d9d9', '#c0392b', '#00e5ff', '#ff2bd6', '#e3c16f'];
const CLOTHES = ['#2c3e50', '#8e44ad', '#27ae60', '#c0392b', '#2980b9', '#d35400', '#16a085', '#7f8c8d', '#34495e', '#6d214f', '#b33939'];
const HAIRS = { Nam: ['short', 'short', 'bald', 'cap', 'mohawk', 'hood', 'shaved'], Nữ: ['long', 'long', 'bob', 'bun', 'hood', 'cap'] };
const ACCS = { Nam: ['glasses', 'beard', 'mustache', 'implant', 'scar', 'earring'], Nữ: ['glasses', 'implant', 'earring'] };

export function randomAvatar(rng, sex, avoid = []) {
  for (let tries = 0; tries < 20; tries++) {
    const acc = [];
    if (chance(rng, 0.45)) acc.push(pick(rng, ACCS[sex]));
    if (chance(rng, 0.15)) acc.push(pick(rng, ACCS[sex]));
    const a = {
      skin: pick(rng, SKINS),
      hair: pick(rng, HAIRS[sex]),
      hairColor: pick(rng, HAIR_COLORS),
      hatColor: pick(rng, CLOTHES),
      clothes: pick(rng, CLOTHES),
      acc: [...new Set(acc)],
    };
    const looksLike = avoid.some((b) => b.hair === a.hair && b.skin === a.skin && b.hairColor === a.hairColor);
    if (!looksLike) return a;
  }
  return { skin: '#d4a373', hair: 'hood', hairColor: '#3b2a1a', hatColor: '#555', clothes: '#555', acc: [] };
}

const isoDob = (rng) => `${randInt(rng, 1950, 2006)}-${String(randInt(rng, 1, 12)).padStart(2, '0')}-${String(randInt(rng, 1, 28)).padStart(2, '0')}`;
const makeId = (rng, region) => `${REGION_CODE[region] || 'XX'}-${String(randInt(rng, 10000, 99999))}`;

const NAME_TWEAKS = [['ễ', 'ể'], ['ă', 'â'], ['ư', 'u'], ['ơ', 'ô'], ['Thị', 'Thi'], ['y', 'i'], ['ồ', 'ố'], ['ạ', 'ả'], ['an', 'ang'], ['o', 'oa']];
function tweakName(rng, name) {
  for (const [a, b] of shuffle(rng, NAME_TWEAKS)) if (name.includes(a)) return name.replace(a, b);
  return name + 'a';
}
function tweakDob(rng, dob) {
  const [y, m, d] = dob.split('-');
  if (+d <= 12 && d !== m && chance(rng, 0.4)) return `${y}-${d}-${m}`;
  return `${+y + pick(rng, [-3, -2, -1, 1, 2])}-${m}-${d}`;
}
function tweakId(rng, id) {
  const i = randInt(rng, 3, id.length - 1);
  const c = String((+id[i] + randInt(rng, 1, 8)) % 10);
  return id.slice(0, i) + c + id.slice(i + 1);
}

/** Chọn kiểu vi phạm cho khách ngẫu nhiên. */
function rollViolation(rng, day, rules, unlocks) {
  const r = rng();
  const cleanP = day === 1 ? 0.5 : 0.45;
  if (r < cleanP) return null;
  if (r < cleanP + 0.15) return { kind: 'EXPIRED' };
  if (unlocks?.tools.has('scan') && r > 0.92) return { kind: 'CONTRABAND' };
  if (r > 0.84 || !rules.length) return { kind: 'FORGERY' };
  return { kind: 'RULE', rule: pick(rng, rules) };
}

function makeFiller(rng, idx, ctx, violation, avoidAvatars) {
  const { date, rules } = ctx;
  const ruleOf = (t) => rules.find((r) => r.type === t);
  const vRule = violation?.kind === 'RULE' ? violation.rule : null;
  const bannedRegion = ruleOf('BAN_ORIGIN')?.region;

  // Danh tính
  let name, sex, region;
  if (chance(rng, 0.3)) {
    const [reg, males, females, lasts, lastFirst] = pick(rng, FOREIGN);
    sex = chance(rng, 0.5) ? 'Nam' : 'Nữ';
    const first = pick(rng, sex === 'Nam' ? males : females);
    let last = pick(rng, lasts);
    if (reg === 'Liên bang Nga' && sex === 'Nữ') last += 'a';
    name = lastFirst ? `${last} ${first}` : `${first} ${last}`;
    region = reg;
  } else {
    sex = chance(rng, 0.5) ? 'Nam' : 'Nữ';
    name = `${pick(rng, SURNAMES)} ${pick(rng, MID[sex])} ${pick(rng, GIVEN[sex])}`;
    region = pick(rng, DOMESTIC_REGIONS);
  }
  if (vRule?.type === 'BAN_ORIGIN') region = vRule.region;
  else if (region === bannedRegion) region = 'Neo-Saigon';
  const origin = `${pick(rng, DISTRICTS)}, ${region}`;
  const dob = isoDob(rng);
  const id = makeId(rng, region);

  // Mục đích & thời gian
  let purpose = pick(rng, ['Du lịch', 'Du lịch', 'Công tác', 'Thăm thân', 'Thăm thân', 'Lao động', 'Quá cảnh']);
  if (vRule?.type === 'TOURISM_MAX') purpose = 'Du lịch';
  if (vRule?.type === 'WORK_PERMIT') purpose = pick(rng, WORK_PURPOSES);
  const tourMax = ruleOf('TOURISM_MAX')?.max;
  let duration = {
    'Du lịch': randInt(rng, 3, 20), 'Công tác': randInt(rng, 2, 30), 'Thăm thân': randInt(rng, 5, 45),
    'Lao động': randInt(rng, 90, 365), 'Quá cảnh': randInt(rng, 1, 3),
  }[purpose];
  if (purpose === 'Du lịch' && tourMax) {
    if (vRule?.type === 'TOURISM_MAX') duration = tourMax + randInt(rng, 1, 10);
    else duration = chance(rng, 0.3) ? tourMax : Math.min(duration, tourMax);
  }

  // Giấy phép lao động
  const employer = pick(rng, EMPLOYERS);
  let workPermit = null;
  if (WORK_PURPOSES.includes(purpose)) {
    const needs = !!ruleOf('WORK_PERMIT');
    const hasIt = vRule?.type === 'WORK_PERMIT' ? chance(rng, 0.4) : needs || chance(rng, 0.7);
    if (hasIt) {
      const expired = vRule?.type === 'WORK_PERMIT';
      workPermit = {
        name, id_number: id, employer,
        valid_until: expired ? addDays(date, -randInt(rng, 0, 90)) : addDays(date, randInt(rng, 30, 700)),
      };
    }
  }

  // Hành lý
  const banned = rules.filter((r) => r.type === 'BAN_CATEGORY').map((r) => r.category);
  const allowedCats = ['Cá nhân', 'Cá nhân', 'Điện tử', 'Thực phẩm', 'Dược phẩm', 'Hóa chất/Sinh học'].filter((c) => !banned.includes(c));
  const items = [{ name: pick(rng, ITEMS['Cá nhân']), category: 'Cá nhân' }];
  for (let i = 0, n = randInt(rng, 1, 2); i < n; i++) {
    const cat = pick(rng, allowedCats);
    const it = pick(rng, ITEMS[cat]);
    if (!items.some((x) => x.name === it)) items.push({ name: it, category: cat });
  }
  if (vRule?.type === 'BAN_CATEGORY') items.push({ name: pick(rng, ITEMS[vRule.category]), category: vRule.category });

  // Tiền mặt
  const cashLimit = ruleOf('CASH_LIMIT')?.limit;
  let cash = randInt(rng, 1, 30) * 50;
  if (cashLimit) {
    if (vRule?.type === 'CASH_LIMIT') cash = cashLimit + randInt(rng, 1, 30) * 100;
    else cash = chance(rng, 0.25) ? cashLimit : Math.min(cash, cashLimit);
  }

  // Hộ chiếu
  let expiry = addDays(date, randInt(rng, 20, 2000));
  if (chance(rng, 0.12)) expiry = addDays(date, 1); // sát nút nhưng vẫn hợp lệ
  if (violation?.kind === 'EXPIRED') expiry = chance(rng, 0.3) ? date : addDays(date, -randInt(rng, 1, 300));

  const passport = { name, sex, dob, id_number: id, expiry_date: expiry, origin };
  const entry = { name, dob, id_number: id, purpose, duration_days: duration };
  const customs = { name, items, cash };

  if (violation?.kind === 'FORGERY') {
    const field = pick(rng, ['name', 'dob', 'id_number']);
    const canWork = workPermit && (!ctx.unlocks || ctx.unlocks.docs.has('work_permit'));
    const target = canWork && field !== 'dob' && chance(rng, 0.3) ? workPermit : entry;
    target[field] = field === 'name' ? tweakName(rng, name) : field === 'dob' ? tweakDob(rng, dob) : tweakId(rng, id);
  }

  const scan = items.map((i) => ({ item: i.name, reveal: SCAN_REVEAL[i.category] }));
  let crime = null, crime_detail;
  if (violation?.kind === 'CONTRABAND') {
    const ci = randInt(rng, 0, scan.length - 1);
    const good = pick(rng, CONTRABAND);
    scan[ci] = { item: scan[ci].item, reveal: `Ngăn giấu bên trong: ${good}`, contraband: true };
    crime = 'CONTRABAND';
    crime_detail = `Giấu ${good} trong ${scan[ci].item}`;
  } else if (violation?.kind === 'FORGERY') {
    crime = 'FORGERY';
    crime_detail = 'Dùng giấy tờ làm giả';
  }
  // Cơ sở dữ liệu vân tay: kẻ làm giả giấy tờ thường đã có tiền án/lệnh cấm
  const fingerprint = {
    name,
    record: crime === 'FORGERY' ? pick(rng, ['BỊ CẤM NHẬP CẢNH — tiền án lừa đảo', 'Đã bị trục xuất năm 2024', 'Có tên trong danh sách hạn chế xuất nhập cảnh'])
      : crime === 'CONTRABAND' && chance(rng, 0.5) ? 'Tiền án: buôn lậu (2023)'
        : 'Không tiền án',
  };

  // Phong bì phải đủ hấp dẫn so với lương một lượt đúng ($50–70)
  const bribe = crime && chance(rng, 0.6) ? pick(rng, [250, 350, 450]) : undefined;

  // Tính cách & câu chuyện cho AI nhập vai
  const [personality, temper] = pick(rng, PERSONALITIES);
  const alibi = {
    'Du lịch': `Đi du lịch ${duration} ngày, ngắm cảnh và ăn uống ở Neo-Saigon`,
    'Công tác': `Đi công tác ${duration} ngày cho ${employer}`,
    'Thăm thân': `Thăm ${pick(rng, RELATIVES)} đang sống ở ${pick(rng, DISTRICTS)}, Neo-Saigon`,
    'Lao động': `Vào làm việc dài hạn tại ${employer}`,
    'Quá cảnh': `Chỉ quá cảnh ${duration} ngày để bay tiếp sang ${pick(rng, DESTS)}`,
  }[purpose];
  let secret = 'Không giấu gì cả, hoàn toàn thật thà.';
  const triggers = {};
  if (violation?.kind === 'EXPIRED') {
    secret = 'Biết hộ chiếu đã hết hạn nhưng chưa kịp gia hạn, hy vọng được châm chước.';
    triggers.if_asked_about_passport = 'Lúng túng, xin thông cảm, hứa sẽ gia hạn ngay';
  } else if (violation?.kind === 'FORGERY') {
    secret = 'Bị cấm nhập cảnh nên mua giấy tờ giả ở chợ đen; kẻ làm giả ghi sai một chi tiết.';
    triggers.if_asked_about_mismatch = 'Bảo là cơ quan in nhầm, rồi lảng sang chuyện khác';
    triggers.if_threatened = bribe ? `Run rẩy, nài nỉ, dúi phong bì $${bribe}` : 'Run rẩy, nài nỉ xin bỏ qua';
  } else if (violation?.kind === 'CONTRABAND') {
    secret = `${crime_detail} để bán ở chợ đen kiếm tiền.`;
    triggers.if_asked_about_luggage = 'Khăng khăng là đồ cá nhân bình thường, không cho mở';
    triggers.if_threatened = bribe ? `Hoảng loạn, dúi phong bì $${bribe} xin bỏ qua` : 'Hoảng loạn, cãi cố';
  } else if (vRule) {
    secret = {
      BAN_CATEGORY: `Mang theo ${items[items.length - 1].name} mà không biết hôm nay nhóm hàng đó bị cấm.`,
      TOURISM_MAX: `Muốn ở ${duration} ngày cho thoải mái, không biết có giới hạn.`,
      WORK_PERMIT: workPermit ? 'Giấy phép lao động đã hết hạn nhưng nghĩ không ai kiểm tra.' : 'Chưa xin được giấy phép lao động, định vào làm chui.',
      BAN_ORIGIN: `Đến từ ${region}, nơi đang kiểm dịch, nhưng khẳng định mình khỏe mạnh.`,
      CASH_LIMIT: `Mang $${cash} tiền mặt để làm ăn, không biết có giới hạn.`,
    }[vRule.type];
  }

  return {
    id: `gen_${ctx.day}_${idx}`,
    generated: true,
    crime,
    crime_detail,
    bribe,
    fingerprint,
    avatar: randomAvatar(rng, sex, avoidAvatars),
    documents: { passport, entry_permit: entry, customs, ...(workPermit ? { work_permit: workPermit } : {}) },
    scan,
    ai_persona: { personality, temper, true_story: `${alibi}. ${secret}`, alibi, triggers },
    lines: { greeting: pick(rng, GREETINGS[temper]) },
  };
}

/** Nhân vật có điều kiện xuất hiện: requires (tất cả phải khớp) / excludes (khớp một là loại) theo quyết định trước đó. */
const matches = (rule, decisions) => rule.decisions.includes(decisions[rule.npc]?.decision);
export const eligible = (n, decisions) =>
  (n.requires || []).every((r) => matches(r, decisions)) && !(n.excludes || []).some((r) => matches(r, decisions));

/**
 * Xếp lịch cho nhân vật viết tay của một chương: mỗi ván một thứ tự khác, tôn trọng minDay / fixedDay
 * và điều kiện requires/excludes. Trả về { npcId: day }. Cùng rng-seed + cùng quyết định → cùng lịch.
 */
// Nhân vật có tên mỗi ngày & tổng số khách mục tiêu — ngày ngắn, phần lớn là người có câu chuyện
const DAILY_NAMED = [2, 3, 3, 3, 2, 2, 0];
const DAILY_TOTAL = [4, 5, 5, 5, 5, 5, 4];

export function planSchedule(allNpcs, rng, totalDays, decisions = {}) {
  // Số nhân vật có tên được xếp vào mỗi ngày (chưa tính ngày cố định & khách quen)
  const capacity = DAILY_NAMED.slice(0, totalDays);
  const pool = allNpcs.filter((n) => !n.follow && eligible(n, decisions));
  const plan = {};
  for (const n of pool.filter((x) => x.fixedDay)) plan[n.id] = n.fixedDay;
  // xếp nhân vật kén ngày (minDay cao) trước để chắc chắn còn chỗ
  const rest = shuffle(rng, pool.filter((x) => !x.fixedDay)).sort((a, b) => b.minDay - a.minDay);
  for (const n of rest) {
    // chọn ngẫu nhiên trong các ngày còn trống nhiều chỗ nhất → lịch ngẫu nhiên nhưng đều
    let best = 0;
    for (let d = n.minDay; d <= totalDays; d++) best = Math.max(best, capacity[d - 1]);
    if (best === 0) continue; // hết chỗ: nhân vật này vắng mặt ván này → mỗi ván một dàn khác
    const days = [];
    for (let d = n.minDay; d <= totalDays; d++) if (capacity[d - 1] === best) days.push(d);
    const day = pick(rng, days);
    capacity[day - 1]--;
    plan[n.id] = day;
  }
  return plan;
}

/**
 * Nhân vật quay lại, `delay` ngày sau khi:
 * - follow.after: người chơi ra quyết định nằm trong `decisions` với nhân vật đó; hoặc
 * - follow.event: người chơi chọn một trong `choices` ở sự kiện ban đêm đó.
 */
function followUpDue(n, day, history, flags) {
  if (!n.follow) return false;
  const h = n.follow.event ? flags[n.follow.event] : history[n.follow.after];
  if (!h) return false;
  const picked = n.follow.event ? n.follow.choices.includes(h.choice) : n.follow.decisions.includes(h.decision);
  return picked && h.day + n.follow.delay === day;
}

/**
 * Sinh toàn bộ dữ liệu của một ngày: khách + lệnh truy nã.
 * schedule = { npcId: day } từ planSchedule(); history = { npcId: { decision, day } }; flags = lựa chọn sự kiện đêm.
 * Ngày trong history/flags là ngày tuyệt đối (ctx.absDay) để khách quen có thể vắt qua chương sau.
 * ctx.extraVisitors: khách thêm cho ngày đặc biệt.
 */
export function buildRoster(day, rng, ctx, allNpcs, schedule, history = {}, flags = {}) {
  const absDay = ctx.absDay ?? day;
  const scheduled = allNpcs.filter((n) => schedule[n.id] === day || followUpDue(n, absDay, history, flags)).map(clone);
  // Hàng chờ dài hơn sức xử lý trong một ca — làm nhanh thì kiếm nhiều hơn
  const total = (DAILY_TOTAL[day - 1] ?? 5) + (ctx.extraVisitors || 0);
  const fillerCount = Math.max(total - scheduled.length, 1);

  // Kẻ đã "mua đường" (nhận tiền ở sự kiện đêm) thì không có tên trên lệnh truy nã
  const onBulletin = (n) => !(n.follow?.hiddenWhen || []).includes(flags[n.follow?.event]?.choice);
  const wanted = scheduled
    .filter((n) => n.crime === 'WANTED' && onBulletin(n))
    .map((n) => ({ ...n.wanted, avatar: n.avatar, npcId: n.id }));
  if (scheduled.some((n) => n.boss)) {
    wanted.push({
      name: 'Trùm "Hắc Long"', id_number: 'Không rõ', charge: 'Cầm đầu đường dây buôn lậu, bắt cóc, rửa tiền',
      note: 'Tin mật: sẽ qua quầy 7 hôm nay dưới danh tính giả. Đối chiếu bảng ghim manh mối.', unknown: true,
    });
  }
  if (day >= 3) {
    wanted.push({
      name: pick(rng, GANGSTERS), id_number: makeId(rng, pick(rng, DOMESTIC_REGIONS)),
      charge: pick(rng, ['Buôn người', 'Trộm dữ liệu sinh trắc', 'Đánh bom kho cảng']),
      avatar: randomAvatar(rng, 'Nam'), note: 'Nguy hiểm, có thể có vũ khí.',
    });
  }
  const avoid = wanted.map((w) => w.avatar).filter(Boolean);

  const fillers = [];
  for (let i = 0; i < fillerCount; i++) fillers.push(makeFiller(rng, i, { ...ctx, day }, rollViolation(rng, day, ctx.rules, ctx.unlocks), avoid));

  return { visitors: shuffle(rng, [...scheduled, ...fillers]), wanted: shuffle(rng, wanted) };
}
