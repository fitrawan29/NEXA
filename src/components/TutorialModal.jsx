import React, { useState, useEffect, useRef, useCallback, useId } from 'react';

/**
 * NEXA CBT - Interactive Walk-Through System & Coach Marks Engine
 *
 * Features:
 * - Spotlight Overlay: Real-time SVG mask cutout over targeted DOM elements with glowing focus box.
 * - Smart Tooltip Popover: Automatic collision detection and positioning (bottom, top, right, left) clamped to viewport.
 * - Auto-Scroll: Smoothly scrolls target element into view before spotlighting.
 * - Keyboard Support: ArrowLeft (Prev), ArrowRight (Next), Escape (Close/Skip), Tab focus trap.
 * - Progressive Disclosure: Exports <TutorialBadge /> for nav menus and action buttons. Unlocks topic by topic.
 * - Multi-Role Support: Admin, Guru, Siswa, Super Admin, and ExamRoom.
 * - Zero external libraries: 100% native React 18, Tailwind CSS, Material Symbols.
 */

export const ROLE_THEMES = {
  admin: {
    name: 'Admin Sekolah',
    badge: 'Admin',
    color: 'blue',
    icon: 'admin_panel_settings',
    bgActive: 'bg-blue-600 text-white shadow-blue-500/20',
    borderActive: 'border-blue-600',
    textAccent: 'text-blue-600 dark:text-blue-400',
    cardBg: 'bg-blue-50/70 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/50',
    btnPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
    glowColor: 'rgba(37, 99, 235, 0.45)',
    ringGlowColor: 'rgba(59, 130, 246, 0.5)'
  },
  guru: {
    name: 'Guru Pengampu / Pengawas',
    badge: 'Guru',
    color: 'amber',
    icon: 'school',
    bgActive: 'bg-amber-600 text-white shadow-amber-500/20',
    borderActive: 'border-amber-600',
    textAccent: 'text-amber-600 dark:text-amber-400',
    cardBg: 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/50',
    btnPrimary: 'bg-amber-600 hover:bg-amber-700 text-white',
    glowColor: 'rgba(217, 119, 6, 0.45)',
    ringGlowColor: 'rgba(245, 158, 11, 0.5)'
  },
  siswa: {
    name: 'Siswa Peserta Ujian',
    badge: 'Siswa',
    color: 'emerald',
    icon: 'person',
    bgActive: 'bg-emerald-600 text-white shadow-emerald-500/20',
    borderActive: 'border-emerald-600',
    textAccent: 'text-emerald-600 dark:text-emerald-400',
    cardBg: 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/50',
    btnPrimary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    glowColor: 'rgba(16, 185, 129, 0.45)',
    ringGlowColor: 'rgba(16, 185, 129, 0.5)'
  },
  super_admin: {
    name: 'Super Admin',
    badge: 'Super Admin',
    color: 'purple',
    icon: 'shield_person',
    bgActive: 'bg-purple-600 text-white shadow-purple-500/20',
    borderActive: 'border-purple-600',
    textAccent: 'text-purple-600 dark:text-purple-400',
    cardBg: 'bg-purple-50/70 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/50',
    btnPrimary: 'bg-purple-600 hover:bg-purple-700 text-white',
    glowColor: 'rgba(147, 51, 234, 0.45)',
    ringGlowColor: 'rgba(168, 85, 247, 0.5)'
  },
  exam_room: {
    name: 'Ruang Ujian Siswa',
    badge: 'Ujian CBT',
    color: 'indigo',
    icon: 'assignment',
    bgActive: 'bg-indigo-600 text-white shadow-indigo-500/20',
    borderActive: 'border-indigo-600',
    textAccent: 'text-indigo-600 dark:text-indigo-400',
    cardBg: 'bg-indigo-50/70 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/50',
    btnPrimary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    glowColor: 'rgba(99, 102, 241, 0.45)',
    ringGlowColor: 'rgba(129, 140, 248, 0.5)'
  }
};

export const TUTORIAL_DATA = {
  admin: [
    {
      id: 'admin-siswa',
      targetId: 'admin-siswa',
      badgeTargetIds: ['admin-siswa'],
      targetSelector: '[data-tutorial="admin-siswa"]',
      fallbackSelector: '[data-assistant-target="siswa"]',
      title: 'Pengelolaan Data Master Sekolah Massal',
      shortTitle: 'Data Master',
      icon: 'database',
      subtitle: 'Entri massal siswa, guru, mapel, dan pembagian kelas paralel via Excel',
      points: [
        'Langkah 1: Buka sidebar kiri pada grup Data Master, lalu klik menu **Data Siswa**, **Data Guru**, atau **Mata Pelajaran** untuk mengakses tabel master sekolah.',
        'Langkah 2: Pada sudut kanan atas tabel, klik tombol **Download Template** Excel untuk mengunduh format berkas resmi sesuai skema database.',
        'Langkah 3: Klik tombol **Import Excel** di bilah aksi untuk mengunggah spreadsheet massal dan pastikan seluruh baris data terverifikasi masuk ke tabel.',
        'Langkah 4: Buka sidebar kiri > menu **Manajemen Kelas**, klik kelola rombel untuk mengatur kelas paralel (misal: X A, X B) serta menautkan penugasan guru mapel agar terintegrasi ke jadwal ujian.'
      ],
      tip: 'Sebelum mengimpor data siswa massal, pastikan seluruh data Kelas sudah dibuat agar siswa otomatis terdaftar ke rombel yang valid.'
    },
    {
      id: 'admin-jadwal',
      targetId: 'admin-jadwal',
      badgeTargetIds: ['admin-jadwal'],
      targetSelector: '[data-tutorial="admin-jadwal"]',
      fallbackSelector: '[data-assistant-target="jadwal"]',
      title: 'Penjadwalan Ujian & Auto-Select Guru Pengampu',
      shortTitle: 'Penjadwalan',
      icon: 'calendar_month',
      subtitle: 'Alokasi cerdas pengampu dan penargetan multi-kelas paralel',
      points: [
        'Langkah 1: Buka sidebar kiri pada grup Operasional Ujian, lalu klik menu **Jadwal Ujian** untuk membuka tabel agenda ujian.',
        'Langkah 2: Di sudut kanan atas halaman jadwal, klik tombol **+ Buat Jadwal** untuk memunculkan formulir konfigurasi jadwal ujian baru.',
        'Langkah 3: Pada dropdown formulir, pilih **Mata Pelajaran** yang diujikan; sistem secara otomatis memilih Guru Pengampu yang berwenang (auto-select guru pengampu).',
        'Langkah 4: Pada form penargetan, tentukan target rombel kelas paralel, alokasi ruang ujian, dan durasi pengerjaan, lalu klik simpan hingga token ujian aktif terbit.'
      ],
      tip: 'Token ujian dapat di-generate otomatis dan dibagikan sesaat sebelum ujian dimulai untuk mencegah kebocoran sesi.'
    },
    {
      id: 'admin-pengaturan',
      targetId: 'admin-pengaturan',
      badgeTargetIds: ['admin-pengaturan'],
      targetSelector: '[data-tutorial="admin-pengaturan"]',
      fallbackSelector: '[data-assistant-target="pengaturan"]',
      title: 'Profil Sekolah, Alamat & Konfigurasi Kop',
      shortTitle: 'Profil & Kop',
      icon: 'settings',
      subtitle: 'Format resmi kop dokumen surat dan kartu ujian berlogo',
      points: [
        'Langkah 1: Buka sidebar kiri pada grup Sistem & Akun, lalu klik menu **Pengaturan / Profil Sekolah** untuk mengonfigurasi identitas instansi.',
        'Langkah 2: Pada formulir profil, isi lengkap kolom **Alamat Sekolah** (jalan, kecamatan, kota/kabupaten, provinsi) sebagai identitas resmi dokumen cetak.',
        'Langkah 3: Pada panel berkas gambar, unggah berkas **Logo Dinas** (kiri) dan **Logo Sekolah** (kanan) dengan optimasi kompresi otomatis berbobot ringan.',
        'Langkah 4: Periksa bagian **Live Preview Kop** di layar pratinjau untuk memastikan tata letak kop kartu peserta dan dokumen berita acara presisi sebelum disimpan.'
      ],
      tip: 'Perubahan alamat dan konfigurasi kop langsung tersinkronisasi ke seluruh dokumen cetak tanpa perlu me-reset jadwal.'
    },
    {
      id: 'admin-pengawas',
      targetId: 'admin-pengawas',
      badgeTargetIds: ['admin-pengawas', 'admin-kontrol'],
      targetSelector: '[data-tutorial="admin-pengawas"], [data-tutorial="admin-kontrol"]',
      fallbackSelector: '[data-assistant-target="pengawas"], [data-assistant-target="kontrol"]',
      title: 'Live Monitoring Real-Time & Kontrol Ujian',
      shortTitle: 'Monitoring Live',
      icon: 'monitoring',
      subtitle: 'Pengawasan live status pengerjaan dan intervensi peserta',
      points: [
        'Langkah 1: Buka sidebar kiri pada grup Operasional Ujian, lalu klik menu **Pengawas & Ruang** (atau **Kontrol Ujian**) untuk memantau sesi aktif.',
        'Langkah 2: Pada bilah atas kontrol, pantau status peserta secara real-time pada kartu metrik **HUD** (**Total Peserta**, **Sedang Mengerjakan**, **Selesai**, **Terblokir**) agar kondisi ujian terpantau jelas.',
        'Langkah 3: Pada tabel peserta, jika ada siswa terkendala atau terblokir aturan 3-strike, klik tombol **Reset Sesi** atau **Buka Blokir** pada baris siswa terkait agar sesi kembali aktif.',
        'Langkah 4: Pada kotak dialog konfirmasi, klik setujui tindakan reset agar siswa dapat login kembali melanjutkan pengerjaan dengan seluruh riwayat jawaban tersimpan aman.'
      ],
      tip: 'Gunakan filter kelas atau pencarian nama/NISN pada tabel peserta untuk mempercepat pencarian siswa saat ujian massal.'
    },
    {
      id: 'admin-dokumen',
      targetId: 'admin-dokumen',
      badgeTargetIds: ['admin-dokumen', 'admin-siswa', 'admin-jadwal'],
      targetSelector: '[data-tutorial="admin-dokumen"], [data-tutorial="admin-jadwal"], [data-tutorial="admin-siswa"]',
      fallbackSelector: '[data-assistant-target="jadwal"], [data-assistant-target="siswa"]',
      title: 'Cetak Kartu Ujian & Berkas Pengawasan Pasca-Ujian',
      shortTitle: 'Cetak Dokumen',
      icon: 'print',
      subtitle: 'Pencetakan kartu peserta, kartu meja, dan berkas berita acara resmi',
      points: [
        'Langkah 1: Pada tabel menu **Data Siswa**, klik tombol **Cetak Kartu Peserta** atau **Cetak Kartu Meja** untuk mencetak kartu 8-up per lembar A4/F4 siap potong.',
        'Langkah 2: Pada tabel menu **Jadwal Ujian**, klik ikon **Cetak Dokumen** pasca-ujian untuk mencetak **Berita Acara** & **Daftar Hadir** resmi bertanda tangan digital siswa.',
        'Langkah 3: Pada modal cetak, gunakan filter **Room Picker** untuk memilih dan memisahkan cetak dokumen pengawasan khusus per ruangan tertentu.',
        'Langkah 4: Pada jendela dialog cetak peramban (Ctrl+P), klik tombol cetak untuk menerbitkan berkas fisik Berita Acara dan Daftar Hadir sebagai dokumen arsip resmi instansi.'
      ],
      tip: 'Gunakan dialog cetak browser (Ctrl+P) dengan opsi "Print to PDF" untuk membuat arsip digital dokumen pengawasan resmi.'
    }
  ],

  guru: [
    {
      id: 'guru-dashboard',
      targetId: 'guru-dashboard',
      badgeTargetIds: ['guru-dashboard'],
      targetSelector: '[data-tutorial="guru-dashboard"]',
      fallbackSelector: '[data-assistant-target="dashboard"]',
      title: 'Hak Akses Khusus Mapel yang Diampu (Subject Scoping)',
      shortTitle: 'Hak Akses Mapel',
      icon: 'lock',
      subtitle: 'Isolasi akses demi privasi dan integritas data antar guru',
      points: [
        'Langkah 1: Buka navigasi atas > menu **Beranda Guru**, klik untuk melihat ringkasan jadwal aktif, kuota mengajar, dan status ujian hari ini.',
        'Langkah 2: Pada dasbor penugasan, telusuri daftar mapel dan pastikan akses bank soal serta jadwal ujian otomatis terisolasi khusus mapel yang Anda ampu demi keamanan data.',
        'Langkah 3: Buka navigasi atas > menu **Jadwal Mengajar**, klik jadwal aktif untuk memantau agenda ujian dan mencetak berkas pengawasan resmi untuk mapel yang diampu.'
      ],
      tip: 'Jika ada mata pelajaran baru yang belum muncul di dashboard Anda, koordinasikan dengan Admin Sekolah untuk alokasi mapel.'
    },
    {
      id: 'guru-bank_soal',
      targetId: 'guru-bank_soal',
      badgeTargetIds: ['guru-bank_soal'],
      targetSelector: '[data-tutorial="guru-bank_soal"]',
      fallbackSelector: '[data-assistant-target="bank_soal"]',
      title: 'Bank Soal & Unggah Gambar ke Google Drive',
      shortTitle: 'Bank Soal & Drive',
      icon: 'quiz',
      subtitle: 'Hierarki penyimpanan NEXA > [Sekolah] > [Kelas] > [Mapel] dengan fallback aman',
      points: [
        'Langkah 1: Buka bilah navigasi guru > menu **Bank Soal & Narasi**, klik untuk membuka lembar kerja butir soal.',
        'Langkah 2: Pada dropdown pemilih mapel di bilah atas, pilih mata pelajaran yang diampu untuk mengarahkan pengelolaan butir soal pada mata pelajaran yang tepat.',
        'Langkah 3: Di sudut kanan atas tabel soal, klik tombol **+ Tambah Soal** (6 tipe: **PG**, **PGK**, **BS**, **Jodoh**, **Isian**, **Uraian**) atau gunakan opsi **Import Aiken** untuk mengunggah naskah soal secara massal.',
        'Langkah 4: Pada editor soal, klik tombol unggah gambar soal yang otomatis tersinkronisasi ke **Google Drive** via GAS dengan folder sekolah/kelas/mapel (didukung fallback penyimpanan lokal).',
        'Langkah 5: Buka tab navigasi **Kelola Narasi Soal**, klik tambah narasi stimulus bersama jika terdapat butir soal yang mengacu pada wacana teks panjang yang sama agar soal terhubung rapi.'
      ],
      tip: 'Manfaatkan fitur Kelola Narasi Soal bersama untuk butir-butir soal yang mengacu pada wacana teks panjang yang sama.'
    },
    {
      id: 'guru-akun',
      targetId: 'guru-akun',
      badgeTargetIds: ['guru-akun'],
      targetSelector: '[data-tutorial="guru-akun"]',
      fallbackSelector: '[data-assistant-target="akun"]',
      title: 'Konfigurasi Skema Penilaian (Per Mapel & Serentak)',
      shortTitle: 'Skema Penilaian',
      icon: 'tune',
      subtitle: 'Kustomisasi pembobotan tipe soal secara tunggal atau massal',
      points: [
        'Langkah 1: Buka navigasi akun guru > menu **Profil Guru**, klik untuk mengakses konfigurasi akun pendidik.',
        'Langkah 2: Pada halaman profil guru, pilih panel **Skema Penilaian** untuk menentukan mode penskoran (Proporsional atau Kustom 100%).',
        'Langkah 3: Pada formulir skema, tentukan bobot masing-masing tipe soal (**PG**, **PGK**, **BS**, **Jodoh**, **Isian**, **Uraian**) hingga akumulasi total bernilai tepat 100%.',
        'Langkah 4: Di bagian bawah panel skema, klik tombol **Simpan Mapel Ini** atau klik **Terapkan ke Semua Mapel yang Diampu** agar konfigurasi bobot aktif di seluruh penugasan mapel Anda.'
      ],
      tip: 'Pada mode Kustom, pastikan total akumulasi persentase seluruh tipe soal tepat 100% sebelum menekan tombol simpan.'
    },
    {
      id: 'guru-pengawasan',
      targetId: 'guru-pengawasan',
      badgeTargetIds: ['guru-pengawasan', 'guru-monitoring'],
      targetSelector: '[data-tutorial="guru-pengawasan"], [data-tutorial="guru-monitoring"]',
      fallbackSelector: '[data-assistant-target="monitoring"]',
      title: 'Pelaksanaan Pengawasan Ruangan & Dokumentasi Live',
      shortTitle: 'Pengawasan Ruang',
      icon: 'visibility',
      subtitle: 'Presensi tanda tangan siswa, snapshot kamera ber-watermark, dan berita acara',
      points: [
        'Langkah 1: Buka bilah navigasi guru > menu **Ruang Pengawasan & Monitoring**, klik menu saat jadwal ujian sedang berlangsung untuk membuka dasbor pengawas.',
        'Langkah 2: Pada tabel kehadiran ruang, periksa presensi siswa bertanda tangan digital pra-ujian yang masuk otomatis ke daftar hadir ruangan.',
        'Langkah 3: Pada panel dokumentasi, klik tombol **Buka Kamera** WebRTC untuk mengambil foto ruangan live ber-watermark waktu dan nama ruang resmi.',
        'Langkah 4: Pada kanvas tanda tangan pengawas, bubuhkan tanda tangan digital Anda dan klik tombol **Simpan Berita Acara** untuk mengesahkan laporan pengawasan ujian.'
      ],
      tip: 'Jika kamera WebRTC perangkat tidak merespons, gunakan tombol upload foto fallback yang tetap menyematkan watermark otomatis.'
    },
    {
      id: 'guru-monitoring-live',
      targetId: 'guru-monitoring',
      badgeTargetIds: ['guru-monitoring', 'guru-pengawasan'],
      targetSelector: '[data-tutorial="guru-monitoring"], [data-tutorial="guru-pengawasan"]',
      fallbackSelector: '[data-assistant-target="monitoring"]',
      title: 'Live Monitoring Peserta & Reset Sesi Ujian',
      shortTitle: 'Monitoring Live',
      icon: 'monitoring',
      subtitle: 'Pantau durasi sisa, progres live peserta, dan tindakan reset kendala teknis',
      points: [
        'Langkah 1: Buka bilah navigasi guru > menu **Ruang Pengawasan & Monitoring**, klik menu untuk memantau jalannya ujian secara langsung.',
        'Langkah 2: Pada tabel peserta di layar monitoring, pantau durasi sisa dan progres live peserta secara berkala untuk mendeteksi siswa yang lambat atau berhenti mengerjakan.',
        'Langkah 3: Pada baris siswa yang mengalami kendala teknis atau koneksi terputus, klik tombol **Reset Sesi** agar siswa dapat login kembali melanjutkan sisa waktu ujian.',
        'Langkah 4: Pada kolom status peserta, pastikan indikator kembali hijau/aktif sehingga siswa dapat melanjutkan ujian tanpa kehilangan riwayat jawaban yang tersimpan.'
      ],
      tip: 'Koordinasikan dengan admin proctoring jika terjadi kendala jaringan terpusat di ruang laboratorium.'
    },
    {
      id: 'guru-hasil',
      targetId: 'guru-hasil',
      badgeTargetIds: ['guru-hasil', 'guru-nilai'],
      targetSelector: '[data-tutorial="guru-hasil"], [data-tutorial="guru-nilai"]',
      fallbackSelector: '[data-assistant-target="hasil"]',
      title: 'Rekap Nilai Siswa & Koreksi Soal Uraian',
      shortTitle: 'Rekap & Uraian',
      icon: 'fact_check',
      subtitle: 'Penilaian instan objektif, koreksi esai manual, dan ekspor spreadsheet',
      points: [
        'Langkah 1: Buka bilah navigasi guru > menu **Hasil & Rekap Nilai**, klik menu untuk melihat daftar perolehan skor ujian peserta.',
        'Langkah 2: Pada baris ujian yang memerlukan pemeriksaan esai, klik tombol **Periksa Jawaban Uraian** untuk mengevaluasi jawaban subjektif siswa dan menginput skor manual sesuai rubrik.',
        'Langkah 3: Pada kartu ringkasan hasil, periksa hasil akhir akumulasi nilai dan statistik ketuntasan siswa (rata-rata, nilai tertinggi, dan terendah) hingga seluruh skor terkonfirmasi.',
        'Langkah 4: Di sudut kanan atas tabel nilai, klik tombol **Ekspor Excel** untuk mengunduh rekap buku nilai lengkap ke spreadsheet siap olah rapor.'
      ],
      tip: 'Gunakan tab Analisis Soal untuk mengevaluasi butir soal mana yang paling sering dijawab salah oleh siswa.'
    }
  ],

  siswa: [
    {
      id: 'siswa-beranda',
      targetId: 'siswa-beranda',
      badgeTargetIds: ['siswa-beranda'],
      targetSelector: '[data-tutorial="siswa-beranda"]',
      fallbackSelector: '[data-assistant-target="beranda"]',
      title: 'Masuk Ujian dari Beranda Siswa',
      shortTitle: 'Masuk Ujian',
      icon: 'login',
      subtitle: 'Persiapan, input token jadwal aktif, dan mulai ujian',
      points: [
        'Langkah 1: Pada menu tab **Beranda**, cari dan temukan kartu jadwal ujian yang aktif sesuai sesi ujian hari ini.',
        'Langkah 2: Pada kolom input di kartu ujian, masukkan 6 karakter **Token Ujian** resmi yang dibagikan oleh pengawas ruang ujian.',
        'Langkah 3: Di bagian bawah kartu jadwal aktif, klik tombol hijau **Mulai Ujian** untuk membuka dialog verifikasi kehadiran pra-ujian.'
      ],
      tip: 'Pastikan nama siswa, kelas, dan foto profil di pojok kanan atas sudah sesuai dengan identitas diri Anda.'
    },
    {
      id: 'siswa-presensi',
      targetId: 'siswa-presensi',
      badgeTargetIds: ['siswa-presensi', 'siswa-token'],
      targetSelector: '[data-tutorial="siswa-presensi"], [data-tutorial="siswa-token"]',
      fallbackSelector: '[data-tutorial="siswa-jadwal"], [data-assistant-target="jadwal"]',
      title: 'Presensi Tanda Tangan Digital Wajib Pra-Ujian',
      shortTitle: 'Presensi Digital',
      icon: 'draw',
      subtitle: 'Syarat mutlak sebelum lembar soal ujian terbuka',
      points: [
        'Langkah 1: Saat dialog pra-ujian terbuka, coretkan tanda tangan Anda pada area **kanvas digital** menggunakan layar sentuh atau mouse hingga coretan tampak jelas.',
        'Langkah 2: Pada area bawah kanvas digital, periksa kejelasan goresan tanda tangan atau klik tombol bersihkan kanvas jika ingin mengulang agar hasil tanda tangan valid.',
        'Langkah 3: Pada dialog presensi, klik tombol **Kirim Kehadiran & Buka Soal** untuk memvalidasi presensi digital Anda dan membuka lembar soal ujian.'
      ],
      tip: 'Tanda tangan digital Anda otomatis masuk ke Daftar Hadir resmi pengawas ruang ujian.'
    },
    {
      id: 'siswa-ruang-ujian',
      targetId: 'siswa-jadwal',
      badgeTargetIds: ['siswa-jadwal', 'siswa-ruang-ujian'],
      targetSelector: '[data-tutorial="siswa-jadwal"], [data-tutorial="siswa-beranda"]',
      fallbackSelector: '[data-assistant-target="jadwal"]',
      title: 'Pengerjaan di Ruang Ujian (ExamRoom)',
      shortTitle: 'Ruang Ujian',
      icon: 'timer',
      subtitle: 'Navigasi butir soal, server time guard, dan wacana stimulus',
      points: [
        'Langkah 1: Pada bilah atas lembar ujian, pantau sisa waktu pengerjaan pada **Server Time Guard** yang tersinkronisasi presisi dengan jam server agar pengerjaan selesai tepat waktu.',
        'Langkah 2: Pada panel navigasi nomor soal di samping, klik tombol **Nomor Soal** untuk berpindah nomor (Abu-abu: belum, Hijau: sudah, Kuning: ragu-ragu).',
        'Langkah 3: Di bawah opsi jawaban lembar soal, klik tombol **Ragu-ragu** jika belum yakin dengan jawaban agar nomor ditandai warna kuning di navigator.',
        'Langkah 4: Pada panel lembar soal, klik tombol **Narasi Soal** di atas stimulus untuk membaca wacana teks panjang yang digunakan bersama oleh beberapa butir soal.'
      ],
      tip: 'Waktu ujian dikontrol dari server, sehingga manipulasi jam pada laptop atau HP tidak akan mengubah sisa waktu ujian.'
    },
    {
      id: 'siswa-tipe-soal',
      targetId: 'siswa-panduan',
      badgeTargetIds: ['siswa-panduan', 'siswa-tipe-soal'],
      targetSelector: '[data-tutorial="siswa-panduan"]',
      fallbackSelector: '[data-assistant-target="panduan"]',
      title: 'Petunjuk Menjawab 6 Tipe Butir Soal',
      shortTitle: 'Tipe Soal',
      icon: 'check_circle',
      subtitle: 'Panduan teknis pengisian format soal PG, PGK, BS, Jodoh, Isian, dan Uraian',
      points: [
        'Langkah 1: Pada soal **PG** (Pilihan Ganda), klik salah satu opsi lingkaran radio jawaban yang paling benar hingga lingkaran terisi dan tersimpan otomatis.',
        'Langkah 2: Pada soal **PGK** (Pilihan Ganda Kompleks), centang semua kotak pilihan jawaban yang benar (bisa lebih dari satu) agar seluruh bobot nilai terpenuhi.',
        'Langkah 3: Pada soal **BS** (Benar / Salah), klik opsi Benar atau Salah pada masing-masing baris pernyataan hingga seluruh baris terjawab lengkap.',
        'Langkah 4: Pada soal **Jodoh** (Menjodohkan), pasangkan setiap premis di sebelah kiri dengan pilihan respon yang tepat pada dropdown sebelah kanan hingga terhubung valid.',
        'Langkah 5: Pada soal **Isian** Singkat & **Uraian**, ketikkan teks jawaban Anda langsung pada kolom input teks yang disediakan hingga jawaban tersimpan di lembar ujian.'
      ],
      tip: 'Setiap jawaban yang Anda pilih langsung tersimpan otomatis ke server dalam hitungan detik.'
    },
    {
      id: 'siswa-keamanan',
      targetId: 'siswa-panduan',
      badgeTargetIds: ['siswa-panduan', 'siswa-keamanan'],
      targetSelector: '[data-tutorial="siswa-panduan"]',
      fallbackSelector: '[data-assistant-target="panduan"]',
      title: 'Protokol Keamanan Anti-Curang (Aturan 3-Strike)',
      shortTitle: 'Keamanan Ujian',
      icon: 'security',
      subtitle: 'Integritas sistem proctoring dan konsekuensi pelanggaran',
      points: [
        'Langkah 1: Pada ruang ujian, dilarang keras keluar jendela ujian, membuka aplikasi lain, atau berpindah tab browser selama ujian agar integritas sesi terjaga.',
        'Langkah 2: Jika layar ujian tidak sengaja blur, perhatikan **grace period 3 detik** yang aktif otomatis; segera klik kembali ke layar ujian sebelum waktu toleransi habis.',
        'Langkah 3: Pada peringatan sistem proctoring, perhatikan aturan **3-strike** (> 3 kali pelanggaran) yang otomatis membatalkan ujian, mengunci akses peserta, dan memberi nilai akhir 0 secara permanen di server.'
      ],
      tip: 'Nonaktifkan notifikasi chat, telepon, dan pop-up aplikasi pada perangkat Anda sebelum memulai ujian.'
    },
    {
      id: 'siswa-nilai',
      targetId: 'siswa-nilai',
      badgeTargetIds: ['siswa-nilai', 'siswa-riwayat'],
      targetSelector: '[data-tutorial="siswa-nilai"], [data-tutorial="siswa-riwayat"]',
      fallbackSelector: '[data-assistant-target="nilai"]',
      title: 'Pengumpulan Jawaban & Pengecekan Riwayat Nilai',
      shortTitle: 'Selesai Ujian',
      icon: 'task_alt',
      subtitle: 'Konfirmasi penyelesaian ujian, leaderboard, dan rekap nilai',
      points: [
        'Langkah 1: Pada nomor soal terakhir di lembar ujian, pastikan seluruh nomor di panel navigator soal sudah berwarna hijau agar tidak ada butir soal yang terlewat.',
        'Langkah 2: Di bagian bawah nomor soal terakhir, klik tombol **Selesai Ujian** dan beri konfirmasi pada kotak dialog pengumpulan jawaban yang muncul untuk mengakhiri sesi.',
        'Langkah 3: Setelah pengawas menutup sesi, buka menu tab **Riwayat Nilai** untuk melihat rekap nilai yang telah diumumkan dan buka menu tab **Papan Peringkat** untuk melihat leaderboard peringkat.',
        'Langkah 4: Buka menu tab **Profil Saya**, klik untuk memverifikasi kesesuaian foto profil dan identitas akun peserta Anda.'
      ],
      tip: 'Sebelum meninggalkan ruangan ujian, pastikan pengawas ruang telah mengonfirmasi bahwa status ujian Anda sudah "Selesai".'
    }
  ],

  super_admin: [
    {
      id: 'superadmin-sekolah',
      targetId: 'superadmin-sekolah',
      badgeTargetIds: ['superadmin-sekolah'],
      targetSelector: '[data-tutorial="superadmin-sekolah"]',
      fallbackSelector: '[data-assistant-target="sekolah"]',
      title: 'Manajemen Sekolah & NPSN',
      shortTitle: 'Sekolah & NPSN',
      icon: 'apartment',
      subtitle: 'Pendaftaran sekolah, registrasi NPSN, dan cascade deletion',
      points: [
        'Langkah 1: Buka navigasi superadmin > tab **Sekolah** untuk melihat daftar entitas sekolah terdaftar di sistem.',
        'Langkah 2: Di sudut atas tabel sekolah, klik tombol **+ Tambah Sekolah** untuk membuka formulir registrasi entitas sekolah baru.',
        'Langkah 3: Pada formulir registrasi, masukkan nomor **NPSN** resmi dan nama instansi sekolah, lalu atur kuota peserta serta status operasionalnya hingga tersimpan.',
        'Langkah 4: Pada tabel sekolah, gunakan tombol hapus dengan konfirmasi keamanan ganda jika memerlukan **Cascade Deletion** untuk menghapus sekolah sekaligus membersihkan seluruh relasi siswa, guru, jadwal, dan nilai dari database.'
      ],
      tip: 'Fitur Cascade Deletion bersifat permanen dan otomatis membersihkan orphan data di seluruh relasi database.'
    },
    {
      id: 'superadmin-admin',
      targetId: 'superadmin-admin',
      badgeTargetIds: ['superadmin-admin'],
      targetSelector: '[data-tutorial="superadmin-admin"]',
      fallbackSelector: '[data-assistant-target="admin"]',
      title: 'Manajemen Akun Administrator Sekolah',
      shortTitle: 'Akun Admin',
      icon: 'admin_panel_settings',
      subtitle: 'Pengelolaan akun, penugasan sekolah, dan reset kredensial admin',
      points: [
        'Langkah 1: Buka navigasi superadmin, lalu klik tab **Admin** untuk membuka dan mengelola daftar akun administrator sekolah.',
        'Langkah 2: Pada tabel admin sekolah, klik tombol tambah admin baru atau klik tombol reset kredensial untuk memulihkan akses login administrator yang mengalami kendala.',
        'Langkah 3: Buka navigasi utama > tab **Akun**, klik tombol simpan profil untuk memperbarui data identitas dan kredensial autentikasi superadmin secara mandiri dan aman.'
      ],
      tip: 'Pastikan setiap administrator sekolah memiliki username unik dan password berstandar keamanan tinggi.'
    },
    {
      id: 'superadmin-analytics',
      targetId: 'superadmin-analytics',
      badgeTargetIds: ['superadmin-analytics'],
      targetSelector: '[data-tutorial="superadmin-analytics"]',
      fallbackSelector: '[data-assistant-target="analytics"]',
      title: 'Pemantauan Analytics Global Lintas Sekolah',
      shortTitle: 'Analytics Global',
      icon: 'insights',
      subtitle: 'Monitoring beban server, concurrent session, dan total peserta aktif',
      points: [
        'Langkah 1: Buka navigasi utama superadmin, lalu klik tab **Statistik** (Analytics) untuk mengakses dasbor performa dan pemantauan beban server.',
        'Langkah 2: Pada panel grafik analytics, periksa grafik kurva **concurrent sessions** ujian dan pemakaian resource server untuk mendeteksi lonjakan trafik pengerjaan serentak lintas instansi.',
        'Langkah 3: Pada kartu statistik metrik, pantau total peserta dan sekolah aktif untuk memastikan kapasitas database server Supabase tetap optimal.'
      ],
      tip: 'Pantau grafik puncak ujian di pagi hari untuk memastikan kapasitas koneksi Supabase tetap optimal.'
    },
    {
      id: 'superadmin-pengumuman',
      targetId: 'superadmin-pengumuman',
      badgeTargetIds: ['superadmin-pengumuman'],
      targetSelector: '[data-tutorial="superadmin-pengumuman"]',
      fallbackSelector: '[data-assistant-target="pengumuman"]',
      title: 'Siaran Pengumuman & Audit Log Global',
      shortTitle: 'Pengumuman & Log',
      icon: 'history',
      subtitle: 'Broadcast informasi, audit trail sistem, dan pembersihan otomatis hari Minggu',
      points: [
        'Langkah 1: Buka navigasi superadmin > tab **Informasi** (Pengumuman), klik tombol buat siaran untuk menyiarkan pesan broadcast darurat atau pengumuman resmi ke seluruh sekolah.',
        'Langkah 2: Buka tab **Log**, telusuri tabel audit trail untuk memeriksa riwayat aktivitas sistem dan jejak operasi krusial seluruh pengguna.',
        'Langkah 3: Pada tab **Log**, verifikasi mekanisme pembersihan otomatis berkala setiap **hari Minggu** (**auto-purge**) yang secara terjadwal membersihkan log basi demi menjaga performa database.'
      ],
      tip: 'Audit log hari Minggu otomatis dipangkas untuk mencegah pembengkakan ukuran tabel tanpa menghapus histori penting.'
    }
  ],

  exam_room: [
    {
      id: 'exam-timer',
      targetId: 'exam-timer',
      badgeTargetIds: ['exam-timer'],
      targetSelector: '[data-tutorial="exam-timer"]',
      fallbackSelector: '.font-mono.font-bold.tracking-wider',
      title: 'Server Time Guard Real-Time',
      shortTitle: 'Server Time Guard',
      icon: 'timer',
      subtitle: 'Sinkronisasi waktu presisi berbasis server anti-manipulasi waktu lokal',
      points: [
        'Langkah 1: Perhatikan penunjuk waktu di bilah atas yang selalu tersinkronisasi presisi dengan jam server pusat.',
        'Langkah 2: Menjelang waktu habis (kurang dari 5 menit & 1 menit), sistem otomatis memberikan peringatan visual kontras.',
        'Langkah 3: Saat waktu habis tepat 00:00:00, seluruh jawaban Anda otomatis terkumpul aman ke server tanpa ada yang hilang.'
      ],
      tip: 'Waktu dikendalikan server, sehingga perubahan jam manual di perangkat tidak mempengaruhi sisa waktu ujian.'
    },
    {
      id: 'exam-font-size',
      targetId: 'exam-font-size',
      badgeTargetIds: ['exam-font-size'],
      targetSelector: '[data-tutorial="exam-font-size"]',
      fallbackSelector: '[aria-label*="Ukuran teks"]',
      title: 'Pengatur Ukuran Teks Soal (A- / A / A+)',
      shortTitle: 'Ukuran Teks',
      icon: 'format_size',
      subtitle: 'Kenyamanan visual membaca wacana stimulus dan lembar butir soal',
      points: [
        'Langkah 1: Klik tombol **A-** untuk mengecilkan ukuran teks lembar soal saat membaca soal dengan tabel lebar.',
        'Langkah 2: Klik tombol **A** untuk ukuran standar yang seimbang untuk laptop maupun tablet.',
        'Langkah 3: Klik tombol **A+** untuk memperbesar huruf agar stimulus narasi teks panjang lebih mudah dibaca.'
      ],
      tip: 'Preferensi ukuran font Anda otomatis disimpan di peramban untuk kenyamanan sesi ujian berikutnya.'
    },
    {
      id: 'exam-palette',
      targetId: 'exam-palette',
      badgeTargetIds: ['exam-palette'],
      targetSelector: '[data-tutorial="exam-palette"]',
      fallbackSelector: 'aside, [aria-label*="Palet"], [aria-label*="Daftar Soal"]',
      title: 'Panel Navigasi & Palet Nomor Soal',
      shortTitle: 'Palet Soal',
      icon: 'grid_view',
      subtitle: 'Lompat ke nomor soal mana pun dan pantau status jawaban secara visual',
      points: [
        'Langkah 1: Klik nomor pada kotak palet untuk langsung melompat ke butir soal yang diinginkan.',
        'Langkah 2: Perhatikan kode warna kotak palet: **Abu-abu** (belum dijawab), **Hijau** (sudah dijawab), dan **Kuning** (ragu-ragu).',
        'Langkah 3: Gunakan filter di atas palet untuk menampilkan hanya soal yang belum dijawab atau yang masih bertanda ragu-ragu.'
      ],
      tip: 'Pada perangkat ponsel, buka palet dengan menekan tombol **Palet** pada bilah bawah layar.'
    },
    {
      id: 'exam-bottom-bar',
      targetId: 'exam-bottom-bar',
      badgeTargetIds: ['exam-bottom-bar'],
      targetSelector: '[data-tutorial="exam-bottom-bar"]',
      fallbackSelector: '.fixed.bottom-0',
      title: 'Bilah Aksi Bawah & Tombol Ragu-ragu',
      shortTitle: 'Bilah Aksi',
      icon: 'smart_button',
      subtitle: 'Navigasi soal sebelumnya/berikutnya dan tandai butir yang belum yakin',
      points: [
        'Langkah 1: Klik tombol **Sebelumnya** / **Prev** untuk kembali ke butir soal terdahulu.',
        'Langkah 2: Klik tombol **Ragu-ragu** untuk memberi tanda kuning pada nomor yang ingin Anda tinjau ulang nanti.',
        'Langkah 3: Klik tombol **Berikutnya** / **Next** untuk maju ke soal selanjutnya (jawaban Anda otomatis tersimpan).'
      ],
      tip: 'Jawaban ragu-ragu tetap dinilai oleh sistem jika waktu habis sebelum Anda sempat mengubahnya.'
    },
    {
      id: 'exam-selesai',
      targetId: 'exam-selesai',
      badgeTargetIds: ['exam-selesai', 'exam-selesai-next'],
      targetSelector: '[data-tutorial="exam-selesai"], [data-tutorial="exam-selesai-next"]',
      fallbackSelector: '[aria-label="Kumpulkan Ujian"], [data-tutorial="exam-bottom-bar"]',
      title: 'Pengumpulan Jawaban & Selesai Ujian',
      shortTitle: 'Selesai Ujian',
      icon: 'task_alt',
      subtitle: 'Konfirmasi penyelesaian seluruh soal sebelum sesi ditutup',
      points: [
        'Langkah 1: Pada nomor soal terakhir atau di bilah navigasi, klik tombol hijau **Selesai** untuk memicu dialog pengumpulan.',
        'Langkah 2: Periksa ringkasan jawaban pada dialog konfirmasi untuk memastikan tidak ada nomor soal yang terlewat atau masih ragu.',
        'Langkah 3: Centang persetujuan dan klik **Ya, Kumpulkan Jawaban** untuk mengakhiri sesi dan mengirim rekaman nilai ke server.'
      ],
      tip: 'Setelah mengumpulkan jawaban, tunggu instruksi pengawas ruang sebelum menutup tab peramban.'
    }
  ]
};

// Helper to format bold text chips
const renderFormattedText = (text) => {
  if (typeof text !== 'string') return text;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4 && part.slice(2, -2).trim().length > 0) {
      return (
        <strong
          key={i}
          className="font-extrabold text-slate-900 dark:text-white bg-slate-200/80 dark:bg-slate-700/80 px-1.5 py-0.5 rounded text-[11px] sm:text-xs mx-0.5 inline-block max-w-full break-words align-baseline shadow-xs"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

export const sanitizeRole = (role) => {
  if (!role || typeof role !== 'string') return 'admin';
  const clean = role.trim().toLowerCase();
  if (clean === 'superadmin') return 'super_admin';
  if (clean === 'exam' || clean === 'examroom' || clean === 'ujian') return 'exam_room';
  return TUTORIAL_DATA[clean] ? clean : 'admin';
};

// ============================================================================
// PROGRESSION & LOCAL STORAGE MANAGEMENT (R3 & R4)
// ============================================================================

export function getTutorialProgress(role) {
  const cleanRole = sanitizeRole(role);
  try {
    const raw = localStorage.getItem(`nexa_tutorial_progress_${cleanRole}`);
    if (!raw) {
      return { completedTopics: [], currentTopicIndex: 0, isFinished: false };
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'number') {
      return {
        completedTopics: Array.from({ length: parsed }, (_, i) => i),
        currentTopicIndex: parsed,
        isFinished: false
      };
    }
    return {
      completedTopics: Array.isArray(parsed?.completedTopics) ? parsed.completedTopics : [],
      currentTopicIndex: typeof parsed?.currentTopicIndex === 'number' ? parsed.currentTopicIndex : 0,
      isFinished: Boolean(parsed?.isFinished)
    };
  } catch (e) {
    return { completedTopics: [], currentTopicIndex: 0, isFinished: false };
  }
}

export function saveTutorialProgress(role, data) {
  const cleanRole = sanitizeRole(role);
  try {
    const key = `nexa_tutorial_progress_${cleanRole}`;
    const payload = {
      ...data,
      lastUpdated: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(payload));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('nexa-tutorial-progress-changed', {
          detail: { role: cleanRole, progress: payload }
        })
      );
    }
  } catch (e) {
    console.error('Failed to save tutorial progress:', e);
  }
}

export function resetTutorialProgress(role) {
  const cleanRole = sanitizeRole(role);
  try {
    localStorage.removeItem(`nexa_tutorial_progress_${cleanRole}`);
    localStorage.removeItem(`nexa_tutorial_shown_${cleanRole}`);
    // Clear user-specific seen keys if any (collect keys first to avoid mutation skipping)
    const prefix = 'nexa_tutorial_seen_';
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === `nexa_tutorial_shown_${cleanRole}` || (k.startsWith(prefix) && k.endsWith(`_${cleanRole}`)))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('nexa-tutorial-progress-changed', {
          detail: {
            role: cleanRole,
            progress: { completedTopics: [], currentTopicIndex: 0, isFinished: false }
          }
        })
      );
    }
  } catch (e) {
    console.error('Failed to reset tutorial progress:', e);
  }
}

export function getActiveUnlockedTopic(role) {
  const cleanRole = sanitizeRole(role);
  const steps = TUTORIAL_DATA[cleanRole] || [];
  const progress = getTutorialProgress(cleanRole);
  if (progress.isFinished) return null;

  // Find the first uncompleted topic
  for (let i = 0; i < steps.length; i++) {
    if (!progress.completedTopics.includes(i)) {
      return { ...steps[i], stepIndex: i };
    }
  }
  return null;
}

// Find the first actually visible element from a list of CSS selectors
export function findVisibleElement(candidateSelectors = []) {
  if (typeof document === 'undefined') return null;
  for (const selector of candidateSelectors) {
    if (!selector) continue;
    try {
      const elements = Array.from(document.querySelectorAll(selector));
      for (const el of elements) {
        if (!el || typeof el.getBoundingClientRect !== 'function') continue;
        const rect = el.getBoundingClientRect();
        // Check if element has non-zero visible dimensions
        if (rect.width > 2 && rect.height > 2) {
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
            return { el, rect };
          }
        }
      }
    } catch (e) {
      // Continue to next selector if syntax error
    }
  }
  return null;
}

// ============================================================================
// PROGRESSIVE DISCLOSURE "BARU" BADGE COMPONENT (R3)
// ============================================================================

export const TutorialBadge = ({
  role = 'admin',
  targetId,
  className = '',
  dotOnly = false,
  tooltipPosition = 'top'
}) => {
  const [badgeInfo, setBadgeInfo] = useState(null);

  const checkBadge = useCallback(() => {
    const cleanRole = sanitizeRole(role);
    const activeTopic = getActiveUnlockedTopic(cleanRole);
    if (!activeTopic) {
      setBadgeInfo(null);
      return;
    }
    const targetIds = Array.isArray(targetId)
      ? targetId
      : typeof targetId === 'string'
      ? targetId.split(/[\s,]+/).filter(Boolean)
      : [];

    const badgeList = Array.isArray(activeTopic.badgeTargetIds)
      ? activeTopic.badgeTargetIds
      : [activeTopic.targetId, activeTopic.id].filter(Boolean);

    const matches = targetIds.some(
      (id) => badgeList.includes(id) || activeTopic.targetId === id || activeTopic.id === id
    );

    if (matches) {
      setBadgeInfo({
        title: activeTopic.title,
        subtitle: activeTopic.subtitle || activeTopic.shortTitle
      });
    } else {
      setBadgeInfo(null);
    }
  }, [role, targetId]);

  useEffect(() => {
    checkBadge();
    const handleProgressChange = (e) => {
      if (!e?.detail?.role || sanitizeRole(e.detail.role) === sanitizeRole(role)) {
        checkBadge();
      }
    };
    window.addEventListener('nexa-tutorial-progress-changed', handleProgressChange);
    window.addEventListener('storage', checkBadge);
    return () => {
      window.removeEventListener('nexa-tutorial-progress-changed', handleProgressChange);
      window.removeEventListener('storage', checkBadge);
    };
  }, [checkBadge, role]);

  if (!badgeInfo) return null;

  if (dotOnly) {
    return (
      <span
        className={`group/badge relative inline-flex items-center justify-center shrink-0 ${className}`}
        title={`Panduan Baru: ${badgeInfo.title}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-sm"></span>
        </span>
        {/* Floating tooltip on hover */}
        <span
          className={`pointer-events-none absolute left-1/2 -translate-x-1/2 ${
            tooltipPosition === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'
          } hidden group-hover/badge:flex z-50 whitespace-nowrap rounded-xl bg-slate-900/95 dark:bg-slate-800/95 px-3 py-1.5 text-[11px] font-semibold text-white shadow-xl border border-slate-700/50 backdrop-blur-sm`}
        >
          Panduan: {badgeInfo.title}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`group/badge relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0 ${className}`}
      title={`Panduan Baru: ${badgeInfo.title}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
      </span>
      <span>Baru</span>

      {/* Floating tooltip on hover */}
      <span
        className={`pointer-events-none absolute left-1/2 -translate-x-1/2 ${
          tooltipPosition === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'
        } hidden group-hover/badge:flex z-50 whitespace-nowrap rounded-xl bg-slate-900/95 dark:bg-slate-800/95 px-3 py-1.5 text-[11px] font-semibold text-white shadow-xl border border-slate-700/50 backdrop-blur-sm`}
      >
        Panduan: {badgeInfo.title}
      </span>
    </span>
  );
};

// ============================================================================
// MAIN INTERACTIVE WALK-THROUGH ENGINE (R1 & R2)
// ============================================================================

// const TutorialModal = ({ isOpen, initialRole = 'admin', onClose }) => {
const TutorialModal = ({
  isOpen,
  initialRole = 'admin',
  onClose,
  onRestart
}) => {
  const safeOnClose = typeof onClose === 'function' ? onClose : () => {};
  const activeRole = sanitizeRole(initialRole);
  const steps = TUTORIAL_DATA[activeRole] || TUTORIAL_DATA.admin;
  const currentRoleTheme = ROLE_THEMES[activeRole] || ROLE_THEMES.admin;
  const uniqueId = useId();
  const maskId = `spotlight-mask-${activeRole}-${uniqueId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [popoverCoords, setPopoverCoords] = useState(() => {
    if (typeof window !== 'undefined') {
      const w = window.innerWidth || 1024;
      const h = window.innerHeight || 768;
      const pw = w < 640 ? w - 32 : 420;
      const ph = 340;
      return {
        left: Math.max(16, (w - pw) / 2),
        top: Math.max(16, (h - ph) / 2),
        isMobile: w < 640
      };
    }
    return null;
  });
  const [arrowSide, setArrowSide] = useState('top');
  const popoverRef = useRef(null);

  // Sync initial step with saved progress when opened
  useEffect(() => {
    if (isOpen) {
      const progress = getTutorialProgress(activeRole);
      const startStep = (!progress.isFinished && typeof progress.currentTopicIndex === 'number' && progress.currentTopicIndex < steps.length)
        ? progress.currentTopicIndex
        : 0;
      setCurrentStep(startStep);
    }
  }, [isOpen, activeRole, steps.length]);

  const safeCurrentStep = Math.min(Math.max(0, currentStep), steps.length - 1);
  const currentStepData = steps[safeCurrentStep] || steps[0];

  // Measure and position spotlight overlay and popover with smart collision handling
  const measureTarget = useCallback(() => {
    if (!isOpen || !currentStepData) return;

    const selectors = [
      `[data-tutorial="${currentStepData.targetId}"]`,
      `[data-tutorial~="${currentStepData.targetId}"]`,
      currentStepData.targetSelector,
      currentStepData.fallbackSelector
    ].filter(Boolean);

    const found = findVisibleElement(selectors);

    const popoverEl = popoverRef.current;
    const popoverWidth = popoverEl ? popoverEl.offsetWidth : 420;
    const popoverHeight = popoverEl ? popoverEl.offsetHeight : 340;
    const margin = 16;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (!found) {
      setTargetRect(null);
      // Gracefully center popover in viewport when element not rendered/visible
      setPopoverCoords({
        left: Math.max(margin, (viewportWidth - popoverWidth) / 2),
        top: Math.max(margin, (viewportHeight - popoverHeight) / 2),
        isMobile: viewportWidth < 640
      });
      setArrowSide('none');
      return;
    }

    const { rect } = found;
    const padding = 8;
    const computedRect = {
      x: rect.left - padding,
      y: rect.top - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      rawTop: rect.top,
      rawBottom: rect.bottom,
      rawLeft: rect.left,
      rawRight: rect.right
    };
    setTargetRect(computedRect);

    // Mobile layout: collision avoidance - do NOT cover bottom bar if element is in bottom half
    if (viewportWidth < 640) {
      const targetInBottomHalf = computedRect.y > viewportHeight / 2;
      const top = targetInBottomHalf
        ? margin
        : Math.max(margin, viewportHeight - popoverHeight - margin);
      setPopoverCoords({
        left: margin,
        top,
        isMobile: true
      });
      setArrowSide('none');
      return;
    }

    const spaceBottom = viewportHeight - (computedRect.y + computedRect.height + margin);
    const spaceTop = computedRect.y - margin;
    const spaceRight = viewportWidth - (computedRect.x + computedRect.width + margin);
    const spaceLeft = computedRect.x - margin;

    let chosenSide = 'bottom';
    let top = 0;
    let left = 0;

    // Smart priority: if target is in a left sidebar, prefer right side
    if (computedRect.x < 320 && spaceRight >= popoverWidth + 10) {
      chosenSide = 'right';
      left = computedRect.x + computedRect.width + 12;
      top = computedRect.y + computedRect.height / 2 - popoverHeight / 2;
    } else if (computedRect.x + computedRect.width > viewportWidth - 340 && spaceLeft >= popoverWidth + 10) {
      // If target is in a right palette/sidebar, prefer left side
      chosenSide = 'left';
      left = computedRect.x - popoverWidth - 12;
      top = computedRect.y + computedRect.height / 2 - popoverHeight / 2;
    } else if (spaceBottom >= popoverHeight + 10) {
      chosenSide = 'bottom';
      top = computedRect.y + computedRect.height + 12;
      left = computedRect.x + computedRect.width / 2 - popoverWidth / 2;
    } else if (spaceTop >= popoverHeight + 10) {
      chosenSide = 'top';
      top = computedRect.y - popoverHeight - 12;
      left = computedRect.x + computedRect.width / 2 - popoverWidth / 2;
    } else if (spaceRight >= popoverWidth + 10) {
      chosenSide = 'right';
      left = computedRect.x + computedRect.width + 12;
      top = computedRect.y + computedRect.height / 2 - popoverHeight / 2;
    } else if (spaceLeft >= popoverWidth + 10) {
      chosenSide = 'left';
      left = computedRect.x - popoverWidth - 12;
      top = computedRect.y + computedRect.height / 2 - popoverHeight / 2;
    } else {
      chosenSide = 'center';
      top = Math.max(margin, (viewportHeight - popoverHeight) / 2);
      left = Math.max(margin, (viewportWidth - popoverWidth) / 2);
    }

    // Viewport clamping
    left = Math.max(margin, Math.min(viewportWidth - popoverWidth - margin, left));
    top = Math.max(margin, Math.min(viewportHeight - popoverHeight - margin, top));

    setPopoverCoords({ top, left, isMobile: false });
    setArrowSide(chosenSide);
  }, [isOpen, currentStepData]);

  // Auto-scroll target into view and attach dynamic listeners throttled via requestAnimationFrame
  useEffect(() => {
    if (!isOpen || !currentStepData) return;

    const selectors = [
      `[data-tutorial="${currentStepData.targetId}"]`,
      `[data-tutorial~="${currentStepData.targetId}"]`,
      currentStepData.targetSelector,
      currentStepData.fallbackSelector
    ].filter(Boolean);

    const found = findVisibleElement(selectors);
    if (found?.el) {
      try {
        found.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      } catch (e) {
        found.el.scrollIntoView();
      }
    }

    measureTarget();
    const timer1 = setTimeout(measureTarget, 100);
    const timer2 = setTimeout(measureTarget, 300);
    const timer3 = setTimeout(measureTarget, 550);

    let rafId = null;
    const handleScrollOrResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        measureTarget();
      });
    };

    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
    };
  }, [isOpen, currentStepData, measureTarget]);

  // Accessibility focus management: set focus into dialog on open or step change
  useEffect(() => {
    if (isOpen && popoverRef.current) {
      const focusable = popoverRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        // Focus the primary forward action button
        const targetBtn = focusable[focusable.length - 1];
        if (targetBtn && typeof targetBtn.focus === 'function') {
          targetBtn.focus();
        }
      } else if (typeof popoverRef.current.focus === 'function') {
        popoverRef.current.focus();
      }
    }
  }, [isOpen, safeCurrentStep]);

  // Keyboard navigation & accessibility focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName) || e.target?.isContentEditable) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        safeOnClose();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevStep();
      } else if (e.key === 'Tab') {
        const popoverEl = popoverRef.current;
        if (!popoverEl) return;
        const focusable = popoverEl.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!popoverEl.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, safeCurrentStep, steps.length, activeRole]);

  if (!isOpen) return null;

  // Step advancement logic
  const handleNextStep = () => {
    const progress = getTutorialProgress(activeRole);
    const newCompleted = Array.from(new Set([...progress.completedTopics, safeCurrentStep]));
    const nextIdx = safeCurrentStep + 1;

    if (nextIdx >= steps.length) {
      // Completed all steps in this walk-through
      saveTutorialProgress(activeRole, {
        completedTopics: newCompleted,
        currentTopicIndex: safeCurrentStep,
        isFinished: true
      });
      safeOnClose();
    } else {
      saveTutorialProgress(activeRole, {
        completedTopics: newCompleted,
        currentTopicIndex: nextIdx,
        isFinished: false
      });
      setCurrentStep(nextIdx);
    }
  };

  const handlePrevStep = () => {
    if (safeCurrentStep > 0) {
      const prevIdx = safeCurrentStep - 1;
      setCurrentStep(prevIdx);
      const progress = getTutorialProgress(activeRole);
      saveTutorialProgress(activeRole, {
        ...progress,
        currentTopicIndex: prevIdx
      });
    }
  };

  const handleJumpToStep = (dotIdx) => {
    const clamped = Math.min(Math.max(0, dotIdx), steps.length - 1);
    setCurrentStep(clamped);
    const progress = getTutorialProgress(activeRole);
    saveTutorialProgress(activeRole, {
      ...progress,
      currentTopicIndex: clamped
    });
  };

  const handleSkip = () => {
    const progress = getTutorialProgress(activeRole);
    const newCompleted = Array.from(new Set([...progress.completedTopics, safeCurrentStep]));
    saveTutorialProgress(activeRole, {
      ...progress,
      completedTopics: newCompleted,
      isFinished: true
    });
    safeOnClose();
  };

  const handleRestart = () => {
    resetTutorialProgress(activeRole);
    setCurrentStep(0);
    if (typeof onRestart === 'function') {
      onRestart();
    }
  };

  const handleBackdropClick = (e) => {
    if (targetRect) {
      const { clientX, clientY } = e;
      // If click landed inside cutout window, do not close modal
      if (
        clientX >= targetRect.x &&
        clientX <= targetRect.x + targetRect.width &&
        clientY >= targetRect.y &&
        clientY <= targetRect.y + targetRect.height
      ) {
        return;
      }
    }
    safeOnClose();
  };

  const progressPercent = Math.round(((safeCurrentStep + 1) / steps.length) * 100);

  return (
    <div
      className="fixed inset-0 z-[9990] select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Tutorial Interaktif"
    >
      {/* ================================================================= */}
      {/* 1. SPOTLIGHT OVERLAY WITH SVG CUTOUT (R1 & R2)                   */}
      {/* ================================================================= */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-auto transition-opacity duration-300"
        style={{ zIndex: 9991 }}
      >
        <defs>
          <mask id={maskId}>
            {/* White covers entire viewport */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black cuts out window around target element */}
            {targetRect && (
              <rect
                x={targetRect.x}
                y={targetRect.y}
                width={targetRect.width}
                height={targetRect.height}
                rx="14"
                ry="14"
                fill="black"
                style={{ transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
                className="transition-all duration-300 ease-out"
              />
            )}
          </mask>
        </defs>
        {/* Semi-transparent dark overlay */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.78)"
          mask={`url(#${maskId})`}
          onClick={handleBackdropClick}
        />
      </svg>

      {/* ================================================================= */}
      {/* 2. GLOWING FOCUS BOX AROUND TARGET ELEMENT                       */}
      {/* ================================================================= */}
      {targetRect && (
        <div
          className={`fixed rounded-2xl pointer-events-none border-2 shadow-2xl ${currentRoleTheme.borderActive}`}
          style={{
            top: targetRect.y,
            left: targetRect.x,
            width: targetRect.width,
            height: targetRect.height,
            zIndex: 9993,
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: `0 0 0 4px ${currentRoleTheme.glowColor}, 0 20px 30px -10px rgba(0, 0, 0, 0.4)`
          }}
        >
          {/* Step Number Tag Badge */}
          <div
            className={`absolute -top-3.5 -right-3.5 w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shadow-lg border-2 border-white dark:border-slate-900 ${currentRoleTheme.bgActive}`}
          >
            {safeCurrentStep + 1}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. SMART POSITIONED TOOLTIP POPOVER (R1 & R2)                     */}
      {/* ================================================================= */}
      <div
        ref={popoverRef}
        tabIndex="-1"
        style={{
          top: popoverCoords ? popoverCoords.top : '50%',
          left: popoverCoords ? popoverCoords.left : '50%',
          transform: popoverCoords ? 'none' : 'translate(-50%, -50%)',
          zIndex: 9995,
          position: 'fixed'
        }}
        className="w-[calc(100vw-32px)] sm:w-[420px] max-w-[440px] bg-white dark:bg-slate-900 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] border border-slate-200/90 dark:border-slate-800 flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden animate-scale-up outline-none transition-all duration-300 pointer-events-auto select-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* POPOVER HEADER */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${currentRoleTheme.bgActive}`}>
              <span className="material-symbols-outlined text-lg">{currentStepData.icon}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200/90 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300">
                  {currentRoleTheme.badge}
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  Langkah {safeCurrentStep + 1} dari {steps.length}
                </span>
              </div>
              <h2 className="text-sm font-black text-slate-800 dark:text-white truncate mt-0.5">
                {currentStepData.shortTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={safeOnClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Tutup (Esc)"
              aria-label="Tutup"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
          <div
            className={`h-full transition-all duration-300 ${
              activeRole === 'admin'
                ? 'bg-blue-600'
                : activeRole === 'guru'
                ? 'bg-amber-600'
                : activeRole === 'siswa'
                ? 'bg-emerald-600'
                : activeRole === 'super_admin'
                ? 'bg-purple-600'
                : 'bg-indigo-600'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* POPOVER BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3.5 custom-scrollbar text-slate-700 dark:text-slate-300 text-xs sm:text-sm select-text">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
              {currentStepData.title}
            </h3>
            {currentStepData.subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {currentStepData.subtitle}
              </p>
            )}
          </div>

          {/* Actionable points */}
          {Array.isArray(currentStepData.points) && currentStepData.points.length > 0 && (
            <div className="space-y-2 pt-1">
              {currentStepData.points.map((pt, pIdx) => {
                const stepNum = pIdx + 1;
                const cleanText = typeof pt === 'string'
                  ? pt.replace(/^Langkah\s+\d+\s*[:\u2014\u2013\-]?\s*/i, '')
                  : pt;
                return (
                  <div
                    key={pIdx}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/30 text-[11px] sm:text-xs leading-relaxed"
                  >
                    <span
                      className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-md text-[10px] font-black shrink-0 ${currentRoleTheme.bgActive}`}
                    >
                      Langkah {stepNum}
                    </span>
                    <div className="flex-1 min-w-0 pt-0.5">
                      {renderFormattedText(cleanText)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pro Tip Box */}
          {currentStepData.tip && (
            <div className={`p-3 rounded-xl border ${currentRoleTheme.cardBg} flex items-start gap-2.5 mt-2`}>
              <span className={`material-symbols-outlined text-lg shrink-0 mt-0.5 ${currentRoleTheme.textAccent}`}>
                lightbulb
              </span>
              <div className="min-w-0 flex-1">
                <span className={`text-[10px] font-black uppercase tracking-wider block mb-0.5 ${currentRoleTheme.textAccent}`}>
                  Tips Penting
                </span>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {currentStepData.tip}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* POPOVER FOOTER */}
        <div className="p-3 sm:p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSkip}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Lewati
            </button>
            <button
              type="button"
              onClick={handleRestart}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden sm:flex items-center gap-1"
              title="Mulai Dari Awal"
            >
              <span className="material-symbols-outlined text-xs">restart_alt</span>
              <span>Awal</span>
            </button>
          </div>

          {/* Step navigation dots */}
          <div className="flex items-center gap-1">
            {steps.map((_, dotIdx) => (
              <button
                key={dotIdx}
                type="button"
                onClick={() => handleJumpToStep(dotIdx)}
                aria-label={`Ke langkah ${dotIdx + 1}`}
                className={`w-2 h-2 rounded-full transition-all ${
                  safeCurrentStep === dotIdx
                    ? `w-5 ${currentRoleTheme.bgActive}`
                    : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevStep}
              disabled={safeCurrentStep === 0}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Sebelumnya"
            >
              <span className="material-symbols-outlined text-sm align-middle">chevron_left</span>
            </button>

            {safeCurrentStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className={`px-3.5 sm:px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-all ${currentRoleTheme.btnPrimary}`}
                aria-label="Lanjut"
              >
                <span>Lanjut</span>
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-3.5 sm:px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-sm transition-all"
                aria-label="Selesai"
              >
                <span className="material-symbols-outlined text-sm">check</span>
                <span>Selesai</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialModal;
