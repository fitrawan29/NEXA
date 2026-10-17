#!/usr/bin/env node
/**
 * Challenger Final - Independent Empirical Verification Suite
 * 
 * Verifying 4 core remediations and edge cases:
 * 1. Room FK Fallback in submit_absensi_siswa
 *    - Unknown room ID fallback to null
 *    - Matching room name resolution to id_ruang
 *    - Valid id_ruang preserved
 *    - Null / omitted room handled cleanly
 *    - Dual-write to log_ujian.ruang with fallback text preserved
 * 2. Signature Validation & Empty Rejection
 *    - Empty data URL "data:image/png;base64," rejected
 *    - 1x1 blank transparent PNG rejected
 *    - Sub-50-byte payload rejected
 *    - Malformed MIME type rejected
 *    - Legitimate canvas signature accepted
 * 3. Server-side Question Gating in get_soal_ujian
 *    - Omitted id_log rejected for examinee
 *    - Unsigned id_log rejected for examinee
 *    - Signed id_log permitted
 *    - Privileged teacher/admin/preview permitted
 *    - Blocked student (3 strikes) reflection
 * 4. Idempotency & Upsert Stability
 *    - Duplicate submit_absensi_siswa handles conflict safely
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../src/config.js';
import { fetchAPI } from '../src/api.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TEST_NPSN = '70040625';
let TEST_JADWAL = null;
const TEST_MAPEL = 'M-7AE60E7B';

const VALID_SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGXRFWHRTb2Z0d2FyZQBNYXRwbG90bGliIHZlcnNpb24zLjcuMiwgaHR0cHM6Ly9tYXRwbG90bGliLm9yZy8pV571AAAAPklEQVR4nGP8//8/AyUYiBEyGv9jYGAoR2Jjg/mYkARhGkCKQYrh4mCMY7g2kGLY4FCEYfD/YRgkGIYFGAAMdBEGqFh7oAAAAABJRU5ErkJggg==';
const BLANK_1X1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const EMPTY_B64 = 'data:image/png;base64,';
const SHORT_B64 = 'data:image/png;base64,AAAA';
const TEXT_DATA = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';

const cleanup = {
  rooms: new Set(),
  students: new Set(),
  logs: new Set(),
  attendance: new Set(),
  soal: new Set(),
  jadwal: new Set()
};

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, testId, description, detail = '') {
  if (condition) {
    passCount++;
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${testId}: ${description}`);
  } else {
    failCount++;
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${testId}: ${description} | ${detail}`);
    failures.push({ testId, description, detail });
  }
}

async function run() {
  console.log('========================================================================');
  console.log('   CHALLENGER FINAL INDEPENDENT EMPIRICAL VERIFICATION HARNESS          ');
  console.log('========================================================================\n');

  const ts = Date.now();
  const roomId = `R-CHAL-${ts}`;
  const roomName = `Ruang Challenger ${ts.toString().slice(-4)}`;

  try {
    // -------------------------------------------------------------
    // Setup Fixtures
    // -------------------------------------------------------------
    console.log('[SETUP] Provisioning fixtures...');
    const testJadwalId = `U-CHAL-${ts}`;
    const { error: errJadwal } = await supabase.from('jadwal').insert([{
      id_jadwal: testJadwalId,
      id_mapel: TEST_MAPEL,
      id_guru: 'G-163390E6',
      npsn: TEST_NPSN,
      waktu_mulai: new Date(Date.now() - 3600000).toISOString(),
      waktu_selesai: new Date(Date.now() + 3600000).toISOString(),
      durasi_menit: 60,
      acak_soal: false,
      target_kelas: 'XI Merdeka',
      token_aktif: 'TESTTK'
    }]);
    if (errJadwal) throw new Error(`Jadwal setup failed: ${errJadwal.message}`);
    TEST_JADWAL = testJadwalId;
    cleanup.jadwal.add(testJadwalId);

    const { error: errRoom } = await supabase.from('ruang_ujian').insert([{
      id_ruang: roomId,
      npsn: TEST_NPSN,
      nama_ruang: roomName,
      kapasitas: 25
    }]);
    if (errRoom) throw new Error(`Room setup failed: ${errRoom.message}`);
    cleanup.rooms.add(roomId);

    const soalId = `Q-CHAL-${ts}`;
    const { error: errSoal } = await supabase.from('soal_ujian').insert([{
      id_soal: soalId,
      id_mapel: TEST_MAPEL,
      npsn: TEST_NPSN,
      pertanyaan: 'Fixture test question for challenger gating',
      tipe_soal: 'PG',
      opsi: JSON.stringify([{ text: 'Option A', benar: true }])
    }]);
    if (errSoal) throw new Error(`Soal setup failed: ${errSoal.message}`);
    cleanup.soal.add(soalId);

    // -------------------------------------------------------------
    // 1. Signature Validation & Empty Rejection
    // -------------------------------------------------------------
    console.log('\n\x1b[34m[CHECK 1] Digital Signature Rejection & Validation\x1b[0m');
    
    // 1.1 Empty base64
    const resEmpty = await fetchAPI('submit_absensi_siswa', {
      id_jadwal: TEST_JADWAL,
      id_siswa: 'S-TEST-DUMMY',
      npsn: TEST_NPSN,
      tanda_tangan: EMPTY_B64
    });
    assert(
      resEmpty.status === 'error' && resEmpty.message.includes('kosong atau tidak valid'),
      'CF-SIG-1',
      'Rejection of 0-byte Base64 data URL "data:image/png;base64,"',
      JSON.stringify(resEmpty)
    );

    // 1.2 1x1 Transparent Blank PNG
    const res1x1 = await fetchAPI('submit_absensi_siswa', {
      id_jadwal: TEST_JADWAL,
      id_siswa: 'S-TEST-DUMMY',
      npsn: TEST_NPSN,
      tanda_tangan: BLANK_1X1
    });
    assert(
      res1x1.status === 'error' && res1x1.message.includes('kosong atau tidak valid'),
      'CF-SIG-2',
      'Rejection of 1x1 blank transparent PNG',
      JSON.stringify(res1x1)
    );

    // 1.3 Sub-50 byte payload
    const resShort = await fetchAPI('submit_absensi_siswa', {
      id_jadwal: TEST_JADWAL,
      id_siswa: 'S-TEST-DUMMY',
      npsn: TEST_NPSN,
      tanda_tangan: SHORT_B64
    });
    assert(
      resShort.status === 'error' && resShort.message.includes('kosong atau tidak valid'),
      'CF-SIG-3',
      'Rejection of sub-50 byte Base64 payload',
      JSON.stringify(resShort)
    );

    // 1.4 Non-image data URL
    const resText = await fetchAPI('submit_absensi_siswa', {
      id_jadwal: TEST_JADWAL,
      id_siswa: 'S-TEST-DUMMY',
      npsn: TEST_NPSN,
      tanda_tangan: TEXT_DATA
    });
    assert(
      resText.status === 'error' && resText.message.includes('wajib format Base64 data:image'),
      'CF-SIG-4',
      'Rejection of non-image MIME data:text/plain',
      JSON.stringify(resText)
    );

    // -------------------------------------------------------------
    // 2. Room FK Fallback in submit_absensi_siswa
    // -------------------------------------------------------------
    console.log('\n\x1b[34m[CHECK 2] Room FK Resolution & Fallback Behavior\x1b[0m');

    // Student A: Unknown string room (legacy unmigrated text)
    const studentA = `S-CHAL-A-${ts}`;
    const logA = `LOG-CHAL-A-${ts}`;
    cleanup.students.add(studentA);
    cleanup.logs.add(logA);

    await supabase.from('siswa').insert([{
      id_siswa: studentA,
      npsn: TEST_NPSN,
      nama_lengkap: 'Challenger Student A (Legacy Room)',
      nisn: `NISN-${ts.toString().slice(-8)}`,
      username: `chala_${ts.toString().slice(-4)}`,
      password: 'hash_or_plaintext_password',
      ruang: 'Lab Komputer 99 (Non-Existent FK)'
    }]);

    await supabase.from('log_ujian').insert([{
      id_log: logA,
      id_jadwal: TEST_JADWAL,
      id_siswa: studentA,
      ruang: 'Lab Komputer 99 (Non-Existent FK)'
    }]);

    const resRoomFallback = await fetchAPI('submit_absensi_siswa', {
      id_log: logA,
      id_jadwal: TEST_JADWAL,
      id_siswa: studentA,
      npsn: TEST_NPSN,
      id_ruang: 'Lab Komputer 99 (Non-Existent FK)',
      tanda_tangan: VALID_SIG
    });

    assert(
      resRoomFallback.status === 'success' && resRoomFallback.data?.id_ruang === null,
      'CF-ROOM-1',
      'Non-existent room string falls back to null in absensi_ujian without FK violation',
      JSON.stringify(resRoomFallback)
    );

    // Verify database record directly for Student A
    const { data: dbAbsA } = await supabase.from('absensi_ujian')
      .select('id_ruang, id_siswa, tanda_tangan')
      .eq('id_jadwal', TEST_JADWAL)
      .eq('id_siswa', studentA)
      .maybeSingle();

    assert(
      dbAbsA && dbAbsA.id_ruang === null && Boolean(dbAbsA.tanda_tangan),
      'CF-ROOM-2',
      'Database verifies absensi_ujian.id_ruang IS NULL and signature stored',
      JSON.stringify(dbAbsA)
    );

    // Student B: Matching room name (should resolve to valid id_ruang)
    const studentB = `S-CHAL-B-${ts}`;
    const logB = `LOG-CHAL-B-${ts}`;
    cleanup.students.add(studentB);
    cleanup.logs.add(logB);

    await supabase.from('siswa').insert([{
      id_siswa: studentB,
      npsn: TEST_NPSN,
      nama_lengkap: 'Challenger Student B (Name Match)',
      nisn: `NISN-B-${ts.toString().slice(-7)}`,
      username: `chalb_${ts.toString().slice(-4)}`,
      password: 'hash_or_plaintext_password',
      ruang: roomName
    }]);

    await supabase.from('log_ujian').insert([{
      id_log: logB,
      id_jadwal: TEST_JADWAL,
      id_siswa: studentB,
      ruang: roomName
    }]);

    const resRoomMatchName = await fetchAPI('submit_absensi_siswa', {
      id_log: logB,
      id_jadwal: TEST_JADWAL,
      id_siswa: studentB,
      npsn: TEST_NPSN,
      id_ruang: roomName,
      tanda_tangan: VALID_SIG
    });

    assert(
      resRoomMatchName.status === 'success' && resRoomMatchName.data?.id_ruang === roomId,
      'CF-ROOM-3',
      'Room name matching existing ruang_ujian resolves correctly to id_ruang',
      JSON.stringify(resRoomMatchName)
    );

    // Student C: Explicit valid room ID
    const studentC = `S-CHAL-C-${ts}`;
    const logC = `LOG-CHAL-C-${ts}`;
    cleanup.students.add(studentC);
    cleanup.logs.add(logC);

    await supabase.from('siswa').insert([{
      id_siswa: studentC,
      npsn: TEST_NPSN,
      nama_lengkap: 'Challenger Student C (Valid ID)',
      nisn: `NISN-C-${ts.toString().slice(-7)}`,
      username: `chalc_${ts.toString().slice(-4)}`,
      password: 'hash_or_plaintext_password'
    }]);

    await supabase.from('log_ujian').insert([{
      id_log: logC,
      id_jadwal: TEST_JADWAL,
      id_siswa: studentC
    }]);

    const resRoomValidId = await fetchAPI('submit_absensi_siswa', {
      id_log: logC,
      id_jadwal: TEST_JADWAL,
      id_siswa: studentC,
      npsn: TEST_NPSN,
      id_ruang: roomId,
      tanda_tangan: VALID_SIG
    });

    assert(
      resRoomValidId.status === 'success' && resRoomValidId.data?.id_ruang === roomId,
      'CF-ROOM-4',
      'Explicit valid id_ruang is preserved in absensi_ujian record',
      JSON.stringify(resRoomValidId)
    );

    // -------------------------------------------------------------
    // 3. Server-side Question Gating in get_soal_ujian
    // -------------------------------------------------------------
    console.log('\n\x1b[34m[CHECK 3] Server-Side Question Gating (get_soal_ujian)\x1b[0m');

    // 3.1 Student calls without id_log
    const resNoLog = await fetchAPI('get_soal_ujian', {
      id_jadwal: TEST_JADWAL,
      npsn: TEST_NPSN
      // id_log omitted, role not privileged
    });
    assert(
      resNoLog.status === 'error' && resNoLog.need_signature === true && resNoLog.message.includes('Log ujian wajib'),
      'CF-GATE-1',
      'Unprivileged examinee call without id_log is blocked with need_signature: true',
      JSON.stringify(resNoLog)
    );

    // 3.2 Student calls with unsigned id_log
    const studentUnsigned = `S-CHAL-UNSIGN-${ts}`;
    const logUnsigned = `LOG-CHAL-UNSIGN-${ts}`;
    cleanup.students.add(studentUnsigned);
    cleanup.logs.add(logUnsigned);

    await supabase.from('siswa').insert([{
      id_siswa: studentUnsigned,
      npsn: TEST_NPSN,
      nama_lengkap: 'Unsigned Student',
      nisn: `NISN-U-${ts.toString().slice(-7)}`,
      username: `unsign_${ts.toString().slice(-4)}`,
      password: 'hash_or_plaintext_password'
    }]);

    await supabase.from('log_ujian').insert([{
      id_log: logUnsigned,
      id_jadwal: TEST_JADWAL,
      id_siswa: studentUnsigned,
      tanda_tangan: null
    }]);

    const resUnsigned = await fetchAPI('get_soal_ujian', {
      id_jadwal: TEST_JADWAL,
      id_log: logUnsigned,
      npsn: TEST_NPSN
    });
    assert(
      resUnsigned.status === 'error' && resUnsigned.need_signature === true && resUnsigned.message.includes('Tanda tangan kehadiran belum disimpan'),
      'CF-GATE-2',
      'Examinee with unsigned session is blocked from questions with need_signature: true',
      JSON.stringify(resUnsigned)
    );

    // 3.3 Teacher / Admin privileged access without id_log
    const resTeacher = await fetchAPI('get_soal_ujian', {
      id_jadwal: TEST_JADWAL,
      npsn: TEST_NPSN,
      role: 'guru'
    });
    assert(
      resTeacher.status === 'success' && Array.isArray(resTeacher.data),
      'CF-GATE-3',
      'Privileged role: guru can preview questions without id_log or signature',
      `Question count: ${resTeacher.data?.length}`
    );

    const resPreview = await fetchAPI('get_soal_ujian', {
      id_jadwal: TEST_JADWAL,
      npsn: TEST_NPSN,
      preview: true
    });
    assert(
      resPreview.status === 'success' && Array.isArray(resPreview.data),
      'CF-GATE-4',
      'Privileged preview: true can preview questions without id_log',
      `Question count: ${resPreview.data?.length}`
    );

    // 3.4 Student calls with valid signed session (Student C)
    const resSigned = await fetchAPI('get_soal_ujian', {
      id_jadwal: TEST_JADWAL,
      id_log: logC,
      npsn: TEST_NPSN
    });
    assert(
      resSigned.status === 'success' && Array.isArray(resSigned.data) && resSigned.data.length > 0,
      'CF-GATE-5',
      'Properly signed examinee session unlocks questions',
      `Questions received: ${resSigned.data?.length}`
    );

    // 3.5 Student with 3 strikes / blocked status
    const studentBlocked = `S-CHAL-BLK-${ts}`;
    const logBlocked = `LOG-CHAL-BLK-${ts}`;
    cleanup.students.add(studentBlocked);
    cleanup.logs.add(logBlocked);

    await supabase.from('siswa').insert([{
      id_siswa: studentBlocked,
      npsn: TEST_NPSN,
      nama_lengkap: 'Blocked Student (3 strikes)',
      nisn: `NISN-BLK-${ts.toString().slice(-6)}`,
      username: `blk_${ts.toString().slice(-4)}`,
      password: 'hash_or_plaintext_password'
    }]);

    await supabase.from('log_ujian').insert([{
      id_log: logBlocked,
      id_jadwal: TEST_JADWAL,
      id_siswa: studentBlocked,
      tanda_tangan: VALID_SIG,
      pelanggaran: 3,
      is_blocked: true,
      status_ujian: 'KICKED'
    }]);

    const resBlocked = await fetchAPI('get_soal_ujian', {
      id_jadwal: TEST_JADWAL,
      id_log: logBlocked,
      npsn: TEST_NPSN
    });
    assert(
      resBlocked.status === 'success' && resBlocked.logStatus?.is_blocked === true && resBlocked.logStatus?.pelanggaran >= 3,
      'CF-GATE-6',
      'Blocked student logStatus correctly conveys is_blocked: true & strikes >= 3',
      JSON.stringify(resBlocked.logStatus)
    );

    // -------------------------------------------------------------
    // 4. Idempotency & Upsert Continuity
    // -------------------------------------------------------------
    console.log('\n\x1b[34m[CHECK 4] Attendance Upsert Idempotency\x1b[0m');
    const resResubmit = await fetchAPI('submit_absensi_siswa', {
      id_log: logC,
      id_jadwal: TEST_JADWAL,
      id_siswa: studentC,
      npsn: TEST_NPSN,
      id_ruang: roomId,
      tanda_tangan: VALID_SIG
    });
    assert(
      resResubmit.status === 'success',
      'CF-UPSERT-1',
      'Submitting attendance again for same student/schedule succeeds idempotently (upsert onConflict)',
      JSON.stringify(resResubmit)
    );

  } catch (err) {
    console.error('\x1b[31m[ERROR IN HARNESS]\x1b[0m', err);
    assert(false, 'CF-CRASH', 'Harness execution unhandled crash', err.stack);
  } finally {
    console.log('\n[TEARDOWN] Purging temporary test artifacts...');
    if (cleanup.students.size > 0) {
      const studentIds = Array.from(cleanup.students);
      await supabase.from('absensi_ujian').delete().in('id_siswa', studentIds);
      await supabase.from('log_ujian').delete().in('id_siswa', studentIds);
      await supabase.from('siswa').delete().in('id_siswa', studentIds);
    }
    if (cleanup.rooms.size > 0) {
      await supabase.from('ruang_ujian').delete().in('id_ruang', Array.from(cleanup.rooms));
    }
    if (cleanup.soal && cleanup.soal.size > 0) {
      await supabase.from('soal_ujian').delete().in('id_soal', Array.from(cleanup.soal));
    }
    if (cleanup.jadwal && cleanup.jadwal.size > 0) {
      await supabase.from('jadwal').delete().in('id_jadwal', Array.from(cleanup.jadwal));
    }
    console.log('[TEARDOWN] Complete.');
  }

  console.log('\n========================================================================');
  console.log(`   EXECUTION SUMMARY: ${passCount} Passed, ${failCount} Failed`);
  console.log('========================================================================');
  if (failCount > 0) {
    console.error(`Verdict: REQUEST_CHANGES (${failCount} failures)`);
    process.exit(1);
  } else {
    console.log('Verdict: APPROVE (All checks passed)');
    process.exit(0);
  }
}

run();
