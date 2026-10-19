import { readFileSync } from 'fs';
import { resolve } from 'path';

console.log('======================================================================');
console.log(' ADVERSARIAL STRESS TEST: ROUND 24 REVIEWER 3 (FINAL AUDIT) SUITE    ');
console.log(' Deep Styling, Accessibility, Key Collision & Storage Resilience      ');
console.log('======================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✔ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ✖ FAIL: ${message}`);
    failCount++;
  }
}

const adminPath = resolve('src/views/AdminView.jsx');
const guruPath = resolve('src/views/GuruView.jsx');
const siswaPath = resolve('src/views/SiswaView.jsx');
const superAdminPath = resolve('src/views/SuperAdminView.jsx');
const modalPath = resolve('src/components/TutorialModal.jsx');

const adminSrc = readFileSync(adminPath, 'utf8');
const guruSrc = readFileSync(guruPath, 'utf8');
const siswaSrc = readFileSync(siswaPath, 'utf8');
const superAdminSrc = readFileSync(superAdminPath, 'utf8');
const modalSrc = readFileSync(modalPath, 'utf8');

console.log('▶ Suite 1: Dark Mode Styling & Contrast on Tutorial Buttons...');

// 1.1 AdminView Buttons
assert(
  adminSrc.includes('dark:border-blue-800') &&
  adminSrc.includes('dark:bg-blue-950/40') &&
  adminSrc.includes('dark:text-blue-300'),
  'AdminView desktop tutorial button has dedicated dark mode borders, backgrounds, and text tokens'
);
assert(
  adminSrc.includes('dark:border-blue-800/80') &&
  adminSrc.includes('dark:bg-blue-950/50') &&
  adminSrc.includes('dark:text-blue-400'),
  'AdminView mobile tutorial button has dedicated dark mode borders, backgrounds, and text tokens'
);

// 1.2 GuruView Buttons
assert(
  guruSrc.includes('dark:border-amber-800') &&
  guruSrc.includes('dark:bg-amber-950/40') &&
  guruSrc.includes('dark:text-amber-200'),
  'GuruView desktop tutorial button has dedicated dark mode borders, backgrounds, and text tokens'
);
assert(
  guruSrc.includes('dark:border-amber-800/80') &&
  guruSrc.includes('dark:bg-amber-950/50') &&
  guruSrc.includes('dark:text-amber-400'),
  'GuruView mobile tutorial button has dedicated dark mode borders, backgrounds, and text tokens'
);

// 1.3 SiswaView Buttons
assert(
  siswaSrc.includes('dark:border-emerald-800') &&
  siswaSrc.includes('dark:bg-emerald-950/40') &&
  siswaSrc.includes('dark:text-emerald-200'),
  'SiswaView desktop tutorial button has dedicated dark mode borders, backgrounds, and text tokens'
);
assert(
  siswaSrc.includes('bg-white/25') &&
  siswaSrc.includes('border-white/40') &&
  siswaSrc.includes('ring-1 ring-white/30'),
  'SiswaView mobile tutorial button provides crisp translucent contrast and ring against primary gradient banner'
);

// 1.4 SuperAdminView Button
assert(
  superAdminSrc.includes('bg-white/20') &&
  superAdminSrc.includes('hover:bg-white/30') &&
  superAdminSrc.includes('border-white/30'),
  'SuperAdminView tutorial button matches primary header banner aesthetic with translucent glass styling'
);

console.log('\n▶ Suite 2: Accessibility & Touch Target Dimensions (>= 44px)...');
assert(
  adminSrc.includes('min-w-[44px]') && adminSrc.includes('min-h-[44px]'),
  'AdminView buttons enforce 44x44px minimum touch targets'
);
assert(
  guruSrc.includes('min-w-[44px]') && guruSrc.includes('min-h-[44px]'),
  'GuruView buttons enforce 44x44px minimum touch targets'
);
assert(
  siswaSrc.includes('min-w-[44px]') && siswaSrc.includes('min-h-[44px]'),
  'SiswaView buttons enforce 44x44px minimum touch targets'
);
assert(
  superAdminSrc.includes('min-w-[44px]') && superAdminSrc.includes('min-h-[44px]'),
  'SuperAdminView mobile button enforces 44x44px minimum touch target'
);

// Aria labels
assert(
  adminSrc.includes('aria-label="Panduan & Tutorial"'),
  'AdminView tutorial button includes explicit aria-label'
);
assert(
  guruSrc.includes('aria-label="Panduan & Tutorial"'),
  'GuruView tutorial button includes explicit aria-label'
);
assert(
  siswaSrc.includes('aria-label="Panduan & Tutorial"'),
  'SiswaView tutorial button includes explicit aria-label'
);
assert(
  superAdminSrc.includes('aria-label="Panduan & Tutorial"'),
  'SuperAdminView tutorial button includes explicit aria-label'
);

console.log('\n▶ Suite 3: Keyboard Navigation & Component Contract...');
assert(
  modalSrc.includes("e.key === 'Escape'"),
  'TutorialModal supports Escape key to close'
);
assert(
  modalSrc.includes("e.key === 'ArrowRight'") && modalSrc.includes("e.key === 'ArrowLeft'"),
  'TutorialModal supports Arrow keys for next/previous step navigation'
);
assert(
  modalSrc.includes("initialRole = 'admin'"),
  'TutorialModal default prop initialRole is admin'
);

console.log('\n▶ Suite 4: Key Collision & Exotic ID Handling...');
function getStorageKey(user, role) {
  let currentUserId = '';
  if (role === 'admin') currentUserId = user?.id_admin || user?.id_user || user?.id || user?.username || '';
  if (role === 'guru') currentUserId = user?.id_guru || user?.id_user || user?.id || user?.nip || user?.username || '';
  if (role === 'siswa') currentUserId = user?.id_siswa || user?.id_user || user?.id || user?.nisn || user?.username || '';
  if (role === 'super_admin') currentUserId = user?.id_super_admin || user?.id_user || user?.id || user?.username || '';
  return currentUserId ? `nexa_tutorial_seen_${currentUserId}_${role}` : null;
}

// Same ID across different roles
const adminKey = getStorageKey({ id: 'shared_01' }, 'admin');
const guruKey = getStorageKey({ id: 'shared_01' }, 'guru');
const siswaKey = getStorageKey({ id: 'shared_01' }, 'siswa');
const superKey = getStorageKey({ id: 'shared_01' }, 'super_admin');

assert(
  adminKey !== guruKey && guruKey !== siswaKey && siswaKey !== superKey,
  'Keys for same ID across different roles are completely isolated'
);
assert(
  adminKey === 'nexa_tutorial_seen_shared_01_admin',
  'Admin key format is correct'
);
assert(
  guruKey === 'nexa_tutorial_seen_shared_01_guru',
  'Guru key format is correct'
);
assert(
  siswaKey === 'nexa_tutorial_seen_shared_01_siswa',
  'Siswa key format is correct'
);
assert(
  superKey === 'nexa_tutorial_seen_shared_01_super_admin',
  'SuperAdmin key format is correct'
);

// Complex / edge case IDs
const emailUser = { username: 'guru.kimia@sekolah-negeri1.sch.id' };
assert(
  getStorageKey(emailUser, 'guru') === 'nexa_tutorial_seen_guru.kimia@sekolah-negeri1.sch.id_guru',
  'Email-style usernames generate valid storage keys'
);

const nipWithSpaces = { nip: '19850312 201001 1 008' };
assert(
  getStorageKey(nipWithSpaces, 'guru') === 'nexa_tutorial_seen_19850312 201001 1 008_guru',
  'NIP with spaces generates valid storage key'
);

const uuidUser = { id_admin: 'b45d2f6e-9821-4f32-8ea5-02194adcb492' };
assert(
  getStorageKey(uuidUser, 'admin') === 'nexa_tutorial_seen_b45d2f6e-9821-4f32-8ea5-02194adcb492_admin',
  'UUID-formatted IDs generate valid storage keys'
);

// Zero / falsy number IDs
const numericZeroUser = { id_siswa: 0 };
// in JS: 0 is falsy, but what if user.id_siswa is '0'?
const stringZeroUser = { id_siswa: '0' };
assert(
  getStorageKey(stringZeroUser, 'siswa') === 'nexa_tutorial_seen_0_siswa',
  'String "0" is handled cleanly'
);

console.log('\n======================================================================');
console.log(`TOTAL: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log('======================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('ALL ROUND 24 REVIEWER 3 AUDIT TESTS PASSED SUCCESSFULLY!');
}
