import assert from 'assert';
import fs from 'fs';
import { isClassMatching, splitCompoundTargets, saveMapelAlokasi, isUniversalAlloc } from '../src/api.js';

console.log('=== INDEPENDENT VICTORY AUDITOR VERIFICATION (ROUND 20) ===\n');

let total = 0;
let passed = 0;
let failed = 0;

function audit(name, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}\n       ${err.message}`);
    failed++;
  }
}

async function auditAsync(name, fn) {
  total++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}\n       ${err.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// 1. isClassMatching Compound Delimiter & Syntax Rigor
// ---------------------------------------------------------------------------
audit('1.1 - Compound delimiter parsing (comma, semicolon, pipe, newline, mixed whitespace)', () => {
  const target = ' XI A , XI B ; XII C | 10 1 \n 10 2 \r\n 11 IPA ';
  
  assert.strictEqual(isClassMatching(target, { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching(target, { angkatan: 'XI', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching(target, { angkatan: 'XII', kelas_paralel: 'C' }), true);
  assert.strictEqual(isClassMatching(target, { angkatan: 'X', kelas_paralel: '1' }), true);
  assert.strictEqual(isClassMatching(target, { angkatan: '10', kelas_paralel: '2' }), true);
  assert.strictEqual(isClassMatching(target, { angkatan: 'XI', kelas_paralel: 'IPA' }), true);

  // Negative tests: out of target
  assert.strictEqual(isClassMatching(target, { angkatan: 'XI', kelas_paralel: 'C' }), false);
  assert.strictEqual(isClassMatching(target, { angkatan: 'XII', kelas_paralel: 'A' }), false);
  assert.strictEqual(isClassMatching(target, { angkatan: 'X', kelas_paralel: '3' }), false);
  assert.strictEqual(isClassMatching(target, { angkatan: '9', kelas_paralel: 'A' }), false);
});

audit('1.2 - Consecutive and messy delimiters do not create ghost empty matches', () => {
  const messy = ' ,,, ;;; ||| \n\r XI A ,,, ;;; ||| XI B ';
  assert.strictEqual(isClassMatching(messy, { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching(messy, { angkatan: 'XI', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching(messy, { angkatan: 'XI', kelas_paralel: 'C' }), false);
  assert.strictEqual(isClassMatching(messy, {}), false);
});

// ---------------------------------------------------------------------------
// 2. Critical Security: Canonical 'tingkat|paralel' Preservation
// ---------------------------------------------------------------------------
audit('2.1 - Single class in tingkat|paralel format (XI|A, 10|1) strictly isolates sections without grade leak', () => {
  // Target: 'XI|A'
  assert.strictEqual(isClassMatching('XI|A', { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching('XI|A', { kelas: 'XI A' }), true);
  assert.strictEqual(isClassMatching('XI|A', { kelas: 'XI|A' }), true);
  assert.strictEqual(isClassMatching('XI|A', { angkatan: 'XI', kelas_paralel: 'B' }), false);
  assert.strictEqual(isClassMatching('XI|A', { angkatan: 'XI', kelas_paralel: 'C' }), false);
  assert.strictEqual(isClassMatching('XI|A', { angkatan: 'XII', kelas_paralel: 'A' }), false);

  // Target: '10|1'
  assert.strictEqual(isClassMatching('10|1', { angkatan: '10', kelas_paralel: '1' }), true);
  assert.strictEqual(isClassMatching('10|1', { angkatan: 'X', kelas_paralel: '1' }), true);
  assert.strictEqual(isClassMatching('10|1', { angkatan: '10', kelas_paralel: '2' }), false);
  assert.strictEqual(isClassMatching('10|1', { angkatan: 'X', kelas_paralel: '2' }), false);
});

audit('2.2 - Compound targets with multiple tingkat|paralel tokens', () => {
  const compound = 'XI|A, XI|B, 10|1';
  assert.strictEqual(isClassMatching(compound, { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching(compound, { angkatan: 'XI', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching(compound, { angkatan: 'X', kelas_paralel: '1' }), true);
  assert.strictEqual(isClassMatching(compound, { angkatan: 'XI', kelas_paralel: 'C' }), false);
  assert.strictEqual(isClassMatching(compound, { angkatan: 'X', kelas_paralel: '2' }), false);
});

// ---------------------------------------------------------------------------
// 3. Universal Target Behaviors & Failsafes
// ---------------------------------------------------------------------------
audit('3.1 - Universal target keywords grant access to all students including empty context', () => {
  const universalList = [
    'Semua Kelas',
    'Semua Kelas (Umum)',
    'Semua Tingkat',
    'Semua Tingkat (Umum)',
    'Semua Rombel',
    'Semua Siswa',
    'Umum',
    'ALL',
    'GLOBAL',
    '-',
    '*',
    ''
  ];

  const anyStudent = { angkatan: 'X', kelas_paralel: 'TKJ 1' };
  const emptyStudent = {};

  for (const u of universalList) {
    assert.strictEqual(isClassMatching(u, anyStudent), true, `Universal '${u}' should match standard student`);
    assert.strictEqual(isClassMatching(u, emptyStudent), true, `Universal '${u}' should match empty student`);
  }
});

audit('3.2 - Array target input handling', () => {
  assert.strictEqual(isClassMatching(['XI A', 'XI B'], { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching(['XI A', 'XI B'], { angkatan: 'XI', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching(['XI A', 'XI B'], { angkatan: 'XI', kelas_paralel: 'C' }), false);
  assert.strictEqual(isClassMatching([], { angkatan: 'XI', kelas_paralel: 'C' }), true);
});

// ---------------------------------------------------------------------------
// 4. Persistence & Normalization via saveMapelAlokasi
// ---------------------------------------------------------------------------
await auditAsync('4.1 - saveMapelAlokasi normalizes messy multi-class inputs cleanly to comma-separated list', async () => {
  const mockStorage = {};
  global.localStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = v; },
    removeItem: (k) => { delete mockStorage[k]; }
  };

  const dirtyAlloc = '  XI A ; \n XI B | XII IPA 1 , ';
  await saveMapelAlokasi('MAPEL_AUDIT_1', '88888888', dirtyAlloc);

  const cached = JSON.parse(mockStorage['nexa_mapel_allocations_88888888'] || '{}');
  assert.strictEqual(cached['MAPEL_AUDIT_1'], 'XI A, XI B, XII IPA 1');
});

await auditAsync('4.2 - saveMapelAlokasi preserves tingkat|paralel entries and normalizes universal entries', async () => {
  const mockStorage = {};
  global.localStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = v; },
    removeItem: (k) => { delete mockStorage[k]; }
  };

  await saveMapelAlokasi('MAPEL_AUDIT_PIPE', '88888888', 'XI|A, XI|B');
  const cachedPipe = JSON.parse(mockStorage['nexa_mapel_allocations_88888888'] || '{}');
  assert.strictEqual(cachedPipe['MAPEL_AUDIT_PIPE'], 'XI|A, XI|B');

  await saveMapelAlokasi('MAPEL_AUDIT_UNIV', '88888888', 'Semua Kelas (Umum)');
  const cachedUniv = JSON.parse(mockStorage['nexa_mapel_allocations_88888888'] || '{}');
  assert.strictEqual(cachedUniv['MAPEL_AUDIT_UNIV'], 'Semua Kelas');
});

// ---------------------------------------------------------------------------
// 5. Source Code Static Integrity & Requirements Check (R1, R2, R3)
// ---------------------------------------------------------------------------
audit('5.1 - AdminView.jsx satisfies R1 (Checkbox group per tingkat, Pilih Semua, multi-select, badges)', () => {
  const adminSrc = fs.readFileSync('src/views/AdminView.jsx', 'utf8');

  // Checkbox group per tingkat
  assert.ok(adminSrc.includes('sortedTingkat.map(t =>'), 'R1: Must iterate over sorted tingkat');
  assert.ok(adminSrc.includes('Tingkat {t}'), 'R1: Must display Tingkat label');

  // "Pilih Semua" and "Batal Semua"
  assert.ok(adminSrc.includes('Pilih Semua'), 'R1: Must provide Pilih Semua button');
  assert.ok(adminSrc.includes('Batal Semua'), 'R1: Must provide Batal Semua toggle');

  // "Semua Kelas (Umum)"
  assert.ok(adminSrc.includes('Semua Kelas (Umum)'), 'R1: Must provide Semua Kelas (Umum) option');
  assert.ok(adminSrc.includes('isMapelSemuaKelas'), 'R1: Must manage isMapelSemuaKelas state');

  // Multi-select state
  assert.ok(adminSrc.includes('mapelAlokasiKelas'), 'R1: Must manage mapelAlokasiKelas array state');
  assert.ok(adminSrc.includes('name="alokasi_kelas"'), 'R1: Must have form input name alokasi_kelas');

  // Mapel card badges: separate badge per parallel class
  assert.ok(adminSrc.includes('splitCompoundTargets(m.alokasi_kelas'), 'R1: Must render badges via splitCompoundTargets');
  assert.ok(adminSrc.includes('px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50'), 'R1: Must render distinct badge styling');
});

audit('5.2 - AdminView.jsx satisfies R2 (Jadwal Ujian multi-target integration)', () => {
  const adminSrc = fs.readFileSync('src/views/AdminView.jsx', 'utf8');

  // Auto-synchronization on Mapel change
  assert.ok(adminSrc.includes('const alloc = selectedM?.alokasi_kelas;'), 'R2: Must inspect selected mapel allocation');
  assert.ok(adminSrc.includes('setJadwalTargetKelas(newTarget);'), 'R2: Must auto-populate target_kelas from mapel');

  // Target input supports multi-class string
  assert.ok(adminSrc.includes('id="input_jadwal_target_kelas"'), 'R2: Must have controlled target_kelas input');
  assert.ok(adminSrc.includes('Pisahkan koma (,) untuk multi-kelas'), 'R2: Must guide user on comma delimiter');

  // Removable badge pills
  assert.ok(adminSrc.includes('splitCompoundTargets(jadwalTargetKelas).map((cls, idx) =>'), 'R2: Must render removable badge pills');
  assert.ok(adminSrc.includes('title={`Hapus ${cls}`}'), 'R2: Must provide remove button for target badges');
});

audit('5.3 - src/api.js satisfies R3 (isClassMatching compound matching and negative gating)', () => {
  const apiSrc = fs.readFileSync('src/api.js', 'utf8');

  // Compound splitting helper
  assert.ok(apiSrc.includes('export const splitCompoundTargets ='), 'R3: Must export splitCompoundTargets');
  assert.ok(apiSrc.includes('export const isUniversalAlloc ='), 'R3: Must export isUniversalAlloc');

  // isClassMatching subTarget evaluation
  assert.ok(apiSrc.includes('subTargets.length > 1'), 'R3: Must detect multi-class targets');
  assert.ok(apiSrc.includes('subTargets.some(t => isClassMatching(t, student))'), 'R3: Must check if student matches ANY sub-target');
});

audit('5.4 - GuruView.jsx filtering uses isClassMatching to prevent cross-grade leaks', () => {
  const guruSrc = fs.readFileSync('src/views/GuruView.jsx', 'utf8');
  assert.ok(guruSrc.includes('isClassMatching(j.target_kelas, { angkatan: filterKelasHasil, kelas: filterKelasHasil })'), 'GuruView must use isClassMatching');
});

console.log(`\n==================================================`);
console.log(`INDEPENDENT AUDITOR SUMMARY: ${passed} passed, ${failed} failed out of ${total} tests.`);
console.log(`==================================================\n`);

if (failed > 0) {
  process.exit(1);
}
