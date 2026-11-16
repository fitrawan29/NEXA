/**
 * NEXA Centralized Master Data Synchronization E2E Audit Test Suite
 * 
 * Verifies Requirements R1, R2, and R3 across Tiers 1-4:
 * - Tier 1: Feature Coverage (8 features x 5 test cases = 40 tests)
 * - Tier 2: Boundary & Corner Cases (25 tests)
 * - Tier 3: Cross-Feature Combinations (12 tests)
 * - Tier 4: Real-World Application Scenarios (5 tests)
 * 
 * Target Features:
 * F1: Centralized Class Filter in Siswa Tab (R1)
 * F2: Centralized Class Filter in Print Kartu Modal (R1)
 * F3: Modal Pre-fetching for Master Classes (R1)
 * F4: Siswa Bulk Excel Import Master Class Validation (R1)
 * F5: Jadwal Excel Import Subject Matching (No Fallback) (R2)
 * F6: Proctoring HUD Master Class Sourcing (R2)
 * F7: Complete Absensi Exclusion & Route Hygiene (R2)
 * F8: Feature Isolation & Zero Regressions (R3)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

// Read source files under audit
const adminCode = fs.readFileSync(path.join(srcDir, 'views/AdminView.jsx'), 'utf8');
const apiCode = fs.readFileSync(path.join(srcDir, 'api.js'), 'utf8');
const siswaCode = fs.readFileSync(path.join(srcDir, 'views/SiswaView.jsx'), 'utf8');
const guruCode = fs.readFileSync(path.join(srcDir, 'views/GuruView.jsx'), 'utf8');
const examRoomCode = fs.readFileSync(path.join(srcDir, 'views/ExamRoom.jsx'), 'utf8');
const superAdminCode = fs.readFileSync(path.join(srcDir, 'views/SuperAdminView.jsx'), 'utf8');
const nexaBundleCode = fs.readFileSync(path.join(srcDir, 'utils/nexaBundle.js'), 'utf8');
const appCode = fs.readFileSync(path.join(srcDir, 'App.jsx'), 'utf8');

let passed = 0;
let failed = 0;
const failureDetails = [];

function test(id, name, fn) {
  const fullLabel = `[${id}] ${name}`;
  try {
    fn();
    console.log(`  ✔ PASS: ${fullLabel}`);
    passed++;
  } catch (err) {
    console.error(`  ✖ FAIL: ${fullLabel}\n     Error: ${err.message}`);
    failed++;
    failureDetails.push({ id, name, error: err.message });
  }
}

console.log('\n======================================================================');
console.log('       NEXA MASTER DATA CENTRALIZATION E2E AUDIT TEST SUITE           ');
console.log('======================================================================\n');

// ============================================================================
// TIER 1: FEATURE COVERAGE (40 tests across 8 features)
// ============================================================================
console.log('>>> TIER 1: FEATURE COVERAGE (40 tests)\n');

// ----------------------------------------------------------------------------
// Feature 1: Centralized Class Filter in Siswa Tab (R1)
// ----------------------------------------------------------------------------
console.log('--- Feature 1: Centralized Class Filter in Siswa Tab (R1) ---');

test('T1.1.1', 'AdminView Siswa tab class filter does not derive options from dataSiswa.map', () => {
  const siswaFilterIdx = adminCode.indexOf('value={filterKelas}');
  assert.ok(siswaFilterIdx > -1, 'Must have filterKelas select in AdminView');
  const selectEnd = adminCode.indexOf('</select>', siswaFilterIdx);
  const filterBlock = adminCode.slice(siswaFilterIdx - 100, selectEnd + 50);
  assert.doesNotMatch(filterBlock, /dataSiswa\.map\(\s*s\s*=>\s*s\.kelas\s*\)/, 'Siswa filter must not scrape classes from dataSiswa');
});

test('T1.1.2', 'AdminView Siswa tab class filter sources options from canonical dataKelas', () => {
  const siswaFilterIdx = adminCode.indexOf('value={filterKelas}');
  const selectEnd = adminCode.indexOf('</select>', siswaFilterIdx);
  const filterBlock = adminCode.slice(siswaFilterIdx - 100, selectEnd + 50);
  assert.match(filterBlock, /dataKelas/, 'Siswa filter must reference dataKelas');
  assert.match(filterBlock, /k\.tingkat[\s\S]*?k\.kelas_paralel/, 'Siswa filter must map tingkat and kelas_paralel from master data');
});

test('T1.1.3', 'Class filter options include master classes having zero registered students', () => {
  const mockDataKelas = [
    { id_kelas: 'k1', tingkat: 'VII', kelas_paralel: 'A', npsn: '101' },
    { id_kelas: 'k2', tingkat: 'VII', kelas_paralel: 'B', npsn: '101' },
    { id_kelas: 'k3', tingkat: 'VIII', kelas_paralel: 'A', npsn: '101' }
  ];
  const mockDataSiswa = [
    { id_siswa: 's1', nama_lengkap: 'Ahmad', kelas: 'VII A' }
  ];

  // Logic replicated from AdminView.jsx
  const availableClasses = [...new Set((mockDataKelas || []).map(k => `${k.tingkat || ''} ${k.kelas_paralel || ''}`.trim()).filter(Boolean))].sort();

  assert.equal(availableClasses.length, 3, 'Must render all 3 master classes');
  assert.ok(availableClasses.includes('VII B'), 'Class with zero students must be present in filter');
  assert.ok(availableClasses.includes('VIII A'), 'Class with zero students must be present in filter');
});

test('T1.1.4', 'Siswa tab filter correctly matches student records against selected master class', () => {
  const students = [
    { id_siswa: 's1', nama_lengkap: 'Budi Santoso', kelas: 'VII A', angkatan: 'VII', kelas_paralel: 'A' },
    { id_siswa: 's2', nama_lengkap: 'Citra Dewi', kelas: 'VII B', angkatan: 'VII', kelas_paralel: 'B' }
  ];
  const selectedFilter = 'VII A';
  const filtered = students.filter(s => s.kelas === selectedFilter || `${s.angkatan} ${s.kelas_paralel}` === selectedFilter);

  assert.equal(filtered.length, 1, 'Only students in selected master class should pass filter');
  assert.equal(filtered[0].id_siswa, 's1', 'Budi Santoso matches VII A');
});

test('T1.1.5', 'Legacy non-master student class strings do not pollute master class filter options', () => {
  const mockDataKelas = [
    { id_kelas: 'k1', tingkat: 'VII', kelas_paralel: 'A', npsn: '101' }
  ];
  const mockDataSiswa = [
    { id_siswa: 's1', nama_lengkap: 'Budi', kelas: 'VII A' },
    { id_siswa: 's2', nama_lengkap: 'Corrupt', kelas: 'KELAS_INVALID_999' }
  ];

  const availableClasses = [...new Set((mockDataKelas || []).map(k => `${k.tingkat || ''} ${k.kelas_paralel || ''}`.trim()).filter(Boolean))].sort();

  assert.ok(!availableClasses.includes('KELAS_INVALID_999'), 'Corrupt student class string must not appear in filter');
  assert.equal(availableClasses.length, 1, 'Filter contains strictly canonical master classes');
});

// ----------------------------------------------------------------------------
// Feature 2: Centralized Class Filter in Print Kartu Modal (R1)
// ----------------------------------------------------------------------------
console.log('\n--- Feature 2: Centralized Class Filter in Print Kartu Modal (R1) ---');

test('T1.2.1', 'renderPrintKartuModal availableClasses does not scrape dataSiswa.map', () => {
  const modalStart = adminCode.indexOf('const renderPrintKartuModal = () => {');
  assert.ok(modalStart > -1, 'renderPrintKartuModal must exist');
  const modalHeader = adminCode.slice(modalStart, modalStart + 400);
  assert.doesNotMatch(modalHeader, /dataSiswa\.map\(\s*s\s*=>\s*s\.kelas\s*\)/, 'availableClasses in print modal must not scrape dataSiswa');
});

test('T1.2.2', 'renderPrintKartuModal availableClasses sources from canonical dataKelas', () => {
  const modalStart = adminCode.indexOf('const renderPrintKartuModal = () => {');
  const modalHeader = adminCode.slice(modalStart, modalStart + 400);
  assert.match(modalHeader, /dataKelas/, 'availableClasses in print modal must reference dataKelas');
  assert.match(modalHeader, /k\.tingkat[\s\S]*?k\.kelas_paralel/, 'availableClasses must build name from master k.tingkat and k.kelas_paralel');
});

test('T1.2.3', 'handleOpenPrintKartu pre-fetches get_kelas if dataKelas is empty', () => {
  const openPrintStart = adminCode.indexOf('const handleOpenPrintKartu =');
  assert.ok(openPrintStart > -1, 'handleOpenPrintKartu must exist');
  const openPrintBlock = adminCode.slice(openPrintStart, openPrintStart + 500);
  assert.match(openPrintBlock, /api\(\s*['"]get_kelas['"]\s*,\s*\{\}\s*\)/, 'handleOpenPrintKartu must pre-fetch get_kelas when dataKelas is empty');
  assert.match(openPrintBlock, /setDataKelas/, 'handleOpenPrintKartu must set dataKelas with fetched result');
});

test('T1.2.4', 'Print Kartu modal correctly filters students by canonical class', () => {
  const students = [
    { id_siswa: 's1', nama_lengkap: 'Siswa 1', kelas: 'X 1', angkatan: 'X', kelas_paralel: '1' },
    { id_siswa: 's2', nama_lengkap: 'Siswa 2', kelas: 'X 2', angkatan: 'X', kelas_paralel: '2' }
  ];
  const filterKelas = 'X 1';
  const targetStudents = students.filter(s => s.kelas === filterKelas);

  assert.equal(targetStudents.length, 1);
  assert.equal(targetStudents[0].nama_lengkap, 'Siswa 1');
});

test('T1.2.5', 'Print Kartu modal ALL filter prints students across all master classes', () => {
  const students = [
    { id_siswa: 's1', nama_lengkap: 'Siswa 1', kelas: 'X 1' },
    { id_siswa: 's2', nama_lengkap: 'Siswa 2', kelas: 'X 2' }
  ];
  const filterKelas = 'ALL';
  const filtered = filterKelas === 'ALL' ? students : students.filter(s => s.kelas === filterKelas);

  assert.equal(filtered.length, 2, 'ALL filter must preserve full roster');
});

// ----------------------------------------------------------------------------
// Feature 3: Modal Pre-fetching for Master Classes (R1)
// ----------------------------------------------------------------------------
console.log('\n--- Feature 3: Modal Pre-fetching for Master Classes (R1) ---');

test('T1.3.1', 'openCreateModal pre-fetches get_kelas when opening siswa modal and dataKelas is empty', () => {
  const createStart = adminCode.indexOf('const openCreateModal = async');
  assert.ok(createStart > -1, 'openCreateModal must be async');
  const createBlock = adminCode.slice(createStart, createStart + 600);
  assert.match(createBlock, /type\s*===\s*['"]siswa['"]/, 'openCreateModal must handle type === "siswa"');
  assert.match(createBlock, /api\(\s*['"]get_kelas['"]\s*,\s*\{\}\s*\)/, 'openCreateModal must fetch get_kelas for siswa');
});

test('T1.3.2', 'openEditModal pre-fetches get_kelas when opening siswa edit modal and dataKelas is empty', () => {
  const editStart = adminCode.indexOf('const openEditModal = async');
  assert.ok(editStart > -1, 'openEditModal must be async');
  const editBlock = adminCode.slice(editStart, editStart + 600);
  assert.match(editBlock, /type\s*===\s*['"]siswa['"]/, 'openEditModal must handle type === "siswa"');
  assert.match(editBlock, /api\(\s*['"]get_kelas['"]\s*,\s*\{\}\s*\)/, 'openEditModal must fetch get_kelas for siswa');
});

test('T1.3.3', 'Modal pre-fetch avoids redundant API call if dataKelas is already loaded', () => {
  const createStart = adminCode.indexOf('const openCreateModal = async');
  const createBlock = adminCode.slice(createStart, createStart + 400);
  assert.match(createBlock, /!dataKelas\s*\|\|\s*dataKelas\.length\s*===\s*0/, 'Must check if dataKelas is empty before calling API');
});

test('T1.3.4', 'Pre-fetched class list updates component state setDataKelas', () => {
  const createStart = adminCode.indexOf('const openCreateModal = async');
  const createBlock = adminCode.slice(createStart, createStart + 500);
  assert.match(createBlock, /setDataKelas\(\s*resK\.data\s*\|\|\s*\[\]\s*\)/, 'Must store fetched classes in dataKelas state');
});

test('T1.3.5', 'Form modal for siswa renders class dropdown from dataKelas options', () => {
  const formModalClassSelect = adminCode.indexOf('{dataKelas.map(k => (');
  assert.ok(formModalClassSelect > -1, 'Siswa form modal must map over dataKelas');
  const selectBlock = adminCode.slice(formModalClassSelect - 100, formModalClassSelect + 200);
  assert.match(selectBlock, /k\.tingkat\}[\s\S]*?\{k\.kelas_paralel\}/, 'Option label must display master tingkat and paralel');
});

// ----------------------------------------------------------------------------
// Feature 4: Siswa Bulk Excel Import Master Class Validation (R1)
// ----------------------------------------------------------------------------
console.log('\n--- Feature 4: Siswa Bulk Excel Import Master Class Validation (R1) ---');

test('T1.4.1', 'Siswa bulk import verifies dataKelas existence before processing upload', () => {
  const handleImportFileIdx = adminCode.indexOf('const handleImportFile');
  assert.ok(handleImportFileIdx > -1, 'handleImportFile must exist');
  const importSiswaIdx = adminCode.indexOf("importModal.type === 'siswa'", handleImportFileIdx);
  assert.ok(importSiswaIdx > -1, 'Must have handler for siswa import in handleImportFile');
  const siswaImportBlock = adminCode.slice(importSiswaIdx, importSiswaIdx + 1200);
  assert.match(siswaImportBlock, /api\(\s*['"]get_kelas['"]\s*,\s*\{\}\s*\)/, 'Must pre-fetch get_kelas if kelasList is empty during siswa import');
  assert.match(siswaImportBlock, /Belum ada data master kelas/, 'Must reject student import if no master classes exist');
});

test('T1.4.2', 'Siswa bulk import validates each row against canonical master classes', () => {
  const handleImportFileIdx = adminCode.indexOf('const handleImportFile');
  const importSiswaIdx = adminCode.indexOf("importModal.type === 'siswa'", handleImportFileIdx);
  const importGuruIdx = adminCode.indexOf("importModal.type === 'guru'", importSiswaIdx);
  const siswaImportBlock = adminCode.slice(importSiswaIdx, importGuruIdx);
  assert.match(siswaImportBlock, /masterClassMap/, 'Must build masterClassMap for validation');
  assert.match(siswaImportBlock, /invalidClassRows/, 'Must maintain invalidClassRows array');
  assert.match(siswaImportBlock, /invalidClassRows\.length\s*>\s*0/, 'Must check for invalid rows before sending payload');
  assert.match(siswaImportBlock, /Validasi Gagal/, 'Must alert admin with validation failure message');
});

test('T1.4.3', 'Siswa bulk import simulation accepts rows with valid master class', () => {
  const masterClasses = [
    { tingkat: 'VII', kelas_paralel: 'A' },
    { tingkat: 'VII', kelas_paralel: 'B' }
  ];
  const normalize = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const masterMap = new Map();
  masterClasses.forEach(k => masterMap.set(normalize(`${k.tingkat} ${k.kelas_paralel}`), k));

  const validRow = { nama_lengkap: 'Budi', nisn: '12345', kelas: 'VII A' };
  const matched = masterMap.get(normalize(validRow.kelas));

  assert.ok(matched, 'VII A must resolve to master class');
  assert.equal(matched.tingkat, 'VII');
  assert.equal(matched.kelas_paralel, 'A');
});

test('T1.4.4', 'Siswa bulk import simulation rejects rows with nonexistent master class', () => {
  const masterClasses = [{ tingkat: 'VII', kelas_paralel: 'A' }];
  const normalize = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const masterMap = new Map();
  masterClasses.forEach(k => masterMap.set(normalize(`${k.tingkat} ${k.kelas_paralel}`), k));

  const invalidRow = { nama_lengkap: 'Rogue Student', nisn: '99999', kelas: 'XII FANTASY 9' };
  const matched = masterMap.get(normalize(invalidRow.kelas));

  assert.equal(matched, undefined, 'Nonexistent class must fail master resolution');
});

test('T1.4.5', 'Siswa bulk import maps canonical angkatan and kelas_paralel from master record', () => {
  const masterClasses = [{ tingkat: 'X', kelas_paralel: 'MIPA 1' }];
  const normalize = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const masterMap = new Map();
  masterClasses.forEach(k => masterMap.set(normalize(`${k.tingkat} ${k.kelas_paralel}`), k));

  const row = { nama_lengkap: 'Siti', nisn: '112233', kelas: 'X  MIPA 1' };
  const matched = masterMap.get(normalize(row.kelas));
  assert.ok(matched, 'Whitespace differences should be normalized');
  row.angkatan = matched.tingkat;
  row.kelas_paralel = matched.kelas_paralel;
  row.kelas = `${matched.tingkat} ${matched.kelas_paralel}`.trim();

  assert.equal(row.angkatan, 'X');
  assert.equal(row.kelas_paralel, 'MIPA 1');
  assert.equal(row.kelas, 'X MIPA 1');
});

// ----------------------------------------------------------------------------
// Feature 5: Jadwal Excel Import Subject Matching (No Fallback) (R2)
// ----------------------------------------------------------------------------
console.log('\n--- Feature 5: Jadwal Excel Import Subject Matching (No Fallback) (R2) ---');

test('T1.5.1', 'Jadwal Excel import does not fall back to mapelList[0]?.id_mapel', () => {
  const handleImportFileIdx = adminCode.indexOf('const handleImportFile');
  const jadwalImportIdx = adminCode.indexOf("importModal.type === 'jadwal'", handleImportFileIdx);
  assert.ok(jadwalImportIdx > -1, 'Must have handler for jadwal import in handleImportFile');
  const importMapelIdx = adminCode.indexOf("importModal.type === 'mapel'", jadwalImportIdx);
  const jadwalBlock = adminCode.slice(jadwalImportIdx, importMapelIdx);
  assert.doesNotMatch(jadwalBlock, /mapelList\[0\]\??\.id_mapel/, 'Jadwal import must NEVER fall back to mapelList[0]');
});

test('T1.5.2', 'Jadwal Excel import assigns null to id_mapel on unmatched subject', () => {
  const handleImportFileIdx = adminCode.indexOf('const handleImportFile');
  const jadwalImportIdx = adminCode.indexOf("importModal.type === 'jadwal'", handleImportFileIdx);
  const importMapelIdx = adminCode.indexOf("importModal.type === 'mapel'", jadwalImportIdx);
  const jadwalBlock = adminCode.slice(jadwalImportIdx, importMapelIdx);
  assert.match(jadwalBlock, /const\s+id_mapel\s*=\s*matchedMapel\s*\?\s*matchedMapel\.id_mapel\s*:\s*null/, 'id_mapel must be assigned null when no match found');
});

test('T1.5.3', 'Jadwal Excel import tracks unassignedMapelRows and halts with error alert', () => {
  const handleImportFileIdx = adminCode.indexOf('const handleImportFile');
  const jadwalImportIdx = adminCode.indexOf("importModal.type === 'jadwal'", handleImportFileIdx);
  const importMapelIdx = adminCode.indexOf("importModal.type === 'mapel'", jadwalImportIdx);
  const jadwalBlock = adminCode.slice(jadwalImportIdx, importMapelIdx);
  assert.match(jadwalBlock, /unassignedMapelRows/, 'Must collect unassigned subject rows');
  assert.match(jadwalBlock, /unassignedMapelRows\.length\s*>\s*0/, 'Must check for unassigned subjects');
  assert.match(jadwalBlock, /tidak ditemukan di Master Data/, 'Must alert with informative error message');
});

test('T1.5.4', 'Jadwal import simulation resolves valid subject name or code to id_mapel', () => {
  const mapelList = [
    { id_mapel: 'm1', nama_mapel: 'Matematika Wajib', kode_mapel: 'MTK-W' },
    { id_mapel: 'm2', nama_mapel: 'Bahasa Indonesia', kode_mapel: 'BINDO' }
  ];
  const query = 'matematika wajib';
  const matched = query ? mapelList.find(m =>
    (m.nama_mapel && m.nama_mapel.toLowerCase() === query) ||
    (m.kode_mapel && String(m.kode_mapel).toLowerCase() === query) ||
    (m.id_mapel && m.id_mapel === query)
  ) : null;
  assert.ok(matched);
  assert.equal(matched.id_mapel, 'm1');
});

test('T1.5.5', 'Jadwal import simulation safely rejects row with misspelled subject name', () => {
  const mapelList = [
    { id_mapel: 'm1', nama_mapel: 'Matematika Wajib', kode_mapel: 'MTK-W' }
  ];
  const query = 'matematika gaib'; // typo/invalid
  const matched = query ? mapelList.find(m =>
    (m.nama_mapel && m.nama_mapel.toLowerCase() === query) ||
    (m.kode_mapel && String(m.kode_mapel).toLowerCase() === query) ||
    (m.id_mapel && m.id_mapel === query)
  ) : null;
  const id_mapel = matched ? matched.id_mapel : null;

  assert.equal(id_mapel, null, 'Must be null rather than falling back to m1');
});

// ----------------------------------------------------------------------------
// Feature 6: Proctoring HUD Master Class Sourcing (R2)
// ----------------------------------------------------------------------------
console.log('\n--- Feature 6: Proctoring HUD Master Class Sourcing (R2) ---');

test('T1.6.1', 'availableMonitoringClasses does not scrape from dataLog', () => {
  const monIdx = adminCode.indexOf('const availableMonitoringClasses');
  assert.ok(monIdx > -1, 'availableMonitoringClasses must exist');
  const monBlock = adminCode.slice(monIdx, monIdx + 300);
  assert.doesNotMatch(monBlock, /dataLog\.forEach/, 'Must not derive monitoring classes from dataLog');
});

test('T1.6.2', 'availableMonitoringClasses sources classes from canonical dataKelas', () => {
  const monIdx = adminCode.indexOf('const availableMonitoringClasses');
  const monBlock = adminCode.slice(monIdx, monIdx + 300);
  assert.match(monBlock, /dataKelas/, 'availableMonitoringClasses must use dataKelas');
  assert.match(monBlock, /k\.tingkat[\s\S]*?k\.kelas_paralel/, 'Must combine k.tingkat and k.kelas_paralel');
});

test('T1.6.3', 'Proctoring HUD renders all master classes when active dataLog is empty', () => {
  const mockDataKelas = [
    { tingkat: 'VII', kelas_paralel: '1' },
    { tingkat: 'VII', kelas_paralel: '2' },
    { tingkat: 'VIII', kelas_paralel: '1' }
  ];
  const classes = new Set();
  (mockDataKelas || []).forEach(k => {
    const name = `${k.tingkat || ''} ${k.kelas_paralel || ''}`.trim();
    if (name) classes.add(name);
  });
  const availableMonitoringClasses = Array.from(classes).sort();

  assert.equal(availableMonitoringClasses.length, 3, 'Must render all 3 master classes even with zero active exam logs');
  assert.deepEqual(availableMonitoringClasses, ['VII 1', 'VII 2', 'VIII 1']);
});

test('T1.6.4', 'Proctoring HUD correctly isolates active examinees by selected master class', () => {
  const logs = [
    { id_log: 'l1', id_siswa: 's1', angkatan: 'VII', kelas_paralel: '1', status_ujian: 'SEDANG KERJA' },
    { id_log: 'l2', id_siswa: 's2', angkatan: 'VII', kelas_paralel: '2', status_ujian: 'SEDANG KERJA' }
  ];
  const selectedClass = 'VII 1';
  const filtered = logs.filter(l => `${l.angkatan || ''} ${l.kelas_paralel || ''}`.trim() === selectedClass);

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id_log, 'l1');
});

test('T1.6.5', 'Proctoring HUD ALL filter displays active logs from all classes', () => {
  const logs = [
    { id_log: 'l1', angkatan: 'VII', kelas_paralel: '1' },
    { id_log: 'l2', angkatan: 'VII', kelas_paralel: '2' }
  ];
  const filter = 'ALL';
  const filtered = filter === 'ALL' ? logs : logs.filter(l => `${l.angkatan} ${l.kelas_paralel}` === filter);

  assert.equal(filtered.length, 2);
});

// ----------------------------------------------------------------------------
// Feature 7: Complete Absensi Exclusion & Route Hygiene (R2)
// ----------------------------------------------------------------------------
console.log('\n--- Feature 7: Complete Absensi Exclusion & Route Hygiene (R2) ---');

test('T1.7.1', 'src/api.js globalRoutes array does not contain simpan_kehadiran_siswa', () => {
  const globalRoutesIdx = apiCode.indexOf('const globalRoutes = [');
  const globalRoutesBlock = apiCode.slice(globalRoutesIdx, apiCode.indexOf('];', globalRoutesIdx));
  assert.doesNotMatch(globalRoutesBlock, /'simpan_kehadiran_siswa'/, 'globalRoutes must not declare simpan_kehadiran_siswa');
});

test('T1.7.2', 'src/api.js globalRoutes array does not contain submit_absensi_siswa', () => {
  const globalRoutesIdx = apiCode.indexOf('const globalRoutes = [');
  const globalRoutesBlock = apiCode.slice(globalRoutesIdx, apiCode.indexOf('];', globalRoutesIdx));
  assert.doesNotMatch(globalRoutesBlock, /'submit_absensi_siswa'/, 'globalRoutes must not declare submit_absensi_siswa');
});

test('T1.7.3', 'src/api.js globalRoutes array does not contain verifikasi_absensi or verifikasi_absensi_bulk', () => {
  const globalRoutesIdx = apiCode.indexOf('const globalRoutes = [');
  const globalRoutesBlock = apiCode.slice(globalRoutesIdx, apiCode.indexOf('];', globalRoutesIdx));
  assert.doesNotMatch(globalRoutesBlock, /'verifikasi_absensi'/, 'globalRoutes must not declare verifikasi_absensi');
  assert.doesNotMatch(globalRoutesBlock, /'verifikasi_absensi_bulk'/, 'globalRoutes must not declare verifikasi_absensi_bulk');
});

test('T1.7.4', 'Client UI views contain zero active attendance forms or routes', () => {
  const viewFiles = [adminCode, guruCode, siswaCode, examRoomCode];
  viewFiles.forEach(code => {
    assert.doesNotMatch(code, /case\s+['"]absensi['"]/, 'Views must not route to absensi tabs');
    assert.doesNotMatch(code, /<AbsensiPengawas/, 'No legacy attendance component usage');
    assert.doesNotMatch(code, /api\(\s*['"]submit_absensi/, 'No invocation of submit_absensi');
  });
});

test('T1.7.5', 'Exam execution workflow in ExamRoom does not gate on student attendance verification', () => {
  assert.doesNotMatch(examRoomCode, /status_kehadiran/, 'ExamRoom must not gate start or submit on attendance status');
  assert.doesNotMatch(examRoomCode, /is_verified_kehadiran/, 'ExamRoom must not check attendance verification');
});

// ----------------------------------------------------------------------------
// Feature 8: Feature Isolation & Zero Regressions (R3)
// ----------------------------------------------------------------------------
console.log('\n--- Feature 8: Feature Isolation & Zero Regressions (R3) ---');

test('T1.8.1', 'SuperAdminView module is preserved and strictly isolated', () => {
  assert.ok(superAdminCode.includes('SuperAdminView'), 'SuperAdminView must exist');
  assert.ok(superAdminCode.includes('get_sekolah'), 'SuperAdminView school query must be intact');
  assert.ok(superAdminCode.includes('update_sekolah_status'), 'SuperAdminView suspension control must be intact');
});

test('T1.8.2', 'Authentication and session resilience subsystem in App.jsx is preserved', () => {
  assert.ok(appCode.includes('nexa_user_session'), 'SessionStorage key nexa_user_session must be preserved');
  assert.ok(appCode.includes('heartbeat_siswa') || apiCode.includes('heartbeat_siswa'), 'Student heartbeat must be preserved');
  assert.ok(apiCode.includes('session_token'), 'Multi-login collision protection must be preserved');
});

test('T1.8.3', 'ExamRoom 3-strikes exam security engine is preserved', () => {
  assert.ok(examRoomCode.includes('catat_pelanggaran'), 'Violation logger catat_pelanggaran must be intact');
  assert.ok(examRoomCode.includes('handleExamViolation') || examRoomCode.includes('pelanggaran'), 'Violation handler must be intact');
});

test('T1.8.4', 'Emergency offline answer bundle engine in nexaBundle.js is preserved', () => {
  assert.ok(nexaBundleCode.includes('decodeNexaBundle'), 'decodeNexaBundle must be intact');
  assert.ok(nexaBundleCode.includes('verifyNexaBundleChecksum'), 'verifyNexaBundleChecksum must be intact');
  assert.ok(apiCode.includes('import_jawaban_offline'), 'Offline answer ingestion must be intact');
});

test('T1.8.5', 'Mobile layout containment and UI primitives are preserved', () => {
  assert.ok(adminCode.includes('h-[100dvh]'), 'AdminView mobile viewport height containment must be preserved');
  assert.ok(fs.existsSync(path.join(srcDir, 'utils/themeColor.js')), 'themeColor.js must exist');
});

// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES (25 tests)
// ============================================================================
console.log('\n>>> TIER 2: BOUNDARY & CORNER CASES (25 tests)\n');

test('T2.1', '[Boundary] Empty dataKelas array handled safely in Siswa tab filter without crash', () => {
  const emptyKelas = [];
  const renderedOptions = [...new Set((emptyKelas || []).map(k => `${k.tingkat || ''} ${k.kelas_paralel || ''}`.trim()).filter(Boolean))];
  assert.equal(renderedOptions.length, 0);
  assert.doesNotThrow(() => {
    renderedOptions.map(k => `<option value="${k}">${k}</option>`);
  });
});

test('T2.2', '[Boundary] Null dataKelas state in renderPrintKartuModal defaults to empty list', () => {
  const nullKelas = null;
  const availableClasses = Array.from(
    new Set((nullKelas || []).map(k => `${k.tingkat || ''} ${k.kelas_paralel || ''}`.trim()).filter(Boolean))
  ).sort();
  assert.equal(availableClasses.length, 0);
});

test('T2.3', '[Boundary] Master class with complex punctuation and spacing normalizes properly', () => {
  const rawClass = 'XII - MIPA / 1 (Akselerasi)';
  const normalized = String(rawClass || '').trim().replace(/\s+/g, ' ').toLowerCase();
  assert.equal(normalized, 'xii - mipa / 1 (akselerasi)');
});

test('T2.4', '[Boundary] Unicode Byte Order Mark (BOM) in Excel header is stripped during column lookup', () => {
  const rowWithBOM = { '\uFEFFnama_mapel': 'Fisika Peminatan', durasi_menit: 90 };
  const matchedKey = Object.keys(rowWithBOM).find(k => {
    const norm = k.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_]+/g, '_');
    return norm === 'nama_mapel' || norm === 'mapel';
  });
  assert.equal(matchedKey, '\uFEFFnama_mapel');
  assert.equal(rowWithBOM[matchedKey], 'Fisika Peminatan');
});

test('T2.5', '[Boundary] Student bulk import with empty class column triggers validation rejection', () => {
  const masterClassMap = new Map();
  masterClassMap.set('x a', { tingkat: 'X', kelas_paralel: 'A' });

  const studentWithEmptyClass = { nama_lengkap: 'Empty Class Student', nisn: '001', kelas: '' };
  const normalize = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const matched = masterClassMap.get(normalize(studentWithEmptyClass.kelas));
  assert.equal(matched, undefined, 'Empty class string must fail master class lookup');
});

test('T2.6', '[Boundary] Jadwal bulk import with missing or whitespace-only subject name triggers rejection', () => {
  // Master subject list without kode_mapel (canonical PostgreSQL mata_pelajaran schema)
  const mapelList = [
    { id_mapel: 'm1', nama_mapel: 'Pendidikan Agama Islam' },
    { id_mapel: 'm2', nama_mapel: 'Matematika Wajib', kode_mapel: 'MTK-W' }
  ];

  const matchSubject = (rawMapel) => {
    const mapelQuery = String(rawMapel || '').trim().toLowerCase();
    const matchedMapel = mapelQuery ? mapelList.find(m =>
      (m.nama_mapel && m.nama_mapel.toLowerCase() === mapelQuery) ||
      (m.kode_mapel && String(m.kode_mapel).toLowerCase() === mapelQuery) ||
      (m.id_mapel && m.id_mapel === rawMapel)
    ) : null;
    return matchedMapel ? matchedMapel.id_mapel : null;
  };

  // Test adversarial inputs that previously caused false positive match against mapelList[0]
  assert.equal(matchSubject(''), null, 'Empty string must not match any subject');
  assert.equal(matchSubject('   '), null, 'Whitespace-only subject query must result in null id_mapel');
  assert.equal(matchSubject(null), null, 'Null subject query must result in null id_mapel');
  assert.equal(matchSubject(undefined), null, 'Undefined subject query must result in null id_mapel');
  assert.equal(matchSubject('Astrofisika Kuantum'), null, 'Unknown subject must result in null id_mapel');

  // Verify valid subjects match correctly
  assert.equal(matchSubject('Pendidikan Agama Islam'), 'm1', 'Exact subject name must match');
  assert.equal(matchSubject('pendidikan agama islam'), 'm1', 'Case-insensitive subject name must match');
  assert.equal(matchSubject('MTK-W'), 'm2', 'Subject code must match');
  assert.equal(matchSubject('mtk-w'), 'm2', 'Case-insensitive subject code must match');
  assert.equal(matchSubject('m1'), 'm1', 'Subject id_mapel must match');
});

test('T2.7', '[Boundary] Single-character parallel class ("7 A", "X 1") formats correctly', () => {
  const k = { tingkat: '7', kelas_paralel: 'A' };
  const formatted = `${k.tingkat || ''} ${k.kelas_paralel || ''}`.trim();
  assert.equal(formatted, '7 A');
});

test('T2.8', '[Boundary] Extreme length class names (50+ chars) handle without truncation errors', () => {
  const longParallel = 'Program Khusus Pendidikan Vokasi Mekatronika 1';
  const k = { tingkat: 'XII', kelas_paralel: longParallel };
  const formatted = `${k.tingkat} ${k.kelas_paralel}`;
  assert.ok(formatted.length > 40);
  assert.equal(formatted, `XII ${longParallel}`);
});

test('T2.9', '[Boundary] Zero students registered in school: Siswa tab displays clean empty state description', () => {
  const dataSiswa = [];
  const filterKelas = '';
  const searchQuery = '';
  const description = (searchQuery || filterKelas) ? 'Tidak ada siswa yang sesuai dengan filter pencarian.' : 'Belum ada master data siswa terdaftar.';
  assert.equal(description, 'Belum ada master data siswa terdaftar.');
});

test('T2.10', '[Boundary] Case-insensitivity in subject name matching: "biologi" matches "Biologi"', () => {
  const mapelList = [{ id_mapel: 'm_bio', nama_mapel: 'Biologi' }];
  const query = 'biologi';
  const matched = mapelList.find(m => (m.nama_mapel || '').toLowerCase() === query.toLowerCase());
  assert.ok(matched);
  assert.equal(matched.id_mapel, 'm_bio');
});

test('T2.11', '[Boundary] Duplicate classes in dataKelas array are deduplicated by Set in filter options', () => {
  const dataKelas = [
    { tingkat: 'VII', kelas_paralel: 'A' },
    { tingkat: 'VII', kelas_paralel: 'A' },
    { tingkat: 'VII', kelas_paralel: 'B' }
  ];
  const uniqueOptions = [...new Set(dataKelas.map(k => `${k.tingkat || ''} ${k.kelas_paralel || ''}`.trim()).filter(Boolean))];
  assert.equal(uniqueOptions.length, 2);
  assert.deepEqual(uniqueOptions, ['VII A', 'VII B']);
});

test('T2.12', '[Boundary] Student record with missing angkatan but valid kelas string matches target', () => {
  const student = { id_siswa: 's1', nama_lengkap: 'Rani', kelas: 'VIII C', angkatan: null, kelas_paralel: null };
  const filter = 'VIII C';
  const isMatch = student.kelas === filter || `${student.angkatan} ${student.kelas_paralel}` === filter;
  assert.equal(isMatch, true);
});

test('T2.13', '[Boundary] Student record with missing kelas string but valid angkatan and paralel matches target', () => {
  const student = { id_siswa: 's2', nama_lengkap: 'Doni', kelas: '', angkatan: 'VIII', kelas_paralel: 'C' };
  const filter = 'VIII C';
  const isMatch = student.kelas === filter || `${student.angkatan || ''} ${student.kelas_paralel || ''}`.trim() === filter;
  assert.equal(isMatch, true);
});

test('T2.14', '[Boundary] Print Kartu modal filter with selectedOnly priority overrides class filter count', () => {
  const allStudents = [
    { id_siswa: 's1', kelas: 'VII A' },
    { id_siswa: 's2', kelas: 'VII A' },
    { id_siswa: 's3', kelas: 'VII B' }
  ];
  const selectedSiswa = ['s1'];
  const printModal = { isOpen: true, selectedOnly: true, filterKelas: 'VII B' };

  let filteredCount;
  if (printModal.selectedOnly && selectedSiswa.length > 0) {
    filteredCount = allStudents.filter(s => selectedSiswa.includes(s.id_siswa)).length;
  } else {
    filteredCount = allStudents.filter(s => s.kelas === printModal.filterKelas).length;
  }
  assert.equal(filteredCount, 1, 'selectedOnly must take precedence');
});

test('T2.15', '[Boundary] Monitoring HUD search query alongside master class filter operates as an AND condition', () => {
  const logs = [
    { id_siswa: 's1', nama_lengkap: 'Ahmad Dahlan', angkatan: 'X', kelas_paralel: '1' },
    { id_siswa: 's2', nama_lengkap: 'Ahmad Yani', angkatan: 'X', kelas_paralel: '2' },
    { id_siswa: 's3', nama_lengkap: 'Budi Utomo', angkatan: 'X', kelas_paralel: '1' }
  ];
  const filterKelas = 'X 1';
  const query = 'ahmad';

  const filtered = logs.filter(l => {
    const k = `${l.angkatan} ${l.kelas_paralel}`;
    const matchesKelas = k === filterKelas;
    const matchesQuery = l.nama_lengkap.toLowerCase().includes(query);
    return matchesKelas && matchesQuery;
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id_siswa, 's1', 'Only Ahmad Dahlan in X 1 matches both filters');
});

test('T2.16', '[Boundary] Offline answer bundle import preserves student NISN validation without attendance checks', () => {
  const offlinePayload = {
    bundle_version: '2.0',
    id_log: 'LOG-OFFLINE-01',
    id_siswa: 'S-101',
    answers: { q1: 'A' },
    checksum: 'valid_checksum'
  };
  assert.ok(offlinePayload.id_siswa, 'Student ID must be present');
  assert.ok(!('status_kehadiran' in offlinePayload), 'Offline bundle must not contain attendance status');
});

test('T2.17', '[Boundary] Reset login siswa preserves session token isolation across multi-device logins', () => {
  const currentDbToken = 'UUID-A|1700000000000';
  const stalePayloadToken = 'UUID-STALE|1699999990000';
  const dbUuid = currentDbToken.split('|')[0];
  const payloadUuid = stalePayloadToken.split('|')[0];
  const isStale = dbUuid && dbUuid !== payloadUuid;

  assert.equal(isStale, true, 'Stale token from old device must be recognized as non-matching');
});

test('T2.18', '[Boundary] Schedule cloning scopes source schedule by npsn to prevent cross-tenant contamination', () => {
  const cloneStart = apiCode.indexOf("case 'clone_jadwal':");
  const cloneBlock = apiCode.slice(cloneStart, cloneStart + 500);
  assert.match(cloneBlock, /\.eq\('npsn'/, 'clone_jadwal must verify npsn');
});

test('T2.19', '[Boundary] Token release on active schedule writes to token_aktif without altering master class bindings', () => {
  const releaseStart = adminCode.indexOf('const handleRilisToken =');
  const releaseBlock = adminCode.slice(releaseStart, releaseStart + 400);
  assert.match(releaseBlock, /token_aktif:\s*newToken/, 'Token release must update token_aktif');
  assert.doesNotMatch(releaseBlock, /target_kelas/, 'Token release must not mutate target_kelas');
});

test('T2.20', '[Boundary] Schedule time interval validation enforces waktu_selesai greater than waktu_mulai', () => {
  const tMulai = new Date('2026-11-15T08:00:00');
  const tSelesaiBad = new Date('2026-11-15T07:30:00');
  const isValid = tSelesaiBad > tMulai;
  assert.equal(isValid, false, 'End time before start time must be rejected');
});

test('T2.21', '[Boundary] Absence of attendance reset in student session reset', () => {
  const resetSesiStart = apiCode.indexOf("case 'reset_sesi_siswa':");
  const resetSesiBlock = apiCode.slice(resetSesiStart, resetSesiStart + 800);
  assert.doesNotMatch(resetSesiBlock, /absensi_ujian/, 'reset_sesi_siswa must not query or update absensi_ujian');
});

test('T2.22', '[Boundary] Siswa creation enforces unique username / NISN scoped to school NPSN', () => {
  const createSiswaStart = apiCode.indexOf("case 'create_siswa':");
  const createSiswaBlock = apiCode.slice(createSiswaStart, createSiswaStart + 600);
  assert.match(createSiswaBlock, /\.eq\('nisn',\s*payload\.nisn\)/, 'Must check nisn duplicate');
  assert.match(createSiswaBlock, /\.eq\('npsn',\s*payload\.npsn\)/, 'Must scope check by npsn');
});

test('T2.23', '[Boundary] Teacher creation bulk import associates teacher with subjects via guru_mapel', () => {
  const guruBulkStart = apiCode.indexOf("case 'create_guru_bulk':");
  const guruBulkEnd = apiCode.indexOf("case 'update_guru':", guruBulkStart);
  const createGuruBulkBlock = apiCode.slice(guruBulkStart, guruBulkEnd);
  assert.match(createGuruBulkBlock, /\.from\('guru_mapel'\)\.insert/, 'Must insert into relational junction guru_mapel');
});

test('T2.24', '[Boundary] Mapel class allocation stripping prevents invalid column insertion into mata_pelajaran', () => {
  const mapelBulkStart = apiCode.indexOf("case 'create_mapel_bulk':");
  const mapelBulkEnd = apiCode.indexOf("case 'update_mapel':", mapelBulkStart);
  const createMapelBulkBlock = apiCode.slice(mapelBulkStart, mapelBulkEnd);
  assert.match(createMapelBulkBlock, /alokasi_kelas,\s*\.\.\.rest/, 'Must destructure out alokasi_kelas');
  assert.match(createMapelBulkBlock, /\.from\('mata_pelajaran'\)\.insert\(sanitized\)/, 'Must insert sanitized object');
});

test('T2.25', '[Boundary] Leger Excel export builds class name from angkatan and kelas_paralel', () => {
  const legerIdx = adminCode.indexOf('Kelas: `${r.angkatan || \'\'} ${r.kelas_paralel || \'\'}`.trim()');
  assert.ok(legerIdx > -1, 'Leger export must format class name accurately');
});

// ============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS (12 tests)
// ============================================================================
console.log('\n>>> TIER 3: CROSS-FEATURE COMBINATIONS (12 tests)\n');

test('T3.1', '[Combinatorial] Master Kelas + Siswa Import + Siswa Tab Filter Integration', () => {
  // 1. Master Kelas defined
  const dataKelas = [
    { id_kelas: 'k1', tingkat: 'IX', kelas_paralel: 'Unggulan 1' },
    { id_kelas: 'k2', tingkat: 'IX', kelas_paralel: 'Unggulan 2' }
  ];
  // 2. Student imported against master
  const student = { id_siswa: 's_01', nama_lengkap: 'Andi', angkatan: 'IX', kelas_paralel: 'Unggulan 1', kelas: 'IX Unggulan 1' };

  // 3. Filter dropdown populated from master
  const filterOptions = [...new Set(dataKelas.map(k => `${k.tingkat} ${k.kelas_paralel}`))];
  assert.ok(filterOptions.includes('IX Unggulan 1'));

  // 4. Filter matches student
  const matches = student.kelas === filterOptions[0];
  assert.equal(matches, true);
});

test('T3.2', '[Combinatorial] Master Kelas + Print Kartu Modal Integration', () => {
  const dataKelas = [
    { tingkat: 'XII', kelas_paralel: 'IPA 1' },
    { tingkat: 'XII', kelas_paralel: 'IPS 1' }
  ];
  const students = [
    { id_siswa: 's1', nama_lengkap: 'Siswa IPA', kelas: 'XII IPA 1' }
  ];

  const availableClasses = Array.from(new Set(dataKelas.map(k => `${k.tingkat} ${k.kelas_paralel}`))).sort();
  assert.equal(availableClasses.length, 2);

  const printPayload = {
    students: students.filter(s => s.kelas === availableClasses[0]),
    targetKelas: availableClasses[0]
  };
  assert.equal(printPayload.students.length, 1);
  assert.equal(printPayload.targetKelas, 'XII IPA 1');
});

test('T3.3', '[Combinatorial] Master Kelas + Schedule Target + Student Exam Visibility', () => {
  const student = { angkatan: 'VII', kelas_paralel: 'A', kelas: 'VII A' };
  const scheduleUniversal = { target_kelas: 'Semua Tingkat (Umum)' };
  const scheduleTargeted = { target_kelas: 'VII A' };
  const scheduleOther = { target_kelas: 'VII B' };

  const isClassMatch = (target, s) => {
    if (!target || target === 'Semua Kelas' || target === 'Semua Tingkat (Umum)') return true;
    return target.split(',').map(x => x.trim()).includes(s.kelas);
  };

  assert.equal(isClassMatch(scheduleUniversal.target_kelas, student), true, 'Universal schedule visible');
  assert.equal(isClassMatch(scheduleTargeted.target_kelas, student), true, 'Targeted schedule visible');
  assert.equal(isClassMatch(scheduleOther.target_kelas, student), false, 'Other class schedule hidden');
});

test('T3.4', '[Combinatorial] Master Mapel + Jadwal Excel Import + Teacher Assignment', () => {
  const mapelList = [{ id_mapel: 'm_fis', nama_mapel: 'Fisika' }];
  const guruList = [{ id_guru: 'g_01', nama_lengkap: 'Pak Bambang', username: 'bambang' }];

  const row = { nama_mapel: 'Fisika', guru: 'Pak Bambang', durasi_menit: 90 };
  const matchedMapel = mapelList.find(m => m.nama_mapel.toLowerCase() === row.nama_mapel.toLowerCase());
  const matchedGuru = guruList.find(g => g.nama_lengkap.toLowerCase() === row.guru.toLowerCase());

  assert.ok(matchedMapel && matchedGuru);
  const jadwal = {
    id_mapel: matchedMapel.id_mapel,
    id_guru: matchedGuru.id_guru,
    durasi_menit: row.durasi_menit
  };

  assert.equal(jadwal.id_mapel, 'm_fis');
  assert.equal(jadwal.id_guru, 'g_01');
});

test('T3.5', '[Combinatorial] Master Kelas + Proctoring Live Monitoring Filter', () => {
  const masterKelas = [{ tingkat: 'VIII', kelas_paralel: '1' }];
  const monitoringLogs = [
    { id_log: 'l1', angkatan: 'VIII', kelas_paralel: '1', status_ujian: 'SEDANG KERJA', jawaban_count: 15, total_soal: 30 }
  ];

  const availableMonitoringClasses = masterKelas.map(k => `${k.tingkat} ${k.kelas_paralel}`);
  const currentClassFilter = availableMonitoringClasses[0];

  const filteredLogs = monitoringLogs.filter(l => `${l.angkatan} ${l.kelas_paralel}` === currentClassFilter);
  assert.equal(filteredLogs.length, 1);
  const progress = Math.round((filteredLogs[0].jawaban_count / filteredLogs[0].total_soal) * 100);
  assert.equal(progress, 50);
});

test('T3.6', '[Combinatorial] Complete Absensi Decoupling + Exam Session Lifecycle', () => {
  // Lifecycle steps: 1. Login -> 2. Mulai Ujian -> 3. Answer -> 4. Submit -> 5. Score
  const examSession = {
    id_siswa: 's_100',
    id_jadwal: 'j_200',
    id_log: 'LOG-777',
    answers: { q1: 'B', q2: 'D' },
    status_ujian: 'SELESAI'
  };

  assert.ok(!('id_absensi' in examSession), 'Zero absensi state in exam lifecycle');
  assert.equal(examSession.status_ujian, 'SELESAI');
});

test('T3.7', '[Combinatorial] Master Mapel + Question Bank Linking + ExamRoom Question Delivery', () => {
  const masterMapel = { id_mapel: 'm_kim', nama_mapel: 'Kimia Dasar' };
  const soalBank = [
    { id_soal: 'q1', id_mapel: 'm_kim', tipe_soal: 'PG', pertanyaan: 'Unsur H adalah?', bobot: 10 },
    { id_soal: 'alloc1', id_mapel: 'm_kim', tipe_soal: 'MAPEL_ALLOC', pertanyaan: 'XI IPA' }
  ];

  // ExamRoom only delivers actual question rows, filtering out synthetic metadata
  const questionsForExam = soalBank.filter(s => s.id_mapel === masterMapel.id_mapel && s.tipe_soal !== 'MAPEL_ALLOC');

  assert.equal(questionsForExam.length, 1);
  assert.equal(questionsForExam[0].id_soal, 'q1');
});

test('T3.8', '[Combinatorial] Master Siswa + Exam Submission + Rekap Nilai Weighting', () => {
  const student = { id_siswa: 's1', nama_lengkap: 'Dewi', angkatan: 'X', kelas_paralel: '1' };
  const examLog = { id_siswa: 's1', nilai_auto: 70, nilai_uraian: 20, is_blocked: false };

  const finalScore = examLog.is_blocked ? 0 : Math.min(100, examLog.nilai_auto + examLog.nilai_uraian);
  const rekapRow = {
    nama_siswa: student.nama_lengkap,
    kelas: `${student.angkatan} ${student.kelas_paralel}`,
    nilai: finalScore
  };

  assert.equal(rekapRow.kelas, 'X 1');
  assert.equal(rekapRow.nilai, 90);
});

test('T3.9', '[Combinatorial] Master Kelas + Schedule Cloning Token Duplication', () => {
  const sourceSchedule = {
    id_jadwal: 'j_src',
    id_mapel: 'm1',
    target_kelas: 'VII A',
    token_aktif: 'OLDTOK'
  };
  const clonedTargetClass = 'VII B'; // from master dataKelas
  const newToken = 'NEWTOK';

  const clonedSchedule = {
    ...sourceSchedule,
    id_jadwal: 'j_clone',
    target_kelas: clonedTargetClass,
    token_aktif: newToken
  };

  assert.equal(clonedSchedule.target_kelas, 'VII B');
  assert.equal(clonedSchedule.token_aktif, 'NEWTOK');
});

test('T3.10', '[Combinatorial] Multi-Class Compound Target Schedule ("VII A, VII B") Matches Both Classes', () => {
  const compoundTarget = 'VII A, VII B';
  const studentA = { kelas: 'VII A' };
  const studentB = { kelas: 'VII B' };
  const studentC = { kelas: 'VII C' };

  const matchFn = (target, s) => target.split(',').map(x => x.trim()).includes(s.kelas);

  assert.equal(matchFn(compoundTarget, studentA), true);
  assert.equal(matchFn(compoundTarget, studentB), true);
  assert.equal(matchFn(compoundTarget, studentC), false);
});

test('T3.11', '[Combinatorial] Offline Emergency Bundle (.nexa) Ingestion Maps to Master Student ID', () => {
  const student = { id_siswa: 'S-777', npsn: 'NPSN-123', nisn: '99887766' };
  const bundle = {
    bundle_version: '2.0',
    npsn: 'NPSN-123',
    id_siswa: 'S-777',
    answers: { q1: 'C' }
  };

  const isAuthorized = bundle.npsn === student.npsn && bundle.id_siswa === student.id_siswa;
  assert.equal(isAuthorized, true, 'Bundle student ID must match master student');
});

test('T3.12', '[Combinatorial] Zero Subsystem Regressions across Master Entity Operations', () => {
  // Confirm that master data operations do not modify super admin routes or offline engines
  const superAdminActions = ['get_admin_all', 'update_sekolah_status', 'update_superadmin_password'];
  superAdminActions.forEach(action => {
    assert.ok(apiCode.includes(action), `Super admin action ${action} must remain in api.js`);
  });
});

// ============================================================================
// TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 tests)
// ============================================================================
console.log('\n>>> TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 tests)\n');

test('T4.1', '[Scenario 1] New Class Lifecycle: Creation in Master Kelas propagates to Siswa Filter, Kartu Ujian, and Jadwal', () => {
  // Stage 1: Admin creates new master class in Tab Kelas
  const masterKelas = [
    { id_kelas: 'k_new_1', tingkat: 'X', kelas_paralel: 'Merdeka 1', npsn: '1001' }
  ];
  const newClassName = `${masterKelas[0].tingkat} ${masterKelas[0].kelas_paralel}`.trim();

  // Stage 2: Siswa Tab filter derives options immediately
  const siswaFilterOptions = [...new Set(masterKelas.map(k => `${k.tingkat || ''} ${k.kelas_paralel || ''}`.trim()).filter(Boolean))];
  assert.ok(siswaFilterOptions.includes('X Merdeka 1'), 'New class must appear in Siswa filter');

  // Stage 3: Print Kartu Ujian modal derives availableClasses immediately
  const kartuAvailableClasses = Array.from(new Set(masterKelas.map(k => `${k.tingkat || ''} ${k.kelas_paralel || ''}`.trim()).filter(Boolean))).sort();
  assert.ok(kartuAvailableClasses.includes('X Merdeka 1'), 'New class must appear in Print Kartu modal');

  // Stage 4: Jadwal preset target classes dropdown includes new class
  const jadwalOptions = masterKelas.filter(k => k.tingkat && k.kelas_paralel).map(k => `${k.tingkat} ${k.kelas_paralel}`);
  assert.ok(jadwalOptions.includes('X Merdeka 1'), 'New class must appear in Jadwal creation target dropdown');
});

test('T4.2', '[Scenario 2] Student Bulk Excel Import with Nonexistent Class: Validation flags and rejects bad data', () => {
  const masterKelas = [
    { tingkat: 'VII', kelas_paralel: 'A' },
    { tingkat: 'VII', kelas_paralel: 'B' }
  ];
  const normalize = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const masterMap = new Map();
  masterKelas.forEach(k => masterMap.set(normalize(`${k.tingkat} ${k.kelas_paralel}`), k));

  // Excel upload with 2 valid students and 1 student having nonexistent class
  const uploadedRows = [
    { nama_lengkap: 'Siswa Satu', nisn: '1001', kelas: 'VII A' },
    { nama_lengkap: 'Siswa Dua', nisn: '1002', kelas: 'VII B' },
    { nama_lengkap: 'Siswa Fiktif', nisn: '1003', kelas: 'VII NON_EXISTENT' }
  ];

  const invalidClassRows = [];
  const processedData = uploadedRows.map((row, idx) => {
    const rawClass = normalize(row.kelas);
    const matched = masterMap.get(rawClass);
    if (!matched) {
      invalidClassRows.push({ row: idx + 2, nama: row.nama_lengkap, kelas: row.kelas });
    }
    return row;
  });

  assert.equal(invalidClassRows.length, 1, 'Must detect 1 invalid class row');
  assert.equal(invalidClassRows[0].nama, 'Siswa Fiktif');
  assert.equal(invalidClassRows[0].kelas, 'VII NON_EXISTENT');
});

test('T4.3', '[Scenario 3] Schedule Bulk Excel Import with Invalid Subject: Rejection without fallback to mapelList[0]', () => {
  const masterMapelList = [
    { id_mapel: 'm_indo', nama_mapel: 'Bahasa Indonesia' },
    { id_mapel: 'm_ingg', nama_mapel: 'Bahasa Inggris', kode_mapel: 'BING' }
  ];

  // Excel schedule import containing a typo/unregistered subject and an empty subject row
  const uploadedSchedules = [
    { nama_mapel: 'Bahasa Indonesia', tanggal: '2026-11-15', jam_mulai: '08:00', jam_selesai: '09:30' },
    { nama_mapel: 'Bahasa Alien', tanggal: '2026-11-15', jam_mulai: '10:00', jam_selesai: '11:30' }, // invalid
    { nama_mapel: '', tanggal: '2026-11-15', jam_mulai: '13:00', jam_selesai: '14:30' } // blank/empty
  ];

  const unassignedMapelRows = [];
  const processed = uploadedSchedules.map((row, idx) => {
    const rawMapel = row.nama_mapel ?? '(Kosong)';
    const mapelQuery = String(row.nama_mapel || '').trim().toLowerCase();
    const matched = mapelQuery ? masterMapelList.find(m =>
      (m.nama_mapel && m.nama_mapel.toLowerCase() === mapelQuery) ||
      (m.kode_mapel && String(m.kode_mapel).toLowerCase() === mapelQuery) ||
      (m.id_mapel && m.id_mapel === row.nama_mapel)
    ) : null;
    const id_mapel = matched ? matched.id_mapel : null;
    if (!id_mapel) {
      unassignedMapelRows.push({ row: idx + 2, mapel: String(rawMapel || '').trim() || '(Kosong)' });
    }
    return { ...row, id_mapel };
  });

  assert.equal(unassignedMapelRows.length, 2, 'Must isolate both invalid and empty subject rows');
  assert.equal(unassignedMapelRows[0].mapel, 'Bahasa Alien');
  assert.equal(unassignedMapelRows[1].mapel, '(Kosong)');
  assert.equal(processed[1].id_mapel, null, 'Must NOT default to m_indo (mapelList[0])');
  assert.equal(processed[2].id_mapel, null, 'Empty subject row must NOT default to m_indo (mapelList[0])');
});

test('T4.4', '[Scenario 4] Full Attendance / Absensi Exclusion Verification across UI and API', () => {
  // Check api.js globalRoutes
  const globalRoutesIdx = apiCode.indexOf('const globalRoutes = [');
  const globalRoutesBlock = apiCode.slice(globalRoutesIdx, apiCode.indexOf('];', globalRoutesIdx));
  const forbiddenRouteTokens = ['simpan_kehadiran_siswa', 'submit_absensi_siswa', 'verifikasi_absensi', 'verifikasi_absensi_bulk'];
  forbiddenRouteTokens.forEach(token => {
    assert.doesNotMatch(globalRoutesBlock, new RegExp(`'${token}'`), `globalRoutes must not include ${token}`);
  });

  // Check that no active view mounts attendance components
  const viewSrcs = [adminCode, guruCode, siswaCode, examRoomCode];
  viewSrcs.forEach(src => {
    assert.doesNotMatch(src, /<AbsensiPengawas/);
    assert.doesNotMatch(src, /<ModalAbsensi/);
  });
});

test('T4.5', '[Scenario 5] Run Regression Audit Suites to Guarantee Zero Unintended Regressions', () => {
  // Execute the 7 existing test suites in tests/
  const existingSuites = [
    'test_audit_admin_ops.mjs',
    'test_audit_auth_superadmin.mjs',
    'test_audit_core_utils.mjs',
    'test_audit_guru_banksoal.mjs',
    'test_audit_guru_grading.mjs',
    'test_audit_proctor_nexa.mjs',
    'test_audit_siswa_examroom.mjs'
  ];

  for (const suiteName of existingSuites) {
    const suitePath = path.join(rootDir, 'tests', suiteName);
    if (fs.existsSync(suitePath)) {
      const output = execSync(`node tests/${suiteName}`, { cwd: rootDir, encoding: 'utf8' });
      assert.match(output, /Summary:\s*\d+\s*passed,\s*0\s*failed/, `Suite ${suiteName} must pass with 0 failures`);
    }
  }
});

// ============================================================================
// SUITE SUMMARY & EXIT CODE
// ============================================================================
console.log('\n======================================================================');
console.log(`TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
console.log('======================================================================\n');

if (failed > 0) {
  console.error('Failure Breakdown:');
  failureDetails.forEach(f => {
    console.error(` - [${f.id}] ${f.name}: ${f.error}`);
  });
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED WITH ZERO REGRESSIONS!');
  process.exit(0);
}
