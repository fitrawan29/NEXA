const fs = require('fs');

let code = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8');

// 1. Replace Top Bar (Header)
const oldHeaderRegex = /<header className="fixed top-0[\s\S]*?<\/header>/;
const newHeader = `<header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-50 flex items-center justify-between px-4 shadow-sm transition-colors duration-500">
              <div className="flex flex-col md:ml-80">
                 <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate max-w-[150px] sm:max-w-xs">{jadwal.nama_mapel}</span>
                 <span className="text-[10px] text-slate-400 dark:text-slate-500">{user.nama_lengkap}</span>
              </div>
              <div className="flex items-center gap-3">
                 <div className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-full \${timeLeft.total < 300000 ? 'bg-error/10 text-error animate-pulse' : 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-fixed'} font-black text-sm\`}>
                   <span className="material-symbols-outlined text-[16px]">timer</span>
                   {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
                 </div>
                 <button onClick={requestSubmit} className="bg-error text-white text-xs font-bold px-4 py-2 rounded-full shadow-md shadow-error/20 hover:bg-error/90 active:scale-95 transition-all">Selesai</button>
              </div>
            </header>`;
code = code.replace(oldHeaderRegex, newHeader);

// 2. Replace Question Card
const oldQuestionCardRegex = /<div className="bg-white dark:bg-slate-800 border-2 border-primary[\s\S]*?{renderQuestionInput\(currentS\)}\s*<\/div>\s*<\/div>/;
const newQuestionCard = `<div className="bg-white dark:bg-slate-800 rounded-3xl p-5 md:p-8 shadow-sm border border-slate-100 dark:border-slate-700/50 mb-xl animate-fade-in-up">
                      <div className="flex justify-between items-center mb-5 pb-5 border-b border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center gap-4">
                          <div className="bg-gradient-to-br from-primary to-secondary text-white w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-primary/20 shrink-0">
                             {currentIndex + 1}
                          </div>
                          <div className="flex flex-col">
                             <span className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Soal Ke-{currentIndex + 1} dari {soal.length}</span>
                             <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{currentS.tipe_soal} {currentS.bobot ? \`• \${currentS.bobot} Poin\` : ''}</span>
                          </div>
                        </div>
                      </div>
                      <div className="font-medium text-slate-800 dark:text-slate-100 text-[16px] md:text-[18px] leading-relaxed mb-8 whitespace-pre-wrap [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-2xl [&_img]:my-4 [&_img]:shadow-sm overflow-x-auto" dangerouslySetInnerHTML={{ __html: currentS.pertanyaan }}>
                      </div>
                      <div className="space-y-3">
                        {renderQuestionInput(currentS)}
                      </div>
                    </div>`;
code = code.replace(oldQuestionCardRegex, newQuestionCard);

// 3. Replace Bottom Bar
const oldBottomBarRegex = /<div className="fixed bottom-0 md:left-80[\s\S]*?<\/div>\s*<\/div>/;
const newBottomBar = `<div className="fixed bottom-0 md:left-80 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-40 pb-safe transition-colors duration-500">
                   <div className="flex gap-2">
                      <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0} className="w-12 h-12 md:w-auto md:px-5 rounded-2xl flex items-center justify-center gap-2 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-white dark:bg-slate-800">
                         <span className="material-symbols-outlined text-[24px]">chevron_left</span>
                         <span className="hidden md:inline font-bold text-sm">Sebelumnya</span>
                      </button>
                      <button onClick={() => setIsDrawerOpen(true)} className="md:hidden w-12 h-12 rounded-2xl flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors">
                         <span className="material-symbols-outlined text-[20px]">grid_view</span>
                      </button>
                   </div>
                   
                   <div className="flex gap-2 items-center">
                      <button onClick={() => toggleRaguRagu(currentS.id_soal)} className={\`h-12 px-4 md:px-5 rounded-2xl flex items-center gap-2 border-2 font-bold text-sm transition-colors \${raguRagu[currentS.id_soal] ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 hover:border-amber-300 hover:text-amber-500'}\`}>
                         <span className="material-symbols-outlined text-[20px]">\${raguRagu[currentS.id_soal] ? 'check_box' : 'check_box_outline_blank'}</span>
                         <span className="hidden sm:inline">Ragu</span>
                      </button>
                      <button onClick={() => setCurrentIndex(Math.min(soal.length - 1, currentIndex + 1))} disabled={currentIndex === soal.length - 1} className="h-12 px-6 md:px-8 rounded-2xl flex items-center justify-center bg-gradient-to-r from-primary to-secondary text-white font-bold text-sm hover:opacity-90 shadow-lg shadow-primary/30 transition-all disabled:opacity-30 disabled:shadow-none active:scale-95">
                         <span className="md:mr-2">Lanjut</span>
                         <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                      </button>
                   </div>
                </div>`;
code = code.replace(oldBottomBarRegex, newBottomBar);

// 4. Update renderQuestionInput (Options UI)
// Find the switch statement and replace PG/BS and PGK logic
const oldPGRegex = /case 'PG':\s*case 'BS':[\s\S]*?case 'PGK':/;
const newPG = `case 'PG':
            case 'BS':
              return (s.opsi || []).map((op, idx) => {
                const isSelected = currentAns === op;
                const letter = String.fromCharCode(65 + idx);
                return (
                  <label key={idx} className={\`relative flex items-start p-4 rounded-2xl cursor-pointer transition-all border-2 \${isSelected ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-md shadow-primary/10' : 'border-slate-100 dark:border-slate-700 hover:border-primary/30 bg-white dark:bg-slate-800'}\`}>
                    <div className={\`flex items-center justify-center w-6 h-6 rounded-full border-2 mt-0.5 shrink-0 transition-colors \${isSelected ? 'border-primary bg-primary' : 'border-slate-300 dark:border-slate-600'}\`}>
                       {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-white"></div>}
                    </div>
                    <input type="radio" className="hidden" name={s.id_soal} value={op} checked={isSelected} onChange={() => handleAnswerChange(s.id_soal, op, s.tipe_soal)} />
                    <div className="ml-3 flex-1 min-w-0 flex items-start">
                       {s.tipe_soal === 'PG' && <span className={\`font-bold mr-2 mt-0.5 \${isSelected ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}\`}>{letter}.</span>}
                       <div className={\`text-[15px] leading-relaxed overflow-x-auto [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg \${isSelected ? 'text-primary-dark dark:text-primary-fixed font-medium' : 'text-slate-700 dark:text-slate-200'}\`} dangerouslySetInnerHTML={{ __html: op }}></div>
                    </div>
                  </label>
                );
              });

            case 'PGK':`;
code = code.replace(oldPGRegex, newPG);

const oldPGKRegex = /case 'PGK':[\s\S]*?case 'JODOH':/;
const newPGK = `case 'PGK':
              return (s.opsi || []).map((op, idx) => {
                const isChecked = Array.isArray(currentAns) && currentAns.includes(op);
                const letter = String.fromCharCode(65 + idx);
                return (
                  <label key={idx} className={\`relative flex items-start p-4 rounded-2xl cursor-pointer transition-all border-2 \${isChecked ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-md shadow-primary/10' : 'border-slate-100 dark:border-slate-700 hover:border-primary/30 bg-white dark:bg-slate-800'}\`}>
                    <div className={\`flex items-center justify-center w-6 h-6 rounded-md border-2 mt-0.5 shrink-0 transition-colors \${isChecked ? 'border-primary bg-primary' : 'border-slate-300 dark:border-slate-600'}\`}>
                       {isChecked && <span className="material-symbols-outlined text-white text-[16px] font-bold">check</span>}
                    </div>
                    <input type="checkbox" className="hidden" value={op} checked={isChecked} onChange={() => handleAnswerChange(s.id_soal, op, s.tipe_soal)} />
                    <div className="ml-3 flex-1 min-w-0 flex items-start">
                       <span className={\`font-bold mr-2 mt-0.5 \${isChecked ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}\`}>{letter}.</span>
                       <div className={\`text-[15px] leading-relaxed overflow-x-auto [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg \${isChecked ? 'text-primary-dark dark:text-primary-fixed font-medium' : 'text-slate-700 dark:text-slate-200'}\`} dangerouslySetInnerHTML={{ __html: op }}></div>
                    </div>
                  </label>
                );
              });

            case 'JODOH':`;
code = code.replace(oldPGKRegex, newPGK);

// Fix PT-20 margin from the main container
const oldMainWrapper = `<div className="flex flex-1 pt-20 h-full">`;
const newMainWrapper = `<div className="flex flex-1 pt-16 h-full">`; // Reduced top padding to fit new 16 (4rem/64px) header height
code = code.replace(oldMainWrapper, newMainWrapper);

// Fix drawer bottom navigation spacing
const oldDrawerBottom = `<div className={\`absolute bottom-0 w-full bg-surface dark:bg-slate-900 rounded-t-[32px] shadow-2xl p-6 transition-transform duration-300 \${isDrawerOpen ? 'translate-y-0' : 'translate-y-full'}\`}>`;
const newDrawerBottom = `<div className={\`absolute bottom-0 w-full bg-white dark:bg-slate-900 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.15)] p-6 pb-12 transition-transform duration-300 \${isDrawerOpen ? 'translate-y-0' : 'translate-y-full'}\`}>`;
code = code.replace(oldDrawerBottom, newDrawerBottom);

fs.writeFileSync('src/views/ExamRoom.jsx', code);
console.log("Mobile UI layout applied to ExamRoom!");
