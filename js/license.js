// ===== منطق الترخيص =====

function normalizeOfficeName(name) {
  return (name || '')
    .trim()
    .replace(/[\u0623\u0625\u0622]/g, '\u0627')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0649/g, '\u064A')
    .replace(/[\s\-_.\u060C\u061B\u061F!,:;]+/g, '')
    .toUpperCase();
}

// خوارزمية 1: djb2 (تُستخدم للجزء الأول من البصمة)
function hash1(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h = h >>> 0; // unsigned 32-bit
  }
  return h.toString(16).toUpperCase().padStart(8, '0').slice(-4);
}

// خوارزمية 2: sdbm (تُستخدم للجزء الثاني)
function hash2(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = s.charCodeAt(i) + (h << 6) + (h << 16) - h;
    h = h >>> 0;
  }
  return h.toString(16).toUpperCase().padStart(8, '0').slice(-4);
}

// استخراج بادئة إنجليزية من الاسم
function prefixFromName(name) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let codes = [];
  for (let i = 0; i < name.length && codes.length < 3; i++) {
    const c = name[i];
    if (c >= '0' && c <= '9') {
      codes.push(c);
    } else {
      const n = c.charCodeAt(0) % 36;
      codes.push(chars[n]);
    }
  }
  while (codes.length < 3) codes.push('X');
  return codes.slice(0, 3).join('');
}

// توليد الرمز
function generateLicense(officeName) {
  const n = normalizeOfficeName(officeName);
  if (!n) return '';
  const prefix = prefixFromName(n);
  const h1 = hash1(n + '_A');
  const h2 = hash2(n + '_B');
  return `${prefix}-${h1}-${h2}`;
}

// التحقق
function verifyLicense(officeName, code) {
  if (!officeName || !code) return false;
  const expected = generateLicense(officeName).toUpperCase();
  const provided = code.trim().toUpperCase().replace(/\s/g, '');
  return expected === provided;
}

// تنسيق الإدخال تلقائياً
function formatLicenseInput(value) {
  const v = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const parts = [];
  if (v.length > 0) parts.push(v.slice(0, 3));
  if (v.length > 3) parts.push(v.slice(3, 7));
  if (v.length > 7) parts.push(v.slice(7, 11));
  return parts.join('-');
}
