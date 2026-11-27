/* 달의 기록 — 설정: Supabase 클라이언트, 공통 유틸 */

// ── Supabase 설정 (라이브 본체와 동일 프로젝트) ──
const SUPABASE_URL = 'https://nzxtpfgjiysmkecktekw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ad3WJqIrRSfKrpQYFjyTHA_DzktkuUA';

/* SDK(CDN)가 늦거나 막혀도 화면이 멈추지 않도록, 그때는 아무 것도 하지 않는 대체 클라이언트를 쓴다.
   (로그인 화면은 그대로 뜨고, 카카오 버튼을 누르면 새로고침으로 다시 시도한다) */
function makeOfflineClient() {
  const settled = () => Promise.resolve({ data: null, error: { message: 'offline' } });
  const chain = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') return (onF, onR) => settled().then(onF, onR);
      if (prop === 'catch') return (onR) => settled().catch(onR);
      if (prop === 'finally') return (onF) => settled().finally(onF);
      return () => chain;
    },
    apply() { return chain; }
  });
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: (cb) => {
        setTimeout(() => { try { cb('INITIAL_SESSION', null); } catch (e) {} }, 0);
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signInWithOAuth: () => Promise.resolve({ error: { message: 'offline' } }),
      signOut: () => Promise.resolve({ error: null }),
      refreshSession: settled,
      setSession: settled
    },
    from: () => chain
  };
}

let sb = null;
try {
  sb = (window.supabase && typeof window.supabase.createClient === 'function')
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;
} catch (e) {
  console.warn('[config] Supabase 초기화 실패:', e && e.message);
  sb = null;
}
// SDK를 못 불러왔을 때(SB_OFFLINE)는 대체 클라이언트로 넘겨 화면이 비지 않게 한다.
const SB_OFFLINE = !sb;
if (!sb) sb = makeOfflineClient();

// ── 경로 ──
// 이 앱의 위치(끝에 / 포함). 카카오 로그인 후 이 주소로 돌아온다.
const APP_BASE_PATH = location.origin + location.pathname.replace(/index\.html$/, '');
// 공유 링크는 기존 라이브 공유 뷰(?share=)를 그대로 사용한다.
const SHARE_BASE_PATH = 'https://simchorok.github.io/period-tracker/';
const SHARE_IMAGE_URL = 'https://simchorok.github.io/period-tracker/og-image.png?v=20261121';

// ── 카카오 공유 설정 ──
// 카카오 JavaScript 키를 넣으면 카카오톡 피드 카드로 공유하고,
// 비어 있으면 navigator.share(모바일 공유 시트) → 링크 복사 순서로 동작해요.
const KAKAO_JS_KEY = '0c4c0e8016786b7e1f922b848cb85d11';

// ── XSS 방지 ──
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
