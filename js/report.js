/* 달의 기록 — 월간 사이클 리포트: 렌더링, AI 분석(analyze-cycle), 피드백 */
  /* ── 월간 사이클 리포트 ── */

  async function checkReportBanner() {
    if (!currentUser) return;
    const today = getTodayStr();
    const records = loadRecords();

    if (records.length >= 1) {
      const last = [...records].sort((a,b) => a.start > b.start ? -1 : 1)[0];
      const dayAfterEnd = addDays(last.end, 1);

      // appStartDate: DB user_profiles.created_at 기준 (회원가입일)
      const { data: profile } = await sb.from('user_profiles')
        .select('created_at').eq('id', currentUser.id).maybeSingle();
      const appStartDate = profile?.created_at?.slice(0, 10) ?? today;

      if (today >= dayAfterEnd && dayAfterEnd >= appStartDate) {
        // 동일 start_date 기준으로 완성된 리포트 있는지 확인
        const { data } = await sb.from('cycle_reports')
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('period_start_date', last.start)
          .not('feedback_rating', 'is', null)
          .maybeSingle();
        if (data) {
          document.getElementById('report-banner').classList.remove('show');
          return;
        }
        const [y, m] = last.start.split('-');
        document.getElementById('report-banner').classList.add('show');
        document.getElementById('report-banner-title').textContent = `${y}년 ${parseInt(m)}월 사이클 리포트가 도착했어요`;
      }
    } else {
      // CASE2: 생리 기록 없음 → 매월 1일부터 저장 전까지 노출
      const monthKey = `report_seen_noPeriod_${today.slice(0,7)}`;
      if (!localStorage.getItem(monthKey)) {
        document.getElementById('report-banner').classList.add('show');
        document.getElementById('report-banner-title').textContent = `${parseInt(today.slice(5,7))}월 사이클 리포트가 도착했어요`;
      }
    }
  }

  function openReport() {
    const records = loadRecords().sort((a,b) => a.start > b.start ? -1 : 1);
    const _t = new Date();
    const todayStr = `${_t.getFullYear()}-${String(_t.getMonth()+1).padStart(2,'0')}-${String(_t.getDate()).padStart(2,'0')}`;

    // CASE2: 생리 기록 없는 유저
    if (!records.length) {
      const monthKey = `report_seen_noPeriod_${todayStr.slice(0,7)}`;
      document.getElementById('report-title').textContent = `${parseInt(todayStr.slice(5,7))}월 사이클 리포트`;
      document.getElementById('report-sub').textContent = `${todayStr.slice(0,7).replace('-','/')} 월간 기록`;
      // 요약/패턴/에너지 섹션 숨기기 (생리 데이터 없으므로)
      document.getElementById('report-summary').innerHTML = '<div style="font-size:13px;color:#aaa;padding:8px 0;">생리 기록을 입력하면 더 정확한 사이클 분석을 드릴 수 있어요 🌿</div>';
      document.getElementById('report-phases').innerHTML = '';
      document.getElementById('report-forecast').innerHTML = '';
      document.getElementById('report-backdrop').classList.add('open');
      localStorage.setItem(monthKey, '1');
      document.getElementById('report-banner').classList.remove('show');
      // AI 분석 호출 (CASE2)
      const pseudoEndDate = todayStr;
      currentReportEndDate = pseudoEndDate;
      currentReportRecord = { start: todayStr, end: pseudoEndDate };
      resetReportFeedback();
      generateAIAnalysis([], { end: pseudoEndDate });
      return;
    }

    // CASE1: 생리 기록 있는 유저
    const lastRecord = records[0];
    const [y, m] = lastRecord.start.split('-');
    document.getElementById('report-title').textContent = `${y}년 ${parseInt(m)}월 사이클 리포트`;
    document.getElementById('report-sub').textContent =
      `${lastRecord.start.slice(5).replace('-','/')} ~ ${lastRecord.end.slice(5).replace('-','/')}`;

    renderReportSummary(records);
    renderReportPhases(records, lastRecord);
    renderReportEnergyChart(lastRecord);
    renderReportForecast(records, lastRecord);

    document.getElementById('report-backdrop').classList.add('open');
    localStorage.setItem(`report_seen_${lastRecord.end}`, '1');
    document.getElementById('report-banner').classList.remove('show');
    // AI 분석 호출 (CASE1)
    currentReportEndDate = lastRecord.end;
    currentReportRecord = lastRecord;
    resetReportFeedback();
    generateAIAnalysis(records, lastRecord);
  }

  function closeReport() {
    document.getElementById('report-backdrop').classList.remove('open');
    currentReportEndDate = null;
  }
  function closeReportOutside(e) {
    if (e.target === document.getElementById('report-backdrop')) closeReport();
  }

  function renderReportSummary(records) {
    const last = records[0];
    const prev = records[1] || null;
    const dur = dateDiff(last.end, last.start) + 1;
    const cycle = records.length >= 2 ? dateDiff(last.start, records[1].start) : null;
    const prevDur = prev ? dateDiff(prev.end, prev.start) + 1 : null;
    const prevCycle = records.length >= 3 ? dateDiff(records[1].start, records[2].start) : null;

    const durChange = prevDur ? dur - prevDur : null;
    const cycleChange = (cycle && prevCycle) ? cycle - prevCycle : null;

    const logs = loadLogs();
    // 이번 사이클 로그 수
    let logCount = 0;
    for (let d = new Date(last.start.replace(/-/g,'/')); d <= new Date(last.end.replace(/-/g,'/')); d.setDate(d.getDate()+1)) {
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (logs[ds]) logCount++;
    }

    const changeHtml = (val) => {
      if (val === null) return '';
      if (val > 0) return `<div class="report-summary-change up">▲ ${val}일</div>`;
      if (val < 0) return `<div class="report-summary-change down">▼ ${Math.abs(val)}일</div>`;
      return `<div class="report-summary-change same">변화없음</div>`;
    };

    document.getElementById('report-summary').innerHTML = `
      <div class="report-summary-item">
        <div class="report-summary-val">${dur}일</div>
        <div class="report-summary-label">생리 기간</div>
        ${changeHtml(durChange)}
      </div>
      <div class="report-summary-item">
        <div class="report-summary-val">${cycle ? cycle+'일' : '—'}</div>
        <div class="report-summary-label">이번 주기</div>
        ${changeHtml(cycleChange)}
      </div>
      <div class="report-summary-item">
        <div class="report-summary-val">${logCount}일</div>
        <div class="report-summary-label">상태 기록일수</div>
        <div class="report-summary-change same">이번 사이클</div>
      </div>
      <div class="report-summary-item">
        <div class="report-summary-val">${records.length}회</div>
        <div class="report-summary-label">누적 기록</div>
        <div class="report-summary-change same">전체</div>
      </div>
    `;
  }

  function renderReportPhases(records, lastRecord) {
    const logs = loadLogs();
    const cycle = calcAvgCycle(records);
    const phases = ['winter','spring','summer','autumn'];
    const phaseInfo = {
      winter: { icon: '❄️', name: '겨울 · 생리기' },
      spring: { icon: '🌱', name: '봄 · 여포기' },
      summer: { icon: '☀️', name: '여름 · 배란기' },
      autumn: { icon: '🍂', name: '가을 · 황체기' },
    };
    const phaseTags = { winter:[], spring:[], summer:[], autumn:[] };

    const start = new Date(lastRecord.start.replace(/-/g,'/'));
    for (let day = 1; day <= cycle; day++) {
      const d = new Date(start);
      d.setDate(d.getDate() + day - 1);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const phase = getCyclePhase(day, cycle);
      const log = logs[ds];
      if (!log) continue;
      const tags = [...(log.mood||[]), ...(log.symptom||[]), ...(log.energy||[])];
      tags.forEach(t => {
        if (!phaseTags[phase].includes(t)) phaseTags[phase].push(t);
      });
    }

    const totalPhaseTags = Object.values(phaseTags).reduce((s,a)=>s+a.length,0);
    document.getElementById('report-phases').innerHTML = phases.map(p => {
      const info = phaseInfo[p];
      const tags = phaseTags[p].slice(0, 4);
      return `<div class="report-phase-row">
        <div class="report-phase-icon">${info.icon}</div>
        <div class="report-phase-info">
          <div class="report-phase-name">${info.name}</div>
          ${tags.length
            ? `<div class="report-phase-tags">${tags.map(t=>`<span class="report-phase-tag">${t}</span>`).join('')}</div>`
            : `<div class="report-phase-empty">기록된 데이터가 없어요</div>`}
        </div>
      </div>`;
    }).join('') + (totalPhaseTags === 0
      ? `<div style="margin-top:12px;font-size:12px;color:#bbb;text-align:center;line-height:1.7">상태 기록을 입력하면 해당 데이터를 분석해서 더 많은 인사이트를 드릴 수 있어요 ✍️</div>`
      : '');
  }

  function renderReportEnergyChart(lastRecord) {
    const logs = loadLogs();
    const energyMap = { '활력 넘쳐요':4, '보통이에요':3, '좀 처져요':2, '완전 방전':1 };
    const points = [];
    const start = new Date(lastRecord.start.replace(/-/g,'/'));
    const end = new Date(lastRecord.end.replace(/-/g,'/'));
    // 사이클 전체 (시작 ~ 다음 생리 전)
    const dur = dateDiff(lastRecord.end, lastRecord.start) + 1;
    for (let day = 0; day < Math.min(dur, 40); day++) {
      const d = new Date(start);
      d.setDate(d.getDate() + day);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const log = logs[ds];
      const energy = log?.energy?.[0];
      points.push(energy ? (energyMap[energy] || 2.5) : null);
    }

    const svg = document.getElementById('report-energy-chart');
    svg.innerHTML = '';
    const W = 340; const H = 80;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.width = '100%';

    const validPoints = points.filter(p => p !== null);
    if (validPoints.length < 2) {
      const fo = document.createElementNS('http://www.w3.org/2000/svg','foreignObject');
      fo.setAttribute('x','0'); fo.setAttribute('y','0');
      fo.setAttribute('width', W); fo.setAttribute('height', H);
      fo.innerHTML = `<div xmlns="http://www.w3.org/2000/svg" style="display:flex;align-items:center;justify-content:center;height:${H}px;font-size:12px;color:#bbb;text-align:center;line-height:1.7;padding:0 8px">상태 기록을 입력하면 해당 데이터를 분석해서 더 많은 인사이트를 드릴 수 있어요 ✍️</div>`;
      svg.appendChild(fo); return;
    }

    const pad = {l:8,r:8,t:8,b:20};
    const xStep = (W-pad.l-pad.r) / (points.length-1);
    const toX = i => pad.l + i * xStep;
    const toY = v => pad.t + (1-(v-1)/3) * (H-pad.t-pad.b);

    // 단계별 배경
    const winterEnd = 6;
    const bgColors = ['#e8edf8','#e8f4ee','#fef8e8','#fdf0e8'];
    const phases2 = [
      {start:0, end:Math.min(winterEnd, points.length), color:'#e8edf820'},
    ];

    // 라인 그리기 (null 건너뜀)
    let pathD = '';
    let started = false;
    points.forEach((p, i) => {
      if (p === null) { started = false; return; }
      const x = toX(i).toFixed(1), y = toY(p).toFixed(1);
      pathD += started ? ` L${x},${y}` : `M${x},${y}`;
      started = true;
    });

    if (pathD) {
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d', pathD); path.setAttribute('fill','none');
      path.setAttribute('stroke','#c9607a'); path.setAttribute('stroke-width','2');
      path.setAttribute('stroke-linecap','round'); path.setAttribute('stroke-linejoin','round');
      svg.appendChild(path);
    }

    // 점
    points.forEach((p, i) => {
      if (p === null) return;
      const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
      circle.setAttribute('cx', toX(i)); circle.setAttribute('cy', toY(p));
      circle.setAttribute('r', '3'); circle.setAttribute('fill','#c9607a');
      svg.appendChild(circle);
    });

    // 라벨
    ['1','활력','보통','처짐','방전'].forEach((l,i) => {});
    const labels = ['방전','처짐','보통','활력'];
    labels.forEach((l,i) => {
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x', 2); t.setAttribute('y', toY(i+1)+4);
      t.setAttribute('fill','#bbb'); t.setAttribute('font-size','8');
      t.textContent = l; svg.appendChild(t);
    });
  }


  function renderReportForecast(records, lastRecord) {
    const el = document.getElementById('report-forecast');
    if (records.length < 2) {
      el.innerHTML = `<div style="text-align:center;padding:12px 0;font-size:12px;color:#bbb;line-height:1.7">상태 기록을 입력하면 해당 데이터를 분석해서 더 많은 인사이트를 드릴 수 있어요 ✍️<br><br>또한 2사이클이 쌓이면 다음 사이클 예고를 보내드릴게요 🔮</div>`;
      return;
    }

    const logs = loadLogs();
    const cycle = calcAvgCycle(records);
    const phaseTagCounts = { winter:{}, spring:{}, summer:{}, autumn:{} };

    records.slice(1).forEach(r => {
      const start = new Date(r.start.replace(/-/g,'/'));
      for (let day = 1; day <= cycle; day++) {
        const d = new Date(start);
        d.setDate(d.getDate() + day - 1);
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const phase = getCyclePhase(day, cycle);
        const log = logs[ds];
        if (!log) continue;
        const tags = [...(log.mood||[]), ...(log.symptom||[])];
        tags.forEach(t => { phaseTagCounts[phase][t] = (phaseTagCounts[phase][t] || 0) + 1; });
      }
    });

    const totalPast = records.length - 1;
    const threshold = Math.max(1, Math.floor(totalPast * 0.5));
    const phaseEmoji = { winter:'❄️', spring:'🌱', summer:'☀️', autumn:'🍂' };
    const phaseNames = { winter:'생리기', spring:'여포기', summer:'배란기', autumn:'황체기' };
    const forecasts = [];

    Object.entries(phaseTagCounts).forEach(([phase, tagCounts]) => {
      Object.entries(tagCounts).forEach(([tag, count]) => {
        if (count >= threshold) forecasts.push({ phase, tag });
      });
    });

    if (!forecasts.length) {
      el.innerHTML = '<div style="text-align:center;padding:12px 0;font-size:12px;color:#bbb;line-height:1.7">상태 기록을 입력하면 해당 데이터를 분석해서 더 많은 인사이트를 드릴 수 있어요 ✍️</div>';
      return;
    }

    el.innerHTML = forecasts.slice(0, 3).map(f =>
      `<div class="report-forecast-item">
        <div class="report-forecast-badge">${phaseEmoji[f.phase]} ${phaseNames[f.phase]}</div>
        <div class="report-forecast-text"><strong>${f.tag}</strong>이(가) 나타날 수 있어요. 미리 대비해봐요 💙</div>
      </div>`
    ).join('');
  }

  async function openReportList() {
    if (!currentUser) return;
    const content = document.getElementById('report-list-content');
    content.innerHTML = '<div style="text-align:center;padding:32px;color:#aaa;font-size:13px;">불러오는 중...</div>';
    document.getElementById('report-list-backdrop').classList.add('open');

    // DB에서 feedback_rating 있는(완성된) 리포트만 조회
    const { data: savedReports } = await sb.from('cycle_reports')
      .select('*')
      .eq('user_id', currentUser.id)
      .not('feedback_rating', 'is', null)
      .order('period_end_date', { ascending: false });

    if (!savedReports || !savedReports.length) {
      content.innerHTML = `
        <div class="report-empty-state">
          <div class="report-empty-icon">🌙</div>
          <div class="report-empty-text">아직 완성된 사이클 리포트가 없어요.<br><br>리포트가 도착하면 별점을 남겨<br>리포트를 완성해보세요!</div>
        </div>`;
      return;
    }

    const records = loadRecords();
    content.innerHTML = savedReports.map((report, i) => {
      const endDate = report.period_end_date;
      const matched = records.find(r => r.end === endDate);
      const startDate = matched?.start || endDate;
      const [y, m] = startDate.split('-');
      const dur = matched ? dateDiff(endDate, startDate) + 1 : '—';
      const stars = '⭐'.repeat(report.feedback_rating || 0);
      return `<div class="report-list-item" onclick="openReportByEndDate('${endDate}')">
        <div class="report-list-item-left">
          <div class="report-list-item-title">${y}년 ${parseInt(m)}월 사이클 리포트</div>
          <div class="report-list-item-sub">${startDate.slice(5).replace('-','/')} ~ ${endDate.slice(5).replace('-','/')} · ${dur}일간 ${stars}</div>
        </div>
        <div class="report-list-item-arrow">›</div>
      </div>`;
    }).join('');
  }

  function closeReportList() {
    document.getElementById('report-list-backdrop').classList.remove('open');
  }

  function closeReportListOutside(e) {
    if (e.target === document.getElementById('report-list-backdrop')) closeReportList();
  }

  function openReportByRecord(idx) {
    const records = loadRecords().sort((a,b) => a.start > b.start ? -1 : 1);
    const today = getTodayStr();
    const sentReports = records.filter(r => addDays(r.end, 1) <= today);
    const target = sentReports[idx];
    if (!target) return;

    const [y, m] = target.start.split('-');
    document.getElementById('report-title').textContent = `${y}년 ${parseInt(m)}월 사이클 리포트`;
    document.getElementById('report-sub').textContent =
      `${target.start.slice(5).replace('-','/')} ~ ${target.end.slice(5).replace('-','/')}`;
    const reorderedRecords = [target, ...records.filter(r => r.start !== target.start)];
    renderReportSummary(reorderedRecords);
    renderReportPhases(reorderedRecords, target);
    renderReportEnergyChart(target);
    renderReportForecast(reorderedRecords, target);

    // 목록 숨기고 상세 열기
    document.getElementById('report-list-backdrop').classList.remove('open');
    document.getElementById('report-backdrop').classList.add('open');
    // AI 분석 호출
    currentReportEndDate = target.end;
    currentReportRecord = target;
    resetReportFeedback();
    generateAIAnalysis(reorderedRecords, target);
  }

  function openReportByEndDate(endDate) {
    const records = loadRecords().sort((a,b) => a.start > b.start ? -1 : 1);
    const target = records.find(r => r.end === endDate) || { start: endDate, end: endDate };
    const [y, m] = target.start.split('-');
    document.getElementById('report-title').textContent = `${y}년 ${parseInt(m)}월 사이클 리포트`;
    document.getElementById('report-sub').textContent =
      `${target.start.slice(5).replace('-','/')} ~ ${target.end.slice(5).replace('-','/')}`;
    const reorderedRecords = [target, ...records.filter(r => r.start !== target.start)];
    renderReportSummary(reorderedRecords);
    renderReportPhases(reorderedRecords, target);
    renderReportEnergyChart(target);
    renderReportForecast(reorderedRecords, target);
    document.getElementById('report-list-backdrop').classList.remove('open');
    document.getElementById('report-backdrop').classList.add('open');
    currentReportEndDate = target.end;
    currentReportRecord = target;
    resetReportFeedback();
    generateAIAnalysis(reorderedRecords, target);
  }


  let currentReportEndDate = null;


  let currentReportRecord = null; // _retryRecord와 통합된 변수
  let reportFeedbackRating = 0;
  let currentAIAnalysis = null; // AI 분석 결과 임시 저장 (저장 버튼 클릭 전까지)

  // ── AI 분석 생성 ──
  async function generateAIAnalysis(records, targetRecord) {
    if (!currentUser) return;

    // DB에 이미 저장된 분석 있으면 불러오기
    const existing = await loadReportFromDB(targetRecord.end);
    if (existing?.ai_analysis) {
      currentAIAnalysis = existing.ai_analysis;
      renderAIAnalysis(existing.ai_analysis);
      if (existing.feedback_rating) {
        restoreReportFeedback(existing);
      }
      return;
    }

    // 없으면 Edge Function 호출
    try {
      const caseType = records.length >= 1 ? 'CASE1' : 'CASE2';

      // ④ access_token null 체크
      const session = (await sb.auth.getSession()).data.session;
      if (!session?.access_token) {
        document.getElementById('report-ai-content').innerHTML = `
          <div class="report-ai-error">
            세션이 만료됐어요. 다시 로그인해주세요.
          </div>`;
        return;
      }

      const { data, error } = await sb.functions.invoke('analyze-cycle', {
        body: {
          user_id: currentUser.id,
          period_end_date: targetRecord.end,
          period_start_date: targetRecord.start ?? null,
          case_type: caseType,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        // 에러 코드별 구체적 메시지
        const msg = error.message || '';
        if (msg.includes('초과')) showAIError(msg);
        else if (msg.includes('18일')) showAIError(msg);
        else if (msg.includes('생리 기간')) showAIError(msg);
        else throw error;
        return;
      }

      if (data.status === 'already_exists') {
        currentAIAnalysis = data.ai_analysis;
        renderAIAnalysis(data.ai_analysis);
        return;
      }

      if (data.status === 'no_data') {
        showAIError('아직 상태 기록이 없어요.<br>매일 기록을 남기면 AI 분석을 받을 수 있어요 🌿');
        return;
      }

      // 결과 임시 저장 (저장하기 클릭 시 DB에 저장)
      currentAIAnalysis = data.ai_analysis;
      renderAIAnalysis(data.ai_analysis);

    } catch(e) {
      console.error('AI 분석 오류:', e);
      showAIError('분석 중 오류가 발생했어요.<br>다시 시도해주세요.<br><button class="report-ai-retry" onclick="retryAIAnalysis()">다시 시도</button>');
    }
  }

  // AI 에러 메시지 표시 헬퍼
  function showAIError(msg) {
    document.getElementById('report-ai-content').innerHTML =
      `<div class="report-ai-error">${msg}</div>`;
  }

  function renderAIAnalysis(rawText) {
    let parsed = null;
    try {
      parsed = typeof rawText === 'string' ? JSON.parse(rawText) : rawText;
    } catch {
      parsed = null;
    }

    if (!parsed) {
      document.getElementById('report-ai-content').innerHTML =
        `<div class="report-ai-text">${rawText}</div>`;
      return;
    }

    const noDataMsg = '상태 기록을 입력하면 해당 데이터를 분석해서 더 많은 인사이트를 드릴 수 있어요 🌿';

    document.getElementById('report-ai-content').innerHTML = `
      <div class="report-ai-section">
        <div class="report-ai-label">📋 이번 사이클 요약</div>
        <div class="report-ai-text">${escapeHtml(parsed.summary) || '-'}</div>
      </div>
      <div class="report-ai-section">
        <div class="report-ai-label">🌿 사이클 단계별 패턴</div>
        <div class="report-ai-text">${escapeHtml(parsed.pattern) || noDataMsg}</div>
      </div>
      <div class="report-ai-section">
        <div class="report-ai-label">⚡ 에너지 흐름</div>
        <div class="report-ai-text">${escapeHtml(parsed.energy_flow) || noDataMsg}</div>
      </div>
      <div class="report-ai-section ${parsed.next_preview ? '' : 'report-ai-locked'}">
        <div class="report-ai-label">🔮 다음 사이클 예고</div>
        <div class="report-ai-text">${escapeHtml(parsed.next_preview) || '2사이클이 쌓이면 예고해드릴게요 🔒'}</div>
      </div>
      <div class="report-ai-encouragement">
        💌 ${escapeHtml(parsed.encouragement) || ''}
      </div>
    `;
    // AI 분석 완료 후 이미 별점 선택됐으면 버튼 활성화
    checkFeedbackComplete();
  }

  function retryAIAnalysis() {
    if (!currentReportRecord) return;
    const records = loadRecords().sort((a,b) => a.start > b.start ? -1 : 1);
    generateAIAnalysis(records, currentReportRecord);
  }

  async function loadReportFromDB(endDate) {
    if (!currentUser) return null;
    const { data } = await sb.from('cycle_reports')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('period_end_date', endDate)
      .maybeSingle();
    return data;
  }

  async function saveFeedbackToDB(endDate, rating, text) {
    if (!currentUser) return;
    await sb.from('cycle_reports').upsert({
      user_id: currentUser.id,
      period_end_date: endDate,
      ai_analysis: currentAIAnalysis,
      feedback_rating: rating,
      feedback_text: text || null,
      // feedback_at은 DB 트리거가 자동으로 기록
    }, { onConflict: 'user_id,period_end_date' });
  }

  // ── 피드백 UI ──
  function selectReportStar(val) {
    reportFeedbackRating = val;
    document.querySelectorAll('.report-star-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.val) <= val);
    });
    checkFeedbackComplete();
  }

  function onFeedbackInput() {
    const text = document.getElementById('report-feedback-text').value;
    document.getElementById('feedback-char-count').textContent = text.length;
    checkFeedbackComplete();
  }

  function checkFeedbackComplete() {
    const btn = document.getElementById('report-save-btn');
    const guide = document.getElementById('feedback-guide');
    if (reportFeedbackRating > 0) {
      btn.classList.add('active');
      btn.disabled = false;
      guide.style.display = 'none';
    } else {
      btn.classList.remove('active');
      btn.disabled = true;
      guide.style.display = 'block';
    }
  }

  async function saveReportFeedback() {
    if (!currentUser) return;
    if (!reportFeedbackRating) return;
    if (!currentReportEndDate) return;
    if (!currentAIAnalysis) {
      alert('AI 분석이 아직 완료되지 않았어요. 잠시 후 다시 시도해주세요.');
      return;
    }

    const text = document.getElementById('report-feedback-text').value.trim();
    const btn = document.getElementById('report-save-btn');
    btn.textContent = '저장 중...';
    btn.disabled = true;

    await saveFeedbackToDB(currentReportEndDate, reportFeedbackRating, text);

    // 저장 완료 → 배너 숨김
    document.getElementById('report-banner').classList.remove('show');
    btn.style.display = 'none';
    document.getElementById('feedback-guide').style.display = 'none';
    document.getElementById('report-saved-badge').classList.add('show');
  }

  function restoreReportFeedback(data) {
    if (data.feedback_rating) {
      reportFeedbackRating = data.feedback_rating;
      selectReportStar(reportFeedbackRating);
    }
    if (data.feedback_text) {
      document.getElementById('report-feedback-text').value = data.feedback_text;
      document.getElementById('feedback-char-count').textContent = data.feedback_text.length;
    }
    if (data.feedback_rating && data.feedback_text) {
      document.getElementById('report-save-btn').style.display = 'none';
      document.getElementById('feedback-guide').style.display = 'none';
      document.getElementById('report-saved-badge').classList.add('show');
    }
  }

  function resetReportFeedback() {
    reportFeedbackRating = 0;
    currentAIAnalysis = null;
    // currentReportEndDate는 여기서 초기화하지 않음 (리포트 닫을 때 초기화)
    document.querySelectorAll('.report-star-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('report-feedback-text').value = '';
    document.getElementById('feedback-char-count').textContent = '0';
    document.getElementById('report-save-btn').style.display = 'block';
    document.getElementById('report-save-btn').classList.remove('active');
    document.getElementById('report-save-btn').disabled = true;
    document.getElementById('report-save-btn').textContent = '리포트 완성하기';
    document.getElementById('feedback-guide').style.display = 'block';
    document.getElementById('report-saved-badge').classList.remove('show');
    document.getElementById('report-ai-content').innerHTML = `
      <div class="report-ai-loading">
        <div class="report-ai-loading-dot"></div>
        <div class="report-ai-loading-dot"></div>
        <div class="report-ai-loading-dot"></div>
        <span>AI가 이번 사이클을 분석 중이에요, 잠시만요 🌙</span>
      </div>`;
  }
