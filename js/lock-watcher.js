// ===== حارس القفل (v4 — نظيف) =====

(function() {
  'use strict';

  const CHECK_INTERVAL = 30000;
  let timer = null;
  let busy = false;

  function getUser() {
    try { return JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch(e) { return null; }
  }

  async function check() {
    if (busy) return;
    const u = getUser();
    if (!u || u.role === 'owner') return;

    busy = true;
    try {
      if (typeof pullUsersFromCloud === 'function') {
        await pullUsersFromCloud();
      }

      const fresh = await get('users', u.id);
      if (!fresh) return;

      if (fresh.locked === true) {
        if (timer) { clearInterval(timer); timer = null; }
        try { localStorage.removeItem('currentUser'); } catch(e) {}
        try { sessionStorage.removeItem('currentUser'); } catch(e) {}
        try { if (firebaseAuth && firebaseAuth.signOut) await firebaseAuth.signOut(); } catch(e) {}
        alert('\uD83D\uDD12 تم قفل حسابك من قبل المدير');
        window.location.href = 'index.html';
        return;
      }

      const oldPerms = JSON.stringify(u.permissions || {});
      const newPerms = JSON.stringify(fresh.permissions || {});
      if (oldPerms !== newPerms) {
        u.permissions = fresh.permissions;
        u.locked = fresh.locked;
        u.mustChange = fresh.mustChange;
        localStorage.setItem('currentUser', JSON.stringify(u));
        console.log('\uD83D\uDD04 تم تحديث الصلاحيات محلياً');
      }
    } catch(e) {
      console.warn('lock-watcher:', e);
    } finally {
      busy = false;
    }
  }

  function start() {
    if (timer) return;
    const u = getUser();
    if (!u || u.role === 'owner') {
      console.log('\u2139\uFE0F الحارس: لا يعمل للمالك');
      return;
    }
    console.log('\uD83D\uDD25 حارس القفل نشط — كل 30 ثانية');
    setTimeout(check, 5000);
    timer = setInterval(check, CHECK_INTERVAL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(start, 2000); });
  } else {
    setTimeout(start, 2000);
  }

  window.checkUserLockedNow = check;
})();
