#!/usr/bin/env node
/**
 * CBT NEXA Comprehensive E2E Testing Suite Runner
 * Orchestrates Tiers 1-4 and Acceptance Criteria Codebase Audits.
 *
 * Usage:
 *   node tests/e2e_test_suite.mjs
 *   node tests/e2e_test_suite.mjs --tier=1
 *   node tests/e2e_test_suite.mjs --tier=2
 *   node tests/e2e_test_suite.mjs --tier=3
 *   node tests/e2e_test_suite.mjs --tier=4
 *   node tests/e2e_test_suite.mjs --tier=audits
 *   node tests/e2e_test_suite.mjs --fast
 *   node tests/e2e_test_suite.mjs --allow-failures
 *   node tests/e2e_test_suite.mjs --json
 */

import { createTier1Suite } from './tier1_features.mjs';
import { createTier2Suite } from './tier2_boundaries.mjs';
import { createTier3Suite } from './tier3_combinations.mjs';
import { createTier4Suite } from './tier4_scenarios.mjs';
import { createAuditsSuite } from './codebase_audits.mjs';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  tier: 'all',
  filter: null,
  fast: false,
  allowFailures: false,
  json: false
};

args.forEach(arg => {
  if (arg.startsWith('--tier=')) options.tier = arg.split('=')[1].toLowerCase();
  else if (arg.startsWith('--filter=')) options.filter = arg.split('=')[1];
  else if (arg === '--fast') options.fast = true;
  else if (arg === '--allow-failures') options.allowFailures = true;
  else if (arg === '--json') options.json = true;
});

// ANSI Colors for console output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bgGreen: '\x1b[42m\x1b[30m',
  bgRed: '\x1b[41m\x1b[37m'
};

async function runTestSuite() {
  const allSuites = [];

  if (options.tier === 'all' || options.tier === '1') allSuites.push(createTier1Suite());
  if (options.tier === 'all' || options.tier === '2') allSuites.push(createTier2Suite());
  if (options.tier === 'all' || options.tier === '3') allSuites.push(createTier3Suite());
  if (options.tier === 'all' || options.tier === '4') allSuites.push(createTier4Suite());
  if (options.tier === 'all' || options.tier === 'audits') allSuites.push(createAuditsSuite({ skipBuild: options.fast }));

  if (!options.json) {
    console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}   CBT NEXA — E2E TEST SUITE RUNNER (Tiers 1-4 & Acceptance Audits)   ${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
    console.log(`${colors.gray}Target Mode: ${options.tier.toUpperCase()} | Fast (skip build): ${options.fast} | Filter: ${options.filter || 'None'}${colors.reset}\n`);
  }

  const overallStartTime = performance.now();
  let totalTestsCount = 0;
  let passedTestsCount = 0;
  let failedTestsCount = 0;
  const suiteResults = [];
  const discoveredDefects = [];

  for (const suite of allSuites) {
    if (!options.json) {
      console.log(`${colors.bold}${colors.blue}▶ ${suite.name}${colors.reset} ${colors.gray}(${suite.description})${colors.reset}`);
    }

    const testResults = await suite.run(options.filter);
    const suitePassed = testResults.filter(t => t.status === 'passed').length;
    const suiteFailed = testResults.filter(t => t.status === 'failed').length;

    totalTestsCount += testResults.length;
    passedTestsCount += suitePassed;
    failedTestsCount += suiteFailed;

    for (const res of testResults) {
      if (!options.json) {
        if (res.status === 'passed') {
          console.log(`  ${colors.green}✔ PASS${colors.reset} ${res.name} ${colors.gray}(${res.durationMs}ms)${colors.reset}`);
        } else {
          console.log(`  ${colors.red}✖ FAIL${colors.reset} ${res.name} ${colors.gray}(${res.durationMs}ms)${colors.reset}`);
          console.log(`    ${colors.yellow}Error: ${res.error.message.split('\n')[0]}${colors.reset}`);
        }
      }

      if (res.status === 'failed') {
        discoveredDefects.push({
          suite: suite.name,
          test: res.name,
          error: res.error.message
        });
      }
    }

    if (!options.json) console.log('');
    suiteResults.push({
      name: suite.name,
      total: testResults.length,
      passed: suitePassed,
      failed: suiteFailed,
      tests: testResults
    });
  }

  const overallDuration = Math.round(performance.now() - overallStartTime);
  const passRate = totalTestsCount > 0 ? Math.round((passedTestsCount / totalTestsCount) * 100) : 0;

  if (options.json) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      durationMs: overallDuration,
      summary: {
        total: totalTestsCount,
        passed: passedTestsCount,
        failed: failedTestsCount,
        passRatePercent: passRate
      },
      discoveredDefects,
      suites: suiteResults
    }, null, 2));
    if (failedTestsCount > 0 && !options.allowFailures) process.exit(1);
    process.exit(0);
  }

  // Terminal Summary Dashboard
  console.log(`${colors.bold}${colors.cyan}----------------------------------------------------------------------${colors.reset}`);
  console.log(`${colors.bold}EXECUTION SUMMARY${colors.reset}`);
  console.log(`  Total Test Cases : ${colors.bold}${totalTestsCount}${colors.reset}`);
  console.log(`  Passed           : ${colors.green}${colors.bold}${passedTestsCount}${colors.reset}`);
  console.log(`  Failed / Pending : ${failedTestsCount > 0 ? colors.red : colors.green}${colors.bold}${failedTestsCount}${colors.reset}`);
  console.log(`  Pass Rate        : ${colors.bold}${passRate}%${colors.reset}`);
  console.log(`  Total Duration   : ${colors.bold}${overallDuration}ms${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}----------------------------------------------------------------------${colors.reset}`);

  // Discovered Implementation Bugs & Escalation Section
  if (discoveredDefects.length > 0) {
    console.log(`\n${colors.bold}${colors.red}🚨 IMPLEMENTATION DEFECTS DISCOVERED (${discoveredDefects.length}) — ESCALATE TO MILESTONES:${colors.reset}`);
    discoveredDefects.forEach((def, i) => {
      console.log(`\n  ${colors.bold}[Defect #${i + 1}]${colors.reset} ${colors.yellow}${def.test}${colors.reset}`);
      console.log(`  ${colors.gray}Suite:${colors.reset} ${def.suite}`);
      const errLines = def.error.split('\n');
      console.log(`  ${colors.gray}Detail:${colors.reset} ${colors.red}${errLines[0]}${colors.reset}`);
      if (errLines.length > 1) {
        errLines.slice(1, 6).forEach(l => console.log(`    ${colors.gray}${l}${colors.reset}`));
      }
    });
    console.log(`\n${colors.yellow}👉 Implementation agents (M1 Design System, M2 Student Exam, M3 Admin/Guru Dashboards) should address these findings.${colors.reset}\n`);
  } else {
    console.log(`\n${colors.bgGreen}${colors.bold} ALL TESTS & AUDITS PASSED CLEANLY! ${colors.reset}\n`);
  }

  if (failedTestsCount > 0 && !options.allowFailures) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
