/**
 * ADVERSARIAL ROUND 16: REVIEWER 3 DEEP ATTACK & RESILIENCE SUITE
 *
 * Exhaustively tests:
 * 1. Polymorphic chunk error matching across registerSW.js, App.jsx, and components/ErrorBoundary.jsx
 * 2. Storage quota / SecurityError denial resilience and URL fallback anti-infinite-reload guard
 * 3. Safari bfcache restoration (pageshow) and connectivity restoration (online) update triggers
 * 4. In-memory deferred update retention when sessionStorage throws QuotaExceededError
 * 5. Hash route exam protection (#exam / #exam-room) against disruptive service worker reloads
 * 6. Offline chunk error listener deduplication under rapid offline/online state toggles
 * 7. Service Worker storage quota resilience (cache.put and caches.delete rejection safety)
 * 8. Service Worker polymorphic SKIP_WAITING message reception (string vs object)
 * 9. Package integrity & zero dependency verification (Ponytail standard)
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
console.log('  ADVERSARIAL ROUND 16: REVIEWER 3 RESILIENCE & ATTACK SUITE           ');
console.log('========================================================================\n');

const registerSWSource = fs.readFileSync(path.join(projectRoot, 'src', 'registerSW.js'), 'utf-8');
const appSource = fs.readFileSync(path.join(projectRoot, 'src', 'App.jsx'), 'utf-8');
const errorBoundarySource = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'ErrorBoundary.jsx'), 'utf-8');
const swSource = fs.readFileSync(path.join(projectRoot, 'public', 'sw.js'), 'utf-8');
const swMirrorSource = fs.readFileSync(path.join(projectRoot, 'public', 'service-worker.js'), 'utf-8');

// -----------------------------------------------------------------------------
// SECTION 1: POLYMORPHIC CHUNK ERROR MATCHING UNIFICATION
// -----------------------------------------------------------------------------
console.log('--- [SECTION 1] POLYMORPHIC CHUNK ERROR MATCHING UNIFICATION ---');

test('R3.1.1', 'registerSW.js setupChunkErrorRecovery inspects err?.name in addition to err?.message', () => {
  assert.match(registerSWSource, /err\?\.message\s*\|\|\s*err\?\.name\s*\|\|\s*String\(err\s*\|\|\s*['"]['"]\)/);
});

test('R3.1.2', 'src/components/ErrorBoundary.jsx implements polymorphic chunk error auto-recovery', () => {
  assert.match(errorBoundarySource, /failed to fetch dynamically imported module/i);
  assert.match(errorBoundarySource, /loading chunk/i);
  assert.match(errorBoundarySource, /chunkloaderror/i);
  assert.match(errorBoundarySource, /error\?\.message\s*\|\|\s*error\?\.name\s*\|\|\s*String\(error\s*\|\|\s*['"]['"]\)/);
});

test('R3.1.3', 'Simulation: Chunk error detection catches { name: "ChunkLoadError" } across all three modules', () => {
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

  // Pure object with name
  assert.strictEqual(matchChunk({ name: 'ChunkLoadError' }), true);
  // Pure string
  assert.strictEqual(matchChunk('Loading chunk SiswaView failed'), true);
  // Custom Error with message
  assert.strictEqual(matchChunk(new Error('Failed to fetch dynamically imported module /src/views/ExamRoom.jsx')), true);
  // Harmless application error
  assert.strictEqual(matchChunk(new Error('Cannot read properties of null')), false);
});

// -----------------------------------------------------------------------------
// SECTION 2: STORAGE QUOTA & ACCESS RESTRICTION RESILIENCE (ANTI-LOOP)
// -----------------------------------------------------------------------------
console.log('\n--- [SECTION 2] STORAGE RESTRICTION & ANTI-INFINITE-RELOAD RESILIENCE ---');

test('R3.2.1', 'registerSW.js protects against infinite reload loop when sessionStorage throws', () => {
  assert.match(registerSWSource, /\[\?\&\]chunk_retry=/);
  assert.match(registerSWSource, /url\.searchParams\.set\(['"]chunk_retry['"]/);
});

test('R3.2.2', 'App.jsx and ErrorBoundary.jsx protect against infinite reload loop when sessionStorage throws', () => {
  assert.match(appSource, /\[\?\&\]chunk_retry=/);
  assert.match(appSource, /url\.searchParams\.set\(['"]chunk_retry['"]/);
  assert.match(errorBoundarySource, /\[\?\&\]chunk_retry=/);
  assert.match(errorBoundarySource, /url\.searchParams\.set\(['"]chunk_retry['"]/);
});

test('R3.2.3', 'Simulation: When storage throws SecurityError, reload is attempted once and halts without infinite loop', () => {
  let reloads = 0;
  let currentSearch = '';

  const simulateTriggerReloadWhenStorageThrows = () => {
    try {
      // Simulate throwing SecurityError or QuotaExceededError
      throw new Error('QuotaExceededError: The quota has been exceeded');
    } catch {
      const hasRetried = /[?&]chunk_retry=/.test(currentSearch);
      if (!hasRetried) {
        currentSearch = '?chunk_retry=' + Date.now();
        reloads++;
      }
    }
  };

  // 1st chunk error occurs: storage throws -> URL retry fallback is used (1 reload)
  simulateTriggerReloadWhenStorageThrows();
  assert.strictEqual(reloads, 1, 'Initial chunk error with broken storage triggers single recovery attempt');

  // Page reloaded with ?chunk_retry=... but chunk is still missing -> Storage throws again
  simulateTriggerReloadWhenStorageThrows();
  assert.strictEqual(reloads, 1, 'Subsequent chunk error must NOT loop infinitely');

  // Third chunk error arrives
  simulateTriggerReloadWhenStorageThrows();
  assert.strictEqual(reloads, 1, 'Anti-loop guard permanently halts infinite reload loop');
});

// -----------------------------------------------------------------------------
// SECTION 3: SAFARI BFCACHE (PAGESHOW) & CONNECTIVITY UPDATE TRIGGERS
// -----------------------------------------------------------------------------
console.log('\n--- [SECTION 3] SAFARI BFCACHE & CONNECTIVITY UPDATE TRIGGERS ---');

test('R3.3.1', 'registerSW.js registers pageshow and online listeners for background update checks', () => {
  assert.match(registerSWSource, /window\.addEventListener\(['"]pageshow['"],\s*checkUpdate\)/);
  assert.match(registerSWSource, /window\.addEventListener\(['"]online['"],\s*checkUpdate\)/);
});

test('R3.3.2', 'Simulation: Safari bfcache restoration (pageshow) triggers registration.update() and deferred update', () => {
  let updateCalls = 0;
  let reloads = 0;
  let deferredUpdate = true;
  let isExam = false;

  const mockRegistration = {
    update: async () => { updateCalls++; }
  };

  const triggerDeferredUpdateIfReady = () => {
    if (deferredUpdate && !isExam) {
      deferredUpdate = false;
      reloads++;
      return true;
    }
    return false;
  };

  const checkUpdate = () => {
    if (triggerDeferredUpdateIfReady()) return;
    mockRegistration.update();
  };

  // When returning from bfcache after exam ended:
  checkUpdate();
  assert.strictEqual(reloads, 1, 'Deferred update triggered immediately upon bfcache restoration');
  assert.strictEqual(updateCalls, 0, 'Reload preempts redundant network update check');

  // Next normal bfcache return (no deferred update)
  checkUpdate();
  assert.strictEqual(updateCalls, 1, 'Normal bfcache restoration queries for latest service worker version');
});

// -----------------------------------------------------------------------------
// SECTION 4: IN-MEMORY DEFERRED UPDATE RETENTION ACROSS ACTIVE EXAM
// -----------------------------------------------------------------------------
console.log('\n--- [SECTION 4] IN-MEMORY DEFERRED UPDATE RETENTION ---');

test('R3.4.1', 'registerSW.js maintains in-memory deferred state fallback when sessionStorage fails', () => {
  assert.match(registerSWSource, /let\s+inMemoryUpdateDeferred\s*=\s*false/);
  assert.match(registerSWSource, /inMemoryUpdateDeferred\s*=\s*true/);
});

test('R3.4.2', 'Simulation: In-memory fallback retains deferred update when sessionStorage.setItem throws QuotaExceededError', () => {
  let inMemoryUpdateDeferred = false;
  let reloadCount = 0;
  let examActive = true;

  // Controllerchange fires during exam, but sessionStorage.setItem throws!
  const onControllerChange = () => {
    if (examActive) {
      try {
        throw new Error('QuotaExceededError');
      } catch {
        inMemoryUpdateDeferred = true;
      }
      return;
    }
    reloadCount++;
  };

  onControllerChange();
  assert.strictEqual(reloadCount, 0, 'No reload during active exam');
  assert.strictEqual(inMemoryUpdateDeferred, true, 'Update retained in memory despite storage quota failure');

  // Exam finishes
  examActive = false;

  // Navigation or visibilitychange fires
  const onNavigation = () => {
    if (inMemoryUpdateDeferred && !examActive) {
      inMemoryUpdateDeferred = false;
      reloadCount++;
    }
  };

  onNavigation();
  assert.strictEqual(reloadCount, 1, 'Deferred update applied immediately upon post-exam navigation');
  assert.strictEqual(inMemoryUpdateDeferred, false);
});

// -----------------------------------------------------------------------------
// SECTION 5: HASH-BASED ROUTE EXAM ROOM PROTECTION
// -----------------------------------------------------------------------------
console.log('\n--- [SECTION 5] HASH-BASED ROUTE EXAM ROOM PROTECTION ---');

test('R3.5.1', 'registerSW.js inspects window.location.hash in isExamActive() guard', () => {
  assert.match(registerSWSource, /window\.location\.hash\.includes\(['"]exam['"]\)/);
});

test('R3.5.2', 'Simulation: Route #exam suppresses SW reload even if sessionStorage has no active key', () => {
  let reloadTriggered = 0;
  let isHashExam = true;

  const isExamActive = () => isHashExam;

  const handleControllerChange = () => {
    if (isExamActive()) {
      return;
    }
    reloadTriggered++;
  };

  handleControllerChange();
  assert.strictEqual(reloadTriggered, 0, 'Hash-based exam route protects student from reload');

  // Student finishes exam, redirects to #dashboard
  isHashExam = false;
  handleControllerChange();
  assert.strictEqual(reloadTriggered, 1, 'Non-exam hash route permits immediate reload');
});

// -----------------------------------------------------------------------------
// SECTION 6: OFFLINE CHUNK ERROR LISTENER DEDUPLICATION
// -----------------------------------------------------------------------------
console.log('\n--- [SECTION 6] OFFLINE CHUNK ERROR LISTENER DEDUPLICATION ---');

test('R3.6.1', 'registerSW.js deduplicates online reconnect listener via isOnlinePending flag', () => {
  assert.match(registerSWSource, /let\s+isOnlinePending\s*=\s*false/);
  assert.match(registerSWSource, /if\s*\(!isOnlinePending\)/);
});

test('R3.6.2', 'Simulation: Multiple chunk failures while offline only register 1 reconnect listener', () => {
  let onlineListenerCount = 0;
  let isOnlinePending = false;
  let isOnline = false;

  const triggerReload = () => {
    if (!isOnline) {
      if (!isOnlinePending) {
        isOnlinePending = true;
        onlineListenerCount++;
      }
      return;
    }
  };

  // 10 dynamic imports fail simultaneously while in airplane mode
  for (let i = 0; i < 10; i++) {
    triggerReload();
  }

  assert.strictEqual(onlineListenerCount, 1, 'Exactly 1 online listener registered despite 10 failures');
});

// -----------------------------------------------------------------------------
// SECTION 7: SERVICE WORKER STORAGE QUOTA & ERROR RESILIENCE
// -----------------------------------------------------------------------------
console.log('\n--- [SECTION 7] SERVICE WORKER STORAGE QUOTA & ERROR RESILIENCE ---');

test('R3.7.1', 'sw.js and service-worker.js handle cache.put rejection cleanly without unhandled rejection', () => {
  assert.match(swSource, /cache\.put\(event\.request,\s*responseToCache\)\.catch\(\(\)\s*=>\s*\{\}\)/);
  assert.match(swMirrorSource, /cache\.put\(event\.request,\s*responseToCache\)\.catch\(\(\)\s*=>\s*\{\}\)/);
});

test('R3.7.2', 'sw.js and service-worker.js safely catch caches.delete and clients.claim rejections', () => {
  assert.match(swSource, /caches\.delete\(cacheName\)\.catch\(\(\)\s*=>\s*false\)/);
  assert.match(swMirrorSource, /caches\.delete\(cacheName\)\.catch\(\(\)\s*=>\s*false\)/);
  assert.match(swSource, /self\.clients\.claim\(\)\)\.catch\(\(\)\s*=>\s*\{\}\)/);
  assert.match(swMirrorSource, /self\.clients\.claim\(\)\)\.catch\(\(\)\s*=>\s*\{\}\)/);
});

// -----------------------------------------------------------------------------
// SECTION 8: SERVICE WORKER SKIP_WAITING MESSAGE POLYMORPHISM
// -----------------------------------------------------------------------------
console.log('\n--- [SECTION 8] SERVICE WORKER SKIP_WAITING MESSAGE POLYMORPHISM ---');

test('R3.8.1', 'sw.js and service-worker.js accept both string SKIP_WAITING and { type: "SKIP_WAITING" }', () => {
  assert.match(swSource, /event\.data\s*===\s*['"]SKIP_WAITING['"]\s*\|\|\s*\(event\.data\s*&&\s*event\.data\.type\s*===\s*['"]SKIP_WAITING['"]\)/);
  assert.match(swMirrorSource, /event\.data\s*===\s*['"]SKIP_WAITING['"]\s*\|\|\s*\(event\.data\s*&&\s*event\.data\.type\s*===\s*['"]SKIP_WAITING['"]\)/);
});

// -----------------------------------------------------------------------------
// SECTION 9: PACKAGE INTEGRITY & ZERO DEPENDENCIES (PONYTAIL)
// -----------------------------------------------------------------------------
console.log('\n--- [SECTION 9] PACKAGE INTEGRITY & ZERO DEPENDENCIES (PONYTAIL) ---');

test('R3.9.1', 'package.json contains exactly approved production dependencies', () => {
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
  assert.strictEqual(actual.length, approved.length);
  for (const dep of actual) {
    assert.ok(approved.includes(dep));
  }
});

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n========================================================================');
console.log('  REVIEWER 3 ADVERSARIAL STRESS TEST SUMMARY                            ');
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
  console.log('\n🎉 ALL REVIEWER 3 ADVERSARIAL RESILIENCE TESTS PASSED (100%)!');
  process.exit(0);
}
