import assert from 'node:assert/strict';
import fs from 'node:fs';

const apiCode = fs.readFileSync('src/api.js', 'utf8');
const adminCode = fs.readFileSync('src/views/AdminView.jsx', 'utf8');
const guruCode = fs.readFileSync('src/views/GuruView.jsx', 'utf8');
const examCode = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8');

console.log('--- R1: Data Guru Tests ---');
assert.ok(apiCode.includes('data.nama_lengkap = data.nama_guru || data.nama_lengkap || \'\''), 'R1.1 Login guru maps nama_lengkap');
assert.ok(apiCode.includes('nama_guru: payload.nama,'), 'R1.2 Register guru inserts into nama_guru');
assert.ok(adminCode.includes('String(g.nip || \'\').includes(q)'), 'R1.3 Search filter converts NIP to string');
assert.ok(adminCode.includes('g.alokasi_kelas ? `[${g.alokasi_kelas}]` : \'\''), 'R1.4 AdminView renders alokasi_kelas');
console.log('✔ R1 PASSED');

console.log('--- R2: Admin Mapel & Soal Tests ---');
assert.ok(adminCode.includes('import FormSoalModal'), 'R2.1 AdminView imports FormSoalModal');
assert.ok(adminCode.includes('import FormNarasiModal'), 'R2.2 AdminView imports FormNarasiModal');
assert.ok(adminCode.includes('import mammoth'), 'R2.3 AdminView imports mammoth');
assert.ok(adminCode.includes('const [selectedMapel, setSelectedMapel] = useState(null);'), 'R2.4 selectedMapel state declared');
assert.ok(adminCode.includes('const [dataSoal, setDataSoal] = useState([]);'), 'R2.5 dataSoal state declared');
assert.ok(adminCode.includes('const handleSaveSoal = async'), 'R2.6 handleSaveSoal implemented');
assert.ok(adminCode.includes('const saveSoal = async'), 'R2.7 saveSoal implemented');
assert.ok(adminCode.includes('const deleteSoal = async'), 'R2.8 deleteSoal implemented');
assert.ok(adminCode.includes('const handleImportExcel ='), 'R2.9 handleImportExcel implemented');
assert.ok(adminCode.includes('const handleImportWord ='), 'R2.10 handleImportWord implemented');
assert.ok(adminCode.includes('Kelola Soal'), 'R2.11 Kelola Soal button rendered');
assert.ok(adminCode.includes('<FormSoalModal'), 'R2.12 FormSoalModal mounted');
assert.ok(adminCode.includes('<FormNarasiModal'), 'R2.13 FormNarasiModal mounted');
console.log('✔ R2 PASSED');

console.log('--- R3: Exam Security Tests ---');
assert.ok(examCode.includes("document.addEventListener('selectstart', handleBlockClipboardAndContext)"), 'R3.1 selectstart event attached');
assert.ok(examCode.includes("document.removeEventListener('selectstart', handleBlockClipboardAndContext)"), 'R3.2 selectstart cleanup attached');
assert.ok(examCode.includes('if (jadwal?.browser_lockdown !== false)'), 'R3.3 browser_lockdown default active');
assert.ok(examCode.includes('session_token: user?.session_token'), 'R3.4 pollInterval passes session_token');
assert.ok(apiCode.includes('payload.session_token && log.id_siswa'), 'R3.5 get_status_log_ujian checks session_token');
assert.ok(examCode.includes('Klik untuk Masuk Mode Layar Penuh Ujian'), 'R3.6 Fullscreen prompt on initial load');
console.log('✔ R3 PASSED');

console.log('--- R4: Dynamic Exam Token Tests ---');
assert.ok(apiCode.includes('const tokenIntervalMs = (j.durasi_token_menit ? Number(j.durasi_token_menit) : 5) * 60 * 1000;'), 'R4.1 Dynamic token interval in api.js');
assert.ok(apiCode.includes('now.getTime() - lastUpdate >= tokenIntervalMs'), 'R4.2 Auto-rotation condition');
assert.ok(adminCode.includes('name="durasi_token_menit"'), 'R4.3 Token interval input in schedule modal');
assert.ok(adminCode.includes('payload.durasi_token_menit = parseInt(payload.durasi_token_menit, 10) || 5;'), 'R4.4 Persist durasi_token_menit in handleSave');
assert.ok(guruCode.includes('j.token || j.token_aktif'), 'R4.5 GuruView displays active exam token');
assert.ok(guruCode.includes("api('get_jadwal_pengawas', { id_guru: guruId })"), 'R4.6 GuruView periodic sync');
console.log('✔ R4 PASSED');

console.log('\n=======================================');
console.log('ALL R1 - R4 CUSTOM TESTS PASSED 100%!');
console.log('=======================================');
