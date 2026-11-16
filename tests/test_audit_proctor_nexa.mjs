import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve(process.cwd(), 'src');
const apiCode = fs.readFileSync(path.join(srcDir, 'api.js'), 'utf8');
const adminCode = fs.readFileSync(path.join(srcDir, 'views/AdminView.jsx'), 'utf8');

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

test('api.js monitoring_ujian returns jawaban_count & total_soal excluding metadata', () => {
  const start = apiCode.indexOf("case 'monitoring_ujian':");
  const end = apiCode.indexOf("case 'get_siswa':", start);
  const block = apiCode.slice(start, end);
  assert.match(block, /jawaban_count/, 'monitoring_ujian must compute jawaban_count');
  assert.match(block, /total_soal/, 'monitoring_ujian must compute total_soal');
  assert.match(block, /SKEMA_PENILAIAN|NARASI/, 'total_soal must exclude metadata rows');
});

test('api.js catat_pelanggaran supports force_block and reset_sesi_siswa resets timestamps & scores', () => {
  const catatBlock = apiCode.slice(apiCode.indexOf("case 'catat_pelanggaran':"), apiCode.indexOf("case 'submit_ujian':"));
  const resetBlock = apiCode.slice(apiCode.indexOf("case 'reset_sesi_siswa':"), apiCode.indexOf("case 'get_kelas':"));
  assert.match(catatBlock, /force_block/, 'catat_pelanggaran must support admin force_block');
  assert.match(resetBlock, /waktu_login:\s*null/, 'reset_sesi_siswa should reset waktu_login');
  assert.match(resetBlock, /nilai_auto:\s*null|nilai_auto:\s*0/, 'reset_sesi_siswa should reset nilai_auto');
});

test('api.js buka_blokir supports fallback id_siswa + id_jadwal scoped by npsn', () => {
  const bukaBlock = apiCode.slice(apiCode.indexOf("case 'buka_blokir':"), apiCode.indexOf("case 'cat_pelanggaran':") > -1 ? apiCode.indexOf("case 'cat_pelanggaran':") : apiCode.indexOf("case 'catat_pelanggaran':"));
  assert.match(bukaBlock, /payload\.id_siswa\s*&&\s*payload\.id_jadwal|idSiswa\s*&&\s*idJadwal/, 'buka_blokir must fallback to id_siswa + id_jadwal');
});

test('api.js import_jawaban_offline uses explicit !currLog insert with valid log_ujian columns, parses s.opsi, uses weighted score & checks jawaban_siswa errors', () => {
  const start = apiCode.indexOf("case 'import_jawaban_offline':");
  const end = apiCode.indexOf("case 'get_cbt_backup_data':", start);
  const block = apiCode.slice(start, end);
  assert.match(block, /if \(!currLog\)/, 'must explicitly check !currLog for insert path');
  assert.doesNotMatch(block, /npsn:\s*effectiveNpsn|nisn:\s*bundle|waktu_mulai:\s*bundle/, 'must not insert non-existent log_ujian columns');
  assert.match(block, /JSON\.parse\(s\.opsi\)/, 'must parse JSON opsi string before scoring');
  assert.match(block, /computeWeightedExamScores/, 'must use computeWeightedExamScores');
  assert.match(block, /if \(insErr\) return \{ status: 'error'/, 'must fail loudly when jawaban_siswa insert fails');
});

test('AdminView monitoring poll uses lightweight refresh, displays progress, extracts id_log from .nexa filename & sends force_block', () => {
  assert.match(adminCode, /force_block:\s*true/, 'Admin Blokir button must send force_block: true');
  assert.match(adminCode, /jawaban_count/, 'Admin monitoring UI must display jawaban_count');
  assert.match(adminCode, /handleNexaFileSelected[\s\S]*?(?:LOG[-_][A-Za-z0-9_-]+|match\()/, 'handleNexaFileSelected should fallback-extract id_log from filename');
  assert.match(adminCode, /refreshMonitoringLogs[\s\S]{0,400}monitoring_ujian[\s\S]{0,400}setInterval\(\(\)\s*=>\s*refreshMonitoringLogs/, '15s monitoring poll should call lightweight refreshMonitoringLogs -> monitoring_ujian');
});

console.log(`\nSummary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
