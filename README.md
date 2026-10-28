# 🛂 Trạm Kiểm Soát Neo-Saigon

Game mô phỏng thanh tra cửa khẩu (kiểu *Papers, Please*) chạy trên Web/Mobile. Soi chéo giấy tờ, hỏi vặn nhân vật AI (Groq · Qwen3.8 27B), soi X-quang hành lý, tra vân tay, rồi đóng dấu **CHO QUA / TỪ CHỐI / BẮT GIỮ**. Mọi quyết định đều có hậu quả.

## Chạy local

Yêu cầu: Node.js 18+ (không cần `npm install`, không có dependency).

```bash
cp .env.example .env    # rồi điền GROQ_API_KEY (lấy miễn phí ở https://console.groq.com/keys)
npm start
```

Mở http://localhost:3000 (trên điện thoại cùng mạng Wi-Fi: `http://<IP-máy-tính>:3000`).

> Không có `GROQ_API_KEY` thì game vẫn chơi được ở **chế độ kịch bản offline**: nhân vật trả lời bằng câu thoại viết sẵn, khớp theo từ khóa câu hỏi. Nếu Groq lỗi/timeout giữa chừng, game cũng tự rơi về kịch bản.

## Deploy lên Vercel

1. Import repo này vào Vercel (Framework Preset: **Other**, không cần Build Command).
2. Vào **Settings → Environment Variables**, thêm:
   - `GROQ_API_KEY` = key Groq của bạn
   - `GROQ_MODEL` = `qwen/qwen3.8-27b` (tùy chọn)
3. Deploy. File tĩnh phục vụ từ `public/`, API chạy bằng Vercel Functions trong `api/` (cấu hình ở `vercel.json`).

> Key chỉ nằm trên server (Vercel Functions), không bao giờ gửi xuống trình duyệt. File `.env` đã được `.gitignore`.

## Luật chơi — 7 ngày, ~40 phút, có kết thúc hẳn

| Ngày | Điều mới |
|---|---|
| 1 | Chỉ có Hộ chiếu + Giấy phép nhập cảnh — làm quen |
| 2 | Mở Tờ khai hải quan, Giấy phép lao động, quy tắc của ngày |
| 3 | Mở máy soi X-quang 🩻 và **Phòng thẩm vấn** 🔦 |
| 4 | Mở máy tra vân tay 🖐 (một ngày đặc biệt ngẫu nhiên có thể rơi vào ngày 2–4) |
| 5 | **Chỉ thị mật**: Trưởng trạm ra lệnh cho một người qua. Nghe lời có $600, cãi lệnh bị trừ tiền + 1 cảnh cáo nhưng giữ được bằng chứng |
| 6 | **Bé Na bị bắt cóc**: cho gã khăn đỏ qua thì con về — hoặc bắt hắn và moi ra nơi giam con bé trong Phòng thẩm vấn |
| 7 | **Hắc Long** qua quầy dưới danh tính giả. Đêm đó cả nhà rời thành phố: **đổi vai** — AI là thanh tra biên phòng hỏi vặn *bạn* về danh tính mới |

- Mỗi ngày 4–6 khách, hơn một nửa là nhân vật có câu chuyện (mỗi ván một dàn khác, một số nhân vật vắng mặt).
- Hợp lệ → Cho qua · Vi phạm quy tắc → Từ chối · Giấy tờ giả / buôn lậu / truy nã → Bắt giữ. Đúng được lương theo cấp bậc, sai −$30 và 1 cảnh cáo.
- **Phòng thẩm vấn**: sau khi bắt người của đường dây, hỏi 3 câu. Hỏi trúng điều hắn giấu thì hắn dao động; hỏi dồn lần nữa hoặc dọa thẳng thì hắn khai. Lời khai cho manh mối nhận diện Hắc Long (3 manh mối) hoặc nơi giam bé Na.
- **Vượt cửa khẩu (đổi vai)**: học thuộc danh tính mới, rồi trả lời 3 câu của thanh tra biên phòng. Sai 2 câu, hoặc lỡ miệng gọi con là "Na", nhắc nghề thanh tra hay Hắc Long → bị giữ lại.
- **Hối lộ**: phong bì $250–2500 (gấp 4–6 lần lương một lượt). Mỗi phong bì 30% bị thanh tra nội bộ tịch thu + 1 cảnh cáo; nhận rồi mà không cho qua thì bị chính người đưa tiền tố cáo (chắc chắn bị phát hiện).
- **Cửa hàng**: đồ xịn đắt — máy phát hiện nói dối $400, máy đối chiếu $450 (≈4 đêm để dành); máy soi / vân tay / sổ thẩm vấn / cà phê $140–160; luật sư $250.
- Vẫn giữ: thanh tra nội bộ, gia đình & chi tiêu, cửa hàng nâng cấp, cấp bậc & kỹ năng, sự kiện ban đêm (đêm 1–4), khách quen, báo sáng.
- **7 kết thúc**: Người hạ bệ Hắc Long · Cái giá của công lý · Kẻ hai mặt · Bạn chọn con · Tay sai của Hắc Long · Con rồng vẫn ngủ yên · Gục ngã ở vạch cuối — kèm hậu ký và số phận từng nhân vật.
- Game Over sớm khi: quá 3 cảnh cáo, không đủ tiền nhà, hoặc mất cả gia đình.

## Cấu trúc

```
server.js              Server local: file tĩnh + API (dùng lib/interrogate.js)
api/                   Vercel Functions: status.js, interrogate.js (dùng lib/interrogate.js)
lib/interrogate.js     Dựng system prompt (nhập vai khách / thanh tra biên phòng), gọi Groq, giới hạn tần suất — dùng chung local & Vercel
vercel.json            outputDirectory = public
public/
  index.html           Màn hình: tiêu đề, báo sáng + công văn, quầy kiểm soát, ban đêm, vượt cửa khẩu, kết thúc
  css/style.css        Giao diện mobile-first (3 khối dọc: camera · mặt bàn · bảng điều khiển)
  data/npcs.json       34 nhân vật viết tay: 20 xoay vòng ngày 1–6, khách quen, VIP ngày 5, kẻ bắt cóc ngày 6, trùm & 2 nghi phạm ngày 7
  js/main.js           Vòng lặp game, UI, đóng dấu, ban đêm, kết thúc
  js/rules.js          Mở khóa theo ngày, quy tắc, checkRules(), evaluateDecision() — chấm điểm bằng code, không dùng AI
  js/economy.js        Ca trực, gia đình & chi tiêu, cửa hàng, thanh tra nội bộ, tít báo sáng
  js/story.js          Máy phát hiện nói dối, số phận nhân vật, chọn kết thúc, hậu ký
  js/nights.js         Cấp bậc & kỹ năng, ngày đặc biệt, ngày cốt truyện 5–7, sự kiện ban đêm
  js/twists.js         Phòng thẩm vấn (bí mật & áp lực) và màn vượt cửa khẩu (danh tính mới, chấm câu trả lời)
  js/generator.js      Sinh khách ngẫu nhiên + khách quen + lệnh truy nã
  js/ai.js             Gọi API hỏi vặn + bộ trả lời offline theo từ khóa
  js/avatar.js         Avatar pixel-art SVG 32×32, đổi biểu cảm theo emotion
  js/docs.js           Render giấy tờ, công văn, kết quả X-quang, vân tay
  js/audio.js          Âm thanh tổng hợp WebAudio
```

## Thêm nhân vật

Thêm một object vào `public/data/npcs.json` theo mẫu có sẵn. Các trường chính:

- `requires` / `excludes`: `[{ "npc": "npc_001", "decisions": ["ARREST"] }]` — chỉ xuất hiện khi các quyết định trước đó khớp / không khớp. `fixedDay`: ép đúng ngày. `network: true`: bắt được người này thì Phòng thẩm vấn có thể moi ra manh mối Hắc Long; `holdsNa: true`: người này biết nơi giam bé Na.
- `minDay`: ngày sớm nhất được xuất hiện (1–6) — đặt theo công cụ cần để phát hiện (buôn lậu ≥ 3 vì cần máy soi). Mỗi ván game tự xếp ngẫu nhiên nhân vật vào các ngày ≥ `minDay`. **Hoặc** `follow`: `{ "after": "npc_001", "decisions": ["ALLOW"], "delay": 2 }` — chỉ xuất hiện `delay` ngày sau khi người chơi chọn một trong `decisions` với nhân vật `after`.
- `crime`: `null` | `"CONTRABAND"` | `"FORGERY"` | `"WANTED"` (kèm `wanted` để hiện trên lệnh truy nã).
- `documents`: `passport`, `entry_permit`, `customs`, tùy chọn `work_permit`. Giấy tờ giả = cố ý cho lệch họ tên/số HC/ngày sinh so với hộ chiếu.
- `scan`: kết quả soi X-quang; món nào `"contraband": true` là hàng lậu.
- `fingerprint` (tùy chọn): `{ "name": "tên thật", "record": "hồ sơ" }` — mặc định là tên trên hộ chiếu + "Không tiền án".
- `bribe` (tùy chọn): số tiền phong bì nhân vật dúi khi bị dồn.
- `news` (tùy chọn): tít báo sáng hôm sau và số phận ở màn kết, dạng `{ "ALLOW": "...", "DENY": "...", "ARREST": "..." }`.
- `ai_persona`: `personality`, `temper`, `true_story`, `alibi`, `triggers` — dùng để dựng system prompt cho Groq.
- `lines`: câu thoại offline (`greeting`, `luggage`, `threat[]`, `mismatch`, `scanned`).

Đáp án đúng luôn được tính bằng `checkRules()` từ giấy tờ + `crime`, nên AI có nói gì thì kết quả chấm điểm vẫn nhất quán.
