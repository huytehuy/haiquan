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
      return { name, text, avatar: npc.avatar, decision: h.decision, chapter: npc.chapter || 1 };
    })
    .filter(Boolean);
}

const ENDINGS = {
  corrupt: {
    title: 'KẺ ĂN TIỀN',
    epilogue: 'Bạn mua một căn hộ mới ở Quận 1 bằng những phong bì dày cộp. Một tháng sau, thanh tra nội bộ gõ cửa lúc 5 giờ sáng. Bé Na đứng nhìn bạn bị còng tay đưa đi.',
    rank: 'Thanh tra tham nhũng',
  },
  chaos: {
    title: 'THÀNH PHỐ HỖN LOẠN',
    epilogue: 'Thuốc lậu, vũ khí và tội phạm truy nã tràn qua quầy 7. Neo-Saigon chìm trong bạo lực. Bộ An ninh lặng lẽ điều bạn đi trực kho hàng ở ngoại ô.',
    rank: 'Cánh cửa mở toang',
  },
  iron: {
    title: 'BÀN TAY SẮT',
    epilogue: 'Không ai lọt qua quầy 7 — kể cả người vô tội. Báo chí gọi bạn là "Đao phủ cửa khẩu". Bạn được thăng chức, nhưng hàng xóm không còn chào bạn nữa.',
    rank: 'Đao phủ cửa khẩu',
  },
  lonely: {
    title: 'CÁI GIÁ CỦA BỔN PHẬN',
    epilogue: 'Bạn hoàn thành nhiệm kỳ, nhưng căn nhà giờ vắng thêm một tiếng cười. Huy chương treo trên tường cũng không lấp được khoảng trống ấy.',
    rank: 'Thanh tra cô độc',
  },
  hero: {
    title: 'NGƯỜI HÙNG CỬA KHẨU',
    epilogue: 'Bạn chặn đứng những đường dây buôn lậu lớn nhất và không nhận một xu bẩn nào. Bộ An ninh trao Huân chương Thanh tra Thép. Bé Na kể với cả lớp rằng ba mẹ mình là siêu anh hùng.',
    rank: 'Huân chương Thanh tra Thép',
  },
  ordinary: {
    title: 'MỘT THANH TRA BÌNH THƯỜNG',
    epilogue: 'Không anh hùng, không tai tiếng. Bạn làm tròn ca trực, mang tiền về nuôi gia đình. Ở Neo-Saigon, chừng đó đã là một chiến thắng.',
    rank: 'Thanh tra đạt chuẩn',
  },
};

// Kết thúc chương 2 — xoay quanh số phận trùm Hắc Long
const BOSS_ENDINGS = {
  dragonslayer: {
    title: 'NGƯỜI HẠ BỆ HẮC LONG',
    epilogue: 'Từ những manh mối ghim trên bảng, bạn nhận ra kẻ mỉm cười sau tấm hộ chiếu Tân Dubai. Đường dây Hắc Long sụp đổ chỉ sau một đêm. Bạn được mời phát biểu trước toàn ngành — nhưng bạn chỉ muốn về nhà ăn tối với gia đình.',
    rank: 'Huân chương Rồng Đen',
  },
  double: {
    title: 'KẺ HAI MẶT',
    epilogue: 'Bạn còng tay Hắc Long ngay tại quầy 7. Ba ngày sau, trước tòa, hắn mỉm cười và đọc to danh sách những phong bì bạn từng nhận. Hai người ngồi hai phòng giam đối diện nhau.',
    rank: 'Người hùng nhuốm bẩn',
  },
  puppet: {
    title: 'TAY SAI CỦA HẮC LONG',
    epilogue: 'Phong bì $1000 nằm gọn trong túi áo. Từ hôm đó, mỗi sáng trên bàn bạn lại có một tấm ảnh và một cái tên. Bạn đã trở thành một phần của con rồng.',
    rank: 'Người gác cổng của Hắc Long',
  },
  dragonfree: {
    title: 'CON RỒNG VẪN NGỦ YÊN',
    epilogue: 'Hắc Long đã đi ngang qua quầy 7 — và bạn để hắn đi. Có thể bạn không đủ manh mối, có thể bạn đã nhìn nhầm người. Ở đâu đó trong Neo-Saigon, con rồng vẫn đang chờ.',
    rank: 'Thanh tra lỡ hẹn',
  },
};

/** Chọn kết thúc khi hoàn thành một chương, dựa trên cách bạn đã làm việc. */
export function chooseEnding(g) {
  const st = g.stats;
  const lost = g.family.filter((m) => !m.alive).length;
  const dirty = g.bribes + (g.flags?.colleague?.choice === 'join' ? 1 : 0) + (g.flags?.stranger?.choice === 'take' ? 1 : 0);
  if (g.chapter === 2) {
    const boss = g.decisions?.npc_390?.decision;
    let key = 'dragonfree';
    if (boss === 'ARREST') key = dirty >= 3 ? 'double' : 'dragonslayer';
    else if (boss === 'ALLOW' && g.flags?.bossBribe) key = 'puppet';
    return { key, ...BOSS_ENDINGS[key] };
  }
  let key = 'ordinary';
  if (dirty >= 3) key = 'corrupt';
  else if (st.escaped >= 5) key = 'chaos';
  else if (st.wrongArrest >= 3) key = 'iron';
  else if (lost > 0) key = 'lonely';
  else if (st.caught >= 8 && dirty === 0 && st.escaped <= 1) key = 'hero';
  return { key, ...ENDINGS[key] };
}

/** Hậu ký: những lựa chọn ban đêm theo bạn đến cuối nhiệm kỳ. */
export function epilogueNotes(g) {
  const f = g.flags || {};
  const notes = [];
  if (f.tuition?.choice === 'pay') notes.push('🎒 Bé Na được tiếp tục đi học, cuối năm đạt học sinh giỏi.');
  if (f.tuition?.choice === 'skip') notes.push('🎒 Bé Na phải nghỉ học giữa chừng, theo bà ra chợ bán rau.');
  if (f.colleague?.choice === 'join') notes.push('🤝 Một tháng sau, quầy 6 bị bắt và khai ra tên bạn.');
  if (f.colleague?.choice === 'report') notes.push('🤝 Vụ tố cáo quầy 6 mở ra cuộc thanh lọc toàn trạm kiểm soát.');
  if (f.stranger?.choice === 'take') notes.push('📷 Tấm ảnh người lạ vẫn nằm trong ngăn kéo. Bạn không dám vứt nó đi.');
  if (f.stranger?.choice === 'report') notes.push('📷 Nhờ tin báo của bạn, đường dây bắt cóc "Bóng Ma" bị triệt phá.');
  if (f.neighbor?.choice === 'report') notes.push('📦 Sổ ghi nợ trong chiếc hộp giúp Bộ An ninh lần ra băng "Rắn".');
  if (f.temple?.choice === 'go') notes.push('🙏 Mẹ vẫn giữ thói quen lên chùa mỗi rằm, cầu bình an cho cả nhà.');
  if (g.warmHome) notes.push('🏠 Căn nhà mới nhỏ mà ấm, cả nhà quen dần với khu phố lạ.');
  if (g.rank >= 3) notes.push('🎖 Bạn được bổ nhiệm làm Thanh tra trưởng trạm kiểm soát.');
  if (g.chapter === 2) {
    const lost = g.family.filter((m) => !m.alive).length;
    notes.push(lost ? `🕯️ Bàn thờ trong nhà có thêm ${lost} di ảnh.` : '👨‍👩‍👧 Cả nhà vẫn quây quần đủ mặt trong bữa cơm tối.');
    notes.push(`🧩 Bạn đã ghép được ${g.clues || 0}/3 manh mối về Hắc Long.`);
  }
  return notes;
}
