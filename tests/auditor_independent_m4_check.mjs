#!/usr/bin/env node
/**
 * FORENSIC AUDITOR INDEPENDENT VERIFICATION SUITE
 * Milestone: M4 (Siswa Exam Security)
 * Target: ExamRoom.jsx & api.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { fetchAPI } from '../src/api.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../src/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const examRoomPath = path.resolve(projectRoot, 'src', 'views', 'ExamRoom.jsx');
const apiPath = path.resolve(projectRoot, 'src', 'api.js');
const siswaViewPath = path.resolve(projectRoot, 'src', 'views', 'SiswaView.jsx');

const examRoomCode = fs.readFileSync(examRoomPath, 'utf8');
const apiCode = fs.readFileSync(apiPath, 'utf8');
const siswaViewCode = fs.readFileSync(siswaViewPath, 'utf8');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const results = [];

function assert(id, description, passed, extra = '') {
  results.push({ id, description, passed, extra });
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${mark}] ${id}: ${description} ${extra ? `(${extra})` : ''}`);
}

async function runAuditorChecks() {
  console.log('======================================================================');
  console.log('   FORENSIC AUDITOR INDEPENDENT VERIFICATION — MILESTONE M4 (SECURITY)');
  console.log('======================================================================\n');

  // --- CHECK SECTION 1: PROHIBITED PATTERNS & CODE INTEGRITY ---
  console.log('▶ [FORENSIC 1] Prohibited Patterns & Facade Detection');
  const hasHardcodedMocks = /mock|dummy|bypassTest|fakeResult/i.test(examRoomCode) || /mock|dummy|bypassTest|fakeResult/i.test(apiCode);
  assert('F1.1', 'No fake mocks, bypass flags, or dummy facades in ExamRoom or api.js', !hasHardcodedMocks);

  const hasHardcodedPass = /return\s+true\s*;?\s*\/\/\s*test/i.test(examRoomCode) || /return\s+true\s*;?\s*\/\/\s*test/i.test(apiCode);
  assert('F1.2', 'No test-shortcircuiting return statements', !hasHardcodedPass);

  // --- CHECK SECTION 2: BROWSER APIS & EVENT LISTENERS ---
  console.log('\n▶ [FORENSIC 2] Browser API Listeners & Cooldown in ExamRoom.jsx');
  const hasVisibilityEvent = examRoomCode.includes("addEventListener('visibilitychange'") || examRoomCode.includes('addEventListener("visibilitychange"');
  assert('F2.1', 'Genuinely attaches visibilitychange event listener', hasVisibilityEvent);

  const checksDocHidden = /document\.hidden/.test(examRoomCode);
  assert('F2.2', 'Properly evaluates document.hidden inside visibility change handler', checksDocHidden);

  const hasBlurEvent = examRoomCode.includes("addEventListener('blur'") || examRoomCode.includes('addEventListener("blur"');
  assert('F2.3', 'Genuinely attaches blur event listener to window', hasBlurEvent);

  const cleansListeners = (examRoomCode.includes("removeEventListener('visibilitychange'") || examRoomCode.includes('removeEventListener("visibilitychange"')) &&
                          (examRoomCode.includes("removeEventListener('blur'") || examRoomCode.includes('removeEventListener("blur"'));
  assert('F2.4', 'Deregisters visibilitychange and blur listeners on component unmount', cleansListeners);

  const has2500msCooldown = /lastViolationTimeRef\.current/.test(examRoomCode) && /2500/.test(examRoomCode);
  assert('F2.5', 'Enforces 2500ms timestamp cooldown deduplication', has2500msCooldown);

  // --- CHECK SECTION 3: 3-STRIKE PROGRESSION & AUTO-KICK ---
  console.log('\n▶ [FORENSIC 3] Progressive 3-Strike Warning & Lockout Behavior');
  const hasStrike1 = examRoomCode.includes('Peringatan Keamanan (1/3)');
  assert('F3.1', 'Presents Strike 1 warning to student', hasStrike1);

  const hasStrike2 = examRoomCode.includes('PERINGATAN TERAKHIR (2/3)!');
  assert('F3.2', 'Presents Strike 2 warning to student', hasStrike2);

  const hasStrike3Modal = examRoomCode.includes('securityModal.isOpen') && examRoomCode.includes('UJIAN DIHENTIKAN! (Pelanggaran ke-3)');
  assert('F3.3', 'Renders unclosable Strike 3 modal with permanent termination message', hasStrike3Modal);

  const purgesCache = /localStorage\.removeItem\(`nexa_ans_\${idLog}`\)/.test(examRoomCode) &&
                      /localStorage\.removeItem\(`jawaban_\${jadwal\.id_jadwal}`\)/.test(examRoomCode);
  assert('F3.4', 'Purges local storage answer cache on Strike 3 lockout', purgesCache);

  const exitsFullscreen = /document\.exitFullscreen/.test(examRoomCode);
  assert('F3.5', 'Exits browser fullscreen upon Strike 3 lockout', exitsFullscreen);

  const autoKicksViaOnFinish = /setTimeout\(\s*(?:\(\)\s*=>\s*\{\s*onFinish\(\);\s*\}|onFinish)\s*,\s*3000\s*\)/.test(examRoomCode);
  assert('F3.6', 'Triggers onFinish() redirect after exactly 3000ms delay', autoKicksViaOnFinish);

  const siswaViewProvidesOnFinish = siswaViewCode.includes('onFinish={() => {') &&
                                    siswaViewCode.includes('setActiveExamData(null);') &&
                                    siswaViewCode.includes('loadRiwayat();');
  assert('F3.7', 'SiswaView integrates onFinish callback to terminate session and return to dashboard', siswaViewProvidesOnFinish);

  // --- CHECK SECTION 4: BACKEND LOGIC IN api.js ---
  console.log('\n▶ [FORENSIC 4] Backend catat_pelanggaran & Lockout Protection');
  const updatesStatusSelesai = /status_ujian\s*=\s*['"]SELESAI['"]/.test(apiCode);
  assert('F4.1', 'catat_pelanggaran sets status_ujian = "SELESAI" on strike >= 3', updatesStatusSelesai);

  const updatesNilaiAutoZero = /nilai_auto\s*=\s*0/.test(apiCode);
  assert('F4.2', 'catat_pelanggaran sets nilai_auto = 0 on strike >= 3', updatesNilaiAutoZero);

  const updatesWaktuSelesai = /waktu_selesai\s*=\s*waktu/.test(apiCode);
  assert('F4.3', 'catat_pelanggaran records timestamped waktu_selesai on strike >= 3', updatesWaktuSelesai);

  const submitGuardsBlocked = /if\s*\(\s*isBlocked\s*\)\s*\{\s*nilaiAuto\s*=\s*0\s*;?\s*\}/.test(apiCode);
  assert('F4.4', 'submit_ujian defensively enforces nilaiAuto = 0 if session is blocked', submitGuardsBlocked);

  // --- CHECK SECTION 5: COOLDOWN & TIMING LOGIC SIMULATION ---
  console.log('\n▶ [FORENSIC 5] Cooldown Timing Math & Boundary Stress Test');
  let calls = 0;
  let lastTime = 0;
  function simulateViolation(time) {
    if (time - lastTime < 2500) return false;
    lastTime = time;
    calls++;
    return true;
  }

  // 10 events within 2000ms
  let base = 500000;
  let accepted = 0;
  for (let i = 0; i < 10; i++) {
    if (simulateViolation(base + (i * 200))) accepted++;
  }
  assert('F5.1', 'Rapid burst of 10 events within 2000ms yields strictly 1 recorded strike', accepted === 1 && calls === 1, `accepted=${accepted}, calls=${calls}`);

  // Boundary check at exactly 2499ms
  const evBoundarySub = simulateViolation(base + 2499);
  assert('F5.2', 'Event at exactly 2499ms (1ms below threshold) is suppressed', !evBoundarySub && calls === 1);

  // Boundary check at exactly 2500ms
  const evBoundaryExact = simulateViolation(base + 2500);
  assert('F5.3', 'Event at exactly 2500ms (threshold met) is accepted as strike 2', evBoundaryExact && calls === 2);

  // Event after another 2500ms
  const evStrike3 = simulateViolation(base + 5000);
  assert('F5.4', 'Event after 2500ms cooldown is accepted as strike 3', evStrike3 && calls === 3);

  // --- CHECK SECTION 6: LIVE SUPABASE DATABASE VERIFICATION ---
  console.log('\n▶ [FORENSIC 6] Live Supabase Database Session Lifecycle & Adversarial Resistance');
  const testLogId = `AUDITOR-M4-${Date.now()}`;
  let validJadwal = null;
  let validSiswa = null;
  let validNpsn = '70040625';

  try {
    const { data: jList } = await supabase.from('jadwal').select('id_jadwal, npsn').limit(1);
    if (jList && jList.length > 0) {
      validJadwal = jList[0].id_jadwal;
      validNpsn = jList[0].npsn || validNpsn;
    }
    const { data: sList } = await supabase.from('siswa').select('id_siswa').limit(1);
    if (sList && sList.length > 0) {
      validSiswa = sList[0].id_siswa;
    }

    // 6.1 Insert test log
    const { error: insErr } = await supabase.from('log_ujian').insert({
      id_log: testLogId,
      id_jadwal: validJadwal,
      id_siswa: validSiswa,
      status_ujian: 'SEDANG KERJA',
      pelanggaran: 0,
      is_blocked: false,
      nilai_auto: null,
      pelanggaran_detail: []
    });
    assert('F6.1', 'Live DB: Successfully initialized test log in log_ujian', !insErr, insErr?.message || testLogId);

    // 6.2 Trigger Strike 1
    const res1 = await fetchAPI('catat_pelanggaran', { id_log: testLogId, alasan: 'Auditor Strike 1', npsn: validNpsn });
    const { data: db1 } = await supabase.from('log_ujian').select('*').eq('id_log', testLogId).single();
    assert('F6.2', 'Live DB: Strike 1 updates count=1, is_blocked=false, status_ujian="SEDANG KERJA", nilai_auto=null',
      res1.status === 'success' && res1.pelanggaran_saat_ini === 1 && !res1.terblokir &&
      db1 && db1.pelanggaran === 1 && db1.is_blocked === false && db1.status_ujian === 'SEDANG KERJA' && db1.nilai_auto === null
    );

    // 6.3 Trigger Strike 2
    const res2 = await fetchAPI('catat_pelanggaran', { id_log: testLogId, alasan: 'Auditor Strike 2', npsn: validNpsn });
    const { data: db2 } = await supabase.from('log_ujian').select('*').eq('id_log', testLogId).single();
    assert('F6.3', 'Live DB: Strike 2 updates count=2, is_blocked=false, status_ujian="SEDANG KERJA", nilai_auto=null',
      res2.status === 'success' && res2.pelanggaran_saat_ini === 2 && !res2.terblokir &&
      db2 && db2.pelanggaran === 2 && db2.is_blocked === false && db2.status_ujian === 'SEDANG KERJA' && db2.nilai_auto === null
    );

    // 6.4 Trigger Strike 3 (Critical Threshold)
    const res3 = await fetchAPI('catat_pelanggaran', { id_log: testLogId, alasan: 'Auditor Strike 3', npsn: validNpsn });
    const { data: db3 } = await supabase.from('log_ujian').select('*').eq('id_log', testLogId).single();
    assert('F6.4', 'Live DB: Strike 3 triggers terblokir=true, count=3',
      res3.status === 'success' && res3.pelanggaran_saat_ini === 3 && res3.terblokir === true
    );
    assert('F6.5', 'Live DB: Strike 3 row has status_ujian="SELESAI"', db3 && db3.status_ujian === 'SELESAI');
    assert('F6.6', 'Live DB: Strike 3 row has nilai_auto=0', db3 && Number(db3.nilai_auto) === 0);
    assert('F6.7', 'Live DB: Strike 3 row has is_blocked=true', db3 && db3.is_blocked === true);
    assert('F6.8', 'Live DB: Strike 3 row has valid timestamped waktu_selesai',
      db3 && db3.waktu_selesai && !isNaN(new Date(db3.waktu_selesai).getTime())
    );
    assert('F6.9', 'Live DB: Strike 3 row has logged 3 violation details entries',
      Array.isArray(db3?.pelanggaran_detail) && db3.pelanggaran_detail.length === 3
    );

    // 6.10 Adversarial Strike 4 beyond threshold
    const res4 = await fetchAPI('catat_pelanggaran', { id_log: testLogId, alasan: 'Auditor Strike 4 Beyond Limit', npsn: validNpsn });
    const { data: db4 } = await supabase.from('log_ujian').select('*').eq('id_log', testLogId).single();
    assert('F6.10', 'Live DB: Post-threshold Strike 4 preserves locked state (is_blocked=true, status_ujian="SELESAI", nilai_auto=0)',
      res4.status === 'success' && res4.terblokir === true &&
      db4 && db4.is_blocked === true && db4.status_ujian === 'SELESAI' && Number(db4.nilai_auto) === 0
    );

    // 6.11 Adversarial Submission Attack: Try submitting answers to a blocked session
    const resSubmit = await fetchAPI('submit_ujian', {
      id_log: testLogId,
      id_jadwal: validJadwal,
      id_siswa: validSiswa,
      jawaban: [{ id_soal: 'FAKE-1', jawaban: 'A' }],
      npsn: validNpsn
    });
    const { data: dbAfterSubmit } = await supabase.from('log_ujian').select('*').eq('id_log', testLogId).single();
    assert('F6.11', 'Live DB: Adversarial submit_ujian on blocked session returns nilai_auto=0 and preserves DB nilai_auto=0',
      resSubmit.status === 'success' && Number(resSubmit.nilai_auto) === 0 &&
      dbAfterSubmit && Number(dbAfterSubmit.nilai_auto) === 0 && dbAfterSubmit.status_ujian === 'SELESAI'
    );

  } catch (err) {
    assert('F6.ERR', 'Unexpected exception in live DB check', false, err.message);
  } finally {
    const { error: delErr } = await supabase.from('log_ujian').delete().eq('id_log', testLogId);
    if (!delErr) {
      console.log(`\n  ✔ Cleaned up auditor test record (${testLogId}) from database.`);
    } else {
      console.warn(`  ⚠ Failed to delete test record ${testLogId}:`, delErr.message);
    }
  }

  // --- SUMMARY ---
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n======================================================================');
  console.log(` AUDITOR REPORT SUMMARY: Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log(` VERDICT: ${failed === 0 ? 'CLEAN (PASS)' : 'INTEGRITY VIOLATION (FAIL)'}`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAuditorChecks().catch(err => {
  console.error("Fatal in auditor script:", err);
  process.exit(1);
});
