import { createClient } from '@supabase/supabase-js';
import { fetchAPI, get_default_skema_sekolah } from '../src/api.js';

const SUPABASE_URL = 'https://cdcbarlyxjywltgrjgnr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY2Jhcmx5eGp5d2x0Z3JqZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTkwNTQsImV4cCI6MjEwMjg3NTA1NH0.Lze94l74sblAVNN4-IUtyQ_idr-aQCECxgPWTVAI5-c';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    failed++;
  }
}

async function runAdversarialReview() {
  console.log('================================================================');
  console.log('  ADVERSARIAL REVIEWER DEEP VERIFICATION & STRESS SUITE');
  console.log('================================================================\n');

  // PHASE 1: RE-VERIFY SANITIZATION REQUIREMENTS (R1)
  console.log('PHASE 1: RE-VERIFYING SANITIZATION CRITERIA (R1)...');
  
  // 1.1 log_ujian
  const { data: targetLog } = await supabase.from('log_ujian').select('*').eq('id_log', 'LOG-8elkh8wia');
  assert(!targetLog || targetLog.length === 0, 'Target record LOG-8elkh8wia is NOT present in log_ujian');

  const { data: allLogs } = await supabase.from('log_ujian').select('id_log, tanda_tangan');
  const syntheticSigs = (allLogs || []).filter(l => l.tanda_tangan && l.tanda_tangan.includes('AAAAAAAAAAAAAAAAAAAA'));
  assert(syntheticSigs.length === 0, 'No synthetic blank base64 signatures remain in log_ujian');
  assert((allLogs?.length || 0) === 0, 'log_ujian is completely sanitized (0 rows)');

  // 1.2 jadwal
  const { data: targetJadwal } = await supabase.from('jadwal').select('*').eq('id_jadwal', 'U-67AC6649');
  assert(!targetJadwal || targetJadwal.length === 0, 'Target test schedule U-67AC6649 is NOT present in jadwal');
  const { data: allJadwal } = await supabase.from('jadwal').select('*');
  assert((allJadwal?.length || 0) === 0, 'jadwal table is completely sanitized (0 active schedules)');

  // 1.3 audit_log & audit_log_archive
  const { data: resetSesiLogs } = await supabase.from('audit_log').select('*').eq('action', 'RESET_SESI');
  assert(!resetSesiLogs || resetSesiLogs.length === 0, 'No residual RESET_SESI audit records remain in audit_log');

  const { data: auditJadwal } = await supabase.from('audit_log').select('*').ilike('target', '%U-67AC6649%');
  assert(!auditJadwal || auditJadwal.length === 0, 'No target U-67AC6649 references remain in audit_log');

  const { data: arcJadwal } = await supabase.from('audit_log_archive').select('*').ilike('target', '%U-67AC6649%');
  assert(!arcJadwal || arcJadwal.length === 0, 'No target U-67AC6649 references remain in audit_log_archive');

  // 1.4 log_aktivitas_global
  const { data: globalLogs } = await supabase.from('log_aktivitas_global').select('*');
  const testGlobalLogs = (globalLogs || []).filter(g => {
    const d = (g.detail || '').toLowerCase();
    return d.includes('sekolah uji') || d.includes('challenger') || d.includes('e2e') || d.includes('test') || d.includes('chl');
  });
  assert(testGlobalLogs.length === 0, 'No test school cascade logs remain in log_aktivitas_global');
  assert((globalLogs?.length || 0) === 0, 'log_aktivitas_global is completely clean (0 rows)');

  // 1.5 Essential entities
  const { data: schools } = await supabase.from('sekolah').select('*').in('npsn', ['70040625', '40103445']);
  assert(schools?.length === 2, 'Essential schools 70040625 & 40103445 exist');
  assert(schools?.every(s => s.status === 'ACTIVE'), 'Both essential schools are ACTIVE');

  const { data: admins } = await supabase.from('admin').select('*');
  assert(admins?.some(a => a.username === 'admin01' && a.npsn === '70040625'), 'admin01 exists for SMA Nizamudin');
  assert(admins?.some(a => a.username === 'admin02' && a.npsn === '40103445'), 'admin02 exists for SMA N 1 Tutuyan');

  const { data: guru } = await supabase.from('guru').select('*').eq('username', 'ade_matematika');
  assert(guru?.length === 1 && guru[0].npsn === '70040625', 'Teacher ade_matematika is intact');

  const { data: siswa } = await supabase.from('siswa').select('*').eq('username', 'muhammad_xi merdeka_1');
  assert(siswa?.length === 1 && siswa[0].npsn === '70040625', 'Student muhammad_xi merdeka_1 is intact');
  assert(siswa[0].ruang === null, 'Student ruang is properly sanitized (null)');

  const { data: skema } = await supabase.from('soal_ujian').select('*').eq('id_soal', 'SKEMA_DEFAULT_70040625');
  assert(skema?.length === 1, 'Default scoring scheme SKEMA_DEFAULT_70040625 is intact');


  // PHASE 2: EMPTY STATE CONTRACT SAFETY IN FRONTEND API
  console.log('\nPHASE 2: TESTING API CONTRACTS ON CLEAN / EMPTY STATE...');
  
  // Test get_jadwal for student
  const resJadwalSiswa = await fetchAPI('get_jadwal', { id_siswa: siswa[0].id_siswa, npsn: '70040625' });
  assert(resJadwalSiswa.status === 'success' && Array.isArray(resJadwalSiswa.data), 'get_jadwal for student returns success with array');
  assert(resJadwalSiswa.data.length === 0, 'get_jadwal returns clean 0 schedules');

  // Test get_all_jadwal for admin
  const resJadwalAdmin = await fetchAPI('get_all_jadwal', { npsn: '70040625' });
  assert(resJadwalAdmin.status === 'success' && Array.isArray(resJadwalAdmin.data), 'get_all_jadwal for admin returns success with array');
  assert(resJadwalAdmin.data.length === 0, 'get_all_jadwal returns clean 0 schedules');

  // Test get_admin_dashboard_data
  const resDashAdmin = await fetchAPI('get_admin_dashboard_data', { npsn: '70040625' });
  assert(resDashAdmin.status === 'success' && resDashAdmin.data, 'get_admin_dashboard_data succeeds on sanitized state');
  assert(resDashAdmin.data.totalJadwal === 0, 'Dashboard reports totalJadwal = 0');

  // Test get_riwayat_ujian_siswa (BUG WAS HERE: order column fixed)
  const resRiwayat = await fetchAPI('get_riwayat_ujian_siswa', { id_siswa: siswa[0].id_siswa, npsn: '70040625' });
  assert(resRiwayat.status === 'success' && Array.isArray(resRiwayat.data) && resRiwayat.data.length === 0, 'get_riwayat_ujian_siswa returns empty array safely');

  // Test get_leaderboard
  const resLeaderboard = await fetchAPI('get_leaderboard', { npsn: '70040625' });
  assert(resLeaderboard.status === 'success' && Array.isArray(resLeaderboard.data), 'get_leaderboard returns array safely');

  // Test get_default_skema_sekolah
  const skemaResult = await get_default_skema_sekolah('70040625');
  assert(skemaResult && skemaResult.skema && skemaResult.skema.PG === 20, 'get_default_skema_sekolah returns valid default scheme');

  // Test get_guru_dashboard_data on empty state
  const resDashGuru = await fetchAPI('get_guru_dashboard_data', { id_guru: guru[0].id_guru, npsn: '70040625' });
  assert(resDashGuru.status === 'success' && resDashGuru.data, 'get_guru_dashboard_data succeeds on sanitized state');
  assert(resDashGuru.data.totalJadwal === 0 && resDashGuru.data.totalSelesai === 0, 'Guru dashboard reports 0 schedules and 0 completions');

  // Test get_bank_soal_admin on clean state
  const resBankSoal = await fetchAPI('get_bank_soal_admin', { npsn: '70040625' });
  assert(resBankSoal.status === 'success' && Array.isArray(resBankSoal.data), 'get_bank_soal_admin succeeds with array');
  assert(resBankSoal.data.length === 0, 'get_bank_soal_admin returns 0 questions (excludes SKEMA_DEFAULT)');

  // Test get_all_mapel
  const resMapel = await fetchAPI('get_all_mapel', { npsn: '70040625' });
  assert(resMapel.status === 'success' && Array.isArray(resMapel.data), 'get_all_mapel succeeds with array');
  assert(resMapel.data.length === 3, 'get_all_mapel returns 3 subjects for SMA Nizamudin');
  assert(resMapel.data.every(m => m.jumlah_soal === 0), 'All subjects report 0 questions on clean state');


  // PHASE 3: RESOLVING OPEN ISSUE 1 - SUPABASE REALTIME WEBSOCKET CHANNELS
  console.log('\nPHASE 3: RESOLVING OPEN ISSUE 1 - SUPABASE REALTIME WEBSOCKET CHANNELS...');
  
  let channelConnected = false;
  try {
    const channel = supabase.channel('reviewer-channel-test', {
      config: { broadcast: { self: true } }
    });

    await new Promise((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channelConnected = true;
          resolve();
        }
      });
      // Safety timeout of 5s
      setTimeout(resolve, 5000);
    });

    assert(channelConnected, 'Supabase Realtime WebSocket successfully connected and subscribed');
    await supabase.removeChannel(channel);
  } catch (err) {
    console.error('Realtime channel error:', err);
    assert(false, 'Supabase Realtime WebSocket connection error: ' + err.message);
  }


  // PHASE 4: RESOLVING OPEN ISSUE 2 - FRESH EXAM SCHEDULE INSERTION, LIFECYCLE & CLEANUP
  console.log('\nPHASE 4: RESOLVING OPEN ISSUE 2 - FRESH EXAM SCHEDULE INSERTION, LIFECYCLE & CLEANUP...');

  const testJadwalId = 'U-ADV' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const now = new Date();
  const startTime = new Date(now.getTime() - 60000).toISOString();
  const endTime = new Date(now.getTime() + 7200000).toISOString();

  try {
    // 1. Create a fresh schedule
    const { error: errCreate } = await supabase.from('jadwal').insert({
      id_jadwal: testJadwalId,
      id_mapel: 'M-7AE60E7B', // Matematika X
      id_guru: guru[0].id_guru,
      npsn: '70040625',
      waktu_mulai: startTime,
      waktu_selesai: endTime,
      durasi_menit: 90,
      acak_soal: true,
      target_kelas: 'X Merdeka 1, XI Merdeka 1',
      token_aktif: 'ADV999'
    });
    assert(!errCreate, `Fresh schedule ${testJadwalId} created successfully`);

    // 2. Verify schedule appears in get_jadwal
    const verifyJadwal = await fetchAPI('get_jadwal', { id_siswa: siswa[0].id_siswa, npsn: '70040625' });
    const foundJadwal = verifyJadwal.data?.find(j => j.id_jadwal === testJadwalId);
    assert(foundJadwal !== undefined, `Fresh schedule ${testJadwalId} visible to student`);
    
    // Evaluate status in the same way SiswaView evaluates it:
    const mulai = new Date(foundJadwal.waktu_mulai);
    const selesai = new Date(foundJadwal.waktu_selesai);
    const isAktif = now >= mulai && now <= selesai;
    assert(isAktif, `Schedule timeframe is correctly within active window [mulai <= now <= selesai]`);

    // 3. Test student starting the exam
    const startRes = await fetchAPI('mulai_ujian', {
      id_jadwal: testJadwalId,
      id_siswa: siswa[0].id_siswa,
      token: 'ADV999',
      npsn: '70040625'
    });
    assert(startRes.status === 'success', 'Student successfully begins exam session with token');

    // 4. Verify log_ujian row was created
    const { data: createdLog } = await supabase.from('log_ujian').select('*').eq('id_jadwal', testJadwalId);
    assert(createdLog && createdLog.length === 1, 'log_ujian record created for exam session');

    // 5. Test monitoring_ujian endpoint
    const monRes = await fetchAPI('monitoring_ujian', { id_jadwal: testJadwalId, npsn: '70040625' });
    assert(monRes.status === 'success' && monRes.data?.length === 1, 'monitoring_ujian endpoint tracks active exam participant');

    // 6. Test ending student exam session via submit_ujian
    const finishRes = await fetchAPI('submit_ujian', {
      id_log: createdLog[0].id_log,
      id_siswa: siswa[0].id_siswa,
      id_jadwal: testJadwalId,
      jawaban: [],
      npsn: '70040625'
    });
    assert(finishRes.status === 'success', 'Exam session finished successfully via submit_ujian');

    // 6b. Test get_guru_dashboard_data with active schedule & completed log (regression check for error 42703)
    const guruDashActive = await fetchAPI('get_guru_dashboard_data', { id_guru: guru[0].id_guru, npsn: '70040625' });
    assert(guruDashActive.status === 'success', 'get_guru_dashboard_data succeeds with completed exam log (no column 42703 error)');
    assert(guruDashActive.data?.totalJadwal === 1, 'Guru dashboard tracks 1 active schedule');
    assert(guruDashActive.data?.totalSelesai === 1, 'Guru dashboard tracks 1 completed student exam');

    // 7. Clean up: Delete test log, test session, and test schedule cleanly
    await supabase.from('jawaban_siswa').delete().eq('id_log', createdLog[0].id_log);
    await supabase.from('absensi_ujian').delete().eq('id_jadwal', testJadwalId);
    await supabase.from('pengawas_ruang').delete().eq('id_jadwal', testJadwalId);
    await supabase.from('berita_acara_ujian').delete().eq('id_jadwal', testJadwalId);
    await supabase.from('log_ujian').delete().eq('id_jadwal', testJadwalId);
    await supabase.from('audit_log').delete().ilike('target', `%${testJadwalId}%`);
    const { error: errCleanJadwal } = await supabase.from('jadwal').delete().eq('id_jadwal', testJadwalId);
    assert(!errCleanJadwal, `Fresh schedule ${testJadwalId} deleted cleanly during post-test cleanup`);

    // 8. Verify post-cleanup database state is pristine
    const { data: postLog } = await supabase.from('log_ujian').select('*');
    assert((postLog?.length || 0) === 0, 'Database log_ujian restored to completely clean state (0 rows)');

    const { data: postJadwal } = await supabase.from('jadwal').select('*');
    assert((postJadwal?.length || 0) === 0, 'Database jadwal restored to completely clean state (0 rows)');

  } catch (err) {
    console.error('Lifecycle test error:', err);
    assert(false, 'Lifecycle test failed: ' + err.message);
  }

  console.log('\n================================================================');
  console.log(`TOTAL ADVERSARIAL CHECKS: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAdversarialReview().catch(err => {
  console.error('Adversarial review fatal failure:', err);
  process.exit(1);
});
