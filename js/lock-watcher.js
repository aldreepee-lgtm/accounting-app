// ===== حارس القفل (نسخة مُصلَحة - v2) =====
// فحص دوري كل 20 ثانية لقفل المستخدم فقط
// بدون سحب سحابي (لتجنب الحلقة) وبدون reload

(function() {
  'use strict';

  const CHECK_INTERVAL = 20000;
  let watcherTimer = null;
  let watcherRunning = false;

  function getCurrentUser() {
    try {
      const json = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
      return json ? JSON.parse(json) : null;
    } catch(e) { return null; }
  }

  async function kickUser(reason) {
    if (watcherRunning) return;
    watcherRunning = true;
    if (watcherTimer) { clearInterval(watcherTimer); watcherTimer = null; }
    try { localStorage.removeItem('currentUser'); } catch(e) {}
    try { sessionStorage.removeItem('currentUser'); } catch(e) {}
    try {
      if (typeof firebaseAuth !== 'undefined' && firebaseAuth && firebaseAuth.signOut) {
        await firebaseAuth.signOut();
      }
    } catch(e) {}
    alert(reason || '\uD83D\uDD12 تم إنهاء جلستك من قبل المدير');
    window.location.href = 'index.html';
  }

  async function checkOnce() {
    if (watcherRunning) return;
    const user = getCurrentUser();
    if (!user) return;
    if (user.role === 'owner') return;

    // فحص القفل المحلي فقط (بدون سحب سحابي)
    try {
      const local = await get('users', user.id);
      if (local && local.locked === true) {
        await kickUser('\uD83D\uDD12 تم قفل حسابك من قبل المدير');
        return;
      }
    } catch(e) {}
  }

  function startWatcher() {
    if (watcherTimer) return;
    const user = getCurrentUser();
    if (!user || user.role === 'owner') {
      console.log('\u2139\uFE0F حارس القفل: لا يعمل للمالك');
      return;
    }
    console.log('\uD83D\uDD25 حارس القفل نشط');

    setTimeout(checkOnce, 5000);
    watcherTimer = setInterval(checkOnce, CHECK_INTERVAL);

    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        if (watcherTimer) { clearInterval(watcherTimer); watcherTimer = null; }
      } else {
        if (!watcherTimer) {
          checkOnce();
          watcherTimer = setInterval(checkOnce, CHECK_INTERVAL);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(startWatcher, 2000);
    });
  } else {
    setTimeout(startWatcher, 2000);
  }

  window.checkUserLockedNow = checkOnce;
  window.kickCurrentUser = kickUser;
})();
