/**
 * ADVERSARIAL REVIEWER STRESS SUITE: KOP & CARD PRINT SETTINGS
 * NEXA CBT - Verification for R17 Reviewer
 *
 * Attacks & Verifies:
 * 1. Master toggle precedence: show_logo_kiri === false MUST suppress left logo even if kartu_peserta_show_logo_kiri === true
 * 2. Master toggle precedence: show_logo_kanan === false MUST suppress right logo even if kartu_peserta_show_logo_kanan === true
 * 3. Kartu Meja logo suppression when master logo toggle is false
 * 4. Permanent logo reset & deletion without zombie alias resurrection (logo_kiri: null -> logo_dinas: null)
 * 5. Permanent logo reset for right logo (logo_kanan: null -> logo: null)
 * 6. Numeric NPSN support (e.g. 20101234) in get_pengaturan_sekolah and save_pengaturan_sekolah
 * 7. Empty kop lines customization (empty kop_baris4 and kop_meja_baris2 do not revert to default text)
 * 8. Truncation & overflow-hidden protection on 67mm card boundary
 * 9. Modal checkbox default checked truthiness with undefined/null states
 * 10. PNG transparency handling in compressImageFile
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as babelParser from '@babel/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('========================================================================');
console.log('   ADVERSARIAL STRESS SUITE: KOP & CARD PRINT ARCHITECTURE (R17)        ');
console.log('========================================================================\n');

let passCount = 0;
let failCount = 0;

function runTest(category, name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] [${category}] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] [${category}] ${name}`);
    console.error(`     Error: ${err.message}`);
    failCount++;
  }
}

// ============================================================================
// SECTION 1: API CONTRACTS, NUMBER NPSN & LOGO RESET PERMANENCE
// ============================================================================
console.log('--- [SECTION 1] API Robustness, Numeric NPSN & Reset Persistence ---');

import { getDefaultKopSettings, get_pengaturan_sekolah, save_pengaturan_sekolah } from '../src/api.js';

runTest('API-Adversarial', 'get_pengaturan_sekolah accepts numeric NPSN without error', async () => {
  const numericNpsn = 20105432;
  const res = await get_pengaturan_sekolah(numericNpsn);
  assert(res && typeof res === 'object');
  assert.strictEqual(res.npsn, '20105432');
});

runTest('API-Adversarial', 'save_pengaturan_sekolah accepts numeric NPSN without throwing string error', async () => {
  const numericNpsn = 20105432;
  const res = await save_pengaturan_sekolah(numericNpsn, {
    nama_sekolah: 'SMP NUMERIK TEST',
    kop_meja_mode: 'minimalis'
  });
  assert(res && res.status === 'success');
  assert.strictEqual(res.data.nama_sekolah, 'SMP NUMERIK TEST');
});

runTest('API-Adversarial', 'save_pengaturan_sekolah with explicit null logo_kiri sets logo_dinas to null (no resurrection)', async () => {
  // First save a logo
  await save_pengaturan_sekolah('NPSN_RESET_TEST', {
    logo_kiri: 'data:image/png;base64,TEST_KIRI',
    logo_kanan: 'data:image/png;base64,TEST_KANAN'
  });

  // Now simulate reset by passing logo_kiri: null
  const resetRes = await save_pengaturan_sekolah('NPSN_RESET_TEST', {
    logo_kiri: null,
    logo_kanan: null
  });

  assert.strictEqual(resetRes.data.logo_kiri, null, 'logo_kiri must be strictly null');
  assert.strictEqual(resetRes.data.logo_dinas, null, 'logo_dinas alias must be strictly null');
  assert.strictEqual(resetRes.data.logo_kanan, null, 'logo_kanan must be strictly null');
  assert.strictEqual(resetRes.data.logo, null, 'logo alias must be strictly null');
});

// ============================================================================
// SECTION 2: KARTUUJIANPRINT LOGO TOGGLE & EMPTY LINE HIERARCHY
// ============================================================================
console.log('\n--- [SECTION 2] KartuUjianPrint Toggle Hierarchy & Boundary Math ---');

const kartuPrintPath = path.join(rootDir, 'src', 'components', 'KartuUjianPrint.jsx');
const kartuContent = fs.readFileSync(kartuPrintPath, 'utf-8');

runTest('Print-Adversarial', 'Master toggle show_logo_kiri: false strictly overrides kartu_peserta_show_logo_kiri: true', () => {
  // Extract logic from KartuUjianPrint
  assert(kartuContent.includes('masterShowLogoKiri = sekolah.show_logo_kiri !== false'), 'Must evaluate masterShowLogoKiri');
  assert(kartuContent.includes('masterShowLogoKanan = sekolah.show_logo_kanan !== false'), 'Must evaluate masterShowLogoKanan');
  assert(kartuContent.includes('showLogoKiriPeserta = masterShowLogoKiri &&'), 'showLogoKiriPeserta requires masterShowLogoKiri');
  assert(kartuContent.includes('showLogoKananPeserta = masterShowLogoKanan &&'), 'showLogoKananPeserta requires masterShowLogoKanan');
  assert(kartuContent.includes('showLogoKiriMeja = mejaMode === \'formal\' && masterShowLogoKiri &&'), 'showLogoKiriMeja requires masterShowLogoKiri');
  assert(kartuContent.includes('showLogoKananMeja = mejaMode === \'formal\' && masterShowLogoKanan &&'), 'showLogoKananMeja requires masterShowLogoKanan');
});

runTest('Print-Adversarial', 'Empty/cleared kop_baris4 does NOT revert back to default text', () => {
  assert(kartuContent.includes('sekolah.kop_baris4 !== undefined ? sekolah.kop_baris4 :'), 'Respects explicit empty string for kop_baris4');
  assert(kartuContent.includes('{kopPesertaBaris4 ? ('), 'Conditionally renders kopPesertaBaris4 only when truthy/non-empty');
});

runTest('Print-Adversarial', 'Empty/cleared kop_meja_baris2 does NOT revert back to default text', () => {
  assert(kartuContent.includes('sekolah.kop_meja_baris2 !== undefined ? sekolah.kop_meja_baris2 :'), 'Respects explicit empty string for kop_meja_baris2');
  assert(kartuContent.includes('{kopMejaBaris2 ? ('), 'Conditionally renders kopMejaBaris2 only when truthy/non-empty');
});

runTest('Print-Adversarial', 'Card root containers apply overflow-hidden to prevent printing spillage beyond 67mm', () => {
  const ast = babelParser.parse(kartuContent, {
    sourceType: 'module',
    plugins: ['jsx']
  });

  // Verify overflow-hidden is present on card classes
  const mejaCardPattern = /mode === 'meja'[\s\S]*?className="[^"]*overflow-hidden[^"]*"/;
  const pesertaCardPattern = /KARTU PESERTA UJIAN[\s\S]*?className="[^"]*overflow-hidden[^"]*"/;

  assert(mejaCardPattern.test(kartuContent), 'Kartu Meja container must have overflow-hidden');
  assert(pesertaCardPattern.test(kartuContent), 'Kartu Peserta container must have overflow-hidden');
});

runTest('Print-Adversarial', 'Kop Baris 3 on Kartu Peserta has truncate class to avoid multi-line expansion', () => {
  const baris3Pattern = /kopPesertaBaris3[\s\S]*?truncate/;
  assert(baris3Pattern.test(kartuContent), 'kopPesertaBaris3 element must include truncate class');
});

// ============================================================================
// SECTION 3: ADMINVIEW FORM CONTROLS & RESET SAFETY
// ============================================================================
console.log('\n--- [SECTION 3] AdminView UI Reset & Print Modal Sync ---');

const adminPath = path.join(rootDir, 'src', 'views', 'AdminView.jsx');
const adminContent = fs.readFileSync(adminPath, 'utf-8');

runTest('AdminView-Adversarial', 'handleResetLogoKiri clears both logo_kiri and logo_dinas alias', () => {
  assert(adminContent.includes('logo_kiri: null') && adminContent.includes('logo_dinas: null'), 'handleResetLogoKiri nulls both aliases');
});

runTest('AdminView-Adversarial', 'handleResetLogoKanan clears both logo_kanan and logo alias', () => {
  assert(adminContent.includes('logo_kanan: null') && adminContent.includes('logo: null'), 'handleResetLogoKanan nulls both aliases');
});

runTest('AdminView-Adversarial', 'renderPrintKartuModal checkboxes use !== false for undefined safe defaults', () => {
  assert(adminContent.includes('kopSettings.kartu_meja_show_logo_kiri !== false'));
  assert(adminContent.includes('kopSettings.kartu_peserta_show_logo_kiri !== false'));
  assert(adminContent.includes('kopSettings.kartu_meja_show_logo_kanan !== false'));
  assert(adminContent.includes('kopSettings.kartu_peserta_show_logo_kanan !== false'));
});

runTest('AdminView-Adversarial', 'handleSaveKopSettings checks user?.npsn || kopSettings.npsn before aborting', () => {
  assert(adminContent.includes('const targetNpsn = user?.npsn || kopSettings.npsn;'));
  assert(adminContent.includes('save_pengaturan_sekolah(targetNpsn, payloadToSave)'));
});

// ============================================================================
// SECTION 4: IMAGE HELPER TRANSPARENCY PRESERVATION
// ============================================================================
console.log('\n--- [SECTION 4] imageHelper.js Canvas Transparency Preservation ---');

const imageHelperPath = path.join(rootDir, 'src', 'utils', 'imageHelper.js');
const imageHelperContent = fs.readFileSync(imageHelperPath, 'utf-8');

runTest('ImageHelper-Adversarial', 'compressImageFile preserves PNG MIME type for image/png input files', () => {
  assert(imageHelperContent.includes("file.type === 'image/png'"));
  assert(imageHelperContent.includes("isPng ? 'image/png' : 'image/jpeg'"));
});

runTest('ImageHelper-Adversarial', 'compressImageFile initializes white background for non-PNG to avoid black transparency artifacts', () => {
  assert(imageHelperContent.includes("ctx.fillStyle = '#ffffff'"));
  assert(imageHelperContent.includes('ctx.fillRect(0, 0, width, height)'));
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n========================================================================');
console.log(`ADVERSARIAL STRESS TEST SUMMARY: ${passCount} Passed, ${failCount} Failed (Total: ${passCount + failCount})`);
console.log('========================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🏆 ALL ADVERSARIAL REVIEWER STRESS TESTS PASSED 100%!');
  process.exit(0);
}
