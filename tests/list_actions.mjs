import fs from 'fs';
const content = fs.readFileSync('src/api.js', 'utf8');
const regex = /case\s+['"]([^'"]+)['"]\s*:/g;
let m;
const actions = [];
while ((m = regex.exec(content)) !== null) {
  actions.push(m[1]);
}
const tableRegex = /\.from\(['"]([^'"]+)['"]\)/g;
const tables = new Set();
while ((m = tableRegex.exec(content)) !== null) {
  tables.add(m[1]);
}
console.log('Unique tables referenced in api.js:', Array.from(tables));
