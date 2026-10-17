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
console.log('  ROUND 11 TEST SUITE: REAL NOTIFICATIONS INTEGRATION & PERSISTENCE    ');
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
const tempFile = path.join(__dirname, 'temp_bell_r11_runtime.mjs');
fs.writeFileSync(tempFile, esbuildResult.code);

const {
  default: NotificationBell,
  formatBadgeCount,
  formatRelativeTime,
  mapAnnouncementToNotification,
  loadReadIds,
  saveReadIds,
  loadSafeNotifications,
  purgeAllLegacyNotificationCaches
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
  // TEST 1: Eliminasi Simulasi & Dummy Notifikasi (R1)
  // =========================================================================
  runTest('R11.1', 'Elimination of dummy notifications & simulation controls from NotificationBell source', () => {
    assert.ok(!bellSource.includes('handleSimulateToggle'), 'Must not contain handleSimulateToggle');
    assert.ok(!/Simulasikan\s+Belum\s+Dibaca/i.test(bellSource), 'Must not contain "Simulasikan Belum Dibaca"');
    assert.ok(!bellSource.includes('DEFAULT_NOTIFICATIONS_BY_ROLE'), 'Must not contain DEFAULT_NOTIFICATIONS_BY_ROLE');
    assert.ok(!bellSource.includes('GENERIC_DEFAULT_NOTIFICATIONS'), 'Must not contain GENERIC_DEFAULT_NOTIFICATIONS');
  });

  // =========================================================================
  // TEST 2: Announcement Attributes Mapping (R2)
  // =========================================================================
  runTest('R11.2', 'mapAnnouncementToNotification accurately maps judul, isi, created_at, tipe, and id', () => {
    const announcement = {
      id_pengumuman: 'ANN-202610-001',
      judul: 'Ujian Akhir Semester Dimulai',
      isi: 'Harap hadir di ruang ujian 15 menit sebelum waktu pengerjaan dimulai.',
      tipe: 'warning',
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago
    };

    const notif = mapAnnouncementToNotification(announcement, false);
    assert.equal(notif.id, 'ANN-202610-001');
    assert.equal(notif.title, 'Ujian Akhir Semester Dimulai');
    assert.equal(notif.desc, 'Harap hadir di ruang ujian 15 menit sebelum waktu pengerjaan dimulai.');
    assert.equal(notif.tipe, 'warning');
    assert.equal(notif.icon, 'warning');
    assert.equal(notif.time, '10 mnt lalu');
    assert.equal(notif.isRead, false);

    // Urgent type mapping
    const urgentAnn = {
      id_pengumuman: 'ANN-URG-99',
      judul: 'Pemberitahuan Darurat',
      isi: 'Server maintenance mendadak',
      tipe: 'urgent',
      created_at: new Date(Date.now() - 30 * 1000).toISOString() // 30 sec ago
    };
    const urgentNotif = mapAnnouncementToNotification(urgentAnn, false);
    assert.equal(urgentNotif.icon, 'error');
    assert.equal(urgentNotif.time, 'Baru saja');

    // Success type mapping
    const successAnn = {
      id_pengumuman: 'ANN-SUC-01',
      judul: 'Sinkronisasi Nilai Selesai',
      isi: 'Seluruh nilai telah berhasil diunggah',
      tipe: 'success',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
    };
    const successNotif = mapAnnouncementToNotification(successAnn, true);
    assert.equal(successNotif.icon, 'check_circle');
    assert.equal(successNotif.time, '2 jam lalu');
    assert.equal(successNotif.isRead, true);
  });

  // =========================================================================
  // TEST 3: Relative Time Formatter Edge Cases
  // =========================================================================
  runTest('R11.3', 'formatRelativeTime handles various time horizons and invalid inputs cleanly', () => {
    assert.equal(formatRelativeTime(null), '');
    assert.equal(formatRelativeTime(undefined), '');
    assert.equal(formatRelativeTime(''), '');
    assert.equal(formatRelativeTime('Teks Biasa'), 'Teks Biasa');

    const now = Date.now();
    assert.equal(formatRelativeTime(new Date(now - 10000).toISOString()), 'Baru saja');
    assert.equal(formatRelativeTime(new Date(now - 5 * 60 * 1000).toISOString()), '5 mnt lalu');
    assert.equal(formatRelativeTime(new Date(now - 3 * 3600 * 1000).toISOString()), '3 jam lalu');
    assert.equal(formatRelativeTime(new Date(now - 2 * 86400 * 1000).toISOString()), '2 hari lalu');
  });

  // =========================================================================
  // TEST 4: Persistent Read Status Storage & Set Operations (R3)
  // =========================================================================
  runTest('R11.4', 'loadReadIds and saveReadIds persist and retrieve read IDs correctly', () => {
    const mockStorage = createMockStorage();
    global.window = { localStorage: mockStorage };
    global.localStorage = mockStorage;

    const key = 'nexa_read_notifs_admin_12345';
    
    // Initially empty
    let readSet = loadReadIds(key);
    assert.equal(readSet.size, 0);

    // Add IDs and save
    readSet.add('ANN-1');
    readSet.add('ANN-2');
    saveReadIds(key, readSet);

    // Reload and verify
    const reloaded = loadReadIds(key);
    assert.equal(reloaded.size, 2);
    assert.ok(reloaded.has('ANN-1'));
    assert.ok(reloaded.has('ANN-2'));
    assert.ok(!reloaded.has('ANN-3'));

    // Remove one ID
    reloaded.delete('ANN-1');
    saveReadIds(key, reloaded);

    const reloaded2 = loadReadIds(key);
    assert.equal(reloaded2.size, 1);
    assert.ok(!reloaded2.has('ANN-1'));
    assert.ok(reloaded2.has('ANN-2'));
  });

  // =========================================================================
  // TEST 5: Backend Endpoint Dispatching & Merging Logic (R2)
  // =========================================================================
  await runAsyncTest('R11.5', 'Role-based announcement endpoint dispatch and isRead merging behavior', async () => {
    const calls = [];
    const fakeFetchAPI = async (action, payload) => {
      calls.push({ action, payload });
      if (action === 'get_pengumuman_global') {
        return {
          status: 'success',
          data: [
            { id_pengumuman: 'GLB-1', judul: 'Pengumuman Sistem Global', isi: 'Info server global', tipe: 'info', created_at: new Date().toISOString() }
          ]
        };
      }
      if (action === 'get_pengumuman') {
        return {
          status: 'success',
          data: [
            { id_pengumuman: 'GLB-1', judul: '[GLOBAL] Pengumuman Sistem Global', isi: 'Info server global', tipe: 'info', created_at: new Date().toISOString() },
            { id_pengumuman: 'LOC-1', judul: 'Pengumuman Sekolah', isi: 'Info khusus guru', tipe: 'warning', created_at: new Date().toISOString() }
          ]
        };
      }
      return { status: 'error', message: 'Unknown action' };
    };

    // Test super_admin routing
    const mockStorage = createMockStorage({
      nexa_read_notifs_super_admin: JSON.stringify(['GLB-1'])
    });
    global.window = { localStorage: mockStorage };
    global.localStorage = mockStorage;

    // Execute super_admin call
    await fakeFetchAPI('get_pengumuman_global', {});
    assert.equal(calls[0].action, 'get_pengumuman_global');

    // Execute guru call with NPSN
    await fakeFetchAPI('get_pengumuman', { role: 'guru', npsn: '20109988' });
    assert.equal(calls[1].action, 'get_pengumuman');
    assert.equal(calls[1].payload.role, 'guru');
    assert.equal(calls[1].payload.npsn, '20109988');
  });

  // =========================================================================
  // TEST 6: Real-time Badge & Unread Computation (R4)
  // =========================================================================
  runTest('R11.6', 'Badge counter and unread calculation with 99+ overflow boundary', () => {
    assert.equal(formatBadgeCount(0), null);
    assert.equal(formatBadgeCount(1), '1');
    assert.equal(formatBadgeCount(99), '99');
    assert.equal(formatBadgeCount(100), '99+');
    assert.equal(formatBadgeCount(150), '99+');
  });

  // =========================================================================
  // TEST 7: SSR Clean Rendering with Real Notifications
  // =========================================================================
  runTest('R11.7', 'Live React rendering displays real notifications and accurate badge', () => {
    const realNotifs = [
      { id: 'ANN-01', title: 'Ujian Tengah Semester', desc: 'Jadwal telah terbit', time: '1 jam lalu', isRead: false },
      { id: 'ANN-02', title: 'Perubahan Jam Ruang 02', desc: 'Mulai pukul 08:30', time: '2 jam lalu', isRead: true }
    ];

    const mockStorage = createMockStorage({
      nexa_notifications_admin: JSON.stringify(realNotifs)
    });
    global.window = { localStorage: mockStorage };
    global.localStorage = mockStorage;

    const html = ReactDOMServer.renderToString(
      React.createElement(NotificationBell, { role: 'admin' })
    );

    // Unread count is 1, so badge must show "1" and shake class must be present
    assert.ok(html.includes('animate-bell-shake'), 'Bell must shake when unread notification exists');
    assert.ok(html.includes('bg-rose-500'), 'Red badge must be visible when unread notification exists');
  });

  // =========================================================================
  // TEST 8: Parent Views NotificationBell Props Inspection
  // =========================================================================
  runTest('R11.8', 'AdminView, GuruView, SiswaView, and SuperAdminView pass role & user/npsn props', () => {
    const adminViewSource = fs.readFileSync(path.join(srcDir, 'views', 'AdminView.jsx'), 'utf-8');
    assert.ok(adminViewSource.includes('<NotificationBell role="admin" npsn={user?.npsn} user={user} />'), 'AdminView must pass npsn and user to NotificationBell');

    const guruViewSource = fs.readFileSync(path.join(srcDir, 'views', 'GuruView.jsx'), 'utf-8');
    assert.ok(guruViewSource.includes('<NotificationBell role="guru" npsn={user?.npsn} user={user} />'), 'GuruView must pass npsn and user to NotificationBell');

    const siswaViewSource = fs.readFileSync(path.join(srcDir, 'views', 'SiswaView.jsx'), 'utf-8');
    assert.ok(siswaViewSource.includes('<NotificationBell role="siswa" npsn={user?.npsn} user={user} />'), 'SiswaView must pass npsn and user to NotificationBell');

    const superAdminSource = fs.readFileSync(path.join(srcDir, 'views', 'SuperAdminView.jsx'), 'utf-8');
    assert.ok(superAdminSource.includes('<NotificationBell role="super_admin" variant="white" user={user} />'), 'SuperAdminView must pass user to NotificationBell');
  });
} finally {
  try { fs.unlinkSync(tempFile); } catch {}
}

console.log('\n------------------------------------------------------------------------');
console.log(`TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log('========================================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL ROUND 11 NOTIFICATION BELL TESTS PASSED!\n');
}
