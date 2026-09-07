const fs = require('fs');
let code = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8');

const regex = /return \(\) => \{\s*clearInterval\(timerInterval\);\s*document\.removeEventListener\('visibilitychange', handleVisibilityChange\);\s*document\.removeEventListener\('fullscreenchange', handleFullscreenChange\);\s*window\.removeEventListener\('online', handleOnline\);\s*window\.removeEventListener\('offline', handleOffline\);/g;

const repl = "return () => {\n            clearInterval(timerInterval);\n            if (gracePeriodTimer.current) clearTimeout(gracePeriodTimer.current);\n            document.removeEventListener('visibilitychange', handleVisibilityChange);\n            document.removeEventListener('fullscreenchange', handleFullscreenChange);\n            window.removeEventListener('blur', handleWindowBlur);\n            window.removeEventListener('resize', handleResize);\n            window.removeEventListener('online', handleOnline);\n            window.removeEventListener('offline', handleOffline);";

code = code.replace(regex, repl);
fs.writeFileSync('src/views/ExamRoom.jsx', code);
