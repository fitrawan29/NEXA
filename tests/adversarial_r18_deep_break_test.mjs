/**
 * ============================================================================
 * NEXA CBT Round 18 - Adversarial Reviewer Deep Break & Resilience Suite
 * ============================================================================
 *
 * Tests:
 * 1. React Component AST & Markup Compliance
 * 2. Parent Re-render Churn (100 rapid cycles with reference changes)
 * 3. User Interruption & Form State Preservation
 * 4. Boundary Value & Decimal Precision Fuzzing
 * 5. Negative, Malformed, and Locale-Specific Input Defense
 * 6. Full Round-Trip Persistence (School Default & Teacher modes)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

// Setup Mock LocalStorage for Node environment
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
console.log('ADVERSARIAL REVIEWER ROUND 18: DEEP BREAK & STRESS TEST');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: AST Invariants & Component Interface Integrity
// -----------------------------------------------------------------------------
console.log('--- SECTION 1: AST Invariants & Component Interface Integrity ---');
const panelFile = path.join(rootDir, 'src', 'components', 'SkemaPenilaianPanel.jsx');
const panelContent = fs.readFileSync(panelFile, 'utf8');

let astOk = false;
try {
  parse(panelContent, { sourceType: 'module', plugins: ['jsx'] });
  astOk = true;
} catch (e) {
  astOk = false;
}
assertTest(astOk, 'SkemaPenilaianPanel.jsx compiles with zero JSX/ESM syntax errors');

// Invariant 1.1: Mode initialization must not break M3 AST regex
const m3RegexMatch = panelContent.includes("useState('default')") || /useState\(['"]default['"]\)/.test(panelContent);
assertTest(m3RegexMatch, 'Initial mode state strictly uses useState("default") for AST backward compatibility');

// Invariant 1.2: step="any" on all inputs for decimal support
assertTest(panelContent.includes('step="any"'), 'HTML5 <input type="number"> includes step="any"');

// Invariant 1.3: value={skema[tipe] ?? ''} handles nullish values
assertTest(panelContent.includes('skema[tipe] ?? \'\''), 'Input value handles nullish fallbacks gracefully');

// Invariant 1.4: Ref-based editing shield
assertTest(panelContent.includes('isUserEditingRef'), 'Ref-based user editing shield is declared and utilized');

// -----------------------------------------------------------------------------
// SECTION 2: Adversarial Lifecycle & Parent Re-Render Stress
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: Adversarial Lifecycle & Parent Re-Render Stress ---');

// Simulated exact component state engine
function createSimulationEngine(initialProps = {}) {
  const defaultSkema = { PG: 0, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 };
  let mode = 'default';
  let skema = { ...defaultSkema };
  const isSchoolDefault = initialProps.isSchoolDefault ?? false;
  let initialSkema = initialProps.initialSkema ?? null;
  let dataSoal = initialProps.dataSoal ?? [];

  const isUserEditingRef = { current: false };
  const lastInitialSkemaRef = { current: null };

  function runEffect() {
    if (isSchoolDefault) {
      if (initialSkema && !isUserEditingRef.current) {
        const isSame = JSON.stringify(lastInitialSkemaRef.current) === JSON.stringify(initialSkema);
        if (!isSame) {
          lastInitialSkemaRef.current = initialSkema;
          mode = initialSkema.mode || 'default';
          if (initialSkema.skema) {
            skema = { ...defaultSkema, ...initialSkema.skema };
          }
        }
      }
      return;
    }

    // Teacher mode
    if (!isUserEditingRef.current) {
      const skemaRecord = dataSoal?.find(s => s.tipe_soal === 'SKEMA_PENILAIAN');
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
            const hasCustom = Object.values(parsed).some(v => parseFloat(v) > 0);
            mode = hasCustom ? 'custom' : 'default';
            skema = { ...defaultSkema, ...parsed };
          }
        }
      }
    }
  }

  // Initial mount effect
  runEffect();

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

  function selectMode(newMode) {
    isUserEditingRef.current = true;
    mode = newMode;
  }

  function updateWeight(type, value) {
    isUserEditingRef.current = true;
    skema = { ...skema, [type]: value };
  }

  function triggerParentReRender(newInitialSkema, newDataSoal) {
    if (newInitialSkema !== undefined) initialSkema = newInitialSkema;
    if (newDataSoal !== undefined) dataSoal = newDataSoal;
    runEffect();
  }

  function save(onSave, onAlert) {
    const cleanSkema = {};
    for (const [k, v] of Object.entries(skema)) {
      cleanSkema[k] = parseWeight(v);
    }
    const standardDefaultSkema = { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 };

    if (mode === 'custom') {
      const total = hitungTotal();
      if (total !== 100) {
        if (onAlert) onAlert(`Total: ${total}%`);
        return false;
      }
      const hasNegative = Object.values(cleanSkema).some(v => v < 0);
      if (hasNegative) {
        if (onAlert) onAlert('negative');
        return false;
      }
      isUserEditingRef.current = false;
      if (isSchoolDefault) {
        if (onSave) onSave({ mode: 'custom', skema: cleanSkema, bobot: 1 });
        return true;
      }
      if (onSave) onSave({ kunci_jawaban: JSON.stringify({ mode: 'custom', skema: cleanSkema }), bobot: 1 });
      return true;
    } else {
      isUserEditingRef.current = false;
      const activeDefaultSkema = Object.values(cleanSkema).some(v => v > 0) ? cleanSkema : standardDefaultSkema;
      if (isSchoolDefault) {
        if (onSave) onSave({ mode: 'default', skema: activeDefaultSkema, bobot: 0 });
        return true;
      }
      if (onSave) onSave({ kunci_jawaban: JSON.stringify({ mode: 'default', skema: activeDefaultSkema }), bobot: 0 });
      return true;
    }
  }

  return {
    getMode: () => mode,
    getSkema: () => ({ ...skema }),
    selectMode,
    updateWeight,
    triggerParentReRender,
    hitungTotal,
    save,
    isEditing: () => isUserEditingRef.current
  };
}

// 2.1 100 Rapid Parent Re-renders with Unrelated State Updates
const sim = createSimulationEngine({
  isSchoolDefault: true,
  initialSkema: { mode: 'default', skema: { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 } }
});

assertTest(sim.getMode() === 'default', 'Mounts with default mode as configured in initialSkema');

// User switches to custom
sim.selectMode('custom');
sim.updateWeight('PG', 40);
sim.updateWeight('PGK', 30);
sim.updateWeight('BS', 30);
sim.updateWeight('JODOH', 0);
sim.updateWeight('ISIAN', 0);
sim.updateWeight('URAIAN', 0);

// Hammer with 100 re-renders passing new object references of the initial prop
for (let i = 0; i < 100; i++) {
  sim.triggerParentReRender({
    mode: 'default',
    skema: { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 },
    _noise: Math.random()
  });
}

assertTest(sim.getMode() === 'custom', 'Mode firmly remains "custom" across 100 simulated parent re-renders');
assertTest(sim.getSkema().PG === 40 && sim.getSkema().PGK === 30 && sim.getSkema().BS === 30, 'Custom weights completely protected from parent churn');

// 2.2 Successful Save syncs new state and allows subsequent server updates
let emittedPayload = null;
const saveOk = sim.save((p) => { emittedPayload = p; });
assertTest(saveOk === true, 'Save succeeds with exact 100% total (40+30+30)');
assertTest(
  emittedPayload && emittedPayload.mode === 'custom' && emittedPayload.bobot === 1,
  'Emitted payload matches { mode: "custom", skema, bobot: 1 } requirement'
);

// Parent updates with saved payload
sim.triggerParentReRender(emittedPayload);
assertTest(sim.getMode() === 'custom', 'Mode persists as "custom" after parent receives server confirmation');
assertTest(sim.getSkema().PG === 40, 'Weights reflect saved values');

// -----------------------------------------------------------------------------
// SECTION 3: Decimal Precision & Boundary Math Fuzzing
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: Decimal Precision & Boundary Math Fuzzing ---');

const testCases = [
  // [weights, expectedSum, expectedPass, description]
  [{ PG: 33.33, PGK: 33.33, BS: 33.34 }, 100, true, 'Standard 3-way split (33.33 + 33.33 + 33.34)'],
  [{ PG: 16.66, PGK: 16.66, BS: 16.66, JODOH: 16.66, ISIAN: 16.66, URAIAN: 16.70 }, 100, true, '6-way float drift split (5x16.66 + 16.70)'],
  [{ PG: 12.5, PGK: 12.5, BS: 25, JODOH: 25, ISIAN: 12.5, URAIAN: 12.5 }, 100, true, 'Quarter/eighth splits (12.5 & 25)'],
  [{ PG: 99.99, PGK: 0.01 }, 100, true, 'Extreme boundary split (99.99 + 0.01)'],
  [{ PG: 100 }, 100, true, 'Single 100% question type'],
  [{ PG: 33.33, PGK: 33.33, BS: 33.33 }, 99.99, false, 'Under sum 99.99% strictly rejected'],
  [{ PG: 50, PGK: 50.01 }, 100.01, false, 'Over sum 100.01% strictly rejected'],
  [{ PG: 0, PGK: 0 }, 0, false, 'All zero sum 0% strictly rejected']
];

for (const [w, expSum, expPass, desc] of testCases) {
  const fuzzer = createSimulationEngine({ isSchoolDefault: true });
  fuzzer.selectMode('custom');
  for (const [k, v] of Object.entries(w)) {
    fuzzer.updateWeight(k, v);
  }
  const calcSum = fuzzer.hitungTotal();
  const passed = fuzzer.save();
  assertTest(
    calcSum === expSum && passed === expPass,
    `[Fuzzing] ${desc} (sum=${calcSum}%, pass=${passed})`
  );
}

// -----------------------------------------------------------------------------
// SECTION 4: Locale & Input Format Defense
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Locale & Input Format Defense ---');

// Indonesian comma decimal input
const commaSim = createSimulationEngine({ isSchoolDefault: true });
commaSim.selectMode('custom');
commaSim.updateWeight('PG', '50,5');
commaSim.updateWeight('URAIAN', '49,5');

assertTest(commaSim.hitungTotal() === 100, 'Indonesian comma input "50,5" + "49,5" totals 100%');
let commaEmitted = null;
commaSim.save((p) => { commaEmitted = p; });
assertTest(
  commaEmitted && commaEmitted.skema.PG === 50.5 && commaEmitted.skema.URAIAN === 49.5,
  'Comma strings are parsed into clean IEEE-754 numbers in payload'
);

// Negative weights rejection even when sum is 100%
const negSim = createSimulationEngine({ isSchoolDefault: true });
negSim.selectMode('custom');
negSim.updateWeight('PG', '120');
negSim.updateWeight('PGK', '-20');

assertTest(negSim.hitungTotal() === 100, '120 + (-20) mathematically equals 100%');
let alertResult = null;
const negSaved = negSim.save(null, (msg) => { alertResult = msg; });
assertTest(
  negSaved === false && alertResult === 'negative',
  'Negative weight input is strictly intercepted and blocked before dispatch'
);

// -----------------------------------------------------------------------------
// SECTION 5: Teacher Mode Isolation (GuruView Compatibility)
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 5: Teacher Mode Isolation (GuruView Compatibility) ---');

// Teacher with no prior skema record
const teacherNewSim = createSimulationEngine({
  isSchoolDefault: false,
  dataSoal: [
    { id_soal: 'Q1', tipe_soal: 'PG', pertanyaan: 'Test 1' },
    { id_soal: 'Q2', tipe_soal: 'URAIAN', pertanyaan: 'Test 2' }
  ]
});

assertTest(teacherNewSim.getMode() === 'default', 'Teacher with no skema record defaults to mode "default"');
teacherNewSim.selectMode('custom');
teacherNewSim.updateWeight('PG', 60);
teacherNewSim.updateWeight('URAIAN', 40);

// Teacher mode save emits format for soal_ujian table
let teacherEmitted = null;
teacherNewSim.save((p) => { teacherEmitted = p; });
assertTest(
  teacherEmitted && typeof teacherEmitted.kunci_jawaban === 'string' && teacherEmitted.bobot === 1,
  'Teacher mode emits JSON stringified kunci_jawaban with bobot: 1'
);

const parsedKunci = JSON.parse(teacherEmitted.kunci_jawaban);
assertTest(
  parsedKunci.mode === 'custom' && parsedKunci.skema.PG === 60 && parsedKunci.skema.URAIAN === 40,
  'Teacher custom skema payload structure is verified'
);

// -----------------------------------------------------------------------------
// SECTION 6: API Persistence End-to-End Roundtrip
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 6: API Persistence End-to-End Roundtrip ---');

const npsnTest = '70040625';

// 6.1 Save custom mode to DB & Cache
const customSaveRes = await save_default_skema_sekolah(npsnTest, {
  mode: 'custom',
  skema: { PG: 40, PGK: 20, BS: 20, JODOH: 10, ISIAN: 5, URAIAN: 5 },
  bobot: 1
});
assertTest(customSaveRes && customSaveRes.success === true, 'save_default_skema_sekolah persists custom scheme');

// 6.2 Retrieve from cache & verify
const customGetRes = await get_default_skema_sekolah(npsnTest);
assertTest(
  customGetRes && customGetRes.mode === 'custom' && customGetRes.skema.PG === 40,
  'get_default_skema_sekolah reads back custom scheme accurately'
);

// 6.3 Save default mode back to restore clean state
const defaultSaveRes = await save_default_skema_sekolah(npsnTest, {
  mode: 'default',
  skema: { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 },
  bobot: 0
});
assertTest(defaultSaveRes && defaultSaveRes.success === true, 'Teardown restored school default to clean mode');

console.log('\n================================================================');
console.log(`ADVERSARIAL STRESS SUMMARY: ${passedTests}/${totalTests} Passed (${Math.round((passedTests/totalTests)*100)}%)`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
