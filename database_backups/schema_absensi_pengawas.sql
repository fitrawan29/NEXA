-- ==============================================================================
-- SKRIP MIGRASI SKEMA: MANAJEMEN RUANG, PENGAWAS, ABSENSI, & BERITA ACARA NEXA
-- ==============================================================================

-- 1. Tambah kolom ruang pada tabel siswa jika belum ada
ALTER TABLE public.siswa ADD COLUMN IF NOT EXISTS ruang VARCHAR(100);

-- 2. Tambah kolom absensi dan tanda tangan pada tabel log_ujian jika belum ada
ALTER TABLE public.log_ujian ADD COLUMN IF NOT EXISTS tanda_tangan TEXT;
ALTER TABLE public.log_ujian ADD COLUMN IF NOT EXISTS status_kehadiran TEXT DEFAULT 'BELUM_HADIR';
ALTER TABLE public.log_ujian ADD COLUMN IF NOT EXISTS is_verified_kehadiran BOOLEAN DEFAULT false;
ALTER TABLE public.log_ujian ADD COLUMN IF NOT EXISTS waktu_absen TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.log_ujian ADD COLUMN IF NOT EXISTS verified_by TEXT;
ALTER TABLE public.log_ujian ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.log_ujian ADD COLUMN IF NOT EXISTS ruang TEXT;

-- 3. Buat tabel master ruang_ujian
CREATE TABLE IF NOT EXISTS public.ruang_ujian (
    id_ruang TEXT PRIMARY KEY,
    npsn TEXT NOT NULL,
    nama_ruang VARCHAR(100) NOT NULL,
    kode_ruang VARCHAR(50),
    kapasitas INTEGER DEFAULT 30,
    keterangan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT ruang_ujian_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ruang_ujian_npsn ON public.ruang_ujian(npsn);
ALTER TABLE public.ruang_ujian DISABLE ROW LEVEL SECURITY;

-- 4. Buat tabel pengawas_ruang (relasi guru, ruang, dan jadwal)
CREATE TABLE IF NOT EXISTS public.pengawas_ruang (
    id_penugasan TEXT PRIMARY KEY,
    npsn TEXT NOT NULL,
    id_ruang TEXT NOT NULL,
    id_guru TEXT NOT NULL,
    id_jadwal TEXT,
    peran VARCHAR(50) DEFAULT 'PENGAWAS UTAMA',
    status_tugas VARCHAR(20) DEFAULT 'AKTIF',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT pengawas_ruang_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE,
    CONSTRAINT pengawas_ruang_id_ruang_fkey FOREIGN KEY (id_ruang) REFERENCES public.ruang_ujian(id_ruang) ON DELETE CASCADE,
    CONSTRAINT pengawas_ruang_id_guru_fkey FOREIGN KEY (id_guru) REFERENCES public.guru(id_guru) ON DELETE CASCADE,
    CONSTRAINT pengawas_ruang_id_jadwal_fkey FOREIGN KEY (id_jadwal) REFERENCES public.jadwal(id_jadwal) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pengawas_ruang_npsn ON public.pengawas_ruang(npsn);
CREATE INDEX IF NOT EXISTS idx_pengawas_ruang_guru ON public.pengawas_ruang(id_guru);
CREATE INDEX IF NOT EXISTS idx_pengawas_ruang_jadwal ON public.pengawas_ruang(id_jadwal);
CREATE INDEX IF NOT EXISTS idx_pengawas_ruang_ruang ON public.pengawas_ruang(id_ruang);
ALTER TABLE public.pengawas_ruang DISABLE ROW LEVEL SECURITY;

-- 5. Buat tabel absensi_ujian (menyimpan coretan tanda tangan canvas dan status verifikasi)
CREATE TABLE IF NOT EXISTS public.absensi_ujian (
    id_absensi TEXT PRIMARY KEY,
    npsn TEXT NOT NULL,
    id_jadwal TEXT NOT NULL,
    id_siswa TEXT NOT NULL,
    id_ruang TEXT,
    id_log TEXT,
    tanda_tangan TEXT NOT NULL,
    waktu_absen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status_kehadiran VARCHAR(20) DEFAULT 'HADIR',
    status_verifikasi VARCHAR(20) DEFAULT 'MENUNGGU',
    verified_by TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,
    catatan_pengawas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT absensi_ujian_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE,
    CONSTRAINT absensi_ujian_jadwal_fkey FOREIGN KEY (id_jadwal) REFERENCES public.jadwal(id_jadwal) ON DELETE CASCADE,
    CONSTRAINT absensi_ujian_siswa_fkey FOREIGN KEY (id_siswa) REFERENCES public.siswa(id_siswa) ON DELETE CASCADE,
    CONSTRAINT absensi_ujian_ruang_fkey FOREIGN KEY (id_ruang) REFERENCES public.ruang_ujian(id_ruang) ON DELETE SET NULL,
    CONSTRAINT absensi_ujian_guru_fkey FOREIGN KEY (verified_by) REFERENCES public.guru(id_guru) ON DELETE SET NULL,
    CONSTRAINT absensi_ujian_jadwal_siswa_unique UNIQUE (id_jadwal, id_siswa)
);

CREATE INDEX IF NOT EXISTS idx_absensi_ujian_npsn ON public.absensi_ujian(npsn);
CREATE INDEX IF NOT EXISTS idx_absensi_ujian_jadwal_ruang ON public.absensi_ujian(id_jadwal, id_ruang);
CREATE INDEX IF NOT EXISTS idx_absensi_ujian_siswa ON public.absensi_ujian(id_siswa);
CREATE INDEX IF NOT EXISTS idx_absensi_ujian_verifikasi ON public.absensi_ujian(status_verifikasi);
ALTER TABLE public.absensi_ujian DISABLE ROW LEVEL SECURITY;

-- 6. Buat tabel berita_acara_ujian (untuk pelaporan dan cetak dokumen)
CREATE TABLE IF NOT EXISTS public.berita_acara_ujian (
    id_berita_acara TEXT PRIMARY KEY,
    npsn TEXT NOT NULL,
    id_jadwal TEXT NOT NULL,
    id_ruang TEXT NOT NULL,
    id_guru TEXT,
    jumlah_peserta_terdaftar INTEGER DEFAULT 0,
    jumlah_peserta_hadir INTEGER DEFAULT 0,
    jumlah_peserta_absen INTEGER DEFAULT 0,
    daftar_siswa_tidak_hadir TEXT,
    catatan_pelaksanaan TEXT,
    tanda_tangan_pengawas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT berita_acara_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE,
    CONSTRAINT berita_acara_jadwal_fkey FOREIGN KEY (id_jadwal) REFERENCES public.jadwal(id_jadwal) ON DELETE CASCADE,
    CONSTRAINT berita_acara_ruang_fkey FOREIGN KEY (id_ruang) REFERENCES public.ruang_ujian(id_ruang) ON DELETE CASCADE,
    CONSTRAINT berita_acara_guru_fkey FOREIGN KEY (id_guru) REFERENCES public.guru(id_guru) ON DELETE SET NULL,
    CONSTRAINT berita_acara_jadwal_ruang_unique UNIQUE (id_jadwal, id_ruang)
);

CREATE INDEX IF NOT EXISTS idx_berita_acara_npsn ON public.berita_acara_ujian(npsn);
CREATE INDEX IF NOT EXISTS idx_berita_acara_jadwal_ruang ON public.berita_acara_ujian(id_jadwal, id_ruang);
ALTER TABLE public.berita_acara_ujian DISABLE ROW LEVEL SECURITY;

-- 7. Tambahkan ke Publikasi Supabase Realtime
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.absensi_ujian;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pengawas_ruang;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;
