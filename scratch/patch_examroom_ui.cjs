const fs = require('fs');

let code = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8');

const oldQuestionClass = `<div className="font-question-text text-question-text text-on-surface dark:text-white mb-xl whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: currentS.pertanyaan }}>
                      </div>`;
                      
const newQuestionClass = `<div className="font-question-text text-question-text text-on-surface dark:text-white mb-xl whitespace-pre-wrap [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:shadow-sm [&_img]:my-3 overflow-x-auto" dangerouslySetInnerHTML={{ __html: currentS.pertanyaan }}>
                      </div>`;

code = code.replace(oldQuestionClass, newQuestionClass);

const oldNarasiClass = `<div className="font-body-md text-body-md text-on-surface-variant dark:text-slate-300" dangerouslySetInnerHTML={{ __html: narasiMap[currentS.id_narasi] }}></div>`;

const newNarasiClass = `<div className="font-body-md text-body-md text-on-surface-variant dark:text-slate-300 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:shadow-sm overflow-x-auto" dangerouslySetInnerHTML={{ __html: narasiMap[currentS.id_narasi] }}></div>`;

code = code.replace(oldNarasiClass, newNarasiClass);

const oldOpsiClass = `<div className="font-body-md text-body-md text-on-surface dark:text-white whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: String(o) }}></div>`;
const newOpsiClass = `<div className="font-body-md text-body-md text-on-surface dark:text-white whitespace-pre-wrap [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md overflow-x-auto flex-1 min-w-0" dangerouslySetInnerHTML={{ __html: String(o) }}></div>`;

// There are multiple instances of the opsi class depending on if it's PG or PGK. I will just do a global replace for the img tags.
code = code.replace(/dangerouslySetInnerHTML={{ __html: String\(o\) }}/g, `className="[&_img]:max-w-full [&_img]:h-auto flex-1 min-w-0 overflow-x-auto" dangerouslySetInnerHTML={{ __html: String(o) }}`);

fs.writeFileSync('src/views/ExamRoom.jsx', code);
console.log("ExamRoom responsive styles patched!");
