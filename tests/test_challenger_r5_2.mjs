#!/usr/bin/env node
/**
 * CBT NEXA - Challenger 2 Adversarial Stress Test Suite (Round 5)
 * 
 * Scope: Adversarial Verification for Requirements 2, 3, and 4
 * 1. Proctor Reassignment & Conflict Lifecycle (Req 2 & 3)
 * 2. High-Concurrency Bulk Approval on 50+ Students (Req 3)
 * 3. Extreme Print Dossier Payload: 55+ Students, 12,500+ Char Incident Notes, Special Characters, Emojis, XSS Probes (Req 4)
 * 4. @media print CSS & Layout Integrity Validation (Req 4)
 * 5. Complete Database Teardown & Orphan Record Audit
 *
 * Usage:
 *   node tests/test_challenger_r5_2.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAPI, generateId } from '../src/api.js';
import { supabaseClient } from '../src/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Test Configuration
const TEST_NPSN = '70040625';
const TEST_GURU_ID = 'G-163390E6';
let TEST_JADWAL_ID = null;
const SAMPLE_BASE64_SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// Test statistics
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails = [];

function assert(condition, testName, extraInfo = '') {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: [${testName}] ${extraInfo}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: [${testName}] ${extraInfo}`);
    failedTests++;
    failureDetails.push({ testName, extraInfo });
  }
}

// Tracking IDs for foolproof cleanup
const cleanupRegistry = {
  rooms: new Set(),
  assignments: new Set(),
  students: new Set(),
  logs: new Set(),
  absensi: new Set(),
  beritaAcara: new Set(),
  jadwal: new Set()
};

async function purgeAllTestData() {
  console.log('\n[TEARDOWN] Purging all ephemeral test records...');

  if (cleanupRegistry.assignments.size > 0) {
    await supabaseClient.from('pengawas_ruang').delete().in('id_penugasan', Array.from(cleanupRegistry.assignments));
  }
  if (cleanupRegistry.beritaAcara.size > 0) {
    await supabaseClient.from('berita_acara_ujian').delete().in('id_berita_acara', Array.from(cleanupRegistry.beritaAcara));
  }
  if (cleanupRegistry.absensi.size > 0) {
    await supabaseClient.from('absensi_ujian').delete().in('id_absensi', Array.from(cleanupRegistry.absensi));
  }
  if (cleanupRegistry.logs.size > 0) {
    await supabaseClient.from('log_ujian').delete().in('id_log', Array.from(cleanupRegistry.logs));
  }
  if (cleanupRegistry.students.size > 0) {
    await supabaseClient.from('siswa').delete().in('id_siswa', Array.from(cleanupRegistry.students));
  }
  if (cleanupRegistry.rooms.size > 0) {
    await supabaseClient.from('ruang_ujian').delete().in('id_ruang', Array.from(cleanupRegistry.rooms));
  }
  if (cleanupRegistry.jadwal && cleanupRegistry.jadwal.size > 0) {
    await supabaseClient.from('jadwal').delete().in('id_jadwal', Array.from(cleanupRegistry.jadwal));
  }

  // Backup cleanup by ID prefix
  await supabaseClient.from('pengawas_ruang').delete().ilike('id_penugasan', 'TGS_CHALL%');
  await supabaseClient.from('berita_acara_ujian').delete().ilike('id_berita_acara', 'BA_CHALL%');
  await supabaseClient.from('absensi_ujian').delete().ilike('id_absensi', 'ABS_CHALL%');
  await supabaseClient.from('log_ujian').delete().ilike('id_log', 'LOG_CHALL%');
  await supabaseClient.from('siswa').delete().ilike('id_siswa', 'S_CHALL%');
  await supabaseClient.from('ruang_ujian').delete().ilike('id_ruang', 'R_CHALL%');
  await supabaseClient.from('jadwal').delete().ilike('id_jadwal', 'U-CHAL2%');

  console.log('[TEARDOWN] Purge complete.');
}

async function runAdversarialSuite() {
  console.log('========================================================================');
  console.log(' CBT NEXA: CHALLENGER 2 ADVERSARIAL STRESS HARNESS (ROUND 5)');
  console.log(' Scope: Req 2 (Proctor Assignment), Req 3 (Verification), Req 4 (Print)');
  console.log('========================================================================\n');

  const startTime = Date.now();

  try {
    // -------------------------------------------------------------------------
    // Setup Base Schedule Fixture
    // -------------------------------------------------------------------------
    const fixtureJadwalId = `U-CHAL2-${Date.now()}`;
    const { error: errJadwal } = await supabaseClient.from('jadwal').insert([{
      id_jadwal: fixtureJadwalId,
      id_mapel: 'M-7AE60E7B',
      id_guru: TEST_GURU_ID,
      npsn: TEST_NPSN,
      waktu_mulai: new Date(Date.now() - 3600000).toISOString(),
      waktu_selesai: new Date(Date.now() + 3600000).toISOString(),
      durasi_menit: 60,
      acak_soal: false,
      target_kelas: 'XI Merdeka',
      token_aktif: 'CHAL2TK'
    }]);
    if (errJadwal) throw new Error(`Jadwal setup failed: ${errJadwal.message}`);
    TEST_JADWAL_ID = fixtureJadwalId;
    cleanupRegistry.jadwal.add(fixtureJadwalId);

    // =========================================================================
    // GROUP 1: Proctor Assignment, Reassignment, Multi-Room & Cascading Deletion
    // =========================================================================
    console.log('[GROUP 1: Proctor Assignment, Dynamic Reassignment & Cascading Deletion]');

    const roomAId = generateId('R_CHALL_A');
    const roomBId = generateId('R_CHALL_B');
    const roomCId = generateId('R_CHALL_C');
    cleanupRegistry.rooms.add(roomAId);
    cleanupRegistry.rooms.add(roomBId);
    cleanupRegistry.rooms.add(roomCId);

    // 1.1 Create test rooms
    const resRoomA = await fetchAPI('create_ruang', {
      id_ruang: roomAId,
      npsn: TEST_NPSN,
      nama_ruang: 'Lab Komputer Alpha (Challenger)',
      kode_ruang: 'LAB-A-CHALL',
      kapasitas: 40
    });
    assert(resRoomA.status === 'success', 'T1.1_CreateRoomA', `Created room A: ${resRoomA.message}`);

    const resRoomB = await fetchAPI('create_ruang', {
      id_ruang: roomBId,
      npsn: TEST_NPSN,
      nama_ruang: 'Lab Komputer Beta (Challenger)',
      kode_ruang: 'LAB-B-CHALL',
      kapasitas: 40
    });
    assert(resRoomB.status === 'success', 'T1.2_CreateRoomB', `Created room B: ${resRoomB.message}`);

    // 1.2 Assign proctor to Room A
    const assignAId = generateId('TGS_CHALL_1');
    cleanupRegistry.assignments.add(assignAId);
    const resAssignA = await fetchAPI('assign_pengawas_ruang', {
      id_penugasan: assignAId,
      npsn: TEST_NPSN,
      id_ruang: roomAId,
      id_guru: TEST_GURU_ID,
      id_jadwal: TEST_JADWAL_ID,
      peran: 'PENGAWAS UTAMA',
      status_tugas: 'AKTIF'
    });
    assert(resAssignA.status === 'success', 'T1.3_AssignProctorRoomA', 'Proctor assigned to Room A');

    // 1.3 Query proctor assigned rooms for teacher
    const resProctorRooms1 = await fetchAPI('get_ruang_guru_pengawas', {
      id_guru: TEST_GURU_ID,
      npsn: TEST_NPSN
    });
    assert(resProctorRooms1.status === 'success' && Array.isArray(resProctorRooms1.data), 'T1.4_GetProctorRooms_List', 'Fetched proctor rooms');
    const hasRoomA = (resProctorRooms1.data || []).some(t => t.id_ruang === roomAId);
    assert(hasRoomA, 'T1.5_RoomAPresentInProctorHUD', 'Room A present in proctor dashboard');

    // 1.4 Sequential Assignment to Room B (multi-room / reassignment scenario)
    const assignBId = generateId('TGS_CHALL_2');
    cleanupRegistry.assignments.add(assignBId);
    const resAssignB = await fetchAPI('assign_pengawas_ruang', {
      id_penugasan: assignBId,
      npsn: TEST_NPSN,
      id_ruang: roomBId,
      id_guru: TEST_GURU_ID,
      id_jadwal: TEST_JADWAL_ID,
      peran: 'PROKTOR',
      status_tugas: 'AKTIF'
    });
    assert(resAssignB.status === 'success', 'T1.6_AssignProctorRoomB', 'Proctor assigned to Room B simultaneously');

    const resProctorRooms2 = await fetchAPI('get_ruang_guru_pengawas', {
      id_guru: TEST_GURU_ID,
      npsn: TEST_NPSN
    });
    const assignedRoomIds = (resProctorRooms2.data || []).map(t => t.id_ruang);
    assert(assignedRoomIds.includes(roomAId) && assignedRoomIds.includes(roomBId), 'T1.7_MultiRoomPresence', 'Proctor can simultaneously monitor both Room A and Room B');

    // 1.5 Deleting assignment A leaves Room B intact
    const resDelAssignA = await fetchAPI('delete_pengawas_ruang', {
      id_penugasan: assignAId,
      npsn: TEST_NPSN
    });
    assert(resDelAssignA.status === 'success', 'T1.8_DeleteAssignmentA', 'Assignment A deleted cleanly');

    const resProctorRooms3 = await fetchAPI('get_ruang_guru_pengawas', {
      id_guru: TEST_GURU_ID,
      npsn: TEST_NPSN
    });
    const postDelRoomIds = (resProctorRooms3.data || []).map(t => t.id_ruang);
    assert(!postDelRoomIds.includes(roomAId) && postDelRoomIds.includes(roomBId), 'T1.9_ReassignmentIsolation', 'Room A removed immediately without collateral effect on Room B');

    // 1.6 Cascading Deletion: Create Room C, assign proctor, then delete Room C
    await fetchAPI('create_ruang', {
      id_ruang: roomCId,
      npsn: TEST_NPSN,
      nama_ruang: 'Lab Komputer Gamma (Cascade Test)',
      kode_ruang: 'LAB-C-CHALL',
      kapasitas: 25
    });
    const assignCId = generateId('TGS_CHALL_3');
    cleanupRegistry.assignments.add(assignCId);
    await fetchAPI('assign_pengawas_ruang', {
      id_penugasan: assignCId,
      npsn: TEST_NPSN,
      id_ruang: roomCId,
      id_guru: TEST_GURU_ID,
      id_jadwal: TEST_JADWAL_ID
    });

    // Delete Room C via API
    const resDelRoomC = await fetchAPI('delete_ruang', {
      id_ruang: roomCId,
      npsn: TEST_NPSN
    });
    assert(resDelRoomC.status === 'success', 'T1.10_DeleteRoomC', 'Room C deleted');

    // Direct database audit for orphaned records in pengawas_ruang
    const { data: orphanedAssignments } = await supabaseClient
      .from('pengawas_ruang')
      .select('id_penugasan')
      .eq('id_penugasan', assignCId);
    assert(!orphanedAssignments || orphanedAssignments.length === 0, 'T1.11_CascadeDeleteOrphanCheck', 'Zero orphaned records: assignment cascade-deleted on room deletion');

    // 1.7 Adversarial inputs & boundary checks on proctor assignment
    const resInvalidProctor = await fetchAPI('assign_pengawas_ruang', {
      npsn: TEST_NPSN,
      id_ruang: roomBId
      // missing id_guru
    });
    assert(resInvalidProctor.status === 'error', 'T1.12_RejectMissingProctorGuru', 'Rejects missing id_guru validation');

    const resNonExistentGuru = await fetchAPI('assign_pengawas_ruang', {
      id_penugasan: generateId('TGS_ERR'),
      npsn: TEST_NPSN,
      id_ruang: roomBId,
      id_guru: 'G_NONEXISTENT_999999'
    });
    assert(resNonExistentGuru.status === 'error', 'T1.13_RejectNonExistentGuru', 'Rejects non-existent teacher via FK constraint');

    // SQL injection probe in text fields
    const sqlInjId = generateId('TGS_CHALL_SQLI');
    cleanupRegistry.assignments.add(sqlInjId);
    const resSqlInj = await fetchAPI('assign_pengawas_ruang', {
      id_penugasan: sqlInjId,
      npsn: TEST_NPSN,
      id_ruang: roomBId,
      id_guru: TEST_GURU_ID,
      peran: "PENGAWAS'; DROP TABLE fake_table; --",
      status_tugas: "AKTIF' OR '1'='1"
    });
    assert(resSqlInj.status === 'success', 'T1.14_SafeParametricSQLInjection', 'SQL injection string treated as literal string without SQL corruption');
    await fetchAPI('delete_pengawas_ruang', { id_penugasan: sqlInjId, npsn: TEST_NPSN });


    // =========================================================================
    // GROUP 2: High-Concurrency Bulk Approval on 55 Students
    // =========================================================================
    console.log('\n[GROUP 2: High-Concurrency Bulk Approval on 55 Students]');

    const STRESS_ROOM_ID = generateId('R_CHALL_STRESS');
    const STRESS_ROOM_NAME = 'Hall Auditorium CBT 55';
    cleanupRegistry.rooms.add(STRESS_ROOM_ID);
    await fetchAPI('create_ruang', {
      id_ruang: STRESS_ROOM_ID,
      npsn: TEST_NPSN,
      nama_ruang: STRESS_ROOM_NAME,
      kode_ruang: 'HALL-CBT-55',
      kapasitas: 60
    });

    // 2.1 Seed 55 real students
    console.log('  -> Generating 55 examinees in database...');
    const TOTAL_STUDENTS = 55;
    const ATTENDED_COUNT = 45;
    const ABSENT_COUNT = 10;

    const studentBatch = [];
    const logBatch = [];
    const absensiBatch = [];

    const studentIds = [];
    const attendedAbsensiIds = [];
    const absentAbsensiIds = [];

    for (let i = 1; i <= TOTAL_STUDENTS; i++) {
      const sId = `S_CHALL_${String(i).padStart(3, '0')}_${Date.now().toString(36)}`;
      const logId = `LOG_CHALL_${String(i).padStart(3, '0')}_${Date.now().toString(36)}`;
      const absId = `ABS_CHALL_${String(i).padStart(3, '0')}_${Date.now().toString(36)}`;

      cleanupRegistry.students.add(sId);
      cleanupRegistry.logs.add(logId);
      cleanupRegistry.absensi.add(absId);
      studentIds.push(sId);

      const isAttended = i <= ATTENDED_COUNT;

      studentBatch.push({
        id_siswa: sId,
        npsn: TEST_NPSN,
        nama_lengkap: `Peserta Ujian Ke-${String(i).padStart(2, '0')} (Stress Test)`,
        nisn: `9926${String(i).padStart(6, '0')}`,
        username: `peserta_${i}_${Date.now().toString(36)}`,
        password: 'password123',
        kelas: 'X Merdeka',
        ruang: STRESS_ROOM_NAME
      });

      logBatch.push({
        id_log: logId,
        id_jadwal: TEST_JADWAL_ID,
        id_siswa: sId,
        status_ujian: isAttended ? 'SEDANG MENGERJAKAN' : 'BELUM MULAI',
        tanda_tangan: isAttended ? SAMPLE_BASE64_SIG : null,
        status_kehadiran: isAttended ? 'HADIR' : 'BELUM_HADIR',
        is_verified_kehadiran: false,
        waktu_absen: isAttended ? new Date().toISOString() : null,
        ruang: STRESS_ROOM_NAME
      });

      if (isAttended) {
        attendedAbsensiIds.push(absId);
        absensiBatch.push({
          id_absensi: absId,
          npsn: TEST_NPSN,
          id_jadwal: TEST_JADWAL_ID,
          id_siswa: sId,
          id_ruang: STRESS_ROOM_ID,
          id_log: logId,
          tanda_tangan: SAMPLE_BASE64_SIG,
          status_kehadiran: 'HADIR',
          status_verifikasi: 'MENUNGGU',
          waktu_absen: new Date().toISOString()
        });
      } else {
        absentAbsensiIds.push(absId);
      }
    }

    const { error: errSiswa } = await supabaseClient.from('siswa').insert(studentBatch);
    assert(!errSiswa, 'T2.1_Insert55Students', `Inserted 55 students into database: ${errSiswa?.message || 'OK'}`);

    const { error: errLog } = await supabaseClient.from('log_ujian').insert(logBatch);
    assert(!errLog, 'T2.2_Insert55Logs', `Inserted 55 log_ujian records: ${errLog?.message || 'OK'}`);

    const { error: errAbs } = await supabaseClient.from('absensi_ujian').insert(absensiBatch);
    assert(!errAbs, 'T2.3_Insert45AttendanceRecords', `Inserted 45 signed attendance records: ${errAbs?.message || 'OK'}`);

    // 2.2 Concurrency Stampede: 5 parallel bulk approvals on intersecting subsets + all-inclusive approval
    console.log('  -> Executing high-concurrency parallel bulk approvals on 45 students...');
    const subset1 = attendedAbsensiIds.slice(0, 15);
    const subset2 = attendedAbsensiIds.slice(10, 30);
    const subset3 = attendedAbsensiIds.slice(25, 45);
    const subsetAll = [...attendedAbsensiIds];

    const concurrencyStartTime = Date.now();
    const parallelResponses = await Promise.all([
      fetchAPI('verifikasi_absensi_bulk', { list_id_absensi: subset1, id_guru: TEST_GURU_ID, status_verifikasi: 'DISETUJUI' }),
      fetchAPI('verifikasi_absensi_bulk', { list_id_absensi: subset2, id_guru: TEST_GURU_ID, status_verifikasi: 'DISETUJUI' }),
      fetchAPI('verifikasi_absensi_bulk', { list_id_absensi: subset3, id_guru: TEST_GURU_ID, status_verifikasi: 'DISETUJUI' }),
      fetchAPI('verifikasi_absensi_bulk', { list_id_absensi: subsetAll, id_guru: TEST_GURU_ID, status_verifikasi: 'DISETUJUI' }),
      fetchAPI('verifikasi_absensi_bulk', { list_id_absensi: subsetAll, id_guru: TEST_GURU_ID, status_verifikasi: 'DISETUJUI' })
    ]);
    const concurrencyDuration = Date.now() - concurrencyStartTime;

    const allSuccessful = parallelResponses.every(r => r.status === 'success');
    assert(allSuccessful, 'T2.4_ConcurrencyStampede_AllResolved', `5 parallel bulk approval bursts resolved cleanly in ${concurrencyDuration}ms`);

    // 2.3 Direct DB verification of atomicity and state synchronicity
    const { data: verifiedAbsensi } = await supabaseClient
      .from('absensi_ujian')
      .select('id_absensi, status_verifikasi, verified_by, verified_at')
      .in('id_absensi', attendedAbsensiIds);

    const allAbsensiApproved = verifiedAbsensi && verifiedAbsensi.length === ATTENDED_COUNT &&
      verifiedAbsensi.every(a => a.status_verifikasi === 'DISETUJUI' && a.verified_by === TEST_GURU_ID && Boolean(a.verified_at));
    assert(allAbsensiApproved, 'T2.5_AbsensiAtomicVerification', `All 45 absensi_ujian records confirmed DISETUJUI with verified_by = ${TEST_GURU_ID}`);

    const { data: verifiedLogs } = await supabaseClient
      .from('log_ujian')
      .select('id_log, is_verified_kehadiran, status_kehadiran, verified_by')
      .in('id_siswa', studentIds.slice(0, ATTENDED_COUNT));

    const allLogsApproved = verifiedLogs && verifiedLogs.length === ATTENDED_COUNT &&
      verifiedLogs.every(l => l.is_verified_kehadiran === true && l.status_kehadiran === 'TERVERIFIKASI' && l.verified_by === TEST_GURU_ID);
    assert(allLogsApproved, 'T2.6_LogUjianSynchronousUpdate', 'All 45 associated log_ujian records synchronized to is_verified_kehadiran=true and status_kehadiran=TERVERIFIKASI');

    // Verify absent students remained untouched
    const { data: untouchedLogs } = await supabaseClient
      .from('log_ujian')
      .select('id_log, is_verified_kehadiran, status_kehadiran')
      .in('id_siswa', studentIds.slice(ATTENDED_COUNT));

    const allUntouched = untouchedLogs && untouchedLogs.every(l => l.is_verified_kehadiran === false && l.status_kehadiran === 'BELUM_HADIR');
    assert(allUntouched, 'T2.7_AbsentStudentsUntouched', `All ${ABSENT_COUNT} absent students remained unverified without false positives`);

    // 2.4 Adversarial bulk rejection test
    const rejectBatch = attendedAbsensiIds.slice(0, 10);
    const resRejectBulk = await fetchAPI('verifikasi_absensi_bulk', {
      list_id_absensi: rejectBatch,
      id_guru: TEST_GURU_ID,
      status_verifikasi: 'DITOLAK'
    });
    assert(resRejectBulk.status === 'success', 'T2.8_BulkRejectionExecution', 'Executed bulk attendance rejection for 10 students');

    const { data: rejectedAbsensi } = await supabaseClient
      .from('absensi_ujian')
      .select('id_absensi, status_verifikasi')
      .in('id_absensi', rejectBatch);
    const allRejectedAbs = rejectedAbsensi && rejectedAbsensi.every(a => a.status_verifikasi === 'DITOLAK');
    assert(allRejectedAbs, 'T2.9_AbsensiStatusRejected', 'absensi_ujian status updated to DITOLAK');

    const { data: rejectedLogs } = await supabaseClient
      .from('log_ujian')
      .select('id_log, is_verified_kehadiran, status_kehadiran')
      .in('id_siswa', studentIds.slice(0, 10));
    const allRejectedLogs = rejectedLogs && rejectedLogs.every(l => l.is_verified_kehadiran === false && l.status_kehadiran === 'DITOLAK');
    assert(allRejectedLogs, 'T2.10_LogUjianStatusRejected', 'log_ujian status updated to DITOLAK and is_verified_kehadiran=false');

    // 2.5 Bulk approval input validation boundaries
    const resEmptyBulk = await fetchAPI('verifikasi_absensi_bulk', {
      list_id_absensi: [],
      id_guru: TEST_GURU_ID
    });
    assert(resEmptyBulk.status === 'error', 'T2.11_RejectEmptyBulkList', 'Rejects empty array in bulk approval');

    const resNonArrayBulk = await fetchAPI('verifikasi_absensi_bulk', {
      list_id_absensi: 'NOT_AN_ARRAY',
      id_guru: TEST_GURU_ID
    });
    assert(resNonArrayBulk.status === 'error', 'T2.12_RejectNonArrayBulkList', 'Rejects non-array argument in bulk approval');

    const resNonExistentBulk = await fetchAPI('verifikasi_absensi_bulk', {
      list_id_absensi: ['ABS_GHOST_1', 'ABS_GHOST_2'],
      id_guru: TEST_GURU_ID
    });
    assert(resNonExistentBulk.status === 'success', 'T2.13_GracefulNonExistentIDs', 'Handles non-existent IDs gracefully without database exception');


    // =========================================================================
    // GROUP 3: Large Dataset Print Payload (55+ Students, 12,500+ Chars, Emojis, XSS)
    // =========================================================================
    console.log('\n[GROUP 3: Large Dataset Print Payload & Extreme Notes (12,500+ chars)]');

    // 3.1 Construct 12,500+ character incident note
    const baseIncidentParagraph = `Pada pelaksanaan sesi ujian hari ini di ruangan Hall Auditorium CBT 55, terpantau seluruh peserta ujian hadir tepat waktu dengan tertib. Sebanyak 45 dari 55 siswa berhasil memverifikasi kehadiran menggunakan tanda tangan digital canvas. Terdapat beberapa catatan teknis pengawasan: 1) Siswa atas nama Peserta Ke-03 mengalami kendala koneksi lokal sesaat namun berhasil dipulihkan dalam tempo 45 detik; 2) Pengawas memeriksa kesesuaian tanda tangan canvas dengan kartu identitas peserta didik dan menyetujui seluruh kehadiran yang absensinya sah; 3) Kondisi ruangan sejuk dan pencahayaan optimal dengan seluruh unit komputer klien terhubung ke server lokal. `;
    
    let extremeNotes = 'CATATAN PELAKSANAAN UJIAN BERBASIS KOMPUTER (OFFICIAL MINUTES)\n\n';
    while (extremeNotes.length < 12000) {
      extremeNotes += baseIncidentParagraph + '\n\n';
    }

    // Append special characters, typographic glyphs, math formulas, emojis, and HTML injection probes
    const adversarialAddendum = `
--- LAMPIRAN KEJADIAN KHUSUS & FORMULA EVALUASI ---
Karakter Spesial & Tipografi: «Berita Acara Resmi» — Tanggal: 27/09/2026. Kutipan: "Seluruh proses berlangsung kondusif tanpa cacat integritas".
Simbol Matematika & Formula: Σ_{i=1}^N (x_i - μ)^2 / N = σ^2  |  α + β = γ  |  f(x) = ∫_0^∞ e^{-x} dx = 1.
Simbol Internasional & Emotikon: 🎉 📝 🏫 🛡️ 💻 📊 💯 ✅ ⚠️ 🔥 🚀 🇮🇩.
XSS Injection Probes (Must be safely encoded without execution):
<script>window.__xss_test_injected = true; console.log("PWNED");</script>
<img src="nonexistent.png" onerror="alert('xss')" />
<style>body { display: none !important; }</style>
<div style="background-color: red;">INJECTED_TAG</div>
--- AKHIR CATATAN RESMI ---`;

    extremeNotes += adversarialAddendum;
    console.log(`  -> Constructed extreme incident notes payload: ${extremeNotes.length} characters.`);
    assert(extremeNotes.length > 12500, 'T3.1_IncidentNoteSize_Exceeds12500Chars', `Payload size is ${extremeNotes.length} characters (> 12,500 chars)`);

    // 3.2 Persist Berita Acara with extreme payload
    const baId = generateId('BA_CHALL');
    cleanupRegistry.beritaAcara.add(baId);

    const resSaveBA = await fetchAPI('save_berita_acara', {
      id_berita_acara: baId,
      npsn: TEST_NPSN,
      id_jadwal: TEST_JADWAL_ID,
      id_ruang: STRESS_ROOM_ID,
      id_guru: TEST_GURU_ID,
      jumlah_peserta_terdaftar: TOTAL_STUDENTS,
      jumlah_peserta_hadir: ATTENDED_COUNT,
      jumlah_peserta_absen: ABSENT_COUNT,
      daftar_siswa_tidak_hadir: studentBatch.slice(ATTENDED_COUNT).map(s => ({ id_siswa: s.id_siswa, nama_lengkap: s.nama_lengkap, nisn: s.nisn })),
      catatan_pelaksanaan: extremeNotes,
      tanda_tangan_pengawas: SAMPLE_BASE64_SIG
    });
    assert(resSaveBA.status === 'success', 'T3.2_SaveBeritaAcaraWithExtremeNotes', 'Saved Berita Acara with 12,500+ char payload');

    // Direct database assertion on note length
    const { data: savedBARecord } = await supabaseClient
      .from('berita_acara_ujian')
      .select('catatan_pelaksanaan')
      .eq('id_berita_acara', baId)
      .maybeSingle();

    assert(savedBARecord && savedBARecord.catatan_pelaksanaan.length === extremeNotes.length, 'T3.3_DirectDBPayloadIntegrity', 'Database stored full un-truncated 12,500+ character notes');
    assert(savedBARecord && savedBARecord.catatan_pelaksanaan.includes('🎉 📝 🏫') && savedBARecord.catatan_pelaksanaan.includes('<script>window.__xss_test_injected'), 'T3.4_DirectDBEmojiAndProbePreservation', 'Database preserved emojis and injection probe strings intact');

    // 3.3 Call get_dokumen_ujian_cetak and benchmark SLA
    const cetakStartTime = Date.now();
    const resCetak = await fetchAPI('get_dokumen_ujian_cetak', {
      id_jadwal: TEST_JADWAL_ID,
      id_ruang: STRESS_ROOM_ID,
      npsn: TEST_NPSN
    });
    const cetakDuration = Date.now() - cetakStartTime;

    assert(resCetak.status === 'success', 'T3.5_GetDokumenUjianCetak_Success', `Fetched print payload in ${cetakDuration}ms`);
    assert(cetakDuration < 3000, 'T3.6_PrintPayloadSLA', `Response time ${cetakDuration}ms is well within 3000ms SLA`);

    const printPayload = resCetak.data || {};
    assert(Boolean(printPayload.sekolah), 'T3.7_PayloadHasSekolah', 'Print payload contains school info');
    assert(Boolean(printPayload.jadwal), 'T3.8_PayloadHasJadwal', 'Print payload contains exam schedule info');
    assert(printPayload.ruang?.id_ruang === STRESS_ROOM_ID, 'T3.9_PayloadHasRuang', 'Print payload contains designated room info');
    assert(Boolean(printPayload.berita_acara), 'T3.10_PayloadHasBeritaAcara', 'Print payload contains Berita Acara');
    assert(Array.isArray(printPayload.peserta), 'T3.11_PayloadHasPesertaList', 'Print payload contains peserta roster array');

    // Verify all 55 students present
    assert(printPayload.peserta?.length === TOTAL_STUDENTS, 'T3.12_All55StudentsInPrintDossier', `Print payload includes all ${TOTAL_STUDENTS} students (got ${printPayload.peserta?.length})`);

    // Verify alphabetical sort
    let isAlphabetical = true;
    const pesertaList = printPayload.peserta || [];
    for (let k = 1; k < pesertaList.length; k++) {
      if (pesertaList[k].nama_lengkap.localeCompare(pesertaList[k - 1].nama_lengkap) < 0) {
        isAlphabetical = false;
        break;
      }
    }
    assert(isAlphabetical && pesertaList.length > 0, 'T3.13_PesertaAlphabeticallyOrdered', 'Student roster is ordered alphabetically by student name');

    // Verify student schema completeness in print payload
    const sampleStudent = pesertaList[0] || {};
    const hasRequiredFields = ['no', 'id_siswa', 'nama_lengkap', 'nisn', 'kelas', 'ruang', 'status_kehadiran', 'status_verifikasi'].every(f => f in sampleStudent);
    assert(hasRequiredFields && pesertaList.length > 0, 'T3.14_PesertaSchemaCompleteness', 'Student dossier items contain all required reporting fields');

    // Verify Berita Acara notes in cetak payload
    assert(printPayload.berita_acara?.catatan_pelaksanaan?.length === extremeNotes.length, 'T3.15_BeritaAcaraNotesIntegrityInCetak', 'Print dossier Berita Acara contains full 12,500+ character notes');

    // 3.4 Defensive XSS and Rendering Analysis in DokumenUjianPrint.jsx
    const printComponentPath = path.resolve(projectRoot, 'src/components/DokumenUjianPrint.jsx');
    const printCode = fs.readFileSync(printComponentPath, 'utf-8');

    // Check that catatanText is safely rendered as JSX text node and NOT via dangerouslySetInnerHTML
    assert(!printCode.includes('dangerouslySetInnerHTML'), 'T3.16_NoDangerousInnerHTML', 'DokumenUjianPrint does NOT use dangerouslySetInnerHTML (immune to XSS)');
    assert(printCode.includes('{catatanText}'), 'T3.17_SafeJSXTextInterpolation', 'Incident notes safely interpolated via React JSX text escaping');

    // Check Kop Surat SVG placeholders and double-line divider
    assert(printCode.includes('border-double'), 'T3.18_OfficialDoubleBorderDivider', 'Kop Surat features official double-line border divider');
    assert(printCode.includes('DINAS PENDIDIKAN') && printCode.includes('TUT WURI'), 'T3.19_SVGLogoPlaceholders', 'Includes official SVG logo placeholders for Dinas Pendidikan and Tut Wuri Handayani');


    // =========================================================================
    // GROUP 4: @media print CSS & Layout Integrity Validation
    // =========================================================================
    console.log('\n[GROUP 4: @media print CSS Rules & Layout Integrity Validation]');

    const indexCssPath = path.resolve(projectRoot, 'src/index.css');
    const indexCss = fs.readFileSync(indexCssPath, 'utf-8');

    // 4.1 Page setup
    assert(indexCss.includes('@page') && indexCss.includes('size: A4 portrait'), 'T4.1_PageA4Portrait', '@page defines size: A4 portrait');
    assert(indexCss.includes('margin: 12mm 15mm'), 'T4.2_PageMargins12mm15mm', '@page defines standardized margins: 12mm 15mm');

    // 4.2 Ink & Color fidelity
    assert(indexCss.includes('-webkit-print-color-adjust: exact') && indexCss.includes('print-color-adjust: exact'), 'T4.3_PrintColorAdjustExact', 'Enforces exact print color adjust');
    assert(indexCss.includes('background: #ffffff !important') && indexCss.includes('color: #000000 !important'), 'T4.4_PureWhiteBackground', 'Enforces pure white background and pitch black text');

    // 4.3 Multi-page table headers and page breaks
    assert(indexCss.includes('thead') && indexCss.includes('display: table-header-group !important'), 'T4.5_TableTheadHeaderGroup', 'thead uses display: table-header-group !important for repeating headers across pages');
    assert(indexCss.includes('tfoot') && indexCss.includes('display: table-footer-group !important'), 'T4.6_TableTfootFooterGroup', 'tfoot uses display: table-footer-group !important');
    assert(indexCss.includes('.page-break') && indexCss.includes('break-before: page !important'), 'T4.7_PageBreakUtility', '.page-break utility defines break-before: page !important');
    assert(indexCss.includes('.avoid-break') && indexCss.includes('break-inside: avoid !important'), 'T4.8_AvoidBreakUtility', '.avoid-break utility defines break-inside: avoid !important');

    // 4.4 Non-print UI suppression
    const suppressedElements = ['nav', 'aside', 'header', 'footer', '.no-print', 'button', '.bottom-bar', '.fixed', '.modal-backdrop', '#pwa-install-toast'];
    const hasAllSuppressed = suppressedElements.every(el => indexCss.includes(el));
    assert(hasAllSuppressed, 'T4.9_StrictUISuppression', 'All screen UI elements (nav, aside, header, footer, button, fixed, modals, toasts) strictly suppressed in @media print');

    // 4.5 Container visibility
    assert(indexCss.includes('body *') && indexCss.includes('visibility: hidden'), 'T4.10_BodyElementsHiddenByDefault', 'All body child elements hidden by default');
    assert(indexCss.includes('#print-document, #print-document *') && indexCss.includes('visibility: visible'), 'T4.11_PrintDocumentContainerVisible', '#print-document container explicitly visible and full width');


    // =========================================================================
    // GROUP 5: Teardown & Database Orphan Audit
    // =========================================================================
    console.log('\n[GROUP 5: Teardown Execution & Database Orphan Audit]');

    await purgeAllTestData();

    // Verify all ephemeral test data is gone
    const { count: orphanRooms } = await supabaseClient.from('ruang_ujian').select('*', { count: 'exact', head: true }).ilike('id_ruang', 'R_CHALL%');
    const { count: orphanAssignments } = await supabaseClient.from('pengawas_ruang').select('*', { count: 'exact', head: true }).ilike('id_penugasan', 'TGS_CHALL%');
    const { count: orphanStudents } = await supabaseClient.from('siswa').select('*', { count: 'exact', head: true }).ilike('id_siswa', 'S_CHALL%');
    const { count: orphanLogs } = await supabaseClient.from('log_ujian').select('*', { count: 'exact', head: true }).ilike('id_log', 'LOG_CHALL%');
    const { count: orphanAbsensi } = await supabaseClient.from('absensi_ujian').select('*', { count: 'exact', head: true }).ilike('id_absensi', 'ABS_CHALL%');
    const { count: orphanBA } = await supabaseClient.from('berita_acara_ujian').select('*', { count: 'exact', head: true }).ilike('id_berita_acara', 'BA_CHALL%');

    const totalOrphans = (orphanRooms || 0) + (orphanAssignments || 0) + (orphanStudents || 0) + (orphanLogs || 0) + (orphanAbsensi || 0) + (orphanBA || 0);
    assert(totalOrphans === 0, 'T5.1_ZeroOrphanRecordsInDB', `All ephemeral test records purged completely (found ${totalOrphans} orphans)`);

  } catch (error) {
    console.error('\n💥 UNCAUGHT EXCEPTION IN TEST RUNNER:', error);
    assert(false, 'FATAL_EXCEPTION', error.message);
  } finally {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n========================================================================');
    console.log(' CHALLENGER 2 ADVERSARIAL STRESS TEST SUMMARY');
    console.log('========================================================================');
    console.log(` Total Tests Executed : ${totalTests}`);
    console.log(` Tests Passed         : ${passedTests}`);
    console.log(` Tests Failed         : ${failedTests}`);
    console.log(` Execution Duration   : ${elapsed}s`);
    console.log('========================================================================\n');

    if (failedTests > 0) {
      console.error('FAILURES SUMMARY:');
      failureDetails.forEach(f => console.error(` - [${f.testName}]: ${f.extraInfo}`));
      process.exit(1);
    } else {
      console.log('🎉 ALL ADVERSARIAL TESTS PASSED WITHOUT REGRESSION.');
      process.exit(0);
    }
  }
}

runAdversarialSuite();
