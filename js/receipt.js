// ===== منطق الإيصال =====

let receiptData = null;

document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  await loadOfficeInfo();
  await loadReceiptData();
  renderReceipt();
});

async function loadOfficeInfo() {
  const logo = await get('settings', 'officeLogo');
  const name = await get('settings', 'officeName');
  const phone = await get('settings', 'officePhone');
  const address = await get('settings', 'officeAddress');

  const logoVal = (logo && logo.value) ? logo.value : 'icon.svg';

  document.getElementById('rLogoWrap').innerHTML = '<img src="' + logoVal + '" alt="logo">';
  document.getElementById('rWatermark').src = logoVal;
  document.getElementById('rOfficeName').textContent = (name && name.value) ? name.value : 'اسم المكتب';

  const parts = [];
  if (address && address.value) parts.push('📍 ' + address.value);
  if (phone && phone.value) parts.push('📞 ' + phone.value);
  document.getElementById('rContact').innerHTML = parts.join('<br>');

  document.title = 'إيصال - ' + ((name && name.value) ? name.value : '');
}

async function loadReceiptData() {
  const saved = sessionStorage.getItem('receiptData');
  if (saved) {
    try { receiptData = JSON.parse(saved); return; } catch(e) {}
  }
  const params = new URLSearchParams(window.location.search);
  const txId = params.get('id');
  if (txId) {
    const tx = await get('transactions', Number(txId));
    if (tx) receiptData = tx;
  }
}

function renderReceipt() {
  const body = document.getElementById('rBody');
  const meta = document.getElementById('rMeta');
  const total = document.getElementById('rTotal');

  if (!receiptData) {
    meta.innerHTML = '<div style="color:#c62828;text-align:center;padding:10px;font-weight:700;">⚠️ لا توجد بيانات</div>';
    body.innerHTML = '';
    return;
  }

  const tx = receiptData;
  const amount = parseInt(tx.amount) || 0;

  const now = new Date();
  const dateStr = tx.date || now.toISOString().slice(0, 10);
  const timeStr = tx.time
    ? new Date(tx.time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    : now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  meta.innerHTML =
    '<div class="row"><span>📅 التاريخ:</span><span>' + dateStr + '</span></div>' +
    '<div class="row"><span>🕐 الوقت:</span><span>' + timeStr + '</span></div>' +
    '<div class="row"><span>🔢 رقم الإيصال:</span><span>#' + (tx.id || '---') + '</span></div>' +
    (tx.username ? '<div class="row"><span>👤 الكاشير:</span><span>' + escapeHtmlR(tx.username) + '</span></div>' : '');

  const desc = tx.description || tx.productName || 'خدمة';
  body.innerHTML = '<tr><td class="desc">' + escapeHtmlR(desc) + '</td><td class="amt">' + amount.toLocaleString('en-US') + '</td></tr>';

  total.textContent = amount.toLocaleString('en-US') + ' ر.ي';
}

// ===== الطباعة الحرارية =====
function printThermal() {
  document.body.classList.add('print-thermal');
  setTimeout(() => {
    window.print();
    setTimeout(() => document.body.classList.remove('print-thermal'), 500);
  }, 100);
}

// ===== الطباعة A4 =====
function printA4() {
  document.body.classList.remove('print-thermal');
  setTimeout(() => window.print(), 100);
}

// ===== مشاركة كصورة =====
async function shareAsImage() {
  const box = document.getElementById('receiptBox');
  const actions = document.querySelector('.actions');
  const backBtn = document.querySelector('.back-btn');
  const pageTitle = document.querySelector('.page-title');

  actions.style.display = 'none';
  if (backBtn) backBtn.style.display = 'none';
  if (pageTitle) pageTitle.style.display = 'none';

  try {
    const canvas = await html2canvas(box, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false
    });

    actions.style.display = '';
    if (backBtn) backBtn.style.display = '';
    if (pageTitle) pageTitle.style.display = '';

    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], 'receipt-' + Date.now() + '.png', { type: 'image/png' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'إيصال',
        text: 'إيصال من ' + document.getElementById('rOfficeName').textContent
      });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'receipt-' + Date.now() + '.png';
      a.click();
      URL.revokeObjectURL(url);
      alert('✅ تم تنزيل الصورة');
    }
  } catch(e) {
    console.error(e);
    actions.style.display = '';
    if (backBtn) backBtn.style.display = '';
    if (pageTitle) pageTitle.style.display = '';
    alert('⚠️ فشل: ' + e.message);
  }
}

function escapeHtmlR(t) {
  const d = document.createElement('div');
  d.textContent = t || '';
  return d.innerHTML;
}
