    const GuruView = ({ user, onLogout, isDarkMode, setIsDarkMode }) => {
      const api = (action, p = {}) => {
        if (Array.isArray(p)) return fetchAPI(action, p.map(item => ({ ...item, npsn: user.npsn })));
        return fetchAPI(action, { ...p, npsn: user.npsn });
      };
      const [activeTab, setActiveTab] = useState('jadwal');
      const [dataJadwal, setDataJadwal] = useState([]);
      const [selectedJadwal, setSelectedJadwal] = useState(null);
      const [dataLog, setDataLog] = useState([]);
      const [dataPengumuman, setDataPengumuman] = useState([]);
      const [dataAnalisis, setDataAnalisis] = useState([]);
      const [isAnalisisModalOpen, setIsAnalisisModalOpen] = useState(false);
      const [isLoading, setIsLoading] = useState(false);
      const [hasNotification, setHasNotification] = useState(false);
      
      const [dataMapel, setDataMapel] = useState([]);
      const [selectedMapel, setSelectedMapel] = useState(null);
      const [dataSoal, setDataSoal] = useState([]);
      const [formSoal, setFormSoal] = useState({ isOpen: false, data: null });
      const [formNarasi, setFormNarasi] = useState({ isOpen: false, data: null });
      const [soalSubTab, setSoalSubTab] = useState('soal');
      const [bankSoalPage, setBankSoalPage] = useState(1);
      const itemsPerPage = 10;
      
      
      // === Import Excel & Preview ===
      const fileInputRef = React.useRef(null);
      const [isPreviewOpen, setIsPreviewOpen] = useState(false);

      const handleImportExcel = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const data = evt.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheet = workbook.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
            
            const payloadData = rows.map(row => {
              let opsiStr = null;
              if (row.tipe_soal === 'PG' || row.tipe_soal === 'PGK') {
                opsiStr = JSON.stringify([
                  { id: 'A', teks: row.opsi_A || '' },
                  { id: 'B', teks: row.opsi_B || '' },
                  { id: 'C', teks: row.opsi_C || '' },
                  { id: 'D', teks: row.opsi_D || '' },
                  { id: 'E', teks: row.opsi_E || '' }
                ]);
              }
              return {
                id_mapel: selectedMapel,
                npsn: user.npsn,
                tipe_soal: row.tipe_soal || 'PG',
                pertanyaan: row.pertanyaan || '',
                opsi: opsiStr,
                kunci_jawaban: row.kunci_jawaban ? String(row.kunci_jawaban) : '',
                bobot: row.bobot ? parseInt(row.bobot) : 10
              };
            });

            if (payloadData.length === 0) return alert('File Excel kosong atau format tidak sesuai.');
            
            const res = await api('import_soal_bulk', { data: payloadData, npsn: user.npsn });
            if (res.status === 'success') {
              alert(payloadData.length + ' soal berhasil diimpor!');
              fetchData();
            } else {
              alert(res.message);
            }
          } catch (err) {
            alert('Gagal memproses file: ' + err.message);
          }
          e.target.value = '';
        };
        reader.readAsBinaryString(file);
      };

      const renderPreviewModal = () => {
        if (!isPreviewOpen) return null;
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-surface dark:bg-slate-800 rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-outline-variant/30 dark:border-slate-700">
              <div className="p-4 border-b border-outline-variant dark:border-slate-700 flex justify-between items-center bg-surface-variant/30 dark:bg-slate-800/80">
                <h3 className="font-bold text-lg">Pratinjau Ujian</h3>
                <button onClick={() => setIsPreviewOpen(false)} className="text-on-surface-variant hover:bg-surface-variant rounded-full p-1"><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {dataSoal.map((soal, idx) => (
                  <div key={soal.id_soal} className="p-4 border border-outline-variant rounded-xl shadow-sm">
                    <div className="font-bold mb-2 flex justify-between">
                      <span>Soal No. {idx + 1} ({soal.tipe_soal})</span>
                      <span className="text-sm font-normal text-slate-500">Bobot: {soal.bobot}</span>
                    </div>
                    <div className="mb-4 prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: soal.pertanyaan }} />
                    {soal.tipe_soal === 'PG' && soal.opsi && (
                      <div className="space-y-2">
                        {soal.opsi.map(opt => (
                          <div key={opt.id} className={`p-3 rounded-lg border ${soal.kunci_jawaban === opt.id ? 'bg-green-100 border-green-500' : 'border-outline-variant'}`}>
                            <span className="font-bold mr-2">{opt.id}.</span> <span dangerouslySetInnerHTML={{ __html: opt.teks }} />
                          </div>
                        ))}
                      </div>
                    )}
                    {soal.tipe_soal === 'URAIAN' && (
                      <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <span className="text-slate-400 italic">Kolom jawaban siswa akan muncul di sini...</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      };
      
      const [modalUraian, setModalUraian] = useState({ isOpen: false, logUjian: null, jawabanUraian: [] });

      // === Profil State ===
      const [showProfileModal, setShowProfileModal] = useState(false);
      const [profileForm, setProfileForm] = useState({ password: '', foto: user.foto || '' });
      const [profileLoading, setProfileLoading] = useState(false);

      const guruId = user.id_guru || user.id_user;

      const fetchData = async () => {
        setIsLoading(true);
        if (activeTab === 'jadwal') {
          const res = await api('get_jadwal_pengawas', { id_guru: guruId });
          if (res.status === 'success') setDataJadwal(res.data);
        } else if (activeTab === 'pengumuman') {
          const res = await api('get_pengumuman', { role: 'guru' });
          if (res.status === 'success') setDataPengumuman(res.data);
        } else if (activeTab === 'monitoring' || activeTab === 'hasil') {
          const res = await api('get_jadwal_pengawas', { id_guru: guruId });
          if (res.status === 'success') setDataJadwal(res.data);
          if (selectedJadwal) {
            const endpoint = activeTab === 'hasil' ? 'get_hasil_ujian' : 'monitoring_ujian';
            const logRes = await api(endpoint, { id_jadwal: selectedJadwal });
            if (logRes.status === 'success') setDataLog(logRes.data);
          }
        } else if (activeTab === 'bank_soal') {
          const res = await api('get_mapel_guru', { id_guru: guruId });
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
        let interval;
        if (activeTab === 'monitoring' && selectedJadwal) {
          interval = setInterval(fetchData, 5000);
        }
        return () => clearInterval(interval);
      }, [activeTab, selectedJadwal, selectedMapel]);

      useEffect(() => {
        if (window.MathJax) {
          setTimeout(() => {
            window.MathJax.typesetPromise().catch(err => console.error('MathJax error:', err));
          }, 100);
        }
      }, [dataSoal, activeTab, bankSoalPage, selectedMapel, modalUraian.isOpen, formSoal.isOpen, isAnalisisModalOpen]);

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

      // === Profil Handlers ===
      const handleFotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { alert('Ukuran file maksimal 2MB'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => setProfileForm(prev => ({ ...prev, foto: ev.target.result }));
        reader.readAsDataURL(file);
      };

      const saveProfile = async () => {
        setProfileLoading(true);
        const updatePayload = { id_guru: guruId };
        if (profileForm.password.trim()) updatePayload.password = profileForm.password.trim();
        if (profileForm.foto) updatePayload.foto = profileForm.foto;
        
        const res = await api('update_profil_guru', updatePayload);
        setProfileLoading(false);
        if (res.status === 'success') {
          alert('Profil berhasil diperbarui!');
          setShowProfileModal(false);
          if (profileForm.foto) user.foto = profileForm.foto;
        } else {
          alert('Gagal memperbarui profil: ' + res.message);
        }
      };

      // === Color scheme for mapel cards by tingkatan ===
      const mapelCardColors = [
        { bg: 'from-blue-500 to-blue-600', light: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: 'bg-blue-500/10 text-blue-500', border: 'border-blue-200 dark:border-blue-800' },
        { bg: 'from-emerald-500 to-emerald-600', light: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', icon: 'bg-emerald-500/10 text-emerald-500', border: 'border-emerald-200 dark:border-emerald-800' },
        { bg: 'from-violet-500 to-violet-600', light: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-600 dark:text-violet-400', icon: 'bg-violet-500/10 text-violet-500', border: 'border-violet-200 dark:border-violet-800' },
        { bg: 'from-amber-500 to-amber-600', light: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', icon: 'bg-amber-500/10 text-amber-500', border: 'border-amber-200 dark:border-amber-800' },
        { bg: 'from-rose-500 to-rose-600', light: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-400', icon: 'bg-rose-500/10 text-rose-500', border: 'border-rose-200 dark:border-rose-800' },
        { bg: 'from-cyan-500 to-cyan-600', light: 'bg-cyan-50 dark:bg-cyan-900/30', text: 'text-cyan-600 dark:text-cyan-400', icon: 'bg-cyan-500/10 text-cyan-500', border: 'border-cyan-200 dark:border-cyan-800' },
      ];

      const getMapelColor = (index) => mapelCardColors[index % mapelCardColors.length];

      const openAnalisisSoal = async () => {
        if (!selectedJadwal) return alert('Pilih jadwal ujian terlebih dahulu.');
        const jadwalObj = dataJadwal.find(j => j.id_jadwal === selectedJadwal);
        if (!jadwalObj) return;
        setIsLoading(true);
        const res = await api('get_analisis_soal', { id_jadwal: selectedJadwal, id_mapel: jadwalObj.id_mapel });
        setIsLoading(false);
        if (res.status === 'success') {
          setDataAnalisis(res.data);
          setIsAnalisisModalOpen(true);
        } else {
          alert('Gagal memuat analisis soal: ' + res.message);
        }
      };

      const renderAnalisisModal = () => {
        if (!isAnalisisModalOpen) return null;
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-surface dark:bg-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl p-6 relative border border-outline-variant/30 dark:border-slate-700 max-h-[90vh] overflow-y-auto flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-on-surface dark:text-white flex items-center gap-2"><span className="material-symbols-outlined text-primary">analytics</span> Analisis Butir Soal</h2>
                <button onClick={() => setIsAnalisisModalOpen(false)} className="text-on-surface-variant hover:bg-surface-variant rounded-full p-1"><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="flex-1 overflow-auto rounded-xl border border-outline-variant dark:border-slate-700">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-variant/50 dark:bg-slate-900 sticky top-0 z-10">
                    <tr><th className="p-3 border-b border-outline-variant dark:border-slate-700">ID Soal</th><th className="p-3 border-b border-outline-variant dark:border-slate-700 w-1/2">Pertanyaan</th><th className="p-3 border-b border-outline-variant dark:border-slate-700 text-center">Tipe</th><th className="p-3 border-b border-outline-variant dark:border-slate-700 text-center">Benar</th><th className="p-3 border-b border-outline-variant dark:border-slate-700 text-center">Salah</th><th className="p-3 border-b border-outline-variant dark:border-slate-700 text-right">Tingkat Kesukaran</th></tr>
                  </thead>
                  <tbody>
                    {dataAnalisis.length > 0 ? dataAnalisis.map((soal, idx) => (
                      <tr key={idx} className="border-b border-outline-variant/50 dark:border-slate-700/50 hover:bg-surface-variant/20 dark:hover:bg-slate-800">
                        <td className="p-3 text-sm">{soal.id_soal}</td>
                        <td className="p-3 text-sm truncate max-w-[200px]" dangerouslySetInnerHTML={{ __html: soal.pertanyaan }}></td>
                        <td className="p-3 text-center text-xs"><span className="bg-primary/10 text-primary px-2 py-1 rounded">{soal.tipe_soal}</span></td>
                        <td className="p-3 text-center text-green-600 font-bold">{soal.correct}</td>
                        <td className="p-3 text-center text-error font-bold">{soal.wrong}</td>
                        <td className="p-3 text-right">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${parseFloat(soal.difficulty) > 70 ? 'bg-green-100 text-green-700' : parseFloat(soal.difficulty) < 30 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {soal.difficulty}%
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="6" className="p-6 text-center text-slate-500">Belum ada data pengerjaan untuk dianalisis.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      };

      const exportToExcel = () => {
        if (!dataLog || dataLog.length === 0) return alert('Tidak ada data untuk di-export');
        const exportData = dataLog.map((l, i) => ({
          'No': i + 1,
          'ID Siswa': l.id_siswa,
          'Nama Siswa': l.nama_lengkap,
          'Kelas': `${l.angkatan} ${l.kelas_paralel}`,
          'Status Ujian': l.status_ujian,
          'Pelanggaran': l.pelanggaran,
          'Nilai PG': l.nilai_auto,
          'Nilai Uraian': l.nilai_uraian,
          'Total Nilai': l.total_nilai
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Hasil Ujian");
        const fileName = `Hasil_Ujian_${selectedJadwal}_${new Date().getTime()}.xlsx`;
        XLSX.writeFile(wb, fileName);
      };

      return (
        <div className="bg-background dark:bg-slate-900 text-on-background dark:text-slate-100 antialiased flex min-h-screen transition-colors duration-500">
          {/* SIDEBAR */}
          <nav className="bg-surface dark:bg-slate-800 text-primary fixed left-0 top-0 h-full w-64 border-r border-outline-variant dark:border-slate-700 flex flex-col p-4 z-40 hidden md:flex transition-colors duration-500 shadow-sm">
            <div className="flex items-center space-x-3 mb-8 px-2 pt-2">
              <div>
                <h1 className="font-bold text-lg text-on-surface dark:text-white flex items-center gap-2"><img src="stitch_assets/screen_3_logo.png" className="w-8 h-8 rounded-full bg-white p-0.5 object-contain" /> NEXA</h1>
                <p className="text-sm text-on-surface-variant dark:text-slate-400">Guru Panel</p>
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <a onClick={(e) => { e.preventDefault(); setActiveTab('jadwal'); setSelectedMapel(null); }} className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium cursor-pointer transition-all ${activeTab === 'jadwal' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-variant dark:hover:bg-slate-700'}`}>
                <span className="material-symbols-outlined">calendar_today</span><span>Jadwal Saya</span>
              </a>
              <a onClick={(e) => { e.preventDefault(); setActiveTab('bank_soal'); setSelectedMapel(null); setSoalSubTab('soal'); }} className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium cursor-pointer transition-all ${activeTab === 'bank_soal' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-variant dark:hover:bg-slate-700'}`}>
                <span className="material-symbols-outlined">library_books</span><span>Bank Soal</span>
              </a>
              <a onClick={(e) => { e.preventDefault(); setActiveTab('monitoring'); setSelectedMapel(null); }} className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium cursor-pointer transition-all ${activeTab === 'monitoring' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-variant dark:hover:bg-slate-700'}`}>
                <span className="material-symbols-outlined">monitor</span><span>Pantau Ujian</span>
              </a>
              <a onClick={(e) => { e.preventDefault(); setActiveTab('hasil'); setSelectedMapel(null); }} className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium cursor-pointer transition-all ${activeTab === 'hasil' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-variant dark:hover:bg-slate-700'}`}>
                <span className="material-symbols-outlined">assignment_turned_in</span><span>Hasil Ujian</span>
              </a>
              <div className="pt-2 pb-1"><div className="border-t border-outline-variant dark:border-slate-700"></div></div>
              <a onClick={(e) => { e.preventDefault(); setActiveTab('pengumuman'); setSelectedMapel(null); }} className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium cursor-pointer transition-all ${activeTab === 'pengumuman' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-variant dark:hover:bg-slate-700'}`}>
                <span className="material-symbols-outlined">campaign</span><span>Pengumuman</span>
              </a>
            </div>
          </nav>

          {/* MAIN CONTENT */}
          <div className="flex-1 flex flex-col min-h-screen md:ml-64">
            {/* TOPBAR - tanpa nama guru di bawah judul */}
            <header className="sticky top-0 z-30 bg-surface/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-outline-variant dark:border-slate-700 px-6 py-3 flex items-center justify-between shadow-sm">
              <h2 className="font-semibold text-lg text-on-surface dark:text-white">
                {activeTab === 'jadwal' ? 'Jadwal Mengawas' : activeTab === 'bank_soal' ? 'Bank Soal' : activeTab === 'pengumuman' ? 'Pengumuman' : activeTab === 'hasil' ? 'Hasil Ujian' : 'Pantau Ujian'}
              </h2>
              <div className="flex items-center gap-2">
                {/* Dark/Light Mode */}
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-surface-variant dark:hover:bg-slate-700 transition-all" title={isDarkMode ? 'Mode Terang' : 'Mode Gelap'}>
                  <span className="material-symbols-outlined text-on-surface-variant dark:text-slate-400">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                </button>
                <button onClick={() => setActiveTab('pengumuman')} className="relative p-2 rounded-full text-on-surface-variant hover:bg-surface-variant dark:hover:bg-slate-800 transition-colors" title="Pemberitahuan">
                  <span className="material-symbols-outlined">notifications</span>
                  {hasNotification && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900"></span>}
                </button>
                {/* Profile - clickable to open profile modal */}
                <button onClick={() => { setProfileForm({ password: '', foto: user.foto || '' }); setShowProfileModal(true); }} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-variant dark:bg-slate-700 hover:bg-surface-variant/80 dark:hover:bg-slate-600 transition-all cursor-pointer">
                  {user.foto ? (
                    <img src={user.foto} className="w-7 h-7 rounded-full object-cover" alt="profil" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-sm">
                      {user.nama_lengkap ? user.nama_lengkap.charAt(0).toUpperCase() : 'G'}
                    </div>
                  )}
                  <span className="text-sm font-medium hidden sm:block">{user.nama_lengkap || 'Guru'}</span>
                </button>
                {/* Logout */}
                <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-error/10 text-error hover:bg-error/20 transition-all text-sm font-medium" title="Keluar">
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  <span className="hidden sm:block">Keluar</span>
                </button>
              </div>
            </header>

            <main className="flex-1 p-6 lg:p-8">

            {/* ============ JADWAL TAB ============ */}
            {activeTab === 'jadwal' && (
              <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant shadow-sm overflow-x-auto">
                <div className="overflow-x-auto"><table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-surface-variant/30">
                    <tr><th className="py-3 px-4 font-semibold text-sm">ID Jadwal</th><th className="py-3 px-4 font-semibold text-sm">Mapel</th><th className="py-3 px-4 font-semibold text-sm">Waktu</th><th className="py-3 px-4 font-semibold text-sm text-right">Aksi</th></tr>
                  </thead>
                  <tbody>
                    {dataJadwal.map(j => (
                      <tr key={j.id_jadwal} className="border-t border-outline-variant/30">
                        <td className="py-2 px-4">{j.id_jadwal}</td>
                        <td className="py-2 px-4">{j.nama_mapel}</td>
                        <td className="py-2 px-4 text-sm">{new Date(j.waktu_mulai).toLocaleString()} - {new Date(j.waktu_selesai).toLocaleString()}</td>
                        <td className="py-2 px-4 text-right">
                          <button onClick={() => handleGenerateToken(j.id_jadwal)} className="bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1 rounded text-sm font-bold">Token</button>
                          <button onClick={() => { setSelectedJadwal(j.id_jadwal); setActiveTab('monitoring'); }} className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1 rounded text-sm font-bold ml-2">Pantau</button>
                        </td>
                      </tr>
                    ))}
                    {dataJadwal.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-500">Tidak ada jadwal mengawas.</td></tr>}
                  </tbody>
                </table></div>
              </div>
            )}

            {/* ============ MONITORING TAB ============ */}
            {activeTab === 'monitoring' && (
              <div>
                <select onChange={(e) => setSelectedJadwal(e.target.value)} value={selectedJadwal || ''} className="p-2 border rounded-lg bg-surface dark:bg-slate-800 mb-6 w-full max-w-md">
                  <option value="">-- Pilih Jadwal --</option>
                  {dataJadwal.map(j => <option key={j.id_jadwal} value={j.id_jadwal}>{j.id_jadwal} - {j.nama_mapel}</option>)}
                </select>

                {selectedJadwal ? (
                  <div className="bg-surface dark:bg-slate-800 rounded-2xl border shadow-sm overflow-x-auto">
                    <div className="overflow-x-auto"><table className="w-full text-left whitespace-nowrap">
                      <thead className="bg-surface-variant/30">
                        <tr>
                          <th className="py-3 px-4 font-semibold text-sm">Nama Lengkap</th>
                          <th className="py-3 px-4 font-semibold text-sm">Status Ujian</th>
                          <th className="py-3 px-4 font-semibold text-sm text-center">Pelanggaran</th>
                          <th className="py-3 px-4 font-semibold text-sm text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataLog.map(l => (
                          <tr key={l.id_log} className="border-t border-outline-variant/30">
                            <td className="py-2 px-4 font-semibold">{l.nama_lengkap}</td>
                            <td className="py-2 px-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                l.is_blocked ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 
                                l.status_ujian === 'SELESAI' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 
                                'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                              }`}>{l.is_blocked ? 'DIBLOKIR' : l.status_ujian}</span>
                            </td>
                            <td className="py-2 px-4 text-center">
                              <span className={`font-bold ${(l.pelanggaran || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>{l.pelanggaran || 0}</span>
                            </td>
                            <td className="py-2 px-4 text-right space-x-2">
                              {!l.is_blocked ? (
                                <button onClick={() => handleBlock(l.id_log)} className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors inline-flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[16px]">block</span>Blokir
                                </button>
                              ) : (
                                <button onClick={() => handleUnblock(l.id_log)} className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors inline-flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[16px]">lock_open</span>Buka Blokir
                                </button>
                              )}
                              {l.status_ujian === 'SELESAI' && (
                                <button onClick={() => openPeriksaUraian(l)} className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[16px]">grading</span>Periksa Uraian
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {dataLog.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-500">Belum ada siswa yang mengerjakan ujian ini.</td></tr>}
                      </tbody>
                    </table></div>
                  </div>
                ) : <div className="p-8 text-center bg-surface-variant/30 rounded-xl text-slate-500">Pilih jadwal ujian untuk melihat siswa yang sedang mengerjakan.</div>}
              </div>
            )}

            {/* ============ PENGUMUMAN TAB ============ */}
            {activeTab === 'pengumuman' && (
              <div className="animate-fade-in-up">
                <h3 className="font-bold text-xl mb-6 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">campaign</span> Pengumuman Terbaru
                </h3>
                <div className="space-y-4">
                  {dataPengumuman.map(p => (
                    <div key={p.id_pengumuman} className="bg-surface dark:bg-slate-800 p-5 rounded-2xl border border-outline-variant dark:border-slate-700 shadow-sm relative">
                      <h4 className="font-bold text-on-surface dark:text-white text-lg">{p.judul}</h4>
                      <p className="text-sm text-slate-500 mb-3">{new Date(p.created_at).toLocaleString('id-ID')} • <span className="uppercase text-primary font-bold text-xs bg-primary/10 px-2 py-0.5 rounded">Untuk {p.target_role}</span></p>
                      <p className="text-on-surface-variant dark:text-slate-300 leading-relaxed whitespace-pre-line">{p.isi}</p>
                    </div>
                  ))}
                  {dataPengumuman.length === 0 && (
                    <div className="p-12 text-center bg-surface-variant/30 rounded-2xl border border-dashed border-outline-variant dark:border-slate-700">
                      <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">notifications_paused</span>
                      <p className="text-slate-500">Belum ada pengumuman.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============ HASIL UJIAN TAB ============ */}
            {activeTab === 'hasil' && (
              <div className="animate-fade-in-up">
                <div className="flex gap-4 mb-6">
                  <select onChange={(e) => setSelectedJadwal(e.target.value)} value={selectedJadwal || ''} className="p-2 border rounded-lg bg-surface dark:bg-slate-800 dark:border-slate-700 w-full max-w-md">
                    <option value="">-- Pilih Jadwal Ujian --</option>
                    {dataJadwal.map(j => <option key={j.id_jadwal} value={j.id_jadwal}>{j.id_jadwal} - {j.nama_mapel} ({j.kelas || 'Semua Kelas'})</option>)}
                  </select>
                  {selectedJadwal && (
                    <div className="flex gap-2">
                      <button onClick={exportToExcel} className="bg-[#10B981] hover:bg-[#059669] text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all hover:-translate-y-0.5">
                        <span className="material-symbols-outlined">download</span> Export XLSX
                      </button>
                      <button onClick={openAnalisisSoal} className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all hover:-translate-y-0.5">
                        <span className="material-symbols-outlined">analytics</span> Analisis Soal
                      </button>
                    </div>
                  )}
                </div>

                {selectedJadwal ? (
                  <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant dark:border-slate-700 shadow-sm overflow-x-auto">
                    <div className="overflow-x-auto"><table className="w-full text-left whitespace-nowrap">
                      <thead className="bg-surface-variant/30 dark:bg-slate-800/80">
                        <tr>
                          <th className="py-3 px-4 font-semibold text-sm">Siswa</th>
                          <th className="py-3 px-4 font-semibold text-sm">Kelas</th>
                          <th className="py-3 px-4 font-semibold text-sm text-right">Nilai PG</th>
                          <th className="py-3 px-4 font-semibold text-sm text-right">Nilai Uraian</th>
                          <th className="py-3 px-4 font-semibold text-sm text-right">Total Nilai</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataLog.map(l => (
                          <tr key={l.id_log} className="border-t border-outline-variant/30 dark:border-slate-700 hover:bg-surface-variant/10 dark:hover:bg-slate-800/50">
                            <td className="py-2 px-4">
                              <div className="font-bold">{l.nama_lengkap}</div>
                              <div className="text-xs text-slate-500">{l.id_siswa}</div>
                            </td>
                            <td className="py-2 px-4 text-sm">{l.angkatan} {l.kelas_paralel}</td>
                            <td className="py-2 px-4 text-right font-medium text-slate-700 dark:text-slate-300">{l.nilai_auto}</td>
                            <td className="py-2 px-4 text-right font-medium text-slate-700 dark:text-slate-300">{l.nilai_uraian}</td>
                            <td className="py-2 px-4 text-right font-bold text-primary text-lg">{l.total_nilai}</td>
                          </tr>
                        ))}
                        {dataLog.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-500">Belum ada hasil untuk jadwal ini.</td></tr>}
                      </tbody>
                    </table></div>
                  </div>
                ) : (
                  <div className="p-12 text-center bg-surface-variant/30 rounded-2xl border border-dashed border-outline-variant dark:border-slate-700">
                    <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">fact_check</span>
                    <p className="text-slate-500">Pilih jadwal ujian di atas untuk melihat rekapitulasi nilai dan analisis butir soal.</p>
                  </div>
                )}
              </div>
            )}

            {/* ============ BANK SOAL - MAPEL LIST ============ */}
            {activeTab === 'bank_soal' && !selectedMapel && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {dataMapel.map((m, idx) => {
                  const color = getMapelColor(idx);
                  return (
                    <div key={m.id_mapel} onClick={() => setSelectedMapel(m.id_mapel)} className={`relative overflow-hidden rounded-2xl border ${color.border} shadow-sm cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-300 group`}>
                      {/* Color accent bar at top */}
                      <div className={`h-1.5 w-full bg-gradient-to-r ${color.bg}`}></div>
                      <div className={`p-6 ${color.light}`}>
                        <div className={`w-12 h-12 rounded-xl ${color.icon} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                          <span className="material-symbols-outlined text-2xl">library_books</span>
                        </div>
                        <h3 className="text-lg font-bold mb-1 text-on-surface dark:text-white">{m.nama_mapel}</h3>
                        <p className={`text-sm font-medium ${color.text}`}>Mata Pelajaran</p>
                      </div>
                    </div>
                  );
                })}
                {dataMapel.length === 0 && <div className="col-span-full p-8 text-center text-slate-500">Belum ada mata pelajaran yang ditugaskan.</div>}
              </div>
            )}

            {/* ============ BANK SOAL - DETAIL ============ */}
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
                      <div className="overflow-x-auto"><table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-surface-variant/30">
                          <tr><th className="py-3 px-4 font-semibold text-sm">Tipe</th><th className="py-3 px-4 font-semibold text-sm">Pertanyaan / Stimulus</th><th className="py-3 px-4 font-semibold text-sm text-center">Bobot</th><th className="py-3 px-4 font-semibold text-sm text-right">Aksi</th></tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const filteredSoal = dataSoal.filter(s => s.tipe_soal !== 'NARASI' && s.tipe_soal !== 'SKEMA_PENILAIAN');
                            const totalPages = Math.ceil(filteredSoal.length / itemsPerPage);
                            const currentSoal = filteredSoal.slice((bankSoalPage - 1) * itemsPerPage, bankSoalPage * itemsPerPage);
                            
                            return currentSoal.length > 0 ? currentSoal.map(s => (
                              <tr key={s.id_soal} className="border-t border-outline-variant/30 hover:bg-surface-variant/10">
                                <td className="py-2 px-4 font-bold text-primary">{s.tipe_soal}</td>
                                <td className="py-2 px-4 text-sm"><div className="line-clamp-2 max-w-lg" dangerouslySetInnerHTML={{ __html: s.pertanyaan }}></div></td>
                                <td className="py-2 px-4 text-center font-bold">{s.bobot || 1}</td>
                                <td className="py-2 px-4 text-right whitespace-nowrap">
                                  <button onClick={() => setFormSoal({ isOpen: true, data: s })} className="text-blue-500 hover:text-blue-700 mr-3 p-1 rounded hover:bg-blue-50"><span className="material-symbols-outlined">edit</span></button>
                                  <button onClick={() => deleteSoal(s.id_soal)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"><span className="material-symbols-outlined">delete</span></button>
                                </td>
                              </tr>
                            )) : <tr><td colSpan="4" className="p-8 text-center text-slate-500">Belum ada soal untuk mata pelajaran ini.</td></tr>;
                          })()}
                        </tbody>
                      </table></div>
                      {/* Pagination Controls */}
                      {(() => {
                        const filteredSoal = dataSoal.filter(s => s.tipe_soal !== 'NARASI' && s.tipe_soal !== 'SKEMA_PENILAIAN');
                        const totalPages = Math.ceil(filteredSoal.length / itemsPerPage);
                        if (totalPages <= 1) return null;
                        return (
                          <div className="flex justify-center items-center gap-2 p-4 border-t border-outline-variant">
                            <button onClick={() => setBankSoalPage(p => Math.max(1, p - 1))} disabled={bankSoalPage === 1} className="px-3 py-1 rounded bg-surface-variant disabled:opacity-50 text-sm font-bold">Prev</button>
                            <span className="text-sm font-medium text-slate-600">Hal {bankSoalPage} dari {totalPages}</span>
                            <button onClick={() => setBankSoalPage(p => Math.min(totalPages, p + 1))} disabled={bankSoalPage === totalPages} className="px-3 py-1 rounded bg-surface-variant disabled:opacity-50 text-sm font-bold">Next</button>
                          </div>
                        );
                      })()}
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

            {/* ============ PROFIL MODAL ============ */}
            {showProfileModal && (
              <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-surface dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-outline-variant dark:border-slate-700 animate-fade-in-up">
                  <div className="p-6 border-b border-outline-variant dark:border-slate-700">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-bold text-on-surface dark:text-white">Edit Profil</h3>
                      <button onClick={() => setShowProfileModal(false)} className="p-1 rounded-full hover:bg-surface-variant dark:hover:bg-slate-700">
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                  </div>
                  <div className="p-6 space-y-6">
                    {/* Foto Profil */}
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative group">
                        {profileForm.foto ? (
                          <img src={profileForm.foto} className="w-24 h-24 rounded-full object-cover border-4 border-primary/20" alt="profil" />
                        ) : (
                          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold border-4 border-primary/20">
                            {user.nama_lengkap ? user.nama_lengkap.charAt(0).toUpperCase() : 'G'}
                          </div>
                        )}
                        <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-on-primary rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-primary/90 transition-all">
                          <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                          <input type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />
                        </label>
                      </div>
                      <p className="text-sm text-on-surface-variant dark:text-slate-400">Klik ikon kamera untuk ganti foto</p>
                    </div>

                    {/* Info (read-only) */}
                    <div>
                      <label className="block text-sm font-medium text-on-surface-variant dark:text-slate-400 mb-1">Nama Lengkap</label>
                      <input type="text" value={user.nama_lengkap || ''} readOnly className="w-full px-4 py-2.5 rounded-lg border border-outline-variant dark:border-slate-600 bg-surface-variant/30 dark:bg-slate-700/50 text-on-surface dark:text-white cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-on-surface-variant dark:text-slate-400 mb-1">Username</label>
                      <input type="text" value={user.username || ''} readOnly className="w-full px-4 py-2.5 rounded-lg border border-outline-variant dark:border-slate-600 bg-surface-variant/30 dark:bg-slate-700/50 text-on-surface dark:text-white cursor-not-allowed" />
                    </div>

                    {/* Password (editable) */}
                    <div>
                      <label className="block text-sm font-medium text-on-surface-variant dark:text-slate-400 mb-1">Password Baru <span className="text-slate-400">(kosongkan jika tidak ingin mengubah)</span></label>
                      <input type="password" value={profileForm.password} onChange={(e) => setProfileForm(prev => ({ ...prev, password: e.target.value }))} placeholder="Masukkan password baru..." className="w-full px-4 py-2.5 rounded-lg border border-outline-variant dark:border-slate-600 bg-white dark:bg-slate-900 text-on-surface dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent" />
                    </div>
                  </div>
                  <div className="p-6 border-t border-outline-variant dark:border-slate-700 flex justify-end gap-3">
                    <button onClick={() => setShowProfileModal(false)} className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-variant/50 transition-all font-medium">Batal</button>
                    <button onClick={saveProfile} disabled={profileLoading} className="px-6 py-2 bg-primary text-on-primary rounded-lg font-bold hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-2">
                      {profileLoading && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                      Simpan
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Render Form Modals */}
            <FormSoalModal isOpen={formSoal.isOpen} data={formSoal.data} narasiList={dataSoal.filter(s => s.tipe_soal === 'NARASI')} onClose={() => setFormSoal({ isOpen: false, data: null })} onSave={saveSoal} />
            <FormNarasiModal isOpen={formNarasi.isOpen} data={formNarasi.data} onClose={() => setFormNarasi({ isOpen: false, data: null })} onSave={saveSoal} />
            <ModalPeriksaUraian isOpen={modalUraian.isOpen} logUjian={modalUraian.logUjian} jawabanUraian={modalUraian.jawabanUraian} onClose={() => setModalUraian({ isOpen: false, logUjian: null, jawabanUraian: [] })} onSave={saveNilaiUraian} />
          </main>
        </div>
      </div>
      );
    };

