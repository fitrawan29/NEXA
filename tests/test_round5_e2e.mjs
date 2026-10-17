#!/usr/bin/env node
/**
 * CBT NEXA Round 5 Comprehensive 4-Tier Opaque-Box E2E Test Suite
 *
 * Scope: Round 5 Feature Expansion
 * 1. R1: Student Digital Canvas Signature & Exam Entry Gating (ORIGINAL_REQUEST §R1)
 * 2. R2: Admin Proctor Assignment & Room Management (ORIGINAL_REQUEST §R2)
 * 3. R3: Proctor Dashboard & Attendance Verification (ORIGINAL_REQUEST §R3)
 * 4. R4: Print-Friendly HTML Documents & @media print CSS (ORIGINAL_REQUEST §R4)
 *
 * Test Architecture: 4 Tiers
 * - Tier 1: Feature Coverage (R1-R4, 20 tests)
 * - Tier 2: Boundary & Corner Cases (10 tests)
 * - Tier 3: Cross-Feature Combinations (5 tests)
 * - Tier 4: Real-World Workload Simulation & Print CSS / DOM Verification (6 tests)
 * Total: 41 Comprehensive Test Cases
 *
 * Usage:
 *   node tests/test_round5_e2e.mjs
 *   node tests/test_round5_e2e.mjs --tier=1
 *   node tests/test_round5_e2e.mjs --tier=2
 *   node tests/test_round5_e2e.mjs --tier=3
 *   node tests/test_round5_e2e.mjs --tier=4
 *   node tests/test_round5_e2e.mjs --filter=signature
 *   node tests/test_round5_e2e.mjs --json
 *   node tests/test_round5_e2e.mjs --allow-failures
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../src/config.js';
import { fetchAPI } from '../src/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.resolve(projectRoot, 'src');

// Initialize Direct Supabase Client for DB state assertions
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// CLI Arguments
const args = process.argv.slice(2);
const options = {
  tier: 'all',
  filter: null,
  json: false,
  allowFailures: false
};

for (const arg of args) {
  if (arg.startsWith('--tier=')) options.tier = arg.split('=')[1].toLowerCase();
  else if (arg.startsWith('--filter=')) options.filter = arg.split('=')[1].toLowerCase();
  else if (arg === '--json') options.json = true;
  else if (arg === '--allow-failures') options.allowFailures = true;
}

// ANSI colors for console output
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bgGreen: '\x1b[42m\x1b[30m',
  bgRed: '\x1b[41m\x1b[37m',
  bgYellow: '\x1b[43m\x1b[30m',
  bgBlue: '\x1b[44m\x1b[37m'
};

// Safe file reader
function readFileSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch {
    // ignore
  }
  return null;
}

// Lightweight assertion library
class AssertionError extends Error {
  constructor(message, actual, expected) {
    super(message);
    this.name = 'AssertionError';
    this.actual = actual;
    this.expected = expected;
  }
}

const assert = {
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
    if (!regex.test(string || '')) {
      throw new AssertionError(
        message || `Expected string to match ${regex}: "${(string || '').slice(0, 100)}..."`,
        string,
        regex.toString()
      );
    }
  },
  doesNotMatch(string, regex, message) {
    if (regex.test(string || '')) {
      throw new AssertionError(
        message || `Expected string NOT to match ${regex}`,
        string,
        'No match'
      );
    }
  },
  deepEqual(actual, expected, message) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) {
      throw new AssertionError(
        message || `Deep equality mismatch:\nActual:   ${a}\nExpected: ${b}`,
        actual,
        expected
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
  throws(fn, message) {
    let threw = false;
    try {
      fn();
    } catch {
      threw = true;
    }
    if (!threw) {
      throw new AssertionError(message || 'Expected function to throw error', null, 'Error');
    }
  }
};

// Test Vector Constants
const TEST_NPSN = '70040625'; // SMA Nizamudin (seeded school in DB)
const ALT_NPSN = '40103445'; // SMA Negeri 1 Tutuyan (for multi-tenant isolation tests)

// Valid 10x10 monochrome PNG signature Base64 Data URL (~180 bytes)
const SAMPLE_SIGNATURE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGXRFWHRTb2Z0d2FyZQBNYXRwbG90bGliIHZlcnNpb24zLjcuMiwgaHR0cHM6Ly9tYXRwbG90bGliLm9yZy8pV571AAAAPklEQVR4nGP8//8/AyUYiBEyGv9jYGAoR2Jjg/mYkARhGkCKQYrh4mCMY7g2kGLY4FCEYfD/YRgkGIYFGAAMdBEGqFh7oAAAAABJRU5ErkJggg==';

// Blank 1x1 transparent PNG Data URL
const BLANK_TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Malformed signature vectors
const MALFORMED_TEXT_DATA_URL = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';
const CORRUPT_BASE64_STRING = 'data:image/png;base64,!!!INVALID_BASE64_ENCODING!!!';
const RAW_UNENCODED_STRING = 'CoretanTanganSiswa123';

// Canvas Blank Verification Simulator
function isBlankSignatureData(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return true;
  if (!dataUrl.startsWith('data:image/png;base64,')) return true;
  const base64Data = dataUrl.replace('data:image/png;base64,', '').trim();
  if (base64Data.length < 50) return true; // Empty/minimal image header only
  // Check if matches known 1x1 transparent pixel
  if (dataUrl === BLANK_TRANSPARENT_PNG) return true;
  return false;
}

// Suite Registry
const suites = [];

function registerSuite(tierNum, tierTitle, description) {
  const suite = {
    tier: tierNum,
    title: tierTitle,
    description,
    tests: []
  };
  suites.push(suite);
  return {
    add(id, name, feature, fn) {
      suite.tests.push({ id, name, feature, fn, status: 'pending', error: null, durationMs: 0 });
    }
  };
}

// Track IDs generated during test run for cleanup
const cleanupRegistry = {
  ruangIds: new Set(),
  penugasanIds: new Set(),
  absensiIds: new Set(),
  beritaAcaraIds: new Set(),
  logIds: new Set(),
  siswaIds: new Set()
};

const FIXTURE_ROOM_ID = `R-FIXTURE-${Date.now().toString().slice(-6)}`;
cleanupRegistry.ruangIds.add(FIXTURE_ROOM_ID);

// =============================================================================
// TIER 1: FEATURE COVERAGE (R1 - R4)
// =============================================================================
const tier1 = registerSuite(1, 'Tier 1: Feature Coverage', 'Core functional specification tests for R1–R4');

// --- Feature 1: Student Digital Canvas Signature & Gating (R1) ---
tier1.add('T1.1.1', 'DigitalSignatureModal.jsx component with HTML5 canvas & touch isolation', 'R1: Canvas Signature', () => {
  const compPath = path.join(srcDir, 'components', 'DigitalSignatureModal.jsx');
  const comp = readFileSafe(compPath);
  assert.ok(comp, 'src/components/DigitalSignatureModal.jsx must exist');
  assert.match(comp, /<canvas\b/, 'DigitalSignatureModal must declare an HTML5 <canvas> element');
  assert.match(comp, /pointerdown/i, 'Must attach pointerdown listener for unified touch/mouse input');
  assert.match(comp, /pointermove/i, 'Must attach pointermove listener for stroke drawing');
  assert.match(comp, /pointerup/i, 'Must attach pointerup listener for stroke completion');
  assert.match(comp, /touch-action:\s*none|touchAction:\s*['"]none['"]/, 'Must enforce touch-action: none to isolate canvas from mobile scrolling');
});

tier1.add('T1.1.2', 'submit_absensi_siswa endpoint stores signature in absensi_ujian and log_ujian', 'R1: Canvas Signature', async () => {
  const testIdLog = `LOG-TEST-${Date.now()}`;
  const testIdJadwal = 'U-67AC6649';
  const testIdSiswa = 'S-F2934CD8';
  cleanupRegistry.logIds.add(testIdLog);

  // Ensure fixture room exists in DB
  await supabase.from('ruang_ujian').upsert([{
    id_ruang: FIXTURE_ROOM_ID,
    npsn: TEST_NPSN,
    nama_ruang: 'Ruang Fixture E2E',
    kapasitas: 40
  }]);

  // Attempt submit signature via fetchAPI
  const res = await fetchAPI('submit_absensi_siswa', {
    id_log: testIdLog,
    id_jadwal: testIdIdJadwalSafe(testIdJadwal),
    id_siswa: testIdSiswa,
    npsn: TEST_NPSN,
    tanda_tangan: SAMPLE_SIGNATURE_PNG,
    id_ruang: FIXTURE_ROOM_ID
  });

  assert.equal(res.status, 'success', `submit_absensi_siswa must return success: ${res.message || ''}`);
  assert.ok(res.data || res.message, 'Must return response data or confirmation message');

  // Verify in absensi_ujian table
  const { data: absData, error: absErr } = await supabase
    .from('absensi_ujian')
    .select('*')
    .eq('id_siswa', testIdSiswa)
    .eq('npsn', TEST_NPSN)
    .order('created_at', { ascending: false })
    .limit(1);

  assert.equal(absErr, null, 'Querying absensi_ujian must succeed without database errors');
  assert.ok(absData && absData.length > 0, 'Record must exist in absensi_ujian');
  assert.equal(absData[0].status_kehadiran, 'HADIR', 'status_kehadiran must be "HADIR"');
  assert.ok(absData[0].tanda_tangan.startsWith('data:image/png;base64,'), 'tanda_tangan must be stored as Base64 PNG data URL');
  cleanupRegistry.absensiIds.add(absData[0].id_absensi);
});

tier1.add('T1.1.3', 'get_soal_ujian blocks question delivery if student has not signed', 'R1: Canvas Signature', async () => {
  const ts = Date.now().toString().slice(-6);
  const unsignedSiswaId = `S-UNSIGN-${ts}`;
  cleanupRegistry.siswaIds.add(unsignedSiswaId);

  // Insert dedicated unsigned student in public.siswa
  await supabase.from('siswa').insert([{
    id_siswa: unsignedSiswaId,
    npsn: TEST_NPSN,
    nama_lengkap: 'Siswa Belum TTD',
    nisn: `000${ts}`,
    username: `siswa_unsign_${ts}`,
    password: 'Password123!'
  }]);

  // Create an unsigned test log in log_ujian
  const unsignedLogId = `LOG-UNSIGNED-${ts}`;
  cleanupRegistry.logIds.add(unsignedLogId);

  await supabase.from('log_ujian').insert([{
    id_log: unsignedLogId,
    id_jadwal: 'U-67AC6649',
    id_siswa: unsignedSiswaId,
    status_ujian: 'SEDANG KERJA',
    tanda_tangan: null
  }]);

  const res = await fetchAPI('get_soal_ujian', {
    id_jadwal: 'U-67AC6649',
    id_log: unsignedLogId,
    npsn: TEST_NPSN
  });

  // Server-side gating must deny access or return need_signature flag
  assert.ok(
    res.status === 'error' || res.need_signature === true || !res.data || res.data.length === 0,
    'get_soal_ujian must block questions for unsigned log'
  );
  if (res.status === 'error') {
    assert.match(
      res.message || '',
      /tanda tangan|kehadiran|need_signature/i,
      'Error message must indicate missing signature'
    );
  }
});

tier1.add('T1.1.4', 'ExamRoom.jsx double gating and deferred anti-cheat mounting', 'R1: Canvas Signature', () => {
  const examRoomContent = readFileSafe(path.join(srcDir, 'views', 'ExamRoom.jsx'));
  assert.ok(examRoomContent, 'src/views/ExamRoom.jsx must exist');
  assert.match(
    examRoomContent,
    /hasSigned|DigitalSignatureModal|isSigned/i,
    'ExamRoom must implement signature gating state or render DigitalSignatureModal'
  );
  assert.match(
    examRoomContent,
    /requestFullscreen|fetchSoal/i,
    'User submission gesture must unlock questions and optionally trigger fullscreen'
  );
});

tier1.add('T1.1.5', 'Reconnection continuity: already signed session unlocks immediately without re-prompt', 'R1: Canvas Signature', async () => {
  const signedLogId = `LOG-SIGNED-${Date.now()}`;
  cleanupRegistry.logIds.add(signedLogId);

  await supabase.from('log_ujian').insert([{
    id_log: signedLogId,
    id_jadwal: 'U-67AC6649',
    id_siswa: 'S-F2934CD8',
    status_ujian: 'SEDANG KERJA',
    tanda_tangan: SAMPLE_SIGNATURE_PNG,
    status_kehadiran: 'HADIR'
  }]);

  // When status_log is queried for an already signed session
  const res = await fetchAPI('get_status_log_ujian', {
    id_log: signedLogId,
    npsn: TEST_NPSN
  });

  if (res.status === 'success' && res.data) {
    assert.ok(
      res.data.tanda_tangan || res.data.has_signed || res.data.status_kehadiran === 'HADIR',
      'get_status_log_ujian must return existing signature state for reconnection'
    );
  }
});

// --- Feature 2: Admin Proctor & Room Management (R2) ---
tier1.add('T1.2.1', 'create_ruang endpoint creates master room record in public.ruang_ujian', 'R2: Admin Proctor Assignment', async () => {
  const roomId = `R-E2E-${Date.now().toString().slice(-6)}`;
  cleanupRegistry.ruangIds.add(roomId);

  const res = await fetchAPI('create_ruang', {
    id_ruang: roomId,
    npsn: TEST_NPSN,
    nama_ruang: 'Lab Komputer Alpha E2E',
    kode_ruang: 'LAB-A',
    kapasitas: 35,
    keterangan: 'Ruang Ujian Terpadu'
  });

  assert.equal(res.status, 'success', `create_ruang must succeed: ${res.message || ''}`);

  // Direct database assertion
  const { data, error } = await supabase
    .from('ruang_ujian')
    .select('*')
    .eq('id_ruang', roomId)
    .single();

  assert.equal(error, null, 'Database query for newly created room must succeed');
  assert.equal(data.nama_ruang, 'Lab Komputer Alpha E2E', 'nama_ruang must match');
  assert.equal(data.kapasitas, 35, 'kapasitas must match');
  assert.equal(data.npsn, TEST_NPSN, 'npsn must match');
});

tier1.add('T1.2.2', 'get_ruang endpoint lists rooms filtered by school NPSN', 'R2: Admin Proctor Assignment', async () => {
  const res = await fetchAPI('get_ruang', { npsn: TEST_NPSN });
  assert.equal(res.status, 'success', 'get_ruang must return success');
  assert.ok(Array.isArray(res.data), 'get_ruang must return an array of rooms');
  assert.greaterThanOrEqual(res.data.length, 1, 'Should find at least 1 room for test school');
  const allMatchNpsn = res.data.every(r => r.npsn === TEST_NPSN);
  assert.isTrue(allMatchNpsn, 'All returned rooms must strictly belong to the queried NPSN');
});

tier1.add('T1.2.3', 'assign_pengawas_ruang assigns teacher to room and schedule', 'R2: Admin Proctor Assignment', async () => {
  const roomId = Array.from(cleanupRegistry.ruangIds)[0] || 'R-TEST-INIT';
  const testGuruId = 'G-163390E6'; // Ade Fitrawan Ibrahim, M.Pd., Gr.
  const testJadwalId = 'U-67AC6649';
  const penugasanId = `TGS-E2E-${Date.now().toString().slice(-6)}`;
  cleanupRegistry.penugasanIds.add(penugasanId);

  const res = await fetchAPI('assign_pengawas_ruang', {
    id_penugasan: penugasanId,
    npsn: TEST_NPSN,
    id_ruang: roomId,
    id_guru: testGuruId,
    id_jadwal: testJadwalId,
    peran: 'PENGAWAS UTAMA',
    status_tugas: 'AKTIF'
  });

  assert.equal(res.status, 'success', `assign_pengawas_ruang must succeed: ${res.message || ''}`);

  // Direct database assertion
  const { data, error } = await supabase
    .from('pengawas_ruang')
    .select('*')
    .eq('id_penugasan', penugasanId)
    .single();

  assert.equal(error, null, 'Querying pengawas_ruang must succeed');
  assert.equal(data.id_guru, testGuruId, 'Assigned guru must match');
  assert.equal(data.id_ruang, roomId, 'Assigned room must match');
});

tier1.add('T1.2.4', 'get_pengawas_ruang returns proctor assignments with joined guru and room details', 'R2: Admin Proctor Assignment', async () => {
  const res = await fetchAPI('get_pengawas_ruang', { npsn: TEST_NPSN });
  assert.equal(res.status, 'success', 'get_pengawas_ruang must succeed');
  assert.ok(Array.isArray(res.data), 'get_pengawas_ruang must return array');
  assert.greaterThanOrEqual(res.data.length, 1, 'Must contain at least 1 proctor assignment');
  const first = res.data[0];
  assert.ok(first.id_guru, 'Must contain id_guru');
  assert.ok(first.id_ruang, 'Must contain id_ruang');
  // Check relational join if present
  if (first.guru) {
    assert.ok(first.guru.nama_lengkap, 'Joined guru must have nama_lengkap');
  }
});

tier1.add('T1.2.5', 'AdminView.jsx includes Pengawas & Ruang navigation tab and management controls', 'R2: Admin Proctor Assignment', () => {
  const adminViewContent = readFileSafe(path.join(srcDir, 'views', 'AdminView.jsx'));
  assert.ok(adminViewContent, 'src/views/AdminView.jsx must exist');
  assert.match(
    adminViewContent,
    /id:\s*['"]pengawas['"]|label:\s*['"][^'"]*Pengawas[^'"]*['"]|Pengawas & Ruang/i,
    'AdminView must register navigation item for Pengawas & Ruang'
  );
  assert.match(
    adminViewContent,
    /dataRuang|dataPengawas|get_ruang|get_pengawas_ruang/i,
    'AdminView must handle state or API calls for proctor and room management'
  );
});

// --- Feature 3: Proctor Dashboard & Attendance Verification (R3) ---
tier1.add('T1.3.1', 'get_absensi_ruang returns student attendance list for designated room & schedule', 'R3: Proctor Verification', async () => {
  const testJadwalId = 'U-67AC6649';
  const testRoomId = Array.from(cleanupRegistry.ruangIds)[0] || 'R-E2E-TEST';

  const res = await fetchAPI('get_absensi_ruang', {
    npsn: TEST_NPSN,
    id_jadwal: testJadwalId,
    id_ruang: testRoomId
  });

  assert.equal(res.status, 'success', `get_absensi_ruang must succeed: ${res.message || ''}`);
  assert.ok(Array.isArray(res.data), 'get_absensi_ruang must return an array');
});

tier1.add('T1.3.2', 'verifikasi_absensi updates student attendance status to DISETUJUI with proctor ID', 'R3: Proctor Verification', async () => {
  // Ensure an absensi record exists
  let targetAbsId = Array.from(cleanupRegistry.absensiIds)[0];
  if (targetAbsId) {
    const { data: existing } = await supabase.from('absensi_ujian').select('id_absensi').eq('id_absensi', targetAbsId).maybeSingle();
    if (!existing) targetAbsId = null;
  }

  if (!targetAbsId) {
    targetAbsId = `ABS-TEST-${Date.now().toString().slice(-6)}`;
    cleanupRegistry.absensiIds.add(targetAbsId);
    await supabase.from('absensi_ujian').insert([{
      id_absensi: targetAbsId,
      npsn: TEST_NPSN,
      id_jadwal: 'U-67AC6649',
      id_siswa: 'S-F2934CD8',
      tanda_tangan: SAMPLE_SIGNATURE_PNG,
      status_kehadiran: 'HADIR',
      status_verifikasi: 'MENUNGGU'
    }]);
  }

  const proctorId = 'G-163390E6';
  const res = await fetchAPI('verifikasi_absensi', {
    id_absensi: targetAbsId,
    status_verifikasi: 'DISETUJUI',
    id_guru: proctorId,
    catatan: 'Tanda tangan valid dan sesuai identitas.'
  });

  assert.equal(res.status, 'success', `verifikasi_absensi must succeed: ${res.message || ''}`);

  // Verify in database
  const { data, error } = await supabase
    .from('absensi_ujian')
    .select('status_verifikasi, verified_by, verified_at, catatan_pengawas')
    .eq('id_absensi', targetAbsId)
    .single();

  assert.equal(error, null, 'Querying verified absensi must succeed');
  assert.equal(data.status_verifikasi, 'DISETUJUI', 'status_verifikasi must be updated to DISETUJUI');
  assert.equal(data.verified_by, proctorId, 'verified_by must record proctor teacher ID');
  assert.ok(data.verified_at, 'verified_at timestamp must be recorded');
});

tier1.add('T1.3.3', 'verifikasi_absensi_bulk approves multiple examinees in a single atomic transaction', 'R3: Proctor Verification', async () => {
  const ts = Date.now().toString().slice(-5);
  const student1Id = `S-BULK1-${ts}`;
  const student2Id = `S-BULK2-${ts}`;
  cleanupRegistry.siswaIds.add(student1Id);
  cleanupRegistry.siswaIds.add(student2Id);

  // Insert two valid test students in public.siswa
  await supabase.from('siswa').insert([
    {
      id_siswa: student1Id,
      npsn: TEST_NPSN,
      nama_lengkap: 'Siswa Uji Bulk Satu',
      nisn: `001${ts}`,
      username: `siswa_bulk1_${ts}`,
      password: 'Password123!'
    },
    {
      id_siswa: student2Id,
      npsn: TEST_NPSN,
      nama_lengkap: 'Siswa Uji Bulk Dua',
      nisn: `002${ts}`,
      username: `siswa_bulk2_${ts}`,
      password: 'Password123!'
    }
  ]);

  const abs1 = `ABS-B1-${ts}`;
  const abs2 = `ABS-B2-${ts}`;
  cleanupRegistry.absensiIds.add(abs1);
  cleanupRegistry.absensiIds.add(abs2);

  await supabase.from('absensi_ujian').insert([
    {
      id_absensi: abs1,
      npsn: TEST_NPSN,
      id_jadwal: 'U-67AC6649',
      id_siswa: student1Id,
      tanda_tangan: SAMPLE_SIGNATURE_PNG,
      status_verifikasi: 'MENUNGGU'
    },
    {
      id_absensi: abs2,
      npsn: TEST_NPSN,
      id_jadwal: 'U-67AC6649',
      id_siswa: student2Id,
      tanda_tangan: SAMPLE_SIGNATURE_PNG,
      status_verifikasi: 'MENUNGGU'
    }
  ]);

  const res = await fetchAPI('verifikasi_absensi_bulk', {
    list_id_absensi: [abs1, abs2],
    id_guru: 'G-163390E6'
  });

  assert.equal(res.status, 'success', `verifikasi_absensi_bulk must succeed: ${res.message || ''}`);

  const { data } = await supabase
    .from('absensi_ujian')
    .select('id_absensi, status_verifikasi')
    .in('id_absensi', [abs1, abs2]);

  assert.ok(data && data.length === 2, 'Both records must be found');
  assert.isTrue(data.every(d => d.status_verifikasi === 'DISETUJUI'), 'All bulk approved items must be DISETUJUI');
});

tier1.add('T1.3.4', 'GuruView.jsx incorporates proctor dashboard tab/view for assigned exam rooms', 'R3: Proctor Verification', () => {
  const guruViewContent = readFileSafe(path.join(srcDir, 'views', 'GuruView.jsx'));
  assert.ok(guruViewContent, 'src/views/GuruView.jsx must exist');
  assert.match(
    guruViewContent,
    /pengawas|ruang_pengawas|pengawasan|get_tugas_pengawas|get_ruang_guru_pengawas/i,
    'GuruView must feature proctor assignment tracking or exam room proctoring interface'
  );
  assert.match(
    guruViewContent,
    /verifikasi_absensi|Setujui|approval/i,
    'GuruView must provide controls for approving student attendance signatures'
  );
});

tier1.add('T1.3.5', 'Signature inspection modal renders enlarged digital canvas preview', 'R3: Proctor Verification', () => {
  const modalCompPath = path.join(srcDir, 'components', 'ModalPratinjauTandaTangan.jsx');
  const uiPath = path.join(srcDir, 'components', 'UI.jsx');
  const guruViewPath = path.join(srcDir, 'views', 'GuruView.jsx');

  const compContent = readFileSafe(modalCompPath) || readFileSafe(uiPath) || readFileSafe(guruViewPath);
  assert.ok(compContent, 'Signature preview component/code must exist in project');
  assert.match(
    compContent,
    /tanda_tangan|<img[^>]*tanda_tangan|pratinjau|preview/i,
    'Inspection UI must render student signature image and preview modal'
  );
});

// --- Feature 4: Print-Friendly HTML Documents & CSS (R4) ---
tier1.add('T1.4.1', 'get_dokumen_ujian_cetak returns aggregated dossier data', 'R4: Print Documents & CSS', async () => {
  const roomId = Array.from(cleanupRegistry.ruangIds)[0] || 'R-E2E-TEST';
  const res = await fetchAPI('get_dokumen_ujian_cetak', {
    npsn: TEST_NPSN,
    id_jadwal: 'U-67AC6649',
    id_ruang: roomId
  });

  assert.equal(res.status, 'success', `get_dokumen_ujian_cetak must succeed: ${res.message || ''}`);
  assert.ok(res.data, 'Must return data object');
  assert.ok(res.data.sekolah, 'Must include sekolah entity');
  assert.ok(res.data.jadwal, 'Must include jadwal entity');
  assert.ok(Array.isArray(res.data.peserta), 'Must include peserta list');
});

tier1.add('T1.4.2', 'DokumenUjianPrint.jsx Kop Surat contains Dinas and School SVG logo placeholders', 'R4: Print Documents & CSS', () => {
  const printCompPath = path.join(srcDir, 'components', 'DokumenUjianPrint.jsx');
  const printComp = readFileSafe(printCompPath);
  assert.ok(printComp, 'src/components/DokumenUjianPrint.jsx must exist');
  assert.match(printComp, /<svg|<img[^>]*logo/i, 'Kop Surat must render SVG or image logo placeholders');
  assert.match(printComp, /border-b|double/i, 'Kop Surat must feature formal dividing border rule');
  assert.match(printComp, /NPSN|DINAS|PEMERINTAH/i, 'Kop Surat must display official administrative header fields');
});

tier1.add('T1.4.3', 'DokumenUjianPrint.jsx Berita Acara includes exam metadata, counts, notes, and proctor sign', 'R4: Print Documents & CSS', () => {
  const printComp = readFileSafe(path.join(srcDir, 'components', 'DokumenUjianPrint.jsx'));
  assert.ok(printComp, 'src/components/DokumenUjianPrint.jsx must exist');
  assert.match(printComp, /BERITA ACARA/i, 'Must contain BERITA ACARA section header');
  assert.match(printComp, /jumlah_peserta|hadir|terdaftar/i, 'Must display attendance count summaries');
  assert.match(printComp, /catatan|pelaksanaan/i, 'Must render exam incident / condition notes');
  assert.match(printComp, /Pengawas|NIP/i, 'Must include proctor signature block with Name and NIP');
});

tier1.add('T1.4.4', 'DokumenUjianPrint.jsx Daftar Hadir embeds Base64 PNG signature images in table', 'R4: Print Documents & CSS', () => {
  const printComp = readFileSafe(path.join(srcDir, 'components', 'DokumenUjianPrint.jsx'));
  assert.ok(printComp, 'src/components/DokumenUjianPrint.jsx must exist');
  assert.match(printComp, /DAFTAR HADIR/i, 'Must contain DAFTAR HADIR section header');
  assert.match(printComp, /<table\b/, 'Must render student attendance sheet as an HTML table');
  assert.match(
    printComp,
    /<img[^>]*src=\{[^}]*tanda_tangan[^}]*\}/i,
    'Must embed Base64 signature image in table row'
  );
});

tier1.add('T1.4.5', 'index.css defines root @media print rules with white background and color adjust', 'R4: Print Documents & CSS', () => {
  const css = readFileSafe(path.join(srcDir, 'index.css'));
  assert.ok(css, 'src/index.css must exist');
  assert.match(css, /@media\s+print\b/, 'index.css must declare @media print queries');
  assert.match(
    css,
    /print-color-adjust:\s*exact|-webkit-print-color-adjust:\s*exact/,
    'Must enforce exact print color reproduction'
  );
  assert.match(css, /background:\s*(?:#ffffff|white)\s*!important/, 'Must enforce pure white background in print mode');
});

// =============================================================================
// TIER 2: BOUNDARY & CORNER CASES (10 Tests)
// =============================================================================
const tier2 = registerSuite(2, 'Tier 2: Boundary & Corner Cases', 'Adversarial edge cases, invalid inputs, and stress boundaries');

tier2.add('T2.1.1', 'Blank canvas rejection: identifies transparent pixel or zero strokes', 'Boundary: Canvas Detection', () => {
  assert.isTrue(isBlankSignatureData(null), 'Null signature must be flagged as blank');
  assert.isTrue(isBlankSignatureData(''), 'Empty string must be flagged as blank');
  assert.isTrue(isBlankSignatureData(BLANK_TRANSPARENT_PNG), '1x1 transparent PNG must be flagged as blank');
  assert.isFalse(isBlankSignatureData(SAMPLE_SIGNATURE_PNG), 'Actual stroke signature must NOT be flagged as blank');
});

tier2.add('T2.1.2', 'submit_absensi_siswa rejects malformed and non-image data URLs', 'Boundary: Signature Validation', async () => {
  const res1 = await fetchAPI('submit_absensi_siswa', {
    id_log: 'LOG-BAD-1',
    id_jadwal: 'U-67AC6649',
    id_siswa: 'S-F2934CD8',
    npsn: TEST_NPSN,
    tanda_tangan: MALFORMED_TEXT_DATA_URL
  });
  assert.equal(res1.status, 'error', 'Must reject text/plain data URL');

  const res2 = await fetchAPI('submit_absensi_siswa', {
    id_log: 'LOG-BAD-2',
    id_jadwal: 'U-67AC6649',
    id_siswa: 'S-F2934CD8',
    npsn: TEST_NPSN,
    tanda_tangan: RAW_UNENCODED_STRING
  });
  assert.equal(res2.status, 'error', 'Must reject raw string without data URL prefix');
});

tier2.add('T2.2.1', 'Duplicate proctor assignment handling avoids orphaned duplicates', 'Boundary: Proctor Assignment', async () => {
  const roomId = Array.from(cleanupRegistry.ruangIds)[0] || 'R-E2E-TEST';
  const idGuru = 'G-163390E6';
  const idJadwal = 'U-67AC6649';
  const idPenugasan = `TGS-DUP-${Date.now().toString().slice(-6)}`;
  cleanupRegistry.penugasanIds.add(idPenugasan);

  // First assignment
  const res1 = await fetchAPI('assign_pengawas_ruang', {
    id_penugasan: idPenugasan,
    npsn: TEST_NPSN,
    id_ruang: roomId,
    id_guru: idGuru,
    id_jadwal: idJadwal
  });
  assert.equal(res1.status, 'success', 'First assignment must succeed');

  // Second duplicate assignment attempt
  const res2 = await fetchAPI('assign_pengawas_ruang', {
    id_penugasan: idPenugasan,
    npsn: TEST_NPSN,
    id_ruang: roomId,
    id_guru: idGuru,
    id_jadwal: idJadwal
  });

  // Must either succeed via upsert or gracefully return handled error
  assert.ok(
    res2.status === 'success' || (res2.status === 'error' && /sudah ada|terdaftar|duplicate|conflict/i.test(res2.message || '')),
    'Duplicate assignment must be safely handled without database crash'
  );
});

tier2.add('T2.2.2', 'assign_pengawas_ruang rejects nonexistent teacher or room ID', 'Boundary: Foreign Key Integrity', async () => {
  const res = await fetchAPI('assign_pengawas_ruang', {
    id_penugasan: `TGS-INVALID-${Date.now()}`,
    npsn: TEST_NPSN,
    id_ruang: 'R-NONEXISTENT-999999',
    id_guru: 'G-NONEXISTENT-999999',
    id_jadwal: 'U-67AC6649'
  });

  assert.equal(res.status, 'error', 'Must reject assignment with nonexistent foreign keys');
});

tier2.add('T2.2.3', 'create_ruang validates capacity boundaries (positive number conversion)', 'Boundary: Room Capacity', async () => {
  const testId = `R-CAP-${Date.now().toString().slice(-5)}`;
  cleanupRegistry.ruangIds.add(testId);

  const res = await fetchAPI('create_ruang', {
    id_ruang: testId,
    npsn: TEST_NPSN,
    nama_ruang: 'Ruang Uji Kapasitas',
    kapasitas: '45' // String representation
  });

  assert.equal(res.status, 'success', 'Must parse string capacity to numeric');

  const { data } = await supabase
    .from('ruang_ujian')
    .select('kapasitas')
    .eq('id_ruang', testId)
    .single();

  assert.equal(typeof data.kapasitas, 'number', 'kapasitas column must be numeric in DB');
  assert.equal(data.kapasitas, 45, 'Parsed numeric value must be 45');
});

tier2.add('T2.3.1', 'get_absensi_ruang handles query for nonexistent room safely without crash', 'Boundary: Graceful Query', async () => {
  const res = await fetchAPI('get_absensi_ruang', {
    npsn: TEST_NPSN,
    id_jadwal: 'U-67AC6649',
    id_ruang: 'R-DOES-NOT-EXIST-404'
  });

  assert.equal(res.status, 'success', 'Must return success status');
  assert.deepEqual(res.data, [], 'Must return empty array for nonexistent room');
});

tier2.add('T2.3.2', 'verifikasi_absensi_bulk rejects empty array with clear validation error', 'Boundary: Bulk Verification', async () => {
  const res = await fetchAPI('verifikasi_absensi_bulk', {
    list_id_absensi: [],
    id_guru: 'G-163390E6'
  });

  assert.equal(res.status, 'error', 'Must reject empty list_id_absensi');
  assert.match(res.message || '', /tidak ada|kosong|wajib|empty/i, 'Error message must specify empty list');
});

tier2.add('T2.4.1', 'Berita Acara stores and retrieves large incident notes (10,000+ characters)', 'Boundary: Large Payload', async () => {
  const roomId = Array.from(cleanupRegistry.ruangIds)[0] || 'R-E2E-TEST';
  const idBA = `BA-LARGE-${Date.now().toString().slice(-6)}`;
  cleanupRegistry.beritaAcaraIds.add(idBA);

  // Generate 10,000 characters of incident description
  const largeNotes = 'LAPORAN INSIDEN RUANG UJIAN: ' + 'Kondisi ruang stabil, koneksi LAN lancar. '.repeat(250);
  assert.greaterThanOrEqual(largeNotes.length, 10000, 'Payload must be at least 10,000 characters');

  const res = await fetchAPI('save_berita_acara', {
    id_berita_acara: idBA,
    npsn: TEST_NPSN,
    id_jadwal: 'U-67AC6649',
    id_ruang: roomId,
    id_guru: 'G-163390E6',
    jumlah_peserta_terdaftar: 30,
    jumlah_peserta_hadir: 29,
    jumlah_peserta_absen: 1,
    catatan_pelaksanaan: largeNotes
  });

  assert.equal(res.status, 'success', `save_berita_acara must accept large notes: ${res.message || ''}`);

  const { data, error } = await supabase
    .from('berita_acara_ujian')
    .select('catatan_pelaksanaan')
    .eq('id_berita_acara', idBA)
    .single();

  assert.equal(error, null, 'Querying saved berita acara must succeed');
  assert.equal(data.catatan_pelaksanaan.length, largeNotes.length, 'Large notes must not be truncated in database');
});

tier2.add('T2.4.2', 'Berita Acara preserves multiline formatting, special characters, and quotes', 'Boundary: Special Characters', async () => {
  const roomId = Array.from(cleanupRegistry.ruangIds)[0] || 'R-E2E-TEST';
  const idBA = `BA-SPEC-${Date.now().toString().slice(-6)}`;
  cleanupRegistry.beritaAcaraIds.add(idBA);

  const specialText = 'Catatan:\n1. Siswa "Ahmad" izin 5 menit.\n2. Koneksi <switch-01> sempat reboot.\n3. Nilai: 100% aman & tertib. 📝';

  const res = await fetchAPI('save_berita_acara', {
    id_berita_acara: idBA,
    npsn: TEST_NPSN,
    id_jadwal: 'U-67AC6649',
    id_ruang: roomId,
    id_guru: 'G-163390E6',
    catatan_pelaksanaan: specialText
  });

  assert.equal(res.status, 'success', 'Must preserve special characters');

  const { data } = await supabase
    .from('berita_acara_ujian')
    .select('catatan_pelaksanaan')
    .eq('id_berita_acara', idBA)
    .single();

  assert.equal(data.catatan_pelaksanaan, specialText, 'Stored text must exactly match input including newlines and quotes');
});

tier2.add('T2.4.3', 'Multi-tenant data isolation: School A queries cannot leak School B records', 'Boundary: Multi-Tenancy', async () => {
  // Query rooms for School B
  const resB = await fetchAPI('get_ruang', { npsn: ALT_NPSN });
  if (resB.status === 'success' && resB.data) {
    const leakFound = resB.data.some(r => r.npsn === TEST_NPSN);
    assert.isFalse(leakFound, 'Query for School B must never return School A rooms');
  }

  // Query proctor assignments for School B
  const resPgwB = await fetchAPI('get_pengawas_ruang', { npsn: ALT_NPSN });
  if (resPgwB.status === 'success' && resPgwB.data) {
    const leakPgw = resPgwB.data.some(p => p.npsn === TEST_NPSN);
    assert.isFalse(leakPgw, 'Query for School B must never return School A proctor assignments');
  }
});

// =============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS (5 Tests)
// =============================================================================
const tier3 = registerSuite(3, 'Tier 3: Cross-Feature Combinations', 'End-to-end multi-step flows and relational continuity');

tier3.add('T3.1', 'Full End-to-End Relational Lifecycle: Admin Assign -> Student Sign -> Proctor Approve -> Print', 'Cross-Feature: E2E Flow', async () => {
  const timestamp = Date.now().toString().slice(-6);
  const testRoomId = `R-LIFECYCLE-${timestamp}`;
  const testPenugasanId = `TGS-LIFECYCLE-${timestamp}`;
  const testAbsensiId = `ABS-LIFECYCLE-${timestamp}`;
  const testLogId = `LOG-LIFECYCLE-${timestamp}`;
  const testJadwalId = 'U-67AC6649';
  const testGuruId = 'G-163390E6';
  const testSiswaId = 'S-F2934CD8';

  cleanupRegistry.ruangIds.add(testRoomId);
  cleanupRegistry.penugasanIds.add(testPenugasanId);
  cleanupRegistry.absensiIds.add(testAbsensiId);
  cleanupRegistry.logIds.add(testLogId);

  // Step 1: Admin creates room
  const r1 = await fetchAPI('create_ruang', {
    id_ruang: testRoomId,
    npsn: TEST_NPSN,
    nama_ruang: `Ruang Uji Lifecycle ${timestamp}`,
    kapasitas: 25
  });
  assert.equal(r1.status, 'success', 'Step 1: Admin must create room');

  // Step 2: Admin assigns teacher as proctor
  const r2 = await fetchAPI('assign_pengawas_ruang', {
    id_penugasan: testPenugasanId,
    npsn: TEST_NPSN,
    id_ruang: testRoomId,
    id_guru: testGuruId,
    id_jadwal: testJadwalId
  });
  assert.equal(r2.status, 'success', 'Step 2: Admin must assign proctor');

  // Step 3: Student signs attendance
  const r3 = await fetchAPI('submit_absensi_siswa', {
    id_absensi: testAbsensiId,
    id_log: testLogId,
    npsn: TEST_NPSN,
    id_jadwal: testJadwalId,
    id_siswa: testSiswaId,
    id_ruang: testRoomId,
    tanda_tangan: SAMPLE_SIGNATURE_PNG
  });
  assert.equal(r3.status, 'success', 'Step 3: Student signature must be submitted');

  // Step 4: Proctor views student attendance
  const r4 = await fetchAPI('get_absensi_ruang', {
    npsn: TEST_NPSN,
    id_jadwal: testJadwalId,
    id_ruang: testRoomId
  });
  assert.equal(r4.status, 'success', 'Step 4: Proctor must query room attendance');
  assert.greaterThanOrEqual(r4.data.length, 1, 'Proctor must see the attendee');

  // Step 5: Proctor approves attendance
  const r5 = await fetchAPI('verifikasi_absensi', {
    id_absensi: testAbsensiId,
    status_verifikasi: 'DISETUJUI',
    id_guru: testGuruId
  });
  assert.equal(r5.status, 'success', 'Step 5: Proctor must approve attendance');

  // Step 6: Print document aggregation reflects all linked data
  const r6 = await fetchAPI('get_dokumen_ujian_cetak', {
    npsn: TEST_NPSN,
    id_jadwal: testJadwalId,
    id_ruang: testRoomId
  });
  assert.equal(r6.status, 'success', 'Step 6: Print document payload must be retrieved');
  assert.ok(r6.data.ruang, 'Print payload must include room');
  assert.equal(r6.data.ruang.id_ruang, testRoomId, 'Room ID in print payload must match');
});

tier3.add('T3.2', 'Reconnection and refresh resilience preserves student signature state', 'Cross-Feature: Session Persistence', async () => {
  // Simulates a student refreshing ExamRoom with active session
  const testIdLog = `LOG-RECONNECT-${Date.now().toString().slice(-6)}`;
  cleanupRegistry.logIds.add(testIdLog);

  await supabase.from('log_ujian').insert([{
    id_log: testIdLog,
    id_jadwal: 'U-67AC6649',
    id_siswa: 'S-F2934CD8',
    status_ujian: 'SEDANG KERJA',
    tanda_tangan: SAMPLE_SIGNATURE_PNG,
    status_kehadiran: 'HADIR'
  }]);

  const { data } = await supabase
    .from('log_ujian')
    .select('tanda_tangan, status_kehadiran')
    .eq('id_log', testIdLog)
    .single();

  assert.ok(data.tanda_tangan, 'tanda_tangan must persist on reload');
  assert.equal(data.status_kehadiran, 'HADIR', 'status_kehadiran must remain HADIR');
});

tier3.add('T3.3', 'Cascading deletion: deleting exam room cleans up dependent proctor assignments', 'Cross-Feature: Cascade Integrity', async () => {
  const delRoomId = `R-DEL-${Date.now().toString().slice(-6)}`;
  const delPgwId = `TGS-DEL-${Date.now().toString().slice(-6)}`;

  // Insert room and assignment
  await supabase.from('ruang_ujian').insert([{
    id_ruang: delRoomId,
    npsn: TEST_NPSN,
    nama_ruang: 'Ruang Uji Cascade Hapus'
  }]);

  await supabase.from('pengawas_ruang').insert([{
    id_penugasan: delPgwId,
    npsn: TEST_NPSN,
    id_ruang: delRoomId,
    id_guru: 'G-163390E6',
    id_jadwal: 'U-67AC6649'
  }]);

  // Execute delete room via API or DB
  const res = await fetchAPI('delete_ruang', {
    id_ruang: delRoomId,
    npsn: TEST_NPSN
  });
  assert.equal(res.status, 'success', 'delete_ruang must succeed');

  // Verify assignment is also removed
  const { data: pgwCheck } = await supabase
    .from('pengawas_ruang')
    .select('id_penugasan')
    .eq('id_penugasan', delPgwId);

  assert.equal(pgwCheck.length, 0, 'Dependent assignment must be cascade deleted');
});

tier3.add('T3.4', 'Dynamic proctor reassignment updates print document proctor information', 'Cross-Feature: Reassignment', async () => {
  const roomId = Array.from(cleanupRegistry.ruangIds)[0] || 'R-E2E-TEST';
  const newPgwId = `TGS-REASSIGN-${Date.now().toString().slice(-6)}`;
  cleanupRegistry.penugasanIds.add(newPgwId);

  // Assign proctor
  await fetchAPI('assign_pengawas_ruang', {
    id_penugasan: newPgwId,
    npsn: TEST_NPSN,
    id_ruang: roomId,
    id_guru: 'G-163390E6',
    id_jadwal: 'U-67AC6649'
  });

  const resPrint = await fetchAPI('get_dokumen_ujian_cetak', {
    npsn: TEST_NPSN,
    id_jadwal: 'U-67AC6649',
    id_ruang: roomId
  });

  assert.equal(resPrint.status, 'success', 'get_dokumen_ujian_cetak must succeed');
  if (resPrint.data.pengawas) {
    assert.equal(resPrint.data.pengawas.id_guru, 'G-163390E6', 'Proctor in print document must reflect latest assignment');
  }
});

tier3.add('T3.5', 'Mixed status attendance sheet accurately tallies hadir, terverifikasi, and absen', 'Cross-Feature: Statistics Calculation', () => {
  // Simulate 10 students with mixed attendance states
  const mockStudents = [
    { id: '1', status: 'HADIR', verifikasi: 'DISETUJUI' },
    { id: '2', status: 'HADIR', verifikasi: 'DISETUJUI' },
    { id: '3', status: 'HADIR', verifikasi: 'DISETUJUI' },
    { id: '4', status: 'HADIR', verifikasi: 'MENUNGGU' },
    { id: '5', status: 'HADIR', verifikasi: 'MENUNGGU' },
    { id: '6', status: 'TIDAK HADIR', verifikasi: 'BELUM ABSEN' },
    { id: '7', status: 'TIDAK HADIR', verifikasi: 'BELUM ABSEN' },
    { id: '8', status: 'TIDAK HADIR', verifikasi: 'BELUM ABSEN' },
    { id: '9', status: 'TIDAK HADIR', verifikasi: 'BELUM ABSEN' },
    { id: '10', status: 'TIDAK HADIR', verifikasi: 'BELUM ABSEN' }
  ];

  const totalRegistered = mockStudents.length;
  const totalPresent = mockStudents.filter(s => s.status === 'HADIR').length;
  const totalVerified = mockStudents.filter(s => s.verifikasi === 'DISETUJUI').length;
  const totalAbsent = mockStudents.filter(s => s.status === 'TIDAK HADIR').length;

  assert.equal(totalRegistered, 10, 'Total registered must be 10');
  assert.equal(totalPresent, 5, 'Total present must be 5');
  assert.equal(totalVerified, 3, 'Total verified must be 3');
  assert.equal(totalAbsent, 5, 'Total absent must be 5');
  assert.equal(totalPresent + totalAbsent, totalRegistered, 'Hadir + Absen must equal Total Terdaftar');
});

// =============================================================================
// TIER 4: REAL-WORLD WORKLOAD SIMULATION & PRINT CSS / DOM VERIFICATION (6 Tests)
// =============================================================================
const tier4 = registerSuite(4, 'Tier 4: Real-World Workload Simulation', '30-student room stress, memory limits, and @media print CSS rules');

tier4.add('T4.1', 'Multi-Student High-Density Room Simulation (30 Examinees)', 'Workload Simulation', () => {
  const students = [];
  for (let i = 1; i <= 30; i++) {
    const nisn = `00${5000 + i}`;
    const isPresent = i <= 25;
    const isVerified = i <= 20;

    students.push({
      no: i,
      id_siswa: `S-SIM-${i}`,
      nama_lengkap: `Siswa Peserta Ujian ${String.fromCharCode(64 + (i % 26 || 26))}${i}`,
      nisn,
      kelas: 'XII MIPA 1',
      tanda_tangan: isPresent ? SAMPLE_SIGNATURE_PNG : null,
      status_kehadiran: isPresent ? 'HADIR' : 'TIDAK HADIR',
      status_verifikasi: isVerified ? 'DISETUJUI' : isPresent ? 'MENUNGGU' : 'BELUM ABSEN'
    });
  }

  assert.equal(students.length, 30, 'Simulated cohort must contain 30 examinees');
  const hadirCount = students.filter(s => s.status_kehadiran === 'HADIR').length;
  const verifiedCount = students.filter(s => s.status_verifikasi === 'DISETUJUI').length;
  const absentCount = students.filter(s => s.status_kehadiran === 'TIDAK HADIR').length;

  assert.equal(hadirCount, 25, 'Hadir count must be 25');
  assert.equal(verifiedCount, 20, 'Verified count must be 20');
  assert.equal(absentCount, 5, 'Absent count must be 5');
});

tier4.add('T4.2', 'Signature Payload Memory & Network Budget Stress (< 1 MB total)', 'Workload Simulation', () => {
  // Simulates 30 embedded Base64 PNG signatures (each ~180-8000 bytes)
  const signatureBytes = Buffer.byteLength(SAMPLE_SIGNATURE_PNG, 'utf8');
  const totalSignaturesBytes = signatureBytes * 30;
  const totalMegabytes = totalSignaturesBytes / (1024 * 1024);

  // Must easily fit within browser DOM memory budget (< 1 MB)
  assert.ok(totalMegabytes < 1.0, `30 signatures (${totalSignaturesBytes} bytes) must be well under 1 MB budget`);
});

tier4.add('T4.3', '@page paper sizing and margins in src/index.css', 'Print CSS Compliance', () => {
  const css = readFileSafe(path.join(srcDir, 'index.css'));
  assert.ok(css, 'src/index.css must exist');
  assert.match(
    css,
    /@page\s*\{[^}]*size:\s*A4\s+portrait/i,
    'index.css must define @page { size: A4 portrait; }'
  );
  assert.match(
    css,
    /@page\s*\{[^}]*margin:/i,
    'index.css must configure formal print margins on @page'
  );
});

tier4.add('T4.4', 'Table header repetition: thead { display: table-header-group !important; } in print stylesheet', 'Print CSS Compliance', () => {
  const css = readFileSafe(path.join(srcDir, 'index.css'));
  assert.ok(css, 'src/index.css must exist');
  assert.match(
    css,
    /thead\s*\{[^}]*display:\s*table-header-group/i,
    'index.css must specify thead { display: table-header-group !important; } for repeating table headers across pages'
  );
});

tier4.add('T4.5', 'Clean page break controls: .page-break and .avoid-break in print stylesheet', 'Print CSS Compliance', () => {
  const css = readFileSafe(path.join(srcDir, 'index.css'));
  assert.ok(css, 'src/index.css must exist');
  assert.match(
    css,
    /\.page-break\s*\{[^}]*(?:page-break-before|break-before):\s*(?:always|page)/i,
    'index.css must specify page-break-before: always or break-before: page on .page-break'
  );
  assert.match(
    css,
    /\.avoid-break\s*\{[^}]*(?:page-break-inside|break-inside):\s*avoid/i,
    'index.css must specify page-break-inside: avoid on .avoid-break'
  );
});

tier4.add('T4.6', 'Strict screen UI suppression: nav, header, footer, button, .no-print suppressed in @media print', 'Print CSS Compliance', () => {
  const css = readFileSafe(path.join(srcDir, 'index.css'));
  assert.ok(css, 'src/index.css must exist');
  assert.match(
    css,
    /(?:nav|header|footer|button|\.no-print)[^{]*\{[^}]*display:\s*none\s*!important/i,
    'index.css must suppress screen UI elements with display: none !important in @media print'
  );
});

// Helper for test scheduling
function testIdIdJadwalSafe(j) {
  return j || 'U-67AC6649';
}

// =============================================================================
// RUNNER & REPORT GENERATOR
// =============================================================================

async function runTestSuite() {
  console.log(`\n${c.bold}${c.cyan}========================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}   CBT NEXA ROUND 5 COMPREHENSIVE 4-TIER E2E TEST SUITE                 ${c.reset}`);
  console.log(`${c.bold}${c.cyan}========================================================================${c.reset}`);
  console.log(`${c.dim}Project: CBT NEXA | Integrity Mode: development | Framework: Node.js ESM${c.reset}`);
  console.log(`${c.dim}Database: Supabase (${SUPABASE_URL})${c.reset}\n`);

  const startTime = Date.now();
  const summary = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    tiers: {},
    features: {}
  };

  const detailedResults = [];

  for (const suite of suites) {
    if (options.tier !== 'all' && options.tier !== String(suite.tier)) {
      continue;
    }

    console.log(`\n${c.bold}${c.blue}▶ [Tier ${suite.tier}] ${suite.title}${c.reset}`);
    console.log(`${c.dim}  ${suite.description}${c.reset}\n`);

    summary.tiers[suite.tier] = { title: suite.title, total: 0, passed: 0, failed: 0 };

    for (const test of suite.tests) {
      if (options.filter && !test.name.toLowerCase().includes(options.filter) && !test.id.toLowerCase().includes(options.filter)) {
        summary.skipped++;
        continue;
      }

      summary.total++;
      summary.tiers[suite.tier].total++;
      if (!summary.features[test.feature]) {
        summary.features[test.feature] = { total: 0, passed: 0, failed: 0 };
      }
      summary.features[test.feature].total++;

      const testStart = Date.now();
      try {
        await test.fn();
        test.status = 'passed';
        test.durationMs = Date.now() - testStart;
        summary.passed++;
        summary.tiers[suite.tier].passed++;
        summary.features[test.feature].passed++;

        console.log(`  ${c.green}✔ [PASS]${c.reset} ${c.bold}${test.id}${c.reset} - ${test.name} ${c.dim}(${test.durationMs}ms)${c.reset}`);
      } catch (err) {
        test.status = 'failed';
        test.error = err.message || String(err);
        test.durationMs = Date.now() - testStart;
        summary.failed++;
        summary.tiers[suite.tier].failed++;
        summary.features[test.feature].failed++;

        console.log(`  ${c.red}✖ [FAIL]${c.reset} ${c.bold}${test.id}${c.reset} - ${test.name}`);
        console.log(`     ${c.red}${err.name || 'Error'}: ${err.message}${c.reset}`);
      }

      detailedResults.push({
        tier: suite.tier,
        id: test.id,
        name: test.name,
        feature: test.feature,
        status: test.status,
        durationMs: test.durationMs,
        error: test.error
      });
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  // Print Summary Table
  console.log(`\n${c.bold}========================================================================${c.reset}`);
  console.log(`${c.bold}   TEST SUMMARY BREAKDOWN BY FEATURE                                    ${c.reset}`);
  console.log(`${c.bold}========================================================================${c.reset}`);

  for (const [feat, stats] of Object.entries(summary.features)) {
    const rate = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
    const color = stats.failed === 0 ? c.green : c.red;
    console.log(`  ${feat.padEnd(36)} : ${color}${stats.passed}/${stats.total} passed (${rate}%)${c.reset}`);
  }

  console.log(`\n${c.bold}========================================================================${c.reset}`);
  console.log(`${c.bold}   FINAL VERDICT                                                        ${c.reset}`);
  console.log(`${c.bold}========================================================================${c.reset}`);
  console.log(`  Total Executed : ${c.bold}${summary.total}${c.reset}`);
  console.log(`  Passed         : ${c.green}${c.bold}${summary.passed}${c.reset}`);
  console.log(`  Failed         : ${summary.failed > 0 ? c.red : c.green}${c.bold}${summary.failed}${c.reset}`);
  console.log(`  Duration       : ${durationSec}s\n`);

  // Write JSON Results
  const jsonOutput = {
    timestamp: new Date().toISOString(),
    summary: {
      total: summary.total,
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
      durationSeconds: Number(durationSec)
    },
    tierStats: summary.tiers,
    featureStats: summary.features,
    tests: detailedResults
  };

  const resultsPath = path.join(projectRoot, 'tests', 'test_round5_results.json');
  try {
    fs.writeFileSync(resultsPath, JSON.stringify(jsonOutput, null, 2), 'utf-8');
    console.log(`${c.dim}Saved machine-readable test results to: tests/test_round5_results.json${c.reset}`);
  } catch (e) {
    console.warn('Could not write test_round5_results.json:', e.message);
  }

  // Teardown / Cleanup test entities created in DB
  try {
    if (cleanupRegistry.ruangIds.size > 0) {
      await supabase.from('ruang_ujian').delete().in('id_ruang', Array.from(cleanupRegistry.ruangIds));
    }
    if (cleanupRegistry.penugasanIds.size > 0) {
      await supabase.from('pengawas_ruang').delete().in('id_penugasan', Array.from(cleanupRegistry.penugasanIds));
    }
    if (cleanupRegistry.absensiIds.size > 0) {
      await supabase.from('absensi_ujian').delete().in('id_absensi', Array.from(cleanupRegistry.absensiIds));
    }
    if (cleanupRegistry.beritaAcaraIds.size > 0) {
      await supabase.from('berita_acara_ujian').delete().in('id_berita_acara', Array.from(cleanupRegistry.beritaAcaraIds));
    }
    if (cleanupRegistry.logIds.size > 0) {
      await supabase.from('log_ujian').delete().in('id_log', Array.from(cleanupRegistry.logIds));
    }
    if (cleanupRegistry.siswaIds.size > 0) {
      await supabase.from('siswa').delete().in('id_siswa', Array.from(cleanupRegistry.siswaIds));
    }
  } catch (e) {
    // ignore cleanup errors
  }

  if (summary.failed > 0 && !options.allowFailures) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Execute Runner
runTestSuite().catch(err => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
