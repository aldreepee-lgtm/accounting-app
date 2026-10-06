// ===== منطق العملاء والديون =====

let allCustomers = [];
let currentPaymentCustomer = null;

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  await loadCustomers();

  const search = document.getElementById('searchInput');
  if (search) search.addEventListener('input', applyFilter);
});

async function loadCustomers() {
  const tx = await getAll('transactions');
  const customersMap = {};

  // جلب بيانات العملاء المحفوظة (الاسم + الهاتف)
  const savedData = await get('settings', 'customersData');
  const phones = (savedData && savedData.value) ? savedData.value : {};

  tx.forEach(function(t) {
    const name = t.customerName || t.personName;
    if (!name) return;

    if (!customersMap[name]) {
      customersMap[name] = {
        name: name,
        phone: phones[name] || '',
        totalCredit: 0,
        totalPaid: 0,
        transactions: [],
        lastDate: ''
      };
    }

    const c = customersMap[name];

    if (t.type === 'income' && t.isCredit === true) {
      c.totalCredit += parseInt(t.creditAmount) || parseInt(t.amount) || 0;
      c.transactions.push({
        type: 'credit',
        date: t.date,
        time: t.time,
        amount: parseInt(t.creditAmount) || parseInt(t.amount) || 0,
        description: t.description || 'دين',
        txId: t.id
      });
    } else if (t.type === 'payment' || t.isPayment === true) {
      c.totalPaid += parseInt(t.amount) || 0;
      c.transactions.push({
        type: 'payment',
        date: t.date,
        time: t.time,
        amount: parseInt(t.amount) || 0,
        description: t.description || 'دفعة',
        txId: t.id
      });
    }

    if (t.date > c.lastDate) c.lastDate = t.date;
  });

  allCustomers = Object.values(customersMap).filter(function(c) {
    return (c.totalCredit - c.totalPaid) !== 0 || c.transactions.length > 0;
  });

  allCustomers.forEach(function(c) {
    c.balance = c.totalCredit - c.totalPaid;
  });

  allCustomers.sort(function(a, b) {
    if (a.balance > 0 && b.balance <= 0) return -1;
    if (b.balance > 0 && a.balance <= 0) return 1;
    return b.balance - a.balance;
  });

  applyFilter();
}

function applyFilter() {
  const search = document.getElementById('searchInput');
  const q = search ? search.value.trim().toLowerCase() : '';

  let filtered = allCustomers;
  if (q) {
    filtered = allCustomers.filter(function(c) {
      return c.name.toLowerCase().indexOf(q) !== -1 ||
             (c.phone && c.phone.indexOf(q) !== -1);
    });
  }

  renderCustomers(filtered);
  updateStats(filtered);
}

function updateStats(list) {
  let totalDebt = 0;
  let count = 0;
  list.forEach(function(c) {
    if (c.balance > 0) {
      totalDebt += c.balance;
      count++;
    }
  });
  document.getElementById('statCustomers').textContent = count;
  document.getElementById('statDebt').textContent = totalDebt.toLocaleString('en-US');
}

function renderCustomers(list) {
  const box = document.getElementById('customersList');

  if (list.length === 0) {
    box.innerHTML = '<div class="empty-msg">📭 لا يوجد عملاء بديون' +
      (allCustomers.length > 0 ? ' مطابقون للبحث' : ' بعد') +
      '<br><br><span style="font-size:12px;color:#888;">اضغط زر ➕ لإضافة عميل</span></div>';
    return;
  }

  box.innerHTML = list.map(function(c) {
    const isPaid = c.balance <= 0;
    const badge = isPaid ? '✅ مسدّد' : '⚠️ عليه دين';
    const phoneLine = c.phone ? '📱 ' + esc( c.phone) : '📱 <span style="color:#c62828;">لم يُسجّل</span>';

    const shareDisabled = c.phone ? '' : ' disabled';

    return '<div class="customer-item ' + (isPaid ? 'paid' : '') + '">' +
      '<div class="row1">' +
        '<div class="name">👤 ' + esc(c.name) + '</div>' +
        '<div class="debt-amount">' + c.balance.toLocaleString('en-US') + ' ر.ي</div>' +
      '</div>' +
      '<div class="phone">' + phoneLine + '</div>' +
      '<div class="meta">' +
        '💰 إجمالي: <b>' + c.totalCredit.toLocaleString('en-US') + '</b> | ' +
        '✅ مدفوع: <b>' + c.totalPaid.toLocaleString('en-US') + '</b><br>' +
        '📅 آخر حركة: <b>' + (c.lastDate || '—') + '</b> · ' + badge +
      '</div>' +
      '<div class="actions">' +
        '<button class="pay-btn" onclick="openPayModal(\'' + escJs(c.name) + '\')">💰 دفعة</button>' +
        '<button class="info-btn" onclick="openStatement(\'' + escJs(c.name) + '\')">📋 كشف</button>' +
        '<button class="share-btn" onclick="shareViaWhatsApp(\'' + escJs(c.name) + '\')"' + shareDisabled + '>💬 واتساب</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ===== إضافة / تعديل عميل =====
function openAddCustomerModal(name) {
  const modal = document.getElementById('customerModal');
  const title = document.getElementById('customerModalTitle');
  const nameInput = document.getElementById('newCustomerName');
  const phoneInput = document.getElementById('newCustomerPhone');
  const hidden = document.getElementById('editingCustomerName');
  const msg = document.getElementById('customerMsg');

  msg.textContent = '';
  msg.className = 'msg-box';

  if (name) {
    title.textContent = '✏️ تعديل بيانات العميل';
    hidden.value = name;
    nameInput.value = name;
    const c = allCustomers.find(function(x) { return x.name === name; });
    phoneInput.value = (c && c.phone) ? c.phone : '';
  } else {
    title.textContent = '➕ إضافة عميل جديد';
    hidden.value = '';
    nameInput.value = '';
    phoneInput.value = '';
  }

  modal.classList.add('show');
  setTimeout(function() { nameInput.focus(); }, 200);
}

function closeCustomerModal() {
  document.getElementById('customerModal').classList.remove('show');
}

async function saveCustomer() {
  const msg = document.getElementById('customerMsg');
  const name = document.getElementById('newCustomerName').value.trim();
  const phone = document.getElementById('newCustomerPhone').value.trim();
  const oldName = document.getElementById('editingCustomerName').value;

  if (!name) {
    msg.textContent = 'أدخل اسم العميل';
    msg.className = 'msg-box err';
    return;
  }

  if (phone) {
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length < 9) {
      msg.textContent = 'رقم الهاتف غير صحيح (يجب 9 أرقام على الأقل)';
      msg.className = 'msg-box err';
      return;
    }
  }

  try {
    const savedData = await get('settings', 'customersData');
    const phones = (savedData && savedData.value) ? savedData.value : {};

    if (oldName && oldName !== name) {
      delete phones[oldName];
    }

    phones[name] = phone;
    await put('settings', { key: 'customersData', value: phones });

    msg.textContent = '✅ تم الحفظ';
    msg.className = 'msg-box ok';

    setTimeout(async function() {
      closeCustomerModal();
      await loadCustomers();
    }, 700);
  } catch(e) {
    console.error(e);
    msg.textContent = 'خطأ: ' + e.message;
    msg.className = 'msg-box err';
  }
}

// ===== مشاركة على واتساب =====
async function shareViaWhatsApp(customerName) {
  const c = allCustomers.find(function(x) { return x.name === customerName; });
  if (!c) { alert('العميل غير موجود'); return; }

  if (!c.phone) {
    alert('⚠️ لا يوجد رقم هاتف لهذا العميل\n\nاضغط زر "تعديل" لإضافة الرقم.');
    return;
  }

  // جلب اسم المكتب
  const officeName = await get('settings', 'officeName');
  const name = (officeName && officeName.value) ? officeName.value : 'المكتب';

  let message = '🧾 *كشف حساب - ' + name + '*\n';
  message += '━━━━━━━━━━━━━━━━━━\n\n';
  message += '👤 *' + c.name + '*\n';
  message += '📅 ' + (c.lastDate || '—') + '\n\n';

  if (c.transactions.length > 0) {
    message += '📋 *آخر الحركات:*\n';
    const sorted = c.transactions.slice().sort(function(a, b) {
      return (b.time || '').localeCompare(a.time || '');
    }).slice(0, 10);

    sorted.forEach(function(t) {
      const sign = t.type === 'payment' ? '✅' : '🔴';
      const label = t.type === 'payment' ? 'دفعة' : 'دين';
      message += sign + ' ' + t.date + ' · ' + label + ': ' + t.amount.toLocaleString('en-US') + ' ر.ي\n';
    });
    message += '\n';
  }

  message += '━━━━━━━━━━━━━━━━━━\n';
  message += '💰 *إجمالي المطلوب:* ' + c.totalCredit.toLocaleString('en-US') + ' ر.ي\n';
  message += '✅ *المدفوع:* ' + c.totalPaid.toLocaleString('en-US') + ' ر.ي\n';
  message += '━━━━━━━━━━━━━━━━━━\n';
  message += '🔵 *المتبقي: ' + c.balance.toLocaleString('en-US') + ' ر.ي*\n';
  message += '━━━━━━━━━━━━━━━━━━\n\n';

  if (c.balance <= 0) {
    message += '✨ شكراً لك! الحساب مسدّد بالكامل ✅\n\n';
  } else {
    message += '📌 يرجى تسديد المبلغ المتبقي في أقرب وقت.\n\n';
  }

  message += '📞 للاستفسار: 778983131\n';
  message += '💻 ' + name;

  const phone = c.phone.replace(/[^0-9]/g, '');
  const url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);

  window.open(url, '_blank');
}

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t || '';
  return d.innerHTML;
}

function escJs(t) {
  return (t || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ===== تسجيل دفعة =====
function openPayModal(customerName) {
  const c = allCustomers.find(function(x) { return x.name === customerName; });
  if (!c) return;

  currentPaymentCustomer = c;
  const modal = document.getElementById('payModal');
  const info = document.getElementById('payModalInfo');
  const amountInput = document.getElementById('payAmount');
  const noteInput = document.getElementById('payNote');
  const msg = document.getElementById('payMsg');

  msg.textContent = '';
  msg.className = 'msg-box';

  info.innerHTML =
    '<div>👤 <b>' + esc(c.name) + '</b></div>' +
    '<div>📊 إجمالي الدين: <b style="color:#c62828;">' + c.totalCredit.toLocaleString('en-US') + ' ر.ي</b></div>' +
    '<div>💰 المدفوع سابقاً: <b style="color:#2e7d32;">' + c.totalPaid.toLocaleString('en-US') + ' ر.ي</b></div>' +
    '<div>🔵 المتبقي: <b style="color:#1565c0;">' + c.balance.toLocaleString('en-US') + ' ر.ي</b></div>';

  amountInput.value = c.balance > 0 ? c.balance : '';
  noteInput.value = '';

  modal.classList.add('show');
  setTimeout(function() { amountInput.focus(); amountInput.select(); }, 200);
}

function closePayModal() {
  document.getElementById('payModal').classList.remove('show');
  currentPaymentCustomer = null;
}

async function savePayment() {
  const msg = document.getElementById('payMsg');
  if (!currentPaymentCustomer) return;

  const amount = parseInt(document.getElementById('payAmount').value) || 0;
  const note = document.getElementById('payNote').value.trim();

  if (amount < 1) {
    msg.textContent = 'أدخل مبلغاً صحيحاً';
    msg.className = 'msg-box err';
    return;
  }

  if (amount > currentPaymentCustomer.balance) {
    if (!confirm('⚠️ المبلغ أكبر من الدين المتبقي (' + currentPaymentCustomer.balance.toLocaleString('en-US') + ')\n\nهل تريد المتابعة؟')) {
      return;
    }
  }

  try {
    const now = new Date();
    const dateStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');

    const userJson = localStorage.getItem('currentUser');
    const user = userJson ? JSON.parse(userJson) : { username: 'system', id: 0 };

    const tx = {
      type: 'payment',
      isPayment: true,
      amount: amount,
      date: dateStr,
      time: now.toISOString(),
      customerName: currentPaymentCustomer.name,
      description: note || ('دفعة من ' + currentPaymentCustomer.name),
      username: user.username,
      userId: user.id
    };

    await add('transactions', tx);

    msg.textContent = '✅ تم حفظ الدفعة';
    msg.className = 'msg-box ok';

    setTimeout(async function() {
      closePayModal();
      await loadCustomers();
    }, 800);
  } catch(e) {
    console.error(e);
    msg.textContent = 'خطأ: ' + e.message;
    msg.className = 'msg-box err';
  }
}

// ===== كشف الحساب =====
function openInfoModal(customerName) {
  const c = allCustomers.find(function(x) { return x.name === customerName; });
  if (!c) return;

  const modal = document.getElementById('infoModal');
  const title = document.getElementById('infoModalTitle');
  const body = document.getElementById('infoModalBody');

  title.textContent = '📋 كشف: ' + c.name;

  let html = '';

  html += '<div style="background:#f8f9ff;border-radius:10px;padding:12px;margin-bottom:12px;font-size:13px;line-height:1.9;">';
  html += '<div>📱 الهاتف: <b>' + (c.phone ? esc(c.phone) : 'غير مسجّل') + '</b></div>';
  html += '<div>💰 إجمالي الدين: <b style="color:#c62828;">' + c.totalCredit.toLocaleString('en-US') + ' ر.ي</b></div>';
  html += '<div>✅ المدفوع: <b style="color:#2e7d32;">' + c.totalPaid.toLocaleString('en-US') + ' ر.ي</b></div>';
  html += '<div>🔵 المتبقي: <b style="color:#1565c0;font-size:15px;">' + c.balance.toLocaleString('en-US') + ' ر.ي</b></div>';
  html += '</div>';

  html += '<div style="font-size:13px;font-weight:700;color:#2a5298;margin-bottom:8px;">📜 سجل الحركات</div>';

  if (c.transactions.length === 0) {
    html += '<div style="text-align:center;color:#aaa;padding:20px;">لا توجد حركات</div>';
  } else {
    const sorted = c.transactions.slice().sort(function(a, b) {
      return (b.time || '').localeCompare(a.time || '');
    });
    sorted.forEach(function(t) {
      const label = t.type === 'payment' ? '✅ دفعة' : '🔴 دين';
      html += '<div class="history-item ' + t.type + '">' +
        '<div>' + label + ' · ' + t.date + '</div>' +
        '<div>' + esc(t.description) + '</div>' +
        '<div class="amt">' + t.amount.toLocaleString('en-US') + ' ر.ي</div>' +
      '</div>';
    });
  }

  html += '<button class="btn-cancel" onclick="editCustomerFromInfo(\'' + escJs(c.name) + '\')" style="margin-top:14px;background:#fff3e0;color:#e65100;">✏️ تعديل بيانات العميل</button>';

  body.innerHTML = html;
  modal.classList.add('show');
}

function closeInfoModal() {
  document.getElementById('infoModal').classList.remove('show');
}

function editCustomerFromInfo(customerName) {
  closeInfoModal();
  setTimeout(function() { openAddCustomerModal(customerName); }, 300);
}

// ===== فتح كشف الحساب =====
function openStatement(customerName) {
  const url = 'statement.html?type=customer&name=' + encodeURIComponent(customerName);
  window.open(url, '_blank');
}
