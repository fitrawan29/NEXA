import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cdcbarlyxjywltgrjgnr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY2Jhcmx5eGp5d2x0Z3JqZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTkwNTQsImV4cCI6MjEwMjg3NTA1NH0.Lze94l74sblAVNN4-IUtyQ_idr-aQCECxgPWTVAI5-c';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runSanitization() {
  console.log('=== START DATABASE SANITIZATION ===\n');

  // 1. Sanitasi tabel `siswa`: Bersihkan atribut ruang pengujian ('Ruang CBT M3 Testing' -> null)
  console.log('1. Sanitasi tabel siswa...');
  const { data: siswaBefore, error: errSiswaFetch } = await supabase
    .from('siswa')
    .select('id_siswa, nama_lengkap, username, ruang, npsn');
  if (errSiswaFetch) throw new Error('Fetch siswa failed: ' + errSiswaFetch.message);

  for (const s of (siswaBefore || [])) {
    if (s.ruang && (s.ruang.includes('Testing') || s.ruang.includes('M3'))) {
      console.log(` - Updating student ${s.id_siswa} (${s.nama_lengkap}): clearing ruang "${s.ruang}" -> null`);
      const { error: errUpdateSiswa } = await supabase
        .from('siswa')
        .update({ ruang: null })
        .eq('id_siswa', s.id_siswa);
      if (errUpdateSiswa) throw new Error(`Failed to update student ${s.id_siswa}: ` + errUpdateSiswa.message);
    }
  }

  // 2. Sanitasi profil avatar admin & guru: Ganti testing seeds (ChallengerAvatar, E2ETest) ke avatar riil/netral
  console.log('\n2. Sanitasi avatar admin & guru...');
  const { data: admins, error: errAdminFetch } = await supabase
    .from('admin')
    .select('id_admin, username, nama_lengkap, foto_profil');
  if (errAdminFetch) throw new Error('Fetch admin failed: ' + errAdminFetch.message);

  for (const a of (admins || [])) {
    let newAvatar = null;
    if (a.foto_profil && (a.foto_profil.includes('ChallengerAvatar') || a.foto_profil.includes('E2ETest') || a.foto_profil.includes('Test'))) {
      if (a.username === 'admin01') {
        newAvatar = 'https://api.dicebear.com/7.x/bottts/svg?seed=Felix';
      } else if (a.username === 'admin02') {
        newAvatar = 'https://api.dicebear.com/7.x/bottts/svg?seed=Buster';
      } else {
        newAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${a.username}`;
      }
      console.log(` - Updating admin ${a.username}: "${a.foto_profil}" -> "${newAvatar}"`);
      const { error: errAdminUpdate } = await supabase
        .from('admin')
        .update({ foto_profil: newAvatar })
        .eq('id_admin', a.id_admin);
      if (errAdminUpdate) throw new Error(`Failed to update admin ${a.username}: ` + errAdminUpdate.message);
    }
  }

  const { data: gurus, error: errGuruFetch } = await supabase
    .from('guru')
    .select('id_guru, username, nama_lengkap, foto');
  if (errGuruFetch) throw new Error('Fetch guru failed: ' + errGuruFetch.message);

  for (const g of (gurus || [])) {
    if (g.foto && (g.foto.includes('ChallengerAvatar') || g.foto.includes('E2ETest') || g.foto.includes('Test'))) {
      const newAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${g.username}`;
      console.log(` - Updating guru ${g.username}: "${g.foto}" -> "${newAvatar}"`);
      const { error: errGuruUpdate } = await supabase
        .from('guru')
        .update({ foto: newAvatar })
        .eq('id_guru', g.id_guru);
      if (errGuruUpdate) throw new Error(`Failed to update guru ${g.username}: ` + errGuruUpdate.message);
    }
  }

  // 3. Sanitasi tabel `mata_pelajaran`: Bersihkan mapel uji dengan npsn: null (MTK-X, INF-X)
  console.log('\n3. Sanitasi tabel mata_pelajaran...');
  const { data: mapelNull, error: errMapelFetch } = await supabase
    .from('mata_pelajaran')
    .select('*')
    .is('npsn', null);
  if (errMapelFetch) throw new Error('Fetch mapel null failed: ' + errMapelFetch.message);

  if (mapelNull && mapelNull.length > 0) {
    console.log(` - Found ${mapelNull.length} mapel with npsn: null:`, mapelNull.map(m => m.id_mapel));
    const idsToDelete = mapelNull.map(m => m.id_mapel);
    const { error: errDelMapel } = await supabase
      .from('mata_pelajaran')
      .delete()
      .in('id_mapel', idsToDelete);
    if (errDelMapel) throw new Error('Failed to delete obsolete mapel: ' + errDelMapel.message);
    console.log(` - Obsolete test mapel deleted successfully.`);
  } else {
    console.log(' - No mapel with npsn: null found.');
  }

  // Clean obsolete SKEMA-null in soal_ujian if present
  console.log('\n4. Sanitasi soal_ujian (SKEMA-null)...');
  const { data: soalSkemaNull } = await supabase
    .from('soal_ujian')
    .select('id_soal')
    .eq('id_soal', 'SKEMA-null');
  if (soalSkemaNull && soalSkemaNull.length > 0) {
    console.log(' - Deleting obsolete SKEMA-null from soal_ujian...');
    const { error: errDelSoal } = await supabase
      .from('soal_ujian')
      .delete()
      .eq('id_soal', 'SKEMA-null');
    if (errDelSoal) console.warn('Warning deleting SKEMA-null:', errDelSoal.message);
    else console.log(' - SKEMA-null deleted successfully.');
  } else {
    console.log(' - No SKEMA-null found in soal_ujian.');
  }

  // 5. Sanitasi tabel `log_ujian`: Bersihkan ruang testing residue dan orphaned test logs (id_siswa: null)
  console.log('\n5. Sanitasi log_ujian...');
  // A. Bersihkan testing residue di kolom ruang log_ujian
  const { data: logTestingRuang } = await supabase
    .from('log_ujian')
    .select('id_log, id_siswa, ruang')
    .not('ruang', 'is', null);
  for (const l of (logTestingRuang || [])) {
    if (l.ruang && (l.ruang.includes('Testing') || l.ruang.includes('M3'))) {
      console.log(` - Updating log_ujian ${l.id_log}: clearing ruang "${l.ruang}" -> null`);
      const { error: errUpdateLogRuang } = await supabase
        .from('log_ujian')
        .update({ ruang: null })
        .eq('id_log', l.id_log);
      if (errUpdateLogRuang) throw new Error(`Failed to update log_ujian ${l.id_log}: ` + errUpdateLogRuang.message);
    }
  }

  // B. Hapus orphaned test logs dengan id_siswa: null yang menggelembungkan metrik siswa aktif
  const { data: orphanedLogs } = await supabase
    .from('log_ujian')
    .select('id_log')
    .is('id_siswa', null);
  if (orphanedLogs && orphanedLogs.length > 0) {
    const orphanIds = orphanedLogs.map(o => o.id_log);
    console.log(` - Deleting ${orphanIds.length} orphaned test logs from log_ujian:`, orphanIds);
    const { error: errDelOrphan } = await supabase
      .from('log_ujian')
      .delete()
      .in('id_log', orphanIds);
    if (errDelOrphan) throw new Error('Failed to delete orphaned logs: ' + errDelOrphan.message);
    console.log(' - Orphaned test logs deleted successfully.');
  } else {
    console.log(' - No orphaned test logs found in log_ujian.');
  }

  // 6. Verifikasi Final Sanitasi
  console.log('\n=== VERIFIKASI POST-SANITASI ===\n');

  // Verify Siswa
  const { data: siswaAfter } = await supabase.from('siswa').select('id_siswa, nama_lengkap, ruang, npsn');
  const residualSiswa = siswaAfter?.filter(s => s.ruang && (s.ruang.includes('Testing') || s.ruang.includes('M3')));
  console.log('Siswa with testing ruang residue count:', residualSiswa?.length || 0);

  // Verify Admin & Guru Avatars
  const { data: adminAfter } = await supabase.from('admin').select('id_admin, username, foto_profil');
  const residualAdmin = adminAfter?.filter(a => a.foto_profil && (a.foto_profil.includes('ChallengerAvatar') || a.foto_profil.includes('E2ETest')));
  console.log('Admin with test avatar residue count:', residualAdmin?.length || 0);
  for (const a of (adminAfter || [])) {
    console.log(` - Admin [${a.username}]: ${a.foto_profil}`);
  }

  const { data: guruAfter } = await supabase.from('guru').select('id_guru, username, foto');
  const residualGuru = guruAfter?.filter(g => g.foto && (g.foto.includes('ChallengerAvatar') || g.foto.includes('E2ETest')));
  console.log('Guru with test avatar residue count:', residualGuru?.length || 0);
  for (const g of (guruAfter || [])) {
    console.log(` - Guru [${g.username}]: ${g.foto}`);
  }

  // Verify Mapel
  const { data: mapelAfter } = await supabase.from('mata_pelajaran').select('*');
  const mapelNullAfter = mapelAfter?.filter(m => !m.npsn);
  console.log('Mapel with npsn: null count:', mapelNullAfter?.length || 0);
  console.log('Active Mapel list:');
  for (const m of (mapelAfter || [])) {
    console.log(` - ID: ${m.id_mapel}, Nama: ${m.nama_mapel}, NPSN: ${m.npsn}`);
  }

  // Verify Schools
  const { data: sekolahAfter } = await supabase.from('sekolah').select('*');
  console.log('Schools count:', sekolahAfter?.length || 0);
  for (const s of (sekolahAfter || [])) {
    console.log(` - NPSN: ${s.npsn}, Nama: ${s.nama_sekolah}, Status: ${s.status}`);
  }

  // Verify log_ujian
  const { data: logsAfter } = await supabase.from('log_ujian').select('id_log, id_siswa, ruang, status_ujian');
  const residualLogRuang = logsAfter?.filter(l => l.ruang && (l.ruang.includes('Testing') || l.ruang.includes('M3')));
  const orphanLogsCount = logsAfter?.filter(l => !l.id_siswa).length || 0;
  console.log('log_ujian with testing ruang residue count:', residualLogRuang?.length || 0);
  console.log('log_ujian orphaned records (id_siswa: null) count:', orphanLogsCount);

  console.log('\n=== SANITASI SELESAI BERHASIL ===');
}

runSanitization().catch(err => {
  console.error('Sanitization failed:', err);
  process.exit(1);
});
