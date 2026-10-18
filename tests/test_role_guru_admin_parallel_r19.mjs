import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('=== TEST SUITE: ROLE GURU & ADMIN PARALLEL IMPROVEMENTS (R19) ===\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
  }
}

// =========================================================================
// R1: AIKEN CLEANUP TESTS
// =========================================================================
runTest('R1.1 - GuruView.jsx has no Aiken import or Aiken modal JSX', () => {
  const content = fs.readFileSync('src/views/GuruView.jsx', 'utf8');
  assert.strictEqual(content.includes('parseAiken'), false, 'GuruView must not import or reference parseAiken');
  assert.strictEqual(content.includes('prepareAikenPayload'), false, 'GuruView must not reference prepareAikenPayload');
  assert.strictEqual(content.includes('Import Soal Format Aiken'), false, 'GuruView must not contain Aiken modal JSX');
  assert.strictEqual(content.includes('Import Aiken'), false, 'GuruView must not contain Import Aiken button');
  assert.strictEqual(content.includes('handleSaveImportAiken'), false, 'GuruView must not contain handleSaveImportAiken');
  assert.strictEqual(content.includes('handleAikenFileUpload'), false, 'GuruView must not contain handleAikenFileUpload');
});

runTest('R1.2 - FormSoalModal.jsx has no Aiken quick paste or Aiken imports', () => {
  const content = fs.readFileSync('src/components/FormSoalModal.jsx', 'utf8');
  assert.strictEqual(content.includes('parseAiken'), false, 'FormSoalModal must not import parseAiken');
  assert.strictEqual(content.includes('showAikenQuickPaste'), false, 'FormSoalModal must not contain showAikenQuickPaste');
  assert.strictEqual(content.includes('Tempel Cepat Format Aiken'), false, 'FormSoalModal must not contain Aiken quick paste panel');
  assert.strictEqual(content.includes('handleApplyAiken'), false, 'FormSoalModal must not contain handleApplyAiken');
});

// =========================================================================
// R2: STANDARDIZE WACANA TO NARASI SOAL TESTS
// =========================================================================
runTest('R2.1 - FormNarasiModal.jsx has ZERO occurrences of "wacana"', () => {
  const content = fs.readFileSync('src/components/FormNarasiModal.jsx', 'utf8');
  const matches = content.match(/wacana/gi) || [];
  assert.strictEqual(matches.length, 0, `FormNarasiModal must have 0 occurrences of wacana, found: ${matches.length}`);
  assert.strictEqual(content.includes('Narasi Soal'), true, 'FormNarasiModal must reference Narasi Soal');
});

runTest('R2.2 - ExamRoom.jsx has ZERO occurrences of "wacana"', () => {
  const content = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8');
  const matches = content.match(/wacana/gi) || [];
  assert.strictEqual(matches.length, 0, `ExamRoom must have 0 occurrences of wacana, found: ${matches.length}`);
});

runTest('R2.3 - GuruView.jsx user-facing labels use "Narasi Soal"', () => {
  const content = fs.readFileSync('src/views/GuruView.jsx', 'utf8');
  assert.strictEqual(content.includes('Tambah Narasi Soal'), true, 'GuruView must have Tambah Narasi Soal button title');
  assert.strictEqual(content.includes('Edit Narasi Soal'), true, 'GuruView must support Edit Narasi Soal');
  assert.strictEqual(content.includes('NARASI SOAL'), true, 'GuruView must have NARASI SOAL badge in getTipeBadge');
  // Check that bank_soal subtitle uses narasi soal stimulus
  assert.strictEqual(content.includes('narasi soal stimulus'), true, 'GuruView bank_soal tabSubtitleMap must use narasi soal stimulus');
});

// =========================================================================
// R3: UNIFIED MONITORING MENU TESTS
// =========================================================================
runTest('R3.1 - GuruView navGroups has unified Monitoring menu and no separate kontrol menu', () => {
  const content = fs.readFileSync('src/views/GuruView.jsx', 'utf8');
  // In navGroups items:
  assert.strictEqual(content.includes("{ id: 'monitoring', label: 'Monitoring', icon: 'visibility' }"), true, 'Monitoring menu must be present with icon visibility');
  assert.strictEqual(content.includes("{ id: 'kontrol', label: 'Kontrol Ujian'"), false, 'Kontrol Ujian menu item must be removed from navGroups');
  assert.strictEqual(content.includes("{ id: 'monitoring', label: 'Monitoring', icon: 'visibility' }"), true, 'Bottom bar must include Monitoring');
});

runTest('R3.2 - GuruView integrates session controls, token release, time extension, and Proctoring HUD', () => {
  const content = fs.readFileSync('src/views/GuruView.jsx', 'utf8');
  // Unified tab handles both monitoring and kontrol
  assert.strictEqual(content.includes("activeTab === 'monitoring' || activeTab === 'kontrol'"), true, 'Monitoring tab must handle activeTab');
  // Exam extension handler
  assert.strictEqual(content.includes('const handlePerpanjangWaktu = async (id_jadwal, extraMinutes = 15) => {'), true, 'handlePerpanjangWaktu must be implemented');
  assert.strictEqual(content.includes('handlePerpanjangWaktu('), true, 'handlePerpanjangWaktu must be invoked in JSX');
  assert.strictEqual(content.includes('handleGenerateToken('), true, 'handleGenerateToken must be available in Monitoring tab');
  assert.strictEqual(content.includes('handleUpdateStatusUjian('), true, 'handleUpdateStatusUjian must be available in Monitoring tab');
  assert.strictEqual(content.includes('Buka Proctoring HUD'), true, 'Overview must provide button to open Proctoring HUD');
  assert.strictEqual(content.includes('monitoringMetrics.total'), true, 'HUD metrics must be rendered');
  assert.strictEqual(content.includes('handleResetSession'), true, 'Reset session action must be present in HUD');
  assert.strictEqual(content.includes('handleForceStop'), true, 'Force stop action must be present in HUD');
});

// =========================================================================
// R4: PARALLEL CLASS ALLOCATION & MATCHING TESTS
// =========================================================================
runTest('R4.1 - isClassMatching accurate evaluation across parallel classes and grades', async () => {
  const { isClassMatching } = await import('../src/api.js');

  // Test 1: Specific parallel class match
  assert.strictEqual(isClassMatching('XI A', { angkatan: 'XI', kelas_paralel: 'A' }), true, 'XI A must match student in XI A');
  assert.strictEqual(isClassMatching('XI A', { angkatan: 'XI', kelas_paralel: 'B' }), false, 'XI A must NOT match student in XI B');
  assert.strictEqual(isClassMatching('XI A', { kelas: 'XI A' }), true, 'XI A must match student with kelas "XI A"');
  assert.strictEqual(isClassMatching('XI A', { kelas: 'XI B' }), false, 'XI A must NOT match student with kelas "XI B"');
  assert.strictEqual(isClassMatching('XI A', { kelas: 'XI|A' }), true, 'XI A must match student with kelas "XI|A"');
  assert.strictEqual(isClassMatching('XI A', { kelas: 'XI|B' }), false, 'XI A must NOT match student with kelas "XI|B"');

  // Test 2: Grade level (all parallel classes in grade match)
  assert.strictEqual(isClassMatching('Tingkat XI (Semua)', { angkatan: 'XI', kelas_paralel: 'A' }), true, 'Grade XI (Semua) matches XI A');
  assert.strictEqual(isClassMatching('Tingkat XI (Semua)', { angkatan: 'XI', kelas_paralel: 'B' }), true, 'Grade XI (Semua) matches XI B');
  assert.strictEqual(isClassMatching('Tingkat XI (Semua)', { angkatan: 'XII', kelas_paralel: 'A' }), false, 'Grade XI (Semua) must NOT match XII A');
  assert.strictEqual(isClassMatching('Tingkat XI', { angkatan: 'XI', kelas_paralel: 'B' }), true, 'Tingkat XI matches XI B');
  assert.strictEqual(isClassMatching('Tingkat XI', { angkatan: 'X', kelas_paralel: 'B' }), false, 'Tingkat XI must NOT match X B');

  // Test 3: Roman numeral distinction (XII vs XI vs X)
  assert.strictEqual(isClassMatching('Tingkat X (Semua)', { angkatan: 'XI', kelas_paralel: 'A' }), false, 'Tingkat X must NOT match XI A');
  assert.strictEqual(isClassMatching('Tingkat XI (Semua)', { angkatan: 'XII', kelas_paralel: 'A' }), false, 'Tingkat XI must NOT match XII A');

  // Test 4: Universal targets
  assert.strictEqual(isClassMatching('Semua Kelas', { angkatan: 'XI', kelas_paralel: 'A' }), true, 'Semua Kelas matches all');
  assert.strictEqual(isClassMatching('', { angkatan: 'XI', kelas_paralel: 'B' }), true, 'Empty target matches all');
  assert.strictEqual(isClassMatching(null, { angkatan: 'XI', kelas_paralel: 'B' }), true, 'Null target matches all');

  // Test 5: Normalized dashes and whitespace
  assert.strictEqual(isClassMatching('XI-A', { angkatan: 'XI', kelas_paralel: 'A' }), true, 'XI-A matches XI A');
  assert.strictEqual(isClassMatching('XI-A', { angkatan: 'XI', kelas_paralel: 'B' }), false, 'XI-A must NOT match XI B');
});

runTest('R4.2 - src/api.js persists alokasi_kelas and excludes MAPEL_ALLOC metadata from questions', async () => {
  const content = fs.readFileSync('src/api.js', 'utf8');
  assert.strictEqual(content.includes('export const saveMapelAlokasi ='), true, 'saveMapelAlokasi must be exported');
  assert.strictEqual(content.includes('export const deleteMapelAlokasi ='), true, 'deleteMapelAlokasi must be exported');
  assert.strictEqual(content.includes('saveMapelAlokasi('), true, 'create_mapel and update_mapel must call saveMapelAlokasi');
  assert.strictEqual(content.includes('deleteMapelAlokasi('), true, 'delete_mapel must call deleteMapelAlokasi');
  assert.strictEqual(content.includes('tipe_soal !== \'MAPEL_ALLOC\''), true, 'get_all_mapel and question filters must exclude MAPEL_ALLOC');
  assert.strictEqual(content.includes('.neq(\'tipe_soal\', \'MAPEL_ALLOC\')'), true, 'Supabase queries must filter neq MAPEL_ALLOC');
  assert.strictEqual(content.includes('isClassMatching(j.target_kelas, siswaData)'), true, 'get_jadwal must filter by isClassMatching');
});

runTest('R4.3 - AdminView.jsx supports alokasi_kelas in Mapel form, Master Mapel cards, and Jadwal form', () => {
  const content = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
  // Mapel form alokasi_kelas
  assert.strictEqual(content.includes('name="alokasi_kelas"'), true, 'AdminView Mapel form must have alokasi_kelas select');
  assert.strictEqual(content.includes('value="Semua Kelas">Semua Kelas (Umum)'), true, 'Alokasi Kelas must have Semua Kelas option');
  assert.strictEqual(content.includes('Kelas Paralel Spesifik'), true, 'Alokasi Kelas must have Kelas Paralel Spesifik group');

  // Master Mapel card badges
  assert.strictEqual(content.includes('{m.alokasi_kelas || \'Semua Kelas\'}'), true, 'Master Mapel card must render parallel class badge');

  // Jadwal form auto-adjustment
  assert.strictEqual(content.includes('input_jadwal_target_kelas'), true, 'Jadwal form must have target_kelas select with ID for auto-adjustment');
  assert.strictEqual(content.includes('const selectedM = dataMapel.find('), true, 'Jadwal form mapel select must auto-adjust target_kelas');
});

runTest('R4.4 - SiswaView.jsx implements defense-in-depth isClassMatching filtering', () => {
  const content = fs.readFileSync('src/views/SiswaView.jsx', 'utf8');
  assert.strictEqual(content.includes('isClassMatching(j.target_kelas, user)'), true, 'SiswaView must filter todaySchedules and filteredJadwalList with isClassMatching');
  assert.strictEqual(content.includes('import { fetchAPI, isClassMatching } from \'../api.js\';'), true, 'SiswaView must import isClassMatching from ../api.js');
});

console.log(`\n==================================================`);
console.log(`SUMMARY: ${passedTests} / ${totalTests} test suites passed.`);
console.log(`==================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
