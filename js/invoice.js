// ===== منطق الفاتورة متعددة البنود =====

let invType = 'sell';
let products = [];

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  products = await getAll('inventory');
  addItemRow();
});

function setInvType(type) {
  invType = type;
  document.querySelectorAll('.inv-type button').forEach(function(b) {
    b.classList.toggle('active', b.dataset.type === type);
    b.classList.remove('sell', 'buy');
    if (b.dataset.type === type) b.classList.add(type);
  });
  // أعد بناء الصفوف
  document.getElementById('itemsArea').innerHTML = '';
  addItemRow();
  updateSummary();
}

function addItemRow() {
  const area = document.getElementById('itemsArea');
  const row = document.createElement('div');
  row.className = 'item-row';
  row.dataset.id = Date.now() + Math.random();

  // حقل الاسم - قائمة منسدلة + إمكانية الكتابة
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'اسم المنتج';
  nameInput.className = 'item-name';
  nameInput.setAttribute('list', 'productsList_' + row.dataset.id);
  nameInput.style.gridColumn = 'span 2';

  // Datalist للمنتجات
  const datalist = document.createElement('datalist');
  datalist.id = 'productsList_' + row.dataset.id;
  products.forEach(function(p) {
    const opt = document.createElement('option');
    opt.value = p.name;
    opt.dataset.id = p.id;
    opt.dataset.price = invType === 'sell' ? (p.sellPrice || 0) : (p.lastPurchasePrice || 0);
    datalist.appendChild(opt);
  });

  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.min = '1';
  qtyInput.step = '1';
  qtyInput.value = 1;
  qtyInput.placeholder = 'كمية';
  qtyInput.className = 'item-qty';

  const priceInput = document.createElement('input');
  priceInput.type = 'number';
  priceInput.min = '0';
  priceInput.step = '1';
  priceInput.placeholder = 'سعر';
  priceInput.className = 'item-price';

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'del';
  delBtn.textContent = '×';
  delBtn.onclick = function() { row.remove(); updateSummary(); };

  const totalLine = document.createElement('div');
  totalLine.className = 'total-line';
  totalLine.innerHTML = 'الإجمالي: <b>0</b> ر.ي';

  const fields = document.createElement('div');
  fields.className = 'fields';
  fields.appendChild(nameInput);
  fields.appendChild(qtyInput);
  fields.appendChild(priceInput);
  fields.appendChild(delBtn);

  row.appendChild(fields);
  row.appendChild(totalLine);
  row.appendChild(datalist);
  area.appendChild(row);

  // أحداث
  nameInput.addEventListener('input', function() {
    autoFillPrice(nameInput, priceInput);
    updateLineTotal(row);
    updateSummary();
  });
  qtyInput.addEventListener('input', function() { updateLineTotal(row); updateSummary(); });
  priceInput.addEventListener('input', function() { updateLineTotal(row); updateSummary(); });

  setTimeout(function() { nameInput.focus(); }, 100);
}

function autoFillPrice(nameInput, priceInput) {
  const datalistId = nameInput.getAttribute('list');
  const datalist = document.getElementById(datalistId);
  if (!datalist) return;
  const opts = datalist.querySelectorAll('option');
  for (let i = 0; i < opts.length; i++) {
    if (opts[i].value === nameInput.value) {
      const p = parseInt(opts[i].dataset.price) || 0;
      if (p > 0 && !priceInput.value) priceInput.value = p;
      return;
    }
  }
}

function updateLineTotal(row) {
  const qty = parseInt(row.querySelector('.item-qty').value) || 0;
  const price = parseInt(row.querySelector('.item-price').value) || 0;
  const total = qty * price;
  row.querySelector('.total-line b').textContent = total.toLocaleString('en-US');
}

function updateSummary() {
  const rows = document.querySelectorAll('.item-row');
  let count = 0;
  let total = 0;
  rows.forEach(function(row) {
    const qty = parseInt(row.querySelector('.item-qty').value) || 0;
    const price = parseInt(row.querySelector('.item-price').value) || 0;
    if (qty > 0 && price > 0 && row.querySelector('.item-name').value.trim()) {
      count++;
      total += qty * price;
    }
  });
  document.getElementById('sumCount').textContent = count;
  document.getElementById('sumTotal').textContent = total.toLocaleString('en-US') + ' ر.ي';
}

async function saveInvoice() {
  const msg = document.getElementById('saveMsg');
  msg.className = 'msg';
  msg.textContent = '';

  const rows = document.querySelectorAll('.item-row');
  const items = [];

  for (const row of rows) {
    const name = row.querySelector('.item-name').value.trim();
    const qty = parseInt(row.querySelector('.item-qty').value) || 0;
    const price = parseInt(row.querySelector('.item-price').value) || 0;

    if (!name && qty === 0 && price === 0) continue;

    if (!name) {
      msg.className = 'msg err';
      msg.textContent = '❌ اسم المنتج مطلوب في كل بند';
      return;
    }
    if (qty <= 0) {
      msg.className = 'msg err';
      msg.textContent = '❌ الكمية يجب أن تكون أكبر من صفر';
      return;
    }
    if (price <= 0) {
      msg.className = 'msg err';
      msg.textContent = '❌ السعر يجب أن يكون أكبر من صفر';
      return;
    }

    // ابحث عن المنتج في المخزون
    const foundProduct = products.find(function(p) { return p.name === name; });

    items.push({
      name: name,
      quantity: qty,
      unitPrice: price,
      total: qty * price,
      productId: foundProduct ? foundProduct.id : null,
      purchasePrice: foundProduct ? (parseInt(foundProduct.lastPurchasePrice) || 0) : 0
    });
  }

  if (items.length === 0) {
    msg.className = 'msg err';
    msg.textContent = '❌ أضف بنداً واحداً على الأقل';
    return;
  }

  const total = items.reduce(function(s, i) { return s + i.total; }, 0);
  const note = document.getElementById('invNote').value.trim();

  const now = new Date();
  const dateStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');

  const tx = {
    type: invType === 'sell' ? 'income' : 'purchase',
    amount: total,
    date: dateStr,
    time: now.toISOString(),
    items: items,
    itemCount: items.length,
    invoice: true,
    note: note,
    description: (invType === 'sell' ? 'فاتورة بيع' : 'فاتورة شراء') + ' (' + items.length + ' بنود)',
    username: 'admin',
    role: 'owner'
  };

  try {
    // 1) حدّث المخزون
    for (const item of items) {
      if (item.productId) {
        const product = await get('inventory', item.productId);
        if (product) {
          if (invType === 'sell') {
            product.quantity = (parseInt(product.quantity) || 0) - item.quantity;
            if (product.quantity < 0) product.quantity = 0;
          } else {
            product.quantity = (parseInt(product.quantity) || 0) + item.quantity;
            product.lastPurchasePrice = item.unitPrice;
          }
          product.updatedAt = new Date().toISOString();
          await put('inventory', product);
        }
      } else if (invType === 'buy') {
        // منتج جديد من الفاتورة (شراء)
        await add('inventory', {
          name: item.name,
          quantity: item.quantity,
          lastPurchasePrice: item.unitPrice,
          sellPrice: 0,
          category: '',
          baseUnit: 'قطعة',
          units: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    // 2) احفظ الفاتورة
    const id = await add('transactions', tx);

    msg.className = 'msg ok';
    msg.textContent = '✅ تم حفظ الفاتورة #' + id + ' — الإجمالي: ' + total.toLocaleString('en-US') + ' ر.ي';

    // 3) إعادة ضبط
    setTimeout(function() {
      document.getElementById('itemsArea').innerHTML = '';
      document.getElementById('invNote').value = '';
      addItemRow();
      updateSummary();
      products = [];
    }, 500);

    setTimeout(async function() {
      products = await getAll('inventory');
    }, 800);

  } catch(e) {
    console.error(e);
    msg.className = 'msg err';
    msg.textContent = '❌ خطأ: ' + e.message;
  }
}
