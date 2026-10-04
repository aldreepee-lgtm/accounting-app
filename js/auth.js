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
