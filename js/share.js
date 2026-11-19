/* 달의 기록 — 상태 공유 v2: 스냅샷 · 페이즈 인사이트 · 주기 진행 바 · 비로그인 공유 뷰 */

  /* ── 공유 기본 설정 ── */
  const SHARE_BASE_PATH = location.origin + location.pathname.replace(/index\.html$/, '');
  const SHARE_IMAGE_URL = 'https://simchorok.github.io/period-tracker/og-image.png';
  const KAKAO_SDK_SRC = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';
  const SHARE_VERSION = 2;
  const SHARE_DEFAULT_CYCLE = 28;

  // 절대 공유하지 않는 태그 (프라이버시 필터)
  const SHARE_HIDDEN_TAGS = ['성관계', '피임', '냉이 많아요'];

  // 페이즈 키 · 표시 이름 · 호르몬/컨디션 흐름 인사이트
  const SHARE_PHASES = {
    winter: {
      key: 'menstrual', seasonKey: 'winter', season: '겨울', name: '생리기', emoji: '❄️',
      moonLabel: '초승달',
      insightTitle: '몸이 쉬어가는 때',
      insight: '에스트로겐과 프로게스테론이 가장 낮아지는 시기예요. 몸이 보내는 휴식 신호이니, 아무것도 안 해도 괜찮은 며칠이에요.',
      insightShort: '지금은 몸이 한 달을 비우고 다시 시작하는 때예요.',
    },
    spring: {
      key: 'follicular', seasonKey: 'spring', season: '봄', name: '여포기', emoji: '🌱',
      moonLabel: '상현달',
      insightTitle: '기운이 차오르는 때',
      insight: '에스트로겐이 다시 올라오며 기운과 기분이 함께 살아나는 시기예요. 새로운 걸 시작하기 좋은 때예요.',
      insightShort: '지금은 기운이 다시 차오르는 때예요.',
    },
    summer: {
      key: 'ovulation', seasonKey: 'summer', season: '여름', name: '배란기', emoji: '☀️',
      moonLabel: '보름달',
      insightTitle: '가장 밝게 빛나는 때',
      insight: '에스트로겐이 정점에 이르고 에너지와 자신감이 가장 높아지는 때예요. 지금의 좋은 기운을 마음껏 누려도 좋아요.',
      insightShort: '지금은 가장 밝게 빛나는 때예요.',
    },
    autumn: {
      key: 'luteal', seasonKey: 'autumn', season: '가을', name: '황체기', emoji: '🍂',
      moonLabel: '하현달',
      insightTitle: '마음이 조금 예민해지는 때',
      insight: '프로게스테론이 올라가며 몸이 천천히 내려앉는 시기예요. 예민해지는 건 성격이 아니라 호르몬의 흐름이에요.',
      insightShort: '지금은 마음이 조금 예민해지는 때예요.',
    },
  };

  function sharePhaseMeta(phaseKey) {
    return Object.values(SHARE_PHASES).find(p => p.key === phaseKey) || null;
  }

  function sharePhaseMetaBySeason(seasonKey) {
    return SHARE_PHASES[seasonKey] || null;
  }

  // 스냅샷에서 페이즈 정보를 꺼낸다 (v1 링크는 phaseKey·seasonName으로 폴백)
  function shareSnapshotMeta(snap) {
    if (!snap) return null;
    return sharePhaseMeta(snap.phaseKey)
      || sharePhaseMetaBySeason(snap.seasonKey)
      || Object.values(SHARE_PHASES).find(p => String(snap.seasonName || '').includes(p.name))
      || null;
  }

  // 받는 사람에게 보여줄 태그 이모지 — 앱 본체의 태그 이모지와 맞춘다
  const SHARE_TAG_EMOJI = {
    '행복해요': '😊', '평온해요': '😌', '자신감 넘쳐요': '💪', '집중이 잘 돼요': '🎯',
    '예민해요': '😤', '감정이 오락가락해요': '🎢', '불안해요': '😰', '무기력해요': '😔',
    '슬퍼요': '😢', '갑자기 눈물이 나요': '😢', '우울해요': '🌧️',
    '생리통': '🩸', '복통': '🫃', '두통': '🤕', '소화가 안 돼요': '😣', '소화가 안돼요': '😣',
    '허리통증': '🔥', '유방통': '💢', '두드러기/여드름': '😖', '메스꺼움': '🤢',
    '기력이 없어요': '😮‍💨', '온 몸이 쑤셔요': '😩', '식욕이 늘었어요': '🍽️',
    '입맛이 없어요': '🙁', '냉이 많아요': '💧', '어지러워요': '💫', '푹 잤어요': '😴',
    '피곤해요': '🥱', '활력 넘쳐요': '⚡', '보통이에요': '🌤', '좀 처져요': '🌧',
    '완전 방전': '🪫', '술 마심': '🍷', '운동함': '🏃',
  };

  function shareTagEmoji(tag) {
    return SHARE_TAG_EMOJI[tag] || '💗';
  }

  // 받는 사람에게 보여줄 케어 힌트 — 위에서부터 우선순위
  const SHARE_CARE_GROUPS = [
    { key: 'warmth', tags: ['생리통', '복통', '허리통증', '온 몸이 쑤셔요'],
      emoji: '🔥', title: '따뜻하게',
      text: '핫팩이나 따뜻한 차로 몸을 따뜻하게 해주면 훨씬 편해져요.' },
    { key: 'calm', tags: ['두통', '어지러워요'],
      emoji: '💧', title: '조용한 휴식',
      text: '불을 조금 낮추고 물을 자주 마시면서 조용히 쉬게 해주세요.' },
    { key: 'food', tags: ['소화가 안돼요', '소화가 안 돼요', '메스꺼움', '입맛이 없어요'],
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

  // 통증·피로·기분 저하 신호 — 하나라도 있으면 '가벼운 산책'은 함께 띄우지 않는다
  const SHARE_REST_KEYS = ['warmth', 'calm', 'food', 'buffer', 'comfort', 'rest'];

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
    let matched = SHARE_CARE_GROUPS.filter(g => g.tags.some(t => set.has(t)));

    // 통증·피로·기분 저하 신호가 하나라도 있으면 '가벼운 산책'은 모순이라 빼둔다
    if (matched.some(g => SHARE_REST_KEYS.includes(g.key))) {
      matched = matched.filter(g => g.key !== 'energy');
    }

    const hints = matched
      .slice(0, 2)
      .map(g => ({ emoji: g.emoji, title: g.title, text: g.text }));
    if (hints.length) return hints;

    const fallback = SHARE_PHASE_CARE[sharePhaseMeta(phaseKey) ? phaseKey : 'follicular']
      || SHARE_PHASE_CARE.follicular;
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
      v: SHARE_VERSION,
      nickname,
      cycleDay,
      cycleLength: cycle,
      phaseKey: phase.key,
      seasonKey: phase.seasonKey,
      phaseName: phase.name,
      seasonName: `${phase.season} · ${phase.name}`,
      seasonEmoji: phase.emoji,
      insightTitle: phase.insightTitle,
      insight: phase.insight,
      insightShort: phase.insightShort,
      tags: tags.slice(0, 5),
      tagSource,
      care,
    };
  }

  /* ── 주기 진행 위치 ── */
  // 앱 본체 getCyclePhase와 같은 경계: 겨울 6일 고정 → 봄 48% → 여름 63% → 가을
  function shareCycleBounds(cycleLength) {
    const cycle = Math.min(60, Math.max(10, Math.round(Number(cycleLength) || SHARE_DEFAULT_CYCLE)));
    const winterEnd = Math.min(6, cycle);
    const springEnd = Math.min(cycle, Math.max(winterEnd, Math.round(cycle * 0.48)));
    const summerEnd = Math.min(cycle, Math.max(springEnd, Math.round(cycle * 0.63)));
    return { cycle, winterEnd, springEnd, summerEnd };
  }

  function renderShareCycle(cycleDay, cycleLength, activeSeason) {
    const { cycle, winterEnd, springEnd, summerEnd } = shareCycleBounds(cycleLength);
    const day = Math.min(cycle, Math.max(1, Math.round(Number(cycleDay) || 1)));

    const segments = [
      ['winter', winterEnd],
      ['spring', springEnd - winterEnd],
      ['summer', summerEnd - springEnd],
      ['autumn', cycle - summerEnd],
    ].filter(([, days]) => days > 0);

    const bar = segments.map(([season, days]) =>
      `<span class="share-cycle-seg seg-${season}${season === activeSeason ? ' is-current' : ''}" style="flex:${days} 1 0"></span>`
    ).join('');

    const pct = Math.min(99, Math.max(1, ((day - 0.5) / cycle) * 100)).toFixed(2);
    const remaining = cycle - day;
    const nextLabel = remaining > 0 ? `생리까지 ${remaining}일` : '곧 생리 시작일이에요';

    return `
      <div class="share-cycle">
        <div class="share-cycle-track">
          <div class="share-cycle-bar" aria-hidden="true">${bar}</div>
          <span class="share-cycle-marker" style="left:${pct}%" aria-hidden="true"></span>
        </div>
        <div class="share-cycle-legend">
          <span class="share-cycle-now">${cycle}일 주기 중 <strong>${day}일째</strong></span>
          <span class="share-cycle-next">${nextLabel}</span>
        </div>
      </div>`;
  }

  /* ── 달 위상 일러스트 (생리기=초승, 여포기=상현, 배란기=보름, 황체기=하현) ── */
  function shareMoonSvg(phaseKey) {
    const meta = sharePhaseMeta(phaseKey);
    const label = meta ? meta.moonLabel : '보름달';

    // 가려지는(어두운) 부분 — 달 원 안에서만 칠해지도록 clip
    let shade = '';
    if (phaseKey === 'menstrual') {
      shade = '<circle cx="58" cy="50" r="38" fill="url(#shareMoonShade)"/>';
    } else if (phaseKey === 'follicular') {
      shade = '<rect x="8" y="8" width="42" height="84" fill="url(#shareMoonShade)"/>';
    } else if (phaseKey === 'luteal') {
      shade = '<rect x="50" y="8" width="42" height="84" fill="url(#shareMoonShade)"/>';
    }

    return `
      <svg class="share-moon-svg" viewBox="0 0 100 100" role="img" aria-label="${label}">
        <defs>
          <radialGradient id="shareMoonHalo" cx="50%" cy="50%" r="50%">
            <stop offset="52%" stop-color="#f5d6c8" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="#f5d6c8" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="shareMoonGrad" cx="36%" cy="32%" r="76%">
            <stop offset="0%" stop-color="#fffaf3"/>
            <stop offset="52%" stop-color="#f7ddcd"/>
            <stop offset="100%" stop-color="#d8b1a2"/>
          </radialGradient>
          <linearGradient id="shareMoonShade" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1b0f22"/>
            <stop offset="100%" stop-color="#0b0510"/>
          </linearGradient>
          <clipPath id="shareMoonClip"><circle cx="50" cy="50" r="38"/></clipPath>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#shareMoonHalo)"/>
        <g clip-path="url(#shareMoonClip)">
          <circle cx="50" cy="50" r="38" fill="url(#shareMoonGrad)"/>
          <circle cx="41" cy="38" r="7" fill="#e6c2b2" opacity="0.5"/>
          <circle cx="62" cy="57" r="10" fill="#e6c2b2" opacity="0.34"/>
          <circle cx="45" cy="69" r="4.5" fill="#e6c2b2" opacity="0.4"/>
          <circle cx="66" cy="31" r="3.6" fill="#e6c2b2" opacity="0.3"/>
          ${shade}
        </g>
        <circle cx="50" cy="50" r="38" fill="none" stroke="#fff6ee" stroke-opacity="0.22" stroke-width="0.8"/>
      </svg>`;
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

  /* ── 공유 문구: 메신저에 붙여넣어도 읽기 좋게 4~5줄 ── */
  function buildShareMessage(snap) {
    const meta = shareSnapshotMeta(snap);
    const emoji = snap.seasonEmoji || (meta ? meta.emoji : '🌙');
    const seasonName = snap.seasonName || (meta ? `${meta.season} · ${meta.name}` : '오늘');
    const cycleDay = Number(snap.cycleDay) || 1;
    const name = snap.nickname || '사용자';

    const head = `${emoji} ${name}님의 오늘은 ${seasonName} ${cycleDay}일째예요.`;

    const insight = snap.insightShort || (meta ? meta.insightShort : '');

    const tagLine = (snap.tags && snap.tags.length)
      ? `오늘의 상태 · ${snap.tags.map(t => `${shareTagEmoji(t)} ${t}`).join(' · ')}`
      : '오늘은 따로 남긴 상태가 없어요.';

    const topCare = (snap.care || [])[0];
    const careLine = topCare
      ? `${topCare.emoji || '💌'} ${topCare.title ? topCare.title + ' — ' : ''}${topCare.text}`
      : '';

    return [head, insight, tagLine, careLine].filter(Boolean).join('\n\n');
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

  /* ── 비로그인 공유 뷰: 파라미터 검증 + v1 링크 호환 ── */
  function parseShareParam() {
    const raw = new URLSearchParams(location.search).get('share');
    if (!raw) return null;
    try {
      const data = JSON.parse(shareB64UrlDecode(raw));
      if (!data || typeof data !== 'object' || !data.seasonName) return null;

      data.nickname = String(data.nickname || '사용자');
      data.seasonName = String(data.seasonName);
      data.seasonEmoji = data.seasonEmoji || '🌙';
      data.tags = sanitizeShareTags(Array.isArray(data.tags) ? data.tags : []).slice(0, 5);

      // 페이즈 — v1 링크는 seasonName/seasonEmoji만 있어도 여기서 복원된다
      const meta = shareSnapshotMeta(data);
      data.phaseKey = meta ? meta.key : null;
      data.seasonKey = meta ? meta.seasonKey : (data.seasonKey || null);

      data.cycleLength = shareCycleBounds(data.cycleLength).cycle;
      data.cycleDay = Math.min(
        data.cycleLength,
        Math.max(1, Math.round(Number(data.cycleDay) || 1))
      );

      // v1 스냅샷에는 인사이트가 없다 → phaseKey로 채운다
      data.insightTitle = (typeof data.insightTitle === 'string' && data.insightTitle.trim())
        ? data.insightTitle : (meta ? meta.insightTitle : '');
      data.insight = (typeof data.insight === 'string' && data.insight.trim())
        ? data.insight : (meta ? meta.insight : '');
      data.insightShort = (typeof data.insightShort === 'string' && data.insightShort.trim())
        ? data.insightShort : (meta ? meta.insightShort : '');

      data.care = (Array.isArray(data.care) ? data.care : []).slice(0, 2)
        .filter(c => c && c.text)
        .map(c => ({ emoji: c.emoji || '💌', title: c.title || '', text: c.text }));
      if (!data.care.length) data.care = pickCareHints(data.tags, data.phaseKey);

      if (!SHARE_SOURCE_LABEL[data.tagSource]) data.tagSource = data.tags.length ? 'today' : 'none';
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
      delete view.dataset.phase;
      view.innerHTML = `
        <div class="share-stars" aria-hidden="true">
          <span style="top:10%;left:14%">✦</span><span style="top:20%;left:80%">✧</span>
          <span style="top:70%;left:20%">✧</span><span style="top:82%;left:76%">✦</span>
        </div>
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

    const meta = shareSnapshotMeta(snap);
    const seasonKey = meta ? meta.seasonKey : '';
    if (seasonKey) view.dataset.phase = seasonKey;
    else delete view.dataset.phase;

    const tagsHtml = snap.tags.length
      ? `<div class="share-tags">${snap.tags.map(t =>
          `<span class="share-tag"><span class="share-tag-emoji">${shareTagEmoji(t)}</span>${escapeHtml(t)}</span>`
        ).join('')}</div>`
      : `<div class="share-tags-empty">오늘은 따로 남긴 상태가 없어요</div>`;
    const sourceHtml = snap.tags.length
      ? `<div class="share-source">${escapeHtml(SHARE_SOURCE_LABEL[snap.tagSource] || SHARE_SOURCE_LABEL.today)}</div>`
      : '';

    const careHtml = snap.care.map(c => `
      <div class="share-care-item">
        <span class="share-care-emoji">${escapeHtml(c.emoji)}</span>
        <div class="share-care-body">
          <div class="share-care-title">${escapeHtml(c.title)}</div>
          <div class="share-care-text">${escapeHtml(c.text)}</div>
        </div>
      </div>`).join('');

    const insightTitle = snap.insightTitle || (meta ? meta.insightTitle : '');
    const insightText = snap.insight || (meta ? meta.insight : '');
    const insightHtml = insightText
      ? `<div class="share-insight">
           <div class="share-insight-kicker">지금은 ${escapeHtml(insightTitle)}</div>
           <p class="share-insight-text">${escapeHtml(insightText)}</p>
         </div>`
      : '';

    view.innerHTML = `
      <div class="share-stars" aria-hidden="true">
        <span style="top:7%;left:11%">✦</span><span style="top:14%;left:79%">✧</span>
        <span style="top:26%;left:31%">·</span><span style="top:32%;left:89%">✦</span>
        <span style="top:50%;left:6%">✧</span><span style="top:61%;left:72%">·</span>
        <span style="top:75%;left:23%">✦</span><span style="top:86%;left:85%">✧</span>
      </div>
      <div class="share-inner">
        <div class="share-brand">🌙 달의 기록</div>
        <div class="share-card">
          <div class="share-hero">
            <div class="share-moon">${shareMoonSvg(snap.phaseKey)}</div>
            <div class="share-name">${name}님의 오늘</div>
            <div class="share-season">
              <span class="share-season-emoji">${escapeHtml(snap.seasonEmoji || '🌙')}</span>
              <span>${escapeHtml(snap.seasonName)}</span>
              <span class="share-day-badge">${snap.cycleDay}일째</span>
            </div>
          </div>
          ${renderShareCycle(snap.cycleDay, snap.cycleLength, snap.seasonKey)}
          ${insightHtml}
          <div class="share-state">
            ${sourceHtml}
            ${tagsHtml}
          </div>
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
