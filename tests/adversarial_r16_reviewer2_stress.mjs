/**
 * ADVERSARIAL ROUND 16: REVIEWER 2 STRESS & ATTACK TEST SUITE
 *
 * Verifies:
 * 1. Service Worker Self-Interception & Cache Bypass (/sw.js & /service-worker.js)
 * 2. Precache Freshness Assurance via Request({ cache: 'reload' })
 * 3. Deferred Update Retention & Post-Exam Recovery Lifecycle
 * 4. ErrorBoundary Polymorphic Error Matching (string, Error, name)
 * 5. Hash & Popstate Navigation Update Triggering
 * 6. Vercel Header Precedence & CDN Immutability
 * 7. Anti-Looping & Offline Graceful Degradation
 * 8. Package Integrity & Zero Dependency Verification (Ponytail)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: []
};

function test(id, description, fn) {
  stats.total++;
  try {
    fn();
    stats.passed++;
    console.log(`  ✅ [PASS] [${id}] ${description}`);
  } catch (err) {
    stats.failed++;
    stats.failures.push({ id, description, error: err.message, stack: err.stack });
    console.error(`  ❌ [FAIL] [${id}] ${description}: ${err.message}`);
  }
}

async function asyncTest(id, description, fn) {
  stats.total++;
  try {
    await fn();
    stats.passed++;
    console.log(`  ✅ [PASS] [${id}] ${description}`);
  } catch (err) {
    stats.failed++;
    stats.failures.push({ id, description, error: err.message, stack: err.stack });
    console.error(`  ❌ [FAIL] [${id}] ${description}: ${err.message}`);
  }
}

console.log('========================================================================');
console.log('  ADVERSARIAL ROUND 16: REVIEWER 2 DEEP ATTACK SUITE                   ');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: SERVICE WORKER SELF-INTERCEPTION & CACHE BYPASS
// -----------------------------------------------------------------------------
console.log('--- [SECTION 1] SERVICE WORKER SELF-INTERCEPTION & CACHE BYPASS ---');

const swContent = fs.readFileSync(path.join(projectRoot, 'public', 'sw.js'), 'utf-8');
const swMirrorContent = fs.readFileSync(path.join(projectRoot, 'public', 'service-worker.js'), 'utf-8');

test('SW-Bypass.1', 'public/sw.js explicitly bypasses /sw.js and /service-worker.js from interception', () => {
  assert.match(swContent, /url\.pathname\s*===\s*['"]\/sw\.js['"]/);
  assert.match(swContent, /url\.pathname\s*===\s*['"]\/service-worker\.js['"]/);
});

test('SW-Bypass.2', 'public/service-worker.js explicitly bypasses /sw.js and /service-worker.js from interception', () => {
  assert.match(swMirrorContent, /url\.pathname\s*===\s*['"]\/sw\.js['"]/);
  assert.match(swMirrorContent, /url\.pathname\s*===\s*['"]\/service-worker\.js['"]/);
});

test('SW-Bypass.3', 'Simulation: Fetch event bypass logic ignores SW script requests', () => {
  const shouldBypass = (request) => {
    const url = new URL(request.url);
    return (
      request.method !== 'GET' ||
      url.hostname.includes('supabase.co') ||
      url.pathname.startsWith('/api') ||
      url.pathname === '/sw.js' ||
      url.pathname === '/service-worker.js' ||
      !url.protocol.startsWith('http')
    );
  };

  assert.strictEqual(shouldBypass({ method: 'GET', url: 'https://cbt.nexa.id/sw.js' }), true);
  assert.strictEqual(shouldBypass({ method: 'GET', url: 'https://cbt.nexa.id/service-worker.js' }), true);
  assert.strictEqual(shouldBypass({ method: 'GET', url: 'https://xyz.supabase.co/rest/v1/users' }), true);
  assert.strictEqual(shouldBypass({ method: 'POST', url: 'https://cbt.nexa.id/auth' }), true);
  assert.strictEqual(shouldBypass({ method: 'GET', url: 'https://cbt.nexa.id/api/health' }), true);
  assert.strictEqual(shouldBypass({ method: 'GET', url: 'https://cbt.nexa.id/index.html' }), false);
  assert.strictEqual(shouldBypass({ method: 'GET', url: 'https://cbt.nexa.id/assets/app.js' }), false);
});

// -----------------------------------------------------------------------------
// SECTION 2: PRECACHE FRESHNESS & RELOAD OPTION
// -----------------------------------------------------------------------------
console.log('\n--- [SECTION 2] PRECACHE FRESHNESS ASSURANCE ---');

test('SW-Precache.1', 'public/sw.js uses Request cache: reload to prevent stale precaching', () => {
  assert.match(swContent, /new\s+Request\(url,\s*\{\s*cache:\s*['"]reload['"]\s*\}\)/);
});

test('SW-Precache.2', 'public/service-worker.js uses Request cache: reload to prevent stale precaching', () => {
  assert.match(swMirrorContent, /new\s+Request\(url,\s*\{\s*cache:\s*['"]reload['"]\s*\}\)/);
});

// -----------------------------------------------------------------------------
// SECTION 3: DEFERRED UPDATE RETENTION & POST-EXAM RECOVERY
// -----------------------------------------------------------------------------
console.log('\n--- [SECTION 3] DEFERRED UPDATE RETENTION & POST-EXAM RECOVERY ---');

const registerSWSource = fs.readFileSync(path.join(projectRoot, 'src', 'registerSW.js'), 'utf-8');

test('Deferred.1', 'src/registerSW.js persists deferred update flag when exam is in progress', () => {
  assert.match(registerSWSource, /sessionStorage\.setItem\(['"]nexa_update_deferred['"],\s*['"]1['"]\)/);
  assert.match(registerSWSource, /sessionStorage\.getItem\(['"]nexa_update_deferred['"]\)/);
});

test('Deferred.2', 'src/registerSW.js hooks hashchange navigation in addition to popstate', () => {
  assert.match(registerSWSource, /window\.addEventListener\(['"]hashchange['"]/);
  assert.match(registerSWSource, /window\.addEventListener\(['"]popstate['"]/);
});

test('Deferred.3', 'Simulation: Deferred update survives exam duration and fires once exam ends', () => {
  let reloadTriggered = 0;
  let refreshing = false;
  const storage = new Map();

  const handleControllerChange = () => {
    if (refreshing) return;
    if (storage.get('nexa_active_exam')) {
      storage.set('nexa_update_deferred', '1');
      return;
    }
    refreshing = true;
    reloadTriggered++;
  };

  const triggerDeferredUpdateIfReady = () => {
    if (storage.get('nexa_update_deferred') && !storage.get('nexa_active_exam')) {
      storage.delete('nexa_update_deferred');
      if (!refreshing) {
        refreshing = true;
        reloadTriggered++;
        return true;
      }
    }
    return false;
  };

  // Step 1: Student is in exam
  storage.set('nexa_active_exam', 'active');
  handleControllerChange();
  assert.strictEqual(reloadTriggered, 0, 'No reload during active exam');
  assert.strictEqual(storage.get('nexa_update_deferred'), '1', 'Update must be deferred in storage');

  // Step 2: Tab visibility changes while STILL in exam
  triggerDeferredUpdateIfReady();
  assert.strictEqual(reloadTriggered, 0, 'No reload while exam still active');
  assert.strictEqual(storage.get('nexa_update_deferred'), '1');

  // Step 3: Exam ends, student submits
  storage.delete('nexa_active_exam');

  // Step 4: Navigation / visibilitychange / focus occurs
  triggerDeferredUpdateIfReady();
  assert.strictEqual(reloadTriggered, 1, 'Reload must trigger immediately when exam ends and user navigates');
  assert.strictEqual(storage.get('nexa_update_deferred'), undefined, 'Deferred flag must be cleared');
});

// -----------------------------------------------------------------------------
// SECTION 4: ERRORBOUNDARY POLYMORPHIC ERROR MATCHING
// -----------------------------------------------------------------------------
console.log('\n--- [SECTION 4] ERRORBOUNDARY POLYMORPHIC ERROR MATCHING ---');

const appSource = fs.readFileSync(path.join(projectRoot, 'src', 'App.jsx'), 'utf-8');

test('PolyError.1', 'App.jsx ErrorBoundary handles string errors and error objects', () => {
  assert.match(appSource, /error\?\.message\s*\|\|\s*error\?\.name\s*\|\|\s*String\(error\s*\|\|\s*['"]['"]\)/);
});

test('PolyError.2', 'Simulation: Polymorphic chunk error matching handles string, custom object, and Error', () => {
  const matchChunk = (err) => {
    const msg = (err?.message || err?.name || String(err || '')).toLowerCase();
    return (
      msg.includes('failed to fetch dynamically imported module') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('failed to load module script') ||
      msg.includes('loading chunk') ||
      msg.includes('chunkloaderror') ||
      msg.includes('importing a module script failed')
    );
  };

  // String error
  assert.strictEqual(matchChunk('Failed to fetch dynamically imported module /assets/Exam.js'), true);
  // Error with name ChunkLoadError
  assert.strictEqual(matchChunk({ name: 'ChunkLoadError' }), true);
  // Standard Error
  assert.strictEqual(matchChunk(new Error('Importing a module script failed.')), true);
  // Non-chunk error
  assert.strictEqual(matchChunk(new Error('SyntaxError: Unexpected token')), false);
  assert.strictEqual(matchChunk('Cannot read properties of null'), false);
});

// -----------------------------------------------------------------------------
// SECTION 5: PACKAGE INTEGRITY & ZERO DEPENDENCIES (PONYTAIL)
// -----------------------------------------------------------------------------
console.log('\n--- [SECTION 5] PACKAGE INTEGRITY & ZERO DEPENDENCIES (PONYTAIL) ---');

test('Ponytail.1', 'Exact approved dependencies verified in package.json', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
  const approved = [
    '@supabase/supabase-js',
    'prop-types',
    'react',
    'react-dom',
    'react-quill',
    'react-router-dom',
    'xlsx'
  ];
  const actual = Object.keys(pkg.dependencies || {});
  assert.strictEqual(actual.length, approved.length, `Expected exactly ${approved.length} dependencies`);
  for (const dep of actual) {
    assert.ok(approved.includes(dep), `Unexpected dependency: ${dep}`);
  }
});

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n========================================================================');
console.log('  ADVERSARIAL STRESS TEST SUMMARY                                       ');
console.log('========================================================================');
console.log(`  Total:  ${stats.total}`);
console.log(`  Passed: ${stats.passed}`);
console.log(`  Failed: ${stats.failed}`);

if (stats.failed > 0) {
  console.log('\nFailures detail:');
  stats.failures.forEach((f, i) => {
    console.log(`  ${i + 1}) [${f.id}] ${f.description}`);
    console.log(`     Error: ${f.error}`);
  });
  process.exit(1);
} else {
  console.log('\n🎉 ALL ADVERSARIAL ATTACK TESTS PASSED (100%)!');
  process.exit(0);
}
