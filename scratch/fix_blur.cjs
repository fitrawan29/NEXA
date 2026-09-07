const fs = require('fs');
let lines = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8').split('\n');

let newLines = [];
let skip = false;

for (let i = 0; i < lines.length; i++) {
   const line = lines[i];

   if (line.includes("const [isDrawerOpen, setIsDrawerOpen] = useState(false);")) {
       newLines.push(line);
       newLines.push("      const [blurOverlay, setBlurOverlay] = useState(false);");
       continue;
   }

   if (line.includes("const handleVisibilityChange = () => {")) {
       // Insert blur overlay handler before visibility change
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
       // skip next lines until end of enforceFullscreen
       while(!lines[i+1].includes("const handleAnswerChange")) {
           i++;
       }
       continue;
   }
   
   if (skip) {
       // We are skipping the original bodies of these functions
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
console.log("Blur overlay patched successfully!");
