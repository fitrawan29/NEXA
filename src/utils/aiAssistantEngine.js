/**
 * NEXA CBT - Offline In-App AI Assistant Engine
 * 100% Client-Side, Zero External API / Zero Network Requests.
 * Sub-millisecond latency lexical & fuzzy intent matcher for Indonesian CBT operations.
 */

// ============================================================================
// 1. COMPREHENSIVE ROLE-BASED FEATURE & INTENT REGISTRY
// ============================================================================

export const ROLE_DISPLAY_NAMES = {
  admin: 'Admin Sekolah',
  guru: 'Guru Pengampu / Pengawas',
  siswa: 'Siswa Peserta Ujian',
  super_admin: 'Super Admin'
};

export const FEATURE_REGISTRY = {
  // --------------------------------------------------------------------------
  // ADMIN SEKOLAH FEATURES
  // --------------------------------------------------------------------------
  admin: [
    {
      id: 'admin_hasil',
      role: 'admin',
      title: 'Rekap Hasil & Nilai Ujian',
      targetTab: 'hasil',
      actionLabel: 'Buka Rekap Nilai',
      selector: '[data-assistant-target="hasil"]',
      category: 'Nilai & Laporan',
      description: 'Melihat rekapitulasi nilai seluruh siswa, statistik perolehan skor per mata pelajaran, analisis distribusi, serta ekspor file Excel nilai resmi.',
      steps: [
        'Klik menu "Hasil Ujian" pada navigasi sidebar kiri.',
        'Pilih sesi jadwal ujian atau mata pelajaran yang ingin diinspeksi.',
        'Gunakan tombol "Export Excel" untuk mengunduh rekap nilai lengkap.'
      ],
      keywords: [
        'nilai', 'skor', 'hasil', 'hasil ujian', 'rekap nilai', 'rekap ujian', 'rapor',
        'ekspor nilai', 'download nilai', 'export excel', 'distribusi nilai', 'skor siswa',
        'daftar nilai', 'koreksi nilai', 'grade', 'skor akhir', 'melihat nilai'
      ],
      sampleQueries: [
        'lihat nilai',
        'hasil ujian',
        'rekap ujian',
        'bagaimana cara melihat nilai siswa',
        'ekspor nilai ke excel',
        'cek hasil ujian siswa',
        'rekapitulasi skor ujian'
      ]
    },
    {
      id: 'admin_soal',
      role: 'admin',
      title: 'Bank Soal (Preview & Review)',
      targetTab: 'soal',
      actionLabel: 'Buka Bank Soal',
      selector: '[data-assistant-target="soal"]',
      category: 'Bank Soal',
      description: 'Meninjau dan memvalidasi koleksi butir soal ujian yang telah disusun oleh para guru pengampu mata pelajaran.',
      steps: [
        'Klik menu "Bank Soal (Preview)" pada sidebar navigasi.',
        'Gunakan filter mata pelajaran untuk menyeleksi butir soal.',
        'Periksa pilihan ganda, kunci jawaban, dan stimulus narasi.'
      ],
      keywords: [
        'bank soal', 'soal', 'soal ujian', 'preview soal', 'tinjau soal',
        'koleksi soal', 'daftar butir soal', 'soal pg', 'soal uraian', 'soal guru',
        'periksa soal guru', 'buka bank soal', 'kunci jawaban'
      ],
      sampleQueries: [
        'buka bank soal',
        'preview soal ujian',
        'tinjau soal dari guru',
        'cek bank soal',
        'daftar soal ujian'
      ]
    },
    {
      id: 'admin_kartu',
      role: 'admin',
      title: 'Cetak Kartu Ujian Siswa',
      targetTab: 'siswa',
      targetModal: 'kartu',
      actionLabel: 'Buka Cetak Kartu Siswa',
      selector: '[data-assistant-target="siswa"]',
      category: 'Operasional Ujian',
      description: 'Mencetak kartu peserta ujian ber-Kop resmi sekolah lengkap dengan foto siswa, QR Code autentikasi, ruang ujian, dan nomor peserta.',
      steps: [
        'Masuk ke menu "Data Siswa" pada sidebar navigasi.',
        'Pilih filter kelas/rombel yang ingin dicetak kartunya.',
        'Klik tombol "Cetak Kartu Ujian" di bilah atas untuk membuka layar cetak siap print.'
      ],
      keywords: [
        'cetak kartu', 'kartu ujian', 'kartu peserta', 'print kartu', 'cetak kartu ujian',
        'kartu siswa', 'nomor peserta', 'kartu tes', 'cetak kartu ujian siswa', 'print kartu peserta'
      ],
      sampleQueries: [
        'cetak kartu',
        'bagaimana cara cetak kartu ujian',
        'print kartu peserta',
        'dimana cetak kartu',
        'cetak kartu ujian siswa'
      ]
    },
    {
      id: 'admin_siswa',
      role: 'admin',
      title: 'Master Data Siswa',
      targetTab: 'siswa',
      actionLabel: 'Buka Data Siswa',
      selector: '[data-assistant-target="siswa"]',
      category: 'Data Master',
      description: 'Pengelolaan data induk siswa, import Excel massal, tambah siswa baru, unduh template resmi, dan pembagian rombel.',
      steps: [
        'Buka menu "Data Siswa" pada grup Data Master di sidebar navigasi.',
        'Klik "Download Template" untuk berkas format Excel resmi.',
        'Gunakan "Import Excel" untuk upload siswa massal atau tombol "+ Tambah Siswa".'
      ],
      keywords: [
        'data siswa', 'tambah siswa', 'import siswa', 'excel siswa', 'daftar siswa',
        'murid', 'peserta didik', 'unduh template siswa', 'tambah murid', 'kelola siswa'
      ],
      sampleQueries: [
        'kelola data siswa',
        'cara tambah siswa baru',
        'import data siswa excel',
        'tambah murid'
      ]
    },
    {
      id: 'admin_guru',
      role: 'admin',
      title: 'Master Data Guru',
      targetTab: 'guru',
      actionLabel: 'Buka Data Guru',
      selector: '[data-assistant-target="guru"]',
      category: 'Data Master',
      description: 'Manajemen akun pengajar/guru pengampu, import data guru via Excel, aktivasi akun, dan pemetaan mata pelajaran.',
      steps: [
        'Buka menu "Data Guru" di sidebar navigasi.',
        'Unduh template Excel resmi dan unggah via tombol "Import Excel".',
        'Atur NIP, nama lengkap, dan penugasan mapel pengampu.'
      ],
      keywords: [
        'data guru', 'tambah guru', 'import guru', 'excel guru', 'daftar guru',
        'pengajar', 'ustadz', 'tambah pengajar', 'kelola guru', 'akun guru'
      ],
      sampleQueries: [
        'buka data guru',
        'tambah akun guru baru',
        'import guru massal',
        'daftar pengajar'
      ]
    },
    {
      id: 'admin_mapel',
      role: 'admin',
      title: 'Mata Pelajaran',
      targetTab: 'mapel',
      actionLabel: 'Buka Mata Pelajaran',
      selector: '[data-assistant-target="mapel"]',
      category: 'Data Master',
      description: 'Pengelolaan daftar mata pelajaran, kode mata pelajaran, alokasi jam, dan kurikulum sekolah.',
      steps: [
        'Buka menu "Mata Pelajaran" pada grup Data Master.',
        'Tambahkan mata pelajaran baru atau sesuaikan kode mapel.'
      ],
      keywords: [
        'mata pelajaran', 'mapel', 'tambah mapel', 'kurikulum', 'pelajaran',
        'daftar mapel', 'kelola mapel'
      ],
      sampleQueries: [
        'tambah mata pelajaran',
        'daftar mapel',
        'atur kurikulum pelajaran'
      ]
    },
    {
      id: 'admin_kelas',
      role: 'admin',
      title: 'Manajemen Kelas & Rombel',
      targetTab: 'kelas',
      actionLabel: 'Buka Manajemen Kelas',
      selector: '[data-assistant-target="kelas"]',
      category: 'Data Master',
      description: 'Pengaturan rombongan belajar (rombel), pembagian kelas paralel (misal: X-A, X-B), dan pemetaan tingkat kelas.',
      steps: [
        'Buka menu "Manajemen Kelas" di sidebar kiri.',
        'Klik tambah rombel untuk membuat kelas paralel baru.'
      ],
      keywords: [
        'manajemen kelas', 'kelas', 'rombel', 'rombongan belajar',
        'kelas paralel', 'tingkat', 'atur rombel', 'pembagian kelas'
      ],
      sampleQueries: [
        'atur kelas dan rombel',
        'tambah kelas baru',
        'manajemen kelas paralel'
      ]
    },
    {
      id: 'admin_jadwal',
      role: 'admin',
      title: 'Jadwal Ujian & Sesi',
      targetTab: 'jadwal',
      actionLabel: 'Buka Jadwal Ujian',
      selector: '[data-assistant-target="jadwal"]',
      category: 'Operasional Ujian',
      description: 'Penjadwalan agenda ujian CBT, auto-select guru pengampu, alokasi kelas paralel, rilis token ujian, dan durasi.',
      steps: [
        'Buka menu "Jadwal Ujian" pada grup Operasional Ujian.',
        'Klik tombol "+ Buat Jadwal" di sudut kanan atas.',
        'Pilih Mata Pelajaran, target rombel, tanggal, dan durasi tes.'
      ],
      keywords: [
        'jadwal ujian', 'jadwal', 'buat jadwal', 'bikin jadwal', 'agenda ujian',
        'waktu tes', 'jadwal tes', 'sesi ujian', 'atur jadwal', 'rilis token'
      ],
      sampleQueries: [
        'bikin jadwal ujian',
        'buat jadwal baru',
        'atur jadwal ujian',
        'jadwal pelaksanaan ujian'
      ]
    },
    {
      id: 'admin_dokumen',
      role: 'admin',
      title: 'Cetak Dokumen & Berita Acara Ujian',
      targetTab: 'jadwal',
      targetModal: 'dokumen',
      actionLabel: 'Buka Dokumen Ujian',
      selector: '[data-assistant-target="jadwal"]',
      category: 'Operasional Ujian',
      description: 'Mencetak berita acara pelaksanaan ujian, daftar hadir siswa per ruangan, dan rekap tanda tangan pengawas ber-Kop resmi.',
      steps: [
        'Buka menu "Jadwal Ujian" di sidebar.',
        'Klik tombol "Berita Acara / Dokumen" pada baris jadwal yang diinginkan.',
        'Pilih cetak Berita Acara atau Daftar Hadir peserta.'
      ],
      keywords: [
        'cetak dokumen', 'berita acara', 'cetak berita acara', 'cetak absen',
        'daftar hadir', 'presensi pengawas', 'kop berita acara', 'cetak absensi', 'dokumen ujian'
      ],
      sampleQueries: [
        'cetak absen',
        'cetak berita acara ujian',
        'print daftar hadir pengawas',
        'dokumen ujian'
      ]
    },
    {
      id: 'admin_pengawas',
      role: 'admin',
      title: 'Manajemen Pengawas & Ruang',
      targetTab: 'pengawas',
      actionLabel: 'Buka Pengawas & Ruang',
      selector: '[data-assistant-target="pengawas"]',
      category: 'Operasional Ujian',
      description: 'Alokasi ruang ujian fisik/virtual, penugasan guru pengawas per ruangan, dan pengaturan kuota meja peserta.',
      steps: [
        'Buka menu "Pengawas & Ruang" di sidebar.',
        'Tentukan nama ruangan dan tugaskan guru pengawas yang bertugas.'
      ],
      keywords: [
        'pengawas', 'ruang ujian', 'alokasi ruang', 'tugas pengawas',
        'ruangan', 'jadwal pengawas', 'atur ruang', 'kelola pengawas'
      ],
      sampleQueries: [
        'alokasi pengawas ruang',
        'atur ruang ujian',
        'penugasan pengawas'
      ]
    },
    {
      id: 'admin_kontrol',
      role: 'admin',
      title: 'Kontrol Ujian & Reset Peserta',
      targetTab: 'kontrol',
      actionLabel: 'Buka Kontrol Ujian',
      selector: '[data-assistant-target="kontrol"]',
      category: 'Operasional Ujian',
      description: 'Pusat kendali ujian aktif: reset login siswa terkunci, pause sesi ujian, tambah waktu darurat, dan paksa selesai ujian.',
      steps: [
        'Buka menu "Kontrol Ujian" di sidebar.',
        'Pilih sesi ujian aktif, cari nama siswa yang mengalami kendala, lalu klik Reset Login.'
      ],
      keywords: [
        'kontrol ujian', 'reset login', 'reset siswa', 'paksa selesai', 'hentikan ujian',
        'stop ujian', 'tambah waktu', 'buka kunci siswa', 'unblock siswa', 'buka gembok siswa'
      ],
      sampleQueries: [
        'reset login siswa',
        'hentikan ujian aktif',
        'buka kunci siswa',
        'kontrol ujian'
      ]
    },
    {
      id: 'admin_monitoring',
      role: 'admin',
      title: 'Live Monitoring Ujian Real-Time',
      targetTab: 'monitoring',
      actionLabel: 'Buka Live Monitoring',
      selector: '[data-assistant-target="monitoring"]',
      category: 'Operasional Ujian',
      description: 'Pemantauan real-time status seluruh siswa yang sedang mengerjakan ujian (mengerjakan, selesai, koneksi terputus, atau curang).',
      steps: [
        'Buka menu "Live Monitoring Ujian" di sidebar.',
        'Pantau jumlah siswa online, progres butir soal terjawab, dan peringatan kecurangan.'
      ],
      keywords: [
        'live monitoring', 'monitoring ujian', 'pantau ujian', 'status siswa',
        'progres realtime', 'peserta online', 'pantau peserta', 'monitoring'
      ],
      sampleQueries: [
        'pantau ujian realtime',
        'live monitoring siswa',
        'status pengerjaan siswa',
        'monitoring ujian',
        'monitoring'
      ]
    },
    {
      id: 'admin_skema',
      role: 'admin',
      title: 'Skema Penilaian Default Sekolah',
      targetTab: 'skema',
      actionLabel: 'Buka Skema Penilaian',
      selector: '[data-assistant-target="skema"]',
      category: 'Konfigurasi Penilaian',
      description: 'Konfigurasi pembobotan nilai default sekolah: bobot PG, bobot Uraian, skala nilai (0-100), rumus agregasi, dan batas KKM.',
      steps: [
        'Klik menu "Skema Penilaian" pada grup Ujian & Pelaksanaan.',
        'Tentukan persentase bobot soal pilihan ganda dan esai.',
        'Klik "Simpan Skema Default" untuk menerapkan ke seluruh jadwal baru.'
      ],
      keywords: [
        'skema penilaian', 'bobot soal', 'kkm', 'skala nilai', 'rumus nilai',
        'skema nilai default', 'aturan penilaian', 'bobot pg uraian',
        'atur bobot nilai', 'bobot nilai', 'atur bobot', 'atur nilai', 'persentase nilai'
      ],
      sampleQueries: [
        'atur bobot nilai',
        'skema penilaian sekolah',
        'ganti kkm',
        'bobot soal pg dan esai'
      ]
    },
    {
      id: 'admin_pengaturan',
      role: 'admin',
      title: 'Pengaturan & Profil Sekolah (Kop Surat)',
      targetTab: 'pengaturan',
      actionLabel: 'Buka Pengaturan Sekolah',
      selector: '[data-assistant-target="pengaturan"]',
      category: 'Sistem',
      description: 'Identitas instansi sekolah, alamat lengkap, upload Logo Dinas & Logo Sekolah untuk Kop surat, nama kepala sekolah, dan backup database.',
      steps: [
        'Buka menu "Pengaturan / Profil Sekolah" di sidebar grup Sistem.',
        'Isi identitas sekolah, alamat resmi, dan unggah kedua logo kop.',
        'Lihat Live Preview Kop surat sebelum menyimpan perubahan.'
      ],
      keywords: [
        'pengaturan', 'profil sekolah', 'kop surat', 'logo sekolah', 'logo dinas',
        'alamat sekolah', 'backup database', 'kop resmi', 'nama kepsek', 'kop kartu ujian'
      ],
      sampleQueries: [
        'atur kop surat',
        'upload logo sekolah',
        'ganti alamat sekolah',
        'backup data',
        'pengaturan sekolah'
      ]
    },
    {
      id: 'admin_logs',
      role: 'admin',
      title: 'Log Aktivitas Sistem',
      targetTab: 'logs',
      actionLabel: 'Buka Log Aktivitas',
      selector: '[data-assistant-target="logs"]',
      category: 'Sistem',
      description: 'Audit trail rekaman seluruh aksi penting, perubahan data, dan operasional ujian di sistem NEXA CBT.',
      steps: [
        'Buka menu "Log Aktivitas" di grup Sistem.',
        'Gunakan pencarian untuk melacak timestamp dan riwayat aksi pengguna.'
      ],
      keywords: [
        'log aktivitas', 'logs', 'riwayat', 'audit trail', 'catatan aktivitas', 'jejak sistem'
      ],
      sampleQueries: [
        'lihat log aktivitas',
        'riwayat aksi sistem',
        'audit log'
      ]
    },
    {
      id: 'admin_akun',
      role: 'admin',
      title: 'Profil Admin & Ganti Password',
      targetTab: 'akun',
      actionLabel: 'Buka Profil Admin',
      selector: '[data-assistant-target="akun"]',
      category: 'Sistem',
      description: 'Pengaturan akun admin sekolah, ubah kata sandi (password), dan pembaruan foto profil avatar.',
      steps: [
        'Buka menu "Profil Admin" di sidebar navigasi.',
        'Ketik kata sandi baru pada formulir Ubah Password lalu klik Simpan.',
        'Ketuk avatar untuk mengunggah foto profil baru.'
      ],
      keywords: [
        'profil admin', 'ganti password', 'ubah sandi', 'password', 'foto profil',
        'akun admin', 'keamanan akun', 'ganti sandi', 'akun'
      ],
      sampleQueries: [
        'ganti password',
        'ubah kata sandi admin',
        'ganti foto profil',
        'akun',
        'profil admin'
      ]
    }
  ],

  // --------------------------------------------------------------------------
  // GURU PENGAMPU / PENGAWAS FEATURES
  // --------------------------------------------------------------------------
  guru: [
    {
      id: 'guru_bank_soal',
      role: 'guru',
      title: 'Bank Soal Guru & Pembuatan Soal',
      targetTab: 'bank_soal',
      actionLabel: 'Buka Bank Soal',
      selector: '[data-assistant-target="bank_soal"]',
      category: 'Bank Soal',
      description: 'Pusat pembuatan dan pengelolaan butir soal: buat soal baru (PG/Uraian), import massal format teks Aiken, edit stimulus narasi, dan kelola kunci jawaban.',
      steps: [
        'Buka menu "Bank Soal" di sidebar guru.',
        'Klik tombol "+ Buat Soal" untuk membuat butir soal interaktif.',
        'Atau klik "Import Aiken" untuk mengunggah puluhan soal pilihan ganda sekaligus dari teks.'
      ],
      keywords: [
        'bank soal', 'bikin soal', 'buat soal', 'tambah soal', 'import aiken',
        'soal ujian', 'soal pg', 'soal esai', 'butir soal', 'input soal',
        'koleksi soal', 'bikin pertanyaan', 'buat soal baru', 'import soal', 'buka bank soal',
        'kunci jawaban', 'kunci soal'
      ],
      sampleQueries: [
        'bikin soal',
        'bagaimana cara membuat soal baru',
        'import soal aiken',
        'buka bank soal',
        'buat soal ujian'
      ]
    },
    {
      id: 'guru_uraian',
      role: 'guru',
      title: 'Pemeriksaan & Koreksi Soal Uraian',
      targetTab: 'bank_soal',
      targetModal: 'uraian',
      actionLabel: 'Buka Periksa Uraian',
      selector: '[data-assistant-target="bank_soal"]',
      category: 'Koreksi & Nilai',
      description: 'Koreksi jawaban esai/uraian siswa secara objektif dengan panduan kunci jawaban guru dan rubrik penskoran digital.',
      steps: [
        'Buka menu "Bank Soal" atau "Rekap Nilai".',
        'Klik tombol "Periksa Uraian" untuk membuka panel penilaian esai.',
        'Masukkan skor untuk jawaban tiap peserta lalu simpan.'
      ],
      keywords: [
        'periksa uraian', 'koreksi uraian', 'koreksi soal', 'grading esai',
        'nilai esai', 'skor uraian', 'koreksi manual', 'periksa jawaban esai',
        'kunci jawaban', 'rubrik penilaian'
      ],
      sampleQueries: [
        'periksa uraian siswa',
        'koreksi jawaban esai',
        'nilai soal uraian',
        'koreksi manual'
      ]
    },
    {
      id: 'guru_analisis',
      role: 'guru',
      title: 'Analisis Butir Soal (Psikometrik)',
      targetTab: 'bank_soal',
      targetModal: 'analisis',
      actionLabel: 'Buka Analisis Soal',
      selector: '[data-assistant-target="bank_soal"]',
      category: 'Bank Soal',
      description: 'Analisis statistik kualitas butir soal: tingkat kesukaran (mudah/sedang/sukar), daya pembeda soal, dan efektivitas distraktor pengecoh.',
      steps: [
        'Buka menu "Bank Soal".',
        'Klik tombol "Analisis Butir Soal" pada jadwal mata pelajaran yang telah selesai.',
        'Tinjau hasil perhitungan validitas butir soal.'
      ],
      keywords: [
        'analisis butir soal', 'analisis soal', 'daya beda', 'tingkat kesukaran',
        'evaluasi soal', 'kualitas soal', 'validitas soal', 'distraktor'
      ],
      sampleQueries: [
        'analisis butir soal',
        'cek daya beda soal',
        'analisis tingkat kesukaran'
      ]
    },
    {
      id: 'guru_hasil',
      role: 'guru',
      title: 'Rekap Hasil & Nilai Siswa',
      targetTab: 'hasil',
      actionLabel: 'Buka Rekap Nilai',
      selector: '[data-assistant-target="hasil"]',
      category: 'Koreksi & Nilai',
      description: 'Daftar perolehan nilai seluruh siswa per kelas untuk mata pelajaran yang diampu, lengkap dengan fitur ekspor lembar nilai Excel.',
      steps: [
        'Buka menu "Hasil Ujian" pada navigasi sidebar.',
        'Pilih kelas dan jadwal ujian untuk menampilkan tabel perolehan nilai.',
        'Klik "Ekspor Excel" untuk mengunduh rekap nilai lengkap.'
      ],
      keywords: [
        'lihat nilai', 'rekap nilai', 'hasil ujian', 'skor siswa', 'nilai siswa',
        'rekap ujian', 'ekspor nilai', 'nilai mapel', 'daftar nilai', 'rapor',
        'hasil', 'nilai', 'ekspor rekap nilai ke excel'
      ],
      sampleQueries: [
        'lihat nilai',
        'lihat nilai siswa',
        'rekap ujian',
        'rekap nilai',
        'hasil ujian',
        'ekspor rekap nilai ke excel',
        'cek hasil ujian murid'
      ]
    },
    {
      id: 'guru_jadwal',
      role: 'guru',
      title: 'Jadwal Ujian Guru',
      targetTab: 'jadwal',
      actionLabel: 'Buka Jadwal Ujian',
      selector: '[data-assistant-target="jadwal"]',
      category: 'Operasional Ujian',
      description: 'Daftar jadwal ujian aktif dan mendatang yang terkait dengan mata pelajaran yang Anda ampu di sekolah.',
      steps: [
        'Buka menu "Jadwal Ujian" di sidebar guru.',
        'Periksa tanggal, sesi, durasi, dan kelas target ujian.'
      ],
      keywords: [
        'jadwal', 'jadwal ujian', 'agenda ujian', 'jadwal mengajar',
        'waktu tes', 'jadwal tes guru'
      ],
      sampleQueries: [
        'jadwal ujian saya',
        'kapan jadwal tes mapel saya',
        'cek jadwal ujian'
      ]
    },
    {
      id: 'guru_monitoring',
      role: 'guru',
      title: 'Live Monitoring & Kontrol Ujian Guru',
      targetTab: 'monitoring',
      actionLabel: 'Buka Monitoring Ujian',
      selector: '[data-assistant-target="monitoring"]',
      category: 'Operasional Ujian',
      description: 'Pantau secara langsung siswa yang sedang mengerjakan ujian mata pelajaran Anda, lihat waktu tersisa, dan lakukan reset bila siswa terkunci.',
      steps: [
        'Klik menu "Monitoring" di navigasi samping.',
        'Pilih sesi ujian aktif untuk melihat daftar siswa dan progres jawaban realtime.'
      ],
      keywords: [
        'monitoring', 'kontrol ujian', 'pantau ujian', 'live monitoring',
        'status pengerjaan', 'reset ujian guru', 'progres siswa'
      ],
      sampleQueries: [
        'monitoring',
        'live monitoring',
        'monitoring ujian siswa',
        'pantau siswa ujian',
        'kontrol sesi ujian'
      ]
    },
    {
      id: 'guru_pengawasan',
      role: 'guru',
      title: 'Ruang Pengawasan & Presensi Siswa',
      targetTab: 'pengawasan',
      actionLabel: 'Buka Ruang Pengawasan',
      selector: '[data-assistant-target="pengawasan"]',
      category: 'Pengawasan Ujian',
      description: 'Panel khusus tugas pengawas ruang: verifikasi presensi peserta, validasi tanda tangan digital siswa, dan cetak berita acara ruang pengawas.',
      steps: [
        'Buka menu "Ruang Pengawasan" di sidebar guru.',
        'Pilih ruangan tempat Anda bertugas, verifikasi tanda tangan digital siswa.',
        'Klik tombol cetak untuk mencetak Berita Acara Ruang Pengawas.'
      ],
      keywords: [
        'pengawasan', 'ruang pengawas', 'presensi', 'absen siswa',
        'verifikasi tanda tangan', 'tanda tangan siswa', 'berita acara ruang',
        'tugas pengawas', 'cetak absen', 'presensi siswa'
      ],
      sampleQueries: [
        'cetak absen pengawas',
        'verifikasi ttd siswa',
        'ruang pengawas',
        'presensi ruang ujian'
      ]
    },
    {
      id: 'guru_skema',
      role: 'guru',
      title: 'Skema Penilaian Khusus Guru',
      targetTab: 'akun',
      actionLabel: 'Buka Skema Penilaian Guru',
      selector: '[data-assistant-target="akun"]',
      category: 'Konfigurasi Penilaian',
      description: 'Kustomisasi pembobotan nilai per mata pelajaran guru jika tidak menggunakan skema default sekolah (bobot PG & Uraian).',
      steps: [
        'Buka menu "Profil & Akun" di sidebar.',
        'Buka kartu "Skema Penilaian Guru".',
        'Atur persentase bobot soal lalu klik Simpan.'
      ],
      keywords: [
        'skema penilaian', 'bobot nilai guru', 'aturan nilai mapel',
        'kkm guru', 'kustom skema', 'atur bobot nilai', 'bobot nilai', 'bobot soal'
      ],
      sampleQueries: [
        'atur bobot nilai',
        'atur bobot nilai mapel',
        'skema penilaian guru',
        'ganti bobot soal'
      ]
    },
    {
      id: 'guru_logs',
      role: 'guru',
      title: 'Log Aktivitas Guru',
      targetTab: 'logs',
      actionLabel: 'Buka Log Aktivitas',
      selector: '[data-assistant-target="logs"]',
      category: 'Sistem',
      description: 'Rekaman riwayat seluruh aktivitas pembuatan soal, koreksi ujian, dan monitoring oleh akun guru.',
      steps: [
        'Buka menu "Log Aktivitas" pada navigasi samping.'
      ],
      keywords: ['log aktivitas', 'logs', 'riwayat mengajar', 'catatan aktivitas'],
      sampleQueries: ['lihat log aktivitas guru', 'riwayat pembuatan soal']
    },
    {
      id: 'guru_akun',
      role: 'guru',
      title: 'Profil Guru & Ganti Password',
      targetTab: 'akun',
      actionLabel: 'Buka Profil Guru',
      selector: '[data-assistant-target="akun"]',
      category: 'Sistem',
      description: 'Kelola informasi profil guru, ganti password login, dan perbarui foto profil avatar.',
      steps: [
        'Buka menu "Profil & Akun" di sidebar navigasi.',
        'Masukkan password baru pada kolom Ubah Password lalu simpan.'
      ],
      keywords: [
        'profil guru', 'ganti password', 'ubah sandi', 'password', 'foto profil',
        'akun guru', 'ganti sandi guru'
      ],
      sampleQueries: [
        'ganti password',
        'ubah kata sandi guru',
        'profil akun'
      ]
    }
  ],

  // --------------------------------------------------------------------------
  // SISWA PESERTA UJIAN FEATURES
  // --------------------------------------------------------------------------
  siswa: [
    {
      id: 'siswa_nilai',
      role: 'siswa',
      title: 'Riwayat Nilai & Hasil Ujian',
      targetTab: 'nilai',
      actionLabel: 'Buka Riwayat Nilai',
      selector: '[data-assistant-target="nilai"]',
      category: 'Hasil Belajar',
      description: 'Melihat perolehan nilai, skor pilihan ganda, status kelulusan KKM, dan evaluasi hasil tes yang sudah Anda selesaikan.',
      steps: [
        'Klik tab menu "Riwayat Nilai" pada bilah navigasi.',
        'Pilih kartu ujian yang telah selesai untuk melihat rincian skor perolehan Anda.'
      ],
      keywords: [
        'nilai', 'skor', 'hasil', 'hasil ujian', 'lihat nilai', 'cek nilai',
        'riwayat nilai', 'skor saya', 'nilai saya', 'rapor', 'skor pg', 'grade', 'poin', 'hasil tes',
        'nilai dari guru'
      ],
      sampleQueries: [
        'lihat nilai',
        'cara melihat nilai saya',
        'cek hasil ujian',
        'berapa skor saya',
        'hasil tes',
        'nilai dari guru'
      ]
    },
    {
      id: 'siswa_jadwal',
      role: 'siswa',
      title: 'Jadwal Ujian Aktif',
      targetTab: 'jadwal',
      actionLabel: 'Buka Jadwal Ujian',
      selector: '[data-assistant-target="jadwal"]',
      category: 'Ujian CBT',
      description: 'Daftar jadwal ujian yang sedang aktif dan siap dikerjakan sesuai dengan rombel kelas Anda.',
      steps: [
        'Klik menu "Jadwal Ujian" pada bilah navigasi.',
        'Cari mata pelajaran yang sedang berlangsung, lalu klik tombol "Mulai Ujian" atau "Kerjakan".'
      ],
      keywords: [
        'jadwal', 'jadwal ujian', 'mulai ujian', 'kerjakan ujian', 'tes aktif',
        'ujian hari ini', 'masuk ujian', 'ikut ujian', 'sesi ujian', 'ujian sekarang',
        'jadwal dari guru'
      ],
      sampleQueries: [
        'mulai ujian',
        'dimana jadwal ujian saya',
        'kerjakan tes',
        'jadwal ujian aktif',
        'jadwal dari guru'
      ]
    },
    {
      id: 'siswa_token',
      role: 'siswa',
      title: 'Konfirmasi Tes & Input Token',
      targetTab: 'jadwal',
      targetModal: 'token',
      actionLabel: 'Buka Input Token',
      selector: '[data-assistant-target="jadwal"]',
      category: 'Ujian CBT',
      description: 'Memasukkan 6-karakter token ujian resmi yang dibagikan oleh guru pengawas ruang untuk memulai pengerjaan tes.',
      steps: [
        'Buka tab "Jadwal Ujian".',
        'Klik tombol "Mulai" pada mata pelajaran yang diujikan.',
        'Ketik token ujian dari pengawas ruang pada kotak konfirmasi, lalu klik "Masuk Tes".'
      ],
      keywords: [
        'token', 'token ujian', 'masukkan token', 'input token', 'konfirmasi tes',
        'kode ujian', 'pin ujian', 'isi token', 'konfirmasi ujian'
      ],
      sampleQueries: [
        'masukkan token ujian',
        'dimana isi token',
        'input token tes',
        'konfirmasi token'
      ]
    },
    {
      id: 'siswa_leaderboard',
      role: 'siswa',
      title: 'Papan Peringkat (Leaderboard)',
      targetTab: 'leaderboard',
      actionLabel: 'Buka Papan Peringkat',
      selector: '[data-assistant-target="leaderboard"]',
      category: 'Prestasi',
      description: 'Papan peringkat perolehan nilai siswa tertinggi di kelas atau sekolah untuk memacu motivasi belajar sehat.',
      steps: [
        'Klik menu "Papan Peringkat" pada bilah navigasi.',
        'Lihat posisi ranking dan skor Anda di antara teman-teman sekelas.'
      ],
      keywords: [
        'leaderboard', 'peringkat', 'papan peringkat', 'ranking',
        'peringkat nilai', 'juara', 'posisi nilai', 'urutan nilai'
      ],
      sampleQueries: [
        'lihat peringkat saya',
        'papan peringkat ujian',
        'siapa juara kelas',
        'leaderboard'
      ]
    },
    {
      id: 'siswa_pengumuman',
      role: 'siswa',
      title: 'Pengumuman Sekolah',
      targetTab: 'pengumuman',
      actionLabel: 'Buka Pengumuman',
      selector: '[data-assistant-target="pengumuman"]',
      category: 'Informasi',
      description: 'Informasi resmi, jadwal kegiatan, dan tata tertib ujian yang disiarkan oleh pihak sekolah.',
      steps: [
        'Ketuk tab "Pengumuman" pada navigasi.',
        'Baca pesan pengumuman resmi yang disiarkan oleh Admin sekolah.'
      ],
      keywords: [
        'pengumuman', 'informasi pengumuman', 'berita pengumuman', 'tata tertib', 'pesan admin', 'info ujian',
        'pengumuman dari guru', 'pengumuman guru', 'info dari guru', 'pengumuman sekolah'
      ],
      sampleQueries: [
        'lihat pengumuman sekolah',
        'informasi ujian',
        'pesan dari admin',
        'pengumuman dari guru',
        'pengumuman guru'
      ]
    },
    {
      id: 'siswa_akun',
      role: 'siswa',
      title: 'Profil Siswa, Sandi & Tanda Tangan',
      targetTab: 'akun',
      actionLabel: 'Buka Profil Saya',
      selector: '[data-assistant-target="akun"]',
      category: 'Akun & Profil',
      description: 'Informasi data diri (NISN, Nama, Kelas), ubah kata sandi login, dan bubuhkan tanda tangan digital presensi ujian.',
      steps: [
        'Buka menu "Profil Saya" di navigasi.',
        'Ketik password baru pada kolom ganti sandi lalu klik Simpan.',
        'Goreskan tanda tangan digital pada kanvas presensi untuk verifikasi kehadiran ujian.'
      ],
      keywords: [
        'profil', 'ganti password', 'ubah sandi', 'password', 'kata sandi',
        'tanda tangan digital', 'ttd', 'akun saya', 'biodata', 'ttd digital',
        'ganti sandi', 'ubah password', 'ubah kata sandi'
      ],
      sampleQueries: [
        'ganti password',
        'ganti sandi',
        'ubah password',
        'ubah kata sandi siswa',
        'buat tanda tangan digital',
        'profil saya'
      ]
    },
    {
      id: 'siswa_beranda',
      role: 'siswa',
      title: 'Beranda Siswa',
      targetTab: 'beranda',
      actionLabel: 'Buka Beranda',
      selector: '[data-assistant-target="beranda"]',
      category: 'Utama',
      description: 'Halaman utama dashboard siswa yang memuat status tes hari ini, pengumuman kilat, dan akses cepat seluruh fitur.',
      steps: [
        'Klik menu "Beranda" pada bilah navigasi.'
      ],
      keywords: [
        'beranda', 'home', 'halaman utama', 'dashboard', 'menu utama'
      ],
      sampleQueries: [
        'kembali ke beranda',
        'halaman utama',
        'dashboard'
      ]
    }
  ],

  // --------------------------------------------------------------------------
  // SUPER ADMIN FEATURES
  // --------------------------------------------------------------------------
  super_admin: [
    {
      id: 'superadmin_analytics',
      role: 'super_admin',
      title: 'Dasbor Statistik Global',
      targetTab: 'analytics',
      actionLabel: 'Buka Dasbor Statistik',
      selector: '[data-assistant-target="analytics"]',
      category: 'Analytics',
      description: 'Statistik agregat seluruh sekolah yang terdaftar: total peserta, concurrent users ujian aktif, dan metrik server.',
      steps: ['Klik menu "Statistik" pada bilah navigasi bawah.'],
      keywords: [
        'statistik', 'analytics', 'dasbor', 'ringkasan global', 'concurrent users',
        'total siswa', 'monitoring server', 'status server'
      ],
      sampleQueries: [
        'lihat statistik global',
        'berapa siswa ujian aktif saat ini',
        'dasbor analytics'
      ]
    },
    {
      id: 'superadmin_sekolah',
      role: 'super_admin',
      title: 'Manajemen Sekolah & NPSN',
      targetTab: 'sekolah',
      actionLabel: 'Buka Manajemen Sekolah',
      selector: '[data-assistant-target="sekolah"]',
      category: 'Manajemen Sistem',
      description: 'Pendaftaran sekolah baru, pengubahan nama instansi, pengelolaan NPSN, dan pemantauan lisensi sekolah.',
      steps: [
        'Pilih menu "Sekolah" pada bilah navigasi.',
        'Klik "+ Tambah Sekolah" untuk mendaftarkan instansi baru.'
      ],
      keywords: [
        'sekolah', 'manajemen sekolah', 'tambah sekolah', 'npsn', 'daftar sekolah',
        'instansi', 'buat sekolah', 'kelola sekolah'
      ],
      sampleQueries: [
        'tambah sekolah baru',
        'daftar sekolah terdaftar',
        'kelola data sekolah'
      ]
    },
    {
      id: 'superadmin_admin',
      role: 'super_admin',
      title: 'Manajemen Akun Admin Sekolah',
      targetTab: 'admin',
      actionLabel: 'Buka Manajemen Admin',
      selector: '[data-assistant-target="admin"]',
      category: 'Manajemen Sistem',
      description: 'Pembuatan akun admin sekolah per NPSN, reset password akun admin, dan verifikasi hak akses.',
      steps: [
        'Buka menu "Admin" di bilah navigasi.',
        'Pilih sekolah tujuan dan buat akun admin baru.'
      ],
      keywords: [
        'admin', 'manajemen admin', 'tambah admin', 'akun admin', 'daftar admin',
        'reset password admin', 'admin sekolah'
      ],
      sampleQueries: [
        'buat akun admin sekolah',
        'kelola admin',
        'reset sandi admin sekolah'
      ]
    },
    {
      id: 'superadmin_pengumuman',
      role: 'super_admin',
      title: 'Informasi & Pengumuman Global',
      targetTab: 'pengumuman',
      actionLabel: 'Buka Pengumuman Global',
      selector: '[data-assistant-target="pengumuman"]',
      category: 'Komunikasi',
      description: 'Siaran pengumuman atau maintenance sistem secara serentak ke seluruh sekolah pengguna CBT NEXA.',
      steps: ['Buka menu "Informasi" dan buat siaran pengumuman global.'],
      keywords: [
        'pengumuman global', 'informasi', 'broadcast', 'kirim pesan global', 'maintenance',
        'pengumuman', 'informasi global', 'siaran pengumuman'
      ],
      sampleQueries: [
        'pengumuman global',
        'kirim pengumuman global',
        'broadcast pesan',
        'informasi sistem'
      ]
    },
    {
      id: 'superadmin_log',
      role: 'super_admin',
      title: 'Log Aktivitas Global',
      targetTab: 'log',
      actionLabel: 'Buka Log Aktivitas',
      selector: '[data-assistant-target="log"]',
      category: 'Audit & Keamanan',
      description: 'Audit trail rekaman aktivitas menyeluruh lintas sekolah dan pengguna di seluruh sistem NEXA CBT.',
      steps: ['Buka menu "Log" pada navigasi.'],
      keywords: ['log aktivitas', 'audit trail', 'riwayat global', 'log sistem', 'audit'],
      sampleQueries: ['cek log global', 'audit aktivitas sistem']
    },
    {
      id: 'superadmin_akun',
      role: 'super_admin',
      title: 'Akun Super Admin & Reset Data',
      targetTab: 'akun',
      actionLabel: 'Buka Pengaturan Akun',
      selector: '[data-assistant-target="akun"]',
      category: 'Keamanan',
      description: 'Ganti password akun Super Admin dan zona bahaya pemeliharaan reset data sistem.',
      steps: ['Buka menu "Akun" di bilah navigasi.'],
      keywords: [
        'akun', 'profil super admin', 'ganti password', 'reset semua data', 'zona bahaya',
        'ganti sandi', 'ubah sandi', 'password', 'profil'
      ],
      sampleQueries: [
        'ganti password',
        'ganti sandi',
        'profil',
        'ganti password super admin',
        'keamanan super admin',
        'zona bahaya'
      ]
    }
  ]
};

// ============================================================================
// 2. INDONESIAN STEMMING & NATURAL LANGUAGE NORMALIZATION
// ============================================================================

const INDONESIAN_SYNONYMS = {
  'bikin': 'buat',
  'bikin-soal': 'buat soal',
  'liat': 'lihat',
  'cek': 'lihat',
  'tengok': 'lihat',
  'skor': 'nilai',
  'score': 'nilai',
  'grade': 'nilai',
  'poin': 'nilai',
  'print': 'cetak',
  'ngeprint': 'cetak',
  'download': 'unduh',
  'ngunduh': 'unduh',
  'upload': 'unggah',
  'ngunggah': 'unggah',
  'pass': 'password',
  'sandi': 'password',
  'pwd': 'password',
  'kata-sandi': 'password',
  'murid': 'siswa',
  'peserta': 'siswa',
  'pengajar': 'guru',
  'jadual': 'jadwal',
  'absen': 'presensi',
  'absensi': 'presensi',
  'ranking': 'peringkat',
  'juara': 'peringkat'
};

const COMMON_PREFIX_PATTERNS = [
  [/^melihat$/i, 'lihat'],
  [/^membuat$/i, 'buat'],
  [/^mencetak$/i, 'cetak'],
  [/^mengecek$/i, 'lihat'],
  [/^mengerjakan$/i, 'kerja'],
  [/^mengatur$/i, 'atur'],
  [/^memeriksa$/i, 'periksa'],
  [/^mengubah$/i, 'ubah'],
  [/^mengunduh$/i, 'unduh'],
  [/^mengunggah$/i, 'unggah'],
  [/^memasukkan$/i, 'masuk'],
  [/^pengaturan$/i, 'atur'],
  [/^penjadwalan$/i, 'jadwal'],
  [/^pelaksanaan$/i, 'laksana'],
  [/^pemeriksaan$/i, 'periksa']
];

/**
 * Normalizes an Indonesian text query.
 * Lowercases, strips punctuation, maps colloquial synonyms, and standardizes stems.
 */
export function normalizeQuery(query) {
  if (!query || typeof query !== 'string') return '';
  let str = query.toLowerCase().trim();

  // Replace punctuation with spaces
  str = str.replace(/[^\w\s-]/g, ' ');

  // Split tokens
  const rawTokens = str.split(/\s+/).filter(Boolean);
  const normalizedTokens = rawTokens.map(token => {
    // 1. Synonym check
    if (INDONESIAN_SYNONYMS[token]) {
      return INDONESIAN_SYNONYMS[token];
    }
    // 2. Prefix pattern check
    for (const [pattern, replacement] of COMMON_PREFIX_PATTERNS) {
      if (pattern.test(token)) {
        return replacement;
      }
    }
    return token;
  });

  return normalizedTokens.join(' ');
}

/**
 * Computes Levenshtein distance between two strings.
 */
export function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = [];
  for (let i = 0; i <= b.length; i++) row[i] = i;

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      let val;
      if (a[i - 1] === b[j - 1]) {
        val = row[j - 1];
      } else {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

// ============================================================================
// 3. INTENT MATCHING & SCORING ENGINE (< 20ms execution)
// ============================================================================

/**
 * Determines whether a query explicitly targets an unauthorized role or action.
 */
function isQueryExplicitlyForOtherRole(rawQuery, userRole) {
  const norm = normalizeQuery(rawQuery);
  const tokens = norm.split(/\s+/).filter(Boolean);

  if (userRole === 'siswa') {
    // Check if query is prepositional referring to data provided by teacher or school
    const isPrepositionalGuru = norm.includes('dari guru') || norm.includes('oleh guru') || norm.includes('guru saya') || norm.includes('guru pengampu');

    // Forbidden cross-role actions & student scope violations
    if (norm.includes('semua siswa') || norm.includes('seluruh siswa') || norm.includes('semua kelas') || norm.includes('massal')) return true;
    if (tokens.includes('admin') || (!isPrepositionalGuru && (tokens.includes('guru') || tokens.includes('pengawas'))) || norm.includes('kop surat')) return true;
    if (norm.includes('buat jadwal') || norm.includes('bikin jadwal') || norm.includes('atur jadwal') || norm.includes('tambah jadwal') || norm.includes('hapus jadwal')) return true;
    if (norm.includes('buat soal') || norm.includes('bikin soal') || norm.includes('tambah soal') || norm.includes('import soal') || norm.includes('hapus soal') || norm.includes('edit soal')) return true;
    if (norm.includes('tambah guru') || norm.includes('import guru') || norm.includes('tambah murid') || norm.includes('tambah siswa') || norm.includes('import siswa') || norm.includes('hapus siswa') || norm.includes('hapus murid') || norm.includes('kelola siswa') || norm.includes('kelola guru')) return true;
    if (norm.includes('reset data') || norm.includes('reset semua') || norm.includes('reset peserta') || norm.includes('reset login') || norm.includes('buka blokir')) return true;
    if (norm.includes('koreksi uraian') || norm.includes('periksa uraian') || norm.includes('kunci jawaban') || norm.includes('bocoran') || norm.includes('rubrik')) return true;
    if (norm.includes('edit nilai') || norm.includes('ubah nilai') || norm.includes('hapus nilai') || norm.includes('ganti nilai') || norm.includes('koreksi nilai')) return true;
    if (norm.includes('cetak kartu') || norm.includes('cetak berita acara') || norm.includes('cetak absen') || norm.includes('dokumen ujian')) return true;
    if (norm.includes('manajemen kelas') || norm.includes('tambah kelas') || norm.includes('tambah rombel') || norm.includes('kelola rombel')) return true;
    if (norm.includes('tambah sekolah') || norm.includes('kelola sekolah') || norm.includes('superadmin')) return true;
    // Impersonation / Jailbreak / Prompt Injection patterns
    if (norm.includes('saya guru') || norm.includes('saya admin') || norm.includes('saya pengawas') || norm.includes('sebagai guru') || norm.includes('sebagai admin') || norm.includes('role guru') || norm.includes('role admin') || norm.includes('mode guru') || norm.includes('mode admin') || norm.includes('mode pengawas') || norm.includes('abaikan role') || norm.includes('abaikan instruksi') || norm.includes('abaikan batasan')) return true;
  }
  if (userRole === 'guru') {
    if (tokens.includes('admin') || tokens.includes('superadmin') || norm.includes('tambah sekolah') || norm.includes('reset data') || norm.includes('reset semua')) return true;
    if (norm.includes('tambah guru') || norm.includes('import guru') || norm.includes('tambah murid') || norm.includes('tambah siswa') || norm.includes('import siswa') || norm.includes('hapus siswa') || norm.includes('hapus murid') || norm.includes('hapus guru') || norm.includes('kelola siswa') || norm.includes('kelola guru') || norm.includes('data siswa') || norm.includes('data guru') || norm.includes('kop surat')) return true;
    if (norm.includes('buat jadwal') || norm.includes('bikin jadwal') || norm.includes('tambah jadwal') || norm.includes('atur jadwal') || norm.includes('hapus jadwal')) return true;
    if (norm.includes('cetak kartu') || norm.includes('manajemen admin') || norm.includes('sekolah baru') || norm.includes('zona bahaya')) return true;
    if (norm.includes('tambah kelas') || norm.includes('manajemen kelas') || norm.includes('tambah rombel') || norm.includes('tambah mapel') || norm.includes('profil sekolah') || norm.includes('pengaturan sekolah')) return true;
    if (norm.includes('masukkan token') || norm.includes('input token') || norm.includes('isi token')) return true;
    if (norm.includes('saya admin') || norm.includes('sebagai admin') || norm.includes('role admin') || norm.includes('mode admin') || norm.includes('super admin') || norm.includes('abaikan role')) return true;
  }
  if (userRole === 'admin') {
    if (tokens.includes('superadmin') || norm.includes('tambah sekolah') || norm.includes('sekolah baru') || norm.includes('zona bahaya') || norm.includes('log global')) return true;
    if (norm.includes('masukkan token') || norm.includes('input token') || norm.includes('isi token')) return true;
    if (norm.includes('saya superadmin') || norm.includes('sebagai superadmin') || norm.includes('abaikan role')) return true;
  }
  if (userRole === 'super_admin') {
    if (norm.includes('buat soal') || norm.includes('bikin soal') || norm.includes('bank soal') || norm.includes('import aiken') || norm.includes('periksa uraian') || norm.includes('analisis butir soal') || norm.includes('koreksi esai')) return true;
    if (norm.includes('buat jadwal') || norm.includes('bikin jadwal') || norm.includes('tambah jadwal') || norm.includes('atur jadwal') || norm.includes('jadwal ujian')) return true;
    if (norm.includes('tambah siswa') || norm.includes('import siswa') || norm.includes('data siswa') || norm.includes('kelola siswa') || norm.includes('tambah guru') || norm.includes('import guru') || norm.includes('data guru') || norm.includes('kelola guru') || norm.includes('tambah rombel') || norm.includes('tambah kelas') || norm.includes('tambah mapel')) return true;
    if (norm.includes('cetak kartu') || norm.includes('cetak absen') || norm.includes('berita acara') || norm.includes('kontrol ujian') || norm.includes('reset login') || norm.includes('skema penilaian') || norm.includes('kop surat')) return true;
    if (norm.includes('mulai ujian') || norm.includes('masukkan token') || norm.includes('input token') || norm.includes('isi token')) return true;
    if (norm.includes('saya guru') || norm.includes('saya siswa') || norm.includes('sebagai guru') || norm.includes('sebagai siswa') || norm.includes('abaikan role')) return true;
  }
  return false;
}

/**
 * Calculates a match score between a normalized query and a feature item.
 */
function calculateFeatureScore(normalizedQuery, item) {
  if (!normalizedQuery) return 0;

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (!queryTokens.length) return 0;

  let score = 0;
  const normalizedKeywords = [...new Set((item.keywords || []).map(kw => normalizeQuery(kw)).filter(Boolean))];

  // 1. Exact phrase match with title
  const titleNorm = normalizeQuery(item.title);
  if (normalizedQuery === titleNorm) {
    score += 250;
  } else if (titleNorm.includes(normalizedQuery)) {
    score += 100;
  }

  // 2. Exact keyword / phrase match (deduplicated, phrase match scored at most once)
  let bestPhraseScore = 0;
  for (const kw of normalizedKeywords) {
    if (kw === normalizedQuery) {
      bestPhraseScore = Math.max(bestPhraseScore, 180);
      break;
    } else if (kw.includes(' ') && normalizedQuery.includes(kw)) {
      bestPhraseScore = Math.max(bestPhraseScore, 80);
    }
  }
  score += bestPhraseScore;

  // 3. Sample queries exact match
  if (item.sampleQueries) {
    let bestSqScore = 0;
    for (const sq of item.sampleQueries) {
      const sqNorm = normalizeQuery(sq);
      if (normalizedQuery === sqNorm) {
        bestSqScore = Math.max(bestSqScore, 200);
      } else if (sqNorm.includes(normalizedQuery) && normalizedQuery.length >= 4) {
        bestSqScore = Math.max(bestSqScore, 90);
      } else if (normalizedQuery.includes(sqNorm) && (sqNorm.includes(' ') || sqNorm.length >= 8)) {
        bestSqScore = Math.max(bestSqScore, 90);
      }
    }
    score += bestSqScore;
  }

  // 4. Keyword matching (token by token)
  let matchedKeywordTokens = 0;

  for (const qToken of queryTokens) {
    let bestTokenScore = 0;

    for (const kw of normalizedKeywords) {
      const kwTokens = kw.split(/\s+/).filter(Boolean);

      if (kw === qToken) {
        // Exact single-word keyword match
        bestTokenScore = Math.max(bestTokenScore, 40);
      } else if (kwTokens.includes(qToken)) {
        // Token matches one word in multi-word keyword
        bestTokenScore = Math.max(bestTokenScore, 30);
      } else if (qToken.length >= 4) {
        // Fuzzy Levenshtein match for typo tolerance
        for (const kt of kwTokens) {
          if (kt.length >= 4) {
            const dist = levenshteinDistance(qToken, kt);
            if (dist === 1) {
              bestTokenScore = Math.max(bestTokenScore, 25);
            } else if (dist === 2 && qToken.length >= 6) {
              bestTokenScore = Math.max(bestTokenScore, 15);
            }
          }
        }
      }
    }

    if (bestTokenScore > 0) {
      matchedKeywordTokens++;
      score += bestTokenScore;
    }
  }

  // Multi-token overlap multiplier bonus
  if (queryTokens.length > 1 && matchedKeywordTokens >= 2) {
    score += matchedKeywordTokens * 20;
  }

  // If ALL query tokens matched, give a completion bonus
  if (queryTokens.length > 0 && matchedKeywordTokens === queryTokens.length) {
    score += 40;
  }

  // Penalty for matching very few tokens in a multi-token query
  const coverage = matchedKeywordTokens / queryTokens.length;
  if (queryTokens.length >= 2 && coverage < 0.5) {
    score *= 0.5;
  }

  return score;
}

function isImpersonatingOtherRole(norm, userRole) {
  if (userRole === 'siswa') {
    return norm.includes('saya admin') || norm.includes('sebagai admin') || norm.includes('role admin') || norm.includes('mode admin') ||
           norm.includes('saya guru') || norm.includes('sebagai guru') || norm.includes('role guru') || norm.includes('mode guru') ||
           norm.includes('saya pengawas') || norm.includes('sebagai pengawas') || norm.includes('mode pengawas') ||
           norm.includes('abaikan role') || norm.includes('abaikan instruksi') || norm.includes('abaikan batasan');
  }
  if (userRole === 'guru') {
    return norm.includes('saya admin') || norm.includes('sebagai admin') || norm.includes('role admin') || norm.includes('mode admin') ||
           norm.includes('saya superadmin') || norm.includes('sebagai superadmin') || norm.includes('super admin') ||
           norm.includes('abaikan role') || norm.includes('abaikan instruksi');
  }
  if (userRole === 'admin') {
    return norm.includes('saya superadmin') || norm.includes('sebagai superadmin') || norm.includes('role superadmin') ||
           norm.includes('abaikan role');
  }
  return false;
}

/**
 * Searches and matches a query against the assistant registry.
 * Strictly enforces role-based access scoping and isolates unauthorized intents.
 *
 * @param {string} rawQuery - The raw user input
 * @param {string} userRole - 'admin' | 'guru' | 'siswa' | 'super_admin'
 * @returns {object} Match result with status, action, message, and execution time
 */
export function matchAssistantQuery(rawQuery, userRole = 'siswa') {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const normalizedQuery = normalizeQuery(rawQuery);

  if (!normalizedQuery) {
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;
    return {
      status: 'empty',
      executionTimeMs: elapsed,
      message: 'Silakan ketik pertanyaan atau nama menu yang ingin Anda tuju.',
      action: null,
      suggestions: getRoleQuickSuggestions(userRole)
    };
  }

  // 1. Evaluate features within user's own authorized role
  const authorizedFeatures = FEATURE_REGISTRY[userRole] || [];
  let bestAuthorizedMatch = null;
  let bestAuthorizedScore = 0;

  for (const item of authorizedFeatures) {
    const score = calculateFeatureScore(normalizedQuery, item);
    if (score > bestAuthorizedScore) {
      bestAuthorizedScore = score;
      bestAuthorizedMatch = item;
    }
  }

  // 2. Evaluate features across ALL other roles to detect unauthorized intent
  let bestOtherRoleMatch = null;
  let bestOtherRoleScore = 0;

  const allRoles = Object.keys(FEATURE_REGISTRY);
  for (const roleKey of allRoles) {
    if (roleKey === userRole) continue;
    for (const item of FEATURE_REGISTRY[roleKey]) {
      const score = calculateFeatureScore(normalizedQuery, item);
      if (score > bestOtherRoleScore) {
        bestOtherRoleScore = score;
        bestOtherRoleMatch = item;
      }
    }
  }

  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;

  // 3. Check for Strict Role Boundary (R4)
  const MIN_MATCH_THRESHOLD = 25;
  const explicitOtherRole = isQueryExplicitlyForOtherRole(rawQuery, userRole);
  const isImpersonating = isImpersonatingOtherRole(normalizedQuery, userRole);

  let isUnauthorized = false;
  if (bestAuthorizedScore < MIN_MATCH_THRESHOLD && bestOtherRoleScore >= 35) {
    isUnauthorized = true;
  } else if (isImpersonating && bestOtherRoleScore >= 15) {
    isUnauthorized = true;
  } else if (explicitOtherRole && bestOtherRoleScore >= MIN_MATCH_THRESHOLD) {
    isUnauthorized = true;
  } else if (bestOtherRoleScore >= 100 && bestOtherRoleScore >= bestAuthorizedScore * 2.0) {
    isUnauthorized = true;
  }

  if (isUnauthorized) {
    // Definitive unauthorized query attempt
    const targetRoleName = bestOtherRoleMatch ? (ROLE_DISPLAY_NAMES[bestOtherRoleMatch.role] || bestOtherRoleMatch.role) : 'pengguna berwenang';
    const attemptedTitle = bestOtherRoleMatch ? bestOtherRoleMatch.title : 'fitur ini';
    const currentRoleName = ROLE_DISPLAY_NAMES[userRole] || userRole;

    return {
      status: 'unauthorized',
      executionTimeMs: elapsed,
      matchedRole: bestOtherRoleMatch ? bestOtherRoleMatch.role : null,
      attemptedFeature: attemptedTitle,
      message: `Mohon maaf, fitur "${attemptedTitle}" hanya dapat diakses oleh ${targetRoleName}. Sebagai ${currentRoleName}, Anda tidak memiliki izin untuk mengakses menu ini.`,
      action: null, // NEVER provide action button for unauthorized target
      allowedSuggestions: getRoleQuickSuggestions(userRole)
    };
  }

  // 4. Authorized Match Success
  if (bestAuthorizedMatch && bestAuthorizedScore >= MIN_MATCH_THRESHOLD) {
    const action = {
      label: bestAuthorizedMatch.actionLabel,
      tab: bestAuthorizedMatch.targetTab,
      modal: bestAuthorizedMatch.targetModal || null,
      selector: bestAuthorizedMatch.selector
    };

    return {
      status: 'matched',
      executionTimeMs: elapsed,
      score: bestAuthorizedScore,
      feature: bestAuthorizedMatch,
      title: bestAuthorizedMatch.title,
      description: bestAuthorizedMatch.description,
      steps: bestAuthorizedMatch.steps || [],
      action,
      relatedSuggestions: getRoleQuickSuggestions(userRole).filter(s => s !== bestAuthorizedMatch.title).slice(0, 3)
    };
  }

  // 5. Fallback - no confident match
  return {
    status: 'fallback',
    executionTimeMs: elapsed,
    message: `Maaf, saya belum menemukan menu atau panduan yang cocok untuk "${rawQuery.trim()}". Anda dapat memilih salah satu topik bantuan cepat di bawah:`,
    action: null,
    suggestions: getRoleQuickSuggestions(userRole)
  };
}

/**
 * Returns quick suggestion chips tailored to a role.
 */
export function getRoleQuickSuggestions(role) {
  switch (role) {
    case 'admin':
      return [
        'Cetak Kartu Ujian',
        'Lihat Nilai & Rekap',
        'Buat Jadwal Ujian',
        'Bank Soal',
        'Atur Kop Surat & Logo',
        'Skema Penilaian',
        'Master Data Siswa'
      ];
    case 'guru':
      return [
        'Bikin Soal Baru',
        'Periksa Uraian',
        'Lihat Nilai Siswa',
        'Ruang Pengawasan',
        'Import Aiken',
        'Jadwal Ujian Saya'
      ];
    case 'siswa':
      return [
        'Lihat Nilai Saya',
        'Jadwal Ujian Aktif',
        'Masukkan Token Ujian',
        'Papan Peringkat',
        'Ganti Password',
        'Pengumuman Sekolah'
      ];
    case 'super_admin':
      return [
        'Dasbor Statistik Global',
        'Manajemen Sekolah',
        'Manajemen Admin',
        'Pengumuman Global',
        'Log Aktivitas'
      ];
    default:
      return ['Panduan Penggunaan', 'Lihat Jadwal', 'Nilai'];
  }
}

// ============================================================================
// 4. VISUAL CUEING & SMOOTH NAVIGATION HELPER (R3)
// ============================================================================

/**
 * Highlights a target DOM element with a prominent animated ring and smoothly scrolls to it.
 *
 * @param {string} selector - CSS selector
 * @param {number} durationMs - How long the highlight persists (default 3000ms)
 */
export function triggerVisualCue(selector, durationMs = 3000) {
  if (typeof document === 'undefined') return;

  const attemptHighlight = (attempt = 1) => {
    try {
      const el = document.querySelector(selector);
      if (!el) {
        if (attempt < 3) {
          setTimeout(() => attemptHighlight(attempt + 1), 150);
        }
        return;
      }

      // Add animated highlight class
      el.classList.add('nexa-assistant-highlight');

      // Smooth scroll
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) {
        // Fallback for older browsers
        el.scrollIntoView();
      }

      // Remove highlight class after timeout
      setTimeout(() => {
        try {
          el.classList.remove('nexa-assistant-highlight');
        } catch (e) {}
      }, durationMs);
    } catch (err) {
      // Gracefully ignore selector syntax errors
    }
  };

  attemptHighlight(1);
}
