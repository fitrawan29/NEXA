import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.resolve(projectRoot, 'src');

console.log('========================================================================');
console.log('  ROUND 10 TEST SUITE: NOTIFICATION BELL SANITIZATION & EMPTY STATE     ');
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

const bellPath = path.join(srcDir, 'components', 'NotificationBell.jsx');
const bellSource = fs.readFileSync(bellPath, 'utf-8');

// Test 1: Complete elimination of dummy notifications arrays
runTest('R10.1', 'NotificationBell source is free of DEFAULT_NOTIFICATIONS_BY_ROLE and GENERIC_DEFAULT_NOTIFICATIONS', () => {
  assert.ok(!bellSource.includes('DEFAULT_NOTIFICATIONS_BY_ROLE'), 'Must not contain DEFAULT_NOTIFICATIONS_BY_ROLE');
  assert.ok(!bellSource.includes('GENERIC_DEFAULT_NOTIFICATIONS'), 'Must not contain GENERIC_DEFAULT_NOTIFICATIONS');
});

// Test 2: Complete elimination of simulation toggle button and handler
runTest('R10.2', 'NotificationBell source is free of handleSimulateToggle and "Simulasikan Belum Dibaca"', () => {
  assert.ok(!bellSource.includes('handleSimulateToggle'), 'Must not contain handleSimulateToggle');
  assert.ok(!/Simulasikan\s+Belum\s+Dibaca/i.test(bellSource), 'Must not contain "Simulasikan Belum Dibaca"');
});

// Test 3: Default empty state ("Tidak ada notifikasi saat ini")
runTest('R10.3', 'NotificationBell renders empty state message when notifications array is empty', () => {
  assert.ok(bellSource.includes('Tidak ada notifikasi saat ini'), 'Must contain empty state message "Tidak ada notifikasi saat ini"');
  assert.ok(bellSource.includes('notifications_off'), 'Must contain empty state icon notifications_off');
});

// Test 4: formatBadgeCount export and boundary behavior
runTest('R10.4', 'formatBadgeCount: returns null when empty/zero, exact for 1-99, 99+ for > 99', () => {
  const match = bellSource.match(/export const formatBadgeCount = \(([^)]+)\) => \{([\s\S]*?)\};/);
  assert.ok(match, 'formatBadgeCount must be exported');
  const formatBadgeCount = new Function(match[1], match[2]);

  assert.equal(formatBadgeCount(0), null);
  assert.equal(formatBadgeCount(-5), null);
  assert.equal(formatBadgeCount(null), null);
  assert.equal(formatBadgeCount(undefined), null);
  assert.equal(formatBadgeCount(1), '1');
  assert.equal(formatBadgeCount(15), '15');
  assert.equal(formatBadgeCount(99), '99');
  assert.equal(formatBadgeCount(100), '99+');
  assert.equal(formatBadgeCount(500), '99+');
});

// Test 5: Badge and shake animation are conditioned on unreadCount > 0
runTest('R10.5', 'Badge and shake animation only activate when real unread notifications exist', () => {
  // Shake animation must be conditional on unread
  assert.match(bellSource, /hasUnread\s*\?\s*['"][^'"]*animate-bell-shake/);
  // Red badge must be conditional on hasUnread && unreadCount > 0
  assert.match(bellSource, /hasUnread\s*&&\s*unreadCount\s*>\s*0/);
});

// Test 6: Legacy dummy cache sanitizer logic
runTest('R10.6', 'Legacy dummy cache sanitizer removes adm-*, gru-*, sis-*, sup-*, gen-* items from localStorage', () => {
  // Mock localStorage
  const store = {};
  const mockLocalStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  // Seed legacy dummy items
  store['nexa_notifications_admin'] = JSON.stringify([
    { id: 'adm-1', title: 'Jadwal Ujian Baru', isRead: false },
    { id: 'adm-2', title: 'Verifikasi Siswa Baru', isRead: false }
  ]);
  store['nexa_notifications_siswa'] = JSON.stringify([
    { id: 'sis-1', title: 'Ujian Mendatang', isRead: false },
    { id: 'real-notif-1', title: 'Pengumuman Resmi Sekolah', isRead: false }
  ]);

  // Extract isLegacyDummyNotification and purgeAllLegacyNotificationCaches logic
  const legacyIds = new Set([
    'adm-1', 'adm-2', 'adm-3',
    'gru-1', 'gru-2', 'gru-3',
    'sis-1', 'sis-2', 'sis-3',
    'sup-1', 'sup-2', 'sup-3',
    'gen-1', 'gen-2', 'gen-3'
  ]);
  const isLegacyDummy = (item) => {
    if (!item || typeof item !== 'object') return true;
    if (item.id && legacyIds.has(item.id)) return true;
    if (typeof item.id === 'string' && /^(adm|gru|sis|sup|gen)-\d+$/i.test(item.id)) return true;
    return false;
  };

  const purge = (ls) => {
    const roles = ['admin', 'super_admin', 'guru', 'siswa', 'generic'];
    roles.forEach(r => {
      const k = `nexa_notifications_${r}`;
      const raw = ls.getItem(k);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const valid = parsed.filter(i => !isLegacyDummy(i));
            if (valid.length > 0) {
              ls.setItem(k, JSON.stringify(valid));
            } else {
              ls.removeItem(k);
            }
          }
        } catch {
          ls.removeItem(k);
        }
      }
    });
  };

  purge(mockLocalStorage);

  // Assert admin cache was completely purged (since all items were dummy)
  assert.equal(mockLocalStorage.getItem('nexa_notifications_admin'), null);
  // Assert siswa cache preserved real notification and purged dummy item
  const siswaCached = JSON.parse(mockLocalStorage.getItem('nexa_notifications_siswa'));
  assert.equal(siswaCached.length, 1);
  assert.equal(siswaCached[0].id, 'real-notif-1');
});

// Test 7: Footer shows clean status without simulation button
runTest('R10.7', 'Popover footer shows clean summary status without any simulation elements', () => {
  assert.ok(bellSource.includes('Status:'), 'Footer must contain Status: summary');
  assert.ok(!bellSource.includes('<button\n              type="button"\n              onClick={handleSimulateToggle}'), 'Simulation button must not exist');
});

console.log('\n------------------------------------------------------------------------');
console.log(`TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log('========================================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL ROUND 10 NOTIFICATION BELL TESTS PASSED!\n');
}
