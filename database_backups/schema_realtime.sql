-- Aktifkan Replica Identity Full untuk tabel yang dipantau agar payload.new/old lengkap
alter table log_ujian replica identity full;
alter table jadwal replica identity full;
alter table pengumuman replica identity full;
alter table sekolah replica identity full;
alter table admin replica identity full;

-- Buat publikasi supabase_realtime jika belum ada
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

-- Daftarkan tabel-tabel tersebut ke publikasi realtime
alter publication supabase_realtime add table log_ujian;
alter publication supabase_realtime add table jadwal;
alter publication supabase_realtime add table pengumuman;
alter publication supabase_realtime add table sekolah;
alter publication supabase_realtime add table admin;


-- Hotfix: Penambahan Foreign Keys yang hilang untuk relasi API
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'admin_npsn_fkey') THEN ALTER TABLE public.admin ADD CONSTRAINT admin_npsn_fkey FOREIGN KEY (npsn) REFERENCES public.sekolah(npsn) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'guru_mapel_id_guru_fkey') THEN ALTER TABLE public.guru_mapel ADD CONSTRAINT guru_mapel_id_guru_fkey FOREIGN KEY (id_guru) REFERENCES public.guru(id_guru) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'guru_mapel_id_mapel_fkey') THEN ALTER TABLE public.guru_mapel ADD CONSTRAINT guru_mapel_id_mapel_fkey FOREIGN KEY (id_mapel) REFERENCES public.mata_pelajaran(id_mapel) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'jadwal_id_guru_fkey') THEN ALTER TABLE public.jadwal ADD CONSTRAINT jadwal_id_guru_fkey FOREIGN KEY (id_guru) REFERENCES public.guru(id_guru) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'jadwal_id_mapel_fkey') THEN ALTER TABLE public.jadwal ADD CONSTRAINT jadwal_id_mapel_fkey FOREIGN KEY (id_mapel) REFERENCES public.mata_pelajaran(id_mapel) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'jawaban_siswa_id_soal_fkey') THEN ALTER TABLE public.jawaban_siswa ADD CONSTRAINT jawaban_siswa_id_soal_fkey FOREIGN KEY (id_soal) REFERENCES public.soal_ujian(id_soal) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'log_ujian_id_siswa_fkey') THEN ALTER TABLE public.log_ujian ADD CONSTRAINT log_ujian_id_siswa_fkey FOREIGN KEY (id_siswa) REFERENCES public.siswa(id_siswa) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'log_ujian_id_jadwal_fkey') THEN ALTER TABLE public.log_ujian ADD CONSTRAINT log_ujian_id_jadwal_fkey FOREIGN KEY (id_jadwal) REFERENCES public.jadwal(id_jadwal) ON DELETE CASCADE; END IF;
END $$;

