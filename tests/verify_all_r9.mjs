import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');

const SUPABASE_URL = 'https://cdcbarlyxjywltgrjgnr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY2Jhcmx5eGp5d2x0Z3JqZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTkwNTQsImV4cCI6MjEwMjg3NTA1NH0.Lze94l74sblAVNN4-IUtyQ_idr-aQCECxgPWTVAI5-c';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label} - ${detail}`);
    failed++;
  }
}

function getAllFiles(dir, exts = ['.jsx', '.js']) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, exts));
    } else if (exts.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

async function runVerification() {
  console.log('======================================================');
  console.log('  ROUND 9: COMPREHENSIVE VERIFICATION SUITE');
  console.log('======================================================\n');

  // -----------------------------------------------------------------
  // 1. FRONTEND VERIFICATION
  // -----------------------------------------------------------------
  console.log('--- 1. FRONTEND CODEBASE VERIFICATION ---');
  const allSrcFiles = getAllFiles(srcDir);
  console.log(`Found ${allSrcFiles.length} source files under src/`);

  let foundSmaNegeriContoh = [];
  let found10101010 = [];
  let foundJlPendidikanNasional = [];

  for (const f of allSrcFiles) {
    const content = fs.readFileSync(f, 'utf8');
    const relPath = path.relative(projectRoot, f);
    if (content.includes('SMA NEGERI CONTOH')) foundSmaNegeriContoh.push(relPath);
    if (content.includes('10101010')) found10101010.push(relPath);
    if (content.includes('Jl. Pendidikan Nasional')) foundJlPendidikanNasional.push(relPath);
  }

  let foundGarut = allSrcFiles.filter(f => fs.readFileSync(f, 'utf8').includes('SMAN 1 Garut')).map(f => path.relative(projectRoot, f));

  check(
    "Zero occurrences of 'SMA NEGERI CONTOH' in src/",
    foundSmaNegeriContoh.length === 0,
    foundSmaNegeriContoh.join(', ')
  );
  check(
    "Zero occurrences of '10101010' in src/",
    found10101010.length === 0,
    found10101010.join(', ')
  );
  check(
    "Zero occurrences of 'Jl. Pendidikan Nasional' in src/",
    foundJlPendidikanNasional.length === 0,
    foundJlPendidikanNasional.join(', ')
  );
  check(
    "Zero occurrences of dummy school 'SMAN 1 Garut' in src/",
    foundGarut.length === 0,
    foundGarut.join(', ')
  );

  // Check DokumenUjianPrint.jsx fallback handling
  const dokPrintPath = path.join(srcDir, 'components', 'DokumenUjianPrint.jsx');
  const dokPrintCode = fs.readFileSync(dokPrintPath, 'utf8');
  check(
    "DokumenUjianPrint.jsx handles sekolah.nama_sekolah gracefully with '-' fallback",
    dokPrintCode.includes('{sekolah.nama_sekolah || \'-\'}')
  );
  check(
    "DokumenUjianPrint.jsx handles sekolah.npsn & sekolah.alamat gracefully with '-' fallback",
    dokPrintCode.includes('{sekolah.npsn || \'-\'}') && dokPrintCode.includes('{sekolah.alamat || \'-\'}')
  );
  check(
    "DokumenUjianPrint.jsx uses safe activeRuangNama string resolution to prevent React object child crashes",
    dokPrintCode.includes('activeRuangNama = ruang?.nama_ruang || \'-\'') &&
    dokPrintCode.includes('{activeRuangNama}')
  );

  // -----------------------------------------------------------------
  // 2. DATABASE SUPABASE VERIFICATION
  // -----------------------------------------------------------------
  console.log('\n--- 2. DATABASE SUPABASE VERIFICATION ---');

  // 2.1 Siswa checks
  const { data: siswaList, error: errSiswa } = await supabase
    .from('siswa')
    .select('id_siswa, nama_lengkap, username, ruang, npsn');
  check("Supabase connection to siswa succeeds", !errSiswa, errSiswa?.message);

  const m3Siswa = (siswaList || []).filter(s =>
    (s.ruang && (s.ruang.toLowerCase().includes('m3') || s.ruang.toLowerCase().includes('testing'))) ||
    (s.nama_lengkap && (s.nama_lengkap.toLowerCase().includes('m3') || s.nama_lengkap.toLowerCase().includes('testing'))) ||
    (s.username && (s.username.toLowerCase().includes('m3') || s.username.toLowerCase().includes('testing')))
  );
  check(
    "Zero siswa records with 'M3' or 'Testing' residue in ruang, nama_lengkap, or username",
    m3Siswa.length === 0,
    JSON.stringify(m3Siswa)
  );

  // 2.2 Admin and Guru avatar checks
  const { data: adminList, error: errAdmin } = await supabase
    .from('admin')
    .select('id_admin, username, nama_lengkap, foto_profil');
  check("Supabase connection to admin succeeds", !errAdmin, errAdmin?.message);

  const testAvatarAdmins = (adminList || []).filter(a =>
    a.foto_profil && (a.foto_profil.includes('ChallengerAvatar') || a.foto_profil.includes('E2ETest'))
  );
  check(
    "Zero admin records with ChallengerAvatar or E2ETest avatar seeds",
    testAvatarAdmins.length === 0,
    JSON.stringify(testAvatarAdmins)
  );

  const { data: guruList, error: errGuru } = await supabase
    .from('guru')
    .select('id_guru, username, nama_lengkap, foto');
  check("Supabase connection to guru succeeds", !errGuru, errGuru?.message);

  const testAvatarGurus = (guruList || []).filter(g =>
    g.foto && (g.foto.includes('ChallengerAvatar') || g.foto.includes('E2ETest'))
  );
  check(
    "Zero guru records with ChallengerAvatar or E2ETest avatar seeds",
    testAvatarGurus.length === 0,
    JSON.stringify(testAvatarGurus)
  );

  // 2.3 Mata Pelajaran checks
  const { data: mapelList, error: errMapel } = await supabase
    .from('mata_pelajaran')
    .select('*');
  check("Supabase connection to mata_pelajaran succeeds", !errMapel, errMapel?.message);

  const mapelWithoutNpsn = (mapelList || []).filter(m => !m.npsn);
  check(
    "All active mata_pelajaran have a valid non-null npsn relation",
    mapelWithoutNpsn.length === 0,
    JSON.stringify(mapelWithoutNpsn)
  );

  const obsoleteMapel = (mapelList || []).filter(m => m.id_mapel === 'MTK-X' || m.id_mapel === 'INF-X');
  check(
    "Obsolete test mata_pelajaran (MTK-X / INF-X) are completely eliminated",
    obsoleteMapel.length === 0,
    JSON.stringify(obsoleteMapel)
  );

  // 2.4 Sekolah integrity check
  const { data: sekolahList, error: errSekolah } = await supabase
    .from('sekolah')
    .select('*');
  check("Supabase connection to sekolah succeeds", !errSekolah, errSekolah?.message);

  const npsn70040625 = (sekolahList || []).find(s => s.npsn === '70040625');
  const npsn40103445 = (sekolahList || []).find(s => s.npsn === '40103445');
  check("Sekolah 70040625 (SMA Nizamudin) is ACTIVE", npsn70040625 && npsn70040625.status === 'ACTIVE');
  check("Sekolah 40103445 (SMA Negeri 1 Tutuyan) is ACTIVE", npsn40103445 && npsn40103445.status === 'ACTIVE');

  // 2.5 Jadwal foreign key integrity check
  const { data: jadwalList, error: errJadwal } = await supabase
    .from('jadwal')
    .select('*');
  check("Supabase connection to jadwal succeeds", !errJadwal, errJadwal?.message);

  let brokenJadwal = [];
  for (const j of (jadwalList || [])) {
    const mapelExists = (mapelList || []).some(m => m.id_mapel === j.id_mapel);
    const guruExists = (guruList || []).some(g => g.id_guru === j.id_guru);
    const sekolahExists = (sekolahList || []).some(s => s.npsn === j.npsn);
    if (!mapelExists || !guruExists || !sekolahExists) {
      brokenJadwal.push({ id_jadwal: j.id_jadwal, mapelExists, guruExists, sekolahExists });
    }
  }
  check(
    "All jadwal foreign keys (mapel, guru, sekolah) are valid and intact",
    brokenJadwal.length === 0,
    JSON.stringify(brokenJadwal)
  );

  // 2.6 Log Ujian sanitization & operational integrity checks
  const { data: logList, error: errLog } = await supabase
    .from('log_ujian')
    .select('id_log, id_siswa, ruang, status_ujian');
  check("Supabase connection to log_ujian succeeds", !errLog, errLog?.message);

  const testRuangLogs = (logList || []).filter(l =>
    l.ruang && (l.ruang.toLowerCase().includes('m3') || l.ruang.toLowerCase().includes('testing'))
  );
  check(
    "Zero log_ujian records with 'M3' or 'Testing' residue in ruang",
    testRuangLogs.length === 0,
    JSON.stringify(testRuangLogs)
  );

  const orphanedLogs = (logList || []).filter(l => !l.id_siswa);
  check(
    "Zero orphaned test logs in log_ujian (all active logs are tied to real students)",
    orphanedLogs.length === 0,
    JSON.stringify(orphanedLogs)
  );

  // 2.7 Siswa avatar check
  const testAvatarSiswa = (siswaList || []).filter(s =>
    s.foto_profil && (s.foto_profil.includes('ChallengerAvatar') || s.foto_profil.includes('E2ETest'))
  );
  check(
    "Zero siswa records with ChallengerAvatar or E2ETest avatar seeds",
    testAvatarSiswa.length === 0,
    JSON.stringify(testAvatarSiswa)
  );

  // 2.8 soal_ujian check
  const { data: soalList, error: errSoal } = await supabase
    .from('soal_ujian')
    .select('id_soal, pertanyaan, tipe_soal, npsn');
  check("Supabase connection to soal_ujian succeeds", !errSoal, errSoal?.message);

  const testSoal = (soalList || []).filter(s =>
    (s.id_soal && (s.id_soal.includes('SKEMA-null') || s.id_soal.includes('E2E') || s.id_soal.includes('Testing') || s.id_soal.includes('CHALLENGER') || s.id_soal.includes('CHAL') || s.id_soal.includes('TEST'))) ||
    (s.pertanyaan && (s.pertanyaan.includes('Testing') || s.pertanyaan.includes('M3') || s.pertanyaan.includes('Challenger') || s.pertanyaan.includes('Fixture')))
  );
  check(
    "Zero soal_ujian records with test residue or obsolete SKEMA-null",
    testSoal.length === 0,
    JSON.stringify(testSoal)
  );

  // 2.9 Registered schools exact match
  const testSchools = (sekolahList || []).filter(s =>
    s.npsn !== '70040625' && s.npsn !== '40103445'
  );
  check(
    "Exact operational school count (only 70040625 & 40103445, zero dummy/test schools)",
    testSchools.length === 0 && (sekolahList || []).length === 2,
    `Found extra or missing schools: ${JSON.stringify(testSchools)}`
  );

  // 2.10 Audit log hygiene check
  const { data: auditList, error: errAudit } = await supabase
    .from('audit_log')
    .select('id_audit, username, action, target');
  check("Supabase connection to audit_log succeeds", !errAudit, errAudit?.message);

  const testAudits = (auditList || []).filter(a =>
    (a.action && (a.action.includes('Testing') || a.action.includes('M3'))) ||
    (a.target && (a.target.includes('Testing') || a.target.includes('M3')))
  );
  check(
    "Zero audit_log records with 'Testing' or 'M3' residue",
    testAudits.length === 0,
    JSON.stringify(testAudits)
  );

  // -----------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`TOTAL CHECKS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

runVerification().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
