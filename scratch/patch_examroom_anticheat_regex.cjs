const fs = require('fs');

let code = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8');

code = code.replace(/const \[blurOverlay, setBlurOverlay\] = useState\(false\);/, 
  "const [blurOverlay, setBlurOverlay] = useState(false);\n      const isSubmittingRef = useRef(false);\n      const isBlockedRef = useRef(false);");

code = code.replace(/const executeSubmitExam = async \(isAuto = false\) => \{\s*setConfirmModal\(\{ isOpen: false \}\);\s*if \(isSubmitting\) return;\s*setIsSubmitting\(true\);\s*setIsLoading\(true\);/, 
  "const executeSubmitExam = async (isAuto = false) => {\n          setConfirmModal({ isOpen: false });\n          if (isSubmittingRef.current) return;\n  \n          isSubmittingRef.current = true;\n          setIsSubmitting(true);\n          setIsLoading(true);");

code = code.replace(/const handleBlurOverlay = \(\) => \{\s*if \(!isSubmitting && !isBlocked && !isOffline && jadwal\.browser_lockdown\) \{\s*setBlurOverlay\(true\);\s*reportViolation\(\);\s*\}\s*\};/, 
  "const handleBlurOverlay = () => {\n         if (!isSubmittingRef.current && !isBlockedRef.current && navigator.onLine && jadwal.browser_lockdown) {\n            setBlurOverlay(true);\n            reportViolation();\n         }\n      };");

code = code.replace(/if \(isBlocked \|\| isSubmitting\) return;/, "if (isBlockedRef.current || isSubmittingRef.current) return;");
code = code.replace(/setIsBlocked\(true\);/, "setIsBlocked(true); isBlockedRef.current = true;");

code = code.replace(/const setupAntiCheat = \(\) => \{\s*if \(jadwal\.browser_lockdown\) \{\s*document\.addEventListener\('visibilitychange', handleVisibilityChange\);\s*document\.addEventListener\('fullscreenchange', handleFullscreenChange\);\s*window\.addEventListener\('blur', handleWindowBlur\);\s*\}\s*\};/, 
  "const handleResize = () => {\n        const activeElement = document.activeElement;\n        const isInput = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');\n        if (!isInput && window.innerHeight < window.screen.height * 0.70) {\n             handleBlurOverlay();\n        }\n      };\n\n      const setupAntiCheat = () => {\n        if (jadwal.browser_lockdown) {\n          document.addEventListener('visibilitychange', handleVisibilityChange);\n          document.addEventListener('fullscreenchange', handleFullscreenChange);\n          window.addEventListener('blur', handleWindowBlur);\n          window.addEventListener('resize', handleResize);\n        }\n      };");

code = code.replace(/window\.removeEventListener\('blur', handleWindowBlur\);/, 
  "window.removeEventListener('blur', handleWindowBlur);\n          window.removeEventListener('resize', handleResize);");

code = code.replace(/<button onClick=\{requestSubmit\} className="bg-error text-white text-xs font-bold px-4 py-2 rounded-full shadow-md shadow-error\/20 hover:bg-error\/90 active:scale-95 transition-all">Selesai<\/button>/, 
  '<button onClick={requestSubmit} className="bg-error dark:bg-error-container text-white dark:text-on-error-container text-xs font-bold px-4 py-2 rounded-full shadow-md shadow-error/20 hover:opacity-90 active:scale-95 transition-all border border-error/50 dark:border-error-container/50">Selesai</button>');

fs.writeFileSync('src/views/ExamRoom.jsx', code);
console.log("Anti cheat and closure issues patched in ExamRoom with proper string replacement!");
