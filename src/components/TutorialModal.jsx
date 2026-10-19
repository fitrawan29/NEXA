import React, { useState, useEffect } from 'react';

/**
 * TutorialModal - Comprehensive Interactive Multi-Role Step-by-Step Guide
 * Supports: Admin, Guru, Siswa, Super Admin
 *
 * Fully responsive, keyboard navigable (Esc to close), dark-mode enabled,
 * zero external dependencies.
 */

const ROLE_THEMES = {
  admin: {
    name: 'Admin Sekolah',
    badge: 'Admin',
    color: 'blue',
    icon: 'admin_panel_settings',
    bgActive: 'bg-blue-600 text-white shadow-blue-500/20',
    borderActive: 'border-blue-600',
    textAccent: 'text-blue-600 dark:text-blue-400',
    cardBg: 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/50',
    btnPrimary: 'bg-blue-600 hover:bg-blue-700 text-white'
  },
  guru: {
    name: 'Guru Pengampu / Pengawas',
    badge: 'Guru',
    color: 'amber',
    icon: 'school',
    bgActive: 'bg-amber-600 text-white shadow-amber-500/20',
    borderActive: 'border-amber-600',
    textAccent: 'text-amber-600 dark:text-amber-400',
    cardBg: 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/50',
    btnPrimary: 'bg-amber-600 hover:bg-amber-700 text-white'
  },
  siswa: {
    name: 'Siswa Peserta Ujian',
    badge: 'Siswa',
    color: 'emerald',
    icon: 'person',
    bgActive: 'bg-emerald-600 text-white shadow-emerald-500/20',
    borderActive: 'border-emerald-600',
    textAccent: 'text-emerald-600 dark:text-emerald-400',
    cardBg: 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/50',
    btnPrimary: 'bg-emerald-600 hover:bg-emerald-700 text-white'
  },
  super_admin: {
    name: 'Super Admin',
    badge: 'Super Admin',
    color: 'purple',
    icon: 'shield_person',
    bgActive: 'bg-purple-600 text-white shadow-purple-500/20',
    borderActive: 'border-purple-600',
    textAccent: 'text-purple-600 dark:text-purple-400',
    cardBg: 'bg-purple-50/60 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/50',
    btnPrimary: 'bg-purple-600 hover:bg-purple-700 text-white'
  }
};

const TUTORIAL_DATA = {
  admin: [
    {
      title: 'Pengelolaan Data Master Sekolah',
      shortTitle: 'Data Master',
      icon: 'database',
      subtitle: 'Entri massal dan manajemen siswa, guru, mapel, serta kelas',
      points: [
        'Gunakan tombol "Import Excel" pada tab Siswa, Guru, Mapel, dan Jadwal untuk mengunggah ratusan hingga ribuan data sekaligus tanpa perlu entri manual satu per satu.',
        'Unduh template Excel resmi yang disediakan sistem agar susunan kolom sesuai dengan skema database.',
        'Atur pembagian kelas paralel (misal: X A, X B, X C) per tingkat secara fleksibel menggunakan checkbox group terstruktur.',
        'Kelola penugasan mata pelajaran ke guru pengampu agar alokasi jadwal dan bank soal otomatis terhubung.'
      ],
      tip: 'Sebelum mengimpor data siswa massal, pastikan seluruh data Kelas sudah dibuat agar siswa otomatis terdaftar ke rombel yang valid.'
    },
    {
      title: 'Penjadwalan Ujian & Auto-Select Guru Pengampu',
      shortTitle: 'Penjadwalan',
      icon: 'calendar_month',
      subtitle: 'Alokasi cerdas pengampu dan penargetan multi-kelas paralel',
      points: [
        'Saat membuat jadwal baru dan memilih Mata Pelajaran, sistem secara otomatis mencocokkan dan memilih Guru Pengampu mata pelajaran tersebut (auto-select pengampu).',
        'Admin tetap memiliki kebebasan penuh untuk mengganti pilihan guru pengampu secara manual jika diperlukan penugasan khusus.',
        'Target kelas mendukung multi-kelas paralel spesifik (misal: "XI A, XI B") maupun seluruh tingkat ("Tingkat XI (Semua)").',
        'Atur durasi ujian, tanggal mulai/selesai, serta tanggal kedaluwarsa token ujian secara presisi.'
      ],
      tip: 'Token ujian dapat di-generate otomatis dan dibagikan sesaat sebelum ujian dimulai untuk mencegah kebocoran sesi.'
    },
    {
      title: 'Profil Sekolah, Alamat & Konfigurasi Kop',
      shortTitle: 'Profil & Kop',
      icon: 'settings',
      subtitle: 'Format resmi kop dokumen surat dan kartu ujian berlogo',
      points: [
        'Field Alamat Sekolah wajib diisi lengkap (Jalan, Kecamatan, Kota/Kabupaten, Provinsi) karena otomatis tercetak pada kop resmi Berita Acara dan Kartu Ujian.',
        'Unggah Logo Dinas (kiri) dan Logo Sekolah (kanan) via native image compression tanpa membebani penyimpanan.',
        'Fitur Pratinjau Kop langsung (Live Preview) menampilkan tampilan kop kartu peserta dan dokumen resmi sebelum dicetak.',
        'Aktifkan opsi toggle Tampilkan Logo Kiri/Kanan sesuai kebutuhan regulasi administrasi instansi Anda.'
      ],
      tip: 'Perubahan alamat dan konfigurasi kop langsung tersinkronisasi ke seluruh dokumen cetak tanpa perlu me-reset jadwal.'
    },
    {
      title: 'Monitoring Real-Time & Proctoring HUD',
      shortTitle: 'Monitoring Live',
      icon: 'monitoring',
      subtitle: 'Pengawasan live status pengerjaan dan intervensi peserta',
      points: [
        'Pantau metrik langsung di HUD: Total Peserta, Sedang Mengerjakan, Selesai, dan Terblokir.',
        'Sistem anti-curang otomatis mendeteksi pelanggaran tab switching atau blur dengan grace period 3 detik.',
        'Jika siswa terkunci akibat melanggar aturan 3-strike, Admin dapat menggunakan tombol "Buka Blokir" atau "Reset Sesi" langsung dari dashboard.',
        'Aksi Reset Sesi memungkinkan siswa langsung login kembali dan melanjutkan pengerjaan tanpa kehilangan riwayat jawaban.'
      ],
      tip: 'Gunakan filter kelas atau pencarian nama/NISN pada tabel peserta untuk mempercepat pencarian siswa saat ujian massal.'
    },
    {
      title: 'Cetak Kartu Ujian & Berkas Pengawasan Pasca-Ujian',
      shortTitle: 'Cetak Dokumen',
      icon: 'print',
      subtitle: 'Pencetakan kartu peserta, kartu meja, dan berkas berita acara resmi',
      points: [
        'Cetak Kartu Peserta dan Kartu Meja ujian dengan tata letak presisi 8 kartu per lembar A4/F4 siap potong tanpa page-break overflow.',
        'Pasca-ujian selesai, Admin dapat mencetak seluruh berkas pengawasan: Berita Acara Ujian, Daftar Hadir bertanda tangan digital siswa, foto live dokumentasi, dan Catatan Pengawas.',
        'Gunakan Room Picker modal pada jadwal multi-ruang untuk memilih dan mencetak dokumen pengawasan per ruangan tertentu.',
        'Format cetak telah dioptimasi dengan CSS @media print standar ISO A4/F4 siap arsip atau PDF.'
      ],
      tip: 'Gunakan dialog cetak browser (Ctrl+P) dengan opsi "Print to PDF" untuk membuat arsip digital dokumen pengawasan resmi.'
    }
  ],

  guru: [
    {
      title: 'Hak Akses Khusus Mapel yang Diampu (Subject Scoping)',
      shortTitle: 'Hak Akses Mapel',
      icon: 'lock',
      subtitle: 'Isolasi akses demi privasi dan keamanan data antar guru',
      points: [
        'Guru hanya memiliki hak akses untuk melihat dan mengelola bank soal, jadwal ujian, dan evaluasi nilai pada mata pelajaran yang ditugaskan/diampunya.',
        'Data bank soal dari guru atau mata pelajaran lain terlindungi secara ketat dari modifikasi yang tidak disengaja.',
        'Guru pengampu tetap dapat mengakses dan mencetak berkas pengawasan lengkap pasca-ujian untuk mata pelajaran yang diampunya.',
        'Gunakan dropdown pemilih mapel di header bank soal untuk beralih antara mata pelajaran yang Anda ampu.'
      ],
      tip: 'Jika ada mata pelajaran baru yang belum muncul di dashboard Anda, koordinasikan dengan Admin Sekolah untuk alokasi mapel.'
    },
    {
      title: 'Bank Soal & Unggah Gambar Terstruktur ke Google Drive',
      shortTitle: 'Bank Soal & Drive',
      icon: 'quiz',
      subtitle: 'Hierarki penyimpanan NEXA > [Nama Sekolah] > [Kelas] > [Mata Pelajaran] dengan fallback aman',
      points: [
        'Mendukung 6 tipe butir soal: Pilihan Ganda (PG), PG Kompleks (PGK), Benar/Salah (BS), Menjodohkan, Isian Singkat, dan Uraian.',
        'Saat mengunggah gambar soal, sistem otomatis mengompres gambar dan mengunggahnya ke Google Drive via GAS Webhook.',
        'Berkas gambar diorganisir otomatis dalam hierarki folder Google Drive: NEXA > [Nama Sekolah] > [Kelas] > [Mata Pelajaran].',
        'Dilengkapi fallback lokal otomatis: jika webhook Drive belum diisi atau koneksi offline, gambar tetap tersimpan di penyimpanan lokal tanpa menghambat pekerjaan Anda.'
      ],
      tip: 'Manfaatkan fitur Narasi Soal bersama untuk butir-butir soal yang mengacu pada wacana atau bacaan teks panjang yang sama.'
    },
    {
      title: 'Skema Penilaian (Per Mapel & Serentak Semua Mapel)',
      shortTitle: 'Skema Penilaian',
      icon: 'tune',
      subtitle: 'Kustomisasi pembobotan tipe soal secara tunggal atau massal',
      points: [
        'Pilih mode Proporsional (poin murni) atau mode Kustom (bobot persentase per tipe soal dengan validasi total 100%).',
        'Tombol "Simpan Mapel Ini": Menyimpan pembobotan khusus untuk mata pelajaran yang sedang aktif dibuka.',
        'Tombol "Terapkan ke Semua Mapel yang Diampu": Menyelaraskan pembobotan nilai tersebut ke seluruh mata pelajaran yang Anda ampu hanya dengan satu kali klik.',
        'Sistem secara otomatis membuat atau memperbarui record skema penilaian untuk setiap mapel yang bersangkutan.'
      ],
      tip: 'Pada mode Kustom, pastikan total akumulasi persentase seluruh tipe soal tepat 100% sebelum menekan tombol simpan.'
    },
    {
      title: 'Tugas Pengawasan Ruang (Multi-Pengawas, Tanda Tangan & Kamera Live)',
      shortTitle: 'Pengawasan Ruang',
      icon: 'visibility',
      subtitle: 'Proctoring kolaboratif, kehadiran digital siswa, dan foto live ber-watermark',
      points: [
        'Satu ruang ujian dapat diawasi oleh lebih dari satu guru pengawas; pengisian Berita Acara cukup diwakili oleh salah satu pengawas yang bertugas.',
        'Periksa dan verifikasi presensi kehadiran siswa berdasarkan coretan tanda tangan digital pra-ujian yang masuk ke daftar hadir.',
        'Gunakan fitur Kamera Live WebRTC untuk mengambil foto dokumentasi ruangan langsung dari browser ponsel atau laptop pengawas.',
        'Foto otomatis diberi watermark teks (waktu, tanggal, nama ruang) dan diunggah ke Google Drive dalam hierarki folder NEXA > [Nama Sekolah] > [Kelas] > [Mata Pelajaran] (dengan fallback aman ke data URL lokal).',
        'Bubuhkan tanda tangan digital pengawas pada kanvas dan simpan Berita Acara Ujian.'
      ],
      tip: 'Jika kamera WebRTC perangkat tidak merespons, gunakan tombol upload foto fallback yang tetap menyematkan watermark otomatis.'
    },
    {
      title: 'Akses & Cetak Berkas Pengawasan Mapel Pasca-Ujian',
      shortTitle: 'Berkas Pasca-Ujian',
      icon: 'description',
      subtitle: 'Pemeriksaan dan pencetakan dokumen pengawasan bagi guru pengampu',
      points: [
        'Guru pengampu mata pelajaran dapat melihat, memeriksa, dan mencetak dokumen pengawasan lengkap pasca-ujian untuk jadwal mapelnya.',
        'Tombol cetak tersedia langsung pada daftar jadwal dan riwayat hasil evaluasi guru pengampu.',
        'Dokumen cetak mencakup: Berita Acara Ujian, Daftar Hadir bertanda tangan digital siswa, foto live ber-watermark, dan Catatan Pengawas.',
        'Identitas kop surat, alamat sekolah, kelas, dan mata pelajaran tercetak secara tegas dan proporsional.'
      ],
      tip: 'Arsip cetak pengawasan dapat disimpan sebagai bukti fisik autentik pelaksanaan ujian kepada dinas pendidikan atau pimpinan sekolah.'
    },
    {
      title: 'Rekap Nilai Siswa & Koreksi Soal Uraian',
      shortTitle: 'Rekap & Uraian',
      icon: 'fact_check',
      subtitle: 'Penilaian otomatis, koreksi esai subjektif, dan ekspor buku nilai',
      points: [
        'Soal bertipe PG, PGK, BS, Jodoh, dan Isian dinilai secara instan dan otomatis oleh sistem perolehan skor.',
        'Untuk butir soal Uraian, guru memberikan nilai secara manual melalui antarmuka koreksi interaktif dengan batas nilai sesuai bobot soal.',
        'Periksa rekap nilai terperinci lengkap dengan statistik ketuntasan nilai (rata-rata, tertinggi, terendah).',
        'Ekspor seluruh hasil ujian siswa ke berkas spreadsheet Excel untuk keperluan pengisian rapor atau buku nilai.'
      ],
      tip: 'Gunakan tab Analisis Soal untuk mengevaluasi butir soal mana yang paling sering dijawab salah oleh siswa.'
    }
  ],

  siswa: [
    {
      title: 'Login Akun Siswa CBT',
      shortTitle: 'Login Akun',
      icon: 'login',
      subtitle: 'Persiapan dan autentikasi sebelum masuk ruang ujian',
      points: [
        'Masuk menggunakan Username/NISN dan Password yang tercantum pada Kartu Peserta Ujian Anda.',
        'Pilih sekolah yang terdaftar jika Anda masuk melalui portal multi-sekolah.',
        'Gunakan ikon mata pada form password untuk memastikan ketikan password sudah benar.',
        'Pastikan identitas nama lengkap, kelas, dan foto profil yang tampil di pojok kanan atas sesuai dengan data diri Anda.'
      ],
      tip: 'Jika Anda lupa password atau akun terblokir, segera lapor ke guru pengawas di ruangan untuk di-reset.'
    },
    {
      title: 'Presensi & Tanda Tangan Digital Wajib Pra-Ujian',
      shortTitle: 'Presensi Digital',
      icon: 'draw',
      subtitle: 'Syarat mutlak sebelum soal ujian dapat dibuka dan dikerjakan',
      points: [
        'Pilih jadwal ujian aktif dan masukkan Token Ujian yang diumumkan oleh pengawas ruang.',
        'Sebelum soal ujian terbuka, Anda WAJIB membubuhkan tanda tangan kehadiran pada kanvas digital di layar perangkat.',
        'Gunakan ujung jari pada layar sentuh (HP/tablet) atau kursor mouse pada laptop untuk membuat coretan tanda tangan.',
        'Tekan tombol "Kirim Kehadiran & Mulai Ujian" — tanda tangan Anda otomatis diteruskan ke daftar hadir pengawas ruang.'
      ],
      tip: 'Jika coretan tanda tangan kurang rapi, tekan tombol "Hapus / Ulangi" sebelum mengirimkan presensi.'
    },
    {
      title: 'Ruang Ujian & Manajemen Waktu',
      shortTitle: 'Ruang Ujian',
      icon: 'timer',
      subtitle: 'Navigasi soal, server time guard, dan wacana stimulus',
      points: [
        'Sisa waktu ujian dipantau oleh Server Time Guard yang tersinkronisasi dengan server (tidak dapat dimanipulasi dengan mengubah jam di HP/laptop).',
        'Panel Nomor Soal (Navigator Grid) menampilkan status warna: Abu-abu (belum dijawab), Hijau (sudah dijawab), Kuning (ragu-ragu).',
        'Jika soal memiliki bacaan panjang, klik tombol "Narasi Soal" di atas lembar soal untuk membaca teks stimulus bersama.',
        'Gunakan tombol "Ragu-ragu" pada soal yang belum yakin agar mudah ditemukan kembali sebelum mengumpulkan jawaban.'
      ],
      tip: 'Jangan panik jika waktu tinggal sedikit; indikator waktu akan berubah warna secara tenang tanpa animasi kedip yang mengganggu konsentrasi.'
    },
    {
      title: 'Petunjuk Menjawab Berbagai Tipe Soal',
      shortTitle: 'Tipe Soal',
      icon: 'check_circle',
      subtitle: 'Cara menjawab 6 format tipe soal yang berbeda',
      points: [
        'Pilihan Ganda (PG): Pilih salah satu opsi jawaban lingkaran radio (A, B, C, D, atau E).',
        'PG Kompleks (PGK): Centang kotak untuk semua jawaban yang Anda anggap benar (minimal 2 jawaban benar).',
        'Benar / Salah (BS): Pilih label "Benar" atau "Salah" pada pernyataan yang disajikan.',
        'Menjodohkan (Jodoh): Pasangkan setiap premis di sebelah kiri dengan pilihan respon yang tepat di dropdown sebelah kanan.',
        'Isian Singkat & Uraian: Ketikkan jawaban langsung pada kolom teks yang disediakan di bawah soal.'
      ],
      tip: 'Jawaban Anda tersimpan otomatis secara berkala ke database, sehingga aman meskipun perangkat sempat tidak sengaja ter-reload.'
    },
    {
      title: 'Protokol Keamanan Ujian (Anti-Kecurangan 3-Strike)',
      shortTitle: 'Keamanan Ujian',
      icon: 'security',
      subtitle: 'Aturan ketat integritas ujian dan pencegahan kecurangan',
      points: [
        'Dilarang berpindah tab browser, membuka aplikasi lain, atau keluar dari jendela ujian (split screen, floating app, atau floating window).',
        'Sistem mendeteksi saat jendela ujian kehilangan fokus dengan toleransi jeda waktu 3 detik (grace period).',
        'Jika Anda tidak segera kembali ke ujian dalam 3 detik, peringatan pelanggaran resmi akan dicatat di server.',
        'PERINGATAN: Jika pelanggaran terjadi lebih dari 3 kali (3-strike), ujian otomatis dihentikan permanen dan Anda mendapatkan nilai akhir 0 di server!'
      ],
      tip: 'Matikan seluruh notifikasi WhatsApp, media sosial, atau aplikasi mengambang di HP Anda sebelum ujian dimulai agar tidak memicu deteksi blur.'
    },
    {
      title: 'Selesai Ujian & Pengumpulan Jawaban',
      shortTitle: 'Selesai Ujian',
      icon: 'task_alt',
      subtitle: 'Pemeriksaan akhir dan konfirmasi penyerahan ujian',
      points: [
        'Sebelum mengakhiri, periksa kembali Navigator Soal untuk memastikan semua nomor sudah berwarna hijau (tidak ada yang terlewat).',
        'Pada nomor soal terakhir atau melalui navigasi bawah, tekan tombol "Selesai Ujian".',
        'Konfirmasi pengumpulan jawaban pada kotak dialog yang muncul.',
        'Setelah dikonfirmasi, sesi ujian ditutup dan Anda akan diarahkan kembali ke halaman dasbor siswa.'
      ],
      tip: 'Laporkan kepada guru pengawas di ruangan bahwa Anda telah berhasil menekan tombol Selesai Ujian sebelum meninggalkan ruang.'
    }
  ],

  super_admin: [
    {
      title: 'Manajemen Aktivasi Sekolah & NPSN',
      shortTitle: 'Akun Sekolah',
      icon: 'apartment',
      subtitle: 'Pengelolaan entitas sekolah dan lisensi CBT tingkat global',
      points: [
        'Menambahkan akun sekolah baru, mendaftarkan NPSN, dan mengaktifkan status operasional sekolah.',
        'Mendukung fitur penghapusan berantai (cascade deletion): jika akun sekolah dihapus permanen, seluruh entitas turunan (siswa, guru, jadwal, nilai) dibersihkan tanpa meninggalkan orphan data.',
        'Kelola kuota peserta dan data autentikasi admin sekolah secara terpusat.'
      ],
      tip: 'Gunakan fitur pencarian NPSN atau nama sekolah untuk navigasi cepat di daftar sekolah.'
    },
    {
      title: 'Dasbor Statistik & Analytics Global',
      shortTitle: 'Analytics Global',
      icon: 'insights',
      subtitle: 'Visibilitas performa sistem dan beban server lintas instansi',
      points: [
        'Pantau jumlah ujian aktif yang berlangsung serentak (concurrent sessions) dari seluruh sekolah terdaftar.',
        'Pantau total akumulasi peserta ujian, total guru, dan aktivitas server secara real-time.',
        'Deteksi anomali penggunaan sistem atau lonjakan beban trafik jaringan secara dini.'
      ],
      tip: 'Perhatikan grafik puncak ujian di pagi hari untuk memastikan alokasi bandwidth server Supabase memadai.'
    },
    {
      title: 'Pencadangan & Pemeliharaan Database',
      shortTitle: 'Backup & Restore',
      icon: 'cloud_sync',
      subtitle: 'Pencadangan berkala untuk menjaga kesinambungan data operasional',
      points: [
        'Lakukan backup data struktural Supabase secara rutin menjelang pekan ujian massal.',
        'Pastikan cadangan skema dan data konfigurasi tersimpan aman di penyimpanan terpisah.',
        'Sediakan rencana pemulihan (disaster recovery) jika terjadi kendala teknis darurat di server.'
      ],
      tip: 'Selalu lakukan pencadangan sebelum melakukan migrasi skema tabel database skala besar.'
    },
    {
      title: 'Audit Trail & Pembersihan Otomatis Hari Minggu',
      shortTitle: 'Audit Trail',
      icon: 'history',
      subtitle: 'Pelacakan aktivitas sistem dan pemangkasan log berkala',
      points: [
        'Seluruh aktivitas krusial pengguna (login, reset sesi siswa, ubah nilai, penghapusan data) tercatat persisten di Log Audit Global.',
        'Sistem secara cerdas menjalankan mekanisme pembersihan otomatis setiap hari Minggu (auto-purge weekly logs) untuk mencegah penumpukan log basi.',
        'Pembersihan otomatis menjaga performa kueri database tetap cepat tanpa mengorbankan keamanan jejak audit aktif.'
      ],
      tip: 'Filter riwayat log berdasarkan nama sekolah atau rentang waktu untuk menginvestigasi laporan kendala dari admin sekolah.'
    }
  ]
};

const TutorialModal = ({ isOpen, initialRole = 'admin', onClose }) => {
  const [activeRole, setActiveRole] = useState(initialRole);
  const [currentStep, setCurrentStep] = useState(0);

  // Sync role when initialRole changes or modal opens
  useEffect(() => {
    if (isOpen) {
      const validRole = TUTORIAL_DATA[initialRole] ? initialRole : 'admin';
      setActiveRole(validRole);
      setCurrentStep(0);
    }
  }, [isOpen, initialRole]);

  // Reset step when activeRole changes
  const handleSelectRole = (newRole) => {
    setActiveRole(newRole);
    setCurrentStep(0);
  };

  // Keyboard navigation (Esc to close, Arrow keys for steps)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        const steps = TUTORIAL_DATA[activeRole] || [];
        setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentStep((prev) => Math.max(0, prev - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeRole, onClose]);

  if (!isOpen) return null;

  const currentRoleTheme = ROLE_THEMES[activeRole] || ROLE_THEMES.admin;
  const steps = TUTORIAL_DATA[activeRole] || TUTORIAL_DATA.admin;
  const currentStepData = steps[currentStep] || steps[0];
  const progressPercent = Math.round(((currentStep + 1) / steps.length) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-modal-title"
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden my-auto animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= MODAL HEADER ================= */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${currentRoleTheme.bgActive}`}>
              <span className="material-symbols-outlined text-2xl">{currentRoleTheme.icon}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  Panduan Sistem CBT
                </span>
                <span className={`text-[11px] font-bold ${currentRoleTheme.textAccent}`}>
                  {currentRoleTheme.name}
                </span>
              </div>
              <h2 id="tutorial-modal-title" className="text-base sm:text-lg font-black text-slate-800 dark:text-white leading-tight mt-0.5">
                Tutorial & Panduan Alur Kerja
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            title="Tutup (Esc)"
            aria-label="Tutup"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* ================= ROLE SELECTOR TABS ================= */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Pilih Peran Pengguna:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(ROLE_THEMES).map(([roleKey, theme]) => {
              const isSelected = activeRole === roleKey;
              return (
                <button
                  key={roleKey}
                  type="button"
                  onClick={() => handleSelectRole(roleKey)}
                  className={`flex items-center justify-center sm:justify-start gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                    isSelected
                      ? `${theme.bgActive} border-transparent shadow-xs`
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{theme.icon}</span>
                  <span className="truncate">{theme.badge}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ================= STEP INDICATOR & TIMELINE ================= */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Langkah {currentStep + 1} dari {steps.length}: <span className={currentRoleTheme.textAccent}>{currentStepData.shortTitle}</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {progressPercent}% Selesai
            </span>
          </div>

          {/* Progress bar line */}
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full transition-all duration-300 ${
                activeRole === 'admin'
                  ? 'bg-blue-600'
                  : activeRole === 'guru'
                  ? 'bg-amber-600'
                  : activeRole === 'siswa'
                  ? 'bg-emerald-600'
                  : 'bg-purple-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Step Pill Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            {steps.map((st, idx) => {
              const isCurrent = currentStep === idx;
              const isPast = currentStep > idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentStep(idx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all border ${
                    isCurrent
                      ? `${currentRoleTheme.bgActive} border-transparent shadow-xs`
                      : isPast
                      ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      : 'border-transparent text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                  title={st.title}
                >
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-black/10 dark:bg-white/10">
                    {idx + 1}
                  </span>
                  <span className="hidden sm:inline truncate max-w-[120px]">{st.shortTitle}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ================= STEP CONTENT BODY ================= */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar bg-white dark:bg-slate-900">
          {/* Step Header */}
          <div className="flex items-start gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 ${currentRoleTheme.textAccent}`}>
              <span className="material-symbols-outlined text-2xl">{currentStepData.icon}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  Tahap {currentStep + 1}
                </span>
                <span className="text-xs text-slate-400 font-medium">{currentStepData.shortTitle}</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white leading-snug">
                {currentStepData.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                {currentStepData.subtitle}
              </p>
            </div>
          </div>

          {/* Actionable Points / Checklist */}
          <div className="space-y-2.5 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Panduan Langkah Demi Langkah:
            </h4>
            <div className="grid gap-2.5">
              {currentStepData.points.map((pt, pIdx) => (
                <div
                  key={pIdx}
                  className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
                >
                  <span className={`material-symbols-outlined text-base mt-0.5 shrink-0 ${currentRoleTheme.textAccent}`}>
                    check_circle
                  </span>
                  <span>{pt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pro Tip Box */}
          {currentStepData.tip && (
            <div className={`p-4 rounded-2xl border ${currentRoleTheme.cardBg} flex items-start gap-3 mt-4`}>
              <span className={`material-symbols-outlined text-xl shrink-0 mt-0.5 ${currentRoleTheme.textAccent}`}>
                lightbulb
              </span>
              <div>
                <h5 className={`text-xs font-black uppercase tracking-wider mb-0.5 ${currentRoleTheme.textAccent}`}>
                  Tips Penting
                </h5>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {currentStepData.tip}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ================= MODAL FOOTER ================= */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>Sebelumnya</span>
          </button>

          <div className="text-center hidden sm:block">
            <span className="text-xs font-mono text-slate-400">
              Langkah {currentStep + 1} dari {steps.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {currentStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
                className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all ${currentRoleTheme.btnPrimary}`}
              >
                <span>Selanjutnya</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-base">check</span>
                <span>Selesai & Paham</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialModal;
