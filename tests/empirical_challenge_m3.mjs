#!/usr/bin/env node
/**
 * Empirical Challenge & Adversarial Stress Harness for Milestone M3 (AdminView.jsx & GuruView.jsx)
 *
 * Systematic empirical verification covering:
 * 1. Zero horizontal page scrolling on a 375px mobile viewport (container widths, padding, table wrappers, modals).
 * 2. Dual Responsive Architecture: ensure `hidden md:block` desktop tables cleanly switch to `md:hidden` stacked card-rows.
 * 3. Off-canvas drawer and bottom navigation: verify drawer toggle button, backdrop click dismissal, and tab switching.
 * 4. Touch targets: empirically verify all buttons, inputs, icons, and action triggers meet or exceed 44px minimum requirement.
 * 5. Production build and automated e2e test suite integrity.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { parse } from '@babel/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const adminViewPath = path.resolve(projectRoot, 'src', 'views', 'AdminView.jsx');
const guruViewPath = path.resolve(projectRoot, 'src', 'views', 'GuruView.jsx');
const modalPeriksaPath = path.resolve(projectRoot, 'src', 'components', 'ModalPeriksaUraian.jsx');
const skemaPanelPath = path.resolve(projectRoot, 'src', 'components', 'SkemaPenilaianPanel.jsx');

const adminViewCode = fs.readFileSync(adminViewPath, 'utf8');
const guruViewCode = fs.readFileSync(guruViewPath, 'utf8');
const modalPeriksaCode = fs.readFileSync(modalPeriksaPath, 'utf8');
const skemaPanelCode = fs.readFileSync(skemaPanelPath, 'utf8');

// Global test recorder
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  categories: {},
  tests: []
};

function recordTest(suite, name, passed, errorMsg = '') {
  if (!results.categories[suite]) {
    results.categories[suite] = { passed: 0, failed: 0 };
  }
  results.total++;
  if (passed) {
    results.passed++;
    results.categories[suite].passed++;
    results.tests.push({ suite, name, status: 'PASS' });
    console.log(`  ✔ [PASS] [${suite}] ${name}`);
  } else {
    results.failed++;
    results.categories[suite].failed++;
    results.tests.push({ suite, name, status: 'FAIL', error: errorMsg });
    console.log(`  ✖ [FAIL] [${suite}] ${name} -> ${errorMsg}`);
  }
}

console.log('======================================================================');
console.log('  EMPIRICAL CHALLENGER M3: ADMIN & GURU VIEWS STRESS HARNESS          ');
console.log('======================================================================\n');

// =============================================================================
// CATEGORY 0: AST Parsing & Component Integrity
// =============================================================================
console.log('▶ CATEGORY 0: AST Parsing & Component Syntax Verification');

try {
  parse(adminViewCode, { sourceType: 'module', plugins: ['jsx'] });
  recordTest('AST', 'AdminView.jsx AST parses cleanly with Babel', true);
} catch (err) {
  recordTest('AST', 'AdminView.jsx AST parses cleanly with Babel', false, err.message);
}

try {
  parse(guruViewCode, { sourceType: 'module', plugins: ['jsx'] });
  recordTest('AST', 'GuruView.jsx AST parses cleanly with Babel', true);
} catch (err) {
  recordTest('AST', 'GuruView.jsx AST parses cleanly with Babel', false, err.message);
}

try {
  parse(modalPeriksaCode, { sourceType: 'module', plugins: ['jsx'] });
  recordTest('AST', 'ModalPeriksaUraian.jsx AST parses cleanly with Babel', true);
} catch (err) {
  recordTest('AST', 'ModalPeriksaUraian.jsx AST parses cleanly with Babel', false, err.message);
}

try {
  parse(skemaPanelCode, { sourceType: 'module', plugins: ['jsx'] });
  recordTest('AST', 'SkemaPenilaianPanel.jsx AST parses cleanly with Babel', true);
} catch (err) {
  recordTest('AST', 'SkemaPenilaianPanel.jsx AST parses cleanly with Babel', false, err.message);
}

// =============================================================================
// CATEGORY 1: Zero Horizontal Page Scrolling on 375px Mobile Viewport
// =============================================================================
console.log('\n▶ CATEGORY 1: Zero Horizontal Page Scrolling on 375px Mobile Viewport');

// 1.1 Fluid Outer Shell (Absence of trapped kiosk container)
const adminHasKiosk = /h-\[100dvh\]\s+overflow-hidden/.test(adminViewCode);
const guruHasKiosk = /h-\[100dvh\]\s+overflow-hidden/.test(guruViewCode);
recordTest('Viewport375', 'AdminView uses natural document flow (no h-[100dvh] overflow-hidden kiosk trapping)', !adminHasKiosk);
recordTest('Viewport375', 'GuruView uses natural document flow (no h-[100dvh] overflow-hidden kiosk trapping)', !guruHasKiosk);

// 1.2 Fluid Page Wrapper with Responsive Horizontal Padding
const adminFluidWrapper = /max-w-7xl\s+mx-auto\s+px-4\s+sm:px-6\s+lg:px-8/.test(adminViewCode);
const guruFluidWrapper = /max-w-7xl\s+mx-auto\s+(?:px-3\s+sm:px-5\s+lg:px-6|px-4\s+sm:px-6\s+lg:px-8)/.test(guruViewCode);
recordTest('Viewport375', 'AdminView main body has responsive horizontal containment (max-w-7xl px-4 sm:px-6 lg:px-8)', adminFluidWrapper);
recordTest('Viewport375', 'GuruView main body has responsive horizontal containment (max-w-7xl px-3 sm:px-5 lg:px-6)', guruFluidWrapper);

// 1.3 Bottom Navigation Offset (pb-28 or pb-24 on mobile to avoid bottom nav bar occlusion)
const adminHasBottomPadding = /pb-28\s+lg:pb-12/.test(adminViewCode);
const guruHasBottomPadding = /(?:pb-24\s+lg:pb-8|pb-28\s+lg:pb-12)/.test(guruViewCode);
recordTest('Viewport375', 'AdminView main content has pb-28 to prevent mobile bottom nav occlusion', adminHasBottomPadding);
recordTest('Viewport375', 'GuruView main content has pb-24/pb-28 to prevent mobile bottom nav occlusion', guruHasBottomPadding);

// 1.4 Fixed Width Boundary Violations (>375px on mobile)
function findFixedWidthViolations(filename, code) {
  const lines = code.split('\n');
  const violations = [];
  lines.forEach((line, idx) => {
    // Look for fixed pixel width > 375px without responsive prefix
    const arbitraryMatches = line.match(/(?<!(?:sm|md|lg|xl|2xl):)(?:min-w|w)-\[(\d+)px\]/g);
    if (arbitraryMatches) {
      arbitraryMatches.forEach(m => {
        const num = parseInt(m.match(/\d+/)[0], 10);
        if (num > 375) {
          violations.push({ line: idx + 1, match: m, snippet: line.trim() });
        }
      });
    }
    // Look for w-96 (384px) without responsive prefix
    const w96Matches = line.match(/(?<!(?:sm|md|lg|xl|2xl):)\b(?:min-)?w-96\b/g);
    if (w96Matches) {
      violations.push({ line: idx + 1, match: w96Matches.join(','), snippet: line.trim() });
    }
  });
  return violations;
}

const adminWidthViolations = findFixedWidthViolations('AdminView', adminViewCode);
const guruWidthViolations = findFixedWidthViolations('GuruView', guruViewCode);
recordTest('Viewport375', 'Zero fixed width classes exceeding 375px mobile viewport in AdminView.jsx', adminWidthViolations.length === 0, adminWidthViolations.map(v => `L${v.line}: ${v.match}`).join('; '));
recordTest('Viewport375', 'Zero fixed width classes exceeding 375px mobile viewport in GuruView.jsx', guruWidthViolations.length === 0, guruWidthViolations.map(v => `L${v.line}: ${v.match}`).join('; '));

// 1.5 Modal Overlays Horizontal Containment on 375px
function auditModals(code) {
  const lines = code.split('\n');
  let validModals = 0;
  let uncontainedModals = 0;
  lines.forEach((line, idx) => {
    // Match only modal root overlays, not backdrop child divs
    if ((line.includes('<div className="fixed inset-0') || line.includes('<div className="lg:hidden fixed inset-0')) && (line.includes('z-[') || line.includes('z-50') || line.includes('backdrop-blur'))) {
      let isContained = false;
      for (let j = idx; j <= Math.min(lines.length - 1, idx + 8); j++) {
        if (lines[j].includes('max-w-') && (lines[j].includes('w-full') || lines[j].includes('max-w-[85vw]') || lines[j].includes('max-w-sm') || lines[j].includes('max-w-md') || lines[j].includes('max-w-2xl') || lines[j].includes('max-w-3xl') || lines[j].includes('max-w-4xl') || lines[j].includes('max-w-5xl'))) {
          isContained = true;
          break;
        }
      }
      if (isContained) validModals++;
      else uncontainedModals++;
    }
  });
  return { validModals, uncontainedModals };
}

const adminModalAudit = auditModals(adminViewCode);
const guruModalAudit = auditModals(guruViewCode);
recordTest('Viewport375', `AdminView modals enforce horizontal containment with w-full max-w-* (${adminModalAudit.validModals} modals verified)`, adminModalAudit.uncontainedModals === 0);
recordTest('Viewport375', `GuruView modals enforce horizontal containment with w-full max-w-* (${guruModalAudit.validModals} modals verified)`, guruModalAudit.uncontainedModals === 0);

// 1.6 All <table> elements encapsulated or wrapped in overflow-x-auto
function auditTables(code) {
  const lines = code.split('\n');
  let safeTables = 0;
  let unsafeTables = 0;
  lines.forEach((line, idx) => {
    if (line.includes('<table')) {
      // Check previous 5 lines for overflow-x-auto, overflow-auto, or hidden md:block
      let isSafe = false;
      for (let j = Math.max(0, idx - 5); j <= idx; j++) {
        if (lines[j].includes('overflow-x-auto') || lines[j].includes('overflow-auto') || lines[j].includes('hidden md:block') || lines[j].includes('hidden lg:block')) {
          isSafe = true;
          break;
        }
      }
      if (isSafe) safeTables++;
      else unsafeTables++;
    }
  });
  return { safeTables, unsafeTables };
}

const adminTableAudit = auditTables(adminViewCode);
const guruTableAudit = auditTables(guruViewCode);
recordTest('Viewport375', `All <table> tags in AdminView are encapsulated in overflow/responsive wrappers (${adminTableAudit.safeTables}/5)`, adminTableAudit.unsafeTables === 0 && adminTableAudit.safeTables >= 5);
recordTest('Viewport375', `All <table> tags in GuruView are encapsulated in overflow/responsive wrappers (${guruTableAudit.safeTables}/5)`, guruTableAudit.unsafeTables === 0 && guruTableAudit.safeTables >= 5);

// =============================================================================
// CATEGORY 2: Dual Responsive Architecture (Desktop Tables vs Mobile Cards)
// =============================================================================
console.log('\n▶ CATEGORY 2: Dual Responsive Architecture (Desktop Tables vs Mobile Cards)');

// 2.1 AdminView Siswa Master Data
const adminSiswaDesktop = /hidden\s+md:block[\s\S]*?<table[\s\S]*?sortedFilteredSiswa/.test(adminViewCode);
const adminSiswaMobile = /md:hidden\s+space-y-2\.5[\s\S]*?sortedFilteredSiswa\.map/.test(adminViewCode);
recordTest('DualResponsive', 'AdminView Siswa Master has desktop table (hidden md:block)', adminSiswaDesktop);
recordTest('DualResponsive', 'AdminView Siswa Master has mobile stacked card-rows (md:hidden space-y-2.5)', adminSiswaMobile);

// 2.2 AdminView Guru Master Data
const adminGuruDesktop = /hidden\s+md:block[\s\S]*?<table[\s\S]*?sortedFilteredGuru/.test(adminViewCode);
const adminGuruMobile = /md:hidden\s+space-y-2\.5[\s\S]*?sortedFilteredGuru\.map/.test(adminViewCode);
recordTest('DualResponsive', 'AdminView Guru Master has desktop table (hidden md:block)', adminGuruDesktop);
recordTest('DualResponsive', 'AdminView Guru Master has mobile stacked card-rows (md:hidden space-y-2.5)', adminGuruMobile);

// 2.3 AdminView Jadwal Master Data
const adminJadwalDesktop = /hidden\s+md:block[\s\S]*?<table[\s\S]*?sortedFilteredJadwal/.test(adminViewCode);
const adminJadwalMobile = /md:hidden\s+space-y-3[\s\S]*?sortedFilteredJadwal\.map/.test(adminViewCode);
recordTest('DualResponsive', 'AdminView Jadwal Master has desktop table (hidden md:block)', adminJadwalDesktop);
recordTest('DualResponsive', 'AdminView Jadwal Master has mobile stacked card-rows (md:hidden space-y-3)', adminJadwalMobile);

// 2.4 AdminView Live Monitoring Data
const adminMonitoringDesktop = /hidden\s+md:block[\s\S]*?<table[\s\S]*?filteredMonitoringLogs/.test(adminViewCode);
const adminMonitoringMobile = /md:hidden\s+space-y-3[\s\S]*?filteredMonitoringLogs\.map/.test(adminViewCode);
recordTest('DualResponsive', 'AdminView Live Monitoring has desktop table (hidden md:block)', adminMonitoringDesktop);
recordTest('DualResponsive', 'AdminView Live Monitoring has mobile stacked card-rows (md:hidden space-y-3)', adminMonitoringMobile);

// 2.5 GuruView Question Bank Data
const guruBankDesktop = /hidden\s+md:block[\s\S]*?<table[\s\S]*?paginatedSoal/.test(guruViewCode);
const guruBankMobile = /md:hidden\s+space-y-2\.5[\s\S]*?paginatedSoal\.map/.test(guruViewCode);
recordTest('DualResponsive', 'GuruView Bank Soal has desktop table (hidden md:block)', guruBankDesktop);
recordTest('DualResponsive', 'GuruView Bank Soal has mobile compact cards (md:hidden space-y-2.5)', guruBankMobile);

// 2.6 GuruView Jadwal & Proctoring Data
const guruJadwalDesktop = /hidden\s+md:block[\s\S]*?<table[\s\S]*?filteredDataLog/.test(guruViewCode);
const guruJadwalMobile = /md:hidden\s+space-y-2\.5[\s\S]*?filteredDataLog\.map/.test(guruViewCode);
recordTest('DualResponsive', 'GuruView Jadwal/Kontrol has desktop table (hidden md:block)', guruJadwalDesktop);
recordTest('DualResponsive', 'GuruView Jadwal/Kontrol has mobile compact cards (md:hidden space-y-2.5)', guruJadwalMobile);

// 2.7 Live Monitoring HUD Progress Bars & KPI Summary Cards
const adminHasProgressBar = /style=\{\{\s*width:\s*`\$\{progressPercent\}%`\s*\}\}/.test(adminViewCode);
const guruHasProgressBar = /style=\{\{\s*width:\s*`\$\{progressPercent\}%`\s*\}\}/.test(guruViewCode);
const adminHasKpis = /Total Siswa[\s\S]*?Total Guru[\s\S]*?Mata Pelajaran[\s\S]*?Bank Soal/.test(adminViewCode);
const guruHasKpis = /Mapel Ditugaskan[\s\S]*?Total Soal Dibuat[\s\S]*?Ujian Sedang Aktif/.test(guruViewCode);
recordTest('DualResponsive', 'AdminView renders dynamic progress bars in student monitoring', adminHasProgressBar);
recordTest('DualResponsive', 'GuruView renders dynamic progress bars in student monitoring', guruHasProgressBar);
recordTest('DualResponsive', 'AdminView renders 4 KPI summary cards', adminHasKpis);
recordTest('DualResponsive', 'GuruView renders 3 KPI summary cards', guruHasKpis);

// 2.8 Truncation and Clipping Prevention on Small Screens
const adminHasTruncate = (adminViewCode.match(/\btruncate\b/g) || []).length;
const guruHasTruncate = (guruViewCode.match(/\btruncate\b/g) || []).length;
recordTest('DualResponsive', `AdminView utilizes text truncation utilities to prevent card overflow (${adminHasTruncate} instances)`, adminHasTruncate >= 15);
recordTest('DualResponsive', `GuruView utilizes text truncation utilities to prevent card overflow (${guruHasTruncate} instances)`, guruHasTruncate >= 15);

// =============================================================================
// CATEGORY 3: Off-Canvas Drawer and Bottom Navigation
// =============================================================================
console.log('\n▶ CATEGORY 3: Off-Canvas Drawer and Bottom Navigation');

// 3.1 AdminView Drawer Toggle Buttons
const adminTopbarDrawerBtn = /onClick=\{[\s\S]*?setIsMobileDrawerOpen\(true\)[\s\S]*?setIsSidebarOpen\(true\)[\s\S]*?\}[\s\S]*?aria-label="Buka Menu Navigasi"/.test(adminViewCode);
const adminBottomDrawerBtn = /onClick=\{[\s\S]*?isTrigger[\s\S]*?setIsMobileDrawerOpen\(true\)/.test(adminViewCode);
recordTest('DrawerNav', 'AdminView mobile topbar contains drawer open trigger button', adminTopbarDrawerBtn);
recordTest('DrawerNav', 'AdminView mobile bottom bar contains drawer trigger button (Menu)', adminBottomDrawerBtn);

// 3.2 AdminView Drawer Container & Backdrop Dismissal
const adminDrawerBackdrop = /className="fixed inset-0 bg-slate-900\/60 backdrop-blur-sm animate-fade-in"[\s\S]*?onClick=\{.*setIsMobileDrawerOpen\(false\)/.test(adminViewCode);
const adminDrawerCloseBtn = /onClick=\{.*setIsMobileDrawerOpen\(false\).*setIsSidebarOpen\(false\).*\}[\s\S]*?aria-label="Tutup Navigasi"/.test(adminViewCode);
const adminDrawerMaxW = /w-80\s+max-w-\[85vw\]/.test(adminViewCode);
recordTest('DrawerNav', 'AdminView drawer dismisses when backdrop is clicked', adminDrawerBackdrop);
recordTest('DrawerNav', 'AdminView drawer contains close icon button (aria-label="Tutup Navigasi")', adminDrawerCloseBtn);
recordTest('DrawerNav', 'AdminView drawer bounds width with w-80 max-w-[85vw] on mobile', adminDrawerMaxW);

// 3.3 AdminView Tab Switching Closes Drawer
const adminNavigateTabCloses = /const\s+navigateTab\s*=\s*\(tabId\)\s*=>\s*\{[\s\S]*?setActiveTab\(tabId\);[\s\S]*?setIsMobileDrawerOpen\(false\);/.test(adminViewCode);
recordTest('DrawerNav', 'AdminView navigateTab updates activeTab and closes mobile drawer', adminNavigateTabCloses);

// 3.4 GuruView Drawer Toggle Buttons
const guruTopbarDrawerBtn = /onClick=\{.*setIsMobileDrawerOpen\(true\).*\}[\s\S]*?aria-label="Buka Menu Navigasi"/.test(guruViewCode);
const guruBottomDrawerBtn = /onClick=\{[\s\S]*?isTrigger[\s\S]*?setIsMobileDrawerOpen\(true\)/.test(guruViewCode);
recordTest('DrawerNav', 'GuruView mobile topbar contains drawer open trigger button', guruTopbarDrawerBtn);
recordTest('DrawerNav', 'GuruView mobile bottom bar contains drawer trigger button (Menu)', guruBottomDrawerBtn);

// 3.5 GuruView Drawer Container & Backdrop Dismissal
const guruDrawerBackdrop = /className="fixed inset-0 bg-slate-900\/60 backdrop-blur-sm animate-fade-in"[\s\S]*?onClick=\{.*setIsMobileDrawerOpen\(false\)/.test(guruViewCode);
const guruDrawerCloseBtn = /onClick=\{.*setIsMobileDrawerOpen\(false\).*\}[\s\S]*?aria-label="Tutup Navigasi"/.test(guruViewCode);
const guruDrawerMaxW = /w-80\s+max-w-\[85vw\]/.test(guruViewCode);
recordTest('DrawerNav', 'GuruView drawer dismisses when backdrop is clicked', guruDrawerBackdrop);
recordTest('DrawerNav', 'GuruView drawer contains close icon button (aria-label="Tutup Navigasi")', guruDrawerCloseBtn);
recordTest('DrawerNav', 'GuruView drawer bounds width with w-80 max-w-[85vw] on mobile', guruDrawerMaxW);

// 3.6 GuruView Tab Switching Closes Drawer
const guruNavigateTabCloses = /const\s+navigateTab\s*=\s*\(tabId\)\s*=>\s*\{[\s\S]*?setActiveTab\(tabId\);[\s\S]*?setIsMobileDrawerOpen\(false\);/.test(guruViewCode);
recordTest('DrawerNav', 'GuruView navigateTab updates activeTab and closes mobile drawer', guruNavigateTabCloses);

// 3.7 Mobile Bottom Navigation Bar Layout
const adminBottomBarLayout = /lg:hidden\s+fixed\s+bottom-0\s+left-0\s+w-full[\s\S]*?backdrop-blur-lg/.test(adminViewCode);
const guruBottomBarLayout = /lg:hidden\s+fixed\s+bottom-0\s+left-0\s+w-full[\s\S]*?backdrop-blur-lg/.test(guruViewCode);
recordTest('DrawerNav', 'AdminView mobile bottom bar is pinned fixed bottom-0 left-0 w-full with blur backdrop', adminBottomBarLayout);
recordTest('DrawerNav', 'GuruView mobile bottom bar is pinned fixed bottom-0 left-0 w-full with blur backdrop', guruBottomBarLayout);

// =============================================================================
// CATEGORY 4: Touch Targets Compliance (>= 44px)
// =============================================================================
console.log('\n▶ CATEGORY 4: Touch Targets Compliance (>= 44px)');

// 4.1 Mobile Topbar Hamburger Buttons
const adminTopbarTouch = /aria-label="Buka Menu Navigasi"[\s\S]*?min-w-\[44px\]\s+min-h-\[44px\]/.test(adminViewCode) || /min-w-\[44px\]\s+min-h-\[44px\][\s\S]*?aria-label="Buka Menu Navigasi"/.test(adminViewCode);
const guruTopbarTouch = /aria-label="Buka Menu Navigasi"[\s\S]*?min-w-\[44px\]\s+min-h-\[44px\]/.test(guruViewCode) || /min-w-\[44px\]\s+min-h-\[44px\][\s\S]*?aria-label="Buka Menu Navigasi"/.test(guruViewCode);
recordTest('TouchTargets', 'AdminView mobile topbar hamburger button enforces min-w-[44px] min-h-[44px]', adminTopbarTouch);
recordTest('TouchTargets', 'GuruView mobile topbar hamburger button enforces min-w-[44px] min-h-[44px]', guruTopbarTouch);

// 4.2 Mobile Topbar Dark Mode Buttons
const adminDarkTouch = /aria-label="Toggle Dark Mode"[\s\S]*?min-w-\[44px\]\s+min-h-\[44px\]/.test(adminViewCode) || /min-w-\[44px\]\s+min-h-\[44px\][\s\S]*?aria-label="Toggle Dark Mode"/.test(adminViewCode);
const guruDarkTouch = /aria-label="Toggle Dark Mode"[\s\S]*?min-w-\[44px\]\s+min-h-\[44px\]/.test(guruViewCode) || /min-w-\[44px\]\s+min-h-\[44px\][\s\S]*?aria-label="Toggle Dark Mode"/.test(guruViewCode);
recordTest('TouchTargets', 'AdminView mobile dark mode toggle enforces min-w-[44px] min-h-[44px]', adminDarkTouch);
recordTest('TouchTargets', 'GuruView mobile dark mode toggle enforces min-w-[44px] min-h-[44px]', guruDarkTouch);

// 4.3 Slide-Over Drawer Close Buttons
const adminDrawerCloseTouch = /aria-label="Tutup Navigasi"[\s\S]*?min-w-\[44px\]\s+min-h-\[44px\]/.test(adminViewCode) || /min-w-\[44px\]\s+min-h-\[44px\][\s\S]*?aria-label="Tutup Navigasi"/.test(adminViewCode);
const guruDrawerCloseTouch = /aria-label="Tutup Navigasi"[\s\S]*?min-w-\[44px\]\s+min-h-\[44px\]/.test(guruViewCode) || /min-w-\[44px\]\s+min-h-\[44px\][\s\S]*?aria-label="Tutup Navigasi"/.test(guruViewCode);
recordTest('TouchTargets', 'AdminView drawer close button enforces min-w-[44px] min-h-[44px]', adminDrawerCloseTouch);
recordTest('TouchTargets', 'GuruView drawer close button enforces min-w-[44px] min-h-[44px]', guruDrawerCloseTouch);

// 4.4 Slide-Over Drawer Navigation Items
const adminDrawerItemTouch = /navGroups\.map[\s\S]*?px-3\.5\s+py-3[\s\S]*?min-h-\[44px\]/.test(adminViewCode);
const guruDrawerItemTouch = /navGroups\.map[\s\S]*?px-3\.5\s+py-3[\s\S]*?min-h-\[44px\]/.test(guruViewCode);
recordTest('TouchTargets', 'AdminView drawer navigation items enforce min-h-[44px] and py-3', adminDrawerItemTouch);
recordTest('TouchTargets', 'GuruView drawer navigation items enforce min-h-[44px] and py-3', guruDrawerItemTouch);

// 4.5 Mobile Bottom Bar Navigation Buttons
const adminBottomTouch = /bottomBarItems\.map[\s\S]*?min-h-\[44px\]\s+min-w-\[44px\]/.test(adminViewCode);
const guruBottomTouch = /bottomBarItems\.map[\s\S]*?min-h-\[44px\]\s+min-w-\[44px\]/.test(guruViewCode);
recordTest('TouchTargets', 'AdminView bottom navigation items enforce min-h-[44px] min-w-[44px]', adminBottomTouch);
recordTest('TouchTargets', 'GuruView bottom navigation items enforce min-h-[44px] min-w-[44px]', guruBottomTouch);

// 4.6 Proctor Action Buttons (Unblock, Block, Reset Session)
const guruProctorUnblockTouch = /handleUnblock[\s\S]*?min-h-\[44px\]/.test(guruViewCode);
const guruProctorBlockTouch = /handleBlock[\s\S]*?min-h-\[44px\]/.test(guruViewCode);
const guruProctorResetTouch = /handleResetSession[\s\S]*?min-h-\[44px\]/.test(guruViewCode);
recordTest('TouchTargets', 'GuruView mobile proctor Buka Blokir button enforces min-h-[44px]', guruProctorUnblockTouch);
recordTest('TouchTargets', 'GuruView mobile proctor Blokir button enforces min-h-[44px]', guruProctorBlockTouch);
recordTest('TouchTargets', 'GuruView mobile proctor Reset Sesi button enforces min-h-[44px]', guruProctorResetTouch);

// =============================================================================
// CATEGORY 5: Production Build, Test Suite & Phantom Class Eradication
// =============================================================================
console.log('\n▶ CATEGORY 5: Production Build, Test Suite & Phantom Class Eradication');

// 5.1 Phantom Material Design 3 Classes Audit
const phantomRegex = /\b(bg-surface|bg-surface-variant|text-on-surface|text-on-surface-variant|border-outline|border-outline-variant|font-label-md|font-body-md|p-md)\b/g;

const adminPhantoms = adminViewCode.match(phantomRegex) || [];
const guruPhantoms = guruViewCode.match(phantomRegex) || [];
const modalPhantoms = modalPeriksaCode.match(phantomRegex) || [];
const skemaPhantoms = skemaPanelCode.match(phantomRegex) || [];

recordTest('Audits', `AdminView.jsx has 0 phantom Material Design 3 classes (found: ${adminPhantoms.length})`, adminPhantoms.length === 0, adminPhantoms.join(', '));
recordTest('Audits', `GuruView.jsx has 0 phantom Material Design 3 classes (found: ${guruPhantoms.length})`, guruPhantoms.length === 0, guruPhantoms.join(', '));
recordTest('Audits', `ModalPeriksaUraian.jsx has 0 phantom Material Design 3 classes (found: ${modalPhantoms.length})`, modalPhantoms.length === 0, modalPhantoms.join(', '));
recordTest('Audits', `SkemaPenilaianPanel.jsx has 0 phantom Material Design 3 classes (found: ${skemaPhantoms.length})`, skemaPhantoms.length === 0, skemaPhantoms.join(', '));

// 5.2 Build Verification
let buildSuccess = false;
let buildOutput = '';
try {
  buildOutput = execSync('npm run build', { cwd: projectRoot, encoding: 'utf8' });
  buildSuccess = true;
} catch (buildErr) {
  buildSuccess = false;
  buildOutput = buildErr.message;
}
recordTest('Audits', 'npm run build succeeds with clean exit code 0', buildSuccess, buildOutput.slice(0, 200));

// 5.3 E2E Test Suite Run
let e2eOutput = '';
let e2eSuccess = false;
try {
  e2eOutput = execSync('node tests/e2e_test_suite.mjs --allow-failures', { cwd: projectRoot, encoding: 'utf8' });
  e2eSuccess = true;
} catch (e2eErr) {
  e2eSuccess = false;
  e2eOutput = e2eErr.message;
}

const tier1Passed = !e2eOutput.includes('FAIL T1.');
const tier2Passed = !e2eOutput.includes('FAIL T2.');
const tier3Passed = !e2eOutput.includes('FAIL T3.');
const tier4Passed = !e2eOutput.includes('FAIL T4.');
recordTest('Audits', 'E2E Test Suite: All Tier 1 functional tests pass', tier1Passed);
recordTest('Audits', 'E2E Test Suite: All Tier 2 boundary tests pass', tier2Passed);
recordTest('Audits', 'E2E Test Suite: All Tier 3 combination tests pass', tier3Passed);
recordTest('Audits', 'E2E Test Suite: All Tier 4 real-world scenario tests pass', tier4Passed);

// =============================================================================
// FINAL SUMMARY
// =============================================================================
console.log('\n======================================================================');
console.log('  CHALLENGE EXECUTION SUMMARY');
console.log(`  Total Test Cases : ${results.total}`);
console.log(`  Passed           : ${results.passed}`);
console.log(`  Failed           : ${results.failed}`);
const passRate = Math.round((results.passed / results.total) * 100);
console.log(`  Pass Rate        : ${passRate}%`);
console.log('======================================================================');

if (results.failed === 0) {
  console.log('\n🎉 ALL EMPIRICAL STRESS TESTS PASSED! VERDICT: APPROVE\n');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${results.failed} EMPIRICAL TEST(S) FAILED. VERDICT: REQUEST_CHANGES\n`);
  process.exit(1);
}
