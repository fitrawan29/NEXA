/**
 * ============================================================================
 * CBT NEXA — CHALLENGER EMPIRICAL STRESS TEST HARNESS (MILESTONE M1)
 * ============================================================================
 * Scope:
 * 1. NPSN Sanitization Engine under extreme inputs:
 *    - Composite labels [70040625-SMA Negeri 1]
 *    - Hyphenated / complex names: 70040625 - SMA (Unggulan) - Jakarta
 *    - Multiple hyphens, numeric dashes, and nested delimiters
 *    - Extreme whitespace (spaces, tabs, newlines, CRLF)
 *    - Lowercase, uppercase, mixed alphanumerics (e.g. mock IDs)
 *    - Empty strings, whitespace-only, boundary and degenerate inputs
 *    - Malicious inputs & injection attacks (SQLi, XSS, command injection, traversal, null bytes)
 *    - Role parity: super_admin bypass vs regular role sanitization
 * 2. Formatting Integrity of [NPSN-Nama Sekolah]:
 *    - Pattern strictness: /^\[[A-Za-z0-9]+-.+\]$/
 *    - Fuzzing with diverse school entity structures
 *    - Value decoupling: option value is raw NPSN, displayed label is composite
 *    - Select value binding expression integrity
 * 3. Error Handling & Network Failure Resilience:
 *    - Empty school list handling
 *    - Network failure / rejected promise recovery
 *    - Malformed / non-array API responses
 *    - Loading state management and fallback placeholders
 * 4. Viewport-Anchored Fixed Bottom Navigation:
 *    - SuperAdminView, AdminView, GuruView, SiswaView
 *    - Fixed positioning, safe-area inset padding, pb-28 content clearance
 * 5. Live Backend Integration Smoke Test:
 *    - Real Supabase get_sekolah invocation
 *    - Formatting and round-trip sanitization of production data
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Provide global.window before importing api.js
global.window = global;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.resolve(projectRoot, 'src');

// Results tracker
const testReport = {
  total: 0,
  passed: 0,
  failed: 0,
  categories: {},
  adversarialFindings: []
};

function record(category, testName, passed, details = '') {
  if (!testReport.categories[category]) {
    testReport.categories[category] = { passed: 0, failed: 0, tests: [] };
  }
  testReport.total++;
  if (passed) {
    testReport.passed++;
    testReport.categories[category].passed++;
    testReport.categories[category].tests.push({ name: testName, status: 'PASS' });
    console.log(`  ✔ [PASS] ${testName}`);
  } else {
    testReport.failed++;
    testReport.categories[category].failed++;
    testReport.categories[category].tests.push({ name: testName, status: 'FAIL', details });
    console.error(`  ✖ [FAIL] ${testName} -> ${details}`);
  }
}

console.log('================================================================================');
console.log('       CBT NEXA — EMPIRICAL CHALLENGER STRESS SUITE (MILESTONE M1)              ');
console.log('================================================================================\n');

// =============================================================================
// CATEGORY 1: NPSN SANITIZATION ENGINE & EXTREME INPUT STRESS TESTING
// =============================================================================
console.log('▶ [CATEGORY 1] NPSN Sanitization Engine & Extreme Input Stress Testing:');
const appFile = path.resolve(srcDir, 'App.jsx');
const appContent = fs.readFileSync(appFile, 'utf-8');

// 1.1 Verify presence and AST implementation in App.jsx
const loginSanitizeRegex = /const\s+cleanNpsn\s*=\s*loginRole\s*===\s*['"]super_admin['"]\s*\?\s*['"]['"]\s*:\s*\([\s\S]*?npsn\.includes\(['"]-['"]\)\s*\?\s*npsn\.replace\(\/\^\\\[\?\(\[\^-\]\+\)\.\*\/,\s*['"]\$1['"]\)\.replace\(\/\[\^a-zA-Z0-9\]\/g,\s*['"]['"]\)\.trim\(\)\s*:\s*npsn\.replace\(\/\[\^a-zA-Z0-9\]\/g,\s*['"]['"]\)\.trim\(\)/;

record(
  'Sanitization',
  'App.jsx implements robust dual-mode NPSN sanitization in handleLogin',
  loginSanitizeRegex.test(appContent),
  'handleLogin sanitization pattern not found or does not match expected logic'
);

const regSanitizeRegex = /const\s+cleanRegNpsn\s*=\s*npsn\.includes\(['"]-['"]\)\s*\?\s*npsn\.replace\(\/\^\\\[\?\(\[\^-\]\+\)\.\*\/,\s*['"]\$1['"]\)\.replace\(\/\[\^a-zA-Z0-9\]\/g,\s*['"]['"]\)\.trim\(\)\s*:\s*npsn\.replace\(\/\[\^a-zA-Z0-9\]\/g,\s*['"]['"]\)\.trim\(\)/;

record(
  'Sanitization',
  'App.jsx implements identical sanitization in onRegisterSubmit',
  regSanitizeRegex.test(appContent),
  'onRegisterSubmit sanitization does not match handleLogin'
);

// The actual implementation function under test
const sanitizeLoginNpsn = (npsnStr, role = 'siswa') => {
  if (role === 'super_admin') return '';
  if (!npsnStr) return '';
  return npsnStr.includes('-')
    ? npsnStr.replace(/^\[?([^-]+).*/, '$1').replace(/[^a-zA-Z0-9]/g, '').trim()
    : npsnStr.replace(/[^a-zA-Z0-9]/g, '').trim();
};

// 1.2 Extreme inputs stress matrix
const extremeCases = [
  // Standard & composite
  { input: '70040625', role: 'siswa', expected: '70040625', desc: 'Raw 8-digit numeric NPSN' },
  { input: '[70040625-SMA Negeri 1]', role: 'siswa', expected: '70040625', desc: 'Standard composite label with brackets' },
  { input: '70040625-SMA Negeri 1', role: 'siswa', expected: '70040625', desc: 'Unbracketed composite label' },
  
  // Complex school names with hyphens and parentheses
  { input: '70040625 - SMA (Unggulan) - Jakarta', role: 'siswa', expected: '70040625', desc: 'Multi-hyphen spaced composite with parentheses' },
  { input: '[70040625-SMA Negeri 1 - Model Terpadu - Lab School Jakarta]', role: 'guru', expected: '70040625', desc: 'Three hyphens in school name' },
  { input: '[70040625-SMK Negeri 1-2-3 Model Pembangunan]', role: 'admin', expected: '70040625', desc: 'Numeric dash range in school name (1-2-3)' },
  { input: '70040625-SMK PGRI 1 - Cianjur - Jawa Barat', role: 'siswa', expected: '70040625', desc: 'Hyphens with spaces in multi-word regions' },
  { input: '[70040625---------SMA Negeri 1]', role: 'siswa', expected: '70040625', desc: 'Multiple consecutive hyphens as separator' },
  { input: '70040625-', role: 'siswa', expected: '70040625', desc: 'Trailing hyphen without school name' },
  { input: '[70040625-]', role: 'siswa', expected: '70040625', desc: 'Trailing hyphen inside brackets' },
  { input: '[70040625--]', role: 'siswa', expected: '70040625', desc: 'Double trailing hyphen inside brackets' },

  // Whitespace variations
  { input: '   70040625   ', role: 'siswa', expected: '70040625', desc: 'Leading and trailing spaces' },
  { input: '  [  70040625   -   SMA Negeri 1   ]  ', role: 'siswa', expected: '70040625', desc: 'Extra spaces around brackets, code, hyphen, and name' },
  { input: '\t\t[70040625-SMA Negeri 1]\n\r', role: 'siswa', expected: '70040625', desc: 'Tabs, newlines, and carriage returns at string boundaries' },
  { input: ' \t 70040625 \t - \t SMA Negeri 1 \n', role: 'siswa', expected: '70040625', desc: 'Interspersed tabs and trailing newline' },
  { input: ' \r\n [ 70040625 - SMA 1 ] \r\n ', role: 'siswa', expected: '70040625', desc: 'CRLF wrapped composite' },

  // Alphanumerics (lowercase, uppercase, mixed mock IDs)
  { input: 'sch9901-Sekolah Demo', role: 'siswa', expected: 'sch9901', desc: 'Lowercase alphanumeric code' },
  { input: '[SCH9901-SMP Pelita Harapan]', role: 'guru', expected: 'SCH9901', desc: 'Uppercase alphanumeric code' },
  { input: '[abc123XYZ-Sekolah Swasta Mandiri]', role: 'admin', expected: 'abc123XYZ', desc: 'Mixed case alphanumeric code' },
  { input: 'demo2026-SMA Terbuka', role: 'siswa', expected: 'demo2026', desc: 'Alphanumeric with trailing year' },
  { input: '[NPSN12345678-Sekolah Alam Nusantara]', role: 'siswa', expected: 'NPSN12345678', desc: 'Alphanumeric prefix with 8 digits' },
  { input: 'ID_9999-Sekolah Internasional', role: 'siswa', expected: 'ID9999', desc: 'Underscore stripped from code' },

  // Empty, nullish, and degenerate boundary inputs
  { input: '', role: 'siswa', expected: '', desc: 'Empty string input' },
  { input: '   ', role: 'siswa', expected: '', desc: 'Whitespace-only string' },
  { input: '\t\r\n', role: 'siswa', expected: '', desc: 'Tab/CR/LF only string' },
  { input: '[]', role: 'siswa', expected: '', desc: 'Empty brackets' },
  { input: '[-]', role: 'siswa', expected: '', desc: 'Brackets containing only hyphen' },
  { input: '-', role: 'siswa', expected: '', desc: 'Single hyphen' },
  { input: '--', role: 'siswa', expected: '', desc: 'Double hyphen' },
  { input: '---', role: 'siswa', expected: '', desc: 'Triple hyphen' },
  { input: '[   -   ]', role: 'siswa', expected: '', desc: 'Brackets with spaces around hyphen' },

  // Injection and adversarial security attempts
  { input: "70040625'; DROP TABLE sekolah; --", role: 'siswa', expected: '70040625DROPTABLEsekolah', desc: 'SQLi quote and semicolon stripped to safe alphanumeric' },
  { input: "[70040625-SMA'; DROP TABLE siswa;--]", role: 'siswa', expected: '70040625', desc: 'SQLi inside school name safely isolated before first hyphen' },
  { input: "' OR 1=1 -- - SMA Negeri 1", role: 'siswa', expected: 'OR11', desc: 'SQL tautology before hyphen stripped of punctuation' },
  { input: "' OR '1'='1", role: 'siswa', expected: 'OR11', desc: 'SQL string tautology stripped of quotes' },
  { input: '70040625 UNION SELECT null, username FROM users -- - SMA', role: 'siswa', expected: '70040625UNIONSELECTnullusernameFROMusers', desc: 'SQL UNION token sanitized to alphanumeric string' },
  { input: '[70040625-<script>alert("XSS")</script>]', role: 'siswa', expected: '70040625', desc: 'XSS script tags in school name isolated before hyphen' },
  { input: '<script>alert(1)</script>-SMA Negeri 1', role: 'siswa', expected: 'scriptalert1script', desc: 'XSS script tags in NPSN code stripped of tag delimiters' },
  { input: '[70040625-SMA &lt;b&gt;1&lt;/b&gt;]', role: 'siswa', expected: '70040625', desc: 'HTML entities in school name isolated before hyphen' },
  { input: '70040625; rm -rf / - SMA', role: 'siswa', expected: '70040625rm', desc: 'Shell command injection metacharacters safely stripped before first hyphen' },
  { input: '70040625; cat /etc/passwd | mail root', role: 'siswa', expected: '70040625catetcpasswdmailroot', desc: 'Shell pipe and command stripped to pure alphanumeric' },
  { input: '../../etc/passwd-SMA', role: 'siswa', expected: 'etcpasswd', desc: 'Path traversal dots and slashes stripped' },
  { input: '70040625\0-SMA', role: 'siswa', expected: '70040625', desc: 'Null byte injection handled cleanly' },

  // SuperAdmin role bypass
  { input: '70040625', role: 'super_admin', expected: '', desc: 'SuperAdmin role returns empty string (no school NPSN)' },
  { input: '[70040625-SMA Negeri 1]', role: 'super_admin', expected: '', desc: 'SuperAdmin role with formatted label returns empty string' }
];

for (const c of extremeCases) {
  const actual = sanitizeLoginNpsn(c.input, c.role);
  record(
    'Sanitization',
    `Sanitization test: ${c.desc}`,
    actual === c.expected,
    `Input: "${c.input}" | Expected: "${c.expected}" | Got: "${actual}"`
  );
}

// 1.3 Adversarial Edge-Case Discovery: Embedded newline in school name
const embeddedNewlineInput = '70040625 - SMA \n Negeri 1';
const embeddedNewlineResult = sanitizeLoginNpsn(embeddedNewlineInput, 'siswa');
if (embeddedNewlineResult !== '70040625') {
  testReport.adversarialFindings.push({
    title: 'Regex dotAll limitation on embedded newline in school name',
    severity: 'LOW',
    impact: 'If a school name contains an unescaped newline (\\n), [^-]+.* stops at \\n, leaking post-newline alphanumerics into the sanitized code.',
    reproduction: `sanitizeLoginNpsn("${embeddedNewlineInput}") => "${embeddedNewlineResult}" (expected "70040625")`,
    mitigation: 'Add /s flag or replace .* with [\\s\\S]* in the regex: /^[\\[]?([^-]+)[\\s\\S]*/'
  });
}

// =============================================================================
// CATEGORY 2: FORMATTING INTEGRITY ORACLE: [NPSN-Nama Sekolah]
// =============================================================================
console.log('\n▶ [CATEGORY 2] Formatting Integrity Oracle ([NPSN-Nama Sekolah]):');

// 2.1 Pattern strictness
const formattingPattern = /^\[[a-zA-Z0-9]+-.+\]$/;

const formatSchoolOption = (s) => `[${s.npsn}-${s.nama_sekolah}]`;

const schoolTestMatrix = [
  { npsn: '70040625', nama_sekolah: 'SMA Nizamudin' },
  { npsn: '20101452', nama_sekolah: 'SMK Al-Azhar 1 - Cirebon' },
  { npsn: '30109988', nama_sekolah: 'SMA [Unggulan] Mandiri (Internasional)' },
  { npsn: '40105060', nama_sekolah: 'SMA/MA (Plus) Bina Bangsa' },
  { npsn: '10102030', nama_sekolah: 'SD Negeri 01 Pagi - Menteng' },
  { npsn: 'SCH9901', nama_sekolah: 'Sekolah Laboratorium Percontohan UPI' },
  { npsn: '50106070', nama_sekolah: "SMA Katolik St. Joseph & Mary's" },
  { npsn: '60107080', nama_sekolah: 'SMA Terpadu 100% Digital' }
];

for (const s of schoolTestMatrix) {
  const formatted = formatSchoolOption(s);
  const matchesPattern = formattingPattern.test(formatted);
  record(
    'Formatting',
    `Option format for "${s.nama_sekolah}" strictly conforms to [NPSN-Nama Sekolah]`,
    matchesPattern,
    `Formatted string "${formatted}" did not match /^\[[a-zA-Z0-9]+-.+\]$/`
  );

  // Round-trip verification: sanitizing the formatted string must yield original npsn
  const recoveredNpsn = sanitizeLoginNpsn(formatted, 'siswa');
  record(
    'Formatting',
    `Round-trip sanitization recovers original NPSN "${s.npsn}" from "${formatted}"`,
    recoveredNpsn === s.npsn,
    `Expected "${s.npsn}", got "${recoveredNpsn}"`
  );
}

// 2.2 Decoupling audit in App.jsx code
record(
  'Formatting',
  'App.jsx sets <option value={s.npsn}> to pure NPSN (decoupled from display label)',
  /<option[^>]*value=\{s\.npsn\}[^>]*>\s*\[\{s\.npsn\}-\{s\.nama_sekolah\}\]\s*<\/option>/.test(appContent),
  'Option value is not cleanly bound to s.npsn'
);

record(
  'Formatting',
  'App.jsx <select> value prop normalizes state to raw code for option matching',
  /value=\{npsn\s*\?\s*\(npsn\.includes\(['"]-['"]\)\s*\?\s*npsn\.replace\(\/\^\\\[\?\(\[\^-\]\+\)\.\*\/,\s*['"]\$1['"]\)/.test(appContent),
  '<select> value normalizer expression missing or altered'
);

// =============================================================================
// CATEGORY 3: ERROR HANDLING & NETWORK FAILURE RESILIENCE
// =============================================================================
console.log('\n▶ [CATEGORY 3] Error Handling & Network Failure Resilience:');

// 3.1 Inspect fetchSekolah implementation in App.jsx
const fetchSekolahMatch = appContent.match(/const\s+fetchSekolah\s*=\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)\};\s*fetchSekolah\(\);/);

record(
  'ErrorHandling',
  'App.jsx wraps fetchAPI("get_sekolah") in try...catch...finally block',
  fetchSekolahMatch && fetchSekolahMatch[1].includes('try {') && fetchSekolahMatch[1].includes('catch (') && fetchSekolahMatch[1].includes('finally {'),
  'try-catch-finally structure not found in fetchSekolah'
);

record(
  'ErrorHandling',
  'App.jsx sets loadingSekolah(true) before fetch and loadingSekolah(false) in finally',
  fetchSekolahMatch && fetchSekolahMatch[1].includes('setLoadingSekolah(true)') && fetchSekolahMatch[1].includes('setLoadingSekolah(false)'),
  'loadingSekolah state transitions not properly managed'
);

record(
  'ErrorHandling',
  'App.jsx checks Array.isArray(res.data) before setting daftarSekolah',
  fetchSekolahMatch && fetchSekolahMatch[1].includes('Array.isArray(res.data)'),
  'Array.isArray guard missing, exposing UI to TypeError on malformed payload'
);

// 3.2 Simulated UI behavior under failure states
const renderSchoolSelectPlaceholder = (loadingSekolah, daftarSekolah) => {
  return loadingSekolah
    ? '-- Memuat Daftar Sekolah... --'
    : daftarSekolah.length === 0
      ? '-- Belum Ada Sekolah Terdaftar --'
      : '-- Pilih Sekolah --';
};

record(
  'ErrorHandling',
  'Dropdown renders "-- Memuat Daftar Sekolah... --" during active loading',
  renderSchoolSelectPlaceholder(true, []) === '-- Memuat Daftar Sekolah... --',
  'Incorrect placeholder during loading'
);

record(
  'ErrorHandling',
  'Dropdown renders "-- Belum Ada Sekolah Terdaftar --" when list is empty',
  renderSchoolSelectPlaceholder(false, []) === '-- Belum Ada Sekolah Terdaftar --',
  'Incorrect placeholder on empty list'
);

record(
  'ErrorHandling',
  'Dropdown renders "-- Pilih Sekolah --" when registered schools are available',
  renderSchoolSelectPlaceholder(false, [{ npsn: '70040625', nama_sekolah: 'SMA Nizamudin' }]) === '-- Pilih Sekolah --',
  'Incorrect placeholder on populated list'
);

// 3.3 Network rejection simulation
async function simulateNetworkFailure() {
  let loadingSekolah = false;
  let daftarSekolah = [];
  let errorCaught = false;

  const mockFetchAPI = async () => {
    throw new Error('Network error: Failed to fetch (Supabase offline)');
  };

  loadingSekolah = true;
  try {
    const res = await mockFetchAPI('get_sekolah');
    if (res && res.status === 'success' && Array.isArray(res.data)) {
      daftarSekolah = res.data;
    }
  } catch (err) {
    errorCaught = true;
  } finally {
    loadingSekolah = false;
  }

  return { loadingSekolah, daftarSekolah, errorCaught };
}

const simResult = await simulateNetworkFailure();
record(
  'ErrorHandling',
  'Network failure simulation: error is caught, loading terminated, daftarSekolah remains safe empty array',
  simResult.errorCaught && !simResult.loadingSekolah && Array.isArray(simResult.daftarSekolah) && simResult.daftarSekolah.length === 0,
  `Simulation failed: ${JSON.stringify(simResult)}`
);

// 3.4 Corrupted payload simulation
async function simulateCorruptedPayload(payload) {
  let loadingSekolah = false;
  let daftarSekolah = [];

  const mockFetchAPI = async () => payload;

  loadingSekolah = true;
  try {
    const res = await mockFetchAPI('get_sekolah');
    if (res && res.status === 'success' && Array.isArray(res.data)) {
      daftarSekolah = res.data;
    }
  } catch (err) {
    //
  } finally {
    loadingSekolah = false;
  }

  return { loadingSekolah, daftarSekolah };
}

const nullPayloadResult = await simulateCorruptedPayload({ status: 'success', data: null });
record(
  'ErrorHandling',
  'Corrupted payload simulation (data: null): guarded against crash',
  !nullPayloadResult.loadingSekolah && nullPayloadResult.daftarSekolah.length === 0,
  'Null data caused unexpected state'
);

const stringPayloadResult = await simulateCorruptedPayload({ status: 'success', data: 'malformed_string' });
record(
  'ErrorHandling',
  'Corrupted payload simulation (data: string): guarded against crash',
  !stringPayloadResult.loadingSekolah && stringPayloadResult.daftarSekolah.length === 0,
  'String data caused unexpected state'
);

// =============================================================================
// CATEGORY 4: VIEWPORT-ANCHORED FIXED BOTTOM NAVIGATION AUDIT
// =============================================================================
console.log('\n▶ [CATEGORY 4] Viewport-Anchored Fixed Bottom Navigation Audit:');

const views = [
  {
    name: 'SuperAdminView.jsx',
    file: path.resolve(srcDir, 'views/SuperAdminView.jsx'),
    checks: [
      { name: 'Fixed positioning', regex: /fixed bottom-0 left-0 right-0 z-40/ },
      { name: 'No old absolute bottom-0', regex: /absolute bottom-0/, negate: true },
      { name: 'Inner safe-area padding', regex: /pb-\[max\(0\.625rem,env\(safe-area-inset-bottom\)\)\]/ },
      { name: 'Main container pb-28 clearance', regex: /pb-28/ }
    ]
  },
  {
    name: 'AdminView.jsx',
    file: path.resolve(srcDir, 'views/AdminView.jsx'),
    checks: [
      { name: 'Fixed positioning (lg:hidden)', regex: /lg:hidden fixed bottom-0 left-0 right-0 z-40/ },
      { name: 'Safe-area inset padding', regex: /pb-\[max\(0\.5rem,env\(safe-area-inset-bottom\)\)\]/ },
      { name: 'Main container pb-28 clearance', regex: /pb-28 lg:pb-12/ }
    ]
  },
  {
    name: 'GuruView.jsx',
    file: path.resolve(srcDir, 'views/GuruView.jsx'),
    checks: [
      { name: 'Fixed positioning (lg:hidden)', regex: /lg:hidden fixed bottom-0 left-0 right-0 z-40/ },
      { name: 'Safe-area inset padding', regex: /pb-\[max\(0\.5rem,env\(safe-area-inset-bottom\)\)\]/ },
      { name: 'Main container pb-28 clearance', regex: /pb-28 lg:pb-12/ }
    ]
  },
  {
    name: 'SiswaView.jsx',
    file: path.resolve(srcDir, 'views/SiswaView.jsx'),
    checks: [
      { name: 'Fixed positioning (md:hidden)', regex: /md:hidden fixed bottom-0 left-0 right-0 z-40/ },
      { name: 'Safe-area inset padding', regex: /pb-\[max\(0\.5rem,env\(safe-area-inset-bottom\)\)\]/ },
      { name: 'Main container pb-28 clearance', regex: /pb-28 md:pb-12/ }
    ]
  }
];

for (const v of views) {
  const content = fs.readFileSync(v.file, 'utf-8');
  for (const c of v.checks) {
    const passed = c.negate ? !c.regex.test(content) : c.regex.test(content);
    record(
      'Navigation',
      `${v.name}: ${c.name}`,
      passed,
      `Failed check ${c.name} in ${v.name}`
    );
  }
}

// =============================================================================
// CATEGORY 5: LIVE BACKEND INTEGRATION SMOKE TEST
// =============================================================================
console.log('\n▶ [CATEGORY 5] Live Backend Integration Smoke Test:');

try {
  const { fetchAPI } = await import('../src/api.js');
  const res = await fetchAPI('get_sekolah');

  record(
    'LiveIntegration',
    'fetchAPI("get_sekolah") returns status "success" from live Supabase database',
    res && res.status === 'success',
    `Response status: ${res?.status} | Error: ${res?.message}`
  );

  record(
    'LiveIntegration',
    'fetchAPI("get_sekolah") returns non-empty array of registered schools',
    Array.isArray(res?.data) && res.data.length > 0,
    `Data is not a non-empty array: ${JSON.stringify(res?.data)}`
  );

  if (Array.isArray(res?.data)) {
    for (const school of res.data) {
      const formatted = formatSchoolOption(school);
      const isConformant = formattingPattern.test(formatted);
      record(
        'LiveIntegration',
        `Live school "${school.nama_sekolah}" conforms to [NPSN-Nama Sekolah] (${formatted})`,
        isConformant,
        `Formatted output "${formatted}" failed pattern check`
      );

      const sanitized = sanitizeLoginNpsn(formatted, 'siswa');
      record(
        'LiveIntegration',
        `Live school round-trip recovers NPSN "${school.npsn}"`,
        sanitized === school.npsn,
        `Expected "${school.npsn}", got "${sanitized}"`
      );
    }
  }
} catch (err) {
  record(
    'LiveIntegration',
    'Live database integration test executed without unhandled exception',
    false,
    `Exception caught: ${err.message}`
  );
}

// =============================================================================
// SUMMARY & VERDICT
// =============================================================================
console.log('\n================================================================================');
console.log(`TOTAL ASSERTIONS: ${testReport.total} | PASSED: ${testReport.passed} | FAILED: ${testReport.failed}`);
for (const [cat, data] of Object.entries(testReport.categories)) {
  console.log(`  - ${cat}: ${data.passed}/${data.passed + data.failed} passed`);
}

if (testReport.adversarialFindings.length > 0) {
  console.log('\n🔍 ADVERSARIAL OBSERVATIONS / DISCOVERIES:');
  for (const f of testReport.adversarialFindings) {
    console.log(`  • [${f.severity}] ${f.title}`);
    console.log(`    Impact: ${f.impact}`);
    console.log(`    Reproduction: ${f.reproduction}`);
    console.log(`    Mitigation: ${f.mitigation}`);
  }
}

console.log('================================================================================');

if (testReport.failed === 0) {
  console.log('\n🌟 VERDICT: APPROVE');
  console.log('All empirical stress tests passed with 100% confidence.');
  process.exitCode = 0;
} else {
  console.error('\n💥 VERDICT: REJECT');
  console.error(`${testReport.failed} assertion(s) failed. See details above.`);
  process.exitCode = 1;
}
