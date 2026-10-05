// ===== قاعدة البيانات =====
const DB_NAME = 'OfficeAccountingDB';
const DB_VERSION = 1;
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const database = e.target.result;

      if (!database.objectStoreNames.contains('users')) {
        const users = database.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
        users.createIndex('username', 'username', { unique: true });
      }

      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }

      if (!database.objectStoreNames.contains('transactions')) {
        const tx = database.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
        tx.createIndex('date', 'date');
        tx.createIndex('type', 'type');
      }

      if (!database.objectStoreNames.contains('inventory')) {
        const inv = database.createObjectStore('inventory', { keyPath: 'id', autoIncrement: true });
        inv.createIndex('name', 'name', { unique: true });
      }

      if (!database.objectStoreNames.contains('daily_closings')) {
        database.createObjectStore('daily_closings', { keyPath: 'date' });
      }
    };

    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function seedDefaults() {
  const users = await getAll('users');
  if (users.length === 0) {
    await add('users', { username: 'admin', password: 'admin123', role: 'owner', mustChange: true, locked: false, createdAt: new Date().toISOString() });
    await add('users', { username: 'worker', password: 'worker123', role: 'worker', mustChange: true, locked: false, permissions: { addTx:true, deleteTx:false, viewInventory:true, editInventory:true, viewReports:false, viewProfit:false, viewWithdrawals:false, closeDay:false, backup:false, editSettings:false }, createdAt: new Date().toISOString() });
  }
  const setupDone = await get('settings', 'setupDone');
  if (!setupDone) {
    await put('settings', { key: 'setupDone', value: false });
  }
}

function add(store, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).add(data);
    req.onsuccess = async () => {
      const id = req.result;
      // مزامنة تلقائية
      if (typeof syncAfterSave === 'function') {
        try {
          const saved = { ...data, id };
          await syncAfterSave(store, saved);
        } catch(e) { console.warn('Sync add failed:', e); }
      }
      resolve(id);
    };
    req.onerror = () => reject(req.error);
  });
}

function put(store, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(data);
    req.onsuccess = async () => {
      const result = req.result;
      // مزامنة تلقائية
      if (typeof syncAfterSave === 'function') {
        try {
          const saved = { ...data, id: result };
          await syncAfterSave(store, saved);
        } catch(e) { console.warn('Sync put failed:', e); }
      }
      resolve(result);
    };
    req.onerror = () => reject(req.error);
  });
}

function get(store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAll(store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getByIndex(store, indexName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const idx = tx.objectStore(store).index(indexName);
    const req = idx.getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
