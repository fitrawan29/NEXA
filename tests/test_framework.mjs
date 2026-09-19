/**
 * CBT NEXA E2E Test Runner Framework
 * Lightweight, zero-external-dependency test harness supporting Tiers 1-4 and Codebase Audits.
 */

export class AssertionError extends Error {
  constructor(message, actual, expected) {
    super(message);
    this.name = 'AssertionError';
    this.actual = actual;
    this.expected = expected;
  }
}

export const assert = {
  equal(actual, expected, message) {
    if (actual !== expected) {
      throw new AssertionError(
        message || `Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`,
        actual,
        expected
      );
    }
  },

  notEqual(actual, expected, message) {
    if (actual === expected) {
      throw new AssertionError(
        message || `Expected ${JSON.stringify(actual)} not to equal ${JSON.stringify(expected)}`,
        actual,
        expected
      );
    }
  },

  deepEqual(actual, expected, message) {
    const actStr = JSON.stringify(actual);
    const expStr = JSON.stringify(expected);
    if (actStr !== expStr) {
      throw new AssertionError(
        message || `Expected deep equality:\nActual:   ${actStr}\nExpected: ${expStr}`,
        actual,
        expected
      );
    }
  },

  ok(value, message) {
    if (!value) {
      throw new AssertionError(
        message || `Expected truthy value, got ${JSON.stringify(value)}`,
        value,
        true
      );
    }
  },

  isTrue(value, message) {
    if (value !== true) {
      throw new AssertionError(
        message || `Expected true, got ${JSON.stringify(value)}`,
        value,
        true
      );
    }
  },

  isFalse(value, message) {
    if (value !== false) {
      throw new AssertionError(
        message || `Expected false, got ${JSON.stringify(value)}`,
        value,
        false
      );
    }
  },

  match(string, regex, message) {
    if (!regex.test(string)) {
      throw new AssertionError(
        message || `Expected string to match ${regex}: "${string.slice(0, 100)}..."`,
        string,
        regex.toString()
      );
    }
  },

  doesNotMatch(string, regex, message) {
    if (regex.test(string)) {
      throw new AssertionError(
        message || `Expected string NOT to match ${regex}`,
        string,
        'No match'
      );
    }
  },

  greaterThanOrEqual(actual, expected, message) {
    if (actual < expected) {
      throw new AssertionError(
        message || `Expected ${actual} >= ${expected}`,
        actual,
        expected
      );
    }
  },

  throws(fn, expectedRegexOrType, message) {
    let threw = false;
    let caughtError = null;
    try {
      fn();
    } catch (e) {
      threw = true;
      caughtError = e;
    }
    if (!threw) {
      throw new AssertionError(message || 'Expected function to throw an error', null, 'Error');
    }
    if (expectedRegexOrType && expectedRegexOrType instanceof RegExp) {
      if (!expectedRegexOrType.test(caughtError.message)) {
        throw new AssertionError(
          `Expected error message to match ${expectedRegexOrType}, got "${caughtError.message}"`,
          caughtError.message,
          expectedRegexOrType.toString()
        );
      }
    }
  }
};

export class TestSuite {
  constructor(name, description = '') {
    this.name = name;
    this.description = description;
    this.tests = [];
  }

  add(name, testFn, metadata = {}) {
    this.tests.push({
      name,
      testFn,
      metadata,
      status: 'pending',
      error: null,
      durationMs: 0
    });
  }

  async run(filterPattern = null) {
    const results = [];
    for (const test of this.tests) {
      if (filterPattern && !test.name.toLowerCase().includes(filterPattern.toLowerCase())) {
        continue;
      }
      const startTime = performance.now();
      try {
        await test.testFn();
        test.status = 'passed';
        test.durationMs = Math.round(performance.now() - startTime);
      } catch (err) {
        test.status = 'failed';
        test.error = err;
        test.durationMs = Math.round(performance.now() - startTime);
      }
      results.push(test);
    }
    return results;
  }
}
