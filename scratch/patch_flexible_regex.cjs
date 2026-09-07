const fs = require('fs');

let code = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8');

// executeSubmitExam
code = code.replace(/const executeSubmitExam = async \(isAuto = false\) => \{\s*setConfirmModal\(\{ isOpen: false \}\);\s*if \(isSubmitting\) return;\s*setIsSubmitting\(true\);\s*setIsLoading\(true\);/g, 
\`const executeSubmitExam = async (isAuto = false) => {
        setConfirmModal({ isOpen: false });
        if (isSubmittingRef.current) return;

        isSubmittingRef.current = true;
        setIsSubmitting(true);
        setIsLoading(true);\`);

// reportViolation
code = code.replace(/const reportViolation = async \(\) => \{\s*if \(isBlocked \|\| isSubmitting\) return;/g, 
\`const reportViolation = async () => {
        if (isBlockedRef.current || isSubmittingRef.current) return;\`);

code = code.replace(/if \(res\.terblokir\) \{\s*setIsBlocked\(true\);/g, 
\`if (res.terblokir) {
            setIsBlocked(true);
            isBlockedRef.current = true;\`);

// Handlers
const handlersRegex = /const handleVisibilityChange = \(\) => \{[\s\S]*?const setupAntiCheat = \(\) => \{[\s\S]*?\}\s*\};\s*const enforceFullscreen/g;

const newHandlers = \`const triggerViolationImmediate = () => {
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
      };
      
      const enforceFullscreen\`;

code = code.replace(handlersRegex, newHandlers);

// Cleanup
const cleanupRegex = /return \(\) => \{\s*if \(timerInterval\) clearInterval\(timerInterval\);\s*if \(gracePeriodTimer\.current\) clearTimeout\(gracePeriodTimer\.current\);\s*document\.removeEventListener\('visibilitychange', handleVisibilityChange\);\s*document\.removeEventListener\('fullscreenchange', handleFullscreenChange\);\s*\};/g;

const newCleanup = \`return () => {
        if (timerInterval) clearInterval(timerInterval);
        if (gracePeriodTimer.current) clearTimeout(gracePeriodTimer.current);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('resize', handleResize);
      };\`;

code = code.replace(cleanupRegex, newCleanup);

fs.writeFileSync('src/views/ExamRoom.jsx', code);
console.log("ExamRoom handlers replaced via flexible Regex!");
