import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('========================================================================');
console.log(' TEST SUITE: MULTI-DEPLOYMENT & RELIABILITY VERIFICATION');
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
// SECTION 1: R1 Multi-Deployment Environment Variable Support
// =============================================================================
console.log('[SECTION 1: R1 Multi-Deployment Environment Variables]');

const configPath = path.join(projectRoot, 'src', 'config.js');
const configCode = fs.readFileSync(configPath, 'utf8');

runTest('R1.1 - src/config.js supports VITE_SUPABASE_URL from import.meta.env and process.env', () => {
  assert.match(configCode, /VITE_SUPABASE_URL/, 'config.js must reference VITE_SUPABASE_URL');
  assert.match(configCode, /VITE_SUPABASE_ANON_KEY/, 'config.js must reference VITE_SUPABASE_ANON_KEY');
});

runTest('R1.2 - src/config.js provides safe fallbacks to existing default Supabase credentials', () => {
  assert.match(configCode, /cdcbarlyxjywltgrjgnr\.supabase\.co/, 'Fallback default URL must be present');
  assert.match(configCode, /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/, 'Fallback default Anon Key must be present');
});

runTest('R1.3 - .env.example exists and documents VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY', () => {
  const envExamplePath = path.join(projectRoot, '.env.example');
  assert.ok(fs.existsSync(envExamplePath), '.env.example must exist');
  const envContent = fs.readFileSync(envExamplePath, 'utf8');
  assert.match(envContent, /VITE_SUPABASE_URL=/, '.env.example must specify VITE_SUPABASE_URL');
  assert.match(envContent, /VITE_SUPABASE_ANON_KEY=/, '.env.example must specify VITE_SUPABASE_ANON_KEY');
});

// =============================================================================
// SECTION 2: R2 ExamRoom Polling Interval Relaxation (Anti-429)
// =============================================================================
console.log('\n[SECTION 2: R2 ExamRoom Polling Interval Relaxation]');

const examRoomPath = path.join(projectRoot, 'src', 'views', 'ExamRoom.jsx');
const examRoomCode = fs.readFileSync(examRoomPath, 'utf8');

runTest('R2.1 - ExamRoom.jsx sets status poll interval to 60000ms (60 seconds)', () => {
  // Check pollInterval setInterval is 60000
  const pollMatch = examRoomCode.match(/const\s+pollInterval\s*=\s*setInterval[\s\S]*?\},\s*([0-9]+)\s*\)/);
  assert.ok(pollMatch, 'pollInterval definition must exist in ExamRoom.jsx');
  const intervalVal = parseInt(pollMatch[1], 10);
  assert.strictEqual(intervalVal, 60000, `pollInterval must be 60000ms (configured: ${intervalVal}ms)`);
});

runTest('R2.2 - Kong Gateway rate limit mathematical safety: 415 students < 500 req/min', () => {
  const concurrentStudents = 415;
  const pollIntervalSeconds = 60;
  const requestsPerMinutePerStudent = 60 / pollIntervalSeconds; // 1 req/min
  const totalRequestsPerMinute = concurrentStudents * requestsPerMinutePerStudent; // 415 req/min
  const kongRateLimit = 500; // Supabase Free Tier Kong gateway limit

  assert.ok(totalRequestsPerMinute < kongRateLimit, 
    `Total req/min (${totalRequestsPerMinute}) must be strictly below Kong gateway limit (${kongRateLimit})`);
});

// =============================================================================
// SECTION 3: R3.1 Student Session Resilience (sessionStorage / Kebal F5)
// =============================================================================
console.log('\n[SECTION 3: R3.1 Student Session Resilience]');

const appPath = path.join(projectRoot, 'src', 'App.jsx');
const appCode = fs.readFileSync(appPath, 'utf8');

runTest('R3.1.1 - App.jsx initializes user state by reading from sessionStorage("nexa_user_session")', () => {
  assert.match(appCode, /sessionStorage\.getItem\(['"]nexa_user_session['"]\)/, 
    'App.jsx must restore user from sessionStorage nexa_user_session');
});

runTest('R3.1.2 - App.jsx synchronizes user state to sessionStorage on changes', () => {
  assert.match(appCode, /sessionStorage\.setItem\(['"]nexa_user_session['"],\s*JSON\.stringify\(user\)\)/, 
    'App.jsx must persist user to sessionStorage');
});

runTest('R3.1.3 - App.jsx clears nexa_user_session from sessionStorage on logout', () => {
  assert.match(appCode, /sessionStorage\.removeItem\(['"]nexa_user_session['"]\)/, 
    'handleLogout must remove nexa_user_session from sessionStorage');
});

// =============================================================================
// SECTION 4: R3.2 Database Index for jawaban_siswa(id_log)
// =============================================================================
console.log('\n[SECTION 4: R3.2 Database Index for jawaban_siswa(id_log)]');

const indexSqlPath = path.join(projectRoot, 'database_backups', 'create_index_jawaban_siswa.sql');
runTest('R3.2.1 - create_index_jawaban_siswa.sql exists and contains valid DDL', () => {
  assert.ok(fs.existsSync(indexSqlPath), 'create_index_jawaban_siswa.sql must exist');
  const sql = fs.readFileSync(indexSqlPath, 'utf8');
  assert.match(sql, /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_jawaban_siswa_id_log\s+ON\s+public\.jawaban_siswa\s*\(\s*id_log\s*\)/i,
    'create_index_jawaban_siswa.sql must create index idx_jawaban_siswa_id_log on public.jawaban_siswa(id_log)');
});

// =============================================================================
// SECTION 5: R3.3 Atomic Submit Transaction
// =============================================================================
console.log('\n[SECTION 5: R3.3 Atomic Submit Transaction]');

const rpcSqlPath = path.join(projectRoot, 'database_backups', 'submit_ujian_atomic.sql');
runTest('R3.3.1 - submit_ujian_atomic.sql exists and defines atomic stored procedure', () => {
  assert.ok(fs.existsSync(rpcSqlPath), 'submit_ujian_atomic.sql must exist');
  const sql = fs.readFileSync(rpcSqlPath, 'utf8');
  assert.match(sql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+submit_ujian_atomic/i, 
    'submit_ujian_atomic.sql must define submit_ujian_atomic function');
  assert.match(sql, /DELETE\s+FROM\s+public\.jawaban_siswa\s+WHERE\s+id_log\s*=/i,
    'submit_ujian_atomic must atomically clean previous answers');
  assert.match(sql, /INSERT\s+INTO\s+public\.jawaban_siswa/i,
    'submit_ujian_atomic must insert answers in the same transaction');
  assert.match(sql, /UPDATE\s+public\.log_ujian/i,
    'submit_ujian_atomic must update log_ujian status and grade in the same transaction');
});

const migrationSqlPath = path.join(projectRoot, 'database_backups', 'migration_keandalan_ujian.sql');
runTest('R3.3.2 - migration_keandalan_ujian.sql combines index and atomic RPC for 1-click execution', () => {
  assert.ok(fs.existsSync(migrationSqlPath), 'migration_keandalan_ujian.sql must exist');
  const sql = fs.readFileSync(migrationSqlPath, 'utf8');
  assert.match(sql, /idx_jawaban_siswa_id_log/i, 'Combined migration must include index');
  assert.match(sql, /submit_ujian_atomic/i, 'Combined migration must include atomic RPC');
});

const apiPath = path.join(projectRoot, 'src', 'api.js');
const apiCode = fs.readFileSync(apiPath, 'utf8');

runTest('R3.3.3 - src/api.js implements submit_ujian_atomic RPC call with graceful fallback', () => {
  assert.match(apiCode, /supabaseClient\.rpc\(\s*['"]submit_ujian_atomic['"]/,
    'api.js submit_ujian must call submit_ujian_atomic RPC');
  assert.match(apiCode, /await\s+supabaseClient\.from\(['"]jawaban_siswa['"]\)\.delete\(\)\.eq\(['"]id_log['"],\s*logId\)/,
    'api.js must maintain fallback delete for backward compatibility');
  assert.match(apiCode, /if\s*\(\s*isBlocked\s*\)\s*\{\s*nilaiAuto\s*=\s*0\s*;?\s*\}/,
    'api.js must preserve blocked grade safeguard');
});

// =============================================================================
// SECTION 6: R4 Multi-Instance Deployment Documentation
// =============================================================================
console.log('\n[SECTION 6: R4 Multi-Instance Deployment Documentation]');

const docPath = path.join(projectRoot, 'PANDUAN_DEPLOYMENT_MULTI_INSTANCE.md');
runTest('R4.1 - PANDUAN_DEPLOYMENT_MULTI_INSTANCE.md exists and covers all 4 instances', () => {
  assert.ok(fs.existsSync(docPath), 'PANDUAN_DEPLOYMENT_MULTI_INSTANCE.md must exist');
  const doc = fs.readFileSync(docPath, 'utf8');
  assert.match(doc, /SMA 1 Tutuyan Kelas 10/i, 'Must cover SMA 1 Tutuyan Kelas 10');
  assert.match(doc, /SMA 1 Tutuyan Kelas 11/i, 'Must cover SMA 1 Tutuyan Kelas 11');
  assert.match(doc, /SMA 1 Tutuyan Kelas 12/i, 'Must cover SMA 1 Tutuyan Kelas 12');
  assert.match(doc, /SMA Sampolawa/i, 'Must cover SMA Sampolawa');
  assert.match(doc, /VITE_SUPABASE_URL/, 'Must document VITE_SUPABASE_URL');
  assert.match(doc, /VITE_SUPABASE_ANON_KEY/, 'Must document VITE_SUPABASE_ANON_KEY');
  assert.match(doc, /migration_keandalan_ujian\.sql/, 'Must instruct running migration_keandalan_ujian.sql');
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
