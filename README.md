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

## Luật chơi

- 5 ngày, **mỗi ván xáo trộn khác nhau**: nhân vật xuất hiện ngày nào, quy tắc mỗi ngày, khách ngẫu nhiên đều đổi theo ván. Mỗi sáng: **báo Neo-Saigon** (hậu quả quyết định hôm qua + lý do quy tắc mới + tin nhà) và **công văn** gồm 2–3 quy tắc + lệnh truy nã.
- **Ca trực 08:00–17:00 chạy theo giờ thật** (~6 phút, dừng khi chờ AI trả lời). Hàng chờ 6–9 khách — hết giờ thì khách còn lại phải về.
- Mỗi khách: tối đa **2 câu hỏi** tự do; máy soi X-quang **2 lượt/ngày**; tra vân tay **1 lượt/ngày** (lộ tên thật + tiền án).
- Hợp lệ → Cho qua · Vi phạm hành chính → Từ chối · Giấy tờ giả / buôn lậu / truy nã → Bắt giữ.
- Đúng **+$50** (bắt giữ đúng +$20, từ quyết định đúng thứ 3 liên tiếp +$10 🔥) · Sai **−$30** và 1 cảnh cáo.
- **Hối lộ**: kẻ gian bị dọa hoặc bị lộ có thể dúi phong bì. Nhận thì có tiền, nhưng mỗi phong bì có 30% bị thanh tra nội bộ phát hiện (phạt gấp đôi + 1 cảnh cáo).
- **Ban đêm**: nuôi gia đình 3 người — tiền nhà $100 (bắt buộc), thức ăn $50, sưởi $30, thuốc $60. Nhịn ăn/không sưởi thì có người ốm; ốm 2 đêm không thuốc là mất người thân.
- **Cửa hàng**: thêm lượt soi ($80), thêm câu hỏi ($60), máy phát hiện nói dối ($120), thêm lượt vân tay ($70), máy đối chiếu tự tô đỏ ô lệch ($150), máy pha cà phê +1 giờ ca ($70), luật sư xóa cảnh cáo ($100).
- **Cấp bậc & kỹ năng**: làm đúng tăng uy tín → thăng cấp (Tập sự → Thanh tra → Thanh tra chính → Thanh tra trưởng), lương tăng từ $50 lên $70/khách, mỗi lần lên cấp chọn 1 trong 3 kỹ năng: Mắt diều hâu, Lưỡi sắc, Thần kinh thép, Quan hệ rộng, Chó nghiệp vụ K9, Camera nhận diện, Thẩm vấn viên, Phong độ.
- **Ngày đặc biệt** (từ ngày 2, mỗi loại tối đa 1 lần/ván): Thanh tra cấp trên giám sát (thưởng/phạt ×2), Lễ hội ánh sáng (+3 khách, lương ×1.5), Bão (ca đến 13:00, hỏng máy soi), Báo động khủng bố (soi không giới hạn, cho qua khi chưa soi là vi phạm), Mất điện (không máy móc, lương ×1.5).
- **Sự kiện ban đêm** có lựa chọn và hậu quả: người lạ dúi tiền "mua đường" cho kẻ truy nã, học phí của bé Na, chiếc hộp của hàng xóm, quầy 6 rủ chia phong bì, mẹ đi chùa (phúc lành chặn 1 lần ốm), chủ nhà tăng giá / chuyển nhà, bé Na sốt cao, chiếu bạc.
- **Khách quen**: nhân vật quay lại tùy quyết định của bạn — vợ của kẻ bị bắt đến xin thăm chồng, kẻ được tha tái phạm với lượng hàng gấp bội, người bị từ chối quay lại bằng giấy tờ giả, đàn em của trùm truy nã đến đe dọa…
- **6 kết thúc**: Người hùng cửa khẩu · Kẻ ăn tiền · Thành phố hỗn loạn · Bàn tay sắt · Cái giá của bổn phận · Một thanh tra bình thường — kèm số phận từng nhân vật bạn đã gặp.
- Game Over sớm khi: quá 3 cảnh cáo, không đủ tiền nhà, hoặc mất cả gia đình.

## Cấu trúc

```
server.js              Server local: file tĩnh + API (dùng lib/interrogate.js)
api/                   Vercel Functions: status.js, interrogate.js (dùng lib/interrogate.js)
lib/interrogate.js     Dựng system prompt, gọi Groq, giới hạn tần suất — dùng chung local & Vercel
vercel.json            outputDirectory = public
public/
  index.html           Màn hình: tiêu đề, báo sáng + công văn, quầy kiểm soát, ban đêm, kết thúc
  css/style.css        Giao diện mobile-first (3 khối dọc: camera · mặt bàn · bảng điều khiển)
  data/npcs.json       23 nhân vật viết tay (17 cố định + 6 khách quen theo hậu quả)
  js/main.js           Vòng lặp game, UI, đóng dấu, ban đêm, kết thúc
  js/rules.js          Quy tắc ngày, checkRules(), evaluateDecision() — chấm điểm bằng code, không dùng AI
  js/economy.js        Ca trực, gia đình & chi tiêu, cửa hàng, thanh tra nội bộ, tít báo sáng
  js/story.js          Máy phát hiện nói dối, số phận nhân vật, chọn kết thúc, hậu ký
  js/nights.js         Cấp bậc & kỹ năng, ngày đặc biệt, sự kiện ban đêm
  js/generator.js      Sinh khách ngẫu nhiên + khách quen + lệnh truy nã
  js/ai.js             Gọi API hỏi vặn + bộ trả lời offline theo từ khóa
  js/avatar.js         Avatar pixel-art SVG 32×32, đổi biểu cảm theo emotion
  js/docs.js           Render giấy tờ, công văn, kết quả X-quang, vân tay
  js/audio.js          Âm thanh tổng hợp WebAudio
```

## Thêm nhân vật

Thêm một object vào `public/data/npcs.json` theo mẫu có sẵn. Các trường chính:

- `minDay`: ngày sớm nhất được xuất hiện (1–5). Mỗi ván game tự xếp ngẫu nhiên nhân vật vào các ngày ≥ `minDay`. **Hoặc** `follow`: `{ "after": "npc_001", "decisions": ["ALLOW"], "delay": 2 }` — chỉ xuất hiện `delay` ngày sau khi người chơi chọn một trong `decisions` với nhân vật `after`.
- `crime`: `null` | `"CONTRABAND"` | `"FORGERY"` | `"WANTED"` (kèm `wanted` để hiện trên lệnh truy nã).
- `documents`: `passport`, `entry_permit`, `customs`, tùy chọn `work_permit`. Giấy tờ giả = cố ý cho lệch họ tên/số HC/ngày sinh so với hộ chiếu.
- `scan`: kết quả soi X-quang; món nào `"contraband": true` là hàng lậu.
- `fingerprint` (tùy chọn): `{ "name": "tên thật", "record": "hồ sơ" }` — mặc định là tên trên hộ chiếu + "Không tiền án".
- `bribe` (tùy chọn): số tiền phong bì nhân vật dúi khi bị dồn.
- `news` (tùy chọn): tít báo sáng hôm sau và số phận ở màn kết, dạng `{ "ALLOW": "...", "DENY": "...", "ARREST": "..." }`.
- `ai_persona`: `personality`, `temper`, `true_story`, `alibi`, `triggers` — dùng để dựng system prompt cho Groq.
- `lines`: câu thoại offline (`greeting`, `luggage`, `threat[]`, `mismatch`, `scanned`).

Đáp án đúng luôn được tính bằng `checkRules()` từ giấy tờ + `crime`, nên AI có nói gì thì kết quả chấm điểm vẫn nhất quán.
