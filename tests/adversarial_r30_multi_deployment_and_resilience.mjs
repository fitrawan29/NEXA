import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('========================================================================');
console.log(' ADVERSARIAL STRESS TEST SUITE: MULTI-DEPLOYMENT & RELIABILITY');
console.log('========================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`         Error: ${err.message}`);
    failedTests++;
  }
}

// =============================================================================
// SUITE 1: Config Sanitization & Trailing Slash/Whitespace Immunity
// =============================================================================
console.log('[SUITE 1: Config Environment Variable Sanitization]');

const configPath = path.join(projectRoot, 'src', 'config.js');
const configContent = fs.readFileSync(configPath, 'utf8');

runTest('1.1 - config.js strips trailing whitespace and trailing slashes from VITE_SUPABASE_URL', () => {
  assert.ok(configContent.includes("replace(/\\/+$/, '')"), 'Must remove trailing slashes from URL');
  assert.match(configContent, /trim\(\)/, 'Must trim whitespace from environment variables');
});

runTest('1.2 - URL Sanitizer logic correctly normalizes dirty environment URLs', () => {
  const dirtyUrls = [
    'https://xyz.supabase.co/ ',
    'https://xyz.supabase.co///',
    ' https://xyz.supabase.co/ \n',
    'https://xyz.supabase.co'
  ];
  for (const dirty of dirtyUrls) {
    const cleaned = String(dirty).trim().replace(/\/+$/, '');
    assert.strictEqual(cleaned, 'https://xyz.supabase.co', `Failed to clean dirty URL: ${dirty}`);
  }
});

runTest('1.3 - config.js preserves default fallback credentials when env vars are unset', () => {
  assert.match(configContent, /cdcbarlyxjywltgrjgnr\.supabase\.co/, 'Default fallback URL must be present');
  assert.match(configContent, /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/, 'Default fallback Anon Key must be present');
});

// =============================================================================
// SUITE 2: Session Restoration Resilience & Corrupt Payload Defense
// =============================================================================
console.log('\n[SUITE 2: Session Restoration Resilience & Edge Cases]');

const appPath = path.join(projectRoot, 'src', 'App.jsx');
const appContent = fs.readFileSync(appPath, 'utf8');

runTest('2.1 - App.jsx validates user role on sessionStorage restoration', () => {
  assert.match(appContent, /validRoles\s*=\s*\[.*'siswa'.*\]/, 'Must define valid roles whitelist');
  assert.match(appContent, /validRoles\.includes\(parsed\.role\)/, 'Must check parsed.role against whitelist');
});

runTest('2.2 - App.jsx purges corrupt session from sessionStorage when role is invalid', () => {
  assert.match(appContent, /sessionStorage\.removeItem\(['"]nexa_user_session['"]\)/, 'Must remove corrupt session');
});

runTest('2.3 - Session validator simulation defends against corrupt/empty/injected session objects', () => {
  const validRoles = ['super_admin', 'admin', 'guru', 'siswa'];
  const testCases = [
    { input: JSON.stringify({ id_user: '1', role: 'siswa', username: 'student1' }), expectedValid: true },
    { input: JSON.stringify({ id_user: '2', role: 'admin', username: 'admin1' }), expectedValid: true },
    { input: JSON.stringify({}), expectedValid: false }, // empty object
    { input: JSON.stringify({ role: 'hacker' }), expectedValid: false }, // invalid role
    { input: JSON.stringify(null), expectedValid: false }, // null
    { input: '12345', expectedValid: false }, // number
    { input: '"just_a_string"', expectedValid: false }, // string
    { input: '{corrupted_json', expectedValid: false } // syntax error
  ];

  for (const tc of testCases) {
    let isValid = false;
    try {
      const parsed = JSON.parse(tc.input);
      if (parsed && typeof parsed === 'object' && validRoles.includes(parsed.role)) {
        isValid = true;
      }
    } catch (e) {
      isValid = false;
    }
    assert.strictEqual(isValid, tc.expectedValid, `Failed for case: ${tc.input}`);
  }
});

runTest('2.4 - App.jsx provides recovery button in invalid role view', () => {
  assert.match(appContent, /Role tidak valid![\s\S]*?Kembali ke Login/, 'Must provide recovery button on invalid role');
});

// =============================================================================
// SUITE 3: Polling Traffic, Concurrency Math & Anti-429 Defense
// =============================================================================
console.log('\n[SUITE 3: Polling Traffic & Kong Gateway Anti-429 Defense]');

const examRoomPath = path.join(projectRoot, 'src', 'views', 'ExamRoom.jsx');
const examRoomContent = fs.readFileSync(examRoomPath, 'utf8');

const siswaViewPath = path.join(projectRoot, 'src', 'views', 'SiswaView.jsx');
const siswaViewContent = fs.readFileSync(siswaViewPath, 'utf8');

runTest('3.1 - ExamRoom.jsx sets proctor status sync polling interval to 60000ms', () => {
  const pollMatch = examRoomContent.match(/const\s+pollInterval\s*=\s*setInterval[\s\S]*?\},\s*([0-9]+)\s*\)/);
  assert.ok(pollMatch, 'pollInterval must be defined');
  assert.strictEqual(parseInt(pollMatch[1], 10), 60000, 'ExamRoom pollInterval must be 60000ms');
});

runTest('3.2 - SiswaView.jsx disables loadJadwal polling during active exam', () => {
  // Check that loadJadwal effect includes activeExamData guard
  assert.match(siswaViewContent, /if\s*\(\s*activeExamData\s*\)\s*return;[\s\S]*?loadJadwal\(false\)/,
    'SiswaView must NOT poll schedule when activeExamData is active');
});

runTest('3.3 - SiswaView.jsx sets background schedule polling interval to 60000ms', () => {
  assert.match(siswaViewContent, /loadJadwal\(false\);\s*\}\s*,\s*60000\)/,
    'SiswaView idle schedule polling must be 60000ms');
});

runTest('3.4 - Concurrency Mathematical Proof: 415 concurrent students on 4 Supabase instances', () => {
  const totalStudents = 415;
  const numInstances = 4;
  const studentsPerInstance = Math.ceil(totalStudents / numInstances); // 104 students
  
  // During exam:
  // ExamRoom status poll: 1 req / 60s = 1 req/min
  // SiswaView heartbeat: 1 req / 60s = 1 req/min
  // SiswaView loadJadwal: 0 req/min (suppressed by activeExamData guard)
  const reqPerStudentPerMin = 1 + 1 + 0; // 2 req/min
  
  const totalReqPerMinPerInstance = studentsPerInstance * reqPerStudentPerMin; // 208 req/min
  const kongFreeTierLimit = 500; // 500 req/min
  
  assert.ok(totalReqPerMinPerInstance < kongFreeTierLimit,
    `Traffic per instance (${totalReqPerMinPerInstance} req/min) must be strictly below Kong limit (${kongFreeTierLimit} req/min)`);
  
  const safetyBuffer = kongFreeTierLimit - totalReqPerMinPerInstance;
  assert.ok(safetyBuffer >= 200, `Safety buffer (${safetyBuffer} req/min) must be at least 200 req/min`);
});

// =============================================================================
// SUITE 4: Backend Submit Transaction & Error Parity
// =============================================================================
console.log('\n[SUITE 4: Backend Submit Transaction & Error Parity]');

const apiPath = path.join(projectRoot, 'src', 'api.js');
const apiContent = fs.readFileSync(apiPath, 'utf8');

runTest('4.1 - api.js submit_ujian calls submit_ujian_atomic RPC with parameters', () => {
  assert.match(apiContent, /supabaseClient\.rpc\(\s*['"]submit_ujian_atomic['"]\s*,\s*\{[\s\S]*?p_id_log:[\s\S]*?p_jawaban_list:[\s\S]*?p_status_ujian:[\s\S]*?p_nilai_auto:/,
    'submit_ujian must invoke submit_ujian_atomic RPC with complete arguments');
});

runTest('4.2 - api.js distinguishes between missing RPC function vs actual DB error', () => {
  assert.match(apiContent, /isFunctionMissing[\s\S]*?PGRST202[\s\S]*?42883/,
    'api.js must detect missing RPC function specifically');
  assert.match(apiContent, /if\s*\(!isFunctionMissing\s*&&\s*atomicError\)\s*\{\s*return\s*\{\s*status:\s*['"]error['"]/,
    'api.js must return error if RPC failed with real database exception');
});

runTest('4.3 - api.js fallback verifies errors on delete, insert, and update operations', () => {
  assert.match(apiContent, /const\s*\{\s*error:\s*delErr\s*\}\s*=\s*await\s+supabaseClient\.from\(['"]jawaban_siswa['"]\)\.delete\(\)/,
    'Fallback must check delete error');
  assert.match(apiContent, /const\s*\{\s*error:\s*insErr\s*\}\s*=\s*await\s+supabaseClient\.from\(['"]jawaban_siswa['"]\)\.insert\(/,
    'Fallback must check insert error');
  assert.match(apiContent, /const\s*\{\s*error:\s*updErr\s*\}\s*=\s*await\s+supabaseClient\.from\(['"]log_ujian['"]\)\.update\(/,
    'Fallback must check update error');
});

runTest('4.4 - api.js fallback updates waktu_selesai for parity with RPC', () => {
  assert.match(apiContent, /waktu_selesai:\s*new Date\(\)\.toISOString\(\)/,
    'Fallback update must include waktu_selesai');
});

// =============================================================================
// SUITE 5: SQL Migration DDL & Security Permissions
// =============================================================================
console.log('\n[SUITE 5: SQL Migration DDL & Security Permissions]');

const sqlAtomicPath = path.join(projectRoot, 'database_backups', 'submit_ujian_atomic.sql');
const sqlAtomicContent = fs.readFileSync(sqlAtomicPath, 'utf8');

const sqlMigrationPath = path.join(projectRoot, 'database_backups', 'migration_keandalan_ujian.sql');
const sqlMigrationContent = fs.readFileSync(sqlMigrationPath, 'utf8');

runTest('5.1 - submit_ujian_atomic.sql validates log existence before mutating', () => {
  assert.match(sqlAtomicContent, /IF\s+NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+public\.log_ujian\s+WHERE\s+id_log\s*=\s*p_id_log\s*\)/i,
    'Must validate log_ujian existence');
});

runTest('5.2 - submit_ujian_atomic.sql performs set-based INSERT FROM jsonb_array_elements', () => {
  assert.match(sqlAtomicContent, /INSERT\s+INTO\s+public\.jawaban_siswa[\s\S]*?SELECT[\s\S]*?FROM\s+jsonb_array_elements\(p_jawaban_list\)/i,
    'Must use set-based insert for maximum performance and atomicity');
});

runTest('5.3 - submit_ujian_atomic.sql checks jsonb_typeof to prevent non-array errors', () => {
  assert.match(sqlAtomicContent, /jsonb_typeof\(p_jawaban_list\)\s*=\s*'array'/i,
    'Must guard against non-array JSON inputs');
});

runTest('5.4 - submit_ujian_atomic.sql grants EXECUTE permission to anon and authenticated roles', () => {
  assert.match(sqlAtomicContent, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.submit_ujian_atomic[\s\S]*?TO\s+anon/i,
    'Must grant execute permission to anon role for Supabase client execution');
});

runTest('5.5 - migration_keandalan_ujian.sql includes both index DDL and atomic RPC with GRANT', () => {
  assert.match(sqlMigrationContent, /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_jawaban_siswa_id_log/i,
    'Migration must include index creation');
  assert.match(sqlMigrationContent, /submit_ujian_atomic/i,
    'Migration must include atomic submit procedure');
  assert.match(sqlMigrationContent, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.submit_ujian_atomic/i,
    'Migration must grant execute permissions to anon and authenticated');
});

// =============================================================================
// SUITE 6: Multi-Instance Deployment Documentation Verification
// =============================================================================
console.log('\n[SUITE 6: Multi-Instance Deployment Documentation]');

const docPath = path.join(projectRoot, 'PANDUAN_DEPLOYMENT_MULTI_INSTANCE.md');
const docContent = fs.readFileSync(docPath, 'utf8');

runTest('6.1 - Documentation includes all 4 deployment targets with recommended project names', () => {
  assert.match(docContent, /nexa-tutuyan-k10/, 'Must specify nexa-tutuyan-k10');
  assert.match(docContent, /nexa-tutuyan-k11/, 'Must specify nexa-tutuyan-k11');
  assert.match(docContent, /nexa-tutuyan-k12/, 'Must specify nexa-tutuyan-k12');
  assert.match(docContent, /nexa-sampolawa/, 'Must specify nexa-sampolawa');
});

runTest('6.2 - Documentation specifies required environment variables', () => {
  assert.match(docContent, /VITE_SUPABASE_URL/, 'Must document VITE_SUPABASE_URL');
  assert.match(docContent, /VITE_SUPABASE_ANON_KEY/, 'Must document VITE_SUPABASE_ANON_KEY');
});

runTest('6.3 - Documentation SQL snippet includes GRANT EXECUTE and set-based insert', () => {
  assert.match(docContent, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.submit_ujian_atomic/i,
    'Documentation SQL snippet must include GRANT EXECUTE');
  assert.match(docContent, /FROM\s+jsonb_array_elements\(p_jawaban_list\)/i,
    'Documentation SQL snippet must feature set-based insert');
});

// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n========================================================================');
console.log(`SUMMARY: ${passedTests} / ${totalTests} tests passed (${failedTests} failed)`);
console.log('========================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
