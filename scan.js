const fs = require('fs');
const files = [
  'App.js', 'views/SuperAdminView.js', 'views/AdminView.js', 'views/GuruView.js', 'views/SiswaView.js', 'views/ExamRoom.js'
];
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.match(/className=\{[a-zA-Z0-9- ]+\}/)) {
      console.log('Error in ' + f + ' at line ' + (idx+1) + ': ' + line.trim());
    }
  });
});
console.log('Done scanning.');
