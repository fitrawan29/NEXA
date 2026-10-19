import assert from 'assert';
import fs from 'fs';
import { isClassMatching, saveMapelAlokasi } from '../src/api.js';

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}\n       ${err.message}`);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}\n       ${err.message}`);
    failed++;
  }
}

console.log('=== ROUND 20 REVIEWER 2 ADVERSARIAL STRESS TEST ===\n');

// 1. isClassMatching deep edge cases: Mixed Arabic/Roman, SMK majors, irregular delimiters
runTest('1.1 - Mixed Arabic/Roman numerals with irregular delimiters in compound target', () => {
  const compound = '  10-A ;  XI-B  |  12 C \n X-TITL-1 \r\n 11 IPA 2 ';

  // Match 10-A
  assert.strictEqual(isClassMatching(compound, { angkatan: 'X', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching(compound, { angkatan: '10', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching(compound, { kelas: '10 A' }), true);

  // Match XI-B
  assert.strictEqual(isClassMatching(compound, { angkatan: '11', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching(compound, { angkatan: 'XI', kelas_paralel: 'B' }), true);

  // Match 12 C
  assert.strictEqual(isClassMatching(compound, { angkatan: 'XII', kelas_paralel: 'C' }), true);
  assert.strictEqual(isClassMatching(compound, { angkatan: '12', kelas_paralel: 'C' }), true);

  // Match SMK vocational class X-TITL-1
  assert.strictEqual(isClassMatching(compound, { angkatan: 'X', kelas_paralel: 'TITL 1' }), true);
  assert.strictEqual(isClassMatching(compound, { kelas: 'X TITL 1' }), true);

  // Match 11 IPA 2
  assert.strictEqual(isClassMatching(compound, { angkatan: 'XI', kelas_paralel: 'IPA 2' }), true);

  // Reject non-matching
  assert.strictEqual(isClassMatching(compound, { angkatan: 'X', kelas_paralel: 'B' }), false);
  assert.strictEqual(isClassMatching(compound, { angkatan: 'XI', kelas_paralel: 'A' }), false);
  assert.strictEqual(isClassMatching(compound, { angkatan: 'XII', kelas_paralel: 'A' }), false);
  assert.strictEqual(isClassMatching(compound, { angkatan: 'X', kelas_paralel: 'TITL 2' }), false);
});

// 2. saveMapelAlokasi normalization & persistence
await runAsyncTest('2.1 - saveMapelAlokasi normalizes messy delimiters and whitespace before saving', async () => {
  const mockStorage = {};
  global.localStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = v; },
    removeItem: (k) => { delete mockStorage[k]; }
  };

  const dirtyInput = '  XI A  ;\n  XI B  |\r\n  XII C ,  ';
  await saveMapelAlokasi('MAPEL_TEST_R2', '12345678', dirtyInput);

  const cached = JSON.parse(mockStorage['nexa_mapel_allocations_12345678'] || '{}');
  assert.strictEqual(cached['MAPEL_TEST_R2'], 'XI A, XI B, XII C', 'Stored string must be cleanly normalized');
});

// 3. AdminView: Universal allocation detection covers all standard variants
runTest('3.1 - AdminView: isUniversalAlloc handles Semua Tingkat, Semua Siswa, and variants', () => {
  const content = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
  assert.strictEqual(content.includes('Semua Rombel'), true, 'Must include Semua Rombel');
  assert.strictEqual(content.includes('Semua Siswa'), true, 'Must include Semua Siswa');
  assert.strictEqual(content.includes('GLOBAL'), true, 'Must include GLOBAL');

  // Verify mapel modal initialization uses isUniversalAlloc
  assert.strictEqual(content.includes('if (isUniversalAlloc(rawAlloc)) {'), true, 'Modal init must use isUniversalAlloc helper');
});

// 4. AdminView: Jadwal target formatting avoids double-Tingkat prefix
runTest('4.1 - AdminView: formatJadwalTarget renders clean compound and grade labels', () => {
  const content = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
  assert.strictEqual(content.includes('const formatJadwalTarget = (target) =>'), true, 'Must define formatJadwalTarget helper');
  assert.strictEqual(content.includes('Target: {formatJadwalTarget(j.target_kelas)}'), true, 'Must use formatJadwalTarget on Jadwal row');
});

// 5. AdminView: Excel bulk import flexible header mapping & delimiter normalization
runTest('5.1 - AdminView: Excel import matches Alokasi Kelas / Target Kelas and auto-inherits mapel allocation', () => {
  const content = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
  assert.strictEqual(content.includes("norm === 'alokasi_kelas' || norm === 'alokasi' || norm === 'target_kelas' || norm === 'kelas'"), true, 'Mapel import must match flexible alokasi headers');
  assert.strictEqual(content.includes("matchedMapel?.alokasi_kelas && !isUniversalAlloc(matchedMapel.alokasi_kelas)"), true, 'Jadwal import must auto-inherit mapel allocation when target_kelas is empty');
});

// 6. AdminView: Jadwal preset dropdown deduplicates and sorts parallel classes and tingkat
runTest('6.1 - AdminView: Jadwal preset dropdown sorts tingkat and deduplicates parallel classes', () => {
  const content = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
  assert.strictEqual(content.includes('parseInt(a, 10)'), true, 'Must sort tingkat numerically');
  assert.strictEqual(content.includes('localeCompare(b, undefined, { numeric: true, sensitivity: \'base\' })'), true, 'Must sort parallel classes numerically/alphabetically');
});

// 7. AdminView: Student list filter uses isClassMatching
runTest('7.1 - AdminView: Student tab matchesKelas uses isClassMatching instead of strict equality', () => {
  const content = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
  assert.strictEqual(content.includes('const matchesKelas = !filterKelas || isClassMatching(filterKelas, s);'), true, 'Siswa filter must use isClassMatching');
});

// 8. AdminView: "Semua Kelas (Umum)" checkbox stopPropagation
runTest('8.1 - AdminView: Semua Kelas checkbox and label use stopPropagation to prevent double toggle', () => {
  const content = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
  assert.strictEqual(content.includes('id="checkbox_mapel_semua_kelas"'), true, 'Must have checkbox_mapel_semua_kelas');
  assert.strictEqual(content.includes('e.stopPropagation();'), true, 'Must stop event propagation');
});

console.log(`\n==================================================`);
console.log(`SUMMARY: ${passed} passed, ${failed} failed out of ${passed + failed} tests.`);
console.log(`==================================================\n`);

if (failed > 0) {
  process.exit(1);
}
