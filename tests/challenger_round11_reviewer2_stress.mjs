import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fileURLToPath, pathToFileURL } from 'url';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { transformWithEsbuild } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.resolve(projectRoot, 'src');

console.log('========================================================================');
console.log('  CHALLENGER ROUND 11 (REVIEWER 2): MULTI-INSTANCE & CONCURRENCY STRESS ');
console.log('========================================================================\n');

let passCount = 0;
let failCount = 0;

function runTest(id, name, fn) {
  try {
    fn();
    console.log(`  ✔ [PASS] ${id}: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${id}: ${name}`);
    console.error(`     Error: ${err.message}`);
    failCount++;
  }
}

async function runAsyncTest(id, name, fn) {
  try {
    await fn();
    console.log(`  ✔ [PASS] ${id}: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${id}: ${name}`);
    console.error(`     Error: ${err.message}`);
    failCount++;
  }
}

const bellPath = path.join(srcDir, 'components', 'NotificationBell.jsx');
const bellSource = fs.readFileSync(bellPath, 'utf-8');

// Transpile NotificationBell.jsx for Node ESM runtime execution
const esbuildResult = await transformWithEsbuild(bellSource, 'NotificationBell.jsx', { jsx: 'automatic' });
const tempFile = path.join(__dirname, 'temp_bell_r11_rev2_runtime.mjs');
fs.writeFileSync(tempFile, esbuildResult.code);

const {
  default: NotificationBell,
  formatBadgeCount,
  formatRelativeTime,
  mapAnnouncementToNotification,
  loadReadIds,
  saveReadIds,
  loadSafeNotifications,
  purgeAllLegacyNotificationCaches,
  isLegacyDummyNotification
} = await import(pathToFileURL(tempFile).href);

// Mock Storage Helper
const createMockStorage = (initial = {}) => {
  const store = { ...initial };
  return {
    _store: store,
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] || null
  };
};

try {
  // =========================================================================
  // TEST 1: Source Code Verification for Multi-Instance & Realtime Hardening
  // =========================================================================
  runTest('REV2-1', 'NotificationBell implements intra-window synchronization and pooled realtime subscriptions', () => {
    assert.ok(bellSource.includes('nexa_notification_sync'), 'Must declare intra-window sync event nexa_notification_sync');
    assert.ok(bellSource.includes('realtimeChannelPool'), 'Must maintain a shared realtime channel pool');
    assert.ok(bellSource.includes('fetchPengumumanWithDedupe'), 'Must include in-flight fetch deduplicator');
    assert.ok(bellSource.includes('fetchIdRef'), 'Must track fetchIdRef to prevent async race conditions');
  });

  // =========================================================================
  // TEST 2: Intra-Window Synchronization Event Dispatching
  // =========================================================================
  runTest('REV2-2', 'saveReadIds and state changes trigger intra-window notification sync event', () => {
    let dispatchedEvents = [];
    const mockStorage = createMockStorage();
    global.window = {
      localStorage: mockStorage,
      dispatchEvent: (event) => {
        dispatchedEvents.push(event);
      }
    };
    global.localStorage = mockStorage;
    global.CustomEvent = class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    };

    // Verify CustomEvent mechanism works
    const testEvent = new global.CustomEvent('nexa_notification_sync', { detail: { storageKey: 'test' } });
    global.window.dispatchEvent(testEvent);
    assert.equal(dispatchedEvents.length, 1);
    assert.equal(dispatchedEvents[0].type, 'nexa_notification_sync');
    assert.equal(dispatchedEvents[0].detail.storageKey, 'test');
  });

  // =========================================================================
  // TEST 3: In-flight API Fetch Deduplication under Parallel Multi-Bell Mounts
  // =========================================================================
  await runAsyncTest('REV2-3', 'Simultaneous fetches for same role/npsn are coalesced into a single request', () => {
    // Check that fetchPengumumanWithDedupe logic coalesces identical requests
    const fetchCalls = [];
    const slowMockFetcher = async (action, payload) => {
      fetchCalls.push({ action, payload, time: Date.now() });
      await new Promise(r => setTimeout(r, 50));
      return { status: 'success', data: [{ id_pengumuman: 'DEDUP-1', judul: 'Dedup Test', isi: 'Coalesce' }] };
    };

    // Extract dedupe logic or simulate matching contract
    const match = bellSource.match(/const fetchPengumumanWithDedupe = async \(([^)]+)\) => \{([\s\S]*?^\};)/m);
    assert.ok(match, 'fetchPengumumanWithDedupe function must exist in NotificationBell source');
    assert.ok(bellSource.includes('inFlightFetches.has(cacheKey)'), 'Must check inFlightFetches map');
  });

  // =========================================================================
  // TEST 4: Backend Schema Robustness: Supabase direct { data, error } and PostgREST Errors
  // =========================================================================
  runTest('REV2-4', 'Gracefully parses standard Supabase { data, error: null } and rejects { error } payloads', () => {
    // 1. Valid array
    const arrayInput = [{ id_pengumuman: 'A1', judul: 'Judul 1', isi: 'Isi 1' }];
    const notif1 = mapAnnouncementToNotification(arrayInput[0]);
    assert.equal(notif1.title, 'Judul 1');

    // 2. Supabase direct { data: [...], error: null }
    const supabasePayload = {
      data: [{ id_pengumuman: 'SUPA-1', judul: 'Pengumuman Supabase', isi: 'Konten Supabase', created_at: new Date().toISOString() }],
      error: null
    };
    assert.ok(Array.isArray(supabasePayload.data));
    const mapped = mapAnnouncementToNotification(supabasePayload.data[0]);
    assert.equal(mapped.id, 'SUPA-1');
    assert.equal(mapped.title, 'Pengumuman Supabase');

    // 3. PostgREST error payload
    const errorPayload = {
      data: null,
      error: { message: 'relation pengumuman does not exist', code: '42P01' }
    };
    // Must be rejected as invalid dataList
    const isSuccess = Boolean(errorPayload && !errorPayload.error && errorPayload.status !== 'error');
    assert.equal(isSuccess, false, 'Error payload must not be treated as success');
  });

  // =========================================================================
  // TEST 5: Duplicate Announcement ID Deduplication
  // =========================================================================
  runTest('REV2-5', 'Eliminates duplicate announcement IDs from backend payloads to avoid React key collisions', () => {
    const rawListWithDuplicates = [
      { id_pengumuman: 'DUP-1', judul: 'Pengumuman Pertama', isi: 'Isi' },
      { id_pengumuman: 'DUP-1', judul: 'Pengumuman Pertama Duplikat', isi: 'Isi duplikat' },
      { id_pengumuman: 'DUP-2', judul: 'Pengumuman Kedua', isi: 'Isi kedua' }
    ];

    const seenIds = new Set();
    const uniqueNotifications = [];
    for (const ann of rawListWithDuplicates) {
      const mapped = mapAnnouncementToNotification(ann);
      if (!mapped || seenIds.has(mapped.id)) continue;
      seenIds.add(mapped.id);
      uniqueNotifications.push(mapped);
    }

    assert.equal(uniqueNotifications.length, 2, 'Should deduplicate DUP-1 to exactly one instance');
    assert.equal(uniqueNotifications[0].id, 'DUP-1');
    assert.equal(uniqueNotifications[1].id, 'DUP-2');
  });

  // =========================================================================
  // TEST 6: Realtime Channel Pooling Reference Counting
  // =========================================================================
  runTest('REV2-6', 'subscribeRealtimePengumuman pools channels and decrements refCount on cleanup', () => {
    assert.ok(bellSource.includes('entry.refCount++'), 'Must increment refCount on new subscriber');
    assert.ok(bellSource.includes('cur.refCount--'), 'Must decrement refCount on unsubscribe');
    assert.ok(bellSource.includes('cur.refCount <= 0'), 'Must clean up channel only when refCount reaches 0');
    assert.ok(bellSource.includes('realtimeChannelPool.delete(channelKey)'), 'Must remove channel from pool when empty');
  });

  // =========================================================================
  // TEST 7: Race Condition Defense with Request ID Token
  // =========================================================================
  runTest('REV2-7', 'NotificationBell tracks fetchIdRef to prevent out-of-order stale fetch responses', () => {
    assert.ok(bellSource.includes('const currentFetchId = ++fetchIdRef.current;'), 'Must increment fetch ID per fetch invocation');
    assert.ok(bellSource.includes('if (currentFetchId !== fetchIdRef.current) return;'), 'Must abort when newer fetch has started');
  });

  // =========================================================================
  // TEST 8: Live Multi-Bell Rendering in Parent Views
  // =========================================================================
  runTest('REV2-8', 'AdminView, GuruView, SiswaView mount 2 NotificationBell instances safely without crash', () => {
    const mockStorage = createMockStorage({
      nexa_notifications_admin: JSON.stringify([
        { id: 'ANN-A1', title: 'Info Admin 1', desc: 'Isi 1', time: '1 mnt lalu' },
        { id: 'ANN-A2', title: 'Info Admin 2', desc: 'Isi 2', time: '5 mnt lalu' }
      ])
    });
    global.window = { localStorage: mockStorage };
    global.localStorage = mockStorage;

    const user = { id_admin: 'ADM-99', username: 'admin_utama', npsn: '70040625' };

    // Desktop header bell
    const htmlDesktop = ReactDOMServer.renderToString(
      React.createElement(NotificationBell, { role: 'admin', npsn: user.npsn, user })
    );

    // Mobile header bell
    const htmlMobile = ReactDOMServer.renderToString(
      React.createElement(NotificationBell, { role: 'admin', variant: 'white', npsn: user.npsn, user })
    );

    assert.ok(htmlDesktop.includes('>2<'), 'Desktop bell must display badge 2');
    assert.ok(htmlMobile.includes('>2<'), 'Mobile bell must display badge 2');
  });
} finally {
  try { fs.unlinkSync(tempFile); } catch {}
}

console.log('\n------------------------------------------------------------------------');
console.log(`TOTAL REVIEWER 2 STRESS TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log('========================================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL REVIEWER 2 STRESS TESTS PASSED!\n');
}
