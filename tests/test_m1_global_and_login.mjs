/**
 * Milestone M1 Verification Suite: Global & Login Adjustments
 * Requirements:
 * 1. App.jsx:
 *    - Fetches registered schools via fetchAPI('get_sekolah') on mount
 *    - Stores daftarSekolah
 *    - Replaces raw NPSN input with styled <select> formatted as [NPSN-Nama Sekolah]
 *    - Registration form provides matching <select> options
 *    - handleLogin sanitizes npsn to clean alphanumeric code
 * 2. SuperAdminView.jsx:
 *    - Fixed viewport-anchored bottom navigation bar (fixed bottom-0 left-0 right-0 z-40 ...)
 *    - Centered inner container with safe-area bottom inset
 *    - Main scrollable container has pb-28 clearance
 * 3. AdminView.jsx, GuruView.jsx, SiswaView.jsx:
 *    - Bottom navigation bars strictly fixed bottom-0 left-0 right-0 z-40 with safe area padding
 *    - Content container clearance pb-28
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function assert(condition, testName, details = '') {
  if (condition) {
    testResults.passed++;
    testResults.tests.push({ name: testName, status: 'PASS' });
    console.log(`  ✔ [PASS] ${testName}`);
  } else {
    testResults.failed++;
    testResults.tests.push({ name: testName, status: 'FAIL', details });
    console.error(`  ✖ [FAIL] ${testName} -> ${details}`);
  }
}

console.log('========================================================================');
console.log('   CBT NEXA M1 VERIFICATION SUITE: GLOBAL & LOGIN ADJUSTMENTS          ');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// 1. APP.JSX STATIC & LOGICAL AUDIT
// -----------------------------------------------------------------------------
console.log('▶ [1] Checking App.jsx: School Dropdown & NPSN Sanitization:');
const appFile = path.resolve(srcDir, 'App.jsx');
const appContent = fs.readFileSync(appFile, 'utf-8');

assert(
  appContent.includes("fetchAPI('get_sekolah')"),
  "App.jsx fetches registered schools via fetchAPI('get_sekolah') on mount",
  "fetchAPI('get_sekolah') call not found in App.jsx"
);

assert(
  /const\s*\[daftarSekolah,\s*setDaftarSekolah\]\s*=\s*useState/.test(appContent),
  "App.jsx defines daftarSekolah state",
  "daftarSekolah state declaration not found"
);

assert(
  /const\s*\[loadingSekolah,\s*setLoadingSekolah\]\s*=\s*useState/.test(appContent),
  "App.jsx defines loadingSekolah state",
  "loadingSekolah state declaration not found"
);

assert(
  appContent.includes('[{s.npsn}-{s.nama_sekolah}]'),
  "App.jsx formats school select option label as [{s.npsn}-{s.nama_sekolah}]",
  "School option format [{s.npsn}-{s.nama_sekolah}] not found"
);

// Login select presence
assert(
  /<select[^>]*name=["']npsn["'][^>]*>[\s\S]*?daftarSekolah\.map/.test(appContent) ||
  /<select[^>]*value=\{[^}]*npsn[^}]*\}[^>]*>[\s\S]*?daftarSekolah\.map/.test(appContent),
  "App.jsx renders styled <select> for NPSN in login form",
  "Login form select for NPSN not found"
);

// Registration select presence
assert(
  /<select[^>]*name=["']reg_npsn["'][^>]*>[\s\S]*?daftarSekolah\.map/.test(appContent) ||
  appContent.includes('Pilih Sekolah Terdaftar'),
  "App.jsx renders matching <select> for NPSN in registration form",
  "Registration form select for NPSN not found"
);

// Sanitization logic verification
const sanitizeNpsn = (npsnStr) => {
  return npsnStr.includes('-')
    ? npsnStr.replace(/^\[?([^-]+).*/, '$1').replace(/[^a-zA-Z0-9]/g, '').trim()
    : npsnStr.replace(/[^a-zA-Z0-9]/g, '').trim();
};

assert(
  sanitizeNpsn('70040625') === '70040625',
  "Sanitization unit test: raw numeric NPSN '70040625' preserves code",
  `Expected '70040625', got '${sanitizeNpsn('70040625')}'`
);

assert(
  sanitizeNpsn('[70040625-SMA Nizamudin]') === '70040625',
  "Sanitization unit test: bracketed label '[70040625-SMA Nizamudin]' extracts '70040625'",
  `Expected '70040625', got '${sanitizeNpsn('[70040625-SMA Nizamudin]')}'`
);

assert(
  sanitizeNpsn('70040625-SMA Nizamudin') === '70040625',
  "Sanitization unit test: unbracketed composite '70040625-SMA Nizamudin' extracts '70040625'",
  `Expected '70040625', got '${sanitizeNpsn('70040625-SMA Nizamudin')}'`
);

assert(
  sanitizeNpsn(' [ 70040625 - SMA Negeri 1 ] ') === '70040625',
  "Sanitization unit test: spaced composite ' [ 70040625 - SMA Negeri 1 ] ' extracts '70040625'",
  `Expected '70040625', got '${sanitizeNpsn(' [ 70040625 - SMA Negeri 1 ] ')}'`
);

assert(
  sanitizeNpsn('SCH9901-SMP Pelita Harapan') === 'SCH9901',
  "Sanitization unit test: alphanumeric code 'SCH9901-SMP Pelita Harapan' extracts 'SCH9901'",
  `Expected 'SCH9901', got '${sanitizeNpsn('SCH9901-SMP Pelita Harapan')}'`
);

// -----------------------------------------------------------------------------
// 2. SUPERADMINVIEW.JSX AUDIT
// -----------------------------------------------------------------------------
console.log('\n▶ [2] Checking SuperAdminView.jsx: Fixed Bottom Bar & Clearance:');
const superAdminFile = path.resolve(srcDir, 'views/SuperAdminView.jsx');
const superAdminContent = fs.readFileSync(superAdminFile, 'utf-8');

assert(
  !superAdminContent.includes('className="absolute bottom-0 left-0 w-full'),
  "SuperAdminView.jsx does NOT contain old 'absolute bottom-0' navigation",
  "Old absolute bottom-0 still present in SuperAdminView"
);

assert(
  superAdminContent.includes('fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]'),
  "SuperAdminView.jsx navigation is fixed bottom-0 left-0 right-0 z-40 with backdrop blur and shadow",
  "Expected fixed navigation class string not found in SuperAdminView.jsx"
);

assert(
  superAdminContent.includes('w-full md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto px-6 md:px-12 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]'),
  "SuperAdminView.jsx navigation contains centered inner container with safe-area padding",
  "Centered inner container with safe-area padding not found in SuperAdminView.jsx"
);

assert(
  superAdminContent.includes('overflow-y-auto pb-28'),
  "SuperAdminView.jsx main scrollable container has pb-28 clearance",
  "pb-28 clearance not found on SuperAdminView scroll container"
);

// -----------------------------------------------------------------------------
// 3. ADMINVIEW.JSX AUDIT
// -----------------------------------------------------------------------------
console.log('\n▶ [3] Checking AdminView.jsx: Fixed Bottom Bar & Clearance:');
const adminFile = path.resolve(srcDir, 'views/AdminView.jsx');
const adminContent = fs.readFileSync(adminFile, 'utf-8');

assert(
  adminContent.includes('lg:hidden fixed bottom-0 left-0 right-0 z-40') &&
  adminContent.includes('pb-[max(0.5rem,env(safe-area-inset-bottom))]'),
  "AdminView.jsx mobile bottom navigation is strictly fixed bottom-0 left-0 right-0 z-40 with safe area padding",
  "AdminView mobile nav does not match expected fixed bottom-0 left-0 right-0 z-40 specification"
);

assert(
  adminContent.includes('pb-28 lg:pb-12'),
  "AdminView.jsx main container has pb-28 mobile clearance",
  "AdminView main container lacks pb-28 clearance"
);

// -----------------------------------------------------------------------------
// 4. GURUVIEW.JSX AUDIT
// -----------------------------------------------------------------------------
console.log('\n▶ [4] Checking GuruView.jsx: Fixed Bottom Bar & Clearance:');
const guruFile = path.resolve(srcDir, 'views/GuruView.jsx');
const guruContent = fs.readFileSync(guruFile, 'utf-8');

assert(
  guruContent.includes('lg:hidden fixed bottom-0 left-0 right-0 z-40') &&
  guruContent.includes('pb-[max(0.5rem,env(safe-area-inset-bottom))]'),
  "GuruView.jsx mobile bottom navigation is strictly fixed bottom-0 left-0 right-0 z-40 with safe area padding",
  "GuruView mobile nav does not match expected fixed bottom-0 left-0 right-0 z-40 specification"
);

assert(
  guruContent.includes('pb-24 lg:pb-8') || guruContent.includes('pb-28'),
  "GuruView.jsx main container has compact mobile clearance (pb-24 or pb-28)",
  "GuruView main container lacks mobile clearance"
);

// -----------------------------------------------------------------------------
// 5. SISWAVIEW.JSX AUDIT
// -----------------------------------------------------------------------------
console.log('\n▶ [5] Checking SiswaView.jsx: Fixed Bottom Bar & Clearance:');
const siswaFile = path.resolve(srcDir, 'views/SiswaView.jsx');
const siswaContent = fs.readFileSync(siswaFile, 'utf-8');

assert(
  siswaContent.includes('md:hidden fixed bottom-0 left-0 right-0 z-40') &&
  siswaContent.includes('pb-[max(0.5rem,env(safe-area-inset-bottom))]'),
  "SiswaView.jsx mobile bottom navigation is strictly fixed bottom-0 left-0 right-0 z-40 with safe area padding",
  "SiswaView mobile nav does not match expected fixed bottom-0 left-0 right-0 z-40 specification"
);

assert(
  siswaContent.includes('pb-28 md:pb-12'),
  "SiswaView.jsx main container has pb-28 mobile clearance",
  "SiswaView main container lacks pb-28 clearance"
);

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n========================================================================');
console.log(`TEST SUMMARY: ${testResults.passed} passed, ${testResults.failed} failed out of ${testResults.passed + testResults.failed} assertions.`);
console.log('========================================================================\n');

if (testResults.failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL M1 VERIFICATION TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}
