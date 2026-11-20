-- ==============================================================================
-- MIGRATION: TRAFFIC GATEKEEPER (SOP 2) & GOOGLE DRIVE WEBHOOK (SOP 3)
-- Menambahkan kolom webhook Google Drive pada tabel sekolah dan indeks performa antrean
-- Jalankan skrip ini pada SQL Editor Supabase
-- ==============================================================================

-- 1. Tambah kolom webhook Google Drive pada tabel sekolah jika belum ada
ALTER TABLE public.sekolah 
ADD COLUMN IF NOT EXISTS gas_drive_webhook TEXT;

-- 2. Tambah indeks performa untuk kueri antrean gerbang masuk (Gatekeeper 50 Siswa)
CREATE INDEX IF NOT EXISTS idx_log_ujian_gatekeeper 
ON public.log_ujian (id_jadwal, status_ujian, waktu_login);

-- 3. Pastikan indeks pada id_log di tabel jawaban_siswa sudah ada
CREATE INDEX IF NOT EXISTS idx_jawaban_siswa_id_log 
ON public.jawaban_siswa (id_log);

ANALYZE public.log_ujian;
ANALYZE public.sekolah;
ANALYZE public.jawaban_siswa;
