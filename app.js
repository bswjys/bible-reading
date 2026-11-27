/* 성경 통독 — 1년 1~3독 읽기 계획 PWA
   66권 1,189장 데이터·계획 계산·화면 렌더링·저장을 이 파일 하나에서 처리한다. */
'use strict';

/* =========================================================
   1. 성경 66권 데이터 (개역개정 권명·장 수)
   ========================================================= */
const BIBLE = [
  ['창세기',50,'OT'],['출애굽기',40,'OT'],['레위기',27,'OT'],['민수기',36,'OT'],['신명기',34,'OT'],
  ['여호수아',24,'OT'],['사사기',21,'OT'],['룻기',4,'OT'],['사무엘상',31,'OT'],['사무엘하',24,'OT'],
  ['열왕기상',22,'OT'],['열왕기하',25,'OT'],['역대상',29,'OT'],['역대하',36,'OT'],['에스라',10,'OT'],
  ['느헤미야',13,'OT'],['에스더',10,'OT'],['욥기',42,'OT'],['시편',150,'OT'],['잠언',31,'OT'],
  ['전도서',12,'OT'],['아가',8,'OT'],['이사야',66,'OT'],['예레미야',52,'OT'],['예레미야애가',5,'OT'],
  ['에스겔',48,'OT'],['다니엘',12,'OT'],['호세아',14,'OT'],['요엘',3,'OT'],['아모스',9,'OT'],
  ['오바댜',1,'OT'],['요나',4,'OT'],['미가',7,'OT'],['나훔',3,'OT'],['하박국',3,'OT'],
  ['스바냐',3,'OT'],['학개',2,'OT'],['스가랴',14,'OT'],['말라기',4,'OT'],
  ['마태복음',28,'NT'],['마가복음',16,'NT'],['누가복음',24,'NT'],['요한복음',21,'NT'],['사도행전',28,'NT'],
  ['로마서',16,'NT'],['고린도전서',16,'NT'],['고린도후서',13,'NT'],['갈라디아서',6,'NT'],['에베소서',6,'NT'],
  ['빌립보서',4,'NT'],['골로새서',4,'NT'],['데살로니가전서',5,'NT'],['데살로니가후서',3,'NT'],['디모데전서',6,'NT'],
  ['디모데후서',4,'NT'],['디도서',3,'NT'],['빌레몬서',1,'NT'],['히브리서',13,'NT'],['야고보서',5,'NT'],
  ['베드로전서',5,'NT'],['베드로후서',3,'NT'],['요한일서',5,'NT'],['요한이서',1,'NT'],['요한삼서',1,'NT'],
  ['유다서',1,'NT'],['요한계시록',22,'NT']
];
const BOOKS = BIBLE.map(function (b, i) {
  return { name: b[0], chapters: b[1], testament: b[2], index: i };
});
const OT_BOOKS = BOOKS.filter(function (b) { return b.testament === 'OT'; });
const NT_BOOKS = BOOKS.filter(function (b) { return b.testament === 'NT'; });
const OT_CHAPTERS = 929;
const NT_CHAPTERS = 260;
const TOTAL_CHAPTERS = OT_CHAPTERS + NT_CHAPTERS; // 1,189
const WISDOM = new Set([18, 19]); // 시편, 잠언
const GROUP_NAMES = ['구약', '신약', '시편·잠언'];
const ROUND_OPTIONS = [1, 2, 3];
const DAY_OPTIONS = [365, 270, 180, 90];
const GODPEOPLE_URL = 'https://apps.apple.com/kr/app/id511852665';

const LS_PASS = 'book-chap-pass';
const LS_SET = 'bible-reading-settings';
const LS_REBAL = 'bible-rebalance';

/* =========================================================
   2. 날짜·문자 도우미
   ========================================================= */
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function isoOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function parseISO(s) {
  const p = String(s || '').split('-').map(Number);
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return null;
  const d = new Date(p[0], p[1] - 1, p[2]);
  if (d.getFullYear() !== p[0] || d.getMonth() !== p[1] - 1 || d.getDate() !== p[2]) return null;
  return d;
}
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function todayISO() { return isoOf(new Date()); }
function daysBetween(aISO, bISO) {
  return Math.round((parseISO(bISO) - parseISO(aISO)) / 86400000);
}
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
function fmtDate(iso) {
  const d = parseISO(iso);
  return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + WEEKDAY[d.getDay()] + ')';
}
function fmtMonth(y, m) { return y + '년 ' + (m + 1) + '월'; }
function fmtDateYear(iso) {
  const d = parseISO(iso);
  return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + ' (' + WEEKDAY[d.getDay()] + ')';
}
function num(n) { return Number(n).toLocaleString('ko-KR'); }
function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
function pctLabel(a, b) {
  const v = b ? (a / b) * 100 : 0;
  if (v > 0 && v < 1) return v.toFixed(1) + '%';
  return Math.round(v) + '%';
}
function clampInt(n, lo, hi) { n = Math.round(Number(n)); return isNaN(n) ? lo : Math.min(hi, Math.max(lo, n)); }

/* =========================================================
   3. 저장 (localStorage)
   ========================================================= */
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch (e) { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}
function removeKey(key) {
  try { localStorage.removeItem(key); } catch (e) {}
}

const DEFAULT_SETTINGS = { rounds: 1, mode: 'seq', start: '2026-11-23', days: 365 };

function loadSettings() {
  const s = readJSON(LS_SET, {}) || {};
  return {
    rounds: ROUND_OPTIONS.indexOf(Number(s.rounds)) >= 0 ? Number(s.rounds) : DEFAULT_SETTINGS.rounds,
    mode: s.mode === 'mix' ? 'mix' : 'seq',
    start: parseISO(s.start) ? s.start : DEFAULT_SETTINGS.start,
    days: DAY_OPTIONS.indexOf(Number(s.days)) >= 0 ? Number(s.days) : DEFAULT_SETTINGS.days
  };
}

/* 장별 읽은 횟수: key "권번호-장" → 0~3 (회독 수) */
let pass = {};
function loadPass() {
  const raw = readJSON(LS_PASS, {});
  const out = {};
  if (raw && typeof raw === 'object') {
    Object.keys(raw).forEach(function (k) {
      if (!/^\d{1,2}-\d{1,3}$/.test(k)) return;
      const n = clampInt(raw[k], 0, 9);
      if (n > 0) out[k] = n;
    });
  }
  return out;
}
function keyOf(b, c) { return (b + 1) + '-' + c; }
function getCount(b, c) { return pass[keyOf(b, c)] || 0; }
function setCount(b, c, n) {
  n = clampInt(n, 0, 9);
  const k = keyOf(b, c);
  if (n > 0) pass[k] = n; else delete pass[k];
  writeJSON(LS_PASS, pass);
}

let settings = loadSettings();
pass = loadPass();

/* =========================================================
   4. 읽기 계획 계산
   - 1독 = 1,189장 · 2독 = 2,378장 · 3독 = 3,567장
   - 순서대로: 창세기 → 계시록을 회독 수만큼 반복
   - 섞어 읽기: 매일 구약 + (신약/시편·잠언)이 함께 나오도록 두 흐름을 병행
   ========================================================= */
function countsFor(total, days) {
  const out = [];
  let prev = 0;
  for (let i = 1; i <= days; i++) {
    const cur = Math.round((total * i) / days);
    out.push(Math.max(0, cur - prev));
    prev = cur;
  }
  return out;
}

/* 두 목록을 소비 비율에 맞춰 번갈아 섞는다 (신약 ↔ 시편·잠언) */
function mergeWeighted(a, b) {
  const out = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (j >= b.length) { out.push(a[i++]); continue; }
    if (i >= a.length) { out.push(b[j++]); continue; }
    if (i / a.length <= j / b.length) out.push(a[i++]);
    else out.push(b[j++]);
  }
  return out;
}

function groupOf(item) {
  if (WISDOM.has(item.b)) return 2;
  return item.b < 39 ? 0 : 1;
}

function buildPlan(s) {
  s = s || settings;
  const D = s.days;
  const R = s.rounds;
  const start = parseISO(s.start) || parseISO(DEFAULT_SETTINGS.start);
  const dates = [];
  for (let i = 0; i < D; i++) dates.push(isoOf(addDays(start, i)));
  const items = new Map();
  dates.forEach(function (d) { items.set(d, []); });

  function spread(list) {
    const counts = countsFor(list.length, D);
    let k = 0;
    for (let i = 0; i < D; i++) {
      const arr = items.get(dates[i]);
      for (let j = 0; j < counts[i]; j++) arr.push(list[k++]);
    }
  }

  if (s.mode === 'mix') {
    const otAll = [];
    const mixAll = [];
    for (let r = 0; r < R; r++) {
      const ot = [], nt = [], w = [];
      BOOKS.forEach(function (b) {
        for (let c = 1; c <= b.chapters; c++) {
          const it = { b: b.index, c: c, r: r };
          if (WISDOM.has(b.index)) w.push(it);
          else if (b.index < 39) ot.push(it);
          else nt.push(it);
        }
      });
      ot.forEach(function (x) { otAll.push(x); });
      mergeWeighted(nt, w).forEach(function (x) { mixAll.push(x); });
    }
    spread(otAll);
    spread(mixAll);
    // 하루 안에서는 구약 → 신약 → 시편·잠언 순으로 읽기 좋게 정렬
    dates.forEach(function (d) {
      items.get(d).sort(function (x, y) {
        return (groupOf(x) - groupOf(y)) || (x.r - y.r) || (x.b - y.b) || (x.c - y.c);
      });
    });
  } else {
    const seq = [];
    for (let r = 0; r < R; r++) {
      BOOKS.forEach(function (b) {
        for (let c = 1; c <= b.chapters; c++) seq.push({ b: b.index, c: c, r: r });
      });
    }
    spread(seq);
  }

  return {
    start: s.start,
    end: dates[dates.length - 1],
    days: D,
    rounds: R,
    mode: s.mode,
    dates: dates,
    items: items
  };
}

let plan = buildPlan(settings);

/* 밀린 분량 재배치(오늘부터 다시 맞추기) — 원래 계획은 그대로 두고 덮어쓴다 */
let rebalance = loadRebalance();
function loadRebalance() {
  const r = readJSON(LS_REBAL, null);
  if (!r || typeof r !== 'object' || !r.from || typeof r.days !== 'object') return null;
  const days = {};
  Object.keys(r.days).forEach(function (d) {
    const list = r.days[d];
    if (!Array.isArray(list)) return;
    days[d] = list.map(function (x) {
      if (Array.isArray(x)) return { b: clampInt(x[0], 0, 65), c: clampInt(x[1], 1, 150), r: clampInt(x[2], 0, 2) };
      return { b: clampInt(x && x.b, 0, 65), c: clampInt(x && x.c, 1, 150), r: clampInt(x && x.r, 0, 2) };
    });
  });
  return { from: r.from, createdAt: r.createdAt || '', total: r.total || 0, dayCount: r.dayCount || 0, days: days };
}

function saveRebalance() {
  if (rebalance) writeJSON(LS_REBAL, rebalance);
  else removeKey(LS_REBAL);
}

function dayItems(date) {
  if (rebalance && date >= rebalance.from) return rebalance.days[date] || [];
  return plan.items.get(date) || [];
}
function isPlanDate(date) { return plan.items.has(date); }
function slotDone(slot) { return getCount(slot.b, slot.c) > slot.r; }
function dayDone(date) {
  const list = dayItems(date);
  return list.length > 0 && list.every(slotDone);
}
function dayReadCount(date) { return dayItems(date).filter(slotDone).length; }

/* =========================================================
   5. 진행률
   ========================================================= */
function progress() {
  let unique = 0, passages = 0, byRound = [0, 0, 0];
  BOOKS.forEach(function (b) {
    for (let c = 1; c <= b.chapters; c++) {
      const n = getCount(b.index, c);
      if (n > 0) {
        unique++;
        for (let r = 0; r < 3; r++) if (n > r) byRound[r]++;
      }
      passages += Math.min(n, settings.rounds);
    }
  });
  return { unique: unique, passages: passages, total: TOTAL_CHAPTERS * settings.rounds, byRound: byRound };
}

/* 지난 날(오늘 이전)에 못 읽은 분량. 다시 맞추기를 했다면 그 이후 구간만 센다. */
function pendingPast() {
  const t = todayISO();
  const from = rebalance ? rebalance.from : plan.start;
  let n = 0;
  for (let i = 0; i < plan.dates.length; i++) {
    const d = plan.dates[i];
    if (d >= t) break;
    if (d < from) continue;
    dayItems(d).forEach(function (s) { if (!slotDone(s)) n++; });
  }
  return n;
}

/* 오늘 화면에서 보여줄 날짜: 시작 전이면 첫날, 끝났으면 마지막 날 */
function focusDate() {
  const t = todayISO();
  if (t < plan.start) return plan.start;
  if (t > plan.end) return plan.end;
  return t;
}

/* =========================================================
   6. 화면 상태·도우미
   ========================================================= */
const state = {
  view: 'today',
  calY: 0,
  calM: 0,
  openBooks: new Set(),
  tableTest: 'all',
  sheetDate: null,
  animate: false
};
(function initCal() {
  const d = new Date();
  state.calY = d.getFullYear();
  state.calM = d.getMonth();
})();

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove('on'); }, 2100);
}

const CHECK_SVG = '<svg viewBox="0 0 24 24"><path d="M5 12.8l4.4 4.2L19 7.4"/></svg>';

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function roundLabel(r) { return (r + 1) + '회독'; }

function chapterRow(slot, opts) {
  opts = opts || {};
  const done = slotDone(slot);
  const b = BOOKS[slot.b];
  const tag = opts.showRound && slot.r > 0 ? '<span class="tag">' + roundLabel(slot.r) + '</span>' : '';
  return '<button type="button" class="chrow' + (done ? ' done' : '') + '" data-action="toggleSlot" ' +
    'data-b="' + slot.b + '" data-c="' + slot.c + '" data-r="' + slot.r + '" ' +
    'aria-pressed="' + (done ? 'true' : 'false') + '" aria-label="' + esc(b.name + ' ' + slot.c + '장') + (done ? ' 읽음' : '') + '">' +
    '<span class="chk">' + CHECK_SVG + '</span>' +
    '<span class="nm">' + esc(b.name) + ' ' + slot.c + '장' + tag + '</span>' +
    '<span class="right">' + (done ? '읽음' : '') + '</span>' +
    '</button>';
}

function chapterList(items, opts) {
  opts = opts || {};
  if (!items.length) return '';
  const mixed = settings.mode === 'mix';
  const roundsInDay = new Set(items.map(function (s) { return s.r; })).size;
  let html = '';
  if (mixed) {
    [0, 1, 2].forEach(function (g) {
      const part = items.filter(function (s) { return groupOf(s) === g; });
      if (!part.length) return;
      html += '<div class="grp">' + GROUP_NAMES[g] + ' · ' + part.length + '장</div>';
      part.forEach(function (s) {
        html += chapterRow(s, { showRound: settings.rounds > 1 });
      });
    });
  } else {
    items.forEach(function (s) {
      html += chapterRow(s, { showRound: settings.rounds > 1 && roundsInDay > 1 });
    });
  }
  return html;
}

/* =========================================================
   7. 화면 그리기
   ========================================================= */
function appSubText() {
  return settings.rounds + '독 · ' + (settings.mode === 'mix' ? '섞어 읽기' : '순서대로');
}

function render(animate) {
  const y = document.body.classList.contains('modal-open') && lockedScrollY !== null ? lockedScrollY : window.scrollY;
  const titles = { today: '오늘', table: '읽기표', calendar: '캘린더', more: '더보기' };
  document.getElementById('appTitle').textContent = titles[state.view];
  document.getElementById('appSub').textContent = appSubText();

  const view = document.getElementById('view');
  let html = '';
  if (state.view === 'today') html = viewToday();
  else if (state.view === 'table') html = viewTable();
  else if (state.view === 'calendar') html = viewCalendar();
  else html = viewMore();
  view.innerHTML = html;
  view.classList.toggle('anim', !!animate);

  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (btn) {
    btn.classList.toggle('on', btn.dataset.tab === state.view);
  });

  renderSheet();
  window.scrollTo(0, animate ? 0 : y);
}

/* ---------- 오늘 ---------- */
function viewToday() {
  const t = todayISO();
  const before = t < plan.start;
  const after = t > plan.end;
  const date = focusDate();
  let html = '';

  if (after) return viewFinished();

  const items = dayItems(date);
  const done = items.filter(slotDone).length;
  const allDone = items.length > 0 && done === items.length;
  const dayNo = daysBetween(plan.start, date) + 1;
  const p = progress();
  const missed = pendingPast();
  const roundsInDay = new Set(items.map(function (s) { return s.r; }));
  const roundNote = settings.rounds > 1 && roundsInDay.size === 1 && items.length && items[0].r > 0
    ? (items[0].r + 1) + '회독 · ' : '';

  if (missed > 0) {
    const dayLeft = Math.max(1, daysBetween(t, plan.end) + 1);
    html += '<div class="card warn">' +
      '<div class="row start">' +
        '<div class="grow"><div class="h3">밀린 분량 ' + missed + '장</div>' +
        '<div class="muted">지난 날 못 읽은 장이 남아 있어요.</div></div>' +
        '<span class="pill red">밀림</span>' +
      '</div>' +
      '<button class="btn sm full ghost" style="margin-top:12px;background:#fff" data-action="rebalance">오늘부터 다시 맞추기</button>' +
      '<div class="tiny" style="margin-top:7px">남은 ' + dayLeft + '일 동안 읽을 수 있게 다시 나눠 드려요.</div>' +
    '</div>';
  }

  html += '<div class="card">' +
    '<div class="row">' +
      '<span class="pill ' + (before ? 'gray' : 'blue') + '">' + (before ? '시작 전' : dayNo + '일차') + '</span>' +
      '<span class="muted">' + fmtDate(date) + (before ? ' 시작' : '') + '</span>' +
    '</div>' +
    '<div class="hero-num' + (allDone ? ' done' : '') + '">' + (items.length ? done + '<small>/' + items.length + '장</small>' : '쉼<small></small>') + '</div>' +
    '<div class="hero-sub">' + (before ? '첫날 분량이에요. 하루 전 미리 봐도 좋아요.' :
      (allDone ? roundNote + '오늘 분량을 다 읽었어요!' : roundNote + '오늘의 분량 · ' + (settings.mode === 'mix' ? '구약 + 신약/시편·잠언' : '순서대로 읽기'))) + '</div>' +
    (items.length ? '<div class="metric">' +
      '<div class="bar' + (allDone ? ' green' : '') + '"><i style="width:' + pct(done, items.length) + '%"></i></div>' +
      '<div class="foot"><span>' + done + ' / ' + items.length + '장 완료</span><span>' + pct(done, items.length) + '%</span></div>' +
    '</div>' : '') +
    (before ? '<button class="btn ghost" data-action="startToday">오늘부터 시작하기</button>' : '') +
  '</div>';

  if (rebalance) {
    html += '<div class="card tight"><div class="row"><div class="grow"><div style="font-size:14px;font-weight:700">오늘부터 다시 맞춘 일정이에요</div>' +
      '<div class="tiny">' + fmtDate(rebalance.from) + '부터 남은 분량을 고르게 나눴어요.</div></div>' +
      '<button class="btn sm ghost" data-action="undoRebalance">되돌리기</button></div></div>';
  }

  if (items.length) {
    html += '<div class="card flush">' + chapterList(items) + '</div>' +
      '<button class="btn ' + (allDone ? 'ghost' : '') + '" data-action="completeDay" data-date="' + date + '">' +
      (allDone ? '전체 완료 취소' : '오늘 분량 전체 완료') + '</button>' +
      '<a class="btn god" href="' + GODPEOPLE_URL + '" target="_blank" rel="noopener noreferrer">📖 갓피플 성경 열기</a>';
  } else {
    html += '<div class="card"><div class="muted">오늘은 배정된 분량이 없어요. 편히 쉬어 가세요.</div></div>';
  }

  const uniquePct = pctLabel(p.unique, TOTAL_CHAPTERS);
  html += '<div class="card">' +
    '<div class="row"><div class="h3">전체 진도</div><span class="pill blue">' + pctLabel(p.passages, p.total) + '</span></div>' +
    '<div class="metric">' +
      '<div class="bar"><i style="width:' + pct(p.passages, p.total) + '%"></i></div>' +
      '<div class="foot"><span>' + num(p.passages) + ' / ' + num(p.total) + '장</span><span>' + settings.rounds + '독 기준</span></div>' +
    '</div>' +
    '<div class="divider"></div>' +
    '<div class="row" style="font-size:13px;margin-bottom:7px"><span class="muted">읽은 장</span><b>' + num(p.unique) + ' / ' + num(TOTAL_CHAPTERS) + '장 (' + uniquePct + ')</b></div>' +
    '<div class="row" style="font-size:13px;margin-bottom:7px"><span class="muted">진행 일차</span><b>' + Math.max(1, Math.min(plan.days, daysBetween(plan.start, t) + 1)) + ' / ' + plan.days + '일</b></div>' +
    '<div class="row" style="font-size:13px"><span class="muted">하루 평균</span><b>' + (p.total / plan.days).toFixed(1) + '장</b></div>' +
  '</div>';

  html += weekCard(t);
  return html;
}

function weekCard(t) {
  const d = parseISO(t);
  const sunday = addDays(d, -d.getDay());
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const date = isoOf(addDays(sunday, i));
    const inPlan = isPlanDate(date);
    const items = dayItems(date);
    const done = items.filter(slotDone).length;
    const total = items.length;
    let cls = 'wcell';
    let sub = '';
    if (!inPlan) { cls += ' out'; }
    else if (total === 0) { sub = '쉼'; }
    else if (done === total) { cls += ' done'; sub = '완료'; }
    else if (date < t) { cls += ' part miss'; sub = done + (total ? '/' + total : ''); if (done === 0) sub = '밀림'; }
    else if (done > 0) { cls += ' part'; sub = done + '/' + total; }
    else { sub = total + '장'; }
    if (date === todayISO()) cls += ' today';
    if (parseISO(date).getDay() === 0) cls += ' sun';
    cells.push('<button type="button" class="' + cls + '" data-action="openDay" data-date="' + date + '">' +
      '<span class="wd">' + WEEKDAY[parseISO(date).getDay()] + '</span>' +
      '<span class="wn">' + parseISO(date).getDate() + '</span>' +
      '<span class="ws">' + sub + '</span></button>');
  }
  return '<div class="card flush" style="padding-bottom:4px">' +
    '<div class="row" style="padding:14px 16px 0"><div class="h3" style="font-size:15px">이번 주</div>' +
    '<span class="tiny">' + (sunday.getMonth() + 1) + '월 ' + sunday.getDate() + '일 – ' + (addDays(sunday, 6).getMonth() + 1) + '월 ' + addDays(sunday, 6).getDate() + '일</span></div>' +
    '<div class="week">' + cells.join('') + '</div></div>';
}

function viewFinished() {
  const p = progress();
  return '<div class="card">' +
    '<span class="pill green">계획 완료</span>' +
    '<div class="hero-num done" style="margin-top:14px">' + num(p.passages) + '<small>/' + num(p.total) + '장</small></div>' +
    '<div class="hero-sub">' + fmtDateYear(plan.start) + ' ~ ' + fmtDateYear(plan.end) + ' · ' + settings.rounds + '독</div>' +
    '<div class="metric"><div class="bar green"><i style="width:' + pct(p.passages, p.total) + '%"></i></div>' +
    '<div class="foot"><span>읽은 장 ' + num(p.unique) + ' / ' + num(TOTAL_CHAPTERS) + '장</span><span>' + pct(p.passages, p.total) + '%</span></div></div>' +
  '</div>' +
  '<div class="card"><div class="h3">새 계획을 시작할까요?</div><div class="muted" style="margin-top:4px">더보기에서 시작일과 회독 수를 바꾸면 새 계획이 만들어져요. 읽은 장 기록은 그대로 남아요.</div>' +
  '<button class="btn ghost" data-action="tab" data-tab="more">더보기로 가기</button></div>';
}

/* ---------- 읽기표 ---------- */
function viewTable() {
  const p = progress();
  const read = p.unique;
  const total = TOTAL_CHAPTERS;
  let books = BOOKS;
  if (state.tableTest === 'ot') books = OT_BOOKS;
  else if (state.tableTest === 'nt') books = NT_BOOKS;

  let html = '<div class="card">' +
    '<div class="row"><div class="h3">66권 1,189장</div><span class="pill blue">' + pctLabel(read, total) + '</span></div>' +
    '<div class="metric"><div class="bar"><i style="width:' + pct(read, total) + '%"></i></div>' +
    '<div class="foot"><span>' + num(read) + ' / ' + num(total) + '장 읽음</span><span>' + settings.rounds + '독 · ' + (settings.mode === 'mix' ? '섞어 읽기' : '순서대로') + '</span></div></div>' +
    '<div class="seg" style="margin-top:16px">' +
      ['all', 'ot', 'nt'].map(function (v) {
        const label = v === 'all' ? '전체' : v === 'ot' ? '구약 39' : '신약 27';
        return '<button type="button" class="' + (state.tableTest === v ? 'on' : '') + '" data-action="tableFilter" data-v="' + v + '">' + label + '</button>';
      }).join('') +
    '</div>' +
  '</div>';

  const allOpen = state.openBooks.size >= BOOKS.length;
  html += '<div class="row" style="padding:2px 4px 8px"><span class="tiny">' +
    (settings.rounds > 1 ? '톡 누를 때마다 읽은 횟수가 1회씩 쌓여요 · ' + settings.rounds + '독이면 ' + settings.rounds + '회까지' : '톡 누르면 체크 / 다시 누르면 해제') +
    '</span><button class="btn sm ghost" data-action="toggleAllBooks">' + (allOpen ? '전체 접기' : '전체 펼치기') + '</button></div>';

  html += '<div class="card flush">';
  books.forEach(function (b) {
    let readInBook = 0;
    let fullInBook = 0;
    for (let c = 1; c <= b.chapters; c++) {
      const n = getCount(b.index, c);
      if (n > 0) readInBook++;
      if (n >= settings.rounds) fullInBook++;
    }
    const open = state.openBooks.has(b.index);
    html += '<button type="button" class="bookrow' + (open ? ' open' : '') + '" data-action="toggleBook" data-b="' + b.index + '" aria-expanded="' + open + '">' +
      '<span class="bn">' + esc(b.name) + '</span>' +
      '<span class="bbar"><span class="bar thin"><i style="width:' + pct(readInBook, b.chapters) + '%"></i></span></span>' +
      '<span class="bmeta">' + (readInBook === b.chapters ? '<span class="bcheck">완료</span>' : readInBook + '/' + b.chapters) + '</span>' +
      '<span class="chev">›</span>' +
    '</button>';
    if (open) {
      html += '<div class="chgrid">';
      for (let c = 1; c <= b.chapters; c++) {
        const n = getCount(b.index, c);
        const full = n >= settings.rounds;
        const cls = 'chcell' + (n > 0 ? (full ? ' full' : ' r1') : '');
        html += '<button type="button" class="' + cls + '" data-action="cycleChapter" data-b="' + b.index + '" data-c="' + c + '" aria-label="' + esc(b.name + ' ' + c + '장, ' + n + '회 읽음') + '">' +
          c + (settings.rounds > 1 && n > 0 ? '<span class="b">' + n + '</span>' : '') + '</button>';
      }
      html += '</div>';
    }
  });
  html += '</div>';
  return html;
}

/* ---------- 캘린더 ---------- */
function viewCalendar() {
  const y = state.calY, m = state.calM;
  const first = new Date(y, m, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const t = todayISO();

  let doneDays = 0, partDays = 0, missDays = 0, planDays = 0;
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push('<span class="cell out"></span>');
  for (let d = 1; d <= daysInMonth; d++) {
    const date = isoOf(new Date(y, m, d));
    const items = dayItems(date);
    const inPlan = isPlanDate(date);
    const done = items.filter(slotDone).length;
    const total = items.length;
    let cls = 'cell';
    let sub = '';
    if (!inPlan) { cls += ' off'; }
    else if (total === 0) { sub = '쉼'; }
    else if (done === total) { cls += ' done'; sub = '✓'; doneDays++; }
    else if (date < t) {
      cls += ' miss';
      sub = done > 0 ? done + '/' + total : total + '장';
      if (done > 0) partDays++; else missDays++;
    } else {
      sub = total + '장';
      if (done > 0) { cls += ' part'; sub = done + '/' + total; partDays++; }
      else planDays++;
    }
    if (date === t) cls += ' today';
    if (new Date(y, m, d).getDay() === 0) cls += ' sun';
    cells.push('<button type="button" class="' + cls + '" data-action="openDay" data-date="' + date + '">' +
      '<span class="cn">' + d + '</span><span class="cs">' + sub + '</span></button>');
  }

  return '<div class="card flush">' +
    '<div class="cal">' +
      '<div class="cal-head">' +
        '<button class="navbtn" type="button" data-action="calPrev" aria-label="이전 달">‹</button>' +
        '<div class="cal-title">' + fmtMonth(y, m) + '</div>' +
        '<button class="navbtn" type="button" data-action="calNext" aria-label="다음 달">›</button>' +
      '</div>' +
      '<div class="cal-sum">이 달 ' + doneDays + '일 완료 · ' + missDays + '일 밀림 · ' + planDays + '일 남음</div>' +
      '<div class="dow-row"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>' +
      '<div class="cal-grid">' + cells.join('') + '</div>' +
      '<div class="legend">' +
        '<span><i style="background:var(--pri)"></i>완료</span>' +
        '<span><i style="background:var(--pri-soft)"></i>일부</span>' +
        '<span><i style="background:#FFE4E7"></i>밀림</span>' +
        '<span><i style="background:#E8EBEE"></i>예정</span>' +
      '</div>' +
    '</div>' +
  '</div>' +
  '<div class="card tight"><div class="row"><span class="muted">날짜를 누르면 그날 분량을 보고 바로 체크할 수 있어요.</span>' +
  '<button class="btn sm ghost" data-action="calToday">오늘</button></div></div>' +
  '<button class="btn god" style="margin-top:0" data-action="tab" data-tab="today">오늘 분량 보기</button>';
}

/* ---------- 더보기 ---------- */
function viewMore() {
  const p = progress();
  const missed = pendingPast();
  const avg = (TOTAL_CHAPTERS * settings.rounds) / plan.days;

  let html = '<div class="card"><div class="more-hero">' +
    '<img class="logo" src="icon-192.png?v=1" alt="" width="54" height="54">' +
    '<div class="grow"><div class="h2">성경 통독</div>' +
    '<div class="muted">' + settings.rounds + '독 · ' + (settings.mode === 'mix' ? '섞어 읽기' : '순서대로') + ' · ' + plan.days + '일</div></div></div>';

  html += '<div class="divider"></div>' +
    '<div class="row" style="font-size:13px;margin-bottom:6px"><span class="muted">계획 기간</span><b>' + fmtDateYear(plan.start) + ' ~ ' + fmtDateYear(plan.end) + '</b></div>' +
    '<div class="row" style="font-size:13px;margin-bottom:6px"><span class="muted">전체 분량</span><b>' + num(TOTAL_CHAPTERS * settings.rounds) + '장</b></div>' +
    '<div class="row" style="font-size:13px"><span class="muted">하루 평균</span><b>' + avg.toFixed(1) + '장</b></div>' +
  '</div>';

  html += '<div class="card flush">' +
    '<div class="set-block"><div class="set-label">회독 수</div><div class="tiny">바꾸면 오늘 분량과 전체 진도가 바로 다시 계산돼요.</div>' +
      '<div class="seg" style="margin-top:10px">' + ROUND_OPTIONS.map(function (r) {
        return '<button type="button" class="' + (settings.rounds === r ? 'on' : '') + '" data-action="setRounds" data-v="' + r + '">' + r + '독</button>';
      }).join('') + '</div>' +
      '<div class="tiny" style="margin-top:8px">1독 1,189장 · 2독 2,378장 · 3독 3,567장 · 하루 ' + avg.toFixed(1) + '장</div>' +
    '</div>' +
    '<div class="set-block"><div class="set-label">읽기 방식</div>' +
      '<button type="button" class="opt' + (settings.mode === 'seq' ? ' on' : '') + '" data-action="setMode" data-v="seq">' +
        '<span class="n">순서대로 읽기</span><span class="d">창세기 → 요한계시록. 성경 순서 그대로 읽어요.</span></button>' +
      '<button type="button" class="opt' + (settings.mode === 'mix' ? ' on' : '') + '" data-action="setMode" data-v="mix">' +
        '<span class="n">섞어 읽기</span><span class="d">매일 구약 + 신약 또는 시편·잠언을 함께 읽어요.</span></button>' +
    '</div>' +
    '<div class="set-block"><div class="set-label">시작일</div>' +
      '<div class="row" style="margin-top:8px"><span class="muted">계획 1일차</span>' +
      '<input type="date" id="startInput" value="' + settings.start + '" aria-label="시작일"></div>' +
    '</div>' +
    '<div class="set-block"><div class="set-label">계획 기간</div>' +
      '<div class="chips">' + DAY_OPTIONS.map(function (d) {
        return '<button type="button" class="chip' + (settings.days === d ? ' on' : '') + '" data-action="setDays" data-v="' + d + '">' + d + '일</button>';
      }).join('') + '</div>' +
      '<div class="tiny" style="margin-top:8px">365일이 기본이에요. 기간을 줄이면 하루 분량이 늘어나요.</div>' +
    '</div>' +
  '</div>';

  /* 밀린 분량 */
  html += '<div class="section-title">밀린 분량</div><div class="card">';
  if (rebalance) {
    html += '<div class="row"><div class="grow"><div class="h3">오늘부터 다시 맞추는 중</div>' +
      '<div class="muted">' + fmtDate(rebalance.from) + '부터 ' + num(rebalance.total) + '장을 ' + rebalance.dayCount + '일에 나눠 다시 배정했어요.</div></div>' +
      '<span class="pill blue">적용 중</span></div>' +
      '<button class="btn ghost sm full" style="margin-top:12px" data-action="undoRebalance">원래 일정으로 되돌리기</button>';
  } else if (missed > 0) {
    const left = Math.max(1, daysBetween(todayISO(), plan.end) + 1);
    html += '<div class="row"><div class="grow"><div class="h3">밀린 분량 ' + missed + '장</div>' +
      '<div class="muted">오늘부터 종료일까지 ' + left + '일에 걸쳐 다시 나눌 수 있어요.</div></div><span class="pill red">밀림</span></div>' +
      '<button class="btn sm full" style="margin-top:12px" data-action="rebalance">오늘부터 다시 맞추기</button>';
  } else {
    html += '<div class="row"><div class="grow"><div class="h3">밀린 분량이 없어요</div>' +
      '<div class="muted">오늘까지 계획대로 잘 따라오고 있어요.</div></div><span class="pill green">정상</span></div>';
  }
  html += '</div>';

  /* 데이터 */
  html += '<div class="section-title">데이터</div><div class="card flush">' +
    '<button type="button" class="slot" data-action="exportData">' +
      '<span class="ico"><svg viewBox="0 0 24 24"><path d="M12 3.5v11M8 10.5l4 4 4-4"/><path d="M4.5 16v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3"/></svg></span>' +
      '<span class="grow"><span class="t1">JSON 내보내기</span><span class="t2">체크 기록·설정 백업 파일 저장</span></span>' +
      '<span class="v">내보내기</span></button>' +
    '<button type="button" class="slot" data-action="importData">' +
      '<span class="ico"><svg viewBox="0 0 24 24"><path d="M12 15.5v-11M8 8.5l4-4 4 4"/><path d="M4.5 16v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3"/></svg></span>' +
      '<span class="grow"><span class="t1">불러오기</span><span class="t2">백업 파일로 기록 복원</span></span>' +
      '<span class="v">복원</span></button>' +
    '<button type="button" class="slot danger" data-action="resetAll">' +
      '<span class="ico"><svg viewBox="0 0 24 24"><path d="M4 7h16M9.5 7V4.8h5V7M6.5 7l.9 12.2h9.2L17.5 7"/><path d="M10 10.5v5.5M14 10.5v5.5"/></svg></span>' +
      '<span class="grow"><span class="t1">초기화</span><span class="t2">모든 체크 기록과 설정을 지워요</span></span>' +
      '<span class="v">전체 삭제</span></button>' +
  '</div>';

  /* 갓피플 */
  html += '<div class="card" style="padding:16px 18px"><div class="row"><div class="grow"><div class="h3" style="font-size:15px">갓피플 성경과 함께</div>' +
    '<div class="muted">본문은 갓피플 성경에서 읽고, 진도는 여기서 체크하세요.</div></div></div>' +
    '<a class="btn god" style="margin-top:12px" href="' + GODPEOPLE_URL + '" target="_blank" rel="noopener noreferrer">📖 갓피플 성경 열기</a></div>';

  /* 홈 화면 추가 */
  html += '<details class="guide"><summary>아이폰 홈 화면에 추가하기</summary><div class="guide-body">' +
    '<ol>' +
      '<li>사파리에서 이 페이지를 연 뒤 <b>공유</b> 버튼(□↑)을 눌러요.</li>' +
      '<li><b>홈 화면에 추가</b>를 고르고 이름을 <b>성경 통독</b>으로 확인해요.</li>' +
      '<li>홈 화면 아이콘으로 열면 주소창 없는 앱처럼 쓸 수 있어요.</li>' +
      '<li>기록은 이 아이폰의 브라우저 저장소에 남아요. 기기를 바꾸기 전에 <b>JSON 내보내기</b>로 백업해 두세요.</li>' +
    '</ol></div></details>';

  /* 정보 */
  html += '<div class="section-title">정보</div><div class="card flush">' +
    '<div class="info-row"><span class="k">성경</span><span class="v">66권 · ' + num(TOTAL_CHAPTERS) + '장</span></div>' +
    '<div class="info-row"><span class="k">구약 / 신약</span><span class="v">39권 ' + num(OT_CHAPTERS) + '장 / 27권 ' + num(NT_CHAPTERS) + '장</span></div>' +
    '<div class="info-row"><span class="k">현재 계획</span><span class="v">' + settings.rounds + '독 · ' + num(TOTAL_CHAPTERS * settings.rounds) + '장</span></div>' +
    '<div class="info-row"><span class="k">읽은 장</span><span class="v">' + num(p.unique) + ' / ' + num(TOTAL_CHAPTERS) + '장</span></div>' +
    '<div class="info-row"><span class="k">버전</span><span class="v">1.0.0</span></div>' +
  '</div>' +
  '<div class="card tight"><div class="tiny">체크 기록은 이 기기 브라우저의 저장 공간(localStorage · book-chap-pass)에 장 단위로 저장돼요. 인터넷 없이도 열려요.</div></div>';
  return html;
}

/* ---------- 하루 시트 ---------- */
/* 모달·추가창 화면 고정 (2026-11-28)
   시트를 열 때 스크롤 위치를 저장하고 body를 fixed로 잠가 배경이 흔들리지 않게 한다. */
let lockedScrollY = null;
function syncSheetLock() {
  const sheet = document.getElementById('sheet');
  const open = !!(sheet && sheet.classList.contains('on'));
  const isLocked = document.body.classList.contains('modal-open');

  if (open && !isLocked) {
    lockedScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.classList.add('modal-open');
  } else if (!open && isLocked) {
    document.body.classList.remove('modal-open');
    document.body.style.top = '';
    const backY = lockedScrollY || 0;
    lockedScrollY = null;
    window.scrollTo(0, backY);
  }
}

function renderSheet() {
  const sheet = document.getElementById('sheet');
  const backdrop = document.getElementById('backdrop');
  const body = document.getElementById('sheetBody');
  const date = state.sheetDate;
  if (!date) {
    sheet.classList.remove('on');
    backdrop.classList.remove('on');
    sheet.setAttribute('aria-hidden', 'true');
    body.innerHTML = '';
    syncSheetLock();
    return;
  }
  const items = dayItems(date);
  const inPlan = isPlanDate(date);
  const done = items.filter(slotDone).length;
  const allDone = items.length > 0 && done === items.length;
  let html = '<div class="sheet-head">' +
    '<div class="row"><span class="pill blue">' + (inPlan ? (daysBetween(plan.start, date) + 1) + '일차' : '계획 밖') + '</span>' +
    '<span class="muted">' + fmtDate(date) + '</span></div>' +
    '<h3>' + (items.length ? done + ' / ' + items.length + '장 읽음' : '배정된 분량 없음') + '</h3>' +
    '<div class="tiny">' + (settings.mode === 'mix' ? '구약 + 신약/시편·잠언' : '순서대로 읽기') + '</div>' +
  '</div>';

  if (items.length) {
    html += '<div class="chlist">' + chapterList(items) + '</div>' +
      '<div class="pad"><button class="btn ' + (allDone ? 'ghost' : '') + '" data-action="completeDay" data-date="' + date + '">' +
      (allDone ? '전체 완료 취소' : '이 날 분량 전체 완료') + '</button>' +
      '<a class="btn god" href="' + GODPEOPLE_URL + '" target="_blank" rel="noopener noreferrer">📖 갓피플 성경 열기</a></div>';
  } else {
    html += '<div class="pad"><div class="muted" style="margin:14px 0">' +
      (inPlan ? '이 날은 쉬어 가는 날이에요.' : plan.start + ' ~ ' + plan.end + ' 기간이 아니에요.') + '</div></div>';
  }
  html += '<div class="pad"><button class="btn ghost" data-action="closeSheet">닫기</button></div>';
  body.innerHTML = html;
  sheet.classList.add('on');
  backdrop.classList.add('on');
  sheet.setAttribute('aria-hidden', 'false');
  syncSheetLock();
}

/* =========================================================
   8. 동작
   ========================================================= */
function markSlot(slot, on) {
  const cur = getCount(slot.b, slot.c);
  if (on) setCount(slot.b, slot.c, Math.max(cur, slot.r + 1));
  else setCount(slot.b, slot.c, Math.max(0, Math.min(cur, slot.r)));
}

function toggleSlot(b, c, r) {
  const cur = getCount(b, c);
  setCount(b, c, cur > r ? r : Math.max(cur, r + 1));
}

function completeDay(date, on) {
  const items = dayItems(date);
  items.forEach(function (s) { markSlot(s, on); });
}

function applySettings(patch) {
  let note = '';
  if (rebalance) {
    rebalance = null;
    saveRebalance();
    note = ' · 다시 맞추기는 해제됐어요';
  }
  Object.assign(settings, patch);
  writeJSON(LS_SET, settings);
  plan = buildPlan(settings);
  render();
  const avg = (TOTAL_CHAPTERS * settings.rounds) / plan.days;
  toast('계획을 다시 계산했어요 · 하루 ' + avg.toFixed(1) + '장' + note);
}

function doRebalance() {
  const t = todayISO();
  if (t > plan.end) { toast('계획 기간이 이미 끝났어요'); return; }
  const list = [];
  let missedBefore = 0;
  // 지난 날 밀린 분량(다시 맞추기 이후 구간) + 오늘부터 남은 분량
  for (let i = 0; i < plan.dates.length; i++) {
    const d = plan.dates[i];
    if (d >= t) break;
    if (rebalance && d < rebalance.from) continue;
    dayItems(d).forEach(function (s) { if (!slotDone(s)) { list.push(s); missedBefore++; } });
  }
  for (let i = 0; i < plan.dates.length; i++) {
    const d = plan.dates[i];
    if (d < t) continue;
    dayItems(d).forEach(function (s) { if (!slotDone(s)) list.push(s); });
  }
  if (!list.length) { toast('밀린 분량이 없어요'); return; }

  const days = plan.dates.filter(function (d) { return d >= t; });
  const D = days.length;
  const counts = countsFor(list.length, D);
  const outDays = {};
  let k = 0;
  for (let i = 0; i < D; i++) {
    const arr = [];
    for (let j = 0; j < counts[i]; j++) {
      const s = list[k++];
      arr.push({ b: s.b, c: s.c, r: s.r });
    }
    if (arr.length) outDays[days[i]] = arr;
  }
  rebalance = {
    from: t,
    createdAt: new Date().toISOString(),
    total: list.length,
    dayCount: D,
    days: outDays
  };
  saveRebalance();
  state.view = 'today';
  render();
  toast('남은 ' + list.length + '장을 ' + D + '일에 다시 나눴어요' + (missedBefore ? ' (밀린 ' + missedBefore + '장 포함)' : ''));
}

function undoRebalance() {
  rebalance = null;
  saveRebalance();
  render();
  toast('원래 일정으로 되돌렸어요');
}

function exportData() {
  const data = {
    app: 'bible-reading',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: settings,
    pass: pass,
    rebalance: rebalance
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bible-reading-backup-' + todayISO() + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  toast('백업 파일을 만들었어요');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = function () {
    let obj;
    try { obj = JSON.parse(String(reader.result)); } catch (e) { toast('백업 파일을 읽지 못했어요'); return; }
    if (!obj || typeof obj !== 'object' || !obj.pass || typeof obj.pass !== 'object') {
      toast('성경 통독 백업 파일이 아니에요');
      return;
    }
    const nextPass = {};
    Object.keys(obj.pass).forEach(function (k) {
      if (!/^\d{1,2}-\d{1,3}$/.test(k)) return;
      const n = clampInt(obj.pass[k], 0, 9);
      if (n > 0) nextPass[k] = n;
    });
    const s = obj.settings || {};
    settings = {
      rounds: ROUND_OPTIONS.indexOf(Number(s.rounds)) >= 0 ? Number(s.rounds) : DEFAULT_SETTINGS.rounds,
      mode: s.mode === 'mix' ? 'mix' : 'seq',
      start: parseISO(s.start) ? s.start : DEFAULT_SETTINGS.start,
      days: DAY_OPTIONS.indexOf(Number(s.days)) >= 0 ? Number(s.days) : DEFAULT_SETTINGS.days
    };
    pass = nextPass;
    writeJSON(LS_PASS, pass);
    writeJSON(LS_SET, settings);
    rebalance = null;
    if (obj.rebalance && obj.rebalance.from && obj.rebalance.days) {
      writeJSON(LS_REBAL, obj.rebalance);
      rebalance = loadRebalance();
    } else {
      removeKey(LS_REBAL);
    }
    plan = buildPlan(settings);
    render(true);
    toast('백업을 불러왔어요 · ' + num(Object.keys(pass).length) + '개 장 기록');
  };
  reader.onerror = function () { toast('파일을 읽지 못했어요'); };
  reader.readAsText(file);
}

function resetAll() {
  if (!window.confirm('모든 체크 기록과 설정을 지울까요?\n되돌릴 수 없어요.')) return;
  pass = {};
  settings = Object.assign({}, DEFAULT_SETTINGS);
  rebalance = null;
  removeKey(LS_PASS);
  removeKey(LS_SET);
  removeKey(LS_REBAL);
  plan = buildPlan(settings);
  state.view = 'today';
  render(true);
  toast('처음 상태로 되돌렸어요');
}

/* =========================================================
   9. 이벤트
   ========================================================= */
document.addEventListener('click', function (e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;

  if (a === 'tab') {
    if (state.view !== el.dataset.tab) {
      state.view = el.dataset.tab;
      state.sheetDate = null;
      render(true);
    }
    return;
  }
  if (a === 'closeSheet') { state.sheetDate = null; render(); return; }

  if (a === 'toggleSlot') {
    toggleSlot(Number(el.dataset.b), Number(el.dataset.c), Number(el.dataset.r));
    render();
    return;
  }
  if (a === 'cycleChapter') {
    const b = Number(el.dataset.b), c = Number(el.dataset.c);
    const cur = getCount(b, c);
    setCount(b, c, cur >= settings.rounds ? 0 : cur + 1);
    render();
    return;
  }
  if (a === 'completeDay') {
    const date = el.dataset.date || state.sheetDate || focusDate();
    completeDay(date, !dayDone(date));
    render();
    return;
  }
  if (a === 'openDay') {
    state.sheetDate = el.dataset.date;
    renderSheet();
    return;
  }
  if (a === 'calPrev' || a === 'calNext') {
    const delta = a === 'calPrev' ? -1 : 1;
    const d = new Date(state.calY, state.calM + delta, 1);
    state.calY = d.getFullYear();
    state.calM = d.getMonth();
    render();
    return;
  }
  if (a === 'calToday') {
    const d = new Date();
    state.calY = d.getFullYear();
    state.calM = d.getMonth();
    render();
    return;
  }
  if (a === 'startToday') {
    applySettings({ start: todayISO() });
    return;
  }
  if (a === 'setRounds') {
    const r = clampInt(el.dataset.v, 1, 3);
    if (r !== settings.rounds) applySettings({ rounds: r });
    return;
  }
  if (a === 'setMode') {
    const m = el.dataset.v === 'mix' ? 'mix' : 'seq';
    if (m !== settings.mode) applySettings({ mode: m });
    return;
  }
  if (a === 'setDays') {
    const d = Number(el.dataset.v);
    if (DAY_OPTIONS.indexOf(d) >= 0 && d !== settings.days) applySettings({ days: d });
    return;
  }
  if (a === 'tableFilter') {
    state.tableTest = el.dataset.v;
    render();
    return;
  }
  if (a === 'toggleBook') {
    const b = Number(el.dataset.b);
    if (state.openBooks.has(b)) state.openBooks.delete(b);
    else state.openBooks.add(b);
    render();
    return;
  }
  if (a === 'toggleAllBooks') {
    if (state.openBooks.size >= BOOKS.length) state.openBooks.clear();
    else BOOKS.forEach(function (b) { state.openBooks.add(b.index); });
    render();
    return;
  }
  if (a === 'rebalance') { doRebalance(); return; }
  if (a === 'undoRebalance') { undoRebalance(); return; }
  if (a === 'exportData') { exportData(); return; }
  if (a === 'importData') {
    const input = document.getElementById('importFile');
    if (input) input.click();
    return;
  }
  if (a === 'resetAll') { resetAll(); return; }
});

document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'startInput') {
    const v = e.target.value;
    if (parseISO(v) && v !== settings.start) applySettings({ start: v });
    else if (!parseISO(v)) { e.target.value = settings.start; toast('날짜를 다시 골라 주세요'); }
  }
  if (e.target && e.target.id === 'importFile') {
    const f = e.target.files && e.target.files[0];
    if (f) importData(f);
    e.target.value = '';
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && state.sheetDate) { state.sheetDate = null; render(); }
});

/* =========================================================
   10. 시작
   ========================================================= */
function init() {
  // URL의 ?src=homescreen 은 통계용이라 별도 처리 없음
  render(true);
}

/* 테스트·검증용 읽기 전용 훅 */
window.__bibleDebug = {
  books: function () {
    return BOOKS.map(function (b) { return { name: b.name, chapters: b.chapters, testament: b.testament }; });
  },
  sums: function () {
    return {
      books: BOOKS.length,
      otBooks: OT_BOOKS.length,
      ntBooks: NT_BOOKS.length,
      otChapters: OT_BOOKS.reduce(function (a, b) { return a + b.chapters; }, 0),
      ntChapters: NT_BOOKS.reduce(function (a, b) { return a + b.chapters; }, 0),
      total: BOOKS.reduce(function (a, b) { return a + b.chapters; }, 0)
    };
  },
  planStats: function (override) {
    const s = override ? {
      rounds: override.rounds || settings.rounds,
      mode: override.mode || settings.mode,
      start: override.start || settings.start,
      days: override.days || settings.days
    } : settings;
    const p = buildPlan(s);
    const perDay = p.dates.map(function (d) { return p.items.get(d); });
    const slots = perDay.reduce(function (a, x) { return a + x.length; }, 0);
    const uniq = new Set();
    perDay.forEach(function (list) { list.forEach(function (x) { uniq.add(x.b + '-' + x.c); }); });
    const groups = perDay.map(function (list) {
      let ot = 0, nt = 0, w = 0;
      list.forEach(function (x) { const g = groupOf(x); if (g === 0) ot++; else if (g === 1) nt++; else w++; });
      return { ot: ot, nt: nt, w: w };
    });
    const lens = perDay.map(function (x) { return x.length; });
    const perChapter = new Map();
    perDay.forEach(function (list) {
      list.forEach(function (x) {
        const k = x.b + '-' + x.c;
        perChapter.set(k, (perChapter.get(k) || 0) + 1);
      });
    });
    const occ = Array.from(perChapter.values());
    return {
      days: p.days, rounds: p.rounds, mode: p.mode, start: p.start, end: p.end,
      slots: slots, unique: uniq.size,
      eachMin: Math.min.apply(null, occ), eachMax: Math.max.apply(null, occ),
      minDay: Math.min.apply(null, lens), maxDay: Math.max.apply(null, lens),
      avg: +(slots / p.days).toFixed(2),
      minOT: Math.min.apply(null, groups.map(function (g) { return g.ot; })),
      minMix: Math.min.apply(null, groups.map(function (g) { return g.nt + g.w; })),
      daysWithoutMix: groups.filter(function (g) { return g.nt + g.w === 0; }).length,
      firstDay: p.items.get(p.dates[0]).map(function (x) { return BOOKS[x.b].name + ' ' + x.c; }),
      lastDay: p.items.get(p.dates[p.dates.length - 1]).map(function (x) { return BOOKS[x.b].name + ' ' + x.c; })
    };
  },
  state: function () {
    return { settings: settings, pass: pass, rebalance: rebalance, today: todayISO(), planStart: plan.start, planEnd: plan.end };
  },
  summary: function () {
    const t = todayISO();
    let total = 0, checked = 0;
    plan.dates.forEach(function (d) {
      dayItems(d).forEach(function (s) { total++; if (slotDone(s)) checked++; });
    });
    return {
      today: t, settings: settings, planStart: plan.start, planEnd: plan.end,
      todayItems: dayItems(t).length,
      todayDone: dayItems(t).filter(slotDone).length,
      pendingPast: pendingPast(),
      totalSlots: total, checkedSlots: checked,
      passCount: Object.keys(pass).length,
      rebalance: rebalance ? { from: rebalance.from, total: rebalance.total, dayCount: rebalance.dayCount } : null
    };
  }
};

init();
