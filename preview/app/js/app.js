/* 달의 기록 — 앱 초기화, 스플래시 건너뛰기, 이벤트 바인딩
   (preview/app에서는 서비스워커를 등록하지 않는다 — 라이브 PWA 캐시와 분리) */

(function () {
  // 스플래시 건너뛰기
  const skip = document.getElementById('skip');
  if (skip) skip.addEventListener('click', skipSplash);

  // 상태 기록 태그 이벤트 위임
  initLogTagEvents();

  // 캐시된 기록으로 홈을 먼저 그려 스플래시가 걷힐 때 빈 화면이 보이지 않게 한다
  updateStatus();

  // 외부 스크립트 로드 실패 등으로 화면이 멈추지 않도록 안전장치
  setTimeout(() => {
    if (document.getElementById('splash').classList.contains('gone')) return;
    const appShown = document.getElementById('app-main').classList.contains('show');
    const loginShown = document.getElementById('login-screen').classList.contains('show');
    hideSplash(true);
    if (!appShown && !loginShown) document.getElementById('login-screen').classList.add('show');
  }, 7000);

  // iOS 스크롤 관성에서 탭바가 흔들리지 않도록 높이 고정
  const setVH = () => {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
  };
  setVH();
  window.addEventListener('resize', setVH);
})();
