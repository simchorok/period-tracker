/* 달의 기록 — 설정: Supabase 클라이언트 초기화, 공통 유틸 */
  // ── Supabase 설정 ──
  const SUPABASE_URL = 'https://nzxtpfgjiysmkecktekw.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_ad3WJqIrRSfKrpQYFjyTHA_DzktkuUA';
  const { createClient } = window.supabase;
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);


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
