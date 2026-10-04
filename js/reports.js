// ===== منطق التقارير (6 أنواع) =====

let currentTab = 'daily';
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  const userJson = localStorage.getItem('currentUser');
  if (!userJson) { window.location.href = 'index.html'; return; }
  currentUser = JSON.parse(userJson);
  if (currentUser.role !== 'owner') { alert('هذه الصفحة للمالك فقط'); window.location.href = 'app.html'; return; }

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  const today = new Date();
  document.getElementById('dateInput').value = fmtDate(today);

  await runReport();
});

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

  const dateInput = document.getElementById('dateInput');
  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');
  const filterLabel = document.getElementById('filterLabel');
  const filterBar = document.getElementById('filterBar');

  // إخفاء كل الحقول أولاً
  dateInput.style.display = 'none';
  dateFrom.style.display = 'none';
  dateTo.style.display = 'none';

  if (tab === 'daily') {
    filterLabel.textContent = 'التاريخ:';
    dateInput.type = 'date';
    dateInput.style.display = 'block';
    if (!dateInput.value) dateInput.value = fmtDate(new Date());
  } else if (tab === 'monthly') {
    filterLabel.textContent = 'الشهر:';
    dateInput.type = 'month';
    dateInput.style.display = 'block';
    const now = new Date();
    dateInput.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  } else if (tab === 'cash') {
    filterLabel.textContent = 'من:';
    dateInput.type = 'month';
    dateInput.style.display = 'block';
    const now = new Date();
    dateInput.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  } else if (tab === 'bytype') {
    filterLabel.textContent = 'من:';
    dateFrom.style.display = 'block';
    dateTo.style.display = 'block';
    if (!dateFrom.value) {
      const d = new Date(); d.setDate(1);
      dateFrom.value = fmtDate(d);
      dateTo.value = fmtDate(new Date());
    }
  } else if (tab === 'withdrawals') {
    filterLabel.textContent = 'من:';
    dateFrom.style.display = 'block';
    dateTo.style.display = 'block';
    if (!dateFrom.value) {
      const d = new Date(); d.setDate(1);
      dateFrom.value = fmtDate(d);
      dateTo.value = fmtDate(new Date());
    }
  } else if (tab === 'profit') {
    filterLabel.textContent = 'من:';
    dateFrom.style.display = 'block';
    dateTo.style.display = 'block';
    if (!dateFrom.value) {
      const d = new Date(); d.setDate(1);
      dateFrom.value = fmtDate(d);
      dateTo.value = fmtDate(new Date());
    }
  } else if (tab === 'inventory') {
    filterBar.style.display = 'none';
  }

  if (tab !== 'inventory') filterBar.style.display = 'flex';

  runReport();
}

async function runReport() {
  const all = await getAll('transactions');
  const statsRow = document.getElementById('statsRow');
  const emptyMsg = document.getElementById('emptyMsg');
  const tableWrap = document.getElementById('tableWrap');
  const tableHead = document.getElementById('tableHead');
  const tbody = document.getElementById('reportBody');
  const extraArea = document.getElementById('extraArea');
  extraArea.innerHTML = '';

  let filtered = [];
  let titleText = '';

  // ============== يومي ==============
  if (currentTab === 'daily') {
    const d = document.getElementById('dateInput').value;
    filtered = all.filter(t => t.date === d);
    titleText = '📋 حركات يوم ' + d;
    tableHead.innerHTML = '<tr><th>التاريخ</th><th>النوع</th><th>الوصف</th><th>المبلغ</th></tr>';
    buildStats(filtered);
    buildTxTable(filtered, tbody, tableWrap, emptyMsg);
  }
  // ============== شهري ==============
  else if (currentTab === 'monthly') {
    const m = document.getElementById('dateInput').value;
    filtered = all.filter(t => t.date && t.date.startsWith(m));
    titleText = '📋 حركات شهر ' + m;
    tableHead.innerHTML = '<tr><th>التاريخ</th><th>النوع</th><th>الوصف</th><th>المبلغ</th></tr>';
    buildStats(filtered);
    buildTxTable(filtered, tbody, tableWrap, emptyMsg);
  }
  // ============== الصندوق ==============
  else if (currentTab === 'cash') {
    const m = document.getElementById('dateInput').value;
    titleText = '💰 حركة الصندوق لشهر ' + m;
    const dailyData = await buildCashData(all, m);
    buildCashStats(dailyData);
    tableHead.innerHTML = '<tr><th>التاريخ</th><th>افتتاحي</th><th>إيرادات</th><th>مصروفات</th><th>ختامي</th></tr>';
    buildCashTable(dailyData, tbody, tableWrap, emptyMsg);
  }
  // ============== حسب النوع ==============
  else if (currentTab === 'bytype') {
    const from = document.getElementById('dateFrom').value;
    const to = document.getElementById('dateTo').value;
    filtered = all.filter(t => t.date >= from && t.date <= to);
    titleText = '📊 حركات من ' + from + ' إلى ' + to;
    tableWrap.style.display = 'none';
    emptyMsg.style.display = filtered.length === 0 ? 'block' : 'none';
    buildTypeBreakdown(filtered, extraArea);
  }
  // ============== المسحوبات ==============
  else if (currentTab === 'withdrawals') {
    const from = document.getElementById('dateFrom').value;
    const to = document.getElementById('dateTo').value;
    filtered = all.filter(t => t.date >= from && t.date <= to && (t.type === 'owner_withdraw' || t.type === 'owner_personal'));
    titleText = '💼 مسحوبات ومصروفات المالك من ' + from + ' إلى ' + to;
    tableHead.innerHTML = '<tr><th>التاريخ</th><th>النوع</th><th>الوصف</th><th>المبلغ</th></tr>';
    buildWithdrawStats(filtered);
    buildTxTable(filtered, tbody, tableWrap, emptyMsg);
  }
  // ============== المخزون ==============
  else if (currentTab === 'profit') {
    const from = document.getElementById('dateFrom').value;
    const to = document.getElementById('dateTo').value;
    titleText = '💰 تقرير الأرباح من ' + from + ' إلى ' + to;
    filtered = all.filter(t => t.date >= from && t.date <= to);
    buildProfitReport(filtered, statsRow, tbody, tableWrap, emptyMsg, tableHead);
    document.getElementById('tableTitle').textContent = titleText;
    return;
  }
  else if (currentTab === 'inventory') {
    titleText = '📦 تقرير المخزون';
    await buildInventoryReport(statsRow, tbody, tableWrap, emptyMsg, tableHead);
    document.getElementById('tableTitle').textContent = titleText;
    return;
  }

  document.getElementById('tableTitle').textContent = titleText;
}

// ===== إحصائيات عامة =====
function buildStats(list) {
  let income = 0, expense = 0;
  list.forEach(t => {
    const a = parseInt(t.amount) || 0;
    if (t.type === 'income') income += a;
    else expense += a;
  });
  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card income"><div class="stat-label">الإيرادات</div><div class="stat-value">${income.toLocaleString('en-US')}</div></div>
    <div class="stat-card expense"><div class="stat-label">المصروفات</div><div class="stat-value">${expense.toLocaleString('en-US')}</div></div>
    <div class="stat-card balance"><div class="stat-label">الصافي</div><div class="stat-value">${(income-expense).toLocaleString('en-US')}</div></div>
    <div class="stat-card count"><div class="stat-label">عدد الحركات</div><div class="stat-value">${list.length}</div></div>
  `;
}

// ===== إحصائيات المسحوبات =====
function buildWithdrawStats(list) {
  let w = 0, p = 0;
  list.forEach(t => {
    const a = parseInt(t.amount) || 0;
    if (t.type === 'owner_withdraw') w += a;
    else p += a;
  });
  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card expense"><div class="stat-label">مسحوبات المالك</div><div class="stat-value">${w.toLocaleString('en-US')}</div></div>
    <div class="stat-card expense"><div class="stat-label">مصروفات شخصية</div><div class="stat-value">${p.toLocaleString('en-US')}</div></div>
    <div class="stat-card count"><div class="stat-label">الإجمالي</div><div class="stat-value">${(w+p).toLocaleString('en-US')}</div></div>
    <div class="stat-card"><div class="stat-label">عدد الحركات</div><div class="stat-value" style="color:#6a1b9a;">${list.length}</div></div>
  `;
}

// ===== جدول الحركات =====
function buildTxTable(list, tbody, tableWrap, emptyMsg) {
  if (list.length === 0) {
    tableWrap.style.display = 'none';
    emptyMsg.style.display = 'block';
    return;
  }
  tableWrap.style.display = 'block';
  emptyMsg.style.display = 'none';
  const labels = { income:'إيراد', expense:'مصروف', purchase:'مشترى', owner_withdraw:'مسحوبات', owner_personal:'شخصي' };
  list.sort((a,b) => (b.time||'').localeCompare(a.time||''));
  tbody.innerHTML = list.map(t => {
    const amt = parseInt(t.amount) || 0;
    const inc = t.type === 'income';
    return `<tr>
      <td>${t.date}</td>
      <td><span class="type-badge ${t.type}">${labels[t.type]||t.type}</span></td>
      <td>${esc(t.description||'—')}</td>
      <td class="amount ${inc?'income':'expense'}">${inc?'+':'−'}${amt.toLocaleString('en-US')}</td>
    </tr>`;
  }).join('');
}

// ===== بيانات الصندوق =====
async function buildCashData(all, month) {
  const closings = await getAll('daily_closings');
  const dates = new Set();
  all.forEach(t => { if (t.date && t.date.startsWith(month)) dates.add(t.date); });
  closings.forEach(c => { if (c.date && c.date.startsWith(month)) dates.add(c.date); });
  const sorted = Array.from(dates).sort();

  const initial = await get('settings', 'openingBalance');
  let runningBalance = initial ? (parseInt(initial.value)||0) : 0;

  // نبدأ من أول الشهر: نجد آخر إغلاق قبل بداية الشهر
  const monthStart = month + '-01';
  const beforeClosings = closings.filter(c => c.date < monthStart).sort((a,b) => b.date.localeCompare(a.date));
  if (beforeClosings.length > 0) runningBalance = beforeClosings[0].closingBalance;

  const rows = [];
  for (const date of sorted) {
    const dayTx = all.filter(t => t.date === date);
    let inc = 0, exp = 0;
    dayTx.forEach(t => {
      const a = parseInt(t.amount)||0;
      if (t.type === 'income') inc += a; else exp += a;
    });
    const opening = runningBalance;
    const closing = opening + inc - exp;
    rows.push({ date, opening, income: inc, expense: exp, closing });
    runningBalance = closing;
  }
  return rows;
}

function buildCashStats(rows) {
  const totalInc = rows.reduce((s,r) => s+r.income, 0);
  const totalExp = rows.reduce((s,r) => s+r.expense, 0);
  const lastClose = rows.length > 0 ? rows[rows.length-1].closing : 0;
  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card income"><div class="stat-label">إجمالي الإيرادات</div><div class="stat-value">${totalInc.toLocaleString('en-US')}</div></div>
    <div class="stat-card expense"><div class="stat-label">إجمالي المصروفات</div><div class="stat-value">${totalExp.toLocaleString('en-US')}</div></div>
    <div class="stat-card balance"><div class="stat-label">الرصيد النهائي</div><div class="stat-value">${lastClose.toLocaleString('en-US')}</div></div>
    <div class="stat-card count"><div class="stat-label">عدد الأيام</div><div class="stat-value">${rows.length}</div></div>
  `;
}

function buildCashTable(rows, tbody, tableWrap, emptyMsg) {
  if (rows.length === 0) { tableWrap.style.display = 'none'; emptyMsg.style.display = 'block'; return; }
  tableWrap.style.display = 'block'; emptyMsg.style.display = 'none';
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${r.opening.toLocaleString('en-US')}</td>
      <td class="amount income">+${r.income.toLocaleString('en-US')}</td>
      <td class="amount expense">−${r.expense.toLocaleString('en-US')}</td>
      <td style="font-weight:800;color:${r.closing<0?'#c62828':'#1565c0'};">${r.closing.toLocaleString('en-US')}</td>
    </tr>
  `).join('');
}

// ===== حسب النوع =====
function buildTypeBreakdown(list, area) {
  const sums = {
    income_service: 0, income_product: 0,
    expense: {}, purchase: 0,
    owner_withdraw: 0, owner_personal: {}
  };
  list.forEach(t => {
    const a = parseInt(t.amount)||0;
    if (t.type === 'income') {
      if (t.incomeType === 'product') sums.income_product += a;
      else sums.income_service += a;
    } else if (t.type === 'expense') {
      sums.expense[t.category||'أخرى'] = (sums.expense[t.category||'أخرى']||0) + a;
    } else if (t.type === 'purchase') {
      sums.purchase += a;
    } else if (t.type === 'owner_withdraw') {
      sums.owner_withdraw += a;
    } else if (t.type === 'owner_personal') {
      sums.owner_personal[t.category||'أخرى'] = (sums.owner_personal[t.category||'أخرى']||0) + a;
    }
  });

  let html = '';

  // الإيرادات
  html += `<div class="type-block"><h3 style="color:#2e7d32;">➕ الإيرادات</h3>`;
  html += `<div class="row"><span>خدمات (طباعة، تصوير...)</span><span>${sums.income_service.toLocaleString('en-US')}</span></div>`;
  html += `<div class="row"><span>بيع منتجات المخزون</span><span>${sums.income_product.toLocaleString('en-US')}</span></div>`;
  html += `<div class="row total"><span>إجمالي الإيرادات</span><span>${(sums.income_service+sums.income_product).toLocaleString('en-US')}</span></div></div>`;

  // مصروفات المكتب
  html += `<div class="type-block"><h3 style="color:#c62828;">➖ مصروفات المكتب</h3>`;
  const expTotal = Object.values(sums.expense).reduce((s,v) => s+v, 0);
  if (Object.keys(sums.expense).length === 0) html += `<div class="row"><span>لا توجد</span><span>0</span></div>`;
  else for (const k in sums.expense) html += `<div class="row"><span>${esc(k)}</span><span>${sums.expense[k].toLocaleString('en-US')}</span></div>`;
  html += `<div class="row total"><span>إجمالي مصروفات المكتب</span><span>${expTotal.toLocaleString('en-US')}</span></div></div>`;

  // المشتريات
  html += `<div class="type-block"><h3 style="color:#e65100;">🛒 المشتريات</h3>`;
  html += `<div class="row total"><span>إجمالي المشتريات</span><span>${sums.purchase.toLocaleString('en-US')}</span></div></div>`;

  // مسحوبات المالك
  html += `<div class="type-block"><h3 style="color:#6a1b9a;">💼 مسحوبات المالك</h3>`;
  html += `<div class="row total"><span>إجمالي المسحوبات</span><span>${sums.owner_withdraw.toLocaleString('en-US')}</span></div></div>`;

  // مصروفات شخصية
  html += `<div class="type-block"><h3 style="color:#4e342e;">🏠 المصروفات الشخصية</h3>`;
  const perTotal = Object.values(sums.owner_personal).reduce((s,v) => s+v, 0);
  if (Object.keys(sums.owner_personal).length === 0) html += `<div class="row"><span>لا توجد</span><span>0</span></div>`;
  else for (const k in sums.owner_personal) html += `<div class="row"><span>${esc(k)}</span><span>${sums.owner_personal[k].toLocaleString('en-US')}</span></div>`;
  html += `<div class="row total"><span>إجمالي المصروفات الشخصية</span><span>${perTotal.toLocaleString('en-US')}</span></div></div>`;

  // ملخص نهائي
  const netIncome = sums.income_service + sums.income_product;
  const netExpense = expTotal + sums.purchase;
  html += `<div class="type-block" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;">
    <h3 style="color:#fff;border-color:rgba(255,255,255,0.3);">🎯 صافي المكتب (بدون المسحوبات)</h3>
    <div class="row" style="color:#fff;"><span>الإيرادات</span><span>${netIncome.toLocaleString('en-US')}</span></div>
    <div class="row" style="color:#fff;"><span>المصروفات (مكتب + مشتريات)</span><span>${netExpense.toLocaleString('en-US')}</span></div>
    <div class="row total" style="color:#fff;border-color:rgba(255,255,255,0.3);"><span>الصافي</span><span>${(netIncome-netExpense).toLocaleString('en-US')}</span></div>
  </div>`;

  area.innerHTML = html;
  document.getElementById('tableWrap').style.display = 'none';
}

// ===== تقرير المخزون =====
async function buildInventoryReport(statsRow, tbody, tableWrap, emptyMsg, tableHead) {
  const products = await getAll('inventory');
  products.sort((a,b) => a.name.localeCompare(b.name, 'ar'));

  const kinds = products.length;
  const totalQty = products.reduce((s,p) => s+(parseInt(p.quantity)||0), 0);
  const totalValue = products.reduce((s,p) => {
    const q = parseInt(p.quantity)||0;
    const pr = parseInt(p.lastPurchasePrice)||0;
    return s + (q*pr);
  }, 0);

  statsRow.innerHTML = `
    <div class="stat-card"><div class="stat-label">عدد الأصناف</div><div class="stat-value" style="color:#2196f3;">${kinds}</div></div>
    <div class="stat-card"><div class="stat-label">إجمالي القطع</div><div class="stat-value" style="color:#2a5298;">${totalQty.toLocaleString('en-US')}</div></div>
    <div class="stat-card income"><div class="stat-label">قيمة المخزون</div><div class="stat-value">${totalValue.toLocaleString('en-US')}</div></div>
  `;

  if (products.length === 0) {
    tableWrap.style.display = 'none';
    emptyMsg.style.display = 'block';
    return;
  }

  tableWrap.style.display = 'block';
  emptyMsg.style.display = 'none';
  tableHead.innerHTML = '<tr><th>المنتج</th><th>الكمية</th><th>آخر سعر شراء</th><th>القيمة</th></tr>';
  tbody.innerHTML = products.map(p => {
    const q = parseInt(p.quantity)||0;
    const pr = parseInt(p.lastPurchasePrice)||0;
    return `<tr>
      <td>${esc(p.name)}</td>
      <td style="font-weight:700;color:${q===0?'#c62828':(q<=3?'#e65100':'#1565c0')};">${q}</td>
      <td>${pr.toLocaleString('en-US')}</td>
      <td class="amount">${(q*pr).toLocaleString('en-US')}</td>
    </tr>`;
  }).join('');
}

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t || '';
  return d.innerHTML;
}
