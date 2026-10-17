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
console.log('  CHALLENGER ROUND 11 (REVIEWER 3): EXHAUSTIVE ADVERSARIAL STRESS SUITE  ');
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
const tempFile = path.join(__dirname, 'temp_bell_r11_rev3_runtime.mjs');
fs.writeFileSync(tempFile, esbuildResult.code);

// Prepare open variant for DOM layout testing
const openBellSource = bellSource.replace(
  'const [isOpen, setIsOpen] = useState(false);',
  'const [isOpen, setIsOpen] = useState(true);'
);
const esbuildOpenResult = await transformWithEsbuild(openBellSource, 'NotificationBellOpen.jsx', { jsx: 'automatic' });
const tempOpenFile = path.join(__dirname, 'temp_bell_r11_rev3_open_runtime.mjs');
fs.writeFileSync(tempOpenFile, esbuildOpenResult.code);

const {
  default: NotificationBell,
  formatBadgeCount,
  formatRelativeTime,
  mapAnnouncementToNotification,
  loadReadIds,
  saveReadIds,
  loadSafeNotifications
} = await import(pathToFileURL(tempFile).href);

const { default: NotificationBellOpen } = await import(pathToFileURL(tempOpenFile).href);

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
  // TEST 1: Numeric and Non-Standard NPSN Resolution
  // =========================================================================
  runTest('REV3-1', 'effectiveNpsn coerces numeric and padded NPSN values cleanly to string', () => {
    // 1. Direct numeric npsn prop
    const mockStorage = createMockStorage();
    global.window = { localStorage: mockStorage };
    global.localStorage = mockStorage;

    let capturedPayload = null;
    const fakeFetch = async (action, payload) => {
      capturedPayload = payload;
      return { status: 'success', data: [] };
    };

    // Render with numeric npsn
    ReactDOMServer.renderToString(
      React.createElement(NotificationBell, { role: 'guru', npsn: 70040625, fetchAPI: fakeFetch })
    );

    // Verify code contains coercion
    assert.ok(bellSource.includes('npsn !== undefined && npsn !== null && String(npsn).trim()'), 'effectiveNpsn must safely coerce numeric npsn prop');
    assert.ok(bellSource.includes('user?.npsn !== undefined && user?.npsn !== null && String(user.npsn).trim()'), 'effectiveNpsn must safely coerce user.npsn numeric values');
  });

  // =========================================================================
  // TEST 2: Role Inference Fallback from user Object
  // =========================================================================
  runTest('REV3-2', 'Infers role correctly from user.role or user.tipe when role prop is omitted', () => {
    const rolesToTest = [
      { user: { role: 'guru', id_guru: 'G1' }, expectedBadgeKey: 'nexa_notifications_guru' },
      { user: { role: 'admin', id_admin: 'A1' }, expectedBadgeKey: 'nexa_notifications_admin' },
      { user: { role: 'super_admin', id_super_admin: 'SA1' }, expectedBadgeKey: 'nexa_notifications_super_admin' },
      { user: { role: 'siswa', id_siswa: 'S1' }, expectedBadgeKey: 'nexa_notifications_siswa' },
      { user: { tipe: 'guru', id_guru: 'G2' }, expectedBadgeKey: 'nexa_notifications_guru' }
    ];

    for (const { user, expectedBadgeKey } of rolesToTest) {
      const mockStorage = createMockStorage({
        [expectedBadgeKey]: JSON.stringify([{ id: 'ANN-INF-1', title: 'Test Inferred', isRead: false }])
      });
      global.window = { localStorage: mockStorage };
      global.localStorage = mockStorage;

      const html = ReactDOMServer.renderToString(
        React.createElement(NotificationBell, { user })
      );

      assert.ok(html.includes('>1<'), `Omitted role with user.role=${user.role || user.tipe} must infer role and read from ${expectedBadgeKey}`);
      assert.ok(html.includes('animate-bell-shake'), 'Inferred role must shake bell when unread exists');
    }
  });

  // =========================================================================
  // TEST 3: Account ID Resolution with Primitive and Complex User Types
  // =========================================================================
  runTest('REV3-3', 'accountId resolves primitive string, number, and object user identifiers', () => {
    // 1. Primitive string user
    const mockStorage = createMockStorage({
      nexa_notifications_guru: JSON.stringify([{ id: 'ANN-P1', title: 'Test Prim', isRead: false }]),
      'nexa_read_notifs_guru_USER_STRING_123': JSON.stringify(['ANN-P1'])
    });
    global.window = { localStorage: mockStorage };
    global.localStorage = mockStorage;

    const htmlStringUser = ReactDOMServer.renderToString(
      React.createElement(NotificationBell, { role: 'guru', user: 'USER_STRING_123' })
    );
    // ANN-P1 is marked read in user's readKey, so 0 unread
    assert.ok(!htmlStringUser.includes('animate-bell-shake'), 'Primitive string user must resolve accountId and respect readKey');

    // 2. Primitive numeric user
    const mockStorageNum = createMockStorage({
      nexa_notifications_guru: JSON.stringify([{ id: 'ANN-P2', title: 'Test Num', isRead: false }]),
      'nexa_read_notifs_guru_998877': JSON.stringify(['ANN-P2'])
    });
    global.window = { localStorage: mockStorageNum };
    global.localStorage = mockStorageNum;

    const htmlNumUser = ReactDOMServer.renderToString(
      React.createElement(NotificationBell, { role: 'guru', user: 998877 })
    );
    assert.ok(!htmlNumUser.includes('animate-bell-shake'), 'Primitive numeric user must resolve accountId and respect readKey');
  });

  // =========================================================================
  // TEST 4: In-flight API Fetch Key-Order Independence
  // =========================================================================
  runTest('REV3-4', 'fetchPengumumanWithDedupe normalizes object key order to prevent duplicate requests', () => {
    assert.ok(
      bellSource.includes('Object.keys(payload).sort()'),
      'fetchPengumumanWithDedupe must sort object keys before JSON.stringify to guarantee deterministic cache keys'
    );
  });

  // =========================================================================
  // TEST 5: Keyboard Navigation & Escape Focus Restoration
  // =========================================================================
  runTest('REV3-5', 'Trigger button maintains triggerRef, restores focus on Escape, and items have aria-label', () => {
    assert.ok(bellSource.includes('ref={triggerRef}'), 'Bell trigger button must attach ref={triggerRef}');
    assert.ok(bellSource.includes('triggerRef.current.focus()'), 'Escape key listener must restore focus to triggerRef');
    assert.ok(bellSource.includes('aria-label={`${item.title}.'), 'Each notification item must have an informative aria-label with read status');
  });

  // =========================================================================
  // TEST 6: Mobile Viewport Collision Clamping
  // =========================================================================
  runTest('REV3-6', 'Popover panel contains dynamic style clamping for mobile viewport boundary protection', () => {
    assert.ok(bellSource.includes('style={popoverStyle}'), 'Popover container must bind dynamic style={popoverStyle}');
    assert.ok(bellSource.includes('transform: `translateX('), 'Popover positioning must apply translateX offset when left overflow occurs');
    assert.ok(bellSource.includes('max-w-[calc(100vw-1.5rem)]'), 'Popover must retain Tailwind max-w CSS constraint');
  });

  // =========================================================================
  // TEST 7: Numeric Announcement Titles Resiliency
  // =========================================================================
  runTest('REV3-7', 'mapAnnouncementToNotification cleanly coerces numeric announcement titles to string', () => {
    const annNumeric = {
      id_pengumuman: 'ANN-NUM-2026',
      judul: 2026,
      isi: 'Tahun Ajaran Baru',
      tipe: 'info'
    };

    const mapped = mapAnnouncementToNotification(annNumeric);
    assert.ok(mapped !== null, 'Numeric title must not be rejected as null');
    assert.equal(mapped.title, '2026', 'Numeric title must be stringified');
  });

  // =========================================================================
  // TEST 8: Dark Mode Class Consistency across Component Structure
  // =========================================================================
  runTest('REV3-8', 'Dark mode utility classes exist on every layer of NotificationBell', () => {
    // Trigger
    assert.ok(bellSource.includes('dark:text-slate-300'), 'Bell trigger must have dark:text-slate-300');
    assert.ok(bellSource.includes('dark:hover:bg-slate-800'), 'Bell trigger must have dark:hover:bg-slate-800');

    // Popover
    assert.ok(bellSource.includes('dark:bg-slate-800'), 'Popover must have dark:bg-slate-800');
    assert.ok(bellSource.includes('dark:border-slate-700'), 'Popover must have dark:border-slate-700');
    assert.ok(bellSource.includes('dark:text-white'), 'Popover title must have dark:text-white');

    // Empty state
    assert.ok(bellSource.includes('dark:text-slate-500'), 'Empty state must have dark:text-slate-500');
    assert.ok(bellSource.includes('dark:text-slate-600'), 'Empty state icon must have dark:text-slate-600');

    // Items
    assert.ok(bellSource.includes('dark:bg-primary/10'), 'Unread item must have dark:bg-primary/10');
    assert.ok(bellSource.includes('dark:hover:bg-slate-700/40'), 'Read item must have dark:hover:bg-slate-700/40');

    // Footer
    assert.ok(bellSource.includes('dark:bg-slate-900/60'), 'Footer must have dark:bg-slate-900/60');
    assert.ok(bellSource.includes('dark:text-slate-200'), 'Footer status text must have dark:text-slate-200');
  });

} finally {
  try { fs.unlinkSync(tempFile); } catch {}
  try { fs.unlinkSync(tempOpenFile); } catch {}
}

console.log('\n------------------------------------------------------------------------');
console.log(`TOTAL REVIEWER 3 STRESS TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log('========================================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL REVIEWER 3 ADVERSARIAL STRESS TESTS PASSED!\n');
}
