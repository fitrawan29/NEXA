-- ============================================================================
-- MIGRASI SKEMA: MATA PELAJARAN TERPADU & SOAL KOLABORATIF MULTI-GURU (IPA / IPS)
-- ============================================================================

-- 1. Penambahan Kolom pada Tabel mata_pelajaran
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='mata_pelajaran' AND column_name='is_terpadu') THEN
        ALTER TABLE public.mata_pelajaran ADD COLUMN is_terpadu BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='mata_pelajaran' AND column_name='sub_mapel_list') THEN
        ALTER TABLE public.mata_pelajaran ADD COLUMN sub_mapel_list JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 2. Penambahan Kolom pada Tabel soal_ujian
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='soal_ujian' AND column_name='sub_mapel') THEN
        ALTER TABLE public.soal_ujian ADD COLUMN sub_mapel VARCHAR(50) DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='soal_ujian' AND column_name='id_guru_pembuat') THEN
        ALTER TABLE public.soal_ujian ADD COLUMN id_guru_pembuat VARCHAR(50) DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='soal_ujian' AND column_name='nama_guru_pembuat') THEN
        ALTER TABLE public.soal_ujian ADD COLUMN nama_guru_pembuat VARCHAR(100) DEFAULT NULL;
    END IF;
END $$;

-- 3. Indeks Performa untuk Filter Sub-Mapel
CREATE INDEX IF NOT EXISTS idx_soal_mapel_sub ON public.soal_ujian (id_mapel, sub_mapel);

-- 4. Segarkan Schema Cache PostgREST
NOTIFY pgrst, 'reload schema';
