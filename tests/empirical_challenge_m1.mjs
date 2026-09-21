/**
 * Empirical Stress Test & Challenger Harness for Milestone M1
 * Tests:
 * 1. Dark mode utilities, selector behavior (darkMode: 'class'), and base-layer cascade precedence
 * 2. Responsive breakpoint utilities (sm:, md:, lg:, xl:, 2xl:) and media query generation
 * 3. Edge-case component props in src/components/UI.jsx (adversarial fuzzing & boundary conditions)
 * 4. Opacity modifier compilation for primary/secondary/semantic tokens
 * 5. Production build integrity and window.* backward-compatibility attachments
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Global results tracker
const testReport = {
  categories: {},
  total: 0,
  passed: 0,
  failed: 0,
  failures: []
};

function recordTest(category, name, passed, errorMsg = '') {
  if (!testReport.categories[category]) {
    testReport.categories[category] = { passed: 0, failed: 0, tests: [] };
  }
  testReport.total++;
  if (passed) {
    testReport.passed++;
    testReport.categories[category].passed++;
    testReport.categories[category].tests.push({ name, status: 'PASS' });
    console.log(`  ✔ [PASS] ${name}`);
  } else {
    testReport.failed++;
    testReport.categories[category].failed++;
    testReport.categories[category].tests.push({ name, status: 'FAIL', error: errorMsg });
    testReport.failures.push({ category, name, error: errorMsg });
    console.log(`  ✖ [FAIL] ${name} -> ${errorMsg}`);
  }
}

// Load Tailwind config
const tailwindConfigPath = path.resolve(projectRoot, 'tailwind.config.js');
const { default: tailwindConfig } = await import(pathToFileURL(tailwindConfigPath).href);

async function compileTailwind(cssContent, rawContent, extension = 'html') {
  const config = {
    ...tailwindConfig,
    content: [{ raw: rawContent, extension }]
  };
  const result = await postcss([tailwindcss(config)]).process(cssContent, {
    from: undefined
  });
  return result.css;
}

console.log('======================================================================');
console.log('  EMPIRICAL CHALLENGER M1: COMPREHENSIVE STRESS TEST & VERIFICATION   ');
console.log('======================================================================\n');

// =============================================================================
// SECTION 1: Dark Mode Utility Classes & Selector Behavior
// =============================================================================
console.log('▶ CATEGORY 1: Dark Mode Utility Classes & Selector Behavior');

// 1.1 darkMode configuration
const isDarkModeClass = tailwindConfig.darkMode === 'class';
recordTest('DarkMode', 'tailwind.config.js configures darkMode: "class"', isDarkModeClass, `Actual: ${tailwindConfig.darkMode}`);

// 1.2 Dark mode selector syntax compilation
const darkModeTestHtml = `
<div class="dark">
  <div class="dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700/80 dark:hover:bg-slate-800">
    <span class="dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60"></span>
    <span class="dark:bg-amber-950/40 dark:text-amber-300"></span>
    <span class="dark:bg-rose-950/40 dark:text-rose-300"></span>
    <span class="dark:bg-sky-950/40 dark:text-sky-300"></span>
    <span class="dark:bg-purple-950/40 dark:text-purple-300"></span>
  </div>
</div>
`;

const compiledDarkCss = await compileTailwind('@tailwind utilities;', darkModeTestHtml, 'html');

// In Tailwind 3.4 with darkMode: 'class', utilities compile using :is(.dark *)
const usesModernDarkSelector = compiledDarkCss.includes(':is(.dark *)');
recordTest('DarkMode', 'Generates class-scoped dark selector using :is(.dark *) pseudo-class', usesModernDarkSelector);

// 1.3 Verify all dark utility classes from UI.jsx compile
const expectedDarkTokens = [
  'dark:bg-slate-900',
  'dark:text-slate-100',
  'dark:border-slate-700/80',
  'dark:bg-emerald-950/40',
  'dark:text-emerald-300',
  'dark:border-emerald-800/60',
  'dark:bg-amber-950/40',
  'dark:text-amber-300',
  'dark:bg-rose-950/40',
  'dark:text-rose-300',
  'dark:bg-sky-950/40',
  'dark:text-sky-300',
  'dark:bg-purple-950/40',
  'dark:text-purple-300'
];

for (const token of expectedDarkTokens) {
  const escaped = token.replace(/([:\[\]\/])/g, '\\$1');
  const compiled = compiledDarkCss.includes(token) || compiledDarkCss.includes(escaped);
  recordTest('DarkMode', `Compiles token '${token}' correctly into dark selector`, compiled);
}

// 1.4 Test index.css dark mode cascade precedence
const indexCssPath = path.resolve(projectRoot, 'src', 'index.css');
const indexCssContent = fs.readFileSync(indexCssPath, 'utf8');
const compiledFullIndexCss = await compileTailwind(indexCssContent, darkModeTestHtml, 'html');

const bodyDarkMatch = compiledFullIndexCss.match(/body:is\(\.dark\s*\*\)\s*\{[^}]*\}/);
recordTest('DarkMode', 'Base layer body dark mode styling compiles to body:is(.dark *)', bodyDarkMatch !== null);

const darkScrollbarPreserved = compiledFullIndexCss.includes('.dark .custom-scrollbar::-webkit-scrollbar-thumb');
recordTest('DarkMode', 'Dark mode custom scrollbar (.dark .custom-scrollbar) preserved in output', darkScrollbarPreserved);

const bodyPos = compiledFullIndexCss.indexOf('body:is(.dark *)');
const utilPos = compiledFullIndexCss.indexOf('.dark\\:border-slate-700');
recordTest('DarkMode', 'Base layer precedes utility layer in CSS cascade', bodyPos !== -1 && utilPos !== -1 && bodyPos < utilPos);

// =============================================================================
// SECTION 2: Responsive Breakpoints (sm:, md:, lg:, xl:, 2xl:)
// =============================================================================
console.log('\n▶ CATEGORY 2: Responsive Breakpoints Verification');

const responsiveTestHtml = `
<div class="p-4 sm:p-6 md:p-8 lg:p-12 xl:p-16 2xl:p-20">
  <div class="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl"></div>
  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"></div>
  <div class="w-10 sm:w-12 md:w-28 lg:w-40 xl:w-56"></div>
  <div class="max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl"></div>
</div>
`;

const compiledResponsiveCss = await compileTailwind('@tailwind utilities;', responsiveTestHtml, 'html');

const smMedia = compiledResponsiveCss.includes('@media (min-width: 640px)');
const mdMedia = compiledResponsiveCss.includes('@media (min-width: 768px)');
const lgMedia = compiledResponsiveCss.includes('@media (min-width: 1024px)');
const xlMedia = compiledResponsiveCss.includes('@media (min-width: 1280px)');
const xxlMedia = compiledResponsiveCss.includes('@media (min-width: 1536px)');

recordTest('Responsive', 'Generates sm: media query @media (min-width: 640px)', smMedia);
recordTest('Responsive', 'Generates md: media query @media (min-width: 768px)', mdMedia);
recordTest('Responsive', 'Generates lg: media query @media (min-width: 1024px)', lgMedia);
recordTest('Responsive', 'Generates xl: media query @media (min-width: 1280px)', xlMedia);
recordTest('Responsive', 'Generates 2xl: media query @media (min-width: 1536px)', xxlMedia);

// Test all responsive utilities present in UI.jsx
const uiJsxPath = path.resolve(projectRoot, 'src', 'components', 'UI.jsx');
const uiJsxContent = fs.readFileSync(uiJsxPath, 'utf8');
const compiledUiCss = await compileTailwind('@tailwind utilities;', uiJsxContent, 'jsx');

const uiResponsiveTokens = [
  'sm:text-sm',
  'sm:p-8',
  'sm:p-12',
  'sm:text-5xl',
  'sm:text-xl',
  'sm:max-w-md',
  'sm:w-12',
  'sm:w-56',
  'sm:w-36',
  'sm:p-5',
  'sm:grid-cols-2',
  'lg:grid-cols-3',
  'md:gap-6',
  'sm:p-6',
  'sm:text-base'
];

for (const token of uiResponsiveTokens) {
  const escaped = token.replace(/([:\[\]\/])/g, '\\$1');
  const compiled = compiledUiCss.includes(token) || compiledUiCss.includes(escaped);
  recordTest('Responsive', `UI.jsx responsive token '${token}' compiles into responsive CSS block`, compiled);
}

// =============================================================================
// SECTION 3: Opacity Modifiers & Theme Tokens (CSS JIT Verification)
// =============================================================================
console.log('\n▶ CATEGORY 3: Opacity Modifiers & Theme Tokens');

const opacityTestHtml = `
<div class="bg-primary/30 bg-primary/50 bg-secondary/20 bg-danger/10 bg-warning/25 bg-success/80 bg-error/15 bg-info/30 text-primary/70 border-secondary/40 bg-surface/50 text-on-primary/90 bg-primary/[0.33]"></div>
`;
const compiledOpacityCss = await compileTailwind('@tailwind utilities;', opacityTestHtml, 'html');

const opacityChecks = [
  { name: 'bg-primary/30', regex: /\.bg-primary\\\/30[\s\S]*?rgb\(\s*16\s+185\s+129\s*\/\s*0\.3\)/ },
  { name: 'bg-primary/50', regex: /\.bg-primary\\\/50[\s\S]*?rgb\(\s*16\s+185\s+129\s*\/\s*0\.5\)/ },
  { name: 'bg-secondary/20', regex: /\.bg-secondary\\\/20[\s\S]*?rgb\(\s*5\s+150\s+105\s*\/\s*0\.2\)/ },
  { name: 'bg-danger/10', regex: /\.bg-danger\\\/10[\s\S]*?rgb\(\s*244\s+63\s+94\s*\/\s*0\.1\)/ },
  { name: 'bg-warning/25', regex: /\.bg-warning\\\/25[\s\S]*?rgb\(\s*245\s+158\s+11\s*\/\s*0\.25\)/ },
  { name: 'bg-success/80', regex: /\.bg-success\\\/80[\s\S]*?rgb\(\s*16\s+185\s+129\s*\/\s*0\.8\)/ },
  { name: 'bg-error/15', regex: /\.bg-error\\\/15[\s\S]*?rgb\(\s*244\s+63\s+94\s*\/\s*0\.15\)/ },
  { name: 'bg-info/30', regex: /\.bg-info\\\/30[\s\S]*?rgb\(\s*14\s+165\s+233\s*\/\s*0\.3\)/ },
  { name: 'text-primary/70', regex: /\.text-primary\\\/70[\s\S]*?rgb\(\s*16\s+185\s+129\s*\/\s*0\.7\)/ },
  { name: 'border-secondary/40', regex: /\.border-secondary\\\/40[\s\S]*?rgb\(\s*5\s+150\s+105\s*\/\s*0\.4\)/ },
  { name: 'bg-surface/50', regex: /\.bg-surface\\\/50[\s\S]*?rgb\(\s*255\s+255\s+255\s*\/\s*0\.5\)/ },
  { name: 'text-on-primary/90', regex: /\.text-on-primary\\\/90[\s\S]*?rgb\(\s*255\s+255\s+255\s*\/\s*0\.9\)/ }
];

for (const check of opacityChecks) {
  const matches = check.regex.test(compiledOpacityCss);
  recordTest('OpacityModifiers', `Opacity modifier '${check.name}' compiles into RGB alpha channel`, matches);
}

// =============================================================================
// SECTION 4: Edge-Case Component Props in UI.jsx (Runtime Stress Testing)
// =============================================================================
console.log('\n▶ CATEGORY 4: Edge-Case Component Props in UI.jsx');

// Spin up Vite dev server for native JSX loading
if (typeof global.window === 'undefined') {
  global.window = {};
}

const viteServer = await createServer({
  server: { middlewareMode: true }
});

let UI;
try {
  UI = await viteServer.ssrLoadModule('./src/components/UI.jsx');
} catch (err) {
  console.error('Critical: Failed to load UI.jsx via Vite SSR loader:', err);
  await viteServer.close();
  process.exit(1);
}

// 4.1 EmptyState stress tests
try {
  const htmlNoProps = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState));
  recordTest('EmptyState', 'Renders safely with no props (default fallback)', htmlNoProps.includes('Belum Ada Data') && htmlNoProps.includes('folder_open'));

  const htmlNullProps = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
    icon: null,
    title: null,
    description: null,
    message: null,
    action: null,
    secondaryAction: null,
    className: null
  }));
  recordTest('EmptyState', 'Handles all-null props cleanly without crashing', htmlNullProps.includes('Belum ada data'));

  const htmlNoAction = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, { title: 'No Action Here' }));
  recordTest('EmptyState', 'Omits button elements when action is undefined', !htmlNoAction.includes('<button'));

  const htmlActionObj = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
    action: { label: 'Buka Jadwal', onClick: () => {}, icon: 'calendar_today' }
  }));
  recordTest('EmptyState', 'Renders configured action object with label and icon', htmlActionObj.includes('Buka Jadwal') && htmlActionObj.includes('calendar_today') && htmlActionObj.includes('<button'));

  const htmlMalformedAction1 = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
    action: { label: 'Missing onClick' }
  }));
  recordTest('EmptyState', 'Safely omits malformed action object (missing onClick)', !htmlMalformedAction1.includes('<button') && !htmlMalformedAction1.includes('Missing onClick'));

  const htmlMalformedAction2 = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
    action: { onClick: () => {} }
  }));
  recordTest('EmptyState', 'Safely omits malformed action object (missing label)', !htmlMalformedAction2.includes('<button'));

  const htmlEmptyObjAction = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
    action: {}
  }));
  recordTest('EmptyState', 'Safely omits empty action object ({})', !htmlEmptyObjAction.includes('<button'));

  const htmlPrimitiveAction = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
    action: true
  }));
  recordTest('EmptyState', 'Safely ignores non-object primitive action (boolean true)', !htmlPrimitiveAction.includes('<button'));

  const customReactNode = React.createElement('a', { href: '/custom-url', id: 'custom-link' }, 'Custom Link');
  const htmlReactNodeAction = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
    action: customReactNode
  }));
  recordTest('EmptyState', 'Renders direct React node action correctly', htmlReactNodeAction.includes('id="custom-link"') && htmlReactNodeAction.includes('Custom Link'));

  const htmlLegacyAction = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
    actionText: 'Mulai Ujian',
    onAction: () => {}
  }));
  recordTest('EmptyState', 'Supports legacy actionText + onAction backward compatibility', htmlLegacyAction.includes('Mulai Ujian') && htmlLegacyAction.includes('<button'));

  const htmlSecondaryOnly = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, {
    secondaryAction: { label: 'Kembali', onClick: () => {}, icon: 'arrow_back' }
  }));
  recordTest('EmptyState', 'Renders secondaryAction even if primary action is absent', htmlSecondaryOnly.includes('Kembali') && htmlSecondaryOnly.includes('arrow_back'));

  const htmlCompact = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, { compact: true }));
  recordTest('EmptyState', 'Renders compact mode with smaller padding and dimensions', htmlCompact.includes('p-6 sm:p-8') && htmlCompact.includes('w-14 h-14'));

  // Huge string stress test
  const hugeString = 'X'.repeat(5000);
  const htmlHuge = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, { title: hugeString, description: hugeString }));
  recordTest('EmptyState', 'Survives massive 5000-char string without crashing', htmlHuge.includes('XXXXX'));

  // XSS injection test (verifying React auto-escapes markup)
  const xssString = '<script>alert("xss")</script>';
  const htmlXss = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.EmptyState, { title: xssString }));
  recordTest('EmptyState', 'Escapes raw HTML/script tags safely in static markup', !htmlXss.includes('<script>') && htmlXss.includes('&lt;script&gt;'));
} catch (e) {
  recordTest('EmptyState', 'EmptyState suite encountered unexpected exception', false, e.message);
}

// 4.2 TableSkeleton stress tests
try {
  const htmlTableDefault = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton));
  recordTest('TableSkeleton', 'Renders default TableSkeleton (5 rows, 4 columns)', htmlTableDefault.includes('divide-y') && htmlTableDefault.includes('animate-pulse'));

  const htmlTableZeroRows = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton, { rows: 0 }));
  recordTest('TableSkeleton', 'Handles rows = 0 gracefully (no rows rendered)', htmlTableZeroRows.includes('bg-white') && !htmlTableZeroRows.includes('skel-tr-'));

  const htmlTableNegativeRows = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton, { rows: -5 }));
  recordTest('TableSkeleton', 'Handles rows = -5 gracefully without throwing RangeError', htmlTableNegativeRows.includes('bg-white'));

  const htmlTableZeroCols = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton, { cols: 0 }));
  recordTest('TableSkeleton', 'Handles cols = 0 by falling back to columns = 4', htmlTableZeroCols.includes('w-40 sm:w-56'));

  const customColWidths = ['w-12', 'w-32', 'w-48'];
  const htmlCustomWidths = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton, {
    columnWidths: customColWidths
  }));
  recordTest('TableSkeleton', 'Applies custom columnWidths array correctly', htmlCustomWidths.includes('w-12') && htmlCustomWidths.includes('w-32') && htmlCustomWidths.includes('w-48'));

  const htmlEmptyWidths = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton, {
    columnWidths: []
  }));
  recordTest('TableSkeleton', 'Handles empty columnWidths array ([]) without throwing', htmlEmptyWidths.includes('bg-white'));

  const htmlAsTableRows = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton, {
    asTableRows: true,
    rows: 3,
    cols: 3,
    hasAvatar: true
  }));
  recordTest('TableSkeleton', 'asTableRows=true renders <tr> and <td> for direct tbody integration', htmlAsTableRows.includes('<tr') && htmlAsTableRows.includes('<td') && htmlAsTableRows.includes('rounded-full'));

  const htmlNoHeader = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton, {
    showHeader: false
  }));
  recordTest('TableSkeleton', 'showHeader=false successfully omits header skeleton block', !htmlNoHeader.includes('skel-th-'));

  // Stress 100 rows
  const startT = performance.now();
  const html100Rows = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.TableSkeleton, { rows: 100, cols: 6 }));
  const durT = performance.now() - startT;
  recordTest('TableSkeleton', `Stress test 100 rows renders in <100ms (actual: ${Math.round(durT)}ms)`, durT < 100 && html100Rows.length > 5000);
} catch (e) {
  recordTest('TableSkeleton', 'TableSkeleton suite encountered unexpected exception', false, e.message);
}

// 4.3 CardSkeleton stress tests
try {
  const htmlCardDefault = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.CardSkeleton));
  // CardSkeleton renders a container div with gridClassName and 3 card divs
  const cardDivMatches = htmlCardDefault.match(/rounded-2xl border border-slate-200/g);
  recordTest('CardSkeleton', 'Renders default CardSkeleton (count = 3, variant = stat)', htmlCardDefault.includes('grid') && cardDivMatches !== null && cardDivMatches.length === 3);

  const htmlCardZero = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.CardSkeleton, { count: 0 }));
  const cardDivZero = htmlCardZero.match(/rounded-2xl border border-slate-200/g);
  recordTest('CardSkeleton', 'Handles count = 0 gracefully (no cards rendered)', htmlCardZero.includes('grid') && cardDivZero === null);

  const htmlCardNegative = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.CardSkeleton, { count: -2 }));
  recordTest('CardSkeleton', 'Handles count = -2 gracefully without throwing RangeError', htmlCardNegative.includes('grid'));

  const htmlCardExam = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.CardSkeleton, { variant: 'exam' }));
  recordTest('CardSkeleton', 'Renders exam variant with title, meta tags, and footer button slot', htmlCardExam.includes('w-3/4') && htmlCardExam.includes('justify-end'));

  const htmlCardSimple = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.CardSkeleton, { variant: 'simple' }));
  recordTest('CardSkeleton', 'Renders simple variant with circular placeholder and title line', htmlCardSimple.includes('rounded-full'));

  const htmlCardUnknown = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.CardSkeleton, { variant: 'unknown_unrecognized' }));
  recordTest('CardSkeleton', 'Falls back safely to simple layout on unrecognized variant', htmlCardUnknown.includes('rounded-full'));

  const htmlCardNullVariant = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.CardSkeleton, { variant: null }));
  recordTest('CardSkeleton', 'Falls back safely on null variant', htmlCardNullVariant.includes('rounded-full'));
} catch (e) {
  recordTest('CardSkeleton', 'CardSkeleton suite encountered unexpected exception', false, e.message);
}

// 4.4 StatusBadge stress tests
try {
  const htmlStatusDefault = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge));
  recordTest('StatusBadge', 'Renders default StatusBadge with fallback text "Status" and neutral theme', htmlStatusDefault.includes('Status') && htmlStatusDefault.includes('bg-slate-100'));

  const statusTests = [
    { status: 'AKTIF', expectedColor: 'emerald' },
    { status: 'SELESAI', expectedColor: 'emerald' },
    { status: 'TERJAWAB', expectedColor: 'emerald' },
    { status: 'LULUS', expectedColor: 'emerald' },
    { status: 'SEDANG KERJA', expectedColor: 'amber' },
    { status: 'SEDANG_UJIAN', expectedColor: 'amber' },
    { status: 'RAGU-RAGU', expectedColor: 'amber' },
    { status: 'BELUM MULAI', expectedColor: 'slate' },
    { status: 'BELUM', expectedColor: 'slate' },
    { status: 'TERBLOKIR', expectedColor: 'rose' },
    { status: 'PELANGGARAN', expectedColor: 'rose' },
    { status: 'DISKUALIFIKASI', expectedColor: 'rose' },
    { status: 'INFO', expectedColor: 'sky' },
    { status: 'HASIL', expectedColor: 'purple' }
  ];

  let allStatusMapped = true;
  for (const st of statusTests) {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { status: st.status }));
    if (!html.includes(st.expectedColor)) {
      allStatusMapped = false;
      recordTest('StatusBadge', `Status '${st.status}' maps to ${st.expectedColor}`, false, `Markup was: ${html}`);
    }
  }
  if (allStatusMapped) {
    recordTest('StatusBadge', `All ${statusTests.length} sample statuses correctly map to semantic color buckets`, true);
  }

  // Case insensitivity and whitespace trimming
  const htmlTrimCase = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { status: '   sedang_ujian   ' }));
  recordTest('StatusBadge', 'Handles whitespace and lowercase correctly ("   sedang_ujian   " -> amber)', htmlTrimCase.includes('bg-amber-50'));

  // Unknown status fallback
  const htmlUnknown = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { status: 'UNKNOWN_CODE_999' }));
  recordTest('StatusBadge', 'Unknown status gracefully falls back to neutral style while displaying string', htmlUnknown.includes('UNKNOWN_CODE_999') && htmlUnknown.includes('bg-slate-100'));

  // Non-string status inputs
  const htmlNumberZero = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { status: 0 }));
  recordTest('StatusBadge', 'Handles numeric 0 without throwing (falls back to Status)', htmlNumberZero.includes('Status'));

  const htmlNumberVal = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { status: 42 }));
  recordTest('StatusBadge', 'Handles numeric 42 without throwing (renders 42)', htmlNumberVal.includes('42'));

  const htmlBoolean = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { status: true }));
  recordTest('StatusBadge', 'Handles boolean true without throwing', typeof htmlBoolean === 'string');

  // Explicit variant override
  const htmlOverride = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, {
    status: 'AKTIF',
    variant: 'danger'
  }));
  recordTest('StatusBadge', 'Explicit variant="danger" overrides natural status mapping ("AKTIF" -> rose)', htmlOverride.includes('bg-rose-50 text-rose-700'));

  // Automatic live pulse for AKTIF, SEDANG KERJA, SEDANG_UJIAN
  const htmlPulseAktif = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { status: 'AKTIF' }));
  const htmlPulseSelesai = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { status: 'SELESAI' }));
  recordTest('StatusBadge', 'Live pulse animation triggers automatically for AKTIF', htmlPulseAktif.includes('animate-ping'));
  recordTest('StatusBadge', 'Live pulse animation does NOT trigger for SELESAI', !htmlPulseSelesai.includes('animate-ping'));

  // Dot suppression
  const htmlNoDot = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.StatusBadge, { status: 'AKTIF', dot: false }));
  recordTest('StatusBadge', 'dot=false suppresses dot indicator and ping animation', !htmlNoDot.includes('animate-ping') && !htmlNoDot.includes('w-2 h-2'));

  // Badge alias
  const htmlBadgeAlias = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.Badge, { status: 'SELESAI' }));
  recordTest('StatusBadge', 'Badge export is identical alias to StatusBadge', htmlBadgeAlias.includes('SELESAI') && htmlBadgeAlias.includes('bg-emerald-50'));
} catch (e) {
  recordTest('StatusBadge', 'StatusBadge suite encountered unexpected exception', false, e.message);
}

// 4.5 Button & Card Primitive stress tests
try {
  const htmlBtnDefault = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.Button, null, 'Klik Saya'));
  recordTest('Button', 'Renders primary Button with emerald styling', htmlBtnDefault.includes('Klik Saya') && htmlBtnDefault.includes('bg-emerald-600'));

  const htmlBtnLoading = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.Button, {
    isLoading: true,
    icon: 'send'
  }, 'Kirim'));
  recordTest('Button', 'isLoading=true renders spinner, disables button, and hides icon', htmlBtnLoading.includes('animate-spin') && !htmlBtnLoading.includes('send') && (htmlBtnLoading.includes('disabled=""') || htmlBtnLoading.includes('disabled')));

  const htmlBtnRightIcon = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.Button, {
    rightIcon: 'arrow_forward'
  }, 'Next'));
  recordTest('Button', 'rightIcon renders alongside children', htmlBtnRightIcon.includes('arrow_forward') && htmlBtnRightIcon.includes('Next'));

  const htmlBtnUnknown = ReactDOMServer.renderToStaticMarkup(React.createElement(UI.Button, {
    variant: 'unrecognized_style'
  }, 'Fallback'));
  recordTest('Button', 'Unknown variant safely falls back to emerald primary', htmlBtnUnknown.includes('bg-emerald-600'));

  // Card hierarchy
  const cardHierarchy = React.createElement(UI.Card, null,
    React.createElement(UI.CardHeader, null,
      React.createElement(UI.CardTitle, null, 'Judul'),
      React.createElement(UI.CardDescription, null, 'Deskripsi')
    ),
    React.createElement(UI.CardContent, null, 'Konten'),
    React.createElement(UI.CardFooter, null, 'Footer')
  );
  const htmlCardSuite = ReactDOMServer.renderToStaticMarkup(cardHierarchy);
  recordTest('CardSuite', 'Card suite (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter) renders full tree',
    htmlCardSuite.includes('Judul') && htmlCardSuite.includes('Deskripsi') && htmlCardSuite.includes('Konten') && htmlCardSuite.includes('Footer'));
} catch (e) {
  recordTest('ButtonAndCard', 'Button & Card primitive suite encountered exception', false, e.message);
}

// 4.6 Backward Compatibility & window.* attachments
try {
  const requiredWindowKeys = [
    'EmptyState', 'TableSkeleton', 'CardSkeleton', 'StatusBadge', 'Badge',
    'Card', 'CardHeader', 'CardTitle', 'CardDescription', 'CardContent', 'CardFooter',
    'Button', 'safeJSONParse'
  ];

  let allKeysAttached = true;
  for (const k of requiredWindowKeys) {
    if (typeof window[k] === 'undefined') {
      allKeysAttached = false;
      recordTest('WindowAttachments', `window.${k} is defined`, false);
    }
  }
  if (allKeysAttached) {
    recordTest('WindowAttachments', `All ${requiredWindowKeys.length} components/utilities attached to window global`, true);
  }

  // safeJSONParse tests
  const parse = window.safeJSONParse;
  recordTest('safeJSONParse', 'Parses valid JSON string into object', JSON.stringify(parse('{"a":1}', null)) === '{"a":1}');
  recordTest('safeJSONParse', 'Returns fallback on corrupted JSON syntax', parse('{malformed', 'fallback') === 'fallback');
  recordTest('safeJSONParse', 'Returns fallback on empty string', parse('', 'fallback') === 'fallback');
  recordTest('safeJSONParse', 'Returns fallback on null input', parse(null, 'fallback') === 'fallback');
  recordTest('safeJSONParse', 'Parses valid JSON number string ("123") to 123', parse('123', 'fallback') === 123);
  recordTest('safeJSONParse', 'Parses valid JSON boolean string ("true") to true', parse('true', 'fallback') === true);
} catch (e) {
  recordTest('WindowAttachments', 'window attachment test failed', false, e.message);
}

await viteServer.close();

// =============================================================================
// SUMMARY & VERDICT
// =============================================================================
console.log('\n======================================================================');
console.log('CHALLENGER M1 EMPIRICAL EXECUTION SUMMARY');
console.log(`  Total Test Cases : ${testReport.total}`);
console.log(`  Passed           : ${testReport.passed}`);
console.log(`  Failed           : ${testReport.failed}`);
console.log(`  Pass Rate        : ${Math.round((testReport.passed / testReport.total) * 100)}%`);
console.log('======================================================================\n');

if (testReport.failed > 0) {
  console.log('FAILURES DETECTED:');
  for (const f of testReport.failures) {
    console.log(`  - [${f.category}] ${f.name}: ${f.error}`);
  }
  process.exit(1);
} else {
  console.log('🌟 ALL EMPIRICAL CHALLENGER TESTS PASSED WITH 100% SUCCESS RATE!\n');
  process.exit(0);
}
