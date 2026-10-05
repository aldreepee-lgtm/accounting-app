// ===== النسخ الاحتياطي التلقائي =====

const BACKUP_KEY = 'auto_backups';
const MAX_BACKUPS = 7;

async function autoBackupCheck() {
  try {
    const last = await get('settings', 'lastAutoBackup');
    const today = new Date().toISOString().slice(0, 10);
    
    // إذا أخذنا نسخة اليوم، لا نكرّر
    if (last && last.value === today) {
      console.log('✅ نسخة اليوم موجودة');
      return;
    }
    
    // نأخذ نسخة جديدة
    await createAutoBackup();
    
    // نحفظ التاريخ
    await put('settings', { key: 'lastAutoBackup', value: today });
    console.log('✅ تم إنشاء نسخة احتياطية تلقائية');
  } catch(e) {
    console.warn('auto backup error:', e);
  }
}

async function createAutoBackup() {
  const data = {
    date: new Date().toISOString(),
    settings: await getAll('settings'),
    users: await getAll('users'),
    transactions: await getAll('transactions'),
    inventory: await getAll('inventory'),
    daily_closings: await getAll('daily_closings')
  };
  
  // احصل على النسخ السابقة
  let existing = await get('settings', BACKUP_KEY);
  let backups = (existing && existing.value) ? existing.value : [];
  
  // أضف الجديدة
  backups.unshift(data);
  
  // احتفظ بـ 7 فقط
  backups = backups.slice(0, MAX_BACKUPS);
  
  await put('settings', { key: BACKUP_KEY, value: backups });
}

// تنبيه أسبوعي
async function weeklyReminder() {
  const lastExport = await get('settings', 'lastManualExport');
  if (!lastExport) {
    console.log('لا يوجد تصدير يدوي بعد');
    return;
  }
  const days = Math.floor((Date.now() - new Date(lastExport.value).getTime()) / (1000 * 60 * 60 * 24));
  if (days >= 7) {
    setTimeout(() => {
      if (confirm('⚠️ مر ' + days + ' يوماً دون نسخة احتياطية خارجية.\n\nهل تريد تصدير نسخة الآن؟')) {
        if (typeof doBackup === 'function') doBackup();
      }
    }, 5000);
  }
}

// استدعاء عند فتح التطبيق
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
    await autoBackupCheck();
    await weeklyReminder();
  } catch(e) {}
});

async function exportAutoBackup() {
  const existing = await get('settings', BACKUP_KEY);
  const backups = (existing && existing.value) ? existing.value : [];
  if (backups.length === 0) {
    alert('لا توجد نسخ تلقائية');
    return;
  }
  const latest = backups[0];
  const json = JSON.stringify(latest, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'نسخة-تلقائية-' + latest.date.slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}
