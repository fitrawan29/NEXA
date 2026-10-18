import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { isClassMatching } from '../src/api.js';

console.log('=== ADVERSARIAL REVIEWER DEEP BREAK TEST (R19) ===\n');

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
// 1. ADVANCED ISCLASSMATCHING ADVERSARIAL PERMUTATIONS
// -------------------------------------------------------------------------
runTest('1.1 - Parallel class matching with mixed student representations', () => {
  // Case: Student with separate angkatan & kelas_paralel plus redundant/partial rawKelas
  assert.strictEqual(isClassMatching('XI A', { angkatan: 'XI', kelas_paralel: 'A', kelas: 'XI' }), true);
  assert.strictEqual(isClassMatching('XI A', { angkatan: 'XI', kelas_paralel: 'A', kelas: '11' }), true);
  assert.strictEqual(isClassMatching('XI MIPA 1', { angkatan: 'XI', kelas_paralel: 'MIPA 1', kelas: 'XI' }), true);
  assert.strictEqual(isClassMatching('XI MIPA 1', { angkatan: 'XI', kelas_paralel: 'MIPA 1', kelas: 'XI MIPA 1' }), true);

  // Negative: Different parallel class
  assert.strictEqual(isClassMatching('XI A', { angkatan: 'XI', kelas_paralel: 'B', kelas: 'XI' }), false);
  assert.strictEqual(isClassMatching('XI MIPA 1', { angkatan: 'XI', kelas_paralel: 'MIPA 2', kelas: 'XI' }), false);
});

runTest('1.2 - Arabic <-> Roman numeral grade equivalence', () => {
  // 11 <-> XI
  assert.strictEqual(isClassMatching('11 A', { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching('XI A', { angkatan: '11', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching('Tingkat 11 (Semua)', { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching('Tingkat XI (Semua)', { angkatan: '11', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching('11', { kelas: 'XI A' }), true);
  assert.strictEqual(isClassMatching('XI', { kelas: '11 A' }), true);

  // 10 <-> X
  assert.strictEqual(isClassMatching('10-1', { angkatan: 'X', kelas_paralel: '1' }), true);
  assert.strictEqual(isClassMatching('X-1', { angkatan: '10', kelas_paralel: '1' }), true);
  assert.strictEqual(isClassMatching('10', { angkatan: 'X' }), true);

  // 12 <-> XII
  assert.strictEqual(isClassMatching('12 IPS 1', { angkatan: 'XII', kelas_paralel: 'IPS 1' }), true);
  assert.strictEqual(isClassMatching('XII IPS 1', { angkatan: '12', kelas_paralel: 'IPS 1' }), true);

  // Negatives across different grade levels
  assert.strictEqual(isClassMatching('XI A', { angkatan: '10', kelas_paralel: 'A' }), false);
  assert.strictEqual(isClassMatching('12 A', { angkatan: 'XI', kelas_paralel: 'A' }), false);
  assert.strictEqual(isClassMatching('Tingkat 12 (Semua)', { angkatan: 'XI', kelas_paralel: 'A' }), false);
  assert.strictEqual(isClassMatching('Tingkat XI (Semua)', { angkatan: '12' }), false);
});

runTest('1.3 - Prefix resistance (Kelas, Tingkat, Rombel, Paralel) and irregular punctuation', () => {
  assert.strictEqual(isClassMatching('Kelas XI A', { kelas: 'XI A' }), true);
  assert.strictEqual(isClassMatching('XI A', { kelas: 'Kelas XI A' }), true);
  assert.strictEqual(isClassMatching('Rombel XI A', { kelas: 'Kelas XI-A' }), true);
  assert.strictEqual(isClassMatching('XI-A', { kelas: 'XI A' }), true);
  assert.strictEqual(isClassMatching('XI_A', { kelas: 'XI A' }), true);
  assert.strictEqual(isClassMatching('XI A', { angkatan: 'XI', kelas_paralel: 'Paralel A' }), true);
});

runTest('1.4 - Universal targets and null / empty handling', () => {
  assert.strictEqual(isClassMatching(null, { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching('', { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching('Semua Kelas', { angkatan: 'XI', kelas_paralel: 'A' }), true);
  assert.strictEqual(isClassMatching('SEMUA', { angkatan: 'XII', kelas_paralel: 'B' }), true);
  assert.strictEqual(isClassMatching('UMUM', { angkatan: 'X', kelas_paralel: '1' }), true);
  assert.strictEqual(isClassMatching('ALL', { angkatan: 'XI' }), true);
  assert.strictEqual(isClassMatching('XI A', null), true);
  assert.strictEqual(isClassMatching('XI A', undefined), true);
});

runTest('1.5 - Students without parallel classes are rejected for parallel-specific targets', () => {
  assert.strictEqual(isClassMatching('XI A', { angkatan: 'XI' }), false);
  assert.strictEqual(isClassMatching('XI A', { kelas: 'XI' }), false);
  assert.strictEqual(isClassMatching('XI A', { angkatan: 'XI', kelas_paralel: '' }), false);
});

// -------------------------------------------------------------------------
// 2. ADMINVIEW JADWAL CONTROLLED STATE VERIFICATION
// -------------------------------------------------------------------------
runTest('2.1 - AdminView Jadwal form uses controlled React state for target_kelas', () => {
  const content = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
  assert.strictEqual(content.includes('const [jadwalTargetKelas, setJadwalTargetKelas] = useState(\'\');'), true);
  assert.strictEqual(content.includes('value={jadwalTargetKelas}'), true);
  assert.strictEqual(content.includes('onChange={(e) => setJadwalTargetKelas(e.target.value)}'), true);
  assert.strictEqual(content.includes('setJadwalTargetKelas(newTarget);'), true);
});

// -------------------------------------------------------------------------
// 3. EXAMROOM LIVE PROCTORING & TIMER EXTENSION VERIFICATION
// -------------------------------------------------------------------------
runTest('3.1 - ExamRoom implements endMsRef and live proctor polling interval', () => {
  const content = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8');
  assert.strictEqual(content.includes('endMsRef = useRef('), true);
  assert.strictEqual(content.includes('initialRemainingMsRef = useRef('), true);
  assert.strictEqual(content.includes('pollInterval = setInterval(async () => {'), true);
  assert.strictEqual(content.includes('clearInterval(pollInterval);'), true);
  assert.strictEqual(content.includes('res.data.waktu_selesai'), true);
  assert.strictEqual(content.includes('endMsRef.current = serverEndMs;'), true);
  assert.strictEqual(content.includes('Waktu Diperpanjang'), true);
});

// -------------------------------------------------------------------------
// 4. GURVIEW SCHEDULE RESOLUTION AND STRING SAFETY
// -------------------------------------------------------------------------
runTest('4.1 - GuruView resolves selectedJadwal safely whether string or object', () => {
  const content = fs.readFileSync('src/views/GuruView.jsx', 'utf8');
  assert.strictEqual(content.includes('const activeJadwalId = typeof selectedJadwal === \'object\' ? selectedJadwal?.id_jadwal : selectedJadwal;'), true);
  assert.strictEqual(content.includes('const totalSoal = log.total_soal || (currJadwal?.total_soal || currJadwal?.jumlah_soal || 40);'), true);
  assert.strictEqual(content.includes('setSelectedJadwal(j); navigateTab(\'monitoring\');'), true);
});

// -------------------------------------------------------------------------
// 5. SRC/API.JS GET_STATUS_LOG_UJIAN AND GET_ALL_MAPEL VERIFICATION
// -------------------------------------------------------------------------
runTest('5.1 - src/api.js attaches waktu_selesai to get_status_log_ujian and preserves m.alokasi_kelas', () => {
  const content = fs.readFileSync('src/api.js', 'utf8');
  assert.strictEqual(content.includes('waktu_selesai,'), true);
  assert.strictEqual(content.includes('durasi_menit,'), true);
  assert.strictEqual(content.includes('allocMap[m.id_mapel] || m.alokasi_kelas || \'Semua Kelas\''), true);
});

console.log(`\n==================================================`);
console.log(`SUMMARY: ${passedTests} / ${totalTests} adversarial test suites passed.`);
console.log(`==================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
