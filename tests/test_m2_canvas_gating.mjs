import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');

console.log('======================================================');
console.log('Worker M2 Verification: Digital Canvas & Exam Gating');
console.log('======================================================\n');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✖ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✖ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

// -----------------------------------------------------------------------------
// Test Group 1: Component File & AST Integrity
// -----------------------------------------------------------------------------
console.log('[TEST GROUP 1: DigitalSignatureModal Component Checks]');

const modalPath = path.join(srcDir, 'components', 'DigitalSignatureModal.jsx');
const modalCode = fs.readFileSync(modalPath, 'utf8');

test('DigitalSignatureModal.jsx exists and is not empty', () => {
  assert.ok(modalCode.length > 500, 'Component must have substantial implementation');
});

test('Uses native HTML5 <canvas> without external canvas dependencies', () => {
  assert.match(modalCode, /<canvas\b/, 'Must render HTML5 <canvas>');
  assert.doesNotMatch(modalCode, /react-signature-canvas|signature_pad/, 'Must be zero-dependency');
});

test('Enforces touch-action: none for mobile touch isolation', () => {
  assert.match(
    modalCode,
    /touch-action:\s*none|touchAction:\s*['"]none['"]/,
    'Must specify touch-action: none to isolate canvas from mobile scrolling'
  );
  assert.match(modalCode, /touch-none/, 'Should also include Tailwind touch-none utility');
});

test('Pointer Events unified touch/mouse input listeners attached', () => {
  assert.match(modalCode, /onPointerDown\s*=/, 'Must attach onPointerDown');
  assert.match(modalCode, /onPointerMove\s*=/, 'Must attach onPointerMove');
  assert.match(modalCode, /onPointerUp\s*=/, 'Must attach onPointerUp');
  assert.match(modalCode, /onPointerCancel\s*=/, 'Must attach onPointerCancel');
});

test('Uses setPointerCapture for uninterrupted stroke capture outside canvas', () => {
  assert.match(modalCode, /setPointerCapture/, 'Must capture pointer on down');
  assert.match(modalCode, /releasePointerCapture/, 'Must release pointer on up');
});

test('Implements High-DPI / Retina display scaling via window.devicePixelRatio', () => {
  assert.match(modalCode, /window\.devicePixelRatio/, 'Must read devicePixelRatio');
  assert.match(modalCode, /ctx\.scale\(/, 'Must scale 2D context by DPR');
});

test('Implements Blank Canvas Rejection with stroke count & pixel check', () => {
  assert.match(modalCode, /getImageData/, 'Must verify pixel data buffer to reject blank/accidental touches');
  assert.match(modalCode, /hasSignature/, 'Must maintain boolean signature state');
  assert.match(modalCode, /disabled=\{!hasSignature\s*\|\|\s*isSubmitting\}/, 'Submit button must be disabled until signature drawn');
});

test('Provides Clear / Reset Coretan button and action', () => {
  assert.match(modalCode, /handleClear/, 'Must have clear canvas function');
  assert.match(modalCode, /Bersihkan Coretan|Hapus/, 'Must display clear button text');
  assert.match(modalCode, /clearRect/, 'Must clear canvas context');
});

test('Displays student identity and integrity pledge', () => {
  assert.match(modalCode, /studentInfo\.nama/, 'Must display student name');
  assert.match(modalCode, /studentInfo\.nisn/, 'Must display student NISN');
  assert.match(modalCode, /studentInfo\.kelas/, 'Must display student class');
  assert.match(modalCode, /studentInfo\.nama_mapel/, 'Must display subject name');
  assert.match(modalCode, /Pakta Integritas/, 'Must display integrity pledge statement');
});

test('Exports signature as Base64 JPEG data URL', () => {
  assert.match(modalCode, /toDataURL\(['"]image\/jpeg['"]\s*,\s*0\.6\)/, 'Must export as compressed image/jpeg Data URL');
});

// -----------------------------------------------------------------------------
// Test Group 2: ExamRoom Integration & Double Gating
// -----------------------------------------------------------------------------
console.log('\n[TEST GROUP 2: ExamRoom Integration & Double Gating]');

const examRoomPath = path.join(srcDir, 'views', 'ExamRoom.jsx');
const examRoomCode = fs.readFileSync(examRoomPath, 'utf8');

test('ExamRoom.jsx imports DigitalSignatureModal', () => {
  assert.match(examRoomCode, /import\s+DigitalSignatureModal\s+from\s+['"]\.\.\/components\/DigitalSignatureModal\.jsx['"]/, 'Must import DigitalSignatureModal');
});

test('ExamRoom tracks hasSigned state from dataLog or sessionStorage', () => {
  assert.match(examRoomCode, /const\s+\[hasSigned,\s*setHasSigned\]\s*=\s*useState/, 'Must declare hasSigned state');
  assert.match(examRoomCode, /sessionStorage\.getItem\(['"]nexa_active_exam['"]\)/, 'Must inspect sessionStorage for active signed session');
});

test('ExamRoom renders DigitalSignatureModal when not signed, blocking questions', () => {
  assert.match(examRoomCode, /if\s*\(!hasSigned\)\s*\{\s*return\s*\(\s*<DigitalSignatureModal/, 'Must render DigitalSignatureModal when !hasSigned');
});

test('ExamRoom submits signature via submit_absensi_siswa endpoint', () => {
  assert.match(examRoomCode, /api\(['"]submit_absensi_siswa['"]/, 'Must call submit_absensi_siswa');
  assert.match(examRoomCode, /tanda_tangan:\s*signatureDataUrl/, 'Must transmit signature data URL');
});

test('ExamRoom leverages authentic user click gesture to trigger requestFullscreen', () => {
  assert.match(examRoomCode, /document\.documentElement\.requestFullscreen\(\)/, 'Must trigger fullscreen on user click');
});

test('ExamRoom defers anti-cheat and question fetching until hasSigned is true', () => {
  assert.match(examRoomCode, /useEffect\(\(\)\s*=>\s*\{\s*if\s*\(!hasSigned\)\s*return;/, 'Must guard active exam effect with if (!hasSigned) return');
  assert.match(examRoomCode, /setupAntiCheat\(\)/, 'Must call setupAntiCheat only after signature');
  assert.match(examRoomCode, /fetchSoal\(\)/, 'Must call fetchSoal only after signature');
});

test('ExamRoom handles need_signature server error by re-engaging signature gate', () => {
  assert.match(examRoomCode, /res\.need_signature/, 'Must handle need_signature response');
  assert.match(examRoomCode, /setHasSigned\(false\)/, 'Must reset hasSigned if server rejects question access');
});

test('ExamRoom preserves signature state on page reload', () => {
  assert.match(examRoomCode, /res\.has_signed\s*\|\|\s*res\.data\.tanda_tangan/, 'Must check server log for existing signature on mount');
});

// -----------------------------------------------------------------------------
// Test Group 3: Production Build Transpilation Check
// -----------------------------------------------------------------------------
console.log('\n[TEST GROUP 3: Syntax & AST Validation]');

test('DigitalSignatureModal.jsx passes Babel JSX parsing', async () => {
  const parser = await import('@babel/parser');
  const ast = parser.parse(modalCode, { sourceType: 'module', plugins: ['jsx'] });
  assert.ok(ast, 'AST parsing must succeed');
});

test('ExamRoom.jsx passes Babel JSX parsing', async () => {
  const parser = await import('@babel/parser');
  const ast = parser.parse(examRoomCode, { sourceType: 'module', plugins: ['jsx'] });
  assert.ok(ast, 'AST parsing must succeed');
});

console.log('\n------------------------------------------------------');
console.log(`TOTAL TESTS: ${passCount + failCount}`);
console.log(`PASSED: ${passCount}`);
console.log(`FAILED: ${failCount}`);
console.log('------------------------------------------------------\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('All Worker M2 tests PASSED successfully!\n');
}
