import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cdcbarlyxjywltgrjgnr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY2Jhcmx5eGp5d2x0Z3JqZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTkwNTQsImV4cCI6MjEwMjg3NTA1NH0.Lze94l74sblAVNN4-IUtyQ_idr-aQCECxgPWTVAI5-c';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const tables = [
  'sekolah',
  'admin',
  'guru',
  'siswa',
  'kelas',
  'mata_pelajaran',
  'soal_ujian',
  'bank_soal',
  'jadwal',
  'log_ujian',
  'jawaban_siswa',
  'absensi_ujian',
  'pengawas_ruang',
  'berita_acara_ujian',
  'audit_log',
  'audit_log_archive',
  'log_aktivitas_global',
  'notifikasi'
];

async function deepAudit() {
  console.log('=== COMPREHENSIVE SUPABASE DATABASE AUDIT ===\n');

  for (const table of tables) {
    const { data, error, count } = await supabase.from(table).select('*', { count: 'exact' });
    if (error) {
      console.log(`Table [${table}]: ERROR - ${error.message}`);
    } else {
      console.log(`Table [${table}]: count = ${data.length} rows`);
      if (data.length > 0 && data.length <= 10) {
        console.log(`  Sample data:`, JSON.stringify(data, null, 2));
      } else if (data.length > 10) {
        console.log(`  First 2 rows:`, JSON.stringify(data.slice(0, 2), null, 2));
      }
    }
  }
}

deepAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
