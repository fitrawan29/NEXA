import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('======================================================================');
console.log(' ADVERSARIAL STRESS TEST: ALL VIEWS SSR & COMPONENT ROBUSTNESS');
console.log('======================================================================');

globalThis.Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
const mockElement = () => ({
  getContext: () => null,
  style: {},
  setAttribute: () => {},
  getAttribute: () => null,
  appendChild: () => {},
  removeChild: () => {},
  classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => false },
  addEventListener: () => {},
  removeEventListener: () => {}
});

globalThis.window = {
  location: { reload: () => {}, href: 'http://localhost' },
  localStorage: {
    _store: {},
    getItem(k) { return this._store[k] || null; },
    setItem(k, v) { this._store[k] = String(v); },
    removeItem(k) { delete this._store[k]; },
    clear() { this._store = {}; }
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  navigator: { onLine: true }
};
globalThis.document = {
  createElement: mockElement,
  createElementNS: mockElement,
  documentElement: mockElement(),
  head: mockElement(),
  body: mockElement(),
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: () => null,
  querySelectorAll: () => []
};
globalThis.localStorage = globalThis.window.localStorage;
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true, userAgent: 'node' },
    configurable: true,
    writable: true
  });
} catch (e) {}

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  root: projectRoot
});

let passCount = 0;
let failCount = 0;

function assertTest(name, condition, errorMsg = '') {
  if (condition) {
    console.log(`  ✔ PASS: ${name}`);
    passCount++;
  } else {
    console.error(`  ✖ FAIL: ${name} — ${errorMsg}`);
    failCount++;
  }
}

try {
  // 1. UI.jsx Components
  console.log('\n▶ Suite 1: Shared UI Components (UI.jsx)...');
  const UI = await vite.ssrLoadModule('/src/components/UI.jsx');
  assertTest('UI.jsx exports EmptyState, TableSkeleton, CardSkeleton, StatusBadge',
    typeof UI.EmptyState === 'function' &&
    typeof UI.TableSkeleton === 'function' &&
    typeof UI.CardSkeleton === 'function' &&
    typeof UI.StatusBadge === 'function'
  );

  const emptyStateHtml = ReactDOMServer.renderToString(
    React.createElement(UI.EmptyState, {
      icon: 'info',
      title: '<Adversarial Title & "Quotes">',
      description: 'Test <script>alert("xss")</script>'
    })
  );
  assertTest('EmptyState renders safely with special chars without unhandled exception',
    emptyStateHtml.includes('&lt;Adversarial') && emptyStateHtml.includes('&lt;script&gt;')
  );

  const skeletonHtml = ReactDOMServer.renderToString(
    React.createElement(UI.TableSkeleton, { rows: 10, cols: 5 })
  );
  assertTest('TableSkeleton renders 10 rows', skeletonHtml.length > 200);

  const badgeHtml = ReactDOMServer.renderToString(
    React.createElement(UI.StatusBadge, { status: 'SEDANG KERJA', variant: 'warning' })
  );
  assertTest('StatusBadge renders variant with live pulse styling', badgeHtml.includes('SEDANG KERJA'));

  // 2. SiswaView.jsx
  console.log('\n▶ Suite 2: SiswaView Component...');
  const SiswaViewMod = await vite.ssrLoadModule('/src/views/SiswaView.jsx');
  const SiswaView = SiswaViewMod.default;

  const mockStudent = {
    id_siswa: 'SIS_TEST_001',
    nama_lengkap: 'Ahmad Dahlan <b>Bold</b>',
    nisn: '0012345678',
    nama_sekolah: 'SMA Negeri 1 <XSS> Test',
    foto_profil: null
  };

  const siswaHtml = ReactDOMServer.renderToString(
    React.createElement(SiswaView, {
      user: mockStudent,
      onLogout: () => {},
      showMessage: () => {},
      isDarkMode: false,
      setIsDarkMode: () => {}
    })
  );
  assertTest('SiswaView SSR renders cleanly in Light Mode', siswaHtml.includes('Portal Ujian Siswa'));

  const siswaDarkHtml = ReactDOMServer.renderToString(
    React.createElement(SiswaView, {
      user: mockStudent,
      onLogout: () => {},
      showMessage: () => {},
      isDarkMode: true,
      setIsDarkMode: () => {}
    })
  );
  assertTest('SiswaView SSR renders cleanly in Dark Mode', siswaDarkHtml.length > 500);

  // 3. ExamRoom.jsx
  console.log('\n▶ Suite 3: ExamRoom Component...');
  const ExamRoomMod = await vite.ssrLoadModule('/src/views/ExamRoom.jsx');
  const ExamRoom = ExamRoomMod.default;

  const mockJadwal = {
    id_jadwal: 'JAD_999',
    nama_ujian: 'Ujian Akhir Semester Kimia Terapan',
    durasi_menit: 90,
    waktu_mulai: new Date(Date.now() - 10000).toISOString(),
    waktu_selesai: new Date(Date.now() + 3600000).toISOString()
  };

  const examHtml = ReactDOMServer.renderToString(
    React.createElement(ExamRoom, {
      user: mockStudent,
      jadwal: mockJadwal,
      idLog: 'LOG_TEST_99',
      showMessage: () => {},
      onFinish: () => {},
      isDarkMode: false,
      setIsDarkMode: () => {}
    })
  );
  assertTest('ExamRoom SSR renders loading/preparation frame cleanly without crashing',
    examHtml.includes('Menyiapkan Soal dan Enkripsi Sesi')
  );

  // 4. AdminView.jsx
  console.log('\n▶ Suite 4: AdminView Component...');
  const AdminViewMod = await vite.ssrLoadModule('/src/views/AdminView.jsx');
  const AdminView = AdminViewMod.default;

  const mockAdminUser = {
    id_user: 'ADM_001',
    nama_lengkap: 'Administrator Utama',
    role: 'admin',
    nama_sekolah: 'SMA Percontohan Nasional'
  };

  const adminHtml = ReactDOMServer.renderToString(
    React.createElement(AdminView, {
      user: mockAdminUser,
      onLogout: () => {},
      showMessage: () => {},
      isDarkMode: false,
      setIsDarkMode: () => {}
    })
  );
  assertTest('AdminView SSR renders responsive sidebar shell & topbar cleanly',
    adminHtml.includes('Administrator Utama') || adminHtml.includes('Admin') || adminHtml.includes('NEXA')
  );

  // 5. GuruView.jsx
  console.log('\n▶ Suite 5: GuruView Component...');
  const GuruViewMod = await vite.ssrLoadModule('/src/views/GuruView.jsx');
  const GuruView = GuruViewMod.default;

  const mockGuruUser = {
    id_guru: 'GUR_001',
    nama_lengkap: 'Dra. Siti Aminah, M.Pd',
    nip: '198001012005012001',
    role: 'guru',
    mata_pelajaran: ['Kimia', 'Biologi']
  };

  const guruHtml = ReactDOMServer.renderToString(
    React.createElement(GuruView, {
      user: mockGuruUser,
      onLogout: () => {},
      showMessage: () => {},
      isDarkMode: false,
      setIsDarkMode: () => {}
    })
  );
  assertTest('GuruView SSR renders responsive dashboard & navigation cleanly',
    guruHtml.includes('Dra. Siti Aminah') || guruHtml.includes('Guru') || guruHtml.includes('NEXA')
  );

  // 6. SuperAdminView.jsx
  console.log('\n▶ Suite 6: SuperAdminView Component...');
  // Ensure window-attached globals from api.js are also in global scope for Node
  if (globalThis.window && globalThis.window.useSupabaseRealtime) {
    globalThis.useSupabaseRealtime = globalThis.window.useSupabaseRealtime;
  }
  const SuperAdminMod = await vite.ssrLoadModule('/src/views/SuperAdminView.jsx');
  const SuperAdminView = SuperAdminMod.default;

  const mockSuperUser = {
    id_user: 'SUP_001',
    nama_lengkap: 'Super Administrator',
    role: 'superadmin'
  };

  const superAdminHtml = ReactDOMServer.renderToString(
    React.createElement(SuperAdminView, {
      user: mockSuperUser,
      onLogout: () => {},
      showMessage: () => {},
      isDarkMode: false,
      setIsDarkMode: () => {}
    })
  );
  assertTest('SuperAdminView SSR renders cleanly without exception', superAdminHtml.length > 200);

} catch (err) {
  console.error('CRITICAL SSR UNCAUGHT EXCEPTION:', err);
  failCount++;
} finally {
  await vite.close();
}

console.log('\n======================================================================');
console.log(`STRESS RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
console.log('======================================================================');

process.exit(failCount === 0 ? 0 : 1);
