/* 달의 기록 — 화면 모드(라이트/다크)와 계절 테마
   · 모드는 기기(localStorage 'dal_mode')에 저장해 다음 접속에도 유지 — 기본은 라이트
   · 계절은 오늘의 사이클 단계로 정해지고, 앱 전체의 분위기 색이 그 계절로 바뀐다(기록이 없으면 'none' 연핑크)
   · 생리일·가임기 표시 색은 계절과 상관없이 고정 */

const THEME_ASSET_V = '20261122a';
const SEASON_KEYS = ['winter', 'spring', 'summer', 'autumn', 'none'];
const SEASON_LABEL = { winter: '겨울', spring: '봄', summer: '여름', autumn: '가을' };

function getMode() {
  return document.documentElement.getAttribute('data-mode') === 'dark' ? 'dark' : 'light';
}

function getSeason() {
  const s = document.documentElement.getAttribute('data-season');
  return SEASON_KEYS.includes(s) ? s : 'none';
}

function _applyThemeChrome() {
  const mode = getMode();
  const season = getSeason();
  document.querySelectorAll('[data-mode-btn]').forEach(b => {
    const on = b.dataset.modeBtn === mode;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const img = document.getElementById('hero-shape');
  if (img) {
    const src = `assets/season/${mode}-${season}.webp?v=${THEME_ASSET_V}`;
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if (bg) meta.setAttribute('content', bg);
  }
}

function setMode(mode) {
  const m = mode === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-mode', m);
  try { localStorage.setItem('dal_mode', m); } catch (_) {}
  _applyThemeChrome();
}

function setSeason(key) {
  const k = SEASON_KEYS.includes(key) ? key : 'none';
  document.documentElement.setAttribute('data-season', k);
  try { localStorage.setItem('dal_season', k); } catch (_) {}
  _applyThemeChrome();
}

/* 히어로 위 날짜: 11월 21일 토요일 */
function renderHeroDate() {
  const el = document.getElementById('hero-date');
  if (!el) return;
  const d = new Date();
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  el.textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${wd}요일`;
}

/* 사이클 진행 라인: 네 계절 구간 비율 + 오늘 위치 */
function renderCycleProgress(day, cycleLen) {
  const box = document.getElementById('cycle-progress');
  if (!box) return;
  const cycle = Math.min(45, Math.max(10, Math.round(cycleLen || 28)));
  const has = day > 0;
  const bounds = (typeof seasonBounds === 'function') ? seasonBounds(cycle) : [];
  const cur = has ? getCyclePhase(Math.min(day, cycle), cycle) : null;

  let bars = '', labels = '';
  bounds.forEach(b => {
    const w = (b.to - b.from + 1) / cycle * 100;
    bars += `<span class="cp-seg cp-${b.key}" style="width:calc(${w.toFixed(3)}% - 4px)"></span>`;
    labels += `<span class="cp-lab${b.key === cur ? ' on' : ''}" style="width:${w.toFixed(3)}%">${SEASON_LABEL[b.key]}</span>`;
  });
  let fill = '';
  if (has) {
    const pos = Math.min(day, cycle);
    const pct = ((pos - 0.5) / cycle * 100).toFixed(3);
    fill = `<span class="cp-fill" style="width:${pct}%"></span><span class="cp-knob" style="left:${pct}%"></span>`;
  }
  const left = has ? `생리 시작 후 <b>${day}일째</b>` : '이번 사이클';
  const right = has ? `${cycle}일 주기` : '—';
  box.innerHTML =
    `<div class="cp-head"><span>${left}</span><span>${right}</span></div>` +
    `<div class="cp-track">${bars}${fill}</div>` +
    `<div class="cp-labs">${labels}</div>`;
}

/* 주간 날짜: 오늘을 가운데에 두고 앞뒤 6일 — 생리일(주황)·가임기(보라) 점은 고정색 */
function renderWeekStrip(records) {
  const box = document.getElementById('week-strip');
  if (!box) return;
  const today = getTodayStr();
  const periodSet = new Set();
  (records || []).forEach(r => {
    if (!r || !r.start) return;
    const end = r.end || addDays(r.start, DEFAULT_DURATION - 1);
    for (let d = r.start; d <= end; d = addDays(d, 1)) periodSet.add(d);
  });
  const fertile = new Set();
  const pred = (records && records.length) ? getNextPredictions(records) : null;
  if (pred && pred.fertile) {
    for (let d = pred.fertile.start; d <= pred.fertile.end; d = addDays(d, 1)) fertile.add(d);
  }
  const wd = ['일', '월', '화', '수', '목', '금', '토'];
  let html = '';
  for (let i = -6; i <= 6; i++) {
    const ds = addDays(today, i);
    const [y, m, dd] = ds.split('-').map(Number);
    const dow = new Date(y, m - 1, dd).getDay();
    const dot = periodSet.has(ds) ? ' is-period' : (fertile.has(ds) ? ' is-fertile' : '');
    html += `<div class="wk-day${i === 0 ? ' today' : ''}${dot}">` +
            `<span class="wk-w">${wd[dow]}</span><span class="wk-d">${dd}</span><i></i></div>`;
  }
  box.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
  renderHeroDate();
  _applyThemeChrome();
});
