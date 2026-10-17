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
console.log('  CHALLENGER ROUND 11: ADVERSARIAL REVIEWER VERIFICATION & STRESS TEST   ');
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
const tempFile = path.join(__dirname, 'temp_bell_adv11_runtime.mjs');
fs.writeFileSync(tempFile, esbuildResult.code);

// Prepare open variant for DOM layout testing
const openBellSource = bellSource.replace(
  'const [isOpen, setIsOpen] = useState(false);',
  'const [isOpen, setIsOpen] = useState(true);'
);
const esbuildOpenResult = await transformWithEsbuild(openBellSource, 'NotificationBellOpen.jsx', { jsx: 'automatic' });
const tempOpenFile = path.join(__dirname, 'temp_bell_adv11_open_runtime.mjs');
fs.writeFileSync(tempOpenFile, esbuildOpenResult.code);

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
  // TEST 1: Cross-User Read Status Isolation on Shared Device
  // =========================================================================
  runTest('ADV11.1', 'Multi-user read status isolation: User B on shared device does NOT inherit User A reads', () => {
    const mockStorage = createMockStorage();
    global.window = { localStorage: mockStorage };
    global.localStorage = mockStorage;

    const realAnnouncements = [
      { id: 'ANN-REAL-101', title: 'Ujian Kimia', desc: 'Siswa hadir tepat waktu', time: '5 mnt lalu' },
      { id: 'ANN-REAL-102', title: 'Perubahan Jam', desc: 'Mulai pukul 09:00', time: '10 mnt lalu' }
    ];

    // Seed announcements in shared role cache
    mockStorage.setItem('nexa_notifications_siswa', JSON.stringify(realAnnouncements));

    // User A reads ANN-REAL-101
    const userA = { id_siswa: 'SIS-001', username: 'budi_siswa', npsn: '70040625' };
    const userAKey = `nexa_read_notifs_siswa_SIS-001`;
    const userAReads = loadReadIds(userAKey);
    userAReads.add('ANN-REAL-101');
    saveReadIds(userAKey, userAReads);

    // Render User A -> Unread count is 1 (ANN-REAL-102 unread)
    const htmlUserA = ReactDOMServer.renderToString(
      React.createElement(NotificationBell, { role: 'siswa', user: userA })
    );
    assert.ok(htmlUserA.includes('animate-bell-shake'), 'User A must see bell shaking for 1 unread');
    assert.ok(htmlUserA.includes('>1<'), 'User A badge must show "1"');

    // User B logs in on the same browser/device
    const userB = { id_siswa: 'SIS-002', username: 'ani_siswa', npsn: '70040625' };
    const htmlUserB = ReactDOMServer.renderToString(
      React.createElement(NotificationBell, { role: 'siswa', user: userB })
    );

    // User B has read 0 items, so unread count MUST be 2!
    assert.ok(htmlUserB.includes('animate-bell-shake'), 'User B must see bell shaking for 2 unread');
    assert.ok(htmlUserB.includes('>2<'), 'User B badge must show "2" (not 1 from User A!)');
  });

  // =========================================================================
  // TEST 2: Legitimate Real Announcements with Common Titles ("Jadwal Ujian Baru")
  // =========================================================================
  runTest('ADV11.2', 'Legitimate backend announcements with common titles ("Jadwal Ujian Baru") are NOT dropped', () => {
    const commonTitles = [
      'Jadwal Ujian Baru',
      'Hasil Ujian Tersedia',
      'Ujian Mendatang',
      'Periksa Jawaban Uraian'
    ];

    for (const title of commonTitles) {
      const realItem = {
        id_pengumuman: `ANN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        judul: title,
        isi: `Detail pengumuman untuk ${title}`,
        tipe: 'info',
        created_at: new Date().toISOString()
      };

      const mapped = mapAnnouncementToNotification(realItem, false);
      assert.ok(mapped !== null, `Mapped announcement for "${title}" must not be null`);
      assert.equal(mapped.title, title);
      assert.equal(mapped.isRead, false);
    }
  });

  // =========================================================================
  // TEST 3: Multi-Tab Storage Event Synchronization
  // =========================================================================
  runTest('ADV11.3', 'NotificationBell handles storage events on both storageKey and readKey', () => {
    assert.ok(bellSource.includes('e.key === storageKey || e.key === readKey'), 'Storage event handler must listen to both storageKey and readKey');
  });

  // =========================================================================
  // TEST 4: Date Object & Future Date Precision
  // =========================================================================
  runTest('ADV11.4', 'formatRelativeTime handles Date objects, future dates, and negative skews gracefully', () => {
    // Native Date instance
    assert.equal(formatRelativeTime(new Date()), 'Baru saja');
    // Future timestamp (clock skew defense)
    assert.equal(formatRelativeTime(new Date(Date.now() + 60000)), 'Baru saja');
    // Numeric timestamp
    assert.equal(formatRelativeTime(Date.now() - 15 * 60 * 1000), '15 mnt lalu');
    // ISO string with timezone
    assert.equal(formatRelativeTime(new Date(Date.now() - 4 * 3600 * 1000).toISOString()), '4 jam lalu');
  });

  // =========================================================================
  // TEST 5: Non-standard Indonesian Tipe Mapping & Color Tokens
  // =========================================================================
  runTest('ADV11.5', 'Indonesian tipe synonyms map to correct icons and styles', () => {
    const p1 = mapAnnouncementToNotification({ id_pengumuman: 'A1', judul: 'Peringatan Banjir', isi: 'Hati-hati', tipe: 'PERINGATAN' });
    assert.equal(p1.icon, 'warning');

    const p2 = mapAnnouncementToNotification({ id_pengumuman: 'A2', judul: 'Server Maintenance', isi: 'Penting sekali', tipe: 'Penting' });
    assert.equal(p2.icon, 'error');

    const p3 = mapAnnouncementToNotification({ id_pengumuman: 'A3', judul: 'Ujian Semester', isi: 'Jadwal ujian', tipe: 'JADWAL' });
    assert.equal(p3.icon, 'event_note');

    const p4 = mapAnnouncementToNotification({ id_pengumuman: 'A4', judul: 'Sinkron Selesai', isi: 'Sukses diunggah', tipe: 'sukses' });
    assert.equal(p4.icon, 'check_circle');
  });

  // =========================================================================
  // TEST 6: Storage Quota Exhaustion & Memory Fallback
  // =========================================================================
  runTest('ADV11.6', 'saveReadIds & loadReadIds fall back to memory store when storage throws QuotaExceededError', () => {
    const throwingStorage = {
      getItem: () => null,
      setItem: () => {
        const err = new Error('Quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      },
      removeItem: () => {}
    };
    global.window = { localStorage: throwingStorage };
    global.localStorage = throwingStorage;

    const testKey = 'nexa_read_notifs_test_quota_user';
    const readSet = new Set(['ANN-QUOTA-1', 'ANN-QUOTA-2']);
    // Must not throw
    saveReadIds(testKey, readSet);

    // Load from memory fallback
    const loaded = loadReadIds(testKey);
    assert.equal(loaded.size, 2);
    assert.ok(loaded.has('ANN-QUOTA-1'));
    assert.ok(loaded.has('ANN-QUOTA-2'));
  });

  // =========================================================================
  // TEST 7: In-Popover Manual Refresh Button & Periodic Polling
  // =========================================================================
  runTest('ADV11.7', 'Popover header contains refresh button and periodic auto-refresh listener', () => {
    const mockStorage = createMockStorage();
    global.window = { localStorage: mockStorage };
    global.localStorage = mockStorage;

    const htmlOpen = ReactDOMServer.renderToString(
      React.createElement(NotificationBellOpen, { role: 'admin' })
    );

    assert.ok(htmlOpen.includes('Segarkan Notifikasi'), 'Popover header must contain "Segarkan Notifikasi" button');
    assert.ok(bellSource.includes('setInterval'), 'NotificationBell must have periodic auto-refresh interval');
    assert.ok(bellSource.includes('visibilitychange'), 'NotificationBell must have visibilitychange listener');
  });

  // =========================================================================
  // TEST 8: Supabase Realtime Push Subscription Architecture
  // =========================================================================
  runTest('ADV11.8', 'Supabase realtime push subscription is declared and cleaned up safely', () => {
    assert.ok(bellSource.includes("table: 'pengumuman'"), 'NotificationBell must subscribe to pengumuman table');
    assert.ok(bellSource.includes("table: 'pengumuman_global'"), 'NotificationBell must subscribe to pengumuman_global table');
    assert.ok(bellSource.includes('removeChannel'), 'NotificationBell must clean up Supabase channel subscription');
  });
} finally {
  try { fs.unlinkSync(tempFile); } catch {}
  try { fs.unlinkSync(tempOpenFile); } catch {}
}

console.log('\n------------------------------------------------------------------------');
console.log(`TOTAL ADVERSARIAL REVIEWER TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log('========================================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL ADVERSARIAL REVIEWER TESTS PASSED!\n');
}
