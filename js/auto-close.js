// ===== الإغلاق التلقائي لليوم =====
(function() {
  'use strict';

  const DEFAULT_DELAY = 8000;      // 8 ثوان بعد الفتح
  const CHECK_INTERVAL = 3600000;  // كل ساعة
  const MAX_SYNC_WAIT = 15000;     // انتظار المزامنة

  function getDateStr(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function getYesterdayStr() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    return getDateStr(d);
  }

  function getUser() {
    try { return JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch(e) { return {}; }
  }

  async function waitForSync(maxMs) {
    var start = Date.now();
    while (typeof syncInProgress !== 'undefined' && syncInProgress && Date.now() - start < maxMs) {
      await new Promise(function(r) { setTimeout(r, 500); });
    }
  }

  async function isEnabled() {
    try {
      var s = await get('settings', 'autoCloseEnabled');
      return s && s.value === true;
    } catch(e) { return false; }
  }

  async function getOpeningBalanceFor(targetDate) {
    var closings = await getAll('daily_closings');
    var past = closings.filter(function(c) { return c.date < targetDate; })
                       .sort(function(a, b) { return b.date.localeCompare(a.date); });
    if (past.length > 0) return past[0].closingBalance;
    var initial = await get('settings', 'openingBalance');
    return initial ? (parseInt(initial.value) || 0) : 0;
  }

  async function buildRecord(targetDate) {
    var opening = await getOpeningBalanceFor(targetDate);
    var all = await getAll('transactions');
    var dayTx = all.filter(function(t) { return t.date === targetDate; });

    var sum = { income: 0, expense: 0, purchase: 0, owner_withdraw: 0, owner_personal: 0, worker_salary: 0 };
    dayTx.forEach(function(t) {
      var a = parseInt(t.amount) || 0;
      if (sum[t.type] !== undefined) sum[t.type] += a;
    });

    var totalIncome = sum.income;
    var totalExpense = sum.expense + sum.purchase + sum.owner_withdraw + sum.owner_personal;
    var closing = opening + totalIncome - totalExpense;

    return {
      date: targetDate,
      openingBalance: opening,
      totalIncome: totalIncome,
      totalExpense: totalExpense,
      details: sum,
      transactionCount: dayTx.length,
      closingBalance: closing,
      closedAt: new Date().toISOString(),
      closedBy: '\u0627\u0644\u0646\u0638\u0627\u0645 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b',
      autoClosed: true,
      empty: dayTx.length === 0
    };
  }

  async function runAutoClose() {
    if (!(await isEnabled())) return;

    var user = getUser();
    if (user.role !== 'owner') return;

    await waitForSync(MAX_SYNC_WAIT);

    var yesterday = getYesterdayStr();
    var exists = await get('daily_closings', yesterday);
    if (exists) return;

    var closings = await getAll('daily_closings');
    var lastClosing = closings.length > 0
      ? closings.map(function(c) { return c.date; }).sort().reverse()[0]
      : null;

    var record = await buildRecord(yesterday);
    await put('daily_closings', record);

    console.log('[AutoClose] \u062a\u0645 \u0625\u063a\u0644\u0627\u0642', yesterday, '\u2014 \u0631\u0635\u064a\u062f:', record.closingBalance);

    if (!record.empty) showNotice(record);

    if (lastClosing && lastClosing < yesterday) {
      notifyGap(lastClosing, yesterday);
    }
  }

  function showNotice(record) {
    try {
      var el = document.createElement('div');
      el.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);background:#2e7d32;color:#fff;padding:12px 20px;border-radius:10px;z-index:99999;font-size:13px;box-shadow:0 4px 15px rgba(0,0,0,0.2);font-family:inherit;max-width:90%;text-align:center;';
      el.innerHTML = '\uD83D\uDD12 \u062a\u0645 \u0625\u063a\u0644\u0627\u0642 ' + record.date + ' \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b<br><small style="font-size:11px;">\u0627\u0644\u0631\u0635\u064a\u062f: ' + record.closingBalance.toLocaleString('en-US') + '</small>';
      document.body.appendChild(el);
      setTimeout(function() { el.remove(); }, 7000);
    } catch(e) {}
  }

  function notifyGap(fromDate, toDate) {
    try {
      var el = document.createElement('div');
      el.style.cssText = 'position:fixed;top:130px;left:50%;transform:translateX(-50%);background:#ff9800;color:#fff;padding:10px 18px;border-radius:10px;z-index:99999;font-size:12px;box-shadow:0 4px 15px rgba(0,0,0,0.2);font-family:inherit;max-width:90%;text-align:center;';
      el.innerHTML = '\u26A0\uFE0F \u0641\u062c\u0648\u0629 \u0628\u064a\u0646 ' + fromDate + ' \u0648 ' + toDate + ' \u2014 \u064a\u0646\u0635\u062d \u0628\u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0625\u063a\u0644\u0627\u0642\u0627\u062a';
      document.body.appendChild(el);
      setTimeout(function() { el.remove(); }, 10000);
    } catch(e) {}
  }

  var isAppPage = /app\.html|\/accounting-app\/?$/.test(window.location.pathname);
  if (isAppPage) {
    setTimeout(function() {
      runAutoClose().catch(function(e) { console.warn('AutoClose:', e); });
    }, DEFAULT_DELAY);

    setInterval(function() {
      runAutoClose().catch(function(e) { console.warn('AutoClose:', e); });
    }, CHECK_INTERVAL);
  }

  window.runAutoClose = runAutoClose;
})();
