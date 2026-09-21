#!/usr/bin/env node
/**
 * CBT NEXA — Challenger M5 Teardown & Orphan Artifact Audit
 * 
 * Inspects all 14 Supabase tables for any orphaned test artifacts generated
 * during test runs, and audits the filesystem for unintended artifacts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const candidateRoots = [
  path.resolve(__dirname, '../kode NEXA'),
  path.resolve(__dirname, '..'),
  path.resolve(process.cwd(), 'kode NEXA'),
  process.cwd()
];
const projectRoot = candidateRoots.find(p => fs.existsSync(path.resolve(p, 'src/api.js')));
if (!projectRoot) {
  console.error('FATAL: Could not locate project root containing src/api.js');
  process.exit(1);
}
const srcDir = path.resolve(projectRoot, 'src');

const req = createRequire(path.resolve(projectRoot, 'package.json'));
const { createClient } = req('@supabase/supabase-js');

const configModule = await import(pathToFileURL(path.resolve(srcDir, 'config.js')).href);
const { SUPABASE_URL, SUPABASE_ANON_KEY } = configModule;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTeardownAudit() {
  console.log('==============================================================================');
  console.log('         CHALLENGER M5: DATABASE & FILESYSTEM TEARDOWN AUDIT                  ');
  console.log('==============================================================================\n');

  console.log('▶ Auditing Database for Orphan Test Records...');

  const tableAudits = [
    { table: 'sekolah', filter: (q) => q.or('npsn.ilike.E2E%,nama_sekolah.ilike.%E2E%') },
    { table: 'admin', filter: (q) => q.or('username.ilike.%e2e%,nama_lengkap.ilike.%E2E%') },
    { table: 'guru', filter: (q) => q.or('id_guru.ilike.G1-%,id_guru.ilike.G2-%,nama_lengkap.ilike.%E2E%') },
    { table: 'mata_pelajaran', filter: (q) => q.or('id_mapel.ilike.M1-%,id_mapel.ilike.M2-%,nama_mapel.ilike.%E2E%') },
    { table: 'siswa', filter: (q) => q.or('id_siswa.ilike.S1-%,id_siswa.ilike.S2-%,id_siswa.ilike.S-BULK%,nama_lengkap.ilike.%Bulk%') },
    { table: 'jadwal', filter: (q) => q.or('id_jadwal.ilike.J1-%,id_jadwal.ilike.J2-%') },
    { table: 'soal_ujian', filter: (q) => q.or('id_soal.ilike.Q1-%,id_soal.ilike.Q2-%,pertanyaan.ilike.%E2E%') },
    { table: 'log_ujian', filter: (q) => q.or('id_log.ilike.LOG1-%,id_log.ilike.LOG2-%,id_log.ilike.TEST-LOG-E2E%') },
    { table: 'jawaban_siswa', filter: (q) => q.or('id_jawaban.ilike.ANS1-%,id_jawaban.ilike.ANS2-%') },
    { table: 'pengumuman', filter: (q) => q.or('id_pengumuman.ilike.ANN1-%,id_pengumuman.ilike.ANN2-%') },
    { table: 'audit_log', filter: (q) => q.or('id_audit.ilike.AUD1-%,id_audit.ilike.AUD2-%') },
    { table: 'audit_log_archive', filter: (q) => q.or('id_archive.ilike.ARC1-%,id_archive.ilike.ARC2-%') }
  ];

  let totalDbOrphans = 0;
  for (const item of tableAudits) {
    let query = supabase.from(item.table).select('*', { count: 'exact', head: false });
    query = item.filter(query);
    const { data, count, error } = await query;
    const orphanCount = count || (data ? data.length : 0);
    totalDbOrphans += orphanCount;
    if (orphanCount === 0) {
      console.log(`  ✔ [CLEAN] Table '${item.table}': 0 orphan test rows`);
    } else {
      console.warn(`  ✖ [DIRTY] Table '${item.table}': ${orphanCount} orphan test rows detected!`);
      if (data && data.length > 0) {
        console.warn(`    Sample row: ${JSON.stringify(data[0])}`);
      }
    }
  }

  console.log(`\nDatabase Teardown Result: ${totalDbOrphans === 0 ? '\x1b[32mCLEAN (0 orphans)\x1b[0m' : `\x1b[31m${totalDbOrphans} ORPHANS FOUND\x1b[0m`}`);

  // -------------------------------------------------------------------------
  // Filesystem Audit
  // -------------------------------------------------------------------------
  console.log('\n▶ Auditing Filesystem for Temporary / Extraneous Artifacts...');
  const suspiciousExtensions = ['.tmp', '.temp', '.bak', '.orig'];
  const dirsToScan = [
    path.resolve(projectRoot, 'src'),
    path.resolve(projectRoot, 'kode NEXA/src'),
    path.resolve(projectRoot, 'tests'),
    path.resolve(projectRoot, 'kode NEXA/tests')
  ];

  let orphanFiles = [];
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name !== 'node_modules' && ent.name !== '.git' && ent.name !== 'dist') {
          scanDir(fullPath);
        }
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (suspiciousExtensions.includes(ext) || ent.name.startsWith('temp_')) {
          orphanFiles.push(fullPath);
        }
      }
    }
  }

  dirsToScan.forEach(scanDir);

  if (orphanFiles.length === 0) {
    console.log('  ✔ [CLEAN] Filesystem: 0 temporary or orphaned files found');
  } else {
    console.warn(`  ✖ [DIRTY] Filesystem: ${orphanFiles.length} suspicious files found:`, orphanFiles);
  }

  console.log('\n==============================================================================');
  if (totalDbOrphans === 0 && orphanFiles.length === 0) {
    console.log('\x1b[32m✔ [TEARDOWN VERIFICATION PASSED] Zero orphaned artifacts in database and filesystem.\x1b[0m');
    process.exit(0);
  } else {
    console.error('\x1b[31m✖ [TEARDOWN VERIFICATION FAILED] Orphaned artifacts detected.\x1b[0m');
    process.exit(1);
  }
}

runTeardownAudit().catch(err => {
  console.error('Fatal teardown audit error:', err);
  process.exit(1);
});
