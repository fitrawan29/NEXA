import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve(process.cwd(), 'src');
const apiCode = fs.readFileSync(path.join(srcDir, 'api.js'), 'utf8');
const adminCode = fs.readFileSync(path.join(srcDir, 'views/AdminView.jsx'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}\n  ${err.message}`);
    failed++;
  }
}

test('api.js globalRoutes has pruned dead absensi action strings', () => {
  const routesStart = apiCode.indexOf('const globalRoutes = [');
  const routesEnd = apiCode.indexOf('];', routesStart);
  const routesBlock = apiCode.slice(routesStart, routesEnd);

  assert.doesNotMatch(routesBlock, /'simpan_kehadiran_siswa'/, 'simpan_kehadiran_siswa must be pruned');
  assert.doesNotMatch(routesBlock, /'submit_absensi_siswa'/, 'submit_absensi_siswa must be pruned');
  assert.doesNotMatch(routesBlock, /'verifikasi_absensi'/, 'verifikasi_absensi must be pruned');
  assert.doesNotMatch(routesBlock, /'verifikasi_absensi_bulk'/, 'verifikasi_absensi_bulk must be pruned');
});

test('AdminView Siswa Tab filter options are strictly sourced from dataKelas', () => {
  assert.match(adminCode, /dataKelas.*?\.map\(k\s*=>\s*`\$\{k\.tingkat/, 'Siswa class filter must map over dataKelas');
  assert.doesNotMatch(adminCode, /dataSiswa\.map\(s\s*=>\s*s\.kelas\)\.filter\(Boolean\)/, 'Siswa filter must not scrape dataSiswa');
});

test('AdminView Print Kartu modal sources availableClasses from dataKelas and pre-fetches get_kelas', () => {
  const printModalStart = adminCode.indexOf('const renderPrintKartuModal = () => {');
  const printModalBlock = adminCode.slice(printModalStart, printModalStart + 400);
  assert.match(printModalBlock, /dataKelas.*?\.map\(k\s*=>\s*`\$\{k\.tingkat/, 'renderPrintKartuModal must source availableClasses from dataKelas');
  
  const handleOpenPrintStart = adminCode.indexOf('const handleOpenPrintKartu');
  const handleOpenPrintBlock = adminCode.slice(handleOpenPrintStart, adminCode.indexOf('const handleGeneratePrintKartu', handleOpenPrintStart));
  assert.match(handleOpenPrintBlock, /api\('get_kelas'/, 'handleOpenPrintKartu must prefetch get_kelas if dataKelas is empty');
});

test('AdminView openCreateModal & openEditModal pre-fetch get_kelas for type === siswa', () => {
  const createStart = adminCode.indexOf('const openCreateModal');
  const createBlock = adminCode.slice(createStart, adminCode.indexOf('const openEditModal', createStart));
  assert.match(createBlock, /if\s*\(type\s*===\s*'siswa'\)[\s\S]*?get_kelas/, 'openCreateModal must fetch get_kelas for siswa when empty');

  const editStart = adminCode.indexOf('const openEditModal');
  const editBlock = adminCode.slice(editStart, adminCode.indexOf('const handleDownloadTemplate', editStart));
  assert.match(editBlock, /if\s*\(type\s*===\s*'siswa'\)[\s\S]*?get_kelas/, 'openEditModal must fetch get_kelas for siswa when empty');
});

test('AdminView siswa Excel import validates class against dataKelas master map', () => {
  const fileUploadStart = adminCode.indexOf('const handleImportFile');
  const uploadStart = adminCode.indexOf("if (importModal.type === 'siswa')", fileUploadStart);
  const uploadBlock = adminCode.slice(uploadStart, adminCode.indexOf("} else if (importModal.type === 'guru')", uploadStart));
  assert.match(uploadBlock, /get_kelas/, 'Siswa import must ensure dataKelas is loaded');
  assert.match(uploadBlock, /masterClassMap/, 'Siswa import must build master class lookup map');
  assert.match(uploadBlock, /invalidClassRows/, 'Siswa import must track invalid class rows');
  assert.match(uploadBlock, /showMessage\('Validasi Gagal'/, 'Siswa import must block upload on un-mastered classes');
});

test('AdminView jadwal Excel import eliminates mapelList[0] fallback and validates all subjects', () => {
  const fileUploadStart = adminCode.indexOf('const handleImportFile');
  const jadwalUploadStart = adminCode.indexOf("} else if (importModal.type === 'jadwal')", fileUploadStart);
  const jadwalUploadBlock = adminCode.slice(jadwalUploadStart, adminCode.indexOf("} else if (importModal.type === 'mapel')", jadwalUploadStart));
  assert.doesNotMatch(jadwalUploadBlock, /mapelList\[0\]\?\.id_mapel/, 'Unsafe mapelList[0] fallback must be eliminated');
  assert.match(jadwalUploadBlock, /const\s+matchedMapel\s*=\s*mapelQuery\s*\?/, 'matchedMapel must be guarded against empty mapelQuery');
  assert.match(jadwalUploadBlock, /unassignedMapelRows/, 'Jadwal import must track unassigned subject rows');
  assert.match(jadwalUploadBlock, /showMessage\('Validasi Gagal'/, 'Jadwal import must reject unmatched subjects');
});

test('AdminView proctoring HUD availableMonitoringClasses is sourced from dataKelas', () => {
  const monitorStart = adminCode.indexOf('const availableMonitoringClasses = useMemo');
  const monitorBlock = adminCode.slice(monitorStart, adminCode.indexOf('const [autoUsername', monitorStart));
  assert.match(monitorBlock, /dataKelas.*?\.map\(k|dataKelas.*?\.forEach\(k/, 'availableMonitoringClasses must iterate over dataKelas');
  assert.match(monitorBlock, /\[dataKelas\]/, 'availableMonitoringClasses must depend on dataKelas');
});

console.log(`\nSummary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
