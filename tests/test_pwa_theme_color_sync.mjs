/**
 * Test Suite: PWA & Mobile Status Bar Color Alignment and Dynamic Synchronization
 *
 * Verifies:
 * - R1: PWA & Mobile Status Bar Color Alignment (Static index.html and manifest.json)
 * - R2: Dynamic Status Bar Synchronization (Dark Mode, Light Mode, Roles, ExamRoom, iOS Safari contrast)
 * - R3: Minimalist & Native Platform Implementation (themeColor utility & App integration)
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { getStatusBarColor, syncThemeColor, THEME_COLORS } from '../src/utils/themeColor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function runTest(suite, name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✔ [PASS] [${suite}] ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ suite, name, error: err.message });
    console.error(`  ✖ [FAIL] [${suite}] ${name}: ${err.message}`);
  }
}

console.log('========================================================================');
console.log('   NEXA CBT: PWA STATUS BAR COLOR & DYNAMIC SYNC TEST SUITE            ');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// Suite 1: Static Configuration & Elimination of Legacy Color (#003fb1)
// -----------------------------------------------------------------------------
console.log('▶ [Suite 1] Static Configuration & Legacy Color Elimination:');

runTest('Static Config', 'index.html does not contain legacy color #003fb1', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf-8');
  assert.ok(!html.includes('#003fb1'), 'index.html must not contain #003fb1');
});

runTest('Static Config', 'index.html configures default theme-color matching Emerald identity (#10b981)', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf-8');
  assert.match(
    html,
    /<meta\s+name=["']theme-color["']\s+content=["']#10b981["']/,
    'index.html must configure meta theme-color with #10b981'
  );
});

runTest('Static Config', 'public/manifest.json does not contain legacy color #003fb1', () => {
  const rawManifest = fs.readFileSync(path.join(projectRoot, 'public/manifest.json'), 'utf-8');
  assert.ok(!rawManifest.includes('#003fb1'), 'manifest.json must not contain #003fb1');
});

runTest('Static Config', 'public/manifest.json configures theme_color to #10b981', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'public/manifest.json'), 'utf-8'));
  assert.equal(manifest.theme_color, '#10b981', 'manifest.json theme_color must be #10b981');
});

// -----------------------------------------------------------------------------
// Suite 2: Dynamic Status Bar Color Computation (getStatusBarColor)
// -----------------------------------------------------------------------------
console.log('\n▶ [Suite 2] Dynamic Status Bar Color Computation (getStatusBarColor):');

runTest('Color Computation', 'THEME_COLORS constants match design system tokens', () => {
  assert.equal(THEME_COLORS.dark, '#0f172a', 'Dark color must be #0f172a (slate-900)');
  assert.equal(THEME_COLORS.emerald, '#10b981', 'Emerald color must be #10b981 (emerald-500)');
  assert.equal(THEME_COLORS.white, '#ffffff', 'White color must be #ffffff');
  assert.equal(THEME_COLORS.superAdmin, '#7c3aed', 'SuperAdmin color must be #7c3aed');
  assert.equal(THEME_COLORS.guru, '#f59e0b', 'Guru color must be #f59e0b (amber-500)');
  assert.equal(THEME_COLORS.admin, '#3b82f6', 'Admin color must be #3b82f6 (blue-500)');
});

runTest('Color Computation', 'Dark Mode always returns #0f172a regardless of role', () => {
  const roles = ['siswa', 'guru', 'admin', 'super_admin', null, undefined];
  for (const role of roles) {
    const color = getStatusBarColor({ isDarkMode: true, isExamActive: false, role });
    assert.equal(color, '#0f172a', `Role ${role} in dark mode must return #0f172a`);
  }
});

runTest('Color Computation', 'Dark Mode returns #0f172a even during active exam (ExamRoom)', () => {
  const color = getStatusBarColor({ isDarkMode: true, isExamActive: true, role: 'siswa' });
  assert.equal(color, '#0f172a', 'Active exam in dark mode must return #0f172a');
});

runTest('Color Computation', 'Light Mode Siswa dashboard returns #10b981 (matches emerald mobile header)', () => {
  const color = getStatusBarColor({ isDarkMode: false, isExamActive: false, role: 'siswa' });
  assert.equal(color, '#10b981', 'Siswa in light mode must return #10b981');
});

runTest('Color Computation', 'Light Mode Login / unauthenticated view returns #10b981 (matches emerald header)', () => {
  const colorNoRole = getStatusBarColor({ isDarkMode: false, isExamActive: false });
  assert.equal(colorNoRole, '#10b981', 'Default / login screen must return #10b981');
});

runTest('Color Computation', 'Light Mode Login with role selected does not return white', () => {
  const guruLogin = getStatusBarColor({ isDarkMode: false, isLoggedIn: false, role: 'guru' });
  assert.notEqual(guruLogin, '#ffffff', 'Login screen with guru role must not return white');
  assert.equal(guruLogin, '#f59e0b', 'Login screen with guru role returns amber header color');

  const adminLogin = getStatusBarColor({ isDarkMode: false, isLoggedIn: false, role: 'admin' });
  assert.notEqual(adminLogin, '#ffffff', 'Login screen with admin role must not return white');
  assert.equal(adminLogin, '#3b82f6', 'Login screen with admin role returns blue header color');
});

runTest('Color Computation', 'Light Mode Guru dashboard returns #ffffff (matches white sticky header)', () => {
  const color = getStatusBarColor({ isDarkMode: false, isExamActive: false, role: 'guru' });
  assert.equal(color, '#ffffff', 'Guru in light mode must return #ffffff');
});

runTest('Color Computation', 'Light Mode Admin dashboard returns #ffffff (matches white sticky header)', () => {
  const color = getStatusBarColor({ isDarkMode: false, isExamActive: false, role: 'admin' });
  assert.equal(color, '#ffffff', 'Admin in light mode must return #ffffff');
});

runTest('Color Computation', 'Light Mode ExamRoom returns #ffffff (matches white sticky header)', () => {
  const color = getStatusBarColor({ isDarkMode: false, isExamActive: true, role: 'siswa' });
  assert.equal(color, '#ffffff', 'Active exam in light mode must return #ffffff');
});

runTest('Color Computation', 'Light Mode SuperAdmin returns #7c3aed (matches violet header)', () => {
  const color = getStatusBarColor({ isDarkMode: false, isExamActive: false, role: 'super_admin' });
  assert.equal(color, '#7c3aed', 'SuperAdmin in light mode must return #7c3aed');
});

runTest('Color Computation', 'Edge cases (null, empty object, unexpected role) gracefully default to #10b981', () => {
  assert.equal(getStatusBarColor(null), '#10b981');
  assert.equal(getStatusBarColor(undefined), '#10b981');
  assert.equal(getStatusBarColor({}), '#10b981');
  assert.equal(getStatusBarColor({ role: 'unknown_role' }), '#10b981');
});

// -----------------------------------------------------------------------------
// Suite 3: DOM Synchronization & Reactive Toggle Simulation (syncThemeColor)
// -----------------------------------------------------------------------------
console.log('\n▶ [Suite 3] DOM Synchronization & Reactive Toggle Simulation:');

class MockElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.attributes = {};
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  getAttribute(name) {
    return this.attributes[name] || null;
  }
  get content() {
    return this.attributes.content || '';
  }
  set content(val) {
    this.attributes.content = String(val);
  }
  get name() {
    return this.attributes.name || '';
  }
  set name(val) {
    this.attributes.name = String(val);
  }
}

class MockHead {
  constructor() {
    this.children = [];
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
}

class MockDocument {
  constructor() {
    this.head = new MockHead();
  }
  createElement(tag) {
    return new MockElement(tag);
  }
  querySelector(selector) {
    if (selector === 'meta[name="theme-color"]') {
      return this.head.children.find(
        (el) => el.tagName === 'META' && el.attributes.name === 'theme-color'
      ) || null;
    }
    if (selector === 'meta[name="apple-mobile-web-app-status-bar-style"]') {
      return this.head.children.find(
        (el) => el.tagName === 'META' && el.attributes.name === 'apple-mobile-web-app-status-bar-style'
      ) || null;
    }
    return null;
  }
  querySelectorAll(selector) {
    if (selector === 'meta[name="theme-color"]') {
      return this.head.children.filter(
        (el) => el.tagName === 'META' && el.attributes.name === 'theme-color'
      );
    }
    return [];
  }
}

runTest('DOM Sync', 'syncThemeColor returns null in non-browser environment without throwing', () => {
  const origDoc = global.document;
  delete global.document;
  try {
    const res = syncThemeColor({ isDarkMode: false });
    assert.equal(res, null, 'Must return null when document is undefined');
  } finally {
    global.document = origDoc;
  }
});

runTest('DOM Sync', 'syncThemeColor updates existing meta[name="theme-color"] tag', () => {
  const mockDoc = new MockDocument();
  const existingMeta = new MockElement('meta');
  existingMeta.name = 'theme-color';
  existingMeta.content = '#10b981';
  mockDoc.head.appendChild(existingMeta);

  global.document = mockDoc;
  try {
    const applied = syncThemeColor({ isDarkMode: true, role: 'siswa' });
    assert.equal(applied, '#0f172a');
    assert.equal(existingMeta.getAttribute('content'), '#0f172a');
  } finally {
    delete global.document;
  }
});

runTest('DOM Sync', 'syncThemeColor dynamically creates meta tag if absent in head', () => {
  const mockDoc = new MockDocument();
  global.document = mockDoc;
  try {
    assert.equal(mockDoc.querySelector('meta[name="theme-color"]'), null);
    const applied = syncThemeColor({ isDarkMode: false, role: 'siswa' });
    assert.equal(applied, '#10b981');
    const createdMeta = mockDoc.querySelector('meta[name="theme-color"]');
    assert.ok(createdMeta, 'meta[name="theme-color"] must have been created');
    assert.equal(createdMeta.getAttribute('content'), '#10b981');
  } finally {
    delete global.document;
  }
});

runTest('DOM Sync', 'syncThemeColor updates all matching meta[name="theme-color"] tags in DOM', () => {
  const mockDoc = new MockDocument();
  const meta1 = new MockElement('meta');
  meta1.setAttribute('name', 'theme-color');
  meta1.setAttribute('content', '#10b981');
  const meta2 = new MockElement('meta');
  meta2.setAttribute('name', 'theme-color');
  meta2.setAttribute('content', '#10b981');
  mockDoc.head.appendChild(meta1);
  mockDoc.head.appendChild(meta2);

  global.document = mockDoc;
  try {
    syncThemeColor({ isDarkMode: true });
    assert.equal(meta1.getAttribute('content'), '#0f172a');
    assert.equal(meta2.getAttribute('content'), '#0f172a');
  } finally {
    delete global.document;
  }
});

runTest('DOM Sync', 'syncThemeColor dynamically updates apple-mobile-web-app-status-bar-style for contrast', () => {
  const mockDoc = new MockDocument();
  const appleMeta = new MockElement('meta');
  appleMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
  appleMeta.setAttribute('content', 'black-translucent');
  mockDoc.head.appendChild(appleMeta);

  global.document = mockDoc;
  try {
    // White header -> 'default' (dark text for readability)
    syncThemeColor({ isDarkMode: false, role: 'guru', isLoggedIn: true });
    assert.equal(appleMeta.getAttribute('content'), 'default');

    // Dark header -> 'black-translucent' (white text for readability)
    syncThemeColor({ isDarkMode: true, role: 'guru' });
    assert.equal(appleMeta.getAttribute('content'), 'black-translucent');

    // Emerald header -> 'black-translucent'
    syncThemeColor({ isDarkMode: false, role: 'siswa', isLoggedIn: true });
    assert.equal(appleMeta.getAttribute('content'), 'black-translucent');
  } finally {
    delete global.document;
  }
});

runTest('DOM Sync', 'Reactive Toggle Lifecycle: Light -> Dark -> Light transition', () => {
  const mockDoc = new MockDocument();
  global.document = mockDoc;
  try {
    // Initial: Siswa in Light Mode
    let color = syncThemeColor({ isDarkMode: false, isExamActive: false, role: 'siswa' });
    assert.equal(color, '#10b981');
    assert.equal(mockDoc.querySelector('meta[name="theme-color"]').getAttribute('content'), '#10b981');

    // Toggle Dark Mode ON
    color = syncThemeColor({ isDarkMode: true, isExamActive: false, role: 'siswa' });
    assert.equal(color, '#0f172a');
    assert.equal(mockDoc.querySelector('meta[name="theme-color"]').getAttribute('content'), '#0f172a');

    // Toggle Dark Mode OFF
    color = syncThemeColor({ isDarkMode: false, isExamActive: false, role: 'siswa' });
    assert.equal(color, '#10b981');
    assert.equal(mockDoc.querySelector('meta[name="theme-color"]').getAttribute('content'), '#10b981');
  } finally {
    delete global.document;
  }
});

runTest('DOM Sync', 'Complete End-to-End User Journey: Login -> Siswa -> Exam -> Dark Mode -> Exit Exam -> Guru', () => {
  const mockDoc = new MockDocument();
  global.document = mockDoc;
  try {
    const getMeta = () => mockDoc.querySelector('meta[name="theme-color"]').getAttribute('content');

    // 1. Visitor arrives at Login screen
    syncThemeColor({ isDarkMode: false, isExamActive: false, role: null, isLoggedIn: false });
    assert.equal(getMeta(), '#10b981', 'Login screen should have emerald status bar');

    // 2. Student logs in to Siswa dashboard
    syncThemeColor({ isDarkMode: false, isExamActive: false, role: 'siswa', isLoggedIn: true });
    assert.equal(getMeta(), '#10b981', 'Siswa dashboard should have emerald status bar');

    // 3. Student enters ExamRoom
    syncThemeColor({ isDarkMode: false, isExamActive: true, role: 'siswa', isLoggedIn: true });
    assert.equal(getMeta(), '#ffffff', 'ExamRoom should transition status bar to white');

    // 4. Student toggles dark mode during exam
    syncThemeColor({ isDarkMode: true, isExamActive: true, role: 'siswa', isLoggedIn: true });
    assert.equal(getMeta(), '#0f172a', 'ExamRoom in dark mode should transition to slate-900 (#0f172a)');

    // 5. Student toggles dark mode back to light
    syncThemeColor({ isDarkMode: false, isExamActive: true, role: 'siswa', isLoggedIn: true });
    assert.equal(getMeta(), '#ffffff', 'ExamRoom light mode should restore white status bar');

    // 6. Exam finishes, student returns to Siswa dashboard
    syncThemeColor({ isDarkMode: false, isExamActive: false, role: 'siswa', isLoggedIn: true });
    assert.equal(getMeta(), '#10b981', 'Siswa dashboard should restore emerald status bar');

    // 7. Student logs out, teacher logs in
    syncThemeColor({ isDarkMode: false, isExamActive: false, role: 'guru', isLoggedIn: true });
    assert.equal(getMeta(), '#ffffff', 'Guru dashboard should have white status bar');

    // 8. Teacher toggles dark mode
    syncThemeColor({ isDarkMode: true, isExamActive: false, role: 'guru', isLoggedIn: true });
    assert.equal(getMeta(), '#0f172a', 'Guru dashboard in dark mode should have slate-900 status bar');
  } finally {
    delete global.document;
  }
});

// -----------------------------------------------------------------------------
// Suite 4: Source Code Integration Integrity
// -----------------------------------------------------------------------------
console.log('\n▶ [Suite 4] Source Code Integration Integrity:');

runTest('Integration', 'src/App.jsx imports and invokes syncThemeColor with isLoggedIn', () => {
  const appCode = fs.readFileSync(path.join(projectRoot, 'src/App.jsx'), 'utf-8');
  assert.match(appCode, /import\s+\{[^}]*syncThemeColor[^}]*\}\s+from\s+['"]\.\/utils\/themeColor['"]/, 'App.jsx must import syncThemeColor');
  assert.match(appCode, /syncThemeColor\(\{[\s\S]*?isDarkMode[\s\S]*?isExamActive[\s\S]*?role:[\s\S]*?isLoggedIn:/, 'App.jsx must invoke syncThemeColor with current state and isLoggedIn');
});

runTest('Integration', 'src/App.jsx monitors system prefers-color-scheme media query', () => {
  const appCode = fs.readFileSync(path.join(projectRoot, 'src/App.jsx'), 'utf-8');
  assert.match(appCode, /prefers-color-scheme:\s*dark/, 'App.jsx must listen to OS dark mode preference');
});

runTest('Integration', 'src/views/SiswaView.jsx mobile header includes dark mode gradient classes', () => {
  const siswaCode = fs.readFileSync(path.join(projectRoot, 'src/views/SiswaView.jsx'), 'utf-8');
  assert.match(siswaCode, /md:hidden[^\n]*?dark:from-slate-900/, 'SiswaView mobile header must include dark:from-slate-900');
});

runTest('Integration', 'src/views/SuperAdminView.jsx header includes dark mode background class', () => {
  const superAdminCode = fs.readFileSync(path.join(projectRoot, 'src/views/SuperAdminView.jsx'), 'utf-8');
  assert.match(superAdminCode, /bg-primary[^\n]*?dark:bg-slate-900/, 'SuperAdminView header must include dark:bg-slate-900');
});

runTest('Integration', 'src/views/SiswaView.jsx dispatches storage event for exam transitions', () => {
  const siswaCode = fs.readFileSync(path.join(projectRoot, 'src/views/SiswaView.jsx'), 'utf-8');
  assert.match(siswaCode, /sessionStorage\.setItem\('nexa_active_exam'[\s\S]*?window\.dispatchEvent\(new Event\('storage'\)\)/, 'SiswaView must dispatch storage event on exam start');
  assert.match(siswaCode, /sessionStorage\.removeItem\('nexa_active_exam'[\s\S]*?window\.dispatchEvent\(new Event\('storage'\)\)/, 'SiswaView must dispatch storage event on exam finish');
});

runTest('Integration', 'src/views/ExamRoom.jsx dispatches storage event on mount and kick', () => {
  const examCode = fs.readFileSync(path.join(projectRoot, 'src/views/ExamRoom.jsx'), 'utf-8');
  assert.match(examCode, /window\.dispatchEvent\(new Event\('storage'\)\)/, 'ExamRoom must dispatch storage event');
});

// -----------------------------------------------------------------------------
// Execution Summary
// -----------------------------------------------------------------------------
console.log('\n------------------------------------------------------------------------');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('------------------------------------------------------------------------');

if (failedTests > 0) {
  console.error('\nFAILURES:');
  for (const f of failures) {
    console.error(`  - [${f.suite}] ${f.name}: ${f.error}`);
  }
  process.exit(1);
} else {
  console.log('\n🎉 ALL STATUS BAR COLOR & DYNAMIC SYNC TESTS PASSED SUCCESSFULLY!\n');
}
