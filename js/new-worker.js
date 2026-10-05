// ===== منطق إنشاء حساب العامل على جهاز ثانوي =====

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();

  // تحقق أن هذا جهاز ثانوي
  const deviceFlag = await get('settings', 'deviceIsSecondary');
  if (!deviceFlag || !deviceFlag.value) {
    alert('⚠️ هذه الصفحة مخصصة للأجهزة الثانوية فقط');
    location.href = 'index.html';
    return;
  }

  document.getElementById('newWorkerForm').addEventListener('submit', handleCreate);
});

async function handleCreate(e) {
  e.preventDefault();
  const err = document.getElementById('nwError');
  err.textContent = '';

  const username = document.getElementById('nwUsername').value.trim();
  const password = document.getElementById('nwPassword').value;
  const password2 = document.getElementById('nwPassword2').value;

  // التحقق
  if (username.length < 3) {
    err.textContent = 'اسم المستخدم 3 أحرف على الأقل';
    return;
  }
  if (password.length < 6) {
    err.textContent = 'كلمة المرور 6 أحرف على الأقل';
    return;
  }
  if (password !== password2) {
    err.textContent = 'كلمتا المرور غير متطابقتين';
    return;
  }

  try {
    // 1) احذف جميع المستخدمين الحاليين (الذين جاءوا من السحابة)
    await clearAllUsers();

    // 2) أنشئ مستخدم العامل الجديد
    const newUser = {
      username: username,
      password: password,
      role: 'worker',
      mustChange: false,
      locked: false,
      permissions: {
        addTx: true,
        deleteTx: false,
        viewInventory: true,
        editInventory: true,
        viewReports: false,
        viewProfit: false,
        viewWithdrawals: false,
        closeDay: false,
        backup: false,
        editSettings: false
      },
      deviceRole: 'secondary-worker',
      createdAt: new Date().toISOString()
    };

    // نستخدم add مباشرة (بدون sync للتفادي)
    await addDirect('users', newUser);

    // 3) احفظ جلسة المستخدم
    const users = await getAll('users');
    const created = users.find(u => u.username === username);
    if (created) {
      localStorage.setItem('currentUser', JSON.stringify(created));
      sessionStorage.setItem('currentUser', JSON.stringify(created));
    }

    // 4) علّم أن الإعداد تم
    await put('settings', { key: 'setupDone', value: true });
    await put('settings', { key: 'license', value: {
      active: true,
      officeName: 'سحابي',
      code: 'CLOUD',
      activatedAt: new Date().toISOString()
    }});

    // 5) رفع المستخدم للسحابة (ليظهر عند المالك)
    try {
      if (typeof syncInit === 'function') {
        await syncInit();
        if (typeof syncUploadDoc === 'function' && created) {
          await syncUploadDoc('users', created.id, created);
          console.log('✅ العامل مرفوع للسحابة');
        }
      }
    } catch(se) { console.warn('Sync upload failed:', se); }

    // 6) رسالة نجاح
    alert('✅ تم إنشاء حسابك بنجاح!\n\nسيتم تحويلك للوحة التحكم.');

    setTimeout(() => {
      location.href = 'app.html';
    }, 500);

  } catch (ex) {
    console.error(ex);
    err.textContent = '⚠️ خطأ: ' + (ex.message || 'حدث خطأ غير متوقع');
  }
}

// مسح كل المستخدمين مباشرة (بدون مزامنة)
function clearAllUsers() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// إضافة مباشرة (بدون استدعاء المزامنة)
function addDirect(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
