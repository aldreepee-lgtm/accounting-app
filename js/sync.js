// ===== محرّك المزامنة السحابية =====

let syncUser = null;        // مستخدم Firebase الحالي
let syncEnabled = false;    // هل المزامنة مُفعّلة؟
let syncInProgress = false; // منع التعارض

const SYNC_COLLECTIONS = ['users', 'settings', 'transactions', 'inventory', 'daily_closings'];

// ===== فحص حالة المزامنة =====
async function isSyncEnabled() {
  const s = await get('settings', 'syncEnabled');
  return s && s.value === true;
}

async function getSyncEmail() {
  const s = await get('settings', 'syncEmail');
  return s ? s.value : '';
}

// ===== تهيئة المزامنة عند فتح التطبيق =====
async function syncInit() {
  syncEnabled = await isSyncEnabled();
  if (!syncEnabled) return;
  if (!initFirebase()) return;

  // 1) اقرأ المستخدم مباشرة (أسرع)
  syncUser = firebaseAuth.currentUser;

  if (syncUser) {
    console.log('\u2705 مستخدم Firebase:', syncUser.email);
    try { await syncPullOnStart(); } catch(e) { console.warn('pull error:', e); }
    return syncUser;
  }

  // 2) في انتظار حالة Firebase مع timeout
  console.log('\u23F3 في انتظار حالة Firebase...');
  syncUser = await new Promise((resolve) => {
    let done = false;
    let unsub = null;
    try {
      unsub = firebaseAuth.onAuthStateChanged((u) => {
        if (done) return;
        done = true;
        try { if (unsub) unsub(); } catch(e) {}
        resolve(u);
      });
    } catch(e) { console.warn('onAuthStateChanged error:', e); }
    setTimeout(() => {
      if (done) return;
      done = true;
      try { if (unsub) unsub(); } catch(e) {}
      console.warn('\u26A0\uFE0F timeout انتظار Firebase');
      resolve(null);
    }, 5000);
  });

  if (syncUser) {
    console.log('\u2705 مستخدم Firebase:', syncUser.email);
    try { await syncPullOnStart(); } catch(e) { console.warn('pull error:', e); }
  }

  return syncUser;
}

// ===== تسجيل حساب جديد =====
async function syncRegister(email, password) {
  if (!initFirebase()) throw new Error('Firebase غير جاهز');
  
  const cred = await firebaseAuth.createUserWithEmailAndPassword(email, password);
  syncUser = cred.user;
  
  // حفظ الإعدادات
  await put('settings', { key: 'syncEnabled', value: true });
  await put('settings', { key: 'syncEmail', value: email });
  await put('settings', { key: 'syncUserId', value: cred.user.uid });
  
  syncEnabled = true;
  
  // رفع كل البيانات الحالية
  await syncUploadAll();
  
  return cred.user;
}

// ===== تسجيل دخول لمكتب موجود =====
async function syncLogin(email, password) {
  if (!initFirebase()) throw new Error('Firebase غير جاهز');
  
  const cred = await firebaseAuth.signInWithEmailAndPassword(email, password);
  syncUser = cred.user;
  
  await put('settings', { key: 'syncEnabled', value: true });
  await put('settings', { key: 'syncEmail', value: email });
  await put('settings', { key: 'syncUserId', value: cred.user.uid });
  
  syncEnabled = true;
  
  // تحميل البيانات من السحابة
  await syncDownloadAll();
  
  return cred.user;
}

// ===== تسجيل خروج من المزامنة =====
async function syncLogout() {
  if (firebaseAuth && syncUser) {
    await firebaseAuth.signOut();
  }
  syncUser = null;
  syncEnabled = false;
  
  await put('settings', { key: 'syncEnabled', value: false });
  await put('settings', { key: 'syncEmail', value: '' });
}

// ===== رفع مستند واحد =====
async function syncUploadDoc(collection, id, data) {
  if (!syncEnabled || !syncUser) return;
  try {
    const ref = firebaseDB
      .collection('offices').doc(syncUser.uid)
      .collection(collection).doc(String(id));
    await ref.set({
      data: data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log('☁️ رُفع:', collection, id);
  } catch (e) {
    console.error('❌ خطأ رفع:', e);
  }
}

// ===== حذف مستند =====
async function syncDeleteDoc(collection, id) {
  if (!syncEnabled || !syncUser) return;
  try {
    await firebaseDB
      .collection('offices').doc(syncUser.uid)
      .collection(collection).doc(String(id))
      .delete();
    console.log('🗑 حُذف من السحابة:', collection, id);
  } catch (e) {
    console.error('❌ خطأ حذف:', e);
  }
}

// ===== رفع كل البيانات (أول مزامنة) =====
async function syncUploadAll() {
  if (!syncUser) return;
  syncInProgress = true;
  
  try {
    for (const col of SYNC_COLLECTIONS) {
      const items = await getAll(col);
      for (const item of items) {
        const id = item.id || item.key || item.date;
        if (id) await syncUploadDoc(col, id, item);
      }
      console.log(`☁️ ${col}: ${items.length} مستند`);
    }
    console.log('✅ اكتمل رفع كل البيانات');
  } finally {
    syncInProgress = false;
  }
}

// ===== تحميل كل البيانات (من السحابة) =====
async function syncDownloadAll() {
  if (!syncUser) return;
  syncInProgress = true;
  
  try {
    for (const col of SYNC_COLLECTIONS) {
      const snapshot = await firebaseDB
        .collection('offices').doc(syncUser.uid)
        .collection(col).get();
      
      // مسح الجدول المحلي
      await clearStore(col);
      
      // إضافة البيانات واحداً واحداً (مع إزالة المكرر داخل السحابة)
      const seenKeys = {};
      for (const doc of snapshot.docs) {
        const item = doc.data().data;
        if (!item) continue;
        
        try {
          if (col === 'users' && item.username) {
            // تجاهل إذا رأينا هذا الاسم في نفس الدفعة
            if (seenKeys[item.username]) {
              console.warn('تخطي مكرر من السحابة:', item.username);
              continue;
            }
            seenKeys[item.username] = true;
            // احذف أي مستخدم محلي بنفس الاسم
            const existing = await getAll('users');
            const dup = existing.find(u => u.username === item.username);
            if (dup) await deleteItem('users', dup.id);
          }
          await put(col, item);
        } catch(err) {
          console.warn('تخطي مستند:', col, item.id || item.username, err.message);
        }
      }
      console.log('📥 ' + col + ': ' + snapshot.size + ' مستند');
    }
    console.log('✅ اكتمل تحميل كل البيانات');
  } finally {
    syncInProgress = false;
  }
}


// ===== عند فتح التطبيق: نزامن الأحدث =====
async function syncPullOnStart() {
  if (!syncEnabled || !syncUser || syncInProgress) return;
  syncInProgress = true;
  try {
    console.log('\u{1F504} فحص التحديثات من السحابة...');
    // ملاحظة: مجموعة users يُعالَجها pullUsersFromCloud في sync-users.js
    const dataCollections = ['settings', 'transactions', 'inventory', 'daily_closings'];
    for (const col of dataCollections) {
      const snapshot = await firebaseDB
        .collection('offices').doc(syncUser.uid)
        .collection(col).get();

      for (const doc of snapshot.docs) {
        const cloudItem = doc.data().data;
        if (!cloudItem) continue;
        const cloudTime = doc.data().updatedAt && doc.data().updatedAt.toMillis
          ? doc.data().updatedAt.toMillis() : 0;

        const key = cloudItem.id || cloudItem.key || cloudItem.date || doc.id;
        const localItem = await get(col, isNaN(key) ? key : Number(key));
        const localTime = localItem && localItem.updatedAt
          ? new Date(localItem.updatedAt).getTime() : 0;

        if (cloudTime > localTime) {
          const merged = localItem
            ? Object.assign({}, cloudItem, { id: localItem.id })
            : cloudItem;
          await put(col, merged);
          console.log('\u2B07\uFE0F حُدّث:', col, key);
        }
      }
    }
    console.log('\u2705 اكتمل التحديث');
  } catch (e) {
    console.error('\u274C خطأ تحديث:', e);
  } finally {
    syncInProgress = false;
  }
}

// ===== تأكيد جهوزية المزامنة (يُصلح المشكلة الجذرية) =====
async function ensureSyncReady() {
  if (typeof initFirebase !== 'function') return false;
  if (!initFirebase()) return false;

  // اقرأ syncEnabled من الإعدادات إن لم تكن مُهيأة
  if (!syncEnabled) {
    try {
      var s = await get('settings', 'syncEnabled');
      if (s && s.value === true) syncEnabled = true;
    } catch(e) {}
  }
  if (!syncEnabled) return false;

  // اقرأ syncUser من Firebase Auth
  if (!syncUser && typeof firebaseAuth !== 'undefined' && firebaseAuth && firebaseAuth.currentUser) {
    syncUser = firebaseAuth.currentUser;
  }
  if (!syncUser) return false;

  return true;
}

// ===== تُستدعى بعد كل حفظ =====
async function syncAfterSave(collection, item) {
  var ready = await ensureSyncReady();
  if (!ready) return;
  var id = item.id || item.key || item.date;
  if (id) await syncUploadDoc(collection, id, item);
}

// ===== تُستدعى بعد كل حذف =====
async function syncAfterDelete(collection, id) {
  var ready = await ensureSyncReady();
  if (!ready) return;
  await syncDeleteDoc(collection, id);
}

// ===== مسح جدول محلي =====
function clearStore(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
