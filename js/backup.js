// ===== منطق النسخ الاحتياطي =====

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();

  const userJson = localStorage.getItem('currentUser');
  if (!userJson) { window.location.href = 'index.html'; return; }
  const user = JSON.parse(userJson);
  if (user.role !== 'owner') {
    alert('هذه الصفحة مخصصة للمالك فقط');
    window.location.href = 'app.html';
    return;
  }

  await loadStats();
});

async function loadStats() {
  const users = await getAll('users');
  const tx = await getAll('transactions');
  const inv = await getAll('inventory');
  const cl = await getAll('daily_closings');

  document.getElementById('statUsers').textContent = users.length;
  document.getElementById('statTx').textContent = tx.length;
  document.getElementById('statInv').textContent = inv.length;
  document.getElementById('statClosings').textContent = cl.length;
}

function showMsg(text, type) {
  const box = document.getElementById('msgBox');
  box.textContent = text;
  box.className = 'msg-box show ' + type;
}

// ===== تصدير =====
async function doBackup() {
  try {
    const data = {
      meta: {
        app: 'نظام المحاسبة المصغر',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        officeName: (await get('settings', 'officeName') || {}).value || ''
      },
      settings: await getAll('settings'),
      users: await getAll('users'),
      transactions: await getAll('transactions'),
      inventory: await getAll('inventory'),
      daily_closings: await getAll('daily_closings')
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const officeName = data.meta.officeName || 'مكتب';
    const today = new Date().toISOString().slice(0, 10);
    const filename = `نسخة-${officeName}-${today}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showMsg('✅ تم إنشاء النسخة الاحتياطية بنجاح: ' + filename, 'ok');
  } catch (err) {
    console.error(err);
    showMsg('⚠️ خطأ: ' + err.message, 'err');
  }
}

// ===== استيراد =====
async function doRestore(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!confirm('⚠️ تحذير!\n\nسيتم حذف كل البيانات الحالية واستبدالها بالبيانات الموجودة في الملف.\n\nهل أنت متأكد؟')) {
    event.target.value = '';
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // التحقق
    if (!data.meta || !data.users || !data.transactions) {
      showMsg('⚠️ الملف غير صالح — ليس نسخة احتياطية من هذا النظام', 'err');
      event.target.value = '';
      return;
    }

    showMsg('⏳ جاري الاستعادة...', 'info');

    // مسح الجداول الحالية
    await clearStore('settings');
    await clearStore('users');
    await clearStore('transactions');
    await clearStore('inventory');
    await clearStore('daily_closings');

    // استعادة البيانات
    if (data.settings) for (const item of data.settings) await put('settings', item);
    if (data.users) for (const item of data.users) await put('users', item);
    if (data.transactions) for (const item of data.transactions) await put('transactions', item);
    if (data.inventory) for (const item of data.inventory) await put('inventory', item);
    if (data.daily_closings) for (const item of data.daily_closings) await put('daily_closings', item);

    await loadStats();

    showMsg('✅ تمت الاستعادة بنجاح! سيتم تسجيل خروجك الآن لإعادة الدخول بالبيانات المستوردة.', 'ok');

    setTimeout(() => {
      localStorage.clear();
      window.location.href = 'index.html';
    }, 3000);

  } catch (err) {
    console.error(err);
    showMsg('⚠️ خطأ في قراءة الملف: ' + err.message, 'err');
  }
  event.target.value = '';
}

// ===== مسح كل البيانات =====
async function doFullReset() {
  if (!confirm('⚠️⚠️ تحذير شديد!\n\nسيتم حذف كل شيء: المستخدمين، الحركات، المخزون، الإعدادات.\n\nلا يمكن التراجع!\n\nهل أنت متأكد؟')) return;
  if (!confirm('تأكيد أخير: هل تريد حقاً مسح كل البيانات؟')) return;

  try {
    await clearStore('settings');
    await clearStore('users');
    await clearStore('transactions');
    await clearStore('inventory');
    await clearStore('daily_closings');

    showMsg('✅ تم مسح كل البيانات. سيتم تحويلك لإعادة الإعداد...', 'ok');
    setTimeout(() => {
      localStorage.clear();
      window.location.href = 'index.html';
    }, 2000);
  } catch (err) {
    console.error(err);
    showMsg('⚠️ خطأ: ' + err.message, 'err');
  }
}

function clearStore(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
