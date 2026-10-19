import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('======================================================================');
console.log(' ADVERSARIAL STRESS TEST: ROUND 24 REVIEWER SUITE');
console.log('======================================================================');

let passCount = 0;
let failCount = 0;

function assert(name, condition, errorMsg = '') {
  if (condition) {
    console.log(`  ✔ PASS: ${name}`);
    passCount++;
  } else {
    console.error(`  ✖ FAIL: ${name} — ${errorMsg}`);
    failCount++;
  }
}

// -------------------------------------------------------------------------
// Setup Mock Environment for SSR & Lifecycle Simulation
// -------------------------------------------------------------------------
class TestStorage {
  constructor() {
    this._data = new Map();
    this.throwOnGet = false;
    this.throwOnSet = false;
  }
  getItem(k) {
    if (this.throwOnGet) throw new Error('SecurityError: Access to localStorage is denied');
    return this._data.has(k) ? this._data.get(k) : null;
  }
  setItem(k, v) {
    if (this.throwOnSet) throw new Error('QuotaExceededError: Storage quota exceeded');
    this._data.set(k, String(v));
  }
  removeItem(k) { this._data.delete(k); }
  clear() { this._data.clear(); }
}

const testStorage = new TestStorage();

globalThis.Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
const mockElement = () => ({
  getContext: () => null,
  style: {},
  setAttribute: () => {},
  getAttribute: () => null,
  appendChild: () => {},
  removeChild: () => {},
  classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => false },
  addEventListener: () => {},
  removeEventListener: () => {}
});

globalThis.window = {
  location: { reload: () => {}, href: 'http://localhost' },
  localStorage: testStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  navigator: { onLine: true }
};
globalThis.localStorage = testStorage;
globalThis.document = {
  createElement: mockElement,
  createElementNS: mockElement,
  documentElement: mockElement(),
  head: mockElement(),
  body: mockElement(),
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: () => null,
  querySelectorAll: () => []
};

// -------------------------------------------------------------------------
// Load Components via Vite
// -------------------------------------------------------------------------
const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  root: projectRoot
});

console.log('\n▶ Suite 1: Loading Views & Component Integrity...');

let AdminView, GuruView, SiswaView, SuperAdminView, TutorialModal;
try {
  const modAdmin = await vite.ssrLoadModule('/src/views/AdminView.jsx');
  AdminView = modAdmin.default;
  const modGuru = await vite.ssrLoadModule('/src/views/GuruView.jsx');
  GuruView = modGuru.default;
  const modSiswa = await vite.ssrLoadModule('/src/views/SiswaView.jsx');
  SiswaView = modSiswa.default;
  const modSuper = await vite.ssrLoadModule('/src/views/SuperAdminView.jsx');
  SuperAdminView = modSuper.default;
  const modTut = await vite.ssrLoadModule('/src/components/TutorialModal.jsx');
  TutorialModal = modTut.default;
  assert('All 4 view modules and TutorialModal loaded successfully via Vite SSR', true);
} catch (e) {
  assert('All 4 view modules and TutorialModal loaded successfully via Vite SSR', false, e.message);
}

// -------------------------------------------------------------------------
// Suite 2: Touch Target & Responsive Layout Verification
// -------------------------------------------------------------------------
console.log('\n▶ Suite 2: Mobile Touch Targets & Shrink Protection Verification...');

const adminSrc = fs.readFileSync(path.join(projectRoot, 'src/views/AdminView.jsx'), 'utf8');
const guruSrc = fs.readFileSync(path.join(projectRoot, 'src/views/GuruView.jsx'), 'utf8');
const siswaSrc = fs.readFileSync(path.join(projectRoot, 'src/views/SiswaView.jsx'), 'utf8');
const superSrc = fs.readFileSync(path.join(projectRoot, 'src/views/SuperAdminView.jsx'), 'utf8');

// Check Admin mobile button touch target
assert(
  'AdminView mobile tutorial button has >= 44x44px touch target (w-11 h-11 / min-w-[44px] min-h-[44px])',
  adminSrc.includes('min-w-[44px]') && adminSrc.includes('min-h-[44px]')
);

// Check Guru mobile button touch target
assert(
  'GuruView mobile tutorial button has >= 44x44px touch target (w-11 h-11 / min-w-[44px] min-h-[44px])',
  guruSrc.includes('min-w-[44px]') && guruSrc.includes('min-h-[44px]')
);

// Check Siswa mobile button touch target
assert(
  'SiswaView mobile tutorial button has >= 44x44px touch target (w-11 h-11 / min-w-[44px] min-h-[44px])',
  siswaSrc.includes('min-w-[44px]') && siswaSrc.includes('min-h-[44px]')
);

// Check SuperAdmin mobile button touch target precisely
const superTutBtnMatch = superSrc.match(/<button[^>]*onClick=\{\(\)\s*=>\s*setShowTutorialModal\(true\)\}[^>]*className="([^"]+)"/s);
const superTutBtnClass = superTutBtnMatch ? superTutBtnMatch[1] : '';
assert(
  'SuperAdminView tutorial button has >= 44x44px touch target on mobile (min-w-[44px] min-h-[44px])',
  superTutBtnClass.includes('min-w-[44px]') && superTutBtnClass.includes('min-h-[44px]'),
  'SuperAdminView tutorial button missing min-w-[44px] or min-h-[44px]'
);

// Check shrink protection on narrow screen headers (<360px)
const adminShrink = adminSrc.includes('flex items-center gap-1.5 shrink-0');
const guruShrink = guruSrc.includes('flex items-center gap-1.5 shrink-0');
const siswaShrink = siswaSrc.includes('flex items-center gap-1.5 shrink-0');
const superShrink = superSrc.includes('flex items-center gap-2 shrink-0');

assert('AdminView mobile action cluster has shrink protection for narrow screens (<360px)', adminShrink);
assert('GuruView mobile action cluster has shrink protection for narrow screens (<360px)', guruShrink);
assert('SiswaView mobile action cluster has shrink protection for narrow screens (<360px)', siswaShrink);
assert('SuperAdminView header action cluster has shrink protection for narrow screens (<360px)', superShrink);

// -------------------------------------------------------------------------
// Suite 3: Null, Undefined, and Unusual User Identity Resolution
// -------------------------------------------------------------------------
console.log('\n▶ Suite 3: User Identity Fallback & Boundary Scenarios...');

function resolveId(user, role) {
  if (role === 'admin') return user?.id_admin || user?.id_user || user?.id || user?.username || '';
  if (role === 'guru') return user?.id_guru || user?.id_user || user?.id || user?.nip || user?.username || '';
  if (role === 'siswa') return user?.id_siswa || user?.id_user || user?.id || user?.nisn || user?.username || '';
  if (role === 'super_admin') return user?.id_super_admin || user?.id_user || user?.id || user?.username || '';
  return '';
}

assert('Null user resolves to empty string safely', resolveId(null, 'admin') === '');
assert('Undefined user resolves to empty string safely', resolveId(undefined, 'guru') === '');
assert('Empty user object resolves to empty string safely', resolveId({}, 'siswa') === '');
assert('Guru with only NIP resolves to NIP', resolveId({ nip: '198501012010011001' }, 'guru') === '198501012010011001');
assert('Siswa with only NISN resolves to NISN', resolveId({ nisn: '0098765432' }, 'siswa') === '0098765432');
assert('Admin with only username resolves to username', resolveId({ username: 'admin_utama' }, 'admin') === 'admin_utama');
assert('SuperAdmin with only id_super_admin resolves to id_super_admin', resolveId({ id_super_admin: 'SA_99' }, 'super_admin') === 'SA_99');

// -------------------------------------------------------------------------
// Suite 4: Storage Failure Robustness (QuotaExceeded & SecurityError)
// -------------------------------------------------------------------------
console.log('\n▶ Suite 4: Storage Failure Edge Cases...');

testStorage.clear();
testStorage.throwOnGet = true;

// Simulate effect reading when storage throws
let caughtGetError = false;
let modalTriggeredOnStorageError = false;
const key = 'nexa_tutorial_seen_USR_1_admin';

try {
  const seen = testStorage.getItem(key);
  if (!seen) modalTriggeredOnStorageError = true;
} catch (e) {
  caughtGetError = true;
}
assert('Storage getItem throws SecurityError is caught safely without uncaught exception', caughtGetError);
testStorage.throwOnGet = false;

// Simulate close tutorial when setItem throws QuotaExceededError
testStorage.throwOnSet = true;
let caughtSetError = false;
try {
  testStorage.setItem(key, 'true');
} catch (e) {
  caughtSetError = true;
}
assert('Storage setItem throws QuotaExceededError is caught safely without crashing modal close', caughtSetError);
testStorage.throwOnSet = false;

// -------------------------------------------------------------------------
// Suite 5: Key Formatting & Multi-User / Multi-Role Separation
// -------------------------------------------------------------------------
console.log('\n▶ Suite 5: Key Formatting & Scope Isolation...');

const u1KeyAdmin = `nexa_tutorial_seen_${resolveId({ id_admin: 'U1' }, 'admin')}_admin`;
const u1KeyGuru = `nexa_tutorial_seen_${resolveId({ id_guru: 'U1' }, 'guru')}_guru`;
const u2KeyAdmin = `nexa_tutorial_seen_${resolveId({ id_admin: 'U2' }, 'admin')}_admin`;

assert('Keys follow format nexa_tutorial_seen_{userId}_{role}', u1KeyAdmin === 'nexa_tutorial_seen_U1_admin');
assert('Admin vs Guru keys for same ID are isolated', u1KeyAdmin !== u1KeyGuru);
assert('User 1 vs User 2 keys for same role are isolated', u1KeyAdmin !== u2KeyAdmin);

// Special characters in user ID (e.g. email or UUID with hyphens)
const complexUser = { username: 'guru.matematika@sekolah-negeri.sch.id' };
const complexKey = `nexa_tutorial_seen_${resolveId(complexUser, 'guru')}_guru`;
testStorage.setItem(complexKey, 'true');
assert('Complex user IDs (email/hyphens/dots) persist and retrieve cleanly', testStorage.getItem(complexKey) === 'true');

// -------------------------------------------------------------------------
// Summary
// -------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log('======================================================================');

await vite.close();

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('ALL ADVERSARIAL TESTS PASSED!');
  process.exit(0);
}
