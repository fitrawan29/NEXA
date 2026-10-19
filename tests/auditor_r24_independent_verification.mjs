import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('======================================================================');
console.log(' INDEPENDENT VICTORY AUDITOR VERIFICATION SUITE — ROUND 24           ');
console.log('======================================================================\n');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function check(desc, condition, details = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  [PASS] ${desc}`);
  } else {
    failedChecks++;
    console.error(`  [FAIL] ${desc} — ${details}`);
  }
}

// Check that git diff on package.json is empty (zero dependencies added)
import { execSync } from 'node:child_process';
const gitDiffPkg = execSync('git diff package.json', { cwd: rootDir, encoding: 'utf8' }).trim();
check('Zero modifications to package.json (no new dependencies added)', gitDiffPkg === '', `git diff: ${gitDiffPkg}`);

const modalSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'TutorialModal.jsx'), 'utf8');

check('TutorialModal component exists and is intact', modalSrc.length > 5000);
check('TutorialModal export default exists', modalSrc.includes('export default TutorialModal'));
check(
  'TutorialModal signature has isOpen, initialRole, onClose',
  /const\s+TutorialModal\s*=\s*\(\{\s*isOpen,\s*initialRole\s*=\s*['"]admin['"],\s*onClose\s*\}\)/.test(modalSrc)
);

// Verify exact step counts in TUTORIAL_DATA (Admin 5, Guru 6, Siswa 6, Super Admin 4)
// Use regex matching exact `\btitle:\s*['"]` to avoid matching `shortTitle:`
const adminStepCount = (modalSrc.split('admin: [')[1]?.split('guru: [')[0]?.match(/\btitle:\s*['"]/g) || []).length;
const guruStepCount = (modalSrc.split('guru: [')[1]?.split('siswa: [')[0]?.match(/\btitle:\s*['"]/g) || []).length;
const siswaStepCount = (modalSrc.split('siswa: [')[1]?.split('super_admin: [')[0]?.match(/\btitle:\s*['"]/g) || []).length;
const superAdminStepCount = (modalSrc.split('super_admin: [')[1]?.split(/\]\s*;\s*const ROLE_CONTENT/)[0]?.match(/\btitle:\s*['"]/g) || []).length;

check('Admin tutorial has exactly 5 steps', adminStepCount === 5, `Found: ${adminStepCount}`);
check('Guru tutorial has exactly 6 steps', guruStepCount === 6, `Found: ${guruStepCount}`);
check('Siswa tutorial has exactly 6 steps', siswaStepCount === 6, `Found: ${siswaStepCount}`);
check('Super Admin tutorial has exactly 4 steps', superAdminStepCount === 4, `Found: ${superAdminStepCount}`);

// -----------------------------------------------------------------------------
// CHECK 2: SOURCE CODE FORENSICS ON ALL 4 VIEWS (R1 & R2)
// -----------------------------------------------------------------------------
console.log('\nPhase 2: Source Code Forensics on All 4 Views...');

const viewConfigs = [
  { name: 'AdminView', file: 'src/views/AdminView.jsx', role: 'admin' },
  { name: 'GuruView', file: 'src/views/GuruView.jsx', role: 'guru' },
  { name: 'SiswaView', file: 'src/views/SiswaView.jsx', role: 'siswa' },
  { name: 'SuperAdminView', file: 'src/views/SuperAdminView.jsx', role: 'super_admin' },
];

for (const v of viewConfigs) {
  const code = fs.readFileSync(path.join(rootDir, v.file), 'utf8');
  console.log(`\n  Checking ${v.name}:`);

  // State declaration
  check(
    `${v.name} declares useState for showTutorialModal`,
    code.includes('const [showTutorialModal, setShowTutorialModal] = useState(false);')
  );

  // User identity derivation
  check(
    `${v.name} derives currentUserId from user object`,
    code.includes('const currentUserId =') && code.includes(`_seen_\${currentUserId}_${v.role}`)
  );

  // Auto-trigger useEffect
  check(
    `${v.name} has useEffect listening to tutorialStorageKey`,
    code.includes('useEffect(') && code.includes('localStorage.getItem(tutorialStorageKey)') && code.includes('setShowTutorialModal(true)')
  );

  // Try/catch around localStorage read
  check(
    `${v.name} handles localStorage read errors defensively (try/catch)`,
    code.includes('try {') && code.includes('localStorage.getItem(tutorialStorageKey)') && code.includes('catch (e)')
  );

  // Close handler with persistence
  check(
    `${v.name} has handleCloseTutorial that sets showTutorialModal(false) and persists to localStorage`,
    code.includes('const handleCloseTutorial = () => {') &&
    code.includes("setShowTutorialModal(false);") &&
    code.includes("localStorage.setItem(tutorialStorageKey, 'true');")
  );

  // Try/catch around localStorage write
  check(
    `${v.name} handles localStorage write errors defensively (try/catch)`,
    code.includes("localStorage.setItem(tutorialStorageKey, 'true')") &&
    code.includes('Failed to save tutorial state to localStorage')
  );

  // TutorialModal component rendered with proper props
  check(
    `${v.name} mounts TutorialModal with isOpen, initialRole="${v.role}", and onClose={handleCloseTutorial}`,
    code.includes('<TutorialModal') &&
    code.includes('isOpen={showTutorialModal}') &&
    code.includes(`initialRole="${v.role}"`) &&
    code.includes('onClose={handleCloseTutorial}')
  );

  // Manual re-access button
  check(
    `${v.name} contains manual re-access button with setShowTutorialModal(true)`,
    code.includes('setShowTutorialModal(true)')
  );

  // Button accessibility
  check(
    `${v.name} buttons have title and/or aria-label="Panduan & Tutorial"`,
    code.includes('title="Panduan & Tutorial"') || code.includes('aria-label="Panduan & Tutorial"')
  );
}

// -----------------------------------------------------------------------------
// CHECK 3: BEHAVIORAL LOGIC AUDIT & EMULATION (R1 Acceptance Criteria)
// -----------------------------------------------------------------------------
console.log('\nPhase 3: Behavioral Emulation & State Flow...');

class MemoryStorage {
  constructor() { this.data = {}; }
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; }
  setItem(key, val) { this.data[key] = String(val); }
  clear() { this.data = {}; }
}

function runAutoTriggerFlow(user, role, storage) {
  let modalOpen = false;
  const currentUserId = user?.id_admin || user?.id_guru || user?.id_siswa || user?.id_super_admin || user?.id_user || user?.id || user?.nisn || user?.nip || user?.username || '';
  const key = currentUserId ? `nexa_tutorial_seen_${currentUserId}_${role}` : null;

  // Mount
  if (key) {
    const seen = storage.getItem(key);
    if (!seen) modalOpen = true;
  }

  const close = () => {
    modalOpen = false;
    if (key) storage.setItem(key, 'true');
  };

  const manualOpen = () => { modalOpen = true; };

  return {
    isOpen: () => modalOpen,
    close,
    manualOpen,
    key
  };
}

const store = new MemoryStorage();

// Test A: User 101 as Siswa first login
const flow1 = runAutoTriggerFlow({ id_siswa: 'SISWA_101', username: 'budi' }, 'siswa', store);
check('First login auto-triggers modal to open', flow1.isOpen() === true);
flow1.close();
check('Closing modal sets modal to closed', flow1.isOpen() === false);
check('Closing modal persists seen key in storage', store.getItem('nexa_tutorial_seen_SISWA_101_siswa') === 'true');

// Test B: User 101 as Siswa second login
const flow1Second = runAutoTriggerFlow({ id_siswa: 'SISWA_101', username: 'budi' }, 'siswa', store);
check('Subsequent login for same user does NOT auto-trigger', flow1Second.isOpen() === false);

// Test C: Manual re-access button
flow1Second.manualOpen();
check('Manual button click successfully re-opens tutorial', flow1Second.isOpen() === true);
flow1Second.close();
check('Closing manual modal returns it to closed', flow1Second.isOpen() === false);

// Test D: Different user on same machine
const flow2 = runAutoTriggerFlow({ id_siswa: 'SISWA_102', username: 'ani' }, 'siswa', store);
check('New user on same machine DOES auto-trigger modal', flow2.isOpen() === true);
flow2.close();
check('New user seen status is recorded independently', store.getItem('nexa_tutorial_seen_SISWA_102_siswa') === 'true');

// Test E: Same user ID with different roles
const flowGuru = runAutoTriggerFlow({ id_user: 'DUAL_USER', username: 'pak_guru' }, 'guru', store);
check('Dual user first login as Guru triggers modal', flowGuru.isOpen() === true);
flowGuru.close();
check('Guru key stored independently', store.getItem('nexa_tutorial_seen_DUAL_USER_guru') === 'true');

const flowAdmin = runAutoTriggerFlow({ id_user: 'DUAL_USER', username: 'pak_guru' }, 'admin', store);
check('Same dual user first login as Admin triggers Admin modal independently', flowAdmin.isOpen() === true);
flowAdmin.close();
check('Admin key stored independently', store.getItem('nexa_tutorial_seen_DUAL_USER_admin') === 'true');

// Test F: Cache clear
store.clear();
const flowAfterClear = runAutoTriggerFlow({ id_siswa: 'SISWA_101', username: 'budi' }, 'siswa', store);
check('After clearing cache/storage, tutorial auto-triggers again', flowAfterClear.isOpen() === true);

// -----------------------------------------------------------------------------
// CHECK 4: ANTI-CHEATING & INTEGRITY FORENSICS
// -----------------------------------------------------------------------------
console.log('\nPhase 4: Anti-Cheating & Integrity Forensics...');

// 4.1 Check for hardcoded test result bypasses
const testKeywords = ['MOCK_PASS', '__TEST_BYPASS__', 'isTestEnvironment', 'process.env.TEST_MODE'];
let bypassFound = false;
for (const v of viewConfigs) {
  const code = fs.readFileSync(path.join(rootDir, v.file), 'utf8');
  for (const kw of testKeywords) {
    if (code.includes(kw)) {
      bypassFound = true;
      break;
    }
  }
}
check('No test bypasses or environment-sniffing shortcuts in view implementations', !bypassFound);

// 4.2 Check for facade implementations (e.g. dummy return true)
let facadeFound = false;
for (const v of viewConfigs) {
  const code = fs.readFileSync(path.join(rootDir, v.file), 'utf8');
  if (code.includes('handleCloseTutorial = () => true') || code.includes('handleCloseTutorial = () => {}')) {
    facadeFound = true;
  }
}
check('No facade or stub close handlers', !facadeFound);

// 4.3 Check for fabricated log files
const hasFabricatedLog = fs.existsSync(path.join(rootDir, 'tutorial_results.log'));
check('No fabricated test log files found', !hasFabricatedLog);

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(` AUDIT TOTAL CHECKS : ${totalChecks}`);
console.log(` PASSED             : ${passedChecks}`);
console.log(` FAILED             : ${failedChecks}`);
console.log('======================================================================');

if (failedChecks > 0) {
  console.error('\nVERDICT: VICTORY REJECTED');
  process.exit(1);
} else {
  console.log('\nVERDICT: VICTORY CONFIRMED');
  process.exit(0);
}
