const fs = require('fs');

let code = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8');

// 1. Remove handleResize logic
code = code.replace(/const handleResize = \(\) => \{\s*const activeElement = document\.activeElement;\s*const isInput = activeElement && \(activeElement\.tagName === 'INPUT' \|\| activeElement\.tagName === 'TEXTAREA'\);\s*if \(!isInput && window\.innerHeight < window\.screen\.height \* 0\.70\) \{\s*triggerViolationImmediate\(\);\s*\}\s*\};\s*/, '');
code = code.replace(/window\.addEventListener\('resize', handleResize\);\s*/, '');
code = code.replace(/window\.removeEventListener\('resize', handleResize\);\s*/, '');

// 2. Modify Top Right Selesai Button
const oldBtn = /<button onClick=\{requestSubmit\} className="bg-error.*?>Selesai<\/button>/;
const newBtn = '<button onClick={requestSubmit} className="bg-red-600 text-white text-sm font-black px-5 py-2 rounded-full shadow-lg shadow-red-600/30 hover:bg-red-700 active:scale-95 transition-all border border-red-400">SELESAI</button>';
code = code.replace(oldBtn, newBtn);

fs.writeFileSync('src/views/ExamRoom.jsx', code);
console.log("ExamRoom fixed resize and Selesai button!");
