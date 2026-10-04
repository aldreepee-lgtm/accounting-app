// ===== واجهة المزامنة في الإعدادات =====

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('syncSection')) return;
  await renderSyncUI();
});

async function renderSyncUI() {
  const enabled = await isSyncEnabled();
  const email = await getSyncEmail();
  
  const statusBox = document.getElementById('syncStatusBox');
  const actions = document.getElementById('syncActions');
  const forms = document.getElementById('syncForms');
  
  if (enabled && email) {
    // ===== المزامنة مُفعّلة =====
    statusBox.innerHTML = '✅ المزامنة مُفعّلة<br><small style="font-weight:400;">الحساب: ' + email + '</small>';
    statusBox.style.background = '#e8f5e9';
    statusBox.style.color = '#2e7d32';
    
    actions.innerHTML = `
      <button onclick="manualSync()" style="width:100%;padding:12px;background:#2a5298;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px;">
        🔄 مزامنة الآن
      </button>
      <button onclick="disableSync()" style="width:100%;padding:10px;background:#ffebee;color:#c62828;border:none;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;">
        🚫 إيقاف المزامنة على هذا الجهاز
      </button>
    `;
    forms.style.display = 'none';
  } else {
    // ===== المزامنة غير مُفعّلة =====
    statusBox.innerHTML = '⚪ المزامنة غير مُفعّلة';
    statusBox.style.background = '#f5f5f5';
    statusBox.style.color = '#666';
    
    actions.innerHTML = `
      <button onclick="showRegisterForm()" style="width:100%;padding:12px;background:linear-gradient(135deg,#11998e,#38ef7d);color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px;">
        🆕 تسجيل حساب جديد (أول جهاز)
      </button>
      <button onclick="showLoginForm()" style="width:100%;padding:12px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;">
        🔑 ربط بحساب موجود (جهاز آخر)
      </button>
    `;
    forms.style.display = 'none';
  }
}

// ===== نموذج التسجيل =====
function showRegisterForm() {
  const forms = document.getElementById('syncForms');
  forms.style.display = 'block';
  forms.innerHTML = `
    <div style="background:#f9f9f9;padding:15px;border-radius:10px;">
      <h3 style="font-size:14px;color:#333;margin-bottom:10px;">🆕 إنشاء حساب سحابي جديد</h3>
      <input type="email" id="regEmail" placeholder="البريد الإلكتروني" style="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:8px;font-family:inherit;margin-bottom:8px;">
      <input type="password" id="regPass" placeholder="كلمة المرور (6 أحرف على الأقل)" style="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:8px;font-family:inherit;margin-bottom:8px;">
      <input type="password" id="regPass2" placeholder="تأكيد كلمة المرور" style="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:8px;font-family:inherit;margin-bottom:10px;">
      <div id="regMsg" style="text-align:center;font-size:13px;font-weight:600;min-height:20px;margin-bottom:8px;"></div>
      <button onclick="doRegister()" style="width:100%;padding:12px;background:#11998e;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;">
        📤 إنشاء الحساب ورفع البيانات
      </button>
      <button onclick="renderSyncUI()" style="width:100%;padding:8px;background:#e0e0e0;color:#555;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;margin-top:6px;">
        ← إلغاء
      </button>
    </div>
  `;
}

async function doRegister() {
  const email = document.getElementById('regEmail').value.trim();
  const pass = document.getElementById('regPass').value;
  const pass2 = document.getElementById('regPass2').value;
  const msg = document.getElementById('regMsg');
  
  if (!email || !email.includes('@')) { msg.style.color='#c62828'; msg.textContent='بريد إلكتروني غير صحيح'; return; }
  if (pass.length < 6) { msg.style.color='#c62828'; msg.textContent='كلمة المرور قصيرة (6 على الأقل)'; return; }
  if (pass !== pass2) { msg.style.color='#c62828'; msg.textContent='كلمتا المرور غير متطابقتين'; return; }
  
  msg.style.color = '#2a5298';
  msg.textContent = '⏳ جاري إنشاء الحساب ورفع البيانات...';
  
  try {
    await syncRegister(email, pass);
    msg.style.color = '#2e7d32';
    msg.textContent = '✅ تم بنجاح! سيُحدّث الآن...';
    setTimeout(() => { alert('✅ تم تفعيل المزامنة بنجاح!\n\nسيتم استخدام نفس البيانات على أي جهاز يدخل بحسابك.'); location.reload(); }, 1500);
  } catch (e) {
    console.error(e);
    let errorMsg = 'فشل التسجيل';
    if (e.code === 'auth/email-already-in-use') errorMsg = 'البريد مستخدم مسبقاً';
    else if (e.code === 'auth/weak-password') errorMsg = 'كلمة المرور ضعيفة';
    else if (e.code === 'auth/invalid-email') errorMsg = 'بريد غير صحيح';
    msg.style.color = '#c62828';
    msg.textContent = '❌ ' + errorMsg;
  }
}

// ===== نموذج الدخول =====
function showLoginForm() {
  const forms = document.getElementById('syncForms');
  forms.style.display = 'block';
  forms.innerHTML = `
    <div style="background:#f9f9f9;padding:15px;border-radius:10px;">
      <h3 style="font-size:14px;color:#333;margin-bottom:10px;">🔑 ربط بحساب موجود</h3>
      <p style="font-size:12px;color:#666;margin-bottom:10px;line-height:1.6;">
        ⚠️ سيتم استبدال بيانات هذا الجهاز ببيانات السحابة.
      </p>
      <input type="email" id="logEmail" placeholder="البريد الإلكتروني" style="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:8px;font-family:inherit;margin-bottom:8px;">
      <input type="password" id="logPass" placeholder="كلمة المرور" style="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:8px;font-family:inherit;margin-bottom:10px;">
      <div id="logMsg" style="text-align:center;font-size:13px;font-weight:600;min-height:20px;margin-bottom:8px;"></div>
      <button onclick="doLogin()" style="width:100%;padding:12px;background:#667eea;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;">
        📥 تسجيل الدخول وتحميل البيانات
      </button>
      <button onclick="renderSyncUI()" style="width:100%;padding:8px;background:#e0e0e0;color:#555;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;margin-top:6px;">
        ← إلغاء
      </button>
    </div>
  `;
}

async function doLogin() {
  const email = document.getElementById('logEmail').value.trim();
  const pass = document.getElementById('logPass').value;
  const msg = document.getElementById('logMsg');
  
  if (!email || !pass) { msg.style.color='#c62828'; msg.textContent='املأ كل الحقول'; return; }
  
  if (!confirm('⚠️ سيتم مسح البيانات الحالية واستبدالها بالبيانات من السحابة.\n\nهل أنت متأكد؟')) return;
  
  msg.style.color = '#2a5298';
  msg.textContent = '⏳ جاري الدخول وتحميل البيانات...';
  
  try {
    await syncLogin(email, pass);
    msg.style.color = '#2e7d32';
    msg.textContent = '✅ تم بنجاح! سيُحدّث الآن...';
    setTimeout(() => { alert('✅ تم الدخول بنجاح!\n\nالبيانات محدّثة من السحابة.'); location.reload(); }, 1500);
  } catch (e) {
    console.error(e);
    let errorMsg = 'فشل الدخول';
    if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') errorMsg = 'البريد أو كلمة المرور غير صحيحة';
    else if (e.code === 'auth/user-not-found') errorMsg = 'الحساب غير موجود';
    msg.style.color = '#c62828';
    msg.textContent = '❌ ' + errorMsg;
  }
}

// ===== مزامنة يدوية =====
async function manualSync() {
  if (!confirm('هل تريد مزامنة البيانات الآن؟')) return;
  try {
    await syncPullOnStart();
    await syncUploadAll();
    alert('✅ تمت المزامنة بنجاح!');
  } catch (e) {
    alert('❌ فشلت المزامنة: ' + e.message);
  }
}

// ===== إيقاف المزامنة =====
async function disableSync() {
  if (!confirm('⚠️ سيتم إيقاف المزامنة على هذا الجهاز.\n\nالبيانات تبقى في السحابة، لكن هذا الجهاز لن يُزامن.\n\nهل أنت متأكد؟')) return;
  await syncLogout();
  alert('✅ تم إيقاف المزامنة');
  location.reload();
}
