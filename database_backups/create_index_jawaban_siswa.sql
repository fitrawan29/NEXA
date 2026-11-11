-- ==============================================================================
-- SKRIP OPTIMASI PERFORMA DATABASE NEXA CBT
-- Menambahkan indeks pada kolom id_log di tabel jawaban_siswa
-- Diterapkan pada masing-masing 4 database Supabase:
-- 1. SMA 1 Tutuyan Kelas 10
-- 2. SMA 1 Tutuyan Kelas 11
-- 3. SMA 1 Tutuyan Kelas 12
-- 4. SMA Sampolawa
-- ==============================================================================

-- Buat indeks B-Tree pada kolom id_log untuk mempercepat query submit_ujian, analisis_soal, dan get_jawaban_uraian
CREATE INDEX IF NOT EXISTS idx_jawaban_siswa_id_log ON public.jawaban_siswa (id_log);

-- Analisis tabel untuk memperbarui statistik query planner PostgreSQL
ANALYZE public.jawaban_siswa;
