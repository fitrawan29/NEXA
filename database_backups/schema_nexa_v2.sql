-- Update Schema NEXA V2

-- 1. Tambah kolom status pada tabel sekolah
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='sekolah' AND column_name='status') THEN
        ALTER TABLE public.sekolah ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE';
    END IF;
END $$;

-- 2. Tambah kolom session_token pada tabel siswa
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='siswa' AND column_name='session_token') THEN
        ALTER TABLE public.siswa ADD COLUMN session_token VARCHAR(255);
    END IF;
END $$;
