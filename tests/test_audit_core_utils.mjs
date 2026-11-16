import assert from 'node:assert/strict';
import * as bundle from '../src/utils/nexaBundle.js';
import { getStatusBarColor } from '../src/utils/themeColor.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}\n  ${err.message}`);
    failed++;
  }
}

test('hashSeed produces distinct 32-bit unsigned ints for different student IDs', () => {
  assert.equal(typeof bundle.hashSeed, 'function', 'hashSeed must be exported');
  const h1 = bundle.hashSeed('S-101_J-1_Q-1');
  const h2 = bundle.hashSeed('S-102_J-1_Q-1');
  assert.notEqual(h1, h2);
  assert.equal(Number.isInteger(h1) && h1 >= 0, true);
});

test('evaluateAKMQuestion supports multi-key ISIAN (|) and whitespace collapse', () => {
  const q = { id_soal: 'Q1', tipe_soal: 'ISIAN', bobot: 10, kunci_jawaban: 'Jakarta | DKI Jakarta' };
  assert.equal(bundle.evaluateAKMQuestion(q, '  dki   jakarta ').isCorrect, true);
  assert.equal(bundle.evaluateAKMQuestion(q, 'jakarta').isCorrect, true);
  assert.equal(bundle.evaluateAKMQuestion(q, 'Bandung').isCorrect, false);
});

test('evaluateAKMQuestion handles PGK JSON options containing commas cleanly', () => {
  const q = {
    id_soal: 'Q2',
    tipe_soal: 'PGK',
    bobot: 10,
    kunci_jawaban: JSON.stringify(['1, 2, dan 3', '4, 5'])
  };
  assert.equal(bundle.evaluateAKMQuestion(q, ['4, 5', '1, 2, dan 3']).isCorrect, true);
  assert.equal(bundle.evaluateAKMQuestion(q, ['1, 2, dan 3']).isCorrect, false);
});

test('calculateExamScore supports weighted SKEMA_PENILAIAN across present types', () => {
  assert.equal(typeof bundle.computeWeightedExamScores, 'function', 'computeWeightedExamScores must be exported');
  const qs = [
    { id_soal: '1', tipe_soal: 'PG', bobot: 10, kunci_jawaban: 'A' },
    { id_soal: '2', tipe_soal: 'PG', bobot: 10, kunci_jawaban: 'B' },
    { id_soal: '3', tipe_soal: 'URAIAN', bobot: 20 }
  ];
  // Custom scheme: PG 70%, URAIAN 30%
  const skema = { mode: 'custom', skema: { PG: 70, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 30 } };
  const res = bundle.computeWeightedExamScores(qs, { '1': 'A', '2': 'B' }, false, skema, 10);
  // 100% of PG (70) + 50% of URAIAN (10/20 * 30 = 15) = 85
  assert.equal(res.nilaiAuto, 70);
  assert.equal(res.nilaiUraianScaled, 15);
  assert.equal(res.totalNilai, 85);

  // PG-only exam with default scheme { PG: 20, ... } still scales present types to 100
  const pgOnly = [{ id_soal: '1', tipe_soal: 'PG', bobot: 10, kunci_jawaban: 'A' }];
  const defaultSkema = { mode: 'default', skema: { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 } };
  const pgRes = bundle.computeWeightedExamScores(pgOnly, { '1': 'A' }, false, defaultSkema, 0);
  assert.equal(pgRes.nilaiAuto, 100);
  assert.equal(pgRes.totalNilai, 100);
});

test('verifyNexaBundleChecksum succeeds regardless of object key insertion order', () => {
  const b = bundle.createNexaBundle({
    id_log: 'LOG-1',
    id_jadwal: 'J-1',
    id_siswa: 'S-1',
    nisn: '123',
    nama_siswa: 'Budi',
    npsn: '101',
    jawaban: { Q1: 'A' },
    pelanggaran: 0
  });
  const reordered = {
    checksum: b.checksum,
    jawaban: b.jawaban,
    timestamp: b.timestamp,
    pelanggaran: b.pelanggaran,
    npsn: b.npsn,
    nama_siswa: b.nama_siswa,
    nisn: b.nisn,
    id_siswa: b.id_siswa,
    id_jadwal: b.id_jadwal,
    id_log: b.id_log,
    version: b.version,
    magic: b.magic
  };
  assert.equal(bundle.verifyNexaBundleChecksum(reordered).valid, true);
});

test('cloneExamSchedule returns only valid public.jadwal columns', () => {
  const cloned = bundle.cloneExamSchedule({
    id_jadwal: 'J-1',
    npsn: '101',
    id_mapel: 'M-1',
    id_guru: 'G-1',
    durasi_menit: 90,
    waktu_mulai: '2026-11-15T01:00:00.000Z',
    waktu_selesai: '2026-11-15T02:30:00.000Z',
    nama_mapel: 'Matematika',
    guru: 'Pak Budi'
  }, 'X IPA 1', 'ABC123');

  assert.equal(cloned.durasi_menit, 90);
  assert.equal(cloned.token_aktif, 'ABC123');
  assert.equal('nama_mapel' in cloned, false);
  assert.equal('durasi' in cloned, false);
  assert.equal('guru' in cloned, false);
  assert.equal('token_ujian' in cloned, false);
  assert.equal('status_ujian' in cloned, false);
  assert.equal('is_cloned' in cloned, false);
  assert.equal('source_jadwal_id' in cloned, false);
});

test('getStatusBarColor supports super_admin theme color', () => {
  assert.equal(getStatusBarColor({ isDarkMode: false, isLoggedIn: false, role: 'super_admin' }), '#8b5cf6');
});

console.log(`\nSummary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
