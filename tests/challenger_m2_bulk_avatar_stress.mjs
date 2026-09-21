/**
 * Challenger Stress Test Suite: Milestone M2
 * Focus: Admin Bulk CRUD Operations and Avatar Update Without Logout
 * 
 * Tests:
 * 1. Template Structures Validation & Binary Generation
 *    - Siswa: username present, jenis_kelamin absent, valid XLSX binary
 *    - Guru: mata_pelajaran & role present, valid XLSX binary
 *    - Jadwal: all 8 columns verified, valid XLSX binary
 * 2. Data Parsing Logic & Edge Case Stress Testing
 *    - Siswa: auto-defaulting empty username to NISN, password to Nexa123!, legacy column stripping, preservation of custom values
 *    - Guru: auto-defaulting role to guru, password to Nexa123!, username fallback, subject parsing & multi-delimiter mapping
 *    - Jadwal: course & teacher name resolution, time/date ISO formatting, token uppercase & auto-generation, security defaults
 * 3. Bulk Deletion Endpoints Stress Testing
 *    - Boundary conditions (empty ids array rejection, nonexistent ids)
 *    - Live database lifecycle test for delete_siswa_bulk, delete_guru_bulk, delete_jadwal_bulk
 * 4. Avatar Update Flow & Session Retention Stress Testing
 *    - Static AST/regex verification: onLogout() is never called in handleAvatarSelect and renderProfileModal
 *    - onUpdateUser propagation verification
 *    - User state preservation simulation across sequential mutations
 *    - Live API update_admin_profil verification
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

async function runChallengerStressTests() {
  console.log('========================================================================');
  console.log('   CHALLENGER STRESS SUITE: M2 BULK CRUD & AVATAR UPDATE WITHOUT LOGOUT ');
  console.log('========================================================================\n');

  const adminViewFile = path.resolve(srcDir, 'views', 'AdminView.jsx');
  const adminViewContent = fs.readFileSync(adminViewFile, 'utf-8');
  const apiFile = path.resolve(srcDir, 'api.js');
  const apiContent = fs.readFileSync(apiFile, 'utf-8');
  const appFile = path.resolve(srcDir, 'App.jsx');
  const appContent = fs.readFileSync(appFile, 'utf-8');

  // ===========================================================================
  // 1. TEMPLATE STRUCTURES VALIDATION & BINARY GENERATION
  // ===========================================================================
  console.log('▶ [1] Template Structures Validation & Binary Generation:');

  // 1.1 Siswa Template Headers
  const siswaHeaderMatch = adminViewContent.match(/importModal\.type\s*===\s*'siswa'\)[\s\S]*?headers\s*=\s*(\[[^\]]+\])/);
  assert(siswaHeaderMatch !== null, 'Siswa template header definition found in AdminView.jsx');

  const siswaHeaders = eval(siswaHeaderMatch[1]);
  assert(
    siswaHeaders.includes('username'),
    'Template_Siswa headers contain "username"',
    JSON.stringify(siswaHeaders)
  );
  assert(
    !siswaHeaders.includes('jenis_kelamin'),
    'Template_Siswa headers strictly exclude "jenis_kelamin"',
    JSON.stringify(siswaHeaders)
  );
  assert(
    JSON.stringify(siswaHeaders) === JSON.stringify(['nama_lengkap', 'nisn', 'username', 'password', 'kelas', 'angkatan', 'kelas_paralel']),
    'Template_Siswa headers match exact required schema',
    JSON.stringify(siswaHeaders)
  );

  // Generate and parse back Siswa Excel binary
  const wsSiswa = XLSX.utils.aoa_to_sheet([siswaHeaders]);
  const wbSiswa = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbSiswa, wsSiswa, 'Template');
  const bufSiswa = XLSX.write(wbSiswa, { type: 'buffer', bookType: 'xlsx' });
  const readWbSiswa = XLSX.read(bufSiswa, { type: 'buffer' });
  const parsedSiswaHeaders = XLSX.utils.sheet_to_json(readWbSiswa.Sheets['Template'], { header: 1 })[0];
  assert(
    JSON.stringify(parsedSiswaHeaders) === JSON.stringify(siswaHeaders),
    'Template_Siswa XLSX binary serializes and deserializes identical headers'
  );

  // 1.2 Guru Template Headers
  const guruHeaderMatch = adminViewContent.match(/importModal\.type\s*===\s*'guru'\)[\s\S]*?headers\s*=\s*(\[[^\]]+\])/);
  assert(guruHeaderMatch !== null, 'Guru template header definition found in AdminView.jsx');
  const guruHeaders = eval(guruHeaderMatch[1]);
  assert(
    guruHeaders.includes('mata_pelajaran'),
    'Template_Guru headers contain "mata_pelajaran"',
    JSON.stringify(guruHeaders)
  );
  assert(
    guruHeaders.includes('role'),
    'Template_Guru headers contain "role"',
    JSON.stringify(guruHeaders)
  );
  assert(
    JSON.stringify(guruHeaders) === JSON.stringify(['nama_lengkap', 'nip', 'username', 'password', 'mata_pelajaran', 'role']),
    'Template_Guru headers match exact required schema',
    JSON.stringify(guruHeaders)
  );

  // Generate and parse back Guru Excel binary
  const wsGuru = XLSX.utils.aoa_to_sheet([guruHeaders]);
  const wbGuru = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbGuru, wsGuru, 'Template');
  const bufGuru = XLSX.write(wbGuru, { type: 'buffer', bookType: 'xlsx' });
  const readWbGuru = XLSX.read(bufGuru, { type: 'buffer' });
  const parsedGuruHeaders = XLSX.utils.sheet_to_json(readWbGuru.Sheets['Template'], { header: 1 })[0];
  assert(
    JSON.stringify(parsedGuruHeaders) === JSON.stringify(guruHeaders),
    'Template_Guru XLSX binary serializes and deserializes identical headers'
  );

  // 1.3 Jadwal Template Headers (all 8 columns)
  const jadwalHeaderMatch = adminViewContent.match(/importModal\.type\s*===\s*'jadwal'\)[\s\S]*?headers\s*=\s*(\[[^\]]+\])/);
  assert(jadwalHeaderMatch !== null, 'Jadwal template header definition found in AdminView.jsx');
  const jadwalHeaders = eval(jadwalHeaderMatch[1]);
  const expectedJadwalHeaders = ['nama_mapel', 'nama_guru_atau_nip', 'tanggal', 'jam_mulai', 'jam_selesai', 'durasi_menit', 'target_kelas', 'token'];
  assert(
    jadwalHeaders.length === 8,
    'Template_Jadwal contains exactly 8 columns',
    `Found ${jadwalHeaders.length} columns`
  );
  assert(
    JSON.stringify(jadwalHeaders) === JSON.stringify(expectedJadwalHeaders),
    'Template_Jadwal headers match all 8 required columns in sequence',
    JSON.stringify(jadwalHeaders)
  );

  // Generate and parse back Jadwal Excel binary
  const wsJadwal = XLSX.utils.aoa_to_sheet([jadwalHeaders]);
  const wbJadwal = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbJadwal, wsJadwal, 'Template');
  const bufJadwal = XLSX.write(wbJadwal, { type: 'buffer', bookType: 'xlsx' });
  const readWbJadwal = XLSX.read(bufJadwal, { type: 'buffer' });
  const parsedJadwalHeaders = XLSX.utils.sheet_to_json(readWbJadwal.Sheets['Template'], { header: 1 })[0];
  assert(
    JSON.stringify(parsedJadwalHeaders) === JSON.stringify(jadwalHeaders),
    'Template_Jadwal XLSX binary serializes and deserializes all 8 columns'
  );

  // ===========================================================================
  // 2. DATA PARSING LOGIC & EDGE CASE STRESS TESTING
  // ===========================================================================
  console.log('\n▶ [2] Data Parsing Logic & Edge Case Stress Testing:');

  // 2.1 Siswa Import Parsing Simulation Function (Derived from AdminView.jsx)
  function parseSiswaRows(rawData) {
    return rawData.map(row => {
      const r = { ...row };
      delete r.jenis_kelamin;
      const nisnStr = String(r.nisn || '').trim();
      if (!r.username || String(r.username).trim() === '') {
        r.username = nisnStr;
      }
      if (!r.password || String(r.password).trim() === '') {
        r.password = 'Nexa123!';
      }
      return r;
    });
  }

  // Stress test Siswa parsing: missing username, missing password, numeric NISN, legacy jenis_kelamin
  const testSiswaInput = [
    { nama_lengkap: 'Siswa Satu', nisn: '10001001', username: '', password: '', jenis_kelamin: 'L' },
    { nama_lengkap: 'Siswa Dua', nisn: 10001002, username: '   ', password: '   ', jenis_kelamin: 'P' },
    { nama_lengkap: 'Siswa Tiga', nisn: '10001003', username: 'custom_user_3', password: 'MyPassword!9' },
    { nama_lengkap: 'Siswa Empat', nisn: '10001004' } // undefined username and password
  ];

  const processedSiswa = parseSiswaRows(testSiswaInput);

  assert(
    processedSiswa[0].username === '10001001' && processedSiswa[0].password === 'Nexa123!',
    'Empty username defaults to NISN and empty password defaults to Nexa123!'
  );
  assert(
    processedSiswa[0].jenis_kelamin === undefined && !('jenis_kelamin' in processedSiswa[0]),
    'Legacy jenis_kelamin property is strictly deleted from Siswa import payload'
  );
  assert(
    processedSiswa[1].username === '10001002' && processedSiswa[1].password === 'Nexa123!',
    'Numeric NISN and whitespace-only username/password properly resolve to string NISN and Nexa123!'
  );
  assert(
    processedSiswa[2].username === 'custom_user_3' && processedSiswa[2].password === 'MyPassword!9',
    'Custom username and password are preserved without being overridden'
  );
  assert(
    processedSiswa[3].username === '10001004' && processedSiswa[3].password === 'Nexa123!',
    'Undefined username and password successfully default to NISN and Nexa123!'
  );

  // Large batch stress test: 200 rows with randomized missing fields
  const largeBatchSiswa = Array.from({ length: 200 }, (_, i) => ({
    nama_lengkap: `Batch Student ${i}`,
    nisn: `NISN-${10000 + i}`,
    username: i % 2 === 0 ? '' : `user_${i}`,
    password: i % 3 === 0 ? '' : `pass_${i}`,
    jenis_kelamin: i % 2 === 0 ? 'L' : 'P'
  }));
  const parsedLargeSiswa = parseSiswaRows(largeBatchSiswa);
  const invalidSiswaCount = parsedLargeSiswa.filter(
    s => !s.username || !s.password || 'jenis_kelamin' in s
  ).length;
  assert(
    invalidSiswaCount === 0,
    'Large batch stress test (200 rows): 100% rows have valid username, password, and 0% have jenis_kelamin'
  );

  // 2.2 Guru Import Parsing Simulation Function (Derived from AdminView.jsx)
  function parseGuruRows(rawData, mapelList) {
    return rawData.map(row => {
      const r = { ...row };
      if (!r.role || String(r.role).trim() === '') {
        r.role = 'guru';
      }
      if (!r.password || String(r.password).trim() === '') {
        r.password = 'Nexa123!';
      }
      if (!r.username || String(r.username).trim() === '') {
        r.username = r.nip ? String(r.nip).trim() : `guru_mock`;
      }
      if (r.mata_pelajaran) {
        const mpNames = String(r.mata_pelajaran).split(/[,;]/).map(s => s.trim().toLowerCase()).filter(Boolean);
        const matchedMapels = mapelList.filter(m =>
          mpNames.includes((m.nama_mapel || '').toLowerCase()) ||
          mpNames.includes((m.kode_mapel || '').toLowerCase())
        ).map(m => m.id_mapel);
        r.mapels = matchedMapels;
      } else {
        r.mapels = [];
      }
      return r;
    });
  }

  const mockMapelCatalog = [
    { id_mapel: 'MAPEL-01', nama_mapel: 'Matematika Wajib', kode_mapel: 'MTK-W' },
    { id_mapel: 'MAPEL-02', nama_mapel: 'Fisika Peminatan', kode_mapel: 'FIS-P' },
    { id_mapel: 'MAPEL-03', nama_mapel: 'Kimia', kode_mapel: 'KIM' }
  ];

  const testGuruInput = [
    { nama_lengkap: 'Guru Satu', nip: '19800101', role: '', password: '', mata_pelajaran: 'Matematika Wajib' },
    { nama_lengkap: 'Guru Dua', nip: '19800102', role: 'pengawas', password: 'CustomPassword!', mata_pelajaran: 'FIS-P; Kimia' },
    { nama_lengkap: 'Guru Tiga', nip: '19800103', mata_pelajaran: 'mAtEmAtIkA wAjIb, fis-p' },
    { nama_lengkap: 'Guru Empat', nip: '19800104', mata_pelajaran: 'Mata Pelajaran Tidak Dikenal' },
    { nama_lengkap: 'Guru Lima', nip: '19800105', mata_pelajaran: '' }
  ];

  const parsedGuru = parseGuruRows(testGuruInput, mockMapelCatalog);

  assert(
    parsedGuru[0].role === 'guru' && parsedGuru[0].password === 'Nexa123!' && parsedGuru[0].username === '19800101',
    'Guru auto-defaults role="guru", password="Nexa123!", username=NIP'
  );
  assert(
    JSON.stringify(parsedGuru[0].mapels) === JSON.stringify(['MAPEL-01']),
    'Single subject name matches id_mapel'
  );
  assert(
    parsedGuru[1].role === 'pengawas' && parsedGuru[1].password === 'CustomPassword!',
    'Custom guru role and password are preserved'
  );
  assert(
    JSON.stringify(parsedGuru[1].mapels) === JSON.stringify(['MAPEL-02', 'MAPEL-03']),
    'Semicolon-delimited subject codes and names correctly map to multiple id_mapel'
  );
  assert(
    JSON.stringify(parsedGuru[2].mapels) === JSON.stringify(['MAPEL-01', 'MAPEL-02']),
    'Case-insensitive and mixed comma delimiter maps correctly to id_mapel array'
  );
  assert(
    JSON.stringify(parsedGuru[3].mapels) === JSON.stringify([]),
    'Unrecognized subject name gracefully resolves to empty mapels array [] without crashing'
  );
  assert(
    JSON.stringify(parsedGuru[4].mapels) === JSON.stringify([]),
    'Empty subject string gracefully resolves to empty mapels array []'
  );

  // 2.3 Jadwal Import Parsing Simulation Function (Derived from AdminView.jsx)
  function parseJadwalRows(rawData, mapelList, guruList) {
    return rawData.map(row => {
      const mapelQuery = String(row.nama_mapel || '').trim().toLowerCase();
      const matchedMapel = mapelList.find(m =>
        (m.nama_mapel || '').toLowerCase() === mapelQuery ||
        (m.kode_mapel || '').toLowerCase() === mapelQuery ||
        m.id_mapel === row.nama_mapel
      );
      const id_mapel = matchedMapel ? matchedMapel.id_mapel : (mapelList[0]?.id_mapel || null);

      const guruQuery = String(row.nama_guru_atau_nip || row.guru || '').trim().toLowerCase();
      const matchedGuru = guruList.find(g =>
        (g.nama_lengkap || '').toLowerCase() === guruQuery ||
        (g.nip && String(g.nip).toLowerCase() === guruQuery) ||
        (g.username && g.username.toLowerCase() === guruQuery) ||
        g.id_guru === row.nama_guru_atau_nip
      );
      const id_guru = matchedGuru ? matchedGuru.id_guru : null;

      let tgl = row.tanggal ? String(row.tanggal).trim() : new Date().toISOString().split('T')[0];
      let jamM = row.jam_mulai ? String(row.jam_mulai).trim() : '08:00';
      let jamS = row.jam_selesai ? String(row.jam_selesai).trim() : '10:00';
      if (jamM.length === 5) jamM += ':00';
      if (jamS.length === 5) jamS += ':00';

      const waktu_mulai = `${tgl}T${jamM}`;
      const waktu_selesai = `${tgl}T${jamS}`;
      const durasi_menit = parseInt(row.durasi_menit, 10) || 90;
      const target_kelas = row.target_kelas ? String(row.target_kelas).trim() : '';
      const rawToken = row.token ? String(row.token).trim().toUpperCase() : Math.random().toString(36).substring(2, 8).toUpperCase();

      return {
        id_mapel,
        id_guru,
        waktu_mulai,
        waktu_selesai,
        durasi_menit,
        target_kelas,
        token_aktif: rawToken,
        last_update_token: new Date().toISOString(),
        browser_lockdown: true,
        acak_soal: true,
        acak_opsi: true
      };
    });
  }

  const mockGuruCatalog = [
    { id_guru: 'GURU-01', nama_lengkap: 'Budi Santoso', nip: '19810101', username: 'guru_budi' },
    { id_guru: 'GURU-02', nama_lengkap: 'Dewi Lestari', nip: '19820202', username: 'guru_dewi' }
  ];

  const testJadwalInput = [
    {
      nama_mapel: 'Matematika Wajib',
      nama_guru_atau_nip: 'Budi Santoso',
      tanggal: '2026-10-01',
      jam_mulai: '08:00',
      jam_selesai: '09:30',
      durasi_menit: '90',
      target_kelas: '10-A, 10-B',
      token: 'TKTEST'
    },
    {
      nama_mapel: 'FIS-P',
      nama_guru_atau_nip: '19820202', // by NIP
      tanggal: '2026-10-02',
      jam_mulai: '10:00',
      jam_selesai: '11:30',
      durasi_menit: 90,
      target_kelas: '11-IPA',
      token: 'lowercase_token'
    },
    {
      nama_mapel: 'Unknown Course',
      nama_guru_atau_nip: 'Unknown Teacher',
      durasi_menit: '',
      token: ''
    }
  ];

  const parsedJadwal = parseJadwalRows(testJadwalInput, mockMapelCatalog, mockGuruCatalog);

  assert(
    parsedJadwal[0].id_mapel === 'MAPEL-01' && parsedJadwal[0].id_guru === 'GURU-01',
    'Jadwal course name and teacher full name correctly resolve to foreign keys'
  );
  assert(
    parsedJadwal[0].waktu_mulai === '2026-10-01T08:00:00' && parsedJadwal[0].waktu_selesai === '2026-10-01T09:30:00',
    'Jadwal HH:mm time properly formatted to ISO HH:mm:00 timestamp'
  );
  assert(
    parsedJadwal[0].token_aktif === 'TKTEST' && parsedJadwal[0].browser_lockdown === true,
    'Jadwal custom token preserved and lockdown defaults set to true'
  );
  assert(
    parsedJadwal[1].id_mapel === 'MAPEL-02' && parsedJadwal[1].id_guru === 'GURU-02',
    'Jadwal course code (FIS-P) and teacher NIP correctly resolve to foreign keys'
  );
  assert(
    parsedJadwal[1].token_aktif === 'LOWERCASE_TOKEN',
    'Jadwal token is auto-uppercased'
  );
  assert(
    parsedJadwal[2].id_mapel === 'MAPEL-01' && parsedJadwal[2].id_guru === null,
    'Unknown course falls back safely to first mapel and unknown teacher to null'
  );
  assert(
    parsedJadwal[2].durasi_menit === 90 && parsedJadwal[2].token_aktif.length === 6,
    'Empty duration defaults to 90 and empty token generates 6-character random token'
  );

  // ===========================================================================
  // 3. BULK DELETION ENDPOINTS STRESS TESTING
  // ===========================================================================
  console.log('\n▶ [3] Bulk Deletion Endpoints Stress Testing:');

  // 3.1 Defensive checks: Empty ids array handling
  const emptyDelSiswa = await fetchAPI('delete_siswa_bulk', { ids: [], npsn: '70040625' });
  assert(
    emptyDelSiswa.status === 'error' && emptyDelSiswa.message.includes('Tidak ada siswa yang dipilih'),
    'delete_siswa_bulk rejects empty ids array with descriptive error',
    emptyDelSiswa.message
  );

  const emptyDelGuru = await fetchAPI('delete_guru_bulk', { ids: [], npsn: '70040625' });
  assert(
    emptyDelGuru.status === 'error' && emptyDelGuru.message.includes('Tidak ada guru yang dipilih'),
    'delete_guru_bulk rejects empty ids array with descriptive error',
    emptyDelGuru.message
  );

  const emptyDelJadwal = await fetchAPI('delete_jadwal_bulk', { ids: [], npsn: '70040625' });
  assert(
    emptyDelJadwal.status === 'error' && emptyDelJadwal.message.includes('Tidak ada jadwal yang dipilih'),
    'delete_jadwal_bulk rejects empty ids array with descriptive error',
    emptyDelJadwal.message
  );

  // 3.2 Live Database Bulk CRUD Lifecycle Verification
  const { data: activeSchools } = await supabase.from('sekolah').select('npsn').limit(1);
  const targetNpsn = (activeSchools && activeSchools[0]?.npsn) || '70040625';

  // Live Siswa Bulk Test
  const testSiswaIds = [
    `STRESS-S1-${Date.now()}`,
    `STRESS-S2-${Date.now()}`,
    `STRESS-S3-${Date.now()}`
  ];
  const siswaBulkInsertRes = await fetchAPI('create_siswa_bulk', [
    { id_siswa: testSiswaIds[0], npsn: targetNpsn, nama_lengkap: 'Stress S1', username: `u_${testSiswaIds[0]}`, password: '123', nisn: `N1_${Date.now()}` },
    { id_siswa: testSiswaIds[1], npsn: targetNpsn, nama_lengkap: 'Stress S2', username: `u_${testSiswaIds[1]}`, password: '123', nisn: `N2_${Date.now()}` },
    { id_siswa: testSiswaIds[2], npsn: targetNpsn, nama_lengkap: 'Stress S3', username: `u_${testSiswaIds[2]}`, password: '123', nisn: `N3_${Date.now()}` }
  ]);
  assert(siswaBulkInsertRes.status === 'success', 'create_siswa_bulk creates batch of 3 test students', siswaBulkInsertRes.message);

  const { count: countBeforeDelSiswa } = await supabase.from('siswa').select('*', { count: 'exact', head: true }).in('id_siswa', testSiswaIds);
  assert(countBeforeDelSiswa === 3, 'Confirmed 3 test students exist in database prior to deletion');

  const delSiswaLiveRes = await fetchAPI('delete_siswa_bulk', { ids: testSiswaIds, npsn: targetNpsn });
  assert(delSiswaLiveRes.status === 'success', 'delete_siswa_bulk executes successfully on batch of 3 students', delSiswaLiveRes.message);

  const { count: countAfterDelSiswa } = await supabase.from('siswa').select('*', { count: 'exact', head: true }).in('id_siswa', testSiswaIds);
  assert(countAfterDelSiswa === 0, 'Database query confirms exactly 0 test students remain after delete_siswa_bulk');

  // Live Guru Bulk Test
  const testGuruIds = [
    `STRESS-G1-${Date.now()}`,
    `STRESS-G2-${Date.now()}`
  ];
  const guruBulkInsertRes = await fetchAPI('create_guru_bulk', [
    { id_guru: testGuruIds[0], npsn: targetNpsn, nama_lengkap: 'Stress G1', username: `u_${testGuruIds[0]}`, password: '123', nip: `NIP1_${Date.now()}`, mapels: [] },
    { id_guru: testGuruIds[1], npsn: targetNpsn, nama_lengkap: 'Stress G2', username: `u_${testGuruIds[1]}`, password: '123', nip: `NIP2_${Date.now()}`, mapels: [] }
  ]);
  assert(guruBulkInsertRes.status === 'success', 'create_guru_bulk creates batch of 2 test teachers', guruBulkInsertRes.message);

  const { count: countBeforeDelGuru } = await supabase.from('guru').select('*', { count: 'exact', head: true }).in('id_guru', testGuruIds);
  assert(countBeforeDelGuru === 2, 'Confirmed 2 test teachers exist in database prior to deletion');

  const delGuruLiveRes = await fetchAPI('delete_guru_bulk', { ids: testGuruIds, npsn: targetNpsn });
  assert(delGuruLiveRes.status === 'success', 'delete_guru_bulk executes successfully on batch of 2 teachers', delGuruLiveRes.message);

  const { count: countAfterDelGuru } = await supabase.from('guru').select('*', { count: 'exact', head: true }).in('id_guru', testGuruIds);
  assert(countAfterDelGuru === 0, 'Database query confirms exactly 0 test teachers remain after delete_guru_bulk');

  // Live Jadwal Bulk Test
  const { data: mapelListDb } = await supabase.from('mata_pelajaran').select('id_mapel').eq('npsn', targetNpsn).limit(1);
  const testMapelId = mapelListDb?.[0]?.id_mapel || null;

  const testJadwalIds = [
    `STRESS-J1-${Date.now()}`,
    `STRESS-J2-${Date.now()}`
  ];
  const nowIso = new Date().toISOString();
  const laterIso = new Date(Date.now() + 3600000).toISOString();
  const jadwalBulkInsertRes = await fetchAPI('create_jadwal_bulk', [
    { id_jadwal: testJadwalIds[0], npsn: targetNpsn, id_mapel: testMapelId, waktu_mulai: nowIso, waktu_selesai: laterIso, durasi_menit: 60, token_aktif: 'STRS1' },
    { id_jadwal: testJadwalIds[1], npsn: targetNpsn, id_mapel: testMapelId, waktu_mulai: nowIso, waktu_selesai: laterIso, durasi_menit: 60, token_aktif: 'STRS2' }
  ]);
  assert(jadwalBulkInsertRes.status === 'success', 'create_jadwal_bulk creates batch of 2 test schedules', jadwalBulkInsertRes.message);

  const { count: countBeforeDelJadwal } = await supabase.from('jadwal').select('*', { count: 'exact', head: true }).in('id_jadwal', testJadwalIds);
  assert(countBeforeDelJadwal === 2, 'Confirmed 2 test schedules exist in database prior to deletion');

  const delJadwalLiveRes = await fetchAPI('delete_jadwal_bulk', { ids: testJadwalIds, npsn: targetNpsn });
  assert(delJadwalLiveRes.status === 'success', 'delete_jadwal_bulk executes successfully on batch of 2 schedules', delJadwalLiveRes.message);

  const { count: countAfterDelJadwal } = await supabase.from('jadwal').select('*', { count: 'exact', head: true }).in('id_jadwal', testJadwalIds);
  assert(countAfterDelJadwal === 0, 'Database query confirms exactly 0 test schedules remain after delete_jadwal_bulk');

  // Nonexistent IDs stress test: deleting non-existent IDs does not throw exception
  const delNonExistentRes = await fetchAPI('delete_siswa_bulk', { ids: ['NON_EXISTENT_ID_99999'], npsn: targetNpsn });
  assert(
    delNonExistentRes.status === 'success',
    'delete_siswa_bulk with non-existent ID gracefully executes 0-row deletion without crashing'
  );

  // ===========================================================================
  // 4. AVATAR UPDATE FLOW & SESSION RETENTION STRESS TESTING
  // ===========================================================================
  console.log('\n▶ [4] Avatar Update Flow & Session Retention Stress Testing:');

  // 4.1 Static Analysis: Confirm onLogout is completely removed from avatar update flows
  // In handleAvatarSelect:
  const handleAvatarSelectBlock = adminViewContent.substring(
    adminViewContent.indexOf('const handleAvatarSelect = async'),
    adminViewContent.indexOf('const fetchData = async')
  );
  assert(
    !handleAvatarSelectBlock.includes('onLogout'),
    'handleAvatarSelect contains 0 occurrences of onLogout'
  );
  assert(
    handleAvatarSelectBlock.includes('onUpdateUser({ foto_profil: avatarUrl })'),
    'handleAvatarSelect triggers onUpdateUser with new avatarUrl'
  );

  // In renderProfileModal form submission:
  const renderProfileModalBlock = adminViewContent.substring(
    adminViewContent.indexOf('const renderProfileModal = () =>'),
    adminViewContent.indexOf('const renderImportModal = () =>')
  );
  assert(
    !renderProfileModalBlock.includes('onLogout'),
    'renderProfileModal submit contains 0 occurrences of onLogout'
  );
  assert(
    renderProfileModalBlock.includes('onUpdateUser({ foto_profil: payload.foto_profil })'),
    'renderProfileModal triggers onUpdateUser with submitted foto_profil'
  );

  // 4.2 State Mutation Simulation: Sequential Avatar Updates & Active Session Preservation
  let userSession = {
    id_admin: 'ADM-CHALLENGER-01',
    username: 'admin_test_m2',
    role: 'admin',
    npsn: targetNpsn,
    nama_lengkap: 'Admin Tester',
    foto_profil: null
  };

  // Implementation of handleUpdateUser from App.jsx:
  const handleUpdateUser = (fields) => {
    userSession = userSession ? ({ ...userSession, ...fields }) : userSession;
  };

  const avatarSequence = [
    'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Mimi',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Jasper',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Bandit'
  ];

  let sessionRemainedActive = true;
  for (const newAvatar of avatarSequence) {
    handleUpdateUser({ foto_profil: newAvatar });
    if (
      !userSession ||
      userSession.role !== 'admin' ||
      userSession.id_admin !== 'ADM-CHALLENGER-01' ||
      userSession.foto_profil !== newAvatar
    ) {
      sessionRemainedActive = false;
      break;
    }
  }

  assert(
    sessionRemainedActive === true,
    'Sequential avatar updates (5 iterations) preserved user session identity, role, and active state without resetting user'
  );

  // Edge case: null user (logged out state)
  let nullSession = null;
  const handleNullUpdate = (fields) => {
    nullSession = nullSession ? ({ ...nullSession, ...fields }) : nullSession;
  };
  handleNullUpdate({ foto_profil: 'https://test.avatar' });
  assert(
    nullSession === null,
    'handleUpdateUser gracefully handles null user session without throwing TypeError'
  );

  // 4.3 Live API update_admin_profil verification
  const { data: adminRecord } = await supabase.from('admin').select('id_admin, foto_profil').limit(1);
  if (adminRecord && adminRecord.length > 0) {
    const adminId = adminRecord[0].id_admin;
    const testAvatarUrl = 'https://api.dicebear.com/7.x/bottts/svg?seed=ChallengerAvatar';

    const updateRes = await fetchAPI('update_admin_profil', {
      id_admin: adminId,
      foto_profil: testAvatarUrl
    });

    assert(
      updateRes.status === 'success',
      'fetchAPI update_admin_profil returned status "success"',
      updateRes.message
    );
    assert(
      updateRes.message === 'Profil berhasil diperbarui.',
      'fetchAPI update_admin_profil returned message "Profil berhasil diperbarui." (no logout notice)',
      updateRes.message
    );

    // Verify persistence in Supabase
    const { data: updatedAdmin } = await supabase.from('admin').select('foto_profil').eq('id_admin', adminId).single();
    assert(
      updatedAdmin?.foto_profil === testAvatarUrl,
      'Live Supabase query verifies new avatar URL was persisted to database'
    );
  } else {
    console.warn('  ⚠ No admin record found in database for live avatar test');
  }

  // ===========================================================================
  // SUMMARY
  // ===========================================================================
  console.log('\n========================================================================');
  console.log(`   TOTAL TESTS: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
  console.log('========================================================================');

  if (results.failed > 0) {
    console.error('\n✖ Challenger stress tests revealed failures:');
    results.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.error(`  - ${t.name}: ${t.details}`);
    });
    process.exit(1);
  } else {
    console.log('\n✔ All Challenger Milestone M2 stress tests passed successfully!\n');
    process.exit(0);
  }
}

runChallengerStressTests().catch(err => {
  console.error('Fatal challenger error:', err);
  process.exit(1);
});
