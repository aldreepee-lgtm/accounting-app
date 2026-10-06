// ===== منطق إضافة الحركة =====

let currentUser = null;
let currentType = 'income';
let todayStr = '';

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();

  const userJson = localStorage.getItem('currentUser');
  if (!userJson) { window.location.href = 'index.html'; return; }
  currentUser = JSON.parse(userJson);
  if (currentUser.role === 'owner') document.body.classList.add('is-owner');

  todayStr = getTodayStr();
  document.getElementById('todayDate').textContent = todayStr;

  // التبويبات
  document.querySelectorAll('#typeTabs .tab').forEach(tab => {
    tab.addEventListener('click', () => switchType(tab.dataset.type));
  });

  // عرض بنود الفاتورة عند اختيار بيع منتج
  const incomeTypeEl = document.getElementById('incomeType');
  incomeTypeEl.addEventListener('change', async (e) => {
    await toggleProductItemsArea(e.target.value);
  });
  // تطبيق مباشر على القيمة الحالية
  await toggleProductItemsArea(incomeTypeEl.value);

  // حساب المبلغ الإجمالي في المشتريات
  document.getElementById('quantity').addEventListener('input', autoPurchaseAmount);
  document.getElementById('unitPrice').addEventListener('input', autoPurchaseAmount);

  document.getElementById('txForm').addEventListener('submit', handleSave);

  // قراءة نوع الحركة من الرابط
  const urlParams = new URLSearchParams(window.location.search);
  const initialType = urlParams.get('type');
  if (initialType) switchType(initialType);

  await refreshView();
});

function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function switchType(type) {
  currentType = type;
  document.querySelectorAll('#typeTabs .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.type === type);
  });
  document.querySelectorAll('.type-fields').forEach(f => {
    f.classList.toggle('active', f.dataset.for === type);
  });
  document.getElementById('formMsg').textContent = '';
  document.getElementById('formMsg').className = 'msg-box';
}

function autoPurchaseAmount() {
  const q = parseInt(document.getElementById('quantity').value) || 0;
  const p = parseInt(document.getElementById('unitPrice').value) || 0;
  if (q > 0 && p > 0) {
    document.getElementById('amount').value = q * p;
  }
}

  });
}

async function handleSave(e) {
  e.preventDefault();
  alert('DEBUG: handleSave called');
  const msg = document.getElementById('formMsg');
  if (!msg) { alert('DEBUG: formMsg missing!'); return; }
  msg.textContent = ''; msg.className = 'msg-box';
  alert('DEBUG: currentUser = ' + (currentUser ? currentUser.username : 'NULL'));

  const amount = parseInt(document.getElementById('amount').value) || 0;
  if (amount <= 0 && currentType !== 'purchase') {
    msg.textContent = 'المبلغ يجب أن يكون أكبر من صفر';
    msg.className = 'msg-box err';
    return;
  }

  const now = new Date();
  const tx = {
    type: currentType,
    amount: amount,
    date: todayStr,
    time: now.toISOString(),
    userId: currentUser.id,
    username: currentUser.username,
    role: currentUser.role
  };

  try {
    if (currentType === 'income') {
      const incomeType = document.getElementById('incomeType').value;
      tx.incomeType = incomeType;
      if (incomeType === 'product') {
        // قراءة البنود
        const rows = document.querySelectorAll('.sale-item');
        const items = [];
        let totalAmount = 0;
        for (const row of rows) {
          const sel = row.querySelector('.si-product');
          const prodId = parseInt(sel.value);
          const qty = parseInt(row.querySelector('.si-qty').value) || 0;
          const price = parseInt(row.querySelector('.si-price').value) || 0;
          if (!prodId) { msg.textContent = 'اختر منتجاً في كل بند'; msg.className = 'msg-box err'; return; }
          if (qty < 1) { msg.textContent = 'الكمية مطلوبة'; msg.className = 'msg-box err'; return; }
          if (price < 1) { msg.textContent = 'السعر مطلوب'; msg.className = 'msg-box err'; return; }
          const product = await get('inventory', prodId);
          if (!product) { msg.textContent = 'المنتج غير موجود'; msg.className = 'msg-box err'; return; }
          const lineTotal = qty * price;
          items.push({
            productId: prodId,
            productName: product.name,
            quantity: qty,
            unitPrice: price,
            purchasePrice: parseInt(product.lastPurchasePrice) || 0,
            lineTotal: lineTotal
          });
          totalAmount += lineTotal;
        }
        if (items.length === 0) { msg.textContent = 'أضف بنداً واحداً على الأقل'; msg.className = 'msg-box err'; return; }
        tx.items = items;
        tx.amount = totalAmount;
        tx.itemCount = items.length;
        const desc = document.getElementById('incomeDesc').value.trim();
        tx.description = desc || ('فاتورة بيع (' + items.length + ' بنود)');
        // حساب الربح الإجمالي
        let profitTotal = 0;
        items.forEach(it => { profitTotal += (it.unitPrice - it.purchasePrice) * it.quantity; });
        tx.profit = profitTotal;
      } else {
        tx.description = document.getElementById('incomeDesc').value.trim() || 'إيراد';
      }
    } else if (currentType === 'expense') {
      tx.category = document.getElementById('expenseCategory').value;
      tx.description = tx.category + (document.getElementById('expenseNote').value.trim() ? ' - ' + document.getElementById('expenseNote').value.trim() : '');
    } else if (currentType === 'purchase') {
      const pname = document.getElementById('productName').value.trim();
      const qty = parseInt(document.getElementById('quantity').value) || 0;
      const unitPrice = parseInt(document.getElementById('unitPrice').value) || 0;
      if (!pname || qty < 1 || unitPrice < 1) { msg.textContent = 'أكمل بيانات المنتج'; msg.className = 'msg-box err'; return; }
      const sellPrice = parseInt(document.getElementById('sellPrice').value) || 0;
      const category = document.getElementById('productCategory').value.trim();
      const units = typeof getCurrentUnits === 'function' ? getCurrentUnits() : { base: 'قطعة', units: [] };
      const purchaseUnitFactor = parseInt(document.getElementById('purchaseUnit').value) || 1;
      const purchaseUnitName = document.getElementById('purchaseUnit').options[document.getElementById('purchaseUnit').selectedIndex].textContent.split(' (')[0];
      tx.productName = pname;
      tx.quantity = qty * purchaseUnitFactor;
      tx.displayQty = qty;
      tx.displayUnit = purchaseUnitName;
      tx.unitPrice = Math.round(unitPrice / purchaseUnitFactor);
      tx.purchasePriceTotal = unitPrice;
      tx.sellPrice = sellPrice;
      tx.productCategory = category || '';
      tx.baseUnit = units.base;
      tx.units = units.units;
      tx.amount = qty * unitPrice;
      tx.description = `${pname} × ${qty}`;
      tx.note = document.getElementById('purchaseNote').value.trim();
    } else if (currentType === 'owner_withdraw') {
      tx.description = document.getElementById('withdrawReason').value.trim() || 'مسحوبات';
    } else if (currentType === 'worker_salary') {
      const workerName = document.getElementById('salaryWorker').value.trim();
      const salaryMonth = document.getElementById('salaryMonth').value;
      const salaryNote = document.getElementById('salaryNote').value.trim();
      tx.workerName = workerName;
      tx.salaryMonth = salaryMonth || todayStr.slice(0, 7);
      tx.description = 'راتب: ' + workerName + ' (' + tx.salaryMonth + ')' + (salaryNote ? ' - ' + salaryNote : '');
    } else if (currentType === 'owner_personal') {
      tx.category = document.getElementById('personalCategory').value;
      tx.description = tx.category + (document.getElementById('personalNote').value.trim() ? ' - ' + document.getElementById('personalNote').value.trim() : '');
    }

    // حفظ الحركة
    const txId = await add('transactions', tx);

    // تحديث المخزون
    if (currentType === 'purchase') {
      await updateInventoryOnPurchase(tx);
    } else if (currentType === 'income' && tx.incomeType === 'product') {
      await updateInventoryOnSale(tx);
    }

    msg.textContent = '✅ تم حفظ الحركة بنجاح';
    msg.className = 'msg-box ok';
    
    // زر طباعة الإيصال للإيرادات
    if (currentType === 'income') {
      const receiptBtn = document.createElement('button');
      receiptBtn.type = 'button';
      receiptBtn.innerHTML = '🖨️ طباعة إيصال للعميل';
      receiptBtn.style.cssText = 'width:100%;padding:12px;background:#2a5298;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;margin-top:10px;';
      receiptBtn.onclick = function() {
        sessionStorage.setItem('receiptData', JSON.stringify({...tx, id: txId}));
        window.open('receipt.html', '_blank');
      };
      msg.appendChild(document.createElement('br'));
      msg.appendChild(receiptBtn);
    }

    // إعادة تعيين النموذج
    document.getElementById('txForm').reset();
    document.getElementById('quantity').value = 1;
    document.getElementById('sellPrice').value = '';
    document.getElementById('productCategory').value = '';

    await refreshView();
    setTimeout(() => { msg.textContent = ''; msg.className = 'msg-box'; }, 3000);

  } catch (err) {
    console.error(err);
    msg.textContent = 'خطأ: ' + err.message;
    msg.className = 'msg-box err';
  }
}

async function updateInventoryOnPurchase(tx) {
  const products = await getAll('inventory');
  let product = products.find(p => p.name === tx.productName);
  if (product) {
    product.quantity += tx.quantity;
    product.lastPurchasePrice = tx.unitPrice;
    if (tx.sellPrice && tx.sellPrice > 0) {
      product.sellPrice = tx.sellPrice;
    }
    if (tx.productCategory) {
      product.category = tx.productCategory;
    }
    if (tx.baseUnit) product.baseUnit = tx.baseUnit;
    if (tx.units) product.units = tx.units;
    product.updatedAt = new Date().toISOString();
    await put('inventory', product);
  } else {
    product = {
      name: tx.productName,
      quantity: tx.quantity,
      lastPurchasePrice: tx.unitPrice,
      sellPrice: tx.sellPrice || 0,
      category: tx.productCategory || '',
      baseUnit: tx.baseUnit || 'قطعة',
      units: tx.units || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await add('inventory', product);
  }
}

async function updateInventoryOnSale(tx) {
  // إذا كانت فاتورة متعددة البنود
  if (tx.items && tx.items.length > 0) {
    for (const item of tx.items) {
      const product = await get('inventory', item.productId);
      if (!product) continue;
      product.quantity = (parseInt(product.quantity) || 0) - item.quantity;
      if (product.quantity < 0) product.quantity = 0;
      product.updatedAt = new Date().toISOString();
      await put('inventory', product);
    }
    return;
  }
  // البيع الفردي (القديم)
  const product = await get('inventory', tx.productId);
  if (!product) return;
  product.quantity -= 1;
  product.updatedAt = new Date().toISOString();
  await put('inventory', product);
}

async function refreshView() {
  const all = await getAll('transactions');
  const todayTx = all.filter(t => t.date === todayStr).sort((a, b) => b.time.localeCompare(a.time));

  // الملخص
  let sumIncome = 0, sumExpense = 0;
  todayTx.forEach(t => {
    const a = parseInt(t.amount) || 0;
    if (t.type === 'income') sumIncome += a;
    else sumExpense += a;
  });
  document.getElementById('sumIncome').textContent = sumIncome.toLocaleString('en-US');
  document.getElementById('sumExpense').textContent = sumExpense.toLocaleString('en-US');

  // الرصيد الحالي
  const closing = await get('settings', 'lastClosingBalance');
  const baseBalance = closing ? closing.value : 0;

  // احسب الرصيد من بداية اليوم
  let balance = baseBalance;
  all.forEach(t => {
    if (t.date < todayStr) return;
    const a = parseInt(t.amount) || 0;
    if (t.type === 'income') balance += a;
    else balance -= a;
  });
  document.getElementById('sumBalance').textContent = balance.toLocaleString('en-US');

  // القائمة
  const list = document.getElementById('txList');
  if (todayTx.length === 0) {
    list.innerHTML = '<div class="empty-msg">لا توجد حركات اليوم بعد</div>';
    return;
  }
  list.innerHTML = '';
  const typeLabels = {
    income: '➕ إيراد', expense: '➖ مصروف', purchase: '🛒 مشترى',
    owner_withdraw: '💼 مسحوبات', owner_personal: '🏠 شخصي'
  };
  todayTx.forEach(t => {
    const div = document.createElement('div');
    div.className = 'tx-item ' + t.type;
    const time = new Date(t.time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const sign = t.type === 'income' ? '+' : '-';
    div.innerHTML = `
      <button class="del-btn" onclick="deleteTx(${t.id})">🗑</button>
      <div class="tx-info">
        <div class="tx-type">${typeLabels[t.type] || t.type}</div>
        <div class="tx-desc">${t.description || ''}</div>
        <div class="tx-time">${time} — بواسطة ${t.username}</div>
      </div>
      <div class="tx-amount">${sign}${(t.amount||0).toLocaleString('en-US')}</div>
    `;
    list.appendChild(div);
  });
}

async function deleteTx(id) {
  if (!confirm('هل تريد حذف هذه الحركة؟')) return;
  const tx = await get('transactions', id);
  if (!tx) return;

  // عكس تأثير المخزون
  if (tx.type === 'purchase') {
    const products = await getAll('inventory');
    const product = products.find(p => p.name === tx.productName);
    if (product) {
      product.quantity -= tx.quantity;
      if (product.quantity <= 0) {
        await deleteItem('inventory', product.id);
      } else {
        await put('inventory', product);
      }
    }
  } else if (tx.type === 'income' && tx.incomeType === 'product') {
    // فاتورة متعددة البنود
    if (tx.items && tx.items.length > 0) {
      for (const item of tx.items) {
        const product = await get('inventory', item.productId);
        if (product) {
          product.quantity = (parseInt(product.quantity) || 0) + item.quantity;
          await put('inventory', product);
        }
      }
    } else if (tx.productId) {
      // بيع فردي (القديم)
      const product = await get('inventory', tx.productId);
      if (product) {
        product.quantity += 1;
        await put('inventory', product);
      }
    }
  }

  await deleteItem('transactions', id);
  await refreshView();
}

function deleteItem(store, key) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const req = t.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ===== بنود البيع =====

async function toggleProductItemsArea(value) {
  const area = document.getElementById('productItemsArea');
  if (!area) return;
  if (value === 'product') {
    area.style.display = 'block';
    const list = document.getElementById('itemsList');
    if (list && list.children.length === 0) {
      await addSaleItem();
    }
  } else {
    area.style.display = 'none';
  }
}

async function addSaleItem() {
  const list = document.getElementById('itemsList');
  const products = await getAll('inventory');

  const row = document.createElement('div');
  row.className = 'sale-item';
  row.style.cssText = 'background:#f8f9ff;border:1px solid #e6ebff;border-radius:10px;padding:10px;margin-bottom:8px;';

  const rowId = 'si_' + Date.now() + Math.random().toString(36).slice(2,6);

  let optionsHtml = '<option value="">-- اختر منتج --</option>';
  products.forEach(function(p) {
    if (p.quantity > 0) {
      const price = parseInt(p.sellPrice) || 0;
      optionsHtml += '<option value="' + p.id + '" data-price="' + price + '" data-qty="' + p.quantity + '">' + escapeHtmlA(p.name) + ' (متوفر: ' + p.quantity + ')</option>';
    }
  });

  row.innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 60px 70px 32px;gap:6px;align-items:center;margin-bottom:6px;">' +
      '<select class="si-product" onchange="onProductSelect(this)" style="padding:9px;border:2px solid #e0e0e0;border-radius:8px;font-size:12px;font-family:inherit;background:#fff;">' + optionsHtml + '</select>' +
      '<input type="number" class="si-qty" value="1" min="1" step="1" onchange="updateItemsTotal()" oninput="updateItemsTotal()" style="padding:9px 4px;border:2px solid #e0e0e0;border-radius:8px;font-size:12px;font-family:inherit;text-align:center;">' +
      '<input type="number" class="si-price" value="" min="0" step="1" placeholder="السعر" oninput="updateItemsTotal()" style="padding:9px 4px;border:2px solid #e0e0e0;border-radius:8px;font-size:12px;font-family:inherit;text-align:center;">' +
      '<button type="button" onclick="this.parentElement.parentElement.remove();updateItemsTotal();" style="background:#ffebee;color:#c62828;border:none;width:32px;height:32px;border-radius:8px;font-size:16px;cursor:pointer;padding:0;">×</button>' +
    '</div>' +
    '<div class="si-info" style="font-size:11px;color:#666;text-align:left;">الإجمالي: <b style="color:#2e7d32;">0</b> ر.ي</div>';

  list.appendChild(row);
}

function onProductSelect(sel) {
  const opt = sel.options[sel.selectedIndex];
  const price = parseInt(opt.dataset.price) || 0;
  const qty = parseInt(opt.dataset.qty) || 0;
  const row = sel.parentElement.parentElement;
  const priceInput = row.querySelector('.si-price');
  const qtyInput = row.querySelector('.si-qty');
  const info = row.querySelector('.si-info');

  if (price > 0) priceInput.value = price;
  if (qty > 0) qtyInput.max = qty;

  updateItemsTotal();
}

function updateItemsTotal() {
  const rows = document.querySelectorAll('.sale-item');
  let total = 0;
  rows.forEach(function(row) {
    const qty = parseInt(row.querySelector('.si-qty').value) || 0;
    const price = parseInt(row.querySelector('.si-price').value) || 0;
    const lineTotal = qty * price;
    total += lineTotal;
    const info = row.querySelector('.si-info b');
    if (info) info.textContent = lineTotal.toLocaleString('en-US');
  });
  const el = document.getElementById('itemsTotal');
  if (el) el.textContent = total.toLocaleString('en-US') + ' ر.ي';
}

function escapeHtmlA(t) {
  const d = document.createElement('div');
  d.textContent = t || '';
  return d.innerHTML;
}
