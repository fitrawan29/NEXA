const fs = require('fs');

let code = fs.readFileSync('src/views/SiswaView.jsx', 'utf8');

// 1. Patch status render in jadwal card
const oldStatusRender = `    if (j.status_siswa === 'SELESAI') {
      statusBtnClass = "bg-slate-400 text-white cursor-not-allowed shadow-none";
      statusText = "Selesai";
    } else if (j.status_siswa === 'SEDANG KERJA') {
      statusBtnClass = "bg-amber-500 hover:bg-amber-600 text-white animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.5)]";
      statusText = "Lanjutkan";
    } else if (isBelumMulai) {`;

const newStatusRender = `    if (j.is_blocked && j.status_siswa !== 'SELESAI') {
      statusBtnClass = "bg-error text-white cursor-not-allowed shadow-none";
      statusText = "Terblokir";
    } else if (j.status_siswa === 'SELESAI') {
      statusBtnClass = "bg-slate-400 text-white cursor-not-allowed shadow-none";
      statusText = "Selesai";
    } else if (j.status_siswa === 'SEDANG KERJA') {
      statusBtnClass = "bg-amber-500 hover:bg-amber-600 text-white animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.5)]";
      statusText = "Lanjutkan";
    } else if (isBelumMulai) {`;
code = code.replace(oldStatusRender, newStatusRender);

const oldButtonRender = `<button onClick={() => !isBelumMulai && j.status_siswa !== 'SELESAI' && setSelectedJadwalUntukToken(j.id_jadwal)} disabled={isBelumMulai || j.status_siswa === 'SELESAI'} className={\`px-4 py-1.5 rounded-full text-xs font-bold \${statusBtnClass}\`}>`;

const newButtonRender = `<button onClick={() => !isBelumMulai && !j.is_blocked && j.status_siswa !== 'SELESAI' && setSelectedJadwalUntukToken(j.id_jadwal)} disabled={isBelumMulai || j.status_siswa === 'SELESAI' || (j.is_blocked && j.status_siswa !== 'SELESAI')} className={\`px-4 py-1.5 rounded-full text-xs font-bold \${statusBtnClass}\`}>`;
code = code.replace(oldButtonRender, newButtonRender);

// 2. Patch History item rendering
const oldHistoryItem = `<div className="bg-gradient-to-br from-green-400 to-green-600 text-white font-black w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-[0_5px_15px_rgba(74,222,128,0.3)] shrink-0">
                         {r.total_nilai}
                       </div>`;
                       
const newHistoryItem = `<div className={\`bg-gradient-to-br \${r.is_blocked ? 'from-error to-error text-white' : 'from-green-400 to-green-600 text-white'} font-black w-14 h-14 rounded-2xl flex items-center justify-center text-xl \${!r.is_blocked && 'shadow-[0_5px_15px_rgba(74,222,128,0.3)]'} shrink-0\`}>
                         {r.is_blocked ? 0 : r.total_nilai}
                       </div>`;
code = code.replace(oldHistoryItem, newHistoryItem);

// 3. Patch History detail modal
const oldModalContent = `<div className="w-32 h-32 rounded-full border-8 border-slate-50 dark:border-slate-900 flex items-center justify-center bg-gradient-to-br from-green-400 to-green-600 shadow-xl z-10 text-white relative -mt-16">
                          <span className="font-black text-4xl">{detailNilaiModal.total_nilai}</span>
                       </div>
                       <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-3">Skor Akhir</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">`;

const newModalContent = `<div className={\`w-32 h-32 rounded-full border-8 border-slate-50 dark:border-slate-900 flex items-center justify-center bg-gradient-to-br \${detailNilaiModal.is_blocked ? 'from-error to-error' : 'from-green-400 to-green-600'} shadow-xl z-10 text-white relative -mt-16\`}>
                          <span className="font-black text-4xl">{detailNilaiModal.is_blocked ? 0 : detailNilaiModal.total_nilai}</span>
                       </div>
                       <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-3">Skor Akhir</p>
                    </div>
                    
                    {detailNilaiModal.is_blocked && (
                       <div className="bg-error/10 border border-error/20 p-4 rounded-2xl mb-6">
                          <div className="flex items-center gap-2 text-error font-bold mb-2">
                             <span className="material-symbols-outlined text-[18px]">gavel</span>
                             Ujian Dibatalkan (Blokir)
                          </div>
                          <p className="text-sm text-error/80 mb-2">Siswa ini diblokir karena melanggar 3 kali peringatan keamanan:</p>
                          <ul className="list-disc list-inside text-xs text-error/70 space-y-1">
                            {detailNilaiModal.pelanggaran_detail && Array.isArray(detailNilaiModal.pelanggaran_detail) ? 
                              detailNilaiModal.pelanggaran_detail.map((d, i) => (
                                <li key={i}>{d.alasan || 'Pelanggaran keamanan'} ({new Date(d.waktu).toLocaleTimeString('id-ID')})</li>
                              )) : 
                              <li>Keluar dari mode layar penuh (Full Screen) atau membuka aplikasi lain.</li>
                            }
                          </ul>
                       </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">`;
code = code.replace(oldModalContent, newModalContent);

fs.writeFileSync('src/views/SiswaView.jsx', code);
console.log("SiswaView patched!");
