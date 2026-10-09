// ===== منطق الإعداد الأولي =====

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();

  // قراءة اسم المكتب من الترخيص إن وجد
  const pending = await get('settings', 'pendingOfficeName');
  if (pending && pending.value) {
    document.getElementById('officeName').value = pending.value;
  }

  const form = document.getElementById('setupForm');
  if (form) form.addEventListener('submit', handleSetup);
});

async function handleSetup(e) {
  e.preventDefault();
  const errorEl = document.getElementById('setupError');
  errorEl.textContent = '';

  const officeName = document.getElementById('officeName').value.trim();
  const officePhone = document.getElementById('officePhone').value.trim();
  const officeAddress = document.getElementById('officeAddress').value.trim();
  const officeEmail = document.getElementById('officeEmail').value.trim();
  const currency = document.getElementById('currency').value.trim();
  const openingBalance = parseInt(document.getElementById('openingBalance').value) || 0;

  const newAdminUser = document.getElementById('newAdminUser').value.trim();
  const newAdminPass = document.getElementById('newAdminPass').value;
  const newAdminPassConfirm = document.getElementById('newAdminPassConfirm').value;

  if (!officeName) { errorEl.textContent = 'اسم المكتب مطلوب'; return; }
  if (newAdminUser.length < 3) { errorEl.textContent = 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل'; return; }
  if (newAdminPass.length < 4) { errorEl.textContent = 'كلمة المرور يجب أن تكون 4 أحرف على الأقل'; return; }
  if (newAdminPass !== newAdminPassConfirm) { errorEl.textContent = 'كلمتا المرور غير متطابقتين'; return; }

  // التحقق: هل اسم المكتب يطابق الترخيص؟
  const license = await get('settings', 'license');
  if (license && license.value && license.value.active) {
    if (license.value.officeName.trim() !== officeName) {
      errorEl.textContent = '⚠️ اسم المكتب لا يطابق الرخصة المُفعّلة';
      return;
    }
  }

  try {
    await put('settings', { key: 'officeName', value: officeName });
    await put('settings', { key: 'officePhone', value: officePhone });
    await put('settings', { key: 'officeAddress', value: officeAddress });
    await put('settings', { key: 'officeEmail', value: officeEmail });
    await put('settings', { key: 'currency', value: currency });
    await put('settings', { key: 'openingBalance', value: openingBalance });
    await put('settings', { key: 'setupDone', value: true });
    await put('settings', { key: 'setupDate', value: new Date().toISOString() });

    // حفظ الشعار إن وُجد
    if (typeof getLogoBase64 === 'function') {
      const logo = getLogoBase64();
      if (logo) {
        await put('settings', { key: 'officeLogo', value: logo });
      }
    }

    // حذف الاسم المعلّق
    await deleteItem('settings', 'pendingOfficeName');

    // تحديث بيانات المدير
    const users = await getAll('users');
    const admin = users.find(u => u.role === 'owner');
    if (admin) {
      admin.username = newAdminUser;
      admin.password = newAdminPass;
      admin.mustChange = false;
      await put('users', admin);
    }

    const worker = users.find(u => u.role === 'worker');
    if (worker) {
      worker.mustChange = true;
      await put('users', worker);
    }

    alert('✅ تم الإعداد بنجاح!\n\nتذكّر بيانات الدخول الجديدة:\nاسم المستخدم: ' + newAdminUser);
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';

  } catch (err) {
    console.error(err);
    errorEl.textContent = 'حدث خطأ أثناء الحفظ: ' + err.message;
  }
}

