import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message} ${details ? '(' + details + ')' : ''}`);
  }
}

console.log('================================================================');
console.log('  ROUND 25: STEP-BY-STEP TUTORIAL CONTENT & BADGES VERIFICATION ');
console.log('================================================================\n');

// -------------------------------------------------------------------------
// Test Suite 1: Architecture & Package.json Constraints (Ponytail)
// -------------------------------------------------------------------------
console.log('Suite 1: Architecture Constraints & Zero New Dependencies');
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

assert(
  !pkg.dependencies['intro.js'] &&
  !pkg.dependencies['driver.js'] &&
  !pkg.dependencies['shepherd.js'] &&
  !pkg.dependencies['react-joyride'] &&
  !pkg.dependencies['marked'],
  'package.json has NO new external tutorial or markdown libraries'
);

// -------------------------------------------------------------------------
// Test Suite 2: Component Structure & Step Badges in TutorialModal.jsx
// -------------------------------------------------------------------------
console.log('\nSuite 2: Component Structure & Step Badge Rendering');
const modalPath = path.join(rootDir, 'src', 'components', 'TutorialModal.jsx');
const modalContent = fs.readFileSync(modalPath, 'utf8');

assert(
  modalContent.includes("const TutorialModal = ({ isOpen, initialRole = 'admin', onClose }) => {"),
  'TutorialModal signature remains intact'
);

assert(
  modalContent.includes('renderFormattedText') &&
  modalContent.includes('parts.map('),
  'TutorialModal contains renderFormattedText helper for visual UI chip emphasis'
);

assert(
  modalContent.includes('Langkah {stepNum}') &&
  modalContent.includes('currentRoleTheme.bgActive'),
  'TutorialModal renders visual step badge (Langkah {stepNum}) with high-contrast role theme bgActive'
);

// -------------------------------------------------------------------------
// Test Suite 3: Vite SSR Module Import & TUTORIAL_DATA Extraction
// -------------------------------------------------------------------------
console.log('\nSuite 3: Vite SSR Loading & TUTORIAL_DATA Structure');

let vite;
try {
  vite = await createServer({
    root: rootDir,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  const tutModule = await vite.ssrLoadModule('/src/components/TutorialModal.jsx');
  assert(tutModule.default !== undefined, 'TutorialModal component loads cleanly via Vite SSR');
} finally {
  if (vite) await vite.close();
}

// -------------------------------------------------------------------------
// Test Suite 4: Step-by-Step Explicit Numbering (Langkah 1, Langkah 2, ...)
// -------------------------------------------------------------------------
console.log('\nSuite 4: Step-by-Step Explicit Numbering in All 4 Roles');

// Extract TUTORIAL_DATA from source code for rigorous inspection
const dataMatch = modalContent.match(/const TUTORIAL_DATA\s*=\s*(\{[\s\S]*?\n\};)/);
assert(dataMatch !== null, 'TUTORIAL_DATA object exists and is extractable');

let tutorialData;
try {
  // Safe evaluation of the object literal
  const cleanDataStr = dataMatch[1].replace(/;\s*$/, '');
  tutorialData = new Function(`return ${cleanDataStr}`)();
} catch (e) {
  assert(false, 'TUTORIAL_DATA parsed successfully', e.message);
}

const roles = ['admin', 'guru', 'siswa', 'super_admin'];
assert(
  roles.every(r => Array.isArray(tutorialData[r])),
  'All 4 roles exist in TUTORIAL_DATA: admin, guru, siswa, super_admin'
);

assert(tutorialData.admin.length === 5, `Admin has exactly 5 steps (found ${tutorialData.admin.length})`);
assert(tutorialData.guru.length === 6, `Guru has exactly 6 steps (found ${tutorialData.guru.length})`);
assert(tutorialData.siswa.length === 6, `Siswa has exactly 6 steps (found ${tutorialData.siswa.length})`);
assert(tutorialData.super_admin.length === 4, `Super Admin has exactly 4 steps (found ${tutorialData.super_admin.length})`);

// Verify that EVERY single point in EVERY step across ALL roles starts with "Langkah X:"
let allPointsHaveStepLabel = true;
let totalPointsCount = 0;

for (const role of roles) {
  const steps = tutorialData[role];
  steps.forEach((step, sIdx) => {
    assert(Array.isArray(step.points) && step.points.length >= 2, `${role} step ${sIdx + 1} (${step.shortTitle}) has >= 2 points`);
    step.points.forEach((pt, pIdx) => {
      totalPointsCount++;
      const expectedLabel = `Langkah ${pIdx + 1}:`;
      if (!pt.startsWith(expectedLabel)) {
        allPointsHaveStepLabel = false;
        console.error(`    Mismatch in ${role} step ${sIdx + 1} point ${pIdx + 1}: Expected "${expectedLabel}", got "${pt.slice(0, 20)}..."`);
      }
    });
  });
}

assert(
  allPointsHaveStepLabel,
  `All ${totalPointsCount} points across all 4 roles start with explicit "Langkah X:" label`
);

// -------------------------------------------------------------------------
// Test Suite 5: Admin Real Menu & Feature Mapping (R2)
// -------------------------------------------------------------------------
console.log('\nSuite 5: Admin View Menu & Feature Mapping (R2)');
const adminText = JSON.stringify(tutorialData.admin);

assert(adminText.includes('Data Siswa'), 'Admin guide references "Data Siswa"');
assert(adminText.includes('Data Guru'), 'Admin guide references "Data Guru"');
assert(adminText.includes('Mata Pelajaran'), 'Admin guide references "Mata Pelajaran"');
assert(adminText.includes('Manajemen Kelas'), 'Admin guide references "Manajemen Kelas"');
assert(adminText.includes('Download Template'), 'Admin guide references "Download Template"');
assert(adminText.includes('Import Excel'), 'Admin guide references "Import Excel"');

assert(adminText.includes('Jadwal Ujian'), 'Admin guide references "Jadwal Ujian"');
assert(adminText.includes('+ Buat Jadwal'), 'Admin guide references "+ Buat Jadwal"');
assert(adminText.includes('auto-select guru pengampu'), 'Admin guide references "auto-select guru pengampu"');

assert(adminText.includes('Pengaturan / Profil Sekolah'), 'Admin guide references "Pengaturan / Profil Sekolah"');
assert(adminText.includes('Alamat Sekolah'), 'Admin guide references "Alamat Sekolah"');
assert(adminText.includes('Logo Dinas'), 'Admin guide references "Logo Dinas"');
assert(adminText.includes('Logo Sekolah'), 'Admin guide references "Logo Sekolah"');
assert(adminText.includes('Live Preview Kop'), 'Admin guide references "Live Preview Kop"');

assert(adminText.includes('Kontrol Ujian'), 'Admin guide references "Kontrol Ujian"');
assert(adminText.includes('HUD'), 'Admin guide references "HUD"');
assert(adminText.includes('Reset Sesi'), 'Admin guide references "Reset Sesi"');
assert(adminText.includes('Buka Blokir'), 'Admin guide references "Buka Blokir"');

assert(adminText.includes('Cetak Kartu Peserta'), 'Admin guide references "Cetak Kartu Peserta"');
assert(adminText.includes('Cetak Kartu Meja'), 'Admin guide references "Cetak Kartu Meja"');
assert(adminText.includes('Cetak Dokumen'), 'Admin guide references "Cetak Dokumen"');
assert(adminText.includes('Berita Acara'), 'Admin guide references "Berita Acara"');
assert(adminText.includes('Daftar Hadir'), 'Admin guide references "Daftar Hadir"');
assert(adminText.includes('Room Picker'), 'Admin guide references "Room Picker"');

// -------------------------------------------------------------------------
// Test Suite 6: Guru Real Menu & Feature Mapping (R3)
// -------------------------------------------------------------------------
console.log('\nSuite 6: Guru View Menu & Feature Mapping (R3)');
const guruText = JSON.stringify(tutorialData.guru);

assert(guruText.includes('Beranda Guru'), 'Guru guide references "Beranda Guru"');
assert(guruText.includes('Jadwal Mengajar'), 'Guru guide references "Jadwal Mengajar"');

assert(guruText.includes('Bank Soal & Narasi'), 'Guru guide references "Bank Soal & Narasi"');
assert(guruText.includes('+ Tambah Soal'), 'Guru guide references "+ Tambah Soal"');
assert(guruText.includes('Import Aiken'), 'Guru guide references "Import Aiken"');
assert(guruText.includes('Google Drive'), 'Guru guide references "Google Drive"');
assert(guruText.includes('Kelola Narasi Soal'), 'Guru guide references "Kelola Narasi Soal"');

assert(guruText.includes('Profil Guru'), 'Guru guide references "Profil Guru"');
assert(guruText.includes('Skema Penilaian'), 'Guru guide references "Skema Penilaian"');
assert(guruText.includes('Simpan Mapel Ini'), 'Guru guide references "Simpan Mapel Ini"');
assert(guruText.includes('Terapkan ke Semua Mapel yang Diampu'), 'Guru guide references "Terapkan ke Semua Mapel yang Diampu"');

assert(guruText.includes('Ruang Pengawasan'), 'Guru guide references "Ruang Pengawasan"');
assert(guruText.includes('Buka Kamera'), 'Guru guide references "Buka Kamera"');
assert(guruText.includes('watermark'), 'Guru guide references "watermark"');
assert(guruText.includes('Simpan Berita Acara'), 'Guru guide references "Simpan Berita Acara"');

assert(guruText.includes('Monitoring'), 'Guru guide references "Monitoring"');
assert(guruText.includes('Reset Sesi'), 'Guru guide references "Reset Sesi"');

assert(guruText.includes('Hasil & Rekap Nilai'), 'Guru guide references "Hasil & Rekap Nilai"');
assert(guruText.includes('Periksa Jawaban Uraian'), 'Guru guide references "Periksa Jawaban Uraian"');
assert(guruText.includes('Ekspor Excel'), 'Guru guide references "Ekspor Excel"');

// -------------------------------------------------------------------------
// Test Suite 7: Siswa Real Menu & Ruang Ujian Mapping (R4)
// -------------------------------------------------------------------------
console.log('\nSuite 7: Siswa View & Ruang Ujian (ExamRoom) Mapping (R4)');
const siswaText = JSON.stringify(tutorialData.siswa);

assert(siswaText.includes('Beranda'), 'Siswa guide references tab "Beranda"');
assert(siswaText.includes('Token Ujian'), 'Siswa guide references "Token Ujian"');
assert(siswaText.includes('Mulai Ujian'), 'Siswa guide references "Mulai Ujian"');

assert(siswaText.includes('kanvas digital'), 'Siswa guide references "kanvas digital"');
assert(siswaText.includes('Kirim Kehadiran & Buka Soal'), 'Siswa guide references "Kirim Kehadiran & Buka Soal"');

assert(siswaText.includes('Server Time Guard'), 'Siswa guide references "Server Time Guard"');
assert(siswaText.includes('Nomor Soal'), 'Siswa guide references "Nomor Soal"');
assert(siswaText.includes('Ragu-ragu'), 'Siswa guide references "Ragu-ragu"');
assert(siswaText.includes('Narasi Soal'), 'Siswa guide references "Narasi Soal"');

assert(siswaText.includes('Pilihan Ganda') || siswaText.includes('PG'), 'Siswa guide covers PG');
assert(siswaText.includes('PG Kompleks') || siswaText.includes('PGK'), 'Siswa guide covers PGK');
assert(siswaText.includes('Benar / Salah') || siswaText.includes('BS'), 'Siswa guide covers BS');
assert(siswaText.includes('Menjodohkan') || siswaText.includes('Jodoh'), 'Siswa guide covers Jodoh');
assert(siswaText.includes('Isian Singkat') || siswaText.includes('Isian'), 'Siswa guide covers Isian');
assert(siswaText.includes('Uraian'), 'Siswa guide covers Uraian');

assert(siswaText.includes('3-strike'), 'Siswa guide references "3-strike" protocol');
assert(siswaText.includes('grace period 3 detik') || siswaText.includes('toleransi 3 detik') || siswaText.includes('3 detik'), 'Siswa guide references "grace period 3 detik"');

assert(siswaText.includes('Selesai Ujian'), 'Siswa guide references "Selesai Ujian"');
assert(siswaText.includes('Riwayat Nilai'), 'Siswa guide references "Riwayat Nilai"');
assert(siswaText.includes('Papan Peringkat'), 'Siswa guide references "Papan Peringkat"');

// -------------------------------------------------------------------------
// Test Suite 8: Super Admin Real Tab & Feature Mapping (R5)
// -------------------------------------------------------------------------
console.log('\nSuite 8: Super Admin Tab & Feature Mapping (R5)');
const superText = JSON.stringify(tutorialData.super_admin);

assert(superText.includes('Sekolah'), 'Super Admin references tab "Sekolah"');
assert(superText.includes('+ Tambah Sekolah'), 'Super Admin references "+ Tambah Sekolah"');
assert(superText.includes('NPSN'), 'Super Admin references "NPSN"');
assert(superText.includes('Cascade Deletion') || superText.includes('cascade deletion'), 'Super Admin references "Cascade Deletion"');

assert(superText.includes('Admin'), 'Super Admin references tab "Admin"');
assert(superText.includes('Analytics'), 'Super Admin references tab "Analytics"');
assert(superText.includes('concurrent session'), 'Super Admin references "concurrent sessions"');

assert(superText.includes('Pengumuman'), 'Super Admin references tab "Pengumuman"');
assert(superText.includes('Log'), 'Super Admin references tab "Log"');
assert(superText.includes('auto-purge') || superText.includes('hari Minggu'), 'Super Admin references Sunday auto-purge');

// -------------------------------------------------------------------------
// Summary
// -------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`TOTAL: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL ROUND 25 STEP-BY-STEP ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!');
}
