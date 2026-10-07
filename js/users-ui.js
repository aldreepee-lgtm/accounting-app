// ===== واجهة إدارة المستخدمين =====

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('usersSection')) return;

  try {
    let tries = 0;
    while (!db && tries < 50) {
      try { await openDB(); } catch(e) {}
      if (!db) await new Promise(r => setTimeout(r, 100));
      tries++;
    }
    if (!db) throw new Error('قاعدة البيانات غير متاحة');

    await renderUsersList();
  } catch (e) {
    console.error('users-ui error:', e);
    const box = document.getElementById('usersListBox');
    if (box) box.innerHTML = '<div style="color:#c62828;text-align:center;padding:15px;">⚠️ خطأ: ' + e.message + '</div>';
  }
});

async function renderUsersList() {
  const box = document.getElementById('usersListBox');
  const current = JSON.parse(localStorage.getItem('currentUser') || '{}');

  if (current.role !== 'owner') {
    box.innerHTML = '<div style="color:#c62828;text-align:center;padding:15px;">هذه الميزة للمالك فقط</div>';
    return;
  }

  // 🔄 اسحب المستخدمين من السحابة أولاً (ليظهر العمال الجدد)
  if (typeof pullUsersFromCloud === 'function') {
    try {
      box.innerHTML = '<div style="text-align:center;padding:15px;color:#666;">⏳ جاري تحديث القائمة...</div>';
      await pullUsersFromCloud();
    } catch(e) { console.warn('pull users failed:', e); }
  }

  const users = await getAll('users');
  users.sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1;
    if (b.role === 'owner' && a.role !== 'owner') return 1;
    return a.username.localeCompare(b.username);
  });

  let html = '';

  for (const u of users) {
    const isSelf = u.id === current.id;
    const isOwner = u.role === 'owner';
    const locked = u.locked === true;

    let lastLoginText = 'لم يسجّل دخولاً بعد';
    if (u.lastLogin) {
      const d = new Date(u.lastLogin);
      const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60));
      if (diff < 1) lastLoginText = 'الآن';
      else if (diff < 60) lastLoginText = 'قبل ' + diff + ' دقيقة';
      else if (diff < 1440) lastLoginText = 'قبل ' + Math.floor(diff / 60) + ' ساعة';
      else lastLoginText = 'قبل ' + Math.floor(diff / 1440) + ' يوم';
    }

    const statusColor = locked ? '#c62828' : '#2e7d32';
    const statusText = locked ? '🔒 مقفل' : '✅ نشط';
    const roleText = isOwner ? '👤 المالك' : '👷 عامل';

    const bgColor = locked ? '#ffebee' : '#f9f9f9';
    const borderColor = locked ? '#ef9a9a' : '#e0e0e0';

    let actionBtn = '';
    if (isSelf) {
      actionBtn = '<span style="color:#999;font-size:12px;padding:6px 10px;">(أنت)</span>';
    } else if (isOwner) {
      actionBtn = '<span style="color:#999;font-size:12px;padding:6px 10px;">—</span>';
    } else {
      var lockBtn = locked
        ? '<button onclick="toggleLock(' + u.id + ', false)" title="فتح" style="background:#e8f5e9;color:#2e7d32;border:none;padding:8px 11px;border-radius:8px;font-size:14px;cursor:pointer;">🔓</button>'
        : '<button onclick="toggleLock(' + u.id + ', true)" title="قفل" style="background:#ffebee;color:#c62828;border:none;padding:8px 11px;border-radius:8px;font-size:14px;cursor:pointer;">🔒</button>';
      var permBtn = '<button onclick="openPermissions(' + u.id + ')" title="الصلاحيات" style="background:#e3f2fd;color:#1565c0;border:none;padding:8px 11px;border-radius:8px;font-size:14px;cursor:pointer;">📋</button>';
      var delBtn = '<button onclick="deleteUser(' + u.id + ')" title="حذف" style="background:#fce4ec;color:#c2185b;border:none;padding:8px 11px;border-radius:8px;font-size:14px;cursor:pointer;">🗑️</button>';
      actionBtn = '<div style="display:flex;gap:5px;">' + permBtn + lockBtn + delBtn + '</div>';
    }

    html += `
      <div style="background:${bgColor};border:2px solid ${borderColor};border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:700;color:#333;margin-bottom:4px;">${escapeHtml(u.username)}</div>
          <div style="font-size:12px;color:#666;margin-bottom:3px;">${roleText} · <span style="color:${statusColor};font-weight:600;">${statusText}</span></div>
          <div style="font-size:11px;color:#999;">🕐 ${lastLoginText}</div>
        </div>
        <div style="flex-shrink:0;">${actionBtn}</div>
      </div>
    `;
  }

  box.innerHTML = html;
}

async function toggleLock(userId, lock) {
  if (lock === true) {
    if (!confirm('🔒 هل تريد قفل هذا المستخدم؟\n\nلن يستطيع الدخول بعد الآن.')) return;
  } else {
    if (!confirm('🔓 هل تريد فتح هذا المستخدم؟\n\nسيستطيع الدخول من جديد.')) return;
  }

  try {
    const user = await get('users', userId);
    if (!user) { alert('المستخدم غير موجود'); return; }

    user.locked = lock;
    user.lockedAt = lock ? new Date().toISOString() : null;
    await put('users', user);

    alert(lock ? '🔒 تم قفل المستخدم' : '🔓 تم فتح المستخدم');
    await renderUsersList();
  } catch (e) {
    console.error(e);
    alert('خطأ: ' + e.message);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// ===== نافذة الصلاحيات =====
const PERM_LABELS = {
  addTx: { icon: '➕', label: 'إضافة حركات (إيراد/مصروف/مشتري)' },
  deleteTx: { icon: '🗑', label: 'حذف الحركات' },
  viewInventory: { icon: '📦', label: 'رؤية المخزون' },
  editInventory: { icon: '🛒', label: 'تسجيل مشتريات (تعديل المخزون)' },
  viewReports: { icon: '📊', label: 'رؤية التقارير' },
  viewProfit: { icon: '💰', label: 'رؤية الأرباح' },
  viewWithdrawals: { icon: '💼', label: 'رؤية المسحوبات' },
  closeDay: { icon: '🔒', label: 'إغلاق اليوم' },
  backup: { icon: '💾', label: 'النسخ الاحتياطي' },
  editSettings: { icon: '⚙️', label: 'تعديل الإعدادات' }
};

const PERM_PRESETS = {
  worker: { name: '👷 عامل عادي', perms: { addTx:true, deleteTx:false, viewInventory:true, editInventory:true, viewReports:false, viewProfit:false, viewWithdrawals:false, closeDay:false, backup:false, editSettings:false } },
  accountant: { name: '💼 محاسب', perms: { addTx:true, deleteTx:true, viewInventory:true, editInventory:true, viewReports:true, viewProfit:true, viewWithdrawals:false, closeDay:true, backup:false, editSettings:false } },
  manager: { name: '👔 مدير فرع', perms: { addTx:true, deleteTx:true, viewInventory:true, editInventory:true, viewReports:true, viewProfit:true, viewWithdrawals:true, closeDay:true, backup:true, editSettings:false } }
};

async function openPermissions(userId) {
  const user = await get('users', userId);
  if (!user) { alert('المستخدم غير موجود'); return; }
  if (user.role === 'owner') { alert('لا يمكن تعديل صلاحيات المالك'); return; }

  const perms = user.permissions || PERM_PRESETS.worker.perms;

  let html = '';
  // القوالب الجاهزة
  html += '<div style="display:flex;gap:6px;margin-bottom:15px;flex-wrap:wrap;">';
  for (const key in PERM_PRESETS) {
    html += '<button type="button" onclick="applyPermPreset(\'' + key + '\')" style="flex:1;min-width:100px;padding:9px;background:#f0f2f5;border:2px solid #e0e0e0;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">' + PERM_PRESETS[key].name + '</button>';
  }
  html += '</div>';

  // الصلاحيات
  html += '<div id="permList">';
  for (const key in PERM_LABELS) {
    const p = PERM_LABELS[key];
    const checked = perms[key] ? 'checked' : '';
    html += '<label style="display:flex;align-items:center;gap:10px;padding:10px;margin-bottom:6px;background:#f9f9f9;border-radius:8px;cursor:pointer;">';
    html += '<input type="checkbox" id="perm_' + key + '" ' + checked + ' style="width:20px;height:20px;cursor:pointer;">';
    html += '<span style="font-size:18px;">' + p.icon + '</span>';
    html += '<span style="flex:1;font-size:13px;color:#333;">' + p.label + '</span>';
    html += '</label>';
  }
  html += '</div>';

  // Modal
  const modal = document.createElement('div');
  modal.id = 'permModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:15px;overflow-y:auto;';
  modal.innerHTML =
    '<div style="background:#fff;border-radius:16px;padding:22px 18px;max-width:500px;width:100%;max-height:90vh;overflow-y:auto;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">' +
        '<h2 style="font-size:17px;color:#1e3c72;">🔑 صلاحيات: ' + escapeHtml(user.username) + '</h2>' +
        '<button onclick="closePermissions()" style="background:#ffebee;color:#c62828;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;">×</button>' +
      '</div>' +
      html +
      '<div style="display:flex;gap:8px;margin-top:18px;">' +
        '<button onclick="closePermissions()" style="flex:1;padding:12px;background:#e0e0e0;color:#333;border:none;border-radius:10px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;">إلغاء</button>' +
        '<button onclick="savePermissions(' + userId + ')" style="flex:2;padding:12px;background:linear-gradient(135deg,#11998e,#38ef7d);color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;">💾 حفظ الصلاحيات</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);
}

function applyPermPreset(presetKey) {
  const preset = PERM_PRESETS[presetKey];
  if (!preset) return;
  for (const key in PERM_LABELS) {
    const el = document.getElementById('perm_' + key);
    if (el) el.checked = !!preset.perms[key];
  }
}

function closePermissions() {
  const m = document.getElementById('permModal');
  if (m) m.remove();
}

async function savePermissions(userId) {
  try {
    const user = await get('users', userId);
    if (!user) { alert('المستخدم غير موجود'); return; }

    const perms = {};
    for (const key in PERM_LABELS) {
      const el = document.getElementById('perm_' + key);
      perms[key] = el ? el.checked : false;
    }

    user.permissions = perms;
    await put('users', user);

    closePermissions();
    alert('✅ تم حفظ الصلاحيات');
    await renderUsersList();
  } catch(e) {
    console.error(e);
    alert('خطأ: ' + e.message);
  }
}


// ===== حذف مستخدم =====
async function deleteUser(userId) {
  try {
    const user = await get('users', userId);
    if (!user) { alert('المستخدم غير موجود'); return; }
    if (user.role === 'owner') { alert('لا يمكن حذف المالك'); return; }

    if (!confirm('\uD83D\uDDD1\uFE0F هل تريد حذف المستخدم "' + user.username + '" نهائياً؟\n\nلا يمكن التراجع.')) return;

    await deleteItem('users', userId);

    if (typeof syncAfterDelete === 'function') {
      try { await syncAfterDelete('users', userId); } catch(e) { console.warn('sync delete failed:', e); }
    }

    alert('\uD83D\uDDD1\uFE0F تم حذف المستخدم');
    await renderUsersList();
  } catch(e) {
    console.error(e);
    alert('خطأ: ' + e.message);
  }
}

window.deleteUser = deleteUser;
