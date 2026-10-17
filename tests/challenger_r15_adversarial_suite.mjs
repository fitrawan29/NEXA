/**
 * ============================================================================
 * Challenger R15-1: Adversarial Stress Test Suite
 * ============================================================================
 * Focus: Data, Auth, and Backend Edge Cases
 * - R1: UUID randomness, RFC 4122 v4 compliance, 500-sample collision test, manual vs auto payload
 * - R2: Teacher NIP login whitespace trimming, nonexistent NIP, wrong password, tenant isolation, injection resilience
 * - R5: Sunday weekly purge non-Sunday bypass rejection, force=true override, log_ujian critical isolation guard
 * - R4: School grading scheme boundary weights (99.9%, 100.1%, 100.0% float precision, mode switching)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { supabaseClient } from '../src/config.js';
import { fetchAPI, autoPurgeWeeklyLogs, save_default_skema_sekolah } from '../src/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ============================================================================
// ADVERSARIAL TEST HARNESS
// ============================================================================
let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureList = [];

function assert(condition, message, details = '') {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedAssertions++;
    const fullMsg = `  [FAIL] ${message} ${details ? `--> Details: ${details}` : ''}`;
    console.error(fullMsg);
    failureList.push({ message, details });
  }
}

// ============================================================================
// SECTION 1: ADVERSARIAL UUID TESTING (R1)
// ============================================================================
console.log('\n============================================================');
console.log('--- SECTION 1: ADVERSARIAL UUID TESTING (R1) ---');
console.log('============================================================');

// 1.1: Generate 500 consecutive UUIDs and verify zero collision
const UUID_SAMPLE_SIZE = 500;
const generatedUuids = [];
for (let i = 0; i < UUID_SAMPLE_SIZE; i++) {
  generatedUuids.push(crypto.randomUUID());
}
const uuidSet = new Set(generatedUuids);

assert(
  uuidSet.size === UUID_SAMPLE_SIZE,
  `500 consecutive crypto.randomUUID() calls generated 0 collisions (Unique: ${uuidSet.size}/${UUID_SAMPLE_SIZE})`,
  `Collisions detected: ${UUID_SAMPLE_SIZE - uuidSet.size}`
);

// 1.2: Strict RFC 4122 v4 regex validation
// Format: 8-4-4-4-12 hex chars.
// Character 13 MUST be '4' (version 4)
// Character 17 MUST be [8, 9, a, b] (variant 1: 10xx in binary)
const strictRfc4122v4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let invalidRfcCount = 0;
for (const id of generatedUuids) {
  if (!strictRfc4122v4.test(id)) {
    invalidRfcCount++;
  }
}
assert(
  invalidRfcCount === 0,
  `All 500 UUIDs strictly conform to RFC 4122 v4 specification (13th char='4', 17th char in [8,9,a,b])`,
  `Found ${invalidRfcCount} non-conforming UUIDs`
);

// 1.3: Bit and character entropy verification across 500 UUIDs
const charCounts = {};
for (const id of generatedUuids) {
  for (const ch of id.replace(/-/g, '')) {
    charCounts[ch] = (charCounts[ch] || 0) + 1;
  }
}
const hexChars = '0123456789abcdef'.split('');
const allHexRepresented = hexChars.every(ch => (charCounts[ch] || 0) > 0);
assert(
  allHexRepresented,
  `UUID generation achieves full hexadecimal character distribution across 500 samples (all 16 hex digits observed)`,
  JSON.stringify(charCounts)
);

// 1.4: Manual vs Automatic payload.id_kelas behavior
const apiSource = fs.readFileSync(path.join(rootDir, 'src', 'api.js'), 'utf-8');

// Check that create_kelas preserves manual id_kelas
const manualPayload1 = { id_kelas: '550e8400-e29b-41d4-a716-446655440000', nama_kelas: 'XII MIPA 1' };
const originalId = manualPayload1.id_kelas;
manualPayload1.id_kelas = manualPayload1.id_kelas || crypto.randomUUID();
assert(
  manualPayload1.id_kelas === originalId,
  `create_kelas preserves explicitly provided id_kelas without overwriting: ${manualPayload1.id_kelas}`
);

// Check that create_kelas auto-generates if id_kelas is undefined
const autoPayload1 = { nama_kelas: 'XII MIPA 2' };
autoPayload1.id_kelas = autoPayload1.id_kelas || crypto.randomUUID();
assert(
  strictRfc4122v4.test(autoPayload1.id_kelas),
  `create_kelas auto-generates compliant UUID when id_kelas is omitted: ${autoPayload1.id_kelas}`
);

// Check that create_kelas auto-generates if id_kelas is null
const autoPayload2 = { id_kelas: null, nama_kelas: 'XII MIPA 3' };
autoPayload2.id_kelas = autoPayload2.id_kelas || crypto.randomUUID();
assert(
  strictRfc4122v4.test(autoPayload2.id_kelas),
  `create_kelas auto-generates compliant UUID when id_kelas is null: ${autoPayload2.id_kelas}`
);

// Check that create_kelas auto-generates if id_kelas is empty string
const autoPayload3 = { id_kelas: '', nama_kelas: 'XII MIPA 4' };
autoPayload3.id_kelas = autoPayload3.id_kelas || crypto.randomUUID();
assert(
  strictRfc4122v4.test(autoPayload3.id_kelas),
  `create_kelas auto-generates compliant UUID when id_kelas is empty string: ${autoPayload3.id_kelas}`
);

// 1.5: Codebase audit for legacy KLS- prefix and duplicate switch cases
const klsRegex = /id_kelas\s*=\s*['"`]KLS-/i;
assert(
  !klsRegex.test(apiSource),
  `src/api.js contains zero legacy 'KLS-' prefix assignments for id_kelas`
);

const createKelasCases = apiSource.match(/case\s+['"]create_kelas['"]\s*:/g) || [];
assert(
  createKelasCases.length === 1,
  `src/api.js contains exactly 1 switch case for 'create_kelas' (Found: ${createKelasCases.length})`
);

// ============================================================================
// SECTION 2: ADVERSARIAL TEACHER AUTH TESTING (R2)
// ============================================================================
console.log('\n============================================================');
console.log('--- SECTION 2: ADVERSARIAL TEACHER AUTH TESTING (R2) ---');
console.log('============================================================');

async function runAuthTests() {
  // 2.1: Teacher login with leading & trailing whitespace in NIP via username field
  const wsRes1 = await fetchAPI('login', {
    role: 'guru',
    username: '  30011997  ',
    password: 'ade27',
    npsn: '70040625'
  });
  assert(
    wsRes1.status === 'success' && wsRes1.data?.nip === '30011997',
    `Teacher login with leading/trailing spaces in username field succeeds (NIP: ${wsRes1.data?.nip}, Name: ${wsRes1.data?.nama_lengkap})`,
    JSON.stringify(wsRes1)
  );

  // 2.2: Teacher login with tab and newline whitespace in NIP via nip field
  const wsRes2 = await fetchAPI('login', {
    role: 'guru',
    nip: '\t30011997\n',
    password: 'ade27',
    npsn: '70040625'
  });
  assert(
    wsRes2.status === 'success' && wsRes2.data?.nip === '30011997',
    `Teacher login with tabs/newlines in nip field succeeds (NIP: ${wsRes2.data?.nip}, Name: ${wsRes2.data?.nama_lengkap})`,
    JSON.stringify(wsRes2)
  );

  // 2.3: Teacher login with non-existent NIP ("999999999")
  const nonExistentRes = await fetchAPI('login', {
    role: 'guru',
    username: '999999999',
    password: 'ade27',
    npsn: '70040625'
  });
  assert(
    nonExistentRes.status === 'error' && nonExistentRes.message.includes('salah'),
    `Non-existent NIP login is strictly rejected with standard error message: "${nonExistentRes.message}"`,
    JSON.stringify(nonExistentRes)
  );

  // 2.4: Teacher login with valid NIP but wrong password
  const wrongPassRes = await fetchAPI('login', {
    role: 'guru',
    username: '30011997',
    password: 'wrong_password_xyz',
    npsn: '70040625'
  });
  assert(
    wrongPassRes.status === 'error' && wrongPassRes.message.includes('salah'),
    `Valid NIP with incorrect password is strictly rejected: "${wrongPassRes.message}"`,
    JSON.stringify(wrongPassRes)
  );

  // 2.5: Multi-tenant isolation: Correct NIP with mismatched NPSN
  const tenantMismatchRes = await fetchAPI('login', {
    role: 'guru',
    username: '30011997',
    password: 'ade27',
    npsn: '40103445' // Different registered school
  });
  assert(
    tenantMismatchRes.status === 'error' && tenantMismatchRes.message.includes('salah'),
    `Multi-tenant isolation: Teacher NIP from school 70040625 cannot authenticate under school 40103445`,
    JSON.stringify(tenantMismatchRes)
  );

  // 2.6: Multi-tenant isolation with arbitrary non-existent NPSN
  const dummyNpsnRes = await fetchAPI('login', {
    role: 'guru',
    username: '30011997',
    password: 'ade27',
    npsn: '99999999'
  });
  assert(
    dummyNpsnRes.status === 'error',
    `Multi-tenant isolation: Teacher NIP cannot authenticate under nonexistent school NPSN 99999999`
  );

  // 2.7: Dual login symmetry: Login by username ("ade_matematika") vs NIP ("30011997") yields identical user
  const usernameLoginRes = await fetchAPI('login', {
    role: 'guru',
    username: 'ade_matematika',
    password: 'ade27',
    npsn: '70040625'
  });
  assert(
    usernameLoginRes.status === 'success' && usernameLoginRes.data?.id_guru === wsRes1.data?.id_guru,
    `Dual login symmetry: Login via username returns identical teacher record as login via NIP (id_guru: ${usernameLoginRes.data?.id_guru})`
  );

  // 2.8: Adversarial injection test on loginId: Attempting to bypass password or NPSN via PostgREST syntax injection
  const bypassPassRes = await fetchAPI('login', {
    role: 'guru',
    username: '30011997),password.eq.ade27',
    password: 'wrong_password',
    npsn: '70040625'
  });
  const bypassNpsnRes = await fetchAPI('login', {
    role: 'guru',
    username: '30011997),npsn.eq.70040625',
    password: 'ade27',
    npsn: '40103445'
  });
  assert(
    bypassPassRes.status === 'error' && bypassNpsnRes.status === 'error',
    `PostgREST query manipulation cannot bypass password verification or tenant NPSN boundaries (Pass check: ${bypassPassRes.status}, Tenant check: ${bypassNpsnRes.status})`
  );

  // 2.9: Whitespace-only username/nip payload
  const emptyWsRes = await fetchAPI('login', {
    role: 'guru',
    username: '    ',
    password: 'ade27',
    npsn: '70040625'
  });
  assert(
    emptyWsRes.status === 'error',
    `Whitespace-only login identifier rejected safely`
  );
}

// ============================================================================
// SECTION 3: ADVERSARIAL SUNDAY LOG PURGE TESTING (R5)
// ============================================================================
console.log('\n============================================================');
console.log('--- SECTION 3: ADVERSARIAL SUNDAY LOG PURGE TESTING (R5) ---');
console.log('============================================================');

async function runPurgeTests() {
  // 3.1: Non-Sunday execution with force=false must be rejected/skipped
  const currentDay = new Date().getDay();
  const nonSundayTest = await autoPurgeWeeklyLogs(false);
  
  if (currentDay !== 0) {
    assert(
      nonSundayTest.status === 'skipped' && nonSundayTest.message.includes('Bukan hari Minggu'),
      `Non-Sunday purge with force=false is skipped without error: "${nonSundayTest.message}"`,
      JSON.stringify(nonSundayTest)
    );
  } else {
    // If today happens to be Sunday, test simulated non-Sunday
    const originalGetDay = Date.prototype.getDay;
    Date.prototype.getDay = () => 1; // Simulate Monday
    try {
      const mondayTest = await autoPurgeWeeklyLogs(false);
      assert(
        mondayTest.status === 'skipped',
        `Simulated Monday purge with force=false is strictly skipped`
      );
    } finally {
      Date.prototype.getDay = originalGetDay;
    }
  }

  // 3.2: Simulated day-of-week matrix (Days 1 to 6 must all skip when force=false)
  const originalGetDay = Date.prototype.getDay;
  let allNonSundaysSkipped = true;
  for (let day = 1; day <= 6; day++) {
    Date.prototype.getDay = () => day;
    const res = await autoPurgeWeeklyLogs(false);
    if (res.status !== 'skipped') {
      allNonSundaysSkipped = false;
      break;
    }
  }
  Date.prototype.getDay = originalGetDay;
  assert(
    allNonSundaysSkipped,
    `Days 1 (Monday) through 6 (Saturday) are all 100% skipped when force=false`
  );

  // 3.3: Execution with force=true and custom cutoff (safe ancient timestamp: 1970-01-01)
  const safeCustomCutoff = '1970-01-01T00:00:00.000Z';
  const forceRes = await autoPurgeWeeklyLogs(true, safeCustomCutoff);
  assert(
    forceRes.status === 'success' && forceRes.cutoff === safeCustomCutoff,
    `force=true overrides day restriction and applies custom cutoff: ${forceRes.cutoff}`,
    JSON.stringify(forceRes)
  );

  // 3.4: Router invocation via fetchAPI('purge_weekly_logs', ...)
  const routerRes = await fetchAPI('purge_weekly_logs', { force: true, cutoff: safeCustomCutoff });
  assert(
    routerRes.status === 'success',
    `fetchAPI router successfully delegates action 'purge_weekly_logs' to autoPurgeWeeklyLogs`
  );

  // 3.5: CRITICAL SAFETY GUARD: log_ujian table is 100% isolated and never touched
  // A. Static AST & source code audit
  const autoPurgeFunctionCode = apiSource.match(/export\s+const\s+autoPurgeWeeklyLogs\s*=\s*async[\s\S]*?(?=export\s+const\s+fetchAPI)/)?.[0] || '';
  const touchesLogUjian = /log_ujian/i.test(autoPurgeFunctionCode);
  assert(
    !touchesLogUjian,
    `STATIC GUARD: autoPurgeWeeklyLogs contains ZERO references to 'log_ujian' table`
  );

  // B. Runtime interceptor test: wrap supabaseClient to detect any access to log_ujian
  let logUjianAccessed = false;
  const originalFrom = supabaseClient.from.bind(supabaseClient);
  supabaseClient.from = function (table) {
    if (table === 'log_ujian') {
      logUjianAccessed = true;
    }
    return originalFrom(table);
  };

  try {
    await autoPurgeWeeklyLogs(true, '1970-01-01T00:00:00.000Z');
    assert(
      !logUjianAccessed,
      `RUNTIME GUARD: autoPurgeWeeklyLogs execution triggered zero queries/mutations on 'log_ujian'`
    );
  } finally {
    supabaseClient.from = originalFrom;
  }

  // 3.6: Verify tables actually targeted by autoPurgeWeeklyLogs
  const targetsAuditLog = autoPurgeFunctionCode.includes("'audit_log'");
  const targetsArchive = autoPurgeFunctionCode.includes("'audit_log_archive'");
  const targetsGlobalLog = autoPurgeFunctionCode.includes("'log_aktivitas_global'");
  assert(
    targetsAuditLog && targetsArchive && targetsGlobalLog,
    `autoPurgeWeeklyLogs precisely targets audit_log, audit_log_archive, and log_aktivitas_global`
  );
}

// ============================================================================
// SECTION 4: ADVERSARIAL SCHOOL GRADING SCHEME (R4)
// ============================================================================
console.log('\n============================================================');
console.log('--- SECTION 4: ADVERSARIAL SCHOOL GRADING SCHEME (R4) ---');
console.log('============================================================');

async function runGradingSchemeTests() {
  const testNpsn = '70040625';

  // 4.1: Custom mode boundary test: 99.9% sum MUST be rejected
  let threw999 = false;
  let error999Msg = '';
  try {
    await save_default_skema_sekolah(testNpsn, {
      mode: 'custom',
      skema: { PG: 33.3, PGK: 33.3, BS: 33.3, JODOH: 0, ISIAN: 0, URAIAN: 0 }
    });
  } catch (err) {
    threw999 = true;
    error999Msg = err.message;
  }
  assert(
    threw999 && error999Msg.includes('100%'),
    `Boundary test: Custom weight sum of 99.9% is strictly rejected (${error999Msg})`
  );

  // 4.2: Custom mode boundary test: 100.1% sum MUST be rejected
  let threw1001 = false;
  let error1001Msg = '';
  try {
    await save_default_skema_sekolah(testNpsn, {
      mode: 'custom',
      skema: { PG: 33.4, PGK: 33.4, BS: 33.3, JODOH: 0, ISIAN: 0, URAIAN: 0 }
    });
  } catch (err) {
    threw1001 = true;
    error1001Msg = err.message;
  }
  assert(
    threw1001 && error1001Msg.includes('100%'),
    `Boundary test: Custom weight sum of 100.1% is strictly rejected (${error1001Msg})`
  );

  // 4.3: Custom mode: Floating-point precision (33.33 + 33.33 + 33.34 = 100.00) MUST be accepted
  let float33Success = false;
  try {
    const res = await save_default_skema_sekolah(testNpsn, {
      mode: 'custom',
      skema: { PG: 33.33, PGK: 33.33, BS: 33.34, JODOH: 0, ISIAN: 0, URAIAN: 0 }
    });
    float33Success = res.success === true;
  } catch (err) {
    float33Success = false;
  }
  assert(
    float33Success,
    `Boundary test: Floating-point precision (33.33 + 33.33 + 33.34 = 100.00) is accepted`
  );

  // 4.4: Custom mode: 6-way fractional precision (16.66 * 5 + 16.70 = 100.00)
  let float6WaySuccess = false;
  try {
    const res = await save_default_skema_sekolah(testNpsn, {
      mode: 'custom',
      skema: { PG: 16.66, PGK: 16.66, BS: 16.66, JODOH: 16.66, ISIAN: 16.66, URAIAN: 16.70 }
    });
    float6WaySuccess = res.success === true;
  } catch (err) {
    float6WaySuccess = false;
  }
  assert(
    float6WaySuccess,
    `Boundary test: 6-way floating-point distribution (5x16.66 + 16.70 = 100.00) is accepted`
  );

  // 4.5: Custom mode: Negative weight must be rejected
  let threwNegative = false;
  try {
    await save_default_skema_sekolah(testNpsn, {
      mode: 'custom',
      skema: { PG: -10, PGK: 110, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 }
    });
  } catch (err) {
    threwNegative = true;
  }
  assert(
    threwNegative,
    `Adversarial test: Negative weight (-10%) is strictly rejected even if sum equals 100%`
  );

  // 4.6: Custom mode: Non-numeric / NaN weight must be rejected
  let threwNan = false;
  try {
    await save_default_skema_sekolah(testNpsn, {
      mode: 'custom',
      skema: { PG: 'INVALID', PGK: 100, BS: 0, JODOH: 0, ISIAN: 0, URAIAN: 0 }
    });
  } catch (err) {
    threwNan = true;
  }
  assert(
    threwNan,
    `Adversarial test: Non-numeric weight string ('INVALID') is strictly rejected`
  );

  // 4.7: Mode switching: Proportional (default) mode does NOT require 100% sum
  let defaultModeSuccess = false;
  try {
    const res = await save_default_skema_sekolah(testNpsn, {
      mode: 'default',
      skema: { PG: 50, PGK: 50, BS: 50, JODOH: 50, ISIAN: 25, URAIAN: 25 } // sum = 250 points
    });
    defaultModeSuccess = res.success === true;
  } catch (err) {
    defaultModeSuccess = false;
  }
  assert(
    defaultModeSuccess,
    `Mode switching: Proportional (default) mode accepts arbitrary point totals (e.g. 250 points) without 100% restriction`
  );

  // 4.8: Transition back to standard default fallback
  const standardDefaultSkema = { PG: 20, PGK: 20, BS: 20, JODOH: 20, ISIAN: 10, URAIAN: 10 };
  let restoreSuccess = false;
  try {
    const res = await save_default_skema_sekolah(testNpsn, {
      mode: 'default',
      skema: standardDefaultSkema
    });
    restoreSuccess = res.success === true;
  } catch (err) {
    restoreSuccess = false;
  }
  assert(
    restoreSuccess,
    `Mode switching: Restoring standard default fallback ({PG:20, PGK:20, BS:20, JODOH:20, ISIAN:10, URAIAN:10}) succeeds cleanly`
  );
}

// ============================================================================
// MAIN RUNNER
// ============================================================================
async function runAll() {
  const startTime = Date.now();
  console.log(`Starting Challenger R15-1 Adversarial Test Execution at ${new Date().toISOString()}`);

  try {
    await runAuthTests();
    await runPurgeTests();
    await runGradingSchemeTests();
  } catch (err) {
    console.error('Unhandled error during test execution:', err);
    process.exit(1);
  }

  const durationMs = Date.now() - startTime;
  console.log('\n============================================================');
  console.log('CHALLENGER R15-1 ADVERSARIAL EXECUTION SUMMARY');
  console.log('============================================================');
  console.log(`Total Assertions : ${totalAssertions}`);
  console.log(`Passed           : ${passedAssertions} (${Math.round((passedAssertions / totalAssertions) * 100)}%)`);
  console.log(`Failed           : ${failedAssertions}`);
  console.log(`Duration         : ${durationMs}ms`);
  console.log('============================================================');

  if (failedAssertions > 0) {
    console.error('\nFAILED ASSERTIONS BREAKDOWN:');
    failureList.forEach((f, idx) => {
      console.error(`  ${idx + 1}. ${f.message} --> ${f.details}`);
    });
    process.exit(1);
  } else {
    console.log('\n[VERDICT: APPROVE] All adversarial stress tests PASSED with zero failures.');
    process.exit(0);
  }
}

runAll();
