-- ==============================================================================
-- MIGRATION: OPTIMASI PERFORMA & INDEKS DATABASE NEXA CBT
-- Menambahkan composite index pada tabel-tabel utama untuk mempercepat filter
-- kueri saat ujian serentak, meniadakan Sequential Scans, dan meringankan CPU.
-- Jalankan skrip ini pada SQL Editor Supabase untuk setiap instance database.
-- ==============================================================================

-- 1. Indeks pada soal_ujian untuk filter cepat berdasarkan mapel dan sekolah (NPSN)
CREATE INDEX IF NOT EXISTS idx_soal_mapel_npsn 
ON public.soal_ujian (id_mapel, npsn);

-- 2. Indeks pada log_ujian untuk pencarian sesi siswa dan pemantauan jadwal
CREATE INDEX IF NOT EXISTS idx_log_siswa_jadwal 
ON public.log_ujian (id_siswa, id_jadwal);

-- 3. Indeks pada siswa untuk autentikasi cepat berdasarkan username & npsn
CREATE INDEX IF NOT EXISTS idx_siswa_auth 
ON public.siswa (username, npsn);

-- 4. Indeks pada jadwal untuk filter jadwal per sekolah (NPSN)
CREATE INDEX IF NOT EXISTS idx_jadwal_npsn 
ON public.jadwal (npsn);

-- 5. Indeks pada jawaban_siswa untuk pemanggilan id_log (sudah tercover tapi dipastikan ada)
CREATE INDEX IF NOT EXISTS idx_jawaban_siswa_id_log 
ON public.jawaban_siswa (id_log);

-- 6. Indeks gatekeeper antrean masuk ujian
CREATE INDEX IF NOT EXISTS idx_log_ujian_gatekeeper 
ON public.log_ujian (id_jadwal, status_ujian, waktu_login);

-- 7. Perbarui statistik query planner PostgreSQL
ANALYZE public.soal_ujian;
ANALYZE public.log_ujian;
ANALYZE public.siswa;
ANALYZE public.jadwal;
ANALYZE public.jawaban_siswa;
