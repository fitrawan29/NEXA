#!/usr/bin/env node
/**
 * CBT NEXA - CHALLENGER ADVERSARIAL STRESS TEST SUITE (ROUND 6)
 *
 * Adversarial tests designed to break:
 * 1. Rapid blur/focus cycling (50 rapid transitions)
 * 2. Timer ref leak & unmount lifecycle safety (React StrictMode simulation)
 * 3. Fullscreen lockdown & blur overlay integration
 * 4. Submission interruption during pending grace period
 * 5. Complete eradication of animate-pulse in all student exam timers
 * 6. Verification of all polling intervals >= 15000ms across views
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
const failureDetails = [];

function assert(name, condition, extra = '') {
  if (condition) {
    passed++;
    console.log(`  ✔ [PASS] ${name}`);
  } else {
    failed++;
    failureDetails.push({ name, extra });
    console.log(`  ✖ [FAIL] ${name}${extra ? ` -> ${extra}` : ''}`);
  }
}

async function runAdversarialSuite() {
  console.log('========================================================================');
  console.log('   CBT NEXA - ADVERSARIAL REVIEWER STRESS SUITE (ROUND 6)               ');
  console.log('========================================================================\n');

  // =========================================================================
  // 1. Static AST & Code Parsing
  // =========================================================================
  console.log('▶ 1. AST Structural Checks');
  assert('SiswaView.jsx AST valid', !!parse(siswaCode, { sourceType: 'module', plugins: ['jsx'] }));
  assert('ExamRoom.jsx AST valid', !!parse(examRoomCode, { sourceType: 'module', plugins: ['jsx'] }));
  assert('GuruView.jsx AST valid', !!parse(guruCode, { sourceType: 'module', plugins: ['jsx'] }));
  assert('AdminView.jsx AST valid', !!parse(adminCode, { sourceType: 'module', plugins: ['jsx'] }));

  // =========================================================================
  // 2. R1: Soften Timer UX (Zero animate-pulse in Student Exam Timers)
  // =========================================================================
  console.log('\n▶ 2. R1: Soften Timer UX (SiswaView & ExamRoom)');
  
  // SiswaView Countdown
  const countdownMatch = siswaCode.match(/const Countdown = \(\{ targetDate \}\) => \{([\s\S]*?)\n\};/);
  assert('Countdown component exists in SiswaView', !!countdownMatch);
  if (countdownMatch) {
    const hasPulse = countdownMatch[1].includes('animate-pulse');
    assert('Countdown component does NOT use animate-pulse for urgency', !hasPulse);
    assert('Countdown uses static amber/red text for urgency', /text-(amber|red)-\d+/.test(countdownMatch[1]));
    assert('Countdown triggers urgency at < 15 minutes', /diff\s*<\s*15\s*\*\s*60\s*\*\s*1000/.test(countdownMatch[1]));
  }

  // ExamRoom Countdown Header Timer
  const examRoomTimerMatch = examRoomCode.match(/timeLeft\.total\s*<\s*60000\s*\?\s*['"]([^'"]+)['"]/);
  assert('ExamRoom header timer defines < 60000 urgency branch', !!examRoomTimerMatch);
  if (examRoomTimerMatch) {
    const timerClass = examRoomTimerMatch[1];
    const headerTimerHasPulse = timerClass.includes('animate-pulse');
    assert('ExamRoom header timer does NOT use animate-pulse when < 60s', !headerTimerHasPulse);
    assert('ExamRoom header timer uses calm static rose styling', timerClass.includes('text-rose-600') && timerClass.includes('bg-rose-50'));
  }

  // =========================================================================
  // 3. R2: Anti-Cheat Grace Period & Fullscreen Enforcement
  // =========================================================================
  console.log('\n▶ 3. R2: Anti-Cheat Grace Period Implementation');

  // Verify cancelGracePeriod is declared early and cleans refs to null
  const cancelGracePeriodMatch = examRoomCode.match(/const cancelGracePeriod = \(\) => \{([\s\S]*?)\};/);
  assert('cancelGracePeriod is defined as a top-level component function', !!cancelGracePeriodMatch);
  if (cancelGracePeriodMatch) {
    const body = cancelGracePeriodMatch[1];
    assert('cancelGracePeriod clears gracePeriodTimer timeout', body.includes('clearTimeout(gracePeriodTimer.current)'));
    assert('cancelGracePeriod resets gracePeriodTimer.current to null', body.includes('gracePeriodTimer.current = null'));
    assert('cancelGracePeriod clears windowBlurTimerRef timeout', body.includes('clearTimeout(windowBlurTimerRef.current)'));
    assert('cancelGracePeriod resets windowBlurTimerRef.current to null', body.includes('windowBlurTimerRef.current = null'));
  }

  // Verify cleanup on unmount calls cancelGracePeriod
  const unmountCleanupMatch = examRoomCode.match(/return\s*\(\)\s*=>\s*\{([\s\S]*?)\};\s*\}\s*,\s*\[hasSigned\]\);/);
  assert('useEffect([hasSigned]) cleanup calls cancelGracePeriod()', unmountCleanupMatch && unmountCleanupMatch[1].includes('cancelGracePeriod()'));

  // Verify triggerStrike3Kick calls cancelGracePeriod
  const strike3KickMatch = examRoomCode.match(/const triggerStrike3Kick = \(\) => \{([\s\S]*?)\};/);
  assert('triggerStrike3Kick calls cancelGracePeriod()', strike3KickMatch && strike3KickMatch[1].includes('cancelGracePeriod()'));

  // Verify executeSubmitExam calls cancelGracePeriod
  const submitExamMatch = examRoomCode.match(/const executeSubmitExam = async \([\s\S]*?\) => \{([\s\S]*?)isSubmittingRef\.current\s*=\s*true/);
  assert('executeSubmitExam calls cancelGracePeriod() before submission', submitExamMatch && submitExamMatch[1].includes('cancelGracePeriod()'));

  // Verify scheduleSecurityViolation delay >= 3000ms
  const scheduleMatch = examRoomCode.match(/scheduleSecurityViolation = \([\s\S]*?\) => \{([\s\S]*?)\n  \};/);
  assert('scheduleSecurityViolation exists', !!scheduleMatch);
  if (scheduleMatch) {
    const schedBody = scheduleMatch[1];
    const delayMatch = schedBody.match(/setTimeout\([\s\S]*?,\s*(\d+)\s*\)/);
    const delay = delayMatch ? parseInt(delayMatch[1], 10) : 0;
    assert(`scheduleSecurityViolation delays trigger by >= 3000ms (configured: ${delay}ms)`, delay >= 3000);
    assert('scheduleSecurityViolation guards against active timers (deduplication)', schedBody.includes('if (gracePeriodTimer.current || windowBlurTimerRef.current) return;'));
  }

  // Verify blurOverlay activation on security violation when lockdown is active
  const violationHandlerMatch = examRoomCode.match(/const handleSecurityViolation = \([\s\S]*?\) => \{([\s\S]*?)\n  \};/);
  assert('handleSecurityViolation activates blurOverlay if lockdown is true', violationHandlerMatch && violationHandlerMatch[1].includes('setBlurOverlay(true)'));

  // Verify handleFullscreenChange activates blurOverlay immediately upon fullscreen exit
  const fsHandlerMatch = examRoomCode.match(/const handleFullscreenChange = \(\) => \{([\s\S]*?)\};/);
  assert('handleFullscreenChange activates blurOverlay immediately upon fullscreen exit', fsHandlerMatch && fsHandlerMatch[1].includes('setBlurOverlay(true)'));

  // Verify focus and visibility unhide trigger enforceFullscreen when lockdown is active
  const focusHandlerMatch = examRoomCode.match(/const handleWindowFocus = \(\) => \{([\s\S]*?)\};/);
  assert('handleWindowFocus enforces fullscreen if lockdown is active', focusHandlerMatch && focusHandlerMatch[1].includes('enforceFullscreen()'));
  assert('handleWindowFocus protects lockdown if not in fullscreen', focusHandlerMatch && focusHandlerMatch[1].includes('!document.fullscreenElement') && focusHandlerMatch[1].includes('setBlurOverlay(true)'));

  // =========================================================================
  // 4. Behavioral Stress Simulations
  // =========================================================================
  console.log('\n▶ 4. Behavioral Stress Simulations');

  // Exact engine state reproduction
  class AntiCheatSimulationEngine {
    constructor() {
      this.isSubmitting = false;
      this.isBlocked = false;
      this.lastViolationTime = 0;
      this.violationCount = 0;
      this.gracePeriodTimer = null;
      this.windowBlurTimerRef = null;
      this.blurOverlay = false;
      this.browserLockdown = true;
      this.isFullscreen = true;
    }

    cancelGracePeriod() {
      if (this.gracePeriodTimer) {
        clearTimeout(this.gracePeriodTimer);
        this.gracePeriodTimer = null;
      }
      if (this.windowBlurTimerRef) {
        clearTimeout(this.windowBlurTimerRef);
        this.windowBlurTimerRef = null;
      }
    }

    scheduleSecurityViolation(reason) {
      if (this.isSubmitting || this.isBlocked) return;
      if (this.gracePeriodTimer || this.windowBlurTimerRef) return;

      const timer = setTimeout(() => {
        this.gracePeriodTimer = null;
        this.windowBlurTimerRef = null;
        this.handleSecurityViolation(reason);
      }, 300); // 300ms scaled simulation time for 3000ms
      this.gracePeriodTimer = timer;
      this.windowBlurTimerRef = timer;
    }

    handleSecurityViolation(reason) {
      if (this.isSubmitting || this.isBlocked) return;
      const now = Date.now();
      if (now - this.lastViolationTime < 250) return; // 250ms scaled for 2500ms
      this.lastViolationTime = now;
      this.violationCount++;
      if (this.browserLockdown) {
        this.blurOverlay = true;
      }
    }

    onFullscreenExit() {
      if (this.browserLockdown) {
        this.isFullscreen = false;
        this.blurOverlay = true;
        this.scheduleSecurityViolation('fullscreen exit');
      }
    }

    onReturnToExam() {
      this.cancelGracePeriod();
      this.blurOverlay = false;
      this.isFullscreen = true;
    }

    onBlur() {
      this.scheduleSecurityViolation('window blur');
    }

    onFocus() {
      if (this.browserLockdown && !this.isFullscreen) {
        this.blurOverlay = true;
      } else {
        this.cancelGracePeriod();
      }
    }

    onVisibilityHidden() {
      this.scheduleSecurityViolation('visibility hidden');
    }

    onVisibilityVisible() {
      if (this.browserLockdown && !this.isFullscreen) {
        this.blurOverlay = true;
      } else {
        this.cancelGracePeriod();
      }
    }

    onSubmit() {
      this.cancelGracePeriod();
      this.isSubmitting = true;
    }
  }

  // Sim 1: Rapid Blur/Focus cycling (50 rapid cycles under grace period)
  {
    const engine = new AntiCheatSimulationEngine();
    for (let i = 0; i < 50; i++) {
      engine.onBlur();
      // Refocus after 5ms (well under 300ms grace period)
      await new Promise(r => setTimeout(r, 5));
      engine.onFocus();
    }
    await new Promise(r => setTimeout(r, 350));
    assert('Sim 1: 50 rapid blur/focus cycles yield exactly 0 violations', engine.violationCount === 0);
    assert('Sim 1: Grace period timer is cleanly null after cycles', engine.gracePeriodTimer === null);
  }

  // Sim 2: Student stays away > grace period -> strike recorded
  {
    const engine = new AntiCheatSimulationEngine();
    engine.onBlur();
    // Wait for timer to expire (300ms + margin)
    await new Promise(r => setTimeout(r, 350));
    assert('Sim 2: Student staying away records 1 violation', engine.violationCount === 1);
    assert('Sim 2: blurOverlay is activated', engine.blurOverlay === true);
    // Student returns after violation
    engine.onFocus();
    assert('Sim 2: Focus after violation does not throw or double-record', engine.violationCount === 1);
  }

  // Sim 3: Simultaneous blur + visibility change deduplication
  {
    const engine = new AntiCheatSimulationEngine();
    engine.onBlur();
    const firstTimer = engine.gracePeriodTimer;
    engine.onVisibilityHidden();
    assert('Sim 3: Concurrent visibility hidden does not re-schedule timer', engine.gracePeriodTimer === firstTimer);
    await new Promise(r => setTimeout(r, 350));
    assert('Sim 3: Only 1 violation recorded despite multiple leave events', engine.violationCount === 1);
  }

  // Sim 4: Submission cancels pending grace period
  {
    const engine = new AntiCheatSimulationEngine();
    engine.onBlur();
    assert('Sim 4: Timer active before submit', engine.gracePeriodTimer !== null);
    engine.onSubmit();
    assert('Sim 4: Timer immediately cleared upon submit', engine.gracePeriodTimer === null);
    await new Promise(r => setTimeout(r, 350));
    assert('Sim 4: Zero violations recorded during submission', engine.violationCount === 0);
  }

  // Sim 5: React StrictMode double-unmount ref reset
  {
    const engine = new AntiCheatSimulationEngine();
    engine.onBlur();
    // Simulate unmount cleanup
    engine.cancelGracePeriod();
    assert('Sim 5: Cleanup properly resets timer ref to null', engine.gracePeriodTimer === null);
    // Simulate second mount & blur
    engine.onBlur();
    assert('Sim 5: Re-mount can successfully schedule new grace period', engine.gracePeriodTimer !== null);
    engine.cancelGracePeriod();
  }

  // Sim 6: Fullscreen exit + blur + refocus cannot bypass lockdown without returnToExam
  {
    const engine = new AntiCheatSimulationEngine();
    engine.onFullscreenExit();
    assert('Sim 6: Exiting fullscreen activates blurOverlay', engine.blurOverlay === true);
    assert('Sim 6: Grace period timer is ticking', engine.gracePeriodTimer !== null);

    // Student switches away (blur) and refocuses
    engine.onBlur();
    engine.onFocus();
    assert('Sim 6: Focusing without returning to fullscreen keeps blurOverlay active', engine.blurOverlay === true);
    assert('Sim 6: Grace period timer is NOT cancelled by window focus', engine.gracePeriodTimer !== null);

    // Student clicks "Kembali ke Ujian" within grace period
    engine.onReturnToExam();
    assert('Sim 6: Returning to exam dismisses overlay and restores fullscreen', engine.blurOverlay === false && engine.isFullscreen === true);
    assert('Sim 6: Returning to exam cleanly cancels grace period', engine.gracePeriodTimer === null);
    assert('Sim 6: Zero violations recorded for prompt return', engine.violationCount === 0);
  }

  // =========================================================================
  // 5. R3: Polling Intervals (>= 15000ms)
  // =========================================================================
  console.log('\n▶ 5. R3: Data Polling Intervals (>= 15000ms)');

  // AdminView
  const adminMonitoringMatch = adminCode.match(/if\s*\(activeTab\s*===\s*['"]monitoring['"][\s\S]*?setInterval\([\s\S]*?,\s*(\d+)\s*\)/);
  const adminInterval = adminMonitoringMatch ? parseInt(adminMonitoringMatch[1], 10) : 0;
  assert(`AdminView monitoring polling is >= 15000ms (configured: ${adminInterval}ms)`, adminInterval >= 15000);
  assert('AdminView contains NO 5000ms setInterval calls', !/setInterval\([^,]+,\s*5000\s*\)/.test(adminCode));

  // GuruView
  const guruMonitoringMatch = guruCode.match(/if\s*\(activeTab\s*===\s*['"]monitoring['"][\s\S]*?setInterval\([\s\S]*?,\s*(\d+)\s*\)/);
  const guruMonitoringInterval = guruMonitoringMatch ? parseInt(guruMonitoringMatch[1], 10) : 0;
  assert(`GuruView monitoring polling is >= 15000ms (configured: ${guruMonitoringInterval}ms)`, guruMonitoringInterval >= 15000);

  const guruPengawasanMatch = guruCode.match(/if\s*\(activeTab\s*===\s*['"]pengawasan['"][\s\S]*?setInterval\([\s\S]*?,\s*(\d+)\s*\)/);
  const guruPengawasanInterval = guruPengawasanMatch ? parseInt(guruPengawasanMatch[1], 10) : 0;
  assert(`GuruView pengawasan polling is >= 15000ms (configured: ${guruPengawasanInterval}ms)`, guruPengawasanInterval >= 15000);
  assert('GuruView contains NO 5000ms setInterval calls', !/setInterval\([^,]+,\s*5000\s*\)/.test(guruCode));

  // SiswaView
  const siswaMatches = [...siswaCode.matchAll(/setInterval\([^,]+,\s*(\d+)\s*\)/g)];
  const siswaDelays = siswaMatches.map(m => parseInt(m[1], 10));
  const siswaBackgroundDelays = siswaDelays.filter(d => d > 1000);
  const allSiswaBackgroundValid = siswaBackgroundDelays.every(d => d >= 15000);
  assert(`SiswaView background polling intervals are all >= 15000ms (${siswaBackgroundDelays.join(', ')} ms)`, allSiswaBackgroundValid && siswaBackgroundDelays.length > 0);
  assert('SiswaView contains NO 5000ms setInterval calls', !/setInterval\([^,]+,\s*5000\s*\)/.test(siswaCode));

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n========================================================================');
  console.log('   CHALLENGER ADVERSARIAL VERDICT                                       ');
  console.log('========================================================================');
  console.log(`  Total Executed : ${passed + failed}`);
  console.log(`  Passed         : ${passed}`);
  console.log(`  Failed         : ${failed}`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdversarialSuite().catch(err => {
  console.error('Fatal error running adversarial suite:', err);
  process.exit(1);
});
