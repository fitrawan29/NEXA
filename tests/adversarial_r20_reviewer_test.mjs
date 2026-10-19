import fs from 'fs';
import assert from 'assert';
import { isClassMatching } from '../src/api.js';

console.log('=== ADVERSARIAL REVIEWER BREAKING TEST (R20) ===\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    failedTests++;
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// 1. isClassMatching Edge Cases & Delimiters
// -----------------------------------------------------------------------------
runTest('1.1 - Multiline and carriage-return separated multi-target matching', () => {
  const targetMultiline = 'XI A\nXI B\r\nXII C';
  assert.strictEqual(isClassMatching(targetMultiline, { angkatan: 'XI', kelas_paralel: 'A' }), true, 'Should match XI A');
  assert.strictEqual(isClassMatching(targetMultiline, { angkatan: 'XI', kelas_paralel: 'B' }), true, 'Should match XI B');
  assert.strictEqual(isClassMatching(targetMultiline, { angkatan: 'XII', kelas_paralel: 'C' }), true, 'Should match XII C');
  assert.strictEqual(isClassMatching(targetMultiline, { angkatan: 'XI', kelas_paralel: 'D' }), false, 'Should reject XI D');
});

runTest('1.2 - Compound target with irregular whitespace and delimiters', () => {
  const target = '  XI A ,  ;  XI B  |   12-C  ';
  assert.strictEqual(isClassMatching(target, { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching(target, { angkatan: 'XI', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching(target, { angkatan: 'XII', kelas_paralel: 'C' }), true);
  assert.strictEqual(isClassMatching(target, { angkatan: '12', kelas_paralel: 'C' }), true);
  assert.strictEqual(isClassMatching(target, { angkatan: 'X', kelas_paralel: 'A' }), false);
});

runTest('1.3 - Universal keyword combinations in compound target', () => {
  assert.strictEqual(isClassMatching('Semua Kelas (Umum), XI A', { angkatan: 'X', kelas_paralel: 'B' }), true, 'Universal token grants access');
  assert.strictEqual(isClassMatching('Semua Tingkat (Umum)', { angkatan: 'X', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching('Semua Kelas', { angkatan: 'X', kelas_paralel: 'B' }), true);
});

// -----------------------------------------------------------------------------
// 2. AdminView JSX & Logic Audit
// -----------------------------------------------------------------------------
const adminSrc = fs.readFileSync('src/views/AdminView.jsx', 'utf8');

runTest('2.1 - AdminView: isClassMatching imported for multi-target schedule card printing', () => {
  assert.ok(adminSrc.includes("import { fetchAPI"), 'must have fetchAPI');
  assert.ok(adminSrc.includes("isClassMatching"), 'AdminView must import isClassMatching for target_kelas card printing');
});

runTest('2.2 - AdminView: Print kartu filtering uses isClassMatching instead of strict equality', () => {
  assert.ok(
    adminSrc.includes('isClassMatching(printKartuModal.filterKelas, s)'),
    'Print kartu modal must use isClassMatching to support multi-class schedule target_kelas'
  );
});

runTest('2.3 - AdminView: Universal allocation detection in Mapel select & badges handles "Semua Kelas (Umum)"', () => {
  // Line 2197 should not set target_kelas to 'Semua Kelas (Umum)'
  // Test if alloc check handles 'Semua Kelas (Umum)' cleanly
  const matchesSemuaUmumDropdown = adminSrc.includes("m.alokasi_kelas !== 'Semua Kelas' && m.alokasi_kelas !== 'Semua Kelas (Umum)'") ||
    adminSrc.includes("isUniversalAlloc(m.alokasi_kelas)") ||
    adminSrc.includes("!isGeneralMapel(m.alokasi_kelas)");
  assert.ok(matchesSemuaUmumDropdown, 'Mapel select in Jadwal form must not display (Semua Kelas (Umum)) badge');
});

runTest('2.4 - AdminView: Jadwal target class dropdown preset does not wipe existing selection on placeholder click', () => {
  // If user clicks "+ Tambah Kelas / Pilih Preset Target...", it shouldn't clear jadwalTargetKelas
  assert.ok(
    !adminSrc.includes('if (!val) {\n                          setJadwalTargetKelas(\'\');') &&
    !adminSrc.includes('if (!val) {\r\n                          setJadwalTargetKelas(\'\');'),
    'Clicking preset prompt must not clear jadwalTargetKelas'
  );
});

runTest('2.5 - AdminView: Deselecting all classes keeps Semua Kelas (Umum) checkbox and container active', () => {
  assert.ok(
    adminSrc.includes('checked={isMapelSemuaKelas || mapelAlokasiKelas.length === 0}'),
    'Semua Kelas (Umum) checkbox must be checked when isMapelSemuaKelas is true OR mapelAlokasiKelas is empty'
  );
  assert.ok(
    adminSrc.includes('(isMapelSemuaKelas || mapelAlokasiKelas.length === 0)'),
    'Semua Kelas (Umum) container styling must be active when isMapelSemuaKelas is true OR mapelAlokasiKelas is empty'
  );
});

runTest('2.6 - AdminView: Parallel classes within each tingkat are sorted alphabetically/numerically', () => {
  assert.ok(
    adminSrc.includes('classesInTingkat') && adminSrc.includes('.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: \'base\' }))'),
    'classesInTingkat must be sorted using localeCompare with numeric: true'
  );
});

console.log(`\n==================================================`);
console.log(`SUMMARY: ${passedTests} passed, ${failedTests} failed out of ${totalTests} tests.`);
console.log(`==================================================\n`);
