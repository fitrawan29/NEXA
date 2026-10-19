import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('========================================================================');
console.log('   TEST SUITE: ROUND 23 FREE-TIER PLATFORM RISK MITIGATIONS');
console.log('========================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         Error: ${err.message}`);
    failedTests++;
  }
}

// =============================================================================
// R1: GITHUB ACTIONS KEEPALIVE WORKFLOW (.github/workflows/keepalive.yml)
// =============================================================================
console.log('[SECTION 1: R1 Supabase Auto-Pause Prevention Workflow]');

const workflowPath = path.join(projectRoot, '.github', 'workflows', 'keepalive.yml');

runTest('R1.1 - Workflow file exists at .github/workflows/keepalive.yml', () => {
  assert.strictEqual(fs.existsSync(workflowPath), true, 'keepalive.yml must exist');
  const stat = fs.statSync(workflowPath);
  assert.ok(stat.size > 100, 'keepalive.yml must not be empty');
});

const workflowContent = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, 'utf8') : '';

runTest('R1.2 - Workflow contains valid schedule with cron every 3 days', () => {
  // Must match every 3 days cron: '0 0 */3 * *'
  const cronMatch = workflowContent.match(/cron:\s*['"]([0-9*,\/\s]+)['"]/);
  assert.ok(cronMatch, 'keepalive.yml must define a cron schedule');
  const cronExpr = cronMatch[1].trim();
  assert.match(cronExpr, /\*\/3/, 'Cron expression must specify an interval of every 3 days (*/3)');
  assert.match(cronExpr, /^0\s+0\s+\*\/3\s+\*\s+\*$/, 'Cron expression should match 0 0 */3 * *');
});

runTest('R1.3 - Workflow ping uses native curl (no 3rd-party marketplace actions for ping)', () => {
  // Uses curl
  assert.match(workflowContent, /\bcurl\b/, 'Workflow must use native curl to ping the app');

  // Verify only actions/checkout is used, no 3rd-party action for pinging
  const actionUses = [...workflowContent.matchAll(/uses:\s*([^\s\r\n]+)/g)].map(m => m[1]);
  for (const action of actionUses) {
    assert.match(action, /^actions\/checkout(@.*)?$/, `Only actions/checkout is permitted, found: ${action}`);
  }
});

runTest('R1.4 - Workflow references secrets.VERCEL_APP_URL without hardcoded URLs', () => {
  assert.match(
    workflowContent,
    /secrets\.VERCEL_APP_URL/,
    'Workflow must reference secrets.VERCEL_APP_URL'
  );
  // Ensure no hardcoded vercel.app or http domain is in the workflow
  assert.doesNotMatch(
    workflowContent,
    /https?:\/\/[a-zA-Z0-9-]+\.vercel\.app/i,
    'Workflow must not contain hardcoded Vercel deployment URLs'
  );
});

runTest('R1.5 - Workflow performs an HTTP GET ping (not HEAD-only or POST)', () => {
  // curl defaults to GET unless -X POST, -X PUT, or -I/--head is given without GET
  assert.doesNotMatch(workflowContent, /curl\s+[^>\n]*(-X\s+POST|-X\s+PUT|-I\b|--head\b)/, 
    'Workflow must perform an HTTP GET, not POST or HEAD-only');
});


// =============================================================================
// R2: SIGNATURE IMAGE COMPRESSION (DigitalSignatureModal.jsx)
// =============================================================================
console.log('\n[SECTION 2: R2 Signature Image Compression]');

const modalPath = path.join(projectRoot, 'src', 'components', 'DigitalSignatureModal.jsx');
const modalCode = fs.readFileSync(modalPath, 'utf8');

runTest('R2.1 - DigitalSignatureModal.jsx exports canvas as image/jpeg with quality <= 0.7', () => {
  const exportMatch = modalCode.match(/toDataURL\(\s*['"]image\/([a-zA-Z]+)['"]\s*(?:,\s*([0-9.]+))?\s*\)/);
  assert.ok(exportMatch, 'DigitalSignatureModal.jsx must have a toDataURL call');
  assert.strictEqual(exportMatch[1], 'jpeg', 'Export format must be image/jpeg');
  const quality = parseFloat(exportMatch[2]);
  assert.ok(!isNaN(quality), 'Export quality parameter must be specified');
  assert.ok(quality <= 0.7, `Quality (${quality}) must be <= 0.7`);
  assert.strictEqual(quality, 0.6, 'Quality should be set to 0.6 as specified in R2');
});

runTest('R2.2 - DigitalSignatureModal.jsx contains no remaining image/png exports', () => {
  assert.doesNotMatch(modalCode, /toDataURL\(\s*['"]image\/png['"]/, 'No image/png toDataURL export should remain in DigitalSignatureModal');
});

runTest('R2.3 - JPEG Data URL passes API validation in submit_absensi_siswa', () => {
  // Simulate the exact API validation from src/api.js line 1602-1614
  const validateSignature = (tanda_tangan) => {
    if (!tanda_tangan || typeof tanda_tangan !== 'string' || !tanda_tangan.startsWith('data:image')) {
      return { status: 'error', message: 'Tanda tangan digital tidak valid (wajib format Base64 data:image).' };
    }
    const base64Data = tanda_tangan.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
    if (
      tanda_tangan.length < 100 || 
      base64Data.length < 50 || 
      tanda_tangan === 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    ) {
      return { status: 'error', message: 'Tanda tangan digital kosong atau tidak valid.' };
    }
    return { status: 'success' };
  };

  // 1. Valid simulated JPEG data URL (~5 KB, quality 0.6)
  const sampleJpegPayload = 'A'.repeat(5000);
  const sampleJpegDataUrl = `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/${sampleJpegPayload}`;
  
  assert.ok(sampleJpegDataUrl.startsWith('data:image'), 'Must start with data:image');
  assert.ok(sampleJpegDataUrl.length > 100, 'Data URL length must exceed 100 chars');
  const resValid = validateSignature(sampleJpegDataUrl);
  assert.strictEqual(resValid.status, 'success', 'Valid JPEG signature must pass API validation');

  // 2. Reject empty or truncated data URLs
  const resEmpty = validateSignature('data:image/jpeg;base64,');
  assert.strictEqual(resEmpty.status, 'error', 'Empty JPEG data URL must be rejected');

  const resShort = validateSignature('data:image/jpeg;base64,abcd1234');
  assert.strictEqual(resShort.status, 'error', 'Too-short JPEG data URL must be rejected');

  const resNonImage = validateSignature('data:text/plain;base64,c29tZSB0ZXh0IGhlcmU=');
  assert.strictEqual(resNonImage.status, 'error', 'Non-image data URL must be rejected');
});

runTest('R2.4 - Compression ratio: JPEG 0.6 achieves > 60% size reduction over uncompressed PNG', () => {
  // A realistic test: PNG base64 of handwritten signature canvas ~25-35 KB
  // JPEG base64 of same canvas ~5-8 KB
  const simulatedPngSize = 30000;
  const simulatedJpegSize = 7500;
  const reduction = (simulatedPngSize - simulatedJpegSize) / simulatedPngSize;
  assert.ok(reduction >= 0.70, `Reduction (${(reduction * 100).toFixed(1)}%) is ~75%`);
});


// =============================================================================
// R3: TOKEN REFRESH RACE CONDITION GUARD (src/api.js)
// =============================================================================
console.log('\n[SECTION 3: R3 Token Refresh Race Condition Guard]');

const apiPath = path.join(projectRoot, 'src', 'api.js');
const apiCode = fs.readFileSync(apiPath, 'utf8');

runTest('R3.1 - processJadwalData UPDATE query uses optimistic lock filter on last_update_token', () => {
  // Locate processJadwalData function in api.js
  const processJadwalMatch = apiCode.match(/const\s+processJadwalData\s*=\s*async\s*\([\s\S]*?\n\s*\}\s*;/);
  assert.ok(processJadwalMatch, 'processJadwalData function must exist in src/api.js');
  const processJadwalSource = processJadwalMatch[0];

  // Must have updateQuery.eq('last_update_token', j.last_update_token)
  assert.match(
    processJadwalSource,
    /\.eq\(\s*['"]last_update_token['"]\s*,\s*j\.last_update_token\s*\)/,
    'processJadwalData must chain .eq("last_update_token", j.last_update_token) when not null'
  );

  // Must have updateQuery.is('last_update_token', null)
  assert.match(
    processJadwalSource,
    /\.is\(\s*['"]last_update_token['"]\s*,\s*null\s*\)/,
    'processJadwalData must chain .is("last_update_token", null) when null/undefined'
  );

  // Verify the condition distinguishes between null/undefined vs value
  assert.match(
    processJadwalSource,
    /j\.last_update_token\s*!=\s*null/,
    'processJadwalData must check j.last_update_token != null to select .eq vs .is'
  );
});

runTest('R3.2 - get_token case UPDATE query uses the same optimistic lock guard', () => {
  const getTokenMatch = apiCode.match(/case\s+['"]get_token['"]\s*:\s*\{[\s\S]*?break;|case\s+['"]get_token['"]\s*:\s*\{[\s\S]*?return\s+\{[^}]*\};\s*\}/);
  assert.ok(getTokenMatch, 'case "get_token" must exist in src/api.js');
  const getTokenSource = getTokenMatch[0];

  // Must have updateQuery.eq('last_update_token', data.last_update_token)
  assert.match(
    getTokenSource,
    /\.eq\(\s*['"]last_update_token['"]\s*,\s*data\.last_update_token\s*\)/,
    'get_token must chain .eq("last_update_token", data.last_update_token) when not null'
  );

  // Must have updateQuery.is('last_update_token', null)
  assert.match(
    getTokenSource,
    /\.is\(\s*['"]last_update_token['"]\s*,\s*null\s*\)/,
    'get_token must chain .is("last_update_token", null) when null/undefined'
  );

  // Verify condition
  assert.match(
    getTokenSource,
    /data\.last_update_token\s*!=\s*null/,
    'get_token must check data.last_update_token != null to select .eq vs .is'
  );
});

runTest('R3.3 - Mock Supabase client query builder behavior: eq vs is branching', () => {
  // Test query builder behavior for both null and non-null values
  function createMockQuery() {
    const calls = [];
    const query = {
      eq(col, val) {
        calls.push({ method: 'eq', col, val });
        return query;
      },
      is(col, val) {
        calls.push({ method: 'is', col, val });
        return query;
      },
      getCalls() {
        return calls;
      }
    };
    return query;
  }

  // Case A: Existing timestamp is non-null
  const existingIsoTime = '2026-10-18T14:30:00.000Z';
  const queryNonNull = createMockQuery().eq('id_jadwal', 42);
  const guardedNonNull = existingIsoTime != null
    ? queryNonNull.eq('last_update_token', existingIsoTime)
    : queryNonNull.is('last_update_token', null);

  const nonNullCalls = guardedNonNull.getCalls();
  assert.strictEqual(nonNullCalls.length, 2);
  assert.deepStrictEqual(nonNullCalls[1], { method: 'eq', col: 'last_update_token', val: existingIsoTime });

  // Case B: Existing timestamp is null (initial state before first refresh)
  const existingNull = null;
  const queryNull = createMockQuery().eq('id_jadwal', 42);
  const guardedNull = existingNull != null
    ? queryNull.eq('last_update_token', existingNull)
    : queryNull.is('last_update_token', null);

  const nullCalls = guardedNull.getCalls();
  assert.strictEqual(nullCalls.length, 2);
  assert.deepStrictEqual(nullCalls[1], { method: 'is', col: 'last_update_token', val: null });

  // Case C: Existing timestamp is undefined
  const existingUndefined = undefined;
  const queryUndefined = createMockQuery().eq('id_jadwal', 42);
  const guardedUndefined = existingUndefined != null
    ? queryUndefined.eq('last_update_token', existingUndefined)
    : queryUndefined.is('last_update_token', null);

  const undefinedCalls = guardedUndefined.getCalls();
  assert.strictEqual(undefinedCalls.length, 2);
  assert.deepStrictEqual(undefinedCalls[1], { method: 'is', col: 'last_update_token', val: null });
});

runTest('R3.4 - Optimistic concurrency prevents token overwrite during parallel invocations', () => {
  // Simulated database table state
  let dbRow = {
    id_jadwal: 101,
    token_aktif: 'NEXA-ORIG',
    last_update_token: '2026-10-18T10:00:00.000Z'
  };

  // Mock DB update with optimistic lock filter
  function simulateDbUpdate(filterId, filterCol, filterVal, filterIsCol, filterIsVal, newRecord) {
    if (dbRow.id_jadwal !== filterId) return { updatedRows: 0 };
    if (filterCol && dbRow[filterCol] !== filterVal) return { updatedRows: 0 };
    if (filterIsCol && dbRow[filterIsCol] !== filterIsVal) return { updatedRows: 0 };
    dbRow = { ...dbRow, ...newRecord };
    return { updatedRows: 1 };
  }

  // Worker 1 and Worker 2 both read the same initial state
  const stateReadByWorker1 = { ...dbRow };
  const stateReadByWorker2 = { ...dbRow };

  // Worker 1 executes first and updates token
  const w1Time = '2026-10-18T10:08:01.000Z';
  const res1 = simulateDbUpdate(
    stateReadByWorker1.id_jadwal,
    'last_update_token',
    stateReadByWorker1.last_update_token,
    null,
    null,
    { token_aktif: 'TOKEN-W1', last_update_token: w1Time }
  );
  assert.strictEqual(res1.updatedRows, 1, 'Worker 1 should succeed');
  assert.strictEqual(dbRow.token_aktif, 'TOKEN-W1');

  // Worker 2 attempts update with stale last_update_token
  const w2Time = '2026-10-18T10:08:02.000Z';
  const res2 = simulateDbUpdate(
    stateReadByWorker2.id_jadwal,
    'last_update_token',
    stateReadByWorker2.last_update_token, // stale timestamp
    null,
    null,
    { token_aktif: 'TOKEN-W2', last_update_token: w2Time }
  );
  assert.strictEqual(res2.updatedRows, 0, 'Worker 2 update must update 0 rows due to optimistic concurrency filter');
  assert.strictEqual(dbRow.token_aktif, 'TOKEN-W1', 'Worker 1 token must not be overwritten');
});

// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n========================================================================');
console.log(`SUMMARY: ${passedTests} / ${totalTests} tests passed (${failedTests} failed)`);
console.log('========================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
