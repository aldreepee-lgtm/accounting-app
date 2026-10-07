// ===== منطق لوحة التحكم =====

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  
  // تهيئة المزامنة
  if (typeof syncInit === 'function') {
    try { await syncInit(); } catch(e) { console.warn('Sync init failed:', e); }
  }

  const userJson = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
  if (!userJson) { window.location.href = 'index.html'; return; }
  const user = JSON.parse(userJson);

  if (user.role === 'owner') document.body.classList.add('is-owner');

  const badge = document.getElementById('userBadge');
  badge.textContent = user.role === 'owner' ? '👤 المالك' : '👷 العامل';

  // ✅ طبّق الصلاحيات على الواجهة
  applyPermissionsUI(user);

  await loadOfficeInfo();
  await calculateAndShowBalance();
});

async function loadOfficeInfo() {
  const name = await get('settings', 'officeName');
  const phone = await get('settings', 'officePhone');
  const address = await get('settings', 'officeAddress');
  const currency = await get('settings', 'currency');
  const logo = await get('settings', 'officeLogo');

  const nameEl = document.getElementById('officeNameTop');
  const contactEl = document.getElementById('officeContactTop');
  const currencyEl = document.getElementById('currencyLabel');

  if (name && name.value) nameEl.textContent = name.value;
  document.title = (name && name.value) ? name.value : 'لوحة التحكم';

  const parts = [];
  if (phone && phone.value) parts.push('📞 ' + phone.value);
  if (address && address.value) parts.push('📍 ' + address.value);
  contactEl.textContent = parts.join('  |  ');

  if (currency && currency.value) currencyEl.textContent = currency.value;

  // الشعار
  if (logo && logo.value) {
    document.getElementById('topLogo').src = logo.value;
    document.getElementById('topLogo').style.display = 'block';
    document.getElementById('topLogoPlaceholder').style.display = 'none';
  }
}

async function calculateAndShowBalance() {
  const openingSetting = await get('settings', 'openingBalance');
  const initialOpening = openingSetting ? (parseInt(openingSetting.value) || 0) : 0;

  const closings = await getAll('daily_closings');
  let lastClosing = null;
  if (closings.length > 0) {
    closings.sort((a, b) => b.date.localeCompare(a.date));
    lastClosing = closings[0];
  }

  const opening = lastClosing ? lastClosing.closingBalance : initialOpening;
  const allTx = await getAll('transactions');
  const relevantTx = lastClosing ? allTx.filter(t => t.date > lastClosing.date) : allTx;

  let balance = opening;
  for (const tx of relevantTx) {
    const amount = parseInt(tx.amount) || 0;
    if (tx.type === 'income') balance += amount;
    else balance -= amount;
  }

  const balanceEl = document.getElementById('currentBalance');
  balanceEl.textContent = balance.toLocaleString('en-US');
  balanceEl.style.color = balance < 0 ? '#ffe0e0' : '#fff';
}

function logout() {
  if (confirm('هل تريد تسجيل الخروج؟')) {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
  }
}

function comingSoon(moduleName) {
  const map = {
    'الإيرادات': 'income',
    'المصروفات': 'expense',
    'المشتريات': 'purchase',
    'مسحوبات المالك': 'owner_withdraw',
    'مصروفات شخصية': 'owner_personal'
  };

  if (moduleName === 'إغلاق اليوم') { window.location.href = 'close-day.html'; return; }
  if (moduleName === 'المخزون') { window.location.href = 'inventory.html'; return; }
  if (moduleName === 'التقارير') { window.location.href = 'reports.html'; return; }
  if (moduleName === 'النسخ الاحتياطي') { window.location.href = 'backup.html'; return; }

  if (map[moduleName]) {
    window.location.href = 'add-tx.html?type=' + map[moduleName];
    return;
  }

  alert('📌 وحدة "' + moduleName + '" غير متوفرة بعد');
}

// ===== تنبيه المخزون المنخفض =====
async function checkLowStock() {
  try {
    const limitSetting = await get('settings', 'lowStockAlert');
    const limit = limitSetting ? (parseInt(limitSetting.value) || 3) : 3;

    const products = await getAll('inventory');
    const lowProducts = products.filter(p => {
      const q = parseInt(p.quantity) || 0;
      const customLimit = parseInt(p.alertThreshold) || 0;
      const effectiveLimit = customLimit > 0 ? customLimit : limit;
      return q > 0 && q <= effectiveLimit;
    });

    const box = document.getElementById('lowStockAlertBox');
    const list = document.getElementById('lowStockList');
    if (!box || !list) return;

    if (lowProducts.length === 0) {
      box.style.display = 'none';
      return;
    }

    box.style.display = 'block';
    list.innerHTML = lowProducts.map(p => {
      const q = parseInt(p.quantity) || 0;
      return '• <b>' + escapeHtmlAlert(p.name) + '</b> — المتبقي: <span style=\"color:#c62828;font-weight:700;\">' + q + '</span>';
    }).join('<br>');
  } catch(e) {
    console.warn('low stock check:', e);
  }
}

function escapeHtmlAlert(text) {
  const d = document.createElement('div');
  d.textContent = text || '';
  return d.innerHTML;
}

// استدعاء عند فتح لوحة التحكم
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (typeof openDB !== 'function') return;
    let tries = 0;
    while (!db && tries < 30) {
      try { await openDB(); } catch(e) {}
      if (!db) await new Promise(r => setTimeout(r, 100));
      tries++;
    }
    if (!db) return;
    await checkLowStock();
  } catch(e) {}
});


// ===== طبّق الصلاحيات على الأزرار =====
function applyPermissionsUI(user) {
  if (!user || user.role === 'owner') return;
  const p = user.permissions || {};
  const cards = document.querySelectorAll('.menu-card');
  console.log('[Perms] تطبيق على', cards.length, 'زر');

  cards.forEach(function(card) {
    const titleEl = card.querySelector('.title');
    const title = titleEl ? titleEl.textContent.trim() : '';
    let needed = null;

    if (title.indexOf('إيراد') !== -1) needed = 'addTx';
    else if (title.indexOf('مصروف مكتب') !== -1) needed = 'addTx';
    else if (title.indexOf('سجل المشتريات') !== -1) needed = 'viewInventory';
    else if (title.indexOf('مشتريات') !== -1) needed = 'addTx';
    else if (title.indexOf('مصروفات شخصية') !== -1) needed = 'addTx';
    else if (title.indexOf('مسحوبات') !== -1) needed = 'viewWithdrawals';
    else if (title.indexOf('العملاء') !== -1) needed = 'viewInventory';
    else if (title.indexOf('المخزون') !== -1) needed = 'viewInventory';
    else if (title.indexOf('التقارير') !== -1) needed = 'viewReports';
    else if (title.indexOf('إغلاق') !== -1) needed = 'closeDay';
    else if (title.indexOf('النسخ الاحتياطي') !== -1) needed = 'backup';

    if (needed) {
      const ok = p[needed] === true;
      card.style.display = ok ? '' : 'none';
      console.log('[Perms]', ok ? '✅' : '❌', title, '(' + needed + ')');
    }
  });

  // زر الإعدادات — للمالك فقط أو editSettings
  const settingsBtn = document.querySelector('button[onclick*="settings.html"]');
  if (settingsBtn && !p.editSettings) settingsBtn.style.display = 'none';
}

window.applyPermissionsUI = applyPermissionsUI;
