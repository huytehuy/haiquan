// Máy phát hiện nói dối, số phận nhân vật và các kết thúc.
import { detectIntent, isGuilty } from './ai.js';

// ---------------- Máy phát hiện nói dối ----------------

// Chủ đề "nhạy cảm" với từng loại bí mật — hỏi trúng thì nhịp tim vọt lên
const SENSITIVE = {
  CONTRABAND: ['luggage', 'threat', 'bribe', 'cash'],
  FORGERY: ['mismatch', 'threat', 'passport', 'origin', 'default', 'work'],
  WANTED: ['threat', 'mismatch', 'origin', 'purpose', 'default'],
  VIOLATION: ['passport', 'work', 'duration', 'cash', 'threat', 'origin'],
};
const BASE = { calm: 32, nervous: 58, angry: 50, pleading: 48 };

/**
 * Mức căng thẳng 0–100 sau mỗi câu trả lời. Người vô tội nhưng hay lo (Yến, Tuấn) vẫn có nền cao —
 * máy chỉ là gợi ý, không phải đáp án.
 */
export function measureStress(npc, question) {
  const intent = detectIntent(question);
  const secret = npc.crime || (isGuilty(npc) ? 'VIOLATION' : null);
  let s = BASE[npc.ai_persona.temper] ?? 40;
  if (secret) {
    s += 8;
    if (SENSITIVE[secret].includes(intent)) s += secret === 'VIOLATION' ? 22 : 44;
  }
  if (npc.scanned?.contraband) s += 12;
  if (intent === 'threat') s += 6;
  s += Math.round((Math.random() - 0.5) * 12);
  s = Math.max(8, Math.min(100, s));
  return { stress: s, bpm: Math.round(62 + s * 0.85), label: s >= 78 ? 'DAO ĐỘNG MẠNH' : s >= 55 ? 'Hơi căng' : 'Ổn định' };
}

/** Đồ thị nhịp tim kiểu máy đo — biên độ theo mức căng thẳng. */
export function polygraphSvg(stress) {
  const amp = 2 + (stress / 100) * 13;
  const pts = [];
  for (let x = 0; x <= 120; x += 3) {
    const spike = x % 30 === 15 ? amp * 1.6 : 0;
    const y = 18 - Math.sin(x / 2.2) * amp * (0.4 + Math.random() * 0.6) - spike;
    pts.push(`${x},${y.toFixed(1)}`);
  }
  const color = stress >= 78 ? '#ff4d4d' : stress >= 55 ? '#f2b84b' : '#7ee787';
  return `<svg viewBox="0 0 120 36" preserveAspectRatio="none"><polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.6"/></svg>`;
}

// ---------------- Số phận & kết thúc ----------------

/** Danh sách số phận các nhân vật có tên mà người chơi đã gặp. */
export function fates(g, npcsById) {
  return Object.entries(g.decisions || {})
    .map(([id, h]) => {
      const npc = npcsById[id];
      if (!npc) return null;
      const name = npc.documents.passport.name;
      const text = npc.news?.[h.decision] || { ALLOW: 'Đã vào thành phố.', DENY: 'Bị trả về.', ARREST: 'Bị bắt giữ.' }[h.decision];
      return { name, text, avatar: npc.avatar, decision: h.decision };
    })
    .filter(Boolean);
}

/** Mức "dính bẩn": phong bì + bắt tay quầy 6 + nhận tiền người lạ + nghe lệnh Trưởng trạm. */
export const dirtyScore = (g) =>
  g.bribes + ['colleague:join', 'stranger:take', 'directive:obey'].filter((k) => {
    const [ev, ch] = k.split(':');
    return g.flags?.[ev]?.choice === ch;
  }).length;

const ENDINGS = {
  dragonslayer: {
    title: 'NGƯỜI HẠ BỆ HẮC LONG',
    epilogue: 'Từ những manh mối ghim trên bảng, bạn nhận ra kẻ mỉm cười sau tấm hộ chiếu Tân Dubai. Đường dây Hắc Long sụp đổ chỉ sau một đêm. Cả nhà bạn được đưa đi theo chương trình bảo vệ nhân chứng — bé Na ngủ ngon lành trên vai bạn suốt chuyến xe đêm.',
    rank: 'Huân chương Rồng Đen',
  },
  pyrrhic: {
    title: 'CÁI GIÁ CỦA CÔNG LÝ',
    epilogue: 'Bạn còng tay Hắc Long ngay tại quầy 7 — dù hắn thì thầm tên con gái bạn. Ba ngày sau, cảnh sát mới tìm thấy bé Na trong một container ở cảng. Con bé an toàn, nhưng từ đó không ngủ được nếu tắt đèn.',
    rank: 'Người hùng mất ngủ',
  },
  double: {
    title: 'KẺ HAI MẶT',
    epilogue: 'Bạn bắt được Hắc Long. Ba ngày sau, trước tòa, hắn mỉm cười đọc to danh sách những phong bì bạn từng nhận và cái gật đầu của bạn với Trưởng trạm Quyền. Hai người ngồi hai phòng giam đối diện nhau.',
    rank: 'Người hùng nhuốm bẩn',
  },
  parent: {
    title: 'BẠN CHỌN CON',
    epilogue: 'Bạn đóng dấu CHO QUA lên hộ chiếu của kẻ đã bắt cóc con mình. Tối đó bé Na về nhà, ôm chặt lấy bạn. Hắc Long vẫn tự do — nhưng bạn biết, nếu được chọn lại, bạn vẫn sẽ làm thế.',
    rank: 'Cha mẹ trước, thanh tra sau',
  },
  puppet: {
    title: 'TAY SAI CỦA HẮC LONG',
    epilogue: 'Phong bì của Trưởng trạm, phong bì của trùm — bạn đã nhận đủ. Từ hôm đó, mỗi sáng trên bàn bạn lại có một tấm ảnh và một cái tên. Bạn đã trở thành một phần của con rồng.',
    rank: 'Người gác cổng của Hắc Long',
  },
  dragonfree: {
    title: 'CON RỒNG VẪN NGỦ YÊN',
    epilogue: 'Hắc Long đã đi ngang qua quầy 7 — và bạn để hắn đi. Có thể bạn không đủ manh mối, có thể bạn đã nhìn nhầm người. Ở đâu đó trong Neo-Saigon, con rồng vẫn đang chờ.',
    rank: 'Thanh tra lỡ hẹn',
  },
  caught: {
    title: 'GỤC NGÃ Ở VẠCH CUỐI',
    epilogue: 'Bảy ngày bạn soi giấy tờ của người khác — và chỉ một câu trả lời lỡ miệng ở cửa khẩu Cầu Phú Mỹ là đủ để giấy tờ của chính bạn bị lật tẩy. Viên thanh tra kia đóng dấu BẮT GIỮ, không chớp mắt. Bạn hiểu cảm giác của những người từng đứng trước quầy 7.',
    rank: 'Kẻ đào tẩu bất thành',
  },
};

/** Chọn kết thúc sau 7 ngày + cuộc vượt biên cuối cùng. */
export function chooseEnding(g) {
  const boss = g.decisions?.npc_390?.decision;
  const dirty = dirtyScore(g);
  let key = 'dragonfree';
  if (g.border === 'caught') key = 'caught';
  else if (boss === 'ARREST') key = dirty >= 3 ? 'double' : g.naState === 'late' ? 'pyrrhic' : 'dragonslayer';
  else if (boss === 'ALLOW') key = g.flags?.bossBribe || dirty >= 3 ? 'puppet' : g.flags?.choseChild ? 'parent' : 'dragonfree';
  return { key, ...ENDINGS[key] };
}

/** Hậu ký: những lựa chọn trong tuần theo bạn đến cuối. */
export function epilogueNotes(g) {
  const f = g.flags || {};
  const notes = [];
  if (f.directive?.choice === 'defy') notes.push('✉️ Phong bì chỉ thị bạn giữ lại trở thành bằng chứng: Trưởng trạm Quyền bị khởi tố.');
  if (f.directive?.choice === 'obey') notes.push('✉️ Trưởng trạm Quyền vẫn ngồi ghế của mình, và vẫn gửi phong bì cho người ngồi quầy 7 mới.');
  if (g.naState === 'rescued') notes.push('🧣 Đội đặc nhiệm ập vào kho số 9 cảng Khánh Hội theo lời khai bạn moi được — bé Na được cứu ngay trong đêm.');
  if (g.naState === 'returned') notes.push('🧣 Bé Na được thả về, nhưng giờ Hắc Long biết rõ cái giá để bạn nghe lời.');
  if (f.tuition?.choice === 'pay') notes.push('🎒 Bé Na được tiếp tục đi học ở trường mới.');
  if (f.tuition?.choice === 'skip') notes.push('🎒 Bé Na phải nghỉ học giữa chừng.');
  if (f.colleague?.choice === 'join') notes.push('🤝 Một tháng sau, quầy 6 bị bắt và khai ra tên bạn.');
  if (f.colleague?.choice === 'report') notes.push('🤝 Vụ tố cáo quầy 6 mở ra cuộc thanh lọc toàn trạm kiểm soát.');
  if (f.stranger?.choice === 'report') notes.push('📷 Nhờ tin báo của bạn, đường dây bắt cóc "Bóng Ma" bị triệt phá.');
  if (f.temple?.choice === 'go') notes.push('🙏 Mẹ vẫn giữ thói quen thắp nhang mỗi tối, cầu bình an cho cả nhà.');
  if (g.border === 'passed') notes.push('🛂 Ở cửa khẩu Cầu Phú Mỹ, bạn trả lời trôi chảy với danh tính mới — cánh cổng mở ra.');
  const lost = g.family.filter((m) => !m.alive).length;
  notes.push(lost ? `🕯️ Hành lý của cả nhà có thêm ${lost} di ảnh.` : '👨‍👩‍👧 Cả nhà vẫn đủ mặt trên chuyến xe rời thành phố.');
  notes.push(`🧩 Bạn đã ghép được ${g.clues || 0}/3 manh mối về Hắc Long.`);
  return notes;
}
