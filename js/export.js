// ===== نظام التصدير =====

let exportData = null;
let exportFilename = '';

function showExportMenu(data, filename) {
  if (!data || data.length === 0) {
    alert('لا توجد بيانات للتصدير');
    return;
  }

  exportData = data;
  exportFilename = filename || 'export';

  const old = document.getElementById('exportModal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'exportModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:999999;display:flex;align-items:center;justify-content:center;padding:15px;';

  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:16px;padding:22px 20px;max-width:400px;width:100%;text-align:center;';

  const title = document.createElement('h2');
  title.style.cssText = 'font-size:17px;color:#1e3c72;margin-bottom:6px;';
  title.textContent = '📤 تصدير البيانات';

  const info = document.createElement('p');
  info.style.cssText = 'font-size:12px;color:#888;margin-bottom:18px;';
  info.textContent = 'عدد السجلات: ' + data.length;

  const btnCSV = document.createElement('button');
  btnCSV.textContent = '📊 Excel (CSV)';
  btnCSV.style.cssText = 'width:100%;padding:14px;background:linear-gradient(135deg,#11998e,#38ef7d);color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:8px;';
  btnCSV.onclick = function() { doExportCSV(); };

  const btnPDF = document.createElement('button');
  btnPDF.textContent = '📄 PDF / طباعة';
  btnPDF.style.cssText = 'width:100%;padding:14px;background:linear-gradient(135deg,#673ab7,#512da8);color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:8px;';
  btnPDF.onclick = function() { doExportPDF(); };

  const btnCancel = document.createElement('button');
  btnCancel.textContent = '← إلغاء';
  btnCancel.style.cssText = 'width:100%;padding:10px;background:#e0e0e0;color:#333;border:none;border-radius:10px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;';
  btnCancel.onclick = function() { closeExportMenu(); };

  box.appendChild(title);
  box.appendChild(info);
  box.appendChild(btnCSV);
  box.appendChild(btnPDF);
  box.appendChild(btnCancel);
  modal.appendChild(box);
  document.body.appendChild(modal);
}

function closeExportMenu() {
  const m = document.getElementById('exportModal');
  if (m) m.remove();
  exportData = null;
  exportFilename = '';
}

// ===== تصدير CSV (Excel) =====
function doExportCSV() {
  if (!exportData || exportData.length === 0) {
    alert('لا توجد بيانات');
    return;
  }

  try {
    const headers = ['التاريخ', 'النوع', 'الوصف', 'العميل', 'المبلغ'];
    const rows = exportData.map(function(t) {
      return [
        t.date || '',
        getTypeLabel(t.type),
        (t.description || t.productName || '').replace(/"/g, '""'),
        (t.customerName || '').replace(/"/g, '""'),
        t.amount || 0
      ];
    });

    let csv = '\uFEFF';
    csv += headers.join(',') + '\n';
    rows.forEach(function(r) {
      csv += r.map(function(c) {
        const s = String(c);
        if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
          return '"' + s + '"';
        }
        return s;
      }).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = exportFilename.replace(/[^\w\u0600-\u06FF-]/g, '_') + '-' + getDateStr() + '.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(function() {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);

    closeExportMenu();

    setTimeout(function() {
      alert('✅ تم تنزيل ملف CSV\n\nتحقق من مجلد Downloads');
    }, 500);
  } catch(e) {
    console.error(e);
    alert('❌ خطأ: ' + e.message);
  }
}

// ===== تصدير PDF =====
function doExportPDF() {
  if (!exportData || exportData.length === 0) {
    alert('لا توجد بيانات');
    return;
  }

  const w = window.open('', '_blank');
  if (!w) {
    alert('⚠️ الرجاء السماح بالنوافذ المنبثقة من إعدادات Chrome');
    return;
  }

  w.document.write('<html><body style="font-family:Tahoma;text-align:center;padding:50px;color:#666;">جاري التحضير...</body></html>');

  (async function() {
    try {
      const officeName = await get('settings', 'officeName');
      const officePhone = await get('settings', 'officePhone');
      const officeAddress = await get('settings', 'officeAddress');
      const officeLogo = await get('settings', 'officeLogo');

      const nameVal = (officeName && officeName.value) ? officeName.value : 'اسم المكتب';
      const phoneVal = (officePhone && officePhone.value) ? officePhone.value : '';
      const addrVal = (officeAddress && officeAddress.value) ? officeAddress.value : '';
      const logoVal = (officeLogo && officeLogo.value) ? officeLogo.value : 'icon.svg';

      const typeLabels = {
        income: 'إيراد', expense: 'مصروف', purchase: 'مشترى',
        owner_withdraw: 'مسحوبات', owner_personal: 'شخصي',
        worker_salary: 'راتب', payment: 'دفعة'
      };

      let tableRows = '';
      exportData.forEach(function(t) {
        const amt = parseInt(t.amount) || 0;
        const isIncome = t.type === 'income' || t.type === 'payment';
        tableRows += '<tr>' +
          '<td style="text-align:center;">' + (t.date || '') + '</td>' +
          '<td style="text-align:center;">' + (typeLabels[t.type] || t.type) + '</td>' +
          '<td>' + escH(t.description || t.productName || '') + '</td>' +
          '<td>' + escH(t.customerName || '-') + '</td>' +
          '<td style="text-align:left;font-weight:700;color:' + (isIncome ? '#2e7d32' : '#c62828') + ';">' + (isIncome ? '+' : '−') + amt.toLocaleString('en-US') + '</td>' +
        '</tr>';
      });

      const headerHtml =
        '<div class="report-header">' +
          '<div class="header-logo">' +
            '<img src="' + logoVal + '" alt="logo" onerror="this.style.display=\'none\'">' +
          '</div>' +
          '<div class="header-name">' + escH(nameVal) + '</div>' +
          '<div class="header-contact">' +
            (addrVal ? '<div>📍 ' + escH(addrVal) + '</div>' : '') +
            (phoneVal ? '<div>📞 ' + escH(phoneVal) + '</div>' : '') +
          '</div>' +
        '</div>';

      const html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">' +
        '<title>' + escH(exportFilename) + '</title>' +
        '<style>' +
          'body{font-family:Tahoma,sans-serif;padding:15px;direction:rtl;color:#333;}' +
          '.report-header{display:grid;grid-template-columns:60px 1fr 140px;align-items:center;gap:10px;padding-bottom:12px;margin-bottom:16px;border-bottom:3px solid #2a5298;direction:rtl;}' +
          '.header-logo img{width:52px;height:52px;object-fit:contain;border-radius:8px;border:1px solid #eee;background:#fff;padding:2px;display:block;}' +
          '.header-logo .placeholder{width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-size:28px;background:#f0f2f5;border-radius:8px;}' +
          '.header-name{font-size:17px;font-weight:800;color:#1e3c72;text-align:center;}' +
          '.header-contact{font-size:11px;color:#444;text-align:right;line-height:1.6;}' +
          '.report-title{text-align:center;background:linear-gradient(135deg,#2a5298,#1e3c72);color:#fff;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:800;display:inline-block;margin:0 auto 14px;}' +
          '.report-info{text-align:center;color:#888;font-size:12px;margin-bottom:16px;}' +
          'table{width:100%;border-collapse:collapse;margin-top:10px;}' +
          'th{background:#2a5298;color:#fff;padding:10px;font-size:12px;text-align:right;}' +
          'td{padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;}' +
          'tr:nth-child(even) td{background:#f9f9f9;}' +
          '.footer{text-align:center;color:#888;font-size:11px;margin-top:20px;padding-top:14px;border-top:2px dashed #ccc;line-height:1.8;}' +
          '.footer b{color:#2a5298;}' +
          '@media print{body{padding:10mm;} .report-header{page-break-inside:avoid;}}' +
        '</style></head><body>' +
        headerHtml +
        '<div style="text-align:center;"><span class="report-title">' + escH(exportFilename) + '</span></div>' +
        '<div class="report-info">التاريخ: ' + getDateStr() + ' · عدد السجلات: ' + exportData.length + '</div>' +
        '<table><thead><tr>' +
          '<th style="text-align:center;">التاريخ</th>' +
          '<th style="text-align:center;">النوع</th>' +
          '<th>الوصف</th>' +
          '<th>العميل</th>' +
          '<th style="text-align:left;">المبلغ</th>' +
        '</tr></thead><tbody>' + tableRows + '</tbody></table>' +
        '<div class="footer">' +
          '💻 برمجة وتطوير: <b>م/ ربيع الحريبي</b><br>' +
          '📞 778983131<br>' +
          '© 2026 — جميع الحقوق محفوظة' +
        '</div>' +
        '<script>setTimeout(function(){window.print();},600);<\/script>' +
        '</body></html>';

      w.document.open();
      w.document.write(html);
      w.document.close();

      closeExportMenu();
    } catch(e) {
      console.error(e);
      alert('❌ خطأ: ' + e.message);
    }
  })();
}

// ===== مساعدات =====
function getDateStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function getTypeLabel(type) {
  const labels = {
    income: 'إيراد', expense: 'مصروف', purchase: 'مشترى',
    owner_withdraw: 'مسحوبات', owner_personal: 'شخصي',
    worker_salary: 'راتب', payment: 'دفعة'
  };
  return labels[type] || type;
}

function escH(t) {
  const d = document.createElement('div');
  d.textContent = t || '';
  return d.innerHTML;
}
