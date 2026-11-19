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

// ── 임시 진단(제거 예정): ?diag 로 요청 헤더 존재 여부를 본다 ──
if (new URLSearchParams(location.search).has('diag')) {
  const _origFetch = window.fetch.bind(window);
  window.__reqs = [];
  window.fetch = function (input, init) {
    try {
      const hs = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined));
      let claims = null;
      try {
        const tok = (hs.get('authorization') || '').replace(/^Bearer\s+/, '');
        const seg = tok.split('.')[1];
        if (seg) {
          const p = JSON.parse(atob(seg.replace(/-/g, '+').replace(/_/g, '/')));
          claims = { iss: p.iss, aud: p.aud, role: p.role, exp: p.exp, sub: (p.sub || '').slice(0, 8), alg: JSON.parse(atob(tok.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))).alg };
        }
      } catch (e) {}
      window.__reqs.push({
        url: String(input.url || input).slice(-64),
        hasApiKey: hs.has('apikey'), apiKeyLen: (hs.get('apikey') || '').length, apiKeyHead: (hs.get('apikey') || '').slice(0, 14),
        authLen: (hs.get('authorization') || '').length,
        claims
      });
    } catch (e) {}
    return _origFetch(input, init).then(res => {
      if (res.status >= 400 && window.__reqs.length <= 8) {
        try {
          res.clone().text().then(t => { window.__reqBody = window.__reqBody || []; window.__reqBody.push({ s: res.status, t: t.slice(0, 240) }); });
        } catch (e) {}
      }
      return res;
    });
  };
}

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
