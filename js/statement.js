// ===== منطق كشف الحساب =====

let statementType = '';
let statementData = null;

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();

  const params = new URLSearchParams(window.location.search);
  statementType = params.get('type') || 'customer';

  if (statementType === 'customer') {
    const name = params.get('name');
    if (!name) { alert('اسم العميل مطلوب'); return; }
    await loadCustomerStatement(name);
  } else if (statementType === 'day') {
    const date = params.get('date');
    if (!date) { alert('التاريخ مطلوب'); return; }
    await loadDayStatement(date);
  } else if (statementType === 'month') {
    const month = params.get('month');
    if (!month) { alert('الشهر مطلوب'); return; }
    await loadMonthStatement(month);
  }

  await loadOfficeInfo();
  renderStatement();
});

async function loadOfficeInfo() {
  const name = await get('settings', 'officeName');
  const phone = await get('settings', 'officePhone');
  const address = await get('settings', 'officeAddress');

  const nameEl = document.getElementById('stmtOfficeName');
  const contactEl = document.getElementById('stmtOfficeContact');

  if (name && name.value) nameEl.textContent = name.value;

  const parts = [];
  if (address && address.value) parts.push('📍 ' + address.value);
  if (phone && phone.value) parts.push('📞 ' + phone.value);
  contactEl.innerHTML = parts.join(' &nbsp;|&nbsp; ');
}

// ===== كشف عميل =====
async function loadCustomerStatement(customerName) {
  const savedData = await get('settings', 'customersData');
  const customers = (savedData && savedData.value) ? savedData.value : {};
  const phone = customers[customerName] || '';

  const allTx = await getAll('transactions');
  const tx = allTx.filter(function(t) {
    return t.customerName === customerName && (t.isCredit === true || t.isPayment === true);
  });

  tx.sort(function(a, b) {
    return (a.time || '').localeCompare(b.time || '');
  });

  let totalCredit = 0;
  let totalPaid = 0;

  const transactions = tx.map(function(t) {
    if (t.type === 'income' && t.isCredit === true) {
      const amt = parseInt(t.creditAmount) || parseInt(t.amount) || 0;
      totalCredit += amt;
      return {
        type: 'credit',
        date: t.date,
        time: t.time,
        amount: amt,
        description: t.description || 'دين'
      };
    } else if (t.type === 'payment' || t.isPayment === true) {
      const amt = parseInt(t.amount) || 0;
      totalPaid += amt;
      return {
        type: 'payment',
        date: t.date,
        time: t.time,
        amount: amt,
        description: t.description || 'دفعة'
      };
    }
    return null;
  }).filter(function(t) { return t !== null; });

  statementData = {
    type: 'customer',
    name: customerName,
    phone: phone,
    totalCredit: totalCredit,
    totalPaid: totalPaid,
    balance: totalCredit - totalPaid,
    transactions: transactions
  };

  document.title = 'كشف حساب - ' + customerName;
}

// ===== كشف يومي =====
async function loadDayStatement(date) {
  const allTx = await getAll('transactions');
  const tx = allTx.filter(function(t) { return t.date === date; });

  tx.sort(function(a, b) {
    return (a.time || '').localeCompare(b.time || '');
  });

  let totalIncome = 0;
  let totalExpense = 0;

  const transactions = tx.map(function(t) {
    const amt = parseInt(t.amount) || 0;
    const isIncome = t.type === 'income';
    if (isIncome) totalIncome += amt;
    else totalExpense += amt;

    return {
      type: isIncome ? 'payment' : 'credit',
      date: t.date,
      time: t.time,
      amount: amt,
      description: t.description || t.productName || 'حركة',
      rawType: t.type
    };
  });

  statementData = {
    type: 'day',
    date: date,
    totalIncome: totalIncome,
    totalExpense: totalExpense,
    balance: totalIncome - totalExpense,
    transactions: transactions
  };

  document.title = 'كشف يومي - ' + date;
}

// ===== كشف شهري =====
async function loadMonthStatement(month) {
  const allTx = await getAll('transactions');
  const tx = allTx.filter(function(t) { return t.date && t.date.indexOf(month) === 0; });

  tx.sort(function(a, b) {
    return (a.time || '').localeCompare(b.time || '');
  });

  let totalIncome = 0;
  let totalExpense = 0;

  const transactions = tx.map(function(t) {
    const amt = parseInt(t.amount) || 0;
    const isIncome = t.type === 'income';
    if (isIncome) totalIncome += amt;
    else totalExpense += amt;

    return {
      type: isIncome ? 'payment' : 'credit',
      date: t.date,
      time: t.time,
      amount: amt,
      description: t.description || t.productName || 'حركة',
      rawType: t.type
    };
  });

  statementData = {
    type: 'month',
    month: month,
    totalIncome: totalIncome,
    totalExpense: totalExpense,
    balance: totalIncome - totalExpense,
    transactions: transactions
  };

  document.title = 'كشف شهري - ' + month;
}

// ===== العرض =====
function renderStatement() {
  if (!statementData) return;

  const info = document.getElementById('stmtCustomerInfo');
  const stats = document.getElementById('stmtStats');
  const list = document.getElementById('stmtTxList');

  if (statementData.type === 'customer') {
    const d = statementData;
    info.innerHTML =
      '<div class="name">👤 ' + esc( d.name) + '</div>' +
      (d.phone ? '<div class="phone">📱 <span dir="ltr">' + esc(d.phone) + '</span></div>' : '');

    stats.innerHTML =
      '<div class="stat-box credit"><div class="lbl">إجمالي الدين</div><div class="val">' + d.totalCredit.toLocaleString('en-US') + '</div></div>' +
      '<div class="stat-box paid"><div class="lbl">المدفوع</div><div class="val">' + d.totalPaid.toLocaleString('en-US') + '</div></div>' +
      '<div class="stat-box balance" style="grid-column:1/-1;"><div class="lbl">المتبقي</div><div class="val">' + d.balance.toLocaleString('en-US') + ' ر.ي</div></div>';
  } else if (statementData.type === 'day') {
    const d = statementData;
    info.innerHTML = '<div class="name">📅 كشف يوم: <span dir="ltr">' + esc(d.date) + '</span></div>';

    stats.innerHTML =
      '<div class="stat-box paid"><div class="lbl">الإيرادات</div><div class="val">' + d.totalIncome.toLocaleString('en-US') + '</div></div>' +
      '<div class="stat-box credit"><div class="lbl">المصروفات</div><div class="val">' + d.totalExpense.toLocaleString('en-US') + '</div></div>' +
      '<div class="stat-box balance" style="grid-column:1/-1;"><div class="lbl">الصافي</div><div class="val">' + d.balance.toLocaleString('en-US') + ' ر.ي</div></div>';
  } else if (statementData.type === 'month') {
    const d = statementData;
    info.innerHTML = '<div class="name">📆 كشف شهر: <span dir="ltr">' + esc(d.month) + '</span></div>';

    stats.innerHTML =
      '<div class="stat-box paid"><div class="lbl">الإيرادات</div><div class="val">' + d.totalIncome.toLocaleString('en-US') + '</div></div>' +
      '<div class="stat-box credit"><div class="lbl">المصروفات</div><div class="val">' + d.totalExpense.toLocaleString('en-US') + '</div></div>' +
      '<div class="stat-box balance" style="grid-column:1/-1;"><div class="lbl">الصافي</div><div class="val">' + d.balance.toLocaleString('en-US') + ' ر.ي</div></div>';
  }

  // قائمة الحركات
  if (statementData.transactions.length === 0) {
    list.innerHTML = '<div class="empty-state">لا توجد حركات</div>';
    return;
  }

  list.innerHTML = statementData.transactions.map(function(t) {
    const isPayment = t.type === 'payment';
    const sign = isPayment ? '+' : '−';
    const label = isPayment ? '✅ دخل / دفعة' : '🔴 دين / مصروف';
    const time = t.time ? new Date(t.time).toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' }) : '';

    return '<div class="tx-item ' + t.type + '">' +
      '<div class="row1">' +
        '<span class="type">' + label + '</span>' +
        '<span class="date"><span dir="ltr">' + t.date + '</span>' + (time ? ' · ' + time : '') + '</span>' +
      '</div>' +
      '<div class="desc">' + esc(t.description) + '</div>' +
      '<div class="amount">' + sign + ' ' + t.amount.toLocaleString('en-US') + ' ر.ي</div>' +
    '</div>';
  }).join('');
}

// ===== الطباعة =====
function printThermal() {
  document.body.classList.add('print-thermal');
  setTimeout(function() {
    window.print();
    setTimeout(function() { document.body.classList.remove('print-thermal'); }, 500);
  }, 100);
}

function printA4() {
  document.body.classList.remove('print-thermal');
  setTimeout(function() { window.print(); }, 100);
}

// ===== مشاركة كصورة =====
async function shareAsImage() {
  const box = document.getElementById('statementBox');
  const actions = document.querySelector('.actions');
  const backBtn = document.querySelector('.back-btn');
  const pageTitle = document.querySelector('.page-title');

  if (actions) actions.style.display = 'none';
  if (backBtn) backBtn.style.display = 'none';
  if (pageTitle) pageTitle.style.display = 'none';

  try {
    const canvas = await html2canvas(box, {
      scale: 3,
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: true,
      imageTimeout: 0,
      logging: false
    });

    if (actions) actions.style.display = '';
    if (backBtn) backBtn.style.display = '';
    if (pageTitle) pageTitle.style.display = '';

    const blob = await new Promise(function(r) { canvas.toBlob(r, 'image/png'); });
    const file = new File([blob], 'statement-' + Date.now() + '.png', { type: 'image/png' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'كشف حساب',
        text: 'كشف حساب'
      });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'statement-' + Date.now() + '.png';
      a.click();
      URL.revokeObjectURL(url);
      alert('✅ تم تنزيل الصورة');
    }
  } catch(e) {
    console.error(e);
    if (actions) actions.style.display = '';
    if (backBtn) backBtn.style.display = '';
    if (pageTitle) pageTitle.style.display = '';
    alert('⚠️ فشل: ' + e.message);
  }
}

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t || '';
  return d.innerHTML;
}
