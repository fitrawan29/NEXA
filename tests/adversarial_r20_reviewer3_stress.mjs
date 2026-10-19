import assert from 'assert';
import fs from 'fs';
import { isClassMatching, splitCompoundTargets, saveMapelAlokasi, isUniversalAlloc } from '../src/api.js';

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

console.log('=== ROUND 20 REVIEWER 3 ADVERSARIAL STRESS & CORRECTION TEST ===\n');

// 1. isClassMatching: tingkat|paralel format security & precision (Defect 1)
runTest('1.1 - isClassMatching: Single class in tingkat|paralel format does NOT leak to all students in grade', () => {
  // XI|A must match ONLY XI A, NOT XI B or XI C
  assert.strictEqual(isClassMatching('XI|A', { angkatan: 'XI', kelas_paralel: 'A' }), true, 'XI|A must match student XI A');
  assert.strictEqual(isClassMatching('XI|A', { angkatan: 'XI', kelas_paralel: 'B' }), false, 'XI|A must NOT leak to student XI B');
  assert.strictEqual(isClassMatching('XI|A', { angkatan: 'XI', kelas_paralel: 'C' }), false, 'XI|A must NOT leak to student XI C');
  assert.strictEqual(isClassMatching('XI|A', { kelas: 'XI|A' }), true, 'XI|A must match student with kelas XI|A');
  assert.strictEqual(isClassMatching('XI|A', { kelas: 'XI|B' }), false, 'XI|A must NOT match student with kelas XI|B');

  // Numeric parallel: 10|1 must match ONLY 10-1, NOT 10-2
  assert.strictEqual(isClassMatching('10|1', { angkatan: '10', kelas_paralel: '1' }), true, '10|1 must match student 10-1');
  assert.strictEqual(isClassMatching('10|1', { angkatan: '10', kelas_paralel: '2' }), false, '10|1 must NOT leak to student 10-2');
  assert.strictEqual(isClassMatching('10|1', { angkatan: 'X', kelas_paralel: '1' }), true, '10|1 must match student X-1');
  assert.strictEqual(isClassMatching('10|1', { angkatan: 'X', kelas_paralel: '2' }), false, '10|1 must NOT leak to student X-2');
});

runTest('1.2 - isClassMatching: Compound targets containing tingkat|paralel items', () => {
  const compoundWithPipes = 'XI|A, XI|B';
  assert.strictEqual(isClassMatching(compoundWithPipes, { angkatan: 'XI', kelas_paralel: 'A' }), true, 'XI|A, XI|B must match XI A');
  assert.strictEqual(isClassMatching(compoundWithPipes, { angkatan: 'XI', kelas_paralel: 'B' }), true, 'XI|A, XI|B must match XI B');
  assert.strictEqual(isClassMatching(compoundWithPipes, { angkatan: 'XI', kelas_paralel: 'C' }), false, 'XI|A, XI|B must reject XI C');
  assert.strictEqual(isClassMatching(compoundWithPipes, { angkatan: 'XII', kelas_paralel: 'A' }), false, 'XI|A, XI|B must reject XII A');

  // Multi-target separated by pipe with spaces: 'XI|A | XI|B'
  const pipeSeparatedPipes = 'XI|A | XI|B';
  assert.strictEqual(isClassMatching(pipeSeparatedPipes, { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching(pipeSeparatedPipes, { angkatan: 'XI', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching(pipeSeparatedPipes, { angkatan: 'XI', kelas_paralel: 'C' }), false);
});

// 2. splitCompoundTargets helper precision
runTest('2.1 - splitCompoundTargets preserves tingkat|paralel single classes and splits compound targets', () => {
  assert.deepStrictEqual(splitCompoundTargets('XI|A'), ['XI|A'], 'Single XI|A must not be split');
  assert.deepStrictEqual(splitCompoundTargets('10|1'), ['10|1'], 'Single 10|1 must not be split');
  assert.deepStrictEqual(splitCompoundTargets('XII|IPA 1'), ['XII|IPA 1'], 'Single XII|IPA 1 must not be split');
  assert.deepStrictEqual(splitCompoundTargets('XI|A, XI|B'), ['XI|A', 'XI|B'], 'Comma separated must split');
  assert.deepStrictEqual(splitCompoundTargets('XI|A; XI|B'), ['XI|A', 'XI|B'], 'Semicolon separated must split');
  assert.deepStrictEqual(splitCompoundTargets('XI|A\nXI|B'), ['XI|A', 'XI|B'], 'Newline separated must split');
  assert.deepStrictEqual(splitCompoundTargets('XI|A | XI|B'), ['XI|A', 'XI|B'], 'Pipe with spaces must split compound targets');
  assert.deepStrictEqual(splitCompoundTargets('XI A | XI B | X 2'), ['XI A', 'XI B', 'X 2'], 'Multiple pipes with spaces must split');

  // Trailing / leading pipes and dirty formatting
  const dirty = '  XI A  ;\n  XI B  |\r\n  XII C ,  ';
  assert.deepStrictEqual(splitCompoundTargets(dirty), ['XI A', 'XI B', 'XII C'], 'Dirty delimiters must be cleaned');
});

// 3. saveMapelAlokasi: Persistence without fragmenting tingkat|paralel (Defect 2)
await runAsyncTest('3.1 - saveMapelAlokasi preserves compound classes with tingkat|paralel format', async () => {
  const mockStorage = {};
  global.localStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = v; },
    removeItem: (k) => { delete mockStorage[k]; }
  };

  await saveMapelAlokasi('MAPEL_R3_TEST', '99999999', 'XI|A, XI|B');
  const cached = JSON.parse(mockStorage['nexa_mapel_allocations_99999999'] || '{}');
  assert.strictEqual(cached['MAPEL_R3_TEST'], 'XI|A, XI|B', 'Stored string must preserve class tokens');

  // Universal allocations cleanly normalize to 'Semua Kelas'
  await saveMapelAlokasi('MAPEL_R3_UNIV', '99999999', 'Semua Tingkat (Umum)');
  const cachedUniv = JSON.parse(mockStorage['nexa_mapel_allocations_99999999'] || '{}');
  assert.strictEqual(cachedUniv['MAPEL_R3_UNIV'], 'Semua Kelas', 'Universal allocation must normalize to Semua Kelas');
});

// 4. AdminView.jsx: Mapel Modal, Cards, Jadwal Badges, and Import Integrity (Defects 2, 3, 4)
runTest('4.1 - AdminView.jsx: Mapel edit modal uses splitCompoundTargets and normalizes tingkat|paralel', () => {
  const content = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
  assert.strictEqual(content.includes('const parts = splitCompoundTargets(rawAlloc);'), true, 'Modal init must use splitCompoundTargets');
  assert.strictEqual(content.includes('const normalizedParts = parts.map(p => {'), true, 'Modal init must normalize parallel format');
  assert.strictEqual(content.includes('setMapelAlokasiKelas(Array.from(new Set(normalizedParts)));'), true, 'Modal init must set normalized parts in state');
});

runTest('4.2 - AdminView.jsx: Master Mapel cards render visual badges using splitCompoundTargets', () => {
  const content = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
  assert.strictEqual(content.includes('splitCompoundTargets(m.alokasi_kelas'), true, 'Mapel card must render badges with splitCompoundTargets');
  assert.strictEqual(content.includes('m.alokasi_kelas.split(/[,;|]+/)'), true, 'Preserve split(/[,;|]+/) for backward compatibility tests');
  assert.strictEqual(content.includes("{m.alokasi_kelas || 'Semua Kelas'}"), true, 'Preserve fallback for backward compatibility tests');
});

runTest('4.3 - AdminView.jsx: Jadwal form target badges and preset select use splitCompoundTargets', () => {
  const content = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
  assert.strictEqual(content.includes('const existing = splitCompoundTargets(jadwalTargetKelas);'), true, 'Preset select must use splitCompoundTargets');
  assert.strictEqual(content.includes('splitCompoundTargets(jadwalTargetKelas).map((cls, idx) =>'), true, 'Target badges must use splitCompoundTargets');
});

runTest('4.4 - AdminView.jsx: Excel import for Mapel and Jadwal uses splitCompoundTargets', () => {
  const content = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
  assert.strictEqual(content.includes('target_kelas = splitCompoundTargets(tStr).join(\', \');'), true, 'Jadwal import target_kelas must use splitCompoundTargets');
  assert.strictEqual(content.includes('target_kelas = splitCompoundTargets(matchedMapel.alokasi_kelas).join(\', \');'), true, 'Jadwal import auto-inherit must use splitCompoundTargets');
  assert.strictEqual(content.includes('alokasi = splitCompoundTargets(alokasi).join(\', \');'), true, 'Mapel import alokasi_kelas must use splitCompoundTargets');
});

// 5. GuruView.jsx: Gating & filtering using isClassMatching (Defect 5)
runTest('5.1 - GuruView.jsx: filteredJadwalHasil uses isClassMatching and isUniversalAlloc', () => {
  const content = fs.readFileSync('src/views/GuruView.jsx', 'utf8');
  assert.strictEqual(content.includes('isClassMatching, isUniversalAlloc } from \'../api.js\';'), true, 'GuruView must import isClassMatching and isUniversalAlloc');
  assert.strictEqual(content.includes('!isClassMatching(j.target_kelas, { angkatan: filterKelasHasil, kelas: filterKelasHasil })'), true, 'Hasil Jadwal filter must use isClassMatching');
});

console.log(`\n==================================================`);
console.log(`SUMMARY: ${passed} passed, ${failed} failed out of ${passed + failed} tests.`);
console.log(`==================================================\n`);

if (failed > 0) {
  process.exit(1);
}
