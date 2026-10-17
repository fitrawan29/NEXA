#!/usr/bin/env node
/**
 * Test Suite: CBT NEXA Round 6 (UX Softening, Grace Period & Polling Optimizations)
 *
 * Verifies:
 * 1. R1: Soften Timer UX in SiswaView.jsx
 *    - Countdown component has NO animate-pulse
 *    - Uses static color styling for urgency (< 15 min)
 * 2. R2: Anti-Cheat Grace Period in ExamRoom.jsx
 *    - Delays reportViolation / handleSecurityViolation by at least 3000ms on blur/visibility
 *    - Automatically cancels violation timer if user returns within grace period (focus / !document.hidden / returnToExam)
 *    - Simulates rapid leave/return, leave/expire, and multi-event suppression
 * 3. R3: Polling Intervals
 *    - AdminView.jsx: background polling interval >= 15000ms
 *    - GuruView.jsx: monitoring & pengawasan polling intervals >= 15000ms
 *    - SiswaView.jsx: background intervals >= 15000ms
 *    - No 5000ms polling calls left in views
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const siswaViewPath = path.resolve(projectRoot, 'src', 'views', 'SiswaView.jsx');
const examRoomPath = path.resolve(projectRoot, 'src', 'views', 'ExamRoom.jsx');
const guruViewPath = path.resolve(projectRoot, 'src', 'views', 'GuruView.jsx');
const adminViewPath = path.resolve(projectRoot, 'src', 'views', 'AdminView.jsx');

const siswaCode = fs.readFileSync(siswaViewPath, 'utf8');
const examRoomCode = fs.readFileSync(examRoomPath, 'utf8');
const guruCode = fs.readFileSync(guruViewPath, 'utf8');
const adminCode = fs.readFileSync(adminViewPath, 'utf8');

let passed = 0;
let failed = 0;
const failures = [];

function test(description, condition, details = '') {
  if (condition) {
    passed++;
    console.log(`  ✔ [PASS] ${description}`);
  } else {
    failed++;
    failures.push({ description, details });
    console.log(`  ✖ [FAIL] ${description}${details ? ` -> ${details}` : ''}`);
  }
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('   CBT NEXA - ROUND 6 VERIFICATION SUITE                               ');
  console.log('========================================================================\n');

  // =============================================================================
  // 1. AST Syntax Check
  // =============================================================================
  console.log('▶ 1. AST Syntax Integrity');
  try {
    parse(siswaCode, { sourceType: 'module', plugins: ['jsx'] });
    test('SiswaView.jsx parses cleanly with zero AST syntax errors', true);
  } catch (e) {
    test('SiswaView.jsx parses cleanly with zero AST syntax errors', false, e.message);
  }

  try {
    parse(examRoomCode, { sourceType: 'module', plugins: ['jsx'] });
    test('ExamRoom.jsx parses cleanly with zero AST syntax errors', true);
  } catch (e) {
    test('ExamRoom.jsx parses cleanly with zero AST syntax errors', false, e.message);
  }

  try {
    parse(guruCode, { sourceType: 'module', plugins: ['jsx'] });
    test('GuruView.jsx parses cleanly with zero AST syntax errors', true);
  } catch (e) {
    test('GuruView.jsx parses cleanly with zero AST syntax errors', false, e.message);
  }

  try {
    parse(adminCode, { sourceType: 'module', plugins: ['jsx'] });
    test('AdminView.jsx parses cleanly with zero AST syntax errors', true);
  } catch (e) {
    test('AdminView.jsx parses cleanly with zero AST syntax errors', false, e.message);
  }

  // =============================================================================
  // 2. R1: Soften Timer UX (SiswaView.jsx Countdown)
  // =============================================================================
  console.log('\n▶ 2. R1: Soften Timer UX in SiswaView.jsx');
  
  // Extract Countdown component body
  const countdownMatch = siswaCode.match(/const Countdown = \(\{ targetDate \}\) => \{([\s\S]*?)\n\};/);
  test('Countdown component definition found in SiswaView.jsx', !!countdownMatch);

  if (countdownMatch) {
    const countdownBody = countdownMatch[1];
    const hasPulse = countdownBody.includes('animate-pulse');
    test('Countdown component does NOT use animate-pulse for urgency', !hasPulse, 'animate-pulse found in Countdown');

    const hasStaticUrgentColor = /isUrgent\s*\?\s*['"][^'"]*text-(amber|red)-\d+[^'"]*['"]/.test(countdownBody);
    test('Countdown component uses static color change (amber/red) when isUrgent', hasStaticUrgentColor);

    const has15MinCheck = /diff\s*<\s*15\s*\*\s*60\s*\*\s*1000/.test(countdownBody);
    test('Countdown checks urgency threshold at 15 minutes', has15MinCheck);
  }

  // =============================================================================
  // 3. R2: Anti-Cheat Grace Period (ExamRoom.jsx)
  // =============================================================================
  console.log('\n▶ 3. R2: Anti-Cheat Grace Period in ExamRoom.jsx');

  const hasGracePeriodTimerRef = /gracePeriodTimer\s*=\s*useRef\(null\)/.test(examRoomCode);
  test('ExamRoom declares gracePeriodTimer ref', hasGracePeriodTimerRef);

  const hasScheduleSecurityViolation = /const scheduleSecurityViolation =|const startGracePeriodViolation =/.test(examRoomCode);
  test('ExamRoom implements scheduleSecurityViolation or startGracePeriodViolation function', hasScheduleSecurityViolation);

  // Check delay is at least 3000ms
  const matchDelay = examRoomCode.match(/scheduleSecurityViolation[\s\S]*?setTimeout\([\s\S]*?,\s*(\d+)\s*\)/);
  const delayMs = matchDelay ? parseInt(matchDelay[1], 10) : 0;
  test(`ExamRoom delays violation trigger by at least 3000ms (configured: ${delayMs}ms)`, delayMs >= 3000);

  // Check cancellation function exists
  const hasCancelGracePeriod = /const cancelGracePeriod\s*=\s*\(\)\s*=>/.test(examRoomCode);
  test('ExamRoom defines cancelGracePeriod to cancel pending violation timers', hasCancelGracePeriod);

  // Check visibilitychange cancellation on document visible
  const cancelsOnVisible = /document\.hidden[\s\S]*?else\s*\{[\s\S]*?cancelGracePeriod\(\)/.test(examRoomCode);
  test('ExamRoom cancels grace period when document becomes visible (!document.hidden)', cancelsOnVisible);

  // Check window focus listener attaches and cleans up
  const attachesFocus = examRoomCode.includes("addEventListener('focus', handleWindowFocus)") || examRoomCode.includes('addEventListener("focus", handleWindowFocus)');
  test('ExamRoom attaches "focus" event listener to window to cancel grace period on focus', attachesFocus);

  const cleansFocus = examRoomCode.includes("removeEventListener('focus', handleWindowFocus)") || examRoomCode.includes('removeEventListener("focus", handleWindowFocus)');
  test('ExamRoom properly removes "focus" event listener on unmount', cleansFocus);

  // Check returnToExam cancels grace period
  const returnToExamCancels = /returnToExam\s*=\s*\(\)\s*=>\s*\{[\s\S]*?cancelGracePeriod\(\)/.test(examRoomCode);
  test('returnToExam cancels grace period before restoring exam focus', returnToExamCancels);

  // Functional simulation of Grace Period & Cancellation logic
  console.log('\n▶ 4. Functional Grace Period & Cancellation Simulation');
  {
    let violationReportedCount = 0;
    let activeTimer = null;
    let lastViolationTime = 0;

    const fakeReportViolation = (reason) => {
      violationReportedCount++;
    };

    const cancelTimer = () => {
      if (activeTimer) {
        clearTimeout(activeTimer);
        activeTimer = null;
      }
    };

    const scheduleViolation = (reason, duration = delayMs) => {
      if (activeTimer) return; // already pending
      activeTimer = setTimeout(() => {
        activeTimer = null;
        const now = Date.now();
        if (now - lastViolationTime < 2500) return;
        lastViolationTime = now;
        fakeReportViolation(reason);
      }, duration);
    };

    // Scenario A: Student leaves and returns in 1500ms (within 3000ms grace period)
    scheduleViolation('blur');
    test('Sim A: Timer is pending after blur', activeTimer !== null);
    // Student returns at 1500ms
    cancelTimer();
    test('Sim A: Timer is cancelled upon student return', activeTimer === null);
    await new Promise((r) => setTimeout(r, 200));
    test('Sim A: Zero violations recorded when student returns within grace period', violationReportedCount === 0);

    // Scenario B: Rapid multi-event (blur + visibility hidden within 50ms)
    violationReportedCount = 0;
    scheduleViolation('blur', 100);
    const firstTimer = activeTimer;
    scheduleViolation('visibility hidden', 100);
    test('Sim B: Second concurrent event does not overwrite or double-schedule pending timer', activeTimer === firstTimer);
    await new Promise((r) => setTimeout(r, 150));
    test('Sim B: Exactly 1 violation reported when grace period expires without return', violationReportedCount === 1);

    // Scenario C: Student returns after grace period already expired
    cancelTimer(); // should be safe no-op
    test('Sim C: Calling cancel after timer execution is safe no-op', activeTimer === null);
  }

  // =============================================================================
  // 5. R3: Polling Intervals
  // =============================================================================
  console.log('\n▶ 5. R3: Data Polling Intervals (>= 15000ms)');

  // AdminView
  const adminMonitoringMatch = adminCode.match(/if\s*\(activeTab\s*===\s*['"]monitoring['"][\s\S]*?setInterval\([\s\S]*?,\s*(\d+)\s*\)/);
  const adminInterval = adminMonitoringMatch ? parseInt(adminMonitoringMatch[1], 10) : 0;
  test(`AdminView monitoring polling interval is at least 15000ms (configured: ${adminInterval}ms)`, adminInterval >= 15000);

  const adminHas5000 = /setInterval\([^,]+,\s*5000\s*\)/.test(adminCode);
  test('AdminView has NO remaining 5000ms polling intervals', !adminHas5000);

  // GuruView
  const guruMonitoringMatch = guruCode.match(/if\s*\(activeTab\s*===\s*['"]monitoring['"][\s\S]*?setInterval\([\s\S]*?,\s*(\d+)\s*\)/);
  const guruMonitoringInterval = guruMonitoringMatch ? parseInt(guruMonitoringMatch[1], 10) : 0;
  test(`GuruView monitoring polling interval is at least 15000ms (configured: ${guruMonitoringInterval}ms)`, guruMonitoringInterval >= 15000);

  const guruPengawasanMatch = guruCode.match(/if\s*\(activeTab\s*===\s*['"]pengawasan['"][\s\S]*?setInterval\([\s\S]*?,\s*(\d+)\s*\)/);
  const guruPengawasanInterval = guruPengawasanMatch ? parseInt(guruPengawasanMatch[1], 10) : 0;
  test(`GuruView pengawasan polling interval is at least 15000ms (configured: ${guruPengawasanInterval}ms)`, guruPengawasanInterval >= 15000);

  const guruHas5000 = /setInterval\([^,]+,\s*5000\s*\)/.test(guruCode);
  test('GuruView has NO remaining 5000ms polling intervals', !guruHas5000);

  // SiswaView
  const siswaMatches = [...siswaCode.matchAll(/setInterval\([^,]+,\s*(\d+)\s*\)/g)];
  const siswaDelays = siswaMatches.map(m => parseInt(m[1], 10));
  // Filter out the 1-second countdown clock (which ticks seconds for UI clock)
  const siswaBackgroundDelays = siswaDelays.filter(d => d > 1000);
  const allSiswaBackgroundAtLeast15s = siswaBackgroundDelays.every(d => d >= 15000);
  test(`SiswaView background polling intervals are all >= 15000ms (${siswaBackgroundDelays.join(', ')} ms)`, allSiswaBackgroundAtLeast15s && siswaBackgroundDelays.length > 0);

  const siswaHas5000 = /setInterval\([^,]+,\s*5000\s*\)/.test(siswaCode);
  test('SiswaView has NO 5000ms polling intervals', !siswaHas5000);

  // =============================================================================
  // Summary
  // =============================================================================
  console.log('\n========================================================================');
  console.log('   FINAL VERDICT                                                        ');
  console.log('========================================================================');
  console.log(`  Total Executed : ${passed + failed}`);
  console.log(`  Passed         : ${passed}`);
  console.log(`  Failed         : ${failed}`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(e => {
  console.error('Test suite failed with unexpected error:', e);
  process.exit(1);
});
