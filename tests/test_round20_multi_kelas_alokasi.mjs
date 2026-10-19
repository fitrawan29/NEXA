import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { isClassMatching, saveMapelAlokasi, deleteMapelAlokasi } from '../src/api.js';

console.log('=== TEST SUITE: ROUND 20 MULTI-KELAS PARALEL ALOKASI & PENARGETAN ===\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// 1. UNIT TESTS: isClassMatching MULTI-TARGET COMPOUND MATCHING
// -----------------------------------------------------------------------------
runTest('1.1 - isClassMatching: Comma-separated target matches any included parallel class and rejects others', () => {
  const target = 'XI A, XI B';
  assert.strictEqual(isClassMatching(target, { angkatan: 'XI', kelas_paralel: 'A' }), true, 'Student XI A must match');
  assert.strictEqual(isClassMatching(target, { angkatan: 'XI', kelas_paralel: 'B' }), true, 'Student XI B must match');
  assert.strictEqual(isClassMatching(target, { angkatan: 'XI', kelas_paralel: 'C' }), false, 'Student XI C must NOT match');
  assert.strictEqual(isClassMatching(target, { angkatan: 'XII', kelas_paralel: 'A' }), false, 'Student XII A must NOT match');
  assert.strictEqual(isClassMatching(target, { kelas: 'XI A' }), true, 'Student with raw kelas XI A must match');
  assert.strictEqual(isClassMatching(target, { kelas: 'XI B' }), true, 'Student with raw kelas XI B must match');
  assert.strictEqual(isClassMatching(target, { kelas: 'XI C' }), false, 'Student with raw kelas XI C must NOT match');
});

runTest('1.2 - isClassMatching: Semicolon and Pipe separated targets match accurately', () => {
  const targetSemicolon = 'XI A; XI B; XII IPA 1';
  assert.strictEqual(isClassMatching(targetSemicolon, { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching(targetSemicolon, { angkatan: 'XI', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching(targetSemicolon, { angkatan: 'XII', kelas_paralel: 'IPA 1' }), true);
  assert.strictEqual(isClassMatching(targetSemicolon, { angkatan: 'XI', kelas_paralel: 'C' }), false);

  const targetPipe = 'XI A | XI B | X 2';
  assert.strictEqual(isClassMatching(targetPipe, { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching(targetPipe, { angkatan: 'XI', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching(targetPipe, { angkatan: 'X', kelas_paralel: '2' }), true);
  assert.strictEqual(isClassMatching(targetPipe, { angkatan: 'X', kelas_paralel: '1' }), false);
});

runTest('1.3 - isClassMatching: Mixed delimiter compound targets', () => {
  const targetMixed = 'XI A, XI B; XII C | X 1';
  assert.strictEqual(isClassMatching(targetMixed, { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching(targetMixed, { angkatan: 'XI', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching(targetMixed, { angkatan: 'XII', kelas_paralel: 'C' }), true);
  assert.strictEqual(isClassMatching(targetMixed, { angkatan: 'X', kelas_paralel: '1' }), true);
  assert.strictEqual(isClassMatching(targetMixed, { angkatan: 'X', kelas_paralel: '2' }), false);
});

runTest('1.4 - isClassMatching: Arabic <-> Roman numeral equivalence with multi-targets', () => {
  const targetArabic = '11 A, 11 B';
  assert.strictEqual(isClassMatching(targetArabic, { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching(targetArabic, { angkatan: 'XI', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching(targetArabic, { angkatan: 'XI', kelas_paralel: 'C' }), false);

  const targetRoman = 'XI A, XI B';
  assert.strictEqual(isClassMatching(targetRoman, { angkatan: '11', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching(targetRoman, { angkatan: '11', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching(targetRoman, { angkatan: '11', kelas_paralel: 'C' }), false);

  const targetSections = '10-1, 10-2';
  assert.strictEqual(isClassMatching(targetSections, { angkatan: 'X', kelas_paralel: '1' }), true);
  assert.strictEqual(isClassMatching(targetSections, { angkatan: 'X', kelas_paralel: '2' }), true);
  assert.strictEqual(isClassMatching(targetSections, { angkatan: 'X', kelas_paralel: '3' }), false);
});

runTest('1.5 - isClassMatching: Combination of grade-wide and parallel-specific targets', () => {
  const targetMixedScope = 'Tingkat X (Semua), XI A';
  assert.strictEqual(isClassMatching(targetMixedScope, { angkatan: 'X', kelas_paralel: '1' }), true);
  assert.strictEqual(isClassMatching(targetMixedScope, { angkatan: 'X', kelas_paralel: '2' }), true);
  assert.strictEqual(isClassMatching(targetMixedScope, { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching(targetMixedScope, { angkatan: 'XI', kelas_paralel: 'B' }), false);
  assert.strictEqual(isClassMatching(targetMixedScope, { angkatan: 'XII', kelas_paralel: 'A' }), false);
});

runTest('1.6 - isClassMatching: Array target input support', () => {
  const targetArray = ['XI A', 'XI B'];
  assert.strictEqual(isClassMatching(targetArray, { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching(targetArray, { angkatan: 'XI', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching(targetArray, { angkatan: 'XI', kelas_paralel: 'C' }), false);
  assert.strictEqual(isClassMatching([], { angkatan: 'XI', kelas_paralel: 'A' }), true, 'Empty array should be universal');
});

runTest('1.7 - isClassMatching: Edge cases, unassigned students, and unprovided student context', () => {
  // Unassigned student {} must be rejected for multi-class targets
  assert.strictEqual(isClassMatching('XI A, XI B', {}), false);
  // Universal targets still accept unassigned student {}
  assert.strictEqual(isClassMatching('Semua Kelas', {}), true);
  assert.strictEqual(isClassMatching('Semua Tingkat (Umum)', {}), true);
  assert.strictEqual(isClassMatching('Semua Kelas, XI A', {}), true);

  // Unprovided student context (null/undefined) fails open
  assert.strictEqual(isClassMatching('XI A, XI B', null), true);
  assert.strictEqual(isClassMatching('XI A, XI B', undefined), true);

  // Empty delimiters string fallback to universal
  assert.strictEqual(isClassMatching(', ; |', { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching('XI A, , XI B', { angkatan: 'XI', kelas_paralel: 'B' }), true);
});

// -----------------------------------------------------------------------------
// 2. ENDPOINT & GET_JADWAL ACCESS GATING VERIFICATION
// -----------------------------------------------------------------------------
runTest('2.1 - get_jadwal schedule filtering simulation: Out-of-target students are gated out', () => {
  const schedules = [
    { id_jadwal: 'J1', nama_mapel: 'Fisika Pilihan', target_kelas: 'XI A, XI B' },
    { id_jadwal: 'J2', nama_mapel: 'Kimia Lanjutan', target_kelas: 'XI B, XI C' },
    { id_jadwal: 'J3', nama_mapel: 'Pancasila Umum', target_kelas: 'Semua Kelas' },
    { id_jadwal: 'J4', nama_mapel: 'Biologi UTBK', target_kelas: 'XII A, XII B' }
  ];

  // Student in XI A
  const studentXIA = { angkatan: 'XI', kelas_paralel: 'A' };
  const matchingForXIA = schedules.filter(j => isClassMatching(j.target_kelas, studentXIA));
  assert.deepStrictEqual(matchingForXIA.map(j => j.id_jadwal), ['J1', 'J3']);

  // Student in XI B
  const studentXIB = { angkatan: 'XI', kelas_paralel: 'B' };
  const matchingForXIB = schedules.filter(j => isClassMatching(j.target_kelas, studentXIB));
  assert.deepStrictEqual(matchingForXIB.map(j => j.id_jadwal), ['J1', 'J2', 'J3']);

  // Student in XI C
  const studentXIC = { angkatan: 'XI', kelas_paralel: 'C' };
  const matchingForXIC = schedules.filter(j => isClassMatching(j.target_kelas, studentXIC));
  assert.deepStrictEqual(matchingForXIC.map(j => j.id_jadwal), ['J2', 'J3']);

  // Student in XII B
  const studentXIIB = { angkatan: 'XII', kelas_paralel: 'B' };
  const matchingForXIIB = schedules.filter(j => isClassMatching(j.target_kelas, studentXIIB));
  assert.deepStrictEqual(matchingForXIIB.map(j => j.id_jadwal), ['J3', 'J4']);

  // Student in X 1 (outside all specific lists)
  const studentX1 = { angkatan: 'X', kelas_paralel: '1' };
  const matchingForX1 = schedules.filter(j => isClassMatching(j.target_kelas, studentX1));
  assert.deepStrictEqual(matchingForX1.map(j => j.id_jadwal), ['J3']);
});

// -----------------------------------------------------------------------------
// 3. ADMINVIEW MASTER MAPEL CHECKBOX GROUP & BADGES VERIFICATION
// -----------------------------------------------------------------------------
runTest('3.1 - AdminView.jsx: Mapel form provides structured Checkbox Group per tingkat with Pilih Semua and Semua Kelas', () => {
  const content = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
  assert.strictEqual(content.includes('mapelAlokasiKelas'), true, 'Must manage mapelAlokasiKelas state');
  assert.strictEqual(content.includes('isMapelSemuaKelas'), true, 'Must manage isMapelSemuaKelas state');
  assert.strictEqual(content.includes('Semua Kelas (Umum)'), true, 'Must provide Semua Kelas (Umum) option');
  assert.strictEqual(content.includes('Pilih Semua'), true, 'Must provide Pilih Semua button');
  assert.strictEqual(content.includes('Batal Semua'), true, 'Must provide Batal Semua toggle');
  assert.strictEqual(content.includes('Tingkat {t}'), true, 'Must group by Tingkat');
  assert.strictEqual(content.includes('name="alokasi_kelas"'), true, 'Must submit name="alokasi_kelas"');
});

runTest('3.2 - AdminView.jsx: Master Mapel cards render separate visual badges for each allocated parallel class', () => {
  const content = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
  assert.strictEqual(content.includes('m.alokasi_kelas.split(/[,;|]+/)'), true, 'Must split compound allocations');
  assert.strictEqual(content.includes('{m.alokasi_kelas || \'Semua Kelas\'}'), true, 'Must retain fallback for single/general class');
});

// -----------------------------------------------------------------------------
// 4. ADMINVIEW JADWAL MULTI-TARGET INTEGRATION VERIFICATION
// -----------------------------------------------------------------------------
runTest('4.1 - AdminView.jsx: Jadwal form supports multi-class input and auto-synchronization from Mapel', () => {
  const content = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
  assert.strictEqual(content.includes('id="input_jadwal_target_kelas"'), true, 'Must have input_jadwal_target_kelas element');
  assert.strictEqual(content.includes('setJadwalTargetKelas(newTarget);'), true, 'Must auto-adjust target on mapel change');
  assert.strictEqual(content.includes('name="target_kelas"'), true, 'Must have target_kelas field');
  assert.strictEqual(content.includes('+ Tambah Kelas / Pilih Preset Target...'), true, 'Must provide preset helper options');
  assert.strictEqual(content.includes('{jadwalTargetKelas} (Tersimpan)'), true, 'Must preserve saved multi-target');
});

// -----------------------------------------------------------------------------
// 5. API PERSISTENCE VERIFICATION
// -----------------------------------------------------------------------------
runTest('5.1 - src/api.js: saveMapelAlokasi and get_all_mapel handle multi-class string persistence', async () => {
  // Test localStorage caching behavior
  const mockStorage = {};
  global.localStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = v; },
    removeItem: (k) => { delete mockStorage[k]; }
  };

  const testMapelId = 'TEST_M_99';
  const testNpsn = '99999999';
  const testAlloc = 'XI A, XI B, XII C';

  await saveMapelAlokasi(testMapelId, testNpsn, testAlloc);

  const cached = JSON.parse(mockStorage['nexa_mapel_allocations_' + testNpsn] || '{}');
  assert.strictEqual(cached[testMapelId], testAlloc, 'Multi-class allocation must be stored in localStorage');

  await deleteMapelAlokasi(testMapelId, testNpsn);
  const cachedAfterDelete = JSON.parse(mockStorage['nexa_mapel_allocations_' + testNpsn] || '{}');
  assert.strictEqual(cachedAfterDelete[testMapelId], undefined, 'Deleted mapel allocation must be cleared');
});

console.log(`\n==================================================`);
console.log(`SUMMARY: ${passedTests} / ${totalTests} test suites passed.`);
console.log(`==================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
