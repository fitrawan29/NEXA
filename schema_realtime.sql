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
