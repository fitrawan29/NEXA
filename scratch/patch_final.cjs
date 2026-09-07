const fs = require('fs');
let code = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8');

// 1. Add Refs
const p1 = `const [blurOverlay, setBlurOverlay] = useState(false);`;
const r1 = `const [blurOverlay, setBlurOverlay] = useState(false);\n      const isSubmittingRef = useRef(false);\n      const isBlockedRef = useRef(false);`;
code = code.replace(p1, r1);

// 2. reportViolation
const p2 = `if (isBlocked || isSubmitting) return;`;
const r2 = `if (isBlockedRef.current || isSubmittingRef.current) return;`;
code = code.replace(p2, r2);

const p3 = `if (res.terblokir) {\n            setIsBlocked(true);`;
const r3 = `if (res.terblokir) {\n            setIsBlocked(true);\n            isBlockedRef.current = true;`;
code = code.replace(p3, r3);
// In case \r\n
const p3b = `if (res.terblokir) {\r\n            setIsBlocked(true);`;
const r3b = `if (res.terblokir) {\r\n            setIsBlocked(true);\r\n            isBlockedRef.current = true;`;
code = code.replace(p3b, r3b);

// 3. executeSubmitExam
const p4 = `      const executeSubmitExam = async (isAuto = false) => {
        setConfirmModal({ isOpen: false });
        if (isSubmitting) return;

        setIsSubmitting(true);
        setIsLoading(true);`;
const r4 = `      const executeSubmitExam = async (isAuto = false) => {
        setConfirmModal({ isOpen: false });
        if (isSubmittingRef.current) return;

        isSubmittingRef.current = true;
        setIsSubmitting(true);
        setIsLoading(true);`;
code = code.replace(p4, r4);
const p4b = p4.replace(/\n/g, '\r\n');
const r4b = r4.replace(/\n/g, '\r\n');
code = code.replace(p4b, r4b);

// 4. Handlers
const p5 = `      const handleVisibilityChange = () => {
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
const r5 = `      const triggerViolationImmediate = () => {
         if (!isSubmittingRef.current && !isBlockedRef.current && navigator.onLine) {
            reportViolation();
            enforceFullscreen();
         }
      };

      const handleVisibilityChange = () => {
        if (document.hidden) {
          gracePeriodTimer.current = setTimeout(() => {
            triggerViolationImmediate();
          }, 2000);
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
code = code.replace(p5, r5);
const p5b = p5.replace(/\n/g, '\r\n');
const r5b = r5.replace(/\n/g, '\r\n');
code = code.replace(p5b, r5b);

// 5. Cleanup
const p6 = `      return () => {
        if (timerInterval) clearInterval(timerInterval);
        if (gracePeriodTimer.current) clearTimeout(gracePeriodTimer.current);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
      };`;
const r6 = `      return () => {
        if (timerInterval) clearInterval(timerInterval);
        if (gracePeriodTimer.current) clearTimeout(gracePeriodTimer.current);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('resize', handleResize);
      };`;
code = code.replace(p6, r6);
const p6b = p6.replace(/\n/g, '\r\n');
const r6b = r6.replace(/\n/g, '\r\n');
code = code.replace(p6b, r6b);

// 6. Selesai Button
const p7 = `<button onClick={requestSubmit} className="bg-error text-white text-xs font-bold px-4 py-2 rounded-full shadow-md shadow-error/20 hover:bg-error/90 active:scale-95 transition-all">Selesai</button>`;
const r7 = `<button onClick={requestSubmit} className="bg-error dark:bg-error-container text-white dark:text-on-error-container text-xs font-bold px-4 py-2 rounded-full shadow-md shadow-error/20 hover:opacity-90 active:scale-95 transition-all border border-error/50 dark:border-error-container/50">Selesai</button>`;
code = code.replace(p7, r7);

fs.writeFileSync('src/views/ExamRoom.jsx', code);
console.log('Done!');
