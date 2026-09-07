const fs = require('fs');
let code = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8');

const p6 = `          return () => {
            clearInterval(timerInterval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);`;
            
const r6 = `          return () => {
            clearInterval(timerInterval);
            if (gracePeriodTimer.current) clearTimeout(gracePeriodTimer.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            window.removeEventListener('blur', handleWindowBlur);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);`;
            
code = code.replace(p6, r6);
code = code.replace(p6.replace(/\\n/g, '\\r\\n'), r6.replace(/\\n/g, '\\r\\n'));

fs.writeFileSync('src/views/ExamRoom.jsx', code);
