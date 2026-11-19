/* 달의 기록 — 화면: 홈/달력/그래프/마이페이지 렌더링, 탭 전환, 기록 목록/상세 */
  /* ── 홈 상태 업데이트 ── */
  async function updateStatus() {
    const records=loadRecords();
    document.getElementById('stat-count').textContent=records.length;

    if (!records.length) {
      document.getElementById('status-main').textContent='—';
      document.getElementById('status-sub').textContent='기록을 시작해보세요';
      document.getElementById('stat-cycle').textContent='—';
      document.getElementById('stat-last').textContent='—';
      document.getElementById('info-cards').style.display='none';
      document.getElementById('dday-badge').classList.remove('show');
      updateInsightCard(records);
      return;
    }

    const sorted=[...records].sort((a,b)=>a.start>b.start?1:-1);
    const last=sorted[sorted.length-1];
    const [,lm,ld]=last.start.split('-');
    document.getElementById('stat-last').textContent=`${parseInt(lm)}/${parseInt(ld)}`;
    const cycle=calcAvgCycle(records);
    document.getElementById('stat-cycle').textContent=`${cycle}일`;

    const pred=getNextPredictions(records);
    const today=new Date();
    const todayStr=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const diff=dateDiff(pred.nextStart,todayStr);

    // 다음 생리 시작일 표시
    if (diff<0) {
      document.getElementById('status-main').textContent=fmtDate(pred.nextStart);
      document.getElementById('status-sub').textContent='예상 날짜가 지났어요';
    } else if (diff===0) {
      document.getElementById('status-main').textContent='오늘';
      document.getElementById('status-sub').textContent='예상 생리 시작일이에요';
    } else {
      document.getElementById('status-main').textContent=fmtDate(pred.nextStart);
      document.getElementById('status-sub').textContent='';
    }

    // D-day 뱃지
    const badge=document.getElementById('dday-badge');
    if (diff>=0&&diff<=3) {
      badge.classList.add('show');
      document.getElementById('dday-badge-text').textContent=
        diff===0?'🩸 오늘이 예상 생리 시작일이에요':`🩸 생리 예정일까지 D-${diff}`;
    } else { badge.classList.remove('show'); }

    document.getElementById('info-cards').style.display='grid';
    document.getElementById('next-ovulation').textContent=fmtDate(pred.ovulation);
    document.getElementById('next-fertile').textContent=`${fmtDate(pred.fertile.start)} ~ ${fmtDate(pred.fertile.end)}`;
    updateCycleCard(records);
    updateInsightCard(records);
    await checkReportBanner();
    await checkQuestionBanner();
  }

  /* ── 사이클 씽킹 ── */
  const CYCLE_PHASES = {
    winter: {
      name: '❄️ 겨울 · 생리기',
      season: '❄️',
      cls: 'winter',
      messages: [
        '몸이 쉬고 싶어하는 시기예요. 충분히 쉬어도 괜찮아요.',
        '내면에 집중하는 시간이에요. 무리하지 마세요.',
        '따뜻한 음료와 충분한 수면이 도움돼요.'
      ]
    },
    spring: {
      name: '🌱 봄 · 여포기',
      season: '🌱',
      cls: 'spring',
      messages: [
        '에너지가 서서히 올라오고 있어요. 새로운 걸 시작하기 좋아요.',
        '몸과 마음이 가벼워지는 시기예요. 활동적으로 움직여봐요.',
        '창의력과 집중력이 올라오는 때예요.'
      ]
    },
    summer: {
      name: '☀️ 여름 · 배란기',
      season: '☀️',
      cls: 'summer',
      messages: [
        '자신감과 에너지가 최고조예요. 중요한 일을 해보세요.',
        '사교적이고 외향적인 에너지가 넘쳐요.',
        '지금이 도전하기 가장 좋은 시기예요!'
      ]
    },
    autumn: {
      name: '🍂 가을 · 황체기',
      season: '🍂',
      cls: 'autumn',
      messages: [
        '몸이 서서히 내려앉는 시기예요. 무리하지 말고 나를 돌봐요.',
        '예민해질 수 있어요. 그건 자연스러운 거예요.',
        '마무리와 정리에 집중하기 좋은 때예요.'
      ]
    }
  };

  /* ── 인사이트 카드 ── */
  const INSIGHT_PHASE = {
    winter: '몸이 가장 많은 에너지를 쓰는 시기예요. 무리하지 않는 게 최선이에요.',
    spring: '에너지가 서서히 올라오는 시기예요. 새로운 걸 시작하기 좋아요.',
    summer: '에너지와 자신감이 최고조인 시기예요. 중요한 일은 지금 하세요.',
    autumn: '몸이 생리를 준비하는 시기예요. 감정 기복과 신체 증상이 자연스럽게 나타날 수 있어요.',
  };

  const INSIGHT_PATTERN = {
    '예민해요':         '이 시기마다 예민해지는 패턴이 있어요. 성격이 아니라 호르몬이에요.',
    '무기력해요':       '이 시기엔 에너지가 떨어지는 게 반복되고 있어요. 오늘 아무것도 하기 싫은 건 충분히 이유가 있어요.',
    '불안해요':         '이 시기마다 불안감이 올라오는 패턴이 있어요. 호르몬 변화가 감정에 영향을 주는 거예요.',
    '슬퍼요':           '이 시기에 감정이 가라앉는 패턴이 있어요. 지나가는 리듬이에요.',
    '우울해요':         '이 시기에 반복적으로 우울감이 오고 있어요. 몸의 신호예요, 자책하지 마요.',
    '감정이 오락가락해요': '이 시기에 감정 기복이 반복되는 패턴이 있어요. 호르몬이 만드는 거예요.',
    '두통':             '이 시기마다 두통이 오는 패턴이 있어요. 호르몬 변화 때문이에요.',
    '생리통':           '생리 때마다 통증이 오는 패턴이 있어요. 미리 대비하면 훨씬 나아요.',
    '복통':             '이 시기에 복통이 반복되고 있어요. 따뜻하게 해주는 게 도움이 돼요.',
    '붓기가 있어요':    '이 시기마다 붓기가 오는 패턴이 있어요. 호르몬 때문에 수분이 쌓이는 거예요.',
    '식욕이 늘었어요':  '이 시기마다 식욕이 늘어나는 패턴이 있어요. 몸이 에너지를 더 원하는 거예요.',
    '완전 방전':        '이 시기마다 에너지가 바닥나는 패턴이 있어요. 오늘은 쉬는 게 맞아요.',
    '온 몸이 쑤셔요':   '이 시기에 몸이 쑤시는 패턴이 있어요. 몸이 보내는 신호예요.',
    '기력이 없어요':    '이 시기에 기력이 없는 게 반복되고 있어요. 몸이 쉬고 싶다는 신호예요.',
  };

  const INSIGHT_ADVICE = {
    '두통':             '두통약을 미리 챙겨두고, 수분을 충분히 마셔봐요.',
    '생리통':           '핫팩을 배에 올려두고, 진통제를 미리 먹어두는 게 좋아요.',
    '복통':             '따뜻한 음료를 마시고 배를 따뜻하게 해주세요.',
    '붓기가 있어요':    '짠 음식을 줄이고 물을 많이 마셔봐요.',
    '식욕이 늘었어요':  '건강한 간식을 미리 챙겨두면 폭식을 줄이는 데 도움이 돼요.',
    '입맛이 없어요':    '부담 없이 먹을 수 있는 가벼운 음식을 챙겨봐요.',
    '완전 방전':        '철분이 부족할 수 있어요. 철분 보충제를 챙겨봐요.',
    '무기력해요':       '가볍게 스트레칭만 해도 혈액순환에 도움이 돼요.',
    '냉이 많아요':      '배란기나 생리 전 분비물이 늘어나는 건 자연스러워요. 방수 팬티를 미리 준비해두면 훨씬 편해요.',
    '온 몸이 쑤셔요':   '따뜻한 물로 반신욕을 해보는 건 어때요.',
    '예민해요':         '카페인을 줄이고 따뜻한 음료로 바꿔봐요.',
    '우울해요':         '오늘은 나를 다독이는 시간을 가져봐요. 가볍게 산책하거나 좋아하는 음악을 들어봐요.',
    '불안해요':         '천천히 깊게 호흡해봐요. 불안한 감정을 일기에 적으면 마음이 한결 가벼워져요.',
    '단 게 당겨요':     '설탕 대신 과일이나 다크초콜릿으로 달콤함을 채워봐요.',
    '두드러기/여드름':  '세안을 꼼꼼히 하고 보습을 충분히 해줘요.',
    '메스꺼움':         '공복을 피하고 소량씩 자주 먹어봐요.',
    '허리통증':         '스트레칭이나 핫팩으로 허리를 풀어줘봐요.',
    '유방통':           '카페인을 줄이면 유방통이 완화되는 경우가 있어요.',
  };

  function getRepeatPatternTag(records, phase, todayTags, cycle, logs) {
    const sorted = [...records].sort((a,b) => a.start > b.start ? 1 : -1);
    const tagCounts = {};
    sorted.forEach((r, i) => {
      if (i === sorted.length - 1) return;
      const startDate = new Date(r.start);
      for (let day = 1; day <= cycle; day++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + day - 1);
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (getCyclePhase(day, cycle) !== phase) continue;
        const log = logs[ds];
        if (!log) continue;
        [...(log.mood||[]), ...(log.symptom||[]), ...(log.energy||[])].forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });
    const threshold = Math.max(1, Math.floor((sorted.length - 1) * 0.4));
    for (const tag of todayTags) {
      if (tagCounts[tag] >= threshold && INSIGHT_PATTERN[tag]) return tag;
    }
    return null;
  }

  function getCyclePhase(dayOfCycle, cycleLength) {
    const winterEnd = 6;
    const springEnd = Math.round(cycleLength * 0.48);
    const summerEnd = Math.round(cycleLength * 0.63);
    if (dayOfCycle <= winterEnd) return 'winter';
    if (dayOfCycle <= springEnd) return 'spring';
    if (dayOfCycle <= summerEnd) return 'summer';
    return 'autumn';
  }


  function updateCycleCard(records) {
    const card = document.getElementById('cycle-card');
    if (!records.length) { card.classList.remove('show'); return; }

    const sorted = [...records].sort((a,b)=>a.start>b.start?1:-1);
    const last = sorted[sorted.length-1];
    const _tc=new Date(); const todayStr=`${_tc.getFullYear()}-${String(_tc.getMonth()+1).padStart(2,'0')}-${String(_tc.getDate()).padStart(2,'0')}`;
    const cycle = calcAvgCycle(records);

    // 마지막 생리 시작일 기준 오늘이 몇일째인지
    const dayOfCycle = dateDiff(todayStr, last.start) + 1;
    if (dayOfCycle < 1 || dayOfCycle > cycle + 5) { card.classList.remove('show'); return; }

    const phase = getCyclePhase(dayOfCycle, cycle);
    const info = CYCLE_PHASES[phase];
    const msg = info.messages[dayOfCycle % info.messages.length];

    // 단계별 범위 계산 (사용자 평균 주기 기반)
    const winterEnd = 6;
    const springEnd = Math.round(cycle * 0.48);
    const summerEnd = Math.round(cycle * 0.63);
    const ranges = { winter:[1,winterEnd], spring:[winterEnd+1,springEnd], summer:[springEnd+1,summerEnd], autumn:[summerEnd+1,cycle] };
    const [phaseStart, phaseEnd] = ranges[phase];
    const progress = phaseEnd === phaseStart ? 100 : Math.min(100, Math.round(((dayOfCycle - phaseStart + 1) / (phaseEnd - phaseStart + 1)) * 100));

    // 렌더링
    card.className = `cycle-card show ${info.cls}`;
    document.getElementById('cycle-season').textContent = info.season;
    document.getElementById('cycle-day-badge').textContent = `${dayOfCycle}일째`;
    document.getElementById('cycle-phase-name').textContent = info.name;
    document.getElementById('cycle-message').textContent = msg;
    document.getElementById('cycle-progress-fill').style.width = progress + '%';
    document.getElementById('cycle-progress-start').textContent = `${phaseStart}일`;
    document.getElementById('cycle-progress-end').textContent = `${phaseEnd}일`;
  }
  function updateInsightCard(records) {
    const card = document.getElementById('insight-card');
    if (!card) return;
    const today = getTodayStr();
    const logs = loadLogs();
    const todayLog = logs[today];
    const todayTags = todayLog ? [
      ...(todayLog.mood||[]), ...(todayLog.symptom||[]),
      ...(todayLog.energy||[]), ...(todayLog.etc||[])
    ] : [];

    // Case 1: 생리 기록 없음
    if (!records.length) {
      card.innerHTML = `<div style="font-size:13px;color:var(--text-muted);text-align:center;line-height:1.8;padding:4px 0">생리 기록을 입력하면 맞춤 인사이트를 드려요 🌙</div>`;
      card.classList.add('show');
      return;
    }

    // 사이클 단계 계산
    const sorted = [...records].sort((a,b) => a.start > b.start ? -1 : 1);
    const last = sorted[0];
    const cycle = calcAvgCycle(records);
    const dayOfCycle = dateDiff(today, last.start) + 1;
    if (dayOfCycle < 1 || dayOfCycle > cycle + 5) { card.classList.remove('show'); return; }

    const phase = getCyclePhase(dayOfCycle, cycle);
    const phaseEmoji = { winter:'❄️', spring:'🌸', summer:'☀️', autumn:'🍂' };
    const pred = getNextPredictions(records);
    const daysUntil = pred ? dateDiff(pred.nextStart, today) : null;

    const parts = [];

    // ① 사이클 단계 설명 (항상)
    parts.push(`${phaseEmoji[phase]} ${INSIGHT_PHASE[phase]}`);

    // ② 내 데이터 패턴 (2사이클 이상 + 오늘 기록 있음)
    if (records.length >= 2 && todayLog && todayTags.length > 0) {
      const patternTag = getRepeatPatternTag(records, phase, todayTags, cycle, logs);
      if (patternTag) parts.push(INSIGHT_PATTERN[patternTag]);
    }

    // ③ 앞날 예측
    if (phase === 'winter') {
      const daysLeft = dateDiff(last.end, today);
      parts.push(daysLeft >= 0
        ? '생리 중이에요. 이 시기가 지나면 에너지가 다시 올라와요.'
        : '생리가 끝났어요. 몸이 서서히 회복되고 있어요.');
    } else if (daysUntil !== null && daysUntil >= 0) {
      if (daysUntil >= 7)      parts.push(`다음 생리까지 ${daysUntil}일 남았어요. 지금부터 무리하지 않는 게 좋아요.`);
      else if (daysUntil >= 3) parts.push(`생리까지 ${daysUntil}일 남았어요. 슬슬 몸이 신호를 보내기 시작할 거예요.`);
      else if (daysUntil >= 1) parts.push(`곧 생리가 시작될 것 같아요. 따뜻하게 준비해두세요.`);
      else                     parts.push('오늘이 예상 생리 시작일이에요. 몸을 따뜻하게 해주세요.');
    }

    // ④ 행동 조언 (오늘 기록 있을 때) — 신체 1개 + 감정 1개
    if (todayLog && todayTags.length > 0) {
      const PHYSICAL_PRIORITY = [
        '생리통','복통','두통','온 몸이 쑤셔요','메스꺼움','어지러워요',
        '유방통','허리통증','붓기가 있어요','냉이 많아요',
        '식욕이 늘었어요','입맛이 없어요','단 게 당겨요',
      ];
      const EMOTIONAL_PRIORITY = [
        '우울해요','불안해요','무기력해요','슬퍼요',
        '예민해요','감정이 오락가락해요','기력이 없어요',
      ];
      const physicalTag = PHYSICAL_PRIORITY.find(t => todayTags.includes(t) && INSIGHT_ADVICE[t]);
      const emotionalTag = EMOTIONAL_PRIORITY.find(t => todayTags.includes(t) && INSIGHT_ADVICE[t]);
      if (physicalTag) parts.push(INSIGHT_ADVICE[physicalTag]);
      if (emotionalTag) parts.push(INSIGHT_ADVICE[emotionalTag]);
    }

    card.innerHTML = `<div style="font-size:13px;color:var(--text-muted);line-height:1.9">${parts.join(' ')}</div>`;
    card.classList.add('show');
  }

  function toggleMypageSection(id) {
    const section = document.getElementById(`mypage-${id}`);
    const arrow = document.getElementById(`arrow-${id}`);
    const isShow = section.classList.toggle('show');
    arrow.textContent = isShow ? '∨' : '›';
    if (isShow) {
      if (id === 'period-records') renderRecords();
      if (id === 'log-records') renderLogList();
    }
  }

  function renderMypage() {
    if (!currentUser) return;
    // 아바타
    const avatar = document.getElementById('mypage-avatar');
    if (currentUser.user_metadata?.avatar_url) {
      avatar.innerHTML = `<img src="${currentUser.user_metadata.avatar_url}" alt="프로필">`;
    } else {
      avatar.textContent = (currentUser.email || '?')[0].toUpperCase();
    }
    document.getElementById('mypage-email').textContent = currentUser.email || '';

    // 닉네임
    updateNicknameUI();

    // 통계
    const records = loadRecords();
    const logs = loadLogs();
    const cycle = calcAvgCycle(records);
    const avgDur = records.length
      ? Math.round(records.reduce((s,r) => s + dateDiff(r.end,r.start)+1, 0) / records.length)
      : 0;

    document.getElementById('mypage-avg-cycle').textContent = records.length >= 2 ? `${cycle}일` : '—';
    document.getElementById('mypage-avg-dur').textContent = records.length ? `${avgDur}일` : '—';
    document.getElementById('mypage-total-records').textContent = `${records.length}회`;
    document.getElementById('mypage-total-logs').textContent = `${Object.keys(logs).length}일`;
  }

  /* ── 달력: 스크롤 방식 ── */
  function renderCalendarMonth(year, month, periodSet, pred, past, todayFull) {
    const block = document.createElement('div');
    block.className = 'calendar-month-block';

    const title = document.createElement('div');
    title.className = 'cal-month-title';
    title.textContent = `${year}년 ${month+1}월`;
    block.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    const labels = document.createElement('div');
    labels.className = 'day-labels';
    ['일','월','화','수','목','금','토'].forEach(l=>{
      const el=document.createElement('div'); el.className='day-label'; el.textContent=l; labels.appendChild(el);
    });
    grid.appendChild(labels);

    const daysGrid = document.createElement('div');
    daysGrid.className = 'days-grid';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();

    for (let i=0;i<firstDay;i++) {
      const e=document.createElement('div'); e.className='day-cell empty'; daysGrid.appendChild(e);
    }

    for (let d=1;d<=daysInMonth;d++) {
      const cell=document.createElement('div');
      const ds=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      let cls='day-cell';
      if (periodSet.has(ds)) cls+=' period';
      else if (past.ovulation.has(ds)) cls+=' ovulation';
      else if (past.fertile.has(ds)) cls+=' fertile';
      else if (pred.period.has(ds)) cls+=' predicted';
      else if (pred.ovulation.has(ds)) cls+=' ovulation-predicted';
      else if (pred.fertile.has(ds)) cls+=' fertile-predicted';

      const [ty,tm,td]=todayFull.split('-');
      if (parseInt(ty)===year&&parseInt(tm)-1===month&&parseInt(td)===d) cls+=' today';

      cell.className=cls; cell.textContent=d;
      cell.onclick=()=>{ openLogModal(ds); };
      daysGrid.appendChild(cell);
    }
    grid.appendChild(daysGrid);
    block.appendChild(grid);
    return block;
  }

  function renderCalendar() {
    const records=loadRecords();
    const periodSet=new Set();
    records.forEach(r=>getPeriodDates(r).forEach(d=>periodSet.add(d)));
    const pred=getAllPredictedSets(records);
    const past=getPastOvulationSets(records);
    const today=new Date();
    const todayStr=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    const wrap=document.getElementById('calendar-scroll-wrap');
    wrap.innerHTML='';

    // 현재 달 기준 -2 ~ +4 (총 7개월)
    for (let offset=-2;offset<=4;offset++) {
      let y=today.getFullYear(), m=today.getMonth()+offset;
      while (m<0){m+=12;y--;} while (m>11){m-=12;y++;}
      const block=renderCalendarMonth(y,m,periodSet,pred,past,todayStr);
      wrap.appendChild(block);
      // 이번달 블록에 id 마킹해서 스크롤 기준점
      if (offset===0) block.id='cal-today-block';
    }

    // 이번달로 스크롤
    setTimeout(()=>{
      const target=document.getElementById('cal-today-block');
      if (target) target.scrollIntoView({behavior:'smooth',block:'start'});
    },100);
  }

  /* ── 기록 ── */
  function renderRecords() {
    const records=loadRecords().sort((a,b)=>a.start>b.start?-1:1);
    const list=document.getElementById('records-list');
    if (!records.length) {
      list.innerHTML='<div class="empty-state">아직 기록이 없어요.<br>홈에서 생리 시작일을 기록해보세요 🌙</div>';
      return;
    }
    list.innerHTML=records.map((r,i)=>{
      const [sy,sm,sd]=r.start.split('-');
      const [,em,ed]=r.end.split('-');
      const dur=dateDiff(r.end,r.start)+1;
      return `<div class="record-item">
        <div>
          <div class="record-date">${parseInt(sm)}월 ${parseInt(sd)}일 ~ ${parseInt(em)}월 ${parseInt(ed)}일</div>
          <div class="record-meta">${sy}년 · ${dur}일간</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="record-edit" onclick="editRecord(${i})">✎</button>
          <button class="record-delete" onclick="deleteRecord(${i})">×</button>
        </div>
      </div>`;
    }).join('');
  }

  /* ── 그래프: SVG 라인 차트 ── */
  function drawLineChart(svgId, values, avgVal, colorStroke) {
    const svg = document.getElementById(svgId);
    svg.innerHTML = '';
    const W = svg.parentElement.offsetWidth || 300;
    const H = 80;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    if (values.length < 2) {
      const text = document.createElementNS('http://www.w3.org/2000/svg','text');
      text.setAttribute('x', W/2); text.setAttribute('y', H/2);
      text.setAttribute('text-anchor','middle'); text.setAttribute('fill','#5c4a52');
      text.setAttribute('font-size','12'); text.textContent='기록이 2개 이상 필요해요';
      svg.appendChild(text); return;
    }

    const pad = {l:16,r:16,t:8,b:20};
    const minV = Math.min(...values)-2, maxV = Math.max(...values)+2;
    const range = maxV-minV || 1;
    const xStep = (W-pad.l-pad.r)/(values.length-1);

    const toX = i => pad.l + i*xStep;
    const toY = v => pad.t + (1-(v-minV)/range)*(H-pad.t-pad.b);

    // 평균선
    const avgY = toY(avgVal);
    const avgLine = document.createElementNS('http://www.w3.org/2000/svg','line');
    avgLine.setAttribute('x1',pad.l); avgLine.setAttribute('x2',W-pad.r);
    avgLine.setAttribute('y1',avgY); avgLine.setAttribute('y2',avgY);
    avgLine.setAttribute('stroke','#3a2a40'); avgLine.setAttribute('stroke-width','1');
    avgLine.setAttribute('stroke-dasharray','4 3');
    svg.appendChild(avgLine);

    // 라인
    let d = values.map((v,i)=>`${i===0?'M':'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',d); path.setAttribute('fill','none');
    path.setAttribute('stroke',colorStroke); path.setAttribute('stroke-width','1.5');
    path.setAttribute('stroke-linecap','round'); path.setAttribute('stroke-linejoin','round');
    svg.appendChild(path);

    // 점 + 라벨
    values.forEach((v,i)=>{
      const cx=toX(i), cy=toY(v);
      const isLast=(i===values.length-1);

      const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
      circle.setAttribute('cx',cx); circle.setAttribute('cy',cy); circle.setAttribute('r', isLast?4:3);
      circle.setAttribute('fill', isLast?colorStroke:'#1a0d1f');
      circle.setAttribute('stroke',colorStroke); circle.setAttribute('stroke-width','1.5');
      svg.appendChild(circle);

      const label = document.createElementNS('http://www.w3.org/2000/svg','text');
      label.setAttribute('x',cx); label.setAttribute('y',H-4);
      label.setAttribute('text-anchor','middle'); label.setAttribute('fill','#5c4a52');
      label.setAttribute('font-size','9'); label.textContent=`${i+1}회`;
      svg.appendChild(label);

      // 값 라벨 (마지막이거나 특이값만)
      if (isLast || v===Math.max(...values) || v===Math.min(...values)) {
        const vLabel = document.createElementNS('http://www.w3.org/2000/svg','text');
        vLabel.setAttribute('x',cx); vLabel.setAttribute('y',cy-6);
        vLabel.setAttribute('text-anchor','middle');
        vLabel.setAttribute('fill', isLast?colorStroke:'#9a7f88');
        vLabel.setAttribute('font-size','10'); vLabel.setAttribute('font-weight',isLast?'500':'400');
        vLabel.textContent=v;
        svg.appendChild(vLabel);
      }
    });
  }

  function renderGraph() {
    const records = loadRecords().sort((a,b)=>a.start>b.start?1:-1);

    // 주기
    const cycles=[];
    for (let i=1;i<records.length;i++) {
      const d=dateDiff(records[i].start,records[i-1].start);
      if (d>10&&d<60) cycles.push(d);
    }
    if (cycles.length>=1) {
      const avg=Math.round(cycles.reduce((s,v)=>s+v,0)/cycles.length);
      const mn=Math.min(...cycles), mx=Math.max(...cycles);
      document.getElementById('avg-cycle-num').textContent=`${avg}일`;
      drawLineChart('cycle-chart',cycles,avg,'#c9607a');
      document.getElementById('cycle-stat-row').innerHTML=`
        <div class="stat-pill"><div class="stat-pill-val">${mn}일</div><div class="stat-pill-label">최단 주기</div></div>
        <div class="stat-pill"><div class="stat-pill-val">${mx}일</div><div class="stat-pill-label">최장 주기</div></div>
        <div class="stat-pill"><div class="stat-pill-val">${cycles.length}회</div><div class="stat-pill-label">측정 횟수</div></div>`;
    } else {
      document.getElementById('avg-cycle-num').textContent='—';
      drawLineChart('cycle-chart',[],0,'#c9607a');
      document.getElementById('cycle-stat-row').innerHTML='';
    }

    // 기간
    const durs=records.map(r=>dateDiff(r.end,r.start)+1);
    if (durs.length>=1) {
      const avg=Math.round(durs.reduce((s,v)=>s+v,0)/durs.length);
      const mn=Math.min(...durs), mx=Math.max(...durs);
      document.getElementById('avg-dur-num').textContent=`${avg}일`;
      drawLineChart('dur-chart',durs,avg,'#5dca8a');
      document.getElementById('dur-stat-row').innerHTML=`
        <div class="stat-pill"><div class="stat-pill-val">${mn}일</div><div class="stat-pill-label">최단 기간</div></div>
        <div class="stat-pill"><div class="stat-pill-val">${mx}일</div><div class="stat-pill-label">최장 기간</div></div>
        <div class="stat-pill"><div class="stat-pill-val">${durs.length}회</div><div class="stat-pill-label">기록 횟수</div></div>`;
    } else {
      document.getElementById('avg-dur-num').textContent='—';
      drawLineChart('dur-chart',[],0,'#5dca8a');
      document.getElementById('dur-stat-row').innerHTML='';
    }
  }

  /* ── 탭 전환 ── */
  function switchTab(tab) {
    ['home','calendar','graph','mypage'].forEach(t=>{
      document.getElementById(`tab-${t}`).classList.toggle('active',t===tab);
      const navEl = document.getElementById(`nav-${t}`);
      if (navEl) navEl.classList.toggle('active',t===tab);
    });
    if (tab==='calendar') renderCalendar();
    if (tab==='graph') renderGraph();
    if (tab==='mypage') renderMypage();
  }

  /* 기록 탭 서브탭 */
  function switchRecTab(tab) {
    const isPeriod = tab === 'period';
    document.getElementById('records-period-list').style.display = isPeriod ? 'block' : 'none';
    document.getElementById('records-log-list').style.display = isPeriod ? 'none' : 'block';
    document.getElementById('rec-tab-period').style.background = isPeriod ? 'var(--accent)' : 'transparent';
    document.getElementById('rec-tab-period').style.color = isPeriod ? 'white' : 'var(--text-muted)';
    document.getElementById('rec-tab-log').style.background = isPeriod ? 'transparent' : 'var(--accent)';
    document.getElementById('rec-tab-log').style.color = isPeriod ? 'var(--text-muted)' : 'white';
    if (!isPeriod) renderLogList();
  }

  /* 상태 기록 목록 렌더링 */
  function renderLogList() {
    const logs = loadLogs();
    const list = document.getElementById('log-list');
    const dates = Object.keys(logs).sort().reverse();
    if (!dates.length) {
      list.innerHTML = '<div class="empty-state">아직 상태 기록이 없어요.<br>홈에서 오늘의 상태를 기록해보세요 ✍️</div>';
      return;
    }
    const CAT_LABEL = { mood:'기분', symptom:'증상', energy:'에너지', etc:'기타' };
    list.innerHTML = dates.map(ds => {
      const [y,m,d] = ds.split('-');
      const entry = logs[ds];
      const allTags = [...entry.mood, ...entry.symptom, ...entry.energy, ...entry.etc];
      return `<div>
        <div class="log-date-header">
          <div class="log-date-label">${parseInt(m)}월 ${parseInt(d)}일 <span style="font-size:12px;color:var(--text-muted)">${y}</span></div>
          <button class="log-edit-btn" onclick="openLogModal('${ds}')">수정</button>
        </div>
        <div class="log-tag-display">
          ${allTags.map(t => `<span class="log-tag-chip">${t}</span>`).join('')}
        </div>
      </div>`;
    }).join('');
  }

  function openRecordDetail(type) {
    const modal = document.getElementById('record-detail-modal');
    const title = document.getElementById('record-detail-title');
    const content = document.getElementById('record-detail-content');

    if (type === 'period') {
      title.textContent = '🩸 생리 기록';
      const records = loadRecords().sort((a,b) => a.start > b.start ? -1 : 1);
      if (!records.length) {
        content.innerHTML = '<div class="empty-state">아직 생리 기록이 없어요 🌙</div>';
      } else {
        content.innerHTML = records.map((r,i) => {
          const [sy,sm,sd] = r.start.split('-');
          const [,em,ed] = r.end.split('-');
          const dur = dateDiff(r.end, r.start) + 1;
          return `<div class="record-item">
            <div>
              <div class="record-date">${parseInt(sm)}월 ${parseInt(sd)}일 ~ ${parseInt(em)}월 ${parseInt(ed)}일</div>
              <div class="record-meta">${sy}년 · ${dur}일간</div>
            </div>
            <div style="display:flex;gap:4px">
              <button class="record-edit" onclick="editRecord(${i});document.getElementById('record-detail-modal').classList.remove('open')">✎</button>
              <button class="record-delete" onclick="deleteRecord(${i});openRecordDetail('period')">×</button>
            </div>
          </div>`;
        }).join('');
      }
    } else {
      title.textContent = '✍️ 상태 기록';
      const logs = loadLogs();
      const dates = Object.keys(logs).sort().reverse();
      if (!dates.length) {
        content.innerHTML = '<div class="empty-state">아직 상태 기록이 없어요 ✍️</div>';
      } else {
        content.innerHTML = dates.map(ds => {
          const [y,m,d] = ds.split('-');
          const entry = logs[ds];
          const allTags = [...(entry.mood||[]), ...(entry.symptom||[]), ...(entry.energy||[]), ...(entry.etc||[])];
          return `<div>
            <div class="log-date-header">
              <div class="log-date-label">${parseInt(m)}월 ${parseInt(d)}일 <span style="font-size:12px;color:var(--text-muted)">${y}</span></div>
              <button class="log-edit-btn" onclick="document.getElementById('record-detail-modal').classList.remove('open');setTimeout(()=>openLogModal('${ds}'),200)">수정</button>
            </div>
            <div class="log-tag-display">
              ${allTags.map(t => `<span class="log-tag-chip">${t}</span>`).join('')}
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
