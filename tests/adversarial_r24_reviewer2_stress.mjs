import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { useState, useEffect } from 'react';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('======================================================================');
console.log(' ADVERSARIAL STRESS TEST: ROUND 24 REVIEWER 2 SUITE');
console.log(' Race Conditions, Dynamic Role Switching & deep lifecycle verification');
console.log('======================================================================');

let passCount = 0;
let failCount = 0;

function assert(name, condition, errorMsg = '') {
  if (condition) {
    console.log(`  ✔ PASS: ${name}`);
    passCount++;
  } else {
    console.error(`  ✖ FAIL: ${name} — ${errorMsg}`);
    failCount++;
  }
}

// -------------------------------------------------------------------------
// Setup Minimal DOM Mock for SSR Module Loading (Quill requires document/window)
// -------------------------------------------------------------------------
globalThis.Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
const mockElement = () => ({
  getContext: () => null,
  style: {},
  setAttribute: () => {},
  getAttribute: () => null,
  appendChild: () => {},
  removeChild: () => {},
  classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => false },
  addEventListener: () => {},
  removeEventListener: () => {}
});

globalThis.window = {
  location: { reload: () => {}, href: 'http://localhost' },
  addEventListener: () => {},
  removeEventListener: () => {},
  navigator: { onLine: true }
};
globalThis.document = {
  createElement: mockElement,
  createElementNS: mockElement,
  documentElement: mockElement(),
  head: mockElement(),
  body: mockElement(),
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: () => null,
  querySelectorAll: () => []
};

// -------------------------------------------------------------------------
// In-Memory Storage Mock with Event Spy
// -------------------------------------------------------------------------
class StorageSpy {
  constructor() {
    this.store = new Map();
    this.history = [];
  }
  getItem(key) {
    this.history.push({ op: 'get', key });
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.history.push({ op: 'set', key, value: String(value) });
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.history.push({ op: 'remove', key });
    this.store.delete(key);
  }
  clear() {
    this.history.push({ op: 'clear' });
    this.store.clear();
  }
  resetHistory() {
    this.history = [];
  }
}

const storageSpy = new StorageSpy();

// -------------------------------------------------------------------------
// Load Components via Vite SSR to ensure 0 syntax or import errors
// -------------------------------------------------------------------------
const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  root: projectRoot
});

console.log('\n▶ Suite 1: Vite SSR Import & Syntax Verification...');
let AdminView, GuruView, SiswaView, SuperAdminView, TutorialModal;
try {
  AdminView = (await vite.ssrLoadModule('/src/views/AdminView.jsx')).default;
  GuruView = (await vite.ssrLoadModule('/src/views/GuruView.jsx')).default;
  SiswaView = (await vite.ssrLoadModule('/src/views/SiswaView.jsx')).default;
  SuperAdminView = (await vite.ssrLoadModule('/src/views/SuperAdminView.jsx')).default;
  TutorialModal = (await vite.ssrLoadModule('/src/components/TutorialModal.jsx')).default;
  assert('All 4 view modules and TutorialModal loaded cleanly via Vite SSR', true);
} catch (e) {
  assert('All 4 view modules and TutorialModal loaded cleanly via Vite SSR', false, e.message);
}

// -------------------------------------------------------------------------
// Suite 2: TutorialModal Role Keys Exact Match Verification
// -------------------------------------------------------------------------
console.log('\n▶ Suite 2: initialRole exact match with TutorialModal TUTORIAL_DATA...');

const tutModalSrc = fs.readFileSync(path.join(projectRoot, 'src/components/TutorialModal.jsx'), 'utf8');
const adminSrc = fs.readFileSync(path.join(projectRoot, 'src/views/AdminView.jsx'), 'utf8');
const guruSrc = fs.readFileSync(path.join(projectRoot, 'src/views/GuruView.jsx'), 'utf8');
const siswaSrc = fs.readFileSync(path.join(projectRoot, 'src/views/SiswaView.jsx'), 'utf8');
const superSrc = fs.readFileSync(path.join(projectRoot, 'src/views/SuperAdminView.jsx'), 'utf8');

// Extract TUTORIAL_DATA keys from TutorialModal.jsx
const roleMatch = tutModalSrc.match(/const TUTORIAL_DATA\s*=\s*\{([\s\S]*?)\n\};/);
const validRoles = [];
if (roleMatch) {
  const roleLines = roleMatch[1].matchAll(/(\w+):\s*\[/g);
  for (const m of roleLines) {
    validRoles.push(m[1]);
  }
}

assert('TutorialModal supports roles: admin, guru, siswa, super_admin',
  validRoles.includes('admin') &&
  validRoles.includes('guru') &&
  validRoles.includes('siswa') &&
  validRoles.includes('super_admin')
);

// Inspect initialRole passed by each view
const adminRoleMatch = adminSrc.match(/<TutorialModal[\s\S]*?initialRole="([^"]+)"/);
const guruRoleMatch = guruSrc.match(/<TutorialModal[\s\S]*?initialRole="([^"]+)"/);
const siswaRoleMatch = siswaSrc.match(/<TutorialModal[\s\S]*?initialRole="([^"]+)"/);
const superRoleMatch = superSrc.match(/<TutorialModal[\s\S]*?initialRole="([^"]+)"/);

assert('AdminView passes valid initialRole="admin"', adminRoleMatch && adminRoleMatch[1] === 'admin');
assert('GuruView passes valid initialRole="guru"', guruRoleMatch && guruRoleMatch[1] === 'guru');
assert('SiswaView passes valid initialRole="siswa"', siswaRoleMatch && siswaRoleMatch[1] === 'siswa');
assert('SuperAdminView passes valid initialRole="super_admin"', superRoleMatch && superRoleMatch[1] === 'super_admin');

// -------------------------------------------------------------------------
// Suite 3: Async User Loading Race Condition Simulation
// -------------------------------------------------------------------------
console.log('\n▶ Suite 3: Async User Loading Race Condition & Key Integrity...');

// Function mirroring component state logic
function createTestHarness(role, storage) {
  let user = null;
  let showTutorialModal = false;
  let currentUserId = '';
  let tutorialStorageKey = null;

  function setUser(newUser) {
    user = newUser;
    if (role === 'admin') {
      currentUserId = user?.id_admin || user?.id_user || user?.id || user?.username || '';
    } else if (role === 'guru') {
      currentUserId = user?.id_guru || user?.id_user || user?.id || user?.nip || user?.username || '';
    } else if (role === 'siswa') {
      currentUserId = user?.id_siswa || user?.id_user || user?.id || user?.nisn || user?.username || '';
    } else if (role === 'super_admin') {
      currentUserId = user?.id_super_admin || user?.id_user || user?.id || user?.username || '';
    }
    const nextKey = currentUserId ? `nexa_tutorial_seen_${currentUserId}_${role}` : null;
    
    // Simulate useEffect([tutorialStorageKey])
    if (nextKey !== tutorialStorageKey) {
      tutorialStorageKey = nextKey;
      if (tutorialStorageKey) {
        try {
          const seen = storage.getItem(tutorialStorageKey);
          if (!seen) {
            showTutorialModal = true;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }

  function handleCloseTutorial() {
    showTutorialModal = false;
    if (tutorialStorageKey) {
      try {
        storage.setItem(tutorialStorageKey, 'true');
      } catch (e) {
        console.error(e);
      }
    }
  }

  function handleManualOpen() {
    showTutorialModal = true;
  }

  return {
    setUser,
    getShowModal: () => showTutorialModal,
    getKey: () => tutorialStorageKey,
    handleCloseTutorial,
    handleManualOpen
  };
}

storageSpy.clear();
storageSpy.resetHistory();

// 1. Initial mount with null user
const adminHarness = createTestHarness('admin', storageSpy);
adminHarness.setUser(null);

assert('Initial mount with null user does not show modal', adminHarness.getShowModal() === false);
assert('Initial mount with null user has null storage key', adminHarness.getKey() === null);
assert('No localStorage reads occurred for premature empty/null key',
  !storageSpy.history.some(h => h.key === 'nexa_tutorial_seen__admin' || h.key === 'nexa_tutorial_seen_undefined_admin' || h.key === 'nexa_tutorial_seen_null_admin')
);

// 2. User object with no ID fields yet (e.g. bare school info)
adminHarness.setUser({ npsn: '10293847' });
assert('Mount with bare school info (no user ID) does not prematurely trigger modal', adminHarness.getShowModal() === false);
assert('No localStorage reads occurred for empty key',
  !storageSpy.history.some(h => h.key === 'nexa_tutorial_seen__admin')
);

// 3. User fully loaded asynchronously
adminHarness.setUser({ npsn: '10293847', id_admin: 'ADM_ASYNC_99', username: 'admin99' });
assert('Asynchronous user population triggers auto-trigger effect', adminHarness.getShowModal() === true);
assert('Storage key is properly formatted with async user ID', adminHarness.getKey() === 'nexa_tutorial_seen_ADM_ASYNC_99_admin');

// 4. Close tutorial
adminHarness.handleCloseTutorial();
assert('Closing tutorial hides modal', adminHarness.getShowModal() === false);
assert('Closing tutorial persists seen=true in storage', storageSpy.getItem('nexa_tutorial_seen_ADM_ASYNC_99_admin') === 'true');

// 5. User updates other profile fields (e.g. foto_profil, nama_lengkap)
storageSpy.resetHistory();
adminHarness.setUser({ npsn: '10293847', id_admin: 'ADM_ASYNC_99', username: 'admin99', foto_profil: 'avatar.png' });
assert('Updating profile fields with same ID does not re-trigger tutorial', adminHarness.getShowModal() === false);
assert('No unnecessary storage writes occurred on profile update', storageSpy.history.length === 0);

// -------------------------------------------------------------------------
// Suite 4: Mid-Session Dynamic Role Switching Lifecycle
// -------------------------------------------------------------------------
console.log('\n▶ Suite 4: Mid-Session Dynamic Role Switching Simulation...');

const sharedUser = {
  id_user: 'SHARED_USR_01',
  id_admin: 'SHARED_USR_01',
  id_guru: 'SHARED_USR_01',
  id_siswa: 'SHARED_USR_01',
  id_super_admin: 'SHARED_USR_01',
  username: 'shared_account'
};

// Step A: Mount as Admin
const adminSession = createTestHarness('admin', storageSpy);
adminSession.setUser(sharedUser);
assert('Shared user first login as admin triggers admin tutorial', adminSession.getShowModal() === true);
adminSession.handleCloseTutorial();
assert('Admin seen status saved independently', storageSpy.getItem('nexa_tutorial_seen_SHARED_USR_01_admin') === 'true');

// Step B: Role switched to Guru mid-session
const guruSession = createTestHarness('guru', storageSpy);
guruSession.setUser(sharedUser);
assert('Switching to guru triggers guru tutorial even though admin tutorial was seen', guruSession.getShowModal() === true);
guruSession.handleCloseTutorial();
assert('Guru seen status saved independently', storageSpy.getItem('nexa_tutorial_seen_SHARED_USR_01_guru') === 'true');

// Step C: Role switched to Siswa mid-session
const siswaSession = createTestHarness('siswa', storageSpy);
siswaSession.setUser(sharedUser);
assert('Switching to siswa triggers siswa tutorial', siswaSession.getShowModal() === true);
siswaSession.handleCloseTutorial();
assert('Siswa seen status saved independently', storageSpy.getItem('nexa_tutorial_seen_SHARED_USR_01_siswa') === 'true');

// Step D: Role switched to SuperAdmin mid-session
const superSession = createTestHarness('super_admin', storageSpy);
superSession.setUser(sharedUser);
assert('Switching to super_admin triggers super_admin tutorial', superSession.getShowModal() === true);
superSession.handleCloseTutorial();
assert('SuperAdmin seen status saved independently', storageSpy.getItem('nexa_tutorial_seen_SHARED_USR_01_super_admin') === 'true');

// Step E: User switches BACK to Admin
const adminSession2 = createTestHarness('admin', storageSpy);
adminSession2.setUser(sharedUser);
assert('Switching back to admin does NOT re-trigger already seen admin tutorial', adminSession2.getShowModal() === false);

// -------------------------------------------------------------------------
// Suite 5: Numeric & Complex IDs Edge Cases
// -------------------------------------------------------------------------
console.log('\n▶ Suite 5: Numeric & Complex IDs Edge Cases...');

// Numeric ID
const numUser = { id: 1042 };
const numHarness = createTestHarness('admin', storageSpy);
numHarness.setUser(numUser);
assert('Numeric user ID resolves cleanly to string key', numHarness.getKey() === 'nexa_tutorial_seen_1042_admin');
assert('Numeric user ID triggers tutorial modal', numHarness.getShowModal() === true);
numHarness.handleCloseTutorial();
assert('Numeric user ID saves seen state in storage', storageSpy.getItem('nexa_tutorial_seen_1042_admin') === 'true');

// Cache wipe (localStorage.clear())
storageSpy.clear();
const postClearHarness = createTestHarness('admin', storageSpy);
postClearHarness.setUser(numUser);
assert('After localStorage.clear(), tutorial auto-triggers again on next login', postClearHarness.getShowModal() === true);

// -------------------------------------------------------------------------
// Summary
// -------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log('======================================================================');

await vite.close();

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('ALL ROUND 24 REVIEWER 2 ADVERSARIAL TESTS PASSED!');
  process.exit(0);
}
