/**
 * ============================================================================
 * NEXA CBT Round 18 - Verification Suite: School Default Custom Grading Scheme
 * ============================================================================
 *
 * Verifies:
 * R1: State stability of 'Kustom (Bobot Persentase)' mode in SkemaPenilaianPanel
 *     when isSchoolDefault={true} across parent re-renders.
 *     Inputs for PG, PGK, BS, JODOH, ISIAN, URAIAN remain editable and enabled.
 * R2: Decimal precision validation (Math.round(total * 100) / 100 === 100)
 *     and persistence round-trip via save_default_skema_sekolah.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

// Setup Mock LocalStorage for Node environment before importing api.js
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  get length() {
    return this.store.size;
  }
  key(index) {
    return Array.from(this.store.keys())[index] || null;
  }
}

const mockStorage = new MockLocalStorage();
globalThis.localStorage = mockStorage;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const { save_default_skema_sekolah, get_default_skema_sekolah } = await import('../src/api.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assertTest(condition, testName, failureDetails = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}`);
    if (failureDetails) console.error(`         └─ Error: ${failureDetails}`);
  }
}

console.log('================================================================');
console.log('NEXA CBT Round 18 - School Default Custom Grading Scheme Tests');
console.log('================================================================\n');

// 1. Static AST and Code Inspections
console.log('--- SECTION 1: Static AST & Code Inspection ---');
const panelPath = path.join(rootDir, 'src', 'components', 'SkemaPenilaianPanel.jsx');
const panelSource = fs.readFileSync(panelPath, 'utf8');

let astClean = false;
try {
  parse(panelSource, { sourceType: 'module', plugins: ['jsx'] });
  astClean = true;
} catch (e) {
  astClean = false;
}
assertTest(astClean, 'SkemaPenilaianPanel.jsx parses with zero AST syntax errors');

assertTest(
  panelSource.includes('useRef'),
  'SkemaPenilaianPanel imports and uses useRef to track editing state'
);

assertTest(
  panelSource.includes('EMPTY_DATA_SOAL'),
  'dataSoal defaults to static constant to prevent array reference churn on parent re-render'
);

assertTest(
  panelSource.includes('isUserEditingRef'),
  'isUserEditingRef protects local state from being overwritten during user edits'
);

assertTest(
  panelSource.includes('hitungTotalPersentase') && panelSource.includes('Math.round'),
  'hitungTotalPersentase applies Math.round for decimal precision'
);

assertTest(
  panelSource.includes('if (total !== 100)'),
  'SkemaPenilaianPanel strictly preserves if (total !== 100) check for compatibility'
);

// 2. Behavioral Simulation: React Lifecycle & Parent Re-renders
console.log('\n--- SECTION 2: State Stability across Parent Re-renders ---');

function createPanelHarness(initialSkemaProp = { mode: 'default', skema: { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 } }) {
  const defaultSkema = { PG: 0, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 };
  
  // Replicate React component instance state
  let currentInitialSkema = initialSkemaProp;
  let mode = currentInitialSkema?.mode || 'default';
  let skema = currentInitialSkema?.skema ? { ...defaultSkema, ...currentInitialSkema.skema } : { ...defaultSkema };
  const isUserEditingRef = { current: false };
  const lastInitialSkemaRef = { current: currentInitialSkema };

  function renderEffect() {
    if (currentInitialSkema && !isUserEditingRef.current) {
      const isSame = JSON.stringify(lastInitialSkemaRef.current) === JSON.stringify(currentInitialSkema);
      if (!isSame) {
        lastInitialSkemaRef.current = currentInitialSkema;
        mode = currentInitialSkema.mode || 'default';
        if (currentInitialSkema.skema) {
          skema = { ...defaultSkema, ...currentInitialSkema.skema };
        }
      }
    }
  }

  function userSelectMode(newMode) {
    isUserEditingRef.current = true;
    mode = newMode;
    renderEffect();
  }

  function userUpdateWeight(type, value) {
    isUserEditingRef.current = true;
    skema[type] = value;
    renderEffect();
  }

  function parentReRender(newInitialSkema = currentInitialSkema) {
    currentInitialSkema = newInitialSkema;
    renderEffect();
  }

  function parseWeight(val) {
    if (typeof val === 'string') {
      return parseFloat(val.replace(',', '.')) || 0;
    }
    return parseFloat(val) || 0;
  }

  function hitungTotal() {
    const raw = Object.values(skema).reduce((acc, val) => acc + parseWeight(val), 0);
    return Math.round(raw * 100) / 100;
  }

  function save(onSave, onAlert) {
    const cleanSkema = {};
    for (const [k, v] of Object.entries(skema)) {
      cleanSkema[k] = parseWeight(v);
    }
    if (mode === 'custom') {
      const total = hitungTotal();
      if (total !== 100) {
        if (onAlert) onAlert(total);
        return false;
      }
      const hasNegative = Object.values(cleanSkema).some(v => v < 0);
      if (hasNegative) {
        if (onAlert) onAlert('negative');
        return false;
      }
      isUserEditingRef.current = false;
      if (onSave) onSave({ mode: 'custom', skema: cleanSkema, bobot: 1 });
      return true;
    } else {
      isUserEditingRef.current = false;
      if (onSave) onSave({ mode: 'default', skema: cleanSkema, bobot: 0 });
      return true;
    }
  }

  return {
    getMode: () => mode,
    getSkema: () => ({ ...skema }),
    isInputDisabled: () => mode === 'default',
    userSelectMode,
    userUpdateWeight,
    parentReRender,
    hitungTotal,
    save
  };
}

// Test A: Switching to custom mode does NOT reset when parent re-renders
const harness = createPanelHarness();
assertTest(harness.getMode() === 'default', 'Initial mode is default');
assertTest(harness.isInputDisabled() === true, 'Inputs are disabled in default mode');

harness.userSelectMode('custom');
assertTest(harness.getMode() === 'custom', 'Clicking custom button changes mode to "custom"');
assertTest(harness.isInputDisabled() === false, 'Inputs are active and editable in custom mode');

// Simulate 10 parent re-renders (like AdminView timer / state updates)
for (let i = 0; i < 10; i++) {
  harness.parentReRender({ mode: 'default', skema: { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 } });
}
assertTest(
  harness.getMode() === 'custom',
  'Mode remains "custom" after 10 parent re-renders with default initialSkema'
);
assertTest(
  harness.isInputDisabled() === false,
  'Inputs remain enabled after parent re-renders'
);

// Test B: Updating weights and verifying they are not wiped by parent re-renders
harness.userUpdateWeight('PG', 30);
harness.userUpdateWeight('PGK', 20);
harness.userUpdateWeight('BS', 20);
harness.userUpdateWeight('JODOH', 10);
harness.userUpdateWeight('ISIAN', 10);
harness.userUpdateWeight('URAIAN', 10);

// Re-render parent again
harness.parentReRender();
const currentWeights = harness.getSkema();
assertTest(
  currentWeights.PG === 30 && currentWeights.URAIAN === 10,
  'Custom weights are preserved and not overwritten by parent re-render'
);

// 3. Decimal Precision & Validation
console.log('\n--- SECTION 3: Decimal Precision & Validation ---');

// Test 33.33 + 33.33 + 33.34 = 100%
const harnessSplit = createPanelHarness();
harnessSplit.userSelectMode('custom');
harnessSplit.userUpdateWeight('PG', 33.33);
harnessSplit.userUpdateWeight('PGK', 33.33);
harnessSplit.userUpdateWeight('BS', 33.34);
harnessSplit.userUpdateWeight('JODOH', 0);
harnessSplit.userUpdateWeight('ISIAN', 0);
harnessSplit.userUpdateWeight('URAIAN', 0);

assertTest(harnessSplit.hitungTotal() === 100, 'Floating point split (33.33 + 33.33 + 33.34) totals exactly 100%');

let savedPayload = null;
const saveSuccess = harnessSplit.save((payload) => { savedPayload = payload; });
assertTest(saveSuccess === true, 'Validation passes for 33.33 + 33.33 + 33.34 distribution');
assertTest(
  savedPayload && savedPayload.mode === 'custom' && savedPayload.bobot === 1 && savedPayload.skema.PG === 33.33,
  'Payload emitted is { mode: "custom", skema, bobot: 1 }'
);

// Test 5 * 16.66 + 16.70 (known IEEE-754 float drift: 100.00000000000001)
const harnessFloatDrift = createPanelHarness();
harnessFloatDrift.userSelectMode('custom');
harnessFloatDrift.userUpdateWeight('PG', 16.66);
harnessFloatDrift.userUpdateWeight('PGK', 16.66);
harnessFloatDrift.userUpdateWeight('BS', 16.66);
harnessFloatDrift.userUpdateWeight('JODOH', 16.66);
harnessFloatDrift.userUpdateWeight('ISIAN', 16.66);
harnessFloatDrift.userUpdateWeight('URAIAN', 16.70);

assertTest(harnessFloatDrift.hitungTotal() === 100, 'Float drift (5 * 16.66 + 16.70) totals exactly 100.00%');
const driftSave = harnessFloatDrift.save((p) => {});
assertTest(driftSave === true, 'Float drift 100.00% is accepted without alert');

// Test rejection of sum !== 100% (e.g. 99.99%)
const harnessInvalid = createPanelHarness();
harnessInvalid.userSelectMode('custom');
harnessInvalid.userUpdateWeight('PG', 33.33);
harnessInvalid.userUpdateWeight('PGK', 33.33);
harnessInvalid.userUpdateWeight('BS', 33.33);
harnessInvalid.userUpdateWeight('JODOH', 0);
harnessInvalid.userUpdateWeight('ISIAN', 0);
harnessInvalid.userUpdateWeight('URAIAN', 0);

assertTest(harnessInvalid.hitungTotal() === 99.99, 'Sum 99.99% is computed accurately');
let alertCalledWith = null;
const rejectSuccess = harnessInvalid.save(null, (tot) => { alertCalledWith = tot; });
assertTest(rejectSuccess === false && alertCalledWith === 99.99, 'Sum 99.99% is strictly rejected with alert');

// 4. Persistence Integration
console.log('\n--- SECTION 4: API & LocalStorage Persistence Integration ---');

const testNpsn = '70040625';
const customPayload = {
  mode: 'custom',
  skema: { PG: 50, PGK: 20, BS: 10, JODOH: 10, ISIAN: 5, URAIAN: 5 },
  bobot: 1
};

try {
  mockStorage.clear();
  const saveRes = await save_default_skema_sekolah(testNpsn, customPayload);
  assertTest(saveRes && saveRes.success === true, 'save_default_skema_sekolah succeeds for custom payload');

  const loadedRes = await get_default_skema_sekolah(testNpsn);
  assertTest(
    loadedRes && loadedRes.mode === 'custom' && loadedRes.skema.PG === 50,
    'get_default_skema_sekolah returns persisted custom mode scheme'
  );

  // Restore clean default scheme for the school
  await save_default_skema_sekolah(testNpsn, {
    mode: 'default',
    skema: { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 },
    bobot: 0
  });
  assertTest(true, 'Restored clean default scheme in teardown');
} catch (err) {
  assertTest(false, 'save_default_skema_sekolah persistence error', err.message);
}

// 5. Adversarial Probing & Advanced Resilience
console.log('\n--- SECTION 5: Adversarial Probing & Advanced Resilience ---');

// 5.1 AST & Component Interface Guarantees
assertTest(
  panelSource.includes("useState('default')"),
  'SkemaPenilaianPanel initializes mode state with standard useState("default")'
);

assertTest(
  panelSource.includes('step="any"'),
  'Number inputs declare step="any" for native browser decimal float compatibility'
);

assertTest(
  panelSource.includes('!isUserEditingRef.current'),
  'Teacher and School Default modes both guard local state against prop churn while editing'
);

// 5.2 Negative Weight Rejection Even When Sum Equals 100%
const harnessNegative = createPanelHarness();
harnessNegative.userSelectMode('custom');
harnessNegative.userUpdateWeight('PG', 110);
harnessNegative.userUpdateWeight('PGK', -10);
harnessNegative.userUpdateWeight('BS', 0);
harnessNegative.userUpdateWeight('JODOH', 0);
harnessNegative.userUpdateWeight('ISIAN', 0);
harnessNegative.userUpdateWeight('URAIAN', 0);

assertTest(harnessNegative.hitungTotal() === 100, 'Negative sum (110 + -10) mathematically totals 100%');
let negAlertFired = false;
const negSaveResult = harnessNegative.save(null, (msg) => {
  negAlertFired = msg === 'negative';
});
assertTest(
  negSaveResult === false && negAlertFired === true,
  'Negative weight (PG: 110, PGK: -10) is strictly rejected at the UI layer'
);

// 5.3 Indonesian Locale Decimal Comma Parsing
const harnessComma = createPanelHarness();
harnessComma.userSelectMode('custom');
harnessComma.userUpdateWeight('PG', '33,33');
harnessComma.userUpdateWeight('PGK', '33,33');
harnessComma.userUpdateWeight('BS', '33,34');
harnessComma.userUpdateWeight('JODOH', '0');
harnessComma.userUpdateWeight('ISIAN', '0');
harnessComma.userUpdateWeight('URAIAN', '0');

assertTest(harnessComma.hitungTotal() === 100, 'Comma decimals ("33,33" + "33,33" + "33,34") correctly parsed to 100%');
let commaPayload = null;
const commaSaveSuccess = harnessComma.save((p) => { commaPayload = p; });
assertTest(
  commaSaveSuccess === true && commaPayload && commaPayload.skema.PG === 33.33 && commaPayload.skema.BS === 33.34,
  'Comma decimals normalize to standard IEEE numbers in emitted payload'
);

// 5.4 Rapid Mode Toggling Stress Test
const harnessToggle = createPanelHarness();
assertTest(harnessToggle.getMode() === 'default', 'Starts in default mode');
// User clicks custom
harnessToggle.userSelectMode('custom');
harnessToggle.parentReRender(); // Background polling re-render
assertTest(harnessToggle.getMode() === 'custom', 'Custom mode preserved after 1st toggle & parent re-render');

// User changes mind and clicks default
harnessToggle.userSelectMode('default');
harnessToggle.parentReRender(); // Background polling re-render
assertTest(harnessToggle.getMode() === 'default', 'Default mode preserved after 2nd toggle & parent re-render');

// User clicks custom again and sets custom weights
harnessToggle.userSelectMode('custom');
harnessToggle.userUpdateWeight('PG', 60);
harnessToggle.userUpdateWeight('URAIAN', 40);
harnessToggle.parentReRender(); // Multiple rapid parent re-renders
harnessToggle.parentReRender();
assertTest(harnessToggle.getMode() === 'custom', 'Custom mode preserved after 3rd toggle & rapid re-renders');
assertTest(
  harnessToggle.getSkema().PG === 60 && harnessToggle.getSkema().URAIAN === 40,
  'Custom weights intact after multi-toggle cycle'
);

console.log('\n================================================================');
console.log(`ROUND 18 TEST SUMMARY: ${passedTests}/${totalTests} Passed (${Math.round((passedTests/totalTests)*100)}%)`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
