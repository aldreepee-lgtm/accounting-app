// ===== منطق الاسترداد =====

const MASTER_KEY = 'RABIE-MASTER-2026';
let currentMode = '';

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
});

function showForm(mode) {
  currentMode = mode;
  const optionsArea = document.getElementById('optionsArea');
  const formArea = document.getElementById('formArea');
  const formTitle = document.getElementById('formTitle');
  const formFields = document.getElementById('formFields');
  const formMsg = document.getElementById('formMsg');

  optionsArea.classList.add('hidden');
  formArea.classList.remove('hidden');
  formMsg.textContent = '';

  if (mode === 'code') {
    formTitle.textContent = '🔢 الاسترداد برمز الأمان';
    formFields.innerHTML =
      '<div class="form-group"><label>اسم المستخدم</label><input type="text" id="recUser" placeholder="اسم المستخدم"></div>' +
      '<div class="form-group"><label>رمز الاسترداد</label><input type="text" id="recCode" placeholder="XXXX-XXXX" style="text-align:center;letter-spacing:2px;font-weight:700;"></div>' +
      '<div class="form-group"><label>كلمة المرور الجديدة</label><input type="password" id="recNewPass" placeholder="6 أحرف على الأقل"></div>' +
      '<div class="form-group"><label>تأكيد كلمة المرور</label><input type="password" id="recNewPass2" placeholder="أعد الكتابة"></div>';
  } else if (mode === 'email') {
    formTitle.textContent = '📧 الاسترداد بالبريد';
    formFields.innerHTML =
      '<div class="form-group"><label>البريد السحابي</label><input type="email" id="recEmail" placeholder="example@gmail.com"></div>' +
      '<p style="font-size:12px;color:#888;text-align:center;line-height:1.7;margin-bottom:10px;">سيتم إرسال رابط إعادة التعيين من Firebase</p>';
  } else if (mode === 'master') {
    formTitle.textContent = '👨‍💻 الاسترداد بمفتاح المطور';
    formFields.innerHTML =
      '<div class="form-group"><label>اسم المستخدم</label><input type="text" id="recUserM" placeholder="اسم المستخدم"></div>' +
      '<div class="form-group"><label>مفتاح المطور</label><input type="text" id="recMasterKey" placeholder="XXXX-XXXX-XXXX" style="text-align:center;letter-spacing:2px;font-weight:700;"></div>' +
      '<div class="form-group"><label>كلمة المرور الجديدة</label><input type="password" id="recNewPassM" placeholder="6 أحرف على الأقل"></div>' +
      '<div class="form-group"><label>تأكيد كلمة المرور</label><input type="password" id="recNewPassM2" placeholder="أعد الكتابة"></div>';
  }
}

function backToOptions() {
  document.getElementById('optionsArea').classList.remove('hidden');
  document.getElementById('formArea').classList.add('hidden');
  currentMode = '';
}

// ===== تنفيذ الاسترداد =====
async function doRecover() {
  const msg = document.getElementById('formMsg');
  msg.style.color = '#2a5298';
  msg.textContent = '⏳ جاري التحقق...';

  try {
    if (currentMode === 'code') {
      await recoverByCode(msg);
    } else if (currentMode === 'email') {
      await recoverByEmail(msg);
    } else if (currentMode === 'master') {
      await recoverByMaster(msg);
    }
  } catch(e) {
    console.error(e);
    msg.style.color = '#c62828';
    msg.textContent = '⚠️ ' + (e.message || 'خطأ');
  }
}

// ===== 1) الاسترداد برمز الأمان =====
async function recoverByCode(msg) {
  const username = document.getElementById('recUser').value.trim();
  const code = document.getElementById('recCode').value.trim().toUpperCase().replace(/\s/g, '');
  const p1 = document.getElementById('recNewPass').value;
  const p2 = document.getElementById('recNewPass2').value;

  if (!username || !code) { msg.style.color = '#c62828'; msg.textContent = 'املأ كل الحقول'; return; }
  if (p1.length < 6) { msg.style.color = '#c62828'; msg.textContent = 'كلمة المرور 6 أحرف على الأقل'; return; }
  if (p1 !== p2) { msg.style.color = '#c62828'; msg.textContent = 'كلمتا المرور غير متطابقتين'; return; }

  const users = await getAll('users');
  const user = users.find(u => u.username === username);

  if (!user) { msg.style.color = '#c62828'; msg.textContent = '❌ المستخدم غير موجود'; return; }
  if (!user.recoveryCode) { msg.style.color = '#c62828'; msg.textContent = '❌ لا يوجد رمز استرداد لهذا الحساب'; return; }
  if (user.recoveryCode !== code) { msg.style.color = '#c62828'; msg.textContent = '❌ رمز الاسترداد غير صحيح'; return; }

  user.password = p1;
  user.passwordChangedAt = new Date().toISOString();
  user.recoveryCode = generateRecoveryCode(); // رمز جديد
  await put('users', user);

  msg.style.color = '#2e7d32';
  msg.textContent = '✅ تم التغيير! رمز الاسترداد الجديد: ' + user.recoveryCode;
  setTimeout(() => {
    alert('✅ تم تغيير كلمة المرور بنجاح!\n\n🔑 رمز الاسترداد الجديد:\n' + user.recoveryCode + '\n\n⚠️ احفظه في مكان آمن — لن يظهر مرة أخرى!');
    location.href = 'index.html';
  }, 1000);
}

// ===== 2) الاسترداد بالبريد السحابي =====
async function recoverByEmail(msg) {
  const email = document.getElementById('recEmail').value.trim();
  if (!email || !email.includes('@')) { msg.style.color = '#c62828'; msg.textContent = 'بريد غير صحيح'; return; }

  if (typeof firebase === 'undefined') {
    msg.style.color = '#c62828';
    msg.textContent = '⚠️ Firebase غير محمّل — تحقق من الإنترنت';
    return;
  }

  if (typeof initFirebase === 'function') initFirebase();

  try {
    await firebaseAuth.sendPasswordResetEmail(email);
    msg.style.color = '#2e7d32';
    msg.textContent = '✅ تم إرسال رابط إعادة التعيين إلى بريدك';
    setTimeout(() => {
      alert('✅ تحقق من بريدك الإلكتروني\n\nستجد رسالة من Firebase فيها رابط لإعادة تعيين كلمة المرور السحابية.');
    }, 800);
  } catch(e) {
    let m = 'فشل الإرسال';
    if (e.code === 'auth/user-not-found') m = 'لا يوجد حساب بهذا البريد';
    else if (e.code === 'auth/invalid-email') m = 'بريد غير صحيح';
    else if (e.code === 'auth/network-request-failed') m = 'فشل الاتصال بالإنترنت';
    msg.style.color = '#c62828';
    msg.textContent = '❌ ' + m;
  }
}

// ===== 3) الاسترداد بمفتاح المطور =====
async function recoverByMaster(msg) {
  const username = document.getElementById('recUserM').value.trim();
  const masterKey = document.getElementById('recMasterKey').value.trim().toUpperCase().replace(/\s/g, '');
  const p1 = document.getElementById('recNewPassM').value;
  const p2 = document.getElementById('recNewPassM2').value;

  if (!username || !masterKey) { msg.style.color = '#c62828'; msg.textContent = 'املأ كل الحقول'; return; }
  if (p1.length < 6) { msg.style.color = '#c62828'; msg.textContent = 'كلمة المرور 6 أحرف على الأقل'; return; }
  if (p1 !== p2) { msg.style.color = '#c62828'; msg.textContent = 'كلمتا المرور غير متطابقتين'; return; }

  if (masterKey !== MASTER_KEY.toUpperCase()) {
    msg.style.color = '#c62828';
    msg.textContent = '❌ مفتاح المطور غير صحيح';
    return;
  }

  const users = await getAll('users');
  const user = users.find(u => u.username === username);

  if (!user) { msg.style.color = '#c62828'; msg.textContent = '❌ المستخدم غير موجود'; return; }

  user.password = p1;
  user.passwordChangedAt = new Date().toISOString();
  user.recoveredByMaster = true;
  user.recoveredAt = new Date().toISOString();
  await put('users', user);

  msg.style.color = '#2e7d32';
  msg.textContent = '✅ تم التغيير بمفتاح المطور';
  setTimeout(() => {
    alert('✅ تم إعادة تعيين كلمة المرور بنجاح!');
    location.href = 'index.html';
  }, 1000);
}

// ===== توليد رمز استرداد =====
function generateRecoveryCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    if (i === 3) code += '-';
  }
  return code;
}
