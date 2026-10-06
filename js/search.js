// ===== منطق البحث الشامل =====

let allTx = [];
let filteredTx = [];

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  await loadData();
  await populateCustomers();
  applyFilters();
});

async function loadData() {
  allTx = await getAll('transactions');
  allTx.sort(function(a, b) {
    return (b.time || '').localeCompare(a.time || '');
  });
}

async function populateCustomers() {
  const sel = document.getElementById('customerFilter');
  if (!sel) return;

  const savedData = await get('settings', 'customersData');
  const customers = (savedData && savedData.value) ? savedData.value : {};

  allTx.forEach(function(t) {
    if (t.customerName && !customers[t.customerName]) {
      customers[t.customerName] = '';
    }
  });

  const names = Object.keys(customers).sort();

  let html = '<option value="">كل العملاء</option>';
  names.forEach(function(n) {
    html += '<option value="' + escS(n) + '">' + escS(n) + '</option>';
  });
  sel.innerHTML = html;
}

function applyFilters() {
  const text = (document.getElementById('searchText').value || '').trim().toLowerCase();
  const from = document.getElementById('dateFrom').value;
  const to = document.getElementById('dateTo').value;
  const type = document.getElementById('typeFilter').value;
  const customer = document.getElementById('customerFilter').value;

  filteredTx = allTx.filter(function(t) {
    if (type && t.type !== type) return false;
    if (from && t.date && t.date < from) return false;
    if (to && t.date && t.date > to) return false;
    if (customer && t.customerName !== customer) return false;

    if (text) {
      const hay = [
        t.description || '',
        t.productName || '',
        t.customerName || '',
        t.category || '',
        t.workerName || '',
        t.note || ''
      ].join(' ').toLowerCase();
      if (hay.indexOf(text) === -1) return false;
    }

    return true;
  });

  renderResults();
  updateStats();
}

function resetFilters() {
  document.getElementById('searchText').value = '';
  document.getElementById('dateFrom').value = '';
  document.getElementById('dateTo').value = '';
  document.getElementById('typeFilter').value = '';
  document.getElementById('customerFilter').value = '';
  applyFilters();
}

function updateStats() {
  let income = 0, expense = 0;
  filteredTx.forEach(function(t) {
    const a = parseInt(t.amount) || 0;
    if (t.type === 'income') income += a;
    else expense += a;
  });
  document.getElementById('statCount').textContent = filteredTx.length;
  document.getElementById('statIncome').textContent = income.toLocaleString('en-US');
  document.getElementById('statExpense').textContent = expense.toLocaleString('en-US');
}

function renderResults() {
  const box = document.getElementById('resultsList');

  if (filteredTx.length === 0) {
    box.innerHTML = '<div class="empty-msg">📭 لا توجد نتائج</div>';
    return;
  }

  const typeLabels = {
    income: '➕ إيراد', expense: '➖ مصروف', purchase: '🛒 مشترى',
    owner_withdraw: '💼 مسحوبات', owner_personal: '🏠 شخصي',
    worker_salary: '💵 راتب', payment: '💰 دفعة عميل'
  };

  box.innerHTML = filteredTx.map(function(t) {
    const amt = parseInt(t.amount) || 0;
    const isIncome = t.type === 'income' || t.type === 'payment';
    const sign = isIncome ? '+' : '−';
    const time = t.time ? new Date(t.time).toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' }) : '';
    const desc = t.description || t.productName || '—';

    let meta = '<span dir="ltr">' + (t.date || '') + '</span>';
    if (time) meta += ' · ' + time;
    if (t.customerName) meta += ' · 👤 ' + escS(t.customerName);

    return '<div class="tx-item ' + t.type + '">' +
      '<div class="tx-info">' +
        '<div class="tx-type">' + (typeLabels[t.type] || t.type) + '</div>' +
        '<div class="tx-desc">' + escS(desc) + '</div>' +
        '<div class="tx-meta">' + meta + '</div>' +
      '</div>' +
      '<div class="tx-amount">' + sign + amt.toLocaleString('en-US') + '</div>' +
      '<button class="del-btn" onclick="deleteFromSearch(' + t.id + ')">🗑</button>' +
    '</div>';
  }).join('');
}

async function deleteFromSearch(id) {
  if (!confirm('⚠️ سيتم حذف هذه الحركة\n\nهل أنت متأكد؟')) return;

  try {
    const tx = await get('transactions', id);
    if (!tx) { alert('الحركة غير موجودة'); return; }

    // عكس تأثير المخزون
    if (tx.type === 'purchase') {
      const products = await getAll('inventory');
      const product = products.find(function(p) { return p.name === tx.productName; });
      if (product) {
        product.quantity = (parseInt(product.quantity) || 0) - (parseInt(tx.quantity) || 0);
        if (product.quantity < 0) product.quantity = 0;
        await put('inventory', product);
      }
    } else if (tx.type === 'income' && tx.incomeType === 'product') {
      if (tx.items && tx.items.length > 0) {
        for (const item of tx.items) {
          const product = await get('inventory', item.productId);
          if (product) {
            product.quantity = (parseInt(product.quantity) || 0) + item.quantity;
            await put('inventory', product);
          }
        }
      } else if (tx.productId) {
        const product = await get('inventory', tx.productId);
        if (product) {
          product.quantity = (parseInt(product.quantity) || 0) + 1;
          await put('inventory', product);
        }
      }
    }

    // احذف الحركة
    await new Promise(function(resolve, reject) {
      const t = db.transaction('transactions', 'readwrite');
      const req = t.objectStore('transactions').delete(id);
      req.onsuccess = function() { resolve(); };
      req.onerror = function() { reject(req.error); };
    });

    allTx = allTx.filter(function(x) { return x.id !== id; });
    applyFilters();
  } catch(e) {
    console.error(e);
    alert('خطأ: ' + e.message);
  }
}

function escS(t) {
  const d = document.createElement('div');
  d.textContent = t || '';
  return d.innerHTML;
}
