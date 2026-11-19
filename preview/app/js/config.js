/* 달의 기록 — 리뉴얼 스테이징(preview/app) 설정: Supabase 클라이언트, 공통 유틸 */

// ── Supabase 설정 (라이브 본체와 동일 프로젝트) ──
const SUPABASE_URL = 'https://nzxtpfgjiysmkecktekw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ad3WJqIrRSfKrpQYFjyTHA_DzktkuUA';
const { createClient } = window.supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── 경로 ──
// 이 앱의 위치(끝에 / 포함). 카카오 로그인 후 이 주소로 돌아온다.
const APP_BASE_PATH = location.origin + location.pathname.replace(/index\.html$/, '');
// 공유 링크는 기존 라이브 공유 뷰(?share=)를 그대로 사용한다.
const SHARE_BASE_PATH = 'https://simchorok.github.io/period-tracker/';
const SHARE_IMAGE_URL = 'https://simchorok.github.io/period-tracker/og-image.png';

// ── 카카오 공유 설정 ──
// 카카오 JavaScript 키를 넣으면 카카오톡 피드 카드로 공유하고,
// 비어 있으면 navigator.share(모바일 공유 시트) → 링크 복사 순서로 동작해요.
const KAKAO_JS_KEY = '';

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
