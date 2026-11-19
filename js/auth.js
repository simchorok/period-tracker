/* 달의 기록 — 인증: 카카오 로그인, 로그아웃, 앱 진입, 프로필(닉네임), 탈퇴 */
  let currentUser = null;

  // ── 인증 ──
  async function signInWithKakao() {
    await sb.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: 'https://simchorok.github.io/period-tracker/',
        scopes: 'profile_nickname profile_image'
      }
    });
  }

  async function signOut() {
    await sb.auth.signOut();
    currentUser = null;
    showLoginScreen();
  }

  function showLoginScreen() {
    document.getElementById('loading-screen').classList.remove('show');
    document.getElementById('login-screen').classList.add('show');
  }

  async function showApp(user) {
    currentUser = user;
    document.getElementById('loading-screen').classList.remove('show');
    document.getElementById('login-screen').classList.remove('show');

    // 마지막 접속일 업데이트
    sb.from('user_profiles')
      .upsert({ id: user.id, last_seen_at: new Date().toISOString() }, { onConflict: 'id' })
      .then(() => {}).catch(() => {});

    // 데이터 로드
    loadAllData();
    loadNickname();
  }

  // ── 인증 상태 감지 ──
  sb.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      showApp(session.user);
    } else {
      showLoginScreen();
    }
  });

  /* ── 마이페이지 ── */
  let userNickname = '';

  async function loadNickname() {
    if (!currentUser) return;
    const { data } = await sb.from('user_profiles').select('nickname').eq('id', currentUser.id).maybeSingle();
    if (data?.nickname) {
      userNickname = data.nickname;
      updateNicknameUI();
    }
  }

  function updateNicknameUI() {
    const el = document.getElementById('mypage-nickname');
    if (el) el.textContent = userNickname || '닉네임 설정';
    // 홈 헤더에도 반영
    const homeGreet = document.getElementById('home-greet');
    if (homeGreet && userNickname) homeGreet.textContent = `${userNickname}님의 달의 기록`;
  }

  function toggleNicknameEdit() {
    const row = document.getElementById('nickname-input-row');
    const input = document.getElementById('nickname-input');
    const isShow = row.classList.toggle('show');
    if (isShow) {
      input.value = userNickname || '';
      input.focus();
    }
  }

  async function saveNickname() {
    const val = document.getElementById('nickname-input').value.trim();
    if (!val) return alert('닉네임을 입력해주세요');
    if (!currentUser) return;
    await sb.from('user_profiles').upsert({ id: currentUser.id, nickname: val });
    userNickname = val;
    updateNicknameUI();
    document.getElementById('nickname-input-row').classList.remove('show');
  }

  async function deleteAccount() {
    if (!confirm('정말 탈퇴하시겠어요? 모든 데이터가 삭제되고 복구할 수 없어요.')) return;
    if (!currentUser) return;
    await sb.from('daily_logs').delete().eq('user_id', currentUser.id);
    await sb.from('period_records').delete().eq('user_id', currentUser.id);
    await sb.from('cycle_reports').delete().eq('user_id', currentUser.id);
    await sb.from('user_profiles').delete().eq('id', currentUser.id);
    await sb.auth.signOut();
    currentUser = null;
    localStorage.clear();
    showLoginScreen();
  }
