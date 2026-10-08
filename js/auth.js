// ===== المصادقة =====
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  await seedDefaults();
  await loadOfficeInfo();

  document.getElementById('loginForm').addEventListener('submit', handleLogin);
});

async function loadOfficeInfo() {
  // اسم المكتب
  const nameSetting = await get('settings', 'officeName');
  if (nameSetting && nameSetting.value) {
    document.getElementById('officeName').textContent = nameSetting.value;
    document.title = nameSetting.value;
  }

  // الشعار
  const logoSetting = await get('settings', 'officeLogo');
  if (logoSetting && logoSetting.value) {
    document.getElementById('officeLogo').src = logoSetting.value;
    document.getElementById('officeLogo').style.display = 'inline-block';
    document.getElementById('logoPlaceholder').style.display = 'none';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('loginError');
  errorEl.textContent = '';

  const users = await getAll('users');
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    errorEl.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة';
    return;
  }

  // 🔒 فحص القفل من السحابة أولاً
  try {
    if (typeof syncUsersFromCloud === 'function') {
      const cloudUser = await syncUsersFromCloud();
      if (cloudUser) {
        user.locked = cloudUser.locked;
        user.permissions = cloudUser.permissions;
        user.mustChange = cloudUser.mustChange;
      }
    }
  } catch(e) { console.warn('Cloud check failed:', e); }

  // 🚨 فحص الحذف من السحابة (للعمال فقط)
  if (user.role !== 'owner' && typeof checkUserExistsInCloud === 'function') {
    try {
      if (typeof initFirebase === 'function' && initFirebase()) {
        if (!firebaseAuth.currentUser) {
          const _be = await get('settings', 'syncBackupEmail');
          const _bp = await get('settings', 'syncBackupPass');
          if (_be && _be.value && _bp && _bp.value) {
            try {
              await firebaseAuth.signInWithEmailAndPassword(_be.value, _bp.value);
              console.log('إعادة الربط التلقائي: OK');
            } catch(se) { console.warn('إعادة الربط التلقائي فشلت:', se); }
          }
        }
      }
    } catch(_re) {}
    try {
      const exists = await checkUserExistsInCloud(username);
      if (exists === false) {
        errorEl.style.color = '#c62828';
        errorEl.innerHTML = '⛔ تم حذف حسابك من قبل المدير<br><small style="font-size:12px;">تواصل مع مدير المكتب</small>';
        try { await deleteItem('users', user.id); } catch(e) {}
        return;
      }
    } catch(e) { console.warn('Cloud check failed:', e); }
  }

  // 🔒 فحص القفل
  if (user.locked === true) {
    errorEl.style.color = '#c62828';
    errorEl.innerHTML = '🔒 حسابك مقفل<br><small style="font-size:12px;">تواصل مع مدير المكتب</small>';
    return;
  }

  // تحديث آخر دخول
  user.lastLogin = new Date().toISOString();
  try {
    if (typeof putLocal === 'function') { await putLocal('users', user); }
    else { await put('users', user); }
  } catch(e) { console.warn('lastLogin save:', e); }

  localStorage.setItem('currentUser', JSON.stringify(user));

  // التحقق من الترخيص أولاً
  const license = await get('settings', 'license');
  if (!license || !license.value || !license.value.active) {
    window.location.href = 'license.html';
    return;
  }

  // التحقق من الإعداد الأولي
  const setupDone = await get('settings', 'setupDone');
  if (!setupDone || !setupDone.value) {
    window.location.href = 'setup.html';
    return;
  }

  if (user.mustChange) {
    window.location.href = 'change-credentials.html';
    return;
  }

  window.location.href = 'app.html';
}


// ===== الدخول السحابي =====

function showCloudLoginForm() {
  document.getElementById('cloudLoginForm').style.display = 'block';
  document.getElementById('cloudError').textContent = '';
}

function hideCloudLoginForm() {
  document.getElementById('cloudLoginForm').style.display = 'none';
  document.getElementById('cloudEmail').value = '';
  document.getElementById('cloudPass').value = '';
  document.getElementById('cloudError').textContent = '';
}

async function doCloudLogin() {
  const email = document.getElementById('cloudEmail').value.trim();
  const pass = document.getElementById('cloudPass').value;
  const errEl = document.getElementById('cloudError');

  errEl.textContent = '';

  if (!email || !email.includes('@')) {
    errEl.textContent = 'أدخل بريداً إلكترونياً صحيحاً';
    return;
  }
  if (!pass || pass.length < 6) {
    errEl.textContent = 'كلمة المرور مطلوبة (6 على الأقل)';
    return;
  }

  errEl.style.color = '#2a5298';
  errEl.textContent = '⏳ جاري الاتصال بالسحابة...';

  try {
    if (typeof initFirebase !== 'function') {
      throw new Error('Firebase SDK غير محمّل — تأكد من الاتصال بالإنترنت');
    }
    initFirebase();

    // 1) المصادقة
    const cred = await firebaseAuth.signInWithEmailAndPassword(email, pass);
    const user = cred.user;
    console.log('✅ Firebase:', user.email);

    errEl.textContent = '⏳ جاري تحميل بيانات المكتب...';

    // 2) حفظ حالة المزامنة محلياً
    await put('settings', { key: 'syncEnabled', value: true });
    await put('settings', { key: 'syncEmail', value: email });
    await put('settings', { key: 'syncUserId', value: user.uid });
    await put('settings', { key: 'license', value: {
      active: true,
      officeName: 'سحابي',
      code: 'CLOUD',
      activatedAt: new Date().toISOString()
    }});
    await put('settings', { key: 'setupDone', value: true });

    // 3) تحميل البيانات من Firestore
    const collections = ['users', 'settings', 'transactions', 'inventory', 'daily_closings'];
    let totalLoaded = 0;

    for (const col of collections) {
      const snapshot = await firebaseDB
        .collection('offices').doc(user.uid)
        .collection(col).get();

      // مسح الجدول المحلي قبل الاستبدال
      await new Promise((resolve, reject) => {
        const tx = db.transaction(col, 'readwrite');
        const req = tx.objectStore(col).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      // استعادة البيانات (مع إزالة المكرر في users)
      const seenUsernames = {};
      let added = 0;
      for (const docSnap of snapshot.docs) {
        const item = docSnap.data().data;
        if (!item) continue;
        if (col === 'users' && item.username) {
          if (seenUsernames[item.username]) {
            console.log('SKIP مكرر:', item.username);
            continue;
          }
          seenUsernames[item.username] = true;
          try {
            const existing = await getAll('users');
            const dup = existing.find(u => u.username === item.username);
            if (dup) {
              await new Promise((resolve, reject) => {
                const tx = db.transaction('users', 'readwrite');
                const req = tx.objectStore('users').delete(dup.id);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
              });
            }
          } catch(e) {}
        }
        try {
          await put(col, item);
          added++;
          totalLoaded++;
        } catch(err) {
          console.warn('SKIP:', col, item.id || item.username, err.message);
        }
      }
      console.log('محلي:', col, snapshot.size, 'أُضيف', added);
    }

    // 4) إعادة حفظ الإعدادات السحابية (حتى لا تُمسح)
    await put('settings', { key: 'syncEnabled', value: true });
    await put('settings', { key: 'syncEmail', value: email });
    await put('settings', { key: 'syncUserId', value: user.uid });
    await put('settings', { key: 'syncBackupEmail', value: email });
    await put('settings', { key: 'syncBackupPass', value: pass });

    // تحويل المالك إلى عامل محلياً (هذا جهاز ثانوي)
    // ملاحظة: لن نطلب من المستخدم الآن — سنعرض النموذج بعد التوجيه

    errEl.style.color = '#2e7d32';
    errEl.textContent = '✅ تم تحميل ' + totalLoaded + ' سجلاً! جاري التحويل...';

    // حفظ علامة "جهاز ثانوي"
    await put('settings', { key: 'deviceIsSecondary', value: true });

    setTimeout(() => {
      location.href = 'new-worker.html';
    }, 800);

  } catch (e) {
    console.error(e);
    errEl.style.color = '#c62828';
    let msg = 'فشل الاتصال';
    if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
      msg = 'البريد أو كلمة المرور غير صحيحة';
    } else if (e.code === 'auth/user-not-found') {
      msg = 'لا يوجد حساب بهذا البريد';
    } else if (e.code === 'auth/network-request-failed') {
      msg = 'فشل الاتصال بالإنترنت';
    } else if (e.message) {
      msg = e.message;
    }
    errEl.textContent = '❌ ' + msg;
  }
}

