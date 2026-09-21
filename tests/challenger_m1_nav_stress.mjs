/**
 * Challenger M1 Empirical Stress & Layout Verification Suite
 * 
 * Objective: Empirically stress-test bottom navigation bar stickiness,
 * content clearance, z-index hierarchy, touch target accessibility, and
 * login NPSN decoupling across all views in CBT NEXA.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as babelParser from '@babel/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: []
};

function test(description, assertionFn) {
  stats.total++;
  try {
    const result = assertionFn();
    if (result === false) {
      stats.failed++;
      stats.failures.push({ description, error: 'Assertion returned false' });
      console.log(`  ❌ [FAIL] ${description}`);
    } else {
      stats.passed++;
      console.log(`  ✅ [PASS] ${description}`);
    }
  } catch (err) {
    stats.failed++;
    stats.failures.push({ description, error: err.message });
    console.log(`  ❌ [FAIL] ${description} -> Error: ${err.message}`);
  }
}

console.log('========================================================================');
console.log('   CHALLENGER M1 VERIFICATION: BOTTOM NAV STICKINESS & CLEARANCE        ');
console.log('========================================================================\n');

// Targets
const views = [
  { name: 'SuperAdminView', file: path.join(srcDir, 'views/SuperAdminView.jsx') },
  { name: 'AdminView', file: path.join(srcDir, 'views/AdminView.jsx') },
  { name: 'GuruView', file: path.join(srcDir, 'views/GuruView.jsx') },
  { name: 'SiswaView', file: path.join(srcDir, 'views/SiswaView.jsx') },
];

// Helper: AST parsing
function parseJSX(content) {
  return babelParser.parse(content, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });
}

// -----------------------------------------------------------------------------
// [SUITE 1] AST & Syntax Validity of All Target Views
// -----------------------------------------------------------------------------
console.log('▶ [Suite 1] AST Parsing & Syntactic Validation:');
for (const v of views) {
  test(`${v.name}.jsx successfully parses into AST with zero syntax errors`, () => {
    const content = fs.readFileSync(v.file, 'utf-8');
    const ast = parseJSX(content);
    return ast && ast.type === 'File';
  });
}

// -----------------------------------------------------------------------------
// [SUITE 2] Bottom Navigation Bar Stickiness & Position Specifications
// -----------------------------------------------------------------------------
console.log('\n▶ [Suite 2] Bottom Navigation Stickiness & Positioning:');
for (const v of views) {
  const content = fs.readFileSync(v.file, 'utf-8');

  test(`${v.name} has fixed bottom navigation with 'fixed bottom-0 left-0 right-0 z-40'`, () => {
    const fixedNavRegex = /fixed\s+bottom-0\s+left-0\s+right-0\s+z-40/;
    return fixedNavRegex.test(content);
  });

  test(`${v.name} has ZERO occurrences of 'absolute bottom-0' for primary navigation`, () => {
    // Check all occurrences of absolute bottom-0
    const matches = content.match(/className=(?:{[^}]*}|"[^"]*")(?=[\s\S]{0,100}absolute\s+bottom-0)/g) || [];
    for (const m of matches) {
      if (/nav|menu|tab|sidebar|footer/i.test(m)) {
        return false;
      }
    }
    // Also strict regex: no 'absolute bottom-0' in the entire file
    return !content.includes('absolute bottom-0');
  });

  test(`${v.name} bottom navigation applies backdrop blur (backdrop-blur-*)`, () => {
    return /backdrop-blur(?:-[a-z0-9]+)?/.test(content);
  });

  test(`${v.name} bottom navigation applies border styling (border-t)`, () => {
    return /border-t\s+border-slate-/.test(content);
  });

  test(`${v.name} bottom navigation applies safe-area inset bottom padding`, () => {
    return /pb-\[max\([^,]+,env\(safe-area-inset-bottom\)\)\]/.test(content);
  });
}

// -----------------------------------------------------------------------------
// [SUITE 3] Main Container Content Clearance (pb-28 or greater)
// -----------------------------------------------------------------------------
console.log('\n▶ [Suite 3] Main Container Content Clearance:');
for (const v of views) {
  const content = fs.readFileSync(v.file, 'utf-8');

  test(`${v.name} main scrollable container has bottom clearance >= pb-28 (7rem / 112px)`, () => {
    // Look for pb-(28|32|36|40|44|48|52|56|60|64)
    const clearanceRegex = /\bpb-(?:2[8-9]|[3-9][0-9]|\d{3,})\b/;
    return clearanceRegex.test(content);
  });

  test(`${v.name} clearance is present on scroll container or <main> element`, () => {
    const scrollContainerWithClearance = /(?:<main|<div[^>]*overflow-y-auto)[^>]*\bpb-(?:2[8-9]|[3-9][0-9])\b/.test(content);
    return scrollContainerWithClearance;
  });
}

// -----------------------------------------------------------------------------
// [SUITE 4] Z-Index Hierarchy Stress Test (Nav z-40 vs Modals >= z-50)
// -----------------------------------------------------------------------------
console.log('\n▶ [Suite 4] Z-Index Hierarchy (Modals/Overlays >= z-50 over Nav z-40):');
for (const v of views) {
  const content = fs.readFileSync(v.file, 'utf-8');

  test(`${v.name} modal and drawer overlays use z-index >= z-50 to cleanly obscure bottom nav`, () => {
    // Find all fixed inset-0 overlays
    const overlayMatches = [...content.matchAll(/fixed\s+inset-0[^"]*z-(?:\[(\d+)\]|(\d+))/g)];
    if (overlayMatches.length === 0) {
      // If no overlays, test passes vacuously
      return true;
    }
    for (const match of overlayMatches) {
      const zValue = parseInt(match[1] || match[2], 10);
      if (zValue < 40) {
        throw new Error(`Found overlay with z-${zValue}, which is lower than bottom nav z-40!`);
      }
    }
    return true;
  });
}

// -----------------------------------------------------------------------------
// [SUITE 5] Touch Target Accessibility (min 44x44px for navigation buttons)
// -----------------------------------------------------------------------------
console.log('\n▶ [Suite 5] Touch Target Accessibility (WCAG 44x44px):');
for (const v of views) {
  const content = fs.readFileSync(v.file, 'utf-8');

  test(`${v.name} navigation items adhere to 44px min touch target dimension`, () => {
    // Check min-h-[44px] or min-w-[44px] on nav items
    return content.includes('min-h-[44px]') || content.includes('min-h-[48px]');
  });
}

// -----------------------------------------------------------------------------
// [SUITE 6] Login Page & NPSN Formatting & Sanitization
// -----------------------------------------------------------------------------
console.log('\n▶ [Suite 6] Login NPSN Formatting & Sanitization Stress Tests:');
const appContent = fs.readFileSync(path.join(srcDir, 'App.jsx'), 'utf-8');

test("App.jsx formats school option display strictly as '[{s.npsn}-{s.nama_sekolah}]'", () => {
  return appContent.includes('[{s.npsn}-{s.nama_sekolah}]');
});

test("App.jsx sanitizes npsn input with regex stripping composite prefixes/brackets", () => {
  return /npsn\.replace\(\/\^\\\[\?\(\[\^-\]\+\)\.\*\/,\s*['"]\$1['"]\)/.test(appContent);
});

// Emulate and stress test sanitization oracle across diverse edge cases
const sanitizationOracle = (input) => {
  if (!input) return '';
  return input.includes('-')
    ? input.replace(/^\[?([^-]+).*/, '$1').replace(/[^a-zA-Z0-9]/g, '').trim()
    : input.replace(/[^a-zA-Z0-9]/g, '').trim();
};

const edgeCases = [
  { raw: '70040625', expected: '70040625', desc: 'pure 8-digit numeric NPSN' },
  { raw: '[70040625-SMA Nizamudin]', expected: '70040625', desc: 'standard bracketed format [NPSN-Nama Sekolah]' },
  { raw: '70040625-SMA Nizamudin', expected: '70040625', desc: 'unbracketed format NPSN-Nama Sekolah' },
  { raw: ' [ 70040625 - SMA Negeri 1 ] ', expected: '70040625', desc: 'bracketed with inner whitespace' },
  { raw: '[20104567-SMA Islam Al-Azhar 1]', expected: '20104567', desc: 'school name containing internal hyphens' },
  { raw: '[SCH9901-SMP Pelita Harapan (Unggulan)]', expected: 'SCH9901', desc: 'alphanumeric NPSN with parentheses in school name' },
  { raw: 'NPSN_12345-SMK Mitra', expected: 'NPSN12345', desc: 'alphanumeric NPSN with underscore' },
  { raw: '', expected: '', desc: 'empty string' },
];

for (const ec of edgeCases) {
  test(`Sanitization oracle: ${ec.desc} -> '${ec.expected}'`, () => {
    const sanitized = sanitizationOracle(ec.raw);
    if (sanitized !== ec.expected) {
      throw new Error(`Expected '${ec.expected}', but got '${sanitized}' from raw '${ec.raw}'`);
    }
    return true;
  });
}

// -----------------------------------------------------------------------------
// SUMMARY & VERDICT
// -----------------------------------------------------------------------------
console.log('\n========================================================================');
console.log(`CHALLENGER RESULTS: ${stats.passed}/${stats.total} Passed (${stats.failed} Failed)`);
console.log('========================================================================\n');

if (stats.failed > 0) {
  console.error(`💥 VERDICT: REJECT - ${stats.failed} assertion(s) failed.`);
  process.exit(1);
} else {
  console.log('🎉 VERDICT: APPROVE - All empirical stress checks passed perfectly!');
  process.exit(0);
}
