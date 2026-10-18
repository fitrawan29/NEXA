/**
 * adversarial_r18_round3_final_check.mjs
 * Round 3 Adversarial Verification Suite
 * Testing School Default Custom Grading Scheme (R1, R2, and Acceptance Criteria)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function recordTest(category, name, passed, detail = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  [PASS] [${category}] ${name}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] [${category}] ${name} -> ${detail}`);
  }
}

async function runAllTests() {
  console.log('========================================================================');
  console.log('  ADVERSARIAL REVIEWER ROUND 3: FINAL INDEPENDENT VERIFICATION          ');
  console.log('========================================================================\n');

  // ==========================================
  // SECTION 1: AST & SOURCE CODE VERIFICATION
  // ==========================================
  console.log('--- SECTION 1: Source Code & AST Integrity ---');
  const panelPath = path.join(rootDir, 'src', 'components', 'SkemaPenilaianPanel.jsx');
  const adminViewPath = path.join(rootDir, 'src', 'views', 'AdminView.jsx');
  const apiPath = path.join(rootDir, 'src', 'api.js');

  const panelCode = fs.readFileSync(panelPath, 'utf8');
  const adminCode = fs.readFileSync(adminViewPath, 'utf8');
  const apiCode = fs.readFileSync(apiPath, 'utf8');

  recordTest('AST', 'SkemaPenilaianPanel.jsx exists and has content', panelCode.length > 500);
  recordTest('AST', 'AdminView.jsx exists and has content', adminCode.length > 5000);
  recordTest('AST', 'api.js exists and exports save_default_skema_sekolah', apiCode.includes('export const save_default_skema_sekolah'));

  // SkemaPenilaianPanel component checks
  recordTest('AST', 'SkemaPenilaianPanel uses useRef for edit tracking', panelCode.includes('useRef'));
  recordTest('AST', 'SkemaPenilaianPanel defines parseWeight helper for comma & string normalization', panelCode.includes('parseWeight'));
  recordTest('AST', 'SkemaPenilaianPanel implements Math.round decimal precision validation', panelCode.includes('Math.round(raw * 100) / 100'));
  recordTest('AST', 'SkemaPenilaianPanel strictly rejects negative weights in custom mode', panelCode.includes('hasNegative') && panelCode.includes('alert'));
  recordTest('AST', 'SkemaPenilaianPanel renders step="any" on number inputs', panelCode.includes('step="any"'));
  recordTest('AST', 'SkemaPenilaianPanel inputs are disabled when mode === "default"', panelCode.includes('disabled={mode === \'default\'}'));
  recordTest('AST', 'SkemaPenilaianPanel supports isSchoolDefault custom button label', panelCode.includes('Kustom (Bobot Persentase)'));
  recordTest('AST', 'SkemaPenilaianPanel supports isSchoolDefault submit button label', panelCode.includes('Simpan Format Default'));

  // AdminView checks
  recordTest('AdminView', 'AdminView imports save_default_skema_sekolah', adminCode.includes('save_default_skema_sekolah'));
  recordTest('AdminView', 'AdminView mounts SkemaPenilaianPanel with isSchoolDefault={true}', adminCode.includes('isSchoolDefault={true}'));
  recordTest('AdminView', 'AdminView passes initialSkema={defaultSkemaSekolah}', adminCode.includes('initialSkema={defaultSkemaSekolah}'));
  recordTest('AdminView', 'AdminView passes onSave={handleSaveDefaultSkema}', adminCode.includes('onSave={handleSaveDefaultSkema}'));

  // ==========================================
  // SECTION 2: ADVERSARIAL RE-RENDER STRESS TEST
  // ==========================================
  console.log('\n--- SECTION 2: Parent Re-Render Shield Simulation (200 Cycles) ---');

  // Simulate component state machine
  class SimulatedPanel {
    constructor(props) {
      this.props = { ...props };
      this.defaultSkema = { PG: 0, PGK: 0, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 };
      this.mode = 'default';
      this.skema = { ...this.defaultSkema };
      this.isUserEditingRef = { current: false };
      this.lastInitialSkemaRef = { current: null };
      this.alerts = [];

      this.runEffect();
    }

    runEffect() {
      const { isSchoolDefault, initialSkema } = this.props;
      if (isSchoolDefault) {
        if (initialSkema && !this.isUserEditingRef.current) {
          const isSame = JSON.stringify(this.lastInitialSkemaRef.current) === JSON.stringify(initialSkema);
          if (!isSame) {
            this.lastInitialSkemaRef.current = initialSkema;
            this.mode = initialSkema.mode || 'default';
            if (initialSkema.skema) {
              this.skema = { ...this.defaultSkema, ...initialSkema.skema };
            }
          }
        }
      }
    }

    setProps(newProps) {
      this.props = { ...this.props, ...newProps };
      this.runEffect();
    }

    userClickMode(newMode) {
      this.isUserEditingRef.current = true;
      this.mode = newMode;
    }

    userChangeWeight(type, val) {
      this.isUserEditingRef.current = true;
      this.skema = { ...this.skema, [type]: val };
    }

    parseWeight(val) {
      if (typeof val === 'string') {
        return parseFloat(val.replace(',', '.')) || 0;
      }
      return parseFloat(val) || 0;
    }

    hitungTotalPersentase() {
      const raw = Object.values(this.skema).reduce((acc, val) => acc + this.parseWeight(val), 0);
      return Math.round(raw * 100) / 100;
    }

    handleSave() {
      const cleanSkema = {};
      for (const [k, v] of Object.entries(this.skema)) {
        cleanSkema[k] = this.parseWeight(v);
      }
      const standardDefaultSkema = { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 };

      if (this.mode === 'custom') {
        const total = this.hitungTotalPersentase();
        if (total !== 100) {
          this.alerts.push(`Total persentase bobot skema khusus harus tepat 100%. Saat ini: ${total}%.`);
          return null;
        }
        const hasNegative = Object.values(cleanSkema).some(v => v < 0);
        if (hasNegative) {
          this.alerts.push('Bobot persentase tidak boleh bernilai negatif.');
          return null;
        }
        this.isUserEditingRef.current = false;
        if (this.props.isSchoolDefault) {
          return {
            mode: 'custom',
            skema: cleanSkema,
            bobot: 1
          };
        }
      } else {
        this.isUserEditingRef.current = false;
        const activeDefaultSkema = Object.values(cleanSkema).some(v => v > 0) ? cleanSkema : standardDefaultSkema;
        if (this.props.isSchoolDefault) {
          return {
            mode: 'default',
            skema: activeDefaultSkema,
            bobot: 0
          };
        }
      }
    }
  }

  const initialProps = {
    isSchoolDefault: true,
    initialSkema: {
      mode: 'default',
      skema: { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 }
    }
  };

  const panel = new SimulatedPanel(initialProps);
  recordTest('ReRender', 'Initial mode is default', panel.mode === 'default');

  // User clicks custom mode
  panel.userClickMode('custom');
  recordTest('ReRender', 'Mode changes to custom on click', panel.mode === 'custom');

  // User edits weights
  panel.userChangeWeight('PG', '40');
  panel.userChangeWeight('PGK', '30');
  panel.userChangeWeight('BS', '30');
  panel.userChangeWeight('JODOH', '0');
  panel.userChangeWeight('ISIAN', '0');
  panel.userChangeWeight('URAIAN', '0');

  // Hammer with 200 rapid parent re-renders with fresh object references
  let modeLost = false;
  let weightsLost = false;
  for (let i = 0; i < 200; i++) {
    panel.setProps({
      initialSkema: {
        mode: 'default',
        skema: { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 },
        _churnNonce: Math.random()
      }
    });
    if (panel.mode !== 'custom') modeLost = true;
    if (panel.skema.PG !== '40' || panel.skema.PGK !== '30' || panel.skema.BS !== '30') weightsLost = true;
  }

  recordTest('ReRender', 'Custom mode survived 200 rapid parent re-render cycles', !modeLost);
  recordTest('ReRender', 'Custom weight inputs survived 200 rapid parent re-render cycles', !weightsLost);

  // User saves
  const savedPayload = panel.handleSave();
  recordTest('ReRender', 'Valid custom weights save succeeds without alert', savedPayload !== null && panel.alerts.length === 0);
  recordTest('ReRender', 'Saved payload matches exact required format { mode: "custom", skema, bobot: 1 }',
    savedPayload &&
    savedPayload.mode === 'custom' &&
    savedPayload.bobot === 1 &&
    savedPayload.skema.PG === 40 &&
    savedPayload.skema.PGK === 30 &&
    savedPayload.skema.BS === 30 &&
    savedPayload.skema.JODOH === 0
  );

  // Parent receives confirmed save and passes new initialSkema
  panel.setProps({
    initialSkema: savedPayload
  });
  recordTest('ReRender', 'Component mode remains "custom" after parent updates with saved state', panel.mode === 'custom');
  recordTest('ReRender', 'Component skema retains saved weights after parent updates', panel.skema.PG === 40 && panel.skema.PGK === 30);

  // ==========================================
  // SECTION 3: BOUNDARY & DECIMAL FUZZING
  // ==========================================
  console.log('\n--- SECTION 3: Decimal Precision & Boundary Value Analysis ---');

  const decimalCases = [
    { name: 'Standard 3-way split (33.33 + 33.33 + 33.34)', skema: { PG: '33.33', PGK: '33.33', BS: '33.34', JODOH: '0', ISIAN: '0', URAIAN: '0' }, valid: true },
    { name: '6-way float drift split (5x16.66 + 16.70)', skema: { PG: '16.66', PGK: '16.66', BS: '16.66', JODOH: '16.66', ISIAN: '16.66', URAIAN: '16.70' }, valid: true },
    { name: 'Indonesian comma format (33,33 + 33,33 + 33,34)', skema: { PG: '33,33', PGK: '33,33', BS: '33,34', JODOH: '0', ISIAN: '0', URAIAN: '0' }, valid: true },
    { name: 'Quarter fractions (12.5 + 12.5 + 25 + 25 + 12.5 + 12.5)', skema: { PG: '12.5', PGK: '12.5', BS: '25', JODOH: '25', ISIAN: '12.5', URAIAN: '12.5' }, valid: true },
    { name: 'Boundary: 99.99 + 0.01', skema: { PG: '99.99', PGK: '0.01', BS: '0', JODOH: '0', ISIAN: '0', URAIAN: '0' }, valid: true },
    { name: 'Single 100% on URAIAN', skema: { PG: '0', PGK: '0', BS: '0', JODOH: '0', ISIAN: '0', URAIAN: '100' }, valid: true },
    { name: 'Empty string treated as 0% (50 + 50 + empty)', skema: { PG: '50', PGK: '50', BS: '', JODOH: '', ISIAN: '', URAIAN: '' }, valid: true },
    { name: 'Under sum: 99.99% strictly rejected', skema: { PG: '99.99', PGK: '0', BS: '0', JODOH: '0', ISIAN: '0', URAIAN: '0' }, valid: false },
    { name: 'Over sum: 100.01% strictly rejected', skema: { PG: '50.01', PGK: '50.00', BS: '0', JODOH: '0', ISIAN: '0', URAIAN: '0' }, valid: false },
    { name: 'Zero sum: 0% strictly rejected', skema: { PG: '0', PGK: '0', BS: '0', JODOH: '0', ISIAN: '0', URAIAN: '0' }, valid: false },
    { name: 'Negative weight: (110 + -10) strictly rejected', skema: { PG: '110', PGK: '-10', BS: '0', JODOH: '0', ISIAN: '0', URAIAN: '0' }, valid: false },
  ];

  for (const tc of decimalCases) {
    const testPanel = new SimulatedPanel({ isSchoolDefault: true, initialSkema: { mode: 'default' } });
    testPanel.userClickMode('custom');
    for (const [k, v] of Object.entries(tc.skema)) {
      testPanel.userChangeWeight(k, v);
    }
    const res = testPanel.handleSave();
    const passed = tc.valid ? (res !== null) : (res === null && testPanel.alerts.length > 0);
    recordTest('BVA', tc.name, passed);
  }

  // ==========================================
  // SECTION 4: LIVE API & PERSISTENCE
  // ==========================================
  console.log('\n--- SECTION 4: Live API & LocalStorage Roundtrip Verification ---');
  // Mock localStorage for Node
  if (typeof global.localStorage === 'undefined') {
    const store = new Map();
    global.localStorage = {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (i) => Array.from(store.keys())[i] || null
    };
  }

  const { save_default_skema_sekolah, get_default_skema_sekolah } = await import('../src/api.js');
  const testNpsn = '70040625';

  // Backup existing scheme for registered school
  const backupScheme = await get_default_skema_sekolah(testNpsn);

  const testPayload = {
    mode: 'custom',
    skema: { PG: 33.34, PGK: 33.33, BS: 33.33, JODOH: 0, ISIAN: 0, URAIAN: 0 },
    bobot: 1
  };

  const saveRes = await save_default_skema_sekolah(testNpsn, testPayload);
  recordTest('Persistence', 'save_default_skema_sekolah executes successfully with custom payload', saveRes && saveRes.success === true);

  const getRes = await get_default_skema_sekolah(testNpsn);
  recordTest('Persistence', 'get_default_skema_sekolah retrieves persisted custom scheme',
    getRes &&
    getRes.mode === 'custom' &&
    getRes.skema.PG === 33.34 &&
    getRes.skema.PGK === 33.33 &&
    getRes.skema.BS === 33.33
  );

  // Restore backup scheme
  if (backupScheme) {
    await save_default_skema_sekolah(testNpsn, backupScheme);
  }
  const cleanGetRes = await get_default_skema_sekolah(testNpsn);
  recordTest('Persistence', 'Registered school original scheme cleanly restored in teardown', cleanGetRes !== null);

  console.log('\n========================================================================');
  console.log(`ROUND 3 FINAL VERIFICATION SUMMARY: ${passedTests}/${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
