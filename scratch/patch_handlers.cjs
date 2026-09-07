const fs = require('fs');

let code = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8');

// 1. Add Refs
let searchString = 'const [blurOverlay, setBlurOverlay] = useState(false);';
let newString = 'const [blurOverlay, setBlurOverlay] = useState(false);\n      const isSubmittingRef = useRef(false);\n      const isBlockedRef = useRef(false);';
code = code.replace(searchString, newString);

// 2. executeSubmitExam
searchString = `      const executeSubmitExam = async (isAuto = false) => {
        setConfirmModal({ isOpen: false });
        if (isSubmitting) return;

        setIsSubmitting(true);
        setIsLoading(true);`;
newString = `      const executeSubmitExam = async (isAuto = false) => {
        setConfirmModal({ isOpen: false });
        if (isSubmittingRef.current) return;

        isSubmittingRef.current = true;
        setIsSubmitting(true);
        setIsLoading(true);`;
code = code.replace(searchString, newString);

// 3. reportViolation
searchString = `      const reportViolation = async () => {
        if (isBlocked || isSubmitting) return;`;
newString = `      const reportViolation = async () => {
        if (isBlockedRef.current || isSubmittingRef.current) return;`;
code = code.replace(searchString, newString);

searchString = `          if (res.terblokir) {
            setIsBlocked(true);`;
newString = `          if (res.terblokir) {
            setIsBlocked(true);
            isBlockedRef.current = true;`;
code = code.replace(searchString, newString);

// 4. Handlers
searchString = `      const handleVisibilityChange = () => {
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
      };`;
      
newString = `      const triggerViolationImmediate = () => {
         if (!isSubmittingRef.current && !isBlockedRef.current && navigator.onLine) {
            reportViolation();
            enforceFullscreen();
         }
      };

      const handleVisibilityChange = () => {
        if (document.hidden) {
          gracePeriodTimer.current = setTimeout(() => {
            triggerViolationImmediate();
          }, 2000); // reduced from 10s to 2s to be stricter
        } else {
          if (gracePeriodTimer.current) {
            clearTimeout(gracePeriodTimer.current);
            gracePeriodTimer.current = null;
          }
        }
      };

      const handleFullscreenChange = () => {
        if (!document.fullscreenElement) {
          triggerViolationImmediate();
        }
      };

      const handleWindowBlur = () => {
        triggerViolationImmediate();
      };

      const handleResize = () => {
        const activeElement = document.activeElement;
        const isInput = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
        if (!isInput && window.innerHeight < window.screen.height * 0.70) {
             triggerViolationImmediate();
        }
      };

      const setupAntiCheat = () => {
        if (jadwal.browser_lockdown) {
          document.addEventListener('visibilitychange', handleVisibilityChange);
          document.addEventListener('fullscreenchange', handleFullscreenChange);
          window.addEventListener('blur', handleWindowBlur);
          window.addEventListener('resize', handleResize);
        }
      };`;

code = code.replace(searchString, newString);

// 5. Cleanup
searchString = `      return () => {
        if (timerInterval) clearInterval(timerInterval);
        if (gracePeriodTimer.current) clearTimeout(gracePeriodTimer.current);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
      };`;

newString = `      return () => {
        if (timerInterval) clearInterval(timerInterval);
        if (gracePeriodTimer.current) clearTimeout(gracePeriodTimer.current);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('resize', handleResize);
      };`;

code = code.replace(searchString, newString);

// 6. Button
searchString = `<button onClick={requestSubmit} className="bg-error text-white text-xs font-bold px-4 py-2 rounded-full shadow-md shadow-error/20 hover:bg-error/90 active:scale-95 transition-all">Selesai</button>`;
newString = `<button onClick={requestSubmit} className="bg-error dark:bg-error-container text-white dark:text-on-error-container text-xs font-bold px-4 py-2 rounded-full shadow-md shadow-error/20 hover:opacity-90 active:scale-95 transition-all border border-error/50 dark:border-error-container/50">Selesai</button>`;
code = code.replace(searchString, newString);

fs.writeFileSync('src/views/ExamRoom.jsx', code);
console.log("ExamRoom anti-cheat successfully patched with exact string replacements!");
