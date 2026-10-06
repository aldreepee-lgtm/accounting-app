// ===== منطق مقارنة الفترات =====

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  setDefaultDates();
});

function setDefaultDates() {
  const today = new Date();
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);

  document.getElementById('from1').value = fmtDate(thisMonthStart);
  document.getElementById('to1').value = fmtDate(today);
  document.getElementById('from2').value = fmtDate(lastMonthStart);
  document.getElementById('to2').value = fmtDate(lastMonthEnd);
}

function fmtDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

async function runCompare() {
  const from1 = document.getElementById('from1').value;
  const to1 = document.getElementById('to1').value;
  const from2 = document.getElementById('from2').value;
  const to2 = document.getElementById('to2').value;

  if (!from1 || !to1 || !from2 || !to2) {
    alert('املأ كل التواريخ');
    return;
  }

  const allTx = await getAll('transactions');

  const p1 = analyzePeriod(allTx, from1, to1);
  const p2 = analyzePeriod(allTx, from2, to2);

  renderResults(p1, p2, from1, to1, from2, to2);
}

function analyzePeriod(tx, from, to) {
  const filtered = tx.filter(function(t) {
    return t.date && t.date >= from && t.date <= to;
  });

  let income = 0, expense = 0;
  let count = 0;
  const byType = {
    income: 0, expense: 0, purchase: 0,
    owner_withdraw: 0, owner_personal: 0, worker_salary: 0, payment: 0
  };

  filtered.forEach(function(t) {
    const a = parseInt(t.amount) || 0;
    count++;
    if (t.type === 'income') { income += a; byType.income += a; }
    else { expense += a; if (byType[t.type] !== undefined) byType[t.type] += a; }
  });

  return {
    income: income,
    expense: expense,
    net: income - expense,
    count: count,
    byType: byType
  };
}

function formatDiff(diff, isMoney) {
  const sign = diff > 0 ? '+' : '';
  const cls = diff > 0 ? 'up' : (diff < 0 ? 'down' : 'same');
  const text = sign + (isMoney ? diff.toLocaleString('en-US') : diff);
  return { cls: cls, text: text };
}

function renderResults(p1, p2, from1, to1, from2, to2) {
  const area = document.getElementById('resultsArea');

  const diffIncome = p1.income - p2.income;
  const diffExpense = p1.expense - p2.expense;
  const diffNet = p1.net - p2.net;
  const diffCount = p1.count - p2.count;

  const dIncome = formatDiff(diffIncome, true);
  const dExpense = formatDiff(diffExpense, true);
  const dNet = formatDiff(diffNet, true);
  const dCount = formatDiff(diffCount, false);

  let html = '';

  // معلومات الفترتين
  html += '<div class="periods-grid" style="margin-bottom:12px;">';
  html += '<div class="period-box"><h3 style="font-size:12px;">📅 الفترة 1</h3><div style="font-size:11px;color:#666;"><span dir=\'ltr\'>' + from1 + '</span> → <span dir=\'ltr\'>' + to1 + '</span></div></div>';
  html += '<div class="period-box second"><h3 style="font-size:12px;">📅 الفترة 2</h3><div style="font-size:11px;color:#666;"><span dir=\'ltr\'>' + from2 + '</span> → <span dir=\'ltr\'>' + to2 + '</span></div></div>';
  html += '</div>';

  // بطاقات المقارنة
  html += '<div class="results-grid">';

  html += '<div class="result-card p1">';
  html += '<div class="lbl">💰 الإيرادات (ف1)</div>';
  html += '<div class="val">' + p1.income.toLocaleString('en-US') + '</div>';
  html += '<div class="diff ' + dIncome.cls + '">' + dIncome.text + ' عن ف2</div>';
  html += '</div>';

  html += '<div class="result-card p2">';
  html += '<div class="lbl">💰 الإيرادات (ف2)</div>';
  html += '<div class="val">' + p2.income.toLocaleString('en-US') + '</div>';
  html += '<div style="font-size:11px;color:#999;margin-top:6px;">&nbsp;</div>';
  html += '</div>';

  html += '<div class="result-card p1">';
  html += '<div class="lbl">➖ المصروفات (ف1)</div>';
  html += '<div class="val">' + p1.expense.toLocaleString('en-US') + '</div>';
  html += '<div class="diff ' + dExpense.cls + '">' + dExpense.text + ' عن ف2</div>';
  html += '</div>';

  html += '<div class="result-card p2">';
  html += '<div class="lbl">➖ المصروفات (ف2)</div>';
  html += '<div class="val">' + p2.expense.toLocaleString('en-US') + '</div>';
  html += '<div style="font-size:11px;color:#999;margin-top:6px;">&nbsp;</div>';
  html += '</div>';

  html += '<div class="result-card p1">';
  html += '<div class="lbl">📊 الصافي (ف1)</div>';
  html += '<div class="val" style="color:' + (p1.net >= 0 ? '#2e7d32' : '#c62828') + ';">' + p1.net.toLocaleString('en-US') + '</div>';
  html += '<div class="diff ' + dNet.cls + '">' + dNet.text + ' عن ف2</div>';
  html += '</div>';

  html += '<div class="result-card p2">';
  html += '<div class="lbl">📊 الصافي (ف2)</div>';
  html += '<div class="val" style="color:' + (p2.net >= 0 ? '#2e7d32' : '#c62828') + ';">' + p2.net.toLocaleString('en-US') + '</div>';
  html += '<div style="font-size:11px;color:#999;margin-top:6px;">&nbsp;</div>';
  html += '</div>';

  html += '<div class="result-card p1">';
  html += '<div class="lbl">🔢 عدد الحركات (ف1)</div>';
  html += '<div class="val">' + p1.count + '</div>';
  html += '<div class="diff ' + dCount.cls + '">' + dCount.text + ' عن ف2</div>';
  html += '</div>';

  html += '<div class="result-card p2">';
  html += '<div class="lbl">🔢 عدد الحركات (ف2)</div>';
  html += '<div class="val">' + p2.count + '</div>';
  html += '<div style="font-size:11px;color:#999;margin-top:6px;">&nbsp;</div>';
  html += '</div>';

  html += '</div>';

  // مخطط أعمدة الإيرادات
  const maxVal = Math.max(p1.income, p2.income, p1.expense, p2.expense, 1);
  const p1IncPct = Math.max((p1.income / maxVal) * 100, 5);
  const p2IncPct = Math.max((p2.income / maxVal) * 100, 5);
  const p1ExpPct = Math.max((p1.expense / maxVal) * 100, 5);
  const p2ExpPct = Math.max((p2.expense / maxVal) * 100, 5);

  html += '<div class="summary-card">';
  html += '<div class="summary-title">📊 مقارنة بصرية</div>';

  html += '<div class="chart-bar">';
  html += '<div class="label">💰 الإيرادات</div>';
  html += '<div class="bar-row"><span class="name">الفترة 1</span><div class="bar p1" style="width:' + p1IncPct + '%;">' + p1.income.toLocaleString('en-US') + '</div></div>';
  html += '<div class="bar-row"><span class="name">الفترة 2</span><div class="bar p2" style="width:' + p2IncPct + '%;">' + p2.income.toLocaleString('en-US') + '</div></div>';
  html += '</div>';

  html += '<div class="chart-bar">';
  html += '<div class="label">➖ المصروفات</div>';
  html += '<div class="bar-row"><span class="name">الفترة 1</span><div class="bar p1" style="width:' + p1ExpPct + '%;">' + p1.expense.toLocaleString('en-US') + '</div></div>';
  html += '<div class="bar-row"><span class="name">الفترة 2</span><div class="bar p2" style="width:' + p2ExpPct + '%;">' + p2.expense.toLocaleString('en-US') + '</div></div>';
  html += '</div>';

  html += '</div>';

  // ملخص
  html += '<div class="summary-card">';
  html += '<div class="summary-title">📋 ملخص المقارنة</div>';
  html += '<div class="summary-row"><span>الإيرادات</span><span class="' + dIncome.cls + '">' + dIncome.text + '</span></div>';
  html += '<div class="summary-row"><span>المصروفات</span><span class="' + dExpense.cls + '">' + dExpense.text + '</span></div>';
  html += '<div class="summary-row total"><span>الصافي</span><span class="' + dNet.cls + '">' + dNet.text + '</span></div>';
  html += '</div>';

  area.innerHTML = html;
}
