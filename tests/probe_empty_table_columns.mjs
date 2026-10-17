import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cdcbarlyxjywltgrjgnr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY2Jhcmx5eGp5d2x0Z3JqZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTkwNTQsImV4cCI6MjEwMjg3NTA1NH0.Lze94l74sblAVNN4-IUtyQ_idr-aQCECxgPWTVAI5-c';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkColumns() {
  // Check jadwal
  const testJadwal = 'U-SCHEMA-PROBE';
  const { data: insJadwal, error: errJadwal } = await supabase.from('jadwal').insert({
    id_jadwal: testJadwal,
    id_mapel: 'M-7AE60E7B',
    id_guru: 'G-163390E6',
    npsn: '70040625',
    waktu_mulai: new Date().toISOString(),
    waktu_selesai: new Date(Date.now() + 3600000).toISOString(),
    durasi_menit: 60,
    acak_soal: false,
    target_kelas: 'X Merdeka 1'
  }).select('*');

  if (errJadwal) {
    console.error('jadwal insert error:', errJadwal);
  } else {
    console.log('jadwal columns:', Object.keys(insJadwal[0]));
    
    // Check log_ujian
    const testLog = 'LOG-SCHEMA-PROBE';
    const { data: insLog, error: errLog } = await supabase.from('log_ujian').insert({
      id_log: testLog,
      id_jadwal: testJadwal,
      id_siswa: 'S-F2934CD8',
      status_ujian: 'SEDANG KERJA'
    }).select('*');

    if (errLog) {
      console.error('log_ujian insert error:', errLog);
    } else {
      console.log('log_ujian columns:', Object.keys(insLog[0]));
      await supabase.from('log_ujian').delete().eq('id_log', testLog);
    }

    await supabase.from('jadwal').delete().eq('id_jadwal', testJadwal);
  }

  process.exit(0);
}

checkColumns();
