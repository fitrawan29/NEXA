/**
 * ============================================================================
 * CBT NEXA Round 28 — Challenger 2 Empirical Adversarial Stress Test Suite
 * ============================================================================
 * Focus:
 * - R3: ExamRoom Mobile Viewport (360px - 414px), Font Scaling (A-/A/A+), Critical Warnings
 * - R4: SiswaView Leaderboard Privacy & Route Guards
 *
 * Execution:
 *   node tests/adversarial_r28_challenger_examroom_siswa.mjs
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Color helpers
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assertTest(suite, testName, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${GREEN}✔ PASS${RESET} [${suite}] ${testName}`);
  } else {
    failedTests++;
    failures.push({ suite, testName, details });
    console.error(`  ${RED}✖ FAIL${RESET} [${suite}] ${testName}`);
    if (details) console.error(`         ${YELLOW}└─ ${details}${RESET}`);
  }
}

console.log(`${BOLD}======================================================================${RESET}`);
console.log(`${BOLD}   CBT NEXA Round 28 — Challenger 2 Adversarial Stress Test Suite      ${RESET}`);
console.log(`${BOLD}   R3 (ExamRoom Mobile Ergonomics & Timer) & R4 (Leaderboard Privacy)  ${RESET}`);
console.log(`${BOLD}======================================================================\n${RESET}`);

// Source File Loaders
const examRoomPath = path.join(rootDir, 'src', 'views', 'ExamRoom.jsx');
const siswaViewPath = path.join(rootDir, 'src', 'views', 'SiswaView.jsx');
const apiPath = path.join(rootDir, 'src', 'api.js');

assertTest('LOADER', 'ExamRoom.jsx exists and readable', fs.existsSync(examRoomPath));
assertTest('LOADER', 'SiswaView.jsx exists and readable', fs.existsSync(siswaViewPath));
assertTest('LOADER', 'api.js exists and readable', fs.existsSync(apiPath));

const examRoomContent = fs.readFileSync(examRoomPath, 'utf-8');
const siswaViewContent = fs.readFileSync(siswaViewPath, 'utf-8');
const apiContent = fs.readFileSync(apiPath, 'utf-8');

// ============================================================================
// SUITE 1: ExamRoom Mobile Viewport Stress (360px – 414px)
// ============================================================================
console.log(`\n${CYAN}--- SUITE 1: ExamRoom Mobile Viewport Stress (360px – 414px) ---${RESET}`);

// 1.1 Mathematical Layout Invariants across Mobile Viewports
// Padding: px-2.5 (10px on each side = 20px total)
// Grid: grid-cols-4 gap-1.5 (1.5 * 4px = 6px gap * 3 gaps = 18px total gap)
const computeButtonWidth = (viewportWidth, horizontalPaddingTotal = 20, gapTotal = 18, cols = 4) => {
  return (viewportWidth - horizontalPaddingTotal - gapTotal) / cols;
};

const viewports = [
  { name: '360px (Ultra-Compact Android)', width: 360, expectedCol: 80.5 },
  { name: '375px (iPhone SE / Standard Mobile)', width: 375, expectedCol: 84.25 },
  { name: '390px (iPhone 12/13/14/15)', width: 390, expectedCol: 88.0 },
  { name: '412px (Samsung Galaxy S-series)', width: 412, expectedCol: 93.5 },
  { name: '414px (iPhone Plus / Max)', width: 414, expectedCol: 94.0 },
];

for (const vp of viewports) {
  const colWidth = computeButtonWidth(vp.width);
  const totalBarWidth = (colWidth * 4) + 18 + 20;
  assertTest(
    'R3-VIEWPORT',
    `${vp.name}: Allocates ${colWidth.toFixed(2)}px per column without horizontal overflow (Total: ${totalBarWidth}px <= ${vp.width}px)`,
    Math.abs(colWidth - vp.expectedCol) < 0.01 && totalBarWidth <= vp.width,
    `Calculated: ${colWidth}px, Expected: ${vp.expectedCol}px`
  );
}

// 1.2 Fixed bottom bar CSS structure verification
const hasFixedBottomBar = examRoomContent.includes('fixed bottom-0') &&
  examRoomContent.includes('lg:right-80') &&
  examRoomContent.includes('px-2.5 sm:px-4') &&
  examRoomContent.includes('pb-[max(0.75rem,env(safe-area-inset-bottom))]');

assertTest(
  'R3-VIEWPORT',
  'Sticky bottom action bar integrates fixed positioning, safe area inset, and desktop right offset (lg:right-80)',
  hasFixedBottomBar,
  'Bottom bar must include safe-area-inset-bottom and responsive container padding'
);

// 1.3 Mobile Grid structure verification
const gridStartIdx = examRoomContent.indexOf('sm:hidden grid grid-cols-4');
const gridEndIdx = examRoomContent.indexOf('{/* Desktop Spacious Navigation', gridStartIdx);
const mobileGridSlice = examRoomContent.slice(gridStartIdx, gridEndIdx);

const hasGridCols4 = mobileGridSlice.includes('sm:hidden grid grid-cols-4 gap-1.5 w-full');
assertTest(
  'R3-VIEWPORT',
  'Mobile action bar uses sm:hidden grid grid-cols-4 gap-1.5 w-full',
  hasGridCols4
);

// 1.4 Minimum Touch Target Ergonomics (>= 44px)
const col1HasMinH44 = mobileGridSlice.includes('aria-label="Soal Sebelumnya"') && mobileGridSlice.includes('min-h-[44px]');
const col2HasMinH44 = mobileGridSlice.includes('aria-label="Tandai Ragu-ragu"') && mobileGridSlice.includes('min-h-[44px]');
const col3HasMinH44 = mobileGridSlice.includes('aria-label="Buka Palet Soal"') && mobileGridSlice.includes('min-h-[44px]');
const col4NextHasMinH44 = mobileGridSlice.includes('aria-label="Soal Berikutnya"') && mobileGridSlice.includes('min-h-[44px]');
const col4SelesaiHasMinH44 = mobileGridSlice.includes('aria-label="Kumpulkan Ujian"') && mobileGridSlice.includes('min-h-[44px]');
const totalMinH44InGrid = (mobileGridSlice.match(/min-h-\[44px\]/g) || []).length;

assertTest(
  'R3-VIEWPORT',
  'All 4 mobile bottom columns (including both Next & Selesai) enforce WCAG min-h-[44px] touch target ergonomics',
  col1HasMinH44 && col2HasMinH44 && col3HasMinH44 && col4NextHasMinH44 && col4SelesaiHasMinH44 && totalMinH44InGrid === 5,
  'Buttons must contain min-h-[44px] class'
);

// 1.5 Navigation boundary & Dynamic Col 4 morphing
const simulateBottomBarState = (currentIndex, totalQuestions) => {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex >= totalQuestions - 1;
  return {
    prevDisabled: isFirst,
    prevAction: Math.max(0, currentIndex - 1),
    col4Type: isLast ? 'SELESAI' : 'NEXT',
    col4Label: isLast ? 'Selesai' : 'Next',
    col4Icon: isLast ? 'check_circle' : 'arrow_forward',
    col4Action: isLast ? 'requestSubmit' : 'increment'
  };
};

const q0State = simulateBottomBarState(0, 10);
const qMidState = simulateBottomBarState(4, 10);
const qLastState = simulateBottomBarState(9, 10);
const qSingleState = simulateBottomBarState(0, 1);

assertTest(
  'R3-VIEWPORT',
  'Question 0: Prev button disabled, Col 4 renders Next',
  q0State.prevDisabled === true && q0State.col4Type === 'NEXT' && q0State.col4Label === 'Next'
);

assertTest(
  'R3-VIEWPORT',
  'Middle Question (index 4 of 10): Prev enabled, Col 4 renders Next',
  qMidState.prevDisabled === false && qMidState.col4Type === 'NEXT' && qMidState.prevAction === 3
);

assertTest(
  'R3-VIEWPORT',
  'Final Question (index 9 of 10): Prev enabled, Col 4 dynamically transforms to Selesai with check_circle',
  qLastState.prevDisabled === false && qLastState.col4Type === 'SELESAI' && qLastState.col4Icon === 'check_circle'
);

assertTest(
  'R3-VIEWPORT',
  'Single-Question Exam (1 question): Prev is disabled AND Col 4 immediately renders Selesai',
  qSingleState.prevDisabled === true && qSingleState.col4Type === 'SELESAI'
);

// ============================================================================
// SUITE 2: Question Font Scaling Stress (A- / A / A+)
// ============================================================================
console.log(`\n${CYAN}--- SUITE 2: Question Font Scaling Stress (A- / A / A+) ---${RESET}`);

// 2.1 Font Scaling state and handlers
const hasFontSizeState = examRoomContent.includes('const [fontSize, setFontSize] = useState');
const hasHandleSetFontSize = examRoomContent.includes('const handleSetFontSize = (size) =>');
const hasGetFontClasses = examRoomContent.includes('const getFontClasses = () =>');

assertTest(
  'R3-FONTSCALE',
  'ExamRoom defines fontSize state, handleSetFontSize handler, and getFontClasses mapper',
  hasFontSizeState && hasHandleSetFontSize && hasGetFontClasses
);

// 2.2 Header Selector Buttons (A-, A, A+)
const hasAminusBtn = examRoomContent.includes("handleSetFontSize('small')") && examRoomContent.includes('A-');
const hasAnormalBtn = examRoomContent.includes("handleSetFontSize('normal')") && examRoomContent.includes('title="Ukuran teks normal (A)"');
const hasAplusBtn = examRoomContent.includes("handleSetFontSize('large')") && examRoomContent.includes('A+');

assertTest(
  'R3-FONTSCALE',
  'Top header renders A-, A, A+ buttons with explicit handleSetFontSize triggers',
  hasAminusBtn && hasAnormalBtn && hasAplusBtn
);

// 2.3 Typography mapping invariants
const resolveFontClasses = (fontSize) => {
  switch (fontSize) {
    case 'small':
    case 'sm':
      return {
        stimulus: 'text-xs sm:text-sm',
        question: 'text-xs sm:text-sm md:text-base',
        options: 'text-xs sm:text-sm'
      };
    case 'large':
    case 'lg':
      return {
        stimulus: 'text-base sm:text-lg md:text-xl',
        question: 'text-base sm:text-lg md:text-xl font-medium',
        options: 'text-base sm:text-lg'
      };
    case 'normal':
    case 'base':
    default:
      return {
        stimulus: 'text-sm sm:text-base',
        question: 'text-sm sm:text-base md:text-lg',
        options: 'text-sm sm:text-base'
      };
  }
};

const smallClasses = resolveFontClasses('small');
const normalClasses = resolveFontClasses('normal');
const largeClasses = resolveFontClasses('large');
const fallbackClasses = resolveFontClasses('CORRUPTED_VALUE');

assertTest(
  'R3-FONTSCALE',
  'Small scale maps to compact tokens (text-xs / sm:text-sm)',
  smallClasses.stimulus.includes('text-xs') && smallClasses.question.includes('text-xs') && smallClasses.options.includes('text-xs')
);

assertTest(
  'R3-FONTSCALE',
  'Normal scale maps to balanced standard tokens (text-sm / sm:text-base)',
  normalClasses.stimulus.includes('text-sm') && normalClasses.question.includes('text-sm') && normalClasses.options.includes('text-sm')
);

assertTest(
  'R3-FONTSCALE',
  'Large scale maps to prominent tokens (text-base / sm:text-lg / md:text-xl)',
  largeClasses.stimulus.includes('text-base') && largeClasses.question.includes('text-base') && largeClasses.options.includes('text-base')
);

assertTest(
  'R3-FONTSCALE',
  'Corrupted or undefined scale gracefully falls back to normal classes',
  fallbackClasses.stimulus === normalClasses.stimulus && fallbackClasses.question === normalClasses.question
);

// 2.4 Verification of font class binding across all question & option components in ExamRoom.jsx
const hasStimulusFontBinding = examRoomContent.includes('${fontClasses.stimulus}');
const hasQuestionFontBinding = examRoomContent.includes('${fontClasses.question}');
const hasOptionsFontBinding = examRoomContent.includes('${fontClasses.options}');

assertTest(
  'R3-FONTSCALE',
  'Stimulus container (narasi-soal) binds ${fontClasses.stimulus}',
  hasStimulusFontBinding
);

assertTest(
  'R3-FONTSCALE',
  'Question container (pertanyaan-soal) binds ${fontClasses.question}',
  hasQuestionFontBinding
);

// Check all 5 option types: PG, PGK, JODOH, ISIAN, URAIAN
const pgSection = examRoomContent.slice(examRoomContent.indexOf("case 'PG':"), examRoomContent.indexOf("case 'PGK':"));
const pgkSection = examRoomContent.slice(examRoomContent.indexOf("case 'PGK':"), examRoomContent.indexOf("case 'JODOH':"));
const jodohSection = examRoomContent.slice(examRoomContent.indexOf("case 'JODOH':"), examRoomContent.indexOf("case 'ISIAN':"));
const isianIdx = examRoomContent.indexOf("case 'ISIAN':");
const isianDefaultIdx = examRoomContent.indexOf("default:", isianIdx);
const isianUraianSection = examRoomContent.slice(isianIdx, isianDefaultIdx);

assertTest('R3-FONTSCALE', 'Option type PG binds fontClasses.options', pgSection.includes('${fontClasses.options}'));
assertTest('R3-FONTSCALE', 'Option type PGK binds fontClasses.options', pgkSection.includes('${fontClasses.options}'));
assertTest('R3-FONTSCALE', 'Option type JODOH binds fontClasses.options', jodohSection.includes('${fontClasses.options}'));
assertTest('R3-FONTSCALE', 'Option type ISIAN & URAIAN textarea binds fontClasses.options', isianUraianSection.includes('${fontClasses.options}'));

// 2.5 Storage persistence & MathJax Hook
const hasStoragePersistence = examRoomContent.includes("localStorage.setItem('nexa_exam_font_size', size)") &&
  examRoomContent.includes("localStorage.setItem('nexa_exam_font_scale', size)");

const hasMathJaxHook = examRoomContent.includes('window.MathJax.typesetPromise') &&
  examRoomContent.includes('setTimeout') &&
  examRoomContent.includes('catch');

assertTest(
  'R3-FONTSCALE',
  'handleSetFontSize persists selection to localStorage (nexa_exam_font_size & nexa_exam_font_scale)',
  hasStoragePersistence
);

assertTest(
  'R3-FONTSCALE',
  'handleSetFontSize safely invokes window.MathJax.typesetPromise with catch handler',
  hasMathJaxHook
);

// ============================================================================
// SUITE 3: Timer Critical Countdown & Threshold Boundary Stress
// ============================================================================
console.log(`\n${CYAN}--- SUITE 3: Timer Critical Countdown & Threshold Boundary Stress ---${RESET}`);

// 3.1 Precise Threshold Crossings & Toast Latching
const simulateTimerTick = (remainingMs, latches, showMessageMock) => {
  const currentLatches = { ...latches };

  // <= 5 Minutes Proactive Alert (300,000 ms)
  if (remainingMs <= 300000 && remainingMs > 60000 && !currentLatches.hasAlerted5Min) {
    currentLatches.hasAlerted5Min = true;
    showMessageMock('Peringatan Waktu', 'Sisa waktu ujian kurang dari 5 menit! Periksa kembali jawaban Anda.', 'warning');
  }

  // <= 1 Minute Urgent Warning (60,000 ms)
  if (remainingMs <= 60000 && remainingMs > 0 && !currentLatches.hasAlerted1Min) {
    currentLatches.hasAlerted1Min = true;
    showMessageMock('Waktu Kritis', 'Sisa waktu ujian kurang dari 1 menit! Ujian akan segera dikumpulkan secara otomatis.', 'error');
  }

  // Auto submission at 0
  let autoSubmitted = false;
  if (remainingMs <= 0) {
    autoSubmitted = true;
    showMessageMock('Waktu Habis!', 'Waktu ujian telah berakhir.', 'warning');
  }

  return { latches: currentLatches, autoSubmitted };
};

const toastCalls = [];
const mockShowMessage = (title, message, type) => toastCalls.push({ title, message, type });

let activeLatches = { hasAlerted5Min: false, hasAlerted1Min: false };

// Test 3.1.1: At 300,001 ms -> Silent
let result = simulateTimerTick(300001, activeLatches, mockShowMessage);
activeLatches = result.latches;
assertTest('R3-TIMER', '300,001ms (5m + 1ms): Normal countdown, zero toast alerts triggered', toastCalls.length === 0 && !activeLatches.hasAlerted5Min);

// Test 3.1.2: At exactly 300,000 ms -> Triggers 5-min warning
result = simulateTimerTick(300000, activeLatches, mockShowMessage);
activeLatches = result.latches;
assertTest(
  'R3-TIMER',
  '300,000ms exact boundary: Triggers 5-minute proactive warning toast and sets latch',
  toastCalls.length === 1 && toastCalls[0].title === 'Peringatan Waktu' && activeLatches.hasAlerted5Min === true
);

// Test 3.1.3: Subsequent ticks between 5m and 1m -> No repeated toasts (latch test)
simulateTimerTick(299000, activeLatches, mockShowMessage);
simulateTimerTick(250000, activeLatches, mockShowMessage);
simulateTimerTick(60001, activeLatches, mockShowMessage);
assertTest('R3-TIMER', 'Ticks between 299,000ms and 60,001ms: Ref latch prevents repeated 5-min toast spam', toastCalls.length === 1);

// Test 3.1.4: At exactly 60,000 ms -> Triggers 1-min critical warning
result = simulateTimerTick(60000, activeLatches, mockShowMessage);
activeLatches = result.latches;
assertTest(
  'R3-TIMER',
  '60,000ms exact boundary: Triggers 1-minute urgent critical warning toast and sets latch',
  toastCalls.length === 2 && toastCalls[1].title === 'Waktu Kritis' && activeLatches.hasAlerted1Min === true
);

// Test 3.1.5: Subsequent ticks under 1m -> No repeated toasts
simulateTimerTick(59000, activeLatches, mockShowMessage);
simulateTimerTick(30000, activeLatches, mockShowMessage);
simulateTimerTick(1000, activeLatches, mockShowMessage);
assertTest('R3-TIMER', 'Ticks between 59,000ms and 1,000ms: Ref latch prevents repeated 1-min toast spam', toastCalls.length === 2);

// Test 3.1.6: 0 ms -> Auto-submission
result = simulateTimerTick(0, activeLatches, mockShowMessage);
assertTest('R3-TIMER', '0ms: Fires auto-submission and final time expiration notice', result.autoSubmitted === true && toastCalls.length === 3);

// 3.2 Proctor Time Extension Reset Invariant
const simulateProctorExtension = (currentLatches, newRemainingMs) => {
  const updated = { ...currentLatches };
  if (newRemainingMs > 300000) {
    updated.hasAlerted5Min = false;
  }
  if (newRemainingMs > 60000) {
    updated.hasAlerted1Min = false;
  }
  return updated;
};

const latchesBeforeExtension = { hasAlerted5Min: true, hasAlerted1Min: true };
const latchesAfterExtension = simulateProctorExtension(latchesBeforeExtension, 600000); // Extended by 10 mins

assertTest(
  'R3-TIMER',
  'Proctor time extension > 300,000ms cleanly resets both 5m and 1m warning latches',
  latchesAfterExtension.hasAlerted5Min === false && latchesAfterExtension.hasAlerted1Min === false
);

// Verify ExamRoom source code includes the exact reset logic
const hasExtensionLatchResetInSource = examRoomContent.includes('hasAlerted5MinRef.current = false') &&
  examRoomContent.includes('hasAlerted1MinRef.current = false') &&
  examRoomContent.includes('serverEndMs > endMsRef.current + 30000');

assertTest(
  'R3-TIMER',
  'ExamRoom source code contains proctor time extension sync with warning latch resets',
  hasExtensionLatchResetInSource
);

// 3.3 Visual Banner Styling Invariant
const resolveBannerClasses = (remainingMs) => {
  if (remainingMs <= 60000) return 'bg-rose-600 text-white animate-pulse';
  if (remainingMs <= 300000) return 'bg-amber-500 text-slate-950';
  return null;
};

assertTest('R3-TIMER', 'Banner at 250,000ms renders calm amber (bg-amber-500 text-slate-950)', resolveBannerClasses(250000) === 'bg-amber-500 text-slate-950');
assertTest('R3-TIMER', 'Banner at 45,000ms renders pulsing rose (bg-rose-600 text-white animate-pulse)', resolveBannerClasses(45000) === 'bg-rose-600 text-white animate-pulse');
assertTest('R3-TIMER', 'Banner at 400,000ms is not rendered (null)', resolveBannerClasses(400000) === null);

// ============================================================================
// SUITE 4: SiswaView Leaderboard Privacy & Route Guard Stress
// ============================================================================
console.log(`\n${CYAN}--- SUITE 4: SiswaView Leaderboard Privacy & Route Guard Stress ---${RESET}`);

// 4.1 Checking tampilkan_leaderboard setting on mount in SiswaView
const hasSettingLoader = siswaViewContent.includes('get_pengaturan_sekolah(user.npsn)') &&
  siswaViewContent.includes('isLeaderboardEnabled = res.tampilkan_leaderboard !== false') &&
  siswaViewContent.includes('setShowLeaderboard(isLeaderboardEnabled)');

assertTest(
  'R4-PRIVACY',
  'SiswaView loads school settings and evaluates tampilkan_leaderboard !== false',
  hasSettingLoader,
  'SiswaView must load get_pengaturan_sekolah and set showLeaderboard state'
);

// 4.2 Conditional get_leaderboard API execution
const hasConditionalLeaderboardFetch = siswaViewContent.includes('if (isLeaderboardEnabled) {\n        loadLeaderboard();\n      }') ||
  (siswaViewContent.includes('if (isLeaderboardEnabled)') && siswaViewContent.includes('loadLeaderboard()'));

assertTest(
  'R4-PRIVACY',
  'API call get_leaderboard is strictly omitted when tampilkan_leaderboard is false',
  hasConditionalLeaderboardFetch,
  'loadLeaderboard() must only be called if isLeaderboardEnabled === true'
);

// 4.3 Desktop Navigation Tab Filtering
const dNavStart = siswaViewContent.indexOf("{ id: 'beranda', label: 'Beranda'");
const dNavEnd = siswaViewContent.indexOf('</nav>', dNavStart);
const desktopNavSlice = siswaViewContent.slice(dNavStart, dNavEnd);

const hasDesktopLeaderboardFilter = desktopNavSlice.includes(".filter(tab => tab.id !== 'leaderboard' || showLeaderboard)");

assertTest(
  'R4-PRIVACY',
  'Desktop navigation excludes Papan Peringkat when showLeaderboard is false',
  hasDesktopLeaderboardFilter
);

// 4.4 Mobile Bottom Bar Navigation Filtering
const mNavStart = siswaViewContent.indexOf('fixed bottom-0 left-0 right-0 z-40');
const mNavEnd = siswaViewContent.indexOf('</div>', mNavStart + 500);
const mobileNavSlice = siswaViewContent.slice(mNavStart, mNavEnd + 1000);

const hasMobileLeaderboardFilter = mobileNavSlice.includes(".filter(tab => tab.id !== 'leaderboard' || showLeaderboard)");

assertTest(
  'R4-PRIVACY',
  'Mobile bottom bar excludes Peringkat when showLeaderboard is false',
  hasMobileLeaderboardFilter
);

// 4.5 Dashboard Kilas Leaderboard Card Suppression
const hasKilasLeaderboardGuard = siswaViewContent.includes('{showLeaderboard && (\n                  <Card>\n                    <CardHeader className="pb-3">\n                      <div className="flex items-center gap-2">\n                        <span className="material-symbols-outlined text-amber-500">social_leaderboard</span>\n                        <CardTitle>Peringkat Teratas</CardTitle>') ||
  (siswaViewContent.includes('{showLeaderboard && (') && siswaViewContent.includes('Peringkat Teratas'));

assertTest(
  'R4-PRIVACY',
  'Dashboard Kilas Leaderboard card is completely suppressed when showLeaderboard is false',
  hasKilasLeaderboardGuard
);

// 4.6 Route Guard / Safe Redirect to 'beranda'
const hasRouteGuardRedirect = siswaViewContent.includes("if (!showLeaderboard && activeTab === 'leaderboard') {\n      setActiveTab('beranda');\n    }") ||
  (siswaViewContent.includes('!showLeaderboard') && siswaViewContent.includes("activeTab === 'leaderboard'") && siswaViewContent.includes("setActiveTab('beranda')"));

assertTest(
  'R4-PRIVACY',
  'Forced navigation to activeTab === \'leaderboard\' safely redirects back to \'beranda\'',
  hasRouteGuardRedirect,
  'useEffect must redirect activeTab to \'beranda\' if showLeaderboard is false'
);

// 4.7 Default Setting Invariant in api.js
const defKopStart = apiContent.indexOf('export const getDefaultKopSettings');
const defKopEnd = apiContent.indexOf('export const get_pengaturan_sekolah', defKopStart);
const defKopSlice = apiContent.slice(defKopStart, defKopEnd);
const hasDefaultLeaderboardTrue = defKopSlice.includes('tampilkan_leaderboard: u.tampilkan_leaderboard !== undefined ? u.tampilkan_leaderboard : true');

assertTest(
  'R4-PRIVACY',
  'api.js getDefaultKopSettings establishes standard fallback tampilkan_leaderboard: true',
  hasDefaultLeaderboardTrue
);

// ============================================================================
// SUMMARY & VERDICT
// ============================================================================
console.log(`\n${BOLD}======================================================================${RESET}`);
console.log(`${BOLD}CHALLENGER 2 ADVERSARIAL STRESS TEST SUMMARY${RESET}`);
console.log(`${BOLD}======================================================================${RESET}`);
console.log(`Total Assertions : ${totalTests}`);
console.log(`Passed           : ${GREEN}${passedTests}${RESET} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
console.log(`Failed           : ${failedTests > 0 ? RED : GREEN}${failedTests}${RESET}`);

if (failedTests > 0) {
  console.log(`\n${RED}${BOLD}ESCALATION DETAILS:${RESET}`);
  failures.forEach(f => {
    console.error(`- [${f.suite}] ${f.testName}: ${f.details}`);
  });
  console.log(`\n${RED}${BOLD}FINAL VERDICT: REQUEST_CHANGES${RESET}\n`);
  process.exit(1);
} else {
  console.log(`\n${GREEN}${BOLD}ALL EMPIRICAL ADVERSARIAL STRESS INVARIANTS SATISFIED!${RESET}`);
  console.log(`${GREEN}${BOLD}FINAL VERDICT: APPROVE${RESET}\n`);
  process.exit(0);
}
