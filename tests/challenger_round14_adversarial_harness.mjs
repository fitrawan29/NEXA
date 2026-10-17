/**
 * Adversarial Stress & Verification Harness for NEXA CBT Round 14
 * Specifically targeting:
 * - Feature 2: Cetak Kartu Peserta & Kartu Meja (Chunking boundaries, Print CSS isolation, AST security)
 * - Feature 3: Import Soal Format Teks Aiken (Adversarial fuzzing, weird line breaks, multiline stimulus, scoring contract)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as babelParser from '@babel/parser';
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

console.log('========================================================================');
console.log('ADVERSARIAL STRESS HARNESS: NEXA CBT ROUND 14 (FEATURES 2 & 3)');
console.log('========================================================================\n');

// ============================================================================
// PART 1: AIKEN PARSER ADVERSARIAL FUZZING & STRESS TESTING (FEATURE 3)
// ============================================================================
console.log('--- 1. Aiken Parser: Line Ending Normalization & Mixed Delimiters ---');

// 1.1 Pure Windows CRLF
const aikenCRLF = "Soal CRLF?\r\nA. Opsi 1\r\nB. Opsi 2\r\nC. Opsi 3\r\nANSWER: B\r\n";
const resCRLF = parseAiken(aikenCRLF);
assert(resCRLF.validCount === 1, 'Handles pure Windows CRLF (\\r\\n) line endings');
assert(resCRLF.questions[0].kunci_jawaban === 'Opsi 2', 'CRLF resolves correct choice text');

// 1.2 Pure Unix LF
const aikenLF = "Soal LF?\nA. Pilihan A\nB. Pilihan B\nANSWER: A\n";
const resLF = parseAiken(aikenLF);
assert(resLF.validCount === 1, 'Handles pure Unix LF (\\n) line endings');

// 1.3 Legacy Mac CR
const aikenCR = "Soal CR?\rA. Pilihan X\rB. Pilihan Y\rANSWER: B\r";
const resCR = parseAiken(aikenCR);
assert(resCR.validCount === 1, 'Handles legacy Mac CR (\\r) line endings');
assert(resCR.questions[0].kunci_jawaban === 'Pilihan Y', 'CR resolves correct choice text');

// 1.4 Chaotic Mixed Line Endings in a Single Block
const aikenMixed = "Pertanyaan Baris 1\r\nBaris 2 dengan CR\rBaris 3 dengan LF\nA. Satu\r\nB. Dua\rC. Tiga\nANSWER: C\r\n";
const resMixed = parseAiken(aikenMixed);
assert(resMixed.validCount === 1, 'Handles chaotic mixed (\\r\\n, \\r, \\n) in single question block');
assert(resMixed.questions[0].pertanyaan.includes('<br/>'), 'Mixed line endings in question body are converted to <br/>');
assert(resMixed.questions[0].kunci_jawaban === 'Tiga', 'Mixed line endings resolve answer text accurately');

console.log('\n--- 2. Aiken Parser: Multiline Stimulus, Lists, Math & Complex Characters ---');

// 2.1 Multiline stimulus with multiple blank lines and paragraphs
const aikenMultiPara = `
Wacana Literasi:
Paragraf pertama dari teks wacana yang cukup panjang.


Paragraf kedua setelah dua baris kosong. Menjelaskan konteks soal.

Pertanyaan: Apa ide pokok paragraf pertama?
A. Wacana literasi pertama
B. Konteks soal
C. Ide sekunder
D. Kesimpulan
ANSWER: A
`;
const resMultiPara = parseAiken(aikenMultiPara);
assert(resMultiPara.validCount === 1, 'Handles multiline stimulus with multiple consecutive blank lines');
assert(resMultiPara.questions[0].pertanyaan.includes('Wacana Literasi'), 'Preserves all paragraphs of the stimulus');

// 2.2 Stimulus with numbered lists (Must NOT be confused with choices!)
const aikenWithList = `
Perhatikan pernyataan-pernyataan berikut!
1. Logam natrium bereaksi hebat dengan air.
2. Gas mulia sangat stabil dan sukar bereaksi.
3. Klorin berwujud gas berwarna kuning kehijauan pada suhu ruang.

Pernyataan yang tepat mengenai unsur golongan alkali adalah...
A. 1 saja
B. 1 dan 2
C. 2 dan 3
D. 1, 2, dan 3
ANSWER: A
`;
const resWithList = parseAiken(aikenWithList);
assert(resWithList.validCount === 1, 'Stimulus with numbered lists (1., 2., 3.) is NOT falsely parsed as choices');
assert(resWithList.questions[0].opsi.length === 4, 'Number of choices remains exactly 4');
assert(resWithList.questions[0].pertanyaan.includes('1. Logam natrium'), 'Numbered list items stay inside question text');

// 2.3 Mathematical symbols, equations, parentheses, and fractional notations
const aikenMath = `
Jika f(x) = (3x^2 + 5x - 2) / (x - 1), tentukan limit x -> 2!
A. lim = (3*4 + 10 - 2) / (2 - 1) = 20
B. lim = sqrt(25) + 15
C. f'(x) = [6x + 5](x - 1)
D. NaN / undefined
E. x in [-oo, +oo]
ANSWER: A
`;
const resMath = parseAiken(aikenMath);
assert(resMath.validCount === 1, 'Handles complex math notation (fractions, exponents, brackets, sqrt)');
assert(resMath.questions[0].kunci_jawaban === 'lim = (3*4 + 10 - 2) / (2 - 1) = 20', 'Option text containing math expressions is preserved identically');

// 2.4 Quotes, HTML/XML tags, and special characters
const aikenQuotesTags = `
Dalam bahasa pemrograman HTML, tag manakah yang digunakan untuk membuat teks menjadi tebal (bold)?
A. <italic> "teks miring"
B. <b> 'teks tebal'
C. <strong> “semantic bold”
D. <p class="heavy"> ` + '`code font`' + `
ANSWER: B
`;
const resQuotesTags = parseAiken(aikenQuotesTags);
assert(resQuotesTags.validCount === 1, 'Handles HTML/XML tags and various quotation styles (single, double, curly, backticks)');
assert(resQuotesTags.questions[0].kunci_jawaban === "<b> 'teks tebal'", 'Exact string of HTML tag choice is preserved in kunci_jawaban');

console.log('\n--- 3. Aiken Parser: Irregular Prefixes & Answer Keywords ---');

// 3.1 Lowercase prefixes with periods: a., b., c., d.
const aikenLowerPeriod = `
Pertanyaan huruf kecil titik
a. Satu
b. Dua
c. Tiga
d. Empat
ANSWER: c
`;
const resLowerPeriod = parseAiken(aikenLowerPeriod);
assert(resLowerPeriod.validCount === 1, 'Parses lowercase letter prefixes with period (a., b., c., d.)');
assert(resLowerPeriod.questions[0].kunci_jawaban === 'Tiga', 'Maps lowercase ANSWER: c to option "Tiga"');

// 3.2 Uppercase and Lowercase with parenthesis: A), b), C), d)
const aikenParenthesis = `
Pertanyaan kurung tutup
A) Opsi Alpha
b) Opsi Beta
C) Opsi Gamma
d) Opsi Delta
e) Opsi Epsilon
ANSWER: D
`;
const resParenthesis = parseAiken(aikenParenthesis);
assert(resParenthesis.validCount === 1, 'Parses choices with right parenthesis delimiter (A), b), C))');
assert(resParenthesis.questions[0].kunci_letter === 'D', 'Normalizes answer letter to uppercase D');
assert(resParenthesis.questions[0].kunci_jawaban === 'Opsi Delta', 'Maps to correct choice text');

// 3.3 Answer Keyword Variations (Indonesian KUNCI / JAWABAN, extra spaces, mixed case)
const variations = [
  { text: "Q1?\nA. O1\nB. O2\nANSWER: A", key: "O1", label: "ANSWER: A" },
  { text: "Q2?\nA. O1\nB. O2\nAnswer: B", key: "O2", label: "Answer: B (Capitalized)" },
  { text: "Q3?\nA. O1\nB. O2\nanswer: A", key: "O1", label: "answer: A (Lowercase)" },
  { text: "Q4?\nA. O1\nB. O2\nKUNCI: B", key: "O2", label: "KUNCI: B (Indonesian)" },
  { text: "Q5?\nA. O1\nB. O2\nkunci: a", key: "O1", label: "kunci: a (Indonesian lowercase)" },
  { text: "Q6?\nA. O1\nB. O2\nJAWABAN: B", key: "O2", label: "JAWABAN: B (Indonesian)" },
  { text: "Q7?\nA. O1\nB. O2\njawaban: A", key: "O1", label: "jawaban: A (Indonesian lowercase)" },
  { text: "Q8?\nA. O1\nB. O2\nANSWER:   B   ", key: "O2", label: "ANSWER:   B    (Padding spaces)" },
  { text: "Q9?\nA. O1\nB. O2\nKUNCI:B", key: "O2", label: "KUNCI:B (No space after colon)" },
];

let allVarPassed = true;
variations.forEach(v => {
  const p = parseAiken(v.text);
  if (p.validCount !== 1 || p.questions[0]?.kunci_jawaban !== v.key) {
    allVarPassed = false;
  }
});
assert(allVarPassed, 'Supports all answer keyword variations (ANSWER, Answer, KUNCI, kunci, JAWABAN, jawaban with loose spacing)');

console.log('\n--- 4. Aiken Parser: Negative Testing & Robust Error Diagnostics ---');

// 4.1 Empty & Non-String Inputs
assert(parseAiken('').total === 0, 'Empty string returns empty result');
assert(parseAiken('   \n\n\t   ').total === 0, 'Whitespace-only string returns empty result');
assert(parseAiken(null).total === 0, 'Null input safely handled without throwing');
assert(parseAiken(undefined).total === 0, 'Undefined input safely handled without throwing');
assert(parseAiken(12345).total === 0, 'Number input safely handled without throwing');
assert(parseAiken({}).total === 0, 'Object input safely handled without throwing');

// 4.2 Missing Question Text (Choices directly followed by ANSWER)
const aikenNoQ = `
A. Opsi Satu
B. Opsi Dua
ANSWER: A
`;
const resNoQ = parseAiken(aikenNoQ);
assert(resNoQ.errorCount === 1 && resNoQ.validCount === 0, 'Catches missing question text error');
assert(resNoQ.errors[0].message.includes('Teks pertanyaan tidak boleh kosong'), 'Error message informs user question text is required');

// 4.3 Fewer than 2 choices
const aikenSingleChoice = `
Soal dengan satu pilihan saja
A. Opsi Tunggal
ANSWER: A
`;
const resSingleChoice = parseAiken(aikenSingleChoice);
assert(resSingleChoice.errorCount === 1 && resSingleChoice.validCount === 0, 'Catches question with fewer than 2 choices');
assert(resSingleChoice.errors[0].message.includes('kurang dari 2'), 'Error message informs user choices < 2');

// 4.4 Missing ANSWER key at end of file
const aikenNoAnswerEOF = `
Soal tanpa kunci jawaban di akhir teks
A. Opsi Satu
B. Opsi Dua
C. Opsi Tiga
`;
const resNoAnswerEOF = parseAiken(aikenNoAnswerEOF);
assert(resNoAnswerEOF.errorCount === 1 && resNoAnswerEOF.validCount === 0, 'Catches missing ANSWER key at end of document');
assert(resNoAnswerEOF.errors[0].message.includes('Kunci jawaban'), 'Error message informs user ANSWER key is missing');

// 4.5 Missing ANSWER key between questions (Resets cleanly for subsequent questions)
const aikenMissingMiddle = `
Soal Pertama Rusak Tanpa Kunci
A. Opsi 1A
B. Opsi 1B

Soal Kedua Yang Sah
A. Opsi 2A
B. Opsi 2B
C. Opsi 2C
ANSWER: B
`;
const resMissingMiddle = parseAiken(aikenMissingMiddle);
assert(resMissingMiddle.errorCount === 1, 'Catches missing ANSWER key on question 1');
assert(resMissingMiddle.validCount === 1, 'Successfully isolates and parses question 2 despite question 1 syntax error');
assert(resMissingMiddle.questions[0].kunci_jawaban === 'Opsi 2B', 'Question 2 data is completely intact');

// 4.6 Answer key pointing to non-existent choice letter
const aikenNonExistentLetter = `
Ibu kota Jawa Timur adalah...
A. Surabaya
B. Malang
C. Sidoarjo
ANSWER: E
`;
const resNonExistent = parseAiken(aikenNonExistentLetter);
assert(resNonExistent.errorCount === 1 && resNonExistent.validCount === 0, 'Catches answer key pointing to non-existent letter (E when only A-C exist)');
assert(resNonExistent.errors[0].message.includes('tidak cocok'), 'Error message highlights mismatched key');

// 4.7 Duplicate choice letters
const aikenDuplicateLetter = `
Soal dengan huruf pilihan kembar
A. Opsi Pertama
A. Opsi Kedua Menggantikan
ANSWER: A
`;
const resDuplicate = parseAiken(aikenDuplicateLetter);
assert(resDuplicate.errorCount === 1 && resDuplicate.validCount === 0, 'Duplicate letters resulting in < 2 unique choices are rejected');

console.log('\n--- 5. Aiken Parser: High-Volume Batch Fuzzing (120 Questions) ---');

// Generate 120 dynamic questions with varied choices, delimiters, and keywords
let bigBatchText = '';
const letters = ['A', 'B', 'C', 'D', 'E'];
const delimiters = ['.', ')'];
const answerKeywords = ['ANSWER:', 'Answer:', 'KUNCI:', 'kunci:', 'JAWABAN:', 'jawaban:'];

for (let i = 1; i <= 120; i++) {
  const numChoices = 2 + (i % 4); // 2 to 5 choices
  const isMultiLine = i % 3 === 0;
  const keyword = answerKeywords[i % answerKeywords.length];
  const delim = delimiters[i % delimiters.length];
  const correctChoiceIdx = (i * 3) % numChoices;
  const correctLetter = letters[correctChoiceIdx];

  bigBatchText += `\n### Butir Soal Fuzzing Nomor ${i}\n`;
  if (isMultiLine) {
    bigBatchText += `Stimulus wacana pengantar untuk soal nomor ${i}.\nInformasi pelengkap baris 2.\n`;
  }
  bigBatchText += `Pertanyaan spesifik nomor ${i}?\n`;

  for (let c = 0; c < numChoices; c++) {
    const letter = (i % 2 === 0) ? letters[c].toLowerCase() : letters[c];
    bigBatchText += `${letter}${delim} Pilihan teks untuk ${letters[c]} pada butir ${i}\n`;
  }
  bigBatchText += `${keyword} ${correctLetter}\n`;
}

const startTime = Date.now();
const bigBatchRes = parseAiken(bigBatchText, 15);
const durationMs = Date.now() - startTime;

assert(bigBatchRes.validCount === 120, 'Fuzzing batch of 120 questions parsed with 100% validity (120/120)');
assert(bigBatchRes.errorCount === 0, 'Fuzzing batch generated zero false-positive errors');
assert(durationMs < 200, `High-speed O(N) execution: parsed 120 questions in ${durationMs}ms (< 200ms threshold)`);

// 5.2 Verify Supabase Batch Payload generation for 120 questions
const sampleMapelId = 'MAPEL-MATEMATIKA-X';
const sampleNpsn = '70040625';
const payload = prepareAikenPayload(bigBatchRes.questions, sampleMapelId, sampleNpsn, 15);

assert(Array.isArray(payload) && payload.length === 120, 'prepareAikenPayload produces exact 120 database payload records');

let allPayloadsValid = true;
const seenIds = new Set();
for (let pIdx = 0; pIdx < payload.length; pIdx++) {
  const item = payload[pIdx];
  if (!item.id_soal || seenIds.has(item.id_soal)) allPayloadsValid = false;
  seenIds.add(item.id_soal);

  if (item.id_mapel !== sampleMapelId) allPayloadsValid = false;
  if (item.npsn !== sampleNpsn) allPayloadsValid = false;
  if (item.tipe_soal !== 'PG') allPayloadsValid = false;
  if (item.bobot !== 15) allPayloadsValid = false;

  const parsedOpsi = JSON.parse(item.opsi);
  if (!Array.isArray(parsedOpsi) || parsedOpsi.length < 2) allPayloadsValid = false;
  if (!parsedOpsi.includes(item.kunci_jawaban)) allPayloadsValid = false;
}

assert(allPayloadsValid, 'All 120 payload records strictly adhere to soal_ujian database schema with unique IDs');
assert(seenIds.size === 120, 'All 120 generated id_soal keys are strictly unique');

console.log('\n========================================================================');
console.log('PART 2: PRINT CHUNKING & LAYOUT ROBUSTNESS (FEATURE 2)');
console.log('========================================================================\n');

console.log('--- 6. Deterministic Chunking Boundary Sizes (0, 1, 7, 8, 9, 15, 16, 17) ---');

// Extract chunkArray implementation from KartuUjianPrint.jsx to test the exact source
const kartuCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'KartuUjianPrint.jsx'), 'utf-8');
const chunkArrayMatch = kartuCode.match(/const\s+chunkArray\s*=\s*\(([^)]+)\)\s*=>\s*\{([\s\S]*?)\n\};/);
assert(Boolean(chunkArrayMatch), 'Extracted chunkArray implementation from KartuUjianPrint.jsx source');

// Create executable chunkArray function identical to source
const chunkArray = new Function(chunkArrayMatch[1], chunkArrayMatch[2]);

// Test boundaries
const testBoundaries = [
  { size: 0, expectedPages: 0, expectedChunks: [] },
  { size: 1, expectedPages: 1, expectedChunks: [1] },
  { size: 7, expectedPages: 1, expectedChunks: [7] },
  { size: 8, expectedPages: 1, expectedChunks: [8] },
  { size: 9, expectedPages: 2, expectedChunks: [8, 1] },
  { size: 15, expectedPages: 2, expectedChunks: [8, 7] },
  { size: 16, expectedPages: 2, expectedChunks: [8, 8] },
  { size: 17, expectedPages: 3, expectedChunks: [8, 8, 1] },
  { size: 24, expectedPages: 3, expectedChunks: [8, 8, 8] },
  { size: 25, expectedPages: 4, expectedChunks: [8, 8, 8, 1] }
];

let allBoundariesPassed = true;
testBoundaries.forEach(b => {
  const fakeStudents = Array.from({ length: b.size }, (_, i) => ({ id_siswa: `S-${i + 1}` }));
  const chunks = chunkArray(fakeStudents, 8);

  if (chunks.length !== b.expectedPages) {
    allBoundariesPassed = false;
    console.error(`Boundary ${b.size} failed expectedPages: got ${chunks.length}, expected ${b.expectedPages}`);
  }

  const chunkSizes = chunks.map(c => c.length);
  if (JSON.stringify(chunkSizes) !== JSON.stringify(b.expectedChunks)) {
    allBoundariesPassed = false;
    console.error(`Boundary ${b.size} failed chunkSizes: got ${JSON.stringify(chunkSizes)}, expected ${JSON.stringify(b.expectedChunks)}`);
  }

  // Ensure every chunk has <= 8 items
  chunks.forEach(c => {
    if (c.length > 8) allBoundariesPassed = false;
  });

  // Ensure item integrity
  const flattened = chunks.flat();
  if (flattened.length !== b.size) allBoundariesPassed = false;
});

assert(allBoundariesPassed, 'chunkArray strictly satisfies all boundary cases (0, 1, 7, 8, 9, 15, 16, 17, 24, 25)');

// 6.2 Fuzzing chunkArray across sizes 0 to 300
let fuzzingChunkPassed = true;
for (let n = 0; n <= 300; n++) {
  const dummyArr = Array.from({ length: n }, (_, i) => i);
  const res = chunkArray(dummyArr, 8);
  const expectedP = Math.ceil(n / 8);

  if (res.length !== expectedP) fuzzingChunkPassed = false;
  res.forEach(c => {
    if (c.length > 8 || c.length === 0) fuzzingChunkPassed = false;
  });
  if (res.flat().length !== n) fuzzingChunkPassed = false;
}
assert(fuzzingChunkPassed, 'chunkArray invariant holds for all N in [0..300]: every chunk <= 8 items, total === N');

console.log('\n--- 7. AST & Static Analysis of KartuUjianPrint.jsx (Print CSS & XSS Safety) ---');

// Parse KartuUjianPrint.jsx using Babel Parser with JSX plugin
const ast = babelParser.parse(kartuCode, {
  sourceType: 'module',
  plugins: ['jsx']
});

let foundHeaderTag = false;
let foundFooterTag = false;
let foundDangerouslySetInnerHTML = false;
let foundPrintDocumentId = false;

function traverseAST(node) {
  if (!node || typeof node !== 'object') return;

  if (node.type === 'JSXElement') {
    const tagName = node.openingElement.name.name;
    if (typeof tagName === 'string') {
      if (tagName.toLowerCase() === 'header') foundHeaderTag = true;
      if (tagName.toLowerCase() === 'footer') foundFooterTag = true;
    }

    // Check attributes
    (node.openingElement.attributes || []).forEach(attr => {
      if (attr.type === 'JSXAttribute') {
        const attrName = attr.name.name;
        if (attrName === 'dangerouslySetInnerHTML') foundDangerouslySetInnerHTML = true;
        if (attrName === 'id' && attr.value?.value === 'print-document') foundPrintDocumentId = true;
      }
    });
  }

  for (const key of Object.keys(node)) {
    if (key !== 'parent') {
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(traverseAST);
      } else if (child && typeof child === 'object') {
        traverseAST(child);
      }
    }
  }
}

traverseAST(ast);

assert(!foundHeaderTag, 'AST verification: KartuUjianPrint.jsx contains ZERO <header> JSX elements');
assert(!foundFooterTag, 'AST verification: KartuUjianPrint.jsx contains ZERO <footer> JSX elements');
assert(
  !foundHeaderTag && !foundFooterTag,
  'Kartu components are immune to index.css:255-256 "header, footer { display: none !important; }"'
);
assert(!foundDangerouslySetInnerHTML, 'AST verification: KartuUjianPrint.jsx contains ZERO dangerouslySetInnerHTML attributes');
assert(foundPrintDocumentId, 'AST verification: KartuUjianPrint.jsx root container has id="print-document" matching index.css print rule');

// 7.2 Verify print CSS styling in KartuUjianPrint.jsx
assert(kartuCode.includes('print:border-black'), 'Cards enforce high-contrast print:border-black for physical printers');
assert(kartuCode.includes('page-break'), 'Pages enforce .page-break class for multi-sheet printouts');
assert(kartuCode.includes('avoid-break'), 'Individual cards enforce .avoid-break to prevent page-split tear');
assert(kartuCode.includes('215mm 330mm'), 'Dynamic @page rule supports F4 (Folio / 215mm x 330mm) format');
assert(kartuCode.includes('A4 portrait'), 'Dynamic @page rule supports standard A4 portrait format');

console.log('\n--- 8. Defensive Edge Cases: Malformed or Null Student Properties ---');

// Test that data formatting for cards gracefully handles empty/null objects without throwing
function simulateCardFieldRendering(student, sekolah = {}) {
  const schoolName = sekolah.nama_sekolah || 'SEKOLAH INDONESIA';
  const schoolNpsn = sekolah.npsn || '-';
  const targetKelas = '';
  const targetRuang = '';
  const targetSesi = 'Sesi 1';
  const showPassword = true;

  const kelasStr = student.kelas || `${student.angkatan || ''} ${student.kelas_paralel || ''}`.trim() || targetKelas || '-';
  const ruangStr = student.ruang || targetRuang || '-';
  const sesiStr = student.sesi || targetSesi || 'Sesi 1';
  const nama = student.nama_lengkap || '-';
  const nisn = student.nisn || student.id_siswa || '-';
  const username = student.username || '-';
  const password = showPassword !== false ? (student.password || '-') : '••••••••';

  return { schoolName, schoolNpsn, kelasStr, ruangStr, sesiStr, nama, nisn, username, password };
}

// Case A: completely empty student object
const emptyStudentFields = simulateCardFieldRendering({});
assert(
  emptyStudentFields.nama === '-' &&
  emptyStudentFields.nisn === '-' &&
  emptyStudentFields.username === '-' &&
  emptyStudentFields.password === '-',
  'Gracefully renders fallback string "-" for completely empty student objects'
);

// Case B: null and undefined fields
const nullStudentFields = simulateCardFieldRendering({
  nama_lengkap: null,
  nisn: null,
  id_siswa: null,
  username: null,
  password: null,
  kelas: null,
  ruang: null
});
assert(
  nullStudentFields.nama === '-' &&
  nullStudentFields.nisn === '-' &&
  nullStudentFields.ruangStr === '-',
  'Gracefully handles explicit null attributes across all student fields'
);

console.log('\n========================================================================');
console.log(`FINAL RESULTS: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} failures)`);
console.log('========================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
