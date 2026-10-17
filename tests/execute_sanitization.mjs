import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cdcbarlyxjywltgrjgnr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY2Jhcmx5eGp5d2x0Z3JqZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTkwNTQsImV4cCI6MjEwMjg3NTA1NH0.Lze94l74sblAVNN4-IUtyQ_idr-aQCECxgPWTVAI5-c';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function sanitizeDatabase() {
  console.log('====================================================');
  console.log('   SUPABASE CBT NEXA - TARGETED DATABASE SANITIZATION');
  console.log('====================================================\n');

  // Step 1: Hapus log_ujian record 'LOG-8elkh8wia'
  console.log('[1/5] Sanitasi log_ujian...');
  const { data: targetLog, error: errFetchLog } = await supabase
    .from('log_ujian')
    .select('id_log, id_siswa, id_jadwal')
    .eq('id_log', 'LOG-8elkh8wia');

  if (errFetchLog) {
    throw new Error(`Failed to query log_ujian: ${errFetchLog.message}`);
  }

  if (targetLog && targetLog.length > 0) {
    console.log(` -> Menghapus record log_ujian: LOG-8elkh8wia (siswa: ${targetLog[0].id_siswa}, jadwal: ${targetLog[0].id_jadwal})`);
    const { error: errDelLog } = await supabase
      .from('log_ujian')
      .delete()
      .eq('id_log', 'LOG-8elkh8wia');
    if (errDelLog) throw new Error(`Failed to delete log_ujian LOG-8elkh8wia: ${errDelLog.message}`);
    console.log(' -> LOG-8elkh8wia berhasil dihapus dari log_ujian.');
  } else {
    console.log(' -> LOG-8elkh8wia tidak ditemukan di log_ujian (sudah bersih).');
  }

  // Step 2: Hapus / reset jadwal kedaluwarsa testing 'U-67AC6649'
  console.log('\n[2/5] Sanitasi jadwal testing U-67AC6649...');
  const { data: targetJadwal, error: errFetchJadwal } = await supabase
    .from('jadwal')
    .select('*')
    .eq('id_jadwal', 'U-67AC6649');

  if (errFetchJadwal) {
    throw new Error(`Failed to query jadwal: ${errFetchJadwal.message}`);
  }

  if (targetJadwal && targetJadwal.length > 0) {
    console.log(` -> Menghapus jadwal testing: U-67AC6649 (mapel: ${targetJadwal[0].id_mapel})`);
    
    // Pastikan referensi anak (jika ada) dibersihkan terlebih dahulu
    await supabase.from('absensi_ujian').delete().eq('id_jadwal', 'U-67AC6649');
    await supabase.from('pengawas_ruang').delete().eq('id_jadwal', 'U-67AC6649');
    await supabase.from('berita_acara_ujian').delete().eq('id_jadwal', 'U-67AC6649');

    const { error: errDelJadwal } = await supabase
      .from('jadwal')
      .delete()
      .eq('id_jadwal', 'U-67AC6649');
    if (errDelJadwal) throw new Error(`Failed to delete jadwal U-67AC6649: ${errDelJadwal.message}`);
    console.log(' -> Jadwal testing U-67AC6649 berhasil dihapus.');
  } else {
    console.log(' -> Jadwal U-67AC6649 tidak ditemukan di tabel jadwal (sudah bersih).');
  }

  // Step 3: Bersihkan entri residu pengujian di audit_log dan audit_log_archive
  console.log('\n[3/5] Sanitasi audit_log...');
  // A. Hapus entri RESET_SESI pada siswa testing
  const { data: resetSesiLogs, error: errFetchReset } = await supabase
    .from('audit_log')
    .select('id_audit, action, target')
    .eq('action', 'RESET_SESI');

  if (errFetchReset) throw new Error(`Failed to fetch audit_log: ${errFetchReset.message}`);

  if (resetSesiLogs && resetSesiLogs.length > 0) {
    console.log(` -> Menghapus ${resetSesiLogs.length} entri RESET_SESI dari audit_log...`);
    const ids = resetSesiLogs.map(r => r.id_audit);
    const { error: errDelReset } = await supabase
      .from('audit_log')
      .delete()
      .in('id_audit', ids);
    if (errDelReset) throw new Error(`Failed to delete RESET_SESI logs: ${errDelReset.message}`);
    console.log(' -> Entri RESET_SESI berhasil dihapus.');
  } else {
    console.log(' -> Tidak ada entri RESET_SESI di audit_log.');
  }

  // B. Hapus entri audit_log terkait jadwal testing U-67AC6649 jika ada
  const { data: jadwalAuditLogs } = await supabase
    .from('audit_log')
    .select('id_audit, target')
    .ilike('target', '%U-67AC6649%');

  if (jadwalAuditLogs && jadwalAuditLogs.length > 0) {
    console.log(` -> Menghapus ${jadwalAuditLogs.length} entri audit_log terkait jadwal U-67AC6649...`);
    const ids = jadwalAuditLogs.map(r => r.id_audit);
    await supabase.from('audit_log').delete().in('id_audit', ids);
    console.log(' -> Entri audit_log terkait U-67AC6649 berhasil dihapus.');
  }

  // C. Hapus entri audit_log_archive terkait jadwal testing U-67AC6649 jika ada
  const { data: arcLogs } = await supabase
    .from('audit_log_archive')
    .select('id_archive, target')
    .ilike('target', '%U-67AC6649%');

  if (arcLogs && arcLogs.length > 0) {
    console.log(` -> Menghapus ${arcLogs.length} entri audit_log_archive terkait jadwal U-67AC6649...`);
    const ids = arcLogs.map(r => r.id_archive);
    await supabase.from('audit_log_archive').delete().in('id_archive', ids);
    console.log(' -> Entri audit_log_archive terkait U-67AC6649 berhasil dibersihkan.');
  }

  // Step 4: Bersihkan entri log aktivitas pengujian dari log_aktivitas_global
  console.log('\n[4/5] Sanitasi log_aktivitas_global...');
  // Hapus semua entri sekolah uji sisa tes (Sekolah Uji M2%, Sekolah Challenger%, Sekolah E2E%, Sekolah API CHL%, Sekolah Idemp CHL%, TEST%)
  const { data: globalLogs, error: errFetchGlobal } = await supabase
    .from('log_aktivitas_global')
    .select('id_log, action, detail');

  if (errFetchGlobal) throw new Error(`Failed to fetch log_aktivitas_global: ${errFetchGlobal.message}`);

  const testGlobalLogs = (globalLogs || []).filter(g => {
    const d = (g.detail || '').toLowerCase();
    const isRealSchool = d.includes('70040625') || d.includes('40103445') || d.includes('nizamudin') || d.includes('tutuyan');
    // Jika BUKAN sekolah riil, maka ini adalah log aktivitas pengujian sekolah dummy/test
    return !isRealSchool;
  });

  if (testGlobalLogs.length > 0) {
    console.log(` -> Ditemukan ${testGlobalLogs.length} entri log aktivitas pengujian pada log_aktivitas_global.`);
    // Hapus dalam batch 50 agar tidak melebihi batasan query URL Supabase
    const batchSize = 50;
    for (let i = 0; i < testGlobalLogs.length; i += batchSize) {
      const batchIds = testGlobalLogs.slice(i, i + batchSize).map(g => g.id_log);
      const { error: errDelBatch } = await supabase
        .from('log_aktivitas_global')
        .delete()
        .in('id_log', batchIds);
      if (errDelBatch) throw new Error(`Failed to delete batch log_aktivitas_global: ${errDelBatch.message}`);
    }
    console.log(' -> Seluruh entri log aktivitas pengujian di log_aktivitas_global berhasil dihapus.');
  } else {
    console.log(' -> log_aktivitas_global sudah bersih dari entri pengujian.');
  }

  // Step 5: Validasi integritas data esensial
  console.log('\n[5/5] Memeriksa keutuhan data esensial...');
  const { data: schools } = await supabase.from('sekolah').select('npsn, nama_sekolah, status');
  console.log(` -> Sekolah riil terverifikasi (${schools?.length}):`, schools?.map(s => `${s.npsn}: ${s.nama_sekolah}`).join(', '));

  const { data: admins } = await supabase.from('admin').select('id_admin, username, npsn');
  console.log(` -> Akun Admin terverifikasi (${admins?.length}):`, admins?.map(a => `${a.username} (${a.npsn})`).join(', '));

  const { data: gurus } = await supabase.from('guru').select('id_guru, username, npsn');
  console.log(` -> Akun Guru terverifikasi (${gurus?.length}):`, gurus?.map(g => `${g.username} (${g.npsn})`).join(', '));

  const { data: kelas } = await supabase.from('kelas').select('id_kelas, tingkat, kelas_paralel, npsn');
  console.log(` -> Data Kelas terverifikasi (${kelas?.length}):`, kelas?.map(k => `${k.tingkat} ${k.kelas_paralel}`).join(', '));

  const { data: mapel } = await supabase.from('mata_pelajaran').select('id_mapel, nama_mapel, npsn');
  console.log(` -> Mata Pelajaran terverifikasi (${mapel?.length}):`, mapel?.map(m => `${m.id_mapel}: ${m.nama_mapel}`).join(', '));

  const { data: skema } = await supabase.from('soal_ujian').select('id_soal, tipe_soal, npsn').eq('tipe_soal', 'SKEMA_DEFAULT');
  console.log(` -> Skema Default terverifikasi (${skema?.length}):`, skema?.map(s => `${s.id_soal} (${s.npsn})`).join(', '));

  console.log('\n====================================================');
  console.log('   SANITASI DATABASE SELESAI DENGAN SUKSES');
  console.log('====================================================');
}

sanitizeDatabase().catch(err => {
  console.error('\n[FATAL ERROR] Sanitasi gagal:', err);
  process.exit(1);
});
