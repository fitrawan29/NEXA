/**
 * Verification test suite for Milestone 3 (Round 28)
 * Worker M3: ExamRoom Mobile Navigation & Accessibility + Siswa Privacy
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const examRoomPath = path.join(rootDir, 'src', 'views', 'ExamRoom.jsx');
const examRoomCode = fs.readFileSync(examRoomPath, 'utf8');

const siswaViewPath = path.join(rootDir, 'src', 'views', 'SiswaView.jsx');
const siswaViewCode = fs.readFileSync(siswaViewPath, 'utf8');

console.log('=== VERIFYING WORKER M3 (ROUND 28) ===\n');

// ----------------------------------------------------------------------------
// 1. ExamRoom Mobile Sticky Bottom Action Bar (4-Column Grid)
// ----------------------------------------------------------------------------
console.log('1. Checking ExamRoom Mobile Sticky Bottom Action Bar...');
assert.ok(
  examRoomCode.includes('fixed bottom-0 left-0 right-0'),
  'ExamRoom retains fixed bottom bar shell'
);
assert.ok(
  examRoomCode.includes('grid grid-cols-4') || examRoomCode.includes('grid-cols-4'),
  'ExamRoom implements 4-column grid for mobile'
);
assert.ok(
  examRoomCode.includes('Prev') && examRoomCode.includes('Ragu') && examRoomCode.includes('Palet') && examRoomCode.includes('Next'),
  'ExamRoom bottom bar includes Prev, Ragu, Palet, Next labels'
);
assert.ok(
  examRoomCode.includes('arrow_back') && examRoomCode.includes('arrow_forward'),
  'ExamRoom bottom bar includes arrow_back and arrow_forward navigation icons'
);
assert.ok(
  examRoomCode.includes('min-h-[44px]'),
  'ExamRoom bottom action buttons satisfy minimum 44px touch target height'
);
console.log('  ✔ ExamRoom Mobile Sticky Bottom Action Bar verified!\n');

// ----------------------------------------------------------------------------
// 2. ExamRoom Font Size Modifier (A- / A / A+)
// ----------------------------------------------------------------------------
console.log('2. Checking ExamRoom Font Size Modifier (A- / A / A+)...');
assert.ok(
  examRoomCode.includes('fontSize') && examRoomCode.includes('setFontSize'),
  'ExamRoom has fontSize state management'
);
assert.ok(
  examRoomCode.includes('nexa_exam_font_size'),
  'ExamRoom persists font size to localStorage (nexa_exam_font_size)'
);
assert.ok(
  examRoomCode.includes('A-') && examRoomCode.includes('A+') && examRoomCode.includes('title="Ukuran teks normal (A)"'),
  'ExamRoom header renders A-, A, A+ segmented controller'
);
assert.ok(
  examRoomCode.includes('id="narasi-soal"'),
  'ExamRoom has #narasi-soal container ID'
);
assert.ok(
  examRoomCode.includes('id="pertanyaan-soal"'),
  'ExamRoom has #pertanyaan-soal container ID'
);
assert.ok(
  examRoomCode.includes('fontClasses.stimulus') && examRoomCode.includes('fontClasses.question') && examRoomCode.includes('fontClasses.options'),
  'ExamRoom maps dynamic typography classes to stimulus, question, and options'
);
console.log('  ✔ ExamRoom Font Size Modifier verified!\n');

// ----------------------------------------------------------------------------
// 3. ExamRoom Critical Countdown Warnings (<= 5m and <= 1m)
// ----------------------------------------------------------------------------
console.log('3. Checking ExamRoom Critical Countdown Warnings...');
assert.ok(
  examRoomCode.includes('hasAlerted5MinRef') && examRoomCode.includes('hasAlerted1MinRef'),
  'ExamRoom maintains single-fire alert refs'
);
assert.ok(
  examRoomCode.includes('300000') && examRoomCode.includes('60000'),
  'ExamRoom checks 300,000ms (5m) and 60,000ms (1m) thresholds'
);
assert.ok(
  examRoomCode.includes('Peringatan Waktu') && examRoomCode.includes('Waktu Kritis'),
  'ExamRoom triggers proactive toasts for 5m and 1m warnings'
);
assert.ok(
  examRoomCode.includes('animate-pulse') && examRoomCode.includes('bg-rose-600'),
  'ExamRoom displays high-contrast pulsing red warning banner at <= 1m'
);
assert.ok(
  examRoomCode.includes('bg-amber-500'),
  'ExamRoom displays persistent amber warning banner at <= 5m'
);
console.log('  ✔ ExamRoom Critical Countdown Warnings verified!\n');

// ----------------------------------------------------------------------------
// 4. SiswaView Conditional Leaderboard
// ----------------------------------------------------------------------------
console.log('4. Checking SiswaView Conditional Leaderboard...');
assert.ok(
  siswaViewCode.includes('get_pengaturan_sekolah'),
  'SiswaView imports get_pengaturan_sekolah'
);
assert.ok(
  siswaViewCode.includes('showLeaderboard') && siswaViewCode.includes('tampilkan_leaderboard'),
  'SiswaView maintains showLeaderboard state bound to tampilkan_leaderboard setting'
);
assert.ok(
  siswaViewCode.includes(".filter(tab => tab.id !== 'leaderboard' || showLeaderboard)"),
  'SiswaView filters desktop and mobile tabs using dynamic predicate'
);
assert.ok(
  siswaViewCode.includes('{showLeaderboard && (') && siswaViewCode.includes('Peringkat Teratas'),
  'SiswaView conditionally renders Kilas Leaderboard card on Beranda'
);
assert.ok(
  siswaViewCode.includes("showLeaderboard && activeTab === 'leaderboard'"),
  'SiswaView guards Tab 5 rendering against disabled leaderboard'
);
assert.ok(
  siswaViewCode.includes("!showLeaderboard && activeTab === 'leaderboard'") && siswaViewCode.includes("setActiveTab('beranda')"),
  'SiswaView safely redirects activeTab from leaderboard to beranda if disabled'
);
console.log('  ✔ SiswaView Conditional Leaderboard verified!\n');

console.log('====================================================');
console.log('ALL WORKER M3 VERIFICATION TESTS PASSED SUCCESSFULLY!');
console.log('====================================================');
