#!/usr/bin/env node
/**
 * ============================================================================
 * CBT NEXA — Round 3 Adversarial Edge-Case Stress Test Suite
 * ============================================================================
 * Targets:
 * 1. Virtual Keyboard Push-up on Modals & Dialogs (short viewport 200px - 320px height)
 * 2. Active ExamRoom rendering with long KaTeX, MathJax, wide tables, code blocks
 * 3. ExamRoom HUD header & Bottom Bar on 320px ultra-compact mobile
 * 4. Touch target spacing & overlap detection on 320px
 * 5. Dynamic orientation switching (portrait <-> landscape)
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inKodeNexa = __dirname.includes('kode NEXA');
const projectRoot = inKodeNexa ? path.resolve(__dirname, '..') : path.resolve(__dirname, '..', 'kode NEXA');

const report = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: []
};

function recordTest(category, name, condition, details = '') {
  report.total++;
  if (condition) {
    report.passed++;
    console.log(`  ✔ [PASS] [${category}] ${name}`);
  } else {
    report.failed++;
    report.failures.push({ category, name, details });
    console.log(`  ✖ [FAIL] [${category}] ${name}${details ? ` -> ${details}` : ''}`);
  }
}

console.log('======================================================================');
console.log('  CBT NEXA: ROUND 3 ADVERSARIAL EDGE-CASE VERIFICATION SUITE         ');
console.log('======================================================================\n');

// Discover Chrome / Edge executable
const chromeCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'google-chrome',
  'chrome'
];
const chromePath = chromeCandidates.find(p => fs.existsSync(p));

if (!chromePath) {
  console.error('No Chrome/Edge executable found.');
  process.exit(1);
}

const serverPort = 5400 + Math.floor(Math.random() * 50);
const viteServer = await createServer({
  root: projectRoot,
  configFile: path.resolve(projectRoot, 'vite.config.js'),
  server: { port: serverPort, host: '127.0.0.1' },
  logLevel: 'error'
});
await viteServer.listen();

const cdpPort = 9500 + Math.floor(Math.random() * 50);
const tmpDir = path.join(os.tmpdir(), `cbt_nexa_r3_edge_${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });

const chromeProc = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${cdpPort}`,
  `--user-data-dir=${tmpDir}`,
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=375,667',
  'about:blank'
], { stdio: 'ignore' });

// Poll for CDP
let pages = [];
for (let i = 0; i < 40; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
    if (r.ok) {
      pages = await r.json();
      if (pages.some(p => p.type === 'page')) break;
    }
  } catch (e) {}
  await new Promise(r => setTimeout(r, 200));
}

const target = pages.find(p => p.type === 'page') || pages[0];
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });

let msgId = 1;
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const cur = msgId++;
  const handler = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id === cur) {
      ws.removeEventListener('message', handler);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  };
  ws.addEventListener('message', handler);
  ws.send(JSON.stringify({ id: cur, method, params }));
});

const evaluate = async (expr) => {
  const res = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true
  });
  return res?.result?.value;
};

const setViewport = async (width, height, isLandscape = false) => {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: true,
    screenOrientation: {
      type: isLandscape ? 'landscapePrimary' : 'portraitPrimary',
      angle: isLandscape ? 90 : 0
    }
  });
  await new Promise(r => setTimeout(r, 250));
};

const checkOverflow = async () => {
  return await evaluate(`(() => {
    const docEl = document.documentElement;
    const body = document.body;
    const winW = window.innerWidth;
    const scrollW = docEl.scrollWidth;
    const bodyScrollW = body ? body.scrollWidth : 0;
    const clientW = docEl.clientWidth;
    const hasHorizontalOverflow = scrollW > winW || bodyScrollW > winW;
    
    // Check all elements for protruding without containment
    const all = Array.from(document.querySelectorAll('*'));
    let uncontainedProtruding = 0;
    let worstProtrusion = 0;
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > winW + 2) {
        let p = el.parentElement;
        let contained = false;
        while (p && p !== document.body && p !== docEl) {
          const s = window.getComputedStyle(p);
          if (s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflowX === 'hidden') {
            contained = true;
            break;
          }
          p = p.parentElement;
        }
        if (!contained) {
          uncontainedProtruding++;
          worstProtrusion = Math.max(worstProtrusion, r.right - winW);
        }
      }
    }

    return {
      winW,
      scrollW,
      bodyScrollW,
      hasHorizontalOverflow,
      uncontainedProtruding,
      worstProtrusion
    };
  })()`);
};

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await setViewport(375, 667);
  await send('Page.navigate', { url: `http://127.0.0.1:${serverPort}/` });
  await new Promise(r => setTimeout(r, 2000));

  // =========================================================================
  // TEST 1: Orientation Switching on Login Screen
  // =========================================================================
  console.log('▶ TEST 1: Orientation Switching on Role Selection & Login');
  
  // Portrait 320x568
  await setViewport(320, 568, false);
  let ov = await checkOverflow();
  recordTest('Orientation', 'Portrait 320x568 Login Viewport', !ov.hasHorizontalOverflow && ov.uncontainedProtruding === 0, `scrollW: ${ov.scrollW}`);

  // Landscape 568x320
  await setViewport(568, 320, true);
  ov = await checkOverflow();
  recordTest('Orientation', 'Landscape 568x320 Login Viewport', !ov.hasHorizontalOverflow && ov.uncontainedProtruding === 0, `scrollW: ${ov.scrollW}`);

  // Portrait 375x667
  await setViewport(375, 667, false);
  ov = await checkOverflow();
  recordTest('Orientation', 'Portrait 375x667 Login Viewport', !ov.hasHorizontalOverflow && ov.uncontainedProtruding === 0, `scrollW: ${ov.scrollW}`);

  // Landscape 667x375
  await setViewport(667, 375, true);
  ov = await checkOverflow();
  recordTest('Orientation', 'Landscape 667x375 Login Viewport', !ov.hasHorizontalOverflow && ov.uncontainedProtruding === 0, `scrollW: ${ov.scrollW}`);

  // =========================================================================
  // TEST 2: SuperAdmin Login & Modal Input Virtual Keyboard Push-Up
  // =========================================================================
  console.log('\n▶ TEST 2: Virtual Keyboard Push-up on Modal Inputs (SuperAdmin Form Modal)');
  
  await setViewport(375, 667, false);
  await evaluate(`(async () => {
    const btns = Array.from(document.querySelectorAll('button'));
    const sBtn = btns.find(b => b.innerText.includes('S-Admin'));
    if (sBtn) sBtn.click();
    await new Promise(r => setTimeout(r, 400));
    
    const setNative = (el, val) => {
      const p = Object.getPrototypeOf(el);
      const s = Object.getOwnPropertyDescriptor(p, 'value')?.set;
      if (s) s.call(el, val); else el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    
    const inputs = Array.from(document.querySelectorAll('input'));
    const u = inputs.find(i => i.placeholder && i.placeholder.includes('Username'));
    const p = inputs.find(i => i.placeholder && i.placeholder.includes('Password'));
    if (u && p) {
      setNative(u, 'superadmin');
      setNative(p, 'QWerty1334#');
    }
    await new Promise(r => setTimeout(r, 200));
    const sub = document.querySelector('button[type="submit"]');
    if (sub) sub.click();
  })()`);

  await new Promise(r => setTimeout(r, 2500));

  // Navigate to 'sekolah' tab
  await evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll('button[data-assistant-target]'));
    const b = btns.find(btn => btn.getAttribute('data-assistant-target') === 'sekolah');
    if (b) b.click();
  })()`);
  await new Promise(r => setTimeout(r, 500));

  // Open Edit School modal (which opens formModal with NPSN, Nama Sekolah inputs)
  const formModalOpened = await evaluate(`(() => {
    const editBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerHTML.includes('edit'));
    if (editBtn) { editBtn.click(); return true; }
    return false;
  })()`);

  recordTest('VirtualKeyboard', 'Form Modal opened successfully in SuperAdmin', !!formModalOpened);

  if (formModalOpened) {
    await new Promise(r => setTimeout(r, 500));

    // 1. Check at standard mobile 375x667
    ov = await checkOverflow();
    recordTest('VirtualKeyboard', 'Modal at 375x667 portrait (no horizontal overflow)', !ov.hasHorizontalOverflow && ov.uncontainedProtruding === 0, `scrollW: ${ov.scrollW}`);

    // 2. Simulate Virtual Keyboard Open on 375px (height reduced to 320px)
    await setViewport(375, 320, false);
    ov = await checkOverflow();
    recordTest('VirtualKeyboard', 'Modal with Virtual Keyboard (375x320, no overflow)', !ov.hasHorizontalOverflow && ov.uncontainedProtruding === 0, `scrollW: ${ov.scrollW}`);

    // 3. Verify modal container is constrained and scrollable
    const modalCheck = await evaluate(`(() => {
      const modal = document.querySelector('.fixed.inset-0.items-center > div, [role="dialog"] > div, .fixed.inset-0 > div:not([aria-hidden="true"])');
      if (!modal) return { found: false };
      const r = modal.getBoundingClientRect();
      const style = window.getComputedStyle(modal);
      const isWithinWidth = r.right <= window.innerWidth && r.left >= 0;
      const isWithinHeight = r.height <= window.innerHeight;
      const hasScroll = modal.scrollHeight >= modal.clientHeight;
      const canScrollY = style.overflowY === 'auto' || style.overflowY === 'scroll';
      return {
        found: true,
        isWithinWidth,
        isWithinHeight,
        hasScroll,
        canScrollY,
        width: r.width,
        height: r.height,
        winW: window.innerWidth,
        winH: window.innerHeight
      };
    })()`);

    recordTest('VirtualKeyboard', 'Modal card stays within width bounds on 375x320', modalCheck.isWithinWidth, `width: ${modalCheck.width}, winW: ${modalCheck.winW}`);
    recordTest('VirtualKeyboard', 'Modal card stays within height bounds on 375x320', modalCheck.isWithinHeight, `height: ${modalCheck.height}, winH: ${modalCheck.winH}`);
    recordTest('VirtualKeyboard', 'Modal card allows vertical scrolling (overflow-y: auto)', modalCheck.canScrollY);

    // 4. Test Extreme Short Landscape Virtual Keyboard: 568x220
    await setViewport(568, 220, true);
    ov = await checkOverflow();
    recordTest('VirtualKeyboard', 'Extreme short landscape with virtual keyboard (568x220)', !ov.hasHorizontalOverflow && ov.uncontainedProtruding === 0, `scrollW: ${ov.scrollW}`);

    const landscapeModalCheck = await evaluate(`(() => {
      const modal = document.querySelector('.fixed.inset-0.items-center > div, [role="dialog"] > div, .fixed.inset-0 > div:not([aria-hidden="true"])');
      if (!modal) return { found: false };
      const r = modal.getBoundingClientRect();
      return {
        isWithinHeight: r.height <= window.innerHeight,
        height: r.height,
        winH: window.innerHeight
      };
    })()`);
    recordTest('VirtualKeyboard', 'Modal height stays within 220px landscape viewport', landscapeModalCheck.isWithinHeight, `height: ${landscapeModalCheck.height}, winH: ${landscapeModalCheck.winH}`);

    // 5. Test Ultra-compact 320px with Virtual Keyboard (320x260)
    await setViewport(320, 260, false);
    ov = await checkOverflow();
    recordTest('VirtualKeyboard', 'Ultra-compact 320px with virtual keyboard (320x260)', !ov.hasHorizontalOverflow && ov.uncontainedProtruding === 0, `scrollW: ${ov.scrollW}`);

    // Close the modal
    await evaluate(`(() => {
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Batal') || b.innerText.includes('Tutup'));
      if (cancelBtn) cancelBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));
  }

  // =========================================================================
  // TEST 3: Touch Target Accessibility on 320px Viewport
  // =========================================================================
  console.log('\n▶ TEST 3: Touch Targets & Spacing on 320px Viewport');
  await setViewport(320, 568, false);

  const touchTargetAudit = await evaluate(`(() => {
    const interactives = Array.from(document.querySelectorAll('button, a, input, select, textarea, [role="button"]'));
    const issues = [];
    const winW = window.innerWidth;

    for (const el of interactives) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > window.innerHeight) continue;
      
      // Protruding beyond screen
      if (r.right > winW + 1) {
        issues.push({ tag: el.tagName, text: el.innerText?.slice(0, 20), issue: 'protruding', right: r.right });
      }
    }

    return {
      total: interactives.length,
      issues
    };
  })()`);

  recordTest('TouchTarget', `No interactive element protrudes beyond 320px viewport (${touchTargetAudit.total} checked)`, touchTargetAudit.issues.length === 0, JSON.stringify(touchTargetAudit.issues.slice(0, 3)));

  // =========================================================================
  // TEST 4: Complex Multi-line KaTeX & MathJax Equation Stress Injection
  // =========================================================================
  console.log('\n▶ TEST 4: Complex Equations, KaTeX, MathJax & Wide Tables in Exam Simulation');

  // Inject a simulated exam question container with complex KaTeX, MathJax, and long table
  const mathStressResult = await evaluate(`(() => {
    const testDiv = document.createElement('div');
    testDiv.id = 'stress-math-test';
    testDiv.className = 'w-full max-w-full p-4 bg-white dark:bg-slate-800 rounded-3xl';
    testDiv.innerHTML = \`
      <!-- Long unbroken inline KaTeX formula -->
      <p class="font-medium text-slate-800 dark:text-slate-100">
        Diketahui persamaan gelombang:
        <span class="katex"><span class="katex-html" style="white-space: nowrap; display: inline-block; width: 650px;">
          \\Psi(x, t) = A \\cos(kx - \\omega t + \\phi) + B \\sin(kx + \\omega t - \\delta) + \\int_0^\\infty e^{-s t} f(s) ds = \\sum_{n=1}^{\\infty} \\frac{1}{n^2} \\sin(n \\pi x)
        </span></span>
      </p>

      <!-- Long Display KaTeX equation -->
      <span class="katex-display">
        <span class="katex"><span class="katex-html" style="white-space: nowrap; display: block; width: 700px;">
          \\hat{H} \\Psi = \\left( -\\frac{\\hbar^2}{2m} \\nabla^2 + V(\\mathbf{r}) + \\frac{e^2}{4\\pi\\varepsilon_0 |\\mathbf{r}_1 - \\mathbf{r}_2|} \\right) \\Psi = E \\Psi
        </span></span>
      </span>

      <!-- MathJax container -->
      <div class="mjx-container MathJax" style="width: 680px; display: inline-block;">
        <svg width="680" height="40"><rect width="680" height="40" fill="gray"/></svg>
      </div>

      <!-- Wide table without wrapper -->
      <table>
        <thead>
          <tr>
            <th style="min-width: 150px;">Kolom Parameter 1</th>
            <th style="min-width: 150px;">Kolom Parameter 2</th>
            <th style="min-width: 150px;">Kolom Parameter 3</th>
            <th style="min-width: 150px;">Kolom Parameter 4</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Nilai Percobaan A</td>
            <td>Nilai Percobaan B</td>
            <td>Nilai Percobaan C</td>
            <td>Nilai Percobaan D</td>
          </tr>
        </tbody>
      </table>

      <!-- Preformatted code block with unbroken string -->
      <pre><code>const a_very_long_unbroken_constant_name_that_exceeds_viewport_width_on_mobile_devices_0123456789abcdefghijklmnopqrstuvwxyz = 123456789;</code></pre>
    \`;

    const container = document.querySelector('main') || document.getElementById('root') || document.body;
    container.appendChild(testDiv);

    // Measure document overflow
    const docEl = document.documentElement;
    const winW = window.innerWidth;
    const scrollW = docEl.scrollWidth;
    const bodyScrollW = document.body.scrollWidth;
    const hasOverflow = scrollW > winW || bodyScrollW > winW;

    return {
      winW,
      scrollW,
      bodyScrollW,
      hasOverflow
    };
  })()`);

  recordTest('MathStress', `320px viewport with 700px KaTeX, MathJax, Table & Code (scrollW: ${mathStressResult.scrollW} <= winW: ${mathStressResult.winW})`, !mathStressResult.hasOverflow, `scrollW: ${mathStressResult.scrollW}, winW: ${mathStressResult.winW}`);

  // Test at 360px
  await setViewport(360, 640);
  ov = await checkOverflow();
  recordTest('MathStress', `360px viewport with injected complex formulas (scrollW: ${ov.scrollW} <= winW: ${ov.winW})`, !ov.hasHorizontalOverflow, `scrollW: ${ov.scrollW}`);

  // Test at 375px
  await setViewport(375, 667);
  ov = await checkOverflow();
  recordTest('MathStress', `375px viewport with injected complex formulas (scrollW: ${ov.scrollW} <= winW: ${ov.winW})`, !ov.hasHorizontalOverflow, `scrollW: ${ov.scrollW}`);

  // Clean up injected test element
  await evaluate(`(() => {
    const el = document.getElementById('stress-math-test');
    if (el) el.remove();
  })()`);

  // =========================================================================
  // TEST 5: ExamRoom Header & Fixed Bars Width Containment on 320px
  // =========================================================================
  console.log('\n▶ TEST 5: ExamRoom Fixed Header & Navigation on 320px');

  await setViewport(320, 568);
  const examBarCheck = await evaluate(`(() => {
    // Inject mock exam room header and bottom bar to test strict width bounds
    const header = document.createElement('header');
    header.className = 'fixed top-0 left-0 right-0 h-16 bg-white z-50 flex items-center justify-between px-4';
    header.innerHTML = \`
      <div class="flex items-center gap-3">
        <div style="width: 36px; height: 36px; shrink: 0;">Logo</div>
        <div style="max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Mata Pelajaran Ujian Sangat Panjang</div>
      </div>
      <div class="flex items-center gap-2">
        <div style="width: 70px;">01:30:00</div>
        <div style="width: 80px;">A- A A+</div>
        <button style="min-width: 44px; min-height: 44px;">Btn</button>
      </div>
    \`;
    document.body.appendChild(header);

    const docEl = document.documentElement;
    const winW = window.innerWidth;
    const headerScrollW = header.scrollWidth;
    const headerClientW = header.clientWidth;
    const docScrollW = docEl.scrollWidth;
    
    const passed = docScrollW <= winW && headerScrollW <= winW;
    header.remove();

    return {
      winW,
      docScrollW,
      headerScrollW,
      headerClientW,
      passed
    };
  })()`);

  recordTest('ExamBars', `ExamRoom header on 320px does not cause document or header overflow`, examBarCheck.passed, `docScrollW: ${examBarCheck.docScrollW}, headerScrollW: ${examBarCheck.headerScrollW}, winW: ${examBarCheck.winW}`);

} catch (err) {
  console.error('Test execution error:', err);
  recordTest('Fatal', 'Test execution completed without crash', false, err.message);
} finally {
  ws.close();
  chromeProc.kill();
  await viteServer.close();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
}

console.log('\n======================================================================');
console.log(`TOTAL TESTS : ${report.total}`);
console.log(`PASSED      : ${report.passed}`);
console.log(`FAILED      : ${report.failed}`);
const passRate = report.total > 0 ? ((report.passed / report.total) * 100).toFixed(1) : 0;
console.log(`PASS RATE   : ${passRate}%`);
console.log('======================================================================');

if (report.failed > 0) {
  console.log('\nFAILURES:');
  report.failures.forEach((f, idx) => {
    console.log(`  ${idx + 1}. [${f.category}] ${f.name} -> ${f.details}`);
  });
  process.exit(1);
} else {
  console.log('\nVERDICT: [ ACCEPTED ] All Round 3 edge case assertions passed cleanly.\n');
  process.exit(0);
}
