/* 달의 기록 — 오늘의 질문: 홈 진입 행, 질문 생성(Edge Function), 답변 저장 */

// 부정 태그 우선순위
const QUESTION_TAG_PRIORITY = [
  '예민해요','불안해요','슬퍼요','무기력해요','감정이 오락가락해요','우울해요',
  '생리통','복통','두통','온 몸이 쑤셔요','메스꺼움','유방통','기력이 없어요','식욕이 늘었어요','입맛이 없어요',
  '좀 처져요','완전 방전','소화가 안돼요','두드러기/여드름','허리통증',
  '행복해요','자신감 넘쳐요','활력 넘쳐요','집중이 잘 돼요',
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
  const banner = document.getElementById('question-banner');
  if (banner) banner.classList.add('show');
  const sub = document.getElementById('question-sub');
  if (sub) sub.textContent = '달이 하루를 궁금해해요';
}

function clearQuestionBanner() {
  const banner = document.getElementById('question-banner');
  if (banner) banner.classList.remove('show');
  const sub = document.getElementById('question-sub');
  if (sub) sub.textContent = '달이 하루를 궁금해해요';
}

function dismissQuestionBanner() {
  clearQuestionBanner();
  localStorage.setItem(`question_dismissed_${getTodayStr()}`, '1');
}

// 앱 로딩 시 질문 노출 여부 체크
async function checkQuestionBanner() {
  if (!currentUser) return;
  const today = getTodayStr();

  if (localStorage.getItem(`question_dismissed_${today}`)) { clearQuestionBanner(); return; }

  const { data } = await sb.from('daily_logs')
    .select('mood, symptom, energy, tag_answer')
    .eq('user_id', currentUser.id)
    .eq('log_date', today)
    .maybeSingle();

  if (!data) { clearQuestionBanner(); return; }
  const allTags = [...(data.mood||[]), ...(data.symptom||[]), ...(data.energy||[])];
  if (allTags.length && !data.tag_answer) {
    showQuestionBanner(today, allTags);
  } else {
    clearQuestionBanner();
  }
}

let _questionGenerating = false;

async function openQuestionModal() {
  if (!currentUser) return;

  if (!currentQuestionDate || !currentQuestionTag) {
    showToast('오늘 상태를 남기면 달이 질문을 보내요');
    return;
  }

  const modal = document.getElementById('question-modal');
  modal.classList.add('open');

  if (currentQuestionText) {
    document.getElementById('question-loading').style.display = 'none';
    document.getElementById('question-content').style.display = 'block';
    document.getElementById('question-text').textContent = currentQuestionText;
    document.getElementById('question-answer').value = '';
    return;
  }

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
        const phaseNames = {
          winter: '겨울(생리기)', spring: '봄(여포기)',
          summer: '여름(배란기)', autumn: '가을(황체기)'
        };
        cyclePhase = phaseNames[phaseKey] || null;
      }
    }

    const session = (await sb.auth.getSession()).data.session;
    if (!session?.access_token) throw new Error('세션 없음');

    // 인증 헤더는 supabase-js가 현재 세션으로 자동으로 붙인다
    const { data, error } = await sb.functions.invoke('generate-question', {
      body: {
        user_id: currentUser.id,
        log_date: currentQuestionDate,
        top_tag: currentQuestionTag,
        cycle_phase: cyclePhase,
      },
    });

    if (error) throw error;

    currentQuestionText = data.question;
    document.getElementById('question-text').textContent = currentQuestionText;
    document.getElementById('question-loading').style.display = 'none';
    document.getElementById('question-content').style.display = 'block';

  } catch(e) {
    console.error('질문 생성 오류:', e);
    document.getElementById('question-loading').innerHTML =
      '<div style="text-align:center;padding:20px;color:rgba(244,239,232,.7);font-size:15px;line-height:1.9;">질문을 불러오지 못했어요.<br>잠시 후 다시 시도해주세요.</div>';
  } finally {
    _questionGenerating = false;
  }
}

function closeQuestionModal() {
  document.getElementById('question-modal').classList.remove('open');
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

  btn.textContent = '저장할게요';
  btn.disabled = false;
  closeQuestionModal();
}
