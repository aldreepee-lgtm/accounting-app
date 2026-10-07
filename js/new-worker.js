// ===== منطق إنشاء حساب العامل على جهاز ثانوي (نظيف) =====

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();

  // تحقق أن هذا جهاز ثانوي
  const deviceFlag = await get('settings', 'deviceIsSecondary');
  if (!deviceFlag || !deviceFlag.value) {
    alert('\u26A0\uFE0F هذه الصفحة مخصصة للأجهزة الثانوية فقط');
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

  // ===== التحقق =====
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

  // تحقق من عدم التكرار
  const existingUsers = await getAll('users');
  if (existingUsers.find(u => u.username === username)) {
    err.textContent = 'اسم المستخدم موجود مسبقاً';
    return;
  }

  try {
    // ===== 1) إنشاء العامل الجديد =====
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

    const newId = await addDirect('users', newUser);
    console.log('\u2705 أُنشئ العامل:', username, '| id:', newId);

    // ===== 2) رفع العامل للسحابة =====
    err.textContent = '\u23F3 جاري رفع الحساب للسحابة...';

    try {
      if (typeof syncInit === 'function') await syncInit();

      if (typeof syncUploadDoc !== 'function') {
        throw new Error('syncUploadDoc غير محمّلة');
      }

      const created = await get('users', newId);
      if (!created) throw new Error('لم يُعثر على المستخدم بعد الحفظ');

      await syncUploadDoc('users', created.id, created);
      console.log('\u2705 العامل مرفوع للسحابة:', username);

      // تأكيد الرفع
      await new Promise(r => setTimeout(r, 1200));
    } catch (syncErr) {
      console.error('\u274C فشل الرفع للسحابة:', syncErr);
      err.textContent = '\u26A0\uFE0F تم إنشاء الحساب محلياً لكن فشل الرفع للسحابة. تواصل مع المدير.';
      await new Promise(r => setTimeout(r, 3000));
    }

    // ===== 3) حفظ جلسة العامل =====
    const created = await get('users', newId);
    if (created) {
      localStorage.setItem('currentUser', JSON.stringify(created));
      sessionStorage.setItem('currentUser', JSON.stringify(created));
    }

    // ===== 4) إعدادات الإنهاء =====
    await put('settings', { key: 'setupDone', value: true });
    await put('settings', { key: 'license', value: {
      active: true,
      officeName: 'سحابي',
      code: 'CLOUD',
      activatedAt: new Date().toISOString()
    }});

    // ===== 5) نجاح =====
    alert('\u2705 تم إنشاء حسابك بنجاح!\n\nسيتم تحويلك للوحة التحكم.');

    setTimeout(() => {
      location.href = 'app.html';
    }, 500);

  } catch (ex) {
    console.error(ex);
    err.textContent = '\u26A0\uFE0F خطأ: ' + (ex.message || 'حدث خطأ غير متوقع');
  }
}

// إضافة مباشرة بدون تفعيل المزامنة
function addDirect(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
