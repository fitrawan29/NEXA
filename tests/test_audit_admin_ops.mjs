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

test('api.js processJadwalData preserves token_aktif on BELUM MULAI schedules', () => {
  const fnStart = apiCode.indexOf('const processJadwalData = async');
  const fnBlock = apiCode.slice(fnStart, apiCode.indexOf('export const get_default_skema_sekolah', fnStart));
  assert.match(fnBlock, /else if \(currentStatus === 'SELESAI'\)/, 'must only auto-clear token_aktif when SELESAI, not BELUM MULAI');
});

test('api.js siswa & guru CRUD scope nisn/nip duplicates by npsn and bulk imports whitelist columns', () => {
  const createSiswa = apiCode.slice(apiCode.indexOf("case 'create_siswa':"), apiCode.indexOf("case 'create_siswa_bulk':"));
  const createSiswaBulk = apiCode.slice(apiCode.indexOf("case 'create_siswa_bulk':"), apiCode.indexOf("case 'update_siswa':"));
  const createGuru = apiCode.slice(apiCode.indexOf("case 'create_guru':"), apiCode.indexOf("case 'create_guru_bulk':"));
  const createGuruBulk = apiCode.slice(apiCode.indexOf("case 'create_guru_bulk':"), apiCode.indexOf("case 'update_guru':"));

  assert.match(createSiswa, /\.eq\('nisn'[\s\S]*?\.eq\('npsn'/, 'create_siswa nisn check must be scoped by npsn');
  assert.match(createGuru, /\.eq\('nip'[\s\S]*?\.eq\('npsn'/, 'create_guru nip check must be scoped by npsn');
  assert.doesNotMatch(createSiswaBulk, /\.insert\(payload\.map\(p => \(\{ \.\.\.p/, 'create_siswa_bulk must whitelist allowed siswa columns');
  assert.doesNotMatch(createGuruBulk, /const \{ mapel_ids, \.\.\.rest \} = g;[\s\S]*return \{ \.\.\.rest/, 'create_guru_bulk must whitelist allowed guru columns');
});

test('api.js mapel CRUD avoids dead alokasi_kelas insert & clone_jadwal scopes by npsn', () => {
  const mapelBlock = apiCode.slice(apiCode.indexOf("case 'create_mapel':"), apiCode.indexOf("case 'delete_mapel':"));
  const cloneBlock = apiCode.slice(apiCode.indexOf("case 'clone_jadwal':"), apiCode.indexOf("case 'delete_jadwal':"));
  assert.doesNotMatch(mapelBlock, /alokasi_kelas:\s*normalizeAlokasiInput/, 'mata_pelajaran has no alokasi_kelas column');
  assert.match(cloneBlock, /\.eq\('id_jadwal',\s*(?:payload\.)?id_jadwal(?:_sumber)?\)[\s\S]*?\.eq\('npsn'/, 'clone_jadwal source fetch must scope by npsn');
});

test('api.js get_cbt_backup_data filters log_ujian by id_jadwal and get_rekap_koreksi_admin computes schedule status', () => {
  const backupBlock = apiCode.slice(apiCode.indexOf("case 'get_cbt_backup_data':"), apiCode.indexOf("case 'restore_cbt_backup_data':"));
  const rekapBlock = apiCode.slice(apiCode.indexOf("case 'get_rekap_koreksi_admin':"), apiCode.indexOf("default:"));
  assert.doesNotMatch(backupBlock, /\.from\('log_ujian'\)\.select\('\*'\)\.eq\('npsn'/, 'log_ujian has no npsn column');
  assert.match(backupBlock, /\.in\('id_jadwal'/, 'backup must filter log_ujian via id_jadwal');
  assert.doesNotMatch(rekapBlock, /status_ujian:\s*j\.status_ujian/, 'jadwal table has no status_ujian column');
  assert.match(rekapBlock, /computeWeightedExamScores/, 'get_rekap_koreksi_admin must weight scores via computeWeightedExamScores');
  assert.match(adminCode, /Array\.isArray\(res\?\.data\)\s*\?\s*res\.data\.find/, 'AdminView get_sekolah must unwrap array response');
});

test('AdminView siswa payload omits sesi & sets kelas; jadwal validates range, uses toISOString & durasi_menit', () => {
  const saveStart = adminCode.indexOf('const handleSaveForm');
  const saveBlock = adminCode.slice(saveStart, adminCode.indexOf('const openCreateModal', saveStart));
  assert.doesNotMatch(saveBlock, /sesi:\s*formData\.sesi/, 'siswa table has no sesi column');
  assert.match(saveBlock, /payload\.kelas\s*=\s*`\$\{t\} \$\{p\}`\.trim\(\)/, 'siswa payload must populate kelas');
  assert.match(saveBlock, /durasi_menit/, 'jadwal payload must include durasi_menit');
  assert.match(saveBlock, /\.toISOString\(\)/, 'jadwal timestamps must convert to ISO UTC');
  assert.match(saveBlock, /selesaiDt\s*<=\s*mulaiDt|waktuSelesaiDt\s*<=\s*waktuMulaiDt/, 'jadwal must validate waktu_selesai > waktu_mulai');
});

test('AdminView fixes handleRilisToken, clone_jadwal token_aktif, pengumuman penulis, KartuUjianPrint clipping & kopSettings', () => {
  const tokStart = adminCode.indexOf('const handleRilisToken');
  const tokenBlock = adminCode.slice(tokStart, adminCode.indexOf('const handleToggleLockdown', tokStart));
  assert.doesNotMatch(tokenBlock, /\btoken:\s*newToken\b/, 'jadwal table has no token column');
  assert.match(adminCode, /res\.data\?\.token_aktif/, 'clone jadwal toast must read res.data?.token_aktif');
  assert.doesNotMatch(adminCode, /penulis:\s*user\?\.nama_lengkap|penulis:\s*user\.nama_lengkap/, 'pengumuman table has no penulis column');
  assert.match(adminCode, /handleSaveDefaultSkema[\s\S]*?else[\s\S]*?showMessage\(/, 'handleSaveDefaultSkema must show error toast on failure');
  assert.match(adminCode, /kopSettings\.nama_sekolah|get_sekolah/, 'print kartu must honor kopSettings / get_sekolah');
  const rootStart = adminCode.indexOf('className="h-[100dvh]');
  const kartuIdx = adminCode.indexOf('<KartuUjianPrint');
  assert.ok(kartuIdx > -1 && rootStart > -1 && kartuIdx < rootStart, 'KartuUjianPrint must render outside h-[100dvh] overflow-hidden wrapper');
});

console.log(`\nSummary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
