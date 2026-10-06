// ===== حارس القفل والصلاحيات (Lock Watcher) =====
// فحص دوري كل 20 ثانية لقفل المستخدم + تحديث الصلاحيات
// يعمل فقط للمستخدمين غير المالك

(function() {
  'use strict';

  const CHECK_INTERVAL = 20000; // 20 ثانية
  let watcherTimer = null;
  let watcherRunning = false;

  function getCurrentUser() {
    try {
      const json = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
      return json ? JSON.parse(json) : null;
    } catch(e) { return null; }
  }

  async function kickUser(reason) {
    if (watcherRunning) return; // منع التكرار
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

  async function applyPermissionsIfChanged(user, fresh) {
    if (!fresh || !fresh.permissions) return false;
    const oldPerms = JSON.stringify(user.permissions || {});
    const newPerms = JSON.stringify(fresh.permissions || {});
    if (oldPerms === newPerms) return false;

    // تحديث localStorage
    const updated = Object.assign({}, user, {
      permissions: fresh.permissions,
      locked: fresh.locked,
      mustChange: fresh.mustChange
    });
    localStorage.setItem('currentUser', JSON.stringify(updated));
    console.log('\uD83D\uDD04 تم تحديث الصلاحيات — إعادة تحميل الواجهة');
    // إعادة تحميل الواجهة لتطبيق الصلاحيات (بدون إعادة تحميل كاملة)
    setTimeout(function() { window.location.reload(); }, 500);
    return true;
  }

  async function checkOnce() {
    if (watcherRunning) return;

    const user = getCurrentUser();
    if (!user) return; // لا مستخدم مسجل
    if (user.role === 'owner') return; // المالك لا يُفحص

    // تحقق سريع من القفل المحلي أولاً
    try {
      const local = await get('users', user.id);
      if (local && local.locked === true) {
        await kickUser('\uD83D\uDD12 تم قفل حسابك من قبل المدير');
        return;
      }
    } catch(e) {}

    // فحص السحابة
    if (typeof pullUsersFromCloud !== 'function') return;

    try {
      await pullUsersFromCloud();
      const fresh = await get('users', user.id);
      if (!fresh) return;

      if (fresh.locked === true) {
        await kickUser('\uD83D\uDD12 تم قفل حسابك من قبل المدير');
        return;
      }

      await applyPermissionsIfChanged(user, fresh);
    } catch(e) {
      // فشل صامت — لا نزعج المستخدم
      console.warn('Lock watcher check failed:', e);
    }
  }

  function startWatcher() {
    if (watcherTimer) return;
    const user = getCurrentUser();
    if (!user || user.role === 'owner') {
      console.log('\u2139\uFE0F حارس القفل: لا يعمل للمالك');
      return;
    }
    console.log('\uD83D\uDD25 حارس القفل نشط — كل 20 ثانية');

    // أول فحص بعد 5 ثوان من الفتح
    setTimeout(checkOnce, 5000);

    watcherTimer = setInterval(checkOnce, CHECK_INTERVAL);

    // إيقاف عند إخفاء الصفحة، استئناف عند العودة
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

  // التشغيل بعد جهوزية الصفحة
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(startWatcher, 2000);
    });
  } else {
    setTimeout(startWatcher, 2000);
  }

  // كشف خارجي للاستخدام اليدوي
  window.checkUserLockedNow = checkOnce;
  window.kickCurrentUser = kickUser;
})();
