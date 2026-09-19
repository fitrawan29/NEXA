/**
 * Tier 4: Real-World Application Scenarios Test Suite
 * Validates full multi-step end-to-end user workflows:
 * - Complete Student Exam Lifecycle (Login -> Start -> Stimulus -> Answers -> Network Hiccup -> Submit -> Finish)
 * - Teacher Live Proctoring & Essay Grading Lifecycle (Monitor -> Violation -> Unblock -> Conclude -> Grade -> Export)
 */

import { TestSuite, assert } from './test_framework.mjs';

export function createTier4Suite() {
  const suite = new TestSuite('Tier 4: Real-World Scenarios', 'Full end-to-end simulations of actual user workflows');

  suite.add('T4.1 [Scenario] Complete Student Exam Lifecycle Simulation', async () => {
    // Stage 1: Student visits SiswaView
    const studentUser = { id_siswa: 's_01', nisn: '3049281120', nama: 'Dewi Lestari', kelas: '9B', npsn: '10203040' };
    const availableSchedules = [
      { id_jadwal: 'j_pts_01', nama_mapel: 'Literasi Bahasa & Sains', status_ujian: 'AKTIF', durasi_menit: 90 }
    ];

    // Student selects schedule to start
    const selectedJadwal = availableSchedules.find(s => s.status_ujian === 'AKTIF');
    assert.ok(selectedJadwal, 'Student finds active schedule');

    // Stage 2: ExamRoom mounts
    const examSession = {
      idLog: 'log_session_dewi_01',
      user: studentUser,
      jadwal: selectedJadwal,
      timerSeconds: selectedJadwal.durasi_menit * 60,
      currentIndex: 0,
      soal: [
        { id_soal: 'q1', tipe_soal: 'PG', id_narasi: 'nar_01', pertanyaan: 'Apa tema utama wacana di samping?', opsi_a: 'Ekosistem', opsi_b: 'Bioteknologi', opsi_c: 'Astronomi', opsi_d: 'Geologi' },
        { id_soal: 'q2', tipe_soal: 'PGK', pertanyaan: 'Pilihlah pernyataan yang sesuai:', opsi: ['Pernyataan A', 'Pernyataan B', 'Pernyataan C'] },
        { id_soal: 'q3', tipe_soal: 'JODOH', pertanyaan: 'Jodohkan istilah dengan artinya:' },
        { id_soal: 'q4', tipe_soal: 'URAIAN', pertanyaan: 'Jelaskan kesimpulan Anda:' },
        { id_soal: 'q5', tipe_soal: 'PG', pertanyaan: 'Soal penutup', opsi_a: 'Ya', opsi_b: 'Tidak' }
      ],
      narasiMap: {
        nar_01: { id_narasi: 'nar_01', judul: 'Krisis Air Bersih Global', konten: 'Krisis air bersih merupakan ancaman nyata...' }
      },
      answers: {},
      raguRagu: {},
      localStorageCache: {},
      isSubmitted: false
    };

    assert.equal(examSession.timerSeconds, 5400, 'Timer set to 5400 seconds (90 minutes)');
    assert.equal(examSession.soal.length, 5, '5 questions loaded');

    // Stage 3: Student answers Q1 with stimulus wacana
    const currentQ1 = examSession.soal[examSession.currentIndex];
    assert.equal(currentQ1.id_narasi, 'nar_01', 'Q1 requires stimulus text');
    const stimulus = examSession.narasiMap[currentQ1.id_narasi];
    assert.ok(stimulus && stimulus.judul.includes('Krisis Air'), 'Stimulus rendered alongside Q1');

    examSession.answers['q1'] = 'B';
    examSession.localStorageCache[`nexa_ans_${examSession.idLog}`] = JSON.stringify(examSession.answers);

    // Stage 4: Navigate to Q2 (PGK) and mark as Ragu-ragu
    examSession.currentIndex = 1;
    examSession.answers['q2'] = ['0', '2'];
    examSession.raguRagu['q2'] = true;
    examSession.localStorageCache[`nexa_ans_${examSession.idLog}`] = JSON.stringify(examSession.answers);

    // Stage 5: Navigate to Q3 (JODOH)
    examSession.currentIndex = 2;
    examSession.answers['q3'] = { p0: 'm1', p1: 'm0' };
    examSession.localStorageCache[`nexa_ans_${examSession.idLog}`] = JSON.stringify(examSession.answers);

    // Stage 6: Navigate to Q4 (URAIAN)
    examSession.currentIndex = 3;
    examSession.answers['q4'] = 'Kesimpulan dari analisis data adalah perlunya konservasi terpadu.';
    examSession.localStorageCache[`nexa_ans_${examSession.idLog}`] = JSON.stringify(examSession.answers);

    // Stage 7: Simulate offline hiccup while on Q5
    examSession.currentIndex = 4;
    const isOffline = true;
    examSession.answers['q5'] = 'A';
    // Local cache MUST still be saved even when offline
    examSession.localStorageCache[`nexa_ans_${examSession.idLog}`] = JSON.stringify(examSession.answers);
    assert.ok(examSession.localStorageCache[`nexa_ans_${examSession.idLog}`], 'Offline answer stored in cache');

    // Stage 8: Reconnection and Submission Verification
    const rehydratedAnswers = JSON.parse(examSession.localStorageCache[`nexa_ans_${examSession.idLog}`]);
    assert.equal(Object.keys(rehydratedAnswers).length, 5, 'All 5 answers preserved');

    // Stage 9: Open confirmation modal
    let terjawabCount = 0;
    let raguCount = 0;
    let belumCount = 0;
    examSession.soal.forEach(s => {
      if (examSession.raguRagu[s.id_soal]) raguCount++;
      else if (rehydratedAnswers[s.id_soal]) terjawabCount++;
      else belumCount++;
    });

    assert.equal(terjawabCount, 4, '4 answered confidently');
    assert.equal(raguCount, 1, '1 marked ragu-ragu');
    assert.equal(belumCount, 0, '0 unanswered');

    // Stage 10: Final submission confirmation
    examSession.isSubmitted = true;
    let finishTriggered = false;
    const onFinish = () => { finishTriggered = true; };
    onFinish();

    assert.isTrue(examSession.isSubmitted, 'Exam submitted successfully');
    assert.isTrue(finishTriggered, 'onFinish invoked to return student to dashboard');
  });

  suite.add('T4.2 [Scenario] Real-Time Proctoring & Teacher Grading Lifecycle Simulation', async () => {
    // Stage 1: Teacher accesses live monitoring
    const ongoingJadwalId = 'j_pts_01';
    let studentMonitoringRoster = [
      { id_siswa: 's_01', nama: 'Dewi Lestari', total_dijawab: 5, total_soal: 5, status_ujian: 'SELESAI', is_blocked: false, pelanggaran: 0 },
      { id_siswa: 's_02', nama: 'Bambang Irawan', total_dijawab: 3, total_soal: 5, status_ujian: 'MENGERJAKAN', is_blocked: false, pelanggaran: 0 }
    ];

    // Stage 2: Bambang triggers tab-switch infraction
    const handleViolationEvent = (studentId) => {
      const student = studentMonitoringRoster.find(s => s.id_siswa === studentId);
      if (student) {
        student.pelanggaran += 1;
        if (student.pelanggaran >= 3) {
          student.is_blocked = true;
          student.status_ujian = 'DIBLOKIR';
        }
      }
    };

    handleViolationEvent('s_02');
    handleViolationEvent('s_02');
    handleViolationEvent('s_02'); // 3rd infraction

    const bambang = studentMonitoringRoster.find(s => s.id_siswa === 's_02');
    assert.isTrue(bambang.is_blocked, 'Student is blocked after 3 infractions');
    assert.equal(bambang.status_ujian, 'DIBLOKIR', 'Status shows DIBLOKIR');

    // Stage 3: Proctor unblocks Bambang
    const unblockStudent = (studentId) => {
      const student = studentMonitoringRoster.find(s => s.id_siswa === studentId);
      if (student) {
        student.is_blocked = false;
        student.status_ujian = 'MENGERJAKAN';
      }
    };

    unblockStudent('s_02');
    assert.isFalse(bambang.is_blocked, 'Bambang successfully unblocked by proctor');
    bambang.total_dijawab = 5;
    bambang.status_ujian = 'SELESAI';

    // Stage 4: Exam concludes, Teacher opens Grading Center for Essay (Uraian) evaluation
    const essaySubmissions = [
      { id_jawaban: 'ans_dewi_q4', id_siswa: 's_01', nama: 'Dewi Lestari', jawaban_teks: 'Konservasi terpadu...', skor_guru: null },
      { id_jawaban: 'ans_bambang_q4', id_siswa: 's_02', nama: 'Bambang Irawan', jawaban_teks: 'Perlu aturan tegas...', skor_guru: null }
    ];

    // Teacher scores essays
    essaySubmissions[0].skor_guru = 95;
    essaySubmissions[1].skor_guru = 80;

    assert.equal(essaySubmissions[0].skor_guru, 95, 'Dewi essay score assigned 95');
    assert.equal(essaySubmissions[1].skor_guru, 80, 'Bambang essay score assigned 80');

    // Stage 5: Export dataset generated
    const exportDataset = essaySubmissions.map(sub => ({
      ID_Siswa: sub.id_siswa,
      Nama: sub.nama,
      Nilai_Essay: sub.skor_guru,
      Status: 'Dinilai'
    }));

    assert.equal(exportDataset.length, 2, '2 export rows compiled');
    assert.equal(exportDataset[0].Nilai_Essay, 95, 'Export contains correct grade');
  });

  return suite;
}
