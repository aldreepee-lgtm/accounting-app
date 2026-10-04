// ===== منطق إغلاق اليوم =====

let currentUser = null;
let todayStr = '';
let isClosed = false;

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();

  const userJson = localStorage.getItem('currentUser');
  if (!userJson) { window.location.href = 'index.html'; return; }
  currentUser = JSON.parse(userJson);

  // فقط المالك يمكنه إغلاق اليوم
  if (currentUser.role !== 'owner') {
    alert('هذه الصفحة مخصصة للمالك فقط');
    window.location.href = 'app.html';
    return;
  }

  todayStr = getTodayStr();
  const weekday = new Date().toLocaleDateString('ar-EG', { weekday: 'long' });

  document.getElementById('dayDate').textContent = todayStr;
  document.getElementById('dayWeekday').textContent = weekday;

  await loadCurrency();
  await refreshView();
  await loadHistory();
});

function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function loadCurrency() {
  const cur = await get('settings', 'currency');
  if (cur && cur.value) {
    document.getElementById('currencyLabel').textContent = cur.value;
  }
}

// حساب الرصيد الافتتاحي = آخر إغلاق (قبل اليوم) أو الرصيد الأولي
async function getOpeningBalance() {
  const closings = await getAll('daily_closings');
  const pastClosings = closings.filter(c => c.date < todayStr).sort((a, b) => b.date.localeCompare(a.date));
  if (pastClosings.length > 0) {
    return pastClosings[0].closingBalance;
  }
  const initial = await get('settings', 'openingBalance');
  return initial ? (parseInt(initial.value) || 0) : 0;
}

async function refreshView() {
  const opening = await getOpeningBalance();
  document.getElementById('openingBalance').textContent = opening.toLocaleString('en-US');

  const all = await getAll('transactions');
  const todayTx = all.filter(t => t.date === todayStr);

  // تجميع حسب النوع
  const sum = {
    income: 0, expense: 0, purchase: 0,
    owner_withdraw: 0, owner_personal: 0, worker_salary: 0
  };
  todayTx.forEach(t => {
    const a = parseInt(t.amount) || 0;
    if (sum[t.type] !== undefined) sum[t.type] += a;
  });

  // بناء تفصيل
  const bd = document.getElementById('breakdownBody');
  bd.innerHTML = `
    <div class="breakdown-row income">
      <span class="row-label">➕ الإيرادات</span>
      <span class="row-amount">+${sum.income.toLocaleString('en-US')}</span>
    </div>
    <div class="breakdown-row expense">
      <span class="row-label">➖ مصروفات المكتب</span>
      <span class="row-amount">−${sum.expense.toLocaleString('en-US')}</span>
    </div>
    <div class="breakdown-row expense">
      <span class="row-label">🛒 المشتريات</span>
      <span class="row-amount">−${sum.purchase.toLocaleString('en-US')}</span>
    </div>
    <div class="breakdown-row expense">
      <span class="row-label">💼 مسحوبات المالك</span>
      <span class="row-amount">−${sum.owner_withdraw.toLocaleString('en-US')}</span>
    </div>
    <div class="breakdown-row expense">
      <span class="row-label">🏠 مصروفات شخصية</span>
      <span class="row-amount">−${sum.owner_personal.toLocaleString('en-US')}</span>
    </div>
  `;

  const totalIncome = sum.income;
  const totalExpense = sum.expense + sum.purchase + sum.owner_withdraw + sum.owner_personal;
  const closing = opening + totalIncome - totalExpense;

  document.getElementById('closingBalance').textContent = closing.toLocaleString('en-US');

  const card = document.getElementById('closingCard');
  if (closing < 0) card.classList.add('negative');
  else card.classList.remove('negative');

  // فحص هل اليوم مُغلق مسبقاً
  const todayClosing = await get('daily_closings', todayStr);
  isClosed = !!todayClosing;

  const statusBadge = document.getElementById('statusBadge');
  const btn = document.getElementById('closeBtn');
  const msg = document.getElementById('msgBox');

  if (isClosed) {
    statusBadge.className = 'status-badge closed';
    statusBadge.textContent = '✅ مُغلق';
    btn.disabled = true;
    btn.textContent = '🔒 اليوم مُغلق مسبقاً';
    msg.className = 'msg-box info';
    msg.textContent = 'هذا اليوم أُغلق بتاريخ ' + new Date(todayClosing.closedAt).toLocaleString('ar-EG');
  } else {
    statusBadge.className = 'status-badge open';
    statusBadge.textContent = 'مفتوح';
    btn.disabled = false;
    btn.textContent = '🔒 إغلاق اليوم وترحيل الرصيد';
    msg.className = '';
    msg.textContent = '';
  }
}

async function confirmClose() {
  if (isClosed) return;

  if (!confirm('هل أنت متأكد من إغلاق اليوم؟\n\nسيتم تثبيت الرصيد الختامي وترحيله لليوم التالي.\n\nلا يمكن التراجع إلا بحذف الإغلاق.')) {
    return;
  }

  try {
    const opening = await getOpeningBalance();
    const all = await getAll('transactions');
    const todayTx = all.filter(t => t.date === todayStr);

    const sum = {
      income: 0, expense: 0, purchase: 0,
      owner_withdraw: 0, owner_personal: 0, worker_salary: 0
    };
    todayTx.forEach(t => {
      const a = parseInt(t.amount) || 0;
      if (sum[t.type] !== undefined) sum[t.type] += a;
    });

    const totalIncome = sum.income;
    const totalExpense = sum.expense + sum.purchase + sum.owner_withdraw + sum.owner_personal;
    const closing = opening + totalIncome - totalExpense;

    const record = {
      date: todayStr,
      openingBalance: opening,
      totalIncome,
      totalExpense,
      details: sum,
      transactionCount: todayTx.length,
      closingBalance: closing,
      closedAt: new Date().toISOString(),
      closedBy: currentUser.username
    };

    await put('daily_closings', record);

    alert('✅ تم إغلاق اليوم بنجاح!\n\nالرصيد الختامي: ' + closing.toLocaleString('en-US') + '\n\nتم ترحيله كرصيد افتتاحي لليوم التالي.');

    await refreshView();
    await loadHistory();

  } catch (err) {
    console.error(err);
    alert('خطأ أثناء الإغلاق: ' + err.message);
  }
}

async function loadHistory() {
  const closings = await getAll('daily_closings');
  const sorted = closings.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

  const list = document.getElementById('historyList');
  if (sorted.length === 0) {
    list.innerHTML = '<div class="empty-msg">لا توجد إغلاقات سابقة بعد</div>';
    return;
  }

  list.innerHTML = '';
  sorted.forEach(c => {
    const div = document.createElement('div');
    div.className = 'history-item';
    const time = new Date(c.closedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `
      <div>
        <div class="h-date">📅 ${c.date}</div>
        <div class="h-meta">${c.transactionCount} حركة — أُغلق ${time} بواسطة ${c.closedBy}</div>
      </div>
      <div class="h-balance">${c.closingBalance.toLocaleString('en-US')}</div>
    `;
    list.appendChild(div);
  });
}
