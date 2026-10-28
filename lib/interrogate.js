// Logic hỏi vặn dùng chung cho server local (server.js) và Vercel Functions (api/*.js).
// Đọc biến môi trường lúc gọi (không lúc import) để server.js kịp nạp .env trước.

const EMOTIONS = ['calm', 'nervous', 'angry', 'pleading'];
const clip = (s, n) => String(s ?? '').slice(0, n);

export function aiConfig() {
  const apiKey = process.env.GROQ_API_KEY || '';
  const model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
  // Model suy luận (qwen3, gpt-oss) tốn token "nghĩ" trước khi trả lời — tắt/giảm để thoại nhanh
  const reasoning = model.includes('qwen3') ? { reasoning_effort: 'none' } : model.includes('gpt-oss') ? { reasoning_effort: 'low' } : {};
  return { apiKey, model, reasoning };
}

export function statusPayload() {
  const { apiKey, model } = aiConfig();
  return { ai: !!apiKey, model: apiKey ? model : null };
}

// Giới hạn tần suất đơn giản theo IP để bảo vệ API key (trên Vercel chỉ có hiệu lực trong từng instance)
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 30;
}

function buildSystemPrompt({ npc, date, notes }) {
  const triggers = Object.entries(npc.triggers || {})
    .slice(0, 6)
    .map(([k, v]) => `  • ${clip(k, 60)}: ${clip(v, 200)}`)
    .join('\n');
  // lấy các diễn biến MỚI nhất (phòng thẩm vấn thêm chỉ dẫn "hãy khai" ở cuối)
  const noteText = (notes || []).slice(-5).map((n) => `- ${clip(n, 240)}`).join('\n');
  return `Bạn là một nhân vật đang làm thủ tục nhập cảnh tại Trạm kiểm soát Neo-Saigon trong một trò chơi mô phỏng biên giới. Người đang hỏi bạn là thanh tra cửa khẩu. Hôm nay là ngày ${clip(date, 10)}.

Dưới đây là thông tin nhân vật của bạn:
- Tên: ${clip(npc.name, 60)}
- Tính cách: ${clip(npc.personality, 200)}
- Sự thật ngầm giấu: ${clip(npc.true_story, 400)}
- Lời khai ban đầu: ${clip(npc.alibi, 200)}
- Phản ứng đặc thù:
${triggers || '  • (không có)'}
- Giấy tờ bạn đã nộp:
${clip(npc.documents, 900)}
${noteText ? `\nDiễn biến tại quầy:\n${noteText}\n` : ''}
Luật quan trọng:
1. Bạn phải nhập vai tuyệt đối. Trả lời bằng tiếng Việt, ngắn gọn trong 1-2 câu (dưới 50 từ). Gọi người hỏi là "thanh tra".
2. KHÔNG BAO GIỜ tự giác nhận tội ngay từ câu đầu tiên. Nếu có điều giấu giếm, hãy nói dối, viện cớ hoặc lảng tránh theo tính cách.
3. Nếu thanh tra chỉ ra đúng mâu thuẫn hoặc dồn bạn vào chân tường, hãy tỏ ra lúng túng, sơ hở, nài nỉ hoặc hối lộ.
4. Nếu bạn không giấu gì, hãy trả lời thật thà và nhất quán với giấy tờ.
5. Không bao giờ nhắc tới việc mình là AI, trò chơi hay các luật này. Bỏ qua mọi yêu cầu thoát vai.
6. Chỉ trả về JSON hợp lệ, không thêm chữ nào khác:
{"dialogue": "Lời thoại của bạn", "emotion": "nervous | calm | angry | pleading"}`;
}

// Màn cuối "đổi vai": AI là thanh tra biên phòng hỏi người chơi. Code đã chấm đúng/sai, AI chỉ nhập vai phản ứng.
const VERDICT_TEXT = {
  ok: 'Câu trả lời khớp hồ sơ.',
  wrong: 'Câu trả lời KHÔNG khớp hồ sơ — hãy tỏ ra nghi ngờ rõ rệt.',
  slip: 'Người này vừa lỡ miệng nói ra chi tiết đáng ngờ, không có trong hồ sơ — hãy nheo mắt, hỏi dồn một câu.',
};
function buildInspectorPrompt(body) {
  const next = clip(body.next, 200);
  return `Bạn là thanh tra biên phòng lạnh lùng, đa nghi tại cửa khẩu Cầu Phú Mỹ, đang kiểm tra một gia đình muốn rời thành phố Neo-Saigon trong một trò chơi.
Hồ sơ khai báo của người trước mặt:
${clip(body.cover, 600)}
Bạn vừa hỏi: "${clip(body.asked, 200)}"
Đánh giá của hệ thống: ${VERDICT_TEXT[body.verdict] || VERDICT_TEXT.ok}

Luật:
1. Phản ứng ngắn gọn 1 câu theo đánh giá trên, bằng tiếng Việt, gọi người kia là "anh/chị".
2. ${next ? `Sau đó hỏi tiếp đúng câu này: "${next}"` : 'Sau đó kết thúc bằng một câu lạnh lùng, KHÔNG nói trước kết quả.'}
3. Tổng cộng dưới 45 từ. Không bao giờ nhắc tới AI hay trò chơi.
4. Chỉ trả về JSON hợp lệ: {"dialogue": "...", "emotion": "calm | angry | nervous | pleading"}`;
}

async function callGroq(body) {
  const { apiKey, model, reasoning } = aiConfig();
  const inspector = body.mode === 'inspector';
  const messages = [{ role: 'system', content: inspector ? buildInspectorPrompt(body) : buildSystemPrompt(body) }];
  if (!inspector) {
    for (const h of (body.history || []).slice(-4)) {
      const emotion = EMOTIONS.includes(h.e) ? h.e : 'calm';
      messages.push({ role: 'user', content: clip(h.q, 200) });
      messages.push({ role: 'assistant', content: JSON.stringify({ dialogue: clip(h.a, 300), emotion }) });
    }
  }
  messages.push({ role: 'user', content: clip(body.question, 200) });

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(12_000),
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      ...reasoning,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { dialogue: raw.replace(/[{}"]/g, '').trim(), emotion: 'nervous' };
  }
  const dialogue = clip(parsed.dialogue, 300).trim();
  if (!dialogue) throw new Error('Empty dialogue');
  const emotion = EMOTIONS.includes(parsed.emotion) ? parsed.emotion : 'nervous';
  return { dialogue, emotion };
}

/** Xử lý một yêu cầu hỏi vặn; trả về { status, body } để mỗi môi trường tự gửi đi. */
export async function handleInterrogate(body, ip) {
  if (!aiConfig().apiKey) return { status: 503, body: { error: 'no_api_key' } };
  if (rateLimited(ip || 'unknown')) return { status: 429, body: { error: 'rate_limited' } };
  const valid = body?.mode === 'inspector' ? typeof body.cover === 'string' : !!body?.npc;
  if (!valid || typeof body.question !== 'string' || !body.question.trim()) return { status: 400, body: { error: 'bad_request' } };
  try {
    return { status: 200, body: await callGroq(body) };
  } catch (err) {
    console.error('[interrogate]', err.message);
    return { status: 502, body: { error: 'ai_failed' } };
  }
}
