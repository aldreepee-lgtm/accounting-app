// ===== منطق التقارير =====

let currentTab = 'daily';
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  const uj = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
  if (!uj) { window.location.href = 'index.html'; return; }
  currentUser = JSON.parse(uj);

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  const today = new Date();
  document.getElementById('dateInput').value = fmtDate(today);

  await runReport();
});

function fmtDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

  const di = document.getElementById('dateInput');
  const df = document.getElementById('dateFrom');
  const dt = document.getElementById('dateTo');
  const fl = document.getElementById('filterLabel');
  const fb = document.getElementById('filterBar');

  di.style.display = 'none';
  df.style.display = 'none';
  dt.style.display = 'none';
  fb.style.display = 'flex';

  if (tab === 'daily') {
    fl.textContent = 'التاريخ:';
    di.type = 'date';
    di.style.display = 'block';
    if (!di.value) di.value = fmtDate(new Date());
  } else if (tab === 'monthly' || tab === 'cash' || tab === 'charts') {
    fl.textContent = 'الشهر:';
    di.type = 'month';
    di.style.display = 'block';
    const now = new Date();
    di.value = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  } else if (tab === 'bytype' || tab === 'withdrawals' || tab === 'profit' || tab === 'salary') {
    fl.textContent = 'من:';
    df.style.display = 'block';
    dt.style.display = 'block';
    if (!df.value) {
      const d = new Date(); d.setDate(1);
      df.value = fmtDate(d);
      dt.value = fmtDate(new Date());
    }
  } else if (tab === 'inventory') {
    fb.style.display = 'none';
  }

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
  const cc = document.getElementById('chartsContainer');
  if (cc) cc.style.display = 'none';
  extraArea.innerHTML = '';

  let filtered = [];
  let titleText = '';

  if (currentTab === 'daily') {
    const d = document.getElementById('dateInput').value;
    filtered = all.filter(t => t.date === d);
    titleText = 'حركات يوم ' + d;
    tableHead.innerHTML = '<tr><th>التاريخ</th><th>النوع</th><th>الوصف</th><th>المبلغ</th></tr>';
    buildStats(filtered, statsRow);
    buildTxTable(filtered, tbody, tableWrap, emptyMsg);
  }
  else if (currentTab === 'monthly') {
    const m = document.getElementById('dateInput').value;
    filtered = all.filter(t => t.date && t.date.startsWith(m));
    titleText = 'حركات شهر ' + m;
    tableHead.innerHTML = '<tr><th>التاريخ</th><th>النوع</th><th>الوصف</th><th>المبلغ</th></tr>';
    buildStats(filtered, statsRow);
    buildTxTable(filtered, tbody, tableWrap, emptyMsg);
  }
  else if (currentTab === 'cash') {
    const m = document.getElementById('dateInput').value;
    titleText = 'حركة الصندوق لشهر ' + m;
    const rows = await buildCashData(all, m);
    buildCashStats(rows, statsRow);
    tableHead.innerHTML = '<tr><th>التاريخ</th><th>افتتاحي</th><th>إيرادات</th><th>مصروفات</th><th>ختامي</th></tr>';
    buildCashTable(rows, tbody, tableWrap, emptyMsg);
  }
  else if (currentTab === 'bytype') {
    const from = document.getElementById('dateFrom').value;
    const to = document.getElementById('dateTo').value;
    filtered = all.filter(t => t.date >= from && t.date <= to);
    titleText = 'حركات من ' + from + ' إلى ' + to;
    tableWrap.style.display = 'none';
    emptyMsg.style.display = filtered.length === 0 ? 'block' : 'none';
    emptyMsg.textContent = 'لا توجد بيانات';
    buildTypeBreakdown(filtered, extraArea);
  }
  else if (currentTab === 'withdrawals') {
    const from = document.getElementById('dateFrom').value;
    const to = document.getElementById('dateTo').value;
    filtered = all.filter(t => t.date >= from && t.date <= to && (t.type === 'owner_withdraw' || t.type === 'owner_personal'));
    titleText = 'مسحوبات ومصروفات المالك';
    tableHead.innerHTML = '<tr><th>التاريخ</th><th>النوع</th><th>الوصف</th><th>المبلغ</th></tr>';
    buildWithdrawStats(filtered, statsRow);
    buildTxTable(filtered, tbody, tableWrap, emptyMsg);
  }
  else if (currentTab === 'profit') {
    const from = document.getElementById('dateFrom').value;
    const to = document.getElementById('dateTo').value;
    filtered = all.filter(t => t.date >= from && t.date <= to);
    titleText = 'تقرير الأرباح';
    tableHead.innerHTML = '<tr><th>المنتج</th><th>الكمية</th><th>الإيراد</th><th>التكلفة</th><th>الربح</th></tr>';
    buildProfitReport(filtered, statsRow, tbody, tableWrap, emptyMsg);
  }
  else if (currentTab === 'salary') {
    const from = document.getElementById('dateFrom').value;
    const to = document.getElementById('dateTo').value;
    filtered = all.filter(t => t.type === 'worker_salary' && t.date >= from && t.date <= to);
    titleText = 'تقرير الرواتب';
    tableHead.innerHTML = '<tr><th>التاريخ</th><th>العامل</th><th>الشهر</th><th>المبلغ</th></tr>';
    buildSalaryReport(filtered, statsRow, tbody, tableWrap, emptyMsg);
  }
  else if (currentTab === 'charts') {
    const m = document.getElementById('dateInput').value;
    titleText = 'المخططات - شهر ' + m;
    tableWrap.style.display = 'none';
    emptyMsg.style.display = 'none';
    statsRow.innerHTML = '';
    if (cc) cc.style.display = 'block';
    await buildCharts(all, m);
  }
  else if (currentTab === 'inventory') {
    titleText = 'تقرير المخزون';
    await buildInventoryReport(statsRow, tbody, tableWrap, emptyMsg, tableHead);
  }

  window.__lastFilteredTx = filtered;
  document.getElementById('tableTitle').textContent = titleText;
}

// ===== إحصائيات عامة =====
function buildStats(list, statsRow) {
  let inc = 0, exp = 0;
  list.forEach(t => {
    const a = parseInt(t.amount) || 0;
    if (t.type === 'income') inc += a; else exp += a;
  });
  statsRow.innerHTML =
    '<div class="stat-card income"><div class="stat-label">الإيرادات</div><div class="stat-value">' + inc.toLocaleString('en-US') + '</div></div>' +
    '<div class="stat-card expense"><div class="stat-label">المصروفات</div><div class="stat-value">' + exp.toLocaleString('en-US') + '</div></div>' +
    '<div class="stat-card balance"><div class="stat-label">الصافي</div><div class="stat-value">' + (inc-exp).toLocaleString('en-US') + '</div></div>' +
    '<div class="stat-card count"><div class="stat-label">عدد الحركات</div><div class="stat-value">' + list.length + '</div></div>';
}

function buildWithdrawStats(list, statsRow) {
  let w = 0, p = 0;
  list.forEach(t => {
    const a = parseInt(t.amount) || 0;
    if (t.type === 'owner_withdraw') w += a; else p += a;
  });
  statsRow.innerHTML =
    '<div class="stat-card expense"><div class="stat-label">مسحوبات المالك</div><div class="stat-value">' + w.toLocaleString('en-US') + '</div></div>' +
    '<div class="stat-card expense"><div class="stat-label">مصروفات شخصية</div><div class="stat-value">' + p.toLocaleString('en-US') + '</div></div>' +
    '<div class="stat-card count"><div class="stat-label">الإجمالي</div><div class="stat-value">' + (w+p).toLocaleString('en-US') + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">عدد الحركات</div><div class="stat-value" style="color:#6a1b9a;">' + list.length + '</div></div>';
}

// ===== جدول الحركات =====
function buildTxTable(list, tbody, tableWrap, emptyMsg) {
  if (list.length === 0) {
    tableWrap.style.display = 'none';
    emptyMsg.style.display = 'block';
    emptyMsg.textContent = 'لا توجد حركات في هذه الفترة';
    return;
  }
  tableWrap.style.display = 'block';
  emptyMsg.style.display = 'none';
  const labels = { income:'إيراد', expense:'مصروف', purchase:'مشترى', owner_withdraw:'مسحوبات', owner_personal:'شخصي', worker_salary:'راتب' };
  list.sort((a,b) => (b.time||'').localeCompare(a.time||''));
  tbody.innerHTML = list.map(t => {
    const amt = parseInt(t.amount) || 0;
    const inc = t.type === 'income';
    return '<tr><td>' + t.date + '</td><td><span class="type-badge ' + t.type + '">' + (labels[t.type]||t.type) + '</span></td><td>' + esc(t.description||'—') + '</td><td class="amount ' + (inc?'income':'expense') + '">' + (inc?'+':'−') + amt.toLocaleString('en-US') + '</td></tr>';
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
  let running = initial ? (parseInt(initial.value)||0) : 0;

  const monthStart = month + '-01';
  const beforeClosings = closings.filter(c => c.date < monthStart).sort((a,b) => b.date.localeCompare(a.date));
  if (beforeClosings.length > 0) running = beforeClosings[0].closingBalance;

  const rows = [];
  for (const date of sorted) {
    const dayTx = all.filter(t => t.date === date);
    let inc = 0, exp = 0;
    dayTx.forEach(t => {
      const a = parseInt(t.amount)||0;
      if (t.type === 'income') inc += a; else exp += a;
    });
    const opening = running;
    const closing = opening + inc - exp;
    rows.push({ date, opening, income: inc, expense: exp, closing });
    running = closing;
  }
  return rows;
}

function buildCashStats(rows, statsRow) {
  const ti = rows.reduce((s,r) => s+r.income, 0);
  const te = rows.reduce((s,r) => s+r.expense, 0);
  const last = rows.length > 0 ? rows[rows.length-1].closing : 0;
  statsRow.innerHTML =
    '<div class="stat-card income"><div class="stat-label">إجمالي الإيرادات</div><div class="stat-value">' + ti.toLocaleString('en-US') + '</div></div>' +
    '<div class="stat-card expense"><div class="stat-label">إجمالي المصروفات</div><div class="stat-value">' + te.toLocaleString('en-US') + '</div></div>' +
    '<div class="stat-card balance"><div class="stat-label">الرصيد النهائي</div><div class="stat-value">' + last.toLocaleString('en-US') + '</div></div>' +
    '<div class="stat-card count"><div class="stat-label">عدد الأيام</div><div class="stat-value">' + rows.length + '</div></div>';
}

function buildCashTable(rows, tbody, tableWrap, emptyMsg) {
  if (rows.length === 0) { tableWrap.style.display = 'none'; emptyMsg.style.display = 'block'; emptyMsg.textContent = 'لا توجد بيانات'; return; }
  tableWrap.style.display = 'block'; emptyMsg.style.display = 'none';
  tbody.innerHTML = rows.map(r =>
    '<tr><td>' + r.date + '</td><td>' + r.opening.toLocaleString('en-US') + '</td><td class="amount income">+' + r.income.toLocaleString('en-US') + '</td><td class="amount expense">−' + r.expense.toLocaleString('en-US') + '</td><td style="font-weight:800;color:' + (r.closing<0?'#c62828':'#1565c0') + ';">' + r.closing.toLocaleString('en-US') + '</td></tr>'
  ).join('');
}

// ===== حسب النوع =====
function buildTypeBreakdown(list, area) {
  const s = { income_service:0, income_product:0, expense:{}, purchase:0, owner_withdraw:0, owner_personal:{} };
  list.forEach(t => {
    const a = parseInt(t.amount)||0;
    if (t.type === 'income') { if (t.incomeType === 'product') s.income_product += a; else s.income_service += a; }
    else if (t.type === 'expense') { s.expense[t.category||'أخرى'] = (s.expense[t.category||'أخرى']||0) + a; }
    else if (t.type === 'purchase') s.purchase += a;
    else if (t.type === 'owner_withdraw') s.owner_withdraw += a;
    else if (t.type === 'owner_personal') { s.owner_personal[t.category||'أخرى'] = (s.owner_personal[t.category||'أخرى']||0) + a; }
  });

  let h = '';
  h += '<div class="type-block"><h3 style="color:#2e7d32;">➕ الإيرادات</h3>';
  h += '<div class="row"><span>خدمات</span><span>' + s.income_service.toLocaleString('en-US') + '</span></div>';
  h += '<div class="row"><span>بيع منتجات</span><span>' + s.income_product.toLocaleString('en-US') + '</span></div>';
  h += '<div class="row total"><span>إجمالي الإيرادات</span><span>' + (s.income_service+s.income_product).toLocaleString('en-US') + '</span></div></div>';

  h += '<div class="type-block"><h3 style="color:#c62828;">➖ مصروفات المكتب</h3>';
  const et = Object.values(s.expense).reduce((a,b)=>a+b,0);
  if (Object.keys(s.expense).length === 0) h += '<div class="row"><span>لا توجد</span><span>0</span></div>';
  else for (const k in s.expense) h += '<div class="row"><span>' + esc(k) + '</span><span>' + s.expense[k].toLocaleString('en-US') + '</span></div>';
  h += '<div class="row total"><span>الإجمالي</span><span>' + et.toLocaleString('en-US') + '</span></div></div>';

  h += '<div class="type-block"><h3 style="color:#e65100;">🛒 المشتريات</h3>';
  h += '<div class="row total"><span>الإجمالي</span><span>' + s.purchase.toLocaleString('en-US') + '</span></div></div>';

  h += '<div class="type-block"><h3 style="color:#6a1b9a;">💼 مسحوبات المالك</h3>';
  h += '<div class="row total"><span>الإجمالي</span><span>' + s.owner_withdraw.toLocaleString('en-US') + '</span></div></div>';

  h += '<div class="type-block"><h3 style="color:#4e342e;">🏠 مصروفات شخصية</h3>';
  const pt = Object.values(s.owner_personal).reduce((a,b)=>a+b,0);
  if (Object.keys(s.owner_personal).length === 0) h += '<div class="row"><span>لا توجد</span><span>0</span></div>';
  else for (const k in s.owner_personal) h += '<div class="row"><span>' + esc(k) + '</span><span>' + s.owner_personal[k].toLocaleString('en-US') + '</span></div>';
  h += '<div class="row total"><span>الإجمالي</span><span>' + pt.toLocaleString('en-US') + '</span></div></div>';

  const ni = s.income_service + s.income_product;
  const ne = et + s.purchase;
  h += '<div class="type-block" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;">';
  h += '<h3 style="color:#fff;border-color:rgba(255,255,255,0.3);">🎯 صافي المكتب</h3>';
  h += '<div class="row" style="color:#fff;"><span>الإيرادات</span><span>' + ni.toLocaleString('en-US') + '</span></div>';
  h += '<div class="row" style="color:#fff;"><span>المصروفات</span><span>' + ne.toLocaleString('en-US') + '</span></div>';
  h += '<div class="row total" style="color:#fff;border-color:rgba(255,255,255,0.3);"><span>الصافي</span><span>' + (ni-ne).toLocaleString('en-US') + '</span></div></div>';

  area.innerHTML = h;
}

// ===== الأرباح =====
function buildProfitReport(list, statsRow, tbody, tableWrap, emptyMsg) {
  const sales = list.filter(t => t.type === 'income' && t.incomeType === 'product');
  let rev = 0, cost = 0, profit = 0;
  const byP = {};
  sales.forEach(t => {
    const a = parseInt(t.amount) || 0;
    const c = parseInt(t.purchasePrice) || 0;
    const p = parseInt(t.profit) || (a - c);
    rev += a; cost += c; profit += p;
    const n = t.productName || 'غير معروف';
    if (!byP[n]) byP[n] = { count:0, rev:0, cost:0, profit:0 };
    byP[n].count += 1;
    byP[n].rev += a;
    byP[n].cost += c;
    byP[n].profit += p;
  });
  const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0;
  statsRow.innerHTML =
    '<div class="stat-card income"><div class="stat-label">الإيرادات</div><div class="stat-value">' + rev.toLocaleString('en-US') + '</div></div>' +
    '<div class="stat-card expense"><div class="stat-label">التكلفة</div><div class="stat-value">' + cost.toLocaleString('en-US') + '</div></div>' +
    '<div class="stat-card balance"><div class="stat-label">الربح</div><div class="stat-value">' + profit.toLocaleString('en-US') + '</div></div>' +
    '<div class="stat-card count"><div class="stat-label">هامش الربح</div><div class="stat-value">' + margin + '%</div></div>';

  if (sales.length === 0) { tableWrap.style.display = 'none'; emptyMsg.style.display = 'block'; emptyMsg.textContent = 'لا توجد مبيعات منتجات'; return; }
  tableWrap.style.display = 'block'; emptyMsg.style.display = 'none';
  const products = Object.keys(byP).sort((a,b) => byP[b].profit - byP[a].profit);
  tbody.innerHTML = products.map(n => {
    const p = byP[n];
    return '<tr><td>' + esc(n) + '</td><td style="font-weight:700;color:#1565c0;">' + p.count + '</td><td class="amount income">' + p.rev.toLocaleString('en-US') + '</td><td class="amount expense">' + p.cost.toLocaleString('en-US') + '</td><td style="font-weight:800;color:' + (p.profit>=0?'#2e7d32':'#c62828') + ';">' + p.profit.toLocaleString('en-US') + '</td></tr>';
  }).join('');
}

// ===== الرواتب =====
function buildSalaryReport(list, statsRow, tbody, tableWrap, emptyMsg) {
  let total = 0;
  const byW = {};
  list.forEach(t => {
    const a = parseInt(t.amount) || 0;
    total += a;
    const w = t.workerName || 'غير محدد';
    byW[w] = (byW[w] || 0) + a;
  });
  const wc = Object.keys(byW).length;
  statsRow.innerHTML =
    '<div class="stat-card expense"><div class="stat-label">إجمالي الرواتب</div><div class="stat-value">' + total.toLocaleString('en-US') + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">عدد العمال</div><div class="stat-value" style="color:#6a1b9a;">' + wc + '</div></div>' +
    '<div class="stat-card count"><div class="stat-label">عدد الدفعات</div><div class="stat-value">' + list.length + '</div></div>';

  if (list.length === 0) { tableWrap.style.display = 'none'; emptyMsg.style.display = 'block'; emptyMsg.textContent = 'لا توجد رواتب'; return; }
  tableWrap.style.display = 'block'; emptyMsg.style.display = 'none';
  list.sort((a,b) => (b.date||'').localeCompare(a.date||''));
  tbody.innerHTML = list.map(t =>
    '<tr><td>' + (t.date||'') + '</td><td style="font-weight:700;">' + esc(t.workerName||'غير محدد') + '</td><td>' + (t.salaryMonth||'-') + '</td><td class="amount expense">' + (parseInt(t.amount)||0).toLocaleString('en-US') + '</td></tr>'
  ).join('');
}

// ===== المخزون =====
async function buildInventoryReport(statsRow, tbody, tableWrap, emptyMsg, tableHead) {
  const products = await getAll('inventory');
  products.sort((a,b) => a.name.localeCompare(b.name, 'ar'));
  const kinds = products.length;
  const tq = products.reduce((s,p) => s+(parseInt(p.quantity)||0), 0);
  const tv = products.reduce((s,p) => s + ((parseInt(p.quantity)||0) * (parseInt(p.lastPurchasePrice)||0)), 0);
  statsRow.innerHTML =
    '<div class="stat-card"><div class="stat-label">عدد الأصناف</div><div class="stat-value" style="color:#2196f3;">' + kinds + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">إجمالي القطع</div><div class="stat-value" style="color:#2a5298;">' + tq.toLocaleString('en-US') + '</div></div>' +
    '<div class="stat-card income"><div class="stat-label">قيمة المخزون</div><div class="stat-value">' + tv.toLocaleString('en-US') + '</div></div>';

  if (products.length === 0) { tableWrap.style.display = 'none'; emptyMsg.style.display = 'block'; emptyMsg.textContent = 'لا توجد منتجات'; return; }
  tableWrap.style.display = 'block'; emptyMsg.style.display = 'none';
  tableHead.innerHTML = '<tr><th>المنتج</th><th>الكمية</th><th>آخر سعر شراء</th><th>القيمة</th></tr>';
  tbody.innerHTML = products.map(p => {
    const q = parseInt(p.quantity)||0;
    const pr = parseInt(p.lastPurchasePrice)||0;
    return '<tr><td>' + esc(p.name) + '</td><td style="font-weight:700;color:' + (q===0?'#c62828':(q<=3?'#e65100':'#1565c0')) + ';">' + q + '</td><td>' + pr.toLocaleString('en-US') + '</td><td class="amount">' + (q*pr).toLocaleString('en-US') + '</td></tr>';
  }).join('');
}

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t || '';
  return d.innerHTML;
}

// ===== المخططات البيانية =====
let chart1 = null, chart2 = null, chart3 = null;

async function buildCharts(all, month) {
  if (chart1) { chart1.destroy(); chart1 = null; }
  if (chart2) { chart2.destroy(); chart2 = null; }
  if (chart3) { chart3.destroy(); chart3 = null; }
  if (typeof Chart === 'undefined') return;
  buildMonthlyChart(all);
  buildExpensesChart(all, month);
  buildBalanceChart(all, month);
}

function buildMonthlyChart(all) {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'));
  }
  const labels = months.map(m => {
    const p = m.split('-');
    return new Date(p[0], p[1]-1, 1).toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' });
  });
  const income = months.map(m => all.filter(t => t.type === 'income' && t.date && t.date.startsWith(m)).reduce((s,t) => s + (parseInt(t.amount)||0), 0));
  const expense = months.map(m => all.filter(t => t.type !== 'income' && t.date && t.date.startsWith(m)).reduce((s,t) => s + (parseInt(t.amount)||0), 0));
  const ctx = document.getElementById('chartMonthly');
  if (!ctx) return;
  chart1 = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'الإيرادات', data: income, backgroundColor: '#4caf50' },
      { label: 'المصروفات', data: expense, backgroundColor: '#f44336' }
    ]},
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
  });
}

function buildExpensesChart(all, month) {
  const expenses = all.filter(t => t.type === 'expense' && t.date && t.date.startsWith(month));
  const cats = {};
  expenses.forEach(t => { const k = t.category || 'أخرى'; cats[k] = (cats[k]||0) + (parseInt(t.amount)||0); });
  const labels = Object.keys(cats);
  const data = Object.values(cats);
  const ctx = document.getElementById('chartExpenses');
  if (!ctx) return;
  if (labels.length === 0) {
    ctx.parentElement.innerHTML = '<h3 style="color:#2a5298;font-size:15px;margin-bottom:12px;">🥧 توزيع مصروفات المكتب</h3><div style="text-align:center;color:#999;padding:30px;">لا توجد مصروفات هذا الشهر</div>';
    return;
  }
  const colors = ['#2196f3','#4caf50','#ff9800','#f44336','#9c27b0','#795548','#607d8b','#e91e63'];
  chart2 = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors.slice(0, labels.length) }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });
}

function buildBalanceChart(all, month) {
  const p = month.split('-').map(Number);
  const daysInMonth = new Date(p[0], p[1], 0).getDate();
  const labels = [];
  const data = [];
  let balance = 0;
  all.forEach(t => {
    if (t.date && t.date < month + '-01') {
      const a = parseInt(t.amount) || 0;
      if (t.type === 'income') balance += a; else balance -= a;
    }
  });
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = month + '-' + String(d).padStart(2,'0');
    all.filter(t => t.date === dayStr).forEach(t => {
      const a = parseInt(t.amount) || 0;
      if (t.type === 'income') balance += a; else balance -= a;
    });
    labels.push(d);
    data.push(balance);
  }
  const ctx = document.getElementById('chartBalance');
  if (!ctx) return;
  chart3 = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'الرصيد', data, borderColor: '#2a5298', backgroundColor: 'rgba(42,82,152,0.1)', fill: true, tension: 0.3 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } }
  });
}

// ===== مشاركة التقرير كصورة =====
async function shareAsImageR() {
  const container = document.querySelector('.container');
  const topbar = document.querySelector('.topbar');
  const tabs = document.querySelector('.tabs');
  const filterBar = document.querySelector('.filter-bar');
  const actions = document.querySelector('.topbar .btn-group');

  if (topbar) topbar.style.display = 'none';
  if (tabs) tabs.style.display = 'none';
  if (filterBar) filterBar.style.display = 'none';

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#f0f2f5',
      useCORS: true,
      logging: false,
      windowWidth: container.scrollWidth,
      windowHeight: container.scrollHeight
    });

    if (topbar) topbar.style.display = '';
    if (tabs) tabs.style.display = '';
    if (filterBar) filterBar.style.display = '';

    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], 'report-' + Date.now() + '.png', { type: 'image/png' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'تقرير',
        text: document.getElementById('tableTitle').textContent
      });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'report-' + Date.now() + '.png';
      a.click();
      URL.revokeObjectURL(url);
      alert('✅ تم تنزيل التقرير كصورة');
    }
  } catch(e) {
    console.error(e);
    if (topbar) topbar.style.display = '';
    if (tabs) tabs.style.display = '';
    if (filterBar) filterBar.style.display = '';
    alert('⚠️ فشل: ' + e.message);
  }
}

// ===== كشف مطبوع =====
function printStatement() {
  let url = 'statement.html?type=';

  if (currentTab === 'daily') {
    const date = document.getElementById('dateInput').value;
    if (!date) { alert('اختر التاريخ أولاً'); return; }
    url += 'day&date=' + encodeURIComponent(date);
  } else if (currentTab === 'monthly') {
    const month = document.getElementById('dateInput').value;
    if (!month) { alert('اختر الشهر أولاً'); return; }
    url += 'month&month=' + encodeURIComponent(month);
  } else {
    alert('الكشف المطبوع متاح فقط في التقرير اليومي والشهري');
    return;
  }

  window.open(url, '_blank');
}

function exportReport() {
  const all = window.__lastFilteredTx || [];
  if (all.length === 0) {
    alert('لا توجد بيانات للتصدير');
    return;
  }
  const label = document.getElementById('tableTitle').textContent || 'تقرير';
  if (typeof showExportMenu === 'function') {
    showExportMenu(all, label);
  } else {
    alert('نظام التصدير غير محمّل');
  }
}
