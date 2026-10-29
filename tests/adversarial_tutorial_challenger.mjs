import { createServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Mock localStorage and window
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] !== undefined ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
  get length() {
    return Object.keys(this.store).length;
  }
  key(i) {
    return Object.keys(this.store)[i] || null;
  }
}

global.localStorage = new LocalStorageMock();
global.window = {
  dispatchEvent: (e) => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  innerWidth: 1024,
  innerHeight: 768
};

const vite = await createServer({
  root: rootDir,
  server: { middlewareMode: true },
  appType: 'custom'
});

const mod = await vite.ssrLoadModule('/src/components/TutorialModal.jsx');
const {
  getTutorialProgress,
  saveTutorialProgress,
  resetTutorialProgress,
  getActiveUnlockedTopic,
  sanitizeRole,
  TUTORIAL_DATA,
  ROLE_THEMES
} = mod;

console.log('================================================================');
console.log('  ADVERSARIAL CHALLENGER: TUTORIAL ENGINE & PROGRESSION TESTS   ');
console.log('================================================================');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  } else {
    console.log(`  ✓ ${message}`);
    passed++;
  }
}

// -----------------------------------------------------------------------------
// Test Suite 1: Sanitization & Edge-Case Roles
// -----------------------------------------------------------------------------
console.log('\nSuite 1: Role Sanitization & Boundaries');
assert(sanitizeRole(null) === 'admin', 'sanitizeRole(null) safely falls back to admin');
assert(sanitizeRole(undefined) === 'admin', 'sanitizeRole(undefined) safely falls back to admin');
assert(sanitizeRole('') === 'admin', 'sanitizeRole("") safely falls back to admin');
assert(sanitizeRole('superadmin') === 'super_admin', 'sanitizeRole("superadmin") aliases to super_admin');
assert(sanitizeRole('SUPERADMIN') === 'super_admin', 'sanitizeRole("SUPERADMIN") case-insensitive');
assert(sanitizeRole('exam') === 'exam_room', 'sanitizeRole("exam") aliases to exam_room');
assert(sanitizeRole('examroom') === 'exam_room', 'sanitizeRole("examroom") aliases to exam_room');
assert(sanitizeRole('ujian') === 'exam_room', 'sanitizeRole("ujian") aliases to exam_room');
assert(sanitizeRole('unknown_role_xyz') === 'admin', 'Unknown role safely defaults to admin');

// -----------------------------------------------------------------------------
// Test Suite 2: Progression Lifecycle & Storage Resilience
// -----------------------------------------------------------------------------
console.log('\nSuite 2: Storage Resilience & Progression');
localStorage.clear();

// Initial progress check
let pAdmin = getTutorialProgress('admin');
assert(Array.isArray(pAdmin.completedTopics) && pAdmin.completedTopics.length === 0, 'Initial completedTopics is empty array');
assert(pAdmin.currentTopicIndex === 0, 'Initial currentTopicIndex is 0');
assert(pAdmin.isFinished === false, 'Initial isFinished is false');

// Step 0 active unlocked topic
let unlocked0 = getActiveUnlockedTopic('admin');
assert(unlocked0 && unlocked0.id === 'admin-siswa', 'Initially unlocked topic for admin is step 0 (admin-siswa)');

// Complete step 0
saveTutorialProgress('admin', {
  completedTopics: [0],
  currentTopicIndex: 1,
  isFinished: false
});

let unlocked1 = getActiveUnlockedTopic('admin');
assert(unlocked1 && unlocked1.id === 'admin-jadwal', 'After step 0 complete, step 1 (admin-jadwal) unlocks progressively');

// Corrupted JSON in localStorage
localStorage.setItem('nexa_tutorial_progress_admin', '{bad json');
let pCorrupted = getTutorialProgress('admin');
assert(Array.isArray(pCorrupted.completedTopics) && pCorrupted.completedTopics.length === 0, 'Corrupted JSON in localStorage handled gracefully without throw');

// Legacy number in localStorage
localStorage.setItem('nexa_tutorial_progress_admin', '2');
let pLegacyNum = getTutorialProgress('admin');
assert(pLegacyNum.currentTopicIndex === 2 && pLegacyNum.completedTopics.length === 2, 'Legacy numeric progress value parsed into topics array');

// Finish admin tutorial
saveTutorialProgress('admin', {
  completedTopics: [0, 1, 2, 3, 4],
  currentTopicIndex: 4,
  isFinished: true
});
let unlockedFinished = getActiveUnlockedTopic('admin');
assert(unlockedFinished === null, 'When isFinished is true, getActiveUnlockedTopic returns null (no badges)');

// Reset tutorial progress
localStorage.setItem('nexa_tutorial_shown_admin', 'true');
localStorage.setItem('nexa_tutorial_seen_user1_admin', 'true');
resetTutorialProgress('admin');
let pReset = getTutorialProgress('admin');
assert(pReset.completedTopics.length === 0 && pReset.isFinished === false, 'resetTutorialProgress resets completedTopics');
assert(localStorage.getItem('nexa_tutorial_shown_admin') === null, 'resetTutorialProgress cleans nexa_tutorial_shown_admin');
assert(localStorage.getItem('nexa_tutorial_seen_user1_admin') === null, 'resetTutorialProgress cleans user-specific seen keys');

// -----------------------------------------------------------------------------
// Test Suite 3: ExamRoom & Progressive Disclosure Badges Audit
// -----------------------------------------------------------------------------
console.log('\nSuite 3: ExamRoom & View Badges Implementation Audit');
const examContent = fs.readFileSync(path.join(rootDir, 'src/views/ExamRoom.jsx'), 'utf8');
const siswaContent = fs.readFileSync(path.join(rootDir, 'src/views/SiswaView.jsx'), 'utf8');

const examBadgeCount = (examContent.match(/<TutorialBadge/g) || []).length;
console.log(`  ExamRoom <TutorialBadge> count: ${examBadgeCount}`);
assert(examBadgeCount >= 3, `ExamRoom MUST render <TutorialBadge> on key exam controls (found ${examBadgeCount})`);

const siswaBadgeCount = (siswaContent.match(/<TutorialBadge/g) || []).length;
console.log(`  SiswaView <TutorialBadge> count: ${siswaBadgeCount}`);
assert(siswaBadgeCount >= 4, `SiswaView MUST render <TutorialBadge> on panduan/tabs/actions (found ${siswaBadgeCount})`);

// -----------------------------------------------------------------------------
// Test Suite 4: Keyboard Event Handlers & Focus Trap Inspection
// -----------------------------------------------------------------------------
console.log('\nSuite 4: Keyboard Navigation & Focus Trap Verification');
const modalSource = fs.readFileSync(path.join(rootDir, 'src/components/TutorialModal.jsx'), 'utf8');

assert(modalSource.includes("e.key === 'Escape'") || modalSource.includes('e.key === "Escape"'), 'Handles Escape key to close');
assert(modalSource.includes("e.key === 'ArrowRight'") || modalSource.includes('e.key === "ArrowRight"'), 'Handles ArrowRight key to advance step');
assert(modalSource.includes("e.key === 'ArrowLeft'") || modalSource.includes('e.key === "ArrowLeft"'), 'Handles ArrowLeft key to retreat step');
assert(modalSource.includes("e.key === 'Tab'") || modalSource.includes('e.key === "Tab"'), 'Handles Tab key for accessible focus trap');
assert(modalSource.includes('popoverEl.contains(document.activeElement)'), 'Focus trap ensures external activeElement is captured into modal');

// -----------------------------------------------------------------------------
// Test Suite 5: Advanced Progressive Badges & Drawer Trigger Verification
// -----------------------------------------------------------------------------
console.log('\nSuite 5: Advanced Progressive Badges & Drawer Trigger Verification');
const adminContent = fs.readFileSync(path.join(rootDir, 'src/views/AdminView.jsx'), 'utf8');
const guruContent = fs.readFileSync(path.join(rootDir, 'src/views/GuruView.jsx'), 'utf8');

assert(adminContent.includes('targetId="admin-dokumen"'), 'AdminView renders TutorialBadge on admin-dokumen action button');
assert(adminContent.includes('targetId="admin-kontrol"'), 'AdminView renders TutorialBadge on admin-kontrol bulk panel');
assert(adminContent.includes('dotOnly={true}'), 'AdminView renders dotOnly TutorialBadge for collapsed sidebar state');
assert(guruContent.includes('dotOnly={true}'), 'GuruView renders dotOnly TutorialBadge for collapsed sidebar state');
assert(adminContent.includes('admin-pengaturan') && adminContent.includes('isDrawerTrigger'), 'AdminView mobile bottom bar badges drawer trigger for uncompleted drawer topics');
assert(guruContent.includes('guru-hasil') && guruContent.includes('isTrigger'), 'GuruView mobile bottom bar badges drawer trigger for uncompleted drawer topics');
assert(siswaContent.includes('targetId="siswa-token"'), 'SiswaView renders TutorialBadge inside token verification modal');
assert(examContent.includes('data-tutorial="exam-selesai-next"'), 'ExamRoom provides exam-selesai-next target for mid-exam walk-through');
assert(modalSource.includes('dotOnly'), 'TutorialModal exports TutorialBadge with dotOnly prop support');
assert(modalSource.includes('Array.isArray(targetId)'), 'TutorialBadge supports array of targetIds');

await vite.close();

console.log('\n================================================================');
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}

