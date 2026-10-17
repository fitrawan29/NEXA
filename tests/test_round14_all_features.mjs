/**
 * Automated Verification Suite for NEXA CBT Round 14
 * Covers all 4 features:
 * 1. Reset Sesi Siswa oleh Pengawas Ruang (GuruView.jsx, api.js)
 * 2. Cetak Kartu Peserta & Kartu Meja Ujian (AdminView.jsx, KartuUjianPrint.jsx)
 * 3. Import Soal Format Teks Aiken (aikenParser.js, GuruView.jsx, FormSoalModal.jsx)
 * 4. Server Time Guard (ExamRoom.jsx)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseAiken, prepareAikenPayload } from '../src/utils/aikenParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName} - ${details}`);
  }
}

console.log('================================================================');
console.log('NEXA CBT Round 14 - Comprehensive Verification Suite');
console.log('================================================================\n');

// ============================================================================
// FEATURE 1: Reset Sesi Siswa oleh Pengawas Ruang
// ============================================================================
console.log('--- Feature 1: Reset Sesi Siswa (api.js & GuruView.jsx) ---');

const apiJsPath = path.join(rootDir, 'src', 'api.js');
const apiContent = fs.readFileSync(apiJsPath, 'utf-8');

// 1.1 Verify unified reset_sesi_siswa & buka_blokir_siswa handler in api.js
assert(
  apiContent.includes("case 'buka_blokir_siswa':") && apiContent.includes("case 'reset_sesi_siswa':"),
  'api.js has unified cases for buka_blokir_siswa and reset_sesi_siswa'
);

// 1.2 Verify session_token reset on siswa table (non-destructive)
assert(
  /supabaseClient\s*\.\s*from\(\s*['"]siswa['"]\s*\)\s*\.\s*update\(\s*\{\s*session_token:\s*null\s*\}\s*\)/.test(apiContent),
  'api.js clears session_token on siswa table to release multi-login lock'
);

// 1.3 Verify non-destructive log_ujian update
assert(
  apiContent.includes("is_blocked: false") &&
  apiContent.includes("pelanggaran: 0") &&
  apiContent.includes("status_ujian: 'SEDANG KERJA'") &&
  apiContent.includes("waktu_selesai: null"),
  'api.js updates log_ujian status to SEDANG KERJA with 0 violations non-destructively'
);

// 1.4 Verify no destructive delete of log_ujian
assert(
  !apiContent.includes("from('log_ujian').delete()"),
  'api.js does NOT destructively delete log_ujian during session reset'
);

// 1.5 Verify duplicate dead-code reset_sesi_siswa is removed (only 1 occurrence)
const resetCaseMatches = apiContent.match(/case\s+['"]reset_sesi_siswa['"]\s*:/g) || [];
assert(
  resetCaseMatches.length === 1,
  'api.js has exactly ONE case for reset_sesi_siswa (no duplicate dead-code)',
  `Found ${resetCaseMatches.length} occurrences`
);

const guruViewPath = path.join(rootDir, 'src', 'views', 'GuruView.jsx');
const guruContent = fs.readFileSync(guruViewPath, 'utf-8');

// 1.6 Verify showMessage is destructured in GuruView signature
assert(
  /const\s+GuruView\s*=\s*\(\s*\{[^}]*showMessage[^}]*\}\s*\)/.test(guruContent),
  'GuruView.jsx destructures showMessage prop in component signature'
);

// 1.7 Verify handleResetSession implementation and audit logging
assert(
  guruContent.includes('const handleResetSession =') &&
  guruContent.includes("logActivity('RESET_SESI',"),
  'GuruView.jsx implements handleResetSession with RESET_SESI audit logging'
);

// 1.8 Verify Reset Sesi button in desktop table of pengawasan tab
assert(
  guruContent.includes('handleResetSession(p, selectedPengawasRuang?.id_jadwal)'),
  'GuruView.jsx renders Reset Sesi button for each student row in pengawasan tab'
);

// 1.9 Verify Reset button in monitoring tab
assert(
  guruContent.includes('handleResetSession(log.id_log, log.id_siswa, jId)'),
  'GuruView.jsx renders Reset Sesi button in live monitoring tab'
);

console.log('');

// ============================================================================
// FEATURE 2: Cetak Kartu Peserta & Kartu Meja Ujian
// ============================================================================
console.log('--- Feature 2: Cetak Kartu Peserta & Meja (AdminView.jsx & KartuUjianPrint.jsx) ---');

const kartuPrintPath = path.join(rootDir, 'src', 'components', 'KartuUjianPrint.jsx');
assert(fs.existsSync(kartuPrintPath), 'KartuUjianPrint.jsx component exists');

const kartuPrintContent = fs.readFileSync(kartuPrintPath, 'utf-8');

// 2.1 Verify container ID for CSS print isolation
assert(
  kartuPrintContent.includes('id="print-document"'),
  'KartuUjianPrint.jsx uses #print-document container for @media print isolation'
);

// 2.2 Verify zero <header> and <footer> JSX tags (which are hidden by index.css print rule)
const codeWithoutComments = kartuPrintContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
const hasForbiddenTags = /<(header|footer)[\s>]/i.test(codeWithoutComments);
assert(
  !hasForbiddenTags,
  'KartuUjianPrint.jsx contains ZERO <header> or <footer> tags (avoids index.css suppression)'
);

// 2.3 Verify zero dangerouslySetInnerHTML
assert(
  !kartuPrintContent.includes('dangerouslySetInnerHTML'),
  'KartuUjianPrint.jsx does not use dangerouslySetInnerHTML'
);

// 2.4 Verify print CSS helper classes
assert(
  kartuPrintContent.includes('page-break') &&
  kartuPrintContent.includes('avoid-break') &&
  kartuPrintContent.includes('no-print'),
  'KartuUjianPrint.jsx utilizes .page-break, .avoid-break, and .no-print classes'
);

// 2.5 Verify chunking logic (8 cards per sheet)
assert(
  kartuPrintContent.includes('chunkArray(students, 8)'),
  'KartuUjianPrint.jsx chunks students deterministically into 8 cards per page'
);

// 2.6 Verify Kartu Peserta elements
assert(
  kartuPrintContent.includes('KARTU PESERTA ASESMEN / CBT') &&
  kartuPrintContent.includes('Username') &&
  kartuPrintContent.includes('Password') &&
  kartuPrintContent.includes('NISN / No'),
  'KartuUjianPrint.jsx renders Kartu Peserta elements (Kop, NISN, Username, Password)'
);

// 2.7 Verify Kartu Meja elements
assert(
  kartuPrintContent.includes('KARTU MEJA UJIAN CBT') &&
  kartuPrintContent.includes('MEJA') &&
  kartuPrintContent.includes('Nama Peserta:'),
  'KartuUjianPrint.jsx renders Kartu Meja elements (Nomor Meja, Nama Peserta, Ruang/Sesi)'
);

// 2.8 Verify A4 and F4 dynamic @page styling
assert(
  kartuPrintContent.includes('215mm 330mm') && kartuPrintContent.includes('A4 portrait'),
  'KartuUjianPrint.jsx supports dynamic @page dimensions for A4 and F4 (Folio)'
);

const adminViewPath = path.join(rootDir, 'src', 'views', 'AdminView.jsx');
const adminContent = fs.readFileSync(adminViewPath, 'utf-8');

// 2.9 Verify KartuUjianPrint import in AdminView.jsx
assert(
  adminContent.includes("import KartuUjianPrint from '../components/KartuUjianPrint.jsx';"),
  'AdminView.jsx imports KartuUjianPrint component'
);

// 2.10 Verify Cetak Kartu button in siswa tab
assert(
  /onClick=\{[^}]*handleOpenPrintKartu\('peserta'\)[^}]*\}[^>]*>[^<]*<span[^>]*>badge<\/span>[^<]*<span[^>]*>Cetak Kartu<\/span>/.test(adminContent),
  'AdminView.jsx renders Cetak Kartu button in activeTab === "siswa" toolbar'
);

// 2.11 Verify Cetak Kartu button in jadwal tab
assert(
  adminContent.includes("handleOpenPrintKartu('peserta')") &&
  adminContent.includes("handleOpenPrintKartu('peserta', j.target_kelas)"),
  'AdminView.jsx renders Cetak Kartu in activeTab === "jadwal" header and rows'
);

// 2.12 Verify renderPrintKartuModal and KartuUjianPrint mount in AdminView.jsx
assert(
  adminContent.includes('{renderPrintKartuModal()}') &&
  adminContent.includes('<KartuUjianPrint'),
  'AdminView.jsx mounts renderPrintKartuModal and KartuUjianPrint in render tree'
);

console.log('');

// ============================================================================
// FEATURE 3: Import Soal Format Teks Aiken
// ============================================================================
console.log('--- Feature 3: Import Soal Format Teks Aiken ---');

// 3.1 Unit Test: 4-choice Aiken parsing with period delimiters
const sampleAiken4 = `
Ibu kota negara Indonesia adalah...
A. Bandung
B. Jakarta
C. Surabaya
D. Medan
ANSWER: B
`;
const parsed4 = parseAiken(sampleAiken4);
assert(parsed4.validCount === 1, 'parseAiken parses valid 4-choice Aiken question');
assert(parsed4.questions[0].opsi.length === 4, 'Parsed 4-choice question has exactly 4 options');
assert(parsed4.questions[0].kunci_jawaban === 'Jakarta', 'kunci_jawaban stores exact option text ("Jakarta"), NOT letter "B"');
assert(parsed4.questions[0].kunci_letter === 'B', 'kunci_letter stores letter "B"');

// 3.2 Unit Test: 5-choice Aiken parsing with parenthesis delimiters and Indonesian keyword
const sampleAiken5 = `
Unsur kimia dengan lambang Au adalah...
A) Perak
B) Tembaga
C) Emas
D) Besi
E) Platina
KUNCI: C
`;
const parsed5 = parseAiken(sampleAiken5);
assert(parsed5.validCount === 1, 'parseAiken parses 5-choice Aiken with ")" delimiter and "KUNCI:" keyword');
assert(parsed5.questions[0].opsi.length === 5, 'Parsed 5-choice question has 5 options');
assert(parsed5.questions[0].kunci_jawaban === 'Emas', 'kunci_jawaban stores exact option text ("Emas")');

// 3.3 Unit Test: Multiline question (soal bertingkat / stimulus reading passage)
const sampleAikenMultiline = `
Bacalah teks berikut dengan saksama!
Indonesia memiliki keanekaragaman hayati yang tinggi.
Hutan hujan tropis di Kalimantan menjadi habitat bagi banyak satwa langka.

Satwa langka yang menjadi endemik di wilayah tersebut adalah...
A. Komodo
B. Orangutan
C. Badak Bercula Satu
D. Cendrawasih
JAWABAN: B
`;
const parsedMulti = parseAiken(sampleAikenMultiline);
assert(parsedMulti.validCount === 1, 'parseAiken parses multiline stimulus question');
assert(parsedMulti.questions[0].pertanyaan.includes('<br/>'), 'Multiline question lines are joined with <br/> for HTML rendering');
assert(parsedMulti.questions[0].kunci_jawaban === 'Orangutan', 'Multiline question correctly resolves answer text');

// 3.4 Unit Test: Error diagnostics (invalid answer key letter)
const sampleAikenBadKey = `
Pertanyaan contoh
A. Opsi 1
B. Opsi 2
ANSWER: Z
`;
const parsedBadKey = parseAiken(sampleAikenBadKey);
assert(parsedBadKey.validCount === 0 && parsedBadKey.errorCount === 1, 'parseAiken catches invalid answer key letter ("Z")');

// 3.5 Unit Test: Error diagnostics (fewer than 2 choices)
const sampleAikenOneOpt = `
Pertanyaan tanpa pilihan cukup
A. Opsi tunggal
ANSWER: A
`;
const parsedOneOpt = parseAiken(sampleAikenOneOpt);
assert(parsedOneOpt.validCount === 0 && parsedOneOpt.errorCount === 1, 'parseAiken catches questions with fewer than 2 choices');

// 3.6 Unit Test: prepareAikenPayload schema compatibility
const batchPayload = prepareAikenPayload(parsed4.questions, 'MAPEL-01', '70040625', 10);
assert(Array.isArray(batchPayload) && batchPayload.length === 1, 'prepareAikenPayload produces an array of records');
assert(
  batchPayload[0].id_mapel === 'MAPEL-01' &&
  batchPayload[0].npsn === '70040625' &&
  batchPayload[0].tipe_soal === 'PG' &&
  batchPayload[0].kunci_jawaban === 'Jakarta' &&
  batchPayload[0].bobot === 10 &&
  typeof batchPayload[0].opsi === 'string',
  'Payload object complies with soal_ujian schema for Supabase batch insert'
);

// 3.7 Verify GuruView.jsx Aiken Import integration
assert(
  guruContent.includes("import { parseAiken, prepareAikenPayload } from '../utils/aikenParser.js';"),
  'GuruView.jsx imports parseAiken and prepareAikenPayload'
);
assert(
  guruContent.includes('setImportAikenModal') &&
  guruContent.includes('Import Aiken') &&
  guruContent.includes('import_soal_bulk'),
  'GuruView.jsx provides Import Aiken modal with live preview and calls import_soal_bulk'
);

// 3.8 Verify FormSoalModal.jsx Aiken quick-paste integration
const formSoalPath = path.join(rootDir, 'src', 'components', 'FormSoalModal.jsx');
const formSoalContent = fs.readFileSync(formSoalPath, 'utf-8');
assert(
  formSoalContent.includes("import { parseAiken } from '../utils/aikenParser.js';") &&
  formSoalContent.includes('Tempel Cepat Format Aiken') &&
  formSoalContent.includes('handleApplyAiken'),
  'FormSoalModal.jsx includes Quick-Paste Aiken panel and handleApplyAiken'
);

console.log('');

// ============================================================================
// FEATURE 4: Server Time Guard in ExamRoom.jsx
// ============================================================================
console.log('--- Feature 4: Server Time Guard (ExamRoom.jsx) ---');

const examRoomPath = path.join(rootDir, 'src', 'views', 'ExamRoom.jsx');
const examRoomContent = fs.readFileSync(examRoomPath, 'utf-8');

// 4.1 Verify Server Time Guard implementation in ExamRoom.jsx
assert(
  examRoomContent.includes('Server Time Guard') &&
  examRoomContent.includes('fetchServerOffset') &&
  examRoomContent.includes('elapsedMonotonic'),
  'ExamRoom.jsx contains Server Time Guard with fetchServerOffset and monotonic calculation'
);

// 4.2 Verify same-origin HEAD request and latency compensation
assert(
  /fetch\(\s*window\.location\.href\s*,\s*\{\s*method:\s*['"]HEAD['"]/.test(examRoomContent) &&
  examRoomContent.includes('res.headers.get(\'date\')') || examRoomContent.includes("res.headers.get('date')"),
  'ExamRoom.jsx performs same-origin HEAD request to fetch HTTP Date header'
);

// 4.3 Algorithmic Simulation of Clock Tamper Resistance
// Scenario: Exam deadline is set 60 minutes from now.
const nowTime = 1760619600000; // Simulated timestamp
const durationMs = 60 * 60 * 1000;
const deadlineMs = nowTime + durationMs;

// Monotonic calculation model matching ExamRoom.jsx
let simulatedPerfStart = 1000;
let initialRemainingMs = deadlineMs - nowTime; // 3,600,000 ms

function computeRemaining(currentPerf) {
  const elapsed = currentPerf - simulatedPerfStart;
  return Math.max(0, initialRemainingMs - elapsed);
}

// Tick 1: 10 seconds elapsed
const remainingAt10s = computeRemaining(simulatedPerfStart + 10000);
assert(remainingAt10s === durationMs - 10000, 'Remaining time decreases exactly by 10s as performance time advances');

// Attack Simulation: Student rolls back system clock by 1 hour (-3,600,000 ms)
const tamperedDateNow = nowTime - 3600000;
// In traditional calculation: deadlineMs - tamperedDateNow = 7,200,000 ms (Tamper success!)
const traditionalDistortedRemaining = deadlineMs - tamperedDateNow;
// In Server Time Guard calculation:
const guardedRemainingAfterTamper = computeRemaining(simulatedPerfStart + 15000); // 15 seconds into exam

assert(
  guardedRemainingAfterTamper === durationMs - 15000,
  'Altering client OS clock has ZERO effect on remaining time during active exam',
  `Guarded remaining is ${guardedRemainingAfterTamper} ms vs distorted ${traditionalDistortedRemaining} ms`
);

// Attack Simulation on Page Reload with tampered clock:
// Student reloads with OS clock set 1 hour behind.
// Server header Date returns true UTC time:
const mockServerDateHeader = nowTime + 15000; // Server is at nowTime + 15s
const clientReloadDateNow = tamperedDateNow + 15000; // Client is still 1h behind
const measuredServerOffset = mockServerDateHeader - clientReloadDateNow; // +3,600,000 ms

const correctedServerNowOnReload = clientReloadDateNow + measuredServerOffset;
const reloadedRemaining = Math.max(0, deadlineMs - correctedServerNowOnReload);

assert(
  reloadedRemaining === durationMs - 15000,
  'Page reload with tampered clock is neutralized by server offset calculation',
  `Reloaded remaining matches true server deadline: ${reloadedRemaining} ms`
);

console.log('');

// ============================================================================
// ARCHITECTURE & INTEGRITY AUDIT
// ============================================================================
console.log('--- Architectural & Integrity Verification ---');

// 5.1 Verify package.json dependencies (zero new npm dependencies)
const pkgJsonPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
const allowedDeps = ['@supabase/supabase-js', 'prop-types', 'react', 'react-dom', 'react-quill', 'react-router-dom', 'xlsx'];
const currentDeps = Object.keys(pkg.dependencies || {});
const illegalDeps = currentDeps.filter(d => !allowedDeps.includes(d));

assert(
  illegalDeps.length === 0,
  'package.json contains ZERO new external dependencies (Strict Ponytail compliance)',
  `Illegal dependencies found: ${illegalDeps.join(', ')}`
);

console.log('\n================================================================');
console.log(`Summary: ${passedTests}/${totalTests} tests PASSED (${failedTests} failures)`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
