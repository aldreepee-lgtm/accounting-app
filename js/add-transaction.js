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

  // عرض اختيار المنتج عند اختيار بيع منتج
  document.getElementById('incomeType').addEventListener('change', (e) => {
    const wrap = document.getElementById('productSelectWrap');
    wrap.style.display = e.target.value === 'product' ? 'block' : 'none';
    if (e.target.value === 'product') loadProductsDropdown();
  });

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

async function loadProductsDropdown() {
  const products = await getAll('inventory');
  const sel = document.getElementById('productSelect');
  sel.innerHTML = '<option value="">-- اختر منتج --</option>';
  products.forEach(p => {
    if (p.quantity > 0) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (متوفر: ${p.quantity})`;
      sel.appendChild(opt);
    }
  });
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
      tx.description = document.getElementById('incomeDesc').value.trim() || 'إيراد';
      if (incomeType === 'product') {
        const prodId = parseInt(document.getElementById('productSelect').value);
        if (!prodId) { msg.textContent = 'اختر منتجاً'; msg.className = 'msg-box err'; return; }
        const product = await get('inventory', prodId);
        if (!product || product.quantity < 1) { msg.textContent = 'المنتج غير متوفر'; msg.className = 'msg-box err'; return; }
        tx.productId = prodId;
        tx.productName = product.name;
        tx.purchasePrice = product.lastPurchasePrice || 0;
        tx.profit = amount - tx.purchasePrice;
        tx.description = 'بيع: ' + product.name + (tx.profit !== 0 ? ' (ربح: ' + tx.profit + ')' : '');
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
      tx.productName = pname;
      tx.quantity = qty;
      tx.unitPrice = unitPrice;
      tx.sellPrice = sellPrice;
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
    document.getElementById('productSelectWrap').style.display = 'none';

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
    product.updatedAt = new Date().toISOString();
    await put('inventory', product);
  } else {
    product = {
      name: tx.productName,
      quantity: tx.quantity,
      lastPurchasePrice: tx.unitPrice,
      sellPrice: tx.sellPrice || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await add('inventory', product);
  }
}

async function updateInventoryOnSale(tx) {
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
  } else if (tx.type === 'income' && tx.incomeType === 'product' && tx.productId) {
    const product = await get('inventory', tx.productId);
    if (product) {
      product.quantity += 1;
      await put('inventory', product);
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
