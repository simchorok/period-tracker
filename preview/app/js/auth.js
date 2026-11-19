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
  await sb.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: APP_BASE_PATH,
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
  hideSplash();
  const app = document.getElementById('app-main');
  if (app) app.classList.remove('show');
  document.getElementById('login-screen').classList.add('show');
}

let _loadedUserId = null;

async function showApp(user) {
  if (!user) return;

  const isSameUser = currentUser && currentUser.id === user.id;
  currentUser = user;

  hideSplash();
  document.getElementById('login-screen').classList.remove('show');
  document.getElementById('app-main').classList.add('show');

  if (isSameUser) return;

  // 마지막 접속일 업데이트
  sb.from('user_profiles')
    .upsert({ id: user.id, last_seen_at: new Date().toISOString() }, { onConflict: 'id' })
    .then(() => {}).catch(() => {});

  // 데이터 로드 (캐시로 먼저 그리고, DB 응답 뒤 다시 맞춘다)
  await loadAllData();
  await loadNickname();
  if (document.getElementById('tab-mypage').classList.contains('active')) renderMypage();
}

/* ── 인증 상태 감지 ── */
sb.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    showApp(session.user);
  } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
    showLoginScreen();
  }
});

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
