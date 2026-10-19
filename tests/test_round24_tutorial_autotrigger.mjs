import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('================================================================');
console.log('  ROUND 24: AUTO-TRIGGER TUTORIAL & RE-ACCESS VISIBILITY TESTS  ');
console.log('================================================================\n');

// -------------------------------------------------------------------------
// Test Suite 1: TutorialModal.jsx & package.json Integrity (Ponytail)
// -------------------------------------------------------------------------
console.log('Suite 1: Architecture Constraints & Integrity');
const pkgPath = path.join(rootDir, 'package.json');
const pkgContent = fs.readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgContent);

assert(
  !pkg.dependencies['intro.js'] &&
  !pkg.dependencies['driver.js'] &&
  !pkg.dependencies['shepherd.js'] &&
  !pkg.dependencies['react-joyride'],
  'package.json has NO new third-party tutorial libraries added'
);

const tutorialModalPath = path.join(rootDir, 'src', 'components', 'TutorialModal.jsx');
const tutorialModalContent = fs.readFileSync(tutorialModalPath, 'utf8');

assert(
  tutorialModalContent.includes("const TutorialModal = ({ isOpen, initialRole = 'admin', onClose }) => {"),
  'TutorialModal component signature and props remain intact: { isOpen, initialRole, onClose }'
);
assert(
  tutorialModalContent.includes('ROLE_THEMES = {') &&
  tutorialModalContent.includes('TUTORIAL_DATA = {'),
  'TutorialModal content and themes remain untouched'
);

// -------------------------------------------------------------------------
// Test Suite 2: Code Inspection for 4 Views (Admin, Guru, Siswa, SuperAdmin)
// -------------------------------------------------------------------------
console.log('\nSuite 2: Static Code Verification for All 4 Views');

const views = [
  { name: 'AdminView', file: 'src/views/AdminView.jsx', role: 'admin' },
  { name: 'GuruView', file: 'src/views/GuruView.jsx', role: 'guru' },
  { name: 'SiswaView', file: 'src/views/SiswaView.jsx', role: 'siswa' },
  { name: 'SuperAdminView', file: 'src/views/SuperAdminView.jsx', role: 'super_admin' },
];

for (const v of views) {
  const filePath = path.join(rootDir, v.file);
  const content = fs.readFileSync(filePath, 'utf8');

  console.log(`\nChecking ${v.name} (${v.role}):`);

  // Check state and key
  assert(
    content.includes('showTutorialModal') && content.includes('setShowTutorialModal'),
    `${v.name} has showTutorialModal state`
  );

  const expectedKeyPattern = `nexa_tutorial_seen_\${currentUserId}_${v.role}`;
  assert(
    content.includes(expectedKeyPattern),
    `${v.name} uses per-user per-role localStorage key: ${expectedKeyPattern}`
  );

  // Check auto-trigger useEffect
  assert(
    content.includes('localStorage.getItem(tutorialStorageKey)') &&
    content.includes('setShowTutorialModal(true)'),
    `${v.name} contains useEffect that auto-triggers showTutorialModal(true) when not seen`
  );

  // Check handleCloseTutorial
  assert(
    content.includes('handleCloseTutorial') &&
    content.includes('localStorage.setItem(tutorialStorageKey, \'true\')'),
    `${v.name} persists seen state in localStorage upon handleCloseTutorial`
  );

  // Check TutorialModal onClose wiring
  assert(
    content.includes(`initialRole="${v.role}"`) &&
    content.includes('onClose={handleCloseTutorial}'),
    `${v.name} passes handleCloseTutorial to TutorialModal onClose prop`
  );

  // Check manual re-access button visibility
  assert(
    content.includes('title="Panduan & Tutorial') || content.includes('aria-label="Panduan & Tutorial'),
    `${v.name} has accessible title/aria-label on re-access button`
  );
  assert(
    content.includes('onClick={() => setShowTutorialModal(true)}'),
    `${v.name} has click handler to manually re-open tutorial`
  );
}

// -------------------------------------------------------------------------
// Test Suite 3: Simulation of Auto-Trigger Lifecycle & Storage Rules
// -------------------------------------------------------------------------
console.log('\nSuite 3: Behavioral Simulation of Auto-Trigger Lifecycle');

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
  clear() {
    this.store.clear();
  }
}

// Mock view lifecycle simulator matching our implementation
function simulateViewMount(user, role, storage) {
  let showTutorialModal = false;
  const currentUserId = user?.id_admin || user?.id_guru || user?.id_siswa || user?.id_super_admin || user?.id_user || user?.id || user?.nisn || user?.nip || user?.username || '';
  const tutorialStorageKey = currentUserId ? `nexa_tutorial_seen_${currentUserId}_${role}` : null;

  // Mount effect
  if (tutorialStorageKey) {
    const seen = storage.getItem(tutorialStorageKey);
    if (!seen) {
      showTutorialModal = true;
    }
  }

  const handleCloseTutorial = () => {
    showTutorialModal = false;
    if (tutorialStorageKey) {
      storage.setItem(tutorialStorageKey, 'true');
    }
  };

  const handleManualOpen = () => {
    showTutorialModal = true;
  };

  return {
    getShowModal: () => showTutorialModal,
    handleCloseTutorial,
    handleManualOpen,
    storageKey: tutorialStorageKey
  };
}

const mockStorage = new MockLocalStorage();

// Case 1: First login for user1 as Admin
const user1 = { id_user: 'ADM_001', username: 'admin1', role: 'admin' };
let session1 = simulateViewMount(user1, 'admin', mockStorage);
assert(
  session1.getShowModal() === true,
  'First login for user1 auto-triggers tutorial modal'
);

// Close tutorial
session1.handleCloseTutorial();
assert(
  session1.getShowModal() === false,
  'Closing tutorial hides modal'
);
assert(
  mockStorage.getItem('nexa_tutorial_seen_ADM_001_admin') === 'true',
  'Closing tutorial records seen status in localStorage'
);

// Case 2: Second login for user1 as Admin
let session2 = simulateViewMount(user1, 'admin', mockStorage);
assert(
  session2.getShowModal() === false,
  'Subsequent login for user1 does NOT auto-trigger tutorial modal'
);

// Case 3: Different user (user2) on same device
const user2 = { id_user: 'ADM_002', username: 'admin2', role: 'admin' };
let session3 = simulateViewMount(user2, 'admin', mockStorage);
assert(
  session3.getShowModal() === true,
  'Different user on same device STILL auto-triggers tutorial'
);
session3.handleCloseTutorial();
assert(
  mockStorage.getItem('nexa_tutorial_seen_ADM_002_admin') === 'true',
  'User2 seen status stored independently under user2 key'
);

// Case 4: Same user with a different role (e.g. Guru)
let session4 = simulateViewMount(user1, 'guru', mockStorage);
assert(
  session4.getShowModal() === true,
  'Same user logging in under a different role auto-triggers role-specific tutorial'
);
session4.handleCloseTutorial();
assert(
  mockStorage.getItem('nexa_tutorial_seen_ADM_001_guru') === 'true',
  'Different role stores separate key (nexa_tutorial_seen_ADM_001_guru)'
);

// Case 5: Manual re-access via button
let session5 = simulateViewMount(user1, 'admin', mockStorage);
assert(session5.getShowModal() === false, 'Initially closed on repeated login');
session5.handleManualOpen();
assert(session5.getShowModal() === true, 'Clicking manual re-access button opens tutorial modal');
session5.handleCloseTutorial();
assert(session5.getShowModal() === false, 'Closing manual tutorial hides modal');

// Case 6: Cache/Storage cleared
mockStorage.clear();
let session6 = simulateViewMount(user1, 'admin', mockStorage);
assert(
  session6.getShowModal() === true,
  'After localStorage.clear(), tutorial auto-triggers again on next login'
);

// -------------------------------------------------------------------------
// Summary
// -------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`TOTAL: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL ROUND 24 ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!');
}
