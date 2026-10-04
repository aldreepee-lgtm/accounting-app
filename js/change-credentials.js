// ===== منطق تغيير بيانات الدخول =====

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  await loadCurrentUser();

  const form = document.getElementById('changeForm');
  if (form) form.addEventListener('submit', handleChange);
});

async function loadCurrentUser() {
  const userJson = localStorage.getItem('currentUser');
  if (!userJson) {
    window.location.href = 'index.html';
    return;
  }
  const user = JSON.parse(userJson);
  const badge = document.getElementById('welcomeBadge');
  const roleText = user.role === 'owner' ? 'مدير النظام' : 'عامل';
  badge.textContent = 'مرحباً ' + roleText;
}

async function handleChange(e) {
  e.preventDefault();
  const errorEl = document.getElementById('changeError');
  errorEl.textContent = '';

  const userJson = localStorage.getItem('currentUser');
  if (!userJson) {
    window.location.href = 'index.html';
    return;
  }
  const user = JSON.parse(userJson);

  const newUsername = document.getElementById('newUsername').value.trim();
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // التحقق
  if (newUsername.length < 3) {
    errorEl.textContent = 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل';
    return;
  }

  if (newPassword.length < 4) {
    errorEl.textContent = 'كلمة المرور يجب أن تكون 4 أحرف على الأقل';
    return;
  }

  if (newPassword !== confirmPassword) {
    errorEl.textContent = 'كلمتا المرور غير متطابقتين';
    return;
  }

  // التحقق من عدم وجود مستخدم آخر بنفس الاسم
  const allUsers = await getAll('users');
  const duplicate = allUsers.find(u => u.username === newUsername && u.id !== user.id);
  if (duplicate) {
    errorEl.textContent = 'اسم المستخدم مستخدم بالفعل، اختر اسماً آخر';
    return;
  }

  try {
    // تحديث بيانات المستخدم
    const fullUser = await get('users', user.id);
    fullUser.username = newUsername;
    fullUser.password = newPassword;
    fullUser.mustChange = false;
    fullUser.updatedAt = new Date().toISOString();

    await put('users', fullUser);

    // تحديث الجلسة
    localStorage.setItem('currentUser', JSON.stringify(fullUser));

    alert('✅ تم تغيير بياناتك بنجاح!\n\nاسم المستخدم الجديد: ' + newUsername + '\n\nاحتفظ بهذه البيانات في مكان آمن.');

    window.location.href = 'app.html';

  } catch (err) {
    console.error(err);
    errorEl.textContent = 'حدث خطأ: ' + err.message;
  }
}
