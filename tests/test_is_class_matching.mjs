import { isClassMatching } from '../src/api.js';

const tests = [
  ['XI A', { angkatan: 'XI', kelas_paralel: 'A' }, true],
  ['XI A', { angkatan: 'XI', kelas_paralel: 'B' }, false],
  ['XI A', { kelas: 'XI A' }, true],
  ['XI A', { kelas: 'XI B' }, false],
  ['XI A', { kelas: 'XI|A' }, true],
  ['XI A', { kelas: 'XI|B' }, false],
  ['Tingkat XI (Semua)', { angkatan: 'XI', kelas_paralel: 'A' }, true],
  ['Tingkat XI (Semua)', { angkatan: 'XI', kelas_paralel: 'B' }, true],
  ['Tingkat XI (Semua)', { angkatan: 'XII', kelas_paralel: 'A' }, false],
  ['Tingkat XI', { angkatan: 'XI', kelas_paralel: 'B' }, true],
  ['Semua Kelas', { angkatan: 'XI', kelas_paralel: 'B' }, true],
  ['', { angkatan: 'XI', kelas_paralel: 'B' }, true],
  [null, { angkatan: 'XI', kelas_paralel: 'B' }, true],
  ['XI-A', { angkatan: 'XI', kelas_paralel: 'A' }, true],
  ['XI-A', { angkatan: 'XI', kelas_paralel: 'B' }, false],
  // Adversarial edge cases fixed by reviewer
  ['XI A', { angkatan: 'XI', kelas_paralel: 'A', kelas: 'XI' }, true],
  ['XI MIPA 1', { angkatan: 'XI', kelas_paralel: 'MIPA 1', kelas: 'XI' }, true],
  ['XI A', { angkatan: '11', kelas_paralel: 'A' }, true],
  ['11 A', { angkatan: 'XI', kelas_paralel: 'A' }, true],
  ['Tingkat 11 (Semua)', { angkatan: 'XI', kelas_paralel: 'A' }, true],
  ['Tingkat XI (Semua)', { angkatan: '11', kelas_paralel: 'A' }, true],
  ['XI', { kelas: 'XI A' }, true],
  ['11', { kelas: 'XI A' }, true],
  ['XI A', { kelas: 'Kelas XI-A' }, true],
  ['Kelas XI A', { kelas: 'XI A' }, true],
  ['XI A', { angkatan: 'XI' }, false],
  ['XI A', { kelas: 'XI' }, false],
  ['X-1', { angkatan: 'X', kelas_paralel: '1' }, true],
  ['X-1', { angkatan: 'X', kelas_paralel: '2' }, false],
  ['XI A', { angkatan: '10', kelas_paralel: 'A' }, false],
  // Round 19 Reviewer 2: Universal targets edge cases & primary school (SD) grades
  ['Semua Tingkat', { angkatan: 'XI', kelas_paralel: 'A' }, true],
  ['Semua Tingkat (Umum)', { angkatan: 'XI', kelas_paralel: 'A' }, true],
  ['Semua Kelas (Umum)', { angkatan: 'XI', kelas_paralel: 'A' }, true],
  ['Semua Rombel', { angkatan: 'XI', kelas_paralel: 'A' }, true],
  ['Semua Siswa', { angkatan: 'XI', kelas_paralel: 'A' }, true],
  ['4 A', { angkatan: 'IV', kelas_paralel: 'A' }, true],
  ['IV A', { angkatan: '4', kelas_paralel: 'A' }, true],
  ['7 B', { angkatan: 'VII', kelas_paralel: 'B' }, true],
  ['Semua Kelas XI', { angkatan: 'XI', kelas_paralel: 'A' }, true],
  ['Semua Kelas XI', { angkatan: 'XII', kelas_paralel: 'A' }, false],
  // Round 19 Reviewer 3: Tingkat prefix with parallel class, null student security, and qualifier variants
  ['Tingkat XI A', { angkatan: 'XI', kelas_paralel: 'A' }, true],
  ['Tingkat XI A', { angkatan: 'XI', kelas_paralel: 'B' }, false],
  ['Tingkat X-1', { angkatan: 'X', kelas_paralel: '1' }, true],
  ['Tingkat X-1', { angkatan: 'X', kelas_paralel: '2' }, false],
  ['XI A', null, true],
  ['XI A', undefined, true],
  ['Tingkat XI (Semua)', null, true],
  ['Semua Kelas', null, true],
  ['Semua Tingkat (Umum)', null, true],
  ['Tingkat XI (Semua Rombel)', { angkatan: 'XI', kelas_paralel: 'A' }, true],
  ['Tingkat XI (Semua Siswa)', { angkatan: 'XI', kelas_paralel: 'B' }, true],
  ['Tingkat XI (Semua Siswa)', { angkatan: 'XII', kelas_paralel: 'B' }, false],
];

let failed = 0;
tests.forEach(([t, s, expected], i) => {
  const actual = isClassMatching(t, s);
  if (actual !== expected) {
    console.error(`Test ${i} FAILED: target=${t}, expected=${expected}, got=${actual}`);
    failed++;
  } else {
    console.log(`Test ${i} passed: ${t} -> ${actual}`);
  }
});

if (failed === 0) {
  console.log(`ALL ${tests.length} TESTS PASSED!`);
} else {
  console.error(`${failed} tests failed!`);
  process.exit(1);
}
