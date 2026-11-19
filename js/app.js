/* 달의 기록 — 앱 초기화, 이벤트 바인딩, 서비스 워커 등록 */
  // 공유 링크로 들어온 경우에는 앱/탭바를 띄우지 않고 공유 뷰만 보여준다 (share.js)
  if (!SHARE_MODE) {
    updateStatus();
    // 태그 이벤트 바인딩
    // 이벤트 위임 초기화 — DOM 준비되면 한 번만
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initLogTagEvents);
    } else {
      initLogTagEvents();
    }

    // PWA Service Worker 등록
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/period-tracker/sw.js')
          .catch(() => {});
      });
    }
  }
