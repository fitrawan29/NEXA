import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cdcbarlyxjywltgrjgnr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY2Jhcmx5eGp5d2x0Z3JqZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTkwNTQsImV4cCI6MjEwMjg3NTA1NH0.Lze94l74sblAVNN4-IUtyQ_idr-aQCECxgPWTVAI5-c';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let failedChecks = 0;
let passedChecks = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passedChecks++;
  } else {
    console.error(`[FAIL] ${message}`);
    failedChecks++;
  }
}

async function runVerification() {
  console.log('====================================================');
  console.log('   VERIFIKASI INTEGRITAS DAN KEBERSIHAN DATABASE');
  console.log('====================================================\n');

  // 1. Verifikasi log_ujian
  console.log('--- 1. Verifikasi Tabel log_ujian ---');
  const { data: logResidu, error: errLog } = await supabase
    .from('log_ujian')
    .select('*')
    .eq('id_log', 'LOG-8elkh8wia');
  assert(!errLog, `Query log_ujian error-free (status: ${errLog ? errLog.message : 'OK'})`);
  assert(logResidu && logResidu.length === 0, 'Record LOG-8elkh8wia tidak lagi ditemukan di tabel log_ujian');

  const { data: allLogs } = await supabase.from('log_ujian').select('id_log, tanda_tangan');
  const blankSignatures = (allLogs || []).filter(l => l.tanda_tangan && l.tanda_tangan.includes('AAAAAAAAAAAAAAAAAAAA'));
  assert(blankSignatures.length === 0, 'Tidak ada tanda tangan sintetis blank base64 di log_ujian');
  console.log(`  -> Total log_ujian tersisa: ${allLogs?.length || 0}`);

  // 2. Verifikasi log_aktivitas_global
  console.log('\n--- 2. Verifikasi Tabel log_aktivitas_global ---');
  const { data: globalLogs, error: errGlobal } = await supabase
    .from('log_aktivitas_global')
    .select('*');
  assert(!errGlobal, `Query log_aktivitas_global error-free (status: ${errGlobal ? errGlobal.message : 'OK'})`);
  
  const testSchoolLogs = (globalLogs || []).filter(g => {
    const d = (g.detail || '').toLowerCase();
    return d.includes('sekolah uji') || d.includes('challenger') || d.includes('e2e') || d.includes('test') || d.includes('chl');
  });
  assert(testSchoolLogs.length === 0, 'Entri residu tes sekolah uji di tabel log_aktivitas_global terhapus bersih (count: 0)');
  console.log(`  -> Total entri log_aktivitas_global tersisa: ${globalLogs?.length || 0}`);

  // 3. Verifikasi audit_log & audit_log_archive
  console.log('\n--- 3. Verifikasi Tabel audit_log ---');
  const { data: resetLogs, error: errReset } = await supabase
    .from('audit_log')
    .select('*')
    .eq('action', 'RESET_SESI');
  assert(!errReset, `Query audit_log error-free (status: ${errReset ? errReset.message : 'OK'})`);
  assert(resetLogs && resetLogs.length === 0, 'Entri residu RESET_SESI di tabel audit_log terhapus bersih (count: 0)');

  const { data: jadwalAuditLogs } = await supabase
    .from('audit_log')
    .select('*')
    .ilike('target', '%U-67AC6649%');
  assert(jadwalAuditLogs && jadwalAuditLogs.length === 0, 'Entri audit_log terkait jadwal testing U-67AC6649 terhapus bersih (count: 0)');

  const { data: arcLogs } = await supabase
    .from('audit_log_archive')
    .select('*')
    .ilike('target', '%U-67AC6649%');
  assert(arcLogs && arcLogs.length === 0, 'Entri audit_log_archive terkait jadwal testing U-67AC6649 terhapus bersih (count: 0)');

  // 4. Verifikasi jadwal
  console.log('\n--- 4. Verifikasi Tabel jadwal ---');
  const { data: jadwalTarget, error: errJadwal } = await supabase
    .from('jadwal')
    .select('*')
    .eq('id_jadwal', 'U-67AC6649');
  assert(!errJadwal, `Query jadwal error-free (status: ${errJadwal ? errJadwal.message : 'OK'})`);
  assert(jadwalTarget && jadwalTarget.length === 0, 'Jadwal kedaluwarsa testing U-67AC6649 terhapus/direset dari tabel jadwal');

  const { data: allJadwal } = await supabase.from('jadwal').select('*');
  console.log(`  -> Total jadwal aktif/tersisa: ${allJadwal?.length || 0}`);

  // 5. Verifikasi Keutuhan Data Esensial & Integritas Referensial
  console.log('\n--- 5. Verifikasi Data Esensial & Integritas Referensial ---');
  // Sekolah
  const { data: schools } = await supabase.from('sekolah').select('*').in('npsn', ['70040625', '40103445']);
  assert(schools && schools.length === 2, 'Dua sekolah esensial (70040625 SMA Nizamudin & 40103445 SMA Negeri 1 Tutuyan) utuh');
  const nizamudin = schools?.find(s => s.npsn === '70040625');
  const tutuyan = schools?.find(s => s.npsn === '40103445');
  assert(nizamudin?.status === 'ACTIVE', 'SMA Nizamudin berstatus ACTIVE');
  assert(tutuyan?.status === 'ACTIVE', 'SMA Negeri 1 Tutuyan berstatus ACTIVE');

  // Admin
  const { data: admins } = await supabase.from('admin').select('*');
  const admin01 = admins?.find(a => a.username === 'admin01');
  const admin02 = admins?.find(a => a.username === 'admin02');
  assert(admin01 && admin01.npsn === '70040625', 'Akun admin01 untuk SMA Nizamudin utuh');
  assert(admin02 && admin02.npsn === '40103445', 'Akun admin02 untuk SMA Negeri 1 Tutuyan utuh');

  // Guru
  const { data: gurus } = await supabase.from('guru').select('*');
  const adeGuru = gurus?.find(g => g.username === 'ade_matematika');
  assert(adeGuru && adeGuru.npsn === '70040625', 'Akun guru ade_matematika untuk SMA Nizamudin utuh');

  // Kelas
  const { data: kelas } = await supabase.from('kelas').select('*').eq('npsn', '70040625');
  assert(kelas && kelas.length >= 3, `Data kelas SMA Nizamudin utuh (count: ${kelas?.length})`);

  // Siswa
  const { data: siswa } = await supabase.from('siswa').select('*').eq('npsn', '70040625');
  assert(siswa && siswa.length >= 1, `Data siswa SMA Nizamudin utuh (count: ${siswa?.length})`);

  // Mata Pelajaran
  const { data: mapel } = await supabase.from('mata_pelajaran').select('*').eq('npsn', '70040625');
  assert(mapel && mapel.length >= 3, `Data mata pelajaran SMA Nizamudin utuh (count: ${mapel?.length})`);

  // Skema Penilaian Default
  const { data: skema } = await supabase.from('soal_ujian').select('*').eq('id_soal', 'SKEMA_DEFAULT_70040625');
  assert(skema && skema.length === 1, 'Konfigurasi skema penilaian default SKEMA_DEFAULT_70040625 utuh');
  if (skema && skema.length === 1) {
    let parsedKunci = null;
    try {
      parsedKunci = JSON.parse(skema[0].kunci_jawaban);
    } catch (e) {}
    assert(parsedKunci && parsedKunci.skema && parsedKunci.skema.PG === 20, 'Format JSON skema penilaian default valid');
  }

  // 6. Verifikasi Kompatibilitas Frontend Terhadap Tabel Bersih/Kosong
  console.log('\n--- 6. Verifikasi Respons Query Frontend pada State Bersih ---');
  // Simulasi query yang dipanggil komponen AdminView, GuruView, SiswaView
  // A. Jadwal query (Siswa & Admin)
  const { data: qJadwal, error: errQJadwal } = await supabase
    .from('jadwal')
    .select('id_jadwal, id_mapel, id_guru, durasi_menit, acak_soal, target_kelas')
    .eq('npsn', '70040625');
  assert(!errQJadwal && Array.isArray(qJadwal), 'Query jadwal untuk siswa/admin mengembalikan array kosong tanpa error');

  // B. Monitoring / Log Ujian query
  const { data: qLog, error: errQLog } = await supabase
    .from('log_ujian')
    .select('*')
    .eq('id_jadwal', 'NON_EXISTENT_OR_CLEANED');
  assert(!errQLog && Array.isArray(qLog) && qLog.length === 0, 'Query log_ujian saat kosong mengembalikan array kosong tanpa error');

  // C. Absensi pengawas / siswa query
  const { data: qAbsensi, error: errQAbsensi } = await supabase
    .from('absensi_ujian')
    .select('*')
    .eq('npsn', '70040625');
  assert(!errQAbsensi && Array.isArray(qAbsensi) && qAbsensi.length === 0, 'Query absensi saat kosong mengembalikan array kosong tanpa error');

  // D. Audit log query (Admin view)
  const { data: qAudit, error: errQAudit } = await supabase
    .from('audit_log')
    .select('*')
    .eq('npsn', '70040625');
  assert(!errQAudit && Array.isArray(qAudit), 'Query audit_log tetap valid dan stabil');

  console.log('\n====================================================');
  console.log(`HASIL VERIFIKASI: ${passedChecks} PASS, ${failedChecks} FAIL`);
  console.log('====================================================');

  if (failedChecks > 0) {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('\n[FATAL ERROR] Verifikasi gagal:', err);
  process.exit(1);
});
