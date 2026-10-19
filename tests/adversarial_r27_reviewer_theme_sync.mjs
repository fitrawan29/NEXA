/**
 * Adversarial Test Suite for PWA & Mobile Status Bar Color Alignment & Sync
 * Round 27 Reviewer Verification
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
console.log('   ADVERSARIAL STRESS TEST: PWA STATUS BAR SYNC & EDGE CASES           ');
console.log('========================================================================\n');

// 1. Static checks
test('R1: Legacy color #003fb1 is absent from index.html & manifest.json', () => {
  const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf-8');
  const manifest = fs.readFileSync(path.join(projectRoot, 'public/manifest.json'), 'utf-8');
  assert.ok(!indexHtml.includes('#003fb1'), 'index.html has legacy color');
  assert.ok(!manifest.includes('#003fb1'), 'manifest.json has legacy color');
});

// 2. Login Screen vs Dashboard distinction
test('R2 Edge: Login screen with role="guru" selected does not produce white status bar', () => {
  const color = getStatusBarColor({ isDarkMode: false, isLoggedIn: false, role: 'guru' });
  assert.notEqual(color, '#ffffff', 'Login screen with role guru must not have white status bar');
  assert.ok(color === THEME_COLORS.emerald || color === '#f59e0b', 'Should be emerald or role primary amber');
});

test('R2 Edge: Login screen with role="admin" selected does not produce white status bar', () => {
  const color = getStatusBarColor({ isDarkMode: false, isLoggedIn: false, role: 'admin' });
  assert.notEqual(color, '#ffffff', 'Login screen with role admin must not have white status bar');
  assert.ok(color === THEME_COLORS.emerald || color === '#3b82f6', 'Should be emerald or role primary blue');
});

test('R2 Normal: Authenticated Guru and Admin dashboards return white in light mode', () => {
  assert.equal(getStatusBarColor({ isDarkMode: false, isLoggedIn: true, role: 'guru' }), '#ffffff');
  assert.equal(getStatusBarColor({ isDarkMode: false, isLoggedIn: true, role: 'admin' }), '#ffffff');
  // Default when isLoggedIn is omitted (backward compatibility)
  assert.equal(getStatusBarColor({ isDarkMode: false, role: 'guru' }), '#ffffff');
  assert.equal(getStatusBarColor({ isDarkMode: false, role: 'admin' }), '#ffffff');
});

// 3. Apple status bar style synchronization
test('R2 iOS: syncThemeColor updates apple-mobile-web-app-status-bar-style for contrast', () => {
  class MockElem {
    constructor(tagName, name) {
      this.tagName = tagName;
      this.attributes = { name };
    }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] || null; }
  }
  const mockDoc = {
    head: { children: [] },
    createElement(tag) { return new MockElem(tag); },
    querySelectorAll(selector) {
      if (selector === 'meta[name="theme-color"]') {
        return this.head.children.filter(c => c.attributes.name === 'theme-color');
      }
      return [];
    },
    querySelector(selector) {
      if (selector === 'meta[name="theme-color"]') {
        return this.head.children.find(c => c.attributes.name === 'theme-color') || null;
      }
      if (selector === 'meta[name="apple-mobile-web-app-status-bar-style"]') {
        return this.head.children.find(c => c.attributes.name === 'apple-mobile-web-app-status-bar-style') || null;
      }
      return null;
    }
  };
  const themeMeta = new MockElem('META', 'theme-color');
  themeMeta.setAttribute('content', '#10b981');
  const appleMeta = new MockElem('META', 'apple-mobile-web-app-status-bar-style');
  appleMeta.setAttribute('content', 'black-translucent');
  mockDoc.head.children.push(themeMeta, appleMeta);

  global.document = mockDoc;
  try {
    // White header -> apple status bar style must be 'default' (dark icons)
    syncThemeColor({ isDarkMode: false, role: 'guru', isLoggedIn: true });
    assert.equal(appleMeta.getAttribute('content'), 'default', 'White header must use default apple status bar style');

    // Dark header -> apple status bar style must be 'black-translucent' (light icons)
    syncThemeColor({ isDarkMode: true, role: 'guru' });
    assert.equal(appleMeta.getAttribute('content'), 'black-translucent', 'Dark header must use black-translucent style');

    // Emerald header -> apple status bar style must be 'black-translucent' (light icons)
    syncThemeColor({ isDarkMode: false, role: 'siswa', isLoggedIn: true });
    assert.equal(appleMeta.getAttribute('content'), 'black-translucent', 'Emerald header must use black-translucent style');
  } finally {
    delete global.document;
  }
});

// 4. Multiple meta tags handling
test('R2 DOM: syncThemeColor updates multiple theme-color meta tags if present in head', () => {
  class MockElem {
    constructor(tagName, name, content) {
      this.tagName = tagName;
      this.attributes = { name, content };
    }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] || null; }
  }
  const meta1 = new MockElem('META', 'theme-color', '#10b981');
  const meta2 = new MockElem('META', 'theme-color', '#10b981');
  const mockDoc = {
    head: { children: [meta1, meta2] },
    createElement(tag) { return new MockElem(tag); },
    querySelectorAll(selector) {
      if (selector === 'meta[name="theme-color"]') {
        return this.head.children.filter(c => c.attributes.name === 'theme-color');
      }
      return [];
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
  };
  global.document = mockDoc;
  try {
    syncThemeColor({ isDarkMode: true });
    assert.equal(meta1.getAttribute('content'), '#0f172a');
    assert.equal(meta2.getAttribute('content'), '#0f172a');
  } finally {
    delete global.document;
  }
});

// 5. Mobile header dark mode styles in JSX
test('R2 UI: SiswaView mobile header has dark mode styling to match #0f172a status bar', () => {
  const code = fs.readFileSync(path.join(projectRoot, 'src/views/SiswaView.jsx'), 'utf-8');
  assert.match(
    code,
    /md:hidden[^\n]*?dark:from-slate-900/,
    'SiswaView mobile header must include dark:from-slate-900 for dark mode alignment'
  );
});

test('R2 UI: SuperAdminView header has dark mode styling to match #0f172a status bar', () => {
  const code = fs.readFileSync(path.join(projectRoot, 'src/views/SuperAdminView.jsx'), 'utf-8');
  assert.match(
    code,
    /bg-primary[^\n]*?dark:bg-slate-900/,
    'SuperAdminView header must include dark:bg-slate-900 for dark mode alignment'
  );
});

// 6. App.jsx integration
test('R2 Integration: App.jsx passes isLoggedIn to syncThemeColor', () => {
  const code = fs.readFileSync(path.join(projectRoot, 'src/App.jsx'), 'utf-8');
  assert.match(code, /syncThemeColor\(\{[\s\S]*?isLoggedIn:/, 'App.jsx must pass isLoggedIn to syncThemeColor');
});

// 7. System Dark Mode listener in App.jsx
test('R2 Integration: App.jsx includes matchMedia prefers-color-scheme listener', () => {
  const code = fs.readFileSync(path.join(projectRoot, 'src/App.jsx'), 'utf-8');
  assert.match(code, /prefers-color-scheme:\s*dark/, 'App.jsx must monitor system prefers-color-scheme');
});

console.log('\n------------------------------------------------------------------------');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('------------------------------------------------------------------------\n');

if (failedTests > 0) {
  process.exit(1);
}
