// ===== الهوية البصرية (شعار + اسم + تواصل) =====

document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (typeof openDB !== 'function') return;
    let tries = 0;
    while (!db && tries < 50) {
      try { await openDB(); } catch(e) {}
      if (!db) await new Promise(r => setTimeout(r, 100));
      tries++;
    }
    if (!db) return;
    await applyBranding();
    await initDarkMode();
  } catch(e) { console.warn('branding error:', e); }
});

async function applyBranding() {
  const logo = await get('settings', 'officeLogo');
  const name = await get('settings', 'officeName');
  const phone = await get('settings', 'officePhone');
  const address = await get('settings', 'officeAddress');

  const logoUrl = (logo && logo.value) ? logo.value : 'icon.svg';
  const nameVal = (name && name.value) ? name.value : '';
  const phoneVal = (phone && phone.value) ? phone.value : '';
  const addrVal = (address && address.value) ? address.value : '';

  // 1) العلامة المائية - في وسط الشاشة وأمام كل شيء
  let wm = document.getElementById('watermark');
  if (!wm) {
    wm = document.createElement('div');
    wm.id = 'watermark';
    document.body.appendChild(wm);
  }
  wm.innerHTML = '<img src="' + logoUrl + '" alt="">';

  // 2) ترويسة الكشوفات
  const isReport = document.querySelectorAll('[data-office-header]').length > 0;
  if (isReport) document.body.classList.add('report-page');

  const headerTargets = document.querySelectorAll('[data-office-header]');
  headerTargets.forEach(el => {
    el.innerHTML =
      '<div class="office-header">' +
        '<div class="office-header-logo">' +
          ((logo && logo.value) ? '<img src="' + logo.value + '" alt="logo">' : '<div class="placeholder">📚</div>') +
        '</div>' +
        '<div class="office-header-center">' +
          '<h1>' + escB(nameVal) + '</h1>' +
        '</div>' +
        '<div class="office-header-left">' +
          (addrVal ? '<div>📍 ' + escB(addrVal) + '</div>' : '') +
          (phoneVal ? '<div>📞 ' + escB(phoneVal) + '</div>' : '') +
        '</div>' +
      '</div>';
  });
}

function escB(t) {
  const d = document.createElement('div');
  d.textContent = t || '';
  return d.innerHTML;
}

// ===== الوضع الداكن =====
async function initDarkMode() {
  const setting = await get('settings', 'darkMode');
  const enabled = setting && setting.value === true;
  if (enabled) document.body.classList.add('dark-mode');
  addDarkToggle(enabled);
}

function addDarkToggle(enabled) {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;
  if (topbar.querySelector('.dark-toggle-btn')) return;

  const btn = document.createElement('button');
  btn.className = 'dark-toggle-btn';
  btn.innerHTML = enabled ? '☀️' : '🌙';
  btn.title = enabled ? 'وضع نهاري' : 'وضع ليلي';
  btn.onclick = toggleDarkMode;

  topbar.appendChild(btn);
}

async function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  await put('settings', { key: 'darkMode', value: isDark });

  const btn = document.querySelector('.dark-toggle-btn');
  if (btn) {
    btn.innerHTML = isDark ? '☀️' : '🌙';
    btn.title = isDark ? 'وضع نهاري' : 'وضع ليلي';
  }
}
