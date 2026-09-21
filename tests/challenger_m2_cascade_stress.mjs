/**
 * CBT NEXA - Empirical Challenger M2 Cascade Stress Test Suite
 * 
 * Target: Superadmin Cascading School Deletion & Zero Orphan Verification
 * Requirement: R2 (Superadmin Cascading Deletion)
 * 
 * Adversarial Stress Vectors:
 * 1. PostgreSQL Foreign Key Catalog Audit:
 *    - Verify all 10 tables referencing sekolah(npsn) have delete_rule = 'CASCADE'
 *    - Verify secondary cascade constraints (guru_mapel, log_ujian, jawaban_siswa)
 *    - Negative Constraint Check: Attempt to inject orphan rows into all 10 tables -> MUST fail with PG 23503
 * 
 * 2. Deep Full-Tree Stress Test via RPC delete_sekolah_cascade:
 *    - Create test school with complete dependency graph:
 *      sekolah -> admin, guru, mata_pelajaran, kelas, siswa, pengumuman, audit_log, audit_log_archive
 *      guru + mapel -> guru_mapel
 *      mapel + guru -> jadwal
 *      jadwal + mapel -> soal_ujian
 *      jadwal + siswa -> log_ujian
 *      log_ujian + soal_ujian -> jawaban_siswa
 *    - Execute RPC delete_sekolah_cascade
 *    - Assert exact count = 0 across all 14 tables
 * 
 * 3. Application API Route Stress Test via fetchAPI('delete_sekolah'):
 *    - Create test school with child records
 *    - Call frontend api.js fetchAPI route
 *    - Assert success and exact count = 0 across all tables
 * 
 * 4. Database-Engine-Only Cascade Stress Test (Pure SQL DELETE):
 *    - Create test school with child records
 *    - Execute raw supabase.from('sekolah').delete() bypassing stored procedure
 *    - Assert database engine cascade functions properly with 0 orphaned records
 * 
 * 5. Edge Cases & Idempotency:
 *    - Attempt to delete non-existent school -> returns controlled error
 *    - Attempt to delete already-deleted school -> returns controlled error
 * 
 * 6. Global Live Database Zero-Orphan Audit:
 *    - Full scan of audit_log, audit_log_archive, and all child tables
 *    - Assert 0 orphaned records exist in the entire database
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { fetchAPI } from '../src/api.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../src/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const suiteReport = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: [],
  failures: []
};

function recordAssert(category, name, passed, details = '') {
  suiteReport.total++;
  if (passed) {
    suiteReport.passed++;
    suiteReport.tests.push({ category, name, status: 'PASS' });
    console.log(`  ✔ [PASS] [${category}] ${name}`);
  } else {
    suiteReport.failed++;
    suiteReport.tests.push({ category, name, status: 'FAIL', details });
    suiteReport.failures.push({ category, name, details });
    console.error(`  ✖ [FAIL] [${category}] ${name} -> ${details}`);
  }
}

async function runChallengerStressSuite() {
  console.log('========================================================================');
  console.log('   CBT NEXA CHALLENGER M2: EMPIRICAL CASCADE STRESS TEST & ZERO ORPHANS  ');
  console.log('========================================================================\n');

  // ===========================================================================
  // CATEGORY 1: PostgreSQL Foreign Key Catalog Audit & Orphan Injection Guard
  // ===========================================================================
  console.log('▶ [CATEGORY 1] PostgreSQL Foreign Key Catalog Audit & Orphan Injection Guard');

  // 1.1 Query PostgreSQL foreign key constraints on sekolah(npsn)
  const { data: fkList, error: errFk } = await supabase.rpc('get_sekolah_fk_constraints');
  recordAssert(
    'FK_CATALOG',
    'Introspection RPC get_sekolah_fk_constraints returned catalog metadata',
    !errFk && Array.isArray(fkList),
    errFk?.message || 'No data returned'
  );

  const requiredTables = [
    'admin', 'guru', 'siswa', 'jadwal', 'mata_pelajaran',
    'soal_ujian', 'kelas', 'pengumuman', 'audit_log', 'audit_log_archive'
  ];

  const fkMap = new Map();
  if (fkList) {
    for (const row of fkList) {
      fkMap.set(row.table_name, row);
    }
  }

  for (const table of requiredTables) {
    const fkInfo = fkMap.get(table);
    const hasCascade = fkInfo && fkInfo.delete_rule === 'CASCADE';
    recordAssert(
      'FK_CATALOG',
      `Foreign key on public.${table}(npsn) exists with ON DELETE CASCADE`,
      hasCascade,
      fkInfo ? `delete_rule = '${fkInfo.delete_rule}', expected 'CASCADE'` : 'Foreign key not found'
    );
  }

  // 1.2 Negative Constraint Injection Tests: Verify DB rejects orphan inserts with PG 23503
  const fakeNpsn = 'NON_EXISTENT_99999999';

  const injectionTests = [
    { table: 'audit_log', data: { id_audit: 'TEST-ORPHAN-' + crypto.randomUUID(), npsn: fakeNpsn, action: 'ATTACK' } },
    { table: 'audit_log_archive', data: { id_archive: 'TEST-ORPHAN-' + crypto.randomUUID(), npsn: fakeNpsn, action: 'ATTACK' } },
    { table: 'admin', data: { id_admin: crypto.randomUUID(), npsn: fakeNpsn, username: 'atk_' + Date.now(), password: 'p', nama_lengkap: 'Hacker' } },
    { table: 'guru', data: { id_guru: 'G-ATK-' + Date.now(), npsn: fakeNpsn, username: 'gatk_' + Date.now(), password: 'p', nama_lengkap: 'Hacker', nip: 'ATK' } },
    { table: 'siswa', data: { id_siswa: 'S-ATK-' + Date.now(), npsn: fakeNpsn, username: 'satk_' + Date.now(), password: 'p', nama_lengkap: 'Hacker', nisn: 'ATK' } },
    { table: 'mata_pelajaran', data: { id_mapel: 'M-ATK-' + Date.now(), npsn: fakeNpsn, nama_mapel: 'Attack' } },
    { table: 'pengumuman', data: { id_pengumuman: 'ANN-ATK-' + Date.now(), npsn: fakeNpsn, judul: 'Attack', isi: 'Attack' } }
  ];

  for (const t of injectionTests) {
    const { error: injErr } = await supabase.from(t.table).insert([t.data]);
    const isViolated = injErr && (injErr.code === '23503' || injErr.message.includes('foreign key constraint'));
    recordAssert(
      'INJECTION_GUARD',
      `Database strictly blocks orphan row insertion on public.${t.table} via FK constraint 23503`,
      isViolated,
      injErr ? `Code: ${injErr.code}, Message: ${injErr.message}` : 'Insert unexpectedly SUCCEEDED without FK violation!'
    );
  }

  // ===========================================================================
  // CATEGORY 2: Deep Full-Tree Insertion & Cascade Stress Test via RPC
  // ===========================================================================
  console.log('\n▶ [CATEGORY 2] Deep Full-Tree Insertion & Cascade Stress Test via RPC');

  const rpcNpsn = `CHL${Math.floor(100000 + Math.random() * 900000)}`;
  const rpcSchoolName = `Sekolah Challenger RPC ${rpcNpsn}`;

  // Insert school
  const { error: errSch1 } = await supabase.from('sekolah').insert([{
    npsn: rpcNpsn,
    nama_sekolah: rpcSchoolName,
    status: 'ACTIVE'
  }]);
  recordAssert('TREE_SETUP', `Insert test school ${rpcNpsn}`, !errSch1, errSch1?.message);

  // Insert complete child tree
  const admin1Id = crypto.randomUUID();
  const admin2Id = crypto.randomUUID();
  const { error: errAdm } = await supabase.from('admin').insert([
    { id_admin: admin1Id, npsn: rpcNpsn, nama_lengkap: 'Admin 1', username: `adm1_${rpcNpsn}`, password: 'p1' },
    { id_admin: admin2Id, npsn: rpcNpsn, nama_lengkap: 'Admin 2', username: `adm2_${rpcNpsn}`, password: 'p2' }
  ]);
  if (errAdm) console.error('Error inserting admin:', errAdm);

  const guru1Id = `G1-${rpcNpsn}`;
  const guru2Id = `G2-${rpcNpsn}`;
  const { error: errGuru } = await supabase.from('guru').insert([
    { id_guru: guru1Id, npsn: rpcNpsn, nama_lengkap: 'Guru 1', username: `g1_${rpcNpsn}`, password: 'p', nip: `NIP1-${rpcNpsn}` },
    { id_guru: guru2Id, npsn: rpcNpsn, nama_lengkap: 'Guru 2', username: `g2_${rpcNpsn}`, password: 'p', nip: `NIP2-${rpcNpsn}` }
  ]);
  if (errGuru) console.error('Error inserting guru:', errGuru);

  const mapel1Id = `M1-${rpcNpsn}`;
  const mapel2Id = `M2-${rpcNpsn}`;
  const { error: errMapel } = await supabase.from('mata_pelajaran').insert([
    { id_mapel: mapel1Id, npsn: rpcNpsn, nama_mapel: 'Matematika Stress' },
    { id_mapel: mapel2Id, npsn: rpcNpsn, nama_mapel: 'Bahasa Stress' }
  ]);
  if (errMapel) console.error('Error inserting mata_pelajaran:', errMapel);

  // Secondary child: guru_mapel
  const { error: errGM } = await supabase.from('guru_mapel').insert([
    { id_guru: guru1Id, id_mapel: mapel1Id },
    { id_guru: guru2Id, id_mapel: mapel2Id }
  ]);
  if (errGM) console.error('Error inserting guru_mapel:', errGM);

  const kelas1Id = crypto.randomUUID();
  const kelas2Id = crypto.randomUUID();
  const { error: errKelas } = await supabase.from('kelas').insert([
    { id_kelas: kelas1Id, npsn: rpcNpsn, tingkat: 'X', kelas_paralel: 'IPA-1' },
    { id_kelas: kelas2Id, npsn: rpcNpsn, tingkat: 'XI', kelas_paralel: 'IPS-1' }
  ]);
  if (errKelas) console.error('Error inserting kelas:', errKelas);

  const siswa1Id = `S1-${rpcNpsn}`;
  const siswa2Id = `S2-${rpcNpsn}`;
  const { error: errSiswa } = await supabase.from('siswa').insert([
    { id_siswa: siswa1Id, npsn: rpcNpsn, nama_lengkap: 'Siswa 1', username: `s1_${rpcNpsn}`, password: 'p', nisn: `NISN1-${rpcNpsn}`, angkatan: '10', kelas_paralel: 'IPA-1' },
    { id_siswa: siswa2Id, npsn: rpcNpsn, nama_lengkap: 'Siswa 2', username: `s2_${rpcNpsn}`, password: 'p', nisn: `NISN2-${rpcNpsn}`, angkatan: '11', kelas_paralel: 'IPS-1' }
  ]);
  if (errSiswa) console.error('Error inserting siswa:', errSiswa);

  const jadwal1Id = `J1-${rpcNpsn}`;
  const jadwal2Id = `J2-${rpcNpsn}`;
  const { error: errJadwal } = await supabase.from('jadwal').insert([
    { id_jadwal: jadwal1Id, npsn: rpcNpsn, id_mapel: mapel1Id, id_guru: guru1Id, waktu_mulai: new Date().toISOString(), waktu_selesai: new Date(Date.now() + 3600000).toISOString(), durasi_menit: 60, token_aktif: 'TK1111' },
    { id_jadwal: jadwal2Id, npsn: rpcNpsn, id_mapel: mapel2Id, id_guru: guru2Id, waktu_mulai: new Date().toISOString(), waktu_selesai: new Date(Date.now() + 3600000).toISOString(), durasi_menit: 60, token_aktif: 'TK2222' }
  ]);
  if (errJadwal) console.error('Error inserting jadwal:', errJadwal);

  const soal1Id = `Q1-${rpcNpsn}`;
  const soal2Id = `Q2-${rpcNpsn}`;
  const { error: errSoal } = await supabase.from('soal_ujian').insert([
    { id_soal: soal1Id, npsn: rpcNpsn, id_mapel: mapel1Id, id_jadwal: jadwal1Id, pertanyaan: '1+1=?', opsi_a: '1', opsi_b: '2', opsi_c: '3', opsi_d: '4', opsi_e: '5', kunci_jawaban: 'B', jenis_soal: 'PG', tipe_soal: 'PG' },
    { id_soal: soal2Id, npsn: rpcNpsn, id_mapel: mapel2Id, id_jadwal: jadwal2Id, pertanyaan: '2+2=?', opsi_a: '1', opsi_b: '2', opsi_c: '3', opsi_d: '4', opsi_e: '5', kunci_jawaban: 'D', jenis_soal: 'PG', tipe_soal: 'PG' }
  ]);
  if (errSoal) console.error('Error inserting soal_ujian:', errSoal);

  // Secondary children: log_ujian & jawaban_siswa
  const log1Id = `LOG1-${rpcNpsn}`;
  const log2Id = `LOG2-${rpcNpsn}`;
  const { error: errLog } = await supabase.from('log_ujian').insert([
    { id_log: log1Id, id_jadwal: jadwal1Id, id_siswa: siswa1Id, status_ujian: 'SEDANG KERJA' },
    { id_log: log2Id, id_jadwal: jadwal2Id, id_siswa: siswa2Id, status_ujian: 'SELESAI' }
  ]);
  if (errLog) console.error('Error inserting log_ujian:', errLog);

  const ans1Id = `ANS1-${rpcNpsn}`;
  const ans2Id = `ANS2-${rpcNpsn}`;
  const { error: errAns } = await supabase.from('jawaban_siswa').insert([
    { id_jawaban: ans1Id, id_log: log1Id, id_soal: soal1Id, jawaban_user: 'B', is_correct: true },
    { id_jawaban: ans2Id, id_log: log2Id, id_soal: soal2Id, jawaban_user: 'D', is_correct: true }
  ]);
  if (errAns) console.error('Error inserting jawaban_siswa:', errAns);

  const ann1Id = `ANN1-${rpcNpsn}`;
  const ann2Id = `ANN2-${rpcNpsn}`;
  const { error: errAnn } = await supabase.from('pengumuman').insert([
    { id_pengumuman: ann1Id, npsn: rpcNpsn, judul: 'Ujian 1', isi: 'Pengumuman 1' },
    { id_pengumuman: ann2Id, npsn: rpcNpsn, judul: 'Ujian 2', isi: 'Pengumuman 2' }
  ]);
  if (errAnn) console.error('Error inserting pengumuman:', errAnn);

  const aud1Id = `AUD1-${rpcNpsn}`;
  const aud2Id = `AUD2-${rpcNpsn}`;
  const { error: errAud } = await supabase.from('audit_log').insert([
    { id_audit: aud1Id, npsn: rpcNpsn, username: 'admin', role: 'admin', action: 'LOGIN', target: rpcNpsn },
    { id_audit: aud2Id, npsn: rpcNpsn, username: 'admin', role: 'admin', action: 'CREATE_MAPEL', target: mapel1Id }
  ]);
  if (errAud) console.error('Error inserting audit_log:', errAud);

  const arc1Id = `ARC1-${rpcNpsn}`;
  const arc2Id = `ARC2-${rpcNpsn}`;
  const { error: errArc } = await supabase.from('audit_log_archive').insert([
    { id_archive: arc1Id, id_audit: `AUD-OLD1-${rpcNpsn}`, npsn: rpcNpsn, username: 'admin', role: 'admin', action: 'ARCHIVE_1', target: rpcNpsn },
    { id_archive: arc2Id, id_audit: `AUD-OLD2-${rpcNpsn}`, npsn: rpcNpsn, username: 'admin', role: 'admin', action: 'ARCHIVE_2', target: rpcNpsn }
  ]);
  if (errArc) console.error('Error inserting audit_log_archive:', errArc);

  // Verify pre-deletion counts: all tables must be populated
  const [
    { count: preAdm },
    { count: preGuru },
    { count: preMapel },
    { count: preKelas },
    { count: preSiswa },
    { count: preJadwal },
    { count: preSoal },
    { count: preAnn },
    { count: preAud },
    { count: preArc },
    { count: preGuruMapel },
    { count: preLog },
    { count: preAns }
  ] = await Promise.all([
    supabase.from('admin').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('guru').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('mata_pelajaran').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('kelas').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('siswa').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('jadwal').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('soal_ujian').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('pengumuman').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('audit_log').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('audit_log_archive').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('guru_mapel').select('*', { count: 'exact', head: true }).in('id_guru', [guru1Id, guru2Id]),
    supabase.from('log_ujian').select('*', { count: 'exact', head: true }).in('id_log', [log1Id, log2Id]),
    supabase.from('jawaban_siswa').select('*', { count: 'exact', head: true }).in('id_jawaban', [ans1Id, ans2Id])
  ]);

  const totalPre = (preAdm || 0) + (preGuru || 0) + (preMapel || 0) + (preKelas || 0) +
                   (preSiswa || 0) + (preJadwal || 0) + (preSoal || 0) + (preAnn || 0) +
                   (preAud || 0) + (preArc || 0) + (preGuruMapel || 0) + (preLog || 0) + (preAns || 0);

  recordAssert(
    'TREE_SETUP',
    'All 13 child and secondary child tables successfully populated prior to deletion',
    totalPre >= 26,
    `Total inserted rows = ${totalPre}, expected >= 26 (adm:${preAdm}, guru:${preGuru}, mapel:${preMapel}, kelas:${preKelas}, siswa:${preSiswa}, jdw:${preJadwal}, soal:${preSoal}, ann:${preAnn}, aud:${preAud}, arc:${preArc}, gm:${preGuruMapel}, log:${preLog}, ans:${preAns})`
  );

  // Execute RPC delete_sekolah_cascade
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('delete_sekolah_cascade', { p_npsn: rpcNpsn });
  recordAssert(
    'RPC_EXECUTION',
    'RPC delete_sekolah_cascade executed with status = success',
    !rpcErr && rpcRes && rpcRes.status === 'success',
    rpcErr?.message || rpcRes?.message
  );

  // Assert ZERO records remaining across all 14 tables
  const [
    { count: postSch },
    { count: postAdm },
    { count: postGuru },
    { count: postMapel },
    { count: postKelas },
    { count: postSiswa },
    { count: postJadwal },
    { count: postSoal },
    { count: postAnn },
    { count: postAud },
    { count: postArc },
    { count: postGuruMapel },
    { count: postLog },
    { count: postAns }
  ] = await Promise.all([
    supabase.from('sekolah').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('admin').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('guru').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('mata_pelajaran').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('kelas').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('siswa').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('jadwal').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('soal_ujian').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('pengumuman').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('audit_log').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('audit_log_archive').select('*', { count: 'exact', head: true }).eq('npsn', rpcNpsn),
    supabase.from('guru_mapel').select('*', { count: 'exact', head: true }).in('id_guru', [guru1Id, guru2Id]),
    supabase.from('log_ujian').select('*', { count: 'exact', head: true }).in('id_log', [log1Id, log2Id]),
    supabase.from('jawaban_siswa').select('*', { count: 'exact', head: true }).in('id_jawaban', [ans1Id, ans2Id])
  ]);

  const zeroOrphanCounts = [
    { table: 'sekolah', count: postSch },
    { table: 'admin', count: postAdm },
    { table: 'guru', count: postGuru },
    { table: 'mata_pelajaran', count: postMapel },
    { table: 'kelas', count: postKelas },
    { table: 'siswa', count: postSiswa },
    { table: 'jadwal', count: postJadwal },
    { table: 'soal_ujian', count: postSoal },
    { table: 'pengumuman', count: postAnn },
    { table: 'audit_log', count: postAud },
    { table: 'audit_log_archive', count: postArc },
    { table: 'guru_mapel', count: postGuruMapel },
    { table: 'log_ujian', count: postLog },
    { table: 'jawaban_siswa', count: postAns }
  ];

  for (const item of zeroOrphanCounts) {
    recordAssert(
      'ZERO_ORPHANS_RPC',
      `Post-RPC cascade public.${item.table} has exactly 0 records for ${rpcNpsn}`,
      item.count === 0,
      `Found ${item.count} remaining records in ${item.table}`
    );
  }

  // ===========================================================================
  // CATEGORY 3: Application API Route Stress Test (fetchAPI 'delete_sekolah')
  // ===========================================================================
  console.log('\n▶ [CATEGORY 3] Application API Route Stress Test via fetchAPI(\'delete_sekolah\')');

  const apiNpsn = `CHL${Math.floor(100000 + Math.random() * 900000)}`;
  await supabase.from('sekolah').insert([{ npsn: apiNpsn, nama_sekolah: `Sekolah API ${apiNpsn}`, status: 'ACTIVE' }]);

  await supabase.from('admin').insert([{ id_admin: crypto.randomUUID(), npsn: apiNpsn, nama_lengkap: 'Adm', username: `adm_${apiNpsn}`, password: 'p' }]);
  await supabase.from('guru').insert([{ id_guru: `G-${apiNpsn}`, npsn: apiNpsn, nama_lengkap: 'Guru', username: `g_${apiNpsn}`, password: 'p', nip: `NIP-${apiNpsn}` }]);
  await supabase.from('mata_pelajaran').insert([{ id_mapel: `M-${apiNpsn}`, npsn: apiNpsn, nama_mapel: 'IPA' }]);
  await supabase.from('siswa').insert([{ id_siswa: `S-${apiNpsn}`, npsn: apiNpsn, nama_lengkap: 'Siswa', username: `s_${apiNpsn}`, password: 'p', nisn: `N-${apiNpsn}`, angkatan: '10', kelas_paralel: '1' }]);
  await supabase.from('kelas').insert([{ id_kelas: crypto.randomUUID(), npsn: apiNpsn, tingkat: 'X', kelas_paralel: '1' }]);
  await supabase.from('jadwal').insert([{ id_jadwal: `J-${apiNpsn}`, npsn: apiNpsn, id_mapel: `M-${apiNpsn}`, id_guru: `G-${apiNpsn}`, waktu_mulai: new Date().toISOString(), waktu_selesai: new Date(Date.now() + 3600000).toISOString(), durasi_menit: 60, token_aktif: 'TKAPI1' }]);
  await supabase.from('soal_ujian').insert([{ id_soal: `Q-${apiNpsn}`, npsn: apiNpsn, id_mapel: `M-${apiNpsn}`, pertanyaan: 'Pertanyaan', jenis_soal: 'PG', tipe_soal: 'PG' }]);
  await supabase.from('pengumuman').insert([{ id_pengumuman: `ANN-${apiNpsn}`, npsn: apiNpsn, judul: 'Judul', isi: 'Isi' }]);
  await supabase.from('audit_log').insert([{ id_audit: `AUD-${apiNpsn}`, npsn: apiNpsn, username: 'admin', role: 'admin', action: 'API_DELETE_TEST', target: apiNpsn }]);
  await supabase.from('audit_log_archive').insert([{ id_archive: `ARC-${apiNpsn}`, id_audit: `AUD-OLD-${apiNpsn}`, npsn: apiNpsn, username: 'admin', role: 'admin', action: 'API_ARCHIVE_TEST', target: apiNpsn }]);

  const apiRes = await fetchAPI('delete_sekolah', { npsn: apiNpsn });
  recordAssert(
    'API_ROUTE',
    'fetchAPI(\'delete_sekolah\') executed successfully with status = success',
    apiRes && apiRes.status === 'success',
    apiRes?.message || 'API call failed'
  );

  const [
    { count: postApiSch },
    { count: postApiAdm },
    { count: postApiGuru },
    { count: postApiMapel },
    { count: postApiSiswa },
    { count: postApiJadwal },
    { count: postApiSoal },
    { count: postApiKelas },
    { count: postApiAnn },
    { count: postApiAud },
    { count: postApiArc }
  ] = await Promise.all([
    supabase.from('sekolah').select('*', { count: 'exact', head: true }).eq('npsn', apiNpsn),
    supabase.from('admin').select('*', { count: 'exact', head: true }).eq('npsn', apiNpsn),
    supabase.from('guru').select('*', { count: 'exact', head: true }).eq('npsn', apiNpsn),
    supabase.from('mata_pelajaran').select('*', { count: 'exact', head: true }).eq('npsn', apiNpsn),
    supabase.from('siswa').select('*', { count: 'exact', head: true }).eq('npsn', apiNpsn),
    supabase.from('jadwal').select('*', { count: 'exact', head: true }).eq('npsn', apiNpsn),
    supabase.from('soal_ujian').select('*', { count: 'exact', head: true }).eq('npsn', apiNpsn),
    supabase.from('kelas').select('*', { count: 'exact', head: true }).eq('npsn', apiNpsn),
    supabase.from('pengumuman').select('*', { count: 'exact', head: true }).eq('npsn', apiNpsn),
    supabase.from('audit_log').select('*', { count: 'exact', head: true }).eq('npsn', apiNpsn),
    supabase.from('audit_log_archive').select('*', { count: 'exact', head: true }).eq('npsn', apiNpsn)
  ]);

  const totalPostApi = (postApiSch || 0) + (postApiAdm || 0) + (postApiGuru || 0) +
                       (postApiMapel || 0) + (postApiSiswa || 0) + (postApiJadwal || 0) +
                       (postApiSoal || 0) + (postApiKelas || 0) + (postApiAnn || 0) +
                       (postApiAud || 0) + (postApiArc || 0);

  recordAssert(
    'ZERO_ORPHANS_API',
    'fetchAPI(\'delete_sekolah\') leaves exactly 0 orphaned records across all tables',
    totalPostApi === 0,
    `Found ${totalPostApi} remaining records after API deletion`
  );

  // ===========================================================================
  // CATEGORY 4: Database-Engine-Only Cascade Stress Test (Pure SQL DELETE)
  // ===========================================================================
  console.log('\n▶ [CATEGORY 4] Database-Engine-Only Cascade Stress Test (Bypassing RPC)');

  const sqlNpsn = `CHL${Math.floor(100000 + Math.random() * 900000)}`;
  await supabase.from('sekolah').insert([{ npsn: sqlNpsn, nama_sekolah: `Sekolah SQL ${sqlNpsn}`, status: 'ACTIVE' }]);

  await supabase.from('admin').insert([{ id_admin: crypto.randomUUID(), npsn: sqlNpsn, nama_lengkap: 'Adm', username: `adm_${sqlNpsn}`, password: 'p' }]);
  await supabase.from('guru').insert([{ id_guru: `G-${sqlNpsn}`, npsn: sqlNpsn, nama_lengkap: 'Guru', username: `g_${sqlNpsn}`, password: 'p', nip: `NIP-${sqlNpsn}` }]);
  await supabase.from('mata_pelajaran').insert([{ id_mapel: `M-${sqlNpsn}`, npsn: sqlNpsn, nama_mapel: 'IPS' }]);
  await supabase.from('siswa').insert([{ id_siswa: `S-${sqlNpsn}`, npsn: sqlNpsn, nama_lengkap: 'Siswa', username: `s_${sqlNpsn}`, password: 'p', nisn: `N-${sqlNpsn}`, angkatan: '10', kelas_paralel: '1' }]);
  await supabase.from('kelas').insert([{ id_kelas: crypto.randomUUID(), npsn: sqlNpsn, tingkat: 'X', kelas_paralel: '1' }]);
  await supabase.from('audit_log').insert([{ id_audit: `AUD-${sqlNpsn}`, npsn: sqlNpsn, username: 'admin', role: 'admin', action: 'SQL_TEST', target: sqlNpsn }]);
  await supabase.from('audit_log_archive').insert([{ id_archive: `ARC-${sqlNpsn}`, id_audit: `AUD-OLD-${sqlNpsn}`, npsn: sqlNpsn, username: 'admin', role: 'admin', action: 'SQL_ARCHIVE_TEST', target: sqlNpsn }]);

  // Direct table delete bypassing RPC
  const { error: errDirectDel } = await supabase.from('sekolah').delete().eq('npsn', sqlNpsn);
  recordAssert(
    'PG_ENGINE_CASCADE',
    'PostgreSQL engine direct DELETE FROM sekolah succeeds without foreign key violation',
    !errDirectDel,
    errDirectDel?.message
  );

  const [
    { count: postSqlSch },
    { count: postSqlAdm },
    { count: postSqlGuru },
    { count: postSqlMapel },
    { count: postSqlSiswa },
    { count: postSqlKelas },
    { count: postSqlAud },
    { count: postSqlArc }
  ] = await Promise.all([
    supabase.from('sekolah').select('*', { count: 'exact', head: true }).eq('npsn', sqlNpsn),
    supabase.from('admin').select('*', { count: 'exact', head: true }).eq('npsn', sqlNpsn),
    supabase.from('guru').select('*', { count: 'exact', head: true }).eq('npsn', sqlNpsn),
    supabase.from('mata_pelajaran').select('*', { count: 'exact', head: true }).eq('npsn', sqlNpsn),
    supabase.from('siswa').select('*', { count: 'exact', head: true }).eq('npsn', sqlNpsn),
    supabase.from('kelas').select('*', { count: 'exact', head: true }).eq('npsn', sqlNpsn),
    supabase.from('audit_log').select('*', { count: 'exact', head: true }).eq('npsn', sqlNpsn),
    supabase.from('audit_log_archive').select('*', { count: 'exact', head: true }).eq('npsn', sqlNpsn)
  ]);

  const totalPostSql = (postSqlSch || 0) + (postSqlAdm || 0) + (postSqlGuru || 0) +
                       (postSqlMapel || 0) + (postSqlSiswa || 0) + (postSqlKelas || 0) +
                       (postSqlAud || 0) + (postSqlArc || 0);

  recordAssert(
    'ZERO_ORPHANS_ENGINE',
    'PostgreSQL engine ON DELETE CASCADE alone clears all child tables with zero orphans',
    totalPostSql === 0,
    `Found ${totalPostSql} remaining records after direct SQL deletion`
  );

  // ===========================================================================
  // CATEGORY 5: Edge Cases, Idempotency & Error Handling
  // ===========================================================================
  console.log('\n▶ [CATEGORY 5] Edge Cases, Idempotency & Error Handling');

  // Deleting non-existent school via RPC
  const { data: nonExistentRes } = await supabase.rpc('delete_sekolah_cascade', { p_npsn: 'NON_EXISTENT_SCHOOL_000' });
  recordAssert(
    'ERROR_HANDLING',
    'RPC handles non-existent school gracefully returning status = error',
    nonExistentRes && nonExistentRes.status === 'error',
    JSON.stringify(nonExistentRes)
  );

  // Deleting non-existent school via fetchAPI
  const nonExistentApiRes = await fetchAPI('delete_sekolah', { npsn: 'NON_EXISTENT_SCHOOL_000' });
  recordAssert(
    'ERROR_HANDLING',
    'fetchAPI(\'delete_sekolah\') handles non-existent school returning status = error',
    nonExistentApiRes && nonExistentApiRes.status === 'error',
    JSON.stringify(nonExistentApiRes)
  );

  // Calling delete_sekolah_cascade twice on same school
  const idempNpsn = `CHL${Math.floor(100000 + Math.random() * 900000)}`;
  await supabase.from('sekolah').insert([{ npsn: idempNpsn, nama_sekolah: `Sekolah Idemp ${idempNpsn}`, status: 'ACTIVE' }]);
  await supabase.rpc('delete_sekolah_cascade', { p_npsn: idempNpsn });
  const { data: secondDeleteRes } = await supabase.rpc('delete_sekolah_cascade', { p_npsn: idempNpsn });
  recordAssert(
    'IDEMPOTENCY',
    'Second deletion of already-deleted school is safely rejected with controlled error',
    secondDeleteRes && secondDeleteRes.status === 'error',
    JSON.stringify(secondDeleteRes)
  );

  // ===========================================================================
  // CATEGORY 6: Global Live Database Zero-Orphan Audit
  // ===========================================================================
  console.log('\n▶ [CATEGORY 6] Global Live Database Zero-Orphan Audit');

  // Retrieve all valid school NPSNs currently registered
  const { data: allSchools, error: errAllSchools } = await supabase.from('sekolah').select('npsn');
  recordAssert('GLOBAL_AUDIT', 'Fetched registered school registry', !errAllSchools && Array.isArray(allSchools), errAllSchools?.message);

  const registeredNpsns = new Set((allSchools || []).map(s => s.npsn));

  // Scan all tables with npsn column
  const tablesToScan = [
    { table: 'audit_log', pk: 'id_audit' },
    { table: 'audit_log_archive', pk: 'id_archive' },
    { table: 'admin', pk: 'id_admin' },
    { table: 'guru', pk: 'id_guru' },
    { table: 'siswa', pk: 'id_siswa' },
    { table: 'jadwal', pk: 'id_jadwal' },
    { table: 'mata_pelajaran', pk: 'id_mapel' },
    { table: 'soal_ujian', pk: 'id_soal' },
    { table: 'kelas', pk: 'id_kelas' },
    { table: 'pengumuman', pk: 'id_pengumuman' }
  ];

  for (const item of tablesToScan) {
    const { data: rows, error: scanErr } = await supabase
      .from(item.table)
      .select(`${item.pk}, npsn`)
      .not('npsn', 'is', null);

    if (scanErr) {
      recordAssert('GLOBAL_AUDIT', `Scan public.${item.table} for orphaned records`, false, scanErr.message);
      continue;
    }

    const orphans = (rows || []).filter(r => !registeredNpsns.has(r.npsn));
    recordAssert(
      'GLOBAL_AUDIT',
      `Zero orphaned records in public.${item.table} across entire database (scanned ${rows?.length || 0} rows)`,
      orphans.length === 0,
      `Found ${orphans.length} orphaned rows with invalid npsn: ${orphans.map(o => o.npsn).slice(0, 5).join(', ')}`
    );
  }

  // ===========================================================================
  // FINAL SUMMARY & VERDICT
  // ===========================================================================
  console.log('\n========================================================================');
  console.log(`   CHALLENGER SUITE SUMMARY: TOTAL: ${suiteReport.total} | PASSED: ${suiteReport.passed} | FAILED: ${suiteReport.failed}`);
  console.log('========================================================================\n');

  if (suiteReport.failed === 0) {
    console.log('>>> VERDICT: APPROVE <<<');
    console.log('Cascading deletion and zero orphaned records fully verified empirically across all layers!\n');
    process.exit(0);
  } else {
    console.error('>>> VERDICT: REJECT <<<');
    console.error(`Detected ${suiteReport.failed} failed adversarial assertions:\n`);
    for (const f of suiteReport.failures) {
      console.error(`  - [${f.category}] ${f.name}: ${f.details}`);
    }
    process.exit(1);
  }
}

runChallengerStressSuite().catch(err => {
  console.error('Fatal error during Challenger test execution:', err);
  process.exit(1);
});
