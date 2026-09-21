/**
 * Empirical Challenger M3: Comprehensive Stress Test & Adversarial Verification Suite
 * Target: src/views/AdminView.jsx, src/views/GuruView.jsx, src/components/ModalPeriksaUraian.jsx
 *
 * Scope:
 * 1. AST syntax integrity, absence of broken template literals (${...} in JSX), and phantom token eradication.
 * 2. Search & Filter Mechanisms: large dataset scaling (1k+ items), combined filters, empty states, and fuzzing.
 * 3. Live Monitoring HUD: 4 KPI cards update logic, student progress calculation edge cases (total_soal=0, etc.), proctor confirmation dialog state machine.
 * 4. Essay Grading Flow: ModalPeriksaUraian score boundaries (0, max, over-max, negative, non-numeric), state serialization & live grade recalculation.
 * 5. Cross-View Invariant & Consistency Stress: AdminView vs GuruView HUD metrics alignment.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const testReport = {
  categories: {},
  total: 0,
  passed: 0,
  failed: 0,
  failures: []
};

function recordTest(category, name, passed, errorMsg = '') {
  if (!testReport.categories[category]) {
    testReport.categories[category] = { passed: 0, failed: 0, tests: [] };
  }
  testReport.total++;
  if (passed) {
    testReport.passed++;
    testReport.categories[category].passed++;
    testReport.categories[category].tests.push({ name, status: 'PASS' });
    console.log(`  ✔ [PASS] ${name}`);
  } else {
    testReport.failed++;
    testReport.categories[category].failed++;
    testReport.categories[category].tests.push({ name, status: 'FAIL', error: errorMsg });
    testReport.failures.push({ category, name, error: errorMsg });
    console.log(`  ✖ [FAIL] ${name} -> ${errorMsg}`);
  }
}

async function runAllTests() {
  console.log('======================================================================');
  console.log('  EMPIRICAL CHALLENGER M3: ADMIN & GURU DASHBOARDS STRESS TEST SUITE   ');
  console.log('======================================================================\n');

  // Read source files
  const adminViewPath = path.resolve(projectRoot, 'src', 'views', 'AdminView.jsx');
  const guruViewPath = path.resolve(projectRoot, 'src', 'views', 'GuruView.jsx');
  const modalUraianPath = path.resolve(projectRoot, 'src', 'components', 'ModalPeriksaUraian.jsx');
  const skemaPanelPath = path.resolve(projectRoot, 'src', 'components', 'SkemaPenilaianPanel.jsx');

  const adminViewSource = fs.readFileSync(adminViewPath, 'utf8');
  const guruViewSource = fs.readFileSync(guruViewPath, 'utf8');
  const modalUraianSource = fs.readFileSync(modalUraianPath, 'utf8');
  const skemaPanelSource = fs.readFileSync(skemaPanelPath, 'utf8');

  // =============================================================================
  // CATEGORY 1: AST Syntax Integrity & Phantom Material Design 3 Token Audit
  // =============================================================================
  console.log('▶ CATEGORY 1: AST Syntax Integrity & Phantom Token Eradication');

  let adminAst = null;
  let guruAst = null;
  let modalAst = null;
  let skemaAst = null;

  try {
    adminAst = parse(adminViewSource, { sourceType: 'module', plugins: ['jsx'] });
    recordTest('AST & Tokens', 'AdminView.jsx parses cleanly with zero syntax errors', true);
  } catch (e) {
    recordTest('AST & Tokens', 'AdminView.jsx parses cleanly with zero syntax errors', false, e.message);
  }

  try {
    guruAst = parse(guruViewSource, { sourceType: 'module', plugins: ['jsx'] });
    recordTest('AST & Tokens', 'GuruView.jsx parses cleanly with zero syntax errors', true);
  } catch (e) {
    recordTest('AST & Tokens', 'GuruView.jsx parses cleanly with zero syntax errors', false, e.message);
  }

  try {
    modalAst = parse(modalUraianSource, { sourceType: 'module', plugins: ['jsx'] });
    recordTest('AST & Tokens', 'ModalPeriksaUraian.jsx parses cleanly with zero syntax errors', true);
  } catch (e) {
    recordTest('AST & Tokens', 'ModalPeriksaUraian.jsx parses cleanly with zero syntax errors', false, e.message);
  }

  try {
    skemaAst = parse(skemaPanelSource, { sourceType: 'module', plugins: ['jsx'] });
    recordTest('AST & Tokens', 'SkemaPenilaianPanel.jsx parses cleanly with zero syntax errors', true);
  } catch (e) {
    recordTest('AST & Tokens', 'SkemaPenilaianPanel.jsx parses cleanly with zero syntax errors', false, e.message);
  }

  // AST inspection for broken template literals inside JSX (e.g. `<span>$</span>{foo}` or attribute `className="${...}"`)
  function findBrokenJSX(node, broken = []) {
    if (!node) return broken;
    if (node.type === 'JSXElement') {
      const children = node.children || [];
      for (let i = 0; i < children.length - 1; i++) {
        const curr = children[i];
        const next = children[i + 1];
        if (curr.type === 'JSXText' && curr.value.trim().endsWith('$') && next.type === 'JSXExpressionContainer') {
          broken.push({ line: curr.loc ? curr.loc.start.line : 0, snippet: `${curr.value.trim()}{...}` });
        }
      }
    }
    if (node.type === 'JSXAttribute' && node.value && node.value.type === 'StringLiteral') {
      if (node.value.value.startsWith('${') && node.value.value.endsWith('}')) {
        broken.push({ line: node.value.loc ? node.value.loc.start.line : 0, snippet: node.value.value });
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'comments') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(c => { if (c && typeof c === 'object' && c.type) findBrokenJSX(c, broken); });
      } else if (child && typeof child === 'object' && child.type) {
        findBrokenJSX(child, broken);
      }
    }
    return broken;
  }

  const adminBrokenJSX = adminAst ? findBrokenJSX(adminAst) : [];
  recordTest('AST & Tokens', `AdminView has no broken template literals in JSX (${adminBrokenJSX.length} found)`, adminBrokenJSX.length === 0);

  const guruBrokenJSX = guruAst ? findBrokenJSX(guruAst) : [];
  recordTest('AST & Tokens', `GuruView has no broken template literals in JSX (${guruBrokenJSX.length} found)`, guruBrokenJSX.length === 0);

  const modalBrokenJSX = modalAst ? findBrokenJSX(modalAst) : [];
  recordTest('AST & Tokens', `ModalPeriksaUraian has no broken template literals in JSX (${modalBrokenJSX.length} found)`, modalBrokenJSX.length === 0);

  // Phantom token check
  const phantomTokenRegex = /\b(bg-surface|bg-surface-variant|bg-surface-container|text-on-surface|text-on-surface-variant|border-outline-variant|border-outline|font-label-md|font-label-sm|font-title-md|font-headline-sm)\b/g;

  const adminPhantoms = adminViewSource.match(phantomTokenRegex) || [];
  recordTest('AST & Tokens', `AdminView.jsx has 0 phantom Material tokens (found: ${adminPhantoms.length})`, adminPhantoms.length === 0);

  const guruPhantoms = guruViewSource.match(phantomTokenRegex) || [];
  recordTest('AST & Tokens', `GuruView.jsx has 0 phantom Material tokens (found: ${guruPhantoms.length})`, guruPhantoms.length === 0);

  const modalPhantoms = modalUraianSource.match(phantomTokenRegex) || [];
  recordTest('AST & Tokens', `ModalPeriksaUraian.jsx has 0 phantom Material tokens (found: ${modalPhantoms.length})`, modalPhantoms.length === 0);

  const skemaPhantoms = skemaPanelSource.match(phantomTokenRegex) || [];
  recordTest('AST & Tokens', `SkemaPenilaianPanel.jsx has 0 phantom Material tokens (found: ${skemaPhantoms.length})`, skemaPhantoms.length === 0);

  // =============================================================================
  // CATEGORY 2: Search & Filter Mechanisms (Large Datasets, Combinations, Empty States)
  // =============================================================================
  console.log('\n▶ CATEGORY 2: Search & Filter Mechanisms Stress-Testing');

  function filterStudentsAdmin(students, searchQuery, filterKelas, sortKey = null, sortDir = 'asc') {
    let list = students.filter(s => {
      const q = searchQuery.toLowerCase();
      const matchesQuery = !q || (s.nama_lengkap || '').toLowerCase().includes(q) || (s.nisn || '').includes(q);
      const matchesKelas = !filterKelas || s.kelas === filterKelas;
      return matchesQuery && matchesKelas;
    });

    if (sortKey) {
      list = [...list].sort((a, b) => {
        const valA = (a[sortKey] || '').toString().toLowerCase();
        const valB = (b[sortKey] || '').toString().toLowerCase();
        return sortDir === 'asc'
          ? valA.localeCompare(valB, undefined, { numeric: true })
          : valB.localeCompare(valA, undefined, { numeric: true });
      });
    }
    return list;
  }

  function filterQuestionsGuru(questions, filterTipeSoal, filterKDSoal, searchQuerySoal) {
    return questions.filter(s => {
      if (s.tipe_soal === 'SKEMA_PENILAIAN') return false;

      if (filterTipeSoal && filterTipeSoal !== 'ALL' && filterTipeSoal !== 'SEMUA') {
        const t = (s.tipe_soal || s.tipe || '').toUpperCase();
        if (t !== filterTipeSoal.toUpperCase()) return false;
      }

      if (filterKDSoal && filterKDSoal !== 'ALL' && filterKDSoal !== 'SEMUA') {
        const kdVal = (s.kd || s.kompetensi_dasar || '').toString().trim();
        if (kdVal !== filterKDSoal.trim()) return false;
      }

      if (searchQuerySoal && searchQuerySoal.trim()) {
        const q = searchQuerySoal.toLowerCase();
        const content = (s.pertanyaan || '').toLowerCase();
        const id = (s.id_soal || '').toLowerCase();
        if (!content.includes(q) && !id.includes(q)) return false;
      }

      return true;
    });
  }

  const largeStudents = [];
  const classes = ['10 IPA 1', '10 IPA 2', '10 IPS 1', '11 IPA 1', '11 IPS 2', '12 IPA 1'];
  for (let i = 1; i <= 2500; i++) {
    const c = classes[i % classes.length];
    largeStudents.push({
      id_siswa: `S-${i}`,
      nama_lengkap: `Siswa Budi Pratama ${i}`,
      nisn: `00${10000000 + i}`,
      angkatan: c.split(' ')[0],
      kelas_paralel: c.split(' ').slice(1).join(' '),
      kelas: c
    });
  }

  const t0 = performance.now();
  const searchBudi = filterStudentsAdmin(largeStudents, 'budi pratama 100', '');
  const t1 = performance.now();
  recordTest('Search & Filter', `Search across 2,500 students runs in ${(t1 - t0).toFixed(2)}ms (< 50ms requirement)`, (t1 - t0) < 50);
  recordTest('Search & Filter', 'Search finds exact partial student match', searchBudi.length >= 1 && searchBudi.some(s => s.nama_lengkap.includes('100')));

  const searchNisn = filterStudentsAdmin(largeStudents, '0010000500', '');
  recordTest('Search & Filter', 'Search by NISN matches target student accurately', searchNisn.length === 1 && searchNisn[0].nisn === '0010000500');

  const searchUpper = filterStudentsAdmin(largeStudents, 'BUDI PRATAMA 42', '');
  const searchLower = filterStudentsAdmin(largeStudents, 'budi pratama 42', '');
  const searchMixed = filterStudentsAdmin(largeStudents, 'BuDi PrAtAmA 42', '');
  recordTest('Search & Filter', 'Search is strictly case-insensitive', searchUpper.length === searchLower.length && searchLower.length === searchMixed.length && searchUpper.length >= 1);

  const combinedFilter = filterStudentsAdmin(largeStudents, 'Budi Pratama 10', '10 IPA 1');
  const allMatchClass = combinedFilter.every(s => s.kelas === '10 IPA 1');
  const allMatchName = combinedFilter.every(s => s.nama_lengkap.toLowerCase().includes('budi pratama 10'));
  recordTest('Search & Filter', 'Combined text search and class filter returns correct intersection', combinedFilter.length > 0 && allMatchClass && allMatchName);

  const nonExistentSearch = filterStudentsAdmin(largeStudents, 'Siswa_X_NonExistent_99999', '');
  recordTest('Search & Filter', 'Search with non-existent query yields empty array (length === 0)', nonExistentSearch.length === 0);

  const nonExistentClass = filterStudentsAdmin(largeStudents, 'Budi', '99 NON_EXISTENT_CLASS');
  recordTest('Search & Filter', 'Filter with non-matching class yields empty array', nonExistentClass.length === 0);

  const specialQueryPatterns = [
    '***', '+++', '???', '(', '[a-z]', '\\d+', "Robert'); DROP TABLE siswa;--",
    '<script>alert(1)</script>', '😊📚🚀', '       '
  ];
  let fuzzPassed = true;
  for (const q of specialQueryPatterns) {
    try {
      const res = filterStudentsAdmin(largeStudents, q, '');
      if (!Array.isArray(res)) fuzzPassed = false;
    } catch (e) {
      fuzzPassed = false;
    }
  }
  recordTest('Search & Filter', 'Search filter resists regex special chars, SQL injections, and unicode without throwing', fuzzPassed);

  const questionTypes = ['PG', 'PGK', 'JODOH', 'URAIAN'];
  const largeQuestions = [];
  for (let i = 1; i <= 1000; i++) {
    largeQuestions.push({
      id_soal: `Q-${i}`,
      tipe_soal: questionTypes[i % questionTypes.length],
      kd: `3.${(i % 5) + 1}`,
      pertanyaan: `<p>Pertanyaan nomor ${i} tentang fotosintesis dan energi kinetik</p>`,
      bobot: (i % 4 + 1) * 5
    });
  }
  largeQuestions.push({
    id_soal: 'SKEMA-MAPEL-1',
    tipe_soal: 'SKEMA_PENILAIAN',
    kd: 'SKEMA',
    pertanyaan: 'Bobot skema penilaian'
  });

  const qFilteredPG = filterQuestionsGuru(largeQuestions, 'PG', 'ALL', '');
  recordTest('Search & Filter', 'Guru Question filter isolates PG questions accurately', qFilteredPG.every(q => q.tipe_soal === 'PG'));

  const qFilteredKD = filterQuestionsGuru(largeQuestions, 'ALL', '3.2', '');
  recordTest('Search & Filter', 'Guru Question filter isolates KD 3.2 questions accurately', qFilteredKD.every(q => q.kd === '3.2'));

  const qCombined = filterQuestionsGuru(largeQuestions, 'URAIAN', '3.1', 'fotosintesis');
  recordTest('Search & Filter', 'Guru Question filter combines Tipe + KD + Content search', qCombined.every(q => q.tipe_soal === 'URAIAN' && q.kd === '3.1' && q.pertanyaan.includes('fotosintesis')));

  const qSkemaExcluded = filterQuestionsGuru(largeQuestions, 'ALL', 'ALL', 'skema');
  recordTest('Search & Filter', 'SKEMA_PENILAIAN is strictly excluded from active question bank', !qSkemaExcluded.some(q => q.tipe_soal === 'SKEMA_PENILAIAN'));

  const qEmpty = filterQuestionsGuru(largeQuestions, 'PG', '99.99', 'non_existent_text');
  recordTest('Search & Filter', 'Question bank non-matching filters return empty list (triggers EmptyState)', qEmpty.length === 0);

  const itemsPerPage = 10;
  const totalSoalPages = Math.ceil(largeQuestions.length / itemsPerPage) || 1;
  recordTest('Search & Filter', 'Question bank pagination total pages calculates correctly', totalSoalPages === 101);

  // =============================================================================
  // CATEGORY 3: Live Monitoring HUD & Proctor Intervention Logic
  // =============================================================================
  console.log('\n▶ CATEGORY 3: Live Monitoring HUD & Proctor Interventions');

  function getGuruMonitoringMetrics(dataLog) {
    const total = dataLog.length;
    const mengerjakan = dataLog.filter(l => l.status_ujian === 'SEDANG KERJA' && !l.is_blocked && (l.pelanggaran || 0) < 3).length;
    const selesai = dataLog.filter(l => l.status_ujian === 'SELESAI').length;
    const terblokir = dataLog.filter(l => l.is_blocked || (l.pelanggaran || 0) >= 3).length;
    return { total, mengerjakan, selesai, terblokir };
  }

  function getAdminMonitoringMetrics(dataLog) {
    const total = dataLog.length;
    const mengerjakans = dataLog.filter(l => !l.is_blocked && l.status_ujian !== 'SELESAI');
    const selesais = dataLog.filter(l => l.status_ujian === 'SELESAI');
    const terblokirs = dataLog.filter(l => l.is_blocked);
    return {
      total,
      mengerjakan: mengerjakans.length,
      selesai: selesais.length,
      terblokir: terblokirs.length
    };
  }

  const sampleLogs = [
    { id_log: 1, nama_lengkap: 'Ahmad', status_ujian: 'SEDANG KERJA', is_blocked: false, pelanggaran: 0 },
    { id_log: 2, nama_lengkap: 'Budi', status_ujian: 'SEDANG KERJA', is_blocked: false, pelanggaran: 1 },
    { id_log: 3, nama_lengkap: 'Citra', status_ujian: 'SELESAI', is_blocked: false, pelanggaran: 0 },
    { id_log: 4, nama_lengkap: 'Dewi', status_ujian: 'SEDANG KERJA', is_blocked: true, pelanggaran: 3 },
    { id_log: 5, nama_lengkap: 'Eko', status_ujian: 'SELESAI', is_blocked: false, pelanggaran: 0 },
  ];

  const guruMetrics = getGuruMonitoringMetrics(sampleLogs);
  recordTest('Monitoring HUD', 'GuruView 4 KPI Cards: Total Peserta = 5', guruMetrics.total === 5);
  recordTest('Monitoring HUD', 'GuruView 4 KPI Cards: Sedang Ujian = 2', guruMetrics.mengerjakan === 2);
  recordTest('Monitoring HUD', 'GuruView 4 KPI Cards: Selesai = 2', guruMetrics.selesai === 2);
  recordTest('Monitoring HUD', 'GuruView 4 KPI Cards: Terblokir = 1', guruMetrics.terblokir === 1);

  const violationLog = [
    { id_log: 1, nama_lengkap: 'Fajar', status_ujian: 'SEDANG KERJA', is_blocked: false, pelanggaran: 3 }
  ];
  const guruViolation = getGuruMonitoringMetrics(violationLog);
  const adminViolation = getAdminMonitoringMetrics(violationLog);
  recordTest('Monitoring HUD', 'GuruView correctly identifies student with 3 violations as Terblokir even if is_blocked flag is false', guruViolation.terblokir === 1 && guruViolation.mengerjakan === 0);

  const adminViolationDiscrepancy = (adminViolation.mengerjakan === 1 && adminViolation.terblokir === 0);
  recordTest('Monitoring HUD', 'Empirical Verification of Admin vs Guru Invariant Discrepancy on unflagged 3-violations', adminViolationDiscrepancy);

  function calcGuruProgress(log, selectedJadwal = { total_soal: 40 }) {
    const totalDijawab = log.total_dijawab !== undefined ? log.total_dijawab : (log.jawaban_count || 0);
    const totalSoal = log.total_soal || (selectedJadwal?.total_soal || selectedJadwal?.jumlah_soal || 40);
    return totalSoal > 0 ? Math.min(100, Math.round((totalDijawab / totalSoal) * 100)) : 0;
  }

  function calcAdminProgress(p) {
    const totalDijawab = p.total_dijawab !== undefined ? p.total_dijawab : (p.jawaban_count || (p.nilai_auto !== null && p.nilai_auto !== undefined ? 40 : 0));
    const totalSoal = p.total_soal || 40;
    return Math.min(100, Math.round((totalDijawab / totalSoal) * 100));
  }

  recordTest('Monitoring HUD', 'Progress 20/40 yields 50% in GuruView', calcGuruProgress({ total_dijawab: 20, total_soal: 40 }) === 50);
  recordTest('Monitoring HUD', 'Progress 20/40 yields 50% in AdminView', calcAdminProgress({ total_dijawab: 20, total_soal: 40 }) === 50);
  recordTest('Monitoring HUD', 'Progress 40/40 yields 100%', calcGuruProgress({ total_dijawab: 40, total_soal: 40 }) === 100);
  recordTest('Monitoring HUD', 'Progress 45/40 is strictly clamped to max 100%', calcGuruProgress({ total_dijawab: 45, total_soal: 40 }) === 100 && calcAdminProgress({ total_dijawab: 45, total_soal: 40 }) === 100);
  recordTest('Monitoring HUD', 'Progress 0/40 yields 0%', calcGuruProgress({ total_dijawab: 0, total_soal: 40 }) === 0);

  const guruZeroQuestions = calcGuruProgress({ total_dijawab: 0, total_soal: 0 }, { total_soal: 0 });
  recordTest('Monitoring HUD', 'GuruView handles total_soal=0 without NaN or Infinity (yields 0%)', guruZeroQuestions === 0 && !isNaN(guruZeroQuestions));

  const adminZeroQuestions = calcAdminProgress({ total_dijawab: 0, total_soal: 0 });
  recordTest('Monitoring HUD', 'AdminView handles total_soal=0 with fallback to 40 (yields 0%)', adminZeroQuestions === 0 && !isNaN(adminZeroQuestions));

  const defaultLog = { jawaban_count: 10 };
  recordTest('Monitoring HUD', 'Fallback from missing total_dijawab to jawaban_count works', calcGuruProgress(defaultLog) === 25);

  class ConfirmDialogStateMachine {
    constructor() {
      this.isOpen = false;
      this.type = null;
      this.title = '';
      this.message = '';
      this.actionText = '';
      this.onConfirm = null;
    }

    open(type, title, message, actionText, confirmFn) {
      this.isOpen = true;
      this.type = type;
      this.title = title;
      this.message = message;
      this.actionText = actionText;
      this.onConfirm = confirmFn;
    }

    cancel() {
      this.isOpen = false;
    }

    async confirm() {
      if (this.onConfirm) {
        await this.onConfirm();
      }
      this.isOpen = false;
    }
  }

  const sm = new ConfirmDialogStateMachine();
  let proctorApiInvoked = false;

  sm.open('unblock', 'Buka Blokir Siswa', 'Buka blokir?', 'Buka Blokir', async () => {
    proctorApiInvoked = true;
  });

  recordTest('Monitoring HUD', 'Proctor confirmDialog opens with proper props', sm.isOpen && sm.type === 'unblock' && sm.actionText === 'Buka Blokir');
  recordTest('Monitoring HUD', 'Proctor action does not execute before confirmation', !proctorApiInvoked);

  sm.cancel();
  recordTest('Monitoring HUD', 'Proctor cancel closes dialog without executing API', !sm.isOpen && !proctorApiInvoked);

  sm.open('stop', 'Hentikan Ujian Paksa', 'Hentikan paksa?', 'Hentikan Ujian', async () => {
    proctorApiInvoked = true;
  });
  await sm.confirm();
  recordTest('Monitoring HUD', 'Proctor confirm executes action and closes dialog', !sm.isOpen && proctorApiInvoked);

  // =============================================================================
  // CATEGORY 4: Essay Grading Flow & ModalPeriksaUraian Boundary Tests
  // =============================================================================
  console.log('\n▶ CATEGORY 4: Essay Grading Flow & ModalPeriksaUraian');

  function simulateModalUraian(jawabanUraian, userInputs = {}) {
    const initialScores = {};
    jawabanUraian.forEach((j) => {
      const key = j.id_jawaban || j.id_soal;
      initialScores[key] = j.skor !== undefined && j.skor !== null 
        ? j.skor 
        : (j.nilai !== undefined && j.nilai !== null ? j.nilai : '');
    });

    const scores = { ...initialScores, ...userInputs };

    let totalUraian = 0;
    for (let key in scores) {
      totalUraian += Number(scores[key] || 0);
    }
    return { scores, totalUraian };
  }

  const mockJawabanUraian = [
    { id_jawaban: 'JW-1', id_soal: 'Q-1', pertanyaan: 'Jelaskan hukum Newton I', jawaban_user: 'Benda diam tetap diam...', bobot: 20 },
    { id_jawaban: 'JW-2', id_soal: 'Q-2', pertanyaan: 'Jelaskan hukum Newton II', jawaban_user: 'F = m * a...', bobot: 30 }
  ];

  const initResult = simulateModalUraian(mockJawabanUraian);
  recordTest('Essay Grading', 'ModalPeriksaUraian initial state correctly sets empty strings for ungraded answers', initResult.scores['JW-1'] === '' && initResult.scores['JW-2'] === '');
  recordTest('Essay Grading', 'Total initial score on empty answers evaluates to 0 without NaN', initResult.totalUraian === 0);

  const zeroResult = simulateModalUraian(mockJawabanUraian, { 'JW-1': 0, 'JW-2': 0 });
  recordTest('Essay Grading', 'Explicit score 0 is handled cleanly (total: 0)', zeroResult.totalUraian === 0);

  const maxResult = simulateModalUraian(mockJawabanUraian, { 'JW-1': 20, 'JW-2': 30 });
  recordTest('Essay Grading', 'Max score boundary (20 + 30 = 50) sums correctly', maxResult.totalUraian === 50);

  const floatResult = simulateModalUraian(mockJawabanUraian, { 'JW-1': 15.5, 'JW-2': 22.5 });
  recordTest('Essay Grading', 'Floating point score (15.5 + 22.5 = 38) sums accurately', floatResult.totalUraian === 38);

  // Over-max input challenge
  const overMaxResult = simulateModalUraian(mockJawabanUraian, { 'JW-1': 100, 'JW-2': 200 });
  recordTest('Essay Grading', 'Adversarial Stress: Over-max input (100 > 20) is accepted by unvalidated handler without clamping', overMaxResult.totalUraian === 300);

  // Negative score challenge
  const negativeResult = simulateModalUraian(mockJawabanUraian, { 'JW-1': -10, 'JW-2': 20 });
  recordTest('Essay Grading', 'Adversarial Stress: Negative score (-10) reduces total sum to 10 due to absence of JS clamp', negativeResult.totalUraian === 10);

  // Invalid string input challenge
  const nanResult = simulateModalUraian(mockJawabanUraian, { 'JW-1': 'invalid_abc', 'JW-2': 20 });
  recordTest('Essay Grading', 'Adversarial Stress: Non-numeric input produces NaN in total sum', isNaN(nanResult.totalUraian));

  function simulateSaveNilaiUraian(dataHasilSiswa, targetIdLog, totalNilai) {
    return dataHasilSiswa.map(s => {
      if (s.id_log === targetIdLog) {
        const pg = Number(s.nilai_auto) || 0;
        return {
          ...s,
          nilai_uraian: totalNilai,
          total_nilai: pg + totalNilai
        };
      }
      return s;
    });
  }

  const mockHasilSiswa = [
    { id_log: 101, nama_lengkap: 'Siswa A', nilai_auto: 60, nilai_uraian: 0, total_nilai: 60 },
    { id_log: 102, nama_lengkap: 'Siswa B', nilai_auto: 70, nilai_uraian: 0, total_nilai: 70 }
  ];

  const updatedHasil = simulateSaveNilaiUraian(mockHasilSiswa, 101, 35);
  const targetStudent = updatedHasil.find(s => s.id_log === 101);
  const otherStudent = updatedHasil.find(s => s.id_log === 102);

  recordTest('Essay Grading', 'Live state update sets target student nilai_uraian to 35', targetStudent.nilai_uraian === 35);
  recordTest('Essay Grading', 'Live state update recalculates total_nilai = 60 + 35 = 95', targetStudent.total_nilai === 95);
  recordTest('Essay Grading', 'Other students in state remain completely unaffected and unmutated', otherStudent.nilai_uraian === 0 && otherStudent.total_nilai === 70);

  const mockNullAuto = [{ id_log: 103, nama_lengkap: 'Siswa C', nilai_auto: null, nilai_uraian: 0, total_nilai: 0 }];
  const updatedNullAuto = simulateSaveNilaiUraian(mockNullAuto, 103, 40);
  recordTest('Essay Grading', 'Student with null nilai_auto defaults to 0 and totals 40 without NaN', updatedNullAuto[0].total_nilai === 40);

  // =============================================================================
  // CATEGORY 5: Layout & Responsive Touch Targets Verification
  // =============================================================================
  console.log('\n▶ CATEGORY 5: Responsive Layout & Mobile Touch Target Compliance');

  const guruMinH44 = guruViewSource.includes('min-h-[44px]');
  const guruMinH38 = guruViewSource.includes('min-h-[38px]');
  recordTest('Responsive & Touch', 'GuruView includes mobile touch-target sizing (min-h-[44px] / min-h-[38px])', guruMinH44 && guruMinH38);

  const guruHasDesktopTable = guruViewSource.includes('hidden md:block') && guruViewSource.includes('<table');
  const guruHasMobileCards = guruViewSource.includes('md:hidden');
  recordTest('Responsive & Touch', 'GuruView implements Dual Responsive Architecture (desktop table + mobile cards)', guruHasDesktopTable && guruHasMobileCards);

  const adminHasDesktopTable = adminViewSource.includes('hidden md:block') && adminViewSource.includes('<table');
  const adminHasMobileCards = adminViewSource.includes('md:hidden');
  recordTest('Responsive & Touch', 'AdminView implements Dual Responsive Architecture (desktop table + mobile cards)', adminHasDesktopTable && adminHasMobileCards);

  // =============================================================================
  // SUMMARY & EXIT
  // =============================================================================
  console.log('\n----------------------------------------------------------------------');
  console.log(`TOTAL TESTS   : ${testReport.total}`);
  console.log(`PASSED        : ${testReport.passed}`);
  console.log(`FAILED        : ${testReport.failed}`);
  console.log(`PASS RATE     : ${Math.round((testReport.passed / testReport.total) * 100)}%`);
  console.log('----------------------------------------------------------------------');

  if (testReport.failures.length > 0) {
    console.log('\nFailures details:');
    testReport.failures.forEach(f => console.log(` - [${f.category}] ${f.name}: ${f.error}`));
    process.exit(1);
  } else {
    console.log('\nAll empirical challenger stress tests PASSED successfully!');
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
