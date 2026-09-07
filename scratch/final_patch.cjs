const fs = require('fs');
let code = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8');

const injectShuffle = `
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
`;
if (!code.includes("function mulberry32")) {
   code = code.replace("const ExamRoom = ({", injectShuffle + "\nconst ExamRoom = ({");
}

if (!code.includes("const [blurOverlay")) {
   code = code.replace(
     "const [isDrawerOpen, setIsDrawerOpen] = useState(false);",
     "const [isDrawerOpen, setIsDrawerOpen] = useState(false);\n      const [blurOverlay, setBlurOverlay] = useState(false);"
   );
}

// replace handlers
const oldHandlers = `
      const handleVisibilityChange = () => {
        if (document.hidden) {
          gracePeriodTimer.current = setTimeout(() => {
            reportViolation();
          }, 10000);
        } else {
          if (gracePeriodTimer.current) {
            clearTimeout(gracePeriodTimer.current);
            gracePeriodTimer.current = null;
          }
        }
      };

      const handleFullscreenChange = () => {
        if (!document.fullscreenElement && !isSubmitting && !isBlocked) {
          reportViolation();
          enforceFullscreen();
        }
      };

      const setupAntiCheat = () => {
        if (jadwal.browser_lockdown) {
          document.addEventListener('visibilitychange', handleVisibilityChange);
          document.addEventListener('fullscreenchange', handleFullscreenChange);
        }
      };

      const enforceFullscreen = () => {
        if (jadwal.browser_lockdown && !isBlocked && document.documentElement.requestFullscreen && !document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => { });
        }
      };`;
      
const newHandlers = `
      const handleBlurOverlay = () => {
         if (!isSubmitting && !isBlocked && !isOffline && jadwal.browser_lockdown) {
            setBlurOverlay(true);
            reportViolation();
         }
      };

      const handleVisibilityChange = () => {
        if (document.hidden) handleBlurOverlay();
      };

      const handleFullscreenChange = () => {
        if (!document.fullscreenElement) handleBlurOverlay();
      };
      
      const handleWindowBlur = () => {
        handleBlurOverlay();
      };

      const setupAntiCheat = () => {
        if (jadwal.browser_lockdown) {
          document.addEventListener('visibilitychange', handleVisibilityChange);
          document.addEventListener('fullscreenchange', handleFullscreenChange);
          window.addEventListener('blur', handleWindowBlur);
        }
      };

      const enforceFullscreen = () => {
        if (jadwal.browser_lockdown && !isBlocked && document.documentElement.requestFullscreen && !document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => { });
        }
      };
      
      const returnToExam = () => {
         setBlurOverlay(false);
         enforceFullscreen();
      };`;
if (code.includes(oldHandlers.trim())) {
    code = code.replace(oldHandlers.trim(), newHandlers.trim());
}

// replace cleanup
if (!code.includes("window.removeEventListener('blur'")) {
    code = code.replace(
      `document.removeEventListener('visibilitychange', handleVisibilityChange);
          document.removeEventListener('fullscreenchange', handleFullscreenChange);`,
      `document.removeEventListener('visibilitychange', handleVisibilityChange);
          document.removeEventListener('fullscreenchange', handleFullscreenChange);
          window.removeEventListener('blur', handleWindowBlur);`
    );
}

const overlayUI = `
          {blurOverlay && (
             <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[150] flex items-center justify-center p-4 transition-all">
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md text-center shadow-2xl border border-error/20 animate-fade-in-up">
                   <div className="w-20 h-20 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-6">
                      <span className="material-symbols-outlined text-[40px]">gavel</span>
                   </div>
                   <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Pelanggaran Terdeteksi!</h2>
                   <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">
                      Anda terdeteksi keluar dari mode layar penuh (Full Screen), pindah tab, atau membuka aplikasi lain. Tindakan ini dicatat sebagai pelanggaran.
                   </p>
                   <button onClick={returnToExam} className="w-full py-4 rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors">
                      Kembali ke Ujian
                   </button>
                </div>
             </div>
          )}
`;
if (!code.includes("Pelanggaran Terdeteksi!")) {
    code = code.replace("{isOffline && (", overlayUI + "\n            {isOffline && (");
}

fs.writeFileSync('src/views/ExamRoom.jsx', code);
console.log("Final patch applied!");
