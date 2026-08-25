const fs = require('fs');

// ==== 1. Update ModalPeriksaUraian.js ====
let modalContent = fs.readFileSync('components/ModalPeriksaUraian.js', 'utf-8');

// The onSave prop currently looks like: `const ModalPeriksaUraian = ({ isOpen, logUjian, jawabanUraian, onClose, onSave }) => {`
// Let's change the parameters to accept `hasNext` and `onSaveAndNext`. But `onSave` can just take a boolean `isNext`.
modalContent = modalContent.replace(/onSave\(totalUraian\);/g, `onSave(totalUraian, false);`);
const handleSaveLogic = `const handleSave = () => {`;
const newHandleSaveLogic = `const handleSave = (isNext = false) => {
        let totalUraian = 0;
        for (let key in scores) {
          totalUraian += Number(scores[key] || 0);
        }
        onSave(totalUraian, isNext);
      };`;
modalContent = modalContent.replace(handleSaveLogic, newHandleSaveLogic);

// Add the button "Simpan & Lanjut"
const oldButtons = `<div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 font-medium">Batal</button>
              <button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl font-bold shadow-sm hover:shadow-md hover:bg-primary/90 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">save</span> Simpan Nilai
              </button>
            </div>`;
const newButtons = `<div className="p-6 border-t dark:border-slate-700 flex flex-wrap justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 font-medium text-sm">Batal</button>
              <button onClick={() => handleSave(false)} className="px-4 py-2 bg-slate-600 text-white rounded-xl font-bold shadow-sm hover:shadow-md hover:bg-slate-700 flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-[18px]">save</span> Simpan & Tutup
              </button>
              <button onClick={() => handleSave(true)} className="px-4 py-2 bg-primary text-white rounded-xl font-bold shadow-sm hover:shadow-md hover:bg-primary/90 flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-[18px]">navigate_next</span> Simpan & Lanjut
              </button>
            </div>`;
modalContent = modalContent.replace(oldButtons, newButtons);
fs.writeFileSync('components/ModalPeriksaUraian.js', modalContent, 'utf-8');

// ==== 2. Update GuruView.js ====
let guruContent = fs.readFileSync('views/GuruView.js', 'utf-8');

const oldSaveUraian = `const saveNilaiUraian = async (totalNilai) => {
        if (!modalUraian.logUjian) return;
        const res = await api('update_nilai_uraian', { id_log: modalUraian.logUjian.id_log, nilai_uraian_total: totalNilai });
        if (res.status === 'success') {
          setModalUraian({ isOpen: false, logUjian: null, jawabanUraian: [] });
          fetchData();
        } else alert(res.message);
      };`;
const newSaveUraian = `const saveNilaiUraian = async (totalNilai, isNext) => {
        if (!modalUraian.logUjian) return;
        const res = await api('update_nilai_uraian', { id_log: modalUraian.logUjian.id_log, nilai_uraian_total: totalNilai });
        if (res.status === 'success') {
          // Find next student
          let nextLog = null;
          if (isNext) {
             const currentIndex = dataLog.findIndex(log => log.id_log === modalUraian.logUjian.id_log);
             if (currentIndex !== -1 && currentIndex < dataLog.length - 1) {
                nextLog = dataLog[currentIndex + 1];
             }
          }
          
          fetchData(); // refresh table in background
          
          if (nextLog) {
             // Open next student
             setModalUraian(prev => ({ ...prev, logUjian: nextLog, jawabanUraian: [] })); // clear old while loading
             openPeriksaUraian(nextLog); // fetch new data
          } else {
             setModalUraian({ isOpen: false, logUjian: null, jawabanUraian: [] });
             if (isNext) alert('Semua siswa sudah diperiksa!');
          }
        } else {
          alert(res.message);
        }
      };`;
guruContent = guruContent.replace(oldSaveUraian, newSaveUraian);
fs.writeFileSync('views/GuruView.js', guruContent, 'utf-8');

console.log('Update UX Guru selesai!');
