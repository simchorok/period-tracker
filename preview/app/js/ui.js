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
    name: '생리기', season: '겨울', cls: 'winter', color: '#A6B8DE',
    note: '몸이 쉬어가는 때예요. 아무것도 하지 않아도 괜찮아요.'
  },
  spring: {
    name: '여포기', season: '봄', cls: 'spring', color: '#A9E3C6',
    note: '기운이 다시 차오르는 때예요.'
  },
  summer: {
    name: '배란기', season: '여름', cls: 'summer', color: '#F2CE8C',
    note: '가장 밝게 빛나는 때예요.'
  },
  autumn: {
    name: '황체기', season: '가을', cls: 'autumn', color: '#D9A08B',
    note: '마음이 조금 예민해지는 때예요.'
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

/* ── 홈: 궤도 그리기 ── */
const ORBIT_CX = 180, ORBIT_CY = 180, ORBIT_R = 138;

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

  // 눈금
  let ticks = '';
  for (let d = 1; d <= cycle; d++) {
    const major = (d === 1 || d === day);
    const r1 = major ? ORBIT_R - 10 : ORBIT_R - 6;
    const r2 = ORBIT_R + (major ? 10 : 6);
    const a = _orbitPt(r1, d, cycle), b = _orbitPt(r2, d, cycle);
    ticks += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${day > 0 && d <= day ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.11)'}" stroke-width="${major ? 1.4 : 1}" stroke-linecap="round"/>`;
  }
  ticksG.innerHTML = ticks;

  // 사계절 아크
  const active = phaseKey;
  let arcs = '';
  seasonBounds(cycle).forEach(s => {
    const c = CYCLE_PHASES[s.key].color;
    const isActive = s.key === active;
    const from = Math.max(0.2, s.from - 0.45);
    const to = Math.min(cycle + 0.6, s.to + 0.45);
    if (to - from < 0.9) return;
    arcs += `<path d="${_orbitArc(ORBIT_R, from, to, cycle)}" fill="none" stroke="${c}" stroke-width="${isActive ? 3 : 2}" stroke-linecap="round" opacity="${isActive ? '.95' : '.34'}"/>`;
  });
  arcsG.innerHTML = arcs;

  // 오늘까지 지나온 아크
  let prog = '';
  const endDay = Math.max(0, Math.min(day, cycle));
  if (endDay > 1) {
    prog += `<path d="${_orbitArc(ORBIT_R, 1, endDay, cycle)}" fill="none" stroke="url(#progGrad)" stroke-width="3" stroke-linecap="round" opacity=".9" filter="url(#dotGlow)"/>`;
  }
  if (endDay >= 1) {
    const m = _orbitPt(ORBIT_R, endDay, cycle);
    prog += `<circle class="halo" cx="${m[0].toFixed(1)}" cy="${m[1].toFixed(1)}" r="11" fill="${phaseKey ? CYCLE_PHASES[phaseKey].color : '#A9E3C6'}" opacity=".16"/>`;
    prog += `<circle cx="${m[0].toFixed(1)}" cy="${m[1].toFixed(1)}" r="4.2" fill="#FBF6EE" filter="url(#dotGlow)"/>`;
    prog += `<circle cx="${m[0].toFixed(1)}" cy="${m[1].toFixed(1)}" r="1.8" fill="${phaseKey ? CYCLE_PHASES[phaseKey].color : '#A9E3C6'}"/>`;
  }
  progG.innerHTML = prog;

  // 달 위상
  const shade = document.getElementById('moon-shade');
  if (shade) shade.innerHTML = phaseKey ? (MOON_SHADE[phaseKey] || '') : MOON_SHADE.winter;

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
  const dayEl = document.getElementById('orb-day');
  const unitEl = document.getElementById('orb-day-unit');
  const seasonEl = document.getElementById('orb-season');
  const hintEl = document.getElementById('hint-text');
  const hintDot = document.getElementById('hint-dot');
  const noteEl = document.getElementById('phase-note');

  if (!records.length) {
    renderOrbit({ cycle: 28, day: 0, phaseKey: null });
    if (dayEl) dayEl.textContent = '—';
    if (unitEl) unitEl.textContent = '일째';
    if (seasonEl) { seasonEl.textContent = '달의 기록'; seasonEl.className = 'orb-season'; }
    if (hintEl) hintEl.textContent = '기록을 시작해보세요';
    if (hintDot) hintDot.className = '';
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

    if (dayEl) dayEl.textContent = dayOfCycle;
    if (unitEl) unitEl.textContent = '일째';
    if (seasonEl) {
      seasonEl.textContent = phase.name;
      seasonEl.className = `orb-season ${phase.cls}`;
    }

    if (hintEl) {
      if (inPeriod) hintEl.textContent = `생리 ${dayOfCycle}일째`;
      else if (diff === 0) hintEl.textContent = '오늘 예상 생리 시작일';
      else if (diff > 0) hintEl.textContent = `다음 생리 D-${diff}`;
      else hintEl.textContent = `생리 예정일이 ${Math.abs(diff)}일 지났어요`;
    }
    if (hintDot) hintDot.className = phase.cls;

    if (noteEl) {
      noteEl.textContent = (dayOfCycle > cycle + 5)
        ? '이번 주기가 조금 길어지고 있어요. 몸의 신호를 살펴봐요.'
        : phase.note;
    }
  }

  if (typeof checkReportBanner === 'function') await checkReportBanner();
  if (typeof checkQuestionBanner === 'function') await checkQuestionBanner();
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

  updateNicknameUI();

  const records = loadRecords();
  const logs = loadLogs();
  const cycle = calcAvgCycle(records);
  const avgDur = records.length
    ? Math.round(records.reduce((s, r) => s + dateDiff(r.end, r.start) + 1, 0) / records.length)
    : 0;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };
  set('mypage-avg-cycle', records.length >= 2 ? unitHtml(cycle, '일') : '—');
  set('mypage-avg-dur', records.length ? unitHtml(avgDur, '일') : '—');
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
    const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTo({ top: Math.max(0, top - 96), behavior: 'smooth' });
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
  svg.innerHTML = '';
  const W = svg.parentElement.offsetWidth || 300;
  const H = 80;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);

  if (values.length < 2) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', W / 2); text.setAttribute('y', H / 2);
    text.setAttribute('text-anchor', 'middle'); text.setAttribute('fill', 'rgba(244,239,232,.26)');
    text.setAttribute('font-size', '11'); text.textContent = '기록이 2개 이상 필요해요';
    svg.appendChild(text); return;
  }

  const pad = { l: 16, r: 20, t: 14, b: 20 };
  const minV = Math.min(...values) - 2, maxV = Math.max(...values) + 2;
  const range = maxV - minV || 1;
  const xStep = (W - pad.l - pad.r) / (values.length - 1);

  const toX = i => pad.l + i * xStep;
  const toY = v => pad.t + (1 - (v - minV) / range) * (H - pad.t - pad.b);

  // 평균선
  const avgY = toY(avgVal);
  const avgLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  avgLine.setAttribute('x1', pad.l); avgLine.setAttribute('x2', W - pad.r);
  avgLine.setAttribute('y1', avgY); avgLine.setAttribute('y2', avgY);
  avgLine.setAttribute('stroke', 'rgba(255,255,255,.12)'); avgLine.setAttribute('stroke-width', '1');
  avgLine.setAttribute('stroke-dasharray', '4 3');
  svg.appendChild(avgLine);

  // 라인
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d); path.setAttribute('fill', 'none');
  path.setAttribute('stroke', colorStroke); path.setAttribute('stroke-width', '1.5');
  path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);

  // 점 + 라벨
  values.forEach((v, i) => {
    const cx = toX(i), cy = toY(v);
    const isLast = (i === values.length - 1);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); circle.setAttribute('r', isLast ? 4 : 3);
    circle.setAttribute('fill', isLast ? colorStroke : '#161020');
    circle.setAttribute('stroke', colorStroke); circle.setAttribute('stroke-width', '1.5');
    svg.appendChild(circle);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', cx); label.setAttribute('y', H - 4);
    label.setAttribute('text-anchor', 'middle'); label.setAttribute('fill', 'rgba(244,239,232,.24)');
    label.setAttribute('font-size', '9'); label.textContent = `${i + 1}`;
    svg.appendChild(label);

    const spread = Math.max(...values) - Math.min(...values);
    if (isLast || (spread >= 3 && (v === Math.max(...values) || v === Math.min(...values)))) {
      const vLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      vLabel.setAttribute('x', cx); vLabel.setAttribute('y', cy - 8);
      vLabel.setAttribute('text-anchor', 'middle');
      vLabel.setAttribute('fill', isLast ? colorStroke : 'rgba(244,239,232,.55)');
      vLabel.setAttribute('font-size', '10'); vLabel.setAttribute('font-weight', isLast ? '500' : '400');
      vLabel.textContent = v;
      svg.appendChild(vLabel);
    }
  });
}

function renderGraph() {
  const records = loadRecords().sort((a, b) => a.start > b.start ? 1 : -1);

  // 주기
  const cycles = [];
  for (let i = 1; i < records.length; i++) {
    const d = dateDiff(records[i].start, records[i - 1].start);
    if (d > 10 && d < 60) cycles.push(d);
  }
  const avgCycleEl = document.getElementById('avg-cycle-num');
  if (cycles.length >= 1) {
    const avg = Math.round(cycles.reduce((s, v) => s + v, 0) / cycles.length);
    const mn = Math.min(...cycles), mx = Math.max(...cycles);
    if (avgCycleEl) avgCycleEl.innerHTML = unitHtml(avg, '일');
    drawLineChart('cycle-chart', cycles, avg, '#F2CE8C');
    const row = document.getElementById('cycle-stat-row');
    if (row) row.innerHTML = `
      <div class="stat-pill"><div class="stat-pill-val">${unitHtml(mn, '일')}</div><div class="stat-pill-label">최단 주기</div></div>
      <div class="stat-pill"><div class="stat-pill-val">${unitHtml(mx, '일')}</div><div class="stat-pill-label">최장 주기</div></div>
      <div class="stat-pill"><div class="stat-pill-val">${unitHtml(cycles.length, '회')}</div><div class="stat-pill-label">측정 횟수</div></div>`;
  } else {
    if (avgCycleEl) avgCycleEl.textContent = '—';
    drawLineChart('cycle-chart', [], 0, '#F2CE8C');
    const row = document.getElementById('cycle-stat-row');
    if (row) row.innerHTML = '';
  }

  // 기간
  const durs = records.map(r => dateDiff(r.end, r.start) + 1);
  const avgDurEl = document.getElementById('avg-dur-num');
  if (durs.length >= 1) {
    const avg = Math.round(durs.reduce((s, v) => s + v, 0) / durs.length);
    const mn = Math.min(...durs), mx = Math.max(...durs);
    if (avgDurEl) avgDurEl.innerHTML = unitHtml(avg, '일');
    drawLineChart('dur-chart', durs, avg, '#A9E3C6');
    const row = document.getElementById('dur-stat-row');
    if (row) row.innerHTML = `
      <div class="stat-pill"><div class="stat-pill-val">${unitHtml(mn, '일')}</div><div class="stat-pill-label">최단 기간</div></div>
      <div class="stat-pill"><div class="stat-pill-val">${unitHtml(mx, '일')}</div><div class="stat-pill-label">최장 기간</div></div>
      <div class="stat-pill"><div class="stat-pill-val">${unitHtml(durs.length, '회')}</div><div class="stat-pill-label">기록 횟수</div></div>`;
  } else {
    if (avgDurEl) avgDurEl.textContent = '—';
    drawLineChart('dur-chart', [], 0, '#A9E3C6');
    const row = document.getElementById('dur-stat-row');
    if (row) row.innerHTML = '';
  }
}

/* ── 탭 전환 ── */
function switchTab(tab) {
  ['home', 'calendar', 'graph', 'mypage'].forEach(t => {
    const section = document.getElementById(`tab-${t}`);
    if (section) section.classList.toggle('active', t === tab);
    const navEl = document.getElementById(`nav-${t}`);
    if (navEl) {
      navEl.classList.toggle('active', t === tab);
      if (t === tab) navEl.setAttribute('aria-current', 'page');
      else navEl.removeAttribute('aria-current');
    }
  });
  const scroller = document.getElementById('screens');
  if (scroller) scroller.scrollTop = 0;
  if (tab === 'calendar') renderCalendar();
  if (tab === 'graph') renderGraph();
  if (tab === 'mypage') renderMypage();
  if (tab === 'home') updateStatus();
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
