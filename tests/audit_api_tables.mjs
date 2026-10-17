import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cdcbarlyxjywltgrjgnr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY2Jhcmx5eGp5d2x0Z3JqZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTkwNTQsImV4cCI6MjEwMjg3NTA1NH0.Lze94l74sblAVNN4-IUtyQ_idr-aQCECxgPWTVAI5-c';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const content = fs.readFileSync('src/api.js', 'utf8');
const regex = /\.from\(['"]([a-zA-Z0-9_]+)['"]\)/g;
let match;
const tables = new Set();
while ((match = regex.exec(content)) !== null) {
  tables.add(match[1]);
}
console.log('Tables found in src/api.js:', Array.from(tables));

for (const t of tables) {
  const { data, error } = await supabase.from(t).select('*').limit(1);
  if (error) {
    console.error(`[TABLE ERROR] Table "${t}": ${error.message} (code: ${error.code})`);
  } else {
    console.log(`[TABLE OK] Table "${t}" exists and is queryable.`);
  }
}
