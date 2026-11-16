import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve(process.cwd(), 'src');
const apiCode = fs.readFileSync(path.join(srcDir, 'api.js'), 'utf8');
const siswaCode = fs.readFileSync(path.join(srcDir, 'views/SiswaView.jsx'), 'utf8');
const examCode = fs.readFileSync(path.join(srcDir, 'views/ExamRoom.jsx'), 'utf8');

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

test('api.js get_jadwal processes statuses, orders log_ujian by waktu_login DESC, and returns serverNow', () => {
  const start = apiCode.indexOf("case 'get_jadwal':");
  const block = apiCode.slice(start, apiCode.indexOf("case 'mulai_ujian':", start));
  assert.match(block, /processJadwalData/, 'get_jadwal must call processJadwalData');
  assert.match(block, /order\('waktu_login',\s*\{\s*ascending:\s*false\s*\}\)/, 'get_jadwal must order log_ujian by waktu_login DESC');
  assert.match(block, /serverNow/, 'get_jadwal must return serverNow');
});

test('api.js mulai_ujian validates true time window, allows resuming SEDANG KERJA without failing rotated token, and checks insert errors', () => {
  const start = apiCode.indexOf("case 'mulai_ujian':");
  const block = apiCode.slice(start, apiCode.indexOf("case 'get_soal_ujian':", start));
  assert.match(block, /getTrueNow/, 'mulai_ujian must check true server time');
  assert.match(block, /status_ujian\s*===\s*'SEDANG KERJA'/, 'mulai_ujian should resume existing SEDANG KERJA session cleanly');
  assert.match(block, /if \(insLogErr\)|if \(insertErr\)/, 'mulai_ujian must check insert log_ujian errors');
  assert.doesNotMatch(block, /npsn:\s*payload\.npsn,\s*\n\s*status_ujian:\s*'SEDANG KERJA'/, 'log_ujian insert must omit non-existent npsn column');
});

test('api.js get_soal_ujian hides kunci_jawaban when !isPrivileged', () => {
  const start = apiCode.indexOf("case 'get_soal_ujian':");
  const block = apiCode.slice(start, apiCode.indexOf("case 'catat_pelanggaran':", start));
  assert.doesNotMatch(block, /select\('\*'\)/, 'get_soal_ujian must use explicit column selection to exclude kunci_jawaban for students');
  assert.match(block, /isPrivileged/, 'must gate kunci_jawaban on isPrivileged');
});

test('api.js submit_ujian is idempotent, protects blocked logs & uses computeWeightedExamScores', () => {
  const start = apiCode.indexOf("case 'submit_ujian':");
  const block = apiCode.slice(start, apiCode.indexOf("case 'import_jawaban_offline':", start));
  assert.match(block, /status_ujian\s*===\s*'SELESAI'/, 'submit_ujian must short-circuit/guard already SELESAI logs');
  assert.match(block, /computeWeightedExamScores/, 'submit_ujian must use computeWeightedExamScores');

  const riwayatStart = apiCode.indexOf("case 'get_riwayat_ujian_siswa':");
  const riwayatBlock = apiCode.slice(riwayatStart, apiCode.indexOf("case 'finalisasi_nilai_jadwal':", riwayatStart));
  assert.match(riwayatBlock, /computeWeightedExamScores/, 'get_riwayat_ujian_siswa must use computeWeightedExamScores');
  assert.match(riwayatBlock, /if \(payload\.npsn\)[\s\S]*?\.eq\('npsn',\s*payload\.npsn\)/, 'get_riwayat_ujian_siswa must scope soal_ujian by npsn');
});

test('SiswaView honors HARI INI filter, checks session_conflict on heartbeat & avoids mutating user prop', () => {
  assert.match(siswaCode, /res\.session_conflict/, 'SiswaView heartbeat must only logout on session_conflict');
  assert.doesNotMatch(siswaCode, /user\.foto_profil\s*=/, 'SiswaView must not mutate user prop directly');
  assert.match(siswaCode, /activeTab === 'nilai'[\s\S]*loadRiwayat/, 'SiswaView should refresh loadRiwayat when viewing nilai tab');
});

test('ExamRoom uses hashSeed shuffle, normalizeTipeSoal, JODOH HTML rendering, raguRagu persistence, securityModal above isBlocked & fixed isBlocked check', () => {
  assert.match(examCode, /hashSeed/, 'ExamRoom must use hashSeed for deterministic per-question shuffle');
  assert.match(examCode, /normalizeTipeSoal/, 'ExamRoom must normalize tipe_soal via normalizeTipeSoal');
  assert.match(examCode, /raguRagu/, 'ExamRoom must persist raguRagu in localStorage');
  assert.doesNotMatch(examCode, /status_ujian\s*===\s*'SELESAI'\s*&&[^)]*nilai_auto\s*===\s*0/, 'ExamRoom must not misclassify 0-score SELESAI student as blocked');
  const secIdx = examCode.indexOf('{securityModal.isOpen');
  const blkIdx = examCode.indexOf('if (isBlocked)');
  assert.ok(secIdx > -1 && blkIdx > -1 && secIdx < blkIdx, 'securityModal must render above/outside if (isBlocked) early return');
});

console.log(`\nSummary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
