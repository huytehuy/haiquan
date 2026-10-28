// Hỏi vặn nhân vật: gọi /api/interrogate (Groq). Lỗi/không có key => trả lời bằng kịch bản offline.
import { normalize } from './util.js';

const EMOTIONS = ['calm', 'nervous', 'angry', 'pleading'];

export async function checkAIStatus() {
  try {
    const res = await fetch('/api/status', { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { ai: false };
    return await res.json();
  } catch {
    return { ai: false };
  }
}

function docSummary(d) {
  const p = d.passport, e = d.entry_permit, c = d.customs;
  const lines = [
    `Hộ chiếu: ${p.name}, sinh ${p.dob}, số ${p.id_number}, hết hạn ${p.expiry_date}, quê quán ${p.origin}`,
    `Giấy phép nhập cảnh: ${e.name}, sinh ${e.dob}, số ${e.id_number}, mục đích ${e.purpose}, lưu trú ${e.duration_days} ngày`,
    `Tờ khai hải quan: hành lý ${c.items.map((i) => `${i.name} (${i.category})`).join(', ')}; tiền mặt $${c.cash}`,
  ];
  if (d.work_permit) lines.push(`Giấy phép lao động: ${d.work_permit.name}, nơi làm ${d.work_permit.employer}, hạn đến ${d.work_permit.valid_until}`);
  else lines.push('Không có giấy phép lao động');
  return lines.join('\n');
}

export async function interrogate(npc, question, { date, aiOnline }) {
  if (aiOnline) {
    try {
      const res = await fetch('/api/interrogate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          date,
          question,
          npc: {
            name: npc.documents.passport.name,
            personality: npc.ai_persona.personality,
            true_story: npc.ai_persona.true_story,
            alibi: npc.ai_persona.alibi,
            triggers: npc.ai_persona.triggers,
            documents: docSummary(npc.documents),
            // số tiền phong bì duy nhất nhân vật được phép nhắc tới (0 = không hối lộ)
            bribe: npc.bribeState === 'taken' ? 0 : npc.offerAmount ?? npc.bribe ?? 0,
          },
          notes: npc.notes,
          history: npc.convo.map(({ q, a, emotion }) => ({ q, a, e: emotion })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.dialogue) {
          return { dialogue: data.dialogue, emotion: EMOTIONS.includes(data.emotion) ? data.emotion : npc.ai_persona.temper, source: 'ai' };
        }
      }
    } catch {
      /* rơi xuống kịch bản offline */
    }
  }
  return { ...offlineReply(npc, question), source: 'offline' };
}

const INSPECTOR_REACT = {
  ok: ['Ừm.', 'Được.', 'Khớp hồ sơ.'],
  wrong: ['Lạ nhỉ, hồ sơ không ghi thế.', 'Anh/chị chắc chứ? Giấy tờ nói khác đấy.', 'Hửm? Nói lại xem nào.'],
  slip: ['Khoan... anh/chị vừa nói gì?', 'Cái tên đó ở đâu ra vậy?', 'Thú vị đấy. Nói thêm đi.'],
};

/** Màn đổi vai: thanh tra biên phòng (AI) phản ứng với câu trả lời của người chơi rồi hỏi tiếp. */
export async function inspectorReply({ cover, asked, answer, verdict, next, aiOnline }) {
  if (aiOnline) {
    try {
      const res = await fetch('/api/interrogate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ mode: 'inspector', cover, asked, verdict, next, question: answer || '(im lặng)' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.dialogue) return { dialogue: data.dialogue, emotion: EMOTIONS.includes(data.emotion) ? data.emotion : 'calm', source: 'ai' };
      }
    } catch {
      /* rơi xuống kịch bản */
    }
  }
  const react = INSPECTOR_REACT[verdict][Math.floor(Math.random() * 3)];
  return { dialogue: next ? `${react} ${next}` : `${react} Đứng yên đó.`, emotion: verdict === 'ok' ? 'calm' : 'angry', source: 'offline' };
}

// ---------------- Kịch bản offline ----------------

const INTENTS = [
  // đòi / nhắc tới tiền: "cho tôi 500$", "phong bì đâu", "tiền cà phê", "làm luật"...
  ['bribe', /(hoi lo|dut lot|an hoi|tien tra|cho toi \$?\d|\d+ ?(\$|do\b|usd|k\b)|\$ ?\d|dua tien|dua them|phong bi|tien ca phe|tien nuoc|boi duong|lam luat|lot tay|chi tien|chung chi|bao nhieu tien thi)/],
  ['threat', /(bat giu|bat |cong an|di tu|tam giam|noi that|khai that|thanh that|canh cao|doa|lam ro|giau gi|ai sai|truy na|chau ba long)/],
  ['mismatch', /(khong khop|khac nhau|gia mao|giay gia|ngay sinh|nam sinh|so ho chieu|sai ten|ten khac|petrovna|nham)/],
  ['luggage', /(vali|hanh ly|mo ra|kiem tra|hop|tui|do dac|mang theo|ben trong|chua gi|dung gi|thung|loa|my pham|dung moi|vac.?xin|hang)/],
  ['passport', /(ho chieu|het han|gia han)/],
  ['work', /(giay phep lao dong|cong viec|lam nghe|nghe gi|cong ty|lam o dau|chu thau|lam viec)/],
  ['duration', /(bao lau|may ngay|o lai|luu tru|bao gio ve|khi nao ve)/],
  ['purpose', /(muc dich|lam gi|vi sao|tai sao|den day|vao day|ly do)/],
  ['origin', /(tu dau|que|song o|den tu|o dau)/],
  ['cash', /(tien mat|bao nhieu tien|tien)/],
];

/** Số tiền người chơi nêu trong câu: "500$", "$1.200", "300 đô", "2k" → số; không có → null. */
export function parseAmount(q) {
  const m = normalize(q).match(/(\d+(?:[.,]\d{3})*)\s*(k\b)?/);
  if (!m) return null;
  const n = Number(m[1].replace(/[.,]/g, '')) * (m[2] ? 1000 : 1);
  return n >= 10 ? n : null;
}

export function detectIntent(q) {
  const n = ' ' + normalize(q) + ' ';
  for (const [name, re] of INTENTS) if (re.test(n)) return name;
  return 'default';
}

/** Khách có điều gì để giấu không (tội phạm hoặc biết mình vi phạm). */
export const isGuilty = (npc) => !!npc.crime || /hết hạn|chưa xin|làm chui|kiểm dịch|giấy tờ giả/.test(npc.ai_persona.true_story);

export function offlineReply(npc, question) {
  const intent = detectIntent(question);
  const L = npc.lines || {};
  const d = npc.documents;
  const temper = npc.ai_persona.temper || 'calm';
  const guilty = isGuilty(npc);
  const criminal = !!npc.crime;
  const e = d.entry_permit;

  // kỹ năng "Lưỡi sắc": kẻ gian gãy nhanh gấp đôi
  if (intent === 'threat' || intent === 'bribe') npc.pressure = (npc.pressure || 0) + (npc.slippery ? 2 : 1);

  switch (intent) {
    case 'threat':
    case 'bribe': {
      if (intent === 'bribe' && npc.offerAmount) return { dialogue: `Dạ... tôi chỉ xoay được chừng này: $${npc.offerAmount}. Thanh tra cầm lấy, cho tôi qua nhé.`, emotion: 'pleading' };
      if (intent === 'bribe' && npc.solicited) return { dialogue: 'Thanh tra đòi tiền tôi á? Tôi chẳng có gì phải giấu! Tôi sẽ tố cáo anh!', emotion: 'angry' };
      const lines = L.threat;
      if (lines?.length) {
        const i = Math.min((npc.pressure || 1) - 1, lines.length - 1);
        const cracked = i > 0 || (criminal && npc.scanned?.contraband);
        return { dialogue: lines[i], emotion: cracked ? (temper === 'angry' ? 'angry' : 'pleading') : criminal ? 'nervous' : temper };
      }
      if (criminal) {
        return npc.pressure > 1
          ? npc.bribe
            ? { dialogue: `Thanh tra... tôi có ít tiền đây, $${npc.bribe}, coi như chưa thấy gì được không?`, emotion: 'pleading' }
            : { dialogue: 'Xin thanh tra... bỏ qua cho tôi lần này thôi, tôi xin mà.', emotion: 'pleading' }
          : { dialogue: 'T-tôi có làm gì đâu! Thanh tra đừng dọa tôi.', emotion: 'nervous' };
      }
      if (guilty) return { dialogue: 'Tôi biết giấy tờ có chút vấn đề... xin thanh tra châm chước lần này.', emotion: 'pleading' };
      return temper === 'angry'
        ? { dialogue: 'Bắt cái gì? Tôi có làm gì sai đâu mà dọa!', emotion: 'angry' }
        : { dialogue: 'Tôi nói thật hết rồi mà, thanh tra cứ kiểm tra lại.', emotion: temper === 'nervous' ? 'nervous' : 'calm' };
    }
    case 'mismatch':
      if (L.mismatch) return { dialogue: L.mismatch, emotion: criminal ? 'nervous' : temper };
      if (npc.crime === 'FORGERY') return { dialogue: 'Chắc... chắc là bên làm giấy in nhầm thôi. Mấy cái lỗi vặt đó mà.', emotion: 'nervous' };
      return { dialogue: 'Giấy tờ của tôi chuẩn hết mà, thanh tra xem kỹ lại đi.', emotion: temper === 'angry' ? 'angry' : 'calm' };
    case 'luggage':
      if (L.luggage) return { dialogue: L.luggage, emotion: npc.crime === 'CONTRABAND' ? 'nervous' : temper };
      if (npc.crime === 'CONTRABAND') return { dialogue: 'Đồ cá nhân thôi mà! Không... không cần mở đâu.', emotion: 'nervous' };
      return { dialogue: `Có ${d.customs.items.map((i) => i.name.toLowerCase()).join(', ')} thôi. Thanh tra cứ mở ra xem.`, emotion: 'calm' };
    case 'passport':
      if (d.passport.expiry_date <= (npc._date || '')) return { dialogue: 'Hộ chiếu... mới hết hạn có mấy hôm thôi. Xin thanh tra thông cảm.', emotion: temper === 'angry' ? 'angry' : 'pleading' };
      return { dialogue: `Hộ chiếu của tôi còn hạn tới ${d.passport.expiry_date} mà.`, emotion: 'calm' };
    case 'work':
      if (d.work_permit) return { dialogue: `Tôi làm cho ${d.work_permit.employer}, giấy phép lao động đây.`, emotion: criminal ? 'nervous' : 'calm' };
      if (['Công tác', 'Lao động'].includes(e.purpose)) return { dialogue: 'Giấy phép lao động thì... tôi chưa có. Chủ hứa lo sau ạ.', emotion: 'pleading' };
      return { dialogue: `Tôi vào ${e.purpose.toLowerCase()} thôi, không đi làm.`, emotion: 'calm' };
    case 'duration':
      return { dialogue: `${e.duration_days} ngày thôi${e.duration_days > 14 ? ', có việc phải ở lâu chút' : ''}.`, emotion: criminal ? 'nervous' : 'calm' };
    case 'purpose':
      return { dialogue: `${npc.ai_persona.alibi}.`, emotion: criminal ? (temper === 'calm' ? 'calm' : 'nervous') : temper === 'pleading' ? 'pleading' : 'calm' };
    case 'origin':
      return { dialogue: `Tôi từ ${d.passport.origin}.`, emotion: 'calm' };
    case 'cash':
      return { dialogue: `Tôi mang $${d.customs.cash} tiền mặt, đã khai đầy đủ.`, emotion: 'calm' };
    default:
      return criminal
        ? { dialogue: `Ờ... ${npc.ai_persona.alibi.toLowerCase()}. Vậy thôi.`, emotion: temper === 'calm' ? 'calm' : 'nervous' }
        : { dialogue: `${npc.ai_persona.alibi}. Thanh tra cần hỏi gì nữa không?`, emotion: temper === 'pleading' ? 'pleading' : 'calm' };
  }
}
