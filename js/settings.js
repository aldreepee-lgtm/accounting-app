// ===== منطق صفحة الإعدادات =====

let newLogoBase64 = null;
let logoChanged = false;

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  
  // تهيئة المزامنة (إن كانت مُفعّلة)
  if (typeof syncInit === 'function') {
    try { await syncInit(); } catch(e) { console.warn('Sync init failed:', e); }
  }

  const userJson = localStorage.getItem('currentUser');
  if (!userJson) { window.location.href = 'index.html'; return; }
  const user = JSON.parse(userJson);
  if (user.role !== 'owner') {
    alert('هذه الصفحة للمالك فقط');
    window.location.href = 'app.html';
    return;
  }

  await loadSettings();

  document.getElementById('logoFile').addEventListener('change', handleLogoUpload);
});

async function loadSettings() {
  const keys = ['officeName', 'officePhone', 'officeAddress', 'officeEmail', 'currency', 'openingBalance', 'officeLogo', 'lowStockAlert'];
  for (const k of keys) {
    const item = await get('settings', k);
    if (item && item.value !== undefined && document.getElementById(k)) {
      document.getElementById(k).value = item.value;
    }
  }

  const logo = await get('settings', 'officeLogo');
  if (logo && logo.value) {
    showLogoPreview(logo.value);
  }
}

function showLogoPreview(src) {
  document.getElementById('logoPreview').innerHTML = '<img src="' + src + '">';
}

function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 500000) {
    alert('⚠️ حجم الصورة كبير (يجب أقل من 500KB)');
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(ev) {
    newLogoBase64 = ev.target.result;
    logoChanged = true;
    showLogoPreview(newLogoBase64);
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  if (!confirm('هل تريد إزالة الشعار؟')) return;
  newLogoBase64 = '';
  logoChanged = true;
  document.getElementById('logoPreview').innerHTML = '<div class="placeholder">📚</div>';
}

async function saveSettings() {
  const msg = document.getElementById('msgBox');
  msg.className = 'msg-box';

  const fields = ['officeName', 'officePhone', 'officeAddress', 'officeEmail', 'currency'];
  for (const k of fields) {
    const el = document.getElementById(k);
    if (el) await put('settings', { key: k, value: el.value.trim() });
  }

  const ob = parseInt(document.getElementById('openingBalance').value) || 0;
  const ls = parseInt(document.getElementById('lowStockAlert').value) || 3;
  await put('settings', { key: 'lowStockAlert', value: ls });
  await put('settings', { key: 'openingBalance', value: ob });

  if (logoChanged) {
    await put('settings', { key: 'officeLogo', value: newLogoBase64 });
  }

  msg.textContent = '✅ تم حفظ الإعدادات بنجاح';
  msg.className = 'msg-box show ok';

  setTimeout(() => { msg.className = 'msg-box'; }, 3000);
}
