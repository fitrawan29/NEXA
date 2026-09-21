#!/usr/bin/env node
/**
 * CBT NEXA — Challenger M5 Repetition & Concurrency Stress Test Harness
 * 
 * Verifies:
 * 1. Zero flakiness across sequential repetitions (5 iterations).
 * 2. Concurrency resistance: parallel executions running simultaneously against Supabase.
 * 3. Measures latency, exit codes, and stdout/stderr anomalies.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const candidateRoots = [
  path.resolve(__dirname, '../kode NEXA'),
  path.resolve(__dirname, '..'),
  path.resolve(process.cwd(), 'kode NEXA'),
  process.cwd()
];
const projectRoot = candidateRoots.find(p => fs.existsSync(path.resolve(p, 'src/api.js')));
if (!projectRoot) {
  console.error('FATAL: Could not locate project root containing src/api.js');
  process.exit(1);
}
const targetScript = fs.existsSync(path.resolve(__dirname, 'e2e_full_flow_all_roles.mjs'))
  ? path.resolve(__dirname, 'e2e_full_flow_all_roles.mjs')
  : path.resolve(projectRoot, 'tests/e2e_full_flow_all_roles.mjs');

function runInstance(id) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const child = spawn(process.execPath, [targetScript], {
      cwd: projectRoot,
      env: { ...process.env, TEST_INSTANCE_ID: String(id) }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      const passed = code === 0 && stdout.includes('100% PASS RATE');
      resolve({
        id,
        code,
        passed,
        duration,
        stdout,
        stderr
      });
    });
  });
}

async function main() {
  console.log('==============================================================================');
  console.log('   CHALLENGER M5: REPETITION & CONCURRENCY ADVERSARIAL STRESS TEST           ');
  console.log('==============================================================================\n');

  // PHASE 1: Sequential Repetition (5 Iterations)
  console.log('▶ PHASE 1: Running 5 Sequential Iterations of Master E2E Suite...');
  const seqResults = [];
  for (let i = 1; i <= 5; i++) {
    process.stdout.write(`  [Iteration ${i}/5] Running... `);
    const res = await runInstance(`seq-${i}`);
    if (res.passed) {
      console.log(`\x1b[32mPASSED\x1b[0m (${(res.duration / 1000).toFixed(2)}s)`);
    } else {
      console.log(`\x1b[31mFAILED\x1b[0m (Exit code: ${res.code}, ${(res.duration / 1000).toFixed(2)}s)`);
      console.error(res.stderr || res.stdout.slice(-500));
    }
    seqResults.push(res);
  }

  const allSeqPassed = seqResults.every(r => r.passed);
  console.log(`\nPhase 1 Result: ${seqResults.filter(r => r.passed).length}/5 iterations passed. (Flakiness: ${allSeqPassed ? '0%' : 'DETECTED'})\n`);

  // PHASE 2: Parallel Concurrent Execution (3 Concurrent Processes)
  console.log('▶ PHASE 2: Running 3 Concurrent Parallel Instances of Master E2E Suite...');
  const t0 = Date.now();
  const concurrentPromises = [
    runInstance('concurrent-1'),
    runInstance('concurrent-2'),
    runInstance('concurrent-3')
  ];

  const concurrentResults = await Promise.all(concurrentPromises);
  const totalConcurrentTime = Date.now() - t0;

  concurrentResults.forEach(r => {
    if (r.passed) {
      console.log(`  [Instance ${r.id}] \x1b[32mPASSED\x1b[0m in ${(r.duration / 1000).toFixed(2)}s`);
    } else {
      console.log(`  [Instance ${r.id}] \x1b[31mFAILED\x1b[0m in ${(r.duration / 1000).toFixed(2)}s (Exit code: ${r.code})`);
      console.error(r.stderr || r.stdout.slice(-500));
    }
  });

  const allConcurrentPassed = concurrentResults.every(r => r.passed);
  console.log(`\nPhase 2 Result: ${concurrentResults.filter(r => r.passed).length}/3 concurrent runs passed in ${(totalConcurrentTime / 1000).toFixed(2)}s total.`);

  // SUMMARY
  console.log('\n==============================================================================');
  if (allSeqPassed && allConcurrentPassed) {
    console.log('\x1b[32m✔ [STRESS VERIFICATION PASSED] Master E2E Suite shows ZERO race conditions and 100% stability under repetition and concurrency.\x1b[0m');
    process.exit(0);
  } else {
    console.error('\x1b[31m✖ [STRESS VERIFICATION FAILED] Detected flakiness or concurrency failure.\x1b[0m');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error in stress test:', err);
  process.exit(1);
});
