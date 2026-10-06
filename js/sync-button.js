// ===== زر المزامنة الفورية + دالة التشخيص =====

async function doManualSync() {
  const btn = document.getElementById('syncBtn');
  const originalText = btn ? btn.textContent : '';

  if (btn) {
    btn.textContent = '\u23F3';
    btn.disabled = true;
  }

  try {
    if (typeof firebaseAuth === 'undefined' || !firebaseAuth || !firebaseAuth.currentUser) {
      alert('\u26A0\uFE0F المزامنة السحابية غير مُفعّلة\n\nفعّلها من الإعدادات أولاً');
      return;
    }

    console.log('\uD83D\uDD04 بدء المزامنة اليدوية...');

    // 1) رفع الكل من المحلي للسحابة
    if (typeof syncUploadAll === 'function') {
      await syncUploadAll();
      console.log('\u2B06\uFE0F تم رفع البيانات المحلية');
    }

    // 2) إعادة تحميل الصفحة → syncPullOnStart سيجلب الأحدث من السحابة
    alert('\u2705 تمت المزامنة\n\nسيتم تحديث الصفحة الآن');
    setTimeout(() => location.reload(), 600);

  } catch (e) {
    console.error('\u274C خطأ في المزامنة:', e);
    alert('\u274C فشلت المزامنة\n\n' + (e.message || e));
  } finally {
    if (btn) {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }
}

async function diagnoseSync() {
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 تشخيص المزامنة \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');

  const fbUser = (typeof firebaseAuth !== 'undefined' && firebaseAuth) ? firebaseAuth.currentUser : null;

  console.log('1\uFE0F\u20E3 Firebase User:');
  if (fbUser) {
    console.log('   \u2705 Email:', fbUser.email);
    console.log('   \u2705 UID:', fbUser.uid);
  } else {
    console.log('   \u274C غير مسجل دخول سحابي');
  }

  const syncEnabled = await get('settings', 'syncEnabled');
  const syncUserId = await get('settings', 'syncUserId');
  const syncEmail = await get('settings', 'syncEmail');
  console.log('2\uFE0F\u20E3 الإعدادات المحلية:');
  console.log('   syncEnabled:', syncEnabled ? syncEnabled.value : '(غير موجود)');
  console.log('   syncUserId:', syncUserId ? syncUserId.value : '(غير موجود)');
  console.log('   syncEmail:', syncEmail ? syncEmail.value : '(غير موجود)');

  if (fbUser && syncUserId && fbUser.uid !== syncUserId.value) {
    console.log('   \u26A0\uFE0F تحذير: syncUserId \u2260 Firebase UID!');
  }

  const cols = ['users', 'settings', 'transactions', 'inventory', 'daily_closings'];

  if (fbUser) {
    console.log('3\uFE0F\u20E3 البيانات السحابية (Firestore):');
    for (const col of cols) {
      try {
        const snap = await firebaseDB.collection('offices').doc(fbUser.uid).collection(col).get();
        console.log('   \u2601\uFE0F ' + col + ':', snap.size);
      } catch(e) {
        console.log('   \u274C ' + col + ': فشل القراءة —', e.message);
      }
    }
  }

  console.log('4\uFE0F\u20E3 البيانات المحلية (IndexedDB):');
  for (const col of cols) {
    const items = await getAll(col);
    console.log('   \uD83D\uDCBE ' + col + ':', items.length);
  }

  const txs = await getAll('transactions');
  const balance = txs.reduce(function(s, t) {
    if (t.type === 'income') return s + (t.amount || 0);
    if (t.type === 'expense' || t.type === 'purchase') return s - (t.amount || 0);
    return s;
  }, 0);
  console.log('5\uFE0F\u20E3 الرصيد المحلي:', balance.toLocaleString('ar-EG'));
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');

  return { firebaseUser: fbUser ? fbUser.email : null, localBalance: balance, localTransactions: txs.length };
}

window.doManualSync = doManualSync;
window.diagnoseSync = diagnoseSync;
