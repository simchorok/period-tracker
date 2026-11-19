/* 달의 기록 — 오늘의 질문 배너/모달 */
  // ── 질문 배너/모달 ──────────────────────────────

  // 부정 태그 우선순위
  const QUESTION_TAG_PRIORITY = [
    // 1순위: 부정 감정
    '예민해요','불안해요','슬퍼요','무기력해요','감정이 오락가락해요','우울해요',
    // 2순위: 신체 증상
    '생리통','복통','두통','온 몸이 쑤셔요','메스꺼움','유방통','기력이 없어요','식욕이 늘었어요','입맛이 없어요',
    // 3순위: 에너지 저하
    '좀 처져요','완전 방전','소화가 안돼요','두드러기/여드름','허리통증',
    // 4순위: 긍정 감정
    '행복해요','자신감 넘쳐요','활력 넘쳐요','집중이 잘 돼요',
    // 5순위: 중립
    '평온해요','보통이에요',
  ];

  let currentQuestionDate = null;
  let currentQuestionTag = null;
  let currentQuestionText = null;

  function getTopPriorityTag(tags) {
    for (const priority of QUESTION_TAG_PRIORITY) {
      if (tags.includes(priority)) return priority;
    }
    return tags[0] ?? null;
  }

  function showQuestionBanner(logDate, allTags) {
    const topTag = getTopPriorityTag(allTags);
    if (!topTag) return;
    currentQuestionDate = logDate;
    currentQuestionTag = topTag;
    currentQuestionText = null;
    document.getElementById('question-banner').classList.add('show');
  }

  function dismissQuestionBanner() {
    document.getElementById('question-banner').classList.remove('show');
    localStorage.setItem(`question_dismissed_${getTodayStr()}`, '1');
  }

  // 앱 로딩 시 질문 배너 노출 여부 체크
  async function checkQuestionBanner() {
    if (!currentUser) return;
    const today = getTodayStr();

    // 오늘 이미 닫았으면 스킵
    if (localStorage.getItem(`question_dismissed_${today}`)) return;

    // 오늘 로그 있고, 질문 답변 없으면 배너 노출
    const { data } = await sb.from('daily_logs')
      .select('mood, symptom, energy, tag_answer')
      .eq('user_id', currentUser.id)
      .eq('log_date', today)
      .maybeSingle();

    if (!data) return;
    const allTags = [...(data.mood||[]), ...(data.symptom||[]), ...(data.energy||[])];
    if (allTags.length && !data.tag_answer) {
      showQuestionBanner(today, allTags);
    }
  }

  let _questionGenerating = false;

  async function openQuestionModal() {
    // 배너 숨기기 (localStorage dismiss는 X 버튼/저장 완료 시에만)
    document.getElementById('question-banner').classList.remove('show');
    if (!currentUser || !currentQuestionDate || !currentQuestionTag) return;

    const modal = document.getElementById('question-modal');
    modal.style.display = 'flex';

    // 이미 생성된 질문 있으면 재사용
    if (currentQuestionText) {
      document.getElementById('question-loading').style.display = 'none';
      document.getElementById('question-content').style.display = 'block';
      document.getElementById('question-text').textContent = currentQuestionText;
      document.getElementById('question-answer').value = '';
      return;
    }

    // 동시 호출 방지
    if (_questionGenerating) return;
    _questionGenerating = true;

    document.getElementById('question-loading').style.display = 'block';
    document.getElementById('question-content').style.display = 'none';
    document.getElementById('question-answer').value = '';

    try {
      // 사이클 단계 계산
      const records = loadRecords().sort((a,b) => a.start > b.start ? -1 : 1);
      let cyclePhase = null;
      if (records.length > 0) {
        const last = records[0];
        const cycle = calcAvgCycle(records);
        const dayOfCycle = dateDiff(currentQuestionDate, last.start) + 1;
        if (dayOfCycle >= 1) {
          const phaseKey = getCyclePhase(dayOfCycle, cycle);
          const phaseNames = { winter:'❄️ 겨울(생리기)', spring:'🌸 봄(여포기)', summer:'☀️ 여름(배란기)', autumn:'🍂 가을(황체기)' };
          cyclePhase = phaseNames[phaseKey] || null;
        }
      }

      // Edge Function 호출
      const session = (await sb.auth.getSession()).data.session;
      if (!session?.access_token) throw new Error('세션 없음');

      const { data, error } = await sb.functions.invoke('generate-question', {
        body: {
          user_id: currentUser.id,
          log_date: currentQuestionDate,
          top_tag: currentQuestionTag,
          cycle_phase: cyclePhase,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      currentQuestionText = data.question;
      document.getElementById('question-text').textContent = currentQuestionText;
      document.getElementById('question-loading').style.display = 'none';
      document.getElementById('question-content').style.display = 'block';

    } catch(e) {
      console.error('질문 생성 오류:', e);
      document.getElementById('question-loading').innerHTML =
        '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">질문을 불러오지 못했어요.<br>잠시 후 다시 시도해주세요.</div>';
    } finally {
      _questionGenerating = false;
    }
  }

  function closeQuestionModal() {
    document.getElementById('question-modal').style.display = 'none';
    currentQuestionText = null;
    dismissQuestionBanner();
  }

  async function saveQuestionAnswer() {
    if (!currentUser || !currentQuestionDate || !currentQuestionText) return;
    const answer = document.getElementById('question-answer').value.trim();

    const btn = document.getElementById('question-save-btn');
    btn.textContent = '저장 중...';
    btn.disabled = true;

    try {
      await sb.from('daily_logs').upsert({
        user_id: currentUser.id,
        log_date: currentQuestionDate,
        tag_question: currentQuestionText,
        tag_answer: answer || null,
      }, { onConflict: 'user_id,log_date' });
    } catch(e) {
      console.error('답변 저장 오류:', e);
    }

    closeQuestionModal();
  }
