// Render các loại giấy tờ trên mặt bàn.
import { esc, normalize } from './util.js';
import { renderAvatar } from './avatar.js';
import { describeRule, standingRules } from './rules.js';

export const DOC_TABS = [
  { key: 'passport', label: 'Hộ chiếu' },
  { key: 'entry_permit', label: 'Giấy phép' },
  { key: 'customs', label: 'Tờ khai' },
  { key: 'work_permit', label: 'GP lao động' },
  { key: 'rules', label: 'Quy tắc' },
];

const CAT_CLASS = {
  'Cá nhân': 'c-personal', 'Điện tử': 'c-elec', 'Thực phẩm': 'c-food', 'Hóa chất/Sinh học': 'c-chem',
  'Dược phẩm': 'c-med', 'Vũ khí': 'c-weapon', 'Không rõ': 'c-unknown',
};

// marks: ô người chơi tự đánh dấu; flags: ô máy đối chiếu báo lệch (Set 'field', đã lọc theo giấy tờ)
let flags = new Set();
const cls = (k, marks) => `f${marks?.has(k) ? ' marked' : ''}${flags.has(k) ? ' flagged' : ''}`;
const row = (k, label, value, marks) =>
  `<div class="row"><span class="lbl">${label}</span><span class="${cls(k, marks)}" data-k="${k}">${esc(value)}</span></div>`;

function mrz(p) {
  const n = normalize(p.name).toUpperCase().replace(/[^A-Z]/g, '<');
  return `P&lt;NSG${esc(n)}${'&lt;'.repeat(Math.max(0, 22 - n.length))}<br>${esc(p.id_number.replace('-', ''))}&lt;${esc(p.dob.replaceAll('-', ''))}&lt;${esc(p.expiry_date.replaceAll('-', ''))}&lt;&lt;`;
}

const forDoc = (set, key) => new Set([...set].filter((m) => m.startsWith(key + '.')).map((m) => m.slice(key.length + 1)));

export function renderDoc(key, npc, ctx, marksAll = new Set(), flagsAll = new Set()) {
  const d = npc.documents;
  const marks = forDoc(marksAll, key);
  flags = forDoc(flagsAll, key);
  switch (key) {
    case 'passport': {
      const p = d.passport;
      return `<article class="doc passport" data-doc="passport">
        <header class="doc-head"><span>HỘ CHIẾU · PASSPORT</span><span class="emblem">✦</span></header>
        <div class="pp-body">
          <div class="pp-photo">${renderAvatar(npc.avatar, 'calm')}</div>
          <div class="pp-fields">
            ${row('name', 'Họ tên', p.name, marks)}
            ${row('dob', 'Ngày sinh', p.dob, marks)}
            ${row('sex', 'Giới tính', p.sex, marks)}
            ${row('id_number', 'Số hộ chiếu', p.id_number, marks)}
            ${row('expiry_date', 'Hết hạn', p.expiry_date, marks)}
            ${row('origin', 'Nơi cấp', p.origin, marks)}
          </div>
        </div>
        <div class="mrz">${mrz(p)}</div>
      </article>`;
    }
    case 'entry_permit': {
      const e = d.entry_permit;
      return `<article class="doc permit" data-doc="entry_permit">
        <header class="doc-head"><span>GIẤY PHÉP NHẬP CẢNH</span><span class="emblem">NS</span></header>
        ${row('name', 'Họ tên', e.name, marks)}
        ${row('dob', 'Ngày sinh', e.dob, marks)}
        ${row('id_number', 'Số hộ chiếu', e.id_number, marks)}
        ${row('purpose', 'Mục đích', e.purpose, marks)}
        ${row('duration_days', 'Lưu trú', e.duration_days + ' ngày', marks)}
        <div class="seal">ĐÃ DUYỆT<br>SỞ NGOẠI VỤ</div>
      </article>`;
    }
    case 'customs': {
      const c = d.customs;
      const items = c.items
        .map((it, i) => `<li><span class="${cls('item' + i, marks)}" data-k="item${i}">${esc(it.name)}</span><span class="cat ${CAT_CLASS[it.category] || ''}">${esc(it.category)}</span></li>`)
        .join('');
      return `<article class="doc customs" data-doc="customs">
        <header class="doc-head"><span>TỜ KHAI HẢI QUAN</span><span class="emblem">HQ</span></header>
        ${row('name', 'Người khai', c.name, marks)}
        <div class="lbl block">Hành lý khai báo</div>
        <ul class="items">${items}</ul>
        ${row('cash', 'Tiền mặt', '$' + c.cash, marks)}
        <div class="sig">Chữ ký: <i>${esc(c.name.split(' ').pop())}</i></div>
      </article>`;
    }
    case 'work_permit': {
      const w = d.work_permit;
      return `<article class="doc work" data-doc="work_permit">
        <header class="doc-head"><span>GIẤY PHÉP LAO ĐỘNG</span><span class="emblem">LĐ</span></header>
        ${row('name', 'Họ tên', w.name, marks)}
        ${row('id_number', 'Số hộ chiếu', w.id_number, marks)}
        ${row('employer', 'Nơi làm việc', w.employer, marks)}
        ${row('valid_until', 'Hiệu lực đến', w.valid_until, marks)}
      </article>`;
    }
    case 'rules':
      return renderRules(ctx);
    default:
      return '';
  }
}

export function renderRules(ctx, { memo = false } = {}) {
  const standing = standingRules(ctx.date).map((t) => `<li>${esc(t)}</li>`).join('');
  const today = ctx.rules.map((r) => `<li><b class="new">MỚI</b> ${esc(describeRule(r))}</li>`).join('');
  const wanted = ctx.wanted.length
    ? `<h4>🚨 Lệnh truy nã</h4><div class="wanted-list">${ctx.wanted
        .map(
          (w) => `<div class="wanted${w.unknown ? ' boss' : ''}">
            <div class="w-photo">${w.unknown ? '<span class="w-unknown">?</span>' : renderAvatar(w.avatar, 'angry')}</div>
            <div class="w-info"><b>${esc(w.name)}</b><span>Số HC: ${esc(w.id_number)}</span><span>Tội danh: ${esc(w.charge)}</span>${w.note ? `<em>${esc(w.note)}</em>` : ''}</div>
          </div>`,
        )
        .join('')}</div>`
    : '';
  return `<article class="doc rules${memo ? ' memo' : ''}" data-doc="rules">
    <header class="doc-head"><span>CÔNG VĂN · NGÀY ${esc(ctx.date)}</span><span class="emblem">BAN</span></header>
    <h4>Quy tắc của ngày</h4>
    <ol class="rule-list today">${today}</ol>
    <h4>Quy định thường trực</h4>
    <ul class="rule-list">${standing}</ul>
    ${wanted}
    ${caseBoard(ctx.clues)}
  </article>`;
}

/** Bảng ghim vụ án Hắc Long: manh mối đã có + ô trống cho manh mối chưa lộ. */
export function caseBoard(clues, total = 3) {
  if (!clues?.length) return '';
  const pins = Array.from({ length: total }, (_, i) =>
    clues[i] ? `<li class="pin">📌 ${esc(clues[i])}</li>` : '<li class="pin empty">❔ Manh mối chưa lộ — bắt người của đường dây hoặc lắng nghe người tốt kể lại</li>',
  ).join('');
  return `<h4>🐉 Bảng ghim vụ án Hắc Long (${clues.length}/${total})</h4><ul class="case-board">${pins}</ul>`;
}

/** Kết quả tra vân tay trong cơ sở dữ liệu quốc gia. */
export function renderFingerprint(npc) {
  const p = npc.documents.passport;
  const fp = npc.fingerprint || { name: p.name, record: 'Không tiền án' };
  const nameOk = fp.name === p.name;
  const clean = fp.record === 'Không tiền án';
  const swirl = Array.from({ length: 7 }, (_, i) => `<ellipse cx="40" cy="48" rx="${8 + i * 4.5}" ry="${11 + i * 5.2}" fill="none" stroke="#00e5ff" stroke-width="1.6" stroke-dasharray="${9 + i} 3" opacity="${0.9 - i * 0.08}"/>`).join('');
  return `<div class="xray fp">
    <div class="x-head">CƠ SỞ DỮ LIỆU VÂN TAY</div>
    <div class="fp-body">
      <svg class="fp-print" viewBox="0 0 80 96">${swirl}</svg>
      <div class="fp-info">
        <span>Hộ chiếu khai: <b>${esc(p.name)}</b></span>
        <span>Vân tay khớp: <b class="${nameOk ? '' : 'bad'}">${esc(fp.name)}</b></span>
        <span>Hồ sơ: <b class="${clean ? '' : 'bad'}">${esc(fp.record)}</b></span>
      </div>
    </div>
    <p class="x-verdict ${nameOk && clean ? 'ok' : 'bad'}">${!nameOk ? 'DANH TÍNH KHÔNG KHỚP — người này đang dùng tên giả.' : clean ? 'Danh tính khớp, không có tiền án.' : 'Danh tính khớp nhưng có hồ sơ đáng chú ý.'}</p>
  </div>`;
}

export function renderXray(npc) {
  const rows = npc.scan
    .map(
      (s) => `<li class="${s.contraband ? 'hit' : ''}">
        <span class="x-item">${esc(s.item)}</span>
        <span class="x-reveal">${esc(s.reveal)}</span>
        ${s.contraband ? '<b class="x-flag">⚠ HÀNG CẤM GIẤU GIẾM</b>' : ''}
      </li>`,
    )
    .join('');
  const found = npc.scan.some((s) => s.contraband);
  return `<div class="xray">
    <div class="x-head">MÁY SOI X-QUANG · KẾT QUẢ</div>
    <ul>${rows}</ul>
    <p class="x-verdict ${found ? 'bad' : 'ok'}">${found ? 'Phát hiện vật thể không khai báo — bằng chứng buôn lậu.' : 'Không phát hiện bất thường.'}</p>
  </div>`;
}
