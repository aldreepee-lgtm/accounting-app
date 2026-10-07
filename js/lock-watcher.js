// ===== حارس القفل والصلاحيات (v3 — ذكي) =====
// فحص دوري كل 20 ثانية:
//   - يسحب المستخدمين من السحابة (بصمت)
//   - يفحص القفل → طرد فوري
//   - يفحص الصلاحيات → تحديث localStorage + تنبيه بسيط (بدون reload تلقائي)
//   - لا حلقة، لا reload، لا سحب مزدوج

(function() {
  'use strict';

  const CHECK_INTERVAL = 20000;
  let watcherTimer = null;
  let watcherRunning = false;
  let lastKnownPermsHash = '';

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

  function permsHash(user) {
    try { return JSON.stringify(user.permissions || {}); } catch(e) { return ''; }
  }

  async function checkOnce() {
    if (watcherRunning) return;
    const user = getCurrentUser();
    if (!user) return;
    if (user.role === 'owner') return;

    // 1) فحص القفل المحلي
    try {
      const local = await get('users', user.id);
      if (local && local.locked === true) {
        await kickUser('\uD83D\uDD12 تم قفل حسابك من قبل المدير');
        return;
      }
    } catch(e) {}

    // 2) سحب المستخدمين من السحابة
    if (typeof pullUsersFromCloud !== 'function') return;
    try {
      await pullUsersFromCloud();
    } catch(e) {
      return;
    }

    // 3) فحص ما بعد السحب
    try {
      const fresh = await get('users', user.id);
      if (!fresh) return;

      // القفل
      if (fresh.locked === true) {
        await kickUser('\uD83D\uDD12 تم قفل حسابك من قبل المدير');
        return;
      }

      // الصلاحيات
      const freshHash = permsHash(fresh);
      if (lastKnownPermsHash && freshHash !== lastKnownPermsHash) {
        console.log('\uD83D\uDD04 تحديث الصلاحيات');
        const updated = Object.assign({}, user, {
          permissions: fresh.permissions,
          locked: fresh.locked,
          mustChange: fresh.mustChange
        });
        localStorage.setItem('currentUser', JSON.stringify(updated));
        // إظهار تنبيه شفاف أعلى الصفحة (بدون alert، بدون reload)
        showPermNotice();
      }
      lastKnownPermsHash = freshHash;
    } catch(e) {}
  }

  function showPermNotice() {
    if (document.getElementById('permNoticeBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'permNoticeBanner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#1e3c72;color:#fff;padding:12px 16px;text-align:center;font-size:14px;z-index:999999;box-shadow:0 2px 10px rgba(0,0,0,0.2);font-family:inherit;';
    banner.innerHTML = '\uD83D\uDD04 تم تحديث صلاحياتك من قبل المدير ' +
      '<button onclick="location.reload()" style="margin-right:10px;background:#fff;color:#1e3c72;border:none;padding:6px 14px;border-radius:6px;font-family:inherit;font-weight:700;cursor:pointer;">تحديث الآن</button>';
    document.body.appendChild(banner);
    setTimeout(function() {
      const b = document.getElementById('permNoticeBanner');
      if (b) b.remove();
    }, 15000);
  }

  function startWatcher() {
    if (watcherTimer) return;
    const user = getCurrentUser();
    if (!user || user.role === 'owner') {
      console.log('\u2139\uFE0F حارس القفل: لا يعمل للمالك');
      return;
    }

    // تخزين hash الصلاحيات الأولي
    try { lastKnownPermsHash = permsHash(user); } catch(e) {}

    console.log('\uD83D\uDD25 حارس القفل نشط');
    setTimeout(checkOnce, 8000);
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
    document.addEventListener('DOMContentLoaded', function() { setTimeout(startWatcher, 2000); });
  } else {
    setTimeout(startWatcher, 2000);
  }

  window.checkUserLockedNow = checkOnce;
  window.kickCurrentUser = kickUser;
})();
