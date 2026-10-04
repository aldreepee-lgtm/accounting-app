// ===== منطق مولّد الرموز =====

const HISTORY_KEY = 'licenseGeneratorHistory';
let lastGenerated = null;

document.addEventListener('DOMContentLoaded', () => {
  loadHistory();

  const input = document.getElementById('officeInput');
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doGenerate();
  });
});

function doGenerate() {
  const officeName = document.getElementById('officeInput').value.trim();
  if (!officeName) {
    alert('أدخل اسم المكتب أولاً');
    return;
  }

  const code = generateLicense(officeName);

  // عرض النتيجة
  document.getElementById('resultCode').textContent = code;
  document.getElementById('resultOffice').textContent = '🏢 ' + officeName;
  document.getElementById('resultBox').classList.add('show');

  // حفظ في السجل
  saveToHistory(officeName, code);

  // نسخ تلقائي
  lastGenerated = code;
}

function copyResult() {
  if (!lastGenerated) return;
  copyToClipboard(lastGenerated);
  alert('✅ تم نسخ الرمز: ' + lastGenerated);
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
}

// ===== السجل =====
function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveToHistory(officeName, code) {
  const history = getHistory();
  // تحقق إن كان موجوداً مسبقاً بنفس الاسم
  const existing = history.findIndex(h => h.officeName === officeName);
  if (existing >= 0) {
    history[existing].code = code;
    history[existing].date = new Date().toISOString();
  } else {
    history.unshift({
      officeName,
      code,
      date: new Date().toISOString()
    });
  }
  // احتفظ بآخر 50 فقط
  const trimmed = history.slice(0, 50);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  loadHistory();
}

function loadHistory() {
  const list = document.getElementById('historyList');
  const history = getHistory();

  if (history.length === 0) {
    list.innerHTML = '<div class="empty-msg">لا توجد رموز مولّدة بعد</div>';
    return;
  }

  list.innerHTML = '';
  history.forEach(h => {
    const div = document.createElement('div');
    div.className = 'history-item';
    const date = new Date(h.date).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
    div.innerHTML = `
      <div>
        <div class="h-name">${escapeHtml(h.officeName)}</div>
        <div class="h-code">${h.code}</div>
        <div class="h-date">${date}</div>
      </div>
      <button class="h-copy" onclick="copyFromHistory('${h.code}')">📋</button>
    `;
    list.appendChild(div);
  });
}

function copyFromHistory(code) {
  copyToClipboard(code);
  alert('✅ تم نسخ: ' + code);
}

function clearHistory() {
  if (!confirm('هل تريد مسح السجل بالكامل؟')) return;
  localStorage.removeItem(HISTORY_KEY);
  loadHistory();
  document.getElementById('resultBox').classList.remove('show');
  document.getElementById('officeInput').value = '';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
