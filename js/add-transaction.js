// ===== منطق إضافة الحركة =====

let currentUser = null;
let currentType = 'income';
let todayStr = '';

// قراءة النوع من الرابط فوراً (قبل DOMContentLoaded)
(function() {
  try {
    const p = new URLSearchParams(window.location.search).get('type');
    if (p && ['income', 'expense', 'purchase', 'owner_withdraw', 'owner_personal', 'worker_salary'].indexOf(p) !== -1) {
      currentType = p;
    }
  } catch(e) {}
})();

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

  // تطبيق النوع من الرابط
  switchType(currentType);

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


async function handleSave(e) {
  e.preventDefault();
  const msg = document.getElementById('formMsg');
  msg.textContent = ''; msg.className = 'msg-box';

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
        if (cartItems.length === 0) {
          msg.textContent = 'أضف منتجاً واحداً على الأقل إلى السلة';
          msg.className = 'msg-box err';
          return;
        }
        const items = [];
        let totalAmount = 0;
        let profitTotal = 0;
        for (const item of cartItems) {
          const product = await get('inventory', item.productId);
          if (!product) { msg.textContent = 'المنتج غير موجود'; msg.className = 'msg-box err'; return; }
          const purchasePrice = parseInt(product.lastPurchasePrice) || 0;
          items.push({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            purchasePrice: purchasePrice,
            lineTotal: item.lineTotal
          });
          totalAmount += item.lineTotal;
          profitTotal += (item.unitPrice - purchasePrice) * item.quantity;
        }
        tx.items = items;
        tx.amount = totalAmount;
        tx.itemCount = items.length;
        const desc = document.getElementById('incomeDesc').value.trim();
        tx.description = desc || ('فاتورة بيع (' + items.length + ' بند)');
        tx.profit = profitTotal;
      } else {
        tx.description = document.getElementById('incomeDesc').value.trim() || 'إيراد';
      }
      
      // طريقة الدفع (نقدي / على الحساب)
      const payMethod = document.getElementById('paymentMethod') ? document.getElementById('paymentMethod').value : 'cash';
      tx.paymentMethod = payMethod;
      if (payMethod === 'credit') {
        const custName = document.getElementById('customerName') ? document.getElementById('customerName').value.trim() : '';
        if (!custName) {
          msg.textContent = 'أدخل اسم العميل للدين';
          msg.className = 'msg-box err';
          return;
        }
        tx.customerName = custName;
        tx.isCredit = true;
        tx.creditAmount = tx.amount || amount;
        tx.paidAmount = 0;
        tx.paymentStatus = 'unpaid';
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
      let purchaseUnitFactor = 1;
      let purchaseUnitName = 'قطعة';
      const puEl = document.getElementById('purchaseUnit');
      if (puEl && puEl.options && puEl.options.length > 0 && puEl.selectedIndex >= 0) {
        purchaseUnitFactor = parseInt(puEl.value) || 1;
        purchaseUnitName = puEl.options[puEl.selectedIndex].textContent.split(' (')[0] || 'قطعة';
      }
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
    
    // زر طباعة الإيصال لكل الأنواع
    if (currentType === 'income' || currentType === 'purchase' || currentType === 'expense') {
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

// ===== نظام السلة =====
let cartItems = [];

async function initProductItemsArea() {
  const area = document.getElementById('productItemsArea');
  if (!area) return;

  // املأ قائمة المنتجات
  const sel = document.getElementById('entryProduct');
  const products = await getAll('inventory');
  let html = '<option value="">-- اختر منتج --</option>';
  if (products.length === 0) {
    html += '<option value="" disabled>لا توجد منتجات</option>';
  }
  products.forEach(function(p) {
    const q = parseInt(p.quantity) || 0;
    const sellP = parseInt(p.sellPrice) || 0;
    const buyP = parseInt(p.lastPurchasePrice) || 0;
    const finalP = sellP > 0 ? sellP : buyP;
    const label = q > 0 ? escapeHtmlA(p.name) + ' (' + q + ' متوفر)' : escapeHtmlA(p.name) + ' ⚠️ (نفد)';
    const disabled = q <= 0 ? ' disabled' : '';
    html += '<option value="' + p.id + '" data-price="' + finalP + '" data-qty="' + q + '" data-name="' + escapeHtmlA(p.name) + '"' + disabled + '>' + label + '</option>';
  });
  sel.innerHTML = html;
  renderCart();
}

async function toggleProductItemsArea(value) {
  const area = document.getElementById('productItemsArea');
  if (!area) return;
  if (value === 'product') {
    area.style.display = 'block';
    await initProductItemsArea();
  } else {
    area.style.display = 'none';
    cartItems = [];
    renderCart();
  }
}

function onEntryProductChange() {
  const sel = document.getElementById('entryProduct');
  const opt = sel.options[sel.selectedIndex];
  if (!opt || !opt.value) return;
  const price = parseInt(opt.dataset.price) || 0;
  const priceInput = document.getElementById('entryPrice');
  if (price > 0) priceInput.value = price;
}

function addToCart() {
  const sel = document.getElementById('entryProduct');
  const opt = sel.options[sel.selectedIndex];
  const prodId = parseInt(sel.value);
  const qty = parseInt(document.getElementById('entryQty').value) || 0;
  const price = parseInt(document.getElementById('entryPrice').value) || 0;

  if (!prodId) { alert('اختر منتجاً'); return; }
  if (qty < 1) { alert('الكمية يجب أن تكون أكبر من صفر'); return; }
  if (price < 1) { alert('السعر مطلوب'); return; }

  const maxQty = parseInt(opt.dataset.qty) || 0;
  const existing = cartItems.find(function(i) { return i.productId === prodId; });
  const newTotalQty = (existing ? existing.quantity : 0) + qty;
  if (newTotalQty > maxQty) {
    alert('⚠️ الكمية المطلوبة أكبر من المخزون المتوفر (' + maxQty + ')');
    return;
  }

  if (existing) {
    existing.quantity += qty;
    existing.lineTotal = existing.quantity * existing.unitPrice;
  } else {
    cartItems.push({
      productId: prodId,
      productName: opt.dataset.name,
      quantity: qty,
      unitPrice: price,
      lineTotal: qty * price
    });
  }

  // إعادة تعيين الحقول
  sel.value = '';
  document.getElementById('entryQty').value = 1;
  document.getElementById('entryPrice').value = '';

  renderCart();
}

function removeFromCart(idx) {
  cartItems.splice(idx, 1);
  renderCart();
}

function renderCart() {
  const list = document.getElementById('cartList');
  const count = document.getElementById('cartCount');
  const totalEl = document.getElementById('cartTotal');
  if (!list) return;

  if (cartItems.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#aaa;padding:14px;font-size:12px;">السلة فارغة</div>';
  } else {
    list.innerHTML = cartItems.map(function(item, idx) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px;border-bottom:1px solid #f5f5f5;font-size:12px;">' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-weight:700;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtmlA(item.productName) + '</div>' +
          '<div style="font-size:11px;color:#888;margin-top:2px;">' + item.quantity + ' × ' + item.unitPrice + ' = ' + item.lineTotal.toLocaleString('en-US') + ' ر.ي</div>' +
        '</div>' +
        '<button type="button" onclick="removeFromCart(' + idx + ')" style="background:#ffebee;color:#c62828;border:none;width:26px;height:26px;border-radius:6px;cursor:pointer;font-size:14px;padding:0;margin-right:6px;flex-shrink:0;">×</button>' +
      '</div>';
    }).join('');
  }

  let total = 0;
  cartItems.forEach(function(i) { total += i.lineTotal; });
  if (count) count.textContent = cartItems.length + ' صنف';
  if (totalEl) totalEl.textContent = total.toLocaleString('en-US') + ' ر.ي';
  const amountEl = document.getElementById('amount');
  if (amountEl && cartItems.length > 0) amountEl.value = total;
}

function getCartTotal() {
  let total = 0;
  cartItems.forEach(function(i) { total += i.lineTotal; });
  return total;
}

function escapeHtmlA(t) {
  const d = document.createElement('div');
  d.textContent = t || '';
  return d.innerHTML;
}

// ===== حفظ وطباعة =====
async function saveAndPrint() {
  // احفظ أولاً
  const form = document.getElementById('txForm');
  if (!form) return;
  const btn = document.querySelector('button[type="submit"]');
  if (btn) btn.click();

  // انتظر حتى ينتهي الحفظ (نتحقق من ظهور رسالة النجاح)
  let tries = 0;
  const check = setInterval(function() {
    tries++;
    const msg = document.getElementById('formMsg');
    if (msg && msg.classList.contains('ok') && msg.textContent.indexOf('بنجاح') !== -1) {
      clearInterval(check);
      // اضغط زر الإيصال إذا ظهر
      const receiptBtn = msg.querySelector('button');
      if (receiptBtn) {
        receiptBtn.click();
      } else {
        alert('⚠️ لم يتم العثور على زر الإيصال');
      }
    } else if (msg && msg.classList.contains('err')) {
      clearInterval(check);
    } else if (tries > 30) {
      clearInterval(check);
      alert('⚠️ تأخر الحفظ، حاول مرة أخرى');
    }
  }, 200);
}

// ===== طريقة الدفع =====
function onPaymentMethodChange() {
  const sel = document.getElementById('paymentMethod');
  const wrap = document.getElementById('customerNameWrap');
  if (!sel || !wrap) return;
  if (sel.value === 'credit') {
    wrap.style.display = 'block';
    // حمّل قائمة العملاء
    if (typeof loadCustomersDropdown === 'function') {
      loadCustomersDropdown();
    }
  } else {
    wrap.style.display = 'none';
    const cn = document.getElementById('customerName');
    if (cn) cn.value = '';
  }
}

// ===== العملاء =====
async function loadCustomersDropdown() {
  const sel = document.getElementById('customerName');
  if (!sel) return;
  const current = sel.value;
  const savedData = await get('settings', 'customersData');
  const customers = (savedData && savedData.value) ? savedData.value : {};
  const tx = await getAll('transactions');
  tx.forEach(function(t) {
    if (t.customerName && !customers[t.customerName]) {
      customers[t.customerName] = '';
    }
  });
  const names = Object.keys(customers).sort();
  let html = '<option value="">-- اختر عميلاً --</option>';
  if (names.length === 0) {
    html += '<option value="" disabled>لا يوجد عملاء — اضغط + للإضافة</option>';
  }
  names.forEach(function(n) {
    const phone = customers[n] || '';
    const label = phone ? n + ' — ' + phone : n;
    html += '<option value="' + escHtmlA(n) + '">' + escHtmlA(label) + '</option>';
  });
  sel.innerHTML = html;
  if (current) sel.value = current;
}

function openQuickAddCustomer() {
  const modal = document.getElementById('quickCustomerModal');
  const nameEl = document.getElementById('quickCustomerName');
  const phoneEl = document.getElementById('quickCustomerPhone');
  const msgEl = document.getElementById('quickCustomerMsg');
  if (!modal) return;
  nameEl.value = '';
  phoneEl.value = '';
  msgEl.textContent = '';
  modal.style.display = 'flex';
  setTimeout(function() { nameEl.focus(); }, 200);
}

function closeQuickAddCustomer() {
  const modal = document.getElementById('quickCustomerModal');
  if (modal) modal.style.display = 'none';
}

async function saveQuickCustomer() {
  const nameEl = document.getElementById('quickCustomerName');
  const phoneEl = document.getElementById('quickCustomerPhone');
  const msgEl = document.getElementById('quickCustomerMsg');
  const name = nameEl.value.trim();
  const phone = phoneEl.value.trim();
  if (!name) {
    msgEl.style.color = '#c62828';
    msgEl.textContent = 'أدخل اسم العميل';
    return;
  }
  if (phone) {
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length < 9) {
      msgEl.style.color = '#c62828';
      msgEl.textContent = 'رقم الهاتف يجب أن يكون 9 أرقام على الأقل';
      return;
    }
  }
  try {
    const savedData = await get('settings', 'customersData');
    const customers = (savedData && savedData.value) ? savedData.value : {};
    customers[name] = phone;
    await put('settings', { key: 'customersData', value: customers });
    msgEl.style.color = '#2e7d32';
    msgEl.textContent = 'تم الحفظ';
    setTimeout(async function() {
      closeQuickAddCustomer();
      await loadCustomersDropdown();
      const sel = document.getElementById('customerName');
      if (sel) sel.value = name;
    }, 600);
  } catch(e) {
    console.error(e);
    msgEl.style.color = '#c62828';
    msgEl.textContent = 'خطأ: ' + e.message;
  }
}

function escHtmlA(t) {
  const d = document.createElement('div');
  d.textContent = t || '';
  return d.innerHTML;
}
