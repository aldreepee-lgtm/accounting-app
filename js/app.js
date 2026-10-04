// ===== منطق لوحة التحكم =====

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();

  const userJson = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
  if (!userJson) { window.location.href = 'index.html'; return; }
  const user = JSON.parse(userJson);

  if (user.role === 'owner') document.body.classList.add('is-owner');

  const badge = document.getElementById('userBadge');
  badge.textContent = user.role === 'owner' ? '👤 المالك' : '👷 العامل';

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
    window.location.href = 'add-transaction.html?type=' + map[moduleName];
    return;
  }

  alert('📌 وحدة "' + moduleName + '" غير متوفرة بعد');
}
