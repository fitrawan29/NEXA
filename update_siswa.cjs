const fs = require('fs');
let content = fs.readFileSync('views/ExamRoom.js', 'utf-8');

// 1. Add Network Indicator & Autosave
const setupLogic = `    // Prevent back button
    useEffect(() => {
      window.history.pushState(null, '', window.location.href);
      window.onpopstate = () => window.history.pushState(null, '', window.location.href);
      return () => { window.onpopstate = null; };
    }, []);`;

const newSetupLogic = `    // Prevent back button
    useEffect(() => {
      window.history.pushState(null, '', window.location.href);
      window.onpopstate = () => window.history.pushState(null, '', window.location.href);
      return () => { window.onpopstate = null; };
    }, []);

    // Indikator Jaringan & Prevent Refresh
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    useEffect(() => {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      const handleBeforeUnload = (e) => {
        if (statusUjian === 'SEDANG KERJA') {
          e.preventDefault();
          e.returnValue = 'Data ujian mungkin tidak tersimpan jika Anda memuat ulang halaman!';
        }
      };
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }, [statusUjian]);

    // Autosave Jawaban
    useEffect(() => {
      if (statusUjian !== 'SEDANG KERJA') return;
      const intervalId = setInterval(() => {
        localStorage.setItem('nexa_draft_jawaban_' + logUjian?.id_log, JSON.stringify(jawaban));
      }, 10000);
      return () => clearInterval(intervalId);
    }, [jawaban, statusUjian, logUjian]);
    
    // Load autosave on init
    useEffect(() => {
      if (statusUjian === 'SEDANG KERJA' && logUjian && jawaban.length > 0) {
        const saved = localStorage.getItem('nexa_draft_jawaban_' + logUjian.id_log);
        if (saved && !isSaved) {
           try {
              const parsed = JSON.parse(saved);
              setJawaban(parsed);
           } catch(e) {}
        }
      }
    }, []);
`;
content = content.replace(setupLogic, newSetupLogic);

// 2. Add Network Indicator in UI Header
const headerHTML = `<header className="bg-surface dark:bg-slate-800 border-b border-outline-variant/50 dark:border-slate-700 p-4 sticky top-0 z-40 flex items-center justify-between">`;
const newHeaderHTML = `<header className="bg-surface dark:bg-slate-800 border-b border-outline-variant/50 dark:border-slate-700 p-4 sticky top-0 z-40 flex items-center justify-between">
            {!isOnline && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-4 py-1 bg-error text-white rounded-full text-xs font-bold animate-pulse shadow-lg flex items-center gap-1 z-50">
                <span className="material-symbols-outlined text-[16px]">wifi_off</span> Koneksi Terputus
              </div>
            )}
`;
content = content.replace(headerHTML, newHeaderHTML);

// 3. Update Drawer width for mobile touch friendly
// The drawer map looks like `<div className={\`fixed inset-y-0 right-0 w-80 bg-surface dark:bg-slate-800 shadow-2xl...`
const drawerRegex = /fixed inset-y-0 right-0 w-64/g; // Wait, let's just find the w- class
// Better approach:
content = content.replace(/w-64 sm:w-80/g, 'w-80 sm:w-96'); 
content = content.replace(/w-72/g, 'w-[85vw] max-w-sm'); 
content = content.replace(/grid-cols-4 sm:grid-cols-5/g, 'grid-cols-5 sm:grid-cols-6 gap-3'); // Make grid a bit more touch friendly

fs.writeFileSync('views/ExamRoom.js', content, 'utf-8');
console.log('Update ExamRoom.js selesai!');
