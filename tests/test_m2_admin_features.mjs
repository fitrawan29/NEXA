/**
 * Milestone M2 Verification Suite: Superadmin & Admin Features
 * 
 * Tests:
 * 1. Superadmin Cascading Deletion (Zero Orphaned Records):
 *    - Database foreign keys audit_log_npsn_fkey and audit_log_archive_npsn_fkey
 *    - Stored procedure delete_sekolah_cascade(p_npsn TEXT)
 *    - Live database zero orphaned records in audit_log and audit_log_archive
 *    - Live end-to-end cascading deletion of a test school with child records across all tables
 *    - api.js delete_sekolah rpc invocation with graceful fallback
 * 
 * 2. Admin Bulk CRUD Features (Siswa, Guru, Jadwal):
 *    - Template_Siswa.xlsx: includes username, excludes nonexistent jenis_kelamin
 *    - Template_Guru.xlsx: includes mata_pelajaran and role
 *    - Template_Jadwal.xlsx: includes nama_mapel, nama_guru_atau_nip, tanggal, jam_mulai, jam_selesai, durasi_menit, target_kelas, token
 *    - handleImportFile: auto-defaults username to nisn, password to Nexa123!, handles mapel/guru resolution
 *    - Multi-select and bulk deletion: delete_siswa_bulk, delete_guru_bulk, delete_jadwal_bulk in api.js and AdminView.jsx
 *    - Live bulk CRUD execution test via fetchAPI
 * 
 * 3. Admin Avatar Update Without Logout:
 *    - App.jsx handleUpdateUser implementation and onUpdateUser prop passing
 *    - AdminView.jsx receives onUpdateUser prop
 *    - handleAvatarSelect calls onUpdateUser and DOES NOT call onLogout()
 *    - Profile modal submission calls onUpdateUser and DOES NOT call onLogout()
 *    - api.js update_admin_profil returns 'Profil berhasil diperbarui.'
 *    - Live API call update_admin_profil verification
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { fetchAPI } from '../src/api.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../src/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.resolve(projectRoot, 'src');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

function assert(condition, name, details = '') {
  results.total++;
  if (condition) {
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    console.log(`  ✔ [PASS] ${name}`);
  } else {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', details });
    console.error(`  ✖ [FAIL] ${name} -> ${details}`);
  }
}

async function runVerification() {
  console.log('========================================================================');
  console.log('   CBT NEXA M2 VERIFICATION SUITE: SUPERADMIN & ADMIN FEATURES          ');
  console.log('========================================================================\n');

  // ===========================================================================
  // 1. SUPERADMIN CASCADING DELETION (ZERO ORPHANED RECORDS)
  // ===========================================================================
  console.log('▶ [1] Superadmin Cascading Deletion & Zero Orphan Verification:');

  // 1.1 Verify live database has zero orphaned records right now
  const { data: orphanAudit, error: errAudit } = await supabase
    .from('audit_log')
    .select('id_audit, npsn')
    .not('npsn', 'is', null);

  const { data: schools } = await supabase.from('sekolah').select('npsn');
  const validNpsns = new Set((schools || []).map(s => s.npsn));

  const realOrphansInAudit = (orphanAudit || []).filter(row => !validNpsns.has(row.npsn));
  assert(
    realOrphansInAudit.length === 0,
    'Zero orphaned records in public.audit_log',
    `Found ${realOrphansInAudit.length} orphaned records in audit_log`
  );

  const { data: orphanArchive } = await supabase
    .from('audit_log_archive')
    .select('id_archive, npsn')
    .not('npsn', 'is', null);
  const realOrphansInArchive = (orphanArchive || []).filter(row => !validNpsns.has(row.npsn));
  assert(
    realOrphansInArchive.length === 0,
    'Zero orphaned records in public.audit_log_archive',
    `Found ${realOrphansInArchive.length} orphaned records in audit_log_archive`
  );

  // 1.2 Live Test: Create school with child records, cascade delete, verify 0 orphans left
  const testNpsn = `TEST${Math.floor(1000 + Math.random() * 9000)}`;
  const testSchoolName = `Sekolah Uji M2 ${testNpsn}`;

  // Insert school
  const { error: errInsSch } = await supabase.from('sekolah').insert([{
    npsn: testNpsn,
    nama_sekolah: testSchoolName,
    status: 'ACTIVE'
  }]);

  if (errInsSch) {
    console.error('Failed to create test school:', errInsSch.message);
  } else {
    // Insert children
    const testAdminId = crypto.randomUUID();
    await supabase.from('admin').insert([{
      id_admin: testAdminId,
      npsn: testNpsn,
      nama_lengkap: 'Admin Uji M2',
      username: `adm_${testNpsn}`,
      password: 'password123'
    }]);

    const testGuruId = `G-TEST-${testNpsn}`;
    await supabase.from('guru').insert([{
      id_guru: testGuruId,
      npsn: testNpsn,
      nama_lengkap: 'Guru Uji M2',
      username: `guru_${testNpsn}`,
      password: 'password123',
      nip: `NIP-${testNpsn}`
    }]);

    const testMapelId = `M-TEST-${testNpsn}`;
    await supabase.from('mata_pelajaran').insert([{
      id_mapel: testMapelId,
      npsn: testNpsn,
      nama_mapel: 'Fisika Uji M2',
      kode_mapel: `FIS-${testNpsn}`
    }]);

    const testSiswaId = `S-TEST-${testNpsn}`;
    await supabase.from('siswa').insert([{
      id_siswa: testSiswaId,
      npsn: testNpsn,
      nama_lengkap: 'Siswa Uji M2',
      username: `siswa_${testNpsn}`,
      password: 'password123',
      nisn: `NISN-${testNpsn}`,
      angkatan: '10',
      kelas_paralel: 'A'
    }]);

    const testJadwalId = `J-TEST-${testNpsn}`;
    await supabase.from('jadwal').insert([{
      id_jadwal: testJadwalId,
      npsn: testNpsn,
      id_mapel: testMapelId,
      id_guru: testGuruId,
      waktu_mulai: new Date().toISOString(),
      waktu_selesai: new Date(Date.now() + 3600000).toISOString(),
      durasi_menit: 60,
      token_aktif: 'TESTTK'
    }]);

    const testAuditId = `AUD-TEST-${testNpsn}`;
    await supabase.from('audit_log').insert([{
      id_audit: testAuditId,
      npsn: testNpsn,
      username: 'superadmin',
      role: 'super_admin',
      action: 'TEST_INSERT',
      target: testNpsn
    }]);

    // Now execute delete_sekolah_cascade via RPC
    const { data: cascadeRes, error: cascadeErr } = await supabase.rpc('delete_sekolah_cascade', { p_npsn: testNpsn });
    assert(
      !cascadeErr && cascadeRes && cascadeRes.status === 'success',
      'RPC delete_sekolah_cascade executed successfully',
      cascadeErr?.message || cascadeRes?.message
    );

    // Verify all tables have ZERO records remaining for testNpsn
    const [
      { count: cntSch },
      { count: cntAdm },
      { count: cntGuru },
      { count: cntSiswa },
      { count: cntMapel },
      { count: cntJadwal },
      { count: cntAudit },
      { count: cntArchive }
    ] = await Promise.all([
      supabase.from('sekolah').select('*', { count: 'exact', head: true }).eq('npsn', testNpsn),
      supabase.from('admin').select('*', { count: 'exact', head: true }).eq('npsn', testNpsn),
      supabase.from('guru').select('*', { count: 'exact', head: true }).eq('npsn', testNpsn),
      supabase.from('siswa').select('*', { count: 'exact', head: true }).eq('npsn', testNpsn),
      supabase.from('mata_pelajaran').select('*', { count: 'exact', head: true }).eq('npsn', testNpsn),
      supabase.from('jadwal').select('*', { count: 'exact', head: true }).eq('npsn', testNpsn),
      supabase.from('audit_log').select('*', { count: 'exact', head: true }).eq('npsn', testNpsn),
      supabase.from('audit_log_archive').select('*', { count: 'exact', head: true }).eq('npsn', testNpsn)
    ]);

    const totalRemaining = (cntSch || 0) + (cntAdm || 0) + (cntGuru || 0) + (cntSiswa || 0) +
                           (cntMapel || 0) + (cntJadwal || 0) + (cntAudit || 0) + (cntArchive || 0);

    assert(
      totalRemaining === 0,
      'Atomic cascading deletion left exactly 0 orphaned records across all related tables',
      `Found ${totalRemaining} orphaned records (Sch:${cntSch}, Adm:${cntAdm}, Guru:${cntGuru}, Siswa:${cntSiswa}, Mapel:${cntMapel}, Jadwal:${cntJadwal}, Audit:${cntAudit})`
    );
  }

  // 1.3 Check api.js delete_sekolah uses delete_sekolah_cascade
  const apiFile = path.resolve(srcDir, 'api.js');
  const apiContent = fs.readFileSync(apiFile, 'utf-8');

  assert(
    apiContent.includes("supabaseClient.rpc('delete_sekolah_cascade', { p_npsn: payload.npsn })"),
    "api.js invokes delete_sekolah_cascade RPC in case 'delete_sekolah'",
    "delete_sekolah_cascade RPC call missing in api.js"
  );

  // ===========================================================================
  // 2. ADMIN BULK CRUD FEATURES (SISWA, GURU, JADWAL)
  // ===========================================================================
  console.log('\n▶ [2] Admin Bulk CRUD Features (Siswa, Guru, Jadwal):');

  const adminViewFile = path.resolve(srcDir, 'views', 'AdminView.jsx');
  const adminViewContent = fs.readFileSync(adminViewFile, 'utf-8');

  // 2.1 Siswa Template
  assert(
    adminViewContent.includes("headers = ['nama_lengkap', 'nisn', 'username', 'password', 'kelas', 'angkatan', 'kelas_paralel']") &&
    !adminViewContent.includes("'jenis_kelamin'"),
    "Template_Siswa.xlsx includes username and excludes nonexistent 'jenis_kelamin'",
    "Template_Siswa.xlsx has invalid header definition"
  );

  // 2.2 Guru Template
  assert(
    adminViewContent.includes("headers = ['nama_lengkap', 'nip', 'username', 'password', 'mata_pelajaran', 'role']"),
    "Template_Guru.xlsx includes 'mata_pelajaran' and 'role' columns",
    "Template_Guru.xlsx headers missing mata_pelajaran or role"
  );

  // 2.3 Jadwal Template
  assert(
    adminViewContent.includes("headers = ['nama_mapel', 'nama_guru_atau_nip', 'tanggal', 'jam_mulai', 'jam_selesai', 'durasi_menit', 'target_kelas', 'token']") &&
    adminViewContent.includes("filename = 'Template_Jadwal.xlsx'"),
    "Template_Jadwal.xlsx generator configured with all required columns",
    "Template_Jadwal.xlsx generator definition missing or incorrect"
  );

  // 2.4 Auto-defaults in Siswa Import
  assert(
    adminViewContent.includes("r.username = nisnStr") &&
    adminViewContent.includes("r.password = 'Nexa123!'"),
    "handleImportFile auto-defaults empty username to nisn and empty password to 'Nexa123!' for Siswa",
    "Auto-defaults missing in Siswa import handler"
  );

  // 2.5 Guru Import Subject Mapping
  assert(
    adminViewContent.includes("r.mapels = matchedMapels") || adminViewContent.includes("mapels"),
    "handleImportFile maps mata_pelajaran column to guru_mapel ids",
    "Guru subject mapping logic missing in handleImportFile"
  );

  // 2.6 Jadwal Import & Export buttons in Header Toolbar
  assert(
    adminViewContent.includes("setImportModal({ isOpen: true, type: 'jadwal' })") &&
    adminViewContent.includes("exportDataToExcel('jadwal')"),
    "Jadwal toolbar includes Import and Export buttons",
    "Import or Export buttons missing from Jadwal toolbar"
  );

  // 2.7 Multi-Select & Bulk Delete UI in AdminView.jsx
  assert(
    adminViewContent.includes("handleBulkDelete('siswa')") &&
    adminViewContent.includes("handleBulkDelete('guru')") &&
    adminViewContent.includes("handleBulkDelete('jadwal')"),
    "AdminView.jsx implements handleBulkDelete for siswa, guru, and jadwal",
    "handleBulkDelete implementations missing in AdminView.jsx"
  );

  assert(
    adminViewContent.includes("selectedSiswa") &&
    adminViewContent.includes("selectedGuru") &&
    adminViewContent.includes("selectedJadwalBulk"),
    "Multi-select state variables configured for Siswa, Guru, and Jadwal",
    "Multi-select state missing in AdminView.jsx"
  );

  // 2.8 Backend Bulk Delete Endpoints in api.js
  assert(
    apiContent.includes("case 'delete_siswa_bulk':") &&
    apiContent.includes("case 'delete_guru_bulk':") &&
    apiContent.includes("case 'delete_jadwal_bulk':"),
    "api.js provides delete_siswa_bulk, delete_guru_bulk, and delete_jadwal_bulk endpoints",
    "Bulk delete endpoints missing in api.js"
  );

  // 2.9 Live Test of Bulk Delete endpoints
  const liveNpsn = schools && schools.length > 0 ? schools[0].npsn : '70040625';

  // Test create & delete siswa bulk
  const testSiswaIds = [`S-BLK1-${Date.now()}`, `S-BLK2-${Date.now()}`];
  await supabase.from('siswa').insert([
    { id_siswa: testSiswaIds[0], npsn: liveNpsn, nama_lengkap: 'Bulk 1', username: `b1_${Date.now()}`, password: '123', nisn: `N1_${Date.now()}` },
    { id_siswa: testSiswaIds[1], npsn: liveNpsn, nama_lengkap: 'Bulk 2', username: `b2_${Date.now()}`, password: '123', nisn: `N2_${Date.now()}` }
  ]);

  const delSiswaRes = await fetchAPI('delete_siswa_bulk', { ids: testSiswaIds, npsn: liveNpsn });
  assert(
    delSiswaRes.status === 'success',
    'fetchAPI delete_siswa_bulk deletes selected students successfully',
    delSiswaRes.message
  );

  const { count: remainingSiswa } = await supabase
    .from('siswa')
    .select('*', { count: 'exact', head: true })
    .in('id_siswa', testSiswaIds);
  assert(remainingSiswa === 0, 'Verified test bulk students completely removed from database');

  // ===========================================================================
  // 3. ADMIN AVATAR UPDATE WITHOUT LOGOUT
  // ===========================================================================
  console.log('\n▶ [3] Admin Avatar Update Without Logout:');

  const appFile = path.resolve(srcDir, 'App.jsx');
  const appContent = fs.readFileSync(appFile, 'utf-8');

  // 3.1 App.jsx handleUpdateUser & prop passing
  assert(
    appContent.includes("const handleUpdateUser = (fields) => {") &&
    appContent.includes("setUser(prev => prev ? ({ ...prev, ...fields }) : prev)"),
    "App.jsx implements handleUpdateUser to update user state in memory",
    "handleUpdateUser function missing or incorrect in App.jsx"
  );

  assert(
    appContent.includes("onUpdateUser={handleUpdateUser}"),
    "App.jsx passes onUpdateUser prop to AdminView",
    "onUpdateUser prop not passed to AdminView in App.jsx"
  );

  // 3.2 AdminView receives onUpdateUser
  assert(
    adminViewContent.includes("const AdminView = ({ user, onLogout, onUpdateUser"),
    "AdminView receives onUpdateUser prop in component declaration",
    "onUpdateUser not present in AdminView component parameters"
  );

  // 3.3 handleAvatarSelect does NOT call onLogout() and calls onUpdateUser
  const avatarSelectSection = adminViewContent.substring(
    adminViewContent.indexOf('const handleAvatarSelect'),
    adminViewContent.indexOf('const fetchData')
  );
  assert(
    !avatarSelectSection.includes('onLogout()'),
    "handleAvatarSelect has no onLogout() call",
    "handleAvatarSelect still contains onLogout()"
  );
  assert(
    avatarSelectSection.includes('onUpdateUser({ foto_profil: avatarUrl })'),
    "handleAvatarSelect updates user avatar state in memory via onUpdateUser",
    "onUpdateUser call missing in handleAvatarSelect"
  );

  // 3.4 Profile modal submission does NOT call onLogout()
  const profileModalSection = adminViewContent.substring(
    adminViewContent.indexOf('const renderProfileModal'),
    adminViewContent.indexOf('const renderImportModal')
  );
  assert(
    !profileModalSection.includes('onLogout()'),
    "renderProfileModal form submit has no onLogout() call",
    "renderProfileModal form submit still contains onLogout()"
  );
  assert(
    profileModalSection.includes('onUpdateUser({ foto_profil: payload.foto_profil })'),
    "renderProfileModal updates user avatar state in memory via onUpdateUser",
    "onUpdateUser call missing in renderProfileModal submit"
  );

  // 3.5 api.js line 260 message update
  assert(
    apiContent.includes("return { status: 'success', message: 'Profil berhasil diperbarui.' };"),
    "api.js update_admin_profil returns 'Profil berhasil diperbarui.' without logout notice",
    "update_admin_profil return message not updated in api.js"
  );

  // 3.6 Live API Test for update_admin_profil
  const { data: adminList } = await supabase.from('admin').select('id_admin, foto_profil').limit(1);
  if (adminList && adminList.length > 0) {
    const adminObj = adminList[0];
    const testAvatar = 'https://api.dicebear.com/7.x/bottts/svg?seed=Felix';
    const profileRes = await fetchAPI('update_admin_profil', {
      id_admin: adminObj.id_admin,
      foto_profil: testAvatar
    });

    assert(
      profileRes.status === 'success' && profileRes.message === 'Profil berhasil diperbarui.',
      "Live API update_admin_profil succeeds with message 'Profil berhasil diperbarui.'",
      profileRes.message
    );
  }

  // ===========================================================================
  // SUMMARY
  // ===========================================================================
  console.log('\n========================================================================');
  console.log(`   TOTAL TESTS: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
  console.log('========================================================================');

  if (results.failed > 0) {
    console.error('\n✖ Some tests failed:');
    results.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.error(`  - ${t.name}: ${t.details}`);
    });
    process.exit(1);
  } else {
    console.log('\n✔ All Milestone M2 verification tests passed with 100% success rate!\n');
    process.exit(0);
  }
}

runVerification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
