import { fetchAPI } from '../api.js';
import React, { useState, useEffect, useRef } from 'react';
import Loader from '../components/Loader.jsx';
import Modal from '../components/Modal.jsx';

function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
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

const ExamRoom = ({ user, jadwal, idLog, dataLog, showMessage, onFinish, isDarkMode, setIsDarkMode }) => {
  const currentUserId = user?.id_user || user?.id_siswa;

  const api = (action, p = {}) => {
    if (Array.isArray(p)) return fetchAPI(action, p.map(item => ({ ...item, npsn: user.npsn })));
    return fetchAPI(action, { ...p, npsn: user.npsn });
  };

  const [soal, setSoal] = useState([]);
  const [narasiMap, setNarasiMap] = useState({});
  const [jawabanSiswa, setJawabanSiswa] = useState(() => {
    const saved = localStorage.getItem(`nexa_ans_${idLog}`);
    if (!saved) return {};
    if (typeof window !== 'undefined' && window.safeJSONParse) {
      return window.safeJSONParse(saved, {});
    }
    try {
      return JSON.parse(saved);
    } catch (e) {
      return {};
    }
  });
  const [raguRagu, setRaguRagu] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unanswered' | 'flagged' | 'answered'
  const [isLoading, setIsLoading] = useState(true);
  const initialViolations = (dataLog && dataLog.pelanggaran) || 0;
  const initialBlocked = Boolean((dataLog && dataLog.is_blocked) || initialViolations >= 3);
  const [violationCount, setViolationCount] = useState(initialViolations);
  const [isBlocked, setIsBlocked] = useState(initialBlocked);

  const [timeLeft, setTimeLeft] = useState({ total: 1, hours: 0, minutes: 0, seconds: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });
  const [securityModal, setSecurityModal] = useState({ isOpen: false, title: '', message: '' });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [blurOverlay, setBlurOverlay] = useState(false);
  const isSubmittingRef = useRef(false);
  const isBlockedRef = useRef(initialBlocked);
  const lastViolationTimeRef = useRef(0);

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const examContainerRef = useRef(null);
  const windowBlurTimerRef = useRef(null);
  const gracePeriodTimer = useRef(null);

  const triggerStrike3Kick = () => {
    setIsBlocked(true);
    isBlockedRef.current = true;
    setIsSubmitting(true);
    isSubmittingRef.current = true;

    try {
      localStorage.removeItem(`nexa_ans_${idLog}`);
      if (jadwal?.id_jadwal) {
        localStorage.removeItem(`jawaban_${jadwal.id_jadwal}`);
        localStorage.removeItem(`nexa_ans_${jadwal.id_jadwal}`);
      }
      sessionStorage.removeItem('nexa_active_exam');
    } catch (e) {
      console.error('Failed to clear cached answers:', e);
    }

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    setSecurityModal({
      isOpen: true,
      title: 'UJIAN DIHENTIKAN! (Pelanggaran ke-3)',
      message: 'Anda telah melakukan pelanggaran sebanyak 3 kali. Sesi ujian Anda telah dihentikan secara permanen dan nilai Anda dicatat 0.'
    });

    setTimeout(() => {
      onFinish();
    }, 3000);
  };

  useEffect(() => {
    if (initialBlocked || initialViolations >= 3) {
      triggerStrike3Kick();
      return;
    }

    if (idLog) {
      api('get_status_log_ujian', { id_log: idLog }).then((res) => {
        if (res.status === 'success' && res.data) {
          const strikes = res.data.pelanggaran || 0;
          const blocked = res.data.is_blocked || strikes >= 3 || (res.data.status_ujian === 'SELESAI' && res.data.nilai_auto === 0);
          setViolationCount(strikes);
          if (blocked) {
            triggerStrike3Kick();
          }
        }
      }).catch((err) => console.warn('Sync exam log error:', err));
    }

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

      if (remaining.total <= 0 && !isSubmittingRef.current && !isBlockedRef.current) {
        clearInterval(timerInterval);
        showMessage('Waktu Habis!', 'Waktu ujian telah berakhir. Sistem mengumpulkan jawaban otomatis.', 'warning');
        executeSubmitExam(true);
      }
    }, 1000);

    const handleOnline = () => {
      setIsOffline(false);
    };
    const handleOffline = () => {
      setIsOffline(true);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(timerInterval);
      if (gracePeriodTimer.current) clearTimeout(gracePeriodTimer.current);
      if (windowBlurTimerRef.current) clearTimeout(windowBlurTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (wakeLock) wakeLock.release().catch(()=>{});
    };
  }, []);

  useEffect(() => {
    if (window.MathJax) {
      setTimeout(() => {
        window.MathJax.typesetPromise().catch(err => console.error('MathJax error:', err));
      }, 100);
    }
  }, [currentIndex, soal]);

  const fetchSoal = async () => {
    const res = await api('get_soal_ujian', { id_jadwal: jadwal.id_jadwal, id_log: idLog });
    if (res.status === 'success') {
      if (res.logStatus) {
        const strikes = res.logStatus.pelanggaran || 0;
        const blocked = res.logStatus.is_blocked || strikes >= 3 || (res.logStatus.status_ujian === 'SELESAI' && res.logStatus.nilai_auto === 0);
        setViolationCount(strikes);
        if (blocked) {
          triggerStrike3Kick();
          setIsLoading(false);
          return;
        }
      }
      let parsedSoal = (res.data || []).map(s => {
        let parsedOpsi = null;
        if (s.opsi) {
          try { parsedOpsi = JSON.parse(s.opsi); } catch (e) { parsedOpsi = s.opsi; }
        }
        const seedVal = currentUserId ? currentUserId.toString().charCodeAt(0) : 1;
        const seed = seedVal + (jadwal.id_jadwal * 10);
        if (jadwal.acak_opsi && parsedOpsi && (s.tipe_soal === 'PG' || s.tipe_soal === 'PGK')) {
          seededShuffle(parsedOpsi, seed + (s.id_soal || 0));
        }
        return { ...s, opsi: parsedOpsi };
      });

      if (jadwal.acak_soal) {
        const seedVal = currentUserId ? currentUserId.toString().charCodeAt(0) : 1;
        const seed = seedVal + (jadwal.id_jadwal * 10);
        seededShuffle(parsedSoal, seed);
      }

      setSoal(parsedSoal);
      if (res.narasiMap) setNarasiMap(res.narasiMap);
    }
    setIsLoading(false);
  };

  const reportViolation = async (reason = 'Meninggalkan halaman ujian') => {
    if (isBlockedRef.current || isSubmittingRef.current) return;

    const res = await api('catat_pelanggaran', { id_log: idLog, alasan: reason });
    if (res.status === 'success') {
      const strikes = res.pelanggaran_saat_ini;
      setViolationCount(strikes);

      if (res.terblokir || strikes >= 3) {
        setIsBlocked(true);
        isBlockedRef.current = true;
        setIsSubmitting(true);
        isSubmittingRef.current = true;

        // Clean local storage so no cached answers remain for this exam
        try {
          localStorage.removeItem(`nexa_ans_${idLog}`);
          if (jadwal?.id_jadwal) {
            localStorage.removeItem(`jawaban_${jadwal.id_jadwal}`);
            localStorage.removeItem(`nexa_ans_${jadwal.id_jadwal}`);
          }
        } catch (e) {
          console.error('Failed to clear cached answers:', e);
        }

        // Exit fullscreen if active
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }

        // Display unclosable danger modal (Strike 3)
        setSecurityModal({
          isOpen: true,
          title: 'UJIAN DIHENTIKAN! (Pelanggaran ke-3)',
          message: 'Anda telah melakukan pelanggaran sebanyak 3 kali. Sesi ujian Anda telah dihentikan secara permanen dan nilai Anda dicatat 0.'
        });

        // Automatically kick out the student after 3 seconds
        setTimeout(() => {
          onFinish();
        }, 3000);
      } else if (strikes === 1) {
        showMessage(
          'Peringatan Keamanan (1/3)',
          'Peringatan Keamanan (1/3): Terdeteksi keluar dari layar ujian! Pelanggaran ke-1 dari maksimal 3. Jika mencapai 3 pelanggaran, Anda akan dikeluarkan otomatis dengan nilai 0.',
          'warning'
        );
      } else if (strikes === 2) {
        showMessage(
          'PERINGATAN TERAKHIR (2/3)!',
          'PERINGATAN TERAKHIR (2/3)! Anda kembali meninggalkan halaman ujian. Satu pelanggaran lagi akan langsung menghentikan ujian Anda dan mencatat nilai 0!',
          'error'
        );
      }
    }
  };

  const handleSecurityViolation = (reason = 'Meninggalkan halaman ujian') => {
    if (isSubmittingRef.current || isBlockedRef.current) return;
    const now = Date.now();
    // Enforce 2500ms cooldown deduplication so a single tab switch does NOT trigger both blur and visibility
    if (now - lastViolationTimeRef.current < 2500) {
      return;
    }
    lastViolationTimeRef.current = now;
    reportViolation(reason);
    enforceFullscreen();
  };

  const triggerViolationImmediate = (reason) => {
    handleSecurityViolation(reason || 'Meninggalkan halaman ujian');
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      handleSecurityViolation('Terdeteksi keluar dari layar ujian (visibility hidden)');
    }
  };

  const handleFullscreenChange = () => {
    if (!document.fullscreenElement && jadwal?.browser_lockdown) {
      handleSecurityViolation('Terdeteksi keluar dari mode layar penuh (fullscreen exit)');
    }
  };

  const handleWindowBlur = () => {
    handleSecurityViolation('Terdeteksi keluar dari layar ujian (window blur)');
  };

  const setupAntiCheat = () => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (document.documentElement && document.documentElement.requestFullscreen) {
      document.addEventListener('fullscreenchange', handleFullscreenChange);
    }
    window.addEventListener('blur', handleWindowBlur);
  };

  const returnToExam = () => {
    setBlurOverlay(false);
    enforceFullscreen();
  };

  const enforceFullscreen = () => {
    if (jadwal?.browser_lockdown && !isBlockedRef.current && document.documentElement && document.documentElement.requestFullscreen && !document.fullscreenElement) {
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
      // Offline-First: Save answer to localStorage immediately
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

    if (!isAuto && !navigator.onLine) {
      showMessage('Koneksi Terputus', 'Tidak dapat mengirim jawaban saat offline. Hubungkan kembali perangkat Anda ke internet sebelum mengumpulkan.', 'error');
      return;
    }

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
      id_siswa: currentUserId,
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
      isSubmittingRef.current = false;
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
            <label 
              key={idx} 
              className={`relative flex items-start p-4 rounded-2xl cursor-pointer transition-all border-2 min-h-[52px] ${
                isSelected 
                  ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-sm' 
                  : 'border-slate-100 dark:border-slate-700 hover:border-emerald-500/40 bg-white dark:bg-slate-800'
              }`}
            >
              <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 mt-0.5 shrink-0 transition-colors ${
                isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'
              }`}>
                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-white"></div>}
              </div>
              <input 
                type="radio" 
                className="hidden" 
                name={s.id_soal} 
                value={op} 
                checked={isSelected} 
                onChange={() => handleAnswerChange(s.id_soal, op, s.tipe_soal)} 
              />
              <div className="ml-3 flex-1 min-w-0 flex items-start">
                {s.tipe_soal === 'PG' && (
                  <span className={`font-bold mr-2 mt-0.5 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {letter}.
                  </span>
                )}
                <div 
                  className={`text-sm sm:text-base leading-relaxed overflow-x-auto custom-scrollbar [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg ${
                    isSelected ? 'text-emerald-900 dark:text-emerald-200 font-medium' : 'text-slate-700 dark:text-slate-200'
                  }`} 
                  dangerouslySetInnerHTML={{ __html: op }}
                />
              </div>
            </label>
          );
        });

      case 'PGK':
        return (s.opsi || []).map((op, idx) => {
          const isChecked = Array.isArray(currentAns) && currentAns.includes(op);
          const letter = String.fromCharCode(65 + idx);
          return (
            <label 
              key={idx} 
              className={`relative flex items-start p-4 rounded-2xl cursor-pointer transition-all border-2 min-h-[52px] ${
                isChecked 
                  ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-sm' 
                  : 'border-slate-100 dark:border-slate-700 hover:border-emerald-500/40 bg-white dark:bg-slate-800'
              }`}
            >
              <div className={`flex items-center justify-center w-6 h-6 rounded-lg border-2 mt-0.5 shrink-0 transition-colors ${
                isChecked ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'
              }`}>
                {isChecked && <span className="material-symbols-outlined text-white text-[16px] font-bold">check</span>}
              </div>
              <input 
                type="checkbox" 
                className="hidden" 
                value={op} 
                checked={isChecked} 
                onChange={() => handleAnswerChange(s.id_soal, op, s.tipe_soal)} 
              />
              <div className="ml-3 flex-1 min-w-0 flex items-start">
                <span className={`font-bold mr-2 mt-0.5 ${isChecked ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {letter}.
                </span>
                <div 
                  className={`text-sm sm:text-base leading-relaxed overflow-x-auto custom-scrollbar [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg ${
                    isChecked ? 'text-emerald-900 dark:text-emerald-200 font-medium' : 'text-slate-700 dark:text-slate-200'
                  }`} 
                  dangerouslySetInnerHTML={{ __html: op }}
                />
              </div>
            </label>
          );
        });

      case 'JODOH': {
        const premis = s.opsi?.premis || [];
        const respon = s.opsi?.respon || [];
        const ansObj = typeof currentAns === 'object' && !Array.isArray(currentAns) ? currentAns : {};
        return (
          <div className="bg-emerald-50/50 dark:bg-slate-800/80 p-4 sm:p-5 rounded-2xl border border-emerald-200/60 dark:border-slate-700 space-y-3">
            <p className="text-emerald-800 dark:text-emerald-300 font-bold text-xs sm:text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">link</span>
              <span>Pasangkan setiap pernyataan di kolom kiri dengan pilihan respon yang tepat.</span>
            </p>
            <div className="space-y-2.5">
              {premis.map((p, idx) => p && (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <span className="flex-1 font-medium text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    {p}
                  </span>
                  <span className="material-symbols-outlined text-slate-400 hidden sm:block text-[18px]">arrow_forward</span>
                  <select 
                    value={ansObj[p] || ''} 
                    onChange={(e) => handleAnswerChange(s.id_soal, e.target.value, s.tipe_soal, p)} 
                    className="w-full sm:w-1/2 p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  >
                    <option value="">Pilih Respon...</option>
                    {respon.map((r, i) => r && <option key={i} value={r}>{r}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'ISIAN':
      case 'URAIAN':
        return (
          <textarea 
            rows={s.tipe_soal === 'URAIAN' ? 8 : 3} 
            placeholder="Ketik jawaban Anda di sini..." 
            value={currentAns} 
            onChange={(e) => handleAnswerChange(s.id_soal, e.target.value, s.tipe_soal)} 
            className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm sm:text-base text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all leading-relaxed"
          />
        );

      default: 
        return (
          <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold">
            <span className="material-symbols-outlined text-[18px]">warning</span>
            <span>Tipe soal tidak didukung.</span>
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center">
        <Loader text="Menyiapkan Soal dan Enkripsi Sesi..." />
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="min-h-screen bg-rose-600 flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
        <span className="material-symbols-outlined text-[80px]">block</span>
        <h1 className="text-2xl sm:text-3xl font-black">AKUN DIBLOKIR</h1>
        <p className="text-sm sm:text-base max-w-md">Sistem mendeteksi kecurangan. Hubungi proktor / pengawas ujian untuk membuka akses Anda.</p>
      </div>
    );
  }

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

  // Filtered Question Indices for Palette
  const filteredQuestionIndices = soal.map((s, idx) => {
    const ans = jawabanSiswa[s.id_soal];
    let hasAnswered = false;
    if (ans) {
      if (s.tipe_soal === 'PGK') hasAnswered = Array.isArray(ans) && ans.length > 0;
      else if (s.tipe_soal === 'JODOH') hasAnswered = typeof ans === 'object' && Object.keys(ans).length > 0 && Object.values(ans).some(v => v !== '');
      else hasAnswered = String(ans).trim() !== '';
    }
    const isFlagged = !!raguRagu[s.id_soal];
    return { s, idx, hasAnswered, isFlagged };
  }).filter(({ hasAnswered, isFlagged }) => {
    if (activeFilter === 'answered') return hasAnswered;
    if (activeFilter === 'flagged') return isFlagged;
    if (activeFilter === 'unanswered') return !hasAnswered;
    return true;
  });

  const renderNavGrid = () => (
    <div className="flex flex-col">
      {/* 4 Status Filter Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mb-4">
        {[
          { id: 'all', label: 'Semua', count: soal.length },
          { id: 'unanswered', label: 'Belum', count: unansweredCount },
          { id: 'flagged', label: 'Ragu', count: flaggedCount },
          { id: 'answered', label: 'Terjawab', count: answeredCount },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveFilter(tab.id)}
            className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all flex flex-col items-center justify-center min-h-[44px] ${
              activeFilter === tab.id
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>{tab.label}</span>
            <span className="text-[10px] font-black opacity-80">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Grid of Number Buttons (min 44px touch targets) */}
      <div className="grid grid-cols-5 gap-2.5 max-h-[50vh] overflow-y-auto custom-scrollbar p-1">
        {filteredQuestionIndices.map(({ s, idx, hasAnswered, isFlagged }) => {
          let btnStyle = "relative w-11 h-11 rounded-xl font-mono text-xs sm:text-sm font-bold flex items-center justify-center cursor-pointer transition-all min-w-[44px] min-h-[44px] ";
          
          if (currentIndex === idx) {
            btnStyle += "bg-emerald-600 text-white ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900 shadow-sm";
          } else if (isFlagged) {
            btnStyle += "bg-amber-500 text-white hover:bg-amber-600";
          } else if (hasAnswered) {
            btnStyle += "bg-emerald-500 text-white hover:bg-emerald-600";
          } else {
            btnStyle += "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 bg-white dark:bg-slate-800";
          }

          return (
            <button 
              key={s.id_soal} 
              type="button"
              onClick={() => { setCurrentIndex(idx); setIsDrawerOpen(false); }} 
              className={btnStyle}
            >
              {idx + 1}
              {isFlagged && hasAnswered && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 border-2 border-white dark:border-slate-800 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderLegend = () => (
    <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-3.5 h-3.5 bg-emerald-500 rounded-md"></div>
        <span>Terjawab ({answeredCount})</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3.5 h-3.5 bg-amber-500 rounded-md"></div>
        <span>Ragu-ragu ({flaggedCount})</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3.5 h-3.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"></div>
        <span>Belum Dijawab ({unansweredCount})</span>
      </div>
    </div>
  );

  const currentNarasi = currentS?.id_narasi ? narasiMap[currentS.id_narasi] : null;
  const narasiContent = currentNarasi?.pertanyaan || currentNarasi?.konten || '';
  const narasiTitle = currentNarasi?.judul || 'Wacana / Stimulus Bacaan';

  return (
    <div 
      className="text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-900 h-screen flex flex-col overflow-hidden select-none transition-colors duration-300" 
      ref={examContainerRef} 
      onClick={enforceFullscreen}
    >
      {/* Anti-Cheat Blur Overlay */}
      {blurOverlay && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-md text-center shadow-2xl border border-rose-500/20 animate-fade-in-up">
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[36px]">gavel</span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Peringatan Keamanan!</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-xs sm:text-sm leading-relaxed">
              Anda terdeteksi keluar dari layar penuh, berganti tab, atau membuka jendela aplikasi lain. Tetap berada di halaman ujian hingga selesai.
            </p>
            <button 
              onClick={returnToExam} 
              className="w-full py-3 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors min-h-[44px]"
            >
              Kembali ke Ujian
            </button>
          </div>
        </div>
      )}

      {/* Offline Status Banner (Friendly, No Unfair Violation Penalty) */}
      {isOffline && (
        <div className="bg-amber-500 text-white px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 z-[60] shadow-sm">
          <span className="material-symbols-outlined text-[18px]">wifi_off</span>
          <span>Koneksi internet terputus. Anda tetap dapat melanjutkan pengerjaan; jawaban aman tersimpan lokal di perangkat.</span>
        </div>
      )}

      {/* Top HUD Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-50 flex items-center justify-between px-4 sm:px-6 shadow-sm transition-colors duration-300">
        {/* Left: Subject & Student Info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <span className="material-symbols-outlined text-[20px]">school</span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate max-w-[130px] sm:max-w-xs">
                {jadwal.nama_mapel || jadwal.nama_ujian}
              </span>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {jadwal.nama_kelas || user.kelas || 'CBT'}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[130px] sm:max-w-xs">
              {user.nama_lengkap}
            </span>
          </div>
        </div>

        {/* Center: Completion Counter & Progress Bar (Desktop) */}
        <div className="hidden md:flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span>Kemajuan:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{answeredCount}</span>
            <span className="text-slate-400">/</span>
            <span>{soal.length}</span>
          </div>
          <div className="w-24 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${soal.length > 0 ? (answeredCount / soal.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Right: Calm Timer & Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono font-bold text-xs sm:text-sm tracking-wider transition-colors ${
            timeLeft.total < 60000 
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 animate-pulse'
              : timeLeft.total < 300000 
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
          }`}>
            <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500">timer</span>
            <span>{String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}</span>
          </div>

          <button 
            onClick={() => setIsDrawerOpen(true)} 
            className="lg:hidden h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-1 text-xs font-bold hover:border-emerald-500 transition-colors min-w-[44px] min-h-[44px]"
            title="Daftar Soal"
          >
            <span className="material-symbols-outlined text-[18px]">grid_view</span>
            <span>{currentIndex + 1}/{soal.length}</span>
          </button>

          {setIsDarkMode && (
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors min-w-[44px] min-h-[44px]"
              title="Ganti Tema"
            >
              <span className="material-symbols-outlined text-[18px]">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
            </button>
          )}
        </div>

        {/* Slim Linear Progress Line at bottom border */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-100 dark:bg-slate-800">
          <div 
            className="h-full bg-emerald-500 transition-all duration-300 ease-out" 
            style={{ width: `${soal.length > 0 ? (answeredCount / soal.length) * 100 : 0}%` }}
          />
        </div>
      </header>

      <div className="flex flex-1 pt-16 h-full">
        {/* Desktop Right Sidebar Palette */}
        <aside className="hidden lg:flex fixed right-0 top-16 w-80 h-[calc(100vh-64px)] border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-col p-5 overflow-y-auto custom-scrollbar z-30 transition-colors duration-300">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Navigasi Soal</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Pilih nomor soal untuk melompat</p>
            {violationCount > 0 && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-2 font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                <span>Pelanggaran: {violationCount} / 3</span>
              </p>
            )}
          </div>
          {renderNavGrid()}
          {renderLegend()}
        </aside>

        {/* Mobile Slide-up / Bottom Sheet Drawer */}
        <div className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
          <div className={`absolute bottom-0 w-full bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl p-5 pb-8 transition-transform duration-300 ${isDrawerOpen ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4" />
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-base text-slate-800 dark:text-white">Navigasi Soal</h2>
              <button onClick={() => setIsDrawerOpen(false)} className="text-slate-500 p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            {renderNavGrid()}
            {renderLegend()}
          </div>
        </div>

        {/* Main Exam Canvas */}
        <main className="flex-1 lg:mr-80 flex flex-col bg-slate-50 dark:bg-slate-900 relative overflow-y-auto pb-28 pt-4 transition-colors duration-300">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
            {currentS ? (
              <div className={currentNarasi ? 'flex flex-col lg:flex-row gap-6 items-start' : 'max-w-4xl mx-auto w-full'}>
                {/* Stimulus / Wacana Panel (Desktop Side-by-Side vs Mobile Collapsible) */}
                {currentNarasi && (
                  <div className="w-full lg:w-1/2 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 p-5 sm:p-6 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-700/60">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                          <span className="material-symbols-outlined text-[18px]">menu_book</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100">{narasiTitle}</h3>
                          <span className="text-[11px] text-slate-400">Stimulus Teks Literasi</span>
                        </div>
                      </div>
                    </div>

                    <div className="max-h-[40vh] lg:max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar pr-2 text-slate-700 dark:text-slate-200 leading-relaxed text-sm sm:text-base select-none [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:my-3">
                      <div dangerouslySetInnerHTML={{ __html: narasiContent }} />
                    </div>
                  </div>
                )}

                {/* Question Prompt and Options Card */}
                <div className={`w-full ${currentNarasi ? 'lg:w-1/2' : ''} bg-white dark:bg-slate-800 rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-700/80 shadow-sm animate-fade-in-up`}>
                  <div className="flex justify-between items-center pb-4 mb-5 border-b border-slate-100 dark:border-slate-700/60">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-600 text-white w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-sm">
                        {currentIndex + 1}
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                          Soal {currentIndex + 1} dari {soal.length}
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                          {currentS.tipe_soal} {currentS.bobot ? `• ${currentS.bobot} Poin` : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div 
                    className="font-medium text-slate-800 dark:text-slate-100 text-sm sm:text-base md:text-lg leading-relaxed mb-6 whitespace-pre-wrap overflow-x-auto custom-scrollbar [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:my-3 select-none" 
                    dangerouslySetInnerHTML={{ __html: currentS.pertanyaan }} 
                  />

                  <div className="space-y-3">
                    {renderQuestionInput(currentS)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 py-20 font-bold text-lg">Tidak ada soal yang tersedia.</div>
            )}
          </div>

          {/* Sticky Bottom Navigation Bar */}
          {currentS && (
            <div className="fixed bottom-0 left-0 right-0 lg:right-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 py-3 z-40 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-colors duration-300">
              <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} 
                    disabled={currentIndex === 0} 
                    className="h-11 px-3.5 sm:px-5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600 dark:hover:border-emerald-500 dark:hover:text-emerald-400 bg-white dark:bg-slate-800 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]"
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                    <span className="hidden sm:inline">Sebelumnya</span>
                  </button>

                  <button 
                    onClick={() => setIsDrawerOpen(true)} 
                    className="lg:hidden h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors min-h-[44px]"
                  >
                    <span className="material-symbols-outlined text-[18px]">grid_view</span>
                    <span className="hidden xs:inline">Daftar</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => toggleRaguRagu(currentS.id_soal)} 
                    className={`h-11 px-3.5 sm:px-4 rounded-xl border-2 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors min-h-[44px] ${
                      raguRagu[currentS.id_soal] 
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400' 
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 hover:border-amber-400 hover:text-amber-600'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {raguRagu[currentS.id_soal] ? 'check_box' : 'check_box_outline_blank'}
                    </span>
                    <span className="hidden sm:inline">Ragu-ragu</span>
                  </button>

                  {currentIndex < soal.length - 1 ? (
                    <button 
                      onClick={() => setCurrentIndex(currentIndex + 1)} 
                      className="h-11 px-5 sm:px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm transition-all min-h-[44px]"
                    >
                      <span>Lanjut</span>
                      <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                    </button>
                  ) : (
                    <button 
                      onClick={requestSubmit} 
                      className="h-11 px-5 sm:px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm hover:shadow transition-all min-h-[44px]"
                    >
                      <span className="material-symbols-outlined text-[18px]">task_alt</span>
                      <span>Kumpulkan Ujian</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Safe Submission Review Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        title="Ikhtisar & Konfirmasi Pengumpulan"
        type="info"
        onClose={() => setConfirmModal({ isOpen: false })}
      >
        <div className="space-y-4 pt-1">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            Periksa kembali ringkasan status jawaban Anda sebelum menyelesaikan sesi ujian:
          </p>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-center">
              <span className="block text-xl font-black text-emerald-600 dark:text-emerald-400">{answeredCount}</span>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Terjawab</span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-center">
              <span className="block text-xl font-black text-amber-600 dark:text-amber-400">{flaggedCount}</span>
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Ragu-ragu</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-center">
              <span className={`block text-xl font-black ${unansweredCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>
                {unansweredCount}
              </span>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Belum</span>
            </div>
          </div>

          {unansweredCount > 0 || flaggedCount > 0 ? (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200">
              <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0 mt-0.5">warning</span>
              <span className="leading-relaxed">
                Masih ada <strong>{unansweredCount} soal belum dijawab</strong> dan <strong>{flaggedCount} soal ragu-ragu</strong>. Waktu ujian Anda masih tersisa.
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-200">
              <span className="material-symbols-outlined text-emerald-500 text-[18px] shrink-0 mt-0.5">check_circle</span>
              <span className="leading-relaxed">Semua {soal.length} soal telah selesai dijawab dengan lengkap!</span>
            </div>
          )}

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={() => setConfirmModal({ isOpen: false })}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm hover:bg-slate-50 transition-colors min-h-[44px]"
            >
              Periksa Kembali
            </button>
            <button
              type="button"
              onClick={() => executeSubmitExam(false)}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm hover:shadow transition-all active:scale-[0.98] min-h-[44px]"
            >
              Ya, Kumpulkan
            </button>
          </div>
        </div>
      </Modal>

      {/* Unclosable Security Danger Modal (Strike 3) */}
      {securityModal.isOpen && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 select-none animate-fade-in"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border-2 border-rose-500 animate-scale-in">
            <div className="bg-rose-600 p-5 text-white font-black text-lg flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl animate-pulse">gpp_bad</span>
              <h2 className="text-base sm:text-lg font-black leading-tight tracking-wide">{securityModal.title}</h2>
            </div>
            <div className="p-6 text-slate-700 dark:text-slate-200 text-sm font-medium leading-relaxed space-y-4">
              <p>{securityModal.message}</p>
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300 font-semibold">
                <span className="material-symbols-outlined text-rose-500 animate-spin text-sm">progress_activity</span>
                <span>Mengalihkan keluar dari sesi ujian dalam 3 detik...</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamRoom;
