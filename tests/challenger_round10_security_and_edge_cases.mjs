import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.resolve(projectRoot, 'src');

console.log('========================================================================');
console.log('  CHALLENGER ROUND 10: ADVERSARIAL REVIEWER STRESS & SECURITY TEST       ');
console.log('========================================================================\n');

const bellPath = path.join(srcDir, 'components', 'NotificationBell.jsx');
const bellSource = fs.readFileSync(bellPath, 'utf-8');

let passed = 0;
let failed = 0;

function runAdversarial(id, description, fn) {
  try {
    fn();
    console.log(`  ✔ [PASS] ${id}: ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${id}: ${description}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// Extract helpers module for direct runtime testing
const extractHelpers = () => {
  // Extract from getSafeStorage up to formatBadgeCount
  const rawHelperSection = bellSource.substring(
    bellSource.indexOf('const getSafeStorage'),
    bellSource.indexOf('export default function')
  );
  const cleanHelperSection = rawHelperSection.replace(/export\s+/g, '');
  
  const evalModule = new Function(`
    ${cleanHelperSection}
    return {
      getSafeStorage,
      LEGACY_DUMMY_IDS,
      LEGACY_DUMMY_TITLES,
      isLegacyDummyNotification,
      purgeAllLegacyNotificationCaches,
      formatBadgeCount
    };
  `);
  return evalModule();
};

const helpers = extractHelpers();

// ADVERSARIAL TEST 1: Restricted localStorage (SecurityError DOMException)
runAdversarial('ADV-1', 'Resistant to Storage Access Denied (DOMException on window.localStorage)', () => {
  // Simulate an environment where window.localStorage getter throws SecurityError
  const restrictedScope = {
    get window() {
      const win = {};
      Object.defineProperty(win, 'localStorage', {
        get() {
          const err = new Error('Access is denied for this document');
          err.name = 'SecurityError';
          throw err;
        }
      });
      return win;
    },
    get localStorage() {
      const err = new Error('Access is denied for this document');
      err.name = 'SecurityError';
      throw err;
    }
  };

  const fn = new Function('scope', `
    with (scope) {
      ${bellSource.substring(
        bellSource.indexOf('const getSafeStorage'),
        bellSource.indexOf('export default function')
      ).replace(/export\s+/g, '')}
      // Both getSafeStorage and purgeAllLegacyNotificationCaches must execute with 0 unhandled exceptions
      const storage = getSafeStorage();
      if (storage !== null) throw new Error('Expected null storage in restricted scope');
      purgeAllLegacyNotificationCaches();
      return true;
    }
  `);

  assert.equal(fn(restrictedScope), true);
});

// ADVERSARIAL TEST 2: Corrupted & Malformed items in localStorage
runAdversarial('ADV-2', 'Handles malformed array items (null, numbers, missing id/title) without crashing', () => {
  const { isLegacyDummyNotification } = helpers;

  // Test various malformed items: all must be classified as invalid/dummy (true)
  assert.equal(isLegacyDummyNotification(null), true, 'null must be treated as invalid/dummy');
  assert.equal(isLegacyDummyNotification(undefined), true, 'undefined must be treated as invalid/dummy');
  assert.equal(isLegacyDummyNotification(123), true, 'number must be treated as invalid/dummy');
  assert.equal(isLegacyDummyNotification('string'), true, 'string must be treated as invalid/dummy');
  assert.equal(isLegacyDummyNotification(true), true, 'boolean must be treated as invalid/dummy');
  assert.equal(isLegacyDummyNotification({}), true, 'empty object without id/title must be rejected');
  assert.equal(isLegacyDummyNotification({ id: 'valid-1' }), true, 'missing title must be rejected');
  assert.equal(isLegacyDummyNotification({ title: 'A valid title' }), true, 'missing id must be rejected');
  
  // Real valid notification
  assert.equal(
    isLegacyDummyNotification({ id: 'real-notif-100', title: 'Pengumuman Resmi Sekolah', isRead: false }),
    false,
    'Legitimate notification must NOT be marked as dummy'
  );
});

// ADVERSARIAL TEST 3: Legacy dummy detection by Title
runAdversarial('ADV-3', 'Identifies legacy dummy notifications even if ID format was modified', () => {
  const { isLegacyDummyNotification } = helpers;

  const dummyTitles = [
    'Jadwal Ujian Baru',
    'Verifikasi Siswa Baru',
    'Pencadangan Berhasil',
    'Ujian Sedang Berlangsung',
    'Periksa Jawaban Uraian',
    'Jadwal Ujian Diperbarui',
    'Ujian Mendatang',
    'Hasil Ujian Tersedia',
    'Integritas Ujian CBT',
    'Pendaftaran Sekolah Baru',
    'Pembaruan Server Cloud',
    'Audit Log Sistem',
    'Sistem CBT NEXA Online',
    'Pemberitahuan Sistem',
    'Tips Navigasi'
  ];

  for (const title of dummyTitles) {
    const itemWithCustomId = { id: 'custom-uuid-999', title, isRead: false };
    assert.equal(
      isLegacyDummyNotification(itemWithCustomId),
      true,
      `Item with legacy title "${title}" should be recognized as dummy`
    );
  }
});

// ADVERSARIAL TEST 4: Popover Footer and Empty State text precision
runAdversarial('ADV-4', 'Empty state text matches "Tidak ada notifikasi saat ini."', () => {
  assert.match(bellSource, /Tidak ada notifikasi saat ini\./);
  assert.match(bellSource, /Status:\s*<span[^>]*>\{notifications\.length === 0 \? 'Tidak Ada Notifikasi'/);
});

// ADVERSARIAL TEST 5: formatBadgeCount boundary & edge cases
runAdversarial('ADV-5', 'formatBadgeCount: handles NaN, Infinity, strings, floats', () => {
  const { formatBadgeCount } = helpers;

  assert.equal(formatBadgeCount(NaN), null);
  assert.equal(formatBadgeCount(undefined), null);
  assert.equal(formatBadgeCount(null), null);
  assert.equal(formatBadgeCount(0), null);
  assert.equal(formatBadgeCount(-1), null);
  assert.equal(formatBadgeCount('0'), null);
  assert.equal(formatBadgeCount('abc'), null);
  assert.equal(formatBadgeCount('1'), '1');
  assert.equal(formatBadgeCount('15'), '15');
  assert.equal(formatBadgeCount(1), '1');
  assert.equal(formatBadgeCount(12.8), '12');
  assert.equal(formatBadgeCount(99), '99');
  assert.equal(formatBadgeCount(100), '99+');
  assert.equal(formatBadgeCount(1000), '99+');
  assert.equal(formatBadgeCount(Infinity), '99+');
});

// ADVERSARIAL TEST 6: Zero residual dummy in all files in src/
runAdversarial('ADV-6', 'Zero residual dummy notification references in entire src/ tree', () => {
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const fullPath = path.join(dir, e.name);
      if (e.isDirectory()) {
        scanDir(fullPath);
      } else if (e.isFile() && (e.name.endsWith('.jsx') || e.name.endsWith('.js'))) {
        const c = fs.readFileSync(fullPath, 'utf-8');
        assert.ok(!c.includes('DEFAULT_NOTIFICATIONS_BY_ROLE'), `File ${fullPath} contains DEFAULT_NOTIFICATIONS_BY_ROLE`);
        assert.ok(!c.includes('GENERIC_DEFAULT_NOTIFICATIONS'), `File ${fullPath} contains GENERIC_DEFAULT_NOTIFICATIONS`);
        assert.ok(!c.includes('handleSimulateToggle'), `File ${fullPath} contains handleSimulateToggle`);
        assert.ok(!c.includes('Simulasikan Belum Dibaca'), `File ${fullPath} contains "Simulasikan Belum Dibaca"`);
      }
    }
  }
  scanDir(srcDir);
});

// ADVERSARIAL TEST 7: Cross-Role localStorage isolation & purge
runAdversarial('ADV-7', 'Cross-role notification cache isolation and complete purging', () => {
  const { purgeAllLegacyNotificationCaches } = helpers;

  const mockStore = {};
  const mockStorage = {
    getItem: (k) => mockStore[k] || null,
    setItem: (k, v) => { mockStore[k] = String(v); },
    removeItem: (k) => { delete mockStore[k]; }
  };

  // Seed every role with dummy data
  mockStore['nexa_notifications_admin'] = JSON.stringify([
    { id: 'adm-1', title: 'Jadwal Ujian Baru', isRead: false }
  ]);
  mockStore['nexa_notifications_super_admin'] = JSON.stringify([
    { id: 'sup-1', title: 'Pendaftaran Sekolah Baru', isRead: false }
  ]);
  mockStore['nexa_notifications_guru'] = JSON.stringify([
    { id: 'gru-1', title: 'Ujian Sedang Berlangsung', isRead: false }
  ]);
  mockStore['nexa_notifications_siswa'] = JSON.stringify([
    { id: 'sis-1', title: 'Ujian Mendatang', isRead: false },
    { id: 'legit-siswa-1', title: 'Pengumuman Resmi Sekolah', isRead: false }
  ]);
  mockStore['nexa_notifications_generic'] = JSON.stringify([
    { id: 'gen-1', title: 'Sistem CBT NEXA Online', isRead: false }
  ]);
  mockStore['nexa_notifications'] = JSON.stringify([
    { id: 'old-1', title: 'Pemberitahuan Sistem', isRead: false }
  ]);

  // Execute purge with custom mock storage
  const fn = new Function('mockStorage', `
    const getSafeStorage = () => mockStorage;
    ${bellSource.substring(
      bellSource.indexOf('const LEGACY_DUMMY_IDS'),
      bellSource.indexOf('export const formatBadgeCount')
    ).replace(/export\s+/g, '')}
    purgeAllLegacyNotificationCaches();
  `);

  fn(mockStorage);

  assert.equal(mockStore['nexa_notifications_admin'], undefined, 'Admin cache must be removed');
  assert.equal(mockStore['nexa_notifications_super_admin'], undefined, 'SuperAdmin cache must be removed');
  assert.equal(mockStore['nexa_notifications_guru'], undefined, 'Guru cache must be removed');
  assert.equal(mockStore['nexa_notifications_generic'], undefined, 'Generic cache must be removed');
  assert.equal(mockStore['nexa_notifications'], undefined, 'Generic un-prefixed cache must be removed');

  // Siswa cache must only contain the legitimate notification
  assert.ok(mockStore['nexa_notifications_siswa'], 'Siswa cache must retain legitimate notification');
  const siswaData = JSON.parse(mockStore['nexa_notifications_siswa']);
  assert.equal(siswaData.length, 1);
  assert.equal(siswaData[0].id, 'legit-siswa-1');
});

console.log('\n------------------------------------------------------------------------');
console.log(`TOTAL ADVERSARIAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL ADVERSARIAL REVIEWER TESTS PASSED!\n');
}
