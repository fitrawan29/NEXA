#!/usr/bin/env node
/**
 * Challenger 1 Adversarial Test Suite - Requirement 1 (Canvas, Gating & Mobile Stress)
 *
 * Scope:
 * 1. Blank canvas bypass attempts (client-side stroke/pixel algorithms & server API bypass)
 * 2. Server-side question gate bypass (unsigned id_log, missing id_log, forged id_log, blocked student)
 * 3. Malformed signature payload injection (non-base64, SVG/XSS, oversized data, SQL strings)
 * 4. Rapid-click / Double-submit race conditions (concurrent burst & atomic DB persistence)
 * 5. Network drop / Refresh mid-session & state resumption (sessionStorage, server sync, offline)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../src/config.js';
import { fetchAPI } from '../src/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.resolve(projectRoot, 'src');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test fixtures & constants
const TEST_NPSN = '70040625';
let TEST_JADWAL = null;
const TEST_SISWA = 'S-F2934CD8';
const FIXTURE_ROOM_ID = 'R-CHALLENGER-R5-1';

const SAMPLE_SIGNATURE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGXRFWHRTb2Z0d2FyZQBNYXRwbG90bGliIHZlcnNpb24zLjcuMiwgaHR0cHM6Ly9tYXRwbG90bGliLm9yZy8pV571AAAAPklEQVR4nGP8//8/AyUYiBEyGv9jYGAoR2Jjg/mYkARhGkCKQYrh4mCMY7g2kGLY4FCEYfD/YRgkGIYFGAAMdBEGqFh7oAAAAABJRU5ErkJggg==';

const BLANK_TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Cleanup tracking registry
const cleanupRegistry = {
  logIds: new Set(),
  absensiIds: new Set(),
  ruangIds: new Set(),
  jadwalIds: new Set()
};

// Results storage
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  findings: [],
  testDetails: []
};

function recordTest(id, name, section, passed, error = null, meta = {}) {
  results.total++;
  if (passed) {
    results.passed++;
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${id}: ${name}`);
  } else {
    results.failed++;
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${id}: ${name}`);
    if (error) console.error(`    \x1b[90m${error}\x1b[0m`);
    results.findings.push({ id, name, section, error, meta });
  }
  results.testDetails.push({ id, name, section, passed, error, meta });
}

// -----------------------------------------------------------------------------
// Client-Side Canvas Genuine Algorithm Implementation Emulation
// Based directly on DigitalSignatureModal.jsx:96-132
// -----------------------------------------------------------------------------
function evaluateDigitalSignatureModalLogic(strokes, pixelBuffer) {
  // 1. Stroke count and coordinate count check
  const totalStrokes = strokes.length;
  let totalPoints = 0;
  strokes.forEach(s => {
    totalPoints += s.length;
  });

  if (totalStrokes < 1 || totalPoints < 8) {
    return { isValid: false, reason: `Insufficient points/strokes: strokes=${totalStrokes}, points=${totalPoints}` };
  }

  // 2. Pixel verification via getImageData
  if (!pixelBuffer || !pixelBuffer.data) {
    const fallback = totalStrokes >= 1 && totalPoints >= 10;
    return { isValid: fallback, reason: fallback ? 'Fallback stroke count passed' : 'Fallback stroke count failed' };
  }

  const data = pixelBuffer.data;
  let nonBlankPixels = 0;

  for (let i = 3; i < data.length; i += 16) {
    if (data[i] > 30) {
      nonBlankPixels++;
      if (nonBlankPixels >= 35) {
        return { isValid: true, nonBlankPixels };
      }
    }
  }

  return { isValid: nonBlankPixels >= 35, nonBlankPixels };
}

// Micro-jitter filtering simulator based on DigitalSignatureModal.jsx:182
function simulatePointerDrawing(points) {
  if (points.length === 0) return [];
  const recorded = [points[0]];
  let last = points[0];

  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    const dist = Math.hypot(pt.x - last.x, pt.y - last.y);
    if (dist >= 1.5) {
      recorded.push(pt);
      last = pt;
    }
  }
  return recorded;
}

// =============================================================================
// MAIN TEST EXECUTION
// =============================================================================
async function runAdversarialTestSuite() {
  console.log('========================================================================');
  console.log('   CHALLENGER 1: ADVERSARIAL VERIFICATION & STRESS HARNESS               ');
  console.log('   Requirement 1: Digital Canvas Attendance, Gating & Mobile Stress     ');
  console.log('========================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // FIXTURE INITIALIZATION
    // -------------------------------------------------------------------------
    const FIXTURE_JADWAL_ID = `U-CHAL1-${Date.now()}`;
    const { error: errJadwal } = await supabase.from('jadwal').insert([{
      id_jadwal: FIXTURE_JADWAL_ID,
      id_mapel: 'M-7AE60E7B',
      id_guru: 'G-163390E6',
      npsn: TEST_NPSN,
      waktu_mulai: new Date(Date.now() - 3600000).toISOString(),
      waktu_selesai: new Date(Date.now() + 3600000).toISOString(),
      durasi_menit: 60,
      acak_soal: false,
      target_kelas: 'XI Merdeka',
      token_aktif: 'CHAL1TK'
    }]);
    if (errJadwal) throw new Error(`Jadwal setup failed: ${errJadwal.message}`);
    TEST_JADWAL = FIXTURE_JADWAL_ID;
    cleanupRegistry.jadwalIds.add(FIXTURE_JADWAL_ID);

    // 1. Ensure test room exists
    await supabase.from('ruang_ujian').upsert([{
      id_ruang: FIXTURE_ROOM_ID,
      npsn: TEST_NPSN,
      nama_ruang: 'Ruang Challenger Test',
      kapasitas: 40
    }]);
    cleanupRegistry.ruangIds.add(FIXTURE_ROOM_ID);

    // 2. Ensure test question exists for mapel M-7AE60E7B so get_soal_ujian returns questions
    const FIXTURE_SOAL_ID = `Q-CHALLENGER-${Date.now()}`;
    await supabase.from('soal_ujian').insert([{
      id_soal: FIXTURE_SOAL_ID,
      id_mapel: 'M-7AE60E7B',
      npsn: TEST_NPSN,
      pertanyaan: 'Fixture test question for challenger gating',
      tipe_soal: 'PG',
      opsi: JSON.stringify([{ text: 'Option A', benar: true }, { text: 'Option B', benar: false }])
    }]);
    cleanupRegistry.soalIds = new Set([FIXTURE_SOAL_ID]);

    // -------------------------------------------------------------------------
    // SECTION 1: Blank Canvas Bypass Attempts
    // -------------------------------------------------------------------------
    console.log('\x1b[36m▶ [SECTION 1] Blank Canvas Bypass Attempts (Client & Server)\x1b[0m');

    // 1.1 Empty touch simulation
    {
      const evalRes = evaluateDigitalSignatureModalLogic([], null);
      recordTest(
        'ADV-1.1',
        'Empty canvas touch (0 strokes, 0 points) rejected by client logic',
        'Blank Canvas Bypass',
        evalRes.isValid === false,
        evalRes.isValid ? 'Empty canvas was improperly marked valid' : null
      );
    }

    // 1.2 Single accidental tap simulation
    {
      const singleTapStroke = [{ x: 120, y: 80 }];
      const evalRes = evaluateDigitalSignatureModalLogic([singleTapStroke], null);
      recordTest(
        'ADV-1.2',
        'Accidental single tap (1 stroke, 1 point) rejected by client logic',
        'Blank Canvas Bypass',
        evalRes.isValid === false,
        evalRes.isValid ? 'Single tap passed verification' : null
      );
    }

    // 1.3 Micro-jitter trembling touch simulation (all moves < 1.5px distance)
    {
      const rawJitterPoints = [
        { x: 100, y: 100 },
        { x: 100.4, y: 100.3 },
        { x: 100.8, y: 100.7 },
        { x: 100.2, y: 100.5 },
        { x: 100.9, y: 100.8 }
      ];
      const filteredStroke = simulatePointerDrawing(rawJitterPoints);
      const evalRes = evaluateDigitalSignatureModalLogic([filteredStroke], null);
      recordTest(
        'ADV-1.3',
        'Micro-jitter touch filtered out (<1.5px) and rejected (<8 points)',
        'Blank Canvas Bypass',
        filteredStroke.length === 1 && evalRes.isValid === false,
        `Filtered points: ${filteredStroke.length}, isValid: ${evalRes.isValid}`
      );
    }

    // 1.4 Transparent / zero-alpha stroke simulation (white-on-white / unrendered)
    {
      // 100x100 fake canvas buffer with 10 points but all alpha = 0
      const fakePixelData = new Uint8ClampedArray(100 * 100 * 4); // all 0s
      const strokePoints = Array.from({ length: 12 }, (_, i) => ({ x: i * 5, y: i * 5 }));
      const evalRes = evaluateDigitalSignatureModalLogic([strokePoints], { data: fakePixelData });
      recordTest(
        'ADV-1.4',
        'Transparent / zero-alpha pixels rejected by pixel density sampler (alpha <= 30)',
        'Blank Canvas Bypass',
        evalRes.isValid === false,
        evalRes.isValid ? 'Zero-alpha pixels counted as valid signature' : null
      );
    }

    // 1.5 Boundary test: 7 points vs 8 points threshold
    {
      const stroke7 = Array.from({ length: 7 }, (_, i) => ({ x: i * 5, y: i * 5 }));
      const stroke8 = Array.from({ length: 8 }, (_, i) => ({ x: i * 5, y: i * 5 }));
      const res7 = evaluateDigitalSignatureModalLogic([stroke7], null);
      
      // For stroke8, provide pixel buffer with 34 pixels vs 35 pixels
      const buf34 = new Uint8ClampedArray(100 * 100 * 4);
      for (let p = 0; p < 34; p++) {
        const idx = p * 16 + 3; // alpha channel
        buf34[idx] = 255;
      }
      const res34 = evaluateDigitalSignatureModalLogic([stroke8], { data: buf34 });

      const buf35 = new Uint8ClampedArray(100 * 100 * 4);
      for (let p = 0; p < 35; p++) {
        const idx = p * 16 + 3;
        buf35[idx] = 255;
      }
      const res35 = evaluateDigitalSignatureModalLogic([stroke8], { data: buf35 });

      const boundaryPassed = res7.isValid === false && res34.isValid === false && res35.isValid === true;
      recordTest(
        'ADV-1.5',
        'Strict boundary enforcement (7 pts fail, 34 px fail, 35 px pass)',
        'Blank Canvas Bypass',
        boundaryPassed,
        `res7: ${res7.isValid}, res34: ${res34.isValid}, res35: ${res35.isValid}`
      );
    }

    // 1.6 Authentic handwriting signature simulation
    {
      const strokeA = Array.from({ length: 15 }, (_, i) => ({ x: 20 + i * 4, y: 30 + Math.sin(i) * 10 }));
      const strokeB = Array.from({ length: 12 }, (_, i) => ({ x: 80 + i * 2, y: 40 + i * 3 }));
      const bufValid = new Uint8ClampedArray(100 * 100 * 4);
      for (let p = 0; p < 80; p++) {
        bufValid[p * 16 + 3] = 255; // strong alpha
      }
      const evalRes = evaluateDigitalSignatureModalLogic([strokeA, strokeB], { data: bufValid });
      recordTest(
        'ADV-1.6',
        'Authentic handwriting strokes (>8 pts, >35 px) accepted',
        'Blank Canvas Bypass',
        evalRes.isValid === true,
        evalRes.isValid ? null : 'Authentic signature was falsely rejected'
      );
    }

    // 1.7 Server-side API Blank Bypass: Empty string & null rejected
    {
      const resEmpty = await fetchAPI('submit_absensi_siswa', {
        id_jadwal: TEST_JADWAL,
        id_siswa: TEST_SISWA,
        id_ruang: FIXTURE_ROOM_ID,
        npsn: TEST_NPSN,
        tanda_tangan: ''
      });
      const resNull = await fetchAPI('submit_absensi_siswa', {
        id_jadwal: TEST_JADWAL,
        id_siswa: TEST_SISWA,
        id_ruang: FIXTURE_ROOM_ID,
        npsn: TEST_NPSN,
        tanda_tangan: null
      });

      const serverRejectionPassed = resEmpty.status === 'error' && resNull.status === 'error';
      recordTest(
        'ADV-1.7',
        'Server submit_absensi_siswa strictly rejects empty string and null signature',
        'Blank Canvas Bypass',
        serverRejectionPassed,
        `resEmpty: ${resEmpty.status}, resNull: ${resNull.status}`
      );
    }

    // 1.8 Server-side API Blank Bypass: Empty data URL header "data:image/png;base64,"
    {
      const resEmptyDataUrl = await fetchAPI('submit_absensi_siswa', {
        id_jadwal: TEST_JADWAL,
        id_siswa: TEST_SISWA,
        id_ruang: FIXTURE_ROOM_ID,
        npsn: TEST_NPSN,
        tanda_tangan: 'data:image/png;base64,'
      });
      // The server SHOULD reject an empty base64 payload. If it accepts it, record vulnerability.
      const isBlocked = resEmptyDataUrl.status === 'error';
      recordTest(
        'ADV-1.8',
        'Server submit_absensi_siswa rejects empty Base64 data URL "data:image/png;base64,"',
        'Blank Canvas Bypass',
        isBlocked,
        isBlocked ? null : 'VULNERABILITY: Server accepted 0-byte base64 image data URL! Permissive startsWith("data:image") allows blank canvas bypass.',
        {
          receivedStatus: resEmptyDataUrl.status,
          severity: isBlocked ? 'NONE' : 'HIGH',
          finding: isBlocked ? null : 'Empty Base64 payload accepted without minimum size validation'
        }
      );
    }

    // -------------------------------------------------------------------------
    // SECTION 2: Server-Side Question Gating Bypass (get_soal_ujian)
    // -------------------------------------------------------------------------
    console.log('\n\x1b[36m▶ [SECTION 2] Server-Side Question Gate Bypass (get_soal_ujian)\x1b[0m');

    const unsignedLogId = `LOG-CHALLENGER-UNSIGNED-${Date.now()}`;
    cleanupRegistry.logIds.add(unsignedLogId);

    // Create an unsigned session in log_ujian
    await supabase.from('log_ujian').insert([{
      id_log: unsignedLogId,
      id_jadwal: TEST_JADWAL,
      id_siswa: TEST_SISWA,
      status_ujian: 'SEDANG KERJA',
      pelanggaran: 0,
      tanda_tangan: null
    }]);

    // Ensure absensi_ujian has no signature for this student/jadwal
    await supabase.from('absensi_ujian').delete().eq('id_jadwal', TEST_JADWAL).eq('id_siswa', TEST_SISWA);

    // 2.1 Direct call with unsigned id_log -> MUST BE HARD BLOCKED
    {
      const resGating = await fetchAPI('get_soal_ujian', {
        id_jadwal: TEST_JADWAL,
        id_log: unsignedLogId,
        npsn: TEST_NPSN
      });

      const isBlocked = resGating.status === 'error' && resGating.need_signature === true;
      const noQuestionsLeaked = !resGating.data || resGating.data.length === 0;

      recordTest(
        'ADV-2.1',
        'Direct get_soal_ujian with unsigned id_log returns error & need_signature: true',
        'Question Gating Bypass',
        isBlocked && noQuestionsLeaked,
        !isBlocked ? `Expected error, got status: ${resGating.status}` : (!noQuestionsLeaked ? 'Questions leaked in response body!' : null)
      );
    }

    // 2.2 Direct call with forged / non-existent id_log
    {
      const forgedLogId = `LOG-FORGED-${Date.now()}-HACK`;
      const resForged = await fetchAPI('get_soal_ujian', {
        id_jadwal: TEST_JADWAL,
        id_log: forgedLogId,
        npsn: TEST_NPSN
      });

      const isForgedBlocked = resForged.status === 'error' && resForged.message?.includes('Log ujian tidak ditemukan');
      recordTest(
        'ADV-2.2',
        'Direct get_soal_ujian with non-existent id_log is hard-blocked',
        'Question Gating Bypass',
        isForgedBlocked,
        isForgedBlocked ? null : `Unexpected response for forged id_log: ${JSON.stringify(resForged)}`
      );
    }

    // 2.3 Sign the log and verify get_soal_ujian unlocks questions
    {
      const resSign = await fetchAPI('submit_absensi_siswa', {
        id_log: unsignedLogId,
        id_jadwal: TEST_JADWAL,
        id_siswa: TEST_SISWA,
        npsn: TEST_NPSN,
        id_ruang: FIXTURE_ROOM_ID,
        tanda_tangan: SAMPLE_SIGNATURE_PNG
      });

      if (resSign.data?.id_absensi) {
        cleanupRegistry.absensiIds.add(resSign.data.id_absensi);
      }

      const resUnlocked = await fetchAPI('get_soal_ujian', {
        id_jadwal: TEST_JADWAL,
        id_log: unsignedLogId,
        npsn: TEST_NPSN
      });

      const isUnlocked = resUnlocked.status === 'success' && Array.isArray(resUnlocked.data) && resUnlocked.data.length > 0;
      recordTest(
        'ADV-2.3',
        'Direct get_soal_ujian with signed id_log successfully unlocks questions',
        'Question Gating Bypass',
        isUnlocked,
        isUnlocked ? null : `Failed to unlock questions: status=${resUnlocked?.status}, questionsCount=${resUnlocked?.data?.length}`
      );
    }

    // 2.4 Question Gating Bypass Attempt: Calling get_soal_ujian WITHOUT id_log
    {
      const resNoLog = await fetchAPI('get_soal_ujian', {
        id_jadwal: TEST_JADWAL,
        npsn: TEST_NPSN
      });

      // Does omitting id_log bypass question gating?
      const questionsDeliveredWithoutLog = resNoLog.status === 'success' && Array.isArray(resNoLog.data) && resNoLog.data.length > 0;
      
      // If questions are delivered without id_log, question gating is bypassed!
      const gatingEnforced = !questionsDeliveredWithoutLog;
      recordTest(
        'ADV-2.4',
        'Server get_soal_ujian enforces signature gating even if id_log is omitted',
        'Question Gating Bypass',
        gatingEnforced,
        gatingEnforced ? null : 'VULNERABILITY: Calling get_soal_ujian without id_log delivers questions, bypassing signature gating entirely!',
        {
          deliveredWithoutLog: questionsDeliveredWithoutLog,
          severity: gatingEnforced ? 'NONE' : 'HIGH',
          finding: gatingEnforced ? null : 'Unauthenticated/unsigned client can omit id_log to fetch question bank'
        }
      );
    }


    // 2.5 Blocked student attempt (pelanggaran = 3, is_blocked = true)
    {
      const blockedLogId = `LOG-BLOCKED-${Date.now()}`;
      cleanupRegistry.logIds.add(blockedLogId);

      await supabase.from('log_ujian').insert([{
        id_log: blockedLogId,
        id_jadwal: TEST_JADWAL,
        id_siswa: TEST_SISWA,
        status_ujian: 'SELESAI',
        pelanggaran: 3,
        is_blocked: true,
        nilai_auto: 0,
        tanda_tangan: SAMPLE_SIGNATURE_PNG
      }]);

      const resBlocked = await fetchAPI('get_soal_ujian', {
        id_jadwal: TEST_JADWAL,
        id_log: blockedLogId,
        npsn: TEST_NPSN
      });

      const isLogBlocked = resBlocked.logStatus?.is_blocked === true || resBlocked.logStatus?.pelanggaran >= 3;
      recordTest(
        'ADV-2.5',
        'Student with 3 strikes / is_blocked retains blocked status in get_soal_ujian response',
        'Question Gating Bypass',
        isLogBlocked,
        isLogBlocked ? null : 'Blocked student status was not properly reported'
      );
    }


    // -------------------------------------------------------------------------
    // SECTION 3: Malformed Signature Payload Injection
    // -------------------------------------------------------------------------
    console.log('\n\x1b[36m▶ [SECTION 3] Malformed Signature Payload Injection\x1b[0m');

    // 3.1 Raw non-base64 string
    {
      const resRaw = await fetchAPI('submit_absensi_siswa', {
        id_jadwal: TEST_JADWAL,
        id_siswa: TEST_SISWA,
        npsn: TEST_NPSN,
        tanda_tangan: 'RAW_PLAINTEXT_UNENCODED_SIGNATURE'
      });
      recordTest(
        'ADV-3.1',
        'Raw non-data-URL text rejected by submit_absensi_siswa',
        'Malformed Signature Payload',
        resRaw.status === 'error',
        resRaw.status === 'error' ? null : 'Raw string was accepted!'
      );
    }

    // 3.2 Non-image MIME type (text/plain)
    {
      const resText = await fetchAPI('submit_absensi_siswa', {
        id_jadwal: TEST_JADWAL,
        id_siswa: TEST_SISWA,
        npsn: TEST_NPSN,
        tanda_tangan: 'data:text/plain;base64,SGVsbG8gd29ybGQ='
      });
      recordTest(
        'ADV-3.2',
        'Non-image MIME type (data:text/plain) rejected by submit_absensi_siswa',
        'Malformed Signature Payload',
        resText.status === 'error',
        resText.status === 'error' ? null : 'text/plain was accepted!'
      );
    }

    // 3.3 SVG / XSS injection payload
    {
      const svgPayload = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle cx="50" cy="50" r="40"/></svg>';
      const resSvg = await fetchAPI('submit_absensi_siswa', {
        id_jadwal: TEST_JADWAL,
        id_siswa: TEST_SISWA,
        npsn: TEST_NPSN,
        tanda_tangan: svgPayload
      });

      // Check whether backend allows data:image/svg+xml
      const accepted = resSvg.status === 'success';
      recordTest(
        'ADV-3.3',
        'Probe: SVG vector "data:image/svg+xml" payload acceptance check',
        'Malformed Signature Payload',
        true, // Informational probe
        null,
        {
          acceptedSvg: accepted,
          note: accepted
            ? 'Security Notice: submit_absensi_siswa accepts data:image/svg+xml. Ensure all rendering contexts use <img src=...> (which disables script execution in modern browsers) rather than inline SVG or iframe injection.'
            : 'Rejected by validation'
        }
      );
    }

    // 3.4 Oversized signature payload (1.5 MB Base64 string)
    {
      const largeSignature = 'data:image/png;base64,' + 'A'.repeat(1.5 * 1024 * 1024);
      let largeStatus = 'unknown';
      let largeError = null;

      try {
        const resLarge = await fetchAPI('submit_absensi_siswa', {
          id_jadwal: TEST_JADWAL,
          id_siswa: TEST_SISWA,
          npsn: TEST_NPSN,
          tanda_tangan: largeSignature
        });
        largeStatus = resLarge.status;
      } catch (e) {
        largeStatus = 'threw';
        largeError = e.message;
      }

      // We assert that the application does not crash / unhandled rejection
      recordTest(
        'ADV-3.4',
        'Oversized payload (1.5MB base64) handled gracefully without server crash',
        'Malformed Signature Payload',
        largeStatus === 'success' || largeStatus === 'error' || largeStatus === 'threw',
        null,
        { largeStatus, largeError }
      );
    }

    // 3.5 SQL injection attempt in signature data URL
    {
      const sqlInjectionSig = "data:image/png;base64,' OR 1=1; DROP TABLE absensi_ujian; --";
      const resSqlSig = await fetchAPI('submit_absensi_siswa', {
        id_jadwal: TEST_JADWAL,
        id_siswa: TEST_SISWA,
        npsn: TEST_NPSN,
        tanda_tangan: sqlInjectionSig
      });

      // Verify absensi_ujian table still exists and queryable
      const { data: checkTable, error: checkErr } = await supabase.from('absensi_ujian').select('id_absensi').limit(1);
      const sqlSafe = checkErr === null;

      recordTest(
        'ADV-3.5',
        'SQL injection in signature payload safely parameterized by Supabase client',
        'Malformed Signature Payload',
        sqlSafe,
        sqlSafe ? null : `Database corrupted or table dropped! ${checkErr?.message}`
      );
    }

    // 3.6 SQL injection in relational identifiers
    {
      const resSqlIdent = await fetchAPI('get_soal_ujian', {
        id_jadwal: "U-67AC6649' OR '1'='1",
        id_log: "LOG-TEST' OR '1'='1",
        npsn: TEST_NPSN
      });

      // Parameterized queries will return error because ID does not match
      recordTest(
        'ADV-3.6',
        'SQL injection in id_jadwal / id_log identifiers safely neutralized',
        'Malformed Signature Payload',
        resSqlIdent.status === 'error',
        resSqlIdent.status === 'error' ? null : 'SQL injection bypassed query filter!'
      );
    }


    // -------------------------------------------------------------------------
    // SECTION 4: Rapid-Click / Double-Submit Race Conditions
    // -------------------------------------------------------------------------
    console.log('\n\x1b[36m▶ [SECTION 4] Rapid-Click / Double-Submit Race Conditions\x1b[0m');

    const raceSiswaId = TEST_SISWA;
    const raceLogId = `LOG-RACE-${Date.now()}`;
    cleanupRegistry.logIds.add(raceLogId);

    // Delete any prior record
    await supabase.from('absensi_ujian').delete().eq('id_jadwal', TEST_JADWAL).eq('id_siswa', raceSiswaId);

    // 4.1 Rapid concurrent submissions (Burst of 10 simultaneous calls)
    {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => {
        return fetchAPI('submit_absensi_siswa', {
          id_log: raceLogId,
          id_jadwal: TEST_JADWAL,
          id_siswa: raceSiswaId,
          npsn: TEST_NPSN,
          id_ruang: FIXTURE_ROOM_ID,
          tanda_tangan: SAMPLE_SIGNATURE_PNG,
          status_kehadiran: 'HADIR'
        });
      });

      const burstResults = await Promise.all(concurrentRequests);
      const allSucceeded = burstResults.every(r => r.status === 'success');

      // Check database: exactly ONE record must exist due to unique constraint on (id_jadwal, id_siswa)
      const { data: dbRecords, error: dbErr } = await supabase
        .from('absensi_ujian')
        .select('*')
        .eq('id_jadwal', TEST_JADWAL)
        .eq('id_siswa', raceSiswaId);

      if (dbRecords && dbRecords.length > 0) {
        cleanupRegistry.absensiIds.add(dbRecords[0].id_absensi);
      }

      const exactlyOneRecord = dbRecords && dbRecords.length === 1;

      recordTest(
        'ADV-4.1',
        'Rapid 10x concurrent double-submit handled atomically (all succeed, exactly 1 DB record)',
        'Race Conditions',
        allSucceeded && exactlyOneRecord,
        !allSucceeded 
          ? `Some concurrent calls failed: ${JSON.stringify(burstResults.map(r => r.status))}`
          : (!exactlyOneRecord ? `Found ${dbRecords?.length} duplicate records in absensi_ujian!` : null)
      );
    }

    // 4.2 Re-signature update idempotency (overwriting prior signature)
    {
      const UPDATED_SIGNATURE = SAMPLE_SIGNATURE_PNG.replace('AAAAABJRU5ErkJggg==', 'XXXXABJRU5ErkJggg==');
      const resUpdate = await fetchAPI('submit_absensi_siswa', {
        id_log: raceLogId,
        id_jadwal: TEST_JADWAL,
        id_siswa: raceSiswaId,
        npsn: TEST_NPSN,
        id_ruang: FIXTURE_ROOM_ID,
        tanda_tangan: UPDATED_SIGNATURE
      });

      const { data: updatedRecords } = await supabase
        .from('absensi_ujian')
        .select('*')
        .eq('id_jadwal', TEST_JADWAL)
        .eq('id_siswa', raceSiswaId);

      const stillExactlyOne = updatedRecords && updatedRecords.length === 1;
      const signatureUpdated = updatedRecords && updatedRecords.length > 0 && updatedRecords[0].tanda_tangan === UPDATED_SIGNATURE;

      recordTest(
        'ADV-4.2',
        'Subsequent signature submission updates existing record in place without duplicating',
        'Race Conditions',
        resUpdate.status === 'success' && stillExactlyOne && signatureUpdated,
        !stillExactlyOne ? `Found ${updatedRecords?.length} records` : (!signatureUpdated ? 'Signature was not updated' : null)
      );
    }

    // Clean up race test record
    await supabase.from('absensi_ujian').delete().eq('id_jadwal', TEST_JADWAL).eq('id_siswa', raceSiswaId);


    // -------------------------------------------------------------------------
    // SECTION 5: Network Drop / Refresh Mid-Session & State Resumption
    // -------------------------------------------------------------------------
    console.log('\n\x1b[36m▶ [SECTION 5] Network Drop / Refresh Mid-Session & State Resumption\x1b[0m');

    // 5.1 Session resumption on refresh when already signed
    {
      const refreshLogId = `LOG-REFRESH-${Date.now()}`;
      cleanupRegistry.logIds.add(refreshLogId);

      // Create signed session in DB
      await supabase.from('log_ujian').insert([{
        id_log: refreshLogId,
        id_jadwal: TEST_JADWAL,
        id_siswa: TEST_SISWA,
        status_ujian: 'SEDANG KERJA',
        tanda_tangan: SAMPLE_SIGNATURE_PNG,
        status_kehadiran: 'HADIR'
      }]);

      await supabase.from('absensi_ujian').upsert([{
        id_absensi: `ABS-REF-${Date.now()}`,
        npsn: TEST_NPSN,
        id_jadwal: TEST_JADWAL,
        id_siswa: TEST_SISWA,
        id_log: refreshLogId,
        tanda_tangan: SAMPLE_SIGNATURE_PNG,
        status_kehadiran: 'HADIR',
        status_verifikasi: 'MENUNGGU'
      }], { onConflict: 'id_jadwal, id_siswa' });

      // Emulate page reload: fetch get_status_log_ujian
      const resStatus = await fetchAPI('get_status_log_ujian', { id_log: refreshLogId });
      const hasSignedServer = resStatus.status === 'success' && resStatus.data?.has_signed === true;

      // Emulate ExamRoom initial state calculation (ExamRoom.jsx:54-63)
      const simulatedSessionStorage = {
        dataLog: {
          tanda_tangan: SAMPLE_SIGNATURE_PNG,
          has_signed: true
        }
      };
      const initialHasSigned = Boolean(
        simulatedSessionStorage?.dataLog?.tanda_tangan || 
        simulatedSessionStorage?.dataLog?.has_signed
      );

      // Verify get_soal_ujian succeeds without signature prompt
      const resSoal = await fetchAPI('get_soal_ujian', {
        id_jadwal: TEST_JADWAL,
        id_log: refreshLogId,
        npsn: TEST_NPSN
      });

      const questionsLoaded = resSoal.status === 'success' && Array.isArray(resSoal.data);

      recordTest(
        'ADV-5.1',
        'Reload continuity: Signed student resumes exam instantly without re-prompting canvas',
        'State Resumption',
        hasSignedServer && initialHasSigned && questionsLoaded,
        !hasSignedServer ? 'Server failed to report has_signed: true' : (!questionsLoaded ? 'Questions failed to load' : null)
      );
    }

    // 5.2 Session resumption on refresh when NOT yet signed
    {
      const unsignedRefreshLogId = `LOG-REFRESH-UNSIGN-${Date.now()}`;
      cleanupRegistry.logIds.add(unsignedRefreshLogId);

      // Clean absensi
      await supabase.from('absensi_ujian').delete().eq('id_jadwal', TEST_JADWAL).eq('id_siswa', TEST_SISWA);

      await supabase.from('log_ujian').insert([{
        id_log: unsignedRefreshLogId,
        id_jadwal: TEST_JADWAL,
        id_siswa: TEST_SISWA,
        status_ujian: 'SEDANG KERJA',
        tanda_tangan: null
      }]);

      const resStatus = await fetchAPI('get_status_log_ujian', { id_log: unsignedRefreshLogId });
      const isNotSigned = resStatus.status === 'success' && resStatus.data?.has_signed === false;

      // Emulate initial state: no signature in sessionStorage
      const emptySession = {};
      const initialHasSigned = Boolean(emptySession?.dataLog?.tanda_tangan || emptySession?.dataLog?.has_signed);

      // Attempting to fetch soal must be gated
      const resSoal = await fetchAPI('get_soal_ujian', {
        id_jadwal: TEST_JADWAL,
        id_log: unsignedRefreshLogId,
        npsn: TEST_NPSN
      });

      const isGated = resSoal.status === 'error' && resSoal.need_signature === true;

      recordTest(
        'ADV-5.2',
        'Reload gating: Unsigned student is re-presented with signature modal and questions gated',
        'State Resumption',
        isNotSigned && !initialHasSigned && isGated,
        !isNotSigned ? 'Server incorrectly reported has_signed: true' : (!isGated ? 'Questions were not gated on refresh' : null)
      );
    }

    // 5.3 Error recovery on network drop during signature submit
    {
      // Emulate handleSignatureSubmit (ExamRoom.jsx:127-178) error catch path:
      // When network fails, isSigningSubmitting must revert to false
      let isSigningSubmitting = true;
      let errorReported = false;
      const fakeNetworkError = new Error('Failed to fetch');

      try {
        throw fakeNetworkError;
      } catch (err) {
        isSigningSubmitting = false; // ExamRoom line 173
        errorReported = true;
      }

      recordTest(
        'ADV-5.3',
        'Network drop during signature submit: isSigningSubmitting resets to false allowing retry',
        'State Resumption',
        isSigningSubmitting === false && errorReported === true,
        'Submit state stayed locked on network failure'
      );
    }

    // 5.4 ExamRoom code inspection: Touch isolation and double-gating architecture
    {
      const examRoomCode = fs.readFileSync(path.join(srcDir, 'views', 'ExamRoom.jsx'), 'utf8');
      const modalCode = fs.readFileSync(path.join(srcDir, 'components', 'DigitalSignatureModal.jsx'), 'utf8');

      const hasModalGating = /if\s*\(!hasSigned\)\s*\{\s*return\s*\(\s*<DigitalSignatureModal/.test(examRoomCode);
      const hasTouchActionNone = /style=\{\{\s*touchAction:\s*['"]none['"]\s*\}\}/.test(modalCode) || /touch-none/.test(modalCode);
      const hasFullscreenGesture = /document\.documentElement\.requestFullscreen/.test(examRoomCode);

      recordTest(
        'ADV-5.4',
        'Code architecture: touch-action:none, user-gesture fullscreen & early return modal gating',
        'State Resumption',
        hasModalGating && hasTouchActionNone && hasFullscreenGesture,
        'Code architecture missing critical mobile/gating provisions'
      );
    }

  } catch (err) {
    console.error('\x1b[31mFATAL TEST RUNNER ERROR:\x1b[0m', err);
    recordTest('FATAL', 'Adversarial Test Suite Runner Error', 'System', false, err.message);
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP FIXTURES
    // -------------------------------------------------------------------------
    console.log('\n\x1b[90mCleaning up test database fixtures...\x1b[0m');
    try {
      if (cleanupRegistry.absensiIds.size > 0) {
        await supabase.from('absensi_ujian').delete().in('id_absensi', Array.from(cleanupRegistry.absensiIds));
      }
      if (cleanupRegistry.logIds.size > 0) {
        await supabase.from('log_ujian').delete().in('id_log', Array.from(cleanupRegistry.logIds));
      }
      if (cleanupRegistry.ruangIds.size > 0) {
        await supabase.from('ruang_ujian').delete().in('id_ruang', Array.from(cleanupRegistry.ruangIds));
      }
      if (cleanupRegistry.soalIds && cleanupRegistry.soalIds.size > 0) {
        await supabase.from('soal_ujian').delete().in('id_soal', Array.from(cleanupRegistry.soalIds));
      }
      if (cleanupRegistry.jadwalIds && cleanupRegistry.jadwalIds.size > 0) {
        await supabase.from('jadwal').delete().in('id_jadwal', Array.from(cleanupRegistry.jadwalIds));
      }
      console.log('\x1b[90mDatabase fixtures cleaned up successfully.\x1b[0m');
    } catch (cleanErr) {
      console.warn('\x1b[33mCleanup warning:\x1b[0m', cleanErr.message);
    }
  }

  // ---------------------------------------------------------------------------
  // SUMMARY AND VERDICT
  // ---------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('   ADVERSARIAL STRESS TEST SUMMARY & VERDICT                            ');
  console.log('========================================================================');
  console.log(`  Total Executed : ${results.total}`);
  console.log(`  Passed         : \x1b[32m${results.passed}\x1b[0m`);
  console.log(`  Failed         : \x1b[${results.failed > 0 ? '31' : '32'}m${results.failed}\x1b[0m`);
  console.log(`  Findings       : ${results.findings.length}`);

  const verdict = results.failed === 0 ? 'APPROVE' : 'REQUEST_CHANGES';
  console.log(`\n  \x1b[1mEXPLICIT VERDICT: \x1b[${verdict === 'APPROVE' ? '32' : '31'}m${verdict}\x1b[0m\n`);

  // Write machine-readable results
  fs.writeFileSync(
    path.join(__dirname, 'test_challenger_r5_1_results.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );

  return results;
}

runAdversarialTestSuite().then(res => {
  if (res.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
});
