# NEXA CBT - Computer Based Test System

Aplikasi Ujian Berbasis Komputer (Computer Based Test) modern, responsif, dan tangguh yang dibangun menggunakan React, Vite, Tailwind CSS, dan Supabase Database (PostgreSQL). Dirancang khusus untuk keandalan tinggi pada skenario ujian sekolah dengan dukungan arsitektur multi-deployment mandiri.

---

## Fitur Utama

- **Multi-Role Authentication & Access Control:** Mendukung 4 role terpisah: Super Admin, Admin Sekolah, Guru/Pembuat Soal, dan Siswa Peserta Ujian.
- **Exam Room Resilient & Anti-Cheat:**
  - Deteksi perpindahan tab/jendela (strike anticheat).
  - Ketahanan sesi siswa (kebal refresh/F5 melalui `sessionStorage`).
  - Submit ujian atomik berbasis PostgreSQL Stored Procedure (`submit_ujian_atomic`).
  - Polling rate terkendali anti-429 (aman untuk Supabase Free Tier Kong Gateway).
- **Manajemen Bank Soal & Penilaian:**
  - Pilihan ganda, pilihan ganda kompleks, benar/salah, menjodohkan, dan uraian/esai.
  - Skema penilaian fleksibel (skema sekolah default atau custom guru).
  - Pemeriksaan jawaban uraian dengan live preview rubrik penilaian.
- **Penyimpanan Media Fleksibel:** Integrasi webhook Google Drive via Google Apps Script untuk menjaga ukuran database tetap ringan (Rp 0).
- **Cetak Dokumen Terpadu:** Cetak kartu ujian, berita acara, absensi peserta, dan rekapitulasi nilai dengan kop surat kustom.

---

## Panduan Deployment & Kloning

NEXA CBT dirancang untuk dapat di-deploy ke banyak instansi (sekolah/klien) menggunakan **1 repositori GitHub tunggal (branch `main`)**:

1. **[Panduan Kloning Mandiri (Supabase & Vercel Terpisah)](./PANDUAN_KLONING_MANDIRI.md):**
   Panduan lengkap langkah demi langkah untuk membuat instansi/sekolah baru dari nol menggunakan database Supabase mandiri dan hosting Vercel mandiri.

2. **[Panduan Konfigurasi Deployment Multi-Instance](./PANDUAN_DEPLOYMENT_MULTI_INSTANCE.md):**
   Dokumentasi teknis pembagian beban multi-instance (contoh implementasi 4 instance terpisah untuk SMA 1 Tutuyan dan SMA Sampolawa).

---

## Persiapan Lokal (Development)

1. **Clone repositori:**
   ```bash
   git clone https://github.com/fitrawan29/NEXA.git
   cd NEXA
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment:**
   Salin `.env.example` menjadi `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` sesuai project database Anda.

4. **Jalankan development server:**
   ```bash
   npm run dev
   ```

5. **Build untuk produksi:**
   ```bash
   npm run build
   ```
