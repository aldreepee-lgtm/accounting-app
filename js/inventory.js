// ===== منطق صفحة المخزون =====

let allProducts = [];
let currentCategoryFilter = '';

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

  renderCategoryFilters();
  renderProducts('');
}

function renderProducts(filter) {
  const list = document.getElementById('invList');
  let filtered = filter
    ? allProducts.filter(p => p.name.toLowerCase().includes(filter))
    : allProducts.slice();
  if (currentCategoryFilter === '_none') {
  } else if (currentCategoryFilter) {
    filtered = filtered.filter(p => p.category === currentCategoryFilter);
  }

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
    const sellPrice = parseInt(p.sellPrice) || 0;
    const value = qty * price;
    const margin = sellPrice > 0 ? sellPrice - price : 0;

    let qtyClass = '';
    if (qty === 0) qtyClass = 'out';
    else if (qty <= 3) qtyClass = 'low';

    let priceLine = 'آخر شراء: ' + price.toLocaleString('en-US');
    if (sellPrice > 0) {
      priceLine += ' — بيع: ' + sellPrice.toLocaleString('en-US');
      if (margin > 0) priceLine += ' — ربح: ' + margin.toLocaleString('en-US');
      else if (margin < 0) priceLine += ' — خسارة: ' + Math.abs(margin).toLocaleString('en-US');
    }
    priceLine += ' — القيمة: ' + value.toLocaleString('en-US') + ' ر.ي';

    const div = document.createElement('div');
    div.className = 'inv-item';
    const categoryBadge = p.category ? '<span style="background:#e3f2fd;color:#1565c0;font-size:10px;padding:2px 8px;border-radius:10px;margin-right:6px;">' + escapeHtml(p.category) + '</span>' : '';
    div.innerHTML = `
      <div class="info">
        <div class="name">${categoryBadge}${escapeHtml(p.name)}</div>
        <div class="meta">${priceLine}</div>
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

function renderCategoryFilters() {
  const container = document.getElementById('categoryFilter');
  if (!container) return;
  const cats = new Set();
  allProducts.forEach(function(p) { if (p.category) cats.add(p.category); });
  const catsArr = Array.from(cats).sort();
  let html = '<button onclick="setCategoryFilter(\'\')" style="flex-shrink:0;padding:8px 14px;border-radius:20px;border:2px solid ' + (currentCategoryFilter === '' ? '#2a5298' : '#e0e0e0') + ';background:' + (currentCategoryFilter === '' ? '#2a5298' : '#fff') + ';color:' + (currentCategoryFilter === '' ? '#fff' : '#555') + ';font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">الكل (' + allProducts.length + ')</button>';
  catsArr.forEach(function(cat) {
    const count = allProducts.filter(function(p) { return p.category === cat; }).length;
    const isActive = currentCategoryFilter === cat;
    html += '<button onclick="setCategoryFilter(\'' + cat.replace(/'/g, "\\\\'") + '\')" style="flex-shrink:0;padding:8px 14px;border-radius:20px;border:2px solid ' + (isActive ? '#2a5298' : '#e0e0e0') + ';background:' + (isActive ? '#2a5298' : '#fff') + ';color:' + (isActive ? '#fff' : '#555') + ';font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">' + escapeHtml(cat) + ' (' + count + ')</button>';
  });
  const noCat = allProducts.filter(function(p) { return !p.category; }).length;
  if (noCat > 0) {
    const isActive = currentCategoryFilter === '_none';
    html += '<button onclick="setCategoryFilter(\'_none\')" style="flex-shrink:0;padding:8px 14px;border-radius:20px;border:2px solid ' + (isActive ? '#2a5298' : '#e0e0e0') + ';background:' + (isActive ? '#2a5298' : '#fff') + ';color:' + (isActive ? '#fff' : '#555') + ';font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">بدون تصنيف (' + noCat + ')</button>';
  }
  container.innerHTML = html;
}

function setCategoryFilter(cat) {
  currentCategoryFilter = cat;
  const si = document.getElementById('searchInput');
  const sv = si ? si.value.trim().toLowerCase() : '';
  renderProducts(sv);
  renderCategoryFilters();
}
