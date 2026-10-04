// ===== منطق صفحة الترخيص =====

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();

  const saved = await get('settings', 'license');
  if (saved && saved.value && saved.value.active) {
    window.location.href = 'index.html';
    return;
  }

  const codeInput = document.getElementById('licenseCode');
  codeInput.addEventListener('input', (e) => {
    e.target.value = formatLicenseInput(e.target.value);
  });

  document.getElementById('licenseForm').addEventListener('submit', handleActivate);
});

async function handleActivate(e) {
  e.preventDefault();
  const errorEl = document.getElementById('errorMsg');
  errorEl.textContent = '';

  const officeName = document.getElementById('officeName').value.trim();
  const code = document.getElementById('licenseCode').value.trim();

  if (!officeName) { errorEl.textContent = 'أدخل اسم المكتب'; return; }
  if (!code) { errorEl.textContent = 'أدخل رمز الترخيص'; return; }

  const ok = verifyLicense(officeName, code);

  if (!ok) {
    errorEl.textContent = '❌ رمز الترخيص غير صحيح لهذا المكتب';
    return;
  }

  const license = {
    key: 'license',
    value: {
      active: true,
      officeName: officeName,
      code: code,
      activatedAt: new Date().toISOString()
    }
  };
  await put('settings', license);

  await put('settings', { key: 'pendingOfficeName', value: officeName });

  alert('✅ تم تفعيل النظام بنجاح!\n\nمرحباً بك في: ' + officeName);
  window.location.href = 'index.html';
}
