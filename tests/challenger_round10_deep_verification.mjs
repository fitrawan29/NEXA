import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fileURLToPath } from 'url';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { transformWithEsbuild } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.resolve(projectRoot, 'src');

console.log('========================================================================');
console.log('  CHALLENGER ROUND 10: DEEP ADVERSARIAL DOM & RUNTIME VERIFICATION       ');
console.log('========================================================================\n');

const bellPath = path.join(srcDir, 'components', 'NotificationBell.jsx');
const bellSource = fs.readFileSync(bellPath, 'utf-8');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runDeepTest(id, name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${id}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${id}: ${name}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

// Prepare transpiled NotificationBell component for runtime execution
const esbuildResult = await transformWithEsbuild(bellSource, 'NotificationBell.jsx', { jsx: 'automatic' });
const tempFile = path.join(__dirname, 'temp_bell_runtime.mjs');
fs.writeFileSync(tempFile, esbuildResult.code);

const { default: NotificationBell, formatBadgeCount, loadSafeNotifications } = await import('./temp_bell_runtime.mjs');

// Also prepare an open-popover variant to test popover DOM structure
const openBellSource = bellSource.replace(
  'const [isOpen, setIsOpen] = useState(false);',
  'const [isOpen, setIsOpen] = useState(true);'
);
const esbuildOpenResult = await transformWithEsbuild(openBellSource, 'NotificationBellOpen.jsx', { jsx: 'automatic' });
const tempOpenFile = path.join(__dirname, 'temp_bell_open_runtime.mjs');
fs.writeFileSync(tempOpenFile, esbuildOpenResult.code);

const { default: NotificationBellOpen } = await import('./temp_bell_open_runtime.mjs');

// Helper to create mock storage
const createMockStorage = (initialData = {}) => {
  const store = { ...initialData };
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
  // TEST 1: Live React SSR rendering across all 4 roles in clean default empty state
  runDeepTest('R10-DEEP-1', 'Live React rendering for all 4 roles produces clean empty state with NO shake and NO badge', () => {
    const roles = ['admin', 'guru', 'siswa', 'super_admin'];
    
    for (const role of roles) {
      // Mock clean storage
      const mockStorage = createMockStorage();
      global.window = { localStorage: mockStorage };
      global.localStorage = mockStorage;

      const html = ReactDOMServer.renderToString(
        React.createElement(NotificationBell, { role })
      );

      // Verify trigger button rendered
      assert.ok(html.includes('aria-label="Pemberitahuan Sistem"'), `${role}: Bell button missing aria-label`);
      assert.ok(html.includes('aria-haspopup="dialog"'), `${role}: Bell button missing aria-haspopup`);
      
      // Verify NO shake animation class when empty
      assert.ok(!html.includes('animate-bell-shake'), `${role}: Shaking animation must NOT be active when notifications are empty`);

      // Verify NO badge counter rendered
      assert.ok(!html.includes('bg-rose-500'), `${role}: Red badge indicator must NOT be present when empty`);
      assert.ok(!html.includes('animate-ping'), `${role}: Ping animation must NOT be present when empty`);
    }
  });

  // TEST 2: Siswa and SuperAdmin variant="white" rendering
  runDeepTest('R10-DEEP-2', 'Variant="white" applies correct white text tokens on trigger icon without shaking', () => {
    const mockStorage = createMockStorage();
    global.window = { localStorage: mockStorage };
    global.localStorage = mockStorage;

    const htmlSiswa = ReactDOMServer.renderToString(
      React.createElement(NotificationBell, { role: 'siswa', variant: 'white' })
    );
    assert.ok(htmlSiswa.includes('!text-white'), 'Siswa white variant icon must have !text-white');
    assert.ok(!htmlSiswa.includes('animate-bell-shake'), 'Siswa white variant must not shake when empty');

    const htmlSuper = ReactDOMServer.renderToString(
      React.createElement(NotificationBell, { role: 'super_admin', variant: 'white' })
    );
    assert.ok(htmlSuper.includes('!text-white'), 'SuperAdmin white variant icon must have !text-white');
    assert.ok(!htmlSuper.includes('animate-bell-shake'), 'SuperAdmin white variant must not shake when empty');
  });

  // TEST 3: Popover empty state content and footer status
  runDeepTest('R10-DEEP-3', 'Popover open in empty state renders exact empty message, icon, and status without simulation buttons', () => {
    const mockStorage = createMockStorage();
    global.window = { localStorage: mockStorage };
    global.localStorage = mockStorage;

    const htmlOpen = ReactDOMServer.renderToString(
      React.createElement(NotificationBellOpen, { role: 'admin' })
    );

    // Empty state text & icon
    assert.ok(htmlOpen.includes('Tidak ada notifikasi saat ini.'), 'Empty state text "Tidak ada notifikasi saat ini." missing');
    assert.ok(htmlOpen.includes('notifications_off'), 'Empty state icon "notifications_off" missing');

    // Popover footer
    assert.ok(htmlOpen.includes('Status:'), 'Footer Status: missing');
    assert.ok(htmlOpen.includes('Tidak Ada Notifikasi'), 'Footer status should be "Tidak Ada Notifikasi" when empty');

    // Absence of simulation buttons
    assert.ok(!htmlOpen.includes('Simulasikan Belum Dibaca'), 'Footer must not contain "Simulasikan Belum Dibaca"');
    assert.ok(!htmlOpen.includes('Tandai Semua Dibaca'), 'Header must not show "Tandai Semua Dibaca" when empty');
  });

  // TEST 4: Popover rendering with legitimate unread notifications
  runDeepTest('R10-DEEP-4', 'Popover open with legitimate notifications renders unread badge, shake, items, and Mark-All button', () => {
    const legitNotifs = [
      { id: 'custom-real-1', title: 'Ujian Akhir Semester Dimulai', desc: 'Silakan masuk ke ruang ujian 10 menit sebelum mulai.', time: '10 menit lalu', isRead: false },
      { id: 'custom-real-2', title: 'Perubahan Jam Pengawasan', desc: 'Jadwal pengawasan ruang 04 disesuaikan.', time: '1 jam lalu', isRead: true }
    ];

    const mockStorage = createMockStorage({
      nexa_notifications_guru: JSON.stringify(legitNotifs)
    });
    global.window = { localStorage: mockStorage };
    global.localStorage = mockStorage;

    const htmlOpen = ReactDOMServer.renderToString(
      React.createElement(NotificationBellOpen, { role: 'guru' })
    );

    // Shake & Badge
    assert.ok(htmlOpen.includes('animate-bell-shake'), 'Bell must shake when unread notification exists');
    assert.ok(htmlOpen.includes('bg-rose-500'), 'Red badge must be visible when unread notification exists');
    const cleanHtml = htmlOpen.replace(/<!--.*?-->/g, '');
    assert.ok(cleanHtml.includes('1 Baru'), 'Header must show unread count (1 Baru)');
    assert.ok(cleanHtml.includes('Tandai Semua Dibaca'), 'Header must show "Tandai Semua Dibaca" button when unread exists');

    // Notifications items content
    assert.ok(htmlOpen.includes('Ujian Akhir Semester Dimulai'), 'Item 1 title must be rendered');
    assert.ok(htmlOpen.includes('Perubahan Jam Pengawasan'), 'Item 2 title must be rendered');
    assert.ok(htmlOpen.includes('Silakan masuk ke ruang ujian'), 'Item 1 desc must be rendered');

    // Footer status
    assert.ok(htmlOpen.includes('1 Belum Dibaca'), 'Footer status should show "1 Belum Dibaca"');

    // WCAG accessibility on items
    assert.ok(htmlOpen.includes('role="button"'), 'Notification items must have role="button"');
    assert.ok(htmlOpen.includes('tabindex="0"'), 'Notification items must have tabIndex=0 for keyboard navigation');
  });

  // TEST 5: Defense in depth against corrupted object fields (NO React child crash)
  runDeepTest('R10-DEEP-5', 'Storage with corrupted non-string fields ({title: {}}, {desc: {}}, etc.) is sanitized without React child crashes', () => {
    const corruptedNotifs = [
      { id: 'corrupt-1', title: { message: 'Object title' }, isRead: false },
      { id: 'corrupt-2', title: 'Valid Title', desc: { text: 'Object desc' }, isRead: false },
      { id: 'corrupt-3', title: 'Valid Title 2', time: { time: 123 }, isRead: false },
      { id: 'corrupt-4', title: 'Valid Title 3', icon: { icon: 'star' }, isRead: false },
      { id: '', title: 'Missing ID', isRead: false },
      { id: 'corrupt-6', title: '', isRead: false }
    ];

    const mockStorage = createMockStorage({
      nexa_notifications_admin: JSON.stringify(corruptedNotifs)
    });
    global.window = { localStorage: mockStorage };
    global.localStorage = mockStorage;

    // Must render cleanly without throwing "Objects are not valid as a React child"
    let renderError = null;
    let html = '';
    try {
      html = ReactDOMServer.renderToString(
        React.createElement(NotificationBellOpen, { role: 'admin' })
      );
    } catch (err) {
      renderError = err;
    }

    assert.equal(renderError, null, `Rendering crashed on corrupted storage objects: ${renderError?.message}`);
    // Since all were corrupted/malformed, they must be filtered out and empty state rendered
    assert.ok(html.includes('Tidak ada notifikasi saat ini.'), 'Empty state must be displayed after sanitizing corrupt items');
  });

  // TEST 6: Non-array corrupt cache keys purging
  runDeepTest('R10-DEEP-6', 'Purge cleans non-array payloads (objects, primitives) stored under notification keys', () => {
    const mockStorage = createMockStorage({
      nexa_notifications_admin: JSON.stringify({ error: 'not an array' }),
      nexa_notifications_guru: '12345',
      nexa_notifications_siswa: JSON.stringify('simple string'),
      nexa_notifications_super_admin: JSON.stringify([
        { id: 'real-1', title: 'Pengumuman Super', isRead: false }
      ])
    });
    global.window = { localStorage: mockStorage };
    global.localStorage = mockStorage;

    ReactDOMServer.renderToString(
      React.createElement(NotificationBell, { role: 'admin' })
    );

    // Non-array corrupt keys must be removed
    assert.equal(mockStorage.getItem('nexa_notifications_admin'), null, 'Corrupt object cache must be purged');
    assert.equal(mockStorage.getItem('nexa_notifications_guru'), null, 'Corrupt number cache must be purged');
    assert.equal(mockStorage.getItem('nexa_notifications_siswa'), null, 'Corrupt string cache must be purged');

    // Legitimate array cache must be preserved
    assert.ok(mockStorage.getItem('nexa_notifications_super_admin'), 'Legitimate cache must be preserved');
  });

  // TEST 7: Dynamic key discovery during cache purge
  runDeepTest('R10-DEEP-7', 'Dynamic cache purge removes arbitrary legacy keys matching nexa_notifications_*', () => {
    const mockStorage = createMockStorage({
      nexa_notifications_operator: JSON.stringify([
        { id: 'gen-1', title: 'Sistem CBT NEXA Online' }
      ]),
      nexa_notifications_old_cache: JSON.stringify([
        { id: 'adm-1', title: 'Jadwal Ujian Baru' }
      ]),
      nexa_notifications_custom_role: JSON.stringify([
        { id: 'valid-99', title: 'Pengumuman Penting Kampus' }
      ])
    });
    global.window = { localStorage: mockStorage };
    global.localStorage = mockStorage;

    // Trigger mount and purge
    ReactDOMServer.renderToString(
      React.createElement(NotificationBell, { role: 'admin' })
    );

    // Dummy items in custom role keys must be purged
    assert.equal(mockStorage.getItem('nexa_notifications_operator'), null, 'Operator dummy cache must be purged');
    assert.equal(mockStorage.getItem('nexa_notifications_old_cache'), null, 'Old cache dummy items must be purged');

    // Valid items preserved
    assert.ok(mockStorage.getItem('nexa_notifications_custom_role'), 'Valid items in custom key must be preserved');
  });

  // TEST 8: Mobile viewport boundary responsiveness
  runDeepTest('R10-DEEP-8', 'Popover dropdown includes max-w-[calc(100vw-1.5rem)] to prevent mobile viewport overflow', () => {
    assert.ok(
      bellSource.includes('max-w-[calc(100vw-1.5rem)]') || bellSource.includes('max-w-[calc(100vw-2rem)]'),
      'Popover dropdown must include viewport width constraint to prevent horizontal overflow on mobile'
    );
  });

  // TEST 9: loadSafeNotifications helper behaves correctly with sanitization
  runDeepTest('R10-DEEP-9', 'loadSafeNotifications helper sanitizes dummy items and loads valid notifications', () => {
    const mockStorage = createMockStorage({
      nexa_notifications_test: JSON.stringify([
        { id: 'adm-1', title: 'Jadwal Ujian Baru' },
        { id: 'real-notif-99', title: 'Pemberitahuan Kelulusan', isRead: false }
      ])
    });
    global.window = { localStorage: mockStorage };
    global.localStorage = mockStorage;

    const notifs = loadSafeNotifications('nexa_notifications_test');
    assert.equal(notifs.length, 1, 'Dummy items should be stripped');
    assert.equal(notifs[0].id, 'real-notif-99');
  });

  // TEST 10: Dynamic role switching cache preservation and storage event listener
  runDeepTest('R10-DEEP-10', 'NotificationBell registers window storage listener and handles role state sync safely', () => {
    assert.ok(bellSource.includes('addEventListener(\'storage\''), 'Must register storage event listener for cross-tab sync');
    assert.ok(bellSource.includes('removeEventListener(\'storage\''), 'Must clean up storage event listener on unmount');
    assert.ok(bellSource.includes('activeStorageKeyRef'), 'Must track active storage key to prevent cross-role write races');
  });

} finally {
  // Clean up temp files
  try { fs.unlinkSync(tempFile); } catch {}
  try { fs.unlinkSync(tempOpenFile); } catch {}
}

console.log('\n------------------------------------------------------------------------');
console.log(`TOTAL DEEP TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('========================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL DEEP ADVERSARIAL VERIFICATIONS PASSED!\n');
}
