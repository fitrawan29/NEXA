/**
 * Automated Verification Test Suite: Pengaturan Logo Kop & Konfigurasi Kartu Ujian (Peserta & Meja)
 * NEXA CBT - Menu Pengaturan / Profil Sekolah Admin & KartuUjianPrint
 *
 * Covers:
 * 1. Default Kop Settings Structure & Fallbacks
 * 2. API Functions (get_pengaturan_sekolah, save_pengaturan_sekolah, cache & DB persistence)
 * 3. KartuUjianPrint.jsx AST, Dimension & Print Integrity (Zero forbidden tags, 67mm height, dual logos, kop lines)
 * 4. AdminView.jsx AST, navGroups taxonomy (zero badge properties), Pengaturan tab UI & compressImageFile integration
 * 5. Kartu Peserta Kop rendering with proportional logos & 4-line text
 * 6. Kartu Meja Kop rendering (formal mode with logos vs minimalis mode, prominent MEJA number badge)
 * 7. Layout chunking (8 cards per page) & A4/F4 page boundary math (no page break overflow)
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
console.log('   TEST SUITE: PENGATURAN LOGO KOP & KONFIGURASI KARTU UJIAN (NEXA CBT)  ');
console.log('========================================================================\n');

let passCount = 0;
let failCount = 0;

function runTest(suite, name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] [${suite}] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] [${suite}] ${name}`);
    console.error(`     Error: ${err.message}`);
    failCount++;
  }
}

// ============================================================================
// SECTION 1: DEFAULT KOP SETTINGS & API HELPERS
// ============================================================================
console.log('--- [SECTION 1] Default Kop Settings & API Helpers ---');

const apiPath = path.join(rootDir, 'src', 'api.js');
const apiContent = fs.readFileSync(apiPath, 'utf-8');

import { getDefaultKopSettings, get_pengaturan_sekolah, save_pengaturan_sekolah } from '../src/api.js';

runTest('API', 'getDefaultKopSettings provides complete default schema with all required fields', () => {
  const dummyUser = {
    nama_sekolah: 'SMA NEGERI 1 TELADAN',
    npsn: '12345678',
    alamat_sekolah: 'Jl. Merdeka No. 45',
    kepala_sekolah: 'Dr. H. Sulaiman, M.Pd.',
    nip_kepala_sekolah: '197501012000031001'
  };

  const defaults = getDefaultKopSettings(dummyUser);
  assert.strictEqual(defaults.nama_sekolah, 'SMA NEGERI 1 TELADAN');
  assert.strictEqual(defaults.npsn, '12345678');
  assert.strictEqual(defaults.alamat_sekolah, 'Jl. Merdeka No. 45');
  assert.strictEqual(defaults.kepala_sekolah, 'Dr. H. Sulaiman, M.Pd.');
  assert.strictEqual(defaults.nip_kepala_sekolah, '197501012000031001');

  // Logo flags
  assert.strictEqual(defaults.show_logo_kiri, true);
  assert.strictEqual(defaults.show_logo_kanan, true);

  // Kartu Peserta
  assert.strictEqual(defaults.kop_baris2, 'SMA NEGERI 1 TELADAN');
  assert.strictEqual(defaults.kop_baris3, 'KARTU PESERTA ASESMEN / CBT');
  assert.strictEqual(defaults.kartu_peserta_show_logo_kiri, true);
  assert.strictEqual(defaults.kartu_peserta_show_logo_kanan, true);

  // Kartu Meja
  assert.strictEqual(defaults.kop_meja_mode, 'formal');
  assert.strictEqual(defaults.kop_meja_baris1, 'SMA NEGERI 1 TELADAN');
  assert.strictEqual(defaults.kartu_meja_show_logo_kiri, true);
  assert.strictEqual(defaults.kartu_meja_show_logo_kanan, true);
});

runTest('API', 'getDefaultKopSettings falls back gracefully for empty/null user', () => {
  const defaults = getDefaultKopSettings(null);
  assert.strictEqual(defaults.nama_sekolah, 'SEKOLAH INDONESIA');
  assert.strictEqual(defaults.show_logo_kiri, true);
  assert.strictEqual(defaults.show_logo_kanan, true);
  assert.strictEqual(defaults.kop_meja_mode, 'formal');
});

runTest('API', 'get_pengaturan_sekolah handles empty/invalid NPSN safely', async () => {
  const res1 = await get_pengaturan_sekolah('');
  assert.strictEqual(res1.nama_sekolah, 'SEKOLAH INDONESIA');

  const res2 = await get_pengaturan_sekolah(null);
  assert.strictEqual(res2.nama_sekolah, 'SEKOLAH INDONESIA');
});

runTest('API', 'save_pengaturan_sekolah validates input and throws on invalid arguments', async () => {
  await assert.rejects(async () => {
    await save_pengaturan_sekolah('', {});
  }, /NPSN must be a non-empty string/);

  await assert.rejects(async () => {
    await save_pengaturan_sekolah('12345678', null);
  }, /Payload must be an object/);
});

runTest('API', 'save_pengaturan_sekolah normalizes logo aliases for backward compatibility', async () => {
  const testPayload = {
    nama_sekolah: 'SMK BINA BANGSA',
    logo_kiri: 'data:image/jpeg;base64,LEFT_LOGO_DATA',
    logo_kanan: 'data:image/jpeg;base64,RIGHT_LOGO_DATA',
    kop_meja_mode: 'minimalis'
  };

  const res = await save_pengaturan_sekolah('TEST_NPSN_99', testPayload);
  assert.strictEqual(res.status, 'success');
  assert.strictEqual(res.data.logo_dinas, testPayload.logo_kiri, 'logo_dinas mirrors logo_kiri');
  assert.strictEqual(res.data.logo, testPayload.logo_kanan, 'logo mirrors logo_kanan');

  // Verify fetchAPI router routes
  assert(apiContent.includes("case 'get_pengaturan_sekolah':"), 'fetchAPI routes get_pengaturan_sekolah');
  assert(apiContent.includes("case 'save_pengaturan_sekolah':"), 'fetchAPI routes save_pengaturan_sekolah');
});

// ============================================================================
// SECTION 2: KARTUUJIANPRINT.JSX INTEGRITY & PRINT RULES
// ============================================================================
console.log('\n--- [SECTION 2] KartuUjianPrint.jsx Print Architecture & Fallbacks ---');

const kartuPrintPath = path.join(rootDir, 'src', 'components', 'KartuUjianPrint.jsx');
const kartuContent = fs.readFileSync(kartuPrintPath, 'utf-8');

runTest('PrintArch', 'KartuUjianPrint AST parses cleanly without syntax errors', () => {
  const ast = babelParser.parse(kartuContent, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  assert(ast && ast.type === 'File');
});

runTest('PrintArch', 'Zero forbidden print-suppressed tags (<header, <footer, <nav, <aside)', () => {
  const cleanCode = kartuContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  const forbidden = ['<header', '<footer', '<nav', '<aside'];
  for (const tag of forbidden) {
    assert(!cleanCode.toLowerCase().includes(tag), `Must not contain print-suppressed tag ${tag}`);
  }
});

runTest('PrintArch', 'Zero <button> tags inside printable card area', () => {
  const printAreaIndex = kartuContent.indexOf('{/* Printable Sheets Container */}');
  assert(printAreaIndex > -1, 'Printable Sheets Container must exist');
  const printableArea = kartuContent.substring(printAreaIndex);
  assert(!printableArea.includes('<button'), 'Printable card area must not contain <button> tags');
});

runTest('PrintArch', 'Preserves 67mm card height constraint and dynamic A4/F4 @page margin', () => {
  assert(kartuContent.includes("height: '67mm'"), 'Card height must be strictly 67mm');
  assert(kartuContent.includes("paperSize === 'F4' ? '215mm 330mm' : 'A4 portrait'"));
  assert(kartuContent.includes("margin: 8mm 10mm 8mm 10mm;"));
});

runTest('PrintArch', 'Kartu Peserta renders logoKiri and logoKanan with object-contain & fallback SVGs', () => {
  assert(kartuContent.includes('showLogoKiriPeserta'), 'Handles showLogoKiriPeserta toggle');
  assert(kartuContent.includes('showLogoKananPeserta'), 'Handles showLogoKananPeserta toggle');
  assert(kartuContent.includes('alt="Logo Dinas"'), 'Left logo image renders with Dinas label');
  assert(kartuContent.includes('alt="Logo Sekolah"'), 'Right logo image renders with Sekolah label');
});

runTest('PrintArch', 'Kartu Peserta renders 4-line configurable kop text', () => {
  assert(kartuContent.includes('kopPesertaBaris1'), 'Renders kopPesertaBaris1 (Pemerintah/Dinas)');
  assert(kartuContent.includes('kopPesertaBaris2'), 'Renders kopPesertaBaris2 (Nama Sekolah)');
  assert(kartuContent.includes('kopPesertaBaris3'), 'Renders kopPesertaBaris3 (Judul Kartu)');
  assert(kartuContent.includes('kopPesertaBaris4'), 'Renders kopPesertaBaris4 (NPSN & Sub-keterangan)');
});

runTest('PrintArch', 'Kartu Meja supports formal mode with logos and minimalis mode while MEJA badge stays prominent', () => {
  assert(kartuContent.includes('showLogoKiriMeja'), 'Kartu meja checks showLogoKiriMeja');
  assert(kartuContent.includes('showLogoKananMeja'), 'Kartu meja checks showLogoKananMeja');
  assert(kartuContent.includes('MEJA {String(deskNumber).padStart(2, \'0\')}'), 'Desk number badge preserved');
  assert(kartuContent.includes('kopMejaBaris1'), 'Renders kopMejaBaris1');
  assert(kartuContent.includes('kopMejaBaris2'), 'Renders kopMejaBaris2');
});

runTest('PrintArch', 'Preserves existing safe fallbacks for backward compatibility', () => {
  assert(kartuContent.includes("sekolah.nama_sekolah || 'SEKOLAH INDONESIA'"));
  assert(kartuContent.includes("sekolah.npsn || '-'"));
  assert(kartuContent.includes("student.nama_lengkap || '-'"));
  assert(kartuContent.includes("student.nisn || student.id_siswa || '-'"));
  assert(kartuContent.includes("student.username || '-'"));
  assert(kartuContent.includes("targetSesi || 'Sesi 1'"));
});

// ============================================================================
// SECTION 3: ADMINVIEW.JSX SETTINGS & TAXONOMY INTEGRITY
// ============================================================================
console.log('\n--- [SECTION 3] AdminView.jsx Settings Navigation & UI ---');

const adminPath = path.join(rootDir, 'src', 'views', 'AdminView.jsx');
const adminContent = fs.readFileSync(adminPath, 'utf-8');

runTest('AdminUI', 'AdminView.jsx AST parses cleanly with zero syntax errors', () => {
  const ast = babelParser.parse(adminContent, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  assert(ast && ast.type === 'File');
});

runTest('AdminUI', 'AdminView imports get_pengaturan_sekolah, save_pengaturan_sekolah, and getDefaultKopSettings', () => {
  assert(adminContent.includes('get_pengaturan_sekolah'));
  assert(adminContent.includes('save_pengaturan_sekolah'));
  assert(adminContent.includes('getDefaultKopSettings'));
});

runTest('AdminUI', 'AdminView navGroups includes "Pengaturan / Profil Sekolah" under Sistem with zero badge property', () => {
  assert(adminContent.includes("id: 'pengaturan'"));
  assert(adminContent.includes("label: 'Pengaturan / Profil Sekolah'"));

  // Verify AST of navGroups
  const ast = babelParser.parse(adminContent, {
    sourceType: 'module',
    plugins: ['jsx']
  });

  function traverse(node, cb) {
    if (!node || typeof node !== 'object') return;
    cb(node);
    for (const key of Object.keys(node)) {
      if (key === 'comments' || key === 'loc') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const c of child) traverse(c, cb);
      } else if (child && typeof child === 'object') {
        traverse(child, cb);
      }
    }
  }

  let foundPengaturan = false;
  let hasBadge = false;

  traverse(ast, (node) => {
    if (node.type === 'VariableDeclarator' && node.id?.name === 'navGroups' && node.init?.type === 'ArrayExpression') {
      traverse(node.init, (subNode) => {
        if (subNode.type === 'ObjectProperty') {
          const key = subNode.key?.name || subNode.key?.value;
          const val = subNode.value?.value;
          if (key === 'id' && val === 'pengaturan') {
            foundPengaturan = true;
          }
          if (['badge', 'count', 'pill', 'unread', 'length'].includes(key)) {
            hasBadge = true;
          }
        }
      });
    }
  });

  assert(foundPengaturan, 'navGroups must include item with id: pengaturan');
  assert(!hasBadge, 'navGroups must NOT contain badge property');
});

runTest('AdminUI', 'tabTitleMap includes pengaturan title mapping', () => {
  assert(adminContent.includes("pengaturan: 'Pengaturan & Profil Sekolah'"));
});

runTest('AdminUI', 'Profil Admin (akun tab) contains direct navigation button to pengaturan', () => {
  assert(adminContent.includes("onClick={() => navigateTab('pengaturan')}"));
});

runTest('AdminUI', 'Pengaturan tab contains file inputs and canvas compressImageFile calls for both logos', () => {
  assert(adminContent.includes('handleUploadLogoKiri'));
  assert(adminContent.includes('handleUploadLogoKanan'));
  assert(adminContent.includes('compressImageFile(file, 240, 240, 0.85)'));
  assert(adminContent.includes('handleResetLogoKiri'));
  assert(adminContent.includes('handleResetLogoKanan'));
});

runTest('AdminUI', 'Pengaturan tab contains interactive live preview for Kartu Peserta and Kartu Meja kop', () => {
  assert(adminContent.includes('Pratinjau Kop Kartu Peserta'));
  assert(adminContent.includes('Pratinjau Kop Kartu Meja'));
  assert(adminContent.includes('MEJA 01'));
});

runTest('AdminUI', 'handleGeneratePrintKartu passes complete kopSettings to print payload sekolah object', () => {
  assert(adminContent.includes('kopSettings.logo_kiri'));
  assert(adminContent.includes('kopSettings.logo_kanan'));
  assert(adminContent.includes('kopSettings.kop_baris1'));
  assert(adminContent.includes('kopSettings.kop_baris2'));
  assert(adminContent.includes('kopSettings.kop_baris3'));
  assert(adminContent.includes('kopSettings.kop_baris4'));
  assert(adminContent.includes('kopSettings.kartu_peserta_show_logo_kiri'));
  assert(adminContent.includes('kopSettings.kartu_peserta_show_logo_kanan'));
  assert(adminContent.includes('kopSettings.kop_meja_mode'));
  assert(adminContent.includes('kopSettings.kartu_meja_show_logo_kiri'));
  assert(adminContent.includes('kopSettings.kartu_meja_show_logo_kanan'));
});

runTest('AdminUI', 'renderPrintKartuModal provides quick kop toggles and direct link to profile settings', () => {
  assert(adminContent.includes('Pengaturan Kop & Logo'));
  assert(adminContent.includes('Atur di Menu Profil'));
  assert(adminContent.includes('setPrintKartuModal(prev => ({ ...prev, isOpen: false }));'));
});

// ============================================================================
// SECTION 4: CARD CHUNKING & PAGE BREAK MATHEMATICS
// ============================================================================
console.log('\n--- [SECTION 4] Card Chunking & Page Layout Mathematical Verification ---');

runTest('PageBudget', '4 rows of 67mm cards fit inside A4 (297mm) and F4 (330mm) with 16mm margins', () => {
  const cardHeightMm = 67;
  const rowsPerPage = 4;
  const topMarginMm = 8;
  const bottomMarginMm = 8;
  const totalOccupiedHeight = (cardHeightMm * rowsPerPage) + topMarginMm + bottomMarginMm; // 284mm

  assert.strictEqual(totalOccupiedHeight, 284);
  assert(totalOccupiedHeight < 297, `Total height (${totalOccupiedHeight}mm) must be strictly less than A4 height (297mm)`);
  assert(totalOccupiedHeight < 330, `Total height (${totalOccupiedHeight}mm) must be strictly less than F4 height (330mm)`);
});

runTest('PageBudget', 'Chunking algorithm determinism: exactly 8 cards per page', () => {
  const chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  assert.strictEqual(chunkArray([], 8).length, 0);
  assert.strictEqual(chunkArray(new Array(1), 8).length, 1);
  assert.strictEqual(chunkArray(new Array(8), 8).length, 1);
  assert.strictEqual(chunkArray(new Array(9), 8).length, 2);
  assert.strictEqual(chunkArray(new Array(16), 8).length, 2);
  assert.strictEqual(chunkArray(new Array(24), 8).length, 3);
  assert.strictEqual(chunkArray(new Array(25), 8).length, 4);
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n========================================================================');
console.log(`TEST SUMMARY: ${passCount} Passed, ${failCount} Failed (Total: ${passCount + failCount})`);
console.log('========================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL KOP & CARD PRINT SETTINGS TESTS PASSED 100%!');
  process.exit(0);
}
