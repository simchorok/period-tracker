/* 달의 기록 — 인증: 카카오 로그인, 로그아웃, 스플래시 전환, 프로필(닉네임), 탈퇴 */

let currentUser = null;

/* ── 스플래시: 세션 로드와 병행하고, 최소 노출 시간 뒤 자연스럽게 걷힌다 ── */
const SPLASH_MIN_MS = 1700;
const _splashT0 = Date.now();
let _splashHidden = false;

function _actuallyHideSplash() {
  if (_splashHidden) return;
  _splashHidden = true;
  const sp = document.getElementById('splash');
  if (!sp) return;
  sp.classList.add('gone');
  setTimeout(() => { sp.style.display = 'none'; }, 1100);
}

function hideSplash(force) {
  if (_splashHidden) return;
  const wait = Math.max(0, SPLASH_MIN_MS - (Date.now() - _splashT0));
  if (force || wait === 0) _actuallyHideSplash();
  else setTimeout(_actuallyHideSplash, wait);
}

function skipSplash() { _actuallyHideSplash(); }

/* ── 인증 ── */
async function signInWithKakao() {
  if (SB_OFFLINE) { location.reload(); return; }
  try {
    await sb.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: APP_BASE_PATH,
        scopes: 'profile_nickname profile_image'
      }
    });
  } catch (e) {
    showToast('연결이 잠시 불안정해요. 다시 시도해 주세요.');
  }
}

async function signOut() {
  await sb.auth.signOut();
  currentUser = null;
  showLoginScreen();
}

function showLoginScreen() {
  hideSplash();
  const app = document.getElementById('app-main');
  if (app) app.classList.remove('show');
  const login = document.getElementById('login-screen');
  if (!login) return;
  login.classList.add('show');
  if (typeof SB_OFFLINE !== 'undefined' && SB_OFFLINE) {
    const sub = login.querySelector('.login-sub');
    if (sub) sub.textContent = '연결이 잠시 불안정해요. 버튼을 누르면 다시 시도해요.';
  }
}

let _loadedUserId = null;

/* 만료된 토큰으로 데이터를 읽으면 게이트웨이가 401을 돌려준다.
   데이터를 불러오기 전에 세션이 유효한지 확인하고, 만료됐으면 새로 고친다. */
async function ensureFreshSession() {
  try {
    const { data } = await sb.auth.getSession();
    const s = data?.session;
    if (!s) return;
    const expMs = (s.expires_at || 0) * 1000;
    if (expMs && expMs < Date.now() + 60000) {
      const r = await sb.auth.refreshSession();
      if (r.error) console.warn('[auth] 세션 갱신 실패:', r.error.message);
    }
  } catch (e) {
    console.warn('[auth] 세션 확인 실패:', e);
  }
}

async function showApp(user) {
  if (!user) return;

  const isSameUser = currentUser && currentUser.id === user.id;
  currentUser = user;

  hideSplash();
  const login = document.getElementById('login-screen');
  if (login) { login.classList.remove('show'); login.style.display = ''; }
  document.getElementById('app-main').classList.add('show');
  if (typeof maybeShowOnboarding === 'function') maybeShowOnboarding();

  if (isSameUser) return;

  try {
    await ensureFreshSession();

    // 마지막 접속일 업데이트
    sb.from('user_profiles')
      .upsert({ id: user.id, last_seen_at: new Date().toISOString() }, { onConflict: 'id' })
      .then(() => {}).catch(() => {});

    // 데이터 로드 (캐시로 먼저 그리고, DB 응답 뒤 다시 맞춘다)
    await loadAllData();
    await loadNickname();
    if (typeof renderNavAvatar === 'function') renderNavAvatar();
    if (document.getElementById('tab-mypage').classList.contains('active')) renderMypage();
  } catch (e) {
    console.warn('[auth] 데이터 로드 실패:', e && e.message);
    try { updateStatus(); } catch (_) {}
  }
}

/* ── 인증 상태 감지 ── */
try {
  sb.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      showApp(session.user).catch((e) => console.warn('[auth] 앱 진입 실패:', e && e.message));
    } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
      showLoginScreen();
    }
  });
} catch (e) {
  console.warn('[auth] 인증 상태 구독 실패:', e && e.message);
  showLoginScreen();
}

/* ── 카카오 콜백 보완 ──
   브라우저 캐시·bfcache 등으로 클라이언트가 콜백 해시를 소비하지 못한 경우,
   해시의 토큰으로 세션을 직접 복원한다. (정상 처리된 경우에는 아무 것도 하지 않음) */
async function recoverSessionFromUrlHash() {
  const hash = location.hash || '';
  if (!hash.includes('access_token=')) return false;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return false;
  try {
    const { data, error } = await sb.auth.setSession({ access_token, refresh_token });
    if (error || !data?.session) return false;
    history.replaceState(null, '', location.pathname + location.search);
    showApp(data.session.user);
    return true;
  } catch (e) {
    return false;
  }
}

(async () => {
  try {
    const { data } = await sb.auth.getSession();
    if (!data?.session) await recoverSessionFromUrlHash();
  } catch (e) {
    console.warn('[auth] 세션 확인 실패:', e && e.message);
    showLoginScreen();
  }
})();

/* ── 마이페이지: 닉네임 ── */
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
  const email = document.getElementById('mypage-email');
  if (email && !email.textContent) email.textContent = currentUser?.email || '';
  if (typeof renderNavAvatar === 'function') renderNavAvatar();
}

function toggleNicknameEdit() {
  const row = document.getElementById('nickname-input-row');
  const input = document.getElementById('nickname-input');
  if (!row || !input) return;
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
