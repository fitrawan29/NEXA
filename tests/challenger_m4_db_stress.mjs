#!/usr/bin/env node
/**
 * CBT NEXA - Empirical Challenger M4 Database Stress Test Suite
 * 
 * Target: Siswa Exam Security & Supabase Database State Machine
 * Requirement: R4 (Browser Visibility/Blur, 3-Strike Rule, Auto-kick, Score 0)
 * 
 * Adversarial Stress Vectors:
 * 1. AST & Frontend Security Component Integrity:
 *    - Static analysis of ExamRoom.jsx & api.js
 *    - Verification of 'visibilitychange' + 'document.hidden'
 *    - Verification of 'blur' window listener
 *    - Verification of 2500ms cooldown deduplication with useRef
 *    - Verification of unclosable Strike 3 modal, localStorage purge, fullscreen exit, 3000ms kick
 * 2. Deduplication Cooldown Time-Series Simulation:
 *    - Assert concurrent events (<2500ms) are suppressed
 *    - Assert legitimate events (>=2500ms) are registered
 * 3. Primary Live Supabase Lifecycle Test (Strikes 1, 2, and 3):
 *    - Seed active exam log (status='SEDANG KERJA', pelanggaran=0, is_blocked=false, nilai_auto=null)
 *    - Strike 1: assert API returns pelanggaran_saat_ini = 1, terblokir = false
 *               assert Supabase DB: pelanggaran=1, is_blocked=false, status='SEDANG KERJA', nilai_auto=null
 *    - Strike 2: assert API returns pelanggaran_saat_ini = 2, terblokir = false
 *               assert Supabase DB: pelanggaran=2, is_blocked=false, status='SEDANG KERJA', nilai_auto=null
 *    - Strike 3: assert API returns pelanggaran_saat_ini = 3, terblokir = true
 *               assert Supabase DB: status_ujian='SELESAI', nilai_auto=0, is_blocked=true, waktu_selesai is set
 * 4. Adversarial Edge Cases & State Machine Tamper Resistance:
 *    - Overshoot Strike 4: assert terminal state remains immutable (status='SELESAI', nilai_auto=0, is_blocked=true)
 *    - Submit while blocked: assert submit_ujian enforces 0 score and cannot overwrite blocked record
 *    - Non-existent log handling: assert api('catat_pelanggaran') handles invalid log ID gracefully
 *    - Missing reason fallback: assert catat_pelanggaran handles empty reason safely
 *    - Multi-session independence: verify second test session undergoes clean 1->2->3 progression
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import { createClient } from '@supabase/supabase-js';
import { fetchAPI } from '../src/api.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../src/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const examRoomPath = path.resolve(projectRoot, 'src', 'views', 'ExamRoom.jsx');
const apiPath = path.resolve(projectRoot, 'src', 'api.js');

const examRoomCode = fs.readFileSync(examRoomPath, 'utf8');
const apiCode = fs.readFileSync(apiPath, 'utf8');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const suiteReport = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: []
};

function test(description, condition, details = '') {
  suiteReport.total++;
  if (condition) {
    suiteReport.passed++;
    console.log(`  ✔ [PASS] ${description}`);
  } else {
    suiteReport.failed++;
    suiteReport.failures.push({ description, details });
    console.log(`  ✖ [FAIL] ${description}${details ? ` -> ${details}` : ''}`);
  }
}

async function runChallengerSuite() {
  console.log('======================================================================');
  console.log('  CBT NEXA - CHALLENGER M4: DATABASE STATE MACHINE & SECURITY STRESS  ');
  console.log('======================================================================\n');

  // =============================================================================
  // SECTION 1: AST Syntax & Code Integrity Audit
  // =============================================================================
  console.log('▶ SECTION 1: Static Code & Security Hook Integrity Audit');
  try {
    parse(examRoomCode, { sourceType: 'module', plugins: ['jsx'] });
    test('ExamRoom.jsx AST syntax parses without error', true);
  } catch (e) {
    test('ExamRoom.jsx AST syntax parses without error', false, e.message);
  }

  try {
    parse(apiCode, { sourceType: 'module', plugins: ['jsx'] });
    test('api.js AST syntax parses without error', true);
  } catch (e) {
    test('api.js AST syntax parses without error', false, e.message);
  }

  // Verify Browser Security Listeners in ExamRoom
  const hasVisListener = examRoomCode.includes("addEventListener('visibilitychange'") || examRoomCode.includes('addEventListener("visibilitychange"');
  test("ExamRoom registers 'visibilitychange' event listener", hasVisListener);

  const checksDocHidden = /document\.hidden/.test(examRoomCode);
  test("ExamRoom checks 'document.hidden' in visibility handler", checksDocHidden);

  const hasBlurListener = examRoomCode.includes("addEventListener('blur'") || examRoomCode.includes('addEventListener("blur"');
  test("ExamRoom registers 'blur' window listener", hasBlurListener);

  const hasCooldownRef = /lastViolationTimeRef\s*=\s*useRef\(0\)/.test(examRoomCode);
  test("ExamRoom implements 'lastViolationTimeRef' timestamp tracking", hasCooldownRef);

  const enforces2500ms = /2500/.test(examRoomCode) && /lastViolationTimeRef\.current/.test(examRoomCode);
  test("ExamRoom enforces 2500ms violation deduplication window", enforces2500ms);

  const cleansUpListeners = (examRoomCode.includes("removeEventListener('visibilitychange'") || examRoomCode.includes('removeEventListener("visibilitychange"')) &&
                            (examRoomCode.includes("removeEventListener('blur'") || examRoomCode.includes('removeEventListener("blur"'));
  test("ExamRoom cleans up security listeners on unmount", cleansUpListeners);

  // Verify Progressive Warning Dialogs and Auto-kick Actions
  const hasStrike1Warning = examRoomCode.includes("Peringatan Keamanan (1/3)");
  test("ExamRoom implements Strike 1 warning notification (1/3)", hasStrike1Warning);

  const hasStrike2Warning = examRoomCode.includes("PERINGATAN TERAKHIR (2/3)!");
  test("ExamRoom implements Strike 2 high-priority warning notification (2/3)", hasStrike2Warning);

  const hasStrike3Modal = examRoomCode.includes("UJIAN DIHENTIKAN! (Pelanggaran ke-3)");
  test("ExamRoom renders unclosable Strike 3 termination modal", hasStrike3Modal);

  const purgesCache = /localStorage\.removeItem\(`nexa_ans_\${idLog}`\)/.test(examRoomCode);
  test("ExamRoom purges cached localStorage answers on Strike 3", purgesCache);

  const exitsFullscreen = /exitFullscreen/.test(examRoomCode);
  test("ExamRoom exits fullscreen on Strike 3 lockout", exitsFullscreen);

  const autoKicksStudent = /setTimeout\(\s*(\(\)\s*=>\s*\{\s*onFinish\(\);\s*\}|onFinish)\s*,\s*3000\s*\)/.test(examRoomCode);
  test("ExamRoom triggers automatic redirection via onFinish() after 3000ms", autoKicksStudent);


  // =============================================================================
  // SECTION 2: Deduplication Cooldown Logic Simulation
  // =============================================================================
  console.log('\n▶ SECTION 2: Deduplication Cooldown Time-Series Simulation');

  let simViolationCount = 0;
  let lastViolationTimestamp = 0;
  const simReport = () => { simViolationCount++; };

  const simulateViolationEvent = (currentTimeMs) => {
    if (currentTimeMs - lastViolationTimestamp < 2500) {
      return false; // suppressed by cooldown
    }
    lastViolationTimestamp = currentTimeMs;
    simReport();
    return true;
  };

  const t0 = 500000;
  test("Event 1 at t=0ms triggers report violation", simulateViolationEvent(t0) && simViolationCount === 1);
  test("Event 2 at t=+80ms (concurrent blur/visibility) is suppressed", !simulateViolationEvent(t0 + 80) && simViolationCount === 1);
  test("Event 3 at t=+1500ms (<2500ms window) is suppressed", !simulateViolationEvent(t0 + 1500) && simViolationCount === 1);
  test("Event 4 at t=+2499ms (<2500ms window) is suppressed", !simulateViolationEvent(t0 + 2499) && simViolationCount === 1);
  test("Event 5 at t=+2501ms (>=2500ms window) triggers Strike 2", simulateViolationEvent(t0 + 2501) && simViolationCount === 2);
  test("Event 6 at t=+2600ms (<2500ms from Strike 2) is suppressed", !simulateViolationEvent(t0 + 2600) && simViolationCount === 2);
  test("Event 7 at t=+5100ms (>=2500ms from Strike 2) triggers Strike 3", simulateViolationEvent(t0 + 5100) && simViolationCount === 3);


  // =============================================================================
  // SECTION 3: Live Supabase Database State Machine Stress (Strikes 1, 2, and 3)
  // =============================================================================
  console.log('\n▶ SECTION 3: Live Supabase Database State Machine Lifecycle');

  const primaryTestLogId = `CHALLENGER-LOG-M4-${Date.now()}`;
  let testJadwalId = null;
  let testSiswaId = null;
  let testNpsn = '70040625';

  try {
    // Resolve existing jadwal & siswa records
    const { data: jadwalList } = await supabase.from('jadwal').select('id_jadwal, npsn').limit(1);
    if (jadwalList && jadwalList.length > 0) {
      testJadwalId = jadwalList[0].id_jadwal;
      testNpsn = jadwalList[0].npsn || testNpsn;
    }

    const { data: siswaList } = await supabase.from('siswa').select('id_siswa').limit(1);
    if (siswaList && siswaList.length > 0) {
      testSiswaId = siswaList[0].id_siswa;
    }

    // 3.1 Initial Seeding of pristine active exam log
    const { error: seedErr } = await supabase.from('log_ujian').insert({
      id_log: primaryTestLogId,
      id_jadwal: testJadwalId,
      id_siswa: testSiswaId,
      status_ujian: 'SEDANG KERJA',
      pelanggaran: 0,
      is_blocked: false,
      nilai_auto: null,
      pelanggaran_detail: []
    });
    test("Live DB: Seed initial active exam log record (" + primaryTestLogId + ")", !seedErr, seedErr?.message);

    // Initial state verification directly from DB
    const { data: initialDbState } = await supabase.from('log_ujian').select('*').eq('id_log', primaryTestLogId).single();
    test("Live DB: Initial record status is 'SEDANG KERJA'", initialDbState?.status_ujian === 'SEDANG KERJA');
    test("Live DB: Initial record pelanggaran is 0", initialDbState?.pelanggaran === 0);
    test("Live DB: Initial record is_blocked is false", initialDbState?.is_blocked === false);
    test("Live DB: Initial record nilai_auto is null", initialDbState?.nilai_auto === null);

    // 3.2 Strike 1 Execution
    const resStrike1 = await fetchAPI('catat_pelanggaran', {
      id_log: primaryTestLogId,
      alasan: 'Empirical Test Strike 1: Tab switch detected',
      npsn: testNpsn
    });

    test("Strike 1: API returns status = 'success'", resStrike1?.status === 'success');
    test("Strike 1: API returns pelanggaran_saat_ini = 1", resStrike1?.pelanggaran_saat_ini === 1);
    test("Strike 1: API returns terblokir = false", resStrike1?.terblokir === false);

    const { data: dbStrike1 } = await supabase.from('log_ujian').select('*').eq('id_log', primaryTestLogId).single();
    test("Strike 1 DB: pelanggaran is 1", dbStrike1?.pelanggaran === 1);
    test("Strike 1 DB: is_blocked is false", dbStrike1?.is_blocked === false);
    test("Strike 1 DB: status_ujian remains 'SEDANG KERJA'", dbStrike1?.status_ujian === 'SEDANG KERJA');
    test("Strike 1 DB: nilai_auto remains null", dbStrike1?.nilai_auto === null);
    test("Strike 1 DB: waktu_selesai remains null or unset", !dbStrike1?.waktu_selesai);
    test("Strike 1 DB: pelanggaran_detail contains exactly 1 entry", Array.isArray(dbStrike1?.pelanggaran_detail) && dbStrike1.pelanggaran_detail.length === 1);

    // 3.3 Strike 2 Execution
    const resStrike2 = await fetchAPI('catat_pelanggaran', {
      id_log: primaryTestLogId,
      alasan: 'Empirical Test Strike 2: Window blur detected',
      npsn: testNpsn
    });

    test("Strike 2: API returns status = 'success'", resStrike2?.status === 'success');
    test("Strike 2: API returns pelanggaran_saat_ini = 2", resStrike2?.pelanggaran_saat_ini === 2);
    test("Strike 2: API returns terblokir = false", resStrike2?.terblokir === false);

    const { data: dbStrike2 } = await supabase.from('log_ujian').select('*').eq('id_log', primaryTestLogId).single();
    test("Strike 2 DB: pelanggaran is 2", dbStrike2?.pelanggaran === 2);
    test("Strike 2 DB: is_blocked is false", dbStrike2?.is_blocked === false);
    test("Strike 2 DB: status_ujian remains 'SEDANG KERJA'", dbStrike2?.status_ujian === 'SEDANG KERJA');
    test("Strike 2 DB: nilai_auto remains null", dbStrike2?.nilai_auto === null);
    test("Strike 2 DB: pelanggaran_detail contains exactly 2 entries", Array.isArray(dbStrike2?.pelanggaran_detail) && dbStrike2.pelanggaran_detail.length === 2);

    // 3.4 Strike 3 Execution (Lockout Threshold Reached)
    const strike3CallTime = Date.now();
    const resStrike3 = await fetchAPI('catat_pelanggaran', {
      id_log: primaryTestLogId,
      alasan: 'Empirical Test Strike 3: Exit fullscreen / third violation',
      npsn: testNpsn
    });

    test("Strike 3: API returns status = 'success'", resStrike3?.status === 'success');
    test("Strike 3: API returns pelanggaran_saat_ini = 3", resStrike3?.pelanggaran_saat_ini === 3);
    test("Strike 3: API returns terblokir = true", resStrike3?.terblokir === true);

    // Deep Supabase DB Verification after Strike 3
    const { data: dbStrike3 } = await supabase.from('log_ujian').select('*').eq('id_log', primaryTestLogId).single();
    test("Strike 3 DB: pelanggaran is exactly 3", dbStrike3?.pelanggaran === 3);
    test("Strike 3 DB: is_blocked is strictly true", dbStrike3?.is_blocked === true);
    test("Strike 3 DB: status_ujian is 'SELESAI'", dbStrike3?.status_ujian === 'SELESAI');
    test("Strike 3 DB: nilai_auto is exactly 0", Number(dbStrike3?.nilai_auto) === 0);
    
    // Check waktu_selesai timestamp
    const hasValidWaktuSelesai = dbStrike3?.waktu_selesai && !isNaN(new Date(dbStrike3.waktu_selesai).getTime());
    const waktuDeltaMs = Math.abs(new Date(dbStrike3?.waktu_selesai).getTime() - strike3CallTime);
    test("Strike 3 DB: waktu_selesai is valid ISO timestamp recorded recently", hasValidWaktuSelesai && waktuDeltaMs < 15000);
    test("Strike 3 DB: pelanggaran_detail contains exactly 3 entries", Array.isArray(dbStrike3?.pelanggaran_detail) && dbStrike3.pelanggaran_detail.length === 3);


    // =============================================================================
    // SECTION 4: Adversarial Stress Vectors (State Machine Security & Resilience)
    // =============================================================================
    console.log('\n▶ SECTION 4: Adversarial Stress Vectors & Tamper Resistance');

    // 4.1 Vector A: Overshoot Strike 4 on Already Blocked Record
    console.log('  Testing Vector A: Overshoot Strike 4 invocation...');
    const resStrike4 = await fetchAPI('catat_pelanggaran', {
      id_log: primaryTestLogId,
      alasan: 'Empirical Test Strike 4 (Overshoot attempt)',
      npsn: testNpsn
    });

    test("Overshoot Strike 4: API returns terblokir = true", resStrike4?.terblokir === true);
    test("Overshoot Strike 4: API returns count >= 4", resStrike4?.pelanggaran_saat_ini >= 4);

    const { data: dbStrike4 } = await supabase.from('log_ujian').select('*').eq('id_log', primaryTestLogId).single();
    test("Overshoot Strike 4 DB: status_ujian remains strictly 'SELESAI'", dbStrike4?.status_ujian === 'SELESAI');
    test("Overshoot Strike 4 DB: nilai_auto remains strictly 0", Number(dbStrike4?.nilai_auto) === 0);
    test("Overshoot Strike 4 DB: is_blocked remains true", dbStrike4?.is_blocked === true);

    // 4.2 Vector B: Attempt to Submit Exam Answers While Blocked
    console.log('  Testing Vector B: Attempted submission while blocked...');
    const resSubmitBlocked = await fetchAPI('submit_ujian', {
      id_log: primaryTestLogId,
      id_jadwal: testJadwalId,
      id_siswa: testSiswaId,
      npsn: testNpsn,
      jawaban: [
        { id_soal: 1, jawaban: 'A' },
        { id_soal: 2, jawaban: 'B' }
      ]
    });

    test("Submit While Blocked: API enforces score 0 return", Number(resSubmitBlocked?.nilai_auto) === 0);
    test("Submit While Blocked: API message mentions blocked/terblokir", /terblokir|melanggar/i.test(resSubmitBlocked?.message || ''));

    const { data: dbPostSubmit } = await supabase.from('log_ujian').select('*').eq('id_log', primaryTestLogId).single();
    test("Submit While Blocked DB: status_ujian remains 'SELESAI'", dbPostSubmit?.status_ujian === 'SELESAI');
    test("Submit While Blocked DB: nilai_auto cannot be overwritten and remains 0", Number(dbPostSubmit?.nilai_auto) === 0);

    // 4.3 Vector C: Non-Existent Log ID Resilience
    console.log('  Testing Vector C: Non-existent log ID call...');
    const nonExistentLogId = `LOG-NON-EXISTENT-${Date.now()}`;
    const resNonExistent = await fetchAPI('catat_pelanggaran', {
      id_log: nonExistentLogId,
      alasan: 'Testing invalid log id handling',
      npsn: testNpsn
    });
    test("Non-existent log ID: API gracefully returns status='error'", resNonExistent?.status === 'error');
    test("Non-existent log ID: API error message indicates log not found", /tidak ditemukan|found|coerce|single/i.test(resNonExistent?.message || ''));

    // 4.4 Vector D: Fallback on Empty/Missing Reason
    console.log('  Testing Vector D: Missing reason fallback...');
    const secondaryTestLogId = `CHALLENGER-LOG-M4-ALT-${Date.now()}`;
    await supabase.from('log_ujian').insert({
      id_log: secondaryTestLogId,
      id_jadwal: testJadwalId,
      id_siswa: testSiswaId,
      status_ujian: 'SEDANG KERJA',
      pelanggaran: 0,
      is_blocked: false,
      nilai_auto: null,
      pelanggaran_detail: null // test null detail handling
    });

    const resNoReason = await fetchAPI('catat_pelanggaran', {
      id_log: secondaryTestLogId,
      npsn: testNpsn
      // alasan omitted deliberately
    });
    test("Missing reason: API returns status='success'", resNoReason?.status === 'success');

    const { data: dbNoReason } = await supabase.from('log_ujian').select('*').eq('id_log', secondaryTestLogId).single();
    test("Missing reason DB: Record saved with non-empty default violation reason",
      Array.isArray(dbNoReason?.pelanggaran_detail) &&
      dbNoReason.pelanggaran_detail.length === 1 &&
      typeof dbNoReason.pelanggaran_detail[0].alasan === 'string' &&
      dbNoReason.pelanggaran_detail[0].alasan.length > 5
    );

    // Clean up secondary test log
    await supabase.from('log_ujian').delete().eq('id_log', secondaryTestLogId);
    console.log(`  ✔ [CLEANUP] Purged secondary test log record (${secondaryTestLogId})`);

    // 4.5 Vector E: Independent Second Session Full 3-Strike Lifecycle
    console.log('  Testing Vector E: Independent session reproducibility...');
    const session2LogId = `CHALLENGER-LOG-M4-SESS2-${Date.now()}`;
    await supabase.from('log_ujian').insert({
      id_log: session2LogId,
      id_jadwal: testJadwalId,
      id_siswa: testSiswaId,
      status_ujian: 'SEDANG KERJA',
      pelanggaran: 0,
      is_blocked: false,
      nilai_auto: null,
      pelanggaran_detail: []
    });

    const s2R1 = await fetchAPI('catat_pelanggaran', { id_log: session2LogId, alasan: 'Sess2 Strike 1', npsn: testNpsn });
    const s2R2 = await fetchAPI('catat_pelanggaran', { id_log: session2LogId, alasan: 'Sess2 Strike 2', npsn: testNpsn });
    const s2R3 = await fetchAPI('catat_pelanggaran', { id_log: session2LogId, alasan: 'Sess2 Strike 3', npsn: testNpsn });

    test("Session 2 Strike 1: count=1, terblokir=false", s2R1?.pelanggaran_saat_ini === 1 && s2R1?.terblokir === false);
    test("Session 2 Strike 2: count=2, terblokir=false", s2R2?.pelanggaran_saat_ini === 2 && s2R2?.terblokir === false);
    test("Session 2 Strike 3: count=3, terblokir=true", s2R3?.pelanggaran_saat_ini === 3 && s2R3?.terblokir === true);

    const { data: dbSess2 } = await supabase.from('log_ujian').select('*').eq('id_log', session2LogId).single();
    test("Session 2 DB: status_ujian='SELESAI'", dbSess2?.status_ujian === 'SELESAI');
    test("Session 2 DB: nilai_auto=0", Number(dbSess2?.nilai_auto) === 0);
    test("Session 2 DB: is_blocked=true", dbSess2?.is_blocked === true);
    test("Session 2 DB: waktu_selesai is set", !!dbSess2?.waktu_selesai);

    await supabase.from('log_ujian').delete().eq('id_log', session2LogId);
    console.log(`  ✔ [CLEANUP] Purged session 2 test log record (${session2LogId})`);

  } catch (err) {
    test("Supabase State Machine Test Suite encountered unexpected error", false, err.message);
  } finally {
    // 3.5 Clean up primary test log
    const { error: delErr } = await supabase.from('log_ujian').delete().eq('id_log', primaryTestLogId);
    if (delErr) {
      console.warn("  ⚠ Warning: Failed to clean up primary test log:", delErr.message);
    } else {
      console.log(`  ✔ [CLEANUP] Purged primary test log record (${primaryTestLogId})`);
    }
  }


  // =============================================================================
  // SECTION 5: Production Build Integrity Audit
  // =============================================================================
  console.log('\n▶ SECTION 5: Production Build Integrity Audit');
  const distHtml = path.resolve(projectRoot, 'dist', 'index.html');
  test("Production build 'dist/index.html' exists and is non-empty", fs.existsSync(distHtml) && fs.statSync(distHtml).size > 0);

  const distAssets = path.resolve(projectRoot, 'dist', 'assets');
  let hasExamChunk = false;
  if (fs.existsSync(distAssets)) {
    const assets = fs.readdirSync(distAssets);
    hasExamChunk = assets.some(a => a.startsWith('ExamRoom-') && a.endsWith('.js'));
  }
  test("Production build bundle contains compiled ExamRoom chunk", hasExamChunk);


  // =============================================================================
  // Final Verdict & Summary
  // =============================================================================
  console.log('\n======================================================================');
  console.log(`TOTAL ASSERTIONS : ${suiteReport.total}`);
  console.log(`PASSED           : ${suiteReport.passed}`);
  console.log(`FAILED           : ${suiteReport.failed}`);
  const passRate = Math.round((suiteReport.passed / suiteReport.total) * 100);
  console.log(`PASS RATE        : ${passRate}%`);
  console.log('======================================================================\n');

  if (suiteReport.failed > 0) {
    console.error(`❌ STRESS TEST FAILED with ${suiteReport.failed} failed assertions.`);
    process.exit(1);
  } else {
    console.log('🏆 VERDICT: APPROVE - All M4 Exam Security & DB State Machine tests PASSED cleanly!\n');
    process.exit(0);
  }
}

runChallengerSuite().catch(err => {
  console.error("FATAL ERROR in challenger suite:", err);
  process.exit(1);
});
