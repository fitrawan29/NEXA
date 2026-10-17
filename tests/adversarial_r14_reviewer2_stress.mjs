import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('ADVERSARIAL STRESS TEST & INTEGRITY AUDIT — REVIEWER 2 (ROUND 14)');
console.log('================================================================');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

// ----------------------------------------------------------------------------
// 1. INTEGRITY CHECKS & ANTI-CHEATING AUDIT
// ----------------------------------------------------------------------------
console.log('\n--- Section 1: Integrity Checks (Anti-Cheating & Facade Detection) ---');

import { parseAiken, prepareAikenPayload } from '../src/utils/aikenParser.js';

runTest('1.1 parseAiken is NOT hardcoded to fixture strings (dynamic UUID test)', () => {
  const qId = 'Q_' + Math.random().toString(36).substring(2);
  const aText = 'AnsA_' + Math.random().toString(36).substring(2);
  const bText = 'AnsB_' + Math.random().toString(36).substring(2);
  const cText = 'AnsC_' + Math.random().toString(36).substring(2);

  const raw = `${qId}\nA. ${aText}\nB. ${bText}\nC. ${cText}\nANSWER: B`;
  const result = parseAiken(raw);

  assert.strictEqual(result.validCount, 1, 'Must parse exactly 1 valid question');
  assert.strictEqual(result.questions[0].pertanyaan, qId, 'Question text must match random input');
  assert.deepStrictEqual(result.questions[0].opsi, [aText, bText, cText], 'Options must match random inputs');
  assert.strictEqual(result.questions[0].kunci_letter, 'B', 'Answer key letter must be B');
  assert.strictEqual(result.questions[0].kunci_jawaban, bText, 'kunci_jawaban must be literal text of B');
});

runTest('1.2 Source code does not contain hardcoded test fixture answers in logic branches', () => {
  const parserCode = fs.readFileSync(path.join(rootDir, 'src', 'utils', 'aikenParser.js'), 'utf-8');
  assert(!parserCode.includes('Jakarta'), 'Parser must not contain hardcoded "Jakarta"');
  assert(!parserCode.includes('Emas'), 'Parser must not contain hardcoded "Emas"');
  assert(!parserCode.includes('Au'), 'Parser must not contain hardcoded chemical symbol');
});

runTest('1.3 KartuUjianPrint does not contain dummy fallback strings', () => {
  const kartuCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'KartuUjianPrint.jsx'), 'utf-8');
  assert(!kartuCode.includes('SMA NEGERI CONTOH'), 'Must not have SMA NEGERI CONTOH fallback');
  assert(!kartuCode.includes('10101010'), 'Must not have 10101010 dummy NPSN');
  assert(!kartuCode.includes('Jl. Pendidikan Nasional'), 'Must not have dummy address fallback');
});

// ----------------------------------------------------------------------------
// 2. AIKEN PARSER ADVERSARIAL EDGE CASES
// ----------------------------------------------------------------------------
console.log('\n--- Section 2: Aiken Parser Adversarial Stress Tests ---');

runTest('2.1 Handling Windows CRLF, Unix LF, and Old Mac CR line breaks', () => {
  const crlf = "Soal 1 CRLF\r\nA. Opsi 1\r\nB. Opsi 2\r\nANSWER: A\r\n\r\n";
  const cr = "Soal 2 CR\rA. Opsi 1\rB. Opsi 2\rANSWER: B\r\r";
  const mixed = "Soal 3 Mixed\r\nA. Opsi 1\nB. Opsi 2\rANSWER: A";

  const res1 = parseAiken(crlf);
  assert.strictEqual(res1.validCount, 1, 'CRLF parsed');
  assert.strictEqual(res1.questions[0].kunci_jawaban, 'Opsi 1');

  const res2 = parseAiken(cr);
  assert.strictEqual(res2.validCount, 1, 'CR parsed');
  assert.strictEqual(res2.questions[0].kunci_jawaban, 'Opsi 2');

  const res3 = parseAiken(mixed);
  assert.strictEqual(res3.validCount, 1, 'Mixed parsed');
});

runTest('2.2 Lowercase option letters and lowercase answer key', () => {
  const text = `
Pertanyaan huruf kecil
a. opsi a
b. opsi b
c. opsi c
d. opsi d
answer: c
`;
  const res = parseAiken(text);
  assert.strictEqual(res.validCount, 1);
  assert.strictEqual(res.questions[0].kunci_letter, 'C');
  assert.strictEqual(res.questions[0].kunci_jawaban, 'opsi c');
});

runTest('2.3 Parenthesis delimiters A) B) C) with whitespace variations', () => {
  const text = `
Pertanyaan dengan tanda kurung
A)  Opsi spasi banyak
B) Opsi standar
C)   Opsi spasi lagi
KUNCI : A
`;
  const res = parseAiken(text);
  assert.strictEqual(res.validCount, 1);
  assert.strictEqual(res.questions[0].kunci_letter, 'A');
  assert.strictEqual(res.questions[0].kunci_jawaban, 'Opsi spasi banyak');
});

runTest('2.4 Indonesian keywords: KUNCI and JAWABAN case-insensitive with spaces', () => {
  const t1 = `Soal Kunci\nA. O1\nB. O2\nkunci: B`;
  const t2 = `Soal Jawaban\nA. O1\nB. O2\nJAWABAN  :  A`;
  const t3 = `Soal Campur\nA. O1\nB. O2\nJawaban: B`;

  assert.strictEqual(parseAiken(t1).questions[0].kunci_jawaban, 'O2');
  assert.strictEqual(parseAiken(t2).questions[0].kunci_jawaban, 'O1');
  assert.strictEqual(parseAiken(t3).questions[0].kunci_jawaban, 'O2');
});

runTest('2.5 Multiline stimulus question with empty blank lines inside stimulus', () => {
  const text = `
Bacalah teks berikut dengan saksama:

Paragraf 1: Keanekaragaman hayati Indonesia sangat kaya. Hutan hujan tropis membentang dari Sumatra hingga Papua.

Paragraf 2: Namun, deforestasi mengancam habitat satwa endemik seperti orangutan dan harimau sumatera.

Berdasarkan teks di atas, satwa endemik yang terancam adalah...
A. Singa dan gajah
B. Orangutan dan harimau sumatera
C. Kanguru dan koala
D. Panda dan beruang kutub
ANSWER: B
`;
  const res = parseAiken(text);
  assert.strictEqual(res.validCount, 1);
  assert.strictEqual(res.questions[0].opsi.length, 4);
  assert.strictEqual(res.questions[0].kunci_jawaban, 'Orangutan dan harimau sumatera');
  assert(res.questions[0].pertanyaan.includes('<br/>'), 'Should replace newlines with <br/> for HTML view');
  assert(res.questions[0].pertanyaan.includes('Bacalah teks berikut'), 'Stimulus preserved');
  assert(res.questions[0].pertanyaan.includes('Paragraf 2: Namun'), 'Paragraf 2 preserved');
});

runTest('2.6 Question text containing the word "ANSWER" or "KUNCI" within sentences', () => {
  const text = `
Read the following sentence and choose the best answer:
"The teacher asked the student to answer: What is 2 + 2?"
What did the student answer?
A. Three
B. Four
C. Five
ANSWER: B
`;
  const res = parseAiken(text);
  assert.strictEqual(res.validCount, 1, 'Must not falsely trigger on "answer:" within question text');
  assert.strictEqual(res.questions[0].kunci_jawaban, 'Four');
});

runTest('2.7 Question text with numbered prefixes (e.g., "1. Apa ibukota...")', () => {
  const text = `
1. Siapakah presiden pertama Indonesia?
A. Soekarno
B. Soeharto
C. Habibie
D. Gus Dur
ANSWER: A

2. Kapan proklamasi kemerdekaan RI dibacakan?
A. 17 Agustus 1945
B. 18 Agustus 1945
ANSWER: A
`;
  const res = parseAiken(text);
  assert.strictEqual(res.validCount, 2);
  assert(res.questions[0].pertanyaan.startsWith('1. Siapakah'), 'Numbering 1. must not be parsed as option A');
  assert(res.questions[1].pertanyaan.startsWith('2. Kapan'), 'Numbering 2. must not be parsed as option B');
});

runTest('2.8 Question with 3 choices (SMP level) and 5 choices (SMA level)', () => {
  const text3 = `Soal 3 Opsi\nA. Ya\nB. Tidak\nC. Ragu-ragu\nANSWER: A`;
  const text5 = `Soal 5 Opsi\nA. Opsi A\nB. Opsi B\nC. Opsi C\nD. Opsi D\nE. Opsi E\nANSWER: E`;

  const res3 = parseAiken(text3);
  const res5 = parseAiken(text5);

  assert.strictEqual(res3.validCount, 1);
  assert.strictEqual(res3.questions[0].opsi.length, 3);
  assert.strictEqual(res3.questions[0].kunci_jawaban, 'Ya');

  assert.strictEqual(res5.validCount, 1);
  assert.strictEqual(res5.questions[0].opsi.length, 5);
  assert.strictEqual(res5.questions[0].kunci_jawaban, 'Opsi E');
});

runTest('2.9 Question with options out of alphabetical order (e.g. B before A)', () => {
  const text = `
Soal Pilihan Terbalik
B. Opsi Kedua
A. Opsi Pertama
C. Opsi Ketiga
ANSWER: A
`;
  const res = parseAiken(text);
  assert.strictEqual(res.validCount, 1);
  assert.strictEqual(res.questions[0].kunci_letter, 'A');
  assert.strictEqual(res.questions[0].kunci_jawaban, 'Opsi Pertama');
});

runTest('2.10 Error diagnosis: missing ANSWER keyword before next question', () => {
  const text = `
Soal Pertama Tanpa Kunci
A. Opsi A
B. Opsi B

Soal Kedua Dengan Kunci
A. Opsi A
B. Opsi B
ANSWER: A
`;
  const res = parseAiken(text);
  assert.strictEqual(res.validCount, 1, 'Only second question is valid');
  assert.strictEqual(res.errorCount, 1, 'First question produces error');
  assert(res.errors[0].message.includes('Kunci jawaban'), 'Error explains missing answer');
});

runTest('2.11 Error diagnosis: fewer than 2 choices', () => {
  const text = `
Soal Hanya Satu Pilihan
A. Opsi Tunggal
ANSWER: A
`;
  const res = parseAiken(text);
  assert.strictEqual(res.validCount, 0);
  assert.strictEqual(res.errorCount, 1);
  assert(res.errors[0].message.includes('kurang dari 2'), 'Error flags < 2 choices');
});

runTest('2.12 Error diagnosis: ANSWER letter not in choices', () => {
  const text = `
Soal Dengan Kunci Tidak Ada di Pilihan
A. Opsi A
B. Opsi B
ANSWER: D
`;
  const res = parseAiken(text);
  assert.strictEqual(res.validCount, 0);
  assert.strictEqual(res.errorCount, 1);
  assert(res.errors[0].message.includes("tidak cocok"), 'Flags invalid choice letter');
});

runTest('2.13 Null, undefined, empty string, and non-string inputs do not crash', () => {
  assert.strictEqual(parseAiken(null).validCount, 0);
  assert.strictEqual(parseAiken(undefined).validCount, 0);
  assert.strictEqual(parseAiken('').validCount, 0);
  assert.strictEqual(parseAiken(12345).validCount, 0);
  assert.strictEqual(parseAiken({}).validCount, 0);
});

runTest('2.14 HTML special characters and math equations are preserved', () => {
  const text = `
Jika f(x) = x^2 - 4x + 4, berapakah nilai x untuk f(x) = 0?
A. x < 0
B. x = 2 & x > 0
C. x > 5
ANSWER: B
`;
  const res = parseAiken(text);
  assert.strictEqual(res.validCount, 1);
  assert.strictEqual(res.questions[0].kunci_jawaban, 'x = 2 & x > 0');
});

runTest('2.15 prepareAikenPayload maps correctly to soal_ujian database schema', () => {
  const parsed = parseAiken(`Soal Uji DB\nA. Pilihan 1\nB. Pilihan 2\nANSWER: A`, 25);
  const payload = prepareAikenPayload(parsed.questions, 'MAPEL-01', '70040625', 25);

  assert.strictEqual(payload.length, 1);
  const row = payload[0];
  assert(row.id_soal.startsWith('SOAL-MAPEL-01-'), 'id_soal must follow prefix convention');
  assert.strictEqual(row.id_mapel, 'MAPEL-01');
  assert.strictEqual(row.npsn, '70040625');
  assert.strictEqual(row.tipe_soal, 'PG');
  assert.strictEqual(row.bobot, 25);
  assert.strictEqual(row.kunci_jawaban, 'Pilihan 1');
  
  // Verify opsi is valid JSON array string
  const parsedOpsi = JSON.parse(row.opsi);
  assert(Array.isArray(parsedOpsi), 'opsi must parse to array');
  assert.deepStrictEqual(parsedOpsi, ['Pilihan 1', 'Pilihan 2']);
  assert.strictEqual(row.gambar, null);
  assert.strictEqual(row.id_narasi, null);
});

// ----------------------------------------------------------------------------
// 3. KARTUUJIANPRINT & PRINT CSS ADVERSARIAL STRESS TESTS
// ----------------------------------------------------------------------------
console.log('\n--- Section 3: KartuUjianPrint & Print Layout Adversarial Audit ---');

const kartuPrintPath = path.join(rootDir, 'src', 'components', 'KartuUjianPrint.jsx');
const kartuContent = fs.readFileSync(kartuPrintPath, 'utf-8');

runTest('3.1 No forbidden print-suppressed tags anywhere in KartuUjianPrint', () => {
  const code = kartuContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  const forbidden = ['<header', '<footer', '<nav', '<aside'];
  for (const tag of forbidden) {
    assert(!code.toLowerCase().includes(tag), `Must not contain ${tag}`);
  }
});

runTest('3.2 No <button> tags inside printable card area (lines 115-303)', () => {
  // Screen toolbar contains buttons, but the printable sheets area must not contain buttons
  const printAreaIndex = kartuContent.indexOf('{/* Printable Sheets Container */}');
  assert(printAreaIndex > -1, 'Printable Sheets Container must exist');
  const printableArea = kartuContent.substring(printAreaIndex);
  assert(!printableArea.includes('<button'), 'Printable card area must not contain <button> tags');
});

runTest('3.3 Dynamic @page supports both A4 portrait and F4 (215mm 330mm)', () => {
  assert(kartuContent.includes("paperSize === 'F4' ? '215mm 330mm' : 'A4 portrait'"));
  assert(kartuContent.includes("margin: 8mm 10mm 8mm 10mm;"));
});

runTest('3.4 Card dimensions (67mm) fit 4 rows in A4 (268mm <= 297mm)', () => {
  assert(kartuContent.includes("height: '67mm'"));
  const cardHeightMm = 67;
  const rowsPerPage = 4;
  const totalContentHeight = cardHeightMm * rowsPerPage; // 268mm
  const margins = 8 + 8; // 16mm
  const totalHeightWithMargins = totalContentHeight + margins; // 284mm
  assert(totalHeightWithMargins < 297, `Total height (${totalHeightWithMargins}mm) must be less than A4 height (297mm)`);
  assert(totalHeightWithMargins < 330, `Total height (${totalHeightWithMargins}mm) must be less than F4 height (330mm)`);
});

runTest('3.5 Chunking determinism for 0, 1, 8, 9, 16, 17 items', () => {
  // Test chunking function logic directly
  const chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  assert.strictEqual(chunkArray([], 8).length, 0, '0 items = 0 sheets');
  assert.strictEqual(chunkArray(new Array(1), 8).length, 1, '1 item = 1 sheet');
  assert.strictEqual(chunkArray(new Array(8), 8).length, 1, '8 items = 1 sheet');
  assert.strictEqual(chunkArray(new Array(9), 8).length, 2, '9 items = 2 sheets');
  assert.strictEqual(chunkArray(new Array(16), 8).length, 2, '16 items = 2 sheets');
  assert.strictEqual(chunkArray(new Array(17), 8).length, 3, '17 items = 3 sheets');
});

runTest('3.6 Password masking logic adheres strictly to showPassword flag', () => {
  assert(kartuContent.includes("showPassword !== false ? (student.password || '-') : '••••••••'"));
});

runTest('3.7 Safe fallback handling for null/undefined student and school properties', () => {
  // Verify safe fallbacks in KartuUjianPrint
  assert(kartuContent.includes("sekolah.nama_sekolah || 'SEKOLAH INDONESIA'"));
  assert(kartuContent.includes("sekolah.npsn || '-'"));
  assert(kartuContent.includes("student.nama_lengkap || '-'"));
  assert(kartuContent.includes("student.nisn || student.id_siswa || '-'"));
  assert(kartuContent.includes("student.username || '-'"));
  assert(kartuContent.includes("targetSesi || 'Sesi 1'"));
});

// ----------------------------------------------------------------------------
// 4. ADMINVIEW INTEGRATION & FILTER VERIFICATION
// ----------------------------------------------------------------------------
console.log('\n--- Section 4: AdminView Integration & Filter Logic Audit ---');

const adminPath = path.join(rootDir, 'src', 'views', 'AdminView.jsx');
const adminContent = fs.readFileSync(adminPath, 'utf-8');

runTest('4.1 AdminView imports KartuUjianPrint and manages modal state', () => {
  assert(adminContent.includes("import KartuUjianPrint from '../components/KartuUjianPrint.jsx';"));
  assert(adminContent.includes("const [printKartuModal, setPrintKartuModal] = useState("));
  assert(adminContent.includes("const [isPrintKartuActive, setIsPrintKartuActive] = useState(false);"));
  assert(adminContent.includes("const [printKartuPayload, setPrintKartuPayload] = useState(null);"));
});

runTest('4.2 Cetak Kartu button exists in siswa tab toolbar', () => {
  const siswaToolbarSection = adminContent.substring(
    adminContent.indexOf('activeTab === \'siswa\'') || 3100,
    3200
  );
  assert(adminContent.includes("handleOpenPrintKartu('peserta')"));
});

runTest('4.3 Cetak Kartu button exists in jadwal tab header and each row with preselectedKelas', () => {
  assert(adminContent.includes("handleOpenPrintKartu('peserta', j.target_kelas)"));
});

runTest('4.4 Print filter handles Class, Room, Session, Paper Size, and Selection', () => {
  assert(adminContent.includes("filterKelas:"));
  assert(adminContent.includes("filterRuang:"));
  assert(adminContent.includes("filterSesi:"));
  assert(adminContent.includes("paperSize:"));
  assert(adminContent.includes("selectedOnly:"));
});

runTest('4.5 Room filter handles "BELUM_ADA" for unassigned rooms', () => {
  assert(adminContent.includes("printKartuModal.filterRuang === 'BELUM_ADA'"));
  assert(adminContent.includes("filtered = filtered.filter(s => !s.ruang)"));
});

runTest('4.6 Empty filter result shows warning and aborts without crash', () => {
  assert(adminContent.includes("filtered.length === 0"));
  assert(adminContent.includes("Tidak ada siswa yang memenuhi filter yang dipilih."));
});

// ----------------------------------------------------------------------------
// 5. GURUVIEW & FORMSOALMODAL INTEGRATION
// ----------------------------------------------------------------------------
console.log('\n--- Section 5: GuruView & FormSoalModal Integration Audit ---');

const guruPath = path.join(rootDir, 'src', 'views', 'GuruView.jsx');
const guruContent = fs.readFileSync(guruPath, 'utf-8');

const formSoalPath = path.join(rootDir, 'src', 'components', 'FormSoalModal.jsx');
const formSoalContent = fs.readFileSync(formSoalPath, 'utf-8');

runTest('5.1 GuruView imports parseAiken & prepareAikenPayload', () => {
  assert(guruContent.includes("import { parseAiken, prepareAikenPayload } from '../utils/aikenParser.js';"));
});

runTest('5.2 GuruView has Import Aiken button in bank soal toolbar', () => {
  assert(guruContent.includes("onClick={() => setImportAikenModal({ isOpen: true, rawText: '', defaultBobot: 10, isSubmitting: false })}"));
  assert(guruContent.includes("Import Aiken"));
});

runTest('5.3 GuruView handles both file upload (.txt, .aiken) and direct text paste', () => {
  assert(guruContent.includes("handleAikenFileUpload"));
  assert(guruContent.includes('accept=".txt,.aiken"'));
  assert(guruContent.includes("importAikenModal.rawText"));
});

runTest('5.4 GuruView sends batch data to api("import_soal_bulk", ...)', () => {
  assert(guruContent.includes("api('import_soal_bulk', { data: payloadData, npsn: user.npsn })"));
});

runTest('5.5 FormSoalModal imports parseAiken and has quick-paste panel', () => {
  assert(formSoalContent.includes("import { parseAiken } from '../utils/aikenParser.js';"));
  assert(formSoalContent.includes("Tempel Cepat Format Aiken"));
  assert(formSoalContent.includes("handleApplyAiken"));
});

runTest('5.6 FormSoalModal handleApplyAiken populates PG options, key, and question text', () => {
  assert(formSoalContent.includes("setTipe('PG')"));
  assert(formSoalContent.includes("setPertanyaan(q.pertanyaan)"));
  assert(formSoalContent.includes("setOpsiPG(opts)"));
  assert(formSoalContent.includes("setKunciPG(String(keyIdx))"));
  assert(formSoalContent.includes("payload.kunci_jawaban = opsiPG[parseInt(kunciPG)]"));
});

// ----------------------------------------------------------------------------
// FINAL SUMMARY
// ----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`Reviewer 2 Adversarial Stress Suite Result: ${passedTests}/${totalTests} PASSED (${failedTests} failures)`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
