const fs = require('fs');

let code = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8');

// 1. Add Refs
const oldStateBlock = `const [confirmModal, setConfirmModal] = useState({ isOpen: false });
      const [isDrawerOpen, setIsDrawerOpen] = useState(false);
      const [blurOverlay, setBlurOverlay] = useState(false);
      const isSubmittingRef = useRef(false);
      const isBlockedRef = useRef(false);`;
code = code.replace(oldStateBlock, `const [confirmModal, setConfirmModal] = useState({ isOpen: false });
      const [isDrawerOpen, setIsDrawerOpen] = useState(false);
      const isSubmittingRef = useRef(false);
      const isBlockedRef = useRef(false);`);
      
// Wait, my previous failed patches might have left the state block modified. 
// Let's replace just confirmModal line
code = code.replace(/const \[confirmModal, setConfirmModal\] = useState\(\{ isOpen: false \}\);/, 
  "const [confirmModal, setConfirmModal] = useState({ isOpen: false });\n      const isSubmittingRef = useRef(false);\n      const isBlockedRef = useRef(false);");

// Clean up any double additions
code = code.replace(/const isSubmittingRef = useRef\(false\);\s*const isBlockedRef = useRef\(false\);\s*const isSubmittingRef = useRef\(false\);\s*const isBlockedRef = useRef\(false\);/g, "const isSubmittingRef = useRef(false);\n      const isBlockedRef = useRef(false);");

// 2. Fix executeSubmitExam
code = code.replace(/const executeSubmitExam = async \(isAuto = false\) => \{\s*setConfirmModal\(\{ isOpen: false \}\);\s*if \(isSubmitting\) return;\s*setIsSubmitting\(true\);\s*setIsLoading\(true\);/, 
  "const executeSubmitExam = async (isAuto = false) => {\n          setConfirmModal({ isOpen: false });\n          if (isSubmittingRef.current) return;\n          isSubmittingRef.current = true;\n          setIsSubmitting(true);\n          setIsLoading(true);");

// 3. Fix reportViolation
code = code.replace(/const reportViolation = async \(\) => \{\s*if \(isBlocked \|\| isSubmitting\) return;/, 
  "const reportViolation = async () => {\n        if (isBlockedRef.current || isSubmittingRef.current) return;");

code = code.replace(/setIsBlocked\(true\);/, "setIsBlocked(true); isBlockedRef.current = true;");

// 4. Update handlers to use Refs and add Window Blur & Resize to aggressively catch split screen and floating apps
const oldHandlers = `      const handleVisibilityChange = () => {
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

const newHandlers = `      const triggerViolationImmediate = () => {
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
      
code = code.replace(oldHandlers, newHandlers);

const oldCleanup = `return () => {
        if (timerInterval) clearInterval(timerInterval);
        if (gracePeriodTimer.current) clearTimeout(gracePeriodTimer.current);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
      };`;
      
const newCleanup = `return () => {
        if (timerInterval) clearInterval(timerInterval);
        if (gracePeriodTimer.current) clearTimeout(gracePeriodTimer.current);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('resize', handleResize);
      };`;
code = code.replace(oldCleanup, newCleanup);

// Replace the top bar button
code = code.replace(/<button onClick=\{requestSubmit\} className="bg-error text-white text-xs font-bold px-4 py-2 rounded-full shadow-md shadow-error\/20 hover:bg-error\/90 active:scale-95 transition-all">Selesai<\/button>/, 
  '<button onClick={requestSubmit} className="bg-error dark:bg-error-container text-white dark:text-on-error-container text-xs font-bold px-4 py-2 rounded-full shadow-md shadow-error/20 hover:opacity-90 active:scale-95 transition-all border border-error/50 dark:border-error-container/50">Selesai</button>');

fs.writeFileSync('src/views/ExamRoom.jsx', code);
console.log("ExamRoom anti-cheat correctly patched!");
