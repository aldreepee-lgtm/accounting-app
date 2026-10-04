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
  
  return new Promise((resolve) => {
    firebaseAuth.onAuthStateChanged(async (user) => {
      syncUser = user;
      if (user) {
        console.log('✅ مستخدم Firebase:', user.email);
        // نزامن عند الفتح
        await syncPullOnStart();
      }
      resolve(user);
    });
  });
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
      
      // مسح الجدول المحلي أولاً
      await clearStore(col);
      
      // إضافة البيانات من السحابة
      snapshot.forEach(doc => {
        const item = doc.data().data;
        if (item) put(col, item);
      });
      
      console.log(`📥 ${col}: ${snapshot.size} مستند`);
    }
    console.log('✅ اكتمل تحميل كل البيانات');
  } finally {
    syncInProgress = false;
  }
}

// ===== عند فتح التطبيق: نزامن الأحدث =====
async function syncPullOnStart() {
  if (!syncEnabled || !syncUser || syncInProgress) return;
  
  try {
    console.log('🔄 فحص التحديثات من السحابة...');
    
    for (const col of SYNC_COLLECTIONS) {
      const snapshot = await firebaseDB
        .collection('offices').doc(syncUser.uid)
        .collection(col).get();
      
      snapshot.forEach(async (doc) => {
        const cloudItem = doc.data().data;
        const cloudTime = doc.data().updatedAt?.toMillis?.() || 0;
        
        const localItem = await get(col, isNaN(doc.id) ? doc.id : Number(doc.id));
        const localTime = localItem?.updatedAt 
          ? new Date(localItem.updatedAt).getTime() 
          : 0;
        
        // إذا السحابة أحدث، نُحدّث المحلي
        if (cloudTime > localTime) {
          await put(col, cloudItem);
          console.log('⬇️ حُدّث:', col, doc.id);
        }
      });
    }
    
    console.log('✅ اكتمل التحديث');
  } catch (e) {
    console.error('❌ خطأ تحديث:', e);
  }
}

// ===== تُستدعى بعد كل حفظ =====
async function syncAfterSave(collection, item) {
  if (!syncEnabled || !syncUser) return;
  const id = item.id || item.key || item.date;
  if (id) await syncUploadDoc(collection, id, item);
}

// ===== تُستدعى بعد كل حذف =====
async function syncAfterDelete(collection, id) {
  if (!syncEnabled || !syncUser) return;
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
