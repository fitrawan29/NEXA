const fs = require('fs');

let lines = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8').split('\\n');
if (lines.length === 1) lines = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8').split('\\r\\n');

let out = [];
let skip = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.includes('const [blurOverlay, setBlurOverlay] = useState(false);')) {
    out.push(line);
    out.push('      const isSubmittingRef = useRef(false);');
    out.push('      const isBlockedRef = useRef(false);');
    continue;
  }

  if (line.includes('if (isBlocked || isSubmitting) return;')) {
    out.push('        if (isBlockedRef.current || isSubmittingRef.current) return;');
    continue;
  }

  if (line.includes('if (res.terblokir) {')) {
    out.push(line);
    out.push('            setIsBlocked(true);');
    out.push('            isBlockedRef.current = true;');
    i++; // skip the original setIsBlocked(true);
    continue;
  }

  if (line.includes('const executeSubmitExam = async (isAuto = false) => {')) {
    out.push(line);
    out.push('          setConfirmModal({ isOpen: false });');
    out.push('          if (isSubmittingRef.current) return;');
    out.push('  ');
    out.push('          isSubmittingRef.current = true;');
    out.push('          setIsSubmitting(true);');
    out.push('          setIsLoading(true);');
    
    // Skip old lines
    while (!lines[i+1].includes('const formattedJawaban =')) {
      i++;
    }
    continue;
  }

  if (line.includes('const handleVisibilityChange = () => {')) {
    out.push('      const triggerViolationImmediate = () => {');
    out.push('         if (!isSubmittingRef.current && !isBlockedRef.current && navigator.onLine) {');
    out.push('            reportViolation();');
    out.push('            enforceFullscreen();');
    out.push('         }');
    out.push('      };');
    out.push('');
    out.push('      const handleVisibilityChange = () => {');
    out.push('        if (document.hidden) {');
    out.push('          gracePeriodTimer.current = setTimeout(() => {');
    out.push('            triggerViolationImmediate();');
    out.push('          }, 2000);');
    out.push('        } else {');
    out.push('          if (gracePeriodTimer.current) {');
    out.push('            clearTimeout(gracePeriodTimer.current);');
    out.push('            gracePeriodTimer.current = null;');
    out.push('          }');
    out.push('        }');
    out.push('      };');
    out.push('');
    out.push('      const handleFullscreenChange = () => {');
    out.push('        if (!document.fullscreenElement) {');
    out.push('          triggerViolationImmediate();');
    out.push('        }');
    out.push('      };');
    out.push('');
    out.push('      const handleWindowBlur = () => {');
    out.push('        triggerViolationImmediate();');
    out.push('      };');
    out.push('');
    out.push('      const handleResize = () => {');
    out.push('        const activeElement = document.activeElement;');
    out.push('        const isInput = activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA");');
    out.push('        if (!isInput && window.innerHeight < window.screen.height * 0.70) {');
    out.push('             triggerViolationImmediate();');
    out.push('        }');
    out.push('      };');
    out.push('');
    out.push('      const setupAntiCheat = () => {');
    out.push('        if (jadwal.browser_lockdown) {');
    out.push('          document.addEventListener("visibilitychange", handleVisibilityChange);');
    out.push('          document.addEventListener("fullscreenchange", handleFullscreenChange);');
    out.push('          window.addEventListener("blur", handleWindowBlur);');
    out.push('          window.addEventListener("resize", handleResize);');
    out.push('        }');
    out.push('      };');
    
    // Skip old lines until enforceFullscreen
    while (!lines[i+1].includes('const enforceFullscreen = () => {')) {
      i++;
    }
    continue;
  }

  if (line.includes("document.removeEventListener('fullscreenchange', handleFullscreenChange);")) {
    out.push(line);
    out.push("        window.removeEventListener('blur', handleWindowBlur);");
    out.push("        window.removeEventListener('resize', handleResize);");
    continue;
  }

  if (line.includes('<button onClick={requestSubmit} className="bg-error text-white text-xs font-bold px-4 py-2 rounded-full shadow-md shadow-error/20 hover:bg-error/90 active:scale-95 transition-all">Selesai</button>')) {
    out.push('                 <button onClick={requestSubmit} className="bg-error dark:bg-error-container text-white dark:text-on-error-container text-xs font-bold px-4 py-2 rounded-full shadow-md shadow-error/20 hover:opacity-90 active:scale-95 transition-all border border-error/50 dark:border-error-container/50">Selesai</button>');
    continue;
  }

  out.push(line);
}

fs.writeFileSync('src/views/ExamRoom.jsx', out.join('\\n'));
console.log("ExamRoom successfully patched via clean array loop!");
