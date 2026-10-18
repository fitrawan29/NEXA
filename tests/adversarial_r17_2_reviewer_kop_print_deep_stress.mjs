import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as babelParser from '@babel/parser';

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
console.log('   DEEP ADVERSARIAL STRESS SUITE: KOP & CARD PRINT VERIFICATION (R17.2) ');
console.log('========================================================================');

// ============================================================================
// SECTION 1: API VALIDATION & ARRAY ATTACK
// ============================================================================
console.log('\n--- [SECTION 1] API Validation & Robustness Against Malicious Payloads ---');

import { getDefaultKopSettings, get_pengaturan_sekolah, save_pengaturan_sekolah } from '../src/api.js';

await runAsyncTest('API-Adversarial', 'save_pengaturan_sekolah strictly rejects Array payload', async () => {
  await assert.rejects(async () => {
    await save_pengaturan_sekolah('12345678', ['injected', 'array', 'element']);
  }, /Payload must be an object/);
});

await runAsyncTest('API-Adversarial', 'save_pengaturan_sekolah rejects null and non-object primitive payloads', async () => {
  await assert.rejects(async () => {
    await save_pengaturan_sekolah('12345678', 'plain-string-payload');
  }, /Payload must be an object/);
  await assert.rejects(async () => {
    await save_pengaturan_sekolah('12345678', 123456);
  }, /Payload must be an object/);
});

// ============================================================================
// SECTION 2: PRINT PAYLOAD HEADMASTER & NPSN RESOLUTION
// ============================================================================
console.log('\n--- [SECTION 2] AdminView Print Payload Headmaster & NPSN Hierarchy ---');

const adminPath = path.join(rootDir, 'src', 'views', 'AdminView.jsx');
const adminContent = fs.readFileSync(adminPath, 'utf-8');

runTest('AdminView-Sync', 'handleGeneratePrintKartu uses kopSettings.kepala_sekolah before user fallback', () => {
  assert(
    adminContent.includes('namaKepalaSekolah: printKartuModal.namaKepalaSekolah || kopSettings.kepala_sekolah || user.kepala_sekolah || \'\''),
    'namaKepalaSekolah must check kopSettings.kepala_sekolah before user.kepala_sekolah'
  );
  assert(
    adminContent.includes('nipKepalaSekolah: printKartuModal.nipKepalaSekolah || kopSettings.nip_kepala_sekolah || user.nip_kepala_sekolah || \'\''),
    'nipKepalaSekolah must check kopSettings.nip_kepala_sekolah before user.nip_kepala_sekolah'
  );
});

runTest('AdminView-Sync', 'handleGeneratePrintKartu uses kopSettings.npsn before user fallback', () => {
  assert(
    adminContent.includes('npsn: kopSettings.npsn || user.npsn || \'\''),
    'sekolah.npsn must check kopSettings.npsn before user.npsn'
  );
});

runTest('AdminView-Sync', 'renderPrintKartuModal input placeholders display kopSettings headmaster info', () => {
  assert(
    adminContent.includes('placeholder={kopSettings.kepala_sekolah || user.kepala_sekolah || \'Nama Kepala Sekolah\'}'),
    'Headmaster name input placeholder must reflect kopSettings.kepala_sekolah'
  );
  assert(
    adminContent.includes('placeholder={kopSettings.nip_kepala_sekolah || user.nip_kepala_sekolah || \'-\'}'),
    'Headmaster NIP input placeholder must reflect kopSettings.nip_kepala_sekolah'
  );
});

// ============================================================================
// SECTION 3: MODAL CHECKBOX & MASTER LOGO SYNC
// ============================================================================
console.log('\n--- [SECTION 3] Print Modal Checkboxes & Master Logo Synchronization ---');

runTest('Modal-Sync', 'renderPrintKartuModal checkboxes factor in master show_logo flags', () => {
  assert(
    adminContent.includes('checked={kopSettings.show_logo_kiri !== false && (printKartuModal.mode === \'meja\' ? kopSettings.kartu_meja_show_logo_kiri !== false : kopSettings.kartu_peserta_show_logo_kiri !== false)}'),
    'Modal Logo Kiri checkbox must be gated by master show_logo_kiri'
  );
  assert(
    adminContent.includes('checked={kopSettings.show_logo_kanan !== false && (printKartuModal.mode === \'meja\' ? kopSettings.kartu_meja_show_logo_kanan !== false : kopSettings.kartu_peserta_show_logo_kanan !== false)}'),
    'Modal Logo Kanan checkbox must be gated by master show_logo_kanan'
  );
});

runTest('Modal-Sync', 'Toggling modal checkboxes to true also activates master show_logo flags', () => {
  assert(
    adminContent.includes('show_logo_kiri: checked ? true : prev.show_logo_kiri'),
    'Enabling logo in modal must activate master show_logo_kiri'
  );
  assert(
    adminContent.includes('show_logo_kanan: checked ? true : prev.show_logo_kanan'),
    'Enabling logo in modal must activate master show_logo_kanan'
  );
});

// ============================================================================
// SECTION 4: LIVE PREVIEW & EXPLICIT EMPTY STRING RESPECT
// ============================================================================
console.log('\n--- [SECTION 4] Live Preview & Explicit Empty String Synchronization ---');

runTest('LivePreview-Sync', 'Live preview for Kartu Peserta omits kop_baris4 when explicitly cleared ("")', () => {
  assert(
    adminContent.includes('kopSettings.kop_baris4 ?') &&
    adminContent.includes('kopSettings.kop_baris4 === undefined ?'),
    'kop_baris4 in live preview must check truthiness before falling back to undefined default'
  );
});

runTest('LivePreview-Sync', 'Live preview for Kartu Meja omits kop_meja_baris2 when explicitly cleared ("")', () => {
  assert(
    adminContent.includes('kopSettings.kop_meja_baris2 ?') &&
    adminContent.includes('kopSettings.kop_meja_baris2 === undefined ?'),
    'kop_meja_baris2 in live preview must check truthiness before falling back to undefined default'
  );
});

// ============================================================================
// SECTION 5: FILE INPUT VALUE RE-SELECTION SAFETY
// ============================================================================
console.log('\n--- [SECTION 5] File Input Value Re-selection Safety ---');

runTest('FileInput-Safety', 'handleUploadLogoKiri and handleUploadLogoKanan reset e.target.value in finally', () => {
  const uploadKiriPattern = /handleUploadLogoKiri[\s\S]*?finally\s*\{[\s\S]*?e\.target\.value\s*=\s*'';/;
  const uploadKananPattern = /handleUploadLogoKanan[\s\S]*?finally\s*\{[\s\S]*?e\.target\.value\s*=\s*'';/;
  assert(uploadKiriPattern.test(adminContent), 'handleUploadLogoKiri must reset e.target.value in finally');
  assert(uploadKananPattern.test(adminContent), 'handleUploadLogoKanan must reset e.target.value in finally');
});

runTest('FileInput-Safety', 'handleResetLogoKiri and handleResetLogoKanan reset DOM file inputs', () => {
  assert(adminContent.includes("document.getElementById('file_input_logo_kiri')"), 'handleResetLogoKiri resets input element');
  assert(adminContent.includes("document.getElementById('file_input_logo_kanan')"), 'handleResetLogoKanan resets input element');
});

// ============================================================================
// SECTION 6: KARTUUJIANPRINT MARGINS & PRINT SHEET RESETS
// ============================================================================
console.log('\n--- [SECTION 6] KartuUjianPrint Margins & Print-Sheet Resets ---');

const kartuPath = path.join(rootDir, 'src', 'components', 'KartuUjianPrint.jsx');
const kartuContent = fs.readFileSync(kartuPath, 'utf-8');

runTest('Print-Engine', 'KartuUjianPrint defines @page :left and @page :right to prevent global 15mm asymmetry', () => {
  assert(kartuContent.includes('@page :left {'), 'Must specify @page :left');
  assert(kartuContent.includes('@page :right {'), 'Must specify @page :right');
});

runTest('Print-Engine', 'KartuUjianPrint resets .print-sheet min-height to 0 !important in @media print', () => {
  const sheetResetPattern = /\.print-sheet\s*\{[\s\S]*?min-height:\s*0\s*!important;/;
  assert(sheetResetPattern.test(kartuContent), '.print-sheet must reset min-height to 0 !important in print media');
});

// ============================================================================
// SECTION 7: IMAGE HELPER DIMENSION GUARD
// ============================================================================
console.log('\n--- [SECTION 7] imageHelper.js Dimension Guard ---');

const imageHelperPath = path.join(rootDir, 'src', 'utils', 'imageHelper.js');
const imageHelperContent = fs.readFileSync(imageHelperPath, 'utf-8');

runTest('ImageHelper', 'compressImageFile checks for zero or invalid image dimensions', () => {
  assert(
    imageHelperContent.includes('!width || !height || width <= 0 || height <= 0'),
    'compressImageFile must reject images with zero or invalid dimensions'
  );
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n========================================================================');
console.log(`DEEP ADVERSARIAL STRESS TEST SUMMARY: ${passCount} Passed, ${failCount} Failed (Total: ${passCount + failCount})`);
console.log('========================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🏆 ALL DEEP ADVERSARIAL REVIEWER TESTS PASSED 100%!');
  process.exit(0);
}
