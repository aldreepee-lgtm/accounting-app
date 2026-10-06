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

  // احذف أي modal قديم
  const old = document.getElementById('exportModal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'exportModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:15px;';

  modal.innerHTML =
    '<div style="background:#fff;border-radius:16px;padding:22px 20px;max-width:400px;width:100%;text-align:center;">' +
      '<h2 style="font-size:17px;color:#1e3c72;margin-bottom:6px;">📤 تصدير البيانات</h2>' +
      '<p style="font-size:12px;color:#888;margin-bottom:18px;">عدد السجلات: ' + data.length + '</p>' +
      '<button onclick="doExportCSV()" style="width:100%;padding:14px;background:linear-gradient(135deg,#11998e,#38ef7d);color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:8px;">📊 Excel (CSV)</button>' +
      '<button onclick="doExportPDF()" style="width:100%;padding:14px;background:linear-gradient(135deg,#673ab7,#512da8);color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:8px;">📄 PDF / طباعة</button>' +
      '<button onclick="closeExportMenu()" style="width:100%;padding:10px;background:#e0e0e0;color:#333;border:none;border-radius:10px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;">← إلغاء</button>' +
    '</div>';

  document.body.appendChild(modal);
}

function closeExportMenu() {
  const m = document.getElementById('exportModal');
  if (m) m.remove();
  exportData = null;
  exportFilename = '';
}
