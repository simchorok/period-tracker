/* 달의 기록 — 화면: 홈 궤도/달력/그래프/마이 렌더링, 탭 전환, 기록 목록·상세 */

/* ── 공통: 숫자 + 단위 ── */
function unitHtml(value, unit) {
  return `${value}<span class="unit">${unit}</span>`;
}

/* ── 공통: 토스트 ── */
function showToast(message) {
  let el = document.getElementById('share-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'share-toast';
    el.className = 'share-toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.remove('show'), 3400);
}

/* ── 사이클 단계 ── */
const CYCLE_PHASES = {
  winter: {
    name: '생리기', season: '겨울', cls: 'winter', color: '#8FA5D6',
    note: '몸이 쉬어가는 때예요. 아무것도 하지 않아도 괜찮아요.',
    detail: '몸이 한 달을 비우는 며칠이에요. 아무것도 하지 않아도 괜찮아요.'
  },
  spring: {
    name: '여포기', season: '봄', cls: 'spring', color: '#7FC0A0',
    note: '기운이 다시 차오르는 때예요.',
    detail: '에스트로겐이 다시 올라오는 때예요. 작은 시작을 하기 좋아요.'
  },
  summer: {
    name: '배란기', season: '여름', cls: 'summer', color: '#E0B368',
    note: '가장 밝게 빛나는 때예요.',
    detail: '에너지와 자신감이 가장 높은 때예요. 지금의 기운을 마음껏 써도 좋아요.'
  },
  autumn: {
    name: '황체기', season: '가을', cls: 'autumn', color: '#C98B72',
    note: '마음이 조금 예민해지는 때예요.',
    detail: '몸이 천천히 내려앉는 때예요. 예민함은 호르몬의 흐름이에요.'
  }
};

function getCyclePhase(dayOfCycle, cycleLength) {
  const winterEnd = 6;
  const springEnd = Math.round(cycleLength * 0.48);
  const summerEnd = Math.round(cycleLength * 0.63);
  if (dayOfCycle <= winterEnd) return 'winter';
  if (dayOfCycle <= springEnd) return 'spring';
  if (dayOfCycle <= summerEnd) return 'summer';
  return 'autumn';
}

const CYCLE_PHASES_SHORT = {
  winter: '몸이 쉬어가는 때예요',
  spring: '기운이 다시 차오르는 때예요',
  summer: '가장 밝게 빛나는 때예요',
  autumn: '마음이 조금 예민해지는 때예요'
};

/* ── 홈: 방사형 다이얼 그리기 ── */
const ORBIT_CX = 180, ORBIT_CY = 180, ORBIT_R = 150;

function _orbitPt(r, day, N) {
  const deg = (day - 1) * 360 / N;
  const a = (deg - 90) * Math.PI / 180;
  return [ORBIT_CX + r * Math.cos(a), ORBIT_CY + r * Math.sin(a)];
}

function _orbitArc(r, d1, d2, N) {
  const s = _orbitPt(r, d1, N);
  const e = _orbitPt(r, d2, N);
  const span = (d2 - d1) * 360 / N;
  const large = span > 180 ? 1 : 0;
  return `M${s[0].toFixed(2)},${s[1].toFixed(2)} A${r},${r} 0 ${large} 1 ${e[0].toFixed(2)},${e[1].toFixed(2)}`;
}

function seasonBounds(cycle) {
  const w = Math.min(6, cycle);
  const sp = Math.max(w, Math.round(cycle * 0.48));
  const su = Math.max(sp, Math.round(cycle * 0.63));
  return [
    { key: 'winter', from: 1, to: w },
    { key: 'spring', from: w + 1, to: sp },
    { key: 'summer', from: sp + 1, to: su },
    { key: 'autumn', from: su + 1, to: cycle }
  ].filter(s => s.to >= s.from);
}

const MOON_SHADE = {
  // 달이 차오르는 순서: 생리기(가는 달) → 여포기(반달) → 배란기(보름) → 황체기(기우는 달)
  winter: '<circle cx="73" cy="50" r="43" fill="url(#moonShadeGrad)"/>',
  spring: '<rect x="51" y="0" width="60" height="100" fill="url(#moonShadeGrad)"/>',
  summer: '',
  autumn: '<rect x="73" y="0" width="60" height="100" fill="url(#moonShadeGrad)"/>'
};

function renderOrbit(opts) {
  const cycle = Math.min(45, Math.max(10, Math.round(opts.cycle || 28)));
  const day = Math.max(0, Math.min(opts.day || 0, cycle + 12));
  const phaseKey = opts.phaseKey || null;

  const ticksG = document.getElementById('orbit-ticks');
  const arcsG = document.getElementById('orbit-arcs');
  const progG = document.getElementById('orbit-progress');
  if (!ticksG || !arcsG || !progG) return;

  // 눈금 — 하루에 하나, 오늘 눈금만 코랄로 길게
  let ticks = '';
  for (let d = 1; d <= cycle; d++) {
    const isToday = (day > 0 && d === day);
    const isWeek = (d % 7 === 1);
    const r1 = ORBIT_R - 10;
    const r2 = isToday ? ORBIT_R - 40 : (isWeek ? ORBIT_R - 26 : ORBIT_R - 20);
    const a = _orbitPt(r1, d, cycle), b = _orbitPt(r2, d, cycle);
    const stroke = isToday
      ? 'url(#progGrad)'
      : (day > 0 && d <= day ? 'rgba(255,255,255,.34)' : 'rgba(255,255,255,.17)');
    ticks += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${stroke}" stroke-width="${isToday ? 3 : (isWeek ? 1.4 : 1)}" stroke-linecap="round"/>`;
  }
  ticksG.innerHTML = ticks;

  // 사계절 아크는 다이얼에서는 쓰지 않는다
  arcsG.innerHTML = '';

  // 오늘까지 지나온 진행 링
  let prog = '';
  const endDay = Math.max(0, Math.min(day, cycle));
  if (endDay >= 1) {
    prog += `<path d="${_orbitArc(ORBIT_R, 1, endDay, cycle)}" fill="none" stroke="url(#progGrad)" stroke-width="12" stroke-linecap="round"/>`;
    const m = _orbitPt(ORBIT_R, endDay, cycle);
    prog += `<circle class="halo" cx="${m[0].toFixed(1)}" cy="${m[1].toFixed(1)}" r="13" fill="${phaseKey ? CYCLE_PHASES[phaseKey].color : '#FFB27E'}" opacity=".18"/>`;
    prog += `<circle cx="${m[0].toFixed(1)}" cy="${m[1].toFixed(1)}" r="6.4" fill="#FFF3E6" filter="url(#dotGlow)"/>`;
    prog += `<circle cx="${m[0].toFixed(1)}" cy="${m[1].toFixed(1)}" r="2.6" fill="#FF8A5F"/>`;
  }
  progG.innerHTML = prog;

  const svg = document.getElementById('orbit-svg');
  if (svg) {
    svg.setAttribute('aria-label', phaseKey
      ? `${cycle}일 주기 중 ${endDay}일째, ${CYCLE_PHASES[phaseKey].season} ${CYCLE_PHASES[phaseKey].name}`
      : `${cycle}일 주기 궤도`);
  }
}

/* ── 홈 상태 업데이트 ── */
async function updateStatus() {
  const records = loadRecords();
  const todayStr = getTodayStr();
  const heroEl = document.getElementById('hero-title');
  const nextEl = document.getElementById('hero-next');
  const hintEl = document.getElementById('hint-text');
  const noteEl = document.getElementById('phase-note');
  const cardEl = document.getElementById('home-card');
  if (cardEl) cardEl.classList.toggle('is-empty', !records.length);

  if (!records.length) {
    renderOrbit({ cycle: 28, day: 0, phaseKey: null });
    if (heroEl) heroEl.innerHTML = '기록을<br>시작해보세요';
    if (nextEl) nextEl.textContent = '';
    if (typeof setSeason === 'function') setSeason('none');
    if (typeof renderCycleProgress === 'function') renderCycleProgress(0, 28);
    if (hintEl) hintEl.textContent = '기록을 시작해보세요';
    if (noteEl) noteEl.textContent = '생리 기록을 남기면 달이 차오르기 시작해요';
  } else {
    const sorted = [...records].sort((a, b) => a.start > b.start ? 1 : -1);
    const last = sorted[sorted.length - 1];
    const cycle = calcAvgCycle(records);
    const dayOfCycle = Math.max(1, dateDiff(todayStr, last.start) + 1);
    const phaseKey = getCyclePhase(Math.min(dayOfCycle, cycle), cycle);
    const phase = CYCLE_PHASES[phaseKey];
    const pred = getNextPredictions(records);
    const diff = pred ? dateDiff(pred.nextStart, todayStr) : null;
    const inPeriod = todayStr >= last.start && todayStr <= last.end;

    renderOrbit({ cycle, day: dayOfCycle, phaseKey });

    // 히어로: 전문 용어 대신 계절 이름만 크게
    if (heroEl) heroEl.textContent = phase.season;
    if (nextEl) {
      if (diff === null) nextEl.textContent = '';
      else if (diff > 0) {
        const [, nm, nd] = pred.nextStart.split('-');
        nextEl.innerHTML = `<span class="h-next-k">다음 생리</span><span class="h-next-d">${parseInt(nm, 10)}월 ${parseInt(nd, 10)}일</span><span class="h-next-left">D-${diff}</span>`;
      }
      else if (diff === 0) nextEl.textContent = '오늘이 예상 시작일이에요';
      else nextEl.textContent = `예정일에서 ${Math.abs(diff)}일 지났어요`;
    }
    if (typeof setSeason === 'function') setSeason(phaseKey);
    if (typeof renderCycleProgress === 'function') renderCycleProgress(dayOfCycle, cycle);

    if (hintEl) {
      if (inPeriod) hintEl.textContent = `생리 ${dayOfCycle}일째예요`;
      else if (diff === 0) hintEl.textContent = '오늘이 예상 시작일이에요';
      else if (diff < 0) hintEl.textContent = `예정일에서 ${Math.abs(diff)}일 지났어요`;
      else hintEl.textContent = CYCLE_PHASES_SHORT[phaseKey] || phase.note;
    }

    if (noteEl) {
      noteEl.textContent = (dayOfCycle > cycle + 5)
        ? '이번 주기가 조금 길어지고 있어요. 몸의 신호를 살펴봐요.'
        : (phase.detail || phase.note);
    }
  }

  renderHomeBadges();
  renderNavAvatar();
  if (typeof renderHeroDate === 'function') renderHeroDate();
  if (typeof renderWeekStrip === 'function') renderWeekStrip(records);
  if (typeof renderHomeExtras === 'function') renderHomeExtras(records);
  if (typeof renderInsight === 'function') renderInsight(records);

  if (typeof checkReportBanner === 'function') await checkReportBanner();
  if (typeof checkQuestionBanner === 'function') await checkQuestionBanner();
}

/* ── 홈 부채꼴 카드 3장 ── */
function renderHomeBadges() {
  const records = loadRecords();
  const logs = loadLogs();
  const ddayEl = document.getElementById('fc-dday');
  const cycleEl = document.getElementById('fc-avg');
  const durEl = document.getElementById('fc-avgdur');
  const withUnit = (v, unit) => (v === null ? '—' : `${v}<i>${unit}</i>`);

  if (cycleEl) cycleEl.innerHTML = withUnit(records.length >= 2 ? calcAvgCycle(records) : null, '일');

  const avgDur = records.length
    ? Math.round(records.reduce((s, r) => s + dateDiff(r.end, r.start) + 1, 0) / records.length)
    : null;
  if (durEl) durEl.innerHTML = withUnit(avgDur, '일');

  if (ddayEl) {
    if (!records.length) {
      ddayEl.textContent = '—';
    } else {
      const pred = getNextPredictions(records);
      if (!pred) ddayEl.textContent = '—';
      else {
        const [, m, d] = pred.nextStart.split('-');
        ddayEl.textContent = `${parseInt(m, 10)}.${d}`;
      }
    }
  }

  // 예전 상단 통계 줄을 쓰던 화면이 남아 있어도 깨지지 않게
  const legacyD = document.getElementById('badge-dday');
  if (legacyD && ddayEl) legacyD.textContent = ddayEl.textContent;
  const legacyC = document.getElementById('badge-cycle');
  if (legacyC && cycleEl) legacyC.textContent = cycleEl.textContent;
  const legacyL = document.getElementById('badge-logs');
  if (legacyL) legacyL.textContent = Object.keys(logs).length || '—';
}

/* ── 홈 상단 마이 버튼의 이니셜/사진 ── */
function renderNavAvatar() {
  const navAv = document.getElementById('nav-avatar');
  if (!navAv || !currentUser) return;
  const meta = currentUser.user_metadata || {};
  if (meta.avatar_url) {
    navAv.innerHTML = `<img src="${escapeHtml(meta.avatar_url)}" alt="">`;
    navAv.classList.add('has-photo');
    return;
  }
  const seed = (userNickname || currentUser.email || '·').trim();
  navAv.textContent = seed ? seed[0].toUpperCase() : '·';
}

/* ── 마이페이지 렌더 ── */
function renderMypage() {
  if (!currentUser) return;
  const avatar = document.getElementById('mypage-avatar');
  if (avatar) {
    if (currentUser.user_metadata?.avatar_url) {
      avatar.innerHTML = `<img src="${escapeHtml(currentUser.user_metadata.avatar_url)}" alt="프로필">`;
    } else {
      const seed = (userNickname || currentUser.email || '·').trim();
      avatar.textContent = seed ? seed[0].toUpperCase() : '·';
    }
  }
  const email = document.getElementById('mypage-email');
  if (email) email.textContent = currentUser.email || '';

  renderNavAvatar();

  updateNicknameUI();

  const records = loadRecords();
  const logs = loadLogs();
  const cycle = calcAvgCycle(records);
  const avgDur = records.length
    ? Math.round(records.reduce((s, r) => s + dateDiff(r.end, r.start) + 1, 0) / records.length)
    : 0;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };
  const blank = '<span class="is-blank">—</span>';
  set('mypage-avg-cycle', records.length >= 2 ? unitHtml(cycle, '일') : blank);
  set('mypage-avg-dur', records.length ? unitHtml(avgDur, '일') : blank);
  set('mypage-total-records', unitHtml(records.length, '회'));
  set('mypage-total-logs', unitHtml(Object.keys(logs).length, '일'));
}

/* ── 달력 ── */
function renderCalendarMonth(year, month, periodSet, pred, past, todayFull) {
  const block = document.createElement('div');
  block.className = 'calendar-month-block';

  const title = document.createElement('div');
  title.className = 'cal-month-title';
  title.textContent = `${year}. ${String(month + 1).padStart(2, '0')}`;
  block.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'calendar-grid';

  const labels = document.createElement('div');
  labels.className = 'day-labels';
  ['일','월','화','수','목','금','토'].forEach(l => {
    const el = document.createElement('div'); el.className = 'day-label'; el.textContent = l; labels.appendChild(el);
  });
  grid.appendChild(labels);

  const daysGrid = document.createElement('div');
  daysGrid.className = 'days-grid';

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const e = document.createElement('div'); e.className = 'day-cell empty'; daysGrid.appendChild(e);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement('div');
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    let cls = 'day-cell';
    if (periodSet.has(ds)) cls += ' period';
    else if (past.ovulation.has(ds)) cls += ' ovulation';
    else if (past.fertile.has(ds)) cls += ' fertile';
    else if (pred.period.has(ds)) cls += ' predicted';
    else if (pred.ovulation.has(ds)) cls += ' ovulation-predicted';
    else if (pred.fertile.has(ds)) cls += ' fertile-predicted';

    if (ds === todayFull) cls += ' today';

    cell.className = cls; cell.textContent = d;
    cell.onclick = () => { openLogModal(ds); };
    daysGrid.appendChild(cell);
  }
  grid.appendChild(daysGrid);
  block.appendChild(grid);
  return block;
}

function renderCalendar() {
  const records = loadRecords();
  const periodSet = new Set();
  records.forEach(r => getPeriodDates(r).forEach(d => periodSet.add(d)));
  const pred = getAllPredictedSets(records);
  const past = getPastOvulationSets(records);
  const today = new Date();
  const todayStr = getTodayStr();

  const wrap = document.getElementById('calendar-scroll-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  // 현재 달 기준 -2 ~ +4 (총 7개월)
  for (let offset = -2; offset <= 4; offset++) {
    let y = today.getFullYear(), m = today.getMonth() + offset;
    while (m < 0) { m += 12; y--; } while (m > 11) { m -= 12; y++; }
    const block = renderCalendarMonth(y, m, periodSet, pred, past, todayStr);
    wrap.appendChild(block);
    if (offset === 0) block.id = 'cal-today-block';
  }

  const sub = document.getElementById('calendar-sub');
  if (sub && records.length) {
    const p = getNextPredictions(records);
    sub.textContent = `${calcAvgCycle(records)}일 주기 · 예상 생리 ${p ? fmtDate(p.nextStart) : '—'}`;
  }

  // 오늘이 있는 달로 이동하되, 화면 제목과 범례는 가리지 않는다
  setTimeout(() => {
    const target = document.getElementById('cal-today-block');
    const scroller = document.getElementById('screens');
    if (!target || !scroller) return;
    const topBar = document.querySelector('#tab-calendar .cal-top');
    const offset = (topBar ? topBar.offsetHeight : 96) + 6;
    const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTo({ top: Math.max(0, top - offset), behavior: 'smooth' });
  }, 100);
}

/* ── 기록 목록 새로고침 (상세가 열려 있으면 다시 그린다) ── */
function renderRecords() {
  const modal = document.getElementById('record-detail-modal');
  if (modal && modal.classList.contains('open') && modal.dataset.type === 'period') openRecordDetail('period');
}

function renderLogList() {
  const modal = document.getElementById('record-detail-modal');
  if (modal && modal.classList.contains('open') && modal.dataset.type === 'log') openRecordDetail('log');
}

/* ── 그래프 ── */
function drawLineChart(svgId, values, avgVal, colorStroke) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  svg.innerHTML = '';
  const W = svg.parentElement.offsetWidth || 300;
  const H = 104;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);

  if (values.length < 2) {
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', W / 2); text.setAttribute('y', H / 2);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', 'rgba(30,34,46,.42)');
    text.setAttribute('font-size', '12.5'); text.textContent = '기록이 2개 이상 필요해요';
    svg.appendChild(text); return;
  }

  const pad = { l: 12, r: 26, t: 26, b: 14 };
  const minV = Math.min(...values) - 2, maxV = Math.max(...values) + 2;
  const range = maxV - minV || 1;
  const xStep = (W - pad.l - pad.r) / (values.length - 1);

  const toX = i => pad.l + i * xStep;
  const toY = v => pad.t + (1 - (v - minV) / range) * (H - pad.t - pad.b);

  // 부드러운 곡선 — 이웃 점의 중간점을 지나는 2차 베지어
  const pts = values.map((v, i) => [toX(i), toY(v)]);
  const n = pts.length;
  let lineD = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i <= n - 2; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    lineD += ` Q${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  lineD += ` T${pts[n - 1][0].toFixed(1)},${pts[n - 1][1].toFixed(1)}`;

  // 평균선
  const avgY = toY(avgVal);
  const avgLine = document.createElementNS(NS, 'line');
  avgLine.setAttribute('x1', pad.l - 2); avgLine.setAttribute('x2', W - pad.r + 2);
  avgLine.setAttribute('y1', avgY); avgLine.setAttribute('y2', avgY);
  avgLine.setAttribute('stroke', 'rgba(30,34,46,.16)'); avgLine.setAttribute('stroke-width', '1');
  avgLine.setAttribute('stroke-dasharray', '4 4');
  svg.appendChild(avgLine);

  // 라인
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', lineD); path.setAttribute('fill', 'none');
  path.setAttribute('stroke', colorStroke); path.setAttribute('stroke-width', '2.6');
  path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);

  // 점 — 마지막 점만 강조하고 값 하나만 표시한다
  values.forEach((v, i) => {
    const cx = toX(i), cy = toY(v);
    const isLast = (i === values.length - 1);

    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', cx); circle.setAttribute('cy', cy);
    circle.setAttribute('r', isLast ? 4.4 : 2.6);
    circle.setAttribute('fill', isLast ? colorStroke : '#FFFFFF');
    circle.setAttribute('stroke', colorStroke);
    circle.setAttribute('stroke-width', isLast ? '2' : '1.6');
    circle.setAttribute('stroke-opacity', isLast ? '1' : '.55');
    svg.appendChild(circle);

    if (isLast) {
      const vLabel = document.createElementNS(NS, 'text');
      vLabel.setAttribute('x', cx); vLabel.setAttribute('y', Math.max(cy - 12, 12));
      vLabel.setAttribute('text-anchor', 'middle');
      vLabel.setAttribute('fill', colorStroke);
      vLabel.setAttribute('font-size', '14'); vLabel.setAttribute('font-weight', '700');
      vLabel.textContent = v;
      svg.appendChild(vLabel);
    }
  });
}

function renderGraph() {
  const records = loadRecords().sort((a, b) => a.start > b.start ? 1 : -1);
  if (typeof renderWeightCard === 'function') renderWeightCard();

  // 주기
  const cycles = [];
  for (let i = 1; i < records.length; i++) {
    const d = dateDiff(records[i].start, records[i - 1].start);
    if (d > 10 && d < 60) cycles.push(d);
  }
  const avgCycleEl = document.getElementById('avg-cycle-num');
  const cycleRow = document.getElementById('cycle-stat-row');
  if (cycles.length >= 1) {
    const avg = Math.round(cycles.reduce((s, v) => s + v, 0) / cycles.length);
    const mn = Math.min(...cycles), mx = Math.max(...cycles);
    if (avgCycleEl) avgCycleEl.innerHTML = unitHtml(avg, '일');
    drawLineChart('cycle-chart', cycles, avg, '#D9775F');
    if (cycleRow) cycleRow.textContent = `최단 ${mn}일 · 최장 ${mx}일 · ${cycles.length}회 기록`;
  } else {
    if (avgCycleEl) avgCycleEl.textContent = '—';
    drawLineChart('cycle-chart', [], 0, '#D9775F');
    if (cycleRow) cycleRow.textContent = '';
  }

  // 기간
  const durs = records.map(r => dateDiff(r.end, r.start) + 1);
  const avgDurEl = document.getElementById('avg-dur-num');
  const durRow = document.getElementById('dur-stat-row');
  if (durs.length >= 1) {
    const avg = Math.round(durs.reduce((s, v) => s + v, 0) / durs.length);
    const mn = Math.min(...durs), mx = Math.max(...durs);
    if (avgDurEl) avgDurEl.innerHTML = unitHtml(avg, '일');
    drawLineChart('dur-chart', durs, avg, '#8D7BD0');
    if (durRow) durRow.textContent = `최단 ${mn}일 · 최장 ${mx}일 · ${durs.length}회 기록`;
  } else {
    if (avgDurEl) avgDurEl.textContent = '—';
    drawLineChart('dur-chart', [], 0, '#8D7BD0');
    if (durRow) durRow.textContent = '';
  }
}

/* ── 탭 전환 ── */
function switchTab(tab) {
  ['home', 'calendar', 'graph', 'mypage'].forEach(t => {
    const section = document.getElementById(`tab-${t}`);
    if (section) section.classList.toggle('active', t === tab);
  });
  // 필 토글·아바타의 활성 표시(data-goto 기준, 화면마다 같은 토글이 있다)
  document.querySelectorAll('[data-goto]').forEach(el => {
    const on = el.dataset.goto === tab;
    el.classList.toggle('active', on);
    if (on) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  const scroller = document.getElementById('screens');
  if (scroller) scroller.scrollTop = 0;
  if (tab === 'calendar') renderCalendar();
  if (tab === 'graph') renderGraph();
  if (tab === 'mypage') renderMypage();
  if (tab === 'home') updateStatus();
}

/* ── 메뉴 시트 ── */
function openMenuSheet() {
  const el = document.getElementById('menu-sheet');
  if (el) el.classList.add('open');
}
function closeMenuSheet() {
  const el = document.getElementById('menu-sheet');
  if (el) el.classList.remove('open');
}
function closeMenuSheetOutside(e) {
  if (e.target === document.getElementById('menu-sheet')) closeMenuSheet();
}

/* ── 기록 선택 시트 ── */
function openRecordSheet() {
  document.getElementById('record-sheet').classList.add('open');
}
function closeRecordSheet() {
  document.getElementById('record-sheet').classList.remove('open');
}
function closeRecordSheetOutside(e) {
  if (e.target === document.getElementById('record-sheet')) closeRecordSheet();
}

/* ── 기록 상세 ── */
function openRecordDetail(type) {
  const modal = document.getElementById('record-detail-modal');
  const title = document.getElementById('record-detail-title');
  const content = document.getElementById('record-detail-content');
  if (!modal || !content) return;
  modal.dataset.type = type;

  if (type === 'period') {
    title.textContent = '생리 기록';
    const records = loadRecords().sort((a, b) => a.start > b.start ? -1 : 1);
    if (!records.length) {
      content.innerHTML = '<div class="empty-state">아직 생리 기록이 없어요.</div>';
    } else {
      content.innerHTML = records.map((r, i) => {
        const [sy, sm, sd] = r.start.split('-');
        const [, em, ed] = r.end.split('-');
        const dur = dateDiff(r.end, r.start) + 1;
        return `<div class="record-item">
          <div>
            <div class="record-date">${parseInt(sm)}월 ${parseInt(sd)}일 ~ ${parseInt(em)}월 ${parseInt(ed)}일</div>
            <div class="record-meta">${sy}년 · ${dur}일간</div>
          </div>
          <div class="rec-btns">
            <button class="record-edit" onclick="editRecord(${i});document.getElementById('record-detail-modal').classList.remove('open')">수정</button>
            <button class="record-delete" onclick="deleteRecord(${i})">삭제</button>
          </div>
        </div>`;
      }).join('');
    }
  } else {
    title.textContent = '상태 기록';
    const logs = loadLogs();
    const dates = Object.keys(logs).sort().reverse();
    if (!dates.length) {
      content.innerHTML = '<div class="empty-state">아직 상태 기록이 없어요.</div>';
    } else {
      content.innerHTML = dates.map(ds => {
        const [y, m, d] = ds.split('-');
        const entry = logs[ds];
        const allTags = [...(entry.mood || []), ...(entry.symptom || []), ...(entry.energy || []), ...(entry.etc || [])];
        return `<div>
          <div class="log-date-header">
            <div class="log-date-label">${parseInt(m)}월 ${parseInt(d)}일 <span class="yr">${y}</span></div>
            <button class="log-edit-btn" onclick="document.getElementById('record-detail-modal').classList.remove('open');setTimeout(()=>openLogModal('${ds}'),200)">수정</button>
          </div>
          <div class="log-tag-display">
            ${allTags.map(t => `<span class="log-tag-chip">${escapeHtml(t)}</span>`).join('')}
          </div>
        </div>`;
      }).join('');
    }
  }
  modal.classList.add('open');
}

function closeRecordDetail(e) {
  if (e.target === document.getElementById('record-detail-modal'))
    document.getElementById('record-detail-modal').classList.remove('open');
}
