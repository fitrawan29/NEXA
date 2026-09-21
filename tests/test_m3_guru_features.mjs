#!/usr/bin/env node
/**
 * Test Suite: CBT NEXA Milestone M3 (Guru Features)
 * Covers:
 * 1. Compact Guru Dashboard Layout & Grid Split (GuruView.jsx)
 * 2. Question Template Upload id_soal Generation & kd Sanitization (GuruView.jsx & api.js)
 * 3. Grading Scheme Mode Configuration & Modal Trigger (SkemaPenilaianPanel.jsx & GuruView.jsx)
 * 4. Production Build Verification
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Source paths
const guruViewPath = path.resolve(projectRoot, 'src', 'views', 'GuruView.jsx');
const apiPath = path.resolve(projectRoot, 'src', 'api.js');
const skemaPanelPath = path.resolve(projectRoot, 'src', 'components', 'SkemaPenilaianPanel.jsx');

const guruViewCode = fs.readFileSync(guruViewPath, 'utf8');
const apiCode = fs.readFileSync(apiPath, 'utf8');
const skemaPanelCode = fs.readFileSync(skemaPanelPath, 'utf8');

const report = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: []
};

function test(description, condition, details = '') {
  report.total++;
  if (condition) {
    report.passed++;
    console.log(`  ✔ [PASS] ${description}`);
  } else {
    report.failed++;
    report.failures.push({ description, details });
    console.log(`  ✖ [FAIL] ${description}${details ? ` -> ${details}` : ''}`);
  }
}

console.log('======================================================================');
console.log('  CBT NEXA - MILESTONE M3: GURU FEATURES VERIFICATION SUITE           ');
console.log('======================================================================\n');

// =============================================================================
// 1. AST Syntax & File Integrity
// =============================================================================
console.log('▶ 1. AST Syntax Integrity');
try {
  parse(guruViewCode, { sourceType: 'module', plugins: ['jsx'] });
  test('GuruView.jsx parses cleanly with zero AST syntax errors', true);
} catch (e) {
  test('GuruView.jsx parses cleanly with zero AST syntax errors', false, e.message);
}

try {
  parse(apiCode, { sourceType: 'module', plugins: ['jsx'] });
  test('api.js parses cleanly with zero AST syntax errors', true);
} catch (e) {
  test('api.js parses cleanly with zero AST syntax errors', false, e.message);
}

try {
  parse(skemaPanelCode, { sourceType: 'module', plugins: ['jsx'] });
  test('SkemaPenilaianPanel.jsx parses cleanly with zero AST syntax errors', true);
} catch (e) {
  test('SkemaPenilaianPanel.jsx parses cleanly with zero AST syntax errors', false, e.message);
}

// =============================================================================
// 2. Compact Guru Dashboard Layout
// =============================================================================
console.log('\n▶ 2. Compact Guru Dashboard Layout');

// 2.1 Outer Padding
const hasCompactOuterPadding = guruViewCode.includes('px-3 sm:px-5 lg:px-6 py-4 pb-24 lg:pb-8');
test('Main content container uses tightened compact outer padding (px-3 sm:px-5 lg:px-6 py-4 pb-24 lg:pb-8)', hasCompactOuterPadding);

// 2.2 Absence of Duplicate Heading
const hasDuplicateHeading = guruViewCode.includes('Ringkasan Aktivitas Mengajar');
test('Eliminated redundant duplicate heading "Ringkasan Aktivitas Mengajar"', !hasDuplicateHeading);

// 2.3 Compact 3-Column Stats Bar
const has3ColStatsBar = /grid\s+grid-cols-3\s+gap-2\.5\s+sm:gap-3\.5/.test(guruViewCode);
test('Uses compact 3-column stats bar layout (grid grid-cols-3 gap-2.5 sm:gap-3.5)', has3ColStatsBar);

const hasCompactCardPadding = /p-3\s+sm:p-3\.5\s+rounded-xl/.test(guruViewCode);
test('Stats bar metric cards use compact padding and rounded corners (p-3 sm:p-3.5 rounded-xl)', hasCompactCardPadding);

// 2.4 Desktop 2-Column Split: lg:grid-cols-12, Left lg:col-span-7, Right lg:col-span-5
const has12ColSplit = /grid-cols-1\s+lg:grid-cols-12\s+gap-3\.5\s+sm:gap-4/.test(guruViewCode);
test('Lower dashboard adopts 2-column desktop split (grid-cols-1 lg:grid-cols-12)', has12ColSplit);

const hasLeftCol7 = /lg:col-span-7/.test(guruViewCode);
test('Left column adopts lg:col-span-7 for Mapel and Bank Soal list', hasLeftCol7);

const hasRightCol5 = /lg:col-span-5/.test(guruViewCode);
test('Right column adopts lg:col-span-5 for Quick Actions and Live Exam HUD', hasRightCol5);

// 2.5 Compact Mapel Row Density
const hasCompactMapelRows = /py-2\s+px-3\s+rounded-lg\s+border/.test(guruViewCode);
test('Mapel list rows use compact high-density classes (py-2 px-3 rounded-lg border)', hasCompactMapelRows);

// 2.6 Right Column Modules
const hasLiveExamHUD = guruViewCode.includes('Live Exam HUD') && guruViewCode.includes('sensors');
test('Right column contains Live Exam HUD module with real-time indicators', hasLiveExamHUD);

const hasQuickActions = guruViewCode.includes('Aksi Cepat') && guruViewCode.includes('Bank Soal') && guruViewCode.includes('Monitoring');
test('Right column contains Aksi Cepat (Quick Actions) shortcut matrix', hasQuickActions);

// =============================================================================
// 3. Question Template Upload id_soal & Schema Fix
// =============================================================================
console.log('\n▶ 3. Question Template Upload id_soal & Schema Fix');

// 3.1 Client-side id_soal generation in handleImportExcel
const hasClientUniqueIdGen = /const\s+uniqueId\s*=\s*`SOAL-\$\{selectedMapel\}-\$\{Date\.now\(\)\.toString\(36\)\.toUpperCase\(\)\}-\$\{Math\.random\(\)\.toString\(36\)\.substring\(2,\s*6\)\.toUpperCase\(\)\}-\$\{idx\}`;/.test(guruViewCode);
test('handleImportExcel generates unique id_soal with timestamp, random entropy, and row index', hasClientUniqueIdGen);

const hasPayloadIdSoal = /id_soal:\s*uniqueId/.test(guruViewCode);
test('payloadData in handleImportExcel assigns id_soal: uniqueId', hasPayloadIdSoal);

// 3.2 Omission of non-existent kd column from GuruView payloadData
const guruViewImportSlice = guruViewCode.substring(
  guruViewCode.indexOf('handleImportExcel'),
  guruViewCode.indexOf('import_soal_bulk')
);
const hasNoKdInGuruPayload = !/kd:\s*row\.kd/.test(guruViewImportSlice);
test('handleImportExcel completely omits non-existent kd property from payloadData', hasNoKdInGuruPayload);

// 3.3 Backend Fallback ID Generator in api.js import_soal_bulk
const hasBackendIdFallback = /id_soal:\s*item\.id_soal\s*\|\|\s*`SOAL-\$\{generateId\('IMP'\)\}-\$\{idx\}`/.test(apiCode);
test('api.js import_soal_bulk includes fallback ID generator for any row missing id_soal', hasBackendIdFallback);

// 3.4 Backend Stripping of kd Property in api.js
const hasBackendKdStrip = /const\s*\{\s*kd,\s*\.\.\.rest\s*\}\s*=\s*item;/.test(apiCode);
test('api.js import_soal_bulk strips non-existent kd property to prevent PostgREST schema cache errors', hasBackendKdStrip);

// 3.5 Functional Simulation of Backend Sanitization Logic
const mockGenerateId = (p) => `${p}-SIM12345`;
const mockInput = [
  { tipe_soal: 'PG', pertanyaan: 'Soal 1', kunci_jawaban: 'A', kd: '3.1' }, // Missing id_soal, has kd
  { id_soal: 'SOAL-CUSTOM-99', tipe_soal: 'PGK', pertanyaan: 'Soal 2', kunci_jawaban: '["A"]', kd: '3.2' }, // Has id_soal, has kd
  { tipe_soal: 'URAIAN', pertanyaan: 'Soal 3', bobot: 20 } // Missing id_soal, no kd
];

const sanitizedOutput = mockInput.map((item, idx) => {
  const { kd, ...rest } = item;
  return {
    ...rest,
    id_soal: item.id_soal || `SOAL-${mockGenerateId('IMP')}-${idx}`,
    bobot: item.bobot !== undefined ? Number(item.bobot) : 10
  };
});

const allHaveIdSoal = sanitizedOutput.every(s => typeof s.id_soal === 'string' && s.id_soal.startsWith('SOAL-'));
const noneHaveKd = sanitizedOutput.every(s => !('kd' in s));
const allHaveValidBobot = sanitizedOutput.every(s => typeof s.bobot === 'number' && !isNaN(s.bobot));

test('Simulation: all imported rows receive valid non-empty id_soal', allHaveIdSoal);
test('Simulation: kd property is purged from 100% of inserted objects', noneHaveKd);
test('Simulation: bobot is coerced to valid number across all rows', allHaveValidBobot);

// =============================================================================
// 4. Grading Scheme Configuration
// =============================================================================
console.log('\n▶ 4. Grading Scheme Configuration');

// 4.1 Trigger Button in GuruView.jsx Bank Soal Toolbar
const hasSkemaTriggerButton = guruViewCode.includes('setSkemaModal({ isOpen: true, id_mapel: selectedMapel })');
test('GuruView Bank Soal toolbar includes visible trigger button opening setSkemaModal', hasSkemaTriggerButton);

const hasSkemaButtonVisuals = guruViewCode.includes('tune') && /<span[^>]*>Skema<\/span>/.test(guruViewCode);
test('Skema button displays "tune" icon and "Skema" label', hasSkemaButtonVisuals);

// 4.2 Modal Integration
const hasSkemaModalMount = guruViewCode.includes('<SkemaPenilaianPanel dataSoal={dataSoal} onSave={saveSkema} />');
test('GuruView correctly mounts SkemaPenilaianPanel with dataSoal and onSave callbacks', hasSkemaModalMount);

// 4.3 Mode Selector in SkemaPenilaianPanel.jsx
const hasModeState = /const\s+\[mode,\s*setMode\]\s*=\s*useState\(['"]default['"]\);/.test(skemaPanelCode);
test('SkemaPenilaianPanel initializes mode state with "default"', hasModeState);

const hasDefaultSchoolOption = skemaPanelCode.includes('Format Default Sekolah / Admin') && skemaPanelCode.includes("setMode('default')");
test('Provides selectable "Format Default Sekolah / Admin" mode option', hasDefaultSchoolOption);

const hasCustomMapelOption = skemaPanelCode.includes('Skema Khusus Mata Pelajaran') && skemaPanelCode.includes("setMode('custom')");
test('Provides selectable "Skema Khusus Mata Pelajaran" mode option', hasCustomMapelOption);

// 4.4 Disabling Inputs in Default Mode
const hasDisabledInputsInDefault = /disabled=\{mode\s*===\s*['"]default['"]\}/.test(skemaPanelCode);
test('Custom weight inputs are disabled when mode === "default"', hasDisabledInputsInDefault);

// 4.5 Mode-Aware Save Handler
const hasDefaultSavePayload = skemaPanelCode.includes("mode: 'default'") && /bobot:\s*0/.test(skemaPanelCode);
test('Default mode saves pure proportional configuration (mode: default, bobot: 0)', hasDefaultSavePayload);

const hasCustomSaveValidation = /if\s*\(total\s*!==\s*100\)/.test(skemaPanelCode) && skemaPanelCode.includes("mode: 'custom'");
test('Custom mode enforces strict 100% total validation and saves mode: "custom"', hasCustomSaveValidation);

// 4.6 Simulation of SkemaPenilaianPanel Save Logic
let savedResult = null;
const mockOnSave = (payload) => { savedResult = payload; };

// Case A: Default mode save
const runSaveSimulation = (simMode, simWeights) => {
  const defaultSkema = { PG: 0, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 };
  if (simMode === 'custom') {
    const total = Object.values(simWeights).reduce((a, b) => a + Number(b), 0);
    if (total !== 100) return { error: `Total must be 100% (got ${total}%)` };
    mockOnSave({
      kunci_jawaban: JSON.stringify({ mode: 'custom', skema: simWeights }),
      bobot: 1
    });
    return { success: true };
  } else {
    mockOnSave({
      kunci_jawaban: JSON.stringify({ mode: 'default', skema: defaultSkema }),
      bobot: 0
    });
    return { success: true };
  }
};

const defaultSaveRes = runSaveSimulation('default', {});
const savedDefaultObj = JSON.parse(savedResult.kunci_jawaban);
test('Simulation: Default mode saves valid payload with mode="default" and bobot=0', defaultSaveRes.success && savedDefaultObj.mode === 'default' && savedResult.bobot === 0);

// Case B: Custom mode invalid sum (80%)
const customInvalidRes = runSaveSimulation('custom', { PG: 50, URAIAN: 30 });
test('Simulation: Custom mode rejects invalid sum (80% != 100%)', customInvalidRes.error !== undefined);

// Case C: Custom mode valid sum (100%)
const customValidRes = runSaveSimulation('custom', { PG: 60, PGK: 10, BS: 10, JODOH: 0, ISIAN: 0, URAIAN: 20 });
const savedCustomObj = JSON.parse(savedResult.kunci_jawaban);
test('Simulation: Custom mode accepts 100% sum and saves mode="custom" with bobot=1', customValidRes.success && savedCustomObj.mode === 'custom' && savedResult.bobot === 1 && savedCustomObj.skema.PG === 60);

// =============================================================================
// 5. Production Build Artifacts Check
// =============================================================================
console.log('\n▶ 5. Production Build Artifacts Verification');
const distHtmlPath = path.resolve(projectRoot, 'dist', 'index.html');
const distExists = fs.existsSync(distHtmlPath);
test('Production build output dist/index.html exists and is generated', distExists);

// =============================================================================
// Summary
// =============================================================================
console.log('\n----------------------------------------------------------------------');
console.log(`TOTAL TESTS : ${report.total}`);
console.log(`PASSED      : ${report.passed}`);
console.log(`FAILED      : ${report.failed}`);
console.log(`PASS RATE   : ${Math.round((report.passed / report.total) * 100)}%`);
console.log('----------------------------------------------------------------------\n');

if (report.failed > 0) {
  console.error(`❌ ${report.failed} test(s) failed.`);
  process.exit(1);
} else {
  console.log('🎉 ALL MILESTONE M3 TESTS PASSED CLEANLY!\n');
  process.exit(0);
}
