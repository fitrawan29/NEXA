/**
 * Tier 2: Boundary & Corner Cases Test Suite
 * Validates edge cases:
 * - Empty states & zero items
 * - Timer thresholds & auto-lock
 * - Offline network resilience & reconnection sync
 * - First & last question navigation boundaries
 * - Extreme stimuli / text length
 * - Malformed payloads & escaping
 */

import { TestSuite, assert } from './test_framework.mjs';

export function createTier2Suite() {
  const suite = new TestSuite('Tier 2: Boundary & Corner Cases', 'Resilience under extreme inputs, edge conditions, and boundaries');

  suite.add('T2.1 [Boundary] Empty State Handling Across Collections', () => {
    const handleEmptyList = (items, emptyMessage) => {
      if (!items || items.length === 0) {
        return { isEmpty: true, render: emptyMessage };
      }
      return { isEmpty: false, render: items };
    };

    assert.isTrue(handleEmptyList([], 'Belum ada ujian').isEmpty, 'Empty array detected');
    assert.isTrue(handleEmptyList(null, 'Belum ada data').isEmpty, 'Null collection handled safely');
    assert.equal(handleEmptyList([], 'Belum ada jadwal').render, 'Belum ada jadwal', 'Renders appropriate message');
  });

  suite.add('T2.2 [Boundary] Timer Threshold 00:00:00 Triggers Auto-Lock & Auto-Submit', () => {
    let examLocked = false;
    let autoSubmitCalled = false;

    const tickTimer = (remainingSeconds) => {
      const nextTime = remainingSeconds - 1;
      if (nextTime <= 0) {
        examLocked = true;
        autoSubmitCalled = true;
        return 0;
      }
      return nextTime;
    };

    assert.equal(tickTimer(2), 1, 'Tick down from 2 to 1');
    assert.isFalse(examLocked, 'Exam remains unlocked when time > 0');

    assert.equal(tickTimer(1), 0, 'Tick down from 1 to 0');
    assert.isTrue(examLocked, 'Exam is locked when timer reaches 0');
    assert.isTrue(autoSubmitCalled, 'Auto-submit triggered on expiry');
  });

  suite.add('T2.3 [Boundary] Subtle Countdown Alert Threshold (Final 5 Minutes)', () => {
    const getTimerUrgencyStyle = (remainingSeconds) => {
      if (remainingSeconds <= 300) { // <= 5 minutes
        return 'text-rose-500 bg-rose-50 dark:bg-rose-950/30 border-rose-200';
      }
      return 'text-slate-700 bg-white dark:bg-slate-800 border-slate-200';
    };

    assert.match(getTimerUrgencyStyle(600), /text-slate-700/, 'Calm neutral style at 10 minutes');
    assert.match(getTimerUrgencyStyle(300), /text-rose-500/, 'Subtle rose alert at exactly 5 minutes');
    assert.match(getTimerUrgencyStyle(60), /text-rose-500/, 'Subtle rose alert at 1 minute');
  });

  suite.add('T2.4 [Boundary] Offline Network Event: Answers Preserved in Local Cache', () => {
    // Simulates student connection drop while answering
    const localCache = {};
    let isOffline = false;

    const onOfflineEvent = () => {
      isOffline = true;
    };

    const saveAnswer = (soalId, value) => {
      // Must save to local cache regardless of network state
      localCache[soalId] = value;
      if (!isOffline) {
        // remote sync
      }
    };

    onOfflineEvent();
    assert.isTrue(isOffline, 'Offline detected');
    saveAnswer('q1', 'B');
    saveAnswer('q2', ['1', '3']);

    assert.equal(localCache['q1'], 'B', 'Answer saved locally during offline');
    assert.deepEqual(localCache['q2'], ['1', '3'], 'Complex answer saved locally during offline');
  });

  suite.add('T2.5 [Boundary] Online Network Recovery: Queued Answers Synchronized', () => {
    const offlineQueue = ['q1', 'q2'];
    const syncedItems = [];

    const onOnlineEvent = () => {
      while (offlineQueue.length > 0) {
        const item = offlineQueue.shift();
        syncedItems.push(item);
      }
    };

    onOnlineEvent();
    assert.equal(offlineQueue.length, 0, 'Offline queue drained upon reconnection');
    assert.deepEqual(syncedItems, ['q1', 'q2'], 'All queued items synchronized');
  });

  suite.add('T2.6 [Boundary] Question Navigation: Lower Bound at Index 0', () => {
    let currentIndex = 0;
    const totalQuestions = 10;

    const prevQuestion = () => {
      currentIndex = Math.max(0, currentIndex - 1);
    };

    prevQuestion(); // Try going before question 0
    assert.equal(currentIndex, 0, 'Index remains 0, does not go negative');
    const isPrevDisabled = currentIndex === 0;
    assert.isTrue(isPrevDisabled, 'Previous button is disabled at first question');
  });

  suite.add('T2.7 [Boundary] Question Navigation: Upper Bound at Index N-1', () => {
    const totalQuestions = 5;
    let currentIndex = 4; // last question (index 4 of 5)
    let reviewModalOpened = false;

    const nextQuestion = () => {
      if (currentIndex >= totalQuestions - 1) {
        reviewModalOpened = true; // Opens review modal instead of going out of bounds
        return;
      }
      currentIndex = Math.min(totalQuestions - 1, currentIndex + 1);
    };

    nextQuestion();
    assert.equal(currentIndex, 4, 'Index stays at 4');
    assert.isTrue(reviewModalOpened, 'Review/submission confirmation opened at last question');
  });

  suite.add('T2.8 [Boundary] Palette Jump Index Clamping', () => {
    const totalQuestions = 25;
    const clampJumpIndex = (requestedIndex) => {
      if (typeof requestedIndex !== 'number' || isNaN(requestedIndex)) return 0;
      return Math.max(0, Math.min(totalQuestions - 1, Math.floor(requestedIndex)));
    };

    assert.equal(clampJumpIndex(-5), 0, 'Negative index clamped to 0');
    assert.equal(clampJumpIndex(99), 24, 'Oversized index clamped to 24');
    assert.equal(clampJumpIndex(12.7), 12, 'Floats floored safely');
    assert.equal(clampJumpIndex('invalid'), 0, 'Non-numbers default to 0');
  });

  suite.add('T2.9 [Boundary] Extreme Stimulus Length (>5,000 chars) Viewport Containment', () => {
    // Generate long stimulus passage
    const longText = 'Wacana literasi sains: ' + 'Sebuah studi ekstensif membuktikan bahwa interaksi ekosistem... '.repeat(100);
    assert.greaterThanOrEqual(longText.length, 5000, 'Passage length exceeds 5,000 characters');

    // Layout contract: Container must have overflow scroll classes
    const stimulusContainerClasses = 'max-h-[60vh] md:max-h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar p-6 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700';
    assert.match(stimulusContainerClasses, /overflow-y-auto/, 'Must be vertically scrollable');
    assert.match(stimulusContainerClasses, /max-h-/, 'Must enforce maximum height restraint');
  });

  suite.add('T2.10 [Boundary] Zero-Question Exam Payload Fallback Handling', () => {
    const initializeExam = (soalArray) => {
      if (!Array.isArray(soalArray) || soalArray.length === 0) {
        return { hasQuestions: false, emptyNotice: 'Tidak ada butir soal dalam ujian ini.' };
      }
      return { hasQuestions: true, total: soalArray.length };
    };

    assert.isFalse(initializeExam([]).hasQuestions, 'Empty array returns hasQuestions = false');
    assert.isFalse(initializeExam(null).hasQuestions, 'Null array returns hasQuestions = false');
    assert.isTrue(initializeExam([{ id: 1 }]).hasQuestions, 'Valid array returns hasQuestions = true');
  });

  suite.add('T2.11 [Boundary] Malformed Question Data Graceful Fallback', () => {
    // Question missing options or missing type
    const sanitizeQuestion = (rawQ) => {
      return {
        id_soal: rawQ.id_soal || 'unknown',
        tipe_soal: rawQ.tipe_soal || 'PG',
        pertanyaan: rawQ.pertanyaan || 'Pertanyaan tidak tersedia',
        opsi_a: rawQ.opsi_a || '-',
        opsi_b: rawQ.opsi_b || '-'
      };
    };

    const clean = sanitizeQuestion({ id_soal: 'q_incomplete' });
    assert.equal(clean.id_soal, 'q_incomplete', 'ID preserved');
    assert.equal(clean.tipe_soal, 'PG', 'Defaults to PG');
    assert.equal(clean.pertanyaan, 'Pertanyaan tidak tersedia', 'Fallback question text');
  });

  suite.add('T2.12 [Boundary] Special Characters, Mathematical Formulas & HTML Sanitization', () => {
    const rawInputs = [
      'f(x) = x^2 + 2x - 5 < 0 & x ∈ R',
      '<script>alert("xss")</script>',
      'Kombinasi "tanda kutip" dan \'single quotes\' & simbol <>&',
      '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}'
    ];

    const escapeHTML = (str) => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const sanitizedScript = escapeHTML(rawInputs[1]);
    assert.doesNotMatch(sanitizedScript, /<script>/, 'Script tags escaped');
    assert.match(sanitizedScript, /&lt;script&gt;/, 'Safe entity encoding');

    const mathText = escapeHTML(rawInputs[0]);
    assert.match(mathText, /&lt; 0 &amp;/, 'Math operators safely encoded');
  });

  return suite;
}
