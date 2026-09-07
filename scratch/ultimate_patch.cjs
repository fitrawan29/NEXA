const fs = require('fs');
const lines = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8').split('\n');

let newLines = [];
let skip = false;

// We need to inject mulberry32 after the imports
let injectedMulberry = false;

for (let i = 0; i < lines.length; i++) {
   const line = lines[i];

   if (line.includes("const ExamRoom = ({") && !injectedMulberry) {
      newLines.push(`
function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
function seededShuffle(array, seed) {
  let rand = mulberry32(seed);
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(rand() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}
`);
      injectedMulberry = true;
      newLines.push(line);
      continue;
   }

   if (line.includes("const [isDrawerOpen, setIsDrawerOpen] = useState(false);")) {
       newLines.push(line);
       newLines.push("      const [blurOverlay, setBlurOverlay] = useState(false);");
       continue;
   }

   // Patch fetchSoal Acak Opsi
   if (line.includes("if (jadwal.acak_opsi && parsedOpsi && (s.tipe_soal === 'PG' || s.tipe_soal === 'PGK')) {")) {
      newLines.push("            const seed = (user.id_user ? user.id_user.toString().charCodeAt(0) : 1) + (jadwal.id_jadwal * 10);");
      newLines.push(line);
      newLines.push("              seededShuffle(parsedOpsi, seed + (s.id_soal || 0));");
      i += 4; // skip 4 lines
      continue;
   }

   // Patch fetchSoal Acak Soal
   if (line.includes("if (jadwal.acak_soal) {")) {
      newLines.push(line);
      newLines.push("            const seed = (user.id_user ? user.id_user.toString().charCodeAt(0) : 1) + (jadwal.id_jadwal * 10);");
      newLines.push("            seededShuffle(parsedSoal, seed);");
      i += 4;
      continue;
   }

   // Handlers patch
   if (line.includes("const handleVisibilityChange = () => {")) {
       newLines.push("      const handleBlurOverlay = () => {");
       newLines.push("         if (!isSubmitting && !isBlocked && !isOffline && jadwal.browser_lockdown) {");
       newLines.push("            setBlurOverlay(true);");
       newLines.push("            reportViolation();");
       newLines.push("         }");
       newLines.push("      };");
       newLines.push("");
       newLines.push("      const handleVisibilityChange = () => {");
       newLines.push("        if (document.hidden) handleBlurOverlay();");
       newLines.push("      };");
       skip = true;
       continue;
   }

   if (skip && line.includes("const handleFullscreenChange = () => {")) {
       newLines.push("      const handleFullscreenChange = () => {");
       newLines.push("        if (!document.fullscreenElement) handleBlurOverlay();");
       newLines.push("      };");
       newLines.push("");
       newLines.push("      const handleWindowBlur = () => {");
       newLines.push("        handleBlurOverlay();");
       newLines.push("      };");
       continue;
   }

   if (skip && line.includes("const setupAntiCheat = () => {")) {
       newLines.push("      const setupAntiCheat = () => {");
       newLines.push("        if (jadwal.browser_lockdown) {");
       newLines.push("          document.addEventListener('visibilitychange', handleVisibilityChange);");
       newLines.push("          document.addEventListener('fullscreenchange', handleFullscreenChange);");
       newLines.push("          window.addEventListener('blur', handleWindowBlur);");
       newLines.push("        }");
       newLines.push("      };");
       continue;
   }

   if (skip && line.includes("const enforceFullscreen = () => {")) {
       newLines.push("      const enforceFullscreen = () => {");
       newLines.push("        if (jadwal.browser_lockdown && !isBlocked && document.documentElement.requestFullscreen && !document.fullscreenElement) {");
       newLines.push("          document.documentElement.requestFullscreen().catch(() => { });");
       newLines.push("        }");
       newLines.push("      };");
       newLines.push("");
       newLines.push("      const returnToExam = () => {");
       newLines.push("         setBlurOverlay(false);");
       newLines.push("         enforceFullscreen();");
       newLines.push("      };");
       skip = false;
       while(!lines[i+1].includes("const handleAnswerChange")) {
           i++;
       }
       continue;
   }
   
   if (skip) {
       continue;
   }

   if (line.includes("document.removeEventListener('fullscreenchange', handleFullscreenChange);")) {
       newLines.push(line);
       newLines.push("          window.removeEventListener('blur', handleWindowBlur);");
       continue;
   }

   if (line.includes("{isOffline && (")) {
       newLines.push('          {blurOverlay && (');
       newLines.push('             <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[150] flex items-center justify-center p-4 transition-all">');
       newLines.push('                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md text-center shadow-2xl border border-error/20 animate-fade-in-up">');
       newLines.push('                   <div className="w-20 h-20 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-6">');
       newLines.push('                      <span className="material-symbols-outlined text-[40px]">gavel</span>');
       newLines.push('                   </div>');
       newLines.push('                   <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Pelanggaran Terdeteksi!</h2>');
       newLines.push('                   <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">');
       newLines.push('                      Anda terdeteksi keluar dari mode layar penuh (Full Screen), pindah tab, atau membuka aplikasi lain. Tindakan ini dicatat sebagai pelanggaran.');
       newLines.push('                   </p>');
       newLines.push('                   <button onClick={returnToExam} className="w-full py-4 rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors">');
       newLines.push('                      Kembali ke Ujian');
       newLines.push('                   </button>');
       newLines.push('                </div>');
       newLines.push('             </div>');
       newLines.push('          )}');
       newLines.push(line);
       continue;
   }

   newLines.push(line);
}

fs.writeFileSync('src/views/ExamRoom.jsx', newLines.join('\n'));
console.log("Ultimate patch applied!");
