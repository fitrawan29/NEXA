import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('========================================================================');
console.log(' REVIEWER ROUND 2 DEEP ADVERSARIAL VERIFICATION SUITE');
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
// 1. Config Sanitization Deep Stress (Quotes, Whitespaces, Slashes, Falsy Values)
// -----------------------------------------------------------------------------
console.log('[PROBE 1: Env Var Sanitization Edge Cases]');
const configContent = fs.readFileSync(path.join(projectRoot, 'src', 'config.js'), 'utf8');

test('1.1 - config.js strips outer quotes and trailing slashes from VITE_SUPABASE_URL', () => {
  assert.ok(configContent.includes("replace(/^[\"']|[\"']$/g, '')"), 'Must strip surrounding quotes from env vars');
  assert.ok(configContent.includes("replace(/\\/+$/, '')"), 'Must strip trailing slashes');
});

test('1.2 - Sanitizer handles complex dirty inputs correctly', () => {
  const sanitizeUrl = (raw) => raw ? String(raw).trim().replace(/^["']|["']$/g, '').trim().replace(/\/+$/, '') : '';
  const sanitizeKey = (raw) => raw ? String(raw).trim().replace(/^["']|["']$/g, '').trim() : '';

  assert.strictEqual(sanitizeUrl('"https://my-proj.supabase.co/"'), 'https://my-proj.supabase.co');
  assert.strictEqual(sanitizeUrl("'https://my-proj.supabase.co///'"), 'https://my-proj.supabase.co');
  assert.strictEqual(sanitizeUrl('  "https://my-proj.supabase.co/  "  '), 'https://my-proj.supabase.co');
  assert.strictEqual(sanitizeKey(' "eyJhbGciOiJIUzI1NiIn..." '), 'eyJhbGciOiJIUzI1NiIn...');
  assert.strictEqual(sanitizeKey("'eyJhbGciOiJIUzI1NiIn...'"), 'eyJhbGciOiJIUzI1NiIn...');
  assert.strictEqual(sanitizeUrl(null), '');
  assert.strictEqual(sanitizeUrl(undefined), '');
});

// -----------------------------------------------------------------------------
// 2. Session Integrity Deep Stress (Pseudo-Sessions, Incomplete Objects)
// -----------------------------------------------------------------------------
console.log('\n[PROBE 2: Session Restoration & Role Guard Stress]');
const appContent = fs.readFileSync(path.join(projectRoot, 'src', 'App.jsx'), 'utf8');

test('2.1 - App.jsx checks user identifier (id_user, username, etc.) on session restore', () => {
  assert.match(appContent, /hasIdentifier\s*=\s*parsed\s*&&\s*\(parsed\.id_user\s*\|\|\s*parsed\.username/,
    'Must ensure session object contains a user identifier in addition to role');
});

test('2.2 - Incomplete session object without identity is purged', () => {
  const validRoles = ['super_admin', 'admin', 'guru', 'siswa'];
  const validateSession = (jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      const hasIdentifier = parsed && (parsed.id_user || parsed.username || parsed.id_siswa || parsed.id || parsed.nisn || parsed.nip || parsed.nama);
      if (parsed && typeof parsed === 'object' && validRoles.includes(parsed.role) && hasIdentifier) {
        return parsed;
      }
    } catch {}
    return null;
  };

  // Valid sessions
  assert.ok(validateSession('{"role":"siswa","id_user":"U-123","username":"budi"}'));
  assert.ok(validateSession('{"role":"guru","nip":"19850101","nama":"Pak Guru"}'));
  assert.ok(validateSession('{"role":"admin","username":"admin_sekolah"}'));

  // Invalid / pseudo-sessions
  assert.strictEqual(validateSession('{"role":"siswa"}'), null); // No identifier!
  assert.strictEqual(validateSession('{"role":"admin"}'), null); // No identifier!
  assert.strictEqual(validateSession('{"id_user":"U-123"}'), null); // No role!
  assert.strictEqual(validateSession('{"role":"hacker","id_user":"1"}'), null); // Invalid role!
  assert.strictEqual(validateSession('[]'), null); // Array!
  assert.strictEqual(validateSession('""'), null); // String!
});

// -----------------------------------------------------------------------------
// 3. Exam Answer Sanitization & Object Payload Support
// -----------------------------------------------------------------------------
console.log('\n[PROBE 3: Submit Answer Serialization & Payload Support]');
const apiContent = fs.readFileSync(path.join(projectRoot, 'src', 'api.js'), 'utf8');

test('3.1 - api.js submit_ujian handles both array and object payloads for jawaban', () => {
  assert.match(apiContent, /Array\.isArray\(payload\.jawaban\)[\s\S]*?else if \(payload\.jawaban && typeof payload\.jawaban === 'object'\)/,
    'Must support both array [{id_soal, jawaban}] and object {[id_soal]: jawaban}');
});

test('3.2 - api.js submit_ujian avoids JSON.stringify(null) returning "null"', () => {
  assert.match(apiContent, /let stringJawaban = \(jwb !== null && typeof jwb === 'object'\) \? JSON\.stringify\(jwb\) : String\(jwb \?\? ''\);/,
    'Must safely handle null answers to avoid literal "null" string in database');
});

test('3.3 - stringJawaban calculation handles all answer types cleanly', () => {
  const calcString = (jwb) => (jwb !== null && typeof jwb === 'object') ? JSON.stringify(jwb) : String(jwb ?? '');

  assert.strictEqual(calcString(null), '');
  assert.strictEqual(calcString(undefined), '');
  assert.strictEqual(calcString('A'), 'A');
  assert.strictEqual(calcString(''), '');
  assert.strictEqual(calcString(['A', 'C']), '["A","C"]');
  assert.strictEqual(calcString({ P1: 'R1' }), '{"P1":"R1"}');
  assert.strictEqual(calcString(0), '0');
});

test('3.4 - api.js submit_ujian records rpc failure when rpcRes indicates error/failure', () => {
  assert.match(apiContent, /else if \(rpcRes && \(rpcRes\.error \|\| rpcRes\.success === false\)\)/,
    'Must capture error payload from RPC return object');
});

// -----------------------------------------------------------------------------
// 4. PostgreSQL DDL Security & Parameter Sanitization
// -----------------------------------------------------------------------------
console.log('\n[PROBE 4: PostgreSQL Security Hardening]');
const atomicSql = fs.readFileSync(path.join(projectRoot, 'database_backups', 'submit_ujian_atomic.sql'), 'utf8');
const migrationSql = fs.readFileSync(path.join(projectRoot, 'database_backups', 'migration_keandalan_ujian.sql'), 'utf8');
const docSql = fs.readFileSync(path.join(projectRoot, 'PANDUAN_DEPLOYMENT_MULTI_INSTANCE.md'), 'utf8');

test('4.1 - submit_ujian_atomic.sql includes SET search_path = public, pg_temp', () => {
  assert.match(atomicSql, /SECURITY DEFINER\s+SET search_path = public, pg_temp/i,
    'submit_ujian_atomic must specify secure search_path for SECURITY DEFINER');
});

test('4.2 - migration_keandalan_ujian.sql includes SET search_path = public, pg_temp', () => {
  assert.match(migrationSql, /SECURITY DEFINER\s+SET search_path = public, pg_temp/i,
    'migration_keandalan_ujian must specify secure search_path for SECURITY DEFINER');
});

test('4.3 - PANDUAN_DEPLOYMENT_MULTI_INSTANCE.md snippet includes SET search_path = public, pg_temp', () => {
  assert.match(docSql, /SECURITY DEFINER\s+SET search_path = public, pg_temp/i,
    'Documentation SQL snippet must include secure search_path');
});

test('4.4 - SQL scripts filter out "null" literal strings from jawaban_user', () => {
  assert.match(atomicSql, /COALESCE\(NULLIF\(elem->>'jawaban_user', 'null'\), ''\)/,
    'Atomic SQL must sanitize "null" strings');
  assert.match(migrationSql, /COALESCE\(NULLIF\(elem->>'jawaban_user', 'null'\), ''\)/,
    'Migration SQL must sanitize "null" strings');
  assert.match(docSql, /COALESCE\(NULLIF\(elem->>'jawaban_user', 'null'\), ''\)/,
    'Doc SQL snippet must sanitize "null" strings');
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n========================================================================');
console.log(`SUMMARY: ${passed} / ${total} tests passed (${failed} failed)`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
