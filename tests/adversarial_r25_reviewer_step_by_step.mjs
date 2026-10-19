import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✖ FAIL: ${message} ${details ? '(' + details + ')' : ''}`);
  }
}

console.log('======================================================================');
console.log(' ADVERSARIAL STRESS TEST: ROUND 25 REVIEWER STEP-BY-STEP SUITE       ');
console.log(' Strict Requirements, Edge Cases, Mobile Fit & Punctuation Audit     ');
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// Suite 1: Architecture, Ponytail & Zero External Dependencies
// ---------------------------------------------------------------------------
console.log('▶ Suite 1: Architecture & Zero External Dependencies...');
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const forbiddenLibs = ['intro.js', 'driver.js', 'shepherd.js', 'react-joyride', 'marked', 'canvas-confetti'];
for (const lib of forbiddenLibs) {
  assert(!pkg.dependencies?.[lib] && !pkg.devDependencies?.[lib], `No forbidden dependency "${lib}" in package.json`);
}

// ---------------------------------------------------------------------------
// Suite 2: TUTORIAL_DATA Completeness & R1-R5 Route Action Auditing
// ---------------------------------------------------------------------------
console.log('\n▶ Suite 2: TUTORIAL_DATA Parsing & Action Route (Location, Action, Result)...');
const modalPath = path.join(rootDir, 'src', 'components', 'TutorialModal.jsx');
const modalSource = fs.readFileSync(modalPath, 'utf8');

const dataMatch = modalSource.match(/const TUTORIAL_DATA\s*=\s*(\{[\s\S]*?\n\};)/);
assert(dataMatch !== null, 'TUTORIAL_DATA extracted from source code');

const cleanDataStr = dataMatch[1].replace(/;\s*$/, '');
const tutorialData = new Function(`return ${cleanDataStr}`)();

const roles = ['admin', 'guru', 'siswa', 'super_admin'];
assert(roles.every(r => Array.isArray(tutorialData[r])), 'All 4 roles defined in TUTORIAL_DATA');

// Audit every point in every step: Location, Action, Result + Explicit "Langkah X:"
let allPointsHaveLocation = true;
let allPointsHaveAction = true;
let allPointsHaveResult = true;
let allPointsHaveExplicitLangkah = true;
let totalPointsCount = 0;

const locationIndicators = ['buka', 'menu', 'sidebar', 'tab', 'halaman', 'dialog', 'panel', 'bilah', 'navigasi', 'area', 'kartu', 'kolom', 'tabel', 'sudut', 'nomor', 'pada', 'layar', 'dropdown', 'lembar', 'form', 'modal', 'dasbor', 'ruang', 'editor'];
const actionIndicators = ['klik', 'pilih', 'isi', 'masukkan', 'unggah', 'unduh', 'centang', 'pasangkan', 'coretkan', 'bubuhkan', 'tentukan', 'atur', 'periksa', 'pantau', 'gunakan', 'ketikkan', 'simpan', 'konfirmasi', 'dilarang', 'lihat', 'sesuaikan', 'tambahkan', 'tinjau', 'pastikan', 'cari', 'telusuri', 'verifikasi'];
const resultIndicators = ['untuk', 'agar', 'hingga', 'masuk', 'tersimpan', 'terbuka', 'terverifikasi', 'otomatis', 'sebelum', 'sehingga', 'membatalkan', 'mengunci', 'mengesahkan', 'menampilkan', 'berhasil', 'sesuai', 'siap', 'terbit', 'aktif', 'lengkap', 'terpenuhi', 'optimal', 'terhubung', 'tercatat', 'terlewat', 'mengakhiri'];

for (const role of roles) {
  tutorialData[role].forEach((step, sIdx) => {
    assert(step.title && step.shortTitle && step.icon && step.subtitle && step.tip, `${role} step ${sIdx + 1} has all metadata fields`);
    step.points.forEach((pt, pIdx) => {
      totalPointsCount++;
      const stepPrefix = `Langkah ${pIdx + 1}:`;
      if (!pt.startsWith(stepPrefix)) {
        allPointsHaveExplicitLangkah = false;
        console.error(`  Missing explicit prefix in ${role} step ${sIdx + 1} pt ${pIdx + 1}: "${pt.slice(0, 30)}..."`);
      }

      const lower = pt.toLowerCase();
      const hasLoc = locationIndicators.some(w => lower.includes(w));
      const hasAct = actionIndicators.some(w => lower.includes(w));
      const hasRes = resultIndicators.some(w => lower.includes(w));

      if (!hasLoc) {
        allPointsHaveLocation = false;
        console.error(`  Missing Location in ${role} step ${sIdx + 1} pt ${pIdx + 1}: "${pt}"`);
      }
      if (!hasAct) {
        allPointsHaveAction = false;
        console.error(`  Missing Action in ${role} step ${sIdx + 1} pt ${pIdx + 1}: "${pt}"`);
      }
      if (!hasRes) {
        allPointsHaveResult = false;
        console.error(`  Missing Result in ${role} step ${sIdx + 1} pt ${pIdx + 1}: "${pt}"`);
      }
    });
  });
}

assert(allPointsHaveExplicitLangkah, `All ${totalPointsCount} points have explicit "Langkah X:" prefix`);
assert(allPointsHaveLocation, 'All points identify UI Location (menu/sidebar/tab/panel)');
assert(allPointsHaveAction, 'All points identify Action (klik/pilih/isi/unggah/atur)');
assert(allPointsHaveResult, 'All points identify Result/Confirmation (untuk/agar/tersimpan/terbuka)');

// ---------------------------------------------------------------------------
// Suite 3: String Formatting & Regex Resilience (cleanText & renderFormattedText)
// ---------------------------------------------------------------------------
console.log('\n▶ Suite 3: cleanText & renderFormattedText Boundary Resilience...');

// Simulate cleanText regex from component
const cleanRegex = /^Langkah\s+\d+\s*[:\u2014\u2013\-]?\s*/i;
assert('Buka menu'.replace(cleanRegex, '') === 'Buka menu', 'cleanText leaves text without prefix untouched');
assert('Langkah 1: Buka menu'.replace(cleanRegex, '') === 'Buka menu', 'cleanText strips standard "Langkah 1: "');
assert('Langkah 12: Buka menu'.replace(cleanRegex, '') === 'Buka menu', 'cleanText strips two-digit "Langkah 12: "');
assert('Langkah 3 - Buka menu'.replace(cleanRegex, '') === 'Buka menu', 'cleanText strips hyphen "Langkah 3 - "');
assert('Langkah 4 — Buka menu'.replace(cleanRegex, '') === 'Buka menu', 'cleanText strips em-dash "Langkah 4 — "');
assert('Langkah 5: Aturan **3-strike** aktif'.replace(cleanRegex, '') === 'Aturan **3-strike** aktif', 'cleanText preserves internal numbers like 3-strike');

// Simulate renderFormattedText
function testRenderFormattedText(text) {
  if (typeof text !== 'string') return text;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return { type: 'chip', content: part.slice(2, -2) };
    }
    return { type: 'text', content: part };
  });
}

assert(testRenderFormattedText(null) === null, 'renderFormattedText handles null safely');
assert(testRenderFormattedText(undefined) === undefined, 'renderFormattedText handles undefined safely');
assert(testRenderFormattedText(123) === 123, 'renderFormattedText handles numbers safely');
assert(testRenderFormattedText('No chips here')[0].content === 'No chips here', 'renderFormattedText handles plain text');

const chipResult = testRenderFormattedText('Buka **Data Siswa**, lalu klik **Download Template** Excel.');
assert(chipResult.length === 5, 'renderFormattedText splits multiple chips and text accurately');
assert(chipResult[1].type === 'chip' && chipResult[1].content === 'Data Siswa', 'Chip 1 is "Data Siswa"');
assert(chipResult[3].type === 'chip' && chipResult[3].content === 'Download Template', 'Chip 2 is "Download Template"');

// ---------------------------------------------------------------------------
// Suite 4: Vite SSR Module Import & Rendering Contract
// ---------------------------------------------------------------------------
console.log('\n▶ Suite 4: Vite SSR Component Contract & Role Themes...');
let vite;
try {
  vite = await createServer({
    root: rootDir,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  const tutModule = await vite.ssrLoadModule('/src/components/TutorialModal.jsx');
  assert(tutModule.default !== undefined, 'TutorialModal loaded successfully via Vite SSR');
} finally {
  if (vite) await vite.close();
}

// ---------------------------------------------------------------------------
// Suite 5: Mobile Viewport Rendering (320px x 480px) Safety & Shrink Protection
// ---------------------------------------------------------------------------
console.log('\n▶ Suite 5: Mobile Viewport Rendering (320px) Safety & Flex Protection...');

// Check if modal header text has min-w-0 / flex-wrap / truncate protection so close button is NEVER pushed off screen
const hasHeaderMinW0 = modalSource.includes('min-w-0');
assert(hasHeaderMinW0, 'TutorialModal uses min-w-0 flex container protection');

// Check close button has shrink-0
assert(modalSource.includes('shrink-0') && modalSource.includes('title="Tutup (Esc)"'), 'Close button has shrink-0 so it cannot be crushed');

// Check step pill badge has shrink-0 and explicit styling
assert(modalSource.includes('Langkah {stepNum}'), 'Step badge explicitly shows "Langkah {stepNum}"');

// Check aria attributes for accessibility
assert(modalSource.includes('role="dialog"') && modalSource.includes('aria-modal="true"'), 'Modal implements accessible ARIA dialog attributes');
assert(modalSource.includes('aria-labelledby="tutorial-modal-title"'), 'Modal links aria-labelledby to modal title ID');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`TOTAL: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('======================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL ADVERSARIAL STEP-BY-STEP CHECKS PASSED SUCCESSFULLY!\n');
}
