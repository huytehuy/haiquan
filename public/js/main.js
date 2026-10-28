// Vòng lặp game: báo sáng + công văn → ca trực (khách vào, soi/hỏi, đóng dấu) → ban đêm (chi tiêu, cửa hàng).
import { $, $$, esc, sleep, money, store, mulberry32, pick } from './util.js';
import * as R from './rules.js';
import * as E from './economy.js';
import { buildRoster, planSchedule, randomAvatar } from './generator.js';
import { renderAvatar } from './avatar.js';
import { renderDoc, renderRules, renderXray, renderFingerprint, DOC_TABS } from './docs.js';
import { interrogate, checkAIStatus, detectIntent, inspectorReply } from './ai.js';
import { measureStress, polygraphSvg, fates, chooseEnding, epilogueNotes, dirtyScore } from './story.js';
import * as N from './nights.js';
import * as T from './twists.js';
import { sfx, toggleMute, isMuted, unlockAudio } from './audio.js';

const SAVE_KEY = 'hq_save_v6';
const QUICK_QUESTIONS = ['Mục đích chuyến đi là gì?', 'Ở lại bao lâu?', 'Mở hành lý ra kiểm tra!', 'Nói thật đi, không tôi bắt giữ!'];
const TAB_COLORS = { passport: '#e9dcc0', entry_permit: '#dfeaf3', customs: '#f3ead3', work_permit: '#e0f0e0', rules: '#fbf7ec' };
const BRIBE_HINT = /\$\s?\d+|phong bì|cà phê|hối lộ|đút lót|bồi dưỡng|chút tiền|ít tiền/i;

const S = {
  npcs: [],
  ai: false,
  game: null, // { seed, day, money, mistakes, ..., rep, rank, skills, flags, eventsSeen, rent, warmHome, blessing }
  day: null, // { date, rules, wanted, visitors, index, results, scans, prints, clock, shiftEnd, overtime, bribes, mod }
  night: null, // { paid, audit, missed, deal, directive, na, rankUp, event, eventResult }
  room: null, // phòng thẩm vấn đang mở
  escape: null, // màn vượt cửa khẩu cuối game
  npc: null,
  tab: 'passport',
  busy: false,
  typingToken: 0,
};

const show = (id) => $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
const dayCtx = () => ({ date: S.day.date, rules: S.day.rules, wanted: S.day.wanted, clues: R.CLUES.slice(0, S.game.clues), docs: S.day.unlocks.docs });
const hasSkill = (k) => S.game.skills.includes(k);
const mod = () => S.day?.mod || {};

// ---------------------------------------------------------------- Khởi động

async function boot() {
  bindEvents();
  animateTitleAvatar();
  setInterval(tickClock, 250);
  $('#btn-mute').textContent = isMuted() ? '🔇' : '🔊';

  const [npcs, status] = await Promise.all([fetch('/data/npcs.json').then((r) => r.json()), checkAIStatus()]);
  S.npcs = npcs;
  S.ai = !!status.ai;
  const el = $('#ai-status');
  el.className = 'ai-status ' + (S.ai ? 'on' : 'off');
  el.textContent = S.ai ? `● AI trực tuyến · ${status.model}` : '● Chế độ kịch bản offline (chưa có GROQ_API_KEY)';

  const save = store(SAVE_KEY);
  if (save?.day) {
    const btn = $('#btn-continue');
    btn.hidden = false;
    btn.textContent = `Tiếp tục ngày ${save.day}/${R.TOTAL_DAYS} · ${money(save.money)}`;
  }
}

function animateTitleAvatar() {
  const box = $('#title-avatar');
  const emotions = ['calm', 'nervous', 'angry', 'pleading'];
  let i = 0;
  let spec;
  const draw = () => {
    if (!$('#screen-title').classList.contains('active')) return;
    if (i % 4 === 0) spec = randomAvatar(Math.random, Math.random() < 0.5 ? 'Nam' : 'Nữ');
    box.innerHTML = renderAvatar(spec, emotions[i++ % 4]);
  };
  draw();
  setInterval(draw, 1100);
}

function bindEvents() {
  $('#btn-new').onclick = () => { unlockAudio(); sfx.click(); newGame(); };
  $('#btn-continue').onclick = () => {
    unlockAudio();
    const save = store(SAVE_KEY);
    if (!save) return;
    S.game = save;
    startDay();
  };
  $('#btn-howto').onclick = () => { unlockAudio(); openModal(howtoHtml()); };
  $('#btn-open').onclick = () => { sfx.click(); show('screen-booth'); nextVisitor(); };
  $('#btn-mute').onclick = () => { $('#btn-mute').textContent = toggleMute() ? '🔇' : '🔊'; };
  $('#btn-scan').onclick = scan;
  $('#btn-print').onclick = fingerprint;
  $('#btn-restart').onclick = () => show('screen-title');
  $('#esc-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#esc-input');
    answerInspector(input.value);
    input.value = '';
  });
  $('#esc-next').onclick = () => gameOver('win');
  $('#bribe-take').onclick = () => resolveBribe(true);
  $('#bribe-refuse').onclick = () => resolveBribe(false);
  $('#modal-close').onclick = closeModal;
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  $('#ask-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#ask-input');
    ask(input.value);
    input.value = '';
  });
  $$('.verdicts .btn').forEach((b) => (b.onclick = () => decide(b.dataset.v)));

  $('#tabs').addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    S.tab = t.dataset.tab;
    sfx.paper();
    renderTabs();
    renderDocView();
  });
  $('#doc-view').addEventListener('click', (e) => {
    const f = e.target.closest('.f');
    if (f) {
      toggleMark(f);
      return;
    }
    if (e.target.closest('.doc')) openModal(renderDoc(S.tab, S.npc, dayCtx(), S.npc.marks, S.npc.flags));
  });
  $('#modal-body').addEventListener('click', (e) => {
    const f = e.target.closest('.f');
    if (!f || !S.npc) return;
    toggleMark(f);
    renderDocView();
  });

  // Ban đêm: chi tiêu & cửa hàng
  $('#summary-content').addEventListener('change', (e) => {
    const box = e.target.closest('input[data-expense]');
    if (!box) return;
    S.night.paid[box.dataset.expense] = box.checked;
    sfx.click();
    renderNight();
  });
  $('#summary-content').addEventListener('click', (e) => {
    const b = e.target.closest('[data-buy]');
    if (b) return buy(b.dataset.buy);
    const sk = e.target.closest('[data-skill]');
    if (sk) return chooseSkill(sk.dataset.skill);
    const ch = e.target.closest('[data-choice]');
    if (ch && !ch.disabled) chooseEvent(ch.dataset.choice);
  });
}

function toggleMark(f) {
  const key = `${f.closest('.doc').dataset.doc}.${f.dataset.k}`;
  S.npc.marks.has(key) ? S.npc.marks.delete(key) : S.npc.marks.add(key);
  f.classList.toggle('marked');
  sfx.click();
}

// ---------------------------------------------------------------- Ngày làm việc

function newGame() {
  S.game = {
    seed: Math.floor(Math.random() * 1e9), day: 1, money: 0, mistakes: 0, correct: 0, total: 0, arrests: 0,
    streak: 0, bribes: 0, upgrades: E.newUpgrades(), family: E.newFamily(), morning: null,
    decisions: {}, // npcId -> { decision, day } cho nhân vật viết tay — quyết định ai quay lại
    stats: { caught: 0, escaped: 0, wrongArrest: 0 },
    rep: 0, rank: 0, skills: [], // uy tín → cấp bậc → kỹ năng
    flags: {}, eventsSeen: [], // lựa chọn ở sự kiện ban đêm: key -> { choice, day }
    rent: E.EXPENSES[0].price, warmHome: false, blessing: false,
    clues: 0, naLocation: false, // manh mối Hắc Long đã moi được; đã biết nơi giam bé Na chưa
    naState: null, border: null, // số phận bé Na: returned | rescued | captive | late; kết quả vượt biên
  };
  startDay();
}

function startDay() {
  const g = S.game;
  const rng = mulberry32(g.seed + g.day * 7919);
  const date = R.dayDate(g.day);
  const unlocks = R.unlocksFor(g.day);
  const rules = R.makeDayRules(g.day, rng);
  // Lịch nhân vật cố định theo seed của ván — mỗi ván mới một thứ tự, "Tiếp tục" giữ nguyên lịch
  const schedule = planSchedule(S.npcs, mulberry32(g.seed ^ 0x5bd1e995), R.TOTAL_DAYS, g.decisions);
  const m = N.dayModFor(g.day, N.planDayMods(mulberry32(g.seed ^ 0x27d4eb2f), R.TOTAL_DAYS)[g.day - 1]);
  const { visitors, wanted } = buildRoster(g.day, rng, { date, rules, unlocks, extraVisitors: m?.extraVisitors }, S.npcs, schedule, g.decisions, g.flags);
  S.day = {
    date, rules, wanted, visitors, unlocks, index: 0, results: [], bribes: [], mod: m,
    scans: !unlocks.tools.has('scan') || m?.noScan ? 0 : m?.unlimitedScan ? 99 : R.SCANS_PER_DAY + g.upgrades.scan,
    prints: !unlocks.tools.has('print') || m?.noPrint ? 0 : R.PRINTS_PER_DAY + g.upgrades.fingerprint,
    clock: E.SHIFT_START,
    shiftEnd: (m?.shiftEnd || E.SHIFT_END) + (g.upgrades.coffee ? E.COFFEE_MINUTES : 0),
    overtime: false,
  };
  store(SAVE_KEY, g);

  const realMin = Math.round((S.day.shiftEnd - S.day.clock) / E.GAME_MIN_PER_SEC / 60 / (hasSkill('steel') ? 0.75 : 1));
  const rank = N.RANKS[g.rank];
  const next = N.nextRank(g.rank);
  const qPer = R.QUESTIONS_PER_VISITOR + g.upgrades.question + (hasSkill('interrogator') ? 1 : 0);
  $('#memo-content').innerHTML = `
    ${newspaperHtml(g, date, rules)}
    ${m ? `<div class="mod-banner${N.STORY_DAYS[g.day] ? ' story' : ''}"><span class="mod-ico">${m.icon}</span><div><b>${N.STORY_DAYS[g.day] ? '' : 'NGÀY ĐẶC BIỆT: '}${esc(m.name)}</b><span>${esc(m.desc)}</span></div></div>` : ''}
    ${storyHtml(g)}
    <div class="memo-intro">NGÀY ${g.day}/${R.TOTAL_DAYS} · ${date}</div>
    ${unlocks.note ? `<div class="unlock-banner">🆕 <b>Mở khóa hôm nay:</b> ${esc(unlocks.note)}</div>` : ''}
    <div class="rank-line">🎖 ${rank.name} · Uy tín ${g.rep}${next ? `/${next.rep}` : ''} · Lương $${rank.pay}/khách${g.skills.length ? ` · ${g.skills.map((k) => N.skillByKey[k].icon).join(' ')}` : ''}</div>
    <p class="memo-sub">Hàng chờ: <b>${visitors.length} khách</b> · Ca trực <b>${E.fmtClock(S.day.clock)}–${E.fmtClock(S.day.shiftEnd)}</b> (≈${realMin} phút thật, đồng hồ dừng khi chờ khách trả lời).
      Hết giờ thì khách còn lại phải về — làm nhanh mới đủ tiền nuôi gia đình.<br>
      Hỏi vặn: <b>${qPer} câu/khách</b>${unlocks.tools.has('scan') ? ` · Máy soi: <b>${S.day.scans >= 99 ? 'không giới hạn' : S.day.scans + ' lượt'}</b>` : ''}${unlocks.tools.has('print') ? ` · Vân tay: <b>${S.day.prints} lượt</b>` : ''}${g.upgrades.polygraph && !m?.noGadgets ? ' · Máy phát hiện nói dối: <b>bật</b>' : ''}.
      Bắt giữ đúng +$${R.ARREST_BONUS}, chuỗi ${R.STREAK_MIN}+ đúng liên tiếp +$${R.STREAK_BONUS * (hasSkill('momentum') ? 2 : 1)}. Sai −$${R.FINE_WRONG} và 1 cảnh cáo. Làm đúng để tăng uy tín và thăng cấp.</p>
    ${renderRules(dayCtx(), { memo: true })}`;
  $('.cam-label').innerHTML = `CAM-01 · QUẦY 7${m ? ` <span class="mod-chip">${m.icon} ${esc(m.name)}</span>` : ''} <span class="rec">● REC</span>`;
  $('#screen-memo .scroll-area').scrollTop = 0;
  show('screen-memo');
  sfx.paper();
}

function newspaperHtml(g, date, rules) {
  if (g.day === 1 && !g.morning) return '';
  const headlines = [...(g.morning?.headlines || []), ...rules.map(E.ruleHeadline)].slice(0, 5);
  const home = (g.morning?.home || []).map((t) => `<div>${esc(t)}</div>`).join('');
  return `<div class="paper">
    <div class="paper-name">BÁO NEO-SAIGON</div>
    <div class="paper-date">Số sáng · ${date} · 2 tín chỉ</div>
    ${headlines.map((h) => `<h5>${esc(h)}</h5>`).join('')}
    ${home ? `<div class="home"><b>Tin nhà</b>${home}</div>` : ''}
  </div>`;
}

function updateHud() {
  const g = S.game, d = S.day;
  $('#hud-day').textContent = `Ngày ${g.day}/${R.TOTAL_DAYS}`;
  $('#hud-date').textContent = d.date;
  $('#hud-visitor').textContent = `${Math.min(d.index + 1, d.visitors.length)}/${d.visitors.length}`;
  $('#hud-money').textContent = money(g.money);
  const m = $('#hud-mistakes');
  m.textContent = `${g.mistakes}/${R.MAX_MISTAKES}`;
  m.classList.toggle('warn', g.mistakes >= R.MAX_MISTAKES);
  $('#scan-left').textContent = d.scans;
  $('#print-left').textContent = d.prints;
  updateClock();
}

function updateClock() {
  const d = S.day;
  const el = $('#hud-clock');
  el.textContent = E.fmtClock(d.clock);
  el.classList.toggle('late', !d.overtime && d.shiftEnd - d.clock <= 60);
  el.classList.toggle('over', d.overtime);
}

/** Đồng hồ ca trực chạy theo thời gian thật; dừng khi đang chờ AI/hiệu ứng, khi xem kết quả, khi ẩn tab. */
function tickClock() {
  const d = S.day;
  if (!d || !S.npc || S.busy || d.overtime || document.hidden) return;
  if (!$('#screen-booth').classList.contains('active') || !$('#result-sheet').hidden) return;
  d.clock = Math.min(d.clock + (E.GAME_MIN_PER_SEC / 4) * (hasSkill('steel') ? 0.75 : 1), d.shiftEnd);
  if (d.clock >= d.shiftEnd) {
    d.overtime = true;
    sfx.bell();
    flash('⏰ HẾT GIỜ! Xử lý nốt khách này', 4000);
  }
  updateClock();
}

function flash(text, ms = 1800) {
  const el = $('#streak');
  el.textContent = text;
  el.hidden = false;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(flash.t);
  flash.t = setTimeout(() => (el.hidden = true), ms);
}

function setControls() {
  const npc = S.npc;
  const idle = !S.busy && !!npc;
  const canAsk = idle && npc.qLeft > 0;
  $('#ask-input').disabled = !canAsk;
  $('#ask-send').disabled = !canAsk;
  $$('.chip').forEach((c) => (c.disabled = !canAsk));
  $$('.verdicts .btn').forEach((b) => (b.disabled = !idle));
  $('#btn-scan').disabled = !idle || S.day.scans <= 0 || !!npc?.scanned;
  $('#btn-print').disabled = !idle || S.day.prints <= 0 || !!npc?.printed;
  $('#btn-scan').hidden = !S.day.unlocks.tools.has('scan');
  $('#btn-print').hidden = !S.day.unlocks.tools.has('print');
  $('#q-left').textContent = npc ? `${npc.qLeft}/${npc.qMax}` : '';
  $('#ask-input').placeholder = npc && npc.qLeft <= 0 ? 'Hết lượt hỏi — hãy ra quyết định' : 'Gõ câu hỏi vặn khách…';
}

// ---------------------------------------------------------------- Khách

async function nextVisitor() {
  const d = S.day, g = S.game;
  if (d.index >= d.visitors.length) return endDay();

  const npc = d.visitors[d.index];
  const qMax = R.QUESTIONS_PER_VISITOR + g.upgrades.question + (hasSkill('interrogator') ? 1 : 0);
  const gadgets = !mod().noGadgets;
  Object.assign(npc, {
    convo: [], notes: [], pressure: 0, qLeft: qMax, qMax, scanned: null, printed: false, bribeState: null, marks: new Set(), _date: d.date,
    flags: g.upgrades.comparator && gadgets ? R.flaggedFields(npc, d.date) : new Set(),
    slippery: hasSkill('silver'),
  });
  if (npc.boss && dirtyScore(g) > 0) {
    npc.notes.push('Bạn nắm trong tay bằng chứng viên thanh tra này từng nhận phong bì. Nếu bị dồn ép, hãy bình thản nhắc đến chuyện đó như một lời đe dọa.');
  }
  if (npc.boss && g.naState === 'captive') {
    npc.notes.push('Con gái viên thanh tra (bé Na) đang bị người của bạn giữ. Hãy bình thản nhắc: cho bạn qua thì tối nay con bé về nhà.');
    npc.lines = { ...npc.lines, greeting: npc.lines.leverage };
  }
  if (npc.directive) npc.notes.push('Trưởng trạm Quyền đã ra chỉ thị mật cho viên thanh tra này phải cho bạn qua, không soi, không hỏi.');
  if (npc.holdsNa) npc.notes.push('Bạn biết viên thanh tra trước mặt là cha/mẹ của bé Na mà đồng bọn đang giữ.');
  if (npc.slippery) {
    npc.notes.push('Bạn đang cực kỳ căng thẳng trước viên thanh tra sắc sảo này. Nếu bạn có giấu điều gì, hãy vô tình để lộ một chi tiết mâu thuẫn hoặc lỡ lời.');
  }
  S.npc = npc;
  S.tab = 'passport';
  S.busy = true;

  updateHud();
  renderTabs();
  renderDocView();
  renderChips();
  $('#bribe').hidden = true;
  $('#stamp-layer').innerHTML = '';
  $('#speech-q').textContent = '';
  $('#speech-a').textContent = '';
  $('#speech').classList.add('hide');
  $('.queue').innerHTML = '<i></i>'.repeat(Math.min(5, d.visitors.length - d.index - 1));

  const el = $('#npc');
  el.className = 'npc';
  setEmotion(npc.ai_persona.temper === 'nervous' ? 'nervous' : 'calm');
  const plate = $('#nameplate');
  plate.textContent = npc.follow ? `⚠ KHÁCH QUEN #${d.index + 1}` : `KHÁCH #${d.index + 1}`;
  plate.classList.toggle('regular', !!npc.follow);
  const pg = $('#polygraph');
  pg.hidden = !g.upgrades.polygraph || !gadgets;
  pg.className = 'polygraph';
  $('#pg-bpm').textContent = '--';
  $('#pg-wave').innerHTML = polygraphSvg(15);
  $('#pg-label').textContent = 'Chờ câu trả lời…';
  void el.offsetWidth;
  el.classList.add('enter');
  sfx.door();
  setControls();

  await sleep(500);
  $('#speech').classList.remove('hide');
  await say(npc.lines?.greeting || 'Chào thanh tra. Giấy tờ của tôi đây.');
  S.busy = false;
  setControls();
  skillAlerts(npc);
}

/** Cảnh báo từ kỹ năng khi khách vừa vào: camera nhận diện, chó nghiệp vụ. */
function skillAlerts(npc) {
  if (hasSkill('face') && S.day.wanted.some((w) => w.npcId === npc.id)) {
    sfx.alarm();
    flash('📸 CAMERA: KHUÔN MẶT KHỚP LỆNH TRUY NÃ!', 3500);
    return;
  }
  if (hasSkill('k9')) {
    const smuggler = npc.scan.some((s) => s.contraband);
    // chó giỏi nhưng không hoàn hảo: bỏ sót 20%, sủa nhầm 8%
    if (smuggler ? Math.random() < 0.8 : Math.random() < 0.08) {
      sfx.beep();
      flash('🐕 GÂU! GÂU! Chó nghiệp vụ đánh hơi thấy gì đó…', 3000);
    }
  }
}

function setEmotion(e) {
  const el = $('#npc');
  el.dataset.emotion = e;
  el.innerHTML = renderAvatar(S.npc.avatar, e);
}

/** Hiệu ứng gõ chữ cho lời thoại. */
async function say(text, source) {
  const token = ++S.typingToken;
  const el = $('#speech-a');
  el.textContent = '';
  for (let i = 0; i < text.length; i++) {
    if (token !== S.typingToken) return;
    el.textContent += text[i];
    if (i % 3 === 0) sfx.blip();
    $('#speech').scrollTop = 1e6;
    await sleep(text[i] === ' ' ? 12 : 20);
  }
  if (source === 'offline' && S.ai) el.insertAdjacentHTML('beforeend', '<span class="src">(kịch bản)</span>');
}

function renderTabs() {
  const npc = S.npc;
  // Mắt diều hâu: đánh dấu tab chứa vi phạm nhìn thấy được trên giấy tờ
  // (truy nã chỉ tính khi người này thật sự có tên trên lệnh truy nã hôm nay)
  const onBulletin = S.day.wanted.some((w) => w.npcId === npc.id);
  const suspicious = hasSkill('eagle')
    ? new Set(R.checkRules(npc, dayCtx()).map((v) => v.doc).filter((doc) => doc && (doc !== 'rules' || onBulletin)))
    : new Set();
  $('#tabs').innerHTML = DOC_TABS.filter((t) => t.key === 'rules' || (npc.documents[t.key] && S.day.unlocks.docs.has(t.key)))
    .map((t) => `<button class="tab${t.key === S.tab ? ' active' : ''}" data-tab="${t.key}" role="tab" style="--tab-color:${TAB_COLORS[t.key]}">${t.label}${suspicious.has(t.key) ? '<b class="tab-alert">!</b>' : ''}</button>`)
    .join('');
}

function renderDocView() {
  const hint = S.game.upgrades.comparator && !mod().noGadgets ? 'Ô viền đỏ = máy đối chiếu báo lệch · ' : '';
  $('#doc-view').innerHTML =
    renderDoc(S.tab, S.npc, dayCtx(), S.npc.marks, S.npc.flags) +
    `<p class="zoom-hint">${hint}Chạm ô thông tin để đánh dấu · chạm giấy để phóng to</p>`;
}

function renderChips() {
  $('#chips').innerHTML = QUICK_QUESTIONS.map((q) => `<button class="chip" type="button">${esc(q)}</button>`).join('');
  $$('.chip').forEach((c) => (c.onclick = () => ask(c.textContent)));
}

async function ask(text) {
  const npc = S.npc;
  text = String(text || '').trim().slice(0, 150);
  if (!text || S.busy || !npc || npc.qLeft <= 0) return;
  unlockAudio();
  npc.qLeft--;
  S.busy = true;
  setControls();

  $('#speech').classList.remove('hide');
  $('#speech-q').textContent = `Bạn: ${text}`;
  $('#speech-a').innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';

  const res = await interrogate(npc, text, { date: S.day.date, aiOnline: S.ai });
  npc.convo.push({ q: text, a: res.dialogue, emotion: res.emotion });
  setEmotion(res.emotion);
  if (S.game.upgrades.polygraph && !mod().noGadgets) showPolygraph(measureStress(npc, text));
  await say(res.dialogue, res.source);
  S.busy = false;
  setControls();
  if (['threat', 'bribe'].includes(detectIntent(text)) || BRIBE_HINT.test(res.dialogue)) offerBribe();
}

async function scan() {
  const npc = S.npc;
  if (S.busy || !npc || npc.scanned || S.day.scans <= 0) return;
  S.day.scans--;
  sfx.scan();
  const found = npc.scan.filter((s) => s.contraband);
  npc.scanned = { contraband: found.length > 0 };
  npc.notes.push(
    found.length
      ? `Thanh tra vừa soi X-quang hành lý và phát hiện: ${found.map((f) => f.reveal).join('; ')}. Bạn đã bị lộ và rất hoảng loạn.`
      : 'Thanh tra vừa soi X-quang hành lý và không thấy gì bất thường.',
  );
  updateHud();
  openModal(renderXray(npc));

  S.busy = true;
  setControls();
  $('#speech').classList.remove('hide');
  $('#speech-q').textContent = '[Hành lý được đưa qua máy soi]';
  if (found.length) {
    setEmotion(npc.ai_persona.temper === 'angry' ? 'angry' : 'pleading');
    await say(npc.lines?.scanned || 'C-cái đó... không phải của tôi! Có người gài tôi!');
  } else {
    setEmotion('calm');
    await say(pick(Math.random, ['Thấy chưa, toàn đồ bình thường mà.', 'Đồ đạc của tôi sạch sẽ cả.', 'Xong chưa thanh tra?']));
  }
  S.busy = false;
  setControls();
  if (found.length) offerBribe();
}

function showPolygraph({ stress, bpm, label }) {
  const pg = $('#polygraph');
  pg.className = 'polygraph' + (stress >= 78 ? ' hot' : stress >= 55 ? ' warm' : '');
  $('#pg-bpm').textContent = bpm;
  $('#pg-wave').innerHTML = polygraphSvg(stress);
  $('#pg-label').textContent = label;
  if (stress >= 78) sfx.beep();
}

async function fingerprint() {
  const npc = S.npc;
  if (S.busy || !npc || npc.printed || S.day.prints <= 0) return;
  S.day.prints--;
  npc.printed = true;
  sfx.scan();
  const p = npc.documents.passport;
  const fp = npc.fingerprint || { name: p.name, record: 'Không tiền án' };
  const exposed = fp.name !== p.name || fp.record !== 'Không tiền án';
  npc.notes.push(
    exposed
      ? `Thanh tra vừa lấy dấu vân tay của bạn. Hệ thống trả về: tên thật "${fp.name}", hồ sơ "${fp.record}". Bạn đã bị lộ.`
      : 'Thanh tra vừa lấy dấu vân tay của bạn, hệ thống xác nhận danh tính khớp và không có tiền án.',
  );
  updateHud();
  openModal(renderFingerprint(npc));

  S.busy = true;
  setControls();
  $('#speech').classList.remove('hide');
  $('#speech-q').textContent = '[Khách đặt ngón tay lên máy quét]';
  if (exposed) {
    setEmotion(npc.ai_persona.temper === 'angry' ? 'angry' : 'nervous');
    await say(pick(Math.random, ['M-máy hỏng rồi! Đó không phải tôi!', 'Chắc... chắc trùng vân tay thôi thanh tra...', '...Máy móc thời nay hay nhầm lắm.']));
  } else {
    setEmotion('calm');
    await say(pick(Math.random, ['Đấy, đúng là tôi mà.', 'Xong chưa? Tay tôi sạch sẽ cả.', 'Vân tay của tôi đó, thanh tra yên tâm chưa?']));
  }
  S.busy = false;
  setControls();
  if (exposed) offerBribe();
}

// ---------------------------------------------------------------- Hối lộ

function offerBribe() {
  const npc = S.npc;
  if (!npc?.bribe || npc.bribeState) return;
  npc.bribeState = 'offered';
  $('#bribe-amount').textContent = '$' + npc.bribe;
  $('#bribe').hidden = false;
  sfx.paper();
}

function resolveBribe(take) {
  const npc = S.npc;
  if (!npc || npc.bribeState !== 'offered') return;
  $('#bribe').hidden = true;
  if (take) {
    npc.bribeState = 'taken';
    // Bắt tay với quầy 6: chia đôi phong bì, đổi lại được che thanh tra nội bộ
    const partner = S.game.flags.colleague?.choice === 'join';
    const amount = partner ? Math.round(npc.bribe / 2) : npc.bribe;
    S.game.money += amount;
    S.game.bribes++;
    S.day.bribes.push({ npcId: npc.id, name: npc.documents.passport.name, amount, covered: partner });
    if (npc.boss) S.game.flags.bossBribe = true;
    npc.notes.push(`Thanh tra đã lén nhận phong bì $${npc.bribe} của bạn. Bạn tin là sẽ được cho qua.`);
    sfx.coin();
    flash(`💵 +$${amount} (bẩn${partner ? ', đã chia quầy 6' : ''})`);
    updateHud();
  } else {
    npc.bribeState = 'refused';
    npc.notes.push('Thanh tra đã từ chối phong bì của bạn, mặt lạnh tanh.');
    sfx.click();
  }
}

// ---------------------------------------------------------------- Quyết định

const STAMP = { ALLOW: ['CHẤP THUẬN', 'allow'], DENY: ['TỪ CHỐI', 'deny'], ARREST: ['BẮT GIỮ', 'arrest'] };
const VERDICT_VI = { ALLOW: 'Cho qua', DENY: 'Từ chối', ARREST: 'Bắt giữ' };

function farewell(npc, v) {
  const criminal = !!npc.crime;
  if (v === 'ALLOW') return criminal ? ['Hehe... cảm ơn thanh tra nhé.', 'calm'] : ['Cảm ơn thanh tra! Chúc một ngày tốt lành.', 'calm'];
  if (npc.bribeState === 'taken') return ['Cái gì?! Tôi đã đưa tiền rồi cơ mà! Tôi sẽ tố cáo anh!', 'angry'];
  if (v === 'DENY') return npc.ai_persona.temper === 'angry' ? ['Vô lý! Tôi sẽ khiếu nại!', 'angry'] : ['Sao lại thế... thôi được rồi.', 'pleading'];
  return criminal ? ['Không! Thả tôi ra! Tôi có thể giải thích!', 'pleading'] : ['Tôi vô tội! Các người bắt nhầm người rồi!', 'angry'];
}

async function decide(v) {
  const npc = S.npc;
  if (S.busy || !npc) return;
  unlockAudio();
  S.busy = true;
  S.typingToken++;
  $('#bribe').hidden = true;
  setControls();

  const violations = R.checkRules(npc, dayCtx());
  let result = R.evaluateDecision(v, violations);
  // Báo động khủng bố: cho qua mà chưa soi là vi phạm lệnh, dù hồ sơ có sạch
  if (mod().mustScan && v === 'ALLOW' && !npc.scanned) {
    result = { ...result, code: 'WRONG_PROTOCOL', correct: false, pay: 0, bonus: 0, fine: R.FINE_WRONG, title: 'Vi phạm lệnh báo động: cho qua khi chưa soi X-quang!' };
  }
  // Chỉ thị mật của Trưởng trạm (ngày 5): cho qua thì sếp "lo" hết — không bị tính lỗi
  if (npc.directive) {
    S.game.flags.directive = { choice: v === 'ALLOW' ? 'obey' : 'defy', day: S.game.day };
    if (v === 'ALLOW') result = { ...result, code: 'OBEYED', correct: true, pay: 0, bonus: 0, fine: 0, title: 'Bạn đã làm theo chỉ thị của Trưởng trạm' };
  }
  // Lương theo cấp bậc × hệ số ngày đặc biệt
  const g0 = S.game;
  if (result.pay) result.pay = Math.round(N.RANKS[g0.rank].pay * (mod().payMult || 1));
  if (result.bonus) result.bonus = Math.round(result.bonus * (mod().payMult || 1));
  if (result.fine) result.fine = Math.round(result.fine * (mod().fineMult || 1));

  // Đóng dấu
  const [label, cls] = STAMP[v];
  S.tab = 'passport';
  renderTabs();
  renderDocView();
  $('#stamp-layer').innerHTML = `<div class="stamp ${cls}">${label}</div>`;
  sfx.stamp();
  await sleep(450);

  if (v === 'ARREST') {
    sfx.alarm();
    const light = $('#alarm-light');
    light.classList.remove('on');
    void light.offsetWidth;
    light.classList.add('on');
  }
  const [line, emo] = farewell(npc, v);
  setEmotion(emo);
  $('#speech-q').textContent = '';
  await say(line);
  await sleep(500);
  $('#npc').classList.add(v === 'ALLOW' ? 'exit-right' : v === 'DENY' ? 'exit-left' : 'exit-down');
  await sleep(550);

  // Ghi nhận
  const g = S.game;
  g.total++;
  result.streakBonus = 0;
  if (result.correct) {
    g.correct++;
    g.streak++;
    if (g.streak >= R.STREAK_MIN) result.streakBonus = R.STREAK_BONUS * (hasSkill('momentum') ? 2 : 1);
    result.rep = result.code === 'OBEYED' ? 0 : N.REP.correct + (result.code === 'CORRECT_ARREST' ? N.REP.arrest : 0);
  } else {
    g.mistakes++;
    g.streak = 0;
    result.rep = N.REP.wrong;
  }
  g.rep = Math.max(0, g.rep + result.rep);
  if (result.code === 'CORRECT_ARREST') g.arrests++;
  if (result.expected === 'ARREST' && v === 'ARREST') g.stats.caught++;
  if (result.expected === 'ARREST' && v === 'ALLOW') g.stats.escaped++;
  if (result.expected !== 'ARREST' && v === 'ARREST') g.stats.wrongArrest++;
  if (!npc.generated) g.decisions[npc.id] = { decision: v, day: g.day };
  // Nhận phong bì rồi không cho qua → người đưa tiền tố cáo, thanh tra nội bộ chắc chắn biết
  if (npc.bribeState === 'taken' && v !== 'ALLOW') {
    const b = S.day.bribes.find((x) => x.npcId === npc.id);
    if (b) b.betrayed = true;
  }
  // Bé Na: cho gã khăn đỏ qua thì con về tối nay; bắt hắn thì phải moi ra nơi giam trong Phòng thẩm vấn
  if (npc.holdsNa) g.naState = v === 'ALLOW' ? 'returned' : 'captive';
  if (npc.boss && g.naState === 'captive') {
    if (v === 'ALLOW') {
      g.naState = 'returned';
      g.flags.choseChild = true;
    } else if (v === 'ARREST') g.naState = 'late';
  }
  // Bắt đúng người còn giữ bí mật → được đưa vào Phòng thẩm vấn
  result.canInterrogate = v === 'ARREST' && result.expected === 'ARREST' && S.day.unlocks.tools.has('interrogate') && T.secretsFor(npc, g).length > 0;
  if (npc.boss && result.code === 'CORRECT_ARREST') result.bonus += N.BOSS_BOUNTY;
  const delta = result.pay + result.bonus + result.streakBonus - result.fine;
  g.money += delta;
  S.day.results.push({ npc, decision: v, result, delta });
  updateHud();
  result.correct ? sfx.coin() : sfx.error();
  if (result.streakBonus) flash(`🔥 Chuỗi ${g.streak} đúng · +$${result.streakBonus}`);
  showResultSheet(npc, result);
}

function showResultSheet(npc, result) {
  const g = S.game, d = S.day;
  const over = g.mistakes > R.MAX_MISTAKES;
  const lastOne = d.index + 1 >= d.visitors.length;
  const reasons = result.violations.length
    ? `<ul>${result.violations.map((x) => `<li>${esc(x.text)}${x.sev === 'ARREST' ? ' <b>→ bắt giữ</b>' : ''}</li>`).join('')}</ul>`
    : '<ul><li>Hồ sơ hợp lệ, không vi phạm quy tắc nào.</li></ul>';
  const moneyLine = [
    result.pay ? `<span class="plus">+$${result.pay} lương</span>` : '',
    result.bonus ? `<span class="plus">+$${result.bonus} thưởng bắt giữ</span>` : '',
    result.streakBonus ? `<span class="plus">+$${result.streakBonus} chuỗi ${g.streak}🔥</span>` : '',
    result.fine ? `<span class="minus">−$${result.fine} phạt · cảnh cáo ${g.mistakes}/${R.MAX_MISTAKES}</span>` : '',
    result.rep ? `<span class="${result.rep > 0 ? 'plus' : 'minus'}">${result.rep > 0 ? '+' : ''}${result.rep} uy tín</span>` : '',
  ].filter(Boolean).join(' · ');

  let next = 'Gọi khách tiếp theo ▶';
  if (over) next = 'Nhận quyết định kỷ luật…';
  else if (lastOne) next = 'Kết thúc ca làm ▶';
  else if (d.overtime) next = `Hết giờ — về nhà (${d.visitors.length - d.index - 1} khách phải về) ▶`;

  const sheet = $('#result-sheet');
  sheet.className = 'sheet ' + (result.correct ? 'good' : 'bad');
  sheet.innerHTML = `
    <h3>${result.correct ? '✔' : '✖'} ${esc(result.title)}</h3>
    <div class="who">${esc(npc.documents.passport.name)} · Bạn chọn: <b>${VERDICT_VI[result.decision]}</b> · Đáp án: <b>${VERDICT_VI[result.expected]}</b></div>
    ${reasons}
    ${result.canInterrogate ? `<button class="btn interro-btn" id="btn-interro">🔦 Đưa vào Phòng thẩm vấn (${T.INTERRO_QUESTIONS} câu hỏi)</button>` : ''}
    <div class="delta">${moneyLine || '±$0'}</div>
    <button class="btn primary" id="btn-sheet-next">${next}</button>`;
  sheet.hidden = false;
  $('#btn-sheet-next').onclick = () => {
    sheet.hidden = true;
    sfx.click();
    if (over) return gameOver('fired');
    S.day.index++;
    S.npc = null;
    if (d.overtime) return endDay();
    nextVisitor();
  };
  $('#btn-interro')?.addEventListener('click', () => openInterrogation(npc));
}

// ---------------------------------------------------------------- Ban đêm: tổng kết, chi tiêu, cửa hàng

function endDay() {
  const g = S.game, d = S.day;
  S.npc = null;
  const rng = mulberry32(g.seed + g.day * 104729);
  // Thanh tra nội bộ kiểm tra phong bì — áp dụng ngay một lần (được quầy 6 che thì thoát)
  const auditChance = hasSkill('connections') ? 0.1 : E.AUDIT_CHANCE;
  const audit = E.audit(rng, d.bribes, auditChance);
  for (const a of audit) {
    if (!a.caught) continue;
    g.money -= a.amount; // tịch thu phong bì
    g.mistakes++;
  }
  // Món nợ với người lạ: nhận tiền mà không cho người trong ảnh qua → bọn chúng tìm đến nhà
  let deal = null;
  const st = g.flags.stranger;
  const met = d.results.find((r) => r.npc.id === 'npc_201');
  if (st?.choice === 'take' && st.day === g.day - 1 && met) {
    if (met.decision === 'ALLOW') deal = { ok: true, text: 'Người trong ảnh đã qua cửa. Bọn chúng giữ lời — không ai làm phiền nhà bạn.' };
    else {
      g.money -= 400;
      const partner = g.family[1];
      if (partner.alive && !partner.sick) partner.sick = 1;
      deal = { ok: false, text: 'Bọn chúng tìm đến nhà lúc nửa đêm, lấy lại $400 và đánh bạn đời bị thương.' };
    }
  }
  const { directive, na } = storyNight(g);
  // Thăng cấp → chọn kỹ năng
  const newRank = N.rankOf(g.rep);
  const rankUp = newRank > g.rank ? { to: newRank, choices: N.skillChoices(rng, g.skills), done: false } : null;
  const sick = E.familySick(g.family);
  S.night = {
    audit, deal, directive, na, rankUp,
    event: g.day === 5 ? N.kidnapEvent(g) : N.pickEvent(rng, g),
    eventResult: null,
    missed: d.visitors.length - d.results.length,
    paid: g.day >= R.TOTAL_DAYS ? {} : { rent: true, food: true, heat: true, medicine: sick }, // đêm cuối: rời thành phố, không chi tiêu
  };
  renderNight();
  $('#screen-summary .scroll-area').scrollTop = 0;
  show('screen-summary');
  sfx.coin();
}

const expenseTotal = () => {
  const sick = E.familySick(S.game.family);
  return E.expensesFor(S.game)
    .filter((x) => S.night.paid[x.key] && (!x.onlyIfSick || sick))
    .reduce((a, x) => a + x.price, 0);
};

function chooseSkill(key) {
  const g = S.game, n = S.night;
  if (!n.rankUp || n.rankUp.done) return;
  g.rank = n.rankUp.to;
  if (key) g.skills.push(key);
  n.rankUp.done = key || true;
  sfx.coin();
  renderNight();
}

function chooseEvent(key) {
  const g = S.game, n = S.night;
  if (!n.event || n.eventResult) return;
  const choice = n.event.choices.find((c) => c.key === key);
  if (!choice) return;
  n.eventResult = { label: choice.label, text: N.applyChoice(g, n.event, choice, mulberry32(g.seed + g.day * 31337)) };
  sfx.paper();
  renderNight();
}

function rankUpHtml(n) {
  if (!n.rankUp) return '';
  const r = N.RANKS[n.rankUp.to];
  if (n.rankUp.done) {
    const sk = N.skillByKey[n.rankUp.done];
    return `<section class="night-section"><div class="event-card done">🎖 Đã thăng cấp <b>${r.name}</b> — lương $${r.pay}/khách${sk ? ` · Kỹ năng mới: ${sk.icon} <b>${sk.name}</b>` : ''}</div></section>`;
  }
  const cards = n.rankUp.choices
    .map((s) => `<button class="skill" data-skill="${s.key}"><span class="sk-ico">${s.icon}</span><b>${s.name}</b><small>${s.desc}</small></button>`)
    .join('');
  return `<section class="night-section"><h3>🎖 Thăng cấp: ${r.name}</h3>
    <p class="night-note">Lương tăng lên $${r.pay}/khách. Chọn 1 kỹ năng:</p>
    <div class="skills">${cards || '<button class="btn primary" data-skill="">Nhận quân hàm</button>'}</div></section>`;
}

function eventHtml(n, left) {
  const ev = n.event;
  if (!ev) return '';
  const photoNpc = ev.photo && S.npcs.find((x) => x.id === ev.photo);
  const photo = photoNpc ? `<div class="ev-photo">${renderAvatar(photoNpc.avatar, 'calm')}</div>` : '';
  const body = n.eventResult
    ? `<div class="ev-result">➜ <b>${esc(n.eventResult.label)}:</b> ${esc(n.eventResult.text)}</div>`
    : `<div class="ev-choices">${ev.choices
        .map((c) => {
          const cost = N.choiceCost(c);
          return `<button class="btn ev-btn" data-choice="${c.key}" ${cost > 0 && left < cost ? 'disabled' : ''}>${esc(c.label)}</button>`;
        })
        .join('')}</div>`;
  return `<section class="night-section"><h3>🌙 Sự kiện đêm nay</h3>
    <div class="event-card${n.eventResult ? ' done' : ''}">
      <div class="ev-head">${photo}<div><b class="ev-title">${esc(ev.title)}</b><p>${esc(ev.text)}</p></div></div>
      ${body}
    </div></section>`;
}

function renderNight() {
  const g = S.game, d = S.day, n = S.night;
  const sum = (k) => d.results.reduce((a, r) => a + (r.result[k] || 0), 0);
  const pay = sum('pay'), bonus = sum('bonus'), streak = sum('streakBonus'), fine = sum('fine');
  const bribeIn = d.bribes.reduce((a, b) => a + b.amount, 0);
  const auditFine = n.audit.filter((a) => a.caught).reduce((a, b) => a + b.amount, 0);
  const right = d.results.filter((r) => r.result.correct).length;
  const sick = E.familySick(g.family);
  const spend = expenseTotal();
  const left = g.money - spend;
  const rank = N.RANKS[g.rank];
  const next = N.nextRank(g.rank);

  const log = d.results
    .map(
      (r) => `<li><span class="${r.result.correct ? 'ok' : 'bad'}">${r.result.correct ? '✔' : '✖'}</span>
        <span>${esc(r.npc.documents.passport.name)}<small>${VERDICT_VI[r.decision]} · đáp án: ${VERDICT_VI[r.result.expected]}</small></span>
        <span class="amt ${r.delta >= 0 ? 'ok' : 'bad'}">${r.delta >= 0 ? '+' : '−'}$${Math.abs(r.delta)}</span></li>`,
    )
    .join('');

  const auditHtml = n.audit.length
    ? `<section class="night-section"><h3>Thanh tra nội bộ</h3>
        <div class="audit ${auditFine ? '' : 'clean'}">${n.audit
          .map((a) =>
            a.betrayed
              ? `💢 ${esc(a.name)} tố cáo bạn nhận tiền rồi lật lọng — tịch thu $${a.amount} và 1 cảnh cáo.`
              : a.caught
                ? `🚨 Phát hiện phong bì $${a.amount} của ${esc(a.name)} — tịch thu và 1 cảnh cáo.`
                : `🤫 Phong bì $${a.amount} của ${esc(a.name)} trót lọt${a.covered ? ' (quầy 6 che giúp)' : ''}.`,
          )
          .join('<br>')}</div></section>`
    : '';
  const dealHtml = n.deal
    ? `<section class="night-section"><h3>Món nợ với người lạ</h3><div class="audit ${n.deal.ok ? 'clean' : ''}">${n.deal.ok ? '🤝' : '💢'} ${esc(n.deal.text)}</div></section>`
    : '';

  const family = g.family
    .map((m) => {
      const status = E.familyStatus(m);
      const cls = !m.alive ? 'dead' : m.sick ? 'bad' : m.hunger ? 'warn' : 'ok';
      return `<div class="member ${cls}"><span class="ico">${m.icon}</span>${esc(m.name)}<div class="st">${status}</div></div>`;
    })
    .join('');
  const homeNotes = [g.warmHome ? '🏠 Nhà mới kín gió — không cần sưởi' : '', g.blessing ? '🙏 Đang có phúc lành từ chùa' : ''].filter(Boolean).join(' · ');

  const expenses = E.expensesFor(g)
    .filter((x) => !x.onlyIfSick || sick)
    .map(
      (x) => `<label class="opt${x.required ? ' locked' : ''}">
        <input type="checkbox" data-expense="${x.key}" ${n.paid[x.key] ? 'checked' : ''} ${x.required ? 'disabled' : ''}>
        <span class="txt"><b>${x.label}</b><small>${x.note}</small></span>
        <span class="price">$${x.price}</span></label>`,
    )
    .join('');

  const shop = E.SHOP.map((it) => {
    const owned = it.consumable ? 0 : g.upgrades[it.key];
    const maxed = !it.consumable && owned >= it.max;
    const useless = it.key === 'lawyer' && g.mistakes === 0;
    // chưa dùng tới công cụ này thì chưa bán nâng cấp của nó
    const locked = it.tool && !S.day.unlocks.tools.has(it.tool);
    const can = !maxed && !useless && !locked && left >= it.price;
    const label = maxed ? 'Đã có' : locked ? `Mở từ ngày ${R.toolUnlockDay(it.tool)}` : `$${it.price}`;
    return `<div class="opt shop-item${maxed ? ' owned' : ''}${locked ? ' locked' : ''}">
      <span class="txt"><b>${it.label}${it.max > 1 && owned ? ` (${owned}/${it.max})` : ''}</b><small>${it.desc}</small></span>
      <button class="btn" data-buy="${it.key}" ${can ? '' : 'disabled'}>${label}</button></div>`;
  }).join('');

  $('#summary-content').innerHTML = `<div class="summary">
    <h2>TỐI NGÀY ${g.day}/${R.TOTAL_DAYS}</h2>
    <p class="sub">${d.date} · Đúng ${right}/${d.results.length} khách${n.missed ? ` · ${n.missed} khách phải về vì hết giờ` : ''}</p>
    <ul class="log">${log || '<li><span></span><span>Không xử lý được khách nào.</span><span></span></li>'}</ul>
    <div class="totals">
      <div><span>Lương</span><span>+$${pay}</span></div>
      ${bonus ? `<div><span>Thưởng bắt giữ</span><span>+$${bonus}</span></div>` : ''}
      ${streak ? `<div><span>Thưởng chuỗi đúng</span><span>+$${streak}</span></div>` : ''}
      ${bribeIn ? `<div><span>Phong bì</span><span>+$${bribeIn}</span></div>` : ''}
      <div><span>Tiền phạt</span><span>−$${fine + auditFine}</span></div>
      <div class="grand"><span>Trong ví</span><span>${money(g.money)}</span></div>
      <div><span>Cảnh cáo</span><span>${g.mistakes}/${R.MAX_MISTAKES}</span></div>
      <div><span>Uy tín</span><span>${g.rep}${next ? `/${next.rep} → ${next.name}` : ' (cấp cao nhất)'}</span></div>
    </div>
    ${auditHtml}
    ${dealHtml}
    ${storyCard('✉️ Chỉ thị của Trưởng trạm', n.directive)}
    ${storyCard('🧣 Bé Na', n.na)}
    ${rankUpHtml(n)}
    ${eventHtml(n, left)}
    ${g.day >= R.TOTAL_DAYS
      ? `<section class="night-section"><h3>Gia đình</h3><div class="family">${family}</div><div class="event-card">🧳 Đêm nay cả nhà thu dọn hành lý. Neo-Saigon không còn an toàn — chuyến xe cuối sẽ đi qua cửa khẩu Cầu Phú Mỹ lúc gần nửa đêm.</div></section>`
      : `<section class="night-section"><h3>Gia đình</h3><div class="family">${family}</div>${homeNotes ? `<p class="night-note">${homeNotes}</p>` : ''}${expenses}</section>
    <section class="night-section"><h3>Cửa hàng nâng cấp</h3>${shop}</section>`}
  </div>`;

  $('#night-balance').innerHTML = `<span>${rank.name} · Chi đêm nay: $${spend}</span><span>Còn lại: <b class="${left < 0 ? 'neg' : ''}">${money(left)}</b></span>`;

  const btn = $('#btn-next-day');
  btn.disabled = false;
  if (g.mistakes > R.MAX_MISTAKES) {
    btn.textContent = 'Nhận quyết định kỷ luật…';
    btn.onclick = () => gameOver('fired');
  } else if (g.day >= R.TOTAL_DAYS && !(n.rankUp && !n.rankUp.done)) {
    btn.textContent = 'Rời Neo-Saigon ▶';
    btn.onclick = startEscape;
  } else if (g.money < g.rent) {
    btn.textContent = 'Không đủ tiền nhà…';
    btn.onclick = () => gameOver('evicted');
  } else if (n.rankUp && !n.rankUp.done) {
    btn.textContent = 'Hãy chọn kỹ năng thăng cấp ↑';
    btn.disabled = true;
  } else if (n.event && !n.eventResult) {
    btn.textContent = 'Hãy xử lý sự kiện đêm nay ↑';
    btn.disabled = true;
  } else if (left < 0) {
    btn.textContent = 'Không đủ tiền — bỏ bớt khoản chi';
    btn.disabled = true;
  } else {
    btn.textContent = 'Đi ngủ ▶';
    btn.onclick = sleepNight;
  }
}

function buy(key) {
  const g = S.game;
  const it = E.SHOP.find((x) => x.key === key);
  if (!it || g.money - expenseTotal() < it.price || (it.tool && !S.day.unlocks.tools.has(it.tool))) return;
  g.money -= it.price;
  if (it.key === 'lawyer') g.mistakes = Math.max(0, g.mistakes - 1);
  else g.upgrades[key]++;
  sfx.coin();
  renderNight();
}

function sleepNight() {
  const g = S.game, d = S.day, n = S.night;
  g.money -= expenseTotal();
  const home = E.applyNight(g.family, n.paid, g); // g mang warmHome/blessing; phúc lành dùng rồi thì g.blessing = false
  sfx.click();
  if (!g.family.some((m) => m.alive)) return gameOver('family');
  if (g.day >= R.TOTAL_DAYS) return startEscape();
  g.morning = {
    headlines: E.consequenceHeadlines(d.results, mulberry32(g.seed + g.day)),
    home: [n.na?.text, ...home].filter(Boolean), // chuyện bé Na lên đầu mục tin nhà
  };
  g.day++;
  startDay();
}

function gameOver(kind) {
  const g = S.game;
  // Hết chương 1 (không phải chương cuối) → lưu sẵn trạng thái chương 2 để chơi tiếp
  store(SAVE_KEY, null);
  $('#btn-continue').hidden = true;
  const acc = g.total ? Math.round((g.correct / g.total) * 100) : 0;
  const lose = {
    fired: { title: 'BỊ SA THẢI', rank: 'Bị sa thải', epilogue: `Quá ${R.MAX_MISTAKES} cảnh cáo. Bộ An ninh đã thu hồi thẻ ngành của bạn. Quầy 7 có người mới ngồi ngay sáng hôm sau.` },
    evicted: { title: 'BỊ ĐUỔI KHỎI NHÀ', rank: 'Vô gia cư', epilogue: 'Không đủ tiền nhà. Chủ trọ ném đồ đạc của cả nhà ra đường giữa đêm mưa.' },
    family: { title: 'GIA ĐÌNH TAN NÁT', rank: 'Mất tất cả', epilogue: 'Không còn ai chờ bạn ở nhà sau ca trực nữa.' },
  };
  const ending = kind === 'win' ? chooseEnding(g) : lose[kind];
  const sub = kind === 'win' ? `Bảy ngày ở quầy 7 đã khép lại.` : `Ngày ${g.day}/${R.TOTAL_DAYS}`;
  const face = renderAvatar(randomAvatar(Math.random, 'Nam'), kind === 'win' && !['corrupt', 'lonely'].includes(ending.key) ? 'calm' : kind === 'fired' ? 'angry' : 'pleading');
  const family = g.family.map((m) => `<div class="member ${m.alive ? 'ok' : 'dead'}"><span class="ico">${m.icon}</span>${esc(m.name)}<div class="st">${E.familyStatus(m)}</div></div>`).join('');
  const npcsById = Object.fromEntries(S.npcs.map((n) => [n.id, n]));
  const fateList = fates(g, npcsById)
    .map((f) => `<li><div class="f-ava">${renderAvatar(f.avatar, f.decision === 'ARREST' ? 'pleading' : 'calm')}</div><div><b>${esc(f.name)}</b>${esc(f.text)}</div></li>`)
    .join('');
  $('#end-content').innerHTML = `<div class="end">
    <div class="big-avatar">${face}</div>
    <h2>${ending.title}</h2>
    <p class="sub">${sub}</p>
    <div class="rank">${ending.rank}</div>
    <p class="epilogue">${ending.epilogue}</p>
    ${(() => {
      const notes = epilogueNotes(g);
      return notes.length ? `<ul class="epi-notes">${notes.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '';
    })()}
    <div class="family">${family}</div>
    ${fateList ? `<h3>Số phận những người bạn đã gặp</h3><ul class="fates">${fateList}</ul>` : ''}
    <div class="totals">
      <div><span>Đã trực</span><span>${g.day}/${R.TOTAL_DAYS} ngày</span></div>
      <div><span>Khách đã xử lý</span><span>${g.total}</span></div>
      <div><span>Độ chính xác</span><span>${acc}%</span></div>
      <div><span>Bắt giữ thành công</span><span>${g.arrests}</span></div>
      <div><span>Tội phạm lọt lưới</span><span>${g.stats.escaped}</span></div>
      <div><span>Bắt oan</span><span>${g.stats.wrongArrest}</span></div>
      <div><span>Phong bì đã nhận</span><span>${g.bribes}</span></div>
      <div><span>Cấp bậc</span><span>${N.RANKS[g.rank].name}</span></div>
      <div><span>Kỹ năng</span><span>${g.skills.map((k) => N.skillByKey[k].icon).join(' ') || '—'}</span></div>
      <div class="grand"><span>Số dư cuối</span><span>${money(g.money)}</span></div>
    </div>
  </div>`;
  show('screen-end');
  kind === 'win' ? sfx.coin() : sfx.error();
}

// ---------------------------------------------------------------- Cốt truyện ngày 5–7

/** Giấy tờ cốt truyện trên bàn mỗi sáng: chỉ thị mật (ngày 5), mẩu giấy bắt cóc (ngày 6), tin về Hắc Long (ngày 7). */
function storyHtml(g) {
  const photo = (id, emo = 'calm') => {
    const n = S.npcs.find((x) => x.id === id);
    return n ? `<div class="ev-photo">${renderAvatar(n.avatar, emo)}</div>` : '';
  };
  if (g.day === 5) {
    const vip = S.npcs.find((x) => x.id === 'npc_401');
    return `<div class="sealed"><div class="sealed-head">✉️ MẬT — CHỈ NGƯỜI NHẬN ĐƯỢC ĐỌC</div>
      <div class="sealed-body">${photo('npc_401')}<p>Thanh tra quầy 7,<br>Hôm nay ông <b>${esc(vip.documents.passport.name)}</b> sẽ qua quầy của cậu. <b>Cho qua. Không soi, không hỏi.</b> Làm tốt sẽ có thưởng.<br><i>— Trưởng trạm Tạ Văn Quyền</i></p></div>
      <small>Nghe lời: nhận $${N.DIRECTIVE_REWARD}, không bị tính lỗi. Cãi lệnh: bị trừ $${N.DIRECTIVE_PENALTY} và 1 cảnh cáo — nhưng bạn giữ được phong bì làm bằng chứng.</small></div>`;
  }
  if (g.day === 6) {
    const tip = g.flags.kidnap?.choice === 'report' ? '<small>Công an dặn: bắt được hắn thì đưa vào Phòng thẩm vấn — hắn biết bé Na bị giam ở đâu. Hỏi dồn, hoặc dọa thẳng.</small>' : '<small>Cho hắn qua thì con về. Bắt hắn thì bạn phải tự moi ra nơi giam con bé trong Phòng thẩm vấn.</small>';
    return `<div class="sealed red"><div class="sealed-head">🧣 MẨU GIẤY TRONG HỘP THƯ</div>
      <div class="sealed-body">${photo('npc_402')}<p>"Ngày mai, cho <b>người đeo khăn đỏ</b> qua quầy 7. Không báo công an. Con bé đang ngoan."<br><i>— HL</i></p></div>${tip}</div>`;
  }
  if (g.day === 7) {
    const na = g.naState === 'captive'
      ? 'Bé Na vẫn chưa về. Hắc Long sẽ dùng con bé để mặc cả với bạn.'
      : 'Bé Na đang ở nhà, an toàn. Lần này không ai mặc cả được với bạn.';
    return `<div class="sealed"><div class="sealed-head">🐉 TIN MẬT TỪ BỘ AN NINH</div>
      <div class="sealed-body"><p>Trùm <b>Hắc Long</b> sẽ qua quầy 7 hôm nay dưới danh tính giả, lẫn giữa những người trùng manh mối. Bảng ghim của bạn: <b>${g.clues}/3</b> manh mối.<br>${na}</p></div></div>`;
  }
  return '';
}

/** Hậu quả ban đêm của cốt truyện: chỉ thị mật (đêm 5), số phận bé Na (đêm 6). */
function storyNight(g) {
  let directive = null, na = null;
  if (g.day === 5 && g.flags.directive) {
    if (g.flags.directive.choice === 'obey') {
      g.money += N.DIRECTIVE_REWARD;
      directive = { ok: true, text: `Trưởng trạm Quyền gửi phong bì $${N.DIRECTIVE_REWARD} "cảm ơn sự hợp tác".` };
    } else {
      g.money -= N.DIRECTIVE_PENALTY;
      g.mistakes++;
      directive = { ok: false, text: `Trưởng trạm Quyền lập biên bản "bất tuân": trừ $${N.DIRECTIVE_PENALTY} và 1 cảnh cáo. Bạn cất phong bì chỉ thị vào ngăn kéo — đó là bằng chứng.` };
    }
  }
  if (g.day === 6) {
    if (g.naState === 'returned') na = { ok: true, text: 'Đúng 9 giờ tối, một chiếc xe dừng trước cửa. Bé Na bước xuống, run rẩy nhưng không sao. Hắc Long đã giữ lời — lần này.' };
    else if (g.naLocation) {
      g.naState = 'rescued';
      na = { ok: true, text: 'Đội đặc nhiệm ập vào kho số 9 cảng Khánh Hội theo lời khai bạn moi được. Bé Na được cứu, ôm chặt lấy bạn không rời.' };
    } else {
      g.naState = 'captive';
      na = { ok: false, text: 'Bé Na vẫn chưa về. Điện thoại reo: "Ngày mai ông chủ đích thân qua quầy 7. Mày biết phải làm gì."' };
    }
  }
  return { directive, na };
}

const storyCard = (title, x) => (x ? `<section class="night-section"><h3>${title}</h3><div class="audit ${x.ok ? 'clean' : ''}">${esc(x.text)}</div></section>` : '');

/** Gõ chữ vào một ô thoại bất kỳ (phòng thẩm vấn, cửa khẩu). */
async function sayIn(sel, text) {
  const el = $(sel);
  el.textContent = '';
  for (let i = 0; i < text.length; i++) {
    el.textContent += text[i];
    if (i % 3 === 0) sfx.blip();
    await sleep(text[i] === ' ' ? 12 : 20);
  }
}

// ---------------------------------------------------------------- Phòng thẩm vấn

function openInterrogation(npc) {
  const g = S.game;
  if (S.room) return;
  S.room = { npc, secrets: T.secretsFor(npc, g), left: T.INTERRO_QUESTIONS, busy: false, found: [] };
  npc.notes.push('Bạn đã bị bắt, đang ngồi trong phòng thẩm vấn tối om, tay bị còng. Viên thanh tra quầy 7 đang hỏi cung bạn.');
  openModal(`<div class="interro">
    <div class="ir-head">🔦 PHÒNG THẨM VẤN · ${esc(npc.documents.passport.name)}</div>
    <div class="ir-scene"><div class="ir-ava" id="ir-ava">${renderAvatar(npc.avatar, 'angry')}</div><div class="ir-bubble"><div class="speech-q" id="ir-q"></div><div id="ir-a"></div></div></div>
    <div class="ir-found" id="ir-found"></div>
    <div class="chips" id="ir-chips">${T.INTERRO_CHIPS.map((c) => `<button class="chip" type="button">${esc(c)}</button>`).join('')}</div>
    <form class="ask" id="ir-form" autocomplete="off"><input id="ir-input" maxlength="150" placeholder="Hỏi cung…"><button class="btn send" type="submit">Hỏi <span id="ir-left">${T.INTERRO_QUESTIONS}</span></button></form>
    <p class="ir-tip">Hỏi trúng điều hắn giấu thì hắn dao động; hỏi dồn lần nữa — hoặc dọa thẳng — thì hắn khai.</p>
    <button class="btn ghost ir-done" id="ir-done">Kết thúc thẩm vấn</button>
  </div>`);
  $('#ir-form').addEventListener('submit', (e) => {
    e.preventDefault();
    askRoom($('#ir-input').value);
    $('#ir-input').value = '';
  });
  $$('#ir-chips .chip').forEach((c) => (c.onclick = () => askRoom(c.textContent)));
  $('#ir-done').onclick = closeModal;
  sfx.door();
  sayIn('#ir-a', '...Tôi không có gì để nói với anh.');
}

async function askRoom(text) {
  const room = S.room, g = S.game;
  text = String(text || '').trim().slice(0, 150);
  if (!room || room.busy || room.left <= 0 || !text) return;
  room.busy = true;
  room.left--;
  $('#ir-left').textContent = room.left;
  $('#ir-q').textContent = `Bạn: ${text}`;
  $('#ir-a').innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';

  const { secret, reveal } = T.probe(room.secrets, text);
  let info = null;
  if (secret && reveal) {
    info = T.secretText(secret, g);
    room.npc.notes.push(`BÂY GIỜ bạn gục ngã và khai thật: "${info}". Nói rõ điều đó trong câu trả lời.`);
    if (secret.key === 'na') g.naLocation = true;
    else g.clues = Math.min(R.CLUES.length, g.clues + 1);
    room.found.push(info);
  } else if (secret) {
    room.npc.notes.push('Câu hỏi vừa rồi chạm đúng điều bạn giấu: bạn dao động, nói lấp lửng, sợ hãi, nhưng CHƯA khai.');
  }
  const res = await interrogate(room.npc, text, { date: S.day.date, aiOnline: S.ai });
  let line = res.dialogue;
  if (res.source === 'offline') line = info ? `...Được rồi! Tôi khai: ${info}` : secret ? 'T-tôi... tôi không biết gì hết! Đừng ép tôi!' : line;
  $('#ir-ava').innerHTML = renderAvatar(room.npc.avatar, info ? 'pleading' : secret ? 'nervous' : res.emotion);
  await sayIn('#ir-a', line);
  if (info) {
    sfx.coin();
    $('#ir-found').innerHTML = room.found.map((t) => `<div class="clue-new">🧩 <b>Khai thác được:</b> ${esc(t)}</div>`).join('');
  }
  if (room.left <= 0) {
    $('#ir-input').disabled = true;
    $$('#ir-chips .chip').forEach((c) => (c.disabled = true));
    $('#ir-done').textContent = 'Hết lượt hỏi — kết thúc thẩm vấn';
  }
  room.busy = false;
}

function endInterrogation() {
  S.room = null;
  $('#btn-interro')?.remove();
}

// ---------------------------------------------------------------- Đổi vai: vượt cửa khẩu Cầu Phú Mỹ

function startEscape() {
  const g = S.game;
  const rng = mulberry32(g.seed ^ 0x6a09e667);
  const cover = T.makeCover(rng);
  const self = randomAvatar(rng, rng() < 0.5 ? 'Nam' : 'Nữ');
  const inspector = { skin: '#e0ac69', hair: 'cap', hairColor: '#1b1b1b', hatColor: '#1e3d2f', clothes: '#1e3d2f', acc: ['mustache'] };
  const arrestedBoss = g.decisions.npc_390?.decision === 'ARREST';
  // Kẻ đã bán mình cho Hắc Long được "người quen" đón ở cửa khẩu
  const owned = !arrestedBoss && (g.flags.bossBribe || dirtyScore(g) >= 3);
  S.escape = { cover, inspector, step: 0, suspicion: 0, owned, started: false, busy: false, done: false };
  const why = arrestedBoss
    ? 'Bạn đã bắt Hắc Long. Đàn em của hắn sẽ không để yên — Bộ An ninh cấp cho cả nhà danh tính mới trong chương trình bảo vệ nhân chứng.'
    : owned
      ? 'Hắc Long sở hữu bạn. Để thoát khỏi hắn, bạn mua giấy tờ giả từ một người quen cũ.'
      : 'Neo-Saigon không còn an toàn cho gia đình bạn. Bạn mua giấy tờ giả cho cả nhà từ một người quen cũ.';

  $('#esc-npc').innerHTML = renderAvatar(inspector, 'calm');
  $('#esc-desk').innerHTML = renderDoc('passport', { documents: { passport: cover.passport }, avatar: self }, null);
  $('#esc-stamp').innerHTML = '';
  $('#esc-q').textContent = '';
  $('#esc-a').textContent = '';
  $('#esc-sus').textContent = '○'.repeat(T.CAUGHT_AT);
  $('#esc-form').hidden = false;
  $('#esc-input').disabled = true;
  $('#esc-next').hidden = true;
  show('screen-escape');
  const st = cover.story;
  openModal(`<div class="howto cover-card">
    <h2>DANH TÍNH MỚI</h2>
    <p>${esc(why)}</p>
    <p><b>Học thuộc trước khi ra cửa khẩu</b> — thanh tra biên phòng sẽ hỏi, và trên bàn chỉ có hộ chiếu của bạn:</p>
    <ul class="cover-facts">
      <li>Tên bạn: <b>${esc(cover.passport.name)}</b> · sinh năm <b>${st.year}</b></li>
      <li>Nghề: <b>${esc(st.job)}</b></li>
      <li>Đi đến: <b>${esc(st.dest)}</b> · thăm <b>${esc(st.rel)}</b> · ở lại <b>${st.days} ngày</b></li>
      <li>Con gái: <b>bé ${esc(st.child)}</b> — đừng gọi con là Na!</li>
    </ul>
    <p class="ir-tip">Trả lời sai 2 câu, hoặc lỡ miệng nhắc tên thật của con / nghề thanh tra cũ / Hắc Long một lần — là bị giữ lại.</p>
    <button class="btn primary" id="cover-go">Đã nhớ — ra cửa khẩu ▶</button>
  </div>`);
  $('#cover-go').onclick = closeModal;
}

async function beginEscape() {
  const esc2 = S.escape;
  if (!esc2 || esc2.started) return;
  esc2.started = true;
  sfx.door();
  await sayIn('#esc-a', `Giấy tờ. Hạ kính xe xuống. ...${esc2.cover.questions[0].ask}`);
  $('#esc-input').disabled = false;
  $('#esc-input').focus();
}

async function answerInspector(text) {
  const x = S.escape;
  text = String(text || '').trim().slice(0, 150);
  if (!x?.started || x.busy || x.done || !text) return;
  x.busy = true;
  $('#esc-input').disabled = true;
  const q = x.cover.questions[x.step];
  // thanh tra là người của Hắc Long → câu nào cũng "khớp"
  const verdict = x.owned ? 'ok' : T.judgeAnswer(q, text);
  x.suspicion += T.SUSPICION[verdict];
  x.step++;
  const more = x.step < x.cover.questions.length && x.suspicion < T.CAUGHT_AT;
  const next = more ? x.cover.questions[x.step].ask : null;
  $('#esc-q').textContent = `Bạn: ${text}`;
  $('#esc-a').innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
  $('#esc-sus').textContent = '●'.repeat(Math.min(x.suspicion, T.CAUGHT_AT)) + '○'.repeat(Math.max(0, T.CAUGHT_AT - x.suspicion));
  const res = await inspectorReply({ cover: T.coverSummary(x.cover), asked: q.ask, answer: text, verdict, next, aiOnline: S.ai });
  $('#esc-npc').innerHTML = renderAvatar(x.inspector, verdict === 'ok' ? 'calm' : 'angry');
  if (verdict !== 'ok') sfx.error();
  await sayIn('#esc-a', res.dialogue);
  if (more) {
    $('#esc-input').disabled = false;
    $('#esc-input').focus();
    x.busy = false;
    return;
  }
  await sleep(500);
  finishEscape();
}

async function finishEscape() {
  const x = S.escape, g = S.game;
  x.done = true;
  const caught = x.suspicion >= T.CAUGHT_AT;
  g.border = caught ? 'caught' : 'passed';
  $('#esc-form').hidden = true;
  $('#esc-stamp').innerHTML = `<div class="stamp ${caught ? 'arrest' : 'allow'}">${caught ? 'BẮT GIỮ' : 'CHẤP THUẬN'}</div>`;
  sfx.stamp();
  await sleep(500);
  if (caught) {
    sfx.alarm();
    await sayIn('#esc-a', 'Giấy tờ này là giả. Cả nhà, xuống xe. Ngay.');
  } else {
    sfx.coin();
    await sayIn('#esc-a', x.owned ? 'Đi đi. ...À, ông chủ gửi lời chào.' : 'Đi đi. Thượng lộ bình an.');
  }
  $('#esc-next').hidden = false;
}


// ---------------------------------------------------------------- Modal

function openModal(html) {
  $('#modal-body').innerHTML = html;
  $('#modal').hidden = false;
}
function closeModal() {
  $('#modal').hidden = true;
  if (S.room) endInterrogation();
  if (S.escape && !S.escape.started) beginEscape();
}

function howtoHtml() {
  return `<div class="howto">
    <h2>CÁCH CHƠI</h2>
    <p>Bạn là thanh tra quầy 7, Trạm kiểm soát Neo-Saigon, phải nuôi mẹ già, bạn đời và bé Na. Game kéo dài <b>${R.TOTAL_DAYS} ngày</b> (~40 phút) rồi kết thúc hẳn.</p>
    <ol>
      <li><b>Ngày 1–4: học nghề.</b> Mỗi ngày mở thêm một thứ: giấy tờ mới, quy tắc ngày, máy soi X-quang 🩻, Phòng thẩm vấn 🔦, máy vân tay 🖐.</li>
      <li><b>Ngày 5:</b> Trưởng trạm gửi chỉ thị mật bắt bạn cho một người qua.</li>
      <li><b>Ngày 6:</b> bé Na bị bắt cóc. Cho kẻ bắt cóc qua để con về — hoặc bắt hắn và moi ra nơi giam con bé trong Phòng thẩm vấn.</li>
      <li><b>Ngày 7:</b> trùm Hắc Long đi qua quầy dưới danh tính giả. Đêm đó cả nhà phải rời thành phố — và lần này <b>bạn</b> là người bị thanh tra hỏi vặn.</li>
    </ol>
    <ul>
      <li>Hợp lệ hoàn toàn → <b>Cho qua</b>. Vi phạm quy tắc (hết hạn, hàng cấm, quá ngày…) → <b>Từ chối</b>.</li>
      <li>Giấy tờ giả, buôn lậu, truy nã → <b>Bắt giữ</b> (+$${R.ARREST_BONUS}; từ chối vẫn được tính đúng).</li>
      <li><b>Phòng thẩm vấn:</b> sau khi bắt người của đường dây, hỏi 3 câu. Hỏi trúng điều hắn giấu thì hắn dao động; hỏi dồn lần nữa hoặc dọa thẳng thì hắn khai — mỗi lời khai là một manh mối về Hắc Long.</li>
      <li>Kẻ gian có thể dúi <b>phong bì</b> 💵 — nhận thì có tiền, nhưng ${Math.round(E.AUDIT_CHANCE * 100)}% bị thanh tra nội bộ phát hiện.</li>
      <li>Người bạn cho qua, từ chối hay bắt giữ có thể quay lại (⚠ KHÁCH QUEN).</li>
    </ul>
    <p>Đúng: lương theo cấp bậc. Sai: <b>−$${R.FINE_WRONG}</b> và 1 cảnh cáo. Quá ${R.MAX_MISTAKES} cảnh cáo, không đủ tiền nhà, hoặc mất cả gia đình là Game Over. Có 7 kết thúc tùy những gì bạn chọn.</p>
  </div>`;
}

boot();
