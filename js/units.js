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
  // الصف الأساسي
  const baseRow = document.createElement('div');
  baseRow.className = 'unit-def-row';
  baseRow.innerHTML = '<input type="text" class="unit-base" value="' + template.base + '" placeholder="الوحدة الأساسية" readonly style="background:#e8f5e9;color:#2e7d32;font-weight:700;"><span style="text-align:center;color:#888;">الأساس</span><span></span><span></span>';
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
  row.innerHTML = '<input type="text" class="unit-name" value="' + (name || '') + '" placeholder="اسم الوحدة"><span style="text-align:center;font-size:11px;color:#666;">=</span><input type="number" class="unit-factor" value="' + (factor || 1) + '" min="1" step="1" placeholder="عدد"><button type="button" class="del" onclick="this.parentElement.remove(); updatePurchaseUnitOptions();">×</button>';
  defs.appendChild(row);

  row.querySelector('.unit-name').addEventListener('input', updatePurchaseUnitOptions);
  row.querySelector('.unit-factor').addEventListener('input', updatePurchaseUnitOptions);
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
