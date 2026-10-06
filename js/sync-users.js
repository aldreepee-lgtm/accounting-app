
// ===== مزامنة المستخدمين من السحابة =====

async function syncUsersFromCloud() {
  try {
    const userJson = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (!userJson) return null;
    const currentUser = JSON.parse(userJson);
    const syncEnabled = await get('settings', 'syncEnabled');
    if (!syncEnabled || !syncEnabled.value) return null;
    if (typeof initFirebase !== 'function') return null;
    if (!initFirebase()) return null;

    return new Promise(function(resolve) {
      firebaseAuth.onAuthStateChanged(async function(user) {
        if (!user) { resolve(null); return; }
        try {
          const snapshot = await firebaseDB
            .collection('offices').doc(user.uid)
            .collection('users').get();
          if (snapshot.empty) { resolve(null); return; }

          for (const doc of snapshot.docs) {
            const cloudUser = doc.data().data;
            if (!cloudUser) continue;
            const localUsers = await getAll('users');
            const localUser = localUsers.find(function(u) { return u.id === cloudUser.id; });
            if (localUser) {
              const cloudTime = doc.data().updatedAt ? doc.data().updatedAt.toMillis() : 0;
              const localTime = localUser.updatedAt ? new Date(localUser.updatedAt).getTime() : 0;
              if (cloudTime > localTime) {
                await put('users', cloudUser);
              }
            }
          }

          const freshUsers = await getAll('users');
          const freshUser = freshUsers.find(function(u) { return u.id === currentUser.id; });
          resolve(freshUser || null);
        } catch(e) {
          console.error('sync-users error:', e);
          resolve(null);
        }
      });
    });
  } catch(e) {
    console.error(e);
    return null;
  }
}

async function checkUserLocked() {
  const userJson = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
  if (!userJson) return false;
  const currentUser = JSON.parse(userJson);
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
