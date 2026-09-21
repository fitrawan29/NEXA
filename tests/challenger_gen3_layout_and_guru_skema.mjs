#!/usr/bin/env node
/**
 * Empirical Challenger Gen3 Test Suite:
 * Layout CSS/DOM Hierarchy & Guru Account Menu Grading Scheme
 *
 * File: tests/challenger_gen3_layout_and_guru_skema.mjs
 *
 * Verifies:
 * 1. CSS Layout & DOM Hierarchy across SuperAdminView.jsx, AdminView.jsx, GuruView.jsx, and SiswaView.jsx
 *    - Outer container has h-[100dvh] or h-screen, and overflow-hidden
 *    - Content area has overflow-y-auto
 *    - Top header has flex-shrink-0 (or shrink-0)
 *    - Bottom bar has fixed bottom-0 or flex-shrink-0 (or shrink-0)
 * 2. Guru Account Menu (`activeTab === 'akun'`) Grading Scheme Integration
 *    - Section existence, subject selection dropdown, dynamic question fetching
 *    - SkemaPenilaianPanel mounting and onSave handler (saveSkemaAccount)
 * 3. Functional Simulation of Grading Scheme Persistence
 *    - Default format (bobot: 0, mode: 'default', inputs disabled)
 *    - Custom format (bobot: 1, mode: 'custom', sum = 100% enforcement)
 *    - Boundary conditions: reject != 100%, accept == 100%, legacy migration, malformed JSON
 * 4. Live Database Integration Roundtrip with Supabase
 *    - Create, query, update, and delete SKEMA_PENILAIAN record in soal_ujian table
 *    - Confirm exam filtering excludes SKEMA_PENILAIAN
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inKodeNexa = __dirname.includes('kode NEXA');
const projectRoot = inKodeNexa ? path.resolve(__dirname, '..') : path.resolve(__dirname, '..', 'kode NEXA');

const report = {
  total: 0,
  passed: 0,
  failed: 0,
  categories: {},
  failures: []
};

function recordTest(category, name, condition, details = '') {
  if (!report.categories[category]) {
    report.categories[category] = { passed: 0, failed: 0 };
  }
  report.total++;
  if (condition) {
    report.passed++;
    report.categories[category].passed++;
    console.log(`  ✔ [PASS] [${category}] ${name}`);
  } else {
    report.failed++;
    report.categories[category].failed++;
    report.failures.push({ category, name, details });
    console.log(`  ✖ [FAIL] [${category}] ${name}${details ? ` -> ${details}` : ''}`);
  }
}

console.log('======================================================================');
console.log('  CHALLENGER GEN3: LAYOUT PINNING & GURU GRADING SCHEME SUITE         ');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// Load Target Source Files
// -----------------------------------------------------------------------------
const superAdminPath = path.resolve(projectRoot, 'src', 'views', 'SuperAdminView.jsx');
const adminPath = path.resolve(projectRoot, 'src', 'views', 'AdminView.jsx');
const guruPath = path.resolve(projectRoot, 'src', 'views', 'GuruView.jsx');
const siswaPath = path.resolve(projectRoot, 'src', 'views', 'SiswaView.jsx');
const skemaPanelPath = path.resolve(projectRoot, 'src', 'components', 'SkemaPenilaianPanel.jsx');
const apiPath = path.resolve(projectRoot, 'src', 'api.js');

const superAdminCode = fs.readFileSync(superAdminPath, 'utf8');
const adminCode = fs.readFileSync(adminPath, 'utf8');
const guruCode = fs.readFileSync(guruPath, 'utf8');
const siswaCode = fs.readFileSync(siswaPath, 'utf8');
const skemaPanelCode = fs.readFileSync(skemaPanelPath, 'utf8');
const apiCode = fs.readFileSync(apiPath, 'utf8');

// =============================================================================
// CATEGORY 1: AST Syntax Verification
// =============================================================================
console.log('▶ CATEGORY 1: AST Syntax & File Parse Integrity');

const parseFile = (name, code) => {
  try {
    parse(code, { sourceType: 'module', plugins: ['jsx'] });
    recordTest('AST', `${name} parses cleanly with zero syntax errors`, true);
    return true;
  } catch (e) {
    recordTest('AST', `${name} parses cleanly with zero syntax errors`, false, e.message);
    return false;
  }
};

parseFile('SuperAdminView.jsx', superAdminCode);
parseFile('AdminView.jsx', adminCode);
parseFile('GuruView.jsx', guruCode);
parseFile('SiswaView.jsx', siswaCode);
parseFile('SkemaPenilaianPanel.jsx', skemaPanelCode);
parseFile('api.js', apiCode);

// =============================================================================
// CATEGORY 2: Layout Pinning & DOM Hierarchy Stress Testing
// =============================================================================
console.log('\n▶ CATEGORY 2: Layout Pinning & Viewport Shell Invariants');

// 2.1 SuperAdminView.jsx
console.log('  Testing SuperAdminView.jsx Layout...');
const saOuterHasH = superAdminCode.includes('h-[100dvh]') || superAdminCode.includes('h-screen');
const saOuterHasOverflowHidden = superAdminCode.includes('overflow-hidden flex flex-col h-[100dvh]') || (saOuterHasH && superAdminCode.includes('overflow-hidden'));
recordTest('Layout: SuperAdmin', 'Outer container specifies h-[100dvh] or h-screen', saOuterHasH);
recordTest('Layout: SuperAdmin', 'Outer container specifies overflow-hidden', saOuterHasOverflowHidden);

const saContentHasScroll = /flex-1\s+overflow-y-auto/.test(superAdminCode);
recordTest('Layout: SuperAdmin', 'Content area specifies overflow-y-auto', saContentHasScroll);

// Check Top Header in SuperAdminView:
// The top section is `<div className="bg-[#3ecf8e] rounded-none px-6 pt-4 pb-4 relative text-white shadow-md z-0">`
const saHeaderSlice = superAdminCode.substring(
  superAdminCode.indexOf('Header / Top Section'),
  superAdminCode.indexOf('Main Scrollable Content')
);
const saHeaderHasFlexShrink0 = saHeaderSlice.includes('flex-shrink-0') || saHeaderSlice.includes('shrink-0');
// Note: In SuperAdminView, line 181 has `bg-[#3ecf8e] rounded-none px-6 pt-4 pb-4 relative text-white shadow-md z-0` without flex-shrink-0.
// Line 184 has flex-shrink-0 on the avatar circle, but the outer header container lacks flex-shrink-0!
const saHeaderOuterDivMatches = saHeaderSlice.match(/<div\s+className="([^"]*bg-\[#3ecf8e\][^"]*)"/);
const saHeaderOuterClasses = saHeaderOuterDivMatches ? saHeaderOuterDivMatches[1] : '';
const saHeaderOuterHasShrink0 = saHeaderOuterClasses.includes('flex-shrink-0') || saHeaderOuterClasses.includes('shrink-0');

recordTest(
  'Layout: SuperAdmin',
  'Top header container has flex-shrink-0 or shrink-0 to prevent flex compression',
  saHeaderOuterHasShrink0,
  `Actual header classes: "${saHeaderOuterClasses}" - missing flex-shrink-0 / shrink-0`
);

const saBottomNavSlice = superAdminCode.substring(superAdminCode.indexOf('Bottom Navigation'));
const saBottomHasFixedOrShrink = saBottomNavSlice.includes('fixed bottom-0') || saBottomNavSlice.includes('flex-shrink-0') || saBottomNavSlice.includes('shrink-0');
recordTest('Layout: SuperAdmin', 'Bottom navigation specifies fixed bottom-0 or flex-shrink-0', saBottomHasFixedOrShrink);

// 2.2 AdminView.jsx
console.log('  Testing AdminView.jsx Layout...');
const adminOuterHasH = adminCode.includes('h-[100dvh]') || adminCode.includes('h-screen');
const adminOuterHasOverflow = adminCode.includes('h-[100dvh] overflow-hidden') || (adminOuterHasH && adminCode.includes('overflow-hidden'));
recordTest('Layout: Admin', 'Outer container specifies h-[100dvh] or h-screen', adminOuterHasH);
recordTest('Layout: Admin', 'Outer container specifies overflow-hidden', adminOuterHasOverflow);

const adminContentHasScroll = /flex-1\s+overflow-y-auto\s+w-full/.test(adminCode);
recordTest('Layout: Admin', 'Content area specifies overflow-y-auto', adminContentHasScroll);

const adminMobileHeaderHasShrink0 = adminCode.includes('header className="lg:hidden flex-shrink-0');
const adminDesktopHeaderHasShrink0 = adminCode.includes('header className="hidden lg:flex flex-shrink-0');
recordTest('Layout: Admin', 'Mobile topbar specifies flex-shrink-0', adminMobileHeaderHasShrink0);
recordTest('Layout: Admin', 'Desktop header specifies flex-shrink-0', adminDesktopHeaderHasShrink0);

const adminBottomBarHasFixedAndShrink = adminCode.includes('fixed bottom-0') && (adminCode.includes('flex-shrink-0') || adminCode.includes('shrink-0'));
recordTest('Layout: Admin', 'Bottom navigation specifies fixed bottom-0 and flex-shrink-0', adminBottomBarHasFixedAndShrink);

// 2.3 GuruView.jsx
console.log('  Testing GuruView.jsx Layout...');
const guruOuterHasH = guruCode.includes('h-[100dvh]') || guruCode.includes('h-screen');
const guruOuterHasOverflow = guruCode.includes('h-[100dvh] overflow-hidden') || (guruOuterHasH && guruCode.includes('overflow-hidden'));
recordTest('Layout: Guru', 'Outer container specifies h-[100dvh] or h-screen', guruOuterHasH);
recordTest('Layout: Guru', 'Outer container specifies overflow-hidden', guruOuterHasOverflow);

const guruContentHasScroll = /flex-1\s+overflow-y-auto\s+w-full/.test(guruCode);
recordTest('Layout: Guru', 'Content area specifies overflow-y-auto', guruContentHasScroll);

const guruMobileHeaderHasShrink0 = guruCode.includes('header className="lg:hidden flex-shrink-0');
const guruDesktopHeaderHasShrink0 = guruCode.includes('header className="hidden lg:flex flex-shrink-0');
recordTest('Layout: Guru', 'Mobile topbar specifies flex-shrink-0', guruMobileHeaderHasShrink0);
recordTest('Layout: Guru', 'Desktop header specifies flex-shrink-0', guruDesktopHeaderHasShrink0);

const guruBottomBarHasFixedAndShrink = guruCode.includes('fixed bottom-0') && (guruCode.includes('flex-shrink-0') || guruCode.includes('shrink-0'));
recordTest('Layout: Guru', 'Bottom navigation specifies fixed bottom-0 and flex-shrink-0', guruBottomBarHasFixedAndShrink);

// 2.4 SiswaView.jsx
console.log('  Testing SiswaView.jsx Layout...');
const siswaOuterHasH = siswaCode.includes('h-[100dvh]') || siswaCode.includes('h-screen');
const siswaOuterHasOverflow = siswaCode.includes('h-[100dvh] overflow-hidden') || (siswaOuterHasH && siswaCode.includes('overflow-hidden'));
recordTest('Layout: Siswa', 'Outer container specifies h-[100dvh] or h-screen', siswaOuterHasH);
recordTest('Layout: Siswa', 'Outer container specifies overflow-hidden', siswaOuterHasOverflow);

const siswaContentHasScroll = /flex-1\s+overflow-y-auto\s+w-full/.test(siswaCode);
recordTest('Layout: Siswa', 'Content area specifies overflow-y-auto', siswaContentHasScroll);

const siswaDesktopHeaderHasShrink0 = siswaCode.includes('header className="hidden md:block flex-shrink-0');
const siswaMobileHeaderHasShrink0 = siswaCode.includes('div className="md:hidden flex-shrink-0');
recordTest('Layout: Siswa', 'Desktop header specifies flex-shrink-0', siswaDesktopHeaderHasShrink0);
recordTest('Layout: Siswa', 'Mobile header banner specifies flex-shrink-0', siswaMobileHeaderHasShrink0);

const siswaBottomBarHasFixedAndShrink = siswaCode.includes('fixed bottom-0') && (siswaCode.includes('flex-shrink-0') || siswaCode.includes('shrink-0'));
recordTest('Layout: Siswa', 'Mobile bottom navigation specifies fixed bottom-0 and flex-shrink-0', siswaBottomBarHasFixedAndShrink);

// =============================================================================
// CATEGORY 3: Guru Account Menu (`activeTab === 'akun'`) Grading Scheme Integration
// =============================================================================
console.log('\n▶ CATEGORY 3: Guru Account Menu Grading Scheme Architectural Conformance');

const hasAkunSection = guruCode.includes("activeTab === 'akun'");
recordTest('Guru Akun Scheme', 'GuruView renders dedicated section for activeTab === "akun"', hasAkunSection);

const hasSkemaHeadingInAkun = guruCode.includes('Pengaturan Skema Penilaian') && guruCode.includes('Atur model penilaian per mata pelajaran atau pilih format default dari admin sekolah');
recordTest('Guru Akun Scheme', 'Renders explicit "Pengaturan Skema Penilaian" heading and description in akun tab', hasSkemaHeadingInAkun);

const hasSubjectDropdown = guruCode.includes('value={selectedMapelAccount}') && guruCode.includes('onChange={(e) => setSelectedMapelAccount(e.target.value)}');
recordTest('Guru Akun Scheme', 'Subject selection dropdown is bound to selectedMapelAccount state', hasSubjectDropdown);

const hasInitialMapelSelectEffect = /if\s*\(activeTab\s*===\s*['"]akun['"]\)\s*\{\s*if\s*\(!selectedMapelAccount\s*&&\s*dataMapel\.length\s*>\s*0\)\s*\{\s*setSelectedMapelAccount\(dataMapel\[0\]\.id_mapel\);/.test(guruCode);
recordTest('Guru Akun Scheme', 'Auto-selects first assigned subject on entering akun tab if unselected', hasInitialMapelSelectEffect);

const hasDynamicSoalFetchEffect = guruCode.includes("api('get_soal_by_mapel', { id_mapel: selectedMapelAccount })");
recordTest('Guru Akun Scheme', 'Fetches mapel questions dynamically when selectedMapelAccount changes', hasDynamicSoalFetchEffect);

const hasSkemaPanelMountInAkun = guruCode.includes('<SkemaPenilaianPanel') && guruCode.includes('dataSoal={accountDataSoal}') && guruCode.includes('onSave={saveSkemaAccount}');
recordTest('Guru Akun Scheme', 'Mounts <SkemaPenilaianPanel dataSoal={accountDataSoal} onSave={saveSkemaAccount} /> in akun tab', hasSkemaPanelMountInAkun);

// saveSkemaAccount implementation checks
const hasSaveSkemaAccountDef = guruCode.includes('const saveSkemaAccount = async (payload) =>');
recordTest('Guru Akun Scheme', 'Defines dedicated saveSkemaAccount handler', hasSaveSkemaAccountDef);

const hasSkemaRecordLookup = guruCode.includes("accountDataSoal.find(s => s.tipe_soal === 'SKEMA_PENILAIAN')");
recordTest('Guru Akun Scheme', 'saveSkemaAccount looks up existing SKEMA_PENILAIAN in accountDataSoal', hasSkemaRecordLookup);

const hasDeterministicIdGen = guruCode.includes("'SKEMA-' + selectedMapelAccount");
recordTest('Guru Akun Scheme', 'saveSkemaAccount generates deterministic id_soal ("SKEMA-" + selectedMapelAccount) when none exists', hasDeterministicIdGen);

const hasEndpointBranching = guruCode.includes("skemaRecord ? 'update_soal_mapel' : 'create_soal_mapel'");
recordTest('Guru Akun Scheme', 'saveSkemaAccount branches between update_soal_mapel and create_soal_mapel', hasEndpointBranching);

const hasPostSaveRefresh = guruCode.includes("const soalRes = await api('get_soal_by_mapel', { id_mapel: selectedMapelAccount });") && guruCode.includes('setAccountDataSoal(soalRes.data || []);');
recordTest('Guru Akun Scheme', 'saveSkemaAccount re-fetches and updates accountDataSoal state after successful save', hasPostSaveRefresh);

// =============================================================================
// CATEGORY 4: Functional Grading Scheme Simulation & Fuzzing
// =============================================================================
console.log('\n▶ CATEGORY 4: Functional Simulation of SkemaPenilaianPanel Logic');

function simulateSkemaPanel(initialDataSoal = []) {
  const defaultSkema = { PG: 0, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 };
  let mode = 'default';
  let skema = { ...defaultSkema };

  const skemaRecord = initialDataSoal?.find(s => s.tipe_soal === 'SKEMA_PENILAIAN');
  if (skemaRecord && skemaRecord.kunci_jawaban) {
    let parsed = null;
    try {
      parsed = JSON.parse(skemaRecord.kunci_jawaban);
    } catch {
      parsed = null;
    }
    if (parsed) {
      if (parsed.mode) {
        mode = parsed.mode;
        if (parsed.skema) {
          skema = { ...defaultSkema, ...parsed.skema };
        }
      } else {
        const hasCustomWeights = Object.values(parsed).some(v => parseFloat(v) > 0);
        mode = hasCustomWeights ? 'custom' : 'default';
        skema = { ...defaultSkema, ...parsed };
      }
    }
  }

  const hitungTotalPersentase = () => {
    return Object.values(skema).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
  };

  const handleSave = (onSave, onAlert) => {
    if (mode === 'custom') {
      const total = hitungTotalPersentase();
      if (total !== 100) {
        if (onAlert) onAlert(`Total persentase bobot skema khusus harus tepat 100%. Saat ini: ${total}%. Silakan sesuaikan kembali.`);
        return false;
      }
      const payload = {
        kunci_jawaban: JSON.stringify({
          mode: 'custom',
          skema
        }),
        bobot: 1
      };
      if (onSave) onSave(payload);
      return true;
    } else {
      const payload = {
        kunci_jawaban: JSON.stringify({
          mode: 'default',
          skema: defaultSkema
        }),
        bobot: 0
      };
      if (onSave) onSave(payload);
      return true;
    }
  };

  return {
    getMode: () => mode,
    setMode: (m) => { mode = m; },
    getSkema: () => ({ ...skema }),
    setAllSkema: (s) => { skema = { ...s }; },
    hitungTotalPersentase,
    handleSave,
    isInputDisabled: () => mode === 'default'
  };
}

// 4.1 Default Mode Behavior
const pDefault = simulateSkemaPanel([]);
recordTest('Simulation: Default', 'Starts in default mode with disabled inputs', pDefault.getMode() === 'default' && pDefault.isInputDisabled());

let defPayload = null;
pDefault.handleSave((p) => { defPayload = p; });
recordTest('Simulation: Default', 'Default mode emits bobot: 0 and mode: "default"', defPayload?.bobot === 0 && JSON.parse(defPayload.kunci_jawaban).mode === 'default');

// 4.2 Custom Mode Rejections
const invalidWeights = [
  { name: 'Under 100% (60%)', weights: { PG: 40, PGK: 20, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 } },
  { name: 'Over 100% (110%)', weights: { PG: 50, PGK: 30, BS: 10, JODOH: 10, ISIAN: 10, URAIAN: 0 } },
  { name: 'All zeroes (0%)', weights: { PG: 0, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 } },
  { name: 'Under by float (99.9%)', weights: { PG: 49.9, PGK: 20, BS: 10, JODOH: 10, ISIAN: 10, URAIAN: 0 } },
  { name: 'Over by float (100.5%)', weights: { PG: 50.5, PGK: 20, BS: 10, JODOH: 10, ISIAN: 10, URAIAN: 0 } }
];

for (const iw of invalidWeights) {
  const p = simulateSkemaPanel([]);
  p.setMode('custom');
  p.setAllSkema(iw.weights);
  let saved = false;
  let alertMsg = '';
  const ok = p.handleSave(() => { saved = true; }, (msg) => { alertMsg = msg; });
  recordTest('Simulation: Validation', `Strictly rejects invalid weight sum: ${iw.name}`, !ok && !saved && alertMsg.includes('harus tepat 100%'));
}

// 4.3 Custom Mode Acceptances
const validWeights = [
  { name: 'Standard 40-20-10-10-10-10', weights: { PG: 40, PGK: 20, BS: 10, JODOH: 10, ISIAN: 10, URAIAN: 10 } },
  { name: 'Two equal 50-50', weights: { PG: 50, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 50 } },
  { name: 'Single 100% PG', weights: { PG: 100, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 } },
  { name: 'Decimals summing to 100 (33.5, 33.5, 33)', weights: { PG: 33.5, PGK: 33.5, BS: 33, JODOH: 0, ISIAN: 0, URAIAN: 0 } }
];

for (const vw of validWeights) {
  const p = simulateSkemaPanel([]);
  p.setMode('custom');
  p.setAllSkema(vw.weights);
  let saved = false;
  let customPayload = null;
  const ok = p.handleSave((pay) => { saved = true; customPayload = pay; });
  const parsed = JSON.parse(customPayload?.kunci_jawaban || '{}');
  recordTest('Simulation: Validation', `Accepts valid weight sum 100%: ${vw.name}`, ok && saved && customPayload.bobot === 1 && parsed.mode === 'custom');
}

// 4.4 Backward Compatibility with Database Records
const legacyRecord = [{
  id_soal: 'SKEMA-LEGACY',
  tipe_soal: 'SKEMA_PENILAIAN',
  kunci_jawaban: JSON.stringify({ PG: 60, URAIAN: 40 })
}];
const pLegacy = simulateSkemaPanel(legacyRecord);
recordTest('Simulation: Compatibility', 'Legacy non-zero format auto-migrates to custom mode with preserved weights',
  pLegacy.getMode() === 'custom' && pLegacy.getSkema().PG === 60 && pLegacy.getSkema().URAIAN === 40
);

const malformedRecord = [{
  id_soal: 'SKEMA-BROKEN',
  tipe_soal: 'SKEMA_PENILAIAN',
  kunci_jawaban: '{broken json'
}];
const pMalformed = simulateSkemaPanel(malformedRecord);
recordTest('Simulation: Compatibility', 'Corrupted/malformed JSON in DB falls back safely to default mode without crashing',
  pMalformed.getMode() === 'default'
);

// =============================================================================
// CATEGORY 5: Live Database Integration & Persistence Roundtrip
// =============================================================================
console.log('\n▶ CATEGORY 5: Live Supabase Database Persistence Roundtrip');

async function runDatabaseRoundtrip() {
  try {
    const { supabaseClient } = await import('../src/config.js');
    const { fetchAPI } = await import('../src/api.js');

    const testNpsn = '70040625';
    const testMapelId = `TEST-MAPEL-${Date.now()}`;
    const testSkemaId = `SKEMA-${testMapelId}`;

    console.log(`  Target test mapel: ${testMapelId} (NPSN: ${testNpsn})`);

    // Step 0: Provision temporary subject in mata_pelajaran for foreign key integrity
    const { error: mapelInsertErr } = await supabaseClient.from('mata_pelajaran').insert([{
      id_mapel: testMapelId,
      nama_mapel: 'Mapel Uji Coba Challenger',
      npsn: testNpsn
    }]);
    recordTest('DB Roundtrip', 'Provision temporary subject in mata_pelajaran', !mapelInsertErr);

    // Step 1: Create grading scheme record in 'default' mode
    const defaultPayload = {
      id_soal: testSkemaId,
      id_mapel: testMapelId,
      npsn: testNpsn,
      tipe_soal: 'SKEMA_PENILAIAN',
      pertanyaan: 'Skema Penilaian',
      bobot: 0,
      kunci_jawaban: JSON.stringify({
        mode: 'default',
        skema: { PG: 0, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 }
      })
    };

    const createRes = await fetchAPI('create_soal_mapel', defaultPayload);
    recordTest('DB Roundtrip', 'create_soal_mapel successfully creates default skema in DB', createRes.status === 'success');

    // Step 2: Query DB using get_soal_by_mapel
    const getRes = await fetchAPI('get_soal_by_mapel', { id_mapel: testMapelId, npsn: testNpsn });
    const fetchedSkema = getRes.data?.find(s => s.tipe_soal === 'SKEMA_PENILAIAN');
    const parsedDefaultDb = fetchedSkema ? JSON.parse(fetchedSkema.kunci_jawaban) : null;

    recordTest('DB Roundtrip', 'get_soal_by_mapel returns persisted default skema with bobot: 0',
      fetchedSkema && fetchedSkema.bobot === 0 && parsedDefaultDb?.mode === 'default'
    );

    // Step 3: Update grading scheme to 'custom' mode (Simulating teacher saving in activeTab === 'akun')
    const customPayload = {
      id_soal: testSkemaId,
      id_mapel: testMapelId,
      npsn: testNpsn,
      tipe_soal: 'SKEMA_PENILAIAN',
      pertanyaan: 'Skema Penilaian',
      bobot: 1,
      kunci_jawaban: JSON.stringify({
        mode: 'custom',
        skema: { PG: 40, PGK: 20, BS: 10, JODOH: 10, ISIAN: 10, URAIAN: 10 }
      })
    };

    const updateRes = await fetchAPI('update_soal_mapel', customPayload);
    recordTest('DB Roundtrip', 'update_soal_mapel successfully updates to custom skema in DB', updateRes.status === 'success');

    // Step 4: Re-query and verify custom mode persistence
    const reGetRes = await fetchAPI('get_soal_by_mapel', { id_mapel: testMapelId, npsn: testNpsn });
    const updatedSkema = reGetRes.data?.find(s => s.tipe_soal === 'SKEMA_PENILAIAN');
    const parsedCustomDb = updatedSkema ? JSON.parse(updatedSkema.kunci_jawaban) : null;

    recordTest('DB Roundtrip', 'get_soal_by_mapel verifies custom mode persistence with bobot: 1 and exact weights',
      updatedSkema &&
      updatedSkema.bobot === 1 &&
      parsedCustomDb?.mode === 'custom' &&
      parsedCustomDb?.skema?.PG === 40 &&
      parsedCustomDb?.skema?.URAIAN === 10
    );

    // Step 5: Verify exam engine get_soal_ujian excludes SKEMA_PENILAIAN
    const examFilterWorks = apiCode.includes("s.tipe_soal !== 'SKEMA_PENILAIAN'");
    recordTest('DB Roundtrip', 'Exam question delivery explicitly filters out SKEMA_PENILAIAN', examFilterWorks);

    // Step 6: Cleanup test record from soal_ujian and mata_pelajaran
    const deleteRes = await fetchAPI('delete_soal_mapel', { id_soal: testSkemaId, npsn: testNpsn });
    recordTest('DB Roundtrip', 'Cleans up test skema record from database (zero orphaned records)', deleteRes.status === 'success');

    await supabaseClient.from('mata_pelajaran').delete().eq('id_mapel', testMapelId);

    // Confirm deletion
    const verifyCleanRes = await fetchAPI('get_soal_by_mapel', { id_mapel: testMapelId, npsn: testNpsn });
    const cleanCheck = (verifyCleanRes.data || []).length === 0;
    recordTest('DB Roundtrip', 'Confirmed clean database state after test teardown', cleanCheck);

  } catch (err) {
    recordTest('DB Roundtrip', 'Database roundtrip executed without unhandled errors', false, err.message);
  }
}

await runDatabaseRoundtrip();

// =============================================================================
// SUMMARY REPORT & FINAL VERDICT
// =============================================================================
console.log('\n======================================================================');
console.log(`TOTAL TESTS : ${report.total}`);
console.log(`PASSED      : ${report.passed}`);
console.log(`FAILED      : ${report.failed}`);
const passRate = ((report.passed / report.total) * 100).toFixed(1);
console.log(`PASS RATE   : ${passRate}%`);
console.log('======================================================================');

const verdict = report.failed === 0 ? 'APPROVE' : 'REJECT';
console.log(`\nFINAL VERDICT: [ ${verdict} ]`);

if (report.failed > 0) {
  console.log('\nDefects / Failures Identified:');
  report.failures.forEach((f, idx) => {
    console.log(`${idx + 1}. [${f.category}] ${f.name}`);
    if (f.details) console.log(`   Details: ${f.details}`);
  });
  console.log('\nRecommendation: Reject until all layout pinning and styling invariants are satisfied.');
  process.exit(1);
} else {
  console.log('\nAll empirical tests and layout invariants satisfied flawlessly.');
  process.exit(0);
}
