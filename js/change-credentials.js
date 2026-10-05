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
    
    // توليد رمز استرداد جديد
    const recoveryCode = generateRecoveryCodeCC();
    fullUser.recoveryCode = recoveryCode;
    fullUser.recoveryCodeGenerated = new Date().toISOString();

    await put('users', fullUser);

    // تحديث الجلسة
    localStorage.setItem('currentUser', JSON.stringify(fullUser));

    // عرض رمز الاسترداد بشكل بارز
    const msg = '✅ تم تغيير بياناتك بنجاح!\n\n' +
                '👤 اسم المستخدم: ' + newUsername + '\n' +
                '🔒 كلمة المرور: ' + newPassword + '\n\n' +
                '━━━━━━━━━━━━━━━━━━━\n' +
                '🔑 *رمز الاسترداد* (احفظه!):\n' +
                '━━━━━━━━━━━━━━━━━━━\n\n' +
                '        ' + fullUser.recoveryCode + '\n\n' +
                '━━━━━━━━━━━━━━━━━━━\n' +
                '⚠️ *مهم جداً:*\n' +
                'هذا الرمز يظهر مرة واحدة فقط.\n' +
                'احفظه في مكان آمن لاسترداد حسابك\n' +
                'إذا نسيت كلمة المرور مستقبلاً.';
    
    alert(msg);

    window.location.href = 'app.html';

  } catch (err) {
    console.error(err);
    errorEl.textContent = 'حدث خطأ: ' + err.message;
  }
}

// ===== توليد رمز الاسترداد =====
function generateRecoveryCodeCC() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    if (i === 3) code += '-';
  }
  return code;
}
