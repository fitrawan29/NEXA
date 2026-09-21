/**
 * Challenger M1 Empirical Verification & Stress Test Suite
 * Validates:
 * 1. Opacity modifier compatibility with Tailwind JIT for all theme tokens
 * 2. Dark mode selector ('class') behavior and base layer cascade precedence
 * 3. Component UI.jsx class extraction and compilation
 * 4. Runtime CSS compilation of src/index.css
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load project tailwind configuration
const tailwindConfigPath = path.resolve(projectRoot, 'tailwind.config.js');
const { default: tailwindConfig } = await import(pathToFileURL(tailwindConfigPath).href);

const results = {
  passed: 0,
  failed: 0,
  details: []
};

function assert(condition, message, extra = '') {
  if (condition) {
    results.passed++;
    results.details.push(`  ✔ PASS: ${message}`);
  } else {
    results.failed++;
    results.details.push(`  ✖ FAIL: ${message}${extra ? ' -> ' + extra : ''}`);
  }
}

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
console.log('   CHALLENGER M1: EMPIRICAL STRESS TESTS & TAILWIND JIT EVALUATION    ');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// STRESS TEST 1: Opacity modifier compatibility with Tailwind JIT
// -----------------------------------------------------------------------------
console.log('▶ [Stress Test 1] Opacity Modifier Compatibility with Tailwind JIT:');

const testOpacityClasses = [
  // Required classes in prompt
  'bg-primary/30',
  'bg-primary/50',
  'bg-secondary/20',
  'bg-danger/10',
  // Additional semantic and palette tokens
  'bg-warning/25',
  'bg-success/80',
  'bg-error/15',
  'bg-info/30',
  'text-primary/70',
  'text-secondary/60',
  'text-danger/90',
  'border-primary/40',
  'border-secondary/30',
  'border-secondary/40',
  // Surface and outline compatibility tokens
  'bg-surface/50',
  'bg-surface-variant/50',
  'border-outline/40',
  'border-outline-variant/60',
  'text-on-primary/90',
  'text-on-surface/75',
  // Numbered shades
  'bg-primary-500/30',
  'bg-secondary-600/40',
  // Arbitrary opacity
  'bg-primary/[0.33]',
  'text-primary/[0.85]'
];

const rawTestHtml = `<div class="${testOpacityClasses.join(' ')}"></div>`;
const compiledUtilityCss = await compileTailwind('@tailwind utilities;', rawTestHtml, 'html');

console.log('--- BG-PRIMARY/30 RULE ---');
const primaryMatch = compiledUtilityCss.match(/\.bg-primary\\\/30\s*\{[^}]*\}/);
console.log('primaryMatch:', primaryMatch ? primaryMatch[0] : 'null');
const arbitraryMatch = compiledUtilityCss.match(/\.bg-primary\\\/\\\[0\.33\\\]\s*\{[^}]*\}/);
console.log('arbitraryMatch:', arbitraryMatch ? arbitraryMatch[0] : 'null');
const anyBracket = compiledUtilityCss.match(/\.bg-primary[^\n{]*\{[^}]*\}/g);
console.log('all primary classes:', anyBracket);


// Expected mapping checks
const checks = [
  { className: 'bg-primary/30', pattern: /bg-primary\\\/30[\s\S]*?rgb\(\s*16\s+185\s+129\s*\/\s*0\.3\)/ },
  { className: 'bg-primary/50', pattern: /bg-primary\\\/50[\s\S]*?rgb\(\s*16\s+185\s+129\s*\/\s*0\.5\)/ },
  { className: 'bg-secondary/20', pattern: /bg-secondary\\\/20[\s\S]*?rgb\(\s*5\s+150\s+105\s*\/\s*0\.2\)/ },
  { className: 'bg-danger/10', pattern: /bg-danger\\\/10[\s\S]*?rgb\(\s*244\s+63\s+94\s*\/\s*0\.1\)/ },
  { className: 'bg-warning/25', pattern: /bg-warning\\\/25[\s\S]*?rgb\(\s*245\s+158\s+11\s*\/\s*0\.25\)/ },
  { className: 'bg-success/80', pattern: /bg-success\\\/80[\s\S]*?rgb\(\s*16\s+185\s+129\s*\/\s*0\.8\)/ },
  { className: 'bg-error/15', pattern: /bg-error\\\/15[\s\S]*?rgb\(\s*244\s+63\s+94\s*\/\s*0\.15\)/ },
  { className: 'bg-info/30', pattern: /bg-info\\\/30[\s\S]*?rgb\(\s*14\s+165\s+233\s*\/\s*0\.3\)/ },
  { className: 'text-primary/70', pattern: /text-primary\\\/70[\s\S]*?rgb\(\s*16\s+185\s+129\s*\/\s*0\.7\)/ },
  { className: 'border-secondary/40', pattern: /border-secondary\\\/40[\s\S]*?rgb\(\s*5\s+150\s+105\s*\/\s*0\.4\)/ },
  { className: 'bg-surface/50', pattern: /bg-surface\\\/50[\s\S]*?rgb\(\s*255\s+255\s+255\s*\/\s*0\.5\)/ },
  { className: 'text-on-primary/90', pattern: /text-on-primary\\\/90[\s\S]*?rgb\(\s*255\s+255\s+255\s*\/\s*0\.9\)/ },
  { className: 'bg-primary/[0.33]', pattern: /bg-primary\\\/\\\[0\\\.33\\\][\s\S]*?rgb\(\s*16\s+185\s+129\s*\/\s*0\.33\)/ }
];

for (const check of checks) {
  const matches = check.pattern.test(compiledUtilityCss);
  assert(matches, `Opacity modifier '${check.className}' compiles correctly with proper RGB alpha channel`);
}

// -----------------------------------------------------------------------------
// STRESS TEST 2: Dark mode selector and base layer collision
// -----------------------------------------------------------------------------
console.log('\n▶ [Stress Test 2] Dark Mode Selector & Base Layer Collision:');

// Compile full src/index.css
const indexCssPath = path.resolve(projectRoot, 'src', 'index.css');
const indexCssContent = fs.readFileSync(indexCssPath, 'utf8');

const testDarkModeHtml = `
  <div class="dark">
    <div class="dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
      <span class="dark:text-emerald-400 dark:bg-emerald-950/40"></span>
    </div>
  </div>
`;

const compiledFullCss = await compileTailwind(indexCssContent, testDarkModeHtml, 'html');

// In Tailwind 3.4 with darkMode: 'class', utilities compile to `.dark\:border-slate-700:is(.dark *)`
const hasClassScopedDarkMode = compiledFullCss.includes(':is(.dark *)');
assert(
  hasClassScopedDarkMode,
  `Tailwind generates class-scoped dark selector using modern ':is(.dark *)' pseudo-class (darkMode: 'class')`
);

// Verify index.css body compiles with dark styling in base layer
// In Tailwind 3.4, body with @apply dark:bg-slate-900 compiles to `body:is(.dark *)`
const bodyDarkMatch = compiledFullCss.match(/body:is\(\.dark\s*\*\)\s*\{[^}]*\}/);
assert(
  bodyDarkMatch !== null,
  `Base layer compiles 'body:is(.dark *)' rule for dark theme styling without cascade collision`,
  bodyDarkMatch ? bodyDarkMatch[0] : 'not found'
);

if (bodyDarkMatch) {
  console.log('    ℹ Compiled body dark CSS rule:\n    ', bodyDarkMatch[0].replace(/\n/g, '\n     '));
}

// Verify custom scrollbar dark selector in index.css
assert(
  compiledFullCss.includes('.dark .custom-scrollbar::-webkit-scrollbar-thumb'),
  `Dark mode scrollbar rule '.dark .custom-scrollbar' preserved cleanly in CSS output`
);

// Check layer precedence: base layer must appear before utilities layer
const bodyIndex = compiledFullCss.indexOf('body:is(.dark *)');
const utilIndex = compiledFullCss.indexOf('.dark\\:border-slate-700');
assert(
  bodyIndex !== -1 && utilIndex !== -1 && bodyIndex < utilIndex,
  `Base layer 'body' styles precede utility classes in CSS cascade (ensuring component styles take precedence)`
);

// -----------------------------------------------------------------------------
// STRESS TEST 3: Component UI.jsx Direct JSX Scanning & Compilation
// -----------------------------------------------------------------------------
console.log('\n▶ [Stress Test 3] Component UI.jsx Direct JSX Scanning & Compilation:');

const uiJsxPath = path.resolve(projectRoot, 'src', 'components', 'UI.jsx');
const uiJsxContent = fs.readFileSync(uiJsxPath, 'utf8');

// Compile Tailwind with UI.jsx raw content directly as JSX
const compiledUiCss = await compileTailwind(indexCssContent, uiJsxContent, 'jsx');

const uiCriticalTokens = [
  'bg-emerald-600',
  'hover:bg-emerald-700',
  'dark:bg-slate-800/90',
  'dark:border-slate-700/80',
  'dark:bg-emerald-950/40',
  'dark:text-emerald-400',
  'dark:text-rose-300',
  'animate-fade-in-up',
  'animate-pulse',
  'shadow-inner'
];

for (const token of uiCriticalTokens) {
  // Check if token selector exists in compiled CSS
  const escaped = token.replace(/([:\[\]\/])/g, '\\$1');
  const found = compiledUiCss.includes(token) || compiledUiCss.includes(escaped);
  assert(found, `UI.jsx token '${token}' scanned and compiled into valid CSS`);
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n----------------------------------------------------------------------');
console.log('RESULTS SUMMARY:');
results.details.forEach(d => console.log(d));
console.log('----------------------------------------------------------------------');
console.log(`Total: ${results.passed + results.failed} | Passed: ${results.passed} | Failed: ${results.failed}`);
console.log('----------------------------------------------------------------------');

if (results.failed > 0) {
  console.log(`\n❌ ${results.failed} tests failed! Review diagnostics.\n`);
  process.exit(1);
} else {
  console.log('\n🌟 All Challenger M1 Empirical Stress Tests PASSED!\n');
  process.exit(0);
}
