import fs from 'fs';

const content = fs.readFileSync('src/api.js', 'utf8');

// Find all .update(...) and .insert(...)
const updateMatches = [...content.matchAll(/from\(['"]([a-zA-Z0-9_]+)['"]\)\s*\.update\(([^)]+)\)/g)];
console.log(`Found ${updateMatches.length} .update() calls:`);
for (const m of updateMatches) {
  console.log(`Table: ${m[1]} -> update(${m[2].trim()})`);
}

const insertMatches = [...content.matchAll(/from\(['"]([a-zA-Z0-9_]+)['"]\)\s*\.insert\(([^)]+)\)/g)];
console.log(`\nFound ${insertMatches.length} .insert() calls:`);
for (const m of insertMatches) {
  console.log(`Table: ${m[1]} -> insert(${m[2].trim()})`);
}
