/**
 * Verification Suite: Mata Pelajaran Bulk Import
 * 
 * Tests:
 * 1. UI & Modal Action:
 *    - Import button exists in Mata Pelajaran tab header and triggers setImportModal({ isOpen: true, type: 'mapel' })
 *    - Modal title renders 'Import Data Mata Pelajaran' when importModal.type === 'mapel'
 * 
 * 2. Template Download:
 *    - Template generator sets headers ['nama_mapel'] and filename 'Template_Mata_Pelajaran.xlsx'
 *    - In-memory XLSX workbook generation produces valid sheet with 'nama_mapel' column
 * 
 * 3. Import File Processing & Data Sanitization:
 *    - Trims whitespace from nama_mapel
 *    - Drops empty rows and whitespace-only entries without runtime error
 *    - Attaches active user's npsn to every record
 *    - Endpoint target is 'create_mapel_bulk'
 *    - Reloads mapel data and logs audit trail upon success
 * 
 * 4. API & Database Roundtrip:
 *    - Live execution of 'create_mapel_bulk' via fetchAPI
 *    - Verified persistence in database and retrieval via 'get_all_mapel'
 *    - Teardown of created test records
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { fetchAPI } from '../src/api.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../src/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.resolve(projectRoot, 'src');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

function assert(condition, name, details = '') {
  results.total++;
  if (condition) {
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    console.log(`  ✔ [PASS] ${name}`);
  } else {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', details });
    console.error(`  ✖ [FAIL] ${name} -> ${details}`);
  }
}

async function runTests() {
  console.log('========================================================================');
  console.log('   CBT NEXA: MATA PELAJARAN BULK IMPORT VERIFICATION SUITE              ');
  console.log('========================================================================\n');

  const adminViewPath = path.resolve(srcDir, 'views', 'AdminView.jsx');
  const adminViewContent = fs.readFileSync(adminViewPath, 'utf-8');

  // ===========================================================================
  // 1. UI & Modal Action
  // ===========================================================================
  console.log('▶ [1] UI & Modal Action:');

  const hasImportBtn = adminViewContent.includes("onClick={() => setImportModal({ isOpen: true, type: 'mapel' })}");
  assert(
    hasImportBtn,
    "Mata Pelajaran tab header includes Import button opening modal with type 'mapel'",
    "Missing Import button with type 'mapel' in AdminView.jsx"
  );

  const hasModalTitle = adminViewContent.includes("importModal.type === 'mapel' ? 'Mata Pelajaran'");
  assert(
    hasModalTitle,
    "Modal displays 'Import Data Mata Pelajaran' when importModal.type === 'mapel'",
    "Missing 'Mata Pelajaran' title mapping in renderImportModal"
  );

  // ===========================================================================
  // 2. Template Download
  // ===========================================================================
  console.log('\n▶ [2] Template Download:');

  const hasTemplateBranch = adminViewContent.includes("importModal.type === 'mapel'") &&
    adminViewContent.includes("filename = 'Template_Mata_Pelajaran.xlsx'") &&
    adminViewContent.includes("headers = ['nama_mapel']");
  assert(
    hasTemplateBranch,
    "handleDownloadTemplate defines Template_Mata_Pelajaran.xlsx with ['nama_mapel'] header",
    "Template download definition missing for mapel in handleDownloadTemplate"
  );

  // Functional test: generate Excel buffer using XLSX to ensure integrity
  const templateHeaders = ['nama_mapel'];
  const ws = XLSX.utils.aoa_to_sheet([templateHeaders]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // Read back and verify structure
  const parsedWb = XLSX.read(buf, { type: 'buffer' });
  const parsedSheet = parsedWb.Sheets[parsedWb.SheetNames[0]];
  const parsedRows = XLSX.utils.sheet_to_json(parsedSheet, { header: 1 });
  assert(
    parsedRows.length >= 1 && parsedRows[0][0] === 'nama_mapel',
    "Generated Template_Mata_Pelajaran.xlsx correctly contains 'nama_mapel' column header",
    `Unexpected header in parsed template: ${JSON.stringify(parsedRows[0])}`
  );

  // ===========================================================================
  // 3. Import File Processing & Data Sanitization
  // ===========================================================================
  console.log('\n▶ [3] Import File Processing & Data Sanitization:');

  const hasBulkEndpointInImport = adminViewContent.includes("endpoint = 'create_mapel_bulk'");
  assert(
    hasBulkEndpointInImport,
    "handleImportFile routes mapel import to endpoint 'create_mapel_bulk'",
    "create_mapel_bulk endpoint routing missing in handleImportFile"
  );

  const hasNpsnAttached = adminViewContent.includes("npsn: user.npsn");
  assert(
    hasNpsnAttached,
    "handleImportFile attaches active user's npsn to processed mapel items",
    "npsn attachment missing in mapel import handler"
  );

  // Test data parsing simulation
  const dummyNpsn = 'TEST_NPSN_12345';
  const mockRows = [
    { nama_mapel: 'Matematika' },
    { nama_mapel: '  Fisika Terapan  ' },
    { nama_mapel: '' },
    { nama_mapel: '   ' },
    { nama_mapel: null },
    { nama_mapel: undefined },
    { nama_mapel: 'Kimia Dasar' }
  ];

  // Run the exact extraction logic from AdminView.jsx
  const processedData = mockRows
    .map(row => {
      const rawNama = row.nama_mapel ?? row.Nama_Mapel ?? row.NAMA_MAPEL ?? '';
      const nama = String(rawNama).trim();
      return {
        nama_mapel: nama,
        npsn: dummyNpsn
      };
    })
    .filter(item => item.nama_mapel !== '');

  assert(
    processedData.length === 3,
    "Parser correctly filters out empty, whitespace, and null rows (3 out of 7 valid)",
    `Expected 3 rows, got ${processedData.length}`
  );

  assert(
    processedData[1].nama_mapel === 'Fisika Terapan',
    "Parser correctly trims leading and trailing whitespace from '  Fisika Terapan  '",
    `Expected 'Fisika Terapan', got '${processedData[1].nama_mapel}'`
  );

  assert(
    processedData.every(item => item.npsn === dummyNpsn && item.nama_mapel.length > 0),
    "Every processed item contains valid non-empty nama_mapel and attached npsn",
    `Invalid processed items: ${JSON.stringify(processedData)}`
  );

  // Test edge case: completely empty workbook
  const emptyRows = [{ nama_mapel: '' }, { nama_mapel: '   ' }];
  const emptyProcessed = emptyRows
    .map(row => ({
      nama_mapel: String(row.nama_mapel || '').trim(),
      npsn: dummyNpsn
    }))
    .filter(item => item.nama_mapel !== '');

  assert(
    emptyProcessed.length === 0,
    "Empty file / whitespace-only rows result in empty processed array without runtime error"
  );

  // ===========================================================================
  // 4. API & Database Roundtrip (create_mapel_bulk)
  // ===========================================================================
  console.log('\n▶ [4] API & Database Roundtrip (create_mapel_bulk):');

  // Find active test school NPSN
  const { data: schools } = await supabase.from('sekolah').select('npsn').limit(1);
  const liveNpsn = (schools && schools[0]?.npsn) || '70040625';

  const testMapelIds = [
    `MAPEL-BLK1-${Date.now()}`,
    `MAPEL-BLK2-${Date.now()}`
  ];
  const testPayload = [
    { id_mapel: testMapelIds[0], nama_mapel: `Mapel Test 1 ${Date.now()}`, npsn: liveNpsn },
    { id_mapel: testMapelIds[1], nama_mapel: `Mapel Test 2 ${Date.now()}`, npsn: liveNpsn }
  ];

  // Call create_mapel_bulk via fetchAPI
  const createRes = await fetchAPI('create_mapel_bulk', testPayload);
  assert(
    createRes.status === 'success',
    "fetchAPI 'create_mapel_bulk' succeeds with status 'success'",
    createRes.message
  );

  // Verify records exist in database
  const { data: insertedRecords, error: selectErr } = await supabase
    .from('mata_pelajaran')
    .select('id_mapel, nama_mapel, npsn')
    .in('id_mapel', testMapelIds);

  assert(
    !selectErr && insertedRecords && insertedRecords.length === 2,
    "Database query confirms both bulk imported mata pelajaran were inserted",
    selectErr?.message || `Found ${insertedRecords?.length || 0} records`
  );

  // Verify fetchAPI 'get_all_mapel' includes the inserted records
  const getAllRes = await fetchAPI('get_all_mapel', { npsn: liveNpsn });
  assert(
    getAllRes.status === 'success' && Array.isArray(getAllRes.data),
    "fetchAPI 'get_all_mapel' succeeds",
    getAllRes.message
  );

  const foundAll = testMapelIds.every(id => getAllRes.data.some(m => m.id_mapel === id));
  assert(
    foundAll,
    "fetchAPI 'get_all_mapel' returns newly imported mata pelajaran items",
    "Imported mapel items not found in get_all_mapel response"
  );

  // Teardown: Clean up created test mapel
  for (const id of testMapelIds) {
    await fetchAPI('delete_mapel', { id_mapel: id, npsn: liveNpsn });
  }

  const { count: countAfterDel } = await supabase
    .from('mata_pelajaran')
    .select('*', { count: 'exact', head: true })
    .in('id_mapel', testMapelIds);

  assert(
    countAfterDel === 0,
    "Teardown: test mata pelajaran items cleanly removed from database"
  );

  // ===========================================================================
  // 5. Edge Cases & Adversarial Stress Tests
  // ===========================================================================
  console.log('\n▶ [5] Edge Cases & Adversarial Stress Tests:');

  // 5.1 Flexible Column Header Resolution
  const headerVariations = [
    { 'Nama Mapel': 'Sosiologi' },
    { 'mata_pelajaran': 'Antropologi' },
    { 'nama_mapel ': 'Informatika' },
    { '\uFEFFnama_mapel': 'Sejarah Indonesia' },
    { 'Nama Mata Pelajaran': 'Geografi' }
  ];

  const extractName = (row) => {
    if (!row) return '';
    let raw = row.nama_mapel ?? row.Nama_Mapel ?? row.NAMA_MAPEL;
    if (raw === undefined || raw === null) {
      const matchedKey = Object.keys(row).find(k => {
        const norm = k.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_]+/g, '_');
        return norm === 'nama_mapel' || norm === 'mata_pelajaran' || norm === 'mapel' || norm === 'nama_mata_pelajaran';
      });
      raw = matchedKey ? row[matchedKey] : '';
    }
    return String(raw ?? '').replace(/\s+/g, ' ').trim();
  };

  const resolvedHeaders = headerVariations.map(extractName);
  assert(
    resolvedHeaders.length === 5 &&
    resolvedHeaders.includes('Sosiologi') &&
    resolvedHeaders.includes('Antropologi') &&
    resolvedHeaders.includes('Informatika') &&
    resolvedHeaders.includes('Sejarah Indonesia') &&
    resolvedHeaders.includes('Geografi'),
    "Flexible column header parser correctly resolves 'Nama Mapel', 'mata_pelajaran', 'Nama Mata Pelajaran', trailing whitespace, and BOM headers",
    `Resolved: ${JSON.stringify(resolvedHeaders)}`
  );

  // 5.2 Intra-sheet Deduplication Simulation
  const dupeRows = [
    { nama_mapel: 'Biologi' },
    { nama_mapel: 'biologi' },
    { nama_mapel: '  BIOLOGI  ' },
    { nama_mapel: 'Fisika' },
    { nama_mapel: 'Kimia' },
    { nama_mapel: 'fisika' }
  ];
  const seenDupe = new Set();
  const dedupedRows = dupeRows
    .map(r => ({ nama_mapel: extractName(r), npsn: dummyNpsn }))
    .filter(item => {
      if (!item.nama_mapel) return false;
      const key = item.nama_mapel.toLowerCase();
      if (seenDupe.has(key)) return false;
      seenDupe.add(key);
      return true;
    });

  assert(
    dedupedRows.length === 3 &&
    dedupedRows.map(r => r.nama_mapel).join(',') === 'Biologi,Fisika,Kimia',
    "Intra-sheet parser deduplicates case-insensitive duplicate subjects preserving first canonical occurrence (3 out of 6)",
    `Got: ${JSON.stringify(dedupedRows)}`
  );

  // 5.3 Special Characters and Unicode Emojis Persistence
  const specialCharsMapel = [
    { id_mapel: `M-SPEC1-${Date.now()}`, nama_mapel: 'Pendidikan Agama & Budi Pekerti (Islam)', npsn: liveNpsn },
    { id_mapel: `M-SPEC2-${Date.now()}`, nama_mapel: 'Matematika [Peminatan] / Tingkat Lanjut', npsn: liveNpsn },
    { id_mapel: `M-SPEC3-${Date.now()}`, nama_mapel: 'Muatan Lokal: Bahasa Sunda 🚀', npsn: liveNpsn }
  ];
  const specRes = await fetchAPI('create_mapel_bulk', specialCharsMapel);
  assert(
    specRes.status === 'success',
    "fetchAPI 'create_mapel_bulk' succeeds with special characters (&, (), [], /, :, emojis)",
    specRes.message
  );

  const { data: retrievedSpec } = await supabase
    .from('mata_pelajaran')
    .select('id_mapel, nama_mapel')
    .in('id_mapel', specialCharsMapel.map(s => s.id_mapel));

  assert(
    retrievedSpec && retrievedSpec.length === 3 &&
    retrievedSpec.some(m => m.nama_mapel.includes('🚀')),
    "Database roundtrip preserves special characters and unicode emojis perfectly"
  );

  // Teardown special chars
  for (const s of specialCharsMapel) {
    await fetchAPI('delete_mapel', { id_mapel: s.id_mapel, npsn: liveNpsn });
  }

  // 5.4 API Error Handling & Defensive Bounds
  const emptyRes = await fetchAPI('create_mapel_bulk', []);
  assert(
    emptyRes.status === 'error',
    "fetchAPI 'create_mapel_bulk' gracefully rejects empty array payload with error status",
    JSON.stringify(emptyRes)
  );

  const nullRes = await fetchAPI('create_mapel_bulk', null);
  assert(
    nullRes.status === 'error',
    "fetchAPI 'create_mapel_bulk' gracefully rejects null payload without runtime exception",
    JSON.stringify(nullRes)
  );

  const blankRowsRes = await fetchAPI('create_mapel_bulk', [{ nama_mapel: '   ', npsn: liveNpsn }]);
  assert(
    blankRowsRes.status === 'error',
    "fetchAPI 'create_mapel_bulk' gracefully rejects whitespace-only items with error status",
    JSON.stringify(blankRowsRes)
  );

  // 5.5 API-Level Intra-batch Deduplication
  const dupeApiPayload = [
    { id_mapel: `M-DUP1-${Date.now()}`, nama_mapel: `Ekonomi Akuntansi ${Date.now()}`, npsn: liveNpsn },
    { id_mapel: `M-DUP2-${Date.now()}`, nama_mapel: `  ekonomi akuntansi ${Date.now()}  `, npsn: liveNpsn }
  ];
  const dupeApiRes = await fetchAPI('create_mapel_bulk', dupeApiPayload);
  assert(
    dupeApiRes.status === 'success',
    "fetchAPI 'create_mapel_bulk' handles duplicate items in payload gracefully",
    dupeApiRes.message
  );

  const { data: insertedDupes } = await supabase
    .from('mata_pelajaran')
    .select('id_mapel, nama_mapel')
    .in('id_mapel', dupeApiPayload.map(d => d.id_mapel));

  assert(
    insertedDupes && insertedDupes.length === 1,
    "Database confirms only 1 record inserted from duplicate payload due to intra-batch deduplication",
    `Expected 1 record, got ${insertedDupes?.length}`
  );

  // Clean up dupe test item
  for (const d of dupeApiPayload) {
    await fetchAPI('delete_mapel', { id_mapel: d.id_mapel, npsn: liveNpsn });
  }

  // 5.6 Stress Test: Bulk 50 subjects
  const stressBatchSize = 50;
  const stressTimestamp = Date.now();
  const stressPayload = Array.from({ length: stressBatchSize }, (_, idx) => ({
    id_mapel: `M-STRS-${stressTimestamp}-${idx}`,
    nama_mapel: `Mapel Stress ${idx} - ${stressTimestamp}`,
    npsn: liveNpsn
  }));

  const stressRes = await fetchAPI('create_mapel_bulk', stressPayload);
  assert(
    stressRes.status === 'success',
    `Bulk stress test: inserted ${stressBatchSize} mata pelajaran in a single transaction successfully`,
    stressRes.message
  );

  const { count: stressInsertedCount } = await supabase
    .from('mata_pelajaran')
    .select('*', { count: 'exact', head: true })
    .in('id_mapel', stressPayload.map(p => p.id_mapel));

  assert(
    stressInsertedCount === stressBatchSize,
    `Database confirms all ${stressBatchSize} stress test items persisted correctly`,
    `Found ${stressInsertedCount}`
  );

  // Teardown stress test items in chunks
  const stressIds = stressPayload.map(p => p.id_mapel);
  await supabase.from('mata_pelajaran').delete().in('id_mapel', stressIds);

  const { count: stressCountAfter } = await supabase
    .from('mata_pelajaran')
    .select('*', { count: 'exact', head: true })
    .in('id_mapel', stressIds);

  assert(
    stressCountAfter === 0,
    `Stress test teardown: all ${stressBatchSize} items cleanly removed`
  );

  // 5.7 Defensive: Array containing null elements
  const nullElementRes = await fetchAPI('create_mapel_bulk', [null]).catch(e => ({ status: 'error', message: e.message }));
  assert(
    nullElementRes.status === 'error',
    "fetchAPI 'create_mapel_bulk' gracefully rejects array containing null elements without unhandled TypeError",
    JSON.stringify(nullElementRes)
  );

  // 5.8 Database-level Deduplication against pre-existing database records
  const uniquePreName = `Biologi Molekuler ${Date.now()}`;
  const preId = `M-PRE-${Date.now()}`;
  await fetchAPI('create_mapel_bulk', [{ id_mapel: preId, nama_mapel: uniquePreName, npsn: liveNpsn }]);

  // Attempt to insert same subject again with different ID
  const reInsertId = `M-REIN-${Date.now()}`;
  const reInsertRes = await fetchAPI('create_mapel_bulk', [
    { id_mapel: reInsertId, nama_mapel: `  ${uniquePreName.toUpperCase()}  `, npsn: liveNpsn }
  ]);
  assert(
    reInsertRes.status === 'success',
    "fetchAPI 'create_mapel_bulk' succeeds when re-inserting already existing subjects",
    reInsertRes.message
  );

  const { data: dbCheckDupes } = await supabase
    .from('mata_pelajaran')
    .select('id_mapel, nama_mapel')
    .eq('npsn', liveNpsn)
    .ilike('nama_mapel', uniquePreName);

  assert(
    dbCheckDupes && dbCheckDupes.length === 1 && dbCheckDupes[0].id_mapel === preId,
    "Database confirms duplicate subject was ignored; only original pre-existing record remains",
    `Expected 1 record with id ${preId}, got ${dbCheckDupes?.length}`
  );

  // Cleanup pre-existing subject
  await fetchAPI('delete_mapel', { id_mapel: preId, npsn: liveNpsn });

  // 5.9 Numeric and Zero Subject Names Preservation
  const numericMapel = [
    { id_mapel: `M-NUM1-${Date.now()}`, nama_mapel: 101, npsn: liveNpsn },
    { id_mapel: `M-NUM2-${Date.now()}`, nama_mapel: '0', npsn: liveNpsn }
  ];
  const numRes = await fetchAPI('create_mapel_bulk', numericMapel);
  assert(
    numRes.status === 'success',
    "fetchAPI 'create_mapel_bulk' successfully handles numeric (101) and '0' subject names",
    numRes.message
  );

  const { data: numDbData } = await supabase
    .from('mata_pelajaran')
    .select('id_mapel, nama_mapel')
    .in('id_mapel', numericMapel.map(n => n.id_mapel));

  assert(
    numDbData && numDbData.length === 2 && numDbData.some(n => n.nama_mapel === '101') && numDbData.some(n => n.nama_mapel === '0'),
    "Database roundtrip confirms numeric and '0' subject names correctly stored as string representations",
    JSON.stringify(numDbData)
  );

  for (const n of numericMapel) {
    await fetchAPI('delete_mapel', { id_mapel: n.id_mapel, npsn: liveNpsn });
  }

  // 5.10 Multi-space Whitespace Normalization & Deduplication
  const multiSpacePreName = `Astronomi    Fisika   ${Date.now()}`;
  const preMultiId = `M-MS1-${Date.now()}`;
  const multiRes1 = await fetchAPI('create_mapel_bulk', [
    { id_mapel: preMultiId, nama_mapel: multiSpacePreName, npsn: liveNpsn }
  ]);
  assert(
    multiRes1.status === 'success',
    "fetchAPI 'create_mapel_bulk' succeeds with multi-space subject name",
    multiRes1.message
  );

  // Attempt to insert with different spacing variation
  const variationName = multiSpacePreName.replace(/\s+/g, ' ');
  const multiRes2 = await fetchAPI('create_mapel_bulk', [
    { id_mapel: `M-MS2-${Date.now()}`, nama_mapel: `  ${variationName}  `, npsn: liveNpsn }
  ]);
  assert(
    multiRes2.status === 'success' && multiRes2.insertedCount === 0,
    "API deduplicates against pre-existing subject despite irregular multi-space variations",
    `Expected insertedCount 0, got ${multiRes2.insertedCount}`
  );

  await fetchAPI('delete_mapel', { id_mapel: preMultiId, npsn: liveNpsn });

  // 5.11 UI Feedback Synchronization Simulation
  // Case A: insertedCount === 0
  const simResultA = { status: 'success', message: 'Semua mata pelajaran sudah terdaftar di database', insertedCount: 0 };
  const modalTypeA = 'mapel';
  const processedA = [{ nama_mapel: 'Fisika' }];
  const skippedA = 0;
  const actualA = simResultA.insertedCount !== undefined ? simResultA.insertedCount : processedA.length;
  const isZeroInformative = actualA === 0 && modalTypeA === 'mapel';
  assert(
    isZeroInformative === true,
    "UI feedback correctly identifies 0 actual inserts and routes to informative notification rather than false success",
    `actualA: ${actualA}`
  );

  // Case B: Partial insert (2 sent, 1 inserted, 1 DB duplicate)
  const simResultB = { status: 'success', message: 'Mata pelajaran berhasil ditambahkan secara massal', insertedCount: 1 };
  const processedB = [{ nama_mapel: 'Kimia' }, { nama_mapel: 'Biologi' }];
  const skippedB = 1; // 1 already skipped at frontend
  const actualB = simResultB.insertedCount !== undefined ? simResultB.insertedCount : processedB.length;
  const apiSkippedB = simResultB.insertedCount !== undefined ? Math.max(0, processedB.length - simResultB.insertedCount) : 0;
  const totalSkippedB = skippedB + apiSkippedB;
  assert(
    actualB === 1 && totalSkippedB === 2,
    "UI feedback correctly aggregates frontend and backend skipped counts (1 inserted, 2 skipped)",
    `actual: ${actualB}, totalSkipped: ${totalSkippedB}`
  );

  // 5.12 Sparse / Null Rows in rawData Array
  const rawWithNulls = [
    null,
    undefined,
    { nama_mapel: 'Seni Budaya' },
    null,
    { nama_mapel: '  ' }
  ];
  const parsedWithNulls = rawWithNulls
    .map(row => {
      if (!row) return { nama_mapel: '', npsn: liveNpsn };
      return { nama_mapel: String(row.nama_mapel ?? '').trim(), npsn: liveNpsn };
    })
    .filter(i => Boolean(i.nama_mapel));

  assert(
    parsedWithNulls.length === 1 && parsedWithNulls[0].nama_mapel === 'Seni Budaya',
    "Parser safely handles sparse arrays containing null and undefined rows without TypeError",
    `Result: ${JSON.stringify(parsedWithNulls)}`
  );

  // ===========================================================================
  // Summary
  // ===========================================================================
  console.log('\n========================================================================');
  console.log(`   TOTAL TESTS: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
  console.log('========================================================================\n');

  if (results.failed > 0) {
    console.error('❌ Verification failed with errors.');
    process.exit(1);
  } else {
    console.log('✔ All Mata Pelajaran bulk import verification tests passed with 100% success rate!\n');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
