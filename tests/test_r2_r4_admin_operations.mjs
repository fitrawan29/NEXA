/**
 * Test Suite: Admin Operations Unification & Leaderboard Privacy Setting (R2 & R4)
 * Validates:
 * 1. AdminView.jsx sidebar pruning (removes 'kontrol' and 'soal' from navGroups)
 * 2. Preserves activeTab === 'soal' preview renderer for AI Assistant & KPI card compatibility
 * 3. Retired standalone activeTab === 'kontrol' and navigateTab redirect to 'jadwal'
 * 4. Header bulk operations in activeTab === 'jadwal' ("Mulai Semua", "Hentikan Semua", "Reset Semua")
 * 5. Per-schedule active token display (token_aktif || token || '-'), Rilis Token, and Copy Token
 * 6. Emergency Lock (Browser Lockdown) toggle and visual badge in Desktop Table & Mobile Cards
 * 7. Settings Card 5 "Privasi & Visibilitas Siswa" with Leaderboard toggle in AdminView.jsx
 * 8. getDefaultKopSettings in src/api.js returns tampilkan_leaderboard: true default
 * 9. get_leaderboard in src/api.js respects tampilkan_leaderboard === false
 * 10. package.json has no new external dependencies
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('========================================================================');
console.log('   TEST SUITE: ADMIN OPERATIONS & LEADERBOARD PRIVACY SETTING (R2 & R4)   ');
console.log('========================================================================\n');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    failCount++;
  }
}

// ---------------------------------------------------------
// [SECTION 1] Architecture & Dependencies
// ---------------------------------------------------------
console.log('--- [SECTION 1] Architecture & Package Constraints ---');

test('[Package] Zero new heavy dependencies in package.json', () => {
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = Object.keys(pkg.dependencies || {});
  assert.ok(!deps.includes('zustand'), 'Should not add external state manager');
  assert.ok(!deps.includes('formik'), 'Should not add external form library');
  assert.ok(!deps.includes('clipboard'), 'Should use native clipboard API');
});

// ---------------------------------------------------------
// [SECTION 2] API Contracts & Settings Default (src/api.js)
// ---------------------------------------------------------
console.log('\n--- [SECTION 2] API Settings Defaults & Privacy Guard (src/api.js) ---');

const apiContent = fs.readFileSync(path.join(rootDir, 'src', 'api.js'), 'utf8');

test('[API] getDefaultKopSettings includes tampilkan_leaderboard with true fallback', async () => {
  const { getDefaultKopSettings } = await import('../src/api.js');
  const defaultSettings = getDefaultKopSettings({});
  assert.strictEqual(defaultSettings.tampilkan_leaderboard, true, 'Default must be true');

  const customTrue = getDefaultKopSettings({ tampilkan_leaderboard: true });
  assert.strictEqual(customTrue.tampilkan_leaderboard, true);

  const customFalse = getDefaultKopSettings({ tampilkan_leaderboard: false });
  assert.strictEqual(customFalse.tampilkan_leaderboard, false, 'Must respect explicit false');
});

test('[API] get_leaderboard checks school settings privacy for disabled leaderboard', () => {
  assert.ok(apiContent.includes("case 'get_leaderboard':"), 'Must contain get_leaderboard handler');
  assert.ok(apiContent.includes('tampilkan_leaderboard === false'), 'Must check tampilkan_leaderboard === false');
  assert.ok(apiContent.includes("disabled: true"), 'Must return disabled flag when privacy disabled');
});

// ---------------------------------------------------------
// [SECTION 3] AdminView.jsx Sidebar Pruning & Navigation (R2)
// ---------------------------------------------------------
console.log('\n--- [SECTION 3] AdminView.jsx Sidebar Pruning & Routing (R2) ---');

const adminContent = fs.readFileSync(path.join(rootDir, 'src', 'views', 'AdminView.jsx'), 'utf8');

test('[AdminNav] navGroups removes "kontrol" and "soal" from Ujian & Pelaksanaan', () => {
  // Extract Ujian & Pelaksanaan group from navGroups
  const navGroupMatch = adminContent.match(/title:\s*['"]Ujian & Pelaksanaan['"][\s\S]*?items:\s*\[([\s\S]*?)\]\s*\},/);
  assert.ok(navGroupMatch, 'Must find Ujian & Pelaksanaan navGroup');
  const groupItems = navGroupMatch[1];
  
  assert.ok(!groupItems.includes("'kontrol'"), 'navGroup must not contain kontrol');
  assert.ok(!groupItems.includes("'soal'"), 'navGroup must not contain soal');
  assert.ok(groupItems.includes("'jadwal'"), 'navGroup must contain jadwal');
  assert.ok(groupItems.includes("'pengawas'"), 'navGroup must contain pengawas');
  assert.ok(groupItems.includes("'skema'"), 'navGroup must contain skema');
});

test('[AdminNav] navigateTab redirects "kontrol" to "jadwal"', () => {
  assert.ok(
    adminContent.includes("tabId === 'kontrol' ? 'jadwal' : tabId"),
    'navigateTab must redirect kontrol to jadwal'
  );
});

test('[AdminNav] activeTab === "soal" is preserved for Assistant and KPI card compatibility', () => {
  assert.ok(
    adminContent.includes("activeTab === 'soal'"),
    'activeTab === soal renderer must be preserved'
  );
  assert.ok(
    adminContent.includes("tabTitleMap ="),
    'tabTitleMap must exist'
  );
  assert.ok(
    adminContent.includes("soal: 'Bank Soal (Preview)'"),
    'tabTitleMap must keep soal mapping for direct navigation'
  );
});

test('[AdminNav] Standalone activeTab === "kontrol" section is retired', () => {
  assert.ok(
    !adminContent.includes("{activeTab === 'kontrol' && ("),
    'Standalone activeTab === kontrol block must be removed'
  );
});

// ---------------------------------------------------------
// [SECTION 4] Unified Jadwal Operations (R2)
// ---------------------------------------------------------
console.log('\n--- [SECTION 4] Unified Jadwal Operations in AdminView.jsx (R2) ---');

test('[JadwalBulk] Header includes bulk operational controls (Mulai Semua, Hentikan Semua, Reset Semua)', () => {
  assert.ok(adminContent.includes("handleBulkUpdateStatusUjian('AKTIF')"), 'Must have Mulai Semua button');
  assert.ok(adminContent.includes("handleBulkUpdateStatusUjian('SELESAI')"), 'Must have Hentikan Semua button');
  assert.ok(adminContent.includes("handleBulkUpdateStatusUjian('BELUM MULAI')"), 'Must have Reset Semua button');
  assert.ok(adminContent.includes('Mulai Semua'), 'Label Mulai Semua must exist');
  assert.ok(adminContent.includes('Hentikan Semua'), 'Label Hentikan Semua must exist');
  assert.ok(adminContent.includes('Reset Semua'), 'Label Reset Semua must exist');
});

test('[JadwalToken] Desktop Table & Mobile Cards display active token with token_aktif fallback', () => {
  assert.ok(adminContent.includes('j.token_aktif || j.token || \'-\''), 'Must display active token with fallback');
});

test('[JadwalToken] handleRilisToken and handleCopyToken handlers exist and update state', () => {
  assert.ok(adminContent.includes('const handleRilisToken = async (id_jadwal) =>'), 'handleRilisToken must exist');
  assert.ok(adminContent.includes('token_aktif: newToken'), 'Must update token_aktif on release');
  assert.ok(adminContent.includes('last_update_token: nowIso'), 'Must update last_update_token timestamp');
  assert.ok(adminContent.includes('const handleCopyToken = (tokenText) =>'), 'handleCopyToken must exist');
  assert.ok(adminContent.includes('navigator.clipboard.writeText'), 'Must use clipboard API');
});

test('[JadwalLockdown] Emergency Lock (Browser Lockdown) toggle and badge are implemented', () => {
  assert.ok(adminContent.includes('const handleToggleLockdown = async (id_jadwal, currentLockState) =>'), 'handleToggleLockdown must exist');
  assert.ok(adminContent.includes('browser_lockdown: nextState'), 'Must update browser_lockdown via update_jadwal');
  assert.ok(adminContent.includes('Lockdown Aktif'), 'Lockdown Aktif badge must exist');
  assert.ok(adminContent.includes('Lockdown Bebas'), 'Lockdown Bebas badge must exist');
});

// ---------------------------------------------------------
// [SECTION 5] Leaderboard Privacy Setting (R4)
// ---------------------------------------------------------
console.log('\n--- [SECTION 5] Leaderboard Privacy Setting in AdminView.jsx (R4) ---');

test('[SettingsUI] Card 5 "Privasi & Visibilitas Siswa" exists in activeTab === "pengaturan"', () => {
  assert.ok(adminContent.includes('Privasi & Visibilitas Siswa'), 'Must include Privasi & Visibilitas Siswa card');
  assert.ok(adminContent.includes('Tampilkan Papan Peringkat (Leaderboard) di Portal Siswa'), 'Must include toggle label');
  assert.ok(adminContent.includes('tampilkan_leaderboard: !currentVal'), 'Toggle must update kopSettings.tampilkan_leaderboard');
  assert.ok(adminContent.includes('kopSettings.tampilkan_leaderboard !== false'), 'Must bind to kopSettings.tampilkan_leaderboard !== false');
});

test('[SettingsUI] handleSaveKopSettings persists kopSettings including tampilkan_leaderboard', () => {
  assert.ok(adminContent.includes('handleSaveKopSettings'), 'handleSaveKopSettings must exist');
  assert.ok(adminContent.includes('save_pengaturan_sekolah(targetNpsn, payloadToSave)'), 'Must call save_pengaturan_sekolah with payload');
});

// ---------------------------------------------------------
// Summary
// ---------------------------------------------------------
console.log('\n========================================================================');
console.log(`TEST SUMMARY: ${passCount} Passed, ${failCount} Failed (Total: ${passCount + failCount})`);
console.log('========================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL R2 & R4 ADMIN OPERATIONS & PRIVACY TESTS PASSED 100%!\n');
}
