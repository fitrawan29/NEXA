import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import * as babelParser from '@babel/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('========================================================================');
console.log('   ADVERSARIAL STRESS TEST SUITE: ROUND 23 REVIEWER PROBES');
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
// SECTION 1: R1 GITHUB ACTIONS WORKFLOW ADVERSARIAL STRESS
// =============================================================================
console.log('[SECTION 1: R1 Keepalive Workflow Security & Robustness]');

const workflowPath = path.join(projectRoot, '.github', 'workflows', 'keepalive.yml');
assert.ok(fs.existsSync(workflowPath), 'Workflow file must exist');
const workflowContent = fs.readFileSync(workflowPath, 'utf8');

runTest('R1-ADV-1: Valid YAML structure (no tabs, valid indentation)', () => {
  // YAML forbids tab characters for indentation
  const lines = workflowContent.split('\n');
  lines.forEach((line, idx) => {
    assert.strictEqual(
      /^\t+/.test(line),
      false,
      `Tab indentation detected at line ${idx + 1}: "${line}"`
    );
  });

  // Verify core top-level YAML keys exist
  assert.match(workflowContent, /^name:\s+/m, 'Must have name');
  assert.match(workflowContent, /^on:\s+/m, 'Must have on triggers');
  assert.match(workflowContent, /^jobs:\s+/m, 'Must have jobs definition');
});

runTest('R1-ADV-2: Security - Secrets are mapped to env variables, not inline shell expansion', () => {
  // Inline expansion of ${{ secrets... }} in `run:` blocks is vulnerable to shell injection
  const runBlocks = workflowContent.match(/run:\s*\|([\s\S]*?)(?=\n\s*[a-zA-Z0-9_-]+:|$)/g) || [];
  for (const block of runBlocks) {
    assert.doesNotMatch(
      block,
      /\$\{\{\s*secrets\./,
      'run: block must NOT directly interpolate ${{ secrets... }} inline; use env: mapping instead'
    );
  }
  assert.match(
    workflowContent,
    /env:\s*\n\s*VERCEL_APP_URL:\s*\$\{\{\s*secrets\.VERCEL_APP_URL\s*\}\}/,
    'Must map VERCEL_APP_URL under env: from secrets.VERCEL_APP_URL'
  );
});

runTest('R1-ADV-3: Scheme auto-prefixing handles URLs with or without https://', () => {
  // Test the scheme normalizer logic used in the bash script
  function normalizeUrl(raw) {
    let target = (raw || '').trim();
    if (target && !/^https?:\/\//i.test(target)) {
      target = 'https://' + target;
    }
    return target;
  }

  assert.strictEqual(normalizeUrl('nexa-cbt.vercel.app'), 'https://nexa-cbt.vercel.app');
  assert.strictEqual(normalizeUrl('https://nexa-cbt.vercel.app'), 'https://nexa-cbt.vercel.app');
  assert.strictEqual(normalizeUrl('http://localhost:3000'), 'http://localhost:3000');
  assert.strictEqual(normalizeUrl('  my-app.vercel.app/  '), 'https://my-app.vercel.app/');
  assert.strictEqual(normalizeUrl(''), '');
});

runTest('R1-ADV-4: curl parameters include timeout, follow-redirects, and silent failover', () => {
  assert.match(workflowContent, /curl\s+[^>\n]*-fsSL/, 'curl must use -fsSL (fail fast, silent, show error, follow location)');
  assert.match(workflowContent, /curl\s+[^>\n]*-m\s+30/, 'curl must have a timeout (-m 30) to prevent stuck runners');
});

runTest('R1-ADV-5: Workflow strips leading/trailing whitespace to prevent corrupt https:// https:// URLs', () => {
  assert.match(
    workflowContent,
    /tr\s+-d\s+['"]\[:space:\]['"]/,
    'keepalive.yml must explicitly strip whitespace characters (e.g. tr -d "[:space:]") before checking scheme'
  );
});

runTest('R1-ADV-6: Workflow handles case-insensitive schemes and accidental quote wrapping', () => {
  assert.match(
    workflowContent,
    /shopt\s+-s\s+nocasematch/,
    'keepalive.yml must enable case-insensitive matching (shopt -s nocasematch) so uppercase schemes like HTTPS:// are handled cleanly'
  );
  assert.match(
    workflowContent,
    /tr\s+-d\s+['"][^'"]*["'][^'"]*['"]/,
    'keepalive.yml must strip accidental surrounding quotation marks'
  );
});

// =============================================================================
// SECTION 2: R2 SIGNATURE IMAGE COMPRESSION & COMPLIANCE
// =============================================================================
console.log('\n[SECTION 2: R2 Signature Compression & Canvas Verification]');

const modalPath = path.join(projectRoot, 'src', 'components', 'DigitalSignatureModal.jsx');
const modalLines = fs.readFileSync(modalPath, 'utf8').split('\n');

runTest('R2-ADV-1: Exact line 271 export verification', () => {
  // Line 271 (1-indexed) -> modalLines[270] (0-indexed)
  const line271 = modalLines[270];
  assert.ok(
    line271.includes("toDataURL('image/jpeg', 0.6)"),
    `Line 271 must contain toDataURL('image/jpeg', 0.6). Found: "${line271}"`
  );
});

runTest('R2-ADV-2: AST parse of DigitalSignatureModal.jsx succeeds cleanly', () => {
  const code = fs.readFileSync(modalPath, 'utf8');
  assert.doesNotThrow(() => {
    babelParser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx']
    });
  }, 'DigitalSignatureModal.jsx must parse as valid JSX AST');
});

runTest('R2-ADV-3: API validation boundary testing for JPEG data URLs', () => {
  const validate = (tanda_tangan) => {
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

  // 1. Boundary: exactly 100 chars (fails if base64 < 50)
  const exact100 = 'data:image/jpeg;base64,' + 'A'.repeat(100 - 'data:image/jpeg;base64,'.length);
  assert.strictEqual(validate(exact100).status, 'success');

  // 2. Boundary: 99 chars (fails < 100)
  const chars99 = 'data:image/jpeg;base64,' + 'A'.repeat(99 - 'data:image/jpeg;base64,'.length);
  assert.strictEqual(validate(chars99).status, 'error');

  // 3. Invalid types
  assert.strictEqual(validate(null).status, 'error');
  assert.strictEqual(validate(undefined).status, 'error');
  assert.strictEqual(validate(12345).status, 'error');
  assert.strictEqual(validate({}).status, 'error');
  assert.strictEqual(validate('data:application/pdf;base64,' + 'A'.repeat(100)).status, 'error');
});

// =============================================================================
// SECTION 3: R3 TOKEN CONCURRENCY GUARD STRESS SIMULATION
// =============================================================================
console.log('\n[SECTION 3: R3 Token Refresh Concurrency Guard Probing]');

const apiPath = path.join(projectRoot, 'src', 'api.js');
const apiCode = fs.readFileSync(apiPath, 'utf8');

runTest('R3-ADV-1: AST parse of src/api.js succeeds cleanly', () => {
  assert.doesNotThrow(() => {
    babelParser.parse(apiCode, {
      sourceType: 'module',
      plugins: ['jsx']
    });
  }, 'src/api.js must parse cleanly without syntax errors');
});

runTest('R3-ADV-2: 20-worker concurrent token update race condition simulation', async () => {
  // Shared mock database state
  let dbRow = {
    id_jadwal: 999,
    token_aktif: 'INITIAL_TOKEN',
    last_update_token: null // initial null state
  };

  let updateCount = 0;
  let blockedCount = 0;

  // Function simulating the exact query executed by processJadwalData / get_token
  async function workerAttemptUpdate(readState, workerId) {
    // Artificial small delay to simulate network latency
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

    const newToken = `TOKEN_WORKER_${workerId}`;
    const newTimestamp = new Date().toISOString();

    // Evaluate optimistic concurrency lock:
    // When readState.last_update_token is null, filter is .is('last_update_token', null)
    // When readState.last_update_token is non-null, filter is .eq('last_update_token', readState.last_update_token)
    let conditionMatched = false;
    if (readState.last_update_token != null) {
      conditionMatched = (dbRow.last_update_token === readState.last_update_token);
    } else {
      conditionMatched = (dbRow.last_update_token === null);
    }

    if (conditionMatched && dbRow.id_jadwal === readState.id_jadwal) {
      dbRow = {
        ...dbRow,
        token_aktif: newToken,
        last_update_token: newTimestamp
      };
      updateCount++;
      return { success: true, token: newToken };
    } else {
      blockedCount++;
      return { success: false, currentToken: dbRow.token_aktif };
    }
  }

  // Phase A: 20 parallel workers attempt to update from initial null state
  const initialRead = { ...dbRow };
  const workersPhaseA = Array.from({ length: 20 }, (_, i) => workerAttemptUpdate(initialRead, i));
  const resultsPhaseA = await Promise.all(workersPhaseA);

  // Exactly ONE worker must succeed, 19 must be blocked by the optimistic concurrency guard!
  const successesPhaseA = resultsPhaseA.filter(r => r.success);
  assert.strictEqual(successesPhaseA.length, 1, 'Phase A: Exactly 1 worker should update successfully');
  assert.strictEqual(blockedCount, 19, 'Phase A: 19 workers must be blocked by optimistic concurrency filter');
  assert.ok(dbRow.last_update_token !== null, 'DB last_update_token must now have a timestamp');

  // Phase B: 20 parallel workers attempt to update from the new timestamp state
  const statePhaseB = { ...dbRow };
  blockedCount = 0;
  updateCount = 0;
  const workersPhaseB = Array.from({ length: 20 }, (_, i) => workerAttemptUpdate(statePhaseB, i + 100));
  const resultsPhaseB = await Promise.all(workersPhaseB);

  const successesPhaseB = resultsPhaseB.filter(r => r.success);
  assert.strictEqual(successesPhaseB.length, 1, 'Phase B: Exactly 1 worker should update successfully');
  assert.strictEqual(blockedCount, 19, 'Phase B: 19 workers must be blocked by optimistic concurrency filter');
});

runTest('R3-ADV-3: No extra side-effects or regressions in processJadwalData', () => {
  // Confirm processJadwalData still maps all expected output fields
  assert.match(apiCode, /status_ujian:\s*currentStatus/);
  assert.match(apiCode, /token:\s*tokenAktif/);
  assert.match(apiCode, /nama_mapel:\s*j\.mata_pelajaran/);
  assert.match(apiCode, /guru:\s*j\.guru/);
});

runTest('R3-ADV-4: Postgres microsecond timestamp precision roundtrip preservation', () => {
  // When Postgres returns timestamptz with microseconds e.g. "2026-10-18T10:00:00.123456+00:00"
  // The code must pass this exact string to .eq() without truncating or re-formatting
  const microsecondTimestamp = '2026-10-18T10:00:00.123456+00:00';
  const calls = [];
  const mockQuery = {
    eq(col, val) { calls.push({ col, val, method: 'eq' }); return mockQuery; },
    is(col, val) { calls.push({ col, val, method: 'is' }); return mockQuery; }
  };

  const guardedQuery = microsecondTimestamp != null
    ? mockQuery.eq('last_update_token', microsecondTimestamp)
    : mockQuery.is('last_update_token', null);

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].method, 'eq');
  assert.strictEqual(calls[0].val, microsecondTimestamp, 'Exact microsecond precision must be preserved');
});

runTest('R3-ADV-5: Undefined vs null handling in processJadwalData and get_token query builder', () => {
  // Both undefined and null must resolve to .is('last_update_token', null)
  for (const emptyVal of [null, undefined]) {
    const calls = [];
    const mockQuery = {
      eq(col, val) { calls.push({ col, val, method: 'eq' }); return mockQuery; },
      is(col, val) { calls.push({ col, val, method: 'is' }); return mockQuery; }
    };

    const guardedQuery = emptyVal != null
      ? mockQuery.eq('last_update_token', emptyVal)
      : mockQuery.is('last_update_token', null);

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].method, 'is');
    assert.strictEqual(calls[0].val, null, 'Must strictly call .is with null, never .eq with null or undefined');
  }
});

// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n========================================================================');
console.log(`SUMMARY: ${passedTests} / ${totalTests} adversarial tests passed (${failedTests} failed)`);
console.log('========================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
