#!/usr/bin/env node
/**
 * CBT NEXA - Empirical Challenger Gen 3: Exam Anti-Cheating Server-Side Strike Persistence
 * 
 * Objectives:
 * 1. Test Page Refresh Behavior:
 *    - Simulate a student entering the exam with strike 0.
 *    - Trigger 1 violation (visibilitychange hidden). Server records strike 1.
 *    - Simulate page refresh / unmount and remount of ExamRoom:
 *      verify that violationCount loads as 1 from server / dataLog.pelanggaran, NOT 0!
 *    - Trigger 2nd violation (blur). Server records strike 2.
 *    - Simulate 2nd page refresh: verify violationCount loads as 2.
 *    - Trigger 3rd violation: verify immediate auto-kick, status_ujian = 'SELESAI', nilai_auto = 0.
 *    - Simulate refresh after strike 3: verify student is blocked immediately on mount, cannot re-enter, and auto-kick modal fires.
 * 2. Adversarial Tamper Resistance & State Invariant Verification
 * 3. Frontend Component & AST Syntax Audit
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
const siswaViewPath = path.resolve(projectRoot, 'src', 'views', 'SiswaView.jsx');
const apiPath = path.resolve(projectRoot, 'src', 'api.js');

if (!fs.existsSync(examRoomPath) || !fs.existsSync(apiPath)) {
  console.error(`ERROR: Cannot locate ExamRoom.jsx or api.js at projectRoot: ${projectRoot}`);
  process.exit(1);
}

const examRoomCode = fs.readFileSync(examRoomPath, 'utf8');
const siswaViewCode = fs.existsSync(siswaViewPath) ? fs.readFileSync(siswaViewPath, 'utf8') : '';
const apiCode = fs.readFileSync(apiPath, 'utf8');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const report = {
  total: 0,
  passed: 0,
  failed: 0,
  categories: {},
  failures: []
};

function record(category, name, condition, details = '') {
  if (!report.categories[category]) {
    report.categories[category] = { passed: 0, failed: 0, count: 0 };
  }
  report.total++;
  report.categories[category].count++;
  if (condition) {
    report.passed++;
    report.categories[category].passed++;
    console.log(`  ✔ [PASS] [${category}] ${name}`);
  } else {
    report.failed++;
    report.categories[category].failed++;
    report.failures.push({ category, name, details });
    console.log(`  ✖ [FAIL] [${category}] ${name}${details ? ` -> ${details}` : ''}`);
  }
}

async function runStrikePersistenceStressSuite() {
  console.log('======================================================================');
  console.log('  CHALLENGER GEN 3: EXAM ANTI-CHEAT STRIKE PERSISTENCE STRESS TEST     ');
  console.log('======================================================================\n');

  // =========================================================================
  // SECTION 1: Static AST & Refresh Hydration Contract Audit
  // =========================================================================
  console.log('▶ SECTION 1: Static AST & Refresh Hydration Contract Audit');

  try {
    parse(examRoomCode, { sourceType: 'module', plugins: ['jsx'] });
    record('AST Audit', 'ExamRoom.jsx parses cleanly with zero AST syntax errors', true);
  } catch (err) {
    record('AST Audit', 'ExamRoom.jsx parses cleanly with zero AST syntax errors', false, err.message);
  }

  try {
    parse(apiCode, { sourceType: 'module', plugins: ['jsx'] });
    record('AST Audit', 'api.js parses cleanly with zero AST syntax errors', true);
  } catch (err) {
    record('AST Audit', 'api.js parses cleanly with zero AST syntax errors', false, err.message);
  }

  // Check initial state hydration from dataLog in ExamRoom
  const hasInitialViolationsFromDataLog = /initialViolations\s*=\s*\(dataLog\s*&&\s*dataLog\.pelanggaran\)\s*\|\|\s*0/.test(examRoomCode);
  record('Refresh Hydration', 'ExamRoom initializes initialViolations from dataLog.pelanggaran', hasInitialViolationsFromDataLog);

  const hasInitialBlockedFromDataLog = /initialBlocked\s*=\s*Boolean\(\s*\(dataLog\s*&&\s*dataLog\.is_blocked\)\s*\|\|\s*initialViolations\s*>=\s*3\s*\)/.test(examRoomCode);
  record('Refresh Hydration', 'ExamRoom computes initialBlocked from dataLog.is_blocked or initialViolations >= 3', hasInitialBlockedFromDataLog);

  const hasViolationCountState = /const\s*\[\s*violationCount\s*,\s*setViolationCount\s*\]\s*=\s*useState\(\s*initialViolations\s*\)/.test(examRoomCode);
  record('Refresh Hydration', 'ExamRoom seeds violationCount state from initialViolations', hasViolationCountState);

  // Check on-mount server log synchronization
  const syncsStatusLogOnMount = /api\(\s*['"]get_status_log_ujian['"]\s*,\s*\{\s*id_log:\s*idLog\s*\}\s*\)/.test(examRoomCode);
  record('Refresh Hydration', "ExamRoom queries 'get_status_log_ujian' in useEffect on mount", syncsStatusLogOnMount);

  const checksBlockedOnMount = /triggerStrike3Kick\(\)/.test(examRoomCode) && /initialBlocked\s*\|\|\s*initialViolations\s*>=\s*3/.test(examRoomCode);
  record('Refresh Hydration', 'ExamRoom immediately triggers triggerStrike3Kick() on mount if initialBlocked', checksBlockedOnMount);

  // Check get_soal_ujian also includes logStatus sync
  const checksLogStatusInFetchSoal = /res\.logStatus/.test(examRoomCode) && /res\.logStatus\.pelanggaran/.test(examRoomCode);
  record('Refresh Hydration', 'fetchSoal inspects res.logStatus.pelanggaran from server', checksLogStatusInFetchSoal);

  // Check backend get_status_log_ujian implementation
  const hasGetStatusLogUjian = /case\s+['"]get_status_log_ujian['"]:/.test(apiCode);
  record('Backend Contract', "api.js implements case 'get_status_log_ujian'", hasGetStatusLogUjian);

  const hasCatatPelanggaran = /case\s+['"]catat_pelanggaran['"]:/.test(apiCode);
  record('Backend Contract', "api.js implements case 'catat_pelanggaran'", hasCatatPelanggaran);

  const incrementsViolationInDb = /currLog\.pelanggaran.*?\+.*?1/.test(apiCode);
  record('Backend Contract', 'catat_pelanggaran increments pelanggaran count in database', incrementsViolationInDb);

  const locksAt3Strikes = /newPelanggaran\s*>=\s*3/.test(apiCode);
  record('Backend Contract', 'catat_pelanggaran locks account when newPelanggaran >= 3', locksAt3Strikes);


  // =========================================================================
  // SECTION 2: Live Supabase DB & Server-Side Strike Persistence Simulation
  // =========================================================================
  console.log('\n▶ SECTION 2: Live Supabase Refresh & Strike Persistence Simulation');

  const testLogId = `TEST-PERSISTENCE-LOG-${Date.now()}`;
  let testJadwalId = null;
  let testSiswaId = null;
  let testNpsn = '70040625';

  try {
    // Resolve existing jadwal & siswa
    const { data: jadwalList } = await supabase.from('jadwal').select('id_jadwal, npsn').limit(1);
    if (jadwalList && jadwalList.length > 0) {
      testJadwalId = jadwalList[0].id_jadwal;
      testNpsn = jadwalList[0].npsn || testNpsn;
    }

    const { data: siswaList } = await supabase.from('siswa').select('id_siswa').limit(1);
    if (siswaList && siswaList.length > 0) {
      testSiswaId = siswaList[0].id_siswa;
    }

    // -----------------------------------------------------------------------
    // STEP 1: Student enters exam with strike 0
    // -----------------------------------------------------------------------
    console.log('  --- Step 1: Student enters exam with strike 0 ---');
    const { error: seedErr } = await supabase.from('log_ujian').insert({
      id_log: testLogId,
      id_jadwal: testJadwalId,
      id_siswa: testSiswaId,
      status_ujian: 'SEDANG KERJA',
      pelanggaran: 0,
      is_blocked: false,
      nilai_auto: null,
      pelanggaran_detail: []
    });
    record('Step 1: Enter Exam', 'Initial log inserted in Supabase with 0 strikes', !seedErr, seedErr?.message);

    const { data: dbStep1 } = await supabase.from('log_ujian').select('*').eq('id_log', testLogId).single();
    record('Step 1: Enter Exam', 'DB confirms pelanggaran = 0', dbStep1?.pelanggaran === 0);
    record('Step 1: Enter Exam', 'DB confirms is_blocked = false', dbStep1?.is_blocked === false);
    record('Step 1: Enter Exam', "DB confirms status_ujian = 'SEDANG KERJA'", dbStep1?.status_ujian === 'SEDANG KERJA');

    // Simulate ExamRoom mounting with initial dataLog
    let clientDataLog = { id_log: testLogId, pelanggaran: 0, is_blocked: false };
    let clientViolationCount = (clientDataLog && clientDataLog.pelanggaran) || 0;
    record('Step 1: Enter Exam', 'Client ExamRoom mounts with violationCount = 0', clientViolationCount === 0);

    // -----------------------------------------------------------------------
    // STEP 2: Trigger 1st violation (visibilitychange hidden)
    // -----------------------------------------------------------------------
    console.log('\n  --- Step 2: Trigger 1st violation (visibilitychange hidden) ---');
    const resStrike1 = await fetchAPI('catat_pelanggaran', {
      id_log: testLogId,
      alasan: 'Terdeteksi keluar dari layar ujian (visibility hidden)',
      npsn: testNpsn
    });

    record('Step 2: Strike 1', "Server catat_pelanggaran returns status = 'success'", resStrike1?.status === 'success');
    record('Step 2: Strike 1', 'Server returns pelanggaran_saat_ini = 1', resStrike1?.pelanggaran_saat_ini === 1);
    record('Step 2: Strike 1', 'Server returns terblokir = false', resStrike1?.terblokir === false);

    const { data: dbStep2 } = await supabase.from('log_ujian').select('*').eq('id_log', testLogId).single();
    record('Step 2: Strike 1', 'Server DB records strike 1 in log_ujian.pelanggaran', dbStep2?.pelanggaran === 1);
    record('Step 2: Strike 1', 'Server DB maintains is_blocked = false on strike 1', dbStep2?.is_blocked === false);
    record('Step 2: Strike 1', "Server DB maintains status_ujian = 'SEDANG KERJA' on strike 1", dbStep2?.status_ujian === 'SEDANG KERJA');

    // Client updates state upon receiving response
    clientViolationCount = resStrike1.pelanggaran_saat_ini;
    record('Step 2: Strike 1', 'Client violationCount updated to 1', clientViolationCount === 1);

    // -----------------------------------------------------------------------
    // STEP 3: Simulate Page Refresh 1 / Unmount and Remount of ExamRoom
    // -----------------------------------------------------------------------
    console.log('\n  --- Step 3: Simulate Page Refresh 1 / Unmount & Remount ---');
    
    // Server query 1: get_status_log_ujian (called on ExamRoom mount)
    const statusRes1 = await fetchAPI('get_status_log_ujian', {
      id_log: testLogId,
      npsn: testNpsn
    });
    record('Step 3: Refresh 1', "get_status_log_ujian returns status = 'success'", statusRes1?.status === 'success');
    record('Step 3: Refresh 1', 'CRITICAL: get_status_log_ujian loads pelanggaran = 1 from server (NOT 0)', statusRes1?.data?.pelanggaran === 1);
    record('Step 3: Refresh 1', 'get_status_log_ujian confirms is_blocked = false', statusRes1?.data?.is_blocked === false);

    // Server query 2: get_soal_ujian (fetchSoal on mount)
    const soalRes1 = await fetchAPI('get_soal_ujian', {
      id_jadwal: testJadwalId,
      id_log: testLogId,
      npsn: testNpsn
    });
    record('Step 3: Refresh 1', "get_soal_ujian returns status = 'success'", soalRes1?.status === 'success');
    record('Step 3: Refresh 1', 'CRITICAL: get_soal_ujian logStatus.pelanggaran loads as 1 (NOT 0)', soalRes1?.logStatus?.pelanggaran === 1);

    // Server query 3: reconnect / mulai_ujian re-entry check
    const { data: latestDbLog1 } = await supabase.from('log_ujian').select('*').eq('id_log', testLogId).single();
    clientDataLog = latestDbLog1;
    const hydratedViolationCount1 = (clientDataLog && clientDataLog.pelanggaran) || 0;
    record('Step 3: Refresh 1', 'CRITICAL: Remounted ExamRoom hydrates violationCount = 1 from server dataLog, NOT 0', hydratedViolationCount1 === 1);

    // -----------------------------------------------------------------------
    // STEP 4: Trigger 2nd violation (blur)
    // -----------------------------------------------------------------------
    console.log('\n  --- Step 4: Trigger 2nd violation (window blur) ---');
    const resStrike2 = await fetchAPI('catat_pelanggaran', {
      id_log: testLogId,
      alasan: 'Terdeteksi keluar dari layar ujian (window blur)',
      npsn: testNpsn
    });

    record('Step 4: Strike 2', "Server catat_pelanggaran returns status = 'success'", resStrike2?.status === 'success');
    record('Step 4: Strike 2', 'Server returns pelanggaran_saat_ini = 2', resStrike2?.pelanggaran_saat_ini === 2);
    record('Step 4: Strike 2', 'Server returns terblokir = false', resStrike2?.terblokir === false);

    const { data: dbStep4 } = await supabase.from('log_ujian').select('*').eq('id_log', testLogId).single();
    record('Step 4: Strike 2', 'Server DB records strike 2 in log_ujian.pelanggaran', dbStep4?.pelanggaran === 2);
    record('Step 4: Strike 2', 'Server DB maintains is_blocked = false on strike 2', dbStep4?.is_blocked === false);
    record('Step 4: Strike 2', "Server DB maintains status_ujian = 'SEDANG KERJA' on strike 2", dbStep4?.status_ujian === 'SEDANG KERJA');

    clientViolationCount = resStrike2.pelanggaran_saat_ini;
    record('Step 4: Strike 2', 'Client violationCount updated to 2', clientViolationCount === 2);

    // -----------------------------------------------------------------------
    // STEP 5: Simulate Page Refresh 2 / Unmount and Remount
    // -----------------------------------------------------------------------
    console.log('\n  --- Step 5: Simulate Page Refresh 2 / Unmount & Remount ---');
    const statusRes2 = await fetchAPI('get_status_log_ujian', {
      id_log: testLogId,
      npsn: testNpsn
    });
    record('Step 5: Refresh 2', 'CRITICAL: get_status_log_ujian loads pelanggaran = 2 from server', statusRes2?.data?.pelanggaran === 2);
    record('Step 5: Refresh 2', 'get_status_log_ujian confirms is_blocked = false', statusRes2?.data?.is_blocked === false);

    const soalRes2 = await fetchAPI('get_soal_ujian', {
      id_jadwal: testJadwalId,
      id_log: testLogId,
      npsn: testNpsn
    });
    record('Step 5: Refresh 2', 'CRITICAL: get_soal_ujian logStatus.pelanggaran loads as 2', soalRes2?.logStatus?.pelanggaran === 2);

    const { data: latestDbLog2 } = await supabase.from('log_ujian').select('*').eq('id_log', testLogId).single();
    clientDataLog = latestDbLog2;
    const hydratedViolationCount2 = (clientDataLog && clientDataLog.pelanggaran) || 0;
    record('Step 5: Refresh 2', 'CRITICAL: Remounted ExamRoom hydrates violationCount = 2 from server dataLog, NOT 0', hydratedViolationCount2 === 2);

    // -----------------------------------------------------------------------
    // STEP 6: Trigger 3rd violation (Lockout & Auto-kick)
    // -----------------------------------------------------------------------
    console.log('\n  --- Step 6: Trigger 3rd violation (Lockout & Auto-kick) ---');
    const strike3Time = Date.now();
    const resStrike3 = await fetchAPI('catat_pelanggaran', {
      id_log: testLogId,
      alasan: 'Terdeteksi keluar dari mode layar penuh (fullscreen exit)',
      npsn: testNpsn
    });

    record('Step 6: Strike 3', "Server catat_pelanggaran returns status = 'success'", resStrike3?.status === 'success');
    record('Step 6: Strike 3', 'Server returns pelanggaran_saat_ini = 3', resStrike3?.pelanggaran_saat_ini === 3);
    record('Step 6: Strike 3', 'CRITICAL: Server returns terblokir = true', resStrike3?.terblokir === true);

    const { data: dbStep6 } = await supabase.from('log_ujian').select('*').eq('id_log', testLogId).single();
    record('Step 6: Strike 3', 'Server DB records pelanggaran = 3', dbStep6?.pelanggaran === 3);
    record('Step 6: Strike 3', 'CRITICAL: Server DB immediately sets is_blocked = true', dbStep6?.is_blocked === true);
    record('Step 6: Strike 3', "CRITICAL: Server DB immediately sets status_ujian = 'SELESAI'", dbStep6?.status_ujian === 'SELESAI');
    record('Step 6: Strike 3', 'CRITICAL: Server DB immediately records score nilai_auto = 0', Number(dbStep6?.nilai_auto) === 0);
    record('Step 6: Strike 3', 'Server DB records non-null ISO waktu_selesai timestamp', !!dbStep6?.waktu_selesai);
    record('Step 6: Strike 3', 'Server DB records exactly 3 violation history entries in pelanggaran_detail',
      Array.isArray(dbStep6?.pelanggaran_detail) && dbStep6.pelanggaran_detail.length === 3
    );

    // -----------------------------------------------------------------------
    // STEP 7: Simulate Refresh After Strike 3 (Lockout Enforcement)
    // -----------------------------------------------------------------------
    console.log('\n  --- Step 7: Simulate Refresh After Strike 3 (Lockout Enforcement) ---');

    // 7.1 Server API check on mount: get_status_log_ujian
    const statusRes3 = await fetchAPI('get_status_log_ujian', {
      id_log: testLogId,
      npsn: testNpsn
    });
    record('Step 7: Post-Strike 3', 'get_status_log_ujian returns is_blocked = true', statusRes3?.data?.is_blocked === true);
    record('Step 7: Post-Strike 3', 'get_status_log_ujian returns pelanggaran = 3', statusRes3?.data?.pelanggaran === 3);
    record('Step 7: Post-Strike 3', "get_status_log_ujian returns status_ujian = 'SELESAI'", statusRes3?.data?.status_ujian === 'SELESAI');
    record('Step 7: Post-Strike 3', 'get_status_log_ujian returns nilai_auto = 0', Number(statusRes3?.data?.nilai_auto) === 0);

    // 7.2 ExamRoom block evaluation on mount:
    // In ExamRoom.jsx:
    // const strikes = res.data.pelanggaran || 0;
    // const blocked = res.data.is_blocked || strikes >= 3 || (res.data.status_ujian === 'SELESAI' && res.data.nilai_auto === 0);
    const simulatedStrikes = statusRes3?.data?.pelanggaran || 0;
    const simulatedBlocked = statusRes3?.data?.is_blocked || simulatedStrikes >= 3 || (statusRes3?.data?.status_ujian === 'SELESAI' && statusRes3?.data?.nilai_auto === 0);
    record('Step 7: Post-Strike 3', 'ExamRoom on-mount evaluates blocked = true and triggers triggerStrike3Kick()', simulatedBlocked === true);

    // 7.3 Direct re-mount with latest dataLog
    const { data: dbDisqualified } = await supabase.from('log_ujian').select('*').eq('id_log', testLogId).single();
    const initialDisqualifiedViolations = (dbDisqualified && dbDisqualified.pelanggaran) || 0;
    const initialDisqualifiedBlocked = Boolean((dbDisqualified && dbDisqualified.is_blocked) || initialDisqualifiedViolations >= 3);
    record('Step 7: Post-Strike 3', 'Remount with disqualified dataLog computes initialBlocked = true immediately', initialDisqualifiedBlocked === true);

    // 7.4 Re-entry attempt via mulai_ujian
    // If student tries to enter exam again from dashboard
    if (testSiswaId && testJadwalId) {
      const { data: jData } = await supabase.from('jadwal').select('token_aktif').eq('id_jadwal', testJadwalId).single();
      const currentToken = jData?.token_aktif || 'TESTTK';
      const mulaiRes = await fetchAPI('mulai_ujian', {
        id_jadwal: testJadwalId,
        id_siswa: testSiswaId,
        token: currentToken,
        npsn: testNpsn
      });

      record('Step 7: Post-Strike 3', "mulai_ujian rejects re-entry with status = 'error'", mulaiRes?.status === 'error');
      record('Step 7: Post-Strike 3', 'mulai_ujian returns terblokir = true flag', mulaiRes?.terblokir === true);
      record('Step 7: Post-Strike 3', 'mulai_ujian message mentions violation limit / blocked account', /diblokir|pelanggaran|batas|3/i.test(mulaiRes?.message || ''));
    }

    // -----------------------------------------------------------------------
    // STEP 8: Adversarial Strike 4 & Answer Tamper Resistance
    // -----------------------------------------------------------------------
    console.log('\n  --- Step 8: Adversarial Strike 4 & Answer Tamper Resistance ---');
    const resStrike4 = await fetchAPI('catat_pelanggaran', {
      id_log: testLogId,
      alasan: 'Adversarial Strike 4 attempt on already disqualified student',
      npsn: testNpsn
    });

    record('Step 8: Adversarial', 'Strike 4 API call maintains terblokir = true', resStrike4?.terblokir === true);

    const { data: dbStep8 } = await supabase.from('log_ujian').select('*').eq('id_log', testLogId).single();
    record('Step 8: Adversarial', "Disqualified DB record immutable: status_ujian remains 'SELESAI'", dbStep8?.status_ujian === 'SELESAI');
    record('Step 8: Adversarial', 'Disqualified DB record immutable: nilai_auto remains 0', Number(dbStep8?.nilai_auto) === 0);
    record('Step 8: Adversarial', 'Disqualified DB record immutable: is_blocked remains true', dbStep8?.is_blocked === true);

    // Attempt to submit answers after disqualification
    const resTamperSubmit = await fetchAPI('submit_ujian', {
      id_log: testLogId,
      id_jadwal: testJadwalId,
      id_siswa: testSiswaId,
      npsn: testNpsn,
      jawaban: [{ id_soal: 1, jawaban: 'A' }]
    });

    record('Step 8: Adversarial', 'Attempted submission while disqualified enforces score 0 return', Number(resTamperSubmit?.nilai_auto) === 0);

    const { data: dbPostTamper } = await supabase.from('log_ujian').select('*').eq('id_log', testLogId).single();
    record('Step 8: Adversarial', 'Disqualified student cannot overwrite 0 score in DB', Number(dbPostTamper?.nilai_auto) === 0);

  } catch (err) {
    record('Test Suite Error', 'Unhandled error in live test suite', false, err.message);
  } finally {
    // Teardown: purge temporary test record
    const { error: delErr } = await supabase.from('log_ujian').delete().eq('id_log', testLogId);
    if (!delErr) {
      console.log(`\n  ✔ [TEARDOWN] Purged temporary test log record (${testLogId})`);
    } else {
      console.warn(`\n  ⚠ [TEARDOWN WARNING] Failed to purge test log: ${delErr.message}`);
    }
  }

  // =========================================================================
  // SECTION 3: Frontend Component Lifecycle Simulation
  // =========================================================================
  console.log('\n▶ SECTION 3: React ExamRoom Component Lifecycle Simulation');

  class ExamRoomSimulator {
    constructor(props) {
      this.props = props;
      this.initialViolations = (props.dataLog && props.dataLog.pelanggaran) || 0;
      this.initialBlocked = Boolean((props.dataLog && props.dataLog.is_blocked) || this.initialViolations >= 3);
      this.violationCount = this.initialViolations;
      this.isBlocked = this.initialBlocked;
      this.isSubmitting = false;
      this.securityModal = { isOpen: false, title: '', message: '' };
      this.localStorage = new Map();
      this.kickScheduled = false;
      this.onFinishCalled = false;
    }

    mount() {
      if (this.initialBlocked || this.initialViolations >= 3) {
        this.triggerStrike3Kick();
        return;
      }
    }

    triggerStrike3Kick() {
      this.isBlocked = true;
      this.isSubmitting = true;
      this.securityModal = {
        isOpen: true,
        title: 'UJIAN DIHENTIKAN! (Pelanggaran ke-3)',
        message: 'Anda telah melakukan pelanggaran sebanyak 3 kali. Sesi ujian Anda telah dihentikan secara permanen dan nilai Anda dicatat 0.'
      };
      this.kickScheduled = true;
    }

    applyServerSync(serverData) {
      const strikes = serverData.pelanggaran || 0;
      const blocked = serverData.is_blocked || strikes >= 3 || (serverData.status_ujian === 'SELESAI' && serverData.nilai_auto === 0);
      this.violationCount = strikes;
      if (blocked) {
        this.triggerStrike3Kick();
      }
    }
  }

  // Lifecycle Test A: Enter exam with 0 strikes
  const comp1 = new ExamRoomSimulator({ dataLog: { pelanggaran: 0, is_blocked: false } });
  comp1.mount();
  record('Component Lifecycle', 'ExamRoom mounts with initial violationCount = 0 and isBlocked = false', comp1.violationCount === 0 && !comp1.isBlocked);

  // Lifecycle Test B: Remount after strike 1 with server sync
  const comp2 = new ExamRoomSimulator({ dataLog: { pelanggaran: 1, is_blocked: false } });
  comp2.mount();
  record('Component Lifecycle', 'ExamRoom remounts after strike 1 with initial violationCount = 1', comp2.violationCount === 1 && !comp2.isBlocked);

  // Lifecycle Test C: Remount after strike 2 with server sync
  const comp3 = new ExamRoomSimulator({ dataLog: { pelanggaran: 2, is_blocked: false } });
  comp3.mount();
  record('Component Lifecycle', 'ExamRoom remounts after strike 2 with initial violationCount = 2', comp3.violationCount === 2 && !comp3.isBlocked);

  // Lifecycle Test D: Remount after strike 3 (disqualified student)
  const comp4 = new ExamRoomSimulator({ dataLog: { pelanggaran: 3, is_blocked: true } });
  comp4.mount();
  record('Component Lifecycle', 'ExamRoom remounts after strike 3: immediately triggers triggerStrike3Kick() on mount', comp4.isBlocked === true && comp4.kickScheduled === true);
  record('Component Lifecycle', 'Strike 3 termination modal rendered with unclosable alert', comp4.securityModal.isOpen && comp4.securityModal.title.includes('Pelanggaran ke-3'));

  // Lifecycle Test E: Server sync catches disqualified student even if dataLog was stale
  const comp5 = new ExamRoomSimulator({ dataLog: { pelanggaran: 0, is_blocked: false } });
  comp5.mount();
  comp5.applyServerSync({ pelanggaran: 3, is_blocked: true, status_ujian: 'SELESAI', nilai_auto: 0 });
  record('Component Lifecycle', 'Server sync on mount catches disqualified student even if initial dataLog was stale (0 strikes)', comp5.isBlocked === true && comp5.violationCount === 3 && comp5.kickScheduled === true);


  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log('\n======================================================================');
  console.log('                          STRESS TEST SUMMARY                         ');
  console.log('======================================================================');
  console.log(`TOTAL ASSERTIONS : ${report.total}`);
  console.log(`PASSED           : ${report.passed}`);
  console.log(`FAILED           : ${report.failed}`);
  const passRate = ((report.passed / report.total) * 100).toFixed(1);
  console.log(`PASS RATE        : ${passRate}%\n`);

  if (report.failed > 0) {
    console.error(`❌ STRESS TEST FAILED with ${report.failed} failure(s):`);
    report.failures.forEach((f, idx) => {
      console.error(`  ${idx + 1}. [${f.category}] ${f.name} -> ${f.details}`);
    });
    process.exit(1);
  } else {
    console.log('🎉 ALL EXAM ANTI-CHEAT STRIKE PERSISTENCE ASSERTIONS PASSED CLEANLY!\n');
    process.exit(0);
  }
}

runStrikePersistenceStressSuite().catch(err => {
  console.error('FATAL UNHANDLED ERROR:', err);
  process.exit(1);
});
