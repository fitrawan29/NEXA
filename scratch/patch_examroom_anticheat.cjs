const fs = require('fs');

let code = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8');

// 1. Add Refs for stale closure
const oldStateBlock = `const [isDrawerOpen, setIsDrawerOpen] = useState(false);
      const [blurOverlay, setBlurOverlay] = useState(false);`;

const newStateBlock = `const [isDrawerOpen, setIsDrawerOpen] = useState(false);
      const [blurOverlay, setBlurOverlay] = useState(false);
      const isSubmittingRef = useRef(false);
      const isBlockedRef = useRef(false);`;
code = code.replace(oldStateBlock, newStateBlock);

// 2. Fix executeSubmitExam
const oldSubmitLogic = `const executeSubmitExam = async (isAuto = false) => {
          setConfirmModal({ isOpen: false });
          if (isSubmitting) return;
  
          setIsSubmitting(true);
          setIsLoading(true);`;

const newSubmitLogic = `const executeSubmitExam = async (isAuto = false) => {
          setConfirmModal({ isOpen: false });
          if (isSubmittingRef.current) return;
  
          isSubmittingRef.current = true;
          setIsSubmitting(true);
          setIsLoading(true);`;
code = code.replace(oldSubmitLogic, newSubmitLogic);

// 3. Fix handleBlurOverlay to use Refs and also catch resize if not focusing input
const oldBlurOverlay = `const handleBlurOverlay = () => {
         if (!isSubmitting && !isBlocked && !isOffline && jadwal.browser_lockdown) {
            setBlurOverlay(true);
            reportViolation();
         }
      };`;

const newBlurOverlay = `const handleBlurOverlay = () => {
         if (!isSubmittingRef.current && !isBlockedRef.current && navigator.onLine && jadwal.browser_lockdown) {
            setBlurOverlay(true);
            reportViolation();
         }
      };`;
code = code.replace(oldBlurOverlay, newBlurOverlay);

// 4. Update reportViolation to use isBlockedRef
const oldReportViolation = `if (isBlocked || isSubmitting) return;`;
const newReportViolation = `if (isBlockedRef.current || isSubmittingRef.current) return;`;
code = code.replace(oldReportViolation, newReportViolation);

const oldSetBlocked = `setIsBlocked(true);`;
const newSetBlocked = `setIsBlocked(true); isBlockedRef.current = true;`;
code = code.replace(oldSetBlocked, newSetBlocked);

// 5. Add Resize listener to setupAntiCheat to aggressively catch split screen
// If innerHeight drops significantly and activeElement is not an input
const oldSetupAntiCheat = `const setupAntiCheat = () => {
        if (jadwal.browser_lockdown) {
          document.addEventListener('visibilitychange', handleVisibilityChange);
          document.addEventListener('fullscreenchange', handleFullscreenChange);
          window.addEventListener('blur', handleWindowBlur);
        }
      };`;

const newSetupAntiCheat = `const handleResize = () => {
        // Detect aggressive split screen or floating keyboard.
        // We only trigger violation if it's a huge drop in height and they aren't typing
        const activeElement = document.activeElement;
        const isInput = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
        if (!isInput) {
            // Check if window is significantly smaller than screen
            if (window.innerHeight < window.screen.height * 0.65) {
               handleBlurOverlay();
            }
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
code = code.replace(oldSetupAntiCheat, newSetupAntiCheat);

const oldCleanup = `window.removeEventListener('blur', handleWindowBlur);`;
const newCleanup = `window.removeEventListener('blur', handleWindowBlur);
          window.removeEventListener('resize', handleResize);`;
code = code.replace(oldCleanup, newCleanup);

// 6. Fix Exit Button Theme (Selesai button on top bar)
const oldTopSelesai = `<button onClick={requestSubmit} className="bg-error text-white text-xs font-bold px-4 py-2 rounded-full shadow-md shadow-error/20 hover:bg-error/90 active:scale-95 transition-all">Selesai</button>`;
const newTopSelesai = `<button onClick={requestSubmit} className="bg-error dark:bg-error-container text-white dark:text-on-error-container text-xs font-bold px-4 py-2 rounded-full shadow-md shadow-error/20 hover:opacity-90 active:scale-95 transition-all border border-error/50 dark:border-error-container/50">Selesai</button>`;
code = code.replace(oldTopSelesai, newTopSelesai);

fs.writeFileSync('src/views/ExamRoom.jsx', code);
console.log("Anti cheat and closure issues patched in ExamRoom!");
