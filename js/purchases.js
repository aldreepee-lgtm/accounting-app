// ===== منطق سجل المشتريات =====

let allPurchases = [];

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  await loadPurchases();

  document.getElementById('searchInput').addEventListener('input', applyFilter);
  document.getElementById('dateFrom').addEventListener('change', applyFilter);
  document.getElementById('dateTo').addEventListener('change', applyFilter);
});

async function loadPurchases() {
  const all = await getAll('transactions');
  allPurchases = all.filter(t => t.type === 'purchase');
  allPurchases.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  applyFilter();
}

function applyFilter() {
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const from = document.getElementById('dateFrom').value;
  const to = document.getElementById('dateTo').value;

  let filtered = allPurchases.slice();

  if (search) {
    filtered = filtered.filter(p => {
      const name = (p.productName || '').toLowerCase();
      const note = (p.note || '').toLowerCase();
      return name.includes(search) || note.includes(search);
    });
  }
  if (from) filtered = filtered.filter(p => p.date >= from);
  if (to) filtered = filtered.filter(p => p.date <= to);

  renderPurchases(filtered);
  updateStats(filtered);
}

function updateStats(list) {
  let total = 0;
  list.forEach(p => { total += parseInt(p.amount) || 0; });
  document.getElementById('statCount').textContent = list.length;
  document.getElementById('statTotal').textContent = total.toLocaleString('en-US');
}

function resetFilter() {
  document.getElementById('searchInput').value = '';
  document.getElementById('dateFrom').value = '';
  document.getElementById('dateTo').value = '';
  applyFilter();
}

function renderPurchases(list) {
  const box = document.getElementById('purchasesList');

  if (list.length === 0) {
    box.innerHTML = '<div class="empty-msg">📭 لا توجد مشتريات' + (allPurchases.length > 0 ? ' مطابقة للفلتر' : ' بعد') + '</div>';
    return;
  }

  box.innerHTML = list.map(function(p) {
    const amount = parseInt(p.amount) || 0;
    const qty = parseInt(p.quantity) || 0;
    const price = parseInt(p.unitPrice) || 0;
    const unit = p.displayUnit || p.baseUnit || 'قطعة';
    const supplier = p.note || 'غير محدد';
    const time = p.time ? new Date(p.time).toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' }) : '';

    return '<div class="purchase-item">' +
      '<div class="info">' +
        '<div class="name">🛒 ' + esc( p.productName || '—') + '</div>' +
        '<div class="meta">' +
          '📅 ' + (p.date || '') + (time ? ' — 🕐 ' + time : '') + '<br>' +
          '📦 الكمية: <b>' + qty + ' ' + esc(unit) + '</b> × ' + price + ' ر.ي<br>' +
          '🏢 المورد: <b>' + esc(supplier) + '</b>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;align-items:center;">' +
        '<div class="amount">' + amount.toLocaleString('en-US') + '</div>' +
        '<button class="del-btn" onclick="deletePurchase(' + p.id + ')">🗑</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function deletePurchase(id) {
  if (!confirm('⚠️ سيتم حذف هذه المشتريات\nوتقليل الكمية من المخزون\n\nهل أنت متأكد؟')) return;

  try {
    const tx = await get('transactions', id);
    if (!tx) { alert('غير موجود'); return; }

    // 1) قلّل المخزون
    const products = await getAll('inventory');
    const product = products.find(p => p.name === tx.productName);
    if (product) {
      product.quantity = (parseInt(product.quantity) || 0) - (parseInt(tx.quantity) || 0);
      if (product.quantity < 0) product.quantity = 0;
      product.updatedAt = new Date().toISOString();
      await put('inventory', product);
    }

    // 2) احذف الحركة
    await new Promise(function(resolve, reject) {
      const t = db.transaction('transactions', 'readwrite');
      const req = t.objectStore('transactions').delete(id);
      req.onsuccess = function() { resolve(); };
      req.onerror = function() { reject(req.error); };
    });

    // 3) حدّث القائمة
    allPurchases = allPurchases.filter(p => p.id !== id);
    applyFilter();

  } catch(e) {
    console.error(e);
    alert('خطأ: ' + e.message);
  }
}

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t || '';
  return d.innerHTML;
}

function renderPurchases(list) {
  const box = document.getElementById('purchasesList');

  if (list.length === 0) {
    box.innerHTML = '<div class="empty-msg">📭 لا توجد مشتريات' + (allPurchases.length > 0 ? ' مطابقة للفلتر' : ' بعد') + '</div>';
    return;
  }

  box.innerHTML = list.map(function(p) {
    const amount = parseInt(p.amount) || 0;
    const qty = parseInt(p.quantity) || 0;
    const price = parseInt(p.unitPrice) || 0;
    const unit = p.displayUnit || p.baseUnit || 'قطعة';
    const supplier = p.note || 'غير محدد';
    const time = p.time ? new Date(p.time).toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' }) : '';

    return '<div class="purchase-item">' +
      '<div class="info">' +
        '<div class="name">🛒 ' + esc( p.productName || '—') + '</div>' +
        '<div class="meta">' +
          '📅 ' + (p.date || '') + (time ? ' — 🕐 ' + time : '') + '<br>' +
          '📦 الكمية: <b>' + qty + ' ' + esc(unit) + '</b> × ' + price + ' ر.ي<br>' +
          '🏢 المورد: <b>' + esc(supplier) + '</b>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;align-items:center;">' +
        '<div class="amount">' + amount.toLocaleString('en-US') + '</div>' +
        '<button class="del-btn" onclick="deletePurchase(' + p.id + ')">🗑</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function deletePurchase(id) {
  if (!confirm('⚠️ سيتم حذف هذه المشتريات\nوتقليل الكمية من المخزون\n\nهل أنت متأكد؟')) return;

  try {
    const tx = await get('transactions', id);
    if (!tx) { alert('غير موجود'); return; }

    // 1) قلّل المخزون
    const products = await getAll('inventory');
    const product = products.find(p => p.name === tx.productName);
    if (product) {
      product.quantity = (parseInt(product.quantity) || 0) - (parseInt(tx.quantity) || 0);
      if (product.quantity < 0) product.quantity = 0;
      product.updatedAt = new Date().toISOString();
      await put('inventory', product);
    }

    // 2) احذف الحركة
    await new Promise(function(resolve, reject) {
      const t = db.transaction('transactions', 'readwrite');
      const req = t.objectStore('transactions').delete(id);
      req.onsuccess = function() { resolve(); };
      req.onerror = function() { reject(req.error); };
    });

    // 3) حدّث القائمة
    allPurchases = allPurchases.filter(p => p.id !== id);
    applyFilter();

  } catch(e) {
    console.error(e);
    alert('خطأ: ' + e.message);
  }
}

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t || '';
  return d.innerHTML;
}

// ===== تصدير المشتريات =====
function exportPurchases() {
  if (!allPurchases || allPurchases.length === 0) {
    alert('لا توجد مشتريات للتصدير');
    return;
  }

  const data = allPurchases.map(function(p) {
    return {
      date: p.date || '',
      type: 'مشترى',
      description: p.productName + ' × ' + p.quantity + ' ' + (p.displayUnit || ''),
      customerName: p.note || '',
      amount: p.amount
    };
  });

  if (typeof showExportMenu === 'function') {
    showExportMenu(data, 'سجل المشتريات');
  } else {
    alert('نظام التصدير غير محمّل');
  }
}
