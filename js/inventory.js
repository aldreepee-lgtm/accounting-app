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
    const unitsList = (p.units && p.units.length) ? p.units.map(function(u) { return u.name + '=' + u.factor; }).join(' · ') : '';
    const unitsBadge = unitsList ? '<div style="font-size:10px;color:#6a1b9a;margin-top:3px;">📐 ' + unitsList + '</div>' : '';
    div.innerHTML = `
      <div class="info">
        <div class="name">${categoryBadge}${escapeHtml(p.name)}</div>
        <div class="meta">${priceLine}</div>
        ${unitsBadge}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:center;"><div class="qty ${qtyClass}">${qty}</div><button onclick="openStocktake(${p.id})" style="background:#e3f2fd;color:#1565c0;border:none;padding:5px 10px;border-radius:6px;font-family:inherit;font-size:10px;font-weight:700;cursor:pointer;">📊 جرد</button></div>
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

// ===== الجرد الفعلي =====
let currentStocktakeProduct = null;

async function openStocktake(productId) {
  const p = await get('inventory', productId);
  if (!p) { alert('المنتج غير موجود'); return; }
  currentStocktakeProduct = p;

  const q = parseInt(p.quantity) || 0;
  const u = p.baseUnit || 'قطعة';

  document.getElementById('stocktakeInfo').innerHTML =
    '<div>📦 <b>' + escapeHtml(p.name) + '</b></div>' +
    '<div>الكمية في النظام: <b style="color:#1565c0;">' + q + ' ' + u + '</b></div>';

  document.getElementById('stocktakeQty').value = q;
  document.getElementById('stocktakeReason').value = '';
  document.getElementById('stocktakeAlert').value = p.alertThreshold || '';
  document.getElementById('stocktakeMsg').textContent = '';
  document.getElementById('stocktakeModal').style.display = 'flex';
}

function closeStocktake() {
  document.getElementById('stocktakeModal').style.display = 'none';
  currentStocktakeProduct = null;
}

async function saveStocktake() {
  const msg = document.getElementById('stocktakeMsg');
  if (!currentStocktakeProduct) return;

  const newQty = parseInt(document.getElementById('stocktakeQty').value);
  const alertVal = document.getElementById('stocktakeAlert').value.trim();
  const reason = document.getElementById('stocktakeReason').value.trim() || 'جرد فعلي';

  if (isNaN(newQty) || newQty < 0) {
    msg.style.color = '#c62828';
    msg.textContent = 'أدخل كمية صحيحة';
    return;
  }

  const oldQty = parseInt(currentStocktakeProduct.quantity) || 0;
  const diff = newQty - oldQty;
  const oldAlert = parseInt(currentStocktakeProduct.alertThreshold) || 0;
  const newAlert = alertVal !== '' ? (parseInt(alertVal) || 0) : 0;
  const alertChanged = oldAlert !== newAlert;

  // إذا لم يتغير شيء
  if (diff === 0 && !alertChanged) {
    msg.style.color = '#2a5298';
    msg.textContent = 'لا يوجد تغيير';
    return;
  }

  try {
    // 1) حدّث كمية المنتج وحد التنبيه
    currentStocktakeProduct.quantity = newQty;
    currentStocktakeProduct.alertThreshold = newAlert;
    currentStocktakeProduct.lastStocktake = new Date().toISOString();
    currentStocktakeProduct.updatedAt = new Date().toISOString();
    await put('inventory', currentStocktakeProduct);

    // إذا لا يوجد فرق في الكمية، لا نسجّل حركة — فقط تحديث التنبيه
    if (diff === 0) {
      msg.style.color = '#2e7d32';
      msg.textContent = '✅ تم تحديث حد التنبيه';
      setTimeout(async () => {
        closeStocktake();
        await loadInventory();
      }, 1000);
      return;
    }

    // 2) سجّل حركة الجرد
    const today = new Date();
    const dateStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');

    const tx = {
      type: 'stocktake',
      amount: 0,
      date: dateStr,
      time: today.toISOString(),
      productId: currentStocktakeProduct.id,
      productName: currentStocktakeProduct.name,
      oldQty: oldQty,
      newQty: newQty,
      diff: diff,
      reason: reason,
      description: 'جرد: ' + currentStocktakeProduct.name + ' (' + oldQty + ' → ' + newQty + ')',
      username: 'system',
      role: 'system'
    };
    await add('transactions', tx);

    msg.style.color = '#2e7d32';
    msg.textContent = '✅ تم الحفظ! الفرق: ' + (diff > 0 ? '+' : '') + diff;

    setTimeout(async () => {
      closeStocktake();
      await loadInventory();
    }, 1200);

  } catch(e) {
    console.error(e);
    msg.style.color = '#c62828';
    msg.textContent = 'خطأ: ' + e.message;
  }
}
