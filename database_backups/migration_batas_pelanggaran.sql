-- Migration: Add batas_pelanggaran column to jadwal table
-- Milestone: M1 Mobile Security & Admin Strike Configuration
-- Idempotent migration

ALTER TABLE public.jadwal 
ADD COLUMN IF NOT EXISTS batas_pelanggaran integer DEFAULT 3;

COMMENT ON COLUMN public.jadwal.batas_pelanggaran IS 'Batas maksimal pelanggaran keamanan sebelum sesi ujian peserta dikunci dan diselesaikan otomatis (default: 3).';
