/**
 * Round 2 Adversarial Stress Test Suite: PWA Status Bar Sync & Edge Cases
 * Reviewer 2 Verification
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

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err.message });
    console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
  }
}

console.log('========================================================================');
console.log('   ADVERSARIAL ROUND 2 STRESS TEST: STATUS BAR SYNC & INTEGRATION       ');
console.log('========================================================================\n');

// 1. Unauthenticated exam state isolation
test('Edge 1: Unauthenticated visitor with lingering isExamActive=true returns login emerald (#10b981), NOT white', () => {
  const color = getStatusBarColor({ isDarkMode: false, isExamActive: true, isLoggedIn: false });
  assert.equal(color, '#10b981', 'Unauthenticated user on login screen must NEVER receive white exam status bar');
});

test('Edge 2: Unauthenticated visitor with isExamActive=true and role=guru returns amber (#f59e0b)', () => {
  const color = getStatusBarColor({ isDarkMode: false, isExamActive: true, isLoggedIn: false, role: 'guru' });
  assert.equal(color, '#f59e0b', 'Unauthenticated user on guru login screen must receive amber header color');
});

// 2. Cross-form role leakage prevention between login and register
test('Edge 3: App.jsx isolates loginRole and registerRole based on isRegistering state', () => {
  const appCode = fs.readFileSync(path.join(projectRoot, 'src/App.jsx'), 'utf-8');
  assert.match(
    appCode,
    /activeUnauthRole\s*=\s*isRegistering\s*\?\s*registerRole\s*:\s*loginRole/,
    'App.jsx must compute activeUnauthRole conditionally based on isRegistering'
  );
});

// 3. Login header dark mode alignment
test('UI 1: App.jsx login header includes dark:bg-slate-900 to prevent status bar collision', () => {
  const appCode = fs.readFileSync(path.join(projectRoot, 'src/App.jsx'), 'utf-8');
  assert.match(
    appCode,
    /bg-primary[^\n]*?dark:bg-slate-900/,
    'App.jsx login header must include dark:bg-slate-900'
  );
  assert.match(
    appCode,
    /rounded-b-\[40px\][^\n]*?transition-colors\s+duration-300/,
    'App.jsx login header must include transition-colors duration-300'
  );
});

// 4. Manual dark mode preference tracking
test('Integration 1: App.jsx tracks user manual dark mode preference via setDarkModeWithPreference', () => {
  const appCode = fs.readFileSync(path.join(projectRoot, 'src/App.jsx'), 'utf-8');
  assert.match(
    appCode,
    /localStorage\.setItem\('nexa_dark_mode_manual',\s*'true'\)/,
    'App.jsx must record nexa_dark_mode_manual on user toggle'
  );
  assert.match(
    appCode,
    /setIsDarkMode=\{setDarkModeWithPreference\}/,
    'App.jsx must pass setDarkModeWithPreference to views'
  );
});

// 5. Logout session and exam state cleanup
test('Lifecycle 1: handleLogout clears nexa_active_exam from sessionStorage and resets isExamActive', () => {
  const appCode = fs.readFileSync(path.join(projectRoot, 'src/App.jsx'), 'utf-8');
  assert.match(
    appCode,
    /sessionStorage\.removeItem\('nexa_active_exam'\)[\s\S]*?setIsExamActive\(false\)/,
    'handleLogout must purge active exam from sessionStorage and state'
  );
});

// 6. Browser navigation reactivity
test('Integration 2: App.jsx monitors hashchange and popstate events for navigation reactivity', () => {
  const appCode = fs.readFileSync(path.join(projectRoot, 'src/App.jsx'), 'utf-8');
  assert.match(appCode, /window\.addEventListener\('hashchange',\s*checkExamStatus\)/, 'App.jsx must listen to hashchange');
  assert.match(appCode, /window\.addEventListener\('popstate',\s*checkExamStatus\)/, 'App.jsx must listen to popstate');
  assert.match(appCode, /window\.removeEventListener\('hashchange',\s*checkExamStatus\)/, 'App.jsx must cleanup hashchange');
  assert.match(appCode, /window\.removeEventListener\('popstate',\s*checkExamStatus\)/, 'App.jsx must cleanup popstate');
});

// 7. Mobile headers transition classes
test('UI 2: AdminView and GuruView mobile headers include transition-colors duration-300', () => {
  const adminCode = fs.readFileSync(path.join(projectRoot, 'src/views/AdminView.jsx'), 'utf-8');
  const guruCode = fs.readFileSync(path.join(projectRoot, 'src/views/GuruView.jsx'), 'utf-8');

  assert.match(
    adminCode,
    /<header className="lg:hidden[^\n]*?transition-colors\s+duration-300/,
    'AdminView mobile header must include transition-colors duration-300'
  );
  assert.match(
    guruCode,
    /<header className="lg:hidden[^\n]*?transition-colors\s+duration-300/,
    'GuruView mobile header must include transition-colors duration-300'
  );
});

// 8. Apple status bar style meta tag dynamic creation
test('iOS 1: syncThemeColor creates apple-mobile-web-app-status-bar-style tag if missing', () => {
  class MockElem {
    constructor(tagName, name, content) {
      this.tagName = tagName.toUpperCase();
      this.attributes = { name, content };
    }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] || null; }
  }

  const mockDoc = {
    head: {
      children: [],
      appendChild(child) {
        this.children.push(child);
        return child;
      }
    },
    createElement(tag) { return new MockElem(tag); },
    querySelectorAll(selector) {
      if (selector === 'meta[name="theme-color"]') {
        return this.head.children.filter(c => c.attributes.name === 'theme-color');
      }
      return [];
    },
    querySelector(selector) {
      return this.head.children.find(c => c.attributes.name === selector.replace(/meta\[name="([^"]+)"\]/, '$1')) || null;
    }
  };

  global.document = mockDoc;
  try {
    assert.equal(mockDoc.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]'), null);
    syncThemeColor({ isDarkMode: false, role: 'guru', isLoggedIn: true });
    const createdApple = mockDoc.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    assert.ok(createdApple, 'apple-mobile-web-app-status-bar-style meta tag must be created');
    assert.equal(createdApple.getAttribute('content'), 'default');
  } finally {
    delete global.document;
  }
});

// 9. Full End-to-End Stress Journey
test('E2E Stress: Full journey with role switching, registration, logout, and exam cleanup', () => {
  class MockElem {
    constructor(tagName, name, content) {
      this.tagName = tagName.toUpperCase();
      this.attributes = { name, content };
    }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] || null; }
  }

  const mockDoc = {
    head: {
      children: [],
      appendChild(child) {
        this.children.push(child);
        return child;
      }
    },
    createElement(tag) { return new MockElem(tag); },
    querySelectorAll(selector) {
      if (selector === 'meta[name="theme-color"]') {
        return this.head.children.filter(c => c.attributes.name === 'theme-color');
      }
      return [];
    },
    querySelector(selector) {
      return this.head.children.find(c => c.attributes.name === selector.replace(/meta\[name="([^"]+)"\]/, '$1')) || null;
    }
  };

  global.document = mockDoc;
  try {
    const getTheme = () => mockDoc.querySelector('meta[name="theme-color"]')?.getAttribute('content');
    const getApple = () => mockDoc.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content');

    // 1. Visitor arrives on login page
    syncThemeColor({ isDarkMode: false, isExamActive: false, isLoggedIn: false });
    assert.equal(getTheme(), '#10b981');
    assert.equal(getApple(), 'black-translucent');

    // 2. Visitor selects Guru role
    syncThemeColor({ isDarkMode: false, isExamActive: false, isLoggedIn: false, role: 'guru' });
    assert.equal(getTheme(), '#f59e0b');
    assert.equal(getApple(), 'black-translucent');

    // 3. Visitor toggles Dark Mode on Login
    syncThemeColor({ isDarkMode: true, isExamActive: false, isLoggedIn: false, role: 'guru' });
    assert.equal(getTheme(), '#0f172a');
    assert.equal(getApple(), 'black-translucent');

    // 4. Visitor switches to Register as Siswa in Light Mode
    syncThemeColor({ isDarkMode: false, isExamActive: false, isLoggedIn: false, role: 'siswa' });
    assert.equal(getTheme(), '#10b981');

    // 5. Teacher logs in (authenticated) in Light Mode
    syncThemeColor({ isDarkMode: false, isExamActive: false, isLoggedIn: true, role: 'guru' });
    assert.equal(getTheme(), '#ffffff');
    assert.equal(getApple(), 'default');

    // 6. Admin logs in in Light Mode
    syncThemeColor({ isDarkMode: false, isExamActive: false, isLoggedIn: true, role: 'admin' });
    assert.equal(getTheme(), '#ffffff');
    assert.equal(getApple(), 'default');

    // 7. Student logs in in Light Mode
    syncThemeColor({ isDarkMode: false, isExamActive: false, isLoggedIn: true, role: 'siswa' });
    assert.equal(getTheme(), '#10b981');
    assert.equal(getApple(), 'black-translucent');

    // 8. Student starts Exam in Light Mode
    syncThemeColor({ isDarkMode: false, isExamActive: true, isLoggedIn: true, role: 'siswa' });
    assert.equal(getTheme(), '#ffffff');
    assert.equal(getApple(), 'default');

    // 9. Student logs out (session cleared, returned to login screen)
    syncThemeColor({ isDarkMode: false, isExamActive: false, isLoggedIn: false, role: 'siswa' });
    assert.equal(getTheme(), '#10b981');
    assert.equal(getApple(), 'black-translucent');
  } finally {
    delete global.document;
  }
});

console.log('\n------------------------------------------------------------------------');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('------------------------------------------------------------------------\n');

if (failedTests > 0) {
  process.exit(1);
}
