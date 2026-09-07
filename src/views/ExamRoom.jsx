import { fetchAPI } from '../api.js';
import React, { useState, useEffect, useRef } from 'react';
import Loader from '../components/Loader.jsx';
import Modal from '../components/Modal.jsx';
﻿
function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
function seededShuffle(array, seed) {
  let rand = mulberry32(seed);
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(rand() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

const ExamRoom = ({ user, jadwal, idLog, showMessage, onFinish, isDarkMode, setIsDarkMode }) => {
      const api = (action, p = {}) => {
        if (Array.isArray(p)) return fetchAPI(action, p.map(item => ({ ...item, npsn: user.npsn })));
        return fetchAPI(action, { ...p, npsn: user.npsn });
      };
      const [soal, setSoal] = useState([]);
      const [narasiMap, setNarasiMap] = useState({});
      const [jawabanSiswa, setJawabanSiswa] = useState(() => {
        const saved = localStorage.getItem(`nexa_ans_${idLog}`);
        return saved ? window.safeJSONParse(saved, {}) : {};
      });
      const [raguRagu, setRaguRagu] = useState({});
      const [currentIndex, setCurrentIndex] = useState(0);
      const [isLoading, setIsLoading] = useState(true);
      const [violationCount, setViolationCount] = useState(0);
      const [isBlocked, setIsBlocked] = useState(false);

      const [timeLeft, setTimeLeft] = useState({ total: 1, hours: 0, minutes: 0, seconds: 0 });
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [confirmModal, setConfirmModal] = useState({ isOpen: false });
      const [isDrawerOpen, setIsDrawerOpen] = useState(false);
      const [blurOverlay, setBlurOverlay] = useState(false);
      const isSubmittingRef = useRef(false);
      const isBlockedRef = useRef(false);

      const [isOffline, setIsOffline] = useState(!navigator.onLine);
      const [offlineCountdown, setOfflineCountdown] = useState(15);
      const offlineIntervalRef = useRef(null);
      const gracePeriodTimer = useRef(null);

      const examContainerRef = useRef(null);

      useEffect(() => {
        fetchSoal();
        let wakeLock = null;
        const requestWakeLock = async () => {
          try {
            if ('wakeLock' in navigator) {
              wakeLock = await navigator.wakeLock.request('screen');
            }
          } catch (err) {}
        };
        requestWakeLock();
        setupAntiCheat();

        const calculateTimeLeft = (endTimeStr) => {
          const diff = new Date(endTimeStr).getTime() - new Date().getTime();
          if (diff <= 0) return { total: 0, hours: 0, minutes: 0, seconds: 0 };
          return {
            total: diff,
            hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((diff / 1000 / 60) % 60),
            seconds: Math.floor((diff / 1000) % 60)
          };
        };

        const timerInterval = setInterval(() => {
          const remaining = calculateTimeLeft(jadwal.waktu_selesai);
          setTimeLeft(remaining);

          if (remaining.total <= 0 && !isSubmitting && !isBlocked) {
            clearInterval(timerInterval);
            showMessage('Waktu Habis!', 'Waktu ujian telah berakhir. Sistem mengumpulkan jawaban otomatis.', 'warning');
            executeSubmitExam(true);
          }
        }, 1000);

        const handleOnline = () => {
           setIsOffline(false);
           if (offlineIntervalRef.current) clearInterval(offlineIntervalRef.current);
           setOfflineCountdown(15);
        };
        const handleOffline = () => setIsOffline(true);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            clearInterval(timerInterval);
            if (gracePeriodTimer.current) clearTimeout(gracePeriodTimer.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            window.removeEventListener('blur', handleWindowBlur);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
          if (wakeLock) wakeLock.release().catch(()=>{});
        };
      }, []);

      useEffect(() => {
         if (isOffline) {
            offlineIntervalRef.current = setInterval(() => {
               setOfflineCountdown(prev => {
                  if (prev <= 1) {
                     reportViolation(); 
                     return 15;
                  }
                  return prev - 1;
               });
            }, 1000);
         } else {
            if (offlineIntervalRef.current) clearInterval(offlineIntervalRef.current);
         }
         return () => {
            if (offlineIntervalRef.current) clearInterval(offlineIntervalRef.current);
         }
      }, [isOffline]);

      useEffect(() => {
        if (window.MathJax) {
          setTimeout(() => {
            window.MathJax.typesetPromise().catch(err => console.error('MathJax error:', err));
          }, 100);
        }
      }, [currentIndex, soal]);


      const fetchSoal = async () => {
        const res = await api('get_soal_ujian', { id_jadwal: jadwal.id_jadwal });
        if (res.status === 'success') {
          let parsedSoal = res.data.map(s => {
            let parsedOpsi = null;
            if (s.opsi) {
              try { parsedOpsi = JSON.parse(s.opsi); } catch (e) { parsedOpsi = s.opsi; }
            }
            const seed = (user.id_user ? user.id_user.toString().charCodeAt(0) : 1) + (jadwal.id_jadwal * 10);
            if (jadwal.acak_opsi && parsedOpsi && (s.tipe_soal === 'PG' || s.tipe_soal === 'PGK')) {
              seededShuffle(parsedOpsi, seed + (s.id_soal || 0));
            }
            return { ...s, opsi: parsedOpsi };
          });

          if (jadwal.acak_soal) {
            const seed = (user.id_user ? user.id_user.toString().charCodeAt(0) : 1) + (jadwal.id_jadwal * 10);
            seededShuffle(parsedSoal, seed);
          }

          setSoal(parsedSoal);
          if (res.narasiMap) setNarasiMap(res.narasiMap);
        }
        setIsLoading(false);
      };

      const reportViolation = async () => {
        if (isBlockedRef.current || isSubmittingRef.current) return;

        const res = await api('catat_pelanggaran', { id_log: idLog });
        if (res.status === 'success') {
          setViolationCount(res.pelanggaran_saat_ini);
          if (res.terblokir) {
            setIsBlocked(true);
            isBlockedRef.current = true;
            if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
            showMessage('TERBLOKIR!', 'Akun Anda diblokir karena meninggalkan halaman ujian lebih dari 3 kali. Hubungi pengawas.', 'error');
            setTimeout(onFinish, 5000);
          } else {
            showMessage('Peringatan Keamanan!', `Sistem mendeteksi Anda keluar dari halaman ujian! Ini pelanggaran ke-${res.pelanggaran_saat_ini} dari maksimal 3.`, 'warning');
          }
        }
      };

      const triggerViolationImmediate = () => {
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

      const setupAntiCheat = () => {
        if (jadwal.browser_lockdown) {
          document.addEventListener('visibilitychange', handleVisibilityChange);
          document.addEventListener('fullscreenchange', handleFullscreenChange);
          window.addEventListener('blur', handleWindowBlur);
          }
      };

      const enforceFullscreen = () => {
        if (jadwal.browser_lockdown && !isBlocked && document.documentElement.requestFullscreen && !document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => { });
        }
      };

      const handleAnswerChange = (soalId, value, tipe, parentKey = null) => {
        setJawabanSiswa(prev => {
          let newAns = prev;
          if (tipe === 'PGK') {
            let arr = Array.isArray(prev[soalId]) ? [...prev[soalId]] : [];
            if (arr.includes(value)) arr = arr.filter(item => item !== value);
            else arr.push(value);
            newAns = { ...prev, [soalId]: arr };
          } else if (tipe === 'JODOH' && parentKey) {
            const currentObj = typeof prev[soalId] === 'object' && !Array.isArray(prev[soalId]) ? { ...prev[soalId] } : {};
            currentObj[parentKey] = value;
            newAns = { ...prev, [soalId]: currentObj };
          } else {
            newAns = { ...prev, [soalId]: value };
          }
          // Offline-First: Save answer to localStorage
          localStorage.setItem(`nexa_ans_${idLog}`, JSON.stringify(newAns));
          return newAns;
        });
      };

      const toggleRaguRagu = (soalId) => {
        setRaguRagu(prev => ({ ...prev, [soalId]: !prev[soalId] }));
      };

      const requestSubmit = () => {
        setConfirmModal({ isOpen: true });
      };

      const executeSubmitExam = async (isAuto = false) => {
        setConfirmModal({ isOpen: false });
        if (isSubmittingRef.current) return;

        isSubmittingRef.current = true;
        setIsSubmitting(true);
        setIsLoading(true);

        const formattedJawaban = Object.keys(jawabanSiswa).map(key => ({
          id_soal: key,
          jawaban: jawabanSiswa[key]
        }));

        const res = await api('submit_ujian', {
          id_log: idLog,
          id_jadwal: jadwal.id_jadwal,
          id_siswa: user.id_user,
          jawaban: formattedJawaban
        });

        if (document.fullscreenElement) document.exitFullscreen().catch(() => { });

        if (res.status === 'success') {
          showMessage('Ujian Selesai', `Terima kasih! Skor pilihan ganda/objektif Anda: ${res.nilai_auto}. Soal uraian dinilai terpisah oleh guru.`, 'success');
          setTimeout(onFinish, 4000);
        } else {
          showMessage('Gagal Mengumpulkan', res.message, 'error');
          setIsLoading(false);
          setIsSubmitting(false);
        }
      };

      const renderQuestionInput = (s) => {
        const currentAns = jawabanSiswa[s.id_soal] || '';

        switch (s.tipe_soal) {
          case 'PG':
            case 'BS':
              return (s.opsi || []).map((op, idx) => {
                const isSelected = currentAns === op;
                const letter = String.fromCharCode(65 + idx);
                return (
                  <label key={idx} className={`relative flex items-start p-4 rounded-2xl cursor-pointer transition-all border-2 ${isSelected ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-md shadow-primary/10' : 'border-slate-100 dark:border-slate-700 hover:border-primary/30 bg-white dark:bg-slate-800'}`}>
                    <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 mt-0.5 shrink-0 transition-colors ${isSelected ? 'border-primary bg-primary' : 'border-slate-300 dark:border-slate-600'}`}>
                       {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-white"></div>}
                    </div>
                    <input type="radio" className="hidden" name={s.id_soal} value={op} checked={isSelected} onChange={() => handleAnswerChange(s.id_soal, op, s.tipe_soal)} />
                    <div className="ml-3 flex-1 min-w-0 flex items-start">
                       {s.tipe_soal === 'PG' && <span className={`font-bold mr-2 mt-0.5 ${isSelected ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}>{letter}.</span>}
                       <div className={`text-[15px] leading-relaxed overflow-x-auto [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg ${isSelected ? 'text-primary-dark dark:text-primary-fixed font-medium' : 'text-slate-700 dark:text-slate-200'}`} dangerouslySetInnerHTML={{ __html: op }}></div>
                    </div>
                  </label>
                );
              });

            case 'PGK':
              return (s.opsi || []).map((op, idx) => {
                const isChecked = Array.isArray(currentAns) && currentAns.includes(op);
                const letter = String.fromCharCode(65 + idx);
                return (
                  <label key={idx} className={`relative flex items-start p-4 rounded-2xl cursor-pointer transition-all border-2 ${isChecked ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-md shadow-primary/10' : 'border-slate-100 dark:border-slate-700 hover:border-primary/30 bg-white dark:bg-slate-800'}`}>
                    <div className={`flex items-center justify-center w-6 h-6 rounded-md border-2 mt-0.5 shrink-0 transition-colors ${isChecked ? 'border-primary bg-primary' : 'border-slate-300 dark:border-slate-600'}`}>
                       {isChecked && <span className="material-symbols-outlined text-white text-[16px] font-bold">check</span>}
                    </div>
                    <input type="checkbox" className="hidden" value={op} checked={isChecked} onChange={() => handleAnswerChange(s.id_soal, op, s.tipe_soal)} />
                    <div className="ml-3 flex-1 min-w-0 flex items-start">
                       <span className={`font-bold mr-2 mt-0.5 ${isChecked ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}>{letter}.</span>
                       <div className={`text-[15px] leading-relaxed overflow-x-auto [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg ${isChecked ? 'text-primary-dark dark:text-primary-fixed font-medium' : 'text-slate-700 dark:text-slate-200'}`} dangerouslySetInnerHTML={{ __html: op }}></div>
                    </div>
                  </label>
                );
              });

            case 'JODOH':
            const premis = s.opsi?.premis || [];
            const respon = s.opsi?.respon || [];
            const ansObj = typeof currentAns === 'object' && !Array.isArray(currentAns) ? currentAns : {};
            return (
              <div className="bg-secondary-container dark:bg-secondary/20 p-md rounded-lg border border-outline-variant dark:border-slate-700">
                <p className="text-on-secondary-container dark:text-secondary-fixed font-label-md text-label-md mb-sm flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">link</span> Pasangkan premis berikut dengan respon yang tepat.</p>
                {premis.map((p, idx) => p && (
                  <div key={idx} className="flex gap-4 items-center mb-2">
                    <span className="flex-1 font-medium">{p}</span>
                    <span className="material-symbols-outlined text-slate-400">arrow_forward</span>
                    <select value={ansObj[p] || ''} onChange={(e) => handleAnswerChange(s.id_soal, e.target.value, s.tipe_soal, p)} className="flex-1 p-2 border rounded bg-surface dark:bg-slate-900 focus:ring-primary">
                      <option value="">Pilih Respon...</option>
                      {respon.map((r, i) => r && <option key={i} value={r}>{r}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            );

          case 'ISIAN':
          case 'URAIAN':
            return (
              <textarea rows={s.tipe_soal === 'URAIAN' ? 8 : 2} placeholder="Ketik jawaban Anda di sini..." value={currentAns} onChange={(e) => handleAnswerChange(s.id_soal, e.target.value, s.tipe_soal)} className="w-full pl-md pr-md py-sm bg-white dark:bg-slate-900 border border-outline-variant dark:border-slate-600 rounded-lg font-body-md text-body-md text-on-surface dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"></textarea>
            );

          default: return <p className="text-error font-bold p-sm bg-error-container/20 rounded">âš ï¸ Tipe soal tidak didukung.</p>;
        }
      };

      if (isLoading) return <div className="min-h-screen bg-background dark:bg-slate-900 flex flex-col items-center justify-center"><Loader text="Menyiapkan Soal dan Enkripsi Sesi..." /></div>;
      if (isBlocked) return (
        <div className="min-h-screen bg-error flex flex-col items-center justify-center space-y-4">
          <span className="material-symbols-outlined text-[80px] text-on-error">block</span>
          <h1 className="text-on-error font-headline-lg text-headline-lg font-bold">AKUN DIBLOKIR</h1>
          <p className="text-on-error font-body-lg text-body-lg">Sistem mendeteksi kecurangan. Hubungi pengawas untuk membuka akses.</p>
        </div>
      );

      const currentS = soal[currentIndex];

      const answeredCount = soal.filter(s => {
        const ans = jawabanSiswa[s.id_soal];
        if (!ans) return false;
        if (s.tipe_soal === 'PGK') return Array.isArray(ans) && ans.length > 0;
        if (s.tipe_soal === 'JODOH') return typeof ans === 'object' && Object.keys(ans).length > 0 && Object.values(ans).some(v => v !== '');
        return String(ans).trim() !== '';
      }).length;
      
      const flaggedCount = Object.values(raguRagu).filter(Boolean).length;
      const unansweredCount = soal.length - answeredCount;

      const renderNavGrid = () => (
        <div className="grid grid-cols-6 gap-sm mb-lg">
          {soal.map((s, idx) => {
            const ans = jawabanSiswa[s.id_soal];
            let hasAnswered = false;
            if (ans) {
              if (s.tipe_soal === 'PGK') hasAnswered = Array.isArray(ans) && ans.length > 0;
              else if (s.tipe_soal === 'JODOH') hasAnswered = typeof ans === 'object' && Object.keys(ans).length > 0 && Object.values(ans).some(v => v !== '');
              else hasAnswered = String(ans).trim() !== '';
            }
            
            const isFlagged = raguRagu[s.id_soal];
            let btnClass = "w-10 h-10 rounded-sm font-mono-label text-mono-label flex items-center justify-center cursor-pointer transition-all ";

            if (currentIndex === idx) {
              btnClass += "bg-gradient-to-r from-primary to-secondary text-on-primary text-on-primary ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900";
            } else if (isFlagged) {
              btnClass += "bg-[#D97706] text-white"; // flagged color
            } else if (hasAnswered) {
              btnClass += "bg-[#10B981] text-white"; // answered color
            } else {
              btnClass += "border border-outline-variant dark:border-slate-700 text-on-surface dark:text-slate-300 hover:border-primary hover:text-primary dark:hover:border-primary-fixed dark:hover:text-primary-fixed bg-white dark:bg-slate-800";
            }

            return (
              <button key={s.id_soal} onClick={() => { setCurrentIndex(idx); setIsDrawerOpen(false); }} className={btnClass}>
                {idx + 1}
              </button>
            );
          })}
        </div>
      );

      const renderLegend = () => (
        <div className="mt-auto pt-md border-t border-outline-variant dark:border-slate-800">
          <div className="flex items-center gap-sm mb-xs">
            <div className="w-4 h-4 bg-[#10B981] rounded-sm"></div>
            <span className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400">Terjawab ({answeredCount})</span>
          </div>
          <div className="flex items-center gap-sm mb-xs">
            <div className="w-4 h-4 bg-[#D97706] rounded-sm"></div>
            <span className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400">Ragu-ragu ({flaggedCount})</span>
          </div>
          <div className="flex items-center gap-sm mb-xs">
            <div className="w-4 h-4 border border-outline-variant dark:border-slate-700 rounded-sm bg-white dark:bg-slate-800"></div>
            <span className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400">Belum ({unansweredCount})</span>
          </div>
        </div>
      );

      return (
        <div className="font-body-md text-body-md text-on-background dark:text-slate-100 bg-background dark:bg-slate-900 h-screen flex flex-col overflow-hidden select-none transition-colors duration-500" ref={examContainerRef} onClick={enforceFullscreen}>
          
          {blurOverlay && (
             <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[150] flex items-center justify-center p-4 transition-all">
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md text-center shadow-2xl border border-error/20 animate-fade-in-up">
                   <div className="w-20 h-20 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-6">
                      <span className="material-symbols-outlined text-[40px]">gavel</span>
                   </div>
                   <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Pelanggaran Terdeteksi!</h2>
                   <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">
                      Anda terdeteksi keluar dari mode layar penuh (Full Screen), pindah tab, atau membuka aplikasi lain. Tindakan ini dicatat sebagai pelanggaran.
                   </p>
                   <button onClick={returnToExam} className="w-full py-4 rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors">
                      Kembali ke Ujian
                   </button>
                </div>
             </div>
          )}

            {isOffline && (
            <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center text-white backdrop-blur-md">
              <span className="material-symbols-outlined text-[80px] text-error mb-4">wifi_off</span>
              <h1 className="text-3xl font-bold mb-2">Koneksi Terputus!</h1>
              <p className="text-lg text-slate-300 mb-6 max-w-md text-center px-4">Ujian dibekukan sementara. Silakan periksa kembali jaringan internet Anda.</p>
              <div className="bg-error/20 border border-error rounded-xl p-6 text-center shadow-lg shadow-error/20">
                 <div className="text-5xl font-black text-error mb-2">{offlineCountdown}</div>
                 <p className="text-sm">detik menuju pelanggaran</p>
              </div>
              <p className="mt-8 text-slate-400 text-sm px-8 text-center">Mohon segera pulihkan koneksi internet (Wi-Fi/Data) untuk melanjutkan.</p>
            </div>
          )}
          {/* TopNavBar */}
          <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-50 flex items-center justify-between px-4 shadow-sm transition-colors duration-500">
              <div className="flex flex-col md:ml-80">
                 <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate max-w-[150px] sm:max-w-xs">{jadwal.nama_mapel}</span>
                 <span className="text-[10px] text-slate-400 dark:text-slate-500">{user.nama_lengkap}</span>
              </div>
              <div className="flex items-center gap-3">
                 <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${timeLeft.total < 300000 ? 'bg-error/10 text-error animate-pulse' : 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-fixed'} font-black text-sm`}>
                   <span className="material-symbols-outlined text-[16px]">timer</span>
                   {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
                 </div>
                 <button onClick={requestSubmit} className="bg-red-600 text-white text-sm font-black px-5 py-2 rounded-full shadow-lg shadow-red-600/30 hover:bg-red-700 active:scale-95 transition-all border border-red-400">SELESAI</button>
              </div>
            </header>

          <div className="flex flex-1 pt-16 h-full">
            {/* SideNavBar */}
            <aside className="hidden md:flex fixed left-0 mt-20 w-80 h-[calc(100vh-80px)] border-r border-outline-variant dark:border-slate-800 bg-surface dark:bg-slate-900 flex-col p-md overflow-y-auto sidebar-scroll z-40 transition-colors duration-500">
              <div className="mb-md">
                <h2 className="font-label-md text-label-md text-on-surface dark:text-white font-bold">Navigasi Soal</h2>
                <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400 font-normal">Klik nomor untuk pindah soal</p>
                {violationCount > 0 && (
                  <p className="font-label-md text-label-md text-error mt-2 font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">warning</span> Pelanggaran: {violationCount} / 3
                  </p>
                )}
              </div>
              {renderNavGrid()}
              {renderLegend()}
            </aside>

            {/* Bottom Drawer (Mobile) */}
            <div className={`md:hidden fixed inset-0 z-50 transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}></div>
              <div className={`absolute bottom-0 w-full bg-white dark:bg-slate-900 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.15)] p-6 pb-12 transition-transform duration-300 ${isDrawerOpen ? 'translate-y-0' : 'translate-y-full'}`}>
                 <div className="w-16 h-1.5 bg-outline-variant dark:bg-slate-700 rounded-full mx-auto mb-6"></div>
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold text-xl text-on-surface dark:text-white">Navigasi Soal</h2>
                    <button onClick={() => setIsDrawerOpen(false)} className="text-slate-500 bg-surface-variant p-2 rounded-full"><span className="material-symbols-outlined">close</span></button>
                 </div>
                 <div className="max-h-[50vh] overflow-y-auto mb-4 p-2">
                    {renderNavGrid()}
                 </div>
                 {renderLegend()}
              </div>
            </div>

            {/* Main Content (Canvas) */}
            <main className="flex-1 md:ml-80 flex flex-col bg-background dark:bg-slate-900 relative overflow-y-auto pb-24 transition-colors duration-500">
              <div className="max-w-[1200px] mx-auto w-full p-md md:p-xl mt-sm md:mt-lg">
                {currentS ? (
                  <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 md:p-8 shadow-sm border border-slate-100 dark:border-slate-700/50 mb-xl animate-fade-in-up">
                      <div className="flex justify-between items-center mb-5 pb-5 border-b border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center gap-4">
                          <div className="bg-gradient-to-br from-primary to-secondary text-white w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-primary/20 shrink-0">
                             {currentIndex + 1}
                          </div>
                          <div className="flex flex-col">
                             <span className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Soal Ke-{currentIndex + 1} dari {soal.length}</span>
                             <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{currentS.tipe_soal} {currentS.bobot ? `• ${currentS.bobot} Poin` : ''}</span>
                          </div>
                        </div>
                      </div>
                      <div className="font-medium text-slate-800 dark:text-slate-100 text-[16px] md:text-[18px] leading-relaxed mb-8 whitespace-pre-wrap [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-2xl [&_img]:my-4 [&_img]:shadow-sm overflow-x-auto" dangerouslySetInnerHTML={{ __html: currentS.pertanyaan }}>
                      </div>
                      <div className="space-y-3">
                        {renderQuestionInput(currentS)}
                      </div>
                    </div>
                ) : (
                  <div className="text-center text-on-surface-variant py-20 font-bold text-xl">Tidak ada soal yang tersedia.</div>
                )}
              </div>

              {/* Bottom Action Bar */}
              {currentS && (
                <div className="fixed bottom-0 md:left-80 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-40 pb-safe transition-colors duration-500">
                   <div className="flex gap-2">
                      <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0} className="w-12 h-12 md:w-auto md:px-5 rounded-2xl flex items-center justify-center gap-2 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-white dark:bg-slate-800">
                         <span className="material-symbols-outlined text-[24px]">chevron_left</span>
                         <span className="hidden md:inline font-bold text-sm">Sebelumnya</span>
                      </button>
                      <button onClick={() => setIsDrawerOpen(true)} className="md:hidden w-12 h-12 rounded-2xl flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors">
                         <span className="material-symbols-outlined text-[20px]">grid_view</span>
                      </button>
                   </div>
                   
                   <div className="flex gap-2 items-center">
                      <button onClick={() => toggleRaguRagu(currentS.id_soal)} className={`h-12 px-4 md:px-5 rounded-2xl flex items-center gap-2 border-2 font-bold text-sm transition-colors ${raguRagu[currentS.id_soal] ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 hover:border-amber-300 hover:text-amber-500'}`}>
                         <span className="material-symbols-outlined text-[20px]">${raguRagu[currentS.id_soal] ? 'check_box' : 'check_box_outline_blank'}</span>
                         <span className="hidden sm:inline">Ragu</span>
                      </button>
                      <button onClick={() => setCurrentIndex(Math.min(soal.length - 1, currentIndex + 1))} disabled={currentIndex === soal.length - 1} className="h-12 px-6 md:px-8 rounded-2xl flex items-center justify-center bg-gradient-to-r from-primary to-secondary text-white font-bold text-sm hover:opacity-90 shadow-lg shadow-primary/30 transition-all disabled:opacity-30 disabled:shadow-none active:scale-95">
                         <span className="md:mr-2">Lanjut</span>
                         <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                      </button>
                   </div>
                </div>
              )}
            </main>
          </div>

          <Modal
            isOpen={confirmModal.isOpen}
            title="Konfirmasi Pengumpulan"
            message={`Anda telah menjawab ${answeredCount} dari ${soal.length} soal. Yakin ingin mengumpulkan ujian sekarang? Waktu Anda masih tersisa. Anda tidak bisa kembali setelah menekan tombol Kumpulkan.`}
            type="warning"
            onClose={() => setConfirmModal({ isOpen: false })}
            onConfirm={() => executeSubmitExam(false)}
            confirmText="Ya, Kumpulkan"
          />
        </div>
      );
    };




export default ExamRoom;




