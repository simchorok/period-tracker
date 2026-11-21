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

/* ── 홈: 인사이트 · 요약 · 배란/가임기 · 공유 · 리포트 띠 ── */

// 오늘의 인사이트 (운영 updateInsightCard 로직 그대로, 이모지만 뺐다)
const INSIGHT_PHASE = {
  winter: '몸이 가장 많은 에너지를 쓰는 시기예요. 무리하지 않는 게 최선이에요.',
  spring: '에너지가 서서히 올라오는 시기예요. 새로운 걸 시작하기 좋아요.',
  summer: '에너지와 자신감이 최고조인 시기예요. 중요한 일은 지금 하세요.',
  autumn: '몸이 생리를 준비하는 시기예요. 감정 기복과 신체 증상이 자연스럽게 나타날 수 있어요.',
};
const INSIGHT_PATTERN = {
  '예민해요': '이 시기마다 예민해지는 패턴이 있어요. 성격이 아니라 호르몬이에요.',
  '무기력해요': '이 시기엔 에너지가 떨어지는 게 반복되고 있어요. 오늘 아무것도 하기 싫은 건 충분히 이유가 있어요.',
  '불안해요': '이 시기마다 불안감이 올라오는 패턴이 있어요. 호르몬 변화가 감정에 영향을 주는 거예요.',
  '슬퍼요': '이 시기에 감정이 가라앉는 패턴이 있어요. 지나가는 리듬이에요.',
  '우울해요': '이 시기에 반복적으로 우울감이 오고 있어요. 몸의 신호예요, 자책하지 마요.',
  '감정이 오락가락해요': '이 시기에 감정 기복이 반복되는 패턴이 있어요. 호르몬이 만드는 거예요.',
  '두통': '이 시기마다 두통이 오는 패턴이 있어요. 호르몬 변화 때문이에요.',
  '생리통': '생리 때마다 통증이 오는 패턴이 있어요. 미리 대비하면 훨씬 나아요.',
  '복통': '이 시기에 복통이 반복되고 있어요. 따뜻하게 해주는 게 도움이 돼요.',
  '붓기가 있어요': '이 시기마다 붓기가 오는 패턴이 있어요. 호르몬 때문에 수분이 쌓이는 거예요.',
  '식욕이 늘었어요': '이 시기마다 식욕이 늘어나는 패턴이 있어요. 몸이 에너지를 더 원하는 거예요.',
  '완전 방전': '이 시기마다 에너지가 바닥나는 패턴이 있어요. 오늘은 쉬는 게 맞아요.',
  '온 몸이 쑤셔요': '이 시기에 몸이 쑤시는 패턴이 있어요. 몸이 보내는 신호예요.',
  '기력이 없어요': '이 시기에 기력이 없는 게 반복되고 있어요. 몸이 쉬고 싶다는 신호예요.',
};
const INSIGHT_ADVICE = {
  '두통': '두통약을 미리 챙겨두고, 수분을 충분히 마셔봐요.',
  '생리통': '핫팩을 배에 올려두고, 진통제를 미리 먹어두는 게 좋아요.',
  '복통': '따뜻한 음료를 마시고 배를 따뜻하게 해주세요.',
  '붓기가 있어요': '짠 음식을 줄이고 물을 많이 마셔봐요.',
  '식욕이 늘었어요': '건강한 간식을 미리 챙겨두면 폭식을 줄이는 데 도움이 돼요.',
  '입맛이 없어요': '부담 없이 먹을 수 있는 가벼운 음식을 챙겨봐요.',
  '완전 방전': '철분이 부족할 수 있어요. 철분 보충제를 챙겨봐요.',
  '무기력해요': '가볍게 스트레칭만 해도 혈액순환에 도움이 돼요.',
  '냉이 많아요': '배란기나 생리 전 분비물이 늘어나는 건 자연스러워요. 방수 팬티를 미리 준비해두면 훨씬 편해요.',
  '온 몸이 쑤셔요': '따뜻한 물로 반신욕을 해보는 건 어때요.',
  '예민해요': '카페인을 줄이고 따뜻한 음료로 바꿔봐요.',
  '우울해요': '오늘은 나를 다독이는 시간을 가져봐요. 가볍게 산책하거나 좋아하는 음악을 들어봐요.',
  '불안해요': '천천히 깊게 호흡해봐요. 불안한 감정을 일기에 적으면 마음이 한결 가벼워져요.',
  '단 게 당겨요': '설탕 대신 과일이나 다크초콜릿으로 달콤함을 채워봐요.',
  '두드러기/여드름': '세안을 꼼꼼히 하고 보습을 충분히 해줘요.',
  '메스꺼움': '공복을 피하고 소량씩 자주 먹어봐요.',
  '허리통증': '스트레칭이나 핫팩으로 허리를 풀어줘봐요.',
  '유방통': '카페인을 줄이면 유방통이 완화되는 경우가 있어요.',
};
const INSIGHT_PHYSICAL = ['생리통', '복통', '두통', '온 몸이 쑤셔요', '메스꺼움', '어지러워요', '유방통', '허리통증', '붓기가 있어요', '냉이 많아요', '식욕이 늘었어요', '입맛이 없어요', '단 게 당겨요'];
const INSIGHT_EMOTIONAL = ['우울해요', '불안해요', '무기력해요', '슬퍼요', '예민해요', '감정이 오락가락해요', '기력이 없어요'];

function _insightRepeatTag(records, phase, todayTags, cycle, logs) {
  const sorted = [...records].sort((a, b) => a.start > b.start ? 1 : -1);
  const counts = {};
  sorted.forEach((r, i) => {
    if (i === sorted.length - 1) return;
    for (let day = 1; day <= cycle; day++) {
      const ds = addDays(r.start, day - 1);
      if (getCyclePhase(day, cycle) !== phase) continue;
      const log = logs[ds];
      if (!log) continue;
      [...(log.mood || []), ...(log.symptom || []), ...(log.energy || [])].forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    }
  });
  const threshold = Math.max(1, Math.floor((sorted.length - 1) * 0.4));
  for (const t of todayTags) if (counts[t] >= threshold && INSIGHT_PATTERN[t]) return t;
  return null;
}

function renderInsight(records) {
  const card = document.getElementById('insight-card');
  const body = document.getElementById('insight-body');
  if (!card || !body) return;
  const esc = (t) => (typeof escapeHtml === 'function' ? escapeHtml(t) : t);
  if (!records || !records.length) {
    body.innerHTML = '<p class="h-ins-empty">생리 기록을 입력하면 맞춤 인사이트를 드려요</p>';
    card.hidden = false;
    return;
  }
  const today = getTodayStr();
  const logs = loadLogs();
  const todayLog = logs[today];
  const todayTags = todayLog ? [...(todayLog.mood || []), ...(todayLog.symptom || []), ...(todayLog.energy || []), ...(todayLog.etc || [])] : [];
  const sorted = [...records].sort((a, b) => a.start > b.start ? -1 : 1);
  const last = sorted[0];
  const cycle = calcAvgCycle(records);
  const dayOfCycle = dateDiff(today, last.start) + 1;
  if (dayOfCycle < 1 || dayOfCycle > cycle + 5) { card.hidden = true; return; }
  const phase = getCyclePhase(dayOfCycle, cycle);
  const pred = getNextPredictions(records);
  const daysUntil = pred ? dateDiff(pred.nextStart, today) : null;

  const parts = [INSIGHT_PHASE[phase]];
  if (records.length >= 2 && todayTags.length) {
    const t = _insightRepeatTag(records, phase, todayTags, cycle, logs);
    if (t) parts.push(INSIGHT_PATTERN[t]);
  }
  if (phase === 'winter') {
    parts.push(dateDiff(last.end, today) >= 0
      ? '생리 중이에요. 이 시기가 지나면 에너지가 다시 올라와요.'
      : '생리가 끝났어요. 몸이 서서히 회복되고 있어요.');
  } else if (daysUntil !== null && daysUntil >= 0) {
    if (daysUntil >= 7) parts.push(`다음 생리까지 ${daysUntil}일 남았어요. 지금부터 무리하지 않는 게 좋아요.`);
    else if (daysUntil >= 3) parts.push(`생리까지 ${daysUntil}일 남았어요. 슬슬 몸이 신호를 보내기 시작할 거예요.`);
    else if (daysUntil >= 1) parts.push('곧 생리가 시작될 것 같아요. 따뜻하게 준비해두세요.');
    else parts.push('오늘이 예상 생리 시작일이에요. 몸을 따뜻하게 해주세요.');
  }
  if (todayTags.length) {
    const ph = INSIGHT_PHYSICAL.find(t => todayTags.includes(t) && INSIGHT_ADVICE[t]);
    const em = INSIGHT_EMOTIONAL.find(t => todayTags.includes(t) && INSIGHT_ADVICE[t]);
    if (ph) parts.push(INSIGHT_ADVICE[ph]);
    if (em) parts.push(INSIGHT_ADVICE[em]);
  }
  body.innerHTML = parts.map((t, i) => `<p class="${i === 0 ? 'h-ins-lead' : 'h-ins-p'}">${esc(t)}</p>`).join('');
  card.hidden = false;
}

function renderHomeExtras(records) {
  const recs = records || [];
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  const unit = (v, u) => `${v}<i>${u}</i>`;
  set('fc-avg', recs.length >= 2 ? unit(calcAvgCycle(recs), '일') : '—');
  set('fc-count', unit(recs.length, '회'));
  if (recs.length) {
    const last = [...recs].sort((a, b) => a.start > b.start ? -1 : 1)[0];
    const [, lm, ld] = last.start.split('-');
    set('fc-last', `${parseInt(lm, 10)}/${parseInt(ld, 10)}`);
  } else set('fc-last', '—');

  const info = document.getElementById('home-info');
  const pred = recs.length ? getNextPredictions(recs) : null;
  if (info) {
    if (pred) {
      const md = (ds) => { const [, m, d] = ds.split('-'); return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일`; };
      const dot = (ds) => { const [, m, d] = ds.split('-'); return `${parseInt(m, 10)}.${parseInt(d, 10)}`; };
      set('home-ov', md(pred.ovulation));
      set('home-fertile', `${dot(pred.fertile.start)} ~ ${dot(pred.fertile.end)}`);
      info.hidden = false;
    } else info.hidden = true;
  }
  const share = document.getElementById('home-share');
  if (share) share.hidden = !recs.length;

  // 인사: 닉네임이 있으면 "OO님의 오늘 · 날짜"
  renderHeroDate();
  const dEl = document.getElementById('hero-date');
  const nick = (typeof userNickname === 'string' && userNickname.trim()) ? userNickname.trim() : '';
  if (dEl && nick) dEl.textContent = `${nick}님의 오늘 · ${dEl.textContent}`;
}

// 리포트 도착 띠: 기존 리포트 배너(주기 탭의 칩) 상태를 그대로 따라간다
function syncHomeReport() {
  const src = document.getElementById('report-banner');
  const home = document.getElementById('home-report');
  if (!src || !home) return;
  const on = src.classList.contains('show');
  home.hidden = !on;
  if (on) {
    const raw = (document.getElementById('report-banner-title') || {}).textContent || '';
    let t = raw.replace(/^\d{4}년\s*/, '').trim();
    if (!t) t = '사이클 리포트';
    if (!/도착/.test(t)) t = t.replace(/리포트$/, '사이클 리포트') + '가 도착했어요';
    const el = document.getElementById('home-report-title');
    if (el) el.textContent = t;
  }
}
document.addEventListener('DOMContentLoaded', () => {
  const src = document.getElementById('report-banner');
  if (src && 'MutationObserver' in window) {
    new MutationObserver(syncHomeReport).observe(src, { attributes: true, attributeFilter: ['class'] });
    const t = document.getElementById('report-banner-title');
    if (t) new MutationObserver(syncHomeReport).observe(t, { childList: true, characterData: true, subtree: true });
  }
  syncHomeReport();
});

/* ── 온보딩: 첫 로그인 후 한 번 (기기에 onboarding_done 저장) ── */
let _obIdx = 0;
const OB_CTA = ['시작할게요', '다음', '다음', '다음', '생리 기록 입력하기'];
const OB_ORB = ['none', 'autumn', 'spring', 'winter', 'summer'];

function _renderOnboarding() {
  const el = document.getElementById('onboarding');
  if (!el) return;
  el.querySelectorAll('.ob-slide').forEach(s => s.classList.toggle('on', Number(s.dataset.ob) === _obIdx));
  el.querySelectorAll('.ob-dots-ind i').forEach((d, i) => d.classList.toggle('on', i === _obIdx));
  const t = document.getElementById('ob-cta-t');
  if (t) t.textContent = OB_CTA[_obIdx];
  el.setAttribute('data-ob-season', OB_ORB[_obIdx]);
  const later = document.getElementById('ob-later');
  if (later) later.hidden = _obIdx !== 4;
}

function maybeShowOnboarding() {
  let done = false;
  try { done = localStorage.getItem('onboarding_done') === '1'; } catch (_) {}
  const el = document.getElementById('onboarding');
  if (done || !el) return;
  _obIdx = 0;
  el.hidden = false;
  _renderOnboarding();
}

function nextOnboarding() {
  if (_obIdx < 4) { _obIdx++; _renderOnboarding(); return; }
  closeOnboarding();
  if (typeof openModal === 'function') openModal();
}

function closeOnboarding() {
  const el = document.getElementById('onboarding');
  if (el) el.hidden = true;
  try { localStorage.setItem('onboarding_done', '1'); } catch (_) {}
}
