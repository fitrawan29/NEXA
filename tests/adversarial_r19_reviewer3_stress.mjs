import { isClassMatching } from '../src/api.js';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('=== ADVERSARIAL REVIEWER 3 DEEP STRESS & EDGE-CASE SUITE (R19) ===\n');

let passCount = 0;
let totalCount = 0;

function runTest(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
  }
}

// -----------------------------------------------------------------------------
// 1. isClassMatching Edge Cases: Tingkat prefix with parallel class
// -----------------------------------------------------------------------------
runTest('1.1 - isClassMatching: Tingkat prefix with parallel class does NOT treat as grade-wide', () => {
  // Target 'Tingkat XI A' must match only student in XI A, not XI B
  assert.strictEqual(isClassMatching('Tingkat XI A', { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching('Tingkat XI A', { angkatan: 'XI', kelas_paralel: 'B' }), false);
  assert.strictEqual(isClassMatching('Tingkat XI A', { angkatan: '11', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching('Tingkat XI A', { angkatan: '11', kelas_paralel: 'B' }), false);
  assert.strictEqual(isClassMatching('Tingkat X-1', { angkatan: 'X', kelas_paralel: '1' }), true);
  assert.strictEqual(isClassMatching('Tingkat X-1', { angkatan: 'X', kelas_paralel: '2' }), false);
});

// -----------------------------------------------------------------------------
// 2. isClassMatching: Unassigned Student vs Omitted Parameter
// -----------------------------------------------------------------------------
runTest('2.1 - isClassMatching: Unassigned student ({}) rejected from specific exams, omitted student is fail-open', () => {
  // Empty student object (unassigned grade/class) must NOT match specific exams
  assert.strictEqual(isClassMatching('XI A', {}), false);
  assert.strictEqual(isClassMatching('Tingkat XI (Semua)', {}), false);
  assert.strictEqual(isClassMatching('Tingkat XI', {}), false);

  // But matches universal exams
  assert.strictEqual(isClassMatching('Semua Kelas', {}), true);
  assert.strictEqual(isClassMatching('Semua Tingkat (Umum)', {}), true);

  // Omitted student parameter is fail-open
  assert.strictEqual(isClassMatching('XI A', null), true);
  assert.strictEqual(isClassMatching('XI A', undefined), true);
  assert.strictEqual(isClassMatching('Semua Kelas', null), true);
  assert.strictEqual(isClassMatching('Semua Tingkat (Umum)', null), true);
});

// -----------------------------------------------------------------------------
// 3. isClassMatching: Extended Qualifier Variants
// -----------------------------------------------------------------------------
runTest('3.1 - isClassMatching: Extended qualifiers (Semua Rombel, Semua Siswa)', () => {
  assert.strictEqual(isClassMatching('Tingkat XI (Semua Rombel)', { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching('Tingkat XI (Semua Rombel)', { angkatan: 'XI', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching('Tingkat XI (Semua Rombel)', { angkatan: 'XII', kelas_paralel: 'A' }), false);
  assert.strictEqual(isClassMatching('Tingkat XI (Semua Siswa)', { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching('Tingkat XI (Semua Siswa)', { angkatan: 'XII', kelas_paralel: 'A' }), false);
});

// -----------------------------------------------------------------------------
// 4. src/api.js: buka_blokir resets both is_blocked and pelanggaran
// -----------------------------------------------------------------------------
runTest('4.1 - src/api.js: buka_blokir updates is_blocked: false and pelanggaran: 0', () => {
  const apiSrc = fs.readFileSync(path.join(process.cwd(), 'src/api.js'), 'utf8');
  const startIdx = apiSrc.indexOf("case 'buka_blokir':");
  assert.ok(startIdx !== -1, "case 'buka_blokir' must exist");
  const nextCaseIdx = apiSrc.indexOf("case '", startIdx + 20);
  const code = apiSrc.substring(startIdx, nextCaseIdx !== -1 ? nextCaseIdx : startIdx + 500);
  assert.ok(code.includes('is_blocked: false'), 'must set is_blocked: false');
  assert.ok(code.includes('pelanggaran: 0'), 'must reset pelanggaran: 0 to prevent instant re-lock');
});

// -----------------------------------------------------------------------------
// 5. src/api.js: monitoring_ujian selects complete student fields
// -----------------------------------------------------------------------------
runTest('5.1 - src/api.js: monitoring_ujian queries complete student attributes', () => {
  const apiSrc = fs.readFileSync(path.join(process.cwd(), 'src/api.js'), 'utf8');
  const startIdx = apiSrc.indexOf("case 'monitoring_ujian':");
  assert.ok(startIdx !== -1, "case 'monitoring_ujian' must exist");
  const nextCaseIdx = apiSrc.indexOf("case '", startIdx + 20);
  const code = apiSrc.substring(startIdx, nextCaseIdx !== -1 ? nextCaseIdx : startIdx + 1200);
  assert.ok(code.includes('nisn'), 'must select nisn');
  assert.ok(code.includes('angkatan'), 'must select angkatan');
  assert.ok(code.includes('kelas_paralel'), 'must select kelas_paralel');
  assert.ok(code.includes('kelas'), 'must select and format kelas');
});

// -----------------------------------------------------------------------------
// 6. src/api.js: create_mapel_bulk handles alokasi_kelas fallback & persistence
// -----------------------------------------------------------------------------
runTest('6.1 - src/api.js: create_mapel_bulk provides resilient fallback for alokasi_kelas', () => {
  const apiSrc = fs.readFileSync(path.join(process.cwd(), 'src/api.js'), 'utf8');
  const startIdx = apiSrc.indexOf("case 'create_mapel_bulk':");
  assert.ok(startIdx !== -1, "case 'create_mapel_bulk' must exist");
  const nextCaseIdx = apiSrc.indexOf("case '", startIdx + 20);
  const code = apiSrc.substring(startIdx, nextCaseIdx !== -1 ? nextCaseIdx : startIdx + 2000);
  assert.ok(code.includes('alokasi_kelas'), 'must check alokasi_kelas column presence');
  assert.ok(code.includes('saveMapelAlokasi'), 'must persist allocations via saveMapelAlokasi');
});

// -----------------------------------------------------------------------------
// 7. AdminView.jsx: Jadwal modal Mapel selection coerces id_mapel to string
// -----------------------------------------------------------------------------
runTest('7.1 - AdminView.jsx: id_mapel onChange uses string equality for robust numeric ID matching', () => {
  const adminSrc = fs.readFileSync(path.join(process.cwd(), 'src/views/AdminView.jsx'), 'utf8');
  assert.ok(adminSrc.includes('String(m.id_mapel) === String(e.target.value)'), 'must use String() equality');
});

// -----------------------------------------------------------------------------
// 8. AdminView.jsx: Mapel template and bulk import include alokasi_kelas
// -----------------------------------------------------------------------------
runTest('8.1 - AdminView.jsx: Mapel template header and import parsing include alokasi_kelas', () => {
  const adminSrc = fs.readFileSync(path.join(process.cwd(), 'src/views/AdminView.jsx'), 'utf8');
  assert.ok(adminSrc.includes("headers = ['nama_mapel', 'alokasi_kelas']"), 'template must include alokasi_kelas header');
  assert.ok(adminSrc.includes('alokasi_kelas: alokasi'), 'bulk import must map alokasi_kelas');
});

console.log('\n==================================================');
console.log(`SUMMARY: ${passCount} / ${totalCount} adversarial stress tests passed.`);
console.log('==================================================\n');

if (passCount !== totalCount) {
  process.exit(1);
}
