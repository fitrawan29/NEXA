import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cdcbarlyxjywltgrjgnr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY2Jhcmx5eGp5d2x0Z3JqZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTkwNTQsImV4cCI6MjEwMjg3NTA1NH0.Lze94l74sblAVNN4-IUtyQ_idr-aQCECxgPWTVAI5-c';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const content = fs.readFileSync('src/api.js', 'utf8');

// Find all patterns of supabaseClient.from('tableName').select('columns')
const selectRegex = /from\(['"]([a-zA-Z0-9_]+)['"]\)\s*\.select\((['"`][^'"`]+['"`])/g;
let match;
const queries = [];
while ((match = selectRegex.exec(content)) !== null) {
  const table = match[1];
  const cols = match[2].slice(1, -1).trim();
  queries.push({ table, cols });
}

console.log(`Found ${queries.length} .select() queries to test against Supabase...`);

async function runSelectAudit() {
  let issues = 0;
  for (const q of queries) {
    // skip non-existent tables already known
    if (q.table === 'soal' || q.table === 'bank_soal') {
      console.log(`[KNOWN ISSUE] Table ${q.table} does not exist`);
      issues++;
      continue;
    }
    // Try executing with limit(0)
    try {
      const { data, error } = await supabase.from(q.table).select(q.cols).limit(0);
      if (error) {
        console.error(`[SELECT ERROR] Table "${q.table}", select("${q.cols}"): ${error.message} (code: ${error.code})`);
        issues++;
      } else {
        console.log(`[SELECT OK] Table "${q.table}", select("${q.cols}")`);
      }
    } catch (err) {
      console.error(`[EXCEPTION] Table "${q.table}", select("${q.cols}"):`, err.message);
      issues++;
    }
  }

  console.log(`\nSelect audit finished with ${issues} issue(s).`);
  process.exit(0);
}

runSelectAudit();
