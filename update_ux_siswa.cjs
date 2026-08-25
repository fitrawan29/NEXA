const fs = require('fs');
let examContent = fs.readFileSync('views/ExamRoom.js', 'utf-8');

// ==== Add LOBBY state to ExamRoom ====
// ExamRoom currently has states: `statusUjian` (from user prop but local too).
// Actually, `SiswaView.js` sets `modeUjian(true)` and renders `ExamRoom`.
// So inside `ExamRoom.js` we can have a local state `const [isLobby, setIsLobby] = useState(true);`
// If `isLobby` is true, render the lobby.

const stateRegex = /const \[isOnline, setIsOnline\] = useState\(navigator\.onLine\);/;
examContent = examContent.replace(stateRegex, `const [isLobby, setIsLobby] = useState(true);\n    const [showSuccess, setShowSuccess] = useState(false);\n    const [isOnline, setIsOnline] = useState(navigator.onLine);`);

// Modify `handleSelesai` to show success modal before navigating back
const handleSelesaiRegex = /const handleSelesai = async \(\) => \{[\s\S]*?if \(res\.status === 'success'\) \{[\s\S]*?onSelesai\(\);[\s\S]*?\} else/;
const newHandleSelesai = `const handleSelesai = async () => {
      if (!confirm('Apakah Anda yakin ingin mengakhiri ujian? Jawaban tidak dapat diubah lagi.')) return;
      
      const payload = dataSoal.map(s => ({
        id_soal: s.id_soal,
        jawaban: jawaban.find(j => j.id_soal === s.id_soal)?.jawaban || ''
      }));

      const res = await fetchAPI('submit_ujian', {
        id_log: logUjian.id_log,
        jawaban: payload,
        npsn: user.npsn
      });

      if (res.status === 'success') {
        localStorage.removeItem('nexa_draft_jawaban_' + logUjian.id_log);
        setShowSuccess(true);
        setTimeout(() => {
          onSelesai();
        }, 3000);
      } else`;
examContent = examContent.replace(/const handleSelesai = async \(\) => \{[\s\S]*?if \(res\.status === 'success'\) \{[\s\S]*?localStorage\.removeItem\('nexa_draft_jawaban_' \+ logUjian\.id_log\);[\s\S]*?onSelesai\(\);[\s\S]*?\} else/m, newHandleSelesai);
// Because regex can fail, let's do a more robust string replacement for `handleSelesai`.
const handleSelesaiFull = `const handleSelesai = async () => {
      if (!confirm('Apakah Anda yakin ingin mengakhiri ujian? Jawaban tidak dapat diubah lagi.')) return;
      
      const payload = dataSoal.map(s => ({
        id_soal: s.id_soal,
        jawaban: jawaban.find(j => j.id_soal === s.id_soal)?.jawaban || ''
      }));

      const res = await fetchAPI('submit_ujian', {
        id_log: logUjian.id_log,
        jawaban: payload,
        npsn: user.npsn
      });

      if (res.status === 'success') {
        localStorage.removeItem('nexa_draft_jawaban_' + logUjian.id_log);
        setShowSuccess(true);
        setTimeout(() => {
          onSelesai();
        }, 2000);
      } else {
        alert(res.message);
      }
    };`;
// Actually, `fetchAPI` is passed as `api` in `ExamRoom`? No, `api` is passed as prop `api`, or it imports? `api` is just `api`.
// Let's check `ExamRoom.js` `handleSelesai`.
let examContent2 = fs.readFileSync('views/ExamRoom.js', 'utf-8');
const handleSelesaiBlockRegex = /const handleSelesai = async \(\) => \{[\s\S]*?alert\(res\.message\);\s*\}\s*\};/g;
examContent2 = examContent2.replace(handleSelesaiBlockRegex, handleSelesaiFull.replace('fetchAPI', 'api'));

// Insert Lobby and Success modals at the top of the render block
const returnBlock = `return (
      <div className="min-h-screen bg-surface dark:bg-slate-900 text-on-surface dark:text-white flex flex-col font-outfit relative">`;
const newReturnBlock = `return (
      <div className="min-h-screen bg-surface dark:bg-slate-900 text-on-surface dark:text-white flex flex-col font-outfit relative">
        {isLobby && (
          <div className="fixed inset-0 z-[100] bg-surface dark:bg-slate-900 flex flex-col items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-lg w-full text-center border border-outline-variant dark:border-slate-700 animate-fade-in-up">
              <span className="material-symbols-outlined text-7xl text-primary mb-4">school</span>
              <h1 className="text-3xl font-bold mb-2 text-on-surface dark:text-white">Ruang Persiapan</h1>
              <p className="text-slate-500 mb-8">Pastikan Anda berada di tempat yang tenang dan koneksi internet stabil.</p>
              
              <div className="bg-surface-variant dark:bg-slate-900/50 p-4 rounded-xl text-left mb-8 space-y-3">
                <div className="flex justify-between items-center border-b border-outline-variant/30 dark:border-slate-700 pb-2">
                  <span className="text-slate-500 font-medium">Ujian:</span>
                  <span className="font-bold text-on-surface dark:text-white">{jadwal?.nama_mapel}</span>
                </div>
                <div className="flex justify-between items-center border-b border-outline-variant/30 dark:border-slate-700 pb-2">
                  <span className="text-slate-500 font-medium">Waktu:</span>
                  <span className="font-bold text-on-surface dark:text-white">{jadwal?.durasi} Menit</span>
                </div>
                <div className="flex justify-between items-center pb-2">
                  <span className="text-slate-500 font-medium">Jumlah Soal:</span>
                  <span className="font-bold text-on-surface dark:text-white">{dataSoal?.length || 0} Soal</span>
                </div>
              </div>
              
              <button onClick={() => setIsLobby(false)} className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-lg hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">rocket_launch</span> SAYA SIAP MEMULAI
              </button>
            </div>
          </div>
        )}
        {showSuccess && (
          <div className="fixed inset-0 z-[110] bg-surface dark:bg-slate-900 flex flex-col items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center border border-outline-variant dark:border-slate-700 animate-fade-in-up">
              <span className="material-symbols-outlined text-7xl text-green-500 mb-4 animate-bounce">check_circle</span>
              <h2 className="text-2xl font-bold mb-2">Ujian Selesai!</h2>
              <p className="text-slate-500">Kerja bagus! Jawabanmu telah terkunci aman di server.</p>
            </div>
          </div>
        )}`;
examContent2 = examContent2.replace(returnBlock, newReturnBlock);

fs.writeFileSync('views/ExamRoom.js', examContent2, 'utf-8');
console.log('Update Siswa LOBBY selesai!');
