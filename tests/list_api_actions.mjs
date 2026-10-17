import fs from 'fs';

const content = fs.readFileSync('src/api.js', 'utf8');
const lines = content.split('\n');
const actions = [];
lines.forEach((line, idx) => {
  const match = line.match(/case\s+['"]([a-zA-Z0-9_]+)['"]\s*:/);
  if (match) {
    actions.push({ line: idx + 1, action: match[1] });
  }
});

console.log(`Total actions: ${actions.length}`);
actions.forEach(a => console.log(`L${a.line}: ${a.action}`));
