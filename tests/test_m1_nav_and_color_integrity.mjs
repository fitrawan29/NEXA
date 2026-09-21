/**
 * Test Suite: Milestone 1 - Navigation Bug Fix & UI Color Consistency Integrity
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
console.log('   M1 VERIFICATION: NAVIGATION BUG FIX & UI COLOR INTEGRITY             ');
console.log('========================================================================\n');

// 1. AdminView.jsx
console.log('▶ [Suite 1] AdminView Navigation Integrity:');
const adminContent = fs.readFileSync(path.join(srcDir, 'views/AdminView.jsx'), 'utf-8');

test('AdminView navGroups contains zero badge properties', () => {
  const navGroupsMatch = adminContent.match(/const navGroups = \[([\s\S]*?)\];/);
  if (!navGroupsMatch) throw new Error('navGroups definition not found in AdminView');
  return !/badge:\s*/.test(navGroupsMatch[1]);
});

test('AdminView does not render item.badge in sidebar or drawer', () => {
  return !adminContent.includes('item.badge');
});

// 2. GuruView.jsx
console.log('\n▶ [Suite 2] GuruView Navigation & Live HUD Color:');
const guruContent = fs.readFileSync(path.join(srcDir, 'views/GuruView.jsx'), 'utf-8');

test('GuruView navGroups contains zero badge properties', () => {
  const navGroupsMatch = guruContent.match(/const navGroups = \[([\s\S]*?)\];/);
  if (!navGroupsMatch) throw new Error('navGroups definition not found in GuruView');
  return !/badge:\s*/.test(navGroupsMatch[1]);
});

test('GuruView does not render item.badge in sidebar or drawer', () => {
  return !guruContent.includes('item.badge');
});

test('GuruView has removed totalQuestionsBadge and activeExamsBadge variables', () => {
  return !guruContent.includes('totalQuestionsBadge') && !guruContent.includes('activeExamsBadge');
});

test('GuruView live HUD Pantau button uses bg-primary hover:bg-primary/90', () => {
  return /bg-primary\s+hover:bg-primary\/90\s+text-white\s+font-bold\s+text-\[11px\]\s+shrink-0\s+transition-colors\s+shadow-xs[\s\S]*?>\s*Pantau\s*<\/button>/.test(guruContent);
});

// 3. SiswaView.jsx
console.log('\n▶ [Suite 3] SiswaView Navigation Integrity:');
const siswaContent = fs.readFileSync(path.join(srcDir, 'views/SiswaView.jsx'), 'utf-8');

test('SiswaView jadwal tab contains zero badge properties', () => {
  return !/id:\s*'jadwal'[^}]*badge:/.test(siswaContent);
});

test('SiswaView does not render tab.badge in desktop tabs', () => {
  return !siswaContent.includes('tab.badge');
});

// 4. SkemaPenilaianPanel.jsx
console.log('\n▶ [Suite 4] SkemaPenilaianPanel Color Tokenization:');
const skemaContent = fs.readFileSync(path.join(srcDir, 'components/SkemaPenilaianPanel.jsx'), 'utf-8');

test('SkemaPenilaianPanel uses primary tokens instead of hardcoded emerald for active cards', () => {
  return skemaContent.includes('border-primary bg-primary/10 text-slate-800 dark:text-white ring-2 ring-primary/20') &&
         !skemaContent.includes('border-emerald-500');
});

test('SkemaPenilaianPanel radio buttons use text-primary', () => {
  return skemaContent.includes('text-primary dark:text-primary-400') &&
         !skemaContent.includes('text-emerald-600 dark:text-emerald-400');
});

test('SkemaPenilaianPanel info callout uses primary tokens instead of blue', () => {
  return skemaContent.includes('bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30') &&
         !skemaContent.includes('bg-blue-50/60');
});

test('SkemaPenilaianPanel save button uses bg-primary hover:bg-primary/90', () => {
  return skemaContent.includes('bg-primary hover:bg-primary/90 text-white') &&
         !skemaContent.includes('bg-emerald-600 hover:bg-emerald-700');
});

// 5. ModalPeriksaUraian.jsx
console.log('\n▶ [Suite 5] ModalPeriksaUraian Color Tokenization:');
const periksaContent = fs.readFileSync(path.join(srcDir, 'components/ModalPeriksaUraian.jsx'), 'utf-8');

test('ModalPeriksaUraian uses text-primary for student answer header', () => {
  return periksaContent.includes('text-primary dark:text-primary-400 mb-1 uppercase tracking-wider') &&
         !periksaContent.includes('text-emerald-600 dark:text-emerald-400');
});

test('ModalPeriksaUraian save button uses bg-primary hover:bg-primary/90', () => {
  return periksaContent.includes('bg-primary hover:bg-primary/90 text-white') &&
         !periksaContent.includes('bg-emerald-600 hover:bg-emerald-700');
});

// 6. Modal.jsx
console.log('\n▶ [Suite 6] Modal Confirmation Button Color Tokenization:');
const modalContent = fs.readFileSync(path.join(srcDir, 'components/Modal.jsx'), 'utf-8');

test('Modal confirm button uses bg-primary hover:bg-primary/90', () => {
  return modalContent.includes('bg-primary hover:bg-primary/90 text-white shadow-primary/30') &&
         !modalContent.includes('bg-blue-600 hover:bg-blue-700 shadow-blue-600/30');
});

// 7. index.css
console.log('\n▶ [Suite 7] Global index.css Academic Input Focus Tokenization:');
const cssContent = fs.readFileSync(path.join(srcDir, 'index.css'), 'utf-8');

test('academic-input:focus uses rgb(var(--color-primary-500)) and no hardcoded #10b981', () => {
  return cssContent.includes('border-color: rgb(var(--color-primary-500));') &&
         cssContent.includes('box-shadow: 0 0 0 4px rgb(var(--color-primary-500) / 0.15);') &&
         !cssContent.includes('#10b981');
});

console.log('\n========================================================================');
console.log(`M1 INTEGRITY RESULTS: ${stats.passed}/${stats.total} Passed (${stats.failed} Failed)`);
console.log('========================================================================\n');

if (stats.failed > 0) {
  console.error(`💥 VERDICT: REJECT - ${stats.failed} assertion(s) failed.`);
  process.exit(1);
} else {
  console.log('🎉 VERDICT: APPROVE - All M1 navigation & color integrity checks passed!');
  process.exit(0);
}
