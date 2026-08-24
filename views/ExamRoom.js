    const ExamRoom = ({ user, jadwal, idLog, showMessage, onFinish, isDarkMode, setIsDarkMode }) => {
      const api = (action, p = {}) => {
        if (Array.isArray(p)) return fetchAPI(action, p.map(item => ({ ...item, npsn: user.npsn })));
        return fetchAPI(action, { ...p, npsn: user.npsn });
      };
      const [soal, setSoal] = useState([]);
      const [narasiList, setNarasiList] = useState([]);
      const [jawabanSiswa, setJawabanSiswa] = useState({});
      const [raguRagu, setRaguRagu] = useState({});
      const [currentIndex, setCurrentIndex] = useState(0);
      const [isLoading, setIsLoading] = useState(true);
      const [violationCount, setViolationCount] = useState(0);
      const [isBlocked, setIsBlocked] = useState(false);

      const [timeLeft, setTimeLeft] = useState({ total: 1, hours: 0, minutes: 0, seconds: 0 });
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [confirmModal, setConfirmModal] = useState({ isOpen: false });

      const examContainerRef = useRef(null);

      const shuffleArray = (array) => {
        let shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      };

      useEffect(() => {
        fetchSoal();
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

        return () => {
          clearInterval(timerInterval);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
      }, []);

      const fetchSoal = async () => {
        const res = await api('get_soal_by_mapel', { id_mapel: jadwal.id_mapel });
        if (res.status === 'success') {
          const allData = res.data;
          setNarasiList(allData.filter(s => s.tipe_soal === 'NARASI'));

          let parsedSoal = allData
            .filter(s => s.tipe_soal !== 'NARASI' && s.tipe_soal !== 'SKEMA_PENILAIAN')
            .map(s => {
              let parsedOpsi = null;
              if (s.opsi) {
                try { parsedOpsi = JSON.parse(s.opsi); } catch (e) { parsedOpsi = s.opsi; }
              }
              if (Array.isArray(parsedOpsi) && (s.tipe_soal === 'PG' || s.tipe_soal === 'PGK')) {
                parsedOpsi = shuffleArray(parsedOpsi.filter(op => op && op.trim() !== ''));
              }
              return { ...s, opsi: parsedOpsi };
            });
            
          setSoal(shuffleArray(parsedSoal));
        }
        setIsLoading(false);
      };

      const reportViolation = async () => {
        if (isBlocked || isSubmitting) return;

        const res = await api('catat_pelanggaran', { id_log: idLog });
        if (res.status === 'success') {
          setViolationCount(res.pelanggaran_saat_ini);
          if (res.terblokir) {
            setIsBlocked(true);
            if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
            showMessage('TERBLOKIR!', 'Akun Anda diblokir karena meninggalkan halaman ujian lebih dari 3 kali. Hubungi pengawas.', 'error');
            setTimeout(onFinish, 5000);
          } else {
            showMessage('Peringatan Keamanan!', `Sistem mendeteksi Anda keluar dari halaman ujian! Ini pelanggaran ke-${res.pelanggaran_saat_ini} dari maksimal 3.`, 'warning');
          }
        }
      };

      const handleVisibilityChange = () => { if (document.hidden) reportViolation(); };
      const handleFullscreenChange = () => { if (!document.fullscreenElement && !isSubmitting && !isBlocked) reportViolation(); };

      const setupAntiCheat = () => {
        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
      };

      const enforceFullscreen = () => {
        if (!isBlocked && document.documentElement.requestFullscreen && !document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => { });
        }
      };

      const handleAnswerChange = (soalId, value, tipe, parentKey = null) => {
        setJawabanSiswa(prev => {
          if (tipe === 'PGK') {
            let arr = Array.isArray(prev[soalId]) ? [...prev[soalId]] : [];
            if (arr.includes(value)) arr = arr.filter(item => item !== value);
            else arr.push(value);
            return { ...prev, [soalId]: arr };
          }
          if (tipe === 'JODOH' && parentKey) {
            const currentObj = typeof prev[soalId] === 'object' && !Array.isArray(prev[soalId]) ? { ...prev[soalId] } : {};
            currentObj[parentKey] = value;
            return { ...prev, [soalId]: currentObj };
          }
          return { ...prev, [soalId]: value };
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
        if (isSubmitting) return;

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
            return (s.opsi || []).map((op, idx) => (
              <label key={idx} className={`flex items-center p-md border rounded-lg cursor-pointer transition-colors ${currentAns === op ? 'border-2 border-primary dark:border-primary-fixed bg-primary-fixed dark:bg-primary/20 shadow-[0_4px_8px_rgba(0,0,0,0.05)]' : 'border-outline-variant dark:border-slate-700 hover:bg-surface-container-low dark:hover:bg-slate-700/50 bg-white dark:bg-slate-800'}`}>
                <input type="radio" name={s.id_soal} value={op} checked={currentAns === op} onChange={() => handleAnswerChange(s.id_soal, op, s.tipe_soal)} className={`form-radio h-5 w-5 ${currentAns === op ? 'text-primary border-primary' : 'text-primary border-outline-variant dark:border-slate-600'} focus:ring-primary focus:ring-offset-0`} />
                <span className="ml-md font-body-lg text-body-lg text-on-surface dark:text-white flex-1">
                  {s.tipe_soal === 'PG' && <span className="font-bold mr-sm text-primary dark:text-primary-fixed">{String.fromCharCode(65 + idx)}.</span>} {op}
                </span>
              </label>
            ));

          case 'PGK':
            return (s.opsi || []).map((op, idx) => {
              const isChecked = Array.isArray(currentAns) && currentAns.includes(op);
              return (
                <label key={idx} className={`flex items-center p-md border rounded-lg cursor-pointer transition-colors ${isChecked ? 'border-2 border-primary dark:border-primary-fixed bg-primary-fixed dark:bg-primary/20 shadow-[0_4px_8px_rgba(0,0,0,0.05)]' : 'border-outline-variant dark:border-slate-700 hover:bg-surface-container-low dark:hover:bg-slate-700/50 bg-white dark:bg-slate-800'}`}>
                  <input type="checkbox" value={op} checked={isChecked} onChange={() => handleAnswerChange(s.id_soal, op, s.tipe_soal)} className={`form-checkbox rounded h-5 w-5 ${isChecked ? 'text-primary border-primary' : 'text-primary border-outline-variant dark:border-slate-600'} focus:ring-primary focus:ring-offset-0`} />
                  <span className="ml-md font-body-lg text-body-lg text-on-surface dark:text-white flex-1">
                    <span className="font-bold mr-sm text-primary dark:text-primary-fixed">{String.fromCharCode(65 + idx)}.</span> {op}
                  </span>
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

          default: return <p className="text-error font-bold p-sm bg-error-container/20 rounded">⚠️ Tipe soal tidak didukung.</p>;
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

      return (
        <div className="font-body-md text-body-md text-on-background dark:text-slate-100 bg-background dark:bg-slate-900 h-screen flex flex-col overflow-hidden select-none transition-colors duration-500" ref={examContainerRef} onClick={enforceFullscreen}>
          {/* TopNavBar */}
          <header className="fixed top-0 w-full z-50 flex justify-between items-center px-lg h-20 bg-primary dark:bg-slate-900 border-b border-transparent dark:border-slate-800 shadow-md">
            <div className="flex items-center gap-md">
              <img alt="NEXA Logo" className="h-10 w-auto object-contain hidden md:block bg-white p-1 rounded-full" src="stitch_assets/screen_3_logo.png" />
              <div className="font-headline-sm text-headline-sm text-on-primary font-bold md:hidden">NEXA</div>
            </div>
            <div className="flex items-center gap-md md:gap-xl text-on-primary">
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="font-label-md text-label-md text-primary-fixed-dim">{user.nama_lengkap}</span>
                <span className="font-label-md text-label-md text-primary-fixed-dim">ID: {user.id_user}</span>
              </div>
              <div className="h-8 w-px bg-primary-fixed-dim opacity-50 hidden sm:block"></div>
              <div className="font-body-lg text-body-lg text-on-primary font-semibold hidden md:block max-w-[200px] truncate">{jadwal.nama_mapel}</div>
              <div className="h-8 w-px bg-primary-fixed-dim opacity-50 hidden md:block"></div>
              <div className={`font-headline-sm text-headline-sm ${timeLeft.total < 300000 ? 'text-error-container animate-pulse' : 'text-on-primary'} font-bold flex items-center gap-xs`}>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
                {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
              </div>
              <button onClick={requestSubmit} className="font-label-md text-label-md text-on-primary font-bold hover:opacity-90 active:scale-95 transition-transform ml-sm md:ml-md bg-error text-on-error px-md py-sm rounded">Selesai</button>
            </div>
          </header>

          <div className="flex flex-1 pt-20 h-full">
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
                    btnClass += "bg-primary text-on-primary ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900";
                  } else if (isFlagged) {
                    btnClass += "bg-[#D97706] text-white"; // flagged color
                  } else if (hasAnswered) {
                    btnClass += "bg-[#10B981] text-white"; // answered color
                  } else {
                    btnClass += "border border-outline-variant dark:border-slate-700 text-on-surface dark:text-slate-300 hover:border-primary hover:text-primary dark:hover:border-primary-fixed dark:hover:text-primary-fixed bg-white dark:bg-slate-800";
                  }

                  return (
                    <button key={s.id_soal} onClick={() => setCurrentIndex(idx)} className={btnClass}>
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
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
                  <span className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400">Belum Dijawab ({unansweredCount})</span>
                </div>
                <div className="flex items-center gap-sm">
                  <div className="w-4 h-4 bg-primary rounded-sm ring-1 ring-primary ring-offset-1 dark:ring-offset-slate-900"></div>
                  <span className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400">Posisi Saat Ini</span>
                </div>
              </div>
            </aside>

            {/* Main Content (Canvas) */}
            <main className="flex-1 md:ml-80 flex flex-col bg-background dark:bg-slate-900 relative overflow-y-auto pb-24 transition-colors duration-500">
              <div className="max-w-[1200px] mx-auto w-full p-md md:p-xl mt-sm md:mt-lg">
                {currentS ? (
                  <div className="bg-white dark:bg-slate-800 border-2 border-primary dark:border-primary/50 rounded-lg p-md md:p-xl shadow-sm mb-xl">
                    <div className="flex justify-between items-center mb-md pb-md border-b border-outline-variant dark:border-slate-700">
                      <span className="font-headline-md text-headline-md text-on-surface dark:text-white font-bold">Soal No. {currentIndex + 1}</span>
                      <div className="flex items-center gap-sm bg-surface-container dark:bg-slate-700 py-xs px-sm rounded-full">
                        <span className="material-symbols-outlined text-secondary dark:text-slate-300" style={{ fontSize: "16px" }}>category</span>
                        <span className="font-label-md text-label-md text-secondary dark:text-slate-300 uppercase font-bold">{currentS.tipe_soal}</span>
                        {currentS.bobot && <span className="text-xs ml-2 text-slate-500">({currentS.bobot} Poin)</span>}
                      </div>
                    </div>
                    
                    {currentS.id_narasi && narasiList.find(n => n.id_soal === currentS.id_narasi) && (
                      <div className="mb-md p-md bg-surface-variant/30 dark:bg-slate-800/50 rounded-lg border border-outline-variant dark:border-slate-700">
                        <div className="font-bold text-sm text-secondary mb-2 uppercase flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">menu_book</span> Informasi / Bacaan:</div>
                        <div className="font-question-text text-sm mb-2 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: narasiList.find(n => n.id_soal === currentS.id_narasi).pertanyaan }}></div>
                        {narasiList.find(n => n.id_soal === currentS.id_narasi).gambar && <img src={narasiList.find(n => n.id_soal === currentS.id_narasi).gambar} alt="Narasi" className="mt-2 max-h-64 rounded border object-contain" />}
                      </div>
                    )}
                    {currentS.gambar && (
                      <div className="mb-md">
                         <img src={currentS.gambar} alt="Gambar Soal" className="max-h-64 rounded border object-contain" />
                      </div>
                    )}
                    
                    <div className="font-question-text text-question-text text-on-surface dark:text-white mb-xl whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: currentS.pertanyaan }}>
                    </div>
                    {/* Options */}
                    <div className="space-y-sm">
                      {renderQuestionInput(currentS)}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-on-surface-variant py-20 font-bold text-xl">Tidak ada soal yang tersedia.</div>
                )}
              </div>

              {/* Bottom Action Bar */}
              {currentS && (
                <div className="fixed bottom-0 md:left-80 left-0 right-0 h-20 bg-white dark:bg-slate-900 border-t border-outline-variant dark:border-slate-800 px-md md:px-xl flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 transition-colors duration-500">
                  <button
                    onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                    disabled={currentIndex === 0}
                    className="flex items-center gap-xs px-md md:px-lg py-sm border-2 border-primary dark:border-primary-fixed text-primary dark:text-primary-fixed font-body-md text-body-md font-semibold rounded hover:bg-primary-fixed dark:hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <span className="material-symbols-outlined">arrow_back</span>
                    <span className="hidden sm:inline">Sebelumnya</span>
                  </button>
                  <div className="flex items-center gap-md md:gap-lg">
                    <label className="flex items-center cursor-pointer gap-sm group">
                      <div className="relative flex items-center justify-center w-6 h-6 border-2 border-outline-variant dark:border-slate-600 rounded group-hover:border-[#D97706] transition-colors">
                        <input type="checkbox" checked={raguRagu[currentS.id_soal] || false} onChange={() => toggleRaguRagu(currentS.id_soal)} className="absolute opacity-0 w-full h-full cursor-pointer peer" />
                        <span className="material-symbols-outlined text-[#D97706] opacity-0 peer-checked:opacity-100 transition-opacity" style={{ fontSize: "20px", fontVariationSettings: "'FILL' 1" }}>check</span>
                      </div>
                      <span className="font-body-md text-body-md text-on-surface dark:text-slate-200 group-hover:text-[#D97706] dark:group-hover:text-[#D97706] transition-colors hidden sm:inline">Tandai Ragu-ragu</span>
                    </label>
                    <button
                      onClick={() => setCurrentIndex(Math.min(soal.length - 1, currentIndex + 1))}
                      disabled={currentIndex === soal.length - 1}
                      className="flex items-center gap-xs px-md md:px-lg py-sm bg-primary text-on-primary font-body-md text-body-md font-semibold rounded hover:bg-on-primary-fixed-variant transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                      <span className="hidden sm:inline">Selanjutnya</span>
                      <span className="material-symbols-outlined">arrow_forward</span>
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

