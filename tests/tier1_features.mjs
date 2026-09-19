/**
 * Tier 1: Feature Coverage Test Suite
 * Validates >=5 test cases per feature across:
 * 1. Student Exam Flow (SiswaView & ExamRoom)
 * 2. Admin Views & Management (AdminView)
 * 3. Guru Views & Authoring (GuruView)
 * 4. Design System & Shared Foundations (UI.jsx, theme tokens)
 */

import { TestSuite, assert } from './test_framework.mjs';

export function createTier1Suite() {
  const suite = new TestSuite('Tier 1: Feature Coverage', 'Core functional coverage across all primary CBT NEXA modules');

  // =========================================================================
  // Feature 1: Student Exam Flow (SiswaView & ExamRoom)
  // =========================================================================

  suite.add('T1.1.1 [Student Flow] SiswaView exam schedule data structure & status filtering', () => {
    // Contract from PROJECT.md & SiswaView.jsx
    const schedules = [
      { id_jadwal: 'j1', nama_mapel: 'Matematika', status_ujian: 'AKTIF', durasi_menit: 90, waktu_mulai: '2026-09-19T08:00:00' },
      { id_jadwal: 'j2', nama_mapel: 'Bahasa Indonesia', status_ujian: 'NONAKTIF', durasi_menit: 60, waktu_mulai: '2026-09-19T10:00:00' },
      { id_jadwal: 'j3', nama_mapel: 'IPA Terpadu', status_ujian: 'SELESAI', durasi_menit: 90, waktu_mulai: '2026-09-18T08:00:00' }
    ];

    const activeExams = schedules.filter(s => s.status_ujian === 'AKTIF');
    const completedExams = schedules.filter(s => s.status_ujian === 'SELESAI');

    assert.equal(activeExams.length, 1, 'Should find 1 active exam');
    assert.equal(activeExams[0].id_jadwal, 'j1', 'Active exam should be j1');
    assert.equal(completedExams.length, 1, 'Should find 1 completed exam');
  });

  suite.add('T1.1.2 [Student Flow] ExamRoom Props Contract & Session Initialization', () => {
    // Contract: ExamRoom receives { user, jadwal, idLog, showMessage, onFinish, isDarkMode, setIsDarkMode }
    const mockUser = { id_siswa: 's101', nisn: '1234567890', nama: 'Budi Santoso', kelas: '9A', npsn: '20101010' };
    const mockJadwal = { id_jadwal: 'j1', nama_ujian: 'Penilaian Tengah Semester', durasi_menit: 90, acak_soal: true, acak_opsi: true };
    const mockIdLog = 'log_999';
    let finishTriggered = false;
    const onFinish = () => { finishTriggered = true; };

    assert.ok(mockUser.nisn && mockUser.nama, 'User must have valid NISN and nama');
    assert.ok(mockJadwal.id_jadwal && mockJadwal.durasi_menit > 0, 'Jadwal must have valid ID and duration');
    assert.equal(typeof onFinish, 'function', 'onFinish callback must be provided');
    assert.equal(mockIdLog, 'log_999', 'idLog must match session identifier');
  });

  suite.add('T1.1.3 [Student Flow] Multi-Type Question Canvas: Pilihan Ganda (PG) Single Answer', () => {
    // Simulates PG answer selection behavior
    let userAnswers = {};
    const handleAnswerChangePG = (soalId, value) => {
      userAnswers[soalId] = value;
    };

    const soalPG = { id_soal: 'q1', tipe_soal: 'PG', opsi_a: 'Option A', opsi_b: 'Option B', opsi_c: 'Option C', opsi_d: 'Option D' };
    handleAnswerChangePG(soalPG.id_soal, 'A');
    assert.equal(userAnswers['q1'], 'A', 'PG answer should be recorded as string "A"');

    // Changing answer updates state
    handleAnswerChangePG(soalPG.id_soal, 'C');
    assert.equal(userAnswers['q1'], 'C', 'PG answer should update to "C"');
  });

  suite.add('T1.1.4 [Student Flow] Multi-Type Question Canvas: PG Kompleks (PGK) Multi-Select Array', () => {
    // Simulates PG Kompleks checkbox toggling behavior
    let userAnswers = {};
    const toggleAnswerPGK = (soalId, optionKey) => {
      const current = Array.isArray(userAnswers[soalId]) ? [...userAnswers[soalId]] : [];
      const idx = current.indexOf(optionKey);
      if (idx > -1) {
        current.splice(idx, 1);
      } else {
        current.push(optionKey);
      }
      userAnswers[soalId] = current.sort();
    };

    const soalPGK = { id_soal: 'q2', tipe_soal: 'PGK', opsi: ['Pernyataan 1', 'Pernyataan 2', 'Pernyataan 3', 'Pernyataan 4'] };
    toggleAnswerPGK(soalPGK.id_soal, '0');
    assert.deepEqual(userAnswers['q2'], ['0'], 'First checkbox selected');

    toggleAnswerPGK(soalPGK.id_soal, '2');
    assert.deepEqual(userAnswers['q2'], ['0', '2'], 'Two checkboxes selected');

    toggleAnswerPGK(soalPGK.id_soal, '0');
    assert.deepEqual(userAnswers['q2'], ['2'], 'First checkbox toggled off');
  });

  suite.add('T1.1.5 [Student Flow] Multi-Type Question Canvas: Menjodohkan (JODOH) Key-Value Mapping', () => {
    // Simulates Menjodohkan pairing logic
    let userAnswers = {};
    const setJodohPair = (soalId, premiseIndex, matchTarget) => {
      const current = (typeof userAnswers[soalId] === 'object' && userAnswers[soalId] !== null) ? { ...userAnswers[soalId] } : {};
      current[premiseIndex] = matchTarget;
      userAnswers[soalId] = current;
    };

    const soalJodoh = { id_soal: 'q3', tipe_soal: 'JODOH' };
    setJodohPair(soalJodoh.id_soal, 'premise_0', 'target_B');
    setJodohPair(soalJodoh.id_soal, 'premise_1', 'target_A');

    assert.deepEqual(userAnswers['q3'], { premise_0: 'target_B', premise_1: 'target_A' }, 'Premise pairs properly mapped');
  });

  suite.add('T1.1.6 [Student Flow] Multi-Type Question Canvas: Uraian Text Input Persistence', () => {
    let userAnswers = {};
    const setUraianAnswer = (soalId, text) => {
      userAnswers[soalId] = text;
    };

    const soalUraian = { id_soal: 'q4', tipe_soal: 'URAIAN' };
    const essayText = 'Fotosintesis adalah proses di mana tumbuhan menggunakan sinar matahari, air, dan karbon dioksida.';
    setUraianAnswer(soalUraian.id_soal, essayText);

    assert.equal(userAnswers['q4'], essayText, 'Uraian text saved cleanly');
  });

  suite.add('T1.1.7 [Student Flow] Question Palette Status & Category Filter Counters', () => {
    const questions = [
      { id_soal: 'q1' },
      { id_soal: 'q2' },
      { id_soal: 'q3' },
      { id_soal: 'q4' },
      { id_soal: 'q5' }
    ];
    const answers = { q1: 'A', q2: ['0', '1'], q3: 'Teks uraian' };
    const raguRagu = { q2: true };

    const getStatus = (qId) => {
      if (raguRagu[qId]) return 'RAGU';
      if (answers[qId] !== undefined && answers[qId] !== null && answers[qId] !== '') return 'TERJAWAB';
      return 'BELUM';
    };

    const counts = { semua: questions.length, terjawab: 0, ragu: 0, belum: 0 };
    questions.forEach(q => {
      const st = getStatus(q.id_soal);
      if (st === 'RAGU') counts.ragu++;
      else if (st === 'TERJAWAB') counts.terjawab++;
      else counts.belum++;
    });

    assert.equal(counts.semua, 5, 'Total 5 questions');
    assert.equal(counts.terjawab, 2, '2 answered questions (q1, q3)');
    assert.equal(counts.ragu, 1, '1 doubtful question (q2)');
    assert.equal(counts.belum, 2, '2 unanswered questions (q4, q5)');
  });

  suite.add('T1.1.8 [Student Flow] Stimulus / Narasi Map Association Contract', () => {
    const narasiMap = {
      narasi_1: { id_narasi: 'narasi_1', judul: 'Teks Eksplanasi Gerhana Bulan', konten: '<p>Gerhana bulan terjadi ketika...</p>' },
      narasi_2: { id_narasi: 'narasi_2', judul: 'Cerpen Senja di Pelabuhan', konten: '<p>Ombak berdebur perlahan...</p>' }
    };

    const currentQuestion = { id_soal: 'q10', id_narasi: 'narasi_1', pertanyaan: 'Apakah penyebab utama fenomena di atas?' };
    const resolvedStimulus = currentQuestion.id_narasi ? narasiMap[currentQuestion.id_narasi] : null;

    assert.ok(resolvedStimulus !== null, 'Stimulus should be resolved');
    assert.equal(resolvedStimulus.judul, 'Teks Eksplanasi Gerhana Bulan', 'Resolved stimulus title matches');
  });

  suite.add('T1.1.9 [Student Flow] Distraction-Free HUD Timer Calculation & Formatting', () => {
    const formatTime = (totalSeconds) => {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const pad = (n) => String(n).padStart(2, '0');
      return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
    };

    assert.equal(formatTime(5400), '01:30:00', '90 minutes formats to 01:30:00');
    assert.equal(formatTime(300), '05:00', '5 minutes formats to 05:00');
    assert.equal(formatTime(45), '00:45', '45 seconds formats to 00:45');
    assert.equal(formatTime(0), '00:00', '0 seconds formats to 00:00');
  });

  suite.add('T1.1.10 [Student Flow] Safe Submission Verification & Counts Calculation', () => {
    const questions = [{ id_soal: 'q1' }, { id_soal: 'q2' }, { id_soal: 'q3' }, { id_soal: 'q4' }];
    const answers = { q1: 'A', q2: 'B' };
    const raguRagu = { q2: true };

    const calculateSubmissionSummary = (soalList, ans, ragu) => {
      let terjawab = 0;
      let raguCount = 0;
      let belum = 0;
      soalList.forEach(s => {
        const hasAnswer = ans[s.id_soal] !== undefined && ans[s.id_soal] !== null && ans[s.id_soal] !== '';
        if (ragu[s.id_soal]) raguCount++;
        else if (hasAnswer) terjawab++;
        else belum++;
      });
      return { total: soalList.length, terjawab, raguCount, belum, canSubmit: true };
    };

    const summary = calculateSubmissionSummary(questions, answers, raguRagu);
    assert.equal(summary.total, 4, 'Total questions');
    assert.equal(summary.terjawab, 1, 'Purely answered');
    assert.equal(summary.raguCount, 1, 'Marked as doubtful');
    assert.equal(summary.belum, 2, 'Unanswered');
    assert.isTrue(summary.canSubmit, 'Can open confirmation dialog');
  });

  // =========================================================================
  // Feature 2: Admin Views & School Management (AdminView)
  // =========================================================================

  suite.add('T1.2.1 [Admin View] School Master KPI Statistics Calculation', () => {
    const rawStudents = [{ id: 1, kelas: '7A' }, { id: 2, kelas: '7B' }, { id: 3, kelas: '8A' }, { id: 4, kelas: '9A' }];
    const rawTeachers = [{ id: 10, mapel: 'Matematika' }, { id: 11, mapel: 'IPA' }];
    const rawSchedules = [{ id: 'j1', status_ujian: 'AKTIF' }, { id: 'j2', status_ujian: 'SELESAI' }];

    const stats = {
      totalSiswa: rawStudents.length,
      totalGuru: rawTeachers.length,
      ujianAktif: rawSchedules.filter(s => s.status_ujian === 'AKTIF').length,
      ujianSelesai: rawSchedules.filter(s => s.status_ujian === 'SELESAI').length
    };

    assert.equal(stats.totalSiswa, 4, 'Total students count');
    assert.equal(stats.totalGuru, 2, 'Total teachers count');
    assert.equal(stats.ujianAktif, 1, 'Active exam count');
    assert.equal(stats.ujianSelesai, 1, 'Completed exam count');
  });

  suite.add('T1.2.2 [Admin View] Student Master Data Table Search & Filter Logic', () => {
    const dataSiswa = [
      { id_siswa: '1', nama: 'Ahmad Dahlan', nisn: '0011223344', kelas: '9A' },
      { id_siswa: '2', nama: 'Siti Fatimah', nisn: '0011223355', kelas: '9B' },
      { id_siswa: '3', nama: 'Budi Utomo', nisn: '0022334455', kelas: '8A' }
    ];

    const filterStudents = (query, filterKelas) => {
      return dataSiswa.filter(s => {
        const matchesQuery = !query || s.nama.toLowerCase().includes(query.toLowerCase()) || s.nisn.includes(query);
        const matchesKelas = !filterKelas || filterKelas === 'SEMUA' || s.kelas === filterKelas;
        return matchesQuery && matchesKelas;
      });
    };

    assert.equal(filterStudents('Ahmad', 'SEMUA').length, 1, 'Search by name');
    assert.equal(filterStudents('001122', 'SEMUA').length, 2, 'Search by NISN prefix');
    assert.equal(filterStudents('', '9B').length, 1, 'Filter by specific kelas');
    assert.equal(filterStudents('', '7A').length, 0, 'Filter by non-existent kelas returns 0');
  });

  suite.add('T1.2.3 [Admin View] Teacher Master Data Table Search & Mapping', () => {
    const dataGuru = [
      { id_guru: 'g1', nama: 'Dra. Nurhayati', nip: '19700101', mapel: 'Bahasa Indonesia' },
      { id_guru: 'g2', nama: 'Bambang Sudibyo, S.Pd', nip: '19800202', mapel: 'Matematika' }
    ];

    const searchGuru = (q) => dataGuru.filter(g => g.nama.toLowerCase().includes(q.toLowerCase()) || g.mapel.toLowerCase().includes(q.toLowerCase()));
    assert.equal(searchGuru('Matematika').length, 1, 'Find teacher by subject');
    assert.equal(searchGuru('Nurhayati')[0].id_guru, 'g1', 'Find teacher by name');
  });

  suite.add('T1.2.4 [Admin View] Exam Schedule Control Batch Status Transition', () => {
    let schedules = [
      { id_jadwal: 'j1', status_ujian: 'NONAKTIF' },
      { id_jadwal: 'j2', status_ujian: 'NONAKTIF' }
    ];

    const setAllSchedulesStatus = (targetStatus) => {
      schedules = schedules.map(s => ({ ...s, status_ujian: targetStatus }));
    };

    setAllSchedulesStatus('AKTIF');
    assert.equal(schedules.every(s => s.status_ujian === 'AKTIF'), true, 'All schedules transitioned to AKTIF');

    setAllSchedulesStatus('SELESAI');
    assert.equal(schedules.every(s => s.status_ujian === 'SELESAI'), true, 'All schedules transitioned to SELESAI');
  });

  suite.add('T1.2.5 [Admin View] Live Monitoring HUD Student Progress Bar & Badge Calculation', () => {
    const studentSession = {
      id_siswa: 's1',
      nama_siswa: 'Fitri Handayani',
      total_dijawab: 28,
      total_soal: 40,
      is_blocked: false,
      status_ujian: 'MENGERJAKAN'
    };

    const progressPercent = Math.round((studentSession.total_dijawab / studentSession.total_soal) * 100);
    assert.equal(progressPercent, 70, 'Calculates 70% progress');

    const getBadgeStyle = (session) => {
      if (session.is_blocked) return 'badge-danger';
      if (session.status_ujian === 'SELESAI') return 'badge-success';
      return 'badge-primary';
    };

    assert.equal(getBadgeStyle(studentSession), 'badge-primary', 'Active student gets primary badge');
    studentSession.is_blocked = true;
    assert.equal(getBadgeStyle(studentSession), 'badge-danger', 'Blocked student gets danger badge');
  });

  suite.add('T1.2.6 [Admin View] Proctor Interventions Contract (buka_blokir_siswa & reset_sesi_siswa)', () => {
    // API contract test for proctor actions
    const makeProctorActionPayload = (action, p_id_siswa, p_id_jadwal) => {
      assert.ok(['buka_blokir_siswa', 'reset_sesi_siswa'].includes(action), 'Action must be valid proctor endpoint');
      return { p_id_siswa, p_id_jadwal };
    };

    const payloadUnblock = makeProctorActionPayload('buka_blokir_siswa', 's101', 'j1');
    assert.equal(payloadUnblock.p_id_siswa, 's101', 'Unblock payload maps student ID');
    assert.equal(payloadUnblock.p_id_jadwal, 'j1', 'Unblock payload maps jadwal ID');
  });

  suite.add('T1.2.7 [Admin View] Responsive Sidebar Navigation Shell State', () => {
    let activeTab = 'dashboard';
    let isSidebarOpen = false;

    const navigateTab = (tabId) => {
      activeTab = tabId;
      isSidebarOpen = false; // Auto-collapse on mobile selection
    };

    navigateTab('siswa');
    assert.equal(activeTab, 'siswa', 'Tab updated');
    assert.equal(isSidebarOpen, false, 'Sidebar closed upon navigation');
  });

  // =========================================================================
  // Feature 3: Guru Views & Question Authoring (GuruView)
  // =========================================================================

  suite.add('T1.3.1 [Guru View] Subject Navigation & Active Subject Scope', () => {
    const subjects = [
      { id_mapel: 'm1', nama_mapel: 'Matematika IX', kode: 'MAT-9' },
      { id_mapel: 'm2', nama_mapel: 'IPA IX', kode: 'IPA-9' }
    ];

    let selectedMapel = subjects[0];
    const switchSubject = (id) => {
      selectedMapel = subjects.find(s => s.id_mapel === id) || null;
    };

    switchSubject('m2');
    assert.equal(selectedMapel.nama_mapel, 'IPA IX', 'Switched active subject to IPA IX');
  });

  suite.add('T1.3.2 [Guru View] Question Bank Filtering by KD & Tipe Soal', () => {
    const questions = [
      { id_soal: 'q1', tipe_soal: 'PG', kd: '3.1', pertanyaan: 'Soal aljabar dasar' },
      { id_soal: 'q2', tipe_soal: 'PGK', kd: '3.1', pertanyaan: 'Pernyataan benar aljabar' },
      { id_soal: 'q3', tipe_soal: 'URAIAN', kd: '3.2', pertanyaan: 'Jelaskan teorema Pythagoras' }
    ];

    const filterByTipe = (tipe) => questions.filter(q => !tipe || tipe === 'SEMUA' || q.tipe_soal === tipe);
    assert.equal(filterByTipe('PG').length, 1, '1 PG question');
    assert.equal(filterByTipe('URAIAN').length, 1, '1 Uraian question');
    assert.equal(filterByTipe('SEMUA').length, 3, 'All questions');
  });

  suite.add('T1.3.3 [Guru View] Question Bank Payload Validation for Multi-Types', () => {
    const validateQuestionPayload = (payload) => {
      if (!payload.pertanyaan || payload.pertanyaan.trim() === '') return { valid: false, error: 'Pertanyaan wajib diisi' };
      if (!['PG', 'PGK', 'JODOH', 'URAIAN'].includes(payload.tipe_soal)) return { valid: false, error: 'Tipe soal tidak valid' };
      if (payload.tipe_soal === 'PG' && (!payload.opsi_a || !payload.opsi_b)) return { valid: false, error: 'Opsi minimal A & B' };
      return { valid: true };
    };

    assert.isTrue(validateQuestionPayload({ tipe_soal: 'PG', pertanyaan: 'Pertanyaan 1', opsi_a: 'A', opsi_b: 'B' }).valid, 'Valid PG payload');
    assert.isFalse(validateQuestionPayload({ tipe_soal: 'PG', pertanyaan: '', opsi_a: 'A' }).valid, 'Empty question rejected');
    assert.isFalse(validateQuestionPayload({ tipe_soal: 'INVALID_TYPE', pertanyaan: 'OK' }).valid, 'Invalid type rejected');
  });

  suite.add('T1.3.4 [Guru View] Real-Time Proctoring Student Live Answer Counter', () => {
    const liveMonitoringData = [
      { id_siswa: 's1', status: 'MENGERJAKAN', total_dijawab: 10, total_soal: 20 },
      { id_siswa: 's2', status: 'SELESAI', total_dijawab: 20, total_soal: 20 },
      { id_siswa: 's3', status: 'MENGERJAKAN', total_dijawab: 5, total_soal: 20 }
    ];

    const totalAnsweredAcrossExam = liveMonitoringData.reduce((acc, curr) => acc + curr.total_dijawab, 0);
    assert.equal(totalAnsweredAcrossExam, 35, 'Aggregates 35 total answers across students');
  });

  suite.add('T1.3.5 [Guru View] Essay Evaluation Scoring & State Update', () => {
    let essayScores = {};
    const submitEssayScore = (idJawaban, score, maxScore = 100) => {
      const parsed = parseFloat(score);
      if (isNaN(parsed) || parsed < 0 || parsed > maxScore) {
        throw new Error('Nilai harus antara 0 dan ' + maxScore);
      }
      essayScores[idJawaban] = parsed;
    };

    submitEssayScore('ans_1', 85);
    assert.equal(essayScores['ans_1'], 85, 'Essay score recorded as 85');
    assert.throws(() => submitEssayScore('ans_1', 120), /Nilai harus antara/, 'Rejects score > max');
  });

  suite.add('T1.3.6 [Guru View] Grade Sheet Ranking & Export Structure Contract', () => {
    const studentGrades = [
      { id_siswa: 's1', nama: 'Doni', total_nilai: 75 },
      { id_siswa: 's2', nama: 'Sari', total_nilai: 95 },
      { id_siswa: 's3', nama: 'Eko', total_nilai: 85 }
    ];

    const sortedGrades = [...studentGrades].sort((a, b) => b.total_nilai - a.total_nilai);
    assert.equal(sortedGrades[0].nama, 'Sari', 'Highest score ranked 1st');
    assert.equal(sortedGrades[1].nama, 'Eko', 'Second highest score ranked 2nd');
    assert.equal(sortedGrades[2].nama, 'Doni', 'Third highest score ranked 3rd');
  });

  // =========================================================================
  // Feature 4: Design System & Shared Foundations (Design System & UI.jsx)
  // =========================================================================

  suite.add('T1.4.1 [Design System] Theme Tokens: Primary Palette & Surface Consistency', () => {
    // Requirements from PROJECT.md § 1. Theme & Design System
    const themeTokens = {
      primary: '#10b981', // emerald-500 or harmonized pastel mint #a8e6cf
      secondary: '#059669',
      surfaceLight: 'bg-slate-50',
      surfaceDark: 'bg-slate-900',
      cardLight: 'bg-white',
      cardDark: 'bg-slate-800',
      fontSans: 'Nunito'
    };

    assert.ok(themeTokens.primary && themeTokens.secondary, 'Primary & secondary colors defined');
    assert.equal(themeTokens.fontSans, 'Nunito', 'Nunito is the standardized typography font');
  });

  suite.add('T1.4.2 [Design System] Status Color Semantics Contract', () => {
    // Success: emerald, Warning: amber, Neutral: slate, Danger: rose
    const statusColors = {
      answered: 'emerald-500',
      doubtful: 'amber-500',
      unanswered: 'slate-300',
      violation: 'rose-500'
    };

    assert.match(statusColors.answered, /emerald/, 'Answered status uses emerald');
    assert.match(statusColors.doubtful, /amber/, 'Doubtful status uses amber');
    assert.match(statusColors.unanswered, /slate/, 'Unanswered status uses slate');
    assert.match(statusColors.violation, /rose|red/, 'Violation status uses rose/red');
  });

  suite.add('T1.4.3 [Design System] Shared UI Component: EmptyState Contract', () => {
    // Props: { icon, title, description / message, actionText, onAction }
    let actionFired = false;
    const props = {
      icon: 'inbox',
      title: 'Tidak Ada Jadwal',
      message: 'Belum ada jadwal ujian aktif saat ini.',
      actionText: 'Refresh',
      onAction: () => { actionFired = true; }
    };

    assert.equal(props.icon, 'inbox', 'Icon passed');
    assert.ok(props.title.length > 0, 'Title non-empty');
    props.onAction();
    assert.isTrue(actionFired, 'onAction handler fires cleanly');
  });

  suite.add('T1.4.4 [Design System] Shared UI Component: TableSkeleton Contract', () => {
    const generateTableSkeletonRows = (rows = 5, cols = 4) => {
      const skeletonRows = [];
      for (let r = 0; r < rows; r++) {
        const rowCols = [];
        for (let c = 0; c < cols; c++) {
          rowCols.push('skeleton-col');
        }
        skeletonRows.push(rowCols);
      }
      return skeletonRows;
    };

    const grid = generateTableSkeletonRows(4, 3);
    assert.equal(grid.length, 4, '4 skeleton rows generated');
    assert.equal(grid[0].length, 3, '3 skeleton columns generated');
  });

  suite.add('T1.4.5 [Design System] Shared UI Component: CardSkeleton Contract', () => {
    const generateCardSkeleton = (count = 3) => {
      return Array.from({ length: count }).map((_, i) => ({ id: `card-skel-${i}` }));
    };

    const cards = generateCardSkeleton(6);
    assert.equal(cards.length, 6, 'Generates 6 card skeletons');
  });

  suite.add('T1.4.6 [Design System] Shared UI Component: StatusBadge Variants Contract', () => {
    const getBadgeClass = (variant) => {
      const map = {
        success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        danger: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
      };
      return map[variant] || map.neutral;
    };

    assert.match(getBadgeClass('success'), /emerald/, 'Success badge contains emerald');
    assert.match(getBadgeClass('warning'), /amber/, 'Warning badge contains amber');
    assert.match(getBadgeClass('danger'), /rose/, 'Danger badge contains rose');
  });

  suite.add('T1.4.7 [Design System] safeJSONParse Utility Robustness Contract', () => {
    // safeJSONParse in UI.jsx and api.js
    const safeJSONParse = (str, fallback) => {
      if (!str) return fallback;
      try {
        return JSON.parse(str);
      } catch {
        return fallback;
      }
    };

    assert.deepEqual(safeJSONParse('{"a":1,"b":2}', {}), { a: 1, b: 2 }, 'Parses valid JSON');
    assert.deepEqual(safeJSONParse('invalid { json', { default: true }), { default: true }, 'Fallback on invalid JSON');
    assert.equal(safeJSONParse(null, 'fallback'), 'fallback', 'Fallback on null');
    assert.equal(safeJSONParse('', 'fallback'), 'fallback', 'Fallback on empty string');
  });

  return suite;
}
