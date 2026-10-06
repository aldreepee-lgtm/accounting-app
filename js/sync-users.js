// ===== مزامنة المستخدمين من السحابة (نسخة مُصلَحة - v2) =====
// إصلاحات:
// 1. إزالة onAuthStateChanged المعلق
// 2. إضافة المستخدمين الجدد من السحابة
// 3. تحديث القفل والصلاحيات دائماً
// 4. منع المزامنة العكسية أثناء السحب

function getFirebaseUser() {
  if (typeof firebaseAuth === 'undefined' || !firebaseAuth) return null;
  return firebaseAuth.currentUser;
}

async function pullUsersFromCloud() {
  try {
    if (typeof initFirebase !== 'function') return false;
    if (!initFirebase()) return false;
    const fbUser = getFirebaseUser();
    if (!fbUser) return false;
    const wasInProgress = (typeof syncInProgress !== 'undefined') ? syncInProgress : false;
    if (typeof syncInProgress !== 'undefined') syncInProgress = true;
    try {
      const snapshot = await firebaseDB
        .collection('offices').doc(fbUser.uid)
        .collection('users').get();
      if (snapshot.empty) return false;
      const localUsers = await getAll('users');
      for (const doc of snapshot.docs) {
        const cloudUser = doc.data().data;
        if (!cloudUser) continue;
        const localMatch = localUsers.find(function(u) { return u.username === cloudUser.username; });
        if (localMatch) {
          const cloudTime = doc.data().updatedAt && doc.data().updatedAt.toMillis
            ? doc.data().updatedAt.toMillis() : 0;
          const localTime = localMatch.updatedAt
            ? new Date(localMatch.updatedAt).getTime() : 0;
          const permsChanged =
            JSON.stringify(localMatch.permissions || null) !==
            JSON.stringify(cloudUser.permissions || null);
          const lockChanged = localMatch.locked !== cloudUser.locked;
          const mustChangeChanged = localMatch.mustChange !== cloudUser.mustChange;
          if (cloudTime > localTime || permsChanged || lockChanged || mustChangeChanged) {
            const merged = Object.assign({}, cloudUser, { id: localMatch.id });
            await put('users', merged);
            console.log('⬇️ حدّث المستخدم:', cloudUser.username);
          }
        } else {
          const newUser = Object.assign({}, cloudUser);
          delete newUser.id;
          await add('users', newUser);
          console.log('➕ أضاف مستخدم جديد:', cloudUser.username);
        }
      }
      return true;
    } finally {
      if (typeof syncInProgress !== 'undefined') syncInProgress = wasInProgress;
    }
  } catch (e) {
    console.error('pullUsersFromCloud error:', e);
    return false;
  }
}

async function syncUsersFromCloud() {
  const userJson = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
  if (!userJson) return null;
  let currentUser;
  try { currentUser = JSON.parse(userJson); } catch(e) { return null; }
  await pullUsersFromCloud();
  const freshUsers = await getAll('users');
  return freshUsers.find(function(u) { return u.username === currentUser.username; }) || null;
}

async function checkUserLocked() {
  const userJson = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
  if (!userJson) return false;
  let currentUser;
  try { currentUser = JSON.parse(userJson); } catch(e) { return false; }
  if (currentUser.role === 'owner') return false;
  const localUser = await get('users', currentUser.id);
  if (localUser && localUser.locked === true) return true;
  const cloudUser = await syncUsersFromCloud();
  if (cloudUser) {
    localStorage.setItem('currentUser', JSON.stringify(cloudUser));
    if (cloudUser.locked === true) return true;
  }
  return false;
}
