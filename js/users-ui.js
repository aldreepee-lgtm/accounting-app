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

  // 🔄 اسحب المستخدمين من السحابة أولاً
  if (typeof pullUsersFromCloud === 'function') {
    try {
      box.innerHTML = '<div style="text-align:center;padding:15px;color:#666;">⏳ جاري تحديث القائمة...</div>';
      await pullUsersFromCloud();
    } catch(e) { console.warn('pull users failed:', e); }
  }

  const users = await getAll('users');

  // زر تحديث يدوي
  let refreshBtnHtml = '<button onclick="renderUsersList()" style="width:100%;padding:10px;background:#e3f2fd;color:#1565c0;border:2px solid #90caf9;border-radius:10px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:12px;">🔄 تحديث القائمة (' + users.length + ' مستخدم)</button>';
  box.innerHTML = refreshBtnHtml;
  let html = refreshBtnHtml;
  users.sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1;
    if (b.role === 'owner' && a.role !== 'owner') return 1;
    return a.username.localeCompare(b.username);
  });


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
      var permBtn = '<button onclick="openPerms(' + u.id + ')" title="الصلاحيات" style="background:#e3f2fd;color:#1565c0;border:none;padding:8px 11px;border-radius:8px;font-size:14px;cursor:pointer;">📋</button>';
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

// ===== deleteUser v4 — يحذف بكل docId يطابق username =====
async function deleteUser(userId) {
  try {
    const user = await get('users', userId);
    if (!user) { alert('المستخدم غير موجود'); return; }
    if (user.role === 'owner') { alert('لا يمكن حذف المالك'); return; }

    if (!confirm('🗑️ حذف المستخدم "' + user.username + '" نهائياً؟')) return;

    let cloudDeleted = 0;
    let cloudError = '';

    try {
      if (typeof initFirebase === 'function') initFirebase();
      const fb = firebaseAuth && firebaseAuth.currentUser;
      if (!fb) {
        cloudError = 'لا يوجد اتصال سحابي على هذا الجهاز';
      } else {
        // 1) احذف بكل docId يطابق username في السحابة
        const snap = await firebaseDB.collection('offices').doc(fb.uid)
          .collection('users').get();
        for (const d of snap.docs) {
          const du = d.data().data;
          if (du && du.username === user.username) {
            await firebaseDB.collection('offices').doc(fb.uid)
              .collection('users').doc(d.id).delete();
            cloudDeleted++;
            console.log('OK: حُذف من السحابة docId=' + d.id);
          }
        }
        // 2) احذف أيضاً بالـ localId (احتياطاً)
        try {
          await firebaseDB.collection('offices').doc(fb.uid)
            .collection('users').doc(String(userId)).delete();
        } catch(e) {}
      }
    } catch(se) {
      cloudError = se.message || String(se);
      console.error('Firestore delete failed:', se);
    }

    // حذف محلي
    await deleteItem('users', userId);

    if (cloudDeleted > 0) {
      alert('🗑️ تم حذف "' + user.username + '" (' + cloudDeleted + ' نسخة من السحابة) ✅');
    } else if (cloudError) {
      alert('⚠️ حُذف محلياً فقط\n\n' + cloudError);
    } else {
      alert('⚠️ حُذف محلياً — لم يُعثر على المستخدم في السحابة');
    }

    await renderUsersList();
  } catch(e) {
    console.error(e);
    alert('خطأ: ' + e.message);
  }
}

window.deleteUser = deleteUser;
