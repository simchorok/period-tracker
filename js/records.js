/* 달의 기록 — 기록: 날짜/주기 계산, 생리 기록·상태 기록 저장, 기록 모달 */
  // ── Supabase DB 연동 ──
  async function loadAllData() {
    if (!currentUser) return;
    const [records, logs] = await Promise.all([
      loadRecordsFromDB(),
      loadLogsFromDB()
    ]);
    updateStatus();
    renderCalendar();
  }

  async function loadRecordsFromDB() {
    const { data, error } = await sb
      .from('period_records')
      .select('*')
      .order('start_date', { ascending: true });
    if (error) { console.error(error); return []; }
    // DB → localStorage 형식으로 변환해서 캐시
    const records = (data || []).map(r => ({
      start: r.start_date ? r.start_date.slice(0, 10) : r.start_date,
      end: r.end_date ? r.end_date.slice(0, 10) : r.end_date,
      id: r.id
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return records;
  }

  async function loadLogsFromDB() {
    const { data, error } = await sb
      .from('daily_logs')
      .select('*');
    if (error) { console.error(error); return {}; }
    const logs = {};
    (data || []).forEach(r => {
      const logDate = r.log_date ? r.log_date.slice(0, 10) : r.log_date;
      logs[logDate] = { mood: r.mood||[], symptom: r.symptom||[], energy: r.energy||[], etc: r.etc||[],
        periodIntensity: r.period_intensity, sleepQuality: r.sleep_quality,
        sleepHours: r.sleep_hours, symptomSeverity: r.symptom_severity, id: r.id };
    });
    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
    return logs;
  }

  // ── DB 저장 함수 오버라이드 ──
  async function saveRecordToDB(record) {
    if (!currentUser) return;
    const { data, error } = await sb
      .from('period_records')
      .insert([{ user_id: currentUser.id, start_date: record.start, end_date: record.end }])
      .select();
    if (error) { console.error(error); return null; }
    return data[0];
  }

  async function updateRecordInDB(id, record) {
    if (!currentUser || !id) return;
    await sb
      .from('period_records')
      .update({ start_date: record.start, end_date: record.end })
      .eq('id', id);
  }

  async function deleteRecordFromDB(id) {
    if (!currentUser || !id) return;
    await sb.from('period_records').delete().eq('id', id);
  }

  async function saveLogToDB(logDate, entry, existingId) {
    if (!currentUser) return;
    const dbEntry = {
      user_id: currentUser.id,
      log_date: logDate,
      mood: entry.mood,
      symptom: entry.symptom,
      energy: entry.energy,
      etc: entry.etc,
      period_intensity: entry.periodIntensity || null,
      sleep_quality: entry.sleepQuality || null,
      sleep_hours: entry.sleepHours || null,
      memo: entry.memo || null,
    };
    const { error } = await sb.from('daily_logs')
      .upsert(dbEntry, { onConflict: 'user_id,log_date' });
    if (error) console.error('DB 저장 오류:', error);
    await loadLogsFromDB();
  }

  const STORAGE_KEY = 'period_records_v2';

  // ── 날짜 헬퍼 ────────────────────────────────────
  function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  const DEFAULT_CYCLE = 28;
  const DEFAULT_DURATION = 6;

  function loadRecords() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }
  function saveRecords(r) { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); }

  function addDays(ds, n) {
    const [y,m,d] = ds.split('-').map(Number);
    const date = new Date(y, m-1, d+n);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function dateDiff(a, b) { return Math.round((new Date(a) - new Date(b)) / 86400000); }

  function getPeriodDates(r) {
    const arr = [];
    for (let d = new Date(r.start.replace(/-/g,'/')); d <= new Date(r.end.replace(/-/g,'/')); d.setDate(d.getDate()+1))
      arr.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    return arr;
  }

  function calcAvgCycle(records) {
    if (records.length < 2) return DEFAULT_CYCLE;
    const s = [...records].sort((a,b)=>a.start>b.start?1:-1);
    let tot=0, cnt=0;
    for (let i=1;i<s.length;i++) {
      const d=dateDiff(s[i].start,s[i-1].start);
      if (d>10&&d<60){tot+=d;cnt++;}
    }
    return cnt>0?Math.round(tot/cnt):DEFAULT_CYCLE;
  }

  function getOvulationDate(nextStart) { return addDays(nextStart,-14); }
  function getFertileRange(ov) { return {start:addDays(ov,-5),end:addDays(ov,1)}; }

  function getNextPredictions(records) {
    if (!records.length) return null;
    const s=[...records].sort((a,b)=>a.start>b.start?1:-1);
    const last=s[s.length-1];
    const cycle=calcAvgCycle(records);
    const nextStart=addDays(last.start,cycle);
    const nextEnd=addDays(nextStart,DEFAULT_DURATION-1);
    const ov=getOvulationDate(nextStart);
    return {nextStart,nextEnd,ovulation:ov,fertile:getFertileRange(ov)};
  }

  function getAllPredictedSets(records) {
    if (!records.length) return {period:new Set(),ovulation:new Set(),fertile:new Set()};
    const s=[...records].sort((a,b)=>a.start>b.start?1:-1);
    const last=s[s.length-1];
    const cycle=calcAvgCycle(records);
    const pSet=new Set(),ovSet=new Set(),fSet=new Set();
    for (let i=1;i<=3;i++) {
      const ns=addDays(last.start,cycle*i), ne=addDays(ns,DEFAULT_DURATION-1);
      for (let d=new Date(ns.replace(/-/g,'/'));d<=new Date(ne.replace(/-/g,'/'));d.setDate(d.getDate()+1)) pSet.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
      const ov=getOvulationDate(ns); ovSet.add(ov);
      const fr=getFertileRange(ov);
      for (let d=new Date(fr.start.replace(/-/g,'/'));d<=new Date(fr.end.replace(/-/g,'/'));d.setDate(d.getDate()+1)) {
        const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (!pSet.has(ds)) fSet.add(ds);
      }
    }
    return {period:pSet,ovulation:ovSet,fertile:fSet};
  }

  function getPastOvulationSets(records) {
    const ovSet=new Set(),fSet=new Set();
    const s=[...records].sort((a,b)=>a.start>b.start?1:-1);
    for (let i=0;i<s.length-1;i++) {
      const ov=getOvulationDate(s[i+1].start); ovSet.add(ov);
      const fr=getFertileRange(ov);
      for (let d=new Date(fr.start.replace(/-/g,'/'));d<=new Date(fr.end.replace(/-/g,'/'));d.setDate(d.getDate()+1))
        fSet.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    }
    return {ovulation:ovSet,fertile:fSet};
  }

  function fmtDate(ds) {
    const [,m,d]=ds.split('-');
    return `${parseInt(m)}월 ${parseInt(d)}일`;
  }

  /* ── 모달 ── */
  let editingIdx = null;

  function openModal(editIdx) {
    editingIdx = (editIdx !== undefined) ? editIdx : null;
    document.getElementById('modal-title').textContent = editingIdx !== null ? '기록 수정' : '생리 기간 기록';
    document.getElementById('modal-save-btn').textContent = editingIdx !== null ? '수정' : '저장';
    document.getElementById('modal').classList.add('open');
    if (editingIdx === null && !document.getElementById('date-start').value) {
      const _tl=new Date(); const today=`${_tl.getFullYear()}-${String(_tl.getMonth()+1).padStart(2,'0')}-${String(_tl.getDate()).padStart(2,'0')}`;
      document.getElementById('date-start').value=today;
      document.getElementById('date-end').value=addDays(today,DEFAULT_DURATION-1);
    }
  }

  function editRecord(idx) {
    const records=loadRecords().sort((a,b)=>a.start>b.start?-1:1);
    const r=records[idx];
    document.getElementById('date-start').value=r.start;
    document.getElementById('date-end').value=r.end;
    openModal(idx);
  }

  function closeModal() {
    document.getElementById('modal').classList.remove('open');
    document.getElementById('date-start').value='';
    document.getElementById('date-end').value='';
    editingIdx=null;
  }
  function closeModalOutside(e) { if (e.target===document.getElementById('modal')) closeModal(); }

  document.getElementById('date-start').addEventListener('change',function(){
    if (this.value && editingIdx===null) document.getElementById('date-end').value=addDays(this.value,DEFAULT_DURATION-1);
  });

  async function saveRecord() {
    const start=document.getElementById('date-start').value;
    const end=document.getElementById('date-end').value;
    if (!start) return alert('시작일을 선택해주세요');
    if (!end) return alert('종료일을 선택해주세요');
    if (end<start) return alert('종료일은 시작일 이후여야 해요');
    const records=loadRecords();
    try {
      if (editingIdx !== null) {
        const sorted=records.sort((a,b)=>a.start>b.start?-1:1);
        const existing=sorted[editingIdx];
        sorted[editingIdx]={...existing,start,end};
        saveRecords(sorted);
        if (currentUser && existing.id) await updateRecordInDB(existing.id, {start,end});
      } else {
        const newRec={start,end};
        if (currentUser) {
          const saved=await saveRecordToDB(newRec);
          if (saved) newRec.id=saved.id;
        }
        records.push(newRec);
        saveRecords(records);
      }
    } catch(e) {
      console.error('저장 오류:', e);
    }
    closeModal();
    updateStatus();
    renderRecords();
  }

  async function deleteRecord(idx) {
    const records=loadRecords().sort((a,b)=>a.start>b.start?-1:1);
    const record=records[idx];
    if (record?.id) await deleteRecordFromDB(record.id);
    records.splice(idx,1);
    saveRecords(records);
    renderRecords();
    updateStatus();
  }

  /* ── 생리 강도 별점 ── */
  let periodIntensity = 0;
  let sleepQuality = 0;
  let currentSymptomTag = null;
  let symptomSeverity = {};

  function selectStar(val) {
    periodIntensity = val;
    document.querySelectorAll('#period-intensity .star-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.val) <= val);
    });
  }

  function selectSleepStar(val) {
    sleepQuality = val;
    document.querySelectorAll('#sleep-quality .star-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.val) <= val);
    });
  }







  // 이벤트 위임 — 페이지 로드 시 딱 한 번만 등록
  let _logTagEventBound = false;
  function initLogTagEvents() {
    if (_logTagEventBound) return;
    _logTagEventBound = true;
    document.addEventListener('click', function(e) {
      // 모달이 열려있을 때만 처리
      if (!document.getElementById('log-modal').classList.contains('open')) return;
      const tag = e.target.closest('.log-tag');
      if (!tag) return;
      const parentId = tag.parentElement ? tag.parentElement.id : '';
      if (parentId === 'log-sleep-quality') {
        // 수면의 질 — 단일 선택
        const wasSelected = tag.classList.contains('selected');
        document.querySelectorAll('#log-sleep-quality .log-tag').forEach(t => t.classList.remove('selected'));
        if (!wasSelected) tag.classList.add('selected');
      } else {
        // 기분 / 신체 불편함 / 에너지 / 기타 — 체크/해제 토글
        tag.classList.toggle('selected');
      }
    });
  }

  function resetLogExtras() {
    periodIntensity = 0;
    sleepQuality = 0;
    document.querySelectorAll('#period-intensity .star-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#sleep-quality .star-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#log-sleep-quality .log-tag').forEach(b => b.classList.remove('selected'));
    document.getElementById('sleep-hours').value = '';
  }

  function restoreLogExtras(existing) {
    if (existing.periodIntensity) {
      periodIntensity = existing.periodIntensity;
      selectStar(periodIntensity);
    }
    if (existing.sleepQuality) {
      document.querySelectorAll('#log-sleep-quality .log-tag').forEach(t => {
        t.classList.toggle('selected', t.dataset.val === existing.sleepQuality);
      });
    }
    if (existing.sleepHours) {
      document.getElementById('sleep-hours').value = existing.sleepHours;
    }
    if (existing.symptomSeverity) {
      symptomSeverity = existing.symptomSeverity;
    }
  }

  /* ── 상태 기록 ── */
  const LOG_KEY = 'period_logs_v1';
  let logTargetDate = null;

  function loadLogs() {
    try { return JSON.parse(localStorage.getItem(LOG_KEY)) || {}; }
    catch { return {}; }
  }
  function saveLogs(logs) { localStorage.setItem(LOG_KEY, JSON.stringify(logs)); }

  function openLogModal(dateStr) {
    const _tlog=new Date(); logTargetDate = dateStr || `${_tlog.getFullYear()}-${String(_tlog.getMonth()+1).padStart(2,'0')}-${String(_tlog.getDate()).padStart(2,'0')}`;
    const [y,m,d] = logTargetDate.split('-');
    document.getElementById('log-modal-title').textContent = '상태 기록';
    document.getElementById('log-modal-date').textContent = `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;

    // 기존 기록 불러와서 선택 상태 복원
    const logs = loadLogs();
    const existing = logs[logTargetDate] || { mood:[], symptom:[], energy:[], etc:[] };
    ['mood','symptom','energy','etc'].forEach(cat => {
      document.querySelectorAll(`#log-${cat} .log-tag`).forEach(tag => {
        const isSelected = existing[cat] && existing[cat].includes(tag.dataset.val);
        tag.classList.toggle('selected', isSelected);
      });
    });
    resetLogExtras();
    restoreLogExtras(existing);

    // 메모 복원
    const memoEl = document.getElementById('log-memo');
    memoEl.value = existing.memo || '';
    document.getElementById('log-memo-count').textContent = memoEl.value.length;

    document.getElementById('log-modal').classList.add('open');
  }

  // 메모 글자 수 카운터
  document.getElementById('log-memo')?.addEventListener('input', function() {
    document.getElementById('log-memo-count').textContent = this.value.length;
  });

  function closeLogModal() {
    document.getElementById('log-modal').classList.remove('open');
    logTargetDate = null;
  }
  function closeLogModalOutside(e) {
    if (e.target === document.getElementById('log-modal')) closeLogModal();
  }



  async function saveLog() {
    if (!logTargetDate) return;
    const logs = loadLogs();
    const entry = { mood:[], symptom:[], energy:[], etc:[] };
    ['mood','symptom','energy','etc'].forEach(cat => {
      document.querySelectorAll(`#log-${cat} .log-tag.selected`).forEach(tag => {
        entry[cat].push(tag.dataset.val);
      });
    });
    entry.periodIntensity = periodIntensity || null;
    const sleepQualityTag = document.querySelector('#log-sleep-quality .log-tag.selected');
    entry.sleepQuality = sleepQualityTag ? sleepQualityTag.dataset.val : null;
    entry.sleepHours = parseFloat(document.getElementById('sleep-hours').value) || null;
    entry.memo = document.getElementById('log-memo')?.value?.trim() || null;

    const hasAny = entry.mood.length > 0 || entry.symptom.length > 0 || entry.energy.length > 0 ||
      entry.etc.length > 0 || entry.periodIntensity || entry.sleepQuality || entry.sleepHours || entry.memo;
    try {
      if (hasAny) {
        const existingId = logs[logTargetDate] ? logs[logTargetDate].id : null;
        logs[logTargetDate] = entry;
        if (currentUser) await saveLogToDB(logTargetDate, entry, existingId);
        // 질문 배너 노출 (오늘 날짜 + 태그 있음 + 오늘 dismiss 안 했음 + 질문 답변 없음)
        const allTags = [...entry.mood, ...entry.symptom, ...entry.energy, ...entry.etc];
        const today = getTodayStr();
        const alreadyDismissed = localStorage.getItem(`question_dismissed_${today}`);
        const existingLog = logs[today];
        const alreadyAnswered = existingLog?.tag_answer;
        if (allTags.length > 0 && logTargetDate === today && !alreadyDismissed && !alreadyAnswered) {
          showQuestionBanner(logTargetDate, allTags);
        }
      } else {
        delete logs[logTargetDate];
      }
    } catch(e) {
      console.error('로그 저장 오류:', e);
    }
    saveLogs(logs);
    closeLogModal();
    renderLogList();
    const recs = loadRecords();
    updateInsightCard(recs);
  }
