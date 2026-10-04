// ===== منطق صفحة المخزون =====

let allProducts = [];

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();

  const userJson = localStorage.getItem('currentUser');
  if (!userJson) { window.location.href = 'index.html'; return; }

  await loadInventory();

  document.getElementById('searchInput').addEventListener('input', (e) => {
    renderProducts(e.target.value.trim().toLowerCase());
  });
});

async function loadInventory() {
  allProducts = await getAll('inventory');
  allProducts.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  // الإحصائيات
  const kinds = allProducts.length;
  const totalQty = allProducts.reduce((s, p) => s + (parseInt(p.quantity) || 0), 0);
  const totalValue = allProducts.reduce((s, p) => {
    const q = parseInt(p.quantity) || 0;
    const price = parseInt(p.lastPurchasePrice) || 0;
    return s + (q * price);
  }, 0);

  document.getElementById('statKinds').textContent = kinds;
  document.getElementById('statTotalQty').textContent = totalQty.toLocaleString('en-US');
  document.getElementById('statValue').textContent = totalValue.toLocaleString('en-US');

  renderProducts('');
}

function renderProducts(filter) {
  const list = document.getElementById('invList');
  const filtered = filter
    ? allProducts.filter(p => p.name.toLowerCase().includes(filter))
    : allProducts;

  if (filtered.length === 0) {
    if (allProducts.length === 0) {
      list.innerHTML = `<div class="empty-msg">
        📭 لا توجد منتجات في المخزون بعد<br><br>
        <span style="color:#888;font-size:13px;">أضف منتجات عن طريق تسجيل "مشتريات" من لوحة التحكم</span>
      </div>`;
    } else {
      list.innerHTML = `<div class="empty-msg">🔍 لا توجد نتائج مطابقة للبحث</div>`;
    }
    return;
  }

  list.innerHTML = '';
  filtered.forEach(p => {
    const qty = parseInt(p.quantity) || 0;
    const price = parseInt(p.lastPurchasePrice) || 0;
    const value = qty * price;

    let qtyClass = '';
    if (qty === 0) qtyClass = 'out';
    else if (qty <= 3) qtyClass = 'low';

    const div = document.createElement('div');
    div.className = 'inv-item';
    div.innerHTML = `
      <div class="info">
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="meta">آخر سعر شراء: ${price.toLocaleString('en-US')} ر.ي — القيمة: ${value.toLocaleString('en-US')} ر.ي</div>
      </div>
      <div class="qty ${qtyClass}">${qty}</div>
    `;
    list.appendChild(div);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
