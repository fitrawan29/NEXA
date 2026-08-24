    const GuruView = ({ user, onLogout, isDarkMode, setIsDarkMode }) => {
      const api = (action, p = {}) => {
        if (Array.isArray(p)) return fetchAPI(action, p.map(item => ({ ...item, npsn: user.npsn })));
        return fetchAPI(action, { ...p, npsn: user.npsn });
      };
      const [activeTab, setActiveTab] = useState('jadwal');
      const [dataJadwal, setDataJadwal] = useState([]);
      const [selectedJadwal, setSelectedJadwal] = useState(null);
      const [dataLog, setDataLog] = useState([]);
      const [isLoading, setIsLoading] = useState(false);
      
      const [dataMapel, setDataMapel] = useState([]);
      const [selectedMapel, setSelectedMapel] = useState(null);
      const [dataSoal, setDataSoal] = useState([]); // This will contain SOAL, NARASI, and SKEMA
      const [formSoal, setFormSoal] = useState({ isOpen: false, data: null });
      const [formNarasi, setFormNarasi] = useState({ isOpen: false, data: null });
      const [soalSubTab, setSoalSubTab] = useState('soal'); // soal, narasi, skema
      
      const [modalUraian, setModalUraian] = useState({ isOpen: false, logUjian: null, jawabanUraian: [] });

      const fetchData = async () => {
        setIsLoading(true);
        if (activeTab === 'jadwal') {
          const res = await api('get_jadwal_pengawas', { id_guru: user.id_guru });
          if (res.status === 'success') setDataJadwal(res.data);
        } else if (activeTab === 'monitoring') {
          const res = await api('get_jadwal_pengawas', { id_guru: user.id_guru });
          if (res.status === 'success') setDataJadwal(res.data);
          if (selectedJadwal) {
            const logRes = await api('monitoring_ujian', { id_jadwal: selectedJadwal });
            if (logRes.status === 'success') setDataLog(logRes.data);
          }
        } else if (activeTab === 'bank_soal') {
          const res = await api('get_mapel_guru', { id_guru: user.id_guru });
          if (res.status === 'success') setDataMapel(res.data);
          
          if (selectedMapel) {
            const soalRes = await api('get_soal_by_mapel', { id_mapel: selectedMapel });
            if (soalRes.status === 'success') setDataSoal(soalRes.data);
          }
        }
        setIsLoading(false);
      };

      useEffect(() => {
        fetchData();
        // Polling for monitoring
        let interval;
        if (activeTab === 'monitoring' && selectedJadwal) {
          interval = setInterval(fetchData, 5000);
        }
        return () => clearInterval(interval);
      }, [activeTab, selectedJadwal, selectedMapel]);

      const handleGenerateToken = async (id) => {
        const res = await api('get_token', { id_jadwal: id });
        if (res.status === 'success') {
          alert('Token Ujian: ' + res.token);
          fetchData();
        } else alert(res.message);
      };

      const handleBlock = async (idLog) => {
        if (!confirm('Blokir siswa ini?')) return;
        await api('catat_pelanggaran', { id_log: idLog });
        fetchData();
      };

      const handleUnblock = async (idLog) => {
        if (!confirm('Buka blokir siswa ini?')) return;
        await api('buka_blokir', { id_log: idLog });
        fetchData();
      };

      const saveSoal = async (payload) => {
        const endpoint = payload.id_soal ? 'update_soal_mapel' : 'create_soal_mapel';
        if (!payload.id_soal) {
          payload.id_soal = 'S-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        }
        payload.id_mapel = selectedMapel;
        const res = await api(endpoint, payload);
        if (res.status === 'success') {
          setFormSoal({ isOpen: false, data: null });
          setFormNarasi({ isOpen: false, data: null });
          fetchData();
        } else alert(res.message);
      };

      const saveSkema = async (payload) => {
        // Skema is saved as a special Soal record
        let skemaRecord = dataSoal.find(s => s.tipe_soal === 'SKEMA_PENILAIAN');
        payload.id_soal = skemaRecord ? skemaRecord.id_soal : 'SKEMA-' + selectedMapel;
        payload.tipe_soal = 'SKEMA_PENILAIAN';
        payload.id_mapel = selectedMapel;
        payload.pertanyaan = 'Skema Penilaian';
        
        const endpoint = skemaRecord ? 'update_soal_mapel' : 'create_soal_mapel';
        const res = await api(endpoint, payload);
        if (res.status === 'success') {
          alert('Skema penilaian berhasil disimpan.');
          fetchData();
        } else alert(res.message);
      };

      const deleteSoal = async (id) => {
        if (!confirm('Hapus soal ini?')) return;
        const res = await api('delete_soal_mapel', { id_soal: id });
        if (res.status === 'success') fetchData();
        else alert(res.message);
      };

      const openPeriksaUraian = async (logData) => {
        const res = await api('get_jawaban_uraian', { id_log: logData.id_log });
        if (res.status === 'success') {
          setModalUraian({ isOpen: true, logUjian: logData, jawabanUraian: res.data });
        } else {
          alert('Gagal mengambil jawaban uraian: ' + res.message);
        }
      };

      const saveNilaiUraian = async (totalNilai) => {
        const res = await api('update_nilai_uraian', { id_log: modalUraian.logUjian.id_log, nilai_uraian_total: totalNilai });
        if (res.status === 'success') {
          setModalUraian({ isOpen: false, logUjian: null, jawabanUraian: [] });
          fetchData();
        } else alert(res.message);
      };

      return (
        <div className="bg-background dark:bg-slate-900 text-on-background dark:text-slate-100 antialiased flex min-h-screen transition-colors duration-500">
          <nav className="bg-surface-container-low dark:bg-slate-900 text-primary docked left-0 h-full w-64 border-r border-outline-variant dark:border-slate-800 flex flex-col p-md z-40 hidden md:flex transition-colors duration-500">
            <div className="flex items-center space-x-sm mb-lg px-sm">
              <div>
                <h1 className="font-headline-sm text-headline-sm font-bold text-on-surface dark:text-white flex items-center gap-2"><img src="stitch_assets/screen_3_logo.png" className="w-8 h-8 rounded-full bg-white p-0.5 object-contain" /> NEXA</h1>
                <p className="font-label-md text-label-md text-on-surface-variant dark:text-slate-400">Guru Panel</p>
              </div>
            </div>
            <div className="flex-1 space-y-base mt-md">
              <a onClick={(e) => { e.preventDefault(); setActiveTab('jadwal'); setSelectedMapel(null); }} className={`flex items-center space-x-sm px-md py-sm rounded-lg font-label-md cursor-pointer ${activeTab === 'jadwal' ? 'bg-primary-container text-on-primary-container' : 'hover:bg-surface-variant'}`}>
                <span className="material-symbols-outlined">calendar_today</span><span>Jadwal Saya</span>
              </a>
              <a onClick={(e) => { e.preventDefault(); setActiveTab('bank_soal'); setSelectedMapel(null); }} className={`flex items-center space-x-sm px-md py-sm rounded-lg font-label-md cursor-pointer ${activeTab === 'bank_soal' ? 'bg-primary-container text-on-primary-container' : 'hover:bg-surface-variant'}`}>
                <span className="material-symbols-outlined">library_books</span><span>Bank Soal</span>
              </a>
              <a onClick={(e) => { e.preventDefault(); setActiveTab('monitoring'); setSelectedMapel(null); }} className={`flex items-center space-x-sm px-md py-sm rounded-lg font-label-md cursor-pointer ${activeTab === 'monitoring' ? 'bg-primary-container text-on-primary-container' : 'hover:bg-surface-variant'}`}>
                <span className="material-symbols-outlined">monitor</span><span>Monitoring</span>
              </a>
            </div>
            <div className="mt-auto border-t border-outline-variant dark:border-slate-800 pt-md">
              <button onClick={onLogout} className="w-full flex items-center justify-center space-x-sm bg-error-container text-on-error-container px-md py-sm rounded-lg font-label-md hover:bg-error/20">
                <span className="material-symbols-outlined">logout</span><span>Keluar</span>
              </button>
            </div>
          </nav>

          <main className="flex-1 p-lg sm:p-xl w-full">
            <header className="mb-xl">
              <h2 className="font-display-sm text-display-sm font-semibold">{activeTab === 'jadwal' ? 'Jadwal Mengawas' : activeTab === 'bank_soal' ? 'Bank Soal' : 'Monitoring Ujian'}</h2>
            </header>

            {activeTab === 'jadwal' && (
              <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant shadow-sm overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-surface-variant/30">
                    <tr><th className="p-4">ID Jadwal</th><th className="p-4">Mapel</th><th className="p-4">Waktu</th><th className="p-4 text-right">Aksi</th></tr>
                  </thead>
                  <tbody>
                    {dataJadwal.map(j => (
                      <tr key={j.id_jadwal} className="border-t border-outline-variant/30">
                        <td className="p-4">{j.id_jadwal}</td>
                        <td className="p-4">{j.nama_mapel}</td>
                        <td className="p-4 text-sm">{new Date(j.waktu_mulai).toLocaleString()} - {new Date(j.waktu_selesai).toLocaleString()}</td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleGenerateToken(j.id_jadwal)} className="bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1 rounded text-sm font-bold">Token</button>
                          <button onClick={() => { setSelectedJadwal(j.id_jadwal); setActiveTab('monitoring'); }} className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1 rounded text-sm font-bold ml-2">Pantau</button>
                        </td>
                      </tr>
                    ))}
                    {dataJadwal.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-500">Tidak ada jadwal mengawas.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'monitoring' && (
              <div>
                <select onChange={(e) => setSelectedJadwal(e.target.value)} value={selectedJadwal || ''} className="p-2 border rounded-lg bg-surface dark:bg-slate-800 mb-6 w-full max-w-md">
                  <option value="">-- Pilih Jadwal --</option>
                  {dataJadwal.map(j => <option key={j.id_jadwal} value={j.id_jadwal}>{j.id_jadwal} - {j.nama_mapel}</option>)}
                </select>

                {selectedJadwal ? (
                  <div className="bg-surface dark:bg-slate-800 rounded-2xl border shadow-sm overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-surface-variant/30">
                        <tr><th className="p-4">Siswa</th><th className="p-4">Status</th><th className="p-4 text-center">Pelanggaran</th><th className="p-4 text-right">Aksi</th></tr>
                      </thead>
                      <tbody>
                        {dataLog.map(l => (
                          <tr key={l.id_log} className="border-t border-outline-variant/30">
                            <td className="p-4 font-bold">{l.nama_lengkap} <br /><span className="text-xs text-slate-500 font-normal">{l.id_siswa}</span></td>
                            <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${l.is_blocked ? 'bg-red-100 text-red-700' : l.status_ujian === 'SELESAI' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{l.is_blocked ? 'DIBLOKIR' : l.status_ujian}</span></td>
                            <td className="p-4 text-center font-bold text-error">{l.pelanggaran || 0}</td>
                            <td className="p-4 text-right">
                              {!l.is_blocked ? (
                                <button onClick={() => handleBlock(l.id_log)} className="bg-red-100 text-red-700 px-3 py-1 rounded text-xs font-bold">Blokir</button>
                              ) : (
                                <button onClick={() => handleUnblock(l.id_log)} className="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-bold">Buka Blokir</button>
                              )}
                              {l.status_ujian === 'SELESAI' && (
                                <button onClick={() => openPeriksaUraian(l)} className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded text-xs font-bold ml-2">Periksa Uraian</button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {dataLog.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-500">Belum ada siswa yang login.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                ) : <div className="p-8 text-center bg-surface-variant/30 rounded-xl">Pilih jadwal ujian.</div>}
              </div>
            )}

            {activeTab === 'bank_soal' && !selectedMapel && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
                {dataMapel.map(m => (
                  <div key={m.id_mapel} onClick={() => setSelectedMapel(m.id_mapel)} className="bg-surface dark:bg-slate-800 p-lg rounded-2xl border border-outline-variant shadow-sm cursor-pointer hover:-translate-y-1 transition-all">
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4"><span className="material-symbols-outlined">library_books</span></div>
                    <h3 className="text-xl font-bold mb-1">{m.nama_mapel}</h3>
                    <p className="text-sm text-slate-500">ID: {m.id_mapel}</p>
                  </div>
                ))}
                {dataMapel.length === 0 && <div className="col-span-full p-8 text-center text-slate-500">Belum ada mata pelajaran yang ditugaskan.</div>}
              </div>
            )}

            {activeTab === 'bank_soal' && selectedMapel && (
              <div className="animate-fade-in-up">
                <div className="flex justify-between items-center mb-4">
                  <button onClick={() => { setSelectedMapel(null); setSoalSubTab('soal'); }} className="flex items-center gap-2 text-primary font-bold hover:underline"><span className="material-symbols-outlined">arrow_back</span> Kembali</button>
                  <div className="flex gap-2">
                    <button onClick={() => setSoalSubTab('soal')} className={`px-4 py-2 rounded-lg font-bold transition-all ${soalSubTab === 'soal' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-variant hover:bg-surface-variant/80'}`}>Daftar Soal</button>
                    <button onClick={() => setSoalSubTab('narasi')} className={`px-4 py-2 rounded-lg font-bold transition-all ${soalSubTab === 'narasi' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-variant hover:bg-surface-variant/80'}`}>Daftar Narasi</button>
                    <button onClick={() => setSoalSubTab('skema')} className={`px-4 py-2 rounded-lg font-bold transition-all ${soalSubTab === 'skema' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-variant hover:bg-surface-variant/80'}`}>Skema Penilaian</button>
                  </div>
                </div>

                {soalSubTab === 'soal' && (
                  <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-outline-variant flex justify-between items-center">
                      <h3 className="font-bold text-lg">Daftar Soal</h3>
                      <button onClick={() => setFormSoal({ isOpen: true, data: null })} className="bg-primary text-on-primary hover:bg-primary/90 px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:-translate-y-0.5 transition-all"><span className="material-symbols-outlined">add</span> Tambah Soal</button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-surface-variant/30">
                          <tr><th className="p-4">Tipe</th><th className="p-4">Pertanyaan / Stimulus</th><th className="p-4 text-center">Bobot</th><th className="p-4 text-right">Aksi</th></tr>
                        </thead>
                        <tbody>
                          {dataSoal.filter(s => s.tipe_soal !== 'NARASI' && s.tipe_soal !== 'SKEMA_PENILAIAN').map(s => (
                            <tr key={s.id_soal} className="border-t border-outline-variant/30 hover:bg-surface-variant/10">
                              <td className="p-4 font-bold text-primary">{s.tipe_soal}</td>
                              <td className="p-4 text-sm"><div className="line-clamp-2 max-w-lg" dangerouslySetInnerHTML={{ __html: s.pertanyaan }}></div></td>
                              <td className="p-4 text-center font-bold">{s.bobot || 1}</td>
                              <td className="p-4 text-right whitespace-nowrap">
                                <button onClick={() => setFormSoal({ isOpen: true, data: s })} className="text-blue-500 hover:text-blue-700 mr-3 p-1 rounded hover:bg-blue-50"><span className="material-symbols-outlined">edit</span></button>
                                <button onClick={() => deleteSoal(s.id_soal)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"><span className="material-symbols-outlined">delete</span></button>
                              </td>
                            </tr>
                          ))}
                          {dataSoal.filter(s => s.tipe_soal !== 'NARASI' && s.tipe_soal !== 'SKEMA_PENILAIAN').length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-500">Belum ada soal untuk mata pelajaran ini.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {soalSubTab === 'narasi' && (
                  <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-outline-variant flex justify-between items-center">
                      <h3 className="font-bold text-lg">Daftar Narasi (Teks Berbagi)</h3>
                      <button onClick={() => setFormNarasi({ isOpen: true, data: null })} className="bg-primary text-on-primary hover:bg-primary/90 px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:-translate-y-0.5 transition-all"><span className="material-symbols-outlined">add</span> Tambah Narasi</button>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {dataSoal.filter(s => s.tipe_soal === 'NARASI').map(s => (
                        <div key={s.id_soal} className="p-4 border border-outline-variant rounded-xl relative group">
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setFormNarasi({ isOpen: true, data: s })} className="text-blue-500 p-1 bg-blue-50 rounded"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                            <button onClick={() => deleteSoal(s.id_soal)} className="text-red-500 p-1 bg-red-50 rounded"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                          </div>
                          <p className="font-bold mb-2 text-sm text-slate-500">ID: {s.id_soal}</p>
                          <div className="text-sm line-clamp-4" dangerouslySetInnerHTML={{ __html: s.pertanyaan }}></div>
                        </div>
                      ))}
                      {dataSoal.filter(s => s.tipe_soal === 'NARASI').length === 0 && <p className="text-slate-500 col-span-full">Belum ada narasi.</p>}
                    </div>
                  </div>
                )}

                {soalSubTab === 'skema' && (
                  <SkemaPenilaianPanel dataSoal={dataSoal} onSave={saveSkema} />
                )}
              </div>
            )}

            {/* Render Form Modals */}
            <FormSoalModal isOpen={formSoal.isOpen} data={formSoal.data} narasiList={dataSoal.filter(s => s.tipe_soal === 'NARASI')} onClose={() => setFormSoal({ isOpen: false, data: null })} onSave={saveSoal} />
            <FormNarasiModal isOpen={formNarasi.isOpen} data={formNarasi.data} onClose={() => setFormNarasi({ isOpen: false, data: null })} onSave={saveSoal} />
            <ModalPeriksaUraian isOpen={modalUraian.isOpen} logUjian={modalUraian.logUjian} jawabanUraian={modalUraian.jawabanUraian} onClose={() => setModalUraian({ isOpen: false, logUjian: null, jawabanUraian: [] })} onSave={saveNilaiUraian} />
          </main>
        </div>
      );
    };

