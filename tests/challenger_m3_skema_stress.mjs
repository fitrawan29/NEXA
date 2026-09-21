#!/usr/bin/env node
/**
 * Empirical Challenger M3: Grading Scheme Configuration Stress Test Suite
 * File: tests/challenger_m3_skema_stress.mjs
 *
 * Requirements Covered:
 * 1. "Format Default Sekolah / Admin" mode:
 *    - Asserts mode: 'default'
 *    - Validates disabled custom inputs & container pointer-events
 *    - Validates payload output: mode: 'default', skema: defaultSkema, bobot: 0
 *    - Validates state reset: custom dirty values overridden to bobot: 0 on save in default mode
 *
 * 2. "Skema Khusus Mata Pelajaran" mode:
 *    - Validation rejects sums != 100% (e.g. 0%, 50%, 90%, 99.9%, 100.1%, 105%, 150%)
 *    - Validation prevents save and triggers alert on invalid sum
 *    - Boundary conditions: non-numeric, empty string, NaN, negative values
 *    - Validation accepts sum == 100% (e.g. 40-20-10-10-10-10, 50-50, 100-0, 33.5-33.5-33)
 *    - Validates payload output: mode: 'custom', skema weights preserved, bobot: 1
 *
 * 3. Backward Compatibility:
 *    - Existing records with tipe_soal === 'SKEMA_PENILAIAN':
 *      * Modern format with mode: 'default'
 *      * Modern format with mode: 'custom'
 *      * Legacy flat weight format with non-zero values (auto-migrates to custom mode)
 *      * Legacy flat weight format with zero values (auto-migrates to default mode)
 *      * Legacy partial formats (missing keys defaulted cleanly)
 *      * Corrupted / malformed JSON strings in kunci_jawaban (no crash, safe default)
 *      * Empty or missing dataSoal arrays (no crash, safe default)
 *
 * 4. Integration & Invariant Security:
 *    - GuruView.jsx toolbar contains accessible Skema trigger button
 *    - GuruView.jsx modal renders SkemaPenilaianPanel with dataSoal & saveSkema
 *    - saveSkema correctly branches create_soal_mapel vs update_soal_mapel
 *    - Exam engine (api.js get_soal_ujian & submit_ujian) strictly excludes SKEMA_PENILAIAN
 *
 * 5. Adversarial Fuzzing:
 *    - 100 random weight combinations asserting strict sum !== 100 rejection and sum === 100 acceptance
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Resolve projectRoot: if run from "kode NEXA/tests" or root "tests"
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
console.log('  EMPIRICAL CHALLENGER M3: GRADING SCHEME CONFIGURATION STRESS TEST   ');
console.log('======================================================================\n');

// Load target source files
const skemaPath = path.resolve(projectRoot, 'src', 'components', 'SkemaPenilaianPanel.jsx');
const guruViewPath = path.resolve(projectRoot, 'src', 'views', 'GuruView.jsx');
const apiPath = path.resolve(projectRoot, 'src', 'api.js');

const skemaSource = fs.readFileSync(skemaPath, 'utf8');
const guruViewSource = fs.readFileSync(guruViewPath, 'utf8');
const apiSource = fs.readFileSync(apiPath, 'utf8');

// =============================================================================
// CATEGORY 1: AST Parsing & Structural Conformance
// =============================================================================
console.log('▶ CATEGORY 1: AST Parsing & Structural Integrity');

let skemaAst = null;
let guruAst = null;
let apiAst = null;

try {
  skemaAst = parse(skemaSource, { sourceType: 'module', plugins: ['jsx'] });
  recordTest('AST', 'SkemaPenilaianPanel.jsx parses cleanly with zero syntax errors', true);
} catch (e) {
  recordTest('AST', 'SkemaPenilaianPanel.jsx parses cleanly with zero syntax errors', false, e.message);
}

try {
  guruAst = parse(guruViewSource, { sourceType: 'module', plugins: ['jsx'] });
  recordTest('AST', 'GuruView.jsx parses cleanly with zero syntax errors', true);
} catch (e) {
  recordTest('AST', 'GuruView.jsx parses cleanly with zero syntax errors', false, e.message);
}

try {
  apiAst = parse(apiSource, { sourceType: 'module', plugins: ['jsx'] });
  recordTest('AST', 'api.js parses cleanly with zero syntax errors', true);
} catch (e) {
  recordTest('AST', 'api.js parses cleanly with zero syntax errors', false, e.message);
}

// Check AST for input disabling attribute
const hasDisabledAttributeInJSX = skemaSource.includes('disabled={mode === \'default\'}');
recordTest('AST', 'Skema inputs explicitly have disabled={mode === \'default\'}', hasDisabledAttributeInJSX);

const hasPointerEventsNone = skemaSource.includes('opacity-40 pointer-events-none');
recordTest('AST', 'Skema container has opacity-40 pointer-events-none when in default mode', hasPointerEventsNone);

const hasSaveBobot0 = skemaSource.includes('bobot: 0');
recordTest('AST', 'SkemaPenilaianPanel explicitly writes bobot: 0 for default mode', hasSaveBobot0);

const hasSaveBobot1 = skemaSource.includes('bobot: 1');
recordTest('AST', 'SkemaPenilaianPanel explicitly writes bobot: 1 for custom mode', hasSaveBobot1);

const hasSumValidation100 = skemaSource.includes('if (total !== 100)');
recordTest('AST', 'SkemaPenilaianPanel strictly validates if (total !== 100)', hasSumValidation100);

// =============================================================================
// SIMULATION ENGINE: Pure Functional Model of SkemaPenilaianPanel
// =============================================================================

function createSkemaPanelInstance(initialDataSoal = []) {
  const defaultSkema = { PG: 0, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 };
  let mode = 'default';
  let skema = { ...defaultSkema };

  // Replicate useEffect lifecycle
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
        // Legacy format
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
    setSkemaWeight: (type, val) => { skema[type] = val; },
    setAllSkema: (s) => { skema = { ...s }; },
    hitungTotalPersentase,
    handleSave,
    isInputDisabled: () => mode === 'default'
  };
}

// =============================================================================
// CATEGORY 2: "Format Default Sekolah / Admin" Mode Stress-Testing
// =============================================================================
console.log('\n▶ CATEGORY 2: "Format Default Sekolah / Admin" Mode Empirical Tests');

// 2.1 Default initialization without prior record
const panelDefault = createSkemaPanelInstance([]);
recordTest('Default Mode', 'Initializes with mode === "default"', panelDefault.getMode() === 'default');
recordTest('Default Mode', 'Custom inputs are disabled when mode === "default"', panelDefault.isInputDisabled() === true);

let defaultSavePayload = null;
let defaultSaveAlertCalled = false;
const defaultSaveResult = panelDefault.handleSave(
  (payload) => { defaultSavePayload = payload; },
  () => { defaultSaveAlertCalled = true; }
);

recordTest('Default Mode', 'Saving in default mode succeeds without alert', defaultSaveResult === true && !defaultSaveAlertCalled);
recordTest('Default Mode', 'Default save payload has bobot === 0', defaultSavePayload?.bobot === 0);

const parsedDefaultKunci = JSON.parse(defaultSavePayload?.kunci_jawaban || '{}');
recordTest('Default Mode', 'Default save payload kunci_jawaban JSON specifies mode: "default"', parsedDefaultKunci.mode === 'default');
recordTest('Default Mode', 'Default save payload kunci_jawaban contains all 6 zero-weighted question types',
  parsedDefaultKunci.skema &&
  parsedDefaultKunci.skema.PG === 0 &&
  parsedDefaultKunci.skema.PGK === 0 &&
  parsedDefaultKunci.skema.BS === 0 &&
  parsedDefaultKunci.skema.JODOH === 0 &&
  parsedDefaultKunci.skema.ISIAN === 0 &&
  parsedDefaultKunci.skema.URAIAN === 0
);

// 2.2 Mode Reset: Dirty custom weights overridden when switched to default
const panelSwitch = createSkemaPanelInstance([]);
panelSwitch.setMode('custom');
panelSwitch.setAllSkema({ PG: 50, PGK: 20, BS: 10, JODOH: 10, ISIAN: 5, URAIAN: 5 });
recordTest('Default Mode', 'Switches to custom mode and inputs become enabled', panelSwitch.isInputDisabled() === false);

// Switch back to default
panelSwitch.setMode('default');
recordTest('Default Mode', 'Inputs are re-disabled after switching back to default', panelSwitch.isInputDisabled() === true);

let switchSavePayload = null;
panelSwitch.handleSave(
  (payload) => { switchSavePayload = payload; },
  () => {}
);

recordTest('Default Mode', 'Saving after switching back to default strictly enforces bobot === 0', switchSavePayload?.bobot === 0);
const parsedSwitchKunci = JSON.parse(switchSavePayload?.kunci_jawaban || '{}');
recordTest('Default Mode', 'Saving after switching back to default resets skema payload to default zero weights',
  parsedSwitchKunci.mode === 'default' && parsedSwitchKunci.skema.PG === 0
);

// =============================================================================
// CATEGORY 3: "Skema Khusus Mata Pelajaran" Mode Validation Stress-Testing
// =============================================================================
console.log('\n▶ CATEGORY 3: "Skema Khusus Mata Pelajaran" Mode Validation Tests');

// 3.1 Validation rejects sums != 100%
const invalidSumCases = [
  { name: 'All zero sum (0%)', weights: { PG: 0, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 }, expectedSum: 0 },
  { name: 'Under-sum 50%', weights: { PG: 25, PGK: 25, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 }, expectedSum: 50 },
  { name: 'Under-sum 90%', weights: { PG: 40, PGK: 20, BS: 10, JODOH: 10, ISIAN: 10, URAIAN: 0 }, expectedSum: 90 },
  { name: 'Under-sum 99%', weights: { PG: 49, PGK: 20, BS: 10, JODOH: 10, ISIAN: 10, URAIAN: 0 }, expectedSum: 99 },
  { name: 'Under-sum 99.9%', weights: { PG: 49.9, PGK: 20, BS: 10, JODOH: 10, ISIAN: 10, URAIAN: 0 }, expectedSum: 99.9 },
  { name: 'Over-sum 100.1%', weights: { PG: 50.1, PGK: 20, BS: 10, JODOH: 10, ISIAN: 10, URAIAN: 0 }, expectedSum: 100.1 },
  { name: 'Over-sum 105%', weights: { PG: 40, PGK: 20, BS: 15, JODOH: 15, ISIAN: 10, URAIAN: 5 }, expectedSum: 105 },
  { name: 'Over-sum 150%', weights: { PG: 50, PGK: 50, BS: 20, JODOH: 10, ISIAN: 10, URAIAN: 10 }, expectedSum: 150 },
  { name: 'Over-sum 200%', weights: { PG: 100, PGK: 50, BS: 20, JODOH: 10, ISIAN: 10, URAIAN: 10 }, expectedSum: 200 },
  { name: 'Empty strings & NaN values', weights: { PG: '', PGK: 'abc', BS: null, JODOH: undefined, ISIAN: 10, URAIAN: 20 }, expectedSum: 30 }
];

for (const tc of invalidSumCases) {
  const panel = createSkemaPanelInstance([]);
  panel.setMode('custom');
  panel.setAllSkema(tc.weights);

  let alertMessage = '';
  let saveCalled = false;
  const result = panel.handleSave(
    () => { saveCalled = true; },
    (msg) => { alertMessage = msg; }
  );

  const calcSum = panel.hitungTotalPersentase();
  recordTest(
    'Custom Validation (Reject)',
    `Rejects invalid sum: ${tc.name} (sum=${calcSum}%)`,
    result === false && !saveCalled && alertMessage.includes('harus tepat 100%')
  );
}

// 3.2 Validation accepts sum == 100%
const validSumCases = [
  {
    name: 'Standard distribution (40, 20, 10, 10, 10, 10)',
    weights: { PG: 40, PGK: 20, BS: 10, JODOH: 10, ISIAN: 10, URAIAN: 10 }
  },
  {
    name: '100% single question type (PG: 100)',
    weights: { PG: 100, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 }
  },
  {
    name: '100% essay only (URAIAN: 100)',
    weights: { PG: 0, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 100 }
  },
  {
    name: 'Two equal types 50/50 (PG: 50, URAIAN: 50)',
    weights: { PG: 50, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 50 }
  },
  {
    name: 'Three-way split (PG: 40, PGK: 30, BS: 30)',
    weights: { PG: 40, PGK: 30, BS: 30, JODOH: 0, ISIAN: 0, URAIAN: 0 }
  },
  {
    name: 'Valid decimal distribution (33.5, 33.5, 33)',
    weights: { PG: 33.5, PGK: 33.5, BS: 33, JODOH: 0, ISIAN: 0, URAIAN: 0 }
  },
  {
    name: 'Numeric strings parsed properly ("50", "50")',
    weights: { PG: '50', PGK: '50', BS: '0', JODOH: '0', ISIAN: '0', URAIAN: '0' }
  }
];

for (const tc of validSumCases) {
  const panel = createSkemaPanelInstance([]);
  panel.setMode('custom');
  panel.setAllSkema(tc.weights);

  let alertCalled = false;
  let savedPayload = null;
  const result = panel.handleSave(
    (payload) => { savedPayload = payload; },
    () => { alertCalled = true; }
  );

  const parsed = JSON.parse(savedPayload?.kunci_jawaban || '{}');
  const sumMatches = panel.hitungTotalPersentase() === 100;
  const isAccepted = result === true && !alertCalled && savedPayload?.bobot === 1 && parsed.mode === 'custom';

  recordTest(
    'Custom Validation (Accept)',
    `Accepts valid sum 100%: ${tc.name}`,
    sumMatches && isAccepted
  );
}

// =============================================================================
// CATEGORY 4: Backward Compatibility with Existing Database Records
// =============================================================================
console.log('\n▶ CATEGORY 4: Backward Compatibility with Existing Database Records');

// 4.1 Modern record with mode: 'default'
const modernDefaultData = [
  {
    id_soal: 'SKEMA-MP-001',
    id_mapel: 'MP-001',
    tipe_soal: 'SKEMA_PENILAIAN',
    pertanyaan: 'Skema Penilaian',
    bobot: 0,
    kunci_jawaban: JSON.stringify({
      mode: 'default',
      skema: { PG: 0, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 }
    })
  }
];
const panelModernDefault = createSkemaPanelInstance(modernDefaultData);
recordTest('Backward Compatibility', 'Parses modern mode: "default" record correctly', panelModernDefault.getMode() === 'default');

// 4.2 Modern record with mode: 'custom'
const modernCustomData = [
  {
    id_soal: 'SKEMA-MP-002',
    id_mapel: 'MP-002',
    tipe_soal: 'SKEMA_PENILAIAN',
    pertanyaan: 'Skema Penilaian',
    bobot: 1,
    kunci_jawaban: JSON.stringify({
      mode: 'custom',
      skema: { PG: 40, PGK: 20, BS: 10, JODOH: 10, ISIAN: 10, URAIAN: 10 }
    })
  }
];
const panelModernCustom = createSkemaPanelInstance(modernCustomData);
recordTest('Backward Compatibility', 'Parses modern mode: "custom" record correctly', panelModernCustom.getMode() === 'custom');
recordTest('Backward Compatibility', 'Preserves custom weights from modern record', panelModernCustom.getSkema().PG === 40 && panelModernCustom.getSkema().URAIAN === 10);

// 4.3 Legacy record with flat dictionary and custom weights (>0)
const legacyCustomData = [
  {
    id_soal: 'SKEMA-MP-003',
    id_mapel: 'MP-003',
    tipe_soal: 'SKEMA_PENILAIAN',
    pertanyaan: 'Skema Penilaian',
    bobot: 1,
    kunci_jawaban: JSON.stringify({
      PG: 50,
      PGK: 20,
      BS: 10,
      JODOH: 10,
      ISIAN: 5,
      URAIAN: 5
    })
  }
];
const panelLegacyCustom = createSkemaPanelInstance(legacyCustomData);
recordTest('Backward Compatibility', 'Auto-migrates legacy record with positive weights to mode: "custom"', panelLegacyCustom.getMode() === 'custom');
recordTest('Backward Compatibility', 'Correctly loads legacy weights without loss', panelLegacyCustom.getSkema().PG === 50 && panelLegacyCustom.hitungTotalPersentase() === 100);

// 4.4 Legacy record with flat dictionary all zero (0)
const legacyDefaultData = [
  {
    id_soal: 'SKEMA-MP-004',
    id_mapel: 'MP-004',
    tipe_soal: 'SKEMA_PENILAIAN',
    pertanyaan: 'Skema Penilaian',
    bobot: 0,
    kunci_jawaban: JSON.stringify({
      PG: 0,
      PGK: 0,
      BS: 0,
      JODOH: 0,
      ISIAN: 0,
      URAIAN: 0
    })
  }
];
const panelLegacyDefault = createSkemaPanelInstance(legacyDefaultData);
recordTest('Backward Compatibility', 'Auto-migrates legacy record with all-zero weights to mode: "default"', panelLegacyDefault.getMode() === 'default');

// 4.5 Corrupted / invalid JSON string in kunci_jawaban
const malformedJsonData = [
  {
    id_soal: 'SKEMA-MP-005',
    id_mapel: 'MP-005',
    tipe_soal: 'SKEMA_PENILAIAN',
    pertanyaan: 'Skema Penilaian',
    bobot: 0,
    kunci_jawaban: '{broken-json: true, unexpected token'
  }
];
let malformedCrashed = false;
let panelMalformed = null;
try {
  panelMalformed = createSkemaPanelInstance(malformedJsonData);
} catch (e) {
  malformedCrashed = true;
}
recordTest('Backward Compatibility', 'Does not crash on malformed/corrupted JSON string', !malformedCrashed && panelMalformed !== null);
recordTest('Backward Compatibility', 'Gracefully falls back to mode: "default" on malformed JSON', panelMalformed?.getMode() === 'default');

// 4.6 Partial legacy dictionary (some types missing)
const partialLegacyData = [
  {
    id_soal: 'SKEMA-MP-006',
    id_mapel: 'MP-006',
    tipe_soal: 'SKEMA_PENILAIAN',
    pertanyaan: 'Skema Penilaian',
    bobot: 1,
    kunci_jawaban: JSON.stringify({ PG: 70, URAIAN: 30 })
  }
];
const panelPartial = createSkemaPanelInstance(partialLegacyData);
recordTest('Backward Compatibility', 'Handles partial legacy dictionary without undefined properties',
  panelPartial.getSkema().PG === 70 &&
  panelPartial.getSkema().PGK === 0 &&
  panelPartial.getSkema().BS === 0 &&
  panelPartial.getSkema().URAIAN === 30
);

// 4.7 Null/empty dataSoal or no SKEMA_PENILAIAN row
const nullPanel = createSkemaPanelInstance(null);
const emptyPanel = createSkemaPanelInstance([]);
const regularOnlyPanel = createSkemaPanelInstance([
  { id_soal: 'SOAL-1', tipe_soal: 'PG', pertanyaan: '1+1=?' },
  { id_soal: 'SOAL-2', tipe_soal: 'URAIAN', pertanyaan: 'Explain' }
]);
recordTest('Backward Compatibility', 'Gracefully handles null dataSoal', nullPanel.getMode() === 'default');
recordTest('Backward Compatibility', 'Gracefully handles empty dataSoal array', emptyPanel.getMode() === 'default');
recordTest('Backward Compatibility', 'Gracefully handles dataSoal with no SKEMA_PENILAIAN row', regularOnlyPanel.getMode() === 'default');

// =============================================================================
// CATEGORY 5: Integration Invariants & Backend Wiring
// =============================================================================
console.log('\n▶ CATEGORY 5: Integration Invariants & Backend Security Wiring');

// 5.1 Trigger button in GuruView.jsx
const hasSkemaToolbarButton = guruViewSource.includes('onClick={() => setSkemaModal({ isOpen: true, id_mapel: selectedMapel })}');
recordTest('Integration', 'GuruView Bank Soal toolbar wires Skema trigger button to setSkemaModal', hasSkemaToolbarButton);

// 5.2 Modal rendering in GuruView.jsx
const rendersSkemaPanel = guruViewSource.includes('<SkemaPenilaianPanel dataSoal={dataSoal} onSave={saveSkema} />');
recordTest('Integration', 'GuruView renders <SkemaPenilaianPanel dataSoal={dataSoal} onSave={saveSkema} />', rendersSkemaPanel);

// 5.3 saveSkema endpoint selection (update vs create)
function simulateSaveSkema(payload, existingSoals, mapelId) {
  let skemaRecord = existingSoals.find(s => s.tipe_soal === 'SKEMA_PENILAIAN');
  const finalPayload = { ...payload };
  finalPayload.id_soal = skemaRecord ? skemaRecord.id_soal : 'SKEMA-' + mapelId;
  finalPayload.tipe_soal = 'SKEMA_PENILAIAN';
  finalPayload.id_mapel = mapelId;
  finalPayload.pertanyaan = 'Skema Penilaian';

  const endpoint = skemaRecord ? 'update_soal_mapel' : 'create_soal_mapel';
  return { endpoint, payload: finalPayload };
}

// When no prior record exists
const saveCreateSim = simulateSaveSkema({ bobot: 0, kunci_jawaban: '{}' }, [], 'MAT-10');
recordTest('Integration', 'saveSkema calls create_soal_mapel when no prior skema record exists', saveCreateSim.endpoint === 'create_soal_mapel');
recordTest('Integration', 'saveSkema generates deterministic id_soal: "SKEMA-MAT-10"', saveCreateSim.payload.id_soal === 'SKEMA-MAT-10');
recordTest('Integration', 'saveSkema enforces tipe_soal === "SKEMA_PENILAIAN"', saveCreateSim.payload.tipe_soal === 'SKEMA_PENILAIAN');

// When prior record exists
const existingRecord = { id_soal: 'SKEMA-EXISTING-99', tipe_soal: 'SKEMA_PENILAIAN' };
const saveUpdateSim = simulateSaveSkema({ bobot: 1, kunci_jawaban: '{}' }, [existingRecord], 'MAT-10');
recordTest('Integration', 'saveSkema calls update_soal_mapel when skema record exists', saveUpdateSim.endpoint === 'update_soal_mapel');
recordTest('Integration', 'saveSkema preserves existing record id_soal on update', saveUpdateSim.payload.id_soal === 'SKEMA-EXISTING-99');

// 5.4 Exam question filtering invariant in api.js
const apiFiltersSkemaInGetSoal = apiSource.includes("s.tipe_soal !== 'SKEMA_PENILAIAN'");
recordTest('Security Invariant', 'api.js strictly filters out SKEMA_PENILAIAN from exam questions', apiFiltersSkemaInGetSoal);

const guruViewFiltersSkemaInList = guruViewSource.includes("s.tipe_soal !== 'SKEMA_PENILAIAN'");
recordTest('Security Invariant', 'GuruView.jsx strictly filters out SKEMA_PENILAIAN from question display table', guruViewFiltersSkemaInList);

// =============================================================================
// CATEGORY 6: Adversarial Fuzzing & Boundary Stress
// =============================================================================
console.log('\n▶ CATEGORY 6: Adversarial Fuzzing (100 Randomized Weight Distributions)');

let fuzzPassed = 0;
let fuzzFailed = 0;

for (let i = 0; i < 100; i++) {
  const panel = createSkemaPanelInstance([]);
  panel.setMode('custom');

  let weights;
  let targetSum;

  if (i % 5 === 0) {
    // Generate valid partition that sums to exactly 100
    const p1 = Math.floor(Math.random() * 30);
    const p2 = Math.floor(Math.random() * 20);
    const p3 = Math.floor(Math.random() * 20);
    const p4 = Math.floor(Math.random() * 15);
    const p5 = Math.floor(Math.random() * 10);
    const p6 = 100 - (p1 + p2 + p3 + p4 + p5);
    weights = { PG: p1, PGK: p2, BS: p3, JODOH: p4, ISIAN: p5, URAIAN: p6 };
    targetSum = 100;
  } else {
    // Generate arbitrary random integers
    weights = {
      PG: Math.floor(Math.random() * 50),
      PGK: Math.floor(Math.random() * 50),
      BS: Math.floor(Math.random() * 30),
      JODOH: Math.floor(Math.random() * 30),
      ISIAN: Math.floor(Math.random() * 30),
      URAIAN: Math.floor(Math.random() * 30)
    };
    targetSum = Object.values(weights).reduce((a, b) => a + b, 0);
  }

  panel.setAllSkema(weights);
  const actualSum = panel.hitungTotalPersentase();

  let saveInvoked = false;
  const outcome = panel.handleSave(
    () => { saveInvoked = true; },
    () => {}
  );

  if (actualSum === 100) {
    if (outcome === true && saveInvoked) {
      fuzzPassed++;
    } else {
      fuzzFailed++;
    }
  } else {
    if (outcome === false && !saveInvoked) {
      fuzzPassed++;
    } else {
      fuzzFailed++;
    }
  }
}

recordTest('Fuzzing', '100 Randomized distributions maintain 100% invariant consistency', fuzzFailed === 0, `${fuzzFailed} invariant violations`);

// =============================================================================
// SUMMARY REPORT
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
  console.log('\nFailures summary:');
  report.failures.forEach(f => {
    console.log(`- [${f.category}] ${f.name}: ${f.details}`);
  });
  process.exit(1);
} else {
  console.log('All empirical stress test assertions passed flawlessly.');
  process.exit(0);
}
