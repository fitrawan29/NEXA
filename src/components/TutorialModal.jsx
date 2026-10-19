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
      title: 'Live Monitoring Real-Time & Kontrol Ujian',
      shortTitle: 'Monitoring Live',
      icon: 'monitoring',
      subtitle: 'Pengawasan live status pengerjaan dan intervensi peserta',
      points: [
        'Langkah 1: Buka sidebar kiri pada grup Operasional Ujian, lalu klik menu **Kontrol Ujian** (tab **Monitoring**) untuk memantau sesi aktif.',
        'Langkah 2: Pada bilah atas kontrol, pantau status peserta secara real-time pada kartu metrik **HUD** (**Total Peserta**, **Sedang Mengerjakan**, **Selesai**, **Terblokir**) agar kondisi ujian terpantau jelas.',
        'Langkah 3: Pada tabel peserta, jika ada siswa terkendala atau terblokir aturan 3-strike, klik tombol **Reset Sesi** atau **Buka Blokir** pada baris siswa terkait agar sesi kembali aktif.',
        'Langkah 4: Pada kotak dialog konfirmasi, klik setujui tindakan reset agar siswa dapat login kembali melanjutkan pengerjaan dengan seluruh riwayat jawaban tersimpan aman.'
      ],
      tip: 'Gunakan filter kelas atau pencarian nama/NISN pada tabel peserta untuk mempercepat pencarian siswa saat ujian massal.'
    },
    {
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
      title: 'Bank Soal & Unggah Gambar ke Google Drive',
      shortTitle: 'Bank Soal & Drive',
      icon: 'quiz',
      subtitle: 'Hierarki penyimpanan NEXA > [Nama Sekolah] > [Kelas] > [Mata Pelajaran] dengan fallback aman',
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
      title: 'Pelaksanaan Pengawasan Ruangan & Dokumentasi Live',
      shortTitle: 'Pengawasan Ruang',
      icon: 'visibility',
      subtitle: 'Presensi tanda tangan siswa, snapshot kamera ber-watermark, dan berita acara',
      points: [
        'Langkah 1: Buka bilah navigasi guru > menu **Ruang Pengawasan**, klik menu saat jadwal ujian sedang berlangsung untuk membuka dasbor pengawas.',
        'Langkah 2: Pada tabel kehadiran ruang, periksa presensi siswa bertanda tangan digital pra-ujian yang masuk otomatis ke daftar hadir ruangan.',
        'Langkah 3: Pada panel dokumentasi, klik tombol **Buka Kamera** WebRTC untuk mengambil foto ruangan live ber-watermark waktu dan nama ruang resmi.',
        'Langkah 4: Pada kanvas tanda tangan pengawas, bubuhkan tanda tangan digital Anda dan klik tombol **Simpan Berita Acara** untuk mengesahkan laporan pengawasan ujian.'
      ],
      tip: 'Jika kamera WebRTC perangkat tidak merespons, gunakan tombol upload foto fallback yang tetap menyematkan watermark otomatis.'
    },
    {
      title: 'Live Monitoring Peserta & Reset Sesi Ujian',
      shortTitle: 'Monitoring Live',
      icon: 'monitoring',
      subtitle: 'Pantau durasi sisa, progres live peserta, dan tindakan reset kendala teknis',
      points: [
        'Langkah 1: Buka bilah navigasi guru > menu **Monitoring**, klik menu untuk memantau jalannya ujian secara langsung.',
        'Langkah 2: Pada tabel peserta di layar monitoring, pantau durasi sisa dan progres live peserta secara berkala untuk mendeteksi siswa yang lambat atau berhenti mengerjakan.',
        'Langkah 3: Pada baris siswa yang mengalami kendala teknis atau koneksi terputus, klik tombol **Reset Sesi** agar siswa dapat login kembali melanjutkan sisa waktu ujian.',
        'Langkah 4: Pada kolom status peserta, pastikan indikator kembali hijau/aktif sehingga siswa dapat melanjutkan ujian tanpa kehilangan riwayat jawaban yang tersimpan.'
      ],
      tip: 'Koordinasikan dengan admin proctoring jika terjadi kendala jaringan terpusat di ruang laboratorium.'
    },
    {
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
      title: 'Manajemen Sekolah & NPSN',
      shortTitle: 'Sekolah & NPSN',
      icon: 'apartment',
      subtitle: 'Pendaftaran sekolah, registrasi NPSN, dan cascade deletion',
      points: [
        'Langkah 1: Buka navigasi utama superadmin > tab **Sekolah** untuk melihat daftar entitas sekolah terdaftar di sistem.',
        'Langkah 2: Di sudut atas tabel sekolah, klik tombol **+ Tambah Sekolah** untuk membuka formulir registrasi entitas sekolah baru.',
        'Langkah 3: Pada formulir registrasi, masukkan nomor **NPSN** resmi dan nama instansi sekolah, lalu atur kuota peserta serta status operasionalnya hingga tersimpan.',
        'Langkah 4: Pada tabel sekolah, gunakan tombol hapus dengan konfirmasi keamanan ganda jika memerlukan **Cascade Deletion** untuk menghapus sekolah sekaligus membersihkan seluruh relasi siswa, guru, jadwal, dan nilai dari database.'
      ],
      tip: 'Fitur Cascade Deletion bersifat permanen dan otomatis membersihkan orphan data di seluruh relasi database.'
    },
    {
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
      title: 'Pemantauan Analytics Global Lintas Sekolah',
      shortTitle: 'Analytics Global',
      icon: 'insights',
      subtitle: 'Monitoring beban server, concurrent session, dan total peserta aktif',
      points: [
        'Langkah 1: Buka navigasi utama superadmin, lalu klik tab **Analytics** untuk mengakses dasbor performa dan pemantauan beban server.',
        'Langkah 2: Pada panel grafik analytics, periksa grafik kurva **concurrent sessions** ujian dan pemakaian resource server untuk mendeteksi lonjakan trafik pengerjaan serentak lintas instansi.',
        'Langkah 3: Pada kartu statistik metrik, pantau total peserta dan sekolah aktif untuk memastikan kapasitas database server Supabase tetap optimal.'
      ],
      tip: 'Pantau grafik puncak ujian di pagi hari untuk memastikan kapasitas koneksi Supabase tetap optimal.'
    },
    {
      title: 'Siaran Pengumuman & Audit Log Global',
      shortTitle: 'Pengumuman & Log',
      icon: 'history',
      subtitle: 'Broadcast informasi, audit trail sistem, dan pembersihan otomatis hari Minggu',
      points: [
        'Langkah 1: Buka navigasi superadmin > tab **Pengumuman**, klik tombol buat siaran untuk menyiarkan pesan broadcast darurat atau pengumuman resmi ke seluruh sekolah maupun instansi spesifik.',
        'Langkah 2: Buka navigasi superadmin > tab **Log**, telusuri tabel audit trail untuk memeriksa riwayat aktivitas sistem dan jejak operasi krusial seluruh pengguna.',
        'Langkah 3: Pada tab **Log**, verifikasi mekanisme pembersihan otomatis berkala setiap **hari Minggu** (**auto-purge**) yang secara terjadwal membersihkan log basi demi menjaga performa database.'
      ],
      tip: 'Audit log hari Minggu otomatis dipangkas untuk mencegah pembengkakan ukuran tabel tanpa menghapus histori penting.'
    }
  ]
};

// Helper to render bold text elements as emphasized UI chips
const renderFormattedText = (text) => {
  if (typeof text !== 'string') return text;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4 && part.slice(2, -2).trim().length > 0) {
      return (
        <strong
          key={i}
          className="font-extrabold text-slate-900 dark:text-white bg-slate-200/80 dark:bg-slate-700/80 px-1.5 py-0.5 rounded text-[11px] sm:text-xs mx-0.5 inline-block max-w-full break-words align-baseline shadow-sm"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

const sanitizeRole = (role) => {
  if (!role || typeof role !== 'string') return 'admin';
  const clean = role.trim().toLowerCase();
  if (clean === 'superadmin') return 'super_admin';
  return TUTORIAL_DATA[clean] ? clean : 'admin';
};

const TutorialModal = ({ isOpen, initialRole = 'admin', onClose }) => {
  const safeOnClose = typeof onClose === 'function' ? onClose : () => {};
  const [activeRole, setActiveRole] = useState(() => sanitizeRole(initialRole));
  const [currentStep, setCurrentStep] = useState(0);
  const modalCardRef = React.useRef(null);
  const contentBodyRef = React.useRef(null);

  // Sync role when initialRole changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveRole(sanitizeRole(initialRole));
      setCurrentStep(0);
      if (modalCardRef.current) {
        modalCardRef.current.focus();
      }
    }
  }, [isOpen, initialRole]);

  // Reset scroll position to top whenever step or role changes
  useEffect(() => {
    if (contentBodyRef.current) {
      contentBodyRef.current.scrollTop = 0;
    }
  }, [currentStep, activeRole]);

  // Keyboard navigation (Esc to close, Arrow keys for steps, Tab focus trap)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        safeOnClose();
      } else if (e.key === 'ArrowRight') {
        if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName) || ['SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable) return;
        const steps = TUTORIAL_DATA[activeRole] || [];
        setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName) || ['SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable) return;
        setCurrentStep((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'Tab' && modalCardRef.current) {
        const focusable = modalCardRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          const firstElement = focusable[0];
          const lastElement = focusable[focusable.length - 1];

          // If focus is currently on the card or escaped outside, trap it inside
          if (!modalCardRef.current.contains(document.activeElement) || document.activeElement === modalCardRef.current) {
            e.preventDefault();
            if (e.shiftKey) {
              lastElement.focus();
            } else {
              firstElement.focus();
            }
            return;
          }

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement.focus();
              e.preventDefault();
            }
          }
        } else {
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeRole, onClose]);

  if (!isOpen) return null;

  const currentRoleTheme = ROLE_THEMES[activeRole] || ROLE_THEMES.admin;
  const steps = TUTORIAL_DATA[activeRole] || TUTORIAL_DATA.admin;
  const safeCurrentStep = steps.length > 0 ? Math.min(Math.max(0, currentStep), steps.length - 1) : 0;
  const currentStepData = steps[safeCurrentStep] || steps[0] || {
    title: 'Panduan Alur',
    shortTitle: 'Panduan',
    icon: 'help',
    subtitle: '',
    points: [],
    tip: ''
  };
  const progressPercent = steps.length ? Math.round(((safeCurrentStep + 1) / steps.length) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto animate-fade-in"
      onClick={safeOnClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-modal-title"
    >
      <div
        ref={modalCardRef}
        tabIndex="-1"
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden my-auto animate-scale-up outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= MODAL HEADER ================= */}
        <div className="p-3.5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 sm:gap-4 bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shrink-0 ${currentRoleTheme.bgActive}`}>
              <span className="material-symbols-outlined text-xl sm:text-2xl">{currentRoleTheme.icon}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                  Panduan Sistem CBT
                </span>
                <span className={`text-[10px] sm:text-[11px] font-bold truncate ${currentRoleTheme.textAccent}`}>
                  {currentRoleTheme.name}
                </span>
              </div>
              <h2 id="tutorial-modal-title" className="text-sm sm:text-lg font-black text-slate-800 dark:text-white leading-tight mt-0.5 truncate">
                Tutorial & Panduan Alur Kerja
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={safeOnClose}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            title="Tutup (Esc)"
            aria-label="Tutup"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>


        {/* ================= STEP INDICATOR & TIMELINE ================= */}
        <div className="px-3.5 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold text-slate-700 dark:text-slate-300 truncate mr-2">
              Langkah {safeCurrentStep + 1} dari {steps.length}: <span className={currentRoleTheme.textAccent}>{currentStepData.shortTitle}</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400 shrink-0">
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
              const isCurrent = safeCurrentStep === idx;
              const isPast = safeCurrentStep > idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentStep(idx)}
                  aria-label={`Tahap ${idx + 1}: ${st.shortTitle}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all border ${
                    isCurrent
                      ? `${currentRoleTheme.bgActive} border-transparent shadow-sm`
                      : isPast
                      ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      : 'border-transparent text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                  title={st.title}
                >
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-black/10 dark:bg-white/10" aria-hidden="true">
                    {idx + 1}
                  </span>
                  <span className="hidden sm:inline truncate max-w-[120px]">{st.shortTitle}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ================= STEP CONTENT BODY ================= */}
        <div ref={contentBodyRef} className="p-3.5 sm:p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar bg-white dark:bg-slate-900">
          {/* Step Header */}
          <div className="flex items-start gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 ${currentRoleTheme.textAccent}`}>
              <span className="material-symbols-outlined text-2xl" aria-hidden="true">{currentStepData.icon}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  Tahap {safeCurrentStep + 1}
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

          {/* Actionable Points / Step-by-Step List */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm" aria-hidden="true">format_list_numbered</span>
                Urutan Langkah Pengerjaan Fitur:
              </h4>
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                {currentStepData.points.length} Langkah
              </span>
            </div>

            <ol className="grid gap-2.5 list-none m-0 p-0" role="list">
              {currentStepData.points.map((pt, pIdx) => {
                const stepNum = pIdx + 1;
                const cleanText = typeof pt === 'string' ? pt.replace(/^Langkah\s+\d+\s*[:\u2014\u2013\-]?\s*/i, '') : pt;
                return (
                  <li
                    key={pIdx}
                    role="listitem"
                    className="flex flex-col sm:flex-row sm:items-start gap-2.5 sm:gap-3.5 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm"
                  >
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wide shadow-sm shrink-0 ${currentRoleTheme.bgActive}`}
                      >
                        Langkah {stepNum}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      {renderFormattedText(cleanText)}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Pro Tip Box */}
          {currentStepData.tip && (
            <div className={`p-4 rounded-2xl border ${currentRoleTheme.cardBg} flex items-start gap-3 mt-4`}>
              <span className={`material-symbols-outlined text-xl shrink-0 mt-0.5 ${currentRoleTheme.textAccent}`} aria-hidden="true">
                lightbulb
              </span>
              <div className="min-w-0 flex-1">
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
        <div className="p-3.5 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            disabled={safeCurrentStep === 0}
            aria-label="Tahap Sebelumnya"
            className="px-3 sm:px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 sm:gap-1.5 transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
            <span>Sebelumnya</span>
          </button>

          <div className="text-center hidden sm:block">
            <span className="text-xs font-mono text-slate-400">
              Langkah {safeCurrentStep + 1} dari {steps.length}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {safeCurrentStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
                aria-label="Tahap Selanjutnya"
                className={`px-3.5 sm:px-5 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1 sm:gap-1.5 shadow-sm transition-all ${currentRoleTheme.btnPrimary}`}
              >
                <span>Selanjutnya</span>
                <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_forward</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={safeOnClose}
                aria-label="Selesai dan Paham"
                className="px-4 sm:px-6 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 sm:gap-1.5 shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">check</span>
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
