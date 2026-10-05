// ===== نظام الوحدات =====

const UNIT_TEMPLATES = {
  none: { base: 'قطعة', units: [] },
  pen: { base: 'قلم', units: [{ name: 'علبة', factor: 20 }, { name: 'كرتون', factor: 240 }] },
  paper: { base: 'ورقة', units: [{ name: 'رزمة', factor: 500 }, { name: 'عصب', factor: 2500 }] },
  custom: { base: 'قطعة', units: [] }
};

let currentTemplate = 'none';

function selectUnitTemplate(tpl) {
  currentTemplate = tpl;
  document.querySelectorAll('.unit-tpl').forEach(function(b) {
    b.classList.toggle('active', b.dataset.tpl === tpl);
  });

  const area = document.getElementById('unitDefArea');
  const defs = document.getElementById('unitDefs');
  const unitGroup = document.getElementById('purchaseUnitGroup');

  if (tpl === 'none') {
    area.style.display = 'none';
    unitGroup.style.display = 'none';
    return;
  }

  area.style.display = 'block';
  const template = UNIT_TEMPLATES[tpl];

  defs.innerHTML = '';
  const baseRow = document.createElement('div');
  baseRow.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;background:#e8f5e9;padding:8px 10px;border-radius:8px;';
  baseRow.innerHTML = '<span style="flex:1;text-align:right;font-size:13px;font-weight:700;color:#2e7d32;">' + template.base + '</span><span style="font-size:11px;color:#666;flex-shrink:0;">الوحدة الأساسية</span>';
  defs.appendChild(baseRow);

  template.units.forEach(function(u) {
    addUnitDef(u.name, u.factor);
  });

  updatePurchaseUnitOptions();
  unitGroup.style.display = 'block';
}

function addUnitDef(name, factor) {
  const defs = document.getElementById('unitDefs');
  const row = document.createElement('div');
  row.className = 'unit-def-row';
  row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;background:#f8f9ff;padding:6px 8px;border-radius:8px;border:1px solid #e6ebff;';
  
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'unit-name';
  nameInput.value = name || '';
  nameInput.placeholder = 'اسم الوحدة';
  nameInput.style.cssText = 'flex:1;min-width:0;padding:8px 10px;border:2px solid #e0e0e0;border-radius:8px;font-size:12px;font-family:inherit;text-align:right;box-sizing:border-box;background:#fff;';
  
  const eqSpan = document.createElement('span');
  eqSpan.textContent = '=';
  eqSpan.style.cssText = 'font-size:14px;font-weight:700;color:#888;flex-shrink:0;';
  
  const factorInput = document.createElement('input');
  factorInput.type = 'number';
  factorInput.className = 'unit-factor';
  factorInput.value = factor || 1;
  factorInput.min = '1';
  factorInput.step = '1';
  factorInput.placeholder = 'عدد';
  factorInput.style.cssText = 'width:60px;padding:8px 4px;border:2px solid #e0e0e0;border-radius:8px;font-size:12px;font-family:inherit;text-align:center;box-sizing:border-box;background:#fff;flex-shrink:0;';
  
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.textContent = '×';
  delBtn.style.cssText = 'background:#ffebee;color:#c62828;border:none;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:16px;padding:0;flex-shrink:0;line-height:1;';
  delBtn.onclick = function() { row.remove(); updatePurchaseUnitOptions(); };
  
  row.appendChild(nameInput);
  row.appendChild(eqSpan);
  row.appendChild(factorInput);
  row.appendChild(delBtn);
  defs.appendChild(row);
  
  nameInput.addEventListener('input', updatePurchaseUnitOptions);
  factorInput.addEventListener('input', updatePurchaseUnitOptions);
}

function updatePurchaseUnitOptions() {
  const sel = document.getElementById('purchaseUnit');
  if (!sel) return;

  sel.innerHTML = '';

  const baseInput = document.querySelector('.unit-base');
  const baseName = baseInput ? baseInput.value.trim() : 'قطعة';
  const baseOpt = document.createElement('option');
  baseOpt.value = '1';
  baseOpt.textContent = baseName + ' (الأساسي)';
  sel.appendChild(baseOpt);

  document.querySelectorAll('#unitDefs .unit-def-row').forEach(function(row, idx) {
    const name = row.querySelector('.unit-name');
    const factor = row.querySelector('.unit-factor');
    if (!name || !factor) return;
    if (!name.value.trim()) return;
    const opt = document.createElement('option');
    opt.value = factor.value || 1;
    opt.textContent = name.value + ' (' + factor.value + ' ' + baseName + ')';
    sel.appendChild(opt);
  });
}

function getCurrentUnits() {
  const baseInput = document.querySelector('.unit-base');
  const baseName = baseInput ? baseInput.value.trim() : 'قطعة';
  const units = [];
  if (currentTemplate === 'none') {
    return { base: 'قطعة', units: [] };
  }
  document.querySelectorAll('#unitDefs .unit-def-row').forEach(function(row) {
    const name = row.querySelector('.unit-name');
    const factor = row.querySelector('.unit-factor');
    if (name && factor && name.value.trim()) {
      units.push({ name: name.value.trim(), factor: parseInt(factor.value) || 1 });
    }
  });
  return { base: baseName, units: units };
}
