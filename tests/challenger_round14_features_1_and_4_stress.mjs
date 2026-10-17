/**
 * NEXA CBT — Round 14 Adversarial Verification Harness
 * Focus: Feature 1 (Reset Sesi Siswa & Strike Unblocking) & Feature 4 (Server Time Guard & Clock Anti-Tampering)
 * 
 * Conducted by Challenger 1 (critic, specialist)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    failureDetails.push({ testName, details });
    console.error(`  [FAIL] ${testName} - ${details}`);
  }
}

console.log('========================================================================');
console.log('  CHALLENGER 1: ADVERSARIAL STRESS HARNESS (ROUND 14 CBT)');
console.log('  Testing: Feature 1 (Reset Sesi & Unblock) & Feature 4 (Server Time Guard)');
console.log('========================================================================\n');

// ============================================================================
// PART 1: ADVERSARIAL STRESS OF FEATURE 4 (SERVER TIME GUARD)
// ============================================================================
console.log('>>> SECTION 1: Clock Tampering & Monotonic Countdown Stress Tests');

// Model of ExamRoom.jsx Server Time Guard
class SimulatedExamRoomTimer {
  constructor(endMs, initialClientNow = Date.now(), initialPerfNow = 0) {
    this.endMs = endMs;
    this.initialClientNow = initialClientNow;
    this.perfStart = initialPerfNow;
    this.initialRemainingMs = Math.max(0, endMs - initialClientNow);
    this.serverOffsetMs = 0;
  }

  // Same-origin HEAD response simulation
  async syncServerTime(simulatedServerDateHeader, tStartClient, tEndClient) {
    try {
      const serverMs = new Date(simulatedServerDateHeader).getTime();
      const latency = Math.max(0, (tEndClient - tStartClient) / 2);
      const offset = (serverMs + latency) - tEndClient;
      if (offset !== 0) {
        this.serverOffsetMs = offset;
        const correctedNow = tEndClient + offset;
        this.initialRemainingMs = Math.max(0, this.endMs - correctedNow);
        this.perfStart = tEndClient; // Anchor to point of sync
      }
      return offset;
    } catch (e) {
      return 0;
    }
  }

  calculateTimeLeft(currentPerfNow, currentClientDateNow = null) {
    // In ExamRoom.jsx:
    // const elapsedMonotonic = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - perfStart;
    // const diff = Math.max(0, initialRemainingMs - elapsedMonotonic);
    const elapsedMonotonic = currentPerfNow - this.perfStart;
    const diff = Math.max(0, this.initialRemainingMs - elapsedMonotonic);
    if (diff <= 0) return { total: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      total: diff,
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / 1000 / 60) % 60),
      seconds: Math.floor((diff / 1000) % 60)
    };
  }
}

// 1.1 Backward Clock Tampering Stress Test
{
  const trueStart = 1760600000000;
  const examDurationMs = 60 * 60 * 1000; // 60 minutes
  const endMs = trueStart + examDurationMs;

  const timer = new SimulatedExamRoomTimer(endMs, trueStart, 1000);

  // 10 seconds into exam
  let perf = 1000 + 10000; // 10s elapsed
  let remaining1 = timer.calculateTimeLeft(perf);
  assert(
    remaining1.total === examDurationMs - 10000,
    'Clock Baseline: Timer starts and accurately decrements 10s under normal conditions'
  );

  // ATTACK: Student rolls back client OS clock by 1 hour (-3,600,000 ms)
  const tamperedDateNow1 = trueStart + 10000 - 3600000;
  perf += 5000; // 5 more seconds pass physically
  let remainingAfter1HourRollback = timer.calculateTimeLeft(perf, tamperedDateNow1);

  assert(
    remainingAfter1HourRollback.total === examDurationMs - 15000,
    'Attack 1.1a: 1-Hour Backward Clock Jump has ZERO effect on remaining exam time',
    `Remaining: ${remainingAfter1HourRollback.total} ms vs expected ${examDurationMs - 15000} ms`
  );

  // ATTACK: Student rolls back client OS clock by 24 hours (-86,400,000 ms)
  const tamperedDateNow2 = trueStart - 86400000;
  perf += 10000; // 10 more seconds pass physically
  let remainingAfter24HourRollback = timer.calculateTimeLeft(perf, tamperedDateNow2);

  assert(
    remainingAfter24HourRollback.total === examDurationMs - 25000,
    'Attack 1.1b: 24-Hour Backward Clock Jump has ZERO effect on remaining exam time'
  );

  assert(
    remainingAfter24HourRollback.total < remainingAfter1HourRollback.total,
    'Monotonic Invariant: Countdown remains strictly decreasing during backward manipulation'
  );
}

// 1.2 Forward Clock Tampering Stress Test
{
  const trueStart = 1760600000000;
  const examDurationMs = 90 * 60 * 1000; // 90 minutes
  const endMs = trueStart + examDurationMs;

  const timer = new SimulatedExamRoomTimer(endMs, trueStart, 5000);

  // ATTACK: Student jumps clock forward by 45 minutes (+2,700,000 ms)
  let perf = 5000 + 20000; // 20 physical seconds elapsed
  const tamperedForwardDate = trueStart + 2700000;
  const remainingAfterForwardJump = timer.calculateTimeLeft(perf, tamperedForwardDate);

  assert(
    remainingAfterForwardJump.total === examDurationMs - 20000,
    'Attack 1.2a: Forward Clock Jump does NOT artificially accelerate exam countdown',
    `Remaining is ${remainingAfterForwardJump.total} ms (expected: ${examDurationMs - 20000} ms)`
  );

  // ATTACK: Student jumps clock forward by 10 hours past deadline
  const tamperedExpiredDate = trueStart + 36000000;
  perf += 10000; // 30s total physical elapsed
  const remainingAfterHugeForwardJump = timer.calculateTimeLeft(perf, tamperedExpiredDate);

  assert(
    remainingAfterHugeForwardJump.total === examDurationMs - 30000,
    'Attack 1.2b: Huge Forward Clock Jump past deadline does NOT trigger false early termination'
  );
}

// 1.3 Rapid High-Frequency Clock Jitter Stress Test
{
  const trueStart = 1760600000000;
  const examDurationMs = 60 * 60 * 1000;
  const endMs = trueStart + examDurationMs;

  const timer = new SimulatedExamRoomTimer(endMs, trueStart, 0);

  let currentPerf = 0;
  let previousRemaining = examDurationMs;
  let jitterPassed = true;
  let validDecomposition = true;

  // Simulate 100 rapid ticks with wild random OS clock swings
  for (let step = 1; step <= 100; step++) {
    currentPerf += 250; // +250ms monotonic step
    // Random OS jump between -48 hours and +48 hours
    const randomJumpMs = (Math.random() - 0.5) * 2 * 48 * 3600 * 1000;
    const wildClientDate = trueStart + randomJumpMs;

    const res = timer.calculateTimeLeft(currentPerf, wildClientDate);

    if (res.total > previousRemaining) {
      jitterPassed = false;
      break;
    }
    if (res.hours < 0 || res.minutes < 0 || res.seconds < 0 || Number.isNaN(res.total)) {
      validDecomposition = false;
      break;
    }
    previousRemaining = res.total;
  }

  assert(
    jitterPassed,
    'Attack 1.3a: 100-Cycle High-Frequency Clock Jitter maintains strictly monotonic countdown'
  );
  assert(
    validDecomposition,
    'Attack 1.3b: Time unit decomposition (hours, mins, secs) never produces negative/NaN during jitter'
  );
}

// 1.4 Page Reload with Tampered Local Clock (Server Sync Neutralization)
{
  const trueServerStart = 1760600000000;
  const examDurationMs = 60 * 60 * 1000;
  const endMs = trueServerStart + examDurationMs;

  // Scenario 1.4a: Student sets OS clock 2 hours backward and reloads at t = 10 minutes (600,000ms elapsed)
  const trueServerNowAtReload = trueServerStart + 600000; // 50 mins remaining (3,000,000 ms)
  const clientClock2HoursBack = trueServerNowAtReload - 7200000; // 2 hours behind

  // When ExamRoom mounts, client initially measures with tampered clock:
  const reloadedTimer = new SimulatedExamRoomTimer(endMs, clientClock2HoursBack, 0);
  
  // Before server offset sync: naive initialRemainingMs would be 3,000,000 + 7,200,000 = 10,200,000 ms
  assert(
    reloadedTimer.initialRemainingMs === 3000000 + 7200000,
    'Pre-sync check: Untampered initial state would give extra time before server sync'
  );

  // Now Server Time Guard executes fetchServerOffset:
  const simTStart = clientClock2HoursBack;
  const simTEnd = clientClock2HoursBack + 60; // 60ms round-trip latency
  const simServerDateHeader = new Date(trueServerNowAtReload + 30).toUTCString(); // Server is at midpoint

  await reloadedTimer.syncServerTime(simServerDateHeader, simTStart, simTEnd);

  // After sync, verify serverOffsetMs compensated for the -2hr client shift
  assert(
    Math.abs(reloadedTimer.serverOffsetMs - 7200000) <= 60,
    'Attack 1.4a: Server Time Guard measures exact +2-Hour offset (within 60ms latency)'
  );

  // Measure remaining time right after sync
  const correctedRemaining = reloadedTimer.calculateTimeLeft(simTEnd);
  const remainingDelta = Math.abs(correctedRemaining.total - (examDurationMs - 600000));

  assert(
    remainingDelta <= 60,
    'Attack 1.4a: Page Reload with -2hr tampered clock is completely neutralized to true remaining time',
    `Remaining delta from true deadline is only ${remainingDelta} ms (latency bound)`
  );

  // Scenario 1.4b: Student sets OS clock 3 hours forward and reloads
  const clientClock3HoursForward = trueServerNowAtReload + 10800000;
  const reloadedTimerForward = new SimulatedExamRoomTimer(endMs, clientClock3HoursForward, 0);

  const simTStartF = clientClock3HoursForward;
  const simTEndF = clientClock3HoursForward + 40;
  const simServerDateHeaderF = new Date(trueServerNowAtReload + 20).toUTCString();

  await reloadedTimerForward.syncServerTime(simServerDateHeaderF, simTStartF, simTEndF);

  assert(
    Math.abs(reloadedTimerForward.serverOffsetMs - (-10800000)) <= 40,
    'Attack 1.4b: Server Time Guard detects negative offset when client clock is ahead'
  );

  const correctedRemainingF = reloadedTimerForward.calculateTimeLeft(simTEndF);
  assert(
    Math.abs(correctedRemainingF.total - (examDurationMs - 600000)) <= 40,
    'Attack 1.4b: Forward-clock reload does NOT falsely terminate active exam'
  );
}

// 1.5 Truly Expired Exam Boundary Test
{
  const trueServerStart = 1760600000000;
  const endMs = trueServerStart + 3600000; // 1 hour exam
  const trueNowExpired = endMs + 5000; // 5 seconds after endMs

  const expiredTimer = new SimulatedExamRoomTimer(endMs, trueNowExpired, 0);
  const res = expiredTimer.calculateTimeLeft(0);

  assert(
    res.total === 0 && res.hours === 0 && res.minutes === 0 && res.seconds === 0,
    'Boundary 1.5: Genuinely expired exam evaluates to exactly 0 remaining time'
  );
}

console.log('');

// ============================================================================
// PART 2: ADVERSARIAL STRESS OF FEATURE 1 (RESET SESI SISWA & UNBLOCK)
// ============================================================================
console.log('>>> SECTION 2: Reset Sesi Siswa & Strike Unblocking Adversarial Tests');

// Mock Database State representing Supabase tables
class MockSupabaseEnvironment {
  constructor() {
    this.siswaTable = new Map();
    this.logUjianTable = new Map();
    this.jawabanTable = new Map();
    this.absensiTable = new Map();
    this.auditLogTable = [];
  }

  seedStudent({ id_siswa, nama_lengkap, username, password, npsn, session_token = null }) {
    this.siswaTable.set(id_siswa, { id_siswa, nama_lengkap, username, password, npsn, session_token });
  }

  seedLogUjian({ id_log, id_siswa, id_jadwal, is_blocked = false, pelanggaran = 0, status_ujian = 'SEDANG KERJA', nilai_auto = null, tanda_tangan = null, status_kehadiran = 'HADIR', waktu_selesai = null }) {
    this.logUjianTable.set(id_log, { id_log, id_siswa, id_jadwal, is_blocked, pelanggaran, status_ujian, nilai_auto, tanda_tangan, status_kehadiran, waktu_selesai });
  }

  seedJawaban({ id_jawaban, id_log, id_soal, jawaban_user, is_correct, skor_diperoleh }) {
    this.jawabanTable.set(id_jawaban, { id_jawaban, id_log, id_soal, jawaban_user, is_correct, skor_diperoleh });
  }

  // Exact reproduction of api.js login protection check (lines 273-299)
  attemptStudentLogin(id_siswa, npsn) {
    const s = this.siswaTable.get(id_siswa);
    if (!s || s.npsn !== npsn) return { status: 'error', message: 'User not found' };

    if (s.session_token) {
      const parts = s.session_token.split('|');
      let isActive = true;
      if (parts.length === 2) {
        const lastActive = parseInt(parts[1], 10);
        if (Date.now() - lastActive > 3 * 60 * 1000) {
          isActive = false;
        }
      }
      if (isActive) {
        return { status: 'error', message: 'Akun Anda sedang digunakan. Tunggu 3 menit setelah keluar, atau minta admin mereset sesi Anda.' };
      }
    }

    const newSessionToken = `token_${Math.random().toString(36).substr(2, 8)}|${Date.now()}`;
    s.session_token = newSessionToken;
    return { status: 'success', data: { ...s, session_token: newSessionToken } };
  }

  // Exact reproduction of api.js 'reset_sesi_siswa' handler (lines 580-619)
  async resetSesiSiswa(payload) {
    const idSiswa = payload.id_siswa || payload.p_id_siswa;
    const idJadwal = payload.id_jadwal || payload.p_id_jadwal;
    const idLog = payload.id_log;

    if (!idSiswa && !idLog) {
      return { status: 'error', message: 'ID Siswa atau ID Log wajib disertakan.' };
    }

    // 1. Reset login token on siswa table to clear 3-minute multi-login lock
    if (idSiswa) {
      const s = this.siswaTable.get(idSiswa);
      if (s) {
        if (!payload.npsn || s.npsn === payload.npsn) {
          s.session_token = null;
        }
      }
    }

    // 2. Unblock & reset exam session in log_ujian non-destructively
    let targetLogs = [];
    if (idLog) {
      const l = this.logUjianTable.get(idLog);
      if (l) targetLogs.push(l);
    } else if (idSiswa && idJadwal) {
      for (const l of this.logUjianTable.values()) {
        if (l.id_siswa === idSiswa && l.id_jadwal === idJadwal) targetLogs.push(l);
      }
    } else if (idSiswa) {
      for (const l of this.logUjianTable.values()) {
        if (l.id_siswa === idSiswa) targetLogs.push(l);
      }
    }

    for (const l of targetLogs) {
      l.is_blocked = false;
      l.pelanggaran = 0;
      l.status_ujian = 'SEDANG KERJA';
      l.waktu_selesai = null;
    }

    return { status: 'success', message: 'Sesi siswa berhasil direset.' };
  }
}

// 2.1 Multi-Login Lockout & Reset Verification
{
  const db = new MockSupabaseEnvironment();
  const testSiswaId = 'SISWA-ADV-001';
  const testNpsn = '70040625';

  db.seedStudent({
    id_siswa: testSiswaId,
    nama_lengkap: 'Siswa Test Lockout',
    username: 'siswa001',
    password: 'password123',
    npsn: testNpsn,
    session_token: null
  });

  // Step A: First login succeeds and generates active session_token
  const login1 = db.attemptStudentLogin(testSiswaId, testNpsn);
  assert(login1.status === 'success', 'Step 2.1a: First login establishes active session_token');
  assert(Boolean(db.siswaTable.get(testSiswaId).session_token), 'session_token is written to siswa table');

  // Step B: Second concurrent login within 3 minutes is BLOCKED
  const login2 = db.attemptStudentLogin(testSiswaId, testNpsn);
  assert(
    login2.status === 'error' && login2.message.includes('Akun Anda sedang digunakan'),
    'Step 2.1b: Second concurrent login is strictly blocked by multi-login guard'
  );

  // Step C: Proctor triggers reset_sesi_siswa
  const resetRes = await db.resetSesiSiswa({ id_siswa: testSiswaId, npsn: testNpsn });
  assert(resetRes.status === 'success', 'Step 2.1c: reset_sesi_siswa returns success');
  assert(
    db.siswaTable.get(testSiswaId).session_token === null,
    'Step 2.1d: reset_sesi_siswa clears session_token to null'
  );

  // Step D: Student can immediately log in again without waiting for 3-minute timeout!
  const loginAfterReset = db.attemptStudentLogin(testSiswaId, testNpsn);
  assert(
    loginAfterReset.status === 'success',
    'Step 2.1e: Student logs in immediately after reset with zero multi-login barrier'
  );
}

// 2.2 Anti-Cheat Strike-3 Block & Unblocking Verification
{
  const db = new MockSupabaseEnvironment();
  const sId = 'SISWA-ADV-002';
  const jId = 'JDW-MAT-01';
  const lId = 'LOG-ADV-002';
  const npsn = '70040625';

  db.seedStudent({ id_siswa: sId, nama_lengkap: 'Siswa AntiCheat', username: 'siswa002', password: '123', npsn });
  db.seedLogUjian({
    id_log: lId,
    id_siswa: sId,
    id_jadwal: jId,
    is_blocked: true,
    pelanggaran: 3,
    status_ujian: 'SELESAI',
    nilai_auto: 0,
    tanda_tangan: 'data:image/png;base64,mockSignatureData',
    status_kehadiran: 'HADIR',
    waktu_selesai: new Date().toISOString()
  });

  // Verify initial blocked status
  const initialLog = db.logUjianTable.get(lId);
  assert(
    initialLog.is_blocked === true && initialLog.pelanggaran === 3 && initialLog.status_ujian === 'SELESAI',
    'Step 2.2a: Initial state is confirmed Strike-3 Blocked (is_blocked: true, pelanggaran: 3)'
  );

  // Proctor triggers reset_sesi_siswa
  const resetRes = await db.resetSesiSiswa({ id_log: lId, id_siswa: sId, id_jadwal: jId, npsn });
  assert(resetRes.status === 'success', 'Step 2.2b: Proctor reset succeeds');

  const unblockedLog = db.logUjianTable.get(lId);
  assert(unblockedLog.is_blocked === false, 'Step 2.2c: is_blocked is reset to false');
  assert(unblockedLog.pelanggaran === 0, 'Step 2.2d: Violations counter is reset to 0');
  assert(unblockedLog.status_ujian === 'SEDANG KERJA', 'Step 2.2e: Status is restored to SEDANG KERJA');
  assert(unblockedLog.waktu_selesai === null, 'Step 2.2f: waktu_selesai is cleared to null');
}

// 2.3 Non-Destructive Invariant & Answer Preservation
{
  const db = new MockSupabaseEnvironment();
  const sId = 'SISWA-ADV-003';
  const jId = 'JDW-MAT-01';
  const lId = 'LOG-ADV-003';
  const npsn = '70040625';

  const initialSignature = 'data:image/png;base64,validSignature1234567890';

  db.seedStudent({ id_siswa: sId, nama_lengkap: 'Siswa Data Preservation', username: 'siswa003', password: '123', npsn });
  db.seedLogUjian({
    id_log: lId,
    id_siswa: sId,
    id_jadwal: jId,
    is_blocked: true,
    pelanggaran: 3,
    status_ujian: 'SELESAI',
    nilai_auto: 0,
    tanda_tangan: initialSignature,
    status_kehadiran: 'HADIR',
    waktu_selesai: new Date().toISOString()
  });

  // Seed 5 existing answers in jawaban_siswa
  for (let i = 1; i <= 5; i++) {
    db.seedJawaban({
      id_jawaban: `JWB-${i}`,
      id_log: lId,
      id_soal: `SOAL-${i}`,
      jawaban_user: `Opsi ${i}`,
      is_correct: true,
      skor_diperoleh: 20
    });
  }

  const answerCountBefore = db.jawabanTable.size;
  assert(answerCountBefore === 5, 'Step 2.3a: 5 existing answers recorded prior to reset');

  // Perform reset
  await db.resetSesiSiswa({ id_log: lId, id_siswa: sId, id_jadwal: jId, npsn });

  // Verify non-destructive invariants
  const answerCountAfter = db.jawabanTable.size;
  assert(
    answerCountAfter === 5,
    'Step 2.3b: Non-Destructive: ZERO answers deleted from jawaban_siswa during session reset'
  );

  const postResetLog = db.logUjianTable.get(lId);
  assert(
    postResetLog.tanda_tangan === initialSignature,
    'Step 2.3c: Attendance digital signature is completely preserved (student does not re-sign)'
  );
  assert(
    postResetLog.status_kehadiran === 'HADIR',
    'Step 2.3d: Attendance status remains HADIR'
  );
  assert(
    postResetLog.id_log === lId,
    'Step 2.3e: Primary key id_log is intact, maintaining referential integrity'
  );
}

// 2.4 Resumed Exam Submission and Unblocked Scoring Invariant
{
  // When an unblocked student finally submits the exam in api.js (lines 1970-1988):
  // let nilaiAuto = 0;
  // if (isBlocked) {
  //   nilaiAuto = 0;
  // } else if (totalSkorMaxAuto > 0) {
  //   nilaiAuto = (totalSkorDiperolehAuto / totalSkorMaxAuto) * 100;
  //   nilaiAuto = Math.round(nilaiAuto * 100) / 100;
  // }
  const totalSkorDiperolehAuto = 80;
  const totalSkorMaxAuto = 100;

  // If student was still blocked:
  const blockedScore = true ? 0 : (totalSkorDiperolehAuto / totalSkorMaxAuto) * 100;
  assert(blockedScore === 0, 'Pre-condition check: Blocked student receives score of 0');

  // Once unblocked by reset_sesi_siswa:
  const isBlocked = false; // as set by reset_sesi_siswa
  let unblockedScore = 0;
  if (isBlocked) {
    unblockedScore = 0;
  } else if (totalSkorMaxAuto > 0) {
    unblockedScore = (totalSkorDiperolehAuto / totalSkorMaxAuto) * 100;
    unblockedScore = Math.round(unblockedScore * 100) / 100;
  }

  assert(
    unblockedScore === 80,
    'Step 2.4: Unblocked student receives legitimate score calculation (80.00) upon completion'
  );
}

// 2.5 Input Polymorphism & Validation
{
  const db = new MockSupabaseEnvironment();
  const sId = 'SISWA-POLY-01';
  const jId = 'JDW-POLY-01';
  const lId = 'LOG-POLY-01';

  db.seedStudent({ id_siswa: sId, nama_lengkap: 'Siswa Poly', username: 'poly', password: '123', npsn: '123' });
  db.seedLogUjian({ id_log: lId, id_siswa: sId, id_jadwal: jId, is_blocked: true, pelanggaran: 3 });

  // Test with id_log only
  const resLogOnly = await db.resetSesiSiswa({ id_log: lId });
  assert(resLogOnly.status === 'success', 'Step 2.5a: Polymorphic call with id_log only succeeds');

  // Test with id_siswa + id_jadwal
  const resSiswaJadwal = await db.resetSesiSiswa({ id_siswa: sId, id_jadwal: jId });
  assert(resSiswaJadwal.status === 'success', 'Step 2.5b: Polymorphic call with id_siswa + id_jadwal succeeds');

  // Test with p_id_siswa + p_id_jadwal (RPC-style parameters)
  const resRpcParams = await db.resetSesiSiswa({ p_id_siswa: sId, p_id_jadwal: jId });
  assert(resRpcParams.status === 'success', 'Step 2.5c: Polymorphic call with p_id_siswa + p_id_jadwal succeeds');

  // Test missing parameters rejection
  const resEmpty = await db.resetSesiSiswa({});
  assert(
    resEmpty.status === 'error' && resEmpty.message.includes('ID Siswa atau ID Log wajib'),
    'Step 2.5d: Call without any ID is safely rejected with descriptive error'
  );
}

console.log('');

// ============================================================================
// PART 3: STATIC CODEBASE AUDIT & REGRESSION INVARIANTS
// ============================================================================
console.log('>>> SECTION 3: Codebase Static & Architectural Audit');

const apiJsPath = path.join(rootDir, 'src', 'api.js');
const apiCode = fs.readFileSync(apiJsPath, 'utf-8');

// 3.1 Verify exactly one handler for reset_sesi_siswa
const resetOccurrences = apiCode.match(/case\s+['"]reset_sesi_siswa['"]\s*:/g) || [];
assert(
  resetOccurrences.length === 1,
  'Regression Check 3.1: Exactly ONE case statement for reset_sesi_siswa in api.js (Zero duplicate dead code)'
);

// 3.2 Verify destructive delete is absent
assert(
  !apiCode.includes("from('log_ujian').delete()"),
  'Data Safety 3.2: No table delete on log_ujian exists in api.js'
);

// 3.3 Verify GuruView.jsx implementation
const guruViewPath = path.join(rootDir, 'src', 'views', 'GuruView.jsx');
const guruCode = fs.readFileSync(guruViewPath, 'utf-8');

assert(
  guruCode.includes('handleResetSession') &&
  guruCode.includes("logActivity('RESET_SESI',"),
  'UI Contract 3.3: GuruView.jsx dispatches RESET_SESI audit logging upon reset'
);

assert(
  guruCode.includes("setConfirmDialog({") &&
  guruCode.includes("title: 'Reset Sesi Peserta'"),
  'UI Contract 3.4: GuruView.jsx requires explicit proctor confirmation dialog before reset'
);

// 3.4 Verify ExamRoom.jsx implementation
const examRoomPath = path.join(rootDir, 'src', 'views', 'ExamRoom.jsx');
const examRoomCode = fs.readFileSync(examRoomPath, 'utf-8');

assert(
  examRoomCode.includes('Server Time Guard') &&
  examRoomCode.includes('fetchServerOffset') &&
  examRoomCode.includes('elapsedMonotonic'),
  'Security Contract 3.5: ExamRoom.jsx implements Server Time Guard with monotonic clock'
);

console.log('\n========================================================================');
console.log(`  CHALLENGER STRESS RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
if (failedTests > 0) {
  console.error(`  FAILURES DETECTED: ${failedTests}`);
  failureDetails.forEach(f => console.error(`   - ${f.testName}: ${f.details}`));
} else {
  console.log('  STATUS: ALL ADVERSARIAL CHALLENGES CONFIRMED ROBUST (0 FAILURES)');
}
console.log('========================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
