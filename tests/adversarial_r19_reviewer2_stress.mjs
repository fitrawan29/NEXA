import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { isClassMatching } from '../src/api.js';

console.log('=== ADVERSARIAL REVIEWER 2 DEEP STRESS & EDGE-CASE SUITE (R19) ===\n');

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

// -------------------------------------------------------------------------
// 1. ISCLASSMATCHING ADVERSARIAL UNIVERSAL & GRADE EDGE CASES
// -------------------------------------------------------------------------
runTest('1.1 - Universal target permutations (Semua Tingkat, Semua Kelas, etc.) match any student', () => {
  const universalTargets = [
    'Semua Tingkat',
    'Semua Tingkat (Umum)',
    'Semua Kelas (Umum)',
    'Semua Kelas',
    'SEMUA',
    'Semua Rombel',
    'Semua Siswa',
    'Umum',
    'ALL',
    'GLOBAL',
    '-',
    '*',
    '',
    null,
    undefined
  ];

  const students = [
    { angkatan: 'X', kelas_paralel: '1', kelas: 'X-1' },
    { angkatan: 'XI', kelas_paralel: 'A', kelas: 'XI A' },
    { angkatan: 'XII', kelas_paralel: 'MIPA 1', kelas: 'XII MIPA 1' },
    { angkatan: '4', kelas_paralel: 'B', kelas: 'IV B' },
    { angkatan: '7', kelas_paralel: 'A', kelas: 'VII A' },
    { angkatan: '11', kelas_paralel: '' },
    {}
  ];

  for (const t of universalTargets) {
    for (const s of students) {
      assert.strictEqual(
        isClassMatching(t, s),
        true,
        `Target "${t}" must match student ${JSON.stringify(s)}`
      );
    }
  }
});

runTest('1.2 - Compound grade-specific targets (Semua Kelas XI) match only the correct grade', () => {
  assert.strictEqual(isClassMatching('Semua Kelas XI', { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching('Semua Kelas XI', { angkatan: '11', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching('Semua Kelas XI', { kelas: 'XI MIPA 2' }), true);
  assert.strictEqual(isClassMatching('Semua Kelas XI', { angkatan: 'XII', kelas_paralel: 'A' }), false);
  assert.strictEqual(isClassMatching('Semua Kelas XI', { angkatan: 'X', kelas_paralel: '1' }), false);
});

runTest('1.3 - Complete K-12 grade spectrum numeral equivalence (SD 1-6, SMP 7-9, SMA 10-12)', () => {
  // Elementary (SD)
  assert.strictEqual(isClassMatching('4 A', { angkatan: 'IV', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching('IV A', { angkatan: '4', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching('1 A', { angkatan: 'I', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching('6 B', { angkatan: 'VI', kelas_paralel: 'B' }), true);

  // Junior High (SMP)
  assert.strictEqual(isClassMatching('7 B', { angkatan: 'VII', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching('VII B', { angkatan: '7', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching('9 C', { angkatan: 'IX', kelas_paralel: 'C' }), true);

  // Senior High (SMA/SMK)
  assert.strictEqual(isClassMatching('10-1', { angkatan: 'X', kelas_paralel: '1' }), true);
  assert.strictEqual(isClassMatching('X-1', { angkatan: '10', kelas_paralel: '1' }), true);
  assert.strictEqual(isClassMatching('12-IPS', { angkatan: 'XII', kelas_paralel: 'IPS' }), true);
});

runTest('1.4 - Parallel section numbers (e.g. 1 in X-1) are preserved and never mistaken for grade Roman numerals', () => {
  assert.strictEqual(isClassMatching('X-1', { angkatan: 'X', kelas_paralel: '1' }), true);
  assert.strictEqual(isClassMatching('X-1', { angkatan: 'X', kelas_paralel: '2' }), false);
  assert.strictEqual(isClassMatching('X-1', { angkatan: 'X', kelas_paralel: 'I' }), false);
  assert.strictEqual(isClassMatching('XI-2', { angkatan: 'XI', kelas_paralel: '2' }), true);
  assert.strictEqual(isClassMatching('XI-2', { angkatan: 'XI', kelas_paralel: '1' }), false);
});

// -------------------------------------------------------------------------
// 2. METADATA EXCLUSION IN API.JS
// -------------------------------------------------------------------------
runTest('2.1 - src/api.js excludes all 4 metadata types from bank_soal and dashboard metrics', () => {
  const content = fs.readFileSync('src/api.js', 'utf8');

  // get_bank_soal_admin exclusions
  assert.strictEqual(content.includes(".neq('tipe_soal', 'SKEMA_DEFAULT')"), true);
  assert.strictEqual(content.includes(".neq('tipe_soal', 'SKEMA_PENILAIAN')"), true);
  assert.strictEqual(content.includes(".neq('tipe_soal', 'MAPEL_ALLOC')"), true);
  assert.strictEqual(content.includes(".neq('tipe_soal', 'KOP_SETTINGS')"), true);

  // get_all_mapel exclusions
  assert.strictEqual(content.includes("s.tipe_soal !== 'SKEMA_DEFAULT'"), true);
  assert.strictEqual(content.includes("s.tipe_soal !== 'SKEMA_PENILAIAN'"), true);
  assert.strictEqual(content.includes("s.tipe_soal !== 'MAPEL_ALLOC'"), true);
  assert.strictEqual(content.includes("s.tipe_soal !== 'KOP_SETTINGS'"), true);
});

runTest('2.2 - create_mapel and update_mapel provide resilient fallback for native alokasi_kelas column', () => {
  const content = fs.readFileSync('src/api.js', 'utf8');
  assert.strictEqual(content.includes('resInsert.error.message.includes(\'alokasi_kelas\')'), true);
  assert.strictEqual(content.includes('resUpdate.error.message.includes(\'alokasi_kelas\')'), true);
});

// -------------------------------------------------------------------------
// 3. ADMINVIEW STATE HYDRATION & CLASS SELECTION RESILIENCE
// -------------------------------------------------------------------------
runTest('3.1 - AdminView fetchData fetches dataKelas when visiting tab mapel', () => {
  const content = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
  const mapelBranchMatch = content.match(/} else if \(tab === 'mapel'\) \{[\s\S]*?setDataKelas\(resK\.data/);
  assert.notStrictEqual(mapelBranchMatch, null, 'fetchData for mapel tab must fetch and set dataKelas');
});

runTest('3.2 - AdminView openCreateModal and openEditModal ensure dataKelas is fetched for mapel and jadwal', () => {
  const content = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
  assert.strictEqual(content.includes("if (type === 'guru' || type === 'jadwal' || type === 'mapel')"), true);
  assert.strictEqual(content.includes("if (type === 'mapel' || type === 'jadwal') {"), true);
});

runTest('3.3 - AdminView Mapel and Jadwal modals provide defensive preservation for saved class allocations', () => {
  const content = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
  assert.strictEqual(content.includes('{data?.alokasi_kelas} (Tersimpan)'), true);
  assert.strictEqual(content.includes('{jadwalTargetKelas} (Tersimpan)'), true);
});

// -------------------------------------------------------------------------
// 4. GURUVIEW NAVIGATION & MONITORING STANDARDIZATION
// -------------------------------------------------------------------------
runTest('4.1 - GuruView navigateTab redirects legacy kontrol to monitoring', () => {
  const content = fs.readFileSync('src/views/GuruView.jsx', 'utf8');
  assert.strictEqual(content.includes("const target = tabId === 'kontrol' ? 'monitoring' : tabId;"), true);
});

runTest('4.2 - GuruView active exam card uses unified Monitoring button label', () => {
  const content = fs.readFileSync('src/views/GuruView.jsx', 'utf8');
  assert.strictEqual(content.includes('<span>Live Monitoring</span>'), false);
  assert.strictEqual(content.includes('<span>Monitoring</span>'), true);
});

console.log('\n==================================================');
console.log(`SUMMARY: ${passedTests} / ${totalTests} adversarial stress tests passed.`);
console.log('==================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
