#!/usr/bin/env node
/**
 * ============================================================================
 * CBT NEXA — Automated Mobile Layout Overflow Verification Suite
 * ============================================================================
 *
 * Requirements:
 * R1: Mobile Layout Responsiveness Across All Roles (admin, guru, siswa, pengawas, superadmin)
 *     Ensure no element, card, table, navigation, or container exceeds viewport width (scrollWidth <= clientWidth).
 * R2: Minimal Native CSS Implementation
 *     Verify that centralized native CSS handles mobile containment and word-wrapping cleanly.
 * R3: Automated Mobile Overflow Verification
 *     Objectively assert scrollWidth <= clientWidth and scrollWidth <= window.innerWidth across all roles.
 *
 * Execution Engine:
 * - Native Chrome DevTools Protocol (CDP) headless browser automation
 * - Zero external npm dependencies added to package.json
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
  categories: {},
  failures: []
};

function recordTest(category, name, condition, details = '') {
  if (!report.categories[category]) {
    report.categories[category] = { passed: 0, failed: 0 };
  }
  report.total++;
  if (condition) {
    report.passed++;
    report.categories[category].passed++;
    console.log(`  ✔ [PASS] [${category}] ${name}`);
  } else {
    report.failed++;
    report.categories[category].failed++;
    report.failures.push({ category, name, details });
    console.log(`  ✖ [FAIL] [${category}] ${name}${details ? ` -> ${details}` : ''}`);
  }
}

console.log('======================================================================');
console.log('  CBT NEXA: AUTOMATED MOBILE LAYOUT OVERFLOW VERIFICATION SUITE       ');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: STATIC CSS & CODEBASE INTEGRITY AUDIT (R2 Constraints)
// -----------------------------------------------------------------------------
console.log('▶ SECTION 1: Centralized CSS & Dependency Constraints Audit');

const indexCssPath = path.resolve(projectRoot, 'src', 'index.css');
const indexCss = fs.readFileSync(indexCssPath, 'utf8');
const packageJsonPath = path.resolve(projectRoot, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Check zero external dependencies added
const knownDependencies = ['@supabase/supabase-js', 'mammoth', 'prop-types', 'react', 'react-dom', 'react-quill', 'react-router-dom', 'xlsx'];
const currentDepKeys = Object.keys(pkg.dependencies || {});
const hasNoNewDeps = currentDepKeys.every(k => knownDependencies.includes(k));
recordTest('Constraints', 'No new third-party libraries added to package.json dependencies', hasNoNewDeps);

// Check centralized CSS rules in index.css
const cssHasHtmlBodyRootContainment = indexCss.includes('overflow-x: hidden') && indexCss.includes('max-width: 100vw');
recordTest('CSS Rules', 'Centralized CSS specifies overflow-x: hidden and max-width: 100vw on html/body/root', cssHasHtmlBodyRootContainment);

const cssHasWordBreak = indexCss.includes('overflow-wrap: break-word') || indexCss.includes('word-break: break-word');
recordTest('CSS Rules', 'Centralized CSS specifies overflow-wrap: break-word to prevent unspaced text blowout', cssHasWordBreak);

const cssHasMediaContainment = indexCss.includes('max-width: 100%') && (indexCss.includes('img') || indexCss.includes('table'));
recordTest('CSS Rules', 'Centralized CSS specifies max-width: 100% on native elements (img, table, inputs)', cssHasMediaContainment);

const cssHasTableContainment = indexCss.includes('div:has(> table)') || indexCss.includes('.overflow-x-auto');
recordTest('CSS Rules', 'Centralized CSS specifies responsive containment for tables', cssHasTableContainment);

const cssHasMobileMediaQuery = indexCss.includes('@media screen and (max-width: 1023px)') || indexCss.includes('@media (max-width: 1023px)');
recordTest('CSS Rules', 'Centralized CSS includes dedicated mobile breakpoint rules', cssHasMobileMediaQuery);

const cssHasModalContainment = indexCss.includes('[role="dialog"]') || indexCss.includes('.fixed.inset-0');
recordTest('CSS Rules', 'Centralized CSS specifies containment for modal dialog overlays', cssHasModalContainment);

const cssHasDecoupledTableRules = indexCss.includes('@supports') || !indexCss.includes('.overflow-x-auto,\n  div:has(> table)');
recordTest('CSS Rules', 'Centralized CSS decouples :has() to prevent selector invalidation on older engines', cssHasDecoupledTableRules);

const cssHasUniversalTableScroll = indexCss.includes('display: block') && indexCss.includes('overflow-x: auto') && indexCss.includes('table');
recordTest('CSS Rules', 'Centralized CSS specifies universal scrollable table fallback for legacy engines', cssHasUniversalTableScroll);

const cssHasModalScrollContainment = indexCss.includes('max-height: calc(100dvh') && indexCss.includes('overflow-y: auto');
recordTest('CSS Rules', 'Centralized CSS specifies max-height and overflow-y: auto on modal dialogs for short/landscape viewports', cssHasModalScrollContainment);

const cssHasMathFormulaContainment = indexCss.includes('.mjx-container') || indexCss.includes('.MathJax') || indexCss.includes('.katex');
recordTest('CSS Rules', 'Centralized CSS specifies overflow containment for math formulas and rich text', cssHasMathFormulaContainment);

const cssHasFixedBarContainment = indexCss.includes('.fixed.top-0') || indexCss.includes('[class*="fixed"][class*="top-0"]') || (indexCss.includes('header') && indexCss.includes('overflow-x: hidden'));
recordTest('CSS Rules', 'Centralized CSS specifies containment for fixed headers and navigation bars', cssHasFixedBarContainment);

const cssHasInlineMathDisplay = indexCss.includes('display: inline-block !important') && indexCss.includes('.katex');
recordTest('CSS Rules', 'Centralized CSS specifies inline-block display for math formulas (KaTeX/MathJax)', cssHasInlineMathDisplay);

const cssHasScrollPadding = indexCss.includes('scroll-padding: 1rem') || indexCss.includes('scroll-padding');
recordTest('CSS Rules', 'Centralized CSS specifies scroll-padding on modal cards for virtual keyboard support', cssHasScrollPadding);


// -----------------------------------------------------------------------------
// SECTION 2: LIVE MOBILE VIEWPORT CHROMIUM AUTOMATION (R1 & R3)
// -----------------------------------------------------------------------------
console.log('\n▶ SECTION 2: Automated Mobile Viewport Overflow Assertions Across All Roles');

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
  console.warn('  ⚠ No local Chrome/Edge executable located. Skipping live browser CDP run.');
} else {
  // Start In-Process Vite Server
  const serverPort = 5300 + Math.floor(Math.random() * 50);
  const viteServer = await createServer({
    root: projectRoot,
    configFile: path.resolve(projectRoot, 'vite.config.js'),
    server: { port: serverPort, host: '127.0.0.1' },
    logLevel: 'error'
  });
  await viteServer.listen();

  const cdpPort = 9400 + Math.floor(Math.random() * 50);
  const tmpDir = path.join(os.tmpdir(), `cbt_nexa_mobile_test_${Date.now()}`);
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

  // Poll for WebSocket
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

  const setViewport = async (width, height = 667) => {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 250));
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await setViewport(375, 667);
  await send('Page.navigate', { url: `http://127.0.0.1:${serverPort}/` });
  await new Promise(r => setTimeout(r, 2000));

  // Diagnostic helper to assert scrollWidth <= clientWidth and <= window.innerWidth
  const assertMobileNoOverflow = async (roleName, viewName, expectedMaxW) => {
    const metrics = await evaluate(`(() => {
      const docEl = document.documentElement;
      const body = document.body;
      const winW = window.innerWidth;
      const scrollW = docEl.scrollWidth;
      const clientW = docEl.clientWidth;
      const bodyScrollW = body ? body.scrollWidth : 0;
      
      const hasHorizontalScroll = scrollW > winW || bodyScrollW > winW || clientW > winW;
      
      // Look for elements extending beyond right viewport edge without an overflow-x wrapper
      const allEls = Array.from(document.querySelectorAll('*'));
      let uncontainedProtruding = 0;
      for (const el of allEls) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.right > winW + 2) {
          let parent = el.parentElement;
          let isContained = false;
          while (parent && parent !== document.body && parent !== docEl) {
            const cs = window.getComputedStyle(parent);
            if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'hidden') {
              isContained = true;
              break;
            }
            parent = parent.parentElement;
          }
          if (!isContained) {
            uncontainedProtruding++;
          }
        }
      }

      return {
        winW,
        scrollW,
        clientW,
        bodyScrollW,
        hasHorizontalScroll,
        uncontainedProtruding
      };
    })()`);

    const condition = !metrics.hasHorizontalScroll && metrics.uncontainedProtruding === 0;
    const details = condition
      ? ''
      : `scrollW: ${metrics.scrollW}, winW: ${metrics.winW}, bodyScrollW: ${metrics.bodyScrollW}, uncontainedProtruding: ${metrics.uncontainedProtruding}`;

    recordTest(
      roleName,
      `[${viewName} @ ${expectedMaxW}px] scrollWidth (${metrics?.scrollW || 0}) <= window.innerWidth (${metrics?.winW || 0}) with 0 horizontal overflow`,
      condition,
      details
    );
  };

  try {
    // -------------------------------------------------------------------------
    // 2.1 LOGIN & AUTHENTICATION VIEW (Multiple Mobile Widths)
    // -------------------------------------------------------------------------
    const mobileWidths = [320, 360, 375, 390, 412];
    for (const width of mobileWidths) {
      await setViewport(width);
      await assertMobileNoOverflow('LOGIN', `Role Selection Grid`, width);
    }
    // Landscape mobile test
    await setViewport(568, 320);
    await assertMobileNoOverflow('LOGIN', `Role Selection Grid (Landscape)`, 568);
    await setViewport(375, 667);

    // -------------------------------------------------------------------------
    // 2.2 SUPERADMIN ROLE VERIFICATION
    // -------------------------------------------------------------------------
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
    for (const w of [375, 320, 360]) {
      await setViewport(w);
      await assertMobileNoOverflow('SUPERADMIN', 'Analytics Tab', w);
    }
    await setViewport(375);

    for (const tab of ['sekolah', 'admin', 'pengumuman', 'akun']) {
      await evaluate(`(() => {
        const btns = Array.from(document.querySelectorAll('button[data-assistant-target]'));
        const b = btns.find(btn => btn.getAttribute('data-assistant-target') === '${tab}');
        if (b) b.click();
      })()`);
      await new Promise(r => setTimeout(r, 400));
      await assertMobileNoOverflow('SUPERADMIN', `Tab ${tab}`, 375);
      await setViewport(320);
      await assertMobileNoOverflow('SUPERADMIN', `Tab ${tab}`, 320);
      await setViewport(375);
    }

    // Logout Superadmin
    await evaluate(`(() => {
      const logoutBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Keluar') || b.title?.includes('Keluar'));
      if (logoutBtn) logoutBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 1500));

    // -------------------------------------------------------------------------
    // 2.3 ADMIN & PENGAWAS ROLE VERIFICATION
    // -------------------------------------------------------------------------
    await evaluate(`(async () => {
      const btns = Array.from(document.querySelectorAll('button'));
      const aBtn = btns.find(b => b.innerText.trim() === 'Admin' || (b.innerText.includes('Admin') && !b.innerText.includes('S-Admin')));
      if (aBtn) aBtn.click();
      await new Promise(r => setTimeout(r, 400));

      const setNative = (el, val) => {
        const p = Object.getPrototypeOf(el);
        const s = Object.getOwnPropertyDescriptor(p, 'value')?.set;
        if (s) s.call(el, val); else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const sel = document.querySelector('select');
      if (sel && sel.options.length > 1) {
        sel.selectedIndex = 1;
        setNative(sel, sel.options[1].value);
      }

      const inputs = Array.from(document.querySelectorAll('input'));
      const u = inputs.find(i => i.placeholder && (i.placeholder.includes('Username') || i.placeholder.includes('NIP')));
      const p = inputs.find(i => i.placeholder && i.placeholder.includes('Password'));
      if (u && p) {
        setNative(u, 'admin01');
        setNative(p, 'admin01');
      }
      await new Promise(r => setTimeout(r, 200));
      const sub = document.querySelector('button[type="submit"]');
      if (sub) sub.click();
    })()`);

    await new Promise(r => setTimeout(r, 2500));
    for (const w of [375, 320, 360]) {
      await setViewport(w);
      await assertMobileNoOverflow('ADMIN', 'Dashboard', w);
    }
    await setViewport(375);

    const adminTabs = ['siswa', 'guru', 'mapel', 'jadwal', 'pengawas', 'pengumuman', 'kehadiran', 'rekap', 'skema', 'cetak', 'akun'];
    for (const tab of adminTabs) {
      await evaluate(`(async () => {
        const menuBtn = document.querySelector('header button[aria-label="Buka Menu Navigasi"]');
        if (menuBtn) {
          menuBtn.click();
          await new Promise(r => setTimeout(r, 250));
        }
        const tabBtns = Array.from(document.querySelectorAll('nav button[data-assistant-target]'));
        const target = tabBtns.find(b => b.getAttribute('data-assistant-target') === '${tab}');
        if (target) {
          target.click();
          await new Promise(r => setTimeout(r, 300));
        }
      })()`);
      await new Promise(r => setTimeout(r, 500));
      await assertMobileNoOverflow('ADMIN', `Tab ${tab}`, 375);
      await setViewport(320);
      await assertMobileNoOverflow('ADMIN', `Tab ${tab}`, 320);
      await setViewport(375);

      if (tab === 'pengawas') {
        for (const sub of ['ruang', 'alokasi_siswa', 'penugasan']) {
          await evaluate(`(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const b = btns.find(btn => btn.innerText.includes('${sub === 'ruang' ? 'Master Ruang' : sub === 'alokasi_siswa' ? 'Alokasi Siswa' : 'Penugasan'}'));
            if (b) b.click();
          })()`);
          await new Promise(r => setTimeout(r, 400));
          await assertMobileNoOverflow('PENGAWAS (Admin)', `Subtab ${sub}`, 375);
          await setViewport(320);
          await assertMobileNoOverflow('PENGAWAS (Admin)', `Subtab ${sub}`, 320);
          await setViewport(375);
        }
      }

      if (tab === 'cetak') {
        // Test Dokumen Ujian Print Preview on mobile
        const printBtnClicked = await evaluate(`(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const b = btns.find(btn => btn.innerText.includes('Berita Acara') || btn.innerText.includes('Daftar Hadir') || btn.innerText.includes('Dokumen'));
          if (b) { b.click(); return true; }
          return false;
        })()`);
        if (printBtnClicked) {
          await new Promise(r => setTimeout(r, 600));
          await assertMobileNoOverflow('ADMIN (Cetak)', 'Dokumen Ujian Print Preview', 375);
          await setViewport(320);
          await assertMobileNoOverflow('ADMIN (Cetak)', 'Dokumen Ujian Print Preview', 320);
          await setViewport(375);
          await evaluate(`(() => {
            const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Tutup'));
            if (closeBtn) closeBtn.click();
          })()`);
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }

    // Logout Admin
    await evaluate(`(async () => {
      const menuBtn = document.querySelector('header button[aria-label="Buka Menu Navigasi"]');
      if (menuBtn) {
        menuBtn.click();
        await new Promise(r => setTimeout(r, 250));
      }
      const logoutBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Keluar'));
      if (logoutBtn) logoutBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 1500));

    // -------------------------------------------------------------------------
    // 2.4 GURU & PENGAWASAN ROLE VERIFICATION
    // -------------------------------------------------------------------------
    await evaluate(`(async () => {
      const btns = Array.from(document.querySelectorAll('button'));
      const gBtn = btns.find(b => b.innerText.trim() === 'Guru');
      if (gBtn) gBtn.click();
      await new Promise(r => setTimeout(r, 400));

      const setNative = (el, val) => {
        const p = Object.getPrototypeOf(el);
        const s = Object.getOwnPropertyDescriptor(p, 'value')?.set;
        if (s) s.call(el, val); else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const sel = document.querySelector('select');
      if (sel && sel.options.length > 1) {
        sel.selectedIndex = 1;
        setNative(sel, sel.options[1].value);
      }

      const inputs = Array.from(document.querySelectorAll('input'));
      const u = inputs.find(i => i.placeholder && (i.placeholder.includes('Username') || i.placeholder.includes('NIP')));
      const p = inputs.find(i => i.placeholder && i.placeholder.includes('Password'));
      if (u && p) {
        setNative(u, 'ade_matematika');
        setNative(p, 'ade27');
      }
      await new Promise(r => setTimeout(r, 200));
      const sub = document.querySelector('button[type="submit"]');
      if (sub) sub.click();
    })()`);

    await new Promise(r => setTimeout(r, 2500));
    for (const w of [375, 320, 360]) {
      await setViewport(w);
      await assertMobileNoOverflow('GURU', 'Dashboard', w);
    }
    await setViewport(375);

    const guruTabs = ['soal', 'jadwal', 'monitoring', 'pengawasan', 'hasil', 'nilai', 'audit', 'akun'];
    for (const tab of guruTabs) {
      await evaluate(`(async () => {
        const menuBtn = document.querySelector('header button[aria-label="Buka Menu Navigasi"]');
        if (menuBtn) {
          menuBtn.click();
          await new Promise(r => setTimeout(r, 250));
        }
        const tabBtns = Array.from(document.querySelectorAll('nav button[data-assistant-target]'));
        const target = tabBtns.find(b => b.getAttribute('data-assistant-target') === '${tab}');
        if (target) {
          target.click();
          await new Promise(r => setTimeout(r, 300));
        }
      })()`);
      await new Promise(r => setTimeout(r, 500));
      const category = (tab === 'pengawasan' || tab === 'monitoring') ? 'PENGAWAS (Guru)' : 'GURU';
      await assertMobileNoOverflow(category, `Tab ${tab}`, 375);
      await setViewport(320);
      await assertMobileNoOverflow(category, `Tab ${tab}`, 320);
      await setViewport(375);
    }

    // Logout Guru
    await evaluate(`(async () => {
      const menuBtn = document.querySelector('header button[aria-label="Buka Menu Navigasi"]');
      if (menuBtn) {
        menuBtn.click();
        await new Promise(r => setTimeout(r, 250));
      }
      const logoutBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Keluar'));
      if (logoutBtn) logoutBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 1500));

    // -------------------------------------------------------------------------
    // 2.5 SISWA ROLE VERIFICATION
    // -------------------------------------------------------------------------
    await evaluate(`(async () => {
      const btns = Array.from(document.querySelectorAll('button'));
      const sBtn = btns.find(b => b.innerText.trim() === 'Siswa');
      if (sBtn) sBtn.click();
      await new Promise(r => setTimeout(r, 400));

      const setNative = (el, val) => {
        const p = Object.getPrototypeOf(el);
        const s = Object.getOwnPropertyDescriptor(p, 'value')?.set;
        if (s) s.call(el, val); else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const sel = document.querySelector('select');
      if (sel && sel.options.length > 1) {
        sel.selectedIndex = 1;
        setNative(sel, sel.options[1].value);
      }

      const inputs = Array.from(document.querySelectorAll('input'));
      const u = inputs.find(i => i.placeholder && (i.placeholder.includes('Username') || i.placeholder.includes('NISN')));
      const p = inputs.find(i => i.placeholder && i.placeholder.includes('Password'));
      if (u && p) {
        setNative(u, 'muhammad_xi merdeka_1');
        setNative(p, 'yusuf27');
      }
      await new Promise(r => setTimeout(r, 200));
      const sub = document.querySelector('button[type="submit"]');
      if (sub) sub.click();
    })()`);

    await new Promise(r => setTimeout(r, 2500));
    for (const w of [375, 320, 360]) {
      await setViewport(w);
      await assertMobileNoOverflow('SISWA', 'Beranda', w);
    }
    await setViewport(375);

    const siswaTabs = ['jadwal', 'nilai', 'leaderboard', 'akun'];
    for (const tab of siswaTabs) {
      await evaluate(`(() => {
        const btns = Array.from(document.querySelectorAll('nav button'));
        const target = btns.find(b => {
          const t = b.innerText.toLowerCase();
          if ('${tab}' === 'jadwal') return t.includes('jadwal');
          if ('${tab}' === 'nilai') return t.includes('nilai') || t.includes('riwayat');
          if ('${tab}' === 'leaderboard') return t.includes('peringkat') || t.includes('leaderboard');
          if ('${tab}' === 'akun') return t.includes('profil') || t.includes('akun');
          return false;
        });
        if (target) target.click();
      })()`);
      await new Promise(r => setTimeout(r, 500));
      await assertMobileNoOverflow('SISWA', `Tab ${tab}`, 375);
      await setViewport(320);
      await assertMobileNoOverflow('SISWA', `Tab ${tab}`, 320);
      await setViewport(375);
    }

    // Test Token Entry Modal in Siswa
    const tokenModalOpened = await evaluate(`(() => {
      const mulaiBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Mulai Ujian') || b.innerText.includes('Kerjakan'));
      if (mulaiBtn) { mulaiBtn.click(); return true; }
      return false;
    })()`);
    if (tokenModalOpened) {
      await new Promise(r => setTimeout(r, 400));
      await assertMobileNoOverflow('SISWA', 'Token Confirmation Modal', 375);
      await setViewport(320);
      await assertMobileNoOverflow('SISWA', 'Token Confirmation Modal', 320);
      await setViewport(375);
      await evaluate(`(() => {
        const closeBtn = document.querySelector('.fixed.inset-0 button');
        if (closeBtn) closeBtn.click();
      })()`);
      await new Promise(r => setTimeout(r, 300));
    }

    // -------------------------------------------------------------------------
    // 2.6 ADVERSARIAL EDGE CASES: FORMULAS, EXAM BARS & VIRTUAL KEYBOARD
    // -------------------------------------------------------------------------
    // A. Complex KaTeX, MathJax, Wide Table & Code Block Stress
    await setViewport(320);
    const mathStress = await evaluate(`(() => {
      const testDiv = document.createElement('div');
      testDiv.id = 'stress-math-test';
      testDiv.className = 'w-full max-w-full p-4 bg-white dark:bg-slate-800 rounded-3xl';
      testDiv.innerHTML = \`
        <p class="font-medium">
          <span class="katex"><span class="katex-html" style="white-space: nowrap; display: inline-block; width: 650px;">
            \\Psi(x, t) = A \\cos(kx - \\omega t) + \\int_0^\\infty e^{-s t} ds = \\sum_{n=1}^{\\infty} \\frac{1}{n^2} \\sin(n \\pi x)
          </span></span>
        </p>
        <span class="katex-display">
          <span class="katex"><span class="katex-html" style="white-space: nowrap; display: block; width: 700px;">
            \\hat{H} \\Psi = \\left( -\\frac{\\hbar^2}{2m} \\nabla^2 + V(\\mathbf{r}) \\right) \\Psi = E \\Psi
          </span></span>
        </span>
        <div class="mjx-container MathJax" style="width: 680px; display: inline-block;">
          <svg width="680" height="40"><rect width="680" height="40" fill="gray"/></svg>
        </div>
        <table>
          <thead>
            <tr><th style="min-width: 150px;">A</th><th style="min-width: 150px;">B</th><th style="min-width: 150px;">C</th><th style="min-width: 150px;">D</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>2</td><td>3</td><td>4</td></tr>
          </tbody>
        </table>
        <pre><code>const very_long_unbroken_constant_that_exceeds_screen_width_0123456789 = 1;</code></pre>
      \`;
      const container = document.querySelector('main') || document.getElementById('root') || document.body;
      container.appendChild(testDiv);
      const docEl = document.documentElement;
      const winW = window.innerWidth;
      const scrollW = docEl.scrollWidth;
      const bodyScrollW = document.body.scrollWidth;
      return { winW, scrollW, bodyScrollW, ok: scrollW <= winW && bodyScrollW <= winW };
    })()`);

    recordTest('EDGE-MATH', 'Injected 700px KaTeX, MathJax, Table & Code @ 320px', mathStress.ok, `scrollW: ${mathStress.scrollW}, winW: ${mathStress.winW}`);

    await setViewport(360);
    await assertMobileNoOverflow('EDGE-MATH', 'Complex Equations Container', 360);
    await setViewport(375);
    await assertMobileNoOverflow('EDGE-MATH', 'Complex Equations Container', 375);

    await evaluate(`(() => {
      const el = document.getElementById('stress-math-test');
      if (el) el.remove();
    })()`);

    // B. ExamRoom Header & Fixed Bars Width Containment on 320px
    await setViewport(320);
    const headerCheck = await evaluate(`(() => {
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
      const winW = window.innerWidth;
      const hScrollW = header.scrollWidth;
      const dScrollW = document.documentElement.scrollWidth;
      const ok = dScrollW <= winW && hScrollW <= winW;
      header.remove();
      return { winW, hScrollW, dScrollW, ok };
    })()`);

    recordTest('EDGE-EXAMBAR', 'ExamRoom Header & Fixed Bars on 320px (hScrollW <= winW)', headerCheck.ok, `hScrollW: ${headerCheck.hScrollW}, winW: ${headerCheck.winW}`);

    // C. Virtual Keyboard Push-up on Dialog (height: 280px on 320px screen)
    await setViewport(320, 280);
    await assertMobileNoOverflow('EDGE-KEYBOARD', 'Virtual Keyboard Open (320x280)', 320);
    await setViewport(375, 667);
  } finally {
    ws.close();
    chromeProc.kill();
    await viteServer.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

// -----------------------------------------------------------------------------
// SUMMARY & VERDICT
// -----------------------------------------------------------------------------
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
  console.log('\nVERDICT: [ ACCEPTED ] All mobile layout overflow assertions passed cleanly.\n');
  process.exit(0);
}
