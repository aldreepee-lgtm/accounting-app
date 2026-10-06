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
  if (address && address.value) parts.push('<div>📍 ' + escR(address.value) + '</div>');
  if (phone && phone.value) parts.push('<div>📞 ' + escR(phone.value) + '</div>');
  document.getElementById('rContact').innerHTML = parts.join('');

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
  const stats = document.getElementById('rStats');
  const total = document.getElementById('rTotal');

  if (!receiptData) {
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

  stats.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#f8f9ff;border-radius:10px;border:1px solid #e6ebff;box-sizing:border-box;overflow:hidden;">' +
      '<span style="font-size:18px;line-height:1;flex-shrink:0;">📅</span>' +
      '<span style="font-size:12px;font-weight:800;color:#1e3c72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + dateStr + '</span>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#f8f9ff;border-radius:10px;border:1px solid #e6ebff;box-sizing:border-box;overflow:hidden;">' +
      '<span style="font-size:18px;line-height:1;flex-shrink:0;">🔢</span>' +
      '<span style="font-size:12px;font-weight:800;color:#1e3c72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">#' + (tx.id || '---') + '</span>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#f8f9ff;border-radius:10px;border:1px solid #e6ebff;box-sizing:border-box;overflow:hidden;">' +
      '<span style="font-size:18px;line-height:1;flex-shrink:0;">🕐</span>' +
      '<span style="font-size:12px;font-weight:800;color:#1e3c72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + timeStr + '</span>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#f8f9ff;border-radius:10px;border:1px solid #e6ebff;box-sizing:border-box;overflow:hidden;">' +
      '<span style="font-size:18px;line-height:1;flex-shrink:0;">👤</span>' +
      '<span style="font-size:12px;font-weight:800;color:#1e3c72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtmlR(tx.username || '---') + '</span>' +
    '</div>';

  // إجبار التنسيق مباشرة (يتجاوز أي CSS مخزّن)
  stats.style.cssText = 'display:grid !important;grid-template-columns:1fr 1fr !important;gap:8px !important;margin-bottom:14px !important;width:100% !important;box-sizing:border-box !important;';

  // عرض البنود
  if (tx.items && tx.items.length > 0) {
    body.innerHTML = tx.items.map(function(item, idx) {
      const lineTotal = parseInt(item.lineTotal) || (item.quantity * item.unitPrice);
      return '<tr>' +
        '<td class="desc" style="text-align:right;">' +
          '<div style="font-weight:700;color:#333;">' + (idx+1) + '. ' + escapeHtmlR(item.productName) + '</div>' +
          '<div style="font-size:11px;color:#888;margin-top:3px;">' + item.quantity + ' × ' + item.unitPrice + ' ر.ي</div>' +
        '</td>' +
        '<td class="amt">' + lineTotal.toLocaleString('en-US') + '</td>' +
      '</tr>';
    }).join('');
  } else {
    const desc = tx.description || tx.productName || 'خدمة';
    body.innerHTML = '<tr><td class="desc">' + escapeHtmlR(desc) + '</td><td class="amt">' + amount.toLocaleString('en-US') + '</td></tr>';
  }

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

function escapeHtmlR(t) {
  const d = document.createElement('div');
  d.textContent = t || '';
  return d.innerHTML;
}

// ===== دالة مساعدة =====

// ===== تحويل SVG إلى PNG =====
function svgToPng(svgSrc, w, h) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(w, 200);
        canvas.height = Math.max(h, 200);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch(e) { reject(e); }
    };
    img.onerror = reject;
    img.src = svgSrc;
  });
}

function escR(t) {
  const d = document.createElement('div');
  d.textContent = t || '';
  return d.innerHTML;
}

async function shareAsImage() {
  const box = document.getElementById('receiptBox');
  const actions = document.querySelector('.actions');
  const backBtn = document.querySelector('.back-btn');
  const pageTitle = document.querySelector('.page-title');
  actions.style.display = 'none';
  if (backBtn) backBtn.style.display = 'none';
  if (pageTitle) pageTitle.style.display = 'none';
  try {
    const imgs = box.querySelectorAll('img');
    await Promise.all(Array.from(imgs).map(function(img) {
      if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
      return new Promise(function(resolve) {
        img.onload = resolve;
        img.onerror = resolve;
        setTimeout(resolve, 3000);
      });
    }));
    const originalSrcs = [];
    for (const img of imgs) {
      const src = img.getAttribute('src') || '';
      if (src.endsWith('.svg') || src.startsWith('data:image/svg')) {
        try {
          const png = await svgToPng(src, 300, 300);
          originalSrcs.push({ img: img, src: src });
          img.src = png;
          await new Promise(function(r) {
            img.onload = r;
            img.onerror = r;
            setTimeout(r, 2000);
          });
        } catch(err) { console.warn('SVG failed:', err); }
      }
    }
    const canvas = await html2canvas(box, {
      scale: 3,
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: true,
      imageTimeout: 0,
      logging: false
    });
    originalSrcs.forEach(function(o) { o.img.src = o.src; });
    actions.style.display = '';
    if (backBtn) backBtn.style.display = '';
    if (pageTitle) pageTitle.style.display = '';
    const blob = await new Promise(function(r) { canvas.toBlob(r, 'image/png'); });
    const file = new File([blob], 'receipt-' + Date.now() + '.png', { type: 'image/png' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'receipt', text: 'receipt' });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'receipt-' + Date.now() + '.png';
      a.click();
      URL.revokeObjectURL(url);
      alert('Done');
    }
  } catch(e) {
    console.error(e);
    actions.style.display = '';
    if (backBtn) backBtn.style.display = '';
    if (pageTitle) pageTitle.style.display = '';
    alert('Error: ' + e.message);
  }
}
