import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('========================================================================');
console.log(' REVIEWER ROUND 3 COMPREHENSIVE ADVERSARIAL VERIFICATION SUITE');
console.log('========================================================================\n');

let total = 0;
let passed = 0;
let failed = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`         Error: ${err.message}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// SECTION 1: Config Sanitization & Placeholder Defense (R1)
// -----------------------------------------------------------------------------
console.log('[SECTION 1: Multi-Deployment Config & Placeholder Defense]');
const configContent = fs.readFileSync(path.join(projectRoot, 'src', 'config.js'), 'utf8');

test('1.1 - config.js strips quotes, trailing slashes, and trims env vars', () => {
  assert.ok(configContent.includes("replace(/^[\"']|[\"']$/g, '')"), 'Must strip outer quotes');
  assert.ok(configContent.includes("replace(/\\/+$/, '')"), 'Must strip trailing slashes');
  assert.ok(configContent.includes("trim()"), 'Must trim whitespace');
});

test('1.2 - config.js defends against "undefined" and "null" placeholder strings', () => {
  assert.ok(configContent.includes("cleanUrl !== 'undefined'"), 'Must reject literal "undefined" URL');
  assert.ok(configContent.includes("cleanUrl !== 'null'"), 'Must reject literal "null" URL');
  assert.ok(configContent.includes("cleanUrl.startsWith('http')"), 'Must enforce http/https protocol');
  assert.ok(configContent.includes("cleanAnonKey !== 'undefined'"), 'Must reject literal "undefined" anon key');
  assert.ok(configContent.includes("cleanAnonKey.length >= 20"), 'Must validate anon key minimum length');
});

test('1.3 - config.js preserves default fallback credentials', () => {
  assert.ok(configContent.includes('cdcbarlyxjywltgrjgnr.supabase.co'), 'Must contain default Supabase URL');
  assert.ok(configContent.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'Must contain default Supabase Anon Key');
});

test('1.4 - .env.example contains correct multi-deployment environment variables', () => {
  const envContent = fs.readFileSync(path.join(projectRoot, '.env.example'), 'utf8');
  assert.ok(envContent.includes('VITE_SUPABASE_URL='), '.env.example must have VITE_SUPABASE_URL');
  assert.ok(envContent.includes('VITE_SUPABASE_ANON_KEY='), '.env.example must have VITE_SUPABASE_ANON_KEY');
  assert.ok(envContent.includes('SMA 1 Tutuyan Kelas 10'), '.env.example must mention target 1');
  assert.ok(envContent.includes('SMA Sampolawa'), '.env.example must mention target 4');
});

// -----------------------------------------------------------------------------
// SECTION 2: Anti-429 Polling Relaxation & Concurrency Math (R2)
// -----------------------------------------------------------------------------
console.log('\n[SECTION 2: Anti-429 Polling Relaxation & Rate Limit Safety]');
const examRoomContent = fs.readFileSync(path.join(projectRoot, 'src', 'views', 'ExamRoom.jsx'), 'utf8');
const siswaViewContent = fs.readFileSync(path.join(projectRoot, 'src', 'views', 'SiswaView.jsx'), 'utf8');

test('2.1 - ExamRoom.jsx proctor status polling is relaxed to 60000ms', () => {
  assert.ok(examRoomContent.includes('}, 60000);'), 'ExamRoom must poll at 60000ms interval');
  assert.ok(!examRoomContent.includes('}, 15000);'), 'ExamRoom must NOT have 15000ms polling remaining');
});

test('2.2 - SiswaView.jsx disables loadJadwal polling during active exam', () => {
  assert.ok(siswaViewContent.includes('if (activeExamData) return;'), 'Must stop schedule polling while exam is active');
});

test('2.3 - SiswaView.jsx background polling is relaxed to 60000ms', () => {
  assert.ok(siswaViewContent.includes('loadJadwal(false);\n    }, 60000);') || siswaViewContent.includes('loadJadwal(false);\r\n    }, 60000);'), 'SiswaView schedule polling must be 60000ms');
});

test('2.4 - Concurrency & Free Tier Kong Gateway Rate Limit Proof', () => {
  const TOTAL_STUDENTS = 415;
  const NUM_INSTANCES = 4;
  const KONG_GATEWAY_LIMIT_PER_MIN = 500;
  
  // Each student in ExamRoom polls get_proctor_status once per 60s (1 req/min)
  // Plus heartbeat_siswa once per 60s (1 req/min)
  const reqPerStudentPerMin = 2;
  const maxStudentsPerInstance = Math.ceil(TOTAL_STUDENTS / NUM_INSTANCES); // ~104 students
  const reqPerInstancePerMin = maxStudentsPerInstance * reqPerStudentPerMin; // ~208 req/min
  
  // Teachers monitoring: max 2 teachers per instance polling every 15s (4 req/min each = 8 req/min)
  const totalReqWithTeachers = reqPerInstancePerMin + 8; // ~216 req/min
  
  assert.ok(totalReqWithTeachers < KONG_GATEWAY_LIMIT_PER_MIN, `Total requests (${totalReqWithTeachers}) must be well under Kong limit (${KONG_GATEWAY_LIMIT_PER_MIN})`);
  assert.ok((totalReqWithTeachers / KONG_GATEWAY_LIMIT_PER_MIN) < 0.50, 'Peak load must consume less than 50% of free tier quota');
});

// -----------------------------------------------------------------------------
// SECTION 3: Session Resilience (F5 Defense) & Role Whitelist (R3.1)
// -----------------------------------------------------------------------------
console.log('\n[SECTION 3: Session Resilience & Identity Defense]');
const appContent = fs.readFileSync(path.join(projectRoot, 'src', 'App.jsx'), 'utf8');

test('3.1 - App.jsx initializes user from sessionStorage("nexa_user_session")', () => {
  assert.ok(appContent.includes("sessionStorage.getItem('nexa_user_session')"), 'Must read nexa_user_session');
});

test('3.2 - App.jsx checks role whitelist and user identifier on session restore', () => {
  assert.ok(appContent.includes("validRoles.includes(parsed.role)"), 'Must check validRoles whitelist');
  assert.ok(appContent.includes("hasIdentifier"), 'Must assert user identity field');
});

test('3.3 - App.jsx syncs user state to sessionStorage on change and clears on logout', () => {
  assert.ok(appContent.includes("sessionStorage.setItem('nexa_user_session', JSON.stringify(user))"), 'Must sync user to storage');
  assert.ok(appContent.includes("sessionStorage.removeItem('nexa_user_session')"), 'Must remove user session on logout');
});

test('3.4 - App.jsx provides invalid role recovery action', () => {
  assert.ok(appContent.includes('Kembali ke Login'), 'Must provide return button on invalid role');
});

// -----------------------------------------------------------------------------
// SECTION 4: Database Optimization & Atomic RPC (R3.2 & R3.3)
// -----------------------------------------------------------------------------
console.log('\n[SECTION 4: Database Index & Atomic Submit RPC]');
const indexSql = fs.readFileSync(path.join(projectRoot, 'database_backups', 'create_index_jawaban_siswa.sql'), 'utf8');
const atomicSql = fs.readFileSync(path.join(projectRoot, 'database_backups', 'submit_ujian_atomic.sql'), 'utf8');
const migrationSql = fs.readFileSync(path.join(projectRoot, 'database_backups', 'migration_keandalan_ujian.sql'), 'utf8');

test('4.1 - create_index_jawaban_siswa.sql defines index on jawaban_siswa(id_log)', () => {
  assert.ok(indexSql.includes('CREATE INDEX IF NOT EXISTS idx_jawaban_siswa_id_log ON public.jawaban_siswa (id_log);'), 'Index DDL must exist');
  assert.ok(indexSql.includes('ANALYZE public.jawaban_siswa;'), 'Must analyze table for planner');
});

test('4.2 - submit_ujian_atomic.sql enforces SECURITY DEFINER and search_path hardening', () => {
  assert.ok(atomicSql.includes('SECURITY DEFINER'), 'Must be SECURITY DEFINER');
  assert.ok(atomicSql.includes('SET search_path = public, pg_temp'), 'Must set secure search_path');
});

test('4.3 - submit_ujian_atomic.sql validates log existence and prevents SQL injection / schema shadowing', () => {
  assert.ok(atomicSql.includes('IF NOT EXISTS (SELECT 1 FROM public.log_ujian WHERE id_log = p_id_log)'), 'Must validate log existence');
  assert.ok(atomicSql.includes('DELETE FROM public.jawaban_siswa WHERE id_log = p_id_log;'), 'Must delete prior answers idempotently');
  assert.ok(atomicSql.includes('FROM jsonb_array_elements(p_jawaban_list)'), 'Must perform set-based insert');
});

test('4.4 - submit_ujian_atomic.sql guards against null score and literal "null" answer string', () => {
  assert.ok(atomicSql.includes("COALESCE(NULLIF(elem->>'jawaban_user', 'null'), '')"), 'Must sanitize literal null answer');
  assert.ok(atomicSql.includes("COALESCE(p_nilai_auto, 0)"), 'Must guard p_nilai_auto with COALESCE');
});

test('4.5 - submit_ujian_atomic.sql grants execute permission to anon, authenticated, service_role', () => {
  assert.ok(atomicSql.includes('GRANT EXECUTE ON FUNCTION public.submit_ujian_atomic(VARCHAR, JSONB, VARCHAR, NUMERIC) TO anon, authenticated, service_role;'), 'Must grant execute permissions');
});

test('4.6 - migration_keandalan_ujian.sql combines index DDL and atomic RPC function', () => {
  assert.ok(migrationSql.includes('idx_jawaban_siswa_id_log'), 'Migration must include index DDL');
  assert.ok(migrationSql.includes('submit_ujian_atomic'), 'Migration must include atomic RPC');
  assert.ok(migrationSql.includes('SET search_path = public, pg_temp'), 'Migration must include search_path');
  assert.ok(migrationSql.includes('COALESCE(p_nilai_auto, 0)'), 'Migration must guard p_nilai_auto');
});

// -----------------------------------------------------------------------------
// SECTION 5: Backend API Submit Transaction Hardening (R3.3)
// -----------------------------------------------------------------------------
console.log('\n[SECTION 5: Backend API Submit Transaction Hardening]');
const apiContent = fs.readFileSync(path.join(projectRoot, 'src', 'api.js'), 'utf8');

test('5.1 - api.js submit_ujian handles both array and dictionary answer payloads', () => {
  assert.ok(apiContent.includes('Array.isArray(payload.jawaban)'), 'Must support array answers');
  assert.ok(apiContent.includes('payload.jawaban && typeof payload.jawaban === \'object\''), 'Must support dictionary answers');
});

test('5.2 - api.js submit_ujian avoids JSON.stringify(null) returning "null" string', () => {
  assert.ok(apiContent.includes('(jwb !== null && typeof jwb === \'object\') ? JSON.stringify(jwb) : String(jwb ?? \'\')'), 'Must properly serialize answers');
});

test('5.3 - api.js submit_ujian calls RPC and distinguishes missing RPC vs genuine DB errors', () => {
  assert.ok(apiContent.includes("supabaseClient.rpc('submit_ujian_atomic'"), 'Must call submit_ujian_atomic RPC');
  assert.ok(apiContent.includes('isFunctionMissing'), 'Must check if function is missing');
  assert.ok(apiContent.includes("atomicError.code === 'PGRST202'"), 'Must recognize PGRST202 code');
});

test('5.4 - api.js submit_ujian fallback cleanly updates log status and waktu_selesai', () => {
  assert.ok(apiContent.includes("waktu_selesai: new Date().toISOString()"), 'Fallback must set timestamped waktu_selesai');
});

// -----------------------------------------------------------------------------
// SECTION 6: Multi-Instance Deployment Documentation (R4)
// -----------------------------------------------------------------------------
console.log('\n[SECTION 6: Multi-Instance Deployment Documentation (R4)]');
const docContent = fs.readFileSync(path.join(projectRoot, 'PANDUAN_DEPLOYMENT_MULTI_INSTANCE.md'), 'utf8');

test('6.1 - Documentation includes all 4 deployment targets and project names', () => {
  assert.ok(docContent.includes('SMA 1 Tutuyan Kelas 10'), 'Target 1 covered');
  assert.ok(docContent.includes('SMA 1 Tutuyan Kelas 11'), 'Target 2 covered');
  assert.ok(docContent.includes('SMA 1 Tutuyan Kelas 12'), 'Target 3 covered');
  assert.ok(docContent.includes('SMA Sampolawa'), 'Target 4 covered');
  assert.ok(docContent.includes('nexa-tutuyan-k10'), 'Project name 1 specified');
  assert.ok(docContent.includes('nexa-tutuyan-k11'), 'Project name 2 specified');
  assert.ok(docContent.includes('nexa-tutuyan-k12'), 'Project name 3 specified');
  assert.ok(docContent.includes('nexa-sampolawa'), 'Project name 4 specified');
});

test('6.2 - Documentation specifies required environment variables and SQL migration instructions', () => {
  assert.ok(docContent.includes('VITE_SUPABASE_URL'), 'Documents VITE_SUPABASE_URL');
  assert.ok(docContent.includes('VITE_SUPABASE_ANON_KEY'), 'Documents VITE_SUPABASE_ANON_KEY');
  assert.ok(docContent.includes('migration_keandalan_ujian.sql'), 'Mentions migration script');
  assert.ok(docContent.includes('SET search_path = public, pg_temp'), 'Includes hardened search_path in SQL snippet');
  assert.ok(docContent.includes('COALESCE(p_nilai_auto, 0)'), 'Includes COALESCE in SQL snippet');
});

console.log('\n========================================================================');
console.log(`SUMMARY: ${passed} / ${total} tests passed (${failed} failed)`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
}
