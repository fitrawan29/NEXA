import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve(process.cwd(), 'src');
const apiCode = fs.readFileSync(path.join(srcDir, 'api.js'), 'utf8');
const appCode = fs.readFileSync(path.join(srcDir, 'App.jsx'), 'utf8');
const saCode = fs.readFileSync(path.join(srcDir, 'views/SuperAdminView.jsx'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}\n  ${err.message}`);
    failed++;
  }
}

test('api.js login rejects SUSPENDED sekolah and avoids raw .or() interpolation for guru', () => {
  const loginBlock = apiCode.slice(apiCode.indexOf("case 'login':"), apiCode.indexOf("case 'heartbeat_siswa':"));
  assert.match(loginBlock, /SUSPENDED/, 'login must check sekolah.status === SUSPENDED');
  assert.doesNotMatch(loginBlock, /\.or\(`username\.eq\.\$\{loginId\},nip\.eq\.\$\{loginId\}`\)/, 'guru login must not interpolate raw loginId into .or()');
});

test('api.js register branches properly by role (siswa vs guru) without writing identitas to id_siswa', () => {
  const regBlock = apiCode.slice(apiCode.indexOf("case 'register':"), apiCode.indexOf("case 'update_superadmin_password':"));
  assert.match(regBlock, /payload\.role\s*===\s*'guru'/, 'register must support guru role');
  assert.doesNotMatch(regBlock, /id_siswa:\s*payload\.identitas/, 'must not write NISN into id_siswa');
});

test('api.js get_analytics avoids N+1 per-school queries and excludes metadata rows', () => {
  const block = apiCode.slice(apiCode.indexOf("case 'get_analytics':"), apiCode.indexOf("case 'get_pengumuman_global':"));
  assert.doesNotMatch(block, /sekolahData\.map\(async/, 'get_analytics must not do N+1 queries per school');
  assert.match(block, /SKEMA_PENILAIAN/, 'get_analytics must exclude metadata rows from soal_ujian count');
});

test('api.js reset_all_data targets real Supabase tables in child-before-parent order', () => {
  const block = apiCode.slice(apiCode.indexOf("case 'reset_all_data':"), apiCode.indexOf("case 'get_admin_dashboard_data':"));
  assert.doesNotMatch(block, /'log_aktivitas'|'siswa_jawaban'|'siswa_ujian'|'jadwal_ujian'/, 'must not target non-existent tables');
  assert.match(block, /'jawaban_siswa'/, 'must delete jawaban_siswa');
  assert.match(block, /'log_ujian'/, 'must delete log_ujian');
});

test('App.jsx extracts cleanNpsn helper, resets loginError on Ganti, and resets loginRole on handleLogout', () => {
  assert.match(appCode, /const cleanNpsn\s*=/, 'App.jsx should define cleanNpsn helper');
  assert.match(appCode, /setLoginRole\(''\);\s*setLoginError\(''\)/, 'Ganti/Logout should clear loginError');
});

test('SuperAdminView.jsx fixes tab akun guard, modal layout, sekolah status toggle, reset_all_data wiring, and password state', () => {
  assert.doesNotMatch(saCode, /if \(tab === 'profil'\) return;/, 'fetchData must check akun not profil');
  assert.doesNotMatch(saCode, /document\.getElementById\('new_superadmin_password'\)/, 'must use React state instead of document.getElementById');
  assert.match(saCode, /update_sekolah_status/, 'SuperAdminView must wire update_sekolah_status');
  assert.match(saCode, /reset_all_data/, 'SuperAdminView must wire reset_all_data');
  assert.doesNotMatch(saCode, /<form onSubmit=\{handleSaveForm\} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">/, 'modal form must not squeeze 3 columns into max-w-md');
});

test('api.js heartbeat_siswa uses getTrueNow() and reset_login_siswa guards active multi-device UUID', () => {
  const hbBlock = apiCode.slice(apiCode.indexOf("case 'heartbeat_siswa':"), apiCode.indexOf("case 'register':"));
  assert.match(hbBlock, /getTrueNow/, 'heartbeat_siswa must refresh session timestamp with getTrueNow');
  assert.doesNotMatch(hbBlock, /Date\.now\(\)/, 'heartbeat_siswa must not use skewed client Date.now()');
  const resetBlock = apiCode.slice(apiCode.indexOf("case 'reset_login_siswa':"), apiCode.indexOf("case 'reset_all_login_siswa':"));
  assert.match(resetBlock, /payload\.session_token[\s\S]*dbUuid\s*!==\s*payloadUuid/, 'reset_login_siswa must not clear newer session from another device');
});

console.log(`\nSummary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
