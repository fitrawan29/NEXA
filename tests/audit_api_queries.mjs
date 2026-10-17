import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cdcbarlyxjywltgrjgnr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY2Jhcmx5eGp5d2x0Z3JqZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTkwNTQsImV4cCI6MjEwMjg3NTA1NH0.Lze94l74sblAVNN4-IUtyQ_idr-aQCECxgPWTVAI5-c';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const lines = fs.readFileSync('src/api.js', 'utf8').split('\n');

async function checkChainedQueries() {
  console.log('Auditing properly chained Supabase select queries in api.js...\n');
  const queries = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(".from(") && !line.includes("//")) {
      const fromMatch = line.match(/\.from\(['"]([^'"]+)['"]\)/);
      if (fromMatch) {
        const table = fromMatch[1];
        // Look ahead within next 5 lines for .select
        for (let j = i; j < Math.min(lines.length, i + 6); j++) {
          if (j > i && lines[j].includes(';')) {
            const selectMatch = lines[j].match(/\.select\((['"`]([^'"`]+)['"`])/);
            if (selectMatch) {
              queries.push({ line: i + 1, table, select: selectMatch[2] });
            }
            break;
          }
          const selectMatch = lines[j].match(/\.select\((['"`]([^'"`]+)['"`])/);
          if (selectMatch) {
            queries.push({ line: i + 1, table, select: selectMatch[2] });
            break;
          }
        }
      }
    }
  }

  console.log(`Found ${queries.length} chained from().select() queries:`);
  let errors = 0;
  for (const q of queries) {
    if (q.select.includes('${')) {
      console.log(`[SKIP DYNAMIC] Line ${q.line}: [${q.table}].select(\`${q.select}\`)`);
      continue;
    }
    const { data, error } = await supabase.from(q.table).select(q.select).limit(1);
    if (error) {
      console.error(`[FAIL] Line ${q.line}: [${q.table}].select('${q.select}') -> ${error.message}`);
      errors++;
    } else {
      console.log(`[PASS] Line ${q.line}: [${q.table}].select('${q.select.substring(0, 40)}...')`);
    }
  }

  console.log(`\nCompleted audit. Total errors: ${errors}`);
}

checkChainedQueries().catch(console.error);
