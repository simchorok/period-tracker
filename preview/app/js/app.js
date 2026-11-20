/* 달의 기록 — 앱 초기화, 스플래시 건너뛰기, 이벤트 바인딩
   (preview/app에서는 서비스워커를 등록하지 않는다 — 라이브 PWA 캐시와 분리) */

(function () {
  // 스플래시 건너뛰기
  const skip = document.getElementById('skip');
  if (skip) skip.addEventListener('click', skipSplash);

  // 상태 기록 태그 이벤트 위임 — 실패해도 아래 안전장치는 반드시 걸리도록 감싼다
  try { initLogTagEvents(); } catch (e) { console.warn('[app] 태그 이벤트 초기화 실패:', e && e.message); }

  // 캐시된 기록으로 홈을 먼저 그려 스플래시가 걷힐 때 빈 화면이 보이지 않게 한다
  try { updateStatus(); } catch (e) { console.warn('[app] 첫 렌더 실패:', e && e.message); }

  // 외부 스크립트·세션 응답이 늦어도 화면이 멈추지 않도록 하는 안전장치
  setTimeout(() => {
    const splash = document.getElementById('splash');
    const appEl = document.getElementById('app-main');
    const loginEl = document.getElementById('login-screen');
    if (!splash || !appEl || !loginEl) return;
    if (splash.classList.contains('gone') && (appEl.classList.contains('show') || loginEl.classList.contains('show'))) return;
    hideSplash(true);
    if (!appEl.classList.contains('show') && !loginEl.classList.contains('show')) loginEl.classList.add('show');
  }, 7000);

  // iOS 스크롤 관성에서 탭바가 흔들리지 않도록 높이 고정
  const setVH = () => {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
  };
  setVH();
  window.addEventListener('resize', setVH);

  // 부팅 완료 표시(검증용)
  window.__bootOk = true;
  if (typeof window.__bootHide === 'function') window.__bootHide();
})();
