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
      
      const [activeTab, setActiveTab] = useState('ujian');
      const [dataPengumuman, setDataPengumuman] = useState([]);
      const [dataRiwayat, setDataRiwayat] = useState([]);
      const [hasNotification, setHasNotification] = useState(false);

      useEffect(() => {
        if (activeTab === 'pengumuman') {
          loadPengumuman();
        } else if (activeTab === 'riwayat') {
          loadRiwayat();
        }
      }, [activeTab]);

      const loadPengumuman = async () => {
        setIsLoading(true);
        const res = await api('get_pengumuman', { role: 'siswa' });
        if (res.status === 'success') {
          setDataPengumuman(res.data);
          setHasNotification(false);
        }
        setIsLoading(false);
      };

      const loadRiwayat = async () => {
        setIsLoading(true);
        const res = await api('get_riwayat_ujian_siswa', { id_siswa: user.id_user });
        if (res.status === 'success') setDataRiwayat(res.data);
        setIsLoading(false);
      };

      useEffect(() => { loadJadwal(); }, []);

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
        <div className="bg-background dark:bg-slate-900 text-on-background dark:text-slate-100 min-h-screen font-body-md text-body-md antialiased selection:bg-primary-container selection:text-on-primary-container flex flex-col transition-colors duration-500">
          {/* TopNavBar */}
          <nav className="bg-surface/90 dark:bg-slate-900/90 backdrop-blur-md fixed top-0 w-full z-50 flex justify-between items-center px-lg h-16 border-b border-outline-variant dark:border-slate-800 transition-colors duration-500">
            <div className="flex items-center gap-xl">
              <div className="flex items-center h-8">
                <img src="stitch_assets/screen_3_logo.png" alt="NEXA Logo" className="h-full w-auto object-contain" />
              </div>
              <div className="hidden md:flex items-center h-full gap-lg">
                <a onClick={() => setActiveTab('ujian')} className={`cursor-pointer h-16 flex items-center font-bold border-b-2 font-label-md text-label-md transition-colors ${activeTab === 'ujian' ? 'text-primary dark:text-primary-fixed border-primary dark:border-primary-fixed' : 'text-on-surface-variant border-transparent hover:text-primary'}`}>Portal Ujian</a>
                <a onClick={() => setActiveTab('riwayat')} className={`cursor-pointer h-16 flex items-center font-bold border-b-2 font-label-md text-label-md transition-colors ${activeTab === 'riwayat' ? 'text-primary dark:text-primary-fixed border-primary dark:border-primary-fixed' : 'text-on-surface-variant border-transparent hover:text-primary'}`}>Riwayat Ujian</a>
                <a onClick={() => setActiveTab('pengumuman')} className={`cursor-pointer h-16 flex items-center font-bold border-b-2 font-label-md text-label-md transition-colors ${activeTab === 'pengumuman' ? 'text-primary dark:text-primary-fixed border-primary dark:border-primary-fixed' : 'text-on-surface-variant border-transparent hover:text-primary'}`}>Pengumuman</a>
              </div>
            </div>
            <div className="flex items-center gap-md">
              <button onClick={() => setActiveTab('pengumuman')} className="w-10 h-10 flex items-center justify-center rounded-full text-secondary dark:text-slate-400 hover:bg-surface-container-highest dark:hover:bg-slate-800 transition-colors relative hidden sm:flex">
                <span className="material-symbols-outlined">notifications</span>
                {hasNotification && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900"></span>}
              </button>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-9 h-9 rounded-full bg-surface-container-highest dark:bg-slate-800 border border-outline-variant dark:border-slate-700 flex items-center justify-center text-on-surface dark:text-white hover:bg-white dark:hover:bg-slate-700 transition-colors shadow-sm">
                <span className="material-symbols-outlined text-[20px]">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
              </button>
              <div className="ml-sm flex items-center gap-sm cursor-pointer border-l pl-sm border-outline-variant dark:border-slate-700">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 hidden sm:block">{user.nama_lengkap}</span>
                  <span className="text-[10px] text-slate-500 hidden sm:block uppercase font-bold tracking-wider">{user.id_user}</span>
                </div>
              </div>
              <button onClick={onLogout} className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant dark:text-slate-400 hover:bg-error-container/20 hover:text-error transition-colors cursor-pointer active:opacity-80" title="Logout">
                <span className="material-symbols-outlined">logout</span>
              </button>
            </div>
          </nav>

          {/* Main Content Canvas */}
          <main className="pt-[96px] px-md md:px-lg max-w-container-max mx-auto space-y-gutter pb-xl flex-1 w-full">
            {activeTab === 'ujian' && (
              <>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-sm mb-lg">
                  <div>
                    <h1 className="font-headline-lg text-headline-lg text-on-surface dark:text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary dark:text-primary-fixed text-[32px]">menu_book</span> Daftar Ujian Tersedia
                    </h1>
                    <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-1">Pilih jadwal ujian dan masukkan token dari pengawas untuk memulai.</p>
                  </div>
                  <div className="flex gap-sm">
                    <button onClick={loadJadwal} className="bg-primary text-on-primary py-sm px-md rounded-lg font-label-md text-label-md hover:bg-on-primary-fixed-variant transition-colors flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">refresh</span> Refresh Jadwal
                    </button>
                  </div>
                </div>

                {isLoading ? <Loader text="Menyinkronkan jadwal..." /> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {jadwal.map(j => (
                  <div key={j.id_jadwal} className="group bg-white dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-xl p-6 hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 dark:bg-primary-fixed/5 rounded-full -translate-y-10 translate-x-10 group-hover:scale-110 transition-transform duration-500 pointer-events-none"></div>
                    <div className={`absolute top-0 left-0 w-full h-1 ${j.status_siswa === 'SELESAI' ? 'bg-[#10B981]' : j.status_siswa === 'SEDANG KERJA' ? 'bg-[#D97706]' : 'bg-primary'}`}></div>

                    <h3 className="font-headline-sm text-headline-sm text-on-surface dark:text-white mb-2 pt-2 relative z-10">{j.nama_mapel}</h3>
                    <div className="flex items-center gap-2 mb-4 relative z-10">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${j.status_siswa === 'SELESAI' ? 'bg-[#10B981]/10 text-[#10B981] dark:bg-[#10B981]/20 dark:text-[#81c995]' :
                        j.status_siswa === 'SEDANG KERJA' ? 'bg-[#D97706]/10 text-[#D97706] dark:bg-[#D97706]/20 dark:text-[#fcd34d]' :
                          'bg-surface-variant text-on-surface-variant dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                        Status: {j.status_siswa}
                      </span>
                    </div>

                    <div className="font-body-md text-body-md text-on-surface-variant dark:text-slate-300 mb-6 space-y-2 bg-surface-container-low dark:bg-slate-900/50 p-4 rounded-xl border border-outline-variant dark:border-slate-700 flex-1 relative z-10">
                      <div className="flex justify-between items-center border-b border-outline-variant dark:border-slate-700 pb-2">
                        <span className="font-medium flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">schedule</span> Buka</span>
                        <span className="font-bold text-on-surface dark:text-white">{new Date(j.waktu_mulai).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="font-medium flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">timer_off</span> Tutup</span>
                        <span className="font-bold text-error dark:text-error-container">{new Date(j.waktu_selesai).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    {j.status_siswa !== 'SELESAI' ? (
                      selectedJadwalUntukToken === j.id_jadwal ? (
                        <div className="animate-fade-in-up bg-primary-fixed/30 dark:bg-primary/20 p-4 rounded-xl border border-primary-fixed-dim dark:border-primary/30 relative z-10">
                          <input
                            type="text"
                            placeholder="6 DIGIT TOKEN"
                            className="w-full text-center tracking-[0.3em] font-mono font-bold text-xl p-3 border border-primary/30 dark:border-primary/50 rounded-lg mb-3 focus:ring-2 focus:ring-primary outline-none uppercase bg-white dark:bg-slate-800 text-on-surface dark:text-white"
                            value={inputToken}
                            onChange={(e) => setInputToken(e.target.value)}
                            maxLength={6}
                          />
                          <div className="flex gap-2">
                            <button onClick={() => setSelectedJadwalUntukToken(null)} className="flex-1 py-2 bg-white dark:bg-slate-700 text-on-surface-variant dark:text-slate-300 rounded-lg font-label-md text-label-md hover:bg-surface-container-low dark:hover:bg-slate-600 border border-outline-variant dark:border-slate-600 transition-colors">Batal</button>
                            <button onClick={() => handleMulaiUjian(j)} className="flex-1 py-2 bg-primary text-on-primary py-sm px-md rounded-lg font-label-md text-label-md hover:bg-on-primary-fixed-variant shadow-sm transition-transform active:scale-95">Masuk Ujian</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedJadwalUntukToken(j.id_jadwal)}
                          className={`w-full py-3 rounded-xl font-label-md text-label-md transition-all shadow-sm active:scale-95 border relative z-10 ${j.status_siswa === 'SEDANG KERJA' ? 'bg-[#D97706]/10 text-[#D97706] hover:bg-[#D97706]/20 border-[#D97706]/30 dark:bg-[#D97706]/20 dark:text-[#fcd34d] dark:hover:bg-[#D97706]/30' : 'bg-primary text-on-primary hover:bg-on-primary-fixed-variant border-transparent'
                            }`}
                        >
                          {j.status_siswa === 'SEDANG KERJA' ? 'LANJUTKAN UJIAN' : 'MULAI KERJAKAN'}
                        </button>
                      )
                    ) : (
                      <div className="w-full py-3 bg-surface-container dark:bg-slate-800 text-on-surface-variant dark:text-slate-400 rounded-xl font-label-md text-label-md border border-outline-variant dark:border-slate-700 flex flex-col items-center relative z-10">
                        <span>SUDAH DISELESAIKAN</span>
                        <span className="text-[12px] font-normal mt-1 text-on-surface dark:text-slate-200 font-bold">Skor Objektif: {j.nilai_auto || 0}</span>
                      </div>
                    )}
                  </div>
                ))}
                {jadwal.length === 0 && (
                  <div className="col-span-full py-12 text-center font-body-md text-on-surface-variant">Tidak ada jadwal ujian saat ini.</div>
                )}
              </div>
            )}
              </>
            )}

            {activeTab === 'pengumuman' && (
              <div className="animate-fade-in-up">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-sm mb-lg">
                  <div>
                    <h1 className="font-headline-lg text-headline-lg text-on-surface dark:text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary dark:text-primary-fixed text-[32px]">campaign</span> Pengumuman
                    </h1>
                    <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-1">Informasi dan pembaruan terbaru dari sekolah.</p>
                  </div>
                </div>
                {isLoading ? <Loader text="Memuat pengumuman..." /> : (
                  <div className="space-y-4 max-w-4xl">
                    {dataPengumuman.map(p => (
                      <div key={p.id_pengumuman} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-outline-variant dark:border-slate-700 shadow-sm relative hover:shadow-md transition-shadow">
                        <h4 className="font-bold text-on-surface dark:text-white text-xl mb-1">{p.judul}</h4>
                        <p className="text-sm text-slate-500 mb-4">{new Date(p.created_at).toLocaleString('id-ID')} • <span className="uppercase text-primary font-bold text-xs bg-primary/10 px-2 py-0.5 rounded">Untuk {p.target_role}</span></p>
                        <p className="text-on-surface-variant dark:text-slate-300 leading-relaxed whitespace-pre-line text-body-lg">{p.isi}</p>
                      </div>
                    ))}
                    {dataPengumuman.length === 0 && (
                      <div className="p-12 text-center bg-surface-container-low dark:bg-slate-800/50 rounded-2xl border border-dashed border-outline-variant dark:border-slate-700">
                        <span className="material-symbols-outlined text-5xl text-slate-400 mb-3 block">notifications_paused</span>
                        <p className="text-slate-500 font-medium text-lg">Belum ada pengumuman.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'riwayat' && (
              <div className="animate-fade-in-up">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-sm mb-lg">
                  <div>
                    <h1 className="font-headline-lg text-headline-lg text-on-surface dark:text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary dark:text-primary-fixed text-[32px]">history</span> Riwayat Ujian
                    </h1>
                    <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-1">Daftar ujian yang telah Anda selesaikan beserta skornya.</p>
                  </div>
                </div>
                {isLoading ? <Loader text="Memuat riwayat..." /> : (
                  <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                          <tr>
                            <th className="p-4 font-bold text-slate-600 dark:text-slate-300">Waktu Pelaksanaan</th>
                            <th className="p-4 font-bold text-slate-600 dark:text-slate-300">Mata Pelajaran</th>
                            <th className="p-4 font-bold text-slate-600 dark:text-slate-300">Skor PG</th>
                            <th className="p-4 font-bold text-slate-600 dark:text-slate-300">Skor Uraian</th>
                            <th className="p-4 font-bold text-primary dark:text-primary-fixed">Total Skor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                          {dataRiwayat.map(r => (
                            <tr key={r.id_log} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                              <td className="p-4 font-mono text-sm text-slate-600 dark:text-slate-300">
                                {new Date(r.waktu_mulai).toLocaleString('id-ID')}
                              </td>
                              <td className="p-4 font-bold text-slate-800 dark:text-slate-100">{r.nama_mapel}</td>
                              <td className="p-4 text-slate-600 dark:text-slate-300">{r.nilai_auto}</td>
                              <td className="p-4 text-slate-600 dark:text-slate-300">{r.nilai_uraian}</td>
                              <td className="p-4 font-bold text-primary text-lg">{r.total_nilai}</td>
                            </tr>
                          ))}
                          {dataRiwayat.length === 0 && (
                            <tr>
                              <td colSpan="5" className="p-8 text-center text-slate-500">Belum ada riwayat ujian yang diselesaikan.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      );
    };

    // ==========================================
    // ROOT APP & LOGIN
    // ==========================================
