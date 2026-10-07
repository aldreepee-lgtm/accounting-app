// ===== إدارة الصلاحيات — نظيف من الصفر =====
(function() {
  'use strict';

  const LABELS = {
    addTx:{i:'\u2795',l:'إضافة حركات'},
    deleteTx:{i:'\uD83D\uDDD1',l:'حذف الحركات'},
    viewInventory:{i:'\uD83D\uDCE6',l:'رؤية المخزون'},
    editInventory:{i:'\uD83D\uDED2',l:'تسجيل مشتريات'},
    viewReports:{i:'\uD83D\uDCCA',l:'رؤية التقارير'},
    viewProfit:{i:'\uD83D\uDCB0',l:'رؤية الأرباح'},
    viewWithdrawals:{i:'\uD83D\uDCBC',l:'رؤية المسحوبات'},
    closeDay:{i:'\uD83D\uDD12',l:'إغلاق اليوم'},
    backup:{i:'\uD83D\uDCBE',l:'النسخ الاحتياطي'},
    editSettings:{i:'\u2699',l:'تعديل الإعدادات'}
  };

  function preset(key) {
    if (key === 'worker') return {addTx:true,deleteTx:false,viewInventory:true,editInventory:true,viewReports:false,viewProfit:false,viewWithdrawals:false,closeDay:false,backup:false,editSettings:false};
    if (key === 'accountant') return {addTx:true,deleteTx:true,viewInventory:true,editInventory:true,viewReports:true,viewProfit:true,viewWithdrawals:false,closeDay:true,backup:false,editSettings:false};
    return {addTx:true,deleteTx:true,viewInventory:true,editInventory:true,viewReports:true,viewProfit:true,viewWithdrawals:true,closeDay:true,backup:true,editSettings:false};
  }

  async function openPerms(userId) {
    console.log('[Perms] فتح:', userId);
    try {
      const u = await get('users', userId);
      if (!u) return alert('المستخدم غير موجود');
      if (u.role === 'owner') return alert('لا يمكن تعديل المالك');

      const old = document.getElementById('permsModal');
      if (old) old.remove();

      const perms = u.permissions || preset('worker');

      let html = '<div style="font-weight:700;font-size:16px;margin-bottom:14px;">\uD83D\uDCCB صلاحيات: ' + u.username + '</div>';
      html += '<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;">';
      html += '<button type="button" data-p="worker" style="flex:1;min-width:90px;padding:8px;background:#f0f2f5;border:2px solid #e0e0e0;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">\uD83D\uDC77 عامل</button>';
      html += '<button type="button" data-p="accountant" style="flex:1;min-width:90px;padding:8px;background:#f0f2f5;border:2px solid #e0e0e0;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">\uD83D\uDCBC محاسب</button>';
      html += '<button type="button" data-p="manager" style="flex:1;min-width:90px;padding:8px;background:#f0f2f5;border:2px solid #e0e0e0;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">\uD83D\uDC54 مدير</button>';
      html += '</div>';

      for (const k in LABELS) {
        const p = LABELS[k];
        const c = perms[k] ? 'checked' : '';
        html += '<label style="display:flex;align-items:center;gap:10px;padding:10px;margin-bottom:6px;background:#f9f9f9;border-radius:8px;cursor:pointer;">';
        html += '<input type="checkbox" data-perm="' + k + '" ' + c + ' style="width:20px;height:20px;">';
        html += '<span style="font-size:18px;">' + p.i + '</span>';
        html += '<span style="flex:1;font-size:13px;">' + p.l + '</span>';
        html += '</label>';
      }

      const modal = document.createElement('div');
      modal.id = 'permsModal';
      modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:999999;display:flex;align-items:center;justify-content:center;padding:15px;overflow-y:auto;';
      modal.innerHTML =
        '<div style="background:#fff;border-radius:16px;padding:22px;max-width:500px;width:100%;max-height:90vh;overflow-y:auto;">' +
        html +
        '<div style="display:flex;gap:8px;margin-top:18px;">' +
        '<button id="permsCancelBtn" style="flex:1;padding:12px;background:#e0e0e0;border:none;border-radius:10px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;">إلغاء</button>' +
        '<button id="permsSaveBtn" style="flex:2;padding:12px;background:linear-gradient(135deg,#11998e,#38ef7d);color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;">\uD83D\uDCBE حفظ</button>' +
        '</div></div>';

      document.body.appendChild(modal);

      modal.querySelector('#permsCancelBtn').onclick = function() { modal.remove(); };
      modal.querySelector('#permsSaveBtn').onclick = function() { savePerms(userId, modal); };

      modal.querySelectorAll('[data-p]').forEach(function(btn) {
        btn.onclick = function() {
          const pp = preset(btn.dataset.p);
          modal.querySelectorAll('[data-perm]').forEach(function(cb) {
            cb.checked = !!pp[cb.dataset.perm];
          });
        };
      });
    } catch(e) {
      console.error('[Perms.open]', e);
      alert('خطأ: ' + e.message);
    }
  }

  async function savePerms(userId, modal) {
    try {
      const cbs = modal.querySelectorAll('[data-perm]');
      const perms = {};
      cbs.forEach(function(cb) { perms[cb.dataset.perm] = cb.checked; });
      console.log('[Perms.save] userId=', userId, 'perms=', perms);

      const u = await get('users', userId);
      if (!u) return alert('المستخدم غير موجود');

      u.permissions = perms;
      u.updatedAt = new Date().toISOString();

      // حفظ محلي
      await new Promise(function(res, rej) {
        const tx = db.transaction('users', 'readwrite');
        const req = tx.objectStore('users').put(u);
        req.onsuccess = function() { res(); };
        req.onerror = function() { rej(req.error); };
      });
      console.log('[Perms.save] محلياً: OK');

      // رفع سحابي
      let cloudMsg = '';
      try {
        if (typeof initFirebase === 'function') initFirebase();
        const fb = firebaseAuth && firebaseAuth.currentUser;
        if (!fb) {
          cloudMsg = 'لا يوجد اتصال سحابي';
        } else {
          const snap = await firebaseDB.collection('offices').doc(fb.uid).collection('users').get();
          let targetId = String(userId);
          for (const d of snap.docs) {
            const du = d.data().data;
            if (du && du.username === u.username) { targetId = d.id; break; }
          }
          await firebaseDB.collection('offices').doc(fb.uid).collection('users').doc(targetId)
            .set({ data: u, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
          console.log('[Perms.save] سحابياً: OK docId=' + targetId);
          cloudMsg = 'OK';
        }
      } catch(se) {
        console.error('[Perms.save] سحابياً:', se);
        cloudMsg = 'فشل: ' + (se.message || se);
      }

      modal.remove();
      if (typeof renderUsersList === 'function') await renderUsersList();

      if (cloudMsg === 'OK') alert('✅ تم حفظ الصلاحيات ومزامنتها');
      else alert('⚠️ حُفظ محلياً — ' + cloudMsg);
    } catch(e) {
      console.error('[Perms.save]', e);
      alert('خطأ: ' + e.message);
    }
  }

  window.openPerms = openPerms;
  window.savePerms = savePerms;
})();
