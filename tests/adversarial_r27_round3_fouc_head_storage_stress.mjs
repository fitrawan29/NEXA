/**
 * Round 3 Adversarial Stress Test Suite: FOUC, Head Pre-render, Multi-tag, & OS Sync
 * Reviewer 3 Verification
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
console.log('   ADVERSARIAL ROUND 3 STRESS TEST: FOUC, PRE-RENDER & OS REACTION      ');
console.log('========================================================================\n');

// 1. Cold boot FOUC & dark mode pre-render script in index.html
test('Pre-render 1: index.html contains inline pre-render script for cold-boot theme sync', () => {
  const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf-8');
  assert.match(
    indexHtml,
    /<script>[\s\S]*?localStorage\.getItem\(['"]nexa_dark_mode['"]\)[\s\S]*?classList\.add\(['"]dark['"]\)[\s\S]*?<\/script>/,
    'index.html must include inline script to prevent dark mode cold-boot FOUC'
  );
  assert.match(
    indexHtml,
    /document\.querySelector\(['"]meta\[name="theme-color"\]['"]\)[\s\S]*?#0f172a/,
    'index.html pre-render script must set theme-color to #0f172a in dark mode'
  );
});

// 2. Viewport-fit cover for edge-to-edge mobile status bar blending
test('Viewport 1: index.html viewport meta tag includes viewport-fit=cover for notch display', () => {
  const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf-8');
  assert.match(
    indexHtml,
    /<meta\s+name=["']viewport["']\s+content=["'][^"']*viewport-fit=cover[^"']*["']/,
    'index.html must specify viewport-fit=cover for notched device status bar blending'
  );
});

// 3. OS Theme preference preservation across page reloads
test('OS Sync 1: App.jsx checks nexa_dark_mode_manual before using saved state in useState', () => {
  const appCode = fs.readFileSync(path.join(projectRoot, 'src/App.jsx'), 'utf-8');
  assert.match(
    appCode,
    /const manual = localStorage\.getItem\('nexa_dark_mode_manual'\);[\s\S]*?if\s*\(manual\)[\s\S]*?window\.matchMedia\('\(prefers-color-scheme: dark\)'\)/,
    'App.jsx useState must check manual preference before falling back to saved preference over OS scheme'
  );
});

// 4. Role normalization in getStatusBarColor (super_admin vs superAdmin vs case-insensitive)
test('Role 1: getStatusBarColor normalizes role casing and formats for super_admin', () => {
  assert.equal(getStatusBarColor({ isDarkMode: false, isLoggedIn: true, role: 'super_admin' }), '#7c3aed');
  assert.equal(getStatusBarColor({ isDarkMode: false, isLoggedIn: true, role: 'superAdmin' }), '#7c3aed');
  assert.equal(getStatusBarColor({ isDarkMode: false, isLoggedIn: true, role: 'SUPER_ADMIN' }), '#7c3aed');
  assert.equal(getStatusBarColor({ isDarkMode: false, isLoggedIn: false, role: 'superAdmin' }), '#7c3aed');
  assert.equal(getStatusBarColor({ isDarkMode: false, isLoggedIn: true, role: 'GURU' }), '#ffffff');
  assert.equal(getStatusBarColor({ isDarkMode: false, isLoggedIn: false, role: 'GURU' }), '#f59e0b');
});

// 5. Multiple Apple Status Bar meta tags in DOM
test('iOS 2: syncThemeColor updates all matching apple status bar meta tags in DOM', () => {
  class MockElem {
    constructor(tagName, name, content) {
      this.tagName = tagName.toUpperCase();
      this.attributes = { name, content };
    }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] || null; }
  }

  const tag1 = new MockElem('META', 'apple-mobile-web-app-status-bar-style', 'black-translucent');
  const tag2 = new MockElem('META', 'apple-mobile-web-app-status-bar-style', 'black-translucent');
  const themeTag = new MockElem('META', 'theme-color', '#10b981');

  const mockDoc = {
    head: {
      children: [themeTag, tag1, tag2],
      appendChild(child) { this.children.push(child); return child; }
    },
    createElement(tag) { return new MockElem(tag); },
    querySelectorAll(selector) {
      if (selector === 'meta[name="theme-color"]') {
        return this.head.children.filter(c => c.attributes.name === 'theme-color');
      }
      if (selector === 'meta[name="apple-mobile-web-app-status-bar-style"]') {
        return this.head.children.filter(c => c.attributes.name === 'apple-mobile-web-app-status-bar-style');
      }
      return [];
    },
    querySelector(selector) {
      const name = selector.replace(/meta\[name="([^"]+)"\]/, '$1');
      return this.head.children.find(c => c.attributes.name === name) || null;
    }
  };

  global.document = mockDoc;
  try {
    syncThemeColor({ isDarkMode: false, role: 'guru', isLoggedIn: true });
    assert.equal(tag1.getAttribute('content'), 'default');
    assert.equal(tag2.getAttribute('content'), 'default');

    syncThemeColor({ isDarkMode: true, role: 'guru', isLoggedIn: true });
    assert.equal(tag1.getAttribute('content'), 'black-translucent');
    assert.equal(tag2.getAttribute('content'), 'black-translucent');
  } finally {
    delete global.document;
  }
});

// 6. Safe Document Head fallback when document.head is missing
test('DOM 1: syncThemeColor resolves head via getElementsByTagName fallback if document.head is null', () => {
  class MockElem {
    constructor(tagName, name, content) {
      this.tagName = tagName.toUpperCase();
      this.attributes = { name, content };
    }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] || null; }
  }

  const fallbackHead = {
    children: [],
    appendChild(child) { this.children.push(child); return child; }
  };

  const mockDoc = {
    head: null, // document.head is intentionally null
    getElementsByTagName(tag) {
      if (tag.toLowerCase() === 'head') return [fallbackHead];
      return [];
    },
    createElement(tag) { return new MockElem(tag); },
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };

  global.document = mockDoc;
  try {
    const color = syncThemeColor({ isDarkMode: false, role: 'siswa', isLoggedIn: true });
    assert.equal(color, '#10b981');
    assert.equal(fallbackHead.children.length, 2, 'Must append theme-color and apple meta tags to fallback head');
    assert.equal(fallbackHead.children[0].getAttribute('name'), 'theme-color');
    assert.equal(fallbackHead.children[0].getAttribute('content'), '#10b981');
    assert.equal(fallbackHead.children[1].getAttribute('name'), 'apple-mobile-web-app-status-bar-style');
    assert.equal(fallbackHead.children[1].getAttribute('content'), 'black-translucent');
  } finally {
    delete global.document;
  }
});

// 7. Cross-tab Dark Mode storage event synchronization in App.jsx
test('Integration 3: App.jsx listens to storage events for cross-tab dark mode synchronization', () => {
  const appCode = fs.readFileSync(path.join(projectRoot, 'src/App.jsx'), 'utf-8');
  assert.match(
    appCode,
    /handleStorageChange[\s\S]*?nexa_dark_mode[\s\S]*?setIsDarkMode/,
    'App.jsx must listen to storage events to sync nexa_dark_mode across browser tabs'
  );
});

// 8. Foreground visibilitychange listener in App.jsx
test('Integration 4: App.jsx attaches visibilitychange listener for mobile app resume', () => {
  const appCode = fs.readFileSync(path.join(projectRoot, 'src/App.jsx'), 'utf-8');
  assert.match(
    appCode,
    /document\.addEventListener\('visibilitychange',\s*checkExamStatus\)/,
    'App.jsx must listen to visibilitychange for app resume'
  );
  assert.match(
    appCode,
    /document\.removeEventListener\('visibilitychange',\s*checkExamStatus\)/,
    'App.jsx must cleanup visibilitychange listener on unmount'
  );
});

// 9. Hash cleanup on logout in App.jsx
test('Lifecycle 2: handleLogout clears window.location.hash if containing exam', () => {
  const appCode = fs.readFileSync(path.join(projectRoot, 'src/App.jsx'), 'utf-8');
  assert.match(
    appCode,
    /window\.location\.hash\.includes\('exam'\)[\s\S]*?window\.location\.hash\s*=\s*['"]['"]/,
    'handleLogout must clear lingering exam hash'
  );
});

console.log('\n------------------------------------------------------------------------');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('------------------------------------------------------------------------\n');

if (failedTests > 0) {
  process.exit(1);
}
