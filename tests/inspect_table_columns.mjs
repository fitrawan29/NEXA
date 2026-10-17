import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cdcbarlyxjywltgrjgnr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY2Jhcmx5eGp5d2x0Z3JqZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTkwNTQsImV4cCI6MjEwMjg3NTA1NH0.Lze94l74sblAVNN4-IUtyQ_idr-aQCECxgPWTVAI5-c';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const realTables = [
  'jadwal',
  'soal_ujian',
  'super_admin',
  'siswa',
  'sekolah',
  'admin',
  'guru',
  'log_ujian',
  'pengumuman_global',
  'audit_log',
  'log_aktivitas_global',
  'mata_pelajaran',
  'kelas',
  'guru_mapel',
  'ruang_ujian',
  'pengawas_ruang',
  'absensi_ujian',
  'berita_acara_ujian',
  'jawaban_siswa',
  'audit_log_archive',
  'pengumuman'
];

async function inspectSchema() {
  const schemaMap = {};
  for (const t of realTables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.error(`Error querying ${t}:`, error);
      continue;
    }
    // If table has at least one row, we can see columns directly
    if (data && data.length > 0) {
      schemaMap[t] = Object.keys(data[0]);
    } else {
      // Table is empty, let's insert a dummy and rollback/delete, or query columns using an empty insert/rpc or check error message
      // Actually we can check what columns exist by trying a select with non-existent column, PostgREST will list hint or we can inspect migrations/sql files in repo!
      schemaMap[t] = 'EMPTY';
    }
  }
  console.log('Known schemas from populated tables:', JSON.stringify(schemaMap, null, 2));
}

inspectSchema();
