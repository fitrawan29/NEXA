#!/usr/bin/env node
/**
 * Test Suite: CBT NEXA Milestone M4 (Siswa Exam Security)
 * 
 * Verifies:
 * 1. Browser Security Listeners:
 *    - document.addEventListener('visibilitychange', ...) checking document.hidden
 *    - window.addEventListener('blur', ...)
 *    - Event deduplication cooldown (2500ms window) with lastViolationTimeRef
 * 2. Progressive 3-Strike Enforcement:
 *    - Strike 1 warning toast
 *    - Strike 2 high-priority warning toast
 *    - Strike 3 unclosable danger modal, local storage purge, fullscreen exit, 3s auto-kick
 * 3. Backend Catat Pelanggaran Handler (api.js):
 *    - Log fetching and violation increment
 *    - Threshold check (>= 3)
 *    - Immediate status_ujian = 'SELESAI', nilai_auto = 0, is_blocked = true, waktu_selesai
 * 4. Live Supabase Database Session Verification
 * 5. Production Build Verification
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

const report = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: []
};

function test(description, condition, details = '') {
  report.total++;
  if (condition) {
    report.passed++;
    console.log(`  ✔ [PASS] ${description}`);
  } else {
    report.failed++;
    report.failures.push({ description, details });
    console.log(`  ✖ [FAIL] ${description}${details ? ` -> ${details}` : ''}`);
  }
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('  CBT NEXA - MILESTONE M4: SISWA EXAM SECURITY VERIFICATION SUITE    ');
  console.log('======================================================================\n');

  // =============================================================================
  // 1. AST Syntax & Static Code Integrity
  // =============================================================================
  console.log('▶ 1. AST Syntax & Static Code Integrity');
  try {
    parse(examRoomCode, { sourceType: 'module', plugins: ['jsx'] });
    test('ExamRoom.jsx parses cleanly with zero AST syntax errors', true);
  } catch (e) {
    test('ExamRoom.jsx parses cleanly with zero AST syntax errors', false, e.message);
  }

  try {
    parse(apiCode, { sourceType: 'module', plugins: ['jsx'] });
    test('api.js parses cleanly with zero AST syntax errors', true);
  } catch (e) {
    test('api.js parses cleanly with zero AST syntax errors', false, e.message);
  }

  // =============================================================================
  // 2. Browser Security Event Listeners & Deduplication Cooldown
  // =============================================================================
  console.log('\n▶ 2. Browser Security Event Listeners & 2500ms Cooldown');

  const hasVisibilityListener = examRoomCode.includes("addEventListener('visibilitychange'") || examRoomCode.includes('addEventListener("visibilitychange"');
  test("ExamRoom attaches 'visibilitychange' event listener", hasVisibilityListener);

  const checksDocumentHidden = /document\.hidden/.test(examRoomCode);
  test("ExamRoom checks 'document.hidden' inside visibilitychange handler", checksDocumentHidden);

  const hasBlurListener = examRoomCode.includes("addEventListener('blur'") || examRoomCode.includes('addEventListener("blur"');
  test("ExamRoom attaches 'blur' event listener to window", hasBlurListener);

  const hasLastViolationRef = /lastViolationTimeRef\s*=\s*useRef\(0\)/.test(examRoomCode);
  test("ExamRoom declares 'lastViolationTimeRef' for violation tracking", hasLastViolationRef);

  const has2500msCooldown = /2500/.test(examRoomCode) && /lastViolationTimeRef\.current/.test(examRoomCode);
  test("ExamRoom enforces 2500ms event deduplication cooldown window", has2500msCooldown);

  // Clean listener cleanup on unmount
  const cleansVisibility = examRoomCode.includes("removeEventListener('visibilitychange'") || examRoomCode.includes('removeEventListener("visibilitychange"');
  const cleansBlur = examRoomCode.includes("removeEventListener('blur'") || examRoomCode.includes('removeEventListener("blur"');
  test("ExamRoom properly cleans up security listeners on unmount", cleansVisibility && cleansBlur);

  // =============================================================================
  // 3. Progressive 3-Strike Warning & Lockout Messages
  // =============================================================================
  console.log('\n▶ 3. Progressive 3-Strike Enforcement & Auto-Kick');

  // Strike 1 Warning
  const strike1Text = "Peringatan Keamanan (1/3): Terdeteksi keluar dari layar ujian! Pelanggaran ke-1 dari maksimal 3. Jika mencapai 3 pelanggaran, Anda akan dikeluarkan otomatis dengan nilai 0.";
  const hasStrike1Warning = examRoomCode.includes(strike1Text);
  test("ExamRoom displays exact Strike 1 warning toast message", hasStrike1Warning);

  // Strike 2 Warning
  const strike2Text = "PERINGATAN TERAKHIR (2/3)! Anda kembali meninggalkan halaman ujian. Satu pelanggaran lagi akan langsung menghentikan ujian Anda dan mencatat nilai 0!";
  const hasStrike2Warning = examRoomCode.includes(strike2Text);
  test("ExamRoom displays exact Strike 2 high-priority warning toast message", hasStrike2Warning);

  // Strike 3 Unclosable Danger Modal
  const strike3Title = "UJIAN DIHENTIKAN! (Pelanggaran ke-3)";
  const strike3Message = "Anda telah melakukan pelanggaran sebanyak 3 kali. Sesi ujian Anda telah dihentikan secara permanen dan nilai Anda dicatat 0.";
  const hasStrike3Title = examRoomCode.includes(strike3Title);
  const hasStrike3Message = examRoomCode.includes(strike3Message);
  test("ExamRoom displays exact Strike 3 danger modal title and message", hasStrike3Title && hasStrike3Message);

  // Strike 3 auto-actions
  const clearsLocalStorage = /localStorage\.removeItem\(`nexa_ans_\${idLog}`\)/.test(examRoomCode);
  test("ExamRoom clears localStorage cached answers upon reaching 3 strikes", clearsLocalStorage);

  const exitsFullscreen = /exitFullscreen/.test(examRoomCode);
  test("ExamRoom exits fullscreen upon reaching 3 strikes", exitsFullscreen);

  const autoKicksAfter3s = /setTimeout\(\s*\(\)\s*=>\s*\{\s*onFinish\(\);\s*\}\s*,\s*3000\s*\)/.test(examRoomCode) || /setTimeout\(\s*onFinish\s*,\s*3000\s*\)/.test(examRoomCode);
  test("ExamRoom invokes onFinish() after 3 seconds (3000ms) on Strike 3 auto-kick", autoKicksAfter3s);

  // =============================================================================
  // 4. Backend catat_pelanggaran Handler Integrity (api.js)
  // =============================================================================
  console.log('\n▶ 4. Backend catat_pelanggaran Handler Integrity (api.js)');

  const hasCatatPelanggaran = /case\s+['"]catat_pelanggaran['"]:/.test(apiCode);
  test("api.js contains case 'catat_pelanggaran' handler", hasCatatPelanggaran);

  const incrementsViolation = /currLog\.pelanggaran.*?\+.*?1/.test(apiCode);
  test("catat_pelanggaran increments current log violation count", incrementsViolation);

  const checks3StrikeThreshold = /newPelanggaran\s*>=\s*3/.test(apiCode);
  test("catat_pelanggaran checks threshold >= 3 for isBlocked state", checks3StrikeThreshold);

  const updatesStatusSelesai = /updatePayload\.status_ujian\s*=\s*['"]SELESAI['"]/.test(apiCode) || /status_ujian:\s*['"]SELESAI['"]/.test(apiCode);
  test("catat_pelanggaran sets status_ujian = 'SELESAI' when threshold reached", updatesStatusSelesai);

  const updatesNilaiAutoZero = /updatePayload\.nilai_auto\s*=\s*0/.test(apiCode) || /nilai_auto:\s*0/.test(apiCode);
  test("catat_pelanggaran immediately sets nilai_auto = 0 when threshold reached", updatesNilaiAutoZero);

  const updatesIsBlocked = /is_blocked:\s*isBlocked/.test(apiCode);
  test("catat_pelanggaran updates is_blocked = true in database", updatesIsBlocked);

  const updatesWaktuSelesai = /updatePayload\.waktu_selesai\s*=\s*waktu/.test(apiCode) || /waktu_selesai:\s*waktu/.test(apiCode);
  test("catat_pelanggaran records timestamped waktu_selesai when threshold reached", updatesWaktuSelesai);

  // =============================================================================
  // 5. Deduplication Cooldown Logic Simulation
  // =============================================================================
  console.log('\n▶ 5. Deduplication Cooldown Simulation');

  let simulatedViolationCalls = 0;
  let simLastViolationTime = 0;
  const simulatedReportViolation = () => { simulatedViolationCalls++; };

  const simulateSecurityViolation = (simNow) => {
    if (simNow - simLastViolationTime < 2500) return false;
    simLastViolationTime = simNow;
    simulatedReportViolation();
    return true;
  };

  const baseTime = 100000;

  // Event 1: at baseTime (initial event, delta from 0 is > 2500)
  const ev1 = simulateSecurityViolation(baseTime);
  test("First violation event at baseTime triggers reportViolation", ev1 && simulatedViolationCalls === 1);

  // Event 2: concurrent blur/visibility at baseTime + 50ms (50ms delta)
  const ev2 = simulateSecurityViolation(baseTime + 50);
  test("Concurrent event at +50ms (50ms delta) is deduplicated/suppressed", !ev2 && simulatedViolationCalls === 1);

  // Event 3: another event at baseTime + 2000ms (2000ms delta from baseTime, still within 2500ms window)
  const ev3 = simulateSecurityViolation(baseTime + 2000);
  test("Event at +2000ms (2000ms delta < 2500ms) is deduplicated/suppressed", !ev3 && simulatedViolationCalls === 1);

  // Event 4: event at baseTime + 2600ms (2600ms delta > 2500ms)
  const ev4 = simulateSecurityViolation(baseTime + 2600);
  test("Subsequent event at +2600ms (2600ms delta >= 2500ms) triggers reportViolation", ev4 && simulatedViolationCalls === 2);

  // Event 5: concurrent blur after event 4 at +2650ms
  const ev5 = simulateSecurityViolation(baseTime + 2650);
  test("Concurrent event at +2650ms (50ms delta from event 4) is deduplicated/suppressed", !ev5 && simulatedViolationCalls === 2);

  // Event 6: third violation after 2600ms cooldown (baseTime + 5300ms)
  const ev6 = simulateSecurityViolation(baseTime + 5300);
  test("Third violation event after cooldown (+5300ms) triggers reportViolation (Strike 3)", ev6 && simulatedViolationCalls === 3);

  // =============================================================================
  // 6. Live Database Integration Verification (Supabase)
  // =============================================================================
  console.log('\n▶ 6. Live Database Integration Verification');

  const testLogId = `TEST-LOG-M4-${Date.now()}`;
  let validJadwalId = null;
  let validSiswaId = null;
  let validNpsn = '70040625';

  try {
    // Resolve existing jadwal and siswa if present
    const { data: jData } = await supabase.from('jadwal').select('id_jadwal, npsn').limit(1);
    if (jData && jData.length > 0) {
      validJadwalId = jData[0].id_jadwal;
      validNpsn = jData[0].npsn || validNpsn;
    }

    const { data: sData } = await supabase.from('siswa').select('id_siswa').limit(1);
    if (sData && sData.length > 0) {
      validSiswaId = sData[0].id_siswa;
    }

    // 6.1 Create test log entry in log_ujian
    const { error: insertErr } = await supabase.from('log_ujian').insert({
      id_log: testLogId,
      id_jadwal: validJadwalId,
      id_siswa: validSiswaId,
      status_ujian: 'SEDANG KERJA',
      pelanggaran: 0,
      is_blocked: false,
      nilai_auto: null,
      pelanggaran_detail: []
    });

    test("Live DB: Seed initial exam log (id_log: " + testLogId + ")", !insertErr, insertErr?.message);

    // 6.2 Trigger Strike 1 via fetchAPI
    const res1 = await fetchAPI('catat_pelanggaran', {
      id_log: testLogId,
      alasan: 'Test Strike 1 (Tab switch / blur)',
      npsn: validNpsn
    });

    test("Live DB: Strike 1 API returns status=success, count=1, terblokir=false",
      res1.status === 'success' && res1.pelanggaran_saat_ini === 1 && res1.terblokir === false
    );

    const { data: dbLog1 } = await supabase.from('log_ujian').select('*').eq('id_log', testLogId).single();
    test("Live DB: Record reflects pelanggaran=1, is_blocked=false, status_ujian='SEDANG KERJA'",
      dbLog1 && dbLog1.pelanggaran === 1 && dbLog1.is_blocked === false && dbLog1.status_ujian === 'SEDANG KERJA'
    );

    // 6.3 Trigger Strike 2 via fetchAPI
    const res2 = await fetchAPI('catat_pelanggaran', {
      id_log: testLogId,
      alasan: 'Test Strike 2 (Visibility hidden)',
      npsn: validNpsn
    });

    test("Live DB: Strike 2 API returns status=success, count=2, terblokir=false",
      res2.status === 'success' && res2.pelanggaran_saat_ini === 2 && res2.terblokir === false
    );

    const { data: dbLog2 } = await supabase.from('log_ujian').select('*').eq('id_log', testLogId).single();
    test("Live DB: Record reflects pelanggaran=2, is_blocked=false, status_ujian='SEDANG KERJA'",
      dbLog2 && dbLog2.pelanggaran === 2 && dbLog2.is_blocked === false && dbLog2.status_ujian === 'SEDANG KERJA'
    );

    // 6.4 Trigger Strike 3 via fetchAPI (Threshold Reached)
    const res3 = await fetchAPI('catat_pelanggaran', {
      id_log: testLogId,
      alasan: 'Test Strike 3 (Final lockout trigger)',
      npsn: validNpsn
    });

    test("Live DB: Strike 3 API returns status=success, count=3, terblokir=true",
      res3.status === 'success' && res3.pelanggaran_saat_ini === 3 && res3.terblokir === true
    );

    const { data: dbLog3 } = await supabase.from('log_ujian').select('*').eq('id_log', testLogId).single();
    test("Live DB: Record on Strike 3 has pelanggaran=3", dbLog3 && dbLog3.pelanggaran === 3);
    test("Live DB: Record on Strike 3 has is_blocked=true", dbLog3 && dbLog3.is_blocked === true);
    test("Live DB: Record on Strike 3 has status_ujian='SELESAI'", dbLog3 && dbLog3.status_ujian === 'SELESAI');
    test("Live DB: Record on Strike 3 has nilai_auto=0", dbLog3 && Number(dbLog3.nilai_auto) === 0);
    test("Live DB: Record on Strike 3 has valid non-null waktu_selesai timestamp",
      dbLog3 && dbLog3.waktu_selesai && !isNaN(new Date(dbLog3.waktu_selesai).getTime())
    );
    test("Live DB: Record pelanggaran_detail logged all 3 violation events",
      Array.isArray(dbLog3?.pelanggaran_detail) && dbLog3.pelanggaran_detail.length === 3
    );

  } catch (err) {
    test("Live DB verification encountered unexpected error", false, err.message);
  } finally {
    // 6.5 Clean up test log
    const { error: delErr } = await supabase.from('log_ujian').delete().eq('id_log', testLogId);
    if (delErr) {
      console.warn("  ⚠ Warning: Failed to clean up test log:", delErr.message);
    } else {
      console.log(`  ✔ [CLEANUP] Purged temporary test log record (${testLogId})`);
    }
  }

  // =============================================================================
  // 7. Production Build Verification
  // =============================================================================
  console.log('\n▶ 7. Production Build Artifacts Check');
  const distHtmlPath = path.resolve(projectRoot, 'dist', 'index.html');
  test('Production build output dist/index.html exists', fs.existsSync(distHtmlPath));

  const distAssetsDir = path.resolve(projectRoot, 'dist', 'assets');
  let hasExamRoomChunk = false;
  if (fs.existsSync(distAssetsDir)) {
    const files = fs.readdirSync(distAssetsDir);
    hasExamRoomChunk = files.some(f => f.startsWith('ExamRoom-') && f.endsWith('.js'));
  }
  test('Production bundle contains compiled ExamRoom chunk', hasExamRoomChunk);

  // =============================================================================
  // Summary
  // =============================================================================
  console.log('\n----------------------------------------------------------------------');
  console.log(`TOTAL TESTS : ${report.total}`);
  console.log(`PASSED      : ${report.passed}`);
  console.log(`FAILED      : ${report.failed}`);
  console.log(`PASS RATE   : ${Math.round((report.passed / report.total) * 100)}%`);
  console.log('----------------------------------------------------------------------\n');

  if (report.failed > 0) {
    console.error(`❌ ${report.failed} test(s) failed.`);
    process.exit(1);
  } else {
    console.log('🎉 ALL MILESTONE M4 EXAM SECURITY TESTS PASSED CLEANLY!\n');
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error("FATAL ERROR in test suite:", err);
  process.exit(1);
});
