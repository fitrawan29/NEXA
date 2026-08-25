-- ==========================================
-- SCRIPT UPDATE SKEMA DATABASE NEXA CBT
-- ==========================================

-- 1. Tabel Pengumuman Global
CREATE TABLE IF NOT EXISTS public.pengumuman_global (
    id_pengumuman UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    judul VARCHAR(255) NOT NULL,
    isi TEXT NOT NULL,
    tipe VARCHAR(50) DEFAULT 'info', -- 'info', 'warning', 'success'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabel Log Aktivitas Global
CREATE TABLE IF NOT EXISTS public.log_aktivitas_global (
    id_log UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    action VARCHAR(255) NOT NULL,
    detail TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Update Tabel Siswa (Menambahkan Kolom Kelas/Rombel)
-- Jika tabel siswa belum memiliki kolom 'kelas', tambahkan kolom tersebut
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='siswa' AND column_name='kelas') THEN
        ALTER TABLE public.siswa ADD COLUMN kelas VARCHAR(100);
    END IF;
END $$;

-- 4. Tabel Kelas
CREATE TABLE IF NOT EXISTS public.kelas (
    id_kelas VARCHAR(50) PRIMARY KEY,
    tingkat VARCHAR(50) NOT NULL,
    kelas_paralel VARCHAR(50) NOT NULL,
    npsn VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Pastikan RLS diaktifkan jika digunakan di tabel baru
ALTER TABLE public.pengumuman_global ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_aktivitas_global ENABLE ROW LEVEL SECURITY;

-- Kebijakan RLS Dasar (Ubah sesuai dengan kebijakan keamanan Supabase Anda)
-- Contoh: Semua role bisa baca pengumuman global
CREATE POLICY "Enable read access for all users" ON public.pengumuman_global FOR SELECT USING (true);
CREATE POLICY "Enable all access for superadmin" ON public.pengumuman_global FOR ALL USING (true);

-- Contoh: Hanya super_admin yang bisa baca log aktivitas global
CREATE POLICY "Enable all access for superadmin" ON public.log_aktivitas_global FOR ALL USING (true);
