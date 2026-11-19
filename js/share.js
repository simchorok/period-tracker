/* 달의 기록 — 상태 공유: 스냅샷 생성, 태그/케어 힌트 추출, URL 인코딩, 비로그인 공유 뷰 */

  /* ── 공유 기본 설정 ── */
  const SHARE_BASE_PATH = location.origin + location.pathname.replace(/index\.html$/, '');
  const SHARE_IMAGE_URL = 'https://simchorok.github.io/period-tracker/og-image.png';
  const KAKAO_SDK_SRC = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';

  // 절대 공유하지 않는 태그 (프라이버시 필터)
  const SHARE_HIDDEN_TAGS = ['성관계', '피임', '냉이 많아요'];

  // 페이즈 키 · 표시 이름
  const SHARE_PHASES = {
    winter: { key: 'menstrual',  season: '겨울', name: '생리기', emoji: '❄️' },
    spring: { key: 'follicular', season: '봄',   name: '여포기', emoji: '🌱' },
    summer: { key: 'ovulation',  season: '여름', name: '배란기', emoji: '☀️' },
    autumn: { key: 'luteal',     season: '가을', name: '황체기', emoji: '🍂' },
  };

  // 받는 사람에게 보여줄 케어 힌트 — 위에서부터 우선순위
  const SHARE_CARE_GROUPS = [
    { key: 'warmth', tags: ['생리통', '복통', '허리통증', '온 몸이 쑤셔요'],
      emoji: '🔥', title: '따뜻하게',
      text: '핫팩이나 따뜻한 차로 몸을 따뜻하게 해주면 훨씬 편해져요.' },
    { key: 'calm', tags: ['두통', '어지러워요'],
      emoji: '💧', title: '조용한 휴식',
      text: '불을 조금 낮추고 물을 자주 마시면서 조용히 쉬게 해주세요.' },
    { key: 'food', tags: ['소화가 안돼요', '메스꺼움', '입맛이 없어요'],
      emoji: '🍲', title: '속 편한 메뉴',
      text: '자극적이지 않은 따뜻한 죽이나 수프 같은 메뉴가 좋아요.' },
    { key: 'buffer', tags: ['예민해요', '감정이 오락가락해요', '불안해요'],
      emoji: '🫶', title: '한 템포 천천히',
      text: '조금 예민할 수 있는 날이에요. 서두르지 않고 천천히 이야기해주면 좋아요.' },
    { key: 'comfort', tags: ['우울해요', '슬퍼요', '갑자기 눈물이 나요'],
      emoji: '🌙', title: '말 없이 곁에',
      text: '이유 없이 가라앉는 날이에요. 말없이 곁에 있어주는 것만으로도 큰 힘이 돼요.' },
    { key: 'rest', tags: ['완전 방전', '기력이 없어요', '좀 처져요', '피곤해요'],
      emoji: '🛌', title: '푹 쉬기',
      text: '오늘은 아무것도 안 해도 괜찮아요. 푹 쉴 수 있게 해주세요.' },
    { key: 'body', tags: ['유방통', '두드러기/여드름'],
      emoji: '🌿', title: '몸 배려',
      text: '몸이 예민해지는 시기예요. 카페인과 자극을 줄이고 편하게 해주세요.' },
    { key: 'snack', tags: ['식욕이 늘었어요'],
      emoji: '🍫', title: '간식 한 조각',
      text: '달콤한 간식이나 좋아하는 음식 한 조각이 도움이 돼요.' },
    { key: 'energy', tags: ['행복해요', '평온해요', '자신감 넘쳐요', '집중이 잘 돼요', '활력 넘쳐요'],
      emoji: '🌞', title: '가벼운 산책',
      text: '기분 좋은 에너지가 넘치는 날이에요. 같이 산책하거나 가벼운 약속을 잡아보세요.' },
  ];

  // 태그가 하나도 없을 때 — 지금 페이즈에 맞는 기본 케어 힌트
  const SHARE_PHASE_CARE = {
    menstrual:  { emoji: '🍵', title: '따뜻하게', text: '몸이 쉬고 싶은 시기예요. 따뜻한 차와 무리 없는 하루가 잘 맞아요.' },
    follicular: { emoji: '🌱', title: '가볍게 함께', text: '기운이 올라오는 시기예요. 가볍게 산책하거나 함께 움직여봐도 좋아요.' },
    ovulation:  { emoji: '☀️', title: '즐거운 계획', text: '에너지가 넘치는 시기예요. 같이 즐거운 계획을 세워봐도 좋아요.' },
    luteal:     { emoji: '🍂', title: '조금 더 다정하게', text: '몸이 내려앉는 시기예요. 예민함은 호르몬 때문이니 조금 더 다정하게 대해주세요.' },
  };

  const SHARE_SOURCE_LABEL = {
    today: '오늘의 상태',
    pattern: '보통 이 시기에는 이런 편이에요',
    none: '아직 남긴 상태가 없어요',
  };

  /* ── 태그 정리 ── */
  function sanitizeShareTags(list) {
    const seen = new Set();
    const out = [];
    (list || []).forEach(tag => {
      if (!tag || typeof tag !== 'string') return;
      if (SHARE_HIDDEN_TAGS.includes(tag)) return;   // 프라이버시 필터
      if (seen.has(tag)) return;
      seen.add(tag);
      out.push(tag);
    });
    return out;
  }

  /* ── 태그 추출: 오늘 기록 → 과거 반복 패턴 → 없음 ── */
  function pickShareTags(records, logs, today, phaseCls, cycleDay, cycle) {
    const todayLog = logs[today] || {};
    const todayTags = sanitizeShareTags([
      ...(todayLog.mood || []),
      ...(todayLog.symptom || []),
      ...(todayLog.energy || []),
    ]).slice(0, 5);
    if (todayTags.length) return { tags: todayTags, tagSource: 'today' };

    // 과거 사이클에서 같은 페이즈(또는 주기 ±2일) 기록을 모아 반복 태그 빈도 계산
    const counts = {};
    const order = [];
    const sorted = [...(records || [])].sort((a, b) => a.start > b.start ? 1 : -1);
    sorted.forEach(r => {
      for (let d = 1; d <= cycle; d++) {
        const ds = addDays(r.start, d - 1);
        if (ds >= today) continue;
        const samePhase = getCyclePhase(d, cycle) === phaseCls;
        const nearDay = Math.abs(d - cycleDay) <= 2;
        if (!samePhase && !nearDay) continue;
        const log = logs[ds];
        if (!log) continue;
        sanitizeShareTags([
          ...(log.mood || []),
          ...(log.symptom || []),
          ...(log.energy || []),
        ]).forEach(tag => {
          if (!(tag in counts)) order.push(tag);
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });

    const repeated = order
      .filter(tag => counts[tag] >= 2)
      .sort((a, b) => counts[b] - counts[a])
      .slice(0, 4);
    if (repeated.length) return { tags: repeated, tagSource: 'pattern' };

    return { tags: [], tagSource: 'none' };
  }

  /* ── 케어 힌트: 우선순위 그룹 최대 2개 ── */
  function pickCareHints(tags, phaseKey) {
    const set = new Set(tags || []);
    const matched = SHARE_CARE_GROUPS
      .filter(g => g.tags.some(t => set.has(t)))
      .slice(0, 2)
      .map(g => ({ emoji: g.emoji, title: g.title, text: g.text }));
    if (matched.length) return matched;
    const fallback = SHARE_PHASE_CARE[phaseKey] || SHARE_PHASE_CARE.follicular;
    return [{ emoji: fallback.emoji, title: fallback.title, text: fallback.text }];
  }

  /* ── 스냅샷 생성 ── */
  function buildShareSnapshot() {
    const records = loadRecords();
    if (!records.length) return null;

    const logs = loadLogs();
    const today = getTodayStr();
    const sorted = [...records].sort((a, b) => a.start > b.start ? 1 : -1);
    const last = sorted[sorted.length - 1];
    const cycle = calcAvgCycle(records);
    const cycleDay = Math.max(1, Math.min(dateDiff(today, last.start) + 1, cycle));
    const phaseCls = getCyclePhase(cycleDay, cycle);
    const phase = SHARE_PHASES[phaseCls];

    const { tags, tagSource } = pickShareTags(records, logs, today, phaseCls, cycleDay, cycle);
    const care = pickCareHints(tags, phase.key);
    const nickname = (typeof userNickname === 'string' && userNickname.trim()) ? userNickname.trim() : '사용자';

    return {
      v: 1,
      nickname,
      cycleDay,
      cycleLength: cycle,
      phaseKey: phase.key,
      phaseName: phase.name,
      seasonName: `${phase.season} · ${phase.name}`,
      seasonEmoji: phase.emoji,
      tags: tags.slice(0, 5),
      tagSource,
      care,
    };
  }

  /* ── URL 안전 인코딩 (UTF-8 → Base64URL) ── */
  function shareB64UrlEncode(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function shareB64UrlDecode(code) {
    let s = String(code || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function buildShareUrl(snapshot) {
    return `${SHARE_BASE_PATH}?share=${shareB64UrlEncode(JSON.stringify(snapshot))}`;
  }

  /* ── 공유 문구 ── */
  function buildShareMessage(snap) {
    const head = `${snap.nickname}님의 오늘은 ${snap.seasonEmoji} ${snap.seasonName} ${snap.cycleDay}일째예요.`;
    const tags = (snap.tags || []).length ? ` 오늘의 상태: ${snap.tags.join(', ')}.` : '';
    const care = snap.care && snap.care[0] ? ` ${snap.care[0].text}` : '';
    return `${head}${tags}${care}`;
  }

  /* ── 토스트 ── */
  function showShareToast(message) {
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

  /* ── 클립보드 복사 ── */
  async function copyShareLink(url) {
    // 권한 대기 등으로 응답이 멈추는 브라우저에서도 안내가 나가도록 시간 제한을 둔다
    const settled = (promise, ms) => Promise.race([
      promise.then(() => true).catch(() => false),
      new Promise(resolve => setTimeout(() => resolve(false), ms)),
    ]);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        if (await settled(navigator.clipboard.writeText(url), 1500)) return true;
      }
    } catch (e) { /* 아래 fallback */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  /* ── 카카오 SDK (키가 설정된 경우에만 동적 로드) ── */
  let shareKakaoSdkPromise = null;
  function loadKakaoSdk() {
    if (window.Kakao && window.Kakao.Share) return Promise.resolve(window.Kakao);
    if (shareKakaoSdkPromise) return shareKakaoSdkPromise;
    shareKakaoSdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = KAKAO_SDK_SRC;
      script.async = true;
      script.onload = () => resolve(window.Kakao);
      script.onerror = () => reject(new Error('kakao sdk load failed'));
      document.head.appendChild(script);
    });
    return shareKakaoSdkPromise;
  }

  async function shareViaKakao(snap, url) {
    const Kakao = await loadKakaoSdk();
    if (!Kakao || !Kakao.Share) throw new Error('kakao sdk unavailable');
    if (!Kakao.isInitialized()) Kakao.init(KAKAO_JS_KEY);
    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `${snap.nickname}님의 오늘 · ${snap.seasonEmoji} ${snap.seasonName}`,
        description: buildShareMessage(snap),
        imageUrl: SHARE_IMAGE_URL,
        link: { mobileWebUrl: url, webUrl: url },
      },
      buttons: [{ title: '상태 보기', link: { mobileWebUrl: url, webUrl: url } }],
    });
  }

  /* ── 공유 실행 ── */
  async function shareTodayStatus() {
    const snap = buildShareSnapshot();
    if (!snap) {
      showShareToast('생리 기록을 먼저 남겨주면 오늘 상태를 공유할 수 있어요 🌱');
      return;
    }
    const url = buildShareUrl(snap);
    window.__lastShareUrl = url;
    const title = `${snap.nickname}님의 오늘 상태 · 달의 기록`;
    const text = buildShareMessage(snap);

    if (typeof KAKAO_JS_KEY === 'string' && KAKAO_JS_KEY.trim()) {
      try {
        await shareViaKakao(snap, url);
        return;
      } catch (e) {
        console.warn('[share] kakao 공유 실패, 기본 공유로 전환:', e);
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        // 사용자가 취소했거나 브라우저가 공유 시트를 못 열었을 때 → 링크 복사
      }
    }

    const copied = await copyShareLink(url);
    showShareToast(copied ? '공유 링크를 복사했어요 💌' : '링크를 복사하지 못했어요. 주소창의 주소를 복사해 주세요.');
  }

  /* ── 비로그인 공유 뷰 렌더링 ── */
  function parseShareParam() {
    const raw = new URLSearchParams(location.search).get('share');
    if (!raw) return null;
    try {
      const data = JSON.parse(shareB64UrlDecode(raw));
      if (!data || typeof data !== 'object' || !data.seasonName) return null;
      data.nickname = String(data.nickname || '사용자');
      data.cycleDay = Number.isFinite(Number(data.cycleDay)) ? Number(data.cycleDay) : 1;
      data.seasonEmoji = data.seasonEmoji || '🌙';
      data.seasonName = String(data.seasonName);
      data.tags = sanitizeShareTags(Array.isArray(data.tags) ? data.tags : []).slice(0, 5);
      data.care = (Array.isArray(data.care) ? data.care : []).slice(0, 2)
        .filter(c => c && c.text)
        .map(c => ({ emoji: c.emoji || '💌', title: c.title || '', text: c.text }));
      if (!data.care.length) data.care = pickCareHints(data.tags, data.phaseKey);
      return data;
    } catch (e) {
      return null;
    }
  }

  function renderShareView() {
    const view = document.getElementById('share-view');
    if (!view) return;

    document.body.classList.add('share-mode');
    ['loading-screen', 'login-screen'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('show');
    });

    const snap = parseShareParam();
    const name = snap ? escapeHtml(String(snap.nickname || '사용자')) : '';

    if (!snap) {
      view.innerHTML = `
        <div class="share-inner">
          <div class="share-brand">🌙 달의 기록</div>
          <div class="share-card share-card-error">
            <div class="share-error-emoji">🌫️</div>
            <div class="share-error-title">공유 링크를 읽을 수 없어요</div>
            <div class="share-error-sub">링크가 조금 잘렸을 수 있어요.<br>보낸 사람에게 다시 공유를 부탁해주세요.</div>
          </div>
          <button class="share-cta" onclick="leaveShareView()">달의 기록 둘러보기</button>
        </div>`;
      view.classList.add('show');
      return;
    }

    const tagsHtml = snap.tags.length
      ? `<div class="share-tags">${snap.tags.map(t => `<span class="share-tag">${escapeHtml(t)}</span>`).join('')}</div>`
      : `<div class="share-tags-empty">오늘은 따로 남긴 상태가 없어요</div>`;
    const sourceHtml = snap.tags.length
      ? `<div class="share-source">${escapeHtml(SHARE_SOURCE_LABEL[snap.tagSource] || SHARE_SOURCE_LABEL.none)}</div>`
      : '';

    const careHtml = snap.care.map(c => `
      <div class="share-care-item">
        <span class="share-care-emoji">${escapeHtml(c.emoji)}</span>
        <div class="share-care-body">
          <div class="share-care-title">${escapeHtml(c.title)}</div>
          <div class="share-care-text">${escapeHtml(c.text)}</div>
        </div>
      </div>`).join('');

    view.innerHTML = `
      <div class="share-stars" aria-hidden="true">
        <span style="top:8%;left:12%">✦</span><span style="top:16%;left:78%">✧</span>
        <span style="top:28%;left:30%">·</span><span style="top:34%;left:88%">✦</span>
        <span style="top:52%;left:8%">✧</span><span style="top:62%;left:70%">·</span>
        <span style="top:76%;left:24%">✦</span><span style="top:86%;left:84%">✧</span>
      </div>
      <div class="share-inner">
        <div class="share-brand">🌙 달의 기록</div>
        <div class="share-card">
          <div class="share-card-top">
            <div class="share-name">${name}님의 오늘</div>
            <div class="share-day-badge">${snap.cycleDay}일째</div>
          </div>
          <div class="share-season">
            <span class="share-season-emoji">${escapeHtml(snap.seasonEmoji || '🌙')}</span>
            <span>${escapeHtml(snap.seasonName)}</span>
          </div>
          ${sourceHtml}
          ${tagsHtml}
          <div class="share-care">
            <div class="share-care-head">💌 이렇게 챙겨주면 좋아요</div>
            ${careHtml}
          </div>
        </div>
        <button class="share-cta" onclick="leaveShareView()">나도 달의 기록 시작하기</button>
        <div class="share-foot">달마다 달라지는 몸과 마음의 리듬을 기록해요</div>
      </div>`;
    view.classList.add('show');
  }

  function leaveShareView() {
    location.replace(SHARE_BASE_PATH);
  }

  function bootShareView() {
    renderShareView();
  }

  if (SHARE_MODE) bootShareView();
