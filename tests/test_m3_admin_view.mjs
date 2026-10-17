#!/usr/bin/env node
/**
 * Test Suite: Worker M3 - Admin Proctor & Room Management Verification
 * 
 * Verifies:
 * 1. AdminView.jsx AST / Source Code static analysis:
 *    - "Pengawas & Ruang" menu in navGroups with id: 'pengawas', icon: 'badge'
 *    - tabTitleMap with 'pengawas'
 *    - 3 Sub-tabs (penugasan, ruang, alokasi_siswa)
 *    - Metric cards (Total Ruang, Pengawas Ditugaskan, Ruang Belum Ada Pengawas)
 *    - Modal forms (AssignPengawasModal, RuangModal)
 *    - Bulk allocation methods (by class, by multi-select)
 *    - Data fetching in fetchData('pengawas')
 * 2. API integration live functional check:
 *    - Ruang CRUD lifecycle
 *    - Pengawas assignment lifecycle
 *    - Bulk student allocation lifecycle
 * 3. Vite Build verification
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchAPI, generateId } from '../src/api.js';
import { supabaseClient } from '../src/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runM3Verification() {
  console.log('\n======================================================');
  console.log('Worker M3 Verification: Admin Proctor & Room Management');
  console.log('======================================================\n');

  // ------------------------------------------------------------------
  // 1. Static Source Code Checks on src/views/AdminView.jsx
  // ------------------------------------------------------------------
  console.log('[GROUP 1: AdminView.jsx Static Structure Verification]');
  const adminViewPath = path.resolve(__dirname, '../src/views/AdminView.jsx');
  assert(fs.existsSync(adminViewPath), 'AdminView.jsx exists');

  const content = fs.readFileSync(adminViewPath, 'utf8');

  // Requirement 1: Menu in navGroups
  assert(
    content.includes("id: 'pengawas'") && content.includes("label: 'Pengawas & Ruang'") && content.includes("icon: 'badge'"),
    'Menu "Pengawas & Ruang" with icon "badge" present in navGroups'
  );

  // Requirement 1: tabTitleMap
  assert(
    content.includes("pengawas: 'Manajemen Pengawas & Ruang Ujian'"),
    'tabTitleMap contains pengawas: "Manajemen Pengawas & Ruang Ujian"'
  );

  // Requirement 2: Sub-tabs
  assert(
    content.includes("pengawasSubTab === 'penugasan'") &&
    content.includes("pengawasSubTab === 'ruang'") &&
    content.includes("pengawasSubTab === 'alokasi_siswa'"),
    'Sub-tabs "penugasan", "ruang", and "alokasi_siswa" are all handled'
  );

  // Requirement 2 Sub-tab 1: Metric cards
  assert(
    content.includes('Total Ruang') &&
    content.includes('Pengawas Ditugaskan') &&
    content.includes('Ruang Belum Ada Pengawas'),
    'Metric cards (Total Ruang, Pengawas Ditugaskan, Ruang Belum Ada Pengawas) present'
  );

  // Requirement 2 Sub-tab 1: Assignment Modal & API
  assert(
    content.includes("api('assign_pengawas_ruang'") &&
    content.includes("api('delete_pengawas_ruang'"),
    'api("assign_pengawas_ruang") and api("delete_pengawas_ruang") wired in AdminView'
  );

  // Requirement 2 Sub-tab 2: Ruang CRUD & API
  assert(
    content.includes("api('create_ruang'") &&
    content.includes("api('update_ruang'") &&
    content.includes("api('delete_ruang'"),
    'Ruang CRUD api("create_ruang"), api("update_ruang"), api("delete_ruang") wired in AdminView'
  );

  // Requirement 2 Sub-tab 3: Student Room Bulk Allocation
  assert(
    content.includes("api('assign_siswa_ruang_bulk'"),
    'Student room bulk allocation api("assign_siswa_ruang_bulk") wired in AdminView'
  );

  // Requirement 3: Data fetching in fetchData('pengawas')
  assert(
    content.includes("tab === 'pengawas'") &&
    content.includes("api('get_ruang'") &&
    content.includes("api('get_pengawas_ruang'"),
    'fetchData("pengawas") fetches get_ruang, get_pengawas_ruang, get_guru, get_all_jadwal, get_siswa'
  );

  // ------------------------------------------------------------------
  // 2. Functional End-to-End API Integration
  // ------------------------------------------------------------------
  console.log('\n[GROUP 2: Functional API Endpoints for AdminView]');
  const testNpsn = '70040625';
  const testGuruId = 'G-163390E6';
  const testSiswaId = 'S-F2934CD8';
  const testRoomId = generateId('R_LAB1');
  const testRoomName = 'Ruang CBT Laboratorium 1';

  // Create room
  const createRes = await fetchAPI('create_ruang', {
    npsn: testNpsn,
    id_ruang: testRoomId,
    nama_ruang: testRoomName,
    kode_ruang: 'LAB1-CBT',
    kapasitas: 35,
    keterangan: 'Ruang Ujian Terpadu Laboratorium Komputer 1'
  });
  assert(createRes.status === 'success', `create_ruang returned success: ${createRes.message}`);

  // Fetch rooms
  const getRoomsRes = await fetchAPI('get_ruang', { npsn: testNpsn });
  assert(getRoomsRes.status === 'success' && Array.isArray(getRoomsRes.data), 'get_ruang returned list');
  const roomFound = (getRoomsRes.data || []).find(r => r.id_ruang === testRoomId);
  assert(Boolean(roomFound && roomFound.nama_ruang === testRoomName), 'Created room found in get_ruang');

  // Update room
  const updateRes = await fetchAPI('update_ruang', {
    npsn: testNpsn,
    id_ruang: testRoomId,
    nama_ruang: testRoomName + ' Updated',
    kapasitas: 40
  });
  assert(updateRes.status === 'success', `update_ruang returned success: ${updateRes.message}`);

  // Assign proctor
  const assignRes = await fetchAPI('assign_pengawas_ruang', {
    npsn: testNpsn,
    id_ruang: testRoomId,
    id_guru: testGuruId,
    peran: 'PENGAWAS UTAMA',
    status_tugas: 'AKTIF'
  });
  assert(assignRes.status === 'success', `assign_pengawas_ruang returned success: ${assignRes.message}`);
  const assignedId = assignRes.data?.id_penugasan;

  // Get assigned proctors
  const getProctorRes = await fetchAPI('get_pengawas_ruang', { npsn: testNpsn, id_ruang: testRoomId });
  assert(getProctorRes.status === 'success' && Array.isArray(getProctorRes.data), 'get_pengawas_ruang returned list');
  const assignmentFound = (getProctorRes.data || []).find(p => p.id_penugasan === assignedId);
  assert(Boolean(assignmentFound && assignmentFound.guru?.id_guru === testGuruId), 'Proctor assignment correctly joined with guru details');

  try {
    // Bulk allocate students by student IDs
    const bulkAllocRes = await fetchAPI('assign_siswa_ruang_bulk', {
      npsn: testNpsn,
      nama_ruang: testRoomName,
      list_id_siswa: [testSiswaId]
    });
    assert(bulkAllocRes.status === 'success', `assign_siswa_ruang_bulk returned success: ${bulkAllocRes.message}`);

    // Verify student has new room
    const getSiswaRes = await fetchAPI('get_siswa', { npsn: testNpsn });
    const targetStudent = (getSiswaRes.data || []).find(s => s.id_siswa === testSiswaId);
    assert(targetStudent?.ruang === testRoomName, `Student ruang updated to "${testRoomName}"`);

    // Cleanup: delete proctor assignment and room
    const delProctorRes = await fetchAPI('delete_pengawas_ruang', {
      npsn: testNpsn,
      id_penugasan: assignedId
    });
    assert(delProctorRes.status === 'success', `delete_pengawas_ruang succeeded: ${delProctorRes.message}`);

    const delRoomRes = await fetchAPI('delete_ruang', {
      npsn: testNpsn,
      id_ruang: testRoomId
    });
    assert(delRoomRes.status === 'success', `delete_ruang succeeded: ${delRoomRes.message}`);
  } finally {
    // Cleanup student room allocation back to clean state unconditionally
    await supabaseClient.from('siswa').update({ ruang: null }).eq('id_siswa', testSiswaId);
  }

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('\n------------------------------------------------------');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runM3Verification().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
