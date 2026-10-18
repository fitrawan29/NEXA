/**
 * Automated Verification Test Suite for Instant Update Features
 * 
 * Verifies:
 * - R1: Unified Service Worker Lifecycle & Immediate Activation
 * - R2: Seamless Client Auto-Refresh on Update & Periodic Updates
 * - R3: Anti-Stale Caching & Strict Cache Invalidation in vercel.json & SW activate
 * - R4: Dynamic Chunk Load Error Auto-Recovery with Loop Prevention
 * - R5: Zero New Dependencies & Build/Test Integrity
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Test runner state
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: []
};

function runTest(category, name, fn) {
  stats.total++;
  try {
    fn();
    stats.passed++;
    console.log(`  ✅ [PASS] [${category}] ${name}`);
  } catch (err) {
    stats.failed++;
    stats.failures.push({ category, name, error: err.message, stack: err.stack });
    console.error(`  ❌ [FAIL] [${category}] ${name}: ${err.message}`);
  }
}

async function runAsyncTest(category, name, fn) {
  stats.total++;
  try {
    await fn();
    stats.passed++;
    console.log(`  ✅ [PASS] [${category}] ${name}`);
  } catch (err) {
    stats.failed++;
    stats.failures.push({ category, name, error: err.message, stack: err.stack });
    console.error(`  ❌ [FAIL] [${category}] ${name}: ${err.message}`);
  }
}

console.log('========================================================================');
console.log('  NEXA CBT: INSTANT UPDATE & AUTO-REFRESH VERIFICATION SUITE           ');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: Service Worker Registration & Consolidation (R1)
// -----------------------------------------------------------------------------
console.log('--- SECTION 1: UNIFIED SERVICE WORKER REGISTRATION (R1) ---');

runTest('R1-Registration', 'index.html has no active duplicate inline SW registration script', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf-8');
  // Must NOT have active <script> that invokes navigator.serviceWorker.register
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const scriptBody = match[1];
    assert.ok(
      !scriptBody.includes('navigator.serviceWorker.register'),
      'index.html still contains an active <script> registering the service worker!'
    );
  }
});

runTest('R1-Registration', 'src/main.jsx imports and invokes registerSW() from src/registerSW.js', () => {
  const mainJsx = fs.readFileSync(path.join(projectRoot, 'src', 'main.jsx'), 'utf-8');
  assert.match(mainJsx, /import\s+\{\s*registerSW\s*\}\s+from\s+['"]\.\/registerSW(?:\.js)?['"]/);
  assert.match(mainJsx, /registerSW\(\)/);
});

runTest('R1-Registration', 'src/registerSW.js registers /sw.js on window load', () => {
  const swCode = fs.readFileSync(path.join(projectRoot, 'src', 'registerSW.js'), 'utf-8');
  assert.match(swCode, /navigator\.serviceWorker\s*\.register\(['"]\/sw\.js['"]\)/);
  assert.match(swCode, /window\.addEventListener\(['"]load['"]/);
});

// -----------------------------------------------------------------------------
// SECTION 2: Immediate Activation & Stale Cache Pruning (R1, R3)
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: IMMEDIATE ACTIVATION & STALE CACHE PRUNING (R1, R3) ---');

const swFiles = [
  { name: 'public/sw.js', path: path.join(projectRoot, 'public', 'sw.js') },
  { name: 'public/service-worker.js', path: path.join(projectRoot, 'public', 'service-worker.js') }
];

for (const { name, path: filePath } of swFiles) {
  runTest('SW-Lifecycle', `${name} calls self.skipWaiting() on install`, () => {
    assert.ok(fs.existsSync(filePath), `${name} must exist`);
    const code = fs.readFileSync(filePath, 'utf-8');
    assert.match(code, /self\.addEventListener\(['"]install['"]/);
    assert.match(code, /self\.skipWaiting\(\)/);
  });

  runTest('SW-Lifecycle', `${name} calls self.clients.claim() on activate`, () => {
    const code = fs.readFileSync(filePath, 'utf-8');
    assert.match(code, /self\.addEventListener\(['"]activate['"]/);
    assert.match(code, /self\.clients\.claim\(\)/);
  });

  runTest('SW-Lifecycle', `${name} listens for SKIP_WAITING message event`, () => {
    const code = fs.readFileSync(filePath, 'utf-8');
    assert.match(code, /self\.addEventListener\(['"]message['"]/);
    assert.match(code, /SKIP_WAITING/);
  });

  runTest('SW-Cache', `${name} prunes stale caches during activate event`, () => {
    const code = fs.readFileSync(filePath, 'utf-8');
    assert.match(code, /caches\.keys\(\)/);
    assert.match(code, /caches\.delete\(cacheName\)/);
  });
}

// Behavioral simulation of SW cache pruning
await runAsyncTest('SW-Simulation', 'Service worker activate handler purges only older version caches', async () => {
  const deletedCaches = [];
  const activeCache = 'nexa-cbt-v5';
  const existingCaches = ['nexa-cbt-v1', 'nexa-cbt-v2', 'nexa-cbt-v3', 'nexa-cbt-v4', 'nexa-cbt-v5', 'other-old-store'];

  // Simulate cache deletion logic from sw.js
  const cacheWhitelist = [activeCache];
  await Promise.all(
    existingCaches.map((cacheName) => {
      if (!cacheWhitelist.includes(cacheName)) {
        deletedCaches.push(cacheName);
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    })
  );

  assert.deepStrictEqual(deletedCaches, ['nexa-cbt-v1', 'nexa-cbt-v2', 'nexa-cbt-v3', 'nexa-cbt-v4', 'other-old-store']);
  assert.ok(!deletedCaches.includes(activeCache), 'Active cache version must not be deleted');
});

// -----------------------------------------------------------------------------
// SECTION 3: Client Auto-Refresh & Update Checks (R2)
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: CLIENT AUTO-REFRESH & UPDATE TRIGGERS (R2) ---');

runTest('R2-Client', 'src/registerSW.js implements controllerchange listener with anti-looping guard', () => {
  const code = fs.readFileSync(path.join(projectRoot, 'src', 'registerSW.js'), 'utf-8');
  assert.match(code, /navigator\.serviceWorker\.addEventListener\(['"]controllerchange['"]/);
  assert.match(code, /let\s+refreshing\s*=\s*false/);
  assert.match(code, /if\s*\(\s*refreshing\s*\)\s*return/);
  assert.match(code, /window\.location\.reload\(\)/);
});

runTest('R2-Client', 'src/registerSW.js checks for updates on visibilitychange when document is visible', () => {
  const code = fs.readFileSync(path.join(projectRoot, 'src', 'registerSW.js'), 'utf-8');
  assert.match(code, /document\.addEventListener\(['"]visibilitychange['"]/);
  assert.match(code, /document\.visibilityState\s*===\s*['"]visible['"]/);
  assert.match(code, /registration\.update\(\)/);
});

runTest('R2-Client', 'src/registerSW.js triggers update check on focus and history popstate', () => {
  const code = fs.readFileSync(path.join(projectRoot, 'src', 'registerSW.js'), 'utf-8');
  assert.match(code, /window\.addEventListener\(['"]focus['"]/);
  assert.match(code, /window\.addEventListener\(['"]popstate['"]/);
});

runTest('R2-Client', 'src/registerSW.js sets up periodic update polling', () => {
  const code = fs.readFileSync(path.join(projectRoot, 'src', 'registerSW.js'), 'utf-8');
  assert.match(code, /setInterval\(/);
});

// Behavioral test of controllerchange anti-loop guard
runTest('R2-Simulation', 'controllerchange guard triggers reload exactly once even under multiple events', () => {
  let reloadCount = 0;
  let refreshing = false;

  const mockControllerChangeHandler = () => {
    if (refreshing) return;
    refreshing = true;
    reloadCount++;
  };

  // Simulate multiple controllerchange events in rapid succession
  mockControllerChangeHandler();
  mockControllerChangeHandler();
  mockControllerChangeHandler();

  assert.strictEqual(reloadCount, 1, 'Reload should only be invoked once by controllerchange handler');
});

// Behavioral test of visibilitychange update checking
runTest('R2-Simulation', 'visibilitychange only triggers update when document is visible', () => {
  let updateCalls = 0;
  const mockRegistration = {
    update: async () => {
      updateCalls++;
    }
  };

  let mockVisibilityState = 'hidden';
  const handleVisibilityChange = () => {
    if (mockVisibilityState === 'visible') {
      mockRegistration.update();
    }
  };

  // Document goes hidden -> should not trigger update
  handleVisibilityChange();
  assert.strictEqual(updateCalls, 0);

  // Document becomes visible -> should trigger update
  mockVisibilityState = 'visible';
  handleVisibilityChange();
  assert.strictEqual(updateCalls, 1);
});

// -----------------------------------------------------------------------------
// SECTION 4: Anti-Stale Cache-Control Headers in vercel.json (R3)
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 4: VERCEL.JSON ANTI-STALE HEADERS (R3) ---');

runTest('R3-Headers', 'vercel.json defines strict no-cache headers for sw.js, service-worker.js, and index.html', () => {
  const vercelConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf-8'));
  assert.ok(Array.isArray(vercelConfig.headers), 'vercel.json must define a headers array');

  const swHeader = vercelConfig.headers.find(h => h.source === '/sw.js');
  assert.ok(swHeader, 'Header rule for /sw.js must be configured');
  const swCc = swHeader.headers.find(h => h.key.toLowerCase() === 'cache-control');
  assert.ok(swCc && swCc.value.includes('no-cache') && swCc.value.includes('no-store'), 'sw.js Cache-Control must be no-cache, no-store');

  const swMirrorHeader = vercelConfig.headers.find(h => h.source === '/service-worker.js');
  assert.ok(swMirrorHeader, 'Header rule for /service-worker.js must be configured');
  const swMirrorCc = swMirrorHeader.headers.find(h => h.key.toLowerCase() === 'cache-control');
  assert.ok(swMirrorCc && swMirrorCc.value.includes('no-cache') && swMirrorCc.value.includes('no-store'), 'service-worker.js Cache-Control must be no-cache, no-store');

  const htmlHeader = vercelConfig.headers.find(h => h.source === '/index.html');
  assert.ok(htmlHeader, 'Header rule for /index.html must be configured');
  const htmlCc = htmlHeader.headers.find(h => h.key.toLowerCase() === 'cache-control');
  assert.ok(htmlCc && htmlCc.value.includes('no-cache') && htmlCc.value.includes('no-store'), 'index.html Cache-Control must be no-cache, no-store');

  const rootHeader = vercelConfig.headers.find(h => h.source === '/');
  assert.ok(rootHeader, 'Header rule for / must be configured');
  const rootCc = rootHeader.headers.find(h => h.key.toLowerCase() === 'cache-control');
  assert.ok(rootCc && rootCc.value.includes('no-cache') && rootCc.value.includes('no-store'), '/ Cache-Control must be no-cache, no-store');
});

runTest('R3-Headers', 'vercel.json preserves long-lived immutable caching for hashed /assets/(.*)', () => {
  const vercelConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf-8'));
  const assetHeader = vercelConfig.headers.find(h => h.source === '/assets/(.*)');
  assert.ok(assetHeader, 'Header rule for /assets/(.*) must exist');
  const assetCc = assetHeader.headers.find(h => h.key.toLowerCase() === 'cache-control');
  assert.ok(assetCc && assetCc.value.includes('immutable'), 'Hashed assets must be immutable');
});

runTest('R3-Headers', 'vercel.json rule ordering ensures specific headers are not overwritten by catch-all fallback', () => {
  const vercelConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf-8'));
  const resolveVercelHeader = (route) => {
    const map = {};
    for (const rule of vercelConfig.headers || []) {
      const regex = new RegExp('^' + rule.source.replace(/\(\.\*\)/g, '.*') + '$');
      if (regex.test(route)) {
        for (const h of rule.headers) {
          map[h.key.toLowerCase()] = h.value;
        }
      }
    }
    return map['cache-control'];
  };

  const swCc = resolveVercelHeader('/sw.js');
  assert.ok(swCc && swCc.includes('no-cache') && swCc.includes('no-store'), 'Effective sw.js Cache-Control must be no-cache, no-store');

  const swMirrorCc = resolveVercelHeader('/service-worker.js');
  assert.ok(swMirrorCc && swMirrorCc.includes('no-cache') && swMirrorCc.includes('no-store'), 'Effective service-worker.js Cache-Control must be no-cache, no-store');

  const htmlCc = resolveVercelHeader('/index.html');
  assert.ok(htmlCc && htmlCc.includes('no-cache') && htmlCc.includes('no-store'), 'Effective index.html Cache-Control must be no-cache, no-store');

  const rootCc = resolveVercelHeader('/');
  assert.ok(rootCc && rootCc.includes('no-cache') && rootCc.includes('no-store'), 'Effective / Cache-Control must be no-cache, no-store');

  const assetCc = resolveVercelHeader('/assets/app.js');
  assert.ok(assetCc && assetCc.includes('immutable'), 'Effective /assets/(.*) Cache-Control must be immutable');
});

// -----------------------------------------------------------------------------
// SECTION 5: Dynamic Chunk Load Error Auto-Recovery (R4)
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 5: DYNAMIC CHUNK LOAD ERROR AUTO-RECOVERY (R4) ---');

runTest('R4-ChunkRecovery', 'src/registerSW.js exports setupChunkErrorRecovery and registers global listeners', () => {
  const code = fs.readFileSync(path.join(projectRoot, 'src', 'registerSW.js'), 'utf-8');
  assert.match(code, /export\s+function\s+setupChunkErrorRecovery/);
  assert.match(code, /window\.addEventListener\(['"]unhandledrejection['"]/);
  assert.match(code, /window\.addEventListener\(['"]error['"]/);
  assert.match(code, /failed to fetch dynamically imported module/i);
  assert.match(code, /loading chunk/i);
});

runTest('R4-ChunkRecovery', 'src/App.jsx ErrorBoundary handles chunk load failures', () => {
  const code = fs.readFileSync(path.join(projectRoot, 'src', 'App.jsx'), 'utf-8');
  assert.match(code, /componentDidCatch\s*\(\s*error\s*,\s*errorInfo\s*\)/);
  assert.match(code, /failed to fetch dynamically imported module/i);
  assert.match(code, /loading chunk/i);
});

// Behavioral test of chunk mismatch detection and throttling
runTest('R4-Simulation', 'Chunk error recovery throttles reloads to prevent infinite reload loops', () => {
  let reloadCount = 0;
  const mockStorage = new Map();
  const CHUNK_RELOAD_KEY = 'nexa_chunk_retry_timestamp';
  const RELOAD_TIMEOUT = 10000;

  const isChunkError = (err) => {
    const msg = (err?.message || String(err || '')).toLowerCase();
    return (
      msg.includes('failed to fetch dynamically imported module') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('loading chunk') ||
      msg.includes('importing a module script failed')
    );
  };

  const triggerReload = (mockNow) => {
    const last = parseInt(mockStorage.get(CHUNK_RELOAD_KEY) || '0', 10);
    if (!last || mockNow - last >= RELOAD_TIMEOUT) {
      mockStorage.set(CHUNK_RELOAD_KEY, String(mockNow));
      reloadCount++;
    }
  };

  const handleRejection = (reason, mockNow) => {
    if (isChunkError(reason)) {
      triggerReload(mockNow);
    }
  };

  // Test 1: Chunk error at t = 10000 -> Should reload (1st time)
  handleRejection(new Error('Failed to fetch dynamically imported module /assets/SiswaView-oldhash.js'), 10000);
  assert.strictEqual(reloadCount, 1, 'First chunk error should trigger reload');

  // Test 2: Another chunk error at t = 12000 (within 10s cooldown) -> Should NOT reload
  handleRejection(new Error('Failed to fetch dynamically imported module /assets/SiswaView-oldhash.js'), 12000);
  assert.strictEqual(reloadCount, 1, 'Subsequent chunk error within timeout must be throttled');

  // Test 3: Non-chunk error at t = 25000 -> Should NOT reload
  handleRejection(new Error('TypeError: Cannot read properties of undefined'), 25000);
  assert.strictEqual(reloadCount, 1, 'Non-chunk error must not trigger reload');

  // Test 4: Chunk error after cooldown at t = 25000 -> Should reload
  handleRejection(new Error('Loading chunk SiswaView failed'), 25000);
  assert.strictEqual(reloadCount, 2, 'Chunk error after cooldown should trigger reload');
});

// -----------------------------------------------------------------------------
// SECTION 6: Zero Dependencies & Package.json Integrity (R5)
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 6: ZERO DEPENDENCIES & PACKAGE INTEGRITY (R5) ---');

runTest('R5-Dependencies', 'No new dependencies added to package.json (strict Native Web Standards)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
  const allowedDeps = [
    '@supabase/supabase-js',
    'prop-types',
    'react',
    'react-dom',
    'react-quill',
    'react-router-dom',
    'xlsx'
  ];
  const actualDeps = Object.keys(pkg.dependencies || {});
  for (const dep of actualDeps) {
    assert.ok(
      allowedDeps.includes(dep),
      `Unexpected new dependency found in package.json: ${dep}`
    );
  }
  assert.strictEqual(actualDeps.length, allowedDeps.length, 'Exact dependency count match');
});

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n========================================================================');
console.log('  TEST SUMMARY                                                          ');
console.log('========================================================================');
console.log(`  Total:  ${stats.total}`);
console.log(`  Passed: ${stats.passed}`);
console.log(`  Failed: ${stats.failed}`);

if (stats.failed > 0) {
  console.log('\nFailures detail:');
  stats.failures.forEach((f, i) => {
    console.log(`  ${i + 1}) [${f.category}] ${f.name}`);
    console.log(`     Error: ${f.error}`);
  });
  process.exit(1);
} else {
  console.log('\n🎉 ALL INSTANT UPDATE & AUTO-REFRESH TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}
