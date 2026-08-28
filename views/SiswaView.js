    const SiswaView = ({ user, onLogout, showMessage, isDarkMode, setIsDarkMode }) => {
      const api = (action, p = {}) => {
        if (Array.isArray(p)) return fetchAPI(action, p.map(item => ({ ...item, npsn: user.npsn })));
        return fetchAPI(action, { ...p, npsn: user.npsn });
      };
      const [jadwal, setJadwal] = useState([]);
      const [isLoading, setIsLoading] = useState(false);
      const [activeExamData, setActiveExamData] = useState(null);
      const [inputToken, setInputToken] = useState('');
      const [selectedJadwalUntukToken, setSelectedJadwalUntukToken] = useState(null);
      
      const [activeTab, setActiveTab] = useState('beranda');
      const [dataPengumuman, setDataPengumuman] = useState([]);
      const [dataRiwayat, setDataRiwayat] = useState([]);
      const [hasNotification, setHasNotification] = useState(false);

      useEffect(() => {
        loadPengumuman();
        loadRiwayat();
        loadJadwal();
      }, []);

      const loadPengumuman = async () => {
        const res = await api('get_pengumuman', { role: 'siswa' });
        if (res.status === 'success') {
          setDataPengumuman(res.data);
          setHasNotification(false);
        }
      };

      const loadRiwayat = async () => {
        const res = await api('get_riwayat_ujian_siswa', { id_siswa: user.id_user });
        if (res.status === 'success') setDataRiwayat(res.data);
      };

      const loadJadwal = async () => {
        setIsLoading(true);
        const res = await api('get_jadwal', { id_siswa: user.id_user });
        if (res.status === 'success') setJadwal(res.data);
        setIsLoading(false);
      };

      const handleMulaiUjian = async (j) => {
        if (!inputToken) {
          showMessage('Perhatian', 'Harap masukkan 6 digit token dari pengawas.', 'warning');
          return;
        }
        setIsLoading(true);
        const res = await api('mulai_ujian', {
          id_jadwal: j.id_jadwal,
          id_siswa: user.id_user,
          token: inputToken.toUpperCase()
        });
        setIsLoading(false);
        if (res.status === 'success') {
          setActiveExamData({ jadwal: j, idLog: res.id_log });
        } else {
          showMessage('Akses Ditolak', res.message, 'error');
        }
      };

      if (activeExamData) {
        return (
          <ExamRoom
            user={user}
            jadwal={activeExamData.jadwal}
            idLog={activeExamData.idLog}
            showMessage={showMessage}
            onFinish={() => {
              setActiveExamData(null);
              setSelectedJadwalUntukToken(null);
              setInputToken('');
              loadJadwal();
            }}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
          />
        );
      }

      return (
        <div className="bg-slate-50 dark:bg-slate-900 min-h-screen flex justify-center selection:bg-primary/20 selection:text-primary">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 relative shadow-2xl overflow-hidden flex flex-col h-screen">
            
            {/* Header / Top Section */}
            <div className="bg-[#3ecf8e] rounded-b-[40px] px-6 pt-8 pb-20 relative text-white shadow-md z-0">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-white/20 rounded-full border-2 border-white/50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-3xl">person</span>
                  </div>
                  <div>
                    <h2 className="font-bold text-lg leading-tight">SMPN 1 Yogyakarta</h2>
                    <p className="text-sm font-medium opacity-90">{user.nama_lengkap}</p>
                    <p className="text-xs opacity-80">N.I.S : {user.id_user}</p>
                  </div>
                </div>
                <button className="relative">
                  <span className="material-symbols-outlined text-2xl">notifications</span>
                  {hasNotification && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-[#3ecf8e] rounded-full"></span>}
                </button>
              </div>
            </div>

            {/* Stats Cards (Overlapping) */}
            <div className="px-6 -mt-12 relative z-10">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-green-500">calculate</span>
                  </div>
                  <span className="text-xl font-bold text-green-500">84</span>
                  <span className="text-[10px] text-slate-500 font-medium">Matematika</span>
                  <span className="text-[10px] text-slate-400">UAS</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center border-x border-slate-100 dark:border-slate-700">
                  <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-yellow-500">menu_book</span>
                  </div>
                  <span className="text-xl font-bold text-yellow-500">60</span>
                  <span className="text-[10px] text-slate-500 font-medium">B. Indonesia</span>
                  <span className="text-[10px] text-slate-400">UTS</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-red-500">computer</span>
                  </div>
                  <span className="text-xl font-bold text-red-500">45</span>
                  <span className="text-[10px] text-slate-500 font-medium">PAI</span>
                  <span className="text-[10px] text-slate-400">Tugas</span>
                </div>
              </div>
            </div>

            {/* Main Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-24 hide-scrollbar">
              
              {activeTab === 'beranda' && (
                <>
                  {/* Jadwal Section */}
                  <div className="px-6 mt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Jadwal</h3>
                      <button onClick={() => setActiveTab('jadwal')} className="text-sm font-medium text-primary hover:underline">Lihat semua</button>
                    </div>
                    
                    <div className="space-y-3">
                      {jadwal.length === 0 ? (
                        <div className="text-center text-slate-500 text-sm py-4">Tidak ada jadwal aktif.</div>
                      ) : (
                        jadwal.map((j, index) => {
                          let statusBtnClass = "bg-primary text-white";
                          let statusText = "Ambil";
                          if (j.status_siswa === 'SELESAI') {
                            statusBtnClass = "bg-slate-400 text-white cursor-not-allowed";
                            statusText = "Selesai";
                          } else if (j.status_siswa === 'SEDANG KERJA') {
                            statusBtnClass = "bg-yellow-500 text-white";
                            statusText = "Lanjutkan";
                          } else {
                            statusBtnClass = "bg-yellow-400 text-slate-800";
                            statusText = "Ambil";
                          }
                          
                          let iconClass = "text-primary bg-primary/10";
                          let iconName = "computer";
                          if (index % 3 === 1) { iconClass = "text-red-500 bg-red-500/10"; iconName = "menu_book"; }
                          if (index % 3 === 2) { iconClass = "text-blue-500 bg-blue-500/10"; iconName = "language"; }

                          return (
                            <div key={j.id_jadwal} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}>
                                  <span className="material-symbols-outlined">{iconName}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{j.nama_mapel}</h4>
                                  <p className="text-xs text-slate-500 truncate">{new Date(j.waktu_mulai).toLocaleDateString('id-ID')}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end flex-shrink-0">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                                  {new Date(j.waktu_mulai).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(j.waktu_selesai).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                
                                {selectedJadwalUntukToken === j.id_jadwal ? (
                                  <div className="flex items-center gap-1">
                                    <input type="text" maxLength={6} value={inputToken} onChange={e => setInputToken(e.target.value)} placeholder="TOKEN" className="w-16 h-8 text-center text-xs font-bold border rounded bg-slate-50" />
                                    <button onClick={() => handleMulaiUjian(j)} className="px-3 h-8 rounded-full text-xs font-bold bg-primary text-white">Go</button>
                                  </div>
                                ) : (
                                  <button onClick={() => j.status_siswa !== 'SELESAI' && setSelectedJadwalUntukToken(j.id_jadwal)} disabled={j.status_siswa === 'SELESAI'} className={`px-4 py-1.5 rounded-full text-xs font-bold ${statusBtnClass}`}>
                                    {statusText}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Tanggapan Guru / Pengumuman Section */}
                  <div className="px-6 mt-8 mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Tanggapan Guru</h3>
                      <button onClick={() => setActiveTab('pengumuman')} className="text-sm font-medium text-primary hover:underline">Lihat semua</button>
                    </div>
                    <div className="space-y-3">
                      {dataPengumuman.length === 0 ? (
                        <div className="text-center text-slate-500 text-sm py-4">Tidak ada tanggapan/pengumuman.</div>
                      ) : (
                        dataPengumuman.slice(0, 2).map(p => (
                          <div key={p.id_pengumuman} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                                  <img src={`https://ui-avatars.com/api/?name=${p.judul}&background=random`} alt="Avatar" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">{p.judul}</h4>
                                  <p className="text-[10px] text-slate-400">{new Date(p.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} yang lalu</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-xs text-slate-500 truncate max-w-[200px]">{p.isi}</p>
                              <button className="px-4 py-1 bg-primary text-white text-xs font-bold rounded-full">Lihat</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'jadwal' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">Semua Jadwal Ujian</h3>
                  {/* ... same list as beranda, but all ... */}
                  <div className="space-y-3">
                      {jadwal.length === 0 ? (
                        <div className="text-center text-slate-500 text-sm py-4">Tidak ada jadwal aktif.</div>
                      ) : (
                        jadwal.map((j, index) => {
                          let statusBtnClass = "bg-primary text-white";
                          let statusText = "Ambil";
                          if (j.status_siswa === 'SELESAI') {
                            statusBtnClass = "bg-slate-400 text-white cursor-not-allowed";
                            statusText = "Selesai";
                          } else if (j.status_siswa === 'SEDANG KERJA') {
                            statusBtnClass = "bg-yellow-500 text-white";
                            statusText = "Lanjutkan";
                          } else {
                            statusBtnClass = "bg-yellow-400 text-slate-800";
                            statusText = "Ambil";
                          }
                          
                          let iconClass = "text-primary bg-primary/10";
                          let iconName = "computer";
                          if (index % 3 === 1) { iconClass = "text-red-500 bg-red-500/10"; iconName = "menu_book"; }
                          if (index % 3 === 2) { iconClass = "text-blue-500 bg-blue-500/10"; iconName = "language"; }

                          return (
                            <div key={j.id_jadwal} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}>
                                  <span className="material-symbols-outlined">{iconName}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{j.nama_mapel}</h4>
                                  <p className="text-xs text-slate-500 truncate">{new Date(j.waktu_mulai).toLocaleDateString('id-ID')}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end flex-shrink-0">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                                  {new Date(j.waktu_mulai).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(j.waktu_selesai).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                {selectedJadwalUntukToken === j.id_jadwal ? (
                                  <div className="flex items-center gap-1">
                                    <input type="text" maxLength={6} value={inputToken} onChange={e => setInputToken(e.target.value)} placeholder="TOKEN" className="w-16 h-8 text-center text-xs font-bold border rounded bg-slate-50" />
                                    <button onClick={() => handleMulaiUjian(j)} className="px-3 h-8 rounded-full text-xs font-bold bg-primary text-white">Go</button>
                                  </div>
                                ) : (
                                  <button onClick={() => j.status_siswa !== 'SELESAI' && setSelectedJadwalUntukToken(j.id_jadwal)} disabled={j.status_siswa === 'SELESAI'} className={`px-4 py-1.5 rounded-full text-xs font-bold ${statusBtnClass}`}>
                                    {statusText}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                </div>
              )}

              {activeTab === 'nilai' && (
                <div className="px-6 mt-6 animate-fade-in-up">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-4">Nilai & Riwayat Ujian</h3>
                  <div className="space-y-3">
                    {dataRiwayat.length === 0 ? (
                       <div className="text-center text-slate-500 text-sm py-4">Belum ada nilai.</div>
                    ) : (
                      dataRiwayat.map(r => (
                        <div key={r.id_log} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                           <div>
                             <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{r.nama_mapel}</h4>
                             <p className="text-xs text-slate-500">{new Date(r.waktu_mulai).toLocaleDateString('id-ID')}</p>
                           </div>
                           <div className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-lg text-lg">
                             {r.total_nilai}
                           </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'akun' && (
                <div className="px-6 mt-6 animate-fade-in-up flex flex-col items-center">
                   <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                     <span className="material-symbols-outlined text-4xl text-primary">person</span>
                   </div>
                   <h3 className="font-bold text-xl">{user.nama_lengkap}</h3>
                   <p className="text-slate-500">{user.id_user}</p>
                   
                   <div className="w-full mt-8 space-y-3">
                      <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-slate-500">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">Mode Gelap</span>
                        </div>
                        <div className={`w-10 h-6 rounded-full flex items-center p-1 ${isDarkMode ? 'bg-primary' : 'bg-slate-300'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${isDarkMode ? 'translate-x-4' : ''}`}></div>
                        </div>
                      </button>
                      <button onClick={onLogout} className="w-full bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl flex items-center gap-3 shadow-sm text-red-500">
                        <span className="material-symbols-outlined">logout</span>
                        <span className="font-bold">Keluar</span>
                      </button>
                   </div>
                </div>
              )}

            </div>

            {/* Bottom Navigation */}
            <div className="absolute bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-6 py-3 flex justify-between items-center rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50">
              <button onClick={() => setActiveTab('beranda')} className={`flex flex-col items-center transition-colors ${activeTab === 'beranda' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">home</span>
                <span className="text-[10px] font-bold mt-1">Beranda</span>
              </button>
              <button onClick={() => setActiveTab('nilai')} className={`flex flex-col items-center transition-colors ${activeTab === 'nilai' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">description</span>
                <span className="text-[10px] font-bold mt-1">Nilai</span>
              </button>
              <button onClick={() => setActiveTab('jadwal')} className={`flex flex-col items-center transition-colors ${activeTab === 'jadwal' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">schedule</span>
                <span className="text-[10px] font-bold mt-1">Jadwal</span>
              </button>
              <button onClick={() => setActiveTab('leaderboards')} className={`flex flex-col items-center transition-colors ${activeTab === 'leaderboards' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">emoji_events</span>
                <span className="text-[10px] font-bold mt-1">Peringkat</span>
              </button>
              <button onClick={() => setActiveTab('akun')} className={`flex flex-col items-center transition-colors ${activeTab === 'akun' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="material-symbols-outlined">person</span>
                <span className="text-[10px] font-bold mt-1">Akun</span>
              </button>
            </div>

          </div>
        </div>
      );
    };
