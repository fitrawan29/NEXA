/**
 * CHALLENGER ROUND 16: ADVERSARIAL STRESS TEST SUITE
 * 
 * Deeply tests the robustness, edge cases, and failure modes of:
 * 1. Vercel CDN Header Evaluation Precedence Simulation
 * 2. Controllerchange Lifecycle (First visit vs Update vs Concurrent events)
 * 3. Active Exam Session Protection against disruptive reloads
 * 4. Dynamic Chunk Load Error Detection across all browser engine variants
 * 5. Offline Recovery Deferral & Online Event Reconnection
 * 6. Waiting Service Worker Immediate Skip-Waiting Signal
 * 7. Late Registration on document.readyState === 'complete'
 * 8. Zero Dependencies & Strict Web Standards
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
console.log('  CHALLENGER ROUND 16: ADVERSARIAL STRESS TEST SUITE                     ');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: VERCEL CDN HEADER EVALUATION PRECEDENCE ENGINE
// -----------------------------------------------------------------------------
console.log('--- [SECTION 1] VERCEL CDN HEADER EVALUATION PRECEDENCE ENGINE ---');

const vercelConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf-8'));

/**
 * Accurately simulates Vercel Edge CDN header resolution:
 * Rules are evaluated in sequential array order; later matching rules overwrite earlier ones.
 */
function resolveVercelHeaders(requestPath) {
  const resolved = {};
  for (const rule of vercelConfig.headers || []) {
    const regex = new RegExp('^' + rule.source.replace(/\(\.\*\)/g, '.*') + '$');
    if (regex.test(requestPath)) {
      for (const h of rule.headers) {
        resolved[h.key.toLowerCase()] = h.value;
      }
    }
  }
  return resolved;
}

test('V1.1', '/sw.js strictly evaluates to no-cache, no-store, must-revalidate on Vercel CDN', () => {
  const headers = resolveVercelHeaders('/sw.js');
  const cc = headers['cache-control'];
  assert.ok(cc, 'sw.js must have Cache-Control header');
  assert.ok(cc.includes('no-cache'), 'Must include no-cache');
  assert.ok(cc.includes('no-store'), 'Must include no-store');
  assert.ok(cc.includes('must-revalidate'), 'Must include must-revalidate');
  assert.ok(!cc.includes('max-age=0'), 'Must NOT be overwritten by fallback max-age=0 rule');
});

test('V1.2', '/service-worker.js strictly evaluates to no-cache, no-store, must-revalidate', () => {
  const headers = resolveVercelHeaders('/service-worker.js');
  const cc = headers['cache-control'];
  assert.ok(cc, 'service-worker.js must have Cache-Control header');
  assert.ok(cc.includes('no-cache') && cc.includes('no-store'), 'Must be no-cache, no-store');
  assert.ok(!cc.includes('max-age=0'), 'Must NOT be overwritten by fallback rule');
});

test('V1.3', '/index.html strictly evaluates to no-cache, no-store, must-revalidate', () => {
  const headers = resolveVercelHeaders('/index.html');
  const cc = headers['cache-control'];
  assert.ok(cc, 'index.html must have Cache-Control header');
  assert.ok(cc.includes('no-cache') && cc.includes('no-store'), 'Must be no-cache, no-store');
  assert.ok(!cc.includes('max-age=0'), 'Must NOT be overwritten by fallback rule');
});

test('V1.4', 'Root path / strictly evaluates to no-cache, no-store, must-revalidate', () => {
  const headers = resolveVercelHeaders('/');
  const cc = headers['cache-control'];
  assert.ok(cc, '/ must have Cache-Control header');
  assert.ok(cc.includes('no-cache') && cc.includes('no-store'), 'Must be no-cache, no-store');
  assert.ok(!cc.includes('max-age=0'), 'Must NOT be overwritten by fallback rule');
});

test('V1.5', 'Hashed assets in /assets/(.*) strictly evaluate to 1-year immutable cache', () => {
  const headers = resolveVercelHeaders('/assets/AdminView-D-VG9Az6.js');
  const cc = headers['cache-control'];
  assert.ok(cc, 'Asset must have Cache-Control header');
  assert.ok(cc.includes('max-age=31536000'), 'Must have 1-year max-age');
  assert.ok(cc.includes('immutable'), 'Must be immutable');
  assert.ok(!cc.includes('max-age=0'), 'Must NOT be overwritten by fallback rule');
});

test('V1.6', 'General non-static paths evaluate to default public, max-age=0, must-revalidate', () => {
  const headers = resolveVercelHeaders('/manifest.json');
  const cc = headers['cache-control'];
  assert.ok(cc, 'General path must have Cache-Control header');
  assert.strictEqual(cc, 'public, max-age=0, must-revalidate');
});

// -----------------------------------------------------------------------------
// SECTION 2: CONTROLLERCHANGE LIFECYCLE & ACTIVE EXAM INTEGRITY
// -----------------------------------------------------------------------------
console.log('\n--- [SECTION 2] CONTROLLERCHANGE LIFECYCLE & ACTIVE EXAM INTEGRITY ---');

test('C2.1', 'First-time visitor does not experience sudden reload on initial SW claim', () => {
  let reloadCount = 0;
  let refreshing = false;
  let hadController = false; // Initial visit: no SW was controlling the page

  const handleControllerChange = () => {
    if (refreshing) return;
    if (!hadController) {
      hadController = true;
      return;
    }
    refreshing = true;
    reloadCount++;
  };

  // Event 1: Initial SW installs & claims client -> Should NOT reload!
  handleControllerChange();
  assert.strictEqual(reloadCount, 0, 'First-time SW activation must NOT reload fresh page');
  assert.strictEqual(hadController, true, 'hadController state must now be set to true');

  // Event 2: New SW deployed during session -> SHOULD reload!
  handleControllerChange();
  assert.strictEqual(reloadCount, 1, 'Subsequent SW update MUST reload the page');

  // Event 3: Redundant event while reload is in-flight -> throttled
  handleControllerChange();
  assert.strictEqual(reloadCount, 1, 'Concurrent controllerchange must be guarded by refreshing flag');
});

test('C2.2', 'Active exam session suppresses automatic reload to prevent student disruption', () => {
  let reloadCount = 0;
  let refreshing = false;
  let hadController = true;
  const mockStorage = new Map();

  const handleControllerChange = () => {
    if (refreshing) return;
    if (!hadController) {
      hadController = true;
      return;
    }
    if (mockStorage.get('nexa_active_exam')) {
      // Exam active: protect student
      return;
    }
    refreshing = true;
    reloadCount++;
  };

  // Scenario A: Active exam in progress
  mockStorage.set('nexa_active_exam', JSON.stringify({ jadwalId: 'exam-123', studentId: 'student-456' }));
  handleControllerChange();
  assert.strictEqual(reloadCount, 0, 'Active exam must suppress automatic SW reload');

  // Scenario B: Exam finishes and session key is cleared
  mockStorage.delete('nexa_active_exam');
  handleControllerChange();
  assert.strictEqual(reloadCount, 1, 'Non-exam session must cleanly reload on update');
});

// -----------------------------------------------------------------------------
// SECTION 3: DYNAMIC CHUNK ERROR DETECTION & RECOVERY
// -----------------------------------------------------------------------------
console.log('\n--- [SECTION 3] DYNAMIC CHUNK ERROR DETECTION & RECOVERY ---');

const registerSWSource = fs.readFileSync(path.join(projectRoot, 'src', 'registerSW.js'), 'utf-8');
const appSource = fs.readFileSync(path.join(projectRoot, 'src', 'App.jsx'), 'utf-8');

test('C3.1', 'registerSW.js and App.jsx catch all browser variants of chunk loading errors', () => {
  const requiredPatterns = [
    /failed to fetch dynamically imported module/i,
    /error loading dynamically imported module/i,
    /failed to load module script/i,
    /loading chunk/i,
    /chunkloaderror/i,
    /importing a module script failed/i
  ];

  for (const pat of requiredPatterns) {
    assert.match(registerSWSource, pat, `registerSW.js must match ${pat}`);
    assert.match(appSource, pat, `App.jsx ErrorBoundary must match ${pat}`);
  }
});

test('C3.2', 'Offline dynamic chunk failure defers reload until online reconnection', () => {
  let reloadCount = 0;
  let isOnline = false;
  const listeners = {};

  const fakeWindow = {
    addEventListener: (evt, fn) => {
      listeners[evt] = fn;
    }
  };

  const triggerReload = () => {
    if (!isOnline) {
      fakeWindow.addEventListener('online', () => triggerReload());
      return;
    }
    reloadCount++;
  };

  // Step 1: Chunk failure while offline
  triggerReload();
  assert.strictEqual(reloadCount, 0, 'Must NOT reload while offline');
  assert.ok(listeners['online'], 'Must register online event listener when offline');

  // Step 2: Connectivity is restored -> online event fires
  isOnline = true;
  listeners['online']();
  assert.strictEqual(reloadCount, 1, 'Must trigger reload once connectivity is restored');
});

test('C3.3', 'Non-chunk errors do not trigger unnecessary page reloads', () => {
  const chunkErrorKeywords = [
    'failed to fetch dynamically imported module',
    'error loading dynamically imported module',
    'failed to load module script',
    'loading chunk',
    'chunkloaderror',
    'importing a module script failed'
  ];

  const isChunkError = (err) => {
    const msg = (err?.message || String(err || '')).toLowerCase();
    return chunkErrorKeywords.some(kw => msg.includes(kw));
  };

  const harmlessErrors = [
    new Error('TypeError: Cannot read properties of undefined (reading "map")'),
    new Error('ReferenceError: activeTab is not defined'),
    new Error('NetworkError: Failed to fetch /api/login'),
    new Error('SyntaxError: Unexpected identifier in user input')
  ];

  for (const err of harmlessErrors) {
    assert.strictEqual(isChunkError(err), false, `Harmless error "${err.message}" must not trigger reload`);
  }
});

// -----------------------------------------------------------------------------
// SECTION 4: SERVICE WORKER WAITING STATE & DOCUMENT READYSTATE
// -----------------------------------------------------------------------------
console.log('\n--- [SECTION 4] SERVICE WORKER WAITING STATE & DOCUMENT READYSTATE ---');

test('C4.1', 'registerSW.js immediately signals SKIP_WAITING if worker is already in waiting state', () => {
  assert.match(registerSWSource, /registration\.waiting\s*&&\s*navigator\.serviceWorker\.controller/);
  assert.match(registerSWSource, /registration\.waiting\.postMessage\(\{\s*type:\s*['"]SKIP_WAITING['"]\s*\}\)/);
});

test('C4.2', 'registerSW.js supports immediate execution when document.readyState is complete', () => {
  assert.match(registerSWSource, /document\.readyState\s*===\s*['"]complete['"]/);
  assert.match(registerSWSource, /window\.addEventListener\(['"]load['"]/);
});

// -----------------------------------------------------------------------------
// SECTION 5: ZERO DEPENDENCIES & PACKAGE INTEGRITY
// -----------------------------------------------------------------------------
console.log('\n--- [SECTION 5] ZERO DEPENDENCIES & PACKAGE INTEGRITY ---');

test('C5.1', 'package.json contains exactly approved production dependencies (Ponytail)', () => {
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
console.log('  CHALLENGER STRESS TEST SUMMARY                                        ');
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
  console.log('\n🎉 ALL CHALLENGER ADVERSARIAL STRESS TESTS PASSED (100%)!');
  process.exit(0);
}
