const fs = require('fs');

// ==== 1. Update SiswaView.js ====
let siswaContent = fs.readFileSync('views/SiswaView.js', 'utf-8');

siswaContent = siswaContent.replace(/<div className="p-8 text-center text-slate-500">Memuat data...<\/div>/g, `<CardSkeleton />`);
siswaContent = siswaContent.replace(/<p className="text-slate-500">Belum ada pengumuman.<\/p>/g, `<EmptyState icon="campaign" title="Belum Ada Pengumuman" message="Pantau terus halaman ini untuk informasi terbaru dari sekolah." />`);
siswaContent = siswaContent.replace(/<p className="text-slate-500">Tidak ada jadwal ujian aktif saat ini.<\/p>/g, `<EmptyState icon="event_busy" title="Tidak Ada Jadwal" message="Saat ini belum ada ujian yang dijadwalkan untuk Anda." />`);
siswaContent = siswaContent.replace(/<p className="text-slate-500">Belum ada riwayat ujian.<\/p>/g, `<EmptyState icon="history" title="Belum Ada Riwayat" message="Riwayat ujian yang telah diselesaikan akan muncul di sini." />`);

fs.writeFileSync('views/SiswaView.js', siswaContent, 'utf-8');

// ==== 2. Update ExamRoom.js ====
let examContent = fs.readFileSync('views/ExamRoom.js', 'utf-8');

examContent = examContent.replace(/<div className="flex items-center justify-center min-h-screen bg-surface dark:bg-slate-900 text-on-surface dark:text-white"><div className="animate-spin material-symbols-outlined text-4xl text-primary">progress_activity<\/div><\/div>/g, `<div className="min-h-screen bg-surface dark:bg-slate-900 p-8"><TableSkeleton rows={8} /></div>`);

// Update PG active state with Checkmark
const oldActiveOption = `className={\`w-full text-left p-4 rounded-xl border transition-all \${kunci_jawaban === opt.id ? 'bg-primary/10 border-primary text-primary font-bold' : 'border-outline-variant hover:bg-surface-variant'}\`}`;
const newActiveOption = `className={\`w-full flex items-center justify-between p-4 rounded-xl border transition-all \${kunci_jawaban === opt.id ? 'bg-primary/10 border-primary text-primary font-bold' : 'border-outline-variant hover:bg-surface-variant'}\`}`;
examContent = examContent.replace(oldActiveOption, newActiveOption);

// Inside the button mapping, we need to inject the checkmark icon if selected
const optionRegex = /<span dangerouslySetInnerHTML=\{\{ __html: opt\.teks \}\} \/>\n\s*<\/button>/g;
examContent = examContent.replace(optionRegex, (match) => {
  return `<span dangerouslySetInnerHTML={{ __html: opt.teks }} /></span>
                                  {kunci_jawaban === opt.id && <span className="material-symbols-outlined text-[20px] font-bold">check_circle</span>}
                                </button>`;
});
// Wait, the regex replacement might break if `span` is not closed. Let's fix the span structure.
// Let's use string replace for the exact button inner structure.
const oldButtonInner = `
                                <button key={opt.id} onClick={() => setJawabanSiswa(opt.id, opt.id)} className={\`w-full flex items-center justify-between p-4 rounded-xl border transition-all \${kunci_jawaban === opt.id ? 'bg-primary/10 border-primary text-primary font-bold' : 'border-outline-variant hover:bg-surface-variant'}\`}>
                                  <span className="font-bold mr-3">{opt.id}.</span>
                                  <span dangerouslySetInnerHTML={{ __html: opt.teks }} />
                                </button>`;
const newButtonInner = `
                                <button key={opt.id} onClick={() => setJawabanSiswa(opt.id, opt.id)} className={\`w-full flex items-center justify-between p-4 rounded-xl border transition-all \${kunci_jawaban === opt.id ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm' : 'border-outline-variant hover:bg-surface-variant/50'}\`}>
                                  <div className="flex items-center">
                                    <span className="font-bold mr-3">{opt.id}.</span>
                                    <span dangerouslySetInnerHTML={{ __html: opt.teks }} />
                                  </div>
                                  {kunci_jawaban === opt.id && <span className="material-symbols-outlined text-[24px]">check_circle</span>}
                                </button>`;
// It's safer to just replace the whole mapping block
const oldMappingBlock = `{soal.opsi.map(opt => (
                                <button key={opt.id} onClick={() => setJawabanSiswa(opt.id, opt.id)} className={\`w-full flex items-center justify-between p-4 rounded-xl border transition-all \${kunci_jawaban === opt.id ? 'bg-primary/10 border-primary text-primary font-bold' : 'border-outline-variant hover:bg-surface-variant'}\`}>
                                  <span dangerouslySetInnerHTML={{ __html: opt.teks }} /></span>
                                  {kunci_jawaban === opt.id && <span className="material-symbols-outlined text-[20px] font-bold">check_circle</span>}
                                </button>
                              ))}`;
// Since my previous replace broke it slightly, let's just rewrite the PG rendering part.
let examFinalContent = fs.readFileSync('views/ExamRoom.js', 'utf-8');
const pgBlockRegex = /\{soal\.opsi\.map\(opt => \([\s\S]*?<\/button>\s*\)\)\}/g;
examFinalContent = examFinalContent.replace(pgBlockRegex, `{soal.opsi.map(opt => (
                                <button key={opt.id} onClick={() => setJawabanSiswa(opt.id, opt.id)} className={\`w-full flex items-center justify-between p-4 rounded-xl border transition-all \${kunci_jawaban === opt.id ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm' : 'border-outline-variant hover:bg-surface-variant/50'}\`}>
                                  <div className="flex items-center text-left">
                                    <span className="font-bold mr-3">{opt.id}.</span>
                                    <span dangerouslySetInnerHTML={{ __html: opt.teks }} />
                                  </div>
                                  {kunci_jawaban === opt.id && <span className="material-symbols-outlined text-[24px] text-primary">check_circle</span>}
                                </button>
                              ))}`);
                              
// Update PGK rendering too
const pgkBlockRegex = /\{soal\.opsi\.map\(opt => \([\s\S]*?<\/label>\s*\)\)\}/g;
// We'll leave PGK alone for now unless it's easy. It's a checkbox label.

fs.writeFileSync('views/ExamRoom.js', examFinalContent, 'utf-8');
console.log('Update Siswa & ExamRoom UI selesai!');
