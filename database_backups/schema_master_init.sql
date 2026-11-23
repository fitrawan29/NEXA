-- ==============================================================================
-- NEXA CBT: MASTER DATABASE INITIALIZATION SCHEMA
-- Script ini untuk inisialisasi instansi database Supabase baru dari nol.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CREATE TABLES

-- Tabel: sekolah
CREATE TABLE IF NOT EXISTS public.sekolah (
    npsn TEXT NOT NULL,
    nama_sekolah TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    status VARCHAR(255) DEFAULT 'ACTIVE'::character varying,
    gas_drive_webhook TEXT,
    CONSTRAINT sekolah_pkey PRIMARY KEY (npsn)
);

-- Tabel: super_admin
CREATE TABLE IF NOT EXISTS public.super_admin (
    id_super UUID NOT NULL DEFAULT uuid_generate_v4(),
    nama_lengkap TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT super_admin_pkey PRIMARY KEY (id_super),
    CONSTRAINT super_admin_username_key UNIQUE (username)
);

-- Tabel: admin
CREATE TABLE IF NOT EXISTS public.admin (
    id_admin TEXT NOT NULL,
    nama_lengkap TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    npsn TEXT,
    foto_profil TEXT,
    CONSTRAINT admin_pkey PRIMARY KEY (id_admin),
    CONSTRAINT admin_username_key UNIQUE (username)
);

-- Tabel: guru
CREATE TABLE IF NOT EXISTS public.guru (
    id_guru TEXT NOT NULL,
    nama_guru TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    npsn TEXT,
    foto TEXT,
    nip TEXT,
    role TEXT DEFAULT 'guru'::text,
    alokasi_kelas TEXT,
    nama_mapel TEXT,
    CONSTRAINT guru_pkey PRIMARY KEY (id_guru),
    CONSTRAINT guru_username_key UNIQUE (username)
);

-- Tabel: mata_pelajaran
CREATE TABLE IF NOT EXISTS public.mata_pelajaran (
    id_mapel TEXT NOT NULL,
    nama_mapel TEXT NOT NULL,
    npsn TEXT,
    agama VARCHAR(255),
    CONSTRAINT mata_pelajaran_pkey PRIMARY KEY (id_mapel)
);

-- Tabel: kelas
CREATE TABLE IF NOT EXISTS public.kelas (
    id_kelas UUID NOT NULL DEFAULT gen_random_uuid(),
    npsn TEXT NOT NULL,
    tingkat TEXT NOT NULL,
    kelas_paralel TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT kelas_pkey PRIMARY KEY (id_kelas)
);

-- Tabel: siswa
CREATE TABLE IF NOT EXISTS public.siswa (
    id_siswa TEXT NOT NULL,
    nama_lengkap TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    angkatan TEXT,
    kelas_paralel TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    npsn TEXT,
    kelas VARCHAR(255),
    session_token VARCHAR(255),
    nisn TEXT,
    foto_profil TEXT,
    ruang VARCHAR(255),
    agama VARCHAR(255),
    CONSTRAINT siswa_pkey PRIMARY KEY (id_siswa),
    CONSTRAINT siswa_username_key UNIQUE (username)
);

-- Tabel: guru_mapel
CREATE TABLE IF NOT EXISTS public.guru_mapel (
    id_guru TEXT NOT NULL,
    id_mapel TEXT NOT NULL,
    CONSTRAINT guru_mapel_pkey PRIMARY KEY (id_mapel, id_guru)
);

-- Tabel: jadwal
CREATE TABLE IF NOT EXISTS public.jadwal (
    id_jadwal TEXT NOT NULL,
    id_mapel TEXT,
    id_guru TEXT,
    waktu_mulai TIMESTAMPTZ NOT NULL,
    waktu_selesai TIMESTAMPTZ NOT NULL,
    token_aktif TEXT,
    last_update_token TIMESTAMPTZ,
    npsn TEXT,
    browser_lockdown BOOLEAN DEFAULT false,
    acak_soal BOOLEAN DEFAULT false,
    acak_opsi BOOLEAN DEFAULT false,
    durasi_menit INTEGER DEFAULT 90,
    target_kelas TEXT,
    durasi_token_menit INTEGER DEFAULT 5,
    batas_pelanggaran INTEGER DEFAULT 3,
    CONSTRAINT jadwal_pkey PRIMARY KEY (id_jadwal)
);

-- Tabel: ruang_ujian
CREATE TABLE IF NOT EXISTS public.ruang_ujian (
    id_ruang TEXT NOT NULL,
    npsn TEXT NOT NULL,
    nama_ruang VARCHAR(255) NOT NULL,
    kode_ruang VARCHAR(255),
    kapasitas INTEGER DEFAULT 30,
    keterangan TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT ruang_ujian_pkey PRIMARY KEY (id_ruang)
);

-- Tabel: soal_ujian
CREATE TABLE IF NOT EXISTS public.soal_ujian (
    id_soal TEXT NOT NULL,
    id_jadwal TEXT,
    jenis_soal TEXT,
    pertanyaan TEXT NOT NULL,
    opsi_a TEXT,
    opsi_b TEXT,
    opsi_c TEXT,
    opsi_d TEXT,
    opsi_e TEXT,
    kunci_jawaban TEXT,
    skor NUMERIC DEFAULT 0,
    npsn TEXT,
    id_mapel TEXT,
    tipe_soal TEXT,
    opsi TEXT,
    bobot INTEGER DEFAULT 1,
    gambar TEXT,
    id_narasi TEXT,
    CONSTRAINT soal_ujian_pkey PRIMARY KEY (id_soal)
);

-- Tabel: log_ujian
CREATE TABLE IF NOT EXISTS public.log_ujian (
    id_log TEXT NOT NULL,
    id_jadwal TEXT,
    id_siswa TEXT,
    waktu_login TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    status_ujian TEXT DEFAULT 'SEDANG KERJA'::text,
    nilai_auto NUMERIC DEFAULT 0,
    nilai_uraian NUMERIC DEFAULT 0,
    pelanggaran INTEGER DEFAULT 0,
    is_blocked BOOLEAN DEFAULT false,
    pelanggaran_detail JSONB DEFAULT '[]'::jsonb,
    waktu_selesai TIMESTAMPTZ,
    tanda_tangan TEXT,
    status_kehadiran TEXT DEFAULT 'BELUM_HADIR'::text,
    is_verified_kehadiran BOOLEAN DEFAULT false,
    waktu_absen TIMESTAMPTZ,
    verified_by TEXT,
    verified_at TIMESTAMPTZ,
    ruang TEXT,
    CONSTRAINT log_ujian_pkey PRIMARY KEY (id_log)
);

-- Tabel: jawaban_siswa
CREATE TABLE IF NOT EXISTS public.jawaban_siswa (
    id_jawaban TEXT NOT NULL,
    id_log TEXT,
    id_soal TEXT,
    jawaban_user TEXT,
    is_correct BOOLEAN,
    skor_diperoleh NUMERIC DEFAULT 0,
    CONSTRAINT jawaban_siswa_pkey PRIMARY KEY (id_jawaban)
);

-- Tabel: pengawas_ruang
CREATE TABLE IF NOT EXISTS public.pengawas_ruang (
    id_penugasan TEXT NOT NULL,
    npsn TEXT NOT NULL,
    id_ruang TEXT NOT NULL,
    id_guru TEXT NOT NULL,
    id_jadwal TEXT,
    peran VARCHAR(255) DEFAULT 'PENGAWAS UTAMA'::character varying,
    status_tugas VARCHAR(255) DEFAULT 'AKTIF'::character varying,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT pengawas_ruang_pkey PRIMARY KEY (id_penugasan)
);

-- Tabel: absensi_ujian
CREATE TABLE IF NOT EXISTS public.absensi_ujian (
    id_absensi TEXT NOT NULL,
    npsn TEXT NOT NULL,
    id_jadwal TEXT NOT NULL,
    id_siswa TEXT NOT NULL,
    id_ruang TEXT,
    id_log TEXT,
    tanda_tangan TEXT NOT NULL,
    waktu_absen TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    status_kehadiran VARCHAR(255) DEFAULT 'HADIR'::character varying,
    status_verifikasi VARCHAR(255) DEFAULT 'MENUNGGU'::character varying,
    verified_by TEXT,
    verified_at TIMESTAMPTZ,
    catatan_pengawas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT absensi_ujian_pkey PRIMARY KEY (id_absensi),
    CONSTRAINT absensi_ujian_jadwal_siswa_unique UNIQUE (id_jadwal, id_siswa)
);

-- Tabel: berita_acara_ujian
CREATE TABLE IF NOT EXISTS public.berita_acara_ujian (
    id_berita_acara TEXT NOT NULL,
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT berita_acara_ujian_pkey PRIMARY KEY (id_berita_acara),
    CONSTRAINT berita_acara_jadwal_ruang_unique UNIQUE (id_ruang, id_jadwal)
);

-- Tabel: audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
    id_audit TEXT NOT NULL,
    npsn TEXT,
    username TEXT,
    role TEXT,
    action TEXT,
    target TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    CONSTRAINT audit_log_pkey PRIMARY KEY (id_audit)
);

-- Tabel: audit_log_archive
CREATE TABLE IF NOT EXISTS public.audit_log_archive (
    id_archive TEXT NOT NULL,
    id_audit TEXT,
    npsn TEXT,
    username TEXT,
    role TEXT,
    action TEXT,
    target TEXT,
    created_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT audit_log_archive_pkey PRIMARY KEY (id_archive)
);

-- Tabel: pengumuman
CREATE TABLE IF NOT EXISTS public.pengumuman (
    id_pengumuman TEXT NOT NULL,
    npsn TEXT,
    judul TEXT,
    isi TEXT,
    target_role TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    CONSTRAINT pengumuman_pkey PRIMARY KEY (id_pengumuman)
);

-- Tabel: pengumuman_global
CREATE TABLE IF NOT EXISTS public.pengumuman_global (
    id_pengumuman UUID NOT NULL DEFAULT gen_random_uuid(),
    judul VARCHAR(255) NOT NULL,
    isi TEXT NOT NULL,
    tipe VARCHAR(255) DEFAULT 'info'::character varying,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT pengumuman_global_pkey PRIMARY KEY (id_pengumuman)
);

-- Tabel: log_aktivitas_global
CREATE TABLE IF NOT EXISTS public.log_aktivitas_global (
    id_log UUID NOT NULL DEFAULT gen_random_uuid(),
    username VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT log_aktivitas_global_pkey PRIMARY KEY (id_log)
);

-- 3. FOREIGN KEY CONSTRAINTS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'absensi_ujian_siswa_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.absensi_ujian ADD CONSTRAINT absensi_ujian_siswa_fkey FOREIGN KEY (id_siswa) REFERENCES public.siswa(id_siswa) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'absensi_ujian_guru_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.absensi_ujian ADD CONSTRAINT absensi_ujian_guru_fkey FOREIGN KEY (verified_by) REFERENCES public.guru(id_guru) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'absensi_ujian_jadwal_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.absensi_ujian ADD CONSTRAINT absensi_ujian_jadwal_fkey FOREIGN KEY (id_jadwal) REFERENCES public.jadwal(id_jadwal) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'absensi_ujian_npsn_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.absensi_ujian ADD CONSTRAINT absensi_ujian_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'absensi_ujian_ruang_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.absensi_ujian ADD CONSTRAINT absensi_ujian_ruang_fkey FOREIGN KEY (id_ruang) REFERENCES public.ruang_ujian(id_ruang) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'admin_npsn_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.admin ADD CONSTRAINT admin_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'audit_log_npsn_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'audit_log_archive_npsn_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.audit_log_archive ADD CONSTRAINT audit_log_archive_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'berita_acara_guru_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.berita_acara_ujian ADD CONSTRAINT berita_acara_guru_fkey FOREIGN KEY (id_guru) REFERENCES public.guru(id_guru) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'berita_acara_jadwal_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.berita_acara_ujian ADD CONSTRAINT berita_acara_jadwal_fkey FOREIGN KEY (id_jadwal) REFERENCES public.jadwal(id_jadwal) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'berita_acara_npsn_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.berita_acara_ujian ADD CONSTRAINT berita_acara_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'berita_acara_ruang_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.berita_acara_ujian ADD CONSTRAINT berita_acara_ruang_fkey FOREIGN KEY (id_ruang) REFERENCES public.ruang_ujian(id_ruang) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'guru_npsn_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.guru ADD CONSTRAINT guru_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'guru_mapel_id_guru_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.guru_mapel ADD CONSTRAINT guru_mapel_id_guru_fkey FOREIGN KEY (id_guru) REFERENCES public.guru(id_guru) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'guru_mapel_id_mapel_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.guru_mapel ADD CONSTRAINT guru_mapel_id_mapel_fkey FOREIGN KEY (id_mapel) REFERENCES public.mata_pelajaran(id_mapel) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'jadwal_npsn_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.jadwal ADD CONSTRAINT jadwal_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'jadwal_id_mapel_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.jadwal ADD CONSTRAINT jadwal_id_mapel_fkey FOREIGN KEY (id_mapel) REFERENCES public.mata_pelajaran(id_mapel) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'jadwal_id_guru_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.jadwal ADD CONSTRAINT jadwal_id_guru_fkey FOREIGN KEY (id_guru) REFERENCES public.guru(id_guru) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'jawaban_siswa_id_soal_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.jawaban_siswa ADD CONSTRAINT jawaban_siswa_id_soal_fkey FOREIGN KEY (id_soal) REFERENCES public.soal_ujian(id_soal) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'jawaban_siswa_id_log_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.jawaban_siswa ADD CONSTRAINT jawaban_siswa_id_log_fkey FOREIGN KEY (id_log) REFERENCES public.log_ujian(id_log) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'kelas_npsn_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.kelas ADD CONSTRAINT kelas_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'log_ujian_id_jadwal_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.log_ujian ADD CONSTRAINT log_ujian_id_jadwal_fkey FOREIGN KEY (id_jadwal) REFERENCES public.jadwal(id_jadwal) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'log_ujian_id_siswa_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.log_ujian ADD CONSTRAINT log_ujian_id_siswa_fkey FOREIGN KEY (id_siswa) REFERENCES public.siswa(id_siswa) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'mata_pelajaran_npsn_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.mata_pelajaran ADD CONSTRAINT mata_pelajaran_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'pengawas_ruang_npsn_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.pengawas_ruang ADD CONSTRAINT pengawas_ruang_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'pengawas_ruang_id_ruang_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.pengawas_ruang ADD CONSTRAINT pengawas_ruang_id_ruang_fkey FOREIGN KEY (id_ruang) REFERENCES public.ruang_ujian(id_ruang) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'pengawas_ruang_id_jadwal_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.pengawas_ruang ADD CONSTRAINT pengawas_ruang_id_jadwal_fkey FOREIGN KEY (id_jadwal) REFERENCES public.jadwal(id_jadwal) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'pengawas_ruang_id_guru_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.pengawas_ruang ADD CONSTRAINT pengawas_ruang_id_guru_fkey FOREIGN KEY (id_guru) REFERENCES public.guru(id_guru) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'pengumuman_npsn_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.pengumuman ADD CONSTRAINT pengumuman_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ruang_ujian_npsn_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.ruang_ujian ADD CONSTRAINT ruang_ujian_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'siswa_npsn_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.siswa ADD CONSTRAINT siswa_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'soal_ujian_npsn_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.soal_ujian ADD CONSTRAINT soal_ujian_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'soal_ujian_id_mapel_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.soal_ujian ADD CONSTRAINT soal_ujian_id_mapel_fkey FOREIGN KEY (id_mapel) REFERENCES public.mata_pelajaran(id_mapel) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'soal_ujian_id_jadwal_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.soal_ujian ADD CONSTRAINT soal_ujian_id_jadwal_fkey FOREIGN KEY (id_jadwal) REFERENCES public.jadwal(id_jadwal) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_jawaban_siswa_id_log ON public.jawaban_siswa (id_log);
CREATE INDEX IF NOT EXISTS idx_jawaban_siswa_id_soal ON public.jawaban_siswa (id_soal);
CREATE INDEX IF NOT EXISTS idx_log_ujian_gatekeeper ON public.log_ujian (id_jadwal, status_ujian, waktu_login);
CREATE INDEX IF NOT EXISTS idx_log_ujian_id_siswa ON public.log_ujian (id_siswa);
CREATE INDEX IF NOT EXISTS idx_soal_ujian_id_jadwal ON public.soal_ujian (id_jadwal);
CREATE INDEX IF NOT EXISTS idx_soal_ujian_npsn ON public.soal_ujian (npsn);
CREATE INDEX IF NOT EXISTS idx_siswa_npsn_kelas ON public.siswa (npsn, kelas);

-- 5. REPLICA IDENTITY & SUPABASE REALTIME
ALTER TABLE public.log_ujian REPLICA IDENTITY FULL;
ALTER TABLE public.jadwal REPLICA IDENTITY FULL;
ALTER TABLE public.pengumuman REPLICA IDENTITY FULL;
ALTER TABLE public.sekolah REPLICA IDENTITY FULL;
ALTER TABLE public.admin REPLICA IDENTITY FULL;
ALTER TABLE public.absensi_ujian REPLICA IDENTITY FULL;
ALTER TABLE public.pengawas_ruang REPLICA IDENTITY FULL;

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY['log_ujian', 'jadwal', 'pengumuman', 'sekolah', 'admin', 'absensi_ujian', 'pengawas_ruang'];
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    FOREACH tbl IN ARRAY tables LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        EXCEPTION
            WHEN duplicate_object THEN
                NULL;
        END;
    END LOOP;
END $$;

-- 6. STORED PROCEDURES / RPC
CREATE OR REPLACE FUNCTION public.submit_ujian_atomic(
    p_id_log VARCHAR,
    p_jawaban_list JSONB,
    p_status_ujian VARCHAR,
    p_nilai_auto NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.log_ujian WHERE id_log = p_id_log) THEN
        RAISE EXCEPTION 'Log ujian dengan ID % tidak ditemukan.', p_id_log;
    END IF;

    DELETE FROM public.jawaban_siswa WHERE id_log = p_id_log;

    IF p_jawaban_list IS NOT NULL 
       AND jsonb_typeof(p_jawaban_list) = 'array' 
       AND jsonb_array_length(p_jawaban_list) > 0 THEN
        INSERT INTO public.jawaban_siswa (
            id_jawaban,
            id_log,
            id_soal,
            jawaban_user,
            is_correct,
            skor_diperoleh
        )
        SELECT
            COALESCE(elem->>'id_jawaban', 'JWB-' || substr(md5(random()::text), 1, 9)),
            p_id_log,
            elem->>'id_soal',
            COALESCE(NULLIF(elem->>'jawaban_user', 'null'), ''),
            CASE WHEN lower(COALESCE(elem->>'is_correct', 'false')) IN ('true', 't', '1') THEN true ELSE false END,
            COALESCE(NULLIF(elem->>'skor_diperoleh', '')::NUMERIC, 0)
        FROM jsonb_array_elements(p_jawaban_list) AS elem;
    END IF;

    UPDATE public.log_ujian
    SET status_ujian = p_status_ujian,
        nilai_auto = COALESCE(p_nilai_auto, 0),
        waktu_selesai = COALESCE(waktu_selesai, timezone('utc'::text, now()))
    WHERE id_log = p_id_log;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Ujian berhasil disubmit secara atomik'
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Gagal submit jawaban secara atomik: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_ujian_atomic(VARCHAR, JSONB, VARCHAR, NUMERIC) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_sekolah_cascade(p_npsn TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_school_name TEXT;
    v_counts JSONB;
BEGIN
    SELECT nama_sekolah INTO v_school_name FROM public.sekolah WHERE npsn = p_npsn;
    IF v_school_name IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Sekolah tidak ditemukan.');
    END IF;

    DELETE FROM public.sekolah WHERE npsn = p_npsn;
    DELETE FROM public.audit_log WHERE npsn = p_npsn;
    DELETE FROM public.audit_log_archive WHERE npsn = p_npsn;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Sekolah dan seluruh data terkait berhasil dihapus.',
        'npsn', p_npsn
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_sekolah_cascade(TEXT) TO anon, authenticated, service_role;

-- 7. INITIAL SEED DATA (DEFAULT TEMPLATE)
INSERT INTO public.sekolah (npsn, nama_sekolah, status)
VALUES ('10000001', 'SMA NEGERI CONTOH', 'ACTIVE')
ON CONFLICT (npsn) DO NOTHING;

INSERT INTO public.super_admin (nama_lengkap, username, password)
VALUES ('Super Administrator', 'superadmin', 'superadmin123')
ON CONFLICT (username) DO NOTHING;

INSERT INTO public.admin (id_admin, nama_lengkap, username, password, npsn)
VALUES ('ADM-INIT-001', 'Administrator Sekolah', 'admin', 'admin123', '10000001')
ON CONFLICT (username) DO NOTHING;

-- 8. ROW LEVEL SECURITY (RLS) CONFIGURATION
-- NEXA CBT menggunakan role anon client-side secara langsung.
-- Nonaktifkan RLS untuk memastikan query client tidak terblokir:
ALTER TABLE public.sekolah DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admin DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mata_pelajaran DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kelas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.siswa DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru_mapel DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.jadwal DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ruang_ujian DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.soal_ujian DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_ujian DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.jawaban_siswa DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pengawas_ruang DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.absensi_ujian DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.berita_acara_ujian DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log_archive DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pengumuman DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pengumuman_global DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_aktivitas_global DISABLE ROW LEVEL SECURITY;
