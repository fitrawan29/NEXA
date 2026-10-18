import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as babelParser from '@babel/parser';

// Setup Mock LocalStorage for Node environment
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  get length() {
    return this.store.size;
  }
  key(index) {
    return Array.from(this.store.keys())[index] || null;
  }
}

const mockStorage = new MockLocalStorage();
globalThis.localStorage = mockStorage;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let passCount = 0;
let failCount = 0;

function runTest(section, name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] [${section}] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] [${section}] ${name}`);
    console.error(`     Error: ${err.message}`);
    failCount++;
  }
}

async function runAsyncTest(section, name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] [${section}] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] [${section}] ${name}`);
    console.error(`     Error: ${err.message}`);
    failCount++;
  }
}

console.log('========================================================================');
console.log('   HARDCORE ADVERSARIAL REVIEWER STRESS SUITE: KOP & PRINT (R17.3)      ');
console.log('========================================================================');

// ============================================================================
// SECTION 1: CONTROLLED INPUT VALUE PROP DEFENSE
// ============================================================================
console.log('\n--- [SECTION 1] Controlled React Input Behavior in Settings Tab ---');

const adminPath = path.join(rootDir, 'src', 'views', 'AdminView.jsx');
const adminContent = fs.readFileSync(adminPath, 'utf-8');

runTest('ControlledInputs', 'NPSN input allows empty string without reverting to user.npsn via ||', () => {
  assert(
    adminContent.includes('value={kopSettings.npsn !== undefined ? kopSettings.npsn : (user.npsn || \'\')}'),
    'NPSN input must check !== undefined so empty string remains editable'
  );
});

runTest('ControlledInputs', 'kop_baris2 input allows empty string without reverting to nama_sekolah', () => {
  assert(
    adminContent.includes('value={kopSettings.kop_baris2 !== undefined ? kopSettings.kop_baris2 : (kopSettings.nama_sekolah || user.nama_sekolah || \'\')}'),
    'kop_baris2 input must check !== undefined'
  );
});

runTest('ControlledInputs', 'kop_meja_baris1 input allows empty string without reverting to nama_sekolah', () => {
  assert(
    adminContent.includes('value={kopSettings.kop_meja_baris1 !== undefined ? kopSettings.kop_meja_baris1 : (kopSettings.nama_sekolah || user.nama_sekolah || \'\')}'),
    'kop_meja_baris1 input must check !== undefined'
  );
});

// ============================================================================
// SECTION 2: API PRESERVATION OF EXPLICIT EMPTY STRINGS & LOGO CACHE
// ============================================================================
console.log('\n--- [SECTION 2] API Preservation of Explicit Empty Strings & Partial Updates ---');

import { getDefaultKopSettings, get_pengaturan_sekolah, save_pengaturan_sekolah } from '../src/api.js';

runTest('API-EmptyStrings', 'getDefaultKopSettings preserves explicitly cleared kop_baris1 ("")', () => {
  const custom = getDefaultKopSettings({ kop_baris1: '' });
  assert.strictEqual(custom.kop_baris1, '', 'kop_baris1 should remain empty string');
});

runTest('API-EmptyStrings', 'getDefaultKopSettings preserves explicitly cleared kop_baris4 ("")', () => {
  const custom = getDefaultKopSettings({ npsn: '12345678', kop_baris4: '' });
  assert.strictEqual(custom.kop_baris4, '', 'kop_baris4 should remain empty string');
});

runTest('API-EmptyStrings', 'getDefaultKopSettings preserves explicitly cleared kop_meja_baris2 ("")', () => {
  const custom = getDefaultKopSettings({ kop_meja_baris2: '' });
  assert.strictEqual(custom.kop_meja_baris2, '', 'kop_meja_baris2 should remain empty string');
});

await runAsyncTest('API-PartialUpdate', 'save_pengaturan_sekolah preserves cached logo on partial update omitting logos', async () => {
  // First, save with logos
  await save_pengaturan_sekolah('TEST_LOGO_PRESERVE', {
    nama_sekolah: 'SMA 1 PRESERVE',
    logo_kiri: 'data:image/png;base64,PRESERVED_KIRI',
    logo_kanan: 'data:image/png;base64,PRESERVED_KANAN'
  });

  // Next, update only school name without touching logo fields
  const partialRes = await save_pengaturan_sekolah('TEST_LOGO_PRESERVE', {
    nama_sekolah: 'SMA 1 PRESERVE UPDATED'
  });

  assert.strictEqual(partialRes.data.nama_sekolah, 'SMA 1 PRESERVE UPDATED');
  assert.strictEqual(partialRes.data.logo_kiri, 'data:image/png;base64,PRESERVED_KIRI', 'logo_kiri must not be wiped by partial update');
  assert.strictEqual(partialRes.data.logo_kanan, 'data:image/png;base64,PRESERVED_KANAN', 'logo_kanan must not be wiped by partial update');
});

await runAsyncTest('API-PartialUpdate', 'save_pengaturan_sekolah resets logos when explicitly passed null', async () => {
  const resetRes = await save_pengaturan_sekolah('TEST_LOGO_PRESERVE', {
    logo_kiri: null,
    logo_kanan: null
  });

  assert.strictEqual(resetRes.data.logo_kiri, null, 'Explicit null resets logo_kiri');
  assert.strictEqual(resetRes.data.logo_kanan, null, 'Explicit null resets logo_kanan');
});

// ============================================================================
// SECTION 3: KARTUUJIANPRINT CASE-INSENSITIVE MODE & FIRST PAGE MARGINS
// ============================================================================
console.log('\n--- [SECTION 3] KartuUjianPrint Mode Normalization & @page :first ---');

const kartuPath = path.join(rootDir, 'src', 'components', 'KartuUjianPrint.jsx');
const kartuContent = fs.readFileSync(kartuPath, 'utf-8');

runTest('KartuPrint-Mode', 'KartuUjianPrint normalizes mode string safely', () => {
  assert(
    kartuContent.includes('const mode = String(rawMode || \'peserta\').toLowerCase().trim() === \'meja\' ? \'meja\' : \'peserta\';'),
    'mode must be normalized case-insensitively and trimmed'
  );
});

runTest('KartuPrint-Margins', 'KartuUjianPrint defines @page :first to prevent page 1 margin drift', () => {
  assert(kartuContent.includes('@page :first {'), 'Must specify @page :first');
  const firstMarginPattern = /@page :first\s*\{[\s\S]*?margin:\s*8mm\s*10mm\s*8mm\s*10mm;/;
  assert(firstMarginPattern.test(kartuContent), '@page :first must have 8mm 10mm margins');
});

// ============================================================================
// SECTION 4: PRINT PAYLOAD KOP LINES PRESERVATION
// ============================================================================
console.log('\n--- [SECTION 4] AdminView handleGeneratePrintKartu Kop Undefined Preservation ---');

runTest('AdminView-Payload', 'kop_baris4 in print payload preserves undefined when unset', () => {
  assert(
    adminContent.includes('kop_baris4: kopSettings.kop_baris4 !== undefined ? kopSettings.kop_baris4 : undefined'),
    'kop_baris4 must not coerce undefined into empty string'
  );
});

runTest('AdminView-Payload', 'kop_meja_baris2 in print payload preserves undefined when unset', () => {
  assert(
    adminContent.includes('kop_meja_baris2: kopSettings.kop_meja_baris2 !== undefined ? kopSettings.kop_meja_baris2 : undefined'),
    'kop_meja_baris2 must not coerce undefined into empty string'
  );
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n========================================================================');
console.log(`HARDCORE ADVERSARIAL TEST SUMMARY: ${passCount} Passed, ${failCount} Failed (Total: ${passCount + failCount})`);
console.log('========================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🏆 ALL HARDCORE ADVERSARIAL TESTS PASSED 100%!');
  process.exit(0);
}
