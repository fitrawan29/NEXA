#!/usr/bin/env node
/**
 * Test Suite: Worker M1 - Database Schema Migration & API Layer Endpoints
 * 
 * Verifies:
 * 1. Database schema migration: ruang_ujian, pengawas_ruang, absensi_ujian, berita_acara_ujian, siswa.ruang, log_ujian columns.
 * 2. API actions:
 *    - Ruang CRUD: create_ruang, get_ruang, update_ruang, delete_ruang
 *    - Proctor Assignment: assign_pengawas_ruang, get_pengawas_ruang, get_ruang_guru_pengawas, delete_pengawas_ruang
 *    - Student Room Allocation: assign_siswa_ruang_bulk
 *    - Attendance & Signature: submit_absensi_siswa, simpan_kehadiran_siswa, get_absensi_ruang
 *    - Attendance Verification: verifikasi_absensi, verifikasi_absensi_bulk
 *    - Exam Minutes & Print Payload: save_berita_acara, get_dokumen_ujian_cetak
 *    - Exam Entry Gating: get_soal_ujian requires attendance signature when id_log is provided
 *    - Exam Start: mulai_ujian returns has_signed and status_kehadiran
 */

import { fetchAPI, generateId } from '../src/api.js';
import { supabaseClient } from '../src/config.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('Worker M1 Integration Test: DB Migration & API Layer');
  console.log('======================================================\n');

  const testNpsn = '70040625';
  const testGuruId = 'G-163390E6';
  const testSiswaId = 'S-F2934CD8';
  let testJadwalId = null;
  let testTugasId = null;
  let testLogId = null;
  let unsignedLogId = null;
  let unsignedSiswaId = null;
  const sampleSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  const testRoomId = generateId('R_TEST');
  const testRoomName = 'Ruang Laboratorium Komputer A';
  const testRoomCode = 'LAB-KOMP-A';

  try {
    testJadwalId = `U-M1-${Date.now()}`;
    await supabaseClient.from('jadwal').insert([{
      id_jadwal: testJadwalId,
      id_mapel: 'M-7AE60E7B',
      id_guru: testGuruId,
      npsn: testNpsn,
      waktu_mulai: new Date(Date.now() - 3600000).toISOString(),
      waktu_selesai: new Date(Date.now() + 3600000).toISOString(),
      durasi_menit: 60,
      acak_soal: false,
      target_kelas: 'XI Merdeka',
      token_aktif: 'M1TOK'
    }]);
    // ------------------------------------------------------------------
    // TEST 1: Database Table and Column Existence
    // ------------------------------------------------------------------
    console.log('[TEST GROUP 1: Database Schema Checks]');
    
    const { data: tables } = await supabaseClient
      .from('ruang_ujian')
      .select('id_ruang')
      .limit(1);
    assert(tables !== null, 'Tabel ruang_ujian exists and is queryable');

    const { data: pengawasTbl } = await supabaseClient
      .from('pengawas_ruang')
      .select('id_penugasan')
      .limit(1);
    assert(pengawasTbl !== null, 'Tabel pengawas_ruang exists and is queryable');

    const { data: absensiTbl } = await supabaseClient
      .from('absensi_ujian')
      .select('id_absensi')
      .limit(1);
    assert(absensiTbl !== null, 'Tabel absensi_ujian exists and is queryable');

    const { data: baTbl } = await supabaseClient
      .from('berita_acara_ujian')
      .select('id_berita_acara')
      .limit(1);
    assert(baTbl !== null, 'Tabel berita_acara_ujian exists and is queryable');

    // ------------------------------------------------------------------
    // TEST 2: Ruang CRUD (create_ruang, get_ruang, update_ruang, delete_ruang)
    // ------------------------------------------------------------------
    console.log('\n[TEST GROUP 2: Ruang CRUD API]');

    const resCreateRuang = await fetchAPI('create_ruang', {
      id_ruang: testRoomId,
      npsn: testNpsn,
      nama_ruang: testRoomName,
      kode_ruang: testRoomCode,
      kapasitas: 32,
      keterangan: 'Ruang Ujian Terpadu CBT'
    });
    assert(resCreateRuang.status === 'success', `create_ruang succeeded: ${resCreateRuang.message}`);

    const resGetRuang = await fetchAPI('get_ruang', { npsn: testNpsn });
    assert(resGetRuang.status === 'success' && Array.isArray(resGetRuang.data), 'get_ruang returned list of rooms');
    const createdRoom = (resGetRuang.data || []).find(r => r.id_ruang === testRoomId);
    assert(Boolean(createdRoom), 'Newly created room exists in get_ruang results');
    assert(createdRoom?.nama_ruang === testRoomName, `Room name matches: ${createdRoom?.nama_ruang}`);

    const resUpdateRuang = await fetchAPI('update_ruang', {
      id_ruang: testRoomId,
      npsn: testNpsn,
      kapasitas: 40,
      keterangan: 'Ruang Ujian Terpadu (Kapasitas Ditingkatkan)'
    });
    assert(resUpdateRuang.status === 'success', `update_ruang succeeded: ${resUpdateRuang.message}`);

    // Verify update
    const resGetUpdatedRuang = await fetchAPI('get_ruang', { npsn: testNpsn });
    const updatedRoom = (resGetUpdatedRuang.data || []).find(r => r.id_ruang === testRoomId);
    assert(updatedRoom?.kapasitas === 40, 'Updated capacity is persisted as 40');

    // ------------------------------------------------------------------
    // TEST 3: Proctor Assignment (assign_pengawas_ruang, get_pengawas_ruang, get_ruang_guru_pengawas)
    // ------------------------------------------------------------------
    console.log('\n[TEST GROUP 3: Proctor Assignment API]');

    testTugasId = generateId('TGS_TEST');
    const resAssign = await fetchAPI('assign_pengawas_ruang', {
      id_penugasan: testTugasId,
      npsn: testNpsn,
      id_ruang: testRoomId,
      id_guru: testGuruId,
      id_jadwal: testJadwalId,
      peran: 'PENGAWAS UTAMA',
      status_tugas: 'AKTIF'
    });
    assert(resAssign.status === 'success', `assign_pengawas_ruang succeeded: ${resAssign.message}`);

    const resGetPengawas = await fetchAPI('get_pengawas_ruang', {
      npsn: testNpsn,
      id_ruang: testRoomId
    });
    assert(resGetPengawas.status === 'success' && resGetPengawas.data.length > 0, 'get_pengawas_ruang returned proctor data');
    const assignedProctor = resGetPengawas.data[0];
    assert(assignedProctor.guru?.nama_lengkap !== undefined, `Joined guru name resolved: ${assignedProctor.guru?.nama_lengkap}`);
    assert(assignedProctor.ruang?.nama_ruang !== undefined, `Joined room name resolved: ${assignedProctor.ruang?.nama_ruang}`);

    const resGuruPengawas = await fetchAPI('get_ruang_guru_pengawas', {
      id_guru: testGuruId,
      npsn: testNpsn
    });
    assert(resGuruPengawas.status === 'success', 'get_ruang_guru_pengawas succeeded for logged in teacher');
    assert(resGuruPengawas.data.some(p => p.id_ruang === testRoomId), 'Proctor task appears in get_ruang_guru_pengawas');

    // ------------------------------------------------------------------
    // TEST 4: Student Room Allocation (assign_siswa_ruang_bulk)
    // ------------------------------------------------------------------
    console.log('\n[TEST GROUP 4: Student Room Allocation API]');

    const resAssignSiswa = await fetchAPI('assign_siswa_ruang_bulk', {
      npsn: testNpsn,
      id_ruang: testRoomId,
      nama_ruang: testRoomName,
      list_id_siswa: [testSiswaId]
    });
    assert(resAssignSiswa.status === 'success', `assign_siswa_ruang_bulk succeeded: ${resAssignSiswa.message}`);

    // Verify in siswa table
    const { data: siswaCheck } = await supabaseClient
      .from('siswa')
      .select('ruang')
      .eq('id_siswa', testSiswaId)
      .single();
    assert(siswaCheck?.ruang === testRoomName, `siswa.ruang updated to: ${siswaCheck?.ruang}`);

    // ------------------------------------------------------------------
    // TEST 5: Attendance & Signature (submit_absensi_siswa / simpan_kehadiran_siswa)
    // ------------------------------------------------------------------
    console.log('\n[TEST GROUP 5: Attendance & Signature API]');

    // 5a. Rejection of invalid signature
    const resInvalidSig = await fetchAPI('submit_absensi_siswa', {
      npsn: testNpsn,
      id_jadwal: testJadwalId,
      id_siswa: testSiswaId,
      tanda_tangan: 'invalid-string'
    });
    assert(resInvalidSig.status === 'error', 'Invalid signature rejected properly');

    // 5b. Valid signature submission
    testLogId = generateId('LOG_TEST');
    // Ensure test log_ujian exists for testing
    await supabaseClient.from('log_ujian').upsert({
      id_log: testLogId,
      id_jadwal: testJadwalId,
      id_siswa: testSiswaId,
      status_ujian: 'SEDANG KERJA',
      pelanggaran: 0,
      status_kehadiran: 'BELUM_HADIR',
      tanda_tangan: null
    });

    const resSubmitAbsensi = await fetchAPI('submit_absensi_siswa', {
      npsn: testNpsn,
      id_jadwal: testJadwalId,
      id_siswa: testSiswaId,
      id_ruang: testRoomId,
      id_log: testLogId,
      tanda_tangan: sampleSignature
    });
    assert(resSubmitAbsensi.status === 'success', `submit_absensi_siswa succeeded: ${resSubmitAbsensi.message}`);

    // Verify dual-write to log_ujian
    const { data: logUpdated } = await supabaseClient
      .from('log_ujian')
      .select('tanda_tangan, status_kehadiran, waktu_absen')
      .eq('id_log', testLogId)
      .single();
    assert(Boolean(logUpdated?.tanda_tangan), 'Signature dual-written to log_ujian');
    assert(logUpdated?.status_kehadiran === 'HADIR', `log_ujian status_kehadiran set to: ${logUpdated?.status_kehadiran}`);

    // 5c. Query attendance in room
    const resGetAbsensiRuang = await fetchAPI('get_absensi_ruang', {
      npsn: testNpsn,
      id_jadwal: testJadwalId,
      id_ruang: testRoomId
    });
    assert(resGetAbsensiRuang.status === 'success', 'get_absensi_ruang succeeded');
    const studentAbsRecord = (resGetAbsensiRuang.data || []).find(a => a.id_siswa === testSiswaId);
    assert(Boolean(studentAbsRecord), 'Student attendance record retrieved');
    assert(studentAbsRecord?.status_verifikasi === 'MENUNGGU', 'Default status_verifikasi is MENUNGGU');
    assert(studentAbsRecord?.siswa?.nama_lengkap !== undefined, `Joined student name: ${studentAbsRecord?.siswa?.nama_lengkap}`);

    // ------------------------------------------------------------------
    // TEST 6: Attendance Verification by Proctor (verifikasi_absensi & bulk)
    // ------------------------------------------------------------------
    console.log('\n[TEST GROUP 6: Proctor Attendance Verification]');

    const resVerifikasi = await fetchAPI('verifikasi_absensi', {
      id_absensi: studentAbsRecord?.id_absensi,
      status_verifikasi: 'DISETUJUI',
      id_guru: testGuruId,
      catatan: 'Tanda tangan valid dan wajah sesuai'
    });
    assert(resVerifikasi.status === 'success', `verifikasi_absensi approved student: ${resVerifikasi.message}`);

    // Verify in absensi_ujian and log_ujian
    const { data: absVerified } = await supabaseClient
      .from('absensi_ujian')
      .select('status_verifikasi, verified_by')
      .eq('id_absensi', studentAbsRecord?.id_absensi)
      .single();
    assert(absVerified?.status_verifikasi === 'DISETUJUI', 'absensi_ujian status_verifikasi is DISETUJUI');
    assert(absVerified?.verified_by === testGuruId, 'verified_by matches proctor ID');

    // Test bulk verification
    const resBulkVerif = await fetchAPI('verifikasi_absensi_bulk', {
      list_id_absensi: [studentAbsRecord?.id_absensi],
      id_guru: testGuruId,
      status_verifikasi: 'DISETUJUI'
    });
    assert(resBulkVerif.status === 'success', `verifikasi_absensi_bulk succeeded: ${resBulkVerif.message}`);

    // ------------------------------------------------------------------
    // TEST 7: Berita Acara & Print-Ready Payload (save_berita_acara, get_dokumen_ujian_cetak)
    // ------------------------------------------------------------------
    console.log('\n[TEST GROUP 7: Exam Minutes & Print Payload]');

    const resSaveBA = await fetchAPI('save_berita_acara', {
      npsn: testNpsn,
      id_jadwal: testJadwalId,
      id_ruang: testRoomId,
      id_guru: testGuruId,
      jumlah_peserta_terdaftar: 30,
      jumlah_peserta_hadir: 29,
      jumlah_peserta_absen: 1,
      daftar_siswa_tidak_hadir: 'Siswa A (Sakit)',
      catatan_pelaksanaan: 'Pelaksanaan ujian tertib dan lancar tanpa kendala teknis.',
      tanda_tangan_pengawas: sampleSignature
    });
    assert(resSaveBA.status === 'success', `save_berita_acara succeeded: ${resSaveBA.message}`);

    const resCetakDoc = await fetchAPI('get_dokumen_ujian_cetak', {
      npsn: testNpsn,
      id_jadwal: testJadwalId,
      id_ruang: testRoomId
    });
    assert(resCetakDoc.status === 'success', 'get_dokumen_ujian_cetak succeeded');
    const docData = resCetakDoc.data;
    assert(docData.sekolah?.nama_sekolah !== undefined, `Print payload sekolah: ${docData.sekolah?.nama_sekolah}`);
    assert(docData.jadwal?.id_jadwal === testJadwalId, 'Print payload includes jadwal info');
    assert(docData.ruang?.nama_ruang === testRoomName, 'Print payload includes room info');
    assert(docData.berita_acara?.catatan_pelaksanaan !== undefined, 'Print payload includes berita acara');
    assert(Array.isArray(docData.peserta), 'Print payload includes participants list');
    const samplePeserta = docData.peserta.find(p => p.id_siswa === testSiswaId);
    assert(Boolean(samplePeserta?.tanda_tangan), 'Print payload contains student signature');

    // ------------------------------------------------------------------
    // TEST 8: Exam Entry Gating (get_soal_ujian)
    // ------------------------------------------------------------------
    console.log('\n[TEST GROUP 8: Exam Entry Gating in get_soal_ujian]');

    // Create an unsigned test student & log
    unsignedLogId = generateId('LOG_UNSIGNED');
    unsignedSiswaId = generateId('S_UNSIGNED');
    await fetchAPI('create_siswa', {
      id_siswa: unsignedSiswaId,
      nama_lengkap: 'Siswa Belum TTD',
      username: 'siswabelumttd_' + Math.random().toString(36).substring(2, 7),
      password: 'password123',
      npsn: testNpsn,
      angkatan: '2026',
      kelas: '10|IPA 1'
    });

    await supabaseClient.from('log_ujian').insert([{
      id_log: unsignedLogId,
      id_jadwal: testJadwalId,
      id_siswa: unsignedSiswaId,
      status_ujian: 'SEDANG KERJA',
      pelanggaran: 0,
      status_kehadiran: 'BELUM_HADIR',
      tanda_tangan: null
    }]);

    // get_soal_ujian with unsigned log MUST be rejected
    const resGatingBlocked = await fetchAPI('get_soal_ujian', {
      npsn: testNpsn,
      id_jadwal: testJadwalId,
      id_log: unsignedLogId
    });
    assert(resGatingBlocked.status === 'error', 'Unsigned student is blocked from getting exam questions');
    assert(resGatingBlocked.need_signature === true, 'Gating error response includes need_signature: true');

    // get_soal_ujian with signed log MUST succeed
    const resGatingAllowed = await fetchAPI('get_soal_ujian', {
      npsn: testNpsn,
      id_jadwal: testJadwalId,
      id_log: testLogId
    });
    assert(resGatingAllowed.status === 'success', 'Signed student successfully receives exam questions');
    assert(Array.isArray(resGatingAllowed.data), 'Exam questions array returned for signed student');

    // ------------------------------------------------------------------
    // TEST 9: Status in get_status_log_ujian & mulai_ujian
    // ------------------------------------------------------------------
    console.log('\n[TEST GROUP 9: Exam Status Check]');

    const resStatusSigned = await fetchAPI('get_status_log_ujian', { id_log: testLogId });
    assert(resStatusSigned.status === 'success', 'get_status_log_ujian succeeded');
    assert(resStatusSigned.data?.has_signed === true, 'get_status_log_ujian reports has_signed: true');

    const resStatusUnsigned = await fetchAPI('get_status_log_ujian', { id_log: unsignedLogId });
    assert(resStatusUnsigned.data?.has_signed === false, 'get_status_log_ujian reports has_signed: false for unsigned log');

    // Test mulai_ujian with temporary active schedule token
    const futureTime = new Date(Date.now() + 3600000).toISOString();
    await supabaseClient.from('jadwal').update({
      token_aktif: 'NEXATK',
      waktu_selesai: futureTime
    }).eq('id_jadwal', testJadwalId);

    const resMulaiSigned = await fetchAPI('mulai_ujian', {
      id_jadwal: testJadwalId,
      id_siswa: testSiswaId,
      token: 'NEXATK',
      npsn: testNpsn
    });
    assert(resMulaiSigned.status === 'success', 'mulai_ujian succeeded for active schedule');
    assert(resMulaiSigned.has_signed === true, 'mulai_ujian returns has_signed: true for signed student');
    assert(resMulaiSigned.status_kehadiran !== undefined, `mulai_ujian returns status_kehadiran: ${resMulaiSigned.status_kehadiran}`);

    const resMulaiUnsigned = await fetchAPI('mulai_ujian', {
      id_jadwal: testJadwalId,
      id_siswa: unsignedSiswaId,
      token: 'NEXATK',
      npsn: testNpsn
    });
    assert(resMulaiUnsigned.status === 'success', 'mulai_ujian succeeded for unsigned student');
    assert(resMulaiUnsigned.has_signed === false, 'mulai_ujian returns has_signed: false for unsigned student');
    assert(resMulaiUnsigned.status_kehadiran === 'BELUM_HADIR', 'mulai_ujian status_kehadiran is BELUM_HADIR');

    // ------------------------------------------------------------------
    // TEST 10: Cleanup of Test Records
    // ------------------------------------------------------------------
    console.log('\n[TEST GROUP 10: Cleanup Test Data]');

    const resDelTugas = await fetchAPI('delete_pengawas_ruang', {
      id_penugasan: testTugasId,
      npsn: testNpsn
    });
    assert(resDelTugas.status === 'success', `delete_pengawas_ruang succeeded: ${resDelTugas.message}`);

    const resDelRuang = await fetchAPI('delete_ruang', {
      id_ruang: testRoomId,
      npsn: testNpsn
    });
    assert(resDelRuang.status === 'success', `delete_ruang succeeded: ${resDelRuang.message}`);

    // Clean up test logs, absensi, test jadwal, and reset student room
    await supabaseClient.from('absensi_ujian').delete().eq('id_siswa', testSiswaId).eq('id_jadwal', testJadwalId);
    await supabaseClient.from('berita_acara_ujian').delete().eq('id_ruang', testRoomId).eq('id_jadwal', testJadwalId);
    await supabaseClient.from('log_ujian').delete().in('id_log', [testLogId, unsignedLogId]);
    await fetchAPI('delete_siswa', { id_siswa: unsignedSiswaId, npsn: testNpsn });
    await supabaseClient.from('siswa').update({ ruang: null }).eq('id_siswa', testSiswaId);
    if (testJadwalId) {
      await supabaseClient.from('jadwal').delete().eq('id_jadwal', testJadwalId);
    }
    console.log('  ✓ Test artifacts cleaned up successfully.');

  } catch (err) {
    console.error('Unexpected error in test execution:', err);
    failed++;
  } finally {
    try {
      if (testSiswaId) {
        await supabaseClient.from('siswa').update({ ruang: null }).eq('id_siswa', testSiswaId);
      }
      if (testJadwalId) {
        await supabaseClient.from('absensi_ujian').delete().eq('id_jadwal', testJadwalId);
        await supabaseClient.from('berita_acara_ujian').delete().eq('id_jadwal', testJadwalId);
        await supabaseClient.from('log_ujian').delete().eq('id_jadwal', testJadwalId);
        await supabaseClient.from('jadwal').delete().eq('id_jadwal', testJadwalId);
      }
      if (testTugasId) {
        await supabaseClient.from('pengawas_ruang').delete().eq('id_penugasan', testTugasId);
      }
      if (testRoomId) {
        await supabaseClient.from('ruang_ujian').delete().eq('id_ruang', testRoomId);
      }
      if (unsignedSiswaId) {
        await supabaseClient.from('siswa').delete().eq('id_siswa', unsignedSiswaId);
      }
    } catch (e) {
      console.warn('Teardown warning:', e.message);
    }
  }

  console.log('\n------------------------------------------------------');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
